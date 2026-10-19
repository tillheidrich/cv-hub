/**
 * „Lebenslauf übernehmen" (19.10.2026): Text einfügen oder Datei hochladen,
 * dazu eine fertige Anleitung für ChatGPT. Für Menschen gebaut, die nicht
 * wissen, was Markdown ist (Laien-Durchgang nach Tills Cousine).
 *
 *  • `ImportPanel` – Einfügefeld, Datei, Anleitung, Ergebnis. Wird in der
 *    Übersicht im Anlege-Fenster benutzt und im Editor im eigenen Fenster.
 *  • `ImportDialog` – das Fenster im Editor, mit der Wahl „neu anlegen"
 *    (Vorgabe) oder „diesen ersetzen".
 *
 * Alles läuft im Browser (import/readImport.ts), also auch in der Demo.
 * Was der Parser nicht sicher zuordnen kann, kommt in einen eigenen
 * Abschnitt „Weitere Angaben", statt verloren zu gehen.
 */
import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../data/types';
import { createBlankProfile } from '../data/storage';
import { readImportFile, readText, ImportError, type ImportResult } from '../import/readImport';
import { CHATGPT_PROMPT } from '../import/textImport';
import { IMPORTCV_I18N, type ImportCvStrings } from './i18n/importcv';
import { useUiLang } from './useUiLang';
import { Portal } from './Overlay';
import { track, countEvent } from '../data/track';

const ACCEPT = '.docx,.txt,.md,.markdown,.zip,.csv,.json,.yaml,.yml,.tex,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/json,application/zip,application/pdf';

