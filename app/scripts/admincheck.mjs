// Admin-Bereich im Browser (Runde 8b, 10.10.2026).
//
// Startet eine eigene Postgres-Instanz, cv-api mit ADMIN_HOST und den
// Vite-Entwicklungsserver (CV_DEV_API leitet /pdfapi weiter, damit Seite und
// API wie in der Produktion denselben Ursprung haben). Dann mit Playwright:
//
//   1. Anmeldung in zwei Schritten: Passwort, dann der Code aus dem Mail-Log
//      (MAIL_CAPTURE_FILE). Vorher kein Zugang zu den Zahlen.
//   2. Alle Bereiche laden, je Bereich axe (WCAG 2.2 AA): 0 Verstöße.
//   3. Hell und dunkel; mobil 390 px ohne waagerechtes Scrollen der Seite.
//   4. Gebautes Bündel (dist/admin.html) unter der CSP aus nginx.conf: keine
//      CSP-Verletzung (kein Inline-Skript, kein Inline-Stil im HTML).
//   5. E-Mails (E-Mail-Workflows, 10.10.2026): Bereich mit SMTP, Workflows,
//      Warteschlange und Protokoll; Vorschau und Texteditor offen ohne
//      axe-Befund; ein gespeichertes SMTP-Passwort steht nirgends auf der
//      Seite; Schalter und wartende Mails; dunkel und mobil 390.
//   6. Verkauf (20.10.2026): Mollie-Testschlüssel einfügen (geprüft gegen
//      einen Mollie-Ersatz auf MOLLIE_MOCK_PORT), danach steht er nirgends
//      auf der Seite und in keiner API-Antwort; falscher Schlüssel wird
//      abgelehnt; Testkonten; Modus Test; Live nur mit Häkchen; Angebot
//      öffentlich weiter aus.
//
// Bildschirmfotos nach ADMINCHECK_SHOTS (Standard: <tmp>/admincheck-shots).
//
//   node scripts/admincheck.mjs
//
// Ports: ADMINCHECK_VITE_PORT (5265), ADMINCHECK_PG_PORT (5665),
// ADMINCHECK_API_PORT (3365).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer, request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { startPostgres, startServer } from '../../pdf-service/testkit.mjs';

const APP = resolve(process.cwd());
const VITE_PORT = Number(process.env.ADMINCHECK_VITE_PORT || 5265);
const PG_PORT = Number(process.env.ADMINCHECK_PG_PORT || 5665);
const API_PORT = Number(process.env.ADMINCHECK_API_PORT || 3365);
const SHOTS = resolve(process.env.ADMINCHECK_SHOTS || join(tmpdir(), 'admincheck-shots'));
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const AXE = readFileSync(join(APP, 'node_modules/axe-core/axe.min.js'), 'utf8');
const ORIGIN = `http://localhost:${VITE_PORT}`;
const PW = 'admincheck-passwort-1';
const req = createRequire(new URL('../../pdf-service/package.json', import.meta.url));
const pg = req('pg');
const bcrypt = req('bcryptjs');

let fail = 0;
const ok = (c, label, extra = '') => { console.log(`${c ? 'ok  ' : 'FEHL'} ${label}${!c && extra ? ` — ${extra}` : ''}`); if (!c) fail++; };
mkdirSync(SHOTS, { recursive: true });

const PAGES = [
  ['ueberblick', 'Überblick'], ['verlauf', 'Verlauf'], ['nutzung', 'Nutzung'], ['kunden', 'Kunden'], ['zahlungen', 'Zahlungen'],
  ['rechnungen', 'Rechnungen'], ['erklaerungen', 'Widerrufe und Kündigungen'], ['gutscheine', 'Gutscheine und Kampagnen'],
  ['zugang', 'Einladungen und Anfragen'], ['emails', 'E-Mails'], ['verkauf', 'Verkauf'], ['system', 'System'],
];
const MOLLIE_PORT = Number(process.env.ADMINCHECK_MOLLIE_PORT || 3366);
const MOLLIE_TEST_KEY = 'test_admincheckKey000000000000000000';
/* Mollie-Ersatz: kennt nur MOLLIE_TEST_KEY, liefert zwei Zahlungsarten. */
const mollieMock = createServer((rq, rs) => {
  const okKey = rq.headers.authorization === `Bearer ${MOLLIE_TEST_KEY}`;
  rs.writeHead(okKey ? 200 : 401, { 'Content-Type': 'application/hal+json' });
  rs.end(JSON.stringify(okKey ? { _embedded: { methods: [{ id: 'creditcard', description: 'Kreditkarte' }, { id: 'paypal', description: 'PayPal' }] } } : { status: 401, title: 'Unauthorized Request' }));
});
await new Promise(r => mollieMock.listen(MOLLIE_PORT, '127.0.0.1', r));
const SMTP_SECRET = 'admincheck-smtp-geheim-7';

