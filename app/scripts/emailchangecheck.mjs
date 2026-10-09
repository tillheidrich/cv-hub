// E-Mail-Wechsel mit Bestätigung und Kauf mit unbestätigter Adresse
// (Sicherheitsbefunde M2 und N1, 09.10.2026) — Oberfläche, Server über
// abgefangene Antworten (Schnittstelle „Sicherheitsfixes").
//
//   1. Einstellungen: Wechsel → `pending:true` → Hinweis „Bestätigungslink an
//      … gesendet; bis dahin gilt deine bisherige Adresse", Feld zeigt weiter
//      die alte Adresse; /api/auth/me mit pendingEmail → Hinweis „wartet auf
//      Bestätigung" beim Öffnen
//   2. /email-bestaetigen mit Wechsel-Token (Antwort kind 'change') →
//      „E-Mail-Adresse geändert." mit neuer Adresse; email_taken → eigene
//      Meldung
//   3. /kauf: 403 email_unconfirmed → klare Meldung mit „Bestätigungsmail
//      erneut senden", Klick ruft /api/auth/resend-confirmation
//
//   node scripts/emailchangecheck.mjs     (braucht einen laufenden Vite-Server)
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OLD = 'alt@example.com', NEW = 'neu@example.com';

let fail = 0;
const check = (ok, label, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${label}${!ok && extra ? `  ${extra}` : ''}`); if (!ok) fail++; };
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const text = page => page.evaluate(() => document.body.innerText);

async function signedInPage({ pendingEmail = null, emailConfirmed = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { localStorage.setItem('appstudio-ui-lang', 'de'); } catch { /* */ } });
  await ctx.route(/\/u\/(script\.js|api\/send)(\?|$)/, r => r.abort());
  const errors = [];
  const user = { id: 1, username: OLD, role: 'user', email: OLD, emailConfirmed, pendingEmail, createdAt: '2026-10-01T10:00:00Z',
    plan: { kind: 'pass', until: '2026-12-30T00:00:00Z', daysLeft: 80, hasPaid: true, grants: [] } };
  const calls = [];
  await ctx.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user, plan: user.plan, emailConfirmed, pendingEmail }) }));
  await ctx.route('**/api/auth/2fa', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: false, mailerConfigured: true, hasEmail: true }) }));
  await ctx.route('**/api/oauth/connections', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"connections":[]}' }));
  // Ein Profil im Konto, damit der Editor mit „⋯"-Menü öffnet (wie headercheck).
  const prof = await (async () => {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    const d = await p.evaluate(async () => (await import('/src/data/storage.ts')).createDemoProfile('Prüfprofil'));
    await p.close();
    return d;
  })();
  await ctx.route('**/api/resumes', r => r.request().method() === 'GET'
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ resumes: [{ id: prof.id, display_name: prof.displayName, updated_at: new Date().toISOString() }] }) })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route(`**/api/resumes/${prof.id}`, r => r.request().method() === 'GET'
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ resume: { id: prof.id, displayName: prof.displayName, payload: prof } }) })
    : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/keys', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"keys":[]}' }));
  await ctx.route('**/api/auth/email', r => {
    calls.push(r.request().postDataJSON());
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, pending: true, pendingEmail: NEW, user: { ...user, pendingEmail: NEW } }) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  await ctx.route('**/api/billing/offer', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, sku: 'pass90', priceCents: 900, currency: 'EUR', days: 90, openRegistration: true }) }));
  await ctx.route('**/api/billing/orders', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"orders":[]}' }));
  await ctx.route('**/api/billing/checkout', r => { calls.push({ checkout: true }); return r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Bitte bestätige zuerst deine E-Mail-Adresse.', code: 'email_unconfirmed' }) }); });
  await ctx.route('**/api/auth/resend-confirmation', r => { calls.push({ resend: true }); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); });
  return { ctx, page, calls, errors };
}

async function openSettings(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.locator('header button[aria-label="Mehr"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('[role="menu"] >> text=Konto').first().click();
  await page.waitForSelector('#keys-email-pw');
  await page.waitForTimeout(500);
}

// 1. Wechsel vormerken
{
  const { ctx, page, calls, errors } = await signedInPage();
  await openSettings(page);
  const field = page.locator('input[type="email"][placeholder="name@example.com"]').last();
  check(await field.inputValue() === OLD, 'Einstellungen zeigen die bisherige Adresse');
  await field.fill(NEW);
  await page.fill('#keys-email-pw', 'geheim123');
  await page.locator('#keys-email-pw').press('Enter');
  await page.waitForTimeout(700);
  const tx = await text(page);
  check(calls.some(c => c.email === NEW && c.currentPassword === 'geheim123'), 'POST /api/auth/email mit neuer Adresse und Passwort');
  check(tx.includes(`Bestätigungslink an ${NEW} gesendet`) && /gilt deine bisherige Adresse/.test(tx), 'Hinweis: Bestätigungslink an die neue Adresse, bis dahin gilt die bisherige', tx.slice(0, 300));
  check(await field.inputValue() === OLD, 'Feld zeigt bis zur Bestätigung die bisherige Adresse');
  check(!/E-Mail gespeichert/.test(tx), 'kein „E-Mail gespeichert", solange nichts geändert ist');
  check(!errors.length, 'keine Seitenfehler', errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await signedInPage({ pendingEmail: NEW });
  await openSettings(page);
  const note = page.locator('[data-pending-email]');
  check(await note.count() === 1 && (await note.innerText()).includes(NEW), '/api/auth/me mit pendingEmail: „Wartet auf Bestätigung" beim Öffnen');
  await ctx.close();
}

// 2. Bestätigungsseite für Wechsel-Token
for (const [label, status, body, re] of [
  ['Wechsel bestätigt', 200, { ok: true, emailConfirmed: true, kind: 'change', email: NEW }, new RegExp(`E-Mail-Adresse geändert\\.[\\s\\S]*Ab jetzt gilt ${NEW.replace('.', '\\.')}`)],
  ['Adresse inzwischen vergeben', 409, { error: 'x', code: 'email_taken' }, /anderen Konto/],
  ['Registrierung bestätigt (unverändert)', 200, { ok: true, emailConfirmed: true }, /E-Mail-Adresse bestätigt\./],
]) {
  const { ctx, page } = await signedInPage();
  await ctx.route('**/api/auth/confirm-email', r => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
  await page.goto(`${BASE}/email-bestaetigen?token=${'k'.repeat(43)}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const tx = await text(page);
  check(re.test(tx), `/email-bestaetigen: ${label}`, tx.replace(/\s+/g, ' ').slice(0, 200));
  check(!new URL(page.url()).search.includes('token'), `/email-bestaetigen: ${label}: Schlüssel aus der Adresszeile`);
  await ctx.close();
}

