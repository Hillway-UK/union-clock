import { supabase } from '@/integrations/supabase/client';

export class NotificationService {
  
  // Generate dedupe key for idempotency
  static getDedupeKey(workerId: string, shiftDate: Date, kind: string, scheduledTime?: string): string {
    const dateStr = shiftDate.toISOString().split('T')[0];
    const timeStr = scheduledTime || '';
    return `${workerId}:${dateStr}:${kind}:${timeStr}`;
  }

  // Check if notification already sent (idempotency)
  static async checkNotificationSent(dedupeKey: string): Promise<boolean> {
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .single();
    
    return !!data;
  }

  // Dual delivery: create in-app row + attempt push
  static async sendDualNotification(
    workerId: string,
    title: string,
    body: string,
    kind: string,
    dedupeKey: string
  ): Promise<void> {
    try {
      // 1. Create in-app notification row (always happens)
      const { error: insertError } = await supabase
        .from('notifications')
        .insert({
          worker_id: workerId,
          title,
          body,
          type: kind,
          dedupe_key: dedupeKey,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Failed to insert in-app notification:', insertError);
      }

      // 2. Attempt push notification (never blocks if permission denied)
      await this.attemptPushNotification(title, body);

    } catch (error) {
      console.error('Error in dual notification delivery:', error);
    }
  }

  // Attempt push notification via ServiceWorker or fallback
  static async attemptPushNotification(title: string, body: string): Promise<void> {
    // Check permission first
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.log('Notification permission not granted, skipping push');
      return;
    }

    try {
      // Prefer ServiceWorker registration
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'autotime-notification',
          requireInteraction: false,
          silent: false
        });
      } else {
        // Fallback to new Notification()
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'autotime-notification',
          requireInteraction: false,
          silent: false
        });
      }
    } catch (error) {
      console.error('Error showing push notification:', error);
      // Don't throw - push failure should not block in-app notification
    }
  }

  // Request notification permission
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
      }
    }

    return false;
  }

  // Enable notifications in database
  static async enableNotifications(workerId: string): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermission();
      
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

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
      await this.attemptPushNotification(
        'Notifications Enabled!',
        'You\'ll receive clock-in/out reminders during your shifts.'
      );

      return true;
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      throw error;
    }
  }

  // Disable notifications
  static async disableNotifications(workerId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .delete()
        .eq('worker_id', workerId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to disable notifications:', error);
      throw error;
    }
  }

  // Check notification status
  static async checkNotificationStatus(workerId: string): Promise<boolean> {
    try {
      const hasPermission = Notification.permission === 'granted';
      if (!hasPermission) return false;
      
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('worker_id', workerId)
        .single();
        
      return !!data;
    } catch (error) {
      console.error('Error checking notification status:', error);
      return false;
    }
  }

  // Get unread count
  static async getUnreadCount(workerId: string): Promise<number> {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('worker_id', workerId)
        .is('read_at', null);
      
      return count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  // Mark all as read
  static async markAllAsRead(workerId: string): Promise<void> {
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('worker_id', workerId)
        .is('read_at', null);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }
}
