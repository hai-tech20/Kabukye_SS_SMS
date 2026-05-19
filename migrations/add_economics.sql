-- MIGRATION: ADD ECONOMICS SUBJECT
-- Economics is an A-Level subject (S5-S6) with 2 papers (P1 and P2)

-- 1. Add Economics to A-Level (S5-S6) subjects
DO $$
DECLARE
    class_ids TEXT[] := ARRAY['s5', 's6'];
    cid TEXT;
BEGIN
    FOREACH cid IN ARRAY class_ids LOOP
        -- Check if Economics already exists for this class
        IF NOT EXISTS (SELECT 1 FROM sms.subjects WHERE id = 'a-econ-' || cid) THEN
            INSERT INTO sms.subjects (id, name, class_id, paper_count) VALUES
            ('a-econ-' || cid, 'Economics', cid, 2);
            RAISE NOTICE 'Added Economics for %', cid;
        ELSE
            RAISE NOTICE 'Economics already exists for %', cid;
        END IF;
    END LOOP;
END $$;

-- 2. Also add Economics to O-Level (S1-S4) if needed for entrepreneurship/business studies
DO $$
DECLARE
    class_ids TEXT[] := ARRAY['s1', 's2', 's3', 's4'];
    cid TEXT;
BEGIN
    FOREACH cid IN ARRAY class_ids LOOP
        -- Check if Economics already exists for this class
        IF NOT EXISTS (SELECT 1 FROM sms.subjects WHERE id = 'o-econ-' || cid) THEN
            INSERT INTO sms.subjects (id, name, class_id, paper_count) VALUES
            ('o-econ-' || cid, 'Economics', cid, 1);
            RAISE NOTICE 'Added Economics for %', cid;
        ELSE
            RAISE NOTICE 'Economics already exists for %', cid;
        END IF;
    END LOOP;
END $$;

-- 3. Verify the subjects were added
SELECT id, name, class_id, paper_count 
FROM sms.subjects 
WHERE name = 'Economics' 
ORDER BY class_id;
