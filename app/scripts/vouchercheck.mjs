// Zugangscodes (Gutscheine, 09.10.2026) einmal ganz durchgeklickt.
//
//   Fall 14  Einlösen in „Mein Pass" und auf /code nur mit der Tastatur, am
//            Schreibtisch (1440) und auf dem Telefon (390), bis der Status
//            sichtbar aktualisiert ist — ohne Neuanmeldung (Band im Werkzeug
//            verschwindet, „Mein Pass" zeigt die neue Laufzeit).
//   Fall 20  Neuer Besucher: Code eingeben → Konto erstellen (echtes ALTCHA) →
//            Bestätigungslink → zurück auf /code → „Code einlösen", ohne den
//            Code erneut einzutippen; vorher kein Platz verbraucht. Bei
//            geschlossener Registrierung ein verständlicher Hinweis.
//   dazu     alle Fehlertexte (4 Sprachen für „ungültig"), dauerhafter
//            Gratiszugang ohne Kaufaufforderung (Mein Pass, Band, /kauf, /code),
//            abgelaufener Gratiszugang (Nur-Lesen + „90 Tage für 9 €
//            freischalten" + Export-Hinweis), Link auf /preise, Verwaltung:
//            persönlich / öffentlich / öffentlich dauerhaft / ohne Limit,
//            Zusammenfassungssatz, Deaktivieren mit Erklärung, Aktionshinweis
//            kopierbar, Kennzahlen getrennt vom Umsatz. axe auf allen neuen
//            Zuständen, kein waagerechtes Scrollen auf 390 px, kein Code in
//            Analytics oder in einer Adresse.
//
// Standard: Endpunkte aus scripts/_vouchermock.mjs (page.route), es braucht
// nur einen laufenden Vite. Gegen den echten Dienst: VOUCHER_LIVE=1, Vite mit
// Proxy auf cv-api, ADMIN_USER/ADMIN_PASS, MAIL_CAPTURE_FILE (siehe unten).
//
//   HARNESS_BASE=http://localhost:5221 SHOTS=/ordner node scripts/vouchercheck.mjs
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { installVoucherMock, addVoucher, createVoucherState } from './_vouchermock.mjs';
import { createBillingState } from './_billingmock.mjs';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5221';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const LIVE = process.env.VOUCHER_LIVE === '1';
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const D = 86_400_000;

const results = [];
const check = (ok, label, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
const step = t => console.log(`\n— ${t}`);
const errors = [];
const seenUrls = [];
const browser = await chromium.launch({ executablePath: EXEC });
const isoIn = days => new Date(Date.now() + days * D).toISOString();
const dateIn = days => isoIn(days).slice(0, 10);

/** Alle Codes, die im Lauf vorkommen — keiner darf in Analytics oder einer Adresse stehen. */
const CODES = new Set();
const remember = c => { CODES.add(c.replace(/[\s-]/g, '').toUpperCase()); return c; };

async function newPage(state, { viewport = { width: 1440, height: 900 }, lang = 'de', ctx = null } = {}) {
  const context = ctx ?? await browser.newContext({ viewport, locale: lang === 'de' ? 'de-DE' : lang });
  if (!ctx) {
    await context.addInitScript(([l]) => {
      window.__ev = [];
      window.umami = { track: (e, d) => window.__ev.push([e, d || {}]) };
      try { if (!localStorage.getItem('appstudio-ui-lang')) localStorage.setItem('appstudio-ui-lang', l); } catch { /* */ }
    }, [lang]);
    await context.route('**/analytics.example.com/**', r => r.abort());
    // Optionales Umami über /u/ auf derselben Domain (nginx.conf).
    await context.route(/\/u\/(script\.js|api\/send)(\?|$)/, r => r.abort());
  }
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  page.on('request', r => seenUrls.push(r.url()));
  if (!LIVE) await installVoucherMock(page, state);
  return page;
}
const text = page => page.evaluate(() => document.body.innerText);
const shot = async (page, name) => {
  if (!SHOTS) return;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};
/** Admin-Panel ganz aufs Foto: Fenster aus dem festen Rahmen lösen. */
async function adminShot(page, name) {
  if (!SHOTS) return;
  await page.evaluate(() => {
    const bd = document.querySelector('[data-modal-backdrop]'); const m = document.querySelector('[data-modal]');
    if (bd) { bd.style.position = 'absolute'; bd.style.alignItems = 'flex-start'; bd.style.minHeight = '100%'; bd.style.height = 'auto'; }
    if (m) m.style.maxHeight = 'none';
  });
  await shot(page, name);
  await page.evaluate(() => {
    const bd = document.querySelector('[data-modal-backdrop]'); const m = document.querySelector('[data-modal]');
    if (bd) { bd.style.position = 'fixed'; bd.style.alignItems = 'center'; bd.style.height = ''; }
    if (m) m.style.maxHeight = '88vh';
  });
}
async function axe(page, name) {
  await page.evaluate(AXE);
  const r = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations
    .map(v => ({ ...v, nodes: v.id === 'target-size' ? v.nodes.filter(n => !n.target.join(' ').includes('cv-edit')) : v.nodes }))
    .filter(v => v.nodes.length)
    .map(v => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 3).map(n => n.target.join(' ')) })));
  check(r.length === 0, `axe: ${name}`, r.length ? JSON.stringify(r).slice(0, 500) : '0 Verstöße');
}
async function noOverflow(page, name) {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  check(sw <= iw, `kein waagerechtes Scrollen: ${name}`, `${sw}/${iw}`);
}
/** Mit Tab bis zu einem Element; true, wenn es den Fokus bekommt. */
async function tabTo(page, predicate, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(predicate)) return true;
  }
  return false;
}
async function solveAltcha(page) {
  const box = page.locator('altcha-widget input[type="checkbox"]').first();
  await box.waitFor({ timeout: 10000 });
  await box.click({ force: true });
  await page.waitForFunction(() => {
    const inp = document.querySelector('altcha-widget input[name="altcha"]');
    return !!(inp && inp.value);
  }, null, { timeout: 20000 });
}
function userWith(plan, extra = {}) {
  return { id: Math.floor(Math.random() * 1e6), username: `nutzer${Math.floor(Math.random() * 1e4)}`, email: 'pruefung@example.org', role: 'user', createdAt: new Date().toISOString(), emailConfirmed: true, plan, ...extra };
}
const PLAN_NONE = () => ({ kind: 'none', until: null, daysLeft: null, notice: null, grants: [], hasPaid: false });
function freshState(over = {}) {
  const st = createVoucherState(createBillingState());
  st.offer.openRegistration = true;
  Object.assign(st, over);
  return st;
}
/** „Mein Pass" öffnen (/?pass=1); falls das Fenster nicht von selbst aufgeht,
 *  über den Knopf auf der Startseite. */
