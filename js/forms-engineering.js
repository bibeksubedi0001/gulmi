/* Lakes field portal: engineering forms for a one-day visit per lake. */
'use strict';
(function () {
  const TT = window.TT;
  const O = TT.O;
  const E = (s) => s.split('|').map((p) => { const i = p.indexOf(':'); return { v: p.slice(0, i), en: p.slice(i + 1) }; });
  const Q = (id, type, en, x = {}) => ({ id, type, q: { en }, ...x });
  const C = (id, type, label, x = {}) => ({ id, type, label: { en: label }, ...x });
  const n = TT.num;
  const fx = (x, d = 3) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
  const HYP_OPTS = TT.HYP.map((hy) => ({ v: hy.id, en: `${hy.id} ${hy.en}` }));
  const reg = (f) => TT.registerForm({ group: 'engineering', version: 2, ...f });

  /* ---------- lake-aware lookups ---------- */
  const same = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
  TT.marks = (ctx, kind, lake) => (ctx.records || []).filter((r) => r.form === 'bm' && (!kind || r.data.kind === kind) && (!lake || r.data.lake === lake));
  TT.gaugeZero = (ctx, id, lake) => {
    const r = TT.marks(ctx, 'gauge', lake).find((x) => same(x.data.mark_id, id));
    return r ? n(r.data.zero_rl) : null;
  };
  TT.markRL = (ctx, id, lake) => {
    const r = TT.marks(ctx, 'bm', lake).find((x) => same(x.data.mark_id, id));
    return r ? n(r.data.rl) : null;
  };
  const ids = (form, key, filter) => (v, ctx) => [...new Set((ctx.records || [])
    .filter((r) => r.form === form && r.data[key] && (!v.lake || r.data.lake === v.lake) && (!filter || filter(r)))
    .map((r) => String(r.data[key])))];
  const gaugeIds = ids('bm', 'mark_id', (r) => r.data.kind === 'gauge');
  const markIds = ids('bm', 'mark_id', (r) => r.data.kind === 'bm');
  // Next free ID with a lake-specific prefix, e.g. TT-A03 or CK-IN-02.
  TT.nextId = (ctx, form, key, prefix) => {
    const re = new RegExp(`^${prefix}(\\d+)$`);
    let max = 0;
    for (const r of ctx.records || []) {
      if (r.form !== form || (ctx.record && r.id === ctx.record.id)) continue;
      const m = String(r.data[key] || '').match(re);
      if (m) max = Math.max(max, +m[1]);
    }
    return prefix + TT.pad(max + 1);
  };
  // Re-suggest an auto ID when the lake or type changes, unless the user typed their own.
  const autoId = (key, auto, prefixOf, watch) => (fid, v, ctx, api) => {
    if (!watch.includes(fid)) return;
    const prefix = prefixOf(v);
    if (!prefix) return;
    const cur = v[key] || '';
    if (cur && (!auto.test(cur) || cur.startsWith(prefix))) return;
    api.setValue(key, TT.nextId(ctx, ctx.record.form, key, prefix));
  };
  const surveyors = () => Q('surveyor', 'people', 'Surveyor(s)', { default: TT.defaultTeam });
  const when = () => Q('dt', 'datetime', 'Date & time', { now: true });

  /* ---------- field day checklist ---------- */
  const PREP = E('maps:Printed maps / satellite sheets|records:Old photos and construction records requested|ki:Key informants contacted|phones:Portal opened offline on every phone; enumerator set|calib:EC / temperature meter calibrated|labels:Sample bags and core tubes labelled|permit:Ward / landowner permission|kit:Kit packed: tape, staff and level, sounding line, pegs, gauge, auger, core rings, bucket and stopwatch, life jacket, first aid');
  const TASKS = E('centre:Lake centre GPS set (Data page)|bm:Benchmark and staff gauge installed and levelled|wl_am:Morning level reading|perimeter:Perimeter walked: inflows, outlet, lining, cracks, seeps mapped|bathy:Depth transects + one QA repeat|soil:Soil samples (zones A–E)|infil:Infiltration tests|flows:Visible flows measured|hh:Household interviews (8)|kii:Key-informant interviews (2)|wl_pm:Evening level reading|hyp:Hypothesis matrix scored|reader:Community gauge reader appointed|export:All phones exported (field package)');
  reg({
    id: 'day', short: 'DAY', icon: 'calendar', target: 1, targetLabel: 'day',
    title: { en: 'Field day checklist' },
    summary: (v) => [v.date, Array.isArray(v.tasks) ? `${v.tasks.length}/${TASKS.length} tasks` : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Day' }, fields: [
        Q('date', 'date', 'Date', { now: true }),
        Q('kind', 'select', 'Day type', { default: 'field', options: E('prep:Preparation (before travel)|field:Field day at this lake|extra:Follow-up visit') }),
        Q('team', 'people', 'Team present', { default: TT.defaultTeam }),
        Q('weather', 'select', 'Weather', { options: O.weather }),
        Q('rain_24h', 'select', 'Rain in the last 24 h', { options: O.rainSince }),
        Q('prep', 'checks', 'Preparation done', { show: ['kind', 'prep'], options: PREP }),
        Q('tasks', 'checks', 'Tasks completed', { show: ['kind', ['field', 'extra']], options: TASKS }),
        Q('notes', 'textarea', 'Findings, problems and follow-up'),
      ] },
    ],
  });

  /* ---------- benchmark & staff gauge ---------- */
  reg({
    id: 'bm', short: 'BM', icon: 'crosshair', geo: 'loc', target: 2, targetLabel: 'marks',
    title: { en: 'Benchmark & staff gauge' },
    summary: (v) => [v.mark_id, v.kind === 'gauge' ? 'gauge' : 'benchmark', v.zero_rl != null ? 'zero RL ' + v.zero_rl : v.rl != null ? 'RL ' + v.rl : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Mark' }, fields: [
        Q('kind', 'select', 'Type', { options: E('bm:Benchmark|gauge:Staff gauge') }),
        Q('mark_id', 'text', 'ID', { ph: 'BM-1 or SG-1' }),
        Q('desc', 'text', 'Set on / how to find it', { ph: 'e.g. steel rod in rock, 4 m east of the steps' }),
        Q('loc', 'gps', 'Position (averaged)', { average: true }),
        Q('photos', 'photos', 'Photos', { required: true }),
        Q('rl', 'number', 'Adopted RL (e.g. assumed 100.000)', { unit: 'm', show: ['kind', 'bm'] }),
        Q('bm_ref', 'text', 'Benchmark used', { show: ['kind', 'gauge'], suggest: markIds }),
        Q('bs_bm', 'number', 'Backsight on benchmark', { unit: 'm', min: 0, max: 5, show: ['kind', 'gauge'] }),
        Q('fs_zero', 'number', 'Foresight on gauge zero', { unit: 'm', min: 0, max: 5, show: ['kind', 'gauge'] }),
        Q('zero_rl', 'computed', 'Gauge-zero RL = BM RL + BS − FS', { unit: 'm', show: ['kind', 'gauge'], empty: 'needs benchmark RL, BS and FS',
          compute: (v, ctx) => {
            const b = TT.markRL(ctx, v.bm_ref, v.lake);
            return b != null && n(v.bs_bm) != null && n(v.fs_zero) != null ? b + n(v.bs_bm) - n(v.fs_zero) : null;
          } }),
      ] },
    ],
  });

  /* ---------- water level ---------- */
  reg({
    id: 'wl', short: 'WL', icon: 'wave', target: 4, targetLabel: 'readings',
    title: { en: 'Water-level reading' },
    summary: (v) => [v.gauge, n(v.reading) != null ? fx(n(v.reading)) + ' m' : '', TT.fmt(v.dt)].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Reading' }, fields: [
        Q('gauge', 'text', 'Gauge ID', { suggest: gaugeIds, ph: 'SG-1' }),
        when(),
        Q('reading', 'number', 'Staff reading', { unit: 'm', min: -1, max: 10 }),
        Q('wsl', 'computed', 'Water-surface RL', { unit: 'm', empty: 'gauge not levelled yet',
          compute: (v, ctx) => { const z = TT.gaugeZero(ctx, v.gauge, v.lake); return z != null && n(v.reading) != null ? z + n(v.reading) : null; } }),
        Q('rain_since', 'select', 'Rain since the previous reading', { options: O.rainSince }),
        Q('observer', 'person', 'Read by', { default: (ctx) => ctx.settings.enumerator || '' }),
        Q('photo', 'photos', 'Photo of the staff'),
        Q('remarks', 'text', 'Remarks (inflow / outflow seen, waves, pumping)'),
      ] },
    ],
  });

  /* ---------- site features (inflow, outlet, lining, cracks, seeps, catchment, photo points) ---------- */
  const FT = E('shore:Shoreline / high-water mark|inflow:Inflow / gully / swale|drain:Road drain / culvert|outlet:Outlet / overflow|lining:Concrete lining section|crack:Crack / open joint|seep:Seep / spring / wet patch|rpond:Recharge pond / trench|erosion:Erosion / sediment|catch:Catchment divide / runoff path|photo:Photo point|other:Other');
  const FT_CODE = { shore: 'SH', inflow: 'IN', drain: 'DR', outlet: 'OF', lining: 'LN', crack: 'CR', seep: 'SP', rpond: 'RP', erosion: 'ER', catch: 'CA', photo: 'PH', other: 'OT' };
  const WATER = ['inflow', 'drain', 'outlet', 'seep', 'rpond', 'catch', 'erosion'];
  const featPrefix = (v) => (v.lake && FT_CODE[v.ftype] ? `${TT.lakeCode(v.lake)}-${FT_CODE[v.ftype]}-` : '');
  reg({
    id: 'feat', short: 'FT', icon: 'pin', geo: 'loc', target: 15, targetLabel: 'features',
    title: { en: 'Site feature' },
    summary: (v) => [v.fid, v.ftype && TT.optLabel(TT.FORMS.feat.fieldMap.ftype, v.ftype), v.reaches && 'to lake: ' + v.reaches].filter(Boolean).join(' · '),
    onChange: autoId('fid', /^[A-Z]{2}-[A-Z]{2}-\d+$/, featPrefix, ['ftype', 'lake']),
    onNew: (v, ctx) => { const p = featPrefix(v); if (p && !v.fid) v.fid = TT.nextId(ctx, 'feat', 'fid', p); },
    sections: [
      { id: '1', title: { en: 'Feature' }, fields: [
        surveyors(), when(),
        Q('ftype', 'select', 'Feature type', { options: FT }),
        Q('fid', 'text', 'Feature ID (auto)', { ph: 'TT-IN-01' }),
        Q('loc', 'gps', 'Position'),
        Q('photos', 'photos', 'Photos', { required: true }),
        Q('desc', 'textarea', 'Description'),
        Q('reaches', 'select', 'Does water from here reach the lake?', { show: ['ftype', WATER], options: E('yes:Yes|partly:Partly|no:No — diverted or blocked|unknown:Unknown') }),
        Q('flow', 'select', 'Flow now', { show: ['ftype', [...WATER, 'crack']], options: O.flowState }),
        Q('size', 'text', 'Size (width × depth × length, m)', { show: ['ftype', ['inflow', 'drain', 'outlet', 'lining', 'crack', 'rpond', 'erosion']] }),
        Q('outside', 'select', 'Outside ground vs lining crest', { show: ['ftype', 'lining'], options: E('higher:Outside higher than crest|level:About level|lower:Outside lower than crest') }),
        Q('ponding', 'yn', 'Water ponding against the outside of the lining?', { show: ['ftype', 'lining'] }),
        Q('weep', 'select', 'Weep holes', { show: ['ftype', 'lining'], options: E('ok:Present, working|blocked:Present, blocked|absent:Absent') }),
        Q('crack_w', 'number', 'Crack width (max)', { unit: 'mm', show: ['ftype', 'crack'] }),
        Q('below', 'select', 'Level relative to the lake water', { show: ['ftype', 'seep'], options: E('below:Below lake level|same:About the same|above:Above lake level') }),
        Q('ec', 'number', 'EC', { unit: 'µS/cm', show: ['ftype', ['seep', 'inflow', 'outlet']] }),
        Q('temp', 'number', 'Water temperature', { unit: '°C', show: ['ftype', ['seep', 'inflow', 'outlet']] }),
        Q('hwm', 'number', 'Height above current water level', { unit: 'm', show: ['ftype', 'shore'] }),
        Q('end_pt', 'gps', 'End of the traced runoff path', { show: ['ftype', 'catch'] }),
        Q('bearing', 'number', 'Camera bearing', { unit: '°', min: 0, max: 360, show: ['ftype', 'photo'] }),
        Q('hyp', 'checks', 'Evidence for hypotheses', { options: HYP_OPTS }),
      ] },
    ],
  });

  /* ---------- depth transect ---------- */
  reg({
    id: 'bath', short: 'BT', icon: 'anchor', geo: 'start_pt', target: 6, targetLabel: 'transects',
    title: { en: 'Depth transect' },
    summary: (v) => [v.tr_id, Array.isArray(v.soundings) ? v.soundings.filter((r) => r.depth != null).length + ' soundings' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Transect' }, fields: [
        surveyors(), when(),
        Q('tr_id', 'text', 'Transect ID', { ph: 'T-01' }),
        Q('gauge', 'text', 'Gauge ID', { suggest: gaugeIds }),
        Q('g_start', 'number', 'Gauge reading at start', { unit: 'm' }),
        Q('g_end', 'number', 'Gauge reading at end', { unit: 'm' }),
        Q('wsl', 'computed', 'Mean water-surface RL', { unit: 'm', empty: 'needs a levelled gauge and a reading',
          compute: (v, ctx) => {
            const z = TT.gaugeZero(ctx, v.gauge, v.lake), a = n(v.g_start), b = n(v.g_end);
            const g = a != null && b != null ? (a + b) / 2 : a ?? b;
            return z != null && g != null ? z + g : null;
          } }),
        Q('start_pt', 'gps', 'Start (shore)'),
        Q('end_pt', 'gps', 'End (shore)'),
        Q('soundings', 'table', 'Soundings', { minRows: 8, printRows: 20, carry: ['bed'], autoInc: 'chain', autoStep: 3, columns: [
          C('chain', 'number', 'Distance', { unit: 'm' }), C('depth', 'number', 'Depth', { unit: 'm', min: 0, max: 30 }),
          C('bed', 'select', 'Bed', { options: E('soft:Soft mud|sand:Sand / gravel|clay:Firm clay|rock:Rock|concrete:Concrete|veg:Vegetation') }),
          C('qa', 'check', 'QA'), C('gps', 'gps', 'GPS'), C('bedrl', 'number', 'Bed RL', { computed: true, unit: 'm' })],
          compute: (rows, v) => rows.map((r) => ({ bedrl: n(v.wsl) != null && n(r.depth) != null ? n(v.wsl) - n(r.depth) : null })),
          summary: (rows) => {
            const d = rows.map((r) => n(r.depth)).filter((x) => x != null);
            return [['Soundings', String(d.length)], ['Max depth', d.length ? Math.max(...d).toFixed(2) + ' m' : '—'],
              ['Mean depth', d.length ? TT.mean(d).toFixed(2) + ' m' : '—'], ['QA repeats', String(rows.filter((r) => r.qa).length)]];
          } }),
        Q('notes', 'text', 'Notes'),
      ] },
    ],
  });

  /* ---------- soil sample: hand sampling, feel-and-appearance moisture, water availability ---------- */
  const ZONES = E('A:A — Exposed lake margin / former bed|B:B — Inflow / swale zone|C:C — Next to the lining (not through it)|D:D — Downslope wet spot|E:E — Undisturbed control upslope');
  const soilPrefix = (v) => (v.lake && v.zone ? `${TT.lakeCode(v.lake)}-${v.zone}` : '');
  const MOIST = E('dry:Very dry (0–25%) — powdery, falls apart, no stain|slight:Slightly moist (25–50%) — weak ball, breaks easily|moist:Moist (50–75%) — ball holds shape, slight stain|wet:Wet (75–100%) — sticky, mouldable, stains fingers|sat:Saturated — water appears when squeezed');
  const TEXTURE = E('sand:Sand — loose and gritty; weak ball when moist|silt:Silty — smooth and floury; silky ball when moist|loam:Loam — crumbly; pliable ball when moist|clay:Clay — hard clods; strong ball, ribbons when moist|other:Other');
  const AVAIL = { dry: 'Very low — crumbles instantly', slight: 'Moderate — ball forms but cracks', moist: 'High — smooth ball', wet: 'High — smooth ball', sat: 'At or above field capacity — free water' };
  const head = (opts, v) => { const o = opts.find((x) => x.v === v); return o ? o.en.split(/ \(| —/)[0] : v; };
  reg({
    id: 'soil', short: 'SS', icon: 'layers', geo: 'loc', target: 6, targetLabel: 'samples', version: 3,
    title: { en: 'Soil sample' },
    summary: (v) => [v.sample_id, v.moisture && head(MOIST, v.moisture), v.texture && head(TEXTURE, v.texture)].filter(Boolean).join(' · '),
    onChange: autoId('sample_id', /^[A-Z]{2}-[A-E]\d+$/, soilPrefix, ['zone', 'lake']),
    onNew: (v, ctx) => { const p = soilPrefix(v); if (p && !v.sample_id) v.sample_id = TT.nextId(ctx, 'soil', 'sample_id', p); },
    sections: [
      { id: 'A', title: { en: 'Sampling location' }, fields: [
        Q('zone', 'select', 'Zone', { options: ZONES }),
        Q('sample_id', 'text', 'Sample ID (auto)', { ph: 'TT-A01' }),
        Q('loc', 'gps', 'Position'),
        when(),
        Q('site', 'checks', 'Present at the spot (avoid if possible)', { options: E('disturbed:Recently disturbed soil|burrow:Animal burrows|channel:Road or water channel close by|none:None of these') }),
        Q('collected_by', 'person', 'Collected by', { default: (ctx) => ctx.settings.enumerator || '' }),
      ] },
      { id: 'B', title: { en: 'Sample collection' }, fields: [
        Q('depth', 'select', 'Depth (dug by hand or stick)', { default: '5-15', options: E('5-15:5–15 cm (root zone)|15-30:15–30 cm|30+:Deeper than 30 cm') }),
        Q('collect', 'checks', 'Collection', { options: E('debris:Surface debris removed (leaves, stones, litter)|bottom:Soil taken from the bottom of the hole|handful:About a handful collected') }),
        Q('stype', 'select', 'Sample kept', { options: E('none:Not kept (tested on site)|dist:Bagged for the lab|core:Core (undisturbed)') }),
        Q('photos', 'photos', 'Photos', { required: true }),
      ] },
      { id: 'C', title: { en: 'Moisture (feel and appearance)' }, fields: [
        Q('moisture', 'select', 'Moisture by feel (% of plant-available water)', { options: MOIST }),
      ] },
      { id: 'D', title: { en: 'Soil texture' }, fields: [
        Q('texture', 'select', 'Texture by feel', { other: true, options: TEXTURE }),
      ] },
      { id: 'E', title: { en: 'Water availability' }, fields: [
        Q('avail', 'computed', 'From the squeeze test', { empty: 'select the moisture level', compute: (v) => AVAIL[v.moisture] || null }),
        Q('plants', 'select', 'Plants at the spot', { options: E('am:Wilting in the early morning — critically low|pm:Wilting only in the afternoon — moderate|ok:Dark green, turgid leaves — adequate|none:No plants at the spot') }),
      ] },
      { id: 'F', title: { en: 'Field notes' }, fields: [
        Q('tests', 'checks', 'Lab tests', { show: ['stype', ['dist', 'core']], options: E('wc:Water content|gsd:Grain size|atterberg:Atterberg limits|density:Density|perm:Permeability|om:Organic content') }),
        Q('notes', 'textarea', 'Notes (colour, roots, smell, anything unusual)'),
      ] },
    ],
  });

  /* ---------- infiltration ---------- */
  const KSAT = (um) => (um >= 100 ? 'Very high' : um >= 10 ? 'High' : um >= 1 ? 'Moderately high' : um >= 0.1 ? 'Moderately low' : um >= 0.01 ? 'Low' : 'Very low');
  const infComp = (rows) => {
    let prevRef = null, prevT = null, cum = 0;
    return rows.map((r) => {
      const tm = n(r.t), rd = n(r.rd), rf = n(r.refill);
      let drop = null, rate = null, c = null;
      if (tm != null && rd != null) {
        if (prevRef != null && prevT != null && tm > prevT) { drop = rd - prevRef; cum += drop; c = cum; rate = (drop * 10) / ((tm - prevT) / 60); }
        prevRef = rf ?? rd;
        prevT = tm;
      }
      return { drop, cum: c, rate };
    });
  };
  const steady = (comp) => {
    const r = comp.map((c) => c.rate).filter((x) => x != null);
    return r.length >= 3 ? TT.mean(r.slice(-3)) : r.length ? r[r.length - 1] : null;
  };
  reg({
    id: 'inf', short: 'IF', icon: 'funnel', geo: 'loc', target: 2, targetLabel: 'tests',
    title: { en: 'Infiltration test' },
    summary: (v) => [v.test_id, v.zone && 'zone ' + v.zone, n(v.steady) != null ? fx(n(v.steady), 1) + ' mm/h' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Test' }, fields: [
        surveyors(), when(),
        Q('test_id', 'text', 'Test ID', { ph: 'IF-01' }),
        Q('loc', 'gps', 'Position'),
        Q('zone', 'select', 'Zone', { options: ZONES }),
        Q('method', 'select', 'Method', { options: E('double:Double ring|single:Single ring') }),
        Q('d_inner', 'number', 'Inner ring diameter', { unit: 'cm' }),
        Q('readings', 'table', 'Readings (depth from rim to water)', { minRows: 8, printRows: 12, columns: [
          C('t', 'number', 'Time', { unit: 'min' }), C('rd', 'number', 'Depth to water', { unit: 'cm' }), C('refill', 'number', 'Refilled to', { unit: 'cm' }),
          C('rate', 'number', 'Rate', { computed: true, unit: 'mm/h', dp: 1 })],
          compute: infComp,
          summary: (rows, comp) => {
            const s = steady(comp);
            return [['Steady rate (mean of last 3)', s != null ? `${s.toFixed(1)} mm/h = ${(s / 3.6).toFixed(2)} µm/s` : '—'],
              ['Indicative K class (NRCS)', s != null && s > 0 ? KSAT(s / 3.6) : '—'],
              ...(comp.some((c) => c.rate != null && c.rate < 0) ? [['Check', 'Negative drop — enter depth from the rim down to the water', 'bad']] : [])];
          } }),
        Q('steady', 'computed', 'Steady infiltration rate', { unit: 'mm/h', dp: 1, compute: (v) => steady(infComp(v.readings || [])) }),
        Q('notes', 'text', 'Notes'),
      ] },
    ],
  });

  /* ---------- discharge ---------- */
  const volQ = (r, v) => { const t = n(r.t_s), vol = n(r.vol_l) ?? n(v.container_l); return t > 0 && vol != null ? vol / t : null; };
  reg({
    id: 'q', short: 'Q', icon: 'flow', geo: 'loc', target: 2, targetLabel: 'measurements',
    title: { en: 'Flow measurement' },
    summary: (v) => [v.site_id, n(v.q_adopt) != null ? fx(n(v.q_adopt)) + ' L/s' : '', TT.fmt(v.dt)].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Measurement' }, fields: [
        surveyors(), when(),
        Q('site_id', 'text', 'Feature ID', { suggest: ids('feat', 'fid') }),
        Q('stype', 'select', 'Flow type', { options: E('inflow:Inflow|outflow:Outflow / overflow|spring:Spring|seep:Seep|drain:Drain / culvert') }),
        Q('loc', 'gps', 'Position'),
        Q('method', 'select', 'Method', { options: E('vol:Bucket and stopwatch|est:Visual estimate') }),
        Q('container_l', 'number', 'Container volume', { unit: 'L', min: 0.1, max: 200, show: ['method', 'vol'] }),
        Q('trials', 'table', 'Fill times', { minRows: 3, printRows: 5, show: ['method', 'vol'], columns: [
          C('t_s', 'number', 'Time', { unit: 's', min: 0 }), C('vol_l', 'number', 'Volume if not full', { unit: 'L' }), C('q', 'number', 'Q', { computed: true, unit: 'L/s', dp: 4 })],
          compute: (rows, v) => rows.map((r) => ({ q: volQ(r, v) })) }),
        Q('q_est', 'number', 'Estimated flow', { unit: 'L/min', show: ['method', 'est'] }),
        Q('q_adopt', 'computed', 'Flow', { unit: 'L/s', dp: 4, compute: (v) => {
          if (v.method === 'vol') { const q = (v.trials || []).map((r) => volQ(r, v)).filter((x) => x != null); return q.length ? TT.mean(q) : null; }
          return v.method === 'est' && n(v.q_est) != null ? n(v.q_est) / 60 : null;
        } }),
        Q('notes', 'text', 'Notes'),
      ] },
    ],
  });

  /* ---------- hypothesis-evidence matrix ---------- */
  const SCORE = E('0:0 Absent / contradicted|1:1 Weak|2:2 Moderate|3:3 Strong');
  reg({
    id: 'hyp', short: 'HM', icon: 'target', target: 1, targetLabel: 'assessment',
    title: { en: 'Cause ranking (hypothesis matrix)' },
    summary: (v) => v.ranking || '',
    sections: [
      { id: '1', title: { en: 'Scores' }, fields: [
        Q('assessor', 'people', 'Assessed by', { default: TT.defaultTeam }),
        ...TT.HYP.flatMap((hy) => [
          Q(hy.id + '_score', 'select', `${hy.id} ${hy.en}`, { options: SCORE }),
          Q(hy.id + '_ev', 'text', `${hy.id} evidence (record IDs)`, { note: false }),
        ]),
        Q('ranking', 'computed', 'Ranking', { compute: (v) => {
          const s = TT.HYP.map((hy) => [hy.id, n(v[hy.id + '_score'])]).filter(([, x]) => x != null).sort((a, b) => b[1] - a[1]);
          return s.length ? s.map(([id, x]) => `${id} (${x})`).join(' > ') : null;
        } }),
        Q('mechanism', 'select', 'Main problem appears to be', { options: E('inflow:Too little inflow / recharge|outflow:Too much outflow / seepage|both:Both|unclear:Not yet clear') }),
        Q('next', 'textarea', 'Next steps (monitoring, seepage tests, design)'),
      ] },
    ],
  });
})();
