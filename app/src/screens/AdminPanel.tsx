import { useEffect, useState, useCallback } from 'react';
import { api } from '../data/api';
import type { InviteCode, AdminUser, AccessRequest } from '../data/api';

const UI = "'Inter', sans-serif";
const SERIF = "'Space Grotesk', serif";

type Stats = {
  users: number; resumes: number; invitesActive: number; pdfExports: number; registrations7d: number;
  accessPending: number; accessAccepted: number; accessRejected: number; accessRequests7d: number;
};

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'invites' | 'users' | 'requests'>('invites');
  const [stats, setStats] = useState<Stats | null>(null);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [maxUses, setMaxUses] = useState(1);
  const [note, setNote] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, i, u, a] = await Promise.all([api.stats(), api.listInvites(), api.listUsers(), api.listAccessRequests()]);
      setStats(s); setInvites(i.invites); setUsers(u.users); setRequests(a.requests);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Laden fehlgeschlagen.'); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  async function generate() {
    setBusy(true); setErr(null); setGenMsg(null);
    try {
      const r = await api.createInvite({ maxUses, note: note.trim() || undefined, email: inviteEmail.trim() || undefined });
      setNote('');
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
      <div data-modal="true" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
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
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'oklch(0.42 0.017 264)', marginBottom: '4px', fontFamily: UI }}>Nutzungen</div>
                    <input type="number" min={1} max={500} value={maxUses} onChange={e => setMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{ width: '64px', padding: '7px 9px', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontFamily: UI, fontSize: '13px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'oklch(0.42 0.017 264)', marginBottom: '4px', fontFamily: UI }}>Notiz (optional)</div>
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="z. B. für Anna"
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
                {genMsg && (
                  <div style={{ marginTop: '10px', fontSize: '12px', padding: '7px 10px', borderRadius: '7px', background: '#f0f5ff', color: 'oklch(0.35 0.15 264)', border: '1px solid #cdd9f5', fontFamily: UI }}>{genMsg}</div>
                )}
              </div>

              {invites.length === 0 && <div style={{ fontSize: '12.5px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>Noch keine Codes.</div>}
              {invites.map(c => (
                <div key={c.code} style={{ ...card, display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', opacity: c.revoked || c.uses >= c.max_uses ? 0.5 : 1 }}>
                  <code style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', letterSpacing: '1px' }}>{c.code}</code>
                  <span style={{ fontSize: '11.5px', color: 'oklch(0.52 0.012 264)', fontFamily: UI }}>
                    {c.uses}/{c.max_uses} genutzt{c.note ? ` · ${c.note}` : ''}{c.revoked ? ' · widerrufen' : ''}
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
                  <div style={{ flex: 1 }} />
                  {u.role !== 'admin' && (
                    <>
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
