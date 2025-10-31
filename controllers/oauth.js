const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');

class OAuthController {
    async authorize(req, res) {
        try {
            const { response_type, client_id, redirect_uri, scope = 'read', state, roles } = req.query;

            if (response_type !== 'code') {
                return res.status(400).json({ error: 'unsupported_response_type' });
            }

            const clientResult = await db.query(
                'SELECT * FROM oauth_clients WHERE client_id = $1 AND is_active = true',
                [client_id]
            );

            if (clientResult.rows.length === 0) {
                return res.status(400).json({ error: 'invalid_client' });
            }

            const client = clientResult.rows[0];

            if (!client.redirect_uris.includes(redirect_uri)) {
                return res.status(400).json({ error: 'invalid_redirect_uri' });
            }

            // Validate requested roles if provided
            let requestedRoles = null;
            if (roles) {
                requestedRoles = roles.split(',').map(r => r.trim());

                // Verify all requested roles exist for this application
                const roleResult = await db.query(
                    'SELECT role_name FROM application_roles WHERE application_id = $1 AND role_name = ANY($2) AND is_active = true',
                    [client.id, requestedRoles]
                );

                if (roleResult.rows.length !== requestedRoles.length) {
                    return res.status(400).json({
                        error: 'invalid_roles',
                        description: 'One or more requested roles are invalid or inactive'
                    });
                }
            }

            const code = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            await db.query(
                'INSERT INTO authorization_codes (code, client_id, redirect_uri, scope, requested_roles, expires_at) VALUES ($1, $2, $3, $4, $5, $6)',
                [code, client_id, redirect_uri, scope, roles, expiresAt]
            );

            const redirectUrl = new URL(redirect_uri);
            redirectUrl.searchParams.append('code', code);
            if (state) redirectUrl.searchParams.append('state', state);

            // Include CSRF token if available (for client-side flows)
            if (req.csrfToken) {
                redirectUrl.searchParams.append('csrf_token', req.csrfToken);
            }

            res.redirect(redirectUrl.toString());
        } catch (error) {
            console.error('Authorization error:', error);
            res.status(500).json({ error: 'server_error' });
        }
    }

