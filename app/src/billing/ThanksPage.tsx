/**
 * Danke-Seite /kauf/danke?order=<id> — hierher schickt Mollie nach der
 * Zahlung zurück, auch nach Abbruch oder Fehlschlag.
 *
 * Der Status kommt nie aus der Adresse, sondern vom Server
 * (GET /api/billing/orders/:id/status), der ihn seinerseits bei Mollie
 * nachlädt (Webhook). Bis der Webhook da ist, fragt die Seite nach: anfangs
 * alle 2 Sekunden, nach einer Minute alle 6, nach zehn Minuten nicht mehr.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N, fmtDate } from '../ui/i18n/billing';
import { ApiError } from '../data/api';
import { track } from '../data/track';
import { billingApi, type OrderStatus } from './api';
import BillingShell, { CheckGlyph } from './BillingShell';
import AccountStep from './AccountStep';
import ImportLocal from './ImportLocal';
import { useOffer, useTitle } from './hooks';
import { PATHS, navigate } from './route';
import { APP_NAME } from '../brand';

type View =
  | { kind: 'loading' }
  | { kind: 'login' }
  | { kind: 'missing' }
  | { kind: 'status'; status: OrderStatus; orderNo: string; passUntil: string | null };

const WAITING: OrderStatus[] = ['open', 'pending', 'authorized'];

export default function ThanksPage({ orderId }: { orderId: string | null }) {
  return <BillingShell narrow>{lang => <Thanks orderId={orderId} lang={lang} />}</BillingShell>;
}

function Thanks({ orderId, lang }: { orderId: string | null; lang: UiLang }) {
  const t = BILLING_I18N[lang];
  useTitle(`${t.tkPaidTitle} · ${APP_NAME}`);
  const { offer } = useOffer();
  const [view, setView] = useState<View>(orderId ? { kind: 'loading' } : { kind: 'missing' });
  /** Beginn des Nachfragens (für die Abstände 2 s → 6 s → Ende nach 10 min). */
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const paidSeen = useRef(false);
  /** Die Abfrage ruft sich über diesen Verweis selbst wieder auf. */
  const pollRef = useRef<() => void>(() => {});

  const poll = useCallback(async () => {
    if (!orderId) return;
    window.clearTimeout(timer.current);
    const again = (ms: number) => { timer.current = window.setTimeout(() => pollRef.current(), ms); };
    try {
      const s = await billingApi.orderStatus(orderId);
      setView({ kind: 'status', status: s.status, orderNo: s.orderNo, passUntil: s.passUntil });
      if (s.status === 'paid' && !paidSeen.current) { paidSeen.current = true; track('paid_view'); }
      if (WAITING.includes(s.status)) {
        const age = Date.now() - startedAt.current;
        if (age < 10 * 60_000) again(age < 60_000 ? 2000 : 6000);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setView({ kind: 'login' });
      else if (e instanceof ApiError && (e.status === 404 || e.status === 403)) setView({ kind: 'missing' });
      else again(5000);
    }
  }, [orderId]);
  useEffect(() => { pollRef.current = () => { void poll(); }; }, [poll]);

  useEffect(() => {
    startedAt.current = Date.now();
    pollRef.current();
    return () => window.clearTimeout(timer.current);
  }, [poll]);

  if (view.kind === 'loading') {
    return <section className="bl-hero"><div className="bl-card bl-status"><span className="bl-status-dot" data-tone="wait"><span className="bl-spin" /></span><p className="bl-lede" role="status">{t.tkChecking}</p></div></section>;
  }
  if (view.kind === 'login') {
    return (
      <section className="bl-hero">
        <p className="bl-lede" style={{ marginBottom: '14px' }}>{t.tkLogin}</p>
        <div className="bl-card"><AccountStep lang={lang} offer={offer} initialMode="login" onDone={() => { setView({ kind: 'loading' }); void poll(); }} /></div>
      </section>
    );
  }
  if (view.kind === 'missing') {
    return (
      <section className="bl-hero">
        <div className="bl-card">
          <p className="bl-lede">{t.tkNoOrder}</p>
          <div className="bl-actions"><button type="button" className="ui-btn ui-btn-primary" onClick={() => navigate('/?pass=1')}>{t.tkToPass}</button></div>
        </div>
      </section>
    );
  }

  const { status, orderNo, passUntil } = view;
  const tone = status === 'paid' ? 'ok' : WAITING.includes(status) ? 'wait' : 'bad';
  const [title, body] =
    status === 'paid' ? [t.tkPaidTitle, passUntil ? t.tkPaidBody(fmtDate(passUntil, lang)) : '']
    : WAITING.includes(status) ? [t.tkOpenTitle, t.tkOpenBody]
    : status === 'failed' ? [t.tkFailedTitle, t.tkFailedBody]
    : status === 'canceled' ? [t.tkCanceledTitle, t.tkCanceledBody]
    : status === 'expired' ? [t.tkExpiredTitle, t.tkExpiredBody]
    : [t.tkWithdrawnTitle, t.tkWithdrawnBody];

  return (
    <section className="bl-hero" data-order-status={status}>
      <div className="bl-card">
        <div className="bl-status">
          <span className="bl-status-dot" data-tone={tone} aria-hidden>
            {tone === 'ok' ? <CheckGlyph size={22} /> : tone === 'wait' ? <span className="bl-spin" /> : <span style={{ fontSize: '20px', fontWeight: 700 }}>!</span>}
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="bl-eyebrow" style={{ marginBottom: '4px' }}>{t.tkOrderNo(orderNo)}</p>
            <h1 className="bl-h2" aria-live="polite">{title}</h1>
            {body && <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }}>{body}</p>}
            {status === 'paid' && <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{t.tkMail}</p>}
            {WAITING.includes(status) && <p className="bl-hint" role="status">{t.tkStill}</p>}
          </div>
        </div>
        <div className="bl-actions">
          {status === 'paid' && <button type="button" className="ui-btn ui-btn-primary" onClick={() => navigate('/')}>{t.tkToEditor}</button>}
          {WAITING.includes(status) && <button type="button" className="ui-btn ui-btn-soft" onClick={() => { startedAt.current = Date.now(); void poll(); }}>{t.tkReload}</button>}
          {(status === 'failed' || status === 'canceled' || status === 'expired') && (
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => navigate(PATHS.checkout)}>{t.tkRetry}</button>
          )}
          {(status === 'withdrawn' || status === 'refunded') && <button type="button" className="ui-btn ui-btn-soft" onClick={() => navigate('/?pass=1')}>{t.tkToPass}</button>}
        </div>
      </div>
      {status === 'paid' && <ImportLocal lang={lang} />}
    </section>
  );
}
