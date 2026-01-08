# ClockScreen RAMS Integration Complete ✅

## Summary

The RAMS acceptance dialog has been successfully integrated into the `ClockScreen.tsx` component. Workers will now be required to accept RAMS (Risk Assessment Method Statement) and Site Information documents before clocking in to jobs that have this requirement enabled.

## Changes Made to ClockScreen.tsx

### 1. **Updated Job Interface**
Added RAMS-related fields to the Job interface:
```typescript
interface Job {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  is_active: boolean;
  show_rams_and_site_info?: boolean;      // ← NEW
  terms_and_conditions_url?: string;      // ← NEW
  waiver_url?: string;                    // ← NEW
}
```

### 2. **Added Imports**
```typescript
import RAMSAcceptanceDialog from "@/components/RAMSAcceptanceDialog";
```

### 3. **Added State Variables**
```typescript
// RAMS acceptance state
const [showRamsDialog, setShowRamsDialog] = useState(false);
const [ramsLoading, setRamsLoading] = useState(false);
const [ramsData, setRamsData] = useState<{
  termsUrl: string | null;
  waiverUrl: string | null;
  jobName: string;
} | null>(null);
const [pendingClockInData, setPendingClockInData] = useState<{
  photoUrl: string;
  location: LocationData;
  jobId: string;
} | null>(null);
```

### 4. **Modified handleClockIn Function**
The clock-in flow now checks for RAMS requirements **before** requesting location/photo:

```typescript
const handleClockIn = async () => {
  // ... validation ...

  // Check if RAMS acceptance is required for this job
  if (job.show_rams_and_site_info) {
    // Check if already accepted today
    const { data: checkData } = await supabase.functions.invoke(
      'check-rams-acceptance-today',
      { body: { worker_id: worker.id, job_id: selectedJobId } }
    );

    if (!checkData?.already_accepted) {
      // Show RAMS dialog
      setRamsData({
        termsUrl: job.terms_and_conditions_url || null,
        waiverUrl: job.waiver_url || null,
        jobName: job.name
      });
      setShowRamsDialog(true);
      return; // Stop - will continue after acceptance
    }
  }

  // Continue with normal clock-in
  await performClockIn();
};
```

### 5. **Created performClockIn Function**
Extracted the actual clock-in logic into a separate function that can be called after RAMS acceptance:

```typescript
const performClockIn = async () => {
  // All the existing clock-in logic:
  // - Request fresh location
  // - Check geofence
  // - Capture photo
  // - Check overtime
  // - Create clock entry
};
```

### 6. **Added handleRamsAccept Function**
Handles the RAMS acceptance and continues with clock-in:

```typescript
const handleRamsAccept = async () => {
  // Record RAMS acceptance via Edge Function
  const { data, error } = await supabase.functions.invoke(
    'record-rams-acceptance',
    {
      body: {
        worker_id: worker.id,
        job_id: selectedJobId,
        terms_and_conditions_url: ramsData.termsUrl,
        waiver_url: ramsData.waiverUrl
      }
    }
  );

  // Close dialog and continue with clock-in
  setShowRamsDialog(false);
  await performClockIn();
};
```

### 7. **Updated loadJobs Query**
Modified to fetch RAMS fields from database:

```typescript
const loadJobs = async (showToast = false) => {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, name, code, latitude, longitude, geofence_radius, is_active, show_rams_and_site_info, terms_and_conditions_url, waiver_url")
    .eq("is_active", true)
    .order("name");
  // ...
};
```

### 8. **Added Dialog Component to JSX**
Placed after the OvertimeConfirmationDialog:

```tsx
{/* RAMS Acceptance Dialog */}
<RAMSAcceptanceDialog
  open={showRamsDialog}
  onOpenChange={setShowRamsDialog}
  onAccept={handleRamsAccept}
  jobName={ramsData?.jobName || ''}
  termsUrl={ramsData?.termsUrl || null}
  waiverUrl={ramsData?.waiverUrl || null}
  loading={ramsLoading}
/>
```

## How It Works - Clock-In Flow

### **Normal Job (No RAMS Required):**
1. Worker selects job
2. Worker clicks "Clock In"
3. ✅ GPS location requested
4. ✅ Photo captured
5. ✅ Clock entry created

### **Job with RAMS Enabled (First Clock-In of the Day):**
1. Worker selects job
2. Worker clicks "Clock In"
3. 🔒 **System checks if RAMS accepted today**
4. 📋 **RAMS dialog appears**
5. Worker must:
   - Open "RAMS" accordion (view PDF)
   - Open "Site Information" accordion (view PDF)
   - Check confirmation checkbox
   - Click "Accept and Clock In"
6. ✅ **System records acceptance** in `rams_acceptances` table
7. ✅ GPS location requested
8. ✅ Photo captured
9. ✅ Clock entry created

### **Job with RAMS Enabled (Already Accepted Today):**
1. Worker selects job
2. Worker clicks "Clock In"
3. 🔒 **System checks if RAMS accepted today**
4. ✅ **Already accepted - skip dialog**
5. ✅ GPS location requested
6. ✅ Photo captured
7. ✅ Clock entry created

