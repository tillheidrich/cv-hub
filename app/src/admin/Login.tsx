import { useState } from 'react';
import { BRAND } from '../landing/brand.js';
import { adminFetch, AdminError, type SessionInfo } from './api';

/** Zwei Schritte: Passwort, dann der Code aus der Mail. Erst danach gibt es
 *  das Admin-Cookie. */
export default function Login({ session, onDone }: { session: SessionInfo | null; onDone: () => void }) {
  const [step, setStep] = useState<'password' | 'code'>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [brandA, brandB] = BRAND.name.split('/');

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await adminFetch<{ challenge: string; sentTo: string }>('/api/admin/auth/login', { body: { username: username.trim(), password } });
      setChallenge(r.challenge); setSentTo(r.sentTo); setStep('code'); setPassword('');
    } catch (e2) {
      setErr(e2 instanceof AdminError ? e2.message : 'Anmeldung fehlgeschlagen.');
    } finally { setBusy(false); }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await adminFetch('/api/admin/auth/verify', { body: { challenge, code: code.trim() } });
      onDone();
    } catch (e2) {
      const msg = e2 instanceof AdminError ? e2.message : 'Code falsch.';
      setErr(msg);
      if (e2 instanceof AdminError && (e2.status === 429 || e2.status === 400)) { setStep('password'); setCode(''); }
    } finally { setBusy(false); }
  }

  return (
    <main className="adm-login">
      <div className="adm-card">
        <div className="adm-brand" style={{ padding: 0 }}>{brandA}{brandB !== undefined && <span>/{brandB}</span>}<small>Admin-Bereich</small></div>
        <h1>{step === 'password' ? 'Anmelden' : 'Code aus der Mail'}</h1>
        {session?.mode === 'legacy' && (
          <p className="adm-hint">Dieser Dienst läuft ohne eigene Admin-Adresse. Bist du in der App als Admin angemeldet, lade die Seite neu.</p>
        )}
        {err && <p className="adm-note" data-tone="danger" role="alert">{err}</p>}
        {step === 'password' ? (
          <form onSubmit={submitPassword} className="adm-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            <div className="adm-field">
              <label htmlFor="adm-user">Nutzername oder E-Mail</label>
              <input id="adm-user" name="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="adm-field">
              <label htmlFor="adm-pass">Passwort</label>
              <input id="adm-pass" name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="adm-btn" data-kind="primary" disabled={busy}>{busy ? 'Prüfe …' : 'Weiter'}</button>
            <p className="adm-hint">Danach schicken wir dir einen sechsstelligen Code per Mail. Ohne ihn gibt es keinen Zugang.</p>
          </form>
        ) : (
          <form onSubmit={submitCode} className="adm-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
            <p className="adm-hint">Der Code ging an {sentTo || 'deine Admin-Adresse'} und gilt 10 Minuten.</p>
            <div className="adm-field">
              <label htmlFor="adm-code">Code</label>
              <input id="adm-code" name="code" className="adm-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <button type="submit" className="adm-btn" data-kind="primary" disabled={busy || code.length !== 6}>{busy ? 'Prüfe …' : 'Anmelden'}</button>
            <button type="button" className="adm-btn" data-kind="ghost" onClick={() => { setStep('password'); setCode(''); setErr(null); }}>Zurück</button>
          </form>
        )}
      </div>
    </main>
  );
}
