// Alle Vorlagen einmal durch beide Word-Fassungen — in EINEM Browser.
//
// docxcheck.mjs rendert eine Vorlage gründlich mit LibreOffice und legt
// Seitenbilder daneben; das dauert pro Vorlage einige Sekunden. Für die Frage
// „baut überhaupt noch jede Vorlage eine gültige Datei?" ist das zu langsam:
// 36 Vorlagen × 2 Fassungen sprengen jede Geduld. Dieses Skript startet den
// Browser einmal, schaut in das ZIP hinein statt zu rendern, und prüft die
// Zusagen, die maschinell zu prüfen sind:
//
//   — Die Datei enthält überhaupt Text.
//   — Die ATS-Fassung bleibt ohne Tabelle und ohne Kopfzeile (die trägt die
//     Farbfläche; in einer Fassung für Parser hat sie nichts zu suchen).
//   — Wie viele Bilder drinstecken: Foto und, bei Vorlagen mit Farbfläche,
//     die verankerte Fläche selbst.
//
// Für die Optik bleibt docxcheck.mjs zuständig — Bilder ansehen ersetzt kein
// Skript.
//
//   — Seit 09.10.2026, mit DOCX_PERSONA=abschnitte: Projekte, Zertifikate,
//     Ehrenamt, Publikationen und freie Abschnitte stehen vollständig und in
//     Reihenfolge im Dokumenttext — in beiden Fassungen.
//
//   node scripts/docxsweep.mjs hamburg bordeaux seoul
//   DOCX_PERSONA=abschnitte node scripts/docxsweep.mjs hamburg bordeaux
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { pruefeReihenfolge, markenFuer } from './_abschnitte.mjs';
const PERSONA = process.env.DOCX_PERSONA || 'marketing';
let schlecht = 0;
const ids = process.argv.slice(2);
const out = join(process.cwd(), 'tmp-docx'); mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
for (const t of ids) {
  await p.goto(`${process.env.HARNESS_BASE || "http://localhost:5199"}/dev-preview.html?tpl=${t}&mode=one&len=normal&p=${PERSONA}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  for (const v of ['design', 'ats']) {
    const b64 = await p.evaluate(x => window.__docx(x), v);
    const f = join(out, `sweep-${t}-${v}.docx`);
    writeFileSync(f, Buffer.from(b64, 'base64'));
    const xml = execFileSync('unzip', ['-p', f, 'word/document.xml'], { encoding: 'utf8' });
    const media = execFileSync('unzip', ['-Z1', f], { encoding: 'utf8' }).split('\n').filter(l => /^word\/media\/.+/.test(l)).length;
    const hdr = execFileSync('unzip', ['-Z1', f], { encoding: 'utf8' }).includes('word/header1.xml');
    const flags = [];
    if (v === 'ats' && xml.includes('<w:tbl>')) flags.push('ATS HAT TABELLE');
    if (v === 'ats' && hdr) flags.push('ATS HAT KOPFZEILE');
    if (!xml.includes('<w:t')) flags.push('KEIN TEXT');
    if (PERSONA === 'abschnitte') {
      /* Absätze als Zeilen, Läufe darin aneinander — so liest ein Parser. */
      const text = xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, ' ').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
      /* Die Design-Fassung folgt der Reihenfolge der Vorlage (`mainOrder`),
       * die ATS-Fassung immer der üblichen. */
      const order = v === 'design' ? await p.evaluate(async id => {
        const th = (await import('/src/templates/theme.ts')).THEMES.find(x => x.id === id);
        return th && th.mainOrder && !/sidebar/.test(th.layout) ? th.mainOrder : null;
      }, t) : null;
      const { fehlt, falsch } = pruefeReihenfolge(text, markenFuer(order));
      if (fehlt.length) flags.push(`FEHLT: ${fehlt.slice(0, 3).join(' | ')}${fehlt.length > 3 ? ` (+${fehlt.length - 3})` : ''}`);
      if (falsch.length) flags.push(`REIHENFOLGE: ${falsch.slice(0, 3).join(' | ')}`);
    }
    if (flags.length) schlecht++;
    console.log(`${t.padEnd(16)} ${v.padEnd(7)} Bilder:${media} Kopfzeile:${hdr ? 'ja' : 'nein'} ${flags.join(' ') || 'ok'}`);
  }
}
await b.close();
if (schlecht) process.exitCode = 1;
