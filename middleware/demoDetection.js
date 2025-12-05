const db = require('../database/connection');

// Middleware to force demo database for requests from demo origin
const demoDetection = (req, res, next) => {
    // Check if request is coming from demo origin
    const isDemoRequest = req.headers.origin === 'https://oauth2.demo.brockai.com' ||
                         req.headers.referer?.includes('oauth2.demo.brockai.com');
    
    if (isDemoRequest) {
        // Override the db.query function for this request to always use demo pool
        const originalQuery = db.query;
        req.originalDbQuery = originalQuery;
        
        // Replace db.query with demo-only version
        db.query = (text, params) => {
            return db.demoPool.query(text, params);
        };
        
        // Restore original function after response
        res.on('finish', () => {
            db.query = originalQuery;
        });
    }
    
    next();
};

module.exports = demoDetection;