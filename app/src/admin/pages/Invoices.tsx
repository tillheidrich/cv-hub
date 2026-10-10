import { useState } from 'react';
import { adminFetch, downloadUrl, type Invoices as InvoicesData } from '../api';
import { Chip, ErrorNote, OrderStatus, PageHead, Section, Skeleton } from '../ui';
import { fmtDate, fmtEur } from '../format';
import { useLoad } from '../useLoad';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export default function Invoices() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState<number | 0>(0);
  const { data: d, error, loading, reload } = useLoad(
    () => adminFetch<InvoicesData>(`/api/admin/invoices?year=${year}${month ? `&month=${month}` : ''}`), `${year}|${month}`,
  );
  const years = Array.from(new Set([thisYear, ...(d?.years || [])])).sort((a, b) => b - a);
  const csv = downloadUrl(`/api/admin/invoices.csv?year=${year}${month ? `&month=${month}` : ''}`);
  return (
    <>
      <PageHead title="Rechnungen" sub="Für die Steuerberatung: Liste, CSV und Prüfung der Nummern." asOf={d?.asOf} onReload={reload} loading={loading} />
      <ErrorNote error={error} onRetry={reload} />
      <div className="adm-card adm-row" style={{ marginBottom: 20, alignItems: 'flex-end' }}>
        <div className="adm-field" style={{ width: 120 }}>
          <label htmlFor="adm-inv-y">Jahr</label>
          <select id="adm-inv-y" value={year} onChange={e => setYear(Number(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
        <div className="adm-field" style={{ width: 160 }}>
          <label htmlFor="adm-inv-m">Monat</label>
          <select id="adm-inv-m" value={month} onChange={e => setMonth(Number(e.target.value))}>
            <option value={0}>ganzes Jahr</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <a className="adm-btn" data-kind="primary" href={csv} download>CSV herunterladen</a>
        <p className="adm-hint" style={{ flexBasis: '100%' }}>
          Semikolon-getrennt, UTF-8, Excel-tauglich. Spalten: Rechnungsnummer, Datum, Bestellnummer, Betrag, Währung, Kleinunternehmer-Hinweis, Land, Zahlungsart, Status, Storno-Bezug, Erstattung. Namen und Adressen stehen bewusst nicht drin.
        </p>
      </div>

      <Section title="Nummernkreis">
        {!d ? <Skeleton rows={1} /> : d.gaps.length === 0 ? <p className="adm-empty">Noch keine Rechnungen.</p> : (
          <div className="adm-grid">
            {d.gaps.map(g => (
              <div key={g.year} className="adm-stat" data-tone={g.ok ? undefined : 'danger'}>
                <dl style={{ margin: 0 }}>
                  <dt>{g.year}</dt>
                  <dd>{g.ok ? 'lückenlos' : 'prüfen'}<span className="adm-sub">
                    {g.count} Rechnungen, Zähler {g.counter}
                    {g.missing.length ? ` · fehlt: ${g.missing.slice(0, 10).join(', ')}${g.missing.length > 10 ? ' …' : ''}` : ''}
                    {g.duplicates.length ? ` · doppelt: ${g.duplicates.join(', ')}` : ''}
                  </span></dd>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Rechnungen ${month ? `${MONTHS[month - 1]} ` : ''}${year}`} extra={d ? <Chip>{fmtEur(d.sumCents)} netto ohne Widerrufe</Chip> : null}>
        {!d ? <Skeleton rows={1} /> : d.invoices.length === 0 ? <p className="adm-empty">Keine Rechnungen in diesem Zeitraum.</p> : (
          <div className="adm-table-wrap" tabIndex={0}>
            <table className="adm-table">
              <caption className="adm-sr">Rechnungen im gewählten Zeitraum</caption>
              <thead><tr><th scope="col">Nummer</th><th scope="col">Datum</th><th scope="col" className="r">Betrag</th><th scope="col">Land</th><th scope="col">Status</th><th scope="col">PDF</th></tr></thead>
              <tbody>
                {d.invoices.map(o => (
                  <tr key={o.id}>
                    <td className="adm-num">{o.invoiceNo}<div className="adm-muted">{o.orderNo}</div></td>
                    <td>{fmtDate(o.paidAt)}</td>
                    <td className="num">{fmtEur(o.amountCents)}</td>
                    <td>{o.country}</td>
                    <td><OrderStatus status={o.status} />{o.withdrawnAt && <div className="adm-muted">Widerruf {fmtDate(o.withdrawnAt)}</div>}</td>
                    <td>
                      {o.creditNoteNo ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <a href={downloadUrl(`/api/admin/billing/orders/${o.id}/invoice.pdf`)} download style={{ display: 'inline-block', minHeight: 24, lineHeight: '24px' }}>laden</a>
                          <a href={downloadUrl(`/api/admin/billing/orders/${o.id}/credit-note.pdf`)} download style={{ display: 'inline-block', minHeight: 24, lineHeight: '24px' }}>Storno {o.creditNoteNo}</a>
                        </div>
                      ) : <a href={downloadUrl(`/api/admin/billing/orders/${o.id}/invoice.pdf`)} download>laden</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="adm-hint" style={{ marginTop: 8 }}>
          Bei einem Widerruf gibt es bisher keine eigene Storno-Rechnung. Die CSV nennt deshalb in „Storno-Bezug“ den Widerruf mit Datum und die ursprüngliche Rechnungsnummer. Ob das reicht, klärt die Steuerberatung.
        </p>
      </Section>
    </>
  );
}
