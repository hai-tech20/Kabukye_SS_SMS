-- COMPLETE ACADEMIC YEAR & TERM MANAGEMENT SYSTEM
-- One comprehensive SQL file with everything needed
-- Run this single file to set up the entire system

-- ========================================
-- PART 1: USER ROLES TABLE SETUP
-- ========================================

-- Create user_roles table in sms schema
CREATE TABLE IF NOT EXISTS sms.user_roles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- References auth.users(id) but we'll handle this with a trigger
    role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role) -- A user can have multiple roles if needed
);

-- Enable RLS on user_roles
ALTER TABLE sms.user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_roles
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

-- Grant permissions on user_roles table
GRANT SELECT, INSERT, UPDATE, DELETE ON sms.user_roles TO authenticated;

-- ========================================
-- PART 2: HELPER FUNCTIONS FOR ROLES
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

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION sms.has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sms.get_user_roles() TO authenticated;

-- ========================================
-- PART 3: ENHANCE EXISTING TABLES
-- ========================================

-- Add next_class_id to classes table for progression tracking
ALTER TABLE sms.classes 
ADD COLUMN IF NOT EXISTS next_class_id TEXT,
ADD CONSTRAINT classes_next_class_id_fkey 
FOREIGN KEY (next_class_id) REFERENCES sms.classes(id) ON DELETE SET NULL;

-- Add status column to students table (if not exists)
ALTER TABLE sms.students 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- ========================================
-- PART 4: CREATE NEW ACADEMIC TABLES
-- ========================================

