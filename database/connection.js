const { Pool } = require('pg');
require('dotenv').config();

// Create separate pools for main and demo databases
const mainPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false  // Database server doesn't support SSL
});

const demoPool = new Pool({
    connectionString: process.env.DATABASE_URL.replace('/oauth2_db', '/demo'),
    ssl: false  // Database server doesn't support SSL
});

// Error handlers for both pools
mainPool.on('error', (err) => {
    console.error('Unexpected error on main database client', err);
    process.exit(-1);
});

demoPool.on('error', (err) => {
    console.error('Unexpected error on demo database client', err);
    process.exit(-1);
});

// Function to get the appropriate pool based on origin header or DB_MODE
const getCurrentPool = (req = null) => {
    // Check origin header first if request is available
    if (req && req.headers && req.headers.origin) {
        if (req.headers.origin === 'https://oauth2.demo.brockai.com') {
            return demoPool;
        }
    }
    
    // Fall back to DB_MODE environment variable
    const dbMode = process.env.DB_MODE || 'main';
    return dbMode === 'demo' ? demoPool : mainPool;
};

module.exports = {
    query: (text, params, req) => getCurrentPool(req).query(text, params),
    pool: getCurrentPool(), // For backwards compatibility
    mainPool,
    demoPool,
    getCurrentPool
};