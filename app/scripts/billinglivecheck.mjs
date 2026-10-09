// Der Weg zum Bewerbungs-Pass gegen den ECHTEN cv-api (pdf-service) —
// Gegenstück zu billingcheck.mjs, das mit einer Nachbildung im Browser läuft.
//
// Prüft, dass Oberfläche und Server denselben Vertrag sprechen:
// Registrierung mit echtem ALTCHA (Server prüft), Bestellung, „Mollie"
// (Nachbildung auf MOLLIE_MOCK, siehe unten), Danke-Seite mit Abgleich beim
// Server, Rechnung als PDF, Widerruf im Konto mit Erstattung, öffentlicher
// Widerruf, Kündigung nach § 312k, Band nach Ende des Passes.
//
// Voraussetzungen:
//   - cv-api mit BILLING_ENABLED=1, OPEN_REGISTRATION=1, ALTCHA_HMAC_KEY,
//     SELLER_* (inkl. SELLER_PHONE), PUBLIC_BASE_URL = HARNESS_BASE,
//     MOLLIE_API_BASE auf die Nachbildung (http://127.0.0.1:…/v2),
//     MOLLIE_API_KEY passend zur Nachbildung
//   - Vite mit Proxy /pdfapi → cv-api (HARNESS_BASE)
//   - Mollie-Nachbildung mit Steuer-Endpunkten GET /__payments,
//     POST /__status { id, status } (MOLLIE_MOCK, ohne /v2)
//
//   HARNESS_BASE=http://localhost:5213 MOLLIE_MOCK=http://127.0.0.1:3192 node scripts/billinglivecheck.mjs
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5213';
const MOCK = process.env.MOLLIE_MOCK || 'http://127.0.0.1:3192';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';

