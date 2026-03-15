// CrewRoster Service Worker — GitHub Pages compatible
// Place this file in the same directory as index.html

const CACHE = 'crewroster-v6';
const EXTERNALS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap',
];

// ── Install: cache the page itself + critical external assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Cache the HTML shell (the scope root = index.html)
      try { await cache.add(self.registration.scope); } catch(_) {}
      // Cache external assets one by one so a single failure doesn't abort all
      for (const url of EXTERNALS) {
        try { await cache.add(url); } catch(_) {}
      }
    })
  );
  self.skipWaiting();
});

// ── Activate: remove stale caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for the HTML page and known assets, network-first for the rest
self.addEventListener('fetch', e => {
  const url = e.request.url;
  const scope = self.registration.scope;

  // Only intercept GET requests
  if (e.request.method !== 'GET') return;

  // Requests we want to serve from cache
  const isShell   = url === scope || url === scope + 'index.html';
  const isExternal = EXTERNALS.some(a => url.startsWith(a.split('?')[0]));
  const isFont     = url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com');

  if (isShell || isExternal || isFont) {
    // Cache-first strategy
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) {
          // Revalidate in background (stale-while-revalidate)
          fetch(e.request).then(r => {
            if (r && r.status === 200) {
              caches.open(CACHE).then(c => c.put(e.request, r.clone()));
            }
          }).catch(() => {});
          return cached;
        }
        // Not cached yet — fetch and cache
        return fetch(e.request).then(r => {
          if (r && r.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, r.clone()));
          }
          return r;
        }).catch(() => new Response('Offline', { status: 503 }));
      })
    );
  }
  // Everything else: network only (don't interfere with pdfjsLib workers etc.)
});
