-- Migration 1: Prevent multiple open clock entries per worker
-- This ensures data integrity and prevents race conditions

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_entry_per_worker 
ON clock_entries (worker_id) 
WHERE clock_out IS NULL;

COMMENT ON INDEX idx_one_open_entry_per_worker IS 
'Ensures only one open clock entry (clock_out IS NULL) per worker at any time';

-- Migration 2: Add processed flag to track which exit_detected events have been handled
-- This prevents duplicate auto-clockouts and improves reliability

ALTER TABLE geofence_events 
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_geofence_events_processed 
ON geofence_events(event_type, processed, timestamp) 
WHERE event_type = 'exit_detected';

COMMENT ON COLUMN geofence_events.processed IS 
'Tracks whether this exit_detected event has been processed by check-grace-expiry';

-- Migration 3: Create audit trail table for all clock-in/out actions
-- Provides complete history of clock actions for debugging and compliance

CREATE TABLE IF NOT EXISTS clock_entry_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_entry_id UUID NOT NULL REFERENCES clock_entries(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id),
  action TEXT NOT NULL CHECK (action IN ('clock_in', 'clock_out', 'auto_clock_out', 'amendment')),
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual', 'geofence', '12_hour_fallback', 'system', 'manager')),
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clock_audit_entry ON clock_entry_audit(clock_entry_id);
CREATE INDEX IF NOT EXISTS idx_clock_audit_worker ON clock_entry_audit(worker_id);
CREATE INDEX IF NOT EXISTS idx_clock_audit_created ON clock_entry_audit(created_at DESC);

-- Add RLS policies
ALTER TABLE clock_entry_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view own audit logs"
ON clock_entry_audit FOR SELECT
USING (
  worker_id IN (
    SELECT id FROM workers WHERE email = auth.email()
  )
);

CREATE POLICY "Managers can view org audit logs"
ON clock_entry_audit FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workers w
    JOIN managers m ON w.organization_id = m.organization_id
    WHERE w.id = clock_entry_audit.worker_id
    AND m.email = auth.email()
  )
);

CREATE POLICY "Service role can insert audit logs"
ON clock_entry_audit FOR INSERT
WITH CHECK (true);

CREATE POLICY "Super admins can view all audit logs"
ON clock_entry_audit FOR SELECT
USING (is_super_admin(auth.email()));

COMMENT ON TABLE clock_entry_audit IS 
'Complete audit trail of all clock-in/out actions for debugging and compliance';
COMMENT ON COLUMN clock_entry_audit.triggered_by IS 
'Source of the action: manual (user), geofence (auto), 12_hour_fallback, system, or manager';