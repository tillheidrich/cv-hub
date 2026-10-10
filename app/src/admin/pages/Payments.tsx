import { useState } from 'react';
import { adminFetch, AdminError, type Payments as PaymentsData } from '../api';
import { Chip, ErrorNote, Note, OrderStatus, PageHead, Section, Skeleton } from '../ui';
import { fmtDate, fmtDateTime, fmtEur } from '../format';
import { useLoad } from '../useLoad';

const FILTERS: [string, string][] = [['', 'Alle'], ['paid', 'Bezahlt'], ['open', 'Offen'], ['withdrawn', 'Widerrufen'], ['refunded', 'Erstattet'], ['canceled', 'Abgebrochen'], ['expired', 'Verfallen'], ['failed', 'Fehlgeschlagen']];
const METHOD_DE: Record<string, string> = { creditcard: 'Kreditkarte', paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', banktransfer: 'Überweisung' };

/** Mollie-Dashboard für eine Zahlung (öffnet sich im eigenen Mollie-Login). */
const mollieLink = (id: string) => `https://my.mollie.com/dashboard/payments/${encodeURIComponent(id)}`;

export default function Payments() {
  const [status, setStatus] = useState('');
  const { data: d, error, loading, reload } = useLoad(() => adminFetch<PaymentsData>(`/api/admin/payments?status=${status}`), `${status}`);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, what: 'sync' | 'refund-retry') {
    setBusy(id + what); setMsg(null);
    try {
      const r = await adminFetch<{ changed?: boolean; mismatch?: boolean; status?: string }>(`/api/admin/payments/${id}/${what}`, { body: {} });
      setMsg({ tone: 'ok', text: what === 'sync' ? (r.mismatch ? 'Mollie meldet eine andere Zahlung. Nichts übernommen, bitte im Dashboard prüfen.' : r.changed ? 'Abgeglichen, Status aktualisiert.' : 'Abgeglichen, nichts geändert.') : `Erstattung angestoßen (${r.status}).` });
      void reload();
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof AdminError ? e.message : 'Hat nicht geklappt.' });
    } finally { setBusy(null); }
  }

  const rec = d?.reconcile;
  return (
    <>
      <PageHead title="Zahlungen" sub={d?.mollieMode ? `Mollie im ${d.mollieMode === 'live' ? 'Live' : 'Test'}modus` : 'Mollie ist nicht eingerichtet.'} asOf={d?.asOf} onReload={reload} loading={loading} />
      <ErrorNote error={error} onRetry={reload} />
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}

      <Section title="Abgleich">
        {!rec ? <Skeleton rows={1} /> : (
          <div className="adm-grid-2">
            <div className="adm-card">
              <h3 style={{ margin: '0 0 6px', fontSize: 13.5 }}>Bezahlt, aber kein Zugang {rec.paidNoAccess.length ? <Chip tone="danger">{rec.paidNoAccess.length}</Chip> : <Chip tone="ok">passt</Chip>}</h3>
              {rec.paidNoAccess.length === 0 ? <p className="adm-hint">Jede bezahlte Bestellung hat ihren Zugang.</p> : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>{rec.paidNoAccess.map(o => <li key={o.id}>{o.order_no} · <a href={`#/kunden/${o.user_id}`}>Konto #{o.user_id}</a> · bezahlt {fmtDate(o.paid_at)}</li>)}</ul>
              )}
            </div>
            <div className="adm-card">
              <h3 style={{ margin: '0 0 6px', fontSize: 13.5 }}>Zugang, aber nicht bezahlt {rec.accessNotPaid.length ? <Chip tone="danger">{rec.accessNotPaid.length}</Chip> : <Chip tone="ok">passt</Chip>}</h3>
              {rec.accessNotPaid.length === 0 ? <p className="adm-hint">Kein Kauf-Zugang ohne bezahlte Bestellung.</p> : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>{rec.accessNotPaid.map(g => <li key={g.grant_id}><a href={`#/kunden/${g.user_id}`}>Konto #{g.user_id}</a> · {g.order_no || 'Bestellung fehlt'} ({g.status || '–'})</li>)}</ul>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section title="Alle Zahlungen" extra={
        <span className="adm-seg" role="group" aria-label="Status filtern" style={{ textTransform: 'none', letterSpacing: 0, flexWrap: 'wrap' }}>
          {FILTERS.map(([v, l]) => <button key={v || 'all'} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
        </span>
      }>
        {!d ? <Skeleton rows={1} /> : d.payments.length === 0 ? <p className="adm-empty">Keine Zahlungen.</p> : (
          <div className="adm-table-wrap" tabIndex={0}>
            <table className="adm-table">
              <caption className="adm-sr">Bestellungen und Zahlungen, neueste zuerst</caption>
              <thead><tr><th scope="col">Bestellung</th><th scope="col">Status</th><th scope="col" className="r">Betrag</th><th scope="col">Land · Art</th><th scope="col">Konto</th><th scope="col">Aktion</th></tr></thead>
              <tbody>
                {d.payments.map(o => (
                  <tr key={o.id}>
                    <td>{o.orderNo}<div className="adm-muted">{fmtDateTime(o.createdAt)}</div></td>
                    <td><OrderStatus status={o.status} />{o.refundStatus && <div className="adm-muted">Erstattung: {o.refundStatus}</div>}</td>
                    <td className="num">{fmtEur(o.amountCents)}</td>
                    <td>{o.country}{o.method ? ` · ${METHOD_DE[o.method] || o.method}` : ''}</td>
                    <td>{o.userId ? <a href={`#/kunden/${o.userId}`}>#{o.userId}</a> : <span className="adm-muted">gelöscht</span>}</td>
                    <td>
                      <div className="adm-row" style={{ gap: 6 }}>
                        {o.molliePaymentId && <button type="button" className="adm-btn" onClick={() => void act(o.id, 'sync')} disabled={busy === o.id + 'sync'}>Abgleichen</button>}
                        {o.status === 'withdrawn' && !o.refundStatus?.startsWith('refund') && o.refundStatus !== 'pending' && (
                          <button type="button" className="adm-btn" onClick={() => void act(o.id, 'refund-retry')} disabled={busy === o.id + 'refund-retry'}>Erstattung neu</button>
                        )}
                        {o.molliePaymentId && <a className="adm-btn" data-kind="ghost" href={mollieLink(o.molliePaymentId)} target="_blank" rel="noopener noreferrer">Mollie ↗</a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="adm-hint" style={{ marginTop: 8 }}>
          Bei einem Widerruf stößt der Dienst die Erstattung selbst an; hängt eine, kannst du sie hier neu anstoßen. Kulanz-Erstattungen ohne Widerruf gehen nur im Mollie-Dashboard, und davon erfährt der Dienst nichts: Status und Steuerexport zeigen sie dann nicht. Den Zugang begrenzt du in dem Fall beim Kunden mit „Pass gewähren“ und einem Enddatum.
        </p>
      </Section>
    </>
  );
}
