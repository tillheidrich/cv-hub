/**
 * Plain Markdown templates the user can download as a starter file. Matches
 * the server-side markdown-bridge format (see pdf-service/markdown.js) so a
 * filled-out template imports cleanly without parser warnings.
 *
 * Two variants exist:
 *   - cv:de / cv:en  → Lebenslauf / Resume
 *   - cl:de / cl:en  → Anschreiben / Cover Letter
 */

export type MdTemplateKind = 'cv' | 'cl';
export type MdTemplateLang = 'de' | 'en';

const CV_DE = `---
template: hamburg
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

## Weiteres
- Ehrenamt, Speaking-Engagements, Publikationen
- Zertifikate
`;

const CV_EN = `---
template: hamburg
lang: en
fontScale: 1.0
fontPairing: auto
pageMode: one
---

# First Last
**Job Title**

## Kontakt
- E-Mail: name@example.com
- Telefon: +1 555 123 4567
- Ort: Berlin
- Website: yourdomain.com
- LinkedIn: linkedin.com/in/your-handle

## Profil
Short summary, 2-3 sentences: who you are, your focus, what sets you apart.
Example: "Senior product designer with seven years in B2B SaaS. Focus on design systems, research-driven product work, and tight engineering collaboration."

## Berufserfahrung

### Current Role
Company · Location · 01/2023 – present
- Bullet 1: what you did (action + context + outcome/impact)
- Bullet 2: next responsibility with measurable outcome
- Bullet 3: relevant tools, methods, skills aligned with the target role

### Previous Role
Company · Location · 06/2020 – 12/2022
- Bullet 1
- Bullet 2

## Ausbildung

### Degree or Programme
University · Location · 2017 – 2020

## Skills

### Category 1 (e.g. Tech)
- Tool 1
- Tool 2

### Category 2 (e.g. Methods)
- Method 1
- Method 2

## Sprachen
- English — Native (5/5)
- German — B2 (3/5)
- French — A2 (2/5)

## Weiteres
- Volunteering, talks, publications
- Certifications
`;

const CL_DE = `---
doc: cover-letter
lang: de
template: hamburg
---

## Empfänger
- Firma: Acme GmbH
- Ansprechpartner: Frau Mustermann
- Adresse: Musterstraße 1, 20095 Hamburg

## Kopf
- Ort: Hamburg
- Datum: ${new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}

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

const CL_EN = `---
doc: cover-letter
lang: en
template: hamburg
---

## Empfänger
- Firma: Acme Ltd
- Ansprechpartner: Ms Smith
- Adresse: 1 Sample Street, London EC1A 1AA

## Kopf
- Ort: Berlin
- Datum: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

## Betreff
Application for [Position]

## Anrede
Dear Ms Smith,

## Einstieg
One or two sentences: why this role, why now. Direct opener, no clichés.

## Hauptteil
Three to five sentences: concrete stations from the CV that match the role. Echo bullets from your current position verbatim.

## Firmenbezug
Two to three sentences: what convinces you about the company — product, mission, team. Specific, not generic.

## Motivation
Two sentences: what you want to contribute.

## Abschluss
One sentence: interview invitation.

## Grußformel
Kind regards
Your name
`;

/** Full language union — FR/ES reuse the EN starter body (English section
 *  markers parse fine server-side) but the frontmatter `lang:` is stamped with
 *  the real language so the import writes to the correct variant instead of
 *  clobbering DE/EN. */
export type MdTemplateFullLang = 'de' | 'en' | 'fr' | 'es';

export function getMdTemplate(kind: MdTemplateKind, lang: MdTemplateFullLang): string {
  const body = kind === 'cl'
    ? (lang === 'de' ? CL_DE : CL_EN)
    : (lang === 'de' ? CV_DE : CV_EN);
  // Rewrite the frontmatter language line to the actual target language.
  return body.replace(/^lang: (de|en)$/m, `lang: ${lang}`);
}
