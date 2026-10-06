/* Lakes field portal: GPS capture and WGS84 -> UTM (Kruger series). */
'use strict';
(function () {
  const TT = window.TT;

  TT.UTM_ZONE = 44; // EPSG:32644, as used in the QGIS catchment work

  // WGS84 -> UTM north (Karney 2011 / Kruger n^3 series; sub-millimetre within a zone).
  TT.utm = function (lat, lon, zone = TT.UTM_ZONE) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
    const n = f / (2 - f);
    const A = (a / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64);
    const al = [0, n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3];
    const rad = Math.PI / 180;
    const phi = lat * rad;
    const dl = (lon - (zone * 6 - 183)) * rad;
    const e2n = (2 * Math.sqrt(n)) / (1 + n);
    const t = Math.sinh(Math.atanh(Math.sin(phi)) - e2n * Math.atanh(e2n * Math.sin(phi)));
    const xi = Math.atan2(t, Math.cos(dl));
    const eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
    let E = eta, N = xi;
    for (let j = 1; j <= 3; j++) {
      E += al[j] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
      N += al[j] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    }
    return { e: 500000 + k0 * A * E, n: (lat < 0 ? 10000000 : 0) + k0 * A * N, zone };
  };

  TT.distM = function (a, b) {
    const r = 6371008.8, rad = Math.PI / 180;
    const dp = (b.lat - a.lat) * rad, dl = (b.lon - a.lon) * rad;
    const s = Math.sin(dp / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dl / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(s));
  };
  TT.bearing = function (a, b) {
    const rad = Math.PI / 180;
    const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
    const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
    return (Math.atan2(y, x) / rad + 360) % 360;
  };
  TT.compass8 = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

  TT.gpsText = function (g) {
    if (!g || !Number.isFinite(g.lat)) return '';
    const acc = Number.isFinite(g.acc) ? ` ±${Math.round(g.acc)} m` : '';
    return `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}${acc}`;
  };

  /*
   * Watch the position until accuracy <= target or maxWait elapses.
   * average=true keeps collecting for the whole window and returns an
   * inverse-variance weighted mean (use for benchmarks / gauges).
   */
  TT.watchFix = function ({ maxWait = 45000, target = 6, average = false, onUpdate, onDone } = {}) {
    if (!('geolocation' in navigator)) {
      setTimeout(() => onDone && onDone(null, 'This device/browser has no GPS access.'), 0);
      return { stop() {} };
    }
    const fixes = [];
    let best = null, done = false, watchId = null;
    const finish = (err) => {
      if (done) return;
      done = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      let out = best ? { ...best } : null;
      if (average && fixes.length > 1) {
        const lim = Math.max(best.acc * 2, 8);
        const use = fixes.filter((f) => f.acc <= lim);
        let sw = 0, la = 0, lo = 0, al = 0, swa = 0;
        for (const f of use) {
          const w = 1 / Math.max(f.acc, 1) ** 2;
          sw += w; la += w * f.lat; lo += w * f.lon;
          if (Number.isFinite(f.alt)) { al += w * f.alt; swa += w; }
        }
        out = { lat: la / sw, lon: lo / sw, acc: Math.round((1 / Math.sqrt(sw)) * 10) / 10, alt: swa ? al / swa : best.alt, n: use.length, t: best.t, averaged: true };
      }
      if (out) out.n = out.n || fixes.length;
      onDone && onDone(out, out ? null : err || 'No position received. Move to open sky and retry.');
    };
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
        const fx = {
          lat: c.latitude, lon: c.longitude, acc: Math.round(c.accuracy * 10) / 10,
          alt: c.altitude == null ? null : Math.round(c.altitude * 10) / 10,
          t: new Date(pos.timestamp || Date.now()).toISOString(),
        };
        fixes.push(fx);
        TT.lastFix = { ...fx, at: Date.now() };
        if (!best || fx.acc < best.acc) best = fx;
        onUpdate && onUpdate(fx, best, fixes.length);
        if (!average && fx.acc <= target) finish();
      },
      (err) => {
        if (err.code === 1) finish('Location permission denied. Allow location for this site in the browser settings.');
        else if (!fixes.length && err.code !== 3) finish(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maxWait }
    );
    const timer = setTimeout(() => finish(), maxWait);
    return { stop: () => finish() };
  };

  // Quick, non-blocking position for photo stamps; offline cold starts can be slow, so fall back to a fix from the last 15 min.
  TT.quickFix = () => new Promise((res) => {
    const last = () => {
      const f = TT.lastFix;
      return f && Date.now() - f.at < 15 * 60000 ? { lat: f.lat, lon: f.lon, acc: Math.round(f.acc), alt: f.alt, last: true } : null;
    };
    if (!('geolocation' in navigator)) return res(last());
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const fx = { lat: p.coords.latitude, lon: p.coords.longitude, acc: Math.round(p.coords.accuracy), alt: p.coords.altitude };
        TT.lastFix = { ...fx, at: Date.now() };
        res(fx);
      },
      () => res(last()),
      { enableHighAccuracy: true, maximumAge: 120000, timeout: 6000 }
    );
  });
})();
