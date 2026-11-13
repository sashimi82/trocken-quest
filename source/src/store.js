/* Trocken-Quest – Speicher
 * Gleiche Schnittstelle für beide Varianten:
 *   LocalStore   – speichert auf diesem Gerät (Etappe 1–4, Vorschau)
 *   SupabaseStore – gemeinsamer Online-Speicher (siehe supabase/schema.sql)
 * Methoden: load(), addEvent(e), deleteEvent(id), saveSettings(s), savePrefs(p),
 *           exportAll(), importAll(obj), reset(), onChange(cb)
 */
(function (root) {
  'use strict';

  const mem = {};
  function lsGet(k) {
    try { const v = root.localStorage.getItem(k); return v == null ? (k in mem ? mem[k] : null) : v; }
    catch (e) { return k in mem ? mem[k] : null; }
  }
  function lsSet(k, v) {
    mem[k] = v;
    try { root.localStorage.setItem(k, v); } catch (e) { /* nur im Speicher */ }
  }
  function lsDel(k) {
    delete mem[k];
    try { root.localStorage.removeItem(k); } catch (e) { /* ignore */ }
  }
  function parse(v, fb) { try { return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }

  function LocalStore(ns) {
    const K = { s: ns + '.settings', e: ns + '.events', p: ns + '.prefs' };
    const listeners = [];
    const emit = () => listeners.forEach((cb) => { try { cb(); } catch (e) { /* ignore */ } });
    try {
      root.addEventListener('storage', (ev) => { if (ev.key && ev.key.indexOf(ns + '.') === 0) emit(); });
    } catch (e) { /* ignore */ }

    const api = {
      kind: 'local',
      persistent: (function () { try { const t = '__tq'; root.localStorage.setItem(t, '1'); root.localStorage.removeItem(t); return true; } catch (e) { return false; } })(),
      load() {
        return {
          settings: parse(lsGet(K.s), null),
          events: parse(lsGet(K.e), []),
          prefs: parse(lsGet(K.p), {})
        };
      },
      addEvent(ev) {
        const list = parse(lsGet(K.e), []);
        if (!list.some((x) => x.id === ev.id)) list.push(ev);
        lsSet(K.e, JSON.stringify(list));
        return ev;
      },
      deleteEvent(id) {
        const list = parse(lsGet(K.e), []).filter((x) => x.id !== id);
        lsSet(K.e, JSON.stringify(list));
      },
      saveSettings(s) { lsSet(K.s, JSON.stringify(s)); },
      savePrefs(p) { lsSet(K.p, JSON.stringify(p)); },
      exportAll() { return Object.assign({ format: 'trocken-quest', v: 1, exportedAt: new Date().toISOString() }, api.load()); },
      importAll(obj) {
        if (!obj || obj.format !== 'trocken-quest') throw new Error('Das ist keine Trocken-Quest-Sicherung.');
        if (obj.settings) lsSet(K.s, JSON.stringify(obj.settings));
        lsSet(K.e, JSON.stringify(Array.isArray(obj.events) ? obj.events : []));
        lsSet(K.p, JSON.stringify(obj.prefs || {}));
      },
      reset() { lsDel(K.s); lsDel(K.e); lsDel(K.p); },
      onChange(cb) { listeners.push(cb); }
    };
    return api;
  }

  /* ---------- Gemeinsamer Speicher (Supabase) ----------
   * Die App arbeitet immer mit einer Kopie auf dem Gerät (sofort, auch ohne Netz).
   * Änderungen landen in einer Warteschlange und werden ans Online-Konto geschickt.
   * Alle 20 Sekunden (und beim Öffnen) holt das Gerät die Änderungen der anderen Geräte.
   * Nur die Projekt-Adresse und der öffentliche Schlüssel stehen im Code; die Zugriffsregeln
   * liegen in der Datenbank (supabase/schema.sql).
   */
  function SupabaseStore(cfg) {
    const base = String(cfg.supabaseUrl || '').replace(/\/+$/, '');
    const key = cfg.supabaseKey;
    const cache = LocalStore('tq-live');
    const K = { auth: 'tq-live.auth', fam: 'tq-live.family', out: 'tq-live.outbox', sig: 'tq-live.sig', meta: 'tq-live.meta', sync: 'tq-live.lastSync' };
    const listeners = [];
    const emit = (why) => listeners.forEach((cb) => { try { cb(why); } catch (e) { /* ignore */ } });
    let session = parse(lsGet(K.auth), null);
    let family = parse(lsGet(K.fam), null);
    let outbox = parse(lsGet(K.out), []);
    let refreshing = null, flushing = null, pulling = null, timer = null, backoff = 0;
    const status = { online: true, lastSync: +lsGet(K.sync) || 0, error: '', rejected: 0 };

    function saveOutbox() { lsSet(K.out, JSON.stringify(outbox)); }
    function setSession(s) { session = s; if (s) lsSet(K.auth, JSON.stringify(s)); else lsDel(K.auth); }
    function setFamily(f) { family = f; if (f) lsSet(K.fam, JSON.stringify(f)); else lsDel(K.fam); }

    function fail(status, msg, code) { const e = new Error(msg || ('Fehler ' + status)); e.status = status; e.code = code; return e; }
    async function raw(method, path, body, headers) {
      let res;
      try {
        res = await root.fetch(base + path, { method, headers: Object.assign({ apikey: key, 'Content-Type': 'application/json' }, headers || {}), body: body == null ? undefined : JSON.stringify(body) });
      } catch (e) { throw fail(0, 'Keine Verbindung'); }
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
      if (!res.ok) throw fail(res.status, (data && (data.message || data.msg || data.error_description || data.error)) || ('Fehler ' + res.status), data && (data.code || data.error_code));
      return { data, res };
    }
    function keep(d) {
      const exp = d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000;
      return { access_token: d.access_token, refresh_token: d.refresh_token, expires: exp, user: d.user && d.user.id };
    }
    async function signIn() {
      const { data } = await raw('POST', '/auth/v1/signup', { data: {} });
      if (!data || !data.access_token) throw fail(400, 'Anmeldung nicht möglich');
      setSession(keep(data));
    }
    function refresh() {
      if (refreshing) return refreshing;
      refreshing = (async () => {
        try {
          const { data } = await raw('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
          setSession(keep(data));
        } catch (e) {
          // Sitzung ungültig (z. B. gelöscht): Gerät muss mit dem Code neu beitreten
          if (e.status >= 400 && e.status < 500) { setSession(null); setFamily(null); emit('signedout'); }
          throw e;
        }
      })().finally(() => { refreshing = null; });
      return refreshing;
    }
    async function ensureSession() {
      if (!session) await signIn();
      else if (Date.now() > session.expires - 60000) await refresh();
    }
    async function api(method, path, body, headers) {
      await ensureSession();
      const h = () => Object.assign({ Authorization: 'Bearer ' + session.access_token }, headers || {});
      try { return await raw(method, path, body, h()); }
      catch (e) {
        if (e.status === 401 && session) { await refresh(); return raw(method, path, body, h()); }
        throw e;
      }
    }

    // Eintrag <-> Tabellenzeile
    function toRow(ev) {
      const body = Object.assign({}, ev);
      ['id', 'day', 'ts', 'type', 'by'].forEach((k) => delete body[k]);
      return { id: ev.id, family_id: family.id, day: ev.day, ts: ev.ts, type: ev.type, by: ev.by || null, body };
    }
    function fromRow(r) {
      const ts = new Date(r.ts).toISOString();
      return Object.assign({}, r.body || {}, { id: r.id, day: r.day, ts, type: r.type, by: r.by || undefined });
    }

    function queue(op) {
      if (op.op === 'set' || op.op === 'prefs') outbox = outbox.filter((o) => o.op !== op.op);
      if (op.op === 'del') {
        const i = outbox.findIndex((o) => o.op === 'ins' && o.ev.id === op.id);
        if (i >= 0) { outbox.splice(i, 1); saveOutbox(); return; }   // noch nicht gesendet: einfach weglassen
      }
      outbox.push(op); saveOutbox();
      schedule(300);
    }
    async function send(o) {
      if (o.op === 'ins') return api('POST', '/rest/v1/events?on_conflict=id', toRow(o.ev), { Prefer: 'resolution=ignore-duplicates,return=minimal' });
      if (o.op === 'del') return api('DELETE', '/rest/v1/events?id=eq.' + encodeURIComponent(o.id), null, { Prefer: 'return=minimal' });
      if (o.op === 'set') return api('POST', '/rest/v1/settings?on_conflict=family_id', { family_id: family.id, data: o.data, updated_at: new Date().toISOString() }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
      if (o.op === 'prefs') return api('POST', '/rest/v1/prefs?on_conflict=family_id', { family_id: family.id, data: o.data, updated_at: new Date().toISOString() }, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    }
    function flush() {
      if (flushing) return flushing;
      flushing = (async () => {
        {
          while (family && outbox.length) {
            const o = outbox[0];
            try { await send(o); }
            catch (e) {
              if (e.status === 0 || e.status >= 500 || e.status === 401 || e.status === 429) throw e;
              // Vom Server abgelehnt (keine Berechtigung, ungültig): verwerfen, damit nichts hängen bleibt
              status.rejected++; status.error = e.message; status.rejectedNow = true;
              emit('rejected');
            }
            outbox.shift(); saveOutbox();
            lsDel(K.sig);
            if (o.op !== 'ins' || status.rejectedNow) lsDel(K.meta);   // Löschen oder Ablehnung: alles frisch holen
            status.rejectedNow = false;
          }
        }
      })().finally(() => { flushing = null; });
      return flushing;
    }
    async function pullAll() {
      if (!family) return false;
      const [st, pr] = await Promise.all([
        api('GET', '/rest/v1/settings?select=data,updated_at'),
        api('GET', '/rest/v1/prefs?select=data,updated_at')
      ]);
      const head = await api('GET', '/rest/v1/events?select=id&order=created_at.desc,id.desc&limit=1', null, { Prefer: 'count=exact' });
      const range = head.res.headers.get('content-range') || '';
      const count = +(range.split('/')[1] || 0);
      const sig = [count, head.data && head.data[0] ? head.data[0].id : '', st.data[0] ? st.data[0].updated_at : '', pr.data[0] ? pr.data[0].updated_at : ''].join('|');
      const before = cache.load();
      if (sig === lsGet(K.sig) && before.settings) return false;
      const latest = head.data && head.data[0] ? head.data[0].id : '';
      const meta = parse(lsGet(K.meta), null);
      const pendInsIds = new Set(outbox.filter((o) => o.op === 'ins').map((o) => o.ev.id));
      const cached = before.events.filter((e) => !pendInsIds.has(e.id));
      const page = async (filter) => {
        const rows = [];
        for (let off = 0; ; off += 1000) {
          const r = await api('GET', '/rest/v1/events?select=id,day,ts,type,body,by,created_at' + filter + '&order=created_at.asc,id.asc&limit=1000&offset=' + off);
          r.data.forEach((row) => rows.push(row));
          if (r.data.length < 1000) break;
        }
        return rows;
      };
      let events, rows = null;
      if (meta && meta.count === count && meta.latest === latest) events = cached;
      else {
        if (meta && meta.maxCreated) {
          const fresh = await page('&created_at=gt.' + encodeURIComponent(meta.maxCreated));
          const freshIds = new Set(fresh.map((r) => r.id));
          if (meta.count + fresh.length === count) {
            events = cached.filter((e) => !freshIds.has(e.id)).concat(fresh.map(fromRow));
            rows = fresh;
          }
        }
        if (!events) { rows = await page(''); events = rows.map(fromRow); }
      }
      const maxCreated = rows && rows.length ? rows[rows.length - 1].created_at : (meta && meta.maxCreated) || '';
      lsSet(K.meta, JSON.stringify({ count, latest, maxCreated: maxCreated > ((meta && meta.maxCreated) || '') ? maxCreated : (meta && meta.maxCreated) || maxCreated }));
      // Noch nicht gesendete eigene Änderungen behalten
      const pendIns = outbox.filter((o) => o.op === 'ins').map((o) => o.ev);
      const pendDel = new Set(outbox.filter((o) => o.op === 'del').map((o) => o.id));
      const ids = new Set(events.map((e) => e.id));
      events = events.filter((e) => !pendDel.has(e.id)).concat(pendIns.filter((e) => !ids.has(e.id)));
      const pendSet = outbox.find((o) => o.op === 'set'), pendPrefs = outbox.find((o) => o.op === 'prefs');
      const settings = pendSet ? pendSet.data : (st.data[0] ? st.data[0].data : before.settings);
      const prefs = pendPrefs ? pendPrefs.data : (pr.data[0] ? pr.data[0].data : before.prefs || {});
      cache.importAll({ format: 'trocken-quest', settings, events, prefs });
      lsSet(K.sig, sig);
      const changed = JSON.stringify(before.events.map((e) => e.id)) !== JSON.stringify(events.map((e) => e.id)) ||
        JSON.stringify(before.settings) !== JSON.stringify(settings) || JSON.stringify(before.prefs) !== JSON.stringify(prefs);
      return changed;
    }
    function sync() {
      if (pulling) return pulling;
      pulling = (async () => {
        try {
          await flush();
          const changed = await pullAll();
          status.online = true; status.lastSync = Date.now(); lsSet(K.sync, String(status.lastSync));
          if (status.error && !status.rejected) status.error = '';
          backoff = 0;
          if (changed) emit('remote');
          emit('status');
          return true;
        } catch (e) {
          status.online = e.status !== 0 ? status.online : false;
          if (e.status !== 0) status.error = e.message;
          backoff = Math.min(120000, (backoff || 5000) * 2);
          emit('status');
          return false;
        } finally { schedule(); }
      })().finally(() => { pulling = null; });
      return pulling;
    }
    function visible() { try { return root.document.visibilityState !== 'hidden'; } catch (e) { return true; } }
    function schedule(ms) {
      clearTimeout(timer);
      if (!family) return;
      timer = setTimeout(() => { if (visible()) sync(); else schedule(); }, ms != null ? ms : (backoff || 20000));
    }
    try {
      root.document.addEventListener('visibilitychange', () => { if (visible()) schedule(200); });
      root.addEventListener('online', () => schedule(200));
      root.addEventListener('focus', () => schedule(500));
    } catch (e) { /* ignore */ }

    const api2 = {
      kind: 'supabase',
      persistent: cache.persistent,
      status: () => Object.assign({ pending: outbox.length, family: family ? { role: family.role, device: family.device } : null }, status),
      ready: () => !!family,
      role: () => (family ? family.role : null),
      load: () => cache.load(),
      addEvent(ev) { const list = cache.load().events; cache.addEvent(ev); if (!list.some((x) => x.id === ev.id)) queue({ op: 'ins', ev }); return ev; },
      deleteEvent(id) { cache.deleteEvent(id); queue({ op: 'del', id }); },
      saveSettings(s) { cache.saveSettings(s); if (family && family.role === 'eltern') queue({ op: 'set', data: s }); },
      savePrefs(p) { cache.savePrefs(p); queue({ op: 'prefs', data: p }); },
      exportAll: () => cache.exportAll(),
      importAll() { throw new Error('Im gemeinsamen Speicher kann keine Sicherung eingespielt werden.'); },
      reset() { /* gemeinsame Daten werden nie vom Gerät aus gelöscht */ },
      onChange(cb) { listeners.push(cb); },
      sync,
      async createFamily(device) {
        await ensureSession();
        const { data } = await api('POST', '/rest/v1/rpc/create_family', { device });
        const r = Array.isArray(data) ? data[0] : data;
        cache.reset(); outbox = []; saveOutbox(); lsDel(K.sig); lsDel(K.meta);
        setFamily({ id: r.family_id, role: 'eltern', device });
        return { kidCode: r.kid_code, parentCode: r.parent_code };
      },
      async joinFamily(code, device) {
        await ensureSession();
        const { data } = await api('POST', '/rest/v1/rpc/join_family', { code, device: device || null });
        const r = Array.isArray(data) ? data[0] : data;
        if (!family || family.id !== r.family_id) { cache.reset(); outbox = []; saveOutbox(); lsDel(K.sig); lsDel(K.meta); }
        setFamily({ id: r.family_id, role: r.role, device: device || null });
        await sync();
        return { role: r.role };
      },
      async codes() {
        const { data } = await api('GET', '/rest/v1/families?select=kid_code,parent_code');
        return data[0] ? { kidCode: data[0].kid_code, parentCode: data[0].parent_code } : null;
      },
      async members() {
        const { data } = await api('GET', '/rest/v1/members?select=user_id,role,device,created_at&order=created_at.asc');
        return data.map((m) => Object.assign({ me: session && m.user_id === session.user }, m));
      },
      async removeMember(userId) { await api('DELETE', '/rest/v1/members?user_id=eq.' + encodeURIComponent(userId), null, { Prefer: 'return=minimal' }); },
      leave() { clearTimeout(timer); setFamily(null); setSession(null); outbox = []; saveOutbox(); lsDel(K.sig); lsDel(K.meta); cache.reset(); },
      _debug: () => ({ session, family, outbox })
    };
    if (family) schedule(50);
    return api2;
  }

  /* Geräte-Einstellungen (bleiben immer lokal): Rolle, Demo-Modus */
  const Device = {
    get() {
      const d = parse(lsGet('tq.device'), {});
      if (d.role && ['kind', 'mama', 'papa'].indexOf(d.role) < 0) d.role = 'kind';   // ältere Versionen
      return d;
    },
    set(d) { lsSet('tq.device', JSON.stringify(d)); }
  };

  root.TQStore = { LocalStore, SupabaseStore, Device };
})(typeof window !== 'undefined' ? window : globalThis);
