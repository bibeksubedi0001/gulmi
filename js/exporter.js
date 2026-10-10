/* Lakes field portal: exports (Excel + codebook, GeoJSON, KML, ZIP package, JSON) and merge-import. */
'use strict';
(function () {
  const TT = window.TT;
  const XLSX_SRC = 'vendor/xlsx.mini.min.js';

  const colKey = (f) => `${f.num}_${f.id}`;
  const r6 = (x) => (Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : '');
  const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : '');
  const NUMERIC = new Set(['number', 'integer']);

  function gpsCols(prefix, g) {
    const u = g && Number.isFinite(g.lat) ? TT.utm(g.lat, g.lon) : null;
    return {
      [prefix + '_lat']: g ? r6(g.lat) : '', [prefix + '_lon']: g ? r6(g.lon) : '',
      [prefix + '_acc_m']: g && g.acc != null ? g.acc : '', [prefix + '_alt_m']: g && g.alt != null ? g.alt : '',
      [prefix + '_utm44N_E']: u ? r2(u.e) : '', [prefix + '_utm44N_N']: u ? r2(u.n) : '',
    };
  }

  // One flat row per record (labels in English) + sub-tables. Hidden (skipped) answers are blanked.
  TT.flatten = function (form, rec, { pii = false, ctx = {} } = {}) {
    const v = rec.data || {};
    const row = {
      record_id: rec.id, form: form.short, status: rec.status, created: TT.fmt(rec.created), updated: TT.fmt(rec.updated),
      enumerator: rec.enumerator || '', device: rec.device || '', summary: safeSummary(form, v),
    };
    const tables = [];
    const notes = [];
    for (const f of form.fields) {
      if (f.type === 'info' || (f.pii && !pii)) continue;
      const key = colKey(f);
      const vis = TT.visible(f, v);
      const val = vis ? v[f.id] : undefined;
      switch (f.type) {
        case 'gps': Object.assign(row, gpsCols(key, val)); break;
        case 'grid':
          for (const r of f.rows) {
            for (const c of f.cols) {
              const cv = val && val[r.v] && val[r.v][c.v];
              const sc = cv != null && f.scale.find((x) => x.v === cv);
              row[`${key}.${r.v}${f.cols.length > 1 ? '.' + c.v : ''}`] = sc ? TT.Ls(sc, 'en') : cv ?? '';
            }
          }
          break;
        case 'rank':
          row[key] = TT.valueText(f, val, v);
          for (let i = 0; i < (f.max || 3); i++) row[`${key}_${i + 1}`] = val && val[i] ? TT.optLabel(f, val[i]) : '';
          break;
        case 'table': {
          const rows = Array.isArray(val) ? val.filter((r) => r && Object.keys(r).length) : [];
          row[key + '_rows'] = rows.length;
          if (rows.length) tables.push({ field: f, rows, comp: TT.tableComputed(f, rows, v, ctx) });
          break;
        }
        case 'photos': row[key] = (val || []).join(', '); break;
        default:
          if (NUMERIC.has(f.type) || (f.type === 'computed' && typeof val === 'number')) row[key] = val ?? '';
          else row[key] = val == null ? '' : TT.valueText(f, val, v);
      }
      if (f.other) row[key + '_other'] = vis ? v[f.id + '__other'] || '' : '';
      if (f.evidence) row[key + '_source'] = vis && v[f.id + '__src'] ? TT.optLabel({ options: TT.O.src }, v[f.id + '__src']) : '';
      if (vis && v[f.id + '__note']) notes.push(`${f.num}: ${v[f.id + '__note']}`);
    }
    row.notes = notes.join(' | ');
    return { row, tables };
  };

  function safeSummary(form, v) {
    try { return form.summary ? form.summary(v) || '' : ''; } catch (e) { return ''; }
  }

  function tableRows(form, t, recId, pii) {
    return t.rows.map((r, i) => {
      const o = { record_id: recId, row: i + 1 };
      for (const c of t.field.columns) {
        if (c.pii && !pii) continue;
        const val = c.computed ? t.comp[i] && t.comp[i][c.id] : r[c.id];
        const name = c.id + (c.unit ? `_${c.unit.replace(/[^\w%°³²]/g, '')}` : '');
        if (c.type === 'gps') Object.assign(o, gpsCols(c.id, val));
        else if ((c.type === 'select' || c.type === 'bsyear') && val != null) o[name] = TT.optLabel(c, val);
        else if (c.type === 'check') o[name] = val ? 1 : 0;
        else o[name] = typeof val === 'number' ? Math.round(val * 1e4) / 1e4 : val ?? '';
      }
      return o;
    });
  }

  /* ------------------------------ Excel ------------------------------ */
  const sheetName = (s, used) => {
    let base = s.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31).trim();
    let name = base, i = 2;
    while (used.has(name)) name = base.slice(0, 28) + ' ' + i++;
    used.add(name);
    return name;
  };
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const DT = 'yyyy-mm-dd hh:mm', DAY = 'yyyy-mm-dd';
  const GPS_PARTS = [['lat', 'latitude'], ['lon', 'longitude'], ['acc', 'accuracy (m)'], ['alt', 'altitude (m)'], ['e', 'UTM 44N E (m)'], ['n', 'UTM 44N N (m)']];
  const RANKS = ['1st', '2nd', '3rd', '4th', '5th'];
  const bare = (s) => String(s).replace(/\s*\([^)]*\)\s*$/, '');
  const head = (f, part) => `${f.num ? f.num + ' ' : ''}${TT.Ls(f.q || f.label, 'en')}${part ? ' – ' + part : f.unit ? ` (${f.unit})` : ''}`;
  // Excel wants local wall-clock dates: form values are local ("2026-10-07T11:31"), record stamps are UTC ISO.
  const asDate = (s) => {
    if (!s) return null;
    const m = /^(\d{4})-(\d\d)-(\d\d)(?:[T ](\d\d):(\d\d))?$/.exec(String(s));
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : new Date(s);
    return isNaN(d) ? String(s) : d;
  };
  const gpsPart = (g, k) => {
    if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) return null;
    if (k === 'lat' || k === 'lon') return r6(g[k]);
    if (k === 'acc' || k === 'alt') return Number.isFinite(g[k]) ? g[k] : null;
    const u = TT.utm(g.lat, g.lon);
    return r2(k === 'e' ? u.e : u.n);
  };
  const cellValue = (f, x) => {
    if (x == null || x === '' || (Array.isArray(x) && !x.length)) return null;
    switch (f.type) {
      case 'number': case 'integer': return TT.num(x) ?? String(x);
      case 'select': case 'radio': case 'yn': case 'scale': case 'bsyear': case 'person': return TT.optLabel(f, x);
      case 'checks': case 'months': case 'people': return (Array.isArray(x) ? x : [x]).map((y) => TT.optLabel(f, y)).join('; ');
      case 'check': return x ? 'Yes' : 'No';
      case 'photos': return x.join(', ');
      default: return typeof x === 'number' ? x : typeof x === 'object' ? TT.valueText(f, x) : String(x);
    }
  };
  const statusText = (r) => (r.status === 'complete' ? 'Complete' : 'Draft');
  const lakeText = (r) => TT.lakeName(r.data.lake) || r.data.lake || '';
  const lakeRank = (id) => { const i = TT.LAKE_IDS.indexOf(id); return i < 0 ? TT.LAKE_IDS.length : i; };
  const whenOf = (r) => {
    const form = TT.FORMS[r.form], f = form && form.fields.find((x) => x.type === 'datetime' || x.type === 'date');
    return (f && r.data[f.id]) || r.created;
  };
  // Records grouped by lake (Timure, Chhekmi, both), then form, then date.
  TT.sortRecords = (recs) => recs.map((r) => { const d = asDate(whenOf(r)); return [r, d instanceof Date ? d.getTime() : 0]; })
    .sort(([a, ta], [b, tb]) => lakeRank(a.data.lake) - lakeRank(b.data.lake) || TT.FORM_ORDER.indexOf(a.form) - TT.FORM_ORDER.indexOf(b.form) || ta - tb || a.id.localeCompare(b.id))
    .map(([r]) => r);

  // One worksheet from column specs {h, get, fmt}; book.meta drives the styling pass after writing.
  function addTable(book, title, cols, items, opts = {}) {
    const XLSX = window.XLSX;
    const aoa = [cols.map((c) => c.h), ...items.map((it) => cols.map((c) => { const x = c.get(it); return x === '' || x === undefined ? null : x; }))];
    const ws = XLSX.utils.aoa_to_sheet(aoa, { dateNF: DT });
    cols.forEach((c, j) => {
      if (c.fmt !== DAY) return;
      for (let i = 1; i < aoa.length; i++) { const cell = ws[XLSX.utils.encode_cell({ r: i, c: j })]; if (cell && cell.t === 'n') cell.z = DAY; }
    });
    const widths = cols.map((c, j) => {
      let w = Math.min(c.h.length + 2, 24);
      for (let i = 1; i < aoa.length; i++) { const x = aoa[i][j]; if (x != null) w = Math.max(w, x instanceof Date ? 16 : String(x).length + 1); }
      return Math.min(w, opts.maxWidth || 50);
    });
    ws['!cols'] = widths.map((wch) => ({ wch }));
    const lines = Math.max(1, ...cols.map((c, j) => Math.ceil(c.h.length / Math.max(widths[j] - 1, 1))));
    ws['!rows'] = [{ hpt: 4 + 15 * Math.min(lines, 5) }];
    if (items.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: items.length, c: cols.length - 1 } }) };
    const name = opts.exact ? title : sheetName(title, book.used);
    XLSX.utils.book_append_sheet(book.wb, ws, name);
    book.meta[name] = { freeze: opts.freeze || [1, 1], bold: [1], rows: items.length, about: opts.about || '' };
    return name;
  }

  // Form sheet: ID, lake, status, every question in form order, then question notes and who/when.
  function formColumns(form, pii) {
    const cols = [{ h: 'Record ID', get: (r) => r.id }, { h: 'Lake', get: lakeText }, { h: 'Status', get: statusText }];
    for (const f of form.fields) {
      if (f.type === 'info' || f.id === 'lake' || (f.pii && !pii)) continue;
      const val = (r) => (TT.visible(f, r.data) ? r.data[f.id] : undefined);
      if (f.type === 'gps') GPS_PARTS.forEach(([k, part]) => cols.push({ h: head(f, part), get: (r) => gpsPart(val(r), k) }));
      else if (f.type === 'grid') {
        f.rows.forEach((row) => f.cols.forEach((c) => cols.push({ h: head(f, TT.Ls(row, 'en') + (f.cols.length > 1 ? ', ' + TT.Ls(c, 'en') : '')),
          get: (r) => { const x = ((val(r) || {})[row.v] || {})[c.v]; const sc = x != null && f.scale.find((s) => s.v === x); return sc ? TT.Ls(sc, 'en') : x; } })));
      } else if (f.type === 'rank') {
        for (let i = 0; i < (f.max || 3); i++) cols.push({ h: head(f, RANKS[i]), get: (r) => { const x = val(r); return x && x[i] ? TT.optLabel(f, x[i]) : null; } });
      } else if (f.type === 'table') cols.push({ h: head(f, 'rows'), get: (r) => { const x = val(r); return Array.isArray(x) ? x.filter((o) => o && Object.keys(o).length).length || null : null; } });
      else if (f.type === 'track') cols.push({ h: head(f, 'GPS points'), get: (r) => { const x = val(r); return Array.isArray(x) && x.length ? x.length : null; } });
      else if (f.type === 'datetime' || f.type === 'date') cols.push({ h: head(f), get: (r) => asDate(val(r)), fmt: f.type === 'date' ? DAY : DT });
      else cols.push({ h: head(f), get: (r) => cellValue(f, val(r)) });
      if (f.other) cols.push({ h: head(f, 'other (specify)'), get: (r) => (TT.visible(f, r.data) ? r.data[f.id + '__other'] : null) });
      if (f.evidence) cols.push({ h: head(f, 'how known'), get: (r) => (TT.visible(f, r.data) && r.data[f.id + '__src'] ? TT.optLabel({ options: TT.O.src }, r.data[f.id + '__src']) : null) });
    }
    cols.push({ h: 'Question notes', get: (r) => form.fields.filter((f) => f.type !== 'info' && (!f.pii || pii) && TT.visible(f, r.data) && r.data[f.id + '__note']).map((f) => `${f.num}: ${r.data[f.id + '__note']}`).join(' | ') },
      { h: 'Entered by', get: (r) => r.enumerator }, { h: 'Device', get: (r) => r.device },
      { h: 'Created', get: (r) => asDate(r.created), fmt: DT }, { h: 'Last edited', get: (r) => asDate(r.updated), fmt: DT });
    return cols;
  }

  const ID_FIELDS = ['fid', 'sample_id', 'mark_id', 'test_id', 'site_id', 'tr_id'];
  // Sub-table sheet (soundings, readings, trials, works): one row per entry, linked to its record by Record ID.
  function tableColumns(form, f, pii) {
    const idf = ID_FIELDS.map((id) => form.fieldMap[id]).find(Boolean);
    const cols = [{ h: 'Record ID', get: (t) => t.rec.id }, { h: 'Lake', get: (t) => lakeText(t.rec) }];
    if (idf) cols.push({ h: TT.Ls(idf.q, 'en'), get: (t) => t.rec.data[idf.id] });
    cols.push({ h: 'Row', get: (t) => t.i + 1 });
    for (const c of f.columns) {
      if (c.pii && !pii) continue;
      const val = (t) => (c.computed ? t.comp[t.i] && t.comp[t.i][c.id] : t.row[c.id]);
      if (c.type === 'gps') GPS_PARTS.forEach(([k, part]) => cols.push({ h: head(c, part), get: (t) => gpsPart(val(t), k) }));
      else cols.push({ h: head(c), get: (t) => { const x = val(t); return typeof x === 'number' ? Math.round(x * 1e4) / 1e4 : cellValue(c, x); } });
    }
    return cols;
  }

  const TYPE_TEXT = { select: 'one choice', radio: 'one choice', yn: 'yes / no', check: 'yes / no', scale: 'rating', bsyear: 'year (BS)', person: 'team member',
    people: 'team members', checks: 'several choices, ; separated', months: 'months, ; separated', rank: 'ranking', grid: 'rating per period', number: 'number',
    integer: 'whole number', computed: 'calculated', text: 'text', textarea: 'text', datetime: 'date and time', date: 'date', gps: 'GPS position',
    photos: 'photo IDs (see Photos)', table: 'table (rows on their own sheet)', track: 'GPS track' };
  const optList = (f) => (f.options || f.scale || []).map((o) => `${o.v} = ${TT.Ls(o, 'en')}`).join('; ');
  function codebookRows(pii, sheetOf) {
    const all = 'Every form sheet';
    const rows = [
      { sheet: all, column: 'Record ID', question: 'Unique ID: form code, device code and number' },
      { sheet: all, column: 'Lake', question: 'Lake the record belongs to' },
      { sheet: all, column: 'Status', question: 'Complete, or Draft (not finished)' },
      { sheet: all, column: 'Question notes', question: 'Notes added to single questions, as "question no.: note"' },
      { sheet: all, column: 'Entered by, Device, Created, Last edited', question: 'Who entered the record, on which phone, and when' },
    ];
    for (const id of TT.FORM_ORDER) {
      const form = TT.FORMS[id];
      for (const f of form.fields) {
        if (f.type === 'info' || f.id === 'lake' || (f.pii && !pii)) continue;
        const parts = f.type === 'gps' ? GPS_PARTS.map((p) => p[1]) : f.type === 'rank' ? RANKS.slice(0, f.max || 3) : f.type === 'grid' ? f.rows.map((r) => TT.Ls(r, 'en')) : [];
        rows.push({ sheet: sheetOf[id] || `${form.short} (no records yet)`, column: head(f) + (parts.length ? ` – ${parts.join(' / ')}` : ''), question: TT.Ls(f.q, 'en'),
          section: TT.Ls(f.section.title, 'en'), type: TYPE_TEXT[f.type] || f.type, unit: f.unit, options: optList(f),
          when: TT.whenText(form, f) || (f.section._dep ? TT.whenText(form, f.section) : ''), pii: f.pii ? 'yes' : '' });
        if (f.type !== 'table') continue;
        for (const c of f.columns) {
          if (c.pii && !pii) continue;
          rows.push({ sheet: sheetOf[`${id}.${f.id}`] || `${form.short} (no rows yet)`, column: head(c), question: TT.Ls(c.label, 'en'), section: `${f.num} ${TT.Ls(f.q, 'en')}`,
            type: c.computed ? 'calculated' : TYPE_TEXT[c.type] || c.type, unit: c.unit, options: optList(c), pii: c.pii ? 'yes' : '' });
        }
      }
    }
    return rows;
  }

  TT.buildWorkbook = async function ({ records, photos, pii = false, ctx }) {
    await TT.loadScript(TT.asset(XLSX_SRC));
    const XLSX = window.XLSX;
    const book = { wb: XLSX.utils.book_new(), used: new Set(['README', 'Summary']), meta: {} };
    const recs = TT.sortRecords(records);
    const byId = new Map(recs.map((r) => [r.id, r]));
    const byForm = {};
    recs.forEach((r) => (byForm[r.form] = byForm[r.form] || []).push(r));
    const nPhotos = {};
    photos.forEach((p) => (nPhotos[p.record] = (nPhotos[p.record] || 0) + 1));
    const sheetOf = {};

    const geoOf = (r) => { const form = TT.FORMS[r.form]; return form.geo && TT.visible(form.fieldMap[form.geo], r.data) ? r.data[form.geo] : null; };
    const whoOf = (r) => { const f = TT.FORMS[r.form].fields.find((x) => x.type === 'person' || x.type === 'people'); const v = f && r.data[f.id]; return v && v.length ? TT.valueText(f, v, r.data) : r.enumerator; };
    addTable(book, 'All records', [
      { h: 'Record ID', get: (r) => r.id }, { h: 'Lake', get: lakeText }, { h: 'Form', get: (r) => `${TT.FORMS[r.form].short} ${TT.Ls(TT.FORMS[r.form].title, 'en')}` },
      { h: 'Status', get: statusText }, { h: 'Date & time', get: (r) => asDate(whenOf(r)), fmt: DT }, { h: 'Recorded by', get: whoOf },
      { h: 'Summary', get: (r) => safeSummary(TT.FORMS[r.form], r.data) },
      ...GPS_PARTS.map(([k, part]) => ({ h: `GPS ${part}`, get: (r) => gpsPart(geoOf(r), k) })), { h: 'Photos', get: (r) => nPhotos[r.id] },
    ], recs, { about: 'Every record in one list: lake, form, date, who, a one-line summary and the main GPS position' });

    for (const id of TT.FORM_ORDER) {
      const list = byForm[id];
      if (!list) continue;
      const form = TT.FORMS[id], title = TT.Ls(form.title, 'en');
      sheetOf[id] = addTable(book, `${form.short} ${bare(title)}`, formColumns(form, pii), list, { about: `${title}: one row per record` });
      for (const f of form.fields) {
        if (f.type !== 'table') continue;
        const items = list.flatMap((rec) => {
          if (!TT.visible(f, rec.data)) return [];
          const rows = (Array.isArray(rec.data[f.id]) ? rec.data[f.id] : []).filter((o) => o && Object.keys(o).length);
          const comp = TT.tableComputed(f, rows, rec.data, ctx);
          return rows.map((row, i) => ({ rec, row, i, comp }));
        });
        if (items.length) sheetOf[`${id}.${f.id}`] = addTable(book, `${form.short} ${bare(TT.Ls(f.q, 'en'))}`, tableColumns(form, f, pii), items,
          { about: `${TT.Ls(f.q, 'en')} (${form.short} ${f.num}): one row per entry, linked by Record ID` });
      }
    }

    const wl = (TT.analysis ? TT.analysis.waterLevel(recs, ctx) : []).map((p) => ({ ...p, rec: byId.get(p.id) }))
      .sort((a, b) => lakeRank(a.rec && a.rec.data.lake) - lakeRank(b.rec && b.rec.data.lake) || a.gauge.localeCompare(b.gauge) || a.t - b.t);
    if (wl.length) {
      const rain = TT.FORMS.wl.fieldMap.rain_since;
      addTable(book, 'Water levels (derived)', [
        { h: 'Record ID', get: (p) => p.id }, { h: 'Lake', get: (p) => (p.rec ? lakeText(p.rec) : null) }, { h: 'Gauge', get: (p) => p.gauge },
        { h: 'Date & time', get: (p) => p.t, fmt: DT }, { h: 'Staff reading (m)', get: (p) => p.reading }, { h: 'Water-surface RL (m)', get: (p) => p.wsl },
        { h: 'Rain since the previous reading', get: (p) => (p.rain ? TT.optLabel(rain, p.rain) : null) }, { h: 'Hours since the previous reading', get: (p) => p.dtH },
        { h: 'Fall (mm/day)', get: (p) => p.rate }, { h: 'Screening flag', get: (p) => p.flag },
      ], wl, { about: 'Water-level readings per gauge in time order, with the fall rate between readings and a seepage screening flag' });
    }

    if (photos.length) {
      const order = new Map(recs.map((r, i) => [r.id, i]));
      const qOf = (p) => { const f = TT.FORMS[p.form] && TT.FORMS[p.form].fieldMap[p.field]; return f ? head(f) : p.field; };
      addTable(book, 'Photos', [
        { h: 'Photo ID', get: (p) => p.id }, { h: 'Record ID', get: (p) => p.record }, { h: 'Lake', get: (p) => (byId.get(p.record) ? lakeText(byId.get(p.record)) : null) },
        { h: 'Form', get: (p) => (TT.FORMS[p.form] ? TT.FORMS[p.form].short : p.form) }, { h: 'Question', get: qOf }, { h: 'Caption', get: (p) => p.caption },
        { h: 'Taken', get: (p) => asDate(p.t), fmt: DT }, ...GPS_PARTS.slice(0, 3).map(([k, part]) => ({ h: `GPS ${part}`, get: (p) => gpsPart(p.gps, k) })),
        { h: 'Width (px)', get: (p) => p.w }, { h: 'Height (px)', get: (p) => p.h }, { h: 'Size (KB)', get: (p) => Math.round((p.size || 0) / 1024) },
      ], [...photos].sort((a, b) => (order.get(a.record) ?? 1e9) - (order.get(b.record) ?? 1e9) || a.id.localeCompare(b.id)),
      { about: 'Photo list in record order; the image files are in photos/ of the field package (file name = Photo ID)' });
    }

    addTable(book, 'Codebook', [
      { h: 'Sheet', get: (x) => x.sheet }, { h: 'Column', get: (x) => x.column }, { h: 'Question', get: (x) => x.question }, { h: 'Section', get: (x) => x.section },
      { h: 'Answer type', get: (x) => x.type }, { h: 'Unit', get: (x) => x.unit }, { h: 'Options (code = label)', get: (x) => x.options },
      { h: 'Asked when', get: (x) => x.when }, { h: 'Personal data', get: (x) => x.pii },
    ], codebookRows(pii, sheetOf), { about: 'Every question: column header, full question, answer type, unit, options and when it is asked', freeze: [2, 1], maxWidth: 60 });

    const lakeKeys = [...new Set([...TT.LAKE_IDS, ...recs.map((r) => r.data.lake || '')])];
    const count = (id, k, st) => recs.filter((r) => (!id || r.form === id) && (r.data.lake || '') === k && (!st || r.status === st)).length;
    const sumCols = [{ h: 'Form', get: (x) => x.title }, { h: 'Code', get: (x) => x.code }];
    lakeKeys.forEach((k) => {
      const name = TT.lakeName(k) || 'No lake';
      sumCols.push({ h: `${name} \u2013 complete`, get: (x) => count(x.id, k, 'complete') }, { h: `${name} \u2013 draft`, get: (x) => count(x.id, k, 'draft') });
    });
    sumCols.push({ h: 'Total', get: (x) => recs.filter((r) => !x.id || r.form === x.id).length });
    addTable(book, 'Summary', sumCols, [...TT.FORM_ORDER.map((id) => ({ id, title: TT.Ls(TT.FORMS[id].title, 'en'), code: TT.FORMS[id].short })), { id: null, title: 'All forms', code: '' }],
      { exact: true, about: 'Number of records per form and lake (complete and draft)' });

    const order = ['README', 'Summary', ...book.wb.SheetNames.filter((s) => s !== 'Summary')];
    const rd = [
      ['Timure Taal and Chhekmi Taal: field survey data'], [],
      ['Exported', new Date()], ['Device', ctx.device], ['Portal version', TT.VERSION], ['Records', recs.length], ['Photos', photos.length],
      ['Personal data', pii ? 'Included: names and phone numbers (confidential)' : 'Removed: names and phone numbers'],
      ...TT.LAKE_IDS.map((id) => { const c = TT.lakeCentre(id); return [`${TT.lakeName(id)} (${TT.lakeCode(id)}) centre`, c ? `${c.lat.toFixed(6)} N, ${c.lon.toFixed(6)} E` : 'not set']; }),
      ['Coordinates', 'WGS84 latitude / longitude; UTM zone 44N (EPSG:32644) in metres'],
      ['Order', 'Rows are grouped by lake (Timure first, then Chhekmi), then by date and time (local time of the phone)'],
      ['Headers', 'Question number and question as in the form, unit in brackets; the Codebook lists every question with its options'],
      ['Blank cell', 'Question not asked (skipped) or not answered'],
      [], ['Sheet', 'Contents', 'Rows'],
      ...order.slice(1).map((s) => [s, book.meta[s].about, book.meta[s].rows]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rd, { dateNF: DT });
    ws['!cols'] = [{ wch: 30 }, { wch: 110 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(book.wb, ws, 'README');
    book.meta.README = { freeze: null, bold: [1, rd.length - order.length + 1] };
    book.wb.SheetNames = order;

    const opts = { bookType: 'xlsx', type: 'array', bookSST: true };
    try { return await polish(XLSX.write(book.wb, { ...opts, compression: false }), order.map((s) => book.meta[s])); } catch (e) { console.error(e); }
    return new Blob([XLSX.write(book.wb, { ...opts, compression: true })], { type: XLSX_MIME });
  };

  // SheetJS CE writes no cell styles or frozen panes: give each sheet a bold, shaded, wrapped header and freeze it with the ID column.
  async function polish(buf, metas) {
    const parts = await TT.unzip(new Blob([buf]));
    const dec = new TextDecoder(), enc = new TextEncoder();
    let sty = dec.decode(parts['xl/styles.xml']);
    const add = (tag, xml) => {
      const m = new RegExp(`<${tag} count="(\\d+)">`).exec(sty);
      if (!m || !sty.includes(`</${tag}>`)) throw new Error(`styles.xml has no <${tag}>`);
      sty = sty.replace(m[0], `<${tag} count="${+m[1] + 1}">`).replace(`</${tag}>`, `${xml}</${tag}>`);
      return +m[1];
    };
    const font = add('fonts', '<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>');
    const fill = add('fills', '<fill><patternFill patternType="solid"><fgColor rgb="FFDDE7F0"/><bgColor indexed="64"/></patternFill></fill>');
    const border = add('borders', '<border><left/><right/><top/><bottom style="thin"><color rgb="FF7F9DB9"/></bottom><diagonal/></border>');
    const xf = add('cellXfs', `<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>`);
    parts['xl/styles.xml'] = enc.encode(sty);
    metas.forEach((m, i) => {
      const key = `xl/worksheets/sheet${i + 1}.xml`;
      if (!m || !parts[key]) return;
      let x = dec.decode(parts[key]);
      for (const r of m.bold) x = x.replace(new RegExp(`(<row r="${r}"[^>/]*>)([\\s\\S]*?</row>)`), (s, open, rest) => open + rest.replace(/<c r="([A-Z]+\d+)"(?: s="\d+")?/g, `<c r="$1" s="${xf}"`));
      if (m.freeze) {
        const [cx, ry] = m.freeze, tl = window.XLSX.utils.encode_cell({ r: ry, c: cx });
        const pane = cx && ry ? 'bottomRight' : ry ? 'bottomLeft' : 'topRight';
        x = x.replace('<sheetView workbookViewId="0"/>', `<sheetView workbookViewId="0"><pane${cx ? ` xSplit="${cx}"` : ''}${ry ? ` ySplit="${ry}"` : ''} topLeftCell="${tl}" activePane="${pane}" state="frozen"/><selection pane="${pane}" activeCell="${tl}" sqref="${tl}"/></sheetView>`);
      }
      parts[key] = enc.encode(x);
    });
    const files = [];
    for (const [name, data] of Object.entries(parts)) files.push({ name, data, z: await deflate(data) });
    return new Blob([TT.zip(files)], { type: XLSX_MIME });
  }

  /* ------------------------------ GIS features ------------------------------ */
  TT.collectFeatures = function (records, { pii = false, ctx = {} } = {}) {
    const feats = [];
    const pt = (g) => ({ type: 'Point', coordinates: [r6(g.lon), r6(g.lat), ...(g.alt != null ? [g.alt] : [])] });
    const ok = (g) => g && Number.isFinite(g.lat) && Number.isFinite(g.lon);
    for (const rec of records) {
      const form = TT.FORMS[rec.form];
      if (!form) continue;
      const v = rec.data;
      const base = { record_id: rec.id, lake: v.lake || '', form: form.short, form_title: TT.Ls(form.title, 'en'), group: form.group, status: rec.status, summary: safeSummary(form, v), updated: TT.fmt(rec.updated) };
      for (const f of form.fields) {
        if (!TT.visible(f, v) || (f.pii && !pii)) continue;
        if (f.type === 'gps' && ok(v[f.id])) {
          const g = v[f.id];
          const props = { ...base, kind: f.id === form.geo ? 'record' : 'point', field: f.id, question: TT.Ls(f.q, 'en'), acc_m: g.acc ?? '' };
          if (f.id === form.geo) Object.assign(props, TT.flatten(form, rec, { pii, ctx }).row);
          feats.push({ type: 'Feature', properties: props, geometry: pt(g) });
        }
        if (f.type === 'track' && Array.isArray(v[f.id])) {
          const c = v[f.id].filter(ok).map((g) => [r6(g.lon), r6(g.lat)]);
          const closed = TT.TRACK_CLOSED.includes(v.kind) && c.length >= 3;
          if (c.length >= 2) feats.push({ type: 'Feature', properties: { ...base, kind: 'track', track_kind: v.kind || '', name: v.name || '', points: c.length, length_m: v.length ?? '', area_m2: closed ? v.area ?? '' : '' },
            geometry: closed ? { type: 'Polygon', coordinates: [[...c, c[0]]] } : { type: 'LineString', coordinates: c } });
        }
        if (f.type === 'table' && Array.isArray(v[f.id]) && f.columns.some((c) => c.type === 'gps')) {
          const rows = v[f.id];
          const comp = TT.tableComputed(f, rows, v, ctx);
          tableRows(form, { field: f, rows, comp }, rec.id, pii).forEach((o, i) => {
            const gc = f.columns.find((c) => c.type === 'gps');
            const g = rows[i] && rows[i][gc.id];
            if (ok(g)) feats.push({ type: 'Feature', properties: { ...base, kind: 'table_point', table: f.id, ...o }, geometry: pt(g) });
          });
        }
      }
      const line = (a, b, kind) => { if (ok(v[a]) && ok(v[b])) feats.push({ type: 'Feature', properties: { ...base, kind }, geometry: { type: 'LineString', coordinates: [[r6(v[a].lon), r6(v[a].lat)], [r6(v[b].lon), r6(v[b].lat)]] } }); };
      if (rec.form === 'bath') line('start_pt', 'end_pt', 'transect');
      if (rec.form === 'feat' && v.ftype === 'catch') line('loc', 'end_pt', 'runoff_path');
    }
    return feats;
  };

  TT.toGeoJSON = (feats) => new Blob([JSON.stringify({ type: 'FeatureCollection', name: 'gulmi_lakes_field_data', features: feats }, null, 1)], { type: 'application/geo+json' });

  const xml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const KML_COL = { community: 'ff3b8bd9', engineering: 'ff1f9a63', table_point: 'ffd7a01b', line: 'ff00a5ff' };
  TT.toKML = function (feats) {
    const byForm = {};
    feats.forEach((f) => (byForm[f.properties.form] = byForm[f.properties.form] || []).push(f));
    const style = (id, col, scale) => `<Style id="${id}"><IconStyle><color>${col}</color><scale>${scale}</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LineStyle><color>${col}</color><width>3</width></LineStyle><PolyStyle><color>40${col.slice(2)}</color></PolyStyle></Style>`;
    const desc = (p) => Object.entries(p).filter(([k, x]) => x !== '' && x != null && !/_utm44N_|_alt_m$/.test(k)).slice(0, 80).map(([k, x]) => `${xml(k)}: ${xml(x)}`).join('<br/>');
    const pm = (f) => {
      const p = f.properties;
      const name = p.kind === 'table_point' ? `${p.record_id} #${p.row}${p.depth_m != null ? ' ' + p.depth_m + ' m' : ''}` : p.kind === 'point' ? `${p.record_id} ${p.field}` : `${p.record_id} ${p.summary || ''}`;
      const sid = p.kind === 'table_point' ? 'table_point' : f.geometry.type === 'Point' ? p.group : 'line';
      const ring = (cs) => cs.map((c) => c.join(',')).join(' ');
      const geom = f.geometry.type === 'Point'
        ? `<Point><coordinates>${f.geometry.coordinates.slice(0, 2).join(',')}</coordinates></Point>`
        : f.geometry.type === 'Polygon'
          ? `<Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${ring(f.geometry.coordinates[0])}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
          : `<LineString><tessellate>1</tessellate><coordinates>${ring(f.geometry.coordinates)}</coordinates></LineString>`;
      return `<Placemark><name>${xml(name.trim())}</name><styleUrl>#${sid}</styleUrl><description><![CDATA[${desc(p)}]]></description>${geom}</Placemark>`;
    };
    const body = Object.entries(byForm).map(([form, fs]) => `<Folder><name>${xml(form)} — ${xml(fs[0].properties.form_title)}</name>${fs.map(pm).join('')}</Folder>`).join('');
    const doc = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Timure and Chhekmi lakes field data ${TT.today()}</name>` +
      Object.entries(KML_COL).map(([k, c]) => style(k, c, k === 'table_point' ? 0.6 : 1)).join('') +
      TT.LAKE_IDS.map((id) => [id, TT.lakeCentre(id)]).filter(([, c]) => c).map(([id, c]) => `<Placemark><name>${xml(TT.lakeName(id))} centre</name><Point><coordinates>${c.lon},${c.lat}</coordinates></Point></Placemark>`).join('') +
      `${body}</Document></kml>`;
    return new Blob([doc], { type: 'application/vnd.google-earth.kml+xml' });
  };

  /* ------------------------------ ZIP (store or deflate; read store or deflate) ------------------------------ */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
    return t;
  })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const dos = (d) => ({ time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() });
  // Raw deflate where the browser has CompressionStream('deflate-raw'); null = store the entry.
  const deflate = async (data) => {
    try { return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); } catch (e) { return null; }
  };

  // files: [{ name, data, z? }] where z is the raw-deflated data.
  TT.zip = function (files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const now = dos(new Date());
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = f.data;
      const packed = f.z && f.z.length < data.length ? f.z : data, method = packed === data ? 0 : 8;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
      lh.setUint16(10, now.time, true); lh.setUint16(12, now.date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, packed.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, packed);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
      ch.setUint16(12, now.time, true); ch.setUint16(14, now.date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, packed.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + packed.length;
    }
    const size = central.reduce((s, c) => s + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  };

  TT.unzip = async function (blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a ZIP file');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const out = {};
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('corrupt ZIP directory');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const raw = buf.subarray(start, start + csize);
      if (method === 0) out[name] = raw;
      else if (method === 8 && 'DecompressionStream' in window) out[name] = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      p += 46 + nlen + xlen + clen;
    }
    return out;
  };

  /* ------------------------------ export entry points ------------------------------ */
  async function gather(filter) {
    const [records, photos] = await Promise.all([TT.db.all('records'), TT.db.all('photos')]);
    const recs = records.filter((r) => TT.FORMS[r.form] && (!filter || filter(r))).sort((a, b) => a.created.localeCompare(b.created));
    const keep = new Set(recs.map((r) => r.id));
    return { records: recs, photos: photos.filter((p) => keep.has(p.record)).sort((a, b) => a.id.localeCompare(b.id)), all: records };
  }
  const fname = async (kind, ext) => `Lakes_${kind}_${await TT.deviceCode()}_${TT.stamp()}.${ext}`;
  async function makeCtx(all) {
    return { settings: await TT.loadSettings(), records: all, device: await TT.deviceCode() };
  }

  TT.exportXlsx = async ({ pii = false, filter } = {}) => {
    const g = await gather(filter);
    const blob = await TT.buildWorkbook({ ...g, pii, ctx: await makeCtx(g.all) });
    TT.download(blob, await fname('data', 'xlsx'));
    return g.records.length;
  };
  TT.exportGeo = async (kind, { pii = false, filter } = {}) => {
    const g = await gather(filter);
    const feats = TT.collectFeatures(g.records, { pii, ctx: await makeCtx(g.all) });
    TT.download(kind === 'kml' ? TT.toKML(feats) : TT.toGeoJSON(feats), await fname('points', kind === 'kml' ? 'kml' : 'geojson'));
    return feats.length;
  };
  TT.exportJson = async () => {
    const g = await gather();
    const body = await backupBody(g, await makeCtx(g.all), true);
    TT.download(new Blob([JSON.stringify(body, null, 1)], { type: 'application/json' }), await fname('backup', 'json'));
    await markExported();
    return { records: g.records.length, photos: g.photos.length };
  };

  const toB64 = (blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => { const s = String(fr.result); res(s.slice(s.indexOf(',') + 1)); };
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
  const fromB64 = (s) => {
    try { const bin = atob(s), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; } catch (e) { return null; }
  };
  // data.json / JSON backup: lakes, forms and counts up front; records grouped by lake, form and date. embed = photos as base64 JPEG.
  async function backupBody(g, ctx, embed) {
    const counts = {};
    for (const r of g.records) {
      const lake = TT.lakeName(r.data.lake) || 'No lake', form = TT.FORMS[r.form].short;
      counts[lake] = counts[lake] || {};
      counts[lake][form] = (counts[lake][form] || 0) + 1;
    }
    const photos = [];
    for (const { blob, ...m } of g.photos) photos.push(embed && blob ? { ...m, jpeg_base64: await toB64(blob) } : m);
    return {
      app: TT.APP, version: TT.VERSION, exported: new Date().toISOString(), device: ctx.device,
      lakes: TT.LAKE_IDS.map((id) => ({ id, code: TT.lakeCode(id), name: TT.lakeName(id), centre: TT.lakeCentre(id) })),
      forms: TT.FORM_ORDER.map((id) => ({ id, code: TT.FORMS[id].short, title: TT.Ls(TT.FORMS[id].title, 'en') })),
      counts, records: TT.sortRecords(g.records), photos,
    };
  }
  async function markExported() {
    const s = TT.settings || (await TT.loadSettings());
    s.lastExport = new Date().toISOString();
    await TT.saveSettings(s);
  }

  // Complete field package: raw data (incl. personal data) + photos + Excel + GIS. Re-importable for merging.
  TT.exportPackage = async () => {
    const g = await gather();
    const ctx = await makeCtx(g.all);
    const enc = new TextEncoder();
    const body = await backupBody(g, ctx, false);
    const feats = TT.collectFeatures(g.records, { pii: false, ctx });
    const files = [
      { name: 'data.json', data: enc.encode(JSON.stringify(body, null, 1)) },
      { name: 'Lakes_survey_data.xlsx', data: new Uint8Array(await (await TT.buildWorkbook({ ...g, pii: true, ctx })).arrayBuffer()) },
      { name: 'gis/lakes_points.geojson', data: new Uint8Array(await TT.toGeoJSON(feats).arrayBuffer()) },
      { name: 'gis/lakes_points.kml', data: new Uint8Array(await TT.toKML(feats).arrayBuffer()) },
      { name: 'README.txt', data: enc.encode([
        'Timure Taal and Chhekmi Taal field data package (lake codes TT and CK)',
        `Exported ${body.exported} from device ${ctx.device}; ${g.records.length} records, ${g.photos.length} photos.`,
        'CONFIDENTIAL: data.json and the Excel file include respondent names/phones where given. Share only within the study team.',
        'data.json + photos/ can be merged into another phone or laptop: open the portal > Data > Import JSON or ZIP (or import this ZIP directly).',
        'gis/: WGS84 points (GeoJSON for QGIS, KML for Google Earth); personal identifiers removed.',
      ].join('\r\n')) },
    ];
    for (const p of g.photos) files.push({ name: `photos/${p.id}.jpg`, data: new Uint8Array(await p.blob.arrayBuffer()) });
    for (const f of files) if (!/\.(jpg|xlsx)$/.test(f.name)) f.z = await deflate(f.data);
    TT.download(TT.zip(files), await fname('package', 'zip'));
    await markExported();
    return { records: g.records.length, photos: g.photos.length };
  };

  /* ------------------------------ import & merge ------------------------------ */
  TT.importFile = async function (file) {
    let body, zipFiles = null;
    if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
      zipFiles = await TT.unzip(file);
      if (!zipFiles['data.json']) throw new Error('data.json not found in the ZIP');
      body = JSON.parse(new TextDecoder().decode(zipFiles['data.json']));
    } else body = JSON.parse(await file.text());
    if (!body || body.app !== TT.APP || !Array.isArray(body.records)) throw new Error('This is not an export from this field portal');

    const local = new Map((await TT.db.all('records')).map((r) => [r.id, r]));
    const res = { added: 0, updated: 0, skipped: 0, unknown: 0, photos: 0 };
    const put = [];
    for (const r of body.records) {
      if (!r || typeof r.id !== 'string' || typeof r.form !== 'string' || typeof r.data !== 'object' || r.data === null) { res.skipped++; continue; }
      if (!TT.FORMS[r.form]) { res.unknown++; continue; }
      const clean = { id: r.id, uuid: r.uuid || TT.uuid(), form: r.form, formVersion: r.formVersion || 1, status: r.status === 'complete' ? 'complete' : 'draft',
        created: String(r.created || new Date().toISOString()), updated: String(r.updated || r.created || new Date().toISOString()),
        device: String(r.device || ''), enumerator: String(r.enumerator || ''), data: r.data };
      TT.renameTeam(clean);
      const cur = local.get(r.id);
      if (!cur) { put.push(clean); res.added++; }
      else if (Date.parse(clean.updated) > Date.parse(cur.updated)) { put.push(clean); res.updated++; }
      else res.skipped++;
    }
    if (put.length) await TT.db.putMany('records', put);
    if (Array.isArray(body.photos)) {
      const have = new Set((await TT.db.all('photos')).map((p) => p.id));
      const newPhotos = [];
      for (const m of body.photos) {
        if (!m || typeof m.id !== 'string' || have.has(m.id) || !/^P-[A-Z0-9]{2}-\d+$/.test(m.id)) continue;
        const bytes = zipFiles ? zipFiles[`photos/${m.id}.jpg`] : typeof m.jpeg_base64 === 'string' ? fromB64(m.jpeg_base64) : null;
        if (!bytes || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) continue;
        newPhotos.push({ id: m.id, record: String(m.record || ''), form: String(m.form || ''), field: String(m.field || ''), w: m.w, h: m.h, t: m.t, gps: m.gps || null, name: String(m.name || ''), size: bytes.length, caption: String(m.caption || ''), blob: new Blob([bytes], { type: 'image/jpeg' }) });
      }
      if (newPhotos.length) await TT.db.putMany('photos', newPhotos);
      res.photos = newPhotos.length;
    }
    return res;
  };
})();
