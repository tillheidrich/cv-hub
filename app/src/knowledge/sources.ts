/**
 * Quellen, auf die sich Tipps und Prüfungen stützen — an einer Stelle, damit
 * dieselbe Adresse nicht in vier Sprachfassungen auseinanderläuft.
 *
 * Bewertung (Stand 10.10.2026, von Hand geprüft):
 *   ba-*        Bundesagentur für Arbeit — Behörde, verkauft nichts.
 *   ads         Antidiskriminierungsstelle des Bundes — Behörde.
 *   ams         Arbeitsmarktservice Österreich — Behörde.
 *   biz-bern    Berufsberatung Kanton Bern (BIZ) — Behörde; Folien eines
 *               Kurses, keine Verordnung.
 *   ncs         National Careers Service (UK) — Behörde.
 *   tfl         Transport for London — öffentlicher Arbeitgeber, eigene
 *               Bewerbungshinweise.
 *   harvard-*   Karriere-Dienste der Harvard-Fakultäten — Hochschule.
 *   hbs-hidden  Harvard Business School / Accenture, „Hidden Workers" (2021),
 *               Befragung von 2.275 Führungskräften und 8.720 Beschäftigten in
 *               USA, Großbritannien und Deutschland.
 *   openai      OpenAI, Hinweis zur Rücknahme des eigenen KI-Text-Erkenners.
 *   wiki-ai     Wikipedia, „Signs of AI writing" (WikiProject AI Cleanup) —
 *               Sammlung von Beobachtungen, keine Studie.
 *   coe-cefr    Europarat, Gemeinsamer Europäischer Referenzrahmen.
 */
export interface Source { label: string; url: string; checked: string }

export const SOURCES = {
  'ba-lebenslauf': { label: 'Bundesagentur für Arbeit: Den perfekten Lebenslauf erstellen', url: 'https://www.arbeitsagentur.de/bildung/bewerbung/lebenslauf', checked: '09/2026' },
  'ba-arbeitsblatt': { label: 'Bundesagentur für Arbeit: Arbeitsblatt „So sollte ein Lebenslauf aussehen"', url: 'https://www.arbeitsagentur.de/bildung/datei/arbeitsblatt-so-sollte-lebenslauf-aussehen_ba022063.pdf', checked: '09/2026' },
  'ba-anschreiben': { label: 'Bundesagentur für Arbeit: Das Anschreiben', url: 'https://www.arbeitsagentur.de/bildung/bewerbung/anschreiben', checked: '10/2026' },
  'ba-checkliste': { label: 'Bundesagentur für Arbeit: Checkliste Bewerbungsunterlagen', url: 'https://www.arbeitsagentur.de/bildung/datei/checkliste-bewerbungsunterlagen_ba021543.pdf', checked: '10/2026' },
  'ads': { label: 'Antidiskriminierungsstelle des Bundes: Was Arbeitgeber fragen (dürfen)', url: 'https://www.antidiskriminierungsstelle.de/SharedDocs/downloads/DE/publikationen/Expertisen/was_arbeitgeber_fragen_duerfen.pdf', checked: '09/2026' },
  'ams': { label: 'AMS Österreich: Bewerbungsunterlagen', url: 'https://www.ams.at/_docs/001_bewerbungsunterlagen.pdf', checked: '10/2026' },
  'biz-bern': { label: 'BIZ Kanton Bern: Bewerbungsworkshop (Kursunterlagen)', url: 'https://www.biz.bkd.be.ch/content/dam/biz_bkd/dokumente/de/veranstaltungen/kursunterlagen/praesentation-bewerbungsworkshop-fuer-migrantinnen-und-migranten.pdf', checked: '10/2026' },
  'ncs': { label: 'National Careers Service (UK): CV sections', url: 'https://nationalcareers.service.gov.uk/careers-advice/cv-sections', checked: '10/2026' },
  'tfl': { label: 'Transport for London: Writing a CV and cover letter', url: 'https://tfl.gov.uk/corporate/careers/writing-a-cv-and-cover-letter', checked: '10/2026' },
  'harvard-bullets': { label: 'Harvard College: Resume Template (bullet points)', url: 'https://careerservices.fas.harvard.edu/resources/bullet-point-resume-template/', checked: '09/2026' },
  'harvard-resume': { label: 'Harvard FAS Career Services: Create a Strong Resume', url: 'https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/', checked: '10/2026' },
  'harvard-ai': { label: 'Harvard FAS Career Services: AI for Resumes and Cover Letters', url: 'https://careerservices.fas.harvard.edu/ai-resumes-and-cover-letters/', checked: '09/2026' },
  'harvard-chan-cl': { label: 'Harvard T.H. Chan School: Cover letter writing guide', url: 'https://www.hsph.harvard.edu/wp-content/uploads/sites/36/2016/06/Cover-letter-writing-guide-Feb-25-2016.pdf', checked: '10/2026' },
  'hbs-hidden': { label: 'Harvard Business School / Accenture: Hidden Workers, Untapped Talent (2021)', url: 'https://www.hbs.edu/managing-the-future-of-work/research/hidden-workers-untapped-talent', checked: '10/2026' },
  'openai': { label: 'OpenAI: New AI classifier for indicating AI-written text (Hinweis vom 20.07.2023)', url: 'https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/', checked: '10/2026' },
  'wiki-ai': { label: 'Wikipedia: Signs of AI writing', url: 'https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing', checked: '10/2026' },
  'coe-cefr': { label: 'Europarat: Gemeinsamer Europäischer Referenzrahmen für Sprachen', url: 'https://www.coe.int/en/web/common-european-framework-reference-languages', checked: '10/2026' },
} satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
