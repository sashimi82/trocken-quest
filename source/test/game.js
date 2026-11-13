// Spielt die Insel durch: Einsammeln, Werkbank, Leiter, vorspulen, Höhle graben und betreten
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || '/tmp/shots';
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Europe/Zurich', locale: 'de-CH' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../dist/demo.html'));
  await page.waitForTimeout(700);
  const log = [];
  const shot = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, n + '.png') }); };
  const ev = (fn, a) => page.evaluate(fn, a);
  const dismiss = async () => { for (let i = 0; i < 8; i++) { const c = await page.$('[data-act="cel-next"]'); if (!c) break; log.push('Feier: ' + await page.textContent('#cel-t')); await c.click(); await page.waitForTimeout(80); } };
  const click = async (sel) => { await dismiss(); try { await page.click(sel, { timeout: 4000 }); } catch (e) { console.log(log.join('\n')); console.log('KLICK FEHLGESCHLAGEN ' + sel + ' ' + JSON.stringify(await st())); console.log(errors.join('\n')); await page.screenshot({ path: path.join(out, 'zz.png') }); process.exit(1); } await page.waitForTimeout(150); };
  const st = () => ev(() => ({ lvl: TQ.st.level, holz: TQ.st.holz, stein: TQ.st.stein, field: TQ.st.field, items: TQ.st.items, built: Object.keys(TQ.st.built), helpers: TQ.st.helpers.filter((h) => h.here).map((h) => h.id), game: Game.debug() }));
  const waitIdle = async () => { for (let i = 0; i < 80; i++) { const d = await ev(() => Game.debug()); if (!d.lilo.moving && !d.lilo.busy) return; await page.waitForTimeout(100); } };
  const tapTile = async (x, y, dy) => { await ev(([x, y, dy]) => { const p = Game.screenOf(x, y); Game.tapAt(p.x, p.y + (dy || 0) * p.z); }, [x, y, dy]); await page.waitForTimeout(100); await waitIdle(); };
  const tapObj = async (o) => { await ev((o) => { const p = Game.objectPoint(o); Game.tapAt(p.x, p.y); }, o); await page.waitForTimeout(100); await waitIdle(); await page.waitForTimeout(1600); await dismiss(); };
  const collectAll = async () => {
    const spots = { holz: [[4, 3], [3, 4], [5, 3]], stein: [[7, 1], [7, 3], [6, 3]] };
    for (const res of ['holz', 'stein']) for (const [x, y] of spots[res]) await tapTile(x, y, -14);
  };
  await click('.sheet [data-act="sheet-close"]');
  log.push('Start ' + JSON.stringify(await st()));
  await click('[data-act="night"][data-dry="1"]');
  await dismiss();
  await shot('g01-heute');
  await click('[data-act="quest"][data-id="morgen"]');
  await click('.nav [data-v="insel"]');
  await ev(() => Game.setPhase('tag'));
  await page.waitForTimeout(300);
  await shot('g02-insel');
  // Bilder während des Laufens (Grafikfehler suchen)
  await ev(() => { const p = Game.screenOf(10, 8); Game.tapAt(p.x, p.y); });
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(220); await (await page.$('#game')).screenshot({ path: path.join(out, 'walk' + i + '.png') }); }
  await waitIdle();
  await collectAll();
  log.push('Nach Einsammeln ' + JSON.stringify(await st()));
  await shot('g03-eingesammelt');
  // Werkbank über Antippen im Spiel
  await tapObj('werkbank');
  await shot('g04-werkbank');
  await click('[data-act="wb-recipe"][data-id="leiter"]');
  // von Hand: drei Felder legen, dann Muster
  await click('[data-act="wb-slot"][data-i="0"]');
  await click('[data-act="wb-auto"]');
  await shot('g05-raster');
  await click('[data-act="wb-make"]');
  await shot('g06-hergestellt');
  log.push('Nach Werkbank ' + JSON.stringify(await st()));
  await click('.full [data-act="game-go"]');
  await page.waitForTimeout(300); await waitIdle(); await page.waitForTimeout(1300);
  await dismiss();
  log.push('Nach Leiter ' + JSON.stringify(await st()));
  await shot('g07-leiter');
  // Auf den Berg klettern
  log.push('Debug Berg ' + JSON.stringify(await ev(() => ({ links: Game._dbg.links(), path: Game._dbg.findPath(8, 3, 9, 1), hit: (() => { const p = Game.screenOf(9, 1); return Game._dbg.hit(p.x, p.y - 6); })(), c: Game._dbg.col(9, 1) }))));
  await tapTile(9, 1, -6);
  log.push('Auf dem Berg ' + JSON.stringify((await st()).game.lilo));
  await shot('g08-berg');
  // Verschieben (Nahansicht ist Standard), dann Gesamtansicht
  await page.waitForTimeout(300);
  const c0 = (await st()).game.cam;
  const box = await (await page.$('#game')).boundingBox();
  await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + 200 + i * 20, box.y + 200 + i * 10);
  await page.mouse.up();
  await page.waitForTimeout(200);
  log.push('Kamera vor/nach Ziehen ' + JSON.stringify(c0) + ' / ' + JSON.stringify((await st()).game.cam) + ' Lilo ' + JSON.stringify((await st()).game.lilo));
  await shot('g08b-nah');
  await click('[data-act="zoom"]');
  await shot('g08c-ganz');
  await click('[data-act="zoom"]');
  await tapTile(5, 8, -6);
  // Vorspulen
  await click('[data-act="demo-tools"]');
  await click('[data-act="demo-ff"][data-n="7"]');
  await dismiss();
  await click('.nav [data-v="insel"]');
  await ev(() => Game.setPhase('tag'));
  await collectAll();
  log.push('Nach 7 Tagen ' + JSON.stringify(await st()));
  await click('[data-act="panel"][data-kind="werkbank"]');
  await click('[data-act="wb-recipe"][data-id="stuetzbogen"]');
  await click('[data-act="wb-auto"]');
  await click('[data-act="wb-make"]');
  await click('.full [data-act="game-go"]');
  await page.waitForTimeout(300); await waitIdle(); await page.waitForTimeout(1800);
  await dismiss();
  log.push('Nach Höhlengang ' + JSON.stringify(await st()));
  await shot('g09-hoehle-offen');
  // Noch vorspulen, damit Funkel Truhe und Schlüssel findet
  await click('[data-act="demo-tools"]');
  await click('[data-act="demo-ff"][data-n="3"]');
  await dismiss();
  await click('.nav [data-v="insel"]');
  await ev(() => Game.setPhase('tag'));
  await tapObj('hoehle');
  await page.waitForTimeout(500);
  log.push('In der Höhle ' + JSON.stringify(await st()));
  await shot('g10-grotte');
  const ci = await ev(() => ({ field: TQ.st.field }));
  if (ci.field.key) await tapTile(3, 3, -12);
  if (ci.field.chests) await tapTile(2, 2, -12);
  await dismiss();
  await page.waitForTimeout(400);
  await shot('g11-grotte-geholt');
  log.push('Nach Höhlenschätzen ' + JSON.stringify(await st()));
  await click('[data-act="cave-leave"]');
  // Helfer antippen
  await ev(() => { const p = Game.screenOf(10, 0); Game.tapAt(p.x, p.y - 14 * p.z); });
  await page.waitForTimeout(300);
  await shot('g12-tipp');
  // Nacht
  await ev(() => { Game.setPhase('nacht'); TQ.refreshInsel(); });
  await page.waitForTimeout(400);
  await shot('g13-nacht');
  await ev(() => Game.setPhase('abend'));
  await page.waitForTimeout(400);
  await shot('g14-abend');
  await ev(() => Game.setPhase('auto'));
  // Vorratskammer und Werkbank-Sperre
  await click('[data-act="panel"][data-kind="vorrat"]');
  await shot('g15-vorrat');
  await click('.full [data-act="panel"][data-kind="werkbank"]');
  await shot('g15b-werkbank-gesperrt');
  await click('[data-act="panel-close"]');
  // Inselzeit: kurz vor Ablauf
  await ev(() => { TQ.ui.islandDay = TQ.st.today; TQ.ui.islandSec = TQ.st.settings.islandMinutes * 60 - 2; });
  await page.waitForTimeout(3300);
  log.push('Inselzeit gesperrt: ' + JSON.stringify((await st()).game.locked) + ' Anzeige: ' + await page.textContent('#game-time'));
  await shot('g15c-zeit-vorbei');
  await ev(() => TQ.actions['island-reset']());
  // Eltern: Schalter
  await click('[data-act="go"][data-v="eltern"]');
  await click('[data-act="tab"][data-tab="einstellungen"]');
  await ev(() => { document.querySelector('[data-act="bett-mode"]').scrollIntoView(); });
  await click('[data-act="bett-mode"]');
  await shot('g16-schalter');
  log.push('Modus ' + await ev(() => TQ.st.bettMode) + ', Tag möglich ' + await ev(() => TQ.st.dailyPossible));
  await click('[data-act="tab"][data-tab="kalender"]');
  await ev(() => { document.getElementById('cal-detail').scrollIntoView(); });
  await shot('g18-kalender-tag');
  await click('[data-act="go"][data-v="heute"]');
  if (await page.$('[data-act="night-undo"]')) await click('[data-act="night-undo"]');
  await click('[data-act="night"][data-dry="0"]');
  await shot('g17-heute-ohnexp');
  await click('.sheet [data-act="bett-held"]');
  await dismiss();
  log.push('Bett-Held ohne XP: ' + JSON.stringify(await ev(() => ({ count: TQ.st.bettHeldCount, today: TQ.st.bettToday }))));
  await click('[data-act="guide"]');
  await shot('g19-anleitung');
  const over = await ev(() => document.documentElement.scrollWidth > window.innerWidth);
  log.push('horizontal overflow: ' + over);
  console.log(log.join('\n'));
  console.log(errors.length ? errors.join('\n') : 'keine Fehler');
  await browser.close();
})();
