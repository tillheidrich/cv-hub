/**
 * Double-Opt-in: Band „Bitte E-Mail bestätigen" mit „Erneut senden" und die
 * Seite hinter dem Bestätigungslink (/email-bestaetigen?token=…).
 */
import { useEffect, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N } from '../ui/i18n/billing';
import type { AuthUser } from '../data/api';
import { billingApi } from './api';
import BillingShell from './BillingShell';
import { useTitle } from './hooks';
import { PATHS, navigate } from './route';
import { errorText } from './format';
import { hasPendingCode } from './pendingCode';
import './billing.css';
import { APP_NAME } from '../brand';

/** Band für Konten mit unbestätigter Adresse. Zeigt sich nur, wenn der
 *  Server ausdrücklich `emailConfirmed: false` meldet. */
export function ConfirmEmailBanner({ user, lang }: { user: AuthUser | null; lang: UiLang }) {
  const t = BILLING_I18N[lang];
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle');
  if (!user || user.emailConfirmed !== false) return null;
  async function resend() {
    if (state === 'busy') return;
    setState('busy');
    try { await billingApi.resendConfirmation(); setState('sent'); }
    catch { setState('failed'); }
  }
  return (
    <div className="bl-band ui" role="status" data-noprint data-band="confirm-email">
      <span>{user.email ? t.confirmBanner(user.email) : t.confirmBannerNoMail}{state === 'sent' ? ` ${t.resent}` : state === 'failed' ? ` ${t.resendFailed}` : ''}</span>
      {state !== 'sent' && (
        <button type="button" className="ui-btn ui-btn-soft" onClick={resend} disabled={state === 'busy'}>{t.resend}</button>
      )}
    </div>
  );
}

export default function ConfirmEmailPage({ token }: { token: string | null }) {
  return <BillingShell narrow>{lang => <Body token={token} lang={lang} />}</BillingShell>;
}

function Body({ token, lang }: { token: string | null; lang: UiLang }) {
  const t = BILLING_I18N[lang];
  useTitle(`${t.confirmedTitle} · ${APP_NAME}`);
  const [state, setState] = useState<'busy' | 'ok' | 'bad'>(token ? 'busy' : 'bad');
  const [msg, setMsg] = useState<string | null>(null);
  const once = useRef(false);
  useEffect(() => {
    if (!token || once.current) return;
    once.current = true;
    // Den Schlüssel nicht in der Adresszeile stehen lassen.
    try { window.history.replaceState({}, '', PATHS.confirmEmail); } catch { /* ignore */ }
    billingApi.confirmEmail(token).then(() => {
      // Gemerkter Zugangscode (Seite /code): direkt dorthin zurück, damit die
      // Einlösung ohne erneutes Eintippen weitergeht.
      if (hasPendingCode()) { navigate(PATHS.code, { replace: true }); return; }
      setState('ok');
    }, e => { setMsg(errorText(e, lang)); setState('bad'); });
  }, [token, lang]);

  return (
    <section className="bl-hero">
      <div className="bl-card">
        {state === 'busy' && <p className="bl-lede" role="status">{t.confirming}</p>}
        {state === 'ok' && (
          <>
            <h1 className="bl-h2">{t.confirmedTitle}</h1>
            <p className="bl-lede">{t.confirmedBody}</p>
            <div className="bl-actions">
              <button type="button" className="ui-btn ui-btn-primary" onClick={() => navigate('/')}>{t.continue}</button>
            </div>
          </>
        )}
        {state === 'bad' && (
          <>
            <h1 className="bl-h2">{t.confirmInvalid}</h1>
            {msg && msg !== t.errGeneric && <p className="bl-hint">{msg}</p>}
            <div className="bl-actions">
              <button type="button" className="ui-btn ui-btn-soft" onClick={() => navigate('/')}>{t.toTool}</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
