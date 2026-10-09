// Schafft jede Vorlage einen einseitigen Lebenslauf auf einer Seite?
//
// „Eine Seite" ist keine Eigenschaft des Werkzeugs, sondern das Ergebnis aus
// Layout und Textmenge. Diese Prüfung trennt beides: Mit der Testperson
// `einseiter` (drei Stationen, zwei Abschlüsse, zwei Skill-Gruppen, Profil
// unter 400 Zeichen) MUSS jede Vorlage eine Seite schaffen — auch die
// einspaltigen, bei denen Kontakt, Sprachen und Skills im Textfluss stehen.
// Schafft eine es nicht, liegt es an der Vorlage, nicht am Text.
//
//   node scripts/onepagecheck.mjs            → alle Vorlagen, A4 und US Letter
//   node scripts/onepagecheck.mjs marketing  → andere Testperson
//   FORMATS=a4 node scripts/onepagecheck.mjs → nur A4
//
// US Letter (seit 09.10.2026): 216 × 279 mm statt 210 × 297 mm — sechs mm
// breiter, achtzehn mm kürzer. Die Seite fasst also weniger Zeilen; was auf
// A4 knapp passt, kann auf Letter umbrechen. Geprüft wurde bisher nur A4
// (Wettbewerbsbericht: „Letter wählbar, aber nur A4 geprüft").
import { chromium } from 'playwright';

const persona = process.argv[2] || 'einseiter';
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });

/* Die Vorlagenliste stand hier früher als Zeichenkette. Sie ging nach jeder
 * neuen Vorlage aus dem Takt — zuletzt fehlten lille, antwerpen und rotterdam,
 * also genau die, die geprüft werden sollten. Jetzt kommt sie aus derselben
 * Quelle wie die Vorlagenauswahl in der App. */
await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });
const TPLS = process.argv[3]
  ? process.argv[3].split(',')
  : await page.evaluate(async () => (await import('/src/templates/theme.ts')).PICKABLE_THEMES.map(t => t.id));
const FORMATS = (process.env.FORMATS || 'a4,letter').split(',').filter(Boolean);
const bad = [];
let runs = 0;
for (const fmt of FORMATS) {
if (FORMATS.length > 1) console.log(`\n${fmt === 'letter' ? 'US Letter' : fmt.toUpperCase()}`);
for (const t of TPLS) {
  runs++;
  await page.goto(`${BASE}/dev-preview.html?tpl=${t}&mode=one&len=normal&p=${persona}&fmt=${fmt}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const hud = document.querySelector('[data-hud]')?.textContent || '';
    const m = hud.match(/(\d+)S · c=([-\d.]+) · ([\d.]+)pt/);
    return { seiten: m ? Number(m[1]) : null, c: m ? Number(m[2]) : null, pt: m ? m[3] : null, ueberlauf: /ÜBERLAUF/.test(hud) };
  });
  const ok = r.seiten === 1 && !r.ueberlauf;
  if (!ok) bad.push(`${t} (${fmt}): ${r.seiten ?? '?'} Seite(n)${r.ueberlauf ? ' mit Überlauf' : ''}`);
  console.log(`  ${ok ? '✓' : '✗'} ${t.padEnd(12)} ${r.seiten}S · ${r.pt} pt · Verdichtung ${r.c === null ? '?' : Math.round(r.c * 100) + ' %'}`);
}
}
console.log(`\nTestperson ${persona}: ${runs - bad.length}/${runs} Läufe auf einer Seite (${TPLS.length} Vorlagen × ${FORMATS.join(', ')})`);
bad.forEach(b => console.log(`   ! ${b}`));
await browser.close();
if (bad.length) process.exitCode = 1;
