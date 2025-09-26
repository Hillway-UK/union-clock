import { supabase } from '@/integrations/supabase/client';

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      return false;
    }

    // Check current permission
    if (Notification.permission === 'granted') {
      return true;
    }

    // Request permission
    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        return false;
      }
    }

    return false;
  }

  static async enableNotifications(workerId: string): Promise<boolean> {
    try {
      // First request permission
      const hasPermission = await this.requestPermission();
      
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      // Save preference to database
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          worker_id: workerId,
          morning_reminder: true,
          evening_reminder: true,
          enabled_days: [1, 2, 3, 4, 5], // Mon-Fri
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'worker_id'
        });

      if (error) throw error;

      // Show test notification
      this.showLocalNotification(
        'Notifications Enabled!',
        'You\'ll receive clock-in reminders at 9am and clock-out reminders at 7pm on weekdays.'
      );

      return true;
    } catch (error) {
      throw error;
    }
  }

  static async disableNotifications(workerId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .delete()
        .eq('worker_id', workerId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }

  static showLocalNotification(title: string, body: string): Notification | null {
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'pioneer-timesheets',
          requireInteraction: false,
          silent: false
        });

        // Auto close after 5 seconds
        setTimeout(() => notification.close(), 5000);

        return notification;
      } catch (error) {
        // Fallback to alert on iOS PWA if notification fails
        if ((window.navigator as any).standalone) {
          alert(`${title}\n\n${body}`);
        }
        return null;
      }
    }
    return null;
  }

  static async checkNotificationStatus(workerId: string): Promise<boolean> {
    try {
      // Check if notifications are enabled in browser
      const hasPermission = Notification.permission === 'granted';
      if (!hasPermission) return false;
      
      // Check database preferences
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('worker_id', workerId)
        .single();
        
      return !!data;
    } catch (error) {
      return false;
    }
  }

  static async checkAndNotify(workerId: string): Promise<void> {
    const now = new Date();
    const hours = now.getHours();
    const day = now.getDay();

    // Only check on weekdays
    if (day === 0 || day === 6) return;

    try {
      // Check if notifications are enabled for this worker
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('worker_id', workerId)
        .single();

      if (!prefs) return;

      // Morning reminder at 9am
      if (hours === 9 && prefs.morning_reminder) {
        const today = now.toISOString().split('T')[0];
        const { data: todayEntry } = await supabase
          .from('clock_entries')
          .select('*')
          .eq('worker_id', workerId)
          .gte('clock_in', `${today}T00:00:00`)
          .single();

        if (!todayEntry) {
          this.showLocalNotification(
            'Clock In Reminder',
            'Good morning! Don\'t forget to clock in for today.'
          );
        }
      }

      // Evening reminder at 7pm
      if (hours === 19 && prefs.evening_reminder) {
        const { data: activeEntry } = await supabase
          .from('clock_entries')
          .select('*')
          .eq('worker_id', workerId)
          .is('clock_out', null)
          .single();

        if (activeEntry) {
          this.showLocalNotification(
            'Clock Out Reminder',
            'You\'re still clocked in. Don\'t forget to clock out!'
          );
        }
      }
    } catch (error) {
      // Notification check failed - continue silently
    }
  }
}