async function openPass(page) {
  await page.goto(`${BASE}/?pass=1`, { waitUntil: 'networkidle' });
  try { await page.waitForSelector('[data-my-pass]', { timeout: 5000 }); }
  catch { await page.getByRole('button', { name: 'Mein Pass' }).first().click(); await page.waitForSelector('[data-my-pass]'); }
}
const pendingStored = page => page.evaluate(() => { try { return localStorage.getItem('cv-pending-code'); } catch { return 'ERR'; } });

if (LIVE) {
  console.log('VOUCHER_LIVE=1 → scripts/voucherlive.mjs (eigener Ablauf gegen cv-api).');
  await browser.close();
  const { run } = await import('./voucherlive.mjs');
  process.exit(await run());
}

// ── Fall 14: „Mein Pass", nur Tastatur, 1440 und 390 ────────────────────────
for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
  step(`Fall 14 · Mein Pass · Tastatur · ${tag}`);
  const st = freshState();
  addVoucher(st, { name: 'Herbst', code: remember('HERBST30'), kind: 'days', days: 30, maxRedemptions: 100, redeemUntil: dateIn(20) });
  st.user = userWith(PLAN_NONE());
  const page = await newPage(st, { viewport: { width: w, height: h } });
  await page.goto(`${BASE}/?pass=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-my-pass] [data-voucher-form]', { timeout: 10000 });
  const bandBefore = await page.locator('.ui-access-banner').count();
  check(bandBefore === 1, 'vorher: Band „noch kein Pass" im Werkzeug');
  const reached = await tabTo(page, () => document.activeElement?.id === 'bl-mp-code');
  check(reached, 'Codefeld per Tab erreichbar');
  await page.keyboard.type('herbst 30');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-voucher-msg="ok"]', { timeout: 8000 });
  const ok = await page.locator('[data-voucher-msg="ok"]').innerText();
  check(/Dein Gratiszugang ist bis .+ aktiv\. Danach endet er automatisch\. Es wird nichts abgebucht\./.test(ok), 'Erfolgstext (Auftrag, wörtlich)', ok);
  check(await page.locator('#bl-mp-code-msg[role="status"][aria-live="polite"]').count() === 1, 'Ergebnis als Screenreader-Status');
  await page.waitForFunction(() => document.querySelector('[data-plan]')?.getAttribute('data-plan') === 'pass');
  const line = await page.locator('[data-plan]').innerText();
  check(/Gratiszugang aktiv bis/.test(line), 'Mein Pass: Status sofort aktualisiert', line);
  check(await page.locator('[data-grant="voucher"]').count() === 1, 'Herkunft: Gutschein');
  check(await page.locator('[data-cancel-link]').count() === 0, 'kein „Pass kündigen" bei reinem Gratiszugang');
  check(!/verlängern/i.test(await page.locator('[data-my-pass]').innerText()), 'kein „Pass verlängern" bei reinem Gratiszugang');
  await axe(page, `Mein Pass nach Einlösung (${tag})`);
  if (w === 390) await noOverflow(page, 'Mein Pass 390');
  await shot(page, `mein-pass-gutschein-${tag}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const bandAfter = await page.locator('.ui-access-banner').count();
  check(bandAfter === 0, 'nachher: Band im Werkzeug weg, ohne Neuanmeldung', `${bandBefore} → ${bandAfter}`);
  check(st.vouchers[0].redemptions === 1, 'genau eine Einlösung am Server');
  await page.context().close();
}

