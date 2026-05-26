-- Migration: S5/S6 A-Level weighted assessment pipeline
-- Adds support for storing MOT/EOT per paper and computes UACE grades from weighted paper scores.

-- 1. Ensure grade_papers stores assessment type
ALTER TABLE sms.grade_papers
ADD COLUMN IF NOT EXISTS assessment_type TEXT CHECK (assessment_type IN ('MOT', 'EOT'));

COMMENT ON COLUMN sms.grade_papers.assessment_type IS 'Indicates whether the paper score is from MOT or EOT';

-- 2. UNEB code helper for weighted paper percentages
CREATE OR REPLACE FUNCTION sms.uneb_code_from_score(score INT)
RETURNS TEXT AS $$
BEGIN
  IF score >= 85 THEN
    RETURN 'D1';
  ELSIF score >= 80 THEN
    RETURN 'D2';
  ELSIF score >= 75 THEN
    RETURN 'C3';
  ELSIF score >= 70 THEN
    RETURN 'C4';
  ELSIF score >= 65 THEN
    RETURN 'C5';
  ELSIF score >= 60 THEN
    RETURN 'C6';
  ELSIF score >= 50 THEN
    RETURN 'P7';
  ELSIF score >= 40 THEN
    RETURN 'P8';
  ELSE
    RETURN 'F9';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Resolve A-Level subject grade from UNEB paper codes
CREATE OR REPLACE FUNCTION sms.resolve_alevel_subject_grade(
  paper_codes TEXT[],
  paper_count INT
)
RETURNS TEXT AS $$
DECLARE
  num_d INT := 0;
  num_c INT := 0;
  num_p INT := 0;
  num_f INT := 0;
  has_c3 BOOLEAN := FALSE;
  has_c4 BOOLEAN := FALSE;
  has_c5 BOOLEAN := FALSE;
  has_c6 BOOLEAN := FALSE;
  code TEXT;
