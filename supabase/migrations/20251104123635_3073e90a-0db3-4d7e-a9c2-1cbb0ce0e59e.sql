-- Drop the old function
DROP FUNCTION IF EXISTS public.auto_clock_out_after_12_hours();

-- Create enhanced function with notifications and audit logging
CREATE OR REPLACE FUNCTION public.auto_clock_out_after_12_hours()
RETURNS TABLE(worker_id uuid, worker_name text, clock_out_time timestamp with time zone, job_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entry RECORD;
  v_worker_name text;
  v_job_name text;
  v_clock_out_time timestamp with time zone;
  v_dedupe_key text;
  v_notification_title text;
  v_notification_body text;
  v_clock_out_formatted text;
BEGIN
  -- Loop through all entries that need 12-hour auto-clockout
  FOR v_entry IN
    SELECT ce.id, ce.worker_id, ce.job_id, ce.clock_in
    FROM public.clock_entries ce
    WHERE ce.clock_out IS NULL
      AND ce.clock_in < NOW() - INTERVAL '12 hours'
  LOOP
    -- Calculate clock-out time (exactly 12 hours after clock-in)
    v_clock_out_time := v_entry.clock_in + INTERVAL '12 hours';
    
    -- Get worker name
    SELECT name INTO v_worker_name
    FROM public.workers
    WHERE id = v_entry.worker_id;
    
    -- Get job name
    SELECT name INTO v_job_name
    FROM public.jobs
    WHERE id = v_entry.job_id;
    
    -- Update clock entry
    UPDATE public.clock_entries
    SET 
      clock_out = v_clock_out_time,
      total_hours = 12.0,
      auto_clocked_out = true,
      auto_clockout_type = '12_hour_fallback',
      notes = COALESCE(notes || ' | ', '') || 'Auto clocked-out after 12 hours (safety fallback)'
    WHERE id = v_entry.id;
    
    -- Insert audit record
    INSERT INTO public.auto_clockout_audit (
      worker_id,
      shift_date,
      reason,
      performed,
      decided_by,
      notes,
      decided_at
    ) VALUES (
      v_entry.worker_id,
      DATE(v_entry.clock_in),
      'twelve_hour_fallback',
      true,
      'system',
      format('12-hour safety limit reached. Worker: %s, Job: %s, Clock-in: %s, Clock-out: %s', 
        v_worker_name, v_job_name, v_entry.clock_in, v_clock_out_time),
      NOW()
    );
    
    -- Format timestamp for notification
    v_clock_out_formatted := TO_CHAR(v_clock_out_time, 'HH12:MI AM on DD Mon');
    
    -- Build notification
    v_notification_title := '⚠️ Auto Clocked-Out: 12-Hour Safety Limit';
    v_notification_body := format(
      'You were automatically clocked out at %s because you were clocked in for over 12 hours (safety limit).

🕐 Reason: 12-Hour Safety Limit Reached
⏰ Clock-Out Time: %s
📅 Total Hours: 12.0

This is a safety measure to prevent excessive work hours. If you worked longer than 12 hours, please submit a Time Amendment from your timesheet.',
      v_clock_out_formatted,
      v_clock_out_formatted
    );
    
    -- Generate dedupe key (format: worker_id:entry_id:12_hour_fallback)
    v_dedupe_key := format('%s:%s:12_hour_fallback', v_entry.worker_id, v_entry.id);
    
    -- Insert notification (only if not already sent)
    INSERT INTO public.notifications (
      worker_id,
      title,
      body,
      type,
      dedupe_key,
      created_at
    )
    SELECT
      v_entry.worker_id,
      v_notification_title,
      v_notification_body,
      '12_hour_fallback_auto_clockout',
      v_dedupe_key,
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE dedupe_key = v_dedupe_key
    );
    
    -- Return result for logging
    worker_id := v_entry.worker_id;
    worker_name := v_worker_name;
    clock_out_time := v_clock_out_time;
    job_name := v_job_name;
    RETURN NEXT;
    
  END LOOP;
  
  RETURN;
END;
$function$;