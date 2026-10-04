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
  function addSheet(wb, used, title, rows, header) {
    const XLSX = window.XLSX;
    const ws = header ? XLSX.utils.json_to_sheet(rows, { header }) : XLSX.utils.json_to_sheet(rows);
    const keys = header || (rows[0] ? Object.keys(rows[0]) : []);
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(48, Math.max(10, String(k).length + 2)) }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName(title, used));
  }

  function headerFor(form, pii) {
    const cols = ['record_id', 'form', 'status', 'created', 'updated', 'enumerator', 'device', 'summary'];
    for (const f of form.fields) {
      if (f.type === 'info' || (f.pii && !pii)) continue;
      const key = colKey(f);
      if (f.type === 'gps') cols.push(...Object.keys(gpsCols(key, null)));
      else if (f.type === 'grid') f.rows.forEach((r) => f.cols.forEach((c) => cols.push(`${key}.${r.v}${f.cols.length > 1 ? '.' + c.v : ''}`)));
      else if (f.type === 'rank') { cols.push(key); for (let i = 0; i < (f.max || 3); i++) cols.push(`${key}_${i + 1}`); }
      else if (f.type === 'table') cols.push(key + '_rows');
      else cols.push(key);
      if (f.other) cols.push(key + '_other');
      if (f.evidence) cols.push(key + '_source');
    }
    cols.push('notes');
    return cols;
  }

  function codebook(pii) {
    const out = [];
    for (const id of TT.FORM_ORDER) {
      const form = TT.FORMS[id];
      for (const f of form.fields) {
        if (f.type === 'info' || (f.pii && !pii)) continue;
        out.push({
          form: form.short, column: colKey(f), type: f.type, report_ref: f.ref ? 'R' + f.ref : '',
          question: TT.Ls(f.q, 'en'),
          asked_when: TT.whenText(form, f) || (f.section._dep ? TT.whenText(form, f.section) : ''),
          unit: f.unit || '', options: (f.options || f.scale || []).map((o) => `${o.v}=${TT.Ls(o, 'en')}`).join('; '),
          personal_data: f.pii ? 'yes' : '',
        });
      }
    }
    return out;
  }

  TT.buildWorkbook = async function ({ records, photos, pii = false, ctx }) {
    await TT.loadScript(XLSX_SRC);
    const XLSX = window.XLSX;
    const wb = XLSX.utils.book_new();
    const used = new Set();
    const byForm = {};
    records.forEach((r) => (byForm[r.form] = byForm[r.form] || []).push(r));
    const readme = [
      { item: 'Project', value: 'Timure Taal and Chhekmi Taal — preliminary engineering investigation of declining water levels (Gulmi)' },
      ...TT.LAKE_IDS.map((id) => { const c = TT.lakeCentre(id); return { item: `${TT.lakeName(id)} (${TT.lakeCode(id)}) centre`, value: c ? `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}` : 'not set' }; }),
      { item: 'Exported', value: new Date().toISOString() },
      { item: 'Device code', value: ctx.device },
      { item: 'Records', value: records.length },
      { item: 'Personal identifiers included', value: pii ? 'YES — handle as confidential' : 'No (names/phones removed)' },
      { item: 'Coordinates', value: 'WGS84 lat/lon + UTM zone 44N (EPSG:32644) metres, as used in the QGIS catchment work' },
      { item: 'Column names', value: '<question no.>_<field id>; see Codebook. Skipped (not applicable) questions are blank. *_source = how the respondent knows (seen / heard).' },
      ...TT.FORM_ORDER.filter((id) => byForm[id]).map((id) => ({ item: TT.FORMS[id].short + ' records', value: byForm[id].length })),
    ];
    addSheet(wb, used, 'README', readme);
    addSheet(wb, used, 'All records', records.map((r) => {
      const form = TT.FORMS[r.form];
      const g = form && form.geo ? r.data[form.geo] : null;
      return { record_id: r.id, lake: TT.lakeName(r.data.lake), form: form ? form.short : r.form, title: form ? TT.Ls(form.title, 'en') : '', status: r.status, created: TT.fmt(r.created), updated: TT.fmt(r.updated), enumerator: r.enumerator || '', summary: form ? safeSummary(form, r.data) : '', ...gpsCols('gps', g) };
    }));
    for (const id of TT.FORM_ORDER) {
      const recs = byForm[id];
      if (!recs) continue;
      const form = TT.FORMS[id];
      const flat = recs.map((r) => TT.flatten(form, r, { pii, ctx }));
      addSheet(wb, used, `${form.short} ${TT.Ls(form.title, 'en')}`, flat.map((x) => x.row), headerFor(form, pii));
      const tabs = {};
      flat.forEach((x, i) => x.tables.forEach((t) => (tabs[t.field.id] = tabs[t.field.id] || { field: t.field, rows: [] }).rows.push(...tableRows(form, t, recs[i].id, pii))));
      Object.values(tabs).forEach((t) => addSheet(wb, used, `${form.short} ${t.field.id}`, t.rows));
    }
    const wl = TT.analysis ? TT.analysis.waterLevel(records, ctx) : [];
    if (wl.length) addSheet(wb, used, 'WL series (derived)', wl.map((p) => ({ record_id: p.id, gauge: p.gauge, datetime: TT.fmt(p.t), reading_m: p.reading, wsl_rl_m: p.wsl ?? '', rain_since: p.rain, interval_h: p.dtH ?? '', fall_mm_per_day: p.rate ?? '', screening_flag: p.flag || '' })));
    if (photos.length) addSheet(wb, used, 'Photos', photos.map((p) => ({ photo_id: p.id, record_id: p.record, form: p.form, field: p.field, caption: p.caption || '', logged: TT.fmt(p.t), lat: p.gps ? r6(p.gps.lat) : '', lon: p.gps ? r6(p.gps.lon) : '', acc_m: p.gps ? p.gps.acc : '', width: p.w, height: p.h, size_kb: Math.round((p.size || 0) / 1024) })));
    addSheet(wb, used, 'Codebook', codebook(pii));
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

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
    const style = (id, col, scale) => `<Style id="${id}"><IconStyle><color>${col}</color><scale>${scale}</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LineStyle><color>${col}</color><width>3</width></LineStyle></Style>`;
    const desc = (p) => Object.entries(p).filter(([k, x]) => x !== '' && x != null && !/_utm44N_|_alt_m$/.test(k)).slice(0, 80).map(([k, x]) => `${xml(k)}: ${xml(x)}`).join('<br/>');
    const pm = (f) => {
      const p = f.properties;
      const name = p.kind === 'table_point' ? `${p.record_id} #${p.row}${p.depth_m != null ? ' ' + p.depth_m + ' m' : ''}` : p.kind === 'point' ? `${p.record_id} ${p.field}` : `${p.record_id} ${p.summary || ''}`;
      const sid = p.kind === 'table_point' ? 'table_point' : f.geometry.type === 'LineString' ? 'line' : p.group;
      const geom = f.geometry.type === 'Point'
        ? `<Point><coordinates>${f.geometry.coordinates.slice(0, 2).join(',')}</coordinates></Point>`
        : `<LineString><tessellate>1</tessellate><coordinates>${f.geometry.coordinates.map((c) => c.join(',')).join(' ')}</coordinates></LineString>`;
      return `<Placemark><name>${xml(name.trim())}</name><styleUrl>#${sid}</styleUrl><description><![CDATA[${desc(p)}]]></description>${geom}</Placemark>`;
    };
    const body = Object.entries(byForm).map(([form, fs]) => `<Folder><name>${xml(form)} — ${xml(fs[0].properties.form_title)}</name>${fs.map(pm).join('')}</Folder>`).join('');
    const doc = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Timure and Chhekmi lakes field data ${TT.today()}</name>` +
      Object.entries(KML_COL).map(([k, c]) => style(k, c, k === 'table_point' ? 0.6 : 1)).join('') +
      TT.LAKE_IDS.map((id) => [id, TT.lakeCentre(id)]).filter(([, c]) => c).map(([id, c]) => `<Placemark><name>${xml(TT.lakeName(id))} centre</name><Point><coordinates>${c.lon},${c.lat}</coordinates></Point></Placemark>`).join('') +
      `${body}</Document></kml>`;
    return new Blob([doc], { type: 'application/vnd.google-earth.kml+xml' });
  };

  /* ------------------------------ ZIP (store; read store or deflate) ------------------------------ */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
    return t;
  })();
  const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const dos = (d) => ({ time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() });

  TT.zip = function (files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const now = dos(new Date());
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, now.time, true); lh.setUint16(12, now.date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, now.time, true); ch.setUint16(14, now.date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
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
    const body = { app: TT.APP, version: TT.VERSION, exported: new Date().toISOString(), device: await TT.deviceCode(), records: g.records, photos: g.photos.map(({ blob, ...m }) => m) };
    TT.download(new Blob([JSON.stringify(body)], { type: 'application/json' }), await fname('backup', 'json'));
    return g.records.length;
  };

  // Complete field package: raw data (incl. personal data) + photos + Excel + GIS. Re-importable for merging.
  TT.exportPackage = async () => {
    const g = await gather();
    const ctx = await makeCtx(g.all);
    const enc = new TextEncoder();
    const body = { app: TT.APP, version: TT.VERSION, exported: new Date().toISOString(), device: ctx.device, records: g.records, photos: g.photos.map(({ blob, ...m }) => m) };
    const feats = TT.collectFeatures(g.records, { pii: false, ctx });
    const files = [
      { name: 'data.json', data: enc.encode(JSON.stringify(body)) },
      { name: 'Lakes_survey_data.xlsx', data: new Uint8Array(await (await TT.buildWorkbook({ ...g, pii: true, ctx })).arrayBuffer()) },
      { name: 'gis/lakes_points.geojson', data: new Uint8Array(await TT.toGeoJSON(feats).arrayBuffer()) },
      { name: 'gis/lakes_points.kml', data: new Uint8Array(await TT.toKML(feats).arrayBuffer()) },
      { name: 'README.txt', data: enc.encode([
        'Timure Taal and Chhekmi Taal field data package (lake codes TT and CK)',
        `Exported ${body.exported} from device ${ctx.device}; ${g.records.length} records, ${g.photos.length} photos.`,
        'CONFIDENTIAL: data.json and the Excel file include respondent names/phones where given. Share only within the study team.',
        'data.json + photos/ can be merged into another phone or laptop: open the portal > Data > Import.',
        'gis/: WGS84 points (GeoJSON for QGIS, KML for Google Earth); personal identifiers removed.',
      ].join('\r\n')) },
    ];
    for (const p of g.photos) files.push({ name: `photos/${p.id}.jpg`, data: new Uint8Array(await p.blob.arrayBuffer()) });
    TT.download(TT.zip(files), await fname('package', 'zip'));
    const s = await TT.loadSettings();
    s.lastExport = new Date().toISOString();
    await TT.saveSettings(s);
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
      const cur = local.get(r.id);
      if (!cur) { put.push(clean); res.added++; }
      else if (Date.parse(clean.updated) > Date.parse(cur.updated)) { put.push(clean); res.updated++; }
      else res.skipped++;
    }
    if (put.length) await TT.db.putMany('records', put);
    if (zipFiles && Array.isArray(body.photos)) {
      const have = new Set((await TT.db.all('photos')).map((p) => p.id));
      const newPhotos = [];
      for (const m of body.photos) {
        if (!m || typeof m.id !== 'string' || have.has(m.id) || !/^P-[A-Z0-9]{2}-\d+$/.test(m.id)) continue;
        const bytes = zipFiles[`photos/${m.id}.jpg`];
        if (!bytes) continue;
        newPhotos.push({ id: m.id, record: String(m.record || ''), form: String(m.form || ''), field: String(m.field || ''), w: m.w, h: m.h, t: m.t, gps: m.gps || null, name: String(m.name || ''), size: bytes.length, caption: String(m.caption || ''), blob: new Blob([bytes], { type: 'image/jpeg' }) });
      }
      if (newPhotos.length) await TT.db.putMany('photos', newPhotos);
      res.photos = newPhotos.length;
    }
    return res;
  };
})();
