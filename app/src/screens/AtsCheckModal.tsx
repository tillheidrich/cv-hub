import { useState, useMemo, useEffect, useRef } from 'react';
import type { CVData, CoverLetterData } from '../data/types';
import { extractExportText, type ExportRenderConfig } from '../export/exportHtml';
import { ATS_I18N, type AtsStrings } from '../ui/i18n/ats';
import { PRUEFEN_I18N, type CheckDoc } from '../ui/i18n/pruefen';
import { useUiLang } from '../ui/useUiLang';
import { Portal } from '../ui/Overlay';
import { extraSectionsPlain, extraSectionsText } from '../data/extraSections';
import { useFreeTier } from '../billing/freeTier';
import { PassNote } from '../billing/PassLock';
import { haystack, contains, jobTerms } from '../check/keywords';
import { docLang, JD_MIN } from '../check/coverLetterCheck';
import { BothView, CoverJobView, CoverReadView, JdBox, StyleView } from '../check/CheckViews';
import { useCoverReport } from '../check/useCoverReport';
import '../check/check.css';

interface Props {
  data: CVData;
  coverLetter?: CoverLetterData;
  /** Export-Einstellungen — der Check liest das echte Exportdokument, nicht
   *  die Rohdaten. Ohne sie fällt er auf eine einfache Datenansicht zurück. */
  exportConfig?: ExportRenderConfig;
  /** Womit der Dialog aufgeht. Ohne Angabe: Lebenslauf. */
  initialDoc?: CheckDoc;
  onClose: () => void;
}

type Tab = 'text' | 'job' | 'style' | 'match';
const TABS: Record<CheckDoc, Tab[]> = { resume: ['text', 'job'], cover: ['text', 'job', 'style'], both: ['match'] };

/**
 * „So liest ein Portal …": Lebenslauf, Anschreiben oder beide zusammen so,
 * wie ein Bewerbermanagement-System sie bekommt — als Text in der Reihenfolge
 * der PDF-Textebene, abgeglichen mit einer Stellenanzeige.
 *
 * Bis zum 10.10.2026 gab es hier nur den Lebenslauf (Rückmeldung: „ats test vom
 * anschreiben ging gestern nicht? Da war nur der für den Lebenslauf"). Jetzt
 * lässt sich oben wählen, was geprüft wird; die Stellenanzeige gilt für alle
 * drei Prüfungen.
 *
 * Der Dialog hängt per Portal am Dokument. Vorher lag er im Prüfen-Paneel, und
 * dessen Transformation fing `position: fixed` ein: Der Dialog war auf die
 * Breite des Paneels gequetscht.
 *
 * Gratis-Grenze: Die Prüfung des Anschreibens folgt dem Anschreiben selbst
 * (billing/freeTier.ts, `coverLetter`). Ohne Pass steht dort der Pass-Hinweis,
 * der Lebenslauf bleibt frei.
 */
