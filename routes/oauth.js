const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauth');
const tenantUsersController = require('../controllers/tenantUsers');
const rateLimit = require('express-rate-limit');
const csrfMiddleware = require('../middleware/csrf');

/**
 * @swagger
 * components:
 *   parameters:
 *     ClientId:
 *       in: query
 *       name: client_id
 *       required: true
 *       schema:
 *         type: string
 *       description: OAuth client identifier
 *     RedirectUri:
 *       in: query
 *       name: redirect_uri
 *       required: true
 *       schema:
 *         type: string
 *         format: uri
 *       description: Redirect URI for authorization response
 */

const authorizationLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many authorization requests' }
});

const tokenLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    message: { error: 'Too many token requests' }
});

/**
 * @swagger
 * /oauth/csrf-token:
 *   get:
 *     summary: Get CSRF token for protected endpoints
 *     tags: [OAuth 2.0]
 *     security: []
 *     description: Returns a CSRF token that must be included in subsequent POST requests
 *     responses:
 *       200:
 *         description: CSRF token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 csrf_token:
 *                   type: string
 *                   description: CSRF token to include in X-CSRF-Token header or _csrf field
 *                 expires_in:
 *                   type: number
 *                   description: Token expiration time in seconds
 *                   example: 86400
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/csrf-token', csrfMiddleware.generateToken, (req, res) => {
    res.json({
        csrf_token: req.csrfToken,
        expires_in: 24 * 60 * 60 // 24 hours
    });
});

/**
 * @swagger
 * /oauth/authorize:
 *   get:
 *     summary: OAuth 2.0 authorization endpoint
 *     tags: [OAuth 2.0]
 *     security: []
 *     description: Initiates the OAuth 2.0 authorization code flow
 *     parameters:
 *       - in: query
 *         name: response_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [code]
 *         description: Must be 'code' for authorization code flow
 *       - $ref: '#/components/parameters/ClientId'
 *       - $ref: '#/components/parameters/RedirectUri'
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           default: read
 *         description: Requested scope
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Optional state parameter for CSRF protection
 *     responses:
 *       302:
 *         description: Redirect to client with authorization code
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/authorize', authorizationLimit, csrfMiddleware.optionalToken, oauthController.authorize);

/**
 * @swagger
 * /oauth/token:
 *   post:
 *     summary: Exchange authorization code for access token
 *     tags: [OAuth 2.0]
 *     security: []
 *     description: Exchanges an authorization code for an access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - grant_type
 *               - code
 *               - redirect_uri
 *               - client_id
 *             properties:
 *               grant_type:
 *                 type: string
 *                 enum: [authorization_code]
 *               code:
 *                 type: string
 *                 description: Authorization code received from /oauth/authorize
 *               redirect_uri:
 *                 type: string
 *                 format: uri
 *                 description: Same redirect URI used in authorization request
 *               client_id:
 *                 type: string
 *                 description: OAuth client identifier
 *     parameters:
 *       - in: header
 *         name: X-CSRF-Token
 *         required: true
 *         schema:
 *           type: string
 *         description: CSRF token obtained from /oauth/csrf-token
 *     responses:
 *       200:
 *         description: Successful token exchange
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid client credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/token', tokenLimit, csrfMiddleware.validateToken, oauthController.token);

/**
 * @swagger
 * /oauth/token/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [OAuth 2.0]
 *     security: []
 *     description: Uses a refresh token to obtain a new access token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - grant_type
 *               - refresh_token
 *             properties:
 *               grant_type:
 *                 type: string
 *                 enum: [refresh_token]
 *               refresh_token:
 *                 type: string
 *                 description: Valid refresh token
 *     parameters:
 *       - in: header
 *         name: X-CSRF-Token
 *         required: true
 *         schema:
 *           type: string
 *         description: CSRF token obtained from /oauth/csrf-token
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       401:
 *         description: Invalid refresh token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/token/refresh', tokenLimit, csrfMiddleware.validateToken, oauthController.refreshToken);

// OAuth 2.0 User Authentication endpoints for tenant users (public endpoints)
/**
 * @swagger
 * /oauth/authenticate:
 *   post:
 *     summary: Authenticate tenant user
 *     tags: [OAuth 2.0 User Auth]
 *     security: []
 *     description: Authenticate a user within a tenant for OAuth 2.0 flows
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenant_id
 *               - username
 *               - password
 *             properties:
 *               tenant_id:
 *                 type: string
 *                 format: uuid
 *                 description: Tenant ID the user belongs to
 *               username:
 *                 type: string
 *                 description: Username or email
 *               password:
 *                 type: string
 *                 description: User password
 *     responses:
 *       200:
 *         description: Authentication successful
 *       401:
 *         description: Invalid credentials
 * 
 * /oauth/validate:
 *   post:
 *     summary: Validate user session
 *     tags: [OAuth 2.0 User Auth]
 *     security: []
 *     description: Validate a user session token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_token
 *             properties:
 *               session_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Session is valid
 *       401:
 *         description: Invalid or expired session
 * 
 * /oauth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [OAuth 2.0 User Auth]
 *     security: []
 *     description: Logout user and invalidate session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - session_token
 *             properties:
 *               session_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/authenticate', csrfMiddleware.validateToken, tenantUsersController.authenticateUser);
router.post('/validate', csrfMiddleware.validateToken, tenantUsersController.validateSession);
router.post('/logout', csrfMiddleware.validateToken, tenantUsersController.logoutUser);

/**
 * @swagger
 * /oauth/introspect:
 *   post:
 *     summary: OAuth 2.0 token introspection endpoint
 *     tags: [OAuth 2.0]
 *     security: []
 *     description: |
 *       Determines the active state and metadata of an OAuth 2.0 token.
 *       Compliant with RFC 7662 - OAuth 2.0 Token Introspection.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: The string value of the token to introspect
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: The string value of the token to introspect
 *     responses:
 *       200:
 *         description: Token introspection response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - active
 *               properties:
 *                 active:
 *                   type: boolean
 *                   description: Whether the token is currently active
 *                   example: true
 *                 scope:
 *                   type: string
 *                   description: Space-separated list of scopes associated with the token
 *                   example: read write
 *                 client_id:
 *                   type: string
 *                   description: Client identifier for the OAuth 2.0 client
 *                 client_name:
 *                   type: string
 *                   description: Human-readable name of the client
 *                 username:
 *                   type: string
 *                   description: Username of the resource owner
 *                 token_type:
 *                   type: string
 *                   description: Type of the token
 *                   example: Bearer
 *                 exp:
 *                   type: integer
 *                   description: Expiration time (Unix timestamp)
 *                   example: 1640995200
 *                 iat:
 *                   type: integer
 *                   description: Issued at time (Unix timestamp)
 *                   example: 1640908800
 *                 nbf:
 *                   type: integer
 *                   description: Not before time (Unix timestamp)
 *                   example: 1640908800
 *                 sub:
 *                   type: string
 *                   description: Subject of the token (usually user ID)
 *                 aud:
 *                   type: string
 *                   description: Intended audience of the token
 *                 iss:
 *                   type: string
 *                   description: Token issuer
 *                   example: oauth2-server
 *                 jti:
 *                   type: string
 *                   description: JWT ID (unique identifier)
 *                 user_id:
 *                   type: string
 *                   description: User identifier (extension)
 *                 tenant_id:
 *                   type: string
 *                   description: Tenant identifier (extension)
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: User roles (extension)
 *                 permissions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: User permissions (extension)
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: invalid_request
 *                 error_description:
 *                   type: string
 *                   example: Missing token parameter
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/introspect', oauthController.introspect);

module.exports = router;