import { useState } from 'react';
import { adminFetch, AdminError, type AccessRequestRow, type CodeStats, type InviteRow } from '../api';
import { Chip, ErrorNote, Note, PageHead, Section, Skeleton } from '../ui';
import { fmtDate, fmtDateTime } from '../format';
import { useLoad } from '../useLoad';

/** Einladungscodes und Zugangsanfragen (aus dem alten Admin-Panel übernommen). */
export default function Access() {
  const { data: d, error, loading, reload } = useLoad(async () => {
    const [inv, req, cs] = await Promise.all([
      adminFetch<{ invites: InviteRow[] }>('/api/admin/invites'),
      adminFetch<{ requests: AccessRequestRow[] }>('/api/admin/access-requests'),
      adminFetch<{ codes: CodeStats[] }>('/api/admin/invite-stats'),
    ]);
    return { invites: inv.invites, requests: req.requests, codes: cs.codes, asOf: new Date().toISOString() };
  });
  const [maxUses, setMaxUses] = useState(1);
  const [days, setDays] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [allCodes, setAllCodes] = useState(false);

  async function doit(fn: () => Promise<string>) {
    setBusy(true); setMsg(null);
    try { setMsg({ tone: 'ok', text: await fn() }); void reload(); }
    catch (e) { setMsg({ tone: 'danger', text: e instanceof AdminError ? e.message : 'Hat nicht geklappt.' }); }
    finally { setBusy(false); }
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    const accessDays = days.trim() ? Number.parseInt(days, 10) : undefined;
    void doit(async () => {
      const r = await adminFetch<{ code: string; emailed: boolean }>('/api/admin/invites', { body: { maxUses, note: note.trim() || undefined, email: email.trim() || undefined, accessDays } });
      const to = email.trim();
      setNote(''); setDays(''); setEmail('');
      return to ? (r.emailed ? `Code ${r.code} an ${to} geschickt.` : `Code ${r.code} erzeugt, aber die Mail ging nicht raus. Bitte selbst weitergeben.`) : `Code ${r.code} erzeugt.`;
    });
  }

  const pending = d?.requests.filter(r => r.status === 'pending') || [];
  const codes = (d?.codes || []).filter(c => allCodes || c.max_uses > 1 || c.access_days !== null);
  return (
    <>
      <PageHead title="Einladungen und Anfragen" sub="Codes für Pilot-Plätze und Anfragen ohne Konto." asOf={d?.asOf} onReload={reload} loading={loading} />
      <ErrorNote error={error} onRetry={reload} />
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}

      <Section title={`Zugangsanfragen${pending.length ? ` (${pending.length} offen)` : ''}`}>
        {!d ? <Skeleton rows={1} /> : d.requests.length === 0 ? <p className="adm-empty">Keine Anfragen.</p> : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.requests.map(r => (
              <li key={r.id} className="adm-card" style={{ opacity: r.status === 'pending' ? 1 : 0.7 }}>
                <div className="adm-row" style={{ justifyContent: 'space-between' }}>
                  <span><strong>{r.name}</strong> · <a href={`mailto:${r.email}`}>{r.email}</a></span>
                  {r.status === 'pending' ? (
                    <span className="adm-row">
                      <button type="button" className="adm-btn" data-kind="primary" disabled={busy} onClick={() => void doit(async () => {
                        const x = await adminFetch<{ code: string; emailed: boolean }>(`/api/admin/access-requests/${r.id}/accept`, { body: {} });
                        return x.emailed ? `Angenommen, Code ${x.code} ist raus.` : `Angenommen, Code ${x.code}. Die Mail ging nicht raus.`;
                      })}>Annehmen</button>
                      <button type="button" className="adm-btn" data-kind="danger" disabled={busy} onClick={() => void doit(async () => {
                        await adminFetch(`/api/admin/access-requests/${r.id}/reject`, { body: {} });
                        return 'Abgelehnt. Die Person bekommt keine Nachricht.';
                      })}>Ablehnen</button>
                    </span>
                  ) : <Chip tone={r.status === 'accepted' ? 'ok' : undefined}>{r.status === 'accepted' ? `angenommen${r.invite_code ? ` · ${r.invite_code}` : ''}` : 'abgelehnt'}</Chip>}
                </div>
                {r.message && <p className="adm-statement">{r.message}</p>}
                <p className="adm-hint" style={{ marginTop: 6 }}>{fmtDateTime(r.created_at)}{r.ua_summary ? ` · ${r.ua_summary}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Neuer Einladungscode">
        <form className="adm-card" onSubmit={create} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', alignItems: 'end' }}>
          <div className="adm-field"><label htmlFor="adm-i-uses">Plätze</label><input id="adm-i-uses" type="number" min={1} max={500} value={maxUses} onChange={e => setMaxUses(Math.max(1, Number.parseInt(e.target.value, 10) || 1))} /></div>
          <div className="adm-field"><label htmlFor="adm-i-days">Laufzeit je Platz (Tage)</label><input id="adm-i-days" type="number" min={1} max={3650} placeholder="unbegrenzt" value={days} onChange={e => setDays(e.target.value)} /></div>
          <div className="adm-field"><label htmlFor="adm-i-note">Notiz</label><input id="adm-i-note" maxLength={160} placeholder="z. B. Pilot Coach" value={note} onChange={e => setNote(e.target.value)} /></div>
          <div className="adm-field"><label htmlFor="adm-i-mail">Direkt per Mail (optional)</label><input id="adm-i-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <button type="submit" className="adm-btn" data-kind="primary" disabled={busy}>{email.trim() ? 'Erzeugen und schicken' : 'Code erzeugen'}</button>
          <p className="adm-hint" style={{ gridColumn: '1 / -1' }}>Die Laufzeit zählt je Konto ab dem Einlösen. Vor Ablauf bekommt die Person zwei Mails, danach kann sie lesen und exportieren, aber nichts mehr ändern.</p>
        </form>
      </Section>

      <Section title="Auswertung je Code" extra={<label className="adm-row" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, gap: 6 }}><input type="checkbox" checked={allCodes} onChange={e => setAllCodes(e.target.checked)} /> auch Einzel-Codes</label>}>
        {!d ? <Skeleton rows={1} /> : codes.length === 0 ? <p className="adm-empty">Noch kein Code mit mehreren Plätzen oder Laufzeit.</p> : (
          <div className="adm-table-wrap" tabIndex={0}>
            <table className="adm-table">
              <caption className="adm-sr">Zählungen je Einladungscode, ohne Namen</caption>
              <thead><tr><th scope="col">Code</th><th scope="col" className="r">Plätze</th><th scope="col" className="r">Tage</th><th scope="col" className="r">Aktiv 14 T</th><th scope="col" className="r">Export</th><th scope="col" className="r">Link</th><th scope="col" className="r">Abgelaufen</th></tr></thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.code} style={{ opacity: c.revoked ? 0.55 : 1 }}>
                    <td><code className="adm-num">{c.code}</code>{c.note && <div className="adm-muted">{c.note}</div>}</td>
                    <td className="num">{c.redeemed}/{c.max_uses}</td>
                    <td className="num">{c.access_days ?? '∞'}</td>
                    <td className="num">{c.active14d}</td>
                    <td className="num">{c.with_export}</td>
                    <td className="num">{c.with_share}</td>
                    <td className="num">{c.expired}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Alle Codes">
        {!d ? <Skeleton rows={1} /> : d.invites.length === 0 ? <p className="adm-empty">Noch keine Codes.</p> : (
          <div className="adm-table-wrap" tabIndex={0}>
            <table className="adm-table">
              <caption className="adm-sr">Einladungscodes</caption>
              <thead><tr><th scope="col">Code</th><th scope="col">Genutzt</th><th scope="col">Angelegt</th><th scope="col">Aktion</th></tr></thead>
              <tbody>
                {d.invites.map(c => {
                  const live = !c.revoked && c.uses < c.max_uses;
                  return (
                    <tr key={c.code} style={{ opacity: live ? 1 : 0.55 }}>
                      <td><code className="adm-num">{c.code}</code>{c.note && <div className="adm-muted">{c.note}</div>}</td>
                      <td>{c.uses}/{c.max_uses}{c.access_days ? ` · ${c.access_days} Tage` : ''}{c.revoked ? ' · widerrufen' : ''}</td>
                      <td>{fmtDate(c.created_at)}{c.expires_at ? <div className="adm-muted">einlösbar bis {fmtDate(c.expires_at)}</div> : null}</td>
                      <td className="adm-row" style={{ gap: 6 }}>
                        <button type="button" className="adm-btn" onClick={() => void navigator.clipboard?.writeText(c.code).then(() => setMsg({ tone: 'ok', text: `${c.code} kopiert.` }), () => setMsg({ tone: 'danger', text: 'Kopieren ging nicht.' }))}>Kopieren</button>
                        {live && <button type="button" className="adm-btn" data-kind="danger" onClick={() => { if (window.confirm(`Code ${c.code} widerrufen?`)) void doit(async () => { await adminFetch(`/api/admin/invites/${encodeURIComponent(c.code)}/revoke`, { body: {} }); return `${c.code} widerrufen.`; }); }}>Widerrufen</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
