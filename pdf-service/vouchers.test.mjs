// Gutscheine und Gratiszugänge (09.10.2026).
//
// Echter Dienst (server.js) gegen echte Postgres-Instanz und einen kleinen
// Mollie-Mock (nur damit Kauf, Widerruf und Kündigung neben Gutscheinen
// geprüft werden können). Gleichzeitigkeit wird mit Promise.all gegen die
// laufende API geprüft, nicht simuliert.
//
// Eigene Ports (Postgres 5501, API 3201; überschreibbar mit VOUCHER_PG_PORT
// und VOUCHER_API_PORT). Testfälle nummeriert: [1] … [21]; Fall 14
// (Oberfläche) prüft app/scripts/vouchercheck.mjs.
//
// Alle Codes hier sind Testwerte (TEST…); kein echter Produktionscode.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { startPostgres, startServer, client, findPgBin } from './testkit.mjs';
import { computeAccess, migrateGrants, recomputeAccess, DAY_MS } from './grants.js';
import {
  normalizeCode, isCodeShape, generatePersonalCode, CROCKFORD, parseRedeemUntil, voucherSummary, announcement, createVouchers,
} from './vouchers.js';
import { planInfo, isAccessExpired, accessInfo } from './access.js';
import { ART9_VERSION } from './consent.js';
// Einwilligung Art. 9 DSGVO (B4, 10.10.2026): Ohne sie speichert ein Konto nicht.
const ART9 = { version: ART9_VERSION };

const PG_PORT = Number(process.env.VOUCHER_PG_PORT || 5501);
const API_PORT = Number(process.env.VOUCHER_API_PORT || 3201);
const DAY = DAY_MS;
const MOLLIE_KEY = 'test_vouchermockvouchermockvoucher';
const PG_MISSING = findPgBin() ? false : 'keine Postgres-Binärdateien gefunden (PG_BIN setzen)';

process.env.ALTCHA_COST = '10';
process.env.ALTCHA_COUNTER_MIN = '5';
process.env.ALTCHA_COUNTER_MAX = '40';

const D = s => new Date(s);
const near = (a, b, tol = 120_000) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < tol;

/* ── Reine Funktionen ────────────────────────────────────────────────────── */

test('Normalisierung und Codeform [21]', () => {
  for (const raw of [' linkedin-30 ', 'LinkedIn 30', 'L I N K E D I N 3 0', 'ＬＩＮＫＥＤＩＮ３０', 'linkedin‑30', 'LINKEDIN−30', 'linkedin\t30\n']) {
    assert.equal(normalizeCode(raw), 'LINKEDIN30', JSON.stringify(raw));
  }
  assert.equal(isCodeShape('LINKEDIN30'), true);
  for (const bad of ['', 'AB', 'ABC', 'A'.repeat(33), 'ÄÖÜ!', 'TEST_30', "X' OR '1'='1"]) assert.equal(isCodeShape(normalizeCode(bad)), false, bad);
  // Persönliche Codes: 16 Zeichen Crockford, ohne I L O U, zufällig.
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const c = generatePersonalCode();
    assert.equal(c.length, 16);
    assert.ok([...c].every(ch => CROCKFORD.includes(ch)), c);
    assert.ok(!/[ILOU]/.test(c));
    seen.add(c);
  }
  assert.equal(seen.size, 2000, 'keine Wiederholung');
  assert.equal(CROCKFORD.length, 32);
});

test('Einlösefrist: Ende des Tages in Berlin, ungültige Daten abgewiesen', () => {
  assert.equal(parseRedeemUntil('2026-12-31').toISOString(), '2026-12-31T22:59:59.000Z', 'Winterzeit: 23:59:59 in Berlin');
  assert.equal(parseRedeemUntil('2027-07-01').toISOString(), '2027-07-01T21:59:59.000Z', 'Sommerzeit');
  assert.equal(parseRedeemUntil('2027-02-31'), null);
  assert.equal(parseRedeemUntil('morgen'), null);
});

test('Verwaltung: Zusammenfassung und Aktionshinweis sagen klar, was gilt', () => {
  const base = { distribution: 'public', code_plain: 'TESTLINK30', redeem_until: parseRedeemUntil('2026-12-31') };
  assert.equal(voucherSummary({ ...base, kind: 'days', days: 30, max_redemptions: 100 }), '100 Zugänge für je 30 Tage, einlösbar bis 31.12.2026, je Konto höchstens einmal.');
  assert.equal(voucherSummary({ ...base, kind: 'lifetime', days: null, max_redemptions: 50 }), '50 dauerhafte Gratiszugänge, einlösbar bis 31.12.2026, je Konto höchstens einmal.');
  assert.match(voucherSummary({ ...base, kind: 'days', days: 30, max_redemptions: null }), /^Ohne Gesamtlimit/);
  assert.equal(voucherSummary({ distribution: 'personal', kind: 'lifetime', max_redemptions: 1, redeem_until: null }), '1 dauerhafter Gratiszugang.');
  assert.equal(announcement({ ...base, kind: 'days', days: 30, max_redemptions: 100 }),
    'Mit TESTLINK30 erhältst du 30 Tage Bewerbungs-Pass kostenlos. Ohne Zahlungsdaten, ohne Abo. Einlösbar bis 31.12.2026, für die ersten 100 erfolgreichen Einlösungen.');
  assert.ok(!/Restpl|nur noch|schnell/i.test(announcement({ ...base, kind: 'lifetime', max_redemptions: 50 })), 'kein künstlicher Zeitdruck');
  assert.equal(announcement({ distribution: 'personal' }), null);
});

