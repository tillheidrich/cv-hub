// Leinwand, Karussell, Block-Werkzeug und Skill-Chips — die neuen
// Bedienwege vom 08.10.2026 (Gestaltungsbericht, Bau-Liste 2, 7, 8, 9).
//
// Geprüft wird Verhalten, nicht Aussehen:
//   1. „Ganze Seite": eine ganze Seite steht im Bild; Klick in ein Feld zoomt
//      auf lesbare Größe, Escape führt zurück.
//   2. Karussell: ‹ › wechseln die Vorlage, die Live-Region sagt es an;
//      Pfeiltasten wirken nur mit Fokus in der Leiste — nie beim Schreiben.
//   3. Block-Werkzeug: ↑ ↓ Duplizieren Löschen „+ Punkt" an einer Station,
//      Löschen mit „Rückgängig"; das Werkzeug steht in keinem Textauszug.
//   4. Skill-Chips: Enter legt an, Komma-Listen werden geteilt, die erste
//      Rücktaste markiert nur, die zweite löscht.
//
//   node scripts/canvascheck.mjs
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
const problems = [];
const pruefe = (ok, text) => { if (!ok) problems.push(text); };

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.click('text=/Direkt ausprobieren|Demo ausprobieren|Try the demo/');
await page.waitForTimeout(2500);

