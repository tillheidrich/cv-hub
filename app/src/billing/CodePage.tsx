/**
 * Seite /code: Zugangscode prüfen und einlösen (Gutscheine, 09.10.2026).
 *
 * Der durchgängige Weg für neue Interessenten:
 *   Code eingeben → Vorschau (reserviert nichts) → Bedingungen →
 *   Konto erstellen oder anmelden → E-Mail bestätigen → zurück hierher →
 *   Bedingungen noch einmal → „Code einlösen".
 * Den Code muss man dabei nur einmal tippen: Er liegt bis zu 24 Stunden in
 * `localStorage` (billing/pendingCode.ts), nie in der Adresse, nie in
 * Analytics. Erst die Einlösung am Server verbraucht einen Platz.
 *
 * Bei geschlossener Registrierung steht ausdrücklich da, dass die öffentliche
 * Aktion noch nicht gestartet ist; bestehende Konten melden sich an, Einladungen
 * laufen weiter nur über den Einladungslink.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N, fmtDate } from '../ui/i18n/billing';
import { GUTSCHEIN_I18N } from '../ui/i18n/gutschein';
import { api } from '../data/api';
import type { AuthUser } from '../data/api';
import { track } from '../data/track';
import { voucherApi, type Offer, type RedeemResult, type VoucherPreview } from './api';
import BillingShell from './BillingShell';
import AccountStep from './AccountStep';
import { ConfirmEmailBanner } from './ConfirmEmail';
import { isLifetime, voucherErrorText, voucherReasonOf } from './format';
import { useMe, useOffer, useTitle } from './hooks';
import { clearPendingCode, displayCode, readPendingCode, savePendingCode } from './pendingCode';
import { notifyPlanChanged } from './planEvents';
import { PATHS, navigate } from './route';
import { APP_NAME } from '../brand';
import './billing.css';

export default function CodePage() {
  return <BillingShell narrow mainLabel="code">{lang => <CodeBody lang={lang} />}</BillingShell>;
}

/** Endgültige Gründe: Der gemerkte Code hilft hier nicht mehr weiter. */
const FINAL = new Set(['invalid', 'expired', 'exhausted', 'inactive', 'already_redeemed', 'campaign_redeemed', 'already_lifetime']);

type PreviewOk = Extract<VoucherPreview, { ok: true }>;

