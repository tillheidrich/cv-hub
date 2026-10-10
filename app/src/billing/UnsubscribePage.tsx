/**
 * Tipps abbestellen ohne Anmeldung (/mail/abmelden?token=…), E-Mail-Workflows
 * 10.10.2026 (pdf-service/MAILS.md).
 *
 * Der Link allein ändert nichts: Mail-Scanner rufen Links ab. Erst der Knopf
 * schickt den POST (ein Klick). Mailprogramme mit „Abbestellen"-Knopf gehen
 * direkt an die API (List-Unsubscribe-Post, RFC 8058) und kommen hier nicht vorbei.
 */
import { useEffect, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { MAILS_I18N } from '../ui/i18n/mails';
import { mailApi } from '../data/api';
import BillingShell from './BillingShell';
import { useTitle } from './hooks';
import { APP_NAME } from '../brand';
import { PATHS, navigate } from './route';
import './billing.css';

export default function UnsubscribePage({ token }: { token: string | null }) {
  return <BillingShell narrow>{lang => <Body token={token} lang={lang} />}</BillingShell>;
}

function Body({ token, lang }: { token: string | null; lang: UiLang }) {
  const x = MAILS_I18N[lang];
  useTitle(`${x.unsubTitle} · ${APP_NAME}`);
  const [state, setState] = useState<'check' | 'ready' | 'busy' | 'done' | 'already' | 'bad'>(token ? 'check' : 'bad');
  const kept = useRef(token);
  useEffect(() => {
    if (!kept.current) return;
    // Den Schlüssel nicht in der Adresszeile stehen lassen.
    try { window.history.replaceState({}, '', PATHS.unsubscribe); } catch { /* egal */ }
    mailApi.checkUnsubscribe(kept.current).then(r => setState(r.valid ? 'ready' : 'bad'), () => setState('bad'));
  }, []);
  async function go() {
    if (!kept.current || state === 'busy') return;
    setState('busy');
    try { const r = await mailApi.unsubscribe(kept.current); setState(r.changed ? 'done' : 'already'); }
    catch { setState('bad'); }
  }
  return (
    <section className="bl-hero">
      <div className="bl-card" data-unsubscribe={state}>
        <h1 className="bl-h2">{x.unsubTitle}</h1>
        {state === 'check' && <p className="bl-lede" role="status">{x.unsubBusy}</p>}
        {(state === 'ready' || state === 'busy') && (
          <>
            <p className="bl-lede">{x.unsubLead}</p>
            <div className="bl-actions">
              <button type="button" className="ui-btn ui-btn-primary" onClick={() => void go()} disabled={state === 'busy'} aria-busy={state === 'busy' || undefined} data-unsubscribe-button>
                {state === 'busy' ? x.unsubBusy : x.unsubButton}
              </button>
            </div>
          </>
        )}
        {(state === 'done' || state === 'already') && <p className="bl-lede" role="status">{state === 'done' ? x.unsubDone : x.unsubAlready}</p>}
        {state === 'bad' && <p className="bl-lede" role="alert">{x.unsubInvalid}</p>}
        <p className="bl-hint">{x.unsubServiceNote}</p>
        {state !== 'ready' && state !== 'busy' && state !== 'check' && (
          <div className="bl-actions">
            <button type="button" className="ui-btn ui-btn-soft" onClick={() => navigate('/')}>{x.toEditor}</button>
          </div>
        )}
      </div>
    </section>
  );
}