function errText(e: unknown, s: ImportCvStrings): string {
  if (e instanceof ImportError) {
    if (e.kind === 'pdf') return s.errPdf;
    if (e.kind === 'docx') return s.errDocx;
    if (e.kind === 'empty') return s.errEmpty;
  }
  return s.errUnknown;
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* Fallback unten */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function ImportPanel({ cvLang, onParsed, autoFocus = false }: {
  cvLang: Lang;
  onParsed: (r: ImportResult | null) => void;
  autoFocus?: boolean;
}) {
  const uiLang = useUiLang();
  const s = IMPORTCV_I18N[uiLang];
  const [tab, setTab] = useState<'paste' | 'file'>('paste');
  const [text, setText] = useState('');
  const [res, setRes] = useState<ImportResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const base = () => createBlankProfile('').data[cvLang];

  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { if (autoFocus) taRef.current?.focus(); }, [autoFocus]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Eingefügter Text: kurz nach der letzten Änderung lesen.
  function changeText(v: string) {
    setText(v);
    window.clearTimeout(timer.current);
    if (!v.trim()) { setRes(null); setErr(null); onParsed(null); return; }
    timer.current = window.setTimeout(() => {
      try { const r = readText(v, base(), cvLang); setRes(r); setErr(null); onParsed(r); }
      catch (e) { setRes(null); setErr(errText(e, s)); onParsed(null); }
    }, 250);
  }

  async function pick(file: File) {
    setBusy(true); setErr(null); setRes(null); onParsed(null);
    try { const r = await readImportFile(file, base(), cvLang); setRes(r); onParsed(r); }
    catch (e) { setErr(errText(e, s)); }
    finally { setBusy(false); }
  }

  async function copyPrompt() {
    const ok = await copyText(CHATGPT_PROMPT[cvLang] ?? CHATGPT_PROMPT.de);
    setCopied(ok);
    track('import_prompt_copy', { lang: cvLang });
    countEvent('ai_open', { target: 'import_prompt' });
    if (ok) window.setTimeout(() => setCopied(false), 6000);
  }

  const switchTab = (t: 'paste' | 'file') => { setTab(t); setRes(null); setErr(null); onParsed(null); if (t === 'paste' && text.trim()) changeText(text); };
  const f = res?.found;
  const box: React.CSSProperties = { padding: '14px', borderRadius: '14px', background: 'oklch(1 0 0 / 0.7)', boxShadow: 'var(--pill-shadow)' };
  const small: React.CSSProperties = { fontSize: 'var(--t-sm)', color: 'var(--ink-2)', lineHeight: 1.5 };

  return (
    <div className="ic-panel" style={{ display: 'grid', gap: '12px' }}>
      <div className="ui-seg ui-pill" role="group" aria-label={s.title} style={{ justifySelf: 'start' }}>
        <button type="button" aria-pressed={tab === 'paste'} onClick={() => switchTab('paste')}>{s.tabPaste}</button>
        <button type="button" aria-pressed={tab === 'file'} onClick={() => switchTab('file')}>{s.tabFile}</button>
      </div>

      {tab === 'paste' && (
        <>
          <details style={box}>
            <summary style={{ cursor: 'pointer', fontWeight: 620, fontSize: 'var(--t-sm)', color: 'var(--ink)', minHeight: '28px' }}>{s.aiTitle}</summary>
            <ol style={{ ...small, margin: '10px 0 12px', paddingLeft: '20px' }}>
              {s.aiSteps.map(x => <li key={x} style={{ marginBottom: '4px' }}>{x}</li>)}
            </ol>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="ui-btn ui-btn-primary" style={{ minHeight: '44px' }} onClick={() => void copyPrompt()}>{s.aiCopy}</button>
              <a className="ui-btn ui-btn-soft" style={{ minHeight: '44px', textDecoration: 'none' }} href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">{s.aiOpen} ↗</a>
              <span role="status" aria-live="polite" style={{ ...small, color: 'var(--ats-high-ink)' }}>{copied ? s.aiCopied : ''}</span>
            </div>
          </details>
          <div>
            <label htmlFor="ic-text" style={{ display: 'block', fontSize: 'var(--t-sm)', fontWeight: 620, color: 'var(--ink)', marginBottom: '6px' }}>{s.pasteLabel}</label>
            <textarea id="ic-text" ref={taRef} value={text} onChange={e => changeText(e.target.value)} placeholder={s.pastePlaceholder}
              rows={9} spellCheck={false}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: 0, borderRadius: '12px', background: '#fff', boxShadow: 'inset 0 0 0 1px oklch(0.87 0.006 264)', fontFamily: 'inherit', fontSize: '15px', lineHeight: 1.5, color: 'var(--ink)', resize: 'vertical', minHeight: '180px' }} />
            <p style={{ ...small, margin: '6px 0 0', fontSize: 'var(--t-xs)' }}>{s.pdfHint}</p>
          </div>
        </>
      )}

      {tab === 'file' && (
        <div style={box}>
          <p style={{ ...small, marginTop: 0, marginBottom: '10px' }}>{s.fileKinds}</p>
          <label className="ui-btn ui-btn-soft" style={{ minHeight: '44px', cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? <span className="cv-spin" aria-hidden /> : null}{s.filePick}
            <input type="file" accept={ACCEPT} hidden disabled={busy}
              onChange={e => { const file = e.target.files?.[0]; if (file) void pick(file); e.target.value = ''; }} />
          </label>
          <p style={{ ...small, margin: '10px 0 0', fontSize: 'var(--t-xs)' }}>{s.pdfHint}</p>
        </div>
      )}

      <div role="status" aria-live="polite">
        {err && <p style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--ats-low-ink)', lineHeight: 1.5 }}>{err}</p>}
        {res && (
          <div style={{ ...box, background: 'oklch(0.97 0.03 150 / 0.6)' }}>
            {f ? (
              (f.name || f.experience || f.education || f.skills || f.languages)
                ? <p style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--ink)' }}><strong>{s.foundTitle}:</strong> {s.found(f)}</p>
                : <p style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--ats-low-ink)' }}>{s.nothingFound}</p>
            ) : <p style={{ margin: 0, fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>{s.from(res.what)}</p>}
            {res.unsorted.length > 0 && (
              <details style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', fontSize: 'var(--t-sm)', color: 'var(--ink)' }}>{s.unsortedTitle(res.unsorted.length)}</summary>
                <p style={{ ...small, margin: '6px 0' }}>{s.unsortedHint}</p>
                <ul style={{ ...small, margin: 0, paddingLeft: '18px', maxHeight: '140px', overflowY: 'auto' }}>
                  {res.unsorted.slice(0, 60).map((u, i) => <li key={i}>{u}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ImportDialog({ cvLang, canReplace, newLockedNote, onApply, onClose }: {
  cvLang: Lang;
  /** Gesetzt, wenn ein weiterer Lebenslauf nicht frei ist (Gratis-Grenze):
   *  „neu anlegen" bleibt sichtbar, aber gesperrt, mit diesem Hinweis. */
  newLockedNote?: string;
  /** Ersetzen anbieten (im Editor mit offenem Lebenslauf, nicht schreibgeschützt). */
  canReplace: boolean;
  onApply: (r: ImportResult, target: 'new' | 'replace') => void;
  onClose: () => void;
}) {
  const uiLang = useUiLang();
  const s = IMPORTCV_I18N[uiLang];
  const [res, setRes] = useState<ImportResult | null>(null);
  const newLocked = !!newLockedNote && canReplace;
  const [target, setTarget] = useState<'new' | 'replace'>(newLocked ? 'replace' : 'new');
  const ref = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); (returnTo.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);

  const usable = !!res && (!!res.profile || !!res.cv);
  const effTarget = res?.profile ? 'new' : target;

  return (
    <Portal>
      <div style={{ position: 'fixed', inset: 0, zIndex: 1300, background: 'oklch(0.21 0.021 264 / 0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}
        onClick={onClose}>
        <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="ic-title" className="ui-float kh-rise"
          style={{ background: 'var(--float-solid)', padding: 'clamp(18px, 4vw, 30px)', maxWidth: '680px', width: '100%', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', boxSizing: 'border-box' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <h2 id="ic-title" style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 650, letterSpacing: '-0.015em', color: 'var(--ink)' }}>{s.title}</h2>
            <button type="button" onClick={onClose} aria-label={s.close} className="ui-btn ui-icon-btn" style={{ minHeight: '44px', width: '44px', fontSize: '22px', color: 'var(--ink-2)' }}>×</button>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 'var(--t-sm)', color: 'var(--ink-2)', lineHeight: 1.55 }}>{s.lede}</p>
          <ImportPanel cvLang={cvLang} onParsed={setRes} autoFocus />

          {canReplace && !res?.profile && (
            <div className="ui-start" role="radiogroup" aria-label={s.title} style={{ marginTop: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {([
                { id: 'new' as const, label: s.targetNew, desc: s.targetNewSub },
                { id: 'replace' as const, label: s.targetReplace, desc: s.targetReplaceSub },
              ]).map(o => (
                <button key={o.id} type="button" role="radio" aria-checked={target === o.id} onClick={() => setTarget(o.id)}
                  disabled={o.id === 'new' && newLocked}>
                  <strong>{o.label}</strong><span>{o.id === 'new' && newLocked ? newLockedNote : o.desc}</span>
                </button>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
            <button type="button" onClick={onClose} className="ui-btn ui-btn-soft" style={{ minHeight: '44px' }}>{s.cancel}</button>
            <button type="button" disabled={!usable} className="ui-btn ui-btn-primary" style={{ minHeight: '44px', padding: '0 20px' }}
              onClick={() => { if (res) onApply(res, canReplace ? effTarget : 'new'); }}>
              {(!canReplace || effTarget === 'new') ? s.applyNew : s.apply}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
