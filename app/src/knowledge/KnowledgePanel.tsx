import { useEffect, useMemo, useRef, useState } from 'react';
import type { CVData, CoverLetterData } from '../data/types';
import type { UiLang } from '../ui/i18n';
import { useUiLang } from '../ui/useUiLang';
import { TIPPS_I18N, type TippsStrings } from '../ui/i18n/tipps';
import { SOURCES } from './sources';
import { magazinLink, magazinEnUrl, MAGAZIN_EN } from './magazin';
import { contextHints, DEFAULT_TARGET, TARGETS, type ContextHint, type Target } from './context';
import { PRUEFEN_I18N } from '../ui/i18n/pruefen';
import type { Country, Prompt, Tip, TipId, TipTab, TipsContent } from './types';
import './tipps.css';

/**
 * Tipps: Hinweise je Abschnitt mit Belegen, Vorher/Nachher-Beispiele,
 * Länderunterschiede, Checkliste vor dem Absenden und Prompt-Vorlagen.
 *
 * Bis zum 10.10.2026 gab es hier vier Reiter mit Karten, nur auf Deutsch, und
 * einen Teil der Prompts ohne Beleg („schneller eingestellt als 95 % der
 * Bewerber"). Jetzt:
 *   - Inhalte in vier Sprachen (content/<sprache>.ts), nachgeladen je
 *     Oberflächensprache, damit nicht alle vier im Hauptpaket liegen;
 *   - jede Aussage über Recht, Behörden, Studien oder fremde Systeme mit
 *     Quelle (sources.ts), Datum der Prüfung dabei;
 *   - „Passt gerade": bis zu drei Tipps, die zu den offenen Unterlagen passen
 *     (context.ts), wenn das Paneel die Daten bekommt;
 *   - Verweise auf Magazin-Artikel (magazin.ts, relativer Pfad).
 */

const LOADERS: Record<UiLang, () => Promise<{ default: TipsContent }>> = {
  de: () => import('./content/de'),
  en: () => import('./content/en'),
  fr: () => import('./content/fr'),
  es: () => import('./content/es'),
};
const cache: Partial<Record<UiLang, TipsContent>> = {};

function useTips(lang: UiLang): TipsContent | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (cache[lang]) return;
    let alive = true;
    LOADERS[lang]()
      .then(m => { cache[lang] = m.default; })
      .catch(() => LOADERS.de().then(m => { cache[lang] = m.default; }))
      .finally(() => { if (alive) setTick(x => x + 1); });
    return () => { alive = false; };
  }, [lang]);
  return cache[lang] ?? null;
}

const TAB_KEY = 'cv-tipps-tab';
const CHECK_KEY = 'cv-tipps-checklist';
const TABS: TipTab[] = ['cv', 'letter', 'countries', 'checklist', 'prompts'];

function readTab(): TipTab | null {
  try { const v = localStorage.getItem(TAB_KEY) as TipTab | null; return v && TABS.includes(v) ? v : null; } catch { return null; }
}

/** Zielland für die Länderhinweise (context.ts): nur in diesem Browser. */
const TARGET_KEY = 'cv-tipps-target';
function readTarget(): Target {
  try { const v = localStorage.getItem(TARGET_KEY) as Target | null; return v && TARGETS.includes(v) ? v : DEFAULT_TARGET; } catch { return DEFAULT_TARGET; }
}