## Daily Acceptance Requirement

**Important:** RAMS acceptance is **daily**, not one-time:
- Worker accepts RAMS → Recorded in database with timestamp
- Next clock-in **same day** → No dialog (already accepted)
- Next clock-in **next day** → Dialog appears again (new day = new acceptance required)

This ensures workers are reminded of safety requirements at the start of each work day.

## Edge Functions Used

1. **`check-rams-acceptance-today`** - Checks if worker has accepted RAMS for this job today
2. **`record-rams-acceptance`** - Records the acceptance in `rams_acceptances` table

Both functions are authenticated and require valid Supabase JWT token.

## Database Tables Involved

### `jobs` table (updated):
- `show_rams_and_site_info` (boolean) - Enable/disable RAMS for this job
- `terms_and_conditions_url` (text) - Filename of RAMS PDF
- `waiver_url` (text) - Filename of Site Info PDF

### `rams_acceptances` table (new):
- `id` (uuid)
- `worker_id` (uuid) - References workers
- `job_id` (uuid) - References jobs
- `terms_and_conditions_url` (text) - Snapshot of URL at acceptance time
- `waiver_url` (text) - Snapshot of URL at acceptance time
- `accepted_at` (timestamptz) - When accepted
- `created_at` (timestamptz) - Record creation time

## Testing Checklist

Before using in production, test these scenarios:

### ✅ Basic RAMS Flow:
- [ ] Select job with RAMS enabled
- [ ] Click "Clock In"
- [ ] Verify RAMS dialog appears
- [ ] Verify both accordions must be opened
- [ ] Verify checkbox only enables after opening both
- [ ] Click "Accept and Clock In"
- [ ] Verify acceptance is recorded
- [ ] Verify clock-in completes successfully

### ✅ Daily Re-acceptance:
- [ ] Accept RAMS and clock in
- [ ] Clock out
- [ ] Clock in again (same day)
- [ ] Verify NO dialog appears (already accepted today)
- [ ] Wait for next day (or manually advance system date)
- [ ] Clock in again
- [ ] Verify dialog DOES appear (new day)

### ✅ Job Without RAMS:
- [ ] Select job with `show_rams_and_site_info = false` or `null`
- [ ] Click "Clock In"
- [ ] Verify dialog does NOT appear
- [ ] Verify normal clock-in flow continues

### ✅ PDF Viewing:
- [ ] Upload RAMS PDF to `job-documents` bucket
- [ ] Update job record with filename
- [ ] Open RAMS accordion in dialog
- [ ] Verify PDF loads and displays correctly
- [ ] Test with missing PDF (should show "Not available" message)

### ✅ Error Handling:
- [ ] Test with Edge Function unavailable
- [ ] Test with network error during acceptance
- [ ] Test with invalid job ID
- [ ] Test canceling dialog (verify loading state clears)

## Configuration Required

### 1. Database Migration
Run the migration to create the `rams_acceptances` table:
```bash
supabase db reset
# OR manually apply: supabase/migrations/20250107220000_add_rams_acceptance_tables.sql
```

### 2. Deploy Edge Functions
```bash
supabase functions deploy check-rams-acceptance-today
supabase functions deploy record-rams-acceptance
```

### 3. Create Storage Bucket
```bash
# In Supabase Dashboard > Storage
# Create bucket: job-documents (public or private)
```

### 4. Upload PDFs and Configure Jobs
```sql
-- Example: Enable RAMS for a job
UPDATE jobs
SET
  show_rams_and_site_info = true,
  terms_and_conditions_url = 'rams-2024.pdf',  -- Just filename
  waiver_url = 'site-info.pdf'                 -- Just filename
WHERE id = 'your-job-id';
```

## Troubleshooting

### Dialog doesn't appear:
- Check `show_rams_and_site_info` is `true` in jobs table
- Check browser console for errors
- Verify Edge Functions are deployed

### PDF doesn't load:
- Check file exists in `job-documents` bucket
- Check filename matches exactly (case-sensitive)
- Check browser console for download errors
- Verify `pdfUtils.ts` is working

### Acceptance not recorded:
- Check Edge Function logs in Supabase Dashboard
- Verify worker has valid session token
- Check `rams_acceptances` table for new records

### "Already accepted" not working:
- Check system date/time
- Verify `accepted_at` timestamp is recent
- Check query logic in `check-rams-acceptance-today` function

## File Locations

- **Component**: `src/components/ClockScreen.tsx` (UPDATED)
- **RAMS Dialog**: `src/components/RAMSAcceptanceDialog.tsx`
- **PDF Viewer**: `src/components/RamsPdfViewer.tsx`
- **PDF Utils**: `src/lib/pdfUtils.ts`
- **Edge Functions**: `supabase/functions/check-rams-acceptance-today/` and `record-rams-acceptance/`
- **Migration**: `supabase/migrations/20250107220000_add_rams_acceptance_tables.sql`

---

**Status:** ✅ **Integration Complete** - Ready for testing and deployment!
