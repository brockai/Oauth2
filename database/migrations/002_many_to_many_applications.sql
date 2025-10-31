-- Migration: Change from one-to-many to many-to-many relationship between applications and tenants
-- This allows one application to be associated with multiple tenants

-- Create junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS tenant_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, application_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_applications_tenant_id ON tenant_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_applications_application_id ON tenant_applications(application_id);

-- Migrate existing data from oauth_clients.tenant_id to junction table
INSERT INTO tenant_applications (tenant_id, application_id)
SELECT tenant_id, id
FROM oauth_clients 
WHERE tenant_id IS NOT NULL;

-- Remove the direct foreign key from oauth_clients table
-- Note: We'll keep the tenant_id column for now to avoid breaking changes, but it won't be used
-- ALTER TABLE oauth_clients DROP COLUMN tenant_id;

-- Add a comment to indicate the column is deprecated
COMMENT ON COLUMN oauth_clients.tenant_id IS 'DEPRECATED: Use tenant_applications junction table instead';