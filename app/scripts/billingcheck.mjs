// Der Weg zum Bewerbungs-Pass, einmal ganz durchgeklickt (Runde 4, 09.10.2026).
//
//   1. /preise: Preis im ersten Bildschirm, vollständig („einmalig · 90 Tage ·
//      kein Abo · endet von selbst · 14 Tage Geld zurück", § 19-Hinweis),
//      Vergleichstabelle, die vier Pflichtfragen; keine Countdowns, keine
//      Konkurrenznamen, keine „ATS-safe"-Siegel, keine offenen Platzhalter.
//   2. Freischalt-Momente in der Demo: ⋯ → „Konto anlegen", Sharelink im
//      Export-Paneel. Export (PDF) bleibt frei, ohne Paneel.
//   3. Registrierung mit echtem ALTCHA, Häkchen „mindestens 16", danach
//      direkt die Bestellübersicht, Band „E-Mail bestätigen".
//   4. Bestellübersicht nach § 312j BGB: Pflichtangaben im Kasten direkt über
//      dem Knopf, Knopf genau „zahlungspflichtig bestellen", ohne Häkchen kein
//      Absenden, Doppelklick erzeugt EINE Bestellung.
//   5. Danke-Seite: offen → bezahlt (Polling), fehlgeschlagen, abgebrochen,
//      abgelaufen, unbekannt; „Lokale Profile ins Konto übernehmen".
//   6. „Mein Pass": Bestellung, Rechnung, „Vertrag widerrufen" →
//      „Widerruf bestätigen" → Eingangsbestätigung mit Uhrzeit. Bänder für
//      „noch kein Pass" und „läuft bald ab".
//   7. Öffentlicher Widerruf in zwei Schritten (Bestellnummer freiwillig),
//      Muster-Widerrufsformular; Kündigungsschaltfläche nach § 312k BGB
//      („Verträge hier kündigen" → „jetzt kündigen") mit und ohne Konto.
//   8. Sprachprüfung der neuen Seiten (en, fr, es), axe auf allen neuen
//      Seiten, kein waagerechtes Scrollen auf 390 und 320 px.
//   9. Messung: preise_view, unlock_panel_view, register_start/done,
//      checkout_view, checkout_submit, paid_view, withdraw_done — ohne
//      E-Mail-Adresse oder Namen in den Ereignisdaten.
//
// Die Bezahl-Endpunkte kommen aus scripts/_billingmock.mjs (page.route), es
// braucht also nur einen laufenden Vite. Bildschirmfotos: SHOTS=/ordner.
//
//   HARNESS_BASE=http://localhost:5211 SHOTS=/tmp/x node scripts/billingcheck.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { installBillingMock, createBillingState, passPlan } from './_billingmock.mjs';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

