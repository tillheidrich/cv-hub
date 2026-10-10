// Kleine Bausteine des Admin-Bereichs. Deutsch, Du-Form, knapp.
import type { ReactNode } from 'react';
import { fmtDateTime } from './format';

export function Stand({ asOf, onReload, loading }: { asOf?: string | null; onReload?: () => void; loading?: boolean }) {
  return (
    <span className="adm-row">
      <span className="adm-stand" title="Zeitpunkt, zu dem die Zahlen gelesen wurden">Stand <b>{asOf ? fmtDateTime(asOf) : '…'}</b></span>
      {onReload && <button type="button" className="adm-btn" data-kind="ghost" onClick={onReload} disabled={loading}>{loading ? 'Lädt …' : 'Neu laden'}</button>}
    </span>
  );
}

export function PageHead({ title, sub, asOf, onReload, loading, children }: {
  title: string; sub?: ReactNode; asOf?: string | null; onReload?: () => void; loading?: boolean; children?: ReactNode;
}) {
  return (
    <header className="adm-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="adm-row">
        {children}
        {(asOf !== undefined || onReload) && <Stand asOf={asOf} onReload={onReload} loading={loading} />}
      </div>
    </header>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'danger' | 'accent' }) {
  return (
    <div className="adm-stat" data-tone={tone}>
      <dl style={{ margin: 0 }}>
        <dt>{label}</dt>
        <dd data-text={typeof value === 'string' && /[a-zäöü]{3}/i.test(value) ? '' : undefined}>{value}{sub !== undefined && <span className="adm-sub">{sub}</span>}</dd>
      </dl>
    </div>
  );
}

export function Note({ tone, children }: { tone?: 'danger' | 'ok' | 'warn'; children: ReactNode }) {
  return <p className="adm-note" data-tone={tone} role={tone === 'danger' ? 'alert' : undefined}>{children}</p>;
}

export function ErrorNote({ error, onRetry }: { error: string | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="adm-note" data-tone="danger" role="alert">
      {error} {onRetry && <button type="button" className="adm-btn" data-kind="ghost" onClick={onRetry}>Noch mal</button>}
    </div>
  );
}

export function Skeleton({ rows = 2 }: { rows?: number }) {
  return <div aria-busy="true" aria-label="Lädt" className="adm-grid">{Array.from({ length: rows * 3 }, (_, i) => <div key={i} className="adm-skel" />)}</div>;
}

export function Chip({ tone, children }: { tone?: 'ok' | 'warn' | 'danger' | 'accent'; children: ReactNode }) {
  return <span className="adm-chip" data-tone={tone}>{children}</span>;
}

const ORDER_STATUS: Record<string, [string, 'ok' | 'warn' | 'danger' | 'accent' | undefined]> = {
  paid: ['bezahlt', 'ok'], open: ['offen', undefined], pending: ['ausstehend', 'warn'], authorized: ['autorisiert', 'warn'],
  canceled: ['abgebrochen', undefined], expired: ['verfallen', undefined], failed: ['fehlgeschlagen', 'danger'],
  withdrawn: ['widerrufen', 'warn'], refunded: ['erstattet', 'accent'],
};
export function OrderStatus({ status }: { status: string }) {
  const [label, tone] = ORDER_STATUS[status] || [status, undefined];
  return <Chip tone={tone}>{label}</Chip>;
}

export function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="adm-section" aria-label={title}>
      <h2>{title}{extra}</h2>
      {children}
    </section>
  );
}

export function RangePicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <span className="adm-seg" role="group" aria-label="Zeitraum">
      {[30, 90, 365].map(d => (
        <button key={d} type="button" aria-pressed={value === d} onClick={() => onChange(d)}>{d === 365 ? '1 Jahr' : `${d} Tage`}</button>
      ))}
    </span>
  );
}
