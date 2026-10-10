/**
 * Prüfungen fürs Anschreiben und für Lebenslauf und Anschreiben zusammen.
 *
 * Alles hier ist reine Logik ohne Oberfläche: Eingabe sind die Daten und der
 * Text des exportierten Dokuments (check/docText.ts), Ausgabe eine Liste von
 * Befunden mit Kennung. Die Sätze dazu stehen in ui/i18n/pruefen.ts, in der
 * Sprache der Oberfläche. Geprüft wird von scripts/coverlettercheck.mjs, in
 * beide Richtungen (Anschreiben mit Fehlern → Befund, sauberes → keiner).
 *
 * Grundlagen, auf die sich die Regeln stützen (stehen in der Oberfläche):
 * - Bundesagentur für Arbeit, „Anschreiben": Aufbau (Kontakt, Ort/Datum,
 *   Betreff, Anrede, Einstieg, Hauptteil, Bezug zur Stelle, Schluss),
 *   „Achte darauf, dass das Datum aktuell ist", Anrede mit Namen vorziehen.
 * - Harvard (FAS Career Services, T.H. Chan School): höchstens eine Seite,
 *   auf die Stelle zugeschnitten, an eine bestimmte Person gerichtet,
 *   E-Mail und Telefon gehören dazu.
 * - Eigene Grenzwerte, als solche gekennzeichnet: Länge in Wörtern, Absatz-
 *   länge. Abgeleitet aus den Zeilenangaben der Bundesagentur (Einstieg 3–5,
 *   Hauptteil etwa 8, Bezug etwa 2 Zeilen).
 */
import type { CVData, CoverLetterData, Lang } from '../data/types';
import { DEFAULT_COVER_LETTERS } from '../data/storage';
import { GENERIC_SALUTATIONS } from './styleLists';
import { fold, haystack, contains, jobTerms } from './keywords';
import { guessLang, type PageMeasure } from './docText';

export type Severity = 'fehler' | 'hinweis' | 'ok';

/** Mindestlänge einer Stellenanzeige, ab der abgeglichen wird (wie beim Lebenslauf). */
export const JD_MIN = 60;

export type FindingId =
  // Lesbarkeit und Vollständigkeit
  | 'name-missing' | 'email-missing' | 'email-not-in-text' | 'phone-missing' | 'contact-ok'
  | 'recipient-missing' | 'recipient-ok' | 'address-missing'
  | 'subject-missing' | 'subject-incomplete' | 'subject-ok'
  | 'date-missing' | 'date-old' | 'date-future' | 'date-off' | 'date-ok'
  | 'salutation-missing' | 'salutation-generic' | 'salutation-ok'
  | 'signoff-missing' | 'signoff-ok'
  | 'placeholder' | 'recipient-placeholder' | 'sample-text' | 'no-placeholder'
  | 'too-short' | 'too-long' | 'length-ok'
  | 'one-paragraph' | 'long-paragraph' | 'paragraphs-ok'
  | 'company-not-in-body'
  | 'overflow' | 'fits-page'
  // Abgleich mit der Stellenanzeige
  | 'job-title-missing' | 'job-title-ok' | 'job-title-unknown'
  | 'job-company-missing' | 'job-company-ok' | 'job-company-unknown'
  | 'job-recipient-mismatch' | 'job-contact-generic'
  // Beide Unterlagen
  | 'both-name' | 'both-name-ok' | 'both-email' | 'both-email-ok' | 'both-phone'
  | 'both-lang' | 'both-lang-ok' | 'both-title';

export interface Finding {
  id: FindingId;
  sev: Severity;
  /** Werte für den Satz (Zahl, Wendung, Name …). */
  args?: (string | number)[];
}

const BODY_KEYS = ['intro', 'mainBody', 'companyReference', 'motivation', 'closing'] as const;

export function bodyParagraphs(cl: CoverLetterData): string[] {
  return BODY_KEYS.map(k => (cl[k] || '').trim()).filter(Boolean);
}

