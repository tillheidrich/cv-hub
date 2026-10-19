// Prüfstand für den Text-Import (src/import/textImport.ts).
//
//   cd app && npx -y tsx scripts/textimport.test.ts
//
// Liegt unter scripts/, nicht unter src/: tsconfig.app.json schließt src/ ein
// und kennt keine Node-Typen (node:assert).
import assert from 'node:assert/strict';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Tab, Table, TableRow, TableCell } from 'docx';
import { importCvText, docxToText, CHATGPT_PROMPT, type TextImportResult } from '../src/import/textImport.ts';
import { createBlankProfile, createDemoProfile } from '../src/data/storage.ts';
import { buildMarkdown } from '../src/export/exportMarkdown.ts';
import type { Lang, ExperienceEntry } from '../src/data/types.ts';

const base = (lang: Lang) => createBlankProfile('').data[lang];
let passed = 0;
const failures: string[] = [];

async function check(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ok  ${name}`); }
  catch (e) { failures.push(name); console.log(`  FEHLER  ${name}\n${(e as Error).message}`); }
}

function exp(r: TextImportResult, i: number, want: Partial<ExperienceEntry> & { bullets?: string[] | number }) {
  const e = r.cv.experience[i];
  assert.ok(e, `Station ${i} fehlt`);
  for (const [k, v] of Object.entries(want)) {
    if (k === 'bullets' && typeof v === 'number') assert.equal(e.bullets.length, v, `Station ${i}: Anzahl Stichpunkte`);
    else assert.deepEqual((e as unknown as Record<string, unknown>)[k], v, `Station ${i}: ${k}`);
  }
}

console.log('Text-Import');

// (1) Deutsche ChatGPT-Ausgabe ────────────────────────────────────────────────
await check('1 deutsche ChatGPT-Ausgabe', () => {
  const text = `**Anna Beispiel**
Kauffrau für Büromanagement

**Telefon:** 0151 23456789
**E-Mail:** anna.beispiel@example.de
**Adresse:** Musterstraße 5, 21255 Tostedt
**LinkedIn:** linkedin.com/in/anna-beispiel

---

**Profil**
Zuverlässige Kauffrau für Büromanagement mit fünf Jahren Erfahrung in Einkauf und Auftragsabwicklung. Strukturiert, freundlich und sicher im Umgang mit SAP.

**Berufserfahrung**

**Sachbearbeiterin Einkauf** | Musterfirma GmbH | 03/2021 – heute
- Bestellabwicklung für rund 200 Lieferanten
- Reklamationsbearbeitung und Lieferantenkommunikation

**Kauffrau für Büromanagement (Ausbildung)**
Beispiel AG, Hamburg | 08/2018 – 02/2021
- Durchlauf aller kaufmännischen Abteilungen
- Rechnungsprüfung

**Ausbildung**

**Ausbildung zur Kauffrau für Büromanagement**
Berufsschule Buxtehude | 2018 – 2021

**Realschulabschluss**
Realschule Horneburg | 2018

**Kenntnisse**
- MS Office (Word, Excel, Outlook) – sehr gut
- SAP MM
- **Soft Skills:** Teamfähigkeit, Organisationstalent

**Sprachen**
- Deutsch (Muttersprache)
- Englisch – B2
- Spanisch: Grundkenntnisse

**Interessen**
Fußball, Lesen`;
  const r = importCvText(text, base('de'), 'de');
  const p = r.cv.personal;
  assert.equal(r.strict, false);
  assert.equal(p.name, 'Anna Beispiel');
  assert.equal(p.title, 'Kauffrau für Büromanagement');
  assert.equal(p.email, 'anna.beispiel@example.de');
  assert.equal(p.phone, '0151 23456789');
  assert.equal(p.location, 'Musterstraße 5, 21255 Tostedt');
  assert.deepEqual(p.socials?.map(s => [s.platform, s.value]), [['linkedin', 'linkedin.com/in/anna-beispiel']]);
  assert.match(r.cv.profile.text, /^Zuverlässige Kauffrau/);
  assert.equal(r.cv.experience.length, 2);
  exp(r, 0, { role: 'Sachbearbeiterin Einkauf', company: 'Musterfirma GmbH', start: '03/2021', end: 'present', bullets: 2 });
  exp(r, 1, { role: 'Kauffrau für Büromanagement (Ausbildung)', company: 'Beispiel AG', location: 'Hamburg', start: '08/2018', end: '02/2021', bullets: 2 });
  assert.equal(r.cv.education.length, 2);
  assert.equal(r.cv.education[0].degree, 'Ausbildung zur Kauffrau für Büromanagement');
  assert.equal(r.cv.education[0].institution, 'Berufsschule Buxtehude');
  assert.equal(r.cv.education[0].start, '2018');
  assert.equal(r.cv.education[0].end, '2021');
  assert.equal(r.cv.education[1].degree, 'Realschulabschluss');
  assert.equal(r.cv.education[1].institution, 'Realschule Horneburg');
  assert.equal(r.cv.education[1].end, '2018');
  const skills = Object.fromEntries(r.cv.skillGroups.map(g => [g.label, g.items]));
  assert.deepEqual(skills['Kenntnisse'], ['MS Office (Word, Excel, Outlook) – sehr gut', 'SAP MM']);
  assert.deepEqual(skills['Soft Skills'], ['Teamfähigkeit', 'Organisationstalent']);
  assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), [['Deutsch', 'Muttersprache'], ['Englisch', 'B2'], ['Spanisch', 'Grundkenntnisse']]);
  assert.deepEqual(r.cv.customSections?.map(s => [s.title, s.items]), [['Interessen', ['Fußball, Lesen']]]);
  assert.deepEqual(r.unsorted, []);
  assert.equal(r.cv.labels.lang, 'de');
  assert.deepEqual({ ...r.found }, { name: true, contact: 4, experience: 2, education: 2, skills: 4, languages: 3, profile: true, other: 1 });
});

// (2) Englische ChatGPT-Ausgabe ───────────────────────────────────────────────
await check('2 englische ChatGPT-Ausgabe', () => {
  const text = `John Smith
Senior Software Engineer
San Francisco, CA | john.smith@email.com | (415) 555-0132 | linkedin.com/in/johnsmith | github.com/jsmith

PROFESSIONAL SUMMARY
Senior engineer with eight years of experience building payment systems and developer tools at scale.

WORK EXPERIENCE
**Senior Software Engineer** — Stripe, San Francisco, CA
*March 2020 – Present*
- Led migration of the billing service to Go
- Mentored four engineers

**Software Engineer** — Dropbox Inc., San Francisco
*June 2016 – February 2020*
- Built the sync conflict resolver

EDUCATION
**B.S. Computer Science** — University of California | 2012 – 2016

SKILLS
- **Languages:** Python, Go, TypeScript
- **Tools:** Docker, Kubernetes, AWS

LANGUAGES
English (Native), Spanish (B2)`;
  const r = importCvText(text, base('en'), 'en');
  const p = r.cv.personal;
  assert.equal(p.name, 'John Smith');
  assert.equal(p.title, 'Senior Software Engineer');
  assert.equal(p.email, 'john.smith@email.com');
  assert.equal(p.phone, '(415) 555-0132');
  assert.equal(p.location, 'San Francisco, CA');
  assert.deepEqual(p.socials?.map(s => s.platform), ['linkedin', 'github']);
  assert.match(r.cv.profile.text, /^Senior engineer with eight years/);
  assert.equal(r.cv.experience.length, 2);
  exp(r, 0, { role: 'Senior Software Engineer', company: 'Stripe', location: 'San Francisco, CA', start: '03/2020', end: 'present', bullets: ['Led migration of the billing service to Go', 'Mentored four engineers'] });
  exp(r, 1, { role: 'Software Engineer', company: 'Dropbox Inc.', location: 'San Francisco', start: '06/2016', end: '02/2020', bullets: 1 });
  assert.equal(r.cv.education.length, 1);
  assert.equal(r.cv.education[0].degree, 'B.S. Computer Science');
  assert.equal(r.cv.education[0].institution, 'University of California');
  assert.equal(r.cv.education[0].start, '2012');
  assert.equal(r.cv.education[0].end, '2016');
  assert.deepEqual(r.cv.skillGroups.map(g => [g.label, g.items.length]), [['Languages', 3], ['Tools', 3]]);
  assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), [['English', 'Native'], ['Spanish', 'B2']]);
  assert.deepEqual(r.unsorted, []);
});

// (3) Französisch ─────────────────────────────────────────────────────────────
await check('3 französische Ausgabe', () => {
  const text = `# Marie Dupont
Chargée de communication

**Téléphone :** +33 6 12 34 56 78
**Courriel :** marie.dupont@exemple.fr
**Adresse :** 12 rue de la Paix, 75002 Paris

## Profil professionnel
Chargée de communication avec six ans d'expérience en agence et en entreprise, spécialisée dans les relations presse.

## Expérience professionnelle
### Chargée de communication | Agence Lumière | Paris | janvier 2021 – aujourd’hui
- Pilotage des relations presse
- Rédaction de communiqués

### Assistante marketing | Société Exemple SARL | Lyon | sept. 2018 – déc. 2020
- Organisation de salons

## Formation
### Master Communication | Université Lumière Lyon 2 | Lyon | 2016 – 2018

## Compétences
- Logiciels : Adobe InDesign, Canva, WordPress
- Relations presse

## Langues
- Français : langue maternelle
- Anglais : C1`;
  const r = importCvText(text, base('fr'), 'fr');
  const p = r.cv.personal;
  assert.equal(p.name, 'Marie Dupont');
  assert.equal(p.title, 'Chargée de communication');
  assert.equal(p.phone, '+33 6 12 34 56 78');
  assert.equal(p.email, 'marie.dupont@exemple.fr');
  assert.equal(p.location, '12 rue de la Paix, 75002 Paris');
  assert.match(r.cv.profile.text, /six ans/);
  assert.equal(r.cv.experience.length, 2);
  exp(r, 0, { role: 'Chargée de communication', company: 'Agence Lumière', location: 'Paris', start: '01/2021', end: 'present', bullets: 2 });
  exp(r, 1, { role: 'Assistante marketing', company: 'Société Exemple SARL', location: 'Lyon', start: '09/2018', end: '12/2020', bullets: 1 });
  assert.deepEqual([r.cv.education[0].degree, r.cv.education[0].institution, r.cv.education[0].location, r.cv.education[0].start, r.cv.education[0].end], ['Master Communication', 'Université Lumière Lyon 2', 'Lyon', '2016', '2018']);
  assert.deepEqual(r.cv.skillGroups.map(g => [g.label, g.items]), [['Logiciels', ['Adobe InDesign', 'Canva', 'WordPress']], ['Compétences', ['Relations presse']]]);
  assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), [['Français', 'langue maternelle'], ['Anglais', 'C1']]);
  assert.equal(r.cv.labels.lang, 'fr');
  assert.deepEqual(r.unsorted, []);
});

// (4) Spanisch ────────────────────────────────────────────────────────────────
await check('4 spanische Ausgabe', () => {
  const text = `# Lucía García López
Desarrolladora web

Correo: lucia.garcia@ejemplo.es
Teléfono: +34 612 345 678
Dirección: Calle Mayor 10, 28013 Madrid

## Sobre mí
Desarrolladora web con cinco años de experiencia en comercio electrónico y aplicaciones accesibles.

## Experiencia laboral
### Desarrolladora frontend | Tienda Ejemplo S.L. | Madrid | 03/2019 – actualidad
- Migración de la tienda a React
- Mejora de la accesibilidad

### Desarrolladora junior | Agencia Sol | Valencia | 2017 – 2019
- Maquetación de páginas

## Formación
### Grado en Ingeniería Informática | Universidad de Valencia | 2013 – 2017

## Habilidades
JavaScript, React, CSS, Git

## Idiomas
Español (nativo), Inglés (B2), Alemán (A2)`;
  const r = importCvText(text, base('es'), 'es');
  const p = r.cv.personal;
  assert.equal(p.name, 'Lucía García López');
  assert.equal(p.title, 'Desarrolladora web');
  assert.equal(p.email, 'lucia.garcia@ejemplo.es');
  assert.equal(p.phone, '+34 612 345 678');
  assert.equal(p.location, 'Calle Mayor 10, 28013 Madrid');
  assert.match(r.cv.profile.text, /cinco años/);
  assert.equal(r.cv.experience.length, 2);
  exp(r, 0, { role: 'Desarrolladora frontend', company: 'Tienda Ejemplo S.L.', location: 'Madrid', start: '03/2019', end: 'present', bullets: 2 });
  exp(r, 1, { role: 'Desarrolladora junior', company: 'Agencia Sol', location: 'Valencia', start: '2017', end: '2019', bullets: 1 });
  assert.equal(r.cv.education[0].degree, 'Grado en Ingeniería Informática');
  assert.equal(r.cv.education[0].institution, 'Universidad de Valencia');
  assert.deepEqual(r.cv.skillGroups.map(g => [g.label, g.items]), [['Habilidades', ['JavaScript', 'React', 'CSS', 'Git']]]);
  assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), [['Español', 'nativo'], ['Inglés', 'B2'], ['Alemán', 'A2']]);
  assert.deepEqual(r.unsorted, []);
});

// (5) Markdown-Tabellen ───────────────────────────────────────────────────────
await check('5 Markdown-Tabelle für Stationen', () => {
  const text = `# Lena Test
lena@test.de · +49 170 1234567

## Berufserfahrung
| Zeitraum | Position | Unternehmen | Aufgaben |
|---|---|---|---|
| 01/2022 – heute | Teamleiterin | Alpha GmbH | Planung; Führung von 6 Personen |
| 2019 – 2021 | Sachbearbeiterin | Beta AG | Buchhaltung |

## Ausbildung
| Zeitraum | Abschluss | Einrichtung |
|---|---|---|
| 2015 – 2019 | B.Sc. BWL | Universität Hamburg |

## Sprachen
| Sprache | Niveau |
|---|---|
| Deutsch | Muttersprache |
| Englisch | C1 |`;
  const r = importCvText(text, base('de'), 'de');
  assert.equal(r.cv.personal.name, 'Lena Test');
  assert.equal(r.cv.personal.email, 'lena@test.de');
  assert.equal(r.cv.personal.phone, '+49 170 1234567');
  assert.equal(r.cv.experience.length, 2);
  exp(r, 0, { role: 'Teamleiterin', company: 'Alpha GmbH', start: '01/2022', end: 'present', bullets: ['Planung', 'Führung von 6 Personen'] });
  exp(r, 1, { role: 'Sachbearbeiterin', company: 'Beta AG', start: '2019', end: '2021', bullets: ['Buchhaltung'] });
  assert.deepEqual([r.cv.education[0].degree, r.cv.education[0].institution, r.cv.education[0].start, r.cv.education[0].end], ['B.Sc. BWL', 'Universität Hamburg', '2015', '2019']);
  assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), [['Deutsch', 'Muttersprache'], ['Englisch', 'C1']]);
  assert.deepEqual(r.unsorted, []);
});

// (6) Aus Word kopiert ────────────────────────────────────────────────────────
await check('6 Word-Text ohne Markdown', () => {
  const text = `LEBENSLAUF

Max Mustermann
Rotdornweg 17
21255 Tostedt
Telefon: 04182 123456
max.mustermann@example.de
Geburtsdatum: 07.05.1992

BERUFSERFAHRUNG

03/2021 – heute\tLagerlogistik Nord GmbH, Hamburg
Fachkraft für Lagerlogistik
•\tWareneingang und Kommissionierung
•\tStaplerfahren im Hochregallager

08/2018 – 02/2021  Spedition Meyer KG, Buxtehude
Auszubildender Fachkraft für Lagerlogistik
•\tTourenplanung

SCHULBILDUNG

2012 – 2018\tRealschule Horneburg
Realschulabschluss

KENNTNISSE
Staplerschein, SAP, MS Office

SPRACHEN
Deutsch\tMuttersprache
Englisch\tGrundkenntnisse

HOBBYS
Fußball, Angeln`;
  const r = importCvText(text, base('de'), 'de');
  const p = r.cv.personal;
  assert.equal(p.name, 'Max Mustermann');
  assert.equal(p.title, '');
  assert.equal(p.location, 'Rotdornweg 17, 21255 Tostedt');
  assert.equal(p.phone, '04182 123456');
  assert.equal(p.email, 'max.mustermann@example.de');
  assert.equal(p.birthDate, '07.05.1992');
  assert.equal(r.cv.experience.length, 2);
  exp(r, 0, { role: 'Fachkraft für Lagerlogistik', company: 'Lagerlogistik Nord GmbH', location: 'Hamburg', start: '03/2021', end: 'present', bullets: 2 });
  exp(r, 1, { role: 'Auszubildender Fachkraft für Lagerlogistik', company: 'Spedition Meyer KG', location: 'Buxtehude', start: '08/2018', end: '02/2021', bullets: ['Tourenplanung'] });
  assert.deepEqual([r.cv.education[0].degree, r.cv.education[0].institution, r.cv.education[0].start, r.cv.education[0].end], ['Realschulabschluss', 'Realschule Horneburg', '2012', '2018']);
  assert.deepEqual(r.cv.skillGroups.map(g => [g.label, g.items]), [['Kenntnisse', ['Staplerschein', 'SAP', 'MS Office']]]);
  assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), [['Deutsch', 'Muttersprache'], ['Englisch', 'Grundkenntnisse']]);
  assert.deepEqual(r.cv.customSections?.map(s => [s.title, s.items]), [['Hobbys', ['Fußball, Angeln']]]);
  assert.deepEqual(r.unsorted, []);
});

// (7) Eigenes Export-Format (Rundlauf) ───────────────────────────────────────
await check('7 eigenes Export-Format, Rundlauf mit dem Demo-Lebenslauf', () => {
  const demo = createDemoProfile().data.de;
  const md = buildMarkdown(demo, { template: 'espoo', fontScale: 1, fontPairing: 'auto', pageMode: 'one' });
  for (const text of [md, '```markdown\n' + md + '\n```']) {
    const r = importCvText(text, base('de'), 'de');
    assert.equal(r.strict, true);
    assert.deepEqual(r.unsorted, []);
    assert.equal(r.cv.personal.name, demo.personal.name);
    assert.equal(r.cv.personal.email, demo.personal.email);
    assert.equal(r.cv.personal.phone, demo.personal.phone);
    assert.deepEqual(r.cv.experience.map(e => [e.role, e.company, e.location, e.start, e.end, e.bullets]), demo.experience.map(e => [e.role, e.company, e.location, e.start, e.end, e.bullets]));
    assert.deepEqual(r.cv.education.map(e => [e.degree, e.institution, e.start, e.end]), demo.education.map(e => [e.degree, e.institution, e.start, e.end]));
    assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), demo.languages.map(l => [l.language, l.level]));
    assert.deepEqual(r.cv.skillGroups, demo.skillGroups);
    assert.equal(r.found.experience, 3);
    assert.equal(r.found.languages, 3);
  }
});

// (8) Codeblock-Zaun mit KI-Geplauder ────────────────────────────────────────
await check('8 Codeblock-Zaun ```markdown mit Geplauder drumherum', () => {
  const text = `Hier ist dein Lebenslauf im gewünschten Format:

\`\`\`markdown
# Jonas Weber
Elektroniker für Betriebstechnik

## Kontakt
E-Mail: jonas.weber@example.com
Telefon: +49 (0)40 123 45 67

## Berufserfahrung
### Elektroniker | Stadtwerke Lüneburg GmbH | Lüneburg | 09/2019 – heute
- Wartung von Schaltanlagen
- Störungsdienst

## Ausbildung
### Ausbildung Elektroniker für Betriebstechnik | Berufsbildende Schulen Lüneburg | Lüneburg | 08/2016 – 06/2019
- Abschlussnote: 1,8

## Kenntnisse
Elektrotechnik: SPS, KNX, Messtechnik

## Sprachen
- Deutsch: Muttersprache
- Englisch: B1
\`\`\`

Viel Erfolg bei deiner Bewerbung!`;
  const r = importCvText(text, base('de'), 'de');
  assert.equal(r.strict, false);
  assert.equal(r.cv.personal.name, 'Jonas Weber');
  assert.equal(r.cv.personal.title, 'Elektroniker für Betriebstechnik');
  assert.equal(r.cv.personal.email, 'jonas.weber@example.com');
  assert.equal(r.cv.personal.phone, '+49 (0)40 123 45 67');
  exp(r, 0, { role: 'Elektroniker', company: 'Stadtwerke Lüneburg GmbH', location: 'Lüneburg', start: '09/2019', end: 'present', bullets: 2 });
  assert.deepEqual([r.cv.education[0].degree, r.cv.education[0].institution, r.cv.education[0].location, r.cv.education[0].start, r.cv.education[0].end, r.cv.education[0].notes], ['Ausbildung Elektroniker für Betriebstechnik', 'Berufsbildende Schulen Lüneburg', 'Lüneburg', '08/2016', '06/2019', 'Abschlussnote: 1,8']);
  assert.deepEqual(r.cv.skillGroups.map(g => [g.label, g.items]), [['Elektrotechnik', ['SPS', 'KNX', 'Messtechnik']]]);
  assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), [['Deutsch', 'Muttersprache'], ['Englisch', 'B1']]);
  // Das Geplauder ist nicht verloren, aber auch nicht der Name.
  assert.deepEqual(r.unsorted, ['Hier ist dein Lebenslauf im gewünschten Format:', 'Viel Erfolg bei deiner Bewerbung!']);
});

