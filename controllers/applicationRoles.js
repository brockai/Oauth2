const db = require('../database/connection');

class ApplicationRolesController {
    // Get all roles for a specific application
    async getRoles(req, res) {
        try {
            const { applicationId } = req.params;

            // Verify application exists
            const appResult = await db.query(
                'SELECT id FROM oauth_clients WHERE id = $1',
                [applicationId]
            );

            if (appResult.rows.length === 0) {
                return res.status(404).json({ error: 'Application not found' });
            }

            const result = await db.query(
                `SELECT id, role_name, role_description, permissions, is_active, created_at, updated_at
                 FROM application_roles
                 WHERE application_id = $1
                 ORDER BY role_name`,
                [applicationId]
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Get roles error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get specific role by ID
    async getRole(req, res) {
        try {
            const { applicationId, roleId } = req.params;

            const result = await db.query(
                `SELECT ar.id, ar.role_name, ar.role_description, ar.permissions, ar.is_active,
                        ar.created_at, ar.updated_at, oc.name as application_name
                 FROM application_roles ar
                 JOIN oauth_clients oc ON ar.application_id = oc.id
                 WHERE ar.application_id = $1 AND ar.id = $2`,
                [applicationId, roleId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Role not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Get role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Create new role for application
    async createRole(req, res) {
        try {
            const { applicationId } = req.params;
            const { role_name, role_description, permissions = [] } = req.body;

            if (!role_name) {
                return res.status(400).json({ error: 'role_name is required' });
            }

            // Verify application exists
            const appResult = await db.query(
                'SELECT id FROM oauth_clients WHERE id = $1',
                [applicationId]
            );

            if (appResult.rows.length === 0) {
                return res.status(404).json({ error: 'Application not found' });
            }

            // Validate permissions array
            if (!Array.isArray(permissions)) {
                return res.status(400).json({ error: 'permissions must be an array' });
            }

            const result = await db.query(
                `INSERT INTO application_roles (application_id, role_name, role_description, permissions)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, role_name, role_description, permissions, is_active, created_at, updated_at`,
                [applicationId, role_name, role_description, JSON.stringify(permissions)]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            if (error.constraint === 'unique_app_role') {
                return res.status(409).json({ error: 'Role name already exists for this application' });
            }
            console.error('Create role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Update role
    async updateRole(req, res) {
        try {
            const { applicationId, roleId } = req.params;
            const { role_name, role_description, permissions, is_active } = req.body;

            const updates = [];
            const values = [];
            let paramCount = 1;

            if (role_name !== undefined) {
                updates.push(`role_name = $${paramCount++}`);
                values.push(role_name);
            }
            if (role_description !== undefined) {
                updates.push(`role_description = $${paramCount++}`);
                values.push(role_description);
            }
            if (permissions !== undefined) {
                if (!Array.isArray(permissions)) {
                    return res.status(400).json({ error: 'permissions must be an array' });
                }
                updates.push(`permissions = $${paramCount++}`);
                values.push(JSON.stringify(permissions));
            }
            if (is_active !== undefined) {
                updates.push(`is_active = $${paramCount++}`);
                values.push(is_active);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(applicationId, roleId);

            const query = `
                UPDATE application_roles
                SET ${updates.join(', ')}
                WHERE application_id = $${paramCount++} AND id = $${paramCount}
                RETURNING id, role_name, role_description, permissions, is_active, created_at, updated_at
            `;

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Role not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            if (error.constraint === 'unique_app_role') {
                return res.status(409).json({ error: 'Role name already exists for this application' });
            }
            console.error('Update role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Delete role
    async deleteRole(req, res) {
        try {
            const { applicationId, roleId } = req.params;

            // Check if role is assigned to any users
            const assignmentResult = await db.query(
                'SELECT COUNT(*) as assignment_count FROM user_role_assignments WHERE role_id = $1 AND is_active = true',
                [roleId]
            );

            if (parseInt(assignmentResult.rows[0].assignment_count) > 0) {
                return res.status(400).json({
                    error: 'Cannot delete role that is assigned to users',
                    assigned_users: parseInt(assignmentResult.rows[0].assignment_count)
                });
            }

            const result = await db.query(
                'DELETE FROM application_roles WHERE application_id = $1 AND id = $2 RETURNING id',
                [applicationId, roleId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Role not found' });
            }

            res.status(204).send();
        } catch (error) {
            console.error('Delete role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get role assignments for a specific role
    async getRoleAssignments(req, res) {
        try {
            const { applicationId, roleId } = req.params;

            const result = await db.query(
                `SELECT ura.id, ura.user_id, ura.tenant_id, ura.assigned_at, ura.expires_at, ura.is_active,
                        t.name as tenant_name,
                        tu.username, tu.email, tu.first_name, tu.last_name
                 FROM user_role_assignments ura
                 LEFT JOIN tenants t ON ura.tenant_id = t.id
                 LEFT JOIN tenant_users tu ON ura.user_id = tu.id
                 WHERE ura.application_id = $1 AND ura.role_id = $2
                 ORDER BY ura.assigned_at DESC`,
                [applicationId, roleId]
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Get role assignments error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Assign role to user
    async assignRole(req, res) {
        try {
            const { applicationId, roleId } = req.params;
            const { user_id, tenant_id, expires_at } = req.body;

            if (!user_id) {
                return res.status(400).json({ error: 'user_id is required' });
            }

            // Verify role exists for this application
            const roleResult = await db.query(
                'SELECT id FROM application_roles WHERE application_id = $1 AND id = $2 AND is_active = true',
                [applicationId, roleId]
            );

            if (roleResult.rows.length === 0) {
                return res.status(404).json({ error: 'Role not found or inactive' });
            }

            // If tenant_id provided, verify it exists
            if (tenant_id) {
                const tenantResult = await db.query(
                    'SELECT id FROM tenants WHERE id = $1 AND is_active = true',
                    [tenant_id]
                );
                if (tenantResult.rows.length === 0) {
                    return res.status(400).json({ error: 'Invalid or inactive tenant' });
                }
            }

            const result = await db.query(
                `INSERT INTO user_role_assignments (user_id, application_id, role_id, tenant_id, expires_at, assigned_by)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id, user_id, application_id, role_id, tenant_id, assigned_at, expires_at, is_active`,
                [user_id, applicationId, roleId, tenant_id, expires_at, req.user?.userId]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            if (error.constraint === 'unique_user_app_role') {
                return res.status(409).json({ error: 'User already has this role in this context' });
            }
            console.error('Assign role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Revoke role from user
    async revokeRole(req, res) {
        try {
            const { applicationId, roleId } = req.params;
            const { user_id, tenant_id } = req.body;

            if (!user_id) {
                return res.status(400).json({ error: 'user_id is required' });
            }

            let query = 'UPDATE user_role_assignments SET is_active = false WHERE application_id = $1 AND role_id = $2 AND user_id = $3';
            let values = [applicationId, roleId, user_id];

            if (tenant_id) {
                query += ' AND tenant_id = $4';
                values.push(tenant_id);
            } else {
                query += ' AND tenant_id IS NULL';
            }

            query += ' RETURNING id';

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Role assignment not found' });
            }

            res.json({ message: 'Role revoked successfully' });
        } catch (error) {
            console.error('Revoke role error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get user roles for a specific application
    async getUserRoles(req, res) {
        try {
            const { applicationId } = req.params;
            const { user_id, tenant_id } = req.query;

            if (!user_id) {
                return res.status(400).json({ error: 'user_id query parameter is required' });
            }

            let query = `
                SELECT ar.id, ar.role_name, ar.role_description, ar.permissions,
                       ura.assigned_at, ura.expires_at, ura.is_active,
                       t.name as tenant_name
                FROM user_role_assignments ura
                JOIN application_roles ar ON ura.role_id = ar.id
                LEFT JOIN tenants t ON ura.tenant_id = t.id
                WHERE ura.application_id = $1 AND ura.user_id = $2 AND ura.is_active = true
            `;
            let values = [applicationId, user_id];

            if (tenant_id) {
                query += ' AND ura.tenant_id = $3';
                values.push(tenant_id);
            }

            query += ' ORDER BY ar.role_name';

            const result = await db.query(query, values);
            res.json(result.rows);
        } catch (error) {
            console.error('Get user roles error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Tenant-scoped role methods
    async getTenantScopedRoles(req, res) {
        try {
            const { applicationId } = req.params;

            // First verify the application is accessible to this tenant
            const appCheck = await db.query(
                `SELECT oc.id FROM oauth_clients oc
                 JOIN tenant_applications ta ON oc.id = ta.application_id
                 WHERE oc.id = $1 AND ta.tenant_id = $2`,
                [applicationId, req.tenant_id]
            );

            if (appCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Application not found or not accessible' });
            }

            const result = await db.query(
                `SELECT id, role_name, role_description, permissions, is_active, created_at, updated_at
                 FROM application_roles
                 WHERE application_id = $1 AND is_active = true
                 ORDER BY role_name`,
                [applicationId]
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Get tenant scoped roles error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new ApplicationRolesController();