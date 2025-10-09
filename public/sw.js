const CACHE_NAME = "AutoTime";
const urlsToCache = [
  "/",
  "/login",
  "/clock",
  "/timesheets",
  "/profile",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    }),
  );
});

// Push notification handling
self.addEventListener("push", (event) => {
  console.log("Push event received:", event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "AutoTime", body: event.data.text() };
    }
  }

  const title = data.title || "AutoTime";
  const options = {
    body: data.body || "New notification",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "autotime-notification",
    requireInteraction: false,
    silent: false,
    data: data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler - navigate to clock screen
self.addEventListener("notificationclick", (event) => {
  console.log("Notification click received:", event);

  event.notification.close();

  // Open the clock screen when notification is clicked
  event.waitUntil(
    clients.matchAll({ type: "window", includeUnmatched: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes("/clock") && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window to /clock
      if (clients.openWindow) {
        return clients.openWindow("/clock");
      }
    }),
  );
});
