-- Migration: Add Fine Art P4 for S5/S6 and p4 score columns
-- Date: 2026-06-30

-- 1. Update Fine Art paper_count to 4 for S5 and S6
UPDATE sms.subjects 
SET paper_count = 4 
WHERE id IN ('a-art-s5', 'a-art-s6') 
  AND name = 'Fine Art';

-- 2. Add p4 score columns to grades table for direct access
ALTER TABLE sms.grades 
  ADD COLUMN IF NOT EXISTS p4_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS p4_eot_score DECIMAL(5,2);
