// Admin → Verkauf (20.10.2026, salesettings.js, saleadmin.js).
//
// Echter Dienst gegen echte Postgres-Instanz, Mollie als Attrappe. Geprüft:
// Schlüssel werden bei Mollie geprüft und nie zurückgegeben, Testbetrieb nur
// für Testkonten, Live nur mit Live-Schlüssel und Bestätigung, Registrierung
// umschaltbar, alles ohne Neustart. Eigene Ports (Postgres 5671, API 3371,
// Mollie-Attrappe 3372).

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { startPostgres, startServer, findPgBin } from './testkit.mjs';
import { validateSale, effectiveEnv, keyHint } from './salesettings.js';
import { effectiveAltchaKey } from './altcha.js';
import { billingConfig, isTester } from './billing.js';

const PG_PORT = Number(process.env.SALE_PG_PORT || 5671);
const PORT = Number(process.env.SALE_API_PORT || 3371);
const MOLLIE_PORT = PORT + 1;
const ADMIN_HOST = 'admin.test';
const ADMIN_ORIGIN = 'https://admin.test';
const MAIN_HOST = 'cv.example.test';
const MAIN_ORIGIN = 'https://cv.example.test';
const PG_MISSING = findPgBin() ? false : 'keine Postgres-Binärdateien gefunden (PG_BIN setzen)';
const TEST_KEY = 'test_GueltigerTestschluessel1234';
const LIVE_KEY = 'live_GueltigerLiveschluessel123';

/* ── Reine Funktionen ─────────────────────────────────────────────────── */

test('Bot-Schutz: ohne ALTCHA_HMAC_KEY aus JWT_SECRET abgeleitet, eigener Wert geht vor', () => {
  const a = effectiveAltchaKey({ JWT_SECRET: 'ein-langes-geheimnis-fuer-sitzungen' });
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, 'ein-langes-geheimnis-fuer-sitzungen');
  assert.equal(effectiveAltchaKey({ JWT_SECRET: 'x'.repeat(20), ALTCHA_HMAC_KEY: 'HIER_EINTRAGEN' }).length, 64, 'Platzhalter zählt nicht');
  assert.equal(effectiveAltchaKey({ JWT_SECRET: 'x', ALTCHA_HMAC_KEY: 'k'.repeat(40) }), 'k'.repeat(40));
  assert.equal(effectiveAltchaKey({}), '');
});

test('Eingaben: Modus, Testkonten, Schlüsselformat', () => {
  assert.equal(validateSale({ mode: 'x' }).ok, false);
  assert.equal(validateSale({ testKey: 'live_abcdefghijklmnopqrstuvwxyz' }).ok, false);
  assert.equal(validateSale({ liveKey: 'test_abcdefghijklmnopqrstuvwxyz' }).ok, false);
  assert.equal(validateSale({ testers: 'keine-adresse' }).ok, false);
  const v = validateSale({ mode: 'test', testers: 'A@B.de, a@b.de; c@d.de', testKey: '  ' });
  assert.equal(v.ok, true);
  assert.equal(v.value.testers, 'a@b.de,c@d.de');
  assert.equal(v.value.testKey, undefined, 'leer = unverändert');
  assert.equal(keyHint(TEST_KEY), 'test_…1234');
});

test('Testbetrieb: Kauf nur für Testkonten, öffentlich zu, Gratis-Grenze nur für sie', () => {
  const env = {
    BILLING_ENABLED: '1', BILLING_TESTERS_ONLY: '1', BILLING_TESTERS: 'Lena@Example.test', MOLLIE_API_KEY: TEST_KEY,
    SELLER_NAME: 'S', SELLER_ADDRESS: 'A', SELLER_EMAIL: 's@e.test', SELLER_PHONE: '1', PUBLIC_BASE_URL: 'https://x.test', JWT_SECRET: 'j'.repeat(20),
  };
  const cfg = billingConfig(env);
  assert.equal(cfg.ready, false);
  assert.equal(cfg.readyForTesters, true, cfg.missing.join(','));
  assert.equal(isTester(cfg, { email: 'lena@example.test' }), true);
  assert.equal(isTester(cfg, { email: 'max@example.test' }), false);
  assert.equal(isTester(cfg, null), false);
  // Eine gespeicherte Zeile geht der Umgebung vor.
  const eff = effectiveEnv({ BILLING_ENABLED: '1', OPEN_REGISTRATION: '1', MOLLIE_API_KEY: LIVE_KEY }, { mode: 'off', registration: false, testers: '' });
  assert.equal(eff.BILLING_ENABLED, '0');
  assert.equal(eff.OPEN_REGISTRATION, '0');
  assert.equal(eff.MOLLIE_API_KEY, '');
});

/* ── Gegen die laufende API ───────────────────────────────────────────── */

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

