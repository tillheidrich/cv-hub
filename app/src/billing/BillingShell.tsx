/**
 * Rahmen der öffentlichen Seiten (Preise, Kauf, Danke, Widerruf, AGB …):
 * schwebender Kopf mit Wortmarke, Sprachwahl und Weg zurück ins Werkzeug,
 * darunter die Fußzeile mit allen Rechtstexten und „Vertrag widerrufen".
 */
import type { ReactNode } from 'react';
import { setUiLang, type UiLang } from '../ui/i18n';
import { useUiLang } from '../ui/useUiLang';
import { BILLING_I18N } from '../ui/i18n/billing';
import { PATHS, linkClick } from './route';
import { cancelUi } from './legalTexts';
import './billing.css';
import { APP_NAME } from '../brand';

const LANGS: UiLang[] = ['de', 'en', 'fr', 'es'];

export function SiteFooter({ lang, showPricing = true }: { lang: UiLang; showPricing?: boolean }) {
  const t = BILLING_I18N[lang];
  const links: [string, string, boolean?][] = [
    ...(showPricing ? [[PATHS.pricing, t.pricing] as [string, string]] : []),
    [PATHS.imprint, t.imprint],
    [PATHS.privacy, t.privacy],
    [PATHS.terms, t.terms],
    [PATHS.withdrawalPolicy, t.withdrawalPolicy],
    [PATHS.withdraw, t.withdrawLink, true],
    // § 312k BGB: „Verträge hier kündigen", ständig verfügbar, auch ohne Anmeldung.
    [PATHS.cancel, cancelUi(lang, null).buttonCancel, true],
  ];
  return (
    <footer className="bl-footer ui" data-noprint>
      <div className="bl-wrap">
        <nav aria-label={t.footerLabel}>
          {links.map(([href, label, strong]) => (
            <a key={href} href={href} onClick={linkClick(href)} data-strong={strong ? 'true' : undefined}>{label}</a>
          ))}
          {/* Statische Seiten außerhalb der SPA (scripts/magazin-build.mjs) – normaler Link, kein SPA-Routing. */}
          <a href="/magazin/">{({ de: 'Magazin', en: 'Magazine', fr: 'Magazine', es: 'Revista' } as Record<UiLang, string>)[lang]}</a>
        </nav>
        <div className="bl-footer-meta">{APP_NAME}</div>
      </div>
    </footer>
  );
}

export default function BillingShell({ children, narrow = false, mainLabel }: { children: (lang: UiLang) => ReactNode; narrow?: boolean; mainLabel?: string }) {
  const lang = useUiLang();
  const t = BILLING_I18N[lang];
  return (
    <div className="bl-page ui" lang={lang}>
      <header className="bl-top">
        <div className={`bl-wrap bl-top-inner${narrow ? ' bl-narrow' : ''}`} style={narrow ? { maxWidth: '760px' } : undefined}>
          <div className="ui-pill">
            <a className="bl-brand" href="/" onClick={linkClick('/')} aria-label={`${APP_NAME} – ${t.home}`}>CV<b>-</b>Hub</a>
            <a className="ui-btn bl-hide-sm" href={PATHS.pricing} onClick={linkClick(PATHS.pricing)} style={{ minHeight: '40px', textDecoration: 'none' }}>{t.pricing}</a>
          </div>
          <div className="bl-top-spacer" />
          <div className="ui-seg ui-pill bl-lang" role="group" aria-label={t.langLabel}>
            {LANGS.map(l => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => setUiLang(l)} lang={l}>{l.toUpperCase()}</button>
            ))}
          </div>
          <a className="ui-btn ui-btn-primary bl-hide-sm" href="/" onClick={linkClick('/')} style={{ minHeight: '40px', textDecoration: 'none' }}>{t.toTool}</a>
        </div>
      </header>
      <main className="bl-main" aria-label={mainLabel}>
        <div className={`bl-wrap${narrow ? ' bl-narrow' : ''}`}>{children(lang)}</div>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}

/** Häkchen für Tabellen und Listen. */
export function CheckGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12.5 4.2 4.2L19 7" />
    </svg>
  );
}