export default function AtsCheckModal({ data, coverLetter, exportConfig, initialDoc = 'resume', onClose }: Props) {
  const ui = useUiLang();
  const t = PRUEFEN_I18N[ui];
  const ft = useFreeTier();
  const [doc, setDoc] = useState<CheckDoc>(initialDoc);
  const [tab, setTab] = useState<Tab>(TABS[initialDoc][0]);
  const [jd, setJd] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  const coverAllowed = ft.coverLetter && !!coverLetter;
  const needsCover = doc !== 'resume';
  const report = useCoverReport(data, coverLetter, exportConfig, needsCover && coverAllowed);
  const cvText = useMemo(() => {
    if (!exportConfig || doc !== 'both') return '';
    try { return extractExportText(data, exportConfig); } catch { return ''; }
  }, [data, exportConfig, doc]);

  const chooseDoc = (d: CheckDoc) => { setDoc(d); setTab(TABS[d][0]); };

  // Fokus: in den Dialog, Escape schließt, Tab bleibt drin, danach zurück.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const f = [...dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, summary, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); before?.focus?.(); };
  }, [onClose]);

  const tabLabel: Record<Tab, string> = { text: t.tabText, job: t.tabJob, style: t.tabStyle, match: t.tabMatch };

  let body: React.ReactNode;
  if (needsCover && !coverAllowed) {
    body = (
      <div data-cover-locked>
        <p className="ck-intro">{t.passBody}</p>
        <PassNote feature="coverLetter" label={t.passLabel} />
      </div>
    );
  } else if (doc === 'resume') {
    body = tab === 'text'
      ? <NotepadView data={data} exportConfig={exportConfig} />
      : <KeywordMatchView data={data} jd={jd} setJd={setJd} />;
  } else if (doc === 'cover' && report && coverLetter) {
    body = tab === 'text' ? <CoverReadView report={report} />
      : tab === 'job' ? <CoverJobView cl={coverLetter} jd={jd} setJd={setJd} />
      : <StyleView cl={coverLetter} lang={docLang(data)} />;
  } else if (doc === 'both' && report && coverLetter) {
    body = <BothView cv={data} cl={coverLetter} cvText={cvText} clText={report.text} jd={jd} setJd={setJd} />;
  }

  return (
    <Portal>
      <div className="ck-backdrop" onClick={onClose} aria-hidden />
      <div ref={dialogRef} className="ck-dialog" role="dialog" aria-modal="true" aria-labelledby="ck-title" tabIndex={-1} data-check-dialog={doc}>
        <div className="ck-head">
          <div className="ck-head-row">
            <div>
              <p className="ck-overline">{t.overline}</p>
              <h2 id="ck-title" className="ck-title">{t.title[doc]}</h2>
            </div>
            <button type="button" className="ui-btn ui-icon-btn ck-close" onClick={onClose} aria-label={t.close}>×</button>
          </div>
          <div className="ui-seg ck-docs" role="radiogroup" aria-label={t.docLabel}>
            {(['resume', 'cover', 'both'] as const).map(d => (
              <button key={d} type="button" role="radio" aria-checked={doc === d} onClick={() => chooseDoc(d)} data-doc={d}>{t.doc[d]}</button>
            ))}
          </div>
          <div className="ck-tabs" role="tablist" aria-label={t.title[doc]}>
            {TABS[doc].map(x => (
              <button key={x} type="button" role="tab" id={`ck-tab-${x}`} aria-selected={tab === x} aria-controls="ck-panel"
                className="ck-tab" onClick={() => setTab(x)} data-tab={x}>{tabLabel[x]}</button>
            ))}
          </div>
        </div>
        <div className="ck-body" id="ck-panel" role="tabpanel" aria-labelledby={`ck-tab-${tab}`}>
          {body}
        </div>
      </div>
    </Portal>
  );
}

// ── Lebenslauf: Textansicht ─────────────────────────────────────────────────

