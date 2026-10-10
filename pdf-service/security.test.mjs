// Regressionstests Sicherheit Runde 6 (09.10.2026) — siehe SICHERHEIT.md.
//
// Jede Probe der Prüfer (scratchpad/agents/security: probe1–4, redos,
// refuzz) steht hier als Test, der nach dem Fix SCHEITERN muss, dazu der
// Normalfall in die andere Richtung. Echter Dienst (server.js) gegen echte
// Postgres-Instanz und einen Mollie-Mock; Mails landen in einer Datei.
//
// Eigene Ports: Postgres 5561, API 3261 (Hauptinstanz) und 3262 (zweite
// Instanz hinter „Proxy“, TRUST_PROXY=1, Rate-Limits ohne Testfaktor).
// Überschreibbar mit SECURITY_PG_PORT / SECURITY_API_PORT.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import pg from 'pg';
import { solveChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';
import { startPostgres, startServer, client, findChromium, findPgBin } from './testkit.mjs';
import { createBilling, billingConfig } from './billing.js';
import { markdownToCV, markdownToCl, splitLanguageLine, splitKeyLine, MAX_MARKDOWN_CHARS } from './markdown.js';
import { subnetOf, clientKey, originGuard, securityHeaders } from './guards.js';
import { chromiumArgs, createRenderer } from './pdf.js';
import { sharePhotoPath } from './share.js';
import { ART9_VERSION } from './consent.js';
// Einwilligung Art. 9 DSGVO (B4, 10.10.2026): Ohne sie speichert ein Konto nicht.
const ART9 = { version: ART9_VERSION };

const PG_PORT = Number(process.env.SECURITY_PG_PORT || 5561);
const API_PORT = Number(process.env.SECURITY_API_PORT || 3261);
const PROXY_PORT = API_PORT + 1;
const MOLLIE_KEY = 'test_mockmockmockmockmockmockmockmo';
const chromiumPath = findChromium();
const PG_MISSING = findPgBin() ? false : 'keine Postgres-Binärdateien gefunden (PG_BIN setzen)';
const DAY = 86_400_000;

process.env.ALTCHA_COST = '10';
process.env.ALTCHA_COUNTER_MIN = '5';
process.env.ALTCHA_COUNTER_MAX = '40';

const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── Reine Funktionen ─────────────────────────────────────────────────── */

test('H1: splitLanguageLine entspricht dem alten Ausdruck — für jede Eingabe, in linearer Zeit', () => {
  const OLD = /^[-*+]\s*([^—–-]+?)\s*[—–-]\s*(.+)$/;
  const alphabet = ['-', '*', '+', ' ', 'a', '—', '–', ' ', '\t', 'b', '(', '5', ')', '\r', 'ä'];
  let seed = 7;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 60_000; i++) {
    let t = '';
    for (let j = 0, len = 1 + rnd(10); j < len; j++) t += alphabet[rnd(alphabet.length)];
    const m = t.match(OLD);
    assert.deepEqual(splitLanguageLine(t), m ? { language: m[1].trim(), level: m[2].trim() } : null, JSON.stringify(t));
  }
  for (const [t, want] of [
    ['- Deutsch – Muttersprache (5/5)', { language: 'Deutsch', level: 'Muttersprache (5/5)' }],
    ['* Englisch - C1', { language: 'Englisch', level: 'C1' }],
    ['+Französisch—B2', { language: 'Französisch', level: 'B2' }],
    ['- nur Text', null], ['- – C1', { language: '', level: 'C1' }], ['-– C1', null], ['Deutsch – C2', null],
  ]) assert.deepEqual(splitLanguageLine(t), want, t);
  // Probe redos/probe4: „- “ + 3000 Leerzeichen + „a“ (vorher 8,8 s Blockade).
  let t0 = Date.now();
  assert.equal(splitLanguageLine('- ' + ' '.repeat(3000) + 'a'), null);
  assert.equal(splitLanguageLine('- ' + ' '.repeat(1500) + 'a'), null);
  assert.ok(Date.now() - t0 < 50, `${Date.now() - t0} ms`);
  t0 = Date.now();
  const base = { id: 'x', data: { de: {} }, settings: { lang: 'de' } };
  markdownToCV('# Max\n\n## Sprachen\n\n- ' + ' '.repeat(190_000) + 'a\n', base);
  assert.ok(Date.now() - t0 < 500, `Import 190 KB: ${Date.now() - t0} ms`);
  assert.throws(() => markdownToCV('x'.repeat(MAX_MARKDOWN_CHARS + 1), base), /zu groß/);
});

test('H1: kein regulärer Ausdruck in markdown.js braucht auf 1.500 Zeichen mehr als 50 ms (refuzz)', () => {
  const req = createRequire(import.meta.url);
  let espree;
  try { espree = req('espree'); } catch { return; }   // nur mit Entwicklungsabhängigkeiten
  const src = readFileSync(new URL('./markdown.js', import.meta.url), 'utf8');
  const toks = espree.tokenize(src, { ecmaVersion: 'latest', sourceType: 'module', loc: true });
  const slow = [];
  for (const t of toks.filter(x => x.type === 'RegularExpression')) {
    let re; try { re = new RegExp(t.regex.pattern, t.regex.flags.replace('g', '')); } catch { continue; }
    for (const pre of ['', '- ', '### ', '**', '* ', '| ', '# ', 'a: ', '1 ']) {
      for (const ch of [' ', 'a', '-', ':', '*', '|', '·', '1', '.', '_', '(', '\t', '–']) {
        const s = pre + ch.repeat(1500) + '\u0001';
        const a = process.hrtime.bigint(); re.test(s);
        const ms = Number(process.hrtime.bigint() - a) / 1e6;
        if (ms > 50) slow.push(`${t.loc.start.line}: /${t.regex.pattern}/ ${JSON.stringify(pre)}+${JSON.stringify(ch)} ${ms.toFixed(0)} ms`);
      }
    }
  }
  assert.deepEqual(slow, []);
});

