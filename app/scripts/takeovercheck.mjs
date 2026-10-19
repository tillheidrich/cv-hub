// takeovercheck.mjs: Demo-Lebenslauf nach der Anmeldung ins Konto übernehmen, erst nach der Art.-9-Einwilligung.
// Laien-Durchgang 19.10.2026. Läuft gegen den Prüfstand (HARNESS_BASE, Vite mit API).
//   node scripts/takeovercheck.mjs [Ausgabeordner]
import os from 'node:os';
import { chromium } from 'playwright';
import fs from 'node:fs';
const B = process.env.HARNESS_BASE || 'http://localhost:5301', OUT = process.argv[2] || os.tmpdir();
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
const TEXT = "# **Anna Beispiel**\n**Telefon:** 0151 2345678 | **E-Mail:** anna@example.org | Hamburg\n\n## Profil\nEngagierte Kauffrau für Büromanagement mit 5 Jahren Erfahrung.\n\n## Berufserfahrung\n**Sachbearbeiterin** | Musterfirma GmbH | 03/2021 – heute\n- Bearbeitung von Rechnungen\n- Terminplanung für die Geschäftsführung\n\n**Auszubildende Kauffrau für Büromanagement** – Beispiel AG, 2018–2021\n- Ausbildung in allen Abteilungen\n\n## Ausbildung\n**Ausbildung Kauffrau für Büromanagement**, IHK Hamburg (2021)\n\n## Kenntnisse\n- MS Office (sehr gut)\n- DATEV\n\n## Sprachen\n- Deutsch (Muttersprache)\n- Englisch (B2)\n";
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-DE' })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(B + '/'); await p.waitForTimeout(1500);
await p.locator('.lp-import-link a').click(); await p.waitForTimeout(2000);
await p.fill('#ic-text', TEXT); await p.waitForTimeout(600);
await p.getByRole('button', { name: 'Lebenslauf anlegen' }).click(); await p.waitForTimeout(2000);
// Konto anlegen / anmelden
await p.getByRole('button', { name: /Konto anlegen/ }).first().click(); await p.waitForTimeout(800);
console.log('   Panel:', (await p.locator('[role=dialog]').last().innerText()).replace(/\s+/g,' ').slice(0,200));
await p.getByRole('button', { name: /Schon ein Konto/ }).click(); await p.waitForTimeout(1500);
await p.locator('input[autocomplete="username"]').last().fill(process.env.ADMIN_USER || 'kadmin');
await p.locator('input[autocomplete="current-password"]').fill(process.env.ADMIN_PASS || '');
await p.locator('button[type=submit]').click(); await p.waitForTimeout(4000);
const a9 = p.getByRole('button', { name: /Jetzt nicht/ });
if (await a9.count()) {
  console.log('   Einwilligungs-Dialog zuerst, Übernahme wartet:', await p.locator('#cv-takeover-title').count() === 0);
  await a9.first().click(); await p.waitForTimeout(800);
  console.log('   nach „Jetzt nicht" weiter keine Übernahme-Frage:', await p.locator('#cv-takeover-title').count() === 0);
  await p.getByRole('button', { name: /Einwilligung ansehen/ }).first().click(); await p.waitForTimeout(600);
  await p.locator('[data-art9-checkbox]').check();
  await p.locator('[data-art9-checkbox]').locator('xpath=ancestor::*[@role="dialog"][1]').locator('.ui-btn-primary').first().click(); await p.waitForTimeout(2000);
}
const dlg = p.locator('#cv-takeover-title');
ok(await dlg.count() === 1, 'nach Anmeldung: Angebot „Lebenslauf aus der Demo mitnehmen?"');
console.log('   ', (await p.locator('[aria-labelledby=cv-takeover-title]').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 260));
console.log('   disabled:', await p.getByRole('button', { name: 'Ins Konto übernehmen' }).isDisabled());
await p.getByRole('button', { name: 'Ins Konto übernehmen' }).click(); await p.waitForTimeout(3000);
console.log('   nachher:', (await p.innerText('body')).replace(/\s+/g,' ').slice(0, 300));
const body = await p.innerText('body');
ok(body.includes('Anna Beispiel'), 'Lebenslauf liegt im Konto');
const list = await p.evaluate(async () => (await (await fetch('/pdfapi/api/resumes', { credentials: 'include' })).json()));
const names = (Array.isArray(list) ? list : list.resumes ?? []).map(r => r.displayName ?? r.display_name ?? r.name);
console.log('   Konto:', JSON.stringify(names).slice(0, 200));
ok(names.some(n => /Anna/.test(n)), 'Server kennt den Lebenslauf');
await p.reload(); await p.waitForTimeout(3500);
ok(await p.locator('#cv-takeover-title').count() === 0, 'nach Neuladen nicht noch einmal gefragt');
console.log('Fehler:', errs.length ? errs : 'keine');
await b.close();
