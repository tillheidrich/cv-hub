import { useMemo } from 'react';
import { useTemplateNav } from './carouselNav';
import { getTheme, templateStructure } from '../templates/theme';
import { atsLabel, atsLevelForLayout } from '../templates/atsScore';
import type { PageFormat } from '../data/types';
import type { UiLang } from '../ui/i18n';
import { DESIGN_I18N } from '../ui/i18n/design';
import AtsLine from '../ui/AtsLine';
import { pageSizePx } from './scale';

/**
 * Vorlagen-Karussell: links und rechts der Seite die Nachbarvorlagen mit dem
 * EIGENEN Inhalt, angeschnitten; darunter eine Leiste mit ‹ ›, Name, Aufbau
 * und ATS-Hinweis.
 *
 * Die Nachbarn sind billig: ohne `pageBlocks` rendert `ResumeRenderer` alles
 * auf eine feste Seitenhöhe — kein Messlauf, kein Umbruch. Sie rechnen erst
 * nach einer Tipp-Pause von 500 ms neu, damit das Schreiben flüssig bleibt
 * (`useSettled`).
 *
 * Pfeiltasten wirken NUR, solange der Fokus in der Leiste liegt — nie global,
 * sonst spränge beim Schreiben die Vorlage.
 */

/** Statische, angeschnittene Seite einer Vorlage in gegebenem Maßstab. */
export function StaticPage({ render, scale, pageFormat, height }: {
  render: () => React.ReactNode; scale: number; pageFormat: PageFormat; height?: number;
}) {
  const page = pageSizePx(pageFormat);
  return (
    <div aria-hidden inert style={{ width: `${page.w * scale}px`, height: `${height ?? page.h * scale}px`, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ width: `${page.w}px`, height: `${page.h}px`, overflow: 'hidden', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {render()}
      </div>
    </div>
  );
}

/** Die beiden Nachbarn — gehört in die Bühne der Leinwand. */
export function CarouselNeighbours({ scale, pageFormat, prevId, nextId, renderTemplate, onPick, uiLang }: {
  scale: number; pageFormat: PageFormat; prevId: string; nextId: string;
  renderTemplate: (themeId: string) => React.ReactNode;
  onPick: (id: string, dir: -1 | 1) => void;
  uiLang: UiLang;
}) {
  const d = DESIGN_I18N[uiLang];
  const page = pageSizePx(pageFormat);
  const s = scale * 0.9;
  const w = page.w * s;
  const h = page.h * s;
  const top = (page.h * scale - h) / 2;
  const side = (id: string, dir: -1 | 1) => (
    <div
      key={`${dir}-${id}`}
      className="ui-neighbour"
      title={d.neighbour(getTheme(id).name)}
      onClick={() => onPick(id, dir)}
      style={{
        top: `${top}px`, width: `${w}px`, height: `${h}px`,
        ...(dir < 0 ? { right: `calc(100% + ${Math.round(28 * scale + 12)}px)` } : { left: `calc(100% + ${Math.round(28 * scale + 12)}px)` }),
        boxShadow: 'var(--page-shadow)',
      }}
    >
      <StaticPage render={() => renderTemplate(id)} scale={s} pageFormat={pageFormat} />
    </div>
  );
  return (
    <>
      {side(prevId, -1)}
      {side(nextId, 1)}
    </>
  );
}

/** Die Leiste unter der Seite. `compact` = Telefon-Pille. */
export function CarouselBar({ current, onStep, uiLang, onLoadAts, compact }: {
  current: string; onStep: (dir: -1 | 1) => void; uiLang: UiLang;
  onLoadAts?: () => void; compact?: boolean;
}) {
  const d = DESIGN_I18N[uiLang];
  const nav = useTemplateNav(current);
  const theme = nav.list[nav.idx];
  const level = atsLevelForLayout(theme.layout);
  const live = useMemo(
    () => d.carouselLive(theme.name, nav.idx + 1, nav.n, atsLabel(level, uiLang)),
    [d, theme.name, nav.idx, nav.n, level, uiLang],
  );
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); onStep(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); onStep(1); }
  };
  const arrow = (dir: -1 | 1) => (
    <button type="button" className="ui-carousel-nav" onClick={() => onStep(dir)}
      aria-label={dir < 0 ? d.prevTemplate : d.nextTemplate}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
      </svg>
    </button>
  );
  return (
    <div role="group" aria-label={d.carouselLabel} onKeyDown={onKeyDown}
      className="ui-float ui-carousel-bar" data-carousel
      style={compact ? { borderRadius: '22px', padding: '6px' } : { borderRadius: '22px', width: 'min(580px, 100%)', margin: '0 auto' }}>
      {arrow(-1)}
      {compact ? (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', rowGap: '2px' }}>
          <span style={{ fontWeight: 650, fontSize: 'var(--t-md)', color: 'var(--ink)' }}>{theme.name}</span>
          <span className="ui-num" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-2)' }}>{nav.idx + 1}/{nav.n}</span>
          <AtsLine level={level} uiLang={uiLang} compact />
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'center' }}>
            <span style={{ fontWeight: 650, fontSize: 'var(--t-lg)', color: 'var(--ink)' }}>{theme.name}</span>
            <span className="ui-num" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-2)' }}>{nav.idx + 1} / {nav.n}</span>
          </div>
          <div style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-2)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {templateStructure(theme, uiLang)}
          </div>
          <div style={{ marginTop: '2px' }}><AtsLine level={level} uiLang={uiLang} onLoadAts={onLoadAts} /></div>
        </div>
      )}
      {arrow(1)}
      <span className="cv-sr-only" role="status" aria-live="polite">{live}</span>
    </div>
  );
}
