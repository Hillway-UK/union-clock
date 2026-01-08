# RAMS & Additional Features Integration Summary

## What Has Been Completed ✅

### 1. **Edge Functions** (Supabase Serverless Backend)
All RAMS-related Edge Functions have been copied and configured:

- ✅ **`_shared/cors.ts`** - Shared CORS utility for Edge Functions
- ✅ **`validate-rams-acceptance`** - Fetches RAMS and Site Information URLs for a job
- ✅ **`record-rams-acceptance`** - Records worker's acceptance of RAMS documents
- ✅ **`check-rams-acceptance-today`** - Checks if worker already accepted RAMS today
- ✅ **`proxy-file`** - Proxies file downloads from Supabase Storage (handles private buckets)

Location: `supabase/functions/`

### 2. **React Components**
All UI components have been copied to your codebase:

- ✅ **`RAMSAcceptanceDialog.tsx`** - Main dialog shown before clock-in, requires viewing both RAMS and Site Info PDFs
- ✅ **`RamsPdfViewer.tsx`** - PDF viewer component using react-pdf library
- ✅ **`TermsAndPrivacyDialog.tsx`** - Privacy Policy & Terms of Service dialog for first-time users
- ✅ **`UnifiedAmendmentDialog.tsx`** - Combined dialog for shift amendments and overtime requests

Location: `src/components/`

### 3. **Helper Functions & Types**
- ✅ **`src/lib/pdfUtils.ts`** - PDF download utilities from Supabase Storage
- ✅ **`src/types/amendment.ts`** - TypeScript types for amendment requests
- ✅ **`src/hooks/useAmendmentRequests.ts`** - React hook for managing amendment submissions

### 4. **Database Migration**
- ✅ Created migration: `20250107220000_add_rams_acceptance_tables.sql`
  - Creates `rams_acceptances` table
  - Adds RAMS document URL columns to `jobs` table:
    - `terms_and_conditions_url` (RAMS PDF)
    - `waiver_url` (Site Information PDF)
    - `show_rams_and_site_info` (toggle feature per job)
  - Adds Terms & Privacy acceptance columns to `workers` table:
    - `terms_accepted` (boolean)
    - `terms_accepted_at` (timestamp)
  - Includes Row Level Security (RLS) policies
  - Includes indexes for performance

Location: `supabase/migrations/`

### 5. **TypeScript Types**
- ✅ Updated `src/integrations/supabase/types.ts` with:
  - `rams_acceptances` table definitions
  - New fields in `jobs` table
  - New fields in `workers` table

### 6. **Dependencies**
- ✅ Installed **`react-pdf`** library for PDF viewing (435 packages added)

### 7. **Supabase Configuration**
- ✅ Updated `supabase/config.toml` to include new Edge Functions with JWT verification settings

---

## What Needs To Be Done 🚧

### 1. **Apply Database Migration**
Run the migration to create the RAMS tables and add columns:

```bash
# If using Supabase CLI locally:
supabase db reset

# Or apply manually in Supabase Dashboard > SQL Editor:
# Copy contents of: supabase/migrations/20250107220000_add_rams_acceptance_tables.sql
```

### 2. **Deploy Edge Functions**
Deploy the new Edge Functions to your Supabase project:

```bash
supabase functions deploy validate-rams-acceptance
supabase functions deploy record-rams-acceptance
supabase functions deploy check-rams-acceptance-today
supabase functions deploy proxy-file
```

### 3. **Create Supabase Storage Bucket**
Create a storage bucket for job documents:

1. Go to Supabase Dashboard > Storage
2. Create new bucket: **`job-documents`**
3. Set bucket to **public** or **private** (proxy-file function handles both)
4. Upload your RAMS PDFs and Site Information PDFs

### 4. **Integrate RAMS Acceptance into ClockScreen** ⚠️ CRITICAL
The `RAMSAcceptanceDialog` needs to be integrated into your `ClockScreen.tsx` component.

**Steps:**
1. Open `src/components/ClockScreen.tsx`
2. Import the RAMS components:
   ```tsx
   import RAMSAcceptanceDialog from './RAMSAcceptanceDialog';
   import { supabase } from '@/integrations/supabase/client';
   ```

3. Add state for RAMS dialog:
   ```tsx
   const [showRamsDialog, setShowRamsDialog] = useState(false);
   const [ramsData, setRamsData] = useState<{
     termsUrl: string | null;
     waiverUrl: string | null;
     jobName: string;
     showRams: boolean;
   } | null>(null);
   ```

