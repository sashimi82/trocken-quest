const assert = require('assert');
const E = require('../src/engine.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok', name); }

const S = (o) => Object.assign(E.withDefaults(null), { startDate: '2026-11-09' }, o || {});
const at = (day, h, m) => { const d = E.parseDay(day); d.setHours(h, m || 0, 0, 0); return d; };
let c = 0;
const ev = (day, h, o) => Object.assign({ id: 'x' + (c++), day, ts: at(day, h).toISOString() }, o);
const q = (day, h, questId) => ev(day, h, { type: 'quest', questId });
const fullDay = (d) => [q(d, 8, 'trinken'), q(d, 10, 'trinken'), q(d, 12, 'trinken'), q(d, 15, 'trinken'),
  q(d, 9, 'scan'), q(d, 13, 'scan'), q(d, 17, 'scan'), q(d, 16, 'training'), q(d, 20, 'abend')];

t('voller Tag = 80 XP (mit Morgen-Quest), Tagesgrenze 3 Uhr', () => {
  assert.strictEqual(E.dailyPossible(S()), 80);
  assert.strictEqual(E.dayKey(at('2026-11-10', 2)), '2026-11-09');
  assert.strictEqual(E.dayKey(at('2026-11-10', 4)), '2026-11-10');
  const st = E.compute(S(), fullDay('2026-11-09'), at('2026-11-09', 21));
  assert.strictEqual(st.xp, 70);
  assert.strictEqual(st.level, 1);
});

t('Level-Kurve 100 / +10 %', () => {
  const s = S();
  assert.strictEqual(E.cumTo(2, s), 100);
  assert.strictEqual(E.cumTo(3, s), 210);
  assert.strictEqual(E.levelFor(209, s).level, 2);
  assert.strictEqual(E.levelFor(210, s).level, 3);
  assert.deepStrictEqual(E.heroStages(15), [5, 10, 15]);
});

t('mehr als "times" pro Tag zählt nicht', () => {
  const evs = [1, 2, 3, 4, 5, 6].map((h) => q('2026-11-09', 8 + h, 'trinken'));
  const st = E.compute(S(), evs, at('2026-11-09', 21));
  assert.strictEqual(st.xp, 20);
});

t('nasse Nacht nimmt nichts weg, trockene gibt keine Punkte', () => {
  const base = fullDay('2026-11-09');
  const a = E.compute(S(), base, at('2026-11-09', 21));
  const b = E.compute(S(), base.concat([ev('2026-11-09', 7, { type: 'night', dry: false })]), at('2026-11-09', 21));
  const d = E.compute(S(), base.concat([ev('2026-11-09', 7, { type: 'night', dry: true })]), at('2026-11-09', 21));
  assert.strictEqual(a.xp, b.xp); assert.strictEqual(a.xp, d.xp);
  assert.strictEqual(a.boss.dmg, b.boss.dmg);
  assert.strictEqual(d.dryTotal, 1);
});

t('Comeback-Bonus: erste Quest nach verpasstem Tag doppelt', () => {
  const evs = fullDay('2026-11-09').concat([q('2026-11-11', 8, 'trinken'), q('2026-11-11', 9, 'trinken')]);
  const st = E.compute(S(), evs, at('2026-11-11', 21));
  assert.strictEqual(st.xp, 70 + 10 + 5);
  const off = E.compute(S({ comeback: false }), evs, at('2026-11-11', 21));
  assert.strictEqual(off.xp, 80);
  const pend = E.compute(S(), fullDay('2026-11-09'), at('2026-11-11', 8));
  assert.ok(pend.comebackPending);
});

t('Serie, Schutzschild nach 7 Tagen', () => {
  let evs = [];
  for (let i = 0; i < 7; i++) evs = evs.concat(fullDay(E.addDays('2026-11-09', i)));
  evs = evs.concat(fullDay('2026-11-17')); // 16.11. verpasst, Schild fängt ab
  const st = E.compute(S(), evs, at('2026-11-17', 21));
  assert.strictEqual(st.streak, 8);
  assert.strictEqual(st.shields, 0);
  assert.deepStrictEqual(st.shieldUsed, ['2026-11-16']);
});

t('heute offen bricht Serie nicht', () => {
  const st = E.compute(S(), fullDay('2026-11-09'), at('2026-11-10', 9));
  assert.strictEqual(st.streak, 1);
});

