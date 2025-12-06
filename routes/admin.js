const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin');
const clientsController = require('../controllers/clients');
const tenantsController = require('../controllers/tenants');
const tenantUsersController = require('../controllers/tenantUsers');
const apiKeysController = require('../controllers/apiKeys');
const logsController = require('../controllers/logs');
const applicationRolesController = require('../controllers/applicationRoles');
const { authenticateToken, requireAdmin, verifyApiKey } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

const loginLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs (increased for testing)
    message: { error: 'Too many login attempts' }
});

// Admin authentication
/**
 * @swagger
 * /admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin Auth]
 *     description: Authenticate admin user and receive JWT token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: admin123
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 client_id:
 *                   type: string
 *                   description: Client ID that was used for authentication
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', loginLimit, adminController.login);

// Demo login endpoint that always uses demo database
router.post('/demo/login', loginLimit, async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        const db = require('../database/connection');

        // Force demo database connection
        const demoUserResult = await db.demoPool.query(
            'SELECT *, \'admin\' as user_type FROM users WHERE username = $1',
            [username]
        );

        if (demoUserResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = demoUserResult.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username, 
                user_type: 'admin',
                is_admin: user.is_admin
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                user_type: 'admin',
                is_admin: user.is_admin
            }
        });
    } catch (error) {
        console.error('Demo login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API Key Authentication - Generate Admin Token
/**
 * @swagger
 * /admin/token:
 *   post:
 *     summary: Generate admin token (API Key Protected)
 *     tags: [Admin Token]
 *     description: Generate a JWT admin token using API key authentication
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: Admin token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT admin token
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 expires_in:
 *                   type: integer
 *                   description: Token expiration in seconds
 *                   example: 86400
 *                 token_type:
 *                   type: string
 *                   description: Token type
 *                   example: Bearer
 *       401:
 *         description: Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/token', verifyApiKey, adminController.generateAdminToken);

/**
 * @swagger
 * /admin/token/custom:
 *   post:
 *     summary: Generate custom JWT token with specific tenant/client
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenant_id:
 *                 type: string
 *                 format: uuid
 *                 description: Optional tenant ID to include in token
 *               client_id:
 *                 type: string
 *                 description: Optional client ID to include in token
 *     responses:
 *       200:
 *         description: Custom admin token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: JWT admin token
 *                 expires_in:
 *                   type: integer
 *                   description: Token expiration in seconds
 *                 token_type:
 *                   type: string
 *                   description: Token type
 *                 tenant_id:
 *                   type: string
 *                   description: Tenant ID included in token
 *                 client_id:
 *                   type: string
 *                   description: Client ID included in token
 *                 username:
 *                   type: string
 *                   description: Admin username
 *                 user_type:
 *                   type: string
 *                   description: User type
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Tenant or client not found
 */
router.post('/token/custom', authenticate, adminController.generateCustomToken);

/**
 * @swagger
 * /admin/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/me', authenticateToken, adminController.me);

/**
 * @swagger
 * /admin/system-admins:
 *   get:
 *     summary: Get all system admin users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of system admin users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   username:
 *                     type: string
 *                   is_admin:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *       401:
 *         description: Unauthorized
 *
 * /admin/system-admins/{id}:
 *   get:
 *     summary: Get specific system admin user by ID
 *     tags: [Admin]
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
 *         description: System admin user details
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
 *                 is_admin:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: System admin not found
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Delete system admin user
 *     tags: [Admin]
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
 *       204:
 *         description: System admin deleted successfully
 *       400:
 *         description: Cannot delete your own account
 *       404:
 *         description: System admin not found
 *       401:
 *         description: Unauthorized
 *
 * /admin/system-admins/{id}/reset-password:
 *   post:
 *     summary: Reset system admin user password
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 description: New password (minimum 6 characters)
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request (missing password or too short)
 *       404:
 *         description: System admin not found
 *       401:
 *         description: Unauthorized
 */
router.get('/system-admins', authenticateToken, requireAdmin, adminController.getSuperAdminUsers);
router.get('/system-admins/:id', authenticateToken, requireAdmin, adminController.getSuperAdminUser);
router.post('/system-admins/:id/reset-password', authenticateToken, requireAdmin, adminController.resetSuperAdminPassword);
router.delete('/system-admins/:id', authenticateToken, requireAdmin, adminController.deleteSuperAdmin);