describe('Laufzeitregeln mit konkreten Daten (computeAccess)', () => {
  const self = { role: 'user', signup_source: 'self', created_at: D('2026-10-20T08:00:00Z'), plan_kind: 'none' };
  const invite = { role: 'user', signup_source: null, created_at: D('2026-10-20T08:00:00Z'), plan_kind: null };
  let id = 0;
  const g = (o) => ({ id: ++id, revoked_at: null, ends_at: null, until_at: null, effective_from: null, effective_until: null, ...o });
  const ymd = d => d.toISOString().slice(0, 10);

  test('Pass 01.11. (90 Tage) → 30.01.; Gutschein 30 Tage am 10.11. → 01.03.; Widerruf am 12.11. → Gratiszeit 10.11.–10.12. [10]', () => {
    const order = g({ source: 'order', kind: 'days', days: 90, granted_at: D('2026-11-01T10:00:00Z') });
    let r = computeAccess(self, [order]);
    assert.equal(ymd(r.until), '2027-01-30');
    assert.equal(r.planKind, 'pass');
    const voucher = g({ source: 'voucher', kind: 'days', days: 30, granted_at: D('2026-11-10T10:00:00Z') });
    r = computeAccess(self, [order, voucher]);
    assert.equal(ymd(r.until), '2027-03-01', 'Gutschein schließt an, bezahlte Zeit bleibt');
    assert.equal(ymd(r.segments.get(voucher.id).from), '2027-01-30');
    // Widerruf: der Bestell-Grant fällt weg; sein Abschnitt war 01.11.–30.01.
    const revoked = { ...order, revoked_at: D('2026-11-12T10:00:00Z'), effective_from: D('2026-11-01T10:00:00Z'), effective_until: D('2027-01-30T10:00:00Z') };
    r = computeAccess(self, [revoked, voucher]);
    assert.equal(ymd(r.segments.get(voucher.id).from), '2026-11-10');
    assert.equal(ymd(r.until), '2026-12-10', 'nur der Zahlungsanspruch ist weg, der Gutschein bleibt');
    assert.equal(r.planKind, 'pass');
  });

  test('Gutschein vor dem Kauf: 01.11. 30 Tage → 01.12.; Kauf 10.11. → 01.03.; Widerruf 12.11. → 01.12. [10]', () => {
    const voucher = g({ source: 'voucher', kind: 'days', days: 30, granted_at: D('2026-11-01T10:00:00Z') });
    const order = g({ source: 'order', kind: 'days', days: 90, granted_at: D('2026-11-10T10:00:00Z') });
    let r = computeAccess(self, [voucher, order]);
    assert.equal(ymd(r.until), '2027-03-01', 'späterer Kauf berücksichtigt die Gratis-Restlaufzeit');
    assert.equal(ymd(r.segments.get(order.id).from), '2026-12-01');
    r = computeAccess(self, [voucher, { ...order, revoked_at: D('2026-11-12T10:00:00Z'), effective_from: D('2026-12-01T10:00:00Z'), effective_until: D('2027-03-01T10:00:00Z') }]);
    assert.equal(ymd(r.until), '2026-12-01');
  });

  test('Widerruf ohne andere Berechtigung: Ende = Zeitpunkt des Widerrufs, nicht rückwirkend', () => {
    const order = g({ source: 'order', kind: 'days', days: 90, granted_at: D('2026-11-01T10:00:00Z'), revoked_at: D('2026-11-05T12:00:00Z'), effective_from: D('2026-11-01T10:00:00Z'), effective_until: D('2027-01-30T10:00:00Z') });
    const r = computeAccess(self, [order]);
    assert.equal(r.until.toISOString(), '2026-11-05T12:00:00.000Z');
    // Seit 10.10.2026: nur widerrufene Bestellungen → „ohne Pass", nicht
    // „Pass abgelaufen" (das gäbe dauerhaft Word und LaTeX frei).
    assert.equal(r.planKind, 'none');
    assert.equal(r.withdrawnOnly, true);
  });

  test('Widerruf-Regel (10.10.2026): Pilot bleibt Pilot, ein Gutschein zählt weiter als Pass, eine zweite bezahlte Bestellung auch', () => {
    const revoked = g({ source: 'order', kind: 'days', days: 90, granted_at: D('2026-11-01T10:00:00Z'), revoked_at: D('2026-11-05T12:00:00Z'), effective_from: D('2026-11-01T10:00:00Z'), effective_until: D('2027-01-30T10:00:00Z') });
    // Eingeladen mit Pilot-Laufzeit, gekauft, widerrufen: zurück zum Pilot (nicht „Pass abgelaufen").
    const pilot = g({ source: 'pilot', kind: 'days', days: 30, granted_at: D('2026-10-20T08:00:00Z') });
    let r = computeAccess({ ...invite, plan_kind: 'pass' }, [pilot, revoked]);
    assert.equal(r.planKind, null);
    assert.equal(r.withdrawnOnly, true);
    // Selbst registriert mit Gutschein (auch widerrufen) und widerrufener Bestellung: Pass.
    const voucher = g({ source: 'voucher', kind: 'days', days: 30, granted_at: D('2026-10-25T08:00:00Z') });
    r = computeAccess(self, [voucher, revoked]);
    assert.equal(r.planKind, 'pass');
    assert.equal(r.withdrawnOnly, false);
    r = computeAccess(self, [{ ...voucher, revoked_at: D('2026-10-26T08:00:00Z') }, revoked]);
    assert.equal(r.planKind, 'pass', 'Gutschein-Widerruf (nur Betreiber) ändert die Einordnung nicht');
    // Zweite, nicht widerrufene Bestellung: Pass.
    const paid = g({ source: 'order', kind: 'days', days: 90, granted_at: D('2026-11-10T10:00:00Z') });
    r = computeAccess(self, [revoked, paid]);
    assert.equal(r.planKind, 'pass');
    assert.equal(r.withdrawnOnly, false);
  });

  test('Kündigung zum 12.11. mit Gutschein vom 10.11.: Gratiszeit hängt an das Kündigungsende → 12.12.', () => {
    const order = g({ source: 'order', kind: 'days', days: 90, granted_at: D('2026-11-01T10:00:00Z'), ends_at: D('2026-11-12T10:00:00Z') });
    const voucher = g({ source: 'voucher', kind: 'days', days: 30, granted_at: D('2026-11-10T10:00:00Z') });
    const r = computeAccess(self, [order, voucher]);
    assert.equal(ymd(r.segments.get(order.id).until), '2026-11-12');
    assert.equal(ymd(r.until), '2026-12-12');
  });

  test('Dauerhaft hat Vorrang; Widerruf einer Bestellung ändert daran nichts [3][10]', () => {
    const order = g({ source: 'order', kind: 'days', days: 90, granted_at: D('2026-11-01T10:00:00Z') });
    const life = g({ source: 'voucher', kind: 'lifetime', days: null, granted_at: D('2026-11-02T10:00:00Z') });
    let r = computeAccess(self, [order, life]);
    assert.equal(r.mode, 'lifetime'); assert.equal(r.until, null); assert.equal(r.planKind, 'lifetime');
    r = computeAccess(self, [{ ...order, revoked_at: D('2026-11-03T10:00:00Z'), effective_from: order.granted_at, effective_until: D('2027-01-30T10:00:00Z') }, life]);
    assert.equal(r.mode, 'lifetime');
  });

  test('Bestand ohne Zeilen bleibt unbegrenzt; Selbstregistrierte beginnen ohne Pass; Admin-Setzen und Pilot', () => {
    assert.equal(computeAccess(invite, []).mode, 'unlimited');
    const r0 = computeAccess(self, []);
    assert.equal(r0.until.toISOString(), self.created_at.toISOString());
    const pilot = g({ source: 'pilot', kind: 'days', days: 30, granted_at: invite.created_at });
    const order = g({ source: 'order', kind: 'days', days: 90, granted_at: D('2026-10-25T08:00:00Z') });
    assert.equal(ymd(computeAccess(invite, [pilot, order]).until), '2027-02-17', '30 + 90 Tage ab 20.10.');
    const unl = g({ source: 'admin', kind: 'set', days: null, until_at: null, granted_at: D('2026-10-26T08:00:00Z') });
    const later = g({ source: 'voucher', kind: 'days', days: 30, granted_at: D('2026-10-27T08:00:00Z') });
    assert.equal(computeAccess(invite, [pilot, unl, later]).mode, 'unlimited');
    const fix = g({ source: 'admin', kind: 'set', days: null, until_at: D('2026-12-31T00:00:00Z'), granted_at: D('2026-10-28T08:00:00Z') });
    assert.equal(ymd(computeAccess(invite, [pilot, unl, fix]).until), '2026-12-31');
    assert.equal(computeAccess({ ...self, role: 'admin' }, [order]).mode, 'admin');
  });

  test('Plan-Ableitung: lifetime ohne Ablauf, nie schreibgeschützt', () => {
    const u = { role: 'user', plan_kind: 'lifetime', access_until: null };
    assert.equal(planInfo(u).kind, 'lifetime');
    assert.equal(isAccessExpired({ ...u, access_until: new Date(Date.now() - DAY) }), false);
    assert.equal(accessInfo(u), null);
  });
});

/* ── Mollie-Mock (wie in billing.test.mjs, nur das Nötige) ─────────────────── */
function startMollieMock() {
  const payments = new Map();
  const calls = [];
  const rid = p => `${p}_${crypto.randomBytes(5).toString('hex')}`;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', d => { raw += d; });
    req.on('end', () => {
      const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/hal+json' }); res.end(JSON.stringify(obj)); };
      const body = raw ? JSON.parse(raw) : undefined;
      calls.push({ method: req.method, url: req.url });
      if (req.headers.authorization !== `Bearer ${MOLLIE_KEY}`) return send(401, { status: 401 });
      let m;
      if (req.method === 'POST' && req.url === '/v2/payments') {
        const id = rid('tr');
        const p = { resource: 'payment', id, status: 'open', amount: body.amount, metadata: body.metadata, _links: { checkout: { href: `https://www.mollie.com/checkout/test-mode?token=${id}` } } };
        payments.set(id, p);
        return send(201, p);
      }
      if (req.method === 'GET' && (m = /^\/v2\/payments\/(tr_\w+)$/.exec(req.url))) {
        const p = payments.get(m[1]);
        return p ? send(200, p) : send(404, { status: 404 });
      }
      if (req.method === 'POST' && (m = /^\/v2\/payments\/(tr_\w+)\/refunds$/.exec(req.url))) {
        return send(201, { resource: 'refund', id: rid('re'), paymentId: m[1], status: 'pending', amount: body.amount });
      }
      if (req.method === 'GET' && (m = /^\/v2\/payments\/(tr_\w+)\/refunds\/(re_\w+)$/.exec(req.url))) {
        return send(200, { resource: 'refund', id: m[2], paymentId: m[1], status: 'pending' });
      }
      send(404, { status: 404 });
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    base: `http://127.0.0.1:${server.address().port}/v2`,
    calls,
    setPaid(id) { const p = payments.get(id); p.status = 'paid'; p.paidAt = new Date().toISOString(); },
    close: () => new Promise(r => server.close(r)),
  })));
}

