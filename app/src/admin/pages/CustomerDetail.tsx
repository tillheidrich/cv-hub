import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { adminFetch, AdminError, downloadUrl, type CustomerDetail as Detail } from '../api';
import { Chip, ErrorNote, Note, OrderStatus, PageHead, Section, Skeleton, Stat } from '../ui';
import { fmtDate, fmtDateTime, fmtEur, fmtInt } from '../format';
import { useLoad } from '../useLoad';

const PLAN_DE: Record<string, string> = { unlimited: 'unbegrenzt', lifetime: 'dauerhaft gratis', pilot: 'Pilot-Platz', pass: 'Bewerbungs-Pass', none: 'kein Pass' };
const SOURCE_DE: Record<string, string> = { order: 'Kauf', voucher: 'Gutschein', pilot: 'Pilot-Einladung', admin: 'von dir', legacy: 'Altbestand' };

type Action = 'grant' | 'disable' | 'reset' | 'confirm' | 'sessions' | 'delete' | null;

/** Dialog mit Formular. Bestätigen ruft `onSubmit` mit den Feldwerten auf. */
function ActionDialog({ open, title, children, confirm, tone, onClose, onSubmit, busy }: {
  open: boolean; title: string; children: ReactNode; confirm: string; tone?: 'danger'; busy: boolean;
  onClose: () => void; onSubmit: (form: FormData) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className="adm-dialog" aria-labelledby={titleId} onClose={onClose}
      onCancel={e => { e.preventDefault(); onClose(); }}>
      <form method="dialog" onSubmit={e => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="adm-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="adm-btn" onClick={onClose}>Abbrechen</button>
          <button type="submit" className="adm-btn" data-kind={tone === 'danger' ? 'danger-solid' : 'primary'} disabled={busy}>{busy ? '…' : confirm}</button>
        </div>
      </form>
    </dialog>
  );
}

export default function CustomerDetail({ id }: { id: number }) {
  const { data: d, error, loading, reload } = useLoad(() => adminFetch<Detail>(`/api/admin/customers/${id}`), `${id}`);
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [grantMode, setGrantMode] = useState<'days' | 'until'>('days');

  async function run(path: string, body: unknown, ok: string, after?: () => void) {
    setBusy(true); setMsg(null);
    try {
      await adminFetch(path, { body });
      setMsg({ tone: 'ok', text: ok });
      setAction(null);
      after?.();
      void reload();
    } catch (e) {
      setMsg({ tone: 'danger', text: e instanceof AdminError ? e.message : 'Hat nicht geklappt.' });
    } finally { setBusy(false); }
  }

  if (!d) return (<><PageHead title="Kunde" /><ErrorNote error={error} onRetry={reload} />{!error && <Skeleton rows={1} />}</>);
  const a = d.account;
  const isAdmin = a.role === 'admin';
  return (
    <>
      <p style={{ margin: '0 0 8px' }}><a href="#/kunden">← Alle Kunden</a></p>
      <PageHead title={a.username} sub={<>Konto #{a.id} · seit {fmtDate(a.createdAt)}{a.disabled ? ' · gesperrt' : ''}</>} asOf={d.asOf} onReload={reload} loading={loading} />
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}

      {!isAdmin && (
        <div className="adm-row" style={{ marginBottom: 20 }} role="group" aria-label="Aktionen">
          <button type="button" className="adm-btn" data-kind="primary" onClick={() => setAction('grant')}>Pass gewähren</button>
          <button type="button" className="adm-btn" onClick={() => setAction('disable')}>{a.disabled ? 'Entsperren' : 'Sperren'}</button>
          <button type="button" className="adm-btn" onClick={() => setAction('reset')} disabled={!a.email}>Passwort-Mail</button>
          {!a.emailConfirmed && <button type="button" className="adm-btn" onClick={() => setAction('confirm')} disabled={!a.email}>Bestätigungsmail</button>}
          <button type="button" className="adm-btn" onClick={() => setAction('sessions')}>Anmeldungen beenden</button>
          <button type="button" className="adm-btn" data-kind="danger" onClick={() => setAction('delete')}>Löschen …</button>
        </div>
      )}

      <div className="adm-split">
        <Section title="Konto">
          <div className="adm-card">
            <dl className="adm-kv">
              <dt>E-Mail</dt><dd>{a.email || '–'} {a.email && (a.emailConfirmed ? <Chip tone="ok">bestätigt</Chip> : <Chip tone="warn">unbestätigt</Chip>)}</dd>
              {a.pendingEmail && (<><dt>Neue Adresse</dt><dd>{a.pendingEmail} <Chip>wartet</Chip></dd></>)}
              <dt>Herkunft</dt><dd>{a.signupSource === 'self' ? 'selbst registriert' : d.inviteCode ? `Einladung ${d.inviteCode}` : (a.signupSource || 'Einladung')}</dd>
              <dt>Zugang</dt><dd>{d.plan ? `${PLAN_DE[d.plan.kind] || d.plan.kind}${d.plan.until ? ` bis ${fmtDate(d.plan.until)}` : ''}` : (a.accessUntil ? `bis ${fmtDate(a.accessUntil)}` : 'unbegrenzt')}</dd>
              <dt>Zwei-Faktor</dt><dd>{a.twofaEnabled ? 'an' : 'aus'}</dd>
              <dt>Zuletzt da</dt><dd>{fmtDateTime(a.lastSeenAt)}</dd>
              <dt>Passwort geändert</dt><dd>{fmtDateTime(a.passwordChangedAt)}</dd>
              {a.ageConfirmed16At && (<><dt>16+ bestätigt</dt><dd>{fmtDate(a.ageConfirmed16At)}</dd></>)}
              <dt>AGB bei Registrierung</dt><dd>{a.termsAcceptedVersion ? `Fassung ${a.termsAcceptedVersion}${a.termsAcceptedAt ? `, ${fmtDate(a.termsAcceptedAt)}` : ''}` : 'nicht erfasst (Bestand)'}</dd>
              <dt>Einwilligung Art. 9</dt><dd>{a.art9ConsentAt ? `erteilt ${fmtDateTime(a.art9ConsentAt)} (Fassung ${a.art9ConsentVersion ?? '–'})` : a.art9WithdrawnAt ? `widerrufen ${fmtDateTime(a.art9WithdrawnAt)}` : 'fehlt (Konto speichert nicht)'}</dd>
            </dl>
          </div>
        </Section>
        <Section title="Bestand">
          <div className="adm-grid">
            <Stat label="Lebensläufe" value={fmtInt(d.counts.resumes)} sub={`${fmtInt(d.counts.versions)} Fassungen`} />
            <Stat label="Fotos" value={fmtInt(d.counts.photos)} />
            <Stat label="Sharelinks" value={fmtInt(d.counts.shares)} />
            <Stat label="Schlüssel und KI" value={fmtInt(d.counts.api_keys + d.counts.connections)} sub={`${d.counts.api_keys} Schlüssel, ${d.counts.connections} Verbindungen`} />
          </div>
        </Section>
      </div>

      <Section title="Zugänge">
        {d.grants.length === 0 ? <p className="adm-empty">Keine Berechtigungen.</p> : (
          <div className="adm-table-wrap" tabIndex={0}>
            <table className="adm-table">
              <caption className="adm-sr">Berechtigungen dieses Kontos</caption>
              <thead><tr><th scope="col">Herkunft</th><th scope="col">Art</th><th scope="col">Abschnitt</th><th scope="col">Gewährt</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {d.grants.map(g => (
                  <tr key={g.id}>
                    <td>{SOURCE_DE[g.source] || g.source}{g.created_by ? <div className="adm-muted">von {g.created_by}</div> : null}</td>
                    <td>{g.kind === 'days' ? `${g.days} Tage` : g.kind === 'lifetime' ? 'dauerhaft' : g.until_at ? `bis ${fmtDate(g.until_at)}` : 'unbegrenzt'}</td>
                    <td>{g.effective_from ? `${fmtDate(g.effective_from)} – ${fmtDate(g.effective_until)}` : '–'}</td>
                    <td>{fmtDate(g.granted_at)}</td>
                    <td>{g.revoked_at ? <Chip tone="danger">widerrufen</Chip> : g.ends_at ? <Chip tone="warn">endet {fmtDate(g.ends_at)}</Chip> : <Chip tone="ok">gilt</Chip>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Käufe und Rechnungen">
        {d.orders.length === 0 ? <p className="adm-empty">Keine Bestellungen.</p> : (
          <div className="adm-table-wrap" tabIndex={0}>
            <table className="adm-table">
              <caption className="adm-sr">Bestellungen dieses Kontos</caption>
              <thead><tr><th scope="col">Bestellung</th><th scope="col">Status</th><th scope="col" className="r">Betrag</th><th scope="col">Bezahlt</th><th scope="col">Rechnung</th></tr></thead>
              <tbody>
                {d.orders.map(o => (
                  <tr key={o.id}>
                    <td>{o.orderNo}<div className="adm-muted">{fmtDateTime(o.createdAt)}</div></td>
                    <td><OrderStatus status={o.status} />{o.cancelledAt && <div className="adm-muted">gekündigt zum {fmtDate(o.cancelEffectiveAt)}</div>}</td>
                    <td className="num">{fmtEur(o.amountCents)}</td>
                    <td>{fmtDate(o.paidAt)}</td>
                    <td>{o.invoiceNo ? <a href={downloadUrl(`/api/admin/billing/orders/${o.id}/invoice.pdf`)} download>{o.invoiceNo}</a> : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="adm-split">
        <Section title="Gutscheine">
          {d.vouchers.length === 0 ? <p className="adm-empty">Keine eingelöst.</p> : (
            <ul className="adm-card" style={{ listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.vouchers.map((v, i) => <li key={i}>{v.voucher}{v.campaign ? ` · ${v.campaign}` : ''} <span className="adm-muted">({v.kind === 'lifetime' ? 'dauerhaft' : `${v.days} Tage`}, {fmtDate(v.redeemed_at)})</span></li>)}
            </ul>
          )}
        </Section>
        <Section title="Letzte Anmeldungen">
          {d.logins.length === 0 ? <p className="adm-empty">Keine erfasst.</p> : (
            <ul className="adm-card" style={{ listStyle: 'none', margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.logins.map(t => <li key={t} className="adm-num" style={{ fontSize: 13 }}>{fmtDateTime(t)}</li>)}
            </ul>
          )}
        </Section>
      </div>

      <ActionDialog open={action === 'grant'} title="Pass gewähren oder verlängern" confirm="Gewähren" busy={busy} onClose={() => setAction(null)}
        onSubmit={f => {
          const reason = String(f.get('reason') || '').trim();
          const body = grantMode === 'days' ? { days: Number(f.get('days')), reason } : { until: String(f.get('until') || '') || null, reason };
          void run(`/api/admin/customers/${id}/grant`, body, 'Zugang geändert.');
        }}>
        <span className="adm-seg" role="group" aria-label="Art">
          <button type="button" aria-pressed={grantMode === 'days'} onClick={() => setGrantMode('days')}>Tage dazu</button>
          <button type="button" aria-pressed={grantMode === 'until'} onClick={() => setGrantMode('until')}>Enddatum</button>
        </span>
        {grantMode === 'days' ? (
          <div className="adm-field"><label htmlFor="adm-g-days">Tage</label><input id="adm-g-days" name="days" type="number" min={1} max={3650} defaultValue={30} required /></div>
        ) : (
          <div className="adm-field"><label htmlFor="adm-g-until">Bis einschließlich</label><input id="adm-g-until" name="until" type="date" /><p className="adm-hint">Leer lassen heißt unbegrenzt.</p></div>
        )}
        <div className="adm-field"><label htmlFor="adm-g-reason">Grund (Pflicht, steht im Protokoll)</label><input id="adm-g-reason" name="reason" required minLength={3} maxLength={300} placeholder="z. B. Kulanz nach Supportfall" /></div>
      </ActionDialog>

      <ActionDialog open={action === 'disable'} title={a.disabled ? 'Konto entsperren?' : 'Konto sperren?'} confirm={a.disabled ? 'Entsperren' : 'Sperren'} tone={a.disabled ? undefined : 'danger'} busy={busy}
        onClose={() => setAction(null)} onSubmit={() => void run(`/api/admin/customers/${id}/disable`, { disabled: !a.disabled }, a.disabled ? 'Entsperrt.' : 'Gesperrt. Die Person bekommt eine Mail.')}>
        <p className="adm-hint">{a.disabled ? 'Danach kann sich die Person wieder anmelden.' : 'Die Person kann sich nicht mehr anmelden und bekommt eine Mail. Daten bleiben.'}</p>
      </ActionDialog>

      <ActionDialog open={action === 'reset'} title="Mail zum Zurücksetzen schicken?" confirm="Mail schicken" busy={busy} onClose={() => setAction(null)}
        onSubmit={() => void run(`/api/admin/customers/${id}/password-reset-mail`, {}, 'Mail ist raus.')}>
        <p className="adm-hint">Geht an {a.email}. Der Link gilt 60 Minuten. Das Passwort selbst siehst du nie.</p>
      </ActionDialog>

      <ActionDialog open={action === 'confirm'} title="Bestätigungsmail erneut schicken?" confirm="Mail schicken" busy={busy} onClose={() => setAction(null)}
        onSubmit={() => void run(`/api/admin/customers/${id}/resend-confirmation`, {}, 'Mail ist raus.')}>
        <p className="adm-hint">Geht an {a.email}. Ältere Links werden damit ungültig.</p>
      </ActionDialog>

      <ActionDialog open={action === 'sessions'} title="Alle Anmeldungen beenden?" confirm="Beenden" tone="danger" busy={busy} onClose={() => setAction(null)}
        onSubmit={f => void run(`/api/admin/customers/${id}/end-sessions`, { includeKeys: f.get('keys') === 'on' }, 'Alle Anmeldungen beendet.')}>
        <p className="adm-hint">Die Person ist auf allen Geräten abgemeldet, offene Login-Codes verfallen. Das Passwort bleibt.</p>
        <label className="adm-row" style={{ gap: 8 }}><input type="checkbox" name="keys" /> Auch API-Schlüssel und KI-Verbindungen trennen</label>
      </ActionDialog>

      <ActionDialog open={action === 'delete'} title="Konto endgültig löschen" confirm="Endgültig löschen" tone="danger" busy={busy} onClose={() => setAction(null)}
        onSubmit={f => void run(`/api/admin/customers/${id}/delete`, { confirmUsername: String(f.get('confirm') || '') }, 'Konto gelöscht.', () => { location.hash = '#/kunden'; })}>
        <p className="adm-hint">Lebensläufe, Fassungen, Fotos, Sharelinks und Schlüssel sind danach weg. Bezahlte Bestellungen bleiben ohne Konto stehen (Aufbewahrungspflicht). Rückgängig machen geht nicht.</p>
        <div className="adm-field"><label htmlFor="adm-del">Tippe zur Bestätigung den Nutzernamen: <strong>{a.username}</strong></label><input id="adm-del" name="confirm" autoComplete="off" required /></div>
      </ActionDialog>
    </>
  );
}
