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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const fehler = [];
page.on('pageerror', e => fehler.push(`Seitenfehler: ${String(e).slice(0, 140)}`));

const probleme = [];
const pruefe = (bedingung, text) => { if (!bedingung) probleme.push(text); };

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.click('text=/Try the demo|Demo ausprobieren|Demo starten|Direkt ausprobieren/');
await page.waitForTimeout(2000);

/** Schaltet die Oberflächensprache über das Menü in der Kopfleiste. */
async function stelleSpracheEin(code, name) {
  await page.click('button[aria-haspopup="menu"]');
  await page.waitForTimeout(250);
  await page.click(`[role="menuitemradio"]:has-text("${name}")`);
  await page.waitForTimeout(700);
  const gewaehlt = await page.evaluate(() => localStorage.getItem('appstudio-ui-lang'));
  pruefe(gewaehlt === code, `Sprachwahl ${code}: localStorage steht auf „${gewaehlt}"`);
}

/** Text des ganzen Fensters, klein geschrieben. */
const text = () => page.evaluate(() => (document.body.innerText || '').toLowerCase());

// ── 1. Der Schalter existiert überhaupt ────────────────────────────────────
const schalter = await page.locator('button[aria-haspopup="menu"]').count();
pruefe(schalter === 1, `Sprachmenü in der Kopfleiste: ${schalter} gefunden, erwartet 1`);

// ── 2. Die beiden Sprachschalter sind auseinanderzuhalten ──────────────────
const gruppe = await page.locator('[role="group"]').first().getAttribute('aria-label');
pruefe(/lebenslauf|cv|résumé/i.test(gruppe || ''),
  `Die Reihe für die Dokumentsprache trägt kein eindeutiges aria-label (hat: „${gruppe}")`);

// ── 3. Umschalten wirkt auf das Editor-Chrome ──────────────────────────────
await stelleSpracheEin('en', 'English');
let t = await text();
pruefe(t.includes('preview') && t.includes('export'), 'Editor-Chrome bleibt auf Englisch unübersetzt');
pruefe(!t.includes('vorschau'), 'Editor-Chrome zeigt auf Englisch noch „Vorschau"');

// ── 4. Und auf die Bereiche, die bis heute keine Übersetzung hatten ────────
async function bereich(knopf, erwartet, verboten, name) {
  await page.click(knopf);
  await page.waitForTimeout(1200);
  const tt = await text();
  for (const w of erwartet) pruefe(tt.includes(w), `${name}: „${w}" fehlt auf Englisch`);
  for (const w of verboten) pruefe(!tt.includes(w), `${name}: zeigt auf Englisch noch „${w}"`);
}

await bereich('text=/^Export$/i', ['download'], ['herunterladen', 'vorlage ohne daten'], 'Export');

// Einstellungen („Aa"/Schrift) — das Panel war komplett deutsch.
/* Nicht „der erste Dialog-Knopf": Das ist die Vorlagenliste. Der gesuchte ist
   der mit der Schrift-Beschriftung. */
await page.click('button[aria-haspopup="dialog"][aria-label]:not([aria-label*="emplate"]):not([aria-label*="orlage"])');
await page.waitForTimeout(600);
let te = await text();
pruefe(!/schriftgröße/.test(te), 'Einstellungen: zeigt auf Englisch noch „Schriftgröße"');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
/* Ein geschlossenes Ausklappmenü darf keinen unsichtbaren Kasten über der App
   zurücklassen — sonst sind alle Knöpfe daneben tot. */
const frei = await page.evaluate(() => {
  const el = document.querySelector('button[aria-haspopup="menu"]');
  const r = el.getBoundingClientRect();
  const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return oben === el || el.contains(oben);
});
pruefe(frei, 'Nach Escape liegt noch ein unsichtbarer Kasten über der Kopfleiste');

// ── 4b. Auch die Vorlagenliste lässt sich mit der Tastatur schließen ───────
await page.click('button[aria-haspopup="dialog"][aria-expanded="false"]');
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const freiNachListe = await page.evaluate(() => {
  const el = document.querySelector('button[aria-haspopup="menu"]');
  const r = el.getBoundingClientRect();
  const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return oben === el || el.contains(oben);
});
pruefe(freiNachListe, 'Vorlagenliste: Escape lässt einen unsichtbaren Kasten über der App zurück');

// ── 5. Zurück auf Deutsch, damit nichts hängen bleibt ──────────────────────
await stelleSpracheEin('de', 'Deutsch');
t = await text();
pruefe(t.includes('vorschau'), 'Zurückschalten auf Deutsch wirkt nicht');

await browser.close();

if (fehler.length) probleme.push(...fehler);
if (probleme.length) {
  console.log('Befunde:');
  probleme.forEach(p => console.log(' · ' + p));
  process.exit(1);
}
console.log('ohne Befund — Oberfläche schaltet um, Bereiche gehen mit');
