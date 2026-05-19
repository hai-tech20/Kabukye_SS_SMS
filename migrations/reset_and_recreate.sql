-- COMPLETE RESET AND RECREATE MIGRATION
-- This will drop and recreate the problematic table, then add all missing pieces

-- Step 1: Drop the problematic grading_scales table if it exists
DROP TABLE IF EXISTS sms.grading_scales;

-- Step 2: Recreate grading_scales table with all columns
CREATE TABLE sms.grading_scales (
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

-- Step 3: Create other missing tables
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

CREATE TABLE IF NOT EXISTS sms.published_reports (
    id TEXT PRIMARY KEY,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    class_id TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    published_by TEXT NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Add missing columns to existing tables
ALTER TABLE sms.grades 
ADD COLUMN IF NOT EXISTS bot_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS mot_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS eot_score DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS assessment_count INTEGER DEFAULT 3;

ALTER TABLE sms.teachers 
ADD COLUMN IF NOT EXISTS teacher_code TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'teacher',
ADD COLUMN IF NOT EXISTS is_class_teacher BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS class_teacher_class_id TEXT,
ADD COLUMN IF NOT EXISTS class_teacher_stream_id TEXT;

-- Step 5: Add constraints (only if they don't exist)
DO $$
BEGIN
    -- Add unique constraint for teacher_code only if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'teachers_teacher_code_key' 
        AND table_name = 'teachers'
        AND table_schema = 'sms'
    ) THEN
        ALTER TABLE sms.teachers 
        ADD CONSTRAINT teachers_teacher_code_key UNIQUE (teacher_code);
    END IF;
    
    -- Add foreign keys for teachers only if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'teachers_class_teacher_class_id_fkey' 
        AND table_name = 'teachers'
        AND table_schema = 'sms'
    ) THEN
        ALTER TABLE sms.teachers 
        ADD CONSTRAINT teachers_class_teacher_class_id_fkey 
        FOREIGN KEY (class_teacher_class_id) REFERENCES sms.classes(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'teachers_class_teacher_stream_id_fkey' 
        AND table_name = 'teachers'
        AND table_schema = 'sms'
    ) THEN
        ALTER TABLE sms.teachers 
        ADD CONSTRAINT teachers_class_teacher_stream_id_fkey 
        FOREIGN KEY (class_teacher_stream_id) REFERENCES sms.streams(id) ON DELETE SET NULL;
    END IF;
    
    -- Add foreign keys for published_reports only if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'published_reports_class_id_fkey' 
        AND table_name = 'published_reports'
        AND table_schema = 'sms'
    ) THEN
        ALTER TABLE sms.published_reports 
        ADD CONSTRAINT published_reports_class_id_fkey 
        FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'published_reports_stream_id_fkey' 
        AND table_name = 'published_reports'
        AND table_schema = 'sms'
    ) THEN
        ALTER TABLE sms.published_reports 
        ADD CONSTRAINT published_reports_stream_id_fkey 
        FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 6: Insert all data
-- Insert default report settings
INSERT INTO sms.report_settings (id, academic_year, term, bot_weight, mot_weight, eot_weight, assessment_count, is_published) 
VALUES ('default-2025-1', '2025', '1', 30.00, 30.00, 40.00, 3, false)
ON CONFLICT (id) DO NOTHING;

-- Insert S1-S4 grading scales
INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, class_level) VALUES
('s1-s4-a', 'A', 'Exceptional - Applies knowledge creatively and innovatively in real-life scenarios', 80.00, 100.00, 'O-LEVEL'),
('s1-s4-b', 'B', 'Outstanding - High level of competency; effectively applies skills in real-world situations', 70.00, 79.99, 'O-LEVEL'),
('s1-s4-c', 'C', 'Satisfactory - Adequate competency; applies skills but not at an advanced level', 60.00, 69.99, 'O-LEVEL'),
('s1-s4-d', 'D', 'Basic - Minimum level of competency required for real-life application', 50.00, 59.99, 'O-LEVEL'),
('s1-s4-e', 'E', 'Elementary - Below basic competency; struggles to apply knowledge effectively', 0.00, 49.99, 'O-LEVEL')
ON CONFLICT (id) DO NOTHING;

-- Insert S5-S6 grading scales
INSERT INTO sms.grading_scales (id, grade, descriptor, min_score, max_score, points, class_level) VALUES
('s5-s6-d1', 'D1', 'Distinction 1', 85.00, 100.00, 1, 'A-LEVEL'),
('s5-s6-d2', 'D2', 'Distinction 2', 80.00, 84.99, 2, 'A-LEVEL'),
('s5-s6-c3', 'C3', 'Credit 3', 75.00, 79.99, 3, 'A-LEVEL'),
('s5-s6-c4', 'C4', 'Credit 4', 70.00, 74.99, 4, 'A-LEVEL'),
('s5-s6-c5', 'C5', 'Credit 5', 65.00, 69.99, 5, 'A-LEVEL'),
('s5-s6-c6', 'C6', 'Credit 6', 60.00, 64.99, 6, 'A-LEVEL'),
('s5-s6-p7', 'P7', 'Pass 7', 50.00, 59.99, 7, 'A-LEVEL'),
('s5-s6-p8', 'P8', 'Pass 8', 40.00, 49.99, 8, 'A-LEVEL'),
('s5-s6-f9', 'F9', 'Fail 9', 0.00, 39.99, 9, 'A-LEVEL')
ON CONFLICT (id) DO NOTHING;

-- Insert admin user
INSERT INTO sms.teachers (id, full_name, email, password_hash, role, teacher_code) 
VALUES ('admin-001', 'System Administrator', 'haithamgates@gmail.com', '$2b$10$4ORM6PteHfYa/yJV1OLWKu2yH9pTZVKx/DZ02b2/JXdoeH2SSIhJ2', 'admin', 'ADMIN001')
ON CONFLICT (email) DO NOTHING;
