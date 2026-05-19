-- ONLY MISSING TABLES AND EDITS FOR EXISTING DATABASE
-- Run this to add only what's missing and edit necessary columns

-- Add missing tables that don't exist
CREATE TABLE IF NOT EXISTS sms.report_settings (
    id TEXT PRIMARY KEY,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    bot_weight DECIMAL(5,2) DEFAULT 30.00,
    mot_weight DECIMAL(5,2) DEFAULT 30.00,
    eot_weight DECIMAL(5,2) DEFAULT 40.00,
    assessment_count INTEGER DEFAULT 3,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms.grading_scales (
    id TEXT PRIMARY KEY,
    grade TEXT NOT NULL,
    descriptor TEXT NOT NULL,
    min_score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) NOT NULL,
    points INTEGER,
    class_level TEXT DEFAULT 'O-LEVEL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms.published_reports (
    id TEXT PRIMARY KEY,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    class_id TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    published_by TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE
);

-- Edit existing tables to add missing columns
ALTER TABLE sms.grades 
ADD COLUMN IF NOT EXISTS bot_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS mot_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS eot_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS assessment_count INTEGER DEFAULT 3;

ALTER TABLE sms.teachers 
ADD COLUMN IF NOT EXISTS teacher_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'teacher',
ADD COLUMN IF NOT EXISTS is_class_teacher BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS class_teacher_class_id TEXT,
ADD COLUMN IF NOT EXISTS class_teacher_stream_id TEXT;

-- Add foreign key constraints for new columns (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_teacher_class' 
                   AND table_name = 'teachers') THEN
        ALTER TABLE sms.teachers 
        ADD CONSTRAINT fk_teacher_class FOREIGN KEY (class_teacher_class_id) REFERENCES sms.classes(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_teacher_stream' 
                   AND table_name = 'teachers') THEN
        ALTER TABLE sms.teachers 
        ADD CONSTRAINT fk_teacher_stream FOREIGN KEY (class_teacher_stream_id) REFERENCES sms.streams(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Insert default report settings (only if not exists)
INSERT INTO sms.report_settings (id, academic_year, term, bot_weight, mot_weight, eot_weight, assessment_count, is_published) 
SELECT 'default-2025-1', '2025', '1', 30.00, 30.00, 40.00, 3, false
WHERE NOT EXISTS (SELECT 1 FROM sms.report_settings WHERE id = 'default-2025-1');

-- Insert S1-S4 grading scales (only if not exist)
INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, class_level) 
SELECT 's1-s4-a', 'A', 'Exceptional - Applies knowledge creatively and innovatively in real-life scenarios', 80.00, 100.00, 'O-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's1-s4-a');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, class_level) 
SELECT 's1-s4-b', 'B', 'Outstanding - High level of competency; effectively applies skills in real-world situations', 70.00, 79.99, 'O-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's1-s4-b');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, class_level) 
SELECT 's1-s4-c', 'C', 'Satisfactory - Adequate competency; applies skills but not at an advanced level', 60.00, 69.99, 'O-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's1-s4-c');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, class_level) 
SELECT 's1-s4-d', 'D', 'Basic - Minimum level of competency required for real-life application', 50.00, 59.99, 'O-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's1-s4-d');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, class_level) 
SELECT 's1-s4-e', 'E', 'Elementary - Below basic competency; struggles to apply knowledge effectively', 0.00, 49.99, 'O-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's1-s4-e');

-- Insert S5-S6 grading scales (only if not exist)
INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-d1', 'D1', 'Distinction 1', 85.00, 100.00, 1, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-d1');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-d2', 'D2', 'Distinction 2', 80.00, 84.99, 2, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-d2');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-c3', 'C3', 'Credit 3', 75.00, 79.99, 3, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-c3');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-c4', 'C4', 'Credit 4', 70.00, 74.99, 4, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-c4');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-c5', 'C5', 'Credit 5', 65.00, 69.99, 5, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-c5');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-c6', 'C6', 'Credit 6', 60.00, 64.99, 6, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-c6');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-p7', 'P7', 'Pass 7', 50.00, 59.99, 7, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-p7');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-p8', 'P8', 'Pass 8', 40.00, 49.99, 8, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-p8');

INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) 
SELECT 's5-s6-f9', 'F9', 'Fail 9', 0.00, 39.99, 9, 'A-LEVEL'
WHERE NOT EXISTS (SELECT 1 FROM sms.grading_scales WHERE id = 's5-s6-f9');

-- Insert admin user (only if not exists)
INSERT INTO sms.teachers (id, full_name, email, password_hash, role, status, teacher_code) 
SELECT 'admin-001', 'System Administrator', 'haithamgates@gmail.com', '$2b$10$4ORM6PteHfYa/yJV1OLWKu2yH9pTZVKx/DZ02b2/JXdoeH2SSIhJ2', 'admin', 'active', 'ADMIN001'
WHERE NOT EXISTS (SELECT 1 FROM sms.teachers WHERE email = 'haithamgates@gmail.com');
