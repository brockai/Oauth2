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

// Function to get the appropriate pool based on NODE_DEMO_ENV or DB_MODE
const getCurrentPool = () => {
    // Check NODE_DEMO_ENV first, then fall back to DB_MODE
    const isDemoEnv = process.env.NODE_DEMO_ENV === 'true' || process.env.NODE_DEMO_ENV === '1';
    const dbMode = process.env.DB_MODE || 'main';
    
    return isDemoEnv || dbMode === 'demo' ? demoPool : mainPool;
};

module.exports = {
    query: (text, params) => getCurrentPool().query(text, params),
    pool: getCurrentPool(), // For backwards compatibility
    mainPool,
    demoPool,
    getCurrentPool
};