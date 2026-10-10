import { useState } from 'react';
import { adminFetch, AdminError, type Declaration } from '../api';
import { Chip, ErrorNote, Note, PageHead, Skeleton } from '../ui';
import { fmtDateTime } from '../format';
import { useLoad } from '../useLoad';

const TYPE_DE: Record<string, string> = { withdrawal: 'Widerruf', cancellation: 'Kündigung', payment: 'Zahlung' };
const STATUS: Record<string, [string, 'ok' | 'warn' | 'danger' | undefined]> = {
  manual: ['von Hand', 'danger'], done: ['erledigt', 'ok'], processed: ['automatisch erledigt', 'ok'], pending_confirmation: ['offen, unbestätigt', 'warn'],
};
const FILTERS: [string, string][] = [['', 'Alle'], ['manual', 'Von Hand'], ['pending_confirmation', 'Offen, unbestätigt'], ['processed', 'Automatisch'], ['done', 'Erledigt']];

export default function Declarations() {
  const [status, setStatus] = useState('');
  const { data: d, error, loading, reload } = useLoad(() => adminFetch<{ asOf: string; declarations: Declaration[] }>(`/api/admin/declarations?status=${status}`), `${status}`);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);

  async function resolve(id: string) {
    setMsg(null);
    try {
      await adminFetch(`/api/admin/billing/declarations/${id}/resolve`, { body: { note: notes[id] || '' } });
      setMsg({ tone: 'ok', text: 'Als erledigt markiert.' });
      void reload();
    } catch (e) { setMsg({ tone: 'danger', text: e instanceof AdminError ? e.message : 'Hat nicht geklappt.' }); }
  }

  return (
    <>
      <PageHead title="Widerrufe und Kündigungen" sub="Jede Erklärung im Wortlaut. „Von Hand“ heißt: Der Dienst konnte sie keiner Bestellung zuordnen." asOf={d?.asOf} onReload={reload} loading={loading}>
        <span className="adm-seg" role="group" aria-label="Status filtern">
          {FILTERS.map(([v, l]) => <button key={v || 'all'} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}>{l}</button>)}
        </span>
      </PageHead>
      <ErrorNote error={error} onRetry={reload} />
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      {!d ? <Skeleton rows={1} /> : d.declarations.length === 0 ? <p className="adm-empty">Keine Erklärungen.</p> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {d.declarations.map(x => {
            const [label, tone] = STATUS[x.status] || [x.status, undefined];
            return (
              <li key={x.id} className="adm-card">
                <div className="adm-row" style={{ justifyContent: 'space-between' }}>
                  <strong>{TYPE_DE[x.type] || x.type}{x.order_no ? ` · ${x.order_no}` : ''}</strong>
                  <span className="adm-row"><Chip tone={tone}>{label}</Chip><span className="adm-hint">{fmtDateTime(x.received_at)} · {x.channel}</span></span>
                </div>
                <div className="adm-hint" style={{ marginTop: 4 }}>
                  {x.name || '–'}{x.email ? ` · ${x.email}` : ''}{x.user_id ? <> · <a href={`#/kunden/${x.user_id}`}>Konto #{x.user_id}</a></> : ''}
                  {x.resolved_at ? ` · erledigt ${fmtDateTime(x.resolved_at)}` : ''}{x.note ? ` · Notiz: ${x.note}` : ''}
                </div>
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13 }}>Wortlaut</summary>
                  <p className="adm-statement">{x.statement}</p>
                </details>
                {x.status === 'manual' && (
                  <div className="adm-row" style={{ marginTop: 10 }}>
                    <label htmlFor={`adm-note-${x.id}`} className="adm-sr">Notiz zur Erledigung</label>
                    <input id={`adm-note-${x.id}`} className="adm-input" placeholder="Notiz, z. B. per Mail erstattet" value={notes[x.id] || ''}
                      onChange={e => setNotes({ ...notes, [x.id]: e.target.value })} style={{ maxWidth: 380 }} maxLength={500} />
                    <button type="button" className="adm-btn" data-kind="primary" onClick={() => void resolve(x.id)}>Erledigt</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
