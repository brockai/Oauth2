-- Apply all migrations to demo database
\c demo;

-- Apply migrations in order
\i migrations/001_add_tenants.sql
\i migrations/002_many_to_many_applications.sql
\i migrations/003_tenant_users.sql
\i migrations/004_add_application_roles.sql
\i migrations/add_api_keys.sql
\i migrations/add_api_logs.sql
\i migrations/add_tenant_id_to_api_logs.sql

-- Update demo tenant data
UPDATE tenants 
SET name = 'Demo Tenant', 
    description = 'Demo tenant for testing',
    domain = 'demo.localhost'
WHERE id = '00000000-0000-0000-0000-000000000001';