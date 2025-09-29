import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    
    console.log(`Running clock status check at ${now.toISOString()}, day: ${dayOfWeek}, time: ${currentTime}`);

    // Only run on weekdays (Monday=1, Friday=5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      console.log('Weekend - skipping notifications');
      return new Response(JSON.stringify({ message: 'Weekend - no notifications sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let notificationsSent = 0;

    // Morning check (9:00 AM) - remind workers who haven't clocked in
    if (currentTime === '09:00') {
      console.log('Running morning reminder check...');
      
      // Get all active workers
      const { data: workers } = await supabase
        .from('workers')
        .select('id, name, email')
        .eq('is_active', true);

      for (const worker of workers || []) {
        // Check if worker has clocked in today
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const { data: todayEntry } = await supabase
          .from('clock_entries')
          .select('id')
          .eq('worker_id', worker.id)
          .gte('clock_in', todayStart.toISOString())
          .single();

        if (!todayEntry) {
          // Worker hasn't clocked in yet - send notification
          await sendPushNotification(
            worker.id, 
            'Good Morning! 🌅', 
            "Don't forget to clock in when you arrive at your job site."
          );
          notificationsSent++;
          console.log(`Sent morning reminder to worker: ${worker.name}`);
        }
      }
    }

    // Evening check (7:00 PM) - remind workers who are still clocked in
    if (currentTime === '19:00') {
      console.log('Running evening reminder check...');
      
      // Get all workers who are currently clocked in
      const { data: activeEntries } = await supabase
        .from('clock_entries')
        .select(`
          id,
          worker_id,
          clock_in,
          workers!inner(id, name, email)
        `)
        .is('clock_out', null);

      for (const entry of activeEntries || []) {
        await sendPushNotification(
          entry.worker_id,
          'End of Day Reminder ⏰',
          "You're still clocked in. Don't forget to clock out!"
        );
        notificationsSent++;
        console.log(`Sent evening reminder to worker: ${(entry.workers as any).name}`);
      }
    }

    // Auto clock-out check (runs every hour)
    console.log('Running auto clock-out check...');
    
    // Get entries that have been clocked in for more than 12 hours
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    const { data: longEntries } = await supabase
      .from('clock_entries')
      .select(`
        id,
        worker_id,
        clock_in,
        workers!inner(id, name, email)
      `)
      .is('clock_out', null)
      .lt('clock_in', twelveHoursAgo.toISOString());

    for (const entry of longEntries || []) {
      // Auto clock-out after 12 hours
      const clockOut = new Date();
      const clockIn = new Date(entry.clock_in);
      const totalHours = 12; // Cap at 12 hours

      const { error: updateError } = await supabase
        .from('clock_entries')
        .update({
          clock_out: clockOut.toISOString(),
          auto_clocked_out: true,
          total_hours: totalHours,
          notes: `Auto clocked-out after 12 hours on ${clockOut.toLocaleDateString()}`
        })
        .eq('id', entry.id);

      if (!updateError) {
        // Send notification about auto clock-out
        await sendPushNotification(
          entry.worker_id,
          'Auto Clock-Out 🔄',
          'You were automatically clocked out after 12 hours.'
        );
        notificationsSent++;
        console.log(`Auto clocked-out worker: ${(entry.workers as any).name}`);
      }
    }

    console.log(`Check completed. Notifications sent: ${notificationsSent}`);
    
    return new Response(JSON.stringify({ 
      message: 'Clock status check completed',
      notificationsSent,
      timestamp: now.toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in clock status check:', error);
    return new Response(JSON.stringify({ 
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendPushNotification(workerId: string, title: string, body: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  try {
    // Store notification in database for persistence
    const { error: dbError } = await supabase
      .from('notifications')
      .insert({
        worker_id: workerId,
        title,
        body,
        type: 'reminder',
        delivered_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Failed to store notification in database:', dbError);
    }

    // Get worker's push token (if available)
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('push_token')
      .eq('worker_id', workerId)
      .single();

    console.log(`NOTIFICATION for worker ${workerId}: ${title} - ${body}`);
    
    // If we have a push token, we could send real push notifications here
    // For now, we'll rely on the in-app notification system
    if (prefs?.push_token) {
      console.log(`Would send push notification to token: ${prefs.push_token}`);
      // TODO: Implement real push notification service integration
      // - Web Push API
      // - Firebase Cloud Messaging
      // - OneSignal
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    
    // Store failed notification for retry
    await supabase
      .from('notifications')
      .insert({
        worker_id: workerId,
        title,
        body,
        type: 'reminder',
        failed_reason: (error as Error).message,
        retry_count: 1
      });
    
    return false;
  }
}