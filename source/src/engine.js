/* Trocken-Quest – Rechenkern (Spielregeln)
 * Reine Funktionen: Aus Einstellungen + Tagebuch (Ereignisse) wird der ganze Spielstand berechnet.
 * Gespeichert werden nur Ereignisse, nie Punktestände.
 */
(function (root) {
  'use strict';

  /* ---------- Datum ---------- */
  const DAY_CUTOFF_H = 3; // Ein Tag geht bis 3 Uhr morgens (Abendroutine nach Mitternacht zählt noch zum Vortag)
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function dayKey(date) {
    const d = new Date((date instanceof Date ? date : new Date(date)).getTime() - DAY_CUTOFF_H * 3600e3);
    return fmt(d);
  }
  function parseDay(k) { const p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function addDays(k, n) { const d = parseDay(k); d.setDate(d.getDate() + n); return fmt(d); }
  function diffDays(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 864e5); }
  function weekday(k) { return (parseDay(k).getDay() + 6) % 7; } // 0 = Montag
  function weekStart(k) { return addDays(k, -weekday(k)); }
  function daysBetween(a, b) { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; }

  function uid() {
    try { if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID(); } catch (e) { /* ignore */ }
    const b = new Uint8Array(16);
    try { root.crypto.getRandomValues(b); } catch (e) { for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256); }
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, (x) => (x + 256).toString(16).slice(1)).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /* ---------- Standard-Einstellungen ---------- */
  const DEFAULT_SETTINGS = {
    v: 1,
    currency: 'xp',
    heroName: 'Lilo',
    heroColor: '#127C7A',
    startDate: null,
    quests: [
      { id: 'trinken', name: 'Trink-Checkpoint', pts: 5, times: 4, daily: true, active: true, kind: 'counter', icon: 'drop',
        hint: 'Über den Tag verteilt trinken, am besten bis 18 Uhr.' },
      { id: 'scan', name: 'Blasen-Scan', pts: 5, times: 3, daily: true, active: true, kind: 'counter', icon: 'scan',
        hint: 'Kurz in den Bauch hineinspüren: Wie voll ist die Blase? Dann aufs WC.' },
      { id: 'training', name: 'Training (5 Min.)', pts: 20, times: 1, daily: true, active: true, kind: 'training', icon: 'training', daysPerWeek: 6,
        hint: 'Ein Übungsblock aus dem Training. Sonntag ist Ruhetag (freiwillig).' },
      { id: 'abend', name: 'Abendroutine', pts: 15, times: 1, daily: true, active: true, kind: 'abend', icon: 'moon',
        hint: 'WC vor dem Schlafen und die Abend-Übung im Bett.' },
      { id: 'morgen', name: 'Morgen-Quest', pts: 10, times: 1, daily: true, active: true, kind: 'morgen', icon: 'bed',
        hint: 'Nach trockener Nacht: Bett lüften und machen. Nach nasser Nacht: Bett abziehen (Bett-Held).' }
    ],
    // Morgen-Quest mit XP oder «Bett-Held ohne XP». Gilt jeweils ab dem Datum «from».
    bettModes: [{ from: '0000-00-00', mode: 'xp' }],
    base: 100,
    growth: 10,
    weeks: 8,
    goalLevel: 15,
    comeback: true,
    streakShare: 50,
    bossHp: 350,
    bossLoot: 'Seltenes Item + 15 Min. Bildschirmzeit',
    rewards: [
      { id: 'r1', level: 3, what: '30 Min. extra Bildschirmzeit' },
      { id: 'r2', level: 6, what: 'Ein neuer Manga-Band' },
      { id: 'r3', level: 10, what: 'Gamen-Abend mit Mama oder Papa' },
      { id: 'r4', level: 15, what: 'Ausflug nach Wahl' }
    ],
    training: { unlock: 'auto', check: null, checkNote: '' },
    // Insel: Spielzeit pro Tag (Minuten) und Schlafenszeit (dann ruht das Spiel)
    islandMinutes: 5,
    sleepFrom: '22:00',
    sleepTo: '06:00',
    pinHash: null
  };

  function withDefaults(s) {
    const d = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    if (!s) return d;
    const out = Object.assign(d, s);
    out.training = Object.assign({}, DEFAULT_SETTINGS.training, s.training || {});
    if (!Array.isArray(out.quests)) out.quests = d.quests;
    if (!Array.isArray(out.rewards)) out.rewards = d.rewards;
    if (!Array.isArray(out.bettModes) || !out.bettModes.length) out.bettModes = d.bettModes;
    // Umstellung von Version 2: Bett-Held (20 XP nach nasser Nacht) wird zur Morgen-Quest (10 XP)
    if (!out.quests.some((q) => q.kind === 'morgen')) {
      const m = d.quests.find((q) => q.kind === 'morgen');
      const i = out.quests.findIndex((q) => q.kind === 'bett');
      if (i >= 0) out.quests.splice(i, 1, m); else out.quests.push(m);
    }
    return out;
  }
  function bettModeOn(s, day) {
    let m = 'xp';
    (s.bettModes || []).slice().sort((a, b) => (a.from < b.from ? -1 : 1)).forEach((x) => { if (x.from <= day) m = x.mode; });
    return m;
  }
  function currentBettMode(s) { const l = (s.bettModes || []).slice().sort((a, b) => (a.from < b.from ? -1 : 1)); return l.length ? l[l.length - 1].mode : 'xp'; }
  const questCounts = (s, q) => q.active && q.daily && !(q.kind === 'morgen' && currentBettMode(s) === 'ohneXP');

  const CURRENCY = { xp: 'XP', stern: 'Sterne', herz: 'Herzen' };

  /* ---------- Level ---------- */
  function levelCost(k, s) { return Math.max(1, Math.round(s.base * Math.pow(1 + s.growth / 100, k - 1))); }
  function cumTo(L, s) { let c = 0; for (let k = 1; k < L; k++) c += levelCost(k, s); return c; }
  function levelFor(xp, s) {
    let L = 1, c = 0;
    while (L < 500) {
      const n = levelCost(L, s);
      if (xp < c + n) return { level: L, into: xp - c, need: n, total: xp };
      c += n; L++;
    }
    return { level: L, into: 0, need: 1, total: xp };
  }
  function heroStages(goal) {
    const s1 = Math.max(2, Math.round(goal / 3));
    const s2 = Math.max(s1 + 1, Math.round((2 * goal) / 3));
    const s3 = Math.max(s2 + 1, goal);
    return [s1, s2, s3];
  }
  function heroStageFor(level, goal) {
    const st = heroStages(goal);
    return level >= st[2] ? 3 : level >= st[1] ? 2 : level >= st[0] ? 1 : 0;
  }
  const HERO_STAGE_NAMES = ['Entdecker', 'Höhlenforscher', 'Himmelsgleiter', 'Kristall-Wächter'];

  /* ---------- Fairness ---------- */
  function weeklyPossible(s) {
    return s.quests.filter((q) => questCounts(s, q))
      .reduce((t, q) => t + q.pts * q.times * (q.daysPerWeek || 7), 0);
  }
  function dailyPossible(s) {
    return s.quests.filter((q) => questCounts(s, q)).reduce((t, q) => t + q.pts * q.times, 0);
  }
  function fairness(s) {
    const possible = weeklyPossible(s) * s.weeks;
    const needed = cumTo(s.goalLevel, s);
    const q = possible > 0 ? needed / possible : 9;
    let status, text;
    if (q <= 0.75) status = 'fair';
    else if (q <= 0.9) status = 'anspruchsvoll';
    else if (q <= 1) status = 'knapp';
    else status = 'unerreichbar';
    const perWeek = (q * 7).toFixed(1).replace('.', ',');
    if (q > 1) text = 'Selbst mit lauter perfekten Tagen reicht es nicht. Ziel-Level senken oder Dauer verlängern.';
    else text = 'Das Kind braucht im Schnitt etwa ' + Math.round(q * 100) + ' % der möglichen Punkte, also rund ' + perWeek + ' volle Tage pro Woche.';
    return { q, status, text, possible, needed };
  }
  function autoFair(s) {
    const possible = weeklyPossible(s) * s.weeks;
    let L = 2;
    while (L < 200 && cumTo(L + 1, s) <= 0.7 * possible) L++;
    const hp = Math.max(50, Math.round((0.7 * weeklyPossible(s)) / 10) * 10);
    return { goalLevel: L, bossHp: hp };
  }

  /* ---------- Bauen (Fahrplan) ---------- */
  const BUILDS = [
    { id: 'leiter', name: 'Leiter zum Berg', area: 'Berg', helper: 'kiesel', cost: { holz: 21 }, stage: 0, craft: 'leiter',
      text: 'Stelle in der Werkbank eine Leiter her und baue sie am Berg an. Dann zieht Kiesel ein.' },
    { id: 'hoehle', name: 'Höhlengang', area: 'Höhle und Leuchtgrotte', helper: 'funkel', cost: { stein: 28 }, stage: 1, after: 'leiter', craft: 'stuetzbogen',
      text: 'Stelle einen Stützbogen her und grabe damit den Höhlengang in den Berg. Dann zieht Funkel in die Leuchtgrotte.' },
    { id: 'kristallinsel', name: 'Flug zur Kristallinsel', area: 'Kristallinsel', helper: 'splitti', cost: {}, stage: 2, after: 'hoehle', needsKey: true,
      text: 'Mit Gleitflügel und Kristall-Schlüssel springst du am Inselrand ab und gleitest hinüber. Dort wartet Splitti.' },
    { id: 'bruecke', name: 'Brücke zur Kristallinsel', area: 'Brücke', helper: null, cost: { holz: 18 }, stage: 2, after: 'kristallinsel', craft: 'bruecke',
      text: 'Stelle in der Werkbank eine Brücke aus Holz her und baue sie zwischen den Inseln. Dann sind beide Inseln verbunden.' },
    { id: 'himmelsinsel', name: 'Flug zur Himmelsinsel', area: 'Himmelsinsel', helper: 'wispel', cost: {}, stage: 3, after: 'bruecke',
      text: 'Das Finale: Wispel wartet auf der Insel und trägt dich zur Himmelsinsel hinauf.' }
  ];
  const HELPERS = [
    { id: 'moosling', name: 'Moosling', home: 'Wald', help: '+1 Holz pro Quest', names: ['Moosling', 'Moosgard', 'Waldhüter'] },
    { id: 'kiesel', name: 'Kiesel', home: 'Berg', help: '+1 Stein pro Quest', names: ['Kiesel', 'Kieselgolem', 'Bergriese'] },
    { id: 'funkel', name: 'Funkel', home: 'Leuchtgrotte', help: 'findet Truhen und den Kristall-Schlüssel', names: ['Funkel', 'Funkelfuchs', 'Glutphönix'] },
    { id: 'splitti', name: 'Splitti', home: 'Kristallinsel', help: '+3 Kristalle nach jedem Boss-Sieg', names: ['Splitti', 'Kristallo', 'Prismadrache'] },
    { id: 'wispel', name: 'Wispel', home: 'Himmelsinsel', help: 'Ehrenrunde und legendäres Item', names: ['Wispel', 'Wirbelwisp', 'Sturmfalke'] }
  ];
  // Werkbank: Rezepte im 3×3-Raster. Ein Feld braucht 3 Holz oder 4 Stein.
  const SLOT_UNITS = { holz: 3, stein: 4 };
  const RECIPES = [
    { id: 'leiter', name: 'Leiter', pattern: ['H.H', 'HHH', 'H.H'], key: { H: 'holz' }, use: 'Am Berg anbauen' },
    { id: 'stuetzbogen', name: 'Stützbogen', pattern: ['SSS', 'S.S', 'S.S'], key: { S: 'stein' }, use: 'Höhlengang im Berg stützen', after: 'leiter' },
    { id: 'bruecke', name: 'Brücke', pattern: ['...', 'HHH', 'HHH'], key: { H: 'holz' }, use: 'Zwischen Startinsel und Kristallinsel bauen', after: 'kristallinsel' }
  ].map((r) => {
    const cost = {};
    r.pattern.join('').split('').forEach((ch) => { if (r.key[ch]) cost[r.key[ch]] = (cost[r.key[ch]] || 0) + SLOT_UNITS[r.key[ch]]; });
    return Object.assign(r, { cost });
  });
  // Sammelbuch: seltene Fundstücke aus Truhen, Boss-Siegen und dem Finale
  const COLLECTION = [
    { id: 'moosperle', name: 'Moosperle', rarity: 'gewöhnlich', from: 'Truhe', shape: 'orb', pal: { a: '#2F6B22', b: '#6AB04C', c: '#C8F2A0' } },
    { id: 'leuchtpilz', name: 'Leuchtpilz', rarity: 'gewöhnlich', from: 'Truhe', shape: 'mushroom', pal: { a: '#9C3A08', b: '#FF9F43', c: '#FFE29A', d: '#F1E2C6' } },
    { id: 'funkelstein', name: 'Funkelstein', rarity: 'gewöhnlich', from: 'Truhe', shape: 'gem', pal: { a: '#94520E', b: '#FFB347', c: '#FFF1C2' } },
    { id: 'gluehwurmglas', name: 'Glühwurm-Glas', rarity: 'selten', from: 'Truhe', shape: 'jar', pal: { a: '#3A5A6E', b: '#CFEAFF', c: '#FFE066', d: '#8B5A3C' } },
    { id: 'sternenkiesel', name: 'Sternenkiesel', rarity: 'selten', from: 'Truhe', shape: 'orb', pal: { a: '#2A2F55', b: '#5B6AC9', c: '#FFFFFF' } },
    { id: 'sturmfeder', name: 'Sturmfeder', rarity: 'gewöhnlich', from: 'Boss-Sieg', shape: 'feather', pal: { a: '#3E4766', b: '#A9B8E0', d: '#6B4A2B' } },
    { id: 'golemzahn', name: 'Golem-Zahn', rarity: 'gewöhnlich', from: 'Boss-Sieg', shape: 'tooth', pal: { a: '#4F4F4F', b: '#D6D6D6', c: '#FFFFFF' } },
    { id: 'wolkenwolle', name: 'Wolkenwolle', rarity: 'gewöhnlich', from: 'Boss-Sieg', shape: 'orb', pal: { a: '#8FA3BF', b: '#F4F7FB', c: '#FFFFFF' } },
    { id: 'kristallsplitter', name: 'Kristallsplitter', rarity: 'selten', from: 'Boss-Sieg', shape: 'gem', pal: { a: '#4A3BB0', b: '#9B8CFF', c: '#E6E0FF' } },
    { id: 'drachenschuppe', name: 'Drachenschuppe', rarity: 'legendär', from: 'Boss-Sieg', shape: 'scale', pal: { a: '#0B5654', b: '#2BB3A8', c: '#BFF3EE' } },
    { id: 'himmelskrone', name: 'Himmelskrone', rarity: 'legendär', from: 'Finale', shape: 'crown', pal: { a: '#94520E', b: '#FFD166', c: '#FFFFFF' } }
  ];
  const CHEST_ITEMS = ['moosperle', 'leuchtpilz', 'funkelstein', 'gluehwurmglas', 'sternenkiesel'];
  const BOSS_ITEMS = ['sturmfeder', 'golemzahn', 'wolkenwolle', 'kristallsplitter', 'drachenschuppe'];
  const KEY_AFTER_QUESTS = 10;   // Funkel findet den Kristall-Schlüssel nach 10 Quests
  const CHEST_EVERY = 15;        // Funkel findet alle 15 Quests eine Truhe (+5 Holz, +5 Stein)
  const SELF_STONE_KINDS = { training: 1, abend: 1 };
  const SELF_STONE_IDS = { scan: 1 };

  /* ---------- Training ---------- */
  function trainingWeek(s, today) {
    const start = s.startDate || today;
    return Math.max(1, Math.floor(diffDays(start, today) / 7) + 1);
  }
  function trainingPlan(s, today, physio) {
    const week = trainingWeek(s, today);
    const effWeek = s.training && s.training.unlock === 'alle' ? Math.max(week, 99) : week;
    const unlocked = {};
    (physio ? physio.bloecke : []).forEach((b) => { unlocked[b.id] = b.freigeschaltet_ab_woche <= effWeek; });
    let afternoon, evening;
    const start = s.startDate || today;
    if (effWeek <= 2) {
      afternoon = diffDays(start, today) % 2 === 0 ? 'A' : 'B';
      evening = 'B1';
    } else {
      const row = physio && physio.wochenplan.ab_woche_3[weekday(today)];
      afternoon = row ? row.nachmittag : null;
      evening = row ? String(row.abend).split(' ')[0] : 'B1';
    }
    return { week, unlocked, afternoon, evening, sunday: weekday(today) === 6 };
  }

  /* ---------- Hauptberechnung ---------- */
  function compute(settingsIn, eventsIn, now) {
    const s = withDefaults(settingsIn);
    const today = dayKey(now || new Date());
    const start = s.startDate && s.startDate <= today ? s.startDate : today;
    const unit = CURRENCY[s.currency] || 'XP';
    const qById = {};
    s.quests.forEach((q) => { qById[q.id] = q; });
    const stages = heroStages(s.goalLevel);
    const dPossible = dailyPossible(s);

    const evs = (eventsIn || []).filter((e) => e && e.day && e.day >= start && e.day <= today)
      .slice().sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

    // Nacht pro Tag (letzter Eintrag zählt) – Bett-Held zählt nur nach einer nassen Nacht
    const nightOf = {};
    evs.forEach((e) => { if (e.type === 'night') nightOf[e.day] = !!e.dry; });
    const morgenOk = (day) => nightOf[day] !== undefined && bettModeOn(s, day) === 'xp';
    const qidOf = (e) => (e.questId === 'bett' ? (qById.morgen ? 'morgen' : 'bett') : e.questId);
    const bettHeldDays = {};
    evs.forEach((e) => { if (e.type === 'quest' && (e.questId === 'bett' || e.questId === 'morgen') && nightOf[e.day] === false) bettHeldDays[e.day] = true; });

    // Pass 1: Welche Quest-Ereignisse zählen (höchstens "times" pro Tag), Grundpunkte
    const perDayQuest = {};
    const counted = new Map();
    evs.forEach((e) => {
      if (e.type !== 'quest') return;
      const q = qById[qidOf(e)];
      if (!q) return;
      if (q.kind === 'morgen' && !morgenOk(e.day)) return;
      if (q.kind === 'bett' && nightOf[e.day] !== false) return;
      const k = e.day + '|' + q.id;
      perDayQuest[k] = (perDayQuest[k] || 0) + 1;
      if (perDayQuest[k] <= q.times) counted.set(e.id, { q, base: q.pts });
    });

    // Verpasste Tage (kein einziges gezähltes Quest) und Comeback-Bonus
    const days = daysBetween(start, today);
    const dayQuestCount = {};
    evs.forEach((e) => { if (counted.has(e.id)) dayQuestCount[e.day] = (dayQuestCount[e.day] || 0) + 1; });
    const missed = (d) => d >= start && d < today && !dayQuestCount[d];
    const comebackDay = (d) => s.comeback && d > start && missed(addDays(d, -1));
    const firstOfDay = {};
    evs.forEach((e) => { if (counted.has(e.id) && !firstOfDay[e.day]) firstOfDay[e.day] = e.id; });
    counted.forEach((c, id) => { c.pts = c.base; c.double = false; });
    Object.keys(firstOfDay).forEach((d) => {
      if (comebackDay(d)) { const c = counted.get(firstOfDay[d]); c.pts = c.base * 2; c.double = true; }
    });

    // Pass 2: Tagespunkte und Serien mit Schutzschilden
    const dayPts = {};
    evs.forEach((e) => { const c = counted.get(e.id); if (c) dayPts[e.day] = (dayPts[e.day] || 0) + c.pts; });
    const need = dPossible * (s.streakShare / 100);
    let streak = 0, shields = 0, best = 0;
    const sevenDays = [];
    const shieldUsed = [];
    const dayOk = {};
    days.forEach((d) => {
      const ok = need > 0 && (dayPts[d] || 0) >= need;
      dayOk[d] = ok;
      if (ok) {
        streak++;
        if (streak % 7 === 0) { sevenDays.push(d); shields = Math.min(2, shields + 1); }
      } else if (d === today) {
        // heute noch offen
      } else if (shields > 0) {
        shields--; shieldUsed.push(d);
      } else {
        streak = 0;
      }
      best = Math.max(best, streak);
    });
    const todayOk = !!dayOk[today];

    // Pass 3: Chronologisch durch das Tagebuch (Ressourcen, Bauen, Helfer, Boss)
    // Material: zuerst liegt es auf der Insel (field), nach dem Einsammeln ist es im Vorrat (holz, stein)
    let xp = 0, holz = 0, stein = 0, kristall = 0, chests = 0, sinceFunkel = 0, keyFound = false;
    let fieldHolz = 0, fieldStein = 0, chestsField = 0, chestsOpened = 0, keyHave = false;
    const items = {};
    const found = {};
    const addFound = (id, ts) => { found[id] = found[id] || { count: 0, first: ts }; found[id].count++; };
    const built = {};
    const helpers = { moosling: '0' };
    const helperDay = { moosling: start };
    const bosses = {};
    const wins = [];
    const claimed = {};
    const nights = {};
    const log = [];
    // Angebrochene Startwoche: Boss-Leben anteilig; bei weniger als 3 Tagen kommt der Boss erst am Montag
    const bossHpFor = (wk) => {
      if (wk >= start) return s.bossHp;
      const avail = 7 - diffDays(wk, start);
      if (avail < 3) return 0;
      return Math.max(50, Math.round((s.bossHp * avail) / 7 / 10) * 10);
    };
    const nHelpers = () => Object.keys(helpers).length;
    const newBoss = (wk) => ({ week: wk, hp: bossHpFor(wk), dmg: 0, dealt: 0, perDay: [0, 0, 0, 0, 0, 0, 0], defeated: null, auto: false, hits: [] });
    function winBoss(b, ts, day) {
      b.defeated = ts;
      b.dealt = Math.max(b.dealt, b.hp);
      wins.push({ week: b.week, ts, day });
      kristall += 1 + (helpers.splitti ? 3 : 0);
      addFound(BOSS_ITEMS[(wins.length - 1) % BOSS_ITEMS.length], ts);
    }
    // Nicht eingesetzte Schlagkraft wird am Ende der Woche automatisch eingesetzt: Es geht nichts verloren
    function closeWeeks(beforeDay) {
      Object.keys(bosses).sort().forEach((wk) => {
        const b = bosses[wk];
        if (b.closed || addDays(wk, 7) > beforeDay) return;
        b.closed = true;
        if (!b.defeated && b.hp && b.dmg >= b.hp) {
          const end = parseDay(addDays(wk, 6)); end.setHours(23, 30, 0, 0);
          b.auto = true;
          winBoss(b, end.toISOString(), addDays(wk, 6));
        }
      });
    }

    evs.forEach((e) => {
      closeWeeks(e.day);
      if (e.type === 'quest') {
        const c = counted.get(e.id);
        if (!c) return;
        const lvlBefore = levelFor(xp, s).level;
        xp += c.pts;
        fieldHolz += 1;
        if (helpers.kiesel) fieldStein += 1;
        if (SELF_STONE_KINDS[c.q.kind] || SELF_STONE_IDS[c.q.id]) fieldStein += 1;
        if (helpers.funkel) {
          sinceFunkel++;
          if (sinceFunkel % CHEST_EVERY === 0) { chests++; chestsField++; }
          if (sinceFunkel >= KEY_AFTER_QUESTS) keyFound = true;
        }
        // Boss
        const wk = weekStart(e.day);
        if (!bosses[wk]) bosses[wk] = newBoss(wk);
        const b = bosses[wk];
        if (!b.hp) { log.push({ id: e.id, ts: e.ts, day: e.day, kind: 'quest', name: c.q.name, pts: c.pts, double: c.double, levelUp: levelFor(xp, s).level > lvlBefore ? levelFor(xp, s).level : 0, by: e.by }); return; }
        let dmg = c.pts + nHelpers();
        if (heroStageFor(lvlBefore, s.goalLevel) >= 3 && weekday(e.day) === 6) dmg *= 2;
        if (!b.defeated) {
          b.dmg += dmg;
          b.perDay[weekday(e.day)] += dmg;
          b.hits.push({ name: c.q.name, dmg });
        }
        const lvlAfter = levelFor(xp, s).level;
        log.push({ id: e.id, ts: e.ts, day: e.day, kind: 'quest', name: c.q.name, pts: c.pts, double: c.double, levelUp: lvlAfter > lvlBefore ? lvlAfter : 0, by: e.by });
      } else if (e.type === 'attack') {
        // Das Kind setzt die gesammelte Schlagkraft selbst ein (Boss-Kampf zum Antippen)
        const wk = weekStart(e.day);
        const b = bosses[wk];
        if (!b || !b.hp || b.defeated) return;
        const n = Math.min(Math.max(0, Math.floor(e.n || 0)), Math.min(b.dmg, b.hp) - b.dealt);
        if (n <= 0) return;
        b.dealt += n;
        if (b.dealt >= b.hp) winBoss(b, e.ts, e.day);
      } else if (e.type === 'collect') {
        const n = Math.max(0, Math.floor(e.n || 0));
        if (e.res === 'holz') { const m = Math.min(n, fieldHolz); fieldHolz -= m; holz += m; }
        else if (e.res === 'stein') { const m = Math.min(n, fieldStein); fieldStein -= m; stein += m; }
        else if (e.res === 'truhe' && chestsField > 0) { chestsField--; chestsOpened++; holz += 5; stein += 5; addFound(CHEST_ITEMS[(chestsOpened - 1) % CHEST_ITEMS.length], e.ts); }
        else if (e.res === 'schluessel' && keyFound) keyHave = true;
      } else if (e.type === 'craft') {
        const r = RECIPES.find((x) => x.id === e.recipe);
        if (!r) return;
        // Nur herstellen, was gerade gebraucht wird: kein Doppel, nichts schon Gebautes
        const target = BUILDS.find((b) => b.craft === r.id);
        if ((items[r.id] || 0) > 0 || (target && built[target.id]) || (r.after && !built[r.after])) return;
        if ((r.cost.holz || 0) > holz || (r.cost.stein || 0) > stein) return;
        holz -= r.cost.holz || 0;
        stein -= r.cost.stein || 0;
        items[r.id] = (items[r.id] || 0) + 1;
        log.push({ id: e.id, ts: e.ts, day: e.day, kind: 'craft', name: r.name, by: e.by });
      } else if (e.type === 'build') {
        const def = BUILDS.find((b) => b.id === e.item);
        if (!def || built[def.id]) return;
        const lvl = levelFor(xp, s).level;
        if (def.after && !built[def.after]) return;
        if (def.stage > 0 && lvl < stages[def.stage - 1]) return;
        if (def.needsKey && !keyHave) return;
        if (def.craft && items[def.craft] > 0) {
          items[def.craft]--;
        } else {
          // Ältere Einträge ohne Werkbank: Material direkt verbrauchen (zuerst Vorrat, dann Insel)
          const ch = def.cost.holz || 0, cs = def.cost.stein || 0;
          if (ch > holz + fieldHolz || cs > stein + fieldStein) return;
          const th = Math.min(ch, holz); holz -= th; fieldHolz -= ch - th;
          const ts = Math.min(cs, stein); stein -= ts; fieldStein -= cs - ts;
        }
        built[def.id] = e.ts;
        if (def.helper) { helpers[def.helper] = e.ts; helperDay[def.helper] = e.day; }
        if (def.id === 'himmelsinsel') addFound('himmelskrone', e.ts);
        log.push({ id: e.id, ts: e.ts, day: e.day, kind: 'build', name: def.name, by: e.by });
      } else if (e.type === 'night') {
        nights[e.day] = { dry: !!e.dry, id: e.id, ts: e.ts };
      } else if (e.type === 'reward') {
        if (e.undo) delete claimed[e.rewardId]; else claimed[e.rewardId] = e.ts;
      }
    });

    closeWeeks(today);
    // Level
    const lv = levelFor(xp, s);
    const stage = heroStageFor(lv.level, s.goalLevel);

    // Helfer-Stufen
    const helperList = HELPERS.map((h) => {
      const since = helpers[h.id];
      let st = 0;
      if (since) {
        st = 1;
        const sinceDay = helperDay[h.id];
        const s2 = sevenDays.find((d) => d >= sinceDay);
        if (s2) {
          st = 2;
          if (wins.some((w) => w.day >= s2)) st = 3; // Stufe 3: Boss-Sieg nach Stufe 2
        }
      }
      return Object.assign({}, h, { here: !!since, since: since || null, stage: st, title: since ? h.names[st - 1] : h.name });
    });

    // Nächstes Bau-Ziel
    let nextBuild = null;
    for (const def of BUILDS) {
      if (built[def.id]) continue;
      const reqs = [];
      if (def.stage > 0) reqs.push({ label: 'Level ' + stages[def.stage - 1], have: lv.level, need: stages[def.stage - 1], ok: lv.level >= stages[def.stage - 1] });
      const crafted = !!(def.craft && items[def.craft] > 0);
      if (!crafted) {
        if (def.cost.holz) reqs.push({ label: def.cost.holz + ' Holz', res: 'holz', have: holz + fieldHolz, stock: holz, need: def.cost.holz, ok: holz + fieldHolz >= def.cost.holz });
        if (def.cost.stein) reqs.push({ label: def.cost.stein + ' Stein', res: 'stein', have: stein + fieldStein, stock: stein, need: def.cost.stein, ok: stein + fieldStein >= def.cost.stein });
      }
      if (def.needsKey) reqs.push({ label: 'Kristall-Schlüssel', have: Math.min(sinceFunkel, KEY_AFTER_QUESTS), need: KEY_AFTER_QUESTS, ok: keyHave, found: keyFound, keyQuests: true });
      const stockOk = (def.cost.holz || 0) <= holz && (def.cost.stein || 0) <= stein;
      const levelOk = !(def.stage > 0) || lv.level >= stages[def.stage - 1];
      nextBuild = Object.assign({}, def, { reqs, can: reqs.every((r) => r.ok), crafted, stockOk, levelOk,
        recipe: RECIPES.find((r) => r.id === def.craft) || null });
      break;
    }

    // Boss dieser Woche
    const wkNow = weekStart(today);
    const bossNow = bosses[wkNow] || newBoss(wkNow);
    bossNow.charge = bossNow.defeated ? 0 : Math.max(0, Math.min(bossNow.dmg, bossNow.hp) - bossNow.dealt);
    bossNow.left = Math.max(0, bossNow.hp - bossNow.dealt);
    bossNow.waiting = !bossNow.hp;
    bossNow.arrives = addDays(wkNow, 7);

    // Heute
    const todayCount = {};
    evs.forEach((e) => { if (e.day === today && counted.has(e.id)) { const k = qidOf(e); todayCount[k] = (todayCount[k] || 0) + 1; } });
    const modeToday = bettModeOn(s, today);
    const bettToday = evs.some((e) => e.day === today && e.type === 'quest' && (e.questId === 'bett' || e.questId === 'morgen'));
    const comebackPending = comebackDay(today) && !firstOfDay[today];
    const nightTodayVal = nightOf[today];
    const questsToday = s.quests.filter((q) => q.active && q.kind !== 'bett' && !(q.kind === 'morgen' && modeToday !== 'xp')).map((q) => {
      const o = {
        id: q.id, name: q.name, kind: q.kind, icon: q.icon, hint: q.hint, daily: q.daily,
        pts: q.pts, times: q.times, done: todayCount[q.id] || 0,
        complete: (todayCount[q.id] || 0) >= q.times,
        nextPts: comebackPending ? q.pts * 2 : q.pts
      };
      if (q.kind === 'morgen') {
        o.needsNight = nightTodayVal === undefined;
        o.variant = nightTodayVal === undefined ? null : nightTodayVal ? 'dry' : 'wet';
        o.name = o.variant === 'wet' ? 'Bett-Held: Bett abziehen' : o.variant === 'dry' ? 'Morgen: Bett lüften und machen' : 'Morgen-Quest';
        o.hint = o.variant === 'wet' ? 'Bett abziehen und die Wäsche in den Korb bringen.' : o.variant === 'dry' ? 'Fenster auf, Decke ausschütteln, Bett machen.' : 'Erst die Nacht eintragen, dann geht es los.';
        o.icon = 'bed';
      }
      return o;
    });

    // Nächte
    const nightDays = Object.keys(nights).sort();
    let dryRun = 0;
    for (let i = nightDays.length - 1; i >= 0; i--) { if (nights[nightDays[i]].dry) dryRun++; else break; }
    const dryTotal = nightDays.filter((d) => nights[d].dry).length;

    // Schatztruhe
    const rewards = s.rewards.slice().sort((a, b) => a.level - b.level).map((r) => ({
      id: r.id, level: r.level, what: r.what, unlocked: lv.level >= r.level, claimed: claimed[r.id] || null
    }));

    // Challenge-Fortschritt
    const dayNo = diffDays(start, today) + 1;
    const totalDays = s.weeks * 7;
    const goalXp = cumTo(s.goalLevel, s);

    return {
      today, start, unit, settings: s,
      xp, level: lv.level, levelInto: lv.into, levelNeed: lv.need,
      stage, stageName: HERO_STAGE_NAMES[stage], stages,
      holz, stein, kristall, chests, keyFound, keyHave, questsSinceFunkel: sinceFunkel,
      field: { holz: fieldHolz, stein: fieldStein, chests: chestsField, key: keyFound && !keyHave },
      recipeState: RECIPES.reduce((o, r) => {
        const target = BUILDS.find((b) => b.craft === r.id);
        o[r.id] = target && built[target.id] ? 'gebaut' : (items[r.id] || 0) > 0 ? 'bereit' : r.after && !built[r.after] ? 'gesperrt' : 'offen';
        return o;
      }, {}),
      chestsOpened, items, recipes: RECIPES,
      collection: COLLECTION.map((c, i) => Object.assign({ nr: i + 1, count: found[c.id] ? found[c.id].count : 0, first: found[c.id] ? found[c.id].first : null }, c)),
      bettMode: modeToday, bettHeldCount: Object.keys(bettHeldDays).length, bettToday,
      built, helpers: helperList, nextBuild,
      streak, bestStreak: best, shields, shieldUsed, todayOk, dayPts, dayOk,
      dailyPossible: dPossible, streakNeed: need,
      comebackPending, comebackToday: comebackDay(today),
      questsToday, todayPts: dayPts[today] || 0,
      boss: Object.assign({}, bossNow, { helperBonus: nHelpers(), sundayDouble: stage >= 3 }),
      bosses, wins,
      nights, nightToday: nights[today] || null, dryRun, dryTotal, nightsLogged: nightDays.length,
      rewards,
      log: log.reverse(),
      challenge: { dayNo, totalDays, goalXp, goalLevel: s.goalLevel, done: lv.level >= s.goalLevel, pct: Math.min(1, goalXp ? xp / goalXp : 0) },
      fairness: fairness(s)
    };
  }

  /* ---------- Demo-Daten (nur zum Anschauen) ---------- */
  function makeDemo(settingsIn, now, days) {
    const s = withDefaults(settingsIn);
    days = days || 26;
    const today = dayKey(now || new Date());
    s.startDate = addDays(today, -days);
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const events = [];
    const mk = (day, h, m, o) => { const t = parseDay(day); t.setHours(h, m, 0, 0); return Object.assign({ id: uid(), day, ts: t.toISOString(), by: 'demo' }, o); };
    for (let i = 0; i <= days; i++) {
      const d = addDays(s.startDate, i);
      const isToday = d === today;
      const skip = !isToday && (i === 9 || rnd() < 0.06);
      const p = 0.62 + (i / days) * 0.25;
      const dry = rnd() < 0.3 + (i / days) * 0.45;
      events.push(mk(d, 7, 5, { type: 'night', dry }));
      if (rnd() < 0.8) events.push(mk(d, 7, 20, { type: 'quest', questId: 'morgen' }));
      if (skip) continue;
      const hours = isToday ? [8, 10] : [8, 10, 12, 13, 15, 16, 17, 19, 20];
      for (let t = 0; t < 4; t++) if (rnd() < p + 0.1 && hours[t] !== undefined) events.push(mk(d, hours[t], 10, { type: 'quest', questId: 'trinken' }));
      for (let t = 0; t < 3; t++) if (rnd() < p && hours[t + 4] !== undefined && !isToday) events.push(mk(d, hours[t + 4], 30, { type: 'quest', questId: 'scan' }));
      if (!isToday && weekday(d) !== 6 && rnd() < p + 0.1) events.push(mk(d, 16, 45, { type: 'quest', questId: 'training', meta: { block: 'A' } }));
      if (!isToday && rnd() < p + 0.15) events.push(mk(d, 20, 15, { type: 'quest', questId: 'abend' }));
      // Am Tagesende einsammeln, herstellen und bauen (nur Leiter und Höhle; Flüge kommen in Etappe B)
      if (!isToday) {
        collectAll(s, events, d, 20, 30);
        const end = parseDay(d); end.setHours(23, 0, 0, 0);
        const st = compute(s, events, end);
        const nb = st.nextBuild;
        if (nb && nb.recipe && (nb.id === 'leiter' || nb.id === 'hoehle') && nb.levelOk && nb.stockOk) {
          events.push(mk(d, 20, 50, { type: 'craft', recipe: nb.recipe.id }));
          events.push(mk(d, 21, 0, { type: 'build', item: nb.id }));
        }
      }
    }
    events.push(mk(addDays(today, -4), 18, 0, { type: 'reward', rewardId: 'r1' }));
    return { settings: s, events };
  }

  // Alles einsammeln, was am Ende eines Tages auf der Insel liegt (für Demo-Daten)
  function collectAll(s, events, day, h, m) {
    const t = parseDay(day); t.setHours(h, m, 0, 0);
    const st = compute(s, events, t);
    ['holz', 'stein'].forEach((res, i) => {
      if (st.field[res] > 0) events.push({ id: uid(), day, ts: new Date(t.getTime() + i * 1000).toISOString(), by: 'kind', type: 'collect', res, n: st.field[res] });
    });
  }

  /* ---------- Demo: ganze Tage erzeugen ---------- */
  function dayHash(k) { let h = 0; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0; return h; }
  // Erzeugt die Ereignisse eines vollen Tages (alle täglichen Quests). existing = schon vorhandene Ereignisse.
  function fullDayEvents(settingsIn, day, existing, opts) {
    const s = withDefaults(settingsIn);
    const o = opts || {};
    const by = o.by || 'kind';
    const out = [];
    const have = {};
    (existing || []).forEach((e) => { if (e.day === day && e.type === 'quest') have[e.questId] = (have[e.questId] || 0) + 1; });
    const hasNight = (existing || []).some((e) => e.day === day && e.type === 'night');
    (existing || []).forEach((e) => { if (e.day === day && e.type === 'quest' && e.questId === 'bett') have.morgen = (have.morgen || 0) + 1; });
    const at = (h, m) => { const t = parseDay(day); t.setHours(h, m || 0, 0, 0); return t.toISOString(); };
    const mk = (h, m, o2) => Object.assign({ id: uid(), day, ts: at(h, m), by }, o2);
    let dry = null;
    if (o.night !== false && !hasNight) {
      dry = o.dry != null ? o.dry : (dayHash(day) % 10) < 6;
      out.push(mk(7, 5, { type: 'night', dry }));
    }
    const hours = { trinken: [8, 10, 13, 16], scan: [9, 12, 17] };
    const plan = trainingPlan(s, day, o.physio || null);
    s.quests.forEach((q) => {
      if (!q.active) return;
      const done = have[q.id] || 0;
      if (!q.daily) return;
      if (q.kind === 'morgen') {
        if (!done && (dry !== null || hasNight) && bettModeOn(s, day) === 'xp') out.push(mk(7, 20, { type: 'quest', questId: q.id }));
        return;
      }
      for (let i = done; i < q.times; i++) {
        const meta = q.kind === 'training' ? { block: plan.afternoon || 'A' } : q.kind === 'abend' ? { uebung: plan.evening || 'B1' } : undefined;
        const hh = q.kind === 'training' ? 16 : q.kind === 'abend' ? 20 : ((hours[q.id] || [])[i] || 11 + i);
        const e = mk(hh, q.kind === 'training' ? 40 : 15 + i, { type: 'quest', questId: q.id });
        if (meta) e.meta = meta;
        out.push(e);
      }
    });
    // Für den laufenden Tag nie Zeiten in der Zukunft eintragen (sonst zählt Material beim Bauen noch nicht)
    if (o.now) {
      const nowMs = o.now.getTime();
      out.sort((a, b) => (a.ts < b.ts ? -1 : 1));
      if (out.some((e) => new Date(e.ts).getTime() > nowMs)) {
        out.forEach((e, i) => { e.ts = new Date(nowMs - (out.length - i) * 60000).toISOString(); });
      }
    }
    return out;
  }
  // Demo-Startstand: 3 volle Tage erledigt, heute ist Tag 4
  function makeStart(settingsIn, now, days) {
    const s = withDefaults(settingsIn);
    const n = days == null ? 3 : days;
    const today = dayKey(now || new Date());
    s.startDate = addDays(today, -n);
    let events = [];
    const nights = [false, true, false, true, true, false, true];
    for (let i = 0; i < n; i++) {
      const d = addDays(s.startDate, i);
      events = events.concat(fullDayEvents(s, d, events, { dry: nights[i % nights.length] }));
      // Material der ersten Tage ist schon eingesammelt, das vom letzten Tag liegt noch auf der Insel
      if (i < n - 1) collectAll(s, events, d, 20, 30);
    }
    return { settings: s, events };
  }

  const Engine = {
    DAY_CUTOFF_H, DEFAULT_SETTINGS, CURRENCY, BUILDS, HELPERS, HERO_STAGE_NAMES, KEY_AFTER_QUESTS, CHEST_EVERY,
    dayKey, parseDay, addDays, diffDays, weekday, weekStart, daysBetween, uid,
    withDefaults, levelCost, cumTo, levelFor, heroStages, heroStageFor,
    weeklyPossible, dailyPossible, fairness, autoFair, bettModeOn, currentBettMode, RECIPES, SLOT_UNITS, COLLECTION,
    trainingWeek, trainingPlan, compute, makeDemo, fullDayEvents, makeStart
  };
  root.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
