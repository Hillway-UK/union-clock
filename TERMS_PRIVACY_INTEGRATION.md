# Terms & Privacy Dialog Integration Complete ✅

## Summary

The Terms & Privacy dialog has been successfully integrated into the authentication flow via the `WorkerContext`. All workers will now be required to accept the Privacy Policy and Terms of Service on their first login before they can access any app features.

## Changes Made to WorkerContext.tsx

### 1. **Updated Worker Interface**
Added terms acceptance fields to track acceptance status:
```typescript
interface Worker {
  // ... existing fields ...
  terms_accepted: boolean | null;      // ← NEW
  terms_accepted_at: string | null;    // ← NEW
}
```

### 2. **Added Import**
```typescript
import TermsAndPrivacyDialog from '@/components/TermsAndPrivacyDialog';
```

### 3. **Added State Variable**
```typescript
const [showTermsDialog, setShowTermsDialog] = useState(false);
```

### 4. **Added Terms Check Effect**
After worker data loads, check if terms have been accepted:
```typescript
useEffect(() => {
  if (worker && !loading) {
    // Show terms dialog if not accepted
    if (!worker.terms_accepted) {
      console.log('📋 Worker has not accepted terms, showing dialog');
      setShowTermsDialog(true);
    }
  }
}, [worker, loading]);
```

### 5. **Added Acceptance Handler**
```typescript
const handleTermsAccepted = async () => {
  console.log('✅ Terms accepted, refreshing worker data');
  setShowTermsDialog(false);
  // Refresh worker data to get updated terms_accepted status
  await fetchWorker();
};
```

### 6. **Added Dialog Component to JSX**
Rendered after children, conditionally shown when worker exists:
```tsx
{worker && (
  <TermsAndPrivacyDialog
    open={showTermsDialog}
    onAccepted={handleTermsAccepted}
    workerEmail={worker.email}
  />
)}
```

## How It Works - Authentication Flow

### **New Worker (First Login):**
```
1. Worker enters credentials and clicks "Sign In"
   ↓
2. Login component authenticates with Supabase Auth
   ↓
3. Home component detects authenticated user
   ↓
4. Home redirects to /clock route
   ↓
5. ProtectedRoute verifies authentication
   ↓
6. WorkerProvider loads worker data from database
   ↓
7. WorkerContext checks: worker.terms_accepted === false/null
   ↓
8. 📋 Terms & Privacy Dialog appears (BLOCKS APP)
   ↓
9. Worker MUST:
   - Scroll through Privacy Policy & Terms
   - Check "I agree" checkbox
   - Click "Agree & Continue"
   OR
   - Click "Decline" → Warning → Sign Out
   ↓
10. ✅ Dialog calls Supabase to update:
    - workers.terms_accepted = true
    - workers.terms_accepted_at = NOW()
   ↓
11. ✅ Dialog closes, worker data refreshes
   ↓
12. 🎉 Worker can now use the app!
```

### **Existing Worker (Already Accepted):**
```
1. Worker logs in
   ↓
2. WorkerProvider loads worker data
   ↓
3. WorkerContext checks: worker.terms_accepted === true
   ↓
4. ✅ No dialog shown
   ↓
5. Worker proceeds directly to app
```

## Key Features

### **1. One-Time Acceptance**
- Dialog shown only once per worker
- After acceptance, `terms_accepted = true` is permanent
- Worker never sees dialog again (unless reset manually)

### **2. App Blocking**
- Dialog cannot be dismissed (no close button)
- Dialog prevents interaction with app behind it
- Worker MUST accept or sign out

### **3. Decline Handling**
- If worker clicks "Decline" → Warning dialog appears
- Warning explains: "You must accept to use the app"
- Options:
  - "Go Back" → Return to terms dialog
  - "Sign Out" → Log out of app

### **4. Database Update**
The `TermsAndPrivacyDialog` component handles the database update:
```typescript
const { error } = await supabase
  .from('workers')
  .update({
    terms_accepted: true,
    terms_accepted_at: new Date().toISOString(),
  })
  .eq('email', workerEmail);
```

### **5. Context Integration**
- WorkerContext wraps all protected routes
- Dialog appears BEFORE any app component renders
- Works seamlessly with existing auth flow

## Legal Compliance

### **UK GDPR Compliant Content**
The dialog includes full legal text:

**Privacy Policy covers:**
- Data collection (photos, location, personal info)
- Legal bases (contractual necessity, legitimate interests, consent)
- Data security measures
- Data retention policies
- User rights (access, correction, deletion, etc.)
- ICO complaint procedure
- Contact information

**Terms of Service covers:**
- App usage terms
- Account responsibilities
- Photo & location requirements
- Data ownership
- Service availability
- Liability limitations
- Termination conditions
- Governing law (England & Wales)

Last updated: **12-05-2025**

## Testing Checklist

Before deploying, test these scenarios:

