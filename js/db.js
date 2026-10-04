/* Timure Taal field portal: IndexedDB storage (records, photos, meta). */
'use strict';
(function () {
  const TT = window.TT;
  const DB_NAME = 'timure-taal-portal';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' }).createIndex('form', 'form');
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' }).createIndex('record', 'record');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
      rq.onblocked = () => rej(new Error('Database is open in another tab with an older version. Close other tabs and reload.'));
    });
    return dbp;
  }

  const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  // Resolve writes only when the transaction has committed (field data must survive a dead battery).
  async function write(stores, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(stores, 'readwrite');
      let out;
      try { out = fn(t); } catch (e) { t.abort(); rej(e); return; }
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Transaction aborted'));
    });
  }

  async function read(store) { return (await open()).transaction(store, 'readonly').objectStore(store); }

  TT.db = {
    all: async (store) => wrap((await read(store)).getAll()),
    get: async (store, key) => wrap((await read(store)).get(key)),
    byIndex: async (store, idx, key) => wrap((await read(store)).index(idx).getAll(key)),
    put: (store, val) => write([store], (t) => { t.objectStore(store).put(val); }),
    putMany: (store, vals) => write([store], (t) => { const s = t.objectStore(store); vals.forEach((v) => s.put(v)); }),
    del: (store, key) => write([store], (t) => { t.objectStore(store).delete(key); }),

    async deleteRecord(id) {
      const photos = await TT.db.byIndex('photos', 'record', id);
      return write(['records', 'photos'], (t) => {
        t.objectStore('records').delete(id);
        const ps = t.objectStore('photos');
        photos.forEach((p) => ps.delete(p.id));
      });
    },

    async clearAll() {
      return write(['records', 'photos'], (t) => { t.objectStore('records').clear(); t.objectStore('photos').clear(); });
    },

    async getMeta(k, dflt) {
      const r = await TT.db.get('meta', k);
      return r ? r.v : dflt;
    },
    setMeta: (k, v) => TT.db.put('meta', { k, v }),

    // Atomic per-device counter (record codes and photo IDs).
    async nextSeq(key) {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction('meta', 'readwrite');
        const s = t.objectStore('meta');
        let v = 0;
        const g = s.get('seq:' + key);
        g.onsuccess = () => { v = ((g.result && g.result.v) || 0) + 1; s.put({ k: 'seq:' + key, v }); };
        t.oncomplete = () => res(v);
        t.onerror = () => rej(t.error);
      });
    },

    async releaseSeq(key, v) {
      const db = await open();
      return new Promise((res) => {
        const t = db.transaction('meta', 'readwrite');
        const s = t.objectStore('meta');
        const g = s.get('seq:' + key);
        g.onsuccess = () => { if (g.result && g.result.v === v) s.put({ k: 'seq:' + key, v: v - 1 }); };
        t.oncomplete = () => res();
        t.onerror = () => res();
      });
    },
  };

  // Two-character device code keeps record IDs unique when several phones are merged.
  TT.deviceCode = async function () {
    let code = await TT.db.getMeta('device');
    if (!code) {
      const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const r = crypto.getRandomValues(new Uint8Array(2));
      code = abc[r[0] % abc.length] + abc[r[1] % abc.length];
      await TT.db.setMeta('device', code);
    }
    return code;
  };

  TT.DEFAULT_SETTINGS = { enumerator: '', team: '', lang: 'both', evap: 4, evapTol: 2, lastExport: null };
  TT.loadSettings = async () => ({ ...TT.DEFAULT_SETTINGS, ...(await TT.db.getMeta('settings', {})) });
  TT.saveSettings = (s) => TT.db.setMeta('settings', s);
})();
