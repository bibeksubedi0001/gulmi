/* Timure Taal field portal: engineering survey forms (report sections 8-17).
 * Day log, benchmark/gauge, water level, levelling, features, lining, bathymetry, discharge,
 * seepage screening, seepage meter, soil samples, infiltration, water quality, catchment,
 * photo landmarks, construction history, hypothesis-evidence matrix, equipment checklist.
 */
'use strict';
(function () {
  const TT = window.TT;
  const O = TT.O;
  const E = (s) => s.split('|').map((p) => { const i = p.indexOf(':'); return { v: p.slice(0, i), en: p.slice(i + 1) }; });
  const Q = (id, type, en, x = {}) => ({ id, type, q: { en }, ...x });
  const C = (id, type, label, x = {}) => ({ id, type, label: { en: label }, ...x });
  const n = TT.num;
  const fx = (x, d = 3) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d));
  const HYP_OPTS = TT.HYP.map((h) => ({ v: h.id, en: `${h.id} ${h.en}` }));

  /* ---------- cross-record lookups ---------- */
  const same = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
  TT.marks = (ctx, kind) => (ctx.records || []).filter((r) => r.form === 'bm' && (!kind || r.data.kind === kind));
  TT.gaugeZero = (ctx, id) => {
    const r = TT.marks(ctx, 'gauge').find((x) => same(x.data.mark_id, id));
    return r ? n(r.data.zero_rl_manual) ?? n(r.data.zero_rl) : null;
  };
  TT.markRL = (ctx, id) => {
    const r = TT.marks(ctx).find((x) => same(x.data.mark_id, id));
    return r ? n(r.data.rl) ?? n(r.data.zero_rl_manual) ?? n(r.data.zero_rl) : null;
  };
  const ids = (form, key, filter) => (v, ctx) => [...new Set((ctx.records || []).filter((r) => r.form === form && r.data[key] && (!filter || filter(r))).map((r) => String(r.data[key])))];
  const gaugeIds = ids('bm', 'mark_id', (r) => r.data.kind === 'gauge');
  const markIds = ids('bm', 'mark_id');
  TT.nextSampleId = (ctx, zone) => {
    let max = 0;
    for (const r of ctx.records || []) {
      if (r.form !== 'soil' || (ctx.record && r.id === ctx.record.id)) continue;
      const m = String(r.data.sample_id || '').match(new RegExp(`^TT-${zone}(\\d+)$`));
      if (m) max = Math.max(max, +m[1]);
    }
    return `TT-${zone}${TT.pad(max + 1)}`;
  };

  const teamMeta = (x = {}) => [
    Q('surveyor', 'text', 'Surveyor / team', { default: (ctx) => [ctx.settings.enumerator, ctx.settings.team].filter(Boolean).join(' · '), ...x }),
    Q('dt', 'datetime', 'Date & time', { now: true, required: true }),
  ];
  const hypField = () => Q('hyp', 'checks', 'Evidence relevant to which hypotheses?', { options: HYP_OPTS, hint: { en: 'Tag so the hypothesis–evidence matrix can cite this record.' } });

  const reg = (f) => TT.registerForm({ group: 'engineering', version: 1, ...f });

  /* ===================== E01 Daily field log ===================== */
  const DAYS = {
    d0: E('maps:Base maps & printed catchment/orthophoto sheets ready|photos_req:Old photographs & construction records requested|ki:Key informants identified & appointments made|portal:Portal installed on every phone & opened offline once|calib:pH / EC / temperature meters calibrated|labels:Sample bags & core tubes pre-labelled|permit:Ward / municipality permission obtained|landowner:Landowner permission for sampling|drone:Drone permission (if used)|kit:Equipment checklist complete'),
    d1: E('perimeter:Walked entire lake perimeter|catchment:Walked preliminary catchment|bm:Fixed benchmark established|gauge:Staff gauge installed & levelled to benchmark|shore:Shoreline mapped|lining:Concrete edge / lining mapped|drains:Roads, culverts & drains mapped|gullies:Depressions & gullies mapped|rponds:Recharge ponds mapped|flows:Visible inflows / outflows mapped|seeps:Springs, cracks, wet spots mapped|geophotos:Geotagged photos taken|wl:Lake level read morning & evening'),
    d2: E('wsl:Shoreline & water-surface elevation surveyed|transects:Depth transects laid out|sound:Depth + GPS points collected|qa:QA repeat points / line done|hwm:Exposed former bed & high-water marks measured|wl:Lake level read morning & evening'),
    d3: E('trace:Runoff paths traced ridge → lake|roaddrain:Road-drain interception inspected|soil:Representative soil samples collected|infil:Infiltration tests on dry soil|joints:Lining joints & edges inspected|downslope:Downslope wet zones / springs searched|q:Visible flows measured|wl:Lake level read morning & evening'),
    d4: E('hh:Household interviews|kii:Key-informant interviews|history:Construction-history interviews|oldphotos:Old photos collected / scanned|markers:Dated shoreline markers identified|wl:Lake level read morning & evening'),
    d5: E('repeat_level:Lake level / depth reference repeated|revisit:Uncertain flow paths revisited (after rain if any)|repeat_meas:Suspect measurements repeated|gaps:Missing interviews / samples completed|samplelog:Sample log & chain of custody checked|inventory:Photo / GPS inventory checked|export:All phones exported & backed up|wl:Lake level read morning & evening'),
  };
  reg({
    id: 'day', short: 'DAY', icon: 'calendar', phase: 'setup', target: 6, targetLabel: 'days',
    title: { en: 'Daily field log' },
    purpose: { en: 'One record per field day: team, weather, rainfall and the day’s programme from the 4–5 day field plan (report section 8).' },
    summary: (v) => [v.day ? TT.optLabel(TT.FORMS.day.fieldMap.day, v.day) : '', v.date].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Day' }, fields: [
        Q('date', 'date', 'Date', { now: true, required: true }),
        Q('day', 'radio', 'Programme day', { required: true, options: E('d0:Day 0 — preparation|d1:Day 1 — reconnaissance & control survey|d2:Day 2 — lake geometry & bathymetry|d3:Day 3 — hydrology, soils & seepage|d4:Day 4 — community survey & construction history|d5:Day 5 — repeat / close gaps|x:Extra day') }),
        Q('team', 'text', 'Team present', { default: (ctx) => ctx.settings.team || '' }),
        Q('t_start', 'time', 'Start time'), Q('t_end', 'time', 'End time'),
      ] },
      { id: '2', title: { en: 'Weather' }, fields: [
        Q('wx_am', 'radio', 'Weather — morning', { options: O.weather }),
        Q('wx_pm', 'radio', 'Weather — afternoon', { options: O.weather }),
        Q('rain_24h', 'radio', 'Rain in the last 24 h', { options: O.rainSince }),
        Q('rain_mm', 'number', 'Rain gauge reading (if installed)', { unit: 'mm', min: 0, max: 300 }),
        Q('temp', 'number', 'Air temperature (midday)', { unit: '°C', min: -10, max: 40 }),
      ] },
      { id: '3', title: { en: 'Programme tasks' }, fields: [
        ...Object.entries(DAYS).map(([d, opts]) => Q('tasks_' + d, 'checks', 'Tasks completed', { options: opts, show: ['day', d] })),
        Q('tasks_x', 'textarea', 'Tasks completed', { show: ['day', 'x'] }),
      ] },
      { id: '4', title: { en: 'Summary' }, fields: [
        Q('findings', 'textarea', 'Key observations / findings today'),
        Q('problems', 'textarea', 'Problems, hazards, deviations from plan'),
        Q('tomorrow', 'textarea', 'Plan for tomorrow'),
        Q('backup', 'yn', 'All phones exported / backed up today?', { dk: false }),
        Q('photos', 'photos', 'Photos (team, conditions)'),
      ] },
    ],
  });

  /* ===================== E02 Benchmark & staff gauge ===================== */
  reg({
    id: 'bm', short: 'BM', icon: 'crosshair', phase: 'setup', geo: 'loc', target: 2, targetLabel: 'marks',
    title: { en: 'Benchmark & staff gauge' },
    purpose: { en: 'Fixed benchmark and staff-gauge reference so every lake-level, depth and shoreline reading refers to one stable datum (report 8, 11.2).' },
    summary: (v) => [v.mark_id, v.kind && TT.optLabel(TT.FORMS.bm.fieldMap.kind, v.kind), v.rl != null ? 'RL ' + v.rl : v.zero_rl != null ? 'zero RL ' + v.zero_rl : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Mark' }, fields: [
        Q('kind', 'radio', 'Type', { required: true, options: E('bm:Permanent benchmark (BM)|tbm:Temporary benchmark (TBM)|gauge:Staff gauge|pin:Reference pin / peg') }),
        Q('mark_id', 'text', 'Mark ID', { required: true, ph: 'BM-1, TBM-2, SG-1', hint: { en: 'Use SG-1, SG-2 … for staff gauges; water-level readings look the gauge up by this ID.' } }),
        Q('desc', 'textarea', 'Description: what it is set on and how to find it', { hint: { en: 'e.g. steel rod in concrete on bedrock outcrop 4 m east of the steps' } }),
        Q('stability', 'radio', 'Stability', { options: E('rock:Very stable (bedrock / massive concrete)|stable:Stable|doubtful:Doubtful (soil / fill / near water)') }),
        Q('loc', 'gps', 'Position (averaged)', { average: true, required: true }),
        Q('photos', 'photos', 'Photos (close-up and context)', { required: true }),
        Q('installed', 'datetime', 'Installed / established', { now: true }),
      ] },
      { id: '2', title: { en: 'Elevation of benchmark' }, show: ['kind', ['bm', 'tbm', 'pin']], fields: [
        Q('datum', 'radio', 'Height datum', { options: E('local:Assumed local datum (e.g. 100.000 m)|gnss:GNSS height|dem:DEM-derived (indicative only)|transfer:Transferred by levelling from another mark') }),
        Q('rl', 'number', 'Adopted RL of this mark', { unit: 'm', dp: 3 }),
        Q('rl_note', 'text', 'How the RL was obtained (line ID, source)'),
      ] },
      { id: '3', title: { en: 'Staff gauge zero' }, show: ['kind', 'gauge'], fields: [
        Q('gauge_type', 'radio', 'Gauge type', { options: E('staff:Fixed graduated staff|painted:Painted scale on concrete / rock|pole:Temporary graduated pole') }),
        Q('gauge_range', 'number', 'Readable range of the gauge', { unit: 'm' }),
        Q('bm_ref', 'text', 'Reference benchmark ID', { suggest: markIds }),
        Q('bm_rl_found', 'computed', 'RL of reference benchmark (from its record)', { unit: 'm', compute: (v, ctx) => TT.markRL(ctx, v.bm_ref), empty: 'not found — create the benchmark record first or type RL below' }),
        Q('bm_rl', 'number', 'RL of reference benchmark (manual, if not found)', { unit: 'm' }),
        Q('bs_bm', 'number', 'Backsight on benchmark', { unit: 'm', min: 0, max: 5 }),
        Q('fs_zero', 'number', 'Foresight on gauge zero (0.000 graduation)', { unit: 'm', min: 0, max: 5 }),
        Q('zero_rl', 'computed', 'Gauge-zero RL = BM RL + BS − FS', { unit: 'm', compute: (v, ctx) => {
          const b = TT.markRL(ctx, v.bm_ref) ?? n(v.bm_rl);
          return b != null && n(v.bs_bm) != null && n(v.fs_zero) != null ? b + n(v.bs_bm) - n(v.fs_zero) : null; } }),
        Q('zero_rl_manual', 'number', 'Gauge-zero RL by another method (overrides the value above)', { unit: 'm' }),
      ] },
      { id: '4', title: { en: 'Witness marks (for recovery)' }, fields: [
        Q('witness', 'table', 'Distances to permanent objects', { minRows: 3, printRows: 4, columns: [
          C('object', 'text', 'Object'), C('dist', 'number', 'Distance', { unit: 'm' }), C('brg', 'number', 'Bearing', { unit: '°', min: 0, max: 360 }), C('note', 'text', 'Note')] }),
        Q('notes', 'textarea', 'Notes'),
      ] },
    ],
  });

  /* ===================== E03 Water-level reading ===================== */
  reg({
    id: 'wl', short: 'WL', icon: 'wave', phase: 'level', target: 10, targetLabel: 'readings',
    title: { en: 'Lake water-level reading' },
    purpose: { en: 'Staff-gauge reading at the same times each day and after rain (report 11.2). The dashboard plots the series and screens recession against evaporation.' },
    summary: (v) => [v.gauge, n(v.reading) != null ? fx(n(v.reading)) + ' m' : '', TT.fmt(v.dt)].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Reading' }, fields: [
        Q('gauge', 'text', 'Gauge ID', { required: true, suggest: gaugeIds, ph: 'SG-1' }),
        Q('dt', 'datetime', 'Date & time of reading', { now: true, required: true }),
        Q('reading', 'number', 'Staff reading', { unit: 'm', required: true, min: -1, max: 10, hint: { en: 'Read at eye level. With ripples, read the mean of crest and trough.' } }),
        Q('zero', 'computed', 'Gauge-zero RL (from benchmark record)', { unit: 'm', compute: (v, ctx) => TT.gaugeZero(ctx, v.gauge), empty: 'unknown — level the gauge in the Benchmark form' }),
        Q('wsl', 'computed', 'Water-surface level (RL)', { unit: 'm', compute: (v, ctx) => { const z = TT.gaugeZero(ctx, v.gauge); return z != null && n(v.reading) != null ? z + n(v.reading) : null; } }),
      ] },
      { id: '2', title: { en: 'Conditions' }, fields: [
        Q('wx', 'radio', 'Weather now', { options: O.weather }),
        Q('rain_since', 'radio', 'Rain since the previous reading', { options: O.rainSince }),
        Q('rain_mm', 'number', 'Rain since previous reading (gauge)', { unit: 'mm', min: 0, max: 300 }),
        Q('wind', 'radio', 'Water surface', { options: E('calm:Calm|ripples:Ripples|waves:Waves') }),
        Q('inflow', 'radio', 'Visible inflow now', { options: O.flowState }),
        Q('outflow', 'radio', 'Visible outflow / overflow now', { options: O.flowState }),
        Q('withdrawal', 'yn', 'Pumping or withdrawal seen since the previous reading?'),
        Q('quality', 'radio', 'Reading quality', { options: O.quality }),
        Q('observer', 'text', 'Observer', { default: (ctx) => ctx.settings.enumerator || '' }),
        Q('photo', 'photos', 'Photo of the staff showing the reading'),
        Q('remarks', 'textarea', 'Remarks'),
      ] },
    ],
  });

  /* ===================== E04 Levelling field book ===================== */
  reg({
    id: 'lev', short: 'LEV', icon: 'level', phase: 'level', target: 3, targetLabel: 'lines',
    title: { en: 'Levelling field book (height-of-instrument)' },
    purpose: { en: 'Transfer heights from the benchmark to the gauge, water surface, high-water marks, lining crest and outside ground (report 8, 12). Computes HI, RL, arithmetic check and closure.' },
    summary: (v) => [v.line_id, v.start_bm && 'from ' + v.start_bm].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Line' }, fields: [
        ...teamMeta(),
        Q('line_id', 'text', 'Line ID', { required: true, ph: 'LV-01' }),
        Q('purpose', 'checks', 'Purpose', { other: true, options: E('bm:Benchmark / gauge transfer|wsl:Water-surface elevation|hwm:Shoreline & high-water marks|crest:Lining crest vs outside ground|section:Cross-section / profile|other:Other') }),
        Q('instrument', 'radio', 'Instrument', { options: E('auto:Automatic level|laser:Laser level|digital:Digital level|ts:Total station|hand:Hand level / Abney|gnss:GNSS') }),
        Q('start_bm', 'text', 'Starting benchmark ID', { suggest: markIds }),
        Q('start_rl', 'number', 'RL of starting benchmark', { unit: 'm', required: true }),
        Q('close_bm', 'text', 'Closing benchmark ID (if the line closes)', { suggest: markIds }),
        Q('close_rl', 'number', 'Known RL of closing benchmark', { unit: 'm' }),
      ] },
      { id: '2', title: { en: 'Readings' }, intro: { en: 'Row 1 = backsight on the starting benchmark. Change points carry both FS and BS on the same row. Intermediate sights in IS.' }, fields: [
        Q('rows', 'table', 'Field book', { minRows: 6, printRows: 18, columns: [
          C('pt', 'text', 'Station / point'), C('bs', 'number', 'BS', { unit: 'm' }), C('is', 'number', 'IS', { unit: 'm' }), C('fs', 'number', 'FS', { unit: 'm' }),
          C('hi', 'number', 'HI', { computed: true, unit: 'm' }), C('rl', 'number', 'RL', { computed: true, unit: 'm' }),
          C('dist', 'number', 'Dist.', { unit: 'm' }), C('rem', 'text', 'Remarks (what the point is)')],
          compute: (rows, v) => {
            let hi = null;
            const start = n(v.start_rl);
            return rows.map((r, i) => {
              const bs = n(r.bs), is = n(r.is), fs = n(r.fs);
              let rl = null, hiShow = null;
              if (i === 0) {
                rl = start;
                if (rl != null && bs != null) { hi = rl + bs; hiShow = hi; }
              } else if (hi != null) {
                if (fs != null) { rl = hi - fs; if (bs != null) { hi = rl + bs; hiShow = hi; } }
                else if (is != null) rl = hi - is;
              }
              return { hi: hiShow, rl };
            });
          },
          summary: (rows, comp, v) => {
            const sb = rows.reduce((s, r) => s + (n(r.bs) || 0), 0);
            const sf = rows.reduce((s, r) => s + (n(r.fs) || 0), 0);
            const out = [['ΣBS', fx(sb)], ['ΣFS', fx(sf)], ['ΣBS − ΣFS', fx(sb - sf)]];
            let last = -1;
            rows.forEach((r, i) => { if (n(r.fs) != null && comp[i] && comp[i].rl != null) last = i; });
            const first = n(v.start_rl);
            if (last < 0 || first == null) return out;
            const lastRl = comp[last].rl;
            const ok = Math.abs(sb - sf - (lastRl - first)) < 0.0005;
            out.push(['Last RL − first RL', fx(lastRl - first)], ['Arithmetic check', ok ? 'OK' : 'Mismatch — check entries', ok ? 'ok' : 'bad']);
            const close = n(v.close_rl);
            if (close != null) {
              const mis = (lastRl - close) * 1000;
              const K = rows.reduce((s, r) => s + (n(r.dist) || 0), 0) / 1000;
              out.push(['Closing error', `${mis.toFixed(1)} mm`]);
              if (K > 0) {
                const allow = 12 * Math.sqrt(K);
                out.push([`Allowable ±12√K (K = ${K.toFixed(3)} km)`, `±${allow.toFixed(1)} mm`, Math.abs(mis) <= allow ? 'ok' : 'bad']);
              }
            }
            return out;
          } }),
      ] },
      { id: '3', title: { en: 'Notes' }, fields: [Q('notes', 'textarea', 'Notes'), Q('photos', 'photos', 'Photos / sketch')] },
    ],
  });

  /* ===================== E05 Perimeter & drainage feature ===================== */
  const FT = E('shore:Shoreline (current water edge)|hwm:High-water mark / old shoreline|lining:Concrete edge / lining section|crack:Crack or open joint|inflow:Surface inflow / gully / swale|roaddrain:Roadside drain|culvert:Culvert|outlet:Possible outlet / overflow|regdrain:Regulated drain / pipe / gate|rpond:Recharge pond|spring:Spring / seep / wet patch|erosion:Erosion / sediment fan|landuse:Land-use change|depression:Depression / sinkhole|bund:Bund / berm / fill|trench:Trench / conservation structure|ridge:Ridge / divide point|photo:Photo landmark|other:Other');
  const FT_PREFIX = { shore: 'SH', hwm: 'HW', lining: 'LN', crack: 'CR', inflow: 'IN', roaddrain: 'RD', culvert: 'CV', outlet: 'OF', regdrain: 'RG', rpond: 'RP', spring: 'SP', erosion: 'ER', landuse: 'LU', depression: 'DP', bund: 'BD', trench: 'TR', ridge: 'RI', photo: 'PL', other: 'OT' };
  const DIM_TYPES = ['inflow', 'roaddrain', 'culvert', 'outlet', 'regdrain', 'rpond', 'erosion', 'depression', 'bund', 'trench', 'crack', 'lining'];
  reg({
    id: 'feat', short: 'FT', icon: 'pin', phase: 'drain', geo: 'loc', target: 25, targetLabel: 'features',
    title: { en: 'Perimeter & drainage feature' },
    purpose: { en: 'One record per mapped feature on the perimeter and in the catchment (report 15.1): shoreline, lining, cracks, inflows, drains, culverts, outlets, ponds, springs, erosion, land-use change.' },
    summary: (v) => [v.fid, v.ftype && TT.optLabel(TT.FORMS.feat.fieldMap.ftype, v.ftype), v.delivers && 'to lake: ' + v.delivers].filter(Boolean).join(' · '),
    onChange: (fid, v, ctx, api) => {
      if (fid !== 'ftype' || !v.ftype) return;
      if (v.fid && !/^[A-Z]{2}-\d+$/.test(v.fid)) return;
      const p = FT_PREFIX[v.ftype];
      if (v.fid && v.fid.startsWith(p + '-')) return;
      let max = 0;
      (ctx.records || []).forEach((r) => {
        if (r.form !== 'feat' || r.id === ctx.record.id) return;
        const m = String(r.data.fid || '').match(new RegExp(`^${p}-(\\d+)$`));
        if (m) max = Math.max(max, +m[1]);
      });
      api.setValue('fid', `${p}-${TT.pad(max + 1)}`);
    },
    sections: [
      { id: '1', title: { en: 'Feature' }, fields: [
        ...teamMeta(),
        Q('ftype', 'select', 'Feature type', { required: true, options: FT }),
        Q('fid', 'text', 'Feature ID (auto-suggested)', { required: true, ph: 'IN-01' }),
        Q('loc', 'gps', 'Position', { required: true }),
        Q('photos', 'photos', 'Photos', { required: true, hint: { en: 'Include a scale (pole, hammer) and the direction of view in the caption.' } }),
        Q('desc', 'textarea', 'Description'),
      ] },
      { id: '2', title: { en: 'Hydraulic role' }, fields: [
        Q('rel', 'radio', 'Position relative to the lake', { options: O.relLake }),
        Q('dist_edge', 'number', 'Distance from current water edge', { unit: 'm', min: 0, max: 2000 }),
        Q('flow_dir', 'select', 'Water flows towards', { options: O.dirDk }),
        Q('delivers', 'radio', 'Does water from here reach the lake?', { options: E('yes:Yes|partly:Partly|diverted:No — diverted away|blocked:No — blocked|unknown:Unknown') }),
        Q('flow_now', 'radio', 'Flow now', { options: O.flowState }),
        Q('material', 'radio', 'Material', { other: true, options: E('earth:Earth / soil|stone:Stone / rock|concrete:Concrete|masonry:Masonry|pipe:Pipe (PVC / HDPE)|veg:Vegetated|other:Other') }),
        Q('condition', 'radio', 'Condition', { options: O.quality }),
        Q('vs_crest', 'radio', 'Level relative to the lining crest', { options: E('above:Above crest|level:Level with crest|below:Below crest|na:Not applicable') }),
        Q('vs_crest_m', 'number', 'Height difference (+ above / − below)', { unit: 'm', min: -10, max: 10, show: ['vs_crest', ['above', 'below']] }),
      ] },
      { id: '3', title: { en: 'Dimensions & type-specific details' }, fields: [
        Q('width', 'number', 'Width', { unit: 'm', show: ['ftype', DIM_TYPES] }),
        Q('depth', 'number', 'Depth', { unit: 'm', show: ['ftype', DIM_TYPES] }),
        Q('length', 'number', 'Length', { unit: 'm', show: ['ftype', DIM_TYPES] }),
        Q('cv_size', 'text', 'Culvert size (diameter or W × H)', { show: ['ftype', 'culvert'] }),
        Q('cv_out', 'select', 'Culvert discharges towards', { options: O.dirDk, show: ['ftype', 'culvert'] }),
        Q('cv_to_lake', 'yn', 'Culvert outlet drains towards the lake?', { show: ['ftype', 'culvert'] }),
        Q('cr_width', 'number', 'Crack width (max)', { unit: 'mm', show: ['ftype', 'crack'] }),
        Q('cr_orient', 'text', 'Orientation (e.g. parallel to edge, diagonal)', { show: ['ftype', 'crack'] }),
        Q('cr_wet', 'radio', 'Crack moisture', { options: E('dry:Dry|damp:Damp|seeping:Seeping|flowing:Flowing'), show: ['ftype', 'crack'] }),
        Q('cr_stain', 'yn', 'Staining / efflorescence along crack', { show: ['ftype', 'crack'] }),
        Q('rp_size', 'text', 'Pond size L × W × D (m)', { show: ['ftype', 'rpond'] }),
        Q('rp_conn', 'radio', 'Pond overflow goes', { options: E('lake:Towards the lake|away:Away from the lake|none:No outlet|unknown:Unknown'), show: ['ftype', 'rpond'] }),
        Q('rp_year', 'bsyear', 'Year built', { show: ['ftype', 'rpond'] }),
        Q('hwm_height', 'number', 'Height above current water level', { unit: 'm', show: ['ftype', 'hwm'] }),
        Q('hwm_evidence', 'radio', 'Evidence for the mark', { options: E('stain:Stain line|veg:Vegetation line|debris:Debris line|notch:Erosion notch|community:Shown by community|photo:Matches old photo'), show: ['ftype', 'hwm'] }),
        Q('out_invert', 'number', 'Outlet invert above current water level', { unit: 'm', show: ['ftype', ['outlet', 'regdrain']] }),
        Q('out_status', 'radio', 'Outlet status', { options: E('open:Open|blocked:Blocked|closed:Closed deliberately|damaged:Damaged|unknown:Unknown'), show: ['ftype', ['outlet', 'regdrain']] }),
        Q('er_type', 'radio', 'Erosion type', { options: E('rill:Rill|gully:Gully|sheet:Sheet|fan:Sediment fan|bank:Bank collapse'), show: ['ftype', 'erosion'] }),
      ] },
      { id: '4', title: { en: 'Interpretation' }, fields: [hypField(), Q('notes', 'textarea', 'Notes / interpretation')] },
    ],
  });

  /* ===================== E06 Lining & edge-works inspection ===================== */
  reg({
    id: 'lin', short: 'LN', icon: 'wall', phase: 'drain', geo: 'start_pt', target: 8, targetLabel: 'segments',
    title: { en: 'Concrete lining & edge-works inspection' },
    purpose: { en: 'Segment-by-segment inspection of the lining (report 12): extent, geometry, outside ground vs crest, weep holes, cracks and whether the lining blocks former inflow paths. Do not core or puncture the lining.' },
    summary: (v) => [v.seg_id, v.ch_from != null && v.ch_to != null ? `ch ${v.ch_from}–${v.ch_to} m` : '', v.rating && 'rating ' + v.rating].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Segment' }, fields: [
        ...teamMeta(),
        Q('seg_id', 'text', 'Segment ID', { required: true, ph: 'L-01' }),
        Q('ch_from', 'number', 'Chainage from (clockwise from BM-1 / steps)', { unit: 'm' }),
        Q('ch_to', 'number', 'Chainage to', { unit: 'm' }),
        Q('start_pt', 'gps', 'Segment start', { required: true }),
        Q('end_pt', 'gps', 'Segment end'),
        Q('element', 'checks', 'Element', { other: true, options: E('wall:Perimeter wall|slope:Bank slope lining|bed:Lake bed|steps:Steps / ghat|walkway:Walkway|spill:Spillway / outlet|other:Other') }),
        Q('material', 'radio', 'Material', { options: E('pcc:Plain concrete (PCC)|rcc:Reinforced concrete (RCC)|stone:Stone masonry|brick:Brick|gabion:Gabion|clay:Clay / earthen|geomem:Geomembrane|unknown:Unknown') }),
        Q('year', 'bsyear', 'Year built (if known)'),
      ] },
      { id: '2', title: { en: 'Geometry & interaction with inflow' }, fields: [
        Q('crest_w', 'number', 'Crest width', { unit: 'm' }),
        Q('crest_h', 'number', 'Crest height above current water', { unit: 'm' }),
        Q('thick', 'number', 'Thickness (where visible)', { unit: 'm' }),
        Q('outside', 'radio', 'Outside ground relative to crest', { options: E('higher:Outside ground higher than crest|level:About level|lower:Outside ground lower than crest') }),
        Q('outside_m', 'number', 'Difference (outside − crest)', { unit: 'm', min: -5, max: 5 }),
        Q('can_cross', 'radio', 'Can outside surface water physically cross into the lake here?', { options: E('free:Yes — enters freely|overtop:Only by overtopping the crest|blocked:No — blocked|unknown:Unknown') }),
        Q('ponding', 'yn', 'Water or wet soil ponding against the outside of the lining?', { hint: { en: 'Key evidence for H2 (lining intercepting inflow).' } }),
        Q('swale_cut', 'yn', 'Does this segment cut across a former swale / inflow path?'),
        Q('weep', 'radio', 'Weep holes / vents', { options: E('ok:Present and functional|blocked:Present but blocked|absent:Absent|unknown:Unknown') }),
        Q('weep_n', 'integer', 'Number of weep holes', { show: ['weep', ['ok', 'blocked']] }),
      ] },
      { id: '3', title: { en: 'Defects' }, fields: [
        Q('cracks_n', 'integer', 'Number of cracks', { min: 0 }),
        Q('crack_w', 'number', 'Maximum crack width', { unit: 'mm' }),
        Q('crack_len', 'number', 'Total crack length', { unit: 'm' }),
        Q('defects', 'checks', 'Other defects', { options: E('joint:Open joints|settle:Settlement|sep:Separation from natural ground|honey:Honeycombing|scour:Scour / undermining at toe|stain:Leakage staining / efflorescence|veg:Vegetation in joints|none:None') }),
        Q('sep_gap', 'number', 'Separation gap', { unit: 'mm', show: ['defects', 'sep'] }),
        Q('through', 'radio', 'Water passing through the lining', { options: E('none:None|damp:Damp patches|drip:Dripping|flow:Flowing') }),
        Q('rating', 'radio', 'Overall condition', { options: O.cond5 }),
      ] },
      { id: '4', title: { en: 'Record' }, fields: [Q('photos', 'photos', 'Photos', { required: true }), hypField(), Q('notes', 'textarea', 'Notes')] },
    ],
  });

  /* ===================== E07 Bathymetry transect ===================== */
  reg({
    id: 'bath', short: 'BT', icon: 'anchor', phase: 'level', geo: 'start_pt', target: 12, targetLabel: 'transects',
    title: { en: 'Bathymetry transect (depth log)' },
    purpose: { en: 'Depth + position along planned transects 5–10 m apart, a sounding every 3–5 m or at breaks of bed shape, with QA repeats (report 11.1, 15.2). Gauge readings at start/end reduce depths to bed RL.' },
    summary: (v) => [v.tr_id, Array.isArray(v.soundings) ? v.soundings.filter((r) => r.depth != null).length + ' pts' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Transect' }, fields: [
        ...teamMeta(),
        Q('tr_id', 'text', 'Transect ID', { required: true, ph: 'T-01' }),
        Q('orient', 'radio', 'Orientation', { options: E('trans:Transverse|long:Longitudinal|diag:Diagonal|radial:Radial') }),
        Q('bearing', 'number', 'Bearing', { unit: '°', min: 0, max: 360 }),
        Q('method', 'radio', 'Sounding method', { options: E('line:Weighted sounding line|pole:Graduated pole / staff|echo:Echo sounder|wade:Wading with staff') }),
        Q('craft', 'radio', 'Access', { options: E('wade:Wading|boat:Boat / raft|shore:From shore') }),
        Q('gauge', 'text', 'Gauge ID', { suggest: gaugeIds }),
        Q('g_start', 'number', 'Gauge reading at start', { unit: 'm' }),
        Q('g_end', 'number', 'Gauge reading at end', { unit: 'm' }),
        Q('wsl', 'computed', 'Mean water-surface RL during transect', { unit: 'm', compute: (v, ctx) => {
          const z = TT.gaugeZero(ctx, v.gauge), a = n(v.g_start), b = n(v.g_end);
          const g = a != null && b != null ? (a + b) / 2 : a ?? b;
          return z != null && g != null ? z + g : null; }, empty: 'needs gauge ID with levelled zero + reading' }),
        Q('start_pt', 'gps', 'Transect start (shore)'),
        Q('end_pt', 'gps', 'Transect end (shore)'),
      ] },
      { id: '2', title: { en: 'Soundings' }, intro: { en: 'Probe until it stops: note soft-sediment penetration separately from the firm-bed depth. Tick QA for deliberate repeats.' }, fields: [
        Q('soundings', 'table', 'Depth log', { minRows: 8, printRows: 20, carry: ['bed'], autoInc: 'chain', autoStep: 3, columns: [
          C('chain', 'number', 'Dist. from start', { unit: 'm' }), C('depth', 'number', 'Depth', { unit: 'm', min: 0, max: 30 }),
          C('bed', 'select', 'Bed', { options: E('soft:Soft mud / silt|sand:Sand / gravel|clay:Firm clay|rock:Rock|concrete:Concrete|veg:Vegetation / organic') }),
          C('soft', 'number', 'Soft-sediment penetration', { unit: 'm' }), C('qa', 'check', 'QA'), C('gps', 'gps', 'GPS'),
          C('bedrl', 'number', 'Bed RL', { computed: true, unit: 'm' }), C('note', 'text', 'Note')],
          compute: (rows, v) => rows.map((r) => ({ bedrl: n(v.wsl) != null && n(r.depth) != null ? n(v.wsl) - n(r.depth) : null })),
          summary: (rows, comp, v) => {
            const d = rows.map((r) => n(r.depth)).filter((x) => x != null);
            const len = v.start_pt && v.end_pt && Number.isFinite(v.start_pt.lat) && Number.isFinite(v.end_pt.lat) ? TT.distM(v.start_pt, v.end_pt) : null;
            return [['Soundings', String(d.length)], ['Max depth', d.length ? Math.max(...d).toFixed(2) + ' m' : '—'], ['Mean depth', d.length ? TT.mean(d).toFixed(2) + ' m' : '—'],
              ['QA repeats', String(rows.filter((r) => r.qa).length)], ['With GPS', String(rows.filter((r) => r.gps).length)], ['Transect length (GPS)', len ? len.toFixed(1) + ' m' : '—']];
          } }),
      ] },
      { id: '3', title: { en: 'Observations' }, fields: [Q('obs', 'textarea', 'Observations (sediment, vegetation, exposed bed, benches)'), Q('photos', 'photos', 'Photos')] },
    ],
  });

  /* ===================== E08 Discharge measurement ===================== */
  const volQ = (r, v) => { const t = n(r.t_s), vol = n(r.vol_l) ?? n(v.container_l); return t > 0 && vol != null ? vol / t : null; };
  const floatParts = (v) => {
    const d = (v.depths || []).map((r) => n(r.depth)).filter((x) => x != null);
    const tt = (v.times || []).map((r) => n(r.t_s)).filter((x) => x > 0);
    const area = n(v.width) != null && d.length ? n(v.width) * TT.mean(d) : null;
    const vs = n(v.reach) > 0 && tt.length ? n(v.reach) / TT.mean(tt) : null;
    const k = n(v.k) ?? 0.85;
    return { area, vs, q: area != null && vs != null ? k * vs * area * 1000 : null };
  };
  reg({
    id: 'q', short: 'Q', icon: 'flow', phase: 'water', geo: 'loc', target: 4, targetLabel: 'measurements',
    title: { en: 'Inflow / outflow discharge' },
    purpose: { en: 'Small-flow measurement: volumetric (bucket & stopwatch) or float area–velocity where safe (report 8.1, 10.1). Repeat rather than measure once.' },
    summary: (v) => [v.site_id, n(v.q_adopt) != null ? fx(n(v.q_adopt)) + ' L/s' : '', TT.fmt(v.dt)].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Site' }, fields: [
        ...teamMeta(),
        Q('site_id', 'text', 'Site / feature ID', { suggest: ids('feat', 'fid') }),
        Q('stype', 'radio', 'Flow type', { options: E('inflow:Inflow|outflow:Outflow / overflow|spring:Spring|seep:Seep|drain:Drain / culvert|pipe:Pipe') }),
        Q('loc', 'gps', 'Position'),
        Q('since_rain', 'text', 'Time since last rain'),
        Q('method', 'radio', 'Method', { required: true, options: E('vol:Volumetric (container & stopwatch)|float:Float (area–velocity)|est:Visual estimate') }),
      ] },
      { id: '2', title: { en: 'Volumetric' }, show: ['method', 'vol'], fields: [
        Q('container_l', 'number', 'Container volume', { unit: 'L', min: 0.1, max: 200 }),
        Q('trials', 'table', 'Fill trials', { minRows: 5, printRows: 6, columns: [
          C('t_s', 'number', 'Time', { unit: 's', min: 0 }), C('vol_l', 'number', 'Volume (if not full container)', { unit: 'L' }), C('q', 'number', 'Q', { computed: true, unit: 'L/s', dp: 4 })],
          compute: (rows, v) => rows.map((r) => ({ q: volQ(r, v) })),
          summary: (rows, comp) => {
            const q = comp.map((c) => c.q).filter((x) => x != null);
            const m = TT.mean(q), s = TT.sd(q);
            return [['Trials', String(q.length)], ['Mean Q', m != null ? m.toFixed(4) + ' L/s' : '—'], ['= ', m != null ? (m * 60).toFixed(2) + ' L/min · ' + (m * 86.4).toFixed(2) + ' m³/day' : '—'],
              ['CV', m && s != null ? ((100 * s) / m).toFixed(1) + ' %' : '—', m && s != null && s / m > 0.15 ? 'warn' : '']];
          } }),
      ] },
      { id: '3', title: { en: 'Float (area–velocity)' }, show: ['method', 'float'], note: { en: 'Only where safe and the channel is reasonably uniform over the reach.' }, fields: [
        Q('reach', 'number', 'Reach length', { unit: 'm', min: 0.5, max: 50 }),
        Q('width', 'number', 'Mean water width', { unit: 'm' }),
        Q('depths', 'table', 'Depths across the section', { minRows: 5, printRows: 6, columns: [C('offset', 'number', 'Offset', { unit: 'm' }), C('depth', 'number', 'Depth', { unit: 'm' })] }),
        Q('times', 'table', 'Float travel times', { minRows: 3, printRows: 5, columns: [C('t_s', 'number', 'Time', { unit: 's' })] }),
        Q('k', 'number', 'Surface-to-mean velocity coefficient', { default: 0.85, min: 0.5, max: 1 }),
        Q('f_area', 'computed', 'Flow area', { unit: 'm²', compute: (v) => floatParts(v).area }),
        Q('f_vs', 'computed', 'Surface velocity', { unit: 'm/s', compute: (v) => floatParts(v).vs }),
        Q('f_q', 'computed', 'Discharge', { unit: 'L/s', compute: (v) => floatParts(v).q }),
      ] },
      { id: '4', title: { en: 'Visual estimate' }, show: ['method', 'est'], fields: [
        Q('q_est', 'number', 'Estimated discharge', { unit: 'L/min' }), Q('est_basis', 'text', 'Basis of estimate')] },
      { id: '5', title: { en: 'Result & water' }, fields: [
        Q('q_adopt', 'computed', 'Adopted discharge', { unit: 'L/s', dp: 4, compute: (v) => {
          if (v.method === 'vol') { const q = (v.trials || []).map((r) => volQ(r, v)).filter((x) => x != null); return q.length ? TT.mean(q) : null; }
          if (v.method === 'float') return floatParts(v).q;
          if (v.method === 'est') return n(v.q_est) != null ? n(v.q_est) / 60 : null;
          return null; } }),
        Q('temp', 'number', 'Water temperature', { unit: '°C' }),
        Q('ec', 'number', 'EC', { unit: 'µS/cm' }),
        Q('turb', 'radio', 'Turbidity (visual)', { options: E('clear:Clear|slight:Slightly turbid|turbid:Turbid|muddy:Muddy') }),
        Q('photos', 'photos', 'Photos'), Q('notes', 'textarea', 'Notes'),
      ] },
    ],
  });

  /* ===================== E09 Seepage & wet-zone screening ===================== */
  const diff = (a, b) => (n(a) != null && n(b) != null ? n(a) - n(b) : null);
  reg({
    id: 'seep', short: 'SP', icon: 'drop', phase: 'soil', geo: 'loc', target: 6, targetLabel: 'sites',
    title: { en: 'Seepage & wet-zone screening' },
    purpose: { en: 'Walk the downstream / southern / eastern slopes; record wet patches, seeps, springs, lush strips, iron staining, piping (report 10.1). Compare temperature/EC with lake water measured at the same time.' },
    summary: (v) => [v.sp_id, Array.isArray(v.stype) ? v.stype.join(', ') : '', v.flow].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Location' }, fields: [
        ...teamMeta(),
        Q('sp_id', 'text', 'Site ID', { required: true, ph: 'SP-01' }),
        Q('loc', 'gps', 'Position', { required: true }),
        Q('rel_level', 'radio', 'Elevation relative to lake water surface', { options: E('below:Below lake water level|same:About the same|above:Above lake water level|unknown:Unknown') }),
        Q('rel_m', 'number', 'Approx. vertical difference (− below lake)', { unit: 'm', min: -300, max: 100 }),
        Q('stype', 'checks', 'What is observed', { other: true, options: E('wet:Wet patch|seep:Seep (oozing)|spring:Spring (flowing)|soft:Soft / boggy ground|lush:Lush / greener strip|iron:Iron staining (orange)|pipe:Piping hole / tunnel|crust:Salt / efflorescence crust|other:Other') }),
        Q('area', 'number', 'Wet area', { unit: 'm²' }),
        Q('flow', 'radio', 'Flow', { options: O.flowState }),
        Q('q_lmin', 'number', 'Flow (measured or estimated)', { unit: 'L/min' }),
        Q('persistence', 'radio', 'Persistence', { options: E('perm:Permanent (locals)|seasonal:Seasonal|rain:After rain only|new:New since a known date|unknown:Unknown') }),
        Q('since', 'bsyear', 'Appeared since (if known)'),
      ] },
      { id: '2', title: { en: 'Screening chemistry (same time as lake)' }, note: { en: 'Similarity or difference with the lake is a screening clue only, not proof of connection.' }, fields: [
        Q('temp', 'number', 'Seep / spring temperature', { unit: '°C' }), Q('ec', 'number', 'Seep / spring EC', { unit: 'µS/cm' }), Q('ph', 'number', 'Seep / spring pH', { min: 3, max: 11 }),
        Q('lake_temp', 'number', 'Lake temperature', { unit: '°C' }), Q('lake_ec', 'number', 'Lake EC', { unit: 'µS/cm' }), Q('lake_ph', 'number', 'Lake pH', { min: 3, max: 11 }),
        Q('d_temp', 'computed', 'ΔT (seep − lake)', { unit: '°C', dp: 1, compute: (v) => diff(v.temp, v.lake_temp) }),
        Q('d_ec', 'computed', 'ΔEC (seep − lake)', { unit: 'µS/cm', dp: 0, compute: (v) => diff(v.ec, v.lake_ec) }),
        Q('ec_ratio', 'computed', 'EC ratio (seep / lake)', { dp: 2, compute: (v) => (n(v.ec) != null && n(v.lake_ec) > 0 ? n(v.ec) / n(v.lake_ec) : null) }),
      ] },
      { id: '3', title: { en: 'Context' }, fields: [
        Q('veg', 'text', 'Indicator vegetation (ferns, sedges, moss …)'), Q('use', 'text', 'Is the water used? By whom?'),
        Q('photos', 'photos', 'Photos', { required: true }), hypField(), Q('notes', 'textarea', 'Notes')] },
    ],
  });

  /* ===================== E10 Seepage meter ===================== */
  const minutes = (a, b) => {
    if (!a || !b) return null;
    const [h1, m1] = a.split(':').map(Number), [h2, m2] = b.split(':').map(Number);
    let d = h2 * 60 + m2 - (h1 * 60 + m1);
    if (d <= 0) d += 1440;
    return d;
  };
  const smDur = (v) => n(v.dur_min) ?? minutes(v.t0, v.t1);
  const smArea = (v) => (n(v.dia) > 0 ? Math.PI * (n(v.dia) / 2) ** 2 : null);
  const smFlux = (v) => {
    const a = smArea(v), d = smDur(v);
    if (a == null || !d || n(v.v0) == null || n(v.v1) == null) return null;
    return ((n(v.factor) ?? 1) * (n(v.v1) - n(v.v0))) / a / (d / 1440);
  };
  reg({
    id: 'sm', short: 'SM', icon: 'pulse', phase: 'soil', geo: 'loc', target: 4, targetLabel: 'tests',
    title: { en: 'Seepage-meter test (optional)' },
    purpose: { en: 'Half-barrel seepage meter at selected natural-bed points with replicates (report 10.1). Positive flux = groundwater discharging into the lake; negative = lake water seeping out.' },
    summary: (v) => [v.sm_id, n(v.flux) != null ? fx(n(v.flux), 2) + ' cm/d' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Setup' }, fields: [
        ...teamMeta(),
        Q('sm_id', 'text', 'Meter / test ID', { required: true, ph: 'SM-01a' }),
        Q('loc', 'gps', 'Position'),
        Q('water_d', 'number', 'Water depth at meter', { unit: 'm' }),
        Q('sed', 'radio', 'Bed sediment', { options: E('mud:Soft mud|sand:Sand|gravel:Gravel|clay:Clay|organic:Organic') }),
        Q('dia', 'number', 'Chamber inner diameter', { unit: 'cm', min: 10, max: 100 }),
        Q('insert', 'number', 'Insertion depth', { unit: 'cm' }),
        Q('equil', 'number', 'Equilibration before bag attached', { unit: 'min' }),
        Q('replicate', 'integer', 'Replicate number', { min: 1, max: 10 }),
      ] },
      { id: '2', title: { en: 'Measurement' }, fields: [
        Q('t0', 'time', 'Bag attached'), Q('t1', 'time', 'Bag removed'),
        Q('dur_min', 'number', 'Duration (overrides times)', { unit: 'min' }),
        Q('v0', 'number', 'Bag volume at start', { unit: 'mL' }), Q('v1', 'number', 'Bag volume at end', { unit: 'mL' }),
        Q('factor', 'number', 'Correction factor (meter calibration; 1 if unknown)', { default: 1, min: 0.5, max: 3 }),
        Q('duration', 'computed', 'Duration used', { unit: 'min', dp: 0, compute: smDur }),
        Q('area', 'computed', 'Chamber area', { unit: 'cm²', dp: 1, compute: smArea }),
        Q('flux', 'computed', 'Seepage flux', { unit: 'cm/day', dp: 3, compute: smFlux }),
        Q('flux_mm', 'computed', 'Seepage flux', { unit: 'mm/day', dp: 2, compute: (v) => (smFlux(v) == null ? null : smFlux(v) * 10) }),
        Q('direction', 'computed', 'Direction', { compute: (v) => { const f = smFlux(v); if (f == null) return null; return Math.abs(f) < 0.05 ? 'About zero' : f > 0 ? 'Into the lake (groundwater discharge)' : 'Out of the lake (lake water loss)'; } }),
      ] },
      { id: '3', title: { en: 'Notes' }, fields: [Q('disturb', 'textarea', 'Disturbance, waves, bag problems'), Q('photos', 'photos', 'Photos')] },
    ],
  });

  /* ===================== E11 Soil sample register ===================== */
  const ZONES = E('A:A — Exposed lake margin / former bed|B:B — Natural inflow / swale zones|C:C — Lining–soil interface / embankment (adjacent, not through concrete)|D:D — Downslope suspected seepage / wet spots|E:E — Control site (undisturbed upslope)');
  const TEXTURE = E('gravel:Gravel|sand:Sand|lsand:Loamy sand|sloam:Sandy loam|loam:Loam|siloam:Silt loam|silt:Silt|scl:Sandy clay loam|cl:Clay loam|sicl:Silty clay loam|sc:Sandy clay|sic:Silty clay|clay:Clay|organic:Organic / peat');
  reg({
    id: 'soil', short: 'SS', icon: 'layers', phase: 'soil', geo: 'loc', target: 15, targetLabel: 'samples',
    title: { en: 'Soil sample register & chain of custody' },
    purpose: { en: 'Target 10–15 disturbed samples + 4–6 undisturbed cores across zones A–E (report 9). Never core through concrete or engineered lining.' },
    summary: (v) => [v.sample_id, v.stype && TT.optLabel(TT.FORMS.soil.fieldMap.stype, v.stype), v.depth_from != null ? `${v.depth_from}–${v.depth_to ?? '?'} m` : ''].filter(Boolean).join(' · '),
    onChange: (fid, v, ctx, api) => {
      if (fid !== 'zone' || !v.zone) return;
      const cur = v.sample_id || '';
      if (cur && (!/^TT-[A-E]\d+$/.test(cur) || cur.startsWith('TT-' + v.zone))) return;
      api.setValue('sample_id', TT.nextSampleId(ctx, v.zone));
    },
    sections: [
      { id: '1', title: { en: 'Sample' }, fields: [
        ...teamMeta(),
        Q('zone', 'radio', 'Sampling zone', { required: true, options: ZONES }),
        Q('sample_id', 'text', 'Sample ID (auto-suggested, editable)', { required: true, ph: 'TT-A01' }),
        Q('stype', 'radio', 'Sample type', { required: true, options: E('dist:Disturbed (bag)|core:Undisturbed core (ring / tube)|auger:Auger profile') }),
        Q('loc', 'gps', 'Position', { required: true }),
        Q('depth_from', 'number', 'Depth from', { unit: 'm', min: 0, max: 5 }),
        Q('depth_to', 'number', 'Depth to', { unit: 'm', min: 0, max: 5 }),
        Q('landcover', 'radio', 'Land cover', { other: true, options: E('bare:Bare soil|grass:Grass|forest:Forest|crop:Cropland|bed:Exposed lake bed|fill:Embankment / fill|road:Road verge|other:Other') }),
        Q('surface', 'text', 'Surface condition (cracks, crust, litter, trampling)'),
        Q('near', 'text', 'Nearby structures (with distance)'),
      ] },
      { id: '2', title: { en: 'Field description' }, fields: [
        Q('moisture', 'radio', 'Moisture', { options: E('dry:Dry|moist:Moist|wet:Wet|sat:Saturated') }),
        Q('colour', 'text', 'Colour (Munsell if available)'),
        Q('texture', 'select', 'Field texture (feel method)', { options: TEXTURE }),
        Q('gravel_pct', 'number', 'Gravel content', { unit: '%', min: 0, max: 100 }),
        Q('plasticity', 'radio', 'Plasticity (thread test)', { options: E('np:Non-plastic|low:Low|med:Medium|high:High') }),
        Q('ribbon', 'number', 'Ribbon length', { unit: 'cm', min: 0, max: 15 }),
        Q('structure', 'radio', 'Structure', { options: E('single:Single grain|gran:Granular|blocky:Blocky|platy:Platy|massive:Massive') }),
        Q('roots', 'radio', 'Roots', { options: E('none:None|few:Few|common:Common|many:Many') }),
        Q('features', 'checks', 'Features', { options: E('layer:Layering|crack:Cracks / fissures|macro:Macropores / burrows|mottle:Mottling|organic:Organic odour|none:None') }),
        Q('uscs', 'select', 'USCS field group (optional)', { options: E('GW:GW|GP:GP|GM:GM|GC:GC|SW:SW|SP:SP|SM:SM|SC:SC|ML:ML|CL:CL|OL:OL|MH:MH|CH:CH|OH:OH|Pt:Pt') }),
      ] },
      { id: '3', title: { en: 'Auger profile' }, show: ['stype', 'auger'], fields: [
        Q('profile', 'table', 'Profile log', { minRows: 4, printRows: 8, columns: [
          C('from', 'number', 'From', { unit: 'm' }), C('to', 'number', 'To', { unit: 'm' }), C('colour', 'text', 'Colour'), C('texture', 'select', 'Texture', { options: TEXTURE }),
          C('gravel', 'number', 'Gravel', { unit: '%' }), C('moist', 'select', 'Moisture', { options: E('dry:Dry|moist:Moist|wet:Wet|sat:Saturated') }), C('note', 'text', 'Notes (roots, cracks, layering)')] }),
      ] },
      { id: '4', title: { en: 'Undisturbed core' }, show: ['stype', 'core'], fields: [
        Q('core_type', 'radio', 'Core type', { options: E('ring:Steel ring|tube:Thin-walled tube|block:Block') }),
        Q('core_d', 'number', 'Core diameter', { unit: 'cm' }), Q('core_h', 'number', 'Core height', { unit: 'cm' }),
        Q('core_orient', 'yn', 'Top / orientation marked?', { dk: false }),
        Q('core_capped', 'yn', 'Trimmed flush and capped both ends?', { dk: false }),
        Q('core_quality', 'radio', 'Core quality', { options: O.quality }),
      ] },
      { id: '5', title: { en: 'Laboratory & chain of custody' }, fields: [
        Q('tests', 'checks', 'Tests requested', { options: E('wc:Natural water content|gsd:Grain size (sieve)|hydro:Hydrometer|atterberg:Atterberg limits|gs:Specific gravity|density:Bulk / dry density|kfh:Permeability — falling head|kch:Permeability — constant head|om:Organic content|proctor:Compaction (Proctor)') }),
        Q('sealed', 'yn', 'Sealed immediately (moisture kept)?', { dk: false }),
        Q('photos', 'photos', 'Photos (with scale and the label visible)', { required: true }),
        Q('collected_by', 'text', 'Collected by', { default: (ctx) => ctx.settings.enumerator || '' }),
        Q('handed_to', 'text', 'Handed to'), Q('handed_dt', 'datetime', 'Hand-over date & time'),
        Q('lab', 'text', 'Laboratory'), Q('lab_no', 'text', 'Laboratory sample no.'),
        Q('notes', 'textarea', 'Notes'),
      ] },
    ],
  });

  /* ===================== E12 Infiltration test ===================== */
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
    id: 'inf', short: 'IF', icon: 'funnel', phase: 'soil', geo: 'loc', target: 5, targetLabel: 'tests',
    title: { en: 'Field infiltration test' },
    purpose: { en: 'Ring infiltrometer on dry/unsaturated soil around inflow zones and controls (report 9, Day 3). Measures infiltration behaviour — NOT saturated seepage through the submerged lake bed.' },
    summary: (v) => [v.test_id, v.zone && 'zone ' + v.zone, n(v.steady) != null ? fx(n(v.steady), 1) + ' mm/h' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Setup' }, fields: [
        ...teamMeta(),
        Q('test_id', 'text', 'Test ID', { required: true, ph: 'IF-01' }),
        Q('loc', 'gps', 'Position', { required: true }),
        Q('zone', 'radio', 'Zone', { options: ZONES }),
        Q('soil_ref', 'text', 'Linked soil sample ID', { suggest: ids('soil', 'sample_id') }),
        Q('method', 'radio', 'Method', { options: E('double:Double-ring|single:Single-ring|minidisk:Mini-disk (tension)|other:Other') }),
        Q('d_inner', 'number', 'Inner ring diameter', { unit: 'cm' }), Q('d_outer', 'number', 'Outer ring diameter', { unit: 'cm' }),
        Q('insert', 'number', 'Insertion depth', { unit: 'cm' }), Q('head', 'number', 'Ponded head maintained', { unit: 'cm' }),
        Q('moisture', 'radio', 'Initial soil moisture', { options: E('dry:Dry|moist:Moist|wet:Wet') }),
        Q('surface', 'text', 'Surface (vegetation, crust, cracks)'),
      ] },
      { id: '2', title: { en: 'Readings' }, intro: { en: 'Record depth from the ring rim (reference) DOWN to the water surface; it increases as water infiltrates. After refilling, enter the new depth in “Refilled to”.' }, fields: [
        Q('readings', 'table', 'Readings', { minRows: 10, printRows: 16, columns: [
          C('t', 'number', 'Elapsed time', { unit: 'min' }), C('rd', 'number', 'Depth to water', { unit: 'cm' }), C('refill', 'number', 'Refilled to', { unit: 'cm' }),
          C('drop', 'number', 'Drop', { computed: true, unit: 'cm', dp: 2 }), C('cum', 'number', 'Cumulative', { computed: true, unit: 'cm', dp: 2 }), C('rate', 'number', 'Rate', { computed: true, unit: 'mm/h', dp: 1 })],
          compute: infComp,
          summary: (rows, comp) => {
            const s = steady(comp);
            const neg = comp.some((c) => c.rate != null && c.rate < 0);
            const last = comp.filter((c) => c.cum != null).pop();
            return [['Steady rate (mean of last 3)', s != null ? `${s.toFixed(1)} mm/h = ${(s / 3.6).toFixed(2)} µm/s` : '—'],
              ['Indicative K class (NRCS)', s != null && s > 0 ? KSAT(s / 3.6) : '—'], ['Cumulative infiltration', last ? last.cum.toFixed(2) + ' cm' : '—'],
              ...(neg ? [['Check', 'Negative drop — readings must be depth from rim down to water', 'bad']] : [])];
          } }),
        Q('steady', 'computed', 'Steady infiltration rate', { unit: 'mm/h', dp: 1, compute: (v) => steady(infComp(v.readings || [])) }),
        Q('i_caution', 'info', null, { text: { en: 'A field infiltration test on dry/unsaturated soil measures infiltration behaviour; it is not the same as saturated seepage through the submerged lake bed. Treat infiltration, laboratory K, lake-level recession and direct seepage measurements as complementary evidence.' } }),
      ] },
      { id: '3', title: { en: 'Notes' }, fields: [Q('photos', 'photos', 'Photos'), Q('notes', 'textarea', 'Notes')] },
    ],
  });

  /* ===================== E13 Water quality ===================== */
  reg({
    id: 'wq', short: 'WQ', icon: 'thermo', phase: 'water', geo: 'loc', target: 8, targetLabel: 'readings',
    title: { en: 'Water-quality spot measurement' },
    purpose: { en: 'Portable pH / EC / temperature / turbidity / DO at the lake, inflows, seeps and springs (report 8.1, 10.1). Calibrate meters daily.' },
    summary: (v) => [v.site_id || (v.site_type && TT.optLabel(TT.FORMS.wq.fieldMap.site_type, v.site_type)), v.ec != null ? 'EC ' + v.ec : '', v.temp != null ? v.temp + ' °C' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Site' }, fields: [
        ...teamMeta(),
        Q('site_type', 'radio', 'Site', { required: true, options: E('lake_c:Lake — centre|lake_e:Lake — edge|inflow:Inflow|outflow:Outflow|seep:Seep|spring:Spring|tap:Well / tap|rain:Rainwater') }),
        Q('site_id', 'text', 'Site ID', { suggest: ids('feat', 'fid') }),
        Q('loc', 'gps', 'Position'),
        Q('depth', 'number', 'Sample depth', { unit: 'm' }),
        Q('instrument', 'text', 'Instrument(s)'),
        Q('calib', 'yn', 'Meters calibrated today?', { dk: false }),
      ] },
      { id: '2', title: { en: 'Readings' }, fields: [
        Q('temp', 'number', 'Temperature', { unit: '°C', min: 0, max: 40 }), Q('ph', 'number', 'pH', { min: 3, max: 11 }),
        Q('ec', 'number', 'EC', { unit: 'µS/cm', min: 0, max: 5000 }), Q('tds', 'number', 'TDS', { unit: 'mg/L' }),
        Q('turb', 'number', 'Turbidity', { unit: 'NTU' }), Q('do', 'number', 'Dissolved oxygen', { unit: 'mg/L', min: 0, max: 20 }),
        Q('colour', 'radio', 'Colour', { options: E('clear:Clear|green:Greenish|brown:Brownish|muddy:Turbid / muddy') }),
        Q('odour', 'radio', 'Odour', { options: E('none:None|earthy:Earthy|h2s:Rotten egg|sewage:Sewage|other:Other') }),
        Q('algae', 'radio', 'Algae', { options: E('none:None|few:Few|abundant:Abundant|bloom:Bloom') }),
        Q('lab_id', 'text', 'Lab sample ID (if collected)'), Q('photos', 'photos', 'Photos'), Q('notes', 'textarea', 'Notes'),
      ] },
    ],
  });

  /* ===================== E14 Catchment & runoff-path verification ===================== */
  reg({
    id: 'catch', short: 'CA', icon: 'compass', phase: 'drain', geo: 'loc', target: 12, targetLabel: 'checks',
    title: { en: 'Catchment & runoff-path verification' },
    purpose: { en: 'Field-check the 13.87 ha DEM catchment (~28.7 m cells): divides, traced runoff paths, road interception and diversions, to build the effective hydrological catchment (report 7, 16.1).' },
    summary: (v) => [v.ctype && TT.optLabel(TT.FORMS.catch.fieldMap.ctype, v.ctype), v.reaches && 'reaches lake: ' + v.reaches].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Check point' }, fields: [
        ...teamMeta(),
        Q('ctype', 'radio', 'Type', { required: true, options: E('divide:Ridge / divide point|path:Runoff path (traced)|intercept:Road interception point|divert:Diversion out of catchment|entry:Inflow entry to lake|sink:Closed depression / sink|rstruct:Recharge structure|boundary:DEM boundary check') }),
        Q('loc', 'gps', 'Position (start)', { required: true }),
        Q('end_pt', 'gps', 'End point (traced paths)'),
        Q('reaches', 'radio', 'Does runoff from here reach the lake?', { options: E('yes:Yes|partly:Partly|no:No|unknown:Unknown') }),
        Q('evidence', 'checks', 'Evidence', { options: E('flow:Observed flowing water|rills:Rills / erosion marks|debris:Debris / litter lines|wet:Wet soil / ponding|local:Local information|topo:Topography only') }),
        Q('dem', 'radio', 'Compared with the GIS (DEM) catchment', { options: E('in_ok:Inside — confirmed|in_out:Inside — but drains away (exclude)|out_in:Outside — but drains to lake (include)|edge_ok:On boundary — confirmed|unknown:Unknown') }),
        Q('area', 'number', 'Area affected (estimate)', { unit: 'm²' }),
        Q('landcover', 'radio', 'Land cover', { options: E('forest:Forest|grass:Grass / grazing|crop:Cropland|bare:Bare|road:Road / track|built:Built-up') }),
        Q('photos', 'photos', 'Photos'), hypField(), Q('notes', 'textarea', 'Notes'),
      ] },
    ],
  });

  /* ===================== E15 Photo landmark / repeat photography ===================== */
  reg({
    id: 'pl', short: 'PL', icon: 'image', phase: 'level', geo: 'loc', target: 6, targetLabel: 'landmarks',
    title: { en: 'Photo landmark (repeat photography)' },
    purpose: { en: 'Fixed camera stations for comparison with old photos and for future monitoring (report 8, 11.1, 15.1).' },
    summary: (v) => [v.pl_id, v.bearing != null ? v.bearing + '°' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Station' }, fields: [
        ...teamMeta(),
        Q('pl_id', 'text', 'Landmark ID', { required: true, ph: 'PL-01' }),
        Q('loc', 'gps', 'Camera position', { required: true }),
        Q('bearing', 'number', 'Camera bearing', { unit: '°', min: 0, max: 360 }),
        Q('height', 'number', 'Camera height above ground', { unit: 'm' }),
        Q('zoom', 'radio', 'Lens / zoom', { options: E('w:Ultra-wide (0.5×)|n:Normal (1×)|t:Tele (2×+)') }),
        Q('view', 'textarea', 'What is in view; reference objects'),
        Q('hist_ref', 'text', 'Matching historical item (evidence register record)', { suggest: (v, ctx) => (ctx.records || []).filter((r) => r.form === 'ev').map((r) => r.id) }),
        Q('hist_level', 'textarea', 'Historical water level relative to the landmark'),
        Q('now_level', 'textarea', 'Current water level relative to the landmark'),
        Q('diff_m', 'number', 'Estimated vertical difference (historical − now)', { unit: 'm' }),
        Q('photos', 'photos', 'Photos', { required: true }),
      ] },
    ],
  });

  /* ===================== E16 Construction & intervention history ===================== */
  reg({
    id: 'hist', short: 'CH', icon: 'file', phase: 'synth', geo: 'loc', target: 6, targetLabel: 'works',
    title: { en: 'Construction & intervention history' },
    purpose: { en: 'One record per work (lining, roads, recharge ponds, de-silting …) so the construction chronology can be compared with the decline timeline (report 12, 16.1).' },
    summary: (v) => [v.wtype && TT.optLabel(TT.FORMS.hist.fieldMap.wtype, v.wtype), v.year_start && v.year_start !== 'dk' ? v.year_start + ' BS' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Work' }, fields: [
        Q('logged_by', 'text', 'Logged by', { default: (ctx) => ctx.settings.enumerator || '' }),
        Q('wtype', 'select', 'Work type', { required: true, other: true, options: E('lining:Concrete edge lining|bedlining:Lake-bed lining|wall:Wall / embankment|excav:Excavation / deepening|desilt:De-silting / cleaning|outlet:Outlet / overflow works|inlet:Inlet / drain works|road:Road construction / upgrade|culvert:Culvert|rpond:Recharge pond|trench:Contour trench|plant:Plantation|walkway:Walkway / steps|tourism:Tourism structure|fence:Fencing|other:Other') }),
        Q('year_start', 'bsyear', 'Year started', { to: 2030 }), Q('year_end', 'bsyear', 'Year completed', { to: 2030 }),
        Q('agency', 'select', 'Agency', { other: true, options: O.agency }),
        Q('contractor', 'text', 'Contractor / user committee'),
        Q('cost', 'number', 'Cost', { unit: 'NPR' }),
        Q('purpose', 'textarea', 'Purpose'),
        Q('extent', 'textarea', 'Extent / location (which sides of the lake)'),
        Q('excavation', 'yn', 'Excavation undertaken?'),
        Q('orig_ground', 'yn', 'Original ground level known?'),
        Q('repairs', 'textarea', 'Repairs since'),
        Q('docs', 'checks', 'Documents available', { options: E('drawings:Drawings|boq:BOQ / estimate|completion:Completion report|photos:Photos|none:None|unknown:Unknown') }),
        Q('docs_photos', 'photos', 'Photos of documents'),
        Q('source', 'radio', 'Source of this information', { options: E('doc:Document|kii:Key informant|hh:Community interview|field:Field observation') }),
        Q('loc', 'gps', 'Location'),
        Q('effect', 'radio', 'Reported effect on water level', { options: E('better:Improved|worse:Worsened|none:No change|unknown:Unknown') }),
        Q('notes', 'textarea', 'Notes'),
      ] },
    ],
  });

  /* ===================== E17 Hypothesis–evidence matrix ===================== */
  const SCORE = E('0:0 Absent / contradicted|1:1 Weak|2:2 Moderate|3:3 Strong');
  reg({
    id: 'hyp', short: 'HM', icon: 'target', phase: 'synth', target: 1, targetLabel: 'assessment',
    title: { en: 'Hypothesis–evidence matrix (cause ranking)' },
    purpose: { en: 'Rank causes by evidence, not expectation (report 16). Score 0 = absent/contradicted, 1 = weak, 2 = moderate, 3 = strong. The score is a transparent organising device, not a probability.' },
    summary: (v) => v.ranking || v.stage || '',
    sections: [
      { id: '0', title: { en: 'Assessment' }, fields: [
        Q('assessor', 'text', 'Assessor(s)', { default: (ctx) => ctx.settings.enumerator || '' }),
        Q('stage', 'radio', 'Stage', { required: true, options: E('d1:After Day 1|d3:After Day 3|end:End of fieldwork|post:Post-field analysis') }),
        Q('date', 'date', 'Date', { now: true }),
      ] },
      ...TT.HYP.map((hy) => ({
        id: hy.id, title: { en: `${hy.id} ${hy.en}`, ne: `${hy.id} ${hy.ne}` },
        intro: { en: hy.test },
        note: { en: `Supports: ${hy.sup}  Weakens: ${hy.weak}` },
        fields: [
          Q(hy.id + '_score', 'radio', 'Evidence score', { options: SCORE }),
          Q(hy.id + '_conf', 'radio', 'Confidence in the evidence', { options: E('low:Low|med:Medium|high:High') }),
          Q(hy.id + '_sup', 'textarea', 'Supporting evidence (with record IDs)'),
          Q(hy.id + '_weak', 'textarea', 'Weakening / contradicting evidence (with record IDs)'),
        ],
      })),
      { id: 'S', title: { en: 'Synthesis & next level' }, fields: [
        Q('ranking', 'computed', 'Ranking by score', { compute: (v) => {
          const s = TT.HYP.map((hy) => [hy.id, n(v[hy.id + '_score'])]).filter(([, x]) => x != null).sort((a, b) => b[1] - a[1]);
          return s.length ? s.map(([id, x]) => `${id} (${x})`).join(' > ') : null; } }),
        Q('mechanism', 'radio', 'Dominant problem appears to be', { options: E('inflow:Insufficient inflow / recharge|outflow:Excessive outflow / seepage|both:Both|unclear:Not yet clear') }),
        Q('next_level', 'radio', 'Recommended next level (investigation ladder, report 17)', { options: E('l1:More Level 1 work needed|l2:Level 2 — short monitoring (1–3 months / seasonal)|l3:Level 3 — targeted seepage / hydrogeology|l4:Level 4 — design of intervention') }),
        Q('next_steps', 'textarea', 'Next steps'),
        Q('i_warn', 'info', null, { text: { en: 'Do not repair or add more lining before confirming whether the lake’s problem is insufficient inflow or excessive outflow/seepage. A measure that is beneficial for one mechanism can worsen another.' } }),
      ] },
    ],
  });

  /* ===================== E18 Pre-departure & equipment checklist ===================== */
  reg({
    id: 'kit', short: 'KIT', icon: 'checklist', phase: 'setup', target: 1, targetLabel: 'checklist',
    title: { en: 'Pre-departure & equipment checklist' },
    purpose: { en: 'Day 0 preparation and minimum field equipment (report 8, 8.1).' },
    summary: (v) => [v.date, Array.isArray(v.kit) ? v.kit.length + ' items packed' : ''].filter(Boolean).join(' · '),
    sections: [
      { id: '1', title: { en: 'Checklist' }, fields: [
        Q('date', 'date', 'Date', { now: true }),
        Q('team', 'text', 'Team', { default: (ctx) => ctx.settings.team || '' }),
        Q('kit', 'checks', 'Equipment packed', { options: E('gnss:GNSS / phone with offline maps|sheets:Printed catchment / orthophoto sheets|compass:Compass / clinometer|tape:30–50 m tape|staff:Staff / ranging rod|sounding:Weighted sounding line / graduated pole|pegs:Pegs, paint, chalk|level:Level (spirit / laser / auto)|gauge:Staff gauge + benchmark material|bags:Sample bags, labels, markers|auger:Hand auger & trowel|cores:Core rings / tubes, driver, caps|bucket:Buckets / containers & stopwatch|float:Float & tape|meters:pH / EC / temperature / turbidity / DO meters + calibration solutions|camera:Camera / phone & power banks|notebook:Waterproof notebook & printed forms|board:Photo board / scale|ppe:Gumboots & gloves|firstaid:First-aid kit|rain:Rain protection|lifejacket:Life jacket (if entering water / boat)|drone:Drone (optional, permitted)|ring:Double-ring infiltrometer (optional)|seepmeter:Seepage meter (optional)|logger:Water-level logger (optional)') }),
        Q('prep', 'checks', 'Preparation done', { options: DAYS.d0 }),
        Q('safety', 'checks', 'Safety', { options: E('contacts:Emergency contacts shared|health:Nearest health post noted|forecast:Weather forecast checked|buddy:No one works alone near water|briefing:Safety briefing held') }),
        Q('missing', 'textarea', 'Missing items / actions'),
      ] },
    ],
  });

  TT.PHASES = [
    { id: 'setup', en: 'Setup & control', note: 'Day 0–1' },
    { id: 'level', en: 'Lake geometry, level & bathymetry', note: 'Day 1–2, daily readings' },
    { id: 'drain', en: 'Drainage, lining & catchment', note: 'Day 1–3' },
    { id: 'soil', en: 'Soils, infiltration & seepage', note: 'Day 3' },
    { id: 'water', en: 'Flows & water quality', note: 'Day 1–5' },
    { id: 'synth', en: 'History & cause ranking', note: 'Day 4–5 and after' },
  ];
})();
