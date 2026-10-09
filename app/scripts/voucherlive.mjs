// vouchercheck.mjs gegen den echten Dienst (VOUCHER_LIVE=1): Vite mit Proxy
// /pdfapi → cv-api, Postgres, Mail in eine Datei (MAIL_CAPTURE_FILE), echte
// Registrierung mit ALTCHA, echter Bestätigungslink aus der erfassten Mail.
//
// Erwartet:
//   HARNESS_BASE        Vite (z. B. http://localhost:5221)
//   API_BASE            cv-api direkt (z. B. http://localhost:3202) — nur für
//                       Admin-Abfragen der Zählerstände
//   ADMIN_USER/ADMIN_PASS  Admin-Konto (ADMIN_USERNAME/ADMIN_PASSWORD des Dienstes)
//   MAIL_CAPTURE_FILE   dieselbe Datei wie beim Dienst
//   REG_CLOSED=1        zweiter Lauf, wenn der Dienst mit OPEN_REGISTRATION=0
//                       läuft: prüft nur den Hinweis „noch nicht gestartet"
//   VOUCHER_SEED        Code-Präfix, damit Läufe sich nicht stören (Standard: Uhrzeit)
//
// Testcodes sind erfunden und gehören nur in die Testdatenbank.
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5221';
const API = process.env.API_BASE || 'http://localhost:3202';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const MAILS = process.env.MAIL_CAPTURE_FILE || '';
const ADMIN_USER = process.env.ADMIN_USER || '';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const SEED = (process.env.VOUCHER_SEED || String(Date.now()).slice(-5)).toUpperCase();
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const D = 86_400_000;

