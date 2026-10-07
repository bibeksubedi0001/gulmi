/* Lakes field portal: field map (offline basemap, survey layers, GPS position, point info, measuring, GPS tracks). */
'use strict';
(function () {
  const TT = window.TT;
  const { h, icon } = TT;
  const NS = 'http://www.w3.org/2000/svg';
  const ok = (g) => g && Number.isFinite(g.lat) && Number.isFinite(g.lon);
  const kv = (k, v) => h('div.kv', h('span', { text: k }), h('b', { text: v }));
  const fmtDist = (m) => (m == null ? '—' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);
  const fmtArea = (a) => (a == null ? '—' : a < 10000 ? `${Math.round(a).toLocaleString('en')} m²` : `${(a / 10000).toFixed(2)} ha (${Math.round(a).toLocaleString('en')} m²)`);

  TT.loadCss = (href) => new Promise((res) => {
    if (document.querySelector(`link[href="${href}"]`)) return res();
    const l = h('link', { rel: 'stylesheet', href });
    l.onload = () => res();
    l.onerror = () => res();
    document.head.append(l);
  });

  /* ---------- offline basemap and terrain (precached by the service worker) ---------- */
  let basemap = null;
  const dems = [];
  async function loadBasemap() {
    if (basemap) return basemap;
    const idx = await (await fetch(TT.asset('data/basemap/index.json'))).json();
    for (const a of idx.areas) {
      if (!a.dem) continue;
      const buf = await (await fetch(TT.asset('data/basemap/' + a.dem.file))).arrayBuffer();
      dems.push({ ...a.dem, z: new Int16Array(buf) });
    }
    basemap = idx;
    return idx;
  }
  // Ground elevation (m) from the 30 m Copernicus DEM, bilinear; null outside the two lake areas.
  TT.demAt = (lat, lon) => {
    for (const d of dems) {
      const c = (lon - d.west) / d.dx - 0.5, r = (lat - d.north) / d.dy - 0.5;
      if (c < 0 || r < 0 || c > d.cols - 1 || r > d.rows - 1) continue;
      const c0 = Math.floor(c), r0 = Math.floor(r), c1 = Math.min(c0 + 1, d.cols - 1), r1 = Math.min(r0 + 1, d.rows - 1);
      const fc = c - c0, fr = r - r0, z = (rr, cc) => d.z[rr * d.cols + cc];
      return (z(r0, c0) * (1 - fc) + z(r0, c1) * fc) * (1 - fr) + (z(r1, c0) * (1 - fc) + z(r1, c1) * fc) * fr;
    }
    return null;
  };

  const OFF_STYLE = {
    r1: { color: '#b03a2e', weight: 2.6 }, r2: { color: '#6b5b4b', weight: 1.8 }, tr: { color: '#8a6d3b', weight: 1.5, dashArray: '6 3' },
    pa: { color: '#6f6f6f', weight: 1.2, dashArray: '2 3' }, st: { color: '#2a7fbf', weight: 1.2 }, ri: { color: '#2a7fbf', weight: 2.2 },
    wa: { color: '#2a7fbf', weight: 1, fillColor: '#8ec5ea', fillOpacity: 0.7 }, bu: { color: '#4b4b4b', weight: 0.6, fillColor: '#8b8b8b', fillOpacity: 0.8 },
  };
  async function offlineLayers(L_, idx) {
    const renderer = L_.canvas({ padding: 0.3 });
    const base = L_.layerGroup(), contours = L_.layerGroup();
    for (const a of idx.areas) {
      L_.imageOverlay(TT.asset('data/basemap/' + a.image), a.bounds, { pane: 'tilePane', attribution: idx.attribution }).addTo(base);
      const fc = await (await fetch(TT.asset('data/basemap/' + a.vectors))).json();
      const pick = (test) => ({ type: 'FeatureCollection', features: fc.features.filter(test) });
      L_.geoJSON(pick((f) => f.properties.k === 'c'), { renderer, interactive: false,
        style: (f) => ({ color: '#9c7a4a', weight: f.properties.i ? 1.1 : 0.5, opacity: f.properties.i ? 0.9 : 0.6 }) }).addTo(contours);
      L_.geoJSON(pick((f) => f.properties.k !== 'c' && f.geometry.type !== 'Point'), { renderer, interactive: false,
        style: (f) => OFF_STYLE[f.properties.k] || { color: '#666', weight: 1 } }).addTo(base);
      for (const f of fc.features) {
        const p = f.properties;
        if (f.geometry.type !== 'Point' || !(p.n || p.e)) continue;
        const [lon, lat] = f.geometry.coordinates;
        const text = [p.n, p.k === 'pk' && p.e ? `${p.e} m` : ''].filter(Boolean).join(' ');
        L_.marker([lat, lon], { icon: L_.divIcon({ className: 'map-lbl map-lbl-' + p.k, html: h('span', { text }), iconSize: null }), interactive: false, keyboard: false }).addTo(base);
      }
    }
    return { base, contours };
  }

  /* ---------- Chhekmi lake, catchment and flow paths from the team's QGIS project (precached) ---------- */
  const GIS_COL = { lake: '#8ec5ea', catchment: '#c43c39', drain: '#2196f3' };
  async function gisLayers(L_) {
    const fc = await (await fetch(TT.asset('data/chhekmi_gis.geojson'))).json();
    const pick = (k) => ({ type: 'FeatureCollection', features: fc.features.filter((f) => f.properties.kind === k) });
    const catchment = L_.geoJSON(pick('catchment'), { style: { color: GIS_COL.catchment, weight: 2.5, fillColor: GIS_COL.catchment, fillOpacity: 0.06 },
      onEachFeature: (f, l) => l.bindTooltip(`Contributing catchment (DEM) · ${fmtArea(f.properties.area_m2)}`) });
    const lake = L_.geoJSON(pick('lake'), { style: { color: '#0b3a8c', weight: 1.5, dashArray: '4 3', fillColor: GIS_COL.lake, fillOpacity: 0.55 },
      onEachFeature: (f, l) => l.bindTooltip(`Chhekmi Taal · approximate outline (GIS extent ${f.properties.extent_m.join(' × ')} m)`) });
    const flow = L_.geoJSON(pick('drain'), { interactive: false, style: (f) => ({ color: GIS_COL.drain, weight: [0, 1.6, 2.3, 3.2][f.properties.w], opacity: 0.95 }) });
    const area = pick('catchment').features.reduce((s, f) => s + f.properties.area_m2, 0);
    return { lakeCatchment: L_.layerGroup([catchment, lake]), flow, bounds: catchment.getBounds(), area };
  }

  /* ---------- survey layers ---------- */
  const CATS = [
    { id: 'hh', label: 'Household interviews', color: '#d9822b' }, { id: 'kii', label: 'Key informants', color: '#b5651d' },
    { id: 'bm', label: 'Benchmarks and gauges', color: '#5b3a85' }, { id: 'feat', label: 'Site features', color: '#1f78b4' },
    { id: 'trk', label: 'GPS tracks', color: '#e67e22' }, { id: 'bath', label: 'Depth transects', color: '#0b6e99' },
    { id: 'soil', label: 'Soil samples', color: '#7a8b2a' }, { id: 'inf', label: 'Infiltration tests', color: '#e07b39' },
    { id: 'q', label: 'Flow measurements', color: '#1b8a8a' },
  ];
  const CAT_COL = Object.fromEntries(CATS.map((c) => [c.id, c.color]));
  const FT_COL = { shore: '#4fa3d8', inflow: '#1f78b4', drain: '#17a2b8', outlet: '#0b3a8c', lining: '#7f7f7f', crack: '#c0392b', seep: '#00a8a8',
    rpond: '#2e8b57', erosion: '#8b5a2b', catch: '#8e44ad', photo: '#222222', other: '#555555' };
  const TRK_COL = { edge: '#1f78b4', hwm: '#8e44ad', inflow: '#17a2b8', walk: '#e67e22', other: '#555555' };
  const depthCol = (d, max) => {
    const t = Math.max(0, Math.min(1, d / (max || 1)));
    const a = [198, 233, 247], b = [8, 48, 107];
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})`;
  };
  const sq = (L_, color, size) => L_.divIcon({ className: 'mk', html: `<i style="background:${color};width:${size}px;height:${size}px"></i>`, iconSize: [size + 4, size + 4] });
  const idOf = (r) => { const v = r.data; return v.fid || v.sample_id || v.mark_id || v.test_id || v.site_id || v.tr_id || (r.form === 'trk' ? v.name : '') || ''; };

  function popup(r, extra) {
    const f = TT.FORMS[r.form];
    let sum = '';
    try { sum = f.summary ? f.summary(r.data) || '' : ''; } catch (e) { sum = ''; }
    return h('div.pop', h('b', { text: r.id }), h('div', { text: `${TT.Ls(f.title)} · ${TT.lakeName(r.data.lake) || 'no lake'}` }),
      sum && h('div', { text: sum }), extra && h('div.muted', { text: extra }), h('a', { href: '#/edit/' + encodeURIComponent(r.id), text: 'Open record' }));
  }
  function marker(L_, g, color, size, r, id, extra) {
    const m = L_.marker([g.lat, g.lon], { icon: sq(L_, color, size), title: id || r.id }).bindPopup(() => popup(r, extra));
    if (id) m.bindTooltip(id, { permanent: true, direction: 'right', offset: [8, 0], className: 'map-id' });
    return m;
  }

  function dataLayers(L_, recs) {
    const groups = {}, counts = {}, byRec = {}, pts = [];
    CATS.forEach((c) => { groups[c.id] = L_.layerGroup(); counts[c.id] = 0; });
    const maxDepth = Math.max(0, ...recs.filter((r) => r.form === 'bath').flatMap((r) => (r.data.soundings || []).map((s) => TT.num(s && s.depth) || 0)));
    for (const r of recs) {
      const f = TT.FORMS[r.form], v = r.data, grp = groups[r.form];
      if (!f || !grp) continue;
      const id = idOf(r);
      let any = false;
      const keep = (layer, latlngs) => { layer.addTo(grp); pts.push(...latlngs); byRec[r.id] = byRec[r.id] || layer; any = true; };
      if (r.form === 'trk') {
        const ll = (v.points || []).filter(ok).map((g) => [g.lat, g.lon]);
        if (ll.length >= 2) {
          const col = TRK_COL[v.kind] || TRK_COL.other;
          const lyr = TT.TRACK_CLOSED.includes(v.kind) && ll.length >= 3
            ? L_.polygon(ll, { color: col, weight: 3, fillOpacity: 0.12, dashArray: v.kind === 'hwm' ? '7 5' : null })
            : L_.polyline(ll, { color: col, weight: 3 });
          if (id) lyr.bindTooltip(id, { sticky: true });
          keep(lyr.bindPopup(() => popup(r)), ll);
        }
      } else {
        const color = r.form === 'feat' ? FT_COL[v.ftype] || FT_COL.other : CAT_COL[r.form];
        if (f.geo && ok(v[f.geo])) keep(marker(L_, v[f.geo], color, 13, r, id), [[v[f.geo].lat, v[f.geo].lon]]);
        for (const fld of f.fields) {
          if (!TT.visible(fld, v)) continue;
          if (fld.type === 'gps' && fld.id !== f.geo && ok(v[fld.id])) keep(marker(L_, v[fld.id], color, 9, r, null, TT.Ls(fld.q)), [[v[fld.id].lat, v[fld.id].lon]]);
          const gc = fld.type === 'table' && Array.isArray(v[fld.id]) && fld.columns.find((c) => c.type === 'gps');
          if (!gc) continue;
          const comp = TT.tableComputed(fld, v[fld.id], v, {});
          v[fld.id].forEach((row, i) => {
            if (!row || !ok(row[gc.id])) return;
            const d = TT.num(row.depth);
            const bed = comp[i] && comp[i].bedrl;
            const extra = `Row ${i + 1}${d != null ? ` · depth ${d} m` : ''}${bed != null ? ` · bed RL ${TT.fix(bed, 2)}` : ''}`;
            keep(marker(L_, row[gc.id], d != null ? depthCol(d, maxDepth) : color, 8, r, null, extra), [[row[gc.id].lat, row[gc.id].lon]]);
          });
        }
        const line = (a, b, opts) => { if (ok(v[a]) && ok(v[b])) keep(L_.polyline([[v[a].lat, v[a].lon], [v[b].lat, v[b].lon]], opts).bindPopup(() => popup(r)), []); };
        if (r.form === 'bath') line('start_pt', 'end_pt', { color: '#0b6e99', weight: 3 });
        if (r.form === 'feat' && v.ftype === 'catch') line('loc', 'end_pt', { color: FT_COL.catch, weight: 3, dashArray: '6 4' });
      }
      if (any) counts[r.form]++;
    }
    return { groups, counts, byRec, pts };
  }

  /* ---------- elevation profile along a line (from the DEM) ---------- */
  function profile(pts) {
    if (pts.length < 2) return null;
    const s = [];
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], d = TT.distM(a, b), k = Math.max(1, Math.ceil(d / 10));
      for (let j = i === 1 ? 0 : 1; j <= k; j++) {
        const t = j / k, z = TT.demAt(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t);
        if (z == null) return null;
        s.push([dist + d * t, z]);
      }
      dist += d;
    }
    let up = 0, down = 0;
    for (let i = 1; i < s.length; i++) { const dz = s[i][1] - s[i - 1][1]; if (dz > 0) up += dz; else down -= dz; }
    const zs = s.map((x) => x[1]), min = Math.min(...zs), max = Math.max(...zs);
    const W = 320, H = 110, X = (d) => 38 + (d / (dist || 1)) * (W - 46), Y = (z) => H - 18 - ((z - min) / (max - min || 1)) * (H - 30);
    const el = (tag, at, txt) => { const e = document.createElementNS(NS, tag); Object.entries(at).forEach(([k, v]) => e.setAttribute(k, v)); if (txt != null) e.textContent = txt; return e; };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart profile', role: 'img' });
    svg.append(el('line', { x1: 38, x2: W - 8, y1: H - 18, y2: H - 18, class: 'axis' }),
      el('polyline', { points: s.map(([d, z]) => `${X(d).toFixed(1)},${Y(z).toFixed(1)}`).join(' '), fill: 'none', style: 'stroke:var(--s1)', 'stroke-width': 2 }),
      el('text', { x: 34, y: Y(max) + 4, 'text-anchor': 'end', class: 'tick' }, Math.round(max)),
      el('text', { x: 34, y: Y(min) + 4, 'text-anchor': 'end', class: 'tick' }, Math.round(min)),
      el('text', { x: 38, y: H - 4, class: 'tick' }, '0'), el('text', { x: W - 8, y: H - 4, 'text-anchor': 'end', class: 'tick' }, fmtDist(dist)));
    return { min: Math.round(min), max: Math.round(max), up: Math.round(up), down: Math.round(down), svg };
  }

  /* ---------- page ---------- */
  const TRACK_KEY = 'tt-track';

  TT.renderMap = async function (root, ctx, params) {
    const settings = ctx.settings;
    let lake = params.get('lake') || settings.activeLake || 'all';
    const lakeId = () => (TT.LAKES[lake] ? lake : TT.LAKES[settings.activeLake] ? settings.activeLake : 'chhekmi');
    const lakeSel = h('select.inp.sm', { 'aria-label': 'Lake' }, h('option', { value: 'all', text: 'Both lakes' }), ...TT.O.lake.map((o) => h('option', { value: o.v, text: o.en })));
    lakeSel.value = lake;
    const legendBtn = h('button.btn.ghost.sm', { type: 'button', 'aria-expanded': 'false' }, icon('layers'), 'Survey layers');
    const mapEl = h('div.map-full');
    const cross = h('div.map-cross', { hidden: true }, icon('crosshair'));
    const tools = h('div.map-tools');
    const legend = h('div.map-legend', { hidden: true });
    const panel = h('div.map-panel', { hidden: true });
    const wrap = h('div.map-wrap', mapEl, cross, tools, legend, panel);
    root.replaceChildren(h('div.map-bar', h('h1', { text: 'Map' }), lakeSel, legendBtn), wrap);
    let map = null;
    const size = () => { wrap.style.height = Math.max(320, window.innerHeight - wrap.getBoundingClientRect().top) + 'px'; if (map) map.invalidateSize(); };
    size();

    await TT.loadCss(TT.asset('vendor/leaflet/leaflet.css'));
    await TT.loadScript(TT.asset('vendor/leaflet/leaflet.js'));
    const L_ = window.L;
    map = L_.map(mapEl, { zoomControl: true });
    const imagery = L_.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20, maxNativeZoom: 18, crossOrigin: true, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' });
    const osm = L_.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap contributors' });
    let off = null;
    try { off = await offlineLayers(L_, await loadBasemap()); } catch (e) { console.error(e); }
    const bases = { 'Satellite imagery': imagery, OpenStreetMap: osm };
    const overlays = {};
    if (off) {
      bases['Offline map (terrain, roads, buildings)'] = off.base;
      overlays['Contours (20 m)'] = off.contours;
    }
    if (off && !navigator.onLine) { off.base.addTo(map); off.contours.addTo(map); } else imagery.addTo(map);
    try {
      const ref = await (await fetch(TT.asset('data/reference.geojson'))).json();
      overlays['Timure outline (OSM)'] = L_.geoJSON(ref, {
        style: (f) => (f.properties.kind === 'lake_outline' ? { color: '#4fd1ff', weight: 2, fillOpacity: 0.08 } : f.properties.kind === 'road' ? { color: '#ffd166', weight: 3 } : { color: '#ffffff', weight: 2, dashArray: '4 4' }),
        filter: (f) => f.properties.kind !== 'lake_point',
        onEachFeature: (f, layer) => {
          const a = f.geometry.type === 'Polygon' ? TT.trackArea(f.geometry.coordinates[0].map(([lon, lat]) => ({ lat, lon }))) : null;
          layer.bindTooltip(f.properties.name + (a ? ` · ${fmtArea(a)}` : ''));
        },
      }).addTo(map);
    } catch (e) { /* not cached yet */ }
    let gis = null;
    try {
      gis = await gisLayers(L_);
      overlays['Chhekmi lake and catchment (GIS)'] = gis.lakeCatchment.addTo(map);
      overlays['Flow paths (DEM)'] = gis.flow.addTo(map);
    } catch (e) { console.error(e); }
    const centres = L_.layerGroup().addTo(map);
    const drawCentres = () => {
      centres.clearLayers();
      TT.LAKE_IDS.forEach((id) => { const c = TT.lakeCentre(id); if (c) L_.marker([c.lat, c.lon], { icon: sq(L_, '#0aa2c0', 12) }).bindTooltip(`${TT.lakeName(id)} centre`).addTo(centres); });
    };
    drawCentres();
    overlays['Lake centres'] = centres;
    L_.control.layers(bases, overlays, { collapsed: true }).addTo(map);
    L_.control.scale({ imperial: false }).addTo(map);
    map.on('zoomend', () => mapEl.classList.toggle('show-ids', map.getZoom() >= 18));

    /* survey layers + legend */
    let data = null;
    const recsFor = () => ctx.records.filter((r) => lake === 'all' || r.data.lake === lake || r.data.lake === 'both');
    const drawData = () => {
      if (data) Object.values(data.groups).forEach((g) => g.remove());
      data = dataLayers(L_, recsFor());
      Object.values(data.groups).forEach((g) => g.addTo(map));
      const rows = CATS.filter((c) => data.counts[c.id]).map((c) => {
        const cb = h('input', { type: 'checkbox', checked: true });
        cb.addEventListener('change', () => (cb.checked ? data.groups[c.id].addTo(map) : data.groups[c.id].remove()));
        return h('label.leg-row', cb, h('i.sw', { style: { background: c.color } }), h('span', { text: c.label }), h('small.muted', { text: String(data.counts[c.id]) }));
      });
      const recs = recsFor();
      const keys = (form, field, cols) => {
        const used = new Set(recs.filter((r) => r.form === form).map((r) => r.data[field]));
        return Object.entries(cols).filter(([k]) => used.has(k)).map(([k, col]) => h('span.leg-key', h('i.sw', { style: { background: col } }), TT.optLabel(TT.FORMS[form].fieldMap[field], k).split(' / ')[0]));
      };
      const ft = keys('feat', 'ftype', FT_COL), tk = keys('trk', 'kind', TRK_COL);
      const gisKey = gis && lake !== 'timure' ? h('div.leg-sub', h('small', { text: 'Chhekmi GIS' }),
        h('span.leg-key', h('i.sw', { style: { background: GIS_COL.lake } }), 'Lake (approximate)'),
        h('span.leg-key', h('i.sw', { style: { background: GIS_COL.catchment } }), `Catchment ${(gis.area / 1e4).toFixed(1)} ha`),
        h('span.leg-key', h('i.sw', { style: { background: GIS_COL.drain } }), 'Flow paths')) : '';
      legend.replaceChildren(h('b', { text: 'Survey layers' }), ...(rows.length ? rows : [h('p.muted', { text: 'Nothing mapped yet.' })]),
        ft.length ? h('div.leg-sub', h('small', { text: 'Feature types' }), ...ft) : '',
        tk.length ? h('div.leg-sub', h('small', { text: 'Track kinds' }), ...tk) : '',
        data.counts.bath ? h('div.leg-sub', h('small', { text: 'Soundings: light = shallow, dark = deep' })) : '', gisKey);
    };
    const areaCentre = (id) => {
      const a = basemap && basemap.areas.find((x) => x.id === id);
      return a ? [(a.bounds[0][0] + a.bounds[1][0]) / 2, (a.bounds[0][1] + a.bounds[1][1]) / 2] : null;
    };
    const fit = () => {
      const ids = lake === 'all' ? TT.LAKE_IDS : [lake];
      const pts = [...data.pts, ...ids.map((id) => TT.lakeCentre(id)).filter(Boolean).map((c) => [c.lat, c.lon])];
      if (gis && ids.includes('chhekmi')) pts.push(gis.bounds.getSouthWest(), gis.bounds.getNorthEast());
      if (pts.length > 1) map.fitBounds(L_.latLngBounds(pts).pad(0.15), { maxZoom: 18 });
      else if (pts.length === 1) map.setView(pts[0], 17);
      else map.setView(areaCentre(lakeId()) || [28.10051, 83.37936], 15);
    };
    drawData();
    fit();
    legendBtn.addEventListener('click', () => { legend.hidden = !legend.hidden; legendBtn.setAttribute('aria-expanded', String(!legend.hidden)); });
    lakeSel.addEventListener('change', () => {
      lake = lakeSel.value;
      history.replaceState(null, '', '#/map?lake=' + lake);
      drawData();
      fit();
      if (mode === 'info') updateInfo();
    });

    /* tools */
    let mode = null;
    const tool = (ic, title, fn) => {
      const b = h('button.map-tool', { type: 'button', title, 'aria-label': title, 'aria-pressed': 'false' }, icon(ic));
      b.addEventListener('click', fn);
      tools.append(b);
      return b;
    };
    const on = (b, v) => { b.classList.toggle('on', v); b.setAttribute('aria-pressed', String(v)); };
    const btn = (ic, text, fn, cls = '.ghost') => h('button.btn.sm' + cls, { type: 'button', onclick: fn }, icon(ic), text);
    const closeBtn = h('button.icon-btn.panel-x', { type: 'button', title: 'Close', 'aria-label': 'Close' }, icon('x'));
    closeBtn.addEventListener('click', () => { if (trk && trk.recording) panel.hidden = true; else setMode(null); });
    const showPanel = (...kids) => { panel.replaceChildren(closeBtn, ...kids.filter((k) => k != null && k !== false && k !== '')); panel.hidden = false; };

    // GPS: one watch shared by "my position" and track recording
    const gps = { id: null, subs: new Set() };
    const gpsSub = (fn) => {
      gps.subs.add(fn);
      if (gps.id != null || !('geolocation' in navigator)) return;
      gps.id = navigator.geolocation.watchPosition((pos) => {
        const c = pos.coords;
        TT.lastFix = { lat: c.latitude, lon: c.longitude, acc: c.accuracy, alt: c.altitude, at: Date.now() };
        gps.subs.forEach((s) => s(pos));
      }, (err) => gps.subs.forEach((s) => s(null, err)), { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
    };
    const gpsUnsub = (fn) => {
      gps.subs.delete(fn);
      if (!gps.subs.size && gps.id != null) { navigator.geolocation.clearWatch(gps.id); gps.id = null; }
    };

    // my position
    let me = null;
    const onLocate = (pos, err) => {
      if (!pos) { if (err && err.code === 1) { TT.toast('Location permission denied', 'bad'); stopLocate(); } return; }
      const c = pos.coords, ll = [c.latitude, c.longitude];
      if (!me) {
        me = { ring: L_.circle(ll, { radius: c.accuracy, color: '#1a73e8', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map),
          dot: L_.circleMarker(ll, { radius: 7, color: '#ffffff', weight: 2, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map) };
        map.setView(ll, Math.max(map.getZoom(), 17));
      }
      me.ring.setLatLng(ll).setRadius(c.accuracy);
      me.dot.setLatLng(ll).bindTooltip(`You · ±${Math.round(c.accuracy)} m`);
      if (mode === 'info') updateInfo();
    };
    const stopLocate = () => {
      gpsUnsub(onLocate);
      if (me) { me.ring.remove(); me.dot.remove(); me = null; }
      on(bLoc, false);
    };
    const bLoc = tool('locate', 'My position', () => {
      if (bLoc.classList.contains('on')) return stopLocate();
      if (!('geolocation' in navigator)) return TT.toast('This device has no GPS access', 'bad');
      on(bLoc, true);
      gpsSub(onLocate);
    });

    // point info at the crosshair
    const infoVals = { ll: h('b'), utm: h('b'), z: h('b'), lake: h('b'), you: h('b') };
    const infoLakeLbl = h('span');
    const centreHere = () => { const c = map.getCenter(); return { lat: +c.lat.toFixed(7), lon: +c.lng.toFixed(7) }; };
    const updateInfo = () => {
      const g = centreHere(), u = TT.utm(g.lat, g.lon), z = TT.demAt(g.lat, g.lon), ctr = TT.lakeCentre(lakeId());
      infoVals.ll.textContent = `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)}`;
      infoVals.utm.textContent = `E ${u.e.toFixed(1)}  N ${u.n.toFixed(1)}`;
      infoVals.z.textContent = z != null ? `${Math.round(z)} m` : 'outside the offline area';
      infoLakeLbl.textContent = `From ${TT.lakeName(lakeId())} centre`;
      infoVals.lake.textContent = ctr ? `${fmtDist(TT.distM(ctr, g))} ${TT.compass8(TT.bearing(ctr, g))}` : 'centre not set';
      const myLl = me && me.dot.getLatLng();
      infoVals.you.textContent = myLl ? `${fmtDist(TT.distM({ lat: myLl.lat, lon: myLl.lng }, g))} ${TT.compass8(TT.bearing({ lat: myLl.lat, lon: myLl.lng }, g))}` : '—';
    };
    const newHere = (formId) => {
      const g = centreHere(), z = TT.demAt(g.lat, g.lon);
      TT.openNew(formId, { lake: lakeId(), loc: { ...g, acc: null, alt: z != null ? Math.round(z) : null, src: 'map', t: new Date().toISOString() } });
    };
    const setCentre = async () => {
      const id = lakeId(), g = centreHere();
      if (!(await TT.confirm(`Set the ${TT.lakeName(id)} centre at the crosshair?`, { ok: 'Set centre' }))) return;
      settings.lakeCentres = { ...(settings.lakeCentres || {}), [id]: { ...g, acc: null, t: new Date().toISOString(), src: 'map' } };
      await TT.saveSettings(settings);
      drawCentres();
      updateInfo();
      TT.toast(`${TT.lakeName(id)} centre set`);
    };
    const copy = () => {
      const g = centreHere(), u = TT.utm(g.lat, g.lon), text = `${g.lat.toFixed(6)}, ${g.lon.toFixed(6)} (UTM 44N E ${u.e.toFixed(1)} N ${u.n.toFixed(1)})`;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => TT.toast('Coordinates copied'), () => TT.toast(text, 'ok', 8000));
    };
    const renderInfo = () => {
      showPanel(h('h4', { text: 'Point at the crosshair' }),
        h('div.kv', h('span', { text: 'Latitude, longitude' }), infoVals.ll), h('div.kv', h('span', { text: 'UTM 44N' }), infoVals.utm),
        h('div.kv', h('span', { text: 'Ground elevation (DEM)' }), infoVals.z), h('div.kv', infoLakeLbl, infoVals.lake), h('div.kv', h('span', { text: 'From you' }), infoVals.you),
        h('div.btn-row', btn('copy', 'Copy', copy), btn('pin', 'New feature here', () => newHere('feat')), btn('layers', 'New soil sample here', () => newHere('soil')),
          btn('crosshair', 'Set lake centre here', setCentre)));
      updateInfo();
    };
    map.on('move', () => { if (mode === 'info') updateInfo(); });

    // measure distance, area and elevation profile
    let mPts = [];
    const mLayer = L_.layerGroup();
    const drawMeasure = () => {
      mLayer.clearLayers();
      if (mPts.length >= 3) L_.polygon(mPts, { color: '#d7301f', weight: 1, dashArray: '4 4', fillOpacity: 0.08, interactive: false }).addTo(mLayer);
      if (mPts.length >= 2) L_.polyline(mPts, { color: '#d7301f', weight: 3, interactive: false }).addTo(mLayer);
      mPts.forEach((p) => L_.circleMarker(p, { radius: 4, color: '#d7301f', weight: 2, fillColor: '#ffffff', fillOpacity: 1, interactive: false }).addTo(mLayer));
      const pts = mPts.map((p) => ({ lat: p.lat, lon: p.lng }));
      const prof = profile(pts), area = TT.trackArea(pts);
      showPanel(h('h4', { text: 'Measure' }),
        !pts.length && h('p.muted', { text: 'Tap the map to add points.' }),
        pts.length > 1 && kv('Length', fmtDist(TT.trackLength(pts))),
        area && kv('Area (closed shape)', fmtArea(area)),
        prof && kv('Elevation', `${prof.min}–${prof.max} m · up ${prof.up} m · down ${prof.down} m`), prof && prof.svg,
        h('div.btn-row', btn('undo', 'Undo', () => { mPts.pop(); drawMeasure(); }), btn('trash', 'Clear', () => { mPts = []; drawMeasure(); }),
          pts.length > 1 && btn('route', 'Save as track', async () => {
            const rec = await TT.createRecord('trk', { lake: lakeId(), points: pts.map((p) => ({ ...p, acc: null, src: 'map' })) });
            location.hash = '#/edit/' + encodeURIComponent(rec.id);
          })));
    };
    map.on('click', (e) => { if (mode === 'measure') { mPts.push(e.latlng); drawMeasure(); } });

    // GPS track recording (kept in localStorage until saved, so a reload does not lose it)
    let trk = null, trkTimer = null;
    const trkLine = L_.polyline([], { color: '#e67e22', weight: 4 });
    const saveDraft = () => { try { localStorage.setItem(TRACK_KEY, JSON.stringify({ lake: trk.lake, points: trk.points, started: trk.started })); } catch (e) { /* storage full */ } };
    const renderTrack = () => {
      if (!trk) return;
      const mins = Math.round((Date.now() - Date.parse(trk.started)) / 60000);
      showPanel(h('h4', { text: trk.recording ? 'Recording track' : 'Unsaved track' }),
        kv('Lake', TT.lakeName(trk.lake)), kv('Points', String(trk.points.length)), kv('Length', fmtDist(TT.trackLength(trk.points) || 0)),
        trk.recording && kv('GPS accuracy', trk.acc != null ? `±${Math.round(trk.acc)} m${trk.acc > 25 ? ' (too coarse, waiting)' : ''}` : 'waiting for GPS'),
        trk.recording && kv('Time', `${mins} min`),
        h('div.btn-row',
          trk.recording ? btn('check', 'Stop and save', () => stopTrack(true), '') : btn('route', 'Continue recording', () => startTrack(trk), ''),
          !trk.recording && btn('check', 'Save', () => stopTrack(true)),
          btn('trash', 'Discard', () => stopTrack(false))));
    };
    const onTrack = (pos, err) => {
      if (!trk) return;
      if (!pos) { if (err && err.code === 1) { TT.toast('Location permission denied', 'bad'); } return; }
      const c = pos.coords;
      trk.acc = c.accuracy;
      const p = { lat: +c.latitude.toFixed(7), lon: +c.longitude.toFixed(7), acc: Math.round(c.accuracy * 10) / 10,
        alt: c.altitude == null ? null : Math.round(c.altitude * 10) / 10, t: new Date(pos.timestamp || Date.now()).toISOString() };
      const prev = trk.points[trk.points.length - 1];
      if (c.accuracy <= 25 && (!prev || TT.distM(prev, p) >= Math.max(3, c.accuracy / 2))) {
        trk.points.push(p);
        trkLine.addLatLng([p.lat, p.lon]);
        saveDraft();
      }
      if (mode === 'track' && !panel.hidden) renderTrack();
    };
    const startTrack = (resume) => {
      if (!('geolocation' in navigator)) return TT.toast('This device has no GPS access', 'bad');
      if (mode && mode !== 'track') setMode(null);
      trk = { lake: lakeId(), points: [], started: new Date().toISOString(), ...(resume || {}), recording: true };
      trkLine.setLatLngs(trk.points.map((p) => [p.lat, p.lon])).addTo(map);
      saveDraft();
      gpsSub(onTrack);
      if (!bLoc.classList.contains('on')) { on(bLoc, true); gpsSub(onLocate); }
      clearInterval(trkTimer);
      trkTimer = setInterval(() => { if (mode === 'track' && !panel.hidden) renderTrack(); }, 15000);
      mode = 'track';
      on(bTrack, true);
      renderTrack();
    };
    const stopTrack = async (save) => {
      if (!save && !(await TT.confirm('Discard this track?', { ok: 'Discard', danger: true }))) return;
      gpsUnsub(onTrack);
      clearInterval(trkTimer);
      if (save) {
        if (trk.points.length < 2) { TT.toast('At least two points are needed', 'bad'); trk.recording = false; renderTrack(); return; }
        const rec = await TT.createRecord('trk', { lake: trk.lake, points: trk.points });
        localStorage.removeItem(TRACK_KEY);
        trk = null;
        location.hash = '#/edit/' + encodeURIComponent(rec.id);
        return;
      }
      localStorage.removeItem(TRACK_KEY);
      trk = null;
      trkLine.remove();
      on(bTrack, false);
      mode = null;
      panel.hidden = true;
    };

    const setMode = (m) => {
      if (trk && trk.recording && m !== 'track') { TT.toast('Stop the track first', 'bad'); return; }
      mode = m;
      on(bInfo, m === 'info');
      on(bMeasure, m === 'measure');
      on(bTrack, m === 'track' || !!trk);
      cross.hidden = m !== 'info';
      mapEl.classList.toggle('measuring', m === 'measure');
      if (m === 'measure') mLayer.addTo(map); else { mPts = []; mLayer.remove(); }
      if (m === 'info') renderInfo();
      else if (m === 'measure') drawMeasure();
      else if (m === 'track') renderTrack();
      else panel.hidden = true;
    };
    const bInfo = tool('crosshair', 'Point info', () => setMode(mode === 'info' ? null : 'info'));
    const bMeasure = tool('ruler', 'Measure', () => setMode(mode === 'measure' ? null : 'measure'));
    const bTrack = tool('route', 'Record a GPS track', () => (trk ? setMode('track') : startTrack()));
    tool('maximize', 'Zoom to the survey data', fit);

    // an unsaved track from an earlier visit
    try {
      const draft = JSON.parse(localStorage.getItem(TRACK_KEY) || 'null');
      if (draft && Array.isArray(draft.points) && draft.points.length) {
        trk = { ...draft, recording: false };
        trkLine.setLatLngs(trk.points.map((p) => [p.lat, p.lon])).addTo(map);
        mode = 'track';
        on(bTrack, true);
        renderTrack();
      }
    } catch (e) { localStorage.removeItem(TRACK_KEY); }

    // open a record from its form ("Show on map")
    const focus = params.get('rec') && data.byRec[params.get('rec')];
    if (focus) {
      if (focus.getBounds) map.fitBounds(focus.getBounds().pad(0.2), { maxZoom: 19 });
      else map.setView(focus.getLatLng(), 19);
      setTimeout(() => focus.openPopup(), 300);
    }

    const onResize = () => size();
    window.addEventListener('resize', onResize);
    setTimeout(size, 50);
    return () => {
      window.removeEventListener('resize', onResize);
      clearInterval(trkTimer);
      if (gps.id != null) navigator.geolocation.clearWatch(gps.id);
      map.remove();
    };
  };
})();
