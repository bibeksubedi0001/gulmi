/* Lakes field portal (Timure & Chhekmi): app shell, routing and views. */
'use strict';
(function () {
  const TT = window.TT;
  const { h, L, icon } = TT;
  const S = { settings: null, device: null, open: null, carry: null, installEvt: null, cleanup: null };

  const NAV = [['', 'home', 'Home'], ['community', 'users', 'Community'], ['engineering', 'tool', 'Engineering'], ['map', 'map', 'Map'], ['records', 'list', 'Records'],
    ['photos', 'image', 'Photos'], ['dashboard', 'chart', 'Dashboard'], ['guide', 'book', 'Guide'], ['data', 'sliders', 'Data']];

  // Fields copied into the next record by "Complete + new" (the lake is always carried).
  const CARRY = {
    hh: ['enum', 'settlement'], kii: ['enum'], wl: ['gauge', 'observer'], bath: ['surveyor', 'gauge'], soil: ['zone', 'depth', 'collected_by'],
    feat: ['surveyor', 'ftype'], inf: ['surveyor', 'method', 'd_inner'], q: ['surveyor'], bm: [], day: ['team'], hyp: ['assessor'], trk: ['surveyor', 'kind'],
  };
  const lakeOf = (r) => r.data.lake || '';
  const forLake = (all, lake) => (lake && lake !== 'all' ? all.filter((r) => lakeOf(r) === lake || lakeOf(r) === 'both') : all);
  const activeName = () => TT.lakeName(S.settings.activeLake) || 'no lake selected';

  /* ---------------- chrome ---------------- */
  function buildChrome() {
    document.getElementById('nav').replaceChildren(...NAV.map(([p, ic, label]) => h('a.nav-a', { href: '#/' + p, dataset: { p } }, icon(ic), h('span', { text: label }))));
    const sel = h('select.lake-sel', { 'aria-label': 'Active lake', title: 'New records are tagged with this lake' },
      ...TT.O.lake.map((o) => h('option', { value: o.v, text: o.en })));
    sel.value = S.settings.activeLake || 'chhekmi';
    sel.addEventListener('change', async () => {
      S.settings.activeLake = sel.value;
      await TT.saveSettings(S.settings);
      TT.toast(`Active lake: ${activeName()}`);
      if (!S.open) route();
    });
    document.getElementById('lakesel').replaceChildren(h('span.lake-lbl', { text: 'Lake' }), sel);
    const themeBtn = document.getElementById('theme');
    const paintTheme = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
      themeBtn.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
      themeBtn.setAttribute('aria-pressed', String(dark));
    };
    themeBtn.addEventListener('click', () => {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = t;
      try { localStorage.setItem('tt-theme', t); } catch (e) { /* storage blocked: theme lasts for this page only */ }
      paintTheme();
    });
    paintTheme();
  }
  const markNav = (p) => document.querySelectorAll('.nav-a').forEach((a) => a.classList.toggle('on', a.dataset.p === p));

  /* ---------------- persistence ---------------- */
  async function requestPersist() {
    try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { /* not supported */ }
  }

  async function saveRecord(o) {
    const d = o.rec.data;
    o.rec.updated = new Date().toISOString();
    o.rec.enumerator = ['enum', 'surveyor', 'observer', 'collected_by', 'assessor', 'team'].map((k) => TT.personText(d, k)).find(Boolean) || o.rec.enumerator || S.settings.enumerator || '';
    await TT.db.put('records', o.rec);
    if (!o.saved) {
      o.saved = true;
      // Only rewrite the URL while this form is still the active view (not during navigation away).
      if (S.open === o && location.hash.startsWith('#/new/')) history.replaceState(null, '', '#/edit/' + encodeURIComponent(o.rec.id));
      requestPersist();
    }
    if (o.onSaved) o.onSaved();
  }

  async function flush() {
    const o = S.open;
    if (!o || !o.dirty) return;
    o.dirty = false;
    try { await saveRecord(o); } catch (e) { TT.toast('Save failed: ' + e.message, 'bad', 8000); }
  }

  async function newRecord(form, all, carry) {
    let seq, id;
    do {
      seq = await TT.db.nextSeq(form.id);
      id = `${form.short}-${S.device}-${TT.pad(seq, 3)}`;
    } while (await TT.db.get('records', id));
    const now = new Date();
    const rec = { id, uuid: TT.uuid(), form: form.id, formVersion: form.version, status: 'draft', created: now.toISOString(), updated: now.toISOString(), device: S.device, enumerator: S.settings.enumerator || '', data: {} };
    Object.defineProperty(rec, '_seq', { value: seq, enumerable: false });
    const ctx = { settings: S.settings, records: all, record: rec };
    for (const f of form.fields) {
      if (f.default !== undefined) {
        const v = typeof f.default === 'function' ? f.default(ctx) : f.default;
        if (v !== '' && v != null) rec.data[f.id] = v;
      } else if (f.now) rec.data[f.id] = f.type === 'date' ? TT.today(now) : f.type === 'time' ? TT.hhmm(now) : TT.localInput(now);
    }
    if (carry) Object.assign(rec.data, carry);
    if (form.onNew) form.onNew(rec.data, ctx);
    return rec;
  }

  // Used by the Map page: open an unsaved new record with some answers filled in, or create and save one.
  TT.openNew = (formId, data) => { S.carry = data; location.hash = '#/new/' + formId; };
  TT.createRecord = async (formId, data) => {
    const rec = await newRecord(TT.FORMS[formId], await TT.db.all('records'), data);
    await saveRecord({ rec, saved: false });
    return rec;
  };

  /* ---------------- router ---------------- */
  async function route() {
    const [path, query] = (location.hash || '#/').slice(1).split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(query || '');
    const prev = S.open;
    S.open = null;
    if (prev) {
      if (prev.dirty) { prev.dirty = false; try { await saveRecord(prev); } catch (e) { TT.toast('Save failed: ' + e.message, 'bad', 8000); } }
      if (prev.api) prev.api.destroy();
      // Give back the record number of a form that was opened but never used.
      const reused = parts[0] === 'new' && parts[1] === prev.form.id;
      if (!prev.saved && !reused && prev.rec._seq) await TT.db.releaseSeq(prev.form.id, prev.rec._seq);
    }
    const root = document.getElementById('view');
    if (S.cleanup) { try { S.cleanup(); } catch (e) { console.error(e); } S.cleanup = null; }
    root.classList.toggle('wide', parts[0] === 'map');
    markNav(parts[0] || '');
    window.scrollTo(0, 0);
    try {
      switch (parts[0] || '') {
        case '': return await homeView(root);
        case 'community': return await hubView(root, 'community');
        case 'engineering': return await hubView(root, 'engineering');
        case 'map': S.cleanup = await TT.renderMap(root, { settings: S.settings, records: await TT.db.all('records') }, params); return;
        case 'new': return await formView(root, parts[1], null, prev);
        case 'edit': return await formView(root, null, parts[1], prev);
        case 'records': return await recordsView(root, params);
        case 'photos': return await photosView(root, params);
        case 'dashboard': return await TT.renderDashboard(root, { settings: S.settings, device: S.device, records: await TT.db.all('records') });
        case 'guide': return TT.renderGuide(root);
        case 'print': return await printView(root, parts[1], null);
        case 'printrec': return await printView(root, null, parts[1]);
        case 'data': return await dataView(root);
        default: root.replaceChildren(h('div.card', h('p', { text: 'Page not found.' }), h('a.btn', { href: '#/', text: 'Home' })));
      }
    } catch (e) {
      console.error(e);
      root.replaceChildren(h('div.card', h('h2', { text: 'Something went wrong' }), h('pre.err', { text: String((e && e.stack) || e) })));
    }
  }

  /* ---------------- home ---------------- */
  async function homeView(root) {
    const all = await TT.db.all('records');
    const drafts = all.filter((r) => r.status === 'draft').length;
    const last = S.settings.lastExport ? new Date(S.settings.lastExport) : null;
    const stale = all.length && (!last || Date.now() - last > 24 * 3600 * 1000);
    const lakeRow = (id) => {
      const c = TT.lakeCentre(id);
      return h('tr', h('td', h('b', { text: TT.lakeName(id) })), h('td', { text: c ? `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}` : 'Not set' }),
        h('td', { text: String(all.filter((r) => lakeOf(r) === id).length) }));
    };
    root.replaceChildren(
      h('section.hero', h('h1', { text: 'Timure & Chhekmi lakes' }), h('p', { text: `Active lake: ${activeName()}` })),
      h('div.big-cards',
        h('a.big-card.com', { href: '#/community' }, icon('users'), h('h2', { text: 'Community' })),
        h('a.big-card.eng', { href: '#/engineering' }, icon('tool'), h('h2', { text: 'Engineering' }))),
      h('section.card', h('h3', { text: 'Quick start' }),
        h('div.quick', ...[['day', 'calendar', 'Field day checklist'], ['wl', 'wave', 'Read lake level'], ['feat', 'pin', 'Log a feature'],
          ['bath', 'anchor', 'Depth transect'], ['soil', 'layers', 'Soil sample'], ['hh', 'users', 'Household interview']]
          .map(([id, ic, label]) => h('a.quick-a', { href: '#/new/' + id }, icon(ic), h('span', { text: label }))))),
      h('section.card', h('h3', { text: 'Lakes' }),
        h('div.tbl-scroll', h('table.tbl.compact', h('thead', h('tr', ...['Lake', 'Centre', 'Records'].map((x) => h('th', { text: x })))),
          h('tbody', ...TT.LAKE_IDS.map(lakeRow))))),
      h('section.card.status' + (stale ? '.warn' : ''),
        h('h3', { text: 'This device' }),
        h('p', { text: `${all.length} records · ${drafts} drafts · last export ${last ? TT.fmt(last.toISOString()) : 'never'}` }),
        stale ? h('p.warn-t', icon('alert'), h('span', { text: 'Not exported in the last 24 hours' })) : null,
        h('div.btn-row',
          h('button.btn', { type: 'button', onclick: async (e) => { const b = e.currentTarget; b.disabled = true; try { const r = await TT.exportPackage(); TT.toast(`Package saved: ${r.records} records, ${r.photos} photos`); route(); } catch (err) { TT.toast('Export failed: ' + err.message, 'bad'); } b.disabled = false; } }, icon('download'), 'Export field package'),
          !S.settings.enumerator ? h('a.btn.ghost', { href: '#/data' }, icon('edit'), 'Choose enumerator') : null,
          S.installEvt ? h('button.btn.ghost', { type: 'button', onclick: () => { S.installEvt.prompt(); S.installEvt = null; } }, icon('download'), 'Install as app') : null)));
  }

  /* ---------------- hubs ---------------- */
  function formCard(f, all) {
    const recs = forLake(all, S.settings.activeLake).filter((r) => r.form === f.id);
    const done = recs.filter((r) => r.status === 'complete').length;
    return h('article.form-card',
      h('div.fc-top', icon(f.icon || 'file'), h('span.fc-short', { text: f.short }), h('span.fc-count', { text: `${done}/${f.target || '—'} ${f.targetLabel || ''}` })),
      h('h3', L(f.title)),
      h('div.btn-row',
        h('a.btn', { href: '#/new/' + f.id }, icon('plus'), 'New'),
        h('a.btn.ghost', { href: '#/records?form=' + f.id }, icon('list'), `Records (${recs.length})`),
        h('a.icon-btn', { href: '#/print/' + f.id, title: 'Print blank form', 'aria-label': 'Print blank form' }, icon('printer'))));
  }

  async function hubView(root, group) {
    const all = await TT.db.all('records');
    const forms = TT.FORM_ORDER.map((id) => TT.FORMS[id]).filter((f) => f.group === group);
    const head = h('div.page-head', h('h1', { text: group === 'community' ? 'Community ' : 'Engineering ' }, h('span.lake-tag', { text: activeName() })));
    root.replaceChildren(head, h('div.cards', ...forms.map((f) => formCard(f, all))));
  }

  /* ---------------- form ---------------- */
  async function formView(root, formId, recId, prev) {
    let rec = null;
    if (recId) {
      rec = prev && prev.rec.id === recId ? prev.rec : await TT.db.get('records', recId);
      if (!rec) { root.replaceChildren(h('div.card', h('p', { text: `Record ${recId} is not on this device.` }), h('a.btn', { href: '#/records', text: 'Records' }))); return; }
      formId = rec.form;
    }
    const form = TT.FORMS[formId];
    if (!form) { root.replaceChildren(h('div.card', h('p', { text: 'This form is no longer used.' }), h('a.btn', { href: '#/records', text: 'Records' }))); return; }
    const all = await TT.db.all('records');
    if (!rec) {
      if (prev && prev.form.id === formId && !prev.saved) rec = prev.rec;
      else { rec = await newRecord(form, all, S.carry); S.carry = null; }
    }
    const o = { rec, form, saved: !!(await TT.db.get('records', rec.id)), dirty: false, api: null };
    const ctx = { settings: S.settings, records: all, record: rec, device: S.device };

    const status = h('span.chip-status');
    const lakeTag = h('span.lake-tag');
    const savedLbl = h('span.saved-lbl', { text: o.saved ? '' : 'not saved yet' });
    const pbar = h('i');
    const pct = h('span.pct');
    const secNav = h('nav.sec-nav');
    const paintStatus = () => {
      status.textContent = rec.status;
      status.className = 'chip-status ' + rec.status;
      lakeTag.textContent = TT.lakeName(rec.data.lake) || 'lake not set';
    };
    paintStatus();
    const back = form.group === 'community' ? '#/community' : '#/engineering';

    const del = async () => {
      if (!(await TT.confirm(`Delete ${rec.id}?`, { ok: 'Delete', danger: true, detail: 'Its photos on this device are deleted too. This cannot be undone.' }))) return;
      o.dirty = false;
      S.open = null;
      await TT.db.deleteRecord(rec.id);
      TT.toast(`${rec.id} deleted`);
      location.hash = '#/records';
    };
    const complete = async (andNew) => {
      const errs = o.api.validate();
      if (errs.length) {
        TT.toast(`${errs.length} required answer(s) missing`, 'bad');
        errs[0].wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      rec.status = 'complete';
      o.dirty = false;
      await saveRecord(o);
      TT.toast(`${rec.id} saved as complete`);
      if (andNew) {
        S.carry = { lake: rec.data.lake };
        (CARRY[form.id] || []).forEach((k) => {
          if (rec.data[k] == null || rec.data[k] === '') return;
          S.carry[k] = rec.data[k];
          if (rec.data[k + '__other']) S.carry[k + '__other'] = rec.data[k + '__other'];
        });
        location.hash = '#/new/' + form.id;
      } else location.hash = back;
    };

    root.replaceChildren(
      h('div.form-head',
        h('div.fh-row',
          h('a.icon-btn', { href: back, title: 'Back' }, icon('back')),
          h('div.fh-title', h('div.fh-form', L(form.title)), h('div.fh-id', h('b', { text: rec.id }), lakeTag, status, savedLbl)),
          h('div.fh-actions',
            h('a.icon-btn', { href: '#/printrec/' + encodeURIComponent(rec.id), title: 'Print / save as PDF' }, icon('printer')),
            h('button.icon-btn', { type: 'button', title: 'Delete record', onclick: del }, icon('trash')))),
        h('div.fh-prog', h('div.prog-bar', pbar), pct),
        secNav),
      h('div.form-body'),
      h('div.form-foot',
        h('button.btn.ghost', { type: 'button', onclick: async () => { o.dirty = false; await saveRecord(o); TT.toast('Draft saved'); } }, icon('save'), 'Save draft'),
        h('button.btn', { type: 'button', onclick: () => complete(false) }, icon('check'), 'Complete'),
        h('button.btn.ghost', { type: 'button', onclick: () => complete(true) }, icon('plus'), 'Complete + new')));

    const chips = [];
    const autosave = TT.debounce(() => flush(), 900);
    o.onSaved = () => { savedLbl.textContent = 'saved ' + TT.hhmm(); paintStatus(); };
    o.api = TT.renderForm(root.querySelector('.form-body'), form, rec, ctx, {
      onChange: (fid) => { o.dirty = true; savedLbl.textContent = 'editing…'; if (fid === 'lake') paintStatus(); autosave(); },
      onProgress: (p, secs) => {
        pbar.style.width = p.pct + '%';
        pct.textContent = `${p.ans}/${p.tot}`;
        secs.forEach((sx, i) => {
          const c = chips[i];
          if (!c) return;
          const pp = p.per.get(sx.sec) || [0, 0];
          c.hidden = sx.el.hidden;
          c.lastChild.textContent = `${pp[1]}/${pp[0]}`;
          c.classList.toggle('done', pp[0] > 0 && pp[1] === pp[0]);
        });
      },
    });
    if (o.api.secs.length > 1) {
      o.api.secs.forEach((sx) => chips.push(h('button.sec-chip', { type: 'button', title: TT.Ls(sx.sec.title), onclick: () => sx.el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, h('b', { text: sx.sec.id }), h('small'))));
      secNav.replaceChildren(...chips);
    } else secNav.remove();
    o.api.refresh();
    S.open = o;
  }

  /* ---------------- records ---------------- */
  async function recordsView(root, params) {
    const all = (await TT.db.all('records')).filter((r) => TT.FORMS[r.form]).sort((a, b) => b.updated.localeCompare(a.updated));
    const opt = (id) => h('option', { value: id, text: `${TT.FORMS[id].short} — ${TT.Ls(TT.FORMS[id].title)}` });
    const fsel = h('select.inp', h('option', { value: '', text: 'All forms' }),
      h('optgroup', { label: 'Community' }, ...TT.FORM_ORDER.filter((id) => TT.FORMS[id].group === 'community').map(opt)),
      h('optgroup', { label: 'Engineering' }, ...TT.FORM_ORDER.filter((id) => TT.FORMS[id].group === 'engineering').map(opt)));
    fsel.value = params.get('form') || '';
    const lsel = h('select.inp', h('option', { value: 'all', text: 'Both lakes' }), ...TT.O.lake.map((o) => h('option', { value: o.v, text: o.en })));
    lsel.value = S.settings.activeLake || 'all';
    const ssel = h('select.inp', h('option', { value: '', text: 'Any status' }), h('option', { value: 'draft', text: 'Draft' }), h('option', { value: 'complete', text: 'Complete' }));
    const q = h('input.inp', { type: 'search', placeholder: 'Search ID, summary, enumerator…' });
    const list = h('div.rec-list');
    const countLbl = h('span.muted');
    const summary = (r) => { try { return TT.FORMS[r.form].summary(r.data) || ''; } catch (e) { return ''; } };
    const match = (r) => (!fsel.value || r.form === fsel.value) && (lsel.value === 'all' || lakeOf(r) === lsel.value || lakeOf(r) === 'both') &&
      (!ssel.value || r.status === ssel.value) && (!q.value || `${r.id} ${r.enumerator} ${summary(r)}`.toLowerCase().includes(q.value.toLowerCase()));
    function paint() {
      const rows = all.filter(match);
      countLbl.textContent = `${rows.length} of ${all.length}`;
      list.replaceChildren(...(rows.length ? rows.map((r) => {
        const f = TT.FORMS[r.form];
        return h('div.rec-row',
          h('span.badge.' + f.group, { text: f.short }),
          h('span.badge', { text: TT.lakeCode(lakeOf(r)) || '—', title: TT.lakeName(lakeOf(r)) }),
          h('a.rec-main', { href: '#/edit/' + encodeURIComponent(r.id) }, h('b', { text: r.id }), h('span', { text: summary(r) }), h('small.muted', { text: `${TT.fmt(r.updated)}${r.enumerator ? ' · ' + r.enumerator : ''}` })),
          h('span.chip-status.' + r.status, { text: r.status }),
          h('a.icon-btn', { href: '#/printrec/' + encodeURIComponent(r.id), title: 'Print' }, icon('printer')),
          h('button.icon-btn', { type: 'button', title: 'Delete', onclick: async () => {
            if (!(await TT.confirm(`Delete ${r.id}?`, { ok: 'Delete', danger: true, detail: 'Its photos on this device are deleted too.' }))) return;
            await TT.db.deleteRecord(r.id);
            all.splice(all.indexOf(r), 1);
            paint();
          } }, icon('trash')));
      }) : [h('p.muted', { text: 'No records match.' })]));
    }
    [fsel, lsel, ssel].forEach((x) => x.addEventListener('change', () => { history.replaceState(null, '', '#/records' + (fsel.value ? '?form=' + fsel.value : '')); paint(); }));
    q.addEventListener('input', paint);
    const busy = (fn) => async (e) => { const b = e.currentTarget; b.disabled = true; try { await fn(); } catch (err) { TT.toast(err.message, 'bad'); } b.disabled = false; };
    root.replaceChildren(
      h('div.page-head', h('h1', { text: 'Records' }), countLbl),
      h('div.filters', fsel, lsel, ssel, q),
      h('div.btn-row',
        fsel.value ? h('a.btn', { href: '#/new/' + fsel.value }, icon('plus'), 'New ' + TT.FORMS[fsel.value].short) : null,
        h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportXlsx({ filter: match }); TT.toast(`Excel: ${n} records (no personal identifiers)`); }) }, icon('download'), 'Excel of this list'),
        h('a.btn.ghost', { href: '#/data' }, icon('sliders'), 'All exports & import')),
      list);
    paint();
  }

  /* ---------------- photos ---------------- */
  const thumbs = new Map(); // photo id -> small JPEG URL, kept while the app is open
  async function thumbUrl(p) {
    if (!thumbs.has(p.id)) {
      let url = null;
      try {
        const bmp = await createImageBitmap(p.blob);
        const s = Math.min(1, 360 / bmp.width), cv = document.createElement('canvas');
        cv.width = Math.round(bmp.width * s);
        cv.height = Math.round(bmp.height * s);
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        if (bmp.close) bmp.close();
        const small = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.75));
        if (small) url = URL.createObjectURL(small);
      } catch (e) { /* no bitmap support: show the photo itself */ }
      thumbs.set(p.id, url || URL.createObjectURL(p.blob));
    }
    return thumbs.get(p.id);
  }

  async function photosView(root, params) {
    const [photos, records] = await Promise.all([TT.db.all('photos'), TT.db.all('records')]);
    const recs = new Map(records.map((r) => [r.id, r]));
    const byId = new Map(photos.map((p) => [p.id, p]));
    const lakeOfP = (p) => (recs.has(p.record) ? lakeOf(recs.get(p.record)) : '');
    const rank = (l) => { const k = TT.LAKE_IDS.indexOf(l); return k < 0 ? TT.LAKE_IDS.length : k; };
    const time = (p) => Date.parse(p.t) || 0;
    const lsel = h('select.inp', { 'aria-label': 'Lake' }, h('option', { value: 'all', text: 'Both lakes' }), ...TT.O.lake.map((o) => h('option', { value: o.v, text: o.en })));
    lsel.value = TT.LAKES[params.get('lake')] ? params.get('lake') : 'all';
    const fsel = h('select.inp', { 'aria-label': 'Form' }, h('option', { value: '', text: 'All forms' }),
      ...TT.FORM_ORDER.filter((id) => photos.some((p) => p.form === id)).map((id) => h('option', { value: id, text: `${TT.FORMS[id].short} — ${TT.Ls(TT.FORMS[id].title)}` })));
    const osel = h('select.inp', { 'aria-label': 'Order' }, h('option', { value: 'new', text: 'Newest' }), h('option', { value: 'old', text: 'Oldest' }));
    const countLbl = h('span.muted');
    const body = h('div');
    const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      seen.unobserve(e.target);
      thumbUrl(byId.get(e.target.dataset.id)).then((u) => { e.target.src = u; });
    }), { rootMargin: '400px 0px' });
    S.cleanup = () => seen.disconnect();
    function tile(p, shown) {
      const img = h('img', { alt: p.id, dataset: { id: p.id } });
      seen.observe(img);
      const f = TT.FORMS[p.form];
      return h('figure.g-tile',
        h('button.g-img', { type: 'button', title: p.caption || p.id, 'aria-label': 'View ' + p.id, onclick: () => TT.viewPhoto(p, shown, { records: recs, open: true }) }, img),
        h('figcaption', h('b', { text: p.id }), h('span.muted', { text: TT.hhmm(new Date(p.t)) }),
          h('a', { href: '#/edit/' + encodeURIComponent(p.record), text: `${f ? f.short + ' ' : ''}${p.record}` }),
          p.caption ? h('small', { text: p.caption }) : ''));
    }
    function paint() {
      seen.disconnect();
      const dir = osel.value === 'old' ? 1 : -1;
      const shown = photos.filter((p) => (!fsel.value || p.form === fsel.value) && (lsel.value === 'all' || lakeOfP(p) === lsel.value || lakeOfP(p) === 'both'))
        .sort((a, b) => rank(lakeOfP(a)) - rank(lakeOfP(b)) || dir * (time(a) - time(b)) || a.id.localeCompare(b.id));
      countLbl.textContent = `${shown.length} of ${photos.length}`;
      const groups = [];
      for (const p of shown) {
        const lake = lakeOfP(p), day = TT.today(new Date(p.t)), last = groups[groups.length - 1];
        if (last && last.lake === lake && last.day === day) last.items.push(p);
        else groups.push({ lake, day, items: [p] });
      }
      body.replaceChildren(...(groups.length ? groups.map((g) => h('section.g-day',
        h('h3', h('span', { text: TT.lakeName(g.lake) || 'No lake' }), h('span', { text: g.day }), h('small.muted', { text: `${g.items.length} photo${g.items.length > 1 ? 's' : ''}` })),
        h('div.gallery-grid', ...g.items.map((p) => tile(p, shown)))))
        : [h('p.muted', { text: photos.length ? 'No photos match.' : 'No photos yet. Photos taken in any form appear here.' })]));
    }
    [lsel, fsel, osel].forEach((x) => x.addEventListener('change', () => { history.replaceState(null, '', '#/photos' + (lsel.value !== 'all' ? '?lake=' + lsel.value : '')); paint(); }));
    root.replaceChildren(h('div.page-head', h('h1', { text: 'Photos' }), countLbl), h('div.filters.three', lsel, fsel, osel), body);
    paint();
  }

  /* ---------------- print ---------------- */
  async function printView(root, formId, recId) {
    let rec = null;
    if (recId) {
      rec = await TT.db.get('records', recId);
      if (!rec) { root.replaceChildren(h('p', { text: 'Record not found.' })); return; }
      formId = rec.form;
    }
    const form = TT.FORMS[formId];
    if (!form) { root.replaceChildren(h('p', { text: 'Unknown form.' })); return; }
    const ctx = { settings: S.settings, records: await TT.db.all('records'), record: rec };
    root.replaceChildren(
      h('div.print-bar',
        h('a.btn.ghost', { href: rec ? '#/edit/' + encodeURIComponent(rec.id) : form.group === 'community' ? '#/community' : '#/engineering' }, icon('back'), 'Back'),
        h('button.btn', { type: 'button', onclick: () => window.print() }, icon('printer'), 'Print / save as PDF')),
      TT.printDoc(form, rec, ctx));
  }

  /* ---------------- data & settings ---------------- */
  async function dataView(root) {
    const [records, photos] = await Promise.all([TT.db.all('records'), TT.db.all('photos')]);
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const st = S.settings;
    const busy = (fn) => async (e) => { const b = e.currentTarget; b.disabled = true; try { await fn(); } catch (err) { console.error(err); TT.toast(err.message, 'bad', 7000); } b.disabled = false; };
    const fEnum = h('select.inp', h('option', { value: '', text: '— Select —' }), ...TT.TEAM.map((n) => h('option', { value: n, text: n })));
    fEnum.value = TT.TEAM.includes(st.enumerator) ? st.enumerator : '';
    const team = Array.isArray(st.team) ? st.team : [];
    const teamBoxes = TT.TEAM.map((n) => h('input', { type: 'checkbox', value: n, checked: team.includes(n) }));
    const fEvap = h('input.inp', { type: 'number', inputMode: 'decimal', value: st.evap ?? 4 });
    const fTol = h('input.inp', { type: 'number', inputMode: 'decimal', value: st.evapTol ?? 2 });
    const pii = h('input', { type: 'checkbox' });
    const fileIn = h('input', { type: 'file', accept: '.zip,.json,application/zip,application/json', hidden: true, onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const r = await TT.importFile(file);
        TT.toast(`Imported: ${r.added} new, ${r.updated} updated, ${r.skipped} unchanged, ${r.photos} photos${r.unknown ? `, ${r.unknown} from retired forms skipped` : ''}`, 'ok', 7000);
        route();
      } catch (err) { TT.toast('Import failed: ' + err.message, 'bad', 7000); }
    } });

    const centreRow = (id) => {
      const c = TT.lakeCentre(id);
      const out = h('span', { text: c ? `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}${c.custom && c.acc ? ` (±${Math.round(c.acc)} m)` : ''}` : 'Not set' });
      const setBtn = h('button.btn.sm', { type: 'button', onclick: (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        out.textContent = 'Averaging GPS for up to 30 s…';
        TT.watchFix({ average: true, maxWait: 30000, onDone: async (fix, err) => {
          b.disabled = false;
          if (!fix) { out.textContent = err; return; }
          st.lakeCentres = { ...(st.lakeCentres || {}), [id]: { lat: fix.lat, lon: fix.lon, acc: fix.acc, t: new Date().toISOString() } };
          await TT.saveSettings(st);
          TT.toast(`${TT.lakeName(id)} centre set`);
          route();
        } });
      } }, icon('crosshair'), 'Set from my GPS position');
      return h('div.kv', h('span', h('b', { text: TT.lakeName(id) }), ' ', out), setBtn);
    };
    const mb = (x) => (x / 1048576).toFixed(1) + ' MB';
    root.replaceChildren(
      h('div.page-head', h('h1', { text: 'Data & settings' })),
      h('section.card',
        h('h3', { text: 'Team' }),
        h('label.lbl', { text: 'Enumerator on this phone' }), fEnum,
        h('label.lbl', { text: 'Team working today' }), h('div.opts.many', ...TT.TEAM.map((n, i) => h('label.opt', teamBoxes[i], h('span', { text: n })))),
        h('label.lbl', { text: 'Evaporation (mm/day)' }), fEvap,
        h('label.lbl', { text: 'Flag tolerance (mm/day)' }), fTol,
        h('div.btn-row', h('button.btn', { type: 'button', onclick: async () => {
          st.enumerator = fEnum.value;
          st.team = teamBoxes.filter((b) => b.checked).map((b) => b.value);
          st.evap = TT.num(fEvap.value) ?? 4;
          st.evapTol = TT.num(fTol.value) ?? 2;
          await TT.saveSettings(st);
          TT.toast('Settings saved');
        } }, icon('save'), 'Save settings'))),
      h('section.card',
        h('h3', { text: 'Lake centres' }),
        ...TT.LAKE_IDS.map(centreRow)),
      h('section.card',
        h('h3', { text: 'Export' }),
        h('div.btn-row',
          h('button.btn', { type: 'button', onclick: busy(async () => { const r = await TT.exportPackage(); TT.toast(`Package: ${r.records} records, ${r.photos} photos`); }) }, icon('archive'), 'Field package (.zip)'),
          h('button.btn', { type: 'button', onclick: busy(async () => { const r = await TT.exportJson(); TT.toast(`JSON: ${r.records} records, ${r.photos} photos`); }) }, icon('download'), 'JSON (.json)')),
        h('label.check', pii, h('span', { text: 'Include names and phone numbers' })),
        h('div.btn-row',
          h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportXlsx({ pii: pii.checked }); TT.toast(`Excel: ${n} records`); }) }, icon('download'), 'Excel (.xlsx)'),
          h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportGeo('geojson', { pii: pii.checked }); TT.toast(`GeoJSON: ${n} features`); }) }, icon('map'), 'GeoJSON (QGIS)'),
          h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportGeo('kml', { pii: pii.checked }); TT.toast(`KML: ${n} features`); }) }, icon('map'), 'KML (Google Earth)'))),
      h('section.card',
        h('h3', { text: 'Import & merge' }),
        fileIn,
        h('div.btn-row', h('button.btn', { type: 'button', onclick: () => fileIn.click() }, icon('upload'), 'Import JSON or ZIP'))),
      h('section.card',
        h('h3', { text: 'This device' }),
        h('div.kv', h('span', { text: 'Device code (part of record IDs)' }), h('b', { text: S.device })),
        h('div.kv', h('span', { text: 'Records / photos' }), h('b', { text: `${records.length} / ${photos.length}` })),
        est && h('div.kv', h('span', { text: 'Storage used / available' }), h('b', { text: `${mb(est.usage || 0)} / ${mb(est.quota || 0)}` })),
        h('div.kv', h('span', { text: 'Persistent storage' }), h('b', { text: persisted ? 'granted' : 'not granted' })),
        !persisted && h('div.btn-row', h('button.btn.ghost', { type: 'button', onclick: async () => { await requestPersist(); route(); } }, icon('check'), 'Request persistent storage')),
        h('div.kv', h('span', { text: 'App version' }), h('b', { text: TT.VERSION }))),
      h('section.card.danger-zone',
        h('h3', { text: 'Danger zone' }),
        h('button.btn.danger', { type: 'button', onclick: async () => {
          if (!(await TT.confirm('Delete ALL records and photos on this device?', { ok: 'Continue', danger: true }))) return;
          if (prompt('Type DELETE to confirm') !== 'DELETE') { TT.toast('Cancelled'); return; }
          await TT.db.clearAll();
          TT.toast('All data deleted from this device');
          route();
        } }, icon('trash'), 'Delete all data on this device')));
  }

  /* ---------------- service worker ---------------- */
  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloading) return; reloading = true; location.reload(); });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const offer = (w) => {
        if (document.querySelector('.update-bar')) return;
        document.body.append(h('div.update-bar', h('span', { text: 'A new version of the portal is ready.' }),
          h('button.btn.sm', { type: 'button', onclick: async () => { await flush(); w.postMessage('skipWaiting'); } }, 'Update now')));
      };
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
      });
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => {});
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    try {
      S.settings = await TT.loadSettings();
      S.device = await TT.deviceCode();
    } catch (e) {
      document.getElementById('view').replaceChildren(h('div.card', h('h2', { text: 'Storage is not available' }),
        h('p', { text: 'This browser blocked local storage (private mode?). Open the portal in a normal Chrome, Edge, Firefox or Safari window.' })));
      return;
    }
    if (!Array.isArray(S.settings.team)) S.settings.team = [];
    if (!TT.LAKES[S.settings.activeLake]) S.settings.activeLake = 'chhekmi';
    // Devices set up on Timure move to Chhekmi once; choosing a lake in the header afterwards sticks.
    if (S.settings.defaultLake !== 'chhekmi') {
      S.settings.activeLake = S.settings.defaultLake = 'chhekmi';
      TT.saveSettings(S.settings).catch((e) => console.error(e));
    }
    if (S.settings.enumerator === 'Amrit') S.settings.enumerator = 'Ankit';
    S.settings.team = S.settings.team.map((n) => (n === 'Amrit' ? 'Ankit' : n));
    TT.settings = S.settings;
    try {
      const renamed = (await TT.db.all('records')).filter(TT.renameTeam);
      if (renamed.length) await TT.db.putMany('records', renamed);
    } catch (e) { console.error(e); }
    buildChrome();
    window.addEventListener('hashchange', route);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', () => { flush(); });
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); S.installEvt = e; });
    registerSW();
    route();
  }
  boot();
})();
