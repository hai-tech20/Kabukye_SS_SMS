-- Migration: Fix grade_papers unique constraint for separate MOT/EOT rows
-- This migration updates the grade_papers table to allow multiple rows per grade_id and paper_number
-- as long as assessment_type is distinct.

ALTER TABLE IF EXISTS sms.grade_papers
ADD COLUMN IF NOT EXISTS assessment_type TEXT CHECK (assessment_type IN ('MOT', 'EOT'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'sms'
      AND table_name = 'grade_papers'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'grade_papers_grade_id_paper_number_assessment_type_key'
  ) THEN
    ALTER TABLE sms.grade_papers
      DROP CONSTRAINT IF EXISTS grade_papers_grade_id_paper_number_key;

    ALTER TABLE sms.grade_papers
      ADD CONSTRAINT grade_papers_grade_id_paper_number_assessment_type_key
      UNIQUE (grade_id, paper_number, assessment_type);
  END IF;
END $$;
