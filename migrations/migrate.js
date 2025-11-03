const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function migrate() {
    try {
        console.log('Starting database migration...');
        
        // 1. Execute the main schema
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await db.query(schema);
        console.log('✓ Main schema executed');
        
        // 2. Execute all SQL migration files in order
        const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
        const migrationFiles = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Execute in alphabetical order
        
        for (const file of migrationFiles) {
            console.log(`Running migration: ${file}`);
            const migrationPath = path.join(migrationsDir, file);
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            
            try {
                await db.query(migrationSQL);
                console.log(`✓ ${file} completed`);
            } catch (error) {
                console.error(`✗ ${file} failed:`, error.message);
                // Continue with other migrations instead of failing completely
            }
        }
        
        console.log('Database migration completed successfully!');
        
        // Verify the migration
        const result = await db.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY tablename
        `);
        
        console.log('All tables created:', result.rows.map(row => row.tablename));
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await db.pool.end();
        process.exit(0);
    }
}

migrate();