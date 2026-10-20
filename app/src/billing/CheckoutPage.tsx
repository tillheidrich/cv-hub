/**
 * Bestellübersicht /kauf (Button-Lösung nach § 312j Abs. 2 und 3 BGB).
 *
 * Unmittelbar über dem Knopf und hervorgehoben stehen: Produkt mit den
 * wesentlichen Eigenschaften, Gesamtpreis als Endpreis (Kleinunternehmer,
 * § 19 UStG), Laufzeit und Ende ohne Verlängerung, Zahlung über Mollie und
 * das Widerrufsrecht. Der Knopf heißt genau „zahlungspflichtig bestellen".
 * Danach geht es zur `checkoutUrl` von Mollie.
 *
 * Doppelklick-sicher: Ein Absenden sperrt den Knopf, bis Mollie geöffnet ist
 * oder ein Fehler zurückkommt — sonst entstünden zwei Bestellungen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N, fmtDate } from '../ui/i18n/billing';
import { api, ApiError } from '../data/api';
import type { AuthUser } from '../data/api';
import { track } from '../data/track';
import { billingApi, type Offer } from './api';
import BillingShell from './BillingShell';
import AccountStep from './AccountStep';
import { errorText, isLifetime, priceOf } from './format';
import { GUTSCHEIN_I18N } from '../ui/i18n/gutschein';
import { ConfirmEmailBanner } from './ConfirmEmail';
import { useMe, useOffer, useTitle, salesOpen } from './hooks';
import { orderUi } from './legalTexts';
import { Linkify } from './LegalText';
import { PATHS, linkClick, navigate } from './route';
import { APP_NAME } from '../brand';

/** Länder: Verkauft wird an Verbraucher in der EU und an Unternehmen in
 *  Deutschland (legal/bestellung.ts → start.restriction). Die Liste kommt
 *  vom Server (offer.countries, Quelle billing.js EU_COUNTRIES; P1, Prüfteam
 *  10.10.2026), damit Oberfläche und Prüfung am Server nie auseinanderlaufen.
 *  Ruht der Verkauf ins EU-Ausland (Umsatzschwelle, P7), steht dort nur DE.
 *  Alles andere steht als „anderes Land" da und erklärt, warum es dort nicht
 *  geht. */
const OTHER = 'XX';

function countryOptions(lang: UiLang, countries: string[] | undefined): { code: string; name: string }[] {
  let dn: Intl.DisplayNames | null = null;
  try { dn = new Intl.DisplayNames([BILLING_I18N[lang].locale], { type: 'region' }); } catch { /* alter Browser */ }
  const codes = countries?.length ? countries.filter(c => /^[A-Z]{2}$/.test(c)) : ['DE'];
  const list = codes.map(code => ({ code, name: dn?.of(code) ?? code }));
  const first = list.find(c => c.code === 'DE');
  const rest = list.filter(c => c.code !== 'DE').sort((a, b) => a.name.localeCompare(b.name, BILLING_I18N[lang].locale));
  return first ? [first, ...rest] : rest;
}

export default function CheckoutPage() {
  return <BillingShell narrow mainLabel="checkout">{lang => <Checkout lang={lang} />}</BillingShell>;
}

