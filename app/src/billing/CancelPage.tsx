/**
 * Kündigungsschaltfläche nach § 312k BGB: /kuendigen, erreichbar über
 * „Verträge hier kündigen" in jeder Fußzeile, mit und ohne Anmeldung.
 *
 * Warum es sie gibt, obwohl der Pass von selbst endet: siehe Kopf von
 * legal/kuendigung.ts (BGH I ZR 161/24). Die Seite fragt ab, was Abs. 2
 * verlangt (Art der Kündigung, Grund bei außerordentlicher, Identifizierung,
 * Vertrag, Beendigungszeitpunkt, Adresse für die Bestätigung), der Knopf heißt
 * „jetzt kündigen", danach steht die Erklärung mit Datum und Uhrzeit zum
 * Speichern oder Drucken da (Abs. 3); die Bestätigung per Mail schickt der
 * Server (Abs. 4).
 *
 * Mit Anmeldung: POST /api/billing/cancel (ohne Bot-Schutz, Konto ist die
 * Identifizierung), sofort wirksam. Ohne: POST /api/billing/cancel-public mit
 * ALTCHA; der Server antwortet dort für jeden Ausgang gleich und führt erst
 * aus, wenn der Link an die Adresse der Bestellung geklickt ist
 * (/kuendigen/bestaetigen, DeclarationConfirm.tsx; Befund H2, 09.10.2026).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N, fmtDate } from '../ui/i18n/billing';
import { fillPlaceholders } from '../legal';
import { track } from '../data/track';
import { billingApi, isFuture, type CancelResult, type OrderSummary } from './api';
import BillingShell from './BillingShell';
import AltchaField from './Altcha';
import { errorText, receivedLabel } from './format';
import { Linkify } from './LegalText';
import { useMe, useOffer, useTitle } from './hooks';
import { cancelUi } from './legalTexts';
import { PATHS } from './route';
import { APP_NAME } from '../brand';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function CancelPage() {
  return <BillingShell narrow>{lang => <Cancel lang={lang} />}</BillingShell>;
}

function Cancel({ lang }: { lang: UiLang }) {
  const t = BILLING_I18N[lang];
  const { offer } = useOffer();
  const { user, loaded } = useMe();
  const C = useMemo(() => cancelUi(lang, offer), [lang, offer]);
  useTitle(`${C.pageTitle} · ${APP_NAME}`);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [kind, setKind] = useState<'ordinary' | 'extraordinary'>('ordinary');
  const [reason, setReason] = useState('');
  const [when, setWhen] = useState<'now' | 'end' | 'date'>('now');
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [orderId, setOrderId] = useState('');
  const [altcha, setAltcha] = useState<string | null>(null);
  const [altchaKey, setAltchaKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [done, setDone] = useState<{ r: CancelResult; email: string; publicWay: boolean } | null>(null);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!user) return;
    billingApi.orders().then(o => setOrders(o.orders ?? []), () => setOrders([]));
  }, [user]);
  useEffect(() => { if (done) headRef.current?.focus(); }, [done]);

  const running = orders.filter(o => o.status === 'paid');
  const canWithdraw = running.some(o => isFuture(o.withdrawableUntil));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    setErr(null);
    if (kind === 'extraordinary' && reason.trim().length < 3) { setErr(C.errorRequired); return; }
    if (when === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr(C.errorRequired); return; }
    if (!user) {
      if (name.trim().length < 2 || !EMAIL_RE.test(email.trim())) { setErr(C.errorRequired); return; }
      if (!altcha) { setErr(t.errAltcha); return; }
    }
    busyRef.current = true; setBusy(true);
    const input = { kind, reason: kind === 'extraordinary' ? reason.trim() : undefined, when, date: when === 'date' ? date : undefined };
    try {
      const r = user
        ? await billingApi.cancel({ ...input, orderId: orderId || undefined })
        : await billingApi.cancelPublic({ ...input, name: name.trim(), email: email.trim(), orderNo: orderNo.trim(), altcha: altcha! });
      setDone({ r, email: user ? (user.email ?? '') : email.trim(), publicWay: !user });
      track('cancel_done', { where: user ? 'account' : 'public', kind });
    } catch (ex) {
      setErr(errorText(ex, lang));
      if (!user) { setAltcha(null); setAltchaKey(k => k + 1); }
    } finally { busyRef.current = false; setBusy(false); }
  }

  if (!loaded) return <p className="bl-lede" role="status" style={{ paddingTop: '40px' }}>{t.busy}</p>;

  if (done) {
    const eff = done.r.effectiveAt ? fmtDate(done.r.effectiveAt, lang)
      : when === 'date' && date ? fmtDate(`${date}T12:00:00Z`, lang)
      : when === 'end' ? t.cnEffectiveEnd
      : fmtDate(done.r.receivedAt, lang);
    return (
      <section className="bl-hero" role="status" data-cancel-done>
        <div className="bl-card">
          <h1 ref={headRef} tabIndex={-1} className="bl-h2">{C.doneTitle}</h1>
          <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }} data-cancel-receipt>
            {/* Ohne Anmeldung wirkt die Kündigung erst nach dem Klick im
                Bestätigungslink (H2, 09.10.2026); die Seite nennt deshalb
                Eingang und Art, aber kein Ende und keine Empfängeradresse. */}
            {fillPlaceholders(done.publicWay ? C.donePublicText : C.doneText, {
              RECEIVED_AT: receivedLabel(done.r.receivedAt, lang),
              CANCEL_KIND: kind === 'extraordinary' ? C.kindExtraordinary : C.kindOrdinary,
              CANCEL_EFFECTIVE: eff,
              CUSTOMER_EMAIL: done.email,
            })}
          </p>
          {kind === 'extraordinary' && reason && <p className="bl-hint">{C.reasonLabel}: {reason}</p>}
          <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{C.saveHint}</p>
          <div className="bl-actions"><button type="button" className="ui-btn ui-btn-soft" onClick={() => window.print()}>{t.cnPrint}</button></div>
        </div>
      </section>
    );
  }

  return (
    <section className="bl-hero">
      <h1 className="bl-h1" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>{C.pageTitle}</h1>
      <p className="bl-lede">{C.pageIntro}</p>
      {canWithdraw && (
        <p className="bl-band" style={{ margin: '14px 0 0' }} role="note">
          <span><Linkify text={C.withdrawalHint.replace(/→\s*/, '')} word={/Vertrag widerrufen|Withdraw from contract|Se rétracter du contrat|Desistir del contrato|widerrufen|withdraw/} href={PATHS.withdraw} newTab={false} /></span>
        </p>
      )}
      <form className="bl-card bl-form" style={{ marginTop: '20px' }} onSubmit={submit} noValidate data-cancel-form>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <legend className="bl-label" style={{ marginBottom: '8px' }}>{C.kindLabel}</legend>
          {(['ordinary', 'extraordinary'] as const).map(k => (
            <label key={k} className="bl-check">
              <input type="radio" name="cancel-kind" checked={kind === k} onChange={() => setKind(k)} />
              <span>
                <strong style={{ fontWeight: 600, display: 'block' }}>{k === 'ordinary' ? C.kindOrdinary : C.kindExtraordinary}</strong>
                <span className="bl-hint" style={{ display: 'block', margin: 0 }}>{k === 'ordinary' ? C.kindOrdinaryHelp : C.kindExtraordinaryHelp}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {kind === 'extraordinary' && (
          <div className="bl-field">
            <label htmlFor="cn-reason">{C.reasonLabel}</label>
            <textarea id="cn-reason" className="bl-input" rows={4} value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} required />
          </div>
        )}

        {user ? (
          running.length > 1 && (
            <div className="bl-field">
              <label htmlFor="cn-order">{C.orderLabel}</label>
              <select id="cn-order" className="bl-input" value={orderId} onChange={e => setOrderId(e.target.value)}>
                <option value="">{C.orderHelp}</option>
                {running.map(o => <option key={o.id} value={o.id}>{o.orderNo}</option>)}
              </select>
            </div>
          )
        ) : (
          <>
            <div className="bl-field">
              <label htmlFor="cn-name">{C.nameLabel}</label>
              <input id="cn-name" className="bl-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="bl-field">
              <label htmlFor="cn-email">{C.emailLabel}</label>
              <input id="cn-email" className="bl-input" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" aria-describedby="cn-email-hint" required />
              <p id="cn-email-hint" className="bl-hint" style={{ marginTop: 0 }}>{C.emailHelpPublic}</p>
            </div>
            <div className="bl-field">
              <label htmlFor="cn-no">{C.orderLabel}</label>
              <input id="cn-no" className="bl-input" value={orderNo} onChange={e => setOrderNo(e.target.value)} autoComplete="off" spellCheck={false} aria-describedby="cn-no-hint" />
              <p id="cn-no-hint" className="bl-hint" style={{ marginTop: 0 }}>{C.orderHelp}</p>
            </div>
          </>
        )}
        {user && <p className="bl-hint" style={{ margin: 0 }}>{C.emailHelp} {user.email}</p>}

        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <legend className="bl-label" style={{ marginBottom: '8px' }}>{C.whenLabel}</legend>
          {(['now', 'end', 'date'] as const).map(w => (
            <label key={w} className="bl-check">
              <input type="radio" name="cancel-when" checked={when === w} onChange={() => setWhen(w)} />
              <span>{w === 'now' ? C.whenNow : w === 'end' ? C.whenEndOfTerm : C.whenDate}</span>
            </label>
          ))}
          {when === 'date' && (
            <input type="date" className="bl-input" aria-label={C.whenDate} value={date} onChange={e => setDate(e.target.value)} required />
          )}
          <p className="bl-hint" style={{ margin: 0 }}>{C.whenDefault}</p>
        </fieldset>

        {!user && <AltchaField key={altchaKey} lang={lang} onChange={setAltcha} />}
        {err && <p className="bl-error" role="alert">{err}</p>}
        <div><button type="submit" className="ui-btn ui-btn-primary bl-submit" disabled={busy} data-cancel-confirm>{busy ? t.busy : C.buttonConfirm}</button></div>
      </form>
    </section>
  );
}
