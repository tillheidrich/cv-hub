// Der lokale Speicher des Lokalmodus (IndexedDB) — einmal in jede Richtung.
//
// Technik-Bericht 08.10.2026, Abschnitt 4, Arbeitsblöcke 1–3 und 7. Geprüft
// wird zweigleisig:
//
//   A. Speicherschicht (data/storage.ts) direkt im Browser, über den
//      Entwicklungsserver importiert — läuft auf jedem Stand von App.tsx:
//        Altbestand aus localStorage wird übernommen, kaputte Einträge kosten
//        nicht die übrigen, gelöscht wird erst nach gelungener Schreibprobe;
//        scheitert die Probe, bleibt der Altbestand. Schreiben → neu laden →
//        identisch. Sicherung → alles löschen → Sicherung laden → identisch
//        (Fotos Zeichen für Zeichen). Ein Foto in vier Sprachen liegt einmal
//        da. Verlauf: höchstens 20 je Profil, Wiederherstellen umkehrbar.
//        Speicher voll → `false` und ein Fehler mit Art „quota", kein
//        „Gespeichert". Ein Foto mit 4 MB passt nach dem Herunterrechnen
//        unter die 3.000.000-Zeichen-Grenze des PDF-Dienstes.
//   B. Oberfläche (braucht die Einbindung in App.tsx, siehe Kopf von
//      ui/BackupReminder.tsx): Demo starten, Name und Foto setzen, neu laden →
//      alles da. Sicherungshinweis erscheint (mit Safari-Satz unter Safari),
//      „Jetzt sichern" lädt eine Datei, „Sicherung laden" zeigt vorher, was
//      überschrieben wird. Speicher voll → „Nicht gespeichert" in der Leiste
//      und eine rote Karte.
//
// Teil B wird übersprungen (nicht als bestanden gezählt), wenn
// LOCALSTORE_UI=0 gesetzt ist — für einen Stand ohne App-Einbindung.
//
//   HARNESS_BASE=http://localhost:5192 node scripts/localstorecheck.mjs
import { chromium } from 'playwright';
import { promises as fs } from 'fs';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WITH_UI = process.env.LOCALSTORE_UI !== '0';
const browser = await chromium.launch({ executablePath: EXEC });

const results = [];
const check = (ok, label, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };

/* Speicher voll auf Knopfdruck: Ist in sessionStorage `quota=1` gesetzt,
 * wirft jedes put/add in IndexedDB einen QuotaExceededError — genau wie ein
 * voller Speicher. Vor allen Skripten der Seite eingehängt, damit auch der
 * Start (Migration) es trifft. */
const QUOTA_HOOK = () => {
  const wrap = name => {
    const orig = IDBObjectStore.prototype[name];
    IDBObjectStore.prototype[name] = function (...a) {
      if (sessionStorage.getItem('quota') === '1') throw new DOMException('Speicher voll (Prüflauf)', 'QuotaExceededError');
      return orig.apply(this, a);
    };
  };
  wrap('put'); wrap('add');
};

async function freshPage(opts = {}) {
  const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
  await ctx.addInitScript(QUOTA_HOOK);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await wipe(page);
  return { ctx, page, errors };
}