// (9) Müll und Leeres ────────────────────────────────────────────────────────
await check('9 Müll, Leeres, Riesentext → kein Absturz', () => {
  const empty = importCvText('', base('de'), 'de');
  assert.equal(empty.cv.personal.name, '');
  assert.deepEqual(empty.unsorted, []);
  assert.equal(empty.cv.experience.length, 0);
  assert.deepEqual({ ...empty.found }, { name: false, contact: 0, experience: 0, education: 0, skills: 0, languages: 0, profile: false, other: 0 });
  const junk = importCvText('asdf qwer\n\n%%%%%\n12345\n---\n:::: ;;;; ||| \u0000\u0007', base('de'), 'de');
  assert.equal(junk.cv.personal.name, '');
  assert.equal(junk.cv.experience.length, 0);
  assert.ok(junk.unsorted.includes('asdf qwer'));
  assert.ok(junk.unsorted.includes('12345'));
  // Kein String, überlange Zeilen, ReDoS-Muster: darf nicht werfen und muss schnell sein.
  const t0 = Date.now();
  importCvText(undefined as unknown as string, base('de'), 'de');
  importCvText(('- ' + ' '.repeat(3000) + 'a\n').repeat(20), base('de'), 'de');
  importCvText('x'.repeat(100_000), base('de'), 'de');
  importCvText(('2019 - 2020 - 2021 - '.repeat(80) + '\n').repeat(30), base('de'), 'de');
  importCvText(('**' + 'a'.repeat(500) + '\n').repeat(100), base('de'), 'de');
  importCvText(('a@' + 'b.'.repeat(900) + '\n').repeat(30), base('de'), 'de');
  importCvText(('| ' + 'x | '.repeat(400) + '\n').repeat(40), base('de'), 'de');
  assert.ok(Date.now() - t0 < 4000, `zu langsam: ${Date.now() - t0} ms`);
});

