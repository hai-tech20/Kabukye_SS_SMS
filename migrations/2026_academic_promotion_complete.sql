-- Kabukye SMS: Academic Year, Terms, Promotion (v2)
-- Run in Supabase SQL Editor after existing sms schema exists.
-- Prerequisites: sms.classes (with next_class_id), sms.students, sms.grades, sms.subjects,
--                sms.academic_years, sms.terms (from prior migrations) OR created below.
--
-- year_label must be a 4-digit year string (e.g. '2026') for rollover arithmetic.

-- ---------------------------------------------------------------------------
-- 1) Grades: final computed score + descriptor (for accurate snapshots)
-- ---------------------------------------------------------------------------
ALTER TABLE sms.grades
  ADD COLUMN IF NOT EXISTS final_score DECIMAL(7,2),
  ADD COLUMN IF NOT EXISTS descriptor TEXT;

COMMENT ON COLUMN sms.grades.final_score IS 'Weighted final % (BOT/MOT/EOT); mirrors app calculation';

-- ---------------------------------------------------------------------------
-- 2) Fee balances per student / year / term (reset on year close)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sms.student_term_fee_balances (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT NOT NULL REFERENCES sms.students(id) ON DELETE CASCADE,
  academic_year_id TEXT NOT NULL REFERENCES sms.academic_years(id) ON DELETE CASCADE,
  term_number INTEGER NOT NULL CHECK (term_number IN (1, 2, 3)),
  balance_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'UGX',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, academic_year_id, term_number)
);

CREATE INDEX IF NOT EXISTS idx_student_term_fee_student ON sms.student_term_fee_balances(student_id);
CREATE INDEX IF NOT EXISTS idx_student_term_fee_year ON sms.student_term_fee_balances(academic_year_id);

-- ---------------------------------------------------------------------------
-- 3) Timetables: allow school-wide (no stream)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'sms' AND table_name = 'timetables' AND column_name = 'stream_id'
  ) THEN
    ALTER TABLE sms.timetables ALTER COLUMN stream_id DROP NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Ensure class progression chain (idempotent)
-- ---------------------------------------------------------------------------
UPDATE sms.classes SET next_class_id = 's2' WHERE id = 's1' AND (next_class_id IS DISTINCT FROM 's2');
UPDATE sms.classes SET next_class_id = 's3' WHERE id = 's2' AND (next_class_id IS DISTINCT FROM 's3');
UPDATE sms.classes SET next_class_id = 's4' WHERE id = 's3' AND (next_class_id IS DISTINCT FROM 's4');
UPDATE sms.classes SET next_class_id = 's5' WHERE id = 's4' AND (next_class_id IS DISTINCT FROM 's5');
UPDATE sms.classes SET next_class_id = 's6' WHERE id = 's5' AND (next_class_id IS DISTINCT FROM 's6');
UPDATE sms.classes SET next_class_id = NULL WHERE id = 's6';

-- ---------------------------------------------------------------------------
-- 5) Sync term status from dates (Kampala calendar date)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sms.sync_term_statuses_for_current_year()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sms, public
AS $$
DECLARE
  y sms.academic_years%ROWTYPE;
  today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date;
  updated INT := 0;
BEGIN
  SELECT * INTO y FROM sms.academic_years WHERE is_current = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No current academic year');
  END IF;

  UPDATE sms.terms t
  SET
    status = CASE
      WHEN today > t.end_date THEN 'Completed'
      WHEN today >= t.start_date AND today <= t.end_date THEN 'Active'
      ELSE 'Upcoming'
    END,
    updated_at = NOW()
  WHERE t.year_id = y.id;

  GET DIAGNOSTICS updated = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'terms_updated', updated);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) can_promote — Term 3 end must be strictly before today (Kampala)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sms.can_promote()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sms, public
AS $$
DECLARE
  y sms.academic_years%ROWTYPE;
  t3 sms.terms%ROWTYPE;
  today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date;