function Checkout({ lang }: { lang: UiLang }) {
  const t = BILLING_I18N[lang];
  useTitle(`${t.coTitle} · ${APP_NAME}`);
  const { offer, loaded: offerLoaded } = useOffer();
  const { user, loaded, setUser } = useMe();

  if (!offerLoaded || !loaded) return <p className="bl-lede" role="status" style={{ paddingTop: '40px' }}>{t.busy}</p>;
  if (!salesOpen(offer) || !offer) {
    return (
      <section className="bl-hero">
        <div className="bl-card">
          <h1 className="bl-h2">{t.errClosed}</h1>
          <p className="bl-lede">{t.pricingSoon}</p>
          <div className="bl-actions">
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => navigate('/')}>{t.toTool}</button>
          </div>
        </div>
      </section>
    );
  }
  // Dauerhafter Gratiszugang (Gutschein): kein Kauf, keine Bestellübersicht.
  // Der Server lehnt einen Kauf in diesem Fall ohnehin ab (409 plan_lifetime).
  if (user && isLifetime(user.plan)) {
    const g = GUTSCHEIN_I18N[lang];
    return (
      <section className="bl-hero">
        <div className="bl-card" data-checkout-lifetime>
          <h1 className="bl-h2">{g.coLifetimeTitle}</h1>
          <p className="bl-lede">{g.coLifetimeBody}</p>
          <div className="bl-actions">
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => navigate('/')}>{t.toTool}</button>
          </div>
        </div>
      </section>
    );
  }
  const step = user ? 2 : 1;
  return (
    <section className="bl-hero">
      <ol className="bl-steps" aria-label={t.coStepOf(step, 3)}>
        {t.coSteps.map((s, i) => (
          <li key={s} aria-current={i + 1 === step ? 'step' : undefined} data-done={i + 1 < step || undefined}>{s}</li>
        ))}
      </ol>
      {!user
        ? <div className="bl-card"><AccountStep lang={lang} offer={offer} onDone={u => setUser(u)} /></div>
        : <OrderForm lang={lang} offer={offer} user={user} onSignedOut={() => setUser(null)} />}
    </section>
  );
}