/**
 * @swagger
 * /admin/profile:
 *   put:
 *     summary: Update admin user profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: New username (optional)
 *               currentPassword:
 *                 type: string
 *                 description: Current password (required if changing password)
 *               newPassword:
 *                 type: string
 *                 description: New password (optional, minimum 6 characters)
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.put('/profile', authenticateToken, requireAdmin, adminController.updateProfile);

// Client management (requires admin)
/**
 * @swagger
 * /admin/clients:
 *   get:
 *     summary: Get all OAuth clients
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of OAuth clients
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OAuthClient'
 *   post:
 *     summary: Create new OAuth client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - redirect_uris
 *             properties:
 *               name:
 *                 type: string
 *                 description: Client application name
 *               description:
 *                 type: string
 *                 description: Client description
 *               redirect_uris:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 description: Allowed redirect URIs
 *               grant_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [authorization_code]
 *                 default: [authorization_code]
 *               scope:
 *                 type: string
 *                 default: read
 *     responses:
 *       201:
 *         description: Client created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/OAuthClient'
 *                 - type: object
 *                   properties:
 *                     client_secret:
 *                       type: string
 *                       description: Client secret (only shown once)
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/clients', authenticateToken, requireAdmin, clientsController.getClients);
router.post('/clients', authenticateToken, requireAdmin, clientsController.createClient);

/**
 * @swagger
 * /admin/clients/{id}:
 *   get:
 *     summary: Get OAuth client by ID
 *     tags: [Clients]
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
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   put:
 *     summary: Update OAuth client
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               redirect_uris:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *               scope:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Client updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OAuthClient'
 *   delete:
 *     summary: Delete OAuth client
 *     tags: [Clients]
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
 *       204:
 *         description: Client deleted successfully
 *       404:
 *         description: Client not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/clients/:id', authenticateToken, requireAdmin, clientsController.getClient);
router.put('/clients/:id', authenticateToken, requireAdmin, clientsController.updateClient);
router.delete('/clients/:id', authenticateToken, requireAdmin, clientsController.deleteClient);

/**
 * @swagger
 * /admin/clients/{id}/regenerate-secret:
 *   post:
 *     summary: Regenerate client secret
 *     tags: [Clients]
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
 *         description: New client secret generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 client_secret:
 *                   type: string
 *                   description: New client secret
 * 
 * /admin/clients/{id}/stats:
 *   get:
 *     summary: Get client statistics
 *     tags: [Clients]
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
 *         description: Client usage statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_tokens:
 *                   type: integer
 *                   description: Total tokens issued
 *                 active_tokens:
 *                   type: integer
 *                   description: Currently active tokens
 *                 total_authorization_codes:
 *                   type: integer
 *                   description: Total authorization codes issued
 */
router.post('/clients/:id/regenerate-secret', authenticateToken, requireAdmin, clientsController.regenerateSecret);
router.get('/clients/:id/stats', authenticateToken, requireAdmin, clientsController.getClientStats);

// Many-to-many tenant-application relationship management
/**
 * @swagger
 * /admin/clients/{id}/tenants:
 *   post:
 *     summary: Associate application with tenant(s)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenant_ids
 *             properties:
 *               tenant_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of tenant IDs to associate with the application
 *     responses:
 *       200:
 *         description: Application associated with tenants successfully
 *       400:
 *         description: Invalid request or tenant IDs
 *       404:
 *         description: Application not found
 *   delete:
 *     summary: Remove application from tenant(s)
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Application ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenant_ids
 *             properties:
 *               tenant_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Array of tenant IDs to remove the application from
 *     responses:
 *       200:
 *         description: Application removed from tenants successfully
 *       400:
 *         description: Invalid request
 */
router.post('/clients/:id/tenants', authenticateToken, requireAdmin, clientsController.addApplicationToTenants);
router.delete('/clients/:id/tenants', authenticateToken, requireAdmin, clientsController.removeApplicationFromTenants);

// Application Users management (requires admin)
/**
 * @swagger
 * /admin/clients/{applicationId}/users:
 *   get:
 *     summary: Get user roles for a specific application
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID to get roles for
 *       - in: query
 *         name: tenant_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Optional tenant context filter
 *     responses:
 *       200:
 *         description: List of user roles for the application
 */
router.get('/clients/:applicationId/users', authenticateToken, requireAdmin, applicationRolesController.getUserRoles);

