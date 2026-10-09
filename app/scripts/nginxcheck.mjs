// Auslieferung über den echten nginx mit app/nginx.conf (Sicherheitsrunde
// 09.10.2026). Braucht einen gebauten Stand (npm run build) und ein
// installiertes nginx; fehlt nginx, wird übersprungen. Umami wird durch einen
// Ersatzdienst auf 127.0.0.1 vertreten (die echte Weiterleitung geht per
// HTTPS an den Host aus `$umami_host`, Platzhalter analytics.example.com).
//
//   1. `Server:` ohne Versionsnummer (server_tokens off)
//   2. App-Seite: CSP ohne fremden Host, img-src 'self' data: blob:,
//      X-Frame-Options DENY, genau eine Cache-Control-Zeile
//   3. Assets (/assets/*.js, /fonts/…): nosniff, HSTS, genau eine
//      Cache-Control-Zeile, kein zusätzliches Expires
//   4. /.well-known/security.txt als text/plain mit Contact/Expires/Canonical,
//      kein SPA-Rückfall
//   5. /oauth/… fällt nicht auf die SPA zurück (Kurzweg zur cv-api im
//      mitgelieferten Stack; ohne cv-api hier 502)
//   6. /u/script.js und /u/api/send gehen an Umami: ohne Cookies in beide
//      Richtungen, Besucher-IP als X-Client-IP (erste Adresse aus
//      X-Forwarded-For), sonst unter /u/ nichts (404). index.html lädt
//      Umami nicht von selbst (Tag nur auskommentiert)
//   7. neue Seiten /widerruf/bestaetigen und /kuendigen/bestaetigen fallen
//      auf die App zurück (200, HTML)
//
//   node scripts/nginxcheck.mjs
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { request } from 'node:http';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const APP = resolve(process.cwd());
const DIST = join(APP, 'dist');
const PORT = Number(process.env.NGINX_PORT || 5291);
const UMAMI_PORT = Number(process.env.UMAMI_PORT || 5292);
const TMP = join(tmpdir(), `nginxcheck-${process.pid}`);

let fail = 0;
const ok = (c, label, extra = '') => { console.log(`${c ? 'ok  ' : 'FEHL'} ${label}${!c && extra ? ` — ${extra}` : ''}`); if (!c) fail++; };

if (spawnSync('nginx', ['-v']).status !== 0) { console.log('nginx nicht installiert — Prüfung übersprungen'); process.exit(0); }
if (!existsSync(join(DIST, 'index.html'))) { console.log('dist/ fehlt — erst npm run build'); process.exit(1); }

// Ersatz für Umami: merkt sich, was ankommt.
const seen = [];
const umami = createServer((req, res) => {
  let body = '';
  req.on('data', d => { body += d; });
  req.on('end', () => {
    seen.push({ method: req.method, url: req.url, headers: req.headers, body });
    if (req.url === '/script.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Set-Cookie': 'tracker=1', 'Cache-Control': 'public, max-age=5', 'Access-Control-Allow-Origin': '*', 'Content-Security-Policy': "default-src 'none'" });
      res.end('/* umami */');
    } else if (req.url === '/api/send') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'tracker=2', 'Access-Control-Allow-Origin': '*' });
      res.end('{"ok":true}');
    } else { res.writeHead(404); res.end(); }
  });
});
await new Promise(r => umami.listen(UMAMI_PORT, '127.0.0.1', r));

const conf = readFileSync(join(APP, 'nginx.conf'), 'utf8')
  .replace(/listen\s+80;/, `listen 127.0.0.1:${PORT};`)
  .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${DIST};`)
  .replace(/proxy_pass https:\/\/\$umami_host\//g, `proxy_pass http://127.0.0.1:${UMAMI_PORT}/`);