function OrderForm({ lang, offer, user, onSignedOut }: { lang: UiLang; offer: Offer; user: AuthUser; onSignedOut: () => void }) {
  const t = BILLING_I18N[lang];
  /* Rechtlich vorgegebene Sätze kommen aus app/src/legal/bestellung.ts
   * (de/en) bzw. ui/i18n/billingLegal.ts (fr/es). Hier steht nur der Aufbau. */
  const O = useMemo(() => orderUi(lang, offer), [lang, offer]);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('DE');
  const [consumer, setConsumer] = useState(false);
  const [terms, setTerms] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  /** Server lehnt den Kauf ab, solange die Adresse unbestätigt ist (N1). */
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resend, setResend] = useState<'idle' | 'busy' | 'sent' | 'failed'>('idle');
  const options = useMemo(() => countryOptions(lang, offer.countries), [lang, offer.countries]);
  /** Ist das bemängelte Feld behoben, verschwindet die Meldung sofort — sonst
   *  stünde „ab 18" neben einem gesetzten Häkchen. */
  const fixed = (field: string) => { if (invalid === field) { setInvalid(null); setErr(null); } };
  useEffect(() => { track('checkout_view'); }, []);

  const plan = user.plan ?? null;
  const unlimited = plan?.kind === 'unlimited';
  const activeUntil = plan?.kind === 'pass' && plan.until && plan.notice !== 'expired' ? plan.until : null;
  const total = priceOf(offer, lang, true);
  const abroad = country !== 'DE';
  const notAvailable = country === OTHER;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current || notAvailable) return;
    setErr(null); setInvalid(null);
    if (name.trim().length < 2) { setInvalid('name'); setErr(O.errors.billingName); return; }
    if (abroad && !consumer) { setInvalid('consumer'); setErr(O.errors.consumerAbroad); return; }
    if (!terms) { setInvalid('terms'); setErr(O.errors.terms); return; }
    if (!adult) { setInvalid('adult'); setErr(O.errors.adult); return; }
    busyRef.current = true; setBusy(true);
    track('checkout_submit', { country });
    try {
      const r = await billingApi.checkout({ sku: offer.sku, country, billingName: name.trim(), acceptTerms: true, ageConfirmed18: true, consumer: abroad ? consumer : false });
      if (!r.checkoutUrl || (!/^https:\/\//.test(r.checkoutUrl) && !/^\//.test(r.checkoutUrl))) throw new Error('checkoutUrl');
      window.location.assign(r.checkoutUrl);
      // busy bleibt gesetzt: Die Seite verlässt sich gerade selbst.
    } catch (ex) {
      if (ex instanceof ApiError && ex.code === 'email_unconfirmed') { setUnconfirmed(true); setErr(null); }
      else setErr(errorText(ex, lang));
      busyRef.current = false; setBusy(false);
    }
  }

  async function resendMail() {
    if (resend === 'busy') return;
    setResend('busy');
    try { await billingApi.resendConfirmation(); setResend('sent'); }
    catch { setResend('failed'); }
  }

  async function signOut() {
    try { await api.logout(); } catch { /* ignore */ }
    onSignedOut();
  }

  const who = user.email || user.username;
  const termsWord = /AGB|Terms|CGV|condiciones/;
  const policyWord = /Widerrufsbelehrung|withdrawal information|informations sur la rétractation|información sobre el desistimiento/;
  return (
    <>
      <ConfirmEmailBanner user={user} lang={lang} />
      <form className="bl-card bl-form" onSubmit={submit} noValidate aria-labelledby="bl-co-h">
        <div>
          <h1 id="bl-co-h" className="bl-h2">{t.coTitle}</h1>
          {offer.testMode && <p className="bl-note" role="note" data-test-mode style={{ marginTop: '8px' }}>{t.coTestMode}</p>}
          <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>
            {t.coSignedInAs(who)} · <button type="button" className="bl-linkbtn" onClick={signOut}>{t.coSignOut}</button>
          </p>
          {activeUntil && <p className="bl-ok" style={{ marginTop: '8px' }}>{t.activeUntil(fmtDate(activeUntil, lang))}</p>}
          {unlimited && <p className="bl-ok" style={{ marginTop: '8px' }}>{t.unlimitedNote}</p>}
          {/* § 312j Abs. 1 BGB: Lieferbeschränkung und Zahlungsmittel spätestens
              bei Beginn des Bestellvorgangs. */}
          <p className="bl-hint" style={{ fontSize: 'var(--t-sm)', marginTop: '10px' }} data-k="start">{O.start.restriction} {O.start.payment}</p>
          <p className="bl-hint" style={{ marginTop: '6px' }}>{O.correctionHint}</p>
        </div>

        <div className="bl-grid2" style={{ gap: '14px' }}>
          <div className="bl-field">
            <label htmlFor="bl-name">{O.fields.billingName}</label>
            <input id="bl-name" className="bl-input" value={name} onChange={e => { setName(e.target.value); if (e.target.value.trim().length >= 2) fixed('name'); }} autoComplete="name"
              aria-invalid={invalid === 'name' || undefined} aria-describedby="bl-name-hint" maxLength={120} required />
            <p id="bl-name-hint" className="bl-hint" style={{ marginTop: 0 }}>{O.fields.billingNameHelp}</p>
          </div>
          <div className="bl-field">
            <label htmlFor="bl-country">{O.fields.country}</label>
            <select id="bl-country" className="bl-input" value={country} onChange={e => { setCountry(e.target.value); setConsumer(false); }} autoComplete="country" aria-describedby="bl-country-hint" required>
              {options.map(o => <option key={o.code} value={o.code}>{o.name}</option>)}
              <option value={OTHER}>{t.coOtherCountry}</option>
            </select>
            <p id="bl-country-hint" className="bl-hint" style={{ marginTop: 0 }}>{notAvailable ? O.fields.countryNotAvailable : O.fields.countryHelp}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {abroad && !notAvailable && (
            <label className="bl-check" data-invalid={invalid === 'consumer' || undefined}>
              <input type="checkbox" checked={consumer} onChange={e => { setConsumer(e.target.checked); if (e.target.checked) fixed('consumer'); }} name="consumerAbroad" required />
              <span>{O.fields.consumerAbroad}</span>
            </label>
          )}
          <label className="bl-check" data-invalid={invalid === 'terms' || undefined}>
            <input type="checkbox" checked={terms} onChange={e => { setTerms(e.target.checked); if (e.target.checked) fixed('terms'); }} name="acceptTerms" required />
            <span><Linkify text={O.checkboxes.terms} word={termsWord} href={PATHS.terms} /></span>
          </label>
          <label className="bl-check" data-invalid={invalid === 'adult' || undefined}>
            <input type="checkbox" checked={adult} onChange={e => { setAdult(e.target.checked); if (e.target.checked) fixed('adult'); }} name="ageConfirmed18" required />
            <span>{O.checkboxes.adult}</span>
          </label>
          {/* Kenntnisnahme der Widerrufsbelehrung als Link-Zeile, nicht als
              Häkchen (legal/bestellung.ts → withdrawalNotice). */}
          <p className="bl-hint" style={{ margin: '2px 2px 0', fontSize: 'var(--t-sm)' }} data-k="withdrawal-notice">
            <Linkify text={O.withdrawalNotice} word={policyWord} href={PATHS.withdrawalPolicy} />
          </p>
        </div>

        {/* § 312j Abs. 2 BGB: wesentliche Eigenschaften, Gesamtpreis und
            Laufzeit hervorgehoben, unmittelbar über dem Knopf. */}
        <div className="bl-order-box">
          <section className="bl-summary" aria-labelledby="bl-sum-h" data-summary>
            <h2 id="bl-sum-h">{O.summary.title}</h2>
            <dl>
              <dt>{t.sumProduct}</dt>
              <dd data-k="product"><strong>{O.summary.productLine}</strong></dd>
              <dt>{O.summary.featuresTitle.replace(/:$/, '')}</dt>
              <dd data-k="features"><ul>{O.summary.features.map(f => <li key={f}>{f}</li>)}</ul><span className="bl-hint">{O.summary.freeStays}</span></dd>
              <dt>{O.summary.termLabel}</dt>
              <dd data-k="term">{O.summary.termValue}</dd>
              <dt>{O.summary.endLabel}</dt>
              <dd data-k="end">{O.summary.endValue}</dd>
              <dt>{O.summary.priceLabel}</dt>
              <dd data-k="total"><span className="bl-total">{total}</span> <span>{O.summary.priceValue.replace(total, '').trim()}</span><br /><span className="bl-hint">{O.summary.priceNote}</span></dd>
            </dl>
            <p className="bl-summary-foot" data-k="withdrawal">{O.withdrawalHighlight}</p>
          </section>
          {err && <p className="bl-error" role="alert">{err}</p>}
          {unconfirmed && (
            <div className="bl-band" role="alert" data-unconfirmed style={{ margin: 0, flexDirection: 'column', alignItems: 'flex-start', padding: '12px 14px' }}>
              <strong style={{ fontWeight: 640 }}>{t.coUnconfirmedTitle}</strong>
              <span style={{ flex: 'none' }}>{t.coUnconfirmedBody(user.email ?? null)}{resend === 'sent' ? ` ${t.resent}` : resend === 'failed' ? ` ${t.resendFailed}` : ''}</span>
              {resend !== 'sent' && (
                <button type="button" className="ui-btn ui-btn-soft" onClick={resendMail} disabled={resend === 'busy'} data-resend-confirmation>
                  {resend === 'busy' ? t.busy : t.coResend}
                </button>
              )}
            </div>
          )}
          <button type="submit" className="ui-btn ui-btn-primary bl-submit" data-order-button disabled={busy || unlimited || notAvailable} aria-busy={busy || undefined}>
            {busy ? t.orderBusy : O.button}
          </button>
          <p className="bl-hint" style={{ margin: 0 }}>{O.afterButton}</p>
        </div>
      </form>

      {/* Vor der Bestellung zugänglich (§ 312d BGB, Art. 246a § 1 EGBGB):
          Anbieter, Mängelrecht, Aktualisierungen, Funktionalität. */}
      <section className="bl-card" style={{ marginTop: '14px' }} aria-labelledby="bl-seller-h" data-k="seller">
        <h2 id="bl-seller-h" className="bl-h3">{O.seller.title}</h2>
        <p className="bl-hint" style={{ fontSize: 'var(--t-sm)', margin: 0 }}>{O.seller.lines.map((l, i) => <span key={i} style={{ display: 'block' }}>{l}</span>)}</p>
        <ul className="bl-hint" style={{ fontSize: 'var(--t-sm)', margin: '12px 0 0', paddingLeft: '18px', listStyle: 'disc' }}>
          <li>{O.info.warranty}</li>
          <li>{O.info.updates}</li>
          <li>{O.info.compatibility}</li>
        </ul>
        <p className="bl-hint" style={{ marginTop: '12px' }}>
          <a className="bl-link" href={PATHS.terms} onClick={linkClick(PATHS.terms)}>{t.terms}</a>
          {' · '}<a className="bl-link" href={PATHS.withdrawalPolicy} onClick={linkClick(PATHS.withdrawalPolicy)}>{t.withdrawalPolicy}</a>
          {' · '}<a className="bl-link" href={PATHS.pricing} onClick={linkClick(PATHS.pricing)}>{t.unlockSeeAll}</a>
        </p>
      </section>
    </>
  );
}
