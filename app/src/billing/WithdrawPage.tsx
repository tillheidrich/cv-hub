/**
 * Öffentlicher Widerruf /widerruf, ohne Anmeldung (Widerrufsfunktion nach
 * § 356a BGB, seit 19.06.2026).
 *
 * Zwei Stufen: „Vertrag widerrufen" (Angaben: Name, E-Mail der Bestellung,
 * Bestellnummer freiwillig) und „Widerruf bestätigen". Danach steht die
 * Eingangsbestätigung mit Datum und Uhrzeit sofort auf der Seite. Seit
 * 09.10.2026 (Befund M1) schickt der Server an die Adresse der BESTELLUNG
 * einen Bestätigungslink (/widerruf/bestaetigen, DeclarationConfirm.tsx);
 * erstattet wird erst nach dem Klick, für die Frist zählt der Eingang hier. Der Server antwortet für jeden
 * Ausgang gleich (keine Auskunft, ob es die Bestellung gibt), deshalb zeigt
 * die Seite keine „nicht gefunden"-Meldung. Darunter das
 * Muster-Widerrufsformular zum Herunterladen und Kopieren.
 *
 * Texte: legal/widerruf.ts → fn (de/en), ui/i18n/billingLegal.ts (fr/es).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N } from '../ui/i18n/billing';
import { fillPlaceholders } from '../legal';
import { track } from '../data/track';
import { billingApi, type WithdrawResult } from './api';
import BillingShell from './BillingShell';
import AltchaField from './Altcha';
import { errorText, receivedLabel } from './format';
import { useOffer, useTitle } from './hooks';
import { cancelUi, modelWithdrawalForm, withdrawFn } from './legalTexts';
import { PATHS, linkClick } from './route';
import { APP_NAME } from '../brand';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function WithdrawPage() {
  return <BillingShell narrow>{lang => <Withdraw lang={lang} />}</BillingShell>;
}

function Withdraw({ lang }: { lang: UiLang }) {
  const t = BILLING_I18N[lang];
  const { offer } = useOffer();
  const fn = useMemo(() => withdrawFn(lang, offer), [lang, offer]);
  useTitle(`${fn.pageTitle} · ${APP_NAME}`);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [altcha, setAltcha] = useState<string | null>(null);
  const [altchaKey, setAltchaKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [result, setResult] = useState<WithdrawResult | null>(null);
  const [copied, setCopied] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step > 1) headRef.current?.focus(); }, [step]);

  function review(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2 || !email.trim()) { setErr(fn.errorRequired); return; }
    if (!EMAIL_RE.test(email.trim())) { setErr(t.errEmail); return; }
    if (!altcha) { setErr(t.errAltcha); return; }
    setStep(2);
  }

  async function confirm() {
    if (busyRef.current || !altcha) return;
    busyRef.current = true; setBusy(true); setErr(null);
    try {
      const r = await billingApi.withdrawPublic({ name: name.trim(), email: email.trim(), orderNo: orderNo.trim(), altcha });
      setResult(r); setStep(3);
      track('withdraw_done', { where: 'public' });
    } catch (e) {
      setErr(errorText(e, lang));
      // Eine ALTCHA-Lösung gilt nur einmal: für den nächsten Versuch neu lösen.
      setAltcha(null); setAltchaKey(k => k + 1); setStep(1);
    } finally { busyRef.current = false; setBusy(false); }
  }

  const form = modelWithdrawalForm(lang, offer);
  function download() {
    const blob = new Blob([form + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = lang === 'de' ? 'Muster-Widerrufsformular.txt' : 'model-withdrawal-form.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function copy() {
    navigator.clipboard?.writeText(form).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }, () => { /* Text steht sichtbar da */ });
  }
  const values = { ORDER_NO: orderNo.trim() || t.wdNoOrderNo, CUSTOMER_NAME: name.trim(), CUSTOMER_EMAIL: email.trim() };

  return (
    <>
      <section className="bl-hero">
        <h1 className="bl-h1" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>{fn.pageTitle}</h1>
        <p className="bl-lede">{fn.pageIntro}</p>
        <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{t.wdAccountHint}</p>
      </section>

      <section className="bl-section bl-card" style={{ marginTop: '20px' }} data-withdraw-step={step}>
        {step === 1 && (
          <form className="bl-form" onSubmit={review} noValidate>
            <div className="bl-field">
              <label htmlFor="wd-name">{fn.fieldName}</label>
              <input id="wd-name" className="bl-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
            </div>
            <div className="bl-field">
              <label htmlFor="wd-email">{fn.fieldEmail}</label>
              <input id="wd-email" className="bl-input" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" aria-describedby="wd-email-hint" required />
              <p id="wd-email-hint" className="bl-hint" style={{ marginTop: 0 }}>{fn.fieldEmailHelp}</p>
            </div>
            <div className="bl-field">
              <label htmlFor="wd-no">{fn.fieldOrderNo}</label>
              <input id="wd-no" className="bl-input" value={orderNo} onChange={e => setOrderNo(e.target.value)} autoComplete="off" spellCheck={false} aria-describedby="wd-no-hint" />
              <p id="wd-no-hint" className="bl-hint" style={{ marginTop: 0 }}>{fn.fieldOrderNoHelp}</p>
            </div>
            <AltchaField key={altchaKey} lang={lang} onChange={setAltcha} />
            {err && <p className="bl-error" role="alert">{err}</p>}
            <div><button type="submit" className="ui-btn ui-btn-primary bl-submit" data-withdraw-start>{fn.buttonWithdraw}</button></div>
          </form>
        )}
        {step === 2 && (
          <div className="bl-form">
            <h2 ref={headRef} tabIndex={-1} className="bl-h3">{fn.reviewTitle}</h2>
            <div className="bl-summary" style={{ margin: 0 }}>
              <p style={{ margin: 0, fontSize: 'var(--t-md)', lineHeight: 1.55 }} data-withdraw-review>{fillPlaceholders(fn.reviewText, values)}</p>
            </div>
            {err && <p className="bl-error" role="alert">{err}</p>}
            <div className="bl-actions" style={{ marginTop: 0 }}>
              <button type="button" className="ui-btn ui-btn-primary" onClick={confirm} disabled={busy} data-withdraw-confirm>{busy ? t.busy : fn.buttonConfirm}</button>
              <button type="button" className="ui-btn ui-btn-soft" onClick={() => setStep(1)} disabled={busy}>{t.wdBack}</button>
            </div>
          </div>
        )}
        {step === 3 && result && (
          <div role="status">
            <h2 ref={headRef} tabIndex={-1} className="bl-h2">{fn.doneTitle}</h2>
            <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }} data-withdraw-receipt>
              {fillPlaceholders(fn.doneText, { RECEIVED_AT: receivedLabel(result.receivedAt, lang), CUSTOMER_EMAIL: email.trim() })}
            </p>
            <p className="bl-hint">{fn.alsoAfterCancel}</p>
            <div className="bl-actions"><button type="button" className="ui-btn ui-btn-soft" onClick={() => window.print()}>{t.cnPrint}</button></div>
          </div>
        )}
      </section>

      <section className="bl-section" aria-labelledby="wd-form-h">
        <h2 id="wd-form-h" className="bl-h2">{t.wdFormTitle}</h2>
        <p className="bl-lede" style={{ fontSize: 'var(--t-md)', marginBottom: '12px' }}>{t.wdFormLede}</p>
        <pre className="bl-pre" data-model-form>{form}</pre>
        <div className="bl-actions">
          <button type="button" className="ui-btn ui-btn-soft" onClick={download}>{t.wdDownload}</button>
          <button type="button" className="ui-btn ui-btn-soft" onClick={copy} aria-live="polite">{copied ? t.wdCopied : t.wdCopy}</button>
        </div>
        <p className="bl-hint" style={{ marginTop: '16px' }}>
          <a className="bl-link" href={PATHS.cancel} onClick={linkClick(PATHS.cancel)}>{cancelUi(lang, offer).buttonCancel}</a>
        </p>
      </section>
    </>
  );
}
