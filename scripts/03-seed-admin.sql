-- Create admin user (update email and details as needed)
INSERT INTO users (email, full_name, referral_code, is_admin)
VALUES ('admin@example.com', 'Admin User', 'ADMIN001', TRUE)
ON CONFLICT (email) DO NOTHING;
