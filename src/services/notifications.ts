import { supabase } from '@/integrations/supabase/client';

export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered successfully:', registration);
        return registration;
      }
      return null;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  static async subscribeToPushNotifications(workerId: string): Promise<boolean> {
    try {
      const registration = await this.registerServiceWorker();
      if (!registration) return false;

      // Generate subscription
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          'BMlJWn_9d8m6ht_zzIWH8pXy7VbK1l_p8OEo2R2BFZ4w-r9a2B3Q2F2a3X1K2F9s8E4t5Y1s2A7X3b4H1j6k9M'
        )
      });

      // Store subscription in localStorage for now (will be in DB later)
      localStorage.setItem(`push_subscription_${workerId}`, JSON.stringify(subscription));
      
      console.log('Push notification subscription successful');
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    }
  }

  static showLocalNotification(title: string, body: string, icon?: string): void {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'pioneer-timesheets',
        requireInteraction: true
      });
    }
  }

  static async checkNotificationStatus(workerId: string): Promise<boolean> {
    try {
      // Check localStorage for subscription
      const subscription = localStorage.getItem(`push_subscription_${workerId}`);
      return !!subscription && Notification.permission === 'granted';
    } catch (error) {
      return false;
    }
  }

  static async updateNotificationPreferences(workerId: string, preferences: {
    morning_reminder?: boolean;
    evening_reminder?: boolean;
    reminder_time_morning?: string;
    reminder_time_evening?: string;
    enabled_days?: number[];
  }): Promise<boolean> {
    try {
      // Store preferences in localStorage for now
      const existingPrefs = localStorage.getItem(`notification_prefs_${workerId}`);
      const currentPrefs = existingPrefs ? JSON.parse(existingPrefs) : {};
      
      localStorage.setItem(`notification_prefs_${workerId}`, JSON.stringify({
        ...currentPrefs,
        ...preferences,
        updated_at: new Date().toISOString()
      }));

      return true;
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      return false;
    }
  }

  private static urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Predefined notification messages
  static readonly NOTIFICATIONS = {
    MORNING_REMINDER: {
      title: 'Good Morning! 🌅',
      body: "Don't forget to clock in when you arrive at your job site."
    },
    EVENING_REMINDER: {
      title: 'End of Day Reminder ⏰',
      body: "You're still clocked in. Don't forget to clock out!"
    },
    AUTO_CLOCK_OUT: {
      title: 'Auto Clock-Out 🔄',
      body: 'You were automatically clocked out after 12 hours.'
    },
    NEW_JOB_AVAILABLE: {
      title: 'New Job Available 🏗️',
      body: 'A new job site has been added to your assignments.'
    }
  };
}