/* ── Dienste ────────────────────────────────────────────────────────── */
const pgInst = await startPostgres(PG_PORT);
if (!pgInst) { console.log('Postgres fehlt — Prüfung übersprungen'); process.exit(0); }
const mailDir = mkdtempSync(join(tmpdir(), 'admincheck-mail-'));
const mailFile = join(mailDir, 'mails.jsonl');
const api = await startServer({
  DATABASE_URL: pgInst.url, JWT_SECRET: 'admincheck', NODE_ENV: 'test', TRUST_PROXY: '',
  PUBLIC_BASE_URL: ORIGIN, ADMIN_HOST: `localhost:${VITE_PORT}`, ADMIN_URL: ORIGIN, ADMIN_EMAIL: 'ops@example.test',
  ADMIN_USERNAME: 'leitung', ADMIN_PASSWORD: PW, MAIL_CAPTURE_FILE: mailFile, JANITOR: '1', ACCESS_NOTICES: '0', BILLING_JOBS: '0',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', TEST_RATE_LIMIT_FACTOR: '20',
  UMAMI_DASHBOARD_URL: 'https://analytics.example.test/share/cv',
  PASS_PRICE_CENTS: '900', INVOICE_PREFIX: 'CV', MOLLIE_API_BASE: `http://127.0.0.1:${MOLLIE_PORT}/v2`,
}, { port: API_PORT });

/* Beispieldaten: erfunden, nur für diese Prüfung, liegen in einer
 * Wegwerf-Datenbank. */
