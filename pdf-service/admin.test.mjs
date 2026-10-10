// Admin-Bereich auf eigener Adresse und Statistik (Runde 8b, 10.10.2026).
//
// Echter Dienst gegen echte Postgres-Instanz, wie die anderen
// Integrationstests. Drei Instanzen auf derselben Datenbank:
//   A  mit ADMIN_HOST (so läuft es in der Produktion)
//   B  wie A, aber mit ADMIN_ALLOWED_IPS, die 127.0.0.1 nicht enthalten
//   C  ohne ADMIN_HOST (Selbsthoster, bisheriger Weg)
// Geprüft wird in beide Richtungen: Der Angriff scheitert, der Normalfall geht.
//
// Eigene Ports (Postgres 5667, API 3367–3369), damit die Datei neben den
// anderen laufen kann.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { startPostgres, startServer, findPgBin } from './testkit.mjs';
import { csvCell, invoicesCsv, invoiceGaps, parseCidrs, ipInCidrs, normHost, adminConfig, CSV_HEADER } from './admin.js';
import { cleanDims, langOfHtml, berlinDay } from './stats.js';

const PG_PORT = Number(process.env.ADMIN_PG_PORT || 5667);
const PORT_A = Number(process.env.ADMIN_API_PORT || 3367);
const PORT_B = PORT_A + 1;
const PORT_C = PORT_A + 2;
const ADMIN_HOST = 'admin.test';
const ADMIN_ORIGIN = 'https://admin.test';
const MAIN_HOST = 'cv.example.test';
const MAIN_ORIGIN = 'https://cv.example.test';
const PG_MISSING = findPgBin() ? false : 'keine Postgres-Binärdateien gefunden (PG_BIN setzen)';

/* ── Reine Funktionen ─────────────────────────────────────────────────── */

test('CSV: Injection am Zellanfang neutralisiert, Trennzeichen gequotet', () => {
  assert.equal(csvCell('=HYPERLINK("http://x")'), `"'=HYPERLINK(""http://x"")"`);
  assert.equal(csvCell('+49 151'), "'+49 151");
  assert.equal(csvCell('-2+3'), "'-2+3");
  assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(csvCell('\tx'), "'\tx");
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('Zeile\nzwei'), '"Zeile\nzwei"');
  assert.equal(csvCell('CV-2026-0001'), 'CV-2026-0001');
  assert.equal(csvCell(null), '');
});

