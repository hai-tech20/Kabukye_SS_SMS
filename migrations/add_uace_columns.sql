-- Add UACE-related columns to support A-level grading
-- Run this BEFORE the main UACE calculation procedure

-- Add columns to sms.grades table
ALTER TABLE sms.grades
ADD COLUMN IF NOT EXISTS uace_points INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS subject_type TEXT DEFAULT 'principal';

-- Add total points tracker to sms.students table
ALTER TABLE sms.students
ADD COLUMN IF NOT EXISTS total_uace_points INT DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN sms.grades.uace_points IS 'UACE points for this grade (principal: 0-6, subsidiary/GP: 0-1)';
COMMENT ON COLUMN sms.grades.subject_type IS 'Subject classification: principal, subsidiary, general_paper';
COMMENT ON COLUMN sms.students.total_uace_points IS 'Total UACE points: sum of best 3 principal subjects';
