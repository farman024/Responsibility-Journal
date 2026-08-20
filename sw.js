const CACHE = 'woi-v3-2026';
const CORE = ['./', 'index.html', 'manifest.json', 'mask-icon.svg'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Navigations: network-first, fall back to cached shell (offline mode)
  if (e.request.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const net = await fetch(e.request);
        const c = await caches.open(CACHE);
        c.put('./', net.clone());
        return net;
      } catch {
        const c = await caches.open(CACHE);
        return (await c.match('./')) || (await c.match('index.html')) || Response.error();
      }
    })());
    return;
  }

  // Fonts: cache-first (works offline after first visit)
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(e.request);
      if (hit) return hit;
      try {
        const net = await fetch(e.request);
        if (net.ok || net.type === 'opaque') c.put(e.request, net.clone());
        return net;
      } catch { return Response.error(); }
    })());
    return;
  }

  // Same-origin assets: stale-while-revalidate
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(e.request);
      fetch(e.request).then(net => { if (net.ok) c.put(e.request, net.clone()); }).catch(() => {});
      return hit || fetch(e.request);
    })());
  }
});