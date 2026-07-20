/* Rocket Launch Tracker — service worker (network-first, offline fallback) */
const V = "rlt-v2";
const OFFLINE = "offline.html";
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => c.addAll([OFFLINE])).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || !e.request.url.startsWith("http")) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(V).then(c => c.put(e.request, copy)).catch(() => {});
      return r;
    }).catch(() => caches.match(e.request).then(hit =>
      hit || (e.request.mode === "navigate" ? caches.match(OFFLINE) : undefined)))
  );
});