test('H1 (Nachprüfung): Schlüsselzeilen ohne Backtracking; 200 KB bösartiges Markdown in jedem Abschnitt unter 300 ms', () => {
  const OLD = /^-\s*([^:]+):\s*(.+)$/;
  const al = ['-', ':', ' ', 'a', '\t', ' ', '\r', 'b', '\n'];
  let seed = 11;
  const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 60_000; i++) {
    let t = '';
    for (let j = 0, len = 1 + rnd(9); j < len; j++) t += al[rnd(al.length)];
    const m = t.match(OLD);
    assert.deepEqual(splitKeyLine(t), m ? { key: m[1], value: m[2] } : null, JSON.stringify(t));
  }
  // Vorher: „- “ + 40.000 Tabs + „x“ im Kontakt 1,9 s; 200 KB rund 45 s.
  const base = { id: 'x', data: { de: {} }, settings: { lang: 'de' }, coverLetters: { de: {} } };
  const cvSecs = ['## Kontakt', '## Sprachen', '## Berufserfahrung\n### T', '## Ausbildung\n### T', '## Skills\n### G', '## Projekte\n### P', '## Zertifikate\n### Z', '## Ehrenamt\n### E', '## Veröffentlichungen\n### V', '## Abschnitt: X\n### Y', '## Profil'];
  const pres = ['- ', '-a', '* ', '', 'a', '### ', 'Zeitraum: ', '- a: '];
  const chs = ['\t', ' ', '-', 'a', ':', '–', '('];
  const slow = [];
  for (const [fn, secs, head] of [[markdownToCV, cvSecs, '# A\n'], [markdownToCl, ['## Empfänger', '## Kopf', '## Einleitung'], '---\ndoc: cover-letter\n---\n']]) {
    for (const sec of secs) for (const p of pres) for (const c of chs) {
      for (const len of [1990, 40_000]) {
        const line = p + c.repeat(len) + '\u0001x';
        const md = head + sec + '\n' + Array(Math.max(1, Math.floor(190_000 / line.length))).fill(line).join('\n');
        const t0 = Date.now();
        fn(md, base);
        if (Date.now() - t0 > 300) slow.push(`${sec} ${JSON.stringify(p)}+${JSON.stringify(c)}×${len}: ${Date.now() - t0} ms`);
      }
    }
  }
  assert.deepEqual(slow, []);
});