// (10) Interessen, Unbekanntes, Ehrenamt, Zertifikate ────────────────────────
await check('10 Interessen und Unbekanntes gehen nicht verloren', () => {
  const text = `Sophie Klein
sophie.klein@example.org | 0176 98765432 | Kiel

Profil
Erzieherin mit Herz und acht Jahren Erfahrung in der Krippenarbeit, zuletzt als stellvertretende Leitung.

Berufserfahrung
2018 – heute: Stellvertretende Leitung, Kita Sonnenschein, Kiel
- Elternarbeit und Dienstplanung

Zertifikate
- Fachkraft für Inklusion | Paritätisches Bildungswerk | 05/2021

Ehrenamt
- Jugendtrainerin, TSV Kiel (seit 2015)

Interessen
Segeln, Gitarre spielen

Meine Superkraft
Ich bringe jedes Kind zum Lachen.

Weiteres
Führerschein: Klasse B
Erste-Hilfe-Kurs am Kind`;
  const r = importCvText(text, base('de'), 'de');
  assert.equal(r.cv.personal.name, 'Sophie Klein');
  assert.equal(r.cv.personal.email, 'sophie.klein@example.org');
  assert.equal(r.cv.personal.phone, '0176 98765432');
  assert.equal(r.cv.personal.location, 'Kiel');
  assert.equal(r.cv.personal.driversLicense, 'Klasse B');
  assert.match(r.cv.profile.text, /^Erzieherin mit Herz/);
  exp(r, 0, { role: 'Stellvertretende Leitung', company: 'Kita Sonnenschein', location: 'Kiel', start: '2018', end: 'present', bullets: ['Elternarbeit und Dienstplanung'] });
  assert.deepEqual(r.cv.certificates?.map(c => [c.name, c.issuer, c.date]), [['Fachkraft für Inklusion', 'Paritätisches Bildungswerk', '05/2021']]);
  assert.deepEqual(r.cv.volunteering?.map(v => [v.role, v.organization, v.start, v.end]), [['Jugendtrainerin', 'TSV Kiel', '2015', 'present']]);
  assert.equal(r.cv.customSections?.[0].title, 'Interessen');
  assert.equal(r.cv.customSections?.[0].items?.[0], 'Segeln, Gitarre spielen');
  assert.deepEqual(r.cv.additionalExperience, ['Erste-Hilfe-Kurs am Kind']);
  // „Meine Superkraft" ist ohne Auszeichnung keine erkennbare Überschrift und
  // läuft im Abschnitt davor mit — verloren gehen darf sie nicht.
  const all = JSON.stringify(r.cv) + JSON.stringify(r.unsorted);
  assert.ok(all.includes('Ich bringe jedes Kind zum Lachen.'), 'Freitext verloren');
  assert.ok(all.includes('Meine Superkraft'), 'Überschrift verloren');

  const md = importCvText(`# Sophie Klein\n\n## Interessen\n- Segeln\n- Gitarre\n\n## Meine Superkraft\nIch bringe jedes Kind zum Lachen.`, base('de'), 'de');
  assert.deepEqual(md.cv.customSections?.map(s => [s.title, s.items]), [['Interessen', ['Segeln', 'Gitarre']]]);
  assert.deepEqual(md.unsorted, ['Meine Superkraft: Ich bringe jedes Kind zum Lachen.']);
});