function NotepadView({ data, exportConfig }: { data: CVData; exportConfig?: ExportRenderConfig }) {
  const t = ATS_I18N[useUiLang()];

  /* Der Text kommt aus dem tatsächlich exportierten Dokument. Vorher wurde er
     aus den Eingabefeldern neu zusammengesetzt — damit konnte der Check per
     Konstruktion keinen einzigen Exportfehler finden und suggerierte trotzdem,
     man sehe hier, was ein ATS sieht. */
  const fromExport = useMemo(() => {
    if (!exportConfig) return null;
    try { return extractExportText(data, exportConfig); } catch { return null; }
  }, [data, exportConfig]);
  const text = useMemo(() => fromExport || buildNotepadText(data, t), [fromExport, data, t]);

  const issues = useMemo(() => {
    const out: string[] = [];
    const p = data.personal;
    if (!p.email) out.push(t.issueEmail);
    if (!p.phone) out.push(t.issuePhone);
    if (!p.name) out.push(t.issueName);
    if (!data.experience.some(e => !e.hidden)) out.push(t.issueNoExperience);
    if (data.experience.some(e => e.role && !e.start)) out.push(t.issueMissingStart);

    /* Prüfungen, die erst möglich sind, weil hier das echte Exportdokument
       gelesen wird — und die die eigentlichen Exportfehler finden. */
    if (fromExport) {
      const flat = fromExport.replace(/\s+/g, ' ').toLowerCase();
      const head = fromExport.split('\n').filter(Boolean).slice(0, 3).join(' ').toLowerCase();
      if (p.name && !head.includes(p.name.toLowerCase().split(' ')[0])) {
        out.push(t.issueNameNotFirst);
      }
      if (p.email && !flat.includes(p.email.toLowerCase())) {
        out.push(t.issueEmailNotInExport);
      }
      for (const e of data.experience.filter(x => !x.hidden)) {
        if (e.company && !flat.includes(e.company.toLowerCase().slice(0, 12))) {
          out.push(t.issueCompanyMissing(e.company));
          break;
        }
      }
      const dupe = data.experience.filter(x => !x.hidden)[0]?.company;
      if (dupe && flat.split(dupe.toLowerCase()).length > 3) {
        out.push(t.issueCompanyDuplicate(dupe));
      }
    }
    return out;
  }, [data, fromExport, t]);

  return (
    <>
      <p className="ck-intro">{fromExport ? t.notepadIntroExport : t.notepadIntroFallback}</p>
      {issues.length > 0 && (
        <section className="ck-group" aria-label={t.issuesHeading(issues.length)}>
          <h3 className="ck-group-title">{t.issuesHeading(issues.length)}</h3>
          <ul className="ck-list">
            {issues.map((m, i) => <li key={i} className="ck-item" data-sev="fehler"><span className="ck-mark" data-sev="fehler" aria-hidden>!</span><span>{m}</span></li>)}
          </ul>
        </section>
      )}
      <pre className="ck-pre" data-resume-text tabIndex={0}>{text}</pre>
    </>
  );
}

function buildNotepadText(data: CVData, t: AtsStrings): string {
  const p = data.personal;
  const out: string[] = [];
  out.push(p.name || t.notepadNameMissing);
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
  /* Projekte, Zertifikate, Ehrenamt, Publikationen, freie Abschnitte. */
  const extra = extraSectionsPlain(data);
  if (extra.length) out.push('', ...extra);
  return out.join('\n');
}

// ── Lebenslauf: Stellenanzeige ──────────────────────────────────────────────

interface MatchResult { skill: string; foundInResume: boolean; foundInJd: number }

