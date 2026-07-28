import { APP_NAME } from '../brand';
import { useState } from 'react';
import { api } from '../data/api';

/* Öffentliche Seite unter /reset/<token> — neues Passwort per Reset-Token
 * setzen. Markenkonform (hell, Indigo), self-contained. */
const PAPER = 'oklch(0.985 0.003 264)';
const SURFACE = 'oklch(100% 0 0)';
const INK = 'oklch(0.21 0.021 264)';
const SOFT = 'oklch(0.44 0.017 264)';
const FAINT = 'oklch(0.60 0.012 264)';
const LINE = 'oklch(0.91 0.005 264)';
const LINE_STRONG = 'oklch(0.85 0.008 264)';
const ACCENT = 'oklch(0.55 0.216 264)';
const ACCENT_HOVER = 'oklch(0.48 0.224 264)';
const ERROR = 'oklch(0.55 0.22 25)';
const DISP = '"Space Grotesk", "Inter", system-ui, sans-serif';
const SANS = '"Inter", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

export default function ResetPassword({ token }: { token: string }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben.'); return; }
    if (pw !== pw2) { setError('Die Passwörter stimmen nicht überein.'); return; }
    setBusy(true);
    try {
      await api.resetPassword(token, pw);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zurücksetzen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  const field = (id: string): React.CSSProperties => ({
    width: '100%', padding: '12px 14px', fontFamily: SANS, fontSize: '16px', color: INK,
    background: SURFACE, border: `1px solid ${focus === id ? ACCENT : LINE_STRONG}`, borderRadius: '9px',
    outline: 'none', boxSizing: 'border-box',
    boxShadow: focus === id ? '0 0 0 3px oklch(0.55 0.216 264 / 0.14)' : 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
  });
  const label: React.CSSProperties = { fontFamily: MONO, fontSize: '11px', fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, margin: '18px 0 7px', display: 'block' };

  return (
    <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, color: INK, padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginBottom: '22px' }}>
          <span style={{ fontFamily: DISP, fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', color: INK }}>
            {APP_NAME}
          </span>
        </a>
        <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: '16px', boxShadow: '0 6px 20px -8px oklch(0.21 0.02 264 / 0.14)', padding: '30px' }}>
          {done ? (
            <>
              <div style={{ fontFamily: DISP, fontSize: '26px', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: '10px' }}>Passwort gesetzt.</div>
              <p style={{ fontSize: '14px', color: SOFT, lineHeight: 1.55, marginBottom: '22px' }}>Dein neues Passwort ist aktiv. Du kannst dich jetzt anmelden.</p>
              <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', background: ACCENT, color: '#fff', textDecoration: 'none', fontWeight: 550, fontSize: '14px', padding: '13px 18px', borderRadius: '9px' }}>Zur Anmeldung →</a>
            </>
          ) : (
            <form onSubmit={submit}>
              <div style={{ fontFamily: DISP, fontSize: '26px', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: '8px' }}>Neues Passwort</div>
              <p style={{ fontSize: '14px', color: SOFT, lineHeight: 1.55, margin: 0 }}>Wähle ein neues Passwort für dein Konto. Mindestens 8 Zeichen.</p>
              <label style={label}>Neues Passwort</label>
              <input type="password" style={field('p1')} value={pw} onChange={e => setPw(e.target.value)}
                onFocus={() => setFocus('p1')} onBlur={() => setFocus(null)} autoComplete="new-password" placeholder="••••••••" />
              <label style={label}>Passwort wiederholen</label>
              <input type="password" style={field('p2')} value={pw2} onChange={e => setPw2(e.target.value)}
                onFocus={() => setFocus('p2')} onBlur={() => setFocus(null)} autoComplete="new-password" placeholder="••••••••" />
              {error && <div style={{ marginTop: '16px', borderLeft: `2px solid ${ERROR}`, paddingLeft: '12px', fontSize: '12.5px', color: ERROR, lineHeight: 1.5 }}>{error}</div>}
              <button type="submit" disabled={busy}
                style={{ marginTop: '24px', width: '100%', padding: '13px 18px', background: busy ? FAINT : ACCENT, color: '#fff', border: 'none', borderRadius: '9px', fontSize: '14px', fontWeight: 550, cursor: busy ? 'default' : 'pointer', fontFamily: SANS }}
                onMouseEnter={e => { if (!busy) e.currentTarget.style.background = ACCENT_HOVER; }}
                onMouseLeave={e => { if (!busy) e.currentTarget.style.background = ACCENT; }}>
                {busy ? 'Moment…' : 'Passwort setzen'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
