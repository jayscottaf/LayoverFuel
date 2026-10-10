const SHELL_CACHE = "layoverfuel-shell-v3";
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const response = await fetch("/asset-manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("App asset manifest unavailable");
    const manifest = await response.json();
    const assets = Object.values(manifest).flatMap(entry => [entry.file, ...(entry.css || []), ...(entry.assets || [])]);
    if (!assets.length || assets.some(path => typeof path !== "string" || !path.startsWith("assets/") || path.includes(".."))) {
      throw new Error("Invalid app asset manifest");
    }
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(["/", "/icons/icon-192.png", ...new Set(assets.map(path => `/${path}`))]);
    await self.skipWaiting();
  })());
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
