-- =============================================
-- FIX published_reports table missing columns
-- =============================================
ALTER TABLE sms.published_reports 
ADD COLUMN IF NOT EXISTS class_id TEXT,
ADD COLUMN IF NOT EXISTS stream_id TEXT;
