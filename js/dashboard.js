/* Timure Taal field portal: analysis + dashboard (progress, map, water level, community evidence, timeline, hypotheses). */
'use strict';
(function () {
  const TT = window.TT;
  const { h, L, icon } = TT;
  const n = TT.num;
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs = {}, ...kids) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    kids.flat().forEach((k) => k != null && el.append(k instanceof Node ? k : document.createTextNode(String(k))));
    return el;
  };

  /* ============================ analysis ============================ */
  TT.analysis = {
    waterLevel(records, ctx) {
      const st = (ctx && ctx.settings) || {};
      const evap = n(st.evap) ?? 4, tol = n(st.evapTol) ?? 2;
      const pts = records.filter((r) => r.form === 'wl' && n(r.data.reading) != null && r.data.dt).map((r) => {
        const z = TT.gaugeZero(ctx, r.data.gauge);
        return { id: r.id, gauge: String(r.data.gauge || '?').trim().toUpperCase(), t: new Date(r.data.dt), reading: n(r.data.reading), wsl: z != null ? TT.round(z + n(r.data.reading), 3) : null, rain: r.data.rain_since || '' };
      }).filter((p) => !isNaN(p.t));
      pts.sort((a, b) => a.gauge.localeCompare(b.gauge) || a.t - b.t);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (a.gauge !== b.gauge) continue;
        const dtH = (b.t - a.t) / 3.6e6;
        if (dtH <= 0) continue;
        b.dtH = TT.round(dtH, 1);
        b.rate = TT.round(((a.reading - b.reading) * 1000) / (dtH / 24), 1);
        if (b.rain === 'none' && dtH >= 6 && b.rate > evap + tol) b.flag = `Fall ${b.rate} mm/d exceeds evaporation ${evap} + ${tol} mm/d with no rain — check outflow / seepage`;
        else if (b.rain && b.rain !== 'none' && b.rate < 0) b.flag = 'Rise after rain';
      }
      return pts;
    },

    community(records) {
      const form = TT.FORMS.hh;
      const hh = records.filter((r) => r.form === 'hh' && r.data.consent === 'yes');
      const count = (key) => {
        const f = form.fieldMap[key];
        const m = new Map();
        let base = 0;
        hh.forEach((r) => {
          if (!TT.visible(f, r.data)) return;
          const v = r.data[key];
          const arr = Array.isArray(v) ? v : v != null && v !== '' ? [v] : [];
          if (arr.length) base++;
          arr.forEach((x) => m.set(x, (m.get(x) || 0) + 1));
        });
        return { base, items: f.options.map((o) => ({ o, n: m.get(o.v) || 0 })).filter((x) => x.n) };
      };
      const years = new Map(), srcFirst = new Map();
      hh.forEach((r) => {
        const y = parseInt(r.data.first_noticed, 10);
        if (r.data.noticed === 'yes' && y) {
          years.set(y, (years.get(y) || 0) + 1);
          const src = r.data.first_noticed__src || 'untagged';
          srcFirst.set(src, (srcFirst.get(src) || 0) + 1);
        }
      });
      const borda = new Map();
      hh.forEach((r) => (r.data.cause_rank || []).forEach((c, i) => borda.set(c, (borda.get(c) || 0) + (3 - i))));
      const rate = {};
      hh.forEach((r) => Object.entries(r.data.cause_rate || {}).forEach(([c, o]) => {
        rate[c] = rate[c] || { main: 0, contrib: 0, unlikely: 0, dk: 0 };
        if (o && o.r && rate[c][o.r] != null) rate[c][o.r]++;
      }));
      const gridMeans = (key, cols) => {
        const acc = {};
        hh.forEach((r) => Object.entries(r.data[key] || {}).forEach(([row, o]) => cols.forEach((c) => {
          const x = parseInt(o && o[c], 10);
          if (x) { acc[row] = acc[row] || {}; (acc[row][c] = acc[row][c] || []).push(x); }
        })));
        return acc;
      };
      return {
        N: hh.length, years, srcFirst, borda, rate,
        timeline: gridMeans('timeline', ['dry', 'wet']), seasonal: gridMeans('seasonal', ['before', 'now']),
        eq: count('eq_change'), eqBasis: count('eq_basis'), pattern: count('pattern'), others: count('other_sources'),
        conAfter: count('con_after'), wallow: count('wallow'),
      };
    },
  };

  /* ============================ charts ============================ */
  function bars(items, { total, color = 'var(--brand)', fmt } = {}) {
    const max = Math.max(1, ...items.map((i) => i.n));
    return h('div.bars', ...items.map((i) => h('div.bar-row',
      h('div.bar-l', i.label instanceof Node ? i.label : L(i.label)),
      h('div.bar-t', h('div.bar-f', { style: { width: `${(100 * i.n) / max}%`, background: i.color || color } })),
      h('div.bar-v', { text: fmt ? fmt(i) : total ? `${i.n} (${Math.round((100 * i.n) / total)}%)` : String(i.n) }))));
  }

  // Minimal SVG line/scatter chart. series: [{name, color, pts:[{x,y}], dash}], markers: [{x,label}]
  function chart({ series, markers = [], xMin, xMax, yMin, yMax, xFmt = String, yFmt = String, yTicks, height = 240, xTicks }) {
    const W = 720, H = height, m = { l: 52, r: 14, t: 14, b: 34 };
    const all = series.flatMap((se) => se.pts);
    if (!all.length) return h('p.muted', { text: 'No data yet.' });
    xMin = xMin ?? Math.min(...all.map((p) => p.x));
    xMax = xMax ?? Math.max(...all.map((p) => p.x));
    if (xMax === xMin) { xMin -= 1; xMax += 1; }
    yMin = yMin ?? Math.min(...all.map((p) => p.y));
    yMax = yMax ?? Math.max(...all.map((p) => p.y));
    if (yMax === yMin) { yMin -= 0.05; yMax += 0.05; }
    const X = (x) => m.l + ((x - xMin) / (xMax - xMin)) * (W - m.l - m.r);
    const Y = (y) => H - m.b - ((y - yMin) / (yMax - yMin)) * (H - m.t - m.b);
    const g = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
    const yt = yTicks || Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);
    yt.forEach((y) => g.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(y), y2: Y(y), class: 'grid' }), s('text', { x: m.l - 6, y: Y(y) + 4, 'text-anchor': 'end', class: 'tick' }, yFmt(y))));
    const xt = xTicks || Array.from({ length: 6 }, (_, i) => xMin + ((xMax - xMin) * i) / 5);
    xt.forEach((x) => g.append(s('text', { x: X(x), y: H - m.b + 18, 'text-anchor': 'middle', class: 'tick' }, xFmt(x))));
    g.append(s('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }));
    markers.forEach((mk) => {
      if (mk.x < xMin || mk.x > xMax) return;
      g.append(s('line', { x1: X(mk.x), x2: X(mk.x), y1: m.t, y2: H - m.b, class: 'marker' }), s('text', { x: X(mk.x) + 4, y: m.t + 10, class: 'marker-t' }, mk.label));
    });
    series.forEach((se) => {
      const pts = [...se.pts].sort((a, b) => a.x - b.x);
      if (se.line !== false && pts.length > 1) g.append(s('polyline', { points: pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' '), fill: 'none', stroke: se.color, 'stroke-width': 2.2, 'stroke-dasharray': se.dash || null }));
      pts.forEach((p) => g.append(s('circle', { cx: X(p.x), cy: Y(p.y), r: p.r || 3.6, fill: p.color || se.color }, s('title', {}, p.title || `${xFmt(p.x)}: ${yFmt(p.y)}`))));
    });
    const legend = h('div.legend', ...series.map((se) => h('span', h('i', { style: { background: se.color } }), se.name)));
    return h('div.chart-wrap', g, series.length > 1 || series[0].name ? legend : null);
  }

  // Vertical histogram over BS years.
  function yearHist(map, { from, to, mark = 2072 }) {
    const W = 720, H = 200, m = { l: 34, r: 8, t: 10, b: 30 };
    const yrs = [];
    for (let y = from; y <= to; y++) yrs.push(y);
    const max = Math.max(1, ...yrs.map((y) => map.get(y) || 0));
    const bw = (W - m.l - m.r) / yrs.length;
    const g = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img' });
    for (let k = 0; k <= max; k += Math.max(1, Math.ceil(max / 4))) {
      const y = H - m.b - (k / max) * (H - m.t - m.b);
      g.append(s('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, class: 'grid' }), s('text', { x: m.l - 5, y: y + 4, 'text-anchor': 'end', class: 'tick' }, k));
    }
    yrs.forEach((y, i) => {
      const v = map.get(y) || 0;
      const bh = (v / max) * (H - m.t - m.b);
      g.append(s('rect', { x: m.l + i * bw + 1, y: H - m.b - bh, width: bw - 2, height: bh, class: y === mark ? 'bar-mark' : 'bar' }, s('title', {}, `${TT.bsLabel(y)}: ${v}`)));
      if (y % 2 === 0 || yrs.length < 14) g.append(s('text', { x: m.l + i * bw + bw / 2, y: H - m.b + 16, 'text-anchor': 'middle', class: 'tick' }, y));
    });
    return g;
  }

  /* ============================ map ============================ */
  TT.loadCss = (href) => new Promise((res) => {
    if (document.querySelector(`link[href="${href}"]`)) return res();
    const l = h('link', { rel: 'stylesheet', href });
    l.onload = () => res();
    l.onerror = () => res();
    document.head.append(l);
  });

  const GROUP_COL = { community: '#d9822b', engineering: '#13795b' };
  const depthCol = (d, max) => {
    const t = Math.max(0, Math.min(1, d / (max || 1)));
    const a = [198, 233, 247], b = [8, 48, 107];
    return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',')})`;
  };

  async function buildMap(el, records) {
    await TT.loadCss('vendor/leaflet/leaflet.css');
    await TT.loadScript('vendor/leaflet/leaflet.js');
    const L_ = window.L;
    const map = L_.map(el, { scrollWheelZoom: false }).setView([TT.LAKE.lat, TT.LAKE.lon], 17);
    const imagery = L_.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20, maxNativeZoom: 18, attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' }).addTo(map);
    const osm = L_.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap contributors' });
    const overlays = {};
    try {
      const ref = await (await fetch('data/reference.geojson')).json();
      overlays['Reference (OSM lake outline, road, path)'] = L_.geoJSON(ref, {
        style: (f) => f.properties.kind === 'lake_outline' ? { color: '#4fd1ff', weight: 2, fillOpacity: 0.08 } : f.properties.kind === 'road' ? { color: '#ffd166', weight: 3 } : { color: '#ffffff', weight: 2, dashArray: '4 4' },
        pointToLayer: (f, ll) => L_.circleMarker(ll, { radius: 5, color: '#fff', weight: 2, fillColor: '#0aa2c0', fillOpacity: 1 }),
        onEachFeature: (f, layer) => layer.bindTooltip(f.properties.name),
      }).addTo(map);
    } catch (e) { /* offline without cache: map still works */ }

    const feats = TT.collectFeatures(records, { pii: false, ctx: { records } });
    const groups = { record: L_.layerGroup(), point: L_.layerGroup(), bath: L_.layerGroup(), line: L_.layerGroup() };
    const maxDepth = Math.max(0, ...feats.filter((f) => f.properties.table === 'soundings').map((f) => n(f.properties.depth_m) || 0));
    const near = [];
    for (const f of feats) {
      const p = f.properties;
      if (f.geometry.type === 'LineString') {
        const ll = f.geometry.coordinates.map((c) => [c[1], c[0]]);
        L_.polyline(ll, { color: p.kind === 'transect' ? '#7fdbff' : p.kind === 'lining_segment' ? '#ff6b6b' : '#ffd166', weight: 3 }).bindTooltip(`${p.record_id} ${p.kind}`).addTo(groups.line);
        continue;
      }
      const [lon, lat] = f.geometry.coordinates;
      if (TT.distM(TT.LAKE, { lat, lon }) < 5000) near.push([lat, lon]);
      const pop = h('div.pop', h('b', { text: p.record_id }), h('div', { text: p.form_title }), p.summary && h('div', { text: p.summary }),
        p.kind === 'point' && h('div.muted', { text: p.question }), p.kind === 'table_point' && h('div', { text: `row ${p.row}${p.depth_m != null ? ` · depth ${p.depth_m} m` : ''}${p.bedrl_m ? ` · bed RL ${p.bedrl_m}` : ''}` }),
        h('a', { href: '#/edit/' + encodeURIComponent(p.record_id), text: 'Open record' }));
      if (p.kind === 'table_point' && p.table === 'soundings') {
        L_.circleMarker([lat, lon], { radius: 5, weight: 1, color: '#fff', fillColor: depthCol(n(p.depth_m) || 0, maxDepth), fillOpacity: 1 }).bindPopup(pop).addTo(groups.bath);
      } else if (p.kind === 'record') {
        L_.circleMarker([lat, lon], { radius: 7, weight: 2, color: '#fff', fillColor: GROUP_COL[p.group] || '#555', fillOpacity: 1 }).bindPopup(pop).addTo(groups.record);
      } else {
        L_.circleMarker([lat, lon], { radius: 5, weight: 1.5, color: '#fff', fillColor: p.group === 'community' ? '#f2b56b' : '#5fc59b', fillOpacity: 0.95 }).bindPopup(pop).addTo(groups.point);
      }
    }
    Object.values(groups).forEach((g) => g.addTo(map));
    L_.control.layers({ 'Satellite imagery': imagery, OpenStreetMap: osm }, {
      ...overlays, 'Records (orange = community, green = engineering)': groups.record, 'Other GPS points (shoreline, inflow, cracks …)': groups.point,
      'Bathymetry soundings (darker = deeper)': groups.bath, 'Transects, lining segments, runoff paths': groups.line }, { collapsed: true }).addTo(map);
    L_.control.scale({ imperial: false }).addTo(map);
    if (near.length) map.fitBounds(L_.latLngBounds([...near, [TT.LAKE.lat, TT.LAKE.lon]]).pad(0.15), { maxZoom: 18 });
    setTimeout(() => map.invalidateSize(), 50);
    return { map, total: feats.length, far: feats.filter((f) => f.geometry.type === 'Point').length - near.length };
  }

  /* ============================ dashboard view ============================ */
  const card = (title, ...kids) => h('section.card.dash-card', h('h3', L(title)), ...kids);
  const kv = (k, v) => h('div.kv', h('span', { text: k }), h('b', { text: v }));

  TT.renderDashboard = async function (root, ctx) {
    const records = ctx.records;
    const photos = await TT.db.all('photos');
    const settings = ctx.settings;
    root.replaceChildren(h('div.page-head', h('h1', L({ ne: 'फिल्ड ड्यासबोर्ड', en: 'Field dashboard' })),
      h('p.muted', { text: `${records.length} records · ${records.filter((r) => r.status === 'complete').length} complete · ${photos.length} photos on this device. Merge other phones' packages (Data → Import) to see the whole team.` })));

    /* progress */
    const prog = h('div.prog-grid');
    for (const id of TT.FORM_ORDER) {
      const f = TT.FORMS[id];
      const recs = records.filter((r) => r.form === id);
      const done = recs.filter((r) => r.status === 'complete').length;
      const pct = Math.min(100, (100 * done) / (f.target || 1));
      prog.append(h('a.prog-item', { href: '#/records?form=' + id },
        h('div.prog-top', TT.icon(f.icon || 'file'), h('b', { text: f.short }), h('span.muted', { text: `${done}/${f.target || '—'} ${f.targetLabel || ''}` })),
        h('div.prog-name', L(f.title)),
        h('div.prog-bar', h('i', { style: { width: pct + '%' } })),
        recs.length > done && h('small.muted', { text: `${recs.length - done} draft` })));
    }
    root.append(card({ ne: 'प्रगति (लक्ष्यको तुलनामा)', en: 'Progress against targets' }, prog));

    /* map */
    const mapEl = h('div.map');
    const mapNote = h('p.muted.sm');
    root.append(card({ ne: 'नक्सा', en: 'Map of all geolocated data' }, mapEl, mapNote));
    buildMap(mapEl, records).then((r) => { mapNote.textContent = `${r.total} features. ${r.far > 0 ? r.far + ' point(s) more than 5 km from the lake are not used to zoom (test or mistaken fixes?). ' : ''}Satellite tiles need a connection.`; })
      .catch((e) => { mapNote.textContent = 'Map unavailable: ' + e.message; });

    /* water level */
    const wl = TT.analysis.waterLevel(records, ctx);
    const wlCard = card({ ne: 'तालको पानीको सतह', en: 'Lake water level' });
    if (!wl.length) wlCard.append(h('p.muted', { text: 'No water-level readings yet. Install and level a staff gauge (Benchmark form), then log readings morning and evening.' }));
    else {
      const gauges = [...new Set(wl.map((p) => p.gauge))];
      const pal = ['#0b6e79', '#d9822b', '#7b4fa6', '#2a7de1'];
      const useRL = wl.every((p) => p.wsl != null);
      wlCard.append(chart({
        series: gauges.map((g, i) => ({ name: g + (useRL ? ' (RL m)' : ' (staff m)'), color: pal[i % pal.length],
          pts: wl.filter((p) => p.gauge === g).map((p) => ({ x: +p.t, y: useRL ? p.wsl : p.reading, color: p.flag && p.flag.startsWith('Fall') ? '#b42318' : null, title: `${p.id} ${TT.fmt(p.t)}: ${useRL ? p.wsl : p.reading} m` })) })),
        xFmt: (x) => { const d = new Date(x); return `${d.getMonth() + 1}/${d.getDate()} ${TT.pad(d.getHours())}h`; }, yFmt: (y) => y.toFixed(3),
      }));
      const flagged = wl.filter((p) => p.flag);
      wlCard.append(h('p.muted.sm', { text: `Recession screening: fall rate between consecutive readings ≥ 6 h apart is compared with assumed open-water evaporation ${settings.evap} mm/day + tolerance ${settings.evapTol} mm/day (change in Data → Settings). Evaporation is concentrated in daytime, so compare like-for-like intervals (e.g. evening→morning). Red points = flagged falls.` }));
      const tbl = h('table.tbl.compact', h('thead', h('tr', ...['Reading', 'Gauge', 'Time', 'Staff m', 'RL m', 'Δt h', 'Fall mm/d', 'Rain', 'Screening'].map((x) => h('th', { text: x })))),
        h('tbody', ...wl.slice(-40).reverse().map((p) => h('tr' + (p.flag && p.flag.startsWith('Fall') ? '.flag' : ''),
          h('td', h('a', { href: '#/edit/' + p.id, text: p.id })), h('td', { text: p.gauge }), h('td', { text: TT.fmt(p.t) }), h('td', { text: p.reading.toFixed(3) }),
          h('td', { text: p.wsl != null ? p.wsl.toFixed(3) : '' }), h('td', { text: p.dtH ?? '' }), h('td', { text: p.rate ?? '' }), h('td', { text: p.rain }), h('td', { text: p.flag || '' })))));
      wlCard.append(h('div.tbl-scroll', tbl));
      if (flagged.length) wlCard.append(h('p', h('b', { text: `${flagged.filter((f) => f.flag.startsWith('Fall')).length} interval(s) flagged for unexplained fall.` })));
    }
    root.append(wlCard);

    /* community */
    const c = TT.analysis.community(records);
    const com = card({ ne: 'समुदायबाट प्राप्त प्रमाण', en: 'Community evidence (household interviews)' });
    if (!c.N) com.append(h('p.muted', { text: 'No consenting household interviews yet.' }));
    else {
      const noticed = [...c.years.values()].reduce((a, b) => a + b, 0);
      const ys = [...c.years.keys()];
      com.append(h('p', { text: `${c.N} interviews with consent; ${noticed} respondents gave a year when they first noticed the decline.` }));
      if (ys.length) {
        com.append(h('h4', { text: 'Year the decline was first noticed (BS; 2072 = 2015 earthquake year highlighted)' }),
          yearHist(c.years, { from: Math.min(2062, ...ys), to: Math.max(TT.bsYearOf(), ...ys) }),
          h('p.muted.sm', { text: 'How they know: ' + [...c.srcFirst.entries()].map(([k, v]) => `${k === 'untagged' ? 'not tagged' : TT.optLabel({ options: TT.O.src }, k)} ${v}`).join(' · ') }));
      }
      const grid2 = h('div.grid2');
      const sub = (title, d) => h('div', h('h4', L(title)), d.items.length ? bars(d.items.map((x) => ({ label: x.o, n: x.n })), { total: d.base }) : h('p.muted', { text: 'No answers yet.' }));
      grid2.append(
        sub({ ne: 'भूकम्पपछि तालमा परिवर्तन', en: 'Change after the 2072 earthquake' }, c.eq),
        sub({ ne: 'भूकम्पलाई कारण मान्ने आधार', en: 'Basis for linking the earthquake' }, c.eqBasis),
        sub({ ne: 'पानी घट्ने ढाँचा', en: 'Pattern of decline' }, c.pattern),
        sub({ ne: 'गाउँका अरू स्रोत पनि घटेका?', en: 'Other village water sources also declined? (climate test)' }, c.others),
        sub({ ne: 'कंक्रिटपछि के भयो?', en: 'What happened after the concrete work' }, c.conAfter),
        sub({ ne: 'भैंसी आहाल', en: 'Buffalo wallowing' }, c.wallow));
      com.append(grid2);

      const tlPts = (col) => Object.entries(c.timeline).filter(([, o]) => o[col]).map(([y, o]) => ({ x: +y, y: TT.mean(o[col]), r: 2.5 + Math.min(5, o[col].length), title: `${TT.bsLabel(+y)}: mean ${TT.mean(o[col]).toFixed(2)} (n=${o[col].length})` }));
      const tlYears = Object.keys(c.timeline).map(Number);
      const tlTicks = [];
      if (tlYears.length) {
        const a = Math.min(...tlYears), b = Math.max(...tlYears), step = Math.max(1, Math.ceil((b - a) / 10));
        for (let y = a; y <= b; y += step) tlTicks.push(y);
      }
      com.append(h('h4', { text: 'Reconstructed lake condition by year (mean of respondents; 5 = full, 1 = dry; dot size = n)' }),
        chart({ series: [{ name: 'Dry season (Chaitra–Jestha)', color: '#b5541c', pts: tlPts('dry') }, { name: 'After monsoon (Bhadra–Asoj)', color: '#0b6e79', pts: tlPts('wet') }],
          yMin: 1, yMax: 5, yTicks: [1, 2, 3, 4, 5], xTicks: tlTicks.length ? tlTicks : null, xFmt: (x) => String(Math.round(x)), yFmt: (y) => String(Math.round(y)), markers: [{ x: 2072, label: '2072 earthquake' }] }));
      const sePts = (col) => Object.entries(c.seasonal).filter(([, o]) => o[col]).map(([mo, o]) => ({ x: +mo, y: TT.mean(o[col]), title: `${TT.O.months[mo - 1].en}: ${TT.mean(o[col]).toFixed(2)} (n=${o[col].length})` }));
      com.append(h('h4', { text: 'Seasonal calendar: before the decline vs now (month 1 = Baisakh)' }),
        chart({ series: [{ name: 'Before the decline', color: '#0b6e79', pts: sePts('before') }, { name: 'Now (last 12 months)', color: '#b42318', pts: sePts('now'), dash: '6 4' }],
          xMin: 1, xMax: 12, xTicks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], yMin: 1, yMax: 5, yTicks: [1, 2, 3, 4, 5], xFmt: (x) => TT.O.months[Math.round(x) - 1].ne, yFmt: (y) => String(Math.round(y)) }));
      const causeItems = TT.O.causes.map((o) => ({ label: o, n: c.borda.get(o.v) || 0 })).filter((x) => x.n).sort((a, b) => b.n - a.n);
      com.append(h('h4', { text: 'Perceived causes — rank score (1st = 3, 2nd = 2, 3rd = 1 points)' }), causeItems.length ? bars(causeItems) : h('p.muted', { text: 'No rankings yet.' }));
      const rateRows = TT.O.causes.filter((o) => c.rate[o.v]).map((o) => {
        const r = c.rate[o.v], tot = r.main + r.contrib + r.unlikely + r.dk;
        return h('div.stack-row', h('div.bar-l', L(o)), h('div.stack', ...['main', 'contrib', 'unlikely', 'dk'].map((k) => r[k] ? h('i.st-' + k, { style: { width: `${(100 * r[k]) / tot}%` }, title: `${k}: ${r[k]}` }) : null)), h('div.bar-v', { text: `${r.main}/${tot} main` }));
      });
      if (rateRows.length) com.append(h('h4', { text: 'Prompted rating of each cause' }), h('div.stack-legend', ...['main', 'contrib', 'unlikely', 'dk'].map((k) => h('span', h('i.st-' + k), { main: 'Main', contrib: 'Contributing', unlikely: 'Unlikely', dk: "Don't know" }[k]))), ...rateRows);
      com.append(h('p.muted.sm', { text: 'Community perception is evidence of what people observed and believe — it is weighed against physical measurements in the hypothesis matrix, not used as proof by itself.' }));
    }
    root.append(com);

    /* integrated timeline */
    root.append(card({ ne: 'एकीकृत समयरेखा', en: 'Integrated timeline: decline vs works and events' }, integratedTimeline(records, c)));

    /* engineering summaries */
    root.append(card({ ne: 'इन्जिनियरिङ सारांश', en: 'Engineering summaries' }, engSummary(records)));

    /* hypotheses */
    root.append(card({ ne: 'परिकल्पना–प्रमाण', en: 'Hypothesis–evidence matrix (latest assessment)' }, hypSummary(records)));
  };

  function integratedTimeline(records, c) {
    const works = [];
    records.filter((r) => r.form === 'hist').forEach((r) => { const y = parseInt(r.data.year_start, 10); if (y) works.push({ y, label: TT.optLabel(TT.FORMS.hist.fieldMap.wtype, r.data.wtype || ''), id: r.id }); });
    const hhCon = new Map();
    records.filter((r) => r.form === 'hh').forEach((r) => { const y = parseInt(r.data.con_year, 10); if (y) hhCon.set(y, (hhCon.get(y) || 0) + 1); });
    const yrs = [...c.years.keys(), ...works.map((w) => w.y), ...hhCon.keys(), 2072];
    const from = Math.min(2062, ...yrs), to = Math.max(TT.bsYearOf(), ...yrs);
    const W = 720, rowH = 46, m = { l: 150, r: 12, t: 20 };
    const lanes = ['Community: first noticed decline', 'Community: concrete work year', 'Recorded works (CH register)', 'Events'];
    const H = m.t + lanes.length * rowH + 26;
    const X = (y) => m.l + ((y - from) / (to - from || 1)) * (W - m.l - m.r);
    const g = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart timeline' });
    lanes.forEach((ln, i) => g.append(s('text', { x: 6, y: m.t + i * rowH + rowH / 2 + 4, class: 'lane' }, ln), s('line', { x1: m.l, x2: W - m.r, y1: m.t + (i + 1) * rowH, y2: m.t + (i + 1) * rowH, class: 'grid' })));
    for (let y = from; y <= to; y++) if (y % 2 === 0) g.append(s('text', { x: X(y), y: H - 8, 'text-anchor': 'middle', class: 'tick' }, y));
    g.append(s('line', { x1: X(2072), x2: X(2072), y1: m.t - 6, y2: m.t + lanes.length * rowH, class: 'marker' }));
    const bub = (lane, y, k, cls, title) => g.append(s('circle', { cx: X(y), cy: m.t + lane * rowH + rowH / 2, r: 4 + Math.min(14, k * 2), class: cls }, s('title', {}, title)));
    c.years.forEach((k, y) => bub(0, y, k, 'b-com', `${TT.bsLabel(y)}: ${k} respondent(s) first noticed`));
    hhCon.forEach((k, y) => bub(1, y, k, 'b-con', `${TT.bsLabel(y)}: ${k} respondent(s) dated concrete work`));
    works.forEach((w) => bub(2, w.y, 1, 'b-work', `${w.id} ${w.label} ${TT.bsLabel(w.y)}`));
    Object.entries(TT.ANCHORS).forEach(([y, a]) => { if (+y >= from && +y <= to) bub(3, +y, 0.5, +y === 2072 || +y === 2080 ? 'b-eq' : 'b-ev', `${TT.bsLabel(+y)}: ${a.en}`); });
    return h('div', g, h('p.muted.sm', { text: 'Hover/tap circles for details. If the first-noticed peak precedes the concrete-work years, H2 is weakened; if it coincides with 2072 only by timing, H4 still needs physical evidence.' }));
  }

  function engSummary(records) {
    const by = (f) => records.filter((r) => r.form === f);
    const wrap = h('div.grid2');
    const soil = by('soil');
    const zt = { A: '3–4', B: '2–3', C: '2–3', D: '1–2', E: '1–2' };
    wrap.append(h('div', h('h4', { text: `Soil samples (${soil.length}; target 10–15 + 4–6 cores)` }),
      bars(Object.keys(zt).map((z) => ({ label: { en: `Zone ${z} (target ${zt[z]})` }, n: soil.filter((r) => r.data.zone === z).length }))),
      h('p.muted.sm', { text: `Undisturbed cores: ${soil.filter((r) => r.data.stype === 'core').length} · auger profiles: ${soil.filter((r) => r.data.stype === 'auger').length}` })));
    const inf = by('inf').filter((r) => n(r.data.steady) != null);
    wrap.append(h('div', h('h4', { text: `Infiltration tests (${by('inf').length})` }), inf.length ? h('table.tbl.compact', h('tbody', ...inf.map((r) => h('tr', h('td', h('a', { href: '#/edit/' + r.id, text: r.data.test_id || r.id })), h('td', { text: 'zone ' + (r.data.zone || '?') }), h('td', { text: `${n(r.data.steady).toFixed(1)} mm/h` })))))
      : h('p.muted', { text: 'No completed tests yet.' })));
    const bath = by('bath');
    const depths = bath.flatMap((r) => (r.data.soundings || []).map((x) => n(x.depth)).filter((x) => x != null));
    wrap.append(h('div', h('h4', { text: 'Bathymetry' }), kv('Transects', String(bath.length)), kv('Soundings', String(depths.length)), kv('Max depth', depths.length ? Math.max(...depths).toFixed(2) + ' m' : '—'), kv('Mean depth', depths.length ? TT.mean(depths).toFixed(2) + ' m' : '—')));
    const q = by('q').filter((r) => n(r.data.q_adopt) != null);
    wrap.append(h('div', h('h4', { text: `Discharges (${by('q').length})` }), q.length ? h('table.tbl.compact', h('tbody', ...q.map((r) => h('tr', h('td', h('a', { href: '#/edit/' + r.id, text: r.data.site_id || r.id })), h('td', { text: r.data.stype || '' }), h('td', { text: `${n(r.data.q_adopt).toFixed(3)} L/s` })))))
      : h('p.muted', { text: 'No discharges yet.' })));
    const feat = by('feat');
    const ftField = TT.FORMS.feat.fieldMap.ftype;
    const ftc = ftField.options.map((o) => ({ label: o, n: feat.filter((r) => r.data.ftype === o.v).length })).filter((x) => x.n);
    wrap.append(h('div', h('h4', { text: `Mapped features (${feat.length})` }), ftc.length ? bars(ftc) : h('p.muted', { text: 'None yet.' }),
      h('p.muted.sm', { text: `Delivering to lake: ${feat.filter((r) => r.data.delivers === 'yes').length} · diverted/blocked: ${feat.filter((r) => ['diverted', 'blocked'].includes(r.data.delivers)).length}` })));
    const lin = by('lin');
    const seep = by('seep');
    wrap.append(h('div', h('h4', { text: 'Lining & seepage indicators' }),
      kv('Lining segments inspected', String(lin.length)), kv('… outside water ponding against lining (H2)', String(lin.filter((r) => r.data.ponding === 'yes').length)),
      kv('… inflow blocked by lining', String(lin.filter((r) => r.data.can_cross === 'blocked').length)), kv('… weep holes absent', String(lin.filter((r) => r.data.weep === 'absent').length)),
      kv('Seepage / wet sites', String(seep.length)), kv('… below lake level and flowing (H3)', String(seep.filter((r) => r.data.rel_level === 'below' && ['trickle', 'flowing'].includes(r.data.flow)).length)),
      kv('Seepage-meter tests', String(by('sm').length))));
    return wrap;
  }

  function hypSummary(records) {
    const hm = records.filter((r) => r.form === 'hyp').sort((a, b) => b.updated.localeCompare(a.updated))[0];
    if (!hm) return h('p.muted', { text: 'No assessment yet. Fill the Hypothesis–evidence matrix after Day 1, Day 3 and at the end of fieldwork.' });
    const items = TT.HYP.map((hy) => ({ label: { en: `${hy.id} ${hy.en}`, ne: `${hy.id} ${hy.ne}` }, n: n(hm.data[hy.id + '_score']) ?? 0, color: ['#c9d3d8', '#e9c46a', '#f4a261', '#b5541c'][n(hm.data[hy.id + '_score']) ?? 0] }));
    return h('div', h('p', h('a', { href: '#/edit/' + hm.id, text: hm.id }), ` · ${TT.optLabel(TT.FORMS.hyp.fieldMap.stage, hm.data.stage || '')} · ${TT.fmt(hm.updated)}`),
      bars(items, { fmt: (i) => `${i.n} / 3` }),
      hm.data.mechanism && kv('Dominant problem', TT.optLabel(TT.FORMS.hyp.fieldMap.mechanism, hm.data.mechanism)),
      hm.data.next_level && kv('Next level', TT.optLabel(TT.FORMS.hyp.fieldMap.next_level, hm.data.next_level)),
      h('p.muted.sm', { text: 'Scores are a transparent organising device (0 absent … 3 strong), not probabilities.' }));
  }
})();
