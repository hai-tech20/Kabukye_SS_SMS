-- Drop and recreate sms.generate_student_comments to fix type casting errors
-- This function determines class and head teacher comments for students
-- based on S1-S4 average final_score or S5-S6 total_uace_points.

DROP FUNCTION IF EXISTS sms.generate_student_comments();

CREATE OR REPLACE FUNCTION sms.generate_student_comments()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  v_year INTEGER;
  v_term INTEGER;
  v_avg_score INTEGER;
  v_points INTEGER;
  v_class_comment TEXT;
  v_head_comment TEXT;
  v_count INTEGER := 0;
BEGIN
  -- Determine current report settings (most recent)
  SELECT academic_year, term
  INTO v_year, v_term
  FROM sms.report_settings
  ORDER BY academic_year DESC, term DESC
  LIMIT 1;

  IF v_year IS NULL OR v_term IS NULL THEN
    RAISE EXCEPTION 'No report_settings row found to determine current academic_year and term';
  END IF;

  FOR rec IN
    SELECT st.id as student_id, st.subject_combination, COALESCE(st.total_uace_points,0) AS total_uace_points
    FROM sms.students st
    JOIN sms.classes c ON c.id = st.class_id
    WHERE st.class_id IS NOT NULL
  LOOP
    -- Reset comments
    v_class_comment := NULL;
    v_head_comment := NULL;

    IF rec.subject_combination IS NULL THEN
      -- S1-S4: compute average final_score for this student for current year/term
      SELECT COALESCE(ROUND(AVG(g.final_score))::INT, 0)
      INTO v_avg_score
      FROM sms.grades g
      WHERE g.student_id = rec.student_id
        AND g.academic_year = v_year
        AND g.term = v_term;

      -- Map average score to comments
      IF v_avg_score BETWEEN 0 AND 39 THEN
        v_class_comment := 'Needs practice';
        v_head_comment := 'Requires support';
      ELSIF v_avg_score BETWEEN 40 AND 49 THEN
        v_class_comment := 'More effort is needed';
        v_head_comment := 'Fair performance';
      ELSIF v_avg_score BETWEEN 50 AND 59 THEN
        v_class_comment := 'More effort is needed';
        v_head_comment := 'Quite good';
      ELSIF v_avg_score BETWEEN 60 AND 69 THEN
        v_class_comment := 'Can do better than this';
        v_head_comment := 'Above average';
      ELSIF v_avg_score BETWEEN 70 AND 79 THEN
        v_class_comment := 'Good performance';
        v_head_comment := 'Very good performance';
      ELSIF v_avg_score BETWEEN 80 AND 100 THEN
        v_class_comment := 'Perfect, keep it up';
        v_head_comment := 'Excellent, keep it up';
      ELSE
        v_class_comment := 'Needs assessment';
        v_head_comment := 'Needs assessment';
      END IF;

    ELSE
      -- S5-S6: use total_uace_points
      v_points := COALESCE(rec.total_uace_points, 0);

      IF v_points BETWEEN 1 AND 5 THEN
        v_class_comment := 'Improve on the weak areas';
        v_head_comment := 'Work harder';
      ELSIF v_points BETWEEN 6 AND 9 THEN
        v_class_comment := 'More effort is needed';
        v_head_comment := 'Can do better than this';
      ELSIF v_points BETWEEN 10 AND 15 THEN
        v_class_comment := 'Promising results';
        v_head_comment := 'Quite good performance';
      ELSIF v_points BETWEEN 16 AND 20 THEN
        v_class_comment := 'Very good performance';
        v_head_comment := 'Excellent performance';
      ELSE
        v_class_comment := 'Needs assessment';
        v_head_comment := 'Needs assessment';
      END IF;
    END IF;

    -- Upsert into sms.student_comments with explicit casts
    INSERT INTO sms.student_comments (
      student_id,
      term,
      academic_year,
      class_teacher_comment,
      head_teacher_comment
    ) VALUES (
      rec.student_id::uuid,
      v_term::integer,
      v_year::integer,
      v_class_comment::text,
      v_head_comment::text
    )
    ON CONFLICT (student_id, term, academic_year)
    DO UPDATE SET
      class_teacher_comment = EXCLUDED.class_teacher_comment,
      head_teacher_comment = EXCLUDED.head_teacher_comment;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Immediately execute the function
-- SELECT sms.generate_student_comments();
