// BFSG-/WCAG-Prüfung mit axe-core über die Bereiche, die ein Mensch wirklich
// durchläuft — nicht nur die Startseite.
//
// Warum überhaupt: Das Barrierefreiheitsstärkungsgesetz gilt seit Juni 2025 für
// Dienstleistungen im elektronischen Geschäftsverkehr. Ob es für dieses
// Werkzeug greift, ist eine juristische Frage; die technische Antwort sollte
// trotzdem stimmen, und geprüft war sie nie.
//
// axe findet nicht alles — Tastaturführung, Fokusreihenfolge und
// Verständlichkeit sieht es nicht. Was es findet, ist aber belegbar falsch.
//
//   node scripts/axecheck.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

const browser = await chromium.launch({ executablePath: EXECUTABLE });
let page = await browser.newPage({ viewport: { width: 1440, height: 950 }, locale: 'de-DE' });

async function pruefe(name) {
  await page.evaluate(AXE);
  const res = await page.evaluate(async () => {
    // @ts-ignore
    return await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
  });
  /* Eine begründete Ausnahme, und nur eine.
   *
   * `target-size` schlägt auf den Textstellen im gerenderten Dokument an
   * (`span[data-cv-edit=…]`) — das sind die Stellen, die man zum Schreiben
   * antippt. WCAG 2.2, Erfolgskriterium 2.5.8, nimmt genau diesen Fall aus:
   * „Inline — das Ziel steht in einem Satz, oder seine Größe ist durch die
   * Zeilenhöhe des umgebenden Textes bestimmt." Beides trifft zu. Ein
   * Fließtext, dessen Wörter 24 px hoch sein müssen, wäre kein Fließtext
   * mehr — und das Dokument ist die Abbildung eines gedruckten Blattes.
   *
   * Die Ausnahme wird gezählt und ausgewiesen, nicht verschwiegen: Ein
   * Prüflauf, der Befunde stillschweigend wegwirft, ist eine Beruhigung,
   * keine Prüfung. */
  let ausgenommen = 0;
  const verstoesse = [];
  for (const v of res.violations) {
    if (v.id === 'target-size') {
      /* Beide Schreibweisen derselben Sache: das Attribut am Textstück und die
         Klasse am contenteditable-Bereich. Beides ist Fließtext im Dokument. */
      const rest = v.nodes.filter(n => {
        const sel = n.target.join(' ');
        return !sel.includes('data-cv-edit') && !sel.includes('cv-edit');
      });
      ausgenommen += v.nodes.length - rest.length;
      if (!rest.length) continue;
      verstoesse.push({ ...v, nodes: rest });
      continue;
    }
    verstoesse.push(v);
  }
  return { name, verstoesse, ausgenommen };
}

const berichte = [];
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
berichte.push(await pruefe('Landing'));

await page.click('text=/Sign in|Anmelden/');
await page.waitForTimeout(800);
berichte.push(await pruefe('Anmeldung'));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.click('text=/Try the demo|Demo ausprobieren|Demo starten|Direkt ausprobieren/');
await page.waitForTimeout(2200);
berichte.push(await pruefe('Editor · Gestaltung (Start)'));

/* Seit dem 08.10.2026: Leinwand mit Schiene, Paneelen und Export-Menü statt
   der Reiter Bearbeiten / Vorschau / Export. Geprüft wird jeder Zustand, den
   ein Mensch auf dem Weg zum PDF sieht — auch geöffnete Menüs. */
