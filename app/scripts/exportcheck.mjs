// Jeden Ausgang einmal wirklich benutzen.
//
// Die Export-Liste behauptet neun Wege aus dem Werkzeug heraus. Geprüft war
// bisher nur, dass die Module existieren — das ist keine Prüfung, sondern eine
// Vermutung. Dieses Skript öffnet die App im Demo-Modus, klickt jeden Knopf,
// fängt den echten Download ab und sieht in die Datei hinein: richtige
// Endung, plausible Größe, und je Format ein Merkmal, das nur dann drinsteht,
// wenn der Export wirklich funktioniert hat (das ZIP seine vier Teile, die
// DOCX ihr `word/document.xml`, das JSON seine Felder).
//
// Was hier NICHT geprüft werden kann und woanders geprüft wird:
//   — PDF        → scripts/pdfcheck.mjs (braucht den PDF-Dienst)
//   — Word-Optik → scripts/docxcheck.mjs (rendert mit LibreOffice)
//   — Import     → nur mit Anmeldung sichtbar; der Demo-Modus hat keine
//                  gespeicherten Lebensläufe, also auch keinen Import.
//
//   node scripts/exportcheck.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/* Die Dateien landen NICHT im Projektordner: der Dev-Server beobachtet ihn,
 * neue Dateien lösen ein Neuladen aus — mitten in der Messung stand die Seite
 * dann wieder auf der Startseite und die restlichen Knöpfe fehlten. Eine
 * Stunde Fehlersuche an einer Ursache, die nicht im Produkt lag. */
const out = join(tmpdir(), 'cv-exportcheck');
mkdirSync(out, { recursive: true });

/** Merkmal je Format: was muss in der Datei stehen, damit sie echt ist? */
const PRUEFUNGEN = {
  'Word (.docx)': (f) => {
    const liste = execFileSync('unzip', ['-Z1', f], { encoding: 'utf8' });
    if (!liste.includes('word/document.xml')) return 'kein word/document.xml im ZIP';
    return null;
  },
  'Word — ATS-Fassung': (f) => {
    const liste = execFileSync('unzip', ['-Z1', f], { encoding: 'utf8' });
    if (!liste.includes('word/document.xml')) return 'kein word/document.xml im ZIP';
    const xml = execFileSync('unzip', ['-p', f, 'word/document.xml'], { encoding: 'utf8' });
    // Die ATS-Fassung ist einspaltig: keine Tabelle, keine Farbfläche.
    if (xml.includes('<w:tbl>')) return 'enthält eine Tabelle — die ATS-Fassung soll einspaltig sein';
    return null;
  },
  HTML: (f) => {
    const t = readFileSync(f, 'utf8');
    if (!t.includes('class="cv-page"')) return 'keine .cv-page im Dokument';
    if (!t.includes('@page')) return 'keine Seitenregel — dann druckt es nicht auf A4';
    if (!t.includes('contain: paint')) return 'Seitenkasten nicht gepinnt (Safari bräche um)';
    return null;
  },
  Markdown: (f) => {
    const t = readFileSync(f, 'utf8');
    if (!t.startsWith('---')) return 'kein Frontmatter';
    if (!/^#\s/m.test(t)) return 'keine Überschrift';
    return null;
  },
  JSON: (f) => {
    const d = JSON.parse(readFileSync(f, 'utf8'));
    if (!d.personal?.name) return 'kein personal.name';
    if (!Array.isArray(d.experience)) return 'keine experience-Liste';
    return null;
  },
  'JSON Resume': (f) => {
    const d = JSON.parse(readFileSync(f, 'utf8'));
    if (!d.basics?.name) return 'kein basics.name — das ist kein JSON-Resume';
    if (!Array.isArray(d.work)) return 'kein work-Array';
    return null;
  },
  'Vorlage ohne Daten': (f) => {
    const liste = execFileSync('unzip', ['-Z1', f], { encoding: 'utf8' });
    const fehlt = ['.html', '.docx', '.json', '.md'].filter(e => !liste.includes(e));
    if (fehlt.length) return `im ZIP fehlen Dateien mit: ${fehlt.join(', ')}`;
    return null;
  },
  'Leere Markdown-Vorlage': (f) => {
    const t = readFileSync(f, 'utf8');
    if (!t.startsWith('---')) return 'kein Frontmatter';
    return null;
  },
};

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const fehler = [];
page.on('pageerror', e => fehler.push(`Ausnahme: ${String(e).slice(0, 140)}`));

async function oeffneExport() {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  // Nach dem ersten Mal ist der Demo-Modus schon gespeichert; dann gibt es
  // den Knopf auf der Startseite nicht mehr.
  const start = page.locator('text=/Try the demo|Demo ausprobieren|Demo starten/').first();
  if (await start.count()) { await start.click(); }
  await page.waitForTimeout(2300);
  const tab = page.locator('button', { hasText: /^Export$/ }).first();
  if (await tab.count()) { await tab.click(); await page.waitForTimeout(700); }
}

const zeilen = [];
await oeffneExport();

for (const [name, pruefe] of Object.entries(PRUEFUNGEN)) {
  const knopf = page.locator('button, label').filter({ hasText: name }).first();
  if (!(await knopf.count())) { zeilen.push(`✗ ${name}: Knopf nicht gefunden`); continue; }
  let dl;
  try {
    [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      knopf.click(),
    ]);
  } catch {
    zeilen.push(`✗ ${name}: kein Download ausgelöst`);
    continue;
  }
  const ziel = join(out, dl.suggestedFilename());
  await dl.saveAs(ziel);
  const groesse = statSync(ziel).size;
  let befund = null;
  try { befund = pruefe(ziel); } catch (e) { befund = `Datei unlesbar: ${String(e).slice(0, 80)}`; }
  if (groesse < 200) befund = befund || `nur ${groesse} Byte`;
  zeilen.push(`${befund ? '✗' : '✓'} ${name.padEnd(24)} ${dl.suggestedFilename().padEnd(46)} ${(groesse / 1024).toFixed(1)} kB${befund ? ' — ' + befund : ''}`);
  await page.waitForTimeout(400);
}

await browser.close();
zeilen.forEach(z => console.log(z));
fehler.forEach(f => console.log(`✗ ${f}`));
const schlecht = zeilen.filter(z => z.startsWith('✗')).length + fehler.length;
console.log(schlecht ? `\n${schlecht} Ausgang/Ausgänge defekt` : '\nAlle geprüften Ausgänge liefern eine gültige Datei ✓');
process.exitCode = schlecht ? 1 : 0;