async function wipe(page) {
  await page.evaluate(async () => {
    localStorage.clear(); sessionStorage.clear();
    // Eigene Verbindung der Seite schließen, sonst blockiert sie das Löschen.
    try { const m = await import('/src/data/localDb.ts'); await m.closeDb(); } catch { /* noch nicht geladen */ }
    await new Promise(res => { const r = indexedDB.deleteDatabase('cv-hub-local'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  });
}

/** Ruft eine Funktion des Speichermoduls in der Seite auf. */
const store = (page, fn, arg) => page.evaluate(async ([src, a]) => {
  const m = await import('/src/data/storage.ts');
  await m.whenLocalStoreReady();
  return await (new Function('m', 'a', `return (${src})(m, a);`))(m, a);
}, [fn.toString(), arg]);

/** Rohzugriff auf die Datenbank — was wirklich auf der Platte liegt. */
const raw = page => page.evaluate(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('cv-hub-local'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = s => new Promise((res, rej) => { const q = db.transaction(s).objectStore(s).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const out = { profiles: await all('profiles'), photos: (await all('photos')).map(p => ({ key: p.key, size: p.size, kind: p.bytes ? 'bytes' : 'text' })), versions: (await all('versions')).map(v => ({ vid: v.vid, profileId: v.profileId, source: v.source })) };
  db.close();
  return out;
});

/** Ein Profil, wie die App es anlegt, mit großem Foto. */
const makeProfile = (page, { name, id, photoSide = 700 }) => page.evaluate(async ([n, pid, side]) => {
  const m = await import('/src/data/storage.ts');
  const p = m.createBlankProfile(n);
  if (pid) p.id = pid;
  const c = document.createElement('canvas'); c.width = side; c.height = Math.round(side * 1.25);
  const g = c.getContext('2d');
  for (let y = 0; y < c.height; y += 8) for (let x = 0; x < c.width; x += 8) { g.fillStyle = `hsl(${(x * 7 + y * 3) % 360},60%,${40 + ((x + y) % 30)}%)`; g.fillRect(x, y, 8, 8); }
  const photo = c.toDataURL('image/jpeg', 0.9);
  for (const l of ['de', 'en', 'fr', 'es']) { p.data[l].personal.name = n; p.data[l].personal.photo = photo; p.data[l].personal.photoOriginal = photo; }
  return p;
}, [name, id, photoSide]);

/** Vergleich unabhängig von der Reihenfolge der Schlüssel. */
const canon = v => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x));

// ═══ A. Speicherschicht ══════════════════════════════════════════════════════
{
  const { ctx, page, errors } = await freshPage();

  // A1. Altbestand übernehmen — mit einem kaputten Eintrag dazwischen.
  const legacyProfile = await makeProfile(page, { name: 'Altbestand Erika', id: 'legacy01' });
  await page.evaluate(([p]) => {
    localStorage.setItem('appstudio-profiles-v2', JSON.stringify([p, { kaputt: true }, null]));
  }, [legacyProfile]);
  await page.reload({ waitUntil: 'networkidle' });
  let st = await store(page, m => m.getLocalStoreStatus());
  let ps = await store(page, m => m.loadProfilesAsync());
  check(st.backend === 'indexeddb', 'Speicher ist IndexedDB', st.backend);
  check(ps.length === 1 && ps[0].id === 'legacy01' && ps[0].data.de.personal.photo === legacyProfile.data.de.personal.photo,
    'localStorage-Altbestand übernommen, Foto unverändert', `${ps.length} Profil(e)`);
  check(st.migrated === 1 && st.skipped === 2, 'kaputte Einträge kosten nicht die übrigen', `übernommen ${st.migrated}, übersprungen ${st.skipped}`);
  const lsAfter = await page.evaluate(() => [localStorage.getItem('appstudio-profiles-v2'), localStorage.getItem('appstudio-profiles-v2.unlesbar')]);
  check(lsAfter[0] === null, 'Altbestand nach gelungener Schreibprobe entfernt');
  check(!!lsAfter[1] && lsAfter[1].includes('kaputt'), 'nicht lesbare Einträge bleiben roh aufbewahrt');
  let r = await raw(page);
  check(r.photos.length === 1 && r.photos[0].kind === 'bytes', 'ein Foto in vier Sprachen + Original liegt einmal, als Binärdaten', `${r.photos.length} Foto-Datensatz/-sätze`);

  // A2. Schreibprobe scheitert → Altbestand bleibt.
  await wipe(page);
  await page.evaluate(([p]) => { localStorage.setItem('appstudio-profiles-v2', JSON.stringify([p])); sessionStorage.setItem('quota', '1'); }, [legacyProfile]);
  await page.reload({ waitUntil: 'networkidle' });
  st = await store(page, m => m.getLocalStoreStatus());
  const lsKept = await page.evaluate(() => localStorage.getItem('appstudio-profiles-v2'));
  check(!!lsKept && st.migrated === 0 && st.lastError?.kind === 'quota', 'Schreibprobe gescheitert → Altbestand bleibt, Fehler gemeldet', st.lastError?.kind || 'kein Fehler');
  await page.evaluate(() => sessionStorage.removeItem('quota'));
  await page.reload({ waitUntil: 'networkidle' });
  st = await store(page, m => m.getLocalStoreStatus());
  check(st.migrated === 1 && st.lastError === null, 'beim nächsten Start klappt die Übernahme', `übernommen ${st.migrated}`);

  // A3. Schreiben → neu laden → identisch.
  await wipe(page);
  await page.reload({ waitUntil: 'networkidle' });
  const p1 = await makeProfile(page, { name: 'Erika Mustermann', id: 'p1' });
  const p2 = await makeProfile(page, { name: 'Max Muster', id: 'p2', photoSide: 500 });
  const okSave = await store(page, (m, a) => m.saveProfilesAsync(a), [p1, p2]);
  await page.reload({ waitUntil: 'networkidle' });
  ps = await store(page, m => m.loadProfilesAsync());
  check(okSave && canon(ps) === canon([p1, p2]), 'gespeichert, neu geladen, identisch (inkl. Fotos und Reihenfolge)');

  // A4. Sicherung → alles löschen → Sicherung laden → identisch.
  const backupText = await store(page, m => JSON.stringify(m.buildBackup()));
  const backupObj = JSON.parse(backupText);
  check(backupObj.format === 'cv-hub-backup' && Object.keys(backupObj.photos).length === 2 && !backupText.includes('idbphoto:'),
    'Sicherung: ein Format, jedes Foto einmal', `${Math.round(backupText.length / 1024)} KB, ${Object.keys(backupObj.photos).length} Fotos`);
  await store(page, m => m.clearLocalStore());
  await page.reload({ waitUntil: 'networkidle' });
  ps = await store(page, m => m.loadProfilesAsync());
  r = await raw(page);
  check(ps.length === 0 && r.profiles.length === 0 && r.photos.length === 0, 'alles gelöscht (auch Fotos)');
  const prev = await store(page, (m, t) => { const x = m.parseBackup(t); return x.ok ? m.previewRestore(x.backup) : x; }, backupText);
  check(prev.added?.length === 2 && prev.replaced?.length === 0, 'Vorschau: zwei kommen neu dazu');
  const restored = await store(page, async (m, t) => { const x = m.parseBackup(t); return (await m.restoreBackup(x.backup)).ok; }, backupText);
  await page.reload({ waitUntil: 'networkidle' });
  ps = await store(page, m => m.loadProfilesAsync());
  check(restored && canon(ps) === canon([p1, p2]), 'Sicherung geladen → identisch mit dem Stand vorher');

  // A5. Vorschau beim Überschreiben, Verlauf davor.
  const changed = JSON.parse(JSON.stringify(p1)); changed.data.de.personal.name = 'Erika Geändert';
  await store(page, (m, a) => m.saveProfilesAsync(a), [changed, p2]);
  const prev2 = await store(page, (m, t) => { const x = m.parseBackup(t); return m.previewRestore(x.backup); }, backupText);
  check(prev2.replaced.length === 2 && prev2.replaced.find(x => x.id === 'p1')?.same === false && prev2.replaced.find(x => x.id === 'p2')?.same === true,
    'Vorschau: zeigt, was überschrieben wird und was identisch ist');
  await store(page, async (m, t) => { const x = m.parseBackup(t); return m.restoreBackup(x.backup); }, backupText);
  const vers = await store(page, m => m.listLocalVersions('p1'));
  check(vers.some(v => v.source === 'backup_restore'), 'überschriebener Stand liegt im Verlauf', vers.map(v => v.source).join(','));
  const bad = await store(page, m => ['{', '{"format":"cv-hub-backup","version":99,"profiles":[]}', '{"x":1}'].map(t => { const x = m.parseBackup(t); return x.ok ? 'ok' : x.error; }));
  check(bad.join() === 'not_json,newer_version,wrong_format', 'falsche Dateien werden erkannt', bad.join());

  // A6. Verlauf: höchstens 20, Wiederherstellen umkehrbar.
  const many = await store(page, async (m, base) => {
    let p = base;
    for (let i = 0; i < 25; i++) {
      p = JSON.parse(JSON.stringify(p));
      // abwechselnd lang und kurz: jede Runde eine große Änderung → sofort ein Stand
      p.data.de.profile.text = i % 2 ? `Runde ${i}` : `Runde ${i} `.repeat(800);
      await m.saveProfilesAsync([p, ...m.loadProfiles().filter(x => x.id !== p.id)]);
    }
    return (await m.listLocalVersions(base.id)).length;
  }, p1);
  check(many === 20, 'Verlauf je Profil auf 20 begrenzt', `${many}`);
  const rest = await store(page, async (m) => {
    const list = await m.listLocalVersions('p1');
    const target = list[list.length - 1];                 // ältester
    const before = m.loadProfiles().find(p => p.id === 'p1').data.de.profile.text;
    const v = await m.getLocalVersion('p1', target.id);
    const restored = await m.restoreLocalVersion('p1', target.id);
    const after = m.loadProfiles().find(p => p.id === 'p1');
    const list2 = await m.listLocalVersions('p1');
    return { ok: after.data.de.profile.text === v.payload.data.de.profile.text && restored.id === 'p1', undo: list2[0].source === 'restore', changed: before !== after.data.de.profile.text, photo: after.data.de.personal.photo.startsWith('data:image/jpeg') };
  });
  check(rest.ok && rest.changed && rest.photo, 'alter Stand wiederhergestellt, Foto mit dabei');
  check(rest.undo, 'Stand vor der Wiederherstellung ist gesichert');

  // A7. Ein kaputter Datensatz in der Datenbank kostet nicht die übrigen.
  await page.evaluate(async () => {
    const db = await new Promise(res => { const r = indexedDB.open('cv-hub-local'); r.onsuccess = () => res(r.result); });
    await new Promise(res => { const t = db.transaction('profiles', 'readwrite'); t.objectStore('profiles').put({ id: 'kaputt', json: '{nicht json' }); t.oncomplete = res; });
    db.close();
  });
  await page.reload({ waitUntil: 'networkidle' });
  ps = await store(page, m => m.loadProfilesAsync());
  st = await store(page, m => m.getLocalStoreStatus());
  check(ps.length === 2 && st.skipped === 1, 'kaputter Datensatz übersprungen, die anderen geladen', `${ps.length} geladen, ${st.skipped} übersprungen`);
  r = await raw(page);
  check(r.profiles.some(x => x.id === 'kaputt'), 'kaputter Datensatz bleibt liegen (wird nicht gelöscht)');

  // A8. Speicher voll → sichtbarer Fehler, kein „Gespeichert".
  await page.evaluate(() => sessionStorage.setItem('quota', '1'));
  const q = await store(page, async (m) => {
    const ps2 = m.loadProfiles(); const p = JSON.parse(JSON.stringify(ps2[0])); p.data.de.personal.name = 'Voll';
    const ok = await m.saveProfilesAsync([p, ...ps2.slice(1)]);
    const sync = m.saveProfiles([p, ...ps2.slice(1)]);
    await m.flushLocalStore();
    return { ok, sync, err: m.getLocalStoreStatus().lastError?.kind };
  });
  check(q.ok === false && q.sync === false && q.err === 'quota', 'Speicher voll: false, Fehlerart „quota"', JSON.stringify(q));
  const bk = await store(page, m => m.buildBackup().profiles.length);
  check(bk === 2, 'Sicherung geht trotzdem (aus dem Arbeitsspeicher)');
  await page.evaluate(() => sessionStorage.removeItem('quota'));
  const healed = await store(page, async (m) => { const ok = await m.saveProfilesAsync(m.loadProfiles()); return ok && m.getLocalStoreStatus().lastError === null; });
  check(healed, 'nach freiem Speicher: Fehler verschwindet beim nächsten Speichern');

  // A9. 4-MB-Foto und die 3.000.000-Zeichen-Grenze des PDF-Dienstes.
  const pdf = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 3000; c.height = 3000;
    const g = c.getContext('2d'); const img = g.createImageData(3000, 3000);
    for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() * 255) | 0; img.data[i] = v; img.data[i + 1] = (v * 7) & 255; img.data[i + 2] = (v * 13) & 255; img.data[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    let q = 0.9, big = c.toDataURL('image/jpeg', q);
    while (big.length * 0.75 > 4.2 * 1024 * 1024 && q > 0.3) { q -= 0.1; big = c.toDataURL('image/jpeg', q); }
    const bytes = Math.round((big.length - 23) * 0.75);
    const { photoForPrint } = await import('/src/export/photoEmbed.ts');
    const small = await photoForPrint(big);
    const dims = await new Promise(res => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = small; });
    // Ganzes PDF-HTML messen: exportPdf mit abgefangener Anfrage.
    const { exportPdf } = await import('/src/export/exportHtml.ts');
    const { createDemoProfile } = await import('/src/data/storage.ts');
    const { metricsFor } = await import('/src/templates/metrics.ts');
    const prof = createDemoProfile('x');
    const cv = { ...prof.data.de, personal: { ...prof.data.de.personal, photo: big } };
    let sent = 0;
    const origFetch = window.fetch;
    window.fetch = async (u, o) => { if (String(u).endsWith('/api/pdf')) { sent = JSON.parse(o.body).html.length; return new Response(new Blob(['%PDF-1.4\n' + 'x'.repeat(2000)], { type: 'application/pdf' }), { status: 200 }); } return origFetch(u, o); };
    const origClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await exportPdf({ data: cv, cfg: { themeId: 'espoo', pairingId: 'auto', metrics: metricsFor(0, 1) } }); }
    finally { window.fetch = origFetch; HTMLAnchorElement.prototype.click = origClick; }
    return { bytes, bigChars: big.length, smallChars: small.length, dims, html: sent };
  });
  check(pdf.bytes > 3.5 * 1024 * 1024, 'Testfoto ist wirklich groß', `${(pdf.bytes / 1024 / 1024).toFixed(1)} MB, ${pdf.bigChars.toLocaleString('de-DE')} Zeichen`);
  check(Math.max(...pdf.dims) <= 1200, 'auf Druckgröße heruntergerechnet', `${pdf.dims.join('×')} px, ${pdf.smallChars.toLocaleString('de-DE')} Zeichen`);
  check(pdf.html > 0 && pdf.html <= 3_000_000, 'PDF-HTML mit 4-MB-Foto bleibt unter 3.000.000 Zeichen', `${pdf.html.toLocaleString('de-DE')} Zeichen`);

  check(errors.length === 0, 'keine Laufzeitfehler (Teil A)', errors.join(' | '));
  await ctx.close();
}

