const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function migrateApiKeys() {
    try {
        console.log('Starting API keys table migration...');
        
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', 'add_api_keys.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute the migration
        await db.query(migrationSQL);
        
        console.log('API keys table migration completed successfully!');
        
        // Verify the migration
        const result = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'api_keys' 
            ORDER BY ordinal_position
        `);
        
        console.log('API keys table columns:', result.rows);
        
    } catch (error) {
        console.error('Migration failed:', error);
        if (error.message.includes('already exists')) {
            console.log('API keys table already exists, skipping migration.');
        } else {
            process.exit(1);
        }
    } finally {
        process.exit(0);
    }
}

migrateApiKeys();