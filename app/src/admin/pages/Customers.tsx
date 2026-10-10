import { useEffect, useState } from 'react';
import { adminFetch, type Customers as CustomersData } from '../api';
import { Chip, ErrorNote, PageHead, Skeleton } from '../ui';
import { fmtDate, fmtInt, relDays } from '../format';
import { useLoad } from '../useLoad';

export default function Customers() {
  const [q, setQ] = useState(() => new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '');
  const [query, setQuery] = useState(q);
  const [offset, setOffset] = useState(0);
  // Suche erst nach kurzer Pause, nicht bei jedem Tastendruck.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setOffset(0); }, 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data: d, error, loading, reload } = useLoad(
    () => adminFetch<CustomersData>(`/api/admin/customers?q=${encodeURIComponent(query)}&offset=${offset}`), `${query}|${offset}`,
  );
  return (
    <>
      <PageHead title="Kunden" sub="Suche nach Name, E-Mail, Nutzername oder Konto-Nummer." asOf={d?.asOf} onReload={reload} loading={loading} />
      <form role="search" onSubmit={e => { e.preventDefault(); setQuery(q.trim()); }} className="adm-row" style={{ marginBottom: 14 }}>
        <label htmlFor="adm-q" className="adm-sr">Kunden suchen</label>
        <input id="adm-q" className="adm-input" type="search" placeholder="z. B. lena@ oder 42" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 420 }} autoComplete="off" />
        <span className="adm-hint">{d ? `${fmtInt(d.total)} Treffer` : ''}</span>
      </form>
      <ErrorNote error={error} onRetry={reload} />
      {!d ? <Skeleton rows={1} /> : d.customers.length === 0 ? <p className="adm-empty">Niemand gefunden.</p> : (
        <div className="adm-table-wrap" tabIndex={0}>
          <table className="adm-table">
            <caption className="adm-sr">Kunden, neueste zuerst</caption>
            <thead>
              <tr><th scope="col">Konto</th><th scope="col">Zugang</th><th scope="col" className="r">Lebensläufe</th><th scope="col" className="r">Käufe</th><th scope="col">Zuletzt da</th><th scope="col">Seit</th></tr>
            </thead>
            <tbody>
              {d.customers.map(c => (
                <tr key={c.id}>
                  <td>
                    <a href={`#/kunden/${c.id}`}><strong>{c.username}</strong></a>{' '}
                    {c.role === 'admin' && <Chip tone="accent">Admin</Chip>}{' '}
                    {c.disabled && <Chip tone="danger">gesperrt</Chip>}{' '}
                    {!c.email_confirmed && <Chip tone="warn">unbestätigt</Chip>}
                    <div className="adm-muted">{c.email || 'ohne E-Mail'}{c.pending_email ? ` → ${c.pending_email}` : ''}</div>
                  </td>
                  <td>{c.plan_kind === 'lifetime' ? <Chip tone="ok">dauerhaft</Chip> : c.access_until ? (new Date(c.access_until) > new Date() ? <span>bis {fmtDate(c.access_until)}</span> : <span className="adm-muted">abgelaufen {fmtDate(c.access_until)}</span>) : <span className="adm-muted">{c.role === 'admin' ? '–' : 'unbegrenzt'}</span>}</td>
                  <td className="num">{c.resumes}</td>
                  <td className="num">{c.paid_orders}</td>
                  <td>{c.last_seen_at ? relDays(c.last_seen_at) : <span className="adm-muted">nie</span>}</td>
                  <td>{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d && d.total > 50 && (
        <div className="adm-row" style={{ marginTop: 12 }}>
          <button type="button" className="adm-btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Zurück</button>
          <span className="adm-hint">{offset + 1}–{Math.min(offset + 50, d.total)} von {fmtInt(d.total)}</span>
          <button type="button" className="adm-btn" disabled={offset + 50 >= d.total} onClick={() => setOffset(offset + 50)}>Weiter</button>
        </div>
      )}
    </>
  );
}