// ── Fall 14 auf /code: angemeldet, nur Tastatur ─────────────────────────────
for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
  step(`Fall 14 · /code angemeldet · Tastatur · ${tag}`);
  const st = freshState();
  addVoucher(st, { name: 'LinkedIn', code: remember('LINKEDIN30'), kind: 'days', days: 30, maxRedemptions: 100, redeemUntil: dateIn(20), campaign: 'Herbst 2026' });
  st.user = userWith(PLAN_NONE());
  const page = await newPage(st, { viewport: { width: w, height: h } });
  await page.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#bl-code');
  await axe(page, `/code leer (${tag})`);
  if (w === 390) await noOverflow(page, '/code leer 390');
  await shot(page, `code-leer-${tag}`);
  check(await tabTo(page, () => document.activeElement?.id === 'bl-code'), 'Codefeld per Tab erreichbar');
  await page.keyboard.type('linkedin-30');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-voucher-preview]');
  const terms = await page.locator('[data-voucher-preview]').innerText();
  check(/30 Tage Bewerbungs-Pass kostenlos/.test(terms) && /Einlösbar bis/.test(terms) && /Für die ersten 100 erfolgreichen Einlösungen/.test(terms), 'Bedingungen: Zugang, Frist, Begrenzung', terms.split('\n').slice(0, 4).join(' | '));
  check(!/noch \d+|nur noch|übrig|verbleibend/i.test(terms), 'keine Restplätze, kein Zeitdruck');
  check(!/Monat/i.test(terms), '„30 Tage", nicht „ein Monat"');
  check(st.vouchers[0].redemptions === 0, 'Vorschau verbraucht keinen Platz');
  check(await page.evaluate(() => document.activeElement?.id === 'bl-code-terms-h'), 'Fokus springt auf die Bedingungen');
  await axe(page, `/code Vorschau angemeldet (${tag})`);
  if (w === 390) await noOverflow(page, '/code Vorschau 390');
  await shot(page, `code-vorschau-angemeldet-${tag}`);
  check(await tabTo(page, () => document.activeElement?.hasAttribute('data-redeem')), '„Code einlösen" per Tab erreichbar');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-voucher-ok]');
  const okText = await page.locator('[data-voucher-ok]').innerText();
  check(/Dein Gratiszugang ist bis .+ aktiv\. Danach endet er automatisch\. Es wird nichts abgebucht\./.test(okText), 'Erfolg auf /code', okText);
  check(await page.evaluate(() => document.activeElement?.id === 'bl-code-done-h'), 'Fokus auf der Erfolgsmeldung');
  check(await pendingStored(page) === null, 'gemerkter Code gelöscht');
  await axe(page, `/code Erfolg (${tag})`);
  if (w === 390) await noOverflow(page, '/code Erfolg 390');
  await shot(page, `code-erfolg-${tag}`);
  // Zweiter Code derselben Kampagne → abgelehnt
  addVoucher(st, { name: 'Newsletter', code: remember('NEWS30'), kind: 'days', days: 30, maxRedemptions: 100, redeemUntil: dateIn(20), campaign: 'Herbst 2026' });
  await page.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
  await page.fill('#bl-code', 'NEWS30');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-voucher-error]');
  check(/aus derselben Aktion/.test(await page.locator('[data-voucher-error]').innerText()), 'Kampagne: je Konto einmal');
  // „Mein Pass" über den Erfolgs-Knopf zeigt den neuen Stand
  await page.context().close();
}

