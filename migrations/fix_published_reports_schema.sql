-- =============================================
-- FIX published_reports table missing columns
-- =============================================
ALTER TABLE sms.published_reports 
ADD COLUMN IF NOT EXISTS class_id TEXT,
ADD COLUMN IF NOT EXISTS stream_id TEXT;

-- Make sure the columns are nullable
ALTER TABLE sms.published_reports
ALTER COLUMN class_id DROP NOT NULL,
ALTER COLUMN stream_id DROP NOT NULL;
