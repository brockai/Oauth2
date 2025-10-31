const db = require('../database/connection');

class TenantsController {
    async getTenants(req, res) {
        try {
            const result = await db.query(
                'SELECT id, name, description, domain, is_active, created_at, updated_at FROM tenants ORDER BY created_at DESC'
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Get tenants error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getTenant(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                'SELECT id, name, description, domain, is_active, created_at, updated_at FROM tenants WHERE id = $1',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Get tenant error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createTenant(req, res) {
        try {
            const { name, description, domain, client_id } = req.body;

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            // Validate client_id if provided
            if (client_id && (!Array.isArray(client_id) || client_id.length === 0)) {
                return res.status(400).json({ error: 'client_id must be a non-empty array if provided' });
            }

            // If client_id provided, verify they exist
            if (client_id && client_id.length > 0) {
                const appResult = await db.query(
                    'SELECT id FROM oauth_clients WHERE client_id = ANY($1) AND is_active = true',
                    [client_id]
                );
                if (appResult.rows.length !== client_id.length) {
                    return res.status(400).json({ error: 'One or more client IDs are invalid or inactive' });
                }
            }

            // Create the tenant
            const result = await db.query(
                'INSERT INTO tenants (name, description, domain) VALUES ($1, $2, $3) RETURNING *',
                [name, description, domain]
            );

            const newTenant = result.rows[0];

            // Associate tenant with applications if provided
            if (client_id && client_id.length > 0) {
                // Get the internal UUIDs for the provided client_ids
                const appResult = await db.query(
                    'SELECT id FROM oauth_clients WHERE client_id = ANY($1) AND is_active = true',
                    [client_id]
                );

                const insertPromises = appResult.rows.map(app =>
                    db.query(
                        'INSERT INTO tenant_applications (tenant_id, application_id) VALUES ($1, $2)',
                        [newTenant.id, app.id]
                    )
                );

                await Promise.all(insertPromises);

                // Return tenant with associated applications info
                const associatedAppsResult = await db.query(
                    `SELECT oc.id, oc.name
                     FROM oauth_clients oc
                     JOIN tenant_applications ta ON oc.id = ta.application_id
                     WHERE ta.tenant_id = $1`,
                    [newTenant.id]
                );

                res.status(201).json({
                    ...newTenant,
                    associated_applications: associatedAppsResult.rows
                });
            } else {
                res.status(201).json(newTenant);
            }
        } catch (error) {
            console.error('Create tenant error:', error);
            if (error.code === '23505') { // Unique constraint violation
                res.status(400).json({ error: 'Tenant with this name or domain already exists' });
            } else {
                res.status(500).json({ error: 'Internal server error' });
            }
        }
    }

    async updateTenant(req, res) {
        try {
            const { id } = req.params;
            const { name, description, domain, is_active } = req.body;

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
            if (domain !== undefined) {
                updates.push(`domain = $${paramCount++}`);
                values.push(domain);
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

            const query = `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

            const result = await db.query(query, values);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Update tenant error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async deleteTenant(req, res) {
        try {
            const { id } = req.params;

            // Check if tenant has associated clients
            const clientsResult = await db.query(
                'SELECT COUNT(*) as client_count FROM oauth_clients WHERE tenant_id = $1',
                [id]
            );

            if (parseInt(clientsResult.rows[0].client_count) > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete tenant with existing clients. Please reassign or delete clients first.' 
                });
            }

            const result = await db.query('DELETE FROM tenants WHERE id = $1 RETURNING id', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Tenant not found' });
            }

            res.status(204).send();
        } catch (error) {
            console.error('Delete tenant error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getTenantStats(req, res) {
        try {
            const { id } = req.params;

            const [clientsResult, tokensResult, codesResult] = await Promise.all([
                db.query(
                    'SELECT COUNT(*) as total_clients, COUNT(CASE WHEN is_active = true THEN 1 END) as active_clients FROM oauth_clients WHERE tenant_id = $1',
                    [id]
                ),
                db.query(
                    'SELECT COUNT(*) as total_tokens, COUNT(CASE WHEN revoked = false AND expires_at > NOW() THEN 1 END) as active_tokens FROM access_tokens WHERE tenant_id = $1',
                    [id]
                ),
                db.query(
                    'SELECT COUNT(*) as total_codes FROM authorization_codes WHERE tenant_id = $1',
                    [id]
                )
            ]);

            res.json({
                total_clients: parseInt(clientsResult.rows[0].total_clients),
                active_clients: parseInt(clientsResult.rows[0].active_clients),
                total_tokens: parseInt(tokensResult.rows[0].total_tokens),
                active_tokens: parseInt(tokensResult.rows[0].active_tokens),
                total_authorization_codes: parseInt(codesResult.rows[0].total_codes)
            });
        } catch (error) {
            console.error('Get tenant stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new TenantsController();