/* Lakes field portal: offline app shell (cache-first; new versions activate when the user taps "Update now"). */
const VERSION = 'timure-portal-v1.8.0';
const TILE_CACHE = 'gulmi-tiles-v1';
const TILE_MAX = 1500;
// File -> SHA-256, written by _scratch/stamp_sw.py before each deploy. HTML is not hashed: Cloudflare injects a script into it.
const ASSETS = {
  './': null,
  'index.html': null,
  'manifest.webmanifest': '861bf12031c55f391bf6ce31b2e55c1016b9aecf5a26bf40b6bd323ca6b40a46',
  'css/app.css': 'd3f9ff76ac1cf40a693483833a8924333dbdc129f1b4ad73878adcfc33b8fa7a',
  'js/theme.js': '43ab2842d5469528e4d2ad9f70ae7f3bbcbf9efcb08b320dc2c4e024c29b8467',
  'js/util.js': '98f4c98901267f6ae35421b0e0bd54128f8f15657796bc08fa5bdbfcb51c5f55',
  'js/geo.js': 'f90c6ead8598e3d8733c0d446250bf1b3138a27ba44f3ae262a3b357d194507f',
  'js/db.js': 'a2342d8fe20c7367f59120c8cb15609fcc1744fe8cb9afd1f1450526c36c946e',
  'js/schema-common.js': '785dd6e8bcf11bff291e13a838b966f428699b24bef0b9aba7298460d3515e52',
  'js/engine.js': '27f33bc109374780818cb15caa6c6c23091bd078629787f17b56dabad3a2f9c1',
  'js/forms-community.js': '14b838b619220f3e2cc4744d1afef5d3dbdc862eb779668018989d09e752e6fd',
  'js/forms-engineering.js': '8708b1ce0e58db61085c0abafafc1d59e29466d49b50c40d20039646c3e38651',
  'js/exporter.js': '4f6e640974f0f3ed77e1db24fb40107a1baba4b03fdb56a109adb972f2c74b6f',
  'js/dashboard.js': '46fd9c5b79038c3d8d2415fdb3966ddc5dcd930245eceb5cf44efe775480eee6',
  'js/map.js': '6841ca2764f5487c2361f534a24c3521eadc87f3439acbee89294b56a2270533',
  'js/guide.js': 'f35941f571aefbd52c06d90f4e27c39cb1b80961a05a436ec6a51137a113e370',
  'js/app.js': 'c16f8bebe6778c78680a1326e01206927ff7fbc206bc8af175b55a3d947dda9b',
  'vendor/xlsx.mini.min.js': '0cb353f830d7288385492c83d277b058ddeac664ca51cf1393aa1fd3e2b70939',
  'vendor/leaflet/leaflet.js': 'db49d009c841f5ca34a888c96511ae936fd9f5533e90d8b2c4d57596f4e5641a',
  'vendor/leaflet/leaflet.css': '337bfca5cabd03b39815b2700febe2b3b7edf55921c59cd49f88ecb328212303',
  'vendor/leaflet/images/layers.png': '1dbbe9d028e292f36fcba8f8b3a28d5e8932754fc2215b9ac69e4cdecf5107c6',
  'vendor/leaflet/images/layers-2x.png': '066daca850d8ffbef007af00b06eac0015728dee279c51f3cb6c716df7c42edf',
  'data/reference.geojson': 'bab6c3feb143bce4aea02bedd040de787fe7d2a1caa9dd1c8329f7d78f780482',
  'data/chhekmi_gis.geojson': '8f70256be2cfad04debd8752ff4a1d2eceb88c4f8185ddf07714897fe0dd24d8',
  'data/basemap/index.json': 'c18ad2616a4ad2d89464d32c4f7787ef91ad571230df18b1070da5ca94c42c27',
  'data/basemap/timure.jpg': '0f16250af1d5bdbee304464cff0c95279c93a9c93879d1a553a976c44b5d7c7c',
  'data/basemap/timure.json': '4a9c4857e369524da12f4ecb6238a8cbb5b4abf288857aa836197bbec6ac8a5e',
  'data/basemap/timure-dem.bin': 'cdaf75251dbdfaffe01d99ec1f207f249f257d51ceb1060512dcc0216fd3909f',
  'data/basemap/chhekmi.jpg': 'cad8e0db75b8b2682542e494c9a85c312a6385be0b273749ec54c880f9943cfc',
  'data/basemap/chhekmi.json': '9f6503c6aa2ded3c08bbd1e368b750e9ea3c3ef0e8ccb8c16e2945caad6fa9a8',
  'data/basemap/chhekmi-dem.bin': '77a1c344e0d16398ddfa32262dadffd8bc939b7f937a4d2f3916f55729779f17',
  'icons/icon.svg': 'ac4abb3b5d2b59ce14e1969e86ebe97feb9ed1066a3bd65bb34d03c537e05e67',
  'icons/icon-192.png': '58108adfca90543413fc019463858e8e2e6e2b1808c1c40af0c1abd6896fc8a0',
  'icons/icon-512.png': '267cbec6d320dca213197df56bb4845ae3d0cb242af8f43199d974bb9ab90168',
  'icons/icon-maskable-512.png': '4391668669f50c832586e9e01f56b5d599dc44dd0bfd2366cd109e86a883b7e3',
};

// Always fetch from the origin (unique query skips Cloudflare's edge cache) and refuse files that do not match this
// version's hashes, so a stale worker or CDN copy can never leave a mix of old and new files.
const hex = async (res) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await res.clone().arrayBuffer()))].map((b) => b.toString(16).padStart(2, '0')).join('');
self.addEventListener('install', (e) => {
  const nonce = Date.now().toString(36);
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(Object.entries(ASSETS).map(async ([u, sha]) => {
    const res = await fetch(new Request(`${u}?v=${VERSION}&n=${nonce}`, { cache: 'reload' }));
    if (!res.ok) throw new Error(`${u}: HTTP ${res.status}`);
    if (sha && (await hex(res)) !== sha) throw new Error(`${u}: does not match ${VERSION}`);
    await c.put(u, res);
  }))));
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
