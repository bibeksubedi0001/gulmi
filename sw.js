/* Lakes field portal: offline app shell (cache-first; new versions activate when the user taps "Update now"). */
const VERSION = 'timure-portal-v1.4.0';
const TILE_CACHE = 'gulmi-tiles-v1';
const TILE_MAX = 1500;
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/theme.js',
  'js/util.js', 'js/geo.js', 'js/db.js', 'js/schema-common.js', 'js/engine.js', 'js/forms-community.js',
  'js/forms-engineering.js', 'js/exporter.js', 'js/dashboard.js', 'js/guide.js', 'js/app.js',
  'vendor/xlsx.mini.min.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
  'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
  'data/reference.geojson', 'data/basemap/index.json', 'data/basemap/timure.jpg', 'data/basemap/timure.json',
  'data/basemap/chhekmi.jpg', 'data/basemap/chhekmi.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('timure-portal-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'server.arcgisonline.com' && url.pathname.includes('/tile/')) { e.respondWith(tile(req)); return; }
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('index.html').then((hit) => hit || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  })));
});

// Satellite tiles that were viewed online stay available offline (cache-first, oldest dropped beyond TILE_MAX).
let tilePuts = 0;
async function tile(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'cors') {
    await cache.put(req, res.clone());
    if (++tilePuts % 50 === 0) {
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - TILE_MAX)).map((k) => cache.delete(k)));
    }
  }
  return res;
}
