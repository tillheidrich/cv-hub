// Kontaktangaben am Stück, Name vorn, ATS-Prüfung ohne Fehlalarm.
//
// Hintergrund (08.10.2026): Ein deutscher Parser-Test mit drei kommerziellen
// Engines zeigte, dass eine in der Seitenspalte umgebrochene E-Mail bei jeder
// Engine anders kaputt ankommt. Und die eigene ATS-Prüfung im Export meldete
// beim Standard-Beispiel eine „kritische Lücke", weil sie den Text aus dem
// HTML mit Leerzeichen an jeder Umbruchstelle zusammensetzte
// („lena. brandt@example. com"), während das PDF die Adresse vollständig trug.
//
// Diese Prüfung druckt für jede wählbare Vorlage ein echtes PDF (dasselbe HTML
// wie für den PDF-Dienst, gedruckt mit Chromium) und liest es mit pdftotext:
//
//   1. E-Mail und Web-Adresse stehen am Stück auf EINER Zeile — sowohl in der
//      Layout-Lesart (pdftotext) als auch im Rohstrom (pdftotext -raw).
//   2. Der Rohstrom von Seite 1 beginnt mit dem Namen.
//   3. Der Text, den die ATS-Prüfung liest (extractExportText), enthält E-Mail
//      und Name an derselben Stelle wie das PDF und stellt die Stationen in
//      derselben Reihenfolge auf wie der Rohstrom des PDF.
//
// Testpersonen: `langkontakt` (E-Mail mit Bindestrich, 46 Zeichen, lange
// Web- und LinkedIn-Adresse), `marketing` und `tech` (Adressen knapp an der
// Spaltenbreite) über alle Vorlagen, dazu das Demo-Profil in allen
// vier Sprachen über alle Vorlagen (für Punkt 3: kein falscher Alarm).
//
//   node scripts/contactwrapcheck.mjs                 → alles
//   node scripts/contactwrapcheck.mjs espoo,hamburg   → nur diese Vorlagen
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = join(process.cwd(), 'tmp-preview', 'contactwrap');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });
await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });
const TPLS = process.argv[2]
  ? process.argv[2].split(',')
  : await page.evaluate(async () => (await import('/src/templates/theme.ts')).PICKABLE_THEMES.map(t => t.id));

const PERSONAS = (process.env.PERSONAS || 'langkontakt,marketing,tech,demo,demo-en,demo-fr,demo-es').split(',');

/** Anzeigeform einer Adresse wie im Renderer (shortUrl). */
const short = v => v.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
const flat = t => t.replace(/\s+/g, ' ').trim().toLowerCase();

const bad = [];
let checked = 0;
for (const persona of PERSONAS) {
  for (const t of TPLS) {
    await page.goto(`${BASE}/dev-preview.html?tpl=${t}&mode=one&len=normal&p=${persona}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({
      html: window.__exportHtml(),
      text: window.__exportText(),
    }));
    const facts = await page.evaluate(async (p) => {
      const mod = await import('/src/dev/personas.ts');
      const de = (await import('/src/data/demo-de.ts')).demoDE;
      const en = (await import('/src/data/demo-en.ts')).demoEN;
      const cv = mod.PERSONAS[p] ?? (p === 'demo-en' ? en : de);
      const li = (cv.personal.socials || []).find(s => s.platform === 'linkedin')?.value || cv.personal.linkedin || '';
      return {
        name: cv.personal.name, email: cv.personal.email, web: cv.personal.website || '', li,
        companies: cv.experience.filter(e => !e.hidden).map(e => e.company),
      };
    }, persona);

    const base = join(out, `${persona}-${t}`);
    writeFileSync(`${base}.html`, r.html);
    const pr = await browser.newPage();
    await pr.goto(`file://${base}.html`, { waitUntil: 'networkidle' });
    await pr.evaluate(() => document.fonts.ready);
    await pr.waitForTimeout(400);
    await pr.pdf({ path: `${base}.pdf`, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    await pr.close();

    const layout = execFileSync('pdftotext', [`${base}.pdf`, '-'], { encoding: 'utf8' });
    const raw = execFileSync('pdftotext', ['-raw', `${base}.pdf`, '-'], { encoding: 'utf8' });
    const raw1 = execFileSync('pdftotext', ['-raw', '-f', '1', '-l', '1', `${base}.pdf`, '-'], { encoding: 'utf8' });
    const problems = [];

    // 1. Am Stück, auf einer Zeile.
    const pieces = [facts.email, short(facts.web), facts.li ? short(facts.li.includes('/') ? facts.li : `linkedin.com/in/${facts.li}`) : ''].filter(Boolean);
    for (const v of pieces) {
      const onOneLine = s => s.split('\n').some(l => l.toLowerCase().includes(v.toLowerCase()));
      if (!onOneLine(layout)) problems.push(`„${v}" nicht am Stück (pdftotext)`);
      else if (!onOneLine(raw)) problems.push(`„${v}" nicht am Stück (pdftotext -raw)`);
    }

    // 2. Der Rohstrom beginnt mit dem Namen.
    const head = flat(raw1);
    if (!head.startsWith(flat(facts.name))) problems.push(`Rohstrom beginnt mit „${raw1.replace(/\s+/g, ' ').slice(0, 40)}" statt mit dem Namen`);

    // 3. Die ATS-Prüfung liest, was im PDF steht.
    const ats = flat(r.text);
    if (!ats.includes(facts.email.toLowerCase())) problems.push('ATS-Prüfung findet die E-Mail nicht (falscher Alarm)');
    const atsHead = r.text.split('\n').filter(Boolean).slice(0, 3).join(' ').toLowerCase();
    if (!atsHead.includes(facts.name.toLowerCase().split(' ')[0])) problems.push('ATS-Prüfung: Name nicht in den ersten drei Zeilen');
    const order = (s) => facts.companies.map(c => s.indexOf(c.toLowerCase()));
    const oPdf = order(flat(raw)), oAts = order(ats);
    const rank = a => a.map(x => [...a].sort((p, q) => p - q).indexOf(x)).join(',');
    if (oPdf.includes(-1)) problems.push('Firma fehlt im PDF-Text');
    else if (rank(oPdf) !== rank(oAts)) problems.push(`Reihenfolge der Stationen weicht ab (PDF ${rank(oPdf)}, Prüfung ${rank(oAts)})`);

    checked++;
    const ok = problems.length === 0;
    if (!ok) bad.push(`${persona}/${t}: ${problems.join('; ')}`);
    console.log(`  ${ok ? '✓' : '✗'} ${persona.padEnd(12)} ${t.padEnd(11)}${ok ? '' : '  ' + problems.join('; ')}`);
  }
}
await browser.close();
console.log(`\n${checked - bad.length}/${checked} Kombinationen ohne Befund`);
if (bad.length) process.exitCode = 1;