function CodeBody({ lang }: { lang: UiLang }) {
  const g = GUTSCHEIN_I18N[lang];
  const t = BILLING_I18N[lang];
  useTitle(`${g.pageTitle} · ${APP_NAME}`);
  const { offer } = useOffer();
  const { user, loaded, refresh, setUser } = useMe();
  const [code, setCode] = useState(() => readPendingCode() ?? '');
  const [preview, setPreview] = useState<PreviewOk | null>(null);
  const [checked, setChecked] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'check' | 'redeem' | null>(null);
  const busyRef = useRef(false);
  const [done, setDone] = useState<(RedeemResult & { appended: boolean }) | null>(null);
  const [account, setAccount] = useState<'register' | 'login' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const termsRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const autoChecked = useRef(false);
  /** Fokus nach dem nächsten Zeichnen: auf die Bedingungen bzw. die
   *  Erfolgsmeldung, damit Tastatur und Screenreader dort weitermachen. */
  const focusNext = useRef<'terms' | 'done' | null>(null);
  useEffect(() => {
    if (focusNext.current === 'terms' && preview) { termsRef.current?.focus(); focusNext.current = null; }
    else if (focusNext.current === 'done' && done) { doneRef.current?.focus(); focusNext.current = null; }
  }, [preview, done]);

  useEffect(() => { track('code_view'); }, []);

  const check = useCallback(async (raw: string, opts: { auto?: boolean } = {}) => {
    const c = raw.trim();
    if (!c) { setErr(g.empty); inputRef.current?.focus(); return; }
    if (busyRef.current) return;
    busyRef.current = true; setBusy('check'); setErr(null); setPreview(null);
    try {
      const r = await voucherApi.preview(c);
      if (r.ok) {
        setPreview(r); setChecked(c);
        // Merken, damit der Weg über Registrierung und Bestätigung ohne
        // erneutes Eintippen hierher zurückführt.
        savePendingCode(c);
        if (!opts.auto) focusNext.current = 'terms';
      } else {
        setErr(g.err[r.reason] ?? t.errGeneric);
        if (FINAL.has(r.reason)) clearPendingCode();
        if (!opts.auto) inputRef.current?.focus();
      }
    } catch (e) {
      setErr(voucherErrorText(e, lang));
      const reason = voucherReasonOf(e);
      if (reason && FINAL.has(reason)) clearPendingCode();
    } finally { busyRef.current = false; setBusy(null); }
  }, [g, t, lang]);

  // Zurück mit gemerktem Code (nach Registrierung, Anmeldung oder Bestätigung):
  // Bedingungen sofort wieder zeigen, sobald klar ist, wer angemeldet ist.
  useEffect(() => {
    if (!loaded || autoChecked.current) return;
    autoChecked.current = true;
    const pending = readPendingCode();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig nach dem Laden: gemerkten Code wieder prüfen
    if (pending) void check(pending, { auto: true });
  }, [loaded, check]);

  // Bestätigungslink in einem anderen Tab geöffnet: Beim Zurückkommen den
  // Bestätigungsstand neu holen, damit „Code einlösen" ohne Neuladen erscheint.
  useEffect(() => {
    if (!user || user.emailConfirmed !== false) return;
    const on = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', on);
    document.addEventListener('visibilitychange', on);
    return () => { window.removeEventListener('focus', on); document.removeEventListener('visibilitychange', on); };
  }, [user, refresh]);

  async function redeem() {
    if (busyRef.current || !checked) return;
    busyRef.current = true; setBusy('redeem'); setErr(null);
    try {
      const r = await voucherApi.redeem(checked, 'code_page');
      clearPendingCode();
      // Beginnt die Gratiszeit später, hängt sie an eine laufende Laufzeit an.
      setDone({ ...r, appended: r.grant.kind === 'days' && Date.parse(r.grant.from) > Date.now() + 60_000 });
      track('voucher_redeemed', { kind: r.grant.kind, where: 'code_page' });
      notifyPlanChanged();
      void refresh();
      focusNext.current = 'done';
    } catch (e) {
      const reason = voucherReasonOf(e);
      if (reason === 'email_unconfirmed') { setUser(user ? { ...user, emailConfirmed: false } : user); }
      else if (reason === 'auth_required') { setUser(null); }
      if (reason && FINAL.has(reason)) clearPendingCode();
      setErr(voucherErrorText(e, lang));
    } finally { busyRef.current = false; setBusy(null); }
  }

  function reset() {
    clearPendingCode();
    setPreview(null); setChecked(''); setErr(null); setCode(''); setAccount(null);
    queueMicrotask(() => inputRef.current?.focus());
  }

  async function signOut() {
    try { await api.logout(); } catch { /* ignore */ }
    setUser(null);
  }

  function onAccountDone(u: AuthUser) {
    setUser(u);
    setAccount(null);
    // Mit Konto noch einmal prüfen: Erst jetzt weiß der Server, ob dieses
    // Konto den Code schon eingelöst hat oder dauerhaft freigeschaltet ist.
    if (checked) { savePendingCode(checked); void check(checked); }
  }

  if (!loaded) return <p className="bl-lede" role="status" style={{ paddingTop: '40px' }}>{t.busy}</p>;

  if (done) {
    const until = done.grant.until ?? done.plan?.until ?? null;
    const appended = done.appended;
    const msg = done.grant.kind === 'lifetime' || isLifetime(done.plan)
      ? g.okLifetime
      : until ? (appended ? g.okDaysAppended(done.grant.days ?? 0, fmtDate(until, lang)) : g.okDays(fmtDate(until, lang))) : g.okLifetime;
    return (
      <section className="bl-hero" aria-labelledby="bl-code-done-h">
        <div className="bl-card" data-voucher-done={done.grant.kind}>
          <div className="bl-status">
            <span className="bl-status-dot" data-tone="ok" aria-hidden><Tick /></span>
            <div>
              <h1 id="bl-code-done-h" ref={doneRef} tabIndex={-1} className="bl-h2">{g.okTitle}</h1>
              <p className="bl-ok" role="status" aria-live="polite" data-voucher-ok>{msg}</p>
            </div>
          </div>
          <div className="bl-actions">
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => navigate('/')}>{g.toTool}</button>
            <button type="button" className="ui-btn ui-btn-soft" onClick={() => navigate('/?pass=1')}>{g.toMyPass}</button>
          </div>
        </div>
      </section>
    );
  }

  const regOpen = preview?.registrationOpen ?? false;
  const confirmed = !!user && user.emailConfirmed !== false;
  const alreadyLifetime = !!preview && (preview.alreadyLifetime === true || (!!user && isLifetime(user.plan)));
  // AccountStep liest „Registrierung offen" aus dem Angebot. Maßgeblich ist
  // hier die Antwort der Vorschau.
  const accountOffer: Offer = { ...(offer ?? { enabled: false, sku: '', priceCents: 0, currency: 'EUR', days: 0 }), openRegistration: regOpen };

  return (
    <section className="bl-hero">
      <p className="bl-eyebrow">{g.eyebrow}</p>
      <h1 className="bl-h1" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>{g.h1}</h1>
      <p className="bl-lede">{g.lede}</p>

      {user && <div style={{ marginTop: '16px' }}><ConfirmEmailBanner user={user} lang={lang} /></div>}

      <form className="bl-card bl-form" style={{ marginTop: '20px' }} noValidate
        onSubmit={e => { e.preventDefault(); void check(code); }} aria-labelledby="bl-code-label">
        <div className="bl-field">
          <label id="bl-code-label" htmlFor="bl-code">{g.codeLabel}</label>
          <div className="bl-code-row">
            <input id="bl-code" ref={inputRef} className="bl-input bl-code-input" value={code}
              onChange={e => { setCode(e.target.value); if (err) setErr(null); if (preview && e.target.value.trim() !== checked) { setPreview(null); setChecked(''); } }}
              autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64}
              aria-invalid={!!err && !preview ? true : undefined} aria-describedby="bl-code-hint bl-code-msg" />
            <button type="submit" className="ui-btn ui-btn-soft bl-code-btn" disabled={busy !== null} aria-busy={busy === 'check' || undefined}>
              {busy === 'check' ? g.checking : g.check}
            </button>
          </div>
          <p id="bl-code-hint" className="bl-hint" style={{ marginTop: 0 }}>{g.codeHint}</p>
        </div>
        <div id="bl-code-msg" aria-live="polite">
          {err && !preview && <p className="bl-error" role="alert" data-voucher-error>{err}</p>}
        </div>
      </form>

      {preview && (
        <div className="bl-card" style={{ marginTop: '14px' }} data-voucher-preview={preview.kind}>
          <h2 id="bl-code-terms-h" ref={termsRef} tabIndex={-1} className="bl-h3">{confirmed && !alreadyLifetime ? g.confirmTitle : g.termsTitle}</h2>
          <p className="bl-code-chip"><span className="bl-sr">{g.codeLabel}: </span>{displayCode(checked)}</p>
          <ul className="bl-terms" aria-labelledby="bl-code-terms-h">
            <li><strong>{preview.kind === 'lifetime' ? g.termLifetime : g.termDays(preview.days ?? 0)}</strong></li>
            {preview.redeemUntil && <li>{g.termRedeemUntil(fmtDate(preview.redeemUntil, lang))}</li>}
            {preview.limited && preview.limitTotal ? <li>{g.termLimited(preview.limitTotal)}</li> : null}
            <li>{g.termOnce}</li>
            <li>{preview.kind === 'lifetime' ? g.termLifetimeNote : g.termNoPayment}</li>
            <li>{g.termIncludes}</li>
          </ul>
          <p className="bl-hint">{g.previewNote}</p>

          <div aria-live="polite">
            {err && <p className="bl-error" role="alert" style={{ marginTop: '12px' }} data-voucher-error>{err}</p>}
          </div>

          {alreadyLifetime ? (
            <p className="bl-ok" style={{ marginTop: '14px' }} data-voucher-lifetime-already>{user?.plan?.kind === 'unlimited' ? t.unlimitedNote : g.lifetimeNoCode}</p>
          ) : confirmed && user ? (
            <>
              <div className="bl-actions">
                <button type="button" className="ui-btn ui-btn-primary" onClick={redeem} disabled={busy !== null} aria-busy={busy === 'redeem' || undefined} data-redeem>
                  {busy === 'redeem' ? g.redeeming : g.redeem}
                </button>
                <button type="button" className="bl-linkbtn" onClick={reset}>{g.otherCode}</button>
              </div>
              <p className="bl-hint" style={{ marginTop: '10px' }}>
                {g.signedInAs(user.email || user.username)} · <button type="button" className="bl-linkbtn" onClick={signOut}>{g.signOut}</button>
              </p>
            </>
          ) : user ? (
            <p className="bl-hint" style={{ marginTop: '14px', fontSize: 'var(--t-sm)' }} data-voucher-unconfirmed>{g.unconfirmed(user.email ?? null)} {g.remembered}</p>
          ) : account ? (
            <div style={{ marginTop: '18px' }}>
              <AccountStep lang={lang} offer={accountOffer} initialMode={account} onDone={onAccountDone} />
            </div>
          ) : (
            <div style={{ marginTop: '14px' }} data-voucher-account>
              {regOpen
                ? <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{g.needAccount}</p>
                : <p className="bl-band" style={{ margin: 0 }} data-voucher-closed>{g.regClosed}</p>}
              <div className="bl-actions">
                {regOpen && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setAccount('register')}>{g.createAccount}</button>}
                <button type="button" className={`ui-btn ${regOpen ? 'ui-btn-soft' : 'ui-btn-primary'}`} onClick={() => setAccount('login')}>{g.signIn}</button>
              </div>
              {!regOpen && <p className="bl-hint" style={{ marginTop: '10px' }}>{g.inviteHint}</p>}
            </div>
          )}
        </div>
      )}
      <p className="bl-hint" style={{ marginTop: '18px' }}>
        <a className="bl-link" href={PATHS.pricing} onClick={e => { e.preventDefault(); navigate(PATHS.pricing); }}>{t.unlockSeeAll}</a>
      </p>
    </section>
  );
}

function Tick() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}
