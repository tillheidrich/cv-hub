// ── Was muss weg, damit es auf die Seite passt? ─────────────────────────────
//
// Bisher meldete das Werkzeug „ÜBERLAUF" und riet, „ein paar Stichpunkte zu
// streichen". Das ist richtig und nutzlos: Es sagt weder, wieviel zu viel ist,
// noch wo. Wer seinen Lebenslauf auf eine Seite bringen will, braucht genau
// diese zwei Angaben — und zwar in Zeichen, nicht in Pixeln.
//
// Gerechnet wird aus zwei gemessenen Größen: der Zeilenzahl, die nicht mehr
// passt, und wie viele Zeichen im gesetzten Dokument auf eine Zeile gehen.
// Beides kommt aus dem Messlauf, nicht aus einer Annahme über Schriftbreiten.
//
// Die Reihenfolge der Vorschläge ist eine inhaltliche Setzung, keine
// Rechnung: zuerst geht, was am wenigsten trägt.

import type { CVData } from '../data/types';

export interface CutSuggestion {
  /** Was gestrichen oder gekürzt würde, in Klartext. */
  label: string;
  /** Wie viele Zeilen das frei macht. */
  lines: number;
  /** Wie viele Zeichen das sind — die Größe, in der man Text kürzt. */
  chars: number;
  /** Formularbereich, in dem es steht. */
  tab: 'profil' | 'erfahrung' | 'bildung' | 'skills' | 'sprachen';
}

const linesFor = (chars: number, cpl: number) => Math.max(1, Math.round(chars / Math.max(20, cpl)));

/**
 * Vorschläge, bis das Defizit gedeckt ist.
 *
 * @param deficitLines  wie viele Zeilen nicht mehr passen (gemessen)
 * @param cpl           Zeichen je Zeile im gesetzten Dokument (gemessen)
 */
export function suggestCuts(data: CVData, deficitLines: number, cpl: number): {
  cuts: CutSuggestion[];
  /** Summe der vorgeschlagenen Zeilen — deckt sie das Defizit? */
  covered: number;
  deficitChars: number;
  /** Auch alle Kürzungen zusammen reichen nicht: dann ist nicht der Text zu
   *  lang, sondern das Layout zu teuer. */
  hopeless: boolean;
} {
  const cand: CutSuggestion[] = [];

  // 1. „Weiteres" — der Abschnitt, den niemand vermisst, wenn er fehlt.
  const add = data.additionalExperience ?? [];
  if (add.length) {
    const chars = add.reduce((n, s) => n + s.length, 0);
    cand.push({ label: `Abschnitt „${data.labels.sections.additional}" (${add.length} Einträge)`, chars, lines: linesFor(chars, cpl) + 1, tab: 'skills' });
  }

  // 2. Skill-Gruppen ab der dritten: die ersten zwei stehen in der
  //    Seitenspalte und kosten die Hauptspalte nichts.
  data.skillGroups.slice(2).forEach(g => {
    const chars = g.items.reduce((n, s) => n + s.length, 0);
    cand.push({ label: `Skill-Gruppe „${g.label}" (${g.items.length} Einträge)`, chars, lines: g.items.length + 1, tab: 'skills' });
  });

  // 3. Notizen an Ausbildungsstationen — Beiwerk, kein Nachweis.
  data.education.forEach(e => {
    if (!e.notes?.trim()) return;
    cand.push({ label: `Notiz bei „${e.degree}"`, chars: e.notes.length, lines: linesFor(e.notes.length, cpl), tab: 'bildung' });
  });

  // 4. Die längsten Stichpunkte der ÄLTESTEN Stationen zuerst: was zwölf Jahre
  //    zurückliegt, trägt die Bewerbung am wenigsten.
  const bullets: CutSuggestion[] = [];
  [...data.experience].reverse().forEach((e, revIdx) => {
    const sorted = e.bullets.map((b, i) => ({ b, i })).sort((x, y) => y.b.length - x.b.length);
    sorted.slice(0, 2).forEach(({ b, i }) => {
      if (b.length < 40) return;
      bullets.push({
        label: `Stichpunkt ${i + 1} bei „${e.company || e.role}"`,
        chars: b.length, lines: linesFor(b.length, cpl),
        tab: 'erfahrung',
      });
    });
    void revIdx;
  });
  cand.push(...bullets);

  // 5. Profiltext auf die Hälfte — zuletzt, weil er als Einstieg am meisten
  //    wirkt. Er steht hier trotzdem: bei sehr langen Profilen ist er der
  //    größte Einzelposten.
  const pt = data.profile.text.trim();
  if (pt.length > 260) {
    const save = pt.length - 240;
    cand.push({ label: `Profiltext auf rund 240 Zeichen kürzen (heute ${pt.length})`, chars: save, lines: linesFor(save, cpl), tab: 'profil' });
  }

  /* Höchstens sechs Vorschläge. Eine Liste mit elf Einträgen beantwortet die
   * Frage „was mache ich jetzt" nicht mehr — sie stellt sie neu. */
  const MAX = 6;
  const cuts: CutSuggestion[] = [];
  let covered = 0;
  for (const c of cand) {
    if (covered >= deficitLines || cuts.length >= MAX) break;
    cuts.push(c);
    covered += c.lines;
  }
  /* Reicht ALLES nicht, ist Kürzen die falsche Antwort: dann ist der Text
   * schlicht zu lang für dieses Layout. Das gehört gesagt, statt eine
   * Streichliste vorzulegen, die nicht trägt. */
  const alles = cand.reduce((n, c) => n + c.lines, 0);
  return {
    cuts, covered,
    deficitChars: Math.round(deficitLines * cpl),
    hopeless: alles < deficitLines,
  };
}
