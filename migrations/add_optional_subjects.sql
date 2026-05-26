-- Migration: Add optional subject assignment table and RLS
-- This migration creates `sms.student_optional_subjects` to store optional
-- subjects assigned to students. Only admins and the class teacher for the
-- student's class are allowed to assign or edit these records. Students can
-- view their own assigned optionals.

-- Create table
CREATE TABLE IF NOT EXISTS sms.student_optional_subjects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    assigned_by TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, subject_id),
    FOREIGN KEY (student_id) REFERENCES sms.students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES sms.subjects(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE sms.student_optional_subjects ENABLE ROW LEVEL SECURITY;

-- Helper function: checks whether current user is admin OR class teacher for the student's class
CREATE OR REPLACE FUNCTION sms.can_manage_optional(p_student_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    _is_admin BOOLEAN;
    _is_class_teacher BOOLEAN;
BEGIN
    -- Check admin role via sms.user_roles
    SELECT EXISTS(
        SELECT 1 FROM sms.user_roles ur
        WHERE ur.user_id = auth.uid()::TEXT AND ur.role = 'admin'
    ) INTO _is_admin;

    IF _is_admin THEN
        RETURN true;
    END IF;

    -- Check if current user is assigned as class teacher for the student's class
    SELECT EXISTS(
        SELECT 1 FROM sms.teachers_class tc
        JOIN sms.students s ON s.class_id = tc.class_teacher_class_id
        WHERE tc.teacher_id = auth.uid()::TEXT AND s.id = p_student_id
    ) INTO _is_class_teacher;

    RETURN COALESCE(_is_class_teacher, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SELECT policy: allow admins, class teachers for that student, the assigned_by user, or the student themselves
CREATE POLICY "Select optional subjects: owner/admin/class-teacher/student" ON sms.student_optional_subjects
    FOR SELECT USING (
        auth.uid()::TEXT = assigned_by
        OR auth.uid()::TEXT = student_id
        OR EXISTS (
            SELECT 1 FROM sms.user_roles ur WHERE ur.user_id = auth.uid()::TEXT AND ur.role = 'admin'
        )
        OR EXISTS (
            SELECT 1 FROM sms.teachers_class tc JOIN sms.students s ON s.class_id = tc.class_teacher_class_id WHERE tc.teacher_id = auth.uid()::TEXT AND s.id = student_id
        )
    );

-- INSERT/UPDATE/DELETE policy: only admins or the class teacher for the student's class
CREATE POLICY "Manage optional subjects: admin or class teacher" ON sms.student_optional_subjects
    FOR ALL USING (sms.can_manage_optional(student_id))
    WITH CHECK (sms.can_manage_optional(student_id) AND assigned_by = auth.uid()::TEXT);

-- Trigger function to limit optional subjects to max 2 for S1-S4
CREATE OR REPLACE FUNCTION sms.limit_optional_subjects()
RETURNS TRIGGER AS $$
DECLARE
    cls_id TEXT;
    cnt INTEGER;
BEGIN
    -- Get the student's class id
    SELECT class_id INTO cls_id FROM sms.students WHERE id = NEW.student_id;
    IF cls_id IS NULL THEN
        RAISE EXCEPTION 'Student % not found', NEW.student_id;
    END IF;

    -- Only enforce for S1-S4 (class ids expected to be 's1','s2','s3','s4')
    IF cls_id IN ('s1', 's2', 's3', 's4') THEN
        SELECT COUNT(*) INTO cnt FROM sms.student_optional_subjects WHERE student_id = NEW.student_id;

        IF TG_OP = 'INSERT' THEN
            IF cnt >= 2 THEN
                RAISE EXCEPTION 'Cannot assign more than 2 optional subjects for students in S1-S4';
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            -- exclude current row if it exists
            SELECT COUNT(*) INTO cnt FROM sms.student_optional_subjects WHERE student_id = NEW.student_id AND id <> COALESCE(NEW.id, '');
            IF cnt >= 2 THEN
                RAISE EXCEPTION 'Cannot assign more than 2 optional subjects for students in S1-S4';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_limit_optional_subjects ON sms.student_optional_subjects;
CREATE TRIGGER trg_limit_optional_subjects
    BEFORE INSERT OR UPDATE ON sms.student_optional_subjects
    FOR EACH ROW EXECUTE FUNCTION sms.limit_optional_subjects();

-- Grant usage and CRUD privileges to authenticated role (RLS will further restrict actions)
GRANT SELECT, INSERT, UPDATE, DELETE ON sms.student_optional_subjects TO authenticated;

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_student_optionals_student ON sms.student_optional_subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_student_optionals_subject ON sms.student_optional_subjects(subject_id);

-- Done