async function solveAltcha(base) {
  const ch = await (await fetch(`${base}/api/altcha/challenge`)).json();
  const solution = await solveChallenge({ challenge: ch, deriveKey, timeout: 20_000 });
  return Buffer.from(JSON.stringify({ challenge: ch, solution })).toString('base64');
}

/* ── Gegen die laufende API ─────────────────────────────────────────────── */

describe('Gutscheine gegen die laufende API', { skip: PG_MISSING }, () => {
  let pgInst, srv, db, mollie, mailFile, mailDir;
  let Adm, Bestand, bestandId;
  let n = 0;
  const futureDay = (days = 30) => new Date(Date.now() + days * DAY).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

  const mails = () => (existsSync(mailFile) ? readFileSync(mailFile, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []);
  const userRow = async id => (await db.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
  const grantsOf = async id => (await db.query('SELECT * FROM access_grants WHERE user_id = $1 ORDER BY granted_at, id', [id])).rows;
  const voucherRow = async id => (await db.query('SELECT * FROM vouchers WHERE id = $1', [id])).rows[0];
  const webhook = id => fetch(`${srv.base}/api/billing/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `id=${encodeURIComponent(id)}` });
  const waitFor = async (fn, ms = 8000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) { const v = await fn(); if (v) return v; await new Promise(r => setTimeout(r, 100)); }
    return fn();
  };

  async function confirm(C, email) {
    const m = await waitFor(() => mails().filter(x => x.to === email).find(x => /bestätige/.test(x.subject)));
    const token = /token=([A-Za-z0-9_-]+)/.exec(m.html)[1];
    assert.equal((await C.post('/api/auth/confirm-email', { token })).status, 200);
  }
  /** Offene Registrierung; standardmäßig bestätigt. */
  async function registerSelf({ confirmed = true } = {}) {
    const email = `kunde${++n}-${crypto.randomBytes(3).toString('hex')}@example.org`;
    const C = client(srv.base);
    const r = await C.post('/api/auth/register', { email, password: 'kunden-passwort-1', altcha: await solveAltcha(srv.base), ageConfirmed16: true, art9Consent: ART9 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    if (confirmed) await confirm(C, email);
    return { C, id: r.data.user.id, email };
  }
  async function buy(C) {
    const r = await C.post('/api/billing/checkout', { sku: 'pass90', country: 'DE', billingName: 'Erika Mustermann', acceptTerms: true, ageConfirmed18: true });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [r.data.orderId]);
    mollie.setPaid(rows[0].mollie_payment_id);
    assert.equal((await webhook(rows[0].mollie_payment_id)).status, 200);
    return (await db.query('SELECT * FROM orders WHERE id = $1', [r.data.orderId])).rows[0];
  }
  async function createPublic(extra = {}) {
    const code = extra.code || `TEST${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const r = await Adm.post('/api/admin/vouchers', { name: 'Testaktion', distribution: 'public', kind: 'days', days: 30, maxRedemptions: 100, redeemUntil: futureDay(), ...extra, code });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return { ...r.data.voucher, plain: code };
  }
  async function createPersonal(extra = {}) {
    const r = await Adm.post('/api/admin/vouchers', { name: 'Persönlich', distribution: 'personal', kind: 'days', days: 30, ...extra });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return { codes: r.data.codes, vouchers: r.data.vouchers };
  }
  const redeem = (C, code, opts) => C.post('/api/vouchers/redeem', { code }, opts);
  /** Lässt ein Konto um `ms` altern: alle Zeitpunkte gemeinsam zurück. */
  async function age(uid, ms) {
    const s = ms / 1000;
    await db.query(
      `UPDATE access_grants SET granted_at = granted_at - make_interval(secs => $2), effective_from = effective_from - make_interval(secs => $2),
              effective_until = effective_until - make_interval(secs => $2), ends_at = ends_at - make_interval(secs => $2),
              revoked_at = revoked_at - make_interval(secs => $2), until_at = until_at - make_interval(secs => $2)
        WHERE user_id = $1`, [uid, s]);
    await db.query('UPDATE users SET access_until = access_until - make_interval(secs => $2), created_at = created_at - make_interval(secs => $2) WHERE id = $1', [uid, s]);
    await db.query('UPDATE voucher_redemptions SET redeemed_at = redeemed_at - make_interval(secs => $2), granted_from = granted_from - make_interval(secs => $2), granted_until = granted_until - make_interval(secs => $2) WHERE user_id = $1', [uid, s]);
  }

  before(async () => {
    pgInst = await startPostgres(PG_PORT);
    mollie = await startMollieMock();
    mailDir = mkdtempSync(path.join(tmpdir(), 'cvvoucher-mail-'));
    mailFile = path.join(mailDir, 'mails.jsonl');
    srv = await startServer({
      DATABASE_URL: pgInst.url,
      JWT_SECRET: 'voucher-test-secret',
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://cv.example.org',
      JANITOR: '0', ACCESS_NOTICES: '0', BILLING_JOBS: '0',
      TRUST_PROXY: '',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
      MAIL_CAPTURE_FILE: mailFile,
      TEST_RATE_LIMIT_FACTOR: '50',
      BILLING_ENABLED: '1',
      MOLLIE_API_KEY: MOLLIE_KEY,
      MOLLIE_API_BASE: mollie.base,
      PASS_PRICE_CENTS: '900', PASS_DAYS: '90',
      TERMS_VERSION: 'agb-test', WITHDRAWAL_VERSION: 'wb-test',
      SELLER_NAME: 'Testverkäufer', SELLER_ADDRESS: 'Testweg 1 | 12345 Teststadt', SELLER_EMAIL: 'verkauf@example.org', SELLER_PHONE: '+49 000 000000',
      OPEN_REGISTRATION: '1',
      ALTCHA_HMAC_KEY: 'altcha-test-key-0123456789abcdef',
      ALTCHA_COST: '10', ALTCHA_COUNTER_MIN: '5', ALTCHA_COUNTER_MAX: '40',
    }, { port: API_PORT });
    db = new pg.Pool({ connectionString: pgInst.url, max: 6 });
    Adm = client(srv.base);
    let r = await Adm.post('/api/auth/register', { username: 'admin', password: 'admin-passwort-1', email: 'admin@example.org', art9Consent: ART9 });
    assert.equal(r.status, 200);
    const plain = (await Adm.post('/api/admin/invites', {})).data.code;
    Bestand = client(srv.base);
    r = await Bestand.post('/api/auth/register', { username: 'bestand', password: 'bestand-passwort-1', email: 'bestand@example.org', inviteCode: plain, art9Consent: ART9 });
    assert.equal(r.status, 200);
    bestandId = r.data.user.id;
  });

  after(async () => {
    await db?.end().catch(() => {});
    await srv?.stop();
    await mollie?.close();
    pgInst?.stop();
    try { rmSync(mailDir, { recursive: true, force: true }); } catch { /* egal */ }
  });

  test('Startlog: Migration lief beim Start und hat nichts überschrieben', () => {
    assert.match(srv.output, /access-grants: Migration: \d+ Konten geprüft/);
  });

  test('[13] Verwaltung nur für Admins, serverseitig', async () => {
    const { C } = await registerSelf();
    const anon = client(srv.base);
    for (const [m, p] of [['get', '/api/admin/vouchers'], ['post', '/api/admin/vouchers'], ['post', '/api/admin/vouchers/1/deactivate'], ['get', '/api/admin/vouchers/1/redemptions'], ['get', '/api/admin/voucher-stats']]) {
      assert.equal((await anon[m](p, m === 'post' ? {} : undefined)).status, 401, `anonym ${p}`);
      assert.equal((await C[m](p, m === 'post' ? { name: 'x', distribution: 'public', kind: 'lifetime', code: 'TESTHACK', redeemUntil: futureDay() } : undefined)).status, 403, `Nutzer ${p}`);
    }
    assert.equal((await db.query(`SELECT count(*)::int n FROM vouchers WHERE code_plain = 'TESTHACK'`)).rows[0].n, 0);
  });

  test('Anlegen: Pflichtfelder, Standards, „ohne Gesamtlimit“ nur bewusst, Eindeutigkeit [17][21]', async () => {
    const bad = async (body, code) => {
      const r = await Adm.post('/api/admin/vouchers', { name: 'x', distribution: 'public', kind: 'days', days: 30, code: 'TESTBAD1', redeemUntil: futureDay(), ...body });
      assert.equal(r.status, 400, JSON.stringify(r.data)); assert.equal(r.data.code, code);
    };
    await bad({ redeemUntil: undefined }, 'redeem_until_required');
    await bad({ redeemUntil: '2020-01-01' }, 'redeem_until_past');
    await bad({ maxRedemptions: null }, 'unlimited_unconfirmed');
    await bad({ kind: 'lifetime', maxRedemptions: null }, 'unlimited_unconfirmed');
    await bad({ days: 0 }, 'days_invalid');
    await bad({ code: 'A!' }, 'code_invalid');
    await bad({ distribution: 'personal', code: 'TESTX123' }, 'code_not_allowed');
    await bad({ name: '' }, 'name_invalid');
    // Standard öffentlich: 100.
    const r = await Adm.post('/api/admin/vouchers', { name: 'Standard', distribution: 'public', kind: 'days', days: 30, code: ' test-standard ', redeemUntil: futureDay() });
    assert.equal(r.status, 200);
    assert.equal(r.data.voucher.code, 'TESTSTANDARD');
    assert.equal(r.data.voucher.maxRedemptions, 100);
    assert.equal(r.data.voucher.summary.startsWith('100 Zugänge für je 30 Tage'), true);
    assert.match(r.data.voucher.announcement, /^Mit TESTSTANDARD erhältst du 30 Tage Bewerbungs-Pass kostenlos\. Ohne Zahlungsdaten, ohne Abo\./);
    assert.equal(r.data.voucher.redeemUrl, 'https://cv.example.org/code', 'Einlöseadresse ohne Code');
    // Gleicher Code in anderer Schreibweise: 409.
    for (const dup of ['teststandard', 'Test Standard', 'ＴＥＳＴＳＴＡＮＤＡＲＤ']) {
      const d = await Adm.post('/api/admin/vouchers', { name: 'Dublette', distribution: 'public', kind: 'lifetime', code: dup, maxRedemptions: 5, redeemUntil: futureDay() });
      assert.equal(d.status, 409, dup); assert.equal(d.data.code, 'code_taken');
    }
    // Ohne Gesamtlimit mit Bestätigung.
    const u = await Adm.post('/api/admin/vouchers', { name: 'Offen', distribution: 'public', kind: 'days', days: 14, code: 'TESTOFFEN', maxRedemptions: null, confirmUnlimited: true, redeemUntil: futureDay() });
    assert.equal(u.status, 200); assert.equal(u.data.voucher.maxRedemptions, null);
    assert.match(u.data.voucher.summary, /^Ohne Gesamtlimit/);
  });

  test('Persönliche Codes: zufällig, nur einmal sichtbar, nur Hash gespeichert, Protokoll ohne Code', async () => {
    const { codes, vouchers } = await createPersonal({ count: 3, kind: 'lifetime' });
    assert.equal(codes.length, 3);
    for (const c of codes) assert.match(c, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    assert.equal(vouchers[0].maxRedemptions, 1, 'Standard: einmal insgesamt');
    assert.equal(vouchers[0].summary, '1 dauerhafter Gratiszugang.');
    const list = (await Adm.get('/api/admin/vouchers')).data.vouchers;
    const mine = list.filter(v => vouchers.some(x => x.id === v.id));
    assert.equal(mine.length, 3);
    for (const v of mine) { assert.equal(v.code, null); assert.match(v.codeHint, /^…[0-9A-Z]{4}$/); }
    const rows = (await db.query('SELECT * FROM vouchers WHERE id = ANY($1)', [vouchers.map(v => v.id)])).rows;
    for (const r of rows) { assert.equal(r.code_plain, null); assert.match(r.code_hash, /^[0-9a-f]{64}$/); }
    const dump = JSON.stringify((await db.query('SELECT * FROM admin_audit')).rows) + JSON.stringify(list) + srv.output;
    for (const c of codes) {
      assert.ok(!dump.includes(c) && !dump.includes(c.replace(/-/g, '')), 'Code nirgends im Klartext');
    }
  });

  test('[1] 30-Tage-Code ohne aktiven Pass: 30 Tage ab Einlösung, ohne Zahlung', async () => {
    const { C, id } = await registerSelf();
    assert.equal((await C.get('/api/me')).data.plan.kind, 'none');
    const v = await createPublic();
    const r = await redeem(C, v.plain.toLowerCase());
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.grant.kind, 'days'); assert.equal(r.data.grant.days, 30);
    assert.ok(near(r.data.grant.from, Date.now()));
    assert.ok(near(r.data.grant.until, Date.now() + 30 * DAY));
    assert.equal(r.data.plan.kind, 'pass');
    assert.equal(r.data.plan.hasPaid, false);
    assert.ok(near(r.data.plan.freeUntil, Date.now() + 30 * DAY));
    assert.deepEqual(r.data.plan.grants.map(x => [x.source, x.kind, x.days, x.label]), [['voucher', 'days', 30, 'Gutschein']]);
    // Sofort aktualisierte Rechte ohne Neuanmeldung.
    const me = (await C.get('/api/me')).data;
    assert.equal(me.plan.kind, 'pass'); assert.equal(me.plan.readOnly, false);
    assert.equal((await C.post('/api/resumes', { id: 'g1', payload: { id: 'g1', data: {} } })).status, 200);
    assert.ok(near((await userRow(id)).access_until, Date.now() + 30 * DAY));
    assert.equal((await db.query('SELECT count(*)::int n FROM orders WHERE user_id = $1', [id])).rows[0].n, 0, 'keine Bestellung');
    // Datenauszug enthält Berechtigung und Einlösung, aber keinen Code.
    const ex = (await C.get('/api/me/export')).data;
    assert.equal(ex.voucherRedemptions.length, 1);
    assert.deepEqual(ex.accessGrants.map(g => g.source), ['voucher']);
    assert.ok(!JSON.stringify(ex).includes(v.plain));
  });

  test('[2] Verlängerung eines aktiven bezahlten Passes ohne Verlust', async () => {
    const { C, id } = await registerSelf();
    const o = await buy(C);
    const paidUntil = (await userRow(id)).access_until;
    assert.ok(near(paidUntil, Date.now() + 90 * DAY));
    const v = await createPublic();
    const r = await redeem(C, v.plain);
    assert.equal(r.status, 200);
    assert.ok(near(r.data.grant.from, paidUntil, 1000), 'Gutschein beginnt am bisherigen Ende');
    assert.ok(near((await userRow(id)).access_until, Date.now() + 120 * DAY));
    const o2 = (await db.query('SELECT pass_from, pass_until FROM orders WHERE id = $1', [o.id])).rows[0];
    assert.equal(new Date(o2.pass_until).getTime(), new Date(o.pass_until).getTime(), 'bezahlte Laufzeit unverändert');
    assert.equal(r.data.plan.hasPaid, true);
  });

  test('[3][11] Dauerhaft: kein Ablauf, keine Kaufaufforderung, weitere Codes werden nicht verbraucht; Checkout 409', async () => {
    const { C, id } = await registerSelf();
    const { codes } = await createPersonal({ kind: 'lifetime' });
    const r = await redeem(C, codes[0]);
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.grant.until, null);
    assert.equal(r.data.plan.kind, 'lifetime');
    assert.equal(r.data.plan.until, null); assert.equal(r.data.plan.readOnly, false);
    const row = await userRow(id);
    assert.equal(row.access_until, null); assert.equal(row.plan_kind, 'lifetime');
    const me = (await C.get('/api/me')).data;
    assert.equal(me.access, null, 'kein Ablauf-Banner');
    assert.equal(me.plan.kind, 'lifetime');
    const co = await C.post('/api/billing/checkout', { sku: 'pass90', country: 'DE', billingName: 'Lena Lifetime', acceptTerms: true, ageConfirmed18: true });
    assert.equal(co.status, 409); assert.equal(co.data.code, 'plan_lifetime');
    // Weitere Codes: nicht verbraucht, verständliche Meldung, Vorschau sagt es vorher.
    const v = await createPublic();
    const pv = await C.post('/api/vouchers/preview', { code: v.plain });
    assert.equal(pv.data.ok, true); assert.equal(pv.data.alreadyLifetime, true);
    const again = await redeem(C, v.plain);
    assert.equal(again.status, 409); assert.equal(again.data.code, 'already_lifetime');
    assert.equal((await voucherRow(v.id)).redemptions, 0, 'kein Platz verbraucht');
    // Schreiben geht, Schlüssel gehen.
    assert.equal((await C.post('/api/resumes', { id: 'l1', payload: { id: 'l1', data: {} } })).status, 200);
    assert.equal((await C.post('/api/keys', { name: 'MCP' })).status, 200);
  });

  test('[4] Derselbe Code zweimal auf demselben Konto, auch gleichzeitig: genau eine Einlösung', async () => {
    const { C, id } = await registerSelf();
    const v = await createPublic();
    const res = await Promise.all(Array.from({ length: 6 }, () => redeem(C, v.plain)));
    assert.equal(res.filter(r => r.status === 200).length, 1, res.map(r => r.status).join(','));
    for (const r of res.filter(x => x.status !== 200)) assert.equal(r.data.code, 'already_redeemed');
    assert.equal((await voucherRow(v.id)).redemptions, 1);
    assert.equal((await grantsOf(id)).filter(g => g.source === 'voucher').length, 1);
    const until = (await userRow(id)).access_until;
    assert.ok(near(until, Date.now() + 30 * DAY), 'nur 30 Tage');
    const later = await redeem(C, ` ${v.plain.toLowerCase()} `);
    assert.equal(later.status, 409); assert.equal(later.data.code, 'already_redeemed');
    assert.equal(new Date((await userRow(id)).access_until).getTime(), new Date(until).getTime(), 'kein zusätzlicher Zugang');
  });

  test('[5] Limit 1, zwei Konten gleichzeitig: genau eine Einlösung', async () => {
    const a = await registerSelf();
    const b = await registerSelf();
    const { codes, vouchers } = await createPersonal();
    const res = await Promise.all([redeem(a.C, codes[0]), redeem(b.C, codes[0])]);
    assert.deepEqual(res.map(r => r.status).sort(), [200, 410]);
    assert.equal(res.find(r => r.status === 410).data.code, 'exhausted');
    assert.equal((await voucherRow(vouchers[0].id)).redemptions, 1);
  });

  test('[6] Ungültig, deaktiviert, ausgeschöpft, nach Frist — ohne Angaben über fremde Konten', async () => {
    const { C } = await registerSelf();
    for (const bad of ['GIBTSNICHT99', 'AB', '', 'ÄÖÜ!']) {
      const r = await redeem(C, bad);
      assert.equal(r.status, 404, bad); assert.equal(r.data.code, 'invalid');
      assert.equal((await C.post('/api/vouchers/preview', { code: bad })).data.reason, 'invalid');
    }
    const off = await createPublic();
    assert.equal((await Adm.post(`/api/admin/vouchers/${off.id}/deactivate`, { note: 'Test' })).status, 200);
    let r = await redeem(C, off.plain);
    assert.equal(r.data.code, 'inactive');
    const full = await createPublic({ maxRedemptions: 1 });
    const other = await registerSelf();
    assert.equal((await redeem(other.C, full.plain)).status, 200);
    r = await redeem(C, full.plain);
    assert.equal(r.data.code, 'exhausted');
    assert.ok(!JSON.stringify(r.data).includes(other.email) && !JSON.stringify(r.data).includes(String(other.id)), 'nichts über das andere Konto');
    const late = await createPublic();
    await db.query(`UPDATE vouchers SET redeem_until = now() - interval '1 minute' WHERE id = $1`, [late.id]);
    r = await redeem(C, late.plain);
    assert.equal(r.status, 410); assert.equal(r.data.code, 'expired');
    assert.equal((await C.post('/api/vouchers/preview', { code: late.plain })).data.reason, 'expired');
    for (const x of [off, full, late]) assert.ok((await voucherRow(x.id)).redemptions <= 1);
  });

  test('[7] Keine Einlösung ohne Anmeldung, ohne bestätigte Adresse, über API-Schlüssel oder MCP-Token', async () => {
    const v = await createPublic();
    const anon = await redeem(client(srv.base), v.plain);
    assert.equal(anon.status, 401); assert.equal(anon.data.code, 'auth_required');
    const { C, id, email } = await registerSelf({ confirmed: false });
    let r = await redeem(C, v.plain);
    assert.equal(r.status, 403); assert.equal(r.data.code, 'email_unconfirmed');
    assert.equal((await voucherRow(v.id)).redemptions, 0);
    // API-Schlüssel und OAuth-Token (MCP): abgelehnt, auch für ein berechtigtes Konto.
    await confirm(C, email);
    const life = await createPublic({ kind: 'lifetime', maxRedemptions: 5 });
    const { C: K, id: kid } = await registerSelf();
    assert.equal((await redeem(K, v.plain)).status, 200);
    const key = (await K.post('/api/keys', { name: 'MCP' })).data.key;
    const viaKey = await redeem(client(srv.base), life.plain, { headers: { Authorization: `Bearer ${key}` } });
    assert.equal(viaKey.status, 403); assert.equal(viaKey.data.code, 'session_required');
    const tok = `cvm_${crypto.randomBytes(32).toString('hex')}`;
    await db.query(`INSERT INTO oauth_tokens (token_hash, user_id, client_id, expires_at) VALUES ($1, $2, 'testclient', now() + interval '1 hour')`,
      [crypto.createHash('sha256').update(tok).digest('hex'), kid]);
    const viaOauth = await redeem(client(srv.base), life.plain, { headers: { Authorization: `Bearer ${tok}` } });
    assert.equal(viaOauth.status, 403); assert.equal(viaOauth.data.code, 'session_required');
    // Auch mit gültigem Cookie daneben nicht.
    const both = await redeem(K, life.plain, { headers: { Authorization: `Bearer ${key}` } });
    assert.equal(both.data.code, 'session_required');
    assert.equal((await voucherRow(life.id)).redemptions, 0);
    assert.equal((await userRow(id)).plan_kind, 'none');
  });

  test('[8] Deaktivierung entzieht nichts; neue Einlösungen gehen nicht mehr', async () => {
    const a = await registerSelf();
    const v = await createPublic();
    assert.equal((await redeem(a.C, v.plain)).status, 200);
    const before = (await userRow(a.id)).access_until;
    const d = await Adm.post(`/api/admin/vouchers/${v.id}/deactivate`, { note: 'Aktion beendet' });
    assert.equal(d.status, 200); assert.match(d.data.note, /bleiben bestehen/);
    assert.equal(d.data.voucher.status, 'inactive');
    assert.equal(new Date((await userRow(a.id)).access_until).getTime(), new Date(before).getTime());
    assert.equal((await a.C.get('/api/me')).data.plan.kind, 'pass');
    const b = await registerSelf();
    assert.equal((await redeem(b.C, v.plain)).data.code, 'inactive');
    const audit = (await db.query(`SELECT * FROM admin_audit WHERE action = 'voucher_deactivate' AND target = $1`, [String(v.id)])).rows;
    assert.equal(audit.length, 1); assert.equal(audit[0].details.note, 'Aktion beendet');
  });

  test('[9] Nach Ablauf: Nur-Lesen in Browser, API-Schlüssel und MCP-Token; Lesen, Export, Löschen bleiben', async () => {
    const { C, id } = await registerSelf();
    const v = await createPublic();
    assert.equal((await redeem(C, v.plain)).status, 200);
    assert.equal((await C.post('/api/resumes', { id: 'exp1', payload: { id: 'exp1', data: {} } })).status, 200);
    assert.equal((await C.post('/api/resumes', { id: 'exp2', payload: { id: 'exp2', data: {} } })).status, 200);
    const key = (await C.post('/api/keys', { name: 'MCP' })).data.key;
    const tok = `cvm_${crypto.randomBytes(32).toString('hex')}`;
    await db.query(`INSERT INTO oauth_tokens (token_hash, user_id, client_id, expires_at) VALUES ($1, $2, 'testclient', now() + interval '1 hour')`,
      [crypto.createHash('sha256').update(tok).digest('hex'), id]);
    await age(id, 31 * DAY);
    const me = (await C.get('/api/me')).data;
    assert.equal(me.plan.kind, 'none'); assert.equal(me.plan.readOnly, true); assert.equal(me.plan.notice, 'expired');
    assert.equal(me.plan.freeUntil, null);
    for (const [name, auth] of [['Sitzung', null], ['API-Schlüssel', key], ['MCP-Token', tok]]) {
      const X = auth ? client(srv.base) : C;
      const h = auth ? { headers: { Authorization: `Bearer ${auth}` } } : {};
      const w = await X.post('/api/resumes', { id: 'exp1', payload: { id: 'exp1', data: { x: 1 } } }, h);
      assert.equal(w.status, 403, `${name}: ${w.status}`); assert.equal(w.data.code, 'pass_required', name);
      assert.equal((await X.put('/api/resumes/exp1', { payload: { id: 'exp1' } }, h)).status, 403, name);
      assert.equal((await X.get('/api/resumes', h)).status, 200, `${name} liest`);
      assert.equal((await X.get('/api/resumes/exp1.md', h)).status, 200, `${name} Markdown`);
    }
    assert.equal((await C.get('/api/me/export')).status, 200);
    assert.equal((await C.del('/api/resumes/exp2')).status, 200, 'Löschen bleibt');
    assert.equal((await client(srv.base).del('/api/resumes/exp1', { headers: { Authorization: `Bearer ${key}` } })).status, 200, 'Löschen auch per Schlüssel');
    // Keine Abbuchung, keine Bestellung nach Ablauf.
    assert.equal((await db.query('SELECT count(*)::int n FROM orders WHERE user_id = $1', [id])).rows[0].n, 0);
  });

  test('[10] Kauf nach Gutschein und Widerruf: nur der Zahlungsanspruch fällt weg', async () => {
    // a) Gutschein zuerst, dann Kauf, dann Widerruf → 30 Tage ab Einlösung.
    const a = await registerSelf();
    const v = await createPublic();
    const ra = await redeem(a.C, v.plain);
    let o = await buy(a.C);
    assert.ok(near(o.pass_from, ra.data.grant.until, 1000), 'Kauf schließt an die Gratiszeit an');
    assert.ok(near((await userRow(a.id)).access_until, Date.now() + 120 * DAY));
    assert.equal((await a.C.post('/api/billing/withdraw', { orderId: o.id })).status, 200);
    assert.ok(near((await userRow(a.id)).access_until, ra.data.grant.until, 1000), 'Gratiszeit bleibt');
    assert.equal((await a.C.get('/api/me')).data.plan.kind, 'pass');
    // b) Kauf zuerst, dann Gutschein, dann Widerruf → Gutschein ab seiner Einlösung.
    const b = await registerSelf();
    o = await buy(b.C);
    const v2 = await createPublic();
    const rb = await redeem(b.C, v2.plain);
    assert.ok(near(rb.data.grant.from, Date.now() + 90 * DAY));
    assert.equal((await b.C.post('/api/billing/withdraw', { orderId: o.id })).status, 200);
    const gb = (await grantsOf(b.id)).find(g => g.source === 'voucher');
    assert.ok(near(gb.effective_from, Date.now()), 'Gutschein rückt auf seine Einlösung');
    assert.ok(near((await userRow(b.id)).access_until, Date.now() + 30 * DAY));
    const red = (await db.query('SELECT granted_until FROM voucher_redemptions WHERE user_id = $1', [b.id])).rows[0];
    assert.ok(near(red.granted_until, Date.now() + 120 * DAY), 'die Einlösung behält ihren ursprünglichen Stand als Beleg');
    // c) Kündigung einer Bestellung mit Gutscheinzeit dahinter.
    const c = await registerSelf();
    o = await buy(c.C);
    const v3 = await createPublic();
    assert.equal((await redeem(c.C, v3.plain)).status, 200);
    const k = await c.C.post('/api/billing/cancel', { orderId: o.id, kind: 'ordinary', when: 'now' });
    assert.equal(k.status, 200, JSON.stringify(k.data));
    assert.ok(near((await userRow(c.id)).access_until, Date.now() + 30 * DAY), 'Gratiszeit hängt an das Kündigungsende');
    // d) lifetime + Bestellung + Widerruf bleibt lifetime.
    const d = await registerSelf();
    o = await buy(d.C);
    const life = await createPublic({ kind: 'lifetime', maxRedemptions: 3 });
    assert.equal((await redeem(d.C, life.plain)).status, 200);
    assert.equal((await d.C.post('/api/billing/withdraw', { orderId: o.id })).status, 200);
    const du = await userRow(d.id);
    assert.equal(du.plan_kind, 'lifetime'); assert.equal(du.access_until, null);
    assert.equal((await d.C.get('/api/me')).data.plan.kind, 'lifetime');
  });

  test('[12] Keine Mollie-Zahlung, keine Bestellung, kein Umsatz durch Gutscheine', async () => {
    const before = { calls: mollie.calls.length, orders: (await db.query('SELECT count(*)::int n FROM orders')).rows[0].n, inv: (await db.query('SELECT coalesce(sum(last),0)::int n FROM invoice_counters')).rows[0].n };
    const rep0 = (await Adm.get('/api/admin/billing')).data;
    const { C } = await registerSelf();
    const v = await createPublic();
    const life = await createPublic({ kind: 'lifetime', maxRedemptions: 2 });
    assert.equal((await redeem(C, v.plain)).status, 200);
    const { C: L } = await registerSelf();
    assert.equal((await redeem(L, life.plain)).status, 200);
    assert.equal(mollie.calls.length, before.calls, 'kein Aufruf bei Mollie');
    assert.equal((await db.query('SELECT count(*)::int n FROM orders')).rows[0].n, before.orders);
    assert.equal((await db.query('SELECT coalesce(sum(last),0)::int n FROM invoice_counters')).rows[0].n, before.inv, 'keine Rechnungsnummer');
    const rep1 = (await Adm.get('/api/admin/billing')).data;
    assert.deepEqual(rep1.total, rep0.total, 'Umsatz unverändert');
    assert.deepEqual(rep1.statusCounts, rep0.statusCounts);
  });

  test('[15] Öffentlicher Code: viele Konten, keins doppelt', async () => {
    const v = await createPublic({ maxRedemptions: 10 });
    const users = await Promise.all(Array.from({ length: 5 }, () => registerSelf()));
    const res = await Promise.all(users.flatMap(u => [redeem(u.C, v.plain), redeem(u.C, v.plain)]));
    assert.equal(res.filter(r => r.status === 200).length, 5);
    assert.equal(res.filter(r => r.data.code === 'already_redeemed').length, 5);
    assert.equal((await voucherRow(v.id)).redemptions, 5);
    const red = (await Adm.get(`/api/admin/vouchers/${v.id}/redemptions`)).data.redemptions;
    assert.equal(red.length, 5);
    assert.deepEqual(Object.keys(red[0]).sort(), ['account', 'accountDeleted', 'at', 'days', 'grantedFrom', 'grantedUntil', 'kind', 'origin', 'redeemedAt', 'until']);
    assert.ok(!JSON.stringify(red).includes('@'), 'keine Adressen im Verlauf');
  });

  test('[16] Zwei gleichzeitig am letzten Platz: genau eine', async () => {
    const v = await createPublic({ maxRedemptions: 3 });
    const [a, b, c, d] = await Promise.all(Array.from({ length: 4 }, () => registerSelf()));
    assert.equal((await redeem(a.C, v.plain)).status, 200);
    assert.equal((await redeem(b.C, v.plain)).status, 200);
    const res = await Promise.all([redeem(c.C, v.plain), redeem(d.C, v.plain)]);
    assert.deepEqual(res.map(r => r.status).sort(), [200, 410]);
    assert.equal((await voucherRow(v.id)).redemptions, 3);
    assert.equal((await db.query('SELECT count(*)::int n FROM voucher_redemptions WHERE voucher_id = $1', [v.id])).rows[0].n, 3);
  });

  test('[17] Ohne Gesamtlimit mit Frist: einmal je Konto, nach der Frist nicht mehr', async () => {
    const v = await createPublic({ maxRedemptions: null, confirmUnlimited: true });
    const users = await Promise.all(Array.from({ length: 4 }, () => registerSelf()));
    const res = await Promise.all(users.map(u => redeem(u.C, v.plain)));
    assert.ok(res.every(r => r.status === 200));
    assert.equal((await redeem(users[0].C, v.plain)).data.code, 'already_redeemed');
    const pv = await client(srv.base).post('/api/vouchers/preview', { code: v.plain });
    assert.equal(pv.data.limited, false); assert.equal(pv.data.limitTotal, null);
    await db.query(`UPDATE vouchers SET redeem_until = now() - interval '1 second' WHERE id = $1`, [v.id]);
    const late = await registerSelf();
    assert.equal((await redeem(late.C, v.plain)).data.code, 'expired');
    // Die Frist beendet keinen gewährten Zugang.
    assert.equal((await users[1].C.get('/api/me')).data.plan.kind, 'pass');
  });

  test('[18] Öffentlich dauerhaft mit Limit; Frist beendet keinen dauerhaften Zugang', async () => {
    const v = await createPublic({ kind: 'lifetime', maxRedemptions: 2 });
    assert.equal(v.summary.startsWith('2 dauerhafte Gratiszugänge'), true);
    const users = await Promise.all(Array.from({ length: 3 }, () => registerSelf()));
    const res = await Promise.all(users.map(u => redeem(u.C, v.plain)));
    assert.equal(res.filter(r => r.status === 200).length, 2);
    assert.equal(res.filter(r => r.data.code === 'exhausted').length, 1);
    await db.query(`UPDATE vouchers SET redeem_until = now() - interval '1 second' WHERE id = $1`, [v.id]);
    const ok = users.filter((_, i) => res[i].status === 200);
    for (const u of ok) assert.equal((await u.C.get('/api/me')).data.plan.kind, 'lifetime');
  });

  test('[19] Zwei Kanalcodes derselben Kampagne, auch gleichzeitig: höchstens eine; fremde Kampagnen kombinierbar', async () => {
    const camp = `Herbstaktion ${crypto.randomBytes(2).toString('hex')}`;
    const li = await createPublic({ campaign: camp });
    const nl = await createPublic({ campaign: camp.toUpperCase() });
    assert.equal(li.campaignId, nl.campaignId, 'gleiche Kampagne, Schreibweise egal');
    const { C, id } = await registerSelf();
    const res = await Promise.all([redeem(C, li.plain), redeem(C, nl.plain), redeem(C, li.plain), redeem(C, nl.plain)]);
    assert.equal(res.filter(r => r.status === 200).length, 1, res.map(r => `${r.status}:${r.data.code}`).join(','));
    assert.ok(res.filter(r => r.status !== 200).every(r => ['campaign_redeemed', 'already_redeemed'].includes(r.data.code)));
    const pv = await C.post('/api/vouchers/preview', { code: res[0].status === 200 ? nl.plain : li.plain });
    assert.ok(['campaign_redeemed', 'already_redeemed'].includes(pv.data.reason));
    const other = await createPublic({ campaign: `Andere ${camp}` });
    assert.equal((await redeem(C, other.plain)).status, 200, 'unabhängige Kampagne geht');
    assert.ok(near((await userRow(id)).access_until, Date.now() + 60 * DAY), 'unterschiedliche Zeitgutscheine nacheinander');
    // Kampagne/Typ/Dauer nach Einlösung fest (Datenbank-Sperre).
    await assert.rejects(db.query('UPDATE vouchers SET days = 365 WHERE id = $1', [other.id]), /fest/);
    await assert.rejects(db.query('UPDATE vouchers SET campaign_id = NULL WHERE id = $1', [other.id]), /fest/);
  });

  test('[20] Neuer Besucher: Vorschau reserviert nichts, Registrierung, Bestätigung, Einlösung; geschlossene Registrierung', async () => {
    const v = await createPublic({ maxRedemptions: 50 });
    const anon = client(srv.base);
    const pv = await anon.post('/api/vouchers/preview', { code: v.plain });
    assert.deepEqual(Object.keys(pv.data).sort(), ['days', 'kind', 'limitTotal', 'limited', 'ok', 'redeemUntil', 'registrationOpen']);
    assert.equal(pv.data.registrationOpen, true);
    assert.equal(pv.data.limitTotal, 50);
    assert.ok(!('remaining' in pv.data) && !JSON.stringify(pv.data).includes('redemptions'), 'keine Restplätze');
    for (let i = 0; i < 5; i++) await anon.post('/api/vouchers/preview', { code: v.plain });
    assert.equal((await voucherRow(v.id)).redemptions, 0, 'Vorschau verbraucht nichts');
    const { C, email } = await registerSelf({ confirmed: false });
    assert.equal((await C.post('/api/vouchers/preview', { code: v.plain })).data.ok, true);
    assert.equal((await redeem(C, v.plain)).data.code, 'email_unconfirmed');
    assert.equal((await voucherRow(v.id)).redemptions, 0);
    await confirm(C, email);
    const r = await C.post('/api/vouchers/redeem', { code: v.plain, origin: 'code_page' });
    assert.equal(r.status, 200);
    assert.equal((await voucherRow(v.id)).redemptions, 1);
    assert.equal((await db.query('SELECT origin FROM voucher_redemptions WHERE voucher_id = $1', [v.id])).rows[0].origin, 'code_page');
    // Geschlossene Registrierung: die Vorschau sagt es (gleiche Logik, Schalter aus).
    const closed = createVouchers({ pool: db, registrationOpen: () => false, log: () => {} });
    const pc = await closed.preview(v.plain);
    assert.equal(pc.ok, true); assert.equal(pc.registrationOpen, false);
  });

  test('Bestandskonto (unbegrenzt) bleibt unverändert; Code wird nicht verbraucht', async () => {
    const v = await createPublic();
    const r = await redeem(Bestand, v.plain);
    assert.equal(r.status, 409); assert.equal(r.data.code, 'already_lifetime');
    const row = await userRow(bestandId);
    assert.equal(row.access_until, null);
    assert.equal(row.plan_kind, null);
    assert.equal((await Bestand.get('/api/me')).data.plan.kind, 'unlimited');
    assert.equal((await grantsOf(bestandId)).length, 0);
    assert.equal((await voucherRow(v.id)).redemptions, 0);
  });

  test('Kennzahlen je Gutschein, Kampagne und Zugangsart', async () => {
    const camp = `Messung ${crypto.randomBytes(2).toString('hex')}`;
    const v = await createPublic({ campaign: camp });
    const a = await registerSelf();
    const b = await registerSelf();
    assert.equal((await redeem(a.C, v.plain)).status, 200);
    assert.equal((await redeem(b.C, v.plain)).status, 200);
    assert.equal((await a.C.post('/api/resumes', { id: 'm1', payload: { id: 'm1', data: {} } })).status, 200);
    const o = await buy(b.C);
    assert.equal((await b.C.post('/api/billing/withdraw', { orderId: o.id })).status, 200);
    const s = (await Adm.get('/api/admin/voucher-stats')).data;
    const sv = s.vouchers.find(x => x.id === v.id);
    assert.deepEqual({ r: sv.redemptions, used: sv.usedPassFeature, buyers: sv.buyers, p: sv.purchases, ref: sv.refundedPurchases, conv: sv.conversionPercent },
      { r: 2, used: 1, buyers: 1, p: 1, ref: 1, conv: 50 });
    const sc = s.campaigns.find(x => x.campaign === camp);
    assert.equal(sc.redemptions, 2);
    const row = s.rows.find(x => x.campaign === camp);
    assert.deepEqual({ r: row.redemptions, u: row.usedFeature, p: row.purchasesAfter, ref: row.refundsOfThose }, { r: 2, u: 1, p: 1, ref: 1 });
    assert.equal(s.byKind.lifetime.purchases, null, 'dauerhafte aus „Gratis wird Kauf“ ausgenommen');
    assert.ok(s.notes.some(x => /nicht je Mensch/.test(x)));
    assert.ok(!JSON.stringify(s).includes('@') && !JSON.stringify(s).includes(v.plain), 'keine Adressen, keine Codes');
  });

  test('Admin-Laufzeit läuft über Berechtigungen und bleibt mit Gutscheinen konsistent; Protokoll', async () => {
    const { C, id } = await registerSelf();
    const v = await createPublic();
    assert.equal((await redeem(C, v.plain)).status, 200);
    let r = await Adm.post(`/api/admin/users/${id}/access`, { days: 10 });
    assert.equal(r.status, 200);
    assert.ok(near(r.data.accessUntil, Date.now() + 40 * DAY));
    r = await Adm.post(`/api/admin/users/${id}/access`, { until: null });
    assert.equal(r.status, 200);
    assert.equal(r.data.accessUntil, null);
    assert.equal((await C.get('/api/me')).data.plan.kind, 'unlimited');
    const audit = (await db.query(`SELECT count(*)::int n FROM admin_audit WHERE action = 'user_access' AND target = $1`, [String(id)])).rows[0].n;
    assert.equal(audit, 2);
  });

  test('Direkt geschriebene Laufzeit wird nie still überschrieben (Ausgangswert + Log)', async () => {
    const { C, id } = await registerSelf();
    const v = await createPublic();
    assert.equal((await redeem(C, v.plain)).status, 200);
    // Jemand setzt die Laufzeit von Hand (z. B. Altbestand, Datenbank-Eingriff).
    await db.query(`UPDATE users SET access_until = now() + interval '200 days' WHERE id = $1`, [id]);
    const v2 = await createPublic();
    assert.equal((await redeem(C, v2.plain)).status, 200);
    assert.ok(near((await userRow(id)).access_until, Date.now() + 230 * DAY), 'Handwert bleibt, Gutschein schließt an');
    assert.ok((await grantsOf(id)).some(g => g.source === 'legacy'));
    assert.ok(await waitFor(() => new RegExp(`Konto #${id}: gespeicherte Laufzeit weicht`).test(srv.output)));
  });

  test('Migration auf Altbestand: keine Laufzeit ändert sich; Abweichungen werden gemeldet, nicht überschrieben', async () => {
    // Altbestand, wie ihn der Code vor dieser Änderung hinterließ.
    const mk = async (name, sql, params) => (await db.query(sql, [name, ...params])).rows[0].id;
    const ins = `INSERT INTO users (username, password_hash, role, email, created_at, access_until, signup_source, plan_kind)
                 VALUES ($1, 'x', 'user', $1 || '@alt.example.org', $2, $3, $4, $5) RETURNING id`;
    const t0 = new Date(Date.now() - 20 * DAY);
    // 1) Pilot über Einladung mit 30 Tagen.
    await db.query(`INSERT INTO invite_codes (code, max_uses, uses, access_days) VALUES ('ALTP-ILOT', 5, 2, 30)`);
    const pilot = await mk('altpilot', ins, [t0, new Date(t0.getTime() + 30 * DAY), null, null]);
    await db.query(`INSERT INTO invite_redemptions (code, user_id, redeemed_at) VALUES ('ALTP-ILOT', $1, $2)`, [pilot, t0]);
    // 2) Pilot, vom Admin um 10 Tage verlängert (nicht rekonstruierbar).
    const ext = await mk('altext', ins, [t0, new Date(t0.getTime() + 40 * DAY), null, null]);
    await db.query(`INSERT INTO invite_redemptions (code, user_id, redeemed_at) VALUES ('ALTP-ILOT', $1, $2)`, [ext, t0]);
    // 3) Selbst registriert, ein bezahlter Pass.
    const paidAt = new Date(t0.getTime() + DAY);
    const buyer = await mk('altkauf', ins, [t0, new Date(paidAt.getTime() + 90 * DAY), 'self', 'pass']);
    const oid = crypto.randomUUID();
    await db.query(
      `INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, status, pass_days, paid_at, pass_from, pass_until, invoice_no)
       VALUES ($1, 'B-990001', $2, 'altkauf@alt.example.org', 'Alt Kauf', 'DE', 'pass90', 900, 'paid', 90, $3, $3, $4, 'ALT-1')`,
      [oid, buyer, paidAt, new Date(paidAt.getTime() + 90 * DAY)]);
    // 4) Selbst registriert, Pass widerrufen (Laufzeit endete beim Widerruf).
    const wAt = new Date(paidAt.getTime() + 2 * DAY);
    const wd = await mk('altwiderruf', ins, [t0, wAt, 'self', 'pass']);
    await db.query(
      `INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, status, pass_days, paid_at, pass_from, pass_until, invoice_no, withdrawn_at)
       VALUES ($1, 'B-990002', $2, 'altwiderruf@alt.example.org', 'Alt W', 'DE', 'pass90', 900, 'refunded', 90, $3, $3, $4, 'ALT-2', $5)`,
      [crypto.randomUUID(), wd, paidAt, new Date(paidAt.getTime() + 90 * DAY), wAt]);
    // 5) Bestand unbegrenzt, 6) selbst registriert ohne Pass.
    const unl = await mk('altunbegrenzt', ins, [t0, null, null, null]);
    const none = await mk('altohne', ins, [t0, t0, 'self', 'none']);

    const snapshot = async () => Object.fromEntries((await db.query('SELECT id, access_until, plan_kind FROM users ORDER BY id')).rows
      .map(r => [r.id, `${r.access_until ? new Date(r.access_until).toISOString() : 'null'}|${r.plan_kind}`]));
    const before = await snapshot();
    const lines = [];
    const migName = `test_${crypto.randomBytes(3).toString('hex')}`;
    const res = await migrateGrants(db, { log: l => lines.push(l), name: migName });
    assert.equal(res.ran, true);
    assert.deepEqual(await snapshot(), before, 'an users hat sich nichts geändert');
    assert.deepEqual(res.mismatched.map(m => m.userId), [ext], JSON.stringify(res.mismatched));
    assert.ok(lines.some(l => l.includes(`Konto #${ext} weicht ab`)), lines.join('\n'));
    assert.ok(lines.some(l => /Konten geprüft/.test(l)));
    const gp = await grantsOf(pilot);
    assert.deepEqual(gp.map(g => [g.source, g.kind, g.days]), [['pilot', 'days', 30]]);
    const gb = await grantsOf(buyer);
    assert.deepEqual(gb.map(g => [g.source, g.source_id, g.revoked_at]), [['order', oid, null]]);
    assert.ok((await grantsOf(wd))[0].revoked_at, 'widerrufener Pass als widerrufener Grant');
    assert.equal((await grantsOf(unl)).length, 0);
    assert.equal((await grantsOf(none)).length, 0);
    assert.deepEqual((await grantsOf(ext)).map(g => g.source), ['pilot', 'legacy']);
    // Neuberechnung aus den Grants ergibt genau den gespeicherten Wert.
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      for (const uid of [pilot, ext, buyer, wd, unl, none]) await recomputeAccess(c, uid);
      await c.query('COMMIT');
    } finally { c.release(); }
    const after = await snapshot();
    for (const uid of [pilot, ext, buyer, wd, unl, none]) {
      const [a1] = after[uid].split('|'); const [b1] = before[uid].split('|');
      assert.ok(a1 === b1 || near(a1, b1, 1000), `#${uid}: ${a1} vs ${b1}`);
    }
    // Ein zweiter Lauf mit demselben Namen tut nichts.
    const again = await migrateGrants(db, { log: () => {}, name: migName });
    assert.equal(again.ran, false);
    // Admin-Verlängerung des abweichenden Kontos geht vom gespeicherten Wert aus.
    const r = await Adm.post(`/api/admin/users/${ext}/access`, { days: 5 });
    assert.ok(near(r.data.accessUntil, t0.getTime() + 45 * DAY, 1000));
  });
});
