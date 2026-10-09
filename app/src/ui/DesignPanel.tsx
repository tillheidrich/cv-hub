import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { PICKABLE_THEMES, ACCENTS, PAPERS, FONT_PAIRING_LIST, getTheme, resolveThemeId, templateStructure } from '../templates/theme';
import { atsLevelForLayout, atsLabel } from '../templates/atsScore';
import { USER_SCALE, FS, FLOOR, MIN_FONT_PX } from '../templates/metrics';
import { PAGE_FORMAT_LIST } from '../data/pageFormats';
import type { AppProfile, CVData, PageMode, PageFormat, SectionKey, FontPairingId } from '../data/types';
import type { FitInfo, EditorTab } from '../preview/DocumentPreview';
import { suggestCuts } from '../preview/shorten';
import { StaticPage } from '../preview/TemplateCarousel';
import type { UiLang } from './i18n';
import { DESIGN_I18N, type DesignStrings } from './i18n/design';
import AtsLine from './AtsLine';
import { ET } from './editorI18n';
import { sectionOrderFor } from '../data/extraSections';
import { extraSectionUiName } from '../editor/extraSectionsText';

type Settings = AppProfile['settings'];
type View = 'main' | 'type' | 'page' | 'sections';
type Cat = 'all' | 'klassisch' | 'modern' | 'kreativ' | 'minimal';

const pt = (px: number) => (px * 0.75).toFixed(1).replace('.', ',');

/**
 * Gestaltung — Vorlagenwahl und Darstellung in einem Paneel.
 *
 * Ersetzt die Vorlagenliste in der Kopfleiste (Name + Farbfleck) und das
 * Darstellungs-Popover mit 44 Bedienelementen in einem Kasten. Gestaltungs-
 * bericht, Bau-Liste 5: Vorlagen als Karten mit echter Miniatur aus dem
 * eigenen Inhalt, Aufbau und ATS-Marke je Karte; Akzent und Papier direkt
 * darunter; Schrift, Seite und Abschnitte als Zeilen, die eine Unteransicht
 * öffnen. Keine Funktion fällt weg — jede steht eine Ebene tiefer.
 */