BEGIN
  SELECT * INTO y FROM sms.academic_years WHERE is_current = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_promote', false, 'reason', 'No current academic year');
  END IF;

  SELECT * INTO t3 FROM sms.terms
  WHERE year_id = y.id AND term_number = 3
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_promote', false, 'reason', 'Term 3 is not configured for the current year');
  END IF;

  IF today <= t3.end_date THEN
    RETURN jsonb_build_object(
      'can_promote', false,
      'reason', 'Promotion is only allowed after Term 3 end date (Africa/Kampala)',
      'term_3_end', t3.end_date,
      'today', today
    );
  END IF;

  RETURN jsonb_build_object(
    'can_promote', true,
    'reason', 'Term 3 has ended; you may close the year and promote',
    'term_3_end', t3.end_date,
    'today', today
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) promote_all_students — single transaction, accurate Term 3 grade JSON
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sms.promote_all_students()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sms, public
AS $$
DECLARE
  y sms.academic_years%ROWTYPE;
  t3 sms.terms%ROWTYPE;
  y_next sms.academic_years%ROWTYPE;
  today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Kampala')::date;
  next_label TEXT;
  promoted INT := 0;
  graduated INT := 0;
  archived INT := 0;
  fees_deleted INT := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(98273451, 1);

  SELECT * INTO y FROM sms.academic_years WHERE is_current = true LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_CURRENT_ACADEMIC_YEAR';
  END IF;

  SELECT * INTO t3 FROM sms.terms WHERE year_id = y.id AND term_number = 3 LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TERM_3_NOT_CONFIGURED';
  END IF;

  IF today <= t3.end_date THEN
    RAISE EXCEPTION 'TERM_3_NOT_ENDED';
  END IF;

  next_label := (y.year_label::INTEGER + 1)::TEXT;

  SELECT * INTO y_next FROM sms.academic_years WHERE year_label = next_label LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NEXT_ACADEMIC_YEAR_NOT_CONFIGURED: %', next_label;
  END IF;

  -- Snapshot: one row per active student with aggregated Term 3 grades (accurate subject list)
  INSERT INTO sms.student_history (
    student_id, academic_year, term, class_id, stream_id, final_grades, promotion_status
  )
  SELECT
    s.id,
    y.year_label,
    '3',
    s.class_id,
    s.stream_id,
    COALESCE(agg.grades_json, '[]'::jsonb),
    CASE WHEN c.next_class_id IS NULL THEN 'Graduated' ELSE 'Promoted' END
  FROM sms.students s
  JOIN sms.classes c ON c.id = s.class_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'subject_id', g.subject_id,
        'subject_name', sub.name,
        'final_score', ROUND(COALESCE(g.final_score, g.score)::numeric, 2),
        'grade', g.grade,
        'bot_score', g.bot_score,
        'mot_score', g.mot_score,
        'eot_score', g.eot_score,
        'descriptor', COALESCE(g.descriptor, '')
      ) ORDER BY sub.name
    ) AS grades_json
    FROM sms.grades g
    INNER JOIN sms.subjects sub ON sub.id = g.subject_id
    WHERE g.student_id = s.id
      AND g.academic_year = y.year_label
      AND trim(both from g.term::text) = '3'
  ) agg ON true
  WHERE s.status = 'active';

  GET DIAGNOSTICS archived = ROW_COUNT;

  -- Promote S1–S5 (class has next_class_id)
  UPDATE sms.students s
  SET
    class_id = c.next_class_id,
    status = 'active',
    updated_at = NOW()
  FROM sms.classes c
  WHERE s.class_id = c.id
    AND s.status = 'active'
    AND c.next_class_id IS NOT NULL;

  GET DIAGNOSTICS promoted = ROW_COUNT;

  -- Graduate final class (e.g. S6): no next class
  UPDATE sms.students s
  SET
    status = 'Alumni',
    updated_at = NOW()
  FROM sms.classes c
  WHERE s.class_id = c.id
    AND s.status = 'active'
    AND c.next_class_id IS NULL;

  GET DIAGNOSTICS graduated = ROW_COUNT;

  -- Reset term fee rows for the closing year
  DELETE FROM sms.student_term_fee_balances
  WHERE academic_year_id = y.id;
  GET DIAGNOSTICS fees_deleted = ROW_COUNT;

  -- Close old year terms
  UPDATE sms.terms SET status = 'Completed', updated_at = NOW() WHERE year_id = y.id;

  -- Flip academic year flags
  UPDATE sms.academic_years SET is_current = false, updated_at = NOW() WHERE id = y.id;
  UPDATE sms.academic_years SET is_current = true, updated_at = NOW() WHERE id = y_next.id;

  -- New year: Term 1 active, others upcoming (dates already set by admin)
  UPDATE sms.terms
  SET
    status = CASE term_number
      WHEN 1 THEN 'Active'
      ELSE 'Upcoming'
    END,
    updated_at = NOW()
  WHERE year_id = y_next.id;

  RETURN jsonb_build_object(
    'success', true,
    'closed_year', y.year_label,
    'opened_year', y_next.year_label,
    'archived_rows', archived,
    'promoted_rows', promoted,
    'graduated_rows', graduated,
    'fee_rows_cleared', fees_deleted
  );
END;
$$;

-- Prefer server-side / service role; revoke from anonymous
REVOKE ALL ON FUNCTION sms.promote_all_students() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sms.promote_all_students() TO service_role;

REVOKE ALL ON FUNCTION sms.can_promote() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sms.can_promote() TO service_role;

REVOKE ALL ON FUNCTION sms.sync_term_statuses_for_current_year() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sms.sync_term_statuses_for_current_year() TO service_role;

COMMENT ON FUNCTION sms.promote_all_students IS 'Atomic year close + promotion; requires next academic year row to exist';
