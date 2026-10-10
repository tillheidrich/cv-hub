// Admin → E-Mails (E-Mail-Workflows, 10.10.2026, pdf-service/MAILS.md).
//
// Versand (SMTP), Workflows mit Schalter, Zeitpunkt, Vorschau und Text,
// Warteschlange, Versandprotokoll. Passwörter stehen nirgends; das Feld
// setzt oder ersetzt nur.
import { useState, type FormEvent } from 'react';
import {
  adminFetch, AdminError, downloadUrl,
  type MailLogEntry, type MailPreview, type MailQueueEntry, type MailState, type MailTexts, type MailWorkflow,
} from '../api';
import { Chip, ErrorNote, Note, PageHead, Section, Skeleton, Stat } from '../ui';
import { fmtDateTime, fmtInt } from '../format';
import { useLoad } from '../useLoad';

const LANGS = [['de', 'Deutsch'], ['en', 'Englisch'], ['fr', 'Französisch'], ['es', 'Spanisch']] as const;
const SECURITY: Record<string, string> = { tls: 'TLS (Port 465)', starttls: 'STARTTLS (Port 587)', none: 'unverschlüsselt (nur internes Relay)', auto: 'STARTTLS, wenn angeboten' };
const SOURCE: Record<string, string> = { db: 'Admin-Bereich', env: 'Umgebung', capture: 'Testmitschnitt' };
const STATUS: Record<string, [string, 'ok' | 'warn' | 'danger' | 'accent' | undefined]> = {
  pending: ['wartet', undefined], sending: ['wird gesendet', 'accent'], waiting_smtp: ['wartet auf SMTP', 'warn'], sent: ['gesendet', 'ok'],
  failed: ['fehlgeschlagen', 'danger'], discarded: ['verworfen', undefined], skipped: ['übersprungen', undefined],
  not_configured: ['ohne SMTP', 'warn'], unsubscribed: ['abgemeldet', 'accent'],
};
const TIMING: Record<string, string> = { soonDays: 'Erster Hinweis (Tage vorher)', finalDays: 'Letzter Hinweis (Tage vorher, 0 = keiner)', afterDays: 'Tage nach Ablauf', delayDays: 'Tage nach der Einwilligung' };
const errText = (e: unknown, fallback: string) => (e instanceof AdminError ? e.message : fallback);

function StatusChip({ s }: { s: string }) {
  const [label, tone] = STATUS[s] || [s, undefined];
  return <Chip tone={tone}>{label}</Chip>;
}

/* ── SMTP ─────────────────────────────────────────────────────────────── */

