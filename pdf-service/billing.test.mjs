// Integrationstests: Bewerbungs-Pass über Mollie, offene Registrierung (09.10.2026).
//
// Echter Dienst (server.js) gegen echte Postgres-Instanz und gegen einen
// Mollie-Mock-Server, der hier im Test läuft. Kein Aufruf geht nach außen,
// kein echter Schlüssel. Mails landen über MAIL_CAPTURE_FILE in einer Datei.
//
// Eigene Ports (Postgres 5481, API 3181), damit die Datei neben den anderen
// Integrationstests laufen kann. Wie dort: beide Richtungen prüfen — der
// Angriff scheitert, der Normalfall geht.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { startPostgres, startServer, client, findChromium, findPgBin } from './testkit.mjs';
import { runJanitor } from './janitor.js';
import { runAccessNotices } from './access.js';
import { createBilling, billingConfig, withdrawableUntil, isCountryCode } from './billing.js';
import { formatAmount, parseAmount, mollieLocale, checkApiBase } from './mollie.js';
import { createAltcha } from './altcha.js';
import { buildLegalJson, serialize as serializeLegal, LEGAL_DIR, LEGAL_JSON } from './scripts/sync-legal.mjs';

const PG_PORT = Number(process.env.BILLING_PG_PORT || 5481);
const API_PORT = Number(process.env.BILLING_API_PORT || 3181);
const chromiumPath = findChromium();
const DAY = 86_400_000;
const MOLLIE_KEY = 'test_mockmockmockmockmockmockmockmo';
const HAS_PDFTOTEXT = spawnSync('pdftotext', ['-v'], { encoding: 'utf8' }).status === 0;

// Kleine ALTCHA-Aufgaben, auch für die Instanzen, die dieser Test selbst baut.
process.env.ALTCHA_COST = '10';
process.env.ALTCHA_COUNTER_MIN = '5';
process.env.ALTCHA_COUNTER_MAX = '40';

const PG_MISSING = findPgBin() ? false : 'keine Postgres-Binärdateien gefunden (PG_BIN setzen)';

test('Rechtstexte: mailtexts/legal-texts.json entspricht app/src/legal', { skip: !existsSync(LEGAL_DIR) && 'app/ fehlt' }, async () => {
  const want = serializeLegal(await buildLegalJson());
  assert.equal(readFileSync(LEGAL_JSON, 'utf8'), want, 'legal-texts.json neu erzeugen: node scripts/sync-legal.mjs');
});

/* ── Mollie-Mock ─────────────────────────────────────────────────────────
 * Bildet die vier Aufrufe nach, die der Dienst benutzt, mit den Regeln aus
 * docs.mollie.com: Bearer-Schlüssel, Idempotency-Key (gleiche Antwort),
 * Erstattung nur für bezahlte Zahlungen. Zustand per Steuerfunktionen. */
function startMollieMock() {
  const payments = new Map();
  const refunds = new Map();
  const idem = new Map();
  const calls = [];
  let failNext = 0;
  const rid = p => `${p}_${crypto.randomBytes(5).toString('hex')}`;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', d => { raw += d; });
    req.on('end', () => {
      const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/hal+json' }); res.end(JSON.stringify(obj)); };
      const body = raw ? JSON.parse(raw) : undefined;
      const key = req.headers['idempotency-key'];
      calls.push({ method: req.method, url: req.url, body, idempotencyKey: key });
      if (req.headers.authorization !== `Bearer ${MOLLIE_KEY}`) return send(401, { status: 401, title: 'Unauthorized Request' });
      if (failNext > 0) { failNext -= 1; return send(503, { status: 503, title: 'Service Unavailable' }); }
      if (key && idem.has(`${req.method} ${req.url} ${key}`)) return send(201, idem.get(`${req.method} ${req.url} ${key}`));
      let m;
      if (req.method === 'POST' && req.url === '/v2/payments') {
        if (!/^\d+\.\d{2}$/.test(body?.amount?.value || '') || body.amount.currency !== 'EUR' || !body.description || !body.redirectUrl) {
          return send(422, { status: 422, title: 'Unprocessable Entity', detail: 'bad' });
        }
        const id = rid('tr');
        const p = {
          resource: 'payment', id, mode: 'test', status: 'open', amount: body.amount, description: body.description,
          redirectUrl: body.redirectUrl, webhookUrl: body.webhookUrl, metadata: body.metadata, locale: body.locale,
          createdAt: new Date().toISOString(), amountRefunded: { value: '0.00', currency: 'EUR' },
          _links: { checkout: { href: `https://www.mollie.com/checkout/test-mode?method=&token=${id}` } },
        };
        payments.set(id, p);
        if (key) idem.set(`${req.method} ${req.url} ${key}`, p);
        return send(201, p);
      }
      if (req.method === 'GET' && (m = /^\/v2\/payments\/(tr_\w+)$/.exec(req.url))) {
        const p = payments.get(m[1]);
        return p ? send(200, p) : send(404, { status: 404, title: 'Not Found' });
      }
      if (req.method === 'POST' && (m = /^\/v2\/payments\/(tr_\w+)\/refunds$/.exec(req.url))) {
        const p = payments.get(m[1]);
        if (!p) return send(404, { status: 404, title: 'Not Found' });
        if (p.status !== 'paid') return send(422, { status: 422, title: 'Unprocessable Entity' });
        const r = { resource: 'refund', id: rid('re'), paymentId: p.id, status: 'pending', amount: body.amount, description: body.description, metadata: body.metadata, createdAt: new Date().toISOString() };
        refunds.set(r.id, r);
        p.amountRefunded = body.amount;
        if (key) idem.set(`${req.method} ${req.url} ${key}`, r);
        return send(201, r);
      }
      if (req.method === 'GET' && (m = /^\/v2\/payments\/(tr_\w+)\/refunds\/(re_\w+)$/.exec(req.url))) {
        const r = refunds.get(m[2]);
        return r && r.paymentId === m[1] ? send(200, r) : send(404, { status: 404, title: 'Not Found' });
      }
      send(404, { status: 404, title: 'Not Found' });
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    base: `http://127.0.0.1:${server.address().port}/v2`,
    payments, refunds, calls,
    setStatus(id, status, extra = {}) {
      const p = payments.get(id);
      p.status = status;
      if (status === 'paid') p.paidAt = new Date().toISOString();
      Object.assign(p, extra);
    },
    setRefund(id, status) { refunds.get(id).status = status; },
    fail(n = 1) { failNext = n; },
    /** Zahlung direkt anlegen (für Bestellungen, die der Test selbst einträgt). */
    create(orderId, value = '9.00') {
      const id = rid('tr');
      payments.set(id, { resource: 'payment', id, status: 'open', amount: { value, currency: 'EUR' }, metadata: { orderId }, _links: { checkout: { href: 'https://www.mollie.com/checkout/x' } } });
      return id;
    },
    close: () => new Promise(r => server.close(r)),
  })));
}

/* ── ALTCHA im Test lösen (wie das Widget, nur in Node) ─────────────────── */
async function solveAltcha(base) {
  const ch = await (await fetch(`${base}/api/altcha/challenge`)).json();
  const solution = await solveChallenge({ challenge: ch, deriveKey, timeout: 20_000 });
  assert.ok(solution, 'ALTCHA-Aufgabe gelöst');
  return Buffer.from(JSON.stringify({ challenge: ch, solution })).toString('base64');
}

function pdfText(buf) {
  const r = spawnSync('pdftotext', ['-layout', '-', '-'], { input: buf, encoding: 'utf8' });
  return r.stdout || '';
}