    async token(req, res) {
        try {
            const { grant_type, code, redirect_uri, client_id, user_id, tenant_id } = req.body;

            if (grant_type !== 'authorization_code') {
                return res.status(400).json({ error: 'unsupported_grant_type' });
            }

            // Fetch client details using only client_id
            const clientResult = await db.query(
                'SELECT * FROM oauth_clients WHERE client_id = $1 AND is_active = true',
                [client_id]
            );

            if (clientResult.rows.length === 0) {
                return res.status(401).json({ error: 'invalid_client' });
            }

            const codeResult = await db.query(
                'SELECT * FROM authorization_codes WHERE code = $1 AND client_id = $2 AND redirect_uri = $3 AND used = false AND expires_at > NOW()',
                [code, client_id, redirect_uri]
            );

            if (codeResult.rows.length === 0) {
                return res.status(400).json({ error: 'invalid_grant' });
            }

            const authCode = codeResult.rows[0];
            const client = clientResult.rows[0];

            // Resolve user roles if user_id is provided
            let assignedRoles = [];
            let rolePermissions = [];

            if (user_id) {
                // Get user's assigned roles for this application
                let roleQuery = `
                    SELECT ar.id, ar.role_name, ar.permissions
                    FROM user_role_assignments ura
                    JOIN application_roles ar ON ura.role_id = ar.id
                    WHERE ura.user_id = $1 AND ura.application_id = $2 AND ura.is_active = true
                    AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
                `;
                let roleParams = [user_id, client.id];

                // Filter by tenant if provided
                if (tenant_id) {
                    roleQuery += ' AND (ura.tenant_id = $3 OR ura.tenant_id IS NULL)';
                    roleParams.push(tenant_id);
                } else {
                    roleQuery += ' AND ura.tenant_id IS NULL';
                }

                // Filter by requested roles if any were specified in authorization
                if (authCode.requested_roles) {
                    const requestedRoleNames = authCode.requested_roles.split(',').map(r => r.trim());
                    roleQuery += ` AND ar.role_name = ANY($${roleParams.length + 1})`;
                    roleParams.push(requestedRoleNames);
                }

                const userRolesResult = await db.query(roleQuery, roleParams);

                assignedRoles = userRolesResult.rows.map(row => row.id);
                rolePermissions = userRolesResult.rows.reduce((acc, row) => {
                    return [...acc, ...row.permissions];
                }, []);

                // Remove duplicates from permissions
                rolePermissions = [...new Set(rolePermissions)];
            }

            await db.query('UPDATE authorization_codes SET used = true, assigned_roles = $1 WHERE id = $2', [assignedRoles, authCode.id]);

            const tokenPayload = {
                client_id: client_id,
                scope: authCode.scope,
                type: 'access_token'
            };

            // Include user and role information in token if available
            if (user_id) {
                tokenPayload.user_id = user_id;
                tokenPayload.roles = assignedRoles;
                tokenPayload.permissions = rolePermissions;
                if (tenant_id) {
                    tokenPayload.tenant_id = tenant_id;
                }
            }

            const accessToken = jwt.sign(
                tokenPayload,
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            const refreshToken = crypto.randomBytes(32).toString('hex');
            const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
            const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

            const accessTokenResult = await db.query(
                'INSERT INTO access_tokens (token, client_id, scope, user_id, assigned_roles, expires_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [accessToken, client_id, authCode.scope, user_id, assignedRoles, accessTokenExpiresAt]
            );

            await db.query(
                'INSERT INTO refresh_tokens (token, access_token_id, client_id, user_id, expires_at) VALUES ($1, $2, $3, $4, $5)',
                [refreshToken, accessTokenResult.rows[0].id, client_id, user_id, refreshTokenExpiresAt]
            );

            const response = {
                access_token: accessToken,
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: refreshToken,
                scope: authCode.scope
            };

            // Include role information in response if roles were assigned
            if (assignedRoles.length > 0) {
                response.roles = assignedRoles;
                response.permissions = rolePermissions;
            }

            res.json(response);

        } catch (error) {
            console.error('Token error:', error);
            res.status(500).json({ error: 'server_error' });
        }
    }

    async refreshToken(req, res) {
        try {
            const { grant_type, refresh_token } = req.body;

            if (grant_type !== 'refresh_token') {
                return res.status(400).json({ error: 'unsupported_grant_type' });
            }

            const tokenResult = await db.query(
                `SELECT rt.*, at.scope, at.client_id 
                 FROM refresh_tokens rt 
                 JOIN access_tokens at ON rt.access_token_id = at.id 
                 WHERE rt.token = $1 AND rt.revoked = false AND rt.expires_at > NOW()`,
                [refresh_token]
            );

            if (tokenResult.rows.length === 0) {
                return res.status(401).json({ error: 'invalid_grant' });
            }

            const refreshTokenData = tokenResult.rows[0];

            await db.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [refreshTokenData.id]);
            await db.query('UPDATE access_tokens SET revoked = true WHERE id = $1', [refreshTokenData.access_token_id]);

            const newAccessToken = jwt.sign(
                { 
                    client_id: refreshTokenData.client_id,
                    scope: refreshTokenData.scope,
                    type: 'access_token'
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            const newRefreshToken = crypto.randomBytes(32).toString('hex');
            const accessTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
            const refreshTokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            const accessTokenResult = await db.query(
                'INSERT INTO access_tokens (token, client_id, scope, expires_at) VALUES ($1, $2, $3, $4) RETURNING id',
                [newAccessToken, refreshTokenData.client_id, refreshTokenData.scope, accessTokenExpiresAt]
            );

            await db.query(
                'INSERT INTO refresh_tokens (token, access_token_id, client_id, expires_at) VALUES ($1, $2, $3, $4)',
                [newRefreshToken, accessTokenResult.rows[0].id, refreshTokenData.client_id, refreshTokenExpiresAt]
            );

            res.json({
                access_token: newAccessToken,
                token_type: 'Bearer',
                expires_in: 3600,
                refresh_token: newRefreshToken,
                scope: refreshTokenData.scope
            });

        } catch (error) {
            console.error('Refresh token error:', error);
            res.status(500).json({ error: 'server_error' });
        }
    }

    async introspect(req, res) {
        try {
            const { token } = req.body;

            if (!token) {
                return res.status(400).json({ error: 'invalid_request', error_description: 'Missing token parameter' });
            }

            try {
                // Verify JWT token
                const decoded = jwt.verify(token, process.env.JWT_SECRET);

                // Check if this is an admin/tenant bearer token from /admin/token endpoint
                if (decoded.user_type === 'admin' || decoded.user_type === 'tenant') {
                    // Handle bearer tokens directly from JWT payload
                    const response = {
                        active: true,
                        scope: decoded.user_type === 'admin' ? 'admin' : 'tenant',
                        username: decoded.username,
                        token_type: 'Bearer',
                        exp: decoded.exp,
                        iat: decoded.iat,
                        nbf: decoded.iat,
                        sub: decoded.id,
                        aud: 'oauth2-server',
                        iss: process.env.JWT_ISSUER || 'oauth2-server',
                        user_type: decoded.user_type,
                        user_id: decoded.id,
                        is_admin: decoded.is_admin
                    };

                    // Add tenant-specific properties for tenant users
                    if (decoded.tenant_id) {
                        response.tenant_id = decoded.tenant_id;
                        response.tenant_name = decoded.tenant_name;
                        response.is_admin = decoded.is_admin;
                    }

                    return res.json(response);
                }

                // Handle OAuth access tokens - check database
                const tokenResult = await db.query(
                    'SELECT * FROM access_tokens WHERE token = $1 AND revoked = false AND expires_at > NOW()',
                    [token]
                );

                if (tokenResult.rows.length === 0) {
                    // OAuth token not found or expired
                    return res.json({
                        active: false
                    });
                }

                const tokenData = tokenResult.rows[0];

                // Get client information for OAuth tokens
                const clientResult = await db.query(
                    'SELECT name FROM oauth_clients WHERE client_id = $1',
                    [tokenData.client_id]
                );

                const client = clientResult.rows[0];

                // Standard OAuth 2.0 introspection response
                const response = {
                    active: true,
                    scope: tokenData.scope,
                    client_id: tokenData.client_id,
                    username: decoded.username || null,
                    token_type: 'Bearer',
                    exp: decoded.exp,
                    iat: decoded.iat,
                    nbf: decoded.iat,
                    sub: tokenData.user_id || tokenData.client_id,
                    aud: tokenData.client_id,
                    iss: process.env.JWT_ISSUER || 'oauth2-server',
                    jti: tokenData.id
                };

                // Add OAuth client properties
                if (client && client.name) {
                    response.client_name = client.name;
                }

                if (decoded.user_id) {
                    response.user_id = decoded.user_id;
                }

                if (decoded.tenant_id) {
                    response.tenant_id = decoded.tenant_id;
                }

                if (decoded.roles && decoded.roles.length > 0) {
                    response.roles = decoded.roles;
                }

                if (decoded.permissions && decoded.permissions.length > 0) {
                    response.permissions = decoded.permissions;
                }

                res.json(response);

            } catch (jwtError) {
                // Invalid JWT token
                return res.json({
                    active: false
                });
            }

        } catch (error) {
            console.error('Token introspection error:', error);
            res.status(500).json({ error: 'server_error' });
        }
    }
}

module.exports = new OAuthController();