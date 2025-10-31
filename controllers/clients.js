const crypto = require('crypto');
const db = require('../database/connection');

class ClientsController {
    async getClients(req, res) {
        try {
            const { tenant_id } = req.query;
            
            let query;
            let values = [];
            
            if (tenant_id) {
                // Get applications for a specific tenant using junction table
                query = `
                    SELECT DISTINCT c.id, c.client_id, c.name, c.description, c.redirect_uris,
                           c.grant_types, c.scope, c.is_active, c.created_at, c.updated_at,
                           ARRAY_AGG(DISTINCT t.name) as tenant_names,
                           ARRAY_AGG(DISTINCT t.id) as tenant_ids,
                           COALESCE(ARRAY_AGG(DISTINCT jsonb_build_object(
                               'id', ar.id,
                               'role_name', ar.role_name,
                               'role_description', ar.role_description,
                               'permissions', ar.permissions,
                               'is_active', ar.is_active
                           )) FILTER (WHERE ar.id IS NOT NULL), ARRAY[]::jsonb[]) as roles
                    FROM oauth_clients c
                    INNER JOIN tenant_applications ta ON c.id = ta.application_id
                    INNER JOIN tenants t ON ta.tenant_id = t.id
                    LEFT JOIN application_roles ar ON c.id = ar.application_id AND ar.is_active = true
                    WHERE ta.tenant_id = $1
                    GROUP BY c.id, c.client_id, c.name, c.description, c.redirect_uris,
                             c.grant_types, c.scope, c.is_active, c.created_at, c.updated_at
                    ORDER BY c.created_at DESC
                `;
                values = [tenant_id];
            } else {
                // Get all applications with their associated tenants
                query = `
                    SELECT c.id, c.client_id, c.name, c.description, c.redirect_uris,
                           c.grant_types, c.scope, c.is_active, c.created_at, c.updated_at,
                           COALESCE(ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tenant_names,
                           COALESCE(ARRAY_AGG(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}') as tenant_ids,
                           COALESCE(ARRAY_AGG(DISTINCT jsonb_build_object(
                               'id', ar.id,
                               'role_name', ar.role_name,
                               'role_description', ar.role_description,
                               'permissions', ar.permissions,
                               'is_active', ar.is_active
                           )) FILTER (WHERE ar.id IS NOT NULL), ARRAY[]::jsonb[]) as roles
                    FROM oauth_clients c
                    LEFT JOIN tenant_applications ta ON c.id = ta.application_id
                    LEFT JOIN tenants t ON ta.tenant_id = t.id
                    LEFT JOIN application_roles ar ON c.id = ar.application_id AND ar.is_active = true
                    GROUP BY c.id, c.client_id, c.name, c.description, c.redirect_uris,
                             c.grant_types, c.scope, c.is_active, c.created_at, c.updated_at
                    ORDER BY c.created_at DESC
                `;
            }
            
            const result = await db.query(query, values);

            res.json(result.rows);
        } catch (error) {
            console.error('Get clients error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getClient(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `SELECT c.id, c.client_id, c.name, c.description, c.redirect_uris, c.grant_types,
                        c.scope, c.is_active, c.created_at, c.updated_at,
                        COALESCE(ARRAY_AGG(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') as tenant_names,
                        COALESCE(ARRAY_AGG(DISTINCT t.id) FILTER (WHERE t.id IS NOT NULL), '{}') as tenant_ids,
                        COALESCE(ARRAY_AGG(DISTINCT jsonb_build_object(
                            'id', ar.id,
                            'role_name', ar.role_name,
                            'role_description', ar.role_description,
                            'permissions', ar.permissions,
                            'is_active', ar.is_active,
                            'created_at', ar.created_at,
                            'updated_at', ar.updated_at
                        )) FILTER (WHERE ar.id IS NOT NULL), ARRAY[]::jsonb[]) as roles
                 FROM oauth_clients c
                 LEFT JOIN tenant_applications ta ON c.id = ta.application_id
                 LEFT JOIN tenants t ON ta.tenant_id = t.id
                 LEFT JOIN application_roles ar ON c.id = ar.application_id AND ar.is_active = true
                 WHERE c.id = $1
                 GROUP BY c.id, c.client_id, c.name, c.description, c.redirect_uris,
                          c.grant_types, c.scope, c.is_active, c.created_at, c.updated_at`,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Get client error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createClient(req, res) {
        try {
            const { name, description, redirect_uris, grant_types = ['authorization_code'], scope = 'read', tenant_ids } = req.body;

            if (!name || !redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
                return res.status(400).json({ error: 'Name and redirect_uris are required' });
            }

            // tenant_ids is now optional for creating standalone applications
            // If provided, verify all tenants exist
            if (tenant_ids && Array.isArray(tenant_ids) && tenant_ids.length > 0) {
                const tenantResult = await db.query(
                    'SELECT id FROM tenants WHERE id = ANY($1) AND is_active = true',
                    [tenant_ids]
                );
                if (tenantResult.rows.length !== tenant_ids.length) {
                    return res.status(400).json({ error: 'One or more tenants are invalid or inactive' });
                }
            }

            const client_id = crypto.randomBytes(16).toString('hex');
            const client_secret = crypto.randomBytes(32).toString('hex');

            // Start transaction
            await db.query('BEGIN');
            
            try {
                // Create the application without tenant_id
                const result = await db.query(
                    'INSERT INTO oauth_clients (client_id, client_secret, name, description, redirect_uris, grant_types, scope) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                    [client_id, client_secret, name, description, redirect_uris, grant_types, scope]
                );

                const client = result.rows[0];
                
                // Associate with tenants if provided
                if (tenant_ids && Array.isArray(tenant_ids) && tenant_ids.length > 0) {
                    for (const tenant_id of tenant_ids) {
                        await db.query(
                            'INSERT INTO tenant_applications (tenant_id, application_id) VALUES ($1, $2)',
                            [tenant_id, client.id]
                        );
                    }
                }
                
                await db.query('COMMIT');
                
                delete client.client_secret;

                res.status(201).json({
                    ...client,
                    client_secret: client_secret
                });
            } catch (error) {
                await db.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Create client error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async updateClient(req, res) {
        try {
            const { id } = req.params;
            const { name, description, redirect_uris, grant_types, scope, is_active } = req.body;

            const updates = [];
            const values = [];
            let paramCount = 1;

            if (name !== undefined) {
                updates.push(`name = $${paramCount++}`);
                values.push(name);
            }
            if (description !== undefined) {
                updates.push(`description = $${paramCount++}`);
                values.push(description);
            }
            if (redirect_uris !== undefined) {
                updates.push(`redirect_uris = $${paramCount++}`);
                values.push(redirect_uris);
            }
            if (grant_types !== undefined) {
                updates.push(`grant_types = $${paramCount++}`);
                values.push(grant_types);
            }
            if (scope !== undefined) {
                updates.push(`scope = $${paramCount++}`);
                values.push(scope);
            }
            if (is_active !== undefined) {
                updates.push(`is_active = $${paramCount++}`);
                values.push(is_active);
            }

            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            updates.push(`updated_at = CURRENT_TIMESTAMP`);
            values.push(id);

            const query = `UPDATE oauth_clients SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, client_id, name, description, redirect_uris, grant_types, scope, is_active, created_at, updated_at`;

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Update client error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async deleteClient(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query('DELETE FROM oauth_clients WHERE id = $1 RETURNING id', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.status(204).send();
        } catch (error) {
            console.error('Delete client error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async regenerateSecret(req, res) {
        try {
            const { id } = req.params;

            const newSecret = crypto.randomBytes(32).toString('hex');

            const result = await db.query(
                'UPDATE oauth_clients SET client_secret = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id',
                [newSecret, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            res.json({ client_secret: newSecret });
        } catch (error) {
            console.error('Regenerate secret error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getClientStats(req, res) {
        try {
            const { id } = req.params;

            const clientResult = await db.query(
                'SELECT client_id FROM oauth_clients WHERE id = $1',
                [id]
            );

            if (clientResult.rows.length === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }

            const client_id = clientResult.rows[0].client_id;

            const [tokensResult, codesResult] = await Promise.all([
                db.query(
                    'SELECT COUNT(*) as total_tokens, COUNT(CASE WHEN revoked = false AND expires_at > NOW() THEN 1 END) as active_tokens FROM access_tokens WHERE client_id = $1',
                    [client_id]
                ),
                db.query(
                    'SELECT COUNT(*) as total_codes FROM authorization_codes WHERE client_id = $1',
                    [client_id]
                )
            ]);

            res.json({
                total_tokens: parseInt(tokensResult.rows[0].total_tokens),
                active_tokens: parseInt(tokensResult.rows[0].active_tokens),
                total_authorization_codes: parseInt(codesResult.rows[0].total_codes)
            });
        } catch (error) {
            console.error('Get client stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Add application to tenant(s)
    async addApplicationToTenants(req, res) {
        try {
            const { id } = req.params; // application id
            const { tenant_ids } = req.body;

            if (!tenant_ids || !Array.isArray(tenant_ids) || tenant_ids.length === 0) {
                return res.status(400).json({ error: 'tenant_ids array is required' });
            }

            // Verify application exists
            const appResult = await db.query('SELECT id FROM oauth_clients WHERE id = $1', [id]);
            if (appResult.rows.length === 0) {
                return res.status(404).json({ error: 'Application not found' });
            }

            // Verify all tenants exist
            const tenantResult = await db.query(
                'SELECT id FROM tenants WHERE id = ANY($1) AND is_active = true',
                [tenant_ids]
            );
            if (tenantResult.rows.length !== tenant_ids.length) {
                return res.status(400).json({ error: 'One or more tenants are invalid or inactive' });
            }

            // Add relationships (ignore duplicates)
            const insertPromises = tenant_ids.map(tenant_id =>
                db.query(
                    'INSERT INTO tenant_applications (tenant_id, application_id) VALUES ($1, $2) ON CONFLICT (tenant_id, application_id) DO NOTHING',
                    [tenant_id, id]
                )
            );

            await Promise.all(insertPromises);

            res.json({ message: 'Application associated with tenants successfully' });
        } catch (error) {
            console.error('Add application to tenants error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Remove application from tenant(s)
    async removeApplicationFromTenants(req, res) {
        try {
            const { id } = req.params; // application id
            const { tenant_ids } = req.body;

            if (!tenant_ids || !Array.isArray(tenant_ids) || tenant_ids.length === 0) {
                return res.status(400).json({ error: 'tenant_ids array is required' });
            }

            const result = await db.query(
                'DELETE FROM tenant_applications WHERE application_id = $1 AND tenant_id = ANY($2) RETURNING tenant_id',
                [id, tenant_ids]
            );

            res.json({ 
                message: `Application removed from ${result.rows.length} tenant(s)`,
                removed_from: result.rows.map(row => row.tenant_id)
            });
        } catch (error) {
            console.error('Remove application from tenants error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // Tenant-scoped client methods
    async getTenantScopedClients(req, res) {
        try {
            const result = await db.query(
                `SELECT oc.id, oc.client_id, oc.name, oc.description, oc.redirect_uris,
                        oc.grant_types, oc.scope, oc.is_active, oc.created_at, oc.updated_at
                 FROM oauth_clients oc
                 JOIN tenant_applications ta ON oc.id = ta.application_id
                 WHERE ta.tenant_id = $1
                 ORDER BY oc.created_at DESC`,
                [req.tenant_id]
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Get tenant scoped clients error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getTenantScopedClient(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                `SELECT oc.id, oc.client_id, oc.name, oc.description, oc.redirect_uris,
                        oc.grant_types, oc.scope, oc.is_active, oc.created_at, oc.updated_at
                 FROM oauth_clients oc
                 JOIN tenant_applications ta ON oc.id = ta.application_id
                 WHERE oc.id = $1 AND ta.tenant_id = $2`,
                [id, req.tenant_id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Client not found or not accessible' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Get tenant scoped client error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new ClientsController();