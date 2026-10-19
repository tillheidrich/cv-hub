// ── Lebenslauf aus beliebigem Text ──────────────────────────────────────────
//
// Für Menschen ohne Technikwissen: Sie fügen ein, was sie haben — die Antwort
// von ChatGPT, Text aus Word oder einem PDF, etwas selbst Getipptes — und
// bekommen ein ausgefülltes `CVData`. Läuft vollständig im Browser.
//
// Grundsätze:
//   • Nichts erfinden. Was nicht sicher zugeordnet werden kann, landet in
//     `unsorted` („Bitte prüfen"), nie stillschweigend im Papierkorb. Nur
//     Leerzeilen, Trennlinien und reine Zwischenüberschriften („Aufgaben:")
//     fallen weg.
//   • Das eigene Export-Format (Frontmatter mit `lang:`) geht unverändert an
//     den strengen Parser `markdownToCvData` — der kennt jedes Feld.
//   • Nie eine Ausnahme: Eingabe auf MAX_TEXT_IMPORT Zeichen gekappt, Zeilen
//     auf MAX_LINE, Felder wie in markdownBridge.ts (clipField). Alle
//     regulären Ausdrücke laufen über begrenzte Zeilen und sind ohne
//     verschachtelte Wiederholungen gebaut (vgl. scripts/redoscheck.mjs).
//
// Das Format, das hier am sichersten gelesen wird, beschreibt CHATGPT_PROMPT.
// Prüfung: `npx -y tsx scripts/textimport.test.ts` (im Ordner app/).

import JSZip from 'jszip';
import type {
  CVData, PersonalInfo, ExperienceEntry, EducationEntry, SkillGroup, LanguageEntry,
  SocialLink, SocialPlatform, ProjectEntry, CertificateEntry, VolunteerEntry,
  PublicationEntry, CustomSection, Lang,
} from '../data/types';
import { markdownToCvData, isCvMarkdown } from './markdownBridge';

export interface TextImportResult {
  /** Vollständiges CVData auf Basis von `base` (Beschriftungen, Foto usw. aus `base`). */
  cv: CVData;
  /** Zeilen/Blöcke ohne sichere Zuordnung („Bitte prüfen"), Abschnittsname vorn. */
  unsorted: string[];
  found: { name: boolean; contact: number; experience: number; education: number; skills: number; languages: number; profile: boolean; other: number };
  /** true, wenn das eigene Export-Format erkannt und markdownToCvData benutzt wurde. */
  strict: boolean;
}

export const MAX_TEXT_IMPORT = 60_000;
const MAX_LINE = 2000;
const MAX_ENTRIES = 80;
const MAX_ITEMS = 80;
const MAX_UNSORTED = 400;
const SHORT = 240;
const LONG = 2000;

// ── Kleinkram ───────────────────────────────────────────────────────────────

