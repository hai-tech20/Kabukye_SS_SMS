-- MIGRATION: UPDATE SUBJECTS AND PAPERS
-- This script updates the subjects table to include paper counts and inserts the correct subjects for O and A level
-- Based on user request and research for Ugandan curriculum (NLSC for O-level, UACE for A-level)

-- 1. Add paper_count column to subjects table
ALTER TABLE sms.subjects ADD COLUMN IF NOT EXISTS paper_count INTEGER DEFAULT 1;

-- 2. Update grades table to support multiple papers
CREATE TABLE IF NOT EXISTS sms.grade_papers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    grade_id TEXT NOT NULL REFERENCES sms.grades(id) ON DELETE CASCADE,
    paper_number INTEGER NOT NULL, -- 1, 2, 3
    score DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(grade_id, paper_number)
);

-- 3. Clear existing default subjects to avoid conflicts
DELETE FROM sms.subjects WHERE id LIKE 'o-%' OR id LIKE 'a-%';

-- 4. Insert O-Level Subjects (S1-S4) - New Lower Secondary Curriculum (NLSC)
-- We will insert for S1, S2, S3, S4
DO $$
DECLARE
    class_ids TEXT[] := ARRAY['s1', 's2', 's3', 's4'];
    cid TEXT;
BEGIN
    FOREACH cid IN ARRAY class_ids LOOP
        INSERT INTO sms.subjects (id, name, class_id, paper_count) VALUES
        ('o-english-' || cid, 'English Language', cid, 1),
        ('o-math-' || cid, 'Mathematics', cid, 1),
        ('o-chem-' || cid, 'Chemistry', cid, 2),
        ('o-bio-' || cid, 'Biology', cid, 2),
        ('o-phys-' || cid, 'Physics', cid, 2),
        ('o-hist-' || cid, 'History & Political Education', cid, 2),
        ('o-geog-' || cid, 'Geography', cid, 1),
        ('o-cre-' || cid, 'CRE', cid, 1),
        ('o-ire-' || cid, 'IRE', cid, 1),
        ('o-kisw-' || cid, 'Kiswahili', cid, 1),
        ('o-lit-' || cid, 'Literature in English', cid, 1),
        ('o-agric-' || cid, 'Agriculture', cid, 1),
        ('o-ent-' || cid, 'Entrepreneurship', cid, 1),
        ('o-art-' || cid, 'Fine Art', cid, 2),
        ('o-comp-' || cid, 'Computer Studies', cid, 1),
        ('o-lusoga-' || cid, 'Lusoga', cid, 1);
    END LOOP;
END $$;

-- 5. A-Level (S5-S6) - UACE
DO $$
DECLARE
    class_ids TEXT[] := ARRAY['s5', 's6'];
    cid TEXT;
BEGIN
    FOREACH cid IN ARRAY class_ids LOOP
        INSERT INTO sms.subjects (id, name, class_id, paper_count) VALUES
        ('a-math-' || cid, 'Mathematics', cid, 2),
        ('a-chem-' || cid, 'Chemistry', cid, 3),
        ('a-bio-' || cid, 'Biology', cid, 3),
        ('a-phys-' || cid, 'Physics', cid, 3), -- Research says 3 papers (P1, P2, P3/Practical)
        ('a-hist-' || cid, 'History', cid, 2), -- As requested by user
        ('a-geog-' || cid, 'Geography', cid, 3),
        ('a-div-' || cid, 'Divinity', cid, 3), -- P1, P2, P3/P4
        ('a-isl-' || cid, 'Islam', cid, 3), -- P1, P2, P3/P4
        ('a-kisw-' || cid, 'Kiswahili', cid, 3),
        ('a-lit-' || cid, 'Literature in English', cid, 3),
        ('a-agric-' || cid, 'Agriculture', cid, 3),
        ('a-ent-' || cid, 'Entrepreneurship', cid, 3), -- Research says 3 papers
        ('a-art-' || cid, 'Fine Art', cid, 4), -- Fine Art has P1, P2, P3, P4 for S5/S6
        ('a-gp-' || cid, 'General Paper', cid, 1),
        ('a-sub-ict-' || cid, 'Sub ICT', cid, 2),
        ('a-sub-math-' || cid, 'Sub Mathematics', cid, 1),
        ('a-lusoga-' || cid, 'Lusoga', cid, 3),
        ('a-econ-' || cid, 'Economics', cid, 2);
    END LOOP;
END $$;
