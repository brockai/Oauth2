const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function addTenants() {
    try {
        console.log('Starting multi-tenancy migration...');
        
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '001_add_tenants.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');
        
        // Execute the migration
        await db.query(migration);
        
        console.log('Multi-tenancy migration completed successfully!');
        
        // Verify the migration
        const result = await db.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'tenants'
        `);
        
        if (result.rows.length > 0) {
            console.log('Tenants table created successfully');
            
            // Check if columns were added
            const columnsResult = await db.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'oauth_clients' 
                AND column_name = 'tenant_id'
            `);
            
            if (columnsResult.rows.length > 0) {
                console.log('tenant_id column added to oauth_clients table');
            }
            
            // Show existing tenants
            const tenantsResult = await db.query('SELECT * FROM tenants');
            console.log('Existing tenants:', tenantsResult.rows);
        }
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

addTenants();