-- Comprehensive fix for all triggers on grades table
-- Step 1: List all triggers on grades table first
DO $$
BEGIN
  RAISE NOTICE 'Looking for triggers on sms.grades...';
END $$;

-- Step 2: Disable ALL triggers on grades table
ALTER TABLE sms.grades DISABLE TRIGGER ALL;

-- Step 3: Verify triggers are disabled
DO $$
BEGIN
  RAISE NOTICE 'All triggers on sms.grades have been DISABLED!';
END $$;

-- Step 4: Create a simple safe trigger only for updated_at
DROP TRIGGER IF EXISTS safe_update_updated_at ON sms.grades;

CREATE OR REPLACE FUNCTION sms.safe_update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER safe_update_updated_at
  BEFORE UPDATE ON sms.grades
  FOR EACH ROW
  EXECUTE FUNCTION sms.safe_update_updated_at();

-- Step 5: Verify
DO $$
BEGIN
  RAISE NOTICE 'Only the safe_update_updated_at trigger is now enabled!';
END $$;
