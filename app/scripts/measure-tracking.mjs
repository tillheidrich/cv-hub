// Wie weit darf ein Name gesperrt werden, bevor die PDF-Textebene ihn zerlegt?
//
// Die Grenze aus dem Umbau vom 12.09. (0,08 em) wurde an KLEINEN Versalzeilen
// gemessen — Sektionstitel in 7 pt. Die Vorlagen aus Tills Sammlung sperren
// den NAMEN in 20–26 pt sehr weit („K A T H A R I N A   M A I"). Ob dieselbe
// Grenze gilt, ist eine Frage der Messung, nicht der Analogie: der Abstand in
// em skaliert mit der Schriftgröße, die Heuristik von Poppler arbeitet aber
// über Wortabstände in absoluten Einheiten.
//
//   node scripts/measure-tracking.mjs
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const NAME = 'KATHARINA MAI';
const SIZES = [11, 16, 22, 28];
const TRACKS = [0.08, 0.09, 0.10, 0.11, 0.12];

const dir = mkdtempSync(join(tmpdir(), 'track-'));
const rows = SIZES.flatMap(pt => TRACKS.map(em => ({ pt, em })));
const html = `<!doctype html><meta charset="utf-8"><style>
 @page { size: A4; margin: 12mm; }
 body { font-family: Helvetica, Arial, sans-serif; }
 p { margin: 0 0 6mm 0; }
</style><body>${rows.map((r, i) =>
  `<p style="font-size:${r.pt}pt;letter-spacing:${r.em}em">${NAME}</p>`).join('')}</body>`;
const htmlPath = join(dir, 'probe.html');
writeFileSync(htmlPath, html);

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage();
await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
const pdf = join(dir, 'probe.pdf');
await page.pdf({ path: pdf, format: 'A4', printBackground: true });
await browser.close();

execFileSync('pdftotext', ['-layout', pdf, join(dir, 'probe.txt')]);
const lines = readFileSync(join(dir, 'probe.txt'), 'utf8')
  .split('\n').map(l => l.trim()).filter(Boolean);

console.log('Name „KATHARINA MAI" — hält die Textebene das Wort zusammen?\n');
console.log('  pt   ' + TRACKS.map(t => String(t).padStart(6)).join(''));
let li = 0;
const grenze = {};
for (const pt of SIZES) {
  const cells = [];
  for (const em of TRACKS) {
    const got = (lines[li++] || '');
    // „zusammen" heißt: keine Einzelbuchstaben mit Leerzeichen dazwischen und
    // der Wortabstand ist erhalten (zwei Wörter, nicht eins, nicht dreizehn).
    const woerter = got.split(/\s+/).filter(Boolean);
    const ok = woerter.length === 2 && woerter[0] === 'KATHARINA' && woerter[1] === 'MAI';
    if (ok) grenze[pt] = em;
    cells.push((ok ? '  ✓' : '  ✗').padStart(6));
  }
  console.log(`${String(pt).padStart(4)}   ${cells.join('')}`);
}
console.log('\nGrößte unbeschädigte Sperrung je Schriftgrad:');
for (const pt of SIZES) console.log(`  ${String(pt).padStart(3)} pt → ${grenze[pt] ?? 'keine'} em`);
