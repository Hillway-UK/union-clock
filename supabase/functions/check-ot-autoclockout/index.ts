import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_OT_HOURS = 3;
const GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== CHECK-OT-AUTOCLOCKOUT INVOCATION ===');

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - GRACE_PERIOD_MS).toISOString();
    console.log('Grace period cutoff:', cutoffTime);
    console.log('Processing OT entries as of:', now.toISOString());
    
    let processedCount = 0;

    // 1️⃣ Get all active OT entries
    const { data: activeOTs, error: otError } = await supabase
      .from('clock_entries')
      .select('id, worker_id, job_id, clock_in, jobs(name, latitude, longitude, geofence_radius)')
      .eq('is_overtime', true)
      .is('clock_out', null);

    if (otError) {
      console.error('Error fetching active OT entries:', otError);
      return new Response(JSON.stringify({ error: otError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      });
    }

    console.log(`Found ${activeOTs?.length || 0} active OT entries`);

    for (const entry of activeOTs || []) {
      const clockIn = new Date(entry.clock_in);
      const hoursWorked = (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);

      console.log(`Checking OT entry ${entry.id}:`, {
        worker: entry.worker_id,
        hoursWorked: hoursWorked.toFixed(2),
        maxHours: MAX_OT_HOURS
      });

      let autoClockOutReason: string | null = null;
      let clockOutTime = now.toISOString();

      // 2️⃣ Check for 3-hour time limit
      if (hoursWorked >= MAX_OT_HOURS) {
        autoClockOutReason = 'ot_3hour_limit';
        clockOutTime = new Date(clockIn.getTime() + (MAX_OT_HOURS * 60 * 60 * 1000)).toISOString();
        console.log(`⏰ 3-hour OT limit reached for ${entry.id}`);
      } else {
        // 3️⃣ Check for geofence exit (with 5-minute grace period)
        const { data: exitEvent } = await supabase
          .from('geofence_events')
          .select('id, latitude, longitude, distance_from_center, timestamp')
          .eq('worker_id', entry.worker_id)
          .eq('clock_entry_id', entry.id)
          .eq('event_type', 'exit_detected')
          .eq('processed', false)
          .lt('timestamp', cutoffTime) // Only exits older than 5 minutes
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (exitEvent) {
          const exitAge = (now.getTime() - new Date(exitEvent.timestamp).getTime()) / 1000 / 60; // minutes
          autoClockOutReason = 'ot_geofence_exit';
          clockOutTime = exitEvent.timestamp;
          console.log(`🚶 Geofence exit detected for OT entry ${entry.id} (${exitAge.toFixed(1)} minutes ago, grace period: 5 min)`);
          
          // Mark exit event as processed
          await supabase
            .from('geofence_events')
            .update({ processed: true })
            .eq('id', exitEvent.id);
        }
      }

      // 4️⃣ If auto clock-out needed, perform it
      if (autoClockOutReason) {
        const totalHours = (new Date(clockOutTime).getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        
        // Cap at 3 hours for display
        const displayHours = Math.min(totalHours, MAX_OT_HOURS);

        // Update clock entry
        const { error: updateError } = await supabase
          .from('clock_entries')
          .update({
            clock_out: clockOutTime,
            total_hours: displayHours,
            auto_clocked_out: true,
            auto_clockout_type: autoClockOutReason,
            source: 'system_auto',
            photo_required: false,
            notes: autoClockOutReason === 'ot_3hour_limit'
              ? 'Auto clocked-out after 3-hour OT limit'
              : 'Auto clocked-out - left site during OT'
          })
          .eq('id', entry.id);

        if (updateError) {
          console.error(`Failed to update OT entry ${entry.id}:`, updateError);
          continue;
        }

        // 5️⃣ Create audit log
        const shiftDate = new Date(entry.clock_in).toISOString().split('T')[0];
        await supabase.from('auto_clockout_audit').insert({
          worker_id: entry.worker_id,
          shift_date: shiftDate,
          reason: autoClockOutReason,
          performed: true,
          decided_by: 'system',
          notes: `OT auto-clockout: ${autoClockOutReason === 'ot_3hour_limit' ? '3-hour limit reached' : 'Left geofence'}. Hours: ${displayHours.toFixed(2)}`,
          decided_at: now.toISOString()
        });

        // 6️⃣ Send notification
        const dedupeKey = `${entry.worker_id}:${shiftDate}:ot_auto_clockout`;
        const jobName = entry.jobs?.name || 'Unknown Job';
        
        const clockOutTimeFormatted = new Date(clockOutTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        const clockOutDateFormatted = new Date(clockOutTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });

        const notificationBody = autoClockOutReason === 'ot_3hour_limit'
          ? `You were automatically clocked out after 3 hours of overtime at ${jobName}.\n\n⏰ Clock-Out Time: ${clockOutTimeFormatted} on ${clockOutDateFormatted}\n📅 Total OT Hours: ${displayHours.toFixed(2)}\n\nℹ️ Maximum OT Duration: 3 hours\n\n📝 Need more time? Submit a Time Amendment from your timesheet to extend your overtime hours.`
          : `You were automatically clocked out because you left the ${jobName} site during overtime.\n\n🚶 Reason: Left Job Site (Geofence)\n⏰ Exit Time: ${clockOutTimeFormatted} on ${clockOutDateFormatted}\n📅 Total OT Hours: ${displayHours.toFixed(2)}\n📍 Grace Period: 5 minutes\n\n📝 Need a correction? Submit a Time Amendment from your timesheet.`;

        await supabase.from('notifications').insert({
          worker_id: entry.worker_id,
          title: '⚠️ Overtime Auto Clock-Out',
          body: notificationBody,
          type: 'overtime_auto_clockout',
          dedupe_key: dedupeKey,
          created_at: now.toISOString()
        });

        console.log(`✅ Auto-clocked out OT entry ${entry.id} (${autoClockOutReason})`);
        processedCount++;
      }
    }

    console.log(`Processed ${processedCount} OT auto clock-outs`);

    return new Response(JSON.stringify({ 
      status: 'success', 
      processed: processedCount,
      checked: activeOTs?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('Error in check-ot-autoclockout:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
