-- Update auto_clock_out_after_12_hours function to use unified dedupe key
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
  FOR v_entry IN
    SELECT ce.id, ce.worker_id, ce.job_id, ce.clock_in
    FROM public.clock_entries ce
    WHERE ce.clock_out IS NULL
      AND ce.clock_in < NOW() - INTERVAL '12 hours'
  LOOP
    v_clock_out_time := v_entry.clock_in + INTERVAL '12 hours';
    
    SELECT name INTO v_worker_name
    FROM public.workers
    WHERE id = v_entry.worker_id;
    
    SELECT name INTO v_job_name
    FROM public.jobs
    WHERE id = v_entry.job_id;
    
    UPDATE public.clock_entries
    SET 
      clock_out = v_clock_out_time,
      total_hours = 12.0,
      auto_clocked_out = true,
      auto_clockout_type = '12_hour_fallback',
      notes = COALESCE(notes || ' | ', '') || 'Auto clocked-out after 12 hours (safety fallback)'
    WHERE id = v_entry.id;
    
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
    
    v_clock_out_formatted := TO_CHAR(v_clock_out_time, 'HH12:MI AM on DD Mon');
    
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
    
    -- UPDATED: Use date-based unified dedupe key (ensures only 1 auto-clockout notification per day)
    v_dedupe_key := format('%s:%s:auto_clockout', v_entry.worker_id, DATE(v_entry.clock_in));
    
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
    
    worker_id := v_entry.worker_id;
    worker_name := v_worker_name;
    clock_out_time := v_clock_out_time;
    job_name := v_job_name;
    RETURN NEXT;
    
  END LOOP;
  
  RETURN;
END;
$function$;