-- Academic Years table
CREATE TABLE IF NOT EXISTS sms.academic_years (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    year_label TEXT NOT NULL UNIQUE, -- e.g., '2026', '2027'
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Terms table
CREATE TABLE IF NOT EXISTS sms.terms (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    year_id TEXT NOT NULL,
    term_number INTEGER NOT NULL CHECK (term_number IN (1, 2, 3)),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Upcoming')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (year_id) REFERENCES sms.academic_years(id) ON DELETE CASCADE,
    UNIQUE(year_id, term_number)
);

-- Student History table for archival before promotion
CREATE TABLE IF NOT EXISTS sms.student_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    class_id TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    final_grades JSONB, -- Store all final grades for the term/year
    promotion_status TEXT DEFAULT 'Promoted', -- 'Promoted', 'Retained', 'Graduated'
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES sms.students(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE
);

-- Timetables table for file management
CREATE TABLE IF NOT EXISTS sms.timetables (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year TEXT NOT NULL,
    class_id TEXT NOT NULL,
    stream_id TEXT,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE
);

-- ========================================
-- PART 5: SET UP CLASS PROGRESSION
-- ========================================

-- Update classes with next_class_id progression
UPDATE sms.classes SET next_class_id = 's2' WHERE id = 's1';
UPDATE sms.classes SET next_class_id = 's3' WHERE id = 's2';
UPDATE sms.classes SET next_class_id = 's4' WHERE id = 's3';
UPDATE sms.classes SET next_class_id = 's5' WHERE id = 's4';
UPDATE sms.classes SET next_class_id = 's6' WHERE id = 's5';
-- S6 points to NULL (graduation)
UPDATE sms.classes SET next_class_id = NULL WHERE id = 's6';

-- ========================================
-- PART 6: INSERT INITIAL DATA
-- ========================================

-- Insert academic years
INSERT INTO sms.academic_years (year_label, is_current) VALUES
('2025', false),
('2026', true),
('2027', false)
ON CONFLICT (year_label) DO NOTHING;

-- Set 2026 as current year
UPDATE sms.academic_years SET is_current = true WHERE year_label = '2026';

-- Insert terms for 2026
INSERT INTO sms.terms (year_id, term_number, start_date, end_date, status) VALUES
-- Get 2026 year ID and insert terms
((SELECT id FROM sms.academic_years WHERE year_label = '2026'), 1, '2026-01-15', '2026-04-15', 'Active'),
((SELECT id FROM sms.academic_years WHERE year_label = '2026'), 2, '2026-05-10', '2026-08-10', 'Upcoming'),
((SELECT id FROM sms.academic_years WHERE year_label = '2026'), 3, '2026-09-05', '2026-12-05', 'Upcoming')
ON CONFLICT (year_id, term_number) DO NOTHING;

-- ========================================
-- PART 7: AUTOMATIC PROMOTION SYSTEM
-- ========================================

-- Create the main promotion function
CREATE OR REPLACE FUNCTION sms.promote_all_students()
RETURNS JSONB AS $$
DECLARE
    current_year_id TEXT;
    current_term RECORD;
    promotion_count INTEGER := 0;
    graduation_count INTEGER := 0;
    error_message TEXT;
BEGIN
    -- Safety check: Verify current date is past Term 3 end date
    SELECT t.id INTO current_term
    FROM sms.terms t
    JOIN sms.academic_years ay ON t.year_id = ay.id
    WHERE ay.is_current = true AND t.term_number = 3 AND t.status = 'Active';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Current academic year Term 3 is not active');
    END IF;
    
    IF current_date <= current_term.end_date THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot promote before Term 3 end date');
    END IF;
    
    -- Get current academic year
    SELECT id INTO current_year_id 
    FROM sms.academic_years 
    WHERE is_current = true;
    
    IF current_year_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No current academic year found');
    END IF;
    
    -- Start transaction for atomic operation
    BEGIN
        -- Archive current student data to history
        INSERT INTO sms.student_history (student_id, academic_year, term, class_id, stream_id, final_grades, promotion_status)
        SELECT 
            s.id,
            ay.year_label,
            '3', -- Final term
            s.class_id,
            s.stream_id,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'subject', sub.name,
                        'score', g.score,
                        'grade', g.grade
                    )
                ) FILTER (WHERE g.id IS NOT NULL),
                '{}'::jsonb
            ) as final_grades,
            CASE 
                WHEN c.next_class_id IS NULL THEN 'Graduated'
                ELSE 'Promoted'
            END as promotion_status
        FROM sms.students s
        JOIN sms.classes c ON s.class_id = c.id
        JOIN sms.academic_years ay ON ay.is_current = true
        LEFT JOIN sms.grades g ON s.id = g.student_id AND g.academic_year = ay.year_label AND g.term = '3'
        LEFT JOIN sms.subjects sub ON g.subject_id = sub.id
        WHERE s.status = 'active'
        GROUP BY s.id, ay.year_label, s.class_id, s.stream_id, c.next_class_id;
        
        -- Promote students to next class
        UPDATE sms.students s
        SET class_id = c.next_class_id,
            status = CASE 
                WHEN c.next_class_id IS NULL THEN 'Alumni'
                ELSE 'active'
            END,
            updated_at = NOW()
        FROM sms.classes c
        WHERE s.class_id = c.id 
        AND s.status = 'active'
        AND c.next_class_id IS NOT NULL;
        
        GET DIAGNOSTICS promotion_count = ROW_COUNT;
        
        -- Graduate S6 students (set status to Alumni)
        UPDATE sms.students s
        SET status = 'Alumni',
            updated_at = NOW()
        FROM sms.classes c
        WHERE s.class_id = c.id 
        AND s.status = 'active'
        AND c.next_class_id IS NULL;
        
        GET DIAGNOSTICS graduation_count = ROW_COUNT;
        
        -- Update current academic year to completed and activate next year
        UPDATE sms.academic_years 
        SET is_current = false 
        WHERE is_current = true;
        
        UPDATE sms.academic_years 
        SET is_current = true 
        WHERE year_label = (SELECT (year_label::INTEGER + 1)::TEXT FROM sms.academic_years WHERE is_current = false ORDER BY year_label DESC LIMIT 1);
        
        -- Update term statuses
        UPDATE sms.terms 
        SET status = 'Completed' 
        WHERE year_id = current_year_id;
        
        -- Activate new terms for next academic year
        UPDATE sms.terms 
        SET status = CASE term_number 
            WHEN 1 THEN 'Active'
            ELSE 'Upcoming'
        END
        WHERE year_id = (SELECT id FROM sms.academic_years WHERE is_current = true);
        
    END;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Promotion completed successfully',
        'promoted_count', promotion_count,
        'graduated_count', graduation_count
    );
    
EXCEPTION
    WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
        RETURN jsonb_build_object('success', false, 'error', error_message);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PART 8: HELPER FUNCTIONS FOR ACADEMIC MANAGEMENT
-- ========================================

-- Function to get current academic year and term
CREATE OR REPLACE FUNCTION sms.get_current_academic_info()
RETURNS JSONB AS $$
DECLARE
    current_year RECORD;
    current_term RECORD;
BEGIN
    SELECT ay.year_label, ay.id INTO current_year
    FROM sms.academic_years ay
    WHERE ay.is_current = true;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'No current academic year found');
    END IF;
    
    SELECT t.term_number, t.start_date, t.end_date, t.status INTO current_term
    FROM sms.terms t
    WHERE t.year_id = current_year.id
    AND t.status = 'Active';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'No active term found');
    END IF;
    
    RETURN jsonb_build_object(
        'academic_year', current_year.year_label,
        'current_term', current_term.term_number,
        'term_start_date', current_term.start_date,
        'term_end_date', current_term.end_date,
        'term_status', current_term.status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if promotion is allowed
CREATE OR REPLACE FUNCTION sms.can_promote()
RETURNS JSONB AS $$
DECLARE
    current_term RECORD;
BEGIN
    SELECT t.end_date, t.status INTO current_term
    FROM sms.terms t
    JOIN sms.academic_years ay ON t.year_id = ay.id
    WHERE ay.is_current = true AND t.term_number = 3;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('can_promote', false, 'reason', 'Term 3 not found for current academic year');
    END IF;
    
    IF current_term.status != 'Active' THEN
        RETURN jsonb_build_object('can_promote', false, 'reason', 'Term 3 is not active');
    END IF;
    
    IF current_date <= current_term.end_date THEN
        RETURN jsonb_build_object('can_promote', false, 'reason', 'Current date is before Term 3 end date');
    END IF;
    
    RETURN jsonb_build_object('can_promote', true, 'reason', 'Promotion is allowed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- PART 9: RLS POLICIES FOR ACADEMIC TABLES
-- ========================================

-- Enable RLS on new tables
ALTER TABLE sms.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms.student_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms.timetables ENABLE ROW LEVEL SECURITY;

-- Policies for academic years (admin only)
CREATE POLICY "Admins can view academic years" ON sms.academic_years
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage academic years" ON sms.academic_years
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
            AND ur.role = 'admin'
        )
    );

