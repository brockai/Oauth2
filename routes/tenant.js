const express = require('express');
const router = express.Router();
const tenantUsersController = require('../controllers/tenantUsers');
const clientsController = require('../controllers/clients');
const applicationRolesController = require('../controllers/applicationRoles');
const logsController = require('../controllers/logs');
const { authenticateToken, requireTenantScope, requireTenantAdmin } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../database/connection');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

// Tenant login endpoint
/**
 * @swagger
 * /tenant/login:
 *   post:
 *     summary: Login to tenant with email and password
 *     tags: [Tenant Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - client_id
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *               password:
 *                 type: string
 *                 description: User's password
 *               client_id:
 *                 type: string
 *                 description: Client ID to determine tenant context. User will be found across all tenants associated with this client.
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                   description: JWT access token
 *                 token_type:
 *                   type: string
 *                   example: Bearer
 *                 expires_in:
 *                   type: integer
 *                   description: Token expiration time in seconds
 *                 client_id:
 *                   type: string
 *                   description: Client ID that was used for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     first_name:
 *                       type: string
 *                     last_name:
 *                       type: string
 *                     tenant_id:
 *                       type: string
 *                     is_admin:
 *                       type: boolean
 *       401:
 *         description: Invalid credentials
 *       400:
 *         description: Missing required fields
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password, client_id } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (!client_id) {
            return res.status(400).json({ error: 'client_id is required' });
        }

        // First, verify the client exists and is active
        const clientResult = await db.query(
            'SELECT id, client_id, name, is_active FROM oauth_clients WHERE client_id = $1 AND is_active = true',
            [client_id]
        );

        if (clientResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid client_id' });
        }

        const client = clientResult.rows[0];

        // Get tenants associated with this client
        const tenantResult = await db.query(
            'SELECT t.id, t.name FROM tenants t INNER JOIN tenant_applications ta ON t.id = ta.tenant_id WHERE ta.application_id = $1 AND t.is_active = true',
            [client.id]
        );

        if (tenantResult.rows.length === 0) {
            return res.status(401).json({ error: 'No active tenants associated with this client' });
        }

        // Search for user across all tenants associated with this client
        const tenantIds = tenantResult.rows.map(t => t.id);
        const userResult = await db.query(
            'SELECT id, username, email, password_hash, first_name, last_name, is_active, is_admin, email_verified, tenant_id FROM tenant_users WHERE tenant_id = ANY($1) AND email = $2 AND is_active = true',
            [tenantIds, email]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // If multiple users with same email exist across different tenants (should be rare),
        // use the first match found
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

        // Generate JWT token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            email: user.email,
            tenant_id: user.tenant_id,
            user_type: 'tenant',
            is_admin: user.is_admin,
            client_id: client_id
        };

        const expiresIn = 24 * 60 * 60; // 24 hours in seconds
        const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn });

        // Return user info and token
        const { password_hash, ...userInfo } = user;
        res.json({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            client_id: client_id,
            user: userInfo
        });
    } catch (error) {
        console.error('Tenant login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Tenant information (read-only for tenant users)
/**
 * @swagger
 * /tenant/info:
 *   get:
 *     summary: Get current tenant information
 *     tags: [Tenant]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current tenant information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantInfo'
 */
