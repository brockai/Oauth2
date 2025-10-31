const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function migrate() {
    try {
        console.log('Starting database migration...');
        
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute the schema
        await db.query(schema);
        
        console.log('Database migration completed successfully!');
        
        // Verify the migration
        const result = await db.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('users', 'oauth_clients', 'authorization_codes', 'access_tokens', 'refresh_tokens')
            ORDER BY tablename
        `);
        
        console.log('Created tables:', result.rows.map(row => row.tablename));
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

migrate();