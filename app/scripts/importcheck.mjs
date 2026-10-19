// importcheck.mjs: „Lebenslauf übernehmen" von der Startseite, aus dem Editor und der Übersicht, mit ChatGPT-Text und Word-Datei; Rückweg, Kopfleiste, axe.
// Laien-Durchgang 19.10.2026. Läuft gegen den Prüfstand (HARNESS_BASE, Vite mit API).
//   node scripts/importcheck.mjs [Ausgabeordner]
import os from 'node:os';
import { chromium } from 'playwright';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import fs from 'node:fs';
const B = process.env.HARNESS_BASE || 'http://localhost:5301', OUT = process.argv[2] || os.tmpdir();
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
const TEXT = "# **Anna Beispiel**\n**Telefon:** 0151 2345678 | **E-Mail:** anna@example.org | Hamburg\n\n## Profil\nEngagierte Kauffrau für Büromanagement mit 5 Jahren Erfahrung.\n\n## Berufserfahrung\n**Sachbearbeiterin** | Musterfirma GmbH | 03/2021 – heute\n- Bearbeitung von Rechnungen\n- Terminplanung für die Geschäftsführung\n\n**Auszubildende Kauffrau für Büromanagement** – Beispiel AG, 2018–2021\n- Ausbildung in allen Abteilungen\n\n## Ausbildung\n**Ausbildung Kauffrau für Büromanagement**, IHK Hamburg (2021)\n\n## Kenntnisse\n- MS Office (sehr gut)\n- DATEV\n\n## Sprachen\n- Deutsch (Muttersprache)\n- Englisch (B2)\n";
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-DE', permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(B + '/'); await p.waitForTimeout(1500);
// 1 Startseite → Schon einen Lebenslauf?
await p.locator('.lp-import-link a').click(); await p.waitForTimeout(2500);
ok(await p.locator('#ic-title').count() === 1, 'Startseite-Link öffnet „Lebenslauf übernehmen"');
// Anleitung kopieren
await p.locator('details summary').first().click();
await p.getByRole('button', { name: 'Anleitung kopieren' }).click(); await p.waitForTimeout(400);
const clip = await p.evaluate(() => navigator.clipboard.readText());
ok(clip.startsWith('Bitte bring meinen Lebenslauf'), 'Anleitung in der Zwischenablage');
await p.fill('#ic-text', TEXT); await p.waitForTimeout(700);
const found = await p.locator('[role=dialog] [role=status]').last().innerText();
console.log('   ', found.replace(/\s+/g, ' ').slice(0, 160));
ok(/2 Stationen/.test(found) && /2 Sprachen/.test(found), 'Erkannt: Stationen und Sprachen');
await p.screenshot({ path: OUT + '/laie-import.png' });
await p.getByRole('button', { name: 'Lebenslauf anlegen' }).click(); await p.waitForTimeout(2500);
const body = await p.innerText('body');
ok(body.includes('Anna Beispiel') && body.includes('Musterfirma GmbH'), 'Editor zeigt den übernommenen Lebenslauf');
ok(!body.includes('Lena Brandt'), 'kein Beispiel-Lebenslauf dazwischen');
// 2 Rückweg sichtbar
const back = p.getByRole('button', { name: /Zurück zur Profilübersicht/ }).first();
const box = await back.boundingBox();
ok(box && box.x + box.width <= 1280 && (await back.innerText()).includes('Deine Lebensläufe'), 'Rückweg „Deine Lebensläufe" sichtbar');
const off = await p.evaluate(() => [...document.querySelectorAll('header button, header a')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).length);
ok(off === 0, 'Kopfleiste passt in 1280 px');
await p.screenshot({ path: OUT + '/laie-editor.png' });
// Inhalt-Paneel: Knopf vorhanden
await p.getByRole('button', { name: 'Inhalt', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(600);
ok(await p.locator('.cv-import-cta').count() >= 1, 'Knopf im Inhalt-Paneel');
// 3 ⋯ → Lebenslauf übernehmen, ersetzen
await p.locator('button[aria-label="Mehr"]').first().click(); await p.waitForTimeout(400);
await p.getByRole('menuitem', { name: /Lebenslauf übernehmen/ }).click(); await p.waitForTimeout(600);
const radios = await p.locator('[role=dialog] [role=radio]').evaluateAll(n => n.map(x => [x.textContent.slice(0, 30), x.getAttribute('aria-checked'), x.disabled]));
console.log('   Ziele:', JSON.stringify(radios));
ok(radios.length === 2, 'Editor bietet neu/ersetzen');
// docx hochladen → ersetzen
const doc = new Document({ sections: [{ children: [
  new Paragraph({ text: 'Bernd Wort', heading: HeadingLevel.TITLE }),
  new Paragraph('bernd@example.org | 0170 1234567'),
  new Paragraph({ text: 'Berufserfahrung', heading: HeadingLevel.HEADING_1 }),
  new Paragraph({ children: [new TextRun({ text: 'Lagerist', bold: true }), new TextRun(' | Spedition Nord GmbH | 01/2019 – heute')] }),
  new Paragraph({ text: 'Kommissionierung', bullet: { level: 0 } }),
  new Paragraph({ text: 'Sprachen', heading: HeadingLevel.HEADING_1 }),
  new Paragraph('Deutsch (Muttersprache)'),
] }] });
fs.writeFileSync(OUT + '/bernd.docx', await Packer.toBuffer(doc));
await p.getByRole('button', { name: 'Datei hochladen' }).click();
await p.locator('[role=dialog] input[type=file]').setInputFiles(OUT + '/bernd.docx'); await p.waitForTimeout(1200);
const f2 = await p.locator('[role=dialog] [role=status]').last().innerText();
console.log('   docx:', f2.replace(/\s+/g, ' ').slice(0, 120));
ok(/1 Station/.test(f2), 'Word-Datei gelesen');
const rep = p.locator('[role=dialog] [role=radio]').nth(1);
if (!(await rep.isDisabled())) await rep.click();
await p.locator('[role=dialog] .ui-btn-primary').last().click(); await p.waitForTimeout(1500);
const body2 = await p.innerText('body');
ok(body2.includes('Bernd Wort') || body2.includes('Spedition Nord'), 'Word-Inhalt übernommen');
// 4 Übersicht
await p.getByRole('button', { name: /Zurück zur Profilübersicht/ }).first().click(); await p.waitForTimeout(1500);
ok(await p.getByRole('button', { name: 'Lebenslauf übernehmen' }).count() >= 1 || await p.locator('.kh-head-actions .ui-btn-soft').count() >= 1, 'Übersicht: Knopf „Lebenslauf übernehmen"');
await p.screenshot({ path: OUT + '/laie-home.png' });
// PDF-Hinweis
await p.locator('.kh-head-actions .ui-btn-soft').first().click().catch(() => {}); await p.waitForTimeout(600);
ok(await p.locator('#ic-text').count() === 1, 'Anlege-Fenster zeigt Einfügefeld');
await p.keyboard.press('Escape');
console.log('Fehler:', errs.length ? errs : 'keine');
await b.close();
// Barrierefreiheit des Fensters, Desktop und Telefon
const AXE = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const b2 = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const q = await (await b2.newContext({ viewport: vp, locale: 'de-DE' })).newPage();
  await q.goto(B + '/'); await q.waitForTimeout(1200);
  await q.locator('.lp-import-link a').click(); await q.waitForTimeout(2000);
  await q.fill('#ic-text', TEXT); await q.waitForTimeout(600);
  await q.addScriptTag({ content: AXE });
  const r = await q.evaluate(async () => await window.axe.run(document.querySelector('[role=dialog]'), { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }));
  const v = r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical');
  ok(v.length === 0, `axe Fenster ${vp.width} px: ${v.map(x => x.id + ':' + x.nodes.length).join(', ') || 'ohne Befund'}`);
  const over = await q.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok(!over, `kein waagerechtes Scrollen bei ${vp.width} px`);
  if (vp.width === 390) await q.screenshot({ path: OUT + '/laie-mobil.png' });
}
await b2.close();