function KeywordMatchView({ data, jd, setJd }: { data: CVData; jd: string; setJd: (v: string) => void }) {
  const ui = useUiLang();
  const t = ATS_I18N[ui];
  const tp = PRUEFEN_I18N[ui];

  const result = useMemo<MatchResult[] | null>(() => {
    if (jd.trim().length < JD_MIN) return null;
    const cvText = [
      data.personal.title, data.profile?.text || '',
      ...data.experience.flatMap(e => [e.role, e.company, ...(e.bullets || [])]),
      ...data.skillGroups.flatMap(g => g.items),
      ...data.education.map(e => `${e.degree} ${e.institution}`),
      extraSectionsText(data),
    ].join(' ');
    const h = haystack(cvText);
    return jobTerms(jd)
      .map(x => ({ skill: x.term, foundInResume: contains(h, x.term), foundInJd: x.inJd }))
      .sort((a, b) => Number(b.foundInJd > 0) - Number(a.foundInJd > 0) || b.foundInJd - a.foundInJd);
  }, [data, jd]);

  const hits = result?.filter(r => r.foundInResume).length ?? 0;
  const misses = result?.filter(r => !r.foundInResume).length ?? 0;

  /* Welcher Punkt im Lebenslauf trägt zu DIESER Anzeige bei?
   *
   * Übernommen aus der Idee der „relevance-weighted content cutting" im
   * Projekt ai-job-search (MIT, MadsLorentzen) — dort entscheidet ein Modell,
   * welche Punkte beim Kürzen bleiben. Hier entscheidet der Mensch, und das
   * Werkzeug legt ihm nur die Grundlage hin: Welche Aufzählungspunkte
   * enthalten Begriffe aus der Anzeige, welche keinen einzigen? Wer von zwei
   * Seiten auf eine muss, kürzt zuerst dort, wo nichts anschlägt — statt
   * chronologisch von unten.
   *
   * Kein Modell, keine Wertung des Inhalts: ein Punkt ohne Treffer kann der
   * beste des Lebenslaufs sein. Die Liste sagt nur, dass er für diese eine
   * Anzeige nichts beiträgt. */
  const punkte = useMemo(() => {
    if (!result) return null;
    const begriffe = result.filter(r => r.foundInJd > 0).map(r => r.skill);
    const mit: { rolle: string; text: string; treffer: string[] }[] = [];
    const ohne: { rolle: string; text: string }[] = [];
    for (const e of data.experience.filter(x => !x.hidden)) {
      for (const b of (e.bullets || [])) {
        const low = b.toLowerCase();
        const treffer = begriffe.filter(k => low.includes(k.toLowerCase()));
        if (treffer.length) mit.push({ rolle: e.role, text: b, treffer: [...new Set(treffer)] });
        else ohne.push({ rolle: e.role, text: b });
      }
    }
    return { mit, ohne };
  }, [result, data]);

  return (
    <>
      <p className="ck-intro">{t.keywordIntro}</p>
      <JdBox jd={jd} setJd={setJd} t={tp} id="ck-jd-resume" />

      {result && (
        <>
          <div style={{ display: 'flex', gap: '24px', margin: '18px 0 12px' }}>
            <Counter label={t.counterHits} value={hits} tone="high" />
            <Counter label={t.counterMisses} value={misses} tone="low" />
            <Counter label={t.counterSkills} value={result.length} tone="ink" />
          </div>

          <div className="ck-chips" data-resume-terms>
            {result.map(r => (
              <span key={r.skill} className="ck-chip" data-hit={r.foundInResume} title={r.foundInResume ? t.chipFound : t.chipMissing}>
                {r.foundInResume ? '✓' : '○'} {r.skill}{r.foundInJd > 1 ? ` ×${r.foundInJd}` : ''}
              </span>
            ))}
          </div>

          {punkte && (punkte.mit.length > 0 || punkte.ohne.length > 0) && (
            <div style={{ marginTop: '24px', borderTop: '1px solid var(--hair)', paddingTop: '16px' }}>
              <h3 className="ck-label">{t.contribOverline}</h3>
              <p className="ck-meta" style={{ margin: '0 0 12px', maxWidth: '62ch' }}>
                {t.contribBody1}<em>{t.contribBodyEm}</em>{t.contribBody2}
              </p>
              <Punkteliste titel={t.listWithMatches(punkte.mit.length)}
                eintraege={punkte.mit.map(p => ({ rolle: p.rolle, text: p.text, zusatz: p.treffer.join(' · ') }))} />
              <Punkteliste titel={t.listWithoutMatches(punkte.ohne.length)}
                eintraege={punkte.ohne.map(p => ({ rolle: p.rolle, text: p.text }))} />
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Aufzählungspunkte mit ihrer Station, zusammengeklappt hinter einer Zeile. */
function Punkteliste({ titel, eintraege }: { titel: string; eintraege: { rolle: string; text: string; zusatz?: string }[] }) {
  if (!eintraege.length) return null;
  return (
    <details className="ck-passed" style={{ marginBottom: 8 }}>
      <summary style={{ color: 'var(--ink)' }}>{titel}</summary>
      <ul style={{ margin: '4px 0 0', padding: '0 0 0 18px' }}>
        {eintraege.map((e, i) => (
          <li key={i} style={{ fontSize: 'var(--t-xs)', color: 'var(--ink)', lineHeight: 1.5, marginBottom: 7 }}>
            {e.text}
            <span style={{ display: 'block', color: 'var(--ink-2)', marginTop: 2 }}>
              {e.rolle}{e.zusatz ? ` · ${e.zusatz}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: 'high' | 'low' | 'ink' }) {
  const color = tone === 'high' ? 'var(--ats-high-ink)' : tone === 'low' ? 'var(--ats-low-ink)' : 'var(--ink)';
  return (
    <div>
      <div style={{ fontSize: 'var(--t-xs)', fontWeight: 600, color: 'var(--ink-2)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 640, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