router.get('/info', authenticateToken, requireTenantScope, async (req, res) => {
    try {
        const db = require('../database/connection');
        const result = await db.query(
            'SELECT id, name, description, domain, is_active, created_at FROM tenants WHERE id = $1',
            [req.tenant_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get tenant info error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User profile management (tenant users can manage their own profile)
/**
 * @swagger
 * /tenant/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Tenant Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantUser'
 *   put:
 *     summary: Update current user profile
 *     tags: [Tenant Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               current_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantUser'
 */
router.get('/profile', authenticateToken, requireTenantScope, tenantUsersController.getCurrentUserProfile);
router.put('/profile', authenticateToken, requireTenantScope, tenantUsersController.updateCurrentUserProfile);

// Tenant user management (only for tenant admins, scoped to their tenant)
/**
 * @swagger
 * /tenant/users:
 *   get:
 *     summary: Get users in current tenant (tenant admin only)
 *     tags: [Tenant User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tenant users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TenantUser'
 *   post:
 *     summary: Create new user in current tenant (tenant admin only)
 *     tags: [Tenant User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               is_admin:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenantUser'
 */
router.get('/users', authenticateToken, requireTenantAdmin, tenantUsersController.getTenantScopedUsers);
router.post('/users', authenticateToken, requireTenantAdmin, tenantUsersController.createTenantScopedUser);

/**
 * @swagger
 * /tenant/users/{user_id}:
 *   get:
 *     summary: Get specific user in current tenant (tenant admin only)
 *     tags: [Tenant User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *                 is_active:
 *                   type: boolean
 *                 is_admin:
 *                   type: boolean
 *                 email_verified:
 *                   type: boolean
 *                 last_login_at:
 *                   type: string
 *                   format: date-time
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *   put:
 *     summary: Update user in current tenant (tenant admin only)
 *     tags: [Tenant User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               is_admin:
 *                 type: boolean
 *               email_verified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *                 first_name:
 *                   type: string
 *                 last_name:
 *                   type: string
 *                 is_active:
 *                   type: boolean
 *                 is_admin:
 *                   type: boolean
 *                 email_verified:
 *                   type: boolean
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *   delete:
 *     summary: Delete user in current tenant (tenant admin only)
 *     tags: [Tenant User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: User deleted successfully
 */
router.get('/users/:user_id', authenticateToken, requireTenantAdmin, tenantUsersController.getTenantScopedUser);
router.put('/users/:user_id', authenticateToken, requireTenantAdmin, tenantUsersController.updateTenantScopedUser);
router.delete('/users/:user_id', authenticateToken, requireTenantAdmin, tenantUsersController.deleteTenantScopedUser);

// OAuth clients scoped to current tenant
/**
 * @swagger
 * /tenant/clients:
 *   get:
 *     summary: Get OAuth clients for current tenant
 *     tags: [Tenant Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tenant OAuth clients
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OAuthClient'
 */
router.get('/clients', authenticateToken, requireTenantScope, clientsController.getTenantScopedClients);

/**
 * @swagger
 * /tenant/clients/{id}:
 *   get:
 *     summary: Get specific OAuth client for current tenant
 *     tags: [Tenant Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Client details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OAuthClient'
 *       404:
 *         description: Client not found or not accessible
 */
router.get('/clients/:id', authenticateToken, requireTenantScope, clientsController.getTenantScopedClient);

// Logs scoped to current tenant
/**
 * @swagger
 * /tenant/logs:
 *   get:
 *     summary: Get API logs for current tenant
 *     tags: [Tenant Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         description: Specific tenant ID to get logs for (optional)
 *     responses:
 *       200:
 *         description: List of API logs for current tenant
 */
router.get('/logs', authenticateToken, requireTenantScope, logsController.getTenantScopedLogs);
router.get('/logs/stats', authenticateToken, requireTenantScope, logsController.getTenantScopedLogStats);

// Check if email exists across all tenants
/**
 * @swagger
 * /tenant/check-email:
 *   post:
 *     summary: Check if email exists in any tenant
 *     tags: [Tenant User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to check
 *     responses:
 *       200:
 *         description: Email check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   description: true if email exists in any tenant, false otherwise
 *                 user:
 *                   type: object
 *                   description: User information (only present when exists is true)
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     first_name:
 *                       type: string
 *                     last_name:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     is_admin:
 *                       type: boolean
 *                     tenant_id:
 *                       type: string
 *                       format: uuid
 *                     email_verified:
 *                       type: boolean
 *                     last_login_at:
 *                       type: string
 *                       format: date-time
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Email is required
 *       401:
 *         description: Unauthorized - Bearer token required
 */
router.post('/check-email', authenticateToken, tenantUsersController.checkEmailExists);

/**
 * @swagger
 * /tenant/password:
 *   put:
 *     summary: Update password for a user in current tenant (tenant admin only)
 *     tags: [Tenant User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - password
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user whose password should be updated
 *               password:
 *                 type: string
 *                 description: New password (minimum 6 characters)
 *     responses:
 *       200:
 *         description: Password updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Password updated successfully
 *       400:
 *         description: Invalid request or password too short
 *       401:
 *         description: Unauthorized - tenant admin access required
 *       404:
 *         description: User not found in current tenant
 */
router.put('/password', authenticateToken, requireTenantAdmin, tenantUsersController.resetTenantUserPassword);

module.exports = router;