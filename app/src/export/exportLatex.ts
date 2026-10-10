/**
 * Lebenslauf als LaTeX-Quelltext (.tex).
 *
 * Entscheidung vom 10.10.2026 (Frage: „Wollen wir Export und Import von Latex
 * anbieten?"): Export ja, Import nur für unsere eigenen Dateien.
 *
 * Export: Eine eigene, gut lesbare Vorlage auf der Standardklasse `article`
 * mit vier verbreiteten Paketen (geometry, xcolor, enumitem, hyperref), die
 * in jeder TeX-Live- und MiKTeX-Installation und auf Overleaf vorhanden sind.
 * Übersetzbar mit pdfLaTeX, XeLaTeX und LuaLaTeX (scripts/latexcheck.mjs
 * prüft pdfLaTeX und XeLaTeX). Bewusst KEINE Nachbildung von moderncv oder
 * Awesome CV: deren Klassen bringen eigene Schriften und Abhängigkeiten mit,
 * die auf einem frischen System oft fehlen — eine .tex-Datei, die beim
 * Empfänger nicht übersetzt, ist schlechter als keine.
 *
 * Import: Beliebiges LaTeX zuverlässig zurückzulesen ist nicht machbar — ein
 * Lebenslauf in LaTeX ist ein Programm, kein Datenformat. Deshalb trägt jede
 * exportierte Datei hinter `\end{document}` einen Kommentarblock mit den
 * Daten (JSON, Base64). Den liest `import/latexImport.ts`, und nur den.
 * Wer eine fremde .tex-Datei mitbringt, bekommt eine klare Absage statt
 * eines halb erkannten Lebenslaufs.
 *
 * Sicherheit: Jeder Text aus den Daten geht durch `tex()`. Danach steht im
 * Dokument kein einziger Gegenschrägstrich, keine Klammer und kein
 * Sonderzeichen aus Nutzerdaten mehr roh — `\input`, `\write18`,
 * `\catcode`, `^^5c` und `\end{document}` werden als Text gesetzt, nicht
 * ausgeführt. Links laufen durch `texUrl()` (nur http, https, mailto, tel;
 * Sonderzeichen prozentkodiert). scripts/latexcheck.mjs prüft das mit
 * Angriffs-Testdaten und übersetzt ohne Shell-Escape.
 */
import type { CVData, Lang, SectionKey } from '../data/types';
import { DEFAULT_SECTION_ORDER } from '../data/types';
import {
  completeOrder, projectsOf, certificatesOf, volunteeringOf, publicationsOf,
  customSectionsOf, customItemsOf, customEntriesOf, bulletsOf, dateRange, shortLink, linkHref, sectionHeading,
} from '../data/extraSections';
import { getTheme, skillsHeading } from '../templates/theme';
import { listSocials, socialDisplay, socialHref } from '../templates/ResumeRenderer';
import { getPageFormat } from '../data/pageFormats';
import type { ExportRenderConfig } from './exportHtml';
import { exportFilename } from './filename';
import { saveText } from './saveFile';
import { LATEX_DATA_BEGIN, LATEX_DATA_END } from '../import/latexImport';

// ── Zeichen ──────────────────────────────────────────────────────────────────

/** Zeichen, die pdfLaTeX mit `utf8` und `T1` ohne Weiteres setzt (geprüft
 *  mit scripts/latexcheck.mjs). Alles andere bekommt im pdfLaTeX-Zweig eine
 *  Ersatzdefinition (`?`); XeLaTeX und LuaLaTeX setzen es unverändert. */
function pdftexSafe(cp: number): boolean {
  if (cp >= 0x20 && cp <= 0x7e) return true;
  if (cp >= 0xa0 && cp <= 0x17f) return cp !== 0xad;
  return [0x2013, 0x2014, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2020, 0x2021, 0x2022, 0x2026, 0x2030, 0x2039, 0x203a, 0x20ac, 0x2122].includes(cp);
}

