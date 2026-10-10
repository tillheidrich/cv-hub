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
//   8. Vorgerenderte Seiten und Magazin (Runde 8, 10.10.2026): / und /en/
//      /fr/ /es/ /preise liefern fertiges HTML (H1, JSON-LD, Canonical),
//      /en → /en/, unbekannte Pfade bekommen die App-Hülle (noindex),
//      /ratgeber/… leitet dauerhaft auf /magazin/… um, /magazin/ ist
//      statisch mit strenger CSP, unbekannte Artikel 404, /landing/ mit
//      langer Zwischenspeicherung und 404 statt App
//   9. Admin-Host (Runde 8b, 10.10.2026): nginx.conf ist eine Vorlage mit
//      ${ADMIN_HOST}. Mit Admin-Host liefert er nur admin.html (strenge CSP,
//      noindex, frame-ancestors 'none', kein Umami), reicht nur
//      /pdfapi/api/admin/* an cv-api weiter und sonst 404; auf dem Haupthost
//      gibt es /admin/ und /pdfapi/api/admin/* nicht (404, auch in anderer
//      Schreibweise). Ohne Admin-Host (admin.invalid, Selbsthoster) liegt die
//      Admin-Seite unter /admin/ und die Admin-API geht durch.
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
const API_PORT = Number(process.env.NGINX_API_STUB_PORT || 5293);
const LEGACY_PORT = Number(process.env.NGINX_LEGACY_PORT || 5294);
const ADMIN_HOST = 'admin.test';
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

// Ersatz für cv-api: merkt sich Pfad und Host.
const apiSeen = [];
const apiStub = createServer((req, res) => {
  apiSeen.push({ url: req.url, host: req.headers.host });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ stub: true, url: req.url }));
});
await new Promise(r => apiStub.listen(API_PORT, '127.0.0.1', r));