ok(!/proxy_pass https:\/\/\$umami_host/.test(conf), 'Umami-Weiterleitung für die Prüfung auf den Ersatzdienst umgelenkt');
mkdirSync(TMP, { recursive: true });
const temp = ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map(n => `${n}_temp_path ${join(TMP, n)};`).join('\n  ');
writeFileSync(join(TMP, 'nginx.conf'), `${process.getuid?.() === 0 ? 'user root;' : ''}
worker_processes 1;
daemon off;
pid ${join(TMP, 'nginx.pid')};
error_log ${join(TMP, 'error.log')} warn;
events { worker_connections 64; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  ${temp}
${conf}
}
`);
const t = spawnSync('nginx', ['-t', '-c', join(TMP, 'nginx.conf'), '-p', TMP], { encoding: 'utf8' });
ok(t.status === 0, 'nginx -t: Konfiguration gültig', t.stderr);
const nginx = spawn('nginx', ['-c', join(TMP, 'nginx.conf'), '-p', TMP], { stdio: ['ignore', 'pipe', 'pipe'] });
let started = false;
for (let i = 0; i < 50 && !started; i++) {
  try { await fetch(`http://127.0.0.1:${PORT}/`); started = true; } catch { await new Promise(r => setTimeout(r, 100)); }
}
if (!started) { console.log(readFileSync(join(TMP, 'error.log'), 'utf8')); process.exit(1); }

