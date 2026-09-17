/**
 * LinkedIn-Datenexport einlesen.
 *
 * Der Weg für den Nutzer: LinkedIn → Einstellungen → Datenschutz → „Eine Kopie
 * deiner Daten erhalten" → ZIP herunterladen → hier hochladen. Kein Scraping,
 * keine API, kein fremder Dienst: Die Datei bleibt im Browser, geparst wird
 * lokal.
 *
 * ── Warum das neu geschrieben ist ───────────────────────────────────────────
 * Eine erste Fassung lag seit Monaten im Verzeichnis und wurde **von nirgends
 * aufgerufen** — gebaut, nie verdrahtet, nie ausgeführt. Beim ersten echten
 * Durchlauf fielen vier Dinge auf, die alle daran lagen, dass nie eine Datei
 * durchlief:
 *
 *   1. Der CSV-Leser trennte zuerst an `\n` und dann an `,`. Jede
 *      Stellenbeschreibung mit Zeilenumbruch — also fast jede — zerlegte damit
 *      die Tabelle. Ein CSV muss zeichenweise gelesen werden, weil ein
 *      Umbruch **innerhalb** von Anführungszeichen zum Feld gehört.
 *   2. Die Datumsangaben kommen als „Aug 2018", nicht als „2018-08". Die
 *      Umrechnung kannte nur die ISO-Form und reichte den Rest unverändert
 *      durch — im Lebenslauf stand dann „Aug 2018" neben „12/2023".
 *   3. Der ZIP-Leser war von Hand gebaut, mit dem Kommentar „no jszip needed" —
 *      obwohl jszip im Projekt liegt. Er ging von unkomprimierten Größen im
 *      lokalen Kopf aus; bei ZIPs mit Datendeskriptor steht dort 0, und die
 *      Schleife lief ins Leere.
 *   4. Er setzte `labels` hart auf Deutsch. Wer seinen englischen Lebenslauf
 *      importierte, bekam „Berufserfahrung" über seine Stationen.
 *
 * ── Warum tolerant statt streng ─────────────────────────────────────────────
 * LinkedIn dokumentiert das Format nicht, und der Inhalt des Archivs hängt vom
 * Konto ab — Dateinamen und Spalten unterscheiden sich zwischen Exporten.
 * Deshalb wird hier nichts auf eine Schreibweise festgenagelt: Dateinamen und
 * Spaltenköpfe werden normalisiert (klein, ohne Sonderzeichen) und über eine
 * Liste von Alias-Namen gesucht. Was nicht gefunden wird, wird **benannt** —
 * und der Import ersetzt nie etwas, ohne dass der Mensch die Gegenüberstellung
 * gesehen hat.
 */

import JSZip from 'jszip';
import type {
  CVData, ExperienceEntry, EducationEntry, SkillGroup, LanguageEntry, Lang,
} from '../data/types';

// ── CSV ─────────────────────────────────────────────────────────────────────

