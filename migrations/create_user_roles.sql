-- CREATE USER ROLES TABLE FOR PROPER RLS AUTHENTICATION
-- Run this before the academic year management migration

-- ========================================
-- STEP 1: Create user_roles table in sms schema
-- ========================================

CREATE TABLE IF NOT EXISTS sms.user_roles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- References auth.users(id) but we'll handle this with a trigger
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role) -- A user can have multiple roles if needed
);

-- ========================================
-- STEP 2: Enable RLS on user_roles
-- ========================================

ALTER TABLE sms.user_roles ENABLE ROW LEVEL SECURITY;

-- ========================================
-- STEP 3: Create RLS policies for user_roles
-- ========================================

-- Users can view their own roles
CREATE POLICY "Users can view own roles" ON sms.user_roles
    FOR SELECT USING (user_id = auth.uid()::TEXT);

-- Only service role or admins can manage roles
CREATE POLICY "Admins can manage all roles" ON sms.user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur2
            WHERE ur2.user_id = auth.uid()::TEXT 
            AND ur2.role = 'admin'
        )
    );

-- ========================================
-- STEP 4: Grant permissions
-- ========================================

-- Grant permissions on user_roles table
GRANT SELECT, INSERT, UPDATE, DELETE ON sms.user_roles TO authenticated;

-- ========================================
-- STEP 5: Create trigger to automatically assign roles
-- ========================================

-- Function to automatically assign role based on user metadata
CREATE OR REPLACE FUNCTION sms.assign_role_on_signup()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user has role in metadata and assign it
    IF NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
        INSERT INTO sms.user_roles (user_id, role)
        VALUES (NEW.id::TEXT, NEW.raw_user_meta_data->>'role')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically assign role on user creation
-- Note: This requires the trigger to be created by a superuser or service role
-- For now, we'll handle this manually

-- ========================================
-- STEP 6: Insert existing admin user role
-- ========================================

-- Assign admin role to existing admin user (if exists)
INSERT INTO sms.user_roles (user_id, role)
SELECT id, 'admin' 
FROM auth.users 
WHERE email = 'haithamgates@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ========================================
-- STEP 7: Create helper functions for role checking
-- ========================================

-- Function to check if current user has specific role
CREATE OR REPLACE FUNCTION sms.has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM sms.user_roles 
        WHERE user_id = auth.uid()::TEXT 
        AND role = role_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user's roles
CREATE OR REPLACE FUNCTION sms.get_user_roles()
RETURNS TEXT[] AS $$
DECLARE
    user_roles TEXT[];
BEGIN
    SELECT ARRAY_AGG(role) INTO user_roles
    FROM sms.user_roles 
    WHERE user_id = auth.uid()::TEXT;
    
    RETURN COALESCE(user_roles, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 8: Update existing users to have proper roles
-- ========================================

-- Assign roles to existing users based on their current role in teachers table
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Update existing users from teachers table
    FOR user_record IN 
        SELECT t.id, t.role as teacher_role, u.id as user_id
        FROM sms.teachers t
        JOIN auth.users u ON t.email = u.email
        WHERE t.email IS NOT NULL
    LOOP
        INSERT INTO sms.user_roles (user_id, role)
        VALUES (user_record.user_id::TEXT, user_record.teacher_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END LOOP;
    
    -- For students, you'll need to implement this based on your student auth setup
    -- This is a placeholder - adjust based on how students authenticate
    FOR user_record IN 
        SELECT s.id, 'student' as student_role, u.id as user_id
        FROM sms.students s
        JOIN auth.users u ON s.schoolpay_code = u.raw_user_meta_data->>'schoolpay_code'
        WHERE s.schoolpay_code IS NOT NULL
        AND u.raw_user_meta_data->>'schoolpay_code' IS NOT NULL
    LOOP
        INSERT INTO sms.user_roles (user_id, role)
        VALUES (user_record.user_id::TEXT, user_record.student_role)
        ON CONFLICT (user_id, role) DO NOTHING;
    END LOOP;
END $$;

-- ========================================
-- STEP 9: Grant execute permissions on helper functions
-- ========================================

GRANT EXECUTE ON FUNCTION sms.has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sms.get_user_roles() TO authenticated;

-- Migration complete!
SELECT 'User roles table and RLS setup completed successfully!' as status;
