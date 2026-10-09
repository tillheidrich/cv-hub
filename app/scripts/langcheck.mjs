// Prüft, dass die Oberfläche tatsächlich viersprachig ist — und zwar dort, wo
// sie es bis heute nicht war.
//
// Hintergrund: Die Sprache ließ sich nur auf Landing und Anmeldung umschalten.
// Wer im Editor war, saß in der Sprache fest, die der Browser vorgab — und
// weil niemand dort umschalten konnte, fiel jahrelang nicht auf, dass Export,
// Verlauf, ATS-Prüfung und Konto überhaupt keine Übersetzung hatten.
//
// Der Prüflauf macht genau das, was vorher unmöglich war: Er schaltet die
// Oberfläche im Editor um und schaut nach, ob die Bereiche mitgehen.
//
//   node scripts/langcheck.mjs
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const fehler = [];
page.on('pageerror', e => fehler.push(`Seitenfehler: ${String(e).slice(0, 140)}`));

const probleme = [];
const pruefe = (bedingung, text) => { if (!bedingung) probleme.push(text); };

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.click('text=/Try the demo|Demo ausprobieren|Demo starten|Direkt ausprobieren/');
await page.waitForTimeout(2000);

/* Seit dem 08.10.2026 liegt die Oberflächensprache im „⋯"-Menü der
   Kopfleiste (Gestaltungsbericht: Seltenes hinter „Mehr"). Der Knopf heißt in
   jeder Sprache anders; gefunden wird er über seine Stelle: der letzte
   Menü-Knopf der Kopfleiste. */
const MEHR = 'header button[aria-haspopup="menu"]:not([aria-label*="ormat"]):not([aria-label*="Plus"]):not([aria-label*="formats"])';
/** Schaltet die Oberflächensprache über das Menü in der Kopfleiste. */
async function stelleSpracheEin(code, name) {
  await page.locator('header button[aria-haspopup="menu"]').last().click();
  await page.waitForTimeout(250);
  await page.click(`[role="menuitemradio"]:has-text("${name}")`);
  await page.waitForTimeout(700);
  const gewaehlt = await page.evaluate(() => localStorage.getItem('appstudio-ui-lang'));
  pruefe(gewaehlt === code, `Sprachwahl ${code}: localStorage steht auf „${gewaehlt}"`);
}

/** Text des ganzen Fensters, klein geschrieben. */
const text = () => page.evaluate(() => (document.body.innerText || '').toLowerCase());

// ── 1. Der Schalter existiert überhaupt ────────────────────────────────────
const schalter = await page.locator(MEHR).count();
pruefe(schalter === 1, `„⋯"-Menü in der Kopfleiste: ${schalter} gefunden, erwartet 1`);

// ── 2. Die beiden Sprachschalter sind auseinanderzuhalten ──────────────────
/* Die Dokumentsprache steht im Kopf des Inhalt-Paneels. */
await page.click('nav[aria-label="Werkzeuge"] button:has-text("Inhalt")');
await page.waitForTimeout(500);
const gruppe = await page.locator('#ui-panel [role="group"]').first().getAttribute('aria-label');
pruefe(/lebenslauf|cv|résumé/i.test(gruppe || ''),
  `Die Reihe für die Dokumentsprache trägt kein eindeutiges aria-label (hat: „${gruppe}")`);

// ── 3. Umschalten wirkt auf das Editor-Chrome ──────────────────────────────
await stelleSpracheEin('en', 'English');
let t = await text();
pruefe(t.includes('content') && t.includes('whole page') && t.includes('download pdf'), 'Editor-Chrome bleibt auf Englisch unübersetzt');
pruefe(!t.includes('ganze seite') && !t.includes('inhalt'), 'Editor-Chrome zeigt auf Englisch noch „Ganze Seite"/„Inhalt"');

// ── 4. Und auf die Bereiche, die bis heute keine Übersetzung hatten ────────
async function bereich(knopf, erwartet, verboten, name) {
  await page.click(knopf);
  await page.waitForTimeout(1200);
  const tt = await text();
  for (const w of erwartet) pruefe(tt.includes(w), `${name}: „${w}" fehlt auf Englisch`);
  for (const w of verboten) pruefe(!tt.includes(w), `${name}: zeigt auf Englisch noch „${w}"`);
}

await bereich('text=/^Export$/i', ['download'], ['herunterladen', 'vorlage ohne daten'], 'Export');

// Gestaltung — das frühere Darstellungs-Panel war komplett deutsch.
await page.click('nav button:has-text("Design")');
await page.waitForTimeout(600);
await page.click('button.ui-row:has-text("Type and size")');
await page.waitForTimeout(400);
let te = await text();
pruefe(!/schriftgröße/.test(te), 'Gestaltung: zeigt auf Englisch noch „Schriftgröße"');
pruefe(te.includes('font size'), 'Gestaltung: „Font size" fehlt auf Englisch');

// ── 4b. Menüs lassen sich mit der Tastatur schließen und hinterlassen keinen
//        unsichtbaren Kasten über der App ─────────────────────────────────
for (const sel of ['header button[aria-haspopup="menu"] >> nth=0', 'header button[aria-haspopup="menu"] >> nth=-1']) {
  await page.click(sel);
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const frei = await page.evaluate(() => {
    const el = [...document.querySelectorAll('header button[aria-haspopup="menu"]')].pop();
    const r = el.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !document.querySelector('[role="menu"]') && (oben === el || el.contains(oben));
  });
  pruefe(frei, `Nach Escape (${sel}) bleibt ein Menü offen oder ein Kasten über der Kopfleiste`);
}

// ── 5. Zurück auf Deutsch, damit nichts hängen bleibt ──────────────────────
await stelleSpracheEin('de', 'Deutsch');
t = await text();
pruefe(t.includes('ganze seite'), 'Zurückschalten auf Deutsch wirkt nicht');

await browser.close();

if (fehler.length) probleme.push(...fehler);
if (probleme.length) {
  console.log('Befunde:');
  probleme.forEach(p => console.log(' · ' + p));
  process.exit(1);
}
console.log('ohne Befund — Oberfläche schaltet um, Bereiche gehen mit');
