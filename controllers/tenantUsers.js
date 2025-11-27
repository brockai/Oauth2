const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../database/connection');
class TenantUsersController {
    // Get all users for a tenant
    async getTenantUsers(req, res) {
        try {
            const { tenant_id } = req.params;
            
            // Verify tenant exists
            const tenantResult = await db.query('SELECT id FROM tenants WHERE id = $1', [tenant_id]);
            if (tenantResult.rows.length === 0) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            const result = await db.query(
                `SELECT tu.id, tu.username, tu.email, tu.first_name, tu.last_name, tu.is_active, tu.is_admin,
                        tu.email_verified, tu.last_login_at, tu.created_at, tu.updated_at
                 FROM tenant_users tu
                 WHERE tu.tenant_id = $1
                 ORDER BY tu.created_at DESC`,
                [tenant_id]
            );

            // Fetch roles for each user
            const usersWithRoles = await Promise.all(
                result.rows.map(async (user) => {
                    const rolesResult = await db.query(
                        `SELECT ar.id, ar.role_name, ar.role_description, ar.permissions,
                               ura.assigned_at, ura.expires_at, ura.is_active as assignment_active,
                               oc.name as application_name, oc.id as application_id
                         FROM user_role_assignments ura
                         JOIN application_roles ar ON ura.role_id = ar.id
                         JOIN oauth_clients oc ON ura.application_id = oc.id
                         WHERE ura.user_id = $1 AND ura.tenant_id = $2 AND ura.is_active = true
                         ORDER BY ar.role_name`,
                        [user.id, tenant_id]
                    );

                    return {
                        ...user,
                        roles: rolesResult.rows
                    };
                })
            );

            res.json(usersWithRoles);
        } catch (error) {
            console.error('Get tenant users error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get specific user
    async getTenantUser(req, res) {
        try {
            const { tenant_id, user_id } = req.params;

            const result = await db.query(
                `SELECT id, username, email, first_name, last_name, is_active, is_admin,
                        email_verified, last_login_at, created_at, updated_at
                 FROM tenant_users
                 WHERE id = $1 AND tenant_id = $2`,
                [user_id, tenant_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Fetch roles for this user
            const rolesResult = await db.query(
                `SELECT ar.id, ar.role_name, ar.role_description, ar.permissions,
                       ura.assigned_at, ura.expires_at, ura.is_active as assignment_active,
                       oc.name as application_name, oc.id as application_id
                 FROM user_role_assignments ura
                 JOIN application_roles ar ON ura.role_id = ar.id
                 JOIN oauth_clients oc ON ura.application_id = oc.id
                 WHERE ura.user_id = $1 AND ura.tenant_id = $2 AND ura.is_active = true
                 ORDER BY ar.role_name`,
                [user_id, tenant_id]
            );

            const userWithRoles = {
                ...result.rows[0],
                roles: rolesResult.rows
            };

            res.json(userWithRoles);
        } catch (error) {
            console.error('Get tenant user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Create new tenant user
    async createTenantUser(req, res) {
        try {
            const { tenant_id } = req.params;
            const { username, email, password, first_name, last_name, is_admin = false, roles = [] } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Username, email, and password are required' });
            }

            // Verify tenant exists
            const tenantResult = await db.query('SELECT id FROM tenants WHERE id = $1 AND is_active = true', [tenant_id]);
            if (tenantResult.rows.length === 0) {
                return res.status(400).json({ error: 'Invalid or inactive tenant' });
            }

            // Check if username or email already exists in this tenant
            const existingResult = await db.query(
                'SELECT id FROM tenant_users WHERE tenant_id = $1 AND (username = $2 OR email = $3)',
                [tenant_id, username, email]
            );
            if (existingResult.rows.length > 0) {
                return res.status(400).json({ error: 'Username or email already exists in this tenant' });
            }

            // Hash password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);

            const result = await db.query(
                `INSERT INTO tenant_users (tenant_id, username, email, password_hash, first_name, last_name, is_admin)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, username, email, first_name, last_name, is_active, is_admin, email_verified, created_at`,
                [tenant_id, username, email, password_hash, first_name, last_name, is_admin]
            );

            const newUser = result.rows[0];

            // Assign roles if provided
            const assignedRoles = [];
            if (roles && Array.isArray(roles) && roles.length > 0) {
                for (const role of roles) {
                    const { application_id, role_id, expires_at } = role;

                    if (!application_id || !role_id) {
                        continue; // Skip invalid role assignments
                    }

                    try {
                        // Verify the role exists and is active
                        const roleCheck = await db.query(
                            'SELECT id FROM application_roles WHERE id = $1 AND application_id = $2 AND is_active = true',
                            [role_id, application_id]
                        );

                        if (roleCheck.rows.length > 0) {
                            const roleAssignment = await db.query(
                                `INSERT INTO user_role_assignments (user_id, application_id, role_id, tenant_id, expires_at, assigned_by)
                                 VALUES ($1, $2, $3, $4, $5, $6)
                                 RETURNING id, user_id, application_id, role_id, tenant_id, assigned_at, expires_at, is_active`,
                                [newUser.id, application_id, role_id, tenant_id, expires_at, req.user?.userId]
                            );
                            assignedRoles.push(roleAssignment.rows[0]);
                        }
                    } catch (roleError) {
                        console.error('Role assignment error:', roleError);
                        // Continue with other roles even if one fails
                    }
                }
            }

            res.status(201).json({
                ...newUser,
                roles: assignedRoles
            });
        } catch (error) {
            console.error('Create tenant user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Update tenant user
    async updateTenantUser(req, res) {
        try {
            const { tenant_id, user_id } = req.params;
            const { username, email, first_name, last_name, is_active, is_admin, email_verified, roles } = req.body;

            const updates = [];
            const values = [];
            let paramCount = 1;

            if (username !== undefined) {
                updates.push(`username = $${paramCount++}`);
                values.push(username);
            }
            if (email !== undefined) {
                updates.push(`email = $${paramCount++}`);
                values.push(email);
            }
            if (first_name !== undefined) {
                updates.push(`first_name = $${paramCount++}`);
                values.push(first_name);
            }
            if (last_name !== undefined) {
                updates.push(`last_name = $${paramCount++}`);
                values.push(last_name);
            }
            if (is_active !== undefined) {
                updates.push(`is_active = $${paramCount++}`);
                values.push(is_active);
            }
            if (is_admin !== undefined) {
                updates.push(`is_admin = $${paramCount++}`);
                values.push(is_admin);
            }
            if (email_verified !== undefined) {
                updates.push(`email_verified = $${paramCount++}`);
                values.push(email_verified);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(user_id, tenant_id);

            const query = `UPDATE tenant_users SET ${updates.join(', ')} 
                          WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}
                          RETURNING id, username, email, first_name, last_name, is_active, is_admin, email_verified, updated_at`;

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const updatedUser = result.rows[0];

            // Handle role updates if provided
            if (roles !== undefined && Array.isArray(roles)) {
                // First, deactivate all existing role assignments for this user in this tenant
                await db.query(
                    'UPDATE user_role_assignments SET is_active = false WHERE user_id = $1 AND tenant_id = $2',
                    [user_id, tenant_id]
                );

                // Assign new roles
                const assignedRoles = [];
                for (const role of roles) {
                    const { application_id, role_id, expires_at } = role;

                    if (!application_id || !role_id) {
                        continue; // Skip invalid role assignments
                    }

                    try {
                        // Verify the role exists and is active
                        const roleCheck = await db.query(
                            'SELECT id FROM application_roles WHERE id = $1 AND application_id = $2 AND is_active = true',
                            [role_id, application_id]
                        );

                        if (roleCheck.rows.length > 0) {
                            // Check if assignment already exists and reactivate it, or create new one
                            const existingAssignment = await db.query(
                                'UPDATE user_role_assignments SET is_active = true, assigned_at = CURRENT_TIMESTAMP, expires_at = $5 WHERE user_id = $1 AND application_id = $2 AND role_id = $3 AND tenant_id = $4 RETURNING id, user_id, application_id, role_id, tenant_id, assigned_at, expires_at, is_active',
                                [user_id, application_id, role_id, tenant_id, expires_at]
                            );

                            if (existingAssignment.rows.length === 0) {
                                // Create new assignment
                                const roleAssignment = await db.query(
                                    `INSERT INTO user_role_assignments (user_id, application_id, role_id, tenant_id, expires_at, assigned_by)
                                     VALUES ($1, $2, $3, $4, $5, $6)
                                     RETURNING id, user_id, application_id, role_id, tenant_id, assigned_at, expires_at, is_active`,
                                    [user_id, application_id, role_id, tenant_id, expires_at, req.user?.userId]
                                );
                                assignedRoles.push(roleAssignment.rows[0]);
                            } else {
                                assignedRoles.push(existingAssignment.rows[0]);
                            }
                        }
                    } catch (roleError) {
                        console.error('Role assignment error:', roleError);
                        // Continue with other roles even if one fails
                    }
                }
            }

            // Fetch current roles for the response
            const rolesResult = await db.query(
                `SELECT ar.id, ar.role_name, ar.role_description, ar.permissions,
                       ura.assigned_at, ura.expires_at, ura.is_active as assignment_active,
                       oc.name as application_name, oc.id as application_id
                 FROM user_role_assignments ura
                 JOIN application_roles ar ON ura.role_id = ar.id
                 JOIN oauth_clients oc ON ura.application_id = oc.id
                 WHERE ura.user_id = $1 AND ura.tenant_id = $2 AND ura.is_active = true
                 ORDER BY ar.role_name`,
                [user_id, tenant_id]
            );

            res.json({
                ...updatedUser,
                roles: rolesResult.rows
            });
        } catch (error) {
            console.error('Update tenant user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Delete tenant user
    async deleteTenantUser(req, res) {
        try {
            const { tenant_id, user_id } = req.params;

            // Get the OAuth tenant_id before deletion
            const tenantResult = await db.query(
                'SELECT tenant_id FROM tenants WHERE id = $1',
                [tenant_id]
            );

            if (tenantResult.rows.length === 0) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            const oauthTenantId = tenantResult.rows[0].tenant_id;

            const result = await db.query(
                'DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2 RETURNING id',
                [user_id, tenant_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Delete user from Meilisearch
            try {
                // Get bearer token for Meilisearch API
                const tokenResponse = await fetch('http://localhost:3000/admin/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': req.headers['x-api-key'] || ''
                    }
                });

                let bearerToken = '';
                if (tokenResponse.ok) {
                    const tokenData = await tokenResponse.json();
                    bearerToken = tokenData.token;
                }

                // Search for the user document in fbUser index
                const searchResponse = await fetch('https://meilisearch.api.fuelbadger.brockai.com/meilisearch/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${bearerToken}`
                    },
                    body: JSON.stringify({
                        index: 'fbUser',
                        query: {
                            q: '',
                            filter: `userId = ${user_id}`,
                            limit: 20
                        },
                        tenantId: oauthTenantId,
                        attributesToRetrieve: ['id']
                    })
                });

                if (searchResponse.ok) {
                    const userData = await searchResponse.json();
                    if (userData.hits && userData.hits.length > 0) {
                        const userDocumentId = userData.hits[0].id;
                        
                        // Delete the user document
                        await fetch('https://meilisearch.api.fuelbadger.brockai.com/meilisearch/delete', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${bearerToken}`
                            },
                            body: JSON.stringify({
                                id: userDocumentId,
                                index: 'fbUser',
                                tenantId: oauthTenantId
                            })
                        });
                    }
                }
            } catch (meilisearchError) {
                console.error('Meilisearch user cleanup error:', meilisearchError);
                // Don't fail the deletion if Meilisearch cleanup fails
            }

            res.status(204).send();
        } catch (error) {
            console.error('Delete tenant user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Reset user password
    async resetUserPassword(req, res) {
        try {
            const { tenant_id, user_id } = req.params;
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }

            // Hash new password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);

            const result = await db.query(
                'UPDATE tenant_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING id',
                [password_hash, user_id, tenant_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'Password updated successfully' });
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // OAuth 2.0 user authentication endpoint
    async authenticateUser(req, res) {
        try {
            const { tenant_id, username, password } = req.body;

            if (!tenant_id || !username || !password) {
                return res.status(400).json({ error: 'tenant_id, username, and password are required' });
            }

            // Find user in tenant
            const userResult = await db.query(
                'SELECT id, username, email, password_hash, first_name, last_name, is_active FROM tenant_users WHERE tenant_id = $1 AND (username = $2 OR email = $2) AND is_active = true',
                [tenant_id, username]
            );

            if (userResult.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = userResult.rows[0];

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Update last login
            await db.query(
                'UPDATE tenant_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
                [user.id]
            );

            // Create session token
            const session_token = crypto.randomBytes(32).toString('hex');
            const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            await db.query(
                'INSERT INTO user_sessions (tenant_user_id, session_token, expires_at) VALUES ($1, $2, $3)',
                [user.id, session_token, expires_at]
            );

            // Return user info (without password)
            const { password_hash, ...userInfo } = user;
            res.json({
                user: userInfo,
                session_token,
                expires_at
            });
        } catch (error) {
            console.error('Authenticate user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Validate session token
    async validateSession(req, res) {
        try {
            const { session_token } = req.body;

            if (!session_token) {
                return res.status(400).json({ error: 'session_token is required' });
            }

            const result = await db.query(
                `SELECT us.id, us.expires_at, tu.id as user_id, tu.username, tu.email, 
                        tu.first_name, tu.last_name, tu.tenant_id, t.name as tenant_name
                 FROM user_sessions us
                 JOIN tenant_users tu ON us.tenant_user_id = tu.id
                 JOIN tenants t ON tu.tenant_id = t.id
                 WHERE us.session_token = $1 AND us.expires_at > NOW() AND tu.is_active = true`,
                [session_token]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }

            const session = result.rows[0];

            // Update last accessed
            await db.query(
                'UPDATE user_sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = $1',
                [session.id]
            );

            res.json({
                user: {
                    id: session.user_id,
                    username: session.username,
                    email: session.email,
                    first_name: session.first_name,
                    last_name: session.last_name,
                    tenant_id: session.tenant_id,
                    tenant_name: session.tenant_name
                },
                expires_at: session.expires_at
            });
        } catch (error) {
            console.error('Validate session error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Logout user (invalidate session)
    async logoutUser(req, res) {
        try {
            const { session_token } = req.body;

            if (!session_token) {
                return res.status(400).json({ error: 'session_token is required' });
            }

            await db.query('DELETE FROM user_sessions WHERE session_token = $1', [session_token]);

            res.json({ message: 'Logged out successfully' });
        } catch (error) {
            console.error('Logout user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Tenant-scoped methods for the new tenant routes

    // Get current user's profile
    async getCurrentUserProfile(req, res) {
        try {
            const result = await db.query(
                `SELECT id, username, email, first_name, last_name, is_active, is_admin,
                        email_verified, last_login_at, created_at, updated_at
                 FROM tenant_users
                 WHERE id = $1 AND tenant_id = $2`,
                [req.user.id, req.tenant_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Get current user profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Update current user's profile
    async updateCurrentUserProfile(req, res) {
        try {
            const { first_name, last_name, email, current_password, new_password } = req.body;
            const user_id = req.user.id;

            const updates = [];
            const values = [];
            let paramCount = 1;

            if (first_name !== undefined) {
                updates.push(`first_name = $${paramCount++}`);
                values.push(first_name);
            }
            if (last_name !== undefined) {
                updates.push(`last_name = $${paramCount++}`);
                values.push(last_name);
            }
            if (email !== undefined) {
                // Check if email is already taken in this tenant
                const emailCheck = await db.query(
                    'SELECT id FROM tenant_users WHERE tenant_id = $1 AND email = $2 AND id != $3',
                    [req.tenant_id, email, user_id]
                );
                if (emailCheck.rows.length > 0) {
                    return res.status(400).json({ error: 'Email already taken in this tenant' });
                }
                updates.push(`email = $${paramCount++}`);
                values.push(email);
            }

            // Handle password change
            if (new_password) {
                if (!current_password) {
                    return res.status(400).json({ error: 'Current password required to change password' });
                }

                // Verify current password
                const userResult = await db.query(
                    'SELECT password_hash FROM tenant_users WHERE id = $1 AND tenant_id = $2',
                    [user_id, req.tenant_id]
                );

                if (userResult.rows.length === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }

                const validPassword = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Current password is incorrect' });
                }

                if (new_password.length < 6) {
                    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
                }

                const saltRounds = 12;
                const password_hash = await bcrypt.hash(new_password, saltRounds);
                updates.push(`password_hash = $${paramCount++}`);
                values.push(password_hash);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(user_id, req.tenant_id);

            const query = `UPDATE tenant_users SET ${updates.join(', ')}
                          WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}
                          RETURNING id, username, email, first_name, last_name, is_active, is_admin, email_verified, updated_at`;

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Update current user profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get users scoped to tenant (for tenant admin)
    async getTenantScopedUsers(req, res) {
        try {
            const result = await db.query(
                `SELECT tu.id, tu.username, tu.email, tu.first_name, tu.last_name, tu.is_active, tu.is_admin,
                        tu.email_verified, tu.last_login_at, tu.created_at, tu.updated_at
                 FROM tenant_users tu
                 WHERE tu.tenant_id = $1
                 ORDER BY tu.created_at DESC`,
                [req.tenant_id]
            );

            // Fetch roles for each user in this tenant
            const usersWithRoles = await Promise.all(
                result.rows.map(async (user) => {
                    const rolesResult = await db.query(
                        `SELECT ar.id, ar.role_name, ar.role_description, ar.permissions,
                               ura.assigned_at, ura.expires_at, ura.is_active as assignment_active,
                               oc.name as application_name, oc.id as application_id
                         FROM user_role_assignments ura
                         JOIN application_roles ar ON ura.role_id = ar.id
                         JOIN oauth_clients oc ON ura.application_id = oc.id
                         WHERE ura.user_id = $1 AND ura.tenant_id = $2 AND ura.is_active = true
                         ORDER BY ar.role_name`,
                        [user.id, req.tenant_id]
                    );

                    return {
                        ...user,
                        roles: rolesResult.rows
                    };
                })
            );

            res.json(usersWithRoles);
        } catch (error) {
            console.error('Get tenant scoped users error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Create user scoped to tenant (for tenant admin)
    async createTenantScopedUser(req, res) {
        try {
            const { username, email, password, first_name, last_name, is_admin = false } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({ error: 'Username, email, and password are required' });
            }

            // Check if username or email already exists in this tenant
            const existingResult = await db.query(
                'SELECT id FROM tenant_users WHERE tenant_id = $1 AND (username = $2 OR email = $3)',
                [req.tenant_id, username, email]
            );
            if (existingResult.rows.length > 0) {
                return res.status(400).json({ error: 'Username or email already exists in this tenant' });
            }

            // Hash password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);

            const result = await db.query(
                `INSERT INTO tenant_users (tenant_id, username, email, password_hash, first_name, last_name, is_admin)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, username, email, first_name, last_name, is_active, is_admin, email_verified, created_at`,
                [req.tenant_id, username, email, password_hash, first_name, last_name, is_admin]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Create tenant scoped user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Get specific user scoped to tenant (for tenant admin)
    async getTenantScopedUser(req, res) {
        try {
            const { user_id } = req.params;

            const result = await db.query(
                `SELECT id, username, email, first_name, last_name, is_active, is_admin,
                        email_verified, last_login_at, created_at, updated_at
                 FROM tenant_users
                 WHERE id = $1 AND tenant_id = $2`,
                [user_id, req.tenant_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Fetch roles for this user in this tenant
            const rolesResult = await db.query(
                `SELECT ar.id, ar.role_name, ar.role_description, ar.permissions,
                       ura.assigned_at, ura.expires_at, ura.is_active as assignment_active,
                       oc.name as application_name, oc.id as application_id
                 FROM user_role_assignments ura
                 JOIN application_roles ar ON ura.role_id = ar.id
                 JOIN oauth_clients oc ON ura.application_id = oc.id
                 WHERE ura.user_id = $1 AND ura.tenant_id = $2 AND ura.is_active = true
                 ORDER BY ar.role_name`,
                [user_id, req.tenant_id]
            );

            const userWithRoles = {
                ...result.rows[0],
                roles: rolesResult.rows
            };

            res.json(userWithRoles);
        } catch (error) {
            console.error('Get tenant scoped user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Update user scoped to tenant (for tenant admin)
    async updateTenantScopedUser(req, res) {
        try {
            const { user_id } = req.params;
            const { username, email, first_name, last_name, is_active, is_admin, email_verified } = req.body;

            const updates = [];
            const values = [];
            let paramCount = 1;

            if (username !== undefined) {
                // Check if username is already taken in this tenant
                const usernameCheck = await db.query(
                    'SELECT id FROM tenant_users WHERE tenant_id = $1 AND username = $2 AND id != $3',
                    [req.tenant_id, username, user_id]
                );
                if (usernameCheck.rows.length > 0) {
                    return res.status(400).json({ error: 'Username already taken in this tenant' });
                }
                updates.push(`username = $${paramCount++}`);
                values.push(username);
            }
            if (email !== undefined) {
                // Check if email is already taken in this tenant
                const emailCheck = await db.query(
                    'SELECT id FROM tenant_users WHERE tenant_id = $1 AND email = $2 AND id != $3',
                    [req.tenant_id, email, user_id]
                );
                if (emailCheck.rows.length > 0) {
                    return res.status(400).json({ error: 'Email already taken in this tenant' });
                }
                updates.push(`email = $${paramCount++}`);
                values.push(email);
            }
            if (first_name !== undefined) {
                updates.push(`first_name = $${paramCount++}`);
                values.push(first_name);
            }
            if (last_name !== undefined) {
                updates.push(`last_name = $${paramCount++}`);
                values.push(last_name);
            }
            if (is_active !== undefined) {
                updates.push(`is_active = $${paramCount++}`);
                values.push(is_active);
            }
            if (is_admin !== undefined) {
                updates.push(`is_admin = $${paramCount++}`);
                values.push(is_admin);
            }
            if (email_verified !== undefined) {
                updates.push(`email_verified = $${paramCount++}`);
                values.push(email_verified);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(user_id, req.tenant_id);

            const query = `UPDATE tenant_users SET ${updates.join(', ')}
                          WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}
                          RETURNING id, username, email, first_name, last_name, is_active, is_admin, email_verified, updated_at`;

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Update tenant scoped user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Delete user scoped to tenant (for tenant admin)
    async deleteTenantScopedUser(req, res) {
        try {
            const { user_id } = req.params;

            // Prevent tenant admin from deleting themselves
            if (user_id === req.user.id) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            const result = await db.query(
                'DELETE FROM tenant_users WHERE id = $1 AND tenant_id = $2 RETURNING id',
                [user_id, req.tenant_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.status(204).send();
        } catch (error) {
            console.error('Delete tenant scoped user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Check if email exists in any tenant
    async checkEmailExists(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const result = await db.query(
                'SELECT id, username, email, first_name, last_name, is_active, is_admin, tenant_id, email_verified, last_login_at, created_at FROM tenant_users WHERE email = $1',
                [email]
            );

            const emailExists = result.rows.length > 0;

            if (emailExists) {
                res.json({
                    exists: true,
                    user: result.rows[0]
                });
            } else {
                res.json({ exists: false });
            }
        } catch (error) {
            console.error('Check email exists error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Reset user password (tenant admin scoped)
    async resetTenantUserPassword(req, res) {
        try {
            const { user_id, password } = req.body;

            if (!user_id || !password) {
                return res.status(400).json({ error: 'user_id and password are required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }

            // Prevent tenant admin from resetting their own password through this endpoint
            if (user_id === req.user.id) {
                return res.status(400).json({ error: 'Use the profile endpoint to change your own password' });
            }

            // Hash new password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);

            // Update password, ensuring user exists in the tenant admin's tenant
            const result = await db.query(
                'UPDATE tenant_users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING id, username',
                [password_hash, user_id, req.tenant_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User not found in current tenant' });
            }

            res.json({ message: 'Password updated successfully' });
        } catch (error) {
            console.error('Reset tenant user password error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new TenantUsersController();