// Tenant management (requires admin)
/**
 * @swagger
 * /admin/tenants:
 *   get:
 *     summary: Get all tenants
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tenants
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   domain:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *   post:
 *     summary: Create new tenant
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               domain:
 *                 type: string
 *               client_id:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Optional array of client IDs to associate with the new tenant
 *     responses:
 *       201:
 *         description: Tenant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 description:
 *                   type: string
 *                 domain:
 *                   type: string
 *                 is_active:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 associated_applications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                   description: List of applications associated with the tenant (only present if client_ids was provided)
 *       400:
 *         description: Invalid request or client IDs
 * 
 * /admin/tenants/{id}:
 *   get:
 *     summary: Get tenant by ID
 *     tags: [Tenants]
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
 *         description: Tenant details
 *       404:
 *         description: Tenant not found
 *   put:
 *     summary: Update tenant
 *     tags: [Tenants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               domain:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Tenant updated successfully
 *   delete:
 *     summary: Delete tenant
 *     tags: [Tenants]
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
 *       204:
 *         description: Tenant deleted successfully
 *       400:
 *         description: Cannot delete tenant with existing clients
 * 
 * /admin/tenants/{id}/stats:
 *   get:
 *     summary: Get tenant statistics
 *     tags: [Tenants]
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
 *         description: Tenant usage statistics
 */
router.get('/tenants', authenticateToken, requireAdmin, tenantsController.getTenants);
router.post('/tenants', authenticateToken, requireAdmin, tenantsController.createTenant);
router.get('/tenants/:id', authenticateToken, requireAdmin, tenantsController.getTenant);
router.put('/tenants/:id', authenticateToken, requireAdmin, tenantsController.updateTenant);
router.delete('/tenants/:id', authenticateToken, requireAdmin, tenantsController.deleteTenant);
router.get('/tenants/:id/stats', authenticateToken, requireAdmin, tenantsController.getTenantStats);

// Tenant Users management (requires admin)
/**
 * @swagger
 * /admin/tenants/{tenant_id}/users:
 *   get:
 *     summary: Get all users for a tenant
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenant_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of tenant users with their assigned roles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   first_name:
 *                     type: string
 *                   last_name:
 *                     type: string
 *                   is_active:
 *                     type: boolean
 *                   is_admin:
 *                     type: boolean
 *                   email_verified:
 *                     type: boolean
 *                   last_login_at:
 *                     type: string
 *                     format: date-time
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         role_name:
 *                           type: string
 *                         role_description:
 *                           type: string
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                         assigned_at:
 *                           type: string
 *                           format: date-time
 *                         expires_at:
 *                           type: string
 *                           format: date-time
 *                         assignment_active:
 *                           type: boolean
 *                         application_name:
 *                           type: string
 *                         application_id:
 *                           type: string
 *                           format: uuid
 *   post:
 *     summary: Create new tenant user
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenant_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *               roles:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     application_id:
 *                       type: string
 *                       format: uuid
 *                       description: Application ID for the role
 *                     role_id:
 *                       type: string
 *                       format: uuid
 *                       description: Role ID to assign
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *                       description: Optional expiration date for the role assignment
 *                 description: Array of role assignments for the user
 *     responses:
 *       201:
 *         description: User created successfully with assigned roles
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
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       user_id:
 *                         type: string
 *                         format: uuid
 *                       application_id:
 *                         type: string
 *                         format: uuid
 *                       role_id:
 *                         type: string
 *                         format: uuid
 *                       tenant_id:
 *                         type: string
 *                         format: uuid
 *                       assigned_at:
 *                         type: string
 *                         format: date-time
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                       is_active:
 *                         type: boolean
 * 
 * /admin/tenants/{tenant_id}/users/{user_id}:
 *   get:
 *     summary: Get specific tenant user
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenant_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User details with assigned roles
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
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       role_name:
 *                         type: string
 *                       role_description:
 *                         type: string
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                       assigned_at:
 *                         type: string
 *                         format: date-time
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                       assignment_active:
 *                         type: boolean
 *                       application_name:
 *                         type: string
 *                       application_id:
 *                         type: string
 *                         format: uuid
 *   put:
 *     summary: Update tenant user
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenant_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
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
 *               roles:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     application_id:
 *                       type: string
 *                       format: uuid
 *                       description: Application ID for the role
 *                     role_id:
 *                       type: string
 *                       format: uuid
 *                       description: Role ID to assign
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *                       description: Optional expiration date for the role assignment
 *                 description: Array of role assignments for the user (replaces all existing roles)
 *     responses:
 *       200:
 *         description: User updated successfully with current roles
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
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       role_name:
 *                         type: string
 *                       role_description:
 *                         type: string
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                       assigned_at:
 *                         type: string
 *                         format: date-time
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                       assignment_active:
 *                         type: boolean
 *                       application_name:
 *                         type: string
 *                       application_id:
 *                         type: string
 *                         format: uuid
 *   delete:
 *     summary: Delete tenant user
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenant_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: User deleted successfully
 * 
 * /admin/tenants/{tenant_id}/users/{user_id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Tenant Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenant_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.get('/tenants/:tenant_id/users', authenticateToken, requireAdmin, tenantUsersController.getTenantUsers);
router.post('/tenants/:tenant_id/users', authenticateToken, requireAdmin, tenantUsersController.createTenantUser);
router.get('/tenants/:tenant_id/users/:user_id', authenticateToken, requireAdmin, tenantUsersController.getTenantUser);
router.put('/tenants/:tenant_id/users/:user_id', authenticateToken, requireAdmin, tenantUsersController.updateTenantUser);
router.delete('/tenants/:tenant_id/users/:user_id', authenticateToken, requireAdmin, tenantUsersController.deleteTenantUser);
router.post('/tenants/:tenant_id/users/:user_id/reset-password', authenticateToken, requireAdmin, tenantUsersController.resetUserPassword);

// API Keys management (requires admin)
/**
 * @swagger
 * /admin/api-keys:
 *   get:
 *     summary: Get all API keys
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   name:
 *                     type: string
 *                   key_preview:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [api_key, admin_token]
 *                   is_active:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   last_used_at:
 *                     type: string
 *                     format: date-time
 *   post:
 *     summary: Create new API key
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: API key name
 *               type:
 *                 type: string
 *                 enum: [api_key, admin_token]
 *                 default: api_key
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 name:
 *                   type: string
 *                 key:
 *                   type: string
 *                   description: API key (only shown once)
 *                 key_preview:
 *                   type: string
 *                 type:
 *                   type: string
 *                 is_active:
 *                   type: boolean
 *                 created_at:
 *                   type: string
 *                   format: date-time
 */