/**
 * Zeichenweiser CSV-Leser (RFC 4180).
 *
 * Zeilenumbrüche und Kommas innerhalb von Anführungszeichen gehören zum Feld.
 * Genau daran scheiterte die erste Fassung: LinkedIn schreibt mehrzeilige
 * Stellenbeschreibungen in ein einziges Feld.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let feld = '';
  let zeile: string[] = [];
  let inQuotes = false;

  // BOM entfernen — LinkedIn liefert UTF-8 mit Vorzeichen.
  const t = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { feld += '"'; i++; } else { inQuotes = false; }
      } else {
        feld += c;
      }
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { zeile.push(feld); feld = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { zeile.push(feld); rows.push(zeile); zeile = []; feld = ''; continue; }
    feld += c;
  }
  if (feld.length > 0 || zeile.length > 0) { zeile.push(feld); rows.push(zeile); }

  if (rows.length < 2) return [];
  const kopf = rows[0].map(normKey);
  return rows.slice(1)
    .filter(r => r.some(v => v.trim() !== ''))
    .map(r => {
      const o: Record<string, string> = {};
      kopf.forEach((h, i) => { o[h] = (r[i] ?? '').trim(); });
      return o;
    });
}

/** Spaltenkopf auf einen vergleichbaren Schlüssel bringen: „Company Name" → „companyname". */
const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Erster Treffer aus einer Liste möglicher Spaltennamen. */
function feld(row: Record<string, string>, ...namen: string[]): string {
  for (const n of namen) {
    const v = row[normKey(n)];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

// ── Datum ───────────────────────────────────────────────────────────────────

const MONATE: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', mär: '03', apr: '04', may: '05', mai: '05',
  jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', okt: '10',
  nov: '11', dec: '12', dez: '12',
};

/**
 * LinkedIn-Datum → „MM/JJJJ".
 *
 * Im Archiv steht je nach Feld und Kontoland „Aug 2018", „August 2018",
 * „2018-08-01", „2018-08" oder nur „2018". Alles davon muss hier ankommen;
 * was sich nicht deuten lässt, bleibt unverändert stehen, statt verfälscht zu
 * werden — ein sichtbar fremdes Datum ist besser als ein falsches.
 */
export function normalizeDate(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (iso) return `${iso[2].padStart(2, '0')}/${iso[1]}`;
  const wort = s.match(/^([A-Za-zÄÖÜäöü]{3,})\.?\s+(\d{4})$/);
  if (wort) {
    const m = MONATE[wort[1].slice(0, 3).toLowerCase()];
    if (m) return `${m}/${wort[2]}`;
  }
  if (/^\d{4}$/.test(s)) return s;
  const mmjjjj = s.match(/^(\d{1,2})[./](\d{4})$/);
  if (mmjjjj) return `${mmjjjj[1].padStart(2, '0')}/${mmjjjj[2]}`;
  return s;
}

const LAEUFT: Record<Lang, string> = { de: 'heute', en: 'today', fr: "aujourd'hui", es: 'hoy' };
const istLaufend = (s: string) => /^(present|current|heute|aujourd'hui|hoy|ongoing)$/i.test((s || '').trim());

// ── Aufzählungspunkte ───────────────────────────────────────────────────────

/**
 * Beschreibungstext in Stichpunkte zerlegen.
 *
 * LinkedIn speichert die Beschreibung als Fließtext, oft mit eigenen
 * Aufzählungszeichen. Getrennt wird an Zeilenumbrüchen und an führenden
 * Listenzeichen — nicht an Satzzeichen: Ein Punkt mitten im Satz ist kein
 * neuer Stichpunkt, und aus einem Absatz drei Halbsätze zu machen wäre
 * schlimmer als ein langer Stichpunkt, den der Mensch selbst teilt.
 */
export function splitBullets(beschreibung: string): string[] {
  if (!beschreibung) return [];
  return beschreibung
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(z => z.replace(/^\s*(?:[-–—•▪*·]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

// ── Sprachniveau → Punkteskala ──────────────────────────────────────────────

/** LinkedIn nennt Stufen im Klartext; die Vorlagen zeigen eine Skala von 5. */
function dotsFuer(stufe: string): number {
  const s = (stufe || '').toLowerCase();
  if (/native|bilingual|mutterspr/.test(s)) return 5;
  if (/full professional|verhandlungssicher|fließend|fliessend/.test(s)) return 4;
  if (/professional working|gute kenntnisse|advanced/.test(s)) return 3;
  if (/limited working|grundkenntnisse|basic/.test(s)) return 2;
  if (/elementary|anfänger/.test(s)) return 1;
  return 0;
}

// ── Archiv lesen ────────────────────────────────────────────────────────────

/** Alle CSV-Dateien aus dem Archiv, unter normalisiertem Basisnamen. */
async function csvsAusZip(file: File): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const out: Record<string, string> = {};
  const dateien = Object.values(zip.files).filter(f => !f.dir && /\.csv$/i.test(f.name));
  for (const f of dateien) {
    const basis = (f.name.split('/').pop() || f.name).replace(/\.csv$/i, '');
    out[normKey(basis)] = await f.async('string');
  }
  return out;
}

/** Erste Datei, deren normalisierter Name einen der Begriffe enthält. */
function datei(map: Record<string, string>, ...begriffe: string[]): string | null {
  for (const b of begriffe) {
    const k = normKey(b);
    if (map[k] !== undefined) return map[k];
  }
  for (const b of begriffe) {
    const k = normKey(b);
    const treffer = Object.keys(map).find(name => name.includes(k));
    if (treffer) return map[treffer];
  }
  return null;
}

// ── Ergebnis ────────────────────────────────────────────────────────────────

export interface LinkedInBefund {
  /** Der fertige Lebenslauf: die aktuellen Daten, überschrieben mit dem, was
   *  im Archiv stand. Felder, die LinkedIn nicht kennt (Foto, Profiltext,
   *  Anschreiben), bleiben unangetastet. */
  cv: CVData;
  /** Was gefunden wurde — für die Gegenüberstellung vor dem Übernehmen. */
  gefunden: { stationen: number; ausbildung: number; skills: number; sprachen: number };
  /** Was nicht gefunden wurde. Wird dem Nutzer gezeigt, nicht verschluckt. */
  hinweise: string[];
}

/**
 * Archiv einlesen und auf den bestehenden Lebenslauf legen.
 *
 * `basis` ist der aktuelle Lebenslauf: Sprache, Beschriftungen, Foto und
 * Profiltext kommen von dort, alles andere aus dem Archiv. Der Aufrufer
 * entscheidet, ob er das Ergebnis übernimmt — diese Funktion schreibt nichts.
 */
export async function importLinkedIn(file: File, basis: CVData): Promise<LinkedInBefund> {
  const hinweise: string[] = [];
  const name = file.name.toLowerCase();

  let csvs: Record<string, string>;
  if (name.endsWith('.zip')) {
    csvs = await csvsAusZip(file);
    if (Object.keys(csvs).length === 0) {
      throw new Error('In diesem Archiv liegt keine einzige CSV-Datei. Es sieht nicht nach einem LinkedIn-Datenexport aus.');
    }
  } else if (name.endsWith('.csv')) {
    csvs = { [normKey(file.name.replace(/\.csv$/i, ''))]: await file.text() };
  } else {
    throw new Error('Bitte das ZIP aus dem LinkedIn-Datenexport hochladen (oder eine einzelne CSV daraus).');
  }

  const rows = (...begriffe: string[]) => {
    const t = datei(csvs, ...begriffe);
    return t ? parseCSV(t) : [];
  };

  const lang = (basis.labels?.lang ?? 'de') as Lang;
  const laufend = LAEUFT[lang] ?? LAEUFT.de;

  // ── Person ────────────────────────────────────────────────────────────────
  const profil = rows('Profile')[0] ?? {};
  const mails = rows('Email Addresses', 'Emails');
  const telefone = rows('PhoneNumbers', 'Phone Numbers');

  const vorname = feld(profil, 'First Name', 'Vorname');
  const nachname = feld(profil, 'Last Name', 'Nachname');
  const personName = [vorname, nachname].filter(Boolean).join(' ');

  /* Bevorzugt die als primär markierte Adresse — ein Archiv enthält oft die
   * alte Uni-Adresse gleich mit. */
  const primaer = mails.find(m => /^(yes|ja|true)$/i.test(feld(m, 'Primary'))) ?? mails[0];
  const mail = primaer ? feld(primaer, 'Email Address', 'Email') : '';
  const telefon = telefone[0] ? feld(telefone[0], 'Number', 'Phone Number') : '';

  // ── Stationen ─────────────────────────────────────────────────────────────
  const positionen = rows('Positions', 'Position');
  const experience: ExperienceEntry[] = positionen
    .filter(r => feld(r, 'Company Name', 'Company') || feld(r, 'Title', 'Position'))
    .map((r, i) => {
      const bis = feld(r, 'Finished On', 'End Date', 'Finished');
      return {
        id: `li-exp-${i}`,
        role: feld(r, 'Title', 'Position'),
        company: feld(r, 'Company Name', 'Company'),
        location: feld(r, 'Location'),
        start: normalizeDate(feld(r, 'Started On', 'Start Date', 'Started')),
        end: !bis || istLaufend(bis) ? laufend : normalizeDate(bis),
        bullets: splitBullets(feld(r, 'Description')),
      };
    });

  // ── Ausbildung ────────────────────────────────────────────────────────────
  const schulen = rows('Education');
  const education: EducationEntry[] = schulen
    .filter(r => feld(r, 'School Name', 'School') || feld(r, 'Degree Name', 'Degree'))
    .map((r, i) => ({
      id: `li-edu-${i}`,
      degree: [feld(r, 'Degree Name', 'Degree'), feld(r, 'Field Of Study', 'Field')].filter(Boolean).join(', ')
        || feld(r, 'School Name', 'School'),
      institution: feld(r, 'School Name', 'School'),
      location: '',
      start: normalizeDate(feld(r, 'Start Date', 'Started On')),
      end: normalizeDate(feld(r, 'End Date', 'Finished On')),
      notes: feld(r, 'Notes', 'Activities', 'Description') || undefined,
    }));

  // ── Skills ────────────────────────────────────────────────────────────────
  const skillZeilen = rows('Skills');
  const skillItems = skillZeilen.map(r => feld(r, 'Name', 'Skill')).filter(Boolean);
  const vorhandeneGruppe = basis.skillGroups?.[0];
  const skillGroups: SkillGroup[] = skillItems.length
    ? [{ label: vorhandeneGruppe?.label || 'Skills', items: skillItems }]
    : (basis.skillGroups ?? []);

  // ── Sprachen ──────────────────────────────────────────────────────────────
  const sprachZeilen = rows('Languages');
  const languages: LanguageEntry[] = sprachZeilen
    .map(r => ({ name: feld(r, 'Name', 'Language'), stufe: feld(r, 'Proficiency', 'Level') }))
    .filter(x => x.name)
    .map(x => ({ language: x.name, level: x.stufe, dots: dotsFuer(x.stufe) }));

  // ── Was fehlt, wird gesagt ────────────────────────────────────────────────
  if (!positionen.length) hinweise.push('Keine Berufserfahrung im Archiv gefunden (Positions.csv fehlt oder ist leer).');
  if (!schulen.length) hinweise.push('Keine Ausbildung im Archiv gefunden (Education.csv fehlt oder ist leer).');
  if (!personName) hinweise.push('Kein Name im Archiv gefunden (Profile.csv fehlt oder ist leer).');
  if (!mail) hinweise.push('Keine E-Mail-Adresse im Archiv — die trägst du selbst nach.');
  hinweise.push('LinkedIn liefert kein Bewerbungsfoto und keinen Profiltext für den Lebenslauf. Beides bleibt, wie es war.');

  const cv: CVData = {
    ...basis,
    personal: {
      ...basis.personal,
      name: personName || basis.personal.name,
      title: feld(profil, 'Headline') || basis.personal.title,
      location: feld(profil, 'Geo Location', 'Location') || basis.personal.location,
      email: mail || basis.personal.email,
      phone: telefon || basis.personal.phone,
    },
    experience: experience.length ? experience : basis.experience,
    education: education.length ? education : basis.education,
    skillGroups,
    languages: languages.length ? languages : basis.languages,
  };

  return {
    cv,
    gefunden: {
      stationen: experience.length,
      ausbildung: education.length,
      skills: skillItems.length,
      sprachen: languages.length,
    },
    hinweise,
  };
}
