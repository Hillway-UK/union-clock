-- Create amendment_requests table for unified shift amendments and overtime requests
CREATE TABLE IF NOT EXISTS amendment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL DEFAULT gen_random_uuid(),
  worker_id uuid REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
  clock_entry_id uuid REFERENCES clock_entries(id) ON DELETE CASCADE,
  created_clock_entry_id uuid REFERENCES clock_entries(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('time_amendment', 'overtime_request')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  payload jsonb NOT NULL,
  reason text NOT NULL,
  manager_id uuid REFERENCES managers(id),
  manager_notes text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_amendment_requests_worker
  ON amendment_requests(worker_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_amendment_requests_group
  ON amendment_requests(group_id);

CREATE INDEX IF NOT EXISTS idx_amendment_requests_status
  ON amendment_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_amendment_requests_clock_entry
  ON amendment_requests(clock_entry_id);

-- Enable RLS
ALTER TABLE amendment_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Workers can view their own amendment requests"
  ON amendment_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM workers WHERE id = worker_id));

CREATE POLICY "Workers can insert their own amendment requests"
  ON amendment_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM workers WHERE id = worker_id));

CREATE POLICY "Workers can update their own pending amendment requests"
  ON amendment_requests
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM workers WHERE id = worker_id)
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM workers WHERE id = worker_id)
    AND status = 'pending'
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_amendment_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER amendment_requests_updated_at
  BEFORE UPDATE ON amendment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_amendment_requests_updated_at();

-- Comments for documentation
COMMENT ON TABLE amendment_requests IS 'Unified table for shift time amendments and overtime requests';
COMMENT ON COLUMN amendment_requests.group_id IS 'Groups related amendments together (e.g., shift amendment + OT request for same entry)';
COMMENT ON COLUMN amendment_requests.type IS 'Type of request: time_amendment or overtime_request';
COMMENT ON COLUMN amendment_requests.payload IS 'JSONB payload containing request-specific data (clock times for amendments, hours for OT)';
COMMENT ON COLUMN amendment_requests.created_clock_entry_id IS 'For OT requests that create new clock entries, references the created entry';
