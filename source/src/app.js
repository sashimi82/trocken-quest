/* Trocken-Quest – App-Gerüst und Kinder-Ansicht */
(function () {
  'use strict';
  const E = window.Engine, W = window.World, P = window.PHYSIO, S = window.TQStore;

  /* ---------- Helfer ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const reduceMotion = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  const IP = {
    drop: '<path d="M12 3C12 3 5 11 5 15a7 7 0 0 0 14 0C19 11 12 3 12 3z"/>',
    scan: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    training: '<path d="M3 10v4M6.5 7v10M17.5 7v10M21 10v4M6.5 12h11"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    bed: '<path d="M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><rect x="5" y="10" width="3" height="3"/>',
    lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 3 3 3 3s1-3 0-7z"/>',
    shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
    wood: '<rect x="4" y="8" width="16" height="8"/><path d="M9 8v8M15 8v8"/>',
    stone: '<path d="M4 17l2-8 6-3 6 4 2 7z"/>',
    crystal: '<path d="M12 3l6 7-6 11-6-11zM6 10h12"/>',
    island: '<path d="M3 13h18l-4 5H7zM12 13V4l6 4h-6"/>',
    sword: '<path d="M19 5L9 15M6 18l-2 2M7 13l4 4M15 5h4v4"/>',
    chest: '<rect x="3" y="9" width="18" height="11"/><path d="M3 9l2-4h14l2 4M3 13h18M11 13v3h2v-3"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
    pause: '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    close: '<path d="M5 5l14 14M19 5L5 19"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11-1A4 4 0 0 0 7 18z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    today: '<rect x="4" y="5" width="16" height="15"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    star: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    minus: '<path d="M5 12h14"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ff: '<path d="M4 6l7 6-7 6zM13 6l7 6-7 6z" fill="currentColor"/>',
    note: '<path d="M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h6"/>'
  };
  function icon(name, size) {
    const s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">' + (IP[name] || '') + '</svg>';
  }

  /* ---------- Zustand ---------- */
  const App = {
    device: {}, store: null, data: null, st: null, plan: null,
    view: 'heute',
    ui: { eltTab: 'uebersicht', parentOk: false, sheet: null, player: null, celebrate: [], toast: null, openBlock: null, tick: 0, confirmDel: null }
  };
  window.TQ = App;
  App.esc = esc; App.icon = icon; App.$ = $; App.$$ = $$;

  // Gemeinsamer Speicher, wenn die Seite mit Online-Konto ausgeliefert wird (GitHub-Version)
  const CFG = window.TQ_CONFIG || null;
  const LIVE = !!(CFG && CFG.supabaseUrl && CFG.supabaseKey && S.SupabaseStore);
  App.LIVE = LIVE;
  let liveStore = null;
  function storeFor(device) {
    if (device.demo) return S.LocalStore('tq-demo');
    if (LIVE) {
      if (!liveStore) { liveStore = S.SupabaseStore(CFG); liveStore.onChange(onLive); }
      return liveStore;
    }
    return S.LocalStore('tq');
  }
  App.isKidDevice = () => !App.device.demo && LIVE && liveStore && liveStore.role() === 'kind';
  // Änderungen von anderen Geräten
  function onLive(why) {
    if (App.store !== liveStore) return;
    if (why === 'remote') {
      load();
      const busy = App.ui.player || App.ui.panel || App.ui.sheet || App.ui.celebrate.length || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
      if (busy) { App.ui.dirty = true; return; }
      if (App.view === 'insel') refreshInsel(); else render();
    } else if (why === 'rejected') {
      toast('Eine Änderung wurde nicht gespeichert (keine Berechtigung auf diesem Gerät).');
    } else if (why === 'signedout') {
      saveDevice({ role: null });
      App.ui.setup = { step: 'choose', err: 'Dieses Gerät ist nicht mehr angemeldet. Bitte den Code nochmals eingeben.' };
      App.view = 'start'; render();
    } else if (why === 'status') {
      const el = document.getElementById('sync-state');
      if (el && window.TQParents) el.innerHTML = window.TQParents.syncState();
    }
  }

  // Simulierte Uhr: In der Demo kann die Zeit vorgespult werden
  function now() {
    const off = App.device.demo ? (App.device.demoOffset || 0) : 0;
    return new Date(Date.now() + off * 864e5);
  }
  App.now = now;
  function saveDevice(patch) { App.device = Object.assign({}, App.device, patch); S.Device.set(App.device); }
  App.saveDevice = saveDevice;

  // Bildschirmhöhe: Home-Bildschirm-Apps auf dem iPhone melden teils eine zu kleine Fensterhöhe.
  // Dann gilt die Bildschirmhöhe, denn die App füllt dort immer den ganzen Bildschirm.
  function fitHeight() {
    let h = window.innerHeight;
    try {
      if (window.navigator.standalone) {
        const land = window.matchMedia('(orientation: landscape)').matches;
        const sh = land ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
        if (sh > h) h = sh;
      }
    } catch (e) { /* ignore */ }
    document.documentElement.style.setProperty('--app-h', h + 'px');
  }
  App.fitHeight = fitHeight;
  function boot() {
    fitHeight();
    window.addEventListener('resize', fitHeight);
    window.addEventListener('orientationchange', () => setTimeout(fitHeight, 300));
    App.device = S.Device.get();
    // Version 2: Bis zu den finalen Entscheiden startet die App im Demo-Modus
    // Online-Version: startet echt (ohne Demo); die Demo bleibt in der Eltern-Ansicht erreichbar
    if (LIVE && !App.device.v5) saveDevice({ v2: true, v3: true, v5: true, demo: false, demoOffset: 0, guideSeen: true });
    if (!App.device.v2) saveDevice({ v2: true, demo: true, demoOffset: 0 });
    // Version 3: spielbare Insel. Die Demo startet einmal neu, damit Material zum Einsammeln bereitliegt.
    const v3fresh = !App.device.v3;
    if (v3fresh) saveDevice({ v3: true, guideSeen: false });
    App.store = storeFor(App.device);
    if (v3fresh && App.device.demo) App.store.reset();
    load();
    if (App.store.kind === 'local') App.store.onChange(() => { load(); render(); });
    registerSW();
    App.view = initialView();
    route();
    if (App.device.demo && !App.device.guideSeen) {
      saveDevice({ guideSeen: true });
      App.ui.sheet = { kind: 'guide' };
      renderOverlays();
    }
    setInterval(() => {
      const before = App.st && App.st.today;
      recompute();
      if (App.st.today !== before) render();
    }, 60000);
  }

  function load() {
    App.data = App.store.load();
    if (App.device.demo && !App.data.settings) {
      seedDemo(App.device.demoKind || 'start');
      App.data = App.store.load();
    }
    if (!App.data.settings) {
      const s = E.withDefaults(null);
      s.startDate = E.dayKey(now());
      // Online: nur das Gerät, das die Familie anlegt, speichert die ersten Einstellungen.
      // Alle anderen warten, bis sie vom Server kommen.
      if (App.store.kind !== 'supabase' || App.ui.creating) App.store.saveSettings(s);
      else App.data.localOnly = true;
      App.data.settings = s;
    }
    App.data.settings = E.withDefaults(App.data.settings);
    if (!App.data.prefs) App.data.prefs = {};
    recompute();
  }

  // Demo-Startstände: start = 3 volle Tage erledigt, weit = nach rund 4 Wochen, leer = Tag 1
  function seedDemo(kind) {
    App.store.reset();
    saveDevice({ demoOffset: 0, demoKind: kind });
    const d = kind === 'weit' ? E.makeDemo(null, now(), 26) : E.makeStart(null, now(), kind === 'leer' ? 0 : 3);
    App.store.saveSettings(d.settings);
    d.events.forEach((e) => App.store.addEvent(e));
  }
  App.seedDemo = seedDemo;

  function recompute() {
    App.st = E.compute(App.data.settings, App.data.events, now());
    App.plan = E.trainingPlan(App.data.settings, App.st.today, P);
  }
  App.recompute = recompute;

  /* ---------- Speichern ---------- */
  function addEvent(ev, opts) {
    const before = App.st;
    if (App.isKidDevice() && (ev.type === 'reward' || ev.type === 'note')) { toast('Das geht nur auf einem Eltern-iPhone.'); return Object.assign({ id: '' }, ev); }
    const t = now();
    const by = App.view === 'eltern' ? (App.device.role && App.device.role !== 'kind' ? App.device.role : 'eltern') : 'kind';
    const e = Object.assign({ id: E.uid(), ts: t.toISOString(), day: E.dayKey(t), by }, ev);
    App.store.addEvent(e);
    App.data.events.push(e);
    recompute();
    if (!(opts && opts.quiet)) celebrateChanges(before, App.st, e);
    return e;
  }
  // Mehrere Einträge auf einmal (Demo: Tag erledigen, vorspulen)
  function addEventsRaw(list) {
    list.forEach((e) => { App.store.addEvent(e); App.data.events.push(e); });
    recompute();
  }
  App.addEventsRaw = addEventsRaw;
  function deleteEvent(id) {
    App.store.deleteEvent(id);
    App.data.events = App.data.events.filter((x) => x.id !== id);
    recompute();
  }
  function saveSettings(patch) {
    if (App.isKidDevice()) { toast('Einstellungen ändern geht nur auf einem Eltern-iPhone.'); return; }
    if (App.data.localOnly) { toast('Noch keine Verbindung zum gemeinsamen Speicher. Bitte kurz warten.'); App.store.sync && App.store.sync(); return; }
    App.data.settings = Object.assign({}, App.data.settings, patch);
    App.store.saveSettings(App.data.settings);
    recompute();
  }
  function savePrefs(patch) {
    App.data.prefs = Object.assign({}, App.data.prefs, patch);
    App.store.savePrefs(App.data.prefs);
  }
  App.addEvent = addEvent; App.deleteEvent = deleteEvent; App.saveSettings = saveSettings; App.savePrefs = savePrefs;

  /* ---------- Feiern ---------- */
  const STAGE_NEW = ['', 'Neu: Stirnlampe und Schaufel. Du kannst graben!', 'Neu: Gleitflügel. Du kannst fliegen!', 'Neu: Kristallrüstung und Stab. Sonntags doppelter Boss-Schlag!'];
  function celebrateChanges(a, b, e) {
    if (!a || !b) return;
    const s = b.settings;
    if (b.level > a.level) {
      let text = 'Lilo ist stärker geworden.'.replace('Lilo', esc(s.heroName));
      if (b.stage > a.stage) text = esc(s.heroName) + ' wird ' + b.stageName + '! ' + STAGE_NEW[b.stage];
      const fresh = b.rewards.filter((r) => r.unlocked && !a.rewards.find((x) => x.id === r.id && x.unlocked));
      if (fresh.length) text += ' Schatztruhe offen: ' + fresh.map((r) => esc(r.what)).join(', ') + '. Zeig es Mama oder Papa.';
      if (b.level === s.goalLevel) text += ' Du hast das Ziel der Challenge erreicht!';
      queueCelebrate({ title: 'Level ' + b.level + '!', text, sprite: { kind: 'hero', stage: b.stage, color: s.heroColor } });
    }
    if (b.boss.defeated && !a.boss.defeated && b.boss.week === a.boss.week) {
      queueCelebrate({ title: 'Boss besiegt!', text: 'Der Sturm-Golem ist geschlagen. Beute: ' + esc(s.bossLoot) + '.', sprite: { kind: 'golem', block: 'cloud' } });
    }
    if (e.type === 'build') {
      const h = b.helpers.find((x) => x.here && !a.helpers.find((y) => y.id === x.id && y.here));
      if (h) {
        const blocks = { kiesel: 'stone', funkel: 'caveLit', splitti: 'crystal', wispel: 'cloudw' };
        queueCelebrate({ title: h.name + ' zieht ein!', text: h.name + ' wohnt jetzt: ' + h.home + '. Hilft dir: ' + h.help + '.', sprite: { kind: h.id, block: blocks[h.id] } });
      }
    }
    if (e.type === 'build' && e.item === 'kristallinsel' && b.built.kristallinsel) queueCelebrate({ title: 'Gelandet!', text: esc(s.heroName) + ' ist mit dem Gleitflügel zur Kristallinsel geflogen. Baue jetzt eine Brücke aus Holz, dann geht es auch zu Fuss.', sprite: { kind: 'hero', stage: b.stage, color: s.heroColor } });
    if (e.type === 'build' && e.item === 'bruecke' && b.built.bruecke) queueCelebrate({ title: 'Brücke gebaut!', text: 'Jetzt kannst du jederzeit zur Kristallinsel hinüberlaufen.', sprite: { kind: 'splitti', block: 'crystal' } });
    if (e.type === 'build' && e.item === 'himmelsinsel' && b.built.himmelsinsel) queueCelebrate({ title: 'Challenge geschafft!', text: 'Wispel hat dich zur Himmelsinsel getragen. Alle Inseln sind entdeckt. Du bist ein echter Held! Im Sammelbuch liegt jetzt die Himmelskrone.', sprite: { kind: 'wispel', block: 'cloudw' } });
    (b.collection || []).forEach((c) => {
      const o = (a.collection || []).find((x) => x.id === c.id);
      if (c.count > (o ? o.count : 0) && c.id !== 'himmelskrone') queueCelebrate({ title: (o && o.count ? 'Noch ein Fundstück' : 'Neu im Sammelbuch') + ': ' + c.name, text: 'Fundort: ' + (c.from === 'Truhe' ? 'eine Truhe aus der Höhle' : 'Sieg gegen den Sturm-Golem') + '. Seltenheit: ' + c.rarity + '.', sprite: { kind: 'found', id: c.id } });
    });
    if (b.chests > a.chests) toast('Funkel hat eine Truhe in der Höhle gefunden!');
    if (b.keyFound && !a.keyFound) queueCelebrate({ title: 'Funkel hat etwas entdeckt!', text: 'In der Leuchtgrotte glitzert der Kristall-Schlüssel. Geh in die Höhle und hol ihn dir.', sprite: { kind: 'funkel', block: 'caveLit' } });
    b.helpers.forEach((h) => {
      const old = a.helpers.find((x) => x.id === h.id);
      if (old && old.here && h.stage > old.stage) queueCelebrate({ title: old.title + ' verwandelt sich!', text: 'Aus ' + old.title + ' wird ' + h.title + '.', sprite: { kind: h.id, block: 'grass' } });
    });
  }
  function queueCelebrate(c) { App.ui.celebrate.push(c); }
  App.queueCelebrate = queueCelebrate;

  function confetti() {
    if (reduceMotion) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const colors = ['#FFD166', '#7BC96F', '#2BB3A8', '#B3A8FF', '#FF9F43', '#FFFFFF'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      p.style.left = Math.round(Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.5).toFixed(2) + 's';
      p.style.animationDuration = (1 + Math.random() * 0.9).toFixed(2) + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2600);
  }
  App.confetti = confetti;

  /* ---------- Toast ---------- */
  let toastTimer = null;
  // Meldungen haben einen eigenen Behälter: So wird beim Ein- und Ausblenden nichts anderes neu gezeichnet
  function renderToast() {
    const el = $('#toasts');
    if (!el) return;
    const t = App.ui.toast;
    el.innerHTML = t ? '<div class="toast" role="status"><span class="px">' + esc(t.text) + '</span>' + (t.undoId ? '<button data-act="undo" data-id="' + esc(t.undoId) + '">Rückgängig</button>' : '') + '</div>' : '';
  }
  function toast(text, undoId) {
    App.ui.toast = { text, undoId };
    renderToast();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { App.ui.toast = null; renderToast(); }, undoId ? 5000 : 2400);
  }
  App.toast = toast;

  /* ---------- Routing ---------- */
  const VIEWS = ['heute', 'insel', 'training', 'boss', 'truhe', 'eltern'];
  // Ansichten werden nur im App-Zustand gewechselt. Keine Links mit #: In eingebetteten Vorschauen
  // würde ein solcher Link die Seite verlassen.
  function initialView() {
    let h = '';
    try { h = (location.hash || '').replace('#', ''); } catch (e) { /* ignore */ }
    if (VIEWS.indexOf(h) >= 0) return h;
    if (App.device.demo) return 'heute';
    return App.device.role && App.device.role !== 'kind' ? 'eltern' : 'heute';
  }
  function route() {
    if (!App.device.demo && (!App.device.role || (LIVE && !App.store.ready()))) App.view = 'start';
    else if (VIEWS.indexOf(App.view) < 0) App.view = initialView();
    render();
  }
  function go(v) {
    if (App.ui.dirty) { App.ui.dirty = false; load(); }
    App.view = VIEWS.indexOf(v) >= 0 ? v : 'heute';
    if (App.view !== 'eltern' && App.device.role === 'kind') App.ui.parentOk = false;
    App.ui.sheet = null;
    route();
  }
  App.go = go;
  App.initialView = initialView;

  /* ---------- Rendern ---------- */
  const scrollPos = {};
  function render() {
    const root = $('#app');
    const sc = $('.scroll', root);
    if (sc && root.dataset.view) scrollPos[root.dataset.view] = sc.scrollTop;
    let html = '';
    if (App.device.demo) html += '<div class="demo-band"><span><b>Demo</b> · ' + fmtDayLong(App.st.today) + ' · Tag ' + App.st.challenge.dayNo + '</span><button data-act="demo-tools">' + icon('clock', 15) + ' Zeit &amp; Demo</button></div>';
    if (App.view === 'start') html += viewStart();
    else if (App.view === 'eltern') html += window.TQParents.view();
    else {
      html += hud();
      html += '<main class="scroll" id="main">' + (App.view === 'heute' ? viewHeute() : App.view === 'insel' ? viewInsel()
        : App.view === 'training' ? window.TQTraining.view() : App.view === 'boss' ? viewBoss() : viewTruhe()) + '</main>';
      html += nav();
    }
    root.innerHTML = html;
    root.dataset.view = App.view;
    const sc2 = $('.scroll', root);
    if (sc2 && scrollPos[App.view]) sc2.scrollTop = scrollPos[App.view];
    afterRender();
    renderOverlays();
  }
  App.render = render;

  function drawCards(el) {
    $$('canvas[data-card]', el).forEach((c) => {
      W.drawCard(c, c.dataset.card, { block: c.dataset.block, stage: +c.dataset.stage || 0, color: App.st.settings.heroColor, locked: c.dataset.locked === '1', px: c.dataset.px ? +c.dataset.px : undefined });
    });
  }
  function drawItems(el) {
    $$('canvas[data-item]', el).forEach((c) => W.drawItem(c, c.dataset.item));
    $$('canvas[data-found]', el).forEach((c) => W.drawFound(c, E.COLLECTION.find((x) => x.id === c.dataset.found), c.dataset.known === '1'));
  }
  App.drawItems = drawItems;
  function afterRender() {
    if (App.view === 'insel') mountGame(); else if (window.Game) window.Game.unmount();
    drawCards($('#app'));
    if (App.view === 'truhe' || App.view === 'boss') drawItems($('#app'));
    drawItems($('#app'));
    if (window.TQParents && App.view === 'eltern') window.TQParents.after();
  }
  App.afterRender = afterRender;

  /* ---------- Inselzeit (Spielzeit pro Tag) ---------- */
  function islandLimitSec() { return Math.max(1, App.st.settings.islandMinutes || 5) * 60; }
  function islandUsedSec() {
    const t = App.data.prefs.islandTime;
    const base = t && t.day === App.st.today ? t.sec : 0;
    return App.ui.islandDay === App.st.today ? Math.max(base, App.ui.islandSec || 0) : base;
  }
  function islandLeft() { return Math.max(0, islandLimitSec() - islandUsedSec()); }
  App.islandLeft = islandLeft;
  function islandTimeLabel() {
    const l = islandLeft();
    return l <= 0 ? 'Inselzeit vorbei' : 'Inselzeit ' + Math.floor(l / 60) + ':' + String(l % 60).padStart(2, '0');
  }
  function islandTick() {
    if (App.view !== 'insel' || !window.Game) return;
    try { if (document.visibilityState === 'hidden') return; } catch (e) { /* ignore */ }
    if (window.Game.phase() === 'nacht') return;
    if (App.ui.islandDay !== App.st.today) { App.ui.islandDay = App.st.today; App.ui.islandSec = islandUsedSec(); }
    if (islandLeft() <= 0) return;
    App.ui.islandSec = (App.ui.islandSec || 0) + 1;
    if (App.ui.islandSec % 10 === 0 || islandLeft() <= 0) savePrefs({ islandTime: { day: App.st.today, sec: App.ui.islandSec } });
    const el = $('#game-time');
    if (el) { el.textContent = islandTimeLabel(); el.classList.toggle('low', islandLeft() <= 60); }
    if (islandLeft() <= 0) {
      window.Game.setLocked(true);
      App.ui.panel = null; renderOverlays();
      refreshInsel();
    }
  }
  setInterval(islandTick, 1000);

  /* ---------- Spiel (Insel) ---------- */
  const gameCallbacks = {
    now: () => now(),
    collect(res, n) {
      addEvent({ type: 'collect', res, n }, { quiet: true });
      if (res === 'schluessel') queueCelebrate({ title: 'Kristall-Schlüssel!', text: 'Du hast den Kristall-Schlüssel geholt. Damit kommst du ab Level ' + App.st.stages[1] + ' auf die Kristallinsel.', sprite: { kind: 'funkel', block: 'caveLit' } });
      if (res === 'truhe') toast('Truhe geöffnet: +5 Holz, +5 Stein');
      refreshInsel();
      renderOverlays();
    },
    build(id) {
      addEvent({ type: 'build', item: id });
      refreshInsel();
      renderOverlays();
    },
    openPanel(kind) { openPanel(kind); },
    hint: () => liloHint(),
    sleep: () => ({ from: App.st.settings.sleepFrom || '22:00', to: App.st.settings.sleepTo || '06:00' }),
    lockedTap: () => toast('Die Inselzeit für heute ist vorbei. Morgen geht es weiter!'),
    boss: () => go('boss'),
    scene: () => { refreshInsel(); }
  };
  function mountGame() {
    const c = $('#game');
    if (!c || !window.Game) return;
    window.Game.unmount();
    window.Game.setPhase(App.device.demo ? (App.device.demoTime || 'auto') : 'auto');
    window.Game.mount(c, gameCallbacks);
    window.Game.update(App.st);
    window.Game.setLocked(islandLeft() <= 0);
  }
  // Nur HUD und Infobereich unter der Insel neu zeichnen (die Zeichenfläche bleibt stehen)
  function refreshInsel() {
    if (App.view !== 'insel') return;
    const h = $('.hud');
    if (h) h.outerHTML = hud();
    const info = $('#insel-info');
    if (info) { info.innerHTML = inselInfo(); drawItems(info); }
    if (window.Game) window.Game.update(App.st);
  }
  App.refreshInsel = refreshInsel;

  function liloHint() {
    const st = App.st, nb = st.nextBuild;
    const scene = window.Game ? window.Game.scene() : 'insel';
    if (scene === 'himmel') return 'Wir sind ganz oben! Tipp auf den Wolkenlift, um zurückzufliegen.';
    if (scene === 'hoehle') return st.field.chests || st.field.key ? 'Da glitzert etwas! Tipp drauf, dann laufe ich hin.' : 'Hier ist gerade nichts. Tipp auf «Ausgang», um zurückzugehen.';
    if ((st.field.holz || 0) + (st.field.stein || 0) > 0) return 'Da liegt Material herum! Tipp drauf, dann sammle ich es ein.';
    if (st.built.hoehle && (st.field.chests || st.field.key)) return 'Funkel hat etwas in der Höhle gefunden! Tipp auf den Höhleneingang.';
    if (nb && nb.id === 'kristallinsel') {
      if ((st.stage || 0) < 2) return 'Zur Kristallinsel ist es zu weit. Mit dem Gleitflügel ab Level ' + st.stages[1] + ' fliege ich hinüber.';
      if (!st.keyHave) return st.keyFound ? 'Der Kristall-Schlüssel liegt in der Höhle. Holen wir ihn!' : 'Funkel sucht noch den Kristall-Schlüssel. Jede Quest hilft.';
      return 'Ich bin bereit! Tipp auf die Kristallinsel, dann springe ich ab.';
    }
    if (nb && nb.id === 'himmelsinsel') return (st.stage || 0) >= 3 ? 'Wispel wartet unten am Strand. Tipp auf Wispel!' : 'Ab Level ' + st.stages[2] + ' holt uns Wispel zur Himmelsinsel.';
    if (nb && nb.id === 'bruecke' && nb.crafted) return 'Die Brücke ist fertig! Tipp auf die Lücke zwischen den Inseln.';
    if (nb && nb.recipe) {
      if (nb.crafted && nb.levelOk) return nb.id === 'leiter' ? 'Die Leiter ist fertig! Tipp auf die leuchtende Stelle am Berg.' : 'Der Stützbogen ist fertig! Tipp auf die rissige Wand im Berg.';
      if (nb.crafted) return 'Zum Graben brauche ich die Schaufel. Die gibt es ab Level ' + st.stages[0] + '.';
      if (nb.stockOk) return 'Genug Material! Ab zur Werkbank neben dem Haus.';
      const res = nb.cost.holz ? 'Holz' : 'Stein', need = nb.cost.holz || nb.cost.stein;
      return 'Für ' + (nb.id === 'leiter' ? 'die Leiter' : nb.id === 'bruecke' ? 'die Brücke' : 'den Stützbogen') + ' brauche ich ' + need + ' ' + res + '. Erledige Quests, dann bringen die Helfer mehr.';
    }
    return st.built.himmelsinsel ? 'Alle Inseln entdeckt! Wispel fliegt dich jederzeit nach oben.' : 'Weiter so!';
  }

  function renderOverlays() {
    const root = $('#overlays');
    let html = '';
    const u = App.ui;
    if (u.sheet) html += '<div class="overlay" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true" data-stop="1">' + sheetHtml(u.sheet) + '</div></div>';
    if (u.panel) html += panelHtml();
    if (u.player) html += window.TQTraining.playerHtml();
    if (u.celebrate.length) {
      const c = u.celebrate[0];
      html += '<div class="celebrate" role="dialog" aria-modal="true" aria-labelledby="cel-t"><div class="blk gold">' +
        (c.sprite ? '<canvas data-cel="1" width="140" height="140" aria-hidden="true"></canvas>' : '') +
        '<div class="h1" id="cel-t">' + c.title + '</div><p>' + c.text + '</p>' +
        '<button class="btn gold block" data-act="cel-next">' + (u.celebrate.length > 1 ? 'Weiter' : 'Super!') + '</button></div></div>';
    }
    const hadCel = root.querySelector('.celebrate');
    root.innerHTML = html;
    const cv = $('canvas[data-cel]', root);
    if (cv) {
      const c = u.celebrate[0];
      if (c.sprite.kind === 'found') W.drawFound(cv, E.COLLECTION.find((x) => x.id === c.sprite.id), true); else W.drawCard(cv, c.sprite.kind, { block: c.sprite.block || 'grass', stage: c.sprite.stage || 0, color: c.sprite.color || App.st.settings.heroColor, px: c.sprite.kind === 'hero' ? 5 : 6 });
      if (!hadCel) confetti();
    }
    if (u.sheet) drawCards(root);
    if (u.panel) drawItems(root);
    if (u.player) window.TQTraining.afterPlayer();
  }

  function openPanel(kind) {
    if (islandLeft() <= 0) { toast('Die Inselzeit für heute ist vorbei. Morgen geht es weiter!'); return; }
    App.ui.panel = { kind, grid: Array(9).fill(null), hand: null, recipe: null, made: null };
    renderOverlays();
  }
  App.openPanel = openPanel;
  function panelHtml() {
    const p = App.ui.panel, st = App.st;
    const tabs = '<div class="tabs" role="tablist"><button role="tab" aria-selected="' + (p.kind === 'vorrat') + '" data-act="panel" data-kind="vorrat">Vorratskammer</button><button role="tab" aria-selected="' + (p.kind === 'werkbank') + '" data-act="panel" data-kind="werkbank">Werkbank</button></div>';
    let body = '';
    if (p.kind === 'vorrat') {
      const inv = inventory();
      body += '<p class="small muted">Hier landet alles, was ' + esc(st.settings.heroName) + ' auf der Insel einsammelt.</p><div class="inv">';
      for (let i = 0; i < 18; i++) {
        const it = inv[i];
        const short = it && it.id === 'schluessel' ? 'Schlüssel' : it && it.id === 'stuetzbogen' ? 'Bogen' : it && RES_NAME[it.id];
        body += it ? '<div class="slot big"><canvas data-item="' + it.id + '" aria-hidden="true"></canvas><b class="num">' + it.n + '</b><span>' + esc(short) + '</span></div>' : '<span class="slot big empty" aria-hidden="true"></span>';
      }
      body += '</div>';
      const f = st.field;
      if (f.holz || f.stein) body += '<div class="banner teal small"><div>Auf der Insel liegen noch ' + [f.holz ? f.holz + ' Holz' : '', f.stein ? f.stein + ' Stein' : ''].filter(Boolean).join(' und ') + '. Lauf hin und tippe drauf.</div></div>';
      if (f.chests || f.key) body += '<div class="banner violet small"><div>In der Leuchtgrotte warten ' + [f.chests ? f.chests + (f.chests === 1 ? ' Truhe' : ' Truhen') : '', f.key ? 'der Kristall-Schlüssel' : ''].filter(Boolean).join(' und ') + '.</div></div>';
    } else {
      body += werkbankHtml();
    }
    return '<div class="full" role="dialog" aria-modal="true" aria-label="' + (p.kind === 'vorrat' ? 'Vorratskammer' : 'Werkbank') + '"><div class="full-head"><button class="icon-btn" data-act="panel-close" aria-label="Schliessen">' + icon('close', 18) + '</button><div class="grow">' + tabs + '</div></div>' +
      '<div class="full-body">' + body + '</div></div>';
  }
  function gridUse(grid) { const u = { holz: 0, stein: 0 }; grid.forEach((g) => { if (g) u[g] += E.SLOT_UNITS[g]; }); return u; }
  function gridMatch(grid) {
    return E.RECIPES.find((r) => r.pattern.join('').split('').every((ch, i) => (r.key[ch] || null) === (grid[i] || null))) || null;
  }
  function recipeOpen(r) { return !r.after || App.st.built[r.after]; }
  function werkbankHtml() {
    const p = App.ui.panel, st = App.st;
    if (p.made) {
      const r = E.RECIPES.find((x) => x.id === p.made);
      return '<div class="stack" style="align-items:center;text-align:center"><div class="slot big result ok"><canvas data-item="' + r.id + '" aria-hidden="true"></canvas></div>' +
        '<div class="h1">' + esc(r.name) + ' hergestellt!</div><p class="muted">' + esc(r.use) + '. Die leuchtende Stelle auf der Insel zeigt, wo.</p>' +
        '<button class="btn gold block" data-act="game-go" data-obj="' + (r.id === 'stuetzbogen' ? 'hoehle' : r.id) + '">Zur Stelle laufen</button>' +
        '<button class="btn ghost block" data-act="wb-again">Noch etwas herstellen</button></div>';
    }
    const use = gridUse(p.grid);
    const avail = { holz: st.holz - use.holz, stein: st.stein - use.stein };
    const match = gridMatch(p.grid);
    const rsel = p.recipe ? E.RECIPES.find((r) => r.id === p.recipe) : null;
    let h = '<div class="sec-h">Rezeptbuch</div><div class="recipes">' + E.RECIPES.map((r) => {
      const state = st.recipeState[r.id];
      const open = state === 'offen';
      const need = Object.keys(r.cost).map((k) => r.cost[k] + ' ' + RES_NAME[k]).join(' + ');
      const sub = state === 'gebaut' ? 'schon gebaut' : state === 'bereit' ? 'liegt bereit: jetzt anbauen' : state === 'gesperrt' ? 'nach der Leiter' : need;
      return '<button class="recipe' + (p.recipe === r.id ? ' on' : '') + '" data-act="wb-recipe" data-id="' + r.id + '"' + (open ? '' : ' disabled') + '><canvas data-item="' + r.id + '" aria-hidden="true"></canvas><span><b>' + esc(r.name) + '</b><small>' + esc(sub) + '</small></span></button>';
    }).join('') + '</div>';
    const ghost = rsel ? rsel.pattern.join('').split('').map((ch) => rsel.key[ch] || null) : [];
    h += '<div class="craft"><div class="grid3" role="group" aria-label="Werkbank-Raster">' + p.grid.map((g, i) => {
      const gh = !g && ghost[i];
      return '<button class="slot' + (gh ? ' ghost' : '') + '" data-act="wb-slot" data-i="' + i + '" aria-label="Feld ' + (i + 1) + (g ? ': ' + RES_NAME[g] : gh ? ': hier ' + RES_NAME[gh] + ' hinlegen' : ': leer') + '">' +
        (g || gh ? '<canvas data-item="' + (g || gh) + '" aria-hidden="true"></canvas>' : '') + (g ? '<b class="num">' + E.SLOT_UNITS[g] + '</b>' : '') + '</button>';
    }).join('') + '</div><span class="arrow" aria-hidden="true">' + icon('next', 26) + '</span>' +
      '<button class="slot big result' + (match ? ' ok' : '') + '" data-act="wb-make"' + (match ? '' : ' disabled') + ' aria-label="' + (match ? esc(match.name) + ' herstellen' : 'Noch kein Rezept erkannt') + '">' + (match ? '<canvas data-item="' + match.id + '" aria-hidden="true"></canvas>' : '') + '</button></div>';
    h += '<p class="small ' + (match ? '' : 'muted') + '">' + (match ? 'Tippe auf das Ergebnis, um ' + esc(match.name === 'Leiter' ? 'die Leiter' : match.name === 'Brücke' ? 'die Brücke' : 'den Stützbogen') + ' herzustellen.' : p.hand ? 'Tippe auf ein Feld, um ' + RES_NAME[p.hand] + ' hinzulegen. Ein Feld braucht ' + E.SLOT_UNITS[p.hand] + ' ' + RES_NAME[p.hand] + '.' : 'Wähle unten ein Material und lege es nach dem Muster ins Raster.') + '</p>';
    h += '<div class="sec-h">Material</div><div class="row wrap">' + ['holz', 'stein'].map((m) => '<button class="mat' + (p.hand === m ? ' on' : '') + '" data-act="wb-hand" data-m="' + m + '" aria-pressed="' + (p.hand === m) + '"><canvas data-item="' + m + '" aria-hidden="true"></canvas><span><b>' + RES_NAME[m] + '</b><small class="num">' + avail[m] + ' übrig</small></span></button>').join('') + '</div>';
    if (E.RECIPES.every((r) => st.recipeState[r.id] !== 'offen')) h += '<div class="banner teal small"><div>Gerade gibt es nichts herzustellen. ' + (E.RECIPES.some((r) => st.recipeState[r.id] === 'bereit') ? 'Bau zuerst an, was bereitliegt.' : 'Neue Rezepte kommen mit den nächsten Gebieten.') + '</div></div>';
    h += '<div class="row"><button class="btn sm ghost" data-act="wb-clear">Raster leeren</button>' + (rsel ? '<button class="btn sm ghost" data-act="wb-auto">Muster einlegen</button>' : '') + '</div>';
    if ((st.field.holz || 0) + (st.field.stein || 0) > 0) h += '<p class="tiny dim">Auf der Insel liegt noch Material, das du einsammeln kannst.</p>';
    return h;
  }
  App.renderOverlays = renderOverlays;

  /* ---------- Start (Gerät zuordnen) ---------- */
  function viewStart() {
    if (LIVE && !App.device.demo) return viewSetup();
    return '<main class="scroll" style="padding-block: 28px 32px"><div class="stack">' +
      '<div class="blk" style="padding:0;overflow:hidden"><canvas data-card="hero" data-block="grass" data-px="6" style="width:100%;height:170px;display:block;background:#6FB7EE" aria-hidden="true"></canvas></div>' +
      '<h1 class="h1">Trocken-Quest</h1>' +
      '<p class="muted">Wer benutzt dieses iPhone? Das legt fest, welche Ansicht beim Öffnen kommt. Du kannst es in der Eltern-Ansicht unter «Daten» ändern.</p>' +
      '<button class="btn teal block" data-act="role" data-role="kind">' + icon('user') + ' Kind</button>' +
      '<div class="row"><button class="btn grow" data-act="role" data-role="mama">Mama</button><button class="btn grow" data-act="role" data-role="papa">Papa</button></div>' +
      '<p class="tiny dim">Diese Version speichert nur auf diesem Gerät. Der gemeinsame Speicher für alle drei iPhones kommt im nächsten Schritt.</p>' +
      '</div></main>';
  }

  /* ---------- Einrichtung (Online-Version) ---------- */
  function viewSetup() {
    const u = App.ui.setup || (App.ui.setup = { step: 'choose' });
    const busy = u.busy ? ' disabled aria-busy="true"' : '';
    const err = u.err ? '<div class="banner violet" role="alert"><div class="small">' + esc(u.err) + '</div></div>' : '';
    let h = '<main class="scroll" style="padding-block: 28px 32px"><div class="stack">' +
      '<div class="blk" style="padding:0;overflow:hidden"><canvas data-card="hero" data-block="grass" data-px="6" style="width:100%;height:150px;display:block;background:#6FB7EE" aria-hidden="true"></canvas></div>' +
      '<h1 class="h1">Trocken-Quest</h1>';
    if (u.step === 'choose') {
      h += '<p class="muted">Willkommen! Dieses iPhone wird einmal mit eurer Familie verbunden. Danach sehen alle Geräte dieselben Einträge.</p>' + err +
        '<button class="btn teal block" data-act="setup" data-step="join">' + icon('user') + ' Ich habe einen Code</button>' +
        '<button class="btn block" data-act="setup" data-step="new">Neue Familie einrichten</button>' +
        '<p class="tiny dim">«Neue Familie» macht nur das erste Eltern-iPhone, ein einziges Mal. Es bekommt zwei Codes: einen fürs Kind, einen für den anderen Elternteil.</p>' +
        '<button class="btn ghost block" data-act="demo" data-on="1">Zuerst die Demo ansehen</button>';
    } else if (u.step === 'new') {
      h += '<p class="muted">Wer richtet ein? Danach bekommst du die zwei Codes.</p>' + err +
        '<div class="row"><button class="btn teal grow" data-act="setup-new" data-dev="mama"' + busy + '>Mama</button><button class="btn teal grow" data-act="setup-new" data-dev="papa"' + busy + '>Papa</button></div>' +
        (u.busy ? '<p class="small muted">Einen Moment …</p>' : '') +
        '<button class="btn ghost block" data-act="setup" data-step="choose">Zurück</button>';
    } else if (u.step === 'codes') {
      h += '<p class="muted">Eure Familie ist eingerichtet. Diese zwei Codes braucht ihr für die anderen iPhones. Ihr findet sie später jederzeit in der Eltern-Ansicht unter «Daten».</p>' +
        '<section class="blk stack"><span class="lbl">Code fürs Kind</span><div class="code-big px">' + esc(u.codes.kidCode) + '</div>' +
        '<span class="lbl">Code für den anderen Elternteil</span><div class="code-big px">' + esc(u.codes.parentCode) + '</div>' +
        '<p class="tiny dim">Den Eltern-Code nicht dem Kind geben: Er erlaubt alle Einstellungen.</p></section>' +
        '<button class="btn gold block" data-act="setup-done">Weiter zur Eltern-Ansicht</button>';
    } else if (u.step === 'join') {
      h += '<p class="muted">Gib den Code ein, den du von Mama oder Papa bekommen hast.</p>' + err +
        '<div class="field"><label for="join-code">Code</label><input class="input px code-in" id="join-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH-JK" value="' + esc(u.code || '') + '"></div>' +
        '<button class="btn teal block" data-act="setup-join"' + busy + '>' + (u.busy ? 'Einen Moment …' : 'Verbinden') + '</button>' +
        '<button class="btn ghost block" data-act="setup" data-step="choose">Zurück</button>';
    } else if (u.step === 'who') {
      h += '<p class="muted">Das ist ein Eltern-Code. Wer benutzt dieses iPhone?</p>' + err +
        '<div class="row"><button class="btn teal grow" data-act="setup-who" data-dev="mama"' + busy + '>Mama</button><button class="btn teal grow" data-act="setup-who" data-dev="papa"' + busy + '>Papa</button></div>';
    }
    return h + '</div></main>';
  }
  function setupError(e) {
    const m = (e && e.message) || '';
    if (e && e.status === 0) return 'Keine Internetverbindung. Bitte prüfen und nochmals versuchen.';
    if (/Code unbekannt/i.test(m)) return 'Diesen Code gibt es nicht. Bitte genau abtippen (Gross- und Kleinschreibung ist egal).';
    if (/anonymous/i.test(m)) return 'Im Online-Konto ist die anonyme Anmeldung noch nicht eingeschaltet (Supabase: Authentication, «Allow anonymous sign-ins»).';
    if (/schon zu einer Familie/i.test(m)) return 'Dieses iPhone gehört schon zu einer Familie. Tippe auf «Ich habe einen Code».';
    if (/function|relation|schema cache/i.test(m)) return 'Die Datenbank ist noch nicht vorbereitet (schema.sql im SQL Editor ausführen).';
    return 'Das hat nicht geklappt: ' + m;
  }
  function registerSW() {
    try { if (LIVE && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* ignore */ }
  }

  /* ---------- HUD und Navigation ---------- */
  function hud() {
    const st = App.st, s = st.settings;
    const pct = Math.max(2, Math.round((st.levelInto / st.levelNeed) * 100));
    return '<header class="hud"><div class="hud-top">' +
      '<div class="hud-name">' + esc(s.heroName) + '<small>' + st.stageName + '</small></div>' +
      '<span class="lvl">Lvl ' + st.level + '</span>' +
      '<button class="icon-btn" data-act="guide" aria-label="So funktioniert das Spiel">' + icon('help', 20) + '</button>' +
      '<button class="icon-btn" data-act="go" data-v="eltern" aria-label="Eltern-Ansicht öffnen">' + icon('lock', 20) + '</button></div>' +
      '<div class="xpbar" role="progressbar" aria-label="Fortschritt bis Level ' + (st.level + 1) + '" aria-valuemin="0" aria-valuemax="' + st.levelNeed + '" aria-valuenow="' + st.levelInto + '"><i style="width:' + pct + '%"></i></div>' +
      '<div class="hud-res"><span title="Holz">' + icon('wood', 14) + ' <b class="num">' + st.holz + '</b></span>' +
      '<span title="Stein">' + icon('stone', 14) + ' <b class="num">' + st.stein + '</b></span>' +
      '<span title="Kristall">' + icon('crystal', 14) + ' <b class="num">' + st.kristall + '</b></span>' +
      '<span title="Serie">' + icon('flame', 14) + ' <b class="num">' + st.streak + '</b></span>' +
      (st.shields ? '<span title="Schutzschilde">' + icon('shield', 14) + ' <b class="num">' + st.shields + '</b></span>' : '') +
      '<span class="xp num">' + st.levelInto + ' / ' + st.levelNeed + ' ' + st.unit + '</span></div></header>';
  }
  function nav() {
    const items = [['heute', 'Heute', 'today'], ['insel', 'Insel', 'island'], ['training', 'Training', 'training'], ['boss', 'Boss', 'sword'], ['truhe', 'Truhe', 'chest']];
    return '<nav class="nav" aria-label="Hauptmenü"><div class="nav-in">' + items.map((i) =>
      '<button data-act="go" data-v="' + i[0] + '"' + (App.view === i[0] ? ' aria-current="page"' : '') + '>' + icon(i[2], 22) + '<span>' + i[1] + '</span></button>').join('') + '</div></nav>';
  }

  /* ---------- Heute ---------- */
  const TIPS = [
    'Trinken über den Tag verteilen: morgens, in der Schule, am Nachmittag. Ab 18 Uhr nur noch wenig.',
    'Alle 2 bis 3 Stunden aufs WC, auch wenn es noch nicht drückt.',
    'Vor dem Schlafen noch einmal aufs WC. Das ist der wichtigste Gang des Tages.',
    'Beim Pinkeln locker sitzen, Füsse abstützen und dir Zeit lassen.',
    'Ein Blasen-Scan dauert 10 Sekunden: kurz in den Bauch hineinspüren.',
    'Jede erledigte Quest zählt. Perfekte Tage braucht es nicht.'
  ];
  function gainText(q) {
    const st = App.st;
    const parts = ['+' + q.nextPts + ' ' + st.unit];
    let stein = 0;
    if (st.helpers.find((h) => h.id === 'kiesel' && h.here)) stein++;
    if (q.kind === 'training' || q.kind === 'abend' || q.id === 'scan') stein++;
    if (q.needsNight) return 'zuerst die Nacht eintragen';
    parts.push('+1 Holz');
    if (stein) parts.push('+' + stein + ' Stein');
    return parts.join(' · ');
  }
  function questRow(q) {
    let btn;
    if (q.complete) btn = '<button class="btn sm ghost" disabled aria-label="' + esc(q.name) + ' erledigt">' + icon('check', 18) + '</button>';
    else if (q.kind === 'training') btn = '<button class="btn go q-btn" data-act="go" data-v="training">Los</button>';
    else if (q.kind === 'abend') btn = '<button class="btn go q-btn" data-act="sheet" data-kind="abend">Los</button>';
    else if (q.kind === 'morgen' && q.needsNight) btn = '<button class="btn sm ghost" disabled>Nacht?</button>';
    else if (q.kind === 'morgen' && q.variant === 'wet') btn = '<button class="btn go q-btn" data-act="sheet" data-kind="bett">Los</button>';
    else btn = '<button class="btn go q-btn" data-act="quest" data-id="' + esc(q.id) + '" aria-label="' + esc(q.name) + ' erledigt">+1</button>';
    const pips = q.times > 1 ? '<span class="pips" aria-label="' + q.done + ' von ' + q.times + '">' + Array.from({ length: q.times }, (_, i) => '<i class="' + (i < q.done ? 'on' : '') + '"></i>').join('') + '</span>' : '';
    return '<div class="blk quest' + (q.complete ? ' done' : '') + '"><div class="q-ico">' + icon(q.icon || 'star', 22) + '</div>' +
      '<div class="grow"><div class="q-name">' + esc(q.name) + '</div><div class="q-meta">' + pips +
      (q.complete ? '<span>erledigt</span>' : '<span class="reward">' + gainText(q) + '</span>') + '</div>' +
      (q.hint && !q.complete ? '<div class="tiny dim" style="margin-top:3px">' + esc(q.hint) + '</div>' : '') + '</div>' + btn + '</div>';
  }
  function viewHeute() {
    const st = App.st, s = st.settings;
    let h = '<div class="stack">';
    if (!st.nightToday) {
      h += '<section class="blk night" aria-labelledby="n-h"><div class="h3" id="n-h">Wie war die Nacht?</div>' +
        '<p class="small muted">Egal wie: Deine Punkte bleiben alle.</p><div class="choices">' +
        '<button class="btn teal" data-act="night" data-dry="1">' + icon('sun', 20) + ' Trocken</button>' +
        '<button class="btn" data-act="night" data-dry="0">' + icon('cloud', 20) + ' Nass</button></div></section>';
    } else {
      h += '<div class="banner ' + (st.nightToday.dry ? 'teal' : '') + '">' + icon(st.nightToday.dry ? 'sun' : 'moon', 20) + '<div class="grow">' +
        (st.nightToday.dry ? 'Trockene Nacht! Stark.' : 'Nacht eingetragen. Dein Fortschritt bleibt, wie er ist.') +
        '</div><button class="btn sm ghost" data-act="night-undo">ändern</button></div>';
    }
    if (st.comebackPending) h += '<div class="banner violet">' + icon('star', 20) + '<div>Comeback-Bonus! Deine nächste Quest zählt doppelt.</div></div>';
    const need = Math.ceil(st.streakNeed);
    const left = Math.max(0, need - st.todayPts);
    h += '<section class="blk row between"><div><div class="px" style="font-size:22px">' + st.todayPts + ' <span class="small muted">/ ' + st.dailyPossible + ' ' + st.unit + '</span></div>' +
      '<div class="small muted">' + (st.todayOk ? 'Serien-Tag geschafft. Die Serie läuft: ' + st.streak + (st.streak === 1 ? ' Tag.' : ' Tage.') : 'Noch ' + left + ' ' + st.unit + ' bis zum Serien-Tag.') + '</div></div>' +
      '<div class="q-ico" style="color:var(--ember)">' + icon('flame', 24) + '</div></section>';
    h += '<div class="sec-h">Quests heute</div>';
    h += st.questsToday.filter((q) => q.daily).map(questRow).join('');
    const extra = st.questsToday.filter((q) => !q.daily);
    if (extra.length) h += '<div class="sec-h">Bei Bedarf</div>' + extra.map(questRow).join('');
    if (st.bettMode === 'ohneXP' && st.nightToday && !st.nightToday.dry) {
      h += '<div class="sec-h">Bei Bedarf</div><div class="blk quest' + (st.bettToday ? ' done' : '') + '"><div class="q-ico">' + icon('bed', 22) + '</div><div class="grow"><div class="q-name">Bett-Held: Bett abziehen</div><div class="q-meta"><span>' + (st.bettToday ? 'erledigt, stark!' : 'ohne Punkte, aber mit Feier') + '</span></div></div>' +
        (st.bettToday ? '<button class="btn sm ghost" disabled>' + icon('check', 18) + '</button>' : '<button class="btn go q-btn" data-act="bett-held">Los</button>') + '</div>';
    }
    const tip = TIPS[E.diffDays('2026-01-01', st.today) % TIPS.length];
    h += '<div class="banner teal">' + icon('drop', 20) + '<div class="small">' + esc(tip) + '</div></div>';
    h += '</div>';
    return h;
  }

  /* ---------- Insel ---------- */
  function viewInsel() {
    const st = App.st;
    const near = window.Game && window.Game.isNear();
    let h = '<div class="stack"><div class="game-wrap"><canvas class="world game' + (near ? ' near' : '') + '" id="game" role="img" aria-label="' + esc(worldDesc()) + '"></canvas>' +
      '<span class="game-time" id="game-time" role="timer" aria-live="off">' + islandTimeLabel() + '</span>' +
      '<button class="game-zoom" data-act="zoom" aria-label="' + (near ? 'Ganze Insel zeigen' : 'Näher heran') + '">' + icon(near ? 'minus' : 'plus', 20) + '</button></div>' +
      '<p class="tiny dim" style="margin-top:-4px">' + (near ? 'Ziehe mit dem Finger, um die Insel zu verschieben.' : 'Tippe auf die Insel, um ' + esc(st.settings.heroName) + ' zu bewegen. Mit + kommst du näher heran.') + '</p>';
    h += '<div id="insel-info">' + inselInfo() + '</div>';
    h += '<div class="row between"><div class="sec-h">Dein Weg</div><button class="btn sm ghost" data-act="guide">' + icon('help', 16) + ' So geht\'s</button></div>';
    h += '<section class="blk stack">' + roadmap() + '</section>';
    h += '<div class="sec-h">Deine Helfer</div><div class="cards">';
    const blocks = { moosling: 'leaves', kiesel: 'stone', funkel: 'caveLit', splitti: 'crystal', wispel: 'cloudw' };
    const where = { kiesel: 'nach dem Bau der Leiter', funkel: 'wenn die Höhle offen ist', splitti: 'auf der Kristallinsel', wispel: 'beim Finale' };
    st.helpers.forEach((x) => {
      h += '<div class="card-mini' + (x.here ? '' : ' locked') + '"><canvas data-card="' + x.id + '" data-block="' + blocks[x.id] + '" data-locked="' + (x.here ? 0 : 1) + '" aria-hidden="true"></canvas>' +
        '<b>' + esc(x.here ? x.title : '???') + '</b><span>' + (x.here ? esc(x.help) + (x.stage < 3 ? '<br>Stufe ' + x.stage + ' von 3' : '<br>Höchste Stufe') : 'zieht ein ' + where[x.id]) + '</span></div>';
    });
    h += '</div><p class="tiny dim">Helfer verwandeln sich: Stufe 2 nach einer 7-Tage-Serie, Stufe 3 nach einem Boss-Sieg.</p>';
    h += '<div class="sec-h">' + esc(st.settings.heroName) + ' wächst</div><div class="cards">';
    E.HERO_STAGE_NAMES.forEach((n, i) => {
      const lv = i === 0 ? 1 : st.stages[i - 1];
      h += '<div class="card-mini' + (st.stage >= i ? '' : ' locked') + '"><canvas data-card="hero" data-stage="' + i + '" data-block="grass" data-px="3" aria-hidden="true"></canvas><b>' + n + '</b><span>' + (i === 0 ? 'Start' : 'ab Level ' + lv) + '</span></div>';
    });
    h += '</div></div>';
    return h;
  }
  const RES_NAME = { holz: 'Holz', stein: 'Stein', kristall: 'Kristall', leiter: 'Leiter', stuetzbogen: 'Stützbogen', bruecke: 'Brücke', schluessel: 'Kristall-Schlüssel', truhe: 'Truhe' };
  App.RES_NAME = RES_NAME;
  function inventory() {
    const st = App.st, out = [];
    ['holz', 'stein', 'kristall'].forEach((id) => out.push({ id, n: st[id] || 0 }));
    ['leiter', 'stuetzbogen', 'bruecke'].forEach((id) => { if (st.items[id]) out.push({ id, n: st.items[id] }); });
    if (st.keyHave) out.push({ id: 'schluessel', n: 1 });
    return out;
  }
  App.inventory = inventory;
  function inselInfo() {
    const st = App.st;
    const inv = inventory();
    let h = '<div class="hotbar" role="group" aria-label="Schnellleiste">';
    for (let i = 0; i < 7; i++) {
      const it = inv[i];
      h += it ? '<button class="slot" data-act="slot" data-id="' + it.id + '" aria-label="' + esc(RES_NAME[it.id]) + ': ' + it.n + '"><canvas data-item="' + it.id + '" aria-hidden="true"></canvas><b class="num">' + it.n + '</b></button>'
        : '<span class="slot empty" aria-hidden="true"></span>';
    }
    h += '</div>';
    const scene = window.Game ? window.Game.scene() : 'insel';
    const sleeping = window.Game && window.Game.phase() === 'nacht';
    if (islandLeft() <= 0) h += '<div class="banner violet">' + icon('clock', 20) + '<div class="small">Die Inselzeit für heute ist vorbei (' + (st.settings.islandMinutes || 5) + ' Minuten). Dein Material wartet bis morgen. Quests und Training gehen trotzdem.</div></div>';
    h += '<div class="row">' + (scene === 'hoehle'
      ? '<button class="btn grow" data-act="cave-leave">' + icon('back', 18) + ' Höhle verlassen</button>'
      : '<button class="btn grow" data-act="panel" data-kind="vorrat">' + icon('chest', 18) + ' Vorrat</button><button class="btn grow" data-act="panel" data-kind="werkbank">' + icon('gear', 18) + ' Werkbank</button>') + '</div>';
    if (sleeping) h += '<div class="banner violet">' + icon('moon', 20) + '<div class="small">Nachtruhe: Alle schlafen im Haus. Ab ' + esc(st.settings.sleepTo || '06:00') + ' Uhr geht das Spiel weiter. Gute Nacht!</div></div>';
    else if ((st.field.holz || 0) + (st.field.stein || 0) > 0 && scene === 'insel') h += '<div class="banner teal">' + icon('wood', 20) + '<div class="small">Auf der Insel liegen ' + [st.field.holz ? st.field.holz + ' Holz' : '', st.field.stein ? st.field.stein + ' Stein' : ''].filter(Boolean).join(' und ') + '. Tipp drauf, dann sammelt ' + esc(st.settings.heroName) + ' es ein.</div></div>';
    h += goalCard();
    return h;
  }
  function goalCard() {
    const st = App.st, nb = st.nextBuild;
    if (!nb) return '<section class="blk gold stack"><div class="h3">Alle Inseln entdeckt!</div><p class="small muted">Die Challenge ist geschafft. Wispel fliegt dich jederzeit zur Himmelsinsel, und der Sturm-Golem kommt weiterhin jede Woche.</p><button class="btn block" data-act="game-go" data-obj="wispel">Zu Wispel laufen</button></section>';
    if (!nb.recipe) {
      return '<section class="blk stack"><div class="h3">Nächstes Ziel: ' + esc(nb.name) + '</div><p class="small muted">' + esc(nb.text) + '</p>' +
        '<ol class="goal">' + nb.reqs.map((r) => '<li class="' + (r.ok ? 'done' : '') + '">' + (r.ok ? icon('check', 16) : '') + '<span>' + esc(r.keyQuests ? (st.keyHave ? 'Kristall-Schlüssel geholt' : r.ok ? 'Kristall-Schlüssel in der Höhle abholen' : 'Funkel sucht den Kristall-Schlüssel (' + r.have + ' / ' + r.need + ' Quests)') : r.label) + '</span></li>').join('') + '</ol>' +
        (nb.id === 'kristallinsel' && nb.reqs.every((r) => r.ok) ? '<button class="btn gold block" data-act="game-go" data-obj="flug">' + icon('next', 18) + ' Zur Kristallinsel fliegen</button>'
          : nb.id === 'himmelsinsel' && nb.reqs.every((r) => r.ok) ? '<button class="btn gold block" data-act="game-go" data-obj="wispel">' + icon('next', 18) + ' Zu Wispel laufen</button>' : '') + '</section>';
    }
    const res = nb.cost.holz ? 'holz' : 'stein', need = nb.cost[res], R = RES_NAME[res];
    const total = (st[res] || 0) + (st.field[res] || 0);
    const steps = [];
    if (nb.stage === 1) steps.push({ label: 'Level ' + st.stages[nb.stage - 1] + ' erreichen (Schaufel)', sub: 'Jetzt: Level ' + st.level, done: nb.levelOk });
    steps.push({ label: need + ' ' + R + ' verdienen', sub: Math.min(total, need) + ' / ' + need + ' · kommt mit jeder Quest', done: nb.crafted || total >= need, pct: Math.min(1, total / need) });
    steps.push({ label: R + ' einsammeln', sub: 'Im Vorrat: ' + Math.min(st[res], need) + ' / ' + need, done: nb.crafted || st[res] >= need, pct: Math.min(1, st[res] / need) });
    steps.push({ label: nb.recipe.name + ' in der Werkbank herstellen', done: nb.crafted, btn: !nb.crafted && nb.stockOk ? '<button class="btn sm gold" data-act="panel" data-kind="werkbank">Werkbank öffnen</button>' : '' });
    steps.push({ label: nb.id === 'leiter' ? 'Leiter am Berg anbauen' : nb.id === 'bruecke' ? 'Brücke über die Lücke legen' : 'Höhlengang in den Berg graben', done: false, btn: nb.crafted && nb.levelOk ? '<button class="btn sm gold" data-act="game-go" data-obj="' + nb.id + '">Hinlaufen</button>' : '' });
    const cur = steps.findIndex((x) => !x.done);
    return '<section class="blk stack' + (steps[cur] && steps[cur].btn ? ' gold' : '') + '"><div class="h3">Nächstes Ziel: ' + esc(nb.name) + '</div>' +
      '<ol class="goal">' + steps.map((x, i) => '<li class="' + (x.done ? 'done' : i === cur ? 'now' : '') + '">' + (x.done ? icon('check', 16) : '<i>' + (i + 1) + '</i>') +
        '<div class="grow"><span>' + esc(x.label) + '</span>' + (x.sub && !x.done ? '<small>' + esc(x.sub) + '</small>' : '') +
        (x.pct != null && !x.done ? '<div class="meter"><i style="width:' + Math.round(x.pct * 100) + '%"></i></div>' : '') + '</div>' + (i === cur ? x.btn || '' : '') + '</li>').join('') + '</ol></section>';
  }

  function roadmap() {
    const st = App.st;
    const rows = [{ name: 'Wald (Startinsel)', helper: 'Moosling', need: 'Start', done: true }].concat(E.BUILDS.map((b) => {
      const parts = [];
      if (b.stage > 0) parts.push('Level ' + st.stages[b.stage - 1]);
      if (b.cost.holz) parts.push(b.cost.holz + ' Holz');
      if (b.cost.stein) parts.push(b.cost.stein + ' Stein');
      if (b.needsKey) parts.push('Kristall-Schlüssel');
      const h = E.HELPERS.find((x) => x.id === b.helper);
      return { name: b.area, helper: h ? h.name : '', need: parts.join(' + '), done: !!st.built[b.id] };
    }));
    let nextShown = false;
    return rows.map((r, i) => {
      let tag;
      if (r.done) tag = '<span class="tag ok">erreicht</span>';
      else if (!nextShown) { nextShown = true; tag = '<span class="tag wait">als Nächstes</span>'; }
      else tag = '<span class="tag lock">gesperrt</span>';
      return '<div class="way"><span class="way-n">' + (i + 1) + '</span><div class="grow"><b>' + esc(r.name) + '</b><div class="tiny muted">' + esc(r.need) + (r.helper ? ' · Helfer: ' + esc(r.helper) : '') + '</div></div>' + tag + '</div>';
    }).join('');
  }
  function worldDesc() {
    const st = App.st;
    const parts = ['Schwebende Block-Insel mit Wald, Berg, Haus, Teich und Höhle. Links die Kristallinsel, oben die Himmelsinsel.', st.settings.heroName + ' als ' + st.stageName + '.'];
    const here = st.helpers.filter((h) => h.here).map((h) => h.title);
    parts.push('Helfer: ' + here.join(', ') + '.');
    parts.push('Gebaut: ' + (Object.keys(st.built).length ? Object.keys(st.built).map((k) => E.BUILDS.find((b) => b.id === k).name).join(', ') : 'noch nichts') + '.');
    return parts.join(' ');
  }

  /* ---------- Boss ---------- */
  function viewBoss() {
    const st = App.st, b = st.boss, s = st.settings;
    if (b.waiting) {
      return '<div class="stack"><section class="blk stack" style="align-items:center;text-align:center">' +
        '<canvas data-card="golem" data-block="cloud" data-px="6" data-locked="1" style="width:150px;height:150px" aria-hidden="true"></canvas>' +
        '<div class="h1">Sturm-Golem</div><p class="muted">Er zieht noch auf. Am Montag geht der erste Kampf los, dann jede Woche neu.</p></section>' +
        '<div class="banner teal">' + icon('star', 20) + '<div class="small">Bis dahin: Quests sammeln, Holz und Stein für die Leiter holen.</div></div></div>';
    }
    const left = b.left != null ? b.left : Math.max(0, b.hp - b.dmg);
    const pct = Math.round((left / b.hp) * 100);
    const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const wd = E.weekday(st.today);
    const max = Math.max(b.hp / 5, ...b.perDay, 1);
    const hit = bossHitSize(b);
    let h = '<div class="stack"><section class="blk stack" style="align-items:center;text-align:center">' +
      '<button class="boss-tap' + (b.defeated ? ' down' : '') + '" data-act="boss-hit"' + (b.defeated || !b.charge ? ' aria-disabled="true"' : '') + ' aria-label="' + (b.defeated ? 'Sturm-Golem besiegt' : 'Auf den Sturm-Golem schlagen') + '">' +
      '<canvas data-card="golem" data-block="cloud" data-px="8" data-locked="' + (b.defeated ? 1 : 0) + '" aria-hidden="true"></canvas></button>' +
      '<div class="h1">Sturm-Golem</div>' +
      '<div style="width:100%" class="stack"><div class="hp" role="progressbar" aria-label="Lebenspunkte des Bosses" aria-valuemin="0" aria-valuemax="' + b.hp + '" aria-valuenow="' + left + '"><i id="boss-hp" style="width:' + pct + '%"></i></div>' +
      '<div class="row between small"><span class="px" id="boss-left" style="white-space:nowrap">' + left + ' / ' + b.hp + ' LP</span><span class="muted">Helfer-Bonus +' + b.helperBonus + ' pro Quest' + (b.sundayDouble ? ', So doppelt' : '') + '</span></div></div>' +
      (b.defeated ? '<div class="banner teal" style="width:100%">' + icon('star', 20) + '<div>Besiegt! Beute: ' + esc(s.bossLoot) + '. Nächsten Montag kommt er zurück.</div></div>'
        : '<div style="width:100%" class="stack"><div class="row between small"><b>Schlagkraft</b><span class="px" id="boss-charge">' + b.charge + '</span></div><div class="meter charge"><i id="boss-charge-bar" style="width:' + Math.round(Math.min(1, b.charge / Math.max(1, left)) * 100) + '%"></i></div>' +
          '<p class="small muted" id="boss-tip">' + (b.charge ? 'Tippe auf den Golem! Jeder Schlag macht bis zu ' + hit + ' Schaden.' : 'Keine Schlagkraft mehr. Jede Quest lädt neue auf.') + '</p></div>') +
      '</section>';
    if (!b.defeated) h += '<div class="banner">' + icon('star', 20) + '<div class="small">Quests laden die Schlagkraft auf, Schlagen verbraucht sie. Ist die Woche um und die Kraft reicht, gewinnst du automatisch.</div></div>';
    h += '<div class="sec-h">Schaden diese Woche</div><section class="blk"><div class="week">' + days.map((d, i) =>
      '<div><div class="bar" aria-hidden="true"><i style="height:' + Math.round((b.perDay[i] / max) * 100) + '%"></i></div><span class="num">' + (b.perDay[i] || '–') + '</span><span class="' + (i === wd ? 'today' : '') + '">' + d + '</span></div>').join('') + '</div></section>';
    if (b.hits.length) {
      h += '<div class="sec-h">Letzte Treffer</div><section class="blk stack small">' + b.hits.slice(-5).reverse().map((x) =>
        '<div class="row between"><span>' + esc(x.name) + '</span><span class="px" style="color:var(--rose)">−' + x.dmg + '</span></div>').join('') + '</section>';
    }
    h += '<div class="banner">' + icon('shield', 20) + '<div class="small">Siege bisher: <b>' + st.wins.length + '</b>. Ein nasses Bett heilt den Boss nie.</div></div></div>';
    return h;
  }

  function bossHitSize(b) { return Math.max(10, Math.round(b.hp / 10)); }
  /* ---------- Truhe ---------- */
  function viewTruhe() {
    const st = App.st;
    let h = '<div class="stack"><div class="sec-h">Schatztruhe</div><p class="small muted">Echte Belohnungen. Wenn eine Truhe offen ist, zeig es Mama oder Papa.</p>';
    if (!st.rewards.length) h += '<div class="blk small muted">Noch keine Belohnungen eingetragen. Das machen Mama oder Papa in der Eltern-Ansicht.</div>';
    st.rewards.forEach((r) => {
      const tag = r.claimed ? '<span class="tag ok">eingelöst</span>' : r.unlocked ? '<span class="tag wait">offen!</span>' : '<span class="tag lock">noch ' + (r.level - st.level) + ' Lvl</span>';
      h += '<div class="blk rw' + (r.unlocked ? ' open' : '') + '"><div class="lv">L' + r.level + '</div><div class="grow">' + esc(r.what) + '</div>' + tag + '</div>';
    });
    const col = st.collection || [];
    const found = col.filter((c) => c.count).length;
    h += '<div class="sec-h">Sammelbuch · ' + found + ' von ' + col.length + '</div><p class="small muted">Truhen aus der Höhle und Siege gegen den Sturm-Golem bringen seltene Fundstücke.</p><div class="book">' +
      col.map((c) => '<div class="found' + (c.count ? '' : ' unk') + '"><canvas data-found="' + c.id + '" data-known="' + (c.count ? 1 : 0) + '" aria-hidden="true"></canvas><b>' + (c.count ? esc(c.name) : '???') + '</b><span class="tiny ' + (c.count ? 'r-' + esc(c.rarity.toLowerCase()) : 'dim') + '">' + (c.count ? esc(c.rarity.charAt(0).toUpperCase() + c.rarity.slice(1)) + (c.count > 1 ? ' · ' + c.count + '×' : '') : esc(c.from)) + '</span></div>').join('') + '</div>';
    h += '<div class="sec-h">Fundstücke</div><section class="blk stack small">' +
      '<div class="row between"><span>Truhen geöffnet</span><b class="num">' + st.chestsOpened + ' von ' + st.chests + '</b></div>' +
      '<div class="row between"><span>Bett-Held</span><b class="num">' + st.bettHeldCount + '×</b></div>' +
      '<div class="row between"><span>Kristalle</span><b class="num">' + st.kristall + '</b></div>' +
      '<div class="row between"><span>Boss-Siege</span><b class="num">' + st.wins.length + '</b></div>' +
      '<div class="row between"><span>Längste Serie</span><b class="num">' + st.bestStreak + (st.bestStreak === 1 ? ' Tag' : ' Tage') + '</b></div></section>';
    const ch = st.challenge;
    h += '<div class="sec-h">Challenge</div><section class="blk stack small"><div class="row between"><span>Tag ' + Math.min(ch.dayNo, ch.totalDays) + ' von ' + ch.totalDays + '</span><span>Ziel: Level ' + ch.goalLevel + '</span></div>' +
      '<div class="meter"><i style="width:' + Math.round(ch.pct * 100) + '%"></i></div><span class="muted">' + (ch.done ? 'Ziel erreicht!' : 'Noch ' + Math.max(0, ch.goalXp - st.xp) + ' ' + st.unit + ' bis zum Ziel.') + '</span></section></div>';
    return h;
  }

  /* ---------- Sheets ---------- */
  function sheetHtml(sh) {
    const st = App.st, s = st.settings;
    const close = '<button class="icon-btn" data-act="sheet-close" aria-label="Schliessen">' + icon('close', 18) + '</button>';
    if (sh.kind === 'abend') {
      const exId = App.plan.evening || 'B1';
      const ex = P.uebungen.find((u) => u.id === exId) || P.uebungen.find((u) => u.id === 'B1');
      const done = sh.done || {};
      const q = st.questsToday.find((x) => x.kind === 'abend');
      return '<div class="row between"><div class="h2">Abendroutine</div>' + close + '</div>' +
        '<button class="btn block' + (done.wc ? ' go' : '') + '" data-act="abend-tick" data-k="wc" aria-pressed="' + (done.wc ? 'true' : 'false') + '">' + icon(done.wc ? 'check' : 'drop', 20) + ' Vor dem Schlafen aufs WC</button>' +
        '<div class="blk stack"><div class="row between"><div><div class="h3">Abend-Übung: ' + esc(ex.name) + '</div><div class="small muted">' + esc(ex.kurzanleitung) + ' · ' + ex.dauer_min + ' Min. im Bett</div></div></div>' +
        (done.ex ? '<div class="banner teal">' + icon('check', 18) + '<div>Übung gemacht</div></div>'
          : '<div class="row"><button class="btn teal grow" data-act="abend-ex" data-ex="' + ex.id + '">' + icon('play', 18) + ' Übung starten</button>' + (App.device.demo ? '<button class="btn ghost sm" data-act="abend-tick" data-k="ex">schon gemacht</button>' : '') + '</div>') + '</div>' +
        '<button class="btn gold block" data-act="abend-done"' + (done.wc && done.ex && q && !q.complete ? '' : ' disabled') + '>Abendroutine fertig · +' + (q ? q.nextPts : 15) + ' ' + st.unit + '</button>' +
        '<p class="tiny dim">Ab 18 Uhr nur noch wenig trinken.</p>';
    }
    if (sh.kind === 'bett') {
      const mq = st.questsToday.find((q) => q.kind === 'morgen');
      return '<div class="row between"><div class="h2">Bett-Held</div>' + close + '</div>' +
        '<p>Hast du dein Bett selbst abgezogen und die Sachen in die Wäsche gebracht?</p>' +
        (mq ? '<button class="btn gold block" data-act="quest" data-id="morgen" data-close="1">Ja, erledigt · +' + mq.nextPts + ' ' + st.unit + '</button>'
          : '<button class="btn gold block" data-act="bett-held">Ja, erledigt</button>') +
        '<button class="btn ghost block" data-act="sheet-close">Noch nicht</button>';
    }
    if (sh.kind === 'wet') {
      const mq = st.questsToday.find((q) => q.kind === 'morgen');
      return '<div class="h2">Kein Problem.</div><p>Das passiert. Deine Punkte, Level und Helfer bleiben alle, wie sie sind.</p>' +
        (mq && !mq.complete ? '<p class="muted small">Deine Morgen-Quest heute: Bett abziehen. Das macht dich zum Bett-Helden und bringt +' + mq.nextPts + ' ' + st.unit + ', genau gleich viel wie Bettmachen nach einer trockenen Nacht.</p>' +
          '<button class="btn gold block" data-act="quest" data-id="morgen" data-close="1">Bett abgezogen · +' + mq.nextPts + ' ' + st.unit + '</button>'
          : !mq && !st.bettToday ? '<p class="muted small">Wenn du magst: Bett abziehen macht dich zum Bett-Helden.</p><button class="btn gold block" data-act="bett-held">Bett abgezogen</button>' : '') +
        '<button class="btn ghost block" data-act="sheet-close">Später</button>';
    }
    if (sh.kind === 'guide') return guideHtml(close);
    if (sh.kind === 'demo') return demoHtml(close);
    return close;
  }

  const DAYNAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  function fmtDayLong(k) { const d = E.parseDay(k); return DAYNAMES[E.weekday(k)] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.'; }
  App.fmtDayLong = fmtDayLong;

  function guideHtml(close) {
    const st = App.st, s = st.settings, name = esc(s.heroName);
    const step = (n, title, text, card) => '<div class="guide-step"><div class="guide-pic">' + card + '</div><div class="grow"><div class="h3">' + n + '. ' + title + '</div><p class="small muted">' + text + '</p></div></div>';
    const cv = (kind, block, extra) => '<canvas data-card="' + kind + '" data-block="' + block + '"' + (extra || '') + ' aria-hidden="true"></canvas>';
    return '<div class="row between"><div class="h2">So funktioniert das Spiel</div>' + close + '</div>' +
      step(1, 'Quests erledigen', 'Trinken, Blasen-Scan, Training und Abendroutine. Jede erledigte Quest bringt ' + st.unit + ' und Baumaterial: Holz und Stein.', cv('hero', 'grass')) +
      step(2, 'Level steigen', 'Mit ' + st.unit + ' steigst du im Level. Bei Level ' + st.stages[0] + ', ' + st.stages[1] + ' und ' + st.stages[2] + ' bekommt ' + name + ' neue Ausrüstung: Schaufel, Gleitflügel, Kristallrüstung.', cv('hero', 'grass', ' data-stage="2"')) +
      step(3, 'Auf der Insel spielen', 'Tippe auf die Insel, dann läuft ' + name + ' dorthin. Mit dem Finger verschiebst du die Insel, mit + und − zoomst du. Material, das die Helfer bringen, liegt herum: Lauf hin und sammle es ein. Es kommt in die Vorratskammer. Pro Tag hast du ' + (s.islandMinutes || 5) + ' Minuten Inselzeit.', cv('moosling', 'leaves')) +
      step(4, 'Herstellen und bauen', 'In der Werkbank legst du Holz oder Stein nach Rezept ins Raster. So entstehen Leiter und Stützbogen. Dann baust du sie an der leuchtenden Stelle am Berg an. Später fliegst du zur Kristallinsel.', cv('kiesel', 'stone')) +
      step(5, 'Helfer sammeln', 'Jedes neue Gebiet bringt einen Helfer. Moosling bringt Holz, Kiesel Stein, Funkel findet Truhen und den Kristall-Schlüssel. Helfer werden stärker nach einer 7-Tage-Serie und nach einem Boss-Sieg.', cv('moosling', 'leaves')) +
      step(6, 'Wochen-Boss', 'Jeden Montag kommt der Sturm-Golem. Jede Quest macht Schaden, jeder Helfer +1 dazu. Besiegst du ihn, gibt es Beute.', cv('golem', 'cloud')) +
      step(7, 'Serie und Schutzschilde', 'Ein Serien-Tag ist geschafft, wenn du mindestens die Hälfte der Tagespunkte holst. Alle 7 Serien-Tage gibt es ein Schild für einen verpassten Tag. Nach einem verpassten Tag zählt die erste Quest doppelt.', cv('funkel', 'caveLit')) +
      '<div class="banner teal">' + icon('sun', 20) + '<div class="small">Trockene Nächte werden gefeiert. Nasse Nächte nehmen dir nie etwas weg.</div></div>' +
      (App.device.demo ? '<div class="banner violet">' + icon('clock', 20) + '<div class="small">In der Demo kannst du oben mit «Zeit &amp; Demo» ganze Tage erledigen und vorspulen.</div></div>' : '') +
      '<button class="btn gold block" data-act="sheet-close">Los geht\'s</button>';
  }

  function demoHtml(close) {
    const st = App.st;
    const kinds = [['start', '3 Tage erledigt (Start)'], ['weit', 'Nach rund 4 Wochen'], ['leer', 'Ganz leer, Tag 1']];
    return '<div class="row between"><div class="h2">Zeit &amp; Demo</div>' + close + '</div>' +
      '<p class="small muted">Hier spulst du die Zeit vor, um das Spiel kennenzulernen. Alles bleibt in der Demo auf diesem Gerät.</p>' +
      '<section class="blk stack"><div class="row between"><span>Demo-Datum</span><b>' + fmtDayLong(st.today) + ' · Tag ' + st.challenge.dayNo + ' · Level ' + st.level + '</b></div>' +
      '<button class="btn go block" data-act="demo-fill">' + icon('check', 18) + ' Heute alles erledigen</button>' +
      '<button class="btn block" data-act="demo-next">' + icon('next', 18) + ' Zum nächsten Tag</button>' +
      '<div class="row"><button class="btn grow" data-act="demo-ff" data-n="3">' + icon('ff', 16) + ' 3 volle Tage</button><button class="btn grow" data-act="demo-ff" data-n="7">' + icon('ff', 16) + ' 7 volle Tage</button></div>' +
      '<p class="tiny dim">«Volle Tage» hakt alle täglichen Quests ab und trägt die Nächte ein. Bauen und Gebiete freischalten machst du selbst auf der Insel. Beim Wechsel ohne Erledigen siehst du den Comeback-Bonus.</p></section>' +
      '<div class="sec-h">Tageszeit auf der Insel</div><section class="blk stack"><div class="seg wrap" role="group">' +
      [['auto', 'Echt'], ['morgen', 'Morgen'], ['tag', 'Tag'], ['abend', 'Abend'], ['nacht', 'Nacht']].map((x) => '<button data-act="demo-time" data-val="' + x[0] + '" aria-pressed="' + ((App.device.demoTime || 'auto') === x[0]) + '">' + x[1] + '</button>').join('') +
      '</div><p class="tiny dim">Nachts schlafen alle im Haus, dann ruht das Spiel.</p></section>' +
      '<div class="sec-h">Inselzeit</div><section class="blk stack"><div class="row between"><span>Heute noch</span><b class="num">' + islandTimeLabel().replace('Inselzeit ', '') + '</b></div><button class="btn block" data-act="island-reset">Inselzeit zurücksetzen (nur Demo)</button></section>' +
      '<div class="sec-h">Neu beginnen</div><section class="blk stack">' +
      kinds.map((k) => '<button class="btn block' + (App.device.demoKind === k[0] ? ' teal' : '') + '" data-act="demo-seed" data-k="' + k[0] + '">' + k[1] + '</button>').join('') +
      '</section><button class="btn ghost block" data-act="guide">' + icon('help', 18) + ' So funktioniert das Spiel</button>';
  }

  /* ---------- Aktionen ---------- */
  const A = {};
  App.actions = A;
  A.setup = (d) => { App.ui.setup = { step: d.step }; render(); };
  A['setup-new'] = async (d) => {
    const u = App.ui.setup; if (u.busy) return;
    u.busy = true; u.err = ''; render();
    try {
      const codes = await App.store.createFamily(d.dev);
      saveDevice({ role: d.dev });
      App.ui.creating = true; load(); App.ui.creating = false;
      App.ui.setup = { step: 'codes', codes };
    } catch (e) { u.busy = false; u.err = setupError(e); }
    render();
  };
  A['setup-done'] = () => { App.ui.setup = null; App.ui.parentOk = false; App.view = 'eltern'; load(); route(); };
  A['setup-join'] = async () => {
    const u = App.ui.setup; if (u.busy) return;
    const inp = document.getElementById('join-code');
    u.code = (inp && inp.value || '').trim();
    if (u.code.replace(/[^A-Za-z0-9]/g, '').length < 8) { u.err = 'Der Code hat 10 Zeichen, zum Beispiel ABCD-EFGH-JK.'; render(); return; }
    u.busy = true; u.err = ''; render();
    try {
      const r = await App.store.joinFamily(u.code, null);
      u.busy = false;
      if (r.role === 'eltern') { u.step = 'who'; render(); return; }
      saveDevice({ role: 'kind' });
      App.ui.setup = null; load(); App.view = 'heute'; route();
    } catch (e) { u.busy = false; u.err = setupError(e); render(); }
  };
  A['setup-who'] = async (d) => {
    const u = App.ui.setup; if (u.busy) return;
    u.busy = true; render();
    try { await App.store.joinFamily(u.code, d.dev); } catch (e) { /* Name des Geräts ist nur eine Anzeige */ }
    saveDevice({ role: d.dev });
    App.ui.setup = null; App.ui.parentOk = false; load(); App.view = 'eltern'; route();
  };
  A.role = (d) => {
    saveDevice({ role: d.role });
    go(d.role === 'kind' ? 'heute' : 'eltern');
  };
  A.go = (d) => {
    const sc = $('.scroll');
    if (sc && App.view !== d.v) scrollPos[d.v] = 0;
    go(d.v);
  };
  A.guide = () => { App.ui.sheet = { kind: 'guide' }; renderOverlays(); };
  A['demo-tools'] = () => { App.ui.sheet = { kind: 'demo' }; renderOverlays(); };
  function demoSummary(before) {
    const st = App.st;
    const parts = ['+' + (st.xp - before.xp) + ' ' + st.unit];
    if (st.level > before.level) parts.push('Level ' + before.level + ' → ' + st.level);
    return parts.join(' · ');
  }
  A['demo-fill'] = () => {
    const before = App.st;
    const list = E.fullDayEvents(App.data.settings, App.st.today, App.data.events, { night: false, physio: P, now: now() });
    App.ui.sheet = null;
    if (!list.length) { render(); toast('Heute ist schon alles erledigt'); return; }
    addEventsRaw(list);
    celebrateChanges(before, App.st, { type: 'demo' });
    render();
    toast(demoSummary(before));
  };
  A['demo-next'] = () => {
    saveDevice({ demoOffset: (App.device.demoOffset || 0) + 1 });
    recompute();
    App.ui.sheet = null;
    App.view = App.view === 'eltern' ? 'eltern' : 'heute';
    render();
    toast('Neuer Tag: ' + fmtDayLong(App.st.today));
  };
  A['demo-ff'] = (d) => {
    const n = +d.n || 3;
    const before = App.st;
    for (let i = 0; i < n; i++) {
      const day = E.addDays(App.st.today, i);
      const list = E.fullDayEvents(App.data.settings, day, App.data.events, { physio: P, now: i === 0 ? now() : null });
      list.forEach((e) => { App.store.addEvent(e); App.data.events.push(e); });
    }
    saveDevice({ demoOffset: (App.device.demoOffset || 0) + n });
    recompute();
    celebrateChanges(before, App.st, { type: 'demo' });
    App.ui.sheet = null;
    App.view = App.view === 'eltern' ? 'eltern' : 'insel';
    render();
    toast(n + ' Tage vorgespult · ' + demoSummary(before));
  };
  A['demo-seed'] = (d) => {
    if (window.Game) window.Game.reset();
    seedDemo(d.k);
    load();
    App.ui.sheet = null;
    App.ui.celebrate = [];
    App.ui.calMonth = null; App.ui.calDay = null;
    go(App.view === 'eltern' ? 'eltern' : 'heute');
    toast('Demo neu gestartet');
  };
  A.quest = (d) => {
    const q = App.st.questsToday.find((x) => x.id === d.id);
    if (!q || q.complete) return;
    const before = App.st;
    const e = addEvent({ type: 'quest', questId: q.id });
    if (d.close) App.ui.sheet = null;
    const gained = App.st.xp - before.xp;
    render();
    toast('+' + gained + ' ' + App.st.unit + (gained > q.pts ? ' (doppelt!)' : ''), e.id);
  };
  A.undo = (d) => {
    deleteEvent(d.id);
    App.ui.toast = null;
    renderToast();
    App.ui.celebrate = [];
    render();
  };
  A.night = (d) => {
    const dry = d.dry === '1';
    addEvent({ type: 'night', dry }, { quiet: true });
    if (dry) queueCelebrate({ title: 'Trockene Nacht!', text: esc(App.st.settings.heroName) + ' jubelt mit dir.', sprite: { kind: 'hero', stage: App.st.stage, color: App.st.settings.heroColor } });
    else App.ui.sheet = { kind: 'wet' };
    render();
  };
  A['night-undo'] = () => {
    const n = App.st.nightToday;
    if (n) deleteEvent(n.id);
    render();
  };
  A.sheet = (d) => { App.ui.sheet = { kind: d.kind, done: {} }; renderOverlays(); };
  A['sheet-close'] = () => { App.ui.sheet = null; renderOverlays(); };
  A['sheet-bg'] = (d, el, ev) => { if (ev.target === el) A['sheet-close'](); };
  A['abend-tick'] = (d) => { const sh = App.ui.sheet; sh.done[d.k] = !sh.done[d.k]; renderOverlays(); };
  A['abend-ex'] = (d) => { window.TQTraining.startSingle(d.ex); };
  A['abend-done'] = () => {
    const ex = App.plan.evening;
    const q = App.st.questsToday.find((x) => x.kind === 'abend');
    if (!q || q.complete) return;
    const before = App.st;
    const e = addEvent({ type: 'quest', questId: q.id, meta: { uebung: ex } });
    App.ui.sheet = null;
    render();
    toast('+' + (App.st.xp - before.xp) + ' ' + App.st.unit + ' · Gute Nacht!', e.id);
  };
  A.build = (d) => {
    const nb = App.st.nextBuild;
    if (!nb || nb.id !== d.id || !nb.can) return;
    addEvent({ type: 'build', item: d.id });
    render();
  };
  A['cel-next'] = () => { App.ui.celebrate.shift(); renderOverlays(); };
  A['demo-time'] = (d) => { saveDevice({ demoTime: d.val }); if (window.Game) window.Game.setPhase(d.val); App.ui.sheet = null; render(); };
  A['bett-held'] = () => {
    if (App.st.bettToday) return;
    addEvent({ type: 'quest', questId: 'bett' }, { quiet: true });
    App.ui.sheet = null;
    queueCelebrate({ title: 'Bett-Held!', text: 'Bett abgezogen. Stark gemacht!', sprite: { kind: 'hero', stage: App.st.stage, color: App.st.settings.heroColor } });
    render();
  };
  A.panel = (d) => { if (App.ui.panel) { App.ui.panel.kind = d.kind; App.ui.panel.made = null; renderOverlays(); } else openPanel(d.kind); };
  A['panel-close'] = () => { App.ui.panel = null; renderOverlays(); refreshInsel(); };
  A.slot = (d) => {
    if (d.id === 'leiter' || d.id === 'stuetzbogen' || d.id === 'bruecke') { if (window.Game) window.Game.walkToObject(d.id === 'stuetzbogen' ? 'hoehle' : d.id); return; }
    openPanel('vorrat');
  };
  A['game-go'] = (d) => {
    App.ui.panel = null; renderOverlays();
    if (App.view !== 'insel') go('insel');
    setTimeout(() => { if (window.Game) window.Game.walkToObject(d.obj); }, 60);
  };
  A['boss-hit'] = (d, el) => {
    const b = App.st.boss;
    if (b.defeated || !b.charge) { if (!b.defeated) toast('Keine Schlagkraft. Erledige eine Quest!'); return; }
    const n = Math.min(b.charge, bossHitSize(b));
    const before = App.st;
    const e = addEvent({ type: 'attack', n }, { quiet: true });
    const nb = App.st.boss;
    const btn = $('.boss-tap');
    if (btn) {
      btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit');
      const f = document.createElement('span'); f.className = 'dmg-float px'; f.textContent = '−' + n;
      f.style.left = (35 + Math.random() * 30) + '%'; btn.appendChild(f); setTimeout(() => f.remove(), 900);
    }
    if (nb.defeated) { celebrateChanges(before, App.st, e); setTimeout(() => render(), 450); return; }
    const set = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = v; };
    const bar = document.getElementById('boss-hp'); if (bar) bar.style.width = Math.round((nb.left / nb.hp) * 100) + '%';
    const cb = document.getElementById('boss-charge-bar'); if (cb) cb.style.width = Math.round(Math.min(1, nb.charge / Math.max(1, nb.left)) * 100) + '%';
    set('boss-left', nb.left + ' / ' + nb.hp + ' LP'); set('boss-charge', nb.charge);
    if (!nb.charge) { set('boss-tip', 'Keine Schlagkraft mehr. Jede Quest lädt neue auf.'); if (btn) btn.setAttribute('aria-disabled', 'true'); }
  };

  A['cave-leave'] = () => { if (window.Game) window.Game.leave(); };
  A.zoom = () => { if (!window.Game) return; window.Game.toggleZoom(); render(); };
  A['island-reset'] = () => { App.ui.islandSec = 0; App.ui.islandDay = App.st.today; savePrefs({ islandTime: { day: App.st.today, sec: 0 } }); App.ui.sheet = null; render(); toast('Inselzeit zurückgesetzt'); };
  A['wb-recipe'] = (d) => { const p = App.ui.panel; p.recipe = p.recipe === d.id ? null : d.id; const r = E.RECIPES.find((x) => x.id === d.id); if (p.recipe && r) p.hand = r.key[Object.keys(r.key)[0]]; renderOverlays(); };
  A['wb-hand'] = (d) => { const p = App.ui.panel; p.hand = p.hand === d.m ? null : d.m; renderOverlays(); };
  A['wb-slot'] = (d) => {
    const p = App.ui.panel, i = +d.i;
    if (p.grid[i]) { p.grid[i] = null; renderOverlays(); return; }
    if (!p.hand) { toast('Wähle zuerst unten ein Material'); return; }
    const use = gridUse(p.grid);
    if (App.st[p.hand] - use[p.hand] < E.SLOT_UNITS[p.hand]) { toast('Zu wenig ' + RES_NAME[p.hand] + ' im Vorrat (' + E.SLOT_UNITS[p.hand] + ' pro Feld)'); return; }
    p.grid[i] = p.hand; renderOverlays();
  };
  A['wb-clear'] = () => { App.ui.panel.grid = Array(9).fill(null); renderOverlays(); };
  A['wb-auto'] = () => {
    const p = App.ui.panel, r = E.RECIPES.find((x) => x.id === p.recipe);
    if (!r) return;
    const k = Object.keys(r.cost)[0];
    if (App.st[k] < r.cost[k]) { toast('Zu wenig ' + RES_NAME[k] + ': ' + App.st[k] + ' von ' + r.cost[k]); return; }
    p.grid = r.pattern.join('').split('').map((ch) => r.key[ch] || null);
    renderOverlays();
  };
  A['wb-make'] = () => {
    const p = App.ui.panel, r = gridMatch(p.grid);
    if (!r) return;
    const state = App.st.recipeState[r.id];
    if (state === 'gesperrt') { toast('Dieses Rezept gibt es erst nach der Leiter'); return; }
    if (state === 'gebaut') { toast(r.name + ' ist schon gebaut. Das brauchst du nicht nochmals.'); return; }
    if (state === 'bereit') { toast('Du hast schon ' + (r.id === 'leiter' ? 'eine Leiter' : 'einen Stützbogen') + '. Bau sie zuerst an.'); return; }
    const before = App.st.items[r.id] || 0;
    addEvent({ type: 'craft', recipe: r.id }, { quiet: true });
    if ((App.st.items[r.id] || 0) <= before) { toast('Das hat nicht geklappt. Ist genug Material im Vorrat?'); return; }
    p.grid = Array(9).fill(null); p.made = r.id;
    confetti();
    renderOverlays(); refreshInsel();
  };
  A['wb-again'] = () => { App.ui.panel.made = null; renderOverlays(); };
  A['demo-off'] = () => window.TQParents.setDemo(false);

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const fn = A[t.dataset.act];
    if (!fn) return;
    if (t.tagName === 'A') ev.preventDefault();
    try { fn(t.dataset, t, ev); }
    catch (e) {
      App.lastError = (t.dataset.act || '') + ': ' + (e && e.message) + ' | ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' / ') : '');
      try { console.error(App.lastError); } catch (x) { /* ignore */ }
      toast('Da ist etwas schiefgelaufen. Bitte nochmals versuchen.');
    }
  });

  App.boot = boot;
  App.storeFor = storeFor;
  App.load = load;
  App.route = route;
  App.reduceMotion = reduceMotion;
  document.addEventListener('DOMContentLoaded', () => { if (window.TQParents && window.TQTraining) boot(); });
})();
