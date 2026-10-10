/**
 * „So liest ein ATS": die echte Textebene des Demo-PDFs, zweimal ausgelesen
 * (scripts/landing-shots.mjs → shots.gen.ts). Links die gespeicherte
 * Reihenfolge, rechts die Lesart nach Lage, in der Zeilen der Seitenspalte
 * zwischen die Stationen rutschen. Nichts davon ist gestellt; die Zeilen
 * kommen so aus pdftotext.
 */
import { TEXTLAYER, type TextLine } from './shots.gen';
import type { LandingCopy } from './copy';
import type { UiLang } from '../ui/i18n';

export default function TextLayer({ lang, t }: { lang: UiLang; t: LandingCopy['ats'] }) {
  const tl = TEXTLAYER[lang] ?? TEXTLAYER.de;
  if (!tl) return null;
  return (
    <div className="lp-tl">
      <Pane title={t.oursTitle} sub={t.oursSub(tl.name)} foot={t.oursFoot} lines={tl.raw} sideLabel={t.sideLabel} tone="ok" />
      <Pane title={t.layoutTitle} sub={t.layoutSub} foot={t.layoutFoot} lines={tl.layout} sideLabel={t.sideLabel} tone="mix" />
    </div>
  );
}

function Pane({ title, sub, foot, lines, sideLabel, tone }: { title: string; sub: string; foot: string; lines: TextLine[]; sideLabel: string; tone: 'ok' | 'mix' }) {
  return (
    <figure className={`lp-tl-pane lp-tl-${tone}`} data-rv>
      <figcaption>
        <span className="lp-tl-title">{title}</span>
        <span className="lp-tl-sub">{sub}</span>
      </figcaption>
      <ol className="lp-tl-lines" aria-label={title}>
        {lines.map((l, i) => (
          <li key={i} className={l.side ? 'is-side' : undefined} style={{ ['--i' as string]: i }} data-rv>
            <span className="lp-tl-no" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
            <span className="lp-tl-text">
              {l.side && <span className="lp-sr">{sideLabel}: </span>}
              {l.t}
            </span>
            {l.side && <span className="lp-tl-tag" aria-hidden>{sideLabel}</span>}
          </li>
        ))}
      </ol>
      <p className="lp-tl-foot">{foot}</p>
    </figure>
  );
}
