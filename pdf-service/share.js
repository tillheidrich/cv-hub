// Sharelinks: was ein Empfänger zu sehen bekommt (N3, Technik-Bericht 08.10.2026).
//
// Vorher lieferte GET /api/share/:token den ganzen Datensatz: alle vier
// Sprachfassungen, Anschreiben in allen Sprachen, ausgeblendete Stationen,
// ausgeblendete Abschnitte — gerade Geburtsdatum, Familienstand und
// Staatsangehörigkeit, die man aus AGG-Gründen weglässt — und das
// unbeschnittene Originalfoto mit EXIF. Die Ansicht zeigte das nicht, das
// Entwicklerwerkzeug des Empfängers schon.
//
// Jetzt entsteht beim Anlegen eines Links ein fester Stand der SICHTBAREN
// Fassung: eine Sprache, nichts Ausgeblendetes, kein Original, das Foto nur
// als Zuschnitt und nur über den Link selbst. Spätere Änderungen am Profil
// ändern den Link nicht — der Empfänger sieht, was verschickt wurde.
//
// Reine Funktionen, ohne Datenbank: share.test.mjs prüft sie direkt.

export const LANGS = ['de', 'en', 'fr', 'es'];
export const SNAPSHOT_VERSION = 1;

const DETAIL_KEYS = ['birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'driversLicense'];
const SETTINGS_KEYS = ['template', 'accent', 'paper', 'fontScale', 'fontPairing', 'pageMode', 'pageFormat',
  'lang', 'sectionOrder', 'hiddenSections', 'sectionPages', 'respectTemplateStructure'];
const COVER_KEYS = ['company', 'contactPerson', 'companyAddress', 'city', 'date', 'subject', 'salutation',
  'intro', 'mainBody', 'companyReference', 'motivation', 'closing', 'signoff', 'showDateline', 'showSignature'];

/** Ein leeres Anschreiben. Die ShareView füllt fehlende Sprachen mit dem
 *  Muster-Anschreiben auf (withAllLangs) und zeigt dann einen Reiter
 *  „Anschreiben" mit Mustertext. Ein leeres Objekt in der Sprache des Links
 *  verhindert das: ohne Betreff und Text gibt es keinen Reiter. */
export const EMPTY_COVER_LETTER = Object.freeze(Object.fromEntries(
  COVER_KEYS.filter(k => !k.startsWith('show')).map(k => [k, '']),
));

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Foto-ID aus einer eigenen Foto-Adresse (…/api/photos/<24 hex>). */
export function photoIdOf(url) {
  const m = /\/api\/photos\/([0-9a-f]{24})(?:[?#]|$)/.exec(String(url || ''));
  return m ? m[1] : null;
}

/** Alle Foto-IDs, die in einem Text (JSON eines Profils) vorkommen. */
export function photoIdsIn(text) {
  const out = new Set();
  const re = /\/api\/photos\/([0-9a-f]{24})/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.add(m[1]);
  return [...out];
}

/** Welche Sprache zeigt der Link? Die eingestellte, sonst die erste vorhandene. */
export function shareLang(payload) {
  const want = payload?.settings?.lang;
  if (LANGS.includes(want) && payload?.data?.[want]) return want;
  return LANGS.find(l => payload?.data?.[l]) || 'de';
}

/**
 * Baut den festen Stand eines Links aus dem aktuellen Profil.
 *
 * @returns {{ v, lang, profile, coverLetter, photoId }}
 *   `profile`     AppProfile-Form mit genau einer Sprache, ohne `coverLetters`
 *   `coverLetter` Anschreiben der Sprache oder null — ausgeliefert wird es nur,
 *                 wenn der Link es erlaubt (include_cover_letter). So lässt sich
 *                 der Schalter später umlegen, ohne den Stand neu zu bauen.
 *   `photoId`     eigenes Foto, das über /api/share/:token/photo ausgeliefert wird
 *   `photoPath`   dessen Adresse für den Empfänger (relativ, mit Präfix wie /pdfapi)
 */
export function buildShareSnapshot(payload, token) {
  const lang = shareLang(payload);
  const src = payload?.data?.[lang] || {};
  const settingsIn = payload?.settings || {};
  const hidden = new Set(Array.isArray(settingsIn.hiddenSections) ? settingsIn.hiddenSections : []);

  const personal = { ...(clone(src.personal) || {}) };
  delete personal.photoOriginal;                        // nie herausgeben

  // Foto: nur der Zuschnitt, und nur, wenn er uns gehört (eigene Adresse)
  // oder eingebettet ist. Eine fremde Adresse wäre ein Zählpixel, das jeden
  // Aufruf des Empfängers an Dritte meldet.
  let photoId = null;
  let photoPath = null;
  const photo = String(personal.photo || '').trim();
  if (photo) {
    photoId = photoIdOf(photo);
    if (photoId) {
      photoPath = sharePhotoPath(photo, token);
      personal.photo = photoPath;                       // die Foto-ID selbst bleibt intern
    } else if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(photo)) {
      delete personal.photo;
    }
  }

  if (hidden.has('details')) for (const k of DETAIL_KEYS) delete personal[k];

  const cv = {
    personal,
    profile: hidden.has('profile') ? { text: '' } : { text: String(src.profile?.text || '') },
    experience: hidden.has('experience') ? [] : (Array.isArray(src.experience) ? clone(src.experience).filter(e => e && !e.hidden) : []),
    education: hidden.has('education') ? [] : (Array.isArray(src.education) ? clone(src.education) : []),
    skillGroups: hidden.has('skills') ? [] : (Array.isArray(src.skillGroups) ? clone(src.skillGroups) : []),
    languages: hidden.has('languages') ? [] : (Array.isArray(src.languages) ? clone(src.languages) : []),
    additionalExperience: hidden.has('additional') ? [] : (Array.isArray(src.additionalExperience) ? clone(src.additionalExperience) : []),
  };
  if (src.labels) cv.labels = clone(src.labels);

  const settings = {};
  for (const k of SETTINGS_KEYS) if (settingsIn[k] !== undefined) settings[k] = clone(settingsIn[k]);
  settings.lang = lang;

  const clIn = payload?.coverLetters?.[lang];
  let coverLetter = null;
  if (clIn && typeof clIn === 'object') {
    coverLetter = {};
    for (const k of COVER_KEYS) if (clIn[k] !== undefined) coverLetter[k] = clone(clIn[k]);
  }

  return {
    v: SNAPSHOT_VERSION,
    lang,
    // Kein Anzeigename („Bewerbung Acme" ist eine Notiz des Inhabers), keine
    // Profil-ID, kein Erstellungsdatum.
    profile: { id: 'share', displayName: '', createdAt: '', data: { [lang]: cv }, settings },
    coverLetter,
    photoId,
    photoPath,
  };
}

/**
 * Antwort für GET /api/share/:token — dieselbe Form wie vorher
 * ({ resume: AppProfile, include_cover_letter }), damit die ShareView
 * unverändert weiterläuft.
 */
export function shareResponse(snap, { includeCoverLetter }) {
  const profile = clone(snap.profile);
  profile.coverLetters = {
    [snap.lang]: includeCoverLetter && snap.coverLetter ? clone(snap.coverLetter) : { ...EMPTY_COVER_LETTER },
  };
  return { resume: profile, include_cover_letter: !!includeCoverLetter };
}

/** Pfad des Link-Fotos, gebaut aus der Form der ursprünglichen Foto-Adresse,
 *  damit ein Präfix wie /pdfapi erhalten bleibt. */
export function sharePhotoPath(originalPhotoUrl, token) {
  const s = String(originalPhotoUrl || '');
  const i = s.indexOf('/api/photos/');
  let prefix = i >= 0 ? s.slice(0, i) : '/pdfapi';
  // Nur den Pfad übernehmen; Host und Schema kommen aus der Konfiguration.
  try { if (/^https?:\/\//i.test(prefix)) prefix = new URL(prefix).pathname.replace(/\/+$/, ''); } catch { prefix = '/pdfapi'; }
  return `${prefix}/api/share/${token}/photo`;
}
