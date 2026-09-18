import { useState, useEffect } from 'react';
import { api } from '../data/api';
import type { TwoFaStatus, OauthConnection } from '../data/api';

const UI = "'Inter', sans-serif";
const SERIF = "'Space Grotesk', serif";

/* „Einstellungen": Passwort, E-Mail, Zwei-Faktor, verbundene KI-Clients,
 * Datenexport, Kontolöschung.
 *
 * Hier stand bis zum 18.09.2026 „MCP server was removed in favor of the
 * Markdown bridge" — das stimmte längst nicht mehr: Der MCP-Endpunkt läuft
 * unter /mcp, samt OAuth-Discovery nach RFC 9728 und dynamischer
 * Client-Registrierung. Nur stand die Adresse nirgends, weshalb der Abschnitt
 * „Verbundene Apps" eine Liste verwaltete, zu der niemand etwas hinzufügen
 * konnte. Ein Kommentar, der die Wirklichkeit falsch beschreibt, ist
 * schlimmer als keiner. */
export default function KeysPanel({ onClose, onAccountDeleted }: { onClose: () => void; onAccountDeleted?: () => void }) {
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  // ── Sicherheit: E-Mail + Zwei-Faktor ───────────────────────────────────────
  const [email, setEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [tfa, setTfa] = useState<TwoFaStatus | null>(null);
  const [tfaBusy, setTfaBusy] = useState(false);
  const [tfaErr, setTfaErr] = useState<string | null>(null);

  // ── Verbundene KI-Clients (OAuth/MCP) ──────────────────────────────────────
  const [conns, setConns] = useState<OauthConnection[] | null>(null);
  const [connBusy, setConnBusy] = useState<number | null>(null);
  /* Die Adresse des MCP-Endpunkts kommt aus dem eigenen Ursprung, nicht aus
   * einer festen Zeichenkette: Wer das Werkzeug selbst betreibt, soll hier
   * SEINE Adresse sehen, nicht unsere. */
  const mcpUrl = `${window.location.origin}/mcp`;
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [clientHilfe, setClientHilfe] = useState<'claude' | 'codex' | 'cursor' | null>(null);

  function kopieren(was: string, text: string) {
    navigator.clipboard?.writeText(text).then(
      () => { setKopiert(was); setTimeout(() => setKopiert(null), 1600); },
      () => { /* Zwischenablage gesperrt — der Text steht sichtbar daneben. */ },
    );
  }

  useEffect(() => {
    (async () => {
      try {
        const [{ user }, status] = await Promise.all([api.me(), api.twofaStatus()]);
        setEmail(user.email ?? '');
        setTfa(status);
      } catch { /* Panel bleibt nutzbar, Sicherheits-Sektion zeigt dann nichts */ }
      try {
        setConns((await api.listConnections()).connections);
      } catch { setConns([]); }
    })();
  }, []);

  async function revokeConn(id: number) {
    setConnBusy(id);
    try {
      await api.revokeConnection(id);
      setConns(cs => (cs ?? []).map(c => (c.id === id ? { ...c, revoked: true } : c)));
    } catch { /* bleibt stehen, der Nutzer kann es erneut versuchen */ }
    finally { setConnBusy(null); }
  }

  async function saveEmail() {
    setEmailMsg(null); setEmailBusy(true);
    try {
      const { user } = await api.setEmail(email.trim());
      setEmail(user.email ?? '');
      setTfa(await api.twofaStatus());
      setEmailMsg({ kind: 'ok', text: user.email ? 'E-Mail gespeichert.' : 'E-Mail entfernt.' });
    } catch (e) { setEmailMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Fehler.' }); }
    finally { setEmailBusy(false); }
  }

  async function toggleTfa() {
    if (!tfa) return;
    setTfaErr(null); setTfaBusy(true);
    try {
      const { enabled } = await api.setTwofa(!tfa.enabled);
      setTfa({ ...tfa, enabled });
    } catch (e) { setTfaErr(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setTfaBusy(false); }
  }

  async function deleteAccount() {
    setDelErr(null);
    if (delConfirm !== 'LÖSCHEN') return setDelErr('Tippe LÖSCHEN in das Feld zur Bestätigung.');
    if (!delPw) return setDelErr('Passwort fehlt.');
    setDelBusy(true);
    try {
      await api.deleteMe(delPw);
      onAccountDeleted?.();
    } catch (e) { setDelErr(e instanceof Error ? e.message : 'Fehler.'); }
    finally { setDelBusy(false); }
  }

  async function changePassword() {
    setPwMsg(null);
    if (newPw.length < 8) return setPwMsg({ kind: 'err', text: 'Neues Passwort: mind. 8 Zeichen.' });
    if (newPw !== newPw2) return setPwMsg({ kind: 'err', text: 'Die neuen Passwörter stimmen nicht überein.' });
    setPwBusy(true);
    try {
      await api.changePassword(curPw, newPw);
      setPwMsg({ kind: 'ok', text: 'Passwort geändert.' });
      setCurPw(''); setNewPw(''); setNewPw2('');
    } catch (e) { setPwMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Fehler.' }); }
    finally { setPwBusy(false); }
  }

  const card: React.CSSProperties = { background: 'oklch(0.985 0.003 264)', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '10px', padding: '12px 14px' };
  const sectionH: React.CSSProperties = { fontFamily: SERIF, fontSize: '15px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', marginBottom: '8px', marginTop: '8px' };
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontFamily: UI, fontSize: '13px', boxSizing: 'border-box' };
  const inputLabel: React.CSSProperties = { fontSize: '10.5px', fontWeight: 700, color: 'oklch(0.44 0.017 264)', marginBottom: '4px', fontFamily: UI, display: 'block' };

  return (
    <div data-modal-backdrop="true" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onClose}>
      <div data-modal="true" style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '22px 26px 16px', borderBottom: '1px solid oklch(0.91 0.005 264)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: '21px', fontWeight: 700, color: 'oklch(0.21 0.021 264)' }}>Einstellungen</div>
            <div style={{ fontSize: '12px', color: 'oklch(0.60 0.012 264)', fontFamily: UI }}>Passwort, E-Mail & Sicherheit</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: '22px', color: '#aaa', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '18px 26px 28px' }}>
          <div style={sectionH}>Passwort ändern</div>
          <div style={card}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><label style={inputLabel}>Aktuelles Passwort</label><input type="password" value={curPw} onChange={e => setCurPw(e.target.value)} style={input} autoComplete="current-password" /></div>
              <div><label style={inputLabel}>Neues Passwort</label><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={input} autoComplete="new-password" placeholder="mindestens 8 Zeichen" /></div>
              <div><label style={inputLabel}>Neues Passwort (wiederholen)</label><input type="password" value={newPw2} onChange={e => setNewPw2(e.target.value)} style={input} autoComplete="new-password" /></div>
              {pwMsg && (
                <div style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '7px', fontFamily: UI,
                  background: pwMsg.kind === 'ok' ? '#f0f7f0' : '#fff0f0',
                  color: pwMsg.kind === 'ok' ? '#2e7d32' : '#c0392b',
                  border: pwMsg.kind === 'ok' ? '1px solid #bcd9bc' : '1px solid #f0c0c0' }}>{pwMsg.text}</div>
              )}
              <button type="button" onClick={changePassword} disabled={pwBusy || !curPw || !newPw}
                style={{ alignSelf: 'flex-start', padding: '8px 16px', background: pwBusy ? '#666' : 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: pwBusy ? 'default' : 'pointer', fontFamily: UI }}>
                {pwBusy ? 'Moment…' : 'Passwort ändern'}
              </button>
            </div>
          </div>

          {/* ── Sicherheit: E-Mail + Zwei-Faktor ───────────────────────── */}
          <div style={{ ...sectionH, marginTop: '28px' }}>Sicherheit</div>
          <div style={card}>
            <label style={inputLabel}>E-Mail-Adresse</label>
            <div style={{ fontSize: '11.5px', color: 'oklch(0.60 0.012 264)', lineHeight: 1.5, marginBottom: '8px', fontFamily: UI }}>
              Für Passwort-Reset, Benachrichtigungen und den Zwei-Faktor-Login. Leer lassen entfernt die Adresse (und schaltet 2FA ab).
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ ...input, flex: 1 }} placeholder="name@example.com" autoComplete="email" />
              <button type="button" onClick={saveEmail} disabled={emailBusy}
                style={{ padding: '8px 14px', background: emailBusy ? '#666' : 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, cursor: emailBusy ? 'default' : 'pointer', fontFamily: UI, whiteSpace: 'nowrap' }}>
                {emailBusy ? '…' : 'Speichern'}
              </button>
            </div>
            {emailMsg && (
              <div style={{ marginTop: '9px', fontSize: '12px', padding: '7px 10px', borderRadius: '7px', fontFamily: UI,
                background: emailMsg.kind === 'ok' ? '#f0f7f0' : '#fff0f0',
                color: emailMsg.kind === 'ok' ? '#2e7d32' : '#c0392b',
                border: emailMsg.kind === 'ok' ? '1px solid #bcd9bc' : '1px solid #f0c0c0' }}>{emailMsg.text}</div>
            )}

            <div style={{ height: '1px', background: 'oklch(0.91 0.005 264)', margin: '14px 0' }} />

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', fontFamily: UI }}>Zwei-Faktor-Login (E-Mail-Code)</div>
                <div style={{ fontSize: '11.5px', color: 'oklch(0.60 0.012 264)', lineHeight: 1.5, marginTop: '3px', fontFamily: UI }}>
                  Bei jeder Anmeldung schicken wir dir einen 6-stelligen Code per E-Mail.
                  {tfa && !tfa.canEnable && !tfa.enabled && (
                    <span style={{ color: '#a1322b' }}> {tfa.hasEmail ? ' E-Mail-Versand ist derzeit nicht konfiguriert.' : ' Hinterlege zuerst eine E-Mail-Adresse.'}</span>
                  )}
                </div>
              </div>
              <button type="button" onClick={toggleTfa} disabled={tfaBusy || !tfa || (!tfa.enabled && !tfa.canEnable)}
                aria-pressed={!!tfa?.enabled}
                style={{
                  flex: '0 0 auto', width: '48px', height: '27px', borderRadius: '999px', border: 'none', position: 'relative',
                  cursor: (tfaBusy || !tfa || (!tfa.enabled && !tfa.canEnable)) ? 'not-allowed' : 'pointer',
                  background: tfa?.enabled ? 'oklch(0.55 0.216 264)' : 'oklch(0.85 0.008 264)',
                  opacity: (!tfa || (!tfa.enabled && !tfa.canEnable)) ? 0.5 : 1, transition: 'background 160ms ease',
                }}>
                <span style={{ position: 'absolute', top: '3px', left: tfa?.enabled ? '24px' : '3px', width: '21px', height: '21px', borderRadius: '50%', background: '#fff', transition: 'left 160ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
            {tfaErr && (
              <div style={{ marginTop: '9px', fontSize: '12px', padding: '7px 10px', borderRadius: '7px', background: '#fff0f0', color: '#c0392b', border: '1px solid #f0c0c0', fontFamily: UI }}>{tfaErr}</div>
            )}
          </div>

          {/* ── Verbundene KI-Clients (OAuth/MCP) ───────────────────────── */}
          <div style={{ ...sectionH, marginTop: '28px' }}>Verbundene Apps</div>
          <div style={card}>
            <div style={{ fontSize: '12.5px', color: 'oklch(0.44 0.017 264)', lineHeight: 1.55, marginBottom: '12px', fontFamily: UI }}>
              KI-Clients, denen du über den MCP-Endpunkt Zugriff auf deine Lebensläufe
              erlaubt hast. „Beenden" entzieht den Zugriff sofort — der Client muss
              dann neu fragen.
            </div>

            {/* Die Adresse. Ohne sie ist dieser Abschnitt eine Liste, zu der
                niemand etwas hinzufügen kann. */}
            <label style={{ ...inputLabel, marginTop: '2px' }}>Adresse für deinen KI-Client</label>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
              <input readOnly value={mcpUrl} onFocus={e => e.currentTarget.select()}
                style={{ ...input, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '12px', background: '#fff' }} />
              <button type="button" onClick={() => kopieren('url', mcpUrl)}
                style={{ flex: '0 0 auto', padding: '8px 12px', background: kopiert === 'url' ? '#2e7d32' : 'oklch(0.21 0.021 264)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: UI, whiteSpace: 'nowrap' }}>
                {kopiert === 'url' ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
            <div style={{ fontSize: '11px', color: 'oklch(0.60 0.012 264)', lineHeight: 1.5, marginTop: '6px', fontFamily: UI }}>
              Kein Schlüssel nötig: Der Client meldet sich selbst an, du bestätigst im Browser.
              Danach steht er in der Liste unten und kann dort jederzeit beendet werden.
            </div>

            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
              {([['claude', 'Claude Desktop'], ['codex', 'Codex'], ['cursor', 'Cursor & andere']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setClientHilfe(clientHilfe === id ? null : id)}
                  style={{ padding: '5px 10px', background: clientHilfe === id ? 'oklch(0.21 0.021 264)' : '#fff', color: clientHilfe === id ? '#fff' : 'oklch(0.44 0.017 264)', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '999px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: UI }}>
                  {label}
                </button>
              ))}
            </div>

            {clientHilfe && (
              <div style={{ marginTop: '10px', background: '#fff', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '8px', padding: '11px 13px', fontSize: '12px', color: 'oklch(0.44 0.017 264)', lineHeight: 1.6, fontFamily: UI }}>
                {clientHilfe === 'claude' && (
                  <>
                    <strong>Claude Desktop</strong> — Einstellungen → Connectors → „Custom connector hinzufügen",
                    Adresse oben einsetzen. Es öffnet sich ein Browserfenster zum Bestätigen.
                  </>
                )}
                {clientHilfe === 'codex' && (
                  <>
                    <strong>Codex</strong> — in <code style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>~/.codex/config.toml</code>:
                    <pre style={{ margin: '7px 0', padding: '8px 10px', background: 'oklch(0.97 0.003 264)', borderRadius: '6px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: '11px', overflowX: 'auto', whiteSpace: 'pre' }}>
{`[mcp_servers.heidrich-cv]\nurl = "${mcpUrl}"`}
                    </pre>
                    Danach einmal <code style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>codex mcp login heidrich-cv</code> —
                    das öffnet die Bestätigung im Browser.
                    <button type="button" onClick={() => kopieren('codex', `[mcp_servers.heidrich-cv]\nurl = "${mcpUrl}"`)}
                      style={{ display: 'block', marginTop: '7px', padding: '4px 9px', background: kopiert === 'codex' ? '#2e7d32' : '#fff', color: kopiert === 'codex' ? '#fff' : 'oklch(0.44 0.017 264)', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: UI }}>
                      {kopiert === 'codex' ? 'Kopiert' : 'Abschnitt kopieren'}
                    </button>
                  </>
                )}
                {clientHilfe === 'cursor' && (
                  <>
                    <strong>Cursor, Zed, VS Code und andere</strong> — überall dort, wo ein
                    „MCP-Server" mit <em>URL</em> oder <em>Streamable HTTP</em> eingetragen wird,
                    gehört die Adresse oben hinein. Clients, die nur lokale Programme starten
                    können, brauchen stattdessen den Server aus dem Ordner <code style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>mcp/</code> —
                    siehe dortige README.
                  </>
                )}
              </div>
            )}

            <div style={{ height: '1px', background: 'oklch(0.91 0.005 264)', margin: '14px 0 10px' }} />
            {conns === null && (
              <div style={{ fontSize: '12px', color: 'oklch(0.60 0.012 264)', fontFamily: UI }}>Lädt…</div>
            )}
            {conns?.length === 0 && (
              <div style={{ fontSize: '12px', color: 'oklch(0.60 0.012 264)', fontFamily: UI, marginTop: '10px' }}>
                Noch keine Verbindung erlaubt.
              </div>
            )}
            {conns?.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', padding: '9px 0', borderTop: '1px solid oklch(0.94 0.004 264)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: c.revoked ? 'oklch(0.60 0.012 264)' : 'oklch(0.21 0.021 264)', fontFamily: UI, textDecoration: c.revoked ? 'line-through' : 'none' }}>
                    {c.client_name || 'Unbenannter Client'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'oklch(0.60 0.012 264)', fontFamily: UI, marginTop: '2px' }}>
                    verbunden {new Date(c.created_at).toLocaleDateString('de-DE')}
                    {c.last_used_at ? ` · zuletzt aktiv ${new Date(c.last_used_at).toLocaleDateString('de-DE')}` : ' · noch nicht benutzt'}
                  </div>
                </div>
                {!c.revoked && (
                  <button type="button" onClick={() => revokeConn(c.id)} disabled={connBusy === c.id}
                    style={{ flex: '0 0 auto', padding: '6px 12px', background: '#fff', color: '#a1322b', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: connBusy === c.id ? 'default' : 'pointer', fontFamily: UI }}>
                    {connBusy === c.id ? '…' : 'Beenden'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* ── DSGVO: Datenexport ──────────────────────────────────────── */}
          <div style={{ ...sectionH, marginTop: '28px' }}>Daten</div>
          <div style={card}>
            <div style={{ fontSize: '12.5px', color: 'oklch(0.44 0.017 264)', lineHeight: 1.55, marginBottom: '12px', fontFamily: UI }}>
              Vollständige Kopie aller deiner Daten als JSON. Enthält Profile, alle Versionen, Sharelinks, Fotos (als Data-URLs), API-Schlüssel und Aktivitäts-Events.
            </div>
            <a
              href={api.exportMeUrl()}
              download
              style={{ display: 'inline-block', padding: '8px 14px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'oklch(0.21 0.021 264)', cursor: 'pointer', fontFamily: UI, textDecoration: 'none' }}
            >
              ↓ Daten herunterladen
            </a>
          </div>

          {/* ── DSGVO: Konto löschen ────────────────────────────────────── */}
          <div style={{ ...sectionH, marginTop: '28px', color: '#a1322b' }}>Konto löschen</div>
          <div style={{ ...card, borderColor: '#f0c0c0', background: '#fff5f3' }}>
            <div style={{ fontSize: '12.5px', color: 'oklch(0.44 0.017 264)', lineHeight: 1.55, marginBottom: '12px', fontFamily: UI }}>
              Permanent. Alle Profile, Versionen, Sharelinks, Fotos und Schlüssel werden sofort gelöscht. Lade vorher deine Daten herunter, falls du sie behalten willst.
            </div>
            {!delOpen ? (
              <button type="button" onClick={() => setDelOpen(true)}
                style={{ padding: '8px 14px', background: 'transparent', border: '1px solid #c0392b', color: '#a1322b', borderRadius: '7px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: UI }}>
                Konto endgültig löschen
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <label style={inputLabel}>Aktuelles Passwort</label>
                  <input type="password" value={delPw} onChange={e => setDelPw(e.target.value)} style={input} autoComplete="current-password" />
                </div>
                <div>
                  <label style={inputLabel}>Tippe <b>LÖSCHEN</b> zur Bestätigung</label>
                  <input type="text" value={delConfirm} onChange={e => setDelConfirm(e.target.value)} style={input} />
                </div>
                {delErr && (
                  <div style={{ fontSize: '12px', padding: '7px 10px', borderRadius: '7px', background: '#fff0f0', color: '#c0392b', border: '1px solid #f0c0c0', fontFamily: UI }}>{delErr}</div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setDelOpen(false); setDelErr(null); setDelPw(''); setDelConfirm(''); }} disabled={delBusy}
                    style={{ padding: '8px 14px', background: 'transparent', border: '1px solid oklch(0.87 0.006 264)', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#666', fontFamily: UI }}>Abbrechen</button>
                  <button type="button" onClick={deleteAccount} disabled={delBusy || delConfirm !== 'LÖSCHEN'}
                    style={{ padding: '8px 16px', background: delBusy ? '#888' : '#a1322b', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: delBusy ? 'default' : 'pointer', fontFamily: UI }}>
                    {delBusy ? 'Lösche…' : 'Endgültig löschen'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '24px', fontSize: '11.5px', color: 'oklch(0.60 0.012 264)', fontFamily: UI, lineHeight: 1.6 }}>
            <b>Tipp:</b> Um deinen Lebenslauf von einer KI bearbeiten zu lassen, nutze die Markdown-Funktion im Export-Panel — kein lokales Setup nötig.
          </div>
        </div>
      </div>
    </div>
  );
}