test('M3: IPv6 je /64, IPv4 einzeln bzw. je /24', () => {
  assert.equal(clientKey('2001:db8:1:2::1'), '2001:db8:1:2::/64');
  assert.equal(clientKey('2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
  assert.equal(clientKey('::ffff:203.0.113.9'), '203.0.113.9');
  assert.equal(clientKey('203.0.113.9'), '203.0.113.9');
  assert.equal(subnetOf('203.0.113.9'), '203.0.113.0/24');
  assert.equal(subnetOf('2001:db8:1:2::ffff'), '2001:db8:1:2::/64');
  assert.equal(subnetOf('2001:db8:1:2::/64'), '2001:db8:1:2::/64');
  assert.equal(clientKey(''), 'unknown');
});

test('M6: fremder Ursprung und „null“ → 403, eigener und keiner gehen durch; Kopfzeilen', () => {
  const guard = originGuard(new Set(['https://cv.example.org']));
  const run = origin => {
    let status = 0, body = null, passed = false;
    const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
    guard({ headers: origin === undefined ? {} : { origin } }, res, () => { passed = true; });
    return { status, body, passed };
  };
  assert.equal(run(undefined).passed, true);
  assert.equal(run('https://cv.example.org').passed, true);
  for (const o of ['https://evil.example', 'null', 'https://cv.example.org.evil.example']) {
    const r = run(o);
    assert.equal(r.passed, false, o);
    assert.equal(r.status, 403, o);
    assert.equal(r.body.code, 'origin_not_allowed');
  }
  const h = {};
  securityHeaders({}, { setHeader: (k, v) => { h[k.toLowerCase()] = v; } }, () => {});
  assert.equal(h['referrer-policy'], 'same-origin');
  assert.match(h['strict-transport-security'], /max-age=31536000/);
  assert.match(h['permissions-policy'], /camera=\(\)/);
  assert.equal(h['cache-control'], 'no-store');
});

test('N2: Link-Foto bleibt ein eigener Pfad — kein //Host, kein /\\Host', () => {
  const hex = 'a'.repeat(24);
  assert.equal(sharePhotoPath(`//tracker.example/api/photos/${hex}`, 'tok'), '/pdfapi/api/share/tok/photo');
  assert.equal(sharePhotoPath(`/\\tracker.example/api/photos/${hex}`, 'tok'), '/pdfapi/api/share/tok/photo');
  assert.equal(sharePhotoPath(`https://cv.example.org//tracker.example/api/photos/${hex}`, 'tok'), '/pdfapi/api/share/tok/photo');
  assert.equal(sharePhotoPath(`https://cv.example.org/pdfapi/api/photos/${hex}`, 'tok'), '/pdfapi/api/share/tok/photo');
  assert.equal(sharePhotoPath(`/api/photos/${hex}`, 'tok'), '/api/share/tok/photo');
});

test('N7: Sandbox nur auf Wunsch; scheitert sie, fällt der Renderer zurück und liefert trotzdem', { skip: chromiumPath ? false : 'kein Chromium' }, async () => {
  assert.ok(chromiumArgs([]).includes('--no-sandbox'));
  assert.ok(!chromiumArgs([], { sandbox: true }).includes('--no-sandbox'));
  const warnings = [];
  const r = createRenderer({ executablePath: chromiumPath, sandbox: true, log: w => warnings.push(w) });
  try {
    const pdf = await r.render('<!doctype html><p>Sandbox</p>', { timeoutMs: 20_000 });
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    // Als root startet Chromium nie mit Sandbox — dann muss der Rückfall gegriffen und es gesagt haben.
    if (process.getuid?.() === 0) {
      assert.equal(r.sandboxActive, false);
      assert.ok(warnings.some(w => /ohne Sandbox|--no-sandbox/.test(w)), warnings.join('\n'));
    }
  } finally { await r.close(); }
});

/* ── Gegen den laufenden Dienst ───────────────────────────────────────── */

function startMollieMock() {
  const payments = new Map();
  const refunds = new Map();
  const rid = p => `${p}_${crypto.randomBytes(5).toString('hex')}`;
  const server = http.createServer((rq, res) => {
    let raw = '';
    rq.on('data', d => { raw += d; });
    rq.on('end', () => {
      const send = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/hal+json' }); res.end(JSON.stringify(obj)); };
      const body = raw ? JSON.parse(raw) : undefined;
      if (rq.headers.authorization !== `Bearer ${MOLLIE_KEY}`) return send(401, { status: 401 });
      let m;
      if (rq.method === 'POST' && rq.url === '/v2/payments') {
        const id = rid('tr');
        const p = { resource: 'payment', id, status: 'open', amount: body.amount, metadata: body.metadata, _links: { checkout: { href: `https://www.mollie.com/checkout/x?t=${id}` } } };
        payments.set(id, p);
        return send(201, p);
      }
      if (rq.method === 'GET' && (m = /^\/v2\/payments\/(tr_\w+)$/.exec(rq.url))) return payments.get(m[1]) ? send(200, payments.get(m[1])) : send(404, {});
      if (rq.method === 'POST' && (m = /^\/v2\/payments\/(tr_\w+)\/refunds$/.exec(rq.url))) {
        const p = payments.get(m[1]);
        if (!p || p.status !== 'paid') return send(422, {});
        const r = { resource: 'refund', id: rid('re'), paymentId: p.id, status: 'pending', amount: body.amount };
        refunds.set(r.id, r);
        return send(201, r);
      }
      if (rq.method === 'GET' && (m = /^\/v2\/payments\/(tr_\w+)\/refunds\/(re_\w+)$/.exec(rq.url))) return refunds.get(m[2]) ? send(200, refunds.get(m[2])) : send(404, {});
      send(404, {});
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    base: `http://127.0.0.1:${server.address().port}/v2`,
    payments, refunds,
    setStatus(id, status) { const p = payments.get(id); p.status = status; if (status === 'paid') p.paidAt = new Date().toISOString(); },
    close: () => new Promise(r => server.close(r)),
  })));
}

async function solveAltcha(base) {
  const ch = await (await fetch(`${base}/api/altcha/challenge`)).json();
  const solution = await solveChallenge({ challenge: ch, deriveKey, timeout: 20_000 });
  return Buffer.from(JSON.stringify({ challenge: ch, solution })).toString('base64');
}

describe('Sicherheit Runde 6 gegen den laufenden Dienst', { skip: PG_MISSING }, () => {
  let pgInst, srv, proxy, db, mollie, mailDir, mailFile, proxyMailFile;
  let Adm;

  const readMails = f => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } }) : []);
  const mails = () => readMails(mailFile);
  const mailsTo = to => mails().filter(m => m.to === to);
  const waitFor = async (fn, ms = 8000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) { const v = await fn(); if (v) return v; await sleep(100); }
    return fn();
  };
  const orderRow = async id => (await db.query('SELECT * FROM orders WHERE id = $1', [id])).rows[0];
  const userRow = async id => (await db.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
  const webhook = id => fetch(`${srv.base}/api/billing/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `id=${encodeURIComponent(id)}` });
  const post = (base, p, body, headers = {}) => fetch(`${base}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  async function registerSelf(email, { confirm = true } = {}) {
    const C = client(srv.base);
    const seen = mailsTo(email).filter(x => /bestätige/.test(x.subject)).length;
    const r = await C.post('/api/auth/register', { email, password: 'kunden-passwort-1', altcha: await solveAltcha(srv.base), ageConfirmed16: true, art9Consent: ART9 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    if (confirm) {
      const m = await waitFor(() => mailsTo(email).filter(x => /bestätige/.test(x.subject))[seen]);
      const token = /token=([A-Za-z0-9_-]+)/.exec(m.html)[1];
      assert.equal((await C.post('/api/auth/confirm-email', { token })).status, 200);
    }
    return { C, id: r.data.user.id, email };
  }
  async function buy(C, billingName = 'Erika Opfer') {
    const r = await C.post('/api/billing/checkout', { sku: 'pass90', country: 'DE', billingName, acceptTerms: true, ageConfirmed18: true });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const o = await orderRow(r.data.orderId);
    mollie.setStatus(o.mollie_payment_id, 'paid');
    assert.equal((await webhook(o.mollie_payment_id)).status, 200);
    return orderRow(o.id);
  }
  const tokenFrom = m => /bestaetigen\?token=([A-Za-z0-9_-]+)/.exec(m?.html || '')?.[1];
  const confirm = token => post(srv.base, '/api/billing/declarations/confirm', { token });

  before(async () => {
    pgInst = await startPostgres(PG_PORT);
    mollie = await startMollieMock();
    mailDir = mkdtempSync(path.join(tmpdir(), 'cvsec-mail-'));
    mailFile = path.join(mailDir, 'mails.jsonl');
    proxyMailFile = path.join(mailDir, 'proxy-mails.jsonl');
    const env = {
      DATABASE_URL: pgInst.url,
      JWT_SECRET: 'security-test-secret',
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: `http://localhost:${API_PORT}`,
      ALLOWED_ORIGINS: `http://localhost:${API_PORT}`,
      JANITOR: '0', ACCESS_NOTICES: '0', BILLING_JOBS: '0',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
      BILLING_ENABLED: '1', MOLLIE_API_KEY: MOLLIE_KEY, MOLLIE_API_BASE: mollie.base,
      PASS_PRICE_CENTS: '900', PASS_DAYS: '90', PRODUCT_NAME: 'CV-Hub', INVOICE_PREFIX: 'CV',
      TERMS_VERSION: 'agb-x', WITHDRAWAL_VERSION: 'wb-x',
      SELLER_NAME: 'Test', SELLER_ADDRESS: 'Weg 1 | 12345 Ort', SELLER_EMAIL: 'verkauf@example.org', SELLER_PHONE: '+49 0',
      OPEN_REGISTRATION: '1',
      ALTCHA_HMAC_KEY: 'altcha-security-test-key-0123456789',
      ...(chromiumPath ? { PDF_CHROMIUM_PATH: chromiumPath } : {}),
    };
    srv = await startServer({ ...env, TRUST_PROXY: '', MAIL_CAPTURE_FILE: mailFile, TEST_RATE_LIMIT_FACTOR: '50' }, { port: API_PORT });
    // Zweite Instanz „hinter einem Proxy“: X-Forwarded-For zählt, Limits wie in der Produktion.
    proxy = await startServer({ ...env, TRUST_PROXY: '1', MAIL_CAPTURE_FILE: proxyMailFile, TEST_RATE_LIMIT_FACTOR: '1' }, { port: PROXY_PORT });
    db = new pg.Pool({ connectionString: pgInst.url, max: 4 });
    Adm = client(srv.base);
    const r = await Adm.post('/api/auth/register', { username: 'admin1', password: 'admin-passwort-1', email: 'admin@example.org', art9Consent: ART9 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  after(async () => {
    await db?.end().catch(() => {});
    await proxy?.stop();
    await srv?.stop();
    await mollie?.close();
    pgInst?.stop();
    try { rmSync(mailDir, { recursive: true, force: true }); } catch { /* egal */ }
  });

  // ── Live-Befunde: Kopfzeilen, 404, CORS (probe1 #1) ────────────────────

  test('Live: HSTS, Permissions-Policy, no-store auf /health und /api/*, JSON-404', async () => {
    for (const p of ['/health', '/api/templates', '/api/billing/offer']) {
      const r = await fetch(`${srv.base}${p}`);
      assert.equal(r.status, 200, p);
      assert.match(r.headers.get('strict-transport-security') || '', /max-age=31536000/, p);
      assert.match(r.headers.get('permissions-policy') || '', /geolocation=\(\)/, p);
      assert.equal(r.headers.get('cache-control'), 'no-store', p);
      assert.equal(r.headers.get('referrer-policy'), 'same-origin', p);
      assert.equal(r.headers.get('x-powered-by'), null, p);
    }
    for (const [m, p] of [['GET', '/api/gibtsnicht'], ['POST', '/api/gibtsnicht'], ['GET', '/irgendwas']]) {
      const r = await fetch(`${srv.base}${p}`, { method: m });
      assert.equal(r.status, 404, p);
      assert.match(r.headers.get('content-type') || '', /application\/json/);
      const b = await r.json();
      assert.equal(b.code, 'not_found');
      assert.doesNotMatch(JSON.stringify(b), /Cannot/);
    }
  });

  test('probe1 #1 / M6: fremder Ursprung und Origin: null → 403, nichts geändert; eigener Ursprung geht', async () => {
    const before = (await db.query("SELECT twofa_enabled FROM users WHERE username='admin1'")).rows[0].twofa_enabled;
    const r1 = await Adm.post('/api/auth/2fa', { enabled: !before }, { headers: { Origin: 'https://evil.example.com' } });
    const r2 = await Adm.post('/api/auth/2fa', { enabled: !before }, { headers: { Origin: 'null' } });
    const r3 = await Adm.post('/api/auth/logout', '{"x":1}', { headers: { 'Content-Type': 'text/plain', Origin: 'https://evil.example' } });
    for (const r of [r1, r2, r3]) { assert.equal(r.status, 403); assert.equal(r.data.code, 'origin_not_allowed'); }
    assert.equal((await db.query("SELECT twofa_enabled FROM users WHERE username='admin1'")).rows[0].twofa_enabled, before);
    assert.equal((await Adm.get('/api/auth/me')).status, 200, 'Abmelden über fremden Ursprung hat nicht gewirkt');
    const ok = await Adm.get('/api/auth/me', { headers: { Origin: `http://localhost:${API_PORT}` } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('access-control-allow-origin'), `http://localhost:${API_PORT}`);
    // Öffentliche OAuth-Wege ohne Cookie bleiben für Browser-Clients offen (PKCE schützt dort).
    const tok = await fetch(`${srv.base}/api/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://claude.ai' }, body: 'grant_type=authorization_code&code=x' });
    assert.notEqual(tok.status, 403);
    assert.equal(tok.headers.get('access-control-allow-origin'), '*');
  });

  test('probe2 / M6: OAuth-„Erlauben“ im echten Browser kommt durch (Origin statt null)', { skip: chromiumPath ? false : 'kein Chromium' }, async () => {
    const req = createRequire(import.meta.url);
    const { chromium } = req('playwright');
    const seen = [];
    const cb = http.createServer((rq, res) => { seen.push(rq.url); res.end('ok'); });
    await new Promise(r => cb.listen(0, '127.0.0.1', r));
    const cbUrl = `http://127.0.0.1:${cb.address().port}/cb`;
    let browser;
    try {
      const reg = await post(srv.base, '/api/oauth/register', { redirect_uris: [cbUrl], client_name: 'Probe' });
      const { client_id } = await reg.json();
      const verifier = crypto.randomBytes(40).toString('base64url');
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      browser = await chromium.launch({ executablePath: chromiumPath });
      const ctx = await browser.newContext();
      const [name, value] = Adm.cookie.split('=');
      await ctx.addCookies([{ name, value, domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
      const page = await ctx.newPage();
      const origins = [];
      page.on('request', r => { if (r.method() === 'POST') origins.push(r.headers().origin ?? '(keiner)'); });
      const first = await page.goto(`http://localhost:${API_PORT}/api/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(cbUrl)}&response_type=code&code_challenge=${challenge}&code_challenge_method=S256&state=abc`);
      assert.equal(first.status(), 200);
      assert.equal(first.headers()['referrer-policy'], 'same-origin');
      await page.click('button[value=allow]');
      await waitFor(() => seen.length > 0, 8000);
      assert.deepEqual(origins, [`http://localhost:${API_PORT}`]);
      assert.equal(seen.length, 1, 'Rückleitung erreicht');
      assert.match(seen[0], /code=.*state=abc|state=abc.*code=/);
    } finally {
      await browser?.close();
      cb.close();
    }
  });

  // ── H2: öffentliche Kündigung (probe1 #2) ──────────────────────────────

  test('probe1 #2 / H2: Kündigung nur mit der Adresse des Opfers beendet nichts; erst der Link an die Bestelladresse', async () => {
    const victim = await registerSelf('opfer@example.org');
    const order = await buy(victim.C);
    const planBefore = (await victim.C.get('/api/me')).data.plan;
    const rc = await post(srv.base, '/api/billing/cancel-public', { name: 'Irgendwer', email: 'opfer@example.org', when: 'now', altcha: await solveAltcha(srv.base) });
    assert.equal(rc.status, 200);
    assert.deepEqual(Object.keys(await rc.json()).sort(), ['ok', 'receivedAt']);
    const mail = await waitFor(() => mailsTo('opfer@example.org').find(m => /Bitte bestätigen: Ihre Kündigung/.test(m.subject)));
    assert.ok(mail, 'Eingangsbestätigung mit Link an die Bestelladresse');
    assert.match(mail.html, /Eingang: \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2}/);
    assert.ok(mail.html.includes(order.order_no));
    await sleep(500);
    const o = await orderRow(order.id);
    assert.equal(o.cancelled_at, null, 'nichts gekündigt');
    const planAfter = (await victim.C.get('/api/me')).data.plan;
    assert.equal(planAfter.until, planBefore.until);
    assert.equal((await victim.C.post('/api/resumes', { id: 'p1', displayName: 'x', payload: { id: 'p1', data: {} } })).status, 200, 'schreibt weiter');
    const d = (await db.query(`SELECT * FROM declarations WHERE $1 = ANY(order_ids) AND type = 'cancellation'`, [order.id])).rows[0];
    assert.equal(d.status, 'pending_confirmation');
    const token = tokenFrom(mail);
    assert.equal(d.confirm_token_hash, sha256(token), 'nur der Hash liegt in der Datenbank');
    assert.ok(!JSON.stringify(d).includes(token));
    assert.ok(new Date(d.confirm_expires_at).getTime() - Date.now() > 13.9 * DAY);

    // Ungültig, dann gültig, dann ein zweites Mal.
    assert.equal((await confirm('x'.repeat(43))).status, 400);
    assert.equal((await confirm('kurz')).status, 400);
    const c1 = await confirm(token);
    const b1 = await c1.json();
    assert.equal(c1.status, 200, JSON.stringify(b1));
    assert.equal(b1.kind, 'cancel');
    assert.equal(b1.orderNo, order.order_no);
    assert.equal(new Date(b1.receivedAt).getTime(), new Date(d.received_at).getTime());
    assert.ok(Date.parse(b1.effectiveAt));
    assert.ok((await orderRow(order.id)).cancelled_at, 'jetzt gekündigt');
    assert.equal((await victim.C.get('/api/me')).data.plan.kind, 'none');
    const c2 = await confirm(token);
    assert.equal(c2.status, 409, 'einmalig');
    assert.equal((await c2.json()).code, 'token_used');
    assert.ok(await waitFor(() => mailsTo('opfer@example.org').find(m => /Kündigungsbestätigung/.test(m.subject))));
  });

  // ── M1: öffentlicher Widerruf (probe1 #3) ──────────────────────────────

  test('probe1 #3 / M1: Widerruf nur mit der Adresse erstattet nichts; Link an die Bestelladresse führt aus', async () => {
    const victim = await registerSelf('opfer2@example.org');
    const order = await buy(victim.C);
    const refundsBefore = mollie.refunds.size;
    const rw = await post(srv.base, '/api/billing/withdraw-public', { name: 'Irgendwer', email: 'opfer2@example.org', altcha: await solveAltcha(srv.base) });
    assert.equal(rw.status, 200);
    const mail = await waitFor(() => mailsTo('opfer2@example.org').find(m => /Bitte bestätigen: Ihr Widerruf/.test(m.subject)));
    assert.ok(mail);
    assert.match(mail.html, /Hiermit widerrufe ich/, 'Wortlaut an die Bestelladresse');
    await sleep(400);
    assert.equal((await orderRow(order.id)).status, 'paid', 'nichts widerrufen');
    assert.equal(mollie.refunds.size, refundsBefore, 'keine Erstattung beauftragt');
    assert.equal((await victim.C.get('/api/me')).data.plan.kind, 'pass');
    const c = await confirm(tokenFrom(mail));
    const b = await c.json();
    assert.equal(c.status, 200, JSON.stringify(b));
    assert.equal(b.kind, 'withdraw');
    assert.equal(b.orderNo, order.order_no);
    assert.ok(['requested', 'pending'].includes(b.refund.status), b.refund.status);
    const o = await orderRow(order.id);
    assert.equal(o.status, 'withdrawn');
    assert.equal(o.withdraw_channel, 'public');
    assert.equal(mollie.refunds.size, refundsBefore + 1);
    assert.ok(await waitFor(() => mailsTo('opfer2@example.org').find(m => /Eingangsbestätigung Ihres Widerrufs/.test(m.subject))));
    // N8: Datenauszug enthält die Erklärung, ohne Token-Hash.
    const dump = (await victim.C.get('/api/me/export')).data;
    const dumpText = typeof dump === 'string' ? dump : JSON.stringify(dump);
    const parsed = typeof dump === 'string' ? JSON.parse(dump) : dump;
    assert.ok(parsed.declarations.some(x => x.type === 'withdrawal' && x.status === 'processed'));
    assert.doesNotMatch(dumpText, /confirm_token_hash/);
  });

  test('M1: Für die Frist zählt der Eingang — nach Fristende bestätigt, vorher eingegangen: wirksam', async () => {
    const { C } = await registerSelf('frist@example.org');
    const order = await buy(C);
    await post(srv.base, '/api/billing/withdraw-public', { name: 'Fritz Frist', email: 'frist@example.org', orderNo: order.order_no, altcha: await solveAltcha(srv.base) });
    const mail = await waitFor(() => mailsTo('frist@example.org').find(m => /Bitte bestätigen: Ihr Widerruf/.test(m.subject)));
    // Kauf vor 16 Tagen (Frist vorbei), Eingang am 13. Tag (innerhalb der Frist), Klick heute.
    await db.query(`UPDATE orders SET paid_at = now() - interval '16 days' WHERE id = $1`, [order.id]);
    await db.query(`UPDATE declarations SET received_at = now() - interval '3 days' WHERE $1 = ANY(order_ids) AND status = 'pending_confirmation'`, [order.id]);
    const c = await confirm(tokenFrom(mail));
    assert.equal(c.status, 200, JSON.stringify(await c.clone().json()));
    assert.equal((await orderRow(order.id)).status, 'withdrawn');

    // Eingang NACH Fristende: kein Link, Eingang an die Bestelladresse, Betreiber entscheidet, nichts ausgeführt.
    const { C: C2 } = await registerSelf('spaet2@example.org');
    const o2 = await buy(C2);
    await db.query(`UPDATE orders SET paid_at = now() - interval '16 days' WHERE id = $1`, [o2.id]);
    await post(srv.base, '/api/billing/withdraw-public', { name: 'Spät', email: 'spaet2@example.org', orderNo: o2.order_no, altcha: await solveAltcha(srv.base) });
    const late = await waitFor(() => mailsTo('spaet2@example.org').find(m => /Eingangsbestätigung Ihrer Erklärung – Bestellung/.test(m.subject)));
    assert.ok(late);
    assert.equal(tokenFrom(late), undefined, 'kein Bestätigungslink');
    assert.equal((await orderRow(o2.id)).status, 'paid');
    assert.ok(await waitFor(() => mailsTo('verkauf@example.org').find(m => /Widerruf nach Fristende/.test(m.subject))));
  });

  test('Bestätigungslink: abgelaufen → 410 und nichts ausgeführt; nach 14 Tagen unbestätigt → Hinweis an den Betreiber', async () => {
    const { C } = await registerSelf('ablauf@example.org');
    const order = await buy(C);
    // Ohne Bestellnummer: Bestätigungslink (mit Nummer wirkt die Kündigung seit P4 sofort).
    await post(srv.base, '/api/billing/cancel-public', { name: 'Anton Ablauf', email: 'ablauf@example.org', kind: 'ordinary', when: 'now', altcha: await solveAltcha(srv.base) });
    const mail = await waitFor(() => mailsTo('ablauf@example.org').find(m => /Bitte bestätigen: Ihre Kündigung/.test(m.subject)));
    await db.query(`UPDATE declarations SET confirm_expires_at = now() - interval '1 minute' WHERE $1 = ANY(order_ids) AND status = 'pending_confirmation'`, [order.id]);
    // Hintergrundlauf (eigene Instanz gegen dieselbe Datenbank): meldet, führt nicht aus.
    const sent = [];
    const b = createBilling({
      pool: db,
      config: billingConfig({ BILLING_ENABLED: '1', MOLLIE_API_KEY: MOLLIE_KEY, MOLLIE_API_BASE: mollie.base, PUBLIC_BASE_URL: `http://localhost:${API_PORT}`, SELLER_EMAIL: 'verkauf@example.org' }),
      renderPdf: async () => Buffer.from('%PDF-1.4 stub'),
      send: async m => { sent.push(m); return true; },
      log: () => {},
    });
    const r = await b.runJobs({ onlyDeclarations: true });
    assert.ok(r.unconfirmedDeclarations >= 1);
    const admin = sent.find(m => m.to === 'verkauf@example.org' && /Kündigung 14 Tage unbestätigt/.test(m.subject));
    assert.ok(admin, 'Hinweis an den Betreiber');
    assert.match(admin.text, /Hiermit kündige ich/, 'mit Wortlaut');
    assert.ok(!sent.some(m => m.to === 'ablauf@example.org'), 'keine Mail an den Kunden');
    const d = (await db.query(`SELECT * FROM declarations WHERE $1 = ANY(order_ids)`, [order.id])).rows[0];
    assert.equal(d.status, 'manual');
    assert.equal((await b.runJobs({ onlyDeclarations: true })).unconfirmedDeclarations, 0, 'nur einmal gemeldet');
    const c = await confirm(tokenFrom(mail));
    assert.equal(c.status, 410);
    assert.equal((await c.json()).code, 'token_expired');
    assert.equal((await orderRow(order.id)).cancelled_at, null);
    assert.equal((await C.get('/api/me')).data.plan.kind, 'pass');
  });

  // ── M4: Mail-Relay (probe1 #4) ─────────────────────────────────────────

  test('probe1 #4 / M4: nicht zuzuordnende Erklärung — an die eingegebene Adresse nur fester Text, Wortlaut nur an den Betreiber', async () => {
    const before = mailsTo('verkauf@example.org').length;
    await post(srv.base, '/api/billing/cancel-public', { name: 'Ihr Konto wird gesperrt', email: 'beliebig@drittperson.example', kind: 'extraordinary', reason: 'Sicherheitswarnung: Bitte bestätigen Sie Ihr Konto unter https://phish.example/login sonst wird es gelöscht.', altcha: await solveAltcha(srv.base) });
    const m = await waitFor(() => mailsTo('beliebig@drittperson.example')[0]);
    assert.ok(m, 'Eingangsbestätigung (fester Text)');
    for (const leak of ['phish.example', 'Sicherheitswarnung', 'Hiermit', 'bestaetigen?token', 'https://', 'gelöscht']) {
      assert.ok(!m.html.includes(leak) && !m.text.includes(leak), `kein Absendertext in der Mail: ${leak}`);
    }
    /* P2 (§ 356a Abs. 4 BGB, Prüfteam 10.10.2026): Der Name steht geprüft in
     * der Eingangsbestätigung — nur als „Name:“-Zeile, ohne Links, höchstens
     * 80 Zeichen. Der Grund (freier Text) bleibt draußen. */
    assert.match(m.text, /Name: Ihr Konto wird gesperrt/);
    assert.equal(m.text.split('gesperrt').length - 1, 1, 'Name nur einmal, nur in der Namenszeile');
    const admin = await waitFor(() => mailsTo('verkauf@example.org').slice(before).find(x => /Handarbeit nötig: Kündigung/.test(x.subject)));
    assert.match(admin.text, /phish\.example/, 'der Betreiber sieht den Wortlaut');
    // Widerruf mit fremder Bestellnummer und eigener Adresse: ebenfalls nur fester Text, nichts über die Bestellung.
    const victim = await registerSelf('opfer3@example.org');
    const order = await buy(victim.C);
    await post(srv.base, '/api/billing/withdraw-public', { name: 'Angreifer', email: 'angreifer@example.org', orderNo: order.order_no, altcha: await solveAltcha(srv.base) });
    const n = await waitFor(() => mailsTo('angreifer@example.org')[0]);
    // Nichts über die fremde Bestellung (Adresse, Betrag, Datum, Link). Name und Nummer sind die eigenen
    // Eingaben des Absenders an seine eigene Adresse (P2) und stehen nur in ihren Zeilen.
    for (const leak of ['opfer3@example.org', '9,00', 'token=', 'Bestellt am', 'bezahlt am']) assert.ok(!n.html.includes(leak), leak);
    assert.match(n.text, new RegExp(`Angegebene Bestellnummer: ${order.order_no}`));
    assert.match(n.text, /Name: Angreifer/);
    assert.equal(mailsTo('opfer3@example.org').filter(x => /Bitte bestätigen: Ihr/.test(x.subject)).length, 0);
    assert.equal((await orderRow(order.id)).status, 'paid');
    // Name mit Adresse oder Markup wird gar nicht erst angenommen (Phishing über den Wortlaut).
    for (const name of ['Bitte hier klicken https://phish.example', 'www.phish.example', '<b>x</b>']) {
      const r = await post(srv.base, '/api/billing/withdraw-public', { name, email: 'opfer3@example.org', altcha: await solveAltcha(srv.base) });
      assert.equal(r.status, 400, name);
    }
  });

  test('probe1 #5: dieselbe ALTCHA-Lösung zweimal → zweites Mal abgewiesen', async () => {
    const sol = await solveAltcha(srv.base);
    assert.equal((await post(srv.base, '/api/billing/withdraw-public', { name: 'Test', email: 'x1@example.org', altcha: sol })).status, 200);
    const b = await post(srv.base, '/api/billing/withdraw-public', { name: 'Test', email: 'x2@example.org', altcha: sol });
    assert.equal(b.status, 400);
    assert.equal((await b.json()).code, 'altcha_invalid');
  });

  // ── M2/N5: E-Mail-Wechsel (probe1 #6, #7) ──────────────────────────────

  test('probe1 #6/#7 / M2: neue Adresse erst nach Bestätigung; ein Postfach ergibt kein zweites bestätigtes Konto', async () => {
    const s = await registerSelf('echt@example.org');
    const ch = await s.C.post('/api/auth/email', { email: 'nie-bestaetigt@fremd.example', currentPassword: 'kunden-passwort-1' });
    assert.equal(ch.status, 200);
    assert.deepEqual({ ok: ch.data.ok, pending: ch.data.pending, pendingEmail: ch.data.pendingEmail }, { ok: true, pending: true, pendingEmail: 'nie-bestaetigt@fremd.example' });
    const me = (await s.C.get('/api/me')).data;
    assert.equal(me.user.email, 'echt@example.org', 'bis zur Bestätigung gilt die alte');
    assert.equal(me.pendingEmail, 'nie-bestaetigt@fremd.example');
    assert.equal(me.user.pendingEmail, 'nie-bestaetigt@fremd.example');
    assert.equal(me.emailConfirmed, true);
    assert.ok(await waitFor(() => mailsTo('nie-bestaetigt@fremd.example').find(m => /neue E-Mail-Adresse/.test(m.subject))), 'Link an die neue');
    assert.ok(await waitFor(() => mailsTo('echt@example.org').find(m => /Neue E-Mail-Adresse für dein Konto angefordert/.test(m.subject))), 'Hinweis an die alte');
    // Dieselbe Adresse erneut registrieren: geht nicht (sie gehört weiter zum ersten Konto) — Hinweis an den Inhaber.
    const r = await client(srv.base).post('/api/auth/register', { email: 'echt@example.org', password: 'kunden-passwort-1', altcha: await solveAltcha(srv.base), ageConfirmed16: true, art9Consent: ART9 });
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'email_taken');
    assert.ok(await waitFor(() => mailsTo('echt@example.org').find(m => /schon ein Konto/.test(m.subject))), 'Hinweis an das Bestandskonto');
    // Bestätigen: jetzt erst gilt die neue Adresse, bestätigt.
    const link = await waitFor(() => mailsTo('nie-bestaetigt@fremd.example').find(m => /neue E-Mail-Adresse/.test(m.subject)));
    const token = /token=([A-Za-z0-9_-]+)/.exec(link.html)[1];
    const c = await client(srv.base).post('/api/auth/confirm-email', { token });
    assert.equal(c.status, 200, JSON.stringify(c.data));
    assert.equal(c.data.kind, 'change');
    const me2 = (await s.C.get('/api/me')).data;
    assert.equal(me2.user.email, 'nie-bestaetigt@fremd.example');
    assert.equal(me2.pendingEmail, null);
    assert.equal(me2.emailConfirmed, true);
    assert.equal((await client(srv.base).post('/api/auth/confirm-email', { token })).status, 400, 'nur einmal');
    // Jetzt ist echt@ frei — ein neues Konto damit muss sich wieder selbst bestätigen.
    const again = await registerSelf('echt@example.org', { confirm: false });
    assert.equal((await again.C.get('/api/me')).data.emailConfirmed, false);
  });

  test('N5: Wechsel auf eine vergebene Adresse sieht von außen aus wie jeder andere; ihr Inhaber bekommt einen Hinweis, keinen Link', async () => {
    const a = await registerSelf('besitzer@example.org');
    const b = await registerSelf('wechsler@example.org');
    const free = await b.C.post('/api/auth/email', { email: 'frei@example.org', currentPassword: 'kunden-passwort-1' });
    const taken = await b.C.post('/api/auth/email', { email: 'besitzer@example.org', currentPassword: 'kunden-passwort-1' });
    assert.equal(free.status, 200);
    assert.equal(taken.status, 200);
    const shape = d => ({ keys: Object.keys(d).sort(), ok: d.ok, pending: d.pending, userKeys: Object.keys(d.user).sort() });
    assert.deepEqual(shape(taken.data), shape(free.data));
    const hint = await waitFor(() => mailsTo('besitzer@example.org').find(m => /Hinweis zu deinem Konto/.test(m.subject)));
    assert.ok(hint);
    assert.doesNotMatch(hint.html, /token=/);
    assert.equal(mailsTo('besitzer@example.org').filter(m => /neue E-Mail-Adresse/.test(m.subject)).length, 0);
    assert.equal((await userRow(a.id)).email, 'besitzer@example.org');
    assert.equal((await userRow(b.id)).email, 'wechsler@example.org');
  });

  // ── N1, N2, N3, N4, N6 ─────────────────────────────────────────────────

  test('probe1 #9 / N1: Kauf ohne bestätigte Adresse → 403 email_unconfirmed', async () => {
    const u = await registerSelf('unbestaetigt@example.org', { confirm: false });
    const r = await u.C.post('/api/billing/checkout', { sku: 'pass90', country: 'DE', billingName: 'X Y', acceptTerms: true, ageConfirmed18: true });
    assert.equal(r.status, 403);
    assert.equal(r.data.code, 'email_unconfirmed');
    assert.equal((await db.query('SELECT count(*)::int n FROM orders WHERE user_id = $1', [u.id])).rows[0].n, 0);
  });

  test('probe1 #10 / N2: Sharelink-Foto mit //Host bzw. /\\Host bleibt beim eigenen Pfad', async () => {
    const inv = (await Adm.post('/api/admin/invites', {})).data.code;
    const B = client(srv.base);
    await B.post('/api/auth/register', { username: 'bestand', password: 'bestand-passwort-1', email: 'bestand@example.org', inviteCode: inv, art9Consent: ART9 });
    const hex = 'a'.repeat(24);
    for (const [id, photo] of [['sp1', `//tracker.example/api/photos/${hex}`], ['sp2', `/\\tracker.example/api/photos/${hex}`]]) {
      await B.post('/api/resumes', { id, displayName: 'x', payload: { id, data: { de: { personal: { name: 'Max', photo } } }, settings: { lang: 'de' } } });
      const sh = await B.post(`/api/resumes/${id}/share`, {});
      const view = await client(srv.base).get(`/api/share/${sh.data.token}`);
      const p = view.data?.resume?.data?.de?.personal?.photo;
      assert.match(p, /^\/pdfapi\/api\/share\/[0-9a-f]+\/photo$/, p);
    }
  });

  test('N3: Kontolöschung bei offener Zahlung — Bestellung bleibt, späte Zahlung geht an den Betreiber', async () => {
    const { C, id } = await registerSelf('loeschen-offen@example.org');
    const co = await C.post('/api/billing/checkout', { sku: 'pass90', country: 'DE', billingName: 'Lisa Löschen', acceptTerms: true, ageConfirmed18: true });
    assert.equal(co.status, 200);
    assert.equal((await C.post('/api/me/delete', { password: 'kunden-passwort-1' })).status, 200);
    assert.equal(await userRow(id), undefined);
    const o = await orderRow(co.data.orderId);
    assert.ok(o, 'Bestellung mit offener Zahlung bleibt');
    assert.equal(o.user_id, null);
    mollie.setStatus(o.mollie_payment_id, 'paid');
    assert.equal((await webhook(o.mollie_payment_id)).status, 200);
    assert.equal((await orderRow(o.id)).status, 'paid', 'die Zahlung ist nicht verloren');
    assert.ok(await waitFor(() => mailsTo('verkauf@example.org').find(m => /gelöschtes Konto/.test(m.subject))), 'Betreiber erstattet von Hand');
  });

  test('N4: höchstens 50 Fotos je Konto', async () => {
    const uid = (await Adm.get('/api/me')).data.user.id;
    await db.query(`INSERT INTO photos (id, user_id, mime, data, size_bytes)
                    SELECT lpad(to_hex(g), 24, 'f'), $1, 'image/png', '\\x00'::bytea, 1 FROM generate_series(1, 50) g`, [uid]);
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(200, 1)]).toString('base64');
    const r = await Adm.post('/api/photos', { mime: 'image/png', dataBase64: png });
    assert.equal(r.status, 413);
    assert.equal(r.data.code, 'photo_quota');
    await db.query(`DELETE FROM photos WHERE user_id = $1 AND size_bytes = 1`, [uid]);
    assert.equal((await Adm.post('/api/photos', { mime: 'image/png', dataBase64: png })).status, 200, 'darunter geht es');
  });

  test('N6: Reset-Token liegt nur als Hash in der Datenbank und funktioniert', async () => {
    const { C } = await registerSelf('reset@example.org');
    await client(srv.base).post('/api/auth/forgot-password', { identifier: 'reset@example.org' });
    const m = await waitFor(() => mailsTo('reset@example.org').find(x => /Passwort zurücksetzen/.test(x.subject)));
    const token = /\/reset\/([0-9a-f]+)/.exec(m.html)[1];
    const { rows } = await db.query('SELECT token FROM password_resets WHERE user_id = (SELECT id FROM users WHERE email = $1)', ['reset@example.org']);
    assert.deepEqual(rows.map(r => r.token), [sha256(token)]);
    assert.equal((await client(srv.base).post('/api/auth/reset-password', { token: sha256(token), newPassword: 'neues-passwort-1' })).status, 400);
    assert.equal((await client(srv.base).post('/api/auth/reset-password', { token, newPassword: 'neues-passwort-1' })).status, 200);
    assert.equal((await C.get('/api/me')).status, 401, 'alte Sitzung getrennt');
  });

  // ── H1: Markdown-Import blockiert den Dienst nicht (probe4) ────────────

  test('probe4 / H1: Sprachenzeile mit 3.000 Leerzeichen hält /health nicht an; über 200 KB → 413', async () => {
    await Adm.post('/api/resumes', { id: 'r1', displayName: 'x', payload: { id: 'r1', data: { de: { personal: { name: 'A' } } }, settings: { lang: 'de' } } });
    const md = `# Max\n\n## Sprachen\n\n- ${' '.repeat(3000)}a\n`;
    const t0 = Date.now();
    const imp = Adm.post('/api/resumes/r1/import-md', { markdown: md, dryRun: true });
    await sleep(20);
    const h0 = Date.now();
    assert.equal((await fetch(`${srv.base}/health`)).status, 200);
    assert.ok(Date.now() - h0 < 1000, `/health ${Date.now() - h0} ms`);
    const r = await imp;
    assert.equal(r.status, 200);
    assert.ok(Date.now() - t0 < 2000, `Import ${Date.now() - t0} ms`);
    const big = await Adm.post('/api/resumes/r1/import-md', { markdown: '# A\n' + 'x'.repeat(MAX_MARKDOWN_CHARS), dryRun: true });
    assert.equal(big.status, 413);
    assert.equal(big.data.code, 'markdown_too_large');
    const bigCl = await Adm.post('/api/resumes/r1/import-cover-letter-md', { markdown: '# A\n' + 'x'.repeat(MAX_MARKDOWN_CHARS), dryRun: true });
    assert.equal(bigCl.status, 413);
  });

  // ── M3: Rate-Limits hinter dem Proxy (probe3) ──────────────────────────

  test('probe3 / M3: IPv6 je /64, Login je Netz und je Konto, Reset-Mails je Adresse', async () => {
    const P = proxy.base;
    const login = (username, password, ip) => post(P, '/api/auth/login', { username, password }, { 'X-Forwarded-For': ip });
    // Eine Adresse: 5 Versuche, dann 429.
    const one = [];
    for (let i = 0; i < 8; i++) one.push((await login('admin1', `falsch-${i}`, '2001:db8:1:2::1')).status);
    assert.deepEqual(one, [401, 401, 401, 401, 401, 429, 429, 429]);
    // 40 Adressen aus demselben /64: alle im selben Eimer.
    const many = [];
    for (let i = 0; i < 40; i++) many.push((await login('admin1', `falsch-${i}`, `2001:db8:1:2::${(i + 16).toString(16)}`)).status);
    assert.equal(many.filter(s => s === 401).length, 0, JSON.stringify(many));
    // Je Netz (IPv4 /24): 20 in 15 Minuten, egal wie viele Adressen.
    const net = [];
    for (let i = 1; i <= 25; i++) net.push((await login(`niemand-${i}`, 'x', `198.51.100.${i}`)).status);
    assert.equal(net.filter(s => s === 429).length, 5, JSON.stringify(net));
    // Je Konto: nach 10 Fehlversuchen aus verschiedenen Netzen gesperrt — auch mit richtigem Passwort.
    for (let i = 0; i < 5; i++) assert.equal((await login('admin1', 'falsch', `2001:db8:${100 + i}::1`)).status, 401);
    const locked = await login('admin1', 'admin-passwort-1', '2001:db8:200::1');
    assert.equal(locked.status, 429);
    assert.equal((await locked.json()).code, 'account_locked');
    // Andere Konten sind nicht betroffen.
    const reg = await registerSelf('anderes@example.org');
    assert.equal((await login(reg.email, 'kunden-passwort-1', '2001:db8:201::1')).status, 200);
    // Passwort vergessen aus 20 verschiedenen Netzen an dieselbe Adresse: höchstens 3 Mails.
    for (let i = 0; i < 20; i++) await post(P, '/api/auth/forgot-password', { identifier: 'admin@example.org' }, { 'X-Forwarded-For': `2001:db8:${300 + i}::1` });
    await sleep(1500);
    const resets = readMails(proxyMailFile).filter(m => m.to === 'admin@example.org' && /Passwort zurücksetzen/.test(m.subject));
    assert.ok(resets.length <= 3, `${resets.length} Reset-Mails`);
    assert.ok(resets.length >= 1);
  });

  test('M5: PDF ohne Konto — höchstens ein Auftrag je Netz; ein anderes Netz wartet nicht darauf', { skip: chromiumPath ? false : 'kein Chromium' }, async () => {
    const P = proxy.base;
    const html = '<!doctype html><body>' + '<p style="break-after:page">x</p>'.repeat(400) + '</body>';
    const pdf = ip => post(P, '/api/pdf', { html, filename: 'x.pdf' }, { 'X-Forwarded-For': ip });
    const first = pdf('2001:db8:500:1::1');
    await sleep(150);
    const [same, other] = await Promise.all([pdf('2001:db8:500:1::2'), pdf('2001:db8:501:1::1')]);
    assert.equal(same.status, 429);
    assert.equal((await same.json()).code, 'pdf_busy_anon');
    assert.ok(same.headers.get('retry-after'));
    assert.notEqual(other.status, 429, 'anderes Netz');
    assert.equal((await first).status, 200);
    // Danach ist der Platz wieder frei.
    assert.equal((await pdf('2001:db8:500:1::3')).status, 200);
  });
});
