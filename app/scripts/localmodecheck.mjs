// Der Weg zum ersten eigenen PDF ohne Konto — einmal echt durchgeklickt.
//
// Befunde aus dem Persona-Test vom 08.10.2026, jeder hier als Prüfschritt:
//
//   1. Demo startet mit einer ATS-starken Vorlage (nicht „Hamburg") und ohne
//      Platzhalterfoto.
//   2. Foto hochladen geht ohne Konto; es bleibt im Browser (data:-URL), das
//      Original ist neu codiert (keine EXIF-Daten mehr, auch kein GPS).
//   3. Der PDF-Export schickt das Foto eingebettet mit — keine Fotoadresse,
//      die der PDF-Dienst nachladen müsste.
//   4. Die ATS-Prüfung meldet beim Standard-Beispiel keine fehlende E-Mail.
//   5. Ein neues Profil übernimmt den Profiltitel NICHT als Personennamen.
//   6. Beim ersten Wechsel auf eine andere Dokumentsprache werden die
//      Kontaktdaten übernommen, mit Hinweis.
//   7. Der Markdown-Import läuft ohne Konto im Browser.
//
// Läuft gegen den Vite-Entwicklungsserver; der PDF-Dienst wird nicht
// gebraucht — die Anfrage an /api/pdf wird abgefangen und ihr Inhalt geprüft.
//
//   node scripts/localmodecheck.mjs
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXEC });
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));

const results = [];
const check = (ok, label, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
const profiles = () => page.evaluate(() => JSON.parse(localStorage.getItem('appstudio-profiles-v2') || '[]'));

let pdfBody = null;
await page.route('**/api/pdf', async route => {
  pdfBody = route.request().postData();
  await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n' + 'x'.repeat(2000) + '\n%%EOF' });
});

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Direkt ausprobieren' }).first().click();
await page.waitForTimeout(1500);

// 1.
let ps = await profiles();
check(ps.length === 1 && ps[0].settings.template === 'espoo', 'Demo startet mit Espoo', ps[0]?.settings.template);
check(!ps[0]?.data.de.personal.photo, 'Demo ohne Platzhalterfoto');

// 2. Foto mit EXIF-Block erzeugen und hochladen.
const jpeg = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 800;
  const g = c.getContext('2d'); g.fillStyle = '#7a9'; g.fillRect(0, 0, 600, 800); g.fillStyle = '#fff'; g.fillRect(200, 200, 200, 300);
  const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];
  const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  // APP1/Exif mit gültigem, leerem TIFF-Kopf und einer Markierung dahinter.
  const marker = new TextEncoder().encode('GPSLatitude=53.3194N;GPSLongitude=9.6964E');
  const tiff = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const payload = [...new TextEncoder().encode('Exif\0\0'), ...tiff, ...marker];
  const len = payload.length + 2;
  const app1 = [0xff, 0xe1, len >> 8, len & 0xff, ...payload];
  const out = new Uint8Array(bytes.length + app1.length);
  out.set(bytes.subarray(0, 2)); out.set(app1, 2); out.set(bytes.subarray(2), 2 + app1.length);
  let bin = ''; out.forEach(x => { bin += String.fromCharCode(x); });
  return btoa(bin);
});
check(Buffer.from(jpeg, 'base64').includes('GPSLatitude'), 'Testfoto trägt eine GPS-Markierung (Gegenprobe)');
await page.getByRole('button', { name: 'Persönlich' }).first().click().catch(() => {});
await page.locator('input[type=file][accept="image/jpeg,image/png,image/webp"]').setInputFiles({ name: 'handy.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
await page.getByRole('button', { name: 'Übernehmen' }).click();
await page.waitForTimeout(1500);
ps = await profiles();
const pers = ps[0].data.de.personal;
const orig = Buffer.from((pers.photoOriginal || '').split(',')[1] || '', 'base64');
check((pers.photo || '').startsWith('data:image/jpeg'), 'Foto liegt als data:-URL im Browser');
check(orig.length > 0 && !orig.includes('Exif') && !orig.includes('GPSLatitude'), 'Original ohne EXIF/GPS neu codiert', `${Math.round(orig.length / 1024)} KB`);

// 3. PDF-Export
await page.getByRole('button', { name: 'Export', exact: true }).first().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: /als PDF herunterladen/ }).first().click();
await page.waitForTimeout(2000);
const html = pdfBody ? JSON.parse(pdfBody).html : '';
check(!!html, 'PDF-Anfrage abgeschickt');
check(/src="data:image\/jpeg/.test(html), 'Foto im PDF-HTML eingebettet');
check(!/api\/photos/.test(html) && !/FOTO/.test(html), 'keine Fotoadresse, kein Platzhalter im PDF-HTML');

// 4. ATS-Prüfung
await page.getByRole('button', { name: /ATS prüfen/ }).first().click();
await page.waitForTimeout(800);
const atsText = await page.locator('body').innerText();
check(/tatsächlich exportierten Dokuments/.test(atsText) && atsText.includes('lena.brandt@example.com'), 'ATS-Prüfung geöffnet, liest den Exporttext');
check(!/taucht im exportierten Dokument nicht als Text auf/.test(atsText), 'ATS-Prüfung ohne falsche E-Mail-Lücke');
await page.keyboard.press('Escape');
await page.mouse.click(5, 5);
await page.waitForTimeout(300);

// 5. Neues Profil
await page.getByRole('button', { name: 'Zurück zur Profilübersicht' }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Neuer Lebenslauf/ }).first().click();
await page.locator('input[placeholder="z. B. Bewerbung Stadtwerke"]').fill('Bewerbung Stadtwerke');
await page.getByRole('button', { name: /Profil anlegen/ }).click();
await page.waitForTimeout(1500);
ps = await profiles();
const neu = ps.find(p => p.displayName === 'Bewerbung Stadtwerke');
check(!!neu && neu.data.de.personal.name === '', 'Profiltitel landet nicht im Namensfeld', neu ? JSON.stringify(neu.data.de.personal.name) : 'kein Profil');
check(neu?.settings.template === 'espoo', 'Neues Profil mit Espoo');

