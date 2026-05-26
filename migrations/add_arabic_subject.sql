-- Migration: Add Arabic subject for S1, S2, S3, S4
-- Arabic has 2 papers (P1 and P2) for all these classes

-- Insert Arabic subject for S1
INSERT INTO sms.subjects (id, name, class_id)
VALUES ('arabic-s1', 'Arabic', 's1')
ON CONFLICT DO NOTHING;

-- Insert Arabic subject for S2
INSERT INTO sms.subjects (id, name, class_id)
VALUES ('arabic-s2', 'Arabic', 's2')
ON CONFLICT DO NOTHING;

-- Insert Arabic subject for S3
INSERT INTO sms.subjects (id, name, class_id)
VALUES ('arabic-s3', 'Arabic', 's3')
ON CONFLICT DO NOTHING;

-- Insert Arabic subject for S4
INSERT INTO sms.subjects (id, name, class_id)
VALUES ('arabic-s4', 'Arabic', 's4')
ON CONFLICT DO NOTHING;

-- Note: Paper count is not explicitly stored in the subjects table.
-- Papers (P1, P2, etc.) are tracked via the student_marks table columns (p1_score, p2_score, p3_score)
-- or can be added to the grades table if needed. For now, the marking system should handle:
-- - Arabic in S1-S4: P1 and P2 (update grading logic to support 2 papers for this subject)