t('Material liegt zuerst auf der Insel, Einsammeln, Werkbank, Bauen', () => {
  let evs = [];
  for (let i = 0; i < 2; i++) evs = evs.concat(fullDay(E.addDays('2026-11-09', i)));
  let st = E.compute(S(), evs, at('2026-11-10', 21));
  assert.strictEqual(st.recipeState.stuetzbogen, 'gesperrt');
  const early = E.compute(S(), evs.concat([ev('2026-11-10', 21, { type: 'collect', res: 'stein', n: 10 }), ev('2026-11-10', 21, { type: 'craft', recipe: 'stuetzbogen' })]), at('2026-11-10', 22));
  assert.ok(!early.items.stuetzbogen);
  assert.strictEqual(st.holz, 0);
  assert.strictEqual(st.field.holz, 18);
  assert.strictEqual(st.field.stein, 10); // 3 Scans + Training + Abend pro Tag
  assert.strictEqual(st.nextBuild.id, 'leiter');
  assert.ok(!st.nextBuild.can);
  // Werkbank ohne Vorrat geht nicht
  const tooEarly = E.compute(S(), evs.concat([ev('2026-11-10', 21, { type: 'craft', recipe: 'leiter' })]), at('2026-11-10', 22));
  assert.ok(!tooEarly.items.leiter);
  evs = evs.concat(fullDay('2026-11-11'));
  evs.push(ev('2026-11-11', 21, { type: 'collect', res: 'holz', n: 99 }));
  evs.push(ev('2026-11-11', 21, { type: 'collect', res: 'stein', n: 4 }));
  st = E.compute(S(), evs, at('2026-11-11', 21));
  assert.strictEqual(st.holz, 27); assert.strictEqual(st.field.holz, 0);
  assert.strictEqual(st.stein, 4); assert.strictEqual(st.field.stein, 11);
  evs.push(ev('2026-11-11', 22, { type: 'craft', recipe: 'leiter' }));
  st = E.compute(S(), evs, at('2026-11-11', 22));
  assert.strictEqual(st.items.leiter, 1);
  assert.strictEqual(st.holz, 6);
  assert.ok(st.nextBuild.crafted);
  evs.push(ev('2026-11-11', 23, { type: 'build', item: 'leiter' }));
  st = E.compute(S(), evs, at('2026-11-11', 23));
  assert.ok(st.built.leiter);
  assert.strictEqual(st.items.leiter, 0);
  assert.ok(st.helpers.find((h) => h.id === 'kiesel').here);
  assert.strictEqual(st.nextBuild.id, 'hoehle');
  assert.strictEqual(E.RECIPES.find((r) => r.id === 'stuetzbogen').cost.stein, 28);
  // Keine zweite Leiter, kein Stützbogen vor der Leiter
  const dbl = E.compute(S(), evs.concat([ev('2026-11-11', 23, { type: 'craft', recipe: 'leiter' })]), at('2026-11-11', 23));
  assert.ok(!dbl.items.leiter);
  assert.strictEqual(dbl.recipeState.leiter, 'gebaut');
  assert.strictEqual(dbl.recipeState.stuetzbogen, 'offen');
  // ungültiger Bau wird ignoriert
  const bad = E.compute(S(), evs.concat([ev('2026-11-12', 22, { type: 'build', item: 'hoehle' })]), at('2026-11-12', 23));
  assert.ok(!bad.built.hoehle);
});

t('Boss: nur Quests machen Schaden, Helfer-Bonus', () => {
  const st = E.compute(S(), fullDay('2026-11-09'), at('2026-11-09', 21));
  assert.strictEqual(st.boss.dmg, 70 + 9); // 1 Helfer (Moosling) = +1 je Quest
  assert.strictEqual(st.boss.hp, 350);
  let evs = [];
  for (let i = 0; i < 5; i++) evs = evs.concat(fullDay(E.addDays('2026-11-09', i)));
  let w = E.compute(S(), evs, at('2026-11-13', 21));
  assert.ok(!w.boss.defeated, 'erst nach Angriff besiegt');
  assert.strictEqual(w.boss.charge, 350);
  // Angriffe: mehr als die Schlagkraft geht nicht
  evs.push(ev('2026-11-13', 21, { type: 'attack', n: 200 }));
  w = E.compute(S(), evs, at('2026-11-13', 21));
  assert.strictEqual(w.boss.left, 150); assert.strictEqual(w.boss.charge, 150);
  evs.push(ev('2026-11-13', 22, { type: 'attack', n: 999 }));
  w = E.compute(S(), evs, at('2026-11-13', 22));
  assert.ok(w.boss.defeated);
  assert.strictEqual(w.wins.length, 1);
  assert.strictEqual(w.kristall, 1);
  assert.strictEqual(w.collection.find((c) => c.id === 'sturmfeder').count, 1);
});

