import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Compute current date/time in UK timezone (Europe/London with DST)
function nowInTz(tz: string = 'Europe/London') {
  const now = new Date();
  
  // Use Intl.DateTimeFormat to handle DST automatically
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  // Format: DD/MM/YYYY for en-GB
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
  const timeHHmm = `${get('hour')}:${get('minute')}`; // HH:MM
  
  // Get day of week (0=Sun, 1=Mon, ..., 6=Sat)
  const weekdayName = get('weekday'); // Mon, Tue, etc.
  const dayOfWeekMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const dayOfWeek = dayOfWeekMap[weekdayName] || 0;
  
  return { dateStr, timeHHmm, dayOfWeek, tzOffset: tz };
}

interface Worker {
  id: string;
  name: string;
  email: string;
  organization_id: string;
}

interface GuardResult {
  canAutoClockOut: boolean;
  reason: 'OK' | 'CAP_MONTH' | 'CAP_ROLLING14' | 'CONSECUTIVE_BLOCK' | 'NO_CLOCK_IN' | 'NO_SHIFT' | 'ALREADY_CLOCKED_OUT' | 'UNKNOWN';
}

interface ClockEntry {
  id: string;
  clock_in: string;
  clock_out: string | null;
  job_id: string;
}

serve(async (req) => {
  // Build CORS headers dynamically
  const origin = req.headers.get('origin') || '*';
  const requestHeaders = req.headers.get('access-control-request-headers') || 
                        'authorization, x-client-info, apikey, content-type';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': requestHeaders,
    'Access-Control-Max-Age': '86400'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const siteTime = nowInTz('Europe/London');
    const { dateStr, timeHHmm, dayOfWeek } = siteTime;
    const siteDate = new Date(dateStr + 'T00:00:00Z'); // Date-only in UTC for shift_date
    
    console.log(`Running check-clock-status at ${new Date().toISOString()}, UK time: ${dateStr} ${timeHHmm}, day: ${dayOfWeek}`);

    // Only run on weekdays (Monday=1, Friday=5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('Weekend - skipping all checks');
      return new Response(JSON.stringify({ message: 'Weekend - no actions taken' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let actionsPerformed = 0;

    // Route to appropriate handler based on time
    const reminderTimes = ['06:55', '07:00', '07:15', '15:00', '15:30', '16:00', '17:00'];
    
    if (!reminderTimes.includes(timeHHmm)) {
      console.log(`Current UK time ${timeHHmm} not in reminder schedule, exiting`);
      return new Response(JSON.stringify({ message: 'Not a scheduled time' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get scheduled workers (7-15 shift, Mon-Fri)
    const workers = await getScheduledWorkers(supabase, siteDate, dayOfWeek);
    console.log(`Found ${workers.length} workers scheduled for 7-15 shift`);

    // Handle clock-in reminders
    if (['06:55', '07:00', '07:15'].includes(timeHHmm)) {
      actionsPerformed += await handleClockInReminders(supabase, timeHHmm, siteDate, workers);
    }
    
    // Handle clock-out reminders
    else if (['15:00', '15:30', '16:00'].includes(timeHHmm)) {
      actionsPerformed += await handleClockOutReminders(supabase, timeHHmm, siteDate, workers);
    }
    
    // Handle auto clock-out at 17:00 UK time
    else if (timeHHmm === '17:00') {
      actionsPerformed += await handleAutoClockOut(supabase, siteDate, workers);
    }

    console.log(`Check completed. Actions performed: ${actionsPerformed}`);
    
    return new Response(JSON.stringify({ 
      message: 'Check completed',
      actionsPerformed,
      timestamp: now.toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in check-clock-status:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

async function getScheduledWorkers(supabase: any, siteDate: Date, dayOfWeek: number): Promise<Worker[]> {
  // For 7-15 shift, weekdays only
  const weekdays = [1, 2, 3, 4, 5];
  if (!weekdays.includes(dayOfWeek)) {
    console.log(`Not a weekday (${dayOfWeek}), returning empty worker list`);
    return [];
  }

  const { data: workers, error } = await supabase
    .from('workers')
    .select('id, name, email, organization_id')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching workers:', error);
    return [];
  }

  console.log(`Fetched ${workers?.length || 0} active workers`);
  return workers || [];
}

async function handleClockInReminders(
  supabase: any, 
  currentTime: string, 
  siteDate: Date, 
  workers: Worker[]
): Promise<number> {
  let sent = 0;
  const notifType = `clock_in_${currentTime.replace(':', '')}`;
  
  console.log(`Processing clock-in reminders for ${currentTime}`);

  for (const worker of workers) {
    // Check idempotency
    const alreadySent = await checkNotificationSent(supabase, worker.id, notifType, siteDate);
    if (alreadySent) {
      console.log(`Notification ${notifType} already sent to ${worker.name}`);
      continue;
    }

    // Check if already clocked in
    const clockedIn = await isWorkerClockedIn(supabase, worker.id, siteDate);
    if (clockedIn) {
      console.log(`Worker ${worker.name} already clocked in, canceling remaining clock-in reminders`);
      await cancelNotifications(supabase, worker.id, siteDate, 'clock_in_');
      continue;
    }

    // Send reminder
    const title = getClockInTitle(currentTime);
    const body = 'Shift starts at 7:00. Please clock in.';
    
    await sendNotification(supabase, worker.id, title, body, notifType, siteDate);
    await logNotification(supabase, worker.id, notifType, siteDate);
    
    sent++;
    console.log(`Sent clock-in reminder to ${worker.name} at ${currentTime}`);
  }

  return sent;
}

async function handleClockOutReminders(
  supabase: any, 
  currentTime: string, 
  siteDate: Date, 
  workers: Worker[]
): Promise<number> {
  let sent = 0;
  const notifType = `clock_out_${currentTime.replace(':', '')}`;
  
  console.log(`Processing clock-out reminders for ${currentTime}`);

  for (const worker of workers) {
    // Check idempotency
    const alreadySent = await checkNotificationSent(supabase, worker.id, notifType, siteDate);
    if (alreadySent) {
      console.log(`Notification ${notifType} already sent to ${worker.name}`);
      continue;
    }

    // Check if still clocked in
    const stillClockedIn = await isWorkerStillClockedIn(supabase, worker.id, siteDate);
    if (!stillClockedIn) {
      console.log(`Worker ${worker.name} already clocked out, canceling remaining clock-out reminders`);
      await cancelNotifications(supabase, worker.id, siteDate, 'clock_out_');
      continue;
    }

    // Send reminder
    const title = getClockOutTitle(currentTime);
    const body = 'Shift ended at 15:00. Please clock out.';
    
    await sendNotification(supabase, worker.id, title, body, notifType, siteDate);
    await logNotification(supabase, worker.id, notifType, siteDate);
    
    sent++;
    console.log(`Sent clock-out reminder to ${worker.name} at ${currentTime}`);
  }

  return sent;
}

async function handleAutoClockOut(
  supabase: any, 
  siteDate: Date, 
  workers: Worker[]
): Promise<number> {
  let performed = 0;
  
  console.log(`\n========== AUTO CLOCK-OUT at 17:00 ==========`);
  console.log(`Processing ${workers.length} workers for date: ${siteDate.toISOString().split('T')[0]}`);

  for (const worker of workers) {
    console.log(`\n--- Worker: ${worker.name} (${worker.id}) ---`);
    
    // Check if audit already exists (idempotency)
    const auditExists = await checkAuditExists(supabase, worker.id, siteDate);
    if (auditExists) {
      console.log(`✓ Audit already exists - skipping`);
      continue;
    }

    // Get today's entry BEFORE guard checks (for logging)
    const entry = await getTodayEntry(supabase, worker.id, siteDate);
    console.log(`Clock entry:`, entry ? `Found (${entry.id}, clocked_in: ${entry.clock_in}, clocked_out: ${entry.clock_out})` : 'NOT FOUND');
    
    // Run guard checks
    const checks = await runGuardChecks(supabase, worker.id, siteDate);
    console.log(`Guard checks: canAutoClockOut=${checks.canAutoClockOut}, reason=${checks.reason}`);
    
    if (!checks.canAutoClockOut) {
      console.log(`❌ Cannot auto clock-out: ${checks.reason}`);
      
      // Log audit with reason
      await createAudit(supabase, worker.id, siteDate, false, checks.reason);

      // If limit-related, send warning
      const limitReasons = ['CAP_MONTH', 'CAP_ROLLING14', 'CONSECUTIVE_BLOCK'];
      if (limitReasons.includes(checks.reason)) {
        await sendNotification(
          supabase,
          worker.id,
          '⚠️ Clock Out Now',
          'Auto clock-out disabled due to frequency limits. Please clock out manually.',
          'limit_warning'
        );
      }
      continue;
    }

    // Get today's entry again to perform clock-out (already fetched above, but keeping for clarity)
    if (!entry) {
      console.error(`No clock entry found for ${worker.name}, cannot auto clock-out`);
      await createAudit(supabase, worker.id, siteDate, false, 'NO_CLOCK_IN');
      continue;
    }

    // Perform auto clock-out
    const clockOutTime = new Date(siteDate);
    clockOutTime.setHours(17, 0, 0, 0);

    const clockInTime = new Date(entry.clock_in);
    const totalHours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

    console.log(`Performing auto clock-out: totalHours=${totalHours.toFixed(2)}`);

    const { error: updateError } = await supabase
      .from('clock_entries')
      .update({
        clock_out: clockOutTime.toISOString(),
        source: 'system_auto',
        photo_required: false,
        auto_clocked_out: true,
        total_hours: totalHours,
        notes: `Auto clocked-out at 17:00 (2 hours after shift end)`
      })
      .eq('id', entry.id);

    if (updateError) {
      console.error(`Error auto clocking out ${worker.name}:`, updateError);
      await createAudit(supabase, worker.id, siteDate, false, 'UNKNOWN');
      continue;
    }

    // Update counters
    await incrementCounters(supabase, worker.id, siteDate);

    // Log audit
    await createAudit(supabase, worker.id, siteDate, true, 'OK');

    // Send confirmation
    await sendNotification(
      supabase,
      worker.id,
      'Auto Clocked-Out',
      'You were auto clocked-out at 17:00.',
      'auto_clockout_confirm',
      siteDate
    );

    // Cancel any remaining clock-out reminders
    await cancelNotifications(supabase, worker.id, siteDate, 'clock_out_');

    performed++;
    console.log(`✅ Successfully auto clocked-out ${worker.name}`);
  }

  console.log(`\n========== AUTO CLOCK-OUT COMPLETE: ${performed} performed ==========\n`);
  return performed;
}

// ============================================================================
// Guard Checks
// ============================================================================

async function runGuardChecks(supabase: any, workerId: string, shiftDate: Date): Promise<GuardResult> {
  // 1. Check if clocked in today
  const entry = await getTodayEntry(supabase, workerId, shiftDate);
  if (!entry) {
    console.log(`  Guard: NO_CLOCK_IN - no entry found for date`);
    return { canAutoClockOut: false, reason: 'NO_CLOCK_IN' };
  }

  // 2. Check if already clocked out
  if (entry.clock_out) {
    console.log(`  Guard: ALREADY_CLOCKED_OUT - clock_out exists: ${entry.clock_out}`);
    return { canAutoClockOut: false, reason: 'ALREADY_CLOCKED_OUT' };
  }

  // 3. Check if today is a scheduled shift day (already verified by caller, but double-check)
  const dayOfWeek = shiftDate.getDay();
  const weekdays = [1, 2, 3, 4, 5];
  if (!weekdays.includes(dayOfWeek)) {
    console.log(`  Guard: NO_SHIFT - not a weekday (${dayOfWeek})`);
    return { canAutoClockOut: false, reason: 'NO_SHIFT' };
  }

  // 4. Get/create counter record
  const month = shiftDate.toISOString().slice(0, 7); // YYYY-MM
  const counter = await getOrCreateCounter(supabase, workerId, month);
  console.log(`  Guard: Counter check - monthly: ${counter.count_monthly}/3`);

  // 5. Check monthly cap (≤3)
  if (counter.count_monthly >= 3) {
    console.log(`  Guard: CAP_MONTH - monthly limit reached (${counter.count_monthly})`);
    return { canAutoClockOut: false, reason: 'CAP_MONTH' };
  }

  // 6. Check rolling 14-day cap (≤2)
  const rolling14Count = await getRolling14DayCount(supabase, workerId, shiftDate);
  console.log(`  Guard: Rolling 14-day check - count: ${rolling14Count}/2`);
  if (rolling14Count >= 2) {
    console.log(`  Guard: CAP_ROLLING14 - rolling 14-day limit reached (${rolling14Count})`);
    return { canAutoClockOut: false, reason: 'CAP_ROLLING14' };
  }

  // 7. Check consecutive workdays
  const yesterday = new Date(shiftDate);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const yesterdayAudit = await getAudit(supabase, workerId, yesterday);
  if (yesterdayAudit?.performed) {
    const yesterdayDOW = yesterday.getDay();
    // Only block if yesterday was also a weekday (consecutive workday)
    if (weekdays.includes(yesterdayDOW)) {
      console.log(`  Guard: CONSECUTIVE_BLOCK - auto clocked-out yesterday (${yesterday.toISOString().split('T')[0]})`);
      return { canAutoClockOut: false, reason: 'CONSECUTIVE_BLOCK' };
    }
  }

  console.log(`  Guard: OK - all checks passed`);
  return { canAutoClockOut: true, reason: 'OK' };
}

// ============================================================================
// Counter Management
// ============================================================================

async function getOrCreateCounter(supabase: any, workerId: string, month: string) {
  const { data: existing } = await supabase
    .from('auto_clockout_counters')
    .select('*')
    .eq('worker_id', workerId)
    .eq('month', month)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  // Create new counter
  const { data: newCounter } = await supabase
    .from('auto_clockout_counters')
    .insert({
      worker_id: workerId,
      month: month,
      count_monthly: 0,
      rolling14_count: 0
    })
    .select()
    .single();

  return newCounter || { count_monthly: 0, rolling14_count: 0 };
}

async function incrementCounters(supabase: any, workerId: string, shiftDate: Date) {
  const month = shiftDate.toISOString().slice(0, 7);
  
  const { error } = await supabase
    .from('auto_clockout_counters')
    .upsert({
      worker_id: workerId,
      month: month,
      count_monthly: supabase.raw('COALESCE(count_monthly, 0) + 1'),
      last_auto_clockout_at: new Date().toISOString(),
      last_workday_auto: shiftDate.toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error incrementing counters:', error);
  }
}

async function getRolling14DayCount(supabase: any, workerId: string, shiftDate: Date): Promise<number> {
  const fourteenDaysAgo = new Date(shiftDate);
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { count, error } = await supabase
    .from('auto_clockout_audit')
    .select('*', { count: 'exact', head: true })
    .eq('worker_id', workerId)
    .eq('performed', true)
    .gte('shift_date', fourteenDaysAgo.toISOString().split('T')[0]);

  if (error) {
    console.error('Error getting rolling 14 count:', error);
    return 0;
  }

  return count || 0;
}

// ============================================================================
// Audit Functions
// ============================================================================

async function checkAuditExists(supabase: any, workerId: string, shiftDate: Date): Promise<boolean> {
  const { data } = await supabase
    .from('auto_clockout_audit')
    .select('id')
    .eq('worker_id', workerId)
    .eq('shift_date', shiftDate.toISOString().split('T')[0])
    .maybeSingle();

  return !!data;
}

async function getAudit(supabase: any, workerId: string, shiftDate: Date) {
  const { data } = await supabase
    .from('auto_clockout_audit')
    .select('*')
    .eq('worker_id', workerId)
    .eq('shift_date', shiftDate.toISOString().split('T')[0])
    .maybeSingle();

  return data;
}

async function createAudit(
  supabase: any, 
  workerId: string, 
  shiftDate: Date, 
  performed: boolean, 
  reason: string
) {
  const { error } = await supabase
    .from('auto_clockout_audit')
    .insert({
      worker_id: workerId,
      shift_date: shiftDate.toISOString().split('T')[0],
      performed: performed,
      reason: reason,
      decided_at: new Date().toISOString(),
      decided_by: 'system'
    });

  if (error) {
    console.error('Error creating audit:', error);
  }
}

// ============================================================================
// Clock Entry Functions
// ============================================================================

async function getTodayEntry(supabase: any, workerId: string, siteDate: Date): Promise<ClockEntry | null> {
  // Extract date-only string (YYYY-MM-DD) to avoid timezone issues
  const dateOnly = siteDate.toISOString().split('T')[0];
  
  // Query for entries on this date (comparing dates in UTC)
  const { data } = await supabase
    .from('clock_entries')
    .select('id, clock_in, clock_out, job_id')
    .eq('worker_id', workerId)
    .gte('clock_in', `${dateOnly}T00:00:00.000Z`)
    .lt('clock_in', `${dateOnly}T23:59:59.999Z`)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

async function isWorkerClockedIn(supabase: any, workerId: string, siteDate: Date): Promise<boolean> {
  const entry = await getTodayEntry(supabase, workerId, siteDate);
  return !!entry;
}

async function isWorkerStillClockedIn(supabase: any, workerId: string, siteDate: Date): Promise<boolean> {
  const entry = await getTodayEntry(supabase, workerId, siteDate);
  return entry && !entry.clock_out;
}

// ============================================================================
// Notification Functions
// ============================================================================

async function checkNotificationSent(
  supabase: any, 
  workerId: string, 
  notifType: string, 
  siteDate: Date
): Promise<boolean> {
  const { data } = await supabase
    .from('notification_log')
    .select('id')
    .eq('worker_id', workerId)
    .eq('notification_type', notifType)
    .eq('shift_date', siteDate.toISOString().split('T')[0])
    .eq('canceled', false)
    .maybeSingle();

  return !!data;
}

async function logNotification(
  supabase: any, 
  workerId: string, 
  notifType: string, 
  siteDate: Date
) {
  await supabase
    .from('notification_log')
    .insert({
      worker_id: workerId,
      notification_type: notifType,
      shift_date: siteDate.toISOString().split('T')[0],
      sent_at: new Date().toISOString(),
      canceled: false
    });
}

async function cancelNotifications(
  supabase: any, 
  workerId: string, 
  siteDate: Date, 
  typePrefix: string
) {
  await supabase
    .from('notification_log')
    .update({ canceled: true })
    .eq('worker_id', workerId)
    .eq('shift_date', siteDate.toISOString().split('T')[0])
    .like('notification_type', `${typePrefix}%`);
}

async function sendNotification(
  supabase: any, 
  workerId: string, 
  title: string, 
  body: string, 
  type: string,
  shiftDate?: Date
) {
  try {
    // Generate dedupe key for idempotency
    const dateStr = shiftDate ? shiftDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const dedupeKey = `${workerId}:${dateStr}:${type}`;

    // Check if already sent (idempotency)
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .maybeSingle();

    if (existing) {
      console.log(`Notification already sent: ${dedupeKey}`);
      return;
    }

    // Insert notification with dedupe key
    const { error } = await supabase
      .from('notifications')
      .insert({
        worker_id: workerId,
        title: title,
        body: body,
        type: type,
        dedupe_key: dedupeKey,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error sending notification:', error);
    } else {
      console.log(`Notification sent: ${type} to worker ${workerId}`);
    }
  } catch (error) {
    console.error('Error in sendNotification:', error);
  }
}

// ============================================================================
// Notification Templates
// ============================================================================

function getClockInTitle(time: string): string {
  const titles: Record<string, string> = {
    '06:55': '⏰ Shift Starting Soon',
    '07:00': '🌅 Shift Start Time',
    '07:15': '⚠️ Late Clock-In Reminder'
  };
  return titles[time] || 'Clock In Reminder';
}

function getClockOutTitle(time: string): string {
  const titles: Record<string, string> = {
    '15:00': '✅ Shift End Time',
    '15:30': '🏠 Time to Clock Out',
    '16:00': '⏰ Final Clock-Out Reminder'
  };
  return titles[time] || 'Clock Out Reminder';
}
