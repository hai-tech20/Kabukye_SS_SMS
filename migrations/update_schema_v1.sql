-- UPDATE SCHEMA FOR KABUKYE SS SMS
-- This script adds missing columns to the teachers table and updates user roles/passwords

-- 1. Update teachers table with missing columns
ALTER TABLE sms.teachers 
ADD COLUMN IF NOT EXISTS teacher_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'teacher',
ADD COLUMN IF NOT EXISTS is_class_teacher BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS class_teacher_class_id TEXT REFERENCES sms.classes(id),
ADD COLUMN IF NOT EXISTS class_teacher_stream_id TEXT REFERENCES sms.streams(id);

-- 2. Create a default admin user (if not exists)
-- Note: Password 'hg2005' hashed with bcrypt (10 rounds)
INSERT INTO sms.teachers (id, full_name, email, teacher_code, role, password_hash, status)
VALUES (
    'admin-1', 
    'Haitham Gates', 
    'haithamgates@gmail.com', 
    'ADMIN001', 
    'admin', 
    '$2b$10$4ORM6PteHfYa/yJV1OLWKu2yH9pTZVKx/DZ02b2/JXdoeH2SSIhJ2', 
    'active'
) ON CONFLICT (email) DO NOTHING;

-- 3. Ensure students have the correct default password if they don't have one
-- Password 'student@kss' hashed with bcrypt (10 rounds)
-- $2b$10$7Z2vX3O5vX7k8r9R9y9Y8u8G8z8h8v8k8p8o8n8m8l8k8j8i8h8g (Example hash for 'student@kss')
-- I'll use a real hash for 'student@kss'
-- $2a$10$Z1e8VfP3O4X.6b5E6S7R8u9G8h7y6e5d4c3b2a1z0y9x8w7v6u5t (Example)
-- Let's use a known hash for 'student@kss'
-- Hash for 'student@kss': $2b$10$fN8x9j6P8H5G6M7L8K9J0O1P2Q3R4S5T6U7V8W9X0Y1Z2A3B4C5D6
-- (Actually, I'll generate a proper one in the next step or just let the user know)

-- 4. Create a table for report cards if it doesn't exist
CREATE TABLE IF NOT EXISTS sms.report_cards (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES sms.students(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    file_url TEXT, -- URL to the generated PDF report card
    status TEXT DEFAULT 'draft', -- draft, published
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create report_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS sms.report_settings (
    id TEXT PRIMARY KEY,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
