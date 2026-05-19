-- MIGRATION: Setup Default Report Settings and Grading Scales
-- Run this to configure the system for grade saving

-- 1. Create report_settings table if not exists
CREATE TABLE IF NOT EXISTS sms.report_settings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    mot_weight INTEGER DEFAULT 40,
    eot_weight INTEGER DEFAULT 60,
    assessment_count INTEGER DEFAULT 2,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1b. Clean up any corrupted rows (where id is null)
DELETE FROM sms.report_settings WHERE id IS NULL;

-- 2. Insert default report settings (if none exist)
INSERT INTO sms.report_settings (id, academic_year, term, mot_weight, eot_weight, assessment_count, is_published)
SELECT gen_random_uuid()::text, '2026', '1', 40, 60, 2, true
WHERE NOT EXISTS (SELECT 1 FROM sms.report_settings WHERE is_published = true);

-- 3. Create grading_scales table if not exists
CREATE TABLE IF NOT EXISTS sms.grading_scales (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    grade TEXT NOT NULL,
    min_score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    descriptor TEXT NOT NULL,
    points INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Insert O-Level grading scale (if not exists)
INSERT INTO sms.grading_scales (grade, min_score, max_score, descriptor, points)
SELECT * FROM (VALUES
    ('D1', 80, 100, 'Distinction 1', 1),
    ('D2', 75, 79, 'Distinction 2', 2),
    ('C3', 70, 74, 'Credit 3', 3),
    ('C4', 65, 69, 'Credit 4', 4),
    ('C5', 60, 64, 'Credit 5', 5),
    ('C6', 55, 59, 'Credit 6', 6),
    ('P7', 50, 54, 'Pass 7', 7),
    ('P8', 45, 49, 'Pass 8', 8),
    ('F9', 0, 44, 'Fail', 9)
) AS v(grade, min_score, max_score, descriptor, points)
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE grade = 'D1');

-- 5. Verify settings were created
SELECT 'Report Settings:' as section;
SELECT * FROM sms.report_settings WHERE is_published = true;

SELECT 'Grading Scales:' as section;
SELECT * FROM sms.grading_scales ORDER BY min_score DESC;
