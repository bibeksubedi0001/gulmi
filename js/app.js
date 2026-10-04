/* Timure Taal field portal: app shell, routing and views. */
'use strict';
(function () {
  const TT = window.TT;
  const { h, L, icon } = TT;
  const t = (ne, en) => ({ ne, en });
  const S = { settings: null, device: null, open: null, carry: null, installEvt: null };

  const NAV = [
    ['', 'home', t('गृहपृष्ठ', 'Home')],
    ['community', 'users', t('समुदाय', 'Community')],
    ['engineering', 'tool', t('इन्जिनियरिङ', 'Engineering')],
    ['records', 'list', t('रेकर्ड', 'Records')],
    ['dashboard', 'chart', t('ड्यासबोर्ड', 'Dashboard')],
    ['guide', 'book', t('निर्देशिका', 'Guide')],
    ['data', 'sliders', t('डाटा', 'Data')],
  ];

  // Fields copied into the next record by "Complete + new".
  const CARRY = {
    hh: ['enum', 'ward', 'settlement'], kii: ['enum'], ev: ['enum'], fgd: ['enum'],
    wl: ['gauge', 'observer'], bath: ['surveyor', 'gauge', 'method', 'craft', 'orient'], soil: ['surveyor', 'zone', 'collected_by'],
    feat: ['surveyor'], lin: ['surveyor', 'material'], seep: ['surveyor', 'lake_temp', 'lake_ec', 'lake_ph'], q: ['surveyor'],
    wq: ['surveyor', 'instrument', 'calib'], inf: ['surveyor', 'method', 'd_inner', 'd_outer'], sm: ['surveyor', 'dia', 'factor'],
    catch: ['surveyor'], pl: ['surveyor'], hist: ['logged_by'], lev: ['surveyor', 'instrument'],
  };

  /* ---------------- chrome ---------------- */
  function setLang(l) {
    document.body.dataset.lang = l;
    document.body.classList.remove('lang-ne', 'lang-en', 'lang-both');
    document.body.classList.add('lang-' + l);
  }

  function buildChrome() {
    const nav = document.getElementById('nav');
    nav.replaceChildren(...NAV.map(([p, ic, label]) => h('a.nav-a', { href: '#/' + p, dataset: { p } }, icon(ic), h('span', L(label)))));
    const langBox = document.getElementById('lang');
    const opts = [['ne', 'ने'], ['both', 'ने+EN'], ['en', 'EN']];
    langBox.replaceChildren(...opts.map(([l, txt]) => h('button.lang-btn', { type: 'button', dataset: { l }, text: txt, title: 'Language', onclick: async () => {
      S.settings.lang = l;
      await TT.saveSettings(S.settings);
      setLang(l);
      paintLang();
      route();
    } })));
    paintLang();
  }
  const paintLang = () => document.querySelectorAll('.lang-btn').forEach((b) => b.classList.toggle('on', b.dataset.l === S.settings.lang));
  const markNav = (p) => document.querySelectorAll('.nav-a').forEach((a) => a.classList.toggle('on', a.dataset.p === p));

  /* ---------------- persistence helpers ---------------- */
  async function requestPersist() {
    try { if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { /* not supported */ }
  }

  async function saveRecord(o) {
    const d = o.rec.data;
    o.rec.updated = new Date().toISOString();
    o.rec.enumerator = d.enum || d.surveyor || d.logged_by || d.assessor || o.rec.enumerator || S.settings.enumerator || '';
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
    if (form.id === 'soil' && rec.data.zone) rec.data.sample_id = TT.nextSampleId(ctx, rec.data.zone);
    return rec;
  }

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
    markNav(parts[0] || '');
    document.body.classList.toggle('print-mode', parts[0] === 'print' || parts[0] === 'printrec');
    window.scrollTo(0, 0);
    try {
      switch (parts[0] || '') {
        case '': return await homeView(root);
        case 'community': return await hubView(root, 'community');
        case 'engineering': return await hubView(root, 'engineering');
        case 'new': return await formView(root, parts[1], null, prev);
        case 'edit': return await formView(root, null, parts[1], prev);
        case 'records': return await recordsView(root, params);
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
    const fact = (k, v) => h('div.fact', h('b', { text: v }), h('span', L(k)));
    root.replaceChildren(
      h('section.hero',
        h('p.eyebrow', { text: 'Preliminary engineering investigation · Chandrakot RM-4, Remi, Gulmi' }),
        h('h1', L(t('टिमुरे ताल फिल्ड अनुसन्धान पोर्टल', 'Timure Taal field investigation portal'))),
        h('p.lead', L(t('टिमुरे तालको पानीको सतह किन घट्दैछ भन्ने प्रश्नको उत्तर प्रमाणका आधारमा खोज्न समुदाय सर्वेक्षण र इन्जिनियरिङ मापनका लागि अफलाइन फिल्ड पोर्टल।',
          'Offline field portal for the community survey and the engineering measurements that will test why the lake’s water level is declining — evidence first, causes second.'))),
        h('div.facts',
          fact(t('डिजिटाइज्ड क्षेत्रफल', 'digitised water area'), '3,638 m²'),
          fact(t('DEM जलाधार', 'DEM catchment'), '13.87 ha'),
          fact(t('जलाधार : ताल', 'catchment : lake'), '38 : 1'),
          fact(t('उचाइ', 'elevation'), '≈ 1,952–1,956 m'),
          fact(t('परीक्षण गर्नुपर्ने परिकल्पना', 'hypotheses to test'), 'H1–H8'))),
      h('div.big-cards',
        h('a.big-card.com', { href: '#/community' }, icon('users'), h('div',
          h('h2', L(t('समुदाय प्रश्नावली', 'Community questionnaire'))),
          h('p', L(t('घरधुरी सर्वेक्षण (६५ मूल प्रश्नसहित), मुख्य सूचनादाता, समूह छलफल र पुराना फोटो/कागजात दर्ता — नेपाली र अंग्रेजीमा।', 'Household survey (all 65 report questions and more), key informants, focus groups and an old-photo/document register — in Nepali and English.'))))),
        h('a.big-card.eng', { href: '#/engineering' }, icon('tool'), h('div',
          h('h2', L(t('इन्जिनियरिङ सर्वेक्षण पोर्टल', 'Engineering survey portal'))),
          h('p', L(t('बेन्चमार्क, पानीको सतह, लेभलिङ, बाथिमेट्री, निकास, lining, चुहावट, माटो, इन्फिल्ट्रेसन, बहाव र परिकल्पना-प्रमाण म्याट्रिक्स।', 'Benchmark & gauge, lake levels, levelling, bathymetry, drainage, lining, seepage, soils, infiltration, flows and the hypothesis–evidence matrix.')))))),
      h('section.card',
        h('h3', L(t('छिटो सुरु गर्नुहोस्', 'Quick start'))),
        h('div.quick',
          ...[['hh', 'users', t('नयाँ घरधुरी अन्तर्वार्ता', 'New household interview')], ['wl', 'wave', t('तालको सतह पढ्नुहोस्', 'Read lake level')], ['feat', 'pin', t('फिचर दर्ता', 'Log a feature')],
            ['bath', 'anchor', t('गहिराइ ट्रान्सेक्ट', 'Depth transect')], ['soil', 'layers', t('माटो नमुना', 'Soil sample')], ['day', 'calendar', t('दैनिक लग', 'Daily log')]]
            .map(([id, ic, label]) => h('a.quick-a', { href: '#/new/' + id }, icon(ic), h('span', L(label)))),
          h('a.quick-a', { href: '#/dashboard' }, icon('chart'), h('span', L(t('ड्यासबोर्ड', 'Dashboard')))),
          h('a.quick-a', { href: '#/guide' }, icon('book'), h('span', L(t('फिल्ड निर्देशिका', 'Field guide')))))),
      h('section.card.status' + (stale ? '.warn' : ''),
        h('h3', L(t('यो उपकरणमा डाटा', 'Data on this device'))),
        h('p', { text: `${all.length} records (${drafts} draft) · device code ${S.device}${S.settings.enumerator ? ' · ' + S.settings.enumerator : ''}` }),
        h('p', { text: last ? `Last field package exported ${TT.fmt(last.toISOString())}.` : 'No field package exported yet from this device.' }),
        stale ? h('p.warn-t', icon('alert'), h('span', { text: 'Export a field package (ZIP) today and copy it off the phone — browser storage can be cleared.' })) : null,
        h('div.btn-row',
          h('button.btn', { type: 'button', onclick: async (e) => { e.target.disabled = true; try { const r = await TT.exportPackage(); TT.toast(`Package saved: ${r.records} records, ${r.photos} photos`); route(); } catch (err) { TT.toast('Export failed: ' + err.message, 'bad'); } e.target.disabled = false; } }, icon('download'), 'Export field package'),
          !S.settings.enumerator ? h('a.btn.ghost', { href: '#/data' }, icon('edit'), 'Set enumerator name') : null,
          S.installEvt ? h('button.btn.ghost', { type: 'button', onclick: async () => { S.installEvt.prompt(); S.installEvt = null; } }, icon('download'), 'Install as app') : null)),
      h('section.card',
        h('h3', L(t('यो पोर्टलले कसरी काम गर्छ', 'How this portal works'))),
        h('ul.how',
          h('li', L(t('इन्टरनेट नभए पनि चल्छ। पहिलो पटक खोलेपछि फोनमा राखिन्छ।', 'Works without signal once opened. Use “Add to Home screen” to install it like an app.'))),
          h('li', L(t('सबै डाटा यही फोनमा मात्र बस्छ; केही पनि आफैँ अपलोड हुँदैन।', 'All data stays on this phone — nothing is uploaded automatically.'))),
          h('li', L(t('हरेक साँझ ZIP प्याकेज निर्यात गर्नुहोस्; टोली प्रमुखले सबै फोनको ZIP एउटै उपकरणमा Import गरेर मिलाउनुहोस्।', 'Every evening export a ZIP package; the team lead imports all phones’ ZIPs into one device to merge.'))),
          h('li', L(t('कागजी ब्याकअपका लागि हरेक फारम छाप्न सकिन्छ।', 'Every form can be printed blank as a paper backup.'))))));
  }

  /* ---------------- hubs ---------------- */
  function formCard(f, all) {
    const recs = all.filter((r) => r.form === f.id);
    const done = recs.filter((r) => r.status === 'complete').length;
    return h('article.form-card',
      h('div.fc-top', icon(f.icon || 'file'), h('span.fc-short', { text: f.short }), h('span.fc-count', { text: `${done}/${f.target || '—'} ${f.targetLabel || ''}` })),
      h('h3', L(f.title)),
      f.purpose && h('p.fc-purpose', L(f.purpose)),
      h('div.btn-row',
        h('a.btn', { href: '#/new/' + f.id }, icon('plus'), 'New'),
        h('a.btn.ghost', { href: '#/records?form=' + f.id }, icon('list'), `Records (${recs.length})`),
        h('a.btn.ghost', { href: '#/print/' + f.id, title: 'Blank printable form' }, icon('printer'), 'Print')));
  }

  async function hubView(root, group) {
    const all = await TT.db.all('records');
    const forms = TT.FORM_ORDER.map((id) => TT.FORMS[id]).filter((f) => f.group === group);
    if (group === 'community') {
      const hh = all.filter((r) => r.form === 'hh');
      const women = hh.filter((r) => r.data.gender === 'f').length;
      const lt = hh.filter((r) => r.data.born_here === 'yes' || TT.num(r.data.years_here) >= 15).length;
      root.replaceChildren(
        h('div.page-head', h('h1', L(t('समुदाय सर्वेक्षण', 'Community survey'))),
          h('p.muted', L(t('गाउँलेहरूसँग तटस्थ, संरचित अन्तर्वार्ता — तालको इतिहास र पानी घटेको समयरेखा पुनर्निर्माण गर्न।', 'Neutral, structured interviews with villagers to reconstruct the lake’s history and the timeline of decline.')))),
        h('div.callout', icon('info'), h('div',
          h('b', L(t('नमुना सन्तुलन: ', 'Sample balance: '))),
          `${hh.length} household interviews · ${women} women · ${lt} long-term residents (≥ 15 years). Aim for 30–40 interviews, at least one third women, every settlement around the lake. `,
          h('a', { href: '#/guide', text: 'Survey design →' }))),
        h('div.cards', ...forms.map((f) => formCard(f, all))));
      return;
    }
    root.replaceChildren(
      h('div.page-head', h('h1', L(t('इन्जिनियरिङ सर्वेक्षण पोर्टल', 'Engineering survey portal'))),
        h('p.muted', { text: 'Field measurements for the 4–5 day programme. Forms compute RLs, discharges, infiltration rates and seepage flux on the spot and work offline.' })),
      ...TT.PHASES.map((ph) => h('section.phase', h('h2', { text: ph.en }, h('small', { text: ' · ' + ph.note })),
        h('div.cards', ...forms.filter((f) => f.phase === ph.id).map((f) => formCard(f, all))))));
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
    if (!form) { root.replaceChildren(h('div.card', h('p', { text: 'Unknown form.' }))); return; }
    const all = await TT.db.all('records');
    if (!rec) {
      if (prev && prev.form.id === formId && !prev.saved) rec = prev.rec;
      else { rec = await newRecord(form, all, S.carry); S.carry = null; }
    }
    const o = { rec, form, saved: !!(await TT.db.get('records', rec.id)), dirty: false, api: null };
    const ctx = { settings: S.settings, records: all, record: rec, device: S.device };

    const status = h('span.chip-status');
    const savedLbl = h('span.saved-lbl', { text: o.saved ? '' : 'not saved yet' });
    const pbar = h('i');
    const pct = h('span.pct');
    const secNav = h('nav.sec-nav');
    const paintStatus = () => { status.textContent = rec.status; status.className = 'chip-status ' + rec.status; };
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
      if (form.fieldMap.end && !rec.data.end && TT.visible(form.fieldMap.end, rec.data)) rec.data.end = TT.localInput();
      rec.status = 'complete';
      o.dirty = false;
      await saveRecord(o);
      TT.toast(`${rec.id} saved as complete`);
      if (andNew) {
        S.carry = {};
        (CARRY[form.id] || []).forEach((k) => { if (rec.data[k] != null && rec.data[k] !== '') S.carry[k] = rec.data[k]; });
        location.hash = '#/new/' + form.id;
      } else location.hash = back;
    };

    root.replaceChildren(
      h('div.form-head',
        h('div.fh-row',
          h('a.icon-btn', { href: back, title: 'Back' }, icon('back')),
          h('div.fh-title', h('div.fh-form', L(form.title)), h('div.fh-id', h('b', { text: rec.id }), status, savedLbl)),
          h('div.fh-actions',
            h('a.icon-btn', { href: '#/printrec/' + encodeURIComponent(rec.id), title: 'Print / save as PDF' }, icon('printer')),
            h('button.icon-btn', { type: 'button', title: 'Delete record', onclick: del }, icon('trash')))),
        h('div.fh-prog', h('div.prog-bar', pbar), pct),
        secNav),
      form.purpose ? h('p.form-purpose', L(form.purpose)) : '',
      h('div.form-body'),
      h('div.form-foot',
        h('button.btn.ghost', { type: 'button', onclick: async () => { o.dirty = false; await saveRecord(o); TT.toast('Draft saved'); } }, icon('save'), 'Save draft'),
        h('button.btn', { type: 'button', onclick: () => complete(false) }, icon('check'), 'Complete'),
        h('button.btn.ghost', { type: 'button', onclick: () => complete(true) }, icon('plus'), 'Complete + new')));

    const chips = [];
    const autosave = TT.debounce(() => flush(), 900);
    o.onSaved = () => { savedLbl.textContent = 'saved ' + TT.hhmm(); paintStatus(); };
    o.api = TT.renderForm(root.querySelector('.form-body'), form, rec, ctx, {
      onChange: () => { o.dirty = true; savedLbl.textContent = 'editing…'; autosave(); },
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
    o.api.secs.forEach((sx) => chips.push(h('button.sec-chip', { type: 'button', title: TT.Ls(sx.sec.title, 'en'), onclick: () => sx.el.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, h('b', { text: sx.sec.id }), h('small'))));
    secNav.replaceChildren(...chips);
    o.api.refresh();
    S.open = o;
  }

  /* ---------------- records ---------------- */
  async function recordsView(root, params) {
    const all = (await TT.db.all('records')).filter((r) => TT.FORMS[r.form]).sort((a, b) => b.updated.localeCompare(a.updated));
    const fsel = h('select.inp', h('option', { value: '', text: 'All forms' }),
      h('optgroup', { label: 'Community' }, ...TT.FORM_ORDER.filter((id) => TT.FORMS[id].group === 'community').map((id) => h('option', { value: id, text: `${TT.FORMS[id].short} — ${TT.Ls(TT.FORMS[id].title, 'en')}` }))),
      h('optgroup', { label: 'Engineering' }, ...TT.FORM_ORDER.filter((id) => TT.FORMS[id].group === 'engineering').map((id) => h('option', { value: id, text: `${TT.FORMS[id].short} — ${TT.Ls(TT.FORMS[id].title, 'en')}` }))));
    fsel.value = params.get('form') || '';
    const ssel = h('select.inp', h('option', { value: '', text: 'Any status' }), h('option', { value: 'draft', text: 'Draft' }), h('option', { value: 'complete', text: 'Complete' }));
    const q = h('input.inp', { type: 'search', placeholder: 'Search ID, summary, enumerator…' });
    const list = h('div.rec-list');
    const countLbl = h('span.muted');
    const match = (r) => (!fsel.value || r.form === fsel.value) && (!ssel.value || r.status === ssel.value) &&
      (!q.value || `${r.id} ${r.enumerator} ${summary(r)}`.toLowerCase().includes(q.value.toLowerCase()));
    function summary(r) { try { return TT.FORMS[r.form].summary(r.data) || ''; } catch (e) { return ''; } }
    function paint() {
      const rows = all.filter(match);
      countLbl.textContent = `${rows.length} of ${all.length}`;
      list.replaceChildren(...(rows.length ? rows.map((r) => {
        const f = TT.FORMS[r.form];
        return h('div.rec-row',
          h('span.badge.' + f.group, { text: f.short }),
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
    [fsel, ssel].forEach((x) => x.addEventListener('change', () => { history.replaceState(null, '', '#/records' + (fsel.value ? '?form=' + fsel.value : '')); paint(); }));
    q.addEventListener('input', paint);
    const busy = (fn) => async (e) => { const b = e.currentTarget; b.disabled = true; try { await fn(); } catch (err) { TT.toast(err.message, 'bad'); } b.disabled = false; };
    root.replaceChildren(
      h('div.page-head', h('h1', L(t('रेकर्डहरू', 'Records'))), countLbl),
      h('div.filters', fsel, ssel, q),
      h('div.btn-row',
        fsel.value ? h('a.btn', { href: '#/new/' + fsel.value }, icon('plus'), 'New ' + TT.FORMS[fsel.value].short) : null,
        h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportXlsx({ filter: match }); TT.toast(`Excel: ${n} records (no personal identifiers)`); }) }, icon('download'), 'Excel of this list'),
        h('a.btn.ghost', { href: '#/data' }, icon('sliders'), 'All exports & import')),
      list);
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
        h('span.muted', { text: 'Language follows the switch at the top (ने / ने+EN / EN).' }),
        h('button.btn', { type: 'button', onclick: () => window.print() }, icon('printer'), 'Print / save as PDF')),
      TT.printDoc(form, rec, ctx));
  }

  /* ---------------- data & settings ---------------- */
  async function dataView(root) {
    const [records, photos] = await Promise.all([TT.db.all('records'), TT.db.all('photos')]);
    const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    const persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const st = S.settings;
    const inp = (key, ph, type = 'text') => h('input.inp', { type, value: st[key] ?? '', placeholder: ph, inputMode: type === 'number' ? 'decimal' : null, dataset: { key } });
    const fEnum = inp('enumerator', 'Your name');
    const fTeam = inp('team', 'Team name / members');
    const fEvap = inp('evap', '4', 'number');
    const fTol = inp('evapTol', '2', 'number');
    const pii = h('input', { type: 'checkbox', id: 'pii' });
    const busy = (fn) => async (e) => { const b = e.currentTarget; b.disabled = true; try { await fn(); } catch (err) { console.error(err); TT.toast(err.message, 'bad', 7000); } b.disabled = false; };
    const fileIn = h('input', { type: 'file', accept: '.zip,.json,application/zip,application/json', hidden: true, onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const r = await TT.importFile(file);
        TT.toast(`Imported: ${r.added} new, ${r.updated} updated, ${r.skipped} unchanged, ${r.photos} photos${r.unknown ? `, ${r.unknown} unknown form` : ''}`, 'ok', 7000);
        route();
      } catch (err) { TT.toast('Import failed: ' + err.message, 'bad', 7000); }
    } });
    const mb = (x) => (x / 1048576).toFixed(1) + ' MB';
    root.replaceChildren(
      h('div.page-head', h('h1', L(t('डाटा र सेटिङ', 'Data & settings')))),
      h('section.card',
        h('h3', { text: 'Enumerator & team' }),
        h('label.lbl', { text: 'Enumerator / surveyor name (pre-fills forms)' }), fEnum,
        h('label.lbl', { text: 'Team' }), fTeam,
        h('label.lbl', { text: 'Assumed open-water evaporation for level screening (mm/day)' }), fEvap,
        h('label.lbl', { text: 'Tolerance before a fall is flagged (mm/day)' }), fTol,
        h('div.btn-row', h('button.btn', { type: 'button', onclick: async () => {
          st.enumerator = fEnum.value.trim(); st.team = fTeam.value.trim();
          st.evap = TT.num(fEvap.value) ?? 4; st.evapTol = TT.num(fTol.value) ?? 2;
          await TT.saveSettings(st);
          TT.toast('Settings saved');
        } }, icon('save'), 'Save settings'))),
      h('section.card',
        h('h3', { text: 'Export' }),
        h('p.muted', { text: 'Field package = everything (records, photos, Excel, GIS) for backup and merging; it contains personal data — share only within the team.' }),
        h('div.btn-row',
          h('button.btn', { type: 'button', onclick: busy(async () => { const r = await TT.exportPackage(); TT.toast(`Package: ${r.records} records, ${r.photos} photos`); }) }, icon('archive'), 'Field package (.zip)')),
        h('label.check', pii, h('span', { text: ' Include personal identifiers (names, phones) in Excel / GIS exports' })),
        h('div.btn-row',
          h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportXlsx({ pii: pii.checked }); TT.toast(`Excel: ${n} records`); }) }, icon('download'), 'Excel (.xlsx)'),
          h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportGeo('geojson', { pii: pii.checked }); TT.toast(`GeoJSON: ${n} features`); }) }, icon('map'), 'GeoJSON (QGIS)'),
          h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportGeo('kml', { pii: pii.checked }); TT.toast(`KML: ${n} features`); }) }, icon('map'), 'KML (Google Earth)'),
          h('button.btn.ghost', { type: 'button', onclick: busy(async () => { const n = await TT.exportJson(); TT.toast(`JSON: ${n} records (no photos)`); }) }, icon('file'), 'JSON (no photos)'))),
      h('section.card',
        h('h3', { text: 'Import & merge' }),
        h('p.muted', { text: 'Import field packages (.zip) or JSON from other phones. New records are added, newer edits replace older ones, identical ones are skipped. Photos come with ZIP packages.' }),
        fileIn,
        h('div.btn-row', h('button.btn', { type: 'button', onclick: () => fileIn.click() }, icon('upload'), 'Choose file to import'))),
      h('section.card',
        h('h3', { text: 'This device' }),
        h('div.kv', h('span', { text: 'Device code (prefix of record IDs)' }), h('b', { text: S.device })),
        h('div.kv', h('span', { text: 'Records / photos' }), h('b', { text: `${records.length} / ${photos.length}` })),
        est && h('div.kv', h('span', { text: 'Storage used / available' }), h('b', { text: `${mb(est.usage || 0)} / ${mb(est.quota || 0)}` })),
        h('div.kv', h('span', { text: 'Persistent storage (protects data from automatic clean-up)' }), h('b', { text: persisted ? 'granted' : 'not granted' })),
        !persisted && h('div.btn-row', h('button.btn.ghost', { type: 'button', onclick: async () => { await requestPersist(); route(); } }, icon('check'), 'Request persistent storage')),
        h('div.kv', h('span', { text: 'App version' }), h('b', { text: TT.VERSION }))),
      h('section.card.danger-zone',
        h('h3', { text: 'Danger zone' }),
        h('p.muted', { text: 'Deletes every record and photo on this device. Export a package first.' }),
        h('button.btn.danger', { type: 'button', onclick: async () => {
          if (!(await TT.confirm('Delete ALL records and photos on this device?', { ok: 'Continue', danger: true }))) return;
          const typed = prompt('Type DELETE to confirm');
          if (typed !== 'DELETE') { TT.toast('Cancelled'); return; }
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
        h('p', { text: 'This browser blocked local storage (private mode?). Open the portal in a normal Chrome/Edge/Firefox/Safari window.' })));
      return;
    }
    setLang(S.settings.lang || 'both');
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
