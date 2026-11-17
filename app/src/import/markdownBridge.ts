// ── Markdown-Brücke im Browser ──────────────────────────────────────────────
//
// Portierung von `pdf-service/markdown.js` (Stand e133d81, 08.10.2026) für den
// Lokalmodus. Die Server-Fassung hat keine einzige Abhängigkeit, die Logik
// läuft im Browser unverändert. Bis zum 08.10.2026 brauchte der Markdown-
// Import trotzdem ein Konto: Er rief den Server, und in der Demo antwortete
// der mit „nicht angemeldet". Die Oberfläche nannte das „KI-Funktionen
// brauchen ein Konto" — dabei geht es um einen Textparser.
//
// Bewusst eine KOPIE, kein gemeinsames Modul: Das Server-Original bleibt die
// Fassung für Konten (Import mit Versionsstand). Wer am Format etwas ändert,
// ändert beide Dateien. `scripts/localmodecheck.mjs` lädt im Lokalmodus die
// Markdown-Datei herunter, spielt sie wieder ein und vergleicht die Felder.
//
// Abweichungen vom Original, alle zugunsten der Daten:
//   • Felder, die das Markdown nicht trägt (Geburtsort, Unterschriftsort und
//     -datum, Original des Fotos), bleiben beim Import erhalten. Das Original
//     verwirft sie stillschweigend.
//   • Geschrieben wird immer in die Sprache, die gerade bearbeitet wird —
//     nicht in die, die im Frontmatter steht.

import type { CVData, CoverLetterData, ExperienceEntry, EducationEntry, SkillGroup, LanguageEntry, SocialLink, SocialPlatform } from '../data/types';
import { clHeadsOf } from '../export/markdownHeads';

// Seit 17.11.2026 schreibt die Brücke Überschriften und Schlüssel in der
// Sprache des Dokuments (export/markdownHeads.ts). Die Parser hier erkennen
// alle vier Sprachen — wie pdf-service/markdown.js.

// Eigene Abschnitte (Projekte, Zertifikate, Ehrenamt, Publikationen, freie
// Abschnitte): Port von `extraSectionOf` / `parseExtraSection` aus
// pdf-service/markdown.js, dort ist das Format beschrieben. Geschrieben wird
// es in export/exportMarkdown.ts.

const val = (s: unknown) => (s ?? '').toString().trim();

/** Begrenzt ein eingelesenes Feld (Schutz vor überlangen KI-Ausgaben). */
function clipField(s: unknown, max = 240): string {
  const str = (s ?? '').toString().trim();
  return str.length > max ? str.slice(0, max) : str;
}

/** Fett/kursiv um eine Überschrift entfernen („### **Senior Engineer**"). */
function stripMd(s: unknown): string {
  return (s ?? '').toString()
    .trim()
    .replace(/^\*\*(.*)\*\*$/, '$1')
    .replace(/^\*(.*)\*$/, '$1')
    .replace(/^_(.*)_$/, '$1')
    .trim();
}

const KNOWN_SOCIALS = ['linkedin', 'github', 'xing', 'twitter', 'x', 'bluesky', 'mastodon', 'instagram', 'youtube', 'tiktok', 'behance', 'dribbble', 'medium', 'substack'];
function normalisePlatform(k: string): SocialPlatform | null {
  const lower = k.toLowerCase();
  if (lower === 'x') return 'twitter';
  return KNOWN_SOCIALS.includes(lower) ? lower as SocialPlatform : null;
}

function parseMeta(line: string) {
  const parts = line.split('·').map(p => p.trim());
  const out = { company: '', location: '', start: '', end: '' };
  const dateIdx = parts.findIndex(p => /\d{2,4}|heute|present|today|actualidad|à ce jour/i.test(p) && /[–\-—]/.test(p));
  let dated = '';
  if (dateIdx >= 0) { dated = parts[dateIdx]; parts.splice(dateIdx, 1); }
  if (dated) {
    const [s, e] = dated.split(/[–—-]/).map(x => x.trim());
    out.start = s || '';
    out.end = e || '';
  }
  if (parts[0]) out.company = parts[0];
  if (parts[1]) out.location = parts[1];
  return out;
}