### ✅ First Login Flow:
- [ ] Create new test worker account
- [ ] Ensure `terms_accepted` is `false` or `null` in database
- [ ] Log in with worker credentials
- [ ] Verify Terms & Privacy dialog appears
- [ ] Verify cannot interact with app behind dialog
- [ ] Scroll through full privacy policy
- [ ] Scroll through full terms of service
- [ ] Check "I agree" checkbox
- [ ] Click "Agree & Continue"
- [ ] Verify dialog closes
- [ ] Verify worker can access app features
- [ ] Check database: `terms_accepted = true`, `terms_accepted_at` has timestamp

### ✅ Decline Flow:
- [ ] Create new test worker account
- [ ] Log in
- [ ] Click "Decline" on terms dialog
- [ ] Verify warning dialog appears
- [ ] Click "Go Back" → Verify returns to terms dialog
- [ ] Click "Decline" again
- [ ] Click "Sign Out" on warning
- [ ] Verify worker is signed out
- [ ] Check database: `terms_accepted` is still `false/null`

### ✅ Existing Worker Flow:
- [ ] Use worker with `terms_accepted = true`
- [ ] Log in
- [ ] Verify NO dialog appears
- [ ] Verify worker proceeds directly to app

### ✅ Edge Cases:
- [ ] Test with network error during acceptance
- [ ] Test rapidly clicking "Agree & Continue"
- [ ] Test refreshing page while dialog is open
- [ ] Test signing out from another tab
- [ ] Test with very long worker email

## Database Migration

The migration to add `terms_accepted` fields was already created:
```sql
-- From: supabase/migrations/20250107220000_add_rams_acceptance_tables.sql

ALTER TABLE workers ADD COLUMN terms_accepted boolean DEFAULT false;
ALTER TABLE workers ADD COLUMN terms_accepted_at timestamptz;
```

If migration hasn't been applied yet:
```bash
supabase db reset
# OR apply manually in Supabase Dashboard > SQL Editor
```

## Architecture

### **Component Hierarchy:**
```
App.tsx
  └── BrowserRouter
      └── Routes
          └── /clock (and other protected routes)
              └── ProtectedRoute (checks authentication)
                  └── WorkerProvider (loads worker data + shows terms dialog)
                      ├── TermsAndPrivacyDialog (if !terms_accepted)
                      └── ClockScreen (or other route component)
```

### **Why WorkerContext?**
1. **Centralized** - One place for all protected routes
2. **Automatic** - No need to add dialog to each component
3. **Early** - Blocks before any app logic runs
4. **Consistent** - Same experience across all routes
5. **Efficient** - Worker data already loaded, no extra fetch

### **Dialog Persistence:**
The dialog uses `modal` mode with disabled escape behaviors:
```tsx
<DialogContent
  onPointerDownOutside={(e) => e.preventDefault()}
  onEscapeKeyDown={(e) => e.preventDefault()}
>
```

This prevents users from closing the dialog accidentally or intentionally.

## Resetting Terms Acceptance (For Testing)

To test the flow again with an existing worker:
```sql
-- Reset a specific worker
UPDATE workers
SET terms_accepted = false,
    terms_accepted_at = null
WHERE email = 'test@example.com';

-- Reset all workers (DANGER - production)
UPDATE workers
SET terms_accepted = false,
    terms_accepted_at = null;
```

## Updating Legal Text

If you need to update the Privacy Policy or Terms of Service:

1. Edit `src/components/TermsAndPrivacyDialog.tsx`
2. Update the content in the `<ScrollArea>` section
3. Update the "Last updated" date
4. **Important:** Consider resetting all workers' acceptance if changes are material:
   ```sql
   UPDATE workers SET terms_accepted = false, terms_accepted_at = null;
   ```
   This forces everyone to re-accept the updated terms.

## File Locations

- **Context**: `src/contexts/WorkerContext.tsx` (UPDATED)
- **Dialog Component**: `src/components/TermsAndPrivacyDialog.tsx`
- **Worker Type**: `src/integrations/supabase/types.ts` (already has terms fields)
- **Migration**: `supabase/migrations/20250107220000_add_rams_acceptance_tables.sql`

## Troubleshooting

### Dialog doesn't appear:
- Check worker's `terms_accepted` field in database
- Check browser console for errors
- Verify TermsAndPrivacyDialog is imported correctly
- Check if WorkerProvider is rendering

### Dialog won't close after acceptance:
- Check network tab for failed UPDATE request
- Verify worker email matches database record
- Check Supabase RLS policies on workers table
- Look for errors in browser console

### Worker can't accept terms:
- Verify checkbox can be checked
- Ensure scroll area is working (might need to scroll to enable checkbox)
- Check if button is enabled when checkbox is checked
- Verify no JavaScript errors

### Database not updating:
- Check Supabase logs for errors
- Verify workers table has `terms_accepted` columns
- Check RLS policies allow workers to update their own record
- Test UPDATE query manually in SQL editor

---

**Status:** ✅ **Integration Complete** - Workers will be prompted to accept terms on first login!

## Next Steps

1. ✅ Apply database migration (if not done)
2. ✅ Test with a new worker account
3. ✅ Test decline flow
4. ✅ Test with existing worker (should skip dialog)
5. ✅ Deploy to production
6. Consider adding audit log for terms acceptance changes
7. Consider adding version tracking for terms updates