// 3. Kauf mit unbestätigter Adresse
{
  const { ctx, page, calls, errors } = await signedInPage({ emailConfirmed: false });
  await page.goto(`${BASE}/kauf`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#bl-name');
  await page.fill('#bl-name', 'Prüf Person');
  await page.check('input[name="acceptTerms"]');
  await page.check('input[name="ageConfirmed18"]');
  await page.click('[data-order-button]');
  await page.waitForSelector('[data-unconfirmed]');
  const band = await page.locator('[data-unconfirmed]').innerText();
  check(calls.some(c => c.checkout) && /Bitte bestätige zuerst deine E-Mail-Adresse/.test(band) && band.includes(OLD), 'Kauf 403 email_unconfirmed: klare Meldung mit Adresse', band);
  check(!(await page.locator('.bl-error').count()), 'keine allgemeine Fehlermeldung daneben');
  await page.click('[data-resend-confirmation]');
  await page.waitForTimeout(500);
  check(calls.some(c => c.resend) && /Gesendet/.test(await page.locator('[data-unconfirmed]').innerText()), '„Bestätigungsmail erneut senden" ruft /api/auth/resend-confirmation');
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const ov390 = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(ov <= 0 && ov390 <= 0, 'kein waagerechtes Scrollen (1280, 390)', `${ov} / ${ov390}`);
  check(!errors.length, 'keine Seitenfehler', errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(fail ? `\n${fail} Befund(e)` : '\nohne Befund');
process.exit(fail ? 1 : 0);
