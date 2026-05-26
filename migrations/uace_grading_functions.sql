-- UACE Grading Calculation Functions and Procedure
-- Run this AFTER add_uace_columns.sql

-- ============================================================================
-- 1. FUNCTION: Convert percentage score to UNEB A-Level letter grade
-- ============================================================================
CREATE OR REPLACE FUNCTION sms.score_to_grade(score INT)
RETURNS TEXT AS $$
BEGIN
  IF score >= 80 THEN RETURN 'A';
  ELSIF score >= 70 THEN RETURN 'B';
  ELSIF score >= 60 THEN RETURN 'C';
  ELSIF score >= 50 THEN RETURN 'D';
  ELSIF score >= 40 THEN RETURN 'E';
  ELSIF score >= 30 THEN RETURN 'O';
  ELSE RETURN 'F';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 2. FUNCTION: Convert grade to UACE points based on subject type
-- ============================================================================
CREATE OR REPLACE FUNCTION sms.grade_to_points(grade TEXT, subject_type TEXT)
RETURNS INT AS $$
BEGIN
  -- Principal subjects (A-level main subjects)
  IF subject_type = 'principal' THEN
    RETURN CASE grade
      WHEN 'A' THEN 6
      WHEN 'B' THEN 5
      WHEN 'C' THEN 4
      WHEN 'D' THEN 3
      WHEN 'E' THEN 2
      WHEN 'O' THEN 1
      ELSE 0
    END;
  -- Subsidiary subjects and General Paper
  ELSE
    RETURN CASE grade
      WHEN 'A' THEN 1
      WHEN 'B' THEN 1
      WHEN 'C' THEN 1
      WHEN 'D' THEN 1
      WHEN 'E' THEN 1
      ELSE 0
    END;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 3. FUNCTION: Determine subject type from subject name
-- ============================================================================
CREATE OR REPLACE FUNCTION sms.infer_subject_type(subject_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- General Paper detection
  IF subject_name ILIKE '%General Paper%' OR subject_name ILIKE '%GP%' THEN
    RETURN 'general_paper';
  -- Subsidiary/Sub- subject detection
  ELSIF subject_name ILIKE '%Sub-%' OR subject_name ILIKE '%Subsidiary%' THEN
    RETURN 'subsidiary';
  -- Default to principal
  ELSE
    RETURN 'principal';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 4. MAIN PROCEDURE: Calculate and update UACE grades for S5/S6 students
-- ============================================================================
CREATE OR REPLACE PROCEDURE sms.calculate_s5_s6_uace_grades(
  p_academic_year INT,
  p_term INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_debug_count INT := 0;
BEGIN
  -- STEP 1: Update letter grades and uace_points for each grade record
  WITH grade_updates AS (
    SELECT
      g.id,
      g.student_id,
      g.subject_id,
      g.final_score,
      s.subject_name,
      sms.score_to_grade(g.final_score) AS new_grade,
      sms.infer_subject_type(s.subject_name) AS determined_subject_type
    FROM sms.grades g
    JOIN sms.subjects s ON s.id = g.subject_id
    JOIN sms.students st ON st.id = g.student_id
    WHERE st.subject_combination IS NOT NULL  -- S5/S6 students only
      AND g.academic_year = p_academic_year
      AND g.term = p_term
  )
  UPDATE sms.grades
  SET
    grade = grade_updates.new_grade,
    subject_type = grade_updates.determined_subject_type,
    uace_points = sms.grade_to_points(
      grade_updates.new_grade,
      grade_updates.determined_subject_type
    ),
    descriptor = grade_updates.new_grade  -- Placeholder; can add descriptor mapping later
  FROM grade_updates
  WHERE sms.grades.id = grade_updates.id;

  GET DIAGNOSTICS v_debug_count = ROW_COUNT;
  RAISE NOTICE 'Updated % grade records', v_debug_count;

  -- STEP 2: Calculate total UACE points (sum of best 3 principal subjects per student)
  WITH principal_grades AS (
    SELECT
      g.student_id,
      g.uace_points,
      ROW_NUMBER() OVER (
        PARTITION BY g.student_id
        ORDER BY g.uace_points DESC
      ) AS rank
    FROM sms.grades g
    WHERE g.academic_year = p_academic_year
      AND g.term = p_term
      AND g.subject_type = 'principal'
      AND EXISTS (
        SELECT 1 FROM sms.students st
        WHERE st.id = g.student_id
          AND st.subject_combination IS NOT NULL
      )
  ),
  student_totals AS (
    SELECT
      student_id,
      COALESCE(SUM(uace_points), 0) AS total_points
    FROM principal_grades
    WHERE rank <= 3
    GROUP BY student_id
  )
  UPDATE sms.students
  SET total_uace_points = student_totals.total_points
  FROM student_totals
  WHERE sms.students.id = student_totals.student_id;

  GET DIAGNOSTICS v_debug_count = ROW_COUNT;
  RAISE NOTICE 'Updated % student records with total UACE points', v_debug_count;

  RAISE NOTICE 'UACE calculation completed for academic year %, term %', p_academic_year, p_term;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error in calculate_s5_s6_uace_grades: %', SQLERRM;
END;
$$;

-- ============================================================================
-- 5. VERIFICATION QUERY (for testing/debugging)
-- ============================================================================
-- Use this query to verify the results after running the procedure:
/*
SELECT
  st.admission_number,
  st.full_name,
  st.subject_combination,
  st.total_uace_points,
  subj.subject_name,
  g.grade,
  g.subject_type,
  g.uace_points,
  g.final_score
FROM sms.students st
JOIN sms.grades g ON g.student_id = st.id
JOIN sms.subjects subj ON subj.id = g.subject_id
WHERE st.subject_combination IS NOT NULL
  AND g.academic_year = [YEAR]
  AND g.term = [TERM]
ORDER BY st.full_name, subj.subject_name;
*/
