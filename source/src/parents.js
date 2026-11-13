/* Trocken-Quest – Eltern-Ansicht */
(function () {
  'use strict';
  const App = window.TQ, E = window.Engine, P = window.PHYSIO, S = window.TQStore;
  const esc = App.esc, icon = App.icon;
  const Pa = {};
  window.TQParents = Pa;

  const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const COLORS = [['#127C7A', 'Dunkeltürkis'], ['#2A4BB8', 'Blau'], ['#C0392B', 'Rot'], ['#3B7A2A', 'Grün'], ['#6C5CE7', 'Lila'], ['#D9822B', 'Orange']];
  const STATUS = { fair: 'Fair', anspruchsvoll: 'Anspruchsvoll', knapp: 'Nur mit fast perfekten Tagen', unerreichbar: 'So nicht erreichbar' };

  function hashPin(pin) {
    let h = 2166136261;
    const s = 'trocken-quest:' + pin;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'p' + (h >>> 0).toString(36);
  }
  function sessionOk() { try { return sessionStorage.getItem('tq.parentOk') === '1'; } catch (e) { return false; } }
  function setSessionOk(v) { try { if (v) sessionStorage.setItem('tq.parentOk', '1'); else sessionStorage.removeItem('tq.parentOk'); } catch (e) { /* ignore */ } }

  const pin = { buf: '', first: null, error: '', mode: null };

  /* ---------- Bausteine ---------- */
  function stepper(label, value, act, data) {
    const attrs = Object.keys(data).map((k) => ' data-' + k + '="' + esc(data[k]) + '"').join('');
    return '<div class="stepper" role="group" aria-label="' + esc(label) + '"><button data-act="' + act + '" data-dir="-1"' + attrs + ' aria-label="' + esc(label) + ' verringern">−</button>' +
      '<output>' + esc(value) + '</output><button data-act="' + act + '" data-dir="1"' + attrs + ' aria-label="' + esc(label) + ' erhöhen">+</button></div>';
  }
  function sw(on, act, data, label) {
    const attrs = Object.keys(data || {}).map((k) => ' data-' + k + '="' + esc(data[k]) + '"').join('');
    return '<button class="switch" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '" data-act="' + act + '"' + attrs + '></button>';
  }
  function seg(options, current, act, key) {
    return '<div class="seg" role="group">' + options.map((o) => '<button data-act="' + act + '" data-key="' + key + '" data-val="' + esc(o[0]) + '" aria-pressed="' + (String(current) === String(o[0]) ? 'true' : 'false') + '">' + esc(o[1]) + '</button>').join('') + '</div>';
  }
  const fmtDay = (k) => { const d = E.parseDay(k); return DAYS[E.weekday(k)] + ' ' + d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
  const fmtTime = (ts) => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const roleName = (r) => ({ kind: 'Kind', mama: 'Mama', papa: 'Papa', eltern: 'Eltern', demo: 'Demo' }[r] || '');
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  /* ---------- PIN ---------- */
  function pinView() {
    const s = App.st.settings;
    if (!s.pinHash && App.isKidDevice()) {
      return '<main class="scroll" style="padding-block:32px 32px"><div class="stack" style="align-items:center;text-align:center">' +
        '<div class="q-ico" style="width:56px;height:56px">' + icon('lock', 26) + '</div><div class="h1">Eltern-Ansicht</div>' +
        '<p class="muted small">Es gibt noch keinen Eltern-PIN. Legt ihn zuerst auf einem Eltern-iPhone fest, dann kann man die Eltern-Ansicht auch hier öffnen.</p>' +
        '<button class="btn ghost" data-act="go" data-v="heute">Zur Kinder-Ansicht</button></div></main>';
    }
    const setting = !s.pinHash || pin.mode === 'change';
    const title = setting ? (pin.first == null ? 'Eltern-PIN festlegen' : 'PIN wiederholen') : 'Eltern-PIN';
    const sub = setting ? '4 Ziffern. Mama und Papa nutzen denselben PIN.' : 'Diese Ansicht ist für Mama und Papa.';
    let h = '<main class="scroll" style="padding-block:32px 32px"><div class="stack" style="align-items:center;text-align:center">' +
      '<div class="q-ico" style="width:56px;height:56px">' + icon('lock', 26) + '</div><div class="h1">' + title + '</div><p class="muted small">' + sub + '</p>' +
      '<div class="pin" aria-label="' + pin.buf.length + ' von 4 Ziffern">' + [0, 1, 2, 3].map((i) => '<i class="' + (i < pin.buf.length ? 'on' : '') + '"></i>').join('') + '</div>' +
      (pin.error ? '<p class="small" style="color:var(--rose)" role="alert">' + esc(pin.error) + '</p>' : '<p class="small">&nbsp;</p>') +
      '<div class="keypad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => '<button data-act="pin-key" data-k="' + n + '">' + n + '</button>').join('') +
      '<button data-act="pin-back" aria-label="Löschen">' + icon('back', 20) + '</button><button data-act="pin-key" data-k="0">0</button><span></span></div>' +
      '<button class="btn ghost" data-act="go" data-v="heute">Zur Kinder-Ansicht</button></div></main>';
    return h;
  }

  /* ---------- Ansicht ---------- */
  Pa.view = function () {
    if (App.device.demo) App.ui.parentOk = true;
    if (!App.ui.parentOk && sessionOk() && App.device.role !== 'kind') App.ui.parentOk = true;
    if (!App.ui.parentOk || pin.mode === 'change') return pinView();
    if (App.ui.eltTab === 'verlauf') App.ui.eltTab = 'kalender';
    const tabs = [['uebersicht', 'Übersicht'], ['kalender', 'Kalender'], ['einstellungen', 'Einstellungen'], ['training', 'Training'], ['daten', 'Daten']];
    let h = '<header class="hud"><div class="hud-top"><div class="hud-name">Eltern-Ansicht<small>' + esc(App.st.settings.heroName) + ' · Level ' + App.st.level + '</small></div>' +
      '<button class="btn sm teal" data-act="go" data-v="heute">Kinder-Ansicht</button></div>' +
      '<div class="tabs" role="tablist">' + tabs.map((t) => '<button role="tab" aria-selected="' + (App.ui.eltTab === t[0]) + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div></header>';
    h += '<main class="scroll" style="padding-bottom:calc(32px + env(safe-area-inset-bottom, 0px))"><div class="stack">';
    const t = App.ui.eltTab;
    if (App.isKidDevice()) h += '<div class="banner violet">' + icon('lock', 20) + '<div class="small">Auf dem iPhone des Kindes könnt ihr nur nachschauen. Einstellungen, Belohnungen und Notizen ändert ihr auf einem Eltern-iPhone.</div></div>';
    h += t === 'uebersicht' ? overview() : t === 'einstellungen' ? settingsView() : t === 'training' ? trainingTab() : t === 'kalender' ? calendarView() : dataView();
    h += '</div></main>';
    return h;
  };
  Pa.after = function () {
    if (App.ui.calScroll) {
      App.ui.calScroll = false;
      const el = document.getElementById('cal-detail');
      if (el) el.scrollIntoView({ block: 'start', behavior: App.reduceMotion ? 'auto' : 'smooth' });
    }
    const c = document.getElementById('hero-preview');
    if (c) window.World.drawCard(c, 'hero', { block: 'grass', stage: App.st.stage, color: App.st.settings.heroColor, px: 4 });
  };

  /* ---------- Übersicht ---------- */
  function overview() {
    const st = App.st, s = st.settings, ch = st.challenge;
    const expected = Math.round(ch.goalXp * Math.min(1, ch.dayNo / ch.totalDays));
    const ahead = st.xp >= expected * 0.9;
    let h = '<section class="blk stack"><div class="row between"><div class="h2">Challenge</div><span class="tag ' + (ch.done ? 'ok' : 'lock') + '">Tag ' + Math.min(ch.dayNo, ch.totalDays) + ' von ' + ch.totalDays + '</span></div>' +
      '<div class="row between"><span>Level <b>' + st.level + '</b> von ' + ch.goalLevel + ' · ' + st.stageName + '</span><span class="num muted" style="white-space:nowrap">' + st.xp + ' / ' + ch.goalXp + ' ' + st.unit + '</span></div>' +
      '<div class="meter"><i style="width:' + Math.round(ch.pct * 100) + '%"></i></div>' +
      '<p class="small muted">' + (ch.done ? 'Ziel erreicht.' : ahead ? 'Im Plan oder voraus.' : 'Etwas hinter einem gleichmässigen Tempo. Das ist normal und lässt sich aufholen; die Ampel in den Einstellungen zeigt, ob das Ziel fair bleibt.') + '</p></section>';

    // Belohnungen
    const open = st.rewards.filter((r) => r.unlocked && !r.claimed);
    if (open.length) {
      h += '<div class="sec-h">Belohnungen einlösen</div>' + open.map((r) => '<section class="blk gold row"><div class="grow"><div class="h3">' + esc(r.what) + '</div><div class="tiny muted">ab Level ' + r.level + ' · freigeschaltet</div></div>' +
        '<button class="btn sm gold" data-act="claim" data-id="' + esc(r.id) + '">eingelöst</button></section>').join('');
    }

    // Training-Check
    if (App.plan.week >= 3 && !s.training.check) {
      h += '<div class="banner violet">' + icon('training', 20) + '<div class="small grow">Zeit für den Check nach 2–3 Wochen: Gelingt das Anspannen und Loslassen? <button class="btn sm ghost" data-act="tab" data-tab="training" style="margin-top:6px">Zum Check</button></div></div>';
    }

    // Diese Woche
    const wk = E.weekStart(st.today);
    const trainings = {};
    App.data.events.forEach((e) => { if ((e.type === 'quest' && e.questId === 'training') || e.type === 'training') { trainings[e.day] = (trainings[e.day] || '') + ((e.meta && e.meta.block) || '•'); } });
    h += '<div class="sec-h">Diese Woche</div><section class="blk"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tag</th><th class="num">' + esc(st.unit) + '</th><th>Serie</th><th>Nacht</th><th>Training</th></tr></thead><tbody>';
    for (let i = 0; i < 7; i++) {
      const d = E.addDays(wk, i);
      const future = d > st.today || d < st.start;
      const n = st.nights[d];
      const pts = st.dayPts[d] || 0;
      h += '<tr><td' + (d === st.today ? ' style="color:var(--gold);font-weight:700"' : '') + '>' + fmtDay(d) + '</td><td class="num">' + (future ? '' : pts) + '</td>' +
        '<td>' + (future || d < st.start ? '' : st.dayOk[d] ? icon('check', 16) : st.shieldUsed.indexOf(d) >= 0 ? icon('shield', 16) : d === st.today ? '…' : '–') + '</td>' +
        '<td>' + (n ? (n.dry ? 'trocken' : 'nass') : (future ? '' : '–')) + '</td><td>' + (trainings[d] || (future ? '' : '–')) + '</td></tr>';
    }
    h += '</tbody></table></div><p class="tiny dim" style="margin-top:8px">Serien-Tag ab ' + Math.ceil(st.streakNeed) + ' ' + esc(st.unit) + ' (' + s.streakShare + ' % eines vollen Tages). Schild = verpasster Tag, vom Schutzschild aufgefangen.</p></section>';

    // Nächte
    const logged = st.nightsLogged;
    h += '<div class="sec-h">Nächte</div><section class="blk stack small">' +
      '<div class="row between"><span>Trockene Nächte seit Start</span><b class="num">' + st.dryTotal + ' von ' + logged + ' erfasst</b></div>' +
      '<div class="row between"><span>Aktuell trocken in Folge</span><b class="num">' + st.dryRun + '</b></div>' +
      '<p class="tiny dim">Nur zur Information für euch. Nächte geben keine Punkte und nehmen keine weg.</p></section>';

    // Werte
    h += '<div class="sec-h">Spielstand</div><section class="blk stack small">' +
      '<div class="row between"><span>Serie (beste)</span><b class="num">' + st.streak + ' (' + st.bestStreak + ') ' + (st.bestStreak === 1 ? 'Tag' : 'Tage') + ' · ' + st.shields + ' Schilde</b></div>' +
      '<div class="row between"><span>Boss diese Woche</span><b class="num">' + (st.boss.waiting ? 'erscheint am Montag' : st.boss.defeated ? 'besiegt' : Math.max(0, st.boss.hp - st.boss.dmg) + ' / ' + st.boss.hp + ' LP') + '</b></div>' +
      '<div class="row between"><span>Holz · Stein · Kristall</span><b class="num">' + st.holz + ' · ' + st.stein + ' · ' + st.kristall + '</b></div>' +
      '<div class="row between"><span>Helfer</span><b>' + st.helpers.filter((x) => x.here).map((x) => esc(x.title)).join(', ') + '</b></div></section>';
    h += App.device.demo
      ? '<div class="banner violet">' + icon('clock', 20) + '<div class="small">Demo: Alles ist ausgedacht und bleibt auf diesem Gerät. Mit «Zeit &amp; Demo» oben spulst du Tage vor.</div></div>'
      : App.store.kind === 'supabase' ? '' : '<div class="banner teal">' + icon('drop', 20) + '<div class="small">Bisher speichert jedes iPhone für sich. Einträge des Kindes erscheinen hier erst, wenn der gemeinsame Speicher eingerichtet ist.</div></div>';
    return h;
  }

  /* ---------- Einstellungen ---------- */
  function settingsView() {
    const st = App.st, s = st.settings, unit = st.unit;
    const f = E.fairness(s);
    let h = '<p class="small muted">Änderungen werden sofort gespeichert und gelten rückwirkend: Die App rechnet alles aus dem Tagebuch neu.</p>';

    h += '<div class="sec-h">Held</div><section class="blk stack"><div class="row" style="align-items:flex-start">' +
      '<canvas id="hero-preview" style="width:84px;height:84px;flex-shrink:0;image-rendering:pixelated" aria-hidden="true"></canvas>' +
      '<div class="grow stack" style="gap:8px"><div class="field"><label for="f-name">Name</label><input class="input" id="f-name" data-bind="heroName" value="' + esc(s.heroName) + '" maxlength="18" autocomplete="off"></div></div></div>' +
      '<div class="field"><span class="lbl">Pulli-Farbe</span><div class="row wrap">' + COLORS.map((c) => '<button class="swatch" style="background:' + c[0] + '" data-act="color" data-val="' + c[0] + '" aria-pressed="' + (s.heroColor === c[0]) + '" aria-label="' + c[1] + '"></button>').join('') + '</div></div></section>';

    h += '<div class="sec-h">Ziel der Challenge</div><section class="blk stack">' +
      '<div class="field"><label for="f-start">Startdatum (Woche 1)</label><input class="input" type="date" id="f-start" data-bind="startDate" value="' + esc(s.startDate || st.today) + '"></div>' +
      '<div class="row between wrap"><span class="lbl">Dauer</span>' + stepper('Dauer', s.weeks + ' Wochen', 'set-num', { key: 'weeks', step: 1, min: 2, max: 26 }) + '</div>' +
      '<div class="row between wrap"><span class="lbl">Ziel-Level</span>' + stepper('Ziel-Level', 'Level ' + s.goalLevel, 'set-num', { key: 'goalLevel', step: 1, min: 3, max: 60 }) + '</div>' +
      '<div class="ampel ' + f.status + '" role="status"><b>' + STATUS[f.status] + '</b><span class="small">' + esc(f.text) + '</span></div>' +
      '<button class="btn block" data-act="autofair">Auf fair stellen (70 % der möglichen Punkte)</button>' +
      '<p class="tiny dim">Lilos Stufen folgen dem Ziel: Höhlenforscher ab Level ' + st.stages[0] + ', Himmelsgleiter ab ' + st.stages[1] + ', Kristall-Wächter ab ' + st.stages[2] + '. Die Fairness rechnet das Training mit 6 Tagen pro Woche (Sonntag Ruhetag).</p></section>';

    h += '<div class="sec-h">Währung</div><section class="blk">' + seg([['xp', 'XP'], ['stern', 'Sterne'], ['herz', 'Herzen']], s.currency, 'set-val', 'currency') + '</section>';

    h += '<div class="sec-h">Quests</div><section class="blk stack"><p class="small muted">Ein voller Tag bringt <b>' + E.dailyPossible(s) + ' ' + unit + '</b>. «Bei Bedarf» zählt nicht in die Fairness.</p>';
    s.quests.forEach((q) => {
      const custom = q.id.indexOf('c_') === 0;
      h += '<div class="qedit" style="opacity:' + (q.active ? 1 : 0.6) + '"><div class="row"><input class="input grow" id="q-' + esc(q.id) + '" data-qname="' + esc(q.id) + '" value="' + esc(q.name) + '" aria-label="Name der Quest">' +
        sw(q.active, 'q-toggle', { id: q.id, key: 'active' }, q.name + ' aktiv') + '</div>' +
        '<div class="row wrap between"><span class="lbl">Punkte</span>' + stepper('Punkte', q.pts + ' ' + unit, 'q-num', { id: q.id, key: 'pts', step: 5, min: 0, max: 200 }) + '</div>' +
        '<div class="row wrap between"><span class="lbl">Pro Tag</span>' + stepper('Wie oft pro Tag', q.times + '×', 'q-num', { id: q.id, key: 'times', step: 1, min: 1, max: 10 }) + '</div>' +
        '<div class="row wrap between"><span class="lbl">Art</span>' + seg([['1', 'Täglich'], ['0', 'Bei Bedarf']], q.daily ? '1' : '0', 'q-daily', q.id) + '</div>' +
        (custom ? '<button class="btn sm danger" data-act="q-del" data-id="' + esc(q.id) + '">Quest entfernen</button>' : '') + '</div>';
    });
    h += '<button class="btn block" data-act="q-add">' + icon('plus', 18) + ' Quest hinzufügen</button></section>';

    h += '<div class="sec-h">Level</div><section class="blk stack">' +
      '<div class="row between wrap"><span class="lbl">Erstes Level</span>' + stepper('Punkte fürs erste Level', s.base + ' ' + unit, 'set-num', { key: 'base', step: 10, min: 10, max: 1000 }) + '</div>' +
      '<div class="row between wrap"><span class="lbl">Steigerung pro Level</span>' + stepper('Steigerung', '+' + s.growth + ' %', 'set-num', { key: 'growth', step: 5, min: 0, max: 50 }) + '</div>';
    const day70 = E.weeklyPossible(s) / 7 * 0.7;
    const lvls = [2, 3, 5, 10, 15, s.goalLevel].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Level</th><th class="num">' + unit + ' gesamt</th><th class="num">≈ Tage bei 70 %</th></tr></thead><tbody>' +
      lvls.map((L) => '<tr><td>' + L + (L === s.goalLevel ? ' (Ziel)' : '') + '</td><td class="num">' + E.cumTo(L, s) + '</td><td class="num">' + (day70 > 0 ? Math.ceil(E.cumTo(L, s) / day70) : '–') + '</td></tr>').join('') + '</tbody></table></div></section>';

    h += '<div class="sec-h">Insel</div><section class="blk stack">' +
      '<div class="row between wrap"><div class="grow"><div class="h3">Inselzeit pro Tag</div><div class="tiny muted">Danach ruht das Spiel bis morgen. Quests, Training und Nacht-Eintrag gehen immer.</div></div>' + stepper('Inselzeit pro Tag', (s.islandMinutes || 5) + ' Min.', 'set-num', { key: 'islandMinutes', step: 1, min: 1, max: 30 }) + '</div>' +
      '<div class="row wrap" style="gap:12px"><div class="field grow"><label for="f-sleep1">Schlafenszeit ab</label><input class="input" type="time" id="f-sleep1" data-bind="sleepFrom" value="' + esc(s.sleepFrom || '22:00') + '"></div>' +
      '<div class="field grow"><label for="f-sleep2">bis</label><input class="input" type="time" id="f-sleep2" data-bind="sleepTo" value="' + esc(s.sleepTo || '06:00') + '"></div></div>' +
      '<p class="tiny dim">In der Schlafenszeit schlafen alle im Haus, das Spiel ist zu. Drei Stunden vorher wird es auf der Insel Abend.</p></section>';
    const ohne = E.currentBettMode(s) === 'ohneXP';
    h += '<div class="sec-h">Morgen-Quest und Bett-Held</div><section class="blk stack">' +
      '<div class="row between"><div class="grow"><div class="h3">Bett-Held ohne XP</div><div class="tiny muted">' + (ohne
        ? 'Eingeschaltet: Keine Morgen-Quest. Nach nasser Nacht kann das Kind «Bett-Held» abhaken: Feier und Zähler, aber keine Punkte.'
        : 'Ausgeschaltet: Jeden Morgen gibt es die Morgen-Quest. Nach trockener Nacht Bett machen, nach nasser Nacht Bett abziehen. Gleich viele Punkte für beides.') + '</div></div>' +
      sw(ohne, 'bett-mode', {}, 'Bett-Held ohne XP') + '</div>' +
      '<p class="tiny dim">Die Umstellung gilt ab heute. Bisher verdiente Punkte bleiben. Die Punkte der Morgen-Quest stellst du oben bei den Quests ein.</p></section>';
    h += '<div class="sec-h">Serie und Bonus</div><section class="blk stack">' +
      '<div class="row between"><div class="grow"><div class="h3">Comeback-Bonus</div><div class="tiny muted">Nach einem verpassten Tag zählt die erste Quest doppelt.</div></div>' + sw(s.comeback, 'set-bool', { key: 'comeback' }, 'Comeback-Bonus') + '</div>' +
      '<div class="row between wrap"><div class="grow"><div class="h3">Serien-Tag ab</div><div class="tiny muted">Anteil eines vollen Tages. Alle 7 Serien-Tage gibt es ein Schutzschild (max. 2).</div></div>' + stepper('Serien-Tag ab', s.streakShare + ' %', 'set-num', { key: 'streakShare', step: 10, min: 20, max: 100 }) + '</div></section>';

    const wp = E.weeklyPossible(s);
    h += '<div class="sec-h">Wochen-Boss</div><section class="blk stack">' +
      '<div class="row between wrap"><span class="lbl">Lebenspunkte</span>' + stepper('Lebenspunkte', s.bossHp + ' ' + unit, 'set-num', { key: 'bossHp', step: 10, min: 50, max: 5000 }) + '</div>' +
      '<p class="tiny muted">≈ ' + (wp ? Math.round((s.bossHp / wp) * 100) : 0) + ' % einer perfekten Woche. Helfer geben +1 Schaden pro Quest. Nur Quests machen Schaden.</p>' +
      '<div class="field"><label for="f-loot">Beute bei Sieg</label><input class="input" id="f-loot" data-bind="bossLoot" value="' + esc(s.bossLoot) + '"></div></section>';

    h += '<div class="sec-h">Schatztruhe</div><section class="blk stack">';
    s.rewards.slice().sort((a, b) => a.level - b.level).forEach((r) => {
      h += '<div class="qedit"><div class="row between wrap"><span class="lbl">Ab Level</span>' + stepper('Level', 'Level ' + r.level, 'r-num', { id: r.id, step: 1, min: 1, max: 99 }) + '</div>' +
        '<div class="row"><input class="input grow" id="r-' + esc(r.id) + '" data-rtext="' + esc(r.id) + '" value="' + esc(r.what) + '" placeholder="Belohnung" aria-label="Belohnung"><button class="icon-btn" data-act="r-del" data-id="' + esc(r.id) + '" aria-label="Belohnung entfernen">' + icon('close', 16) + '</button></div></div>';
    });
    h += '<button class="btn block" data-act="r-add">' + icon('plus', 18) + ' Belohnung hinzufügen</button></section>';

    if (App.device.demo) return h + '<div class="sec-h">Sicherheit</div><section class="blk small muted">In der Demo ist die Eltern-Ansicht ohne PIN offen. In der echten Version schützt ein PIN.</section>';
    h += '<div class="sec-h">Sicherheit</div><section class="blk stack"><button class="btn block" data-act="pin-change">PIN ändern</button>' +
      '<p class="tiny dim">Der PIN gilt auf allen Geräten der Familie. Auf dem iPhone des Kindes fragt die App jedes Mal danach.</p></section>';
    return h;
  }

  /* ---------- Training (Eltern) ---------- */
  function trainingTab() {
    const s = App.st.settings, plan = App.plan;
    const favs = (App.data.prefs.favs || []).map((id) => P.uebungen.find((u) => u.id === id)).filter(Boolean);
    let h = '<section class="blk stack"><div class="row between"><div class="h2">Training</div><span class="tag lock">Woche ' + plan.week + '</span></div>' +
      '<div class="field"><span class="lbl">Freischaltung der Blöcke C, D, E</span>' + seg([['auto', 'Ab Woche 3'], ['alle', 'Jetzt alle offen']], s.training.unlock, 'tr-set', 'unlock') + '</div>' +
      '<p class="tiny dim">Block C erst beginnen, wenn das Kind den Beckenboden in Block A gut spürt.</p></section>';

    h += '<div class="sec-h">Check nach 2–3 Wochen</div><section class="blk stack"><p class="small">Gelingt das Anspannen und Loslassen?</p>' +
      seg([['ja', 'Ja'], ['teilweise', 'Teilweise'], ['nein', 'Noch nicht']], s.training.check || '', 'tr-set', 'check') +
      '<div class="field"><label for="f-checknote">Notiz</label><input class="input" id="f-checknote" data-trnote="1" value="' + esc(s.training.checkNote || '') + '" placeholder="z. B. Po kneift noch mit"></div>' +
      (s.training.check && s.training.check !== 'ja' ? '<p class="tiny muted">Hier hilft ein Termin bei einer Kinder-Beckenbodenphysiotherapie, um die Technik zu prüfen.</p>' : '') + '</section>';

    h += '<div class="sec-h">Hinweise der Physiotherapie</div><section class="blk"><ul class="rules small">' + P.eltern_hinweise.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></section>';
    h += '<div class="sec-h">So motiviert ihr</div><section class="blk"><ul class="rules small">' + P.motivation.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></section>';

    h += '<div class="sec-h">Lieblingsübungen</div><section class="blk small">' + (favs.length ? favs.map((u) => esc(u.name) + ' (' + u.block + ')').join(', ') : '<span class="muted">Noch keine markiert.</span>') + '</section>';

    h += '<div class="sec-h">Wochenplan</div><section class="blk stack small"><p><b>Woche 1–2:</b> ' + esc(P.wochenplan.woche_1_2) + '</p>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ab Woche 3</th><th>Nachmittag</th><th>Abend im Bett</th></tr></thead><tbody>' +
      P.wochenplan.ab_woche_3.map((r) => {
        const b = r.nachmittag ? P.bloecke.find((x) => x.id === r.nachmittag) : null;
        const ex = P.uebungen.find((u) => u.id === String(r.abend).split(' ')[0]);
        return '<tr><td>' + r.tag + '</td><td>' + (b ? b.id + ' · ' + esc(b.name) : 'Ruhetag') + '</td><td>' + (ex ? esc(ex.name) : '') + (String(r.abend).indexOf('freiwillig') > 0 ? ' (freiwillig)' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="tiny dim">Die Abend-Übung ist Teil der Quest «Abendroutine». Ein Trainingsblock bringt die Punkte der Quest «Training», egal welcher Block.</p></section>';

    h += '<div class="sec-h">Quellen</div><section class="blk stack small">' + P.quellen.map((q) => '<a href="' + esc(q.url) + '" target="_blank" rel="noopener">' + esc(q.titel) + '</a>').join('') + '</section>';
    return h;
  }

  /* ---------- Verlauf ---------- */
  function eventLabel(e) {
    const s = App.st.settings;
    if (e.type === 'collect') return e.res === 'truhe' ? 'Truhe geöffnet (+5 Holz, +5 Stein)' : e.res === 'schluessel' ? 'Kristall-Schlüssel geholt' : 'Eingesammelt: ' + e.n + ' ' + (App.RES_NAME[e.res] || e.res);
    if (e.type === 'attack') return 'Boss-Schlag: ' + e.n + ' Schaden';
    if (e.type === 'craft') { const r = E.RECIPES.find((x) => x.id === e.recipe); return 'Hergestellt: ' + (r ? r.name : e.recipe); }
    if (e.type === 'quest' && (e.questId === 'morgen' || e.questId === 'bett')) {
      const n = (App.data.events.filter((x) => x.day === e.day && x.type === 'night').sort((a, b) => (a.ts < b.ts ? 1 : -1))[0]);
      return n && !n.dry ? 'Bett-Held: Bett abgezogen' + (E.bettModeOn(s, e.day) === 'ohneXP' ? ' (ohne XP)' : '') : 'Morgen: Bett gemacht';
    }
    if (e.type === 'quest') {
      const q = s.quests.find((x) => x.id === e.questId);
      let t = q ? q.name : 'Quest (' + e.questId + ')';
      if (e.meta && e.meta.block) t += ' · Block ' + e.meta.block;
      if (e.meta && e.meta.uebung) t += ' · ' + e.meta.uebung;
      return t;
    }
    if (e.type === 'night') return 'Nacht ' + (e.dry ? 'trocken' : 'nass');
    if (e.type === 'build') { const b = E.BUILDS.find((x) => x.id === e.item); return 'Gebaut: ' + (b ? b.name : e.item); }
    if (e.type === 'reward') { const r = s.rewards.find((x) => x.id === e.rewardId); return 'Belohnung eingelöst: ' + (r ? r.what : ''); }
    if (e.type === 'training') return 'Extra-Training · Block ' + ((e.meta && e.meta.block) || '');
    if (e.type === 'note') return 'Notiz: ' + (e.text || '');
    return e.type;
  }
  /* ---------- Kalender ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  function dayInfo() {
    const map = {};
    const get = (d) => (map[d] = map[d] || { night: null, nightTs: '', training: false, note: null, noteTs: '' });
    App.data.events.forEach((e) => {
      const x = get(e.day);
      if (e.type === 'night' && e.ts >= x.nightTs) { x.night = e.dry ? 'dry' : 'wet'; x.nightTs = e.ts; }
      if ((e.type === 'quest' && e.questId === 'training') || e.type === 'training') x.training = true;
      if (e.type === 'note' && e.ts >= x.noteTs) { x.note = e.text; x.noteTs = e.ts; }
    });
    return map;
  }
  function inRange(d) { return d >= App.st.start && d <= App.st.today; }

  function calendarView() {
    const st = App.st, ui = App.ui;
    if (!ui.calMonth) ui.calMonth = st.today.slice(0, 7);
    if (!ui.calDay || !inRange(ui.calDay)) ui.calDay = st.today;
    const y = +ui.calMonth.slice(0, 4), m = +ui.calMonth.slice(5, 7);
    const first = y + '-' + pad2(m) + '-01';
    const gridStart = E.addDays(first, -E.weekday(first));
    const info = dayInfo();
    const full = st.dailyPossible || 1;
    let cells = '';
    let d = gridStart;
    for (let w = 0; w < 6; w++) {
      if (w > 0 && d.slice(0, 7) !== ui.calMonth) break;
      for (let i = 0; i < 7; i++) {
        const x = info[d] || {};
        const out = d.slice(0, 7) !== ui.calMonth;
        const ok = inRange(d);
        const pts = st.dayPts[d] || 0;
        const cls = ['cal-cell', out ? 'out' : '', x.night || '', d === st.today ? 'today' : '', d === ui.calDay ? 'sel' : ''].join(' ');
        const lab = fmtDay(d) + ': ' + (x.night === 'dry' ? 'Nacht trocken' : x.night === 'wet' ? 'Nacht nass' : 'Nacht nicht erfasst') + ', ' + pts + ' ' + st.unit + (x.training ? ', Training' : '') + (x.note ? ', Notiz' : '');
        cells += '<button class="' + cls + '" data-act="cal-day" data-d="' + d + '"' + (ok ? '' : ' disabled') + ' aria-label="' + esc(lab) + '"' + (d === ui.calDay ? ' aria-pressed="true"' : '') + '>' +
          '<span class="cal-n">' + E.parseDay(d).getDate() + '</span>' +
          '<span class="cal-ico">' + (x.night === 'dry' ? icon('sun', 15) : x.night === 'wet' ? icon('cloud', 15) : '') + '</span>' +
          '<span class="cal-dots">' + (x.training ? '<i class="t"></i>' : '') + (x.note ? '<i class="n"></i>' : '') + '</span>' +
          '<span class="cal-bar">' + (ok && pts ? '<i style="width:' + Math.min(100, Math.round((pts / full) * 100)) + '%"></i>' : '') + '</span></button>';
        d = E.addDays(d, 1);
      }
    }
    let h = '<section class="blk stack"><div class="row between"><button class="icon-btn" data-act="cal-month" data-dir="-1" aria-label="Vorheriger Monat">' + icon('back', 18) + '</button>' +
      '<div class="h2">' + MONTHS[m - 1] + ' ' + y + '</div><button class="icon-btn" data-act="cal-month" data-dir="1" aria-label="Nächster Monat">' + icon('next', 18) + '</button></div>' +
      '<div class="cal">' + ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((n) => '<span class="cal-h">' + n + '</span>').join('') + cells + '</div>' +
      '<div class="cal-legend"><span><i class="lg dry"></i>trocken</span><span><i class="lg wet"></i>nass</span><span><i class="lg none"></i>nicht erfasst</span>' +
      '<span><i class="lg t"></i>Training</span><span><i class="lg n"></i>Notiz</span><span><i class="lg bar"></i>' + esc(st.unit) + ' des Tages</span></div></section>';
    h += monthSummary(info);
    h += dayDetail(info);
    h += weekChart(info);
    return h;
  }

  function monthSummary(info) {
    const st = App.st, ui = App.ui;
    let dry = 0, logged = 0, ok = 0, train = 0, days = 0, pts = 0;
    Object.keys(info).concat(Object.keys(st.dayPts)).filter((d, i, a) => a.indexOf(d) === i).forEach((d) => {
      if (d.slice(0, 7) !== ui.calMonth || !inRange(d)) return;
      const x = info[d] || {};
      if (x.night) { logged++; if (x.night === 'dry') dry++; }
      if (x.training) train++;
    });
    for (let d = ui.calMonth + '-01'; d.slice(0, 7) === ui.calMonth; d = E.addDays(d, 1)) {
      if (!inRange(d)) continue;
      days++; pts += st.dayPts[d] || 0; if (st.dayOk[d]) ok++;
    }
    const pct = logged ? Math.round((dry / logged) * 100) : 0;
    return '<div class="sec-h">Dieser Monat</div><section class="blk"><div class="kpis">' +
      '<div><b class="num">' + dry + '<small> / ' + logged + '</small></b><span>trockene Nächte' + (logged ? ' (' + pct + ' %)' : '') + '</span></div>' +
      '<div><b class="num">' + ok + '<small> / ' + days + '</small></b><span>Serien-Tage</span></div>' +
      '<div><b class="num">' + train + '</b><span>Trainings</span></div>' +
      '<div><b class="num">' + (days ? Math.round(pts / days) : 0) + '</b><span>Ø ' + esc(st.unit) + ' pro Tag</span></div></div></section>';
  }

  function weekChart(info) {
    const st = App.st;
    const weeks = [];
    for (let w = E.weekStart(st.start); w <= st.today; w = E.addDays(w, 7)) {
      let dry = 0, logged = 0;
      for (let i = 0; i < 7; i++) { const x = info[E.addDays(w, i)]; if (x && x.night) { logged++; if (x.night === 'dry') dry++; } }
      weeks.push({ w, dry, logged });
    }
    if (!weeks.length) return '';
    return '<div class="sec-h">Trockene Nächte pro Woche</div><section class="blk stack"><div class="wk" role="img" aria-label="' + esc(weeks.map((x, i) => 'Woche ' + (i + 1) + ': ' + x.dry + ' von ' + x.logged).join(', ')) + '">' +
      weeks.map((x, i) => '<div class="wk-col"><span class="num tiny">' + x.dry + '</span><div class="wk-bar"><i style="height:' + Math.round((x.dry / 7) * 100) + '%"></i></div><span class="tiny muted">W' + (i + 1) + '</span></div>').join('') +
      '</div><p class="tiny dim">Höhe = trockene Nächte von 7. Nur zur Übersicht für euch: Nächte geben in der App keine Punkte.</p></section>';
  }

  function dayDetail(info) {
    const st = App.st, d = App.ui.calDay;
    const x = info[d] || {};
    const counts = {};
    App.data.events.forEach((e) => { if (e.day === d && e.type === 'quest') { const k = e.questId === 'bett' ? 'morgen' : e.questId; counts[k] = (counts[k] || 0) + 1; } });
    const modeDay = E.bettModeOn(st.settings, d);
    const nightVal = x.night || 'none';
    let h = '<section class="blk stack" id="cal-detail"><div class="row between"><div class="h2">' + fmtDay(d) + (d === st.today ? ' (heute)' : '') + '</div><span class="small muted num">' + (st.dayPts[d] || 0) + ' / ' + st.dailyPossible + ' ' + esc(st.unit) + (st.dayOk[d] ? ' · Serien-Tag' : '') + '</span></div>' +
      '<div class="field"><span class="lbl">Nacht</span>' + seg([['dry', 'Trocken'], ['wet', 'Nass'], ['none', 'Nicht erfasst']], nightVal, 'cal-night', 'night') + '</div>' +
      '<div class="field"><span class="lbl">Quests</span><div class="stack" style="gap:6px">';
    st.settings.quests.filter((q) => q.active).forEach((q) => {
      const n = counts[q.id] || 0;
      if (q.kind === 'bett') return;
      let name = q.name, lockText = '';
      if (q.kind === 'morgen') {
        name = x.night === 'wet' ? 'Bett-Held: Bett abziehen' : x.night === 'dry' ? 'Morgen: Bett machen' : 'Morgen-Quest';
        if (!x.night) lockText = 'erst die Nacht eintragen';
        else if (modeDay === 'ohneXP') { name += ' (ohne XP)'; if (x.night !== 'wet') lockText = 'ohne XP nur nach nasser Nacht'; }
      }
      const full = n >= q.times;
      const qid = q.kind === 'morgen' && modeDay === 'ohneXP' ? 'bett' : q.id;
      h += '<div class="row cal-q"><div class="grow"><span>' + esc(name) + '</span> <span class="tiny muted num">' + Math.min(n, q.times) + ' / ' + q.times + '</span>' +
        (lockText ? '<div class="tiny dim">' + lockText + '</div>' : '') + '</div>' +
        '<button class="btn sm" data-act="cal-add" data-q="' + esc(qid) + '"' + (full || lockText ? ' disabled' : '') + ' aria-label="' + esc(name) + ' nachtragen">' + icon('plus', 16) + '</button></div>';
    });
    h += '</div></div>' +
      '<div class="field"><label for="cal-note">Notiz</label><textarea class="input note" id="cal-note" placeholder="z. B. Übernachtung bei Oma, krank, spät viel getrunken">' + esc(x.note || '') + '</textarea>' +
      '<button class="btn sm" data-act="cal-note-save" style="align-self:flex-start">' + icon('note', 16) + ' Notiz speichern</button></div>';
    const evs = App.data.events.filter((e) => e.day === d).sort((a, b) => (a.ts < b.ts ? -1 : 1));
    h += '<div class="field"><span class="lbl">Einträge</span>' + (evs.length ? evs.map((e) => {
      const confirm = App.ui.confirmDel === e.id;
      return '<div class="entry"><time>' + fmtTime(e.ts) + '</time><span>' + esc(eventLabel(e)) + (e.by ? ' <span class="tiny dim">· ' + esc(roleName(e.by)) + '</span>' : '') + '</span>' +
        (confirm ? '<button class="btn sm danger" data-act="del-yes" data-id="' + esc(e.id) + '">Löschen?</button>' : '<button class="icon-btn" style="width:40px;height:40px" data-act="del" data-id="' + esc(e.id) + '" aria-label="Eintrag löschen">' + icon('close', 14) + '</button>') + '</div>';
    }).join('') : '<p class="small muted">Keine Einträge an diesem Tag.</p>') + '</div></section>';
    return h;
  }

  /* ---------- Daten ---------- */
  Pa.syncState = function () {
    const st = App.store.status ? App.store.status() : null;
    if (!st) return '';
    const t = st.lastSync ? new Date(st.lastSync) : null;
    const when = t ? String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') : 'noch nie';
    return '<div class="row between"><span>Verbindung</span><b>' + (st.online ? 'online' : 'offline') + '</b></div>' +
      '<div class="row between"><span>Zuletzt abgeglichen</span><b class="num">' + when + '</b></div>' +
      '<div class="row between"><span>Noch nicht gesendet</span><b class="num">' + st.pending + '</b></div>' +
      (st.error ? '<p class="tiny" style="color:var(--rose)">' + esc(st.error) + '</p>' : '');
  };
  function liveDataView() {
    const st = App.store.status();
    const parent = st.family && st.family.role === 'eltern';
    let h = '<div class="sec-h">Gemeinsamer Speicher</div><section class="blk stack small"><p>Alle iPhones der Familie sehen dieselben Einträge. Ohne Internet wird auf dem Gerät gespeichert und später nachgeschickt.</p>' +
      '<div class="stack" id="sync-state">' + Pa.syncState() + '</div>' +
      '<button class="btn block" data-act="sync-now">Jetzt abgleichen</button></section>';
    h += '<div class="sec-h">Dieses Gerät</div><section class="blk stack small"><div class="row between"><span>Rolle</span><b>' + (parent ? 'Eltern (' + esc(roleName(App.device.role) || 'Eltern') + ')' : 'Kind') + '</b></div>' +
      (parent ? seg([['mama', 'Mama'], ['papa', 'Papa']], App.device.role, 'set-role', 'role') : '') + '</section>';
    if (parent) {
      const c = App.ui.codes;
      h += '<div class="sec-h">Codes für weitere Geräte</div><section class="blk stack small">' +
        (c ? '<span class="lbl">Code fürs Kind</span><div class="code-big px">' + esc(c.kidCode) + '</div><span class="lbl">Code für Eltern</span><div class="code-big px">' + esc(c.parentCode) + '</div><p class="tiny dim">Auf dem neuen iPhone die App öffnen, «Ich habe einen Code» wählen und den Code eingeben.</p>'
          : '<button class="btn block" data-act="show-codes">Codes anzeigen</button>') + '</section>';
      const m = App.ui.members;
      h += '<div class="sec-h">Verbundene Geräte</div><section class="blk stack small">' +
        (m ? m.map((x) => '<div class="row between"><span>' + esc(roleName(x.device) || (x.role === 'kind' ? 'Kind' : 'Eltern')) + (x.me ? ' (dieses)' : '') + '<br><span class="tiny dim">seit ' + fmtDay(E.dayKey(new Date(x.created_at))) + '</span></span>' +
          (x.me ? '' : App.ui.confirmMember === x.user_id ? '<button class="btn sm danger" data-act="member-del-yes" data-id="' + esc(x.user_id) + '">Wirklich trennen?</button>' : '<button class="btn sm ghost" data-act="member-del" data-id="' + esc(x.user_id) + '">Trennen</button>') + '</div>').join('') +
          '<p class="tiny dim">«Trennen» meldet ein Gerät ab, zum Beispiel ein verlorenes iPhone. Die Einträge bleiben erhalten.</p>'
          : '<button class="btn block" data-act="show-members">Geräte anzeigen</button>') + '</section>';
    }
    const json = JSON.stringify(App.store.exportAll());
    h += '<div class="sec-h">Sicherung</div><section class="blk stack"><p class="small muted">Eine Kopie aller Einträge als Text, zum Aufbewahren.</p><div class="field"><label for="exp">Sicherung (zum Kopieren)</label><textarea class="input" id="exp" readonly>' + esc(json) + '</textarea></div>' +
      '<button class="btn block" data-act="copy-exp">Kopieren</button></section>';
    h += '<div class="sec-h">Demo</div><section class="blk stack"><p class="small">Die Demo zeigt einen ausgedachten Stand mit Zeitreise. Eure echten Daten bleiben unberührt.</p><button class="btn block" data-act="demo" data-on="1">Demo ansehen</button></section>';
    h += '<div class="sec-h">Gerät abmelden</div><section class="blk stack"><p class="small muted">Trennt nur dieses iPhone. Die gemeinsamen Daten bleiben online. Danach braucht es wieder einen Code.</p>' +
      (App.ui.confirmLeave ? '<button class="btn danger block" data-act="leave-yes">Ja, dieses Gerät abmelden</button><button class="btn ghost block" data-act="leave-no">Abbrechen</button>' : '<button class="btn block" data-act="leave">Abmelden</button>') + '</section>';
    return h;
  }
  function dataView() {
    if (App.store.kind === 'supabase') return liveDataView();
    const dev = App.device;
    const json = JSON.stringify(App.store.exportAll());
    let h = '<div class="sec-h">Speicher</div><section class="blk stack small"><p>Diese Version speichert <b>nur auf diesem Gerät</b>' + (App.store.persistent ? '' : ' und nur bis zum Schliessen, weil der Browser keinen Speicher erlaubt') + '. Mit dem gemeinsamen Speicher (nächster Schritt) sehen alle drei iPhones dasselbe.</p>' +
      '<p class="muted">Einträge: ' + App.data.events.length + '</p></section>';
    h += '<div class="sec-h">Dieses Gerät</div><section class="blk stack"><span class="lbl">Wer benutzt es?</span>' + seg([['kind', 'Kind'], ['mama', 'Mama'], ['papa', 'Papa']], dev.role, 'set-role', 'role') +
      '<p class="tiny dim">Auf dem Gerät des Kindes fragt die App beim Öffnen der Eltern-Ansicht jedes Mal nach dem PIN.</p></section>';
    if (dev.demo && App.LIVE) return h + '<div class="sec-h">Demo</div><section class="blk stack"><p class="small">Du schaust gerade die Demo an. Eure echten Daten sind davon nicht betroffen.</p><button class="btn block teal" data-act="demo" data-on="0">Demo verlassen</button></section>';
    h += '<div class="sec-h">Demo</div><section class="blk stack"><p class="small">' + (dev.demo ? 'Die App läuft im Demo-Modus, bis die gemeinsame Version bereit ist. Startstände und Zeitreise findest du oben unter «Zeit &amp; Demo».' : 'Die Demo zeigt einen ausgedachten Stand. Eure echten Daten bleiben unberührt.') + '</p>' +
      (dev.demo ? '<button class="btn block" data-act="demo" data-on="0">Demo verlassen (echte Nutzung nur auf diesem Gerät)</button>' : '<button class="btn block" data-act="demo" data-on="1">Zurück zur Demo</button>') + '</section>';
    h += '<div class="sec-h">Sicherung</div><section class="blk stack"><div class="field"><label for="exp">Sicherung (zum Kopieren)</label><textarea class="input" id="exp" readonly>' + esc(json) + '</textarea></div>' +
      '<button class="btn block" data-act="copy-exp">Kopieren</button>' +
      '<div class="field"><label for="imp">Sicherung einspielen</label><textarea class="input" id="imp" placeholder="Hier eine kopierte Sicherung einfügen"></textarea></div>' +
      (App.ui.confirmImport ? '<button class="btn danger block" data-act="imp-yes">Ersetzt alle Daten auf diesem Gerät. Wirklich einspielen?</button>' : '<button class="btn block" data-act="imp">Einspielen</button>') + '</section>';
    h += '<div class="sec-h">Neu beginnen</div><section class="blk stack"><p class="small muted">Löscht Tagebuch und Einstellungen auf diesem Gerät.</p>' +
      (App.ui.confirmReset ? '<button class="btn danger block" data-act="reset-yes">Ja, alles löschen</button><button class="btn ghost block" data-act="reset-no">Abbrechen</button>' : '<button class="btn block" data-act="reset">Alles zurücksetzen</button>') + '</section>';
    return h;
  }

  /* ---------- Demo ---------- */
  Pa.setDemo = function (on) {
    App.saveDevice({ demo: !!on });
    App.store = App.storeFor(App.device);
    App.load();
    App.ui.parentOk = App.device.role !== 'kind' ? !!on || App.ui.parentOk : App.ui.parentOk;
    App.ui.calMonth = null; App.ui.calDay = null;
    if (!on && App.LIVE) App.store.sync().catch(() => {});
    App.go(on ? 'heute' : (App.device.role === 'kind' ? 'heute' : 'eltern'));
  };

  /* ---------- Aktionen ---------- */
  const A = App.actions;
  const rerender = () => App.render();
  A['pin-key'] = (d) => {
    if (pin.buf.length >= 4) return;
    pin.buf += d.k; pin.error = '';
    if (pin.buf.length < 4) return rerender();
    const s = App.st.settings;
    const setting = !s.pinHash || pin.mode === 'change';
    if (setting) {
      if (pin.first == null) { pin.first = pin.buf; pin.buf = ''; return rerender(); }
      if (pin.first !== pin.buf) { pin.first = null; pin.buf = ''; pin.error = 'Die beiden PINs waren verschieden. Bitte nochmals.'; return rerender(); }
      App.saveSettings({ pinHash: hashPin(pin.buf) });
      pin.first = null; pin.buf = ''; pin.mode = null;
      App.ui.parentOk = true; if (App.device.role !== 'kind') setSessionOk(true);
      App.toast('PIN gespeichert');
      return rerender();
    }
    if (hashPin(pin.buf) === s.pinHash) {
      pin.buf = ''; App.ui.parentOk = true; if (App.device.role !== 'kind') setSessionOk(true);
      return rerender();
    }
    pin.buf = ''; pin.error = 'Falscher PIN.'; rerender();
  };
  A['pin-back'] = () => { pin.buf = pin.buf.slice(0, -1); rerender(); };
  A['pin-change'] = () => { pin.mode = 'change'; pin.first = null; pin.buf = ''; rerender(); };
  A.tab = (d) => { App.ui.eltTab = d.tab; App.ui.confirmDel = null; rerender(); const sc = document.querySelector('.scroll'); if (sc) sc.scrollTop = 0; };

  A['set-num'] = (d) => {
    const s = App.st.settings;
    const v = Math.min(+d.max, Math.max(+d.min, (s[d.key] || 0) + (+d.dir) * (+d.step)));
    App.saveSettings({ [d.key]: v }); rerender();
  };
  A['set-val'] = (d) => { App.saveSettings({ [d.key]: d.val }); rerender(); };
  A['bett-mode'] = () => {
    const s = App.st.settings, today = App.st.today;
    const next = E.currentBettMode(s) === 'ohneXP' ? 'xp' : 'ohneXP';
    const modes = (s.bettModes || []).filter((m) => m.from !== today).concat([{ from: today, mode: next }]);
    App.saveSettings({ bettModes: modes });
    App.toast(next === 'ohneXP' ? 'Ab heute: Bett-Held ohne XP' : 'Ab heute: Morgen-Quest mit XP');
    rerender();
  };
  A['set-bool'] = (d) => { App.saveSettings({ [d.key]: !App.st.settings[d.key] }); rerender(); };
  A.color = (d) => { App.saveSettings({ heroColor: d.val }); rerender(); };
  A.autofair = () => { const a = E.autoFair(App.st.settings); App.saveSettings(a); App.toast('Ziel-Level ' + a.goalLevel + ', Boss ' + a.bossHp + ' LP'); rerender(); };

  const updQ = (id, patch) => App.saveSettings({ quests: App.st.settings.quests.map((q) => (q.id === id ? Object.assign({}, q, patch) : q)) });
  A['q-num'] = (d) => {
    const q = App.st.settings.quests.find((x) => x.id === d.id);
    updQ(d.id, { [d.key]: Math.min(+d.max, Math.max(+d.min, q[d.key] + (+d.dir) * (+d.step))) }); rerender();
  };
  A['q-toggle'] = (d) => { const q = App.st.settings.quests.find((x) => x.id === d.id); updQ(d.id, { active: !q.active }); rerender(); };
  A['q-daily'] = (d) => { updQ(d.key, { daily: d.val === '1' }); rerender(); };
  A['q-add'] = () => {
    const id = 'c_' + E.uid().slice(0, 8);
    App.saveSettings({ quests: App.st.settings.quests.concat([{ id, name: 'Neue Quest', pts: 10, times: 1, daily: true, active: true, kind: 'counter', icon: 'star', hint: '' }]) });
    rerender();
  };
  A['q-del'] = (d) => { App.saveSettings({ quests: App.st.settings.quests.filter((q) => q.id !== d.id) }); rerender(); };

  const updR = (id, patch) => App.saveSettings({ rewards: App.st.settings.rewards.map((r) => (r.id === id ? Object.assign({}, r, patch) : r)) });
  A['r-num'] = (d) => { const r = App.st.settings.rewards.find((x) => x.id === d.id); updR(d.id, { level: Math.min(+d.max, Math.max(+d.min, r.level + (+d.dir))) }); rerender(); };
  A['r-del'] = (d) => { App.saveSettings({ rewards: App.st.settings.rewards.filter((r) => r.id !== d.id) }); rerender(); };
  A['r-add'] = () => {
    const max = App.st.settings.rewards.reduce((m, r) => Math.max(m, r.level), 0);
    App.saveSettings({ rewards: App.st.settings.rewards.concat([{ id: 'r_' + E.uid().slice(0, 8), level: max + 3, what: '' }]) });
    rerender();
  };
  A.claim = (d) => { App.addEvent({ type: 'reward', rewardId: d.id }, { quiet: true }); App.toast('Als eingelöst markiert'); rerender(); };

  A['tr-set'] = (d) => {
    const tr = Object.assign({}, App.st.settings.training, { [d.key]: d.val });
    if (d.key === 'check') tr.checkDate = App.st.today;
    App.saveSettings({ training: tr }); rerender();
  };

  A['cal-month'] = (d) => {
    const y = +App.ui.calMonth.slice(0, 4), m = +App.ui.calMonth.slice(5, 7) + (+d.dir);
    const dt = new Date(y, m - 1, 1);
    App.ui.calMonth = dt.getFullYear() + '-' + pad2(dt.getMonth() + 1);
    rerender();
  };
  A['cal-day'] = (d) => { if (!inRange(d.d)) return; App.ui.calDay = d.d; App.ui.confirmDel = null; App.ui.calScroll = true; rerender(); };
  const dayTs = (day, h) => {
    if (day === App.st.today) return App.now().toISOString();
    const t = E.parseDay(day); t.setHours(h, 0, 0, 0); return t.toISOString();
  };
  A['cal-night'] = (d) => {
    const day = App.ui.calDay;
    App.data.events.filter((e) => e.day === day && e.type === 'night').forEach((e) => App.deleteEvent(e.id));
    if (d.val !== 'none') {
      const t = E.parseDay(day); t.setHours(7, 0, 0, 0);
      App.addEvent({ type: 'night', dry: d.val === 'dry', day, ts: t.toISOString() }, { quiet: true });
    }
    rerender();
  };
  A['cal-add'] = (d) => {
    const day = App.ui.calDay;
    const q = d.q === 'bett' ? { id: 'bett', name: 'Bett-Held', times: 1 } : App.st.settings.quests.find((x) => x.id === d.q);
    if (!q) return;
    const isBed = q.id === 'bett' || q.id === 'morgen';
    const n = App.data.events.filter((e) => e.type === 'quest' && e.day === day && (isBed ? (e.questId === 'bett' || e.questId === 'morgen') : e.questId === q.id)).length;
    if (n >= q.times) { App.toast(q.name + ' ist an diesem Tag schon ' + q.times + '× eingetragen'); return; }
    const before = App.st.dayPts[day] || 0;
    App.addEvent({ type: 'quest', questId: q.id, day, ts: dayTs(day, 18), meta: { nachgetragen: true } }, { quiet: true });
    App.toast(q.name + ' eingetragen · +' + ((App.st.dayPts[day] || 0) - before) + ' ' + App.st.unit);
    rerender();
  };
  A['cal-note-save'] = () => {
    const day = App.ui.calDay;
    const text = (document.getElementById('cal-note').value || '').trim();
    App.data.events.filter((e) => e.day === day && e.type === 'note').forEach((e) => App.deleteEvent(e.id));
    if (text) App.addEvent({ type: 'note', text, day, ts: dayTs(day, 12) }, { quiet: true });
    App.toast(text ? 'Notiz gespeichert' : 'Notiz entfernt');
    rerender();
  };
  A.del = (d) => { App.ui.confirmDel = d.id; rerender(); };
  A['del-yes'] = (d) => { App.deleteEvent(d.id); App.ui.confirmDel = null; App.toast('Eintrag gelöscht'); rerender(); };

  A['set-role'] = (d) => {
    if (App.store.kind === 'supabase' && App.store.role() === 'eltern' && d.val === 'kind') return;
    App.saveDevice({ role: d.val });
    if (d.val === 'kind') setSessionOk(false);
    rerender();
  };
  A.demo = (d) => Pa.setDemo(d.on === '1');
  A['sync-now'] = async () => { App.toast('Abgleich läuft …'); const ok = await App.store.sync(); App.toast(ok ? 'Abgeglichen' : 'Gerade keine Verbindung'); App.load(); rerender(); };
  A['show-codes'] = async () => { try { App.ui.codes = await App.store.codes(); } catch (e) { App.toast('Codes konnten nicht geladen werden'); } rerender(); };
  A['show-members'] = async () => { try { App.ui.members = await App.store.members(); } catch (e) { App.toast('Geräte konnten nicht geladen werden'); } rerender(); };
  A['member-del'] = (d) => { App.ui.confirmMember = d.id; rerender(); };
  A['member-del-yes'] = async (d) => {
    App.ui.confirmMember = null;
    try { await App.store.removeMember(d.id); App.ui.members = await App.store.members(); App.toast('Gerät getrennt'); } catch (e) { App.toast('Das hat nicht geklappt'); }
    rerender();
  };
  A.leave = () => { App.ui.confirmLeave = true; rerender(); };
  A['leave-no'] = () => { App.ui.confirmLeave = false; rerender(); };
  A['leave-yes'] = () => {
    App.ui.confirmLeave = false; App.ui.codes = null; App.ui.members = null; App.ui.parentOk = false;
    App.store.leave(); App.saveDevice({ role: null }); App.ui.setup = { step: 'choose' }; App.load(); App.go('start');
  };
  A['copy-exp'] = () => {
    const ta = document.getElementById('exp');
    const done = () => App.toast('Kopiert');
    try { navigator.clipboard.writeText(ta.value).then(done).catch(() => { ta.select(); App.toast('Text ist markiert: jetzt kopieren'); }); }
    catch (e) { ta.select(); App.toast('Text ist markiert: jetzt kopieren'); }
  };
  A.imp = () => { App.ui.confirmImport = true; App.ui.importText = document.getElementById('imp').value; rerender(); const t = document.getElementById('imp'); if (t) t.value = App.ui.importText || ''; };
  A['imp-yes'] = () => {
    const txt = (document.getElementById('imp').value || App.ui.importText || '').trim();
    App.ui.confirmImport = false;
    try { App.store.importAll(JSON.parse(txt)); App.load(); App.toast('Sicherung eingespielt'); }
    catch (e) { App.toast(e.message && e.message.indexOf('Trocken') >= 0 ? e.message : 'Das konnte nicht gelesen werden. Bitte die ganze Sicherung einfügen.'); }
    rerender();
  };
  A.reset = () => { App.ui.confirmReset = true; rerender(); };
  A['reset-no'] = () => { App.ui.confirmReset = false; rerender(); };
  A['reset-yes'] = () => { App.store.reset(); App.ui.confirmReset = false; App.load(); App.toast('Zurückgesetzt'); rerender(); };

  // Texteingaben: speichern beim Verlassen des Feldes
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.bind) {
      let v = t.value;
      if (t.dataset.bind === 'heroName') v = v.trim() || 'Lilo';
      if (t.dataset.bind === 'startDate' && !v) return;
      if ((t.dataset.bind === 'sleepFrom' || t.dataset.bind === 'sleepTo') && !/^\d{2}:\d{2}$/.test(v)) return;
      App.saveSettings({ [t.dataset.bind]: v }); rerender();
    } else if (t.dataset.qname) {
      updQ(t.dataset.qname, { name: t.value.trim() || 'Quest' }); rerender();
    } else if (t.dataset.rtext) {
      updR(t.dataset.rtext, { what: t.value }); rerender();
    } else if (t.dataset.trnote) {
      App.saveSettings({ training: Object.assign({}, App.st.settings.training, { checkNote: t.value }) });
    }
  });
})();