t('Boss: nicht eingesetzte Schlagkraft siegt automatisch am Sonntag', () => {
  let evs = [];
  for (let i = 0; i < 5; i++) evs = evs.concat(fullDay(E.addDays('2026-11-09', i)));
  const sun = E.compute(S(), evs, at('2026-11-15', 21));
  assert.ok(!sun.boss.defeated);
  const mon = E.compute(S(), evs, at('2026-11-16', 9));
  assert.strictEqual(mon.wins.length, 1);
  assert.strictEqual(mon.wins[0].day, '2026-11-15');
  assert.strictEqual(mon.boss.dealt, 0); // neue Woche, neuer Boss
});

t('Kristallinsel nur mit geholtem Schlüssel, Brücke aus Holz, Finale mit Himmelskrone', () => {
  const s = S({ goalLevel: 6 }); // Stufen 2, 4, 6
  const evs = [];
  for (let i = 0; i < 12; i++) fullDay(E.addDays('2026-11-09', i)).forEach((e) => evs.push(e));
  const add = (day, h, o) => { const e = ev(day, h, o); evs.push(e); return e; };
  add('2026-11-11', 22, { type: 'build', item: 'leiter' });
  add('2026-11-13', 22, { type: 'build', item: 'hoehle' });
  let st = E.compute(s, evs, at('2026-11-16', 23));
  assert.ok(st.built.hoehle, JSON.stringify(st.nextBuild));
  assert.ok(st.keyFound && !st.keyHave);
  add('2026-11-16', 23, { type: 'build', item: 'kristallinsel' });
  st = E.compute(s, evs, at('2026-11-16', 23));
  assert.ok(!st.built.kristallinsel, 'ohne geholten Schlüssel kein Flug');
  evs.pop();
  add('2026-11-17', 22, { type: 'collect', res: 'schluessel' });
  add('2026-11-17', 22, { type: 'build', item: 'kristallinsel' });
  st = E.compute(s, evs, at('2026-11-17', 23));
  assert.ok(st.built.kristallinsel);
  assert.ok(st.helpers.find((h) => h.id === 'splitti').here);
  assert.strictEqual(st.nextBuild.id, 'bruecke');
  assert.strictEqual(st.recipeState.bruecke, 'offen');
  add('2026-11-18', 22, { type: 'collect', res: 'holz', n: 99 });
  add('2026-11-18', 22, { type: 'craft', recipe: 'bruecke' });
  add('2026-11-18', 23, { type: 'build', item: 'bruecke' });
  st = E.compute(s, evs, at('2026-11-18', 23));
  assert.ok(st.built.bruecke);
  assert.strictEqual(st.nextBuild.id, 'himmelsinsel');
  add('2026-11-20', 22, { type: 'build', item: 'himmelsinsel' });
  st = E.compute(s, evs, at('2026-11-20', 23));
  assert.ok(st.built.himmelsinsel, 'Level ' + st.level);
  assert.ok(st.helpers.find((h) => h.id === 'wispel').here);
  assert.strictEqual(st.collection.find((c) => c.id === 'himmelskrone').count, 1);
  assert.strictEqual(st.nextBuild, null);
});

t('Boss-Leben in angebrochener erster Woche anteilig', () => {
  const st = E.compute(S({ startDate: '2026-11-12' }), [], at('2026-11-12', 9));
  assert.strictEqual(st.boss.hp, 200); // 4 von 7 Tagen
});

t('Fairness: Standard ist fair, Training mit 6 Tagen gerechnet', () => {
  const f = E.fairness(S());
  assert.strictEqual(E.weeklyPossible(S()), 540);
  assert.strictEqual(f.status, 'fair');
  assert.strictEqual(Math.round(f.q * 100), 65);
  const a = E.autoFair(S());
  assert.ok(E.cumTo(a.goalLevel, S()) <= 0.7 * 540 * 8);
  assert.strictEqual(a.bossHp, 380);
  // Bett-Held ohne XP: Morgen-Quest zählt nicht mehr in die Fairness
  assert.strictEqual(E.weeklyPossible(S({ bettModes: [{ from: '0000-00-00', mode: 'ohneXP' }] })), 470);
});

