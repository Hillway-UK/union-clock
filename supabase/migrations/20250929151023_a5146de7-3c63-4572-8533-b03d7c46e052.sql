-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create notifications table for persistence
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'reminder',
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
CREATE POLICY "Workers can view own notifications" 
ON public.notifications 
FOR SELECT 
USING (worker_id IN (
  SELECT id FROM workers WHERE email = auth.email()
));

CREATE POLICY "Workers can update own notifications" 
ON public.notifications 
FOR UPDATE 
USING (worker_id IN (
  SELECT id FROM workers WHERE email = auth.email()
));

CREATE POLICY "Managers can view all notifications" 
ON public.notifications 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM managers WHERE email = auth.email()
));

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Schedule the clock status check to run every minute (for fine-grained timing)
SELECT cron.schedule(
  'check-clock-status',
  '* * * * *', -- every minute
  $$
  SELECT
    net.http_post(
        url:='https://kejblmetyrsehzvrxgmt.supabase.co/functions/v1/check-clock-status',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlamJsbWV0eXJzZWh6dnJ4Z210Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDM5MjU1MiwiZXhwIjoyMDY5OTY4NTUyfQ.MQrm1y3LPT-dJrW5nSP1J41kL-Ni_MWdDlOkVY-RhbQ"}'::jsonb
    ) as request_id;
  $$
);