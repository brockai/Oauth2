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
            console.log(`Attempting to delete tenant with ID: ${id}`);

            // Check if tenant exists
            const tenantResult = await db.query('SELECT id, name, tenant_id FROM tenants WHERE id = $1', [id]);
            if (tenantResult.rows.length === 0) {
                return res.status(404).json({ error: 'Tenant not found' });
            }
            
            const tenant = tenantResult.rows[0];
            const oauthTenantId = tenant.tenant_id;
            console.log(`Found tenant: ${tenant.name} (${tenant.id})`);

            // Get all tenant users for Meilisearch cleanup
            const tenantUsersResult = await db.query('SELECT id FROM tenant_users WHERE tenant_id = $1', [id]);
            const tenantUsers = tenantUsersResult.rows;
            console.log(`Found ${tenantUsers.length} tenant users to cleanup from Meilisearch`);

            // Begin transaction for cleanup
            await db.query('BEGIN');

            try {
                // Delete in correct order respecting foreign key constraints
                
                // 1. Delete user sessions (depends on tenant_users)
                await db.query('DELETE FROM user_sessions WHERE tenant_user_id IN (SELECT id FROM tenant_users WHERE tenant_id = $1)', [id]);
                
                // 2. Delete user role assignments (depends on tenant_users and tenants)
                await db.query('DELETE FROM user_role_assignments WHERE tenant_id = $1', [id]);
                
                // 3. Delete tenant users (depends on tenants)
                await db.query('DELETE FROM tenant_users WHERE tenant_id = $1', [id]);

                // 4. Delete OAuth tokens and codes (depends on tenants)
                await db.query('DELETE FROM refresh_tokens WHERE tenant_id = $1', [id]);
                await db.query('DELETE FROM access_tokens WHERE tenant_id = $1', [id]);
                await db.query('DELETE FROM authorization_codes WHERE tenant_id = $1', [id]);

                // 5. Delete tenant application associations (depends on tenants)
                await db.query('DELETE FROM tenant_applications WHERE tenant_id = $1', [id]);

                // 6. Finally delete the tenant itself
                await db.query('DELETE FROM tenants WHERE id = $1', [id]);

                await db.query('COMMIT');
                console.log('Database deletion completed successfully');

                // 7. Cleanup users from Meilisearch (after successful database deletion)
                if (tenantUsers.length > 0) {
                    await this.cleanupMeilisearchUsers(tenantUsers, oauthTenantId, req.headers['x-api-key']);
                }

                res.json({ 
                    message: 'Tenant deleted successfully', 
                    deleted_users_count: tenantUsers.length 
                });
            } catch (deleteError) {
                await db.query('ROLLBACK');
                throw deleteError;
            }
        } catch (error) {
            console.error('Delete tenant error:', error);
            res.status(500).json({ 
                error: 'Internal server error', 
                details: error.message,
                code: error.code,
                constraint: error.constraint
            });
        }
    }

    async cleanupMeilisearchUsers(tenantUsers, oauthTenantId, apiKey) {
        try {
            console.log(`Starting Meilisearch cleanup for ${tenantUsers.length} users`);
            
            // Only attempt Meilisearch cleanup if API key is provided
            if (!apiKey) {
                console.log('No API key provided, skipping Meilisearch cleanup');
                return;
            }

            // Get bearer token for Meilisearch API
            const tokenResponse = await fetch('http://localhost:3000/admin/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                }
            });

            if (!tokenResponse.ok) {
                console.log('Failed to get bearer token for Meilisearch, skipping cleanup');
                return;
            }

            const tokenData = await tokenResponse.json();
            const bearerToken = tokenData.token;

            // Cleanup each user from Meilisearch
            for (const user of tenantUsers) {
                try {
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
                                filter: `userId = ${user.id}`,
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
                            console.log(`Deleting Meilisearch document ${userDocumentId} for user ${user.id}`);
                            
                            // Delete the user document
                            const deleteResponse = await fetch('https://meilisearch.api.fuelbadger.brockai.com/meilisearch/delete', {
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

                            if (deleteResponse.ok) {
                                console.log(`Successfully deleted Meilisearch document for user ${user.id}`);
                            } else {
                                console.log(`Failed to delete Meilisearch document for user ${user.id}`);
                            }
                        } else {
                            console.log(`No Meilisearch document found for user ${user.id}`);
                        }
                    }
                } catch (userCleanupError) {
                    console.error(`Error cleaning up Meilisearch for user ${user.id}:`, userCleanupError);
                    // Continue with other users even if one fails
                }
            }
            
            console.log('Meilisearch cleanup completed');
        } catch (meilisearchError) {
            console.error('Meilisearch cleanup error:', meilisearchError);
            // Don't fail the deletion if Meilisearch cleanup fails
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