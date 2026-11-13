// Etappe B: Schlüssel holen, zur Kristallinsel gleiten, Brücke bauen, Wispel und Himmelsinsel, Boss antippen, Sammelbuch
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
(async () => {
  const out = process.argv[2] || '/tmp/shotsB';
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
  const fail = async (msg) => { console.log(log.join('\n')); console.log('FEHLER ' + msg + ' ' + JSON.stringify(await st())); console.log(errors.join('\n')); await page.screenshot({ path: path.join(out, 'zz.png') }); process.exit(1); };
  const shot = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, n + '.png') }); };
  const gshot = async (n) => { await (await page.$('#game')).screenshot({ path: path.join(out, n + '.png') }); };
  const ev = (fn, a) => page.evaluate(fn, a);
  const dismiss = async () => { for (let i = 0; i < 10; i++) { const c = await page.$('[data-act="cel-next"]'); if (!c) break; log.push('Feier: ' + await page.textContent('#cel-t')); await c.click(); await page.waitForTimeout(80); } };
  const click = async (sel) => { await dismiss(); try { await page.click(sel, { timeout: 4000 }); } catch (e) { await fail('Klick ' + sel); } await page.waitForTimeout(150); };
  const st = () => ev(() => ({ lvl: TQ.st.level, stage: TQ.st.stage, holz: TQ.st.holz, field: TQ.st.field, items: TQ.st.items, keyHave: TQ.st.keyHave, built: Object.keys(TQ.st.built), next: TQ.st.nextBuild && TQ.st.nextBuild.id, helpers: TQ.st.helpers.filter((h) => h.here).map((h) => h.id), game: Game.debug() }));
  const waitIdle = async (max) => { for (let i = 0; i < (max || 80); i++) { const d = await ev(() => Game.debug()); if (!d.lilo.moving && !d.lilo.busy) return; await page.waitForTimeout(100); } };
  const tapTile = async (x, y, dy) => { await ev(([x, y, dy]) => { const p = Game.screenOf(x, y); Game.tapAt(p.x, p.y + (dy || 0) * p.z); }, [x, y, dy]); await page.waitForTimeout(100); await waitIdle(); };
  const resetTime = () => ev(() => TQ.actions['island-reset']());
  const toInsel = async () => { await click('.nav [data-v="insel"]'); await ev(() => Game.setPhase('tag')); await resetTime(); await page.waitForTimeout(300); };

  await click('.sheet [data-act="sheet-close"]');
  await ev(() => TQ.actions['demo-seed']({ k: 'weit' }));
  await page.waitForTimeout(300); await dismiss();
  await toInsel();
  log.push('Start ' + JSON.stringify(await st()));
  await click('[data-act="zoom"]');
  await shot('b01-ganz');
  await click('[data-act="zoom"]');
  // Kristallinsel antippen, ohne Schlüssel
  await tapTile(-6, 6, -6);
  await page.waitForTimeout(200);
  await shot('b02-ohne-schluessel');
  // Schlüssel holen
  await ev(() => { const p = Game.objectPoint('hoehle'); Game.tapAt(p.x, p.y); });
  await page.waitForTimeout(200); await waitIdle(); await page.waitForTimeout(1500); await dismiss();
  if ((await ev(() => Game.scene())) !== 'hoehle') await fail('nicht in der Höhle');
  await shot('b02b-grotte');
  for (let i = 0; i < 6 && !(await ev(() => TQ.st.keyHave)); i++) { await tapTile(3, 3, -12); await page.waitForTimeout(400); await dismiss(); }
  log.push('Schlüssel ' + (await ev(() => TQ.st.keyHave)));
  await click('[data-act="cave-leave"]');
  await page.waitForTimeout(300);
  await shot('b03-ziel-flug');
  // Fliegen
  await click('#insel-info [data-act="game-go"][data-obj="flug"]');
  for (let i = 0; i < 60; i++) { const d = await ev(() => Game._dbg && Game.debug()); if (d.lilo.moving && d.lilo.x <= 0 && d.lilo.y === 7) break; await page.waitForTimeout(100); }
  await page.waitForTimeout(700);
  await gshot('b04-gleiten');
  await waitIdle(); await page.waitForTimeout(400);
  log.push('Nach Flug ' + JSON.stringify(await st()));
  await shot('b05-gelandet');
  await dismiss();
  if (!(await ev(() => !!TQ.st.built.kristallinsel))) await fail('Kristallinsel nicht gebaut');
  // Zurück gleiten und Material einsammeln
  await tapTile(4, 3, -14);
  log.push('Zurück ' + JSON.stringify((await st()).game.lilo));
  // Brücke herstellen
  await click('[data-act="panel"][data-kind="werkbank"]');
  await click('[data-act="wb-recipe"][data-id="bruecke"]');
  await click('[data-act="wb-auto"]');
  await shot('b06-werkbank-bruecke');
  await click('[data-act="wb-make"]');
  await click('.full [data-act="game-go"]');
  await page.waitForTimeout(300); await waitIdle(); await page.waitForTimeout(1900);
  await dismiss();
  log.push('Nach Brücke ' + JSON.stringify(await st()));
  if (!(await ev(() => !!TQ.st.built.bruecke))) await fail('Brücke nicht gebaut');
  await tapTile(-6, 7, -6);
  log.push('Über Brücke ' + JSON.stringify((await st()).game.lilo));
  await ev(() => { const p = Game.screenOf(-7, 6); Game.tapAt(p.x, p.y - 14 * p.z); });
  await page.waitForTimeout(300);
  await shot('b07-bruecke-splitti');
  // Vorspulen bis Level 15
  for (let k = 0; k < 6 && (await ev(() => TQ.st.stage)) < 3; k++) {
    await click('[data-act="demo-tools"]');
    await click('[data-act="demo-ff"][data-n="7"]');
    await dismiss();
  }
  await toInsel();
  log.push('Level ' + JSON.stringify(await st()));
  await shot('b08-wispel-wartet');
  await click('#insel-info [data-act="game-go"][data-obj="wispel"]');
  await page.waitForTimeout(300); await waitIdle(120);
  await page.waitForTimeout(800);
  await gshot('b09-aufstieg');
  await page.waitForTimeout(1200);
  await gshot('b10-ehrenrunde');
  await page.waitForTimeout(3000);
  await shot('b11-finale');
  await dismiss();
  log.push('Finale ' + JSON.stringify(await st()));
  if (!(await ev(() => !!TQ.st.built.himmelsinsel))) await fail('Himmelsinsel nicht erreicht');
  await shot('b12-himmel');
  await ev(() => { const p = Game.screenOf(6, 6); Game.tapAt(p.x, p.y - 10 * p.z); });
  await page.waitForTimeout(200); await waitIdle(); await page.waitForTimeout(400);
  log.push('Zurück vom Himmel: ' + (await ev(() => Game.scene())));
  await shot('b13-zurueck');
  // Boss
  await click('.nav [data-v="boss"]');
  await shot('b14-boss');
  const b0 = await ev(() => ({ charge: TQ.st.boss.charge, left: TQ.st.boss.left, def: TQ.st.boss.defeated }));
  for (let i = 0; i < 30; i++) {
    const b = await ev(() => ({ charge: TQ.st.boss.charge, def: TQ.st.boss.defeated }));
    if (b.def || !b.charge) break;
    await page.click('.boss-tap'); await page.waitForTimeout(120);
    if (i === 1) await shot('b15-treffer');
  }
  await page.waitForTimeout(600);
  const b1 = await ev(() => ({ charge: TQ.st.boss.charge, left: TQ.st.boss.left, def: TQ.st.boss.defeated }));
  log.push('Boss vorher ' + JSON.stringify(b0) + ' nachher ' + JSON.stringify(b1));
  await shot('b16-boss-danach');
  await dismiss();
  await click('.nav [data-v="truhe"]');
  await page.evaluate(() => { const e = document.querySelector('.book'); if (e) e.scrollIntoView(); });
  await shot('b17-sammelbuch');
  // Eltern-Kalender: Einträge lesbar
  console.log(log.join('\n'));
  console.log(errors.length ? errors.join('\n') : 'Keine Fehler');
  await browser.close();
})();
