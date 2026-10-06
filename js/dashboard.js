/* Lakes field portal: analysis + dashboard (per lake or both lakes). */
'use strict';
(function () {
  const TT = window.TT;
  const { h, L } = TT;
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
        const z = TT.gaugeZero(ctx, r.data.gauge, r.data.lake);
        const gauge = `${TT.lakeCode(r.data.lake) || '?'} ${String(r.data.gauge || '?').trim().toUpperCase()}`;
        return { id: r.id, gauge, t: new Date(r.data.dt), reading: n(r.data.reading), wsl: z != null ? TT.round(z + n(r.data.reading), 3) : null, rain: r.data.rain_since || '' };
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
      const years = new Map(), srcFirst = new Map(), borda = new Map(), periods = {};
      hh.forEach((r) => {
        const y = parseInt(r.data.first_noticed, 10);
        if (r.data.noticed === 'yes' && y) {
          years.set(y, (years.get(y) || 0) + 1);
          const src = r.data.first_noticed__src || 'untagged';
          srcFirst.set(src, (srcFirst.get(src) || 0) + 1);
        }
        (r.data.cause_rank || []).forEach((c, i) => { if (c) borda.set(c, (borda.get(c) || 0) + (3 - i)); });
        Object.entries(r.data.levels || {}).forEach(([row, o]) => {
          const x = parseInt(o && o.dry, 10);
          if (x) (periods[row] = periods[row] || []).push(x);
        });
      });
      return {
        N: hh.length, years, srcFirst, borda, periods,
        eq: count('eq_change'), pattern: count('pattern'), others: count('other_sources'), conAfter: count('con_after'),
        wallow: count('wallow'), outlet: count('outlet'), downWet: count('down_wet'), pathClosed: count('path_closed'),
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

  // Minimal SVG line chart with square point markers. series: [{name, color, pts:[{x,y,title}], dash}]
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
    (yTicks || Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4)).forEach((y) => g.append(
      s('line', { x1: m.l, x2: W - m.r, y1: Y(y), y2: Y(y), class: 'grid' }), s('text', { x: m.l - 6, y: Y(y) + 4, 'text-anchor': 'end', class: 'tick' }, yFmt(y))));
    (xTicks || Array.from({ length: 6 }, (_, i) => xMin + ((xMax - xMin) * i) / 5)).forEach((x) => g.append(s('text', { x: X(x), y: H - m.b + 18, 'text-anchor': 'middle', class: 'tick' }, xFmt(x))));
    g.append(s('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }));
    markers.forEach((mk) => {
      if (mk.x < xMin || mk.x > xMax) return;
      g.append(s('line', { x1: X(mk.x), x2: X(mk.x), y1: m.t, y2: H - m.b, class: 'marker' }), s('text', { x: X(mk.x) + 4, y: m.t + 10, class: 'marker-t' }, mk.label));
    });
    series.forEach((se) => {
      const pts = [...se.pts].sort((a, b) => a.x - b.x);
      if (pts.length > 1) g.append(s('polyline', { points: pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' '), fill: 'none', style: `stroke:${se.color}`, 'stroke-width': 2.2, 'stroke-dasharray': se.dash || null }));
      pts.forEach((p) => g.append(s('rect', { x: X(p.x) - 3.5, y: Y(p.y) - 3.5, width: 7, height: 7, style: `fill:${p.color || se.color}` }, s('title', {}, p.title || `${xFmt(p.x)}: ${yFmt(p.y)}`))));
    });
    return h('div.chart-wrap', g, h('div.legend', ...series.map((se) => h('span', h('i', { style: { background: se.color } }), se.name))));
  }

  // Bars per BS year, with the 2072 earthquake year highlighted.
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

  /* ============================ dashboard view ============================ */
  const card = (title, ...kids) => h('section.card.dash-card', h('h3', { text: title }), ...kids);
  const kv = (k, v) => h('div.kv', h('span', { text: k }), h('b', { text: v }));

  TT.renderDashboard = async function (root, ctx, lake = ctx.settings.activeLake || 'all') {
    const recordsAll = ctx.records;
    const records = lake === 'all' ? recordsAll : recordsAll.filter((r) => r.data.lake === lake || r.data.lake === 'both');
    const photos = await TT.db.all('photos');
    const lakes = lake === 'all' ? TT.LAKE_IDS.length : 1;
    const pick = h('select.inp.sm', { 'aria-label': 'Lake', style: { width: 'auto', flex: 'none' } }, h('option', { value: 'all', text: 'Both lakes' }), ...TT.O.lake.map((o) => h('option', { value: o.v, text: o.en })));
    pick.value = lake;
    pick.addEventListener('change', () => TT.renderDashboard(root, ctx, pick.value));
    root.replaceChildren(h('div.page-head', h('h1', { text: 'Dashboard' }),
      h('div.btn-row', pick, h('span.muted', { text: `${records.length} records · ${records.filter((r) => r.status === 'complete').length} complete · ${photos.length} photos` }))));

    /* progress */
    const prog = h('div.prog-grid');
    for (const id of TT.FORM_ORDER) {
      const f = TT.FORMS[id];
      const recs = records.filter((r) => r.form === id);
      const done = recs.filter((r) => r.status === 'complete').length;
      const target = (f.target || 1) * lakes;
      prog.append(h('a.prog-item', { href: '#/records?form=' + id },
        h('div.prog-top', TT.icon(f.icon || 'file'), h('b', { text: f.short }), h('span.muted', { text: `${done}/${target} ${f.targetLabel || ''}` })),
        h('div.prog-name', L(f.title)),
        h('div.prog-bar', h('i', { style: { width: Math.min(100, (100 * done) / target) + '%' } })),
        recs.length > done && h('small.muted', { text: `${recs.length - done} draft` })));
    }
    root.append(card('Progress', prog));

    /* water level */
    const wl = TT.analysis.waterLevel(records, { ...ctx, records: recordsAll });
    const wlCard = card('Water level');
    if (!wl.length) wlCard.append(h('p.muted', { text: 'No readings yet.' }));
    else {
      const gauges = [...new Set(wl.map((p) => p.gauge))];
      const pal = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)'];
      const useRL = wl.every((p) => p.wsl != null);
      wlCard.append(chart({
        series: gauges.map((g, i) => ({ name: g + (useRL ? ' (RL m)' : ' (staff m)'), color: pal[i % pal.length],
          pts: wl.filter((p) => p.gauge === g).map((p) => ({ x: +p.t, y: useRL ? p.wsl : p.reading, color: p.flag && p.flag.startsWith('Fall') ? 'var(--bad)' : null, title: `${p.id} ${TT.fmt(p.t)}: ${useRL ? p.wsl : p.reading} m` })) })),
        xFmt: (x) => { const d = new Date(x); return `${d.getMonth() + 1}/${d.getDate()} ${TT.pad(d.getHours())}h`; }, yFmt: (y) => y.toFixed(3),
      }));
      const head = h('thead', h('tr', ...['Reading', 'Gauge', 'Time', 'Staff m', 'RL m', 'Δt h', 'Fall mm/d', 'Rain', 'Screening'].map((x) => h('th', { text: x }))));
      const body = h('tbody', ...wl.slice(-40).reverse().map((p) => h('tr' + (p.flag && p.flag.startsWith('Fall') ? '.flag' : ''),
        h('td', h('a', { href: '#/edit/' + p.id, text: p.id })), h('td', { text: p.gauge }), h('td', { text: TT.fmt(p.t) }), h('td', { text: p.reading.toFixed(3) }),
        h('td', { text: p.wsl != null ? p.wsl.toFixed(3) : '' }), h('td', { text: p.dtH ?? '' }), h('td', { text: p.rate ?? '' }), h('td', { text: p.rain }), h('td', { text: p.flag || '' }))));
      wlCard.append(h('div.tbl-scroll', h('table.tbl.compact', head, body)));
    }
    root.append(wlCard);

    /* community */
    const c = TT.analysis.community(records);
    const com = card('Community evidence');
    if (!c.N) com.append(h('p.muted', { text: 'No interviews yet.' }));
    else {
      const ys = [...c.years.keys()];
      com.append(h('p', { text: `${c.N} interviews · ${[...c.years.values()].reduce((a, b) => a + b, 0)} dated the decline` }));
      if (ys.length) {
        com.append(h('h4', { text: 'Year decline first noticed (BS)' }),
          yearHist(c.years, { from: Math.min(2062, ...ys), to: Math.max(TT.bsYearOf(), ...ys) }),
          h('p.muted.sm', { text: 'Source: ' + [...c.srcFirst.entries()].map(([k, v]) => `${k === 'untagged' ? 'not tagged' : TT.optLabel({ options: TT.O.src }, k)} ${v}`).join(' · ') }));
      }
      const pLabels = { pre: 'Before 2072', mid: '2072–2079', now: 'Last two years' };
      const per = Object.keys(pLabels).filter((k) => c.periods[k]).map((k) => ({ label: { en: pLabels[k] }, n: TT.mean(c.periods[k]), count: c.periods[k].length }));
      if (per.length) com.append(h('h4', { text: 'Dry-season level (5 full – 1 dry)' }), bars(per, { fmt: (i) => `${i.n.toFixed(1)} (n=${i.count})` }));
      const grid2 = h('div.grid2');
      const sub = (title, d) => h('div', h('h4', { text: title }), d.items.length ? bars(d.items.map((x) => ({ label: x.o, n: x.n })), { total: d.base }) : h('p.muted', { text: 'No answers yet.' }));
      grid2.append(sub('After the 2072 earthquake', c.eq), sub('Pattern of decline', c.pattern), sub('Other springs / taps declined', c.others),
        sub('After the concrete work', c.conAfter), sub('Old inflow path blocked', c.pathClosed), sub('Seepage below the lake', c.downWet),
        sub('Outlet / overflow', c.outlet), sub('Buffalo wallowing', c.wallow));
      com.append(grid2);
      const causeItems = TT.O.causes.map((o) => ({ label: o, n: c.borda.get(o.v) || 0 })).filter((x) => x.n).sort((a, b) => b.n - a.n);
      com.append(h('h4', { text: 'Perceived causes (rank score)' }), causeItems.length ? bars(causeItems) : h('p.muted', { text: 'No rankings yet.' }));
    }
    root.append(com);

    root.append(card('Timeline', timeline(records, c)));
    root.append(card('Engineering summary', engSummary(records, lakes)));
    root.append(card('Cause ranking', hypSummary(records)));
  };

  function timeline(records, c) {
    const works = new Map(), hhCon = new Map();
    records.filter((r) => r.form === 'kii').forEach((r) => (r.data.k_works || []).forEach((w) => { const y = parseInt(w.year, 10); if (y) works.set(y, (works.get(y) || 0) + 1); }));
    records.filter((r) => r.form === 'hh').forEach((r) => { const y = parseInt(r.data.con_year, 10); if (y) hhCon.set(y, (hhCon.get(y) || 0) + 1); });
    const yrs = [...c.years.keys(), ...works.keys(), ...hhCon.keys(), 2072];
    const from = Math.min(2062, ...yrs), to = Math.max(TT.bsYearOf(), ...yrs);
    const lanes = [
      ['Decline first noticed', c.years, 'b-com', 'respondent(s) first noticed the decline'],
      ['Concrete work (HH)', hhCon, 'b-con', 'respondent(s) dated the concrete work'],
      ['Works (KII)', works, 'b-work', 'work(s) listed'],
    ];
    const W = 720, rowH = 48, m = { l: 150, r: 10, t: 8 };
    const H = m.t + (lanes.length + 1) * rowH + 22;
    const cw = (W - m.l - m.r) / (to - from + 1);
    const X = (y) => m.l + (y - from) * cw;
    const g = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart timeline', role: 'img' });
    [...lanes.map((l) => l[0]), 'Events'].forEach((ln, i) => g.append(
      s('text', { x: 4, y: m.t + i * rowH + rowH / 2 + 4, class: 'lane' }, ln),
      s('line', { x1: m.l, x2: W - m.r, y1: m.t + (i + 1) * rowH, y2: m.t + (i + 1) * rowH, class: 'axis' })));
    for (let y = from; y <= to; y++) if ((y - from) % 2 === 0) g.append(s('text', { x: X(y) + cw / 2, y: H - 6, 'text-anchor': 'middle', class: 'tick' }, y));
    g.append(s('line', { x1: X(2072) + cw / 2, x2: X(2072) + cw / 2, y1: m.t, y2: m.t + (lanes.length + 1) * rowH, class: 'marker' }));
    lanes.forEach(([, map, cls, what], i) => {
      const max = Math.max(1, ...map.values());
      const base = m.t + (i + 1) * rowH;
      map.forEach((k, y) => {
        const bh = Math.max(3, (k / max) * (rowH - 18));
        g.append(s('rect', { x: X(y) + 1.5, y: base - bh, width: Math.max(2, cw - 3), height: bh, class: cls }, s('title', {}, `${TT.bsLabel(y)}: ${k} ${what}`)),
          s('text', { x: X(y) + cw / 2, y: base - bh - 3, 'text-anchor': 'middle', class: 'cnt' }, k));
      });
    });
    const evBase = m.t + (lanes.length + 1) * rowH;
    const events = Object.entries(TT.ANCHORS).filter(([y]) => +y >= from && +y <= to);
    events.forEach(([y, a]) => g.append(s('rect', { x: X(+y) + cw / 2 - 1.5, y: evBase - rowH + 10, width: 3, height: rowH - 14, class: +y === 2072 || +y === 2080 ? 'b-eq' : 'b-ev' }, s('title', {}, `${TT.bsLabel(+y)}: ${a.en}`))));
    return h('div', g,
      h('p.muted.sm', { text: events.map(([y, a]) => `${y} ${a.en}`).join(' · ') }));
  }

  function engSummary(records, lakes) {
    const by = (f) => records.filter((r) => r.form === f);
    const wrap = h('div.grid2');
    const soil = by('soil');
    wrap.append(h('div', h('h4', { text: `Soil samples (${soil.length}; target ${6 * lakes})` }),
      bars(['A', 'B', 'C', 'D', 'E'].map((z) => ({ label: { en: `Zone ${z}` }, n: soil.filter((r) => r.data.zone === z).length }))),
      h('p.muted.sm', { text: `Cores: ${soil.filter((r) => r.data.stype === 'core').length}` })));
    const inf = by('inf').filter((r) => n(r.data.steady) != null);
    wrap.append(h('div', h('h4', { text: `Infiltration tests (${by('inf').length})` }), inf.length
      ? h('table.tbl.compact', h('tbody', ...inf.map((r) => h('tr', h('td', h('a', { href: '#/edit/' + r.id, text: r.data.test_id || r.id })), h('td', { text: TT.lakeCode(r.data.lake) }), h('td', { text: 'zone ' + (r.data.zone || '?') }), h('td', { text: `${n(r.data.steady).toFixed(1)} mm/h` })))))
      : h('p.muted', { text: 'None yet.' })));
    const bath = by('bath');
    const depths = bath.flatMap((r) => (r.data.soundings || []).map((x) => n(x.depth)).filter((x) => x != null));
    wrap.append(h('div', h('h4', { text: 'Depth' }), kv('Transects', String(bath.length)), kv('Soundings', String(depths.length)),
      kv('Max depth', depths.length ? Math.max(...depths).toFixed(2) + ' m' : '—'), kv('Mean depth', depths.length ? TT.mean(depths).toFixed(2) + ' m' : '—')));
    const q = by('q').filter((r) => n(r.data.q_adopt) != null);
    wrap.append(h('div', h('h4', { text: `Flows (${by('q').length})` }), q.length
      ? h('table.tbl.compact', h('tbody', ...q.map((r) => h('tr', h('td', h('a', { href: '#/edit/' + r.id, text: r.data.site_id || r.id })), h('td', { text: r.data.stype ? TT.optLabel(TT.FORMS.q.fieldMap.stype, r.data.stype) : '' }), h('td', { text: `${n(r.data.q_adopt).toFixed(3)} L/s` })))))
      : h('p.muted', { text: 'None yet.' })));
    const feat = by('feat');
    const ftc = TT.FORMS.feat.fieldMap.ftype.options.map((o) => ({ label: o, n: feat.filter((r) => r.data.ftype === o.v).length })).filter((x) => x.n);
    wrap.append(h('div', h('h4', { text: `Site features (${feat.length})` }), ftc.length ? bars(ftc) : h('p.muted', { text: 'None yet.' })));
    const lining = feat.filter((r) => r.data.ftype === 'lining');
    const seeps = feat.filter((r) => r.data.ftype === 'seep');
    wrap.append(h('div', h('h4', { text: 'Key indicators' }),
      kv('Inflows reaching the lake', String(feat.filter((r) => ['inflow', 'drain', 'catch'].includes(r.data.ftype) && r.data.reaches === 'yes').length)),
      kv('Inflows diverted or blocked', String(feat.filter((r) => r.data.reaches === 'no').length)),
      kv('Lining: outside ground higher than crest', String(lining.filter((r) => r.data.outside === 'higher').length)),
      kv('Lining: water ponding outside (H2)', String(lining.filter((r) => r.data.ponding === 'yes').length)),
      kv('Lining: no weep holes', String(lining.filter((r) => r.data.weep === 'absent').length)),
      kv('Seeps below lake level and flowing (H3)', String(seeps.filter((r) => r.data.below === 'below' && ['trickle', 'flowing'].includes(r.data.flow)).length))));
    const latest = (kind, id) => by('trk').filter((r) => r.data.kind === kind && r.data.lake === id && n(r.data.area) != null).sort((a, b) => b.updated.localeCompare(a.updated))[0];
    for (const id of TT.LAKE_IDS) {
      const now = latest('edge', id), old = latest('hwm', id);
      if (!now && !old) continue;
      const a1 = now ? n(now.data.area) : null, a0 = old ? n(old.data.area) : null;
      const m2 = (a) => (a != null ? `${Math.round(a).toLocaleString('en')} m²` : '—');
      wrap.append(h('div', h('h4', { text: `Lake area: ${TT.lakeName(id)}` }), kv('Water edge now (GPS track)', m2(a1)), kv('Old high-water line (GPS track)', m2(a0)),
        a1 != null && a0 ? kv('Area now as share of old', `${Math.round((100 * a1) / a0)}%`) : null));
    }
    return wrap;
  }

  function hypSummary(records) {
    const latest = TT.LAKE_IDS.map((id) => records.filter((r) => r.form === 'hyp' && r.data.lake === id).sort((a, b) => b.updated.localeCompare(a.updated))[0]).filter(Boolean);
    if (!latest.length) return h('p.muted', { text: 'Not scored yet.' });
    const colours = ['#c9d3d8', '#e9c46a', '#f4a261', '#b5541c'];
    return h('div.grid2', ...latest.map((hm) => h('div',
      h('h4', { text: TT.lakeName(hm.data.lake) }),
      h('p', h('a', { href: '#/edit/' + hm.id, text: hm.id }), ` · ${TT.fmt(hm.updated)}`),
      bars(TT.HYP.map((hy) => { const sc = n(hm.data[hy.id + '_score']) ?? 0; return { label: { en: `${hy.id} ${hy.en}` }, n: sc, color: colours[sc] }; }), { fmt: (i) => `${i.n} / 3` }),
      hm.data.mechanism && kv('Main problem', TT.optLabel(TT.FORMS.hyp.fieldMap.mechanism, hm.data.mechanism)))));
  }
})();
