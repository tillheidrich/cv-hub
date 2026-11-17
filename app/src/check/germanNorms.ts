/**
 * Was in einem Lebenslauf für Deutschland unüblich ist (17.11.2026,
 * internationale Fachkräfte, zuerst aus Indien).
 *
 * Gesucht wird nach Angaben, die in indischen (und manchen anderen)
 * Lebensläufen üblich sind, in deutschen aber nicht stehen. Grundlage:
 * Bundesagentur für Arbeit / ZAV, „Working and living in Germany" 01/2026
 * (Familienstand und Religion nicht nötig, Soft Skills ins Anschreiben) und
 * Make it in Germany, „Applying for a job". Keine erfundene Regel: Nur was
 * dort steht oder offensichtlich nichts mit der Stelle zu tun hat (Name des
 * Vaters, Kaste, Ausweisnummern), und das Gehalt, das in Deutschland im
 * Anschreiben als Jahresbrutto genannt wird, wenn die Anzeige danach fragt.
 *
 * Die Sätze dazu stehen in ui/i18n/pruefen.ts (`unusual`), angezeigt werden
 * sie in den Tipps (knowledge/context.ts, Grund „intl-unusual").
 * Der Import (import/textImport.ts) lässt dieselben Angaben gar nicht erst
 * in den Lebenslauf; hier geht es um Lebensläufe, die von Hand oder über
 * einen anderen Weg hineinkamen.
 */
import type { CVData } from '../data/types';

export type UnusualKind = 'declaration' | 'parents' | 'religion' | 'caste' | 'passport' | 'ctc';

const RULES: [UnusualKind, RegExp][] = [
  ['declaration', /(?<![\p{L}])(?:i|we)\s(?:do\s)?(?:hereby|solemnly)\s(?:\p{L}{1,12}\s)?(?:declare|affirm|certify)(?![\p{L}])|(?<![\p{L}])self[- ]declaration(?![\p{L}])/iu],
  ['parents', /(?<![\p{L}])(?:father|mother)(?:['’]?s)?\s(?:full\s)?(?:name|occupation)(?![\p{L}])|(?<![\p{L}])[sd]\/o\s\p{Lu}/iu],
  ['religion', /(?<![\p{L}])religion\s?:/iu],
  ['caste', /(?<![\p{L}])(?:sub-?)?caste(?![\p{L}])/iu],
  ['passport', /(?<![\p{L}])passport\s(?:no\.?|number|num)(?![\p{L}])|(?<![\p{L}])aadhaa?r(?![\p{L}])/iu],
  ['ctc', /(?<![\p{L}])ctc(?![\p{L}])|(?<![\p{L}])lakhs?(?![\p{L}])|\d\s?lpa(?![\p{L}])/iu],
];

/** Alle Texte des Lebenslaufs, ohne Beschriftungen und Fotos. */
function allText(cv: CVData): string {
  const out: string[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 6 || out.length > 4000) return;
    if (typeof v === 'string') { if (v.length < 4000 && !v.startsWith('data:')) out.push(v); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'labels' && k !== 'photo' && k !== 'photoOriginal' && k !== 'id') walk(x, depth + 1);
  };
  walk(cv, 0);
  return out.join('\n');
}

/** Welche in Deutschland unüblichen Angaben stehen im Lebenslauf? */
export function unusualForGermany(cv: CVData | undefined): UnusualKind[] {
  if (!cv) return [];
  const text = allText(cv);
  if (!text) return [];
  return RULES.filter(([, re]) => re.test(text)).map(([k]) => k);
}
