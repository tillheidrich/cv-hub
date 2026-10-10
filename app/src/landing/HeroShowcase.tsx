/**
 * Hero-Bild: echtes Bildschirmfoto des Editors in einem Rahmen, darin eine
 * kurze Animation „Vorlage wechseln, Inhalt bleibt": Drei Fotos derselben
 * Demo in drei Vorlagen blenden ineinander, die Pille unten nennt Vorlage
 * und Marke.
 *
 * Leistung: Das erste Foto ist das LCP-Bild (eager, fetchpriority high) und
 * steht schon im vorgerenderten HTML. Die beiden anderen kommen erst nach
 * dem Laden der Seite dazu, die Animation läuft nur, solange das Bild zu
 * sehen ist und der Tab offen ist, und gar nicht bei prefers-reduced-motion
 * oder auf schmalen Fenstern (dort steht das Telefonfoto).
 */
import { useEffect, useRef, useState } from 'react';
import Picture from './Picture';
import { shot } from './shot';
import { atsLabel, atsLevelForLayout, type AtsLevel } from '../templates/atsScore';
import { getTheme } from '../templates/theme';
import type { UiLang } from '../ui/i18n';

const FRAMES = [
  { key: 'hero-a', template: 'espoo' },
  { key: 'hero-b', template: 'hamburg' },
  { key: 'hero-c', template: 'berlin' },
] as const;

interface Props { lang: UiLang; alt: string; chipText: string; chipAts: string }

export default function HeroShowcase({ lang, alt, chipText, chipAts }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);
  const [extra, setExtra] = useState(false);
  const a = shot(`hero-a-${lang}`) ?? shot('hero-a-de');
  const phone = shot(`phone-${lang}`) ?? shot('phone-de');
  const frames = FRAMES.map(f => ({ ...f, img: shot(`${f.key}-${lang}`) ?? shot(`${f.key}-de`) }));

  // Weitere Fotos erst nach dem Laden der Seite, damit sie nicht mit dem
  // LCP-Bild um die Leitung konkurrieren.
  useEffect(() => {
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 760px)').matches; } catch { /* ignore */ }
    if (reduce) return;
    const go = () => setExtra(true);
    if (document.readyState === 'complete') { const t = window.setTimeout(go, 600); return () => window.clearTimeout(t); }
    window.addEventListener('load', go, { once: true });
    return () => window.removeEventListener('load', go);
  }, []);

  useEffect(() => {
    if (!extra) return;
    const el = ref.current;
    let visible = true;
    const io = el && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.2 })
      : null;
    if (io && el) io.observe(el);
    const id = window.setInterval(() => {
      if (!visible || document.hidden) return;
      setFrame(f => (f + 1) % FRAMES.length);
    }, 3800);
    return () => { window.clearInterval(id); io?.disconnect(); };
  }, [extra]);

  if (!a) return null;
  const cur = frames[frame];
  const theme = getTheme(cur.template);
  const level: AtsLevel = atsLevelForLayout(theme.layout);
  return (
    <div className="lp-show" ref={ref}>
      <div className="lp-bezel">
        <div className="lp-bezel-in">
          <Picture
            img={a}
            alt={alt}
            priority
            sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1080px) calc(100vw - 64px), 780px"
            mobile={phone ? { img: phone, media: '(max-width: 760px)', sizes: 'min(86vw, 360px)' } : null}
            className="lp-show-base"
          />
          {extra && frames.slice(1).map((f, i) => f.img && (
            <Picture key={f.key} img={f.img} alt="" sizes="(max-width: 1080px) calc(100vw - 64px), 780px"
              className={`lp-show-frame${frame === i + 1 ? ' is-on' : ''}`} />
          ))}
        </div>
      </div>
      <p className="lp-show-cap" aria-live="off">
        <span className="lp-show-name">{theme.name}</span>
        <span className={`lp-mark lp-mark-${level}`}><span aria-hidden className="lp-mark-dot" />{atsLabel(level, lang)}</span>
      </p>
      <span className="lp-float lp-float-a" aria-hidden><Tick />{chipText}</span>
      <span className="lp-float lp-float-b" aria-hidden><Tick />{chipAts}</span>
    </div>
  );
}

function Tick() {
  return <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
