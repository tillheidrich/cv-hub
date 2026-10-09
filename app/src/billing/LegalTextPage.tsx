/**
 * /agb und /widerrufsbelehrung — Texte aus app/src/legal/ (agb.ts,
 * widerruf.ts), gefüllt mit Anbieter- und Angebotsdaten (billing/legalTexts.ts).
 *
 * Die Widerrufsbelehrung steht im Wortlaut des gesetzlichen Musters; der
 * Absatz „Über das Gesetz hinaus" steht bewusst AUSSERHALB davon (nach
 * „Ende der Widerrufsbelehrung"), siehe Kopf von legal/widerruf.ts.
 * Englisch (und für fr/es) ist eine Lesehilfe; der Hinweis steht oben.
 */
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N } from '../ui/i18n/billing';
import BillingShell from './BillingShell';
import { LegalSections } from './LegalText';
import { useOffer, useTitle } from './hooks';
import { terms, withdrawal, modelWithdrawalForm } from './legalTexts';
import { PATHS, linkClick } from './route';
import { APP_NAME } from '../brand';

export default function LegalTextPage({ doc }: { doc: 'agb' | 'widerruf' }) {
  return <BillingShell narrow>{lang => (doc === 'agb' ? <Terms lang={lang} /> : <Policy lang={lang} />)}</BillingShell>;
}

function Notice({ text }: { text: string | null }) {
  return text ? <p className="bl-band" role="note" style={{ margin: '0 0 14px' }}><span>{text}</span></p> : null;
}

function Terms({ lang }: { lang: UiLang }) {
  const { offer } = useOffer();
  const c = terms(lang, offer);
  const t = BILLING_I18N[lang];
  useTitle(`${c.t.title} · ${APP_NAME}`);
  return (
    <article className="bl-hero" data-legal="agb">
      <Notice text={c.notice} />
      <h1 className="bl-h1" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>{c.t.title}</h1>
      <p className="bl-hint">{c.t.subtitle} · {t.lgVersion(c.version)}</p>
      <div className="bl-card" style={{ marginTop: '18px' }}>
        <LegalSections sections={c.t.sections} />
      </div>
    </article>
  );
}

function Policy({ lang }: { lang: UiLang }) {
  const { offer } = useOffer();
  const c = withdrawal(lang, offer);
  const p = c.t.policy;
  const t = BILLING_I18N[lang];
  useTitle(`${p.title} · ${APP_NAME}`);
  return (
    <article className="bl-hero" data-legal="widerruf">
      <Notice text={c.notice} />
      <h1 className="bl-h1" style={{ fontSize: 'clamp(28px, 5vw, 40px)' }}>{p.title}</h1>
      <p className="bl-hint">{t.lgVersion(c.version)}</p>
      <div className="bl-card" style={{ marginTop: '18px' }}>
        <LegalSections sections={[
          { id: 'recht', title: p.rightTitle, paragraphs: p.right },
          { id: 'folgen', title: p.consequencesTitle, paragraphs: [...p.consequences, p.noEarlyExpiry] },
        ]} />
        <p className="bl-hint" style={{ fontStyle: 'italic', marginTop: '18px' }}>{p.endMarker}</p>
      </div>
      <div className="bl-card" style={{ marginTop: '14px' }}>
        <LegalSections sections={[{ id: 'freiwillig', title: p.voluntaryTitle, paragraphs: p.voluntaryPromise }]} />
        <div className="bl-actions">
          <a className="ui-btn ui-btn-primary" href={PATHS.withdraw} onClick={linkClick(PATHS.withdraw)}>{c.t.fn.buttonWithdraw}</a>
        </div>
      </div>
      <section className="bl-section" aria-labelledby="bl-form-h" style={{ marginTop: '28px' }}>
        <h2 id="bl-form-h" className="bl-h2">{c.t.form.title}</h2>
        <pre className="bl-pre">{modelWithdrawalForm(lang, offer)}</pre>
      </section>
    </article>
  );
}
