-- Enable required extensions for cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the check-grace-expiry function to run every minute
-- This handles geofence auto-clockout grace period logic
SELECT cron.schedule(
  'check-grace-expiry-geofence',
  '* * * * *',  -- Run every minute
  $$
  SELECT net.http_post(
    url := 'https://kejblmetyrsehzvrxgmt.supabase.co/functions/v1/check-grace-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlamJsbWV0eXJzZWh6dnJ4Z210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzOTI1NTIsImV4cCI6MjA2OTk2ODU1Mn0.4CxLNIJtyjWDgoxNzKOwz1LiKnuRHkVubort9fiFxac'
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);