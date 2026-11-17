/**
 * Plain Markdown templates the user can download as a starter file. Matches
 * the server-side markdown-bridge format (see pdf-service/markdown.js) so a
 * filled-out template imports cleanly without parser warnings.
 *
 * Two variants exist:
 *   - cv:de / cv:en  → Lebenslauf / CV
 *   - cl:de / cl:en  → Anschreiben / cover letter
 *
 * Ohne `template:`-Zeile (seit 08.10.2026): Eine ausgefüllte Vorlage soll die
 * gewählte Vorlage des Profils behalten. Vorher stand hier „hamburg", und
 * jeder Import über ein Konto stellte darauf um.
 */

export type MdTemplateKind = 'cv' | 'cl';
export type MdTemplateLang = 'de' | 'en';

const CV_DE = `---
lang: de
fontScale: 1.0
fontPairing: auto
pageMode: one
---

# Vorname Nachname
**Berufsbezeichnung**

## Kontakt
- E-Mail: name@example.com
- Telefon: +49 151 12345678
- Ort: Hamburg
- Website: deinedomain.de
- LinkedIn: linkedin.com/in/dein-handle

## Profil
Kurzer Profiltext, 2-3 Sätze: Wer du bist, deine Schwerpunkte, was dich auszeichnet. Beispiel:
„Senior Marketing Manager mit 8 Jahren Erfahrung in B2B-SaaS. Schwerpunkte: Performance Ads, Lifecycle-Marketing, Markenstrategie. Bringt Kampagnen vom ersten Brief bis zum gemessenen Ergebnis."

## Berufserfahrung

### Aktuelle Position
Firma · Ort · 01/2023 – heute
- Bullet 1: was du gemacht hast (Aktion + Kontext + Ergebnis/Wirkung)
- Bullet 2: nächste Verantwortung mit messbarem Outcome
- Bullet 3: relevante Tools/Methoden/Skills die zur Stelle passen

### Vorherige Position
Firma · Ort · 06/2020 – 12/2022
- Bullet 1
- Bullet 2

## Ausbildung

### Studiengang oder Abschluss
Hochschule · Ort · 2017 – 2020

### Vorbildung
Schule · Ort · 2008 – 2017

## Skills

### Kategorie 1 (z. B. Tech)
- Tool 1
- Tool 2
- Tool 3

### Kategorie 2 (z. B. Methoden)
- Methode 1
- Methode 2

## Sprachen
- Deutsch — Muttersprache (5/5)
- Englisch — C1 (4/5)
- Französisch — A2 (2/5)

## Projekte

### Projektname
Rolle: deine Rolle im Projekt
Zeitraum: 03/2023 – 11/2023
Link: example.org/projekt
Ein Satz, worum es ging und was am Ende herauskam.
- Ergebnis mit Zahl

## Zertifikate

### Name des Zertifikats
Aussteller: ausstellende Stelle
Datum: 05/2024

## Weiteres
- Interessen, Speaking-Engagements

<!-- Weitere Abschnitte, bei Bedarf als eigene Überschrift einfügen:
Ehrenamt: Überschrift „Ehrenamt“, Einträge wie eine Station (Rolle, darunter Verein · Ort · 2019 – heute).
Publikationen: Überschrift „Publikationen“, je Titel die Zeilen Verlag, Datum und Link.
Eigener Abschnitt: Überschrift „Abschnitt: Dein Titel“, darunter Stichpunkte oder Einträge.
Leere Abschnitte einfach weglassen. -->
`;

/* Englische Vorlage mit englischen Überschriften und Schlüsseln (seit
 * 17.11.2026, export/markdownHeads.ts). Vorher stand hier „## Kontakt",
 * „## Berufserfahrung" und der Hinweis, die deutschen Schlüssel zu behalten. */
