/**
 * Bausteine der Prüfung für Anschreiben und beide Unterlagen: Befundliste,
 * Feld für die Stellenanzeige und die Ansichten im Dialog. Die Logik steht in
 * coverLetterCheck.ts, die Sätze in ui/i18n/pruefen.ts.
 */
import { useMemo, useState } from 'react';
import type { CVData, CoverLetterData, Lang } from '../data/types';
import { PRUEFEN_I18N, type PruefenStrings } from '../ui/i18n/pruefen';
import { useUiLang } from '../ui/useUiLang';
import { SOURCES, type SourceId } from '../knowledge/sources';
import type { CoverReport } from './useCoverReport';
import {
  analyzeJobAd, bodyParagraphs, checkAgainstJobAd, checkBoth, coverOwnText, termRows, JD_MIN,
  type Finding, type Severity,
} from './coverLetterCheck';
import { styleHits, type StyleHit } from './styleLists';
import './check.css';

// ── Darstellung ──────────────────────────────────────────────────────────

export function SevMark({ sev }: { sev: Severity }) {
  return (
    <span className="ck-mark" data-sev={sev} aria-hidden>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {sev === 'ok' ? <path d="M2 5.2 4.1 7.3 8 2.9" /> : sev === 'fehler' ? <><path d="M5 2v3.6" /><path d="M5 7.9v.1" /></> : <path d="M2.6 5h4.8" />}
      </svg>
    </span>
  );
}