const results = [];
const check = (ok, label, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
const step = t => console.log(`\n— ${t}`);

const browser = await chromium.launch({ executablePath: EXEC });
const st = createBillingState();
const EMAIL = 'pruefung@example.org';

async function newPage(viewport = { width: 1440, height: 900 }, lang = 'de') {
  const ctx = await browser.newContext({ viewport, locale: lang === 'de' ? 'de-DE' : lang, acceptDownloads: true });
  await ctx.addInitScript(([l]) => {
    window.__ev = [];
    window.umami = { track: (e, d) => window.__ev.push([e, d || {}]) };
    try { localStorage.setItem('appstudio-ui-lang', l); } catch { /* */ }
  }, [lang]);
  await ctx.route('**/analytics.example.com/**', r => r.abort());
  // Optionales Umami über /u/ auf derselben Domain (nginx.conf).
  await ctx.route(/\/u\/(script\.js|api\/send)(\?|$)/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await installBillingMock(page, st);
  return page;
}
const errors = [];
const events = page => page.evaluate(() => window.__ev);
const shot = async (page, name) => {
  if (!SHOTS) return;
  // Nach oben rollen: sonst steht der klebende Kopf im Ganzseitenfoto mitten im Bild.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
const text = page => page.evaluate(() => document.body.innerText);
async function axe(page, name) {
  await page.evaluate(AXE);
  /* Dieselbe begründete Ausnahme wie in axecheck.mjs: target-size an den
     Textstellen im gesetzten Dokument (WCAG 2.5.8, Ausnahme „Inline"). */
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations
    .map(v => ({ ...v, nodes: v.id === 'target-size' ? v.nodes.filter(n => !n.target.join(' ').includes('cv-edit')) : v.nodes }))
    .filter(v => v.nodes.length)
    .map(v => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 2).map(n => n.target.join(' ')) })));
  check(r.length === 0, `axe ${name}`, r.length ? JSON.stringify(r).slice(0, 400) : '');
}
async function noOverflow(page, name) {
  const [sw, iw, who] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth,
    [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && e.tagName !== 'BR')
      .slice(-3).map(e => `${e.tagName}.${String(e.className).slice(0, 40)} „${(e.textContent || '').trim().slice(0, 30)}"`)]);
  check(sw <= iw, `kein waagerechtes Scrollen: ${name}`, sw <= iw ? `${sw}/${iw}` : `${sw}/${iw} ${who.join(' | ')}`);
}
async function solveAltcha(page) {
  const box = page.locator('altcha-widget input[type="checkbox"]').first();
  await box.waitFor({ timeout: 10000 });
  await box.click({ force: true });
  await page.waitForFunction(() => {
    const w = document.querySelector('altcha-widget');
    const inp = w?.querySelector('input[name="altcha"]');
    return !!(inp && inp.value);
  }, null, { timeout: 15000 });
}
const BANNED = /countdown|nur noch heute|angebot endet|ATS-safe|ATS-sicher|Zety|Kickresume|FlowCV|Resume Genius|Canva|Rezi\b|\{\{/i;

// ── 1. Angebotsseite ────────────────────────────────────────────────────────
step('Angebotsseite /preise');
let page = await newPage();
await page.goto(`${BASE}/preise`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
let body = await text(page);
const passTop = await page.locator('.bl-card-accent .bl-price').boundingBox();
check(passTop && passTop.y + passTop.height < 900, 'Preis des Passes im ersten Bildschirm (1440×900)', passTop ? `y=${Math.round(passTop.y)}` : 'fehlt');
for (const f of ['9\u00a0€', 'einmalig', '90 Tage', 'kein Abo', 'endet von selbst', '14 Tage Geld zurück', '§ 19 UStG', 'Endpreis']) check(body.includes(f), `Preiszeile enthält „${f}"`);
check(await page.locator('.bl-table tbody tr').count() >= 8, 'Vergleichstabelle ohne Konto / mit Pass', `${await page.locator('.bl-table tbody tr').count()} Zeilen`);
for (const q of ['Was passiert nach 90 Tagen?', 'Kann ich verlängern?', 'Wie widerrufe ich?', 'Ist das ein Abo?']) check(body.includes(q), `FAQ: ${q}`);
check(/Nur-Lesen/.test(body) && /nichts, ohne es dir vorher per E-Mail anzukündigen/.test(body), 'FAQ: nach Ablauf Nur-Lesen + Export, keine Löschung ohne Ankündigung');
check(/Privatpersonen aus Deutschland und den anderen Ländern der Europäischen Union/.test(body) && /Mollie/.test(await page.locator('.bl-card-accent [data-k="start"]').innerText()), '§ 312j Abs. 1: Lieferbeschränkung und Zahlungsmittel auf /preise');
check(await page.locator('footer a[href="/kuendigen"]', { hasText: 'Verträge hier kündigen' }).count() === 1, 'Fußzeile: „Verträge hier kündigen" (§ 312k)');
check(!BANNED.test(body), 'keine Countdowns, Konkurrenznamen, Siegel oder offenen Platzhalter', (body.match(BANNED) || [''])[0]);
check(/Export ist nie Teil des Passes/.test(await page.locator('.bl-faq').textContent()), 'Export ausdrücklich nicht hinter der Bezahlschranke');
check(await page.locator('footer a[href="/widerruf"]').count() === 1, 'Fußzeile: „Vertrag widerrufen"');
for (const h of ['/impressum', '/datenschutz', '/agb', '/widerrufsbelehrung', '/kuendigen']) check(await page.locator(`footer a[href="${h}"]`).count() === 1, `Fußzeile: ${h}`);
check((await events(page)).some(([e]) => e === 'preise_view'), 'Ereignis preise_view');
await axe(page, '/preise');
await shot(page, 'preise-1440');

step('Startseite: Abschnitt Preise');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForSelector('#preise', { timeout: 10000 });
const lpPreise = await page.locator('#preise').innerText();
check(/9\s€/.test(lpPreise) && /kein Abo/.test(lpPreise) && /Ohne Konto/.test(lpPreise), 'Startseite: Preise mit „ohne Konto" und Pass', lpPreise.replace(/\s+/g, ' ').slice(0, 100));
check(await page.locator('.lp-nav-links a[href="/preise"]').count() >= 1, 'Startseite: Navigation „Preise"');
for (const h of ['/agb', '/widerrufsbelehrung', '/widerruf', '/kuendigen']) check(await page.locator(`.lp-footer a[href="${h}"]`).count() === 1, `Startseite: Fußzeile ${h}`);
await axe(page, 'Startseite mit Preisen');

// ── 2. Freischalt-Momente in der Demo ───────────────────────────────────────
step('Freischalt-Momente (Demo)');
await page.goto(`${BASE}/?demo=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('nav[aria-label] button', { timeout: 15000 });
await page.waitForTimeout(1200);
check(new URL(page.url()).search === '', 'Direktlink /?demo=1 startet die Demo und räumt die Adresse auf', page.url());
await page.locator('header button[aria-haspopup="menu"]').last().click();
await page.waitForTimeout(250);
await page.locator('[role^="menuitem"]', { hasText: 'Konto anlegen' }).click();
await page.waitForSelector('[data-unlock="account"]');
let dlg = await page.locator('[data-unlock="account"]').innerText();
check(/9\s€/.test(dlg) && /einmalig/.test(dlg), 'Paneel „Konto anlegen": Preis', dlg.replace(/\s+/g, ' ').slice(0, 120));
check(await page.locator('[data-unlock="account"] button', { hasText: 'Pass holen' }).count() === 1, 'Paneel: „Pass holen"');
check(await page.locator('[data-unlock="account"] button', { hasText: 'Weiter ohne Konto' }).count() === 1, 'Paneel: „Weiter ohne Konto"');
check(/PDF und Word bleiben ohne Konto kostenlos/.test(dlg), 'Paneel sagt, dass Export frei bleibt');
let ev = await events(page);
check(ev.some(([e, d]) => e === 'unlock_panel_view' && d.feature === 'account'), 'Ereignis unlock_panel_view (account)');
await axe(page, 'Freischalt-Paneel');
await shot(page, 'freischalt-1440');
await page.locator('[data-unlock="account"] button', { hasText: 'Weiter ohne Konto' }).click();
check(await page.locator('[data-unlock]').count() === 0, '„Weiter ohne Konto" schließt das Paneel');

await page.locator('nav[aria-label] button', { hasText: 'Export' }).click();
await page.waitForTimeout(400);
await page.locator('#ui-panel button', { hasText: 'Konto anlegen' }).first().click();
await page.waitForSelector('[data-unlock="share"]');
check(/Sharelinks gibt es mit dem Pass/.test(await page.locator('[data-unlock="share"]').innerText()), 'Sharelink in der Demo → Paneel „Sharelinks"');
await page.keyboard.press('Escape');
check(await page.locator('[data-unlock]').count() === 0, 'Escape schließt das Paneel');
await page.locator('#ui-panel button', { hasText: 'KI verbinden' }).first().click();
await page.waitForSelector('[data-unlock="mcp"]');
check(true, 'KI verbinden in der Demo → Paneel „KI"');
await page.keyboard.press('Escape');

// PDF darf nie durch ein Paneel gehen.
const pdfBefore = st.calls.filter(c => c.path === '/api/pdf').length;
await page.locator('header button', { hasText: /^PDF/ }).first().click().catch(() => {});
await page.waitForTimeout(2500);
check(await page.locator('[data-unlock]').count() === 0, 'PDF-Export ohne Freischalt-Paneel');
check(st.calls.filter(c => c.path === '/api/pdf').length > pdfBefore, 'PDF-Export läuft in der Demo', `${st.calls.filter(c => c.path === '/api/pdf').length - pdfBefore} Aufruf(e)`);

// Versionen am Server
await page.locator('header button[aria-haspopup="menu"]').last().click();
await page.waitForTimeout(250);
await page.locator('[role^="menuitem"]', { hasText: 'Versionen' }).first().click();
await page.waitForTimeout(500);
await page.locator('button', { hasText: 'Versionen am Server gibt es mit dem Pass' }).click();
await page.waitForSelector('[data-unlock="versions"]');
check(true, 'Versionen (lokal) → Paneel „Versionen am Server"');
await page.keyboard.press('Escape');

// Über Geräte speichern, dann „Pass holen"
await page.locator('header button[aria-haspopup="menu"]').last().click();
await page.waitForTimeout(250);
await page.locator('[role^="menuitem"]', { hasText: 'Speichern über Geräte' }).click();
await page.waitForSelector('[data-unlock="sync"]');
check(true, '⋯ → Speichern über Geräte → Paneel');
await page.locator('[data-unlock="sync"] button', { hasText: 'Pass holen' }).click();
await page.waitForURL(/\/kauf$/);
check(true, '„Pass holen" führt zu /kauf');

// ── 3. Registrierung ────────────────────────────────────────────────────────
step('Registrierung');
await page.waitForSelector('#bl-email');
await axe(page, '/kauf (Registrierung)');
await page.fill('#bl-email', EMAIL);
await page.fill('#bl-pw', 'geheim-und-lang');
await page.click('button[type="submit"]:has-text("Konto anlegen")');
check(/mindestens 16|ab 16/.test(await page.locator('.bl-error').innerText()), 'ohne Häkchen „16" keine Registrierung');
check(!st.calls.some(c => c.path === '/api/auth/register'), '… und kein Aufruf am Server');
await page.check('text=Ich bin mindestens 16 Jahre alt.');
await solveAltcha(page);
check(await page.locator('a[href="/datenschutz"]', { hasText: 'Datenschutzerklärung' }).count() === 1, 'Link zur Datenschutzerklärung im Formular');
await page.click('button[type="submit"]:has-text("Konto anlegen")');
await page.waitForSelector('#bl-co-h', { timeout: 10000 });
const reg = st.calls.find(c => c.path === '/api/auth/register');
check(reg && reg.body.ageConfirmed16 === true && typeof reg.body.altcha === 'string' && reg.body.email === EMAIL, 'Registrierung: E-Mail, Passwort, ALTCHA, ageConfirmed16');
check(st.altchaFailures === 0, 'ALTCHA-Lösung vom Server angenommen');
check(await page.locator('[data-band="confirm-email"]').count() === 1, 'Band „Bitte E-Mail bestätigen"');
await page.locator('[data-band="confirm-email"] button', { hasText: 'Erneut senden' }).click();
await page.waitForTimeout(300);
check(st.calls.some(c => c.path === '/api/auth/resend-confirmation'), '„Erneut senden" ruft resend-confirmation');
ev = await events(page);
for (const e of ['register_start', 'register_done', 'checkout_view']) check(ev.some(([x]) => x === e), `Ereignis ${e}`);

// ── 4. Bestellübersicht ─────────────────────────────────────────────────────
step('Bestellübersicht (§ 312j BGB)');
const btn = page.locator('[data-order-button]');
check((await btn.innerText()).trim() === 'zahlungspflichtig bestellen', 'Knopftext genau „zahlungspflichtig bestellen"', `„${(await btn.innerText()).trim()}"`);
const adj = await page.evaluate(() => {
  const s = document.querySelector('[data-summary]'); const b = document.querySelector('[data-order-button]');
  let n = s.nextElementSibling; const between = [];
  while (n && n !== b) { between.push(n.tagName + '.' + n.className); n = n.nextElementSibling; }
  const sr = s.getBoundingClientRect(); const br = b.getBoundingClientRect();
  return { found: n === b, between, gap: Math.round(br.top - sr.bottom) };
});
check(adj.found && adj.between.length === 0 && adj.gap < 40, 'Pflichtangaben unmittelbar über dem Knopf', JSON.stringify(adj));
const sum = await page.locator('[data-summary]').innerText();
for (const [k, re] of [['Produkt', /Bewerbungs-Pass, 90 Tage/], ['Eigenschaften', /Sharelinks/], ['Laufzeit', /90 Tage ab Freischaltung/], ['Ende ohne Verlängerung', /Endet automatisch nach 90 Tagen\. Kein Abo, keine Verlängerung/], ['Gesamtpreis', /9,00\s€/], ['§ 19', /§ 19 UStG/], ['Widerruf', /14 Tage Widerrufsrecht mit voller Erstattung/]]) check(re.test(sum), `Kasten: ${k}`);
check(!/\{\{/.test(sum) && !/Telefon: ,/.test(await text(page)), 'Bestellübersicht ohne offene Platzhalter');
check(/Mollie/.test(await page.locator('[data-k="start"]').innerText()) && /Europäischen Union/.test(await page.locator('[data-k="start"]').innerText()), '§ 312j Abs. 1: Zahlungsmittel und Lieferbeschränkung zu Beginn');
check(await page.locator('select#bl-country').inputValue() === 'DE', 'Land: Pflicht, Standard DE');
check(await page.locator('input[type="checkbox"]').count() === 2, 'zwei Häkchen (AGB, volljährig); Widerrufsbelehrung als Link-Zeile', `${await page.locator('input[type="checkbox"]').count()}`);
check(await page.locator('label a[href="/agb"]').count() === 1 && await page.locator('[data-k="withdrawal-notice"] a[href="/widerrufsbelehrung"]').count() === 1, 'AGB-Häkchen und Belehrungszeile verlinkt');
check(/Ihr Vertragspartner/.test(await text(page)) && /Mängelhaftungsrecht/.test(await text(page)), 'Anbieter und Pflichtinformationen vor der Bestellung zugänglich');
await btn.click();
check(await page.locator('.bl-error').count() === 1 && !st.calls.some(c => c.path === '/api/billing/checkout'), 'ohne Name und Häkchen kein Absenden');
await page.fill('#bl-name', 'Prüf Person');
await page.selectOption('#bl-country', 'AT');
await page.check('input[name="acceptTerms"]');
await page.check('input[name="ageConfirmed18"]');
await btn.click();
check(/Privatpersonen/.test(await page.locator('.bl-error').innerText()) && !st.calls.some(c => c.path === '/api/billing/checkout'), 'Ausland: ohne „als Privatperson" kein Absenden');
await page.selectOption('#bl-country', 'XX');
check(await btn.isDisabled() && /nicht verkaufen/.test(await text(page)), 'Land außerhalb der EU: Hinweis, Knopf gesperrt');
await page.selectOption('#bl-country', 'DE');
await page.uncheck('input[name="acceptTerms"]');
await btn.click();
check(/AGB/.test(await page.locator('.bl-error').innerText()), 'ohne AGB-Häkchen kein Absenden');
await page.check('input[name="acceptTerms"]');
await page.uncheck('input[name="ageConfirmed18"]');
await btn.click();
check(/Volljährige/.test(await page.locator('.bl-error').innerText()), 'ohne Häkchen „18" kein Absenden');
await page.check('input[name="ageConfirmed18"]');
await axe(page, '/kauf (Bestellübersicht)');
await shot(page, 'bestelluebersicht-1440');
await page.evaluate(() => { const b = document.querySelector('[data-order-button]'); b.click(); b.click(); });
await page.waitForURL(/\/kauf\/danke\?order=/, { timeout: 10000 });
const posts = st.calls.filter(c => c.path === '/api/billing/checkout');
check(posts.length === 1, 'Doppelklick erzeugt genau eine Bestellung', `${posts.length}`);
check(posts[0]?.body.country === 'DE' && posts[0]?.body.billingName === 'Prüf Person' && posts[0]?.body.acceptTerms === true && posts[0]?.body.ageConfirmed18 === true && posts[0]?.body.sku === 'pass90', 'Bestellung: sku, Land, Name, acceptTerms, ageConfirmed18');
ev = await events(page);
const leak = JSON.stringify(ev);
check(!leak.includes(EMAIL) && !leak.includes('Prüf Person'), 'keine personenbezogenen Daten in Ereignissen');

// ── 5. Danke-Seite ──────────────────────────────────────────────────────────
step('Danke-Seite');
await page.waitForSelector('[data-order-status="open"]', { timeout: 8000 });
check(/noch nicht bestätigt/.test(await text(page)), 'Zustand offen: klarer nächster Schritt');
st.orders[0].status = 'paid';
st.orders[0].invoiceNo = 'RE-2026-0001';
st.user.plan = passPlan(90);
await page.waitForSelector('[data-order-status="paid"]', { timeout: 8000 });
body = await text(page);
check(/Dein Pass ist aktiv/.test(body) && /Rechnung/.test(body), 'Zustand bezahlt: aktiv, Hinweis auf Mail mit Rechnung');
check((await events(page)).some(([e]) => e === 'paid_view'), 'Ereignis paid_view');
await page.waitForSelector('[data-import-local]', { timeout: 5000 });
check(true, 'Onboarding: „Lokale Profile ins Konto übernehmen"');
await axe(page, '/kauf/danke (bezahlt)');
await shot(page, 'danke-1440');
const before = st.resumes.length;
await page.locator('[data-import-local] button', { hasText: /übernehmen/ }).click();
await page.waitForSelector('[data-import-local] .bl-ok', { timeout: 10000 });
check(st.resumes.length > before, 'Profile am Server angelegt', `${st.resumes.length - before}`);
check(!JSON.stringify(st.resumes).includes('data:image'), 'Fotos vorher hochgeladen (keine data:-URL im Profil)');

for (const [status, re] of [['failed', /fehlgeschlagen/], ['canceled', /abgebrochen/], ['expired', /abgelaufen/]]) {
  st.orders.push({ id: `ord_${status}`, orderNo: `CV-T-${status}`, status, createdAt: new Date().toISOString(), amountCents: 900, invoiceNo: null, withdrawableUntil: null, refund: null });
  await page.goto(`${BASE}/kauf/danke?order=ord_${status}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-order-status="${status}"]`);
  body = await text(page);
  check(re.test(body) && /nichts abgebucht/.test(body) && await page.locator('button', { hasText: 'Noch einmal versuchen' }).count() === 1, `Zustand ${status}: Erklärung und „Noch einmal versuchen"`);
}
await page.goto(`${BASE}/kauf/danke?order=gibtsnicht`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
check(/keine Bestellung/.test(await text(page)), 'unbekannte Bestellung: Hinweis auf „Mein Pass"');

// ── 6. Mein Pass ────────────────────────────────────────────────────────────
step('Mein Pass');
await page.goto(`${BASE}/?pass=1`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-my-pass]', { timeout: 15000 });
let mp = await page.locator('[data-my-pass]').innerText();
check(/aktiv bis/.test(mp) && /noch 90 Tage/.test(mp), 'Status: Pass, bis wann, Resttage', mp.split('\n')[1]);
check(await page.locator(`[data-order="B-000001"] a`, { hasText: 'Rechnung' }).count() === 1, 'Bestellung mit Rechnung-PDF');
check(/Widerruf möglich bis/.test(mp), 'Widerrufsfrist sichtbar');
check(await page.locator('[data-my-pass] button', { hasText: 'Pass verlängern' }).count() === 1, '„Pass verlängern"');
await page.locator('[data-order="B-000001"] button', { hasText: 'Vertrag widerrufen' }).click();
check(await page.locator('[data-order="B-000001"] button', { hasText: 'Widerruf bestätigen' }).count() === 1, 'Bestätigungsstufe „Widerruf bestätigen"');
check(st.withdrawals.length === 0, 'erster Klick widerruft noch nicht');
await axe(page, 'Mein Pass');
await shot(page, 'mein-pass-1440');
await page.locator('[data-order="B-000001"] button', { hasText: 'Widerruf bestätigen' }).click();
await page.waitForSelector('[data-withdraw-receipt]');
const rc = await page.locator('[data-withdraw-receipt]').innerText();
check(/eingegangen/.test(rc) && /\d{1,2}:\d{2} Uhr/.test(rc), 'Eingangsbestätigung mit Datum und Uhrzeit', rc.slice(0, 120));
check(st.withdrawals.length === 1 && st.withdrawals[0].where === 'account', 'Widerruf am Server (Konto)');
check((await events(page)).some(([e, d]) => e === 'withdraw_done' && d.where === 'account'), 'Ereignis withdraw_done (account)');
await page.keyboard.press('Escape');

// Bänder
st.user.plan = { kind: 'none', until: null, daysLeft: null, notice: null };
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
let band = page.locator('.ui-access-banner[data-notice="none-none"]');
check(await band.count() === 1 && await band.locator('button', { hasText: 'Pass holen' }).count() === 1, 'Band „noch kein Pass" mit „Pass holen"');
st.user.plan = { ...passPlan(10), notice: 'soon' };
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
band = page.locator('.ui-access-banner[data-notice="pass-soon"]');
check(await band.count() === 1 && await band.locator('button', { hasText: 'Pass verlängern' }).count() === 1, 'Band „Pass läuft bald ab" mit „Pass verlängern"');
// So meldet pdf-service/access.js einen abgelaufenen Pass: kind 'none' mit Datum.
st.user.plan = { kind: 'none', until: new Date(Date.now() - 86_400_000).toISOString(), daysLeft: 0, notice: 'expired' };
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
band = page.locator('.ui-access-banner[data-notice="none-expired"]');
check(await band.count() === 1 && /abgelaufen/.test(await band.innerText()) && await band.locator('button', { hasText: 'Pass verlängern' }).count() === 1, 'Band „Pass abgelaufen" mit „Pass verlängern"');
body = await text(page);
check(/neuen Pass/.test(body) && /Nur lesen|neuen Pass/.test(body), 'Nur-Lesen: Hinweis nennt den neuen Pass');
st.user.plan = passPlan(90);
await page.context().close();

// ── 7. Öffentlicher Widerruf und Kündigung ──────────────────────────────────
step('Öffentlicher Widerruf');
const savedUser = st.user;
st.user = null;
st.orderEmail = EMAIL;
st.orders.push({ id: 'ord_pub', orderNo: 'B-000099', status: 'paid', createdAt: new Date().toISOString(), amountCents: 900, invoiceNo: 'RE-2026-0099', withdrawableUntil: new Date(Date.now() + 10 * 86_400_000).toISOString(), refund: null });
page = await newPage();
await page.goto(`${BASE}/widerruf`, { waitUntil: 'networkidle' });
await page.waitForSelector('#wd-name');
await axe(page, '/widerruf');
const mf = await page.locator('[data-model-form]').innerText();
check(/Muster-Widerrufsformular/.test(mf) && /Your Name/.test(mf) && /Example City/.test(mf), 'Muster-Widerrufsformular mit Anbieter');
check(!/\{\{/.test(mf), 'Muster-Formular ohne offene Platzhalter');
const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('button', { hasText: 'Als Textdatei herunterladen' }).click()]);
check(/\.txt$/.test(dl.suggestedFilename()), 'Muster-Formular als Textdatei', dl.suggestedFilename());
await page.click('[data-withdraw-start]');
check(/Name und E-Mail-Adresse/.test(await page.locator('.bl-error').innerText()), 'ohne Name und E-Mail kein Weiter');
await page.fill('#wd-name', 'Prüf Person');
await page.fill('#wd-email', EMAIL);
await solveAltcha(page);
await page.click('[data-withdraw-start]');
await page.waitForSelector('[data-withdraw-step="2"]');
check(await page.locator('[data-withdraw-confirm]').innerText() === 'Widerruf bestätigen', 'Schritt 2: „Widerruf bestätigen"');
check(/Zuordnung über die E-Mail-Adresse/.test(await page.locator('[data-withdraw-review]').innerText()), 'Bestellnummer freiwillig: Zuordnung über die Adresse');
check(st.withdrawals.length === 1, 'erster Schritt widerruft noch nicht');
await shot(page, 'widerruf-1440');
await page.click('[data-withdraw-confirm]');
await page.waitForSelector('[data-withdraw-step="3"]');
const pr = await page.locator('[data-withdraw-receipt]').innerText();
/* Seit 09.10.2026 (Befund M1): Bestätigungslink an die Adresse der Bestellung,
 * die Seite nennt die eingegebene Adresse nicht (keine Auskunft, ob sie passt). */
check(/\d{1,2}:\d{2} Uhr/.test(pr) && /Bestätigungslink an die E-Mail-Adresse der Bestellung/.test(pr) && /Mein Pass/.test(pr) && !pr.includes(EMAIL), 'Eingangsbestätigung mit Datum, Uhrzeit und Bestätigungslink (ohne eingegebene Adresse)', pr.slice(0, 200));
check(st.withdrawals.some(w => w.where === 'public' && w.matched), 'Widerruf am Server (öffentlich, zugeordnet)');
check((await events(page)).some(([e, d]) => e === 'withdraw_done' && d.where === 'public'), 'Ereignis withdraw_done (public)');
check(!JSON.stringify(await events(page)).includes(EMAIL), 'keine E-Mail-Adresse in Ereignissen');

step('Kündigung (§ 312k BGB)');
await page.goto(`${BASE}/kuendigen`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-cancel-form]');
await axe(page, '/kuendigen');
check(await page.locator('[data-cancel-confirm]').innerText() === 'jetzt kündigen', 'Knopf genau „jetzt kündigen"');
await page.check('input[name="cancel-kind"] >> nth=1');
await page.fill('#cn-name', 'Prüf Person');
await page.fill('#cn-email', EMAIL);
await solveAltcha(page);
await page.click('[data-cancel-confirm]');
check(/Grund/.test(await page.locator('.bl-error').innerText()) && !(st.cancellations || []).length, 'außerordentlich ohne Grund: kein Absenden');
await page.check('input[name="cancel-kind"] >> nth=0');
await page.click('[data-cancel-confirm]');
await page.waitForSelector('[data-cancel-done]');
const cr = await page.locator('[data-cancel-receipt]').innerText();
check(/\d{1,2}:\d{2} Uhr/.test(cr) && /Ordentliche Kündigung/.test(cr) && /Bestätigungslink an die E-Mail-Adresse der Bestellung/.test(cr) && !cr.includes(EMAIL), 'Kündigung ohne Anmeldung: Datum, Uhrzeit, Art, Bestätigungslink (ohne eingegebene Adresse)', cr.slice(0, 200));
check(/Speichern|Drucken/.test(await text(page)), 'Hinweis zum Speichern der Erklärung (§ 312k Abs. 3)');
check((st.cancellations || []).some(c => c.where === 'public' && c.body.when === 'now'), 'Kündigung am Server (öffentlich)');
await shot(page, 'kuendigen-1440');
await page.context().close();
st.user = savedUser;
st.orders.push({ id: 'ord_run', orderNo: 'B-000100', status: 'paid', createdAt: new Date().toISOString(), amountCents: 900, invoiceNo: 'RE-2026-0100', withdrawableUntil: new Date(Date.now() + 12 * 86_400_000).toISOString(), refund: null });
page = await newPage();
await page.goto(`${BASE}/kuendigen`, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-cancel-form]');
check(await page.locator('#cn-name').count() === 0, 'mit Konto: keine Namens- und Adressfelder');
check(/widerrufen/.test(await text(page)), 'mit Konto innerhalb der Frist: Hinweis auf den günstigeren Widerruf');
await page.click('[data-cancel-confirm]');
await page.waitForSelector('[data-cancel-done]');
check((st.cancellations || []).some(c => c.where === 'account'), 'Kündigung am Server (Konto)');
check((await page.locator('[data-cancel-receipt]').innerText()).includes(st.user?.email || '@'), 'mit Konto: sofort wirksam, Bestätigung an die Kontoadresse');
await page.context().close();
st.user = null;

// ── 7b. Bestätigungslink (/widerruf/bestaetigen, /kuendigen/bestaetigen) ─────
step('Bestätigungslink öffentlicher Erklärungen');
{
  const TOKEN = 'T'.repeat(43);
  const cases = [
    ['/widerruf/bestaetigen', 200, { ok: true, kind: 'withdraw', orderNo: 'B-000099', receivedAt: '2026-10-09T09:12:00Z', effectiveAt: '2026-10-09T09:12:00Z', refund: { status: 'requested' } }, 'done', /Widerruf ist bestätigt[\s\S]*B-000099[\s\S]*11:12 Uhr[\s\S]*Erstattung/],
    ['/kuendigen/bestaetigen', 200, { ok: true, kind: 'cancel', orderNo: 'B-000100', receivedAt: '2026-10-09T09:12:00Z', effectiveAt: '2026-10-20T00:00:00Z', orderNos: ['B-000100'] }, 'done', /Kündigung ist bestätigt[\s\S]*B-000100[\s\S]*endet am 20\. Oktober 2026/],
    ['/widerruf/bestaetigen', 409, { error: 'x', code: 'token_used', kind: 'withdraw', orderNo: 'B-000099', receivedAt: '2026-10-09T09:12:00Z' }, 'used', /schon bestätigt[\s\S]*11:12 Uhr/],
    ['/kuendigen/bestaetigen', 410, { error: 'x', code: 'token_expired', kind: 'cancel', receivedAt: '2026-10-01T09:12:00Z' }, 'expired', /abgelaufen[\s\S]*trotzdem bei uns eingegangen[\s\S]*Kündigung noch einmal abschicken/],
    ['/widerruf/bestaetigen', 409, { error: 'x', code: 'not_withdrawable', kind: 'withdraw' }, 'manual', /nicht automatisch erledigen/],
    ['/widerruf/bestaetigen', 400, { error: 'x', code: 'token_invalid' }, 'invalid', /ungültig[\s\S]*Widerruf noch einmal abschicken/],
  ];
  for (const [path, status, body, want, re] of cases) {
    page = await newPage();
    const posts = [];
    await page.route('**/api/billing/declarations/confirm', r => { posts.push(r.request().postDataJSON()); return r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); });
    await page.goto(`${BASE}${path}?token=${TOKEN}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-declaration-state="ready"]');
    check(!new URL(page.url()).search.includes(TOKEN), `${path}: Schlüssel sofort aus der Adresszeile`);
    check(posts.length === 0, `${path}: nichts ausgeführt ohne Klick (Mail-Scanner)`);
    if (want === 'done' && status === 200 && path.startsWith('/kuendigen')) {
      check(await page.locator('[data-declaration-confirm]').innerText() === 'jetzt kündigen', '/kuendigen/bestaetigen: Knopf „jetzt kündigen"');
      await axe(page, path);
    }
    if (want === 'done' && path.startsWith('/widerruf')) check(await page.locator('[data-declaration-confirm]').innerText() === 'Widerruf bestätigen', '/widerruf/bestaetigen: Knopf „Widerruf bestätigen"');
    await page.click('[data-declaration-confirm]');
    await page.waitForSelector(`[data-declaration-state="${want}"]`);
    check(posts.length === 1 && posts[0]?.token === TOKEN, `${path} ${want}: ein POST mit dem Schlüssel im Körper`);
    const tx = await text(page);
    check(re.test(tx), `${path} → ${want}: richtige Meldung`, tx.replace(/\s+/g, ' ').slice(0, 200));
    if (want === 'done') await axe(page, `${path} bestätigt`);
    await page.context().close();
  }
  page = await newPage({ width: 390, height: 844 });
  await page.goto(`${BASE}/widerruf/bestaetigen`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-declaration-state="invalid"]');
  check(/ungültig/.test(await text(page)), 'ohne Schlüssel: „ungültig", kein Knopf');
  await noOverflow(page, 'Bestätigungsseite @390');
  await page.context().close();
}
page = await newPage();

// Rechtstexte
for (const p of ['/agb', '/widerrufsbelehrung', '/datenschutz', '/impressum']) {
  await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const tx = await text(page);
  check(!/\{\{/.test(tx), `${p}: keine offenen Platzhalter`);
  check(await page.locator('footer a[href="/widerruf"]').count() === 1 && await page.locator('footer a[href="/kuendigen"]').count() === 1, `${p}: Fußzeile mit „Vertrag widerrufen" und „Verträge hier kündigen"`);
  check(!/Telefon: ,|Telefon \{|Phone: ,/.test(tx), `${p}: keine leere Telefonangabe`);
  if (p === '/agb') check(/Allgemeine Geschäftsbedingungen/.test(tx) && /§ 1 Geltungsbereich/.test(tx), '/agb: Text aus legal/agb.ts');
  if (p === '/widerrufsbelehrung') {
    check(/Sie haben das Recht, binnen vierzehn Tagen/.test(tx) && /Ende der Widerrufsbelehrung/.test(tx) && /Muster-Widerrufsformular/.test(tx), '/widerrufsbelehrung: Mustertext, Ende-Marke, Formular');
    const order = await page.evaluate(() => { const b = document.body.innerText; return [b.indexOf('Ende der Widerrufsbelehrung'), b.indexOf('Über das Gesetz hinaus')]; });
    check(order[0] > 0 && order[1] > order[0], '„Über das Gesetz hinaus" steht außerhalb der Belehrung');
  }
  if (p === '/datenschutz') {
    check(await page.locator('[data-privacy-billing]').count() === 1 && /Mollie/.test(tx) && /ALTCHA/.test(tx), '/datenschutz: Abschnitte aus legal/datenschutzBezahlung.ts (Mollie, ALTCHA)');
    check(!/Konten gibt es derzeit nur mit Einladung/.test(tx), '/datenschutz: kein „nur mit Einladung" bei offener Registrierung');
  }
}
await page.goto(`${BASE}/email-bestaetigen?token=gut-token-123`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
check(/bestätigt/.test(await text(page)) && !page.url().includes('token='), 'Bestätigungslink: bestätigt, Schlüssel aus der Adresse entfernt');
await page.goto(`${BASE}/email-bestaetigen?token=falsch-falsch-1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
check(/ungültig oder abgelaufen/.test(await text(page)), 'falscher Bestätigungslink: Meldung');
await page.context().close();
st.user = savedUser;

// ── 8. Sprachen ─────────────────────────────────────────────────────────────
step('Sprachprüfung der neuen Seiten');
/* „zahlungspflichtig bestellen" bleibt in jeder Sprache stehen (§ 312j Abs. 3
   BGB, wie die englische Fassung von legal/bestellung.ts); die Übersetzung
   steht im Hinweis daneben. */
const GERMAN = /einmalig|Bewerbungs-Pass|Ohne Konto|Konto anlegen|Widerruf bestätigen|Weiter ohne Konto|Pass holen|Bestellung prüfen|Verträge hier kündigen|jetzt kündigen|Ihre Bestellung/;
const MARK = { en: /one-off|Application Pass/, fr: /en une fois|Pass candidature/, es: /pago único|Pase de candidatura/ };
for (const l of ['en', 'fr', 'es']) {
  st.user = null;
  page = await newPage({ width: 1440, height: 900 }, l);
  for (const p of ['/preise', '/kauf', '/widerruf', '/kuendigen']) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const tx = (await text(page)).replace(/CV-Hub|Your Name|Muster-Widerrufsformular|Example Street 1|Example City|Deutschland|Germany/g, '');
    const de = tx.match(GERMAN);
    check(!de, `${l} ${p}: kein deutscher Text`, de ? `„${de[0]}"` : '');
    if (p === '/preise') check(MARK[l].test(tx), `${l} ${p}: übersetzt`);
    check(await page.evaluate(() => document.querySelector('.bl-page')?.getAttribute('lang')) === l, `${l} ${p}: lang-Attribut`);
  }
  // Bestellübersicht in der Sprache
  st.user = savedUser;
  await page.goto(`${BASE}/kauf`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-order-button]');
  const bt = (await page.locator('[data-order-button]').innerText()).trim();
  check(!GERMAN.test(await page.locator('form').innerText()), `${l} /kauf Bestellübersicht: kein deutscher Text`, bt);
  await page.context().close();
}
st.user = savedUser;

// ── 9. Telefon ──────────────────────────────────────────────────────────────
step('Telefon (390 und 320 px)');
for (const w of [390, 320]) {
  page = await newPage({ width: w, height: 844 });
  const tag = w === 390 ? '390' : null;
  for (const [p, name, sel] of [['/', 'start', '#preise'], ['/preise', 'preise', '.bl-card-accent'], ['/kuendigen', 'kuendigen', '[data-cancel-form]'], ['/kauf', 'bestelluebersicht', '[data-order-button]'], ['/kauf/danke?order=ord_1', 'danke', '[data-order-status]'], ['/widerruf', 'widerruf', '#wd-name']]) {
    st.orders[0].status = 'paid';
    st.user = p === '/' ? null : savedUser;
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(sel, { timeout: 10000 });
    await page.waitForTimeout(400);
    await noOverflow(page, `${p} @${w}`);
    if (tag) { await axe(page, `${p} @390`); if (name !== 'start') await shot(page, `${name}-390`); }
  }
  st.user = savedUser;
  await page.goto(`${BASE}/?pass=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-my-pass]', { timeout: 15000 });
  await page.waitForTimeout(500);
  await noOverflow(page, `Mein Pass @${w}`);
  if (tag) await shot(page, 'mein-pass-390');
  await page.context().close();
  // Freischalt-Paneel in der Demo
  st.user = null;
  page = await newPage({ width: w, height: 844 });
  await page.goto(`${BASE}/?demo=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('header button[aria-haspopup="dialog"]').last().click();
  await page.waitForTimeout(300);
  await page.locator('button:visible', { hasText: 'Konto anlegen' }).first().click();
  await page.waitForSelector('[data-unlock]');
  await page.waitForTimeout(300);
  await noOverflow(page, `Freischalt-Paneel @${w}`);
  const bb = await page.locator('.bl-dialog').boundingBox();
  check(bb && bb.x >= 0 && bb.x + bb.width <= w, `Freischalt-Paneel passt in ${w} px`);
  if (tag) { await axe(page, 'Freischalt-Paneel @390'); await shot(page, 'freischalt-390'); }
  await page.context().close();
  st.user = savedUser;
}

check(errors.length === 0, 'keine Seitenfehler', errors.slice(0, 3).join(' | '));
await browser.close();
const bad = results.filter(x => !x).length;
console.log(`\n${results.length - bad}/${results.length} bestanden`);
process.exit(bad ? 1 : 0);
