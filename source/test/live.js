// Ende-zu-Ende: drei iPhones (Papa, Kind, Mama) mit gemeinsamem Speicher gegen die nachgebildete Supabase.
// Aufruf: node test/live.js <ausgabe-ordner> <pg-socket-dir>
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const out = process.argv[2] || '/tmp/live';
const sock = process.argv[3];
const PGPORT = '54329', DB = 'live', MOCK = 54400;
fs.mkdirSync(out, { recursive: true });
const psql = (args) => execFileSync('psql', ['-h', sock, '-p', PGPORT, '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'].concat(args), { encoding: 'utf8' }).trim();
psql(['-c', 'drop database if exists ' + DB]);
psql(['-c', 'create database ' + DB]);
psql(['-d', DB, '-f', path.join(out, '..', 'shim-live.sql')]);
psql(['-d', DB, '-f', path.resolve(__dirname, '../supabase/schema.sql')]);
const db = (q) => psql(['-d', DB, '-c', q]);

const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config.json'), 'utf8'));
let ok = 0, bad = 0;
const check = (name, cond, extra) => { if (cond) ok++; else bad++; console.log((cond ? 'ok   ' : 'FEHL ') + name + (extra != null ? ' · ' + JSON.stringify(extra) : '')); };

(async () => {
  const mock = spawn('node', [path.resolve(__dirname, 'mock-supabase.js'), String(MOCK), sock, PGPORT, DB], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((r) => mock.stdout.once('data', r));
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  async function phone(name) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Europe/Zurich', locale: 'de-CH' });
    await ctx.route(cfg.supabaseUrl + '/**', async (route) => {
      const u = route.request().url().replace(cfg.supabaseUrl, 'http://127.0.0.1:' + MOCK);
      try { const r = await route.fetch({ url: u }); await route.fulfill({ response: r }); }
      catch (e) { await route.abort('failed'); }
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) errors.push(name + ' console: ' + m.text()); });
    await page.goto('file://' + path.resolve(__dirname, '../dist/web/index.html'));
    await page.waitForTimeout(500);
    page.shot = (n) => page.screenshot({ path: path.join(out, n + '.png') });
    page.ev = (fn, a) => page.evaluate(fn, a);
    page.tap = async (sel) => { await page.click(sel, { timeout: 5000 }); await page.waitForTimeout(150); };
    page.dismiss = async () => { for (let i = 0; i < 8; i++) { const c = await page.$('[data-act="cel-next"]'); if (!c) break; await c.click(); await page.waitForTimeout(60); } };
    page.sync = async () => { await page.ev(() => TQ.store.sync()); await page.waitForTimeout(150); };
    page.pin = async (p) => { for (const d of p) await page.tap('[data-act="pin-key"][data-k="' + d + '"]'); };
    return page;
  }
  try {
    // 1. Papa richtet die Familie ein
    const papa = await phone('papa');
    await papa.shot('l01-start');
    check('Startseite zeigt Einrichtung', await papa.$('[data-act="setup"][data-step="new"]') != null);
    await papa.tap('[data-act="setup"][data-step="new"]');
    await papa.tap('[data-act="setup-new"][data-dev="papa"]');
    await papa.waitForSelector('.code-big', { timeout: 8000 });
    const codes = await papa.$$eval('.code-big', (els) => els.map((e) => e.textContent));
    check('zwei Codes', codes.length === 2 && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/.test(codes[0]), codes);
    await papa.shot('l02-codes');
    await papa.tap('[data-act="setup-done"]');
    await papa.pin('1234'); await papa.pin('1234');
    await papa.waitForTimeout(300);
    await papa.sync();
    check('Einstellungen auf dem Server', db('select count(*) from public.settings') === '1');
    check('PIN gemeinsam gespeichert', db("select (data->>'pinHash') is not null from public.settings") === 't');
    await papa.shot('l03-eltern');
    // Heldenname ändern (Eltern dürfen)
    await papa.ev(() => TQ.saveSettings({ heroName: 'Blitz' }));
    await papa.sync();
    check('Heldenname auf dem Server', db("select data->>'heroName' from public.settings") === 'Blitz');

    // 2. Kind tritt bei (Kleinbuchstaben, ohne Striche)
    const kind = await phone('kind');
    await kind.tap('[data-act="setup"][data-step="join"]');
    await kind.fill('#join-code', codes[0].replace(/-/g, '').toLowerCase());
    await kind.shot('l04-code');
    await kind.tap('[data-act="setup-join"]');
    await kind.waitForSelector('.nav', { timeout: 8000 });
    await kind.dismiss();
    const kHero = await kind.ev(() => TQ.st.settings.heroName);
    check('Kind sieht Einstellungen der Eltern', kHero === 'Blitz', kHero);
    check('Kind-Rolle', (await kind.ev(() => TQ.store.role())) === 'kind');
    const sh = await kind.$('.sheet [data-act="sheet-close"]'); if (sh) await sh.click();
    await kind.tap('[data-act="night"][data-dry="1"]');
    await kind.dismiss();
    await kind.tap('[data-act="quest"][data-id="morgen"]');
    await kind.dismiss();
    await kind.sync();
    const nEv = db('select count(*) from public.events');
    console.log('DEBUG', JSON.stringify(await kind.ev(() => ({ s: TQ.store.status(), o: TQ.store._debug().outbox.slice(0, 1) }))));
    check('Einträge des Kindes auf dem Server', +nEv >= 2, nEv);
    await kind.shot('l05-kind-heute');

    // 3. Papa sieht die Einträge
    await papa.sync();
    const pXp = await papa.ev(() => TQ.st.xp), kXp = await kind.ev(() => TQ.st.xp);
    check('Papa sieht dieselben Punkte', pXp === kXp && kXp > 0, [pXp, kXp]);

    // 4. Kind darf keine Einstellungen ändern
    await kind.ev(() => TQ.saveSettings({ heroName: 'Hack' }));
    await kind.sync();
    check('Kind: Einstellung bleibt', db("select data->>'heroName' from public.settings") === 'Blitz');
    await kind.ev(() => TQ.go('eltern'));
    await kind.pin('1234');
    await kind.waitForTimeout(200);
    check('Kind-Gerät: Eltern-Ansicht nur lesen', (await kind.textContent('main')).includes('nur nachschauen'));
    await kind.shot('l06-kind-eltern');
    await kind.ev(() => TQ.go('heute'));

    // 5. Mama tritt mit dem Eltern-Code bei
    const mama = await phone('mama');
    await mama.tap('[data-act="setup"][data-step="join"]');
    await mama.fill('#join-code', codes[1]);
    await mama.tap('[data-act="setup-join"]');
    await mama.waitForSelector('[data-act="setup-who"]', { timeout: 8000 });
    await mama.tap('[data-act="setup-who"][data-dev="mama"]');
    await mama.waitForTimeout(300);
    await mama.pin('1234');
    await mama.waitForTimeout(300);
    check('Mama in der Eltern-Ansicht', (await mama.textContent('.hud-name')).includes('Eltern-Ansicht'));
    check('Mama sieht dieselben Punkte', (await mama.ev(() => TQ.st.xp)) === kXp);
    check('Mitglieder', db('select string_agg(role || \':\' || coalesce(device,\'-\'), \',\' order by created_at) from public.members') === 'eltern:papa,kind:-,eltern:mama');
    await mama.ev(() => { TQ.ui.eltTab = 'daten'; TQ.render(); });
    await mama.tap('[data-act="show-codes"]');
    await mama.tap('[data-act="show-members"]');
    await mama.shot('l07-mama-daten');

    // 6. Ohne Netz: Eintrag bleibt in der Warteschlange und wird nachgeschickt
    await fetch('http://127.0.0.1:' + MOCK + '/__fail?n=6');
    const before = +db('select count(*) from public.events');
    await kind.ev(() => TQ.addEvent({ type: 'quest', questId: 'trinken' }, { quiet: true }));
    await kind.ev(() => TQ.store.sync());
    const pend = await kind.ev(() => TQ.store.status().pending);
    check('offline: Eintrag wartet', pend >= 1, pend);
    await fetch('http://127.0.0.1:' + MOCK + '/__fail?n=0');
    await kind.sync(); await kind.sync();
    check('wieder online: nachgeschickt', +db('select count(*) from public.events') === before + 1 && (await kind.ev(() => TQ.store.status().pending)) === 0);

    // 7. Abgelaufene Anmeldung wird erneuert
    await fetch('http://127.0.0.1:' + MOCK + '/__expire');
    await kind.ev(() => TQ.addEvent({ type: 'quest', questId: 'trinken' }, { quiet: true }));
    await kind.sync();
    check('nach Ablauf: erneuert und gesendet', +db('select count(*) from public.events') === before + 2 && (await kind.ev(() => TQ.store.status().pending)) === 0);

    // 8. Papa löscht einen Eintrag, das Kind sieht es
    const id = db("select id from public.events where type='quest' order by created_at desc limit 1");
    await papa.sync();
    await papa.ev((id) => TQ.deleteEvent(id), id);
    await papa.sync();
    await kind.sync();
    check('Löschen kommt beim Kind an', !(await kind.ev((id) => TQ.data.events.some((e) => e.id === id), id)));
    // Kind: Belohnung eintragen geht nicht
    await kind.ev(() => TQ.addEvent({ type: 'reward', rewardId: 'x' }));
    await kind.sync();
    check('Kind kann keine Belohnung eintragen', db("select count(*) from public.events where type='reward'") === '0');

    // 9. Gleichzeitig: Kind spielt, Papa ändert Einstellungen – beides bleibt
    await kind.ev(() => TQ.addEvent({ type: 'quest', questId: 'trinken' }, { quiet: true }));
    await papa.ev(() => TQ.saveSettings({ islandMinutes: 4 }));
    await Promise.all([kind.sync(), papa.sync()]);
    await kind.sync(); await papa.sync(); await mama.sync();
    const sig = async (p) => p.ev(() => [TQ.data.events.length, TQ.st.xp, TQ.st.settings.islandMinutes].join('/'));
    const a = await sig(papa), b = await sig(kind), c = await sig(mama);
    check('alle drei gleich', a === b && b === c, [a, b, c]);

    // 10. Abmelden und neu verbinden
    await mama.ev(() => { TQ.ui.eltTab = 'daten'; TQ.render(); });
    await mama.tap('[data-act="leave"]');
    await mama.tap('[data-act="leave-yes"]');
    check('abgemeldet: Startseite', await mama.$('[data-act="setup"][data-step="join"]') != null);
    await mama.tap('[data-act="setup"][data-step="join"]');
    await mama.fill('#join-code', 'ZZZZ-ZZZZ-ZZ');
    await mama.tap('[data-act="setup-join"]');
    await mama.waitForTimeout(1200);
    check('falscher Code: Meldung', (await mama.textContent('main')).includes('gibt es nicht'));
    await mama.shot('l08-falscher-code');

    // 11. Demo aus der Online-Version und zurück
    await papa.ev(() => { TQ.ui.eltTab = 'daten'; TQ.render(); });
    await papa.tap('[data-act="demo"][data-on="1"]');
    await papa.dismiss();
    check('Demo an', await papa.ev(() => TQ.device.demo && TQ.store.kind === 'local'));
    await papa.ev(() => window.TQParents.setDemo(false));
    await papa.waitForTimeout(300);
    check('Demo aus, echte Daten zurück', await papa.ev(() => !TQ.device.demo && TQ.store.kind === 'supabase' && TQ.st.settings.heroName === 'Blitz'));
    await papa.shot('l09-papa-zurueck');

    // Kein echter Name im Code
    const html = fs.readFileSync(path.resolve(__dirname, '../dist/web/index.html'), 'utf8');
    const real = process.env.TQ_REAL_NAME;   // echter Name nur als Umgebungsvariable, nie im Code
    if (real) check('kein echter Name im Code', !new RegExp(real, 'i').test(html));
  } catch (e) { bad++; console.log('ABBRUCH ' + e.message); }
  console.log(errors.length ? errors.join('\n') : 'Keine Seitenfehler');
  console.log(ok + ' ok, ' + bad + ' fehlgeschlagen');
  await browser.close(); mock.kill();
  process.exit(bad ? 1 : 0);
})();
