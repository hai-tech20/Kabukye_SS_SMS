-- Add Economics subject for S5 and S6 only (A-Level)
-- Economics has 2 papers: P1 and P2

-- S5 Economics
INSERT INTO sms.subjects (id, name, class_id, paper_count)
SELECT 'a-econ-s5', 'Economics', 's5', 2
WHERE NOT EXISTS (SELECT 1 FROM sms.subjects WHERE id = 'a-econ-s5');

-- S6 Economics
INSERT INTO sms.subjects (id, name, class_id, paper_count)
SELECT 'a-econ-s6', 'Economics', 's6', 2
WHERE NOT EXISTS (SELECT 1 FROM sms.subjects WHERE id = 'a-econ-s6');

-- Verify
SELECT id, name, class_id, paper_count FROM sms.subjects WHERE name = 'Economics' ORDER BY class_id;
