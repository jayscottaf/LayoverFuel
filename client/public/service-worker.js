// ✅ Basic service worker for offline caching

self.addEventListener("install", () => {
  console.log("🔥 Service Worker installing...");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  console.log("⚡ Service Worker activated");
});

self.addEventListener("fetch", (event) => {
  // Optional: offline fallback logic
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response("⚠️ You’re offline", {
        status: 503,
        statusText: "offline",
        headers: { "Content-Type": "text/plain" }
      });
    })
  );
});
