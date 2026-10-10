/**
 * Vorlagen-Galerie mit echten Miniaturen (Demo-Lebenslauf, erste Seite,
 * fotografiert von scripts/landing-shots.mjs). Zwölf stehen offen, der Rest
 * in einem <details>: funktioniert ohne JavaScript, lädt die übrigen
 * Miniaturen erst beim Aufklappen (loading="lazy" in geschlossenem details).
 *
 * Zahl, Namen, Aufbau und Marke kommen aus templates/theme.ts und
 * templates/atsScore.ts, nicht aus dem Foto-Lauf: Eine neue Vorlage erscheint
 * sofort, ihr Foto mit dem nächsten Lauf.
 *
 * Vorlagen-Staffel (10.10.2026): Mit `passTag` (nur bei aktiver
 * Gratis-Grenze gesetzt) tragen Vorlagen, deren gestaltetes PDF zum Pass
 * gehört, ein Kennzeichen neben der Marke. Welche gratis sind, steht an einer
 * Stelle: templates/freeTemplates.ts.
 */
import { PICKABLE_THEMES, type ResumeTheme } from '../templates/theme';
import { atsLabel, atsLevelForLayout, type AtsLevel } from '../templates/atsScore';
import { isFreeTemplate } from '../templates/freeTemplates';
import { shot } from './shot';
import type { UiLang } from '../ui/i18n';

const OPEN = 12;

/** Reihenfolge für die Galerie: die Marken abwechselnd, damit die ersten
 *  zwölf zeigen, wie verschieden die Vorlagen sind. */
function mixed(themes: ResumeTheme[]): ResumeTheme[] {
  const by: Record<AtsLevel, ResumeTheme[]> = { high: [], medium: [], low: [] };
  for (const t of themes) by[atsLevelForLayout(t.layout)].push(t);
  const order: AtsLevel[] = ['high', 'low', 'medium'];
  const out: ResumeTheme[] = [];
  while (out.length < themes.length) for (const l of order) { const t = by[l].shift(); if (t) out.push(t); }
  return out;
}

export default function Gallery({ lang, showAll, passTag }: { lang: UiLang; showAll: string; passTag?: string }) {
  const list = mixed(PICKABLE_THEMES);
  const tl = lang === 'de' ? 'de' : 'en';
  const card = (t: ResumeTheme, i: number) => {
    const level = atsLevelForLayout(t.layout);
    const img = shot(`thumb-${tl}-${t.id}`) ?? shot(`thumb-de-${t.id}`);
    const structure = t.structure?.[lang] ?? t.structure?.de ?? '';
    return (
      <li key={t.id} className="lp-tpl" data-rv style={{ ['--i' as string]: i % 4 }}>
        <div className="lp-tpl-thumb">
          {img ? (
            <picture>
              <source type="image/avif" srcSet={img.avif.map(([f, w]) => `/landing/${f}?v=${img.v} ${w}w`).join(', ')} sizes="(max-width: 640px) 44vw, 220px" />
              <source type="image/webp" srcSet={img.webp.map(([f, w]) => `/landing/${f}?v=${img.v} ${w}w`).join(', ')} sizes="(max-width: 640px) 44vw, 220px" />
              <img src={`/landing/${(img.png ?? img.webp[0])[0]}?v=${img.v}`} width={img.w} height={img.h} alt="" loading="lazy" decoding="async" />
            </picture>
          ) : <span className="lp-tpl-empty" aria-hidden />}
        </div>
        <div className="lp-tpl-meta">
          <h3 className="lp-tpl-name">{t.name}</h3>
          {structure && <p className="lp-tpl-struct">{structure}</p>}
          <span className={`lp-mark lp-mark-${level}`}><span aria-hidden className="lp-mark-dot" />{atsLabel(level, lang)}</span>
          {passTag && !isFreeTemplate(t.id) && <span className="lp-tpl-pass" data-pass-tag>{passTag}</span>}
        </div>
      </li>
    );
  };
  return (
    <div className="lp-gal">
      <ul className="lp-gal-grid">{list.slice(0, OPEN).map(card)}</ul>
      {list.length > OPEN && (
        <details className="lp-gal-more">
          <summary className="lp-btn lp-btn-soft">{showAll}</summary>
          <ul className="lp-gal-grid">{list.slice(OPEN).map((t, i) => card(t, i))}</ul>
        </details>
      )}
    </div>
  );
}