type CvSection = 'profile' | 'experience' | 'education' | 'skills' | 'languages' | 'additional' | 'contact' | null;

/* „Weiteres“ vor „Ausbildung“: „Información adicional“ und „Informations
 * complémentaires“ enthalten „formación“/„formation“. */
function sectionOf(title: string): CvSection {
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

const KEY_LOCATION = /ort|location|adresse|address|ubicaci[oó]n|direcci[oó]n/;
const KEY_NOT_LOCATION = /e[-\s]?mail|correo|telefon|phone|tel[ée]fono|website|web|portfolio|site|sitio/;

type ExtraKind = 'projects' | 'certificates' | 'volunteering' | 'publications' | 'custom';

/** Abschnittsart der eigenen Abschnitte — oder null. Vor den übrigen
 *  Abschnitten geprüft: „Volunteer experience" ist kein Berufsweg. */
export function extraSectionOf(title: string): ExtraKind | null {
  const t = val(title).toLowerCase();
  if (/^(abschnitt|section|secci[oó]n)\s*:/.test(t)) return 'custom';
  if (/^(projekte?|projects?|projets?|proyectos?)\b/.test(t)) return 'projects';
  if (/zertifikat|certific/.test(t)) return 'certificates';
  if (/ehrenamt|volunteer|b[ée]n[ée]volat|voluntariado/.test(t)) return 'volunteering';
  if (/publikation|publication|veröffentlichung|publicaci[oó]n/.test(t)) return 'publications';
  return null;
}

const FIELD_RE = /^(rolle|role|rôle|rol|zeitraum|period|période|periodo|dates?|link|lien|enlace|url|aussteller|issuer|émetteur|emisor|datum|fecha|kennung|identifiant|id|credential(?:\s*id)?|verlag|publisher|éditeur|editorial|ort\/verlag|untertitel|subtitle|sous-titre|subtítulo)\s*:\s*(.*)$/i;
const FIELD_KEY: Record<string, string> = {
  rolle: 'role', role: 'role', 'rôle': 'role', rol: 'role',
  zeitraum: 'period', period: 'period', 'période': 'period', periodo: 'period', date: 'date', dates: 'period',
  link: 'url', lien: 'url', enlace: 'url', url: 'url',
  aussteller: 'issuer', issuer: 'issuer', 'émetteur': 'issuer', emisor: 'issuer', datum: 'date', fecha: 'date',
  kennung: 'credentialId', identifiant: 'credentialId', id: 'credentialId', credential: 'credentialId', 'credential id': 'credentialId', credentialid: 'credentialId',
  verlag: 'publisher', publisher: 'publisher', 'éditeur': 'publisher', editorial: 'publisher', 'ort/verlag': 'publisher',
  untertitel: 'subtitle', subtitle: 'subtitle', 'sous-titre': 'subtitle', 'subtítulo': 'subtitle',
};
const FIELDS_IN: Record<ExtraKind, string[]> = {
  projects: ['role', 'period', 'url'],
  certificates: ['issuer', 'date', 'credentialId', 'url'],
  publications: ['publisher', 'date', 'url'],
  custom: ['subtitle', 'date'],
  volunteering: [],
};
function splitPeriod(v: unknown): { start: string; end: string } {
  const m = val(v).match(/^(.*?)\s*(?:[–—]|\s-\s)\s*(.*)$/) || val(v).match(/^(.*?)\s*[–—-]\s*$/);
  if (!m) return { start: val(v), end: '' };
  return { start: val(m[1]), end: val(m[2] ?? '') };
}

interface RawEntry { title: string; fields: Record<string, string>; textLines: string[]; bullets: string[]; meta: string | null; text?: string }

/** Liest die Zeilen EINES eigenen Abschnitts (ohne die `##`-Zeile) in `cv`. */
export function parseExtraSection(kind: ExtraKind, title: string, sectionLines: string[], cv: CVData, uid: (p: string) => string): void {
  const SHORT = 240, LONG = 2000;
  const entries: RawEntry[] = [];
  let cur: RawEntry | null = null;
  const items: string[] = [];
  const flush = () => { if (cur) { cur.text = cur.textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(); entries.push(cur); cur = null; } };
  for (let i = 0; i < sectionLines.length; i++) {
    const t = sectionLines[i].trim();
    if (/^###(\s|$)/.test(t)) {
      flush();
      const e: RawEntry = { title: clipField(stripMd(t.slice(3)), SHORT), fields: {}, textLines: [], bullets: [], meta: null };
      cur = e;
      if (kind === 'volunteering') {
        let j = i + 1;
        while (j < sectionLines.length && !sectionLines[j].trim()) j++;
        const nxt = (sectionLines[j] || '').trim();
        if (j < sectionLines.length && nxt && !/^[-*+]\s/.test(nxt) && !nxt.startsWith('#')) { e.meta = stripMd(nxt); i = j; }
      }
      continue;
    }
    if (/^[-*+]\s/.test(t)) {
      const b = clipField(t.slice(2), LONG);
      if (!b) continue;
      if (!cur) { if (kind === 'custom') items.push(b); continue; }
      if (kind === 'custom' || kind === 'publications') (cur as RawEntry).textLines.push(sectionLines[i].replace(/\s+$/, ''));
      else (cur as RawEntry).bullets.push(b);
      continue;
    }
    if (!cur) continue;
    const c: RawEntry = cur;
    const f = t.match(FIELD_RE);
    const key = f ? FIELD_KEY[f[1].toLowerCase().replace(/\s+/g, ' ')] : null;
    if (f && key && FIELDS_IN[kind].includes(key) && !c.textLines.length) { c.fields[key] = clipField(f[2], SHORT); continue; }
    if (c.textLines.length || t) c.textLines.push(sectionLines[i].replace(/\s+$/, ''));
  }
  flush();
  if (kind === 'projects') {
    const list = cv.projects ?? (cv.projects = []);
    for (const e of entries) {
      const p = splitPeriod(e.fields.period);
      list.push({ id: uid('prj'), title: e.title, role: e.fields.role || '', start: p.start, end: p.end, url: e.fields.url || '', description: clipField(e.text, LONG), bullets: e.bullets });
    }
  } else if (kind === 'certificates') {
    const list = cv.certificates ?? (cv.certificates = []);
    for (const e of entries) list.push({ id: uid('crt'), name: e.title, issuer: e.fields.issuer || '', date: e.fields.date || '', credentialId: e.fields.credentialId || '', url: e.fields.url || '' });
  } else if (kind === 'volunteering') {
    const list = cv.volunteering ?? (cv.volunteering = []);
    for (const e of entries) {
      const m = e.meta ? parseMeta(e.meta) : { company: '', location: '', start: '', end: '' };
      list.push({ id: uid('vol'), role: e.title, organization: clipField(m.company, SHORT), location: clipField(m.location, SHORT), start: m.start, end: m.end, bullets: e.bullets });
    }
  } else if (kind === 'publications') {
    const list = cv.publications ?? (cv.publications = []);
    for (const e of entries) list.push({ id: uid('pub'), title: e.title, publisher: e.fields.publisher || '', date: e.fields.date || '', url: e.fields.url || '', description: clipField(e.text, LONG) });
  } else {
    /* Eine Überschrift ohne Inhalt ist kein Abschnitt. */
    if (!items.length && !entries.length) return;
    const list = cv.customSections ?? (cv.customSections = []);
    list.push({
      id: uid('sec'),
      title: clipField(val(title).replace(/^(abschnitt|section|secci[oó]n)\s*:\s*/i, ''), SHORT),
      items,
      entries: entries.map(e => ({ id: uid('ent'), title: e.title, subtitle: e.fields.subtitle || '', date: e.fields.date || '', text: clipField(e.text, LONG) })),
    });
  }
}

/* ── Obergrenzen gegen ReDoS (Sicherheitsbefund H1, 09.10.2026) ────────────
 * Die Sprachzeile wurde bis zum 09.10.2026 mit
 * `^[-*+]\s*([^—–-]+?)\s*[—–-]\s*(.+)$` gelesen. Drei Quantoren über dieselben
 * Leerzeichen: „- " + 3000 Leerzeichen + „a" kostet kubisch viel Zeit (am
 * Server 8,8 s Stillstand bei 3 KB). Im Browser trifft es zwar nur den eigenen
 * Tab, aber dieselbe Datei kommt über Sharelinks, KI-Antworten und die
 * Zwischenablage herein. Jetzt wird ohne Rückverfolgung zerlegt
 * (`splitLanguageLine`), Zeilen über MAX_MD_LINE Zeichen werden übersprungen
 * (Ausnahme: der Profiltext, dort läuft kein Regex über die Zeile) und das
 * Markdown wird auf MAX_MD_CHARS begrenzt, wie am Server
 * (pdf-service/markdown.js). Prüfung: app/scripts/redoscheck.mjs. */
export const MAX_MD_CHARS = 200_000;
export const MAX_MD_LINE = 2000;

function capMarkdown(md: unknown): string {
  const s = typeof md === 'string' ? md : '';
  return s.length > MAX_MD_CHARS ? s.slice(0, MAX_MD_CHARS) : s;
}

/** „- Deutsch — Muttersprache (5)" → Sprache und Niveau. Getrennt wird am
 *  ersten Gedanken-, Halbgeviert- oder Bindestrich nach dem Spiegelstrich,
 *  genau wie es der alte Ausdruck tat — nur ohne Rückverfolgung. */
export function splitLanguageLine(t: string): { language: string; level: string } | null {
  if (!/^[-*+]/.test(t)) return null;
  const rest = t.slice(1);
  const at = rest.search(/[—–-]/);
  if (at < 1) return null;                                   // vor dem Strich mind. ein Zeichen
  const tail = lineTail(rest.slice(at + 1));
  if (tail === null) return null;
  return { language: rest.slice(0, at).trim(), level: tail.trim() };
}

/** „- E-Mail: a@b.de" → Schlüssel und Wert, gleichwertig zu
 *  `^-\s*([^:]+):\s*(.+)$` (Kontakt, Empfänger im Anschreiben). Der Ausdruck
 *  war quadratisch (`\s*` und `[^:]+` teilen sich die Leerzeichen); bei
 *  100 Zeilen à 2000 Zeichen ergab das eine halbe Sekunde. */
export function splitKeyLine(t: string): { key: string; value: string } | null {
  if (t[0] !== '-') return null;
  const colon = t.indexOf(':', 1);
  if (colon < 2) return null;
  const tail = lineTail(t.slice(colon + 1));
  if (tail === null) return null;
  const key = t.slice(1, colon).replace(/^\s+/, '') || t.slice(colon - 1, colon);
  return { key, value: tail.trim() };
}

/** Was `\s*(.+)$` (ohne m-Flag) übrig lässt: `.` trifft keinen Zeilen-
 *  umbruch, `\s` schon. Vor dem letzten Umbruch darf also nur Weißraum
 *  stehen, dahinter muss mindestens ein Zeichen kommen. */
function lineTail(after: string): string | null {
  let last = -1;
  for (let k = after.length - 1; k >= 0; k--) {
    const c = after[k];
    if (c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029') { last = k; break; }
  }
  if (last >= 0 && after.slice(0, last + 1).trim() !== '') return null;
  const tail = after.slice(last + 1);
  return tail.length ? tail : null;
}

/** Frontmatter abtrennen. */
function splitFrontmatter(md: string): { fm: string | null; body: string } {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  return m ? { fm: m[1], body: m[2] } : { fm: null, body: md };
}

/**
 * Lebenslauf aus der Markdown-Brücke lesen. `existing` ist die bisherige
 * Fassung derselben Sprache: aus ihr kommen Beschriftungen, Foto und alles,
 * was das Markdown nicht trägt.
 */
export function markdownToCvData(md: string, existing: CVData): CVData {
  const { body } = splitFrontmatter(capMarkdown(md));
  const cv: CVData = {
    personal: { name: '', title: '', location: '', email: '', phone: '' },
    profile: { text: '' },
    experience: [],
    education: [],
    skillGroups: [],
    languages: [],
    additionalExperience: [],
    labels: existing.labels,
  };

  const rawLines = body.split('\n').map(l => l.replace(/\r$/, ''));
  const lines = rawLines.map(l => (l.length > MAX_MD_LINE ? '' : l));
  let section: CvSection = null;
  let curExp: ExperienceEntry | null = null;
  let curEdu: EducationEntry | null = null;
  let curSkill: SkillGroup | null = null;
  let profileLines: string[] = [];
  const flushExp = () => { if (curExp) { cv.experience.push(curExp); curExp = null; } };
  const flushEdu = () => { if (curEdu) { cv.education.push(curEdu); curEdu = null; } };
  const flushSkill = () => { if (curSkill) { cv.skillGroups.push(curSkill); curSkill = null; } };
  const flushProfile = () => { if (section === 'profile') { cv.profile.text = profileLines.join('\n').trim(); profileLines = []; } };
  const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let lastContact = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith('## ')) {
      flushExp(); flushEdu(); flushSkill(); flushProfile();
      const title = t.slice(3).trim();
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
      const m = splitKeyLine(t);
      if (m) {
        const k = m.key.toLowerCase(), v = clipField(m.value, 240);
        if (/e[-\s]?mail|correo/.test(k)) cv.personal.email = v;
        else if (/telefon|phone|tel[ée]fono/.test(k)) cv.personal.phone = v;
        // Website vor Ort: „Portfolio“ enthält „ort“.
        else if (/website|web|portfolio|site|sitio/.test(k)) cv.personal.website = v;
        else if (KEY_LOCATION.test(k)) cv.personal.location = v;
        else if (/geburtsdatum|date of birth|date de naissance|fecha de nacimiento/.test(k)) cv.personal.birthDate = v;
        else if (/führerschein|drivers? licen[sc]e|driving licen[sc]e|permis|permiso de conducir/.test(k)) cv.personal.driversLicense = v;
        else if (/staatsangehörigkeit|nationality|nationalit[ée]|nacionalidad/.test(k)) cv.personal.nationality = v;
        else if (/familienstand|marital|situation familiale|estado civil/.test(k)) cv.personal.maritalStatus = v;
        else {
          const plat = normalisePlatform(k);
          if (plat) {
            const socials: SocialLink[] = cv.personal.socials ?? (cv.personal.socials = []);
            socials.push({ id: `s-${Date.now()}-${socials.length}`, platform: plat, value: v });
          }
        }
        lastContact = KEY_LOCATION.test(k) && !KEY_NOT_LOCATION.test(k) ? 'location' : '';
      } else if (t && lastContact === 'location' && !/^[-*+]\s/.test(t)) {
        /* Zweizeilige Anschrift: Die zweite Zeile („21335 Lüneburg") steht
         * ohne Spiegelstrich unter „- Ort:". Bis zum 09.10.2026 fiel sie beim
         * Einlesen weg — der Lebenslauf kam ohne Postleitzahl und Ort zurück. */
        cv.personal.location = clipField(`${cv.personal.location}\n${t}`, 240);
      } else lastContact = '';
      i++; continue;
    }

    if (section === 'experience') {
      if (t.startsWith('### ')) {
        flushExp();
        const entry: ExperienceEntry = { id: uid('exp'), role: stripMd(t.slice(4)), company: '', location: '', start: '', end: '', bullets: [] };
        curExp = entry;
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length) {
          const nxt = lines[i].trim();
          if (!nxt.startsWith('-') && !nxt.startsWith('*') && !nxt.startsWith('+') && !nxt.startsWith('#')) {
            Object.assign(entry, parseMeta(stripMd(nxt)));
            i++;
          }
        }
        continue;
      }
      if (/^[-*+]\s/.test(t)) { if (curExp) curExp.bullets.push(t.slice(2).trim()); i++; continue; }
      i++; continue;
    }

    if (section === 'education') {
      if (t.startsWith('### ')) {
        flushEdu();
        const entry: EducationEntry = { id: uid('edu'), degree: stripMd(t.slice(4)), institution: '', location: '', start: '', end: '' };
        curEdu = entry;
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length) {
          const nxt = lines[i].trim();
          if (!nxt.startsWith('-') && !nxt.startsWith('*') && !nxt.startsWith('+') && !nxt.startsWith('#')) {
            const meta = parseMeta(stripMd(nxt));
            entry.institution = meta.company;
            entry.location = meta.location;
            entry.start = meta.start;
            entry.end = meta.end;
            i++;
          }
        }
        continue;
      }
      /* Anmerkung unter der Kopfzeile (Schwerpunkt, Note): wird geschrieben,
       * fiel aber bis zum 09.10.2026 beim Einlesen weg. */
      if (t && curEdu && !/^[-*+]\s/.test(t)) {
        const e: EducationEntry = curEdu;
        e.notes = clipField(e.notes ? `${e.notes}\n${t}` : t, 2000);
      }
      i++; continue;
    }

    if (section === 'skills') {
      if (t.startsWith('### ')) { flushSkill(); curSkill = { label: stripMd(t.slice(4)), items: [] }; i++; continue; }
      if (/^[-*+]\s/.test(t)) { if (curSkill) curSkill.items.push(t.slice(2).trim()); i++; continue; }
      i++; continue;
    }

    if (section === 'languages') {
      const m = splitLanguageLine(t);
      if (m) {
        let level = m.level;
        const dotMatch = level.match(/\((\d)(?:\/5)?\)\s*$/);
        let dots: number | undefined;
        if (dotMatch) {
          dots = Math.max(1, Math.min(5, parseInt(dotMatch[1], 10)));
          level = level.slice(0, dotMatch.index).trim();
        }
        const entry: LanguageEntry = { language: m.language, level };
        if (dots) entry.dots = dots;
        cv.languages.push(entry);
      }
      i++; continue;
    }

    if (section === 'additional') {
      if (/^[-*+]\s/.test(t)) cv.additionalExperience!.push(t.slice(2).trim());
      i++; continue;
    }

    i++;
  }

  flushExp(); flushEdu(); flushSkill(); flushProfile();

  // Was das Markdown nicht trägt, bleibt erhalten.
  const prev = existing.personal ?? { name: '', title: '', location: '', email: '', phone: '' };
  cv.personal.photo = prev.photo;
  cv.personal.photoOriginal = prev.photoOriginal;
  if (prev.subtitle && !cv.personal.subtitle) cv.personal.subtitle = prev.subtitle;
  if (prev.birthPlace && !cv.personal.birthPlace) cv.personal.birthPlace = prev.birthPlace;
  if (prev.signatureCity) cv.personal.signatureCity = prev.signatureCity;
  if (prev.signatureDate) cv.personal.signatureDate = prev.signatureDate;
  return cv;
}

