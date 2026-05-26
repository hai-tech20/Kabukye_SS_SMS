-- ============================================================================
-- UACE GRADING SYSTEM - EXECUTION GUIDE FOR S5/S6 STUDENTS
-- ============================================================================
-- This file documents how to run the UACE grading calculations for S5 and S6 students.
--
-- PREREQUISITE: Run the following two migration files in order:
-- 1. add_uace_columns.sql        (adds schema columns)
-- 2. uace_grading_functions.sql  (adds helper functions and main procedure)
--
-- Then execute the procedure(s) in this file for each academic year/term combination.

-- ============================================================================
-- EXAMPLE 1: Calculate UACE grades for S5/S6, Academic Year 2026, Term 1
-- ============================================================================
CALL sms.calculate_s5_s6_uace_grades(2026, 1);

-- Expected output in psql:
-- NOTICE:  Updated XXX grade records
-- NOTICE:  Updated XXX student records with total UACE points
-- NOTICE:  UACE calculation completed for academic year 2026, term 1

-- ============================================================================
-- EXAMPLE 2: Calculate for Academic Year 2026, Term 2
-- ============================================================================
CALL sms.calculate_s5_s6_uace_grades(2026, 2);

-- ============================================================================
-- EXAMPLE 3: Calculate for Academic Year 2026, Term 3 (End of Year)
-- ============================================================================
CALL sms.calculate_s5_s6_uace_grades(2026, 3);

-- ============================================================================
-- VERIFICATION: View Results
-- ============================================================================
-- After running the procedure, check the results:

-- Query 1: Summary of UACE points per student
SELECT
  st.admission_number,
  st.full_name,
  st.subject_combination,
  st.total_uace_points,
  COUNT(DISTINCT g.subject_id) AS num_subjects
FROM sms.students st
LEFT JOIN sms.grades g ON g.student_id = st.id
  AND g.academic_year = 2026
  AND g.term = 1
WHERE st.subject_combination IS NOT NULL
GROUP BY st.id, st.admission_number, st.full_name, st.subject_combination, st.total_uace_points
ORDER BY st.full_name;

-- Query 2: Detailed grade breakdown by student and subject
SELECT
  st.admission_number,
  st.full_name,
  st.subject_combination,
  st.total_uace_points,
  subj.subject_name,
  g.grade,
  g.subject_type,
  g.uace_points,
  g.final_score,
  g.mot_score,
  g.eot_score
FROM sms.students st
JOIN sms.grades g ON g.student_id = st.id
JOIN sms.subjects subj ON subj.id = g.subject_id
WHERE st.subject_combination IS NOT NULL
  AND g.academic_year = 2026
  AND g.term = 1
ORDER BY st.full_name, subj.subject_name;

-- Query 3: Top 3 principal subjects per student (used for total calculation)
SELECT
  st.admission_number,
  st.full_name,
  subj.subject_name,
  g.grade,
  g.uace_points,
  ROW_NUMBER() OVER (
    PARTITION BY st.id
    ORDER BY g.uace_points DESC
  ) AS rank
FROM sms.students st
JOIN sms.grades g ON g.student_id = st.id
JOIN sms.subjects subj ON subj.id = g.subject_id
WHERE st.subject_combination IS NOT NULL
  AND g.academic_year = 2026
  AND g.term = 1
  AND g.subject_type = 'principal'
ORDER BY st.full_name, rank;

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================

-- If you get "subject_type cannot be determined", it means subject names
-- don't match the expected patterns (Sub-*, General Paper, GP).
-- In that case, manually update the subject_type in sms.grades:
/*
UPDATE sms.grades
SET subject_type = 'subsidiary'
WHERE subject_id IN (
  SELECT id FROM sms.subjects
  WHERE subject_name ILIKE '%Math%'  -- Example: substitute with actual subject names
)
AND academic_year = 2026
AND term = 1;
*/

-- To verify the inferred subject types before committing:
SELECT DISTINCT
  s.subject_name,
  sms.infer_subject_type(s.subject_name) AS inferred_type
FROM sms.subjects s
WHERE s.id IN (
  SELECT DISTINCT subject_id FROM sms.grades
  WHERE academic_year = 2026 AND term = 1
)
ORDER BY s.subject_name;