const db = new pg.Pool({ connectionString: pgInst.url, max: 2 });
const hash = await bcrypt.hash('kunde-passwort-1', 4);
const NAMES = ['lena.brandt', 'jonas.k', 'mira', 'paul_h', 'aylin', 'tom', 'sofia.m', 'ben', 'clara', 'deniz', 'emil', 'frieda.l', 'greta', 'hanna', 'ida', 'jan', 'karl', 'lea.s', 'max', 'nora', 'ole', 'pia', 'rosa', 'sami'];
const ids = [];
for (let i = 0; i < NAMES.length; i++) {
  const ago = Math.floor((i * 37) % 85) + 1;
  const { rows } = await db.query(
    `INSERT INTO users (username, password_hash, email, signup_source, email_confirmed_at, created_at, last_seen_at, password_changed_at)
     VALUES ($1, $2, $3, 'self', CASE WHEN $4 % 5 = 0 THEN NULL ELSE now() END, now() - make_interval(days => $4), now() - make_interval(days => $4 / 3), now() - make_interval(days => $4))
     RETURNING id`, [NAMES[i], hash, `${NAMES[i].replace(/[._]/g, '')}@example.test`, ago]);
  ids.push(rows[0].id);
  await db.query(`INSERT INTO resumes (id, user_id, display_name, payload) VALUES ($1, $2, 'Lebenslauf', $3)`,
    [`p${i}`, rows[0].id, JSON.stringify({ id: `p${i}`, displayName: 'Lebenslauf', settings: { template: ['hamburg', 'oslo', 'kopenhagen', 'berlin', 'zuerich'][i % 5], lang: ['de', 'de', 'en', 'de', 'fr'][i % 5], pageMode: i % 3 ? 'one' : 'two' } })]);
}
await db.query(`INSERT INTO invoice_counters (year, last) VALUES (2026, 9)`);
for (let i = 0; i < 9; i++) {
  const ago = i * 9 + 2;
  const st = i === 4 ? 'refunded' : 'paid';
  await db.query(
    `INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, status, paid_at, pass_days, pass_from, pass_until, invoice_no, mollie_payment_id, withdrawn_at, refund_status)
     VALUES (gen_random_uuid(), $1, $2, 'kunde@example.test', 'Beispiel', $3, 'pass90', 900, $4, now() - make_interval(days => $5), 90, now() - make_interval(days => $5), now() - make_interval(days => $5) + interval '90 days', $6, $7,
             CASE WHEN $4 = 'refunded' THEN now() - make_interval(days => $5 - 1) END, CASE WHEN $4 = 'refunded' THEN 'refunded' END)`,
    [`B-${1001 + i}`, ids[i], i % 4 === 3 ? 'AT' : 'DE', st, ago, `CV-2026-${String(i + 1).padStart(4, '0')}`, `tr_${'x'.repeat(8)}${i}`]);
}
await db.query(`INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, status, pass_days) VALUES (gen_random_uuid(), 'B-2001', $1, 'k@example.test', 'Beispiel', 'DE', 'pass90', 900, 'open', 90)`, [ids[10]]);
for (let d = 0; d < 90; d++) {
  const n = (d * 7) % 5;
  for (let k = 0; k < n; k++) await db.query(`INSERT INTO events (user_id, kind, created_at) VALUES ($1, $2, now() - make_interval(days => $3))`, [ids[(d + k) % ids.length], k % 2 ? 'pdf' : 'docx', d]);
}
const today = new Date();
for (let d = 0; d < 30; d++) {
  const day = new Date(today.getTime() - d * 864e5).toISOString().slice(0, 10);
  const rows = [['pdf_server', 'all', '', 6 + (d % 4)], ['pdf_server', 'lang', 'de', 4 + (d % 3)], ['pdf_server', 'lang', 'en', 2], ['pdf_server', 'format', 'a4', 6],
    ['docx', 'all', '', 3], ['docx', 'template', 'hamburg', 2], ['docx', 'template', 'oslo', 1], ['api_call', 'all', '', 5], ['api_call', 'route', 'GET /api/resumes', 3], ['api_call', 'route', 'POST /api/resumes/:id/import-md', 2], ['api_call', 'via', 'oauth', 5]];
  for (const [m, dim, v, n] of rows) await db.query(`INSERT INTO usage_daily (day, metric, dim, value, n) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`, [day, m, dim, v, n]);
}
await db.query(`INSERT INTO declarations (id, type, channel, name, email, order_no, received_at, statement, status) VALUES (gen_random_uuid(), 'withdrawal', 'form', 'Beispiel Person', 'person@example.test', 'B-9999', now() - interval '2 days', 'Hiermit widerrufe ich den Vertrag über den Bewerbungs-Pass.', 'manual')`);
await db.query(`INSERT INTO access_requests (name, email, message) VALUES ('Beispiel Anfrage', 'anfrage@example.test', 'Ich würde das Werkzeug gern im Coaching nutzen.')`);
// E-Mails: eine Einwilligung, wartende und fehlgeschlagene Mails, Protokoll.
await db.query(`INSERT INTO mail_prefs (user_id, tips_consent_at, tips_consent_version, tips_consent_source) VALUES ($1, now() - interval '1 day', '2026-10-10', 'register')`, [ids[0]]);
await db.query(`INSERT INTO mail_queue (workflow, dedupe_key, user_id, status, last_error, created_at) VALUES ('welcome', $1, $2, 'waiting_smtp', 'SMTP nicht eingerichtet', now() - interval '2 hours')`, [`welcome:${ids[1]}:v1`, ids[1]]);
await db.query(`INSERT INTO mail_queue (workflow, dedupe_key, user_id, status, attempts, last_error) VALUES ('tips_1', $1, $2, 'failed', 5, 'ECONNREFUSED: Verbindung abgelehnt')`, [`tips_1:${ids[0]}:v1`, ids[0]]);
for (const [wf, st, err] of [['welcome', 'sent', null], ['login_code', 'sent', null], ['pass_ending', 'failed', 'ETIMEDOUT'], ['welcome', 'waiting_smtp', null], ['tips', 'unsubscribed', 'one-click']]) {
  await db.query(`INSERT INTO mail_log (workflow, to_masked, status, error) VALUES ($1, 'le••••@example.test', $2, $3)`, [wf, st, err]);
}
await db.end();

