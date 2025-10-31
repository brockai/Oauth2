-- Migration: Add tenant users for OAuth 2.0 user management
-- This allows each tenant to have multiple users that can authenticate via OAuth 2.0

-- Create tenant_users table
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, username),
    UNIQUE(tenant_id, email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_username ON tenant_users(username);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_active ON tenant_users(is_active);

-- Update access_tokens to support tenant users
ALTER TABLE access_tokens ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_access_tokens_tenant_user_id ON access_tokens(tenant_user_id);

-- Update authorization_codes to support tenant users  
ALTER TABLE authorization_codes ADD COLUMN IF NOT EXISTS tenant_user_id UUID REFERENCES tenant_users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_authorization_codes_tenant_user_id ON authorization_codes(tenant_user_id);

-- Create user sessions table for OAuth flows
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_user_id ON user_sessions(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Add comments
COMMENT ON TABLE tenant_users IS 'Users that belong to specific tenants and can authenticate via OAuth 2.0';
COMMENT ON TABLE user_sessions IS 'Session management for tenant users during OAuth flows';
COMMENT ON COLUMN access_tokens.tenant_user_id IS 'Links access token to specific tenant user';
COMMENT ON COLUMN authorization_codes.tenant_user_id IS 'Links authorization code to specific tenant user';