-- Fix: Only remove user-created triggers, leave system triggers alone!
-- Step 1: Check for specific user-created triggers on grades
DO $$
BEGIN
  RAISE NOTICE 'Checking for user-created triggers on sms.grades...';
END $$;

-- Step 2: Drop known problematic triggers (auto_generate_comments, etc.)
DROP TRIGGER IF EXISTS auto_generate_comments ON sms.grades;
DROP TRIGGER IF EXISTS update_grades_timestamp ON sms.grades;
DROP TRIGGER IF EXISTS trigger_generate_comments ON sms.grades;

-- Step 3: Add ONLY a safe, simple trigger for updated_at
CREATE OR REPLACE FUNCTION sms.safe_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Step 4: Create our safe trigger
DROP TRIGGER IF EXISTS safe_update_updated_at ON sms.grades;
CREATE TRIGGER safe_update_updated_at
  BEFORE UPDATE ON sms.grades
  FOR EACH ROW
  EXECUTE FUNCTION sms.safe_update_updated_at();

-- Step 5: Verify
DO $$
BEGIN
  RAISE NOTICE 'Problematic triggers removed! Only safe_update_updated_at remains.';
END $$;
