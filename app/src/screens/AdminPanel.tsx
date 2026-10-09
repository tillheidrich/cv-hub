import { useEffect, useState, useCallback } from 'react';
import { api } from '../data/api';
import type { InviteCode, AdminUser, AccessRequest } from '../data/api';

const UI = "'Inter', sans-serif";
const SERIF = "'Space Grotesk', serif";

/* Pilot (08.10.2026): Laufzeit je Platz, Auswertung je Code, Verlängern.
 * Die drei neuen Aufrufe laufen über einen kleinen eigenen Helfer, weil
 * data/api.ts in dieser Runde nicht zu diesem Bauabschnitt gehört. Beim
 * nächsten Umbau gehören sie dorthin. Deutsch genügt: das Panel sieht nur
 * der Admin, und es nutzt die i18n-Tabellen bisher nicht. */
const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) || '/pdfapi';
async function adminReq<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(API_BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Fehler ${r.status}`);
  return data as T;
}

/** Eine Zeile aus GET /api/admin/invite-stats — nur Zählungen. */
type CodeStats = {
  code: string; note: string | null; max_uses: number; redeemed: number; access_days: number | null;
  expires_at: string | null; revoked: boolean; created_at: string;
  accounts: number; active14d: number; with_pdf: number; with_docx: number; with_export: number; with_share: number; expired: number;
};
/** /api/admin/users liefert seit dem Pilot zwei Felder mehr. */
type AdminUserX = AdminUser & { access_until?: string | null; invite_code?: string | null };
/** /api/admin/invites liefert seit dem Pilot die Laufzeit je Platz mit. */
type InviteCodeX = InviteCode & { access_days?: number | null };

const dateDe = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
function accessLabel(until: string | null | undefined): { text: string; expired: boolean } | null {
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return { text: `abgelaufen am ${dateDe(until)}`, expired: true };
  const days = Math.ceil(ms / 86_400_000);
  return { text: `bis ${dateDe(until)} (${days} T)`, expired: false };
}

type Stats = {
  users: number; resumes: number; invitesActive: number; pdfExports: number; registrations7d: number;
  accessPending: number; accessAccepted: number; accessRejected: number; accessRequests7d: number;
};

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'invites' | 'users' | 'requests'>('invites');
  const [stats, setStats] = useState<Stats | null>(null);
  const [invites, setInvites] = useState<InviteCodeX[]>([]);
  const [users, setUsers] = useState<AdminUserX[]>([]);
  const [codeStats, setCodeStats] = useState<CodeStats[]>([]);
  const [showAllCodes, setShowAllCodes] = useState(false);
  const [accessDays, setAccessDays] = useState('');
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [maxUses, setMaxUses] = useState(1);
  const [note, setNote] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, i, u, a, cs] = await Promise.all([
        api.stats(), api.listInvites(), api.listUsers(), api.listAccessRequests(),
        adminReq<{ codes: CodeStats[] }>('/api/admin/invite-stats'),
      ]);
      setStats(s); setInvites(i.invites as InviteCodeX[]); setUsers(u.users as AdminUserX[]); setRequests(a.requests); setCodeStats(cs.codes);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Laden fehlgeschlagen.'); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  async function generate() {
    setBusy(true); setErr(null); setGenMsg(null);
    try {
      const days = accessDays.trim() ? parseInt(accessDays, 10) : undefined;
      if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 3650)) {
        setErr('Laufzeit je Platz: 1 bis 3650 Tage, oder leer lassen für unbegrenzt.');
        return;
      }
      // accessDays steht (noch) nicht im Typ von api.createInvite; der Server
      // liest es aus demselben JSON.
      const opts = { maxUses, note: note.trim() || undefined, email: inviteEmail.trim() || undefined, accessDays: days };
      const r = await api.createInvite(opts);
      setNote(''); setAccessDays('');
      if (inviteEmail.trim()) {
        setGenMsg(r.emailed
          ? `Code ${r.code} erzeugt und an ${inviteEmail.trim()} versendet.`
          : `Code ${r.code} erzeugt — E-Mail-Versand nicht möglich (SMTP prüfen). Code manuell weitergeben.`);
      } else {
        setGenMsg(`Code ${r.code} erzeugt.`);
      }
      setInviteEmail('');
      await refresh();
    }
    catch (e) { setErr(e instanceof Error ? e.message : 'Code-Erstellung fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  async function revoke(code: string) {
    if (!window.confirm(`Code ${code} widerrufen?`)) return;
    await api.revokeInvite(code); refresh();
  }
  async function changeAccess(u: AdminUserX) {
    const hint = u.access_until
      ? `Laufzeit von ${u.username} ${accessLabel(u.access_until)?.text}.\n\nUm wie viele Tage verlängern? Oder ein Enddatum (JJJJ-MM-TT) oder „unbegrenzt“.`
      : `${u.username} hat keine Laufzeit (unbegrenzt).\n\nEnddatum setzen (JJJJ-MM-TT)?`;
    const raw = window.prompt(hint, u.access_until ? '30' : '');
    if (raw === null) return;
    const v = raw.trim().toLowerCase();
    let body: { days: number } | { until: string | null };
    if (/^\d+$/.test(v)) body = { days: parseInt(v, 10) };
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) body = { until: v };
    else if (v === 'unbegrenzt') body = { until: null };
    else { window.alert('Bitte eine Zahl, ein Datum (JJJJ-MM-TT) oder „unbegrenzt“ eingeben.'); return; }
    setErr(null);
    try {
      const r = await adminReq<{ accessUntil: string | null }>(`/api/admin/users/${u.id}/access`, body);
      window.alert(r.accessUntil ? `${u.username}: Zugang bis ${dateDe(r.accessUntil)}.` : `${u.username}: Zugang unbegrenzt.`);
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Ändern fehlgeschlagen.'); }
  }
  async function toggleUser(u: AdminUser) {
    await api.setUserDisabled(u.id, !u.disabled); refresh();
  }
  async function acceptRequest(r: AccessRequest) {
    setErr(null);
    try {
      const res = await api.acceptAccessRequest(r.id);
      window.alert(res.emailed
        ? `Angenommen. Einladungscode ${res.code} an ${r.email} versendet.`
        : `Angenommen. Code ${res.code} erzeugt — E-Mail-Versand nicht möglich, bitte manuell weitergeben.`);
      refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Annahme fehlgeschlagen.'); }
  }
  async function rejectRequest(r: AccessRequest) {
    if (!window.confirm(`Anfrage von ${r.name} ablehnen?`)) return;
    try { await api.rejectAccessRequest(r.id); refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Ablehnung fehlgeschlagen.'); }
  }
  async function resetPassword(u: AdminUser) {
    const pw = window.prompt(`Neues Passwort für ${u.username} (mind. 8 Zeichen):`);
    if (!pw) return;
    if (pw.length < 8) { window.alert('Passwort zu kurz.'); return; }
    try { await api.adminResetPassword(u.id, pw); window.alert(`Passwort für ${u.username} zurückgesetzt.`); }
    catch (e) { window.alert('Fehler: ' + (e instanceof Error ? e.message : 'unbekannt')); }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const card: React.CSSProperties = { background: 'oklch(0.985 0.003 264)', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '10px', padding: '12px 14px' };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', fontSize: '12.5px', fontWeight: 700, fontFamily: UI, cursor: 'pointer',
    background: active ? 'oklch(0.21 0.021 264)' : 'oklch(0.968 0.004 264)', color: active ? '#fff' : '#666', border: 'none', borderRadius: '7px',
  });

  return (
    <div data-modal-backdrop="true" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div data-modal="true" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '760px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '22px 26px 16px', borderBottom: '1px solid oklch(0.91 0.005 264)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: '21px', fontWeight: 700, color: 'oklch(0.21 0.021 264)' }}>Admin</div>
            <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>Einladungscodes & Nutzerverwaltung</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: '22px', color: '#767676', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 26px' }}>
          {/* Stats */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '20px' }}>
              {([
                ['Nutzer', stats.users], ['Lebensläufe', stats.resumes], ['Aktive Codes', stats.invitesActive], ['PDF-Exporte', stats.pdfExports],
                ['Anfragen offen', stats.accessPending, stats.accessPending > 0], ['Angenommen', stats.accessAccepted], ['Abgelehnt', stats.accessRejected], ['Anfragen 7T', stats.accessRequests7d],
              ] as [string, number, boolean?][]).map(([l, v, hot]) => (
                <div key={l} style={{ ...card, textAlign: 'center', ...(hot ? { borderColor: 'oklch(0.55 0.216 264)', background: 'oklch(0.97 0.02 264)' } : {}) }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: hot ? 'oklch(0.55 0.216 264)' : 'oklch(0.21 0.021 264)', fontFamily: SERIF }}>{v}</div>
                  <div style={{ fontSize: '10px', color: 'oklch(0.52 0.012 264)', fontFamily: UI, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{l}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            <button type="button" style={tabBtn(tab === 'invites')} onClick={() => setTab('invites')}>Einladungscodes</button>
            <button type="button" style={tabBtn(tab === 'requests')} onClick={() => setTab('requests')}>
              Anfragen{pendingCount > 0 && (
                <span style={{ marginLeft: '6px', background: tab === 'requests' ? '#fff' : 'oklch(0.55 0.216 264)', color: tab === 'requests' ? 'oklch(0.21 0.021 264)' : '#fff', borderRadius: '999px', padding: '1px 6px', fontSize: '10.5px', fontWeight: 700 }}>{pendingCount}</span>
              )}
            </button>
            <button type="button" style={tabBtn(tab === 'users')} onClick={() => setTab('users')}>Nutzer ({users.length})</button>
          </div>

          {err && <div style={{ background: '#fff0f0', border: '1px solid #f0c0c0', borderRadius: '8px', padding: '8px 11px', fontSize: '12px', color: '#c0392b', marginBottom: '14px', fontFamily: UI }}>{err}</div>}

          {tab === 'invites' && (
            <>
              <div style={{ ...card, marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label htmlFor="adm-places" style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'oklch(0.42 0.017 264)', marginBottom: '4px', fontFamily: UI }}>Plätze</label>
                    <input id="adm-places" type="number" min={1} max={500} value={maxUses} onChange={e => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{ width: '64px', padding: '7px 9px', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontFamily: UI, fontSize: '13px' }} />
                  </div>
                  <div>
                    <label htmlFor="adm-days" style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'oklch(0.42 0.017 264)', marginBottom: '4px', fontFamily: UI }}>Laufzeit je Platz (Tage)</label>
                    <input id="adm-days" type="number" min={1} max={3650} value={accessDays} onChange={e => setAccessDays(e.target.value)} placeholder="unbegrenzt"
                      style={{ width: '120px', padding: '7px 9px', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontFamily: UI, fontSize: '13px' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <label htmlFor="adm-note" style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'oklch(0.42 0.017 264)', marginBottom: '4px', fontFamily: UI }}>Notiz</label>
                    <input id="adm-note" value={note} onChange={e => setNote(e.target.value)} placeholder="z. B. Pilot Coach, Rechnung 2026-014"
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontFamily: UI, fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginTop: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'oklch(0.42 0.017 264)', marginBottom: '4px', fontFamily: UI }}>Direkt per E-Mail einladen (optional)</div>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@example.com — sendet die Einladung automatisch"
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontFamily: UI, fontSize: '13px', boxSizing: 'border-box' }} />
                  </div>
                  <button type="button" onClick={generate} disabled={busy}
                    style={{ padding: '8px 16px', background: 'oklch(0.55 0.216 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: UI, whiteSpace: 'nowrap' }}>
                    {busy ? '…' : inviteEmail.trim() ? 'Erzeugen & senden' : 'Code erzeugen'}
                  </button>
                </div>
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'oklch(0.52 0.012 264)', fontFamily: UI, lineHeight: 1.5 }}>
                  Laufzeit zählt je Konto ab dem Einlösen. Leer = unbegrenzt. 14 und 3 Tage vor Ablauf bekommt die Person eine Mail mit den Exportwegen; danach kann sie lesen und exportieren, aber nicht mehr ändern. Gelöscht wird nichts.
                </div>
                {genMsg && (
                  <div style={{ marginTop: '10px', fontSize: '12px', padding: '7px 10px', borderRadius: '7px', background: '#f0f5ff', color: 'oklch(0.35 0.15 264)', border: '1px solid #cdd9f5', fontFamily: UI }}>{genMsg}</div>
                )}
              </div>

              {(() => {
                const rows = codeStats.filter(c => showAllCodes || c.max_uses > 1 || c.access_days !== null);
                const th: React.CSSProperties = { textAlign: 'right', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'oklch(0.52 0.012 264)', padding: '6px 8px', whiteSpace: 'nowrap', borderBottom: '1px solid oklch(0.91 0.005 264)' };
                const td: React.CSSProperties = { textAlign: 'right', fontSize: '12.5px', color: 'oklch(0.21 0.021 264)', padding: '7px 8px', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', borderBottom: '1px solid oklch(0.95 0.004 264)' };
                return (
                  <div style={{ ...card, marginBottom: '14px', padding: '12px 0 6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px 8px' }}>
                      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', fontFamily: UI }}>Auswertung je Code</div>
                      <div style={{ flex: 1 }} />
                      <label style={{ fontSize: '11px', color: 'oklch(0.42 0.017 264)', fontFamily: UI, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showAllCodes} onChange={e => setShowAllCodes(e.target.checked)} /> auch Einzel-Codes
                      </label>
                    </div>
                    {rows.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'oklch(0.52 0.012 264)', fontFamily: UI, padding: '0 14px 8px' }}>Noch kein Code mit mehreren Plätzen oder Laufzeit.</div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: UI }}>
                          <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Zählungen je Einladungscode, ohne Namen und Inhalte</caption>
                          <thead>
                            <tr>
                              <th scope="col" style={{ ...th, textAlign: 'left', paddingLeft: '14px' }}>Code</th>
                              <th scope="col" style={th} title="eingelöst / Plätze (eingelöst zählt auch gelöschte Konten)">Plätze</th>
                              <th scope="col" style={th} title="Laufzeit je Platz">Tage</th>
                              <th scope="col" style={th} title="in den letzten 14 Tagen angemeldet genutzt">Aktiv 14 T</th>
                              <th scope="col" style={th} title="Nutzer mit mindestens einem PDF (Dienst oder Druck)">PDF</th>
                              <th scope="col" style={th} title="Nutzer mit mindestens einem DOCX">DOCX</th>
                              <th scope="col" style={th} title="Nutzer mit PDF oder DOCX">Export</th>
                              <th scope="col" style={th} title="Nutzer mit mindestens einem Sharelink">Link</th>
                              <th scope="col" style={{ ...th, paddingRight: '14px' }} title="Konten, deren Laufzeit vorbei ist">Abgelaufen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map(c => (
                              <tr key={c.code} style={{ opacity: c.revoked ? 0.5 : 1 }}>
                                <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 400, paddingLeft: '14px', whiteSpace: 'normal' }}>
                                  <code style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{c.code}</code>
                                  {c.note && <div style={{ fontSize: '11px', color: 'oklch(0.52 0.012 264)' }}>{c.note}</div>}
                                </th>
                                <td style={td}>{c.redeemed}/{c.max_uses}{c.accounts !== c.redeemed ? <span title="davon noch vorhandene Konten" style={{ color: 'oklch(0.52 0.012 264)' }}> ({c.accounts})</span> : null}</td>
                                <td style={td}>{c.access_days ?? '∞'}</td>
                                <td style={td}>{c.active14d}</td>
                                <td style={td}>{c.with_pdf}</td>
                                <td style={td}>{c.with_docx}</td>
                                <td style={{ ...td, fontWeight: 700 }}>{c.with_export}</td>
                                <td style={td}>{c.with_share}</td>
                                <td style={{ ...td, paddingRight: '14px' }}>{c.expired}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div style={{ fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', fontFamily: UI, padding: '8px 14px 4px', lineHeight: 1.5 }}>
                      Nur Zählungen von Personen, keine Inhalte. DOCX und Druck-PDF entstehen im Browser und zählen erst, wenn das Frontend sie meldet.
                    </div>
                  </div>
                );
              })()}

              {invites.length === 0 && <div style={{ fontSize: '12.5px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>Noch keine Codes.</div>}
              {invites.map(c => (
                <div key={c.code} style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', opacity: c.revoked || c.uses >= c.max_uses ? 0.5 : 1 }}>
                  <code style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', letterSpacing: '1px' }}>{c.code}</code>
                  <span style={{ fontSize: '11.5px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>
                    {c.uses}/{c.max_uses} genutzt{c.access_days ? ` · ${c.access_days} Tage je Platz` : ''}{c.note ? ` · ${c.note}` : ''}{c.revoked ? ' · widerrufen' : ''}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button type="button" onClick={() => navigator.clipboard?.writeText(c.code)}
                    style={{ background: 'none', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', color: '#666', fontFamily: UI }}>Kopieren</button>
                  {!c.revoked && c.uses < c.max_uses && (
                    <button type="button" onClick={() => revoke(c.code)}
                      style={{ background: 'none', border: 'none', color: '#c0392b', fontSize: '11px', cursor: 'pointer', fontFamily: UI }}>Widerrufen</button>
                  )}
                </div>
              ))}
            </>
          )}

          {tab === 'users' && (
            <>
              {users.map(u => (
                <div key={u.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', opacity: u.disabled ? 0.55 : 1 }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', fontFamily: UI }}>{u.username}</span>
                  {u.role === 'admin' && <span style={{ fontSize: '9.5px', fontWeight: 700, background: 'oklch(0.55 0.216 264)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontFamily: UI }}>ADMIN</span>}
                  <span style={{ fontSize: '11.5px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>{u.resume_count} CVs</span>
                  {u.invite_code && <code style={{ fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', fontFamily: 'monospace' }}>{u.invite_code}</code>}
                  {(() => {
                    const a = accessLabel(u.access_until);
                    return a ? <span style={{ fontSize: '11px', fontWeight: a.expired ? 700 : 400, color: a.expired ? '#c0392b' : 'oklch(0.42 0.017 264)', fontFamily: UI }}>{a.text}</span> : null;
                  })()}
                  <div style={{ flex: 1 }} />
                  {u.role !== 'admin' && (
                    <>
                      <button type="button" onClick={() => changeAccess(u)}
                        style={{ background: 'none', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '6px', padding: '4px 9px', fontSize: '11px', cursor: 'pointer', color: '#666', fontFamily: UI }}>
                        {u.access_until ? 'Verlängern' : 'Laufzeit'}
                      </button>
                      <button type="button" onClick={() => resetPassword(u)}
                        style={{ background: 'none', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '6px', padding: '4px 9px', fontSize: '11px', cursor: 'pointer', color: '#666', fontFamily: UI }}>
                        Passwort
                      </button>
                      <button type="button" onClick={() => toggleUser(u)}
                        style={{ background: 'none', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '6px', padding: '4px 9px', fontSize: '11px', cursor: 'pointer', color: u.disabled ? '#2e7d32' : '#c0392b', fontFamily: UI }}>
                        {u.disabled ? 'Entsperren' : 'Sperren'}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}

          {tab === 'requests' && (
            <>
              {requests.length === 0 && <div style={{ fontSize: '12.5px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>Keine Anfragen.</div>}
              {requests.map(r => {
                const decided = r.status !== 'pending';
                return (
                  <div key={r.id} style={{ ...card, marginBottom: '8px', opacity: decided ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', fontFamily: UI }}>{r.name}</span>
                      <a href={`mailto:${r.email}`} style={{ fontSize: '12px', color: 'oklch(0.55 0.216 264)', fontFamily: UI, textDecoration: 'none' }}>{r.email}</a>
                      {r.status === 'accepted' && <span style={{ fontSize: '9.5px', fontWeight: 700, background: 'oklch(0.55 0.16 150)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontFamily: UI }}>ANGENOMMEN{r.invite_code ? ` · ${r.invite_code}` : ''}</span>}
                      {r.status === 'rejected' && <span style={{ fontSize: '9.5px', fontWeight: 700, background: 'oklch(0.55 0.02 264)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontFamily: UI }}>ABGELEHNT</span>}
                      <div style={{ flex: 1 }} />
                      {!decided && (
                        <>
                          <button type="button" onClick={() => acceptRequest(r)}
                            style={{ background: 'oklch(0.55 0.216 264)', border: 'none', color: '#fff', borderRadius: '6px', padding: '5px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: UI }}>Annehmen</button>
                          <button type="button" onClick={() => rejectRequest(r)}
                            style={{ background: 'none', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '6px', padding: '5px 10px', fontSize: '11.5px', cursor: 'pointer', color: '#c0392b', fontFamily: UI }}>Ablehnen</button>
                        </>
                      )}
                    </div>
                    {r.message && <div style={{ fontSize: '12.5px', color: 'oklch(0.42 0.017 264)', fontFamily: UI, marginTop: '8px', whiteSpace: 'pre-wrap' }}>{r.message}</div>}
                    <div style={{ fontSize: '10.5px', color: 'oklch(0.52 0.012 264)', fontFamily: UI, marginTop: '6px' }}>
                      {new Date(r.created_at).toLocaleString('de-DE')}{r.ua_summary ? ` · ${r.ua_summary}` : ''}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