4. Before clock-in, check if job requires RAMS acceptance:
   ```tsx
   const handleClockInClick = async () => {
     // Get selected job data
     const selectedJobData = jobs?.find(j => j.id === selectedJob);

     if (selectedJobData?.show_rams_and_site_info) {
       // Check if already accepted today
       const { data: checkData } = await supabase.functions.invoke(
         'check-rams-acceptance-today',
         {
           body: { worker_id: workerId, job_id: selectedJob }
         }
       );

       if (!checkData?.already_accepted) {
         // Show RAMS dialog
         setRamsData({
           termsUrl: selectedJobData.terms_and_conditions_url,
           waiverUrl: selectedJobData.waiver_url,
           jobName: selectedJobData.name,
           showRams: true
         });
         setShowRamsDialog(true);
         return; // Stop clock-in flow
       }
     }

     // Continue with normal clock-in
     await performClockIn();
   };
   ```

5. Add RAMS acceptance handler:
   ```tsx
   const handleRamsAccept = async () => {
     try {
       // Record acceptance
       await supabase.functions.invoke('record-rams-acceptance', {
         body: {
           worker_id: workerId,
           job_id: selectedJob,
           terms_and_conditions_url: ramsData?.termsUrl,
           waiver_url: ramsData?.waiverUrl
         }
       });

       setShowRamsDialog(false);

       // Now proceed with clock-in
       await performClockIn();
     } catch (error) {
       console.error('Failed to record RAMS acceptance:', error);
       toast.error('Failed to record acceptance');
     }
   };
   ```

6. Add the dialog component:
   ```tsx
   <RAMSAcceptanceDialog
     open={showRamsDialog}
     onOpenChange={setShowRamsDialog}
     onAccept={handleRamsAccept}
     jobName={ramsData?.jobName || ''}
     termsUrl={ramsData?.termsUrl || null}
     waiverUrl={ramsData?.waiverUrl || null}
   />
   ```

### 5. **Integrate Terms & Privacy Dialog**
The `TermsAndPrivacyDialog` should be shown to workers who haven't accepted terms yet.

**Integration Point:** `src/contexts/WorkerContext.tsx` or `src/components/Home.tsx`

**Steps:**
1. Check worker's `terms_accepted` field
2. If `false` or `null`, show dialog on login
3. Block app usage until terms are accepted
4. Update worker record when accepted

Example:
```tsx
import TermsAndPrivacyDialog from '@/components/TermsAndPrivacyDialog';

// In component:
const [showTermsDialog, setShowTermsDialog] = useState(false);

useEffect(() => {
  if (worker && !worker.terms_accepted) {
    setShowTermsDialog(true);
  }
}, [worker]);

<TermsAndPrivacyDialog
  open={showTermsDialog}
  onAccepted={() => {
    setShowTermsDialog(false);
    // Refresh worker data
    refetchWorker();
  }}
  workerEmail={worker?.email || ''}
/>
```

### 6. **Integrate Unified Amendment Dialog (Optional)**
Replace your existing amendment request dialogs with the unified version in `src/pages/Timesheets.tsx`:

```tsx
import UnifiedAmendmentDialog from '@/components/UnifiedAmendmentDialog';

<UnifiedAmendmentDialog
  open={showAmendmentDialog}
  onOpenChange={setShowAmendmentDialog}
  entry={selectedEntry}
  workerId={workerId}
  pendingRequests={pendingRequests}
  onSuccess={() => {
    refetchTimesheets();
    refetchAmendments();
  }}
/>
```

### 7. **Update Jobs with RAMS Documents**
Add RAMS and Site Information documents to your jobs:

1. Upload PDFs to `job-documents` bucket
2. Update jobs table:
   ```sql
   UPDATE jobs
   SET
     terms_and_conditions_url = 'rams-document.pdf', -- just filename
     waiver_url = 'site-info.pdf', -- just filename
     show_rams_and_site_info = true
   WHERE id = 'your-job-id';
   ```

---

## How It Works 🔄