// (11) Weitere Formen ─────────────────────────────────────────────────────────
await check('11 Stationsformen: „bei", Jahr vorn, Klammern, PDF-Umbruch', () => {
  const text = `## Berufserfahrung
Projektmanagerin bei Nordlicht Media GmbH, 2019 - 2021
- Steuerung von Kampagnen für
  mittelständische Kunden

2016 – 2019: Junior Projektmanagerin, Werbeagentur Kreativ GmbH

### Werkstudentin – Hafen Logistik AG, Hamburg (2014–2016)
- Datenpflege

## Ausbildung
- 2013: Abitur, Athenaeum Stade
- 2014 – 2019: B.A. Geschichte, Universität Greifswald`;
  const r = importCvText(text, base('de'), 'de');
  assert.equal(r.cv.experience.length, 3);
  exp(r, 0, { role: 'Projektmanagerin', company: 'Nordlicht Media GmbH', start: '2019', end: '2021', bullets: ['Steuerung von Kampagnen für mittelständische Kunden'] });
  exp(r, 1, { role: 'Junior Projektmanagerin', company: 'Werbeagentur Kreativ GmbH', start: '2016', end: '2019', bullets: 0 });
  exp(r, 2, { role: 'Werkstudentin', company: 'Hafen Logistik AG', location: 'Hamburg', start: '2014', end: '2016', bullets: 1 });
  assert.deepEqual(r.cv.education.map(e => [e.degree, e.institution, e.start, e.end]), [['Abitur', 'Athenaeum Stade', '', '2013'], ['B.A. Geschichte', 'Universität Greifswald', '2014', '2019']]);
});

