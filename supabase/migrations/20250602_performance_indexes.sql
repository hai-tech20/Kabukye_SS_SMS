-- Performance Optimization Indexes for Kabukye SS SMS
-- Run this in Supabase SQL Editor to speed up queries

-- ============================================
-- INDEXES FOR STUDENTS TABLE
-- ============================================

-- Index for filtering students by class (most common query)
CREATE INDEX IF NOT EXISTS idx_students_class_id ON sms.students(class_id);

-- Index for filtering students by stream
CREATE INDEX IF NOT EXISTS idx_students_stream_id ON sms.students(stream_id);

-- Composite index for class + stream filtering (common combination)
CREATE INDEX IF NOT EXISTS idx_students_class_stream ON sms.students(class_id, stream_id);

-- Index for filtering by status (active/inactive)
CREATE INDEX IF NOT EXISTS idx_students_status ON sms.students(status);

-- Composite index for the most common query: active students by class
CREATE INDEX IF NOT EXISTS idx_students_status_class ON sms.students(status, class_id);

-- Index for student full name search (for search functionality)
CREATE INDEX IF NOT EXISTS idx_students_full_name ON sms.students USING btree (full_name);


-- ============================================
-- INDEXES FOR SUBJECTS TABLE
-- ============================================

-- Index for filtering subjects by class
CREATE INDEX IF NOT EXISTS idx_subjects_class_id ON sms.subjects(class_id);

-- Index for subject name lookups (for the subject resolution logic)
CREATE INDEX IF NOT EXISTS idx_subjects_name ON sms.subjects(name);

-- Composite index for finding subjects by name within a class
CREATE INDEX IF NOT EXISTS idx_subjects_name_class ON sms.subjects(name, class_id);

-- ============================================
-- INDEXES FOR TEACHER_SUBJECTS TABLE
-- ============================================

-- Index for finding subjects assigned to a teacher
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher_id ON sms.teacher_subjects(teacher_id);

-- Index for finding teachers assigned to a class
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_class_id ON sms.teacher_subjects(class_id);

-- Composite index for teacher + class lookups
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher_class ON sms.teacher_subjects(teacher_id, class_id);

-- ============================================
-- INDEXES FOR STUDENT_SUBJECTS TABLE (A-Level)
-- ============================================

-- Index for finding subjects a student is enrolled in
CREATE INDEX IF NOT EXISTS idx_student_subjects_student_id ON sms.student_subjects(student_id);

-- Index for finding students enrolled in a subject (critical for A-level filtering)
CREATE INDEX IF NOT EXISTS idx_student_subjects_subject_id ON sms.student_subjects(subject_id);

-- Composite index for student + subject lookups
CREATE INDEX IF NOT EXISTS idx_student_subjects_student_subject ON sms.student_subjects(student_id, subject_id);

-- ============================================
-- INDEXES FOR STREAMS TABLE
-- ============================================

-- Index for finding streams by class
CREATE INDEX IF NOT EXISTS idx_streams_class_id ON sms.streams(class_id);

-- ============================================
-- INDEXES FOR CLASSES TABLE
-- ============================================

-- Index for class name lookups
CREATE INDEX IF NOT EXISTS idx_classes_name ON sms.classes(name);

-- Index for academic year filtering
CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON sms.classes(academic_year);

-- ============================================
-- INDEXES FOR GRADES TABLE (Critical for Reports)
-- ============================================

-- Index for finding grades by student
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON sms.grades(student_id);

-- Index for finding grades by subject
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON sms.grades(subject_id);

-- Composite index for student + subject + term + year (most common grades query)
CREATE INDEX IF NOT EXISTS idx_grades_student_subject_term_year 
ON sms.grades(student_id, subject_id, term, academic_year);

-- Index for term filtering
CREATE INDEX IF NOT EXISTS idx_grades_term ON sms.grades(term);

-- Index for academic year filtering
CREATE INDEX IF NOT EXISTS idx_grades_academic_year ON sms.grades(academic_year);

-- ============================================
-- INDEXES FOR GRADING SCALES
-- ============================================

-- Index for efficient grade lookups
CREATE INDEX IF NOT EXISTS idx_grading_scales_min_score ON sms.grading_scales(min_score);
CREATE INDEX IF NOT EXISTS idx_grading_scales_class_level ON sms.grading_scales(class_level);

-- ============================================
-- FULL-TEXT SEARCH INDEXES (for search functionality)
-- ============================================

-- Enable pg_trgm extension for fuzzy string matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for fuzzy name search on students
CREATE INDEX IF NOT EXISTS idx_students_full_name_trgm ON sms.students USING gin (full_name gin_trgm_ops);

-- ============================================
-- OPTIMIZATION NOTES
-- ============================================
-- 
-- After creating these indexes:
-- 1. Monitor query performance in Supabase Dashboard under Advisors > Query Performance
-- 2. Check for slow queries and consider adding more specific indexes
-- 3. Note that indexes slightly slow down INSERT/UPDATE operations but greatly speed up SELECTs
-- 4. For tables with < 1000 rows, indexes may not show significant improvement
--
-- To check if indexes are being used:
-- EXPLAIN ANALYZE SELECT * FROM students WHERE class_id = 'some-class-id';
-- Look for "Index Scan" in the output
