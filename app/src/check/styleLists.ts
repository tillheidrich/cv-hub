/**
 * Stilhinweise fürs Anschreiben: eine kleine, ausdrücklich begrenzte Liste.
 *
 * Das ist KEINE KI-Erkennung. Verlässliche KI-Erkennung gibt es nicht; OpenAI
 * hat seinen eigenen Klassifikator 2023 wegen geringer Treffsicherheit
 * zurückgezogen. Die Liste zeigt Wendungen, die in sehr vielen Anschreiben
 * stehen und deshalb wenig über die Person sagen. Jede Gruppe hat eine
 * Grundlage, die in der Oberfläche mitsteht:
 *
 *   floskel — Standard-Einstiege und -Anreden. Grundlage: Bundesagentur für
 *             Arbeit („Beginne besser nicht mit der Floskel ‚Hiermit bewerbe
 *             ich mich …'", Anrede mit Namen vorziehen); Harvard T.H. Chan
 *             School („addressed, when possible, to a specific individual").
 *   leer    — Eigenschaften ohne Beleg („teamfähig"). Grundlage: Bundes-
 *             agentur (keine Adjektive, die übertrieben wirken könnten) und
 *             Harvard („Emphasize your skills and experiences as they relate
 *             to the position").
 *   ki      — Wörter, die in generierten Texten auffällig oft stehen.
 *             Grundlage: Wikipedia „Signs of AI writing" (WikiProject AI
 *             Cleanup) für Englisch; für DE/FR/ES eine eigene, kurze
 *             Übertragung. Ausdrücklich nur ein Stilhinweis.
 *   fuell   — Füllwörter. Eigene Liste, ohne Studie dahinter, und so
 *             gekennzeichnet.
 *   konj    — Möglichkeitsform am Schluss („würde mich freuen"). Stilfrage,
 *             eigene Liste.
 *
 * Gesucht wird in der Sprache des Dokuments, nicht der Oberfläche.
 */
import type { Lang } from '../data/types';

export type StyleKind = 'floskel' | 'leer' | 'ki' | 'fuell' | 'konj';

export interface StylePattern { kind: StyleKind; re: RegExp }

const W = (s: string) => new RegExp(`(?<![\\p{L}])(?:${s})(?![\\p{L}])`, 'giu');

export const STYLE_PATTERNS: Record<Lang, StylePattern[]> = {
  de: [
    { kind: 'floskel', re: W('hiermit bewerbe ich mich|bewerbe ich mich hiermit|hiermit möchte ich mich|hiermit sende ich Ihnen') },
    { kind: 'floskel', re: W('mit großem Interesse|mit großer Begeisterung|mit großer Freude habe ich') },
    { kind: 'floskel', re: W('meine vollständigen Bewerbungsunterlagen füge ich bei|anbei erhalten Sie meine Bewerbungsunterlagen') },
    { kind: 'leer', re: W('teamfähig(?:e|er|en)?|teamfähigkeit|belastbar(?:e|er|en)?|belastbarkeit|kommunikationsstark(?:e|er|en)?|lösungsorientiert(?:e|er|en)?|zielstrebig(?:e|er|en)?|hoch ?motiviert(?:e|er|en)?|flexibel|engagiert(?:e|er|en)?|zuverlässig(?:e|er|en)?') },
    { kind: 'ki', re: W('Leidenschaft|leidenschaftlich(?:e|er|en)?|spannende(?:n)? Herausforderung(?:en)?|neue(?:n)? Herausforderung(?:en)?|wertvolle(?:n)? Beitrag|Mehrwert|Synergie(?:n)?|ganzheitlich(?:e|er|en)?|nahtlos(?:e|er|en)?|maßgeblich(?:e|er|en)?|darüber hinaus|in der heutigen(?: schnelllebigen)? Zeit|dynamische(?:n|m)? Umfeld|innovativ(?:e|er|en)?') },
    { kind: 'fuell', re: W('eigentlich|sozusagen|gewissermaßen|im Grunde(?: genommen)?|quasi|durchaus') },
    { kind: 'konj', re: W('würde (?:ich )?mich (?:sehr )?freuen|würde ich mich (?:sehr )?freuen|würde gerne|möchte gerne') },
  ],
  en: [
    { kind: 'floskel', re: W('I am writing to (?:apply|express)|I would like to apply|I am excited to apply|To whom it may concern|Dear Sir or Madam|Dear Sir/Madam') },
    { kind: 'floskel', re: W('please find (?:attached|enclosed) my|I have attached my full application') },
    { kind: 'leer', re: W('team player|hard[- ]working|detail[- ]oriented|self[- ]starter|results[- ]driven|highly motivated|go-getter|think outside the box|strong work ethic') },
    { kind: 'ki', re: W('delve|tapestry|testament|vibrant|pivotal|crucial|seamless(?:ly)?|leverag(?:e|ing)|synerg(?:y|ies)|fast-paced environment|I am thrilled|align(?:s)? with|showcas(?:e|ing)|foster(?:ing)?|landscape|passionate|passion for') },
    { kind: 'fuell', re: W('actually|basically|really|truly|honestly') },
    { kind: 'konj', re: W('I would be (?:delighted|honou?red|grateful)|I believe that I|I feel that I') },
  ],
  fr: [
    { kind: 'floskel', re: W("je me permets de vous (?:adresser|soumettre|proposer) ma candidature|suite à votre annonce|c'est avec (?:un grand|beaucoup d') ?intérêt|actuellement à la recherche de nouvelles opportunités") },
    { kind: 'floskel', re: W('vous trouverez ci-joint mon dossier de candidature') },
    { kind: 'leer', re: W("dynamique|motivée?|rigoureu(?:x|se)|polyvalente?|sérieu(?:x|se)|autonome|esprit d'équipe|force de proposition") },
    { kind: 'ki', re: W("valeur ajoutée|synergies?|passionnée?|passion pour|relever (?:de )?nouveaux défis|en constante évolution|contribuer activement|innovante?|incontournable") },
    { kind: 'fuell', re: W('vraiment|en effet|tout à fait|véritablement|réellement') },
    { kind: 'konj', re: W('je serais (?:ravie?|heureuse?) de') },
  ],
  es: [
    { kind: 'floskel', re: W('me dirijo a ustedes|por medio de la presente|con (?:gran|mucho) interés|a quien corresponda|estimados señores') },
    { kind: 'floskel', re: W('adjunto mi documentación completa|adjunto mi currículum para su consideración') },
    { kind: 'leer', re: W('proactiv[oa]|dinámic[oa]|trabajo en equipo|motivad[oa]|polivalente|orientad[oa] a resultados') },
    { kind: 'ki', re: W('aportar valor|sinergias?|apasionad[oa]|pasión por|nuevos retos|entorno dinámico|innovador(?:a)?|en el mundo actual|en constante evolución') },
    { kind: 'fuell', re: W('realmente|básicamente|en realidad|sin duda') },
    { kind: 'konj', re: W('me encantaría|me gustaría mucho') },
  ],
};