describe('Bezahlung, Plan-Modell und offene Registrierung', { skip: PG_MISSING }, () => {
  let pgInst, srv, db, mollie, mailFile, mailDir;
  let Adm, Bestand, Pilot;
  let bestandId, pilotId;

  // Eine Zeile, die der Dienst gerade noch schreibt, ist noch kein JSON — überspringen statt abbrechen.
  const mails = () => (existsSync(mailFile) ? readFileSync(mailFile, 'utf8').trim().split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } }) : []);
  const mailsTo = to => mails().filter(m => m.to === to);
  const userRow = async id => (await db.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
  const orderRow = async id => (await db.query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];
  const webhook = id => fetch(`${srv.base}/api/billing/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `id=${encodeURIComponent(id)}` });
  const waitFor = async (fn, ms = 8000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 100)); }
    return fn();
  };
  const checkoutBody = (extra = {}) => ({ sku: 'pass90', country: 'DE', billingName: 'Erika Mustermann', acceptTerms: true, ageConfirmed18: true, ...extra });

  /** Offene Registrierung samt Bestätigung; gibt { C, id, email } zurück. */
  async function registerSelf(email, { confirm = true } = {}) {
    const C = client(srv.base);
    const r = await C.post('/api/auth/register', { email, password: 'kunden-passwort-1', altcha: await solveAltcha(srv.base), ageConfirmed16: true });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    if (confirm) {
      const m = await waitFor(() => mailsTo(email).find(x => /bestätige/.test(x.subject)));
      const token = /token=([A-Za-z0-9_-]+)/.exec(m.html)[1];
      assert.equal((await C.post('/api/auth/confirm-email', { token })).status, 200);
    }
    return { C, id: r.data.user.id, email };
  }

  /** Runde 6 (H2/M1): Link aus der Eingangsbestätigung öffentlicher Erklärungen klicken. */
  async function confirmFromMail(email, re) {
    const m = await waitFor(() => mailsTo(email).filter(x => re.test(x.subject)).at(-1));
    assert.ok(m, `Bestätigungsmail an ${email}`);
    const token = /bestaetigen\?token=([A-Za-z0-9_-]+)/.exec(m.html)[1];
    return fetch(`${srv.base}/api/billing/declarations/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  }

  /** Kauf bis „bezahlt“; gibt die Bestellung zurück. */
  async function buy(C, extra = {}) {
    const r = await C.post('/api/billing/checkout', checkoutBody(extra));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const o = await orderRow(r.data.orderId);
    mollie.setStatus(o.mollie_payment_id, 'paid');
    assert.equal((await webhook(o.mollie_payment_id)).status, 200);
    return orderRow(o.id);
  }

  before(async () => {
    pgInst = await startPostgres(PG_PORT);
    mollie = await startMollieMock();
    mailDir = mkdtempSync(path.join(tmpdir(), 'cvbill-mail-'));
    mailFile = path.join(mailDir, 'mails.jsonl');
    srv = await startServer({
      DATABASE_URL: pgInst.url,
      JWT_SECRET: 'billing-test-secret',
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://cv.example.org',
      JANITOR: '0',
      ACCESS_NOTICES: '0',
      BILLING_JOBS: '0',
      TRUST_PROXY: '',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
      MAIL_CAPTURE_FILE: mailFile,
      TEST_RATE_LIMIT_FACTOR: '50',
      BILLING_ENABLED: '1',
      MOLLIE_API_KEY: MOLLIE_KEY,
      MOLLIE_API_BASE: mollie.base,
      PASS_PRICE_CENTS: '900',
      PASS_DAYS: '90',
      PRODUCT_NAME: 'CV-Hub',
      INVOICE_PREFIX: 'CV',
      TERMS_VERSION: 'agb-2026-10-09',
      WITHDRAWAL_VERSION: 'wb-2026-10-09',
      SELLER_NAME: 'Testverkäufer – Content Creation',
      SELLER_ADDRESS: 'Testweg 1 | 12345 Teststadt',
      SELLER_EMAIL: 'verkauf@example.org',
      SELLER_PHONE: '+49 000 000000',
      OPEN_REGISTRATION: '1',
      FREE_TIER_LIMITS: '1',
      ALTCHA_HMAC_KEY: 'altcha-test-key-0123456789abcdef',
      ALTCHA_COST: '10',
      ALTCHA_COUNTER_MIN: '5',
      ALTCHA_COUNTER_MAX: '40',
      ...(chromiumPath ? { PDF_CHROMIUM_PATH: chromiumPath } : {}),
    }, { port: API_PORT });
    db = new pg.Pool({ connectionString: pgInst.url, max: 4 });

    Adm = client(srv.base);
    let r = await Adm.post('/api/auth/register', { username: 'leitung', password: 'admin-passwort-1', email: 'admin@example.org' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const plain = (await Adm.post('/api/admin/invites', {})).data.code;
    Bestand = client(srv.base);
    r = await Bestand.post('/api/auth/register', { username: 'bestand', password: 'bestand-passwort-1', email: 'bestand@example.org', inviteCode: plain });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    bestandId = r.data.user.id;
    const pilotCode = (await Adm.post('/api/admin/invites', { maxUses: 5, accessDays: 30 })).data.code;
    Pilot = client(srv.base);
    // Neues Formular: Einladung ohne Nutzername — der entsteht aus der Adresse.
    r = await Pilot.post('/api/auth/register', { email: 'pilot@example.org', password: 'pilot-passwort-1', inviteCode: pilotCode });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    pilotId = r.data.user.id;
  });

  after(async () => {
    await db?.end().catch(() => {});
    await srv?.stop();
    await mollie?.close();
    pgInst?.stop();
    try { rmSync(mailDir, { recursive: true, force: true }); } catch { /* egal */ }
  });

  // ── Reine Funktionen ─────────────────────────────────────────────────────

  test('Beträge, Länder, Fristende (Sommer-/Winterzeit), Mollie-Basis', () => {
    assert.equal(formatAmount(900), '9.00');
    assert.equal(formatAmount(5), '0.05');
    assert.equal(parseAmount('9.00'), 900);
    assert.ok(Number.isNaN(parseAmount('9')));
    assert.throws(() => formatAmount(9.5));
    assert.equal(mollieLocale('fr'), 'fr_FR');
    assert.equal(mollieLocale('xx'), 'de_DE');
    for (const c of ['DE', 'AT', 'FR', 'US', 'CH']) assert.ok(isCountryCode(c), c);
    for (const c of ['XX', 'D', 'deu', '', 'ZZ', 'EU']) assert.ok(!isCountryCode(c), c);
    // Zahlung am 09.10.2026 15:00 Berlin → Frist endet 23.10.2026 24:00 (MESZ) = 22:00 UTC.
    assert.equal(withdrawableUntil('2026-10-09T13:00:00Z').toISOString(), '2026-10-23T22:00:00.000Z');
    // Zahlung am 20.10.2026 → Frist bis 03.11.2026 24:00 MEZ = 23:00 UTC (Zeitumstellung dazwischen).
    assert.equal(withdrawableUntil('2026-10-20T10:00:00Z').toISOString(), '2026-11-03T23:00:00.000Z');
    // Kurz vor Mitternacht Berlin zählt noch der Berliner Tag.
    assert.equal(withdrawableUntil('2026-10-09T21:59:00Z').toISOString(), '2026-10-23T22:00:00.000Z');
    assert.equal(withdrawableUntil('2026-10-09T22:01:00Z').toISOString(), '2026-10-24T22:00:00.000Z');
    assert.throws(() => checkApiBase('http://api.mollie.com/v2'));
    assert.equal(checkApiBase(''), 'https://api.mollie.com/v2');
    assert.equal(checkApiBase('http://127.0.0.1:9/v2/'), 'http://127.0.0.1:9/v2');
  });

  test('Ohne BILLING_ENABLED oder ohne Pflichtangaben gibt es keinen Checkout', async () => {
    const off = billingConfig({});
    assert.equal(off.ready, false);
    const b = createBilling({ pool: null, config: off, renderPdf: async () => Buffer.alloc(0) });
    assert.equal(b.offer().enabled, false);
    assert.equal((await b.checkout({ id: 1, email: 'x@example.org' }, checkoutBody())).status, 404);
    const half = billingConfig({ BILLING_ENABLED: '1', MOLLIE_API_KEY: 'test_x' });
    assert.equal(half.ready, false);
    for (const k of ['SELLER_NAME', 'SELLER_ADDRESS', 'SELLER_EMAIL', 'SELLER_PHONE', 'PUBLIC_BASE_URL', 'TERMS_VERSION', 'ALTCHA_HMAC_KEY']) assert.ok(half.missing.includes(k), k);
    assert.equal(billingConfig({ SELLER_ADDRESS: 'A 1 | 12345 B' }).seller.address, 'A 1\n12345 B');
  });

  test('ALTCHA: gültig, ungültig, abgelaufen, fremd, Wiederholung', async () => {
    const store = new Set();
    const fakePool = { query: async (_sql, [id]) => (store.has(id) ? { rowCount: 0 } : (store.add(id), { rowCount: 1 })) };
    const a = createAltcha({ pool: fakePool, hmacKey: 'k1' });
    const ch = await a.challenge();
    const sol = await solveChallenge({ challenge: ch, deriveKey });
    const payload = Buffer.from(JSON.stringify({ challenge: ch, solution: sol })).toString('base64');
    assert.deepEqual(await a.verify(payload), { ok: true });
    assert.equal((await a.verify(payload)).reason, 'replay');
    // Falscher Schlüssel → Signatur passt nicht.
    const b = createAltcha({ pool: fakePool, hmacKey: 'k2' });
    const ch2 = await a.challenge();
    const sol2 = await solveChallenge({ challenge: ch2, deriveKey });
    assert.equal((await b.verify(Buffer.from(JSON.stringify({ challenge: ch2, solution: sol2 })).toString('base64'))).reason, 'signature');
    // Verändertes Ablaufdatum → Signatur bricht.
    const tampered = { ...ch2, parameters: { ...ch2.parameters, expiresAt: ch2.parameters.expiresAt + 100 } };
    assert.equal((await a.verify(Buffer.from(JSON.stringify({ challenge: tampered, solution: sol2 })).toString('base64'))).ok, false);
    // Falsche Lösung.
    const wrong = { ...sol2, derivedKey: '00'.repeat(32) };
    assert.equal((await a.verify(Buffer.from(JSON.stringify({ challenge: ch2, solution: wrong })).toString('base64'))).reason, 'solution');
    for (const junk of ['', 'abc', Buffer.from('{"x":1}').toString('base64'), 'x'.repeat(9000)]) {
      assert.equal((await a.verify(junk)).ok, false, junk.slice(0, 10));
    }
  });

  // ── Plan-Modell ──────────────────────────────────────────────────────────

  test('Angebot kommt aus der Konfiguration', async () => {
    const r = await fetch(`${srv.base}/api/billing/offer`);
    const o = await r.json();
    assert.deepEqual(
      { enabled: o.enabled, sku: o.sku, priceCents: o.priceCents, currency: o.currency, days: o.days, openRegistration: o.openRegistration },
      { enabled: true, sku: 'pass90', priceCents: 900, currency: 'EUR', days: 90, openRegistration: true },
    );
    assert.match(o.vatNote, /§ 19 UStG/);
    assert.deepEqual(o.freeTier, { limited: true }, 'FREE_TIER_LIMITS=1 bei verkaufsbereitem Dienst');
  });

  test('Gratis-Grenze nur mit FREE_TIER_LIMITS und verkaufsbereitem Dienst', () => {
    const full = {
      BILLING_ENABLED: '1', MOLLIE_API_KEY: 'test_x', SELLER_NAME: 'S', SELLER_ADDRESS: 'A 1 | 12345 B',
      SELLER_EMAIL: 's@example.org', SELLER_PHONE: '0', PUBLIC_BASE_URL: 'https://cv.example.org',
      TERMS_VERSION: 'x', ALTCHA_HMAC_KEY: 'k',
    };
    const offerOf = env => createBilling({ pool: null, config: billingConfig(env), renderPdf: async () => Buffer.alloc(0) }).offer();
    // Heutiger Produktionsstand (Verkauf aus) und selbst gehostet: alles frei.
    assert.deepEqual(offerOf({}).freeTier, { limited: false });
    assert.deepEqual(offerOf({ FREE_TIER_LIMITS: '1' }).freeTier, { limited: false }, 'ohne Verkauf keine Grenze');
    assert.deepEqual(offerOf({ ...full, BILLING_ENABLED: '0', FREE_TIER_LIMITS: '1' }).freeTier, { limited: false });
    // Verkauf an, aber Pflichtangabe fehlt: nicht bereit, also keine Grenze.
    assert.deepEqual(offerOf({ ...full, TERMS_VERSION: '', FREE_TIER_LIMITS: '1' }).freeTier, { limited: false });
    // Verkauf bereit, Schalter aus: frei wie bisher.
    assert.deepEqual(offerOf(full).freeTier, { limited: false });
    assert.deepEqual(offerOf({ ...full, FREE_TIER_LIMITS: '0' }).freeTier, { limited: false });
    // Beides: Grenze an.
    assert.deepEqual(offerOf({ ...full, FREE_TIER_LIMITS: '1' }).freeTier, { limited: true });
    assert.deepEqual(offerOf({ ...full, FREE_TIER_LIMITS: 'true' }).freeTier, { limited: true });
  });

  test('Bestandskonten bleiben unbegrenzt, Pilot bleibt Pilot; Unbegrenzte können keinen Pass kaufen', async () => {
    const me = (await Bestand.get('/api/me')).data;
    assert.equal(me.plan.kind, 'unlimited');
    assert.equal(me.user.plan.kind, 'unlimited');
    assert.equal(me.emailConfirmed, true);
    assert.equal((await Adm.get('/api/auth/me')).data.user.plan.kind, 'unlimited');
    const p = (await Pilot.get('/api/me')).data;
    assert.equal(p.plan.kind, 'pilot');
    assert.equal(p.plan.daysLeft, 30);
    assert.match(p.user.username, /^pilot-[0-9a-f]{4}$/);
    const r = await Bestand.post('/api/billing/checkout', checkoutBody());
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'plan_unlimited');
    assert.equal((await userRow(bestandId)).access_until, null, 'nichts begrenzt');
    // Bestandskonto schreibt weiter.
    assert.equal((await Bestand.post('/api/resumes', { payload: { id: 'b1', data: {} }, id: 'b1' })).status, 200);
  });

  // ── Offene Registrierung ────────────────────────────────────────────────

  test('Offene Registrierung: ALTCHA Pflicht (ungültig, Wiederholung), Alter ab 16, Mail-Dublette', async () => {
    const C = client(srv.base);
    let r = await C.post('/api/auth/register', { email: 'neu1@example.org', password: 'kunden-passwort-1', altcha: 'kaputt', ageConfirmed16: true });
    assert.equal(r.status, 400); assert.equal(r.data.code, 'altcha_invalid');
    const payload = await solveAltcha(srv.base);
    r = await C.post('/api/auth/register', { email: 'neu1@example.org', password: 'kunden-passwort-1', altcha: payload });
    assert.equal(r.status, 400); assert.equal(r.data.code, 'age16_required');
    r = await C.post('/api/auth/register', { email: 'neu1@example.org', password: 'kunden-passwort-1', altcha: payload, ageConfirmed16: true });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.emailConfirmed, false);
    assert.equal(r.data.user.emailConfirmed, false);
    assert.equal(r.data.user.plan.kind, 'none');
    assert.equal(r.data.plan.kind, 'none');
    assert.equal(r.data.plan.until, null);
    assert.ok(C.cookie, 'sofort angemeldet');
    // Dieselbe gelöste Aufgabe ein zweites Mal: abgewiesen.
    const D = client(srv.base);
    r = await D.post('/api/auth/register', { email: 'neu2@example.org', password: 'kunden-passwort-1', altcha: payload, ageConfirmed16: true });
    assert.equal(r.status, 400); assert.equal(r.data.code, 'altcha_invalid');
    // Gleiche Adresse noch einmal.
    r = await D.post('/api/auth/register', { email: 'NEU1@example.org', password: 'kunden-passwort-1', altcha: await solveAltcha(srv.base), ageConfirmed16: true });
    assert.equal(r.status, 409); assert.equal(r.data.code, 'email_taken');
    const row = (await db.query(`SELECT * FROM users WHERE email = 'neu1@example.org'`)).rows[0];
    assert.equal(row.signup_source, 'self');
    assert.equal(row.plan_kind, 'none');
    assert.ok(row.age_confirmed_16_at);
    // Einladungscode ohne gültigen Code: weiterhin abgewiesen.
    r = await client(srv.base).post('/api/auth/register', { email: 'x@example.org', password: 'kunden-passwort-1', inviteCode: 'FALSCH-CODE' });
    assert.equal(r.status, 403);
  });

  test('Double-Opt-in: Mail mit Token, Bestätigen, Login mit E-Mail; Reset erst nach Bestätigung', async () => {
    const email = 'doi@example.org';
    const { C } = await registerSelf(email, { confirm: false });
    const m = await waitFor(() => mailsTo(email).find(x => /bestätige/.test(x.subject)));
    assert.ok(m, 'Bestätigungsmail');
    assert.match(m.html, /https:\/\/cv\.example\.org\/email-bestaetigen\?token=/);
    const token = /token=([A-Za-z0-9_-]+)/.exec(m.html)[1];
    const { rows } = await db.query('SELECT token_hash FROM email_confirmations WHERE token_hash = $1', [crypto.createHash('sha256').update(token).digest('hex')]);
    assert.equal(rows.length, 1, 'nur der Hash liegt in der Datenbank');

    // Vor der Bestätigung: kein Reset-Link.
    const before = mailsTo(email).length;
    await client(srv.base).post('/api/auth/forgot-password', { identifier: email });
    await new Promise(r => setTimeout(r, 400));
    assert.equal(mailsTo(email).length, before, 'keine Reset-Mail für unbestätigte Adresse');

    assert.equal((await C.post('/api/auth/confirm-email', { token: 'x'.repeat(43) })).status, 400);
    assert.equal((await client(srv.base).post('/api/auth/confirm-email', { token })).status, 200);
    assert.equal((await client(srv.base).post('/api/auth/confirm-email', { token })).status, 400, 'nur einmal');
    assert.equal((await C.get('/api/me')).data.emailConfirmed, true);
    assert.equal((await C.post('/api/auth/resend-confirmation', {})).data.alreadyConfirmed, true);

    await client(srv.base).post('/api/auth/forgot-password', { identifier: email });
    assert.ok(await waitFor(() => mailsTo(email).find(x => /Passwort zurücksetzen/.test(x.subject))), 'jetzt kommt der Reset');

    const L = client(srv.base);
    const r = await L.post('/api/auth/login', { username: email, password: 'kunden-passwort-1' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.user.plan.kind, 'none');
  });

  test('Plan none: Schreibwege 403 pass_required mit Klartext; lesen, exportieren, löschen gehen', async () => {
    const { C } = await registerSelf('ohnepass@example.org');
    const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]).toString('base64');
    for (const [name, f] of [
      ['POST /api/resumes', () => C.post('/api/resumes', { payload: { id: 'x1', data: {} } })],
      ['PUT /api/resumes/:id', () => C.put('/api/resumes/x1', { payload: { id: 'x1' } })],
      ['POST /api/photos', () => C.post('/api/photos', { mime: 'image/png', dataBase64: PNG })],
      ['POST /api/resumes/:id/share', () => C.post('/api/resumes/x1/share', {})],
      ['POST /api/keys', () => C.post('/api/keys', { name: 'MCP' })],
    ]) {
      const r = await f();
      assert.equal(r.status, 403, `${name}: ${r.status} ${JSON.stringify(r.data)}`);
      assert.equal(r.data.code, 'pass_required', name);
      assert.match(r.data.error, /Bewerbungs-Pass/, name);
      assert.match(r.data.error, /kostenlos/, name);
    }
    assert.equal((await C.get('/api/resumes')).status, 200);
    assert.equal((await C.get('/api/me/export')).status, 200);
    assert.equal((await C.get('/api/billing/orders')).data.orders.length, 0);
  });

  // ── Checkout ─────────────────────────────────────────────────────────────

  test('Checkout: nur angemeldet, Pflicht-Häkchen, Land, Name, SKU; Betrag nie vom Client', async () => {
    assert.equal((await client(srv.base).post('/api/billing/checkout', checkoutBody())).status, 401);
    const { C } = await registerSelf('pruef@example.org');
    for (const [extra, code] of [
      [{ acceptTerms: false }, 'terms_required'],
      [{ ageConfirmed18: undefined }, 'age18_required'],
      [{ country: 'XX' }, 'country_invalid'],
      [{ billingName: 'E' }, 'name_invalid'],
      [{ sku: 'pass9000' }, 'sku_invalid'],
    ]) {
      const r = await C.post('/api/billing/checkout', checkoutBody(extra));
      assert.equal(r.status, 400, JSON.stringify(extra));
      assert.equal(r.data.code, code);
    }
    const before = mollie.calls.length;
    const r = await C.post('/api/billing/checkout', checkoutBody({ priceCents: 1, amount: { value: '0.01' }, days: 9999, lang: 'fr' }));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.match(r.data.checkoutUrl, /^https:\/\/www\.mollie\.com\/checkout\//);
    assert.match(r.data.orderNo, /^B-\d{6}$/);
    const call = mollie.calls.slice(before).find(c => c.method === 'POST' && c.url === '/v2/payments');
    assert.deepEqual(call.body.amount, { currency: 'EUR', value: '9.00' });
    assert.equal(call.body.locale, 'fr_FR');
    assert.equal(call.body.redirectUrl, `https://cv.example.org/kauf/danke?order=${r.data.orderId}`);
    assert.equal(call.body.webhookUrl, 'https://cv.example.org/pdfapi/api/billing/webhook');
    assert.deepEqual(call.body.metadata, { orderId: r.data.orderId });
    assert.equal(call.body.description, `CV-Hub Bewerbungs-Pass 90 Tage, Bestellung ${r.data.orderNo}`);
    assert.equal(call.idempotencyKey, `payment-${r.data.orderId}`);
    const o = await orderRow(r.data.orderId);
    assert.deepEqual(
      { amount: o.amount_cents, days: o.pass_days, status: o.status, terms: o.terms_version, wb: o.withdrawal_version, age: o.age_confirmed_18, email: o.email },
      { amount: 900, days: 90, status: 'open', terms: 'agb-2026-10-09', wb: 'wb-2026-10-09', age: true, email: 'pruef@example.org' },
    );
  });

  test('Checkout-Idempotenz: Doppelklick ergibt dieselbe offene Bestellung, eine Zahlung', async () => {
    const { C, id } = await registerSelf('doppel@example.org');
    const before = mollie.calls.filter(c => c.url === '/v2/payments').length;
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => C.post('/api/billing/checkout', checkoutBody())));
    for (const r of [a, b, c]) assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(a.data.orderId, b.data.orderId);
    assert.equal(a.data.orderId, c.data.orderId);
    assert.equal(a.data.checkoutUrl, b.data.checkoutUrl);
    assert.equal(mollie.calls.filter(x => x.url === '/v2/payments').length - before, 1, 'genau eine Zahlung bei Mollie');
    assert.equal((await db.query('SELECT count(*)::int n FROM orders WHERE user_id = $1', [id])).rows[0].n, 1);
    // Nach 10 Minuten gibt es eine neue.
    await db.query(`UPDATE orders SET created_at = now() - interval '11 minutes' WHERE user_id = $1`, [id]);
    const d = await C.post('/api/billing/checkout', checkoutBody());
    assert.notEqual(d.data.orderId, a.data.orderId);
  });

  test('Mollie nicht erreichbar: 502 mit Klartext, keine Bestellung bleibt liegen', async () => {
    const { C, id } = await registerSelf('ausfall@example.org');
    mollie.fail(1);
    const r = await C.post('/api/billing/checkout', checkoutBody());
    assert.equal(r.status, 502);
    assert.equal(r.data.code, 'payment_provider_unavailable');
    assert.equal((await db.query('SELECT count(*)::int n FROM orders WHERE user_id = $1', [id])).rows[0].n, 0);
  });

  // ── Zahlung, Pass, Rechnung, Widerruf ─────────────────────────────────────

  test('Ganzer Weg: Checkout → Webhook paid → Pass aktiv → Rechnung → Widerruf → Erstattung → Pass gekürzt', async () => {
    const email = 'kaeuferin@example.org';
    const { C, id: uid } = await registerSelf(email);
    const co = await C.post('/api/billing/checkout', checkoutBody({ country: 'AT' }));
    assert.equal(co.status, 200);
    const orderId = co.data.orderId;
    let o = await orderRow(orderId);

    // Vor der Zahlung: offen, nichts frei.
    mollie.setStatus(o.mollie_payment_id, 'open');
    assert.equal((await C.get(`/api/billing/orders/${orderId}/status`)).data.status, 'open');
    assert.equal((await C.post('/api/resumes', { payload: { id: 'k1', data: {} }, id: 'k1' })).data.code, 'pass_required');

    // Bezahlt: der Webhook trägt nur die ID.
    mollie.setStatus(o.mollie_payment_id, 'paid');
    const wh = await webhook(o.mollie_payment_id);
    assert.equal(wh.status, 200);
    assert.equal(await wh.text(), '', 'kein Körper');
    o = await orderRow(orderId);
    assert.equal(o.status, 'paid');
    assert.match(o.invoice_no, new RegExp(`^CV-${new Date().getFullYear()}-\\d{4}$`));
    const st = (await C.get(`/api/billing/orders/${orderId}/status`)).data;
    assert.equal(st.status, 'paid');
    assert.ok(Math.abs(new Date(st.passUntil).getTime() - Date.now() - 90 * DAY) < 120_000, st.passUntil);
    const me = (await C.get('/api/me')).data;
    assert.equal(me.plan.kind, 'pass');
    assert.equal(me.plan.daysLeft, 90);
    assert.equal((await C.post('/api/resumes', { payload: { id: 'k1', data: {} }, id: 'k1' })).status, 200, 'jetzt darf sie schreiben');
    assert.equal((await C.post('/api/keys', { name: 'MCP' })).status, 200, 'und Schlüssel anlegen');

    // Bestellbestätigung mit Rechnung und Vertragsunterlagen.
    const conf = await waitFor(() => mailsTo(email).find(x => /Bestellbestätigung/.test(x.subject)), 30_000);
    assert.ok(conf, 'Bestellbestätigung verschickt');
    assert.ok(conf.subject.includes(o.order_no));
    // Texte aus app/src/legal (legal-texts.json): Pflichtangaben, Belehrung und Muster-Formular im Körper.
    for (const w of [o.order_no, o.invoice_no, 'Widerrufsbelehrung', 'Muster-Widerrufsformular', '9,00 €', '§ 19 UStG', 'kein Abo', 'https://cv.example.org/widerruf', 'Testverkäufer', '+49 000 000000', 'Testweg 1, 12345 Teststadt', 'agb-2026-10-09']) {
      assert.ok(conf.html.includes(w), `Mail enthält ${w}`);
    }
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(conf.html), `kein ungefüllter Platzhalter: ${(conf.html.match(/\{\{[A-Z_]+\}\}/g) || []).join(', ')}`);
    if (chromiumPath) {
      assert.deepEqual(conf.attachments.map(a => a.filename), [`Rechnung-${o.invoice_no}.pdf`, 'AGB-agb-2026-10-09.pdf', 'Widerrufsbelehrung-und-Muster-Widerrufsformular.pdf']);
      const pdf = Buffer.from(conf.attachments[0].contentBase64, 'base64');
      if (HAS_PDFTOTEXT) {
        const agb = pdfText(Buffer.from(conf.attachments[1].contentBase64, 'base64'));
        assert.match(agb, /Allgemeine Geschäftsbedingungen/);
        assert.ok(!/\{\{[A-Z_]+\}\}/.test(agb), 'AGB ohne ungefüllte Platzhalter');
        const wb = pdfText(Buffer.from(conf.attachments[2].contentBase64, 'base64'));
        for (const w of ['Widerrufsbelehrung', 'Muster-Widerrufsformular', 'Testverkäufer', 'https://cv.example.org/widerruf']) assert.ok(wb.includes(w), `Belehrung enthält ${w}`);
      }
      assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
      if (HAS_PDFTOTEXT) {
        const text = pdfText(pdf);
        for (const w of [o.invoice_no, 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', 'Erika Mustermann', 'Land: AT', 'Bewerbungs-Pass, Nutzungszeitraum', '9,00 €', 'Testweg 1', '12345 Teststadt']) {
          assert.ok(text.includes(w), `Rechnung hat Textebene mit „${w}“:\n${text}`);
        }
      }
      // Dieselbe Rechnung über den Konto-Weg.
      const inv = await C.get(`/api/billing/orders/${orderId}/invoice.pdf`, { raw: true });
      assert.equal(inv.status, 200);
      assert.equal(inv.headers.get('content-type'), 'application/pdf');
      if (HAS_PDFTOTEXT) assert.ok(pdfText(inv.data).includes(o.invoice_no));
    }

    // Webhook-Wiederholung: nichts passiert doppelt.
    const untilBefore = (await userRow(uid)).access_until;
    const mailCount = mailsTo(email).length;
    for (let i = 0; i < 3; i++) assert.equal((await webhook(o.mollie_payment_id)).status, 200);
    await new Promise(r => setTimeout(r, 300));
    const o2 = await orderRow(orderId);
    assert.equal(o2.invoice_no, o.invoice_no);
    assert.equal((await userRow(uid)).access_until.getTime(), untilBefore.getTime(), 'Laufzeit nicht doppelt');
    assert.equal(mailsTo(email).length, mailCount, 'keine zweite Mail');

    // Bestellliste mit Widerrufsfrist.
    const list = (await C.get('/api/billing/orders')).data.orders;
    assert.equal(list.length, 1);
    assert.equal(list[0].invoiceNo, o.invoice_no);
    assert.ok(new Date(list[0].withdrawableUntil).getTime() > Date.now() + 13 * DAY);

    // Widerruf im Konto.
    const w = await C.post('/api/billing/withdraw', { orderId });
    assert.equal(w.status, 200, JSON.stringify(w.data));
    assert.equal(w.data.ok, true);
    assert.equal(w.data.refund.status, 'pending');
    const receipt = await waitFor(() => mailsTo(email).find(x => /Eingangsbestätigung/.test(x.subject)));
    assert.ok(receipt, 'Eingangsbestätigung sofort');
    for (const ww of [o.order_no, 'Hiermit widerrufe ich', 'Eingegangen', 'Erika Mustermann']) assert.ok(receipt.html.includes(ww), ww);
    assert.match(receipt.html, /\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/, 'Datum und Uhrzeit');
    o = await orderRow(orderId);
    assert.equal(o.status, 'withdrawn');
    assert.equal(o.withdraw_channel, 'account');
    assert.ok(o.refund_id.startsWith('re_'));
    const refundCall = mollie.calls.filter(c => c.url.endsWith('/refunds') && c.method === 'POST' && c.url.includes(o.mollie_payment_id));
    assert.equal(refundCall.length, 1);
    assert.deepEqual(refundCall[0].body.amount, { currency: 'EUR', value: '9.00' }, 'volle Erstattung');
    // Pass gekürzt: einziger Pass → Ende = jetzt → ohne Pass.
    const u = await userRow(uid);
    assert.ok(Math.abs(new Date(u.access_until).getTime() - Date.now()) < 120_000);
    assert.equal((await C.get('/api/me')).data.plan.kind, 'none');
    assert.equal((await C.post('/api/resumes', { payload: { id: 'k1', data: {} }, id: 'k1' })).data.code, 'pass_required');
    assert.equal((await C.get('/api/resumes/k1')).status, 200, 'Daten bleiben lesbar');

    // Doppelter Widerruf: dieselbe Antwort, keine zweite Erstattung, keine zweite Mail.
    const mc = mailsTo(email).length;
    const w2 = await C.post('/api/billing/withdraw', { orderId });
    assert.equal(w2.status, 200);
    assert.equal(new Date(w2.data.receivedAt).getTime(), new Date(w.data.receivedAt).getTime());
    assert.equal(mollie.calls.filter(c => c.url.endsWith('/refunds') && c.method === 'POST' && c.url.includes(o.mollie_payment_id)).length, 1);
    assert.equal(mailsTo(email).length, mc);
    assert.equal(Math.abs((await userRow(uid)).access_until - u.access_until) < 1000, true, 'nicht noch einmal gekürzt');

    // Mollie meldet die Erstattung über den Webhook der Zahlung.
    mollie.setRefund(o.refund_id, 'refunded');
    assert.equal((await webhook(o.mollie_payment_id)).status, 200);
    o = await orderRow(orderId);
    assert.equal(o.status, 'refunded');
    assert.equal(o.refund_status, 'refunded');
    assert.ok(await waitFor(() => mailsTo(email).find(x => /Erstattung ausgeführt/.test(x.subject))));
    const l2 = (await C.get('/api/billing/orders')).data.orders[0];
    assert.deepEqual({ status: l2.status, refund: l2.refund, w: l2.withdrawableUntil }, { status: 'refunded', refund: { status: 'refunded' }, w: null });
    // Rechnung bleibt abrufbar und trägt den Widerruf.
    if (chromiumPath && HAS_PDFTOTEXT) {
      const t = pdfText((await C.get(`/api/billing/orders/${orderId}/invoice.pdf`, { raw: true })).data);
      assert.match(t, /widerrufen/);
    }
  });

  test('Zwei Pässe: Laufzeit addiert sich; Widerruf kürzt nur um diese Bestellung', async () => {
    const { C, id: uid } = await registerSelf('zwei@example.org');
    const a = await buy(C);
    const b = await buy(C, { billingName: 'Erika M.' });
    assert.equal(a.status, 'paid'); assert.equal(b.status, 'paid');
    assert.equal(new Date(b.pass_from).getTime(), new Date(a.pass_until).getTime(), 'zweiter Pass schließt an');
    let u = await userRow(uid);
    assert.ok(Math.abs(new Date(u.access_until).getTime() - Date.now() - 180 * DAY) < 120_000);
    assert.equal((await C.post('/api/billing/withdraw', { orderId: a.id })).status, 200);
    u = await userRow(uid);
    assert.ok(Math.abs(new Date(u.access_until).getTime() - Date.now() - 90 * DAY) < 120_000, 'noch 90 Tage');
    assert.equal((await C.get('/api/me')).data.plan.kind, 'pass');
  });

  test('Pilot kauft: der Pass schließt an die Pilot-Laufzeit an', async () => {
    const o = await buy(Pilot, { billingName: 'Pia Pilot' });
    const u = await userRow(pilotId);
    assert.ok(Math.abs(new Date(u.access_until).getTime() - Date.now() - 120 * DAY) < 120_000);
    assert.equal((await Pilot.get('/api/me')).data.plan.kind, 'pass');
    assert.ok(Math.abs(new Date(o.pass_from).getTime() - Date.now() - 30 * DAY) < 120_000);
  });

  test('failed, canceled, expired: nur der Status, kein Pass, keine Rechnung; Webhook-Grenzfälle', async () => {
    const { C, id: uid } = await registerSelf('fehl@example.org');
    for (const status of ['failed', 'canceled', 'expired']) {
      const r = await C.post('/api/billing/checkout', checkoutBody({ billingName: `Erika ${status}` }));
      const o = await orderRow(r.data.orderId);
      mollie.setStatus(o.mollie_payment_id, status);
      assert.equal((await webhook(o.mollie_payment_id)).status, 200);
      const o2 = await orderRow(o.id);
      assert.equal(o2.status, status);
      assert.equal(o2.invoice_no, null);
      assert.equal((await C.get(`/api/billing/orders/${o.id}/invoice.pdf`)).status, 404);
      assert.equal((await C.post('/api/billing/withdraw', { orderId: o.id })).data.code, 'not_withdrawable');
    }
    assert.equal((await C.get('/api/me')).data.plan.kind, 'none');
    assert.equal((await userRow(uid)).plan_kind, 'none');

    // Unbekannte, kaputte und leere IDs: 200, ohne Abruf bei Mollie.
    const before = mollie.calls.length;
    for (const body of ['id=tr_unbekannt123', 'id=../../etc', 'id=', '', 'foo=bar']) {
      const r = await fetch(`${srv.base}/api/billing/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      assert.equal(r.status, 200, body);
    }
    assert.equal(mollie.calls.length, before, 'kein Abruf für unbekannte IDs');

    // Mollie gestört: 503, damit Mollie es später erneut versucht.
    const r = await C.post('/api/billing/checkout', checkoutBody({ billingName: 'Erika Störung' }));
    const o = await orderRow(r.data.orderId);
    mollie.setStatus(o.mollie_payment_id, 'paid');
    mollie.fail(1);
    assert.equal((await webhook(o.mollie_payment_id)).status, 503);
    assert.equal((await orderRow(o.id)).status, 'open');
    assert.equal((await webhook(o.mollie_payment_id)).status, 200);
    assert.equal((await orderRow(o.id)).status, 'paid');
  });

  test('Webhook glaubt nur Mollie: falscher Betrag oder fremde Bestellung schaltet nichts frei', async () => {
    const { C, id: uid } = await registerSelf('falsch@example.org');
    const r = await C.post('/api/billing/checkout', checkoutBody());
    const o = await orderRow(r.data.orderId);
    mollie.setStatus(o.mollie_payment_id, 'paid', { amount: { value: '0.01', currency: 'EUR' } });
    assert.equal((await webhook(o.mollie_payment_id)).status, 200);
    assert.equal((await orderRow(o.id)).status, 'open');
    mollie.setStatus(o.mollie_payment_id, 'paid', { amount: { value: '9.00', currency: 'EUR' }, metadata: { orderId: crypto.randomUUID() } });
    assert.equal((await webhook(o.mollie_payment_id)).status, 200);
    assert.equal((await orderRow(o.id)).status, 'open');
    assert.equal((await userRow(uid)).plan_kind, 'none');
  });

  test('IDOR: fremde Bestellungen gibt es nicht (404), auch nicht für Rechnung und Widerruf', async () => {
    const { C: owner } = await registerSelf('eigen@example.org');
    const o = await buy(owner);
    const { C: other } = await registerSelf('fremd@example.org');
    for (const [name, f] of [
      ['status', () => other.get(`/api/billing/orders/${o.id}/status`)],
      ['invoice', () => other.get(`/api/billing/orders/${o.id}/invoice.pdf`)],
      ['withdraw', () => other.post('/api/billing/withdraw', { orderId: o.id })],
      ['admin', () => other.get('/api/admin/billing')],
    ]) {
      const r = await f();
      assert.equal(r.status, name === 'admin' ? 403 : 404, `${name}: ${r.status}`);
    }
    assert.equal((await other.get('/api/billing/orders')).data.orders.length, 0);
    for (const bad of ['abc', '1', "1' OR '1'='1", crypto.randomUUID()]) {
      assert.equal((await owner.get(`/api/billing/orders/${encodeURIComponent(bad)}/status`)).status, 404, bad);
    }
    assert.equal((await orderRow(o.id)).status, 'paid', 'unverändert');
  });

  test('Widerruf nach Ablauf der Frist: 409 im Konto, nichts geändert', async () => {
    const { C } = await registerSelf('spaet@example.org');
    const o = await buy(C);
    await db.query(`UPDATE orders SET paid_at = now() - interval '16 days' WHERE id = $1`, [o.id]);
    const r = await C.post('/api/billing/withdraw', { orderId: o.id });
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'withdrawal_period_over');
    assert.equal((await orderRow(o.id)).status, 'paid');
  });

  test('Öffentlicher Widerruf: gleiche Antwort für jeden Ausgang; zugeordnet nur mit der Adresse der Bestellung; Unzuordenbares wird gespeichert', async () => {
    const email = 'oeffentlich@example.org';
    const { C } = await registerSelf(email);
    const o = await buy(C, { billingName: 'Olga Öffentlich' });
    const pub = body => fetch(`${srv.base}/api/billing/withdraw-public`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

    // Ohne gültige Sicherheitsprüfung oder ohne Pflichtfelder: abgewiesen.
    assert.equal((await pub({ name: 'Olga Öffentlich', email, orderNo: o.order_no, altcha: 'x' })).status, 400);
    assert.equal((await pub({ name: 'Olga Öffentlich', email: 'kaputt', orderNo: o.order_no, altcha: await solveAltcha(srv.base) })).status, 400);

    const shape = d => ({ ok: d.ok, refund: d.refund, hasTime: !!Date.parse(d.receivedAt), keys: Object.keys(d).sort() });
    const answers = [];
    // Fremde Adresse mit richtiger Nummer, richtige Adresse mit falscher Nummer.
    for (const wrong of [
      { name: 'Olga Öffentlich', email: 'angreifer@example.org', orderNo: o.order_no },
      { name: 'Olga Öffentlich', email, orderNo: 'B-999999' },
    ]) {
      const r = await pub({ ...wrong, altcha: await solveAltcha(srv.base) });
      assert.equal(r.status, 200);
      answers.push(shape(await r.json()));
    }
    await waitFor(() => mailsTo('angreifer@example.org').length > 0);
    await new Promise(res => setTimeout(res, 300));
    assert.equal((await orderRow(o.id)).status, 'paid', 'falsche Angaben ändern nichts');
    // Der Absender bekommt eine neutrale Eingangsbestätigung seiner eigenen Erklärung — nichts über die Bestellung.
    const neutral = mailsTo('angreifer@example.org');
    assert.equal(neutral.length, 1);
    assert.match(neutral[0].subject, /Eingangsbestätigung Ihrer Erklärung/);
    for (const leak of ['9,00', email, 'Testverkäufer – Content Creation, Testweg', o.invoice_no]) assert.ok(!neutral[0].html.includes(leak), `verrät nichts: ${leak}`);
    // Gespeichert und dem Betreiber gemeldet (eine Erklärung gilt auch ohne Abgleich).
    const { rows: decl } = await db.query(`SELECT * FROM declarations WHERE type = 'withdrawal' AND status = 'manual' AND email IN ('angreifer@example.org', $1)`, [email]);
    assert.equal(decl.length, 2);
    assert.ok(mailsTo('verkauf@example.org').filter(m => /Handarbeit nötig: Widerruf/.test(m.subject)).length >= 2);

    // Richtige Angaben, anders geschrieben, Name abweichend: zugeordnet über Nummer + Adresse.
    let r = await pub({ name: '  olga   ÖFFENTLICH-Müller ', email: email.toUpperCase(), orderNo: o.order_no.toLowerCase(), altcha: await solveAltcha(srv.base) });
    assert.equal(r.status, 200);
    answers.push(shape(await r.json()));
    for (const a of answers) assert.deepEqual(a, answers[0], 'jede Antwort sieht gleich aus');
    // Runde 6 (M1): erst der Link aus der Mail an die Bestelladresse führt den Widerruf aus.
    await waitFor(() => mailsTo(email).find(m => /Bitte bestätigen: Ihr Widerruf/.test(m.subject)));
    assert.equal((await orderRow(o.id)).status, 'paid', 'vor dem Klick unverändert');
    assert.equal((await confirmFromMail(email, /Bitte bestätigen: Ihr Widerruf/)).status, 200);
    assert.ok(await waitFor(async () => (await orderRow(o.id)).status === 'withdrawn'));
    const o2 = await orderRow(o.id);
    assert.equal(o2.withdraw_channel, 'public');
    assert.match(o2.withdraw_statement, /ÖFFENTLICH-Müller/, 'Wortlaut mit dem eingegebenen Namen');
    assert.ok(await waitFor(() => mailsTo(email).find(m => /Eingangsbestätigung Ihres Widerrufs/.test(m.subject))));

    // Ohne Bestellnummer: die eine widerrufbare Bestellung dieser Adresse.
    const { C: C2 } = await registerSelf('ohnenummer@example.org');
    const o3 = await buy(C2, { billingName: 'Nora Nummerlos' });
    r = await pub({ name: 'Nora Nummerlos', email: 'ohnenummer@example.org', altcha: await solveAltcha(srv.base) });
    assert.equal(r.status, 200);
    assert.equal((await confirmFromMail('ohnenummer@example.org', /Bitte bestätigen: Ihr Widerruf/)).status, 200);
    assert.ok(await waitFor(async () => (await orderRow(o3.id)).status === 'withdrawn'));
  });

  test('Kündigung (§ 312k): ordentlich sofort, zum Datum, außerordentlich; öffentlich ohne Anmeldung; Widerruf danach weiter möglich', async () => {
    const { C, id: uid, email } = await registerSelf('kuendigung@example.org');
    const a = await buy(C);
    // Zu einem Datum in 30 Tagen: der Pass endet dann (Ende des Tages, Berlin).
    const d = new Date(Date.now() + 30 * DAY);
    const ymd = d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    let r = await C.post('/api/billing/cancel', { orderId: a.id, kind: 'ordinary', when: 'date', date: ymd });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    let u = await userRow(uid);
    const left = new Date(u.access_until).getTime() - Date.now();
    assert.ok(left > 29.9 * DAY && left < 31.1 * DAY, String(left / DAY));
    const receipt = await waitFor(() => mailsTo(email).find(m => /Kündigungsbestätigung/.test(m.subject)));
    assert.ok(receipt, 'Kündigungsbestätigung sofort');
    for (const w of [a.order_no, 'Ordentliche Kündigung', 'Der Vertrag endet am']) assert.ok(receipt.html.includes(w), w);
    assert.match(receipt.html, /\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/);
    assert.equal((await orderRow(a.id)).status, 'paid', 'Kündigung ist kein Widerruf');
    // Widerruf nach Kündigung: geht, und kürzt nur den verbliebenen Rest.
    r = await C.post('/api/billing/withdraw', { orderId: a.id });
    assert.equal(r.status, 200);
    u = await userRow(uid);
    assert.ok(Math.abs(new Date(u.access_until).getTime() - Date.now()) < 120_000);

    // Außerordentlich ohne Grund: abgewiesen; mit Grund: Pass endet sofort, Betreiber wird gefragt.
    const b = await buy(C, { billingName: 'Erika Zwei' });
    assert.equal((await C.post('/api/billing/cancel', { orderId: b.id, kind: 'extraordinary' })).data.code, 'reason_required');
    r = await C.post('/api/billing/cancel', { orderId: b.id, kind: 'extraordinary', reason: 'Export ging trotz Hinweis nicht', when: 'now' });
    assert.equal(r.status, 200);
    assert.equal((await C.get('/api/me')).data.plan.kind, 'none');
    assert.ok(await waitFor(() => mailsTo('verkauf@example.org').find(m => /Handarbeit nötig: Kündigung/.test(m.subject))));
    assert.equal((await C.post('/api/billing/cancel', {})).data.code, 'nothing_to_cancel');

    // Öffentlich, ohne Bestellnummer: alle laufenden Pässe dieser Adresse.
    const { C: P, id: pid } = await registerSelf('kuendigung2@example.org');
    await buy(P);
    const pubRes = await fetch(`${srv.base}/api/billing/cancel-public`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Paula', email: 'kuendigung2@example.org', kind: 'ordinary', when: 'now', altcha: await solveAltcha(srv.base) }) });
    assert.equal(pubRes.status, 200);
    assert.deepEqual(Object.keys(await pubRes.json()).sort(), ['ok', 'receivedAt']);
    // Runde 6 (H2): erst der Link aus der Mail an die Bestelladresse beendet den Pass.
    assert.equal((await confirmFromMail('kuendigung2@example.org', /Bitte bestätigen: Ihre Kündigung/)).status, 200);
    assert.ok(await waitFor(async () => Math.abs(new Date((await userRow(pid)).access_until).getTime() - Date.now()) < 120_000));
    assert.ok(await waitFor(() => mailsTo('kuendigung2@example.org').find(m => /Kündigungsbestätigung/.test(m.subject))));
    // Fremde Adresse: gleiche Antwort, nichts gekündigt, neutrale Bestätigung an die eingegebene Adresse.
    const { C: Q, id: qid } = await registerSelf('kuendigung3@example.org');
    const q = await buy(Q);
    const before = (await userRow(qid)).access_until;
    const x = await fetch(`${srv.base}/api/billing/cancel-public`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Xaver', email: 'boese@example.org', orderNo: q.order_no, kind: 'ordinary', altcha: await solveAltcha(srv.base) }) });
    assert.equal(x.status, 200);
    assert.ok(await waitFor(() => mailsTo('boese@example.org').length > 0));
    assert.equal(new Date((await userRow(qid)).access_until).getTime(), new Date(before).getTime());
    assert.equal((await orderRow(q.id)).cancelled_at, null);
  });

  test('Rechnungsnummern lückenlos und eindeutig bei gleichzeitigen Zahlungen; keine Laufzeit geht verloren', async () => {
    const { C, id: uid } = await registerSelf('parallel@example.org');
    const year = new Date().getFullYear();
    const startLast = (await db.query('SELECT last FROM invoice_counters WHERE year = $1', [year])).rows[0]?.last || 0;
    const N = 8;
    const ids = [];
    for (let i = 0; i < N; i++) {
      const oid = crypto.randomUUID();
      const pid = mollie.create(oid);
      await db.query(
        `INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, status, pass_days, mollie_payment_id)
         VALUES ($1, 'B-' || lpad(nextval('order_no_seq')::text, 6, '0'), $2, 'parallel@example.org', 'Paul Parallel', 'DE', 'pass90', 900, 'open', 90, $3)`,
        [oid, uid, pid],
      );
      mollie.setStatus(pid, 'paid');
      ids.push({ oid, pid });
    }
    const untilBefore = new Date((await userRow(uid)).access_until).getTime();
    // Jede Zahlung zweimal, alles gleichzeitig.
    const res = await Promise.all([...ids, ...ids].map(x => webhook(x.pid)));
    for (const r of res) assert.equal(r.status, 200);
    const { rows } = await db.query('SELECT invoice_no FROM orders WHERE id = ANY($1) ORDER BY invoice_no', [ids.map(x => x.oid)]);
    const nums = rows.map(r => Number(r.invoice_no.split('-')[2])).sort((a, b) => a - b);
    assert.deepEqual(nums, Array.from({ length: N }, (_, i) => startLast + 1 + i), 'lückenlos, ohne Doppel');
    const after = new Date((await userRow(uid)).access_until).getTime();
    assert.ok(Math.abs(after - Math.max(untilBefore, Date.now()) - N * 90 * DAY) < 120_000, 'jede Zahlung zählt genau einmal');
    // Alle Nummern im ganzen System eindeutig und ohne Lücke.
    const all = (await db.query(`SELECT invoice_no FROM orders WHERE invoice_no LIKE $1`, [`CV-${year}-%`])).rows.map(r => Number(r.invoice_no.split('-')[2])).sort((a, b) => a - b);
    assert.deepEqual(all, Array.from({ length: all.length }, (_, i) => i + 1));
    await C.get('/api/me');
  });

  test('Kontolöschung: bezahlte Bestellung bleibt mit Minimaldaten (user_id NULL), unbezahlte geht', async () => {
    const email = 'loeschen@example.org';
    const { C, id: uid } = await registerSelf(email);
    const paid = await buy(C);
    const open = await C.post('/api/billing/checkout', checkoutBody({ billingName: 'Offen Bleibt' }));
    const failed = crypto.randomUUID();
    await db.query(`INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, status, pass_days)
                    VALUES ($1, 'B-800001', $2, $3, 'Fehl Geschlagen', 'DE', 'pass90', 900, 'failed', 90)`, [failed, uid, email]);
    const dump = (await C.get('/api/me/export')).data;
    assert.equal(dump.orders.length, 3, 'Bestellungen im Datenauszug');
    const r = await C.post('/api/me/delete', { password: 'kunden-passwort-1' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(await userRow(uid), undefined);
    const kept = await orderRow(paid.id);
    assert.equal(kept.user_id, null);
    assert.equal(kept.email, email);
    assert.equal(kept.invoice_no, paid.invoice_no);
    assert.equal(kept.checkout_url, null);
    // Runde 6 (N3): Die Zahlung zur offenen Bestellung kann noch eingehen — sie bleibt, ohne Konto.
    const pending = await orderRow(open.data.orderId);
    assert.equal(pending.user_id, null);
    assert.equal(pending.checkout_url, null);
    assert.equal(await orderRow(failed), undefined, 'nie bezahlte Bestellung ohne offene Zahlung gelöscht');
    const off = await waitFor(() => mailsTo(email).find(m => /gelöscht/.test(m.subject)));
    assert.match(off.html, /zehn Jahre/);
    // Außer der Bestellung steht die Adresse nirgends mehr.
    const { rows: tabs } = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'orders'`);
    for (const { table_name } of tabs) {
      const { rowCount } = await db.query(`SELECT 1 FROM ${table_name} t WHERE t::text ILIKE $1`, [`%${email}%`]);
      assert.equal(rowCount, 0, `${table_name} enthält noch die Adresse`);
    }
  });

  test('Aufräumjob: unbestätigt nach 48 h weg (außer mit Kauf), alte Bestellungen nach Frist', async () => {
    const a = await registerSelf('alt-unbestaetigt@example.org', { confirm: false });
    const b = await registerSelf('alt-gekauft@example.org', { confirm: false });
    const c = await registerSelf('alt-bestaetigt@example.org', { confirm: true });
    const d = await registerSelf('frisch-unbestaetigt@example.org', { confirm: false });
    // Runde 6 (N1): Kauf nur mit bestätigter Adresse. Altbestand (Kauf vor der Regel) nachgestellt:
    // bestätigen, kaufen, Bestätigung zurücknehmen; die unbezahlte Bestellung direkt anlegen.
    await db.query('UPDATE users SET email_confirmed_at = now() WHERE id = $1', [b.id]);
    await buy(b.C);
    await db.query('UPDATE users SET email_confirmed_at = NULL WHERE id = $1', [b.id]);
    assert.equal((await a.C.post('/api/billing/checkout', checkoutBody())).data.code, 'email_unconfirmed');
    const unpaid = { data: { orderId: crypto.randomUUID() } };
    await db.query(`INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, status, pass_days)
                    VALUES ($1, 'B-800002', $2, 'alt-unbestaetigt@example.org', 'A', 'DE', 'pass90', 900, 'open', 90)`, [unpaid.data.orderId, a.id]);
    await db.query(`UPDATE users SET created_at = now() - interval '49 hours' WHERE id = ANY($1)`, [[a.id, b.id, c.id]]);
    await db.query(`UPDATE email_confirmations SET expires_at = now() - interval '1 hour' WHERE user_id = ANY($1)`, [[a.id, b.id, c.id]]);
    // Bestellungen: eine nie bezahlte von vor 31 Tagen, eine bezahlte von vor elf Jahren.
    const old = crypto.randomUUID();
    const ancient = crypto.randomUUID();
    await db.query(`INSERT INTO orders (id, order_no, email, billing_name, country, sku, amount_cents, status, pass_days, created_at)
                    VALUES ($1, 'B-900001', 'x@example.org', 'X', 'DE', 'pass90', 900, 'expired', 90, now() - interval '31 days')`, [old]);
    await db.query(`INSERT INTO orders (id, order_no, email, billing_name, country, sku, amount_cents, status, pass_days, created_at, paid_at, invoice_no)
                    VALUES ($1, 'B-900002', 'y@example.org', 'Y', 'DE', 'pass90', 900, 'paid', 90, now() - interval '11 years 2 months', now() - interval '11 years 2 months', 'CV-2015-0001')`, [ancient]);

    const r = await runJanitor(db);
    for (const [k, v] of Object.entries(r)) assert.equal(typeof v, 'number', `${k}: ${v}`);
    assert.equal(await userRow(a.id), undefined, 'unbestätigt ohne Kauf: gelöscht');
    assert.equal(await orderRow(unpaid.data.orderId), undefined, 'samt unbezahlter Bestellung');
    assert.ok(await userRow(b.id), 'mit Kauf: bleibt');
    assert.ok(await userRow(c.id), 'bestätigt: bleibt');
    assert.ok(await userRow(d.id), 'frisch: bleibt');
    assert.equal(await orderRow(old), undefined);
    assert.equal(await orderRow(ancient), undefined);
    assert.ok((await db.query(`SELECT 1 FROM orders WHERE user_id = $1 AND paid_at IS NOT NULL`, [b.id])).rowCount, 'bezahlte Bestellung bleibt');
    // Abgelaufene Wiederholungsmarken gehen auch.
    await db.query(`INSERT INTO altcha_spent (id, expires_at) VALUES ('alt', now() - interval '1 minute')`);
    await runJanitor(db);
    assert.equal((await db.query(`SELECT 1 FROM altcha_spent WHERE id = 'alt'`)).rowCount, 0);
  });

  test('Hinweis 14 und 3 Tage vor Pass-Ende mit „Pass verlängern“', async () => {
    const { C, id: uid, email } = await registerSelf('ende@example.org');
    await buy(C);
    await db.query(`UPDATE users SET access_until = now() + interval '10 days', access_notice14_at = NULL, access_notice3_at = NULL WHERE id = $1`, [uid]);
    const sent = [];
    const r = await runAccessNotices(db, { send: async m => { sent.push(m); return true; }, base: 'https://cv.example.org' });
    const mine = sent.filter(m => m.to === email);
    assert.equal(r.filter(x => x.userId === uid).length, 1);
    assert.equal(mine.length, 1);
    assert.match(mine[0].subject, /Bewerbungs-Pass endet/);
    assert.ok(mine[0].html.includes('https://cv.example.org/preise'));
    assert.ok(mine[0].html.includes('Pass verlängern'));
    assert.match(mine[0].html, /kein Abo/);
    assert.equal((await C.get('/api/me')).data.plan.notice, 'soon');
  });

  test('Admin-Auswertung: Monate, Länder, EU-Ausland mit Warnung ab 8.000 €, offene Erstattungen', async () => {
    // 9.000 € EU-Ausland (FR) im laufenden Jahr.
    for (let i = 0; i < 3; i++) {
      await db.query(`INSERT INTO orders (id, order_no, email, billing_name, country, sku, amount_cents, status, pass_days, paid_at, invoice_no)
                      VALUES ($1, $2, 'fr@example.org', 'F', 'FR', 'pass90', 300000, 'paid', 90, now(), $3)`,
        [crypto.randomUUID(), `B-80000${i}`, `CV-TEST-${i}`]);
    }
    const r = await Adm.get('/api/admin/billing');
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const rep = r.data;
    assert.ok(rep.euAbroad.currentYearCents >= 900_000, String(rep.euAbroad.currentYearCents));
    assert.equal(rep.euAbroad.warning, true);
    assert.equal(rep.euAbroad.exceeded, false);
    assert.ok(rep.warnings.some(w => w.code === 'eu_threshold_near'));
    const cy = rep.byCountry[rep.years.current];
    assert.equal(cy.find(c => c.country === 'FR').region, 'EU-Ausland');
    assert.equal(cy.find(c => c.country === 'DE').region, 'DE');
    assert.ok(rep.byMonth.length >= 1);
    assert.match(rep.total.note, /ALLE Umsätze/);
    assert.equal(rep.testMode, true);
    assert.ok(Array.isArray(rep.openRefunds));
    // Widerrufene Bestellungen mindern den Umsatz.
    const de = cy.find(c => c.country === 'DE');
    const { rows } = await db.query(`SELECT count(*)::int n FROM orders WHERE country = 'DE' AND paid_at IS NOT NULL AND status = 'paid'`);
    assert.equal(de.netCents, rows[0].n * 900);
    // Keine Namen in der Auswertung — außer im Wortlaut offener Erklärungen,
    // über die der Betreiber von Hand entscheiden muss.
    const text = JSON.stringify({ ...rep, declarationsOpen: undefined });
    for (const w of ['Erika', 'kaeuferin@example.org', 'Olga']) assert.ok(!text.includes(w), w);
    assert.ok(rep.declarationsOpen.length >= 2, 'offene Erklärungen sichtbar');
    assert.ok(rep.warnings.some(w => w.code === 'declarations_open'));
    const did = rep.declarationsOpen[0].id;
    assert.equal((await Adm.post(`/api/admin/billing/declarations/${did}/resolve`, { note: 'geprüft' })).status, 200);
    assert.equal((await Adm.post(`/api/admin/billing/declarations/${did}/resolve`, {})).status, 404, 'nur einmal');
    assert.equal((await Pilot.get('/api/admin/billing')).status, 403);
  });

  test('Hintergrundlauf holt Erstattung und Bestätigung nach, wenn Mollie oder Mail ausfielen', async () => {
    const { C } = await registerSelf('nachholen@example.org');
    const o = await buy(C);
    mollie.fail(1);   // die Erstattung beim Widerruf scheitert einmal
    const w = await C.post('/api/billing/withdraw', { orderId: o.id });
    assert.equal(w.data.refund.status, 'retry');
    assert.equal((await orderRow(o.id)).refund_id, null);
    // Eigene Instanz gegen dieselbe Datenbank und denselben Mock.
    const { createMollie } = await import('./mollie.js');
    const b = createBilling({
      pool: db,
      config: billingConfig({ BILLING_ENABLED: '1', MOLLIE_API_KEY: MOLLIE_KEY, MOLLIE_API_BASE: mollie.base, PUBLIC_BASE_URL: 'https://cv.example.org' }),
      mollie: createMollie({ apiKey: MOLLIE_KEY, base: mollie.base }),
      renderPdf: async () => Buffer.from('%PDF-1.4 stub'),
      send: async () => true,
      log: () => {},
    });
    await db.query('UPDATE orders SET confirmation_sent_at = NULL WHERE id = $1', [o.id]);
    const r = await b.runJobs();
    assert.equal(r.refunds, 1);
    assert.ok(r.confirmations >= 1);
    const o2 = await orderRow(o.id);
    assert.ok(o2.refund_id?.startsWith('re_'));
    assert.equal(o2.refund_status, 'pending');
    mollie.setRefund(o2.refund_id, 'refunded');
    await b.runJobs();
    assert.equal((await orderRow(o.id)).status, 'refunded');
  });
});
