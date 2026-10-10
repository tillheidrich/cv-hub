import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { api, ApiError, consentApi } from '../data/api';
import type { AuthUser } from '../data/api';
import type { Lang } from '../data/types';
import { T, type UiLang } from '../ui/i18n';
import { BILLING_I18N } from '../ui/i18n/billing';
import { KONTO_I18N, type KontoStrings } from '../ui/i18n/konto';
import { SiteFooter } from '../billing/BillingShell';
import { useOffer, registrationOpen } from '../billing/hooks';
import { PATHS, linkClick } from '../billing/route';
import { BRAND } from '../landing/brand';
import { createDemoProfile } from '../data/storage';
import ResumeRenderer from '../templates/ResumeRenderer';
import { getTheme, resolvePairing } from '../templates/theme';
import { metricsFor } from '../templates/metrics';
import { StaticPage } from '../preview/TemplateCarousel';
import { Art9ConsentFields, RegisterNotice } from './Art9Consent';
import { art9Texts, ART9_CONSENT_VERSION } from '../legal/einwilligung';
import { TipsConsentField, TIPS_CONSENT_VERSION } from './MailPrefs';
import './auth.css';

/**
 * Anmeldung, Registrierung, Passwort vergessen, Zwei-Faktor-Code — und die
 * beiden Wege daneben: ohne Konto weiter, Zugangscode einlösen.
 *
 * Runde 8 (10.10.2026, Auftrag: „überarbeite den Anmelde-Screen"):
 * Die Seite läuft jetzt im Flächensystem des Editors (ui/surface.css, Geist)
 * statt mit eigenen Farbkonstanten und Space Grotesk. Was sich geändert hat:
 *
 *  • Anmelden und Konto anlegen sind ein Umschalter in derselben Karte, nicht
 *    zwei Seiten. Passwort vergessen und der Bestätigungscode erscheinen in
 *    derselben Karte, mit „Zurück".
 *  • Anforderungen stehen vorher am Feld (3–32 Zeichen, mindestens 8 Zeichen;
 *    so prüft es der Server), nicht erst in der Fehlermeldung.
 *  • Fehlertexte sind übersetzt und sagen, was jetzt zu tun ist. Die Texte
 *    des Servers sind nur deutsch; sie erscheinen nur noch, wenn wir den Fall
 *    nicht kennen.
 *  • „Ohne Konto weiter" und „Code einlösen" stehen gleichrangig unter der
 *    Karte. Rechts eine echte, gerenderte Seite der Demo und drei Aussagen,
 *    die belegt sind (selbst betrieben, Standort laut Datenschutzerklärung,
 *    kein Abo, quelloffen). Keine Siegel, keine Zahlen.
 */

const LANG_ORDER: UiLang[] = ['de', 'en', 'fr', 'es'];
type View = 'login' | 'register' | 'forgot' | 'twofa';

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function Eye({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}
function Alert() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" />
    </svg>
  );
}
const TRUST_ICONS = [
  // Server / Standort
  <svg key="s" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="7" rx="2" /><rect x="4" y="13" width="16" height="7" rx="2" /><path d="M8 7.5h.01M8 16.5h.01" /></svg>,
  // Kein Abo: Kreislauf durchgestrichen
  <svg key="a" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" /><path d="M5 19L19 5" /></svg>,
  // Quelloffen: spitze Klammern
  <svg key="q" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" /></svg>,
];

/** Wortmarke aus BRAND.name („CV-Hub" → CV<b>-</b>Hub; Trennung am ersten „/" oder „-"). */
export function Wordmark() {
  const i = BRAND.name.search(/[/-]/);
  if (i < 0) return <span>{BRAND.name}</span>;
  return <span>{BRAND.name.slice(0, i)}<b>{BRAND.name[i]}</b>{BRAND.name.slice(i + 1)}</span>;
}

