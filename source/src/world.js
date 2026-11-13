/* Trocken-Quest – Blockwelt (isometrisch, Canvas) und Pixel-Sprites */
(function (root) {
  'use strict';

  /* ---------- Farben / Texturen ---------- */
  const TEX = {
    grass:   { t: '#62B53A', l: '#7A4F33', r: '#5E3C26', band: ['#56A532', '#468A28'], st: ['#86D65C', '#4E9A2C'], sl: '#5E3C26', sr: '#4A2F1D' },
    dirt:    { t: '#8B5A3C', l: '#7A4F33', r: '#5E3C26', sl: '#5E3C26', sr: '#4A2F1D' },
    stone:   { t: '#999999', l: '#828282', r: '#666666', st: ['#B0B0B0', '#7A7A7A'], sl: '#6A6A6A', sr: '#4F4F4F' },
    log:     { t: '#C9A06A', l: '#6B4A2B', r: '#553A21', vstripe: ['#5A3C22', '#46301B'], ring: '#8F6A3E' },
    leaves:  { t: '#5DB04A', l: '#4A963A', r: '#367A2B', st: ['#7CCB5F', '#3E8A2E'], sl: '#2F6B22', sr: '#25561B' },
    planks:  { t: '#D9B486', l: '#C69C6D', r: '#A47A4C', hstripe: ['#B8925F', '#A47A4C', '#86613A'] },
    door:    { t: '#D9B486', l: '#C69C6D', r: '#A47A4C', hstripe: ['#B8925F', '#A47A4C', '#86613A'], door: true },
    win:     { t: '#D9B486', l: '#C69C6D', r: '#A47A4C', hstripe: ['#B8925F', '#A47A4C', '#86613A'], window: true },
    roof:    { t: '#B5473A', l: '#9E3D31', r: '#7A2E25', hstripe: ['#8C3B2E', '#7A2E25', '#5E231C'] },
    water:   { t: '#4FA3E0', l: '#3A86C4', r: '#2F6FA6', st: ['#BDE6FF', '#3A86C4'] },
    sand:    { t: '#E8D39A', l: '#CDB57C', r: '#B39B64', st: ['#F3E2B3', '#C9AE70'] },
    crystal: { t: '#E2DCFF', l: '#B3A8FF', r: '#6C5CE7', band: ['#9B8CFF', '#6C5CE7'] },
    cloud:   { t: '#8A91A8', l: '#6B7289', r: '#535A6E' },
    cloudw:  { t: '#FFFFFF', l: '#E3EAF2', r: '#C9D3DE' },
    cave:    { t: '#8B5A3C', l: '#7A4F33', r: '#5E3C26', sl: '#5E3C26', sr: '#4A2F1D', cave: 'closed' },
    caveLit: { t: '#8B5A3C', l: '#7A4F33', r: '#5E3C26', sl: '#5E3C26', sr: '#4A2F1D', cave: 'open' },
    ladder:  { t: '#999999', l: '#828282', r: '#666666', st: ['#B0B0B0', '#7A7A7A'], sl: '#6A6A6A', sr: '#4F4F4F', ladder: true },
    crack:   { t: '#999999', l: '#828282', r: '#666666', st: ['#B0B0B0', '#7A7A7A'], sl: '#6A6A6A', sr: '#4F4F4F', crack: true },
    winLit:  { t: '#D9B486', l: '#C69C6D', r: '#A47A4C', hstripe: ['#B8925F', '#A47A4C', '#86613A'], window: 'lit' },
    chest:   { t: '#B07A3E', l: '#9A6630', r: '#7C5022', chest: true },
    werkbank:{ t: '#C69C6D', l: '#9A6E42', r: '#7C5530', bench: true },
    stoneDark: { t: '#4A4E5C', l: '#3A3D49', r: '#2C2F39', st: ['#5C6172', '#33363F'], sl: '#2E3039', sr: '#23252D' },
    cobble:  { t: '#5A5E6E', l: '#4A4D5A', r: '#3A3C47', st: ['#6E7385', '#3E414C'], sl: '#363844', sr: '#2A2C35', ore: false },
    ore:     { t: '#5A5E6E', l: '#4A4D5A', r: '#3A3C47', st: ['#6E7385', '#3E414C'], sl: '#363844', sr: '#2A2C35', ore: true },
    crystalGrass: { t: '#7FCFC0', l: '#7A4F33', r: '#5E3C26', band: ['#6CBFAF', '#58A898'], st: ['#C2F2E9', '#4FA595'], sl: '#5E3C26', sr: '#4A2F1D' },
    bridge:  { t: '#C69C6D', l: '#8B5A3C', r: '#6B4A2B', hstripe: ['#A47A4C', '#6B4A2B', '#5A3C22'] },
    glow:    { t: '#FFB347', l: '#E8590C', r: '#B8430A', st: ['#FFE29A', '#E8590C'], sl: '#9C3A08', sr: '#7A2D06' }
  };

  // Eckpunkte der drei Flächen (relativ zur Würfelgrösse) als Ursprung + u-Achse + v-Achse
  const FACES = {
    t: { o: [0, 0.25], u: [0.5, -0.25], v: [0.5, 0.25] },
    l: { o: [0, 0.25], u: [0.5, 0.25], v: [0, 0.5] },
    r: { o: [0.5, 0.5], u: [0.5, -0.25], v: [0, 0.5] }
  };
  const SPECKS = [[0.22, 0.3], [0.62, 0.2], [0.35, 0.72], [0.78, 0.62]];

  function quad(ctx, x, y, W, f, u0, v0, u1, v1, color) {
    const p = (u, v) => [x + (f.o[0] + u * f.u[0] + v * f.v[0]) * W, y + (f.o[1] + u * f.u[1] + v * f.v[1]) * W];
    const a = p(u0, v0), b = p(u1, v0), c = p(u1, v1), d = p(u0, v1);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  }

  function cube(ctx, x, y, W, type, alpha) {
    const T = TEX[type] || TEX.dirt;
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    ['t', 'l', 'r'].forEach((side) => {
      const f = FACES[side];
      quad(ctx, x, y, W, f, 0, 0, 1, 1, T[side]);
      if (side !== 't' && T.band) quad(ctx, x, y, W, f, 0, 0, 1, 0.42, T.band[side === 'l' ? 0 : 1]);
      if (side === 't' && T.st && W >= 14) SPECKS.forEach((s, i) => quad(ctx, x, y, W, f, s[0], s[1], s[0] + 0.1, s[1] + 0.1, T.st[i % 2]));
      if (side !== 't' && (T.sl || T.sr) && W >= 14) SPECKS.slice(0, 2).forEach((s) => quad(ctx, x, y, W, f, s[0], s[1] + 0.25, s[0] + 0.1, s[1] + 0.35, side === 'l' ? T.sl : T.sr));
      if (T.hstripe && W >= 14) for (let v = 0.25; v < 1; v += 0.25) quad(ctx, x, y, W, f, 0, v, 1, v + 0.05, T.hstripe[side === 't' ? 0 : side === 'l' ? 1 : 2]);
      if (T.vstripe && side !== 't') for (let u = 0.2; u < 1; u += 0.3) quad(ctx, x, y, W, f, u, 0, u + 0.08, 1, T.vstripe[side === 'l' ? 0 : 1]);
      if (T.ring && side === 't') { quad(ctx, x, y, W, f, 0.3, 0.3, 0.7, 0.7, T.ring); quad(ctx, x, y, W, f, 0.4, 0.4, 0.6, 0.6, T.t); }
      if (side === 'l' && T.door) { quad(ctx, x, y, W, f, 0.2, 0.25, 0.55, 1, '#5A3C22'); quad(ctx, x, y, W, f, 0.46, 0.62, 0.52, 0.68, '#E8C15A'); }
      if (side === 'l' && T.window) { quad(ctx, x, y, W, f, 0.2, 0.3, 0.6, 0.65, '#5A3C22'); quad(ctx, x, y, W, f, 0.26, 0.36, 0.54, 0.59, '#FFE7A0'); }
      if (side === 'l' && T.cave) {
        quad(ctx, x, y, W, f, 0.15, 0.35, 0.65, 1, '#24170E');
        if (T.cave === 'open') { quad(ctx, x, y, W, f, 0.22, 0.48, 0.58, 1, '#E8590C'); quad(ctx, x, y, W, f, 0.3, 0.6, 0.5, 1, '#FFD166'); }
      }
      if (side === 'l' && T.crack) {
        quad(ctx, x, y, W, f, 0.3, 0.2, 0.36, 0.55, '#4F4F4F'); quad(ctx, x, y, W, f, 0.36, 0.5, 0.62, 0.56, '#4F4F4F');
        quad(ctx, x, y, W, f, 0.56, 0.52, 0.62, 0.9, '#4F4F4F'); quad(ctx, x, y, W, f, 0.18, 0.62, 0.3, 0.68, '#5C5C5C');
      }
      if (side === 'l' && T.window === 'lit') { quad(ctx, x, y, W, f, 0.2, 0.3, 0.6, 0.65, '#5A3C22'); quad(ctx, x, y, W, f, 0.26, 0.36, 0.54, 0.59, '#FFD45E'); }
      if (T.chest) {
        if (side !== 't') { quad(ctx, x, y, W, f, 0, 0.32, 1, 0.42, '#4A2F16'); quad(ctx, x, y, W, f, 0, 0, 0.08, 1, '#5E3C1C'); quad(ctx, x, y, W, f, 0.92, 0, 1, 1, '#5E3C1C'); }
        if (side === 'l') quad(ctx, x, y, W, f, 0.42, 0.3, 0.58, 0.5, '#E8C15A');
        if (side === 't') { quad(ctx, x, y, W, f, 0.08, 0.08, 0.92, 0.92, '#C48A48'); }
      }
      if (T.bench) {
        if (side === 't') { quad(ctx, x, y, W, f, 0.1, 0.1, 0.9, 0.9, '#B07A3E'); quad(ctx, x, y, W, f, 0.45, 0.1, 0.55, 0.9, '#8C5E2E'); quad(ctx, x, y, W, f, 0.1, 0.45, 0.9, 0.55, '#8C5E2E'); }
        else { quad(ctx, x, y, W, f, 0, 0, 1, 0.18, '#6B4A2B'); quad(ctx, x, y, W, f, 0.2, 0.35, 0.42, 0.75, '#5A3C22'); quad(ctx, x, y, W, f, 0.58, 0.35, 0.8, 0.75, side === 'l' ? '#B8C2CC' : '#5A3C22'); }
      }
      if (T.ore === true && side !== 't' && W >= 14) { quad(ctx, x, y, W, f, 0.25, 0.3, 0.38, 0.42, '#FFB347'); quad(ctx, x, y, W, f, 0.6, 0.6, 0.72, 0.72, '#B3A8FF'); }
      if (side === 'l' && T.ladder) {
        quad(ctx, x, y, W, f, 0.28, 0, 0.36, 1, '#C69C6D');
        quad(ctx, x, y, W, f, 0.64, 0, 0.72, 1, '#C69C6D');
        for (let v = 0.12; v < 1; v += 0.22) quad(ctx, x, y, W, f, 0.28, v, 0.72, v + 0.07, '#A47A4C');
      }
    });
    ctx.restore();
  }

  function island(n, ground) {
    const c = [];
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) { c.push([x, y, 0, ground(x, y) || 'grass']); c.push([x, y, -1, 'dirt']); }
    for (let d = 1; ; d++) {
      const lo = d, hi = n - 1 - d;
      if (lo > hi) break;
      for (let x = lo; x <= hi; x++) for (let y = lo; y <= hi; y++) c.push([x, y, -1 - d, 'stone']);
    }
    return c;
  }
  function drawIso(ctx, list, ox, oy, W, alpha) {
    list.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[2] - b[2]).forEach((c) => {
      cube(ctx, ox + (c[0] - c[1]) * W / 2, oy + (c[0] + c[1]) * W / 4 - c[2] * W / 2, W, c[3], alpha);
    });
  }

  /* ---------- Sprites ---------- */
  const K = { e: '#1A1D29', k: '#1A1D29', w: '#FFFFFF' };
  const HERO = ['...oooooo...', '..oooooooo..', '..oGggggGo..', '..osssssso..', '..osesseso..', '..ossssssO..', '...rrrrrr...', '.OooorooooO.', '.OooooooooO.', '.soooooooos.', '...pppppp...', '...pppppp...', '...pp..pp...', '...pp..pp...', '..bbb..bbb..'];
  const LAMP = [[5, 2, 'y'], [6, 2, 'y']];
  const SHOVEL = [[11, 4, 't'], [11, 5, 't'], [11, 6, 't'], [11, 7, 't'], [11, 8, 't'], [11, 9, 't'], [11, 10, 't'], [10, 11, 'm'], [11, 11, 'm'], [10, 12, 'm'], [11, 12, 'm']];
  const WING_L = [5, 6, 7, 8, 9, 10, 11].map((y) => [0, y, 'c']);
  const WING_R = [5, 6, 7, 8, 9, 10, 11].map((y) => [11, y, 'c']);
  const STAFF = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((y) => [11, y, 'z']).concat([[11, 1, 'Z'], [11, 2, 'Z'], [10, 2, 'z']]);

  const SHAPES = {
    orb: ['....aaaa....', '..aabbbbaa..', '.abbcbbbbba.', '.abccbbbbba.', '.abbbbbbbba.', '.abbbbbbbba.', '..abbbbbba..', '....aaaa....'],
    gem: ['...aaaaaa...', '..abcbbbba..', '.abccbbbbba.', '.aaaaaaaaaa.', '..abbbbbba..', '...abbbba...', '....abba....', '.....aa.....'],
    mushroom: ['...aaaaaa...', '..abbcbbba..', '.abcbbbbcba.', '.aaaaaaaaaa.', '....dddd....', '....dddd....', '....dddd....', '...dddddd...'],
    feather: ['.........aa.', '.......abba.', '......abbba.', '.....abbba..', '....abbba...', '...abbba....', '..abba......', '.dd.........'],
    tooth: ['..aaaaaaaa..', '.abbbbbbbba.', '.abbcbbbbba.', '.abbbbbbbba.', '..abbbbbba..', '..abba.abba.', '...aa...aa..'],
    jar: ['....dddd....', '...aaaaaa...', '..abbbbbba..', '..abcbbcba..', '..abbcbbba..', '..abbbbbba..', '...aaaaaa...'],
    scale: ['.....aa.....', '....abba....', '...abbcba...', '..abbbbbba..', '.abbbbbbbba.', '..aabbbbaa..', '....aaaa....'],
    crown: ['.c...c...c..', '.ac.aca.ac..', '.aaaaaaaaa..', '.abbbbbbba..', '.abcbbbcba..', '.aaaaaaaaa..']
  };
  const SPR = {
    sign: { rows: ['wwwwwwwwwwww', 'wddddddddddw', 'wdwwdwdwwddw', 'wddddddddddw', 'wwwwwwwwwwww', '.....bb.....', '.....bb.....', '.....bb.....'], pal: { w: '#C69C6D', d: '#8B5A3C', b: '#6B4A2B' } },
    torch: { rows: ['.....yy.....', '....yooy....', '....oroo....', '.....oo.....', '.....bb.....', '.....bb.....', '.....bb.....', '.....bb.....'], pal: { y: '#FFE29A', o: '#FF9F43', r: '#E8590C', b: '#6B4A2B' } },
    key: { rows: ['..yyy.......', '.y...y......', '.y...yyyyyyy', '.y...y..y.y.', '..yyy.......'], pal: { y: '#FFD166' } },
    leiterItem: { rows: ['.b......b...', '.bbbbbbbb...', '.b......b...', '.b......b...', '.bbbbbbbb...', '.b......b...', '.b......b...', '.bbbbbbbb...', '.b......b...'], pal: { b: '#B8864E' } },
    bogenItem: { rows: ['.ssssssss...', '.ssssssss...', '.ss....ss...', '.ss....ss...', '.ss....ss...', '.ss....ss...', '.ss....ss...'], pal: { s: '#9E9E9E' } },
    moosling: { rows: ['.....ll.....', '....lld.....', '......d.....', '...mmmmmm...', '..mmmmmmmm..', '..mwkmmwkm..', '..mmmmmmmm..', '..mmmkkmmm..', '..dmmmmmmd..', '...dddddd...', '...d....d...'], pal: { l: '#A3E048', d: '#3B7A2A', m: '#6AB04C' } },
    funkel: { rows: ['.....y......', '....yy......', '....yfy.....', '...yffy.y...', '...ffffyy...', '..ffffffff..', '..fwkffwkf..', '..ffffffff..', '..rffkkffr..', '...rffffr...', '....rrrr....'], pal: { y: '#FFD166', f: '#FF9F43', r: '#E8590C' } },
    kiesel: { rows: ['...oooooo...', '..osssssso..', '..swksswks..', '..ssssssss..', '..stssssts..', '..sssttsss..', '..ssssssss..', '..tttttttt..', '..t.t..t.t..'], pal: { o: '#C7C7C7', s: '#9E9E9E', t: '#6F6F6F' } },
    wispel: { rows: ['....cccc....', '...cccccc...', '..cccccccc..', '..cwkccwkc..', '..cccccccc..', '..ccckkccc..', '..cccccccc..', '...cccccccb.', '....bcccbb..', '.....bb.b...'], pal: { c: '#FFFFFF', b: '#9FC6E8' } },
    splitti: { rows: ['.....z......', '....zvz.....', '...zvvvz....', '..zvvvvvz...', '..vwkvwkv...', '..vvvvvvv...', '..vvvkvvv...', '..uvvvvvu...', '...uvvvu....', '....uuu.....', '....u.u.....'], pal: { z: '#E0DBFF', v: '#9B8CFF', u: '#6C5CE7' } },
    golem: { rows: ['..k.kkkk.k..', '..kkggggkk..', '..gyggggyg..', '..gggggggg..', '.ggGGggGGgg.', 'gggggggggggg', 'gg.gggggg.gg', 'gg.gGGGGg.gg', '...gg..gg...', '...gg..gg...', '..ggg..ggg..'], pal: { g: '#7C86AD', G: '#5B6488', y: '#FFD166', k: '#C9CFE6' } }
  };

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (f < 0) { r = Math.round(r * (1 + f)); g = Math.round(g * (1 + f)); b = Math.round(b * (1 + f)); }
    else { r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f); }
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function heroSprite(stage, color) {
    const c = color || '#127C7A';
    const pal = Object.assign({ o: c, O: shade(c, -0.32), G: '#3A3F52', g: '#6FD3E8', s: '#F2C9A0', r: '#D7263D', p: '#3D5A80', b: '#5A3C22', y: '#FFE066', t: '#8B5A3C', m: '#B8C2CC', c: '#BFE3FF', z: '#B3A8FF', Z: '#FFFFFF' }, K);
    let over = [];
    if (stage >= 1) over = over.concat(LAMP);
    if (stage === 1) over = over.concat(SHOVEL);
    if (stage >= 2) over = over.concat(WING_L, stage === 2 ? WING_R : []);
    if (stage >= 3) { over = over.concat(STAFF); pal.o = shade(c, 0.28); pal.O = c; pal.r = '#FFD166'; }
    return { rows: HERO, pal, over };
  }

  function drawSprite(ctx, spr, px, cx, cy, opts) {
    const o = opts || {};
    let g = spr.rows.map((r) => r.split(''));
    (spr.over || []).forEach((v) => { g[v[1]][v[0]] = v[2]; });
    if (o.flip) g = g.map((r) => r.slice().reverse());
    const pal = Object.assign({}, K, spr.pal);
    const left = cx - 6 * px, top = cy - g.length * px;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    const at = (x, y) => (g[y] && g[y][x] && g[y][x] !== '.');
    const cell = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(left + x * px), Math.round(top + y * px), Math.ceil(px), Math.ceil(px)); };
    if (o.outline) {
      for (let y = -1; y <= g.length; y++) for (let x = -1; x <= 12; x++) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) cell(x, y, o.outline === true ? '#141622' : o.outline);
      }
    }
    g.forEach((row, y) => row.forEach((ch, x) => {
      if (ch === '.') return;
      cell(x, y, o.grey ? '#9AA0B4' : pal[ch]);
    }));
    ctx.restore();
    return { left, top, w: 12 * px, h: g.length * px };
  }

  function label(ctx, text, x, y, color, align) {
    ctx.save();
    ctx.font = '10px Silkscreen, "Courier New", monospace';
    const w = ctx.measureText(text).width + 12;
    const lx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    ctx.fillStyle = 'rgba(22,25,38,0.88)';
    ctx.fillRect(lx, y, w, 17);
    ctx.fillStyle = color || '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, lx + 6, y + 9);
    ctx.restore();
  }

  function star(ctx, x, y, s, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x - s / 2, y - s * 1.5, s, s * 3);
    ctx.fillRect(x - s * 1.5, y - s / 2, s * 3, s);
  }


  /* ---------- Lilo als Vektorfigur (glatt, nicht verpixelt) ----------
     Entwurf im Raster 100 × 130, Füsse unten Mitte bei (50, 128). */
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  function fill(ctx, c) { ctx.fillStyle = c; ctx.fill(); }
  function line(ctx, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); }

  // Figur in Entwurfs-Einheiten (100 × 130, Füsse bei y = 128)
  function heroShapes(ctx, stage, color, o) {
    const c = color || '#127C7A';
    const armor = stage >= 3;
    const body = armor ? shade(c, 0.2) : c;
    const dark = shade(c, -0.32);
    const deep = shade(c, -0.5);
    const skin = '#F1C69C', ink = '#1A1C28', hair = '#3B2A1E';
    const scarf = armor ? '#FFC94D' : '#D7263D', scarf2 = armor ? '#D99A1E' : '#9E1A2B';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // Wehender Schal hinter dem Körper (Heldenumhang-Wirkung)
    ctx.beginPath(); ctx.moveTo(40, 50); ctx.quadraticCurveTo(22, 58, 10, 80); ctx.lineTo(18, 84);
    ctx.quadraticCurveTo(26, 68, 44, 58); ctx.closePath(); fill(ctx, scarf2);
    ctx.beginPath(); ctx.moveTo(12, 79); ctx.lineTo(7, 86); ctx.lineTo(14, 84); ctx.lineTo(13, 89); ctx.lineTo(19, 84); ctx.closePath(); fill(ctx, scarf2);

    // Gleitflügel
    if (stage >= 2) {
      const wing = (dir) => {
        ctx.save(); ctx.translate(50, 0); ctx.scale(dir, 1); ctx.translate(-50, 0);
        ctx.beginPath(); ctx.moveTo(34, 56); ctx.quadraticCurveTo(14, 38, 0, 40); ctx.lineTo(6, 54); ctx.lineTo(1, 62); ctx.lineTo(8, 70);
        ctx.lineTo(4, 80); ctx.quadraticCurveTo(20, 78, 34, 74); ctx.closePath();
        fill(ctx, '#CFEAFF');
        ctx.beginPath(); ctx.moveTo(32, 60); ctx.lineTo(8, 50); ctx.moveTo(32, 66); ctx.lineTo(8, 66); line(ctx, '#86B8E2', 2.4);
        ctx.restore();
      };
      wing(1); if (!armor) wing(-1);
    }
    // Stab oder Schaufel hinter der Hand
    if (armor) {
      ctx.beginPath(); ctx.moveTo(81, 22); ctx.lineTo(81, 124); line(ctx, '#7C6CE0', 4.5);
      ctx.beginPath(); ctx.moveTo(81, 4); ctx.lineTo(89, 16); ctx.lineTo(81, 30); ctx.lineTo(73, 16); ctx.closePath(); fill(ctx, '#E6E0FF');
      ctx.beginPath(); ctx.moveTo(81, 8); ctx.lineTo(81, 26); line(ctx, '#9B8CFF', 2.5);
    } else if (stage === 1) {
      ctx.beginPath(); ctx.moveTo(81, 50); ctx.lineTo(81, 104); line(ctx, '#8B5A3C', 4.5);
      ctx.beginPath(); ctx.moveTo(73, 102); ctx.lineTo(89, 102); ctx.lineTo(87, 116); ctx.lineTo(81, 122); ctx.lineTo(75, 116); ctx.closePath(); fill(ctx, '#C3CCD6');
      ctx.beginPath(); ctx.moveTo(77, 106); ctx.lineTo(77, 114); line(ctx, '#E6ECF2', 2);
    }

    // Beine (breiter Stand) und Stiefel; beim Laufen wird abwechselnd ein Bein angehoben
    const legL = o.step === 1 ? -6 : 0, legR = o.step === 2 ? -6 : 0;
    ctx.save(); ctx.translate(0, legL);
    ctx.beginPath(); ctx.moveTo(36, 88 - legL); ctx.lineTo(48, 88 - legL); ctx.lineTo(46, 114); ctx.lineTo(34, 114); ctx.closePath(); fill(ctx, '#34507A');
    rr(ctx, 30, 108, 18, 19, 3); fill(ctx, '#5A3C22');
    rr(ctx, 30, 108, 18, 5, 2); fill(ctx, '#7A5434');
    rr(ctx, 29, 123, 20, 5, 2); fill(ctx, '#2E1F12');
    ctx.restore();
    ctx.save(); ctx.translate(0, legR);
    ctx.beginPath(); ctx.moveTo(52, 88 - legR); ctx.lineTo(64, 88 - legR); ctx.lineTo(66, 114); ctx.lineTo(54, 114); ctx.closePath(); fill(ctx, '#34507A');
    rr(ctx, 52, 108, 18, 19, 3); fill(ctx, '#5A3C22');
    rr(ctx, 52, 108, 18, 5, 2); fill(ctx, '#7A5434');
    rr(ctx, 51, 123, 20, 5, 2); fill(ctx, '#2E1F12');
    ctx.restore();

    // Arme
    rr(ctx, 18, 52, 13, 32, 5); fill(ctx, shade(body, -0.16));
    rr(ctx, 69, 52, 13, 32, 5); fill(ctx, shade(body, -0.16));
    rr(ctx, 18, 76, 13, 6, 2); fill(ctx, dark);
    rr(ctx, 69, 76, 13, 6, 2); fill(ctx, dark);

    // Rumpf: breite Schultern, schmalere Taille
    ctx.beginPath(); ctx.moveTo(28, 54); ctx.quadraticCurveTo(28, 48, 36, 47); ctx.lineTo(64, 47); ctx.quadraticCurveTo(72, 48, 72, 54);
    ctx.lineTo(68, 90); ctx.lineTo(32, 90); ctx.closePath(); fill(ctx, body);
    if (!armor) {
      ctx.beginPath(); ctx.moveTo(50, 50); ctx.lineTo(50, 82); line(ctx, dark, 2);
      rr(ctx, 37, 70, 26, 10, 3); fill(ctx, dark);
      ctx.beginPath(); ctx.moveTo(45, 52); ctx.lineTo(44, 64); ctx.moveTo(55, 52); ctx.lineTo(56, 64); line(ctx, '#E9ECF4', 2);
    } else {
      ctx.beginPath(); ctx.moveTo(34, 52); ctx.lineTo(66, 52); ctx.lineTo(63, 76); ctx.lineTo(50, 82); ctx.lineTo(37, 76); ctx.closePath(); fill(ctx, '#DCD5FF');
      ctx.beginPath(); ctx.moveTo(50, 56); ctx.lineTo(57, 66); ctx.lineTo(50, 76); ctx.lineTo(43, 66); ctx.closePath(); fill(ctx, '#8E7FF0');
      rr(ctx, 16, 47, 18, 11, 4); fill(ctx, '#DCD5FF');
      rr(ctx, 66, 47, 18, 11, 4); fill(ctx, '#DCD5FF');
    }
    // Gürtel mit Schnalle
    rr(ctx, 31, 84, 38, 7, 2); fill(ctx, '#4A3020');
    rr(ctx, 46, 83, 8, 9, 1.5); fill(ctx, '#F2C14E');
    rr(ctx, 48.5, 85.5, 3, 4, 1); fill(ctx, '#4A3020');

    // Schal um den Hals
    rr(ctx, 33, 43, 34, 9, 3); fill(ctx, scarf);
    ctx.beginPath(); ctx.moveTo(37, 47); ctx.lineTo(63, 47); line(ctx, scarf2, 1.6);

    // Kopf: Kapuze, Gesicht, Haare
    ell(ctx, 50, 28, 21, 20); fill(ctx, body);
    ctx.beginPath(); ctx.ellipse(50, 28, 21, 20, 0, Math.PI * 0.2, Math.PI * 0.8); line(ctx, dark, 2.6);
    ell(ctx, 50, 32, 14.5, 14); fill(ctx, deep);
    ell(ctx, 50, 33, 13, 12.5); fill(ctx, skin);
    // Kinn-Schatten
    ctx.beginPath(); ctx.ellipse(50, 33, 13, 12.5, 0, Math.PI * 0.15, Math.PI * 0.85); line(ctx, '#D9A57C', 1.6);
    // stachelige Stirnfransen
    ctx.beginPath();
    ctx.moveTo(36.5, 31); ctx.lineTo(38, 21); ctx.lineTo(42, 25); ctx.lineTo(45, 19); ctx.lineTo(48, 25); ctx.lineTo(52, 18);
    ctx.lineTo(55, 25); ctx.lineTo(59, 20); ctx.lineTo(61, 26); ctx.lineTo(63.5, 31); ctx.lineTo(60, 27); ctx.lineTo(56, 29);
    ctx.lineTo(52, 26); ctx.lineTo(47, 29); ctx.lineTo(43, 26); ctx.lineTo(39, 29); ctx.closePath(); fill(ctx, hair);

    // Brille auf der Stirn
    rr(ctx, 39, 16, 9, 7, 2.5); fill(ctx, '#78D4EA'); line(ctx, ink, 2);
    rr(ctx, 52, 16, 9, 7, 2.5); fill(ctx, '#78D4EA'); line(ctx, ink, 2);
    ctx.beginPath(); ctx.moveTo(48, 19.5); ctx.lineTo(52, 19.5); line(ctx, ink, 2);
    ctx.beginPath(); ctx.moveTo(41, 18); ctx.lineTo(43, 18); line(ctx, '#FFFFFF', 1.4);
    ctx.beginPath(); ctx.moveTo(54, 18); ctx.lineTo(56, 18); line(ctx, '#FFFFFF', 1.4);

    // Stirnlampe
    if (stage >= 1) {
      ell(ctx, 50, 10, 7, 6); fill(ctx, 'rgba(255,224,102,0.45)');
      rr(ctx, 45.5, 7, 9, 6.5, 2); fill(ctx, '#3A3F52');
      rr(ctx, 47.5, 8.5, 5, 3.5, 1); fill(ctx, '#FFE066');
    }

    // Gesicht: entschlossener Blick
    ctx.beginPath(); ctx.moveTo(40.5, 29.5); ctx.lineTo(47.5, 31.5); line(ctx, hair, 2.4);
    ctx.beginPath(); ctx.moveTo(59.5, 29.5); ctx.lineTo(52.5, 31.5); line(ctx, hair, 2.4);
    rr(ctx, 42.5, 32.5, 4, 4.5, 1.2); fill(ctx, ink);
    rr(ctx, 53.5, 32.5, 4, 4.5, 1.2); fill(ctx, ink);
    rr(ctx, 43.5, 33, 1.4, 1.4, 0.5); fill(ctx, '#FFFFFF');
    rr(ctx, 54.5, 33, 1.4, 1.4, 0.5); fill(ctx, '#FFFFFF');
    ctx.beginPath();
    if (o.cheer) { ctx.moveTo(45.5, 40); ctx.quadraticCurveTo(50, 45, 54.5, 40); ctx.closePath(); fill(ctx, '#7A2E24'); }
    else { ctx.moveTo(46.5, 41); ctx.lineTo(51, 41.5); ctx.quadraticCurveTo(53.5, 41.2, 54.5, 39.8); line(ctx, '#7A2E24', 1.8); }

    // Fäuste
    rr(ctx, 19, 80, 11, 9, 3.5); fill(ctx, skin);
    rr(ctx, 70, 80, 11, 9, 3.5); fill(ctx, skin);
  }

  // Mittelweg: Figur fein zeichnen, dann auf ein feineres Pixelraster bringen und dunkel umranden
  const HERO_ROWS = 58;
  const heroCache = {};
  function heroBitmap(stage, color, o) {
    const key = stage + '|' + color + '|' + (o.cheer ? 1 : 0) + '|' + (o.step || 0);
    if (heroCache[key]) return heroCache[key];
    const k = HERO_ROWS / 130;
    const W0 = Math.ceil(100 * k), H0 = Math.ceil(130 * k);
    const cv = document.createElement('canvas');
    cv.width = W0 + 2; cv.height = H0 + 2;
    const g = cv.getContext('2d');
    g.translate(1, 1); g.scale(k, k);
    heroShapes(g, stage, color, o);
    const img = g.getImageData(0, 0, cv.width, cv.height);
    const d = img.data, w = cv.width, h = cv.height;
    const solid = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const a = d[i * 4 + 3];
      if (a >= 110) { solid[i] = 1; d[i * 4 + 3] = 255; }
      else d[i * 4 + 3] = 0;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w])) {
        d[i * 4] = 20; d[i * 4 + 1] = 22; d[i * 4 + 2] = 34; d[i * 4 + 3] = 255;
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.putImageData(img, 0, 0);
    heroCache[key] = { cv, k };
    return heroCache[key];
  }

  function drawHero(ctx, cx, footY, H, stage, color, opts) {
    const o = opts || {};
    const sc = H / 130;
    ctx.save();
    ell(ctx, cx, footY - 1 * sc, 24 * sc, 3.5 * sc); fill(ctx, 'rgba(0,0,0,0.22)');
    if (typeof document === 'undefined') { ctx.restore(); return; }
    const bm = heroBitmap(stage || 0, color || '#127C7A', o);
    const f = sc / bm.k;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    if (o.flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    ctx.drawImage(bm.cv, Math.round(cx - 50 * sc - f), Math.round(footY - 128 * sc - f), Math.round(bm.cv.width * f), Math.round(bm.cv.height * f));
    ctx.imageSmoothingEnabled = smooth;
    ctx.restore();
  }

  /* ---------- Szene ---------- */
  const LW = 390, LH = 410;

  function draw(canvas, st, opts) {
    const o = opts || {};
    const dpr = Math.min(3, root.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || LW;
    const scale = cssW / LW;
    const needW = Math.round(LW * scale * dpr), needH = Math.round(LH * scale * dpr);
    if (canvas.width !== needW || canvas.height !== needH) { canvas.width = needW; canvas.height = needH; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const bob = o.tick ? (o.tick % 2) : 0;

    // Himmel
    const hour = (o.now || new Date()).getHours();
    const night = hour >= 19 || hour < 6;
    const sky = ctx.createLinearGradient(0, 0, 0, LH);
    if (night) { sky.addColorStop(0, '#141A33'); sky.addColorStop(1, '#2A3768'); }
    else { sky.addColorStop(0, '#6FB7EE'); sky.addColorStop(1, '#B9E0FA'); }
    ctx.fillStyle = sky; ctx.fillRect(0, 0, LW, LH);
    if (night) {
      [[30, 40], [80, 22], [140, 60], [220, 18], [260, 70], [350, 110], [20, 150], [365, 30], [110, 120]].forEach((p, i) => {
        ctx.fillStyle = i % 3 === 0 ? '#FFE7A0' : '#FFFFFF'; ctx.fillRect(p[0], p[1], 2, 2);
      });
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(20, 180, 56, 12); ctx.fillRect(300, 196, 70, 14); ctx.fillRect(316, 186, 34, 12);
    }

    const built = st.built || {};
    const here = {};
    const hstage = {};
    (st.helpers || []).forEach((h) => { here[h.id] = h.here; hstage[h.id] = h.stage; });

    // Kristallinsel (links oben)
    const far = island(3, () => null);
    far.push([1, 1, 1, 'crystal'], [1, 1, 2, 'crystal']);
    drawIso(ctx, far, 58, 70, 16, built.kristallinsel ? 1 : 0.5);

    // Himmelsinsel (Mitte oben)
    const sky3 = [[0, 0, 0, 'cloudw'], [1, 0, 0, 'cloudw'], [0, 1, 0, 'cloudw'], [1, 1, 0, 'cloudw'], [2, 1, 0, 'cloudw'], [1, 2, 0, 'cloudw']];
    drawIso(ctx, sky3, 176, 34, 14, built.himmelsinsel ? 1 : 0.35);

    // Boss-Wolke (rechts oben)
    const boss = [[0, 0, 0, 'cloud'], [1, 0, 0, 'cloud'], [2, 0, 0, 'cloud'], [0, 1, 0, 'cloud'], [1, 1, 0, 'cloud'], [2, 1, 0, 'cloud'], [1, 0, 1, 'cloud'], [1, 1, 1, 'cloud'], [0, 0, 1, 'cloud']];
    drawIso(ctx, boss, 306, 46, 22, 1);

    // Hauptinsel
    const W = 36, ox = 177, oy = 186;
    const pond = { '1,5': 1, '2,5': 1, '1,6': 1, '2,6': 1 };
    const path = { '3,6': 1, '3,7': 1, '4,6': 1 };
    const main = island(8, (x, y) => (pond[x + ',' + y] ? 'water' : (path[x + ',' + y] ? 'sand' : null)))
      .map((c) => (c[0] === 3 && c[1] === 7 && c[2] === -1 ? [3, 7, -1, built.hoehle ? 'caveLit' : 'cave'] : c));
    main.push([1, 1, 1, 'log'], [1, 1, 2, 'log'], [1, 1, 3, 'log']);
    for (let x = 0; x <= 2; x++) for (let y = 0; y <= 2; y++) main.push([x, y, 4, 'leaves']);
    main.push([1, 1, 5, 'leaves']);
    main.push([0, 4, 1, 'log'], [0, 4, 2, 'log'], [0, 4, 3, 'leaves'], [0, 3, 3, 'leaves'], [1, 4, 3, 'leaves'], [0, 4, 4, 'leaves']);
    const L = built.leiter;
    main.push([6, 0, 1, 'stone'], [7, 0, 1, 'stone'], [6, 1, 1, L ? 'ladder' : 'stone'], [7, 1, 1, 'stone'], [6, 0, 2, 'stone'], [7, 0, 2, 'stone'], [7, 1, 2, L ? 'ladder' : 'stone'], [7, 0, 3, 'stone']);
    main.push([5, 3, 1, 'planks'], [6, 3, 1, 'planks'], [5, 4, 1, 'door'], [6, 4, 1, 'win']);
    main.push([5, 3, 2, 'planks'], [6, 3, 2, 'planks'], [5, 4, 2, 'planks'], [6, 4, 2, 'planks']);
    main.push([5, 3, 3, 'roof'], [6, 3, 3, 'roof'], [5, 4, 3, 'roof'], [6, 4, 3, 'roof']);
    drawIso(ctx, main, ox, oy, W, 1);

    const foot = (x, y, lift) => [ox + (x - y) * W / 2 + W / 2, oy + (x + y) * W / 4 + W / 4 - (lift || 0)];
    const helperDraw = (id, p, px) => {
      const s = hstage[id] || 1;
      const size = s >= 2 ? px * 1.18 : px;
      const r = drawSprite(ctx, SPR[id], size, p[0], p[1] - bob);
      if (s >= 3) star(ctx, r.left + r.w + 2, r.top + 2, 2, '#FFD166');
      return r;
    };

    // Sprites in Tiefenreihenfolge
    const sprites = [];
    sprites.push({ d: 5, f: () => helperDraw('moosling', foot(2, 3), 2.5) });
    if (here.kiesel) sprites.push({ d: 7, f: () => helperDraw('kiesel', foot(7, 0, 54), 2.5) });
    if (here.funkel) sprites.push({ d: 11, f: () => helperDraw('funkel', foot(2, 7), 2.5) });
    sprites.push({ d: 8, f: () => { const fp = foot(3, 5); drawHero(ctx, fp[0], fp[1] + 1 - (o.cheer ? 6 : 0), 50, st.stage || 0, st.heroColor, { cheer: o.cheer }); } });
    sprites.sort((a, b) => a.d - b.d).forEach((s) => s.f());
    if (here.splitti) helperDraw('splitti', [66, 72 - 4], 1.6);
    if (here.wispel) helperDraw('wispel', [190, 36], 1.6);

    // Boss
    const b = st.boss || {};
    drawSprite(ctx, SPR.golem, 2, 328, 52 - (b.defeated || b.waiting ? 0 : bob), { grey: !!(b.defeated || b.waiting), alpha: b.defeated || b.waiting ? 0.6 : 1 });

    // Beschriftungen
    const lvl = st.level || 1;
    const stages = st.stages || [5, 10, 15];
    label(ctx, b.waiting ? 'Sturm-Golem · ab Montag' : b.defeated ? 'Boss besiegt!' : 'Sturm-Golem · ' + Math.max(0, (b.hp || 0) - (b.dmg || 0)) + ' LP', 384, 90, b.defeated ? '#7BC96F' : '#FFD166', 'right');
    if (!built.kristallinsel) label(ctx, 'Kristallinsel · Lvl ' + stages[1], 8, 118, '#C7BEFF');
    if (!built.himmelsinsel) label(ctx, 'Finale · Lvl ' + stages[2], 196, 6, '#FFFFFF', 'center');
    if (!built.hoehle) label(ctx, lvl >= stages[0] ? 'Höhle · graben!' : 'Höhle · ab Lvl ' + stages[0], 26, 352, '#FFB347');
    if (!built.leiter) label(ctx, 'Berg · Leiter bauen', 384, 146, '#E3E3E3', 'right');
    const hp = foot(3, 5);
    label(ctx, st.heroName || 'Lilo', hp[0], hp[1] - 66, '#FFFFFF', 'center');
  }

  /* Kleines Einzelbild: Sprite auf einem Block (für Karten) */
  function drawCard(canvas, kind, opts) {
    const o = opts || {};
    const w = canvas.clientWidth || 96, h = canvas.clientHeight || 96;
    const dpr = Math.min(3, root.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    const bw = Math.min(w * 0.6, h * 0.55);
    const block = o.block || 'grass';
    cube(ctx, (w - bw) / 2, h - bw - 2, bw, block, o.locked ? 0.45 : 1);
    const px = o.px || Math.max(2, Math.floor(bw / 16));
    const cx = w / 2, cy = h - bw * 0.75 - 2;
    if (kind === 'hero') drawHero(ctx, cx, cy + px * 2, px * 15 * 1.12, o.stage || 0, o.color, { cheer: o.cheer });
    else if (SPR[kind]) drawSprite(ctx, SPR[kind], px, cx, cy, { grey: o.locked, alpha: o.locked ? 0.5 : 1, outline: !o.locked });
  }

  /* Symbol für einen Gegenstand im Inventar */
  function drawItem(canvas, id) {
    const w = canvas.clientWidth || 40, h = canvas.clientHeight || 40;
    const dpr = Math.min(3, root.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    const blocks = { holz: 'log', stein: 'stone', kristall: 'crystal', truhe: 'chest', bruecke: 'bridge' };
    const S = Math.min(w, h);
    if (blocks[id]) { const b = S * 0.78; cube(ctx, (w - b) / 2, (h - b) / 2, b, blocks[id]); return; }
    const spr = { leiter: SPR.leiterItem, stuetzbogen: SPR.bogenItem, schluessel: SPR.key }[id];
    if (spr) { const px = Math.max(1, Math.floor(S / 13)); drawSprite(ctx, spr, px, w / 2 + px, h / 2 + spr.rows.length * px / 2, { outline: true }); }
  }

  function drawFound(canvas, item, known) {
    const w = canvas.clientWidth || 48, h = canvas.clientHeight || 48;
    const dpr = Math.min(3, root.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const rows = SHAPES[item.shape] || SHAPES.orb;
    const px = Math.max(2, Math.floor(Math.min(w, h) / 13));
    const pal = known ? item.pal : { a: '#2A2E40', b: '#3A3F55', c: '#3A3F55', d: '#2A2E40' };
    drawSprite(ctx, { rows, pal }, px, w / 2, h / 2 + rows.length * px / 2, { outline: known ? true : '#141622' });
  }
  root.World = { drawFound, SHAPES, draw, drawCard, drawItem, drawHero, heroSprite, drawSprite, cube, label, star, shade, SPR, TEX, LW, LH };
})(typeof window !== 'undefined' ? window : globalThis);
