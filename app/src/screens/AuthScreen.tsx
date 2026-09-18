import { useState, useEffect } from 'react';
import { APP_NAME } from '../brand';
import { api } from '../data/api';
import type { AuthUser } from '../data/api';
import { T, type UiLang } from '../ui/i18n';

/* Marken-Tokens der neuen Website-Identität — bewusst LOKAL gehalten (nicht
 * die app-weiten ui/tokens.ts), damit die Editor-Chrome unberührt bleibt. */
const PAPER = 'oklch(98.4% 0.003 264)';
const SURFACE = 'oklch(100% 0 0)';
const RAISED = 'oklch(96.6% 0.004 264)';
const INK = 'oklch(21% 0.021 264)';
const SOFT = 'oklch(44% 0.017 264)';
const FAINT = 'oklch(52% 0.012 264)';
const GHOST = 'oklch(72% 0.008 264)';
const LINE = 'oklch(91% 0.005 264)';
const LINE_STRONG = 'oklch(85% 0.008 264)';
const ACCENT = 'oklch(55% 0.216 264)';
const ACCENT_HOVER = 'oklch(48% 0.224 264)';
const ERROR = 'oklch(55% 0.22 25)';
const DISP = '"Space Grotesk", "Inter", system-ui, sans-serif';
const SANS = '"Inter", system-ui, -apple-system, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';
const RADIUS = '9px';
const SHADOW_SM = '0 1px 2px oklch(21% 0.02 264 / 0.05)';
const SHADOW_MD = '0 6px 20px -8px oklch(21% 0.02 264 / 0.14), 0 1px 2px oklch(21% 0.02 264 / 0.05)';

const LANG_ORDER: UiLang[] = ['de', 'en', 'fr', 'es'];

const micromono: React.CSSProperties = {
  fontFamily: MONO, fontSize: '11px', fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase',
};
const overline: React.CSSProperties = {
  fontFamily: MONO, fontSize: '11px', fontWeight: 500,
  letterSpacing: '0.14em', textTransform: 'uppercase',
};

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < 720);
  useEffect(() => {
    const onResize = () => setM(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return m;
}

function BrandMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 30 30" fill="none" aria-hidden style={{ flex: '0 0 auto' }}>
      <rect x="4.5" y="2.5" width="21" height="25" rx="2" stroke={INK} strokeWidth="1.6" />
      <line x1="9" y1="9" x2="21" y2="9" stroke={INK} strokeWidth="1.6" />
      <line x1="9" y1="14" x2="21" y2="14" stroke={INK} strokeWidth="1.6" />
      <line x1="9" y1="19" x2="16" y2="19" stroke={ACCENT} strokeWidth="1.6" />
    </svg>
  );
}

