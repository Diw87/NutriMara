/* Replaced with the exact build inventory by build-pages.mjs. */
const VERSION = "__VERSION__";
const ASSETS = __ASSETS__;
const SCOPE = new URL(self.registration.scope);
const PREFIX = `nutrimara:${SCOPE.pathname}:`;
const CACHE = PREFIX + VERSION;
const urls = ASSETS.map(path => new URL(path, SCOPE).href);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls)));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const navigation = event.request.mode === "navigate";
  if (!navigation && !urls.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const match = await cache.match(navigation ? new URL("index.html", SCOPE).href : event.request);
    return match || fetch(event.request);
  })());
});
