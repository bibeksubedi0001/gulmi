/* Lakes field portal: UI primitives + form engine (render, skip logic, compute, validate, print). */
'use strict';
(function () {
  const TT = window.TT;
  const { h, L, icon } = TT;

  /* ---------------- UI primitives ---------------- */
  TT.toast = function (msg, kind = 'ok', ms = 3500) {
    let box = document.getElementById('toasts');
    if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div.toast.' + kind, { text: msg });
    box.append(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  };

  TT.dialog = function (build, onCancel, cls = '') {
    const dlg = h('dialog.dlg' + cls);
    const close = () => { if (dlg.open) dlg.close(); dlg.remove(); };
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); if (onCancel) onCancel(); });
    dlg.append(build(close));
    document.body.append(dlg);
    dlg.showModal();
    return { close };
  };

  TT.confirm = (msg, { ok = 'OK', danger = false, detail = '' } = {}) => new Promise((res) => {
    TT.dialog((close) => h('div.dlg-body',
      h('p.dlg-msg', { text: msg }),
      detail && h('p.muted', { text: detail }),
      h('div.btn-row.end',
        h('button.btn.ghost', { type: 'button', onclick: () => { close(); res(false); } }, 'Cancel'),
        h('button.btn' + (danger ? '.danger' : ''), { type: 'button', onclick: () => { close(); res(true); } }, ok))), () => res(false));
  });

  // Photo viewer; given a list it steps through it (arrows, arrow keys, swipe). opts.records: Map id -> record; opts.open: "Open record" button.
  TT.viewPhoto = function (p, list = [p], opts = {}) {
    let i = Math.max(0, list.indexOf(p)), url = null, x0 = null, y0 = 0;
    const many = list.length > 1;
    const img = h('img', { alt: '' }), title = h('b'), count = h('span.pv-count'), meta = h('div.photo-meta');
    const step = (d) => { if (many) show(i + d); };
    const stage = h('div.pv-stage', img,
      many && h('button.pv-nav.prev', { type: 'button', title: 'Previous photo', 'aria-label': 'Previous photo', onclick: () => step(-1) }, icon('back')),
      many && h('button.pv-nav.next', { type: 'button', title: 'Next photo', 'aria-label': 'Next photo', onclick: () => step(1) }, icon('chevron')));
    stage.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) step(dx < 0 ? 1 : -1);
    });
    function show(k) {
      i = (k + list.length) % list.length;
      const q = list[i];
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(q.blob);
      img.src = url;
      img.alt = q.id;
      title.textContent = q.id;
      count.textContent = many ? `${i + 1} / ${list.length}` : '';
      const form = TT.FORMS[q.form], fld = form && form.fieldMap[q.field], rec = opts.records && opts.records.get(q.record);
      meta.replaceChildren(
        h('span', { text: [form ? `${form.short} ${TT.Ls(form.title)}` : q.form, fld ? TT.Ls(fld.q) : ''].filter(Boolean).join(' · ') }),
        h('span', { text: [q.record, rec ? TT.lakeName(rec.data.lake) : '', TT.fmt(q.t)].filter(Boolean).join(' · ') }),
        q.gps ? h('span', { text: TT.gpsText(q.gps) }) : '',
        q.caption ? h('span', { text: q.caption }) : '');
    }
    const done = () => { if (url) URL.revokeObjectURL(url); url = null; };
    TT.dialog((close) => {
      const shut = () => { done(); close(); };
      const body = h('div.dlg-body.photo-view',
        h('div.pv-top', title, count, h('button.icon-btn', { type: 'button', title: 'Close', 'aria-label': 'Close', onclick: shut }, icon('x'))),
        stage, meta,
        h('div.btn-row.end',
          h('button.btn.ghost', { type: 'button', onclick: () => TT.download(list[i].blob, list[i].id + '.jpg') }, icon('download'), 'Save copy'),
          opts.open && h('button.btn', { type: 'button', onclick: () => { const id = list[i].record; shut(); location.hash = '#/edit/' + encodeURIComponent(id); } }, icon('file'), 'Open record')));
      body.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); });
      show(i);
      return body;
    }, done, '.dlg-photo');
  };

  /* ---------------- photos ---------------- */
  async function loadBitmap(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* fall back to <img> */ }
    }
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(u); res(im); };
      im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('unsupported image')); };
      im.src = u;
    });
  }

  // Resize to <=1600 px and add an evidence strip BELOW the picture (the image itself is not covered).
  TT.makePhoto = async function (file, rec, fieldId) {
    const dev = await TT.deviceCode();
    const seq = await TT.db.nextSeq('photo');
    const id = `P-${dev}-${TT.pad(seq, 4)}`;
    const [fix, bmp] = await Promise.all([TT.quickFix(), loadBitmap(file)]);
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * sc), ih = Math.round(bmp.height * sc);
    const band = Math.max(26, Math.round(w * 0.034));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = ih + band;
    const g = cv.getContext('2d');
    g.drawImage(bmp, 0, 0, w, ih);
    g.fillStyle = '#0d2a33';
    g.fillRect(0, ih, w, band);
    g.fillStyle = '#ffffff';
    g.font = `${Math.round(band * 0.5)}px "Times New Roman", Times, serif`;
    g.textBaseline = 'middle';
    const now = new Date().toISOString();
    const txt = [TT.lakeName((rec.data || {}).lake) || 'Gulmi lakes', id, rec.id, 'logged ' + TT.fmt(now), fix ? `${fix.lat.toFixed(6)}, ${fix.lon.toFixed(6)} ±${fix.acc} m${fix.last ? ' (last fix)' : ''}` : 'no GPS'].join('   ·   ');
    g.fillText(txt, Math.round(band * 0.4), ih + band / 2, w - band * 0.8);
    if (bmp.close) bmp.close();
    const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.82));
    if (!blob) throw new Error('could not encode JPEG');
    return { id, record: rec.id, form: rec.form, field: fieldId, blob, w, h: ih, t: now, gps: fix, name: file.name || '', size: blob.size, caption: '' };
  };

  /* ---------------- value helpers ---------------- */
  const safe = (fn, vals) => { try { return !!fn(vals); } catch (e) { return true; } };
  TT.visible = (f, vals) => {
    if (f.section && f.section.showIf && !safe(f.section.showIf, vals)) return false;
    return !f.showIf || safe(f.showIf, vals);
  };
  TT.answered = (f, v) => {
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return f.type === 'table' ? v.some((r) => r && Object.keys(r).length) : v.length > 0;
    if (typeof v === 'object') return f.type === 'gps' ? Number.isFinite(v.lat) : Object.keys(v).length > 0;
    return true;
  };
  const optText = (o) => o.en || o.ne;
  TT.optLabel = (f, v) => {
    const o = (f.options || []).find((x) => x.v === String(v));
    return o ? TT.Ls(o) : String(v);
  };
  TT.valueText = function (f, v, vals, lang = 'en') {
    if (v == null || v === '') return '';
    const oth = vals && vals[f.id + '__other'];
    switch (f.type) {
      case 'radio': case 'select': case 'yn': case 'scale': case 'bsyear': case 'person':
        return TT.optLabel(f, v, lang) + (v === 'other' && oth ? ': ' + oth : '');
      case 'checks': case 'months': case 'people':
        return (Array.isArray(v) ? v : [v]).map((x) => TT.optLabel(f, x, lang) + (x === 'other' && oth ? ': ' + oth : '')).join('; ');
      case 'rank':
        return (v || []).map((x, i) => (x ? `${i + 1}. ${TT.optLabel(f, x, lang)}` : '')).filter(Boolean).join('; ');
      case 'gps': return TT.gpsText(v);
      case 'photos': return (v || []).join(', ');
      case 'grid':
        return Object.entries(v).map(([r, cols]) => {
          const row = f.rows.find((x) => x.v === r);
          const parts = Object.entries(cols).map(([c, val]) => {
            const col = f.cols.find((x) => x.v === c);
            const sc = f.scale.find((x) => x.v === val);
            return (f.cols.length > 1 ? TT.Ls(col, lang) + '=' : '') + (sc ? TT.Ls(sc, lang) : val);
          });
          return `${row ? TT.Ls(row, lang) : r}: ${parts.join(', ')}`;
        }).join('; ');
      case 'table': return `${v.length} row(s)`;
      case 'track': return `${v.length} points`;
      default: return String(v);
    }
  };

  TT.tableComputed = (f, rows, vals, ctx) => {
    if (!f.compute) return rows.map(() => ({}));
    try { return f.compute(rows, vals, ctx) || rows.map(() => ({})); } catch (e) { console.error(e); return rows.map(() => ({})); }
  };

  TT.whenText = (form, x) => {
    if (!x._dep) return x.when ? TT.Ls(x.when, 'en') : '';
    const [dep, set] = x._dep;
    const df = form.fieldMap[dep];
    if (!df) return '';
    return `Ask if ${df.num} = ${set.map((v) => TT.optLabel(df, v)).join(' / ')}`;
  };

  /* ---------------- field renderers ---------------- */
  const R = {};

  /* voice typing: Web Speech API (Chrome, Edge, Safari); most phones need internet for it */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const VOICE = { 'en-IN': ['EN', 'English'], 'ne-NP': ['NE', 'Nepali'] };
  const voiceLang = () => { try { return localStorage.getItem('tt-voice-lang') === 'ne-NP' ? 'ne-NP' : 'en-IN'; } catch (e) { return 'en-IN'; } };
  const paintLang = (b, l) => { b.textContent = VOICE[l][0]; b.title = `Voice typing in ${VOICE[l][1]} (tap to switch)`; };
  const voiceOk = (f) => !f.suggest && !/(^|_)(id|fid|phone)$/.test(f.id);
  // every iPhone/iPad browser uses Apple's recogniser, which has no Nepali (it reports service-not-allowed)
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const NE_FALLBACK = 'hi-IN'; // closest language Apple offers; writes Devanagari
  let neRefused = false;
  const voiceError = (code) => ({
    'not-allowed': 'Allow the microphone for this site to use voice typing.',
    'service-not-allowed': IOS ? 'Voice typing is not available right now. Turn on Dictation (Settings › General › Keyboard) and check the internet.' : 'Voice typing is not available in this browser. Try Google Chrome.',
    'language-not-supported': 'This language is not available for voice typing in this browser. Try Google Chrome.',
    network: 'Voice typing needs internet here. Use the keyboard microphone instead.',
  }[code]);
  let speaking = null;
  const stopVoice = () => { if (speaking) { try { speaking.rec.stop(); } catch (e) { /* already stopped */ } } };
  window.addEventListener('hashchange', stopVoice);
  function dictate(el, cls = '') {
    if (!SR) return el;
    const mic = h('button.dict-mic', { type: 'button', title: 'Voice typing', 'aria-label': 'Voice typing' }, icon('mic'));
    const lang = h('button.dict-lang', { type: 'button' });
    paintLang(lang, voiceLang());
    lang.addEventListener('click', () => {
      const l = voiceLang() === 'ne-NP' ? 'en-IN' : 'ne-NP';
      try { localStorage.setItem('tt-voice-lang', l); } catch (e) { /* private mode: this page only */ }
      document.querySelectorAll('.dict-lang').forEach((b) => paintLang(b, l));
      if (speaking) stopVoice();
    });
    mic.addEventListener('click', () => {
      if (speaking && speaking.mic === mic) return stopVoice();
      stopVoice();
      const l = voiceLang();
      listen(l === 'ne-NP' && neRefused ? NE_FALLBACK : l);
    });
    function listen(language) {
      const rec = new SR();
      rec.lang = language;
      rec.interimResults = true;
      rec.continuous = !/Android/i.test(navigator.userAgent); // Android repeats results in continuous mode
      const base = el.value;
      let heard = false;
      rec.onresult = (e) => {
        heard = true;
        let t = '';
        for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
        t = t.trim();
        el.value = !t ? base : !base ? t : base + (/\s$/.test(base) ? '' : ' ') + t;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const done = () => {
        if (speaking && speaking.rec === rec) speaking = null;
        if (!speaking || speaking.mic !== mic) mic.classList.remove('on');
      };
      rec.onerror = (e) => {
        const refused = !heard && (e.error === 'service-not-allowed' || e.error === 'language-not-supported');
        if (language === 'ne-NP' && refused) {
          neRefused = true;
          TT.toast((IOS ? 'iPhone has no Nepali speech recognition' : 'This browser has no Nepali speech recognition (Google Chrome has)')
            + ', so NE now uses the Hindi one: it writes Devanagari, but check the words.', 'warn', 9000);
          if (speaking && speaking.rec === rec) speaking = null;
          return listen(NE_FALLBACK);
        }
        const msg = language === NE_FALLBACK && refused ? 'Nepali and Hindi voice typing are both unavailable here. Use EN, or type in Nepali.' : voiceError(e.error);
        if (msg) TT.toast(msg, 'bad', 10000);
        done();
      };
      rec.onend = done;
      try { rec.start(); } catch (err) { TT.toast('Voice typing could not start.', 'bad'); done(); return; }
      speaking = { rec, mic };
      mic.classList.add('on');
    }
    return h('div.dict' + cls, el, h('div.dict-ctl', mic, lang));
  }

  R.info = (io) => ({ el: h('div.info-box', h('div', L(io.f.text)), io.f.items && h('ul', ...io.f.items.map((i) => h('li', L(i))))) });

  R.text = (io) => {
    const f = io.f;
    const inp = h('input.inp', { type: 'text', value: io.get() ?? '', placeholder: f.ph || '', maxLength: f.max || 400, autocomplete: 'off', oninput: (e) => io.set(e.target.value) });
    if (!f.suggest) return { el: voiceOk(f) ? dictate(inp) : inp, update: () => { inp.value = io.get() ?? ''; } };
    const id = 'dl-' + f.id + '-' + Math.random().toString(36).slice(2, 7);
    const dl = h('datalist', { id });
    inp.setAttribute('list', id);
    const fill = () => {
      let s = [];
      try { s = f.suggest(io.vals, io.ctx) || []; } catch (e) { s = []; }
      dl.replaceChildren(...s.map((x) => h('option', { value: x })));
    };
    fill();
    return { el: h('div', inp, dl), update: () => { inp.value = io.get() ?? ''; }, refresh: fill };
  };

  R.textarea = (io) => {
    const ta = h('textarea.inp', { rows: io.f.rows || 3, value: io.get() ?? '', placeholder: io.f.ph || '', maxLength: 4000 });
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 520) + 'px'; };
    ta.addEventListener('input', (e) => { io.set(e.target.value); grow(); });
    requestAnimationFrame(grow);
    return { el: dictate(ta), update: () => { ta.value = io.get() ?? ''; grow(); } };
  };

  function numberInput(f, value, onval) {
    const inp = h('input.inp.num', { type: 'text', inputMode: f.type === 'integer' ? 'numeric' : 'decimal', value: value ?? '', placeholder: f.ph || '', autocomplete: 'off' });
    const warn = h('div.q-warn');
    const check = () => {
      const raw = inp.value.trim();
      const x = TT.num(raw);
      let msg = '';
      if (raw !== '' && x == null) msg = 'Not a number';
      else if (x != null && f.type === 'integer' && !Number.isInteger(x)) msg = 'Whole number expected';
      else if (x != null && f.min != null && x < f.min) msg = `Below expected minimum ${f.min}`;
      else if (x != null && f.max != null && x > f.max) msg = `Above expected maximum ${f.max}`;
      warn.textContent = msg;
      inp.classList.toggle('bad', !!msg);
      return x;
    };
    inp.addEventListener('input', () => { const x = check(); onval(inp.value.trim() === '' || x == null ? '' : x); });
    if (value != null && value !== '') check();
    return { inp, warn, check };
  }
  R.number = (io) => {
    const f = io.f;
    const n = numberInput(f, io.get(), (v) => io.set(v));
    const el = h('div', h('div.inp-unit', n.inp, f.unit && h('span.unit', { text: f.unit })), n.warn);
    return { el, update: () => { n.inp.value = io.get() ?? ''; n.check(); } };
  };
  R.integer = R.number;

  const dtInput = (type) => (io) => {
    const inp = h('input.inp', { type, value: io.get() ?? '', onchange: (e) => io.set(e.target.value) });
    const now = h('button.btn.ghost.sm', { type: 'button', onclick: () => {
      const v = type === 'date' ? TT.today() : type === 'time' ? TT.hhmm() : TT.localInput();
      inp.value = v; io.set(v);
    } }, icon('clock'), 'Now');
    return { el: h('div.row-inline', inp, now), update: () => { inp.value = io.get() ?? ''; } };
  };
  R.date = dtInput('date');
  R.time = dtInput('time');
  R.datetime = dtInput('datetime-local');

  function buildSelect(f, value, onchange, cls = '.inp') {
    const s = h('select' + cls, { onchange: (e) => onchange(e.target.value) },
      h('option', { value: '', text: '— Select —' }),
      ...(f.options || []).map((o) => h('option', { value: o.v, text: optText(o) })));
    s.value = value ?? '';
    return s;
  }
  R.select = (io) => {
    const s = buildSelect(io.f, io.get(), (v) => io.set(v));
    return { el: s, update: () => { s.value = io.get() ?? ''; } };
  };
  R.radio = R.select;
  R.yn = R.select;
  R.scale = R.select;
  R.person = R.select;
  R.bsyear = (io) => {
    const s = buildSelect(io.f, io.get(), (v) => io.set(v));
    return { el: h('div.row-inline', s, h('span.muted.sm', { text: 'BS (AD)' })), update: () => { s.value = io.get() ?? ''; } };
  };

  // Multi-answer questions: checkbox grid; "none"/"don't know" clear the other ticks.
  R.checks = (io) => {
    const f = io.f;
    const excl = f.exclusive || ['none', 'dk', 'na'];
    const box = h('div.opts' + (f.options.length > 4 ? '.many' : ''), { role: 'group' });
    const inputs = f.options.map((op) => {
      const inp = h('input', { type: 'checkbox', value: op.v });
      inp.addEventListener('change', () => {
        let cur = Array.isArray(io.get()) ? [...io.get()] : [];
        if (!inp.checked) cur = cur.filter((x) => x !== op.v);
        else if (excl.includes(op.v)) cur = [op.v];
        else cur = cur.filter((x) => !excl.includes(x)).concat(op.v);
        io.set(cur);
        paint();
      });
      box.append(h('label.opt', inp, h('span', L(op))));
      return inp;
    });
    function paint() {
      const v = Array.isArray(io.get()) ? io.get() : [];
      inputs.forEach((i) => { i.checked = v.includes(i.value); });
    }
    paint();
    return { el: box, update: paint };
  };
  R.months = R.checks;
  R.people = R.checks;

  // Ranking as 1st/2nd/3rd dropdowns; picking a cause already ranked elsewhere moves it here.
  R.rank = (io) => {
    const f = io.f;
    const max = f.max || 3;
    const ORD = ['1st', '2nd', '3rd'];
    const sels = [];
    for (let i = 0; i < max; i++) {
      sels.push(buildSelect({ options: f.options }, (io.get() || [])[i] ?? '', () => {
        const cur = sels.map((s) => s.value || null);
        cur.forEach((x, k) => { if (k !== i && x && x === cur[i]) { cur[k] = null; sels[k].value = ''; } });
        while (cur.length && cur[cur.length - 1] == null) cur.pop();
        io.set(cur.some(Boolean) ? cur : '');
      }));
    }
    const paint = () => { const cur = io.get() || []; sels.forEach((s, i) => { s.value = cur[i] || ''; }); };
    return { el: h('div.rank-list', ...sels.map((s, i) => h('label.rank-row', h('span.rank-n', { text: ORD[i] || `#${i + 1}` }), s))), update: paint };
  };

  R.grid = (io) => {
    const f = io.f;
    const wrap = h('div.grid-q' + (f.levelColors ? '.level' : ''));
    wrap.append(h('div.grid-row.grid-head', h('div.grid-rl'), ...f.cols.map((c) => h('div.grid-c', L(c)))));
    const sels = [];
    for (const r of f.rows) {
      const row = h('div.grid-row', h('div.grid-rl', h('strong', L(r)), r.note && h('small.anchor', L(r.note))));
      for (const c of f.cols) {
        const s = h('select.inp.sm', { dataset: { r: r.v, c: c.v } }, h('option', { value: '', text: '—' }), ...f.scale.map((o) => h('option', { value: o.v, text: optText(o) })));
        s.addEventListener('change', () => {
          const v = { ...(io.get() || {}) };
          const rv = { ...(v[r.v] || {}) };
          if (s.value) rv[c.v] = s.value; else delete rv[c.v];
          if (Object.keys(rv).length) v[r.v] = rv; else delete v[r.v];
          io.set(Object.keys(v).length ? v : '');
          s.dataset.val = s.value;
        });
        sels.push(s);
        row.append(h('div.grid-c', f.cols.length > 1 && h('span.grid-cl', L(c.short || c)), s));
      }
      wrap.append(row);
    }
    const update = () => {
      const v = io.get() || {};
      sels.forEach((s) => { s.value = (v[s.dataset.r] || {})[s.dataset.c] || ''; s.dataset.val = s.value; });
    };
    update();
    return { el: wrap, update };
  };

  R.gps = (io) => {
    const f = io.f;
    const label = f.average ? 'Average GPS position (60 s)' : 'Capture GPS position';
    const out = h('div.gps-val');
    const live = h('div.gps-live');
    const btnTxt = h('span', { text: label });
    let ctl = null;
    const lat = h('input.inp.sm', { type: 'text', inputMode: 'decimal', placeholder: 'Latitude e.g. 28.100514' });
    const lon = h('input.inp.sm', { type: 'text', inputMode: 'decimal', placeholder: 'Longitude e.g. 83.379364' });
    const btn = h('button.btn.gps-btn', { type: 'button', onclick: () => {
      if (ctl) { ctl.stop(); return; }
      btn.classList.add('busy');
      btnTxt.textContent = 'Stop and use best fix';
      live.textContent = 'Waiting for satellites…';
      ctl = TT.watchFix({
        average: !!f.average, maxWait: f.average ? 60000 : 45000, target: f.target || 6,
        onUpdate: (fx, best, n) => { live.textContent = `now ±${Math.round(fx.acc)} m · best ±${Math.round(best.acc)} m · ${n} fix${n > 1 ? 'es' : ''}`; },
        onDone: (res, err) => {
          ctl = null;
          btn.classList.remove('busy');
          btnTxt.textContent = label;
          if (res) { io.set({ ...res, src: 'gps' }); live.textContent = ''; } else live.textContent = err;
          paint();
        },
      });
    } }, icon('crosshair'), btnTxt);
    const manual = () => {
      const la = TT.num(lat.value), lo = TT.num(lon.value);
      if (la != null && lo != null && Math.abs(la) <= 90 && Math.abs(lo) <= 180) io.set({ lat: la, lon: lo, acc: null, alt: null, src: 'manual', t: new Date().toISOString() });
      else if (!lat.value.trim() && !lon.value.trim()) io.set('');
      paint();
    };
    lat.addEventListener('change', manual);
    lon.addEventListener('change', manual);
    function paint() {
      const v = io.get();
      if (v && Number.isFinite(v.lat)) {
        lat.value = v.lat.toFixed(6);
        lon.value = v.lon.toFixed(6);
        const u = TT.utm(v.lat, v.lon);
        const ctr = TT.lakeCentre(io.vals.lake);
        const d = ctr && TT.distM(ctr, v);
        out.replaceChildren(...[
          h('span.b', { text: TT.gpsText(v) }),
          v.alt != null && h('span', { text: `GPS alt ${Math.round(v.alt)} m` }),
          u && h('span', { text: `UTM 44N  E ${u.e.toFixed(1)}  N ${u.n.toFixed(1)}` }),
          ctr ? h('span', { text: `${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(2) + ' km'} ${TT.compass8(TT.bearing(ctr, v))} of ${TT.lakeName(io.vals.lake)} centre` })
            : io.vals.lake && h('span', { text: 'lake centre not set' }),
          v.n > 1 && h('span', { text: `${v.n} fixes${v.averaged ? ' averaged' : ''}` }),
          v.src === 'manual' && h('span', { text: 'entered manually' }),
          v.src === 'map' && h('span', { text: 'picked on map' })].filter(Boolean));
      } else out.replaceChildren(h('span.muted', { text: 'No position yet' }));
    }
    paint();
    return {
      el: h('div.gps', btn, live, out, h('details.gps-manual', h('summary', { text: 'Enter / correct coordinates manually' }), h('div.row2', lat, lon))),
      update: paint, destroy: () => ctl && ctl.stop(),
    };
  };

  R.photos = (io) => {
    const f = io.f;
    const grid = h('div.thumbs');
    const urls = [];
    const add = async (files, input) => {
      for (const file of Array.from(files || [])) {
        try {
          const p = await TT.makePhoto(file, io.rec, f.id);
          await TT.db.put('photos', p);
          io.set([...(io.get() || []), p.id]);
          TT.toast(`Photo ${p.id} saved`);
        } catch (err) { TT.toast('Photo failed: ' + err.message, 'bad'); }
      }
      input.value = '';
      paint();
    };
    const cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: (e) => add(e.target.files, e.target) });
    const gal = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: (e) => add(e.target.files, e.target) });
    let gen = 0;
    async function paint() {
      const my = ++gen;
      const made = [];
      const cards = [];
      for (const id of io.get() || []) {
        const p = await TT.db.get('photos', id);
        if (my !== gen) break;
        if (!p) { cards.push(h('figure.thumb.missing', h('figcaption', { text: id + ' (not on this device)' }))); continue; }
        const u = URL.createObjectURL(p.blob);
        made.push(u);
        cards.push(h('figure.thumb',
          h('img', { src: u, alt: id, onclick: () => TT.viewPhoto(p) }),
          h('figcaption',
            h('b', { text: id }),
            h('input.inp.xs', { type: 'text', value: p.caption || '', placeholder: 'Caption / what it shows', onchange: async (e) => { p.caption = e.target.value; await TT.db.put('photos', p); } }),
            h('button.icon-btn', { type: 'button', title: 'Remove photo', onclick: async () => {
              if (!(await TT.confirm(`Remove photo ${id}?`, { ok: 'Remove', danger: true }))) return;
              await TT.db.del('photos', id);
              io.set((io.get() || []).filter((x) => x !== id));
              paint();
            } }, icon('trash')))));
      }
      if (my !== gen) { made.forEach((u) => URL.revokeObjectURL(u)); return; }
      const old = urls.splice(0, urls.length, ...made);
      grid.replaceChildren(...cards);
      setTimeout(() => old.forEach((u) => URL.revokeObjectURL(u)), 1500);
    }
    paint();
    return {
      el: h('div.photos',
        h('div.btn-row',
          h('button.btn', { type: 'button', onclick: () => cam.click() }, icon('camera'), 'Camera'),
          h('button.btn.ghost', { type: 'button', onclick: () => gal.click() }, icon('image'), 'Gallery / file')),
        cam, gal, grid),
      update: paint, destroy: () => { const old = urls.splice(0); setTimeout(() => old.forEach((u) => URL.revokeObjectURL(u)), 3000); },
    };
  };

  // Track points come from the Map page (Track tool, or Measure then "Save as track").
  R.track = (io) => {
    const info = h('div.cmp-val');
    const paint = () => {
      const pts = Array.isArray(io.get()) ? io.get() : [];
      info.textContent = pts.length ? `${pts.length} points · ${Math.round(TT.trackLength(pts) || 0)} m` : 'No track yet: record one with the Track tool on the Map page';
      info.classList.toggle('muted', !pts.length);
    };
    paint();
    const el = h('div', info, h('div.btn-row',
      h('a.btn.ghost.sm', { href: '#/map?rec=' + encodeURIComponent(io.rec.id) }, icon('map'), 'Show on map'),
      h('button.btn.ghost.sm', { type: 'button', onclick: async () => {
        if (await TT.confirm('Clear the track points?', { ok: 'Clear', danger: true })) { io.set(''); paint(); }
      } }, icon('trash'), 'Clear')));
    return { el, update: paint };
  };

  R.computed = (io) => {
    const f = io.f;
    const out = h('div.cmp-val');
    const refresh = () => {
      let v = null;
      try { v = f.compute(io.vals, io.ctx); } catch (e) { v = null; }
      if (v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) {
        delete io.vals[f.id];
        out.textContent = f.empty || '—';
        out.classList.add('muted');
      } else {
        const isNum = typeof v === 'number';
        io.vals[f.id] = isNum ? TT.round(v, f.dp ?? 3) : v;
        out.textContent = (isNum ? TT.fix(v, f.dp ?? 3) : v) + (f.unit ? ' ' + f.unit : '');
        out.classList.remove('muted');
      }
    };
    refresh();
    return { el: out, refresh };
  };

  R.table = (io) => {
    const f = io.f;
    const cols = f.columns;
    let rows = Array.isArray(io.get()) && io.get().length ? io.get() : Array.from({ length: f.minRows || 3 }, () => ({}));
    const tbody = h('tbody');
    const sum = h('div.tbl-sum');
    const commit = () => io.set(rows.some((r) => Object.keys(r).length) ? rows : '');

    function cellGps(r, c, setv) {
      const txt = h('span', { text: r[c.id] ? `±${Math.round(r[c.id].acc ?? 0)} m` : '' });
      let ctl = null;
      const b = h('button.icon-btn.cell-gps', { type: 'button', title: r[c.id] ? TT.gpsText(r[c.id]) : 'Capture GPS for this row', onclick: () => {
        if (ctl) { ctl.stop(); return; }
        b.classList.add('busy');
        ctl = TT.watchFix({ target: 6, maxWait: 25000, onUpdate: (fx) => { txt.textContent = `±${Math.round(fx.acc)}…`; }, onDone: (res, err) => {
          ctl = null;
          b.classList.remove('busy');
          if (res) { setv({ lat: res.lat, lon: res.lon, acc: res.acc, alt: res.alt, t: res.t }); txt.textContent = `±${Math.round(res.acc)} m`; b.title = TT.gpsText(res); }
          else { txt.textContent = ''; TT.toast(err, 'bad'); }
        } });
      } }, icon('crosshair'));
      return h('div.cell-gps-wrap', b, txt);
    }

    function cell(c, r) {
      const setv = (v) => { if (v === '' || v == null) delete r[c.id]; else r[c.id] = v; commit(); recompute(); };
      switch (c.type) {
        case 'number': case 'integer': {
          const n = numberInput(c, r[c.id], setv);
          n.inp.classList.add('cell');
          return n.inp;
        }
        case 'select': case 'bsyear': return buildSelect(c, r[c.id], setv, '.inp.cell');
        case 'check': return h('input.cell-check', { type: 'checkbox', checked: !!r[c.id], onchange: (e) => setv(e.target.checked ? true : '') });
        case 'time': return h('input.inp.cell', { type: 'time', value: r[c.id] ?? '', onchange: (e) => setv(e.target.value) });
        case 'gps': return cellGps(r, c, setv);
        default: return h('input.inp.cell', { type: 'text', value: r[c.id] ?? '', maxLength: 300, oninput: (e) => setv(e.target.value) });
      }
    }

    function renderRows() {
      tbody.replaceChildren(...rows.map((r, i) => h('tr',
        h('td.rn', { text: String(i + 1) }),
        ...cols.map((c) => h('td' + (c.computed ? '.cmp' : ''), { dataset: { c: c.id } }, c.computed ? null : cell(c, r))),
        h('td', h('button.icon-btn', { type: 'button', title: 'Delete row', onclick: async () => {
          if (Object.keys(r).length && !(await TT.confirm(`Delete row ${i + 1}?`, { ok: 'Delete', danger: true }))) return;
          rows.splice(i, 1);
          if (!rows.length) rows.push({});
          commit();
          renderRows();
        } }, icon('x'))))));
      recompute();
    }

    function recompute() {
      const comp = TT.tableComputed(f, rows, io.vals, io.ctx);
      rows.forEach((r, i) => {
        const tr = tbody.children[i];
        if (!tr) return;
        cols.forEach((c, j) => {
          if (!c.computed) return;
          const v = comp[i] ? comp[i][c.id] : null;
          tr.children[j + 1].textContent = v == null || v === '' ? '' : typeof v === 'number' ? TT.fix(v, c.dp ?? 3) : String(v);
        });
      });
      if (f.summary) {
        let s = [];
        try { s = f.summary(rows, comp, io.vals, io.ctx) || []; } catch (e) { console.error(e); }
        sum.replaceChildren(...s.map(([k, v, cls]) => h('div.kv' + (cls ? '.' + cls : ''), h('span', { text: k }), h('b', { text: v == null || v === '' ? '—' : String(v) }))));
      }
    }

    const addRow = () => {
      const last = rows[rows.length - 1] || {};
      const nr = {};
      (f.carry || []).forEach((k) => { if (last[k] != null) nr[k] = last[k]; });
      if (f.autoInc && TT.num(last[f.autoInc]) != null) nr[f.autoInc] = TT.num(last[f.autoInc]) + (f.autoStep || 1);
      rows.push(nr);
      if (Object.keys(nr).length) commit();
      renderRows();
      const inp = tbody.lastElementChild && tbody.lastElementChild.querySelector('input:not([type=checkbox]),select');
      if (inp) inp.focus();
    };

    renderRows();
    const el = h('div.tbl-wrap',
      h('div.tbl-scroll', h('table.tbl',
        h('thead', h('tr', h('th', { text: '#' }), ...cols.map((c) => h('th' + (c.computed ? '.cmp' : ''), L(c.label), c.unit && h('small', { text: ` ${c.unit}` }))), h('th'))),
        tbody)),
      h('div.btn-row', h('button.btn.ghost.sm', { type: 'button', onclick: addRow }, icon('plus'), 'Add row')),
      sum);
    return {
      el,
      refresh: recompute,
      update: () => { rows = Array.isArray(io.get()) && io.get().length ? io.get() : [{}]; renderRows(); },
    };
  };

  /* ---------------- engine ---------------- */
  TT.renderForm = function (host, form, rec, ctx, hooks = {}) {
    const vals = rec.data;
    const items = [];
    const secs = [];
    const api = { vals, items, secs, progress: null };

    const changed = (fid) => {
      if (form.onChange) { try { form.onChange(fid, vals, ctx, api); } catch (e) { console.error(e); } }
      refresh();
      if (hooks.onChange) hooks.onChange(fid);
    };

    function evidenceRow(f) {
      const key = f.id + '__src';
      const s = buildSelect({ options: TT.O.src }, vals[key] ?? '', (v) => { if (v) vals[key] = v; else delete vals[key]; changed(key); }, '.inp.sm');
      return h('label.evi', h('span.evi-l', { text: 'How do they know?' }), s);
    }

    function noteRow(f) {
      const key = f.id + '__note';
      const ta = h('textarea.inp.note-ta', { rows: 2, placeholder: 'Verbatim answer, landmark, who can verify…', value: vals[key] || '', maxLength: 2000,
        oninput: (e) => { if (e.target.value) vals[key] = e.target.value; else delete vals[key]; changed(key); } });
      return h('details.note', { open: !!vals[key] }, h('summary', icon('note'), h('span', { text: 'Note' })), dictate(ta));
    }

    function renderItem(f) {
      const io = {
        f, vals, ctx, rec,
        get: () => vals[f.id],
        set: (v) => {
          if (v === '' || v == null || (Array.isArray(v) && !v.length)) delete vals[f.id];
          else vals[f.id] = v;
          changed(f.id);
        },
      };
      const wrap = h('div.q', { id: 'q-' + f.id, dataset: { type: f.type } });
      if (f.type === 'info') { wrap.append(R.info(io).el); return { f, wrap }; }
      wrap.append(h('div.q-head', h('span.q-num', { text: f.num }), h('div.q-label', f.required && h('span.req', { title: 'Required', text: '* ' }), L(f.q))));
      if (f.hint) wrap.append(h('div.q-hint', L(f.hint)));
      const ctl = (R[f.type] || R.text)(io);
      wrap.append(ctl.el);
      let other = null;
      if (f.other) {
        other = dictate(h('input.inp.other', { type: 'text', maxLength: 300, placeholder: 'Specify other', value: vals[f.id + '__other'] || '',
          oninput: (e) => { if (e.target.value) vals[f.id + '__other'] = e.target.value; else delete vals[f.id + '__other']; changed(f.id + '__other'); } }), '.dict-other');
        wrap.append(other);
      }
      if (f.evidence) wrap.append(evidenceRow(f));
      if (!['textarea', 'computed', 'table'].includes(f.type) && f.note !== false) wrap.append(noteRow(f));
      const err = h('div.q-err');
      wrap.append(err);
      return { f, wrap, ctl, other, err };
    }

    function refresh() {
      let tot = 0, ans = 0;
      const per = new Map();
      for (const it of items) {
        const vis = TT.visible(it.f, vals);
        it.wrap.hidden = !vis;
        if (!vis || it.f.type === 'info') continue;
        if (it.ctl && it.ctl.refresh) it.ctl.refresh();
        if (it.other) {
          const v = vals[it.f.id];
          it.other.hidden = !(v === 'other' || (Array.isArray(v) && v.includes('other')));
        }
        if (it.f.type === 'computed') continue;
        const a = TT.answered(it.f, vals[it.f.id]);
        tot++;
        if (a) { ans++; it.wrap.classList.remove('invalid'); it.err.textContent = ''; }
        const p = per.get(it.f.section) || [0, 0];
        p[0]++;
        if (a) p[1]++;
        per.set(it.f.section, p);
      }
      for (const s of secs) {
        const vis = !s.sec.showIf || safe(s.sec.showIf, vals);
        s.el.hidden = !vis;
        const p = per.get(s.sec) || [0, 0];
        s.prog.textContent = vis ? `${p[1]}/${p[0]}` : 'skipped';
        s.prog.classList.toggle('done', vis && p[0] > 0 && p[1] === p[0]);
      }
      api.progress = { tot, ans, pct: tot ? Math.round((ans / tot) * 100) : 0, per };
      if (hooks.onProgress) hooks.onProgress(api.progress, secs);
    }

    api.validate = () => {
      const errs = [];
      for (const it of items) {
        if (it.f.type === 'info') continue;
        it.err.textContent = '';
        it.wrap.classList.remove('invalid');
        if (!TT.visible(it.f, vals)) continue;
        let msg = '';
        if (it.f.required && !TT.answered(it.f, vals[it.f.id])) msg = 'Required';
        else if (it.f.validate) { try { msg = it.f.validate(vals[it.f.id], vals, ctx) || ''; } catch (e) { msg = ''; } }
        if (msg) { errs.push(it); it.err.textContent = msg; it.wrap.classList.add('invalid'); }
      }
      return errs;
    };
    api.setValue = (fid, v) => {
      if (v === '' || v == null) delete vals[fid]; else vals[fid] = v;
      const it = items.find((i) => i.f.id === fid);
      if (it && it.ctl && it.ctl.update) it.ctl.update();
      refresh();
    };
    api.refresh = refresh;
    api.destroy = () => items.forEach((it) => it.ctl && it.ctl.destroy && it.ctl.destroy());

    host.replaceChildren();
    const single = form.sections.length === 1;
    for (const sec of form.sections) {
      const prog = h('span.sec-prog');
      const el = h('section.fsec', { id: 'sec-' + sec.id },
        !single && h('header.fsec-h', h('span.sec-id', { text: sec.id }), h('h2', L(sec.title)), prog),
        sec.intro && h('p.fsec-intro', L(sec.intro)),
        sec.note && h('div.callout', icon('info'), h('div', L(sec.note))));
      secs.push({ sec, el, prog });
      for (const f of sec.fields) {
        const it = renderItem(f);
        items.push(it);
        el.append(it.wrap);
      }
      host.append(el);
    }
    refresh();
    return api;
  };

  /* ---------------- print (blank questionnaire or filled record) ---------------- */
  const box = (on) => (on ? '☒ ' : '☐ ');

  function printGrid(f, v) {
    const t = h('table.p-tbl');
    t.append(h('tr', h('th'), ...f.cols.map((c) => h('th', L(c)))));
    for (const r of f.rows) {
      t.append(h('tr', h('td', L(r), r.note && h('small.p-anchor', L(r.note))), ...f.cols.map((c) => {
        const val = v && v[r.v] && v[r.v][c.v];
        const sc = val && f.scale.find((x) => x.v === val);
        return h('td', sc ? L(sc) : '');
      })));
    }
    return h('div', t, h('div.p-legend', 'Scale: ', ...f.scale.map((s) => h('span', L(s), '   '))));
  }

  function printTable(f, rows, vals, ctx) {
    const filled = Array.isArray(rows) && rows.length;
    const data = filled ? rows : Array.from({ length: f.printRows || 8 }, () => ({}));
    const comp = filled ? TT.tableComputed(f, data, vals, ctx) : [];
    const t = h('table.p-tbl');
    t.append(h('tr', h('th', '#'), ...f.columns.map((c) => h('th', L(c.label), c.unit ? ` (${c.unit})` : ''))));
    data.forEach((r, i) => t.append(h('tr', h('td', String(i + 1)), ...f.columns.map((c) => {
      let v = c.computed ? comp[i] && comp[i][c.id] : r[c.id];
      if (c.type === 'gps' && v) v = `${v.lat.toFixed(6)}, ${v.lon.toFixed(6)}`;
      else if ((c.type === 'select' || c.type === 'bsyear') && v != null) v = TT.optLabel(c, v);
      else if (c.type === 'check') v = filled ? (v ? '☒' : '') : '☐';
      else if (typeof v === 'number') v = TT.fix(v, c.dp ?? 3);
      return h('td', v == null ? '' : String(v));
    }))));
    const out = h('div', t);
    if (filled && f.summary) {
      try { out.append(h('div.p-legend', ...(f.summary(data, comp, vals, ctx) || []).map(([k, v]) => h('span', `${k}: ${v ?? '—'}   `)))); } catch (e) { /* ignore */ }
    }
    const legend = f.columns.filter((c) => c.type === 'select' && !filled);
    legend.forEach((c) => out.append(h('div.p-legend', h('b', TT.Ls(c.label, 'en') + ': '), c.options.map((o) => TT.Ls(o, 'en')).join(' · '))));
    return out;
  }

  function printField(form, f, vals, filled, ctx) {
    if (f.type === 'info') return h('div.p-info', L(f.text), f.items && h('ul', ...f.items.map((i) => h('li', L(i)))));
    const v = vals[f.id];
    const when = !filled ? TT.whenText(form, f) : '';
    const q = h('div.p-q');
    q.append(h('div.p-ql', h('b', `${f.num}. `), L(f.q), when && h('em.p-when', ` → ${when}`)));
    if (f.hint) q.append(h('div.p-hint', L(f.hint)));
    switch (f.type) {
      case 'radio': case 'select': case 'yn': case 'scale': case 'checks': case 'months': case 'person': case 'people': {
        const multi = f.type === 'checks' || f.type === 'months' || f.type === 'people';
        q.append(h('div.p-opts', ...f.options.map((o) => h('span.p-opt', box(multi ? (v || []).includes(o.v) : v === o.v), L(o)))));
        if (f.other) q.append(h('div.p-line', 'Other: ', filled ? vals[f.id + '__other'] || '' : '______________________'));
        break;
      }
      case 'bsyear': q.append(h('div.p-line', filled ? TT.valueText(f, v, vals) : 'Year BS: ________   (≈ AD ________)   ☐ Don’t know')); break;
      case 'rank': q.append(h('div.p-line', filled ? TT.valueText(f, v, vals) : '1st: ____   2nd: ____   3rd: ____   (write item numbers)'), h('ol.p-ranklist', ...f.options.map((o) => h('li', L(o))))); break;
      case 'grid': q.append(printGrid(f, v)); break;
      case 'table': q.append(printTable(f, v, vals, ctx)); break;
      case 'gps': {
        const u = v && TT.utm(v.lat, v.lon);
        q.append(h('div.p-line', filled && v ? `${TT.gpsText(v)}${u ? `   UTM44N E ${u.e.toFixed(1)} N ${u.n.toFixed(1)}` : ''}` : 'Lat ____________   Lon ____________   ± ____ m   GPS waypoint no. ______'));
        break;
      }
      case 'photos': q.append(h('div.p-line', filled ? (v || []).join(', ') || '—' : 'Photo IDs: __________________________________')); break;
      case 'track': q.append(h('div.p-line', filled && Array.isArray(v) && v.length ? `${v.length} points, ${Math.round(TT.trackLength(v) || 0)} m` : 'GPS track file / waypoints: ______________________')); break;
      case 'textarea': q.append(filled ? h('div.p-ans', v || '—') : h('div.p-box')); break;
      case 'computed': q.append(h('div.p-line', filled ? `${v ?? '—'} ${f.unit || ''}` : '(calculated in the portal)')); break;
      default: q.append(h('div.p-line', filled ? `${v ?? '—'} ${v != null && f.unit ? f.unit : ''}` : `__________________ ${f.unit || ''}`));
    }
    if (f.evidence) q.append(h('div.p-evi', 'Source: ', ...TT.O.src.map((o) => h('span.p-opt', box(filled && vals[f.id + '__src'] === o.v), L(o)))));
    if (filled && vals[f.id + '__note']) q.append(h('div.p-note', 'Note: ' + vals[f.id + '__note']));
    return q;
  }

  TT.printDoc = function (form, rec, ctx) {
    const vals = rec ? rec.data : {};
    const filled = !!rec;
    const doc = h('article.print-doc');
    doc.append(h('header.p-head',
      h('div.p-brand', `${filled && TT.LAKES[vals.lake] ? TT.lakeName(vals.lake) : 'Timure Taal / Chhekmi Taal'} field investigation · Gulmi`),
      h('h1', L(form.title)),
      h('div.p-meta', filled
        ? `Record ${rec.id} · ${rec.status} · created ${TT.fmt(rec.created)} · updated ${TT.fmt(rec.updated)}${rec.enumerator ? ' · ' + rec.enumerator : ''}`
        : `Form ${form.short} v${form.version} · Record no. ____________ · Enumerator ____________ · Date ____ / ____ / ______ · Start ____:____ End ____:____`)));
    for (const sec of form.sections) {
      if (filled && sec.showIf && !safe(sec.showIf, vals)) continue;
      const s = h('section.p-sec', form.sections.length > 1 && h('h2', `${sec.id}. `, L(sec.title), !filled && sec._dep ? h('em.p-when', ` → ${TT.whenText(form, sec)}`) : null));
      if (sec.intro) s.append(h('p.p-intro', L(sec.intro)));
      if (sec.note) s.append(h('p.p-note', L(sec.note)));
      for (const f of sec.fields) {
        if (filled && !TT.visible(f, vals)) continue;
        s.append(printField(form, f, vals, filled, ctx));
      }
      doc.append(s);
    }
    return doc;
  };
})();