t('Training: Freischaltung ab Woche 3, Wochenplan', () => {
  const physio = { bloecke: [{ id: 'A', freigeschaltet_ab_woche: 1 }, { id: 'C', freigeschaltet_ab_woche: 3 }],
    wochenplan: { ab_woche_3: [{ nachmittag: 'C', abend: 'B1' }, { nachmittag: 'D', abend: 'B3' }, {}, {}, {}, {}, { nachmittag: null, abend: 'B1 (freiwillig)' }] } };
  let p = E.trainingPlan(S(), '2026-11-10', physio);
  assert.strictEqual(p.week, 1); assert.ok(p.unlocked.A); assert.ok(!p.unlocked.C);
  assert.strictEqual(p.afternoon, 'B'); assert.strictEqual(p.evening, 'B1');
  p = E.trainingPlan(S(), '2026-11-24', physio);
  assert.strictEqual(p.week, 3); assert.ok(p.unlocked.C); assert.strictEqual(p.afternoon, 'D'); assert.strictEqual(p.evening, 'B3');
  p = E.trainingPlan(S({ training: { unlock: 'alle' } }), '2026-11-10', physio);
  assert.ok(p.unlocked.C);
});

t('Demo-Daten erzeugen einen plausiblen Stand', () => {
  const d = E.makeDemo(null, at('2026-12-05', 9), 26);
  const st = E.compute(d.settings, d.events, at('2026-12-05', 9));
  assert.ok(st.level >= 5, 'level ' + st.level);
  assert.ok(st.built.leiter && st.built.hoehle, JSON.stringify(st.built));
  console.log('   Demo: Level', st.level, 'XP', st.xp, 'gebaut', Object.keys(st.built).join(','), 'Siege', st.wins.length, 'Serie', st.streak);
});

t('Start am Sonntag: kein Boss in der Rumpfwoche, Helfer bleibt Stufe 1', () => {
  const s = S({ startDate: '2026-11-08' });
  const st = E.compute(s, fullDay('2026-11-08'), at('2026-11-08', 21));
  assert.ok(st.boss.waiting);
  assert.strictEqual(st.boss.dmg, 0);
  assert.strictEqual(st.wins.length, 0);
  assert.strictEqual(st.helpers[0].stage, 1);
  assert.strictEqual(st.xp, 70);
});

t('Helfer Stufe 3 erst nach 7er-Serie und danach Boss-Sieg', () => {
  let evs = [];
  for (let i = 0; i < 14; i++) evs = evs.concat(fullDay(E.addDays('2026-11-09', i)));
  const st = E.compute(S(), evs, at('2026-11-22', 21));
  const m = st.helpers.find((h) => h.id === 'moosling');
  assert.strictEqual(m.stage, 3); // Serie am 15.11., Boss-Sieg in Woche 2
  const st1 = E.compute(S(), evs.filter((e) => e.day <= '2026-11-14'), at('2026-11-14', 21));
  assert.strictEqual(st1.helpers[0].stage, 1); // Boss-Sieg Woche 1, aber noch keine 7er-Serie
});

t('Demo-Start: 3 volle Tage', () => {
  const now = at('2026-11-09', 9);
  const d = E.makeStart(null, now, 3);
  const st = E.compute(d.settings, d.events, now);
  assert.strictEqual(d.settings.startDate, '2026-11-06');
  assert.strictEqual(st.dayPts['2026-11-06'] >= 70, true);
  assert.strictEqual(st.streak, 3);
  assert.strictEqual(st.nightsLogged, 3);
  assert.ok(st.holz + st.field.holz >= 27 && st.stein + st.field.stein === 15, st.holz + '/' + st.stein);
  assert.ok(st.field.holz > 0 && st.holz > 0, 'ein Teil liegt noch auf der Insel');
  assert.strictEqual(st.nextBuild.id, 'leiter');
  // heute voll erledigen -> Leiter baubar
  const ev2 = d.events.concat(E.fullDayEvents(d.settings, '2026-11-09', d.events, { night: false }));
  const st2 = E.compute(d.settings, ev2, at('2026-11-09', 21));
  assert.ok(st2.nextBuild.can, JSON.stringify(st2.nextBuild.reqs));
  // zweimal auffüllen erzeugt nichts doppelt
  assert.strictEqual(E.fullDayEvents(d.settings, '2026-11-09', ev2, { night: false }).length, 0);
});

