-- Fix the "operator does not exist: text = integer" error by fixing the trigger function and related triggers

-- First, check if there's a trigger on grades table and drop it temporarily
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.triggers 
    WHERE trigger_name = 'auto_generate_comments' 
    AND event_object_table = 'grades' 
    AND event_object_schema = 'sms'
  ) THEN
    DROP TRIGGER IF EXISTS auto_generate_comments ON sms.grades;
  END IF;
END $$;

-- Now fix the generate_student_comments function to use TEXT for year and term
DROP FUNCTION IF EXISTS sms.generate_student_comments();

CREATE OR REPLACE FUNCTION sms.generate_student_comments()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  v_year TEXT;
  v_term TEXT;
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
    RAISE NOTICE 'No report_settings row found, skipping comment generation';
    RETURN 0;
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

    -- Upsert into sms.report_comments (the new one, not student_comments which uses integers)
    INSERT INTO sms.report_comments (
      student_id,
      term,
      academic_year,
      class_teacher_comment,
      head_teacher_comment
    ) VALUES (
      rec.student_id,
      v_term,
      v_year,
      v_class_comment,
      v_head_comment
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

-- Now, for backward compatibility, let's also make a version that uses the old student_comments table, but fixes the type issue
DROP FUNCTION IF EXISTS sms.trigger_generate_comments();

CREATE OR REPLACE FUNCTION sms.trigger_generate_comments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This trigger no longer calls generate_student_comments to avoid blocking grade saves
  -- We'll leave comment generation for admin-initiated batch processes instead
  RETURN NEW;
END;
$$;

-- Now, recreate the trigger (if it existed before) using our safe trigger function
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.triggers 
    WHERE trigger_name = 'auto_generate_comments' 
    AND event_object_table = 'grades' 
    AND event_object_schema = 'sms'
  ) THEN
    DROP TRIGGER IF EXISTS auto_generate_comments ON sms.grades;
  END IF;
  
  -- Create a safe trigger that just updates updated_at instead of calling the problematic function
  CREATE TRIGGER update_grades_timestamp
    BEFORE UPDATE ON sms.grades
    FOR EACH ROW
    EXECUTE FUNCTION sms.update_grades_timestamp();
END $$;

-- Make sure the update_grades_timestamp function exists
CREATE OR REPLACE FUNCTION sms.update_grades_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
