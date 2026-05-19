-- CREATE ALL TABLES WITH PROPER SCHEMA
-- Run this after deleting all tables

-- Classes table
CREATE TABLE sms.classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    term TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Streams table
CREATE TABLE sms.streams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    class_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE
);

-- Subjects table
CREATE TABLE sms.subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    class_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE
);

-- Teachers table
CREATE TABLE sms.teachers (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    gender TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teachers class assignments table
CREATE TABLE sms.teachers_class (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    class_teacher_class_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (teacher_id) REFERENCES sms.teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_teacher_class_id) REFERENCES sms.classes(id) ON DELETE CASCADE
);

-- Students table
CREATE TABLE sms.students (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    date_of_birth DATE,
    class_id TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    schoolpay_code TEXT UNIQUE NOT NULL,
    guardian_name TEXT,
    guardian_phone TEXT,
    subject_combination TEXT,
    photo_url TEXT,
    status TEXT DEFAULT 'active',
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE
);

-- Teacher subjects table
CREATE TABLE sms.teacher_subjects (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (teacher_id) REFERENCES sms.teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES sms.subjects(id) ON DELETE CASCADE
);

-- Grades table
CREATE TABLE sms.grades (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    stream_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    term TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    score DECIMAL(5,2),
    grade TEXT,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (student_id) REFERENCES sms.students(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_id) REFERENCES sms.teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (class_id) REFERENCES sms.classes(id) ON DELETE CASCADE,
    FOREIGN KEY (stream_id) REFERENCES sms.streams(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES sms.subjects(id) ON DELETE CASCADE
);

-- Insert default classes
INSERT INTO sms.classes (id, name, academic_year, term) VALUES
('s1', 'S1', '2025', '1'),
('s2', 'S2', '2025', '1'),
('s3', 'S3', '2025', '1'),
('s4', 'S4', '2025', '1'),
('s5', 'S5', '2025', '1'),
('s6', 'S6', '2025', '1');

-- Insert default streams
INSERT INTO sms.streams (id, name, class_id) VALUES
('s1-b', 'B', 's1'),
('s1-c', 'C', 's1'),
('s2-b', 'B', 's2'),
('s2-c', 'C', 's2'),
('s3-b', 'B', 's3'),
('s3-c', 'C', 's3'),
('s4-b', 'B', 's4'),
('s4-c', 'C', 's4'),
('s5-arts', 'Arts', 's5'),
('s5-sciences', 'Sciences', 's5'),
('s6-arts', 'Arts', 's6'),
('s6-sciences', 'Sciences', 's6');

-- Insert default subjects
INSERT INTO sms.subjects (id, name, class_id) VALUES
('math', 'Mathematics', NULL),
('english', 'English Language', NULL),
('physics', 'Physics', 's5'),
('chemistry', 'Chemistry', 's5'),
('biology', 'Biology', 's5'),
('history', 'History', 's5'),
('geography', 'Geography', 's5'),
('literature', 'Literature', 's5');