/** Begrenzt ein eingelesenes Feld — dieselbe Logik wie in markdownBridge.ts. */
function clipField(s: unknown, max = SHORT): string {
  const str = (s ?? '').toString().trim();
  return str.length > max ? str.slice(0, max) : str;
}

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o ?? null)) as T;
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Markdown-Auszeichnung innerhalb einer Zeile entfernen; Links behalten ihre Adresse. */
function cleanInline(s: string): string {
  let t = s;
  t = t.replace(/!\[([^\]]{0,200})\]\([^)\s]{0,500}\)/g, '$1');
  t = t.replace(/\[([^\]]{1,200})\]\(([^)\s]{1,500})\)/g, (_m, txt: string, url: string) => {
    const u = url.replace(/^mailto:/i, '').replace(/^tel:/i, '');
    const bare = (x: string) => x.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
    if (bare(txt) === bare(u) || /^(linkedin|github|xing|website|web|homepage|portfolio|e-?mail|mail|profil|profile|link|hier|here|instagram|twitter|x)$/i.test(txt.trim())) return u;
    return `${txt} (${u})`;
  });
  t = t.replace(/<((?:https?:\/\/|mailto:)[^>\s]{1,500})>/gi, '$1');
  t = t.replace(/<\/?(?:b|strong|i|em|u|span|p|div|font|small|sup|sub)\b[^>]{0,200}>/gi, '');
  t = t.replace(/\*\*|__/g, '');
  t = t.replace(/(^|[\s([/|])[*_]([^*_\s][^*_]{0,300}?)[*_](?=$|[\s).,;:!?\]|/])/g, '$1$2');
  t = t.replace(/`+/g, '');
  t = t.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, '$1');
  t = t.replace(/\bmailto:/gi, '');
  t = t.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&');
  t = t.trim().replace(/ {2,}/g, '\t').replace(/\t{2,}/g, '\t');
  return t;
}

const flat = (s: string) => s.replace(/\t+/g, ' ').replace(/\s{2,}/g, ' ').trim();

const BULLET_RE = /^(?:[-*+–—>](?=\s)|[•·▪◦‣●○■□➢►✓✔➤→❖♦\uf0b7\uf0a7\uf0d8\uf076\uf0fc\uf0a8]|[o§](?=\t)|\d{1,2}[.)](?=\s)|[a-h]\)(?=\s))\s*/u;
const NOT_NUMBERED = /^\d{1,2}\.\s*(?:staatsexamen|juristisch|klasse|semester|fachsemester|platz|preis|bundesliga|liga|fs)/i;

/** Inhalt eines Stichpunkts — oder null, wenn die Zeile keiner ist. */
function bulletOf(t: string): string | null {
  if (NOT_NUMBERED.test(t)) return null;
  const m = BULLET_RE.exec(t);
  if (!m) return null;
  return t.slice(m[0].length);
}

function isRule(t: string): boolean {
  return /^([-*_=~•·])(?:\s*\1){2,}$/.test(t) || /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/.test(t);
}

/** Teilt an starken Trennern: | · • Tab und Gedankenstrich mit Leerzeichen. */
function strongSplit(s: string): string[] {
  return s.split(/\s*\|\s*|\s*[·•]\s*|\t+|\s+[–—-]{1,2}\s+/)
    .map(p => trimSep(p)).filter(Boolean);
}

function trimSep(s: string): string {
  return s.replace(/\(\s*\)|\[\s*\]/g, '')
    .replace(/^[\s|,;:·•–—\-/]+/, '')
    .replace(/[\s|,;:·•–—\-/]+$/, '')
    .trim();
}

/** Komma-, Semikolon- und Punktlisten teilen — Klammern bleiben ganz. */
function splitList(s: string, tab = true): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if ((ch === ')' || ch === ']') && depth > 0) depth--;
    if (depth === 0 && (ch === ',' || ch === ';' || ch === '·' || ch === '•' || ch === '|' || (tab && ch === '\t'))) {
      if (cur.trim()) out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map(x => x.replace(/^(?:und|and|et|y)\s+/i, '').replace(/[.]$/, '').trim()).filter(Boolean);
}

/** „Label: Wert" → beides; Label höchstens 40 Zeichen, keine Adresse. */
function labelSplit(t: string): { label: string; value: string } | null {
  const i = t.indexOf(':');
  if (i < 1 || i > 40) return null;
  const label = t.slice(0, i).replace(/[*_]/g, '').trim();
  const value = t.slice(i + 1).trim();
  if (!label || /https?$|^www$/i.test(label) || value.startsWith('//')) return null;
  if (/\d{1,2}$/.test(label) && /^\d/.test(value)) return null; // Uhrzeit, Zahl
  return { label, value };
}

// ── Datumsangaben ───────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  januar: 1, jänner: 1, janner: 1, jan: 1, january: 1, janvier: 1, janv: 1, enero: 1, ene: 1,
  februar: 2, feb: 2, febr: 2, february: 2, février: 2, fevrier: 2, févr: 2, fevr: 2, fév: 2, fev: 2, febrero: 2,
  märz: 3, maerz: 3, mär: 3, mrz: 3, march: 3, mar: 3, mars: 3, marzo: 3,
  april: 4, apr: 4, avril: 4, avr: 4, abril: 4, abr: 4,
  mai: 5, may: 5, mayo: 5,
  juni: 6, jun: 6, june: 6, juin: 6, junio: 6,
  juli: 7, jul: 7, july: 7, juillet: 7, juil: 7, julio: 7,
  august: 8, aug: 8, août: 8, aout: 8, agosto: 8, ago: 8,
  september: 9, sep: 9, sept: 9, septembre: 9, septiembre: 9, setiembre: 9, set: 9,
  oktober: 10, okt: 10, october: 10, oct: 10, octobre: 10, octubre: 10,
  november: 11, nov: 11, novembre: 11, noviembre: 11,
  dezember: 12, dez: 12, december: 12, dec: 12, décembre: 12, decembre: 12, déc: 12, diciembre: 12, dic: 12,
};
const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const Y = '(?:19|20)\\d{2}';
const TOK = `(?<![\\p{L}\\d])(?:\\d{1,2}\\.\\s?\\d{1,2}\\.\\s?${Y}|\\d{1,2}\\.\\s?(?:${MONTH_ALT})\\.?\\s${Y}|\\d{1,2}\\s?[./]\\s?${Y}|${Y}-\\d{2}(?!\\d)|(?:${MONTH_ALT})(?![\\p{L}])\\.?\\s?${Y}|${Y})(?!\\d)`;
const TOK2 = `(?:${TOK}|(?<![\\p{L}\\d])\\d{1,2}\\/\\d{2}(?![\\d/.]))`;
const PRESENT = `(?:bis\\s)?(?:heute|dato)|aktuell|derzeit|laufend|jetzt|gegenwart|present|current(?:ly)?|now|today|ongoing|aujourd['’]hui|[àa] ce jour|actuel(?:lement)?|en cours|(?:la\\s)?actualidad|presente|hoy|actual(?:mente)?`;
const SEP = `(?:\\s?[-–—‐‑]{1,2}\\s?|\\s(?:bis|to|until|till|through|à|au|a|al|hasta|jusqu['’]?(?:à|au|en))\\s)`;
const PREFIX = `(?:(?:von|vom|ab|seit|since|from|depuis|du|de|desde|del)\\s)?`;
const RANGE_RE = new RegExp(`${PREFIX}(${TOK2})\\s?${SEP}\\s?(${TOK2}|${PRESENT})(?![\\p{L}])`, 'iu');
const SINCE_RE = new RegExp(`(?<![\\p{L}])(?:seit|since|depuis|desde|ab)\\s(?:(?:dem|le|el)\\s)?(${TOK})`, 'iu');
const OPEN_RE = new RegExp(`(${TOK})\\s?[-–—]\\s?(?=$|[|,;)\\]\\t])`, 'iu');
const SINGLE_RE = new RegExp(`(${TOK})`, 'iu');
const PRESENT_RE = new RegExp(`^(?:${PRESENT})$`, 'iu');

/** Token → Feldformat wie im übrigen Code: „MM/JJJJ" oder „JJJJ". */
function normTok(tok: string): string {
  const t = tok.trim().toLowerCase().replace(/\s+/g, ' ');
  const pad = (m: number) => (m >= 1 && m <= 12 ? String(m).padStart(2, '0') : '');
  let m = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/.exec(t);
  if (m) { const mm = pad(+m[2]); return mm ? `${mm}/${m[3]}` : ''; }
  m = /^(\d{1,2})\s?[./]\s?(\d{4})$/.exec(t);
  if (m) { const mm = pad(+m[1]); return mm ? `${mm}/${m[2]}` : ''; }
  m = /^(\d{4})-(\d{2})$/.exec(t);
  if (m) { const mm = pad(+m[2]); return mm ? `${mm}/${m[1]}` : ''; }
  m = /^(?:\d{1,2}\.\s?)?(\p{L}+)\.?\s?(\d{4})$/u.exec(t);
  if (m) { const mm = pad(MONTHS[m[1]] ?? 0); return mm ? `${mm}/${m[2]}` : ''; }
  m = /^(\d{1,2})\/(\d{2})$/.exec(t);
  if (m) {
    const mm = pad(+m[1]);
    if (!mm) return '';
    const yy = +m[2], now = new Date().getFullYear() % 100;
    return `${mm}/${yy <= now + 1 ? 2000 + yy : 1900 + yy}`;
  }
  if (/^\d{4}$/.test(t)) return t;
  return '';
}

interface DateHit { start: string; end: string; single: boolean; index: number; length: number }

function extractDates(s: string): DateHit | null {
  if (!s || s.length > MAX_LINE) return null;
  let m = RANGE_RE.exec(s);
  if (m) {
    const start = normTok(m[1]);
    const end = PRESENT_RE.test(m[2].trim()) ? 'present' : normTok(m[2]);
    if (start && end) return { start, end, single: false, index: m.index, length: m[0].length };
  }
  m = SINCE_RE.exec(s);
  if (m) { const start = normTok(m[1]); if (start) return { start, end: 'present', single: false, index: m.index, length: m[0].length }; }
  m = OPEN_RE.exec(s);
  if (m) { const start = normTok(m[1]); if (start) return { start, end: '', single: false, index: m.index, length: m[0].length }; }
  m = SINGLE_RE.exec(s);
  if (m) { const start = normTok(m[1]); if (start) return { start, end: '', single: true, index: m.index, length: m[0].length }; }
  return null;
}

function removeDate(s: string, h: DateHit): string {
  const rest = trimSep(`${s.slice(0, h.index)}\t${s.slice(h.index + h.length)}`.replace(/\(\s*\)|\[\s*\]/g, ''));
  return /^(?:zeitraum|period|dates?|datum|p[ée]riode|periodo|fechas?)$/i.test(rest) ? '' : rest;
}

/** Steht das Datum in einer Kopfzeile (Station) — oder in einem Satz? */
function isHeaderish(c: string, h: DateHit): boolean {
  if (c.length > 160) return false;
  const rest = removeDate(c, h);
  const n = words(rest);
  if (n > 14) return false;
  if (/[.!?]$/.test(c.trim()) && n > 6) return false;
  if (rest && /^\p{Ll}/u.test(rest) && n >= 4) return false;
  return true;
}

// ── Abschnitte erkennen ─────────────────────────────────────────────────────

type Sec = 'head' | 'profile' | 'contact' | 'experience' | 'education' | 'skills' | 'languages'
  | 'certificates' | 'projects' | 'volunteering' | 'publications' | 'interests' | 'awards' | 'additional' | 'unknown';

function normHeading(s: string): string {
  return s.toLowerCase()
    .replace(/[*_`#]/g, '')
    .replace(/^[^\p{L}]+/u, '')
    .replace(/[\s:.\-–—]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Breite Zuordnung — nur für echte Markdown-Überschriften (#, ##). */
const SECTION_RULES: [Sec, RegExp][] = [
  ['interests', /^(?:meine |my |mes |mis )?(?:interessen|hobbys?|hobbies|freizeit\p{L}*|interests?|centres? d.int[ée]r[êe]ts?|int[ée]r[êe]ts|loisirs|intereses|aficiones|pasatiempos)(?![\p{L}])/u],
  ['awards', /^(?:auszeichnungen|preise(?: und auszeichnungen)?|awards?|honou?rs|prix|distinctions|premios|reconocimientos)(?![\p{L}])/u],
  ['volunteering', /ehrenamt|volunteer|b[ée]n[ée]volat|voluntariado|soziales engagement|engagement associatif|^engagement(?![\p{L}])/u],
  ['certificates', /^(?:zertifi|weiterbildung|fortbildung|lehrg[äa]nge|kurse(?![\p{L}])|schulungen|seminare|certific|licen[cs]es|formation continue|formations? compl|cursos|certificados|trainings?(?![\p{L}])|courses(?![\p{L}]))/u],
  ['publications', /publikation|ver[öo]ffentlichung|publications?|publicaciones/u],
  ['projects', /^(?:ausgew[äa]hlte |selected |key |wichtige |principaux |principales )?(?:projekte?|projects?|projets?|proyectos?)(?![\p{L}])/u],
  ['languages', /^(?:fremd)?sprach(?:en|kenntnisse)|^languages?(?![\p{L}])|^language skills|^langues?(?![\p{L}])|^comp[ée]tences linguistiques|^idiomas?(?![\p{L}])|^lenguas/u],
  ['profile', /profil|[üu]ber mich|zusammenfassung|summary|^about(?![\p{L}])|objective|^r[ée]sum[ée](?![\p{L}])|[àa] propos|^perfil|sobre m[íi]|^resumen|^objetivo|^zielsetzung|^pr[ée]sentation|^kurz[üu]berblick/u],
  ['contact', /kontakt|pers[öo]nliche (?:daten|angaben|informationen)|^pers[öo]nliches$|angaben zur person|^contact|personal (?:details|information|data|info)|coordonn[ée]es|informations personnelles|^contacto|datos personales|datos de contacto|^stammdaten/u],
  ['education', /ausbildung|bildung|schul|studium|akademisch|^education|educational|academic|^qualifications|^formations?(?![\p{L}])|^[ée]tudes|^dipl[ôo]mes|^formaci[óo]n|educaci[óo]n|^estudios|^titulaci/u],
  ['experience', /erfahrung|werdegang|berufspraxis|praktik|besch[äa]ftigung|t[äa]tigkeiten|laufbahn|stationen|karriere|experience|employment|work history|career|professional background|exp[ée]riences?|parcours|experiencia|trayectoria|historial laboral|empleo/u],
  ['skills', /kenntnisse|f[äa]higkeiten|skills|kompetenz|fertigkeiten|st[äa]rken|expertise|qualifikationen|comp[ée]tences|habilidades|aptitudes|competencias|conocimientos|^tools(?![\p{L}])|^software(?![\p{L}])|^technolog|^it(?![\p{L}])|^edv(?![\p{L}])|^technical/u],
  ['additional', /^(?:weiteres|sonstiges|zus[äa]tzliche|additional|other|miscellaneous|divers|autres|informations? compl|otros|otra informaci|informaci[óo]n adicional|extras?)(?![\p{L}])/u],
];

/** Genaue Überschriften — gelten auch ohne jede Auszeichnung (Text aus Word). */
const EXACT: Record<string, Sec> = {};
const exactList: [Sec, string][] = [
  ['profile', 'profil|kurzprofil|berufsprofil|persönliches profil|über mich|zusammenfassung|summary|professional summary|executive summary|career summary|profile|professional profile|about me|about|profil professionnel|résumé|resume|à propos|à propos de moi|perfil|perfil profesional|sobre mí|resumen|resumen profesional|objective|career objective|zielsetzung|kurzvorstellung'],
  ['experience', 'berufserfahrung|berufliche erfahrung|erfahrung|beruflicher werdegang|werdegang|berufspraxis|praktika|praktikum|praktische erfahrung|berufliche stationen|beruflicher hintergrund|work experience|experience|professional experience|relevant experience|employment|employment history|work history|career history|expérience professionnelle|expériences professionnelles|expérience|expériences|parcours professionnel|experiencia laboral|experiencia profesional|experiencia|trayectoria profesional'],
  ['education', 'ausbildung|bildung|bildungsweg|bildungsgang|schulbildung|schulische ausbildung|schulischer werdegang|akademischer werdegang|studium|hochschulbildung|hochschulausbildung|berufsausbildung|schule und studium|studium und ausbildung|education|academic background|education and training|formation|formations|études|diplômes|formación|formación académica|educación|estudios'],
  ['skills', 'kenntnisse|fähigkeiten|skills|kompetenzen|it-kenntnisse|edv-kenntnisse|fachkenntnisse|besondere kenntnisse|fachliche kompetenzen|technische kenntnisse|qualifikationen|stärken|fähigkeiten und kenntnisse|kenntnisse und fähigkeiten|technical skills|key skills|core skills|core competencies|hard skills|soft skills|compétences|compétences techniques|habilidades|aptitudes|competencias|conocimientos|habilidades técnicas'],
  ['languages', 'sprachen|sprachkenntnisse|fremdsprachen|fremdsprachenkenntnisse|languages|language skills|langues|compétences linguistiques|idiomas|lenguas'],
  ['certificates', 'zertifikate|zertifizierungen|weiterbildung|weiterbildungen|fortbildung|fortbildungen|kurse|schulungen|lehrgänge|certifications|certificates|licenses|licences|certificats|formation continue|certificaciones|certificados|cursos'],
  ['projects', 'projekte|ausgewählte projekte|projects|selected projects|projets|proyectos'],
  ['volunteering', 'ehrenamt|ehrenamtliches engagement|ehrenamtliche tätigkeit|ehrenamtliche tätigkeiten|soziales engagement|engagement|volunteering|volunteer experience|volunteer work|bénévolat|engagement associatif|voluntariado'],
  ['interests', 'interessen|hobbys|hobbies|freizeit|freizeitaktivitäten|interessen und hobbys|hobbys und interessen|interests|centres d\'intérêt|centres d’intérêt|loisirs|intérêts|intereses|aficiones'],
  ['contact', 'kontakt|kontaktdaten|persönliche daten|persönliche angaben|persönliches|angaben zur person|contact|contact information|contact details|personal details|personal information|coordonnées|informations personnelles|contacto|datos personales|datos de contacto'],
  ['additional', 'weiteres|sonstiges|sonstige angaben|zusätzliche informationen|additional information|other|divers|autres|otros|información adicional'],
  ['awards', 'auszeichnungen|preise|awards|honors|honours|prix|distinctions|premios'],
  ['publications', 'publikationen|veröffentlichungen|publications|publicaciones'],
];
for (const [sec, list] of exactList) for (const w of list.split('|')) EXACT[w] = sec;

/** Endwort → Abschnitt, für kurze Überschriften wie „Kaufmännische Ausbildung". */
const LAST_WORD: [RegExp, Sec][] = [
  [/programmiersprachen$/u, 'skills'],
  [/(?:sprachkenntnisse|sprachen|languages|langues|idiomas)$/u, 'languages'],
  [/(?:kenntnisse|kompetenzen|kompetenz|fähigkeiten|fertigkeiten|skills|stärken|compétences|habilidades|competencias)$/u, 'skills'],
  [/(?:berufserfahrung|erfahrung|werdegang|laufbahn|experience|expériences?|experiencia)$/u, 'experience'],
  [/(?:zertifikate|zertifizierungen|weiterbildungen|fortbildungen|certifications|certificates)$/u, 'certificates'],
  [/(?:ausbildung|schulbildung|bildung|education|formation|formación|studium)$/u, 'education'],
  [/(?:projekte|projects|projets|proyectos)$/u, 'projects'],
  [/(?:interessen|hobbys|hobbies|interests)$/u, 'interests'],
];

function exactSection(text: string): Sec | null {
  const t = normHeading(text.replace(/\([^()]{0,40}\)/g, ''));
  if (!t || t.length > 50 || /\d/.test(t)) return null;
  if (EXACT[t]) return EXACT[t];
  const parts = t.split(/\s+(?:und|&|and|et|y|\/|\+)\s+|\s*&\s*|\s*\/\s*/).filter(Boolean);
  if (parts.length > 1 && parts.every(p => EXACT[p])) return EXACT[parts[0]];
  if (words(t) <= 3) for (const [re, sec] of LAST_WORD) if (re.test(t)) return sec;
  return null;
}

function broadSection(text: string): Sec | null {
  const t = normHeading(text);
  if (!t || t.length > 60) return null;
  const ex = exactSection(text);
  if (ex) return ex;
  for (const [sec, re] of SECTION_RULES) if (re.test(t)) return sec;
  return null;
}

interface Heading { kind: 'md' | 'bold' | 'caps' | 'colon' | 'plain'; level: number; text: string }

function unspace(t: string): string {
  return /^(?:\p{L} ){2,}\p{L}$/u.test(t) ? t.replace(/ /g, '') : t;
}

function headingOf(t: string): Heading | null {
  let m = /^(#{1,6})\s+(.*)$/.exec(t);
  if (m) {
    const text = cleanInline(m[2].replace(/\s#+\s*$/, ''));
    return text ? { kind: 'md', level: m[1].length, text } : null;
  }
  m = /^\*\*([^*]{1,120})\*\*\s*:?\s*$/.exec(t) || /^__([^_]{1,120})__\s*:?\s*$/.exec(t);
  if (m) {
    const text = cleanInline(m[1]).replace(/\s*:$/, '');
    return text ? { kind: 'bold', level: 0, text } : null;
  }
  if (t.length <= 60 && !/[@\d]/.test(t) && !bulletOf(t)) {
    const sp = unspace(t);
    const letters = sp.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) {
      return { kind: 'caps', level: 0, text: sp.replace(/\s*:$/, '') };
    }
  }
  m = /^([^:|]{2,50}):$/.exec(t);
  if (m && bulletOf(t) === null) return { kind: 'colon', level: 0, text: cleanInline(m[1]) };
  const c = cleanInline(t);
  if (c.length <= 50 && bulletOf(t) === null && !/[:|\t]/.test(c) && exactSection(c)) return { kind: 'plain', level: 0, text: c };
  return null;
}

const DOC_TITLE = /^(?:tabellarischer |mein |my )?(?:lebenslauf|curriculum vitae|curriculum|cv|resume|résumé|currículum(?: vitae)?|curr[íi]culum)$/i;

function stripDocTitle(t: string): string {
  return t
    .replace(/^(?:tabellarischer\s+)?(?:lebenslauf|curriculum vitae|cv|resume|résumé|currículum(?: vitae)?)(?:\s+(?:von|of|de))?\s*[:–—|-]?\s*/i, '')
    .replace(/\s*[–—|-]\s*(?:lebenslauf|curriculum vitae|cv|resume|résumé|currículum(?: vitae)?)$/i, '')
    .trim();
}

// ── Kontaktdaten ────────────────────────────────────────────────────────────

const EMAIL_RE = /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,8}/;
const URL_RE = /(?:https?:\/\/|www\.)[^\s|,;<>"'()]{2,300}|(?<![@\w.-])(?:[a-z0-9-]{1,63}\.){1,4}(?:de|com|net|org|io|eu|at|ch|fr|es|dev|app|me|info|co|uk|nl|be|it|pl|online|site|design|page|link|xyz|biz|us)(?:\/[^\s|,;<>"'()]{0,300})?(?![\w@])/i;
const PHONE_RE = /(?:\+|00)?\(?\d[\d\s()/.\-–]{5,24}\d/;
const STREET_RE = /\p{L}(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm|chaussee|ufer|steig|pfad|stieg|markt|hof|berg|feld|graben|kamp|twiete|wall)\s?\d{1,4}\s?[a-zA-Z]?(?![\d])|(?<![\p{L}])(?:rue|avenue|av\.|boulevard|bd|chemin|impasse|allée|calle|c\/|avenida|plaza|paseo|carrer|street|st\.|road|rd\.|lane|drive|weg|platz)\s+[\p{L}\d]|^\d{1,4}\s?[a-z]?,?\s+(?:rue|avenue|boulevard|chemin|place|impasse|allée|street|road|lane|drive|calle)(?![\p{L}])/iu;
const PLZ_RE = /(?<![\d])(?:D-|DE-|A-|CH-|F-|E-)?\d{4,5}\s+\p{Lu}[\p{L}.\- ]{1,40}$/u;

type PField = 'email' | 'phone' | 'location' | 'website' | 'birthDate' | 'birthPlace' | 'nationality' | 'maritalStatus' | 'driversLicense' | 'name' | 'title';

const LABEL_FIELDS: [RegExp, PField][] = [
  [/^(?:e-?\s?mail(?:-?adresse)?|mail|courriel|correo(?: electr[oó]nico)?|adresse (?:e-?mail|électronique)|email address)$/, 'email'],
  [/^(?:tel(?:efon|éfono|efono|ephone|éphone)?(?:nummer)?|tel\.|mobil(?:e|telefon|nummer)?|handy|phone(?: number)?|mobile phone|cell(?: phone)?|t[ée]l[ée]phone(?: portable)?|portable|m[oó]vil|celular|fon|mob\.?)$/, 'phone'],
  [/^(?:adresse|anschrift|wohnort|ort|wohnhaft(?: in)?|address|home address|location|city|residence|domicile|ville|lieu de r[ée]sidence|direcci[oó]n|domicilio|ciudad|ubicaci[oó]n|localidad|wohnadresse|postanschrift|standort)$/, 'location'],
  [/^(?:website|webseite|web|homepage|internet|portfolio|site(?: web| internet)?|sitio web|p[aá]gina web|url|blog)$/, 'website'],
  [/^(?:geburtsdatum(?: und -ort)?|geboren(?: am)?|geb\.?(?: am)?|date of birth|birth ?date|born|dob|date de naissance|n[ée]e? le|fecha de nacimiento|nacimiento)$/, 'birthDate'],
  [/^(?:geburtsort|place of birth|birthplace|lieu de naissance|lugar de nacimiento)$/, 'birthPlace'],
  [/^(?:staatsangeh[öo]rigkeit|nationalit[äa]t|nationality|citizenship|nationalit[ée]|nacionalidad)$/, 'nationality'],
  [/^(?:familienstand|marital status|situation (?:familiale|de famille)|[ée]tat civil|estado civil)$/, 'maritalStatus'],
  [/^(?:f[üu]hrerschein(?:klassen?)?|fahrerlaubnis|driving licen[cs]e|driver'?s licen[cs]e|drivers licen[cs]e|permis(?: de conduire)?|carn[eé]t? de conducir|permiso de conducir|carnet)$/, 'driversLicense'],
  [/^(?:name|vor- und nachname|vorname und nachname|vollst[äa]ndiger name|full name|nom(?: complet)?|pr[ée]nom et nom|nombre(?: completo)?|nombre y apellidos)$/, 'name'],
  [/^(?:berufsbezeichnung|job title|titre|puesto)$/, 'title'],
];
const SOCIAL_LABEL: Record<string, SocialPlatform> = {
  linkedin: 'linkedin', 'linked in': 'linkedin', github: 'github', xing: 'xing', twitter: 'twitter', x: 'twitter',
  bluesky: 'bluesky', mastodon: 'mastodon', instagram: 'instagram', youtube: 'youtube', tiktok: 'tiktok',
  behance: 'behance', dribbble: 'dribbble', medium: 'medium', substack: 'substack',
};
const SOCIAL_HOST: [RegExp, SocialPlatform][] = [
  [/linkedin\.com/i, 'linkedin'], [/github\.com/i, 'github'], [/xing\.com/i, 'xing'],
  [/(?:twitter\.com|(?<![\w.])x\.com)/i, 'twitter'], [/bsky\.app/i, 'bluesky'], [/instagram\.com/i, 'instagram'],
  [/youtube\.com|youtu\.be/i, 'youtube'], [/tiktok\.com/i, 'tiktok'], [/behance\.net/i, 'behance'],
  [/dribbble\.com/i, 'dribbble'], [/medium\.com/i, 'medium'], [/substack\.com/i, 'substack'],
  [/mastodon\.|\/@\w/i, 'mastodon'],
];

function phoneIn(s: string): string | null {
  if (/\d{1,2}\.\d{1,2}\.\d{2,4}/.test(s)) return null;
  const m = PHONE_RE.exec(s);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, '').length;
  if (digits < 6 || digits > 16) return null;
  if (extractDates(m[0]) && !/^\+|^0\d/.test(m[0].trim())) return null;
  return m[0].trim();
}

const isAddressLike = (s: string) => s.length <= 120 && (STREET_RE.test(s) || PLZ_RE.test(s.trim()));

function isPlaceLike(s: string): boolean {
  const t = s.trim();
  if (t.length < 2 || t.length > 45 || /[@&/:+]|https?|www\./i.test(t)) return false;
  const pieces = t.split(/\s*,\s*/);
  if (pieces.length > 3 || words(t) > 5) return false;
  const word = /^(?:\p{Lu}[\p{L}.'’-]*|\(\p{Lu}[\p{L}.-]*\)|am|an|der|de|del|la|le|les|sur|upon|im|in|on|the|of|y|d['’]\p{L}+)$/u;
  return pieces.every(p => /^(?:\d{4,5}\s)?\p{Lu}/u.test(p) && words(p) <= 3 && p.replace(/^\d{4,5}\s/, '').split(/\s+/).every(w => word.test(w))) && !isOrgLike(t);
}

function hasContact(s: string): boolean {
  return EMAIL_RE.test(s) || URL_RE.test(s) || !!phoneIn(s) || isAddressLike(s);
}

// ── Organisationen, Abschlüsse ─────────────────────────────────────────────

const ORG_CS = /(?:^|[\s,(])(?:GmbH|gGmbH|mbH|AG|KG|KGaA|OHG|GbR|UG|e\.\s?V\.|eV|SE|Ltd\.?|LLC|LLP|Inc\.?|PLC|plc|Corp\.?|Co\.|S\.A\.?|SA|S\.L\.?|SL|SARL|SAS|S\.A\.S\.|S\.p\.A\.|BV|B\.V\.|NV|N\.V\.|AB|ASA|Oy|IHK|HWK|FH|TU|HAW|ETH|EPFL|LMU|RWTH|KIT)(?=$|[\s,).&])/;
const ORG_CI = /(?<![\p{L}])(?:universit\p{L}{0,6}|uni|hochschule|fachhochschule|college|school|lyc[ée]e|[ée]cole|colegio|instituto?|institut|academy|acad[ée]mie|academia|campus|polytechni\p{L}{0,4}|conservato\p{L}{0,6}|hospital|krankenhaus|kanzlei|kita|kindergarten|kindertagesst\p{L}{0,8}|gemeinde|landkreis|ministeri\p{L}{0,4}|bundeswehr|polizei|group|groupe|holding|company|corporation|foundation|association|asociaci[óo]n|fundaci[óo]n|empresa|soci[ée]t[ée]|entreprise)(?![\p{L}])|\p{L}{0,25}(?:schule|akademie|gymnasium|kolleg|klinik|klinikum|verwaltung|werke|verlag|agentur|gruppe|bank|sparkasse|versicherung|stiftung|verein|praxis|amt)(?![\p{L}])/iu;
const isOrgLike = (s: string) => s.length <= SHORT && (ORG_CS.test(s) || ORG_CI.test(s));
const DEGREE_RE = /(?<![\p{L}])(?:bachelor|master|b\.\s?a\.|b\.\s?sc\.?|b\.\s?s\.|m\.\s?a\.|m\.\s?sc\.?|m\.\s?s\.|b\.\s?eng\.?|m\.\s?eng\.?|mba|ll\.\s?[bm]\.?|diplom\p{L}{0,8}|dipl\.|abitur|fachabitur|fachhochschulreife|hochschulreife|realschulabschluss|mittlere reife|hauptschulabschluss|sekundarabschluss|staatsexamen|promotion|dr\.|ph\.?\s?d\.?|doktor\p{L}{0,6}|\p{L}{0,15}ausbildung|\p{L}{0,15}studium|studiengang|lehre|geselle|meister\p{L}{0,6}|fachwirt\p{L}{0,4}|techniker\p{L}{0,4}|kauf(?:mann|frau)|licence|licenciatura|licenciado|grado|m[áa]ster|doctorado|bachiller\p{L}{0,4}|baccalaur[ée]at|bac(?![\p{L}])|bts|dut|dipl[ôo]me|ciclo formativo|high school|ged|associate)(?![\p{L}])/iu;
const isDegreeLike = (s: string) => s.length <= SHORT && DEGREE_RE.test(s);
/** Typische Berufsbezeichnungen — entscheidet, wer Rolle und wer Firma ist,
 *  wenn keine Rechtsform hilft („Globex" / „Marketing Manager"). */
const ROLE_RE = /(?<![\p{L}])(?:manager\p{L}{0,2}|lead|head|chief|ceo|cto|cfo|coo|vp|director|officer|engineer|developer|designer|consultant|assistant|specialist|analyst|intern|trainee|associate|coordinator|administrator|architect|owner|founder|co-founder|scientist|researcher|editor|writer|teacher|nurse|technician|accountant|clerk|representative|executive|supervisor|werkstudent\p{L}{0,2}|praktikant\p{L}{0,2}|auszubildende\p{L}?|azubi|volont[äa]r\p{L}{0,2}|gesch[äa]ftsf[üu]hrer\p{L}{0,2}|inhaber\p{L}{0,2}|gr[üu]nder\p{L}{0,2}|mitarbeiter\p{L}{0,2}|assistenz|teamleit\p{L}{0,4}|\p{L}{0,20}(?:leiter|leiterin|leitung|referent|referentin|berater|beraterin|entwickler|entwicklerin|ingenieur|ingenieurin|techniker|technikerin|sachbearbeiter|sachbearbeiterin|kaufmann|kauffrau|fachkraft|meister|meisterin|helfer|helferin|koordinator|koordinatorin|spezialist|spezialistin|erzieher|erzieherin|pfleger|pflegerin|lehrer|lehrerin|monteur|monteurin|elektriker|elektrikerin|mechaniker|mechanikerin|designerin|managerin|redakteur|redakteurin)|charg[ée]e?|responsable|directeur|directrice|chef|cheffe|stagiaire|alternant\p{L}?|d[ée]veloppeu\p{L}{1,3}|ing[ée]nieur\p{L}?|conseill\p{L}{2,4}|desarrollador\p{L}?|jef[ae]|gerente|t[ée]cnic[oa]|coordinador\p{L}?|asistente|becari[oa]|ingenier[oa]|dise[ñn]ador\p{L}?|analista|consultor\p{L}?|programador\p{L}?|encargad[oa])(?![\p{L}])/iu;
const isRoleLike = (s: string) => s.length <= SHORT && ROLE_RE.test(s);

/** „Firma GmbH, Hamburg" / „Firma (Hamburg)" → Name und Ort. */
function splitPlace(s: string): { name: string; place: string } {
  const p = /^(.*\S)\s*\(([^()]{2,45})\)$/.exec(s);
  if (p && isPlaceLike(p[2])) return { name: trimSep(p[1]), place: p[2].trim() };
  let from = 0;
  for (let k = 0; k < 4; k++) {
    const i = s.indexOf(', ', from);
    if (i < 1) break;
    const tail = s.slice(i + 2);
    if (isPlaceLike(tail)) return { name: trimSep(s.slice(0, i)), place: tail.trim() };
    from = i + 2;
  }
  const inM = /^(.*\S)\s+in\s+(\p{Lu}[\p{L}.\- ]{1,30})$/u.exec(s);
  if (inM && isOrgLike(inM[1]) && isPlaceLike(inM[2])) return { name: inM[1], place: inM[2] };
  return { name: s, place: '' };
}

// ── Sprachen ───────────────────────────────────────────────────────────────

const LEVEL_WORD = /^(?:muttersprache|muttersprachlich|erstsprache|zweitsprache|native(?: speaker)?|mother tongue|first language|langue maternelle|lengua materna|nativo|nativa|idioma nativo|bilingu\p{L}{0,4}|zweisprachig|verhandlungssicher|fließend|fliessend|flie[ßs]end in wort und schrift|sehr gut|gut|gute kenntnisse|sehr gute kenntnisse|grundkenntnisse|basiskenntnisse|schulkenntnisse|erweiterte kenntnisse|konversationssicher|fluent|proficient|advanced|intermediate|basic|beginner|elementary|conversational|business fluent|courant|bilingue|interm[ée]diaire|d[ée]butant|notions|scolaire|professionnel|avanc[ée]|fluido|avanzado|intermedio|b[áa]sico|alto|medio|conversacional|[abc][12](?:\s?[-/+]\s?[abc]?[12])?\+?)(?![\p{L}])/iu;
const LANG_NAMES = /^(?:deutsch|german|allemand|alemán|aleman|englisch|english|anglais|inglés|ingles|französisch|franzoesisch|french|français|francais|francés|frances|spanisch|spanish|espagnol|español|espanol|castellano|italienisch|italian|italien|italiano|portugiesisch|portuguese|portugais|portugués|niederländisch|dutch|néerlandais|neerlandés|russisch|russian|russe|ruso|polnisch|polish|polonais|polaco|türkisch|turkish|turc|turco|arabisch|arabic|arabe|árabe|chinesisch|chinese|chinois|chino|mandarin|mandarín|japanisch|japanese|japonais|japonés|koreanisch|korean|schwedisch|swedish|dänisch|danish|norwegisch|norwegian|finnisch|finnish|griechisch|greek|tschechisch|czech|ungarisch|hungarian|rumänisch|romanian|kroatisch|croatian|serbisch|serbian|ukrainisch|ukrainian|persisch|farsi|persian|hindi|hebräisch|hebrew|latein|latin|katalanisch|catalan|catalán|plattdeutsch|niederdeutsch|gebärdensprache|kurdisch|kurdish|albanisch|albanian|bulgarisch|bulgarian|vietnamesisch|vietnamese|thai|urdu|bengali|tamil|swahili|tigrinya|dari|paschtu|pashto|somali)(?![\p{L}])/iu;

function parseLangItem(item: string): LanguageEntry | null {
  let t = flat(item).replace(/[.;]$/, '').trim();
  if (!t || t.length > 160) return null;
  let dots: number | undefined;
  const d = /\((\d)\/5\)\s*$/.exec(t);
  if (d) { dots = Math.max(1, Math.min(5, +d[1])); t = t.slice(0, d.index).trim(); }
  let name = t, level = '';
  let m = /^([^()]{1,60})\(([^()]{1,100})\)\s*(.*)$/.exec(t);
  if (m) { name = m[1].trim(); level = [m[2].trim(), trimSep(m[3])].filter(Boolean).join(', '); }
  else if ((m = /^([^:]{1,60}):\s*(.+)$/.exec(t))) { name = m[1].trim(); level = m[2].trim(); }
  else if ((m = /^(.{1,60}?)\s+[–—-]{1,2}\s+(.+)$/.exec(t)) || (m = /^([^\s–—-]{2,40})\s?[–—]\s?(.+)$/.exec(t))) { name = m[1].trim(); level = m[2].trim(); }
  else if (t.includes('\t')) { const [a, ...b] = t.split('\t'); name = a.trim(); level = b.join(' ').trim(); }
  else {
    const sp = /^(\S+)\s+(.+)$/.exec(t);
    if (sp && LEVEL_WORD.test(sp[2])) { name = sp[1]; level = sp[2]; }
  }
  if (LEVEL_WORD.test(name) && !LEVEL_WORD.test(level) && level) [name, level] = [level, name];
  name = trimSep(name);
  if (!name || words(name) > 4 || name.length > 50 || /\d/.test(name)) return null;
  const e: LanguageEntry = { language: clipField(name, 80), level: clipField(level, 120) };
  if (dots) e.dots = dots;
  return e;
}

const looksSpoken = (items: string[]) => items.length > 0 && items.filter(i => LANG_NAMES.test(i.trim())).length * 2 >= items.length;

// ── Zwischenspeicher ────────────────────────────────────────────────────────

interface Acc {
  lang: Lang;
  P: Partial<PersonalInfo>;
  socials: SocialLink[];
  profile: string;
  headProfile: string[];
  exp: ExperienceEntry[];
  edu: EducationEntry[];
  skills: SkillGroup[];
  langs: LanguageEntry[];
  projects: ProjectEntry[];
  certs: CertificateEntry[];
  vols: VolunteerEntry[];
  pubs: PublicationEntry[];
  custom: CustomSection[];
  additional: string[];
  unsorted: string[];
}

function pushUnsorted(acc: Acc, prefix: string, text: string) {
  const t = flat(text);
  if (!t || acc.unsorted.length >= MAX_UNSORTED) return;
  acc.unsorted.push(clipField(prefix ? `${prefix}: ${t}` : t, LONG));
}

function addSocial(acc: Acc, platform: SocialPlatform, value: string) {
  const v = clipField(value);
  if (!v || acc.socials.some(s => s.platform === platform && s.value === v)) return;
  if (acc.socials.length < 20) acc.socials.push({ id: uid('s'), platform, value: v });
}

function setField(acc: Acc, f: PField, value: string, prefix: string, label?: string): void {
  const v = clipField(flat(value), f === 'name' ? 120 : f === 'title' ? 160 : SHORT);
  if (!v) return;
  const P = acc.P;
  if (f === 'location') { P.location = P.location ? clipField(`${P.location}, ${v}`) : v; return; }
  if (P[f]) { if (P[f] !== v) pushUnsorted(acc, prefix, label ? `${label}: ${v}` : v); return; }
  P[f] = v;
}

const SKILL_DEFAULT: Record<Lang, string> = { de: 'Kenntnisse', en: 'Skills', fr: 'Compétences', es: 'Habilidades' };

function niceLabel(s: string): string {
  const t = flat(s).replace(/\s*:$/, '');
  if (t.length > 3 && t === t.toUpperCase() && t !== t.toLowerCase()) return t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}

function addSkills(acc: Acc, label: string, items: string[]) {
  const lab = clipField(niceLabel(label) || SKILL_DEFAULT[acc.lang], 120);
  let g = acc.skills.find(x => x.label.toLowerCase() === lab.toLowerCase());
  if (!g) { if (acc.skills.length >= 30) return; g = { label: lab, items: [] }; acc.skills.push(g); }
  for (const it of items) {
    const v = clipField(flat(it), SHORT);
    if (v && g.items.length < MAX_ITEMS) g.items.push(v);
  }
}

function addCustom(acc: Acc, title: string, item: string) {
  const t = clipField(niceLabel(title), SHORT);
  let s = acc.custom.find(x => x.title.toLowerCase() === t.toLowerCase());
  if (!s) { if (acc.custom.length >= 20) return; s = { id: uid('sec'), title: t, items: [], entries: [] }; acc.custom.push(s); }
  const v = clipField(flat(item), LONG);
  if (v && s.items!.length < MAX_ITEMS) s.items!.push(v);
}

// ── Kontaktzeilen ───────────────────────────────────────────────────────────

/** Liest Kontaktangaben aus einer Zeile. Gibt die Teile zurück, die nichts
 *  Kontaktartiges enthielten, und ob überhaupt etwas erkannt wurde. */
function parseContactLine(acc: Acc, line: string, prefix: string): { used: boolean; rest: string[] } {
  const t = cleanInline(line);
  const whole = labelSplit(t);
  if (whole) {
    const f = fieldOfLabel(whole.label);
    const social = SOCIAL_LABEL[whole.label.toLowerCase()];
    const multi = /\s\|\s|\s·\s|\s•\s|\t/.test(whole.value) && /:\s/.test(whole.value);
    if ((f || social) && whole.value && !multi) {
      if (social) addSocial(acc, social, whole.value);
      else setField(acc, f!, whole.value, prefix, whole.label);
      return { used: true, rest: [] };
    }
  }
  let segs = t.split(/\s*\|\s*|\s+[·•]\s+|[·•]|\t+|\s*;\s*/).map(s => s.trim()).filter(Boolean);
  segs = segs.flatMap(s => (s.includes(', ') && (EMAIL_RE.test(s) || phoneIn(s)) && !isAddressLike(s) ? s.split(/\s*,\s*/) : [s]));
  let used = false;
  const rest: string[] = [];
  for (const seg of segs) {
    if (handleContactSeg(acc, seg, prefix)) used = true;
    else rest.push(seg);
  }
  if (used) {
    const left: string[] = [];
    for (const r of rest) {
      if (!acc.P.location && isPlaceLike(r)) setField(acc, 'location', r, prefix);
      else left.push(r);
    }
    return { used, rest: left };
  }
  return { used, rest };
}

function fieldOfLabel(label: string): PField | null {
  const l = label.toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '').trim();
  for (const [re, f] of LABEL_FIELDS) if (re.test(l)) return f;
  return null;
}

function handleContactSeg(acc: Acc, seg: string, prefix: string): boolean {
  const ls = labelSplit(seg);
  if (ls && ls.value) {
    const social = SOCIAL_LABEL[ls.label.toLowerCase()];
    if (social) { addSocial(acc, social, ls.value); return true; }
    const f = fieldOfLabel(ls.label);
    if (f) { setField(acc, f, ls.value, prefix, ls.label); return true; }
  }
  const s = seg.replace(/^(?:📧|✉️?|☎️?|📞|📱|📍|🏠|🌐|🔗|💼)\s*/u, '').trim();
  const em = EMAIL_RE.exec(s);
  if (em) {
    setField(acc, 'email', em[0], prefix);
    const other = trimSep(s.replace(em[0], ''));
    if (other && !/^(?:e-?mail|mail)$/i.test(other)) pushUnsorted(acc, prefix, other);
    return true;
  }
  const url = URL_RE.exec(s);
  if (url && url[0].length >= s.length - 12) {
    const u = url[0].replace(/[.)]+$/, '');
    const plat = SOCIAL_HOST.find(([re]) => re.test(u));
    if (plat) addSocial(acc, plat[1], u);
    else setField(acc, 'website', u, prefix);
    return true;
  }
  const ph = phoneIn(s);
  if (ph && ph.replace(/\D/g, '').length >= s.replace(/\D/g, '').length - 1 && s.replace(/[\d\s()+/.\-–]/g, '').length <= 14) {
    setField(acc, 'phone', ph, prefix);
    return true;
  }
  if (isAddressLike(s)) { setField(acc, 'location', s, prefix); return true; }
  return false;
}

// ── Erste Stufe: Zeilen in Abschnitte teilen ────────────────────────────────

interface Ln { t: string; blank: boolean; hd: Heading | null; sep?: boolean; indent?: boolean }
interface Block { sec: Sec; title: string; lines: Ln[] }

function isNameLike(s: string): boolean {
  const t = flat(s);
  if (t.length < 3 || t.length > 70 || /[\d@:!?;|]|https?|www\./i.test(t) || /[.,]$/.test(t)) return false;
  const w = t.split(/\s+/);
  if (w.length < 2 || w.length > 6) return false;
  if (broadSection(t) || DOC_TITLE.test(t)) return false;
  return w.every(x => /^[\p{Lu}][\p{L}'’.-]*$/u.test(x) || /^(?:von|van|de|der|den|la|le|del|da|di|du|y|zu|ten|ter|al|el|bin|dos|das)$/.test(x));
}

function splitBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [{ sec: 'head', title: '', lines: [] }];
  let cur = blocks[0];
  let headName = false, lastHeadWasName = false;
  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith('|') && isSepRow(tableCells(t))) { cur.lines.push({ t, blank: false, hd: null, sep: true }); continue; }
    if (!t || isRule(t)) { cur.lines.push({ t: '', blank: true, hd: null }); continue; }
    const hd = headingOf(t);
    if (hd) {
      let sec: Sec | null;
      if (hd.kind === 'md' && hd.level <= 2) sec = broadSection(hd.text);
      else if (hd.kind === 'md') sec = exactSection(hd.text);
      else {
        sec = exactSection(hd.text);
        /* „**Praktikum Marketing**" im Berufsweg ist eine Station, keine Überschrift. */
        if (sec && sec === cur.sec && !EXACT[normHeading(hd.text)]) sec = null;
      }
      if (sec === 'profile' && cur.sec === 'head' && !headName && /^r[ée]sum[ée]$|^resume$/i.test(normHeading(hd.text))) sec = null;
      if (sec) {
        if (!(hd.kind === 'plain' && sec === cur.sec)) {
          cur = { sec, title: niceLabel(hd.text.replace(/\s*:$/, '')), lines: [] };
          blocks.push(cur);
        }
        continue;
      }
      if (hd.kind === 'md' && hd.level <= 2) {
        if (cur.sec === 'head' && (!headName || lastHeadWasName)) { /* Name oder Berufsbezeichnung */ }
        else if (DOC_TITLE.test(normHeading(hd.text))) continue;
        else { cur = { sec: 'unknown', title: niceLabel(hd.text), lines: [] }; blocks.push(cur); continue; }
      }
    }
    cur.lines.push({ t, blank: false, hd, indent: /^(?: {2,}|\t)/.test(raw) });
    if (cur.sec === 'head') {
      const c = stripDocTitle(cleanInline(t.replace(/^#{1,6}\s+/, '')));
      const first = c.split(/\s*\|\s*|\s+[·•]\s+|\t/)[0] ?? '';
      if (!headName && isNameLike(first)) { headName = true; lastHeadWasName = true; }
      else lastHeadWasName = false;
    }
  }
  return blocks;
}

// ── Zweite Stufe: Abschnitte lesen ──────────────────────────────────────────

/** „Kenntnisse: Python, Java" mitten im Kopf oder unter „Weiteres". */
function tryInlineSection(acc: Acc, t: string, prefix: string): boolean {
  const ls = labelSplit(t);
  if (!ls || !ls.value || words(ls.label) > 4) return false;
  const sec = exactSection(ls.label) ?? broadSection(ls.label);
  if (!sec) return false;
  const items = splitList(ls.value);
  switch (sec) {
    case 'skills':
      if (looksSpoken(items)) { for (const it of items) pushLang(acc, it, prefix); return true; }
      addSkills(acc, ls.label, items); return true;
    case 'languages': for (const it of items) pushLang(acc, it, prefix); return true;
    case 'interests': case 'awards': addCustom(acc, ls.label, ls.value); return true;
    case 'profile': acc.profile = acc.profile ? `${acc.profile}\n${ls.value}` : ls.value; return true;
    case 'certificates': pushCert(acc, ls.value, prefix); return true;
    case 'additional': acc.additional.push(clipField(ls.value, LONG)); return true;
    default: return false;
  }
}

function pushLang(acc: Acc, item: string, prefix: string, levelForAll = '') {
  const e = parseLangItem(item);
  if (!e) { pushUnsorted(acc, prefix, item); return; }
  if (levelForAll && !e.level) e.level = clipField(levelForAll, 120);
  if (acc.langs.length < 30) acc.langs.push(e);
}

function parseHead(acc: Acc, b: Block) {
  let lastWasName = false;
  for (const L of b.lines) {
    if (L.blank || L.sep) continue;
    const raw = L.t.replace(/^#{1,6}\s+/, '');
    const bt = bulletOf(raw);
    const t = cleanInline(bt ?? raw);
    if (!t) continue;
    if (DOC_TITLE.test(t)) continue;
    const c = stripDocTitle(t);
    if (!c) continue;
    if (!acc.P.name) {
      const segs = c.split(/\s*\|\s*|\s+[·•]\s+|\t/);
      if (isNameLike(segs[0]) && !hasContact(segs[0])) {
        setField(acc, 'name', segs[0], '');
        const rest = segs.slice(1).join(' | ');
        if (rest) {
          const r = parseContactLine(acc, rest, '');
          for (const x of r.rest) pushUnsorted(acc, '', x);
        }
        lastWasName = true;
        continue;
      }
    }
    const r = parseContactLine(acc, c, '');
    if (r.used) { for (const x of r.rest) pushUnsorted(acc, '', x); lastWasName = false; continue; }
    if (lastWasName && !acc.P.title && c.length <= 100 && words(c) <= 12 && !/[.!?:]$/.test(c) && !extractDates(c)) {
      setField(acc, 'title', c, '');
      lastWasName = false;
      continue;
    }
    lastWasName = false;
    if (tryInlineSection(acc, c, '')) continue;
    if (flat(c).length > 80) { acc.headProfile.push(flat(c)); continue; }
    pushUnsorted(acc, '', c);
  }
}

function parseContact(acc: Acc, b: Block) {
  for (const L of b.lines) {
    if (L.blank || L.sep) continue;
    const raw = L.t.replace(/^#{1,6}\s+/, '');
    const t = cleanInline(bulletOf(raw) ?? raw);
    if (!t) continue;
    const r = parseContactLine(acc, t, b.title);
    if (r.used) { for (const x of r.rest) pushUnsorted(acc, b.title, x); continue; }
    if (!acc.P.name && isNameLike(t)) { setField(acc, 'name', t, b.title); continue; }
    if (tryInlineSection(acc, t, b.title)) continue;
    pushUnsorted(acc, b.title, t);
  }
}

function parseProfile(acc: Acc, b: Block) {
  const out: string[] = [];
  let para = '';
  const flush = () => { if (para) out.push(para); para = ''; };
  for (const L of b.lines) {
    if (L.blank) { flush(); if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
    const raw = L.t.replace(/^#{1,6}\s+/, '');
    const bt = bulletOf(raw);
    const t = flat(cleanInline(bt ?? raw));
    if (!t) continue;
    if (bt !== null) { flush(); out.push(t); continue; }
    if (para && !/[.!?:;]$/.test(para) && /^\p{Ll}/u.test(t)) para = `${para} ${t}`;
    else { flush(); para = t; }
  }
  flush();
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (text) acc.profile = clipField(acc.profile ? `${acc.profile}\n\n${text}` : text, 6000);
}

function parseSkills(acc: Acc, b: Block) {
  let label = b.title;
  for (const L of b.lines) {
    if (L.blank || L.sep) continue;
    if (L.hd && (L.hd.kind === 'md' || L.hd.kind === 'bold' || L.hd.kind === 'colon')) { label = L.hd.text; continue; }
    if (isTableLine(L.t)) {
      const cells = tableCells(L.t);
      if (cells.length >= 2 && !/^(?:kategorie|category|bereich|skill|kenntnis|f[äa]higkeit|comp[ée]tence|habilidad|area)/i.test(cells[0])) addSkills(acc, cells[0], cells.slice(1).flatMap(c => splitList(c)));
      else if (cells.length === 1) addSkills(acc, label, splitList(cells[0]));
      continue;
    }
    const raw = L.t;
    const t = cleanInline(bulletOf(raw) ?? raw);
    if (!t) continue;
    const ls = labelSplit(t);
    if (ls && ls.value && words(ls.label) <= 5) {
      const items = splitList(ls.value);
      const sec = exactSection(ls.label);
      if (sec === 'languages' && looksSpoken(items)) { for (const it of items) pushLang(acc, it, b.title); continue; }
      if (LANG_NAMES.test(ls.label) && LEVEL_WORD.test(ls.value)) { pushLang(acc, t, b.title); continue; }
      addSkills(acc, ls.label, items);
      continue;
    }
    addSkills(acc, label, splitList(t));
  }
}

function parseLanguages(acc: Acc, b: Block) {
  for (const L of b.lines) {
    if (L.blank || L.sep) continue;
    let raw = L.t;
    if (isTableLine(raw)) {
      const cells = tableCells(raw);
      if (!cells.length || /^(?:sprache|language|langue|idioma|niveau|level|nivel)$/i.test(cells[0])) continue;
      raw = cells.length >= 2 ? `${cells[0]}: ${cells.slice(1).join(', ')}` : cells[0];
    }
    const t = cleanInline(bulletOf(raw) ?? raw);
    if (!t) continue;
    const ls = labelSplit(t);
    if (ls && ls.value) {
      const items = splitList(ls.value);
      if (LEVEL_WORD.test(ls.label) && !LEVEL_WORD.test(ls.value)) { for (const it of items) pushLang(acc, it, b.title, ls.label); continue; }
      if (exactSection(ls.label) === 'languages' || (!LANG_NAMES.test(ls.label) && items.length > 1)) { for (const it of items) pushLang(acc, it, b.title); continue; }
      pushLang(acc, t, b.title);
      continue;
    }
    const items = splitList(t, false);
    if (items.length > 1 && items.every(i => parseLangItem(i))) { for (const it of items) pushLang(acc, it, b.title); continue; }
    pushLang(acc, t.replace(/\t/g, ' – '), b.title);
  }
}

function pushCert(acc: Acc, text: string, prefix: string) {
  const t = flat(text);
  if (!t) return;
  const h = extractDates(t);
  const rest = h ? removeDate(t, h) : t;
  const parts = strongSplit(rest);
  const urlIdx = parts.findIndex(p => URL_RE.test(p) && URL_RE.exec(p)![0].length >= p.length - 2);
  const url = urlIdx >= 0 ? parts.splice(urlIdx, 1)[0] : '';
  if (!parts.length) { pushUnsorted(acc, prefix, t); return; }
  const date = h ? (h.end && h.end !== 'present' ? (h.start && !h.single ? `${h.start} – ${h.end}` : h.end) : h.start) : '';
  if (acc.certs.length >= MAX_ENTRIES) { pushUnsorted(acc, prefix, t); return; }
  acc.certs.push({
    id: uid('crt'),
    name: clipField(parts[0]),
    issuer: clipField(parts.slice(1).join(', ')),
    date: clipField(date, 60),
    credentialId: '',
    url: clipField(url),
  });
}

function parseCertificates(acc: Acc, b: Block) {
  let last = '';
  for (const L of b.lines) {
    if (L.blank || L.sep) continue;
    const raw = isTableLine(L.t) ? tableCells(L.t).join(' | ') : L.t;
    if (!raw || /^(?:name|zertifikat|certificate|titel|title)\s*\|/i.test(raw)) continue;
    const isHd = !!L.hd && (L.hd.kind === 'md' || L.hd.kind === 'bold');
    const bt = bulletOf(raw);
    const t = cleanInline(isHd ? L.hd!.text : (bt ?? raw));
    if (!t) continue;
    if (!isHd && bt !== null && last && b.lines.some(x => x.hd && x.hd.kind === 'md')) { pushUnsorted(acc, `${b.title} – ${last}`, t); continue; }
    pushCert(acc, t, b.title);
    last = t;
  }
}

function parsePublications(acc: Acc, b: Block) {
  for (const L of b.lines) {
    if (L.blank || L.sep) continue;
    const raw = L.hd ? L.hd.text : L.t;
    const t = flat(cleanInline(bulletOf(raw) ?? raw));
    if (!t) continue;
    const h = extractDates(t);
    const rest = h ? removeDate(t, h) : t;
    const parts = strongSplit(rest);
    const urlIdx = parts.findIndex(p => URL_RE.test(p));
    const url = urlIdx >= 0 ? (URL_RE.exec(parts.splice(urlIdx, 1)[0])?.[0] ?? '') : '';
    if (!parts.length || acc.pubs.length >= MAX_ENTRIES) { pushUnsorted(acc, b.title, t); continue; }
    acc.pubs.push({ id: uid('pub'), title: clipField(parts[0]), publisher: clipField(parts.slice(1).join(', ')), date: h ? (h.single ? h.start : h.end && h.end !== 'present' ? h.end : h.start) : '', url: clipField(url), description: '' });
  }
}

function parseListSection(acc: Acc, b: Block) {
  for (const L of b.lines) {
    if (L.blank || L.sep) continue;
    const raw = isTableLine(L.t) ? tableCells(L.t).join(' | ') : (L.hd ? L.hd.text : L.t);
    const t = cleanInline(bulletOf(raw) ?? raw);
    if (!t) continue;
    if (b.sec === 'additional') {
      const ls = labelSplit(t);
      const f = ls && ls.value ? fieldOfLabel(ls.label) : null;
      if (f && f !== 'name' && f !== 'title') { setField(acc, f, ls!.value, b.title, ls!.label); continue; }
      if (tryInlineSection(acc, t, b.title)) continue;
      if (acc.additional.length < MAX_ITEMS) acc.additional.push(clipField(flat(t), LONG));
      continue;
    }
    addCustom(acc, b.title, t);
  }
}

function parseUnknown(acc: Acc, b: Block) {
  for (const L of b.lines) {
    if (L.blank || L.sep) continue;
    const raw = L.hd ? L.hd.text : L.t;
    const t = cleanInline(bulletOf(raw) ?? raw);
    if (!t) continue;
    const ls = labelSplit(t);
    const f = ls && ls.value ? fieldOfLabel(ls.label) : null;
    if (f && f !== 'name' && f !== 'title') { setField(acc, f, ls!.value, b.title, ls!.label); continue; }
    pushUnsorted(acc, b.title, t);
  }
}

// ── Stationen (Berufsweg, Ausbildung, Projekte, Ehrenamt) ──────────────────

interface RawEntry {
  header: string[];
  start: string; end: string; dated: boolean; single: boolean;
  bullets: string[]; text: string[];
  fromBullet: boolean;
  fixed?: { role?: string; org?: string; location?: string };
}

const SUB_LABEL = /^(?:aufgaben(?:bereiche?)?|t[äa]tigkeiten|t[äa]tigkeitsschwerpunkte|verantwortlichkeiten|verantwortung|schwerpunkte|erfolge|highlights|kernaufgaben|hauptaufgaben|responsibilities|key responsibilities|duties|achievements|key achievements|accomplishments|missions?(?: principales)?|r[ée]alisations|responsabilit[ée]s|tareas|funciones|logros|responsabilidades|inhalte|themen|key skills|technologies|technologien)\s*:?$/i;

const isTableLine = (t: string) => /^\|.*\|/.test(t.trim());
function tableCells(t: string): string[] {
  return t.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}
const isSepRow = (cells: string[]) => cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c) || c === '');

function newEntry(): RawEntry {
  return { header: [], start: '', end: '', dated: false, single: false, bullets: [], text: [], fromBullet: false };
}

function addHeader(e: RawEntry, c: string) {
  const h = extractDates(c);
  let rest = c;
  if (h && !e.dated) {
    e.start = h.start; e.end = h.end; e.dated = true; e.single = h.single;
    rest = removeDate(c, h);
  }
  rest = trimSep(rest);
  if (rest) e.header.push(rest);
}

function headerPartCount(e: RawEntry) {
  return e.header.reduce((n, h) => n + strongSplit(h).length, 0);
}

const isShortHeader = (c: string) => c.length <= 90 && words(c) <= 10 && !/[.!?;:,]$/.test(c) && !/^\p{Ll}/u.test(c);

function splitCellBullets(c: string): string[] {
  return c.split(/<br\s*\/?>|\s*[•·]\s+|\s*;\s+|\n/i).map(x => trimSep(cleanInline(x))).filter(Boolean);
}

function tableEntries(lines: string[]): RawEntry[] {
  const rows = lines.map(tableCells);
  let header: string[] | null = null;
  let data = rows;
  if (rows.length >= 2 && isSepRow(rows[1])) { header = rows[0].map(c => normHeading(cleanInline(c))); data = rows.slice(2); }
  data = data.filter(r => !isSepRow(r) && r.some(Boolean));
  type Col = 'date' | 'start' | 'end' | 'role' | 'org' | 'loc' | 'desc' | null;
  const colOf = (h: string): Col => {
    if (/^(?:von|start|beginn|from|du|de|desde)$/.test(h)) return 'start';
    if (/^(?:bis|ende|end|to|au|hasta|a)$/.test(h)) return 'end';
    if (/zeit|datum|jahr|period|date|year|p[ée]riode|ann[ée]e|fecha|a[ñn]o|dauer/.test(h)) return 'date';
    if (/position|titel|rolle|t[äa]tigkeit$|funktion|beruf|stelle|role|title|job|poste|fonction|puesto|cargo|abschluss|degree|dipl[ôo]me|t[íi]tulo|studiengang|qualifikation/.test(h)) return 'role';
    if (/firma|unternehmen|arbeitgeber|betrieb|company|employer|organi[sz]ation|entreprise|soci[ée]t[ée]|empresa|schule|hochschule|universit|institution|einrichtung|bildungseinrichtung|school|[ée]tablissement|[ée]cole|centro|instituci/.test(h)) return 'org';
    if (/^(?:ort|standort|location|city|lieu|ville|ciudad|lugar|ubicaci[óo]n)$/.test(h)) return 'loc';
    if (/aufgaben|beschreibung|t[äa]tigkeiten|inhalt|details|description|responsibilit|missions|tareas|funciones|note|grade|schwerpunkt|erfolge|achievements/.test(h)) return 'desc';
    return null;
  };
  const cols = header ? header.map(colOf) : null;
  const out: RawEntry[] = [];
  for (const r of data) {
    const e = newEntry();
    if (cols && cols.some(c => c === 'role' || c === 'org')) {
      e.fixed = {};
      r.forEach((cell, i) => {
        const c = cleanInline(cell);
        if (!c) return;
        switch (cols[i]) {
          case 'date': { const h = extractDates(c); if (h) { e.start = h.start; e.end = h.end; e.dated = true; e.single = h.single; } break; }
          case 'start': { const h = extractDates(c); if (h) { e.start = h.start; e.dated = true; } break; }
          case 'end': { const h = extractDates(c); if (h) { e.end = h.single || !h.end ? h.start : h.end; e.dated = true; } else if (PRESENT_RE.test(c)) { e.end = 'present'; e.dated = true; } break; }
          case 'role': e.fixed!.role = flat(c); break;
          case 'org': e.fixed!.org = flat(c); break;
          case 'loc': e.fixed!.location = flat(c); break;
          case 'desc': e.bullets.push(...splitCellBullets(cell)); break;
          default: e.text.push(flat(c));
        }
      });
    } else {
      for (const cell of r) {
        const c = cleanInline(cell);
        if (!c) continue;
        if (c.length > 90 || /<br|•/i.test(cell)) { e.bullets.push(...splitCellBullets(cell)); continue; }
        addHeader(e, c);
      }
    }
    out.push(e);
  }
  return out;
}

/** „EDV-Kenntnisse: …" oder „Sprachen: …" am Ende eines Stationsabschnitts. */
function isInlineOther(c: string): boolean {
  const ls = labelSplit(c);
  if (!ls || !ls.value || words(ls.label) > 4) return false;
  const sec = exactSection(ls.label);
  return !!sec && sec !== 'experience' && sec !== 'education' && sec !== 'projects' && sec !== 'volunteering' && sec !== 'contact';
}

function parseEntries(lines: Ln[], divert: (c: string) => void): { entries: RawEntry[]; stray: string[] } {
  const entries: RawEntry[] = [];
  const stray: string[] = [];
  let cur = null as RawEntry | null;
  let lastKind: 'bullet' | 'text' | 'header' | null = null;
  const flush = () => { if (cur && (cur.header.length || cur.dated || cur.bullets.length || cur.text.length || cur.fixed)) entries.push(cur); cur = null; };
  const start = (c: string, fromBullet = false) => { flush(); const e = newEntry(); e.fromBullet = fromBullet; addHeader(e, c); cur = e; lastKind = 'header'; };
  const dateAhead = (i: number) => {
    let seen = 0;
    for (let j = i + 1; j < lines.length && seen < 2; j++) {
      const L = lines[j];
      if (L.blank || L.sep) continue;
      seen++;
      if (bulletOf(L.t) !== null) return false;
      const c = cleanInline(L.t);
      const h = extractDates(c);
      if (h && isHeaderish(c, h)) return true;
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (L.blank) { if (lastKind === 'text' || lastKind === 'bullet') lastKind = null; continue; }
    if (isTableLine(L.t)) {
      const tl: string[] = [];
      while (i < lines.length && !lines[i].blank && isTableLine(lines[i].t)) tl.push(lines[i++].t);
      i--;
      flush();
      entries.push(...tableEntries(tl));
      continue;
    }
    if (L.hd && (L.hd.kind === 'md' || L.hd.kind === 'bold')) {
      const c = L.hd.text;
      const cc: RawEntry | null = cur;
      if (L.hd.kind === 'bold' && cc && !cc.dated && !cc.bullets.length && !cc.text.length && headerPartCount(cc) < 2) { addHeader(cc, c); continue; }
      start(c);
      continue;
    }
    const raw = L.t;
    if (/^(?:\*\*|__)[^*_]{1,160}(?:\*\*|__)\s*(?:[|,–—\-·•@(]|bei\s|at\s|chez\s)/.test(raw)) {
      const cc: RawEntry | null = cur;
      if (cc && !cc.dated && !cc.bullets.length && !cc.text.length && headerPartCount(cc) < 2) { addHeader(cc, cleanInline(raw)); lastKind = 'header'; continue; }
      start(cleanInline(raw));
      continue;
    }
    const bt = bulletOf(raw);
    if (bt !== null) {
      const c = cleanInline(bt);
      if (!c) continue;
      const h = extractDates(c);
      const cc: RawEntry | null = cur;
      if (h && isHeaderish(c, h) && (!cc || cc.fromBullet)) { start(c, true); continue; }
      if (!cc) { stray.push(c); continue; }
      if (SUB_LABEL.test(c)) continue;
      if (cc.bullets.length < 60) cc.bullets.push(clipField(flat(c), LONG));
      lastKind = 'bullet';
      continue;
    }
    const c = cleanInline(raw);
    if (!c) continue;
    if (isInlineOther(c)) { divert(c); lastKind = null; continue; }
    const h = extractDates(c);
    const cc: RawEntry | null = cur;
    if (h && isHeaderish(c, h)) {
      if (cc && !cc.dated && !cc.bullets.length && !cc.text.length) { addHeader(cc, c); lastKind = 'header'; }
      else start(c);
      continue;
    }
    if (cc && (lastKind === 'bullet' || lastKind === 'text') && (/^\p{Ll}/u.test(c) || L.indent)) {
      const arr = lastKind === 'bullet' ? cc.bullets : cc.text;
      if (arr.length && !/[.!?]$/.test(arr[arr.length - 1])) { arr[arr.length - 1] = clipField(`${arr[arr.length - 1]} ${flat(c)}`, LONG); continue; }
    }
    if (SUB_LABEL.test(c)) continue;
    const short = isShortHeader(c);
    if (cc && !cc.bullets.length && !cc.text.length && short && headerPartCount(cc) < 2 && cc.header.length < 3) { cc.header.push(c); lastKind = 'header'; continue; }
    if (short && (!cc || dateAhead(i))) { start(c); continue; }
    if (cc) { cc.text.push(clipField(flat(c), LONG)); lastKind = 'text'; }
    else stray.push(c);
  }
  flush();
  return { entries: entries.slice(0, MAX_ENTRIES), stray };
}

/** An „, " teilen, aber nicht in Klammern und nicht in „1,9". */
function commaSplit(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    if (ch === ',' && depth === 0 && /\s/.test(s[i + 1] ?? '')) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}

function headerParts(e: RawEntry, wordSplit: RegExp | null): { parts: string[]; comma: boolean } {
  let parts = e.header.flatMap(strongSplit);
  let comma = false;
  if (parts.length === 1 && wordSplit) {
    const m = wordSplit.exec(parts[0]);
    if (m && m.index > 0) parts = [parts[0].slice(0, m.index), parts[0].slice(m.index + m[0].length)].map(trimSep).filter(Boolean);
  }
  if (parts.length === 1 && parts[0].includes(', ')) {
    parts = commaSplit(parts[0]).map(trimSep).filter(Boolean);
    comma = parts.length > 1;
  }
  return { parts: parts.map(p => trimSep(flat(p))).filter(Boolean), comma };
}

/** Wer ist Rolle, wer Firma, wer Ort? */
function resolveStation(h: { parts: string[]; comma: boolean }, kind: 'exp' | 'edu'): { role: string; org: string; location: string; extra: string[] } {
  const { parts, comma: fromComma } = h;
  if (!parts.length) return { role: '', org: '', location: '', extra: [] };
  const orgTest = (p: string) => isOrgLike(p) && !(kind === 'edu' && isDegreeLike(p) && !ORG_CI.test(p) && !ORG_CS.test(p));
  if (parts.length === 1) {
    const p = parts[0];
    if (kind === 'edu' && orgTest(p) && !isDegreeLike(p)) { const s = splitPlace(p); return { role: '', org: s.name, location: s.place, extra: [] }; }
    return { role: p, org: '', location: '', extra: [] };
  }
  let orgIdx = parts.findIndex(orgTest);
  if (fromComma && parts.length === 2 && orgIdx === 0 && isPlaceLike(parts[1]) && !(kind === 'edu' && isDegreeLike(parts[1]))) {
    return { role: '', org: parts[0], location: parts[1], extra: [] };
  }
  if (kind === 'edu') {
    const degIdx = parts.findIndex(p => isDegreeLike(p) && !isOrgLike(p));
    if (orgIdx < 0 && degIdx > 0) orgIdx = 0;
    if (orgIdx === degIdx) orgIdx = -1;
  }
  if (orgIdx < 0) {
    /* Ohne Rechtsform: „Firma, Ort" ist eher eine Firma als eine Rolle —
     * und wer nach Berufsbezeichnung klingt, ist die Rolle. */
    if (kind === 'exp' && !isRoleLike(parts[0]) && parts.slice(1).some(isRoleLike)) orgIdx = 0;
    else orgIdx = parts.length === 2 && /,\s\p{Lu}/u.test(parts[0]) && !/,/.test(parts[1]) && splitPlace(parts[0]).place ? 0 : 1;
  }
  let org = parts[orgIdx];
  const rest = parts.filter((_, i) => i !== orgIdx);
  let ri = 0;
  if (kind === 'edu') { const di = rest.findIndex(p => isDegreeLike(p)); if (di > 0) ri = di; }
  else if (rest.length > 1 && !isRoleLike(rest[0])) {
    const k = rest.findIndex(isRoleLike);
    const np = rest.findIndex(p => !isPlaceLike(p));
    if (k > 0) ri = k; else if (np > 0 && isPlaceLike(rest[0])) ri = np;
  }
  const role = rest[ri] ?? '';
  const others = rest.filter((_, i) => i !== ri);
  /* Übrige Teile: was nach Ort aussieht, ist der Ort; der Rest geht nicht verloren. */
  let location = others.filter(isPlaceLike).join(', ');
  const extra = others.filter(p => !isPlaceLike(p));
  if (!location) { const s = splitPlace(org); org = s.name; location = s.place; }
  return { role, org, location, extra };
}

const EXP_WORDSPLIT = /\s(?:bei|at|chez|@)\s/i;

const diverter = (acc: Acc, b: Block) => (c: string) => { if (!tryInlineSection(acc, c, b.title)) pushUnsorted(acc, b.title, c); };

function parseExperience(acc: Acc, b: Block) {
  const { entries, stray } = parseEntries(b.lines, diverter(acc, b));
  for (const s of stray) pushUnsorted(acc, b.title, s);
  for (const e of entries) {
    const r = e.fixed ? { role: e.fixed.role ?? '', org: e.fixed.org ?? '', location: e.fixed.location ?? '', extra: [] as string[] } : resolveStation(headerParts(e, EXP_WORDSPLIT), 'exp');
    if (e.fixed && e.text.length) e.bullets.unshift(...e.text.splice(0));
    for (const x of r.extra) pushUnsorted(acc, `${b.title} – ${r.role || r.org}`, x);
    acc.exp.push({
      id: uid('exp'),
      role: clipField(r.role), company: clipField(r.org), location: clipField(r.location),
      start: clipField(e.start, 40), end: clipField(e.end, 40),
      bullets: [...e.bullets, ...e.text].map(x => clipField(x, LONG)).filter(Boolean).slice(0, 60),
    });
  }
}

function parseVolunteering(acc: Acc, b: Block) {
  const { entries, stray } = parseEntries(b.lines, diverter(acc, b));
  for (const s of stray) {
    // Ehrenamt steht oft als einfache Liste: jede Zeile eine Tätigkeit.
    const e = newEntry(); addHeader(e, s); entries.push(e);
  }
  for (const e of entries.slice(0, MAX_ENTRIES)) {
    const r = e.fixed ? { role: e.fixed.role ?? '', org: e.fixed.org ?? '', location: e.fixed.location ?? '', extra: [] as string[] } : resolveStation(headerParts(e, EXP_WORDSPLIT), 'exp');
    acc.vols.push({
      id: uid('vol'), role: clipField(r.role), organization: clipField(r.org), location: clipField(r.location),
      start: clipField(e.start, 40), end: clipField(e.end, 40),
      bullets: [...r.extra, ...e.bullets, ...e.text].map(x => clipField(x, LONG)).slice(0, 60),
    });
  }
}

const NOTE_PART = /^(?:note|abschlussnote|gesamtnote|endnote|abschluss|grade|gpa|mention|nota|calificaci[oó]n|schwerpunkte?|focus|major|minor|thesis|abschlussarbeit|bachelorarbeit|masterarbeit|diplomarbeit|leistungskurse|lk|sp[ée]cialit[ée]|especialidad)(?![\p{L}])/iu;

function parseEducation(acc: Acc, b: Block) {
  const { entries, stray } = parseEntries(b.lines, diverter(acc, b));
  for (const s of stray) pushUnsorted(acc, b.title, s);
  for (const e of entries) {
    const hp = headerParts(e, null);
    const noteParts = hp.parts.filter(p => NOTE_PART.test(p));
    hp.parts = hp.parts.filter(p => !NOTE_PART.test(p));
    const r = e.fixed ? { role: e.fixed.role ?? '', org: e.fixed.org ?? '', location: e.fixed.location ?? '', extra: [] as string[] } : resolveStation(hp, 'edu');
    e.text.unshift(...noteParts, ...r.extra);
    let start = e.start, end = e.end;
    if (e.single) { end = start; start = ''; }
    const notes = [...e.text, ...e.bullets].map(flat).filter(Boolean).join('\n');
    const entry: EducationEntry = {
      id: uid('edu'), degree: clipField(r.role), institution: clipField(r.org), location: clipField(r.location),
      start: clipField(start, 40), end: clipField(end, 40),
    };
    if (notes) entry.notes = clipField(notes, LONG);
    acc.edu.push(entry);
  }
}

function parseProjects(acc: Acc, b: Block) {
  const { entries, stray } = parseEntries(b.lines, diverter(acc, b));
  for (const s of stray) { const e = newEntry(); addHeader(e, s); entries.push(e); }
  for (const e of entries.slice(0, MAX_ENTRIES)) {
    let parts = e.fixed ? [e.fixed.role ?? '', e.fixed.org ?? ''].filter(Boolean) : headerParts(e, null).parts;
    let url = '';
    const ui = parts.findIndex(p => { const m = URL_RE.exec(p); return !!m && m[0].length >= p.length - 2; });
    if (ui >= 0) { url = parts[ui]; parts = parts.filter((_, i) => i !== ui); }
    if (!url) {
      const all = [...e.text, ...e.bullets].join(' ');
      const m = URL_RE.exec(all);
      if (m && e.text.length + e.bullets.length <= 1 && m[0].length >= all.length - 2) url = m[0];
    }
    if (!parts.length && !e.bullets.length && !e.text.length) continue;
    acc.projects.push({
      id: uid('prj'), title: clipField(parts[0] ?? ''), role: clipField(parts.slice(1).join(', ')),
      start: clipField(e.single ? e.start : e.start, 40), end: clipField(e.end, 40), url: clipField(url),
      description: clipField(e.text.join('\n'), LONG),
      bullets: e.bullets.map(x => clipField(x, LONG)).slice(0, 60),
    });
  }
}

// ── Vorverarbeitung ─────────────────────────────────────────────────────────

function normaliseText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029\v\f]/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/[\u200b-\u200d\ufeff\u00ad]/g, '');
}

/** Codeblock-Zäune entfernen. Steht der Lebenslauf IN einem Zaun und
 *  drumherum nur Geplauder der KI, kommt das Geplauder nach „Bitte prüfen". */
function defence(text: string): { main: string; outside: string[] } {
  const lines = text.split('\n');
  const fence = /^\s*(?:```|~~~)/;
  if (!lines.some(l => fence.test(l))) return { main: text, outside: [] };
  const inside: string[] = [], outside: string[] = [];
  let open = false;
  for (const l of lines) {
    if (fence.test(l)) { open = !open; continue; }
    (open ? inside : outside).push(l);
  }
  const size = (a: string[]) => a.join('').replace(/\s+/g, '').length;
  if (size(inside) >= 40 && size(inside) >= size(outside)) {
    return { main: inside.join('\n'), outside: outside.map(l => l.trim()).filter(Boolean) };
  }
  return { main: lines.filter(l => !fence.test(l)).join('\n'), outside: [] };
}

function toLines(text: string): string[] {
  const out: string[] = [];
  for (const l of text.split('\n')) {
    const line = l.length > MAX_LINE ? l.slice(0, MAX_LINE) : l;
    if (/^\s*\|/.test(line)) { out.push(line); continue; }
    for (const p of line.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(?:p|div|li|ul|ol|h[1-6])\b[^>]{0,200}>/gi, '\n').split('\n')) out.push(p);
  }
  return out;
}

/** Eigenes Export-Format (export/exportMarkdown.ts): Frontmatter mit `lang:`. */
function looksLikeOwnExport(t: string): boolean {
  const m = /^---[ \t]*\n([\s\S]{0,2000}?)\n---[ \t]*(?:\n|$)/.exec(t);
  if (!m) return false;
  if (!/^lang:\s*(?:de|en|fr|es)\s*$/m.test(m[1]) || /^doc:\s*cover-letter/m.test(m[1])) return false;
  return /^#{1,2}\s/m.test(t.slice(m[0].length));
}

// ── Zählen ──────────────────────────────────────────────────────────────────

function countFound(cv: CVData): TextImportResult['found'] {
  const p = cv.personal ?? ({} as PersonalInfo);
  const contactKeys: (keyof PersonalInfo)[] = ['email', 'phone', 'location', 'website', 'birthDate', 'birthPlace', 'nationality', 'maritalStatus', 'driversLicense', 'linkedin'];
  const contact = contactKeys.filter(k => typeof p[k] === 'string' && (p[k] as string).trim()).length + (p.socials?.filter(s => s.value?.trim()).length ?? 0);
  return {
    name: !!p.name?.trim(),
    contact,
    experience: cv.experience?.length ?? 0,
    education: cv.education?.length ?? 0,
    skills: (cv.skillGroups ?? []).reduce((n, g) => n + (g.items?.length ?? 0), 0),
    languages: cv.languages?.length ?? 0,
    profile: !!cv.profile?.text?.trim(),
    other: (cv.projects?.length ?? 0) + (cv.certificates?.length ?? 0) + (cv.volunteering?.length ?? 0)
      + (cv.publications?.length ?? 0) + (cv.customSections ?? []).reduce((n, s) => n + (s.items?.length ?? 0) + (s.entries?.length ?? 0), 0)
      + (cv.additionalExperience?.length ?? 0),
  };
}

// ── Einstieg ────────────────────────────────────────────────────────────────

function parseTolerant(main: string, outside: string[], base: CVData, lang: Lang): { cv: CVData; unsorted: string[] } {
  const acc: Acc = {
    lang, P: {}, socials: [], profile: '', headProfile: [],
    exp: [], edu: [], skills: [], langs: [], projects: [], certs: [], vols: [], pubs: [], custom: [], additional: [], unsorted: [],
  };
  for (const o of outside) pushUnsorted(acc, '', cleanInline(o));

  const blocks = splitBlocks(toLines(main));
  for (const b of blocks) {
    switch (b.sec) {
      case 'head': parseHead(acc, b); break;
      case 'contact': parseContact(acc, b); break;
      case 'profile': parseProfile(acc, b); break;
      case 'experience': parseExperience(acc, b); break;
      case 'education': parseEducation(acc, b); break;
      case 'skills': parseSkills(acc, b); break;
      case 'languages': parseLanguages(acc, b); break;
      case 'certificates': parseCertificates(acc, b); break;
      case 'projects': parseProjects(acc, b); break;
      case 'volunteering': parseVolunteering(acc, b); break;
      case 'publications': parsePublications(acc, b); break;
      case 'interests': case 'awards': case 'additional': parseListSection(acc, b); break;
      default: parseUnknown(acc, b);
    }
  }
  if (acc.headProfile.length) {
    if (!acc.profile) acc.profile = clipField(acc.headProfile.join('\n\n'), 6000);
    else for (const h of acc.headProfile) pushUnsorted(acc, '', h);
  }

  const cv = clone(base);
  const prevPersonal = clone(base.personal ?? { name: '', title: '', location: '', email: '', phone: '' });
  cv.personal = { ...prevPersonal, ...acc.P } as PersonalInfo;
  for (const k of ['name', 'title', 'location', 'email', 'phone'] as const) if (typeof cv.personal[k] !== 'string') cv.personal[k] = '';
  if (acc.socials.length) cv.personal.socials = [...(prevPersonal.socials ?? []), ...acc.socials];
  cv.profile = { text: acc.profile || base.profile?.text || '' };
  cv.experience = acc.exp;
  cv.education = acc.edu;
  cv.skillGroups = acc.skills.filter(g => g.items.length);
  cv.languages = acc.langs;
  cv.additionalExperience = acc.additional.length ? acc.additional : (base.additionalExperience ?? []);
  if (acc.projects.length) cv.projects = acc.projects;
  if (acc.certs.length) cv.certificates = acc.certs;
  if (acc.vols.length) cv.volunteering = acc.vols;
  if (acc.pubs.length) cv.publications = acc.pubs;
  const custom = acc.custom.filter(s => s.items?.length || s.entries?.length);
  if (custom.length) cv.customSections = [...(base.customSections ?? []), ...custom];
  cv.labels = base.labels;
  return { cv, unsorted: acc.unsorted };
}

/**
 * Beliebigen Lebenslauf-Text in `CVData` verwandeln. Wirft nie: Im
 * schlimmsten Fall kommt `base` unverändert zurück und jede nicht leere
 * Zeile steht in `unsorted`.
 */
export function importCvText(text: string, base: CVData, lang: Lang): TextImportResult {
  const L: Lang = lang === 'en' || lang === 'fr' || lang === 'es' ? lang : 'de';
  let input = typeof text === 'string' ? text : '';
  if (input.length > MAX_TEXT_IMPORT) input = input.slice(0, MAX_TEXT_IMPORT);
  input = normaliseText(input);
  try {
    const { main, outside } = defence(input);
    const trimmed = main.replace(/^\s*\n/, '').replace(/^[ \t]+(?=---)/, '');
    if (isCvMarkdown(trimmed) && looksLikeOwnExport(trimmed)) {
      const cv = markdownToCvData(trimmed, base);
      return { cv, unsorted: [], found: countFound(cv), strict: true };
    }
    const { cv, unsorted } = parseTolerant(main, outside, base, L);
    return { cv, unsorted, found: countFound(cv), strict: false };
  } catch {
    let cv: CVData;
    try { cv = clone(base); } catch { cv = base; }
    const unsorted = input.split('\n').map(l => l.trim()).filter(l => l && !isRule(l)).slice(0, MAX_UNSORTED).map(l => clipField(l, LONG));
    return { cv, unsorted, found: countFound(cv), strict: false };
  }
}

// ── Word (.docx) → Text ─────────────────────────────────────────────────────

function decodeXml(s: string): string {
  return s.replace(/&(lt|gt|amp|quot|apos|#\d{1,7}|#x[0-9a-fA-F]{1,6});/g, (_m, e: string) => {
    switch (e) {
      case 'lt': return '<';
      case 'gt': return '>';
      case 'amp': return '&';
      case 'quot': return '"';
      case 'apos': return "'";
      default: {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(n); } catch { return ''; }
      }
    }
  });
}

/** document.xml → Text: ein Absatz je Zeile, Tabulator als \t, Listenabsätze
 *  mit „- ", Überschriften-Stile mit „## ". Tabellen: Zellen einer Zeile mit
 *  Tabulator nebeneinander, weitere Absätze einer Zelle darunter. */
export function wordXmlToText(xml: string): string {
  interface Para { parts: string[]; style: string; list: boolean }
  interface Table { rows: string[][][]; row: string[][] | null; cell: string[] | null }
  const out: string[] = [];
  const paras: Para[] = [];
  const tables: Table[] = [];
  let inT = false, inPPr = 0, skip = 0;

  const emit = (line: string) => {
    const tb = tables[tables.length - 1];
    if (tb && tb.cell) tb.cell.push(line);
    else out.push(line);
  };

  const re = /<(\/?)([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[5] !== undefined) {
      if (inT && !skip && paras.length) paras[paras.length - 1].parts.push(decodeXml(m[5]));
      continue;
    }
    const closing = m[1] === '/';
    const ns = (m[2] ?? '').slice(0, -1);
    const name = m[3];
    const attrs = m[4] ?? '';
    const selfClose = attrs.endsWith('/');
    if (ns === 'mc' && name === 'Fallback') { if (!selfClose) skip += closing ? -1 : 1; if (skip < 0) skip = 0; continue; }
    if (skip) continue;
    if (ns !== 'w') continue;
    const top = paras[paras.length - 1];
    switch (name) {
      case 'p':
        if (selfClose) { if (!tables.length) emit(''); break; }
        if (!closing) { paras.push({ parts: [], style: '', list: false }); break; }
        {
          const p = paras.pop();
          if (!p) break;
          const text = p.parts.join('').replace(/[ \u00a0]+/g, ' ');
          const lines = text.split('\n').map(x => x.replace(/^ +| +$/g, ''));
          const heading = /heading|berschrift|überschrift|^titel|^title|^subtitle|^untertitel/i.test(p.style);
          const list = p.list || /^(?:list|liste|aufz)/i.test(p.style);
          if (!lines.some(x => x.trim())) { if (!tables.length) emit(''); break; }
          lines.forEach((x, i) => {
            if (!x.trim()) return;
            const prefix = i === 0 ? (heading ? '## ' : list ? '- ' : '') : '';
            emit(prefix + x);
          });
        }
        break;
      case 'pPr': if (!selfClose) inPPr += closing ? -1 : 1; if (inPPr < 0) inPPr = 0; break;
      case 'pStyle': { const v = /w:val="([^"]*)"/.exec(attrs); if (top && v && inPPr) top.style = v[1]; break; }
      case 'numPr': if (top && inPPr && !closing) top.list = true; break;
      case 't': if (!selfClose) inT = !closing; break;
      case 'tab': if (!inPPr && top && !closing) top.parts.push('\t'); break;
      case 'br': case 'cr': if (top && !closing) top.parts.push('\n'); break;
      case 'noBreakHyphen': if (top) top.parts.push('-'); break;
      case 'tbl':
        if (selfClose) break;
        if (!closing) tables.push({ rows: [], row: null, cell: null });
        else {
          const tb = tables.pop();
          if (!tb) break;
          for (const row of tb.rows) {
            const cells = row.map(c => c.filter(x => x.trim()));
            const n = Math.max(0, ...cells.map(c => c.length));
            for (let k = 0; k < n; k++) {
              const parts = cells.map(c => c[k]).filter((x): x is string => !!x);
              if (!parts.length) continue;
              emit([parts[0], ...parts.slice(1).map(x => x.replace(/^(?:- |## )/, ''))].join('\t'));
            }
            emit('');
          }
        }
        break;
      case 'tr': { const tb = tables[tables.length - 1]; if (!tb || selfClose) break; if (!closing) tb.row = []; else { if (tb.row) tb.rows.push(tb.row); tb.row = null; } break; }
      case 'tc': { const tb = tables[tables.length - 1]; if (!tb || selfClose) break; if (!closing) tb.cell = []; else { if (tb.cell && tb.row) tb.row.push(tb.cell); tb.cell = null; } break; }
      default: break;
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** .docx → Text mit Absätzen. Wirft `Error('docx')`, wenn die Datei kein
 *  Word-Dokument ist (keine word/document.xml im Archiv). */
export async function docxToText(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('docx');
  const xml = await file.async('string');
  return wordXmlToText(xml);
}

// ── Anleitung für ChatGPT/Claude ────────────────────────────────────────────
// Beschreibt genau das Format, das `importCvText` am sichersten liest.

export const CHATGPT_PROMPT: Record<Lang, string> = {
  de: `Bitte bring meinen Lebenslauf (unten) in genau dieses Format.

Regeln:
- Erfinde nichts. Verwende nur Angaben, die in meinem Text stehen. Was fehlt, lässt du weg – keine Platzhalter, keine Beispielwerte.
- Abschnitte und Zeilen, zu denen nichts in meinem Text steht, lässt du komplett weg.
- Datum immer als MM/JJJJ (oder nur JJJJ, wenn der Monat fehlt). Bei einer aktuellen Stelle: „heute".
- Gib nur einen einzigen Codeblock aus, ohne Kommentar davor oder danach.

Format:

# Vorname Nachname
Berufsbezeichnung

## Kontakt
E-Mail: …
Telefon: …
Adresse: …
LinkedIn: …
Website: …
Geburtsdatum: …

## Profil
Zwei bis vier Sätze aus meinem Text.

## Berufserfahrung
### Position | Firma | Ort | MM/JJJJ – MM/JJJJ
- Aufgabe oder Erfolg
- Aufgabe oder Erfolg

## Ausbildung
### Abschluss | Schule oder Hochschule | Ort | MM/JJJJ – MM/JJJJ
- Note oder Schwerpunkt

## Kenntnisse
Bereich: Kenntnis, Kenntnis, Kenntnis

## Sprachen
- Sprache: Niveau

## Zertifikate
- Name | Aussteller | MM/JJJJ

## Projekte
### Projektname | Rolle | MM/JJJJ – MM/JJJJ
- Stichpunkt

## Ehrenamt
### Aufgabe | Organisation | Ort | MM/JJJJ – MM/JJJJ
- Stichpunkt

## Interessen
- …

Mein Lebenslauf:
`,
  en: `Please put my CV (below) into exactly this format.

Rules:
- Do not invent anything. Use only information that appears in my text. If something is missing, leave it out – no placeholders, no sample values.
- Leave out any section or line my text has nothing for.
- Always write dates as MM/YYYY (or just YYYY if the month is missing). For a current job: "present".
- Output a single code block only, with no comment before or after it.

Format:

# First name Last name
Job title

## Contact
Email: …
Phone: …
Address: …
LinkedIn: …
Website: …

## Profile
Two to four sentences taken from my text.

## Work Experience
### Position | Company | City | MM/YYYY – MM/YYYY
- Task or achievement
- Task or achievement

## Education
### Degree | School or university | City | MM/YYYY – MM/YYYY
- Grade or focus

## Skills
Area: skill, skill, skill

## Languages
- Language: level

## Certifications
- Name | Issuer | MM/YYYY

## Projects
### Project name | Role | MM/YYYY – MM/YYYY
- Bullet point

## Volunteering
### Role | Organisation | City | MM/YYYY – MM/YYYY
- Bullet point

## Interests
- …

My CV:
`,
  fr: `Mets mon CV (ci-dessous) exactement dans ce format.

Règles :
- N'invente rien. Utilise uniquement les informations de mon texte. Ce qui manque, tu le laisses de côté – pas d'exemples, pas de valeurs fictives.
- Supprime entièrement les rubriques et les lignes pour lesquelles mon texte ne dit rien.
- Dates toujours au format MM/AAAA (ou seulement AAAA si le mois manque). Pour un poste actuel : « aujourd'hui ».
- Rends un seul bloc de code, sans commentaire avant ni après.

Format :

# Prénom Nom
Intitulé du poste

## Contact
E-mail : …
Téléphone : …
Adresse : …
LinkedIn : …
Site web : …

## Profil
Deux à quatre phrases tirées de mon texte.

## Expérience professionnelle
### Poste | Entreprise | Ville | MM/AAAA – MM/AAAA
- Mission ou réussite
- Mission ou réussite

## Formation
### Diplôme | École ou université | Ville | MM/AAAA – MM/AAAA
- Mention ou spécialité

## Compétences
Domaine : compétence, compétence, compétence

## Langues
- Langue : niveau

## Certifications
- Nom | Organisme | MM/AAAA

## Projets
### Nom du projet | Rôle | MM/AAAA – MM/AAAA
- Point clé

## Bénévolat
### Rôle | Organisation | Ville | MM/AAAA – MM/AAAA
- Point clé

## Centres d'intérêt
- …

Mon CV :
`,
  es: `Pon mi currículum (abajo) exactamente en este formato.

Reglas:
- No inventes nada. Usa solo datos que aparezcan en mi texto. Lo que falte, déjalo fuera: sin marcadores ni valores de ejemplo.
- Omite por completo las secciones y líneas sobre las que mi texto no dice nada.
- Fechas siempre como MM/AAAA (o solo AAAA si falta el mes). Para el puesto actual: «actualidad».
- Devuelve un único bloque de código, sin comentarios antes ni después.

Formato:

# Nombre Apellido
Puesto

## Contacto
Correo: …
Teléfono: …
Dirección: …
LinkedIn: …
Sitio web: …

## Perfil
De dos a cuatro frases sacadas de mi texto.

## Experiencia laboral
### Puesto | Empresa | Ciudad | MM/AAAA – MM/AAAA
- Tarea o logro
- Tarea o logro

## Formación
### Título | Centro o universidad | Ciudad | MM/AAAA – MM/AAAA
- Nota o especialidad

## Habilidades
Área: habilidad, habilidad, habilidad

## Idiomas
- Idioma: nivel

## Certificaciones
- Nombre | Emisor | MM/AAAA

## Proyectos
### Nombre del proyecto | Rol | MM/AAAA – MM/AAAA
- Punto clave

## Voluntariado
### Rol | Organización | Ciudad | MM/AAAA – MM/AAAA
- Punto clave

## Intereses
- …

Mi currículum:
`,
};
