// Sylvia service worker: installability and push notifications. No offline caching yet.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Sylvia", body: event.data ? event.data.text() : "" };
  }
  const level = data.level ?? 1;
  event.waitUntil(
    self.registration.showNotification(data.title || "Sylvia", {
      body: data.body || "",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      icon: "/icon.svg",
      badge: "/icon.svg",
      // Official orders stay on screen until dismissed.
      requireInteraction: level >= 3,
      data: { url: data.url || "/alerts" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/alerts";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(url).then((w) => w?.focus());
      return self.clients.openWindow(url);
    }),
  );
});