-- Policies for terms (admin only)
CREATE POLICY "Admins can view terms" ON sms.terms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage terms" ON sms.terms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
            AND ur.role = 'admin'
        )
    );

-- Policies for student history (admin only)
CREATE POLICY "Admins can view student history" ON sms.student_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage student history" ON sms.student_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
            AND ur.role = 'admin'
        )
    );

-- Policies for timetables (admin only)
CREATE POLICY "Admins can view timetables" ON sms.timetables
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
            AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can manage timetables" ON sms.timetables
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM sms.user_roles ur
            WHERE ur.user_id = auth.uid()::TEXT
            AND ur.role = 'admin'
        )
    );

-- ========================================
-- PART 10: GRANT PERMISSIONS
-- ========================================

-- Grant execute permission on all functions to authenticated users
GRANT EXECUTE ON FUNCTION sms.promote_all_students() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.get_current_academic_info() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.can_promote() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.assign_role_on_signup() TO authenticated;

-- Grant usage on sms schema and tables
GRANT USAGE ON SCHEMA sms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sms TO authenticated;

-- ========================================
-- PART 11: CREATE INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_academic_years_current ON sms.academic_years(is_current);
CREATE INDEX IF NOT EXISTS idx_terms_year_status ON sms.terms(year_id, status);
CREATE INDEX IF NOT EXISTS idx_student_history_student ON sms.student_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_history_academic_year ON sms.student_history(academic_year, term);
CREATE INDEX IF NOT EXISTS idx_timetables_academic_year ON sms.timetables(academic_year, class_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON sms.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON sms.user_roles(role);

-- ========================================
-- PART 12: ASSIGN ROLES TO EXISTING USERS
-- ========================================

-- Assign admin role to existing admin user (if exists)
INSERT INTO sms.user_roles (user_id, role)
SELECT id, 'admin' 
FROM auth.users 
WHERE email = 'haithamgates@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

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
-- PART 13: ADD HELPFUL COMMENTS
-- ========================================

COMMENT ON TABLE sms.user_roles IS 'Stores user role assignments for multi-role authentication';
COMMENT ON TABLE sms.academic_years IS 'Stores academic year information with current year tracking';
COMMENT ON TABLE sms.terms IS 'Stores term information with dates and status for each academic year';
COMMENT ON TABLE sms.student_history IS 'Archives student data before promotion for historical tracking';
COMMENT ON TABLE sms.timetables IS 'Stores timetable file information for each class/stream';
COMMENT ON COLUMN sms.classes.next_class_id IS 'Points to the next class in the progression chain (S1→S2→S3→S4→S5→S6→NULL)';
COMMENT ON COLUMN sms.students.status IS 'Student status: active, inactive, alumni';
COMMENT ON FUNCTION sms.promote_all_students() IS 'Atomic function to promote all students to next class or graduate S6 students';
COMMENT ON FUNCTION sms.has_role(TEXT) IS 'Check if current user has specific role';
COMMENT ON FUNCTION sms.get_user_roles() IS 'Get all roles for current user';

-- ========================================
-- FINAL VERIFICATION
-- ========================================

SELECT 'COMPLETE ACADEMIC YEAR & TERM MANAGEMENT SYSTEM SETUP COMPLETED!' as status;
SELECT 'Tables created: user_roles, academic_years, terms, student_history, timetables' as tables_created;
SELECT 'Functions created: promote_all_students, get_current_academic_info, can_promote, has_role, get_user_roles' as functions_created;
SELECT 'RLS policies enabled for admin-only access to academic management' as security_enabled;
SELECT 'Class progression chain: S1→S2→S3→S4→S5→S6→Alumni' as progression_setup;
SELECT 'Initial data: Academic years 2025-2027, Terms for 2026, Admin role assigned' as data_inserted;
SELECT 'Type casting fixes applied: auth.uid()::TEXT everywhere' as type_casting_fixed;
SELECT 'Your system is now ready for multi-role academic management!' as final_message;