### RAMS Acceptance Flow:
1. **Worker selects job and clicks "Clock In"**
2. **System checks** if job has `show_rams_and_site_info = true`
3. **System checks** if worker already accepted RAMS today (via `check-rams-acceptance-today` function)
4. **If not accepted today**, show `RAMSAcceptanceDialog`:
   - Worker must open both accordion sections (RAMS & Site Info)
   - PDFs are loaded via `getPdfUrl()` from Supabase Storage
   - Worker must check confirmation checkbox
   - Click "Accept and Clock In"
5. **System records** acceptance in `rams_acceptances` table (via `record-rams-acceptance` function)
6. **Clock-in proceeds** as normal

### Terms & Privacy Flow:
1. **Worker logs in**
2. **System checks** `worker.terms_accepted` field
3. **If `false` or `null`**, show `TermsAndPrivacyDialog`
4. **Worker must**:
   - Scroll through full policy
   - Check "I agree" checkbox
   - Click "Agree & Continue"
5. **System updates** `workers` table with `terms_accepted = true` and timestamp
6. **App becomes usable**

---

## Architecture Notes 📐

### Key Differences from Your Existing Codebase:

1. **RAMS Compliance System** - NEW
   - Daily acceptance requirement (not just once)
   - Per-job document management
   - Full audit trail in database

2. **Unified Amendment Dialog** - ENHANCED
   - Combines shift amendments + overtime requests in one dialog
   - Can submit both types simultaneously
   - Edit pending requests before approval

3. **PDF Viewing** - NEW CAPABILITY
   - In-app PDF rendering (not just downloads)
   - Supports both public and private Supabase Storage buckets
   - Proxy function for cross-origin file access

4. **Terms & Privacy** - NEW
   - One-time acceptance on first login
   - Prevents app usage until accepted
   - Full UK GDPR compliant text

---

## Testing Checklist ✅

After integration, test these scenarios:

### RAMS Acceptance:
- [ ] Worker clocks in to job with RAMS enabled → Dialog appears
- [ ] Worker must open both accordions → Checkbox becomes enabled
- [ ] Worker accepts → Acceptance recorded → Clock-in succeeds
- [ ] Worker clocks in again same day → No dialog (already accepted)
- [ ] Worker clocks in next day → Dialog appears again
- [ ] Job without RAMS enabled → No dialog

### Terms & Privacy:
- [ ] New worker logs in → Terms dialog appears
- [ ] Worker tries to close → Warning appears
- [ ] Worker declines → Signs out
- [ ] Worker accepts → Dialog closes → App usable
- [ ] Worker logs out and back in → No dialog (already accepted)

### PDF Viewing:
- [ ] RAMS PDF loads correctly
- [ ] Site Info PDF loads correctly
- [ ] Missing PDF shows "Not available" message
- [ ] PDF scrolling works
- [ ] Multiple pages render

---

## File Locations Reference 📂

```
union-clock/
├── src/
│   ├── components/
│   │   ├── RAMSAcceptanceDialog.tsx          ✅ NEW
│   │   ├── RamsPdfViewer.tsx                 ✅ NEW
│   │   ├── TermsAndPrivacyDialog.tsx         ✅ NEW
│   │   └── UnifiedAmendmentDialog.tsx        ✅ NEW
│   ├── hooks/
│   │   └── useAmendmentRequests.ts           ✅ NEW
│   ├── lib/
│   │   └── pdfUtils.ts                       ✅ NEW
│   ├── types/
│   │   └── amendment.ts                      ✅ NEW
│   └── integrations/supabase/
│       └── types.ts                          ✅ UPDATED
├── supabase/
│   ├── functions/
│   │   ├── _shared/cors.ts                   ✅ NEW
│   │   ├── validate-rams-acceptance/         ✅ NEW
│   │   ├── record-rams-acceptance/           ✅ NEW
│   │   ├── check-rams-acceptance-today/      ✅ NEW
│   │   └── proxy-file/                       ✅ NEW
│   ├── migrations/
│   │   └── 20250107220000_add_rams_acceptance_tables.sql  ✅ NEW
│   └── config.toml                           ✅ UPDATED
└── package.json                              ✅ UPDATED (react-pdf)
```

---

## Support & Documentation 📚

### React-PDF Documentation:
https://github.com/wojtekmaj/react-pdf

### Supabase Edge Functions:
https://supabase.com/docs/guides/functions

### Supabase Storage:
https://supabase.com/docs/guides/storage

---

**Next Steps:** Complete items 1-7 in the "What Needs To Be Done" section above to fully activate the RAMS compliance system! 🚀
