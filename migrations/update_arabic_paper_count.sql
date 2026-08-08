-- Set Arabic subjects (S1-S4) to 2 papers (P1 and P2)
UPDATE sms.subjects
SET paper_count = 2
WHERE id IN ('arabic-s1', 'arabic-s2', 'arabic-s3', 'arabic-s4');

-- Verify
SELECT id, name, class_id, paper_count
FROM sms.subjects
WHERE id LIKE 'arabic-%'
ORDER BY class_id;