const results = [];
const check = (ok, label, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
const step = t => console.log(`\n— ${t}`);
const errors = [];
const browser = await chromium.launch({ executablePath: EXEC });
const EMAIL = `live-${Date.now().toString(36)}@example.org`;
const PASSWORD = 'live-pruefung-123';

async function newCtx() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', acceptDownloads: true });
  await ctx.addInitScript(() => { window.__ev = []; window.umami = { track: (e, d) => window.__ev.push([e, d || {}]) }; });
  await ctx.route('**/analytics.example.com/**', r => r.abort());
  // Optionales Umami über /u/ auf derselben Domain (nginx.conf).
  await ctx.route(/\/u\/(script\.js|api\/send)(\?|$)/, r => r.abort());
  /* „Mollie": die Bezahlseite setzt die Zahlung auf bezahlt (oder was
     MOLLIE_OUTCOME sagt) und leitet auf die redirectUrl zurück — wie Mollie. */
  await ctx.route('https://www.mollie.com/**', async route => {
    const pays = await (await fetch(`${MOCK}/__payments`)).json();
    const p = pays.find(x => route.request().url().includes(x.id));
    if (!p) return route.fulfill({ status: 404, body: 'unbekannte Zahlung' });
    await fetch(`${MOCK}/__status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, status: ctx.__outcome || 'paid' }) });
    return route.fulfill({ status: 302, headers: { location: p.redirectUrl } });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  return { ctx, page };
}
async function solveAltcha(page) {
  await page.locator('altcha-widget input[type="checkbox"]').first().click({ force: true });
  await page.waitForFunction(() => !!document.querySelector('altcha-widget input[name="altcha"]')?.value, null, { timeout: 60000 });
}
const text = page => page.evaluate(() => document.body.innerText);

async function buy(page, ctx, outcome = 'paid') {
  ctx.__outcome = outcome;
  await page.goto(`${BASE}/kauf`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-order-button]');
  await page.fill('#bl-name', 'Live Prüfung');
  await page.check('input[name="acceptTerms"]');
  await page.check('input[name="ageConfirmed18"]');
  await page.click('[data-order-button]');
  await page.waitForURL(/\/kauf\/danke\?order=/, { timeout: 20000 });
  const id = new URL(page.url()).searchParams.get('order');
  await page.waitForSelector(`[data-order-status="${outcome}"]`, { timeout: 30000 });
  return id;
}

// ── Registrierung und Kauf ─────────────────────────────────────────────────
step('Registrierung (echtes ALTCHA)');
let { ctx, page } = await newCtx();
await page.goto(`${BASE}/kauf`, { waitUntil: 'networkidle' });
await page.waitForSelector('#bl-email');
await page.fill('#bl-email', EMAIL);
await page.fill('#bl-pw', PASSWORD);
await page.check('text=Ich bin mindestens 16 Jahre alt.');
const t0 = Date.now();
await solveAltcha(page);
check(true, 'ALTCHA im Browser gelöst', `${Date.now() - t0} ms`);
await page.click('button[type="submit"]:has-text("Konto anlegen")');
await page.waitForSelector('[data-order-button]', { timeout: 15000 });
check(true, 'Server nimmt Registrierung an, weiter zur Bestellübersicht');
check(await page.locator('[data-band="confirm-email"]').count() === 1, 'Band „E-Mail bestätigen" (emailConfirmed false vom Server)');
const me = await page.evaluate(async () => (await (await fetch('/pdfapi/api/auth/me', { credentials: 'include' })).json()));
check(me.user?.plan?.kind === 'none', 'neues Konto startet ohne Pass', JSON.stringify(me.user?.plan));

step('Kauf über „Mollie"');
await buy(page, ctx, 'canceled');
check(/abgebrochen/.test(await text(page)), 'abgebrochene Zahlung: Danke-Seite sagt es');
const id1 = await buy(page, ctx, 'paid');
const t1 = await text(page);
check(/Dein Pass ist aktiv/.test(t1) && /läuft bis/.test(t1), 'bezahlt: Pass aktiv mit Datum', t1.match(/läuft bis [^.]+/)?.[0] ?? '');
if (SHOTS) await page.screenshot({ path: `${SHOTS}/live-danke.png`, fullPage: true });

step('Mein Pass, Rechnung, Widerruf im Konto');
await page.goto(`${BASE}/?pass=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-my-pass]', { timeout: 15000 });
await page.waitForTimeout(800);
let mp = await page.locator('[data-my-pass]').innerText();
check(/aktiv bis/.test(mp), 'Mein Pass: aktiv bis …', mp.split('\n')[1] ?? '');
const inv = page.locator('[data-my-pass] a', { hasText: 'Rechnung' }).first();
const href = await inv.getAttribute('href');
const pdf = await page.evaluate(async h => { const r = await fetch(h, { credentials: 'include' }); const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, type: r.headers.get('content-type'), head: String.fromCharCode(...b.slice(0, 5)) }; }, href);
check(pdf.status === 200 && /pdf/.test(pdf.type || '') && pdf.head === '%PDF-', 'Rechnung als PDF vom Server', JSON.stringify(pdf));
await page.locator('[data-my-pass] button', { hasText: 'Vertrag widerrufen' }).first().click();
await page.locator('[data-my-pass] button', { hasText: 'Widerruf bestätigen' }).first().click();
await page.waitForSelector('[data-withdraw-receipt]', { timeout: 15000 });
check(/\d{1,2}:\d{2} Uhr/.test(await page.locator('[data-withdraw-receipt]').innerText()), 'Eingangsbestätigung mit Uhrzeit (Server-Zeit)');
const ords = await page.evaluate(async () => (await (await fetch('/pdfapi/api/billing/orders', { credentials: 'include' })).json()));
const o1 = ords.orders.find(o => o.id === id1);
check(o1 && /withdrawn|refunded/.test(o1.status) && o1.refund, 'Bestellung widerrufen, Erstattung angestoßen', JSON.stringify({ status: o1?.status, refund: o1?.refund }));
await page.keyboard.press('Escape');

step('Öffentlicher Widerruf');
const id2 = await buy(page, ctx, 'paid');
const no2 = (await page.locator('.bl-eyebrow').first().innerText()).replace(/^Bestellung\s+/, '');
const pub = await newCtx();
await pub.page.goto(`${BASE}/widerruf`, { waitUntil: 'networkidle' });
await pub.page.fill('#wd-name', 'Live Prüfung');
await pub.page.fill('#wd-email', EMAIL);
await pub.page.fill('#wd-no', no2);
await solveAltcha(pub.page);
await pub.page.click('[data-withdraw-start]');
await pub.page.click('[data-withdraw-confirm]');
await pub.page.waitForSelector('[data-withdraw-step="3"]', { timeout: 15000 });
check(/Uhr/.test(await pub.page.locator('[data-withdraw-receipt]').innerText()), 'öffentlicher Widerruf: Eingangsbestätigung');
await pub.ctx.close();
await page.waitForTimeout(1500);
const o2 = (await page.evaluate(async () => (await (await fetch('/pdfapi/api/billing/orders', { credentials: 'include' })).json()))).orders.find(o => o.id === id2);
check(o2 && /withdrawn|refunded/.test(o2.status), 'Server ordnet den öffentlichen Widerruf zu', o2?.status);

step('Kündigung (§ 312k)');
await buy(page, ctx, 'paid');
await page.goto(`${BASE}/kuendigen`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-cancel-form]');
check(/widerrufen/.test(await text(page)), 'Hinweis auf den günstigeren Widerruf innerhalb der Frist');
await page.click('[data-cancel-confirm]');
await page.waitForSelector('[data-cancel-done]', { timeout: 15000 });
check(/Ordentliche Kündigung/.test(await page.locator('[data-cancel-receipt]').innerText()), 'Kündigung angenommen, Bestätigung mit Art und Zeit');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const band = await page.locator('.ui-access-banner').getAttribute('data-notice').catch(() => null);
check(band === 'none-expired' || band === 'none-none', 'nach Kündigung: Band ohne aktiven Pass', String(band));

check(errors.length === 0, 'keine Seitenfehler', errors.slice(0, 3).join(' | '));
await browser.close();
const bad = results.filter(x => !x).length;
console.log(`\n${results.length - bad}/${results.length} bestanden`);
process.exit(bad ? 1 : 0);