// ── Fall 20: neuer Besucher, Registrierung, Bestätigung, zurück, einlösen ──
for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
  step(`Fall 20 · neuer Besucher · ${tag}`);
  const st = freshState();
  const CODE = remember('START30');
  addVoucher(st, { name: 'Start', code: CODE, kind: 'days', days: 30, maxRedemptions: 100, redeemUntil: dateIn(20) });
  const page = await newPage(st, { viewport: { width: w, height: h } });
  await page.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
  await page.fill('#bl-code', 'start30');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-voucher-account]');
  const t1 = await page.locator('[data-voucher-preview]').innerText();
  check(/Konto mit bestätigter E-Mail-Adresse/.test(t1) && /24 Stunden/.test(t1), 'Gast: Hinweis Konto + Code bleibt gemerkt');
  const stored = JSON.parse(await pendingStored(page) || '{}');
  check(stored.code === 'start30' && stored.exp > Date.now() + 23 * 3600e3 && stored.exp <= Date.now() + 24 * 3600e3 + 5000, 'cv-pending-code mit 24-h-Ablauf gespeichert');
  check(!page.url().toUpperCase().includes(CODE), 'Code nicht in der Adresse');
  await axe(page, `/code Vorschau Gast (${tag})`);
  if (w === 390) await noOverflow(page, '/code Gast 390');
  await shot(page, `code-vorschau-gast-${tag}`);
  await page.getByRole('button', { name: 'Konto erstellen' }).click();
  await page.fill('#bl-email', `neu${tag}@example.org`);
  await page.fill('#bl-pw', 'Sicheres-Passwort-1');
  await page.locator('label.bl-check', { hasText: '16' }).locator('input').check();
  await solveAltcha(page);
  await page.locator('form[aria-labelledby="bl-acc-h"] button[type="submit"]').click();
  await page.waitForSelector('[data-voucher-unconfirmed]');
  check(/Bestätige zuerst deine E-Mail-Adresse/.test(await page.locator('[data-voucher-unconfirmed]').innerText()), 'nach Registrierung: erst bestätigen');
  check(await page.locator('[data-redeem]').count() === 0, 'ohne Bestätigung kein „Code einlösen"');
  check(st.vouchers[0].redemptions === 0 && !st.voucherCalls.some(c => c.path.endsWith('/redeem')), 'vor der Einlösung kein Platz verbraucht');
  await axe(page, `/code unbestätigt (${tag})`);
  if (w === 390) await noOverflow(page, '/code unbestätigt 390');
  await shot(page, `code-unbestaetigt-${tag}`);
  // Bestätigungslink (aus der Mail) im neuen Tab
  const tab2 = await newPage(st, { ctx: page.context() });
  await tab2.goto(`${BASE}/email-bestaetigen?token=gut-token-123`, { waitUntil: 'networkidle' });
  await tab2.waitForURL(u => new URL(u).pathname === '/code', { timeout: 8000 });
  check(true, 'nach Bestätigung automatisch zurück auf /code');
  await tab2.waitForSelector('[data-redeem]', { timeout: 8000 });
  check(await tab2.inputValue('#bl-code') === 'start30', 'Code vorbefüllt, nicht erneut eingetippt');
  check(/Bitte bestätige die Einlösung/.test(await tab2.locator('[data-voucher-preview] h2').innerText()), 'Bedingungen noch einmal, mit Bestätigung');
  await shot(tab2, `code-zurueck-bestaetigt-${tag}`);
  await tab2.click('[data-redeem]');
  await tab2.waitForSelector('[data-voucher-ok]');
  check(st.vouchers[0].redemptions === 1, 'jetzt genau ein Platz verbraucht');
  check(await pendingStored(tab2) === null, 'gemerkter Code nach Einlösung gelöscht');
  const ev = JSON.stringify(await tab2.evaluate(() => window.__ev)) + JSON.stringify(await page.evaluate(() => window.__ev));
  check(!ev.toUpperCase().includes(CODE) && /voucher_redeemed/.test(ev), 'Analytics: Einlösung gezählt, ohne Code', ev.slice(0, 160));
  // Erster Tab: beim Zurückkehren wird der Bestätigungsstand neu geholt
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(400);
  check(await page.locator('[data-voucher-unconfirmed]').count() === 0, 'erster Tab: Hinweis „bestätigen" verschwindet beim Zurückkehren');
  await page.context().close();
}

step('Fall 20 · geschlossene Registrierung');
{
  const st = freshState();
  st.offer.openRegistration = false;
  addVoucher(st, { name: 'Start', code: remember('START30'), kind: 'days', days: 30, maxRedemptions: 100, redeemUntil: dateIn(20) });
  for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
    const page = await newPage(st, { viewport: { width: w, height: h } });
    await page.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
    await page.fill('#bl-code', 'START30');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-voucher-closed]');
    check(/Die öffentliche Aktion ist noch nicht gestartet\. Mit einem bestehenden Konto kannst du dich anmelden\./.test(await page.locator('[data-voucher-closed]').innerText()), `Hinweis bei geschlossener Registrierung (${tag})`);
    check(await page.getByRole('button', { name: 'Konto erstellen' }).count() === 0, 'kein „Konto erstellen"');
    check(await page.getByRole('button', { name: 'Anmelden' }).count() === 1, '„Anmelden" für bestehende Konten');
    await page.getByRole('button', { name: 'Anmelden' }).click();
    check(await page.locator('#bl-acc-h').innerText().then(t => /Anmelden|anmelden/.test(t)), 'Anmeldeformular statt Registrierung');
    check(await page.locator('#bl-email').count() === 0, 'keine offene Registrierung als Nebeneffekt');
    await axe(page, `/code geschlossen (${tag})`);
    if (w === 390) await noOverflow(page, '/code geschlossen 390');
    await shot(page, `code-geschlossen-${tag}`);
    await page.context().close();
  }
}