export default function DesignPanel({ uiLang, settings, onSettings, fit, data, onJump, renderThumb, onLoadAts, onLoadAtsPdf }: {
  uiLang: UiLang;
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  fit: FitInfo | null;
  data: CVData;
  onJump: (tab: EditorTab) => void;
  /** Statische Seite einer Vorlage mit dem eigenen Inhalt (für die Miniatur).
   *  Eine neue Funktion heißt: neuer Inhalt — die Miniaturen rechnen neu. */
  renderThumb: (themeId: string) => React.ReactNode;
  onLoadAts: () => void;
  /** ATS-Fassung als PDF (export/AtsPdfRunner.tsx). */
  onLoadAtsPdf?: () => void;
}) {
  const d = DESIGN_I18N[uiLang];
  const [view, setView] = useState<View>('main');
  const [cat, setCat] = useState<Cat>('all');
  const current = resolveThemeId(settings.template);
  const theme = getTheme(settings.template, settings.accent, settings.paper);
  const level = atsLevelForLayout(theme.layout);
  const pageFormat: PageFormat = settings.pageFormat ?? 'a4';
  const pageMode: PageMode = settings.pageMode ?? 'one';
  const fontScale = settings.fontScale ?? 1;
  const fontPairing: FontPairingId = settings.fontPairing ?? 'auto';
  const order = sectionOrderFor(data, settings.sectionOrder);
  const hidden = settings.hiddenSections ?? [];
  const list = PICKABLE_THEMES.filter(t => cat === 'all' || t.category === cat);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Unteransicht gewechselt: oben anfangen und den Fokus auf „Zurück".
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    if (view !== 'main') bodyRef.current?.querySelector<HTMLButtonElement>('[data-back]')?.focus();
  }, [view]);

  const pairingName = fontPairing === 'auto' ? d.typeFromTemplate : (FONT_PAIRING_LIST.find(p => p.id === fontPairing)?.name ?? '');
  const bodyPt = pt(FS.body * fontScale);
  const formatLabel = PAGE_FORMAT_LIST.find(f => f.id === pageFormat)?.label ?? 'A4';

  const back = (title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 12px 8px' }}>
      <button type="button" data-back className="ui-btn" onClick={() => setView('main')} style={{ paddingLeft: '8px' }}>
        <span aria-hidden>‹</span> {d.back}
      </button>
      <h3 style={{ margin: 0, fontSize: 'var(--t-md)', fontWeight: 620 }}>{title}</h3>
    </div>
  );

  return (
    <div ref={bodyRef} className="ui-panel-body">
      {view === 'main' && (
        <>
          <div className="ui-section" style={{ paddingTop: 4 }}>
            <div className="ui-label">{d.template}<small>{d.keepContent}</small></div>
            <div className="ui-chips" role="group" aria-label={d.template} style={{ marginBottom: '12px' }}>
              {(['all', 'klassisch', 'modern', 'kreativ', 'minimal'] as Cat[]).map(c => (
                <button key={c} type="button" className="ui-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
                  {c === 'all' ? d.filterAll : d.cat[c]}
                </button>
              ))}
            </div>
            <div style={{ padding: '10px 12px', borderRadius: '14px', background: 'oklch(1 0 0 / 0.6)', boxShadow: 'var(--pill-shadow)', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '6px', alignItems: 'baseline' }}>
                <strong style={{ fontWeight: 650 }}>{getTheme(current).name}</strong>
                <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-2)', textAlign: 'right' }}>{templateStructure(getTheme(current), uiLang)}</span>
              </div>
              <AtsLine level={level} uiLang={uiLang} onLoadAts={onLoadAts} onLoadAtsPdf={onLoadAtsPdf} />
            </div>
            <div className="ui-cards" role="radiogroup" aria-label={d.template}>
              {list.map(t => (
                <TemplateCard key={t.id} themeId={t.id} checked={t.id === current} uiLang={uiLang}
                  pageFormat={pageFormat} renderThumb={renderThumb}
                  onPick={() => onSettings({ template: t.id })} />
              ))}
            </div>
          </div>

          <div className="ui-section">
            <div className="ui-label">{d.accent}<small>{settings.accent && settings.accent !== 'auto' ? ACCENTS.find(a => a.id === settings.accent)?.name : d.accentAuto}</small></div>
            <div className="ui-swatches" role="radiogroup" aria-label={d.accent}>
              {ACCENTS.map(a => (
                <button key={a.id} type="button" role="radio" className="ui-swatch"
                  aria-checked={(settings.accent ?? 'auto') === a.id} title={a.id === 'auto' ? d.accentAuto : a.name}
                  aria-label={a.id === 'auto' ? d.accentAuto : a.name}
                  onClick={() => onSettings({ accent: a.id })}
                  style={{ background: a.value ?? `conic-gradient(from 210deg, ${getTheme(current).colors.accent} 0 50%, ${getTheme(current).colors.panelBg} 50% 100%)` }} />
              ))}
            </div>
          </div>

          <div className="ui-section">
            <div className="ui-label">{d.paper}<small>{settings.paper && settings.paper !== 'auto' ? PAPERS.find(p => p.id === settings.paper)?.name : d.paperAuto}</small></div>
            <div className="ui-swatches" role="radiogroup" aria-label={d.paper}>
              {PAPERS.map(p => (
                <button key={p.id} type="button" role="radio" className="ui-swatch"
                  aria-checked={(settings.paper ?? 'auto') === p.id} title={p.id === 'auto' ? d.paperAuto : p.name}
                  aria-label={p.id === 'auto' ? d.paperAuto : p.name}
                  onClick={() => onSettings({ paper: p.id })}
                  style={{ background: p.value ?? `linear-gradient(135deg, #fff 50%, ${getTheme(current, settings.accent).colors.pageBg} 50%)` }} />
              ))}
            </div>
          </div>

          <div style={{ paddingBottom: '8px' }}>
            <button type="button" className="ui-row" onClick={() => setView('type')}>
              {d.rowType}<small>{pairingName} · <span className="ui-num">{bodyPt} pt</span> ›</small>
            </button>
            <button type="button" className="ui-row" onClick={() => setView('page')}>
              {d.rowPage}<small>{formatLabel} · {fit ? d.pagesLabel(fit.pages) : d.pageModes[pageMode]} ›</small>
            </button>
            <button type="button" className="ui-row" onClick={() => setView('sections')}>
              {d.rowSections}<small>{d.visible(order.filter(k => !hidden.includes(k)).length)} ›</small>
            </button>
          </div>
        </>
      )}

      {view === 'type' && (
        <>
          {back(d.rowType)}
          <div className="ui-section">
            <div className="ui-label">{d.fontSize}<small className="ui-num">{bodyPt} pt</small></div>
            <input type="range" min={USER_SCALE.min} max={USER_SCALE.max} step={0.01} value={fontScale}
              aria-label={d.fontSize}
              onChange={e => onSettings({ fontScale: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <div className="ui-num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-xs)', color: 'var(--ink-2)' }}>
              <span>{pt(FS.body * USER_SCALE.min)} pt</span><span>{pt(FS.body)} pt</span><span>{pt(FS.body * USER_SCALE.max)} pt</span>
            </div>
            {FS.body * fontScale * 0.75 < 8.05 && (
              <p className="ui-hint" style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '12px', background: 'var(--ats-low-bg)', color: 'var(--ats-low-ink)' }}>{d.under8pt}</p>
            )}
          </div>
          <div className="ui-section">
            <div className="ui-label">{d.typeface}</div>
            <div role="radiogroup" aria-label={d.typeface} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {FONT_PAIRING_LIST.map(p => (
                <button key={p.id} type="button" role="radio" aria-checked={fontPairing === p.id}
                  className="ui-menu-item" onClick={() => onSettings({ fontPairing: p.id })}
                  style={fontPairing === p.id ? { background: 'var(--accent-wash)' } : undefined}>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{p.id === 'auto' ? d.pairingAuto : p.name}</span>
                    <span className="ui-menu-sub">{p.note}</span>
                  </span>
                  {fontPairing === p.id && <span aria-hidden style={{ color: 'var(--accent-ink)' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {view === 'page' && (
        <>
          {back(d.rowPage)}
          <div className="ui-section">
            <div className="ui-label">{d.format}</div>
            <div role="radiogroup" aria-label={d.format} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {PAGE_FORMAT_LIST.map(f => (
                <button key={f.id} type="button" role="radio" aria-checked={pageFormat === f.id}
                  className="ui-menu-item" onClick={() => onSettings({ pageFormat: f.id })}
                  style={pageFormat === f.id ? { background: 'var(--accent-wash)' } : undefined}>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{f.label}</span>
                    <span className="ui-menu-sub"><span className="ui-num">{f.widthMm} × {f.heightMm} mm</span> · {f.hint}</span>
                  </span>
                  {pageFormat === f.id && <span aria-hidden style={{ color: 'var(--accent-ink)' }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="ui-section">
            <div className="ui-label">{d.pageCount}</div>
            <div className="ui-seg" role="radiogroup" aria-label={d.pageCount} style={{ background: 'oklch(0.30 0.02 250 / 0.06)', width: '100%' }}>
              {(['one', 'two', 'three', 'auto'] as PageMode[]).map(m => (
                <button key={m} type="button" role="radio" aria-checked={pageMode === m} title={d.pageModeHelp[m]}
                  onClick={() => onSettings({ pageMode: m })} style={{ flex: m === 'one' || m === 'two' ? 1.5 : 1 }}>
                  {d.pageModes[m]}
                </button>
              ))}
            </div>
            <p className="ui-hint" style={{ marginTop: '8px' }}>{d.pageModeHelp[pageMode]}</p>
            <div style={{ marginTop: '10px' }}>
              <FitSummary fit={fit} pageMode={pageMode} data={data} onJump={onJump} uiLang={uiLang} />
            </div>
          </div>
        </>
      )}

      {view === 'sections' && (
        <>
          {back(d.rowSections)}
          <SectionsEditor settings={settings} onSettings={onSettings} d={d} data={data} uiLang={uiLang} />
        </>
      )}
    </div>
  );
}

// ── Vorlagenkarte mit echter Miniatur ───────────────────────────────────────

const THUMB_H = 112;

/** Eine Karte. Die Miniatur wird erst gerendert, wenn die Karte ins Bild
 *  kommt (IntersectionObserver) — 26 vollständige Seiten auf einmal kosteten
 *  spürbar Zeit. Danach bleibt sie stehen und folgt dem Inhalt mit der
 *  Verzögerung, mit der App.tsx `renderThumb` erneuert (Tipp-Pause). */
const TemplateCard = memo(function TemplateCard({ themeId, checked, uiLang, pageFormat, renderThumb, onPick }: {
  themeId: string; checked: boolean; uiLang: UiLang; pageFormat: PageFormat;
  renderThumb: (id: string) => React.ReactNode; onPick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  const [w, setW] = useState(140);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  useEffect(() => {
    const el = thumbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const t = getTheme(themeId);
  const level = atsLevelForLayout(t.layout);
  const pagePx = pageFormat === 'letter' || pageFormat === 'legal' ? 816 : pageFormat === 'a5' ? 559 : 794;
  const thumb = useMemo(
    () => (seen ? <StaticPage render={() => renderThumb(themeId)} scale={w / pagePx} pageFormat={pageFormat} height={THUMB_H} /> : null),
    [seen, w, pagePx, pageFormat, themeId, renderThumb],
  );
  return (
    <button ref={ref} type="button" role="radio" aria-checked={checked} className="ui-card" onClick={onPick}
      aria-label={`${t.name}, ${templateStructure(t, uiLang)}, ${atsLabel(level, uiLang)}`}>
      <div ref={thumbRef} className="ui-card-thumb" style={{ background: t.colors.pageBg }}>{thumb}</div>
      <span className="ui-card-name">{t.name}</span>
      <span className="ui-card-meta">{templateStructure(t, uiLang)}</span>
      <span className="ui-badge" data-level={level}>{atsLabel(level, uiLang)}</span>
    </button>
  );
});

// ── Passt es? ───────────────────────────────────────────────────────────────

/** Klartext zur Seitenaufteilung plus Kürzungsvorschläge. Steht in „Seite"
 *  und im Prüfen-Paneel. */
export function FitSummary({ fit, pageMode, data, onJump, uiLang }: {
  fit: FitInfo | null; pageMode: PageMode; data: CVData; onJump: (tab: EditorTab) => void; uiLang: UiLang;
}) {
  const d = DESIGN_I18N[uiLang];
  const et = ET[uiLang];
  const cuts = useMemo(
    () => (fit?.overflow ? suggestCuts(data, fit.overflowLines, fit.charsPerLine) : { cuts: [], covered: 0, deficitChars: 0, hopeless: false }),
    [data, fit],
  );
  if (!fit) return null;
  const wishN = pageMode === 'one' ? 1 : pageMode === 'two' ? 2 : 3;
  const floor = pt(Math.max(MIN_FONT_PX, FS.body * FLOOR.t));
  const tone = fit.overflow ? 'low' : fit.condense > 0.05 ? 'medium' : 'high';
  const text = fit.overflow
    ? d.fitOverflow(d.pagesText(wishN), fit.pages, floor, pageMode === 'one' && fit.pages === 2)
    : fit.condense > 0.05
      ? d.fitCondensed(d.pagesText(fit.pages), pt(FS.body * fit.metrics.t))
      : d.fitOk(d.pagesText(fit.pages), pt(FS.body * fit.metrics.t));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p style={{ margin: 0, fontSize: 'var(--t-sm)', lineHeight: 1.5, color: tone === 'low' ? 'var(--ats-low-ink)' : 'var(--ink-2)' }}>{text}</p>
      {fit.overflow && cuts.cuts.length > 0 && (
        <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'var(--ats-low-bg)', color: 'var(--ats-low-ink)', fontSize: 'var(--t-xs)', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 650, marginBottom: '6px' }}>{et.spTooLong(cuts.deficitChars, fit.overflowLines)}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {cuts.cuts.map((c, i) => (
              <li key={i}>
                <button type="button" onClick={() => onJump(c.tab)}
                  style={{ background: 'none', border: 0, padding: '4px 0', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', minHeight: '28px' }}>
                  <span className="ui-num">−{c.chars}</span> {d.cutChars} · <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>{c.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <p style={{ margin: '6px 0 0' }}>{cuts.hopeless ? d.cutsHopeless : cuts.covered >= fit.overflowLines ? et.spEnough : et.spPartly}</p>
        </div>
      )}
      {!fit.overflow && fit.pages > 1 && fit.lastPageFill < 0.25 && (
        <p className="ui-hint" style={{ margin: 0, color: 'var(--ats-mid-ink)' }}>{d.lastPageThin(fit.pages, Math.round(fit.lastPageFill * 100))}</p>
      )}
    </div>
  );
}

// ── Abschnitte ordnen ───────────────────────────────────────────────────────

function SectionsEditor({ settings, onSettings, d, data, uiLang }: {
  settings: Settings; onSettings: (patch: Partial<Settings>) => void; d: DesignStrings; data: CVData; uiLang: UiLang;
}) {
  const order = sectionOrderFor(data, settings.sectionOrder);
  const hidden = settings.hiddenSections ?? [];
  const pages = settings.sectionPages ?? {};
  const pageMode = settings.pageMode ?? 'one';
  const showPagePicker = pageMode === 'two' || pageMode === 'three';
  const maxPage = pageMode === 'three' ? 3 : 2;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const name = (k: SectionKey) => (d.sectionNames as Partial<Record<SectionKey, string>>)[k] ?? extraSectionUiName(k, uiLang) ?? k;
  /** Tastatur-Alternative zum Ziehen. */
  const move = (idx: number, delta: number) => {
    const next = [...order];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onSettings({ sectionOrder: next });
  };
  const toggle = (k: SectionKey) => onSettings({ hiddenSections: hidden.includes(k) ? hidden.filter(x => x !== k) : [...hidden, k] });
  return (
    <div className="ui-section">
      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', marginBottom: '12px' }}>
        <input type="checkbox" checked={settings.respectTemplateStructure !== false}
          onChange={e => onSettings({ respectTemplateStructure: e.target.checked })}
          style={{ marginTop: '3px', accentColor: 'var(--accent)', width: '16px', height: '16px' }} />
        <span>
          <span style={{ display: 'block', fontWeight: 600 }}>{d.useTemplateOrder}</span>
          <span className="ui-hint">{d.useTemplateOrderHint}</span>
        </span>
      </label>
      <p className="ui-hint" style={{ margin: '0 0 8px' }}>{d.orderHint}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {order.map((key, idx) => {
          const isHidden = hidden.includes(key);
          const isOver = overIdx === idx && dragIdx !== null && dragIdx !== idx;
          return (
            <div key={key}
              onDragOver={e => { if (dragIdx !== null) { e.preventDefault(); setOverIdx(idx); } }}
              onDragLeave={() => { if (overIdx === idx) setOverIdx(null); }}
              onDrop={e => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== idx) {
                  const next = [...order];
                  const [m] = next.splice(dragIdx, 1);
                  next.splice(idx, 0, m);
                  onSettings({ sectionOrder: next });
                }
                setDragIdx(null); setOverIdx(null);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', minHeight: '42px', padding: '0 6px 0 4px',
                borderRadius: '12px', background: 'oklch(1 0 0 / 0.75)',
                boxShadow: isOver ? '0 -2px 0 var(--accent), var(--pill-shadow)' : 'var(--pill-shadow)',
                opacity: isHidden ? 0.6 : dragIdx === idx ? 0.5 : 1,
              }}>
              <span draggable aria-hidden
                onDragStart={e => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                style={{ cursor: 'grab', color: 'var(--ink-3)', padding: '0 6px', userSelect: 'none' }}>⋮⋮</span>
              <span style={{ flex: 1, fontWeight: 560 }}>{name(key)}</span>
              <button type="button" className="ui-btn ui-icon-btn" disabled={idx === 0} onClick={() => move(idx, -1)} aria-label={d.moveUp(name(key))} style={{ width: 32, minWidth: 32, minHeight: 32 }}>↑</button>
              <button type="button" className="ui-btn ui-icon-btn" disabled={idx === order.length - 1} onClick={() => move(idx, 1)} aria-label={d.moveDown(name(key))} style={{ width: 32, minWidth: 32, minHeight: 32 }}>↓</button>
              {showPagePicker && !isHidden && (
                <select value={pages[key] ?? 1} aria-label={`${name(key)}: ${d.rowPage}`}
                  onChange={e => onSettings({ sectionPages: { ...pages, [key]: parseInt(e.target.value, 10) || 1 } })}
                  style={{ minHeight: 30, borderRadius: 8, border: 0, boxShadow: 'inset 0 0 0 1px var(--hair)', background: '#fff', font: 'inherit', fontSize: 'var(--t-xs)', padding: '0 6px' }}>
                  {Array.from({ length: maxPage }, (_, i) => <option key={i + 1} value={i + 1}>{d.pageOf(i + 1)}</option>)}
                </select>
              )}
              <button type="button" className="ui-btn" aria-pressed={!isHidden} onClick={() => toggle(key)}
                aria-label={isHidden ? d.showSection(name(key)) : d.hideSection(name(key))}
                style={{ minHeight: 30, padding: '0 10px', fontSize: 'var(--t-xs)', background: isHidden ? 'transparent' : 'var(--accent-wash)', color: isHidden ? 'var(--ink-2)' : 'var(--accent-ink)' }}>
                {isHidden ? d.hidden : d.shown}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
