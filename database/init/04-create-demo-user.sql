-- Create demo user for demo database
\c demo;

-- Insert demo admin user (password: demo123)
-- Password hash for 'demo123' using bcrypt with salt rounds 10
INSERT INTO users (id, username, password_hash, is_admin, created_at, updated_at) 
VALUES (
    gen_random_uuid(), 
    'demo', 
    '$2a$10$jynrkiR2XUn4uUFvWRPqKesaED8L2GTczd8R48RNUggmIdEEnRQJO', 
    true, 
    NOW(), 
    NOW()
) ON CONFLICT (username) DO NOTHING;