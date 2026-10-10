/**
 * Welche Tipps gerade zu den Unterlagen passen.
 *
 * Bewusst wenige, einfache Regeln: was fehlt (Profil, Kenntnisse), was sich
 * zählen lässt (Zahlen in den Punkten, Lücken über sechs Monate, siehe
 * „Hidden Workers"), was nicht zusammenpasst (englischer Lebenslauf mit Foto
 * oder Geburtsdatum) und was im Anschreiben noch vom Muster stammt.
 * Höchstens drei Hinweise, damit es eine Auswahl bleibt.
 */
import type { CVData, CoverLetterData } from '../data/types';
import type { TipId, TipTab } from './types';
import { DEFAULT_COVER_LETTERS } from '../data/storage';
import { styleHits } from '../check/styleLists';
import { fold } from '../check/keywords';

export type ReasonId = 'no-profile' | 'no-numbers' | 'gap' | 'intl-photo' | 'no-skills' | 'cover-open' | 'cover-sample' | 'cover-floskel';

export interface ContextHint { tab: TipTab; tip: TipId; reason: ReasonId }

const NOW = /heute|present|now|today|current|aujourd|actuel|actualidad|hoy|presente/i;

/** Monat als fortlaufende Zahl, `null` wenn nicht lesbar. */
function month(raw: string | undefined, isEnd: boolean): number | null {
  const s = (raw || '').trim();
  if (!s) return null;
  if (NOW.test(s)) { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); }
  let m = s.match(/(\d{1,2})\s*[./-]\s*(\d{4})/);
  if (m) return +m[2] * 12 + (+m[1] - 1);
  m = s.match(/(\d{4})\s*[./-]\s*(\d{1,2})/);
  if (m) return +m[1] * 12 + (+m[2] - 1);
  m = s.match(/(\d{4})/);
  if (m) return +m[1] * 12 + (isEnd ? 11 : 0);
  return null;
}

/** Größte Lücke zwischen zwei Stationen in Monaten (Berufserfahrung und Ausbildung). */
export function largestGap(cv: CVData): number {
  const spans: [number, number][] = [];
  for (const e of [...(cv.experience || []).filter(x => !x.hidden), ...(cv.education || [])]) {
    const a = month(e.start, false);
    const b = month(e.end, true) ?? a;
    if (a != null && b != null) spans.push([a, Math.max(a, b)]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  let gap = 0;
  let reach = spans[0]?.[1] ?? 0;
  for (const [a, b] of spans.slice(1)) {
    if (a - reach - 1 > gap) gap = a - reach - 1;
    reach = Math.max(reach, b);
  }
  return gap;
}

export function contextHints(cv: CVData | undefined, cl: CoverLetterData | undefined, docType: 'resume' | 'cover' | undefined): ContextHint[] {
  const out: ContextHint[] = [];
  if (!cv) return out;
  const lang = cv.labels?.lang ?? 'de';

  if (docType === 'cover' && cl) {
    const samples = new Set<string>();
    for (const l of Object.values(DEFAULT_COVER_LETTERS)) for (const k of ['intro', 'mainBody', 'companyReference', 'motivation', 'closing'] as const) samples.add(fold(l[k]));
    const usesSample = (['intro', 'mainBody', 'companyReference', 'motivation', 'closing'] as const).some(k => cl[k] && samples.has(fold(cl[k])));
    if (usesSample) out.push({ tab: 'letter', tip: 'letter-opening', reason: 'cover-sample' });
    else if (styleHits(cl.intro || '', lang).some(h => h.kind === 'floskel')) out.push({ tab: 'letter', tip: 'letter-opening', reason: 'cover-floskel' });
    out.push({ tab: 'letter', tip: 'letter-structure', reason: 'cover-open' });
  }

  if (!cv.profile?.text?.trim()) out.push({ tab: 'cv', tip: 'profile', reason: 'no-profile' });
  const bullets = (cv.experience || []).filter(e => !e.hidden).flatMap(e => e.bullets || []).filter(b => b.trim());
  if (bullets.length >= 3 && !bullets.some(b => /\d/.test(b))) out.push({ tab: 'cv', tip: 'impact', reason: 'no-numbers' });
  if (largestGap(cv) > 6) out.push({ tab: 'cv', tip: 'gaps', reason: 'gap' });
  if (lang === 'en' && (cv.personal?.photo || cv.personal?.birthDate)) out.push({ tab: 'cv', tip: 'photo', reason: 'intl-photo' });
  if (!(cv.skillGroups || []).some(g => (g.items || []).some(i => i.trim()))) out.push({ tab: 'cv', tip: 'skills', reason: 'no-skills' });

  return out.slice(0, 3);
}