router.get('/api-keys', authenticateToken, requireAdmin, apiKeysController.getApiKeys);

/**
 * @swagger
 * /admin/api-keys/{id}/value:
 *   get:
 *     summary: Get full API key value
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: API key identifier (API_KEY or ADMIN_TOKEN)
 *     responses:
 *       200:
 *         description: Full API key value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                   description: Full API key value
 *       404:
 *         description: API key not found
 */
router.post('/api-keys/generate', authenticateToken, requireAdmin, apiKeysController.generateNewKey);
router.delete('/api-keys/:id', authenticateToken, requireAdmin, apiKeysController.deleteApiKey);
router.patch('/api-keys/:id/toggle', authenticateToken, requireAdmin, apiKeysController.toggleApiKey);

// API Logs management (requires admin)
/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: Get API logs with filtering and pagination
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of logs per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *         description: Filter by HTTP status code
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *         description: Filter by HTTP method
 *       - in: query
 *         name: endpoint
 *         schema:
 *           type: string
 *         description: Filter by endpoint (partial match)
 *       - in: query
 *         name: success
 *         schema:
 *           type: boolean
 *         description: Filter by success status
 *       - in: query
 *         name: api_key_id
 *         schema:
 *           type: string
 *         description: Filter by API key ID
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs after this date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter logs before this date
 *     responses:
 *       200:
 *         description: List of API logs with pagination info
 */
router.get('/logs', authenticateToken, requireAdmin, logsController.getLogs);

/**
 * @swagger
 * /admin/logs/stats:
 *   get:
 *     summary: Get API logs statistics
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: API logs statistics
 */
router.get('/logs/stats', authenticateToken, requireAdmin, logsController.getLogStats);

/**
 * @swagger
 * /admin/logs/{id}:
 *   get:
 *     summary: Get specific log entry by ID
 *     tags: [Logs]
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
 *         description: Log entry details
 *       404:
 *         description: Log entry not found
 */
router.get('/logs/:id', authenticateToken, requireAdmin, logsController.getLogById);

module.exports = router;