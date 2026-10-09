/**
 * Schritt 1 des Kaufs: Konto anlegen (offene Registrierung) oder anmelden.
 *
 * Felder nach dem Signup-Grundsatz „nur, was wirklich gebraucht wird":
 * E-Mail, Passwort, Bot-Schutz (ALTCHA), Häkchen „mindestens 16". Kein
 * Nutzername, keine zweite Passworteingabe (dafür „zeigen"), kein Name — der
 * kommt erst auf die Rechnung. Nach dem Anlegen geht es ohne Umweg zur
 * Bestellübersicht; die Bestätigungsmail läuft nebenher.
 */
import { useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N } from '../ui/i18n/billing';
import { api, withPlan } from '../data/api';
import type { AuthUser } from '../data/api';
import { track } from '../data/track';
import { billingApi, type Offer } from './api';
import AltchaField from './Altcha';
import { errorText } from './format';
import { Icon } from '../ui/Icon';
import { registrationOpen } from './hooks';
import { PATHS, linkClick } from './route';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AccountStep({ lang, offer, onDone, initialMode }: {
  lang: UiLang;
  offer: Offer | null;
  onDone: (u: AuthUser, created: boolean) => void;
  initialMode?: 'register' | 'login';
}) {
  const t = BILLING_I18N[lang];
  const canRegister = registrationOpen(offer);
  const [mode, setMode] = useState<'register' | 'login'>(canRegister ? (initialMode ?? 'register') : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [age16, setAge16] = useState(false);
  const [altcha, setAltcha] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const started = useRef(false);
  const onStart = () => { if (!started.current && mode === 'register') { started.current = true; track('register_start'); } };

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    setErr(null); setInvalid(null);
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) { setInvalid('email'); setErr(t.errEmail); return; }
    if (password.length < 8) { setInvalid('password'); setErr(t.errPwShort); return; }
    if (!age16) { setInvalid('age16'); setErr(t.errAge16); return; }
    if (!altcha) { setInvalid('altcha'); setErr(t.errAltcha); return; }
    busyRef.current = true; setBusy(true);
    try {
      const r = withPlan(await billingApi.register({ email: mail, password, altcha, ageConfirmed16: true }));
      track('register_done');
      const user: AuthUser = { ...r.user, emailConfirmed: r.user.emailConfirmed ?? r.emailConfirmed ?? false, email: r.user.email ?? mail };
      onDone(user, true);
    } catch (ex) {
      setErr(errorText(ex, lang));
      setAltcha(null);
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    setErr(null);
    busyRef.current = true; setBusy(true);
    try {
      if (challenge) {
        const r = await api.verify2fa(challenge, code.trim());
        if (r.user) onDone(r.user, false);
        return;
      }
      const r = await api.login(identifier.trim(), password);
      if (r.twofa && r.challenge) { setChallenge(r.challenge); return; }
      if (r.user) onDone(r.user, false);
    } catch (ex) { setErr(errorText(ex, lang)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const switchTo = (m: 'register' | 'login') => { setMode(m); setErr(null); setInvalid(null); setChallenge(null); };

  if (mode === 'login') {
    return (
      <form className="bl-form" onSubmit={submitLogin} noValidate aria-labelledby="bl-acc-h">
        <div>
          <h2 id="bl-acc-h" className="bl-h2">{t.loginTitle}</h2>
          <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{canRegister ? t.loginSub : t.inviteOnly}</p>
        </div>
        {!challenge ? (
          <>
            <div className="bl-field">
              <label htmlFor="bl-id">{t.identifier}</label>
              <input id="bl-id" className="bl-input" value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" required />
            </div>
            <div className="bl-field">
              <label htmlFor="bl-pw-l">{t.password}</label>
              <div className="bl-pw">
                <input id="bl-pw-l" className="bl-input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPw(v => !v)} aria-pressed={showPw} aria-label={showPw ? t.hidePw : t.showPw}><Icon name="eye" size={18} /></button>
              </div>
            </div>
          </>
        ) : (
          <div className="bl-field">
            <label htmlFor="bl-2fa">{t.twofaLabel}</label>
            <input id="bl-2fa" className="bl-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          </div>
        )}
        {err && <p className="bl-error" role="alert">{err}</p>}
        <div>
          <button type="submit" className="ui-btn ui-btn-primary bl-submit" disabled={busy}>{busy ? t.busy : challenge ? t.twofaSubmit : t.loginSubmit}</button>
        </div>
        {canRegister && <div><button type="button" className="bl-linkbtn" onClick={() => switchTo('register')}>{t.noAccount}</button></div>}
      </form>
    );
  }

  return (
    <form className="bl-form" onSubmit={submitRegister} onFocus={onStart} noValidate aria-labelledby="bl-acc-h">
      <div>
        <h2 id="bl-acc-h" className="bl-h2">{t.regTitle}</h2>
        <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{t.regSub}</p>
      </div>
      <div className="bl-field">
        <label htmlFor="bl-email">{t.email}</label>
        <input id="bl-email" className="bl-input" type="email" inputMode="email" autoComplete="email" value={email}
          onChange={e => setEmail(e.target.value)} aria-invalid={invalid === 'email' || undefined} required />
      </div>
      <div className="bl-field">
        <label htmlFor="bl-pw">{t.password}</label>
        <div className="bl-pw">
          <input id="bl-pw" className="bl-input" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={password}
            onChange={e => setPassword(e.target.value)} aria-invalid={invalid === 'password' || undefined} aria-describedby="bl-pw-hint" minLength={8} required />
          <button type="button" onClick={() => setShowPw(v => !v)} aria-pressed={showPw} aria-label={showPw ? t.hidePw : t.showPw}><Icon name="eye" size={18} /></button>
        </div>
        <p id="bl-pw-hint" className="bl-hint" style={{ marginTop: 0 }}>{t.passwordHint}</p>
      </div>
      <label className="bl-check" data-invalid={invalid === 'age16' || undefined}>
        <input type="checkbox" checked={age16} onChange={e => { setAge16(e.target.checked); if (e.target.checked && invalid === 'age16') { setInvalid(null); setErr(null); } }} required />
        <span>{t.age16}</span>
      </label>
      <div data-invalid={invalid === 'altcha' || undefined}>
        <AltchaField lang={lang} onChange={p => { setAltcha(p); if (p && invalid === 'altcha') { setInvalid(null); setErr(null); } }} />
      </div>
      <p className="bl-hint" style={{ margin: 0 }}>
        {t.privacyNote[0]}<a className="bl-link" href={PATHS.privacy} onClick={linkClick(PATHS.privacy)}>{t.privacyNote[1]}</a>{t.privacyNote[2]}
      </p>
      {err && <p className="bl-error" role="alert">{err}</p>}
      <div>
        <button type="submit" className="ui-btn ui-btn-primary bl-submit" disabled={busy}>{busy ? t.busy : t.regSubmit}</button>
      </div>
      <div><button type="button" className="bl-linkbtn" onClick={() => switchTo('login')}>{t.haveAccount}</button></div>
    </form>
  );
}
