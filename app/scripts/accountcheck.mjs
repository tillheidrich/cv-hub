// Die Wege mit Konto aus Runde 3 (09.10.2026) — einmal echt durchgeklickt,
// gegen einen laufenden cv-api hinter dem Vite-Proxy (/pdfapi → cv-api).
//
//   1. Ereignisse: beide Word-Knöpfe melden `docx`, das Druck-PDF `pdf_local`.
//   2. PDF-Dienst hat geantwortet (503/413): Klartext, KEIN Druckdialog.
//      Dienst nicht erreichbar: Druckdialog als Rückfall.
//   3. Fassung duplizieren — aus dem Menü (mit Rückgängig) und auf der
//      Profilübersicht; am Server liegen danach wirklich die Kopien.
//   4. „Foto entfernen" löscht die Datei am Server — aber nicht, solange eine
//      Kopie dasselbe Foto benutzt.
//   5. Sharelink „Stand aktualisieren" — auch direkt nach einer Änderung,
//      bevor das automatische Speichern gelaufen ist.
//   6. Laufzeit: Band 14 Tage vorher; Ablauf mitten in der Sitzung schaltet
//      auf „Nur lesen" (statt „Nicht gespeichert"); nach dem Neuladen bleiben
//      Felder gesperrt, es wird nichts gespeichert, das PDF geht weiter.
//   7. Abmelden fragt nach den lokalen Profilen: Standard „behalten",
//      „löschen" leert den Browser-Speicher.
//
// Voraussetzungen: Vite mit Proxy (HARNESS_BASE), cv-api mit Admin-Konto
// (ADMIN_USER, ADMIN_PASS) und einem PDF-Renderer. Das Skript legt einen
// Nutzer an (Einladungscode mit Laufzeit). Anmeldungen sind auf 5 je 15 min
// begrenzt — es meldet sich zweimal an; bei 429 den cv-api neu starten.
//
//   HARNESS_BASE=http://localhost:5201 ADMIN_USER=… ADMIN_PASS=… node scripts/accountcheck.mjs
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '';

