-- Add role support to OAuth applications
-- This migration adds the ability to define multiple roles per application

-- Create roles table for application-specific roles
CREATE TABLE application_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    role_description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb, -- Array of permission strings
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure role names are unique within an application
    CONSTRAINT unique_app_role UNIQUE (application_id, role_name)
);

-- Create user role assignments table (many-to-many between users and roles)
CREATE TABLE user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References tenant_users or could be external user ID
    application_id UUID NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES application_roles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- Optional: role assignment within specific tenant context
    assigned_by UUID, -- Who assigned this role
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration
    is_active BOOLEAN DEFAULT true,

    -- Ensure a user can't have the same role twice in the same context
    CONSTRAINT unique_user_app_role UNIQUE (user_id, application_id, role_id, tenant_id)
);

-- Add role information to access tokens
ALTER TABLE access_tokens
ADD COLUMN assigned_roles UUID[] DEFAULT '{}'; -- Array of role IDs assigned to this token

-- Add role information to authorization codes
ALTER TABLE authorization_codes
ADD COLUMN requested_roles VARCHAR(1000), -- Comma-separated list of requested role names
ADD COLUMN assigned_roles UUID[]; -- Array of role IDs actually assigned

-- Create indexes for performance
CREATE INDEX idx_application_roles_app_id ON application_roles(application_id);
CREATE INDEX idx_application_roles_name ON application_roles(application_id, role_name);
CREATE INDEX idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX idx_user_role_assignments_app ON user_role_assignments(application_id);
CREATE INDEX idx_user_role_assignments_role ON user_role_assignments(role_id);
CREATE INDEX idx_user_role_assignments_tenant ON user_role_assignments(tenant_id);
CREATE INDEX idx_access_tokens_roles ON access_tokens USING GIN (assigned_roles);

-- Insert some default roles for existing applications
INSERT INTO application_roles (application_id, role_name, role_description, permissions)
SELECT
    id as application_id,
    'user' as role_name,
    'Standard user access' as role_description,
    '["read", "write"]'::jsonb as permissions
FROM oauth_clients
WHERE is_active = true;

INSERT INTO application_roles (application_id, role_name, role_description, permissions)
SELECT
    id as application_id,
    'admin' as role_name,
    'Administrative access' as role_description,
    '["read", "write", "admin", "manage_users"]'::jsonb as permissions
FROM oauth_clients
WHERE is_active = true;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_application_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_application_roles_updated_at
    BEFORE UPDATE ON application_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_application_roles_updated_at();