const vite = spawn(process.execPath, [join(APP, 'node_modules/vite/bin/vite.js'), '--port', String(VITE_PORT), '--strictPort', '--host', 'localhost'], {
  cwd: APP, env: { ...process.env, CV_DEV_API: `http://127.0.0.1:${API_PORT}` }, stdio: ['ignore', 'pipe', 'pipe'],
});
let viteOut = '';
vite.stdout.on('data', d => { viteOut += d; });
vite.stderr.on('data', d => { viteOut += d; });
for (let i = 0; i < 100; i++) {
  try { const r = await fetch(`${ORIGIN}/admin.html`); if (r.ok) break; } catch { /* noch nicht */ }
  await new Promise(r => setTimeout(r, 200));
}

function lastCode() {
  const lines = existsSync(mailFile) ? readFileSync(mailFile, 'utf8').trim().split('\n').filter(Boolean) : [];
  for (const l of lines.reverse()) {
    const m = JSON.parse(l);
    if (/Admin-Anmeldung/.test(m.subject)) return />(\d{6})</.exec(m.html)?.[1] || null;
  }
  return null;
}

async function axe(page, label) {
  await page.evaluate(AXE);
  const res = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
  const v = res.violations;
  ok(v.length === 0, `axe ${label}: 0 Verstöße`, v.map(x => `${x.id} (${x.nodes.length}): ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`).join('; '));
}

async function waitPage(page, title) {
  await page.waitForFunction(t => [...document.querySelectorAll('h1')].some(h => h.textContent?.trim() === t), title, { timeout: 15_000 });
  // Geladen ist der Bereich, wenn keine Platzhalter mehr stehen und kein „Lädt …“.
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], .adm-skel') && ![...document.querySelectorAll('button')].some(b => /Lädt/.test(b.textContent || '')), null, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(150);
}

