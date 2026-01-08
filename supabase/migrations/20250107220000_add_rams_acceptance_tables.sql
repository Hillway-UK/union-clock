-- Create RAMS acceptances table
CREATE TABLE IF NOT EXISTS rams_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  terms_and_conditions_url text,
  waiver_url text,
  accepted_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rams_acceptances_worker_job
  ON rams_acceptances(worker_id, job_id, accepted_at DESC);

-- Enable RLS
ALTER TABLE rams_acceptances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workers can view their own RAMS acceptances"
  ON rams_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM workers WHERE id = worker_id));

CREATE POLICY "Workers can insert their own RAMS acceptances"
  ON rams_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM workers WHERE id = worker_id));

-- Add RAMS/Site Info columns to jobs table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'jobs' AND column_name = 'terms_and_conditions_url') THEN
    ALTER TABLE jobs ADD COLUMN terms_and_conditions_url text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'jobs' AND column_name = 'waiver_url') THEN
    ALTER TABLE jobs ADD COLUMN waiver_url text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'jobs' AND column_name = 'show_rams_and_site_info') THEN
    ALTER TABLE jobs ADD COLUMN show_rams_and_site_info boolean DEFAULT true;
  END IF;
END $$;

-- Add terms acceptance columns to workers table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'workers' AND column_name = 'terms_accepted') THEN
    ALTER TABLE workers ADD COLUMN terms_accepted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'workers' AND column_name = 'terms_accepted_at') THEN
    ALTER TABLE workers ADD COLUMN terms_accepted_at timestamptz;
  END IF;
END $$;
