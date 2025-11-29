const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Create connection pools for both databases
const mainDb = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'oauth2_db',
    user: process.env.DB_USER || 'oauth2_user',
    password: process.env.DB_PASSWORD || 'oauth2_pass'
});

async function syncDemoDatabase() {
    let adminDb, demoDb;
    
    try {
        console.log('🔄 Syncing demo database with main database schema...');
        
        // Connect to postgres database to create demo database
        adminDb = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: 'postgres', // Connect to postgres database to create demo
            user: process.env.DB_USER || 'oauth2_user',
            password: process.env.DB_PASSWORD || 'oauth2_pass'
        });
        
        // 1. Create demo database if it doesn't exist
        console.log('Creating demo database if it doesn\'t exist...');
        try {
            await adminDb.query('CREATE DATABASE demo');
            console.log('✓ Demo database created');
        } catch (error) {
            if (error.code === '42P04') { // Database already exists
                console.log('✓ Demo database already exists');
            } else {
                throw error;
            }
        }
        
        // Close admin connection and connect to demo database
        await adminDb.end();
        adminDb = null; // Mark as closed to avoid double-end in finally block
        
        // Connect to the demo database
        demoDb = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: 'demo',
            user: process.env.DB_USER || 'oauth2_user',
            password: process.env.DB_PASSWORD || 'oauth2_pass'
        });
        
        // 2. Drop and recreate demo database schema
        console.log('Recreating demo database schema...');
        await demoDb.query('DROP SCHEMA IF EXISTS public CASCADE');
        await demoDb.query('CREATE SCHEMA public');
        await demoDb.query('GRANT ALL ON SCHEMA public TO oauth2_user');
        await demoDb.query('GRANT ALL ON SCHEMA public TO public');
        
        // 3. Execute the main schema
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await demoDb.query(schema);
        console.log('✓ Main schema applied to demo database');
        
        // 4. Execute all migrations in order
        const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        
        for (const file of migrationFiles) {
            console.log(`Applying migration to demo: ${file}`);
            const migrationPath = path.join(migrationsDir, file);
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            
            try {
                await demoDb.query(migrationSQL);
                console.log(`✓ ${file} applied to demo database`);
            } catch (error) {
                console.error(`✗ ${file} failed on demo database:`, error.message);
            }
        }
        
        // 5. Update demo-specific data
        await demoDb.query(`
            UPDATE tenants 
            SET name = 'Demo Tenant', 
                description = 'Demo tenant for testing',
                domain = 'demo.localhost'
            WHERE id = '00000000-0000-0000-0000-000000000001'
        `);
        
        console.log('✅ Demo database sync completed successfully!');
        
        // Verify the sync
        const demoTables = await demoDb.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);
        
        const mainTables = await mainDb.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);
        
        const demoTableNames = demoTables.rows.map(row => row.tablename);
        const mainTableNames = mainTables.rows.map(row => row.tablename);
        
        console.log('Demo database tables:', demoTableNames);
        console.log('Schemas match:', JSON.stringify(demoTableNames) === JSON.stringify(mainTableNames) ? '✅' : '❌');
        
    } catch (error) {
        console.error('❌ Demo database sync failed:', error);
        process.exit(1);
    } finally {
        try {
            await mainDb.end();
        } catch (err) {
            console.error('Error closing main DB:', err.message);
        }
        
        try {
            if (demoDb) await demoDb.end();
        } catch (err) {
            console.error('Error closing demo DB:', err.message);
        }
        
        try {
            if (adminDb) await adminDb.end();
        } catch (err) {
            console.error('Error closing admin DB:', err.message);
        }
        
        process.exit(0);
    }
}

// Run if called directly
if (require.main === module) {
    syncDemoDatabase();
}

module.exports = { syncDemoDatabase };