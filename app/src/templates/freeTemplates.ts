/**
 * Gratis-Vorlagen („Vorlagen-Staffel", 10.10.2026; greift
 * nur mit Verkauf und FREE_TIER_LIMITS). Die einzige Stelle im Code, die festlegt, welche Vorlagen ohne
 * Pass als gestaltetes PDF und HTML herauskommen.
 *
 * Ohne Pass gibt es das PDF des Lebenslaufs in diesen 10 Vorlagen und die
 * ATS-Fassung als PDF in JEDER Vorlage (export/atsPdfTemplate.ts setzt sie in
 * Zürich bzw. Schiefer, beide hier frei). Ansehen, Auswählen und Gestalten
 * gehen in allen Vorlagen. Die Grenze greift nur, wenn der Server sie meldet
 * (billing/freeTier.ts); selbst gehostet ist alles frei.
 *
 * Auswahl. Die Entscheidung nennt Espoo (Standard und Demo), Zürich, Helsinki,
 * Uppsala, Bamberg, Dublin, Schiefer und Weimar. Helsinki und Schiefer sind seit
 * dem 12.09.2026 aus der Auswahl genommen (`deprecated` in theme.ts: Helsinki
 * ist Espoo ohne Fotoplatz, Schiefer eine Farbvariante). Sie bleiben hier frei,
 * weil gespeicherte Profile sie tragen und Schiefer die ATS-Fassung mit Foto
 * setzt, zählen aber nicht zu den zehn, die man wählen kann. Nach der Regel der
 * Entscheidung („falls ein Name nicht existiert, nächstliegende einspaltige
 * nehmen") kommen für sie zwei einspaltige Vorlagen aus dem Bestand dazu, und
 * dazu die zwei, die die Entscheidung offen lässt:
 *
 *  - Lübeck: die Vorlage mit Kopfband und Foto in deutscher Tradition
 *    (Nachweise und Führerschein vorn, Source Serif/Sans, „Für Portale
 *    geeignet"). Das Kopfband ist die Form, die viele hier erwarten.
 *  - Bergen: die moderne mit Akzent (farbiges Kopfband, Archivo, Foto rund,
 *    „Für Portale geeignet"). Eigene Schriftpaarung, die sonst in der Liste
 *    fehlt.
 *  - Linz für Schiefer: einspaltig mit abgerundetem Foto wie Schiefer, Lora mit
 *    Source Sans (eine weitere eigene Paarung), „Gut für Portale". Ordnet die
 *    Kenntnisse vorn ein, für den Quereinstieg.
 *  - Freiburg für Helsinki: Helsinkis Form ist mit Espoo schon frei (ohne Foto
 *    dieselbe Seite). Freiburg ergänzt stattdessen den Berufseinstieg
 *    (Ausbildung zuerst, Profil im Kasten), einspaltig, „Gut für Portale". Wer
 *    gerade anfängt, hat am wenigsten Geld für einen Pass.
 *
 * Damit: acht einspaltige, zwei mit Kopfband; fünf mit Foto, drei ohne Fotofeld
 * (Zürich, Uppsala, Dublin); sieben Schriftpaarungen. Keine Vorlage mit
 * Seitenspalte ist frei. Die ATS-Fassung jeder Vorlage bleibt es trotzdem.
 */
import { PICKABLE_THEMES, getTheme, resolveThemeId, type ResumeTheme } from './theme';
import { atsLevelForLayout } from './atsScore';

/** Die zehn wählbaren Gratis-Vorlagen, in der Reihenfolge der Entscheidung. */
export const FREE_TEMPLATE_IDS: readonly string[] = [
  'espoo', 'zuerich', 'uppsala', 'bamberg', 'dublin', 'weimar',
  'luebeck', 'bergen', 'linz', 'freiburg',
];

/** Stillgelegte, aber renderbare Vorlagen, die ebenfalls frei sind (gespeicherte
 *  Profile, ATS-Fassung mit Foto). Erscheinen in keiner Auswahl. */
const FREE_LEGACY_IDS: readonly string[] = ['helsinki', 'schiefer'];

const FREE = new Set<string>([...FREE_TEMPLATE_IDS, ...FREE_LEGACY_IDS]);

/** Gehört das gestaltete PDF/HTML dieser Vorlage zum kostenlosen Teil?
 *  Alte Kennungen (onyx → schiefer) werden aufgelöst. Die Startseiten-Galerie
 *  (landing/Gallery.tsx) liest genau diese Funktion. */
export function isFreeTemplate(id: string | null | undefined): boolean {
  if (!id) return false;
  return FREE.has(resolveThemeId(id));
}

const hasPhoto = (t: ResumeTheme) => t.photo !== 'none';

/** Ähnlichkeit zweier Vorlagen: Aufbau zuerst (eine Spalte, Kopfband,
 *  zentrierter Kopf), dann Fotofeld, Marke für Portale, Schrift, Art. */
function similarity(a: ResumeTheme, b: ResumeTheme): number {
  let s = 0;
  if (a.layout === b.layout) s += 6;
  else if (atsLevelForLayout(a.layout) === atsLevelForLayout(b.layout)) s += 2;
  // Eine Seitenspalte gibt es frei nicht; die nächste Form ist das Kopfband
  // (Name und Kontakt auf einer Fläche, darunter der Werdegang).
  if ((a.layout === 'sidebar-left' || a.layout === 'sidebar-right') && b.layout === 'header-band') s += 3;
  if (a.layout === 'top-centered' && b.head === 'center') s += 3;
  if (hasPhoto(a) === hasPhoto(b)) s += 5;
  if (a.defaultPairing === b.defaultPairing) s += 3;
  else if (a.defaultPairing.split('-')[0] === b.defaultPairing.split('-')[0]) s += 1;
  if (a.category === b.category) s += 2;
  if (a.heading === b.heading) s += 1;
  if (a.panelFill === false && b.layout === 'single-column') s += 1;
  return s;
}

/**
 * Die nächstliegende Gratis-Vorlage zu `id` (für „Gratis als PDF in Vorlage
 * X" im Freischalt-Fenster). Ist `id` selbst frei, kommt sie zurück. Bei
 * Gleichstand gilt die Reihenfolge von FREE_TEMPLATE_IDS (Espoo zuerst).
 */
export function nearestFreeTemplate(id: string): string {
  const wanted = resolveThemeId(id);
  if (FREE_TEMPLATE_IDS.includes(wanted)) return wanted;
  const src = getTheme(wanted);
  let best = FREE_TEMPLATE_IDS[0];
  let bestScore = -1;
  for (const fid of FREE_TEMPLATE_IDS) {
    const sc = similarity(src, getTheme(fid));
    if (sc > bestScore) { best = fid; bestScore = sc; }
  }
  return best;
}

/** Zahl der Vorlagen, die zum Pass gehören (für Texte wie „30 weitere"). */
export function passTemplateCount(): number {
  return PICKABLE_THEMES.filter(t => !isFreeTemplate(t.id)).length;
}