const rail = async (name) => {
  await page.click(`nav[aria-label="Werkzeuge"] button:has-text("${name}")`);
  await page.waitForTimeout(900);
};
for (const [knopf, name] of [['Inhalt', 'Editor · Inhalt'], ['Prüfen', 'Editor · Prüfen'], ['Tipps', 'Editor · Tipps']]) {
  await rail(knopf);
  berichte.push(await pruefe(name));
}
await page.click('header button[aria-label="Weitere Formate"]');
await page.waitForTimeout(500);
berichte.push(await pruefe('Editor · Export-Menü offen'));
await page.click('[role="menu"] button:has-text("Alle Wege")');
await page.waitForTimeout(900);
berichte.push(await pruefe('Editor · Export-Paneel'));
await page.click('header button[aria-label="Mehr"]');
await page.waitForTimeout(400);
berichte.push(await pruefe('Editor · „⋯"-Menü offen'));
await page.keyboard.press('Escape');
await rail('Gestaltung');
await page.click('button.ui-row:has-text("Abschnitte ordnen")');
await page.waitForTimeout(500);
berichte.push(await pruefe('Editor · Abschnitte ordnen'));

/* Weitere Abschnitte (seit 09.10.2026): Blatt mit Auswahl, dann jeder
   Abschnitt einmal angelegt — so prüft axe jedes Formular, das dabei
   entsteht. Bewusst als letzter Schritt am Schreibtisch: Die Änderungen
   rufen den Sicherungshinweis auf den Plan, und der liegt danach über
   den Knöpfen der Kopfleiste. */
await rail('Inhalt');
await page.click('button[aria-haspopup="dialog"]:has-text("Abschnitt hinzufügen"), button[aria-haspopup="dialog"]:has-text("Bearbeiten")');
await page.waitForTimeout(500);
berichte.push(await pruefe('Editor · Weitere Abschnitte (Auswahl)'));
for (const art of ['Projekte', 'Zertifikate', 'Ehrenamt', 'Publikationen', 'Freier Abschnitt']) {
  const auswahl = page.locator('[role="dialog"] [role="group"] button', { hasText: art });
  if (!(await auswahl.count())) await page.click('[role="dialog"] button[aria-expanded]:has-text("Abschnitt hinzufügen")');
  await page.locator('[role="dialog"] [role="group"] button', { hasText: art }).first().click();
  await page.waitForTimeout(300);
}
berichte.push(await pruefe('Editor · Weitere Abschnitte (alle angelegt)'));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// Telefon
const tel = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'de-DE' });
{
  const p0 = page;
  page = tel;
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.click('text=/Try the demo|Demo ausprobieren|Demo starten|Direkt ausprobieren/');
  await page.waitForTimeout(2200);
  berichte.push(await pruefe('Telefon · Dokument'));
  for (const [i, name] of [[0, 'Telefon · Inhalt'], [1, 'Telefon · Gestaltung'], [2, 'Telefon · Prüfen'], [3, 'Telefon · Export']]) {
    await page.locator('nav.ui-bottom-bar button').nth(i).click();
    await page.waitForTimeout(900);
    berichte.push(await pruefe(name));
  }
  await page.click('header button:has-text("⋯")');
  await page.waitForTimeout(500);
  berichte.push(await pruefe('Telefon · Menü-Blatt'));
  page = p0;
}

await browser.close();

let summe = 0;
for (const b of berichte) {
  const ernst = b.verstoesse.filter(v => v.impact === 'critical' || v.impact === 'serious');
  const rest = b.verstoesse.filter(v => !ernst.includes(v));
  console.log(`\n── ${b.name} ──`);
  const fussnote = b.ausgenommen ? ` (${b.ausgenommen}× target-size auf Fließtext im Dokument — Inline-Ausnahme 2.5.8)` : '';
  if (!b.verstoesse.length) { console.log('   ohne Befund' + fussnote); continue; }
  if (fussnote) console.log('   ausgenommen:' + fussnote.trim());
  for (const v of [...ernst, ...rest]) {
    summe++;
    console.log(`   [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}×)`);
    v.nodes.slice(0, 2).forEach(n => console.log(`      ${n.target.join(' ')} — ${(n.failureSummary || '').split('\n')[1]?.trim() || ''}`));
  }
}
console.log(`\n${summe} Regelverstöße insgesamt.`);