/** Vorlage wie im Container: ${ADMIN_HOST} ersetzt, Ports und Ziele umgelenkt. */
function confFor(port, adminHost) {
  return readFileSync(join(APP, 'nginx.conf'), 'utf8')
    .replace(/\$\{ADMIN_HOST\}/g, adminHost)
    .replace(/listen\s+80;/g, `listen 127.0.0.1:${port};`)
    .replace(/root\s+\/usr\/share\/nginx\/html;/g, `root ${DIST};`)
    .replace(/"cv-api:3000"/g, `"127.0.0.1:${API_PORT}"`)
    .replace(/proxy_pass https:\/\/\$umami_host\//g, `proxy_pass http://127.0.0.1:${UMAMI_PORT}/`);
}
const conf = confFor(PORT, ADMIN_HOST);
ok(!/\$\{ADMIN_HOST\}/.test(conf) && /server_name "admin\.test";/.test(conf), 'Vorlage: ${ADMIN_HOST} ersetzt');
ok(!/proxy_pass https:\/\/\$umami_host/.test(conf), 'Umami-Weiterleitung für die Prüfung auf den Ersatzdienst umgelenkt');
/** Startet ein nginx mit dieser Konfiguration in einem eigenen Arbeitsordner. */
async function startNginx(dir, cfg, port, label) {
  mkdirSync(dir, { recursive: true });
  const temp = ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map(n => `${n}_temp_path ${join(dir, n)};`).join('\n  ');
  writeFileSync(join(dir, 'nginx.conf'), `${process.getuid?.() === 0 ? 'user root;' : ''}
worker_processes 1;
daemon off;
pid ${join(dir, 'nginx.pid')};
error_log ${join(dir, 'error.log')} warn;
events { worker_connections 64; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  ${temp}
${cfg}
}
`);
  const t = spawnSync('nginx', ['-t', '-c', join(dir, 'nginx.conf'), '-p', dir], { encoding: 'utf8' });
  ok(t.status === 0, `nginx -t: Konfiguration gültig (${label})`, t.stderr);
  const proc = spawn('nginx', ['-c', join(dir, 'nginx.conf'), '-p', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    try { await fetch(`http://127.0.0.1:${port}/`); up = true; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  if (!up) { console.log(readFileSync(join(dir, 'error.log'), 'utf8')); process.exit(1); }
  return proc;
}
const nginx = await startNginx(TMP, conf, PORT, 'mit Admin-Host');

/** Rohe Antwort (rawHeaders, damit doppelte Kopfzeilen sichtbar bleiben). */
function get(path, { method = 'GET', headers = {}, body, port = PORT } = {}) {
  return new Promise((res, rej) => {
    const r = request({ host: '127.0.0.1', port, path, method, headers }, resp => {
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
  // Canonical ist nach RFC 9116 optional (J1, 10.10.2026: entfernt, damit ein
  // Domainwechsel die Datei nicht falsch macht). Steht es da, dann mit https.
  ok(/^Contact: mailto:\S+@\S+$/m.test(st.body) && /^Expires: \d{4}-\d{2}-\d{2}T/m.test(st.body) && /^Preferred-Languages: de, en$/m.test(st.body) && (!/^Canonical:/m.test(st.body) || /^Canonical: https:\/\/\S+\/\.well-known\/security\.txt$/m.test(st.body)), 'security.txt: Contact, Expires, Preferred-Languages (Canonical optional)');
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

  // 8.
  const vorgerendert = existsSync(join(DIST, 'app.html'));
  ok(vorgerendert, 'dist/app.html vorhanden (scripts/landing-prerender.mjs gelaufen)');
  if (vorgerendert) {
    for (const [pfad, lang] of [['/', 'de'], ['/en/', 'en'], ['/fr/', 'fr'], ['/es/', 'es']]) {
      const r = await get(pfad);
      ok(r.status === 200 && /id="prerender"/.test(r.body) && /<h1[^>]*>/.test(r.body) && new RegExp(`<html lang="${lang}"`).test(r.body), `${pfad}: vorgerendert (${lang}, H1)`, `${r.status}`);
      ok(/application\/ld\+json/.test(r.body) && /rel="canonical"/.test(r.body) && /hreflang="x-default"/.test(r.body), `${pfad}: JSON-LD, Canonical, hreflang`);
      ok(/script-src 'self';/.test(r.h('content-security-policy')) && (r.raw['cache-control'] || []).length === 1, `${pfad}: CSP der App, eine Cache-Control-Zeile`, r.h('content-security-policy'));
    }
    const enOhne = await get('/en');
    ok(enOhne.status === 301 && enOhne.h('location') === '/en/', '/en → 301 /en/ (relativ)', `${enOhne.status} ${enOhne.h('location')}`);
    const preise = await get('/preise');
    ok(preise.status === 200 && /data-kind="pricing"/.test(preise.body) && /<h1/.test(preise.body), '/preise: vorgerendert', String(preise.status));
    const preise2 = await get('/preise/');
    ok(preise2.status === 301 && preise2.h('location') === '/preise', '/preise/ → 301 /preise', `${preise2.status} ${preise2.h('location')}`);
    const spa = await get('/impressum');
    ok(spa.status === 200 && /<div id="root"><\/div>/.test(spa.body) && !/id="prerender"/.test(spa.body) && /name="robots" content="noindex/.test(spa.body), '/impressum → App-Hülle (noindex, ohne Vorrendern)', String(spa.status));
    const demo = await get('/demo');
    ok(demo.status === 200 && !/id="prerender"/.test(demo.body), '/demo → App-Hülle');
  }
  const rg = await get('/ratgeber/');
  ok(rg.status === 301 && rg.h('location') === '/magazin/', '/ratgeber/ → 301 /magazin/', `${rg.status} ${rg.h('location')}`);
  const rg2 = await get('/ratgeber');
  ok(rg2.status === 301 && rg2.h('location') === '/magazin/', '/ratgeber → 301 /magazin/', `${rg2.status} ${rg2.h('location')}`);
  const rga = await get('/ratgeber/lebenslauf-pdf-oder-word/');
  ok(rga.status === 301 && rga.h('location') === '/magazin/lebenslauf-pdf-oder-word/', '/ratgeber/<slug>/ → 301 /magazin/<slug>/', `${rga.status} ${rga.h('location')}`);
  if (existsSync(join(DIST, 'magazin', 'index.html'))) {
    const mg = await get('/magazin/');
    ok(mg.status === 200 && /script-src 'none'/.test(mg.h('content-security-policy')), '/magazin/: statisch, strenge CSP', `${mg.status}`);
    const mg404 = await get('/magazin/gibt-es-nicht/');
    ok(mg404.status === 404 && !/id="root"/.test(mg404.body), '/magazin/<unbekannt>/ → 404 (keine App)', String(mg404.status));
    const mj = await get('/magazin/index.json');
    ok(mj.status === 200 && /json/.test(mj.h('content-type')), '/magazin/index.json als JSON', mj.h('content-type'));
  }
  const lf = existsSync(join(DIST, 'landing')) ? readdirSync(join(DIST, 'landing')).find(f => /\.(webp|avif)$/.test(f)) : null;
  if (lf) {
    const l = await get(`/landing/${lf}?v=1`);
    ok(l.status === 200 && /immutable/.test(l.h('cache-control')) && (l.raw['cache-control'] || []).length === 1 && l.h('x-content-type-options') === 'nosniff', `/landing/${lf}: lange Zwischenspeicherung, nosniff`, l.h('cache-control'));
    const l404 = await get('/landing/fehlt.webp');
    ok(l404.status === 404, '/landing/<fehlt> → 404', String(l404.status));
  }
  // 9. Admin-Host
  const A = { Host: ADMIN_HOST };
  ok(existsSync(join(DIST, 'admin.html')), 'dist/admin.html vorhanden (eigenes Einstiegs-HTML)');
  const ad = await get('/', { headers: A });
  const acsp = ad.h('content-security-policy');
  ok(ad.status === 200 && /id="admin-root"/.test(ad.body) && !/id="root"/.test(ad.body), 'Admin-Host /: admin.html, nicht die App', `${ad.status}`);
  ok(!/u\/script\.js|umami/i.test(ad.body), 'Admin-Host: kein Umami im HTML');
  ok(/default-src 'none'/.test(acsp) && /script-src 'self';/.test(acsp) && /style-src 'self';/.test(acsp) && !/unsafe-inline/.test(acsp) && /frame-ancestors 'none'/.test(acsp) && /base-uri 'none'/.test(acsp), "Admin-Host: strenge CSP (default-src 'none', ohne unsafe-inline, frame-ancestors 'none')", acsp);
  ok(/noindex/.test(ad.h('x-robots-tag')) && ad.h('x-frame-options') === 'DENY' && ad.h('referrer-policy') === 'same-origin' && /no-store/.test(ad.h('cache-control')), 'Admin-Host: X-Robots-Tag noindex, DENY, same-origin, no-store', JSON.stringify(ad.raw));
  const adminJs = /src="(\/assets\/admin-[^"]+\.js)"/.exec(ad.body)?.[1];
  if (adminJs) {
    const aj = await get(adminJs, { headers: A });
    ok(aj.status === 200 && /immutable/.test(aj.h('cache-control')) && aj.h('x-content-type-options') === 'nosniff', `Admin-Host: Bündel ${adminJs} ausgeliefert`, `${aj.status}`);
  } else ok(false, 'Admin-Host: admin.html verweist auf ein eigenes Bündel /assets/admin-*.js');
  for (const path of ['/magazin/', '/preise', '/impressum', '/u/script.js', '/mcp', '/pdfapi/api/resumes', '/pdfapi/api/auth/me', '/pdfapi/api/ADMIN/overview', '/assets/gibt-es-nicht.js']) {
    const r = await get(path, { headers: A });
    ok(r.status === 404 && !/id="root"/.test(r.body), `Admin-Host ${path} → 404`, `${r.status}`);
  }
  apiSeen.length = 0;
  const aapi = await get('/pdfapi/api/admin/overview', { headers: A });
  ok(aapi.status === 200 && apiSeen.some(x => x.url === '/api/admin/overview' && x.host === ADMIN_HOST), 'Admin-Host /pdfapi/api/admin/* → cv-api (Präfix weg, Host bleibt)', JSON.stringify(apiSeen));
  // Haupthost: weder Admin-Seite noch Admin-API
  apiSeen.length = 0;
  for (const path of ['/pdfapi/api/admin/overview', '/pdfapi/api/admin', '/pdfapi/api/Admin/users', '/pdfapi/api/ADMIN/auth/login', '/admin/', '/admin']) {
    const r = await get(path);
    ok(r.status === 404, `Haupthost ${path} → 404`, `${r.status}`);
  }
  ok(apiSeen.length === 0, 'Haupthost: keine Admin-Anfrage erreicht cv-api', JSON.stringify(apiSeen));
  const tpl = await get('/pdfapi/api/templates');
  ok(tpl.status === 200 && apiSeen.some(x => x.url === '/api/templates'), 'Haupthost /pdfapi/api/templates geht weiter an cv-api', `${tpl.status}`);

  // 10. Ohne Admin-Host (Selbsthoster)
  const legacy = await startNginx(`${TMP}-legacy`, confFor(LEGACY_PORT, 'admin.invalid'), LEGACY_PORT, 'ohne Admin-Host');
  try {
    const la = await get('/admin/', { port: LEGACY_PORT });
    ok(la.status === 200 && /id="admin-root"/.test(la.body) && /default-src 'none'/.test(la.h('content-security-policy')) && /noindex/.test(la.h('x-robots-tag')), 'ohne Admin-Host: /admin/ liefert die Admin-Seite (strenge CSP, noindex)', `${la.status}`);
    const lr = await get('/admin', { port: LEGACY_PORT });
    ok(lr.status === 301 && lr.h('location') === '/admin/', 'ohne Admin-Host: /admin → /admin/', `${lr.status} ${lr.h('location')}`);
    apiSeen.length = 0;
    const lapi = await get('/pdfapi/api/admin/overview', { port: LEGACY_PORT });
    ok(lapi.status === 200 && apiSeen.some(x => x.url === '/api/admin/overview'), 'ohne Admin-Host: /pdfapi/api/admin/* geht an cv-api', `${lapi.status}`);
    const lhome = await get('/', { port: LEGACY_PORT });
    ok(lhome.status === 200 && /id="prerender"|id="root"/.test(lhome.body), 'ohne Admin-Host: Startseite unverändert', `${lhome.status}`);
  } finally {
    legacy.kill('SIGTERM');
  }
} finally {
  nginx.kill('SIGTERM');
  umami.close();
  apiStub.close();
}
console.log(fail ? `\n${fail} Befund(e)` : '\nohne Befund');
process.exit(fail ? 1 : 0);