// 6. Sprache wechseln
await page.getByLabel('E-Mail', { exact: true }).first().fill('erika@example.org');
await page.getByLabel('Name', { exact: true }).first().fill('Erika Mustermann');
await page.waitForTimeout(1200);
await page.getByRole('group', { name: 'Sprache des Lebenslaufs' }).getByRole('button', { name: 'EN' }).click();
await page.waitForTimeout(1500);
const notice = await page.getByRole('status').filter({ hasText: 'Kontaktdaten aus DE übernommen' }).count();
ps = await profiles();
const en = ps.find(p => p.displayName === 'Bewerbung Stadtwerke')?.data.en.personal;
check(en?.email === 'erika@example.org' && en?.name === 'Erika Mustermann', 'Kontaktdaten in EN übernommen');
check(notice > 0, 'Hinweis „Kontaktdaten übernommen" sichtbar');

// 7. Markdown-Import ohne Konto
await page.getByRole('button', { name: 'Export', exact: true }).first().click();
await page.waitForTimeout(500);
const md = ['---', 'lang: en', '---', '', '# Erika Mustermann', '**Project Manager**', '', '## Kontakt', '- E-Mail: erika@example.org',
  '', '## Berufserfahrung', '', '### Project Manager', 'Stadtwerke Lüneburg · Lüneburg · 01/2020 – heute', '- Led the rollout of a customer portal', ''].join('\n');
await page.locator('input[type=file][accept=".md,text/markdown,text/plain"]').setInputFiles({ name: 'cv.md', mimeType: 'text/markdown', buffer: Buffer.from(md) });
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Vorschau|Preview/ }).last().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Änderungen übernehmen|Apply changes/ }).click();
await page.waitForTimeout(1500);
ps = await profiles();
const after = ps.find(p => p.displayName === 'Bewerbung Stadtwerke')?.data.en;
check(after?.experience?.[0]?.company === 'Stadtwerke Lüneburg' && after?.personal?.title === 'Project Manager', 'Markdown-Import ohne Konto übernommen');

// 8. Rundweg: Markdown aus der Demo herunterladen und unverändert zurückspielen.
const vorher = (await profiles()).find(p => p.displayName === 'Bewerbung Stadtwerke')?.data.en;
const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('button').filter({ hasText: /^Markdown/ }).first().click(),
]);
const mdBack = await (await import('fs')).promises.readFile(await dl.path(), 'utf8');
await page.locator('input[type=file][accept=".md,text/markdown,text/plain"]').setInputFiles({ name: 'zurueck.md', mimeType: 'text/markdown', buffer: Buffer.from(mdBack) });
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Vorschau|Preview/ }).last().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Änderungen übernehmen|Apply changes/ }).click();
await page.waitForTimeout(1500);
const nachher = (await profiles()).find(p => p.displayName === 'Bewerbung Stadtwerke')?.data.en;
const kern = cv => JSON.stringify([cv?.personal?.name, cv?.personal?.email, cv?.personal?.title,
  (cv?.experience || []).map(e => [e.role, e.company, e.location, e.start, e.end, e.bullets])]);
check(!!vorher && kern(vorher) === kern(nachher), 'Markdown hin und zurück ohne Verlust', kern(vorher) === kern(nachher) ? '' : `${kern(vorher)} ≠ ${kern(nachher)}`);
check(!/^template:/m.test(mdBack), 'Markdown ohne Einstellungen trägt keine template:-Zeile');

check(errors.length === 0, 'keine Laufzeitfehler', errors.join(' | '));
await browser.close();
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} Schritte bestanden`);
if (failed) process.exitCode = 1;