// ═══ B. Oberfläche (braucht die App-Einbindung) ══════════════════════════════
if (!WITH_UI) {
  console.log('… Teil B übersprungen (LOCALSTORE_UI=0)');
} else {
  const SAFARI_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const { ctx, page, errors } = await freshPage({ userAgent: SAFARI_UA });
  try {
  await page.route('**/api/pdf', route => route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Direkt ausprobieren' }).first().click();
  await page.waitForTimeout(1500);
  /* Das Formular „Persönlich" — je nach Stand der Oberfläche hinter der
   * Schiene „Inhalt". Das Namensfeld ist das <input>, nicht das gleichnamige
   * Direktschreib-Feld auf der Seite. */
  const nameField = () => page.getByLabel('Name', { exact: true }).and(page.locator('input')).first();
  const openPersonal = async () => {
    if (await nameField().isVisible().catch(() => false)) return;
    const inhalt = page.getByRole('button', { name: 'Inhalt', exact: true });
    if (await inhalt.count()) await inhalt.first().click().catch(() => {});
    await page.getByRole('button', { name: 'Persönlich' }).first().click().catch(() => {});
  };
  await openPersonal();
  await nameField().fill('Erika Lokal');
  const jpeg = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const g = c.getContext('2d'); g.fillStyle = '#58a'; g.fillRect(0, 0, 600, 800); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; });
  await page.locator('input[type=file][accept="image/jpeg,image/png,image/webp"]').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
  await page.getByRole('button', { name: 'Übernehmen' }).click();
  await page.waitForTimeout(2000);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const stuck = await page.getByText('Profile werden geladen…').count();
  await openPersonal();
  const nameAfter = await nameField().inputValue().catch(() => '');
  const imgAfter = await page.locator('img[src^="data:image/jpeg"]').count();
  check(!stuck && nameAfter === 'Erika Lokal', 'neu geladen: Name noch da', stuck ? 'hängt bei „Profile werden geladen…" (App-Einbindung fehlt)' : JSON.stringify(nameAfter));
  check(imgAfter > 0, 'neu geladen: Foto noch da');

  const rem = page.getByTestId('backup-reminder');
  const remText = await rem.innerText().catch(() => '');
  check(/nur in diesem Browser/.test(remText), 'Sicherungshinweis erscheint nach der ersten Bearbeitung');
  check(/Safari löscht Daten von Seiten, die du 7 Tage nicht besuchst/.test(remText), 'Safari-Hinweis unter Safari');
  const [dl] = await Promise.all([page.waitForEvent('download'), rem.getByRole('button', { name: 'Jetzt sichern' }).click()]);
  const fileText = await fs.readFile(await dl.path(), 'utf8');
  check(/\.cv\.json$/.test(dl.suggestedFilename()) && JSON.parse(fileText).profiles.length === 1, '„Jetzt sichern" lädt die Sicherungsdatei', dl.suggestedFilename());
  await page.waitForTimeout(400);
  check(!/nur in diesem Browser/.test(await rem.innerText().catch(() => '')), 'nach dem Sichern schweigt der Hinweis');

  // Ändern, dann die Sicherung über das Fenster laden — mit Vorschau.
  await openPersonal();
  await nameField().fill('Erika Später');
  await page.waitForTimeout(1500);
  // Das Sicherungsfenster: als eigener Knopf oder im „⋯"-Menü, je nach Stand der Leiste.
  const direct = page.getByRole('button', { name: 'Sicherung', exact: true });
  if (await direct.count()) await direct.first().click();
  else {
    await page.locator('button[aria-haspopup]').filter({ hasText: '⋯' }).first().click();
    await page.getByRole('menuitem', { name: /^Sicherung/ }).first().click();
  }
  await page.getByTestId('backup-file').setInputFiles({ name: 'sicherung.cv.json', mimeType: 'application/json', buffer: Buffer.from(fileText) });
  const preview = await page.getByTestId('backup-preview').innerText().catch(() => '');
  check(/Wird überschrieben/.test(preview) && /Demo · Lena Brandt/.test(preview), 'Vorschau nennt, was überschrieben wird');
  await page.getByTestId('backup-preview').getByRole('button', { name: 'Einspielen' }).click();
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await openPersonal();
  const nameRestored = await nameField().inputValue().catch(() => '');
  check(nameRestored === 'Erika Lokal', 'Sicherung eingespielt, Editor zeigt den gesicherten Stand', JSON.stringify(nameRestored));

  // Verlauf im Lokalmodus (VersionsPanel mit `local`).
  {
    const direct = page.getByRole('button', { name: 'Versionen', exact: true });
    if (await direct.count()) await direct.first().click();
    else {
      await page.locator('button[aria-haspopup]').filter({ hasText: '⋯' }).first().click();
      await page.getByRole('menuitem', { name: /^Versionen/ }).first().click();
    }
    await page.waitForTimeout(800);
    const body = await page.locator('body').innerText();
    check(/Stände in diesem Browser/.test(body) && /vor dem Einspielen einer Sicherung/.test(body), 'Versionen im Lokalmodus: lokaler Verlauf statt Konto-Sperre');
    await page.keyboard.press('Escape');
    const close = page.getByRole('button', { name: 'Schließen' });
    if (await close.count()) await close.first().click().catch(() => {});
    await page.mouse.click(5, 5);
    await page.waitForTimeout(300);
  }

  // Speicher voll in der Oberfläche.
  await page.evaluate(() => sessionStorage.setItem('quota', '1'));
  await openPersonal();
  await nameField().fill('Erika Voll');
  await page.waitForTimeout(2200);
  // Die Speicheranzeige der Leiste selbst (genau dieser Text), nicht die rote Karte.
  const unsaved = await page.getByText('Nicht gespeichert', { exact: true }).count();
  const savedShown = await page.getByText(/^(Gespeichert|Im Browser gespeichert)$/).count();
  const remState = await rem.getAttribute('data-state').catch(() => null);
  check(unsaved > 0 && savedShown === 0, 'Leiste zeigt „Nicht gespeichert" statt „Gespeichert"', `nicht gespeichert: ${unsaved}, gespeichert: ${savedShown}`);
  check(remState === 'error-quota' && /Speicher des Browsers ist voll/.test(await rem.innerText()), 'rote Karte: Speicher voll, mit „Jetzt sichern"');
  await page.evaluate(() => sessionStorage.removeItem('quota'));
  } catch (e) {
    await page.screenshot({ path: process.env.LOCALSTORE_SHOT || '/tmp/localstorecheck-fehler.png' }).catch(() => {});
    check(false, 'Teil B abgebrochen', String(e.message || e).split('\n')[0]);
  }

  check(errors.length === 0, 'keine Laufzeitfehler (Teil B)', errors.join(' | '));
  await ctx.close();
}

await browser.close();
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} Schritte bestanden`);
if (failed) process.exitCode = 1;
