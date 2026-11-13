/* Trocken-Quest – Trainingsmodul (Inhalte aus physio-uebungen.json) */
(function () {
  'use strict';
  const App = window.TQ, E = window.Engine, P = window.PHYSIO;
  const esc = App.esc, icon = App.icon;
  const T = {};
  window.TQTraining = T;

  const exById = (id) => P.uebungen.find((u) => u.id === id);
  const blockById = (id) => P.bloecke.find((b) => b.id === id);
  const exOf = (bid) => P.uebungen.filter((u) => u.block === bid);
  const favs = () => (App.data.prefs.favs || []);
  const materials = (bid) => Array.from(new Set(exOf(bid).reduce((a, u) => a.concat(u.material), [])));

  function rulesHtml() {
    return '<ul class="rules">' + P.grundregeln.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ul>';
  }

  function intro() {
    const a1 = exById('A1');
    return '<div class="stack"><div class="h1">Training</div>' +
      '<p>5 Minuten am Tag für deinen Beckenboden. Das ist der Muskel, der die «Tür» der Blase zuhält und zum Pinkeln wieder aufmacht.</p>' +
      '<div class="illu">' + a1.bild_svg + '</div>' +
      '<div class="banner violet"><span style="width:14px;height:14px;background:var(--pelvic);flex-shrink:0;margin-top:3px"></span><div class="small">Der blaue Punkt in jedem Bild zeigt, wo der Beckenboden liegt.</div></div>' +
      '<div class="sec-h">Die Regeln</div><section class="blk">' + rulesHtml() + '</section>' +
      '<button class="btn gold block" data-act="tr-intro">Verstanden, los geht\'s</button></div>';
  }

  function blockCard(b, plan) {
    const open = App.ui.openBlock === b.id;
    const unlocked = plan.unlocked[b.id];
    const rec = plan.afternoon === b.id;
    let h = '<section class="blk' + (rec && unlocked ? ' hi' : '') + ' stack"><div class="block-card' + (unlocked ? '' : ' locked') + '">' +
      '<div class="block-letter" aria-hidden="true">' + b.id + '</div>' +
      '<div class="grow"><div class="h3">' + esc(b.name) + '</div><div class="tiny muted">' + (unlocked ? b.dauer_min + ' Min. · ' + exOf(b.id).length + ' Übungen' + (rec ? ' · heute empfohlen' : '') : 'ab Woche ' + b.freigeschaltet_ab_woche) + '</div></div>' +
      (unlocked ? '<button class="btn sm ghost" data-act="tr-open" data-id="' + b.id + '" aria-expanded="' + open + '">' + (open ? 'zu' : 'mehr') + '</button>' : icon('lock', 18)) + '</div>';
    if (open && unlocked) {
      const mats = materials(b.id);
      h += '<p class="small">' + esc(b.ziel) + '</p>' +
        (mats.length ? '<div class="chips">' + mats.map((m) => '<span class="chip">' + esc(m) + '</span>').join('') + '</div>' : '') +
        '<div class="stack small">' + exOf(b.id).map((u) => '<div class="row between"><span>' + (favs().indexOf(u.id) >= 0 ? '<span style="color:var(--rose)">' + icon('heart', 14) + '</span> ' : '') + esc(u.name) + '</span><span class="muted num">' + u.dauer_min + ' Min.</span></div>').join('') + '</div>' +
        '<button class="btn teal block" data-act="tr-start" data-id="' + b.id + '">' + icon('play', 18) + ' Block ' + b.id + ' starten</button>';
    }
    return h + '</section>';
  }

  T.view = function () {
    if (!App.data.prefs.trainingIntro) return intro();
    const st = App.st, plan = App.plan;
    const tq = st.questsToday.find((q) => q.kind === 'training');
    let h = '<div class="stack"><div class="row between"><div class="h1">Training</div><span class="tag lock">Woche ' + plan.week + '</span></div>';
    if (tq && tq.complete) h += '<div class="banner teal">' + icon('check', 20) + '<div class="small">Training für heute erledigt. Extra üben ist erlaubt, gibt aber keine weiteren Punkte.</div></div>';
    else if (!tq) h += '<div class="banner">' + icon('lock', 20) + '<div class="small">Die Trainings-Quest ist gerade ausgeschaltet. Üben geht trotzdem.</div></div>';
    if (plan.sunday && !plan.afternoon) {
      h += '<div class="banner violet">' + icon('moon', 20) + '<div class="small">Sonntag ist Ruhetag. Wenn du magst, darfst du trotzdem einen Block machen.</div></div>';
    } else if (plan.afternoon && plan.unlocked[plan.afternoon]) {
      const b = blockById(plan.afternoon);
      h += '<section class="blk gold stack"><div class="tiny muted">Heute empfohlen</div><div class="h2">Block ' + b.id + ': ' + esc(b.name) + '</div>' +
        '<p class="small muted">' + esc(b.ziel) + '</p>' +
        '<button class="btn gold block" data-act="tr-start" data-id="' + b.id + '">' + icon('play', 18) + ' Starten' + (tq && !tq.complete ? ' · +' + tq.nextPts + ' ' + st.unit : '') + '</button>' +
        '<p class="tiny dim">Du darfst auch einen anderen Block wählen.</p></section>';
    }
    const ev = exById(App.plan.evening);
    if (ev) h += '<div class="banner teal">' + icon('moon', 20) + '<div class="small">Heute Abend im Bett: <b>' + esc(ev.name) + '</b>. Das gehört zur Abendroutine.</div></div>';
    h += '<div class="sec-h">Alle Blöcke</div>';
    P.bloecke.forEach((b) => { h += blockCard(b, plan); });
    const f = favs().map(exById).filter(Boolean);
    h += '<div class="sec-h">Deine Lieblingsübungen</div>';
    h += f.length ? '<section class="blk stack small">' + f.map((u) => '<div class="row between"><span>' + esc(u.name) + '</span><button class="btn sm ghost" data-act="tr-single" data-ex="' + u.id + '">' + icon('play', 14) + ' üben</button></div>').join('') + '</section>'
      : '<p class="small muted">Tippe beim Üben auf das Herz, dann landet die Übung hier.</p>';
    h += '<button class="btn ghost block" data-act="tr-rules">Regeln nochmals ansehen</button></div>';
    return h;
  };

  /* ---------- Player ---------- */
  // Mindestzeit pro Übung: In der echten Version 60 Sekunden, in der Demo keine
  const MIN_SEC = 60;
  T.minSec = () => (App.device.demo ? 0 : MIN_SEC);
  function spent(p) { return ((p.spent[p.i] || 0) + (Date.now() - p.enter)) / 1000; }
  function waitLeft(p) { return Math.max(0, Math.ceil(T.minSec() - spent(p))); }
  const mmss = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  T.startBlock = function (bid) {
    const list = exOf(bid).map((u) => u.id);
    App.ui.player = { mode: 'block', block: bid, list, i: 0, left: exById(list[0]).dauer_min * 60, running: false, finished: false, enter: Date.now(), spent: {} };
    App.renderOverlays();
  };
  T.startSingle = function (exId) {
    const u = exById(exId);
    App.ui.player = { mode: App.ui.sheet && App.ui.sheet.kind === 'abend' ? 'abend' : 'single', block: u.block, list: [exId], i: 0, left: u.dauer_min * 60, running: false, finished: false, enter: Date.now(), spent: {} };
    App.renderOverlays();
  };

  function ring(left, total) {
    const C = 2 * Math.PI * 32;
    const off = C * (1 - left / total);
    const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
    return '<svg class="ring" viewBox="0 0 76 76" role="img" aria-label="Noch ' + mm + ' Minuten ' + ss + ' Sekunden"><circle cx="38" cy="38" r="32" fill="none" stroke="#33384D" stroke-width="8"/>' +
      '<circle id="ring-arc" cx="38" cy="38" r="32" fill="none" stroke="#FFD166" stroke-width="8" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 38 38)"/>' +
      '<text id="ring-t" x="38" y="43" text-anchor="middle">' + mm + ':' + ss + '</text></svg>';
  }

  T.playerHtml = function () {
    const p = App.ui.player;
    const close = '<button class="icon-btn" data-act="pl-close" aria-label="Training beenden">' + App.icon('close', 18) + '</button>';
    if (p.finished) {
      const tq = App.st.questsToday.find((q) => q.kind === 'training');
      const b = blockById(p.block);
      return '<div class="full" role="dialog" aria-modal="true" aria-labelledby="pl-t"><div class="full-head">' + close + '<div class="grow"></div></div>' +
        '<div class="full-body" style="align-items:center;text-align:center;justify-content:center">' +
        '<canvas data-card="hero" data-block="grass" data-px="5" style="width:150px;height:150px" aria-hidden="true" id="pl-hero"></canvas>' +
        '<div class="h1" id="pl-t">' + (p.mode === 'block' ? 'Block ' + b.id + ' geschafft!' : 'Übung geschafft!') + '</div>' +
        '<p class="muted">' + (p.mode === 'block' ? (p.awarded ? '+' + p.awarded + ' ' + App.st.unit + ' für dein Training.' : 'Heute schon gezählt. Stark, dass du noch mehr übst!') : 'Gut gemacht.') + '</p>' +
        '</div>' +
        '<div class="full-foot" style="grid-template-columns:1fr"><button class="btn gold" data-act="pl-close">Fertig</button></div></div>';
    }
    const u = exById(p.list[p.i]);
    const b = blockById(u.block);
    const total = u.dauer_min * 60;
    const isFav = favs().indexOf(u.id) >= 0;
    const last = p.i === p.list.length - 1;
    return '<div class="full" role="dialog" aria-modal="true" aria-labelledby="pl-t"><div class="full-head">' + close +
      '<div class="grow"><div class="tiny muted">' + (p.mode === 'block' ? 'Block ' + b.id + ' · Übung ' + (p.i + 1) + ' von ' + p.list.length : p.mode === 'abend' ? 'Abend-Übung' : 'Lieblingsübung') + '</div>' +
      (p.list.length > 1 ? '<div class="progress-dots" aria-hidden="true">' + p.list.map((_, i) => '<i class="' + (i <= p.i ? 'on' : '') + '"></i>').join('') + '</div>' : '') + '</div>' +
      '<button class="heart" data-act="fav" data-ex="' + u.id + '" aria-pressed="' + isFav + '" aria-label="Lieblingsübung">' + App.icon('heart', 20) + '</button></div>' +
      '<div class="full-body" id="pl-body">' +
      (p.i === 0 ? '<div class="banner violet small"><div>Blase vorher leeren. Ruhig weiteratmen, nie pressen.' +
        (App.device.demo ? ' <b>Demo:</b> Du kannst direkt weiterklicken. In der echten Version musst du bei jeder Übung mindestens 1 Minute bleiben.' : ' Bleib bei jeder Übung mindestens 1 Minute.') + '</div></div>' : '') +
      '<div class="illu">' + u.bild_svg + '</div>' +
      '<div class="stack" style="gap:4px"><div class="h1" id="pl-t">' + esc(u.name) + '</div><p class="muted">' + esc(u.kurzanleitung) + '</p></div>' +
      (u.material.length ? '<div class="chips">' + u.material.map((m) => '<span class="chip">' + esc(m) + '</span>').join('') + '</div>' : '') +
      '<ol class="steps">' + u.schritte.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
      (u.hinweis ? '<div class="banner small"><div>' + esc(u.hinweis) + '</div></div>' : '') +
      '<div class="blk timer">' + ring(p.left, total) + '<div class="grow stack" style="gap:6px"><span class="small muted" id="ring-msg">' + (p.left === 0 ? 'Zeit um. Weiter, wenn du so weit bist.' : 'Etwa ' + u.dauer_min + ' Min. Der Timer hilft nur, du bestimmst das Tempo.') + '</span>' +
      '<button class="btn sm ' + (p.running ? '' : 'teal') + '" data-act="pl-timer">' + App.icon(p.running ? 'pause' : 'play', 16) + ' ' + (p.running ? 'Pause' : (p.left < total && p.left > 0 ? 'Weiter' : 'Timer starten')) + '</button></div></div>' +
      '</div><div class="full-foot"><button class="btn" data-act="pl-prev"' + (p.i === 0 ? ' disabled' : '') + '>' + App.icon('back', 18) + ' Zurück</button>' +
      nextBtn(p, last) + '</div></div>';
  };

  function nextBtn(p, last) {
    const w = waitLeft(p);
    const label = last ? 'Fertig' : 'Nächste Übung';
    if (w > 0) return '<button class="btn gold" id="pl-next" data-act="pl-next" aria-disabled="true" style="opacity:.55">' + App.icon('clock', 18) + ' Weiter in ' + mmss(w) + '</button>';
    return '<button class="btn gold" id="pl-next" data-act="pl-next">' + label + ' ' + App.icon('next', 18) + '</button>';
  }
  // Knopf «Weiter» jede Sekunde aktualisieren, bis die Mindestzeit erreicht ist
  let gate = null;
  function startGate() {
    clearInterval(gate); gate = null;
    const p = App.ui.player;
    if (!p || p.finished || waitLeft(p) <= 0) return;
    gate = setInterval(() => {
      const q = App.ui.player;
      const btn = document.getElementById('pl-next');
      if (!q || q.finished || !btn) { clearInterval(gate); gate = null; return; }
      btn.outerHTML = nextBtn(q, q.i === q.list.length - 1);
      if (waitLeft(q) <= 0) { clearInterval(gate); gate = null; }
    }, 1000);
  }
  T.afterPlayer = function () {
    const c = document.getElementById('pl-hero');
    if (c) window.World.drawCard(c, 'hero', { block: 'grass', stage: App.st.stage, color: App.st.settings.heroColor, px: 5 });
    startGate();
  };

  let timer = null, wake = null;
  function stopTimer() {
    clearInterval(timer); timer = null;
    if (App.ui.player) App.ui.player.running = false;
    try { if (wake) { wake.release(); wake = null; } } catch (e) { /* ignore */ }
  }
  function tick() {
    const p = App.ui.player;
    if (!p) return stopTimer();
    p.left = Math.max(0, p.left - 1);
    const u = exById(p.list[p.i]);
    const total = u.dauer_min * 60;
    const C = 2 * Math.PI * 32;
    const arc = document.getElementById('ring-arc'), t = document.getElementById('ring-t');
    if (arc) arc.setAttribute('stroke-dashoffset', (C * (1 - p.left / total)).toFixed(1));
    if (t) t.textContent = Math.floor(p.left / 60) + ':' + String(p.left % 60).padStart(2, '0');
    if (p.left === 0) { stopTimer(); App.renderOverlays(); }
  }

  const A = App.actions;
  A['tr-intro'] = () => { App.savePrefs({ trainingIntro: true }); App.render(); };
  A['tr-rules'] = () => { App.savePrefs({ trainingIntro: false }); App.render(); };
  A['tr-open'] = (d) => { App.ui.openBlock = App.ui.openBlock === d.id ? null : d.id; App.render(); };
  A['tr-start'] = (d) => T.startBlock(d.id);
  A['tr-single'] = (d) => T.startSingle(d.ex);
  A.fav = (d) => {
    const f = favs().slice();
    const i = f.indexOf(d.ex);
    if (i >= 0) f.splice(i, 1); else f.push(d.ex);
    App.savePrefs({ favs: f });
    const btn = document.querySelector('.heart[data-ex="' + d.ex + '"]');
    if (btn) btn.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true');
  };
  A['pl-timer'] = () => {
    const p = App.ui.player;
    if (p.running) { stopTimer(); App.renderOverlays(); return; }
    if (p.left === 0) p.left = exById(p.list[p.i]).dauer_min * 60;
    p.running = true;
    clearInterval(timer);
    timer = setInterval(tick, 1000);
    try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { wake = w; }).catch(() => {}); } catch (e) { /* ignore */ }
    App.renderOverlays();
  };
  function goTo(i) {
    const p = App.ui.player;
    stopTimer();
    p.spent[p.i] = (p.spent[p.i] || 0) + (Date.now() - p.enter);
    p.enter = Date.now();
    p.i = i;
    p.left = exById(p.list[i]).dauer_min * 60;
    App.renderOverlays();
    const body = document.getElementById('pl-body');
    if (body) body.scrollTop = 0;
  }
  A['pl-prev'] = () => { const p = App.ui.player; if (p.i > 0) goTo(p.i - 1); };
  A['pl-next'] = () => {
    const p = App.ui.player;
    const w = waitLeft(p);
    if (w > 0) { App.toast('Bleib noch bei der Übung: ' + mmss(w)); return; }
    if (p.i < p.list.length - 1) return goTo(p.i + 1);
    stopTimer();
    if (p.mode === 'block') {
      const tq = App.st.questsToday.find((q) => q.kind === 'training');
      if (tq && !tq.complete) {
        const before = App.st.xp;
        App.addEvent({ type: 'quest', questId: tq.id, meta: { block: p.block } });
        p.awarded = App.st.xp - before;
      } else {
        App.addEvent({ type: 'training', meta: { block: p.block, extra: true } }, { quiet: true });
      }
      p.finished = true;
      App.renderOverlays();
      App.confetti();
    } else if (p.mode === 'abend') {
      App.ui.player = null;
      if (App.ui.sheet) App.ui.sheet.done.ex = true;
      App.renderOverlays();
    } else {
      p.finished = true;
      App.renderOverlays();
    }
  };
  A['pl-close'] = () => {
    stopTimer();
    App.ui.player = null;
    App.render();
  };
})();
