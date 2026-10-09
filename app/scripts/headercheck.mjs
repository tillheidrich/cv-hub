// Passt die Kopfleiste des Editors in die Breite?
//
// Befund vom 08.10.2026 (Gestaltungs- und Personas-Bericht): Die Kopfleiste
// war bei 1440 px Fensterbreite 1504 px breit; auf 1280 px fehlten
// „Versionen", die Demo-Marke und ausgerechnet „Konto anlegen" — der Knopf,
// der aus der Demo herausführt. axe sieht das nicht, weil nichts verdeckt,
// sondern abgeschnitten ist.
//
// Geprüft wird bei 1440, 1280, 1024 und 860 px (860 ist die Schwelle zum
// Telefon, `ui/useIsMobile.ts`), jeweils in der Demo und angemeldet (die
// Anmeldung wird über abgefangene API-Antworten vorgetäuscht, mit
// Admin-Rolle — dann ist das „⋯"-Menü am vollsten):
//   1. header.scrollWidth <= innerWidth
//   2. jedes Bedienelement der Kopfleiste liegt vollständig im Fenster
//   3. der Primärknopf (PDF) und „⋯" sind sichtbar; in der Demo auch
//      „Konto anlegen"
//   4. das „⋯"-Menü öffnet, liegt im Fenster und führt die seltenen Wege
//      (Oberflächensprache, Versionen, Konto bzw. Konto anlegen)
//
//   node scripts/headercheck.mjs
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WIDTHS = (process.env.WIDTHS || '1440,1280,1024,860').split(',').map(Number);

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const problems = [];

async function run(width, signedIn) {
  const label = `${width} px ${signedIn ? 'angemeldet' : 'Demo'}`;
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  if (signedIn) {
    const profile = await (async () => {
      const p = await ctx.newPage();
      await p.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
      const prof = await p.evaluate(async () => {
        const m = await import('/src/data/storage.ts');
        const d = m.createDemoProfile('Bewerbung Stadtwerke Lüneburg');
        return d;
      });
      await p.close();
      return prof;
    })();
    await page.route('**/api/auth/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 1, username: 'pruefung@example.com', role: 'admin' } }) }));
    await page.route('**/api/resumes', r => r.request().method() === 'GET'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ resumes: [{ id: profile.id, display_name: profile.displayName, updated_at: new Date().toISOString() }] }) })
      : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.route(`**/api/resumes/${profile.id}`, r => r.request().method() === 'GET'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ resume: { id: profile.id, displayName: profile.displayName, payload: profile } }) })
      : r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
  } else {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.click('text=/Direkt ausprobieren|Demo ausprobieren|Try the demo/');
    await page.waitForTimeout(2200);
  }

  const r = await page.evaluate(() => {
    const h = document.querySelector('header');
    if (!h) return null;
    const W = window.innerWidth;
    const out = [];
    h.querySelectorAll('button, a, [role="status"]:not(.cv-sr-only)').forEach(el => {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return;
      if (b.left < -1 || b.right > W + 1) out.push(`„${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}" ${Math.round(b.left)}…${Math.round(b.right)}`);
    });
    const vis = (re) => [...h.querySelectorAll('button')].some(el => {
      const b = el.getBoundingClientRect();
      const name = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`;
      return re.test(name) && b.width > 0 && b.right <= W + 1 && b.left >= -1;
    });
    return {
      scroll: h.scrollWidth, W, out,
      pdf: vis(/PDF/), more: vis(/^Mehr\b|⋯/), konto: vis(/Konto anlegen/),
    };
  });
  if (!r) { problems.push(`${label}: keine Kopfleiste gefunden`); await ctx.close(); return; }
  if (r.scroll > r.W) problems.push(`${label}: Kopfleiste ${r.scroll} px breit bei ${r.W} px Fenster`);
  r.out.forEach(o => problems.push(`${label}: ragt aus dem Fenster — ${o}`));
  if (!r.pdf) problems.push(`${label}: „PDF herunterladen" nicht sichtbar`);
  if (!r.more) problems.push(`${label}: „⋯" nicht sichtbar`);
  if (!signedIn && !r.konto) problems.push(`${label}: „Konto anlegen" nicht sichtbar`);

  // „⋯"-Menü
  await page.locator('header button[aria-label="Mehr"]').first().click();
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const menu = document.querySelector('[role="menu"]');
    if (!menu) return null;
    const b = menu.getBoundingClientRect();
    return {
      inside: b.left >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1,
      text: menu.textContent || '',
      focusInMenu: menu.contains(document.activeElement),
    };
  });
  if (!m) problems.push(`${label}: „⋯"-Menü öffnet nicht`);
  else {
    if (!m.inside) problems.push(`${label}: „⋯"-Menü ragt aus dem Fenster`);
    if (!m.focusInMenu) problems.push(`${label}: Fokus springt nicht ins „⋯"-Menü`);
    for (const need of ['Deutsch', 'English', 'Versionen', signedIn ? 'Konto' : 'Konto anlegen', ...(signedIn ? ['Admin', 'Abmelden'] : [])]) {
      if (!m.text.includes(need)) problems.push(`${label}: „${need}" fehlt im „⋯"-Menü`);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const closed = await page.evaluate(() => !document.querySelector('[role="menu"]') && document.activeElement?.getAttribute('aria-label') === 'Mehr');
    if (!closed) problems.push(`${label}: Escape schließt das Menü nicht oder gibt den Fokus nicht an „⋯" zurück`);
  }
  errors.forEach(e => problems.push(`${label}: Ausnahme ${e}`));
  console.log(`  ${label.padEnd(22)} Kopfleiste ${r.scroll}/${r.W} px`);
  await ctx.close();
}

for (const w of WIDTHS) {
  await run(w, false);
  await run(w, true);
}
await browser.close();
console.log(problems.length ? `${problems.length} Befund(e)` : 'Kopfleiste ohne Befund ✓');
problems.forEach(p => console.log(`   ! ${p}`));
if (problems.length) process.exitCode = 1;
