const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/connection');
class AdminController {
    async login(req, res) {
        try {
            const { username, password, client_id } = req.body;

            if (!username || !password) {
                return res.status(400).json({ error: 'Username and password required' });
            }

            // First, try to find user in admin users table
            const adminUserResult = await db.query(
                'SELECT *, \'admin\' as user_type FROM users WHERE username = $1',
                [username]
            );

            let user = null;
            let userType = null;

            if (adminUserResult.rows.length > 0) {
                user = adminUserResult.rows[0];
                userType = 'admin';
            } else {
                // If not found in admin users, check tenant_users table
                const tenantUserResult = await db.query(
                    `SELECT tu.*, t.name as tenant_name, t.id as tenant_id, 'tenant' as user_type
                     FROM tenant_users tu
                     JOIN tenants t ON tu.tenant_id = t.id
                     WHERE tu.username = $1 AND tu.is_active = true AND t.is_active = true`,
                    [username]
                );

                if (tenantUserResult.rows.length > 0) {
                    user = tenantUserResult.rows[0];
                    userType = 'tenant';
                } else {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }
            }

            const validPassword = await bcrypt.compare(password, user.password_hash);

            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Update last login for tenant users
            if (userType === 'tenant') {
                await db.query(
                    'UPDATE tenant_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [user.id]
                );
            }

            // Create JWT token with appropriate payload
            const tokenPayload = {
                id: user.id,
                username: user.username,
                user_type: userType,
                is_admin: user.is_admin
            };

            // Add tenant information for tenant users
            if (userType === 'tenant') {
                tokenPayload.tenant_id = user.tenant_id;
                tokenPayload.tenant_name = user.tenant_name;
            }

            // Add client_id to token payload if provided
            if (client_id) {
                tokenPayload.client_id = client_id;
            }

            const token = jwt.sign(
                tokenPayload,
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Return appropriate user information
            const userResponse = {
                id: user.id,
                username: user.username,
                user_type: userType,
                is_admin: user.is_admin
            };

            if (userType === 'tenant') {
                userResponse.tenant_id = user.tenant_id;
                userResponse.tenant_name = user.tenant_name;
                userResponse.email = user.email;
                userResponse.first_name = user.first_name;
                userResponse.last_name = user.last_name;
            }

            res.json({
                token,
                user: userResponse
            });

        } catch (error) {
            console.error('Admin login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async me(req, res) {
        try {
            let userResult;

            // Check if this is an admin user or tenant user based on JWT payload
            if (req.user.user_type === 'admin') {
                userResult = await db.query(
                    'SELECT id, username, is_admin, created_at, \'admin\' as user_type FROM users WHERE id = $1',
                    [req.user.id]
                );
            } else if (req.user.user_type === 'tenant') {
                userResult = await db.query(
                    `SELECT tu.id, tu.username, tu.email, tu.first_name, tu.last_name,
                            tu.is_admin, tu.created_at, tu.last_login_at,
                            t.name as tenant_name, t.id as tenant_id, 'tenant' as user_type
                     FROM tenant_users tu
                     JOIN tenants t ON tu.tenant_id = t.id
                     WHERE tu.id = $1`,
                    [req.user.id]
                );
            } else {
                return res.status(404).json({ error: 'User type not recognized' });
            }

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const user = userResult.rows[0];

            // Format response based on user type
            const userResponse = {
                id: user.id,
                username: user.username,
                user_type: user.user_type,
                is_admin: user.is_admin || false,
                created_at: user.created_at
            };

            if (user.user_type === 'tenant') {
                userResponse.tenant_id = user.tenant_id;
                userResponse.tenant_name = user.tenant_name;
                userResponse.email = user.email;
                userResponse.first_name = user.first_name;
                userResponse.last_name = user.last_name;
                userResponse.last_login_at = user.last_login_at;
            }

            res.json(userResponse);
        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async generateAdminToken(req, res) {
        try {
            const adminUserResult = await db.query(
                'SELECT * FROM users WHERE is_admin = true LIMIT 1'
            );

            if (adminUserResult.rows.length === 0) {
                return res.status(404).json({ error: 'No admin user found' });
            }

            const adminUser = adminUserResult.rows[0];
            
            const token = jwt.sign(
                {
                    id: adminUser.id,
                    username: adminUser.username,
                    user_type: 'admin',
                    is_admin: adminUser.is_admin
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                token,
                expires_in: 86400,
                token_type: 'Bearer'
            });

        } catch (error) {
            console.error('Generate admin token error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async updateProfile(req, res) {
        try {
            const { username, currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            // Validate input
            if (!username && !newPassword) {
                return res.status(400).json({ error: 'Username or new password is required' });
            }

            // Get current user data
            const userResult = await db.query(
                'SELECT * FROM users WHERE id = $1',
                [userId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            const currentUser = userResult.rows[0];

            // If changing password, verify current password
            if (newPassword) {
                if (!currentPassword) {
                    return res.status(400).json({ error: 'Current password required to change password' });
                }

                const validPassword = await bcrypt.compare(currentPassword, currentUser.password_hash);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Current password is incorrect' });
                }

                // Validate new password
                if (newPassword.length < 6) {
                    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
                }
            }

            // Check if username is already taken (if changing username)
            if (username && username !== currentUser.username) {
                const usernameCheck = await db.query(
                    'SELECT id FROM users WHERE username = $1 AND id != $2',
                    [username, userId]
                );

                if (usernameCheck.rows.length > 0) {
                    return res.status(400).json({ error: 'Username already taken' });
                }
            }

            // Build update query
            let query = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
            let values = [];
            let paramCount = 0;

            if (username && username !== currentUser.username) {
                paramCount++;
                query += `, username = $${paramCount}`;
                values.push(username);
            }

            if (newPassword) {
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                paramCount++;
                query += `, password_hash = $${paramCount}`;
                values.push(hashedPassword);
            }

            paramCount++;
            query += ` WHERE id = $${paramCount} RETURNING id, username, is_admin, created_at, updated_at`;
            values.push(userId);

            // Execute update
            const updateResult = await db.query(query, values);
            const updatedUser = updateResult.rows[0];

            res.json({
                message: 'Profile updated successfully',
                user: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    is_admin: updatedUser.is_admin,
                    created_at: updatedUser.created_at,
                    updated_at: updatedUser.updated_at
                }
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getSuperAdminUsers(req, res) {
        try {
            const result = await db.query(
                'SELECT id, username, is_admin, created_at, updated_at FROM users ORDER BY created_at DESC'
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Get super admin users error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async getSuperAdminUser(req, res) {
        try {
            const { id } = req.params;

            const result = await db.query(
                'SELECT id, username, is_admin, created_at, updated_at FROM users WHERE id = $1',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'System admin not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Get super admin user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async resetSuperAdminPassword(req, res) {
        try {
            const { id } = req.params;
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters long' });
            }

            // Check if admin exists
            const adminResult = await db.query(
                'SELECT id FROM users WHERE id = $1',
                [id]
            );

            if (adminResult.rows.length === 0) {
                return res.status(404).json({ error: 'System admin not found' });
            }

            // Hash password and update
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query(
                'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [hashedPassword, id]
            );

            res.json({ message: 'Password reset successfully' });
        } catch (error) {
            console.error('Reset super admin password error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async deleteSuperAdmin(req, res) {
        try {
            const { id } = req.params;

            // Prevent deleting yourself
            if (id === req.user.id) {
                return res.status(400).json({ error: 'Cannot delete your own account' });
            }

            // Check if admin exists and get username
            const adminResult = await db.query(
                'SELECT id, username FROM users WHERE id = $1',
                [id]
            );

            if (adminResult.rows.length === 0) {
                return res.status(404).json({ error: 'System admin not found' });
            }

            // Prevent deleting the 'admin' user
            if (adminResult.rows[0].username === 'admin') {
                return res.status(400).json({ error: 'Cannot delete the default admin user' });
            }

            // Delete the admin
            await db.query('DELETE FROM users WHERE id = $1', [id]);

            res.status(204).send();
        } catch (error) {
            console.error('Delete super admin error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new AdminController();