/** Befunde nach Schwere gruppiert; „In Ordnung" zusammengeklappt. */
export function FindingList({ findings, t }: { findings: Finding[]; t: PruefenStrings }) {
  const groups: Severity[] = ['fehler', 'hinweis'];
  const ok = findings.filter(f => f.sev === 'ok');
  const open = findings.filter(f => f.sev !== 'ok');
  return (
    <div data-findings>
      {!open.length && <p className="ck-none">{t.noneOpen}</p>}
      {groups.map(sev => {
        const list = findings.filter(f => f.sev === sev);
        if (!list.length) return null;
        return (
          <section key={sev} className="ck-group" aria-label={`${t.sev[sev]} (${list.length})`}>
            <h3 className="ck-group-title"><SevMark sev={sev} />{t.sev[sev]} · {list.length}</h3>
            <ul className="ck-list">
              {list.map((f, i) => (
                <li key={f.id + i} className="ck-item" data-sev={f.sev} data-finding={f.id}>
                  <SevMark sev={f.sev} />
                  <span>{t.finding[f.id](f.args ?? [])}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {ok.length > 0 && (
        <details className="ck-passed">
          <summary>{t.passed(ok.length)}</summary>
          <ul className="ck-list">
            {ok.map((f, i) => (
              <li key={f.id + i} className="ck-item" data-sev="ok" data-finding={f.id}>
                <SevMark sev="ok" />
                <span>{t.finding[f.id](f.args ?? [])}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function SourceLine({ ids, t }: { ids: SourceId[]; t: PruefenStrings }) {
  return (
    <p className="ck-sources">
      {t.basis}:{' '}
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && ' · '}
          <a href={SOURCES[id].url} target="_blank" rel="noopener noreferrer">{SOURCES[id].label}</a>
        </span>
      ))}
    </p>
  );
}

/** Eingabe der Stellenanzeige, für alle Prüfungen gemeinsam. */
export function JdBox({ jd, setJd, t, id }: { jd: string; setJd: (v: string) => void; t: PruefenStrings; id: string }) {
  return (
    <div>
      <label className="ck-label" htmlFor={id}>{t.jdLabel}</label>
      <textarea id={id} className="ck-textarea" value={jd} onChange={e => setJd(e.target.value)} rows={7}
        placeholder={t.jdPlaceholder} data-jd />
      <p className="ck-meta">{jd.trim().length < JD_MIN ? t.jdTooShort : null} {t.jdShared}</p>
    </div>
  );
}

// ── Anschreiben: Textansicht ─────────────────────────────────────────────

export function CoverReadView({ report }: { report: CoverReport }) {
  const t = PRUEFEN_I18N[useUiLang()];
  return (
    <>
      <p className="ck-intro">{t.coverTextIntro}</p>
      {report.measure === undefined && <p className="ck-measuring" role="status">{t.measuring}</p>}
      <FindingList findings={report.findings} t={t} />
      <h3 className="ck-h">{t.textHeading}</h3>
      <pre className="ck-pre" data-cover-text tabIndex={0}>{report.text}</pre>
      <SourceLine ids={['ba-anschreiben', 'harvard-chan-cl', 'harvard-resume']} t={t} />
    </>
  );
}

// ── Anschreiben: Stellenanzeige ──────────────────────────────────────────

export function CoverJobView({ cl, jd, setJd }: { cl: CoverLetterData; jd: string; setJd: (v: string) => void }) {
  const t = PRUEFEN_I18N[useUiLang()];
  const ready = jd.trim().length >= JD_MIN;
  const facts = useMemo(() => analyzeJobAd(jd), [jd]);
  // Korrekturen gelten nur für die Erkennung, zu der sie gemacht wurden; eine
  // andere Anzeige (andere Erkennung) setzt sie damit von selbst zurück.
  const factsKey = `${facts.title}|${facts.company}`;
  const [editRaw, setEditRaw] = useState<{ key: string; title?: string; company?: string }>({ key: '' });
  const edit = editRaw.key === factsKey ? editRaw : { key: factsKey };
  const setEdit = (f: (v: { title?: string; company?: string }) => { title?: string; company?: string }) => setEditRaw(prev => ({ ...f(prev.key === factsKey ? prev : {}), key: factsKey }));
  const title = edit.title ?? facts.title;
  const company = edit.company ?? facts.company;
  const findings = useMemo(() => ready ? checkAgainstJobAd(cl, { ...facts, title, company }, jd) : [], [ready, cl, facts, title, company, jd]);
  const rows = useMemo(() => ready ? termRows(jd, null, coverOwnText(cl)) : [], [ready, jd, cl]);
  const hits = rows.filter(r => r.cl);
  const misses = rows.filter(r => !r.cl);
  return (
    <>
      <JdBox jd={jd} setJd={setJd} t={t} id="ck-jd-cover" />
      {ready && (
        <>
          <div className="ck-facts" data-job-facts>
            <h3 className="ck-label" style={{ margin: 0 }}>{t.detectedHeading}</h3>
            <p className="ck-meta" style={{ marginTop: 2 }}>{t.detectedNote}</p>
            <div className="ck-facts-grid">
              <label>{t.fieldTitle}
                <input className="ck-input" value={title} onChange={e => setEdit(v => ({ ...v, title: e.target.value }))} data-fact="title" />
              </label>
              <label>{t.fieldCompany}
                <input className="ck-input" value={company} onChange={e => setEdit(v => ({ ...v, company: e.target.value }))} data-fact="company" />
              </label>
            </div>
            {facts.contact && <p className="ck-meta">{t.contactLine(facts.contact)}</p>}
          </div>
          <h3 className="ck-h">{t.doc.cover}</h3>
          <FindingList findings={findings} t={t} />
          <h3 className="ck-h">{t.termsHeading}</h3>
          <div className="ck-terms" data-terms>
            <div>
              <h4>{t.termsIn}</h4>
              <div className="ck-chips">{hits.map(r => <span key={r.term} className="ck-chip" data-hit="true">✓ {r.term}</span>)}</div>
            </div>
            <div>
              <h4>{t.termsOut}</h4>
              <div className="ck-chips">{misses.map(r => <span key={r.term} className="ck-chip" data-hit="false">{r.term}</span>)}</div>
            </div>
          </div>
          <p className="ck-meta" style={{ marginTop: 12 }}>{t.termsNote}</p>
        </>
      )}
    </>
  );
}

// ── Anschreiben: Stil ────────────────────────────────────────────────────

export function StyleView({ cl, lang }: { cl: CoverLetterData; lang: Lang }) {
  const t = PRUEFEN_I18N[useUiLang()];
  const hits = useMemo(() => {
    const text = [cl.salutation, ...bodyParagraphs(cl)].filter(Boolean).join(' ');
    return styleHits(text, lang);
  }, [cl, lang]);
  const kinds = ['floskel', 'leer', 'ki', 'konj', 'fuell', 'ich', 'satz'] as const;
  const by = (k: StyleHit['kind']) => hits.filter(h => h.kind === k);
  return (
    <>
      <p className="ck-intro">{t.styleIntro}</p>
      {!hits.length && <p className="ck-none" data-style-none>{t.styleNone}</p>}
      <div className="ck-style">
        {kinds.map(k => {
          const list = by(k);
          if (!list.length) return null;
          return (
            <section key={k} className="ck-style-kind" data-style-kind={k}>
              <h4>{t.styleKind[k]}</h4>
              <p>{t.styleWhy[k]}</p>
              {k === 'ich'
                ? <span className="ck-hit">{t.styleI(Number(list[0].phrase), list[0].n ?? 0)}</span>
                : list.map((h, i) => (
                  <span key={h.phrase + i} className="ck-hit">
                    {k === 'satz' ? `„${h.phrase}"` : h.phrase}
                    <small>{k === 'satz' ? t.styleSentence(h.n ?? 0) : (h.n ?? 1) > 1 ? t.styleTimes(h.n ?? 1) : ''}</small>
                  </span>
                ))}
            </section>
          );
        })}
      </div>
      <SourceLine ids={['ba-anschreiben', 'harvard-chan-cl', 'wiki-ai', 'openai']} t={t} />
    </>
  );
}

// ── Beide Unterlagen ─────────────────────────────────────────────────────

export function BothView({ cv, cl, cvText, clText, jd, setJd }: {
  cv: CVData; cl: CoverLetterData; cvText: string; clText: string; jd: string; setJd: (v: string) => void;
}) {
  const t = PRUEFEN_I18N[useUiLang()];
  const findings = useMemo(() => checkBoth({ cv, cl, cvText, clText }), [cv, cl, cvText, clText]);
  const ready = jd.trim().length >= JD_MIN;
  const rows = useMemo(() => {
    if (!ready) return [];
    const r = termRows(jd, cvText, coverOwnText(cl));
    const rank = (x: { cv: boolean; cl: boolean }) => (x.cv && x.cl ? 0 : x.cv ? 1 : x.cl ? 2 : 3);
    return [...r].sort((a, b) => rank(a) - rank(b) || b.inJd - a.inJd);
  }, [ready, jd, cvText, cl]);
  return (
    <>
      <p className="ck-intro">{t.bothIntro}</p>
      <FindingList findings={findings} t={t} />
      <h3 className="ck-h">{t.bothTermsHeading}</h3>
      <JdBox jd={jd} setJd={setJd} t={t} id="ck-jd-both" />
      {ready && rows.length > 0 && (
        <>
          <table className="ck-table" data-both-terms>
            <thead><tr><th scope="col">{t.colTerm}</th><th scope="col">{t.colCv}</th><th scope="col">{t.colCl}</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.term} data-term={r.term} data-cv={r.cv} data-cl={r.cl}>
                  <td>{r.term}</td>
                  <td data-yes={r.cv}>{r.cv ? `✓ ${t.yes}` : t.no}</td>
                  <td data-yes={r.cl}>{r.cl ? `✓ ${t.yes}` : t.no}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ck-meta" style={{ marginTop: 12 }}>{t.bothTermsNote}</p>
        </>
      )}
    </>
  );
}