/** Rohe Antwort (rawHeaders, damit doppelte Kopfzeilen sichtbar bleiben). */
function get(path, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((res, rej) => {
    const r = request({ host: '127.0.0.1', port: PORT, path, method, headers }, resp => {
      let data = '';
      resp.on('data', d => { data += d; });
      resp.on('end', () => {
        const raw = {};
        for (let i = 0; i < resp.rawHeaders.length; i += 2) (raw[resp.rawHeaders[i].toLowerCase()] ||= []).push(resp.rawHeaders[i + 1]);
        res({ status: resp.statusCode, raw, h: k => (raw[k] || []).join(' | '), body: data });
      });
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}

try {
  // 1. + 2.
  const home = await get('/');
  ok(home.h('server') === 'nginx', '`Server:` ohne Version', home.h('server'));
  const csp = home.h('content-security-policy');
  ok(!/https?:\/\//.test(csp) && !/analytics\./.test(csp), 'CSP der App ohne fremden Host', csp);
  ok(/img-src 'self' data: blob:;/.test(csp) && !/https:/.test(csp), "CSP img-src 'self' data: blob: (kein https:)", csp);
  ok(/connect-src 'self';/.test(csp) && /script-src 'self';/.test(csp), 'CSP script-src und connect-src nur self', csp);
  ok(home.h('x-frame-options') === 'DENY', 'X-Frame-Options DENY', home.h('x-frame-options'));
  ok((home.raw['cache-control'] || []).length === 1, 'App-Seite: genau eine Cache-Control-Zeile', home.h('cache-control'));
  const active = home.body.replace(/<!--[\s\S]*?-->/g, '');
  ok(!/<script[^>]+src="(https?:)?\/\//.test(active), 'index.html lädt kein Skript von fremdem Host');
  ok(!/\/u\/script\.js/.test(active) && /<script defer src="\/u\/script\.js" data-host-url="\/u"/.test(home.body), 'index.html: Umami-Tag (/u/) nur auskommentiert');

  // 3.
  const asset = readdirSync(join(DIST, 'assets')).find(f => f.endsWith('.js'));
  const a = await get(`/assets/${asset}`);
  ok(a.status === 200, `Asset ${asset} ausgeliefert`);
  ok(a.h('x-content-type-options') === 'nosniff', 'Asset: nosniff', a.h('x-content-type-options'));
  ok(/max-age=63072000/.test(a.h('strict-transport-security')), 'Asset: HSTS', a.h('strict-transport-security'));
  ok((a.raw['cache-control'] || []).length === 1 && /immutable/.test(a.h('cache-control')), 'Asset: genau eine Cache-Control-Zeile (immutable)', a.h('cache-control'));
  ok(!a.raw.expires, 'Asset: kein zusätzliches Expires', a.h('expires'));
  const fontFile = existsSync(join(DIST, 'fonts')) ? readdirSync(join(DIST, 'fonts')).find(f => /\.woff2$/.test(f)) : null;
  if (fontFile) {
    const f = await get(`/fonts/${fontFile}`);
    ok(f.status === 200 && f.h('x-content-type-options') === 'nosniff' && /max-age=63072000/.test(f.h('strict-transport-security')) && (f.raw['cache-control'] || []).length === 1 && f.h('access-control-allow-origin') === '*', 'Schrift: nosniff, HSTS, eine Cache-Angabe, CORS', JSON.stringify(f.raw));
  }

  // 4.
  const st = await get('/.well-known/security.txt');
  ok(st.status === 200 && /^text\/plain/.test(st.h('content-type')), 'security.txt als text/plain', `${st.status} ${st.h('content-type')}`);
  ok(/^Contact: mailto:\S+@\S+$/m.test(st.body) && /^Expires: \d{4}-\d{2}-\d{2}T/m.test(st.body) && /^Preferred-Languages: de, en$/m.test(st.body) && /^Canonical: https:\/\/\S+\/\.well-known\/security\.txt$/m.test(st.body), 'security.txt: Contact, Expires, Preferred-Languages, Canonical');
  const exp = Date.parse((/^Expires: (\S+)$/m.exec(st.body) || [])[1]);
  ok(exp > Date.now() && exp < Date.now() + 366 * 864e5, 'security.txt: Expires in der Zukunft, höchstens ein Jahr', new Date(exp).toISOString());
  ok(!/<html/i.test(st.body), 'security.txt: nicht die SPA');

  // 5.
  const o = await get('/oauth/authorize?client_id=x');
  ok(!/<div id="root">/.test(o.body), '/oauth/authorize fällt nicht auf die SPA zurück', String(o.status));
  const wk = await get('/.well-known/oauth-authorization-server');
  ok(wk.status !== 200 || !/<html/i.test(wk.body), '/.well-known/oauth-authorization-server bleibt beim MCP-Weg (keine SPA)', String(wk.status));

  // 6.
  const s = await get('/u/script.js', { headers: { Cookie: 'session=geheim', 'X-Forwarded-For': '203.0.113.7, 10.0.0.2' } });
  const sReq = seen.find(x => x.url === '/script.js');
  ok(s.status === 200 && s.body === '/* umami */', '/u/script.js kommt vom Umami-Dienst', `${s.status} ${s.body.slice(0, 40)}`);
  ok(!s.raw['set-cookie'] && !s.raw['content-security-policy'] && !s.raw['access-control-allow-origin'], '/u/script.js: keine Cookies, keine fremde CSP/CORS', JSON.stringify(s.raw));
  ok((s.raw['cache-control'] || []).length === 1 && s.h('x-content-type-options') === 'nosniff', '/u/script.js: eine Cache-Angabe, nosniff', s.h('cache-control'));
  ok(sReq && !sReq.headers.cookie && sReq.headers.host === 'analytics.example.com', 'zum Umami-Dienst: ohne Cookie, Host aus $umami_host', JSON.stringify(sReq?.headers));
  const p = await get('/u/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=geheim', 'X-Forwarded-For': '203.0.113.7, 10.0.0.2', 'User-Agent': 'Pruefung/1.0' }, body: '{"type":"event","payload":{}}' });
  const pReq = seen.find(x => x.url === '/api/send');
  ok(p.status === 200 && pReq?.method === 'POST' && pReq.body.includes('"type":"event"'), '/u/api/send geht als POST an Umami', `${p.status}`);
  ok(pReq && !pReq.headers.cookie && !p.raw['set-cookie'], '/u/api/send: Cookies in keine Richtung', JSON.stringify(pReq?.headers));
  ok(pReq?.headers['x-client-ip'] === '203.0.113.7' && pReq?.headers['user-agent'] === 'Pruefung/1.0', '/u/api/send: Besucher-IP als X-Client-IP, Browserkennung bleibt', JSON.stringify(pReq?.headers));
  const u = await get('/u/api/website');
  ok(u.status === 404, 'sonst nichts unter /u/ (404)', String(u.status));

  // 7.
  for (const path of ['/widerruf/bestaetigen?token=x', '/kuendigen/bestaetigen?token=x', '/email-bestaetigen?token=x']) {
    const r = await get(path);
    ok(r.status === 200 && /<div id="root">/.test(r.body), `${path.split('?')[0]} → App`, String(r.status));
  }
} finally {
  nginx.kill('SIGTERM');
  umami.close();
}
console.log(fail ? `\n${fail} Befund(e)` : '\nohne Befund');
process.exit(fail ? 1 : 0);