// (12) Anleitung für ChatGPT: Musterantwort im beschriebenen Format ──────────
await check('12 CHATGPT_PROMPT beschreibt ein Format, das sicher gelesen wird', () => {
  for (const lang of ['de', 'en', 'fr', 'es'] as Lang[]) {
    const p = CHATGPT_PROMPT[lang];
    assert.ok(p.length > 400 && p.length < 3000, `${lang}: Länge`);
    assert.ok(p.includes('###') && p.includes('MM/'), `${lang}: Stationsformat`);
  }
  assert.match(CHATGPT_PROMPT.de, /Erfinde nichts/);
  assert.match(CHATGPT_PROMPT.de, /einen einzigen Codeblock/);
  // Die Formatvorlage selbst (zwischen „Format:" und „Mein Lebenslauf:") ist
  // gültige Eingabe: jeder Abschnitt wird erkannt, nichts bleibt unsortiert.
  const tpl = CHATGPT_PROMPT.de.split('Format:\n')[1].split('Mein Lebenslauf:')[0]
    .replace(/…/g, 'x').replace(/MM\/JJJJ – MM\/JJJJ/g, '01/2020 – 12/2022').replace(/MM\/JJJJ/g, '05/2021').replace('Vorname Nachname', 'Erika Muster').replace('Zwei bis vier Sätze aus meinem Text.', 'Ein Profiltext.');
  const r = importCvText(tpl, base('de'), 'de');
  assert.equal(r.cv.personal.name, 'Erika Muster');
  assert.equal(r.cv.experience.length, 1);
  exp(r, 0, { role: 'Position', company: 'Firma', location: 'Ort', start: '01/2020', end: '12/2022', bullets: 2 });
  assert.equal(r.cv.education[0].institution, 'Schule oder Hochschule');
  assert.equal(r.cv.skillGroups[0].label, 'Bereich');
  assert.equal(r.cv.languages[0].language, 'Sprache');
  assert.equal(r.cv.certificates?.[0].issuer, 'Aussteller');
  assert.equal(r.cv.projects?.[0].title, 'Projektname');
  assert.equal(r.cv.volunteering?.[0].organization, 'Organisation');
  assert.deepEqual(r.unsorted, []);
});