// ── Anschreiben ─────────────────────────────────────────────────────────────

export function clToMarkdown(cl: CoverLetterData, lang: string, template: string): string {
  const out: string[] = [];
  out.push('---');
  out.push('doc: cover-letter');
  out.push(`lang: ${lang}`);
  out.push(`template: ${template}`);
  if (cl.showDateline === false) out.push('dateline: off');
  if (cl.showSignature === false) out.push('signature: off');
  out.push('---');
  out.push('');

  const H = clHeadsOf(lang);
  out.push(`## ${H.recipient}`);
  if (val(cl.company)) out.push(`- ${H.company}: ${val(cl.company)}`);
  if (val(cl.contactPerson)) out.push(`- ${H.contactPerson}: ${val(cl.contactPerson)}`);
  if (val(cl.companyAddress)) out.push(`- ${H.companyAddress}: ${val(cl.companyAddress)}`);
  out.push('');

  out.push(`## ${H.header}`);
  if (val(cl.city)) out.push(`- ${H.city}: ${val(cl.city)}`);
  if (val(cl.date)) out.push(`- ${H.date}: ${val(cl.date)}`);
  out.push('');

  for (const k of ['subject', 'salutation', 'intro', 'mainBody', 'companyReference', 'motivation', 'closing', 'signoff'] as const) {
    if (val(cl[k])) { out.push(`## ${H[k]}`); out.push(val(cl[k])); out.push(''); }
  }
  return out.join('\n');
}

