-- Create demo user for demo database
\c demo;

-- Insert demo admin user (password: demo123)
-- Password hash for 'demo123' using bcrypt with salt rounds 10
INSERT INTO users (id, username, password_hash, is_admin, created_at, updated_at) 
VALUES (
    gen_random_uuid(), 
    'demo', 
    '$2b$10$0EHoN1QJFzTzE5.qx6k8Du8QZX1y.OKUyG.JGhDGvBfG7xTJd8JWG', 
    true, 
    NOW(), 
    NOW()
) ON CONFLICT (username) DO NOTHING;