/** Fehler aus der API in einen Satz, der sagt, was jetzt zu tun ist. */
function friendlyError(err: unknown, x: KontoStrings, lang: UiLang): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return x.errWrong;
    if (err.status === 429) return x.errLocked(Math.max(1, Math.ceil((err.retryAfter ?? 60) / 60)));
    if (err.status === 403 && /gesperrt|disabled/i.test(err.message)) return x.errDisabled;
    if (err.status >= 500 && !err.answered) return x.errNetwork;
    if (err.message) return lang === 'de' ? err.message : x.errServerSays(err.message);
    return x.errGeneric;
  }
  if (err instanceof TypeError) return x.errNetwork;
  return x.errGeneric;
}

/** Ein Eingabefeld mit Beschriftung darüber, Hinweis darunter, Fehlerbezug. */
function Field({ id, label, hint, aside, children }: {
  id: string; label: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="ka-field">
      <div className="ka-label-row">
        <label htmlFor={id} className="ka-label">{label}</label>
        {aside}
      </div>
      {children}
      {hint && <p id={`${id}-hint`} className="ka-hint">{hint}</p>}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, x, describedBy, invalid }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; x: KontoStrings;
  describedBy?: string; invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="ka-input-wrap">
      <input id={id} className="ka-input has-toggle" type={show ? 'text' : 'password'} value={value}
        onChange={e => onChange(e.target.value)} autoComplete={autoComplete} required
        aria-describedby={describedBy} aria-invalid={invalid || undefined}
        autoCapitalize="none" spellCheck={false} />
      <button type="button" className="ka-toggle" onClick={() => setShow(s => !s)}
        aria-label={show ? x.hidePassword : x.showPassword} aria-pressed={show} title={show ? x.hidePassword : x.showPassword}>
        <Eye open={show} />
      </button>
    </div>
  );
}

function SubmitButton({ busy, label, x, disabled }: { busy: boolean; label: string; x: KontoStrings; disabled?: boolean }) {
  return (
    <button type="submit" className="ka-btn ka-btn-primary" disabled={busy || disabled} aria-busy={busy || undefined}>
      <span>{busy ? x.busy : label}</span>
      <span className="ka-btn-arrow">{busy ? <span className="ka-spin" aria-hidden /> : <Arrow />}</span>
    </button>
  );
}

/** Zwei echte Seiten der Demo, statisch gerendert (kein Messlauf). Nur ab
 *  960 px — auf dem Telefon kostet das Rechenzeit und Platz für nichts. */
function DemoStage({ lang, x }: { lang: UiLang; x: KontoStrings }) {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 960px)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(min-width: 960px)');
    if (!mq) return;
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const docLang: Lang = lang;
  const demo = useMemo(() => createDemoProfile(''), []);
  const metrics = useMemo(() => metricsFor(0, 1), []);
  if (!wide) return null;
  const page = (tpl: string) => {
    const th = getTheme(tpl);
    return <ResumeRenderer data={demo.data[docLang]} theme={th} pairing={resolvePairing(th, 'auto')} metrics={metrics} pageFormat="a4" />;
  };
  return (
    <div className="ka-stage" aria-hidden>
      <div className="ka-sheet is-back">
        <div className="cv-doc-context"><StaticPage render={() => page('mailand')} scale={0.4} pageFormat="a4" /></div>
      </div>
      <div className="ka-sheet is-front ka-float">
        <div className="cv-doc-context"><StaticPage render={() => page('espoo')} scale={0.46} pageFormat="a4" /></div>
      </div>
      <div className="ka-caption ui-pill">{x.previewCaption(getTheme('espoo').name)}</div>
    </div>
  );
}

