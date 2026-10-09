/**
 * Angebotsseite /preise.
 *
 * Aufbau nach dem Marketing- und dem Reddit-Bericht (08.10.2026): Der Preis
 * steht im ersten Bildschirm, vollständig („einmalig · 90 Tage · kein Abo ·
 * endet von selbst · 14 Tage Geld zurück"), daneben gleich groß, was ohne
 * Konto gratis bleibt. Kein Countdown, keine Knappheit, keine Nutzerzahlen,
 * keine Siegel, keine Namen anderer Anbieter.
 */
import { useEffect } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N } from '../ui/i18n/billing';
import { PICKABLE_THEMES } from '../templates/theme';
import { track } from '../data/track';
import type { Offer } from './api';
import { passFeatures, priceOf } from './format';
import BillingShell, { CheckGlyph } from './BillingShell';
import { useOffer, useTitle, salesOpen } from './hooks';
import { PATHS, navigate, linkClick } from './route';
import { orderUi } from './legalTexts';
import { APP_NAME } from '../brand';
import { GUTSCHEIN_I18N } from '../ui/i18n/gutschein';

/** Die beiden Karten „Ohne Konto" und „Bewerbungs-Pass" — auf /preise und
 *  als Abschnitt der Startseite. */
export function PricingCards({ lang, offer, onFree, headingLevel = 2 }: { lang: UiLang; offer: Offer | null; onFree: () => void; headingLevel?: 2 | 3 }) {
  const t = BILLING_I18N[lang];
  const H = `h${headingLevel}` as 'h2';
  const price = priceOf(offer, lang);
  const open = salesOpen(offer);
  return (
    <div className="bl-grid2">
      <section className="bl-card" aria-labelledby="bl-free-h">
        <div className="bl-offer-head">
          <H id="bl-free-h" className="bl-h3" style={{ margin: 0 }}>{t.freeTitle}</H>
        </div>
        <div className="bl-price">{t.freePrice}</div>
        <p className="bl-hint">{t.freeSub}</p>
        <ul className="bl-list">
          {t.freeList(PICKABLE_THEMES.length).map(x => <li key={x}><CheckGlyph /><span style={{ color: 'var(--ink)', fontSize: 'var(--t-md)' }}>{x}</span></li>)}
        </ul>
        <div className="bl-actions">
          <button type="button" className="ui-btn ui-btn-soft" onClick={onFree}>{t.freeCta}</button>
        </div>
      </section>
      <section className="bl-card bl-card-accent" aria-labelledby="bl-pass-h">
        <div className="bl-offer-head">
          <H id="bl-pass-h" className="bl-h3" style={{ margin: 0 }}>{t.productName}</H>
          {offer && <span className="ui-tag">{t.passSub(offer.days)}</span>}
        </div>
        {offer ? (
          <>
            <div className="bl-price">{price}<small>{t.oneTime}</small></div>
            <ul className="bl-facts" aria-label={t.productName}>
              {t.priceFacts(offer.days).map(f => <li key={f}>{f}</li>)}
            </ul>
            <p className="bl-hint">{t.vatNote}</p>
            {/* § 312j Abs. 1 BGB: Lieferbeschränkung und Zahlungsmittel
                spätestens bei Beginn des Bestellvorgangs (legal/bestellung.ts). */}
            <p className="bl-hint" data-k="start">{orderUi(lang, offer).start.restriction} {orderUi(lang, offer).start.payment}</p>
            {open && (
              <div className="bl-actions" style={{ marginTop: '14px' }}>
                <a className="ui-btn ui-btn-primary" href={PATHS.checkout} data-get-pass
                  onClick={e => { track('checkout_start', { from: 'pricing' }); linkClick(PATHS.checkout)(e); }}>{t.getPass}</a>
              </div>
            )}
          </>
        ) : <p className="bl-hint">{t.pricingSoon}</p>}
        <ul className="bl-list">
          {passFeatures(offer).map(f => (
            <li key={f}><CheckGlyph /><div><strong>{t.features[f].title}</strong><span>{t.features[f].body}</span></div></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Cell({ v, lang }: { v: boolean | string; lang: UiLang }) {
  const t = BILLING_I18N[lang];
  if (v === true) return <span className="bl-yes"><CheckGlyph /><span className="bl-sr">{t.yes}</span></span>;
  if (v === false) return <span className="bl-no" aria-label={t.no}>–</span>;
  return <>{v}</>;
}

export default function PricingPage() {
  const { offer } = useOffer();
  useEffect(() => { track('preise_view'); }, []);
  return (
    <BillingShell>
      {lang => <PricingBody lang={lang} offer={offer} />}
    </BillingShell>
  );
}

function PricingBody({ lang, offer }: { lang: UiLang; offer: Offer | null }) {
  const t = BILLING_I18N[lang];
  const price = priceOf(offer, lang);
  useTitle(`${t.pricing} · ${APP_NAME}`);
  const goFree = () => { track('pricing_free_click'); navigate('/?demo=1'); };
  const days = offer?.days ?? 90;
  return (
    <>
      <section className="bl-hero">
        <p className="bl-eyebrow">{t.pEyebrow}</p>
        <h1 className="bl-h1">{t.pH1a}{offer && <><br /><span>{t.pH1b(price)}</span></>}</h1>
        <p className="bl-lede">{t.pLede}</p>
      </section>

      <div className="bl-section" style={{ marginTop: 'clamp(24px, 4vw, 40px)' }}>
        <PricingCards lang={lang} offer={offer} onFree={goFree} />
        {/* Zurückhaltend, nicht als zweiter Kaufknopf. */}
        <p style={{ margin: '10px 2px 0' }}>
          <a className="bl-quiet-link" href={PATHS.code} onClick={linkClick(PATHS.code)} data-code-link>{GUTSCHEIN_I18N[lang].haveCode}</a>
        </p>
      </div>

      <section className="bl-section" aria-labelledby="bl-table-h">
        <h2 id="bl-table-h" className="bl-h2">{t.tableTitle}</h2>
        <div className="bl-card" style={{ padding: '6px 8px' }}>
          <div className="bl-table-wrap">
            <table className="bl-table">
              <thead>
                <tr>
                  <th scope="col">{t.tableFeature}</th>
                  <th scope="col">{t.tableFree}</th>
                  <th scope="col" className="bl-col-pass">{t.tablePass}</th>
                </tr>
              </thead>
              <tbody>
                {t.tableRows(PICKABLE_THEMES.length, price || '–', days).map(r => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td><Cell v={r.free} lang={lang} /></td>
                    <td className="bl-col-pass"><Cell v={r.pass} lang={lang} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bl-section" aria-labelledby="bl-steps-h">
        <h2 id="bl-steps-h" className="bl-h2">{t.stepsTitle}</h2>
        <ol className="bl-grid3" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {t.steps(days).map((s, i) => (
            <li key={s.title} className="bl-card">
              <span className="bl-step-no" aria-hidden>{i + 1}</span>
              <h3 className="bl-h3">{s.title}</h3>
              <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bl-section" aria-labelledby="bl-faq-h">
        <h2 id="bl-faq-h" className="bl-h2">{t.faqTitle}</h2>
        <div className="bl-faq">
          {t.faq(price || '–', days).map((q, i) => (
            <details key={q.q} open={i === 0}>
              <summary>{q.q}</summary>
              <div>{q.a}</div>
            </details>
          ))}
        </div>
      </section>

      <section className="bl-section bl-card" style={{ textAlign: 'center' }}>
        <p className="bl-lede" style={{ margin: '0 auto', color: 'var(--ink)' }}>{t.closing}</p>
        <div className="bl-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="ui-btn ui-btn-soft" onClick={goFree}>{t.freeCta}</button>
          {salesOpen(offer) && <a className="ui-btn ui-btn-primary" href={PATHS.checkout} onClick={e => { track('checkout_start', { from: 'pricing_bottom' }); linkClick(PATHS.checkout)(e); }}>{t.getPass}</a>}
        </div>
      </section>
    </>
  );
}
