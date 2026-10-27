// Carnet de battue : l'appli et les tuiles déjà vues restent disponibles sans réseau
const APP = 'battue-app-v9', TILES = 'battue-tuiles-v1', MAX_TILES = 3000;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.hostname === 'data.geopf.fr' || u.hostname === 'server.arcgisonline.com') {
    // tuiles : le cache d'abord, puis le réseau (on garde la tuile pour la prochaine fois en forêt)
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok || r.type === 'opaque') { c.put(e.request, r.clone()); trim(c); }
      return r;
    }));
    return;
  }
  // appli : le réseau d'abord pour avoir la dernière version, le cache quand il n'y a pas de réseau
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (u.origin === location.origin || u.hostname === 'cdnjs.cloudflare.com')) {
      const copy = r.clone();
      caches.open(APP).then(c => c.put(e.request, copy));
    }
    return r;
  }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
