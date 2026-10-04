/* Timure Taal field portal: shared helpers (no dependencies). */
'use strict';
(function () {
  const TT = (window.TT = window.TT || {});

  TT.VERSION = '1.1.0';
  TT.APP = 'timure-taal-portal';

  TT.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function append(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false || k === '') continue;
      el.append(k instanceof Node ? k : String(k));
    }
  }

  // h('div.a.b', {props}, ...children). Text is always inserted as text nodes.
  TT.h = function h(tag, props, ...kids) {
    // Allow h('p', child, ...) without a props object.
    if (props != null && (props instanceof Node || typeof props !== 'object' || Array.isArray(props))) { kids.unshift(props); props = null; }
    const [name, ...classes] = tag.split('.');
    const el = document.createElement(name || 'div');
    if (classes.length) el.className = classes.join(' ');
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (typeof v !== 'string' && k in el) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, kids);
    return el;
  };
  const h = TT.h;

  // English only: {ne, en} objects render their English text.
  TT.L = (t) => (t == null ? null : document.createTextNode(typeof t === 'object' ? t.en || t.ne || '' : String(t)));
  TT.Ls = (t) => (t == null ? '' : typeof t === 'object' ? t.en || t.ne || '' : String(t));

  /* ---------- icons (24x24 line icons, drawn for this portal) ---------- */
  const C = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const R = (x, y, w, hh, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${hh - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(hh - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
  const ICONS = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
    users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' + C(9, 7, 4) + 'M22 20v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    chart: 'M3 3v18h18M7 15v2M11 11v6M15 7v10M19 13v4',
    book: 'M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    printer: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    plus: 'M12 5v14M5 12h14',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
    check: 'M20 6L9 17l-5-5',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
    copy: R(9, 9, 13, 13, 2) + 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    pin: 'M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z' + C(12, 10, 3),
    camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' + C(12, 13, 4),
    image: R(3, 3, 18, 18, 2) + C(8.5, 8.5, 1.5) + 'M21 15l-5-5L5 21',
    x: 'M18 6L6 18M6 6l12 12',
    chevron: 'M9 18l6-6-6-6',
    back: 'M15 18l-6-6 6-6',
    alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    drop: 'M12 2.7l5.7 5.6a8 8 0 1 1-11.3 0z',
    map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16',
    clock: C(12, 12, 10) + 'M12 6v6l4 2',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    level: C(12, 12, 9) + 'M21 12h-5M8 12H3M12 3v5M12 16v5',
    flask: 'M9 3h6M10 3v6L4 20a1 1 0 0 0 .9 1.5h14.2A1 1 0 0 0 20 20L14 9V3',
    wave: 'M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0M12 2v7M9 6l3 3 3-3',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    target: C(12, 12, 10) + C(12, 12, 6) + C(12, 12, 2),
    calendar: R(3, 4, 18, 18, 2) + 'M16 2v4M8 2v4M3 10h18',
    archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
    pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
    compass: C(12, 12, 10) + 'M16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3z',
    checklist: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    anchor: C(12, 5, 3) + 'M12 22V8M5 12H2a10 10 0 0 0 20 0h-3',
    thermo: 'M14 14.8V3.5a2.5 2.5 0 0 0-5 0v11.3a4.5 4.5 0 1 0 5 0z',
    funnel: 'M22 3H2l8 9.5V19l4 2v-8.5z',
    flow: 'M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6',
    info: C(12, 12, 10) + 'M12 16v-4M12 8h.01',
    search: C(11, 11, 8) + 'M21 21l-4.4-4.4',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' + C(12, 12, 3),
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    wall: 'M2 6h20v12H2zM2 12h20M8 6v6M16 6v6M12 12v6',
    sun: C(12, 12, 4) + 'M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.8-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
    note: 'M4 4h16v12H8l-4 4zM8 8h8M8 12h5',
    crosshair: C(12, 12, 10) + 'M22 12h-4M6 12H2M12 6V2M12 22v-4',
  };
  TT.icon = function (name, cls) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', ICONS[name] || ICONS.info);
    svg.append(p);
    return svg;
  };

  /* ---------- dates: AD + Bikram Sambat (year level) ---------- */
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  TT.pad = pad;
  // Baisakh 1 falls on 13-15 April; year-level labels only, so 14 April is used as the boundary.
  TT.bsYearOf = (d = new Date()) => {
    const afterNewYear = d.getMonth() > 3 || (d.getMonth() === 3 && d.getDate() >= 14);
    return d.getFullYear() + (afterNewYear ? 57 : 56);
  };
  TT.bsLabel = (y) => `${y} (${y - 57}/${String(y - 56).slice(-2)})`;
  TT.neDigits = (s) => String(s).replace(/\d/g, (d) => '०१२३४५६७८९'[d]);
  TT.localInput = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  TT.today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  TT.hhmm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  TT.fmt = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return String(iso);
    return `${TT.today(d)} ${TT.hhmm(d)}`;
  };
  TT.stamp = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;

  /* ---------- numbers ---------- */
  TT.num = (v) => {
    if (v == null || v === '') return null;
    const x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(x) ? x : null;
  };
  TT.round = (x, d = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
  TT.fix = (x, d = 2) => (x == null || !Number.isFinite(x) ? '' : x.toFixed(d));
  TT.mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  TT.sd = (a) => {
    if (a.length < 2) return null;
    const m = TT.mean(a);
    return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
  };

  TT.uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  }));

  TT.debounce = (fn, ms) => {
    let t;
    const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    d.flush = (...a) => { clearTimeout(t); return fn(...a); };
    return d;
  };

  TT.download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  TT.slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  TT.loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return res();
    const s = h('script', { src, dataset: { src } });
    s.onload = () => res();
    s.onerror = () => rej(new Error('Could not load ' + src));
    document.head.append(s);
  });
})();
