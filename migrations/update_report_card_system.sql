-- =============================================
-- KABUKYE SECONDARY SCHOOL REPORT CARD SYSTEM UPDATE
-- =============================================
-- This script updates the report card system with the new:
-- 1. Grading scheme (A-Exceptional, B-Outstanding, etc.)
-- 2. Teacher and Head Teacher comment systems
-- 3. Grade_papers support for multi-paper subjects
-- 4. Report publishing and PDF storage
-- =============================================

-- =============================================
-- STEP 1: Update/Create Grading Scales
-- =============================================
-- First, delete old grading scales if they exist
DELETE FROM sms.grading_scales WHERE true;

-- Insert the NEW grading scale for ALL classes with explicit IDs
INSERT INTO sms.grading_scales (id, grade, min_score, max_score, descriptor, points) VALUES
(gen_random_uuid()::text, 'A', 80, 100, 'Exceptional', 6),
(gen_random_uuid()::text, 'B', 70, 79, 'Outstanding', 5),
(gen_random_uuid()::text, 'C', 50, 69, 'Satisfactory', 4),
(gen_random_uuid()::text, 'D', 35, 49, 'Basic', 3),
(gen_random_uuid()::text, 'E', 0, 34, 'Elementary', 2);

-- =============================================
-- STEP 2: Ensure Grade Papers Table Exists
-- =============================================
-- This table stores individual paper scores for subjects with multiple papers
CREATE TABLE IF NOT EXISTS sms.grade_papers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    grade_id TEXT NOT NULL,
    paper_number INTEGER NOT NULL CHECK (paper_number >= 1 AND paper_number <= 3),
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('MOT', 'EOT')),
    score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (grade_id) REFERENCES sms.grades(id) ON DELETE CASCADE,
    UNIQUE(grade_id, paper_number, assessment_type)
);

-- =============================================
-- STEP 3: Add Comments Table
-- =============================================
-- This table stores class teacher and head teacher comments for each report
CREATE TABLE IF NOT EXISTS sms.report_comments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    class_teacher_comment TEXT,
    head_teacher_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES sms.students(id) ON DELETE CASCADE,
    UNIQUE(student_id, academic_year, term)
);

-- =============================================
-- STEP 4: Add Published Reports Table
-- =============================================
-- This table stores published report cards with PDF storage
CREATE TABLE IF NOT EXISTS sms.published_reports (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    pdf_url TEXT,
    is_published BOOLEAN DEFAULT false,
    published_by TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES sms.students(id) ON DELETE CASCADE,
    UNIQUE(student_id, academic_year, term)
);

-- =============================================
-- STEP 5: Add Helper Functions for Comment Lookup
-- =============================================

-- Function to get class teacher comment based on score range (S1-S4)
CREATE OR REPLACE FUNCTION sms.get_class_teacher_comment_o_level(final_score INTEGER)
RETURNS TEXT AS $$
BEGIN
    CASE
        WHEN final_score BETWEEN 0 AND 39 THEN
            RETURN 'Needs practice';
        WHEN final_score BETWEEN 40 AND 49 THEN
            RETURN 'More effort is needed';
        WHEN final_score BETWEEN 50 AND 59 THEN
            RETURN 'More effort is needed';
        WHEN final_score BETWEEN 60 AND 69 THEN
            RETURN 'Can do better than this';
        WHEN final_score BETWEEN 70 AND 79 THEN
            RETURN 'Good performance';
        WHEN final_score BETWEEN 80 AND 100 THEN
            RETURN 'Perfect keep it up';
        ELSE
            RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get head teacher comment based on score range (S1-S4)
CREATE OR REPLACE FUNCTION sms.get_head_teacher_comment_o_level(final_score INTEGER)
RETURNS TEXT AS $$
BEGIN
    CASE
        WHEN final_score BETWEEN 0 AND 39 THEN
            RETURN 'Requires support';
        WHEN final_score BETWEEN 40 AND 49 THEN
            RETURN 'Fair performance';
        WHEN final_score BETWEEN 50 AND 59 THEN
            RETURN 'Quite good';
        WHEN final_score BETWEEN 60 AND 69 THEN
            RETURN 'Above average';
        WHEN final_score BETWEEN 70 AND 79 THEN
            RETURN 'Very good performance';
        WHEN final_score BETWEEN 80 AND 100 THEN
            RETURN 'Excellent keep it up';
        ELSE
            RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get class teacher comment based on total points (S5-S6)
CREATE OR REPLACE FUNCTION sms.get_class_teacher_comment_a_level(total_points INTEGER)
RETURNS TEXT AS $$
BEGIN
    CASE
        WHEN total_points BETWEEN 1 AND 5 THEN
            RETURN 'Improve on the weak areas';
        WHEN total_points BETWEEN 6 AND 10 THEN
            RETURN 'More effort is needed';
        WHEN total_points BETWEEN 10 AND 15 THEN
            RETURN 'Promising results';
        WHEN total_points BETWEEN 16 AND 20 THEN
            RETURN 'Very good performance';
        ELSE
            RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get head teacher comment based on total points (S5-S6)
CREATE OR REPLACE FUNCTION sms.get_head_teacher_comment_a_level(total_points INTEGER)
RETURNS TEXT AS $$
BEGIN
    CASE
        WHEN total_points BETWEEN 1 AND 5 THEN
            RETURN 'Work harder';
        WHEN total_points BETWEEN 6 AND 10 THEN
            RETURN 'Can do better than this';
        WHEN total_points BETWEEN 10 AND 15 THEN
            RETURN 'Quite good performance';
        WHEN total_points BETWEEN 16 AND 20 THEN
            RETURN 'Excellent performance';
        ELSE
            RETURN NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- STEP 6: Add Function to Calculate Grade from Score
-- =============================================
CREATE OR REPLACE FUNCTION sms.get_grade_from_score(score NUMERIC)
RETURNS TEXT AS $$
DECLARE
    grade_record RECORD;
BEGIN
    SELECT grade INTO grade_record
    FROM sms.grading_scales
    WHERE score BETWEEN min_score AND max_score
    LIMIT 1;
    
    RETURN grade_record.grade;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- STEP 7: Add Function to Calculate Final Score (MOT 40% + EOT 60%)
-- =============================================
CREATE OR REPLACE FUNCTION sms.calculate_final_score(mot_score NUMERIC, eot_score NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
    RETURN ROUND((mot_score * 0.4) + (eot_score * 0.6));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- STEP 8: Verify everything is created correctly
-- =============================================
SELECT 'Report Card System Update Complete!' as status;

-- Show the new grading scale
SELECT 'New Grading Scale:' as section;
SELECT * FROM sms.grading_scales ORDER BY min_score DESC;

-- Show new tables
SELECT 'New Tables Created:' as section;
SELECT 'sms.grade_papers' as table_name UNION ALL
SELECT 'sms.report_comments' as table_name UNION ALL
SELECT 'sms.published_reports' as table_name;