/** Was die Bewerberin im Anschreiben selbst schreibt: Empfänger, Betreff,
 *  Anrede, Fließtext, Gruß — ohne den Briefkopf, der aus dem Lebenslauf kommt.
 *  Sonst zählte die Titelzeile des Lebenslaufs im Briefkopf als „Stelle im
 *  Anschreiben genannt". */
export function coverOwnText(cl: CoverLetterData): string {
  return [cl.company, cl.contactPerson, cl.companyAddress, cl.subject, cl.salutation, ...bodyParagraphs(cl), cl.signoff]
    .map(x => (x || '').trim()).filter(Boolean).join('\n');
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Firmenname ohne Rechtsform, für die Suche im Text. */
export function companyCore(name: string): string {
  return name
    .replace(/\b(GmbH\s*&\s*Co\.?\s*KG|GmbH|gGmbH|mbH|AG|SE|KGaA|KG|OHG|e\.\s?V\.|UG(?:\s*\(haftungsbeschränkt\))?|Ltd\.?|Limited|Inc\.?|LLC|plc|S\.?A\.?S?|SARL|S\.?L\.?|S\.?p\.?A\.?|Corp\.?|Co\.)(?=\s|$|,)/g, '')
    .replace(/[,\s]+$/, '')
    .trim();
}

// ── Platzhalter ──────────────────────────────────────────────────────────

const PLACEHOLDER_RES: RegExp[] = [
  /\[[^\]\n]{1,40}\]/g,
  /\{\{?[^}\n]{1,40}\}?\}/g,
  /<[A-ZÄÖÜa-zäöü ._-]{2,30}>/g,
  /\b(?:X{2,}|x{3,}|_{3,}|\.{4,})(?=\s|$|[.,])/g,
  /(?<![\p{L}])(?:Musterfirma|Muster GmbH|Musterunternehmen|Musterstadt|Musterstraße|Max Mustermann|Erika Musterfrau|Mustermann|Musterfrau|Firma XY|XY GmbH|Beispiel GmbH|Lorem ipsum|TODO|TBD|ACME|Company Name|Your Company|Hiring Manager Name|Nom de l'entreprise|Entreprise X|Société X|Empresa X|Nombre de la empresa)(?![\p{L}])/giu,
];

export function findPlaceholders(text: string): string[] {
  const out = new Set<string>();
  for (const re of PLACEHOLDER_RES) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) out.add(m[0].trim());
  }
  return [...out].slice(0, 6);
}

/** Zeile, die der Renderer setzt, wenn kein Empfänger eingetragen ist. */
export const RECIPIENT_PLACEHOLDER = 'Empfänger noch nicht eingegeben';

/** Betreffe, die nur das Muster sind („Bewerbung als "). */
function subjectIncomplete(subject: string): boolean {
  const s = subject.trim();
  if (!s) return false;
  for (const l of Object.values(DEFAULT_COVER_LETTERS)) if (fold(s) === fold(l.subject.trim())) return true;
  return /(?:\bals|\bfor|\bof|\bas|\bposition|\bau poste de|\bpuesto de|\bde|:|–|-)$/i.test(s);
}

/** Absätze, die unverändert aus dem vorbelegten Muster stammen. */
function sampleParagraphs(cl: CoverLetterData): number {
  const samples = new Set<string>();
  for (const l of Object.values(DEFAULT_COVER_LETTERS)) {
    for (const k of BODY_KEYS) if (l[k]) samples.add(fold(l[k].trim()));
  }
  return BODY_KEYS.filter(k => cl[k] && samples.has(fold(cl[k].trim()))).length;
}

// ── Datum ────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {};
[
  ['januar', 'jänner', 'january', 'janvier', 'enero', 'jan'],
  ['februar', 'feber', 'february', 'février', 'fevrier', 'febrero', 'feb'],
  ['märz', 'maerz', 'march', 'mars', 'marzo', 'mar'],
  ['april', 'avril', 'abril', 'apr'],
  ['mai', 'may', 'mayo'],
  ['juni', 'june', 'juin', 'junio', 'jun'],
  ['juli', 'july', 'juillet', 'julio', 'jul'],
  ['august', 'août', 'aout', 'agosto', 'aug'],
  ['september', 'septembre', 'septiembre', 'setiembre', 'sep', 'sept'],
  ['oktober', 'october', 'octobre', 'octubre', 'okt', 'oct'],
  ['november', 'novembre', 'noviembre', 'nov'],
  ['dezember', 'december', 'décembre', 'decembre', 'diciembre', 'dez', 'dec'],
].forEach((names, i) => names.forEach(n => { MONTHS[n] = i; }));