const TEX_MAP: Record<string, string> = {
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '%': '\\%', '_': '\\_',
  '^': '\\textasciicircum{}', '~': '\\textasciitilde{}', '<': '\\textless{}', '>': '\\textgreater{}', '|': '\\textbar{}',
  '"': '\\textquotedbl{}', '`': '\\textasciigrave{}',
  /* Eckige Klammern in geschweiften: `\item[…]` und `\\[…]` würden eine
   * Klammer am Zeilenanfang sonst als Option lesen. */
  '[': '{[}', ']': '{]}',
};

/**
 * Text aus den Daten als LaTeX-Text. Mehrzeiliges wird mit `\newline`
 * getrennt (Leerzeilen als neuer Absatz), Steuerzeichen fallen weg.
 * `extra` sammelt Zeichen, die pdfLaTeX nicht kennt (siehe `pdftexSafe`).
 */
export function tex(input: unknown, extra?: Set<number>): string {
  const s = typeof input === 'string' ? input : input == null ? '' : String(input);
  let out = '';
  for (const ch of s.replace(/\r\n?/g, '\n')) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\n') { out += '\n'; continue; }
    if (ch === '\t') { out += ' '; continue; }
    if (cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp < 0xa0)) continue;
    if (cp === 0xad || cp === 0x200b || cp === 0xfeff) continue; // weiche Trennung, Nullbreite
    const m = TEX_MAP[ch];
    if (m) { out += m; continue; }
    if (!pdftexSafe(cp)) extra?.add(cp);
    out += ch;
  }
  /* Ligaturen der T1-Schriften, die aus gewöhnlichem Text etwas anderes
   * machten: „--" würde ein Gedankenstrich, „,," ein Anführungszeichen,
   * „''" ein schließendes. Ein leeres Paar Klammern unterbricht sie. */
  out = out.replace(/-(?=-)/g, '-{}').replace(/,(?=,)/g, ',{}').replace(/'(?=')/g, "'{}");
  /* Zeilenwechsel: eine Leerzeile wird ein Absatz, ein einzelner Wechsel
   * ein `\newline`. Leerzeichen am Rand der Zeilen fallen weg. */
  return out.split(/\n{2,}/).map(par => par.split('\n').map(l => l.trim()).filter(Boolean).join('\\newline ')).filter(Boolean).join('\n\n');
}

/** Ein Verweisziel für `\href`. Nur http(s), mailto und tel; alles außer
 *  unbedenklichen Zeichen wird prozentkodiert, `%` und `#` werden für
 *  LaTeX geschützt. Unbekannte Schemata ergeben einen leeren Verweis. */
export function texUrl(url: string): string {
  const t = (url || '').trim();
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(t)) return '';
  let out = '';
  for (const ch of t) {
    if (/[A-Za-z0-9\-._:/?=&+@,;!*()]/.test(ch)) out += ch;
    else if (ch === '%') out += '%';
    else out += encodeURIComponent(ch);
  }
  return out.replace(/%/g, '\\%');
}

function href(url: string, text: string): string {
  const u = texUrl(url);
  return u ? `\\href{${u}}{${text}}` : text;
}

/** Theme-Farbe als sechsstelliges Hex für `\definecolor` — über die
 *  Leinwand, weil die Vorlagen teils in OKLCH notiert sind. */
function hexOf(color: string, fallback: string): string {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const hex = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    return /^[0-9A-F]{6}$/.test(hex) ? hex : fallback;
  } catch { return fallback; }
}

// ── Daten für den Wiederimport ───────────────────────────────────────────────

// Die Marken stehen beim Leser (import/latexImport.ts), damit Schreiben und
// Lesen nie auseinanderlaufen.

/** UTF-8-sicheres Base64 (btoa kennt nur Latin-1). */
function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** Datenblock: der Lebenslauf ohne Foto als JSON, Base64 in Zeilen zu 76
 *  Zeichen, jede Zeile ein LaTeX-Kommentar. Base64 enthält weder Zeilen-
 *  wechsel noch Zeichen, die einen Kommentar beenden könnten. */
