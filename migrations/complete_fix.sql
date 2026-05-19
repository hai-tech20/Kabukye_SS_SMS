-- COMPLETE DATABASE FIX - ONE SCRIPT TO RULE THEM ALL
-- This drops ALL foreign keys, converts to TEXT, then recreates ALL constraints

-- Step 1: Drop ALL foreign key constraints (add any that are missing)
ALTER TABLE sms.teacher_subjects DROP CONSTRAINT IF EXISTS teacher_subjects_class_id_fkey;
ALTER TABLE sms.teacher_subjects DROP CONSTRAINT IF EXISTS teacher_subjects_stream_id_fkey;
ALTER TABLE sms.teacher_subjects DROP CONSTRAINT IF EXISTS teacher_subjects_subject_id_fkey;
ALTER TABLE sms.teacher_subjects DROP CONSTRAINT IF EXISTS teacher_subjects_teacher_id_fkey;
ALTER TABLE sms.grades DROP CONSTRAINT IF EXISTS grades_student_id_fkey;
ALTER TABLE sms.grades DROP CONSTRAINT IF EXISTS grades_teacher_id_fkey;
ALTER TABLE sms.grades DROP CONSTRAINT IF EXISTS grades_class_id_fkey;
ALTER TABLE sms.grades DROP CONSTRAINT IF EXISTS grades_stream_id_fkey;
ALTER TABLE sms.grades DROP CONSTRAINT IF EXISTS grades_subject_id_fkey;
ALTER TABLE sms.streams DROP CONSTRAINT IF EXISTS streams_class_id_fkey;
ALTER TABLE sms.students DROP CONSTRAINT IF EXISTS students_class_id_fkey;
ALTER TABLE sms.students DROP CONSTRAINT IF EXISTS students_stream_id_fkey;
ALTER TABLE sms.fee_structures DROP CONSTRAINT IF EXISTS fee_structures_class_id_fkey;

-- Step 2: Convert ALL ID columns to TEXT
ALTER TABLE sms.classes ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sms.streams ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sms.streams ALTER COLUMN class_id TYPE TEXT USING class_id::text;
ALTER TABLE sms.students ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sms.students ALTER COLUMN class_id TYPE TEXT USING class_id::text;
ALTER TABLE sms.students ALTER COLUMN stream_id TYPE TEXT USING stream_id::text;
ALTER TABLE sms.teachers ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sms.teacher_subjects ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sms.teacher_subjects ALTER COLUMN teacher_id TYPE TEXT USING teacher_id::text;
ALTER TABLE sms.teacher_subjects ALTER COLUMN class_id TYPE TEXT USING class_id::text;
ALTER TABLE sms.teacher_subjects ALTER COLUMN stream_id TYPE TEXT USING stream_id::text;
ALTER TABLE sms.teacher_subjects ALTER COLUMN subject_id TYPE TEXT USING subject_id::text;
ALTER TABLE sms.grades ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sms.grades ALTER COLUMN student_id TYPE TEXT USING student_id::text;
ALTER TABLE sms.grades ALTER COLUMN teacher_id TYPE TEXT USING teacher_id::text;
ALTER TABLE sms.grades ALTER COLUMN class_id TYPE TEXT USING class_id::text;
ALTER TABLE sms.grades ALTER COLUMN stream_id TYPE TEXT USING stream_id::text;
ALTER TABLE sms.grades ALTER COLUMN subject_id TYPE TEXT USING subject_id::text;
ALTER TABLE sms.subjects ALTER COLUMN id TYPE TEXT USING id::text;
ALTER TABLE sms.fee_structures ALTER COLUMN class_id TYPE TEXT USING class_id::text;

-- Step 3: Add subject combination column
ALTER TABLE sms.students ADD COLUMN IF NOT EXISTS subject_combination TEXT;

-- Step 4: Recreate ALL foreign key constraints with TEXT types
ALTER TABLE sms.teacher_subjects ADD CONSTRAINT teacher_subjects_class_id_fkey 
FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE;
ALTER TABLE sms.teacher_subjects ADD CONSTRAINT teacher_subjects_stream_id_fkey 
FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE;
ALTER TABLE sms.teacher_subjects ADD CONSTRAINT teacher_subjects_subject_id_fkey 
FOREIGN KEY (subject_id) REFERENCES sms.subjects(id) ON DELETE CASCADE;
ALTER TABLE sms.teacher_subjects ADD CONSTRAINT teacher_subjects_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES sms.teachers(id) ON DELETE CASCADE;
ALTER TABLE sms.grades ADD CONSTRAINT grades_student_id_fkey 
FOREIGN KEY (student_id) REFERENCES sms.students(id) ON DELETE CASCADE;
ALTER TABLE sms.grades ADD CONSTRAINT grades_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES sms.teachers(id) ON DELETE CASCADE;
ALTER TABLE sms.grades ADD CONSTRAINT grades_class_id_fkey 
FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE;
ALTER TABLE sms.grades ADD CONSTRAINT grades_stream_id_fkey 
FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE;
ALTER TABLE sms.grades ADD CONSTRAINT grades_subject_id_fkey 
FOREIGN KEY (subject_id) REFERENCES sms.subjects(id) ON DELETE CASCADE;
ALTER TABLE sms.streams ADD CONSTRAINT streams_class_id_fkey 
FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE;
ALTER TABLE sms.students ADD CONSTRAINT students_class_id_fkey 
FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE;
ALTER TABLE sms.students ADD CONSTRAINT students_stream_id_fkey 
FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE;
ALTER TABLE sms.fee_structures ADD CONSTRAINT fee_structures_class_id_fkey 
FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE;
