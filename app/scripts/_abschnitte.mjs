// Erwartete Inhalte der Testperson `abschnitte` (src/dev/personas.ts) — in der
// Reihenfolge, in der sie im Textstrom stehen müssen. Gemeinsam benutzt von
// sectionscheck.mjs (PDF) und docxsweep.mjs (Word).
//
// Datumsangaben fehlen absichtlich: Tabellarische Vorlagen setzen das Datum
// VOR den Titel, die übrigen dahinter. Beides ist richtig.
export const ABSCHNITT_MARKEN = [
  // Projekte
  'Relaunch Kundenportal', 'Projektleitung', 'example.org/portal-relaunch',
  'Neuaufbau des Kundenportals für 40.000 Nutzer, barrierefrei nach WCAG 2.2.',
  'Ladezeit von 4,1 auf 1,3 Sekunden gesenkt', 'Supportanfragen um ein Drittel reduziert',
  'Wissensdatenbank Werkstatt', 'Einführung in drei Filialen begleitet',
  // Zertifikate
  'Scrum Master PSM I', 'Scrum.org', 'PSM-123456',
  'Datenschutzbeauftragter TÜV', 'TÜV Nord Akademie', 'example.org/zertifikat/42',
  // Ehrenamt
  'Jugendtrainerin Handball', 'TSV Musterstadt', 'Betreuung von zwei Mannschaften mit 30 Kindern',
  // Publikationen
  'Digitale Werkstattakte im Mittelstand', 'Fachverlag Handwerk', 'example.org/artikel',
  'Praxisbeitrag über papierlose Auftragsabwicklung.',
  // Freie Abschnitte
  'Interessen', 'Langstreckenlauf', 'Analoge Fotografie',
  'Auszeichnungen', 'Innovationspreis Handwerk', 'Handwerkskammer Hamburg',
  'Für das digitale Aufmaßverfahren.', 'Nominiert für den Ausbildungspreis 2022.',
];

/** Überschriften der festen Abschnitte (deutsche Vorgabe), in Reihenfolge. */
export const ABSCHNITT_TITEL = ['Projekte', 'Zertifikate', 'Ehrenamt', 'Publikationen'];

/* Seit 10.10.2026 schlagen einige Vorlagen eine eigene Reihenfolge vor
 * (`mainOrder` in theme.ts: Lübeck Zertifikate zuerst, Valencia Projekte,
 * Tallinn und Graz Publikationen vor dem Ehrenamt). Die Marken sind deshalb
 * nach Abschnitt gruppiert; `markenFuer(reihenfolge)` stellt sie in die
 * Reihenfolge, die die Vorlage tatsächlich setzt. */
const GRUPPEN = {
  projects: ABSCHNITT_MARKEN.slice(0, 8),
  certificates: ABSCHNITT_MARKEN.slice(8, 14),
  volunteering: ABSCHNITT_MARKEN.slice(14, 17),
  publications: ABSCHNITT_MARKEN.slice(17, 21),
  custom: ABSCHNITT_MARKEN.slice(21),
};
const TITEL = { projects: 'Projekte', certificates: 'Zertifikate', volunteering: 'Ehrenamt', publications: 'Publikationen' };
const reihe = order => (order || Object.keys(GRUPPEN)).filter(k => k in GRUPPEN);
export function markenFuer(order) { return reihe(order).flatMap(k => GRUPPEN[k]); }
export function titelFuer(order) { return reihe(order).filter(k => k in TITEL).map(k => TITEL[k]); }

const flach = s => s.replace(/\s+/g, ' ').toLowerCase();

/**
 * Sucht die Marken der Reihe nach im Text. Liefert die fehlenden und die
 * nicht in Reihenfolge gefundenen.
 */
export function pruefeReihenfolge(text, marken = ABSCHNITT_MARKEN) {
  const t = flach(text);
  const fehlt = [];
  const falsch = [];
  let pos = 0;
  for (const m of marken) {
    const k = flach(m);
    const ab = t.indexOf(k, pos);
    if (ab >= 0) { pos = ab + k.length; continue; }
    if (t.includes(k)) falsch.push(m); else fehlt.push(m);
  }
  return { fehlt, falsch };
}