export default function AuthScreen({
  onAuth, onDemoStart, lang = 'de', onLangChange, initialInvite = '', initialMode = 'login',
}: {
  onAuth: (u: AuthUser) => void;
  onDemoStart?: () => void;
  lang?: UiLang;
  onLangChange?: (l: UiLang) => void;
  initialInvite?: string;
  initialMode?: 'login' | 'register';
}) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState(initialInvite);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const isMobile = useIsMobile();

  const t = T[lang]?.auth ?? T.de.auth;
  // Zusatz-Strings für E-Mail / Passwort-vergessen (nicht im Haupt-T-Katalog).
  const X = ({
    de: { emailOpt: 'E-Mail (optional)', emailHint: 'Für Passwort-Reset & Benachrichtigungen. Ohne E-Mail kein Self-Service-Reset.', forgotLink: 'Passwort vergessen?', forgotTitle: 'Passwort zurücksetzen', forgotHint: 'Gib deinen Nutzernamen oder deine E-Mail ein — wir schicken dir einen Reset-Link.', forgotSend: 'Link senden', forgotSent: 'Falls ein Konto mit E-Mail existiert, ist der Link unterwegs. Prüfe dein Postfach.', back: '← Zurück', twofaTitle: 'Bestätigungscode', twofaHint: 'Wir haben dir einen 6-stelligen Code per E-Mail geschickt. Er ist 10 Minuten gültig.', twofaVerify: 'Anmelden', twofaBack: '← Andere Anmeldung' },
    en: { emailOpt: 'Email (optional)', emailHint: 'For password reset & notifications. No email = no self-service reset.', forgotLink: 'Forgot password?', forgotTitle: 'Reset password', forgotHint: 'Enter your username or email — we\'ll send you a reset link.', forgotSend: 'Send link', forgotSent: 'If an account with an email exists, the link is on its way. Check your inbox.', back: '← Back', twofaTitle: 'Verification code', twofaHint: 'We e-mailed you a 6-digit code. It is valid for 10 minutes.', twofaVerify: 'Sign in', twofaBack: '← Different sign-in' },
    fr: { emailOpt: 'E-mail (optionnel)', emailHint: 'Pour la réinitialisation et les notifications. Sans e-mail, pas de réinit. en self-service.', forgotLink: 'Mot de passe oublié ?', forgotTitle: 'Réinitialiser le mot de passe', forgotHint: 'Saisissez votre identifiant ou e-mail — nous envoyons un lien.', forgotSend: 'Envoyer le lien', forgotSent: 'Si un compte avec e-mail existe, le lien est en route. Vérifiez votre boîte.', back: '← Retour', twofaTitle: 'Code de vérification', twofaHint: 'Nous vous avons envoyé un code à 6 chiffres par e-mail. Valable 10 minutes.', twofaVerify: 'Se connecter', twofaBack: '← Autre connexion' },
    es: { emailOpt: 'Correo (opcional)', emailHint: 'Para restablecer contraseña y avisos. Sin correo no hay restablecimiento self-service.', forgotLink: '¿Olvidaste la contraseña?', forgotTitle: 'Restablecer contraseña', forgotHint: 'Introduce tu usuario o correo — te enviamos un enlace.', forgotSend: 'Enviar enlace', forgotSent: 'Si existe una cuenta con correo, el enlace va en camino. Revisa tu bandeja.', back: '← Atrás', twofaTitle: 'Código de verificación', twofaHint: 'Te enviamos un código de 6 dígitos por correo. Válido 10 minutos.', twofaVerify: 'Entrar', twofaBack: '← Otro inicio de sesión' },
  } as const)[lang] ?? undefined;
  const x = X ?? { emailOpt: 'Email (optional)', emailHint: '', forgotLink: 'Forgot password?', forgotTitle: 'Reset password', forgotHint: '', forgotSend: 'Send link', forgotSent: 'Check your inbox.', back: '← Back', twofaTitle: 'Verification code', twofaHint: '', twofaVerify: 'Sign in', twofaBack: '← Back' };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        const res = await api.login(username.trim(), password);
        if (res.twofa && res.challenge) {
          setChallenge(res.challenge);
          setCode('');
        } else if (res.user) {
          onAuth(res.user);
        } else {
          setError('Error.');
        }
      } else {
        const { user } = await api.register(username.trim(), password, invite.trim(), email.trim() || undefined);
        onAuth(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error.');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true); setError(null);
    try {
      const { user } = await api.verify2fa(challenge, code.trim());
      onAuth(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error.');
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.forgotPassword(username.trim() || email.trim());
      setForgotSent(true);
    } catch {
      setForgotSent(true); // no enumeration — always show the neutral confirmation
    } finally {
      setBusy(false);
    }
  }

  const field = (id: string): React.CSSProperties => ({
    width: '100%', padding: '12px 14px', fontFamily: SANS, fontSize: '16px',
    fontWeight: 400, color: INK, background: SURFACE,
    border: `1px solid ${focus === id ? ACCENT : LINE_STRONG}`, borderRadius: RADIUS,
    outline: 'none', boxSizing: 'border-box',
    boxShadow: focus === id ? `0 0 0 3px oklch(55% 0.216 264 / 0.14)` : 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease',
  });
  const label: React.CSSProperties = { ...overline, color: FAINT, marginTop: '18px', marginBottom: '7px', display: 'block' };

  return (
    <div style={{ minHeight: '100vh', background: PAPER, display: 'flex', flexDirection: 'column', fontFamily: SANS, color: INK }}>
      {/* Top bar: brand + language + mode */}
      <div style={{ borderBottom: `1px solid ${LINE}`, padding: '14px clamp(20px, 5vw, 44px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <BrandMark />
          <span style={{ fontFamily: DISP, fontSize: '19px', fontWeight: 600, letterSpacing: '-0.02em', color: INK }}>
            CV<span style={{ fontFamily: MONO, fontSize: '12px', fontWeight: 500, color: ACCENT, marginLeft: '1px' }}>-Hub</span>
          </span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onLangChange && (
            <div style={{ display: 'inline-flex', gap: '2px', background: RAISED, border: `1px solid ${LINE}`, borderRadius: '999px', padding: '3px' }}>
              {LANG_ORDER.map(l => (
                <button key={l} type="button" onClick={() => onLangChange(l)}
                  style={{
                    fontFamily: MONO, fontSize: '10.5px', fontWeight: 500, letterSpacing: '0.06em',
                    color: lang === l ? '#fff' : FAINT, background: lang === l ? INK : 'transparent',
                    border: 'none', borderRadius: '999px', padding: '4px 8px', cursor: 'pointer',
                  }}>{l.toUpperCase()}</button>
              ))}
            </div>
          )}
          <div style={{ ...micromono, color: FAINT }}>{mode === 'login' ? t.submit.login : t.submit.register}</div>
        </div>
      </div>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: isMobile ? '24px' : '48px', padding: isMobile ? '36px 20px' : '72px clamp(24px, 5vw, 48px)', maxWidth: '1120px', width: '100%', margin: '0 auto', alignItems: 'center' }}>

        {/* Hero side */}
        <div style={{ gridColumn: isMobile ? '1 / -1' : '1 / span 6' }}>
          <div style={{ ...overline, color: ACCENT, marginBottom: '22px' }}>Family &amp; Friends · Invite-only</div>
          <h1 style={{
            fontFamily: DISP, fontSize: 'clamp(42px, 5.6vw, 76px)', fontWeight: 600,
            color: INK, lineHeight: 1.0, letterSpacing: '-0.035em', margin: 0, textWrap: 'balance',
          }}>
            {mode === 'login' ? t.welcomeBack : t.createAccount}
          </h1>
          <p style={{ fontFamily: SANS, fontSize: '17px', color: SOFT, lineHeight: 1.55, marginTop: '22px', maxWidth: '440px' }}>
            {mode === 'login' ? t.description.login : t.description.register}
          </p>
        </div>

        {/* Form side */}
        <div style={{ gridColumn: isMobile ? '1 / -1' : '8 / span 5' }}>
          <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: '16px', boxShadow: SHADOW_MD, padding: isMobile ? '22px' : '30px' }}>
            {challenge ? (
              <form onSubmit={submitCode}>
                <div style={{ fontFamily: DISP, fontSize: '22px', fontWeight: 600, letterSpacing: '-0.02em', color: INK, marginBottom: '6px' }}>{x.twofaTitle}</div>
                <p style={{ fontSize: '13px', color: SOFT, lineHeight: 1.55, margin: '0 0 4px' }}>{x.twofaHint}</p>
                <label style={label}>Code</label>
                <input style={{ ...field('c'), fontFamily: MONO, fontSize: '26px', letterSpacing: '0.4em', textAlign: 'center' }}
                  value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={() => setFocus('c')} onBlur={() => setFocus(null)}
                  inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000" />
                {error && (
                  <div style={{ marginTop: '18px', borderLeft: `2px solid ${ERROR}`, paddingLeft: '12px', fontSize: '12.5px', color: ERROR, fontFamily: SANS, lineHeight: 1.5 }}>{error}</div>
                )}
                <button type="submit" disabled={busy || code.length !== 6}
                  style={{ marginTop: '24px', width: '100%', padding: '13px 18px', background: (busy || code.length !== 6) ? GHOST : ACCENT, color: '#fff', border: 'none', borderRadius: RADIUS, fontSize: '14px', fontWeight: 550, letterSpacing: '-0.01em', cursor: (busy || code.length !== 6) ? 'default' : 'pointer', fontFamily: SANS, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{busy ? `${t.busy}…` : x.twofaVerify}</span>
                  <span style={{ fontFamily: MONO, fontWeight: 400 }}>→</span>
                </button>
                <button type="button" onClick={() => { setChallenge(null); setCode(''); setError(null); setPassword(''); }}
                  style={{ marginTop: '14px', background: 'none', border: 'none', color: SOFT, cursor: 'pointer', fontFamily: SANS, fontSize: '12.5px', padding: 0 }}>
                  {x.twofaBack}
                </button>
              </form>
            ) : (
            <>
            <form onSubmit={submit}>
              <label style={label}>{t.username}</label>
              <input style={field('u')} value={username} onChange={e => setUsername(e.target.value)}
                onFocus={() => setFocus('u')} onBlur={() => setFocus(null)}
                autoCapitalize="none" autoComplete="username" placeholder="username" />

              <label style={label}>{t.password}</label>
              <input style={field('p')} type="password" value={password} onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocus('p')} onBlur={() => setFocus(null)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••" />

              {mode === 'register' && (
                <>
                  <label style={label}>{x.emailOpt}</label>
                  <input style={field('e')} type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocus('e')} onBlur={() => setFocus(null)}
                    autoCapitalize="none" autoComplete="email" placeholder="name@example.com" />
                  {x.emailHint && <div style={{ fontSize: '11px', color: FAINT, lineHeight: 1.45, marginTop: '6px' }}>{x.emailHint}</div>}

                  <label style={label}>{t.inviteCode}</label>
                  <input style={{ ...field('i'), fontFamily: MONO, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    value={invite} onChange={e => setInvite(e.target.value)}
                    onFocus={() => setFocus('i')} onBlur={() => setFocus(null)}
                    placeholder="XXXX-XXXX" />
                </>
              )}

              {error && (
                <div style={{ marginTop: '18px', borderLeft: `2px solid ${ERROR}`, paddingLeft: '12px', fontSize: '12.5px', color: ERROR, fontFamily: SANS, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={busy}
                style={{
                  marginTop: '26px', width: '100%', padding: '13px 18px',
                  background: busy ? GHOST : ACCENT, color: '#fff',
                  border: 'none', borderRadius: RADIUS, fontSize: '14px', fontWeight: 550,
                  letterSpacing: '-0.01em', cursor: busy ? 'default' : 'pointer', fontFamily: SANS,
                  boxShadow: busy ? 'none' : SHADOW_SM,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'background 160ms ease',
                }}
                onMouseEnter={e => { if (!busy) e.currentTarget.style.background = ACCENT_HOVER; }}
                onMouseLeave={e => { if (!busy) e.currentTarget.style.background = ACCENT; }}>
                <span>{busy ? `${t.busy}…` : mode === 'login' ? t.submit.login : t.submit.register}</span>
                <span style={{ fontFamily: MONO, fontWeight: 400 }}>→</span>
              </button>
            </form>

            {mode === 'login' && (
              <div style={{ marginTop: '14px' }}>
                {!forgot ? (
                  <button type="button" onClick={() => { setForgot(true); setForgotSent(false); setError(null); }}
                    style={{ background: 'none', border: 'none', color: SOFT, cursor: 'pointer', fontFamily: SANS, fontSize: '12.5px', padding: 0, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                    {x.forgotLink}
                  </button>
                ) : (
                  <div style={{ background: RAISED, border: `1px solid ${LINE}`, borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontFamily: DISP, fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{x.forgotTitle}</div>
                    {forgotSent ? (
                      <div style={{ fontSize: '12.5px', color: SOFT, lineHeight: 1.55 }}>{x.forgotSent}</div>
                    ) : (
                      <form onSubmit={submitForgot}>
                        <div style={{ fontSize: '12.5px', color: SOFT, lineHeight: 1.5, marginBottom: '10px' }}>{x.forgotHint}</div>
                        <input style={field('fg')} value={username} onChange={e => setUsername(e.target.value)}
                          onFocus={() => setFocus('fg')} onBlur={() => setFocus(null)}
                          autoCapitalize="none" placeholder="name@example.com / username" />
                        <button type="submit" disabled={busy}
                          style={{ marginTop: '12px', width: '100%', padding: '11px', background: ACCENT, color: '#fff', border: 'none', borderRadius: RADIUS, fontSize: '13px', fontWeight: 550, cursor: 'pointer', fontFamily: SANS }}>
                          {busy ? `${t.busy}…` : x.forgotSend}
                        </button>
                      </form>
                    )}
                    <button type="button" onClick={() => { setForgot(false); setForgotSent(false); }}
                      style={{ marginTop: '10px', background: 'none', border: 'none', color: SOFT, cursor: 'pointer', fontFamily: SANS, fontSize: '12px', padding: 0 }}>
                      {x.back}
                    </button>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: `1px solid ${LINE}`, fontSize: '13px', color: SOFT, fontFamily: SANS, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
              <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setForgot(false); }}
                style={{ background: 'none', border: 'none', color: ACCENT, fontWeight: 550, cursor: 'pointer', fontFamily: SANS, fontSize: '13px', padding: 0, letterSpacing: '-0.01em' }}>
                {mode === 'login' ? t.swap.toRegister : t.swap.toLogin}
              </button>
            </div>
            </>
            )}
          </div>

          {!challenge && onDemoStart && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ ...overline, color: FAINT, marginBottom: '8px' }}>{t.demoOverline}</div>
              <button type="button" onClick={onDemoStart}
                style={{
                  width: '100%', padding: '13px 18px',
                  background: 'transparent', color: INK,
                  border: `1px solid ${LINE_STRONG}`, borderRadius: RADIUS, fontSize: '14px', fontWeight: 550,
                  letterSpacing: '-0.01em', cursor: 'pointer', fontFamily: SANS,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'background 160ms ease, color 160ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = INK; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = INK; }}>
                <span>{t.demoButton}</span>
                <span style={{ fontFamily: MONO, fontWeight: 400 }}>→</span>
              </button>
              <div style={{ fontSize: '12px', color: FAINT, fontFamily: SANS, lineHeight: 1.5, marginTop: '9px' }}>
                {t.demoCaption}
              </div>
            </div>
          )}
        </div>
      </main>

      <div style={{ borderTop: `1px solid ${LINE}`, padding: '14px clamp(20px, 5vw, 44px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ ...micromono, color: FAINT }}>CV-Hub</div>
        <div style={{ ...micromono, color: FAINT }}>{APP_NAME}</div>
      </div>
    </div>
  );
}
