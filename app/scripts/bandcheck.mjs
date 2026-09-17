// Reicht die Farbfläche auf JEDER Seite bis an die Kante?
//
// Das ist die Frage, an der der Word-Export am 17.09.2026 hing, und sie lässt
// sich nicht durch Hinsehen bei drei Vorlagen beantworten. Also nachmessen:
// Jede Vorlage mit gefüllter Seitenspalte wird gebaut, mit LibreOffice zu PDF
// gerendert und auf der LETZTEN Seite an zwei Stellen abgetastet — weit oben
// und ganz unten in der Spalte. Beide müssen die Farbe der Vorlage tragen.
// Die letzte Seite ist die entscheidende: dort endete die Fläche vorher.
//
//   node scripts/bandcheck.mjs hamburg bordeaux seoul
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const ids = process.argv.slice(2);
const out = join(process.cwd(), 'tmp-docx');
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });

/** Farbe eines Bildpunkts aus einer PNG — über ImageMagick, das ohnehin da ist. */
function pixel(png, xPct, yPct) {
  const size = execFileSync('identify', ['-format', '%w %h', png], { encoding: 'utf8' }).split(' ').map(Number);
  const x = Math.round(size[0] * xPct), y = Math.round(size[1] * yPct);
  const txt = execFileSync('convert', [png, '-format', '%[pixel:p{' + x + ',' + y + '}]', 'info:'], { encoding: 'utf8' });
  return txt.trim();
}

const befunde = [];
for (const t of ids) {
  await p.goto(`http://localhost:5199/dev-preview.html?tpl=${t}&mode=one&len=long&p=marketing`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const panel = await p.evaluate(async (id) => {
    const m = await import('/src/templates/theme.ts');
    const th = m.getTheme(id);
    return { fill: th.colors.panelBg, layout: th.layout, panelFill: th.panelFill !== false };
  }, t);
  if (!panel.panelFill || !/^sidebar-/.test(panel.layout)) { befunde.push(`${t.padEnd(14)} übersprungen (${panel.layout}${panel.panelFill ? '' : ', ohne Fläche'})`); continue; }
  const b64 = await p.evaluate(() => window.__docx('design'));
  const f = join(out, `band-${t}.docx`);
  writeFileSync(f, Buffer.from(b64, 'base64'));
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', out, f], { stdio: 'pipe', timeout: 120000 });
  const pdf = join(out, `band-${t}.pdf`);
  if (!existsSync(pdf)) { befunde.push(`${t.padEnd(14)} ✗ LibreOffice lieferte kein PDF`); continue; }
  const seiten = Number((execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/) || [])[1]);
  execFileSync('pdftoppm', ['-png', '-r', '50', '-f', String(seiten), '-l', String(seiten), pdf, join(out, `band-${t}-letzte`)], { stdio: 'pipe' });
  const bild = [`band-${t}-letzte-${seiten}.png`, `band-${t}-letzte-0${seiten}.png`]
    .map(n => join(out, n)).find(existsSync);
  if (!bild) { befunde.push(`${t.padEnd(14)} ✗ kein Seitenbild`); continue; }
  // Linke Seitenspalte → bei 8 % der Breite; rechte → bei 92 %.
  const x = panel.layout === 'sidebar-right' ? 0.94 : 0.06;
  const oben = pixel(bild, x, 0.10);
  const unten = pixel(bild, x, 0.985);
  /* Mit Toleranz vergleichen, nicht auf Zeichengleichheit.
   *
   * Erster Anlauf verglich die Farbstrings direkt und meldete acht von zwölf
   * Vorlagen als Fehler — bei Unterschieden wie 236 gegen 235 in EINEM Kanal.
   * Das ist die Kantenglättung des Renderers, kein fehlender Farbbalken. Ein
   * Prüfskript, das so etwas als Befund meldet, wird nach dem dritten Mal
   * nicht mehr gelesen. */
  const kanaele = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
  const [a, c] = [kanaele(oben), kanaele(unten)];
  const gleich = a.length === 3 && c.length === 3 && a.every((v, i) => Math.abs(v - c[i]) <= 4);
  befunde.push(`${t.padEnd(14)} ${seiten} S. · oben ${oben} · ganz unten ${unten} ${gleich ? '✓' : '✗ FLÄCHE ENDET VORHER'}`);
}
await b.close();
console.log(befunde.join('\n'));
if (befunde.some(z => z.includes('✗'))) process.exitCode = 1;