function dataBlock(cv: CVData): string {
  const { photo: _p, photoOriginal: _o, ...personal } = cv.personal;
  void _p; void _o;
  const json = JSON.stringify({ format: 'cv-latex', version: 1, cv: { ...cv, personal } });
  const enc = b64(json);
  const lines: string[] = [];
  for (let i = 0; i < enc.length; i += 76) lines.push(`% ${enc.slice(i, i + 76)}`);
  return [LATEX_DATA_BEGIN, ...lines, LATEX_DATA_END].join('\n');
}

// ── Dokument ─────────────────────────────────────────────────────────────────

const PAPER: Record<string, string> = { a4: 'a4paper', letter: 'letterpaper', legal: 'legalpaper', a5: 'a5paper' };

const HEAD_COMMENT: Record<Lang, string[]> = {
  de: [
    'Übersetzen: pdflatex lebenslauf.tex  (oder xelatex / lualatex, auch auf Overleaf)',
    'Pakete: geometry, xcolor, enumitem, hyperref — in jeder TeX-Distribution enthalten.',
    'Die Bausteine \\cvsection, \\cvhead, \\cvsub und \\cvline stehen unten in der Präambel.',
    'Foto: graphicx laden und \\includegraphics[width=30mm]{foto.jpg} in den Kopf setzen.',
  ],
  en: [
    'Compile: pdflatex cv.tex  (or xelatex / lualatex, also on Overleaf)',
    'Packages: geometry, xcolor, enumitem, hyperref — part of every TeX distribution.',
    'The building blocks \\cvsection, \\cvhead, \\cvsub and \\cvline are defined in the preamble.',
    'Photo: load graphicx and put \\includegraphics[width=30mm]{photo.jpg} into the header.',
  ],
  fr: [
    'Compiler : pdflatex cv.tex  (ou xelatex / lualatex, aussi sur Overleaf)',
    'Paquets : geometry, xcolor, enumitem, hyperref — inclus dans toute distribution TeX.',
    'Les commandes \\cvsection, \\cvhead, \\cvsub et \\cvline sont définies dans le préambule.',
    'Photo : charger graphicx et placer \\includegraphics[width=30mm]{photo.jpg} dans l’en-tête.',
  ],
  es: [
    'Compilar: pdflatex cv.tex  (o xelatex / lualatex, también en Overleaf)',
    'Paquetes: geometry, xcolor, enumitem, hyperref — incluidos en toda distribución TeX.',
    'Los bloques \\cvsection, \\cvhead, \\cvsub y \\cvline se definen en el preámbulo.',
    'Foto: cargar graphicx y poner \\includegraphics[width=30mm]{foto.jpg} en la cabecera.',
  ],
};

/** Baut den LaTeX-Quelltext. Rein (ohne Download), damit die Prüfung ihn
 *  übersetzen kann. */
