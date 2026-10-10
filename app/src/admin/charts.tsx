// Eigene, leichte Diagramme als SVG (keine Bibliothek, kein CDN).
import { useMemo, useState } from 'react';
import { fmtDate, fmtInt } from './format';

export interface Point { day: string; value: number }

/** Säulen je Tag. Beim Zeigen mit Maus oder Finger erscheint der Tageswert. */
export function DayBars({ title, points, format = fmtInt, total }: {
  title: string; points: Point[]; format?: (n: number) => string; total?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 150;
  const PAD_B = 2;
  const PAD_T = 8;
  const max = useMemo(() => Math.max(1, ...points.map(p => p.value)), [points]);
  const sum = useMemo(() => points.reduce((s, p) => s + p.value, 0), [points]);
  const n = points.length || 1;
  const step = W / n;
  const bw = Math.max(1, step * 0.72);
  const scaleY = (v: number) => (v / max) * (H - PAD_B - PAD_T);
  const first = points[0]?.day;
  const last = points[points.length - 1]?.day;
  const peak = points.reduce((b, p) => (p.value > b.value ? p : b), { day: '', value: -1 });
  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left) / r.width) * n);
    setHover(i >= 0 && i < n ? i : null);
  };
  const h = hover !== null ? points[hover] : null;
  return (
    <figure className="adm-card" style={{ margin: 0 }}>
      <div className="adm-chart-head">
        <h3>{title}</h3>
        <span className="adm-num">{total ?? format(sum)}</span>
      </div>
      <svg
        className="adm-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`${title}: ${format(sum)} von ${fmtDate(first)} bis ${fmtDate(last)}${peak.value > 0 ? `, höchster Tag ${fmtDate(peak.day)} mit ${format(peak.value)}` : ''}`}
        onMouseMove={e => pick(e.clientX, e.currentTarget)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={e => pick(e.touches[0].clientX, e.currentTarget)}
        onTouchMove={e => pick(e.touches[0].clientX, e.currentTarget)}
        style={{ height: 140 }}
      >
        <line className="grid" vectorEffect="non-scaling-stroke" x1="0" x2={W} y1={H - PAD_B + 0.5} y2={H - PAD_B + 0.5} />
        <line className="grid" vectorEffect="non-scaling-stroke" x1="0" x2={W} y1={PAD_T + 0.5} y2={PAD_T + 0.5} strokeDasharray="3 4" />
        {points.map((p, i) => {
          const bh = scaleY(p.value);
          return (
            <rect
              key={p.day} className="bar" x={i * step + (step - bw) / 2} y={H - PAD_B - bh} width={bw} height={Math.max(bh, p.value > 0 ? 1.5 : 0)}
              rx={Math.min(2, bw / 3)} opacity={hover === null || hover === i ? 1 : 0.45}
            />
          );
        })}
      </svg>
      <div className="adm-axis" aria-hidden="true">
        <span>{fmtDate(first)}</span>
        <span>Spitze {format(max)}</span>
        <span>{fmtDate(last)}</span>
      </div>
      <figcaption className="adm-tip" aria-live="polite">{h ? `${fmtDate(h.day)}: ${format(h.value)}` : ' '}</figcaption>
    </figure>
  );
}

/** Waagerechte Balken für Verteilungen (Vorlagen, Sprachen, Schnittstellen). */
export function HBars({ rows, empty = 'Noch keine Daten.' }: { rows: { label: string; n: number; title?: string }[]; empty?: string }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  if (!rows.length) return <p className="adm-empty">{empty}</p>;
  return (
    <ul className="adm-bars" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {rows.map(r => (
        <li key={r.label} className="adm-barrow" title={r.title}>
          <span>{r.label}</span>
          <span className="track" aria-hidden="true"><span className="fill" style={{ display: 'block', width: `${(r.n / max) * 100}%` }} /></span>
          <span className="adm-num">{fmtInt(r.n)}</span>
        </li>
      ))}
    </ul>
  );
}
