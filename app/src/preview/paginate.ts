// ── Umbruch-Engine ──────────────────────────────────────────────────────────
// Vorher wurde der Inhalt stumpf auf A4-Höhe zerschnitten — mitten im Satz,
// mitten im Job-Eintrag. Hier wird stattdessen auf BLOCKGRENZEN umgebrochen.
//
// Zwei Regeln tragen das Ganze:
//   • keep-with-next verkettet Blöcke, die zusammen bleiben müssen
//     (Sektionstitel + erster Eintrag, Eintragskopf + erster Stichpunkt).
//     Aufeinanderfolgende verkettete Blöcke bilden ein „Atom".
//   • Ein Atom wandert immer komplett auf die nächste Seite. Innerhalb einer
//     Position darf zwischen zwei Stichpunkten gebrochen werden — ganze
//     Einträge unteilbar zu machen erzeugt Löcher am Seitenende.

export interface MeasuredBlock {
  id: string;
  /** gemessene Höhe in px */
  height: number;
  /** Abstand nach oben, wenn der Block nicht der erste auf der Seite ist */
  gap: number;
  keepWithNext?: boolean;
  breakBefore?: boolean;
  /** Sektion — nur für die Witwen-Nachbesserung */
  section?: string;
  /** Eintrags-ID (Kopf und Stichpunkte einer Position teilen sie sich) */
  entry?: string;
}

export interface PaginationResult {
  /** Block-IDs je Seite */
  pages: string[][];
  /** Wie viele px passen nicht mehr in `maxPages`? 0 = alles untergebracht. */
  overflowPx: number;
  /** Füllgrad der letzten Seite (0–1) — für den „Seite 2 ist fast leer"-Hinweis */
  lastPageFill: number;
}

interface Atom {
  ids: string[];
  height: number;
  /** Abstand vor dem Atom, wenn es nicht am Seitenanfang steht */
  gap: number;
  breakBefore: boolean;
  entry?: string;
}

function toAtoms(blocks: MeasuredBlock[]): Atom[] {
  const atoms: Atom[] = [];
  let cur: Atom | null = null;
  for (const b of blocks) {
    if (cur) {
      // Innerhalb eines Atoms zählt der Gap zur Atomhöhe.
      cur.ids.push(b.id);
      cur.height += b.gap + b.height;
      cur.entry = cur.entry ?? b.entry;
      if (!b.keepWithNext) { atoms.push(cur); cur = null; }
      continue;
    }
    const atom: Atom = { ids: [b.id], height: b.height, gap: b.gap, breakBefore: !!b.breakBefore, entry: b.entry };
    if (b.keepWithNext) cur = atom;
    else atoms.push(atom);
  }
  if (cur) atoms.push(cur);
  return atoms;
}

/**
 * Verteilt die Blöcke auf Seiten.
 *
 * @param capacities Nutzbare Höhe je Seite in px. Der letzte Wert gilt für
 *                   alle weiteren Seiten (Seite 1 hat wegen des Kopfbereichs
 *                   fast immer weniger Platz als die Folgeseiten).
 * @param maxPages   Harte Obergrenze. Was darüber hinausgeht, wird als
 *                   `overflowPx` gemeldet, statt still abgeschnitten zu werden.
 */
export function paginate(blocks: MeasuredBlock[], capacities: number[], maxPages = 3): PaginationResult {
  const capAt = (i: number) => capacities[Math.min(i, capacities.length - 1)] || 1;
  const atoms = toAtoms(blocks);

  const pages: string[][] = [];
  const fills: number[] = [];
  let cur: string[] = [];
  let used = 0;
  let pageIndex = 0;
  let overflowPx = 0;

  const flush = () => {
    pages.push(cur);
    fills.push(used / capAt(pageIndex));
    cur = [];
    used = 0;
    pageIndex++;
  };

  for (const atom of atoms) {
    const cost = (cur.length ? atom.gap : 0) + atom.height;
    const cap = capAt(pageIndex);
    const mustBreak = atom.breakBefore && cur.length > 0;

    if (!mustBreak && used + cost <= cap) {
      cur.push(...atom.ids);
      used += cost;
      continue;
    }

    // Passt nicht mehr — nächste Seite. Ist die letzte erlaubte Seite schon
    // voll, wird der Rest als Überlauf gemeldet (und trotzdem gerendert, damit
    // nichts unsichtbar verschwindet).
    if (pageIndex + 1 >= maxPages) {
      if (cur.length === 0) { cur.push(...atom.ids); used += atom.height; continue; }
      overflowPx += cost;
      cur.push(...atom.ids);
      used += cost;
      continue;
    }

    if (cur.length) flush();
    // Ein einzelnes Atom, das höher ist als eine ganze Seite (sehr langer
    // Fließtext ohne Umbruchpunkt), bekommt seine Seite und läuft dort über.
    cur.push(...atom.ids);
    used += atom.height;
  }
  flush();

  return {
    pages,
    overflowPx,
    lastPageFill: fills[fills.length - 1] ?? 0,
  };
}

/**
 * Wie viel Verdichtung braucht es, damit der Inhalt auf `targetPages` passt?
 * Klassische Bisektion über den Verdichtungsregler — der Aufrufer misst nach
 * jedem Schritt neu, weil sich Zeilenumbrüche nicht linear verhalten.
 */
export function nextCondense(lo: number, hi: number): number {
  return (lo + hi) / 2;
}

/** Ist die letzte Seite so leer, dass sich Verdichten lohnt? */
export function isRunt(res: PaginationResult): boolean {
  return res.pages.length > 1 && res.lastPageFill < 0.25;
}
