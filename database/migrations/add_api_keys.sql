-- API Keys table for managing API access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_preview VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'api_key' CHECK (type IN ('api_key', 'admin_token')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

-- Index for performance
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_type ON api_keys(type);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);