const browser = await chromium.launch({ executablePath: EXEC });
const results = [];
const check = (ok, label, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
const step = t => console.log(`\n— ${t}`);
/** Bildschirmfotos zum Ansehen: SHOTS=/pfad/zum/ordner */
const shot = async name => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/account-${name}.png` }); };

/** fetch aus der Seite heraus (Cookies der Seite, gleicher Ursprung). */
const fetcher = page => (path, opts = {}) => page.evaluate(async ([p, o]) => {
  const r = await fetch('/pdfapi' + p, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...o });
  let body = null; try { body = await r.json(); } catch { /* kein JSON */ }
  return { status: r.status, body };
}, [path, opts]);

// ── Admin ──────────────────────────────────────────────────────────────────
const actx = await browser.newContext();
const admin = await actx.newPage();
await admin.goto(`${BASE}/`, { waitUntil: 'networkidle' });
const aj = fetcher(admin);
let r = await aj('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }) });
if (r.status !== 200) { console.log(`✗ Admin-Anmeldung: ${r.status} ${JSON.stringify(r.body)}`); await browser.close(); process.exit(1); }
r = await aj('/api/admin/invites', { method: 'POST', body: JSON.stringify({ maxUses: 1, accessDays: 30, note: 'accountcheck' }) });
const code = r.body?.code;
check(!!code, 'Einladungscode mit 30 Tagen Laufzeit');

const ymd = d => d.toISOString().slice(0, 10);
async function setUntil(userId, date) {
  const x = await aj(`/api/admin/users/${userId}/access`, { method: 'POST', body: JSON.stringify({ until: date ? ymd(date) : null }) });
  if (x.status !== 200) throw new Error(`Laufzeit setzen: ${x.status} ${JSON.stringify(x.body)}`);
}

// ── Nutzer ─────────────────────────────────────────────────────────────────
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
page.on('dialog', d => d.accept());
const uj = fetcher(page);
const events = [];
const photoDeletes = [];
const resumeWrites = [];
page.on('request', rq => {
  const u = rq.url();
  if (u.includes('/api/events') && rq.method() === 'POST') events.push(JSON.parse(rq.postData() || '{}').kind);
  if (/\/api\/photos\/[0-9a-f]{24}$/.test(u) && rq.method() === 'DELETE') photoDeletes.push(u.split('/').pop());
  if (/\/api\/resumes$/.test(u) && rq.method() === 'POST') resumeWrites.push(rq);
});

const localCount = () => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const q = indexedDB.open('cv-hub-local'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  if (!db.objectStoreNames.contains('profiles')) { db.close(); return 0; }
  const n = await new Promise(res => { const q = db.transaction('profiles').objectStore('profiles').count(); q.onsuccess = () => res(q.result); q.onerror = () => res(-1); });
  db.close();
  return n;
});
const serverResumes = async () => (await uj('/api/resumes')).body?.resumes ?? [];
const openMore = async () => { await page.getByRole('button', { name: 'Mehr', exact: true }).first().click(); await page.waitForTimeout(250); };
const openExportMenu = async () => { await page.locator('.ui-split button[aria-haspopup="menu"]').first().click(); await page.waitForTimeout(250); };

// Erst ohne Konto ausprobieren — das legt ein lokales Profil an.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  localStorage.clear();
  await new Promise(res => { const q = indexedDB.deleteDatabase('cv-hub-local'); q.onsuccess = q.onerror = q.onblocked = () => res(); });
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Direkt ausprobieren' }).first().click();
await page.waitForTimeout(1500);
check(await localCount() === 1, 'ein lokales Profil aus dem Ausprobieren', String(await localCount()));
await page.evaluate(() => localStorage.removeItem('appstudio-demo-mode'));

const username = `acc${Date.now().toString(36)}`;
const PW = 'Accountcheck-Pass1';
r = await uj('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password: PW, inviteCode: code }) });
check(r.status === 200 && !!r.body?.user?.access?.until, 'Registrierung, Laufzeit in der Antwort', r.body?.user?.access ? `${r.body.user.access.daysLeft} Tage` : String(r.status));
const userId = r.body?.user?.id;
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.getByRole('button', { name: /Neuer Lebenslauf/ }).first().click();
await page.getByRole('radio', { name: /Mit Beispiel/ }).click();
await page.locator('input[placeholder="z. B. Bewerbung Stadtwerke"]').fill('Bewerbung A');
await page.getByRole('button', { name: /Profil anlegen/ }).click();
await page.waitForTimeout(2000);
let list = await serverResumes();
check(list.length === 1, 'Profil am Server angelegt', String(list.length));
check(!(await page.locator('.ui-access-banner').count()), 'kein Laufzeit-Band bei 30 Tagen');

// ── 1. Ereignisse ──────────────────────────────────────────────────────────
step('Ereignisse');
for (const name of ['Word mit Design', 'Word – ATS-Fassung']) {
  await openExportMenu();
  await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('menuitem', { name: new RegExp(name) }).first().click()]);
  await page.waitForTimeout(400);
}
check(events.filter(k => k === 'docx').length === 2, 'beide Word-Knöpfe melden „docx"', events.join(','));

// ── 2. Antworten des PDF-Dienstes ──────────────────────────────────────────
step('PDF-Dienst');
await page.evaluate(() => {
  window.__printed = 0;
  window.print = () => { window.__printed++; setTimeout(() => window.dispatchEvent(new Event('afterprint')), 50); };
});
const pdfKnopf = page.locator('.ui-split button').first();
const pdfStatus = async () => (await page.getByRole('status').allInnerTexts()).join(' | ');
await page.route('**/api/pdf', route => route.fulfill({ status: 503, contentType: 'application/json', headers: { 'Retry-After': '30' },
  body: JSON.stringify({ error: 'Der PDF-Dienst ist gerade ausgelastet. Bitte in 30 Sekunden noch einmal versuchen.' }) }));
await pdfKnopf.click();
await page.waitForTimeout(1200);
let st = await pdfStatus();
check(/ausgelastet/.test(st) && /30 Sekunden/.test(st), '503: Klartext mit Wartezeit', st.slice(0, 120));
check(await page.evaluate(() => window.__printed) === 0, '503: kein Druckdialog');
await page.unroute('**/api/pdf');
await page.route('**/api/pdf', route => route.fulfill({ status: 413, contentType: 'application/json', body: JSON.stringify({ error: 'Das Dokument ist zu groß für den PDF-Export (höchstens 3 MB).' }) }));
await page.waitForTimeout(9500); // Meldung der Runde davor läuft ab
await pdfKnopf.click();
await page.waitForTimeout(1200);
st = await pdfStatus();
check(/zu groß/.test(st), '413: Klartext', st.slice(0, 120));
check(await page.evaluate(() => window.__printed) === 0, '413: kein Druckdialog');
await page.unroute('**/api/pdf');
await page.route('**/api/pdf', route => route.abort('failed'));
const vorDruck = events.length;
await pdfKnopf.click();
await page.waitForTimeout(2000);
const gedruckt = await page.evaluate(() => window.__printed);
check(gedruckt === 1, 'Dienst nicht erreichbar: Druckdialog als Rückfall', String(gedruckt));
check(events.slice(vorDruck).includes('pdf_local'), 'Druck-PDF meldet „pdf_local"', events.slice(vorDruck).join(','));
await page.unroute('**/api/pdf');
await page.waitForTimeout(500);

// ── 3. Duplizieren ─────────────────────────────────────────────────────────
step('Fassung duplizieren');
await openMore();
await page.getByRole('menuitem', { name: /Fassung duplizieren/ }).click();
await page.waitForTimeout(1500);
list = await serverResumes();
check(list.length === 2 && list.some(x => x.display_name === 'Bewerbung A (Kopie)'), 'Kopie „Bewerbung A (Kopie)" am Server', list.map(x => x.display_name).join(', '));
check(await page.getByRole('button', { name: /^Bewerbung A \(Kopie\) –/ }).count() > 0, 'Editor zeigt die Kopie');
await page.getByRole('status').filter({ hasText: 'angelegt' }).getByRole('button', { name: 'Rückgängig' }).click();
await page.waitForTimeout(1500);
list = await serverResumes();
check(list.length === 1, 'Rückgängig entfernt die Kopie wieder', String(list.length));
check(await page.getByRole('button', { name: /^Bewerbung A –/ }).count() > 0, 'zurück im Original');

// Foto hochladen (Konto: am Server), dann auf der Übersicht duplizieren.
step('Foto entfernen');
if (!(await page.getByRole('button', { name: 'Persönlich' }).count())) await page.getByRole('button', { name: 'Inhalt', exact: true }).first().click();
await page.getByRole('button', { name: 'Persönlich' }).first().click();
const jpeg = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 800;
  const g = c.getContext('2d'); g.fillStyle = '#7a9'; g.fillRect(0, 0, 600, 800);
  return c.toDataURL('image/jpeg', 0.9).split(',')[1];
});
await page.locator('input[type=file][accept="image/jpeg,image/png,image/webp"]').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
await page.getByRole('button', { name: 'Übernehmen' }).click();
await page.waitForTimeout(2500);
const orig = (await uj(`/api/resumes/${list[0].id}`)).body?.resume?.payload?.data?.de?.personal || {};
const ids = [orig.photo, orig.photoOriginal].map(u => /\/api\/photos\/([0-9a-f]{24})/.exec(u || '')?.[1]).filter(Boolean);
check(ids.length === 2, 'Foto und Original liegen am Server', ids.join(', '));
await page.getByRole('button', { name: 'Zurück zur Profilübersicht' }).first().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Duplizieren: Bewerbung A' }).click();
await page.waitForTimeout(1500);
list = await serverResumes();
const kopie = list.find(x => x.display_name === 'Bewerbung A (Kopie)');
check(list.length === 2 && !!kopie, 'Duplizieren auf der Profilübersicht', list.map(x => x.display_name).join(', '));
const kopieFoto = (await uj(`/api/resumes/${kopie?.id}`)).body?.resume?.payload?.data?.de?.personal?.photo || '';
check(ids.length > 0 && kopieFoto.includes(ids[0]), 'Kopie verweist auf dasselbe Foto');
// In der Kopie entfernen: das Original braucht das Foto noch.
await page.getByRole('button', { name: 'Lebenslauf „Bewerbung A (Kopie)" öffnen' }).click();
await page.waitForTimeout(1200);
if (!(await page.getByRole('button', { name: 'Persönlich' }).count())) await page.getByRole('button', { name: 'Inhalt', exact: true }).first().click();
await page.getByRole('button', { name: 'Persönlich' }).first().click();
await page.getByRole('button', { name: '× Entfernen' }).click();
await page.waitForTimeout(1500);
check(photoDeletes.length === 0, 'Kopie: kein Löschen am Server (Original benutzt das Foto)', photoDeletes.join(','));
check(((await uj(`/api/photos/${ids[0]}`)).status) !== 404, 'Foto am Server noch da');
// Im Original entfernen: jetzt benutzt es niemand mehr.
await page.getByRole('button', { name: 'Zurück zur Profilübersicht' }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: 'Lebenslauf „Bewerbung A" öffnen' }).click();
await page.waitForTimeout(1200);
if (!(await page.getByRole('button', { name: 'Persönlich' }).count())) await page.getByRole('button', { name: 'Inhalt', exact: true }).first().click();
await page.getByRole('button', { name: 'Persönlich' }).first().click();
await page.getByRole('button', { name: '× Entfernen' }).click();
await page.waitForTimeout(1500);
check(ids.every(id => photoDeletes.includes(id)), 'Original: Foto und Original am Server gelöscht', photoDeletes.join(','));

// ── 5. Sharelink ───────────────────────────────────────────────────────────
step('Sharelink');
await page.getByRole('button', { name: 'Export', exact: true }).first().click();
await page.waitForTimeout(800);
const activeId = (await page.evaluate(() => localStorage.getItem('appstudio-active-v2')));
await page.getByRole('button', { name: /Neuen Link erzeugen/ }).click();
await page.waitForTimeout(1200);
const shares = (await uj(`/api/resumes/${activeId}/shares`)).body?.shares || [];
const token = shares[0]?.token;
check(!!token, 'Sharelink angelegt');
check(await page.getByText('Der Link zeigt den Stand beim Anlegen.').count() > 0, 'Hinweis „Der Link zeigt den Stand beim Anlegen."');
const nameVorher = (await uj(`/api/share/${token}`)).body?.resume?.data?.de?.personal?.name;
// Name ändern und SOFORT auffrischen — vor dem automatischen Speichern.
await page.getByRole('button', { name: 'Inhalt', exact: true }).first().click();
await page.getByRole('button', { name: 'Persönlich' }).first().click();
await page.getByLabel('Name', { exact: true }).first().fill('Lena Neu');
await page.getByRole('button', { name: 'Export', exact: true }).first().click();
await page.getByRole('button', { name: 'Stand aktualisieren' }).first().click();
await page.waitForTimeout(1500);
const nameNachher = (await uj(`/api/share/${token}`)).body?.resume?.data?.de?.personal?.name;
check(nameVorher !== 'Lena Neu' && nameNachher === 'Lena Neu', 'Stand aktualisieren übernimmt auch die letzte Änderung', `${nameVorher} → ${nameNachher}`);
check(await page.getByText('Der Link zeigt jetzt den aktuellen Stand.').count() > 0, 'Rückmeldung nach dem Auffrischen');
await page.getByRole('button', { name: 'Export', exact: true }).first().click(); // Paneel zu

// ── 6. Laufzeit ────────────────────────────────────────────────────────────
step('Laufzeit');
await setUntil(userId, new Date(Date.now() + 10 * 86400000));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
let banner = await page.locator('.ui-access-banner').innerText().catch(() => '');
check(/Dein Zugang läuft am .* ab/.test(banner), 'Band 14 Tage vorher', banner.slice(0, 90));
await shot('band-bald');
// Ablauf mitten in der Sitzung.
const yesterday = new Date(Date.now() - 2 * 86400000);
await setUntil(userId, yesterday);
if (!(await page.getByLabel('Name', { exact: true }).count())) {
  await page.getByRole('button', { name: 'Inhalt', exact: true }).first().click();
  await page.getByRole('button', { name: 'Persönlich' }).first().click();
}
const abgelehnt = page.waitForResponse(rs => /\/api\/resumes$/.test(rs.url()) && rs.request().method() === 'POST', { timeout: 8000 }).catch(() => null);
await page.getByLabel('Name', { exact: true }).first().fill('Lena Abgelaufen');
const rs403 = await abgelehnt;
check(rs403?.status() === 403, 'Speichern nach Ablauf: 403 vom Server', String(rs403?.status()));
await page.waitForTimeout(1500);
const status = await page.locator('.ui-status').getAttribute('data-state');
check(status === 'readonly', 'Status „Nur lesen" statt „Nicht gespeichert"', status);
banner = await page.locator('.ui-access-banner').innerText().catch(() => '');
check(/abgelaufen/.test(banner), 'Band: Zugang abgelaufen', banner.slice(0, 90));
// Neu laden: der Nur-Lese-Modus kommt jetzt aus /api/auth/me.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
if (!(await page.getByLabel('Name', { exact: true }).count())) {
  await page.getByRole('button', { name: 'Inhalt', exact: true }).first().click();
  await page.getByRole('button', { name: 'Persönlich' }).first().click();
}
check(await page.getByLabel('Name', { exact: true }).first().isDisabled(), 'nach dem Neuladen: Felder gesperrt');
check(await page.getByText('Bearbeiten ist gesperrt, weil dein Zugang abgelaufen ist.').count() > 0, 'Erklärung im Inhalt-Paneel');
await shot('nur-lesen');
check(!(await page.locator('.cv-scale-wrapper [contenteditable="true"]').count()), 'kein Schreiben in der Vorschau');
const writesVorher = resumeWrites.length;
await page.getByRole('button', { name: 'Gestaltung', exact: true }).first().click();
await page.getByRole('radio', { name: /^Zürich,/ }).first().click();
await page.waitForTimeout(2000);
check(resumeWrites.length === writesVorher, 'Vorlagenwechsel wird nicht gespeichert', String(resumeWrites.length - writesVorher));
const pdfAntwort = page.waitForResponse(rs => /\/api\/pdf$/.test(rs.url()), { timeout: 45000 }).catch(() => null);
await page.locator('.ui-split button').first().click();
const pr = await pdfAntwort;
check(pr?.status() === 200, 'PDF-Export geht nach Ablauf weiter', String(pr?.status()));
await page.waitForTimeout(1000);
await page.getByRole('button', { name: 'Zurück zur Profilübersicht' }).first().click();
await page.waitForTimeout(600);
check(await page.getByRole('button', { name: /Neuer Lebenslauf/ }).first().isDisabled(), 'Übersicht: Anlegen gesperrt');
check(!(await page.getByRole('button', { name: /^Duplizieren:/ }).count()), 'Übersicht: kein Duplizieren');
await setUntil(userId, null);

// ── 7. Abmelden ────────────────────────────────────────────────────────────
step('Abmelden');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const abmelden = async () => {
  // Auf der Übersicht steht „Abmelden" oben, im Editor im Menü „Mehr".
  if (await page.getByRole('button', { name: 'Abmelden', exact: true }).count()) await page.getByRole('button', { name: 'Abmelden', exact: true }).first().click();
  else { await openMore(); await page.getByRole('menuitem', { name: 'Abmelden' }).click(); }
  await page.waitForTimeout(500);
};
await abmelden();
const dlg = page.getByRole('dialog', { name: 'Abmelden' });
check(await dlg.count() > 0, 'Rückfrage beim Abmelden');
await shot('abmelden');
check(await dlg.getByRole('radio', { name: /behalten/ }).isChecked(), 'Standard: lokale Profile behalten');
await dlg.getByRole('button', { name: 'Abmelden', exact: true }).click();
await page.waitForTimeout(1200);
check(await localCount() === 1, 'lokales Profil nach dem Abmelden noch da', String(await localCount()));
check((await uj('/api/auth/me')).status === 401, 'abgemeldet');
r = await uj('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password: PW }) });
check(r.status === 200, 'wieder angemeldet', String(r.status));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await abmelden();
await dlg.getByRole('radio', { name: /löschen/ }).check();
await dlg.getByRole('button', { name: 'Abmelden', exact: true }).click();
await page.waitForTimeout(1500);
check(await localCount() === 0, '„löschen": Browser-Speicher leer', String(await localCount()));

check(errors.length === 0, 'keine Laufzeitfehler', errors.join(' | '));
await browser.close();
const failed = results.filter(x => !x).length;
console.log(`\n${results.length - failed}/${results.length} Schritte bestanden`);
if (failed) process.exitCode = 1;
