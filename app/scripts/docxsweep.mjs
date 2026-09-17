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
//   node scripts/docxsweep.mjs hamburg bordeaux seoul
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
const ids = process.argv.slice(2);
const out = join(process.cwd(), 'tmp-docx'); mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 900, height: 1400 } });
for (const t of ids) {
  await p.goto(`http://localhost:5199/dev-preview.html?tpl=${t}&mode=one&len=normal&p=marketing`, { waitUntil: 'networkidle' });
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
    console.log(`${t.padEnd(16)} ${v.padEnd(7)} Bilder:${media} Kopfzeile:${hdr ? 'ja' : 'nein'} ${flags.join(' ') || 'ok'}`);
  }
}
await b.close();