export default function KnowledgePanel({ data, coverLetter, docType, embedded }: {
  data?: CVData;
  coverLetter?: CoverLetterData;
  /** Welches Dokument im Editor offen ist (App: 'resume' | 'cover-letter'). */
  docType?: string;
  /** Im Prüfen-Paneel auf dem Telefon: ohne eigenen Abstand oben. */
  embedded?: boolean;
} = {}) {
  const lang = useUiLang();
  const t = TIPPS_I18N[lang];
  const content = useTips(lang);
  const coverOpen = docType === 'cover' || docType === 'cover-letter';
  const [tab, setTabState] = useState<TipTab>(() => readTab() ?? (coverOpen ? 'letter' : 'cv'));
  const [openId, setOpenId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const setTab = (x: TipTab) => { setTabState(x); try { localStorage.setItem(TAB_KEY, x); } catch { /* ohne Speicher */ } };

  const [target, setTargetState] = useState<Target>(readTarget);
  const setTarget = (x: Target) => { setTargetState(x); try { localStorage.setItem(TARGET_KEY, x); } catch { /* ohne Speicher */ } };
  const hints = useMemo(() => contextHints(data, coverLetter, coverOpen ? 'cover' : 'resume', target), [data, coverLetter, coverOpen, target]);

  const jump = (h: ContextHint) => {
    setTab(h.tab);
    setOpenId(h.tip);
    requestAnimationFrame(() => {
      const el = document.getElementById(`tip-${h.tip}`);
      el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      (el?.querySelector('h3') as HTMLElement | null)?.focus?.();
    });
  };

  return (
    <div className="tp" data-tipps style={embedded ? undefined : { paddingTop: 2 }}>
      <div className="tp-tabs" role="tablist" aria-label={t.tablist}>
        {TABS.map(x => (
          <button key={x} type="button" role="tab" id={`tp-tab-${x}`} aria-selected={tab === x} aria-controls="tp-panel"
            className="tp-tab" onClick={() => setTab(x)} data-tip-tab={x}>{t.tab[x]}</button>
        ))}
      </div>
      <div className="tp-body" id="tp-panel" role="tabpanel" aria-labelledby={`tp-tab-${tab}`} ref={bodyRef}>
        {!content ? <p className="tp-loading" role="status">{t.loading}</p> : (
          <TabBody tab={tab} content={content} t={t} lang={lang} hints={hints} openId={openId} setOpenId={setOpenId} onJump={jump} target={target} setTarget={setTarget} />
        )}
      </div>
    </div>
  );
}

function TabBody({ tab, content, t, lang, hints, openId, setOpenId, onJump, target, setTarget }: {
  tab: TipTab; content: TipsContent; t: TippsStrings; lang: UiLang; hints: ContextHint[];
  openId: string | null; setOpenId: (id: string | null) => void; onJump: (h: ContextHint) => void;
  target: Target; setTarget: (x: Target) => void;
}) {
  const all = [...content.cv, ...content.letter];
  const titleOf = (id: TipId) => all.find(x => x.id === id)?.title ?? id;
  const hintIds = new Set(hints.map(h => h.tip));
  const unusualText = PRUEFEN_I18N[lang].unusual;
  const forYou = hints.length > 0 && (tab === 'cv' || tab === 'letter') && (
    <section className="tp-foryou" data-tips-foryou>
      <h3>{t.forYou}</h3>
      <ul>
        {hints.map(h => (
          <li key={h.tip + h.reason}>
            <button type="button" className="tp-jump" onClick={() => onJump(h)} data-jump={h.tip} data-reason={h.reason}>
              <strong>{titleOf(h.tip)}</strong>
              <span>{t.reason[h.reason]}</span>
              {/* In Deutschland Unübliches: je Fund ein Satz mit Grund (check/germanNorms.ts). */}
              {h.unusual?.map(k => <span key={k} className="tp-jump-detail" data-unusual={k}>{unusualText[k]}</span>)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  if (tab === 'cv' || tab === 'letter') {
    const list = tab === 'cv' ? content.cv : content.letter;
    return (
      <>
        <p className="tp-intro">{tab === 'cv' ? content.cvIntro : content.letterIntro}</p>
        {forYou}
        <div className="tp-cards">
          {list.map(tip => (
            <TipCard key={tip.id} tip={tip} t={t} lang={lang} open={openId === tip.id} hint={hintIds.has(tip.id)}
              onToggle={() => setOpenId(openId === tip.id ? null : tip.id)} />
          ))}
        </div>
      </>
    );
  }
  if (tab === 'countries') {
    return (
      <>
        <p className="tp-intro">{content.countriesIntro}</p>
        <div className="tp-target" data-target>
          <label htmlFor="tp-target-select">{t.targetLabel}</label>
          <select id="tp-target-select" value={target} onChange={e => setTarget(e.target.value as Target)} aria-describedby="tp-target-note" data-target-select>
            {content.countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            <option value="other">{t.targetOther}</option>
          </select>
          <p id="tp-target-note">{t.targetNote}</p>
        </div>
        <div className="tp-cards">{content.countries.map(c => <CountryCard key={c.code} c={c} t={t} active={c.code === target} />)}</div>
      </>
    );
  }
  if (tab === 'checklist') return <Checklist content={content} t={t} />;
  return (
    <>
      <p className="tp-intro">{content.promptsIntro}</p>
      <div className="tp-cards">{content.prompts.map(p => <PromptCard key={p.id} p={p} t={t} />)}</div>
    </>
  );
}

function Sources({ ids, t }: { ids: Tip['sources']; t: TippsStrings }) {
  if (!ids?.length) return null;
  return (
    <>
      <h4>{t.sources}</h4>
      <ul>
        {ids.map(id => (
          <li key={id}>
            <a href={SOURCES[id].url} target="_blank" rel="noopener noreferrer">{SOURCES[id].label}</a>
            {' · '}{t.checked(SOURCES[id].checked)}
          </li>
        ))}
      </ul>
    </>
  );
}

function TipCard({ tip, t, lang, open, hint, onToggle }: { tip: Tip; t: TippsStrings; lang: UiLang; open: boolean; hint: boolean; onToggle: () => void }) {
  const paras = tip.body.split(/\n\n+/);
  const hasMore = paras.length > 1 || paras[0].length > 180 || !!tip.before || !!tip.sources?.length || !!tip.magazin?.length || !!tip.magazinEn?.length;
  const bodyId = `tip-${tip.id}-more`;
  return (
    <article className="tp-card" id={`tip-${tip.id}`} data-tip={tip.id} data-hint={hint} data-open={open}>
      <h3 tabIndex={-1}>{tip.title}</h3>
      <p className="tp-lede">{paras[0]}</p>
      {open && (
        <div id={bodyId}>
          {paras.slice(1).map((p, i) => <p key={i}>{p}</p>)}
          {tip.before && tip.after && (
            <div className="tp-ba">
              <div className="tp-ba-before"><b>{t.before}</b>{tip.before}</div>
              <div className="tp-ba-after"><b>{t.after}</b>{tip.after}</div>
            </div>
          )}
          {(tip.sources?.length || tip.magazin?.length || tip.magazinEn?.length) ? (
            <div className="tp-meta">
              <Sources ids={tip.sources} t={t} />
              {(tip.magazin?.length || tip.magazinEn?.length) ? (
                <>
                  <h4>{t.magazin}</h4>
                  <ul>
                    {(tip.magazinEn || []).map(slug => (
                      <li key={slug}>
                        <a href={magazinEnUrl(slug)} target="_blank" rel="noopener" hrefLang="en" data-magazin={slug}>{MAGAZIN_EN[slug]}</a>
                        {lang !== 'en' && t.magazinEnNote ? ` ${t.magazinEnNote}` : ''}
                      </li>
                    ))}
                    {(tip.magazin || []).map(slug => {
                      // Fassung in der Oberflächensprache, wenn es sie gibt; Sprachhinweis nur ohne.
                      const m = magazinLink(slug, lang);
                      return (
                        <li key={slug}>
                          <a href={m.href} target="_blank" rel="noopener" hrefLang={m.lang} data-magazin={slug}>{m.title}</a>
                          {m.lang !== lang && t.magazinLangNote ? ` ${t.magazinLangNote}` : ''}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      {hasMore && (
        <button type="button" className="tp-more" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          {open ? t.less : t.more}
        </button>
      )}
    </article>
  );
}

function CountryCard({ c, t, active }: { c: Country; t: TippsStrings; active: boolean }) {
  return (
    <article className="tp-card tp-country" data-country={c.code} data-active={active}>
      <h3><span className="tp-code" aria-hidden>{c.code}</span>{c.name}</h3>
      <dl>
        {c.rows.map(([k, v]) => (<div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
      <p className="tp-tool"><b>{t.inTool}:</b> {c.tool}</p>
      <div className="tp-meta"><Sources ids={c.sources} t={t} /></div>
    </article>
  );
}

function Checklist({ content, t }: { content: TipsContent; t: TippsStrings }) {
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(CHECK_KEY) || '{}') || {}; } catch { return {}; }
  });
  const save = (next: Record<string, boolean>) => {
    setDone(next);
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(next)); } catch { /* ohne Speicher */ }
  };
  const total = content.checklist.length;
  const n = content.checklist.filter(i => done[i.id]).length;
  return (
    <>
      <p className="tp-intro">{content.checklistIntro}</p>
      <div className="tp-progress">
        <span role="status" data-checklist-progress>{t.done(n, total)}</span>
        {n > 0 && <button type="button" className="tp-reset" onClick={() => save({})}>{t.reset}</button>}
      </div>
      <div className="tp-bar" aria-hidden><span style={{ transform: `scaleX(${total ? n / total : 0})` }} /></div>
      <ul className="tp-checks">
        {content.checklist.map(i => (
          <li key={i.id}>
            <label className="tp-check" data-check={i.id}>
              <input type="checkbox" checked={!!done[i.id]} onChange={e => save({ ...done, [i.id]: e.target.checked })} />
              <span aria-hidden>
                {done[i.id] && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.3 5 8.7 9.6 3.6" /></svg>}
              </span>
              <span>{i.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

function PromptCard({ p, t }: { p: Prompt; t: TippsStrings }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(p.prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };
  return (
    <article className="tp-card tp-prompt" data-prompt={p.id}>
      <div className="tp-prompt-head">
        <h3>{p.title}</h3>
        <button type="button" className="tp-copy" onClick={copy} data-copied={copied} aria-live="polite">{copied ? t.copied : t.copy}</button>
      </div>
      <pre>{p.prompt}</pre>
      {p.note && <p className="tp-note"><b>{t.promptNote}:</b> {p.note}</p>}
    </article>
  );
}