function SmtpSection({ st, onState }: { st: MailState; onState: (s: MailState) => void }) {
  const s = st.smtp;
  const stored = st.stored;
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(form: HTMLFormElement, activate: boolean) {
    const f = new FormData(form);
    const body: Record<string, unknown> = {
      host: f.get('host'), port: Number(f.get('port')), security: f.get('security'), username: f.get('username'),
      from: f.get('from'), replyTo: f.get('replyTo'), activate,
    };
    const pw = String(f.get('password') || '');
    if (pw) body.password = pw;
    if (f.get('clearPassword') === 'on') body.password = '';
    setBusy(true); setMsg(null);
    try {
      const r = await adminFetch<MailState & { verified: boolean; activated: boolean }>('/api/admin/mail/smtp', { body });
      onState(r);
      setMsg({ tone: 'ok', text: activate ? 'Verbindung geprüft, gespeichert und aktiv.' : 'Gespeichert (nicht aktiv).' });
      const pwField = form.elements.namedItem('password');
      if (pwField instanceof HTMLInputElement) pwField.value = '';
    } catch (err) { setMsg({ tone: 'danger', text: errText(err, 'Speichern fehlgeschlagen.') }); }
    finally { setBusy(false); }
  }
  async function act(path: string, body: unknown, ok: string) {
    setBusy(true); setMsg(null);
    try { const r = await adminFetch<MailState & { to?: string }>(path, { body }); if (r.smtp) onState(r); setMsg({ tone: 'ok', text: r.to ? `${ok} (${r.to})` : ok }); }
    catch (err) { setMsg({ tone: 'danger', text: errText(err, 'Hat nicht geklappt.') }); }
    finally { setBusy(false); }
  }

  return (
    <Section title="Versand (SMTP)">
      <div className="adm-grid">
        <Stat label="Mailversand" value={s.configured ? 'eingerichtet' : 'fehlt'} tone={s.configured ? undefined : 'danger'} sub={s.source ? `über ${SOURCE[s.source] || s.source}` : 'Mails warten in der Schlange'} />
        <Stat label="Host" value={s.host || '–'} sub={s.port ? `Port ${s.port} · ${SECURITY[s.security || ''] || s.security}` : undefined} />
        <Stat label="Absender" value={s.from || '–'} sub={s.replyTo ? `Antwort an ${s.replyTo}` : 'Antworten gehen an den Absender'} />
        <Stat label="Benutzer" value={s.user || '–'} sub="gekürzt, Passwort nie sichtbar" />
      </div>
      <Note>{st.precedence}{s.forceEnv ? ' SMTP_FORCE_ENV ist gesetzt: Die Einstellungen hier gelten gerade nicht.' : ''}{s.envConfigured ? ` In der Umgebung ist ${s.envHost} eingetragen.` : ''}</Note>
      {st.key.warning && <Note tone="warn">{st.key.warning}</Note>}
      {stored?.passwordReadable === false && <Note tone="danger">Das gespeicherte Passwort lässt sich nicht mehr entschlüsseln (Schlüssel geändert). Bitte neu eingeben.</Note>}
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <form key={stored?.updatedAt || 'neu'} className="adm-card" onSubmit={e => { e.preventDefault(); void save(e.currentTarget, true); }} aria-label="SMTP-Einstellungen" data-smtp-form>
        <div className="adm-grid-2">
          <div className="adm-field"><label htmlFor="smtp-host">Host</label><input id="smtp-host" name="host" required defaultValue={stored?.host || ''} placeholder="smtp.example.de" autoComplete="off" /></div>
          <div className="adm-field"><label htmlFor="smtp-port">Port</label><input id="smtp-port" name="port" type="number" min={1} max={65535} required defaultValue={stored?.port || 587} /></div>
          <div className="adm-field"><label htmlFor="smtp-sec">Sicherheit</label>
            <select id="smtp-sec" name="security" defaultValue={stored?.security || 'starttls'}>
              <option value="starttls">{SECURITY.starttls}</option><option value="tls">{SECURITY.tls}</option><option value="none">{SECURITY.none}</option>
            </select>
          </div>
          <div className="adm-field"><label htmlFor="smtp-user">Benutzer</label><input id="smtp-user" name="username" defaultValue={stored?.username || ''} autoComplete="off" /></div>
          <div className="adm-field"><label htmlFor="smtp-pw">Passwort {stored?.passwordSet ? '(gesetzt, leer lassen = behalten)' : ''}</label>
            <input id="smtp-pw" name="password" type="password" autoComplete="new-password" placeholder={stored?.passwordSet ? '••••••••' : ''} />
            {stored?.passwordSet && <label className="adm-row" style={{ gap: 6, fontWeight: 400 }}><input type="checkbox" name="clearPassword" style={{ width: 18, height: 18, minHeight: 0, padding: 0, flex: '0 0 auto' }} /> Passwort löschen</label>}
          </div>
          <div className="adm-field"><label htmlFor="smtp-from">Absender</label><input id="smtp-from" name="from" required defaultValue={stored?.from || ''} placeholder="CV-Hub <cv@example.de>" /></div>
          <div className="adm-field"><label htmlFor="smtp-reply">Antwortadresse (optional)</label><input id="smtp-reply" name="replyTo" type="email" defaultValue={stored?.replyTo || ''} /></div>
        </div>
        <p className="adm-hint">Gespeichert wird verschlüsselt (AES-256-GCM, Schlüssel {st.key.source || '–'}). Aktiv wird nur, was die Verbindungsprüfung besteht.</p>
        <div className="adm-row" style={{ marginTop: 10 }}>
          <button type="submit" className="adm-btn" data-kind="primary" disabled={busy}>{busy ? 'Prüfe …' : 'Prüfen, speichern, aktivieren'}</button>
          <button type="button" className="adm-btn" disabled={busy} onClick={e => { const form = e.currentTarget.form; if (form && form.reportValidity()) void save(form, false); }}>Nur speichern</button>
          {stored && (stored.enabled
            ? <button type="button" className="adm-btn" disabled={busy} onClick={() => void act('/api/admin/mail/smtp/enabled', { enabled: false }, 'Deaktiviert, es gilt die Umgebung.')}>Deaktivieren</button>
            : <button type="button" className="adm-btn" disabled={busy} onClick={() => void act('/api/admin/mail/smtp/enabled', { enabled: true }, 'Geprüft und aktiv.')}>Aktivieren</button>)}
          {stored && <button type="button" className="adm-btn" data-kind="danger" disabled={busy} onClick={() => { if (window.confirm('Gespeicherte SMTP-Einstellungen löschen? Danach gilt nur die Umgebung.')) void act('/api/admin/mail/smtp/delete', {}, 'Gelöscht.'); }}>Löschen</button>}
          <button type="button" className="adm-btn" data-kind="ghost" disabled={busy || !s.configured} onClick={() => void act('/api/admin/mail/test', {}, 'Testmail ist raus')}>Testmail an mich</button>
        </div>
        {stored?.verifiedAt && <p className="adm-hint">Zuletzt erfolgreich geprüft: {fmtDateTime(stored.verifiedAt)}</p>}
      </form>
    </Section>
  );
}

