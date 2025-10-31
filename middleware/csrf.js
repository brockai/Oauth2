const csrf = require('csrf');
const cookieParser = require('cookie-parser');

// Create CSRF instance
const tokens = new csrf();

// Middleware to add cookie parser and CSRF token generation
const csrfMiddleware = {
  // Initialize cookie parser
  cookieParser: cookieParser(process.env.CSRF_SECRET || 'your-csrf-secret'),

  // Generate CSRF token
  generateToken: (req, res, next) => {
    try {
      // Create a secret for this session if it doesn't exist
      if (!req.cookies.csrfSecret) {
        const secret = tokens.secretSync();
        res.cookie('csrfSecret', secret, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
        req.csrfSecret = secret;
      } else {
        req.csrfSecret = req.cookies.csrfSecret;
      }

      // Generate token
      req.csrfToken = tokens.create(req.csrfSecret);
      next();
    } catch (error) {
      console.error('CSRF token generation error:', error);
      res.status(500).json({ error: 'server_error' });
    }
  },

  // Validate CSRF token
  validateToken: (req, res, next) => {
    try {
      const token = req.headers['x-csrf-token'] || req.body._csrf || req.query._csrf;
      const secret = req.cookies.csrfSecret;

      if (!token) {
        return res.status(403).json({
          error: 'csrf_token_missing',
          description: 'CSRF token is required'
        });
      }

      if (!secret) {
        return res.status(403).json({
          error: 'csrf_secret_missing',
          description: 'CSRF secret is missing'
        });
      }

      if (!tokens.verify(secret, token)) {
        return res.status(403).json({
          error: 'invalid_csrf_token',
          description: 'Invalid CSRF token'
        });
      }

      next();
    } catch (error) {
      console.error('CSRF token validation error:', error);
      res.status(500).json({ error: 'server_error' });
    }
  },

  // Optional: Create token without validation (for GET endpoints that need to provide token)
  optionalToken: (req, res, next) => {
    try {
      if (!req.cookies.csrfSecret) {
        const secret = tokens.secretSync();
        res.cookie('csrfSecret', secret, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000
        });
        req.csrfSecret = secret;
      } else {
        req.csrfSecret = req.cookies.csrfSecret;
      }

      req.csrfToken = tokens.create(req.csrfSecret);
      next();
    } catch (error) {
      console.error('Optional CSRF token generation error:', error);
      next(); // Continue without CSRF token on error
    }
  }
};

module.exports = csrfMiddleware;