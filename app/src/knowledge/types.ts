/** Aufbau der Tipps (knowledge/content/<sprache>.ts). */
import type { SourceId } from './sources';
import type { MagazinSlug } from './magazin';

export type TipTab = 'cv' | 'letter' | 'countries' | 'checklist' | 'prompts';

export type TipId =
  | 'profile' | 'impact' | 'skills' | 'gaps' | 'photo' | 'length' | 'filename' | 'ats' | 'ai' | 'more'
  | 'letter-structure' | 'letter-subject' | 'letter-opening' | 'letter-body' | 'letter-closing' | 'letter-ai';

export interface Tip {
  id: TipId;
  title: string;
  /** Absätze, getrennt durch eine Leerzeile. Der erste ist immer sichtbar. */
  body: string;
  /** Selbst formuliertes Beispiel, keine fremden Texte. */
  before?: string;
  after?: string;
  sources?: SourceId[];
  magazin?: MagazinSlug[];
}

export interface Prompt { id: string; title: string; prompt: string; note?: string }

export interface Country {
  code: 'DE' | 'AT' | 'CH' | 'UK' | 'US';
  name: string;
  /** [Merkmal, Angabe] — Foto, persönliche Daten, Länge, Anschreiben … */
  rows: [string, string][];
  /** So stellt man es in diesem Werkzeug ein. */
  tool: string;
  sources: SourceId[];
}

export interface TipsContent {
  cvIntro: string;
  cv: Tip[];
  letterIntro: string;
  letter: Tip[];
  countriesIntro: string;
  countries: Country[];
  checklistIntro: string;
  checklist: { id: string; text: string }[];
  promptsIntro: string;
  prompts: Prompt[];
}