test('CSV: Rechnungsexport mit Kopf, BOM, deutschem Betrag, Kleinunternehmer-Hinweis, Storno-Bezug', () => {
  const rows = [
    { invoice_no: 'CV-2026-0001', paid_at: '2026-03-01T10:00:00Z', order_no: 'B-1001', amount_cents: 900, currency: 'EUR', country: 'DE', method: 'paypal', status: 'paid' },
    { invoice_no: 'CV-2026-0002', paid_at: '2026-03-02T23:30:00Z', order_no: 'B-1002', amount_cents: 900, currency: 'EUR', country: '=cmd', method: null, status: 'refunded', withdrawn_at: '2026-03-05T09:00:00Z', refund_status: 'refunded' },
  ];
  const csv = invoicesCsv(rows);
  assert.ok(csv.startsWith('\ufeff'), 'BOM für Excel');
  const lines = csv.slice(1).split('\r\n').filter(Boolean);
  // P6 (B4): zur erstatteten Rechnung eine eigene Zeile für den Stornobeleg.
  assert.equal(lines.length, 4);
  assert.match(lines[3], /^CV-2026-0002-S;05\.03\.2026;B-1002;9,00;EUR;/);
  assert.match(lines[3], /hebt CV-2026-0002 auf/);
  assert.equal(lines[0], CSV_HEADER.join(';'));
  const a = lines[1].split(';');
  assert.deepEqual(a.slice(0, 5), ['CV-2026-0001', '01.03.2026', 'B-1001', '9,00', 'EUR']);
  assert.match(a[5], /§ 19 UStG/);
  assert.equal(a[7], 'PayPal');
  // 23:30 UTC am 2. März ist in Berlin schon der 3. März
  assert.equal(lines[2].split(';')[1], '03.03.2026');
  assert.match(lines[2], /;'=cmd;/, 'Land mit = am Anfang neutralisiert');
  assert.match(lines[2], /Widerruf vom 05\.03\.2026 zu CV-2026-0002/);
  assert.match(lines[2], /erstattet 9,00 EUR/);
  for (const line of lines.slice(1)) for (const cell of line.split(';')) assert.ok(!/^[=+\-@]/.test(cell), `Zelle beginnt gefährlich: ${cell}`);
});

test('Nummernkreis: Lücken, Doppelte, Zählerstand', () => {
  const g = invoiceGaps(['CV-2026-0001', 'CV-2026-0003', 'CV-2026-0003', 'CV-2025-0001'], [{ year: 2026, last: 4 }, { year: 2025, last: 1 }]);
  const y26 = g.find(x => x.year === 2026);
  assert.deepEqual(y26.missing, [2, 4]);
  assert.deepEqual(y26.duplicates, [3]);
  assert.equal(y26.ok, false);
  assert.equal(g.find(x => x.year === 2025).ok, true);
});

test('IP-Liste (CIDR) für IPv4, IPv6 und IPv4 in IPv6', () => {
  const { nets, invalid } = parseCidrs('203.0.113.0/24, 2001:db8:abcd::/48 ; 198.51.100.7, kaputt, 10.0.0.0/33');
  assert.deepEqual(invalid, ['kaputt', '10.0.0.0/33']);
  assert.ok(ipInCidrs('203.0.113.200', nets));
  assert.ok(ipInCidrs('::ffff:203.0.113.5', nets));
  assert.ok(ipInCidrs('2001:db8:abcd:12::1', nets));
  assert.ok(ipInCidrs('198.51.100.7', nets));
  assert.ok(!ipInCidrs('198.51.100.8', nets));
  assert.ok(!ipInCidrs('203.0.114.1', nets));
  assert.ok(!ipInCidrs('2001:db8:abce::1', nets));
  assert.ok(!ipInCidrs('kein-ip', nets));
});

test('Konfiguration: Host normalisiert, Ursprung aus ADMIN_URL oder https://ADMIN_HOST', () => {
  assert.equal(normHost('HTTPS://CV-Admin.Example.de:443/x'), 'cv-admin.example.de');
  assert.equal(normHost('localhost:5265'), 'localhost:5265');
  const c = adminConfig({ ADMIN_HOST: 'cv-admin.example.de' });
  assert.equal(c.separate, true);
  assert.equal(c.origin, 'https://cv-admin.example.de');
  const c2 = adminConfig({ ADMIN_HOST: 'localhost:5265', ADMIN_URL: 'http://localhost:5265/', UMAMI_DASHBOARD_URL: 'javascript:alert(1)' });
  assert.equal(c2.origin, 'http://localhost:5265');
  assert.equal(c2.umamiUrl, null, 'nur https-Adressen als Umami-Link');
  assert.equal(adminConfig({}).separate, false);
});

test('Zähler: nur Werte aus festen Listen, keine freien Texte', () => {
  const ids = new Set(['hamburg', 'oslo']);
  assert.deepEqual(cleanDims({ template: 'Hamburg', lang: 'de', format: 'a4', variant: 'ats', email: 'x@y.de', userId: 5 }, ids), { template: 'hamburg', lang: 'de', format: 'a4', variant: 'ats' });
  assert.deepEqual(cleanDims({ template: '<script>', lang: 'xx', format: 'a3' }, ids), {});
  assert.equal(langOfHtml('<!doctype html>\n<html lang="fr">'), 'fr');
  assert.equal(langOfHtml('<html lang="xx">'), null);
  assert.match(berlinDay(new Date('2026-03-02T23:30:00Z')), /^2026-03-03$/);
});

/* ── Gegen den laufenden Dienst ──────────────────────────────────────── */

/** HTTP mit frei wählbarem Host-Kopf (fetch erlaubt das nicht). */
function call(port, method, p, { host = MAIN_HOST, origin, cookie, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const h = { Host: host, ...headers };
    if (origin) h.Origin = origin;
    if (cookie) h.Cookie = cookie;
    let payload;
    if (body !== undefined) { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(payload); }
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: h }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data = raw;
        if (String(res.headers['content-type'] || '').includes('application/json')) { try { data = JSON.parse(raw); } catch { /* roh */ } }
        resolve({ status: res.statusCode, headers: res.headers, data, raw });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}
const cookieOf = (res, name) => (res.headers['set-cookie'] || []).map(c => c.split(';')[0]).find(c => c.startsWith(`${name}=`)) || null;

describe('Admin-Bereich gegen die laufende API', { skip: PG_MISSING }, () => {
  let pgInst, A, B, C, db, mailDir, mailFile;
  let adminCookie = '';
  let kundeId;
  const ADMIN_PW = 'admin-test-passwort-1';

  function lastCode() {
    const lines = existsSync(mailFile) ? readFileSync(mailFile, 'utf8').trim().split('\n').filter(Boolean) : [];
    for (const l of lines.reverse()) {
      const m = JSON.parse(l);
      if (/Admin-Anmeldung/.test(m.subject)) return { to: m.to, code: />(\d{6})</.exec(m.html)?.[1] };
    }
    return null;
  }
  async function adminLogin(port = PORT_A) {
    const l = await call(port, 'POST', '/api/admin/auth/login', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { username: 'root', password: ADMIN_PW } });
    assert.equal(l.status, 200, JSON.stringify(l.data));
    const { code } = lastCode();
    const v = await call(port, 'POST', '/api/admin/auth/verify', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { challenge: l.data.challenge, code } });
    assert.equal(v.status, 200, JSON.stringify(v.data));
    return { res: v, cookie: cookieOf(v, '__Host-cv_admin') };
  }
  const adm = (method, p, opts = {}) => call(PORT_A, method, p, { host: ADMIN_HOST, origin: method === 'GET' ? undefined : ADMIN_ORIGIN, cookie: adminCookie, ...opts });

  before(async () => {
    pgInst = await startPostgres(PG_PORT);
    mailDir = mkdtempSync(path.join(tmpdir(), 'cvadmin-mail-'));
    mailFile = path.join(mailDir, 'mails.jsonl');
    const env = {
      DATABASE_URL: pgInst.url,
      JWT_SECRET: 'admin-test-secret',
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: MAIN_ORIGIN,
      ALLOWED_ORIGINS: MAIN_ORIGIN,
      ADMIN_USERNAME: 'root',
      ADMIN_PASSWORD: ADMIN_PW,
      ADMIN_EMAIL: 'ops-admin@example.test',
      MAIL_CAPTURE_FILE: mailFile,
      JANITOR: '0', ACCESS_NOTICES: '0', BILLING_JOBS: '0',
      TRUST_PROXY: '',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
      TEST_RATE_LIMIT_FACTOR: '20',
      UMAMI_DASHBOARD_URL: 'https://analytics.example.test/websites/1',
    };
    A = await startServer({ ...env, ADMIN_HOST, ADMIN_URL: ADMIN_ORIGIN }, { port: PORT_A });
    B = await startServer({ ...env, ADMIN_HOST, ADMIN_URL: ADMIN_ORIGIN, ADMIN_ALLOWED_IPS: '10.9.9.0/24' }, { port: PORT_B });
    C = await startServer({ ...env, ADMIN_HOST: '', ADMIN_URL: '' }, { port: PORT_C });
    db = new pg.Pool({ connectionString: pgInst.url, max: 3 });
    const hash = await bcrypt.hash('kunde-passwort-1', 4);
    const { rows } = await db.query(
      `INSERT INTO users (username, password_hash, email, signup_source, email_confirmed_at, password_changed_at)
       VALUES ('lena', $1, 'lena@example.test', 'self', now(), now()) RETURNING id`, [hash]);
    kundeId = rows[0].id;
  });

  after(async () => {
    await db?.end().catch(() => {});
    await A?.stop(); await B?.stop(); await C?.stop();
    pgInst?.stop();
    try { rmSync(mailDir, { recursive: true, force: true }); } catch { /* egal */ }
  });

  test('Haupthost: /api/admin/* antwortet 404, in jeder Schreibweise, auch die Anmeldung', async () => {
    for (const p of ['/api/admin/overview', '/api/admin/users', '/api/ADMIN/overview', '/api/Admin/stats', '/api/admin/auth/session']) {
      const r = await call(PORT_A, 'GET', p, { host: MAIN_HOST });
      assert.equal(r.status, 404, `${p}: ${r.status}`);
    }
    const l = await call(PORT_A, 'POST', '/api/admin/auth/login', { host: MAIN_HOST, origin: MAIN_ORIGIN, body: { username: 'root', password: ADMIN_PW } });
    assert.equal(l.status, 404);
    // X-Forwarded-Host allein macht keinen Admin-Host
    const x = await call(PORT_A, 'GET', '/api/admin/auth/session', { host: MAIN_HOST, headers: { 'X-Forwarded-Host': ADMIN_HOST } });
    assert.equal(x.status, 404);
    // Normalbetrieb auf dem Haupthost läuft weiter
    assert.equal((await call(PORT_A, 'GET', '/api/templates', { host: MAIN_HOST })).status, 200);
  });

  test('Admin-Host: nur /api/admin/* und /health, sonst 404', async () => {
    for (const [m, p] of [['GET', '/api/templates'], ['GET', '/api/auth/me'], ['GET', '/api/resumes'], ['POST', '/api/auth/login'], ['GET', '/api/billing/offer']]) {
      const r = await call(PORT_A, m, p, { host: ADMIN_HOST, origin: m === 'POST' ? ADMIN_ORIGIN : undefined, body: m === 'POST' ? {} : undefined });
      assert.equal(r.status, 404, `${m} ${p}: ${r.status}`);
    }
    assert.equal((await call(PORT_A, 'GET', '/health', { host: ADMIN_HOST })).status, 200);
    const s = await call(PORT_A, 'GET', '/api/admin/auth/session', { host: ADMIN_HOST });
    assert.equal(s.status, 200);
    assert.deepEqual({ mode: s.data.mode, authenticated: s.data.authenticated }, { mode: 'separate', authenticated: false });
    assert.match(String(s.headers['x-robots-tag']), /noindex/);
    assert.match(String(s.headers['cache-control']), /no-store/);
  });

  test('Normales Cookie der Hauptdomain und API-Schlüssel geben auf dem Admin-Host keine Rechte', async () => {
    const login = await call(PORT_A, 'POST', '/api/auth/login', { host: MAIN_HOST, origin: MAIN_ORIGIN, body: { username: 'root', password: ADMIN_PW } });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    const main = cookieOf(login, 'cv_session');
    assert.ok(main);
    assert.equal(login.data.user.adminUrl, `${ADMIN_ORIGIN}/`, 'App bekommt nur den Link');
    const r = await call(PORT_A, 'GET', '/api/admin/overview', { host: ADMIN_HOST, cookie: main });
    assert.equal(r.status, 401);
    assert.equal(r.data.code, 'admin_login_required');
    const key = await call(PORT_A, 'POST', '/api/keys', { host: MAIN_HOST, origin: MAIN_ORIGIN, cookie: main, body: { name: 'test' } });
    assert.equal(key.status, 200, JSON.stringify(key.data));
    const r2 = await call(PORT_A, 'GET', '/api/admin/users', { host: ADMIN_HOST, headers: { Authorization: `Bearer ${key.data.key}` } });
    assert.equal(r2.status, 401);
    const s = await call(PORT_A, 'GET', '/api/admin/auth/session', { host: ADMIN_HOST, cookie: main });
    assert.equal(s.data.authenticated, false);
  });

  test('Admin-Sitzung erst nach Passwort UND Code; Cookie host-only, __Host-, Strict, Secure, HttpOnly', async () => {
    const bad = await call(PORT_A, 'POST', '/api/admin/auth/login', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { username: 'root', password: 'falsch-falsch' } });
    assert.equal(bad.status, 401);
    const notAdmin = await call(PORT_A, 'POST', '/api/admin/auth/login', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { username: 'lena', password: 'kunde-passwort-1' } });
    assert.equal(notAdmin.status, 401, 'Kundenkonto bekommt keinen Code');
    const l = await call(PORT_A, 'POST', '/api/admin/auth/login', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { username: 'root', password: ADMIN_PW } });
    assert.equal(l.status, 200);
    assert.ok(!cookieOf(l, '__Host-cv_admin'), 'nach dem Passwort noch kein Cookie');
    const mail = lastCode();
    assert.equal(mail.to, 'ops-admin@example.test', 'Code geht an ADMIN_EMAIL');
    assert.match(mail.code, /^\d{6}$/);
    const wrong = await call(PORT_A, 'POST', '/api/admin/auth/verify', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { challenge: l.data.challenge, code: mail.code === '000000' ? '111111' : '000000' } });
    assert.equal(wrong.status, 401);
    assert.ok(!cookieOf(wrong, '__Host-cv_admin'));
    // Ein Code aus der normalen Anmeldung taugt hier nicht: andere Tabelle.
    const v = await call(PORT_A, 'POST', '/api/admin/auth/verify', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { challenge: l.data.challenge, code: mail.code } });
    assert.equal(v.status, 200, JSON.stringify(v.data));
    const set = (v.headers['set-cookie'] || []).find(c => c.startsWith('__Host-cv_admin='));
    assert.ok(set, 'Cookie gesetzt');
    assert.match(set, /;\s*Path=\/(;|$)/);
    assert.match(set, /;\s*Secure/i);
    assert.match(set, /;\s*HttpOnly/i);
    assert.match(set, /;\s*SameSite=Strict/i);
    assert.doesNotMatch(set, /Domain=/i, 'host-only');
    assert.match(set, /Max-Age=28800/);
    adminCookie = cookieOf(v, '__Host-cv_admin');
    // Derselbe Code zweimal: nein.
    const again = await call(PORT_A, 'POST', '/api/admin/auth/verify', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { challenge: l.data.challenge, code: mail.code } });
    assert.equal(again.status, 400);
    const o = await adm('GET', '/api/admin/overview');
    assert.equal(o.status, 200, JSON.stringify(o.data));
    assert.ok(o.data.asOf && typeof o.data.accounts.total === 'number');
    // Das Admin-Cookie gilt auf dem Haupthost nicht (dort gibt es den Weg gar nicht).
    assert.equal((await call(PORT_A, 'GET', '/api/admin/overview', { host: MAIN_HOST, cookie: adminCookie })).status, 404);
    assert.equal((await call(PORT_A, 'GET', '/api/auth/me', { host: MAIN_HOST, cookie: adminCookie })).status, 401);
  });

  test('CSRF: schreibende Admin-Anfragen nur mit Origin des Admin-Hosts', async () => {
    const body = { days: 5, reason: 'Test' };
    const p = `/api/admin/customers/${kundeId}/grant`;
    const none = await call(PORT_A, 'POST', p, { host: ADMIN_HOST, cookie: adminCookie, body });
    assert.equal(none.status, 403); assert.equal(none.data.code, 'origin_required');
    const main = await call(PORT_A, 'POST', p, { host: ADMIN_HOST, origin: MAIN_ORIGIN, cookie: adminCookie, body });
    assert.equal(main.status, 403); assert.equal(main.data.code, 'origin_not_allowed');
    const nul = await call(PORT_A, 'POST', p, { host: ADMIN_HOST, origin: 'null', cookie: adminCookie, body });
    assert.equal(nul.status, 403);
    const site = await call(PORT_A, 'POST', p, { host: ADMIN_HOST, origin: ADMIN_ORIGIN, cookie: adminCookie, body, headers: { 'Sec-Fetch-Site': 'same-site' } });
    assert.equal(site.status, 403); assert.equal(site.data.code, 'cross_site');
    const read = await call(PORT_A, 'GET', '/api/admin/customers', { host: ADMIN_HOST, origin: MAIN_ORIGIN, cookie: adminCookie });
    assert.equal(read.status, 403, 'lesend mit fremdem Origin');
    assert.equal(read.headers['access-control-allow-origin'], undefined);
    const ok = await call(PORT_A, 'POST', p, { host: ADMIN_HOST, origin: ADMIN_ORIGIN, cookie: adminCookie, body, headers: { 'Sec-Fetch-Site': 'same-origin' } });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
  });

  test('IP-Liste: außerhalb von ADMIN_ALLOWED_IPS kein Zugang, auch nicht zur Anmeldung', async () => {
    const r = await call(PORT_B, 'POST', '/api/admin/auth/login', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { username: 'root', password: ADMIN_PW } });
    assert.equal(r.status, 403);
    assert.equal(r.data.code, 'ip_not_allowed');
    assert.equal((await call(PORT_B, 'GET', '/api/admin/overview', { host: ADMIN_HOST, cookie: adminCookie })).status, 403);
    // Ohne Liste (A) geht es — dieselbe Sitzung.
    assert.equal((await adm('GET', '/api/admin/overview')).status, 200);
  });

  test('Protokoll: jede Aktion mit Admin, Ziel, Zeit und gekürzter Adresse; Grund ist Pflicht', async () => {
    const before = (await db.query('SELECT count(*)::int n FROM admin_audit')).rows[0].n;
    const noReason = await adm('POST', `/api/admin/customers/${kundeId}/grant`, { body: { days: 3 } });
    assert.equal(noReason.status, 400); assert.equal(noReason.data.code, 'reason_required');
    assert.equal((await db.query('SELECT count(*)::int n FROM admin_audit')).rows[0].n, before, 'abgelehnte Aktion ohne Eintrag');
    assert.equal((await adm('POST', `/api/admin/customers/${kundeId}/grant`, { body: { days: 7, reason: 'Kulanz Supportfall' } })).status, 200);
    assert.equal((await adm('POST', `/api/admin/customers/${kundeId}/disable`, { body: { disabled: true } })).status, 200);
    assert.equal((await adm('POST', `/api/admin/customers/${kundeId}/disable`, { body: { disabled: false } })).status, 200);
    assert.equal((await adm('POST', `/api/admin/customers/${kundeId}/end-sessions`, { body: {} })).status, 200);
    assert.equal((await adm('GET', `/api/admin/customers/${kundeId}`)).status, 200);
    assert.equal((await adm('POST', '/api/admin/system/test-mail', { body: {} })).status, 200);
    // Bisherige Route aus server.js läuft ebenfalls über das Protokoll.
    assert.equal((await adm('POST', '/api/admin/invites', { body: { maxUses: 2, note: 'Pilot' } })).status, 200);
    await new Promise(r => setTimeout(r, 150));
    const { rows } = await db.query(`SELECT a.action, a.target, a.details, a.ip_net, a.via, u.username FROM admin_audit a LEFT JOIN users u ON u.id = a.admin_id ORDER BY a.id`);
    const acts = rows.map(r => r.action);
    for (const a of ['admin_login', 'admin_login_failed', 'customer_grant', 'customer_disable', 'customer_enable', 'customer_end_sessions', 'customer_view', 'test_mail', 'POST /api/admin/invites']) {
      assert.ok(acts.includes(a), `Eintrag ${a} fehlt: ${acts.join(', ')}`);
    }
    const g = rows.filter(r => r.action === 'customer_grant').at(-1);
    assert.equal(g.target, String(kundeId));
    assert.equal(g.username, 'root');
    assert.equal(g.details.reason, 'Kulanz Supportfall');
    assert.equal(g.via, 'separate');
    assert.equal(g.ip_net, '127.0.0.0/24', 'nur das Netz, nicht die Adresse');
    const list = await adm('GET', '/api/admin/audit');
    assert.equal(list.status, 200);
    assert.ok(list.data.entries.length >= 8 && list.data.retentionDays === 365);
    const mails = readFileSync(mailFile, 'utf8');
    assert.match(mails, /Testmail aus dem Admin-Bereich/);
  });

  test('Kundensuche und Detail: ohne Passwort-Hash, mit Zugängen und Zählern', async () => {
    const s = await adm('GET', '/api/admin/customers?q=lena%40');
    assert.equal(s.status, 200);
    assert.equal(s.data.customers.length, 1);
    const pct = await adm('GET', '/api/admin/customers?q=%25');
    assert.equal(pct.data.customers.length, 0, '% ist ein Zeichen, kein Platzhalter');
    const d = await adm('GET', `/api/admin/customers/${kundeId}`);
    assert.equal(d.data.account.username, 'lena');
    assert.ok(!JSON.stringify(d.data).includes('password_hash') && !JSON.stringify(d.data).includes('$2a$'));
    assert.ok(d.data.grants.some(x => x.source === 'admin'));
    assert.equal(typeof d.data.counts.versions, 'number');
  });

  test('Zähler ohne Personenbezug: Tageszeilen ohne Nutzer, nur bekannte Werte', async () => {
    const login = await call(PORT_A, 'POST', '/api/auth/login', { host: MAIN_HOST, origin: MAIN_ORIGIN, body: { username: 'lena', password: 'kunde-passwort-1' } });
    const kc = cookieOf(login, 'cv_session');
    assert.ok(kc, JSON.stringify(login.data));
    for (const b of [
      { kind: 'docx', template: 'hamburg', lang: 'de', variant: 'ats' },
      { kind: 'docx', template: 'gibt-es-nicht<script>', lang: 'xx', email: 'lena@example.test' },
      { kind: 'latex', template: 'oslo', lang: 'en' },
      { kind: 'pdf_local', format: 'letter' },
    ]) {
      const r = await call(PORT_A, 'POST', '/api/events', { host: MAIN_HOST, origin: MAIN_ORIGIN, cookie: kc, body: b });
      assert.equal(r.status, 204, JSON.stringify(r.data));
    }
    const u = await adm('GET', '/api/admin/usage?days=30');
    assert.equal(u.status, 200);
    assert.equal(u.data.metrics.docx.total, 2);
    assert.deepEqual(u.data.metrics.docx.dims.template.map(x => x.value), ['hamburg']);
    assert.equal(u.data.metrics.latex.total, 1);
    assert.equal(u.data.metrics.pdf_browser.dims.format[0].value, 'letter');
    assert.ok(u.data.metrics.mail_sent.total >= 1, 'Mailzähler über den Hook');
    assert.equal(u.data.umamiUrl, 'https://analytics.example.test/websites/1');
    const cols = (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'usage_daily'`)).rows.map(r => r.column_name).sort();
    assert.deepEqual(cols, ['day', 'dim', 'metric', 'n', 'value']);
    const all = (await db.query('SELECT metric, dim, value FROM usage_daily')).rows;
    for (const r of all) {
      assert.ok(!/@|<|script|lena/i.test(r.value), `freier Text im Zähler: ${r.value}`);
      assert.notEqual(r.value, String(kundeId));
    }
  });

  test('Rechnungen: Liste, Lückenprüfung, CSV mit Kopf und neutralisierten Zellen; PDF nur mit Sitzung', async () => {
    await db.query(`INSERT INTO invoice_counters (year, last) VALUES (2026, 3) ON CONFLICT (year) DO UPDATE SET last = 3`);
    const ins = (no, inv, country, status, extra = '') => db.query(
      `INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, status, paid_at, pass_days, invoice_no ${extra ? ', withdrawn_at, refund_status' : ''})
       VALUES (gen_random_uuid(), $1, $2, 'lena@example.test', '=HYPERLINK("x")', $3, 'pass90', 900, $4, '2026-03-10T10:00:00Z', 90, $5 ${extra ? ", '2026-03-12T10:00:00Z', 'refunded'" : ''})`,
      [no, kundeId, country, status, inv]);
    await ins('B-9001', 'CV-2026-0001', 'DE', 'paid');
    await ins('B-9003', 'CV-2026-0003', '+AT', 'refunded', 'x');
    const list = await adm('GET', '/api/admin/invoices?year=2026');
    assert.equal(list.status, 200);
    assert.equal(list.data.invoices.length, 2);
    assert.equal(list.data.sumCents, 900);
    const g = list.data.gaps.find(x => x.year === 2026);
    assert.deepEqual(g.missing, [2]);
    const csv = await adm('GET', '/api/admin/invoices.csv?year=2026&month=3');
    assert.equal(csv.status, 200);
    assert.match(String(csv.headers['content-type']), /text\/csv/);
    assert.match(String(csv.headers['content-disposition']), /Rechnungen-2026-03\.csv/);
    const lines = csv.raw.replace(/^\ufeff/, '').split('\r\n').filter(Boolean);
    // P6 (B4): Kopf, zwei Rechnungen und der Stornobeleg zur widerrufenen.
    assert.equal(lines.length, 4);
    assert.ok(!csv.raw.includes('HYPERLINK'), 'Name steht nicht im Export');
    assert.match(lines[2], /;'\+AT;/);
    assert.match(lines[2], /Widerruf vom 12\.03\.2026/);
    assert.match(lines[3], /^CV-2026-0003-S;12\.03\.2026;B-9003;9,00;/, 'Stornobeleg mit eigener Nummer und Datum des Widerrufs');
    assert.match(lines[3], /Stornobeleg/);
    assert.match(lines[3], /hebt CV-2026-0003 auf/);
    assert.match(lines[3], /;'\+AT;/, 'auch im Storno neutralisiert');
    const bad = await adm('GET', '/api/admin/invoices.csv?year=abc');
    assert.equal(bad.status, 400);
    const noSess = await call(PORT_A, 'GET', '/api/admin/invoices.csv?year=2026', { host: ADMIN_HOST });
    assert.equal(noSess.status, 401);
    const audit = await db.query(`SELECT 1 FROM admin_audit WHERE action = 'invoices_csv' AND target = 'Rechnungen-2026-03'`);
    assert.equal(audit.rowCount, 1, 'Export steht im Protokoll');
    const pay = await adm('GET', '/api/admin/payments');
    assert.equal(pay.status, 200);
    assert.ok(pay.data.reconcile.paidNoAccess.some(o => o.order_no === 'B-9001'), 'bezahlt ohne Zugang wird gemeldet');
  });

  test('Überblick, Verlauf, Trichter, System: Zahlen mit Stand, keine Werte von Geheimnissen', async () => {
    const o = await adm('GET', '/api/admin/overview');
    assert.ok(o.data.money.total_cents >= 900);
    assert.ok(o.data.storage.dbBytes > 0);
    const t = await adm('GET', '/api/admin/timeseries?days=90');
    assert.equal(t.data.series.length, 90);
    assert.equal(t.data.series.at(-1).day, berlinDay());
    assert.equal((await adm('GET', '/api/admin/timeseries?days=7')).data.days, 30, 'nur 30/90/365');
    const f = await adm('GET', '/api/admin/funnel?days=30');
    assert.ok(f.data.registered >= 1);
    const s = await adm('GET', '/api/admin/system');
    assert.equal(s.status, 200);
    const txt = JSON.stringify(s.data);
    assert.ok(!txt.includes('admin-test-secret') && !txt.includes(ADMIN_PW), 'keine Werte');
    assert.equal(s.data.admin.mode, 'separate');
    assert.ok(Array.isArray(s.data.billing.missing));
    assert.ok(s.data.missing.some(m => m.name === 'TRUST_PROXY'));
  });

  test('Löschen nur mit eingetipptem Nutzernamen', async () => {
    const hash = await bcrypt.hash('weg-passwort-1', 4);
    const { rows } = await db.query(`INSERT INTO users (username, password_hash, email) VALUES ('weg', $1, 'weg@example.test') RETURNING id`, [hash]);
    const id = rows[0].id;
    const wrong = await adm('POST', `/api/admin/customers/${id}/delete`, { body: { confirmUsername: 'WEG' } });
    assert.equal(wrong.status, 400); assert.equal(wrong.data.code, 'confirm_mismatch');
    assert.equal((await db.query('SELECT 1 FROM users WHERE id = $1', [id])).rowCount, 1);
    const root = (await db.query(`SELECT id FROM users WHERE username = 'root'`)).rows[0].id;
    assert.equal((await adm('POST', `/api/admin/customers/${root}/delete`, { body: { confirmUsername: 'root' } })).status, 400, 'Admin-Konto nie');
    const ok = await adm('POST', `/api/admin/customers/${id}/delete`, { body: { confirmUsername: 'weg' } });
    assert.equal(ok.status, 200);
    assert.equal((await db.query('SELECT 1 FROM users WHERE id = $1', [id])).rowCount, 0);
  });

  test('Sitzung endet: 30 Minuten ohne Anfrage, nach 8 Stunden, beim Passwortwechsel, beim Abmelden', async () => {
    const hashOf = async c => (await import('node:crypto')).createHash('sha256').update(c.split('=')[1]).digest('hex');
    // Leerlauf
    let { cookie } = await adminLogin();
    await db.query(`UPDATE admin_sessions SET last_seen_at = now() - interval '31 minutes' WHERE token_hash = $1`, [await hashOf(cookie)]);
    assert.equal((await call(PORT_A, 'GET', '/api/admin/overview', { host: ADMIN_HOST, cookie })).status, 401);
    // absolut
    ({ cookie } = await adminLogin());
    await db.query(`UPDATE admin_sessions SET expires_at = now() - interval '1 second' WHERE token_hash = $1`, [await hashOf(cookie)]);
    assert.equal((await call(PORT_A, 'GET', '/api/admin/overview', { host: ADMIN_HOST, cookie })).status, 401);
    // Abmelden
    ({ cookie } = await adminLogin());
    assert.equal((await call(PORT_A, 'GET', '/api/admin/overview', { host: ADMIN_HOST, cookie })).status, 200);
    const out = await call(PORT_A, 'POST', '/api/admin/auth/logout', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, cookie });
    assert.equal(out.status, 200);
    assert.equal((await call(PORT_A, 'GET', '/api/admin/overview', { host: ADMIN_HOST, cookie })).status, 401);
    // Passwortwechsel (Marke wandert)
    ({ cookie } = await adminLogin());
    await db.query(`UPDATE users SET password_changed_at = now() + interval '1 second' WHERE username = 'root'`);
    assert.equal((await call(PORT_A, 'GET', '/api/admin/overview', { host: ADMIN_HOST, cookie })).status, 401);
  });

  test('Ohne ADMIN_HOST (Selbsthoster): bisheriger Weg über die normale Anmeldung bleibt', async () => {
    // Passwortmarke aus dem vorigen Test liegt in der Zukunft; normale Anmeldung stellt eine neue Sitzung aus.
    const login = await call(PORT_C, 'POST', '/api/auth/login', { host: MAIN_HOST, origin: MAIN_ORIGIN, body: { username: 'root', password: ADMIN_PW } });
    assert.equal(login.status, 200, JSON.stringify(login.data));
    assert.equal(login.data.user.adminUrl, '/admin/');
    const c = cookieOf(login, 'cv_session');
    const r = await call(PORT_C, 'GET', '/api/admin/overview', { host: MAIN_HOST, cookie: c });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const s = await call(PORT_C, 'GET', '/api/admin/auth/session', { host: MAIN_HOST, cookie: c });
    assert.deepEqual({ mode: s.data.mode, authenticated: s.data.authenticated, via: s.data.via }, { mode: 'legacy', authenticated: true, via: 'app-session' });
    const k = await call(PORT_C, 'POST', '/api/auth/login', { host: MAIN_HOST, origin: MAIN_ORIGIN, body: { username: 'lena', password: 'kunde-passwort-1' } });
    const kc = cookieOf(k, 'cv_session');
    assert.equal((await call(PORT_C, 'GET', '/api/admin/overview', { host: MAIN_HOST, cookie: kc })).status, 403, 'Kundin ist kein Admin');
    assert.equal(k.data.user.adminUrl, undefined);
    // Fremder Ursprung bleibt auch hier draußen (allgemeine Prüfung).
    assert.equal((await call(PORT_C, 'POST', `/api/admin/customers/${kundeId}/disable`, { host: MAIN_HOST, origin: 'https://evil.example', cookie: c, body: { disabled: true } })).status, 403);
  });
});
