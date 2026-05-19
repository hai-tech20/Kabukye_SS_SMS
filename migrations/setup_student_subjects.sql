-- MIGRATION: Setup Student Subject Assignment System
-- This creates tables and columns needed for assigning subjects to students

-- 1. Add subject_type column to subjects table (principal, subsidiary, compulsory)
ALTER TABLE sms.subjects 
ADD COLUMN IF NOT EXISTS subject_type TEXT DEFAULT 'principal';

-- Update existing subjects with their types
UPDATE sms.subjects SET subject_type = 'compulsory' 
WHERE LOWER(name) LIKE '%general paper%';

UPDATE sms.subjects SET subject_type = 'subsidiary' 
WHERE LOWER(name) LIKE '%sub ict%' 
   OR LOWER(name) LIKE '%sub mathematics%' 
   OR LOWER(name) LIKE '%sub math%';

UPDATE sms.subjects SET subject_type = 'principal' 
WHERE subject_type IS NULL;

-- 2. Create student_subjects table to track which subjects each student offers
CREATE TABLE IF NOT EXISTS sms.student_subjects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    subject_type TEXT NOT NULL, -- 'principal', 'subsidiary', 'compulsory'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES sms.students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES sms.subjects(id) ON DELETE CASCADE,
    UNIQUE(student_id, subject_id)
);

-- 3. Create subject_combinations reference table
CREATE TABLE IF NOT EXISTS sms.subject_combinations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL UNIQUE, -- e.g., 'PCM', 'BCM', 'HEG'
    name TEXT NOT NULL, -- e.g., 'Physics, Chemistry, Mathematics'
    subject1_id TEXT NOT NULL, -- First principal subject
    subject2_id TEXT NOT NULL, -- Second principal subject
    subject3_id TEXT NOT NULL, -- Third principal subject
    category TEXT NOT NULL, -- 'Science', 'Arts', 'Business'
    requires_sub_math BOOLEAN DEFAULT false,
    requires_sub_ict BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Insert common A-Level subject combinations
INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_ict)
SELECT 'PCM', 'Physics, Chemistry, Mathematics', 
       (SELECT id FROM sms.subjects WHERE name = 'Physics' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Chemistry' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Mathematics' LIMIT 1),
       'Science', true
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'PCM');

INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_math)
SELECT 'PCB', 'Physics, Chemistry, Biology',
       (SELECT id FROM sms.subjects WHERE name = 'Physics' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Chemistry' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Biology' LIMIT 1),
       'Science', true
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'PCB');

INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_ict)
SELECT 'BCM', 'Biology, Chemistry, Mathematics',
       (SELECT id FROM sms.subjects WHERE name = 'Biology' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Chemistry' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Mathematics' LIMIT 1),
       'Science', true
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'BCM');

INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_math)
SELECT 'BCA', 'Biology, Chemistry, Agriculture',
       (SELECT id FROM sms.subjects WHERE name = 'Biology' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Chemistry' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Agriculture' LIMIT 1),
       'Science', true
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'BCA');

INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_math)
SELECT 'PEM', 'Physics, Economics, Mathematics',
       (SELECT id FROM sms.subjects WHERE name = 'Physics' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Economics' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Mathematics' LIMIT 1),
       'Science', false
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'PEM');

INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_math)
SELECT 'MEG', 'Mathematics, Economics, Geography',
       (SELECT id FROM sms.subjects WHERE name = 'Mathematics' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Economics' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Geography' LIMIT 1),
       'Business', false
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'MEG');

INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_math)
SELECT 'HEG', 'History, Economics, Geography',
       (SELECT id FROM sms.subjects WHERE name = 'History' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Economics' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Geography' LIMIT 1),
       'Arts', true
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'HEG');

INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_math)
SELECT 'HEL', 'History, Economics, Literature',
       (SELECT id FROM sms.subjects WHERE name = 'History' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Economics' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Literature' LIMIT 1),
       'Arts', true
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'HEL');

INSERT INTO sms.subject_combinations (code, name, subject1_id, subject2_id, subject3_id, category, requires_sub_math)
SELECT 'HLD', 'History, Literature, Divinity',
       (SELECT id FROM sms.subjects WHERE name = 'History' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Literature' LIMIT 1),
       (SELECT id FROM sms.subjects WHERE name = 'Divinity' LIMIT 1),
       'Arts', true
WHERE NOT EXISTS (SELECT 1 FROM sms.subject_combinations WHERE code = 'HLD');

-- 5. Verify the setup
SELECT 'Subjects with types:' as info;
SELECT name, subject_type FROM sms.subjects WHERE class_id IN ('s5', 's6') ORDER BY subject_type, name;

SELECT 'Subject combinations:' as info;
SELECT code, name, category, requires_sub_math, requires_sub_ict 
FROM sms.subject_combinations ORDER BY category, code;
