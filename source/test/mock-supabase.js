// Nachbildung der Supabase-Schnittstellen (Auth + REST) auf einer lokalen Postgres-Datenbank.
// Jede Anfrage läuft als Rolle «authenticated» mit der Benutzer-ID aus dem Token, damit die
// echten Zugriffsregeln aus supabase/schema.sql gelten.
// Aufruf: node test/mock-supabase.js <port> <psql-socket-dir> <pg-port> <db>
const http = require('http');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const [port, sock, pgport, db] = process.argv.slice(2);
const tokens = {};   // access -> user
const refresh = {};  // refresh -> user
let failNext = 0;    // für Tests: so viele Anfragen mit Netzwerkfehler beantworten

function sql(user, text) {
  const pre = user
    ? "begin; set local role authenticated; set local request.jwt.claim.sub = '" + user + "';\n"
    : 'begin;\n';
  const out = execFileSync('psql', ['-h', sock, '-p', pgport, '-U', 'postgres', '-d', db, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', pre + text + '\ncommit;'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out.trim();
}
const q = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const ident = (v) => { if (!/^[a-z_][a-z0-9_]*$/.test(v)) throw new Error('bad ident ' + v); return v; };

function filters(params) {
  const w = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
    const m = /^(eq|gt|lt|gte|lte)\.(.*)$/.exec(v);
    const op = { eq: '=', gt: '>', lt: '<', gte: '>=', lte: '<=' }[m[1]];
    w.push(ident(k) + ' ' + op + ' ' + q(m[2]));
  }
  return w.length ? ' where ' + w.join(' and ') : '';
}
function order(params) {
  const o = params.get('order');
  if (!o) return '';
  return ' order by ' + o.split(',').map((p) => { const [c, d] = p.split('.'); return ident(c) + (d === 'desc' ? ' desc' : ' asc'); }).join(', ');
}

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Content-Range' }, headers || {}));
  res.end(body == null ? '' : JSON.stringify(body));
}
function pgError(res, e) {
  const msg = String(e.stderr || e.message).split('\n').find((l) => /ERROR/.test(l)) || String(e.message);
  const clean = msg.replace(/^.*ERROR:\s*/, '');
  const status = /row-level security|permission denied/.test(clean) ? 403 : /does not exist/.test(clean) ? 404 : 400;
  send(res, status, { message: clean, code: status === 403 ? '42501' : 'P0001' });
}

const server = http.createServer((req, res) => {
  let buf = '';
  req.on('data', (c) => { buf += c; });
  req.on('end', () => {
    if (req.method === 'OPTIONS') return send(res, 204, null);
    const url = new URL(req.url, 'http://x');
    const body = buf ? JSON.parse(buf) : null;
    if (failNext > 0 && !url.pathname.startsWith('/__')) { failNext--; req.socket.destroy(); return; }
    if (url.pathname === '/__fail') { failNext = +url.searchParams.get('n'); return send(res, 200, { ok: 1 }); }
    if (url.pathname === '/__expire') { Object.keys(tokens).forEach((k) => delete tokens[k]); return send(res, 200, { ok: 1 }); }
    if (url.pathname === '/__sql') { try { return send(res, 200, { out: sql(null, body.sql) }); } catch (e) { return pgError(res, e); } }
    if (!req.headers.apikey) return send(res, 401, { message: 'No API key found in request' });
    const issue = (user) => {
      const a = 'tok-' + crypto.randomUUID(), r = 'ref-' + crypto.randomUUID();
      tokens[a] = user; refresh[r] = user;
      return { access_token: a, refresh_token: r, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: user } };
    };
    if (url.pathname === '/auth/v1/signup') {
      const user = crypto.randomUUID();
      sql(null, 'insert into auth.users (id) values (' + q(user) + ');');
      return send(res, 200, issue(user));
    }
    if (url.pathname === '/auth/v1/token') {
      const user = refresh[body.refresh_token];
      if (!user) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
      delete refresh[body.refresh_token];
      return send(res, 200, issue(user));
    }
    const auth = (req.headers.authorization || '').replace('Bearer ', '');
    const user = tokens[auth];
    if (!user) return send(res, 401, { message: 'JWT expired', code: 'PGRST301' });
    try {
      const m = /^\/rest\/v1\/(rpc\/)?([a-z_]+)$/.exec(url.pathname);
      if (!m) return send(res, 404, { message: 'not found' });
      const P = url.searchParams;
      if (m[1]) {
        const args = Object.keys(body || {}).map((k) => ident(k) + ' => ' + (body[k] == null ? 'null' : q(body[k]))).join(', ');
        const out = sql(user, 'select coalesce(json_agg(t), \'[]\') from public.' + ident(m[2]) + '(' + args + ') t;');
        return send(res, 200, JSON.parse(out));
      }
      const table = 'public.' + ident(m[2]);
      if (req.method === 'GET') {
        const cols = (P.get('select') || '*').split(',').map((c) => (c === '*' ? '*' : ident(c))).join(', ');
        const where = filters(P);
        let lim = Math.min(+(P.get('limit') || 1000), 1000);
        const off = +(P.get('offset') || 0);
        const out = sql(user, 'select coalesce(json_agg(t), \'[]\') from (select ' + cols + ' from ' + table + where + order(P) + ' limit ' + lim + ' offset ' + off + ') t;');
        const rows = JSON.parse(out);
        const h = {};
        if (/count=exact/.test(req.headers.prefer || '')) {
          const n = +sql(user, 'select count(*) from ' + table + where + ';');
          h['Content-Range'] = (rows.length ? off + '-' + (off + rows.length - 1) : '*') + '/' + n;
        }
        return send(res, 200, rows, h);
      }
      if (req.method === 'POST') {
        const rows = Array.isArray(body) ? body : [body];
        const cols = Object.keys(rows[0]);
        const val = (v) => (v == null ? 'null' : typeof v === 'object' ? q(JSON.stringify(v)) : q(v));
        let text = 'insert into ' + table + ' (' + cols.map(ident).join(', ') + ') values ' + rows.map((r) => '(' + cols.map((c) => val(r[c])).join(', ') + ')').join(', ');
        const pref = req.headers.prefer || '';
        const oc = P.get('on_conflict');
        if (oc && /ignore-duplicates/.test(pref)) text += ' on conflict (' + ident(oc) + ') do nothing';
        else if (oc && /merge-duplicates/.test(pref)) text += ' on conflict (' + ident(oc) + ') do update set ' + cols.filter((c) => c !== oc).map((c) => ident(c) + ' = excluded.' + ident(c)).join(', ');
        sql(user, text + ';');
        return send(res, 201, null);
      }
      if (req.method === 'DELETE') {
        sql(user, 'delete from ' + table + filters(P) + ';');
        return send(res, 204, null);
      }
      send(res, 405, { message: 'method' });
    } catch (e) { pgError(res, e); }
  });
});
server.listen(+port, () => console.log('mock supabase on ' + port));
