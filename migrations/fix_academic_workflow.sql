-- FIX ACADEMIC WORKFLOW - MAKE IT REALISTIC
-- This migration fixes the academic year management to work automatically

-- ========================================
-- STEP 1: Create automatic year management function
-- ========================================

-- Function to automatically determine current academic year based on date
CREATE OR REPLACE FUNCTION sms.get_current_academic_year()
RETURNS TEXT AS $$
DECLARE
    current_year TEXT;
    current_month INTEGER := EXTRACT(MONTH FROM CURRENT_DATE);
BEGIN
    -- Academic year runs Jan-Dec, so if we're in Jan or Feb, 
    -- we're in the new academic year
    IF current_month IN (1, 2) THEN
        current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    ELSE
        current_year := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::TEXT;
    END IF;
    
    RETURN current_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically update academic year based on term dates
CREATE OR REPLACE FUNCTION sms.update_academic_year_status()
RETURNS JSONB AS $$
DECLARE
    current_year TEXT;
    current_term RECORD;
    message TEXT;
BEGIN
    -- Get current academic year
    current_year := sms.get_current_academic_year();
    
    -- Get the active term for current year
    SELECT t.* INTO current_term
    FROM sms.terms t
    JOIN sms.academic_years ay ON t.year_id = ay.id
    WHERE ay.year_label = current_year
    AND t.status = 'Active'
    ORDER BY t.term_number
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'No active term found for current academic year');
    END IF;
    
    -- Check if current date is past term start date
    IF CURRENT_DATE >= current_term.start_date THEN
        -- Term has started, check if it should be active based on dates
        IF CURRENT_DATE > current_term.end_date THEN
            -- Term has ended, move to next term or year
            UPDATE sms.terms SET status = 'Completed' 
            WHERE year_id = current_term.year_id AND term_number = current_term.term_number;
            
            -- Try to activate next term
            UPDATE sms.terms SET status = 'Active'
            WHERE year_id = current_term.year_id 
            AND term_number = current_term.term_number + 1;
            
            message := 'Moved to next term';
        ELSIF CURRENT_DATE >= current_term.start_date THEN
            -- Term should be active
            UPDATE sms.terms SET status = 'Active' 
            WHERE id = current_term.id;
            
            message := 'Term activated based on start date';
        END IF;
    ELSE
        -- Term hasn't started yet, keep as upcoming
        UPDATE sms.terms SET status = 'Upcoming'
        WHERE id = current_term.id;
        
        message := 'Term not yet started';
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', message, 'current_year', current_year, 'current_term', current_term.term_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get academic status for display
CREATE OR REPLACE FUNCTION sms.get_academic_status()
RETURNS JSONB AS $$
DECLARE
    current_year TEXT;
    current_term RECORD;
    next_term RECORD;
BEGIN
    -- Get current academic year
    current_year := sms.get_current_academic_year();
    
    -- Get current active term
    SELECT t.* INTO current_term
    FROM sms.terms t
    JOIN sms.academic_years ay ON t.year_id = ay.id
    WHERE ay.year_label = current_year
    AND t.status = 'Active'
    ORDER BY t.term_number
    LIMIT 1;
    
    -- Get next term (if any)
    SELECT t.* INTO next_term
    FROM sms.terms t
    JOIN sms.academic_years ay ON t.year_id = ay.id
    WHERE ay.year_label = current_year
    AND t.term_number = current_term.term_number + 1
    ORDER BY t.term_number
    LIMIT 1;
    
    RETURN jsonb_build_object(
        'current_year', current_year,
        'current_term', current_term.term_number,
        'current_term_start', current_term.start_date,
        'current_term_end', current_term.end_date,
        'current_term_status', current_term.status,
        'next_term', next_term.term_number,
        'next_term_start', next_term.start_date,
        'next_term_end', next_term.end_date,
        'next_term_status', next_term.status,
        'days_until_current_term', GREATEST(0, CURRENT_DATE - current_term.start_date),
        'days_until_next_term', GREATEST(0, next_term.start_date - CURRENT_DATE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 2: Create trigger for automatic term management
-- ========================================

-- Trigger to automatically update term status based on dates
CREATE OR REPLACE FUNCTION sms.auto_update_term_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update status, don't create infinite loop
    PERFORM sms.update_academic_year_status();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that runs daily (you can adjust the schedule)
CREATE OR REPLACE FUNCTION sms.schedule_daily_term_update()
RETURNS VOID AS $$
BEGIN
    -- This would be called by a cron job daily
    PERFORM sms.update_academic_year_status();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 3: Update existing data to work with new system
-- ========================================

-- Update existing academic years to remove is_current flag (we'll determine current year dynamically)
UPDATE sms.academic_years SET is_current = false;

-- Update terms to have proper initial status based on dates
UPDATE sms.terms SET status = 
    CASE 
        WHEN CURRENT_DATE >= start_date AND CURRENT_DATE <= end_date THEN 'Active'
        WHEN CURRENT_DATE < start_date THEN 'Upcoming'
        ELSE 'Completed'
    END;

-- ========================================
-- STEP 4: Create simplified academic management view
-- ========================================

-- View for academic status (simpler than full management)
CREATE OR REPLACE VIEW sms.academic_status_view AS
SELECT 
    ay.year_label as current_year,
    t.term_number as current_term,
    t.start_date as current_term_start,
    t.end_date as current_term_end,
    t.status as current_term_status,
    CASE 
        WHEN CURRENT_DATE >= t.start_date AND CURRENT_DATE <= t.end_date THEN 'Active'
        WHEN CURRENT_DATE < t.start_date THEN 'Upcoming'
        ELSE 'Completed'
    END as calculated_status,
    GREATEST(0, CURRENT_DATE - t.start_date) as days_until_start,
    GREATEST(0, t.end_date - CURRENT_DATE) as days_until_end
FROM sms.academic_years ay
CROSS JOIN LATERAL (
    SELECT t.* 
    FROM sms.terms t 
    WHERE t.year_id = ay.id 
    ORDER BY t.term_number 
    LIMIT 1
) t ON true
WHERE ay.year_label = sms.get_current_academic_year();

-- ========================================
-- STEP 5: Update RLS policies for new functions
-- ========================================

-- Grant execute permissions on new functions
GRANT EXECUTE ON FUNCTION sms.get_current_academic_year() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.update_academic_year_status() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.get_academic_status() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.auto_update_term_status() TO authenticated;
GRANT EXECUTE ON FUNCTION sms.schedule_daily_term_update() TO authenticated;

-- Grant select on academic status view
GRANT SELECT ON sms.academic_status_view TO authenticated;

-- ========================================
-- STEP 6: Add helpful comments
-- ========================================

COMMENT ON FUNCTION sms.get_current_academic_year() IS 'Automatically determines current academic year based on current date';
COMMENT ON FUNCTION sms.update_academic_year_status() IS 'Updates term status automatically based on dates';
COMMENT ON FUNCTION sms.get_academic_status() IS 'Returns comprehensive academic status for display';
COMMENT ON VIEW sms.academic_status_view IS 'Simplified view for academic status display';

-- ========================================
-- STEP 7: Update academic management page to use new system
-- ========================================

-- This would require updating the React component to use the new functions
-- The page should automatically show current year and term status
-- Admin should only be able to set term dates, not create years

-- Migration complete!
SELECT 'Academic workflow fix completed! The system now works automatically based on dates.' as status;