describe('Admin → Verkauf gegen die laufende API', { skip: PG_MISSING }, () => {
  let pgInst, A, db, mailDir, mailFile, mollie;
  let adminCookie = '';
  const ADMIN_PW = 'admin-test-passwort-1';
  const seen = [];

  function lastCode() {
    const lines = existsSync(mailFile) ? readFileSync(mailFile, 'utf8').trim().split('\n').filter(Boolean) : [];
    for (const l of lines.reverse()) {
      const m = JSON.parse(l);
      if (/Admin-Anmeldung/.test(m.subject)) return { to: m.to, code: />(\d{6})</.exec(m.html)?.[1] };
    }
    return null;
  }
  const adm = (method, p, opts = {}) => call(PORT, method, p, { host: ADMIN_HOST, origin: method === 'GET' ? undefined : ADMIN_ORIGIN, cookie: adminCookie, ...opts });
  async function userCookie(username, password) {
    const r = await call(PORT, 'POST', '/api/auth/login', { origin: MAIN_ORIGIN, body: { username, password } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return cookieOf(r, 'cv_session');
  }
  const offer = (cookie) => call(PORT, 'GET', '/api/billing/offer', { cookie });

  before(async () => {
    mollie = http.createServer((req, res) => {
      const auth = String(req.headers.authorization || '');
      seen.push(`${req.method} ${req.url} ${auth.slice(7, 12)}`);
      const valid = auth === `Bearer ${TEST_KEY}` || auth === `Bearer ${LIVE_KEY}`;
      res.setHeader('Content-Type', 'application/json');
      if (!valid) { res.statusCode = 401; return res.end(JSON.stringify({ status: 401, title: 'Unauthorized Request' })); }
      if (req.method === 'GET' && req.url.startsWith('/v2/methods')) {
        return res.end(JSON.stringify({ _embedded: { methods: [{ id: 'creditcard', description: 'Kreditkarte' }, { id: 'paypal', description: 'PayPal' }] } }));
      }
      res.statusCode = 404; res.end('{}');
    });
    await new Promise(r => mollie.listen(MOLLIE_PORT, '127.0.0.1', r));
    pgInst = await startPostgres(PG_PORT);
    mailDir = mkdtempSync(path.join(tmpdir(), 'cvsale-mail-'));
    mailFile = path.join(mailDir, 'mails.jsonl');
    A = await startServer({
      DATABASE_URL: pgInst.url, JWT_SECRET: 'sale-test-secret-0123456789', NODE_ENV: 'test',
      PUBLIC_BASE_URL: MAIN_ORIGIN, ALLOWED_ORIGINS: MAIN_ORIGIN,
      ADMIN_USERNAME: 'root', ADMIN_PASSWORD: ADMIN_PW, ADMIN_EMAIL: 'admin@example.test',
      ADMIN_HOST, ADMIN_URL: ADMIN_ORIGIN,
      MAIL_CAPTURE_FILE: mailFile, JANITOR: '0', ACCESS_NOTICES: '0', BILLING_JOBS: '0', TRUST_PROXY: '',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', TEST_RATE_LIMIT_FACTOR: '20',
      // Umgebung wie in einer frischen Installation: Verkauf aus, Platzhalter statt Schlüssel.
      BILLING_ENABLED: '0', OPEN_REGISTRATION: '0', MOLLIE_API_KEY: 'HIER_EINTRAGEN', ALTCHA_HMAC_KEY: 'HIER_EINTRAGEN',
      MOLLIE_API_BASE: `http://127.0.0.1:${MOLLIE_PORT}/v2`,
      SELLER_NAME: 'Test Content Creation', SELLER_ADDRESS: 'Testweg 1 | 12345 Teststadt', SELLER_EMAIL: 'verkauf@example.test', SELLER_PHONE: '+49 000 0000',
      PASS_PRICE_CENTS: '900', PASS_DAYS: '90',
    }, { port: PORT });
    db = new pg.Pool({ connectionString: pgInst.url, max: 3 });
    for (const [u, e] of [['lena', 'lena@example.test'], ['max', 'max@example.test']]) {
      const hash = await bcrypt.hash('kunde-passwort-1', 4);
      await db.query(`INSERT INTO users (username, password_hash, email, signup_source, email_confirmed_at, password_changed_at) VALUES ($1, $2, $3, 'self', now(), now())`, [u, hash, e]);
    }
    const l = await call(PORT, 'POST', '/api/admin/auth/login', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { username: 'root', password: ADMIN_PW } });
    assert.equal(l.status, 200, JSON.stringify(l.data));
    const v = await call(PORT, 'POST', '/api/admin/auth/verify', { host: ADMIN_HOST, origin: ADMIN_ORIGIN, body: { challenge: l.data.challenge, code: lastCode().code } });
    assert.equal(v.status, 200, JSON.stringify(v.data));
    adminCookie = cookieOf(v, '__Host-cv_admin');
  });

  after(async () => {
    await db?.end().catch(() => {});
    await A?.stop();
    pgInst?.stop();
    mollie?.close();
    try { rmSync(mailDir, { recursive: true, force: true }); } catch { /* egal */ }
  });

  test('Ohne Anmeldung kein Zugriff, auf dem Haupthost 404', async () => {
    assert.equal((await call(PORT, 'GET', '/api/admin/sale', { host: ADMIN_HOST })).status, 401);
    assert.equal((await call(PORT, 'GET', '/api/admin/sale', { host: MAIN_HOST })).status, 404);
  });

  test('Anfangsstand: Umgebung, Verkauf aus, Bot-Schutz aus JWT_SECRET aktiv', async () => {
    const s = await adm('GET', '/api/admin/sale');
    assert.equal(s.status, 200);
    assert.equal(s.data.source, 'env');
    assert.equal(s.data.effective.mode, 'off');
    assert.equal(s.data.checks.find(c => c.id === 'bot').ok, true, 'Platzhalter in ALTCHA_HMAC_KEY → abgeleitet');
    assert.equal((await offer()).data.enabled, false);
  });

  test('Falscher Schlüssel: von Mollie abgelehnt, nichts gespeichert', async () => {
    const r = await adm('POST', '/api/admin/sale', { body: { testKey: 'test_Falscherschluessel123456789' } });
    assert.equal(r.status, 422);
    assert.equal(r.data.code, 'test_key_invalid');
    assert.equal((await adm('GET', '/api/admin/sale')).data.source, 'env');
  });

  test('Testbetrieb: nur das Testkonto sieht und kauft, alle anderen nicht', async () => {
    const r = await adm('POST', '/api/admin/sale', { body: { testKey: TEST_KEY, testers: ['lena@example.test'], mode: 'test' } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.deepEqual(r.data.methods.test.map(m => m.id), ['creditcard', 'paypal']);
    assert.equal(r.data.effective.mode, 'test');
    assert.equal(r.data.effective.testersSale, true, JSON.stringify(r.data.effective.missing));
    assert.equal(r.data.effective.publicSale, false);
    assert.equal(r.data.stored.testKey.hint, 'test_…1234');
    assert.ok(!r.raw.includes(TEST_KEY), 'Schlüssel steht in keiner Antwort');
    const stored = (await db.query('SELECT test_key_enc FROM sale_settings')).rows[0].test_key_enc;
    assert.ok(stored && !stored.includes(TEST_KEY), 'verschlüsselt gespeichert');

    assert.equal((await offer()).data.enabled, false, 'öffentlich zu');
    const lena = await userCookie('lena', 'kunde-passwort-1');
    const o = await offer(lena);
    assert.equal(o.data.enabled, true);
    assert.equal(o.data.testMode, true);
    const max = await userCookie('max', 'kunde-passwort-1');
    assert.equal((await offer(max)).data.enabled, false);
    const c = await call(PORT, 'POST', '/api/billing/checkout', { origin: MAIN_ORIGIN, cookie: max, body: {} });
    assert.equal(c.data.code, 'billing_disabled');
    const c2 = await call(PORT, 'POST', '/api/billing/checkout', { origin: MAIN_ORIGIN, cookie: lena, body: {} });
    assert.notEqual(c2.data.code, 'billing_disabled', 'Testkonto kommt durch die Sperre (scheitert dann an der Eingabe)');
  });

  test('Live nur mit Live-Schlüssel und ausdrücklicher Bestätigung', async () => {
    const a = await adm('POST', '/api/admin/sale', { body: { mode: 'live' } });
    assert.equal(a.status, 409);
    assert.equal(a.data.code, 'live_key_missing');
    const b = await adm('POST', '/api/admin/sale', { body: { mode: 'live', liveKey: LIVE_KEY } });
    assert.equal(b.status, 409);
    assert.equal(b.data.code, 'confirm_live');
    const c = await adm('POST', '/api/admin/sale', { body: { mode: 'live', confirmLive: true } });
    assert.equal(c.status, 200, JSON.stringify(c.data));
    assert.equal(c.data.effective.mode, 'live');
    assert.equal(c.data.effective.keyMode, 'live');
    assert.equal(c.data.effective.publicSale, true);
    const o = await offer();
    assert.equal(o.data.enabled, true);
    assert.equal(o.data.testMode, undefined);
    assert.ok(!c.raw.includes(LIVE_KEY));
  });

  test('Registrierung umschalten ohne Neustart; Aus schließt den Verkauf wieder', async () => {
    const r = await adm('POST', '/api/admin/sale', { body: { registration: true } });
    assert.equal(r.status, 200);
    assert.equal(r.data.effective.registrationOpen, true);
    assert.equal((await offer()).data.openRegistration, true);
    const off = await adm('POST', '/api/admin/sale', { body: { mode: 'off', registration: false } });
    assert.equal(off.status, 200);
    assert.equal((await offer()).data.enabled, false);
    assert.equal((await offer()).data.openRegistration, false);
    // Protokoll ohne Schlüssel
    const log = (await db.query(`SELECT details::text AS d FROM admin_audit WHERE action = 'sale_save'`)).rows.map(x => x.d).join(' ');
    assert.ok(log.length > 0);
    assert.ok(!log.includes(TEST_KEY) && !log.includes(LIVE_KEY));
  });
});