const CV_EN = `---
lang: en
fontScale: 1.0
fontPairing: auto
pageMode: one
---

# First Last
**Job Title**

## Contact
- Email: name@example.com
- Phone: +49 151 12345678
- Location: Berlin
- Website: yourdomain.com
- LinkedIn: linkedin.com/in/your-handle

## Profile
Short summary, 2-3 sentences: who you are, your focus, what sets you apart.
Example: "Backend engineer with six years in Java and AWS, now focusing on platform reliability and developer tooling."

## Experience

### Current Role
Company · Location · 01/2023 – Present
- Bullet 1: what you did (action + context + outcome)
- Bullet 2: next responsibility with a measurable result
- Bullet 3: relevant tools, methods and skills for the target role

### Previous Role
Company · Location · 06/2020 – 12/2022
- Bullet 1
- Bullet 2

## Education

### Degree or Programme
University · Location · 2017 – 2020

## Skills

### Category 1 (e.g. Tech)
- Tool 1
- Tool 2

### Category 2 (e.g. Methods)
- Method 1
- Method 2

## Languages
- English — Native (5/5)
- German — B2 (3/5)
- French — A2 (2/5)

## Projects

### Project name
Role: your role in the project
Period: 03/2023 – 11/2023
Link: example.org/project
One sentence on what it was about and what came out of it.
- Outcome with a number

## Certifications

### Certification name
Issuer: issuing body
Date: 05/2024

## Additional information
- Interests, talks

<!-- More sections, each under its own heading when needed:
Volunteering: heading "Volunteering", entries like a job (role, then Organisation · Place · 2019 – Present).
Publications: heading "Publications", per title the lines Publisher, Date and Link.
Your own section: heading "Section: Your title", then bullets or entries.
Leave out empty sections. -->
`;

/* Datum beim Abruf, nicht beim Laden des Moduls. */
const today = (loc: string) => new Date().toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });

const CL_DE = () => `---
doc: cover-letter
lang: de
---

## Empfänger
- Firma: Acme GmbH
- Ansprechpartner: Frau Mustermann
- Adresse: Musterstraße 1, 20095 Hamburg

## Kopf
- Ort: Hamburg
- Datum: ${today('de-DE')}

## Betreff
Bewerbung als [Position]

## Anrede
Sehr geehrte Frau Mustermann,

## Einstieg
ein bis zwei Sätze: Warum diese Stelle, warum jetzt. Direkter Einstieg ohne Floskel.

## Hauptteil
Drei bis fünf Sätze: konkrete Stationen aus dem CV, die die Stelle adressieren. Bullets aus deiner aktuellen Position wörtlich aufgreifen.

## Firmenbezug
Zwei bis drei Sätze: was an der Firma überzeugt — Produkt, Mission, Team. Konkret, nicht generisch.

## Motivation
Zwei Sätze: was du beitragen willst.

## Abschluss
Ein Satz: Gesprächs-Einladung.

## Grußformel
Mit freundlichen Grüßen
Dein Name
`;

/* Bewerbung nach Deutschland: deutsche Musteranschrift, britisches Datum. */
const CL_EN = () => `---
doc: cover-letter
lang: en
---

## Recipient
- Company: Example GmbH
- Contact person: Ms Schneider
- Address: Musterstraße 1, 20095 Hamburg

## Header
- City: Berlin
- Date: ${today('en-GB')}

## Subject
Application for [Position]

## Salutation
Dear Ms Schneider,

## Introduction
One or two sentences: why this role, why now. Get straight to the point.

## Main body
Three to five sentences: concrete roles from your CV that match the job. Reuse the strongest bullets from your current position.

## Why this company
Two or three sentences: what draws you to the company (product, mission, team). Specific, not generic.

## Motivation
Two sentences: what you want to contribute.

## Closing
One sentence asking for an interview.

## Sign-off
Kind regards
Your name
`;

/** Full language union — FR/ES reuse the EN starter body (the parser reads
 *  English headings in every language) but the frontmatter `lang:` is stamped
 *  with the real language so the import writes to the correct variant instead
 *  of clobbering DE/EN. */
export type MdTemplateFullLang = 'de' | 'en' | 'fr' | 'es';

export function getMdTemplate(kind: MdTemplateKind, lang: MdTemplateFullLang): string {
  const body = kind === 'cl'
    ? (lang === 'de' ? CL_DE() : CL_EN())
    : (lang === 'de' ? CV_DE : CV_EN);
  // Rewrite the frontmatter language line to the actual target language.
  return body.replace(/^lang: (de|en)$/m, `lang: ${lang}`);
}
