// Two-way Markdown bridge for CV profiles.
// cvToMarkdown(profile) → string for an AI to read
// markdownToCV(md, existingProfile) → updated profile to write back

/* H1 (09.10.2026, ReDoS): Grenzen für den Import. Ein Profil hat höchstens
 * 200 KB (guards.js), mehr Markdown ergibt kein sinnvolles Profil. Zeilen
 * über 2000 Zeichen sind keine Listenzeile — sie werden in den Listen-
 * Abschnitten übersprungen, statt in einen regulären Ausdruck zu laufen. */
export const MAX_MARKDOWN_CHARS = 200_000;
export const MAX_LINE_CHARS = 2000;

/**
 * Sprachzeile „- Deutsch – Muttersprache (5/5)“ zerlegen, OHNE Backtracking.
 *
 * Ersetzt /^[-*+]\s*([^—–-]+?)\s*[—–-]\s*(.+)$/ — der lief kubisch: Eine Zeile
 * „- “ + 3000 Leerzeichen + „a“ hielt die Event-Loop sekundenlang an
 * (3 KB → /health 8,8 s). Ergebnis ist für jede Eingabe dasselbe wie beim
 * alten Ausdruck (Sprache und Stufe getrimmt), nur in linearer Zeit:
 * - Aufzählungszeichen - * + am Anfang, danach mindestens ein Zeichen vor
 *   dem ersten Strich (— – -); der erste Strich trennt.
 * - Nach dem Strich muss etwas stehen; führender Leerraum zählt nicht mit,
 *   ein Zeilenumbruch (\n \r \u2028 \u2029) im Rest lässt die Zeile fallen.
 * Gibt { language, level } zurück oder null.
 */
export function splitLanguageLine(t) {
  if (typeof t !== 'string' || t.length > MAX_LINE_CHARS) return null;
  const c = t.charAt(0);
  if (c !== '-' && c !== '*' && c !== '+') return null;
  const rest = t.slice(1);
  const k = rest.search(/[—–-]/);
  if (k < 1) return null;
  const tail = lineTail(rest.slice(k + 1));
  if (tail === null) return null;
  return { language: rest.slice(0, k).trim(), level: tail.trim() };
}

/**
 * Was `\s*(.+)$` (ohne m-Flag) von `after` übrig lässt, oder null: führender
 * Leerraum fällt weg, danach mindestens ein Zeichen und kein Zeilenumbruch
 * (\n \r \u2028 \u2029 — die trifft `.` nicht). Linear.
 */
function lineTail(after) {
  if (!after.length) return null;
  const lead = after.length - after.trimStart().length;
  const tail = after.slice(Math.min(lead, after.length - 1));
  return /[\n\r\u2028\u2029]/.test(tail) ? null : tail;
}

/**
 * Schlüsselzeile „- E-Mail: a@b.de“ (Kontakt, Empfänger, Kopf des
 * Anschreibens), OHNE Backtracking. Ersetzt /^-\s*([^:]+):\s*(.+)$/ — der lief
 * quadratisch: eine Zeile „- “ + 40.000 Tabs + „x“ hielt den Dienst 1,9 s an,
 * 200 KB rund 45 s (Nachprüfung Runde 6, über H1 hinaus). Ergebnis wie beim
 * alten Ausdruck: key = Text zwischen „-“ und dem ersten Doppelpunkt ohne
 * führenden Leerraum (besteht er nur aus Leerraum: dessen letztes Zeichen),
 * value = Rest nach dem Doppelpunkt (ungetrimmt wie m[2]; Aufrufer trimmen).
 */
export function splitKeyLine(t) {
  if (typeof t !== 'string' || t.charAt(0) !== '-') return null;
  const colon = t.indexOf(':', 1);
  if (colon < 2) return null;
  const tail = lineTail(t.slice(colon + 1));
  if (tail === null) return null;
  const seg = t.slice(1, colon);
  return { key: seg.replace(/^\s+/, '') || seg.slice(-1), value: tail };
}

function val(s) { return (s ?? '').toString().trim(); }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
/** Bounds an incoming string to N chars after trimming. Protects every parsed
 *  personal-info / contact field from arbitrary-length LLM output that could
 *  bloat the JSONB column or break templates. (Security audit finding #9.) */
function clipField(s, max = 240) {
  const str = (s ?? '').toString().trim();
  return str.length > max ? str.slice(0, max) : str;
}

/** Strip leading/trailing bold (**) and italic (*) markers from a heading.
 *  Many LLMs emit `### **Senior Engineer**` for role titles — without this
 *  helper the asterisks ended up in the displayed CV. */
function stripMd(s) {
  return (s ?? '').toString()
    .trim()
    .replace(/^\*\*(.*)\*\*$/, '$1')
    .replace(/^\*(.*)\*$/, '$1')
    .replace(/^_(.*)_$/, '$1')
    .trim();
}

const KNOWN_SOCIALS = ['linkedin','github','xing','twitter','x','bluesky','mastodon','instagram','youtube','tiktok','behance','dribbble','medium','substack'];
function normalisePlatform(k) {
  const lower = k.toLowerCase();
  if (lower === 'x') return 'twitter';
  return KNOWN_SOCIALS.includes(lower) ? lower : null;
}

// ── Überschriften und Feldschlüssel je Sprache (seit 17.11.2026) ────────────
//
// Bis dahin schrieb die Brücke immer deutsche Überschriften („## Kontakt",
// „## Berufserfahrung", „- Telefon:"), auch in einen englischen CV — die
// Startseite verspricht aber `## Experience`, und wer seine Datei einer KI
// gibt, bekommt sonst ein deutsch-englisches Gemisch zurück. Jetzt schreibt
// jede Sprache ihre eigenen Wörter. Gelesen werden weiterhin ALLE vier
// Sprachen (sectionOf, extraSectionOf, FIELD_RE, Kontaktschlüssel): eine
// ältere deutsche Datei und ein Gemisch aus Kopien bleiben lesbar.
//
// Dieselbe Tabelle steht in app/src/export/exportMarkdown.ts (Schreiben im
// Browser) und app/src/import/markdownBridge.ts (Anschreiben im Browser).
// Wer hier ein Wort ändert, ändert es dort auch — und prüft, dass die Parser
// es noch erkennen (markdown.test.mjs, app/scripts/sectionsroundtrip.mjs).