/** Liest gängige Datumsformen in vier Sprachen. `null`, wenn unklar. */
export function parseLetterDate(raw: string): Date | null {
  const s = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  let m = s.match(/(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  // „10. Oktober 2026", „10 octobre 2026", „10 de octubre de 2026"
  m = s.match(/(\d{1,2})\.?\s+(?:de\s+)?([a-zäöüéû]+)\.?\s+(?:de\s+)?(\d{4})/);
  if (m && MONTHS[m[2]] !== undefined) return new Date(+m[3], MONTHS[m[2]], +m[1]);
  // „October 10, 2026"
  m = s.match(/([a-zäöüéû]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m && MONTHS[m[1]] !== undefined) return new Date(+m[3], MONTHS[m[1]], +m[2]);
  return null;
}

function daysBetween(a: Date, b: Date): number {
  const d = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((d(b) - d(a)) / 86_400_000);
}

// ── Lesbarkeit ───────────────────────────────────────────────────────────

export interface CoverInput {
  cv: CVData;
  cl: CoverLetterData;
  /** Text des exportierten Anschreibens (docText.coverLetterExportText). */
  text: string;
  /** Messung der Seite; fehlt sie, entfällt der Seitenbefund. */
  measure?: PageMeasure | null;
  today?: Date;
}

/** Grenzwerte für die Länge, eigene Ableitung (siehe Kopf). */
export const LENGTH = { min: 120, max: 380, paragraph: 130 };

export function checkCoverLetter({ cv, cl, text, measure, today = new Date() }: CoverInput): Finding[] {
  const f: Finding[] = [];
  const p = cv.personal || ({} as CVData['personal']);
  const flat = text.replace(/\s+/g, ' ');
  const flatFold = fold(flat);

  // Name und Kontakt (kommen aus dem Lebenslauf derselben Fassung).
  if (!p.name?.trim()) f.push({ id: 'name-missing', sev: 'fehler' });
  if (!p.email?.trim()) f.push({ id: 'email-missing', sev: 'fehler' });
  else if (!flatFold.includes(fold(p.email.trim()))) f.push({ id: 'email-not-in-text', sev: 'fehler', args: [p.email.trim()] });
  if (!p.phone?.trim()) f.push({ id: 'phone-missing', sev: 'hinweis' });
  if (p.name?.trim() && p.email?.trim() && p.phone?.trim() && flatFold.includes(fold(p.email.trim()))) f.push({ id: 'contact-ok', sev: 'ok' });

  // Empfänger.
  if (flat.includes(RECIPIENT_PLACEHOLDER)) f.push({ id: 'recipient-placeholder', sev: 'fehler' });
  else if (!cl.company?.trim()) f.push({ id: 'recipient-missing', sev: 'fehler' });
  else {
    f.push({ id: 'recipient-ok', sev: 'ok', args: [cl.company.trim()] });
    if (!cl.companyAddress?.trim()) f.push({ id: 'address-missing', sev: 'hinweis' });
  }

  // Betreff.
  if (!cl.subject?.trim()) f.push({ id: 'subject-missing', sev: 'fehler' });
  else if (subjectIncomplete(cl.subject)) f.push({ id: 'subject-incomplete', sev: 'fehler', args: [cl.subject.trim()] });
  else f.push({ id: 'subject-ok', sev: 'ok', args: [cl.subject.trim()] });

  // Ort und Datum.
  if (cl.showDateline === false) f.push({ id: 'date-off', sev: 'ok' });
  else if (!cl.date?.trim()) f.push({ id: 'date-missing', sev: 'hinweis' });
  else {
    const d = parseLetterDate(cl.date);
    if (d) {
      const age = daysBetween(d, today);
      if (age > 14) f.push({ id: 'date-old', sev: 'hinweis', args: [cl.date.trim(), age] });
      else if (age < -1) f.push({ id: 'date-future', sev: 'hinweis', args: [cl.date.trim()] });
      else f.push({ id: 'date-ok', sev: 'ok', args: [cl.date.trim()] });
    } else f.push({ id: 'date-ok', sev: 'ok', args: [cl.date.trim()] });
  }

  // Anrede und Gruß.
  const sal = (cl.salutation || '').trim();
  if (!sal) f.push({ id: 'salutation-missing', sev: 'fehler' });
  else if (GENERIC_SALUTATIONS.some(g => fold(sal).replace(/[,:;!]+$/, '').startsWith(fold(g)))) {
    // Allgemein ist in Ordnung, wenn niemand bekannt ist (Bundesagentur).
    f.push(cl.contactPerson?.trim()
      ? { id: 'salutation-generic', sev: 'hinweis', args: [sal, cl.contactPerson.trim()] }
      : { id: 'salutation-ok', sev: 'ok', args: [sal] });
  } else f.push({ id: 'salutation-ok', sev: 'ok', args: [sal] });
  if (!cl.signoff?.trim()) f.push({ id: 'signoff-missing', sev: 'hinweis' });
  else f.push({ id: 'signoff-ok', sev: 'ok', args: [cl.signoff.trim()] });

  // Platzhalter und Mustertext.
  const ph = findPlaceholders(flat);
  if (ph.length) f.push({ id: 'placeholder', sev: 'fehler', args: [ph.join(' · ')] });
  const samples = sampleParagraphs(cl);
  if (samples) f.push({ id: 'sample-text', sev: 'fehler', args: [samples] });
  if (!ph.length && !samples && !flat.includes(RECIPIENT_PLACEHOLDER)) f.push({ id: 'no-placeholder', sev: 'ok' });

  // Länge und Absätze.
  const paras = bodyParagraphs(cl);
  const words = wordCount(paras.join(' '));
  if (words < LENGTH.min) f.push({ id: 'too-short', sev: 'hinweis', args: [words] });
  else if (words > LENGTH.max) f.push({ id: 'too-long', sev: 'hinweis', args: [words] });
  else f.push({ id: 'length-ok', sev: 'ok', args: [words] });
  const longest = Math.max(0, ...paras.map(wordCount));
  if (paras.length === 1 && words > 90) f.push({ id: 'one-paragraph', sev: 'hinweis' });
  else if (longest > LENGTH.paragraph) f.push({ id: 'long-paragraph', sev: 'hinweis', args: [longest] });
  else if (paras.length) f.push({ id: 'paragraphs-ok', sev: 'ok', args: [paras.length] });

  // Bezug zur Firma: Name im Fließtext? (Harvard: auf die Stelle zuschneiden.)
  const core = companyCore(cl.company || '');
  if (core.length >= 3 && paras.length && !fold(paras.join(' ')).includes(fold(core))) {
    f.push({ id: 'company-not-in-body', sev: 'hinweis', args: [core] });
  }

  // Eine Seite.
  if (measure) f.push(measure.fits ? { id: 'fits-page', sev: 'ok' } : { id: 'overflow', sev: 'fehler', args: [measure.overMm] });

  return sortFindings(f);
}

export function sortFindings(f: Finding[]): Finding[] {
  const rank: Record<Severity, number> = { fehler: 0, hinweis: 1, ok: 2 };
  return [...f].sort((a, b) => rank[a.sev] - rank[b.sev]);
}

// ── Stellenanzeige ───────────────────────────────────────────────────────

export interface JobAdFacts { title: string; company: string; contact: string }

const LEGAL = String.raw`(?:GmbH(?:\s*&\s*Co\.?\s*KG)?|gGmbH|AG|SE|KGaA|KG|OHG|e\.\s?V\.|UG|Ltd\.?|Limited|Inc\.?|LLC|plc|SAS|SARL|S\.A\.|S\.L\.|S\.p\.A\.)`;

/** Stellentitel, Firma und Ansprechperson aus einer Anzeige, so gut es geht. */
export function analyzeJobAd(jd: string): JobAdFacts {
  const lines = jd.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  // Titel: eine Zeile mit Geschlechtsangabe, sonst die erste kurze Zeile.
  const gender = /\((?:m|w|d|f|x|div|i)(?:\s*[/|,]\s*(?:m|w|d|f|x|div|i)){1,3}\)|\(all genders\)|\(alle Geschlechter\)|\(H\/F\)|\(F\/H\)|\(h\/m\)/i;
  let title = '';
  const gLine = lines.find(l => gender.test(l) && l.length < 140);
  if (gLine) {
    title = gLine.replace(gender, '')
      .replace(/^(?:wir suchen|wir stellen ein|we are hiring|we're hiring|we are looking for|nous recrutons|buscamos|stellenangebot|job)\s*[:-]?\s*/i, '')
      .replace(/^(?:ab sofort|zum nächstmöglichen zeitpunkt|befristet|unbefristet)\s+/i, '')
      .replace(/^(?:eine[nr]?|ein|an?|un[e]?|une?)\s+/i, '')
      .replace(/\s+[|·–]\s.*$|\s+-\s.*$|\s*\|.*$/, '').trim();
  } else {
    const first = lines.find(l => l.length >= 4 && l.length <= 80 && !/[.:!?]$/.test(l));
    if (first) title = first;
  }
  // Firma: Name vor einer Rechtsform.
  let company = '';
  // Wortlängen begrenzt, Eingabe gekürzt: sonst quadratische Laufzeit bei
  // sehr langen Wörtern (Audit 10.10.2026, S7).
  const re = new RegExp(String.raw`((?:(?:[A-ZÄÖÜ0-9][\p{L}0-9&.'-]{0,60}|&)\s+){0,4}[A-ZÄÖÜ0-9][\p{L}0-9&.'-]{0,60})\s+${LEGAL}(?=[\s,.;:)]|$)`, 'u');
  const cm = jd.slice(0, 30000).match(re);
  if (cm) company = cm[0].replace(/^(?:Die|Der|Das|The|La|Le|El|Bei|At|Chez)\s+/, '').trim();
  // Ansprechperson mit Anrede.
  let contact = '';
  const pm = jd.match(/(?:Ansprechpartner(?:in)?|Ansprechperson|Kontakt|Contact(?: person)?|Interlocuteur|Contacto)\s*[:-]?\s*((?:Frau|Herr|Ms\.?|Mrs\.?|Mr\.?|Mme|M\.|Sra\.?|Sr\.?)\s+(?:Dr\.\s+)?[A-ZÄÖÜ][\p{L}-]+(?:\s+[A-ZÄÖÜ][\p{L}-]+)?)/u)
    || jd.match(/\b((?:Frau|Herr)\s+(?:Dr\.\s+)?[A-ZÄÖÜ][\p{L}-]+(?:\s+[A-ZÄÖÜ][\p{L}-]+)?)/u);
  if (pm) contact = pm[1].trim();
  return { title, company, contact };
}

/** Kommt ein Titel im Text vor? Ganz oder mit seinen Wörtern ab vier Zeichen. */
function titleIn(textFold: string, title: string): boolean {
  const t = fold(title).replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (textFold.includes(t)) return true;
  const words = t.split(/[^a-z0-9+#]+/).filter(w => w.length >= 4);
  return words.length > 0 && words.every(w => textFold.includes(w));
}

export function checkAgainstJobAd(cl: CoverLetterData, facts: JobAdFacts, jd: string): Finding[] {
  const f: Finding[] = [];
  const tf = fold(coverOwnText(cl).replace(/\s+/g, ' '));
  if (!facts.title.trim()) f.push({ id: 'job-title-unknown', sev: 'hinweis' });
  else if (titleIn(tf, facts.title)) f.push({ id: 'job-title-ok', sev: 'ok', args: [facts.title] });
  else f.push({ id: 'job-title-missing', sev: 'fehler', args: [facts.title] });

  const core = companyCore(facts.company);
  if (!core) f.push({ id: 'job-company-unknown', sev: 'hinweis' });
  else if (tf.includes(fold(core))) f.push({ id: 'job-company-ok', sev: 'ok', args: [core] });
  else f.push({ id: 'job-company-missing', sev: 'fehler', args: [core] });

  // Empfänger, der in der Anzeige nicht vorkommt: oft ein altes Anschreiben.
  const rec = companyCore(cl.company || '');
  if (rec.length >= 3 && jd.trim().length >= 60 && !fold(jd).includes(fold(rec))) {
    f.push({ id: 'job-recipient-mismatch', sev: 'hinweis', args: [rec] });
  }
  // Ansprechperson in der Anzeige, Anrede aber allgemein.
  const sal = fold((cl.salutation || '').trim());
  if (facts.contact && GENERIC_SALUTATIONS.some(g => sal.startsWith(fold(g)))) {
    f.push({ id: 'job-contact-generic', sev: 'hinweis', args: [facts.contact] });
  }
  return sortFindings(f);
}

export interface TermRow { term: string; inJd: number; cv: boolean; cl: boolean }

/** Begriffe der Anzeige gegen einen oder zwei Texte. */
export function termRows(jd: string, cvText: string | null, clText: string | null): TermRow[] {
  const hc = cvText != null ? haystack(cvText) : null;
  const hl = clText != null ? haystack(clText) : null;
  return jobTerms(jd).map(t => ({
    term: t.term, inJd: t.inJd,
    cv: hc ? contains(hc, t.term) : false,
    cl: hl ? contains(hl, t.term) : false,
  }));
}

// ── Beide Unterlagen ─────────────────────────────────────────────────────

const digits = (s: string) => s.replace(/\D+/g, '');

export function checkBoth({ cv, cl, cvText, clText }: { cv: CVData; cl: CoverLetterData; cvText: string; clText: string }): Finding[] {
  const f: Finding[] = [];
  const p = cv.personal || ({} as CVData['personal']);
  const cvF = fold(cvText.replace(/\s+/g, ' '));
  const clF = fold(clText.replace(/\s+/g, ' '));

  const name = (p.name || '').trim();
  if (!name) f.push({ id: 'both-name', sev: 'fehler', args: [''] });
  else {
    const inCv = cvF.includes(fold(name));
    const inCl = clF.includes(fold(name));
    f.push(inCv && inCl ? { id: 'both-name-ok', sev: 'ok', args: [name] } : { id: 'both-name', sev: 'fehler', args: [name] });
  }
  const mail = (p.email || '').trim();
  if (mail) {
    const ok = cvF.includes(fold(mail)) && clF.includes(fold(mail));
    f.push(ok ? { id: 'both-email-ok', sev: 'ok', args: [mail] } : { id: 'both-email', sev: 'fehler', args: [mail] });
  }
  const tel = digits(p.phone || '');
  if (tel.length >= 6) {
    const ok = digits(cvText).includes(tel) && digits(clText).includes(tel);
    if (!ok) f.push({ id: 'both-phone', sev: 'hinweis', args: [p.phone!.trim()] });
  }
  // Sprache: Lebenslauf und Anschreiben sollten dieselbe sein.
  const lcv = guessLang(cvText);
  const lcl = guessLang(bodyParagraphs(cl).join(' ') || clText);
  if (lcv && lcl && lcv !== lcl) f.push({ id: 'both-lang', sev: 'hinweis', args: [lcv, lcl] });
  else if (lcv && lcl) f.push({ id: 'both-lang-ok', sev: 'ok', args: [lcv] });
  // Berufsbezeichnung im Lebenslauf und Stelle im Betreff: nur ein Hinweis,
  // wenn die Titelzeile des Lebenslaufs im Anschreiben gar nicht vorkommt.
  const title = (p.title || '').trim();
  if (title.length >= 4 && cl.subject?.trim() && !titleIn(clF, title)) {
    f.push({ id: 'both-title', sev: 'hinweis', args: [title] });
  }
  return sortFindings(f);
}

/** Sprache des Dokuments aus den Daten. */
export function docLang(cv: CVData): Lang {
  return (cv.labels?.lang ?? 'de') as Lang;
}
