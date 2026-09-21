// Minimal service worker — exists only to satisfy PWA installability
// checks so the browser's install prompt (beforeinstallprompt) fires.
// No caching/offline behavior is implemented.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally no-op — pass everything through to the network.
});