type ClSection = keyof CoverLetterData | 'recipient' | 'header' | null;

function clSectionOf(title: string): ClSection {
  const t = title.toLowerCase();
  // Reihenfolge zählt: „Formule d’appel“ (Anrede) vor „Formule de politesse“ (Gruß).
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

const CL_TEXT_FIELDS = new Set(['subject', 'salutation', 'intro', 'mainBody', 'companyReference', 'motivation', 'closing', 'signoff']);

export function markdownToCoverLetter(md: string, existing: CoverLetterData): CoverLetterData {
  const { fm, body } = splitFrontmatter(capMarkdown(md));
  const schalter: { showDateline?: boolean; showSignature?: boolean } = {};
  if (fm) {
    for (const line of fm.split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (!m) continue;
      const k = m[1], v = m[2].trim();
      if (k === 'dateline') schalter.showDateline = v !== 'off';
      else if (k === 'signature') schalter.showSignature = v !== 'off';
    }
  }
  const cl: CoverLetterData = {
    company: '', contactPerson: '', companyAddress: '',
    city: '', date: '',
    subject: '', salutation: '',
    intro: '', mainBody: '', companyReference: '', motivation: '', closing: '', signoff: '',
    showDateline: schalter.showDateline ?? existing?.showDateline,
    showSignature: schalter.showSignature ?? existing?.showSignature,
  };

  let section: ClSection = null;
  let buf: string[] = [];
  const flush = () => {
    if (!section || !buf.length) { buf = []; return; }
    if (section === 'recipient' || section === 'header') {
      for (const line of buf) {
        if (line.length > MAX_MD_LINE) continue;
        const m = splitKeyLine(line);
        if (!m) continue;
        const k = m.key.toLowerCase(), v = m.value;
        if (section === 'recipient') {
          if (/firma|company|entreprise|empresa/.test(k)) cl.company = v;
          else if (/ansprechpartner|contact|interlocut/.test(k)) cl.contactPerson = v;
          else if (/adresse|address|direcci[oó]n/.test(k)) cl.companyAddress = v;
        } else {
          if (/ort|city|lieu|lugar/.test(k)) cl.city = v;
          else if (/datum|date|fecha/.test(k)) cl.date = v;
        }
      }
    } else if (CL_TEXT_FIELDS.has(section)) {
      (cl as unknown as Record<string, string>)[section] = buf.join('\n').trim();
    }
    buf = [];
  };

  for (const line of body.split('\n').map(l => l.replace(/\r$/, ''))) {
    const t = line.trim();
    if (t.startsWith('## ')) { flush(); section = clSectionOf(t.slice(3).trim()); continue; }
    if (section) buf.push(line);
  }
  flush();
  return cl;
}

/** Mindestlänge wie am Server — eine leere Zwischenablage ist kein Import. */
export const MIN_CV_MD = 20;
export const MIN_CL_MD = 10;
export const isCvMarkdown = (md: string) => md.trim().length >= MIN_CV_MD;
export const isClMarkdown = (md: string) => md.trim().length >= MIN_CL_MD;