function TrustList({ x, headingId }: { x: KontoStrings; headingId: string }) {
  return (
    <section className="ka-trust-wrap" aria-labelledby={headingId}>
      <h2 id={headingId}>{x.trustTitle}</h2>
      <ul className="ka-trust">
        {x.trust.map((item, i) => (
          <li key={item.title} className="ka-rise" style={{ ['--i' as string]: i + 4 }}>
            <span className="ka-trust-icon">{TRUST_ICONS[i]}</span>
            <span><strong>{item.title}</strong><span>{item.body}</span></span>
          </li>
        ))}
      </ul>
    </section>
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
  const [view, setView] = useState<View>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invite, setInvite] = useState(initialInvite);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  /** Einwilligung Art. 9 DSGVO (P9) — Pflicht, damit das Konto speichert. */
  const [art9, setArt9] = useState(false);
  const [tips, setTips] = useState(false);
  const [art9Invalid, setArt9Invalid] = useState(false);
  const { offer } = useOffer();
  const open = registrationOpen(offer);
  const t = T[lang]?.auth ?? T.de.auth;
  const bt = BILLING_I18N[lang] ?? BILLING_I18N.de;
  const x = KONTO_I18N[lang] ?? KONTO_I18N.de;
  const uid = useId();
  const ids = {
    user: `${uid}-u`, pw: `${uid}-p`, email: `${uid}-e`, invite: `${uid}-i`, forgot: `${uid}-f`, code: `${uid}-c`,
    err: `${uid}-err`, title: `${uid}-t`, trust: `${uid}-tr`, trust2: `${uid}-tr2`,
  };
  const firstField = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  // Beim Wechsel der Ansicht: Fehler weg, Fokus ins erste Feld (nicht beim
  // ersten Zeichnen — da soll der Bildschirmleser oben anfangen).
  const shownView = useRef(view);
  useEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    window.requestAnimationFrame(() => firstField.current?.focus());
  }, [view]);
  useEffect(() => { document.title = `${view === 'register' ? x.registerTitle : x.tabLogin} · ${BRAND.name}`; }, [view, x]);

  function go(v: View) { setView(v); setError(null); if (v !== 'forgot') setForgotSent(false); }
  function fail(err: unknown) {
    setError(friendlyError(err, x, lang));
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) { setError(x.errRequired); return; }
    setBusy(true); setError(null);
    try {
      const res = await api.login(username.trim(), password);
      if (res.twofa && res.challenge) { setChallenge(res.challenge); setCode(''); go('twofa'); }
      else if (res.user) onAuth(res.user);
      else setError(x.errGeneric);
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!art9) { setArt9Invalid(true); setError(art9Texts(lang).errRegisterConsent); window.requestAnimationFrame(() => errorRef.current?.focus()); return; }
    setBusy(true); setError(null);
    try {
      const { user } = await api.register(username.trim(), password, invite.trim(), email.trim() || undefined,
        { lang, ...(tips && email.trim() ? { tipsConsent: { version: TIPS_CONSENT_VERSION } } : {}) });
      /* Einwilligung gleich danach speichern (eigener Aufruf, die Registrierung
       * bleibt unverändert). Scheitert er, fragt der Dialog im Editor erneut. */
      let next = user;
      try { next = (await consentApi.art9(true, ART9_CONSENT_VERSION)).user ?? user; } catch { /* Dialog im Editor */ }
      onAuth(next);
    } catch (err) { fail(err); } finally { setBusy(false); }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true); setError(null);
    try {
      const { user } = await api.verify2fa(challenge, code.trim());
      onAuth(user);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 401)) { setError(x.errCode); window.requestAnimationFrame(() => errorRef.current?.focus()); }
      else fail(err);
    } finally { setBusy(false); }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) { setError(x.errRequired); return; }
    setBusy(true); setError(null);
    try { await api.forgotPassword(username.trim()); }
    catch { /* keine Auskunft, ob es das Konto gibt */ }
    finally { setForgotSent(true); setBusy(false); }
  }

  const errorBox = error ? (
    <div id={ids.err} ref={errorRef} tabIndex={-1} role="alert" className="ka-error ka-swap"><Alert /><span>{error}</span></div>
  ) : null;
  const errBy = error ? ids.err : undefined;

  const title = view === 'register' ? x.registerTitle : view === 'forgot' ? x.forgotTitle : view === 'twofa' ? x.twofaTitle : x.loginTitle;
  const lead = view === 'register' ? (open ? x.registerLeadOpen : x.registerLeadInvite)
    : view === 'forgot' ? x.forgotLead : view === 'twofa' ? x.twofaLead : x.loginLead;

  const inviteForm = (
    <form onSubmit={submitRegister} noValidate>
      <Field id={ids.user} label={t.username} hint={x.usernameHint}>
        <input ref={open ? undefined : firstField} id={ids.user} className="ka-input" value={username} onChange={e => setUsername(e.target.value)}
          autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32}
          aria-describedby={[`${ids.user}-hint`, errBy].filter(Boolean).join(' ')} aria-invalid={!!error || undefined} />
      </Field>
      <Field id={ids.pw} label={t.password} hint={x.passwordHintNew}>
        <PasswordInput id={ids.pw} value={password} onChange={setPassword} autoComplete="new-password" x={x}
          describedBy={[`${ids.pw}-hint`, errBy].filter(Boolean).join(' ')} invalid={!!error} />
      </Field>
      <Field id={ids.email} label={x.emailOpt} hint={x.emailHint}>
        <input id={ids.email} className="ka-input" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)}
          autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="name@example.com" aria-describedby={`${ids.email}-hint`} />
      </Field>
      <Field id={ids.invite} label={t.inviteCode}>
        <input id={ids.invite} className="ka-input is-invite" value={invite} onChange={e => setInvite(e.target.value)}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} required aria-describedby={errBy} />
      </Field>
      <Art9ConsentFields lang={lang} checked={art9} invalid={art9Invalid}
        onChange={v => { setArt9(v); if (v) { setArt9Invalid(false); setError(null); } }} />
      {/* Tipps per E-Mail nur mit Adresse; freiwillig, nicht vorangekreuzt. */}
      {email.trim() && <TipsConsentField lang={lang} checked={tips} onChange={setTips} />}
      {errorBox}
      <SubmitButton busy={busy} label={t.submit.register} x={x} />
      <RegisterNotice lang={lang} />
    </form>
  );

  return (
    <div className="ui ka" lang={lang}>
      <header className="ka-top">
        <a href="/" className="ka-brand" aria-label={`${BRAND.name} · ${x.backHome}`}><Wordmark /></a>
        <div className="ka-top-right">
          <a href="/" className="ka-home-link">{x.backHome}</a>
          {onLangChange && (
            <div className="ui-seg ui-pill ka-lang" role="group" aria-label="Sprache · Language">
              {LANG_ORDER.map(l => (
                <button key={l} type="button" aria-pressed={lang === l} lang={l} onClick={() => onLangChange(l)}
                  aria-label={{ de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español' }[l]}>{l.toUpperCase()}</button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="ka-main">
        <section aria-labelledby={ids.title}>
          <p className="ka-eyebrow ka-rise" style={{ ['--i' as string]: 0 }}>{x.eyebrow}</p>
          <h1 id={ids.title} className="ka-h1 ka-rise" style={{ ['--i' as string]: 1 }}>{title}</h1>
          <p className="ka-lead ka-rise" style={{ ['--i' as string]: 2 }}>{lead}</p>

          <div className="ka-card ka-rise" style={{ ['--i' as string]: 3 }}>
            <div className="ka-card-inner">
              {(view === 'login' || view === 'register') && (
                <div className="ui-seg ka-tabs" role="group" aria-label={`${x.tabLogin} / ${x.tabRegister}`}>
                  <button type="button" aria-pressed={view === 'login'} onClick={() => go('login')}>{x.tabLogin}</button>
                  <button type="button" aria-pressed={view === 'register'} onClick={() => go('register')}>{x.tabRegister}</button>
                </div>
              )}

              <div key={view} className="ka-swap">
                {view === 'login' && (
                  <form onSubmit={submitLogin} noValidate>
                    <Field id={ids.user} label={bt.identifier}>
                      <input ref={firstField} id={ids.user} className="ka-input" value={username} onChange={e => setUsername(e.target.value)}
                        autoComplete="username" autoCapitalize="none" spellCheck={false} required inputMode="email"
                        aria-describedby={errBy} aria-invalid={!!error || undefined} />
                    </Field>
                    <Field id={ids.pw} label={t.password}
                      aside={<button type="button" className="ka-textlink" onClick={() => go('forgot')}>{x.forgotLink}</button>}>
                      <PasswordInput id={ids.pw} value={password} onChange={setPassword} autoComplete="current-password" x={x} describedBy={errBy} invalid={!!error} />
                    </Field>
                    {errorBox}
                    <SubmitButton busy={busy} label={t.submit.login} x={x} />
                  </form>
                )}

                {view === 'register' && (open ? (
                  <>
                    <a href={PATHS.checkout} onClick={linkClick(PATHS.checkout)} className="ka-btn ka-btn-primary" style={{ marginTop: 0 }}>
                      <span>{x.registerCta}</span><span className="ka-btn-arrow"><Arrow /></span>
                    </a>
                    <p className="ka-sub">{x.registerCtaSub}</p>
                    <details className="ka-disclosure" open={!!initialInvite || undefined}>
                      <summary>{x.inviteToggle}</summary>
                      {inviteForm}
                    </details>
                  </>
                ) : inviteForm)}

                {view === 'forgot' && (
                  forgotSent ? (
                    <>
                      <div className="ka-ok" role="status">{x.forgotSent}</div>
                      <div className="ka-row-links"><button type="button" className="ka-textlink" onClick={() => go('login')}>{x.backToLogin}</button></div>
                    </>
                  ) : (
                    <form onSubmit={submitForgot} noValidate>
                      <Field id={ids.forgot} label={x.forgotField}>
                        <input ref={firstField} id={ids.forgot} className="ka-input" value={username} onChange={e => setUsername(e.target.value)}
                          autoComplete="username" autoCapitalize="none" spellCheck={false} required inputMode="email" aria-describedby={errBy} />
                      </Field>
                      {errorBox}
                      <SubmitButton busy={busy} label={x.forgotSend} x={x} />
                      <div className="ka-row-links"><button type="button" className="ka-textlink" onClick={() => go('login')}>{x.backToLogin}</button></div>
                    </form>
                  )
                )}

                {view === 'twofa' && (
                  <form onSubmit={submitCode} noValidate>
                    <Field id={ids.code} label={x.twofaField}>
                      <input ref={firstField} id={ids.code} className="ka-input is-code" value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
                        aria-describedby={errBy} aria-invalid={!!error || undefined} />
                    </Field>
                    {errorBox}
                    <SubmitButton busy={busy} label={x.twofaSubmit} x={x} disabled={code.length !== 6} />
                    <div className="ka-row-links">
                      <button type="button" className="ka-textlink" onClick={() => { setChallenge(null); setCode(''); setPassword(''); go('login'); }}>{x.twofaBack}</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>

          {view !== 'twofa' && (
            <div className="ka-alt">
              {onDemoStart && (
                <div className="ka-alt-card ka-rise" style={{ ['--i' as string]: 4 }}>
                  <h2>{x.guestTitle}</h2>
                  <p>{x.guestLead}</p>
                  <button type="button" className="ka-btn ka-btn-soft" onClick={onDemoStart}>
                    <span>{t.demoButton}</span><span className="ka-btn-arrow"><Arrow /></span>
                  </button>
                </div>
              )}
              <div className="ka-alt-card ka-rise" style={{ ['--i' as string]: 5 }}>
                <h2>{x.codeTitle}</h2>
                <p>{x.codeLead}</p>
                <a href={PATHS.code} onClick={linkClick(PATHS.code)} className="ka-btn ka-btn-soft">
                  <span>{x.codeLink}</span><span className="ka-btn-arrow"><Arrow /></span>
                </a>
              </div>
            </div>
          )}
          <div className="ka-trust-mobile"><TrustList x={x} headingId={ids.trust2} /></div>
        </section>

        <aside className="ka-visual" aria-labelledby={ids.trust}>
          <DemoStage lang={lang} x={x} />
          <TrustList x={x} headingId={ids.trust} />
        </aside>
      </main>

      <div className="ka-foot"><SiteFooter lang={lang} /></div>
    </div>
  );
}
