/**
 * Supabase Edge Function: check-grace-expiry
 *
 * Runs via cron every 1–2 minutes.
 * Finds workers who left the geofence >5 minutes ago (4-min grace + 1-min buffer)
 * and automatically clocks them out if they never re-entered.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Timing thresholds
const GRACE_MINUTES = 4;
const RACE_BUFFER_SEC = 60;
const AUTO_DELAY_MS = (GRACE_MINUTES * 60 + RACE_BUFFER_SEC) * 1000; // 5 minutes total
const ACCURACY_PASS_M = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - AUTO_DELAY_MS).toISOString();

    console.log("=== CHECK-GRACE-EXPIRY INVOCATION ===");
    console.log("Cutoff:", cutoffTime);

    // 1️⃣ Find exit_detected events older than 5 minutes that haven't been resolved
    const { data: exits, error: exitError } = await supabase
      .from("geofence_events")
      .select("id, worker_id, clock_entry_id, latitude, longitude, accuracy, distance_from_center, job_radius, safe_out_threshold, timestamp")
      .eq("event_type", "exit_detected")
      .lt("timestamp", cutoffTime);

    if (exitError) throw exitError;
    if (!exits || exits.length === 0) {
      console.log("No expired exit_detected events to process.");
      return new Response(JSON.stringify({ status: "no_pending_exits" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Found ${exits.length} expired exits to review.`);

    let processedCount = 0;
    for (const exit of exits) {
      console.log(`Processing clock_entry_id ${exit.clock_entry_id} for worker ${exit.worker_id}`);

      // 2️⃣ Check if already re-entered or confirmed
      const { data: existingEvents } = await supabase
        .from("geofence_events")
        .select("event_type")
        .eq("clock_entry_id", exit.clock_entry_id)
        .in("event_type", ["re_entry", "exit_confirmed"]);

      if (existingEvents && existingEvents.length > 0) {
        console.log(`Skipping ${exit.clock_entry_id} (already handled: ${existingEvents.map((e) => e.event_type).join(", ")})`);
        continue;
      }

      // 3️⃣ Check if manual clock-out happened
      const { data: clockEntry } = await supabase
        .from("clock_entries")
        .select("clock_out, auto_clocked_out, clock_in, job_id, worker_id")
        .eq("id", exit.clock_entry_id)
        .single();

      if (!clockEntry) {
        console.log(`Clock entry not found for ${exit.clock_entry_id}`);
        continue;
      }

      if (clockEntry.clock_out && !clockEntry.auto_clocked_out) {
        console.log(`Skipping ${exit.clock_entry_id} (manual clockout detected).`);
        continue;
      }

      // 4️⃣ Check for re-entry by looking at recent location_fix events
      const { data: recentFixes } = await supabase
        .from("geofence_events")
        .select("distance_from_center, safe_out_threshold, timestamp")
        .eq("clock_entry_id", exit.clock_entry_id)
        .eq("event_type", "location_fix")
        .gt("timestamp", exit.timestamp)
        .order("timestamp", { ascending: false })
        .limit(5);

      if (recentFixes && recentFixes.length > 0) {
        // Check if any recent fix shows worker back inside geofence
        const reEntered = recentFixes.some(
          (fix) => fix.distance_from_center < fix.safe_out_threshold
        );
        if (reEntered) {
          console.log(`Skipping ${exit.clock_entry_id} (worker re-entered the geofence)`);
          // Record re_entry event
          await supabase.from("geofence_events").insert({
            worker_id: exit.worker_id,
            clock_entry_id: exit.clock_entry_id,
            shift_date: new Date(clockEntry.clock_in).toISOString().split("T")[0],
            event_type: "re_entry",
            latitude: recentFixes[0].latitude,
            longitude: recentFixes[0].longitude,
            accuracy: exit.accuracy,
            distance_from_center: recentFixes[0].distance_from_center,
            job_radius: exit.job_radius,
            safe_out_threshold: exit.safe_out_threshold,
            timestamp: new Date().toISOString(),
          });
          continue;
        }
      }

      // 5️⃣ Auto-clock-out the worker
      const clockOutTime = new Date().toISOString();
      const totalHours =
        (new Date(clockOutTime).getTime() - new Date(clockEntry.clock_in).getTime()) /
        (1000 * 60 * 60);

      const { error: updateError } = await supabase
        .from("clock_entries")
        .update({
          clock_out: clockOutTime,
          auto_clocked_out: true,
          auto_clockout_type: "geofence",
          total_hours: totalHours,
          geofence_exit_data: {
            distance: exit.distance_from_center,
            accuracy: exit.accuracy,
            threshold: exit.safe_out_threshold,
            radius: exit.job_radius,
          },
          notes: `Auto clocked-out by geofence grace expiry at ${new Date(clockOutTime).toLocaleTimeString()}`,
        })
        .eq("id", exit.clock_entry_id)
        .is("clock_out", null);

      if (updateError) {
        console.error(`Failed to update clock entry ${exit.clock_entry_id}:`, updateError);
        continue;
      }

      // 6️⃣ Get job details for notification
      const { data: job } = await supabase
        .from("jobs")
        .select("name")
        .eq("id", clockEntry.job_id)
        .single();

      const jobName = job?.name || "Unknown Job";

      // 7️⃣ Record exit_confirmed
      await supabase.from("geofence_events").insert({
        worker_id: exit.worker_id,
        clock_entry_id: exit.clock_entry_id,
        shift_date: new Date(clockEntry.clock_in).toISOString().split("T")[0],
        event_type: "exit_confirmed",
        latitude: exit.latitude,
        longitude: exit.longitude,
        accuracy: exit.accuracy,
        distance_from_center: exit.distance_from_center,
        job_radius: exit.job_radius,
        safe_out_threshold: exit.safe_out_threshold,
        timestamp: clockOutTime,
      });

      // 8️⃣ Record audit log
      await supabase.from("auto_clockout_audit").insert({
        worker_id: exit.worker_id,
        shift_date: new Date(clockEntry.clock_in).toISOString().split("T")[0],
        reason: "geofence_exit",
        performed: true,
        decided_by: "system",
        notes: `Geofence auto-clockout for ${jobName}. Distance: ${exit.distance_from_center.toFixed(2)}m, Threshold: ${exit.safe_out_threshold}m`,
        decided_at: new Date().toISOString(),
      });

      // 9️⃣ Send notification with dedupe key
      const dedupeKey = `${exit.worker_id}:${new Date(clockEntry.clock_in).toISOString().split("T")[0]}:auto_clockout`;
      
      const { error: notifError } = await supabase.from("notifications").insert({
        worker_id: exit.worker_id,
        title: "⏰ Auto Clocked-Out: Geofence Exit",
        body: `You were automatically clocked out at ${new Date(clockOutTime).toLocaleTimeString()} because you left the ${jobName} site.\n\n🚶 Reason: Left Job Site Geofence\n📍 Distance: ${exit.distance_from_center.toFixed(0)}m from center\n⏰ Clock-Out Time: ${new Date(clockOutTime).toLocaleTimeString()}\n📅 Total Hours: ${totalHours.toFixed(2)}\n\nNeed a correction? Submit a Time Amendment from your timesheet.`,
        type: "geofence_auto_clockout",
        dedupe_key: dedupeKey,
        created_at: new Date().toISOString(),
      });

      if (notifError) console.error("Failed to send notification:", notifError);

      console.log(`✅ Auto-clockout completed for ${exit.worker_id} (${exit.clock_entry_id})`);
      processedCount++;
    }

    return new Response(JSON.stringify({ status: "processed", count: processedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Error in check-grace-expiry:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