// ── Fehlertexte ─────────────────────────────────────────────────────────────
step('Fehlertexte');
{
  const st = freshState();
  addVoucher(st, { name: 'Abgelaufen', code: remember('ALT30'), kind: 'days', days: 30, maxRedemptions: 100, redeemUntil: dateIn(-3) });
  addVoucher(st, { name: 'Voll', code: remember('VOLL30'), kind: 'days', days: 30, maxRedemptions: 1, redeemUntil: dateIn(10), redemptions: 1 });
  addVoucher(st, { name: 'Aus', code: remember('AUS30'), kind: 'days', days: 30, maxRedemptions: 10, redeemUntil: dateIn(10), active: false });
  addVoucher(st, { name: 'Gut', code: remember('GUT30'), kind: 'days', days: 30, maxRedemptions: 10, redeemUntil: dateIn(10) });
  const expect = [
    ['FALSCH99', /Diesen Code kennen wir nicht/], ['ALT30', /Einlösefrist ist vorbei/], ['VOLL30', /ausgeschöpft/], ['AUS30', /nicht mehr aktiv/],
  ];
  for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
    const page = await newPage(st, { viewport: { width: w, height: h } });
    await page.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
    for (const [c, re] of expect) {
      await page.fill('#bl-code', c);
      await page.keyboard.press('Enter');
      await page.waitForSelector('[data-voucher-error]');
      const tx = await page.locator('[data-voucher-error]').innerText();
      if (tag === '1440') check(re.test(tx), `Fehler ${c}`, tx);
    }
    check(await page.locator('[data-voucher-error][role="alert"]').count() === 1, 'Fehler als role=alert');
    check(await page.locator('#bl-code[aria-invalid="true"]').count() === 1, 'Feld als ungültig markiert');
    await axe(page, `/code Fehler (${tag})`);
    if (w === 390) await noOverflow(page, '/code Fehler 390');
    await shot(page, `code-fehler-${tag}`);
    await page.context().close();
  }
  // leeres Feld
  {
    const page = await newPage(st);
    await page.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
    await page.click('button[type="submit"]');
    check(/Bitte gib einen Code ein/.test(await text(page)), 'leeres Feld: Hinweis');
    await page.context().close();
  }
  // bereits eingelöst (angemeldet)
  st.user = userWith(PLAN_NONE());
  {
    const page = await newPage(st);
    await openPass(page);
    await page.fill('#bl-mp-code', 'GUT30'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-voucher-msg="ok"]');
    await page.fill('#bl-mp-code', 'gut-30'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-voucher-msg="error"]');
    check(/schon eingelöst/.test(await page.locator('[data-voucher-msg="error"]').innerText()), 'Fehler: bereits eingelöst (Mein Pass)');
    check(st.vouchers.find(v => v.name === 'Gut').redemptions === 1, 'zweiter Versuch ohne zusätzlichen Zugang');
    await page.context().close();
  }
  // unbestätigt in Mein Pass
  st.user = userWith(PLAN_NONE(), { emailConfirmed: false });
  {
    const page = await newPage(st);
    await openPass(page);
    await page.fill('#bl-mp-code', 'GUT30'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-voucher-msg="error"]');
    check(/bestätige zuerst deine E-Mail-Adresse/.test(await page.locator('[data-voucher-msg="error"]').innerText()), 'Fehler: E-Mail nicht bestätigt');
    await page.context().close();
  }
  // Sprachen
  for (const [lang, re] of [['en', /We do not know this code/], ['fr', /Nous ne connaissons pas ce code/], ['es', /No conocemos este código/]]) {
    st.user = null;
    const page = await newPage(st, { lang });
    await page.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
    const h1 = await page.locator('h1').first().innerText();
    await page.fill('#bl-code', 'FALSCH99'); await page.keyboard.press('Enter');
    await page.waitForSelector('[data-voucher-error]');
    check(re.test(await page.locator('[data-voucher-error]').innerText()), `Fehler „ungültig" auf ${lang}`, h1);
    check(await page.locator(`.bl-page[lang="${lang}"]`).count() === 1, `lang-Attribut ${lang}`);
    await axe(page, `/code ${lang}`);
    await page.context().close();
  }
}

