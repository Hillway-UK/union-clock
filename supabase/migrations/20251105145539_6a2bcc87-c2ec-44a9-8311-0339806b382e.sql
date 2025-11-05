-- Phase 1: Add overtime-related columns and indexes to clock_entries

-- Add linked_shift_id to associate OT with main shift
ALTER TABLE clock_entries 
ADD COLUMN IF NOT EXISTS linked_shift_id UUID REFERENCES clock_entries(id);

-- Add index for faster OT queries
CREATE INDEX IF NOT EXISTS idx_clock_entries_overtime 
ON clock_entries(is_overtime, ot_status) 
WHERE is_overtime = true;

CREATE INDEX IF NOT EXISTS idx_clock_entries_linked_shift 
ON clock_entries(linked_shift_id) 
WHERE linked_shift_id IS NOT NULL;

-- Create function to merge approved OT hours with main shift
CREATE OR REPLACE FUNCTION merge_approved_overtime()
RETURNS TRIGGER AS $$
BEGIN
  -- Only merge if status changed to 'approved' AND there's a linked shift
  IF NEW.ot_status = 'approved' 
     AND OLD.ot_status != 'approved' 
     AND NEW.linked_shift_id IS NOT NULL
     AND NEW.total_hours IS NOT NULL THEN
    
    -- Update the main shift's total_hours
    UPDATE clock_entries
    SET total_hours = COALESCE(total_hours, 0) + NEW.total_hours
    WHERE id = NEW.linked_shift_id;
    
    RAISE NOTICE 'Merged % OT hours into shift %', NEW.total_hours, NEW.linked_shift_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic OT merging
DROP TRIGGER IF EXISTS trg_merge_approved_overtime ON clock_entries;
CREATE TRIGGER trg_merge_approved_overtime
AFTER UPDATE ON clock_entries
FOR EACH ROW
WHEN (NEW.is_overtime = TRUE)
EXECUTE FUNCTION merge_approved_overtime();