const browser = await chromium.launch({ executablePath: EXECUTABLE });
let storage;
let kundeId;
try {
try {
  /* 1. Anmeldung */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'de-DE', colorScheme: 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${ORIGIN}/admin.html`);
  await page.getByLabel('Nutzername oder E-Mail').waitFor();
  ok(await page.getByRole('heading', { name: 'Anmelden' }).isVisible(), 'ohne Sitzung: Anmeldeseite');
  const before = await page.evaluate(() => fetch('/pdfapi/api/admin/overview').then(r => r.status));
  ok(before === 401, 'ohne Sitzung: Zahlen gesperrt (401)', String(before));
  await axe(page, 'Anmeldung');
  await page.screenshot({ path: join(SHOTS, 'admin-login.png') });
  await page.getByLabel('Nutzername oder E-Mail').fill('leitung');
  await page.getByLabel('Passwort').fill(PW);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByLabel('Code').waitFor();
  const afterPw = await page.evaluate(() => fetch('/pdfapi/api/admin/overview').then(r => r.status));
  ok(afterPw === 401, 'nach dem Passwort allein: weiter gesperrt', String(afterPw));
  const code = lastCode();
  ok(/^\d{6}$/.test(code || ''), 'Code aus dem Mail-Log gelesen');
  await page.getByLabel('Code').fill(code);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await waitPage(page, 'Überblick');
  const cookies = await ctx.cookies();
  const c = cookies.find(x => x.name === '__Host-cv_admin');
  ok(c && c.httpOnly && c.secure && c.sameSite === 'Strict' && c.path === '/' && !c.domain.startsWith('.'), 'Cookie __Host-cv_admin: HttpOnly, Secure, Strict, Pfad /, host-only', JSON.stringify(c));

  /* 2. Alle Bereiche */
  for (const [hash, title] of PAGES) {
    await page.goto(`${ORIGIN}/admin.html#/${hash}`);
    await waitPage(page, title);
    await axe(page, title);
    await page.screenshot({ path: join(SHOTS, `admin-${hash}.png`), fullPage: true });
  }
  // Kundendetail und ein Dialog
  await page.goto(`${ORIGIN}/admin.html#/kunden`);
  await waitPage(page, 'Kunden');
  await page.getByRole('link', { name: 'lena.brandt' }).click();
  await waitPage(page, 'lena.brandt');
  kundeId = Number(/kunden\/(\d+)/.exec(page.url())?.[1]);
  await axe(page, 'Kundendetail');
  await page.screenshot({ path: join(SHOTS, 'admin-kunde.png'), fullPage: true });
  await page.getByRole('button', { name: 'Pass gewähren' }).click();
  await page.getByRole('dialog').waitFor();
  await axe(page, 'Dialog Pass gewähren');
  await page.getByLabel('Grund (Pflicht, steht im Protokoll)').fill('Prüflauf');
  await page.getByRole('dialog').getByRole('button', { name: 'Gewähren' }).click();
  await page.getByText('Zugang geändert.').waitFor();
  ok(true, 'Pass gewährt (mit Grund)');
  await page.screenshot({ path: join(SHOTS, 'admin-kunde-gewaehrt.png') });
  await page.goto(`${ORIGIN}/admin.html#/system`);
  await waitPage(page, 'System');
  ok(await page.getByRole('cell', { name: 'Pass gewährt' }).first().isVisible(), 'Protokoll zeigt die Aktion');
  /* 5. E-Mails im Einzelnen */
  await page.goto(`${ORIGIN}/admin.html#/emails`);
  await waitPage(page, 'E-Mails');
  ok(await page.getByRole('heading', { name: 'Versand (SMTP)' }).isVisible(), 'E-Mails: Abschnitt Versand');
  ok(await page.locator('[data-workflow]').count() === 8, 'E-Mails: acht Workflows', String(await page.locator('[data-workflow]').count()));
  ok(await page.locator('[data-queue-id]').count() >= 1, 'E-Mails: Warteschlange zeigt Einträge');
  // SMTP nur speichern (ohne Prüfung, kein Server da): Passwort danach nirgends sichtbar.
  await page.getByLabel('Host').fill('smtp.example.test');
  await page.getByLabel('Port').fill('587');
  await page.getByLabel('Benutzer').fill('cv@example.test');
  await page.getByLabel(/^Passwort/).fill(SMTP_SECRET);
  await page.getByLabel('Absender').fill('CV-Hub <cv@example.test>');
  await page.getByRole('button', { name: 'Nur speichern' }).click();
  await page.getByText('Gespeichert (nicht aktiv).').waitFor();
  await page.reload();
  await waitPage(page, 'E-Mails');
  const html = await page.content();
  const pwVal = await page.getByLabel(/^Passwort/).inputValue();
  ok(!html.includes(SMTP_SECRET) && pwVal === '', 'SMTP-Passwort steht nach dem Speichern nirgends auf der Seite');
  ok(await page.getByText('(gesetzt, leer lassen = behalten)').isVisible(), 'Passwortfeld zeigt nur „gesetzt“');
  const apiBody = await page.evaluate(() => fetch('/pdfapi/api/admin/mail').then(r => r.text()));
  ok(!apiBody.includes(SMTP_SECRET) && !/v1:[kj]:/.test(apiBody), 'API-Antwort ohne Passwort, auch nicht verschlüsselt');
  // Workflow-Schalter und Vorschau mit Texteditor.
  const welcome = page.locator('[data-workflow="welcome"]');
  await welcome.locator('[data-wf-toggle]').click();
  await page.waitForFunction(() => document.querySelector('[data-workflow="welcome"] [data-wf-toggle]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 10_000 });
  ok(true, 'Workflow abschalten');
  await page.locator('[data-workflow="welcome"] [data-wf-toggle]').click();
  await page.waitForFunction(() => document.querySelector('[data-workflow="welcome"] [data-wf-toggle]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 10_000 });
  await page.locator('[data-workflow="welcome"]').getByRole('button', { name: 'Vorschau und Text' }).click();
  await page.locator('[data-wf-editor="welcome"]').getByRole('button', { name: 'Vorschau', exact: true }).click();
  await page.locator('[data-preview-subject]').waitFor();
  ok(/bestätigt/.test(await page.locator('[data-preview-subject]').textContent() || ''), 'Vorschau zeigt den Betreff');
  await page.locator('[data-wf-editor="welcome"] textarea').fill('<b>Hallo</b> {{name}}');
  await page.locator('[data-wf-editor="welcome"]').getByRole('button', { name: 'Entwurf ansehen' }).click();
  await page.waitForFunction(() => /&lt;b&gt;|<b>Hallo<\/b> beispiel/.test(document.querySelector('[data-preview-text]')?.textContent || ''), null, { timeout: 10_000 }).catch(() => {});
  ok(/<b>Hallo<\/b> beispiel/.test(await page.locator('[data-preview-text]').textContent() || ''), 'Entwurf: Platzhalter ersetzt, Text als Text');
  await axe(page, 'E-Mails mit offener Vorschau');
  await page.screenshot({ path: join(SHOTS, 'admin-emails-vorschau.png'), fullPage: true });
  /* 6. Verkauf */
  await page.goto(`${ORIGIN}/admin.html#/verkauf`);
  await waitPage(page, 'Verkauf');
  ok(await page.locator('[data-sale-checks] li').count() >= 6, 'Verkauf: Prüfliste steht');
  await page.getByLabel(/^Testschlüssel/).fill('test_falsch00000000000000000000000');
  await page.getByRole('button', { name: 'Prüfen und speichern' }).click();
  await page.getByText('Mollie kennt diesen Schlüssel nicht.').waitFor({ timeout: 10_000 }).then(() => ok(true, 'Verkauf: falscher Schlüssel abgelehnt'), () => ok(false, 'Verkauf: falscher Schlüssel abgelehnt'));
  await page.getByLabel(/^Testschlüssel/).fill(MOLLIE_TEST_KEY);
  await page.getByRole('button', { name: 'Prüfen und speichern' }).click();
  await page.getByText(/Schlüssel von Mollie bestätigt und gespeichert\. Aktive Zahlungsarten bei Mollie: Kreditkarte, PayPal/).waitFor({ timeout: 10_000 }).then(() => ok(true, 'Verkauf: Testschlüssel geprüft, Zahlungsarten genannt'), () => ok(false, 'Verkauf: Testschlüssel geprüft, Zahlungsarten genannt'));
  await page.reload();
  await waitPage(page, 'Verkauf');
  const saleHtml = await page.content();
  const saleApi = await page.evaluate(() => fetch('/pdfapi/api/admin/sale').then(r => r.text()));
  ok(!saleHtml.includes(MOLLIE_TEST_KEY) && !saleApi.includes(MOLLIE_TEST_KEY) && !/v1:[kj]:/.test(saleApi), 'Verkauf: Schlüssel nach dem Speichern nirgends, auch nicht verschlüsselt');
  ok(/gespeichert: test_/.test(await page.locator('label[for="sale-test"]').textContent() || ''), 'Verkauf: nur Anfang und Ende sichtbar');
  await page.getByLabel(/^E-Mail-Adressen/).fill('lenabrandt@example.test');
  await page.locator('[data-sale-testers]').getByRole('button', { name: 'Speichern' }).click();
  await page.getByText('Testkonten gespeichert.').waitFor({ timeout: 10_000 });
  ok(await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Live' }).isDisabled(), 'Verkauf: Live ohne Häkchen gesperrt');
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Test' }).click();
  await page.getByText('Verkauf: Test.').waitFor({ timeout: 10_000 });
  ok(await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Test' }).getAttribute('aria-pressed') === 'true', 'Verkauf: Modus Test aktiv');
  // Der Admin-Host beantwortet nur /api/admin; das Angebot direkt beim Dienst fragen.
  const pub = await fetch(`http://127.0.0.1:${API_PORT}/api/billing/offer`).then(r => r.json());
  ok(pub.enabled === false, 'Verkauf: Angebot öffentlich weiter aus', JSON.stringify(pub).slice(0, 120));
  await axe(page, 'Verkauf nach dem Speichern');
  await page.screenshot({ path: join(SHOTS, 'admin-verkauf.png'), fullPage: true });
  await page.getByRole('group', { name: 'Modus' }).getByRole('button', { name: 'Aus' }).click();
  await page.getByText('Verkauf: Aus.').waitFor({ timeout: 10_000 });
  ok(errors.length === 0, 'keine Skriptfehler', errors.join(' | '));
  storage = await ctx.storageState();
  await ctx.close();

  /* 3a. Dunkel */
  const dark = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: 'de-DE', colorScheme: 'dark', storageState: storage });
  const dp = await dark.newPage();
  for (const [hash, title] of [['ueberblick', 'Überblick'], ['verlauf', 'Verlauf'], ['zahlungen', 'Zahlungen'], ['gutscheine', 'Gutscheine und Kampagnen'], ['emails', 'E-Mails']]) {
    await dp.goto(`${ORIGIN}/admin.html#/${hash}`);
    await waitPage(dp, title);
    await axe(dp, `${title} (dunkel)`);
    await dp.screenshot({ path: join(SHOTS, `admin-${hash}-dunkel.png`), fullPage: hash !== 'gutscheine' });
  }
  await dark.close();

  /* 3b. Mobil 390 */
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'de-DE', storageState: storage });
  const mp = await mob.newPage();
  for (const [hash, title] of [...PAGES, [`kunden/${kundeId}`, 'lena.brandt']]) {
    await mp.goto(`${ORIGIN}/admin.html#/${hash}`);
    await waitPage(mp, title);
    const m = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
    ok(m.sw <= m.w + 1, `mobil 390: ${title} ohne waagerechtes Scrollen`, `${m.sw} > ${m.w}`);
    if (['ueberblick', 'kunden', 'zahlungen', 'verlauf', 'emails'].includes(hash) || hash.startsWith('kunden/')) {
      await mp.screenshot({ path: join(SHOTS, `admin-mobil-${hash.replace('/', '-')}.png`), fullPage: true });
    }
  }
  await axe(mp, 'Kundendetail mobil');
  await mp.goto(`${ORIGIN}/admin.html#/emails`);
  await waitPage(mp, 'E-Mails');
  await axe(mp, 'E-Mails mobil');
  await mob.close();
} finally {
  vite.kill('SIGTERM');
  await new Promise(r => { vite.once('exit', r); setTimeout(r, 3000); });
}

/* 4. Gebautes Bündel unter der CSP aus nginx.conf */
const dist = join(APP, 'dist');
if (!existsSync(join(dist, 'admin.html'))) {
  ok(false, 'dist/admin.html fehlt — erst npm run build');
} else {
  const nginx = readFileSync(join(APP, 'nginx.conf'), 'utf8');
  const adminBlock = nginx.slice(nginx.lastIndexOf('server {'));
  const csp = /add_header Content-Security-Policy "([^"]+)"/.exec(adminBlock)?.[1];
  ok(!!csp && /default-src 'none'/.test(csp), 'CSP aus dem Admin-Block von nginx.conf gelesen', csp);
  const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.html': 'text/html' };
  const srv = createServer((rq, rs) => {
    const url = (rq.url || '/').split('?')[0];
    if (url.startsWith('/pdfapi/')) {
      const p = httpRequest({ host: '127.0.0.1', port: API_PORT, path: rq.url.replace(/^\/pdfapi/, ''), method: rq.method, headers: rq.headers }, pr => { rs.writeHead(pr.statusCode, pr.headers); pr.pipe(rs); });
      rq.pipe(p);
      return;
    }
    const file = url === '/' ? join(dist, 'admin.html') : join(dist, url);
    if (!file.startsWith(dist) || !existsSync(file)) { rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...(url === '/' ? { 'Content-Security-Policy': csp } : {}) });
    rs.end(readFileSync(file));
  });
  await new Promise((r, j) => { srv.once('error', j); srv.listen(VITE_PORT, 'localhost', r); });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: storage });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', e => window.__csp.push(`${e.violatedDirective}: ${e.blockedURI}`));
  });
  const cons = [];
  page.on('console', m => { if (/Content Security Policy|Refused/.test(m.text())) cons.push(m.text()); });
  for (const [hash, title] of PAGES) {
    await page.goto(`${ORIGIN}/#/${hash}`);
    await waitPage(page, title);
  }
  await page.goto(`${ORIGIN}/#/kunden/${kundeId}`);
  await waitPage(page, 'lena.brandt');
  const v = await page.evaluate(() => window.__csp);
  ok(v.length === 0 && cons.length === 0, 'gebautes Bündel: keine CSP-Verletzung in allen Bereichen', [...v, ...cons].slice(0, 5).join(' | '));
  await ctx.close();
  srv.close();
}

} catch (err) {
  ok(false, 'Prüflauf abgebrochen', err?.stack || String(err));
} finally {
  if (vite.exitCode === null) vite.kill('SIGTERM');
  await browser.close().catch(() => {});
  await api.stop();
  pgInst.stop();
  mollieMock.close();
  try { rmSync(mailDir, { recursive: true, force: true }); } catch { /* egal */ }
}
if (fail && viteOut) console.log(viteOut.slice(-1500));
console.log(fail ? `\n${fail} Befund(e)` : '\nohne Befund');
console.log(`Bildschirmfotos: ${SHOTS}`);
process.exit(fail ? 1 : 0);