export const MD_LANGS = ['de', 'en', 'fr', 'es'];

export const MD_HEADS = {
  de: {
    contact: 'Kontakt', profile: 'Profil', experience: 'Berufserfahrung', education: 'Ausbildung',
    skills: 'Skills', languages: 'Sprachen', additional: 'Weiteres', projects: 'Projekte',
    certificates: 'Zertifikate', volunteering: 'Ehrenamt', publications: 'Publikationen', custom: 'Abschnitt',
    email: 'E-Mail', phone: 'Telefon', location: 'Ort', website: 'Website', birthDate: 'Geburtsdatum',
    driversLicense: 'Führerschein', nationality: 'Staatsangehörigkeit', maritalStatus: 'Familienstand',
    role: 'Rolle', period: 'Zeitraum', link: 'Link', issuer: 'Aussteller', date: 'Datum',
    credentialId: 'Kennung', publisher: 'Verlag', subtitle: 'Untertitel', present: 'heute',
  },
  en: {
    contact: 'Contact', profile: 'Profile', experience: 'Experience', education: 'Education',
    skills: 'Skills', languages: 'Languages', additional: 'Additional information', projects: 'Projects',
    certificates: 'Certifications', volunteering: 'Volunteering', publications: 'Publications', custom: 'Section',
    email: 'Email', phone: 'Phone', location: 'Location', website: 'Website', birthDate: 'Date of birth',
    driversLicense: 'Driving licence', nationality: 'Nationality', maritalStatus: 'Marital status',
    role: 'Role', period: 'Period', link: 'Link', issuer: 'Issuer', date: 'Date',
    credentialId: 'ID', publisher: 'Publisher', subtitle: 'Subtitle', present: 'Present',
  },
  fr: {
    contact: 'Contact', profile: 'Profil', experience: 'Expérience professionnelle', education: 'Formation',
    skills: 'Compétences', languages: 'Langues', additional: 'Informations complémentaires', projects: 'Projets',
    certificates: 'Certifications', volunteering: 'Bénévolat', publications: 'Publications', custom: 'Section',
    email: 'E-mail', phone: 'Téléphone', location: 'Adresse', website: 'Site web', birthDate: 'Date de naissance',
    driversLicense: 'Permis de conduire', nationality: 'Nationalité', maritalStatus: 'Situation familiale',
    role: 'Rôle', period: 'Période', link: 'Lien', issuer: 'Émetteur', date: 'Date',
    credentialId: 'Identifiant', publisher: 'Éditeur', subtitle: 'Sous-titre', present: 'à ce jour',
  },
  es: {
    contact: 'Contacto', profile: 'Perfil', experience: 'Experiencia profesional', education: 'Formación',
    skills: 'Competencias', languages: 'Idiomas', additional: 'Información adicional', projects: 'Proyectos',
    certificates: 'Certificaciones', volunteering: 'Voluntariado', publications: 'Publicaciones', custom: 'Sección',
    email: 'Correo electrónico', phone: 'Teléfono', location: 'Ubicación', website: 'Sitio web', birthDate: 'Fecha de nacimiento',
    driversLicense: 'Permiso de conducir', nationality: 'Nacionalidad', maritalStatus: 'Estado civil',
    role: 'Rol', period: 'Periodo', link: 'Enlace', issuer: 'Emisor', date: 'Fecha',
    credentialId: 'ID', publisher: 'Editorial', subtitle: 'Subtítulo', present: 'actualidad',
  },
};

export const CL_HEADS = {
  de: {
    recipient: 'Empfänger', company: 'Firma', contactPerson: 'Ansprechpartner', companyAddress: 'Adresse',
    header: 'Kopf', city: 'Ort', date: 'Datum', subject: 'Betreff', salutation: 'Anrede', intro: 'Einstieg',
    mainBody: 'Hauptteil', companyReference: 'Firmenbezug', motivation: 'Motivation', closing: 'Abschluss', signoff: 'Grußformel',
  },
  en: {
    recipient: 'Recipient', company: 'Company', contactPerson: 'Contact person', companyAddress: 'Address',
    header: 'Header', city: 'City', date: 'Date', subject: 'Subject', salutation: 'Salutation', intro: 'Introduction',
    mainBody: 'Main body', companyReference: 'Why this company', motivation: 'Motivation', closing: 'Closing', signoff: 'Sign-off',
  },
  fr: {
    recipient: 'Destinataire', company: 'Entreprise', contactPerson: 'Interlocuteur', companyAddress: 'Adresse',
    header: 'En-tête', city: 'Lieu', date: 'Date', subject: 'Objet', salutation: 'Formule d’appel', intro: 'Introduction',
    mainBody: 'Corps', companyReference: 'Pourquoi cette entreprise', motivation: 'Motivation', closing: 'Conclusion', signoff: 'Formule de politesse',
  },
  es: {
    recipient: 'Destinatario', company: 'Empresa', contactPerson: 'Persona de contacto', companyAddress: 'Dirección',
    header: 'Encabezado', city: 'Lugar', date: 'Fecha', subject: 'Asunto', salutation: 'Saludo', intro: 'Introducción',
    mainBody: 'Cuerpo', companyReference: 'Por qué esta empresa', motivation: 'Motivación', closing: 'Cierre', signoff: 'Despedida',
  },
};

const headsOf = lang => MD_HEADS[lang] || MD_HEADS.de;