export function buildLatex(cv: CVData, cfg: Partial<ExportRenderConfig> = {}): string {
  const lang = (cv.labels?.lang ?? 'de') as Lang;
  const L = cv.labels;
  const sec = L.sections;
  const extra = new Set<number>();
  const t = (v: unknown) => tex(v, extra);
  /** Einzeilige Angaben (Name, Titel, Firma, Datum): Zeilenwechsel werden
   *  Leerzeichen, damit kein Absatz in einem Makroargument entsteht. */
  // Auch \r und Unicode-Zeilentrenner: sonst endet der Kopfkommentar früh (Audit S8).
  const t1 = (v: unknown) => tex(typeof v === 'string' ? v.replace(/\s*[\r\n\u2028\u2029]+\s*/g, ' ') : v, extra);
  const theme = getTheme(cfg.themeId || 'espoo', cfg.accentId, cfg.paperId);
  const accent = hexOf(theme.colors.accent, '1F4B8F');
  const soft = hexOf(theme.colors.inkSoft, '5F6670');
  const paper = PAPER[getPageFormat(cfg.pageFormat).id] ?? 'a4paper';
  const hidden = new Set<SectionKey>(cfg.hiddenSections ?? []);
  const p = cv.personal;
  const present = L.misc.present;
  const body: string[] = [];

  // Kopf: Name, Titel, Kontakt in einer Zeile.
  const contact: string[] = [];
  if (p.email?.trim()) contact.push(href(`mailto:${p.email.trim()}`, t1(p.email.trim())));
  if (p.phone?.trim()) contact.push(href(`tel:${p.phone.replace(/[^+\d]/g, '')}`, t1(p.phone.trim())));
  if (p.location?.trim()) contact.push(t1(p.location.replace(/\s*\n+\s*/g, ', ')));
  if (p.website?.trim()) contact.push(href(linkHref(p.website), t1(shortLink(p.website))));
  for (const s of listSocials(p)) if (s.value.trim()) contact.push(href(socialHref(s), t1(socialDisplay(s))));
  body.push('\\begin{center}');
  body.push(`  {\\Huge\\bfseries ${t1(p.name) || 'CV'}\\par}`);
  if (p.title?.trim()) body.push(`  \\vspace{3pt}{\\large\\color{cvaccent}${t1(p.title)}\\par}`);
  if (contact.length) body.push(`  \\vspace{6pt}{\\small ${contact.join(' \\enspace\\textperiodcentered\\enspace ')}\\par}`);
  body.push('\\end{center}');

  const head = (title: string, date: string) => body.push(`\\cvhead{${title}}{${date}}`);
  const sub = (a: string, b: string) => { if (a || b) body.push(`\\cvsub{${a}}{${b}}`); };
  const items = (list: string[]) => {
    const xs = list.map(x => t(x)).filter(Boolean);
    if (!xs.length) return;
    body.push('\\begin{itemize}');
    for (const x of xs) body.push(`  \\item ${x}`);
    body.push('\\end{itemize}');
  };
  const para = (s?: string) => { const v = t(s); if (v) body.push(`${v}\\par`); };
  const link = (u?: string) => { if (u?.trim()) body.push(`{\\small\\color{cvsoft}${href(linkHref(u), t(shortLink(u)))}}\\par`); };
  const section = (title: string) => body.push('', `\\cvsection{${t1(title)}}`);

  const order = completeOrder(DEFAULT_SECTION_ORDER, cfg.sectionOrder);
  for (const key of order) {
    if (hidden.has(key)) continue;
    if (key === 'profile') {
      if (!cv.profile?.text?.trim()) continue;
      section(sec.profile); para(cv.profile.text);
    } else if (key === 'details') {
      const rows = (['birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'driversLicense'] as const)
        .filter(k => p[k]?.trim()).map(k => `\\cvline{${t1(L.fields[k])}}{${t(p[k])}}`);
      if (!rows.length) continue;
      section(sec.details); body.push(...rows);
    } else if (key === 'experience') {
      const list = cv.experience.filter(e => !e.hidden);
      if (!list.length) continue;
      section(sec.experience);
      for (const e of list) {
        head(t1(e.role), t1(dateRange(e.start, e.end, present)));
        sub(t1(e.company), t1(e.location));
        items(e.bullets);
      }
    } else if (key === 'education') {
      if (!cv.education.length) continue;
      section(sec.education);
      for (const e of cv.education) {
        head(t1(e.degree), t1(dateRange(e.start, e.end, present)));
        sub(t1(e.institution), t1(e.location));
        if (e.notes?.trim()) body.push(`{\\small\\color{cvsoft}${t(e.notes)}}\\par`);
      }
    } else if (key === 'skills') {
      const groups = cv.skillGroups.filter(g => g.items.some(i => i.trim()));
      if (!groups.length) continue;
      section(skillsHeading(L));
      for (const g of groups) body.push(`\\cvline{${t1(g.label)}}{${g.items.map(i => t1(i)).filter(Boolean).join(', ')}}`);
    } else if (key === 'languages') {
      if (!cv.languages.length) continue;
      section(sec.languages);
      for (const l of cv.languages) body.push(`\\cvline{${t1(l.language)}}{${t1(l.level)}}`);
    } else if (key === 'additional') {
      const add = (cv.additionalExperience ?? []).filter(x => x.trim());
      if (!add.length) continue;
      section(sec.additional); items(add);
    } else if (key === 'projects') {
      const list = projectsOf(cv);
      if (!list.length) continue;
      section(sectionHeading(L, 'projects'));
      for (const e of list) {
        head(t1(e.title), t1(dateRange(e.start, e.end, present)));
        sub(t1(e.role), '');
        link(e.url); para(e.description); items(bulletsOf(e));
      }
    } else if (key === 'certificates') {
      const list = certificatesOf(cv);
      if (!list.length) continue;
      section(sectionHeading(L, 'certificates'));
      for (const c of list) { head(t1(c.name), t1(c.date)); sub(t1(c.issuer), t1(c.credentialId)); link(c.url); }
    } else if (key === 'volunteering') {
      const list = volunteeringOf(cv);
      if (!list.length) continue;
      section(sectionHeading(L, 'volunteering'));
      for (const v of list) {
        head(t1(v.role), t1(dateRange(v.start, v.end, present)));
        sub(t1(v.organization), t1(v.location));
        items(bulletsOf(v));
      }
    } else if (key === 'publications') {
      const list = publicationsOf(cv);
      if (!list.length) continue;
      section(sectionHeading(L, 'publications'));
      for (const pub of list) { head(t1(pub.title), t1(pub.date)); sub(t1(pub.publisher), ''); link(pub.url); para(pub.description); }
    } else if (key === 'custom') {
      for (const cs of customSectionsOf(cv)) {
        section(cs.title || '');
        items(customItemsOf(cs));
        for (const e of customEntriesOf(cs)) {
          if (e.title?.trim() || e.date?.trim()) head(t1(e.title), t1(e.date));
          sub(t1(e.subtitle), '');
          para(e.text);
        }
      }
    }
  }

  const unicode = [...extra].sort((a, b) => a - b)
    .map(cp => `  \\DeclareUnicodeCharacter{${cp.toString(16).toUpperCase().padStart(4, '0')}}{?}`);
  const today = new Date().toISOString().slice(0, 10);
  const pre = [
    /* Kommentarzeile: Zeilenwechsel im Namen würden den Kommentar beenden
     * und den Rest als Quelltext lesen lassen — deshalb einzeilig. */
    `% ${t1(p.name) || 'CV'} — ${t1(L.misc.cvLabel)} (${today})`,
    ...HEAD_COMMENT[lang].map(l => `% ${l}`),
    '\\documentclass[10pt]{article}',
    `\\usepackage[${paper},top=16mm,bottom=16mm,left=18mm,right=18mm]{geometry}`,
    '\\usepackage{iftex}',
    '\\ifPDFTeX',
    '  \\usepackage[utf8]{inputenc}',
    '  \\usepackage[T1]{fontenc}',
    '  \\usepackage{lmodern}',
    ...(unicode.length ? ['  % Zeichen ohne pdfLaTeX-Schnitt: XeLaTeX oder LuaLaTeX setzen sie richtig.', ...unicode] : []),
    '\\else',
    '  \\usepackage{fontspec}',
    '\\fi',
    '\\usepackage{xcolor}',
    '\\usepackage{enumitem}',
    '\\usepackage[hidelinks]{hyperref}',
    '',
    `\\definecolor{cvaccent}{HTML}{${accent}}`,
    `\\definecolor{cvsoft}{HTML}{${soft}}`,
    `\\hypersetup{pdftitle={${t1(p.name)} \\textendash\\ ${t1(L.misc.cvLabel)}}, pdfauthor={${t1(p.name)}}}`,
    '',
    '% Abschnittsüberschrift mit Linie',
    '\\newcommand{\\cvsection}[1]{\\par\\addvspace{10pt}{\\large\\bfseries\\color{cvaccent}#1\\par}\\vspace{2pt}{\\color{cvsoft}\\hrule}\\vspace{5pt}}',
    '% Eintragskopf: Titel links, Zeitraum rechts',
    '\\newcommand{\\cvhead}[2]{\\par\\addvspace{5pt}\\noindent\\textbf{#1}\\hfill{\\small\\color{cvsoft}#2}\\par}',
    '% Zweite Zeile: Firma oder Einrichtung links, Ort rechts',
    '\\newcommand{\\cvsub}[2]{\\noindent{\\color{cvaccent}#1}\\hfill{\\small\\color{cvsoft}#2}\\par}',
    '% Zeile aus Bezeichnung und Wert (Eckdaten, Kenntnisse, Sprachen)',
    '\\newcommand{\\cvline}[2]{\\par\\noindent\\parbox[t]{34mm}{\\raggedright\\small\\leavevmode\\color{cvsoft}#1}\\hspace{4mm}\\parbox[t]{\\dimexpr\\linewidth-38mm\\relax}{\\raggedright #2}\\par\\vspace{2pt}}',
    '\\setlist[itemize]{leftmargin=1.2em,itemsep=1pt,parsep=0pt,topsep=3pt,label={\\color{cvaccent}\\textbullet}}',
    '\\setlength{\\parindent}{0pt}',
    '\\setlength{\\parskip}{2pt}',
    '% Keine Silbentrennung: getrennte Wörter lesen Parser als zwei Wörter.',
    '\\hyphenpenalty=10000',
    '\\exhyphenpenalty=10000',
    '\\pagestyle{empty}',
    '',
    '\\begin{document}',
    '\\raggedright',
  ];
  return [...pre, ...body, '', '\\end{document}', '', dataBlock(cv), ''].join('\n');
}

/** Lädt die .tex-Datei herunter. */
export function exportLatex(cv: CVData, cfg: Partial<ExportRenderConfig> = {}): void {
  saveText(exportFilename('lebenslauf', cv.personal.name, 'tex'), buildLatex(cv, cfg), 'application/x-tex');
}

// ── Oberfläche ───────────────────────────────────────────────────────────────
// Eigene Texte statt Einträgen in ui/i18n/design.ts: die Datei gehört der
// Gestaltung, diese Ausgänge dem Export. Vier Sprachen wie überall.

export const CODE_EXPORT_UI: Record<'de' | 'en' | 'fr' | 'es', {
  latex: string; latexSub: string; rendercv: string; rendercvSub: string;
  importCode: string; importCodeSub: string; importOk: (what: string) => string; importBusy: string;
  /** Absagen beim Einlesen, je Grund (import/latexImport.ts, ImportRefused). */
  refused: Record<'foreign-latex' | 'broken' | 'too-large' | 'yaml' | 'not-rendercv', string>;
}> = {
  de: {
    latex: 'LaTeX (.tex)', latexSub: 'Quelltext zum Weiterbearbeiten, läuft mit pdfLaTeX und auf Overleaf',
    rendercv: 'RenderCV (YAML)', rendercvSub: 'Lebenslauf als Code, für das freie Werkzeug RenderCV',
    importCode: 'RenderCV oder LaTeX einlesen', importCodeSub: 'YAML aus RenderCV oder eine .tex-Datei, die von hier stammt',
    importOk: what => `${what} übernommen.`, importBusy: 'Wird gelesen …',
    refused: {
      'foreign-latex': 'Diese .tex-Datei stammt nicht von hier. Fremdes LaTeX lässt sich nicht verlässlich in Felder zurücklesen; nimm RenderCV-YAML, JSON Resume oder Markdown.',
      broken: 'Der Datenblock am Ende der Datei ist beschädigt. Nimm die zuletzt exportierte Fassung.',
      'too-large': 'Die Datei ist zu groß (höchstens 2 MB).',
      yaml: 'Die YAML-Datei lässt sich nicht lesen. Prüfe Einrückung und doppelte Schlüssel.',
      'not-rendercv': 'Kein RenderCV-Lebenslauf gefunden: Es fehlt der Abschnitt „cv:" mit Name oder Stationen.',
    },
  },
  en: {
    latex: 'LaTeX (.tex)', latexSub: 'Source to keep editing, compiles with pdfLaTeX and on Overleaf',
    rendercv: 'RenderCV (YAML)', rendercvSub: 'CV as code, for the free tool RenderCV',
    importCode: 'Read RenderCV or LaTeX', importCodeSub: 'YAML from RenderCV or a .tex file exported here',
    importOk: what => `${what} imported.`, importBusy: 'Reading …',
    refused: {
      'foreign-latex': 'This .tex file was not exported here. Foreign LaTeX cannot be read back into fields reliably; use RenderCV YAML, JSON Resume or Markdown.',
      broken: 'The data block at the end of the file is damaged. Use the most recently exported version.',
      'too-large': 'The file is too large (2 MB at most).',
      yaml: 'The YAML file cannot be read. Check indentation and duplicate keys.',
      'not-rendercv': 'No RenderCV CV found: the "cv:" section with a name or positions is missing.',
    },
  },
  fr: {
    latex: 'LaTeX (.tex)', latexSub: 'Source à retravailler, se compile avec pdfLaTeX et sur Overleaf',
    rendercv: 'RenderCV (YAML)', rendercvSub: 'CV sous forme de code, pour l’outil libre RenderCV',
    importCode: 'Lire RenderCV ou LaTeX', importCodeSub: 'YAML de RenderCV ou un fichier .tex exporté ici',
    importOk: what => `${what} importé.`, importBusy: 'Lecture …',
    refused: {
      'foreign-latex': 'Ce fichier .tex ne provient pas d’ici. Un LaTeX tiers ne se relit pas de façon fiable en champs ; utilisez RenderCV (YAML), JSON Resume ou Markdown.',
      broken: 'Le bloc de données en fin de fichier est endommagé. Utilisez la dernière version exportée.',
      'too-large': 'Le fichier est trop volumineux (2 Mo au maximum).',
      yaml: 'Le fichier YAML est illisible. Vérifiez l’indentation et les clés en double.',
      'not-rendercv': 'Aucun CV RenderCV trouvé : la section « cv: » avec un nom ou des postes manque.',
    },
  },
  es: {
    latex: 'LaTeX (.tex)', latexSub: 'Código fuente para seguir editando, compila con pdfLaTeX y en Overleaf',
    rendercv: 'RenderCV (YAML)', rendercvSub: 'CV como código, para la herramienta libre RenderCV',
    importCode: 'Leer RenderCV o LaTeX', importCodeSub: 'YAML de RenderCV o un archivo .tex exportado aquí',
    importOk: what => `${what} importado.`, importBusy: 'Leyendo …',
    refused: {
      'foreign-latex': 'Este archivo .tex no se exportó aquí. Un LaTeX ajeno no se puede leer de forma fiable en campos; usa RenderCV (YAML), JSON Resume o Markdown.',
      broken: 'El bloque de datos al final del archivo está dañado. Usa la última versión exportada.',
      'too-large': 'El archivo es demasiado grande (2 MB como máximo).',
      yaml: 'No se puede leer el archivo YAML. Revisa la sangría y las claves duplicadas.',
      'not-rendercv': 'No se encontró un CV de RenderCV: falta la sección «cv:» con nombre o puestos.',
    },
  },
};