/* ── Workflow: Vorschau und Text ──────────────────────────────────────── */

function WorkflowEditor({ wf, onSaved }: { wf: MailWorkflow; onSaved: () => void }) {
  const [lang, setLang] = useState<string>('de');
  const texts = useLoad(() => adminFetch<MailTexts>(`/api/admin/mail/workflows/${wf.id}/texts?lang=${lang}`), lang);
  const [preview, setPreview] = useState<MailPreview | null>(null);
  const [draft, setDraft] = useState<{ subject: string; heading: string; body: string } | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const t = texts.data;
  const cur = draft ?? (t ? { subject: t.override?.subject ?? '', heading: t.override?.heading ?? '', body: t.override?.body ?? '' } : null);

  async function show(withDraft: boolean) {
    setMsg(null);
    try { setPreview(await adminFetch<MailPreview>('/api/admin/mail/preview', { body: { workflow: wf.id, lang, draft: withDraft ? cur : null } })); }
    catch (e) { setMsg({ tone: 'danger', text: errText(e, 'Vorschau fehlgeschlagen.') }); }
  }
  async function save(reset: boolean) {
    setMsg(null);
    try {
      await adminFetch(`/api/admin/mail/workflows/${wf.id}`, { body: { overrides: { [lang]: reset ? null : cur } } });
      setDraft(null);
      await texts.reload();
      setMsg({ tone: 'ok', text: reset ? 'Auf Standard zurückgesetzt.' : 'Gespeichert.' });
      onSaved();
      void show(false);
    } catch (e) { setMsg({ tone: 'danger', text: errText(e, 'Speichern fehlgeschlagen.') }); }
  }

  return (
    <div className="adm-card" style={{ marginTop: 10 }} data-wf-editor={wf.id}>
      <div className="adm-row" style={{ justifyContent: 'space-between' }}>
        <span className="adm-seg" role="group" aria-label="Sprache der Vorschau">
          {LANGS.map(([l, label]) => <button key={l} type="button" aria-pressed={lang === l} onClick={() => { setLang(l); setDraft(null); setPreview(null); }}>{label}</button>)}
        </span>
        <span className="adm-row">
          <button type="button" className="adm-btn" onClick={() => void show(false)}>Vorschau</button>
          <a className="adm-btn" data-kind="ghost" href={downloadUrl(`/api/admin/mail/preview.html?workflow=${wf.id}&lang=${lang}`)} target="_blank" rel="noopener noreferrer">Gestaltet ansehen</a>
        </span>
      </div>
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      {preview && (
        <div style={{ marginTop: 10 }}>
          <p className="adm-label" style={{ margin: 0 }}>Betreff</p>
          <p style={{ margin: '2px 0 8px' }} data-preview-subject>{preview.subject}</p>
          <pre className="adm-statement" style={{ maxHeight: 320 }} data-preview-text>{preview.text}</pre>
          {Object.keys(preview.headers).length > 0 && <p className="adm-hint">Kopfzeilen: {Object.entries(preview.headers).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>}
        </div>
      )}
      {wf.overridable && t && cur && (
        <div style={{ marginTop: 12 }}>
          <p className="adm-hint">Leere Felder heißen Standard. Reiner Text: Absätze mit Leerzeile, Zeilen mit „- “ werden eine Liste. Alles wird escaped.
            Platzhalter: {t.placeholders.map(p => <code key={p.key} title={p.label} style={{ marginRight: 6 }}>{`{{${p.key}}}`}</code>)}</p>
          <div className="adm-field"><label htmlFor={`wf-${wf.id}-s`}>Betreff</label><input id={`wf-${wf.id}-s`} value={cur.subject} placeholder={t.default?.subject} maxLength={160} onChange={e => setDraft({ ...cur, subject: e.target.value })} /></div>
          <div className="adm-field" style={{ marginTop: 8 }}><label htmlFor={`wf-${wf.id}-h`}>Überschrift</label><input id={`wf-${wf.id}-h`} value={cur.heading} placeholder={t.default?.heading} maxLength={120} onChange={e => setDraft({ ...cur, heading: e.target.value })} /></div>
          <div className="adm-field" style={{ marginTop: 8 }}><label htmlFor={`wf-${wf.id}-b`}>Text</label><textarea id={`wf-${wf.id}-b`} rows={8} value={cur.body} placeholder={t.default?.body} maxLength={4000} onChange={e => setDraft({ ...cur, body: e.target.value })} /></div>
          <div className="adm-row" style={{ marginTop: 8 }}>
            <button type="button" className="adm-btn" onClick={() => void show(true)}>Entwurf ansehen</button>
            <button type="button" className="adm-btn" data-kind="primary" onClick={() => void save(false)}>Speichern</button>
            {t.override && <button type="button" className="adm-btn" data-kind="ghost" onClick={() => void save(true)}>Auf Standard zurücksetzen</button>}
          </div>
        </div>
      )}
      {!wf.overridable && <p className="adm-hint">Bestehende zweisprachige Vorlage (Deutsch und Englisch in einer Mail). Schalter und Zeitpunkt lassen sich ändern, der Text nicht.</p>}
    </div>
  );
}

function WorkflowRow({ wf, onChanged }: { wf: MailWorkflow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  async function post(body: unknown, ok: string) {
    setBusy(true); setMsg(null);
    try { await adminFetch(`/api/admin/mail/workflows/${wf.id}`, { body }); setMsg({ tone: 'ok', text: ok }); onChanged(); }
    catch (e) { setMsg({ tone: 'danger', text: errText(e, 'Hat nicht geklappt.') }); }
    finally { setBusy(false); }
  }
  function saveTiming(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void post({ timing: Object.fromEntries(wf.timingFields.map(k => [k, Number(f.get(k))])) }, 'Zeitpunkt gespeichert.');
  }
  const c = wf.counts;
  return (
    <article className="adm-card" aria-labelledby={`wf-${wf.id}-t`} data-workflow={wf.id}>
      <div className="adm-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
          <h3 id={`wf-${wf.id}-t`} style={{ margin: 0, fontSize: 15 }}>{wf.label} <Chip tone={wf.kind === 'tips' ? 'accent' : undefined}>{wf.kind === 'tips' ? 'Tipps, nur mit Einwilligung' : 'Servicemail'}</Chip>{wf.customized.length > 0 && <Chip tone="warn">angepasst: {wf.customized.join(', ')}</Chip>}</h3>
          <p className="adm-hint" style={{ margin: '4px 0 0' }}>{wf.trigger}</p>
          <p className="adm-hint" style={{ margin: '2px 0 0' }}>Rechtsgrundlage: {wf.legal}</p>
        </div>
        <button type="button" className="adm-btn" aria-pressed={wf.enabled} disabled={busy} onClick={() => void post({ enabled: !wf.enabled }, wf.enabled ? 'Abgeschaltet.' : 'Eingeschaltet.')} data-wf-toggle>
          {wf.enabled ? 'An' : 'Aus'}<span className="adm-sr"> – {wf.label}</span>
        </button>
      </div>
      <p className="adm-hint" style={{ margin: '8px 0 0' }}>
        {fmtInt(c.sent)} gesendet · {fmtInt(c.failed)} fehlgeschlagen · {fmtInt(c.skipped)} übersprungen{c.unsubscribed !== null ? ` · ${fmtInt(c.unsubscribed)} abgemeldet (alle Tipps)` : ''}
        {c.pending + c.waiting + c.queueFailed > 0 ? ` · in der Schlange: ${c.pending} wartend, ${c.waiting} ohne SMTP, ${c.queueFailed} fehlgeschlagen` : ''}
      </p>
      {wf.timingFields.length > 0 && (
        <form className="adm-row" style={{ marginTop: 8, alignItems: 'flex-end' }} onSubmit={saveTiming}>
          {wf.timingFields.map(k => (
            <div key={k} className="adm-field" style={{ width: 200 }}>
              <label htmlFor={`wf-${wf.id}-${k}`}>{TIMING[k] || k}</label>
              <input id={`wf-${wf.id}-${k}`} name={k} type="number" min={0} max={60} defaultValue={wf.timing[k]} />
            </div>
          ))}
          <button type="submit" className="adm-btn" disabled={busy}>Zeitpunkt speichern</button>
        </form>
      )}
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <div className="adm-row" style={{ marginTop: 8 }}>
        <button type="button" className="adm-btn" data-kind="ghost" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Vorschau und Text schließen' : 'Vorschau und Text'}</button>
      </div>
      {open && <WorkflowEditor wf={wf} onSaved={onChanged} />}
    </article>
  );
}

/* ── Warteschlange und Protokoll ──────────────────────────────────────── */

function QueueSection({ smtpReady, onChanged }: { smtpReady: boolean; onChanged: () => void }) {
  const [filter, setFilter] = useState('');
  const q = useLoad(() => adminFetch<{ asOf: string; entries: MailQueueEntry[]; counts: { status: string; n: number }[] }>(`/api/admin/mail/queue${filter ? `?status=${filter}` : ''}`), filter);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function act(path: string, body: unknown, ok: (r: Record<string, unknown>) => string) {
    setBusy(true); setMsg(null);
    try { const r = await adminFetch<Record<string, unknown>>(path, { body }); setMsg({ tone: 'ok', text: ok(r) }); await q.reload(); onChanged(); }
    catch (e) { setMsg({ tone: 'danger', text: errText(e, 'Hat nicht geklappt.') }); await q.reload(); }
    finally { setBusy(false); }
  }
  const n = (s: string) => q.data?.counts.find(c => c.status === s)?.n ?? 0;
  return (
    <Section title="Warteschlange">
      <div className="adm-row">
        <span className="adm-seg" role="group" aria-label="Filter">
          {[['', 'Offen'], ['waiting_smtp', `Ohne SMTP (${n('waiting_smtp')})`], ['failed', `Fehlgeschlagen (${n('failed')})`], ['sent', 'Gesendet']].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}>{l}</button>
          ))}
        </span>
        <button type="button" className="adm-btn" disabled={busy || !smtpReady || n('waiting_smtp') === 0} onClick={() => void act('/api/admin/mail/queue/waiting', { action: 'send' }, r => `${r.sent} gesendet, ${r.skipped} übersprungen, ${r.failed} fehlgeschlagen.`)}>Alle ohne SMTP senden</button>
        <button type="button" className="adm-btn" data-kind="danger" disabled={busy || n('waiting_smtp') === 0} onClick={() => { if (window.confirm('Alle Mails, die auf SMTP warten, verwerfen?')) void act('/api/admin/mail/queue/waiting', { action: 'discard' }, r => `${r.discarded} verworfen.`); }}>Alle ohne SMTP verwerfen</button>
        <button type="button" className="adm-btn" data-kind="ghost" disabled={busy} onClick={() => void act('/api/admin/mail/run', {}, () => 'Abgearbeitet.')}>Jetzt abarbeiten</button>
      </div>
      {!smtpReady && <Note tone="warn">Ohne SMTP warten neue Mails hier. Nach dem Einrichten gehen sie nicht von selbst raus: senden oder verwerfen. Nach 30 Tagen verwirft der Aufräumjob sie.</Note>}
      {msg && <Note tone={msg.tone}>{msg.text}</Note>}
      <ErrorNote error={q.error} onRetry={q.reload} />
      {!q.data ? <Skeleton rows={1} /> : q.data.entries.length === 0 ? <p className="adm-empty">Nichts in der Schlange.</p> : (
        <div className="adm-table-wrap" tabIndex={0} role="region" aria-label="Warteschlange">
          <table className="adm-table">
            <caption className="adm-sr">Mails in der Warteschlange, neueste zuerst</caption>
            <thead><tr><th scope="col">Angelegt</th><th scope="col">Workflow</th><th scope="col">Empfänger</th><th scope="col">Status</th><th scope="col">Fällig</th><th scope="col">Fehler</th><th scope="col"><span className="adm-sr">Aktionen</span></th></tr></thead>
            <tbody>
              {q.data.entries.map(e => (
                <tr key={e.id} data-queue-id={e.id}>
                  <td className="adm-num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.created_at)}</td>
                  <td>{e.workflow}</td>
                  <td>{e.to || '–'}</td>
                  <td><StatusChip s={e.status} />{e.attempts > 0 ? <div className="adm-muted">{e.attempts} Versuch(e)</div> : null}</td>
                  <td className="adm-num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.due_at)}</td>
                  <td className="adm-muted">{e.last_error || '–'}</td>
                  <td>
                    {['pending', 'waiting_smtp', 'failed'].includes(e.status) && (
                      <span className="adm-row" style={{ flexWrap: 'nowrap' }}>
                        <button type="button" className="adm-btn" disabled={busy || !smtpReady} onClick={() => void act(`/api/admin/mail/queue/${e.id}/send`, {}, r => (r.status === 'sent' ? 'Gesendet.' : `Status: ${r.status}`))}>Senden<span className="adm-sr"> #{e.id}</span></button>
                        <button type="button" className="adm-btn" data-kind="ghost" disabled={busy} onClick={() => void act(`/api/admin/mail/queue/${e.id}/discard`, {}, () => 'Verworfen.')}>Verwerfen<span className="adm-sr"> #{e.id}</span></button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function LogSection({ reloadKey }: { reloadKey: number }) {
  const log = useLoad(() => adminFetch<{ asOf: string; entries: MailLogEntry[]; retentionDays: number }>('/api/admin/mail/log'), String(reloadKey));
  return (
    <Section title="Versandprotokoll" extra={log.data ? <Chip>letzte 200 · {log.data.retentionDays} Tage aufbewahrt</Chip> : null}>
      <ErrorNote error={log.error} onRetry={log.reload} />
      {!log.data ? <Skeleton rows={1} /> : log.data.entries.length === 0 ? <p className="adm-empty">Noch keine Mails.</p> : (
        <div className="adm-table-wrap" tabIndex={0} role="region" aria-label="Versandprotokoll">
          <table className="adm-table">
            <caption className="adm-sr">Versandprotokoll, neueste zuerst</caption>
            <thead><tr><th scope="col">Zeit</th><th scope="col">Workflow</th><th scope="col">Empfänger</th><th scope="col">Status</th><th scope="col">Fehler</th></tr></thead>
            <tbody>
              {log.data.entries.map(e => (
                <tr key={e.id}>
                  <td className="adm-num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.created_at)}</td>
                  <td>{e.workflow}</td>
                  <td>{e.to_masked || '–'}</td>
                  <td><StatusChip s={e.status} /></td>
                  <td className="adm-muted">{e.error || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export default function Mails() {
  const st = useLoad(() => adminFetch<MailState>('/api/admin/mail'));
  const [override, setOverride] = useState<MailState | null>(null);
  const [tick, setTick] = useState(0);
  const s = override ?? st.data;
  const refresh = () => { setOverride(null); void st.reload(); setTick(t => t + 1); };
  return (
    <>
      <PageHead title="E-Mails" sub="Versand, Workflows, Warteschlange und Protokoll. Passwörter stehen nirgends." asOf={s?.asOf} onReload={refresh} loading={st.loading} />
      <ErrorNote error={st.error} onRetry={st.reload} />
      {!s ? <Skeleton /> : (
        <>
          <SmtpSection st={s} onState={x => { setOverride(x); setTick(t => t + 1); }} />
          <Section title="Workflows">
            <Note>Servicemails gehören zum Vertrag. Tipps gehen nur an Konten mit bestätigter Einwilligung ({fmtInt(s.consent.on)} eingewilligt, {fmtInt(s.consent.pending)} wartet auf Bestätigung, {fmtInt(s.consent.withdrawn)} widerrufen). Zähler: letzte {s.countsDays} Tage.</Note>
            {!s.base && <Note tone="warn">PUBLIC_BASE_URL fehlt: Mails ohne Knopf, Tipps werden übersprungen (kein Abmeldelink möglich).</Note>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {s.workflows.map(wf => <WorkflowRow key={wf.id} wf={wf} onChanged={refresh} />)}
            </div>
          </Section>
          <QueueSection smtpReady={s.smtp.configured} onChanged={refresh} />
          <LogSection reloadKey={tick} />
        </>
      )}
    </>
  );
}
