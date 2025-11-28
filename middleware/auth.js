const jwt = require('jsonwebtoken');
const db = require('../database/connection');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.error('Authentication failed: No token provided');
        console.error('Authorization header:', authHeader);
        return res.status(401).json({ error: 'Access token required' });
    }

    if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET environment variable is not set');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err.message);
            console.error('Token provided:', token);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    // Admin access is required: either a true admin user or a tenant admin
    const isAdmin = req.user && (
        (req.user.user_type === 'admin' && req.user.is_admin) ||
        (req.user.user_type === 'tenant' && req.user.is_admin)
    );

    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
};

const requireSystemAdmin = (req, res, next) => {
    // System admin access is required: only for true admin users (not tenant admins)
    if (!req.user || req.user.user_type !== 'admin' || !req.user.is_admin) {
        return res.status(403).json({ error: 'System admin access required' });
    }
    next();
};

const authenticateClient = async (req, res, next) => {
    const { client_id, client_secret } = req.body;

    if (!client_id || !client_secret) {
        return res.status(401).json({ error: 'client_id and client_secret required' });
    }

    try {
        const result = await db.query(
            'SELECT * FROM oauth_clients WHERE client_id = $1 AND client_secret = $2 AND is_active = true',
            [client_id, client_secret]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid client credentials' });
        }

        req.client = result.rows[0];
        next();
    } catch (error) {
        console.error('Client authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const requireTenantScope = (req, res, next) => {
    // Tenant scope access: only tenant users can access their own tenant data
    if (!req.user || req.user.user_type !== 'tenant' || !req.user.tenant_id) {
        return res.status(403).json({ error: 'Tenant access required' });
    }

    // Attach tenant_id to request for controllers to use
    req.tenant_id = req.user.tenant_id;
    next();
};

const requireTenantAdmin = (req, res, next) => {
    // Tenant admin access: only tenant admins can access admin functions for their tenant
    if (!req.user || req.user.user_type !== 'tenant' || !req.user.is_admin || !req.user.tenant_id) {
        return res.status(403).json({ error: 'Tenant admin access required' });
    }

    // Attach tenant_id to request for controllers to use
    req.tenant_id = req.user.tenant_id;
    next();
};

const requireTenantOrSystemAdmin = (req, res, next) => {
    // Allow either system admin or tenant admin, but tenant admin is scoped to their tenant
    const isSystemAdmin = req.user && req.user.user_type === 'admin' && req.user.is_admin;
    const isTenantAdmin = req.user && req.user.user_type === 'tenant' && req.user.is_admin;

    if (!isSystemAdmin && !isTenantAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    // If tenant admin, scope to their tenant
    if (isTenantAdmin) {
        req.tenant_id = req.user.tenant_id;
        req.is_tenant_scoped = true;
    }

    next();
};

const verifyApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    try {
      const { validateApiKey } = require('../controllers/apiKeys');
      const validatedKey = await validateApiKey(apiKey);
      
      if (!validatedKey) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      req.apiKey = validatedKey;
      next();
    } catch (error) {
      console.error('API key validation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

module.exports = {
    authenticateToken,
    requireAdmin,
    requireSystemAdmin,
    requireTenantScope,
    requireTenantAdmin,
    requireTenantOrSystemAdmin,
    authenticateClient,
    verifyApiKey
};