export async function run() {
  const results = [];
  const check = (ok, label, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
  const step = t => console.log(`\n— ${t}`);
  const errors = [];
  const urls = [];
  const browser = await chromium.launch({ executablePath: EXEC });
  const dateIn = days => new Date(Date.now() + days * D).toISOString().slice(0, 10);

  async function ctx(viewport = { width: 1440, height: 900 }) {
    const c = await browser.newContext({ viewport, locale: 'de-DE' });
    await c.addInitScript(() => {
      window.__ev = [];
      window.umami = { track: (e, d) => window.__ev.push([e, d || {}]) };
      try { localStorage.setItem('appstudio-ui-lang', 'de'); } catch { /* */ }
    });
    await c.route('**/analytics.example.com/**', r => r.abort());
    return c;
  }
  async function page(c) {
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(String(e).slice(0, 200)));
    p.on('request', r => urls.push(r.url()));
    return p;
  }
  const shot = async (p, name) => { if (SHOTS) { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } };
  async function axe(p, name) {
    await p.evaluate(AXE);
    const r = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations
      .map(v => ({ ...v, nodes: v.id === 'target-size' ? v.nodes.filter(n => !n.target.join(' ').includes('cv-edit')) : v.nodes }))
      .filter(v => v.nodes.length).map(v => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 2).map(n => n.target.join(' ')) })));
    check(r.length === 0, `axe: ${name}`, r.length ? JSON.stringify(r).slice(0, 400) : '0 Verstöße');
  }
  async function noOverflow(p, name) {
    const [sw, iw] = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    check(sw <= iw, `kein waagerechtes Scrollen: ${name}`, `${sw}/${iw}`);
  }
  async function tabTo(p, pred, max = 60) {
    for (let i = 0; i < max; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(pred)) return true; }
    return false;
  }
  async function solveAltcha(p) {
    const box = p.locator('altcha-widget input[type="checkbox"]').first();
    await box.waitFor({ timeout: 10000 });
    await box.click({ force: true });
    await p.waitForFunction(() => !!document.querySelector('altcha-widget input[name="altcha"]')?.value, null, { timeout: 30000 });
  }
  async function login(p, user, pass) {
    const r = await p.evaluate(async ([u, pw]) => {
      const res = await fetch('/pdfapi/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: pw }) });
      return res.status;
    }, [user, pass]);
    return r === 200;
  }
  /** Zählerstand eines Gutscheins über die Admin-Schnittstelle (eigene Sitzung). */
  let adminCookie = '';
  async function adminFetch(path, init = {}) {
    if (!adminCookie) {
      const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }) });
      adminCookie = (r.headers.getSetCookie?.() ?? [r.headers.get('set-cookie')]).map(c => String(c).split(';')[0]).join('; ');
    }
    const r = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Cookie: adminCookie, ...(init.headers || {}) } });
    return r.json();
  }
  const voucherByCode = async code => (await adminFetch('/api/admin/vouchers')).vouchers.find(v => v.code === code);
  function confirmLink(email) {
    if (!MAILS || !existsSync(MAILS)) return null;
    const lines = readFileSync(MAILS, 'utf8').trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const m = lines.reverse().find(x => x.to === email && /email-bestaetigen/.test(x.html || x.text || ''));
    const href = m && /(https?:\/\/[^"\s<]+\/email-bestaetigen[^"\s<]*)/.exec(m.html || m.text);
    return href ? href[1].replace(/&amp;/g, '&') : null;
  }

  const LIVE30 = `LIVE${SEED}D30`;
  const MORE30 = `MEHR${SEED}D30`;
  const LIFE = `DAUER${SEED}L5`;

  if (process.env.REG_CLOSED === '1') {
    step('Geschlossene Registrierung (Dienst mit OPEN_REGISTRATION=0)');
    const c = await ctx();
    const p = await page(c);
    await p.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
    await p.fill('#bl-code', process.env.CLOSED_CODE || LIVE30);
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-voucher-closed], [data-voucher-error]');
    const tx = await p.locator('[data-voucher-preview], [data-voucher-error]').first().innerText();
    check(/Die öffentliche Aktion ist noch nicht gestartet/.test(tx), 'Hinweis „noch nicht gestartet"', tx.slice(0, 120));
    check(await p.getByRole('button', { name: 'Konto erstellen' }).count() === 0, 'kein „Konto erstellen"');
    await shot(p, 'live-code-geschlossen-1440');
    await browser.close();
    const ok = results.filter(Boolean).length;
    console.log(`\n${ok}/${results.length} Schritte bestanden`);
    return ok === results.length ? 0 : 1;
  }

  // ── Verwaltung: anlegen über die Oberfläche ───────────────────────────
  step('Verwaltung gegen cv-api: öffentlich / dauerhaft / persönlich, Aktionshinweis');
  const ac = await ctx();
  await ac.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const ap = await page(ac);
  await ap.goto(`${BASE}/preise`, { waitUntil: 'networkidle' });
  check(await login(ap, ADMIN_USER, ADMIN_PASS), 'Admin angemeldet');
  await ap.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await ap.getByRole('button', { name: 'Admin', exact: true }).click();
  await ap.locator('[data-tab="vouchers"]').click();
  await ap.waitForSelector('[data-voucher-form]');
  async function createPublic(name, code, { lifetime = false, limit = '100' } = {}) {
    await ap.locator('input[name="adm-v-dist"]').nth(1).check();
    await ap.locator('input[name="adm-v-kind"]').nth(lifetime ? 1 : 0).check();
    await ap.fill('#adm-v-name', name);
    await ap.fill('#adm-v-code', code);
    await ap.fill('#adm-v-until', dateIn(20));
    await ap.fill('input[aria-label="Gesamtlimit (Anzahl Einlösungen)"]', limit);
    await ap.getByRole('button', { name: 'Aktionscode anlegen' }).click();
    await ap.waitForFunction(c => [...document.querySelectorAll('[data-voucher-created] textarea')].some(t => t.value.includes(c)), code, { timeout: 8000 });
  }
  await createPublic('Live 30 Tage', LIVE30);
  const notice = await ap.locator('[data-voucher-created] textarea').inputValue();
  check(new RegExp(`^Mit ${LIVE30} erhältst du 30 Tage Bewerbungs-Pass kostenlos\\. Ohne Zahlungsdaten, ohne Abo\\. Einlösbar bis .+, für die ersten 100 erfolgreichen Einlösungen\\.\\n${BASE.replace(/[.:/]/g, m => '\\' + m)}/code$`).test(notice), 'Aktionshinweis vom Server + Einlöseadresse', JSON.stringify(notice));
  await ap.locator('[data-voucher-created]').getByRole('button', { name: 'Hinweis kopieren' }).click();
  check(await ap.evaluate(() => navigator.clipboard.readText()) === notice, 'Aktionshinweis kopierbar');
  await createPublic('Live mehr', MORE30);
  await createPublic('Live dauerhaft', LIFE, { lifetime: true, limit: '5' });
  check(/Mit DAUER.+ erhältst du einen dauerhaften Gratiszugang zum Bewerbungs-Pass\..+für die ersten 5 erfolgreichen Einlösungen\./.test(await ap.locator('[data-voucher-created] textarea').inputValue()), 'Aktionshinweis dauerhaft (Server)');
  await ap.locator('input[name="adm-v-dist"]').nth(0).check();
  await ap.locator('input[name="adm-v-kind"]').nth(0).check();
  await ap.fill('#adm-v-name', 'Live persönlich');
  await ap.getByRole('button', { name: 'Codes erzeugen' }).click();
  await ap.waitForSelector('[data-new-code]');
  const personal = await ap.locator('[data-new-code]').first().innerText();
  check(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/.test(personal), 'persönlicher Code vom Server, einmal angezeigt', personal.replace(/.(?=.{4})/g, '•'));
  await ap.locator('[data-voucher-created]').getByRole('button', { name: 'Ausblenden' }).click();
  await ap.waitForSelector('[data-voucher-row="personal"]');
  check(/endet auf …/.test(await ap.locator('[data-voucher-row="personal"]').first().innerText()) && !(await ap.locator('[data-admin-vouchers]').innerText()).includes(personal), 'Übersicht: persönlicher Code nur als Hinweis „…XXXX"');
  await axe(ap, 'Verwaltung live');
  // Duplikat (Normalisierung)
  await ap.locator('input[name="adm-v-dist"]').nth(1).check();
  await ap.fill('#adm-v-name', 'Dublette');
  await ap.fill('#adm-v-code', LIVE30.toLowerCase().replace(/(.{4})/, '$1 -'));
  await ap.fill('#adm-v-until', dateIn(20));
  await ap.fill('input[aria-label="Gesamtlimit (Anzahl Einlösungen)"]', '10');
  await ap.getByRole('button', { name: 'Aktionscode anlegen' }).click();
  await ap.waitForSelector('[data-admin-vouchers] [role="alert"]');
  check(/gibt es schon/.test(await ap.locator('[data-admin-vouchers] [role="alert"]').first().innerText()), 'Eindeutigkeit: Dublette in anderer Schreibweise abgelehnt');

  // ── Fall 20 live: Registrierung, Bestätigung aus der Mail, Einlösen ────
  const users = [];
  for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
    step(`Fall 20 live · ${tag}`);
    const email = `gutschein-${SEED.toLowerCase()}-${tag}@example.org`;
    const c = await ctx({ width: w, height: h });
    const p = await page(c);
    const before = (await voucherByCode(LIVE30)).redemptions;
    await p.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
    await p.fill('#bl-code', LIVE30.toLowerCase());
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-voucher-account]');
    check(/30 Tage Bewerbungs-Pass kostenlos/.test(await p.locator('[data-voucher-preview]').innerText()), 'Vorschau vom Server');
    await p.getByRole('button', { name: 'Konto erstellen' }).click();
    await p.fill('#bl-email', email);
    await p.fill('#bl-pw', 'Gutschein-Test-Passwort-1');
    await p.locator('label.bl-check', { hasText: '16' }).locator('input').check();
    await solveAltcha(p);
    await p.locator('form[aria-labelledby="bl-acc-h"] button[type="submit"]').click();
    await p.waitForSelector('[data-voucher-unconfirmed]', { timeout: 15000 });
    check(true, 'Konto angelegt, Hinweis „erst bestätigen"');
    check((await voucherByCode(LIVE30)).redemptions === before, 'vor der Bestätigung kein Platz verbraucht', `${before}`);
    await shot(p, `live-code-unbestaetigt-${tag}`);
    let link = null;
    for (let i = 0; i < 20 && !link; i++) { link = confirmLink(email); if (!link) await p.waitForTimeout(250); }
    check(!!link, 'Bestätigungslink in der erfassten Mail');
    const t2 = await page(c);
    await t2.goto(link.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: 'networkidle' });
    await t2.waitForURL(u => new URL(u).pathname === '/code', { timeout: 10000 });
    await t2.waitForSelector('[data-redeem]', { timeout: 10000 });
    check(await t2.inputValue('#bl-code') === LIVE30.toLowerCase(), 'zurück auf /code, Code vorbefüllt');
    await t2.click('[data-redeem]');
    await t2.waitForSelector('[data-voucher-ok]', { timeout: 10000 });
    check(/Dein Gratiszugang ist bis .+ aktiv\. Danach endet er automatisch\. Es wird nichts abgebucht\./.test(await t2.locator('[data-voucher-ok]').innerText()), 'eingelöst (Server)');
    check((await voucherByCode(LIVE30)).redemptions === before + 1, 'genau ein Platz verbraucht');
    await shot(t2, `live-code-erfolg-${tag}`);
    users.push({ c, p: t2, tag, w });
  }

  // ── Fall 14 live: Mein Pass, nur Tastatur ──────────────────────────────
  for (const u of users) {
    step(`Fall 14 live · Mein Pass · Tastatur · ${u.tag}`);
    const p = u.p;
    await p.goto(`${BASE}/?pass=1`, { waitUntil: 'networkidle' });
    try { await p.waitForSelector('[data-my-pass] [data-voucher-form]', { timeout: 6000 }); }
    catch { await p.getByRole('button', { name: 'Mein Pass' }).first().click(); await p.waitForSelector('[data-my-pass] [data-voucher-form]'); }
    const lineBefore = await p.locator('[data-plan]').innerText();
    check(await tabTo(p, () => document.activeElement?.id === 'bl-mp-code'), 'Codefeld per Tab');
    await p.keyboard.type(MORE30.toLowerCase());
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-voucher-msg="ok"]', { timeout: 10000 });
    const msg = await p.locator('[data-voucher-msg="ok"]').innerText();
    check(/Die 30 Gratistage hängen sich an deine bisherige Laufzeit an\. Dein Zugang ist jetzt bis .+ aktiv\./.test(msg), 'zweiter Zeitgutschein hängt sich an', msg);
    await p.waitForFunction(b => document.querySelector('[data-plan]')?.innerText !== b, lineBefore, { timeout: 8000 });
    check(true, 'Status sichtbar aktualisiert', `${lineBefore} → ${await p.locator('[data-plan]').innerText()}`);
    check(await p.locator('[data-grant="voucher"]').count() === 2, 'Herkunft: zwei Gutscheine');
    await axe(p, `Mein Pass live (${u.tag})`);
    if (u.w === 390) await noOverflow(p, 'Mein Pass live 390');
    await shot(p, `live-mein-pass-gutschein-${u.tag}`);
    // gleicher Code noch einmal → abgelehnt, nichts dazu
    await p.fill('#bl-mp-code', MORE30);
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-voucher-msg="error"]');
    check(/schon eingelöst/.test(await p.locator('[data-voucher-msg="error"]').innerText()), 'derselbe Code zweimal: abgelehnt');
  }

  // ── dauerhaft live ─────────────────────────────────────────────────────
  step('Dauerhafter Gratiszugang live');
  {
    const p = users[0].p;
    await p.fill('#bl-mp-code', LIFE);
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-voucher-msg="ok"]');
    check((await p.locator('[data-voucher-msg="ok"]').innerText()) === 'Dein dauerhafter Gratiszugang ist aktiv. Du musst keinen Bewerbungs-Pass kaufen.', 'dauerhaft eingelöst (Server)');
    await p.waitForFunction(() => document.querySelector('[data-plan]')?.getAttribute('data-plan') === 'lifetime', null, { timeout: 8000 });
    check(await p.locator('[data-buy]').count() === 0, 'kein Kaufknopf');
    await shot(p, 'live-mein-pass-dauerhaft-1440');
    await p.goto(`${BASE}/kauf`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-checkout-lifetime]');
    check(true, '/kauf: „kein Kauf nötig"');
    const co = await p.evaluate(async () => (await fetch('/pdfapi/api/billing/checkout', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sku: 'pass90', country: 'DE', billingName: 'Test', acceptTerms: true, ageConfirmed18: true }) })).status);
    check(co === 409, 'Server lehnt Kauf bei dauerhaftem Zugang ab (409)', String(co));
    await p.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
    await p.fill('#bl-code', personal);
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-voucher-lifetime-already]');
    check(await p.locator('[data-redeem]').count() === 0, '/code: weiterer Code nicht angeboten');
    const pv = await voucherByCode(LIFE);
    check(pv.redemptions === 1, 'dauerhaft: genau eine Einlösung');
  }

  // ── Deaktivieren live ──────────────────────────────────────────────────
  step('Deaktivieren live');
  await ap.reload({ waitUntil: 'networkidle' });
  await ap.getByRole('button', { name: 'Admin', exact: true }).click();
  await ap.locator('[data-tab="vouchers"]').click();
  const row = ap.locator('[data-voucher-row="public"]', { hasText: LIVE30 });
  await row.getByRole('button', { name: 'Deaktivieren …' }).click();
  check((await row.locator('[role="group"] p').innerText()) === 'Neue Einlösungen sind dann nicht mehr möglich. Bereits gewährte Zugänge bleiben bestehen.', 'Erklärung wörtlich');
  await row.locator('[data-confirm-deactivate]').click();
  await ap.waitForFunction(c => [...document.querySelectorAll('[data-voucher-row="public"]')].some(r => r.textContent.includes(c) && r.getAttribute('data-active') === 'false'), LIVE30);
  check(true, 'deaktiviert');
  await row.getByRole('button', { name: 'Einlösungen' }).click();
  await ap.waitForSelector('[data-voucher-row] table');
  check(await row.locator('tbody tr').count() === 2 && !/@/.test(await row.locator('table').innerText()), 'Einlösungsverlauf: 2 Zeilen, keine E-Mail-Adressen');
  const stats = await ap.locator('[data-voucher-stats]').innerText();
  check(/Zeitgutschein/.test(stats) && /dauerhaft/.test(stats) && /Kein Umsatz/.test(stats), 'Kennzahlen je Zugangsart, getrennt vom Umsatz');
  await ap.evaluate(() => {
    const bd = document.querySelector('[data-modal-backdrop]'); const m = document.querySelector('[data-modal]');
    if (bd) { bd.style.position = 'absolute'; bd.style.alignItems = 'flex-start'; bd.style.height = 'auto'; bd.style.minHeight = '100%'; }
    if (m) m.style.maxHeight = 'none';
  });
  await shot(ap, 'live-admin-gutscheine-1440');
  {
    const c = await ctx();
    const p = await page(c);
    await p.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
    await p.fill('#bl-code', LIVE30); await p.keyboard.press('Enter');
    await p.waitForSelector('[data-voucher-error]');
    check(/nicht mehr aktiv/.test(await p.locator('[data-voucher-error]').innerText()), 'deaktivierter Code: verständlicher Fehler');
    await p.fill('#bl-code', `FALSCH${SEED}`); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /kennen wir nicht/.test(document.querySelector('[data-voucher-error]')?.textContent || ''));
    check(true, 'unbekannter Code: verständlicher Fehler');
    await c.close();
  }
  // Fortbestand nach Deaktivierung
  {
    const p = users[1].p;
    await p.goto(`${BASE}/?pass=1`, { waitUntil: 'networkidle' });
    try { await p.waitForSelector('[data-my-pass]', { timeout: 6000 }); }
    catch { await p.getByRole('button', { name: 'Mein Pass' }).first().click(); await p.waitForSelector('[data-my-pass]'); }
    check(/Gratiszugang aktiv bis/.test(await p.locator('[data-plan]').innerText()), 'nach Deaktivierung: gewährter Zugang bleibt');
  }

  const leaked = urls.filter(u => [LIVE30, MORE30, LIFE, personal.replace(/-/g, '')].some(c => u.toUpperCase().replace(/-/g, '').includes(c)));
  check(leaked.length === 0, 'kein Code in einer Adresse', leaked.slice(0, 2).join(' '));
  check(errors.length === 0, 'keine Laufzeitfehler', errors.slice(0, 3).join(' | '));
  await browser.close();
  const ok = results.filter(Boolean).length;
  console.log(`\n${ok}/${results.length} Schritte bestanden`);
  return ok === results.length ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await run());
