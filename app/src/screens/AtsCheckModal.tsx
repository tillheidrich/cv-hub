import { useState, useMemo } from 'react';
import type { CVData, CoverLetterData } from '../data/types';
import { COLORS as C, FONTS as F, BORDER as B, TYPE } from '../ui/tokens';

interface Props {
  data: CVData;
  coverLetter?: CoverLetterData;
  onClose: () => void;
}

/**
 * ATS-Check: two tools an applicant can use to see their resume the way an
 * Applicant Tracking System does — before they hit "Apply".
 *
 *   Tab 1 — Notepad-Vorschau:
 *     The resume rendered as plain text in the reading order an ATS parser
 *     would produce. If contact info is missing, sections are scrambled, or
 *     a bullet runs into the next section, the user sees it here.
 *
 *   Tab 2 — Keyword-Match:
 *     Paste a job description; the tool surfaces which hard skills from the
 *     posting appear verbatim in the CV (green) and which are missing (red).
 *     No AI — string matching against a hand-tuned stoplist.
 *
 * Tip from the HR-recruiter Threads post: ATS doesn't understand synonyms.
 * If the posting says "Microsoft Excel" your CV must say "Microsoft Excel",
 * not "Microsoft Office". This tool makes that gap visible.
 */
export default function AtsCheckModal({ data, coverLetter, onClose }: Props) {
  const [tab, setTab] = useState<'notepad' | 'keywords'>('notepad');

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(28,25,23,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={stop} style={{ background: C.paper, border: B.inkStrong, width: '100%', maxWidth: '820px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 28px 18px', borderBottom: B.hairline }}>
          <div style={{ ...TYPE.micromono, color: C.gold, marginBottom: '8px' }}>ATS · APPLICANT TRACKING SYSTEM</div>
          <div style={{ fontFamily: F.display, fontSize: '30px', fontWeight: 400, color: C.ink, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '14px' }}>
            So sieht eine Maschine deinen <em style={{ fontStyle: 'italic', color: C.gold }}>Lebenslauf.</em>
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            {(['notepad', 'keywords'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                style={{
                  padding: '4px 2px', background: 'transparent', border: 'none',
                  borderBottom: tab === t ? `2px solid ${C.ink}` : '2px solid transparent',
                  fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: tab === t ? C.ink : C.fade,
                  cursor: 'pointer', fontFamily: F.ui,
                }}>
                {t === 'notepad' ? 'Notepad-Vorschau' : 'Keyword-Match'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {tab === 'notepad' ? <NotepadView data={data} coverLetter={coverLetter} /> : <KeywordMatchView data={data} />}
        </div>

        <div style={{ padding: '14px 28px', borderTop: B.hairline, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '11px 22px', background: C.ink, color: C.paper, border: 'none', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: F.ui }}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: Notepad-Vorschau ─────────────────────────────────────────────────

function NotepadView({ data, coverLetter }: { data: CVData; coverLetter?: CoverLetterData }) {
  void coverLetter; // currently CV-only — cover letter is plain prose anyway

  const text = useMemo(() => buildNotepadText(data), [data]);

  const issues = useMemo(() => {
    const out: string[] = [];
    const p = data.personal;
    if (!p.email) out.push('E-Mail fehlt — ATS-Parser brauchen sie für den Pflicht-Eintrag „Kontaktdaten".');
    if (!p.phone) out.push('Telefon fehlt — ATS-Filter werfen Bewerbungen ohne Telefonnummer oft direkt aus.');
    if (!p.name) out.push('Name fehlt — ohne Name kein Match auf den Pflicht-Eintrag „Vor- und Nachname".');
    if (!data.experience.some(e => !e.hidden)) out.push('Keine Berufserfahrung gepflegt.');
    if (data.experience.some(e => e.role && !e.start)) out.push('Mindestens eine Berufserfahrung ohne Start-Datum — ATS verwirft Bewerbungen mit lückenhafter Chronologie.');
    return out;
  }, [data]);

  return (
    <>
      <div style={{ fontFamily: F.ui, fontSize: '13px', color: C.pencil, lineHeight: 1.55, marginBottom: '16px', maxWidth: '60ch' }}>
        Dein Lebenslauf in der Lese-Reihenfolge, die ein typischer ATS-Parser erzeugt — keine Formatierung, kein Layout. Wenn hier etwas fehlt oder verdreht aussieht, sieht ein Workday- oder Taleo-System es genauso.
      </div>

      {issues.length > 0 && (
        <div style={{ background: '#fff5f3', border: B.hairline, padding: '12px 14px', marginBottom: '16px' }}>
          <div style={{ ...TYPE.overline, color: C.error, marginBottom: '6px' }}>{issues.length} kritische {issues.length === 1 ? 'Lücke' : 'Lücken'}</div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontFamily: F.ui, fontSize: '12.5px', color: C.pencil, lineHeight: 1.55 }}>
            {issues.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      <pre style={{
        background: C.ink, color: C.paper,
        padding: '18px 22px',
        fontFamily: F.mono, fontSize: '12.5px',
        lineHeight: 1.65, margin: 0,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        maxHeight: '52vh', overflow: 'auto',
      }}>{text}</pre>
    </>
  );
}

function buildNotepadText(data: CVData): string {
  const p = data.personal;
  const out: string[] = [];
  out.push(p.name || '[Name fehlt]');
  if (p.title) out.push(p.title);
  out.push('');
  if (p.email) out.push(`Email: ${p.email}`);
  if (p.phone) out.push(`Phone: ${p.phone}`);
  if (p.location) out.push(`Location: ${p.location}`);
  if (p.website) out.push(`Web: ${p.website}`);
  out.push('');

  if (data.profile?.text) {
    out.push('PROFILE');
    out.push(data.profile.text);
    out.push('');
  }

  out.push('WORK EXPERIENCE');
  for (const e of data.experience) {
    if (e.hidden) continue;
    out.push(`${e.role || '[Role]'} - ${e.company || ''} - ${e.location || ''}`);
    out.push(`${e.start || ''} - ${e.end || ''}`);
    for (const b of e.bullets || []) out.push(`* ${b}`);
    out.push('');
  }

  out.push('EDUCATION');
  for (const e of data.education) {
    out.push(`${e.degree || '[Degree]'} - ${e.institution || ''}`);
    out.push(`${e.start || ''} - ${e.end || ''}`);
    out.push('');
  }

  if (data.skillGroups.length) {
    out.push('SKILLS');
    for (const g of data.skillGroups) {
      out.push(`${g.label}: ${(g.items || []).join(', ')}`);
    }
    out.push('');
  }

  if (data.languages.length) {
    out.push('LANGUAGES');
    for (const l of data.languages) out.push(`${l.language}: ${l.level}`);
  }
  return out.join('\n');
}

// ── Tab 2: Keyword-Match ────────────────────────────────────────────────────

// Lowercased, deduplicated, accent-insensitive stoplist for German + English.
// Anything in here is NOT considered a "hard skill" candidate.
const STOPWORDS = new Set<string>(`
a an the and or but if then else for to of in on at by from with without about into
ist sind das der die den dem des ein eine einen einer eines auf in mit von zu für aus
am im uns euch wir ihr du sie er es seine ihre sein dass ob nicht keine kein
und oder aber wenn dann sonst also wie sowie sowohl als wenn auch nur noch nun
sehr mehr meisten viel viele etwa ungefähr ungefaehr ca circa über ueber unter
durch nach vor jeder jede jedes alle alles man wer was wann wo warum weil dass
unsere unseres unserer unserem unseren ihres ihrer
position rolle role job stelle bewerbung verantwortung verantwortlich aufgaben
sie sind wir suchen wir bieten profil anforderungen erfahrung kenntnisse
über über uns ueber uns about us we are looking for we offer profile requirements experience knowledge
m w d
years jahre jahren months monate tag tage week wochen
gut good very strong stark fließend fliessend
ausgezeichnete excellent exzellent excellent
deine dein dein deinem ihrem ihres your you
team teams projekt projekte unternehmen company firma firmen
neue new aktuelle current bisherige past
have has hatte habe haben besitzen verfügen verfuegen
should sollte soll soll können koennen muss
mindestens at least minimum minimal
desirable nice to have wünschenswert wuenschenswert
benefits vorteile angebot stellenangebot
bewerben bewerbung apply application interview
de en english englisch german
title titel
`.split(/\s+/).filter(Boolean));

interface MatchResult { skill: string; foundInResume: boolean; foundInJd: number }

function tokenize(text: string): Set<string> {
  // Lowercase, fold accents, remove punctuation, drop stopwords + single chars.
  const folded = text.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[äöüß]/g, ch => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' } as Record<string, string>)[ch] || ch);
  const tokens = folded.split(/[^a-z0-9+#./\-]+/).filter(t => t.length > 1 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function extractCandidates(jd: string): string[] {
  // Multi-pass extraction:
  //   1. Capitalised multi-word phrases (Adobe Photoshop, Microsoft Excel)
  //   2. Single capitalised tech words (React, Python, Salesforce, GA4)
  //   3. Acronyms (SEO, CRM, ATS) — 2-4 uppercase letters
  const phrases = new Set<string>();
  // Multi-word capitalised phrases — naive but good enough for hard skills
  const phraseRe = /\b([A-Z][a-zA-Z0-9+]+(?:\s+[A-Z][a-zA-Z0-9+]+){0,2})\b/g;
  let m;
  while ((m = phraseRe.exec(jd))) phrases.add(m[1]);
  // Acronyms (2-5 uppercase letters/digits)
  const acronymRe = /\b[A-Z][A-Z0-9]{1,4}\b/g;
  while ((m = acronymRe.exec(jd))) phrases.add(m[0]);
  // Tech-stack identifiers with dots / pluses / hashes
  const techRe = /\b[A-Za-z][a-zA-Z0-9]*(?:[+#.][a-zA-Z0-9]+)+\b/g;
  while ((m = techRe.exec(jd))) phrases.add(m[0]);

  return Array.from(phrases)
    .filter(p => {
      const folded = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      return folded.length >= 2 && !STOPWORDS.has(folded);
    })
    .sort()
    .slice(0, 80);
}

function KeywordMatchView({ data }: { data: CVData }) {
  const [jd, setJd] = useState('');

  const result = useMemo<MatchResult[] | null>(() => {
    if (jd.trim().length < 60) return null;
    const cvText = [
      data.personal.title, data.profile?.text || '',
      ...data.experience.flatMap(e => [e.role, e.company, ...(e.bullets || [])]),
      ...data.skillGroups.flatMap(g => g.items),
      ...data.education.map(e => `${e.degree} ${e.institution}`),
    ].join(' ');
    const cvTokens = tokenize(cvText);
    const cvLower = cvText.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const candidates = extractCandidates(jd);
    const seen = new Set<string>();
    const matches: MatchResult[] = [];
    for (const cand of candidates) {
      const key = cand.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Verbatim match: substring of CV (case-insensitive) OR token match
      const inText = cvLower.includes(key.replace(/[äöüß]/g, ch => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' } as Record<string, string>)[ch] || ch));
      const tokens = tokenize(cand);
      const inTokens = Array.from(tokens).every(t => cvTokens.has(t));
      const foundInResume = inText || inTokens;
      const foundInJd = (jd.match(new RegExp(`\\b${cand.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'gi')) || []).length;
      matches.push({ skill: cand, foundInResume, foundInJd });
    }
    return matches
      .sort((a, b) => Number(b.foundInJd > 0) - Number(a.foundInJd > 0) || b.foundInJd - a.foundInJd)
      .slice(0, 40);
  }, [data, jd]);

  const hits = result?.filter(r => r.foundInResume).length ?? 0;
  const misses = result?.filter(r => !r.foundInResume).length ?? 0;

  return (
    <>
      <div style={{ fontFamily: F.ui, fontSize: '13px', color: C.pencil, lineHeight: 1.55, marginBottom: '12px', maxWidth: '60ch' }}>
        Stellenanzeige reinpasten. Das Tool sucht Hard Skills, Tools und Akronyme aus der Anzeige im Lebenslauf — wortwörtlich, kein Synonym. ATS-Filter zählen wortwörtliche Matches.
      </div>
      <textarea value={jd} onChange={e => setJd(e.target.value)} rows={8}
        placeholder="Stellenanzeige hier einfügen (Anforderungsprofil, Aufgaben, Über uns) …"
        style={{
          width: '100%', padding: '12px 14px',
          fontFamily: F.ui, fontSize: '13px', color: C.ink,
          background: C.white, border: B.hairline,
          outline: 'none', boxSizing: 'border-box',
          resize: 'vertical', lineHeight: 1.55, marginBottom: '12px',
        }} />
      <div style={{ fontFamily: F.ui, fontSize: '11px', color: C.fade, marginBottom: '18px' }}>
        {jd.length} Zeichen · empfohlen: mindestens 200
      </div>

      {result && (
        <>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '14px' }}>
            <Counter label="Wortwörtlich gefunden" value={hits} color={C.success} />
            <Counter label="Im CV fehlt" value={misses} color={C.error} />
            <Counter label="Erkannte Skills" value={result.length} color={C.gold} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {result.map(r => (
              <span key={r.skill}
                title={r.foundInResume ? 'Im CV gefunden' : 'Fehlt — verbatim ergänzen, falls du es beherrschst'}
                style={{
                  padding: '5px 11px',
                  background: r.foundInResume ? '#f0f7f0' : '#fff5f3',
                  border: `1px solid ${r.foundInResume ? C.success : C.error}`,
                  color: r.foundInResume ? C.success : C.error,
                  fontSize: '12px', fontWeight: 600,
                  fontFamily: F.ui,
                }}>
                {r.foundInResume ? '✓' : '○'} {r.skill}{r.foundInJd > 1 ? ` ×${r.foundInJd}` : ''}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ ...TYPE.overline, color: C.fade, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontFamily: F.display, fontSize: '32px', fontWeight: 400, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
}
