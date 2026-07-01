-- Update the optional subject limit to allow 3 for S1/S2, keep 2 for S3/S4
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

    -- Determine max allowed optional subjects
    -- S1/S2: max 3, S3/S4: max 2
    DECLARE
        max_allowed INTEGER;
    BEGIN
        IF cls_id IN ('s1', 's2') THEN
            max_allowed := 3;
        ELSIF cls_id IN ('s3', 's4') THEN
            max_allowed := 2;
        ELSE
            -- Not an O-level class, no limit
            max_allowed := 999;
        END IF;

        -- Check current count
        IF TG_OP = 'INSERT' THEN
            SELECT COUNT(*) INTO cnt FROM sms.student_optional_subjects WHERE student_id = NEW.student_id;
            IF cnt >= max_allowed THEN
                RAISE EXCEPTION 'Cannot assign more than % optional subjects for students in %', max_allowed, upper(cls_id);
            END IF;
        ELSIF TG_OP = 'UPDATE' THEN
            -- exclude current row if it exists
            SELECT COUNT(*) INTO cnt FROM sms.student_optional_subjects WHERE student_id = NEW.student_id AND id <> COALESCE(NEW.id, '');
            IF cnt >= max_allowed THEN
                RAISE EXCEPTION 'Cannot assign more than % optional subjects for students in %', max_allowed, upper(cls_id);
            END IF;
        END IF;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reattach the trigger to ensure it's using the updated function
DROP TRIGGER IF EXISTS trg_limit_optional_subjects ON sms.student_optional_subjects;
CREATE TRIGGER trg_limit_optional_subjects
    BEFORE INSERT OR UPDATE ON sms.student_optional_subjects
    FOR EACH ROW EXECUTE FUNCTION sms.limit_optional_subjects();

-- Done
