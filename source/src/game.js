/* Trocken-Quest – spielbare Insel
 * Lilo läuft auf Antippen über die Blockwelt, sammelt Material ein, baut die Leiter an, gräbt den Höhlengang
 * und betritt die Leuchtgrotte. Die Ansicht lässt sich verschieben und zoomen.
 * Spielregeln bleiben im Rechenkern; hier sind nur Darstellung, Bewegung und Antippen.
 *
 * Zeichnen: Jedes Bild wird vollständig in Tiefenreihenfolge gezeichnet (Blöcke als zwischengespeicherte
 * Bilder). Kein teilweises Neuzeichnen mehr, deshalb keine aufblitzenden Blöcke.
 */
(function (root) {
  'use strict';
  const W = root.World;
  const G = {};
  root.Game = G;

  const LW = 390, LH = 440;      // logische Grösse der Zeichenfläche
  const TW = 34;                 // Breite eines Blocks
  const STEP_MS = 230, LADDER_MS = 950, GLIDE_MS = 1800;

  /* ---------- Zustand ---------- */
  let canvas = null, ctx = null, cb = {}, st = null, scene = 'insel';
  let map = null;
  let lilo = { x: 5, y: 7, h: 1, path: [], seg: null, flip: false, act: null, busy: null };
  let bubbles = [], floaters = [], sparks = [];
  let raf = null, running = false;
  let mooslingAt = 0, hop = {};
  let phaseOverride = null, locked = false;
  const cam = { x: 0, y: 0, z: 1, near: true, follow: true };
  let pxScale = 1;

  /* ---------- Hilfen ---------- */
  const key = (x, y) => x + ',' + y;
  const now = () => (root.performance ? performance.now() : Date.now());
  const mins = (hhmm) => { const p = String(hhmm || '0:0').split(':'); return (+p[0] || 0) * 60 + (+p[1] || 0); };
  function phase() {
    if (phaseOverride && phaseOverride !== 'auto') return phaseOverride;
    const d = cb.now ? cb.now() : new Date();
    const t = d.getHours() * 60 + d.getMinutes();
    const sl = cb.sleep ? cb.sleep() : { from: '22:00', to: '06:00' };
    const from = mins(sl.from), to = mins(sl.to);
    const inRange = (a, b) => (a <= b ? t >= a && t < b : t >= a || t < b);
    if (inRange(from, to)) return 'nacht';
    if (inRange((from - 180 + 1440) % 1440, from)) return 'abend';
    if (inRange(to, (to + 180) % 1440)) return 'morgen';
    return 'tag';
  }
  G.phase = phase;
  G.setPhase = (p) => { if (p !== phaseOverride) bubbles = []; phaseOverride = p; };
  G.setLocked = (v) => { if (v && !locked) { lilo.path = []; lilo.act = null; bubbles = []; } locked = !!v; kick(); };

  /* ---------- Karten ---------- */
  function addPyramid(blocks, n) {
    for (let d = 1; ; d++) {
      const lo = d, hi = n - 1 - d;
      if (lo > hi) break;
      for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) blocks.push([x, y, -1 - d, 'stone']);
    }
  }
  function tree(blocks, col, x, y, trunk, r) {
    for (let z = 1; z <= trunk; z++) blocks.push([x, y, z, 'log']);
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (r > 0 && Math.abs(dx) + Math.abs(dy) > r + 0 && r === 1) continue;
      const k = key(x + dx, y + dy);
      if (!col[k]) continue;
      blocks.push([x + dx, y + dy, trunk + 1, 'leaves']);
      col[k].walk = false;
    }
    blocks.push([x, y, trunk + 2, 'leaves']);
    col[key(x, y)].walk = false;
  }

  function islandMap() {
    const n = 12, blocks = [], col = {};
    const built = st.built || {};
    const ph = phase();
    const water = { '1,8': 1, '2,8': 1, '1,9': 1, '2,9': 1, '3,9': 1 };
    const sand = {};
    ['5,8', '6,8', '7,8', '8,8', '8,7', '8,6', '9,6', '9,5', '9,4', '10,4', '10,3'].forEach((k) => { sand[k] = 1; });
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      const k = key(x, y);
      blocks.push([x, y, 0, water[k] ? 'water' : sand[k] ? 'sand' : 'grass'], [x, y, -1, 'dirt']);
      col[k] = { h: 1, walk: !water[k] };
    }
    addPyramid(blocks, n);
    // Wald
    [1, 2, 3].forEach((z) => blocks.push([1, 1, z, 'log']));
    for (let x = 0; x <= 2; x++) for (let y = 0; y <= 2; y++) { blocks.push([x, y, 4, 'leaves']); col[key(x, y)].walk = false; }
    blocks.push([1, 1, 5, 'leaves']);
    tree(blocks, col, 4, 0, 2, 1);
    tree(blocks, col, 0, 5, 2, 1);
    // Berg mit Leiter-Stelle (8,2) und Höhleneingang (10,2)
    const mtn = { '8,0': 3, '9,0': 4, '10,0': 5, '11,0': 5, '8,1': 3, '9,1': 4, '10,1': 4, '11,1': 5, '8,2': 3, '9,2': 3, '10,2': 3, '11,2': 4 };
    Object.keys(mtn).forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      for (let z = 1; z <= mtn[k]; z++) {
        let t = 'stone';
        if (k === '8,2' && built.leiter) t = 'ladder';
        if (k === '10,2' && z === 1) t = built.hoehle ? 'caveLit' : 'crack';
        blocks.push([x, y, z, t]);
      }
      col[k].h = mtn[k] + 1;
    });
    // Haus, Vorratstruhe, Werkbank
    const lit = ph === 'abend' || ph === 'nacht';
    blocks.push([5, 5, 1, 'planks'], [6, 5, 1, 'planks'], [5, 6, 1, 'door'], [6, 6, 1, lit ? 'winLit' : 'win']);
    blocks.push([5, 5, 2, 'planks'], [6, 5, 2, 'planks'], [5, 6, 2, 'planks'], [6, 6, 2, 'planks']);
    blocks.push([5, 5, 3, 'roof'], [6, 5, 3, 'roof'], [5, 6, 3, 'roof'], [6, 6, 3, 'roof']);
    ['5,5', '6,5', '5,6', '6,6'].forEach((k) => { col[k].walk = false; });
    blocks.push([4, 6, 1, 'chest'], [7, 6, 1, 'werkbank']);
    col['4,6'].walk = false; col['7,6'].walk = false;
    // Kristallinsel links neben der Startinsel (x -9 bis -4, y 4 bis 9), dazwischen drei Felder Luft
    const kx0 = -9, ky0 = 4, kn = 6;
    for (let x = 0; x < kn; x++) for (let y = 0; y < kn; y++) {
      blocks.push([kx0 + x, ky0 + y, 0, 'crystalGrass'], [kx0 + x, ky0 + y, -1, 'dirt']);
      col[key(kx0 + x, ky0 + y)] = { h: 1, walk: true, kristall: true };
    }
    for (let d = 1; ; d++) { const lo = d, hi = kn - 1 - d; if (lo > hi) break; for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) blocks.push([kx0 + x, ky0 + y, -1 - d, 'stone']); }
    [[-9, 4, 2], [-9, 9, 1], [-5, 4, 1], [-7, 8, 2], [-4, 9, 1]].forEach(([x, y, hgt]) => { for (let z = 1; z <= hgt; z++) blocks.push([x, y, z, 'crystal']); col[key(x, y)].walk = false; });
    if (built.bruecke) { [[-3, 7], [-2, 7], [-1, 7]].forEach(([x, y]) => { blocks.push([x, y, 0, 'bridge']); col[key(x, y)] = { h: 1, walk: true }; }); }
    const links = [];
    if (built.leiter) links.push({ a: [8, 3], b: [8, 2], type: 'ladder' });
    if (built.kristallinsel && !built.bruecke && (st.stage || 0) >= 2) links.push({ a: [0, 7], b: [-4, 7], type: 'glide' });
    return {
      n, blocks: sortBlocks(blocks), col, links,
      spots: { holz: [[4, 3], [3, 4], [5, 3]], stein: [[7, 1], [7, 3], [6, 3]] },
      objects: {
        vorrat: { tile: [4, 6], stand: [4, 7] }, werkbank: { tile: [7, 6], stand: [7, 7] }, door: { tile: [5, 6], stand: [5, 7] },
        leiter: { tile: [8, 2], z: [1, 3], stand: [8, 3] }, hoehle: { tile: [10, 2], z: [1, 1], stand: [10, 3] },
        flug: { stand: [0, 7], land: [-4, 7] }, bruecke: { tiles: [[-3, 7], [-2, 7], [-1, 7]], stand: [0, 7] }, wispel: { tile: [2, 6], stand: [2, 7] }
      },
      deco: [{ spr: 'sign', x: 11, y: 4, text: 'Höhle' }].concat(built.hoehle ? [{ spr: 'torch', x: 9, y: 3 }, { spr: 'torch', x: 11, y: 3 }] : []),
      bg: true,
      start: [5, 7]
    };
  }

  function caveMap() {
    const n = 8, blocks = [], col = {};
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      blocks.push([x, y, 0, 'stoneDark']);
      col[key(x, y)] = { h: 1, walk: x > 0 && y > 0 };
    }
    for (let x = 0; x < n; x++) { blocks.push([x, 0, 1, x % 3 === 1 ? 'ore' : 'cobble'], [x, 0, 2, x === 3 || x === 6 ? 'glow' : 'cobble']); }
    for (let y = 1; y < n; y++) { blocks.push([0, y, 1, y % 3 === 2 ? 'ore' : 'cobble'], [0, y, 2, y === 4 ? 'glow' : 'cobble']); }
    blocks.push([1, 1, 1, 'crystal'], [6, 1, 1, 'glow'], [1, 6, 1, 'crystal'], [1, 1, 2, 'crystal']);
    ['1,1', '6,1', '1,6'].forEach((k) => { col[k].walk = false; });
    return {
      n, blocks: sortBlocks(blocks), col, links: [],
      chestSpots: [[2, 2], [5, 2], [2, 4], [4, 5]], keySpot: [3, 3], funkel: [5, 4], exit: [7, 7],
      lights: [[3, 0, 2, 80], [6, 0, 2, 70], [0, 4, 2, 80], [6, 1, 1, 60], [1, 1, 2, 56], [1, 6, 1, 50]],
      deco: [], bg: false, start: [7, 7], objects: {}
    };
  }
  function skyMap() {
    const n = 7, blocks = [], col = {};
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      const edge = (x === 0 || y === 0 || x === n - 1 || y === n - 1) && (x + y) % 3 === 0;
      blocks.push([x, y, 0, 'cloudw']);
      if (!edge) blocks.push([x, y, -1, 'cloudw']);
      col[key(x, y)] = { h: 1, walk: true };
    }
    for (let x = 2; x <= 4; x++) for (let y = 2; y <= 4; y++) blocks.push([x, y, -2, 'cloudw']);
    blocks.push([3, 2, 1, 'crystal'], [1, 1, 1, 'crystal'], [1, 1, 2, 'crystal'], [5, 1, 1, 'crystal'], [1, 5, 1, 'crystal']);
    ['3,2', '1,1', '5,1', '1,5'].forEach((k) => { col[k].walk = false; });
    return { n, blocks: sortBlocks(blocks), col, links: [], deco: [], bg: false, sky: true, start: [4, 5], exit: [6, 6], crown: [3, 2], objects: {} };
  }
  function sortBlocks(b) { return b.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]) || p[2] - q[2]); }

  /* ---------- Projektion (Weltkoordinaten) ---------- */
  function cubeXY(x, y, z) { return [(x - y) * TW / 2, (x + y) * TW / 4 - z * TW / 2]; }
  function foot(x, y, h) { const p = cubeXY(x, y, h - 1); return [p[0] + TW / 2, p[1] + TW / 4]; }
  function colOf(x, y) { return map.col[key(x, y)]; }
  // Hintergrund (nur Insel): Kristallinsel links oben, Himmelsinsel Mitte, Boss-Wolke rechts oben
  const BG = { kristall: [-250, -175], himmel: [-10, -235], boss: [175, -200] };
  function worldBounds() {
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    map.blocks.forEach((c) => { const p = cubeXY(c[0], c[1], c[2]); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0] + TW); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1] + TW); });
    if (map.bg) { maxX = Math.max(maxX, BG.boss[0] + 90); minY = Math.min(minY, BG.himmel[1] - 30); }
    return { minX: minX - 10, maxX: maxX + 10, minY: minY - 70, maxY: maxY + 10 };
  }
  function fitZoom() { const b = worldBounds(); return Math.min(LW / (b.maxX - b.minX), LH / (b.maxY - b.minY)); }
  function clampCam() {
    const b = worldBounds();
    const hw = LW / 2 / cam.z, hh = LH / 2 / cam.z;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    cam.x = (b.maxX - b.minX) <= hw * 2 ? cx : Math.max(b.minX + hw, Math.min(b.maxX - hw, cam.x));
    cam.y = (b.maxY - b.minY) <= hh * 2 ? cy : Math.max(b.minY + hh, Math.min(b.maxY - hh, cam.y));
  }
  function resetCam() {
    const fz = fitZoom();
    cam.z = cam.near ? Math.max(fz, Math.min(1.2, fz * 1.7)) : fz;
    const b = worldBounds();
    if (cam.near) { const f = heroAt(); cam.x = f.sx; cam.y = f.sy - 30; } else { cam.x = (b.minX + b.maxX) / 2; cam.y = (b.minY + b.maxY) / 2; }
    clampCam();
  }
  const toScreen = (wx, wy) => [(wx - cam.x) * cam.z + LW / 2, (wy - cam.y) * cam.z + LH / 2];
  const toWorld = (sx, sy) => [(sx - LW / 2) / cam.z + cam.x, (sy - LH / 2) / cam.z + cam.y];

  /* ---------- Wegsuche ---------- */
  function neighbors(x, y) {
    const out = [];
    const c = colOf(x, y);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, nc = colOf(nx, ny);
      if (nc && nc.walk && Math.abs(nc.h - c.h) <= 1) out.push([nx, ny, null]);
    });
    map.links.forEach((l) => {
      if (l.a[0] === x && l.a[1] === y) out.push([l.b[0], l.b[1], l.type]);
      if (l.b[0] === x && l.b[1] === y) out.push([l.a[0], l.a[1], l.type]);
    });
    return out;
  }
  function findPath(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [];
    const prev = {}; const q = [[sx, sy]]; prev[key(sx, sy)] = null;
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      neighbors(x, y).forEach(([nx, ny, type]) => {
        const k = key(nx, ny);
        if (k in prev) return;
        prev[k] = { x, y, type }; q.push([nx, ny]);
      });
    }
    if (!(key(tx, ty) in prev)) return null;
    const path = [];
    let k = key(tx, ty), cx = tx, cy = ty;
    while (prev[k]) { path.unshift({ x: cx, y: cy, type: prev[k].type }); const p = prev[k]; cx = p.x; cy = p.y; k = key(cx, cy); }
    return path;
  }

  /* ---------- Material auf der Insel ---------- */
  function split(total, k) {
    if (total <= 0) return [];
    const parts = Math.min(k, total);
    const out = [];
    for (let i = 0; i < parts; i++) out.push(Math.floor(total / parts) + (i < total % parts ? 1 : 0));
    return out;
  }
  // Jeder Haufen bleibt an seinem Platz: Neues Material wird auf die kleinsten Haufen verteilt,
  // eingesammelte Haufen verschwinden, ohne dass die anderen springen.
  const piles = {};
  function syncPiles(res, total) {
    let p = piles[res];
    if (!p) { p = piles[res] = split(total, 3).concat([0, 0, 0]).slice(0, 3); return p; }
    let cur = p.reduce((a, b) => a + b, 0);
    while (cur < total) { let i = 0; for (let k = 1; k < 3; k++) if (p[k] < p[i]) i = k; p[i]++; cur++; }
    for (let i = 2; cur > total && i >= 0; i--) { const take = Math.min(p[i], cur - total); p[i] -= take; cur -= take; }
    return p;
  }
  function drops() {
    if (scene !== 'insel' || !st || !map) return [];
    const out = [];
    ['holz', 'stein'].forEach((res) => {
      syncPiles(res, st.field[res] || 0).forEach((n, i) => { if (n > 0) { const sp = map.spots[res][i]; out.push({ res, n, x: sp[0], y: sp[1], pile: i }); } });
    });
    return out;
  }
  function caveItems() {
    if (scene !== 'hoehle' || !st || !map) return [];
    const out = [];
    const nCh = st.field.chests || 0;
    map.chestSpots.slice(0, Math.min(nCh, map.chestSpots.length)).forEach((sp, i) => out.push({ res: 'truhe', x: sp[0], y: sp[1], extra: i === map.chestSpots.length - 1 && nCh > map.chestSpots.length ? nCh - map.chestSpots.length : 0 }));
    if (st.field.key) out.push({ res: 'schluessel', x: map.keySpot[0], y: map.keySpot[1] });
    return out;
  }
  function itemsHere() { return scene === 'insel' ? drops() : caveItems(); }

  /* ---------- Helfer ---------- */
  const TIPS = {
    moosling: ['Ein Glas Wasser am Morgen weckt den Körper sanft.', 'Trink über den Tag verteilt, nicht alles am Abend.', 'Hast du in der Schule schon getrunken?', 'Ich bringe dir Holz für jede Quest!'],
    kiesel: ['Alle 2 bis 3 Stunden aufs WC, auch wenn es nicht drückt.', 'Blasen-Scan: kurz in den Bauch hineinspüren.', 'Beim Pinkeln locker sitzen und Zeit lassen.', 'Ich bringe dir Stein für jede Quest!'],
    splitti: ['Für jeden Boss-Sieg bringe ich dir 3 Kristalle extra!', 'Kristalle glänzen, wenn du dranbleibst.', 'Trink über den Tag verteilt, dann klappt es auch nachts besser.'],
    wispel: ['Steig auf, ich trage dich zur Himmelsinsel!', 'Von hier oben sieht man alle Inseln.', 'Du hast so viel geschafft. Stark!'],
    funkel: ['Vor dem Schlafen noch einmal aufs WC!', 'Die Abend-Übung im Bett hilft beim Loslassen.', 'Ich finde Truhen, wenn du Quests machst.', 'Hier unten ist es dunkel. Bleib nah bei mir!']
  };
  const EVENING = 'Bald ist Schlafenszeit: WC nicht vergessen!';
  function helperPos(id) {
    if (!st) return null;
    const here = (st.helpers || []).find((h) => h.id === id && h.here);
    if (id === 'wispel') {
      const waiting = (st.built.himmelsinsel || ((st.stage || 0) >= 3 && st.built.bruecke));
      if (scene === 'himmel') return { x: 2, y: 4, h: 1 };
      return scene === 'insel' && waiting ? { x: 2, y: 6, h: 1 } : null;
    }
    if (!here) return null;
    if (scene === 'himmel') return null;
    if (scene === 'hoehle') return id === 'funkel' ? { x: map.funkel[0], y: map.funkel[1], h: 1 } : null;
    if (id === 'moosling') { const pts = [[4, 9], [6, 10], [3, 10]]; const p = pts[mooslingAt % pts.length]; return { x: p[0], y: p[1], h: 1 }; }
    if (id === 'kiesel') return { x: 10, y: 0, h: 6 };
    if (id === 'funkel') return { x: 10, y: 5, h: 1 };
    if (id === 'splitti') return { x: -7, y: 6, h: 1 };
    return null;
  }
  function helperList() { return ['moosling', 'kiesel', 'funkel', 'splitti', 'wispel'].map((id) => ({ id, p: helperPos(id) })).filter((h) => h.p); }

  /* ---------- Block-Bilder ---------- */
  const imgCache = {};
  let imgCount = 0;
  function cubeImg(type, size) {
    const ps = Math.max(2, Math.round(size * pxScale));
    const k = type + '|' + ps;
    if (imgCache[k]) return imgCache[k];
    if (imgCount > 400) { Object.keys(imgCache).forEach((x) => delete imgCache[x]); imgCount = 0; }
    const c = document.createElement('canvas');
    c.width = ps; c.height = ps;
    const g = c.getContext('2d');
    W.cube(g, 0, 0, ps, type);
    imgCache[k] = c; imgCount++;
    return c;
  }
  // Leicht überlappend zeichnen, damit zwischen Blöcken keine hellen Fugen entstehen
  function drawCube(x, y, size, type, alpha) {
    const img = cubeImg(type, size);
    if (alpha != null) ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - 0.25, y - 0.25, size + 0.5, size + 0.5);
    if (alpha != null) ctx.globalAlpha = 1;
  }

  /* ---------- Zeichnen ---------- */
  function heroAt() {
    if (lilo.busy && lilo.busy.kind === 'lift') { const f = foot(lilo.x, lilo.y, lilo.h); const k = Math.min(1, (now() - lilo.busy.t) / 1400); return { sx: f[0], sy: f[1] - k * k * 220, depth: 99 }; }
    if (lilo.busy && lilo.busy.kind === 'tour') { const f = foot(3, 4, 1); const k = (now() - lilo.busy.t) / 3200; const a = k * Math.PI * 2; return { sx: f[0] + Math.cos(a) * 80, sy: f[1] - 40 + Math.sin(a) * 34 - Math.sin(k * Math.PI) * 20, depth: 99 }; }
    if (!lilo.seg) { const f = foot(lilo.x, lilo.y, lilo.h); return { sx: f[0], sy: f[1], depth: lilo.x + lilo.y + 0.5 }; }
    const s = lilo.seg;
    const t = Math.min(1, (now() - s.t0) / s.dur);
    const a = foot(s.fx, s.fy, s.fh), b = foot(s.tx, s.ty, s.th);
    let sx = a[0] + (b[0] - a[0]) * t, sy = a[1] + (b[1] - a[1]) * t;
    if (s.ladder) {
      const up = b[1] < a[1];
      if (up) { if (t < 0.85) { sx = a[0]; sy = a[1] + (b[1] - a[1]) * (t / 0.85); } }
      else if (t < 0.15) { sx = a[0] + (b[0] - a[0]) * (t / 0.15); sy = a[1]; } else { sx = b[0]; sy = a[1] + (b[1] - a[1]) * ((t - 0.15) / 0.85); }
    } else if (s.glide) sy -= Math.sin(Math.PI * t) * 46;
    else if (s.fh !== s.th) sy -= Math.sin(Math.PI * t) * 10;
    return { sx, sy, depth: Math.max(s.fx + s.fy, s.tx + s.ty) + 0.5 };
  }

  const SKY = { morgen: ['#F4C6A6', '#A7D7F5'], tag: ['#6FB7EE', '#B9E0FA'], abend: ['#E9864C', '#5B4A8C'], nacht: ['#0E1430', '#26346A'] };

  function drawFrame() {
    if (!canvas || !st || !map) return;
    const dpr = Math.min(3, root.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || LW;
    const sc = cssW / LW;
    const needW = Math.round(LW * sc * dpr), needH = Math.round(LH * sc * dpr);
    if (canvas.width !== needW || canvas.height !== needH) { canvas.width = needW; canvas.height = needH; }
    const tNow = now();
    const ph = phase();
    const sleeping = scene === 'insel' && ph === 'nacht';

    // Kamera folgt Lilo (nur im Nah-Modus)
    if (cam.near && cam.follow) {
      const hp = heroAt();
      const s = toScreen(hp.sx, hp.sy - 24);
      const mx = LW * 0.28, my = LH * 0.26;
      if (s[0] < mx || s[0] > LW - mx || s[1] < my || s[1] > LH - my) {
        cam.x += ((hp.sx) - cam.x) * 0.08; cam.y += ((hp.sy - 30) - cam.y) * 0.08; clampCam();
      }
    }

    // Bildschirm: Himmel
    ctx.setTransform(sc * dpr, 0, 0, sc * dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (scene === 'hoehle') { ctx.fillStyle = '#07080D'; ctx.fillRect(0, 0, LW, LH); }
    else {
      const sky = ctx.createLinearGradient(0, 0, 0, LH);
      sky.addColorStop(0, SKY[ph][0]); sky.addColorStop(1, SKY[ph][1]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, LW, LH);
      if (ph === 'nacht' || ph === 'abend') {
        [[30, 40], [80, 22], [140, 60], [220, 18], [260, 70], [350, 110], [20, 150], [365, 30], [110, 120], [300, 160], [60, 250]].forEach((p, i) => { ctx.fillStyle = i % 3 === 0 ? '#FFE7A0' : '#FFFFFF'; ctx.globalAlpha = ph === 'abend' ? 0.5 : 1; ctx.fillRect(p[0], p[1], 2, 2); });
        ctx.globalAlpha = 1;
      }
    }

    // Welt
    pxScale = sc * dpr * cam.z;
    ctx.setTransform(pxScale, 0, 0, pxScale, (LW / 2 - cam.x * cam.z) * sc * dpr, (LH / 2 - cam.y * cam.z) * sc * dpr);
    ctx.imageSmoothingEnabled = false;
    if (map.bg) drawBackground(ph);
    if (scene === 'himmel') { ctx.fillStyle = 'rgba(255,255,255,0.7)'; [[-150, 150, 70], [120, 190, 90], [-60, 230, 50], [170, 60, 46], [-190, 30, 40]].forEach(([x, y, w]) => { ctx.fillRect(x, y, w, 10); ctx.fillRect(x + w * 0.2, y - 7, w * 0.5, 8); }); }
    if (scene === 'insel' && ph !== 'nacht' && ph !== 'abend') { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-260, 40, 56, 12); ctx.fillRect(200, 70, 60, 12); ctx.fillRect(212, 60, 30, 10); }

    const dyn = [];
    itemsHere().forEach((it) => {
      const f = foot(it.x, it.y, colOf(it.x, it.y).h);
      dyn.push({ depth: it.x + it.y + 0.45, draw: () => drawItem(it, f, Math.sin(tNow / 300) * 2) });
    });
    (map.deco || []).forEach((d) => {
      const f = foot(d.x, d.y, colOf(d.x, d.y).h);
      dyn.push({ depth: d.x + d.y + 0.4, draw: () => {
        const r = W.drawSprite(ctx, W.SPR[d.spr], 2.4, f[0], f[1], { outline: true });
        if (d.text) W.label(ctx, d.text, f[0], r.top - 19, '#FFE7A0', 'center');
        if (d.spr === 'torch' && ph !== 'tag') { const gr = ctx.createRadialGradient(f[0], r.top + 4, 1, f[0], r.top + 4, 30); gr.addColorStop(0, 'rgba(255,190,90,0.5)'); gr.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = gr; ctx.fillRect(f[0] - 30, r.top - 26, 60, 60); }
      } });
    });
    if (map.crown) {
      const f = foot(map.crown[0], map.crown[1], 2);
      dyn.push({ depth: map.crown[0] + map.crown[1] + 0.6, draw: () => {
        const gr = ctx.createRadialGradient(f[0], f[1] - 14, 2, f[0], f[1] - 14, 34); gr.addColorStop(0, 'rgba(255,225,130,0.55)'); gr.addColorStop(1, 'rgba(255,225,130,0)'); ctx.fillStyle = gr; ctx.fillRect(f[0] - 34, f[1] - 48, 68, 68);
        W.drawSprite(ctx, { rows: W.SHAPES.crown, pal: { a: '#9C6A00', b: '#FFD166', c: '#FFF4C2', d: '#FF6B8A' } }, 2.4, f[0], f[1] - 4 + Math.sin(tNow / 400) * 2, { outline: true });
      } });
    }
    if (!sleeping) {
      helperList().forEach((hl) => {
        const f = foot(hl.p.x, hl.p.y, hl.p.h);
        const hp = hop[hl.id] && tNow - hop[hl.id] < 500 ? Math.sin(Math.PI * (tNow - hop[hl.id]) / 500) * 12 : 0;
        const hs = (st.helpers.find((h) => h.id === hl.id) || {}).stage || 1;
        const px = hs >= 2 ? 2.8 : 2.4;
        dyn.push({ depth: hl.p.x + hl.p.y + 0.5, draw: () => {
          ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(f[0], f[1] - 1, 10, 3, 0, 0, Math.PI * 2); ctx.fill();
          const r = W.drawSprite(ctx, W.SPR[hl.id], px, f[0], f[1] - 2 - hp + (hl.id === 'moosling' ? Math.sin(tNow / 300) : 0), { outline: true });
          if (hs >= 3) W.star(ctx, r.left + r.w + 2, r.top + 2, 2, '#FFD166');
        } });
      });
      const hp = heroAt();
      const step = lilo.seg ? (Math.floor(tNow / 115) % 2) + 1 : 0;
      const shake = lilo.busy && lilo.busy.kind === 'dig' ? Math.sin(tNow / 30) * 1.5 : 0;
      dyn.push({ depth: hp.depth, draw: () => W.drawHero(ctx, hp.sx + shake, hp.sy + 1, 48, st.stage || 0, st.settings.heroColor, { step, flip: lilo.flip }) });
    }
    dyn.sort((a, b) => a.depth - b.depth);
    // Blöcke und Figuren in einer Reihenfolge: zuerst alle Blöcke einer Tiefe, dann die Figuren dahinter
    let di = 0;
    const blocks = map.blocks;
    for (let i = 0; i < blocks.length; i++) {
      const c = blocks[i];
      const d = c[0] + c[1];
      while (di < dyn.length && dyn[di].depth < d) dyn[di++].draw();
      const p = cubeXY(c[0], c[1], c[2]);
      drawCube(p[0], p[1], TW, c[3]);
    }
    while (di < dyn.length) dyn[di++].draw();

    targets().forEach((tg) => drawTarget(tg, tNow));
    if (scene === 'hoehle') drawCaveLight(tNow, dpr, sc);
    if (scene === 'himmel') { const ex = foot(map.exit[0], map.exit[1], 1); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(ex[0] - 9, ex[1] - 20, 18, 14); ctx.fillStyle = '#7FC8FF'; ctx.fillRect(ex[0] - 3, ex[1] - 17, 6, 8); W.label(ctx, 'Wolkenlift', ex[0], ex[1] + 6, '#FFFFFF', 'center'); }

    // Bildschirm-Ebene: Tageszeit, Funken, Texte, Sprechblasen
    ctx.setTransform(sc * dpr, 0, 0, sc * dpr, 0, 0);
    if (scene === 'insel') {
      if (ph === 'abend') { ctx.fillStyle = 'rgba(255,130,60,0.10)'; ctx.fillRect(0, 0, LW, LH); }
      if (ph === 'nacht') {
        ctx.fillStyle = 'rgba(8,12,40,0.42)'; ctx.fillRect(0, 0, LW, LH);
        const w = cubeXY(6, 6, 1), ws = toScreen(w[0] + 10, w[1] + 22);
        const gr = ctx.createRadialGradient(ws[0], ws[1], 2, ws[0], ws[1], 30 * cam.z);
        gr.addColorStop(0, 'rgba(255,210,94,0.55)'); gr.addColorStop(1, 'rgba(255,210,94,0)');
        ctx.fillStyle = gr; ctx.fillRect(ws[0] - 40, ws[1] - 40, 80, 80);
        const r = cubeXY(5, 5, 3), rs = toScreen(r[0] + 30, r[1]);
        ctx.font = '700 13px Silkscreen, monospace'; ctx.fillStyle = '#E7E9F6';
        for (let i = 0; i < 3; i++) { const tt = ((tNow / 1400) + i / 3) % 1; ctx.globalAlpha = 1 - tt; ctx.fillText('z', rs[0] + tt * 18 + i * 3, rs[1] - tt * 40); }
        ctx.globalAlpha = 1;
      }
    }
    sparks = sparks.filter((s) => tNow - s.t < 900);
    sparks.forEach((s) => { const p = toScreen(s.x, s.y); const k = (tNow - s.t) / 900; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + s.t; ctx.fillStyle = i % 2 ? '#FFD166' : '#FFFFFF'; ctx.globalAlpha = 1 - k; ctx.fillRect(p[0] + Math.cos(a) * k * 26, p[1] + Math.sin(a) * k * 18 - k * 10, 3, 3); } ctx.globalAlpha = 1; });
    floaters = floaters.filter((f) => tNow - f.t < 1500);
    floaters.forEach((f) => { const p = toScreen(f.x, f.y); const k = (tNow - f.t) / 1500; ctx.globalAlpha = 1 - k * k; W.label(ctx, f.text, p[0], p[1] - k * 34, f.color || '#FFD166', 'center'); ctx.globalAlpha = 1; });
    bubbles = bubbles.filter((b) => tNow < b.until);
    bubbles.forEach(drawBubble);
    if (locked) drawLocked();
  }

  function drawBackground(ph) {
    const iso = (list, ox, oy, w, a) => list.slice().sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]) || p[2] - q[2]).forEach((c) => drawCube(ox + (c[0] - c[1]) * w / 2, oy + (c[0] + c[1]) * w / 4 - c[2] * w / 2, w, c[3], a));
    const far = []; for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) { far.push([x, y, 0, 'grass'], [x, y, -1, 'dirt']); } far.push([1, 1, -2, 'stone'], [1, 1, 1, 'crystal'], [1, 1, 2, 'crystal']);
    iso([[0, 0, 0, 'cloudw'], [1, 0, 0, 'cloudw'], [0, 1, 0, 'cloudw'], [1, 1, 0, 'cloudw'], [2, 1, 0, 'cloudw'], [1, 2, 0, 'cloudw']], BG.himmel[0], BG.himmel[1], 16, 0.45);
    const cloud = [];
    for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) cloud.push([x, y, 0, 'cloud']);
    cloud.push([1, 0, 1, 'cloud'], [0, 0, 1, 'cloud']);
    iso(cloud, BG.boss[0], BG.boss[1] + 40, 26, 1);
    const b = st.boss || {};
    const bob = b.defeated || b.waiting ? 0 : Math.sin(now() / 500) * 2;
    W.drawSprite(ctx, W.SPR.golem, 4, BG.boss[0] + 13, BG.boss[1] + 50 + bob, { grey: !!(b.defeated || b.waiting), alpha: b.defeated || b.waiting ? 0.7 : 1, outline: true });
    W.label(ctx, b.waiting ? 'Sturm-Golem · ab Montag' : b.defeated ? 'Boss besiegt!' : 'Sturm-Golem · ' + (b.left != null ? b.left : Math.max(0, (b.hp || 0) - (b.dmg || 0))) + ' LP', BG.boss[0] + 13, BG.boss[1] + 96, b.defeated ? '#7BC96F' : '#FFD166', 'center');
    if (!st.built.kristallinsel) { const k = cubeXY(-9, 4, 3); W.label(ctx, 'Kristallinsel · Lvl ' + st.stages[1], k[0] + TW / 2, k[1] - 6, '#C7BEFF', 'center'); }
    W.label(ctx, st.built.himmelsinsel ? 'Himmelsinsel' : 'Finale · Lvl ' + st.stages[2], BG.himmel[0] + 8, BG.himmel[1] - 22, '#FFFFFF', 'center');
  }

  function drawItem(it, f, bob) {
    const y = f[1] - 10 + bob;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(f[0], f[1] - 1, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    if (it.res === 'truhe') { drawCube(f[0] - 11, f[1] - 18, 22, 'chest'); if (it.extra) W.label(ctx, '×' + (it.extra + 1), f[0], f[1] - 36, '#FFD166', 'center'); return; }
    if (it.res === 'schluessel') { const gl = ctx.createRadialGradient(f[0], y - 6, 1, f[0], y - 6, 16); gl.addColorStop(0, 'rgba(255,209,102,0.7)'); gl.addColorStop(1, 'rgba(255,209,102,0)'); ctx.fillStyle = gl; ctx.fillRect(f[0] - 16, y - 22, 32, 32); W.drawSprite(ctx, W.SPR.key, 2, f[0] + 2, y, { outline: true }); return; }
    drawCube(f[0] - 7, y - 14, 14, it.res === 'holz' ? 'log' : 'stone');
    drawCube(f[0] - 2, y - 18, 10, it.res === 'holz' ? 'log' : 'stone');
    W.label(ctx, '×' + it.n, f[0], f[1] - 42, '#FFFFFF', 'center');
  }

  function targets() {
    if (scene !== 'insel' || phase() === 'nacht' || !st.nextBuild || locked) return [];
    const nb = st.nextBuild, out = [];
    if (nb.id === 'leiter') out.push({ obj: 'leiter', ready: nb.crafted });
    if (nb.id === 'hoehle') out.push({ obj: 'hoehle', ready: nb.crafted && nb.levelOk });
    if (!nb.crafted && nb.stockOk && nb.recipe) out.push({ obj: 'werkbank', ready: true, mark: true });
    if (st.built.hoehle && (st.field.chests || st.field.key)) out.push({ obj: 'hoehle', ready: true, cave: true });
    if (nb.id === 'kristallinsel' && (st.stage || 0) >= 2 && st.keyHave) out.push({ obj: 'flug', ready: true, at: foot(0, 7, 1) });
    if (nb.id === 'bruecke') out.push({ obj: 'bruecke', ready: nb.crafted, ghost: true });
    if (nb.id === 'himmelsinsel' && (st.stage || 0) >= 3) { const f = foot(2, 6, 1); out.push({ obj: 'wispel', ready: true, at: [f[0], f[1] - 36] }); }
    return out;
  }
  function faceQuad(obj) {
    const o = map.objects[obj];
    const [x, y] = o.tile;
    const top = cubeXY(x, y, o.z ? o.z[1] : 1), bot = cubeXY(x, y, o.z ? o.z[0] : 1);
    return [[top[0], top[1] + TW * 0.25], [top[0] + TW / 2, top[1] + TW * 0.5], [bot[0] + TW / 2, bot[1] + TW], [bot[0], bot[1] + TW * 0.75]];
  }
  function drawTarget(tg, tNow) {
    const pulse = 0.5 + 0.5 * Math.sin(tNow / 260);
    if (tg.at) { drawMark(tg.at[0], tg.at[1] - 40 - pulse * 4); return; }
    if (tg.ghost) {
      map.objects.bruecke.tiles.forEach(([x, y]) => { const p = cubeXY(x, y, 0); drawCube(p[0], p[1], TW, 'bridge', tg.ready ? 0.35 + pulse * 0.3 : 0.18); });
      if (tg.ready) { const p = cubeXY(-2, 7, 0); drawMark(p[0], p[1] - 4 - pulse * 4); }
      return;
    }
    if (tg.mark) {
      const p = cubeXY(map.objects[tg.obj].tile[0], map.objects[tg.obj].tile[1], 1);
      drawMark(p[0] + TW / 2, p[1] - 12 - pulse * 4);
      return;
    }
    const q = faceQuad(tg.obj);
    if (!tg.cave) {
      ctx.save();
      ctx.lineWidth = 2.5; ctx.strokeStyle = tg.ready ? 'rgba(255,209,102,' + (0.5 + pulse * 0.5) + ')' : 'rgba(255,255,255,' + (0.25 + pulse * 0.25) + ')';
      ctx.setLineDash(tg.ready ? [] : [4, 4]);
      ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); ctx.stroke();
      if (tg.ready) { ctx.fillStyle = 'rgba(255,209,102,' + (0.12 + pulse * 0.12) + ')'; ctx.fill(); }
      ctx.restore();
    }
    if (tg.ready) drawMark((q[0][0] + q[1][0]) / 2, q[0][1] - 10 - pulse * 4);
  }
  function drawMark(x, y) {
    ctx.fillStyle = '#141622'; ctx.fillRect(x - 6, y - 16, 12, 18);
    ctx.fillStyle = '#FFD166'; ctx.fillRect(x - 4, y - 14, 8, 9); ctx.fillRect(x - 4, y - 3, 8, 3);
  }

  function drawCaveLight(tNow, dpr, sc) {
    const lc = G._light || (G._light = document.createElement('canvas'));
    lc.width = canvas.width; lc.height = canvas.height;
    const g = lc.getContext('2d');
    g.setTransform(ctx.getTransform());
    const b = worldBounds();
    g.fillStyle = 'rgba(4,5,12,0.72)'; g.fillRect(b.minX - 400, b.minY - 400, (b.maxX - b.minX) + 800, (b.maxY - b.minY) + 800);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r) => { const gr = g.createRadialGradient(x, y, r * 0.15, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };
    const hp = heroAt(); hole(hp.sx, hp.sy - 22, 66 + Math.sin(tNow / 400) * 2);
    const fp = helperPos('funkel'); if (fp) { const f = foot(fp.x, fp.y, fp.h); hole(f[0], f[1] - 14, 96 + Math.sin(tNow / 230) * 5); }
    map.lights.forEach((l) => { const p = cubeXY(l[0], l[1], l[2]); hole(p[0] + TW / 2, p[1] + TW / 2, l[3]); });
    const ex = foot(map.exit[0], map.exit[1], 1); hole(ex[0], ex[1] - 6, 50);
    if (st.field.key) { const k = foot(map.keySpot[0], map.keySpot[1], 1); hole(k[0], k[1] - 10, 36); }
    g.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lc, 0, 0); ctx.restore();
    W.label(ctx, 'Ausgang', ex[0], ex[1] - 30, '#FFE7A0', 'center');
  }

  function wrap(text, max) {
    ctx.font = '600 13px Lexend, system-ui, sans-serif';
    const words = text.split(' '), lines = [];
    let cur = '';
    words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function anchorOf(b) {
    let w;
    if (b.who === 'lilo') { const hp = heroAt(); w = [hp.sx, hp.sy - 52]; }
    else if (b.who === 'house') { const p = cubeXY(5, 6, 3); w = [p[0] + TW / 2, p[1] - 4]; }
    else { const hp = helperPos(b.who); w = hp ? (() => { const f = foot(hp.x, hp.y, hp.h); return [f[0], f[1] - 34]; })() : [cam.x, cam.y]; }
    return toScreen(w[0], w[1]);
  }
  function drawBubble(b) {
    const a = anchorOf(b);
    const lines = wrap(b.text, 200);
    const w = Math.max.apply(null, lines.map((l) => ctx.measureText(l).width)) + 34, h = lines.length * 17 + 14;
    const x = Math.max(6, Math.min(LW - w - 6, a[0] - w / 2));
    let y = a[1] - h - 10;
    const below = y < 4;
    if (below) y = Math.min(LH - h - 6, a[1] + 64);
    ctx.fillStyle = '#141622'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
    const tx = Math.max(x + 10, Math.min(x + w - 10, a[0]));
    if (!below) { ctx.beginPath(); ctx.moveTo(tx - 7, y + h); ctx.lineTo(tx + 7, y + h); ctx.lineTo(tx, y + h + 8); ctx.fill(); }
    ctx.fillStyle = '#1A1D29'; ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + 11, y + 8 + i * 17));
    ctx.fillStyle = '#8A8FA8'; ctx.fillText('×', x + w - 15, y + 5);
    ctx.textBaseline = 'alphabetic';
    b.rect = [x - 4, y - 4, w + 8, h + 14];
  }
  function drawLocked() {
    ctx.fillStyle = 'rgba(10,12,24,0.66)'; ctx.fillRect(0, 0, LW, LH);
    const lines = ['Inselzeit für heute vorbei', 'Morgen geht es weiter.', 'Quests und Training gehen trotzdem.'];
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD166'; ctx.font = '700 17px Silkscreen, monospace'; ctx.fillText(lines[0], LW / 2, LH / 2 - 12);
    ctx.fillStyle = '#E7E9F6'; ctx.font = '600 14px Lexend, system-ui, sans-serif';
    ctx.fillText(lines[1], LW / 2, LH / 2 + 14); ctx.fillText(lines[2], LW / 2, LH / 2 + 34);
    ctx.textAlign = 'start';
  }

  /* ---------- Antippen und Ziehen ---------- */
  function hitTile(wx, wy) {
    const list = [];
    Object.keys(map.col).forEach((k) => { const [x, y] = k.split(',').map(Number); list.push([x, y, map.col[k].h]); });
    list.sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]) || b[2] - a[2]);
    for (const [x, y, h] of list) {
      const c = foot(x, y, h);
      if (Math.abs(wx - c[0]) / (TW / 2) + Math.abs(wy - c[1]) / (TW / 4) <= 1) return { x, y };
    }
    return null;
  }
  function inQuad(q, px, py) {
    let inside = false;
    for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
      const xi = q[i][0], yi = q[i][1], xj = q[j][0], yj = q[j][1];
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function logical(ev) {
    const r = canvas.getBoundingClientRect();
    return [(ev.clientX - r.left) * LW / r.width, (ev.clientY - r.top) * LH / r.height];
  }
  function onTap(ev) {
    if (!map || !st) return;
    const [sx, sy] = logical(ev);
    if (locked) { cb.lockedTap && cb.lockedTap(); return; }
    // Sprechblasen: Antippen schliesst sie, jedes andere Antippen räumt sie ebenfalls weg
    const hitB = bubbles.find((b) => b.rect && sx >= b.rect[0] && sx <= b.rect[0] + b.rect[2] && sy >= b.rect[1] && sy <= b.rect[1] + b.rect[3]);
    bubbles = [];
    if (hitB) { kick(); return; }
    const [px, py] = toWorld(sx, sy);
    if (scene === 'insel' && phase() === 'nacht') { say('house', 'Alle schlafen im Haus. Gute Nacht! Am Morgen geht es weiter.'); return; }
    if (lilo.busy) return;
    cam.follow = true;
    let best = null, bd = 1e9;
    for (const it of itemsHere()) {
      const f = foot(it.x, it.y, colOf(it.x, it.y).h);
      if (px > f[0] - 16 && px < f[0] + 16 && py > f[1] - 44 && py < f[1] + 6) { const d = Math.hypot(px - f[0], py - (f[1] - 12)); if (d < bd) { bd = d; best = it; } }
    }
    if (best) { walkTo(best.x, best.y, { kind: 'pick', it: best }); return; }
    const tapHelperOrLilo = () => {
      for (const hl of helperList()) {
        const f = foot(hl.p.x, hl.p.y, hl.p.h);
        if (px > f[0] - 18 && px < f[0] + 18 && py > f[1] - 36 && py < f[1] + 4) { tapHelper(hl.id); return true; }
      }
      const hp = heroAt();
      if (px > hp.sx - 16 && px < hp.sx + 16 && py > hp.sy - 50 && py < hp.sy + 2) { say('lilo', cb.hint ? cb.hint() : 'Los geht\'s!'); return true; }
      return false;
    };
    if (scene === 'insel') {
      for (const obj of ['leiter', 'hoehle']) if (inQuad(faceQuad(obj), px, py)) { tapObject(obj); return; }
      const sign = foot(11, 4, 1);
      if (Math.abs(px - sign[0]) < 16 && py > sign[1] - 22 && py < sign[1] + 2) { tapObject('hoehle'); return; }
      for (const obj of ['vorrat', 'werkbank']) {
        const p = cubeXY(map.objects[obj].tile[0], map.objects[obj].tile[1], 1);
        if (px > p[0] && px < p[0] + TW && py > p[1] - 8 && py < p[1] + TW) { tapObject(obj); return; }
      }
      const roof = cubeXY(5, 5, 3), base = cubeXY(6, 6, 1);
      if (px > roof[0] - 4 && px < base[0] + TW + 4 && py > roof[1] && py < base[1] + TW) { tapObject('door'); return; }
      if (tapHelperOrLilo()) return;
      if (Math.abs(px - (BG.kristall[0] + 9)) < 60 && Math.abs(py - (BG.kristall[1] + 20)) < 50) { say('lilo', 'Die Kristallinsel erreichst du ab Level ' + st.stages[1] + ' mit dem Gleitflügel. Der Flug kommt in der nächsten Version.'); return; }
      if (Math.abs(px - (BG.boss[0] + 13)) < 60 && Math.abs(py - (BG.boss[1] + 40)) < 60) { cb.boss && cb.boss(); return; }
    } else {
      const ex = foot(map.exit[0], map.exit[1], 1);
      if (Math.abs(px - ex[0]) < 26 && py > ex[1] - 44 && py < ex[1] + (scene === 'himmel' ? 24 : 8)) { walkTo(map.exit[0], map.exit[1], { kind: 'exit' }); return; }
      if (tapHelperOrLilo()) return;
    }
    if (scene === 'insel' && !st.built.bruecke) {
      for (const [x, y] of map.objects.bruecke.tiles) { const c = foot(x, y, 1); if (Math.abs(px - c[0]) / (TW / 2) + Math.abs(py - c[1]) / (TW / 4) <= 1.2) { tapObject('bruecke'); return; } }
    }
    const t = hitTile(px, py);
    if (t && colOf(t.x, t.y).kristall && !st.built.kristallinsel) { tapObject('flug'); return; }
    if (t && colOf(t.x, t.y).walk) walkTo(t.x, t.y, null);
  }

  let drag = null;
  function onDown(ev) {
    drag = { x: ev.clientX, y: ev.clientY, cx: cam.x, cy: cam.y, moved: false, id: ev.pointerId };
  }
  function onMove(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const r = canvas.getBoundingClientRect();
    const dx = (ev.clientX - drag.x) * LW / r.width, dy = (ev.clientY - drag.y) * LH / r.height;
    if (!drag.moved && Math.hypot(dx, dy) > 8) { drag.moved = true; try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } }
    if (drag.moved) {
      cam.x = drag.cx - dx / cam.z; cam.y = drag.cy - dy / cam.z; cam.follow = false;
      clampCam(); kick();
    }
  }
  function onUp(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    if (!moved) onTap(ev);
  }
  function onCancel() { drag = null; }

  function tapHelper(id) {
    hop[id] = now();
    if (id === 'wispel' && scene === 'insel') {
      if ((st.stage || 0) >= 3 || st.built.himmelsinsel) { say('wispel', 'Steig auf! Ich trage dich zur Himmelsinsel.', 1800); walkTo(2, 7, { kind: 'lift' }); return; }
    }
    if (id === 'wispel' && scene === 'himmel') { say('wispel', 'Wenn du zurück willst, tippe auf den Wolkenlift.'); return; }
    const ph = phase();
    const list = TIPS[id] || ['Hallo!'];
    let text;
    if (ph === 'abend' && id !== 'funkel') text = EVENING;
    else { G._tipN = (G._tipN || 0) + 1; text = list[(G._tipN + new Date().getDate()) % list.length]; }
    if (id === 'funkel' && (st.field.chests || st.field.key)) text = scene === 'hoehle' ? (st.field.key ? 'Ich habe den Kristall-Schlüssel gefunden! Hol ihn dir.' : 'Da liegt eine Truhe! Lauf hin und öffne sie.') : 'Ich habe in der Höhle etwas gefunden! Komm mit hinein.';
    say(id, text);
  }

  function tapObject(obj) {
    const o = map.objects[obj];
    const nb = st.nextBuild || {};
    if (obj === 'flug') {
      if (st.built.kristallinsel) { walkTo(-4, 7, null); return; }
      if (!st.built.hoehle) { say('lilo', 'Die Kristallinsel! Dorthin komme ich erst später. Zuerst die Höhle.'); return; }
      if ((st.stage || 0) < 2) { say('lilo', 'Bis zur Kristallinsel ist es zu weit zum Springen. Mit dem Gleitflügel ab Level ' + st.stages[1] + ' klappt es.'); return; }
      if (!st.keyHave) { say('lilo', st.keyFound ? 'Der Kristall-Schlüssel liegt noch in der Höhle. Den hole ich zuerst!' : 'Ich brauche den Kristall-Schlüssel. Funkel sucht ihn in der Höhle.'); return; }
      walkTo(0, 7, { kind: 'jump' });
      return;
    }
    if (obj === 'bruecke') {
      if (st.built.bruecke) { walkTo(-4, 7, null); return; }
      if (nb.id === 'bruecke' && nb.crafted) { walkTo(o.stand[0], o.stand[1], { kind: 'place', id: 'bruecke' }); return; }
      say('lilo', st.built.kristallinsel ? 'Hier fehlt eine Brücke. Stelle sie in der Werkbank aus Holz her.' : 'Bis zur Kristallinsel ist es zu weit zum Springen.');
      return;
    }
    if (obj === 'wispel') { tapHelper('wispel'); return; }
    if (obj === 'vorrat' || obj === 'werkbank' || obj === 'door') {
      walkTo(o.stand[0], o.stand[1], { kind: 'panel', panel: obj === 'werkbank' ? 'werkbank' : 'vorrat' });
      return;
    }
    if (obj === 'leiter') {
      if (st.built.leiter) { walkTo(8, 2, null); return; }
      if (nb.id === 'leiter' && nb.crafted) { walkTo(o.stand[0], o.stand[1], { kind: 'place', id: 'leiter' }); return; }
      say('lilo', 'Hier fehlt eine Leiter. Stelle sie in der Werkbank aus Holz her.');
      return;
    }
    if (obj === 'hoehle') {
      if (st.built.hoehle) { walkTo(o.stand[0], o.stand[1], { kind: 'enter' }); return; }
      if (!st.built.leiter) { say('lilo', 'Hier ist der Eingang zur Höhle, aber er ist verschüttet. Zuerst baue ich die Leiter auf den Berg.'); return; }
      if (!nb.levelOk) { say('lilo', 'Hier ist die Höhle! Zum Graben brauche ich die Schaufel. Die gibt es ab Level ' + st.stages[0] + '.'); return; }
      if (!nb.crafted) { say('lilo', 'Hier ist die Höhle! Ohne Stützbogen stürzt der Gang ein. Stelle ihn in der Werkbank aus Stein her.'); return; }
      walkTo(o.stand[0], o.stand[1], { kind: 'place', id: 'hoehle' });
    }
  }

  /* ---------- Bewegung ---------- */
  function walkTo(x, y, act) {
    if (locked) return;
    const from = lilo.seg ? [lilo.seg.tx, lilo.seg.ty] : [lilo.x, lilo.y];
    const p = findPath(from[0], from[1], x, y);
    if (p === null) { say('lilo', 'Da komme ich nicht hin.'); return; }
    lilo.path = p; lilo.act = act;
    if (!p.length && !lilo.seg) arrive();
    kick();
  }
  G.walkToObject = (obj) => { if (map && map.objects[obj] && !locked) { cam.follow = true; tapObject(obj); } };

  function advance(tNow) {
    if (lilo.seg) {
      if (tNow - lilo.seg.t0 < lilo.seg.dur) return;
      lilo.x = lilo.seg.tx; lilo.y = lilo.seg.ty; lilo.h = lilo.seg.th; lilo.seg = null;
      if (!lilo.path.length) { arrive(); return; }
    }
    if (lilo.path.length && !locked) {
      const n = lilo.path.shift();
      const th = colOf(n.x, n.y).h;
      const a = foot(lilo.x, lilo.y, lilo.h), b = foot(n.x, n.y, th);
      if (b[0] !== a[0]) lilo.flip = b[0] < a[0];
      lilo.seg = { fx: lilo.x, fy: lilo.y, fh: lilo.h, tx: n.x, ty: n.y, th, t0: tNow, dur: n.type === 'ladder' ? LADDER_MS : n.type === 'glide' ? GLIDE_MS : STEP_MS, ladder: n.type === 'ladder', glide: n.type === 'glide' };
    }
  }

  function arrive() {
    const act = lilo.act; lilo.act = null;
    if (!act || locked) return;
    const f = foot(lilo.x, lilo.y, lilo.h);
    if (act.kind === 'pick') {
      const it = act.it;
      if (it.res === 'holz' || it.res === 'stein') {
        const n = piles[it.res] ? piles[it.res][it.pile] : it.n;
        if (!n) return;
        piles[it.res][it.pile] = 0;
        cb.collect(it.res, n);
        floaters.push({ text: '+' + n + (it.res === 'holz' ? ' Holz' : ' Stein'), x: f[0], y: f[1] - 56, t: now() });
      } else if (it.res === 'truhe') {
        cb.collect('truhe', 1);
        floaters.push({ text: '+5 Holz · +5 Stein', x: f[0], y: f[1] - 56, t: now() });
      } else if (it.res === 'schluessel') {
        cb.collect('schluessel', 1);
      }
      sparks.push({ x: f[0], y: f[1] - 16, t: now() });
    } else if (act.kind === 'panel') {
      cb.openPanel(act.panel);
    } else if (act.kind === 'jump') {
      lilo.path = [{ x: -4, y: 7, type: 'glide' }]; lilo.act = { kind: 'landed' };
      say('lilo', 'Los gehts!', 1200);
    } else if (act.kind === 'landed') {
      sparks.push({ x: f[0], y: f[1] - 16, t: now() });
      if (!st.built.kristallinsel) cb.build('kristallinsel');
    } else if (act.kind === 'lift') {
      lilo.busy = { kind: 'lift', t: now() };
      hop.wispel = now();
      setTimeout(() => {
        lilo.busy = null;
        const first = !st.built.himmelsinsel;
        setScene('himmel');
        if (first) { lilo.busy = { kind: 'tour', t: now() }; setTimeout(() => { lilo.busy = null; cb.build('himmelsinsel'); }, 3200); }
      }, 1400);
    } else if (act.kind === 'place') {
      lilo.busy = { kind: act.id === 'hoehle' ? 'dig' : 'build', t: now() };
      lilo.flip = false;
      const q = act.id === 'bruecke' ? (() => { const a = foot(-3, 7, 1), b = foot(-1, 7, 1); return [a, a, b, b]; })() : faceQuad(act.id);
      const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2;
      const dur = act.id === 'hoehle' ? 1400 : 900;
      for (let i = 0; i < 3; i++) setTimeout(() => sparks.push({ x: cx, y: cy, t: now() }), i * (dur / 3));
      setTimeout(() => { lilo.busy = null; cb.build(act.id); }, dur);
    } else if (act.kind === 'enter') {
      setScene('hoehle');
    } else if (act.kind === 'exit') {
      G.leave();
    }
  }

  function say(who, text, ms) {
    bubbles = bubbles.filter((b) => b.who !== who);
    bubbles.push({ who, text, until: now() + (ms || Math.min(4500, Math.max(2200, 1600 + text.length * 40))) });
    kick();
  }
  G.say = say;

  /* ---------- Szene ---------- */
  function setScene(s) {
    scene = s;
    map = s === 'hoehle' ? caveMap() : s === 'himmel' ? skyMap() : islandMap();
    lilo.path = []; lilo.seg = null; lilo.act = null;
    const sp = map.start; lilo.x = sp[0]; lilo.y = sp[1]; lilo.h = colOf(sp[0], sp[1]).h;
    bubbles = [];
    resetCam();
    if (s === 'hoehle') setTimeout(() => say('funkel', (st.field.chests || st.field.key) ? (st.field.key ? 'Willkommen in der Leuchtgrotte! Da glitzert etwas.' : 'Willkommen in der Leuchtgrotte! Ich habe Truhen gefunden.') : 'Willkommen in der Leuchtgrotte! Für jede 15. Quest finde ich eine Truhe.'), 300);
    cb.scene && cb.scene(s);
  }
  G.setScene = setScene;
  G.scene = () => scene;
  G.leave = function () {
    if (scene === 'insel') return;
    const from = scene;
    setScene('insel');
    const o = from === 'himmel' ? map.objects.wispel : map.objects.hoehle; lilo.x = o.stand[0]; lilo.y = o.stand[1]; lilo.h = 1;
    if (cam.near) resetCam();
  };
  G.toggleZoom = function () { cam.near = !cam.near; cam.follow = true; resetCam(); kick(); return cam.near; };
  G.isNear = () => cam.near;

  /* ---------- Schleife ---------- */
  let lastDraw = 0;
  function loop(t) {
    if (!running) return;
    const tn = now();
    advance(tn);
    // Im Ruhezustand nur etwa 12 Bilder pro Sekunde zeichnen (spart Akku)
    const busy = lilo.seg || lilo.busy || drag || bubbles.length || floaters.length || sparks.length || Object.keys(hop).some((k) => tn - hop[k] < 600);
    if (busy || tn - lastDraw > 80) { drawFrame(); lastDraw = tn; }
    const mz = Math.floor(t / 7000);
    if (mz !== G._mz) { G._mz = mz; mooslingAt++; hop.moosling = tn; }
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (running && !raf) raf = requestAnimationFrame(loop); }

  G.mount = function (cv, callbacks) {
    canvas = cv; ctx = cv.getContext('2d'); cb = callbacks || {};
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    running = true; raf = null; kick();
  };
  G.unmount = function () {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (canvas) {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
    }
    canvas = null; drag = null;
  };
  G.update = function (state) {
    const first = !st;
    st = state;
    const want = (scene === 'hoehle' && !st.built.hoehle) ? 'insel' : scene;
    const nm = want === 'hoehle' ? caveMap() : want === 'himmel' ? skyMap() : islandMap();
    if (first || want !== scene) { scene = want; map = nm; const sp = map.start; lilo.x = sp[0]; lilo.y = sp[1]; lilo.h = colOf(sp[0], sp[1]).h; resetCam(); }
    else { map = nm; if (!colOf(lilo.x, lilo.y)) { lilo.x = map.start[0]; lilo.y = map.start[1]; lilo.h = 1; } }
    if (phase() === 'nacht' && scene !== 'insel') setScene('insel');
    clampCam();
    kick();
  };
  G.reset = function () { st = null; scene = 'insel'; bubbles = []; floaters = []; sparks = []; delete piles.holz; delete piles.stein; };
  G.debug = () => ({ scene, lilo: { x: lilo.x, y: lilo.y, h: lilo.h, moving: !!lilo.seg, busy: !!lilo.busy }, drops: drops().map((d) => d.res + d.n), phase: phase(), cam: { x: Math.round(cam.x), y: Math.round(cam.y), z: +cam.z.toFixed(2), near: cam.near }, locked });
  // Für Tests: Antippen an logischer Bildschirmstelle; Bildschirmstelle eines Feldes oder Objekts
  G.tapAt = function (lx, ly) { const r = canvas.getBoundingClientRect(); onTap({ clientX: r.left + lx * r.width / LW, clientY: r.top + ly * r.height / LH }); };
  G.screenOf = function (x, y) { const c = colOf(x, y); const f = foot(x, y, c ? c.h : 1); const s = toScreen(f[0], f[1]); return { x: s[0], y: s[1], z: cam.z }; };
  G.objectPoint = function (obj) {
    let w;
    if (obj === 'leiter' || obj === 'hoehle') { const q = faceQuad(obj); w = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]; }
    else if (map.objects[obj].tile) { const p = cubeXY(map.objects[obj].tile[0], map.objects[obj].tile[1], 1); w = [p[0] + TW / 2, p[1] + TW / 2]; }
    else { const t = obj === 'bruecke' ? [-2, 7] : obj === 'flug' ? [-6, 7] : [2, 6]; w = foot(t[0], t[1], 1); }
    const s = toScreen(w[0], w[1]); return { x: s[0], y: s[1] };
  };
  G.LW = LW; G.LH = LH;
  G._dbg = { findPath: (a, b, c, d) => findPath(a, b, c, d), hit: (sx, sy) => { const w = toWorld(sx, sy); return hitTile(w[0], w[1]); }, links: () => map.links, col: (x, y) => colOf(x, y) };
})(typeof window !== 'undefined' ? window : globalThis);
