const { Pool } = require('pg');
require('dotenv').config();

const getDatabaseUrl = () => {
    const baseUrl = process.env.DATABASE_URL;
    const dbMode = process.env.DB_MODE || 'main';
    
    if (dbMode === 'demo') {
        return baseUrl.replace('/oauth2_db', '/demo');
    }
    return baseUrl;
};

const pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: false  // Database server doesn't support SSL
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};