/** Wörter für „läuft noch" — wie `isPresentWord` in app/src/data/extraSections.ts. */
const PRESENT_WORDS = /^(?:present|today|now|current(?:ly)?|ongoing|till date|to date|heute|bis heute|aktuell|derzeit|hoy|actualidad|la actualidad|presente|aujourd['’]hui|présent|à ce jour|en cours)$/i;
const isPresentWord = v => PRESENT_WORDS.test(val(v).replace(/[.\s]+$/, ''));

/** Ende einer Stelle in der Sprache des CV: Synonym für „läuft noch" oder
 *  leeres Ende bei vorhandenem Beginn → Beschriftung (`labels.misc.present`). */
function jobEnd(cv, lang, start, end) {
  const label = val(cv?.labels?.misc?.present) || headsOf(lang).present;
  if (isPresentWord(end)) return label;
  if (!val(end) && val(start)) return label;
  return val(end);
}

export function cvToMarkdown(profile, targetLang) {
  // targetLang erlaubt, eine ANDERE Sprachfassung zu lesen als die gerade
  // eingestellte. Ohne das kommt man über die Brücke nur an die aktive
  // Sprache heran — und genau so bleiben fremdsprachige Fassungen mit
  // Demo-Inhalt stehen, ohne dass es jemand merkt.
  const lang = (targetLang && profile?.data?.[targetLang]) ? targetLang : (profile?.settings?.lang || 'de');
  const cv = profile?.data?.[lang];
  if (!cv) return '';
  const out = [];

  out.push('---');
  out.push(`template: ${profile.settings?.template || 'hamburg'}`);
  out.push(`lang: ${lang}`);
  out.push(`fontScale: ${profile.settings?.fontScale ?? 1.0}`);
  out.push(`fontPairing: ${profile.settings?.fontPairing || 'auto'}`);
  out.push(`pageMode: ${profile.settings?.pageMode || 'one'}`);
  out.push('---');
  out.push('');

  const H = headsOf(lang);
  const p = cv.personal || {};
  out.push(`# ${val(p.name)}`);
  if (val(p.title)) out.push(`**${val(p.title)}**`);
  out.push('');

  out.push(`## ${H.contact}`);
  if (val(p.email)) out.push(`- ${H.email}: ${val(p.email)}`);
  if (val(p.phone)) out.push(`- ${H.phone}: ${val(p.phone)}`);
  if (val(p.location)) out.push(`- ${H.location}: ${val(p.location)}`);
  if (val(p.website)) out.push(`- ${H.website}: ${val(p.website)}`);
  // Socials — emit both the new list and the legacy fields if present
  if (Array.isArray(p.socials)) {
    for (const s of p.socials) {
      if (val(s.value)) out.push(`- ${capitalize(s.platform)}: ${val(s.value)}`);
    }
  }
  if (val(p.linkedin)) out.push(`- LinkedIn: ${val(p.linkedin)}`);
  if (val(p.instagram)) out.push(`- Instagram: ${val(p.instagram)}`);
  if (val(p.birthDate)) out.push(`- ${H.birthDate}: ${val(p.birthDate)}`);
  if (val(p.driversLicense)) out.push(`- ${H.driversLicense}: ${val(p.driversLicense)}`);
  if (val(p.nationality)) out.push(`- ${H.nationality}: ${val(p.nationality)}`);
  if (val(p.maritalStatus)) out.push(`- ${H.maritalStatus}: ${val(p.maritalStatus)}`);
  out.push('');

  if (val(cv.profile?.text)) {
    out.push(`## ${H.profile}`);
    out.push(val(cv.profile.text));
    out.push('');
  }

  if (Array.isArray(cv.experience) && cv.experience.length) {
    out.push(`## ${H.experience}`);
    out.push('');
    for (const e of cv.experience) {
      if (e.hidden) continue;
      out.push(`### ${val(e.role)}`);
      const dates = `${val(e.start)} – ${jobEnd(cv, lang, e.start, e.end)}`.trim();
      const meta = [val(e.company), val(e.location), dates !== '–' ? dates : ''].filter(Boolean).join(' · ');
      if (meta) out.push(meta);
      for (const b of (e.bullets || [])) if (val(b)) out.push(`- ${val(b)}`);
      out.push('');
    }
  }

  if (Array.isArray(cv.education) && cv.education.length) {
    out.push(`## ${H.education}`);
    out.push('');
    for (const e of cv.education) {
      out.push(`### ${val(e.degree)}`);
      const dates = `${val(e.start)} – ${val(e.end)}`.trim();
      const meta = [val(e.institution), val(e.location), dates !== '–' ? dates : ''].filter(Boolean).join(' · ');
      if (meta) out.push(meta);
      if (val(e.notes)) out.push(val(e.notes));
      out.push('');
    }
  }

  if (Array.isArray(cv.skillGroups) && cv.skillGroups.length) {
    out.push(`## ${H.skills}`);
    out.push('');
    for (const g of cv.skillGroups) {
      out.push(`### ${val(g.label)}`);
      for (const item of (g.items || [])) if (val(item)) out.push(`- ${val(item)}`);
      out.push('');
    }
  }

  if (Array.isArray(cv.languages) && cv.languages.length) {
    out.push(`## ${H.languages}`);
    for (const l of cv.languages) {
      // Dot scale gets emitted as a trailing "(N/5)" so the round-trip
      // through an LLM editor preserves the visual rating. The parser
      // strips that suffix back out and writes it to l.dots.
      const suffix = (typeof l.dots === 'number' && l.dots >= 1 && l.dots <= 5) ? ` (${l.dots}/5)` : '';
      out.push(`- ${val(l.language)} — ${val(l.level)}${suffix}`);
    }
    out.push('');
  }

  if (Array.isArray(cv.additionalExperience) && cv.additionalExperience.length) {
    out.push(`## ${H.additional}`);
    for (const item of cv.additionalExperience) if (val(item)) out.push(`- ${val(item)}`);
    out.push('');
  }

  out.push(...extraSectionsToMarkdown(cv, lang));

  return out.join('\n');
}

// ── Eigene Abschnitte (seit 09.10.2026) ─────────────────────────────────────
//
// Projekte, Zertifikate, Ehrenamt, Publikationen und freie Abschnitte. Das
// Format ist mit app/src/export/exportMarkdown.ts (Schreiben im Browser) und
// app/src/import/markdownBridge.ts (Lesen im Browser) Zeichen für Zeichen
// gleich — wer hier etwas ändert, ändert alle drei. Geprüft in
// markdown.test.mjs und app/scripts/sectionsroundtrip.mjs.
//
//   ## Projekte                 ## Zertifikate         ## Ehrenamt
//   ### Titel                   ### Name               ### Rolle
//   Rolle: …                    Aussteller: …          Verein · Ort · 2018 – heute
//   Zeitraum: 03/2023 – 11/2023 Datum: …               - Stichpunkt
//   Link: …                     Kennung: …
//   Beschreibung als Absatz     Link: …                ## Publikationen
//   - Stichpunkt                                       ### Titel
//                                                      Verlag: … / Datum: … / Link: …
//   ## Abschnitt: Eigene Überschrift                   Beschreibung als Absatz
//   - reiner Stichpunkt
//   ### Eintrag (darf leer sein: „###")
//   Untertitel: … / Datum: …
//   Text als Absatz
//
// Feldzeilen haben feste deutsche Schlüssel wie im Kontaktblock: sie sind
// Schlüssel für den Parser, keine Beschriftung. Gelesen werden auch die
// englischen (Role, Period, Issuer, Date, ID, Publisher, Subtitle).
// Leere Felder fallen weg; ein Eintrag ohne Titel steht als „###" da, damit
// er beim Zurücklesen nicht im vorigen aufgeht.

const isArr = Array.isArray;
const extraList = v => (isArr(v) ? v.filter(x => x && typeof x === 'object') : []);
const extraLines = v => (isArr(v) ? v.map(val).filter(Boolean) : []);
/** Zeitraum so, dass Anfang und Ende auch einzeln wieder lesbar sind. */
function periodLine(start, end, key = 'Zeitraum') {
  const a = val(start), b = val(end);
  if (!a && !b) return '';
  return `${key}: ${[a, '–', b].filter(Boolean).join(' ')}`;
}

export function extraSectionsToMarkdown(cv, lang) {
  const H = headsOf(lang || cv?.labels?.lang);
  const out = [];
  const heading = t => out.push(t ? `### ${t}` : '###');
  const field = (k, v) => { if (val(v)) out.push(`${k}: ${val(v)}`); };
  const text = v => { if (val(v)) out.push(val(v)); };
  const bullets = v => { for (const b of extraLines(v)) out.push(`- ${b}`); };

  const projects = extraList(cv.projects).filter(p => val(p.title) || val(p.role) || val(p.description) || val(p.url) || extraLines(p.bullets).length);
  if (projects.length) {
    out.push(`## ${H.projects}`, '');
    for (const p of projects) {
      heading(val(p.title));
      field(H.role, p.role);
      const per = periodLine(p.start, p.end, H.period); if (per) out.push(per);
      field(H.link, p.url);
      text(p.description);
      bullets(p.bullets);
      out.push('');
    }
  }

  const certs = extraList(cv.certificates).filter(c => val(c.name) || val(c.issuer) || val(c.credentialId) || val(c.url));
  if (certs.length) {
    out.push(`## ${H.certificates}`, '');
    for (const c of certs) {
      heading(val(c.name));
      field(H.issuer, c.issuer);
      field(H.date, c.date);
      field(H.credentialId, c.credentialId);
      field(H.link, c.url);
      out.push('');
    }
  }

  const vols = extraList(cv.volunteering).filter(v => val(v.role) || val(v.organization) || extraLines(v.bullets).length);
  if (vols.length) {
    out.push(`## ${H.volunteering}`, '');
    for (const v of vols) {
      heading(val(v.role));
      const dates = (val(v.start) || val(v.end)) ? `${val(v.start)} – ${val(v.end)}`.trim() : '';
      const meta = [val(v.organization), val(v.location), dates].filter(Boolean).join(' · ');
      if (meta) out.push(meta);
      bullets(v.bullets);
      out.push('');
    }
  }

  const pubs = extraList(cv.publications).filter(p => val(p.title) || val(p.publisher) || val(p.url) || val(p.description));
  if (pubs.length) {
    out.push(`## ${H.publications}`, '');
    for (const p of pubs) {
      heading(val(p.title));
      field(H.publisher, p.publisher);
      field(H.date, p.date);
      field(H.link, p.url);
      text(p.description);
      out.push('');
    }
  }

  for (const c of extraList(cv.customSections)) {
    const items = extraLines(c.items);
    const entries = extraList(c.entries).filter(e => val(e.title) || val(e.subtitle) || val(e.text));
    if (!items.length && !entries.length) continue;
    out.push(`## ${H.custom}: ${val(c.title)}`.trimEnd());
    for (const it of items) out.push(`- ${it}`);
    out.push('');
    for (const e of entries) {
      heading(val(e.title));
      field(H.subtitle, e.subtitle);
      field(H.date, e.date);
      text(e.text);
      out.push('');
    }
  }
  return out;
}

/** Abschnittsart der eigenen Abschnitte — oder null. Vor den übrigen
 *  Abschnitten geprüft: „Volunteer experience" ist kein Berufsweg. */
export function extraSectionOf(title) {
  const t = val(title).toLowerCase();
  if (/^(abschnitt|section|secci[oó]n)\s*:/.test(t)) return 'custom';
  if (/^(projekte?|projects?|projets?|proyectos?)\b/.test(t)) return 'projects';
  if (/zertifikat|certific/.test(t)) return 'certificates';
  if (/ehrenamt|volunteer|b[ée]n[ée]volat|voluntariado/.test(t)) return 'volunteering';
  if (/publikation|publication|veröffentlichung|publicaci[oó]n/.test(t)) return 'publications';
  return null;
}

/* Feldschlüssel aller vier Sprachen (MD_HEADS). Im Wörterbuch FIELD_KEY
 * klein geschrieben, wie `toLowerCase()` sie liefert. */
const FIELD_RE = /^(rolle|role|rôle|rol|zeitraum|period|période|periodo|dates?|link|lien|enlace|url|aussteller|issuer|émetteur|emisor|datum|fecha|kennung|identifiant|id|credential(?:\s*id)?|verlag|publisher|éditeur|editorial|ort\/verlag|untertitel|subtitle|sous-titre|subtítulo)\s*:\s*(.*)$/i;
const FIELD_KEY = {
  rolle: 'role', role: 'role', 'rôle': 'role', rol: 'role',
  zeitraum: 'period', period: 'period', 'période': 'period', periodo: 'period', date: 'date', dates: 'period',
  link: 'url', lien: 'url', enlace: 'url', url: 'url',
  aussteller: 'issuer', issuer: 'issuer', 'émetteur': 'issuer', emisor: 'issuer', datum: 'date', fecha: 'date',
  kennung: 'credentialId', identifiant: 'credentialId', id: 'credentialId', credential: 'credentialId', 'credential id': 'credentialId', credentialid: 'credentialId',
  verlag: 'publisher', publisher: 'publisher', 'éditeur': 'publisher', editorial: 'publisher', 'ort/verlag': 'publisher',
  untertitel: 'subtitle', subtitle: 'subtitle', 'sous-titre': 'subtitle', 'subtítulo': 'subtitle',
};
/** Welche Feldzeilen in welchem Abschnitt Felder sind — alles andere ist Text. */
const FIELDS_IN = {
  projects: ['role', 'period', 'url'],
  certificates: ['issuer', 'date', 'credentialId', 'url'],
  publications: ['publisher', 'date', 'url'],
  custom: ['subtitle', 'date'],
  volunteering: [],
};
function splitPeriod(v) {
  // Eingabe ist das Feld „Zeitraum:“, schon auf 240 Zeichen gekürzt (clipField) —
  // der lazy-Ausdruck unten ist quadratisch, die Kürzung hält ihn klein (Runde 6).
  v = val(v).slice(0, 240);
  const m = val(v).match(/^(.*?)\s*(?:[–—]|\s-\s)\s*(.*)$/) || val(v).match(/^(.*?)\s*[–—-]\s*$/);
  if (!m) return { start: val(v), end: '' };
  return { start: val(m[1]), end: val(m[2] ?? '') };
}

/**
 * Parser für die eigenen Abschnitte. Bekommt die Zeilen EINES Abschnitts
 * (ohne die `##`-Zeile) und hängt das Ergebnis an `cv`. `uid` liefert Kennungen.
 */
export function parseExtraSection(kind, title, sectionLines, cv, uid) {
  const SHORT = 240, LONG = 2000;
  const entries = [];
  let cur = null;
  const items = [];
  const flush = () => { if (cur) { cur.text = cur.textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(); entries.push(cur); cur = null; } };
  for (let i = 0; i < sectionLines.length; i++) {
    const t = sectionLines[i].trim();
    if (/^###(\s|$)/.test(t)) {
      flush();
      cur = { title: clipField(stripMd(t.slice(3)), SHORT), fields: {}, textLines: [], bullets: [], meta: null };
      if (kind === 'volunteering') {
        let j = i + 1;
        while (j < sectionLines.length && !sectionLines[j].trim()) j++;
        const nxt = (sectionLines[j] || '').trim();
        if (j < sectionLines.length && nxt && !/^[-*+]\s/.test(nxt) && !nxt.startsWith('#')) { cur.meta = stripMd(nxt); i = j; }
      }
      continue;
    }
    if (/^[-*+]\s/.test(t)) {
      const b = clipField(t.slice(2), LONG);
      if (!b) continue;
      if (!cur) { if (kind === 'custom') items.push(b); continue; }
      /* Wo der Eintrag keine Stichpunkte kennt, gehört die Zeile zum Text —
       * so, wie sie dasteht. */
      if (kind === 'custom' || kind === 'publications') cur.textLines.push(sectionLines[i].trimEnd());
      else cur.bullets.push(b);
      continue;
    }
    if (!cur) continue;
    const f = t.match(FIELD_RE);
    const key = f ? FIELD_KEY[f[1].toLowerCase().replace(/\s+/g, ' ')] : null;
    if (f && key && FIELDS_IN[kind].includes(key) && !cur.textLines.length) { cur.fields[key] = clipField(f[2], SHORT); continue; }
    if (cur.textLines.length || t) cur.textLines.push(sectionLines[i].trimEnd());
  }
  flush();
  if (kind === 'projects') {
    if (!cv.projects) cv.projects = [];
    for (const e of entries) {
      const p = splitPeriod(e.fields.period);
      cv.projects.push({ id: uid('prj'), title: e.title, role: e.fields.role || '', start: p.start, end: p.end, url: e.fields.url || '', description: clipField(e.text, LONG), bullets: e.bullets });
    }
  } else if (kind === 'certificates') {
    if (!cv.certificates) cv.certificates = [];
    for (const e of entries) cv.certificates.push({ id: uid('crt'), name: e.title, issuer: e.fields.issuer || '', date: e.fields.date || '', credentialId: e.fields.credentialId || '', url: e.fields.url || '' });
  } else if (kind === 'volunteering') {
    if (!cv.volunteering) cv.volunteering = [];
    for (const e of entries) {
      const m = e.meta ? parseMeta(e.meta) : { company: '', location: '', start: '', end: '' };
      cv.volunteering.push({ id: uid('vol'), role: e.title, organization: clipField(m.company, SHORT), location: clipField(m.location, SHORT), start: m.start, end: m.end, bullets: e.bullets });
    }
  } else if (kind === 'publications') {
    if (!cv.publications) cv.publications = [];
    for (const e of entries) cv.publications.push({ id: uid('pub'), title: e.title, publisher: e.fields.publisher || '', date: e.fields.date || '', url: e.fields.url || '', description: clipField(e.text, LONG) });
  } else if (kind === 'custom') {
    /* Eine Überschrift ohne Inhalt ist kein Abschnitt. */
    if (!items.length && !entries.length) return;
    if (!cv.customSections) cv.customSections = [];
    cv.customSections.push({
      id: uid('sec'),
      title: clipField(val(title).replace(/^(abschnitt|section|secci[oó]n)\s*:\s*/i, ''), SHORT),
      items,
      entries: entries.map(e => ({ id: uid('ent'), title: e.title, subtitle: e.fields.subtitle || '', date: e.fields.date || '', text: clipField(e.text, LONG) })),
    });
  }
}

// ── Parser ──────────────────────────────────────────────────────────────────

function parseMeta(line) {
  const parts = line.split('·').map(p => p.trim());
  const out = { company: '', location: '', start: '', end: '' };
  const dateIdx = parts.findIndex(p => /\d{2,4}|heute|present|today|actualidad|à ce jour/i.test(p) && /[–\-—]/.test(p));
  let dated = '';
  if (dateIdx >= 0) { dated = parts[dateIdx]; parts.splice(dateIdx, 1); }
  if (dated) {
    const [s, e] = dated.split(/[–—-]/).map(s => s.trim());
    out.start = s || '';
    out.end = e || '';
  }
  if (parts[0]) out.company = parts[0];
  if (parts[1]) out.location = parts[1];
  return out;
}

/* Erkennt die Überschriften aller vier Sprachen (MD_HEADS). „Weiteres" vor
 * „Ausbildung": „Información adicional" und „Informations complémentaires"
 * enthalten „formación"/„formation". */
function sectionOf(title) {
  const t = title.toLowerCase();
  if (/profil|perfil/.test(t)) return 'profile';
  if (/berufserfahrung|experience|exp[ée]rience|experiencia|werdegang/.test(t)) return 'experience';
  if (/weiteres|additional|compl[ée]mentaires|divers|adicional/.test(t)) return 'additional';
  if (/ausbildung|education|formation|formaci[oó]n/.test(t)) return 'education';
  if (/skills|kenntnisse|fähigkeiten|comp[ée]tences|competencias|habilidades/.test(t)) return 'skills';
  if (/sprachen|languages|langues|idiomas/.test(t)) return 'languages';
  if (/kontakt|contact/.test(t)) return 'contact';
  return null;
}

/* Kontaktschlüssel aller vier Sprachen (MD_HEADS). */
const KEY_LOCATION = /ort|location|adresse|address|ubicaci[oó]n|direcci[oó]n/;
const KEY_NOT_LOCATION = /e[-\s]?mail|correo|telefon|phone|tel[ée]fono|website|web|portfolio|site|sitio/;

export function markdownToCV(md, existing, targetLang) {
  if (String(md ?? '').length > MAX_MARKDOWN_CHARS) throw new Error(`Markdown zu groß (höchstens ${MAX_MARKDOWN_CHARS / 1000} KB)`);
  const out = JSON.parse(JSON.stringify(existing));
  // Ein Profil ohne `settings` gibt es im Normalbetrieb nicht — aber ein
  // Import darf an einem fehlenden Feld nicht mit einem 500er enden.
  if (!out.settings) out.settings = {};
  if (!out.data) out.data = {};
  const lang = out.settings?.lang || 'de';
  // Eine Übersetzung einzuspielen darf die eingestellte Sprache des Profils
  // NICHT umstellen. Wer die französische Fassung schreibt, will nicht, dass
  // das Profil danach auf Französisch steht.
  const keepLang = out.settings?.lang;

  // Frontmatter
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  let body = md;
  if (fm) {
    body = fm[2];
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (!m) continue;
      const k = m[1], v = m[2].trim();
      if (k === 'template') out.settings.template = v;
      else if (k === 'lang' && ['de', 'en', 'fr', 'es'].includes(v)) out.settings.lang = v;
      // Grenzen wie bei update_resume_settings (Audit 10.10.2026, S9).
      else if (k === 'fontScale') { const f = parseFloat(v); out.settings.fontScale = Number.isFinite(f) ? Math.min(1.4, Math.max(0.6, f)) : 1.0; }
      else if (k === 'fontPairing') { if (/^[a-z0-9-]{1,40}$/.test(v)) out.settings.fontPairing = v; }
      else if (k === 'pageMode' && ['one', 'two', 'three', 'four', 'auto'].includes(v)) out.settings.pageMode = v;
      else if (k === 'pageFormat' && ['a4', 'letter', 'legal', 'a5'].includes(v)) out.settings.pageFormat = v;
    }
  }

  const useLang = targetLang || out.settings.lang;
  if (targetLang && keepLang) out.settings.lang = keepLang;
  const existingCv = out.data?.[useLang] || existing?.data?.[lang] || {};
  const cv = {
    personal: { name: '', title: '', location: '', email: '', phone: '' },
    profile: { text: '' },
    experience: [],
    education: [],
    skillGroups: [],
    languages: [],
    additionalExperience: [],
    labels: existingCv.labels, // preserve labels (i18n)
  };

  /* H1: Zeilen über MAX_LINE_CHARS sind keine Markdown-Struktur — leer statt
   * in die Ausdrücke. Ausnahme: der Profiltext, dort läuft keiner (rawLines). */
  const rawLines = body.split('\n').map(l => l.replace(/\r$/, ''));
  const lines = rawLines.map(l => (l.length > MAX_LINE_CHARS ? '' : l));
  let section = null;
  let curExp = null, curEdu = null, curSkill = null;
  let profileLines = [];
  const flushExp = () => { if (curExp) { cv.experience.push(curExp); curExp = null; } };
  const flushEdu = () => { if (curEdu) { cv.education.push(curEdu); curEdu = null; } };
  const flushSkill = () => { if (curSkill) { cv.skillGroups.push(curSkill); curSkill = null; } };
  const flushProfile = () => { if (section === 'profile') { cv.profile.text = profileLines.join('\n').trim(); profileLines = []; } };

  const uid = p => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let lastContact = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith('## ')) {
      flushExp(); flushEdu(); flushSkill(); flushProfile();
      const title = t.slice(3).trim();
      /* Eigene Abschnitte lesen ihren ganzen Block auf einmal, bis zur
       * nächsten `##`-Zeile oder dem Namen. */
      const kind = extraSectionOf(title);
      if (kind) {
        let j = i + 1;
        while (j < lines.length && !/^#{1,2}\s/.test(lines[j].trim())) j++;
        parseExtraSection(kind, title, lines.slice(i + 1, j), cv, uid);
        section = null;
        i = j; continue;
      }
      section = sectionOf(title);
      i++; continue;
    }

    if (t.startsWith('# ')) {
      cv.personal.name = clipField(t.slice(2).trim(), 120);
      i++;
      while (i < lines.length && !lines[i].trim()) i++;
      if (i < lines.length) {
        const m = lines[i].trim().match(/^\*\*(.+)\*\*$/);
        if (m) { cv.personal.title = clipField(m[1].trim(), 160); i++; }
      }
      continue;
    }

    if (section === 'profile') { profileLines.push(rawLines[i]); i++; continue; }

    if (section === 'contact') {
      const m = splitKeyLine(t);   // ohne Backtracking (Runde 6)
      if (m) {
        const k = m.key.toLowerCase(), v = clipField(m.value.trim(), 240);
        if (/e[-\s]?mail|correo/.test(k)) cv.personal.email = v;
        else if (/telefon|phone|tel[ée]fono/.test(k)) cv.personal.phone = v;
        // Website vor Ort: „Portfolio" enthält „ort".
        else if (/website|web|portfolio|site|sitio/.test(k)) cv.personal.website = v;
        else if (KEY_LOCATION.test(k)) cv.personal.location = v;
        else if (/geburtsdatum|date of birth|date de naissance|fecha de nacimiento/.test(k)) cv.personal.birthDate = v;
        else if (/führerschein|drivers? licen[sc]e|driving licen[sc]e|permis|permiso de conducir/.test(k)) cv.personal.driversLicense = v;
        else if (/staatsangehörigkeit|nationality|nationalit[ée]|nacionalidad/.test(k)) cv.personal.nationality = v;
        else if (/familienstand|marital|situation familiale|estado civil/.test(k)) cv.personal.maritalStatus = v;
        else {
          // Try to recognise the key as a social platform
          const plat = normalisePlatform(k);
          if (plat) {
            if (!cv.personal.socials) cv.personal.socials = [];
            cv.personal.socials.push({ id: `s-${Date.now()}-${cv.personal.socials.length}`, platform: plat, value: v });
          }
        }
        lastContact = KEY_LOCATION.test(k) && !KEY_NOT_LOCATION.test(k) ? 'location' : '';
      } else if (t && lastContact === 'location' && !/^[-*+]\s/.test(t)) {
        // Zweizeilige Anschrift: die zweite Zeile steht ohne Spiegelstrich
        // unter „- Ort:" und fiel bis zum 09.10.2026 beim Einlesen weg.
        cv.personal.location = clipField(`${cv.personal.location}\n${t}`, 240);
      } else lastContact = '';
      i++; continue;
    }

    if (section === 'experience') {
      if (t.startsWith('### ')) {
        flushExp();
        // Bei vielen LLM-Outputs ist der Eintrag ein bold ### **Senior Engineer**.
        // stripMd() trimmt die ** Sterne weg damit nicht "**Senior Engineer**"
        // als Role-Wert landet.
        curExp = {
          id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: stripMd(t.slice(4)), company: '', location: '', start: '', end: '', bullets: [],
        };
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length) {
          const nxt = lines[i].trim();
          if (!nxt.startsWith('-') && !nxt.startsWith('*') && !nxt.startsWith('+') && !nxt.startsWith('#')) {
            Object.assign(curExp, parseMeta(stripMd(nxt)));
            i++;
          }
        }
        continue;
      }
      // CommonMark erlaubt - * + als Bullet-Marker. Nicht alle LLMs nutzen `-`.
      if (/^[-*+]\s/.test(t)) { if (curExp) curExp.bullets.push(t.slice(2).trim()); i++; continue; }
      i++; continue;
    }

    if (section === 'education') {
      if (t.startsWith('### ')) {
        flushEdu();
        curEdu = {
          id: `edu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          degree: stripMd(t.slice(4)), institution: '', location: '', start: '', end: '',
        };
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length) {
          const nxt = lines[i].trim();
          if (!nxt.startsWith('-') && !nxt.startsWith('*') && !nxt.startsWith('+') && !nxt.startsWith('#')) {
            const meta = parseMeta(stripMd(nxt));
            curEdu.institution = meta.company;
            curEdu.location = meta.location;
            curEdu.start = meta.start;
            curEdu.end = meta.end;
            i++;
          }
        }
        continue;
      }
      // Anmerkung unter der Kopfzeile: wird geschrieben, fiel aber bis zum
      // 09.10.2026 beim Einlesen weg.
      if (t && curEdu && !/^[-*+]\s/.test(t)) curEdu.notes = clipField(curEdu.notes ? `${curEdu.notes}\n${t}` : t, 2000);
      i++; continue;
    }

    if (section === 'skills') {
      if (t.startsWith('### ')) { flushSkill(); curSkill = { label: stripMd(t.slice(4)), items: [] }; i++; continue; }
      if (/^[-*+]\s/.test(t)) { if (curSkill) curSkill.items.push(t.slice(2).trim()); i++; continue; }
      i++; continue;
    }

    if (section === 'languages') {
      // CommonMark: erlaubt - * + als Bullet. Ohne Backtracking (H1), siehe splitLanguageLine.
      const m = splitLanguageLine(t);
      if (m) {
        let level = m.level;
        // Strip trailing "(N/5)" or "(N)" — that's our dot rating, not
        // part of the human-readable level label.
        // Ohne führendes \s* (quadratisch auf Leerraum); level ist schon getrimmt, das Ergebnis gleich.
        const dotMatch = level.match(/\((\d)(?:\/5)?\)\s*$/);
        let dots;
        if (dotMatch) {
          dots = Math.max(1, Math.min(5, parseInt(dotMatch[1], 10)));
          level = level.slice(0, dotMatch.index).trim();
        }
        const entry = { language: m.language, level };
        if (dots) entry.dots = dots;
        cv.languages.push(entry);
      }
      i++; continue;
    }

    if (section === 'additional') {
      if (/^[-*+]\s/.test(t)) cv.additionalExperience.push(t.slice(2).trim());
      i++; continue;
    }

    i++;
  }

  flushExp(); flushEdu(); flushSkill(); flushProfile();

  // Carry over the photo + any other personal fields that the MD doesn't carry
  // (photo lives outside MD; we don't want to lose it on import).
  cv.personal.photo = existingCv.personal?.photo;
  if (existingCv.personal?.subtitle && !cv.personal.subtitle) cv.personal.subtitle = existingCv.personal.subtitle;

  out.data[useLang] = cv;
  return out;
}

// ── Cover Letter Markdown bridge ────────────────────────────────────────────

export function clToMarkdown(profile, targetLang) {
  const lang = (targetLang && profile?.coverLetters?.[targetLang]) ? targetLang : (profile?.settings?.lang || 'de');
  const cl = profile?.coverLetters?.[lang];
  if (!cl) return '';
  const out = [];

  out.push('---');
  out.push(`doc: cover-letter`);
  out.push(`lang: ${lang}`);
  out.push(`template: ${profile.settings?.template || 'hamburg'}`);
  // Nur schreiben, wenn abgeschaltet — sonst stünde in jeder Datei eine Zeile,
  // die nichts aussagt.
  if (cl.showDateline === false) out.push('dateline: off');
  if (cl.showSignature === false) out.push('signature: off');
  out.push('---');
  out.push('');

  // Header (recipient block) — Überschriften in der Sprache des Briefs (CL_HEADS).
  const H = CL_HEADS[lang] || CL_HEADS.de;
  out.push(`## ${H.recipient}`);
  if (val(cl.company)) out.push(`- ${H.company}: ${val(cl.company)}`);
  if (val(cl.contactPerson)) out.push(`- ${H.contactPerson}: ${val(cl.contactPerson)}`);
  if (val(cl.companyAddress)) out.push(`- ${H.companyAddress}: ${val(cl.companyAddress)}`);
  out.push('');

  out.push(`## ${H.header}`);
  if (val(cl.city)) out.push(`- ${H.city}: ${val(cl.city)}`);
  if (val(cl.date)) out.push(`- ${H.date}: ${val(cl.date)}`);
  out.push('');

  for (const k of ['subject', 'salutation', 'intro', 'mainBody', 'companyReference', 'motivation', 'closing', 'signoff']) {
    if (val(cl[k])) { out.push(`## ${H[k]}`); out.push(val(cl[k])); out.push(''); }
  }

  return out.join('\n');
}

/* Überschriften aller vier Sprachen (CL_HEADS). Die Reihenfolge zählt:
 * „Formule d’appel" (Anrede) vor „Formule de politesse" (Gruß),
 * „Why this company" erst nach den übrigen. */
function clSectionOf(title) {
  const t = title.toLowerCase();
  if (/empf[äa]nger|recipient|adressat|destinat/.test(t)) return 'recipient';
  if (/kopf|header|datum|date|en-t[êe]te|encabezado/.test(t)) return 'header';
  if (/betreff|subject|objet|asunto/.test(t)) return 'subject';
  if (/anrede|salutation|hallo|formule d['’]appel|saludo/.test(t)) return 'salutation';
  if (/einstieg|intro|einleitung/.test(t)) return 'intro';
  if (/hauptteil|main|body|corps|cuerpo/.test(t)) return 'mainBody';
  if (/firmenbezug|company.*ref|warum.*firma|why.*company|pourquoi.*entreprise|por qu[ée].*empresa/.test(t)) return 'companyReference';
  if (/motivation|motivaci[oó]n|warum.*ich/.test(t)) return 'motivation';
  if (/abschluss|closing|schluss|conclusion|cierre/.test(t)) return 'closing';
  if (/grußformel|sign-?off|gruss|gru[ßs]|politesse|despedida/.test(t)) return 'signoff';
  return null;
}

export function markdownToCl(md, existing, targetLang) {
  if (String(md ?? '').length > MAX_MARKDOWN_CHARS) throw new Error(`Markdown zu groß (höchstens ${MAX_MARKDOWN_CHARS / 1000} KB)`);
  const out = JSON.parse(JSON.stringify(existing));
  const lang = targetLang || out.settings?.lang || 'de';

  // Frontmatter (optional — accept lang override)
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  let body = md;
  let useLang = lang;
  /* Zeitlose Fassung: Ort/Datum und Unterschriftsblock lassen sich abschalten.
   * Ohne Übernahme hier setzte ein Schreibvorgang über die Brücke die
   * Entscheidung des Menschen stillschweigend zurück. */
  const schalter = {};
  if (fm) {
    body = fm[2];
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (!m) continue;
      const k = m[1], v = m[2].trim();
      if (k === 'lang' && ['de', 'en', 'fr', 'es'].includes(v)) useLang = v;
      else if (k === 'dateline') schalter.showDateline = v.trim() !== 'off';
      else if (k === 'signature') schalter.showSignature = v.trim() !== 'off';
    }
  }
  // Ein ausdrücklich genanntes Ziel schlägt die Angabe im Frontmatter. Sonst
  // entschiede der Inhalt darüber, wohin geschrieben wird — und ein
  // kopierter Kopf aus einer anderen Fassung schriebe in die falsche Sprache.
  if (targetLang) useLang = targetLang;

  const cl = {
    company: '', contactPerson: '', companyAddress: '',
    city: '', date: '',
    subject: '', salutation: '',
    intro: '', mainBody: '', companyReference: '', motivation: '', closing: '', signoff: '',
    // Aus dem Frontmatter, sonst der bisherige Stand des Profils. Ein Import
    // darf eine bewusst abgeschaltete Datumszeile nicht wieder einschalten.
    showDateline: schalter.showDateline ?? out.coverLetters?.[useLang]?.showDateline,
    showSignature: schalter.showSignature ?? out.coverLetters?.[useLang]?.showSignature,
  };

  const lines = body.split('\n').map(l => l.replace(/\r$/, ''));
  let section = null;
  let buf = [];
  const flush = () => {
    if (!section || !buf.length) { buf = []; return; }
    if (section === 'recipient' || section === 'header') {
      for (const line of buf) {
        if (line.length > MAX_LINE_CHARS) continue;   // H1: keine Schlüsselzeile
        const m = splitKeyLine(line);   // ohne Backtracking (Runde 6)
        if (!m) continue;
        const k = m.key.toLowerCase(), v = m.value.trim();
        if (section === 'recipient') {
          if (/firma|company|entreprise|empresa/.test(k)) cl.company = v;
          else if (/ansprechpartner|contact|interlocut/.test(k)) cl.contactPerson = v;
          else if (/adresse|address|direcci[oó]n/.test(k)) cl.companyAddress = v;
        } else {
          if (/ort|city|lieu|lugar/.test(k)) cl.city = v;
          else if (/datum|date|fecha/.test(k)) cl.date = v;
        }
      }
    } else if (Object.prototype.hasOwnProperty.call(cl, section)) {
      cl[section] = buf.join('\n').trim();
    }
    buf = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('## ')) {
      flush();
      section = clSectionOf(t.slice(3).trim());
      continue;
    }
    if (section) buf.push(line);
  }
  flush();

  if (!out.coverLetters) out.coverLetters = {};
  out.coverLetters[useLang] = cl;
  return out;
}