BEGIN
  FOREACH code IN ARRAY paper_codes LOOP
    IF code LIKE 'D%' THEN
      num_d := num_d + 1;
    ELSIF code LIKE 'C%' THEN
      num_c := num_c + 1;
      IF code = 'C3' THEN
        has_c3 := TRUE;
      ELSIF code = 'C4' THEN
        has_c4 := TRUE;
      ELSIF code = 'C5' THEN
        has_c5 := TRUE;
      ELSIF code = 'C6' THEN
        has_c6 := TRUE;
      END IF;
    ELSIF code LIKE 'P%' THEN
      num_p := num_p + 1;
    ELSE
      num_f := num_f + 1;
    END IF;
  END LOOP;

  IF paper_count = 3 THEN
    IF num_d >= 2 AND has_c3 THEN
      RETURN 'A';
    ELSIF num_d >= 1 AND num_c >= 2 THEN
      RETURN 'B';
    ELSIF num_c = 3 THEN
      RETURN 'C';
    ELSIF num_c >= 1 AND num_p >= 1 AND num_f = 0 THEN
      RETURN 'D';
    ELSIF num_p >= 2 AND num_f <= 1 THEN
      RETURN 'E';
    ELSIF num_f = 2 AND (num_d = 1 OR num_c = 1) THEN
      RETURN 'O';
    ELSE
      RETURN 'F';
    END IF;
  ELSE
    IF num_d = 2 OR (num_d = 1 AND (has_c3 OR has_c4)) THEN
      RETURN 'A';
    ELSIF (num_d = 1 AND (has_c5 OR has_c6))
           OR (num_c = 2 AND (has_c3 OR has_c4)) THEN
      RETURN 'B';
    ELSIF num_c = 2 THEN
      RETURN 'C';
    ELSIF num_c = 1 AND num_p = 1 THEN
      RETURN 'D';
    ELSIF num_p = 2 THEN
      RETURN 'E';
    ELSIF num_f = 1 AND (num_d = 1 OR num_c = 1) THEN
      RETURN 'O';
    ELSE
      RETURN 'F';
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Descriptor helper for A-Level letter grades
CREATE OR REPLACE FUNCTION sms.get_alevel_descriptor(letter TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE letter
    WHEN 'A' THEN RETURN 'Exceptional';
    WHEN 'B' THEN RETURN 'Outstanding';
    WHEN 'C' THEN RETURN 'Satisfactory';
    WHEN 'D' THEN RETURN 'Basic';
    WHEN 'E' THEN RETURN 'Elementary';
    WHEN 'O' THEN RETURN 'Substandard';
    ELSE RETURN 'Fail';
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Main A-Level pipeline: compute final score, letter grade, UACE points, and total student points
CREATE OR REPLACE PROCEDURE sms.calculate_s5_s6_uace_grades(
  p_academic_year INT,
  p_term INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_grades INT := 0;
BEGIN
  WITH raw_paper_scores AS (
    SELECT
      gp.grade_id,
      gp.paper_number,
      MAX(CASE WHEN gp.assessment_type = 'MOT' THEN gp.score END) AS mot_score,
      MAX(CASE WHEN gp.assessment_type = 'EOT' THEN gp.score END) AS eot_score
    FROM sms.grade_papers gp
    GROUP BY gp.grade_id, gp.paper_number
  ),
  weighted_papers AS (
    SELECT
      ps.grade_id,
      ps.paper_number,
      ROUND(
        COALESCE(ps.mot_score, 0) * 0.40 +
        COALESCE(ps.eot_score, 0) * 0.60
      )::INT AS weighted_score
    FROM raw_paper_scores ps
  ),
  grade_aggregates AS (
    SELECT
      g.id AS grade_id,
      g.student_id,
      s.subject_name,
      s.paper_count,
      s.subject_type,
      ARRAY_AGG(sms.uneb_code_from_score(wp.weighted_score) ORDER BY wp.paper_number) AS paper_codes,
      ROUND(AVG(wp.weighted_score))::INT AS final_score,
      sms.resolve_alevel_subject_grade(
        ARRAY_AGG(sms.uneb_code_from_score(wp.weighted_score) ORDER BY wp.paper_number),
        s.paper_count
      ) AS subject_grade
    FROM sms.grades g
    JOIN sms.subjects s ON s.id = g.subject_id
    JOIN sms.students st ON st.id = g.student_id
    JOIN weighted_papers wp ON wp.grade_id = g.id
    WHERE st.subject_combination IS NOT NULL
      AND g.academic_year = p_academic_year
      AND g.term = p_term
    GROUP BY g.id, g.student_id, s.subject_name, s.paper_count, s.subject_type
  )
  UPDATE sms.grades gr
  SET
    final_score = ga.final_score,
    grade = ga.subject_grade,
    descriptor = sms.get_alevel_descriptor(ga.subject_grade),
    subject_type = ga.subject_type,
    uace_points = sms.grade_to_points(ga.subject_grade, ga.subject_type)
  FROM grade_aggregates ga
  WHERE gr.id = ga.grade_id;

  GET DIAGNOSTICS v_updated_grades = ROW_COUNT;
  RAISE NOTICE 'A-Level weighted pipeline updated % grade rows', v_updated_grades;

  WITH principal_points AS (
    SELECT
      g.student_id,
      g.uace_points,
      ROW_NUMBER() OVER (PARTITION BY g.student_id ORDER BY g.uace_points DESC) AS rn
    FROM sms.grades g
    JOIN sms.students st ON st.id = g.student_id
    WHERE g.academic_year = p_academic_year
      AND g.term = p_term
      AND st.subject_combination IS NOT NULL
      AND g.subject_type = 'principal'
  ),
  student_totals AS (
    SELECT student_id, COALESCE(SUM(uace_points), 0) AS total_points
    FROM principal_points
    WHERE rn <= 3
    GROUP BY student_id
  )
  UPDATE sms.students st
  SET total_uace_points = COALESCE(stt.total_points, 0)
  FROM student_totals stt
  WHERE st.id = stt.student_id;

  RAISE NOTICE 'A-Level weighted pipeline completed for year %, term %', p_academic_year, p_term;
END;
$$;

-- 6. Verification query example
-- SELECT st.admission_number, st.full_name, st.subject_combination, st.total_uace_points,
--        subj.name AS subject_name, g.final_score, g.grade, g.uace_points, g.subject_type
-- FROM sms.students st
-- JOIN sms.grades g ON g.student_id = st.id
-- JOIN sms.subjects subj ON subj.id = g.subject_id
-- WHERE st.subject_combination IS NOT NULL
--   AND g.academic_year = 2026
--   AND g.term = 1
-- ORDER BY st.full_name, subj.name;