// (13) Word-Datei ─────────────────────────────────────────────────────────────
await check('13 docxToText: Überschrift, Absatz, Liste, Tabelle', async () => {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: 'Berufserfahrung', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('03/2021 – heute'), new TextRun({ children: [new Tab(), 'Musterfirma GmbH'] })] }),
        new Paragraph({ text: 'Sachbearbeiterin & Assistenz <Einkauf>' }),
        new Paragraph({ text: 'Bestellungen bearbeiten', bullet: { level: 0 } }),
        new Paragraph({ text: 'Lieferanten betreuen', bullet: { level: 0 } }),
        new Paragraph({ text: 'Sprachen', heading: HeadingLevel.HEADING_2 }),
        new Table({
          rows: [new TableRow({ children: [
            new TableCell({ children: [new Paragraph('Deutsch')] }),
            new TableCell({ children: [new Paragraph('Muttersprache')] }),
          ] })],
        }),
      ],
    }],
  });
  const buf = await Packer.toBuffer(doc);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const text = await docxToText(ab);
  const lines = text.split('\n').filter(Boolean);
  assert.deepEqual(lines, [
    '## Berufserfahrung',
    '03/2021 – heute\tMusterfirma GmbH',
    'Sachbearbeiterin & Assistenz <Einkauf>',
    '- Bestellungen bearbeiten',
    '- Lieferanten betreuen',
    '## Sprachen',
    'Deutsch\tMuttersprache',
  ]);
  // Und der Text geht durch den Import.
  const r = importCvText('Petra Probe\n' + text, base('de'), 'de');
  exp(r, 0, { role: 'Sachbearbeiterin & Assistenz <Einkauf>', company: 'Musterfirma GmbH', start: '03/2021', end: 'present', bullets: 2 });
  assert.deepEqual(r.cv.languages.map(l => [l.language, l.level]), [['Deutsch', 'Muttersprache']]);
  await assert.rejects(() => docxToText(new TextEncoder().encode('kein zip').buffer as ArrayBuffer));
});

console.log(`\n${passed} bestanden, ${failures.length} fehlgeschlagen${failures.length ? ': ' + failures.join(', ') : ''}`);
if (failures.length) process.exit(1);