/** Anreden ohne Namen, je Sprache. */
export const GENERIC_SALUTATIONS = [
  'sehr geehrte damen und herren', 'liebe damen und herren',
  'dear hiring manager', 'dear sir or madam', 'dear sir/madam', 'to whom it may concern', 'dear recruiter',
  'madame, monsieur', 'madame monsieur', 'mesdames, messieurs',
  'estimados señores', 'a quien corresponda', 'estimado/a responsable',
];

/** Wörter, mit denen ein Satz „Ich-Anfang" ist. */
export const I_WORDS: Record<Lang, RegExp> = {
  de: /^(ich|mich|mir|mein|meine)\b/i,
  en: /^(i|my|me)\b/i,
  fr: /^(je|j'|mon|ma|mes)/i,
  es: /^(yo|mi|me)\b/i,
};

export interface StyleHit { kind: StyleKind | 'ich' | 'satz'; phrase: string; n?: number }

/** Alle Treffer in einem Text, je Wendung einmal (mit Anzahl). */
export function styleHits(text: string, lang: Lang): StyleHit[] {
  const out: StyleHit[] = [];
  const seen = new Map<string, StyleHit>();
  for (const p of STYLE_PATTERNS[lang] ?? STYLE_PATTERNS.de) {
    p.re.lastIndex = 0;
    for (const m of text.matchAll(p.re)) {
      const key = `${p.kind}:${m[0].toLowerCase()}`;
      const prev = seen.get(key);
      if (prev) { prev.n = (prev.n ?? 1) + 1; continue; }
      const hit: StyleHit = { kind: p.kind, phrase: m[0], n: 1 };
      seen.set(key, hit);
      out.push(hit);
    }
  }
  // Satzanfänge mit „Ich" (Harvard T.H. Chan: nicht jeden Satz so beginnen).
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 3);
  const iStarts = sentences.filter(s => I_WORDS[lang]?.test(s)).length;
  if (sentences.length >= 4 && iStarts >= 4 && iStarts / sentences.length >= 0.4) {
    out.push({ kind: 'ich', phrase: String(iStarts), n: sentences.length });
  }
  // Sehr lange Sätze (mehr als 35 Wörter).
  for (const s of sentences) {
    const n = s.split(/\s+/).length;
    if (n > 35) out.push({ kind: 'satz', phrase: s.length > 90 ? s.slice(0, 88) + '…' : s, n });
  }
  return out;
}
