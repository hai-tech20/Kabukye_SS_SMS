-- ACADEMIC YEAR & TERM MANAGEMENT MIGRATIONS (SIMPLE VERSION - NO RLS)
-- Run these migrations in order to support automatic promotion system

-- ========================================
-- STEP 1: Add missing columns to existing tables
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
-- STEP 2: Create new tables for academic management
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
-- STEP 3: Set up class progression (linked list)
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
-- STEP 4: Insert initial academic years and terms
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
-- STEP 5: Create Automatic Promotion Stored Procedure
-- ========================================

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
-- STEP 6: Create helper functions
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
-- STEP 7: Create indexes for performance
-- ========================================

CREATE INDEX IF NOT EXISTS idx_academic_years_current ON sms.academic_years(is_current);
CREATE INDEX IF NOT EXISTS idx_terms_year_status ON sms.terms(year_id, status);
CREATE INDEX IF NOT EXISTS idx_student_history_student ON sms.student_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_history_academic_year ON sms.student_history(academic_year, term);
CREATE INDEX IF NOT EXISTS idx_timetables_academic_year ON sms.timetables(academic_year, class_id);

-- ========================================
-- STEP 8: Grant permissions
-- ========================================

-- Grant execute permission on functions to authenticated users
GRANT EXECUTE ON FUNCTION sms.promote_all_students() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.get_current_academic_info() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.can_promote() TO authenticated;

-- Grant usage on schemas and tables
GRANT USAGE ON SCHEMA sms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sms TO authenticated;

-- ========================================
-- STEP 9: Add helpful comments
-- ========================================

COMMENT ON TABLE sms.academic_years IS 'Stores academic year information with current year tracking';
COMMENT ON TABLE sms.terms IS 'Stores term information with dates and status for each academic year';
COMMENT ON TABLE sms.student_history IS 'Archives student data before promotion for historical tracking';
COMMENT ON TABLE sms.timetables IS 'Stores timetable file information for each class/stream';
COMMENT ON COLUMN sms.classes.next_class_id IS 'Points to the next class in the progression chain (S1→S2→S3→S4→S5→S6→NULL)';
COMMENT ON COLUMN sms.students.status IS 'Student status: active, inactive, alumni';
COMMENT ON FUNCTION sms.promote_all_students() IS 'Atomic function to promote all students to next class or graduate S6 students';

-- Migration complete!
SELECT 'Academic Year & Term Management migration completed successfully!' as status;
