import { useState } from 'react';
import { adminFetch, AdminError, type AuditEntry, type SystemStatus } from '../api';
import { Chip, ErrorNote, Note, PageHead, Section, Skeleton, Stat } from '../ui';
import { fmtDateTime, fmtEur } from '../format';
import { useLoad } from '../useLoad';

const ACTION_DE: Record<string, string> = {
  admin_login: 'Anmeldung', admin_login_failed: 'Anmeldung fehlgeschlagen', admin_logout: 'Abmeldung',
  customer_view: 'Kunde angesehen', customer_grant: 'Pass gewährt', customer_disable: 'Konto gesperrt', customer_enable: 'Konto entsperrt',
  customer_password_reset_mail: 'Passwort-Mail', customer_resend_confirmation: 'Bestätigungsmail', customer_end_sessions: 'Anmeldungen beendet',
  customer_delete: 'Konto gelöscht', payment_sync: 'Zahlung abgeglichen', refund_retry: 'Erstattung neu', invoices_csv: 'CSV-Export',
  invoice_pdf: 'Rechnung geladen', test_mail: 'Testmail', user_access: 'Laufzeit geändert',
  voucher_create: 'Gutschein angelegt', voucher_deactivate: 'Gutschein deaktiviert',
};

export default function System() {
  const sys = useLoad(() => adminFetch<SystemStatus>('/api/admin/system'));
  const audit = useLoad(() => adminFetch<{ asOf: string; entries: AuditEntry[]; retentionDays: number }>('/api/admin/audit'));
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const s = sys.data;

  async function testMail() {
    setBusy(true); setMsg(null);
    try {
      const r = await adminFetch<{ ok: boolean; to: string }>('/api/admin/system/test-mail', { body: {} });
      setMsg({ tone: 'ok', text: `Testmail an ${r.to} ist raus.` });
      void audit.reload();
    } catch (e) { setMsg({ tone: 'danger', text: e instanceof AdminError ? e.message : 'Mail ging nicht raus.' }); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="System" sub="Was eingerichtet ist und was fehlt. Nur Namen, nie Werte. Schalter bleiben in Coolify." asOf={s?.asOf} onReload={() => { void sys.reload(); void audit.reload(); }} loading={sys.loading} />
      <ErrorNote error={sys.error} onRetry={sys.reload} />
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      {!s ? <Skeleton /> : (
        <>
          <Section title="Schalter (nur Anzeige)">
            <div className="adm-grid">
              <Stat label="Verkauf" value={s.billing.ready ? 'an' : s.billing.enabled ? 'an, unvollständig' : 'aus'} tone={s.billing.enabled && !s.billing.ready ? 'warn' : undefined}
                sub={`BILLING_ENABLED${s.billing.mollieMode ? ` · Mollie ${s.billing.mollieMode}` : ''}`} />
              <Stat label="Registrierung" value={s.registration?.open ? 'offen' : 'nur mit Einladung'} tone={s.registration?.openVar && !s.registration.botProtection ? 'warn' : undefined}
                sub={s.registration?.openVar && !s.registration.botProtection ? 'OPEN_REGISTRATION an, aber Bot-Schutz fehlt' : 'OPEN_REGISTRATION'} />
              <Stat label="Gratis-Grenze" value={s.billing.freeTierLimits ? 'an' : 'aus'} sub="FREE_TIER_LIMITS" />
              <Stat label="Preis" value={s.billing.priceCents ? fmtEur(s.billing.priceCents) : '–'} sub={s.billing.days ? `${s.billing.days} Tage` : undefined} />
              <Stat label="Mail" value={s.mail.configured ? 'eingerichtet' : 'fehlt'} tone={s.mail.configured ? undefined : 'danger'} />
              <Stat label="Aufräumjob" value={s.janitor.lastRunAt ? fmtDateTime(s.janitor.lastRunAt) : 'noch nicht'} tone={s.janitor.lastError ? 'danger' : undefined} sub={s.janitor.lastError || 'beim Start und täglich'} />
            </div>
          </Section>

          {s.legal && (
            <Section title="Vertragstexte (wirksame Fassung)">
              <div className="adm-grid">
                <Stat label="AGB" value={s.legal.terms ?? 'fehlt'} tone={!s.legal.terms ? 'danger' : s.legal.source.terms === 'env' ? 'warn' : undefined}
                  sub={s.legal.source.terms === 'env' ? `aus TERMS_VERSION (Datei: ${s.legal.file.terms ?? '–'})` : 'aus legal-texts.json'} />
                <Stat label="Widerrufsbelehrung" value={s.legal.withdrawal ?? 'fehlt'} tone={!s.legal.withdrawal ? 'danger' : s.legal.source.withdrawal === 'env' ? 'warn' : undefined}
                  sub={s.legal.source.withdrawal === 'env' ? `aus WITHDRAWAL_VERSION (Datei: ${s.legal.file.withdrawal ?? '–'})` : 'aus legal-texts.json'} />
                <Stat label="Einwilligung Art. 9" value={s.legal.art9Consent} sub="Fassung im Dienst (consent.js)" />
                {s.billing.euB2cStopCents != null && <Stat label="Sperre EU-Ausland" value={fmtEur(s.billing.euB2cStopCents)} sub="EU_B2C_STOP_CENTS" />}
              </div>
              {s.legal.warnings.map(w => <Note key={w} tone="warn">{w}</Note>)}
            </Section>
          )}

          <Section title="Was fehlt">
            {s.missing.length === 0 && s.billing.missing.length === 0 ? <Note tone="ok">Alles da.</Note> : (
              <div className="adm-card">
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {s.missing.map(m => <li key={m.name}><code className="adm-num">{m.name}</code> <span className="adm-hint" style={{ display: 'inline' }}>für {m.why}</span></li>)}
                  {s.billing.missing.map(m => <li key={m}><code className="adm-num">{m}</code> <span className="adm-hint" style={{ display: 'inline' }}>für den Verkauf</span></li>)}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Admin-Bereich">
            <div className="adm-card">
              <dl className="adm-kv">
                <dt>Modus</dt><dd>{s.admin.mode === 'separate' ? <Chip tone="ok">eigene Adresse</Chip> : <Chip tone="warn">über die App (ohne ADMIN_HOST)</Chip>}</dd>
                <dt>Adresse</dt><dd>{s.admin.url || '–'}</dd>
                <dt>Codes gehen an</dt><dd>{s.admin.email || 'die Adresse im Admin-Konto'}</dd>
                <dt>Sitzung</dt><dd>{s.admin.sessionHours} Stunden, {s.admin.idleMinutes} Minuten ohne Klick</dd>
                <dt>Erlaubte Netze</dt><dd>{s.admin.allowedIps.length ? s.admin.allowedIps.join(', ') : 'alle (ADMIN_ALLOWED_IPS leer)'}{s.admin.invalidIps.length ? ` · ungültig: ${s.admin.invalidIps.join(', ')}` : ''}</dd>
                <dt>Proxy</dt><dd>{s.trustProxy ? 'TRUST_PROXY gesetzt' : 'TRUST_PROXY fehlt'}</dd>
                <dt>Version</dt><dd>{s.version?.commit || 'Commit unbekannt'} · Node {s.version?.node} · seit {fmtDateTime(s.version?.startedAt)}</dd>
                <dt>Besucher</dt><dd>{s.umamiUrl ? <a href={s.umamiUrl} target="_blank" rel="noopener noreferrer">Umami öffnen</a> : 'UMAMI_DASHBOARD_URL nicht gesetzt'}</dd>
              </dl>
              <div className="adm-row" style={{ marginTop: 12 }}>
                <button type="button" className="adm-btn" onClick={() => void testMail()} disabled={busy}>{busy ? 'Schicke …' : 'Testmail an mich'}</button>
              </div>
            </div>
          </Section>
        </>
      )}

      <Section title="Protokoll" extra={audit.data ? <Chip>{audit.data.retentionDays} Tage aufbewahrt</Chip> : null}>
        <ErrorNote error={audit.error} onRetry={audit.reload} />
        {!audit.data ? <Skeleton rows={1} /> : audit.data.entries.length === 0 ? <p className="adm-empty">Noch keine Einträge.</p> : (
          <div className="adm-table-wrap" tabIndex={0}>
            <table className="adm-table">
              <caption className="adm-sr">Admin-Aktionen, neueste zuerst</caption>
              <thead><tr><th scope="col">Zeit</th><th scope="col">Wer</th><th scope="col">Was</th><th scope="col">Ziel</th><th scope="col">Netz</th></tr></thead>
              <tbody>
                {audit.data.entries.map(e => (
                  <tr key={e.id}>
                    <td className="adm-num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.created_at)}</td>
                    <td>{e.admin || '–'}</td>
                    <td>{ACTION_DE[e.action] || e.action}{e.details && typeof e.details.reason === 'string' ? <div className="adm-muted">Grund: {e.details.reason}</div> : null}</td>
                    <td>{e.target || '–'}</td>
                    <td className="adm-muted">{e.ip_net || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