// ── Dauerhafter Gratiszugang ────────────────────────────────────────────────
step('Dauerhafter Gratiszugang: einlösen und keine Kaufaufforderung');
for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
  const st = freshState();
  addVoucher(st, { name: 'Dauer', code: remember('DAUER50'), kind: 'lifetime', days: null, maxRedemptions: 50, redeemUntil: dateIn(30) });
  addVoucher(st, { name: 'Noch einer', code: remember('NOCH30'), kind: 'days', days: 30, maxRedemptions: 50, redeemUntil: dateIn(30) });
  st.user = userWith(PLAN_NONE());
  const page = await newPage(st, { viewport: { width: w, height: h } });
  await openPass(page);
  await page.fill('#bl-mp-code', 'dauer50'); await page.keyboard.press('Enter');
  await page.waitForSelector('[data-voucher-msg="ok"]');
  check((await page.locator('[data-voucher-msg="ok"]').innerText()) === 'Dein dauerhafter Gratiszugang ist aktiv. Du musst keinen Bewerbungs-Pass kaufen.', 'Erfolgstext dauerhaft (wörtlich)');
  await page.waitForFunction(() => document.querySelector('[data-plan]')?.getAttribute('data-plan') === 'lifetime');
  check(await page.locator('[data-buy]').count() === 0, 'Mein Pass: kein Kaufknopf');
  check(await page.locator('[data-voucher-lifetime]').count() === 1, 'Mein Pass: kein Codefeld mehr, Hinweis statt dessen');
  check(!/abläuft|läuft .* ab|verlängern/i.test(await page.locator('[data-my-pass]').innerText()), 'kein „läuft ab", kein „verlängern"');
  await axe(page, `Mein Pass dauerhaft (${tag})`);
  if (w === 390) await noOverflow(page, 'Mein Pass dauerhaft 390');
  await shot(page, `mein-pass-dauerhaft-${tag}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check(await page.locator('.ui-access-banner').count() === 0, 'Werkzeug: kein Band');
  await page.goto(`${BASE}/kauf`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-checkout-lifetime]');
  check(/Du hast einen dauerhaften Gratiszugang – kein Kauf nötig/.test(await text(page)), '/kauf: „kein Kauf nötig"');
  check(await page.locator('[data-order-button]').count() === 0, '/kauf: kein Bestellknopf');
  await axe(page, `/kauf dauerhaft (${tag})`);
  await shot(page, `kauf-dauerhaft-${tag}`);
  await page.goto(`${BASE}/code`, { waitUntil: 'networkidle' });
  await page.fill('#bl-code', 'NOCH30'); await page.keyboard.press('Enter');
  await page.waitForSelector('[data-voucher-lifetime-already]');
  check(await page.locator('[data-redeem]').count() === 0, '/code: weiterer Code wird nicht angeboten');
  check(st.vouchers[1].redemptions === 0, 'dauerhaft verbraucht keinen weiteren Code');
  await axe(page, `/code bei dauerhaftem Zugang (${tag})`);
  await shot(page, `code-schon-dauerhaft-${tag}`);
  await page.context().close();
}

// ── Gratiszugang abgelaufen ────────────────────────────────────────────────
step('Gratiszugang abgelaufen: Nur-Lesen, freiwilliger Kauf, Export');
for (const sales of [true, false]) {
  const st = freshState();
  st.offer.enabled = sales;
  const until = isoIn(-2);
  st.user = userWith({ kind: 'none', until, daysLeft: 0, notice: 'expired', hasPaid: false, grants: [{ source: 'voucher', kind: 'days', days: 30, grantedAt: isoIn(-32) }] });
  const page = await newPage(st);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ui-access-banner');
  const band = await page.locator('.ui-access-banner').innerText();
  check(/Gratiszugang ist am .+ abgelaufen/.test(band) && /Lesen und Exportieren/.test(band), `Band nach Ablauf (Verkauf ${sales ? 'an' : 'aus'})`, band.slice(0, 120));
  const unlock = page.locator('.ui-access-banner button', { hasText: 'freischalten' });
  check(sales ? (await unlock.count() === 1 && /90 Tage für 9\s?€ freischalten/.test(await unlock.innerText())) : await unlock.count() === 0, sales ? '„90 Tage für 9 € freischalten" im Band' : 'ohne Verkauf kein Kaufknopf');
  await openPass(page);
  check(await page.locator('[data-export-hint]').count() === 1, 'Mein Pass: Export-Hinweis');
  check(sales ? /90 Tage für 9\s?€ freischalten/.test(await page.locator('[data-buy]').innerText()) : await page.locator('[data-buy]').count() === 0, sales ? 'Mein Pass: „90 Tage für 9 € freischalten"' : 'Mein Pass: ohne Verkauf kein Kaufknopf');
  if (sales) { await axe(page, 'Mein Pass Gratis abgelaufen'); await shot(page, 'mein-pass-gratis-abgelaufen-1440'); }
  await page.context().close();
}

// ── /preise: zurückhaltender Link ──────────────────────────────────────────
step('/preise: „Du hast einen Zugangscode?"');
{
  const st = freshState();
  const page = await newPage(st);
  await page.goto(`${BASE}/preise`, { waitUntil: 'networkidle' });
  const a = page.locator('[data-code-link]');
  check(await a.count() === 1 && await a.getAttribute('href') === '/code' && (await a.innerText()) === 'Du hast einen Zugangscode?', 'Link auf /code');
  check(!(await a.getAttribute('class')).includes('ui-btn'), 'zurückhaltend: Textlink, kein Knopf');
  await a.click();
  await page.waitForURL(u => new URL(u).pathname === '/code');
  check(true, 'Link führt auf /code');
  await page.context().close();
}

// ── Verwaltung ─────────────────────────────────────────────────────────────
for (const [w, h, tag] of [[1440, 900, '1440'], [390, 844, '390']]) {
  step(`Verwaltung · Gutscheine · ${tag}`);
  const st = freshState();
  st.user = userWith({ kind: 'unlimited', until: null, daysLeft: null, notice: null }, { role: 'admin', username: 'admin' });
  const page = await newPage(st, { viewport: { width: w, height: h } });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Admin', exact: true }).click();
  await page.locator('[data-tab="vouchers"]').click();
  await page.waitForSelector('[data-admin-vouchers] [data-voucher-form]');
  // persönlich (Standard)
  check(await page.locator('input[name="adm-v-dist"]').first().isChecked(), 'Standard: persönlich');
  check(await page.inputValue('#adm-v-per') === '1' && await page.inputValue('#adm-v-days') === '30', 'Standard persönlich: 1 Einlösung, 30 Tage');
  await page.fill('#adm-v-name', 'Einzelcode Coach');
  check(/Du erzeugst einen persönlichen Code mit je einer Einlösung für je 30 Tage Bewerbungs-Pass/.test(await page.locator('[data-voucher-summary]').innerText()), 'Zusammenfassung persönlich');
  await page.getByRole('button', { name: 'Codes erzeugen' }).click();
  await page.waitForSelector('[data-new-code]');
  const newCode = await page.locator('[data-new-code]').first().innerText();
  remember(newCode);
  check(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(newCode), 'persönlicher Code einmal angezeigt (4er-Gruppen)', newCode);
  let body = st.adminCreates.at(-1);
  check(body.distribution === 'personal' && body.maxRedemptions === 1 && body.count === 1 && !body.code, 'Anfrage persönlich: zufällig, 1 Einlösung, kein eigener Code');
  // persönlich dauerhaft
  await page.locator('input[name="adm-v-kind"]').nth(1).check();
  await page.fill('#adm-v-name', 'Dauerhaft für Lena');
  check(/einen persönlichen Code mit je einer Einlösung für dauerhaften Gratiszugang/.test(await page.locator('[data-voucher-summary]').innerText()), 'Zusammenfassung persönlich dauerhaft');
  await page.getByRole('button', { name: 'Codes erzeugen' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-voucher-row="personal"]').length === 2);
  check(st.adminCreates.at(-1).kind === 'lifetime' && st.adminCreates.at(-1).days === undefined, 'Anfrage persönlich dauerhaft');
  await page.locator('input[name="adm-v-kind"]').nth(0).check();
  // öffentlich
  await page.locator('input[name="adm-v-dist"]').nth(1).check();
  check(await page.inputValue('#adm-v-days') === '30' && await page.inputValue('input[aria-label="Gesamtlimit (Anzahl Einlösungen)"]') === '100' && await page.inputValue('#adm-v-until') === '', 'Standard öffentlich: 30 Tage, Limit 100, Frist leer');
  await page.fill('#adm-v-name', 'LinkedIn Herbst');
  await page.fill('#adm-v-code', 'linkedin 30');
  check(/Die Einlösefrist fehlt noch/.test(await page.locator('[data-voucher-summary]').innerText()), 'Zusammenfassung zeigt fehlende Frist');
  await page.getByRole('button', { name: 'Aktionscode anlegen' }).click();
  check(/Einlösefrist fehlt/.test(await page.locator('[data-voucher-problems]').innerText()), 'ohne Frist kein Speichern');
  const until = dateIn(21);
  await page.fill('#adm-v-until', until);
  await page.selectOption('#adm-v-camp', '__new');
  await page.fill('#adm-v-camp-new', 'Herbst 2026');
  const sum = await page.locator('[data-voucher-summary]').innerText();
  check(/^Du verteilst 100 Zugänge für je 30 Tage\. Einlösbar bis .+, je Konto einmal\. Kampagne „Herbst 2026"/.test(sum), 'Zusammenfassung „Du verteilst 100 Zugänge für je 30 Tage …"', sum);
  await page.getByRole('button', { name: 'Aktionscode anlegen' }).click();
  await page.waitForSelector('[data-voucher-created] [data-action-notice]');
  body = st.adminCreates.at(-1);
  check(body.code === 'LINKEDIN30' && body.maxRedemptions === 100 && body.redeemUntil === until && body.campaign === 'Herbst 2026' && body.days === 30, 'Anfrage öffentlich', JSON.stringify(body));
  const notice = await page.locator('[data-voucher-created] textarea').inputValue();
  const expected = new RegExp(`^Mit LINKEDIN30 erhältst du 30 Tage Bewerbungs-Pass kostenlos\\. Ohne Zahlungsdaten, ohne Abo\\. Einlösbar bis \\d+\\. \\S+ \\d{4}, für die ersten 100 erfolgreichen Einlösungen\\.\\n${BASE.replace(/[.:/]/g, m => '\\' + m)}/code$`);
  check(expected.test(notice), 'Aktionshinweis nach Muster, Einlöseadresse ohne Code', JSON.stringify(notice));
  await page.locator('[data-voucher-created]').getByRole('button', { name: 'Hinweis kopieren' }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => 'ERR'));
  check(clip === notice, 'Aktionshinweis kopierbar (Zwischenablage)');
  await page.locator('[data-voucher-created]').getByRole('button', { name: 'Einlöseadresse kopieren' }).click();
  check(await page.evaluate(() => navigator.clipboard.readText().catch(() => 'ERR')) === `${BASE}/code`, 'Einlöseadresse kopierbar, ohne Code-Parameter');
  // öffentlich dauerhaft: Limit Pflicht
  await page.locator('input[name="adm-v-kind"]').nth(1).check();
  check(await page.inputValue('input[aria-label="Gesamtlimit (Anzahl Einlösungen)"]') === '', 'dauerhaft öffentlich: Limit ohne Vorbelegung');
  await page.fill('#adm-v-name', 'Dauerhaft Launch');
  await page.fill('#adm-v-code', 'DAUER50');
  await page.fill('#adm-v-until', until);
  await page.getByRole('button', { name: 'Aktionscode anlegen' }).click();
  check(/Gesamtlimit fehlt – bei dauerhaften Aktionen Pflicht/.test(await page.locator('[data-voucher-problems]').innerText()), 'dauerhaft öffentlich: ohne Limit kein Speichern');
  await page.fill('input[aria-label="Gesamtlimit (Anzahl Einlösungen)"]', '50');
  check(/^Du verteilst 50 dauerhafte Gratiszugänge\./.test(await page.locator('[data-voucher-summary]').innerText()), 'Zusammenfassung „50 dauerhafte Gratiszugänge"');
  await page.getByRole('button', { name: 'Aktionscode anlegen' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-voucher-row="public"]').length === 2);
  check(st.adminCreates.at(-1).kind === 'lifetime' && st.adminCreates.at(-1).maxRedemptions === 50, 'Anfrage öffentlich dauerhaft mit Limit 50');
  check(/Mit DAUER50 erhältst du einen dauerhaften Gratiszugang zum Bewerbungs-Pass\. Ohne Zahlungsdaten, ohne Abo\. Einlösbar bis .+, für die ersten 50 erfolgreichen Einlösungen\./.test(await page.locator('[data-voucher-created] textarea').inputValue()), 'Aktionshinweis dauerhaft');
  // ohne Gesamtlimit: nur mit bewusster Bestätigung
  await page.locator('input[name="adm-v-kind"]').nth(0).check();
  await page.fill('#adm-v-name', 'Newsletter offen');
  await page.fill('#adm-v-code', 'NEWS2026');
  await page.fill('#adm-v-until', until);
  await page.locator('input[name="adm-v-limit"]').nth(1).check();
  await page.getByRole('button', { name: 'Aktionscode anlegen' }).click();
  check(/ausdrücklich bestätigen/.test(await page.locator('[data-voucher-problems]').innerText()), 'ohne Limit: erst Bestätigung');
  await page.locator('[data-confirm-unlimited]').check();
  check(/ohne Gesamtlimit/.test(await page.locator('[data-voucher-summary]').innerText()), 'Zusammenfassung nennt „ohne Gesamtlimit"');
  await page.getByRole('button', { name: 'Aktionscode anlegen' }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-voucher-row="public"]').length === 3);
  body = st.adminCreates.at(-1);
  check(body.maxRedemptions === null && body.confirmUnlimited === true, 'Anfrage ohne Limit mit confirmUnlimited');
  await page.locator('[data-voucher-created]').getByRole('button', { name: 'Ausblenden' }).click();
  await axe(page, `Verwaltung Gutscheine (${tag})`);
  if (w === 390) await noOverflow(page, 'Verwaltung 390');
  await adminShot(page, `admin-gutscheine-${tag}`);
  // Deaktivieren mit Erklärung
  const row = page.locator('[data-voucher-row="public"]').first();
  await row.getByRole('button', { name: 'Deaktivieren …' }).click();
  check((await row.locator('[role="group"] p').innerText()) === 'Neue Einlösungen sind dann nicht mehr möglich. Bereits gewährte Zugänge bleiben bestehen.', 'Deaktivieren: Erklärung wörtlich');
  await adminShot(page, `admin-deaktivieren-${tag}`);
  await row.locator('[data-confirm-deactivate]').click();
  await page.waitForFunction(() => document.querySelector('[data-voucher-row="public"]')?.getAttribute('data-active') === 'false');
  check(true, 'Gutschein deaktiviert, in der Übersicht als „deaktiviert"');
  check(/Kein Umsatz/.test(await page.locator('[data-voucher-stats]').innerText()), 'Kennzahlen getrennt vom Umsatz ausgewiesen');
  await row.getByRole('button', { name: 'Einlösungen' }).click();
  await page.waitForTimeout(300);
  check(/Noch keine Einlösungen|Einlösungen, ohne E-Mail-Adressen/.test(await row.innerText()), 'Einlösungsverlauf aufklappbar');
  await page.context().close();
}

// ── Nichts davon in Analytics oder Adressen ────────────────────────────────
step('Datensparsamkeit');
{
  const leaked = seenUrls.filter(u => [...CODES].some(c => u.toUpperCase().replace(/[-%20]/g, '').includes(c)));
  check(leaked.length === 0, 'kein Code in einer angefragten Adresse', leaked.slice(0, 3).join(' '));
}
check(errors.length === 0, 'keine Laufzeitfehler', errors.slice(0, 3).join(' | '));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} Schritte bestanden`);
process.exit(passed === results.length ? 0 : 1);
