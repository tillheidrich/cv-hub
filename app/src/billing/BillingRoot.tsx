/**
 * Wurzel der App: die öffentlichen Seiten mit eigener Adresse (Preise, Kauf,
 * Danke, Widerruf, AGB, Widerrufsbelehrung, Impressum, Datenschutz,
 * E-Mail-Bestätigung, Zugangscode) — alles andere ist wie bisher `App`.
 */
import { lazy, Suspense } from 'react';
import { ImpressumPage, PrivacyPage } from '../screens/LegalPages';
import { useUiLang } from '../ui/useUiLang';
import { matchBillingRoute, navigate, useLocation } from './route';
import App from '../App';

const PricingPage = lazy(() => import('./PricingPage'));
const CheckoutPage = lazy(() => import('./CheckoutPage'));
const ThanksPage = lazy(() => import('./ThanksPage'));
const WithdrawPage = lazy(() => import('./WithdrawPage'));
const CancelPage = lazy(() => import('./CancelPage'));
const LegalTextPage = lazy(() => import('./LegalTextPage'));
const ConfirmEmailPage = lazy(() => import('./ConfirmEmail'));
const CodePage = lazy(() => import('./CodePage'));
const DeclarationConfirmPage = lazy(() => import('./DeclarationConfirm'));
const UnsubscribePage = lazy(() => import('./UnsubscribePage'));

function back() {
  if (window.history.length > 1) window.history.back();
  else navigate('/');
}

export default function BillingRoot() {
  const loc = useLocation();
  const lang = useUiLang();
  const r = matchBillingRoute(loc.pathname, loc.search);
  if (!r) return <App />;
  const page = (() => {
    switch (r.page) {
      case 'pricing': return <PricingPage />;
      case 'checkout': return <CheckoutPage />;
      case 'thanks': return <ThanksPage orderId={r.orderId} />;
      case 'withdraw': return <WithdrawPage />;
      case 'cancel': return <CancelPage />;
      case 'declarationConfirm': return <DeclarationConfirmPage kind={r.kind} token={r.token} />;
      case 'terms': return <LegalTextPage doc="agb" />;
      case 'withdrawalPolicy': return <LegalTextPage doc="widerruf" />;
      case 'confirmEmail': return <ConfirmEmailPage token={r.token} />;
      case 'code': return <CodePage />;
      case 'unsubscribe': return <UnsubscribePage token={r.token} />;
      case 'imprint': return <ImpressumPage onBack={back} lang={lang} />;
      case 'privacy': return <PrivacyPage onBack={back} lang={lang} />;
    }
  })();
  return <Suspense fallback={<div className="ui" style={{ minHeight: '100dvh', background: 'var(--canvas)' }} />}>{page}</Suspense>;
}
