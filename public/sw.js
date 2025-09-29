const CACHE_NAME = 'pioneer-clock-v1';
const urlsToCache = [
  '/',
  '/login',
  '/clock',
  '/timesheets',
  '/profile',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Enhanced notification handling
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received:', event);
  
  event.notification.close();
  
  // Open the app when notification is clicked
  event.waitUntil(
    clients.matchAll().then(clientList => {
      // Check if there's already a window open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes('/clock') && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open new one
      if (clients.openWindow) {
        return clients.openWindow('/clock');
      }
    })
  );
});

// Handle push events for background notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'Pioneer Clock',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'pioneer-reminder'
  };

  if (event.data) {
    try {
      notificationData = { ...notificationData, ...event.data.json() };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: true,
      actions: [
        {
          action: 'view',
          title: 'View App'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ]
    })
  );
});

// Handle notification action clicks
self.addEventListener('notificationaction', (event) => {
  console.log('Notification action clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/clock')
    );
  }
});