t('Morgen-Quest: 10 XP nach jeder eingetragenen Nacht, Schalter ab Datum', () => {
  const d = '2026-11-09';
  const none = E.compute(S(), [q(d, 8, 'morgen')], at(d, 9));
  assert.strictEqual(none.xp, 0);
  assert.ok(none.questsToday.find((x) => x.id === 'morgen').needsNight);
  const dry = E.compute(S(), [ev(d, 7, { type: 'night', dry: true }), q(d, 8, 'morgen')], at(d, 9));
  const wet = E.compute(S(), [ev(d, 7, { type: 'night', dry: false }), q(d, 8, 'morgen')], at(d, 9));
  assert.strictEqual(dry.xp, 10); assert.strictEqual(wet.xp, 10);
  assert.strictEqual(wet.questsToday.find((x) => x.id === 'morgen').variant, 'wet');
  assert.strictEqual(wet.bettHeldCount, 1); assert.strictEqual(dry.bettHeldCount, 0);
  // alte Bett-Held-Einträge aus Version 2 zählen als Morgen-Quest
  const legacy = E.compute(S(), [ev(d, 7, { type: 'night', dry: false }), q(d, 8, 'bett')], at(d, 9));
  assert.strictEqual(legacy.xp, 10);
  // Schalter «ohne XP» ab 10.11.: am 9.11. gibt es weiter XP, am 10.11. nicht
  const sw = S({ bettModes: [{ from: '0000-00-00', mode: 'xp' }, { from: '2026-11-10', mode: 'ohneXP' }] });
  const evs = [ev(d, 7, { type: 'night', dry: false }), q(d, 8, 'morgen'), ev('2026-11-10', 7, { type: 'night', dry: false }), q('2026-11-10', 8, 'morgen')];
  const st = E.compute(sw, evs, at('2026-11-10', 9));
  assert.strictEqual(st.xp, 10);
  assert.strictEqual(st.bettHeldCount, 2);
  assert.ok(!st.questsToday.find((x) => x.id === 'morgen'));
  assert.strictEqual(st.bettMode, 'ohneXP');
});

t('Truhen und Schlüssel liegen in der Höhle, bis man sie holt', () => {
  let evs = [];
  for (let i = 0; i < 3; i++) evs = evs.concat(fullDay(E.addDays('2026-11-09', i)));
  evs.push(ev('2026-11-11', 21, { type: 'build', item: 'leiter' }));
  const s = S({ goalLevel: 3 }); // Höhlenforscher früh
  for (let i = 3; i < 5; i++) evs = evs.concat(fullDay(E.addDays('2026-11-09', i)));
  evs.push(ev('2026-11-13', 21, { type: 'build', item: 'hoehle' }));
  for (let i = 5; i < 7; i++) evs = evs.concat(fullDay(E.addDays('2026-11-09', i)));
  let st = E.compute(s, evs, at('2026-11-15', 21));
  assert.ok(st.built.hoehle, JSON.stringify(st.nextBuild && st.nextBuild.reqs));
  assert.ok(st.field.key && !st.keyHave);
  assert.strictEqual(st.field.chests, 1);
  const before = st.holz;
  evs.push(ev('2026-11-15', 22, { type: 'collect', res: 'truhe' }), ev('2026-11-15', 22, { type: 'collect', res: 'schluessel' }));
  st = E.compute(s, evs, at('2026-11-15', 23));
  assert.strictEqual(st.field.chests, 0); assert.strictEqual(st.holz, before + 5); assert.ok(st.keyHave);
});

t('Heute erledigen: keine Zeiten in der Zukunft, Bauen danach möglich', () => {
  const now = at('2026-11-09', 9);
  const d = E.makeStart(null, now, 3);
  const fill = E.fullDayEvents(d.settings, '2026-11-09', d.events, { night: false, now });
  assert.ok(fill.every((e) => new Date(e.ts) <= now));
  const evs = d.events.concat(fill, [ev('2026-11-09', 9, { type: 'build', item: 'leiter' })]);
  evs[evs.length - 1].ts = now.toISOString();
  const st = E.compute(d.settings, evs, now);
  assert.ok(st.built.leiter);
});

console.log(n + ' Tests bestanden');
