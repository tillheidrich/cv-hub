// Prüft das direkte Bearbeiten in der Vorschau wie ein Mensch es benutzt:
// hineinklicken, tippen, verlassen — und danach schauen, ob der Text wirklich
// in den Daten steht (der Export liest dieselben Daten) und der Umbruch
// weiterhin stimmt.
//
//   node scripts/inlinecheck.mjs hamburg marketing
import { chromium } from 'playwright';

const [tpl = 'hamburg', persona = 'marketing'] = process.argv.slice(2);
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`${BASE}/dev-preview.html?tpl=${tpl}&mode=one&len=normal&p=${persona}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const ok = [];
const bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

const sel = (p) => `.cv-scale-wrapper [data-cv-edit="${p}"]`;

// 1. Name ändern
await page.click(sel('personal.name'));
await page.keyboard.press('Control+A');
await page.keyboard.type('Katharina M. Vogt');
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
check((await page.textContent(sel('personal.name')))?.includes('Katharina M. Vogt'), 'Name im Dokument geändert');
check((await page.evaluate(() => window.__exportHtml())).includes('Katharina M. Vogt'), 'Änderung steht im Export');

// 2. Stichpunkt ändern
const firstBullet = await page.getAttribute('.cv-scale-wrapper [data-cv-edit*=".bullets."]', 'data-cv-edit');
await page.click(sel(firstBullet));
await page.keyboard.press('Control+A');
await page.keyboard.type('Kampagnen mit messbarem Beitrag zur Pipeline verantwortet');
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
check((await page.evaluate(() => window.__exportHtml())).includes('messbarem Beitrag zur Pipeline'), 'Stichpunkt geändert');

// 3. Eingabetaste legt einen neuen Stichpunkt an und setzt den Schreibzeiger hinein
const before = await page.locator('.cv-scale-wrapper [data-cv-edit*=".bullets."]').count();
await page.click(sel(firstBullet));
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
const after = await page.locator('.cv-scale-wrapper [data-cv-edit*=".bullets."]').count();
check(after === before + 1, `Eingabetaste legt einen Stichpunkt an (${before} → ${after})`);
const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-cv-edit'));
check(!!focused && focused.includes('.bullets.'), `Schreibzeiger steht im neuen Punkt (${focused})`);

// 4. Rücktaste im leeren Punkt entfernt ihn wieder
await page.keyboard.press('Backspace');
await page.waitForTimeout(900);
const after2 = await page.locator('.cv-scale-wrapper [data-cv-edit*=".bullets."]').count();
check(after2 === before, `Rücktaste entfernt den leeren Punkt wieder (${after} → ${after2})`);

// 5. Beschriftungen sind Daten: Überschrift, Feldbezeichnung, Wert, Fußzeile
//    Das war die Lücke, die Till gemeldet hat — die ganze linke Leiste war
//    unantastbar.
const uebersprungen = [];
const LABELPROBEN = [
  ['labels.sections.experience', 'Stationen'],
  ['labels.fields.nationality', 'Nationalität'],
  ['personal.nationality', 'deutsch/französisch'],
  ['personal.email', 'post@beispiel.de'],
  ['skills.0.label', 'Werkzeugkasten'],
];
// Die Fußzeile („Lebenslauf · 2/2") gibt es nur auf Folgeseiten — im
// einseitigen Testfall existiert sie nicht, das ist kein Befund.
if (await page.locator(sel('labels.misc.cvLabel')).count()) {
  LABELPROBEN.push(['labels.misc.cvLabel', 'Vita']);
}
for (const [pfad, text] of LABELPROBEN) {
  const el = page.locator(sel(pfad)).first();
  if (!(await el.count())) {
    // Nicht jede Testperson füllt jedes Feld (die Tech-Person hat keine
    // Staatsangehörigkeit), und nicht jede Vorlage zeigt jedes. Fehlt das
    // Feld, ist das kein Befund — nur wenn KEINE Probe lief.
    uebersprungen.push(pfad);
    continue;
  }
  await el.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  const html = await page.evaluate(() => window.__exportHtml());
  check(html.includes(text), `${pfad} → „${text}" steht im Export`);
}

check(uebersprungen.length < LABELPROBEN.length, `mindestens eine Beschriftung geprüft (übersprungen: ${uebersprungen.join(', ') || 'keine'})`);

// 6. Zeilenumbruch in der Anschrift — Umschalt+Eingabe.
//    Eine Anschrift steht auf zwei Zeilen. Vorher ging das an drei Stellen
//    gleichzeitig nicht: einzeiliges Formularfeld, die Übernahme faltete den
//    Umbruch zu einem Leerzeichen, und `Breakable` verpackte den Text in
//    `white-space: nowrap`.
{
  const adr = page.locator(sel('personal.location')).first();
  if (await adr.count()) {
    await adr.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Musterweg 17');
    await page.keyboard.down('Shift'); await page.keyboard.press('Enter'); await page.keyboard.up('Shift');
    await page.keyboard.type('29525 Uelzen');
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(900);
    const html = await page.evaluate(() => window.__exportHtml());
    check(html.includes('Musterweg 17') && html.includes('29525 Uelzen'), 'Anschrift: beide Zeilen im Export');
    const zweiZeilen = await page.evaluate(() => {
      const el = document.querySelector('.cv-scale-wrapper [data-cv-edit="personal.location"]');
      if (!el) return null;
      // Zwei Zeilen heißt: die Höhe reicht für zwei, nicht für eine.
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 14;
      return el.getBoundingClientRect().height > lh * 1.6;
    });
    check(zweiZeilen === true, 'Anschrift steht auf zwei Zeilen, nicht auf einer');
  } else {
    bad.push('Anschrift: kein beschreibbares Feld');
  }
}

// 7. Der Umbruch rechnet weiter
const hud = (await page.textContent('[data-hud]')) || '';
check(/\d+S · c=/.test(hud), `Umbruch weiterhin berechnet (${hud.trim().split('·').slice(-3).join('·').trim()})`);
check(errors.length === 0, `keine Ausnahmen (${errors.slice(0, 1).join('')})`);

for (const o of ok) console.log(`  ✓ ${o}`);
for (const b of bad) console.log(`  ✗ ${b}`);
await browser.close();
if (bad.length) process.exitCode = 1;
