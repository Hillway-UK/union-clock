-- Update the notification trigger function to handle ALL notification types
CREATE OR REPLACE FUNCTION public.notify_amendment_status()
RETURNS trigger AS $$
DECLARE
  function_url text;
  service_role_key text;
BEGIN
  -- Handle ALL notification types that need push delivery
  IF NEW.type IN (
    'amendment_approved', 
    'amendment_rejected',
    'overtime_pending',
    'overtime_approved',
    'overtime_rejected',
    'overtime_auto_clockout',
    'geofence_auto_clockout',
    '12_hour_fallback_auto_clockout'
  ) THEN
    function_url := 'https://kejblmetyrsehzvrxgmt.supabase.co/functions/v1/send-amendment-notification';
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Call edge function asynchronously using pg_net
    PERFORM net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'notification_id', NEW.id,
        'worker_id', NEW.worker_id,
        'title', NEW.title,
        'body', NEW.body,
        'type', NEW.type
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;