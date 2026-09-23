const SHELL_CACHE = "layoverfuel-shell-v2";
self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(["/", "/icons/icon-192.png"])));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("layoverfuel-shell-") && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  // Account data is never put in the shared service-worker cache.
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  const isNavigation = event.request.mode === "navigate";
  const isAsset = url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/");
  if (!isNavigation && !isAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(isNavigation ? "/" : event.request, response.clone());
      return response;
    } catch {
      return (await cache.match(isNavigation ? "/" : event.request)) || new Response("Unavailable offline", { status: 503 });
    }
  })());
});