const scale = () => page.evaluate(() => {
  const t = getComputedStyle(document.querySelector('.cv-scale-wrapper')).transform;
  return t === 'none' ? 1 : Number((t.match(/matrix\(([-\d.]+)/) || [])[1] || 1);
});
const vorlage = () => page.evaluate(() => document.querySelector('[data-carousel] [role="status"]')?.textContent || '');
const daten = () => page.evaluate(async () => {
  const m = await import('/src/data/storage.ts');
  const ps = await m.loadProfilesAsync();
  return ps[0]?.data?.de;
});

// 1. Ganze Seite
{
  const s0 = await scale();
  const seite = await page.evaluate(() => {
    const p = document.querySelector('.cv-scale-wrapper .cv-page').getBoundingClientRect();
    return { oben: p.top, unten: p.bottom, h: window.innerHeight };
  });
  pruefe(s0 < 1 && seite.unten <= seite.h && seite.oben >= 0, `Ganze Seite: Seite steht nicht vollständig im Bild (Maßstab ${s0.toFixed(2)}, ${Math.round(seite.oben)}…${Math.round(seite.unten)} bei ${seite.h})`);
  const feld = page.locator('.cv-scale-wrapper [data-cv-edit$=".role"]').first();
  await feld.click();
  await page.waitForTimeout(800);
  const s1 = await scale();
  pruefe(s1 >= 0.85, `Schreibzoom: beim Klick ins Feld bleibt der Maßstab bei ${s1.toFixed(2)}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  const s2 = await scale();
  pruefe(Math.abs(s2 - s0) < 0.01, `Escape: zurück auf ${s2.toFixed(2)} statt ${s0.toFixed(2)}`);
}

// 2. Karussell
{
  const a = await vorlage();
  // Pfeiltaste im Text darf die Vorlage nicht wechseln.
  await page.locator('.cv-scale-wrapper [data-cv-edit$=".role"]').first().click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  pruefe((await vorlage()) === a, 'Karussell: Pfeiltaste beim Schreiben wechselt die Vorlage');
  await page.click('[data-carousel] button[aria-label="Nächste Vorlage"]');
  await page.waitForTimeout(900);
  const b = await vorlage();
  pruefe(b && b !== a, `Karussell: › wechselt nicht (${a} → ${b})`);
  await page.keyboard.press('ArrowLeft');   // Fokus liegt noch auf ›
  await page.waitForTimeout(900);
  pruefe((await vorlage()) === a, 'Karussell: Pfeiltaste in der Leiste führt nicht zurück');
}

// 3. Block-Werkzeug
{
  const vorher = await daten();
  const ids = vorher.experience.map(e => e.id);
  const kopf = page.locator('.cv-scale-wrapper [data-cv-edit$=".role"]').first();
  await kopf.click();
  await page.waitForTimeout(500);
  const werkzeug = page.locator('.cv-scale-wrapper .cv-entry-tools').first();
  pruefe(await werkzeug.isVisible(), 'Block-Werkzeug: erscheint nicht bei Fokus in der Station');
  await werkzeug.locator('button[aria-label="Nach unten"]').click();
  await page.waitForTimeout(1500);
  let jetzt = await daten();
  pruefe(jetzt.experience[1]?.id === ids[0], 'Block-Werkzeug: „Nach unten" verschiebt die Station nicht');
  await page.locator('.cv-scale-wrapper [data-cv-edit$=".role"]').nth(1).click();
  await page.waitForTimeout(400);
  await page.locator('.cv-scale-wrapper .cv-entry-tools').nth(1).locator('button[aria-label="Nach oben"]').click();
  await page.waitForTimeout(1500);
  jetzt = await daten();
  pruefe(jetzt.experience[0]?.id === ids[0], 'Block-Werkzeug: „Nach oben" stellt die Reihenfolge nicht wieder her');
  await page.locator('.cv-scale-wrapper [data-cv-edit$=".role"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('.cv-scale-wrapper .cv-entry-tools').first().locator('button[aria-label="Duplizieren"]').click();
  await page.waitForTimeout(1500);
  jetzt = await daten();
  pruefe(jetzt.experience.length === ids.length + 1 && jetzt.experience[1].role === jetzt.experience[0].role && jetzt.experience[1].id !== jetzt.experience[0].id,
    'Block-Werkzeug: „Duplizieren" legt keine Kopie mit eigener Kennung an');
  await page.locator('.cv-scale-wrapper [data-cv-edit$=".role"]').nth(1).click();
  await page.waitForTimeout(400);
  await page.locator('.cv-scale-wrapper .cv-entry-tools').nth(1).locator('button[aria-label="Löschen"]').click();
  await page.waitForTimeout(1500);
  jetzt = await daten();
  pruefe(jetzt.experience.length === ids.length, 'Block-Werkzeug: „Löschen" entfernt die Kopie nicht');
  const nPunkte = jetzt.experience[0].bullets.length;
  await page.locator('.cv-scale-wrapper [data-cv-edit$=".role"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('.cv-scale-wrapper .cv-entry-tools').first().locator('button[aria-label="Punkt hinzufügen"]').click();
  await page.waitForTimeout(900);
  await page.keyboard.type('Neuer Punkt aus dem Prüflauf');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  jetzt = await daten();
  pruefe(jetzt.experience[0].bullets.length === nPunkte + 1 && jetzt.experience[0].bullets.at(-1).includes('Prüflauf'),
    '„+ Punkt": neuer Stichpunkt fehlt oder bekommt den Schreibzeiger nicht');
  const auszug = await page.evaluate(() => [...document.querySelectorAll('.cv-scale-wrapper .cv-page')].map(p => p.innerText).join('\n'));
  pruefe(!/[↑↓⧉]/.test(auszug), 'Block-Werkzeug steht im Textauszug der Seite');
}

// 4. Skill-Chips
{
  await page.click('nav[aria-label="Werkzeuge"] button:has-text("Inhalt")');
  await page.waitForTimeout(500);
  await page.click('button[aria-pressed]:has-text("Skills")');
  await page.waitForTimeout(400);
  const eingabe = page.locator('.ui-chipinput input').first();
  const n0 = (await daten()).skillGroups[0].items.length;
  await eingabe.click();
  await eingabe.type('Figma Prüflauf');
  await page.keyboard.press('Enter');
  await eingabe.type('Eins, Zwei,');
  await page.waitForTimeout(1300);
  let g = (await daten()).skillGroups[0].items;
  pruefe(g.length === n0 + 3 && g.includes('Figma Prüflauf') && g.includes('Eins') && g.includes('Zwei'), `Chips: Enter/Komma legen nicht richtig an (${g.length - n0} neu)`);
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);
  const markiert = await page.locator('.ui-chipinput').first().locator('.ui-skill[data-marked="true"]').count();
  pruefe(markiert === 1, 'Chips: erste Rücktaste markiert den letzten Chip nicht');
  g = (await daten()).skillGroups[0].items;
  pruefe(g.includes('Zwei'), 'Chips: erste Rücktaste löscht schon');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(1300);
  g = (await daten()).skillGroups[0].items;
  pruefe(!g.includes('Zwei'), 'Chips: zweite Rücktaste löscht nicht');
  const live = await page.locator('.ui-chipinput').first().locator('[role="status"]').textContent();
  pruefe(/entfernt/.test(live || ''), `Chips: Live-Region meldet das Entfernen nicht („${live}")`);
}

errors.forEach(e => problems.push(`Ausnahme: ${e}`));
await browser.close();
console.log(problems.length ? `${problems.length} Befund(e)` : 'Leinwand, Karussell, Block-Werkzeug, Chips ohne Befund ✓');
problems.forEach(p => console.log(`   ! ${p}`));
if (problems.length) process.exitCode = 1;
