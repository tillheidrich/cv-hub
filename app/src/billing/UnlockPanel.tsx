/**
 * Freischalt-Moment: ein ruhiges Paneel an den Stellen, die einen Server
 * brauchen (Sharelink, Versionen am Server, KI verbinden, Speichern über
 * Geräte, „Konto anlegen"). Nutzen in einem Satz, Preis, „Pass holen",
 * „Weiter ohne Konto". Es unterbricht nie einen Export.
 *
 * Ohne Verkauf (Angebot aus, selbst gehostete Fassung) zeigt es den alten
 * Hinweis auf ein Konto mit Einladung.
 *
 * Seit der Gratis-Grenze (09.10.2026, billing/freeTier.ts) öffnet es auch an
 * Word, Anschreiben, „Neue Fassung" und „Sprache hinzufügen" — dort aber nur
 * VOR der Arbeit, aus einem sichtbar markierten Knopf heraus.
 *
 * Vorlagen-Staffel (10.10.2026, Grund `template`): PDF oder HTML einer
 * Pass-Vorlage. Neben „Pass holen" steht gleichwertig „Gratis als PDF in
 * Vorlage X" (nächstliegende Gratis-Vorlage, templates/freeTemplates.ts). Der
 * Knopf wechselt nur die Vorlage und lädt nicht sofort: So sieht man die Seite
 * in der neuen Vorlage, bevor eine Datei entsteht (Umbruch, Foto, Seitenzahl
 * können sich ändern). Die ATS-Fassung als PDF steht als dritter Weg darunter.
 */
import { useEffect, useRef } from 'react';
import type { UiLang } from '../ui/i18n';
import { type UnlockKey } from '../ui/i18n/billing';
import { FREETIER_I18N } from '../ui/i18n/freetier';
import { TEMPLATE_LOCK_I18N } from '../ui/i18n/templateLock';
import { countEvent } from '../data/track';
import type { LockKey } from './freeTier';
import { ET } from '../ui/editorI18n';
import { track } from '../data/track';
import type { Offer } from './api';
import { billingFor, priceOf } from './format';
import { salesOpen, registrationOpen } from './hooks';
import { IMPORTCV_I18N } from '../ui/i18n/importcv';
import { PATHS, navigate } from './route';
import './billing.css';

export default function UnlockPanel({ feature, lang, offer, onClose, onSignIn, onInviteAccount, signedIn = false, template }: {
  /** Server-Funktion (Sharelink, MCP …) oder seit 09.10.2026 eine Funktion
   *  hinter der Gratis-Grenze (Word, Anschreiben, Fassungen, Sprachen), seit
   *  10.10.2026 auch die Vorlagen-Staffel (`template`). */
  feature: UnlockKey | LockKey;
  /** Nur bei `template`: Name der gewählten Vorlage, die nächste Gratis-Vorlage
   *  und was die beiden kostenlosen Wege tun. */
  template?: { name: string; freeName: string; onUseFree: () => void; onAtsPdf?: () => void };
  lang: UiLang;
  offer: Offer | null;
  onClose: () => void;
  /** Zur Anmeldung (bestehendes Konto). */
  onSignIn: () => void;
  /** Rückfall ohne Verkauf: Konto mit Einladungscode anlegen. */
  onInviteAccount: () => void;
  /** Schon angemeldet (Konto ohne aktiven Pass): kein „Anmelden"-Link. */
  signedIn?: boolean;
}) {
  const t = billingFor(lang, offer);
  const et = ET[lang];
  const open = salesOpen(offer);
  const boxRef = useRef<HTMLDivElement>(null);
  const before = useRef<Element | null>(null);

  useEffect(() => {
    track('unlock_panel_view', { feature, sales: open });
    // Tageszähler ohne Personenbezug (pdf-service/stats.js): Sperrgrund.
    countEvent('unlock_panel_view', { reason: feature });
    before.current = document.activeElement;
    boxRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => { (before.current as HTMLElement | null)?.focus?.(); };
  }, [feature, open]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab' || !boxRef.current) return;
    const f = [...boxRef.current.querySelectorAll<HTMLElement>('button, a[href]')].filter(x => !x.hasAttribute('disabled'));
    if (!f.length) return;
    const first = f[0]; const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  const tl = TEMPLATE_LOCK_I18N[lang];
  const item = feature === 'template'
    ? { title: tl.unlockTitle, body: tl.unlockBody(template?.name ?? '') }
    : feature in t.unlock ? t.unlock[feature as UnlockKey] : FREETIER_I18N[lang].unlock[feature as Exclude<LockKey, 'template'>];
  return (
    <div className="bl-scrim ui" onClick={onClose}>
      <div ref={boxRef} className="bl-dialog" role="dialog" aria-modal="true" aria-labelledby="bl-unlock-h" aria-describedby="bl-unlock-b"
        data-unlock={feature} onClick={e => e.stopPropagation()} onKeyDown={onKey}>
        <button type="button" className="bl-dialog-x" onClick={onClose} aria-label={t.close}>×</button>
        {open ? (
          <>
            <p className="bl-eyebrow">{t.productName}</p>
            <h2 id="bl-unlock-h" className="bl-h3">{item.title}</h2>
            <p id="bl-unlock-b" className="bl-lede" style={{ fontSize: 'var(--t-md)' }}>{item.body}</p>
            {offer && (
              <div style={{ marginTop: '14px' }}>
                <div className="bl-price" style={{ fontSize: '30px' }}>{priceOf(offer, lang)}<small>{t.oneTime}</small></div>
                <ul className="bl-facts" style={{ marginBottom: 0 }}>
                  {t.priceFacts(offer.days).map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}
            {feature !== 'template' && <p className="bl-hint" style={{ marginTop: '10px' }}>{t.unlockFreeNote}</p>}
            <div className="bl-actions">
              <button type="button" className="ui-btn ui-btn-primary" data-autofocus
                onClick={() => { track('checkout_start', { from: `unlock_${feature}` }); onClose(); navigate(PATHS.checkout); }}>{t.getPass}</button>
              {feature === 'template' && template ? (
                /* Gleichwertig: gleiche Größe, gleiche Zeile, kein Ausgrauen. */
                <button type="button" className="ui-btn ui-btn-primary" data-use-free
                  onClick={() => { onClose(); template.onUseFree(); }}>{tl.useFree(template.freeName)}</button>
              ) : (
                <button type="button" className="ui-btn ui-btn-soft" onClick={onClose}>{t.continueFree}</button>
              )}
            </div>
            {feature === 'template' && template && (
              <>
                <p className="bl-hint" style={{ marginTop: '8px' }}>{tl.useFreeSub}</p>
                <p className="bl-hint" style={{ marginTop: '8px' }} data-ats-free>
                  {tl.atsFree}
                  {template.onAtsPdf && <>{' '}<button type="button" className="bl-linkbtn" data-ats-pdf onClick={() => { onClose(); template.onAtsPdf?.(); }}>{tl.atsPdf}</button></>}
                </p>
              </>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: '10px' }}>
              <button type="button" className="bl-linkbtn" onClick={() => { onClose(); navigate(PATHS.pricing); }}>{t.unlockSeeAll}</button>
              {!signedIn && <button type="button" className="bl-linkbtn" onClick={() => { onClose(); onSignIn(); }}>{t.unlockHaveAccount}</button>}
            </div>
          </>
        ) : feature === 'account' ? (
          /* „Konto anlegen" ist keine gesperrte Funktion: kein „Demo-Limit",
             keine Fachwörter (Laien-Durchgang 19.10.2026). */
          <>
            <h2 id="bl-unlock-h" className="bl-h3">{IMPORTCV_I18N[lang].accTitle}</h2>
            <p id="bl-unlock-b" className="bl-lede" style={{ fontSize: 'var(--t-md)' }}>
              {IMPORTCV_I18N[lang].accBody}{!registrationOpen(offer) ? ` ${IMPORTCV_I18N[lang].accInvite}` : ''}
            </p>
            <div className="bl-actions">
              <button type="button" className="ui-btn ui-btn-soft" onClick={onClose}>{IMPORTCV_I18N[lang].accStay}</button>
              <button type="button" className="ui-btn ui-btn-primary" data-autofocus onClick={() => { onClose(); onInviteAccount(); }}>{et.createAccount}</button>
            </div>
            {!signedIn && <div style={{ marginTop: '10px' }}><button type="button" className="bl-linkbtn" onClick={() => { onClose(); onSignIn(); }}>{billingFor(lang, offer).unlockHaveAccount}</button></div>}
          </>
        ) : (
          <>
            <p className="bl-eyebrow">{et.swLimit}</p>
            <h2 id="bl-unlock-h" className="bl-h3">{et.swTitle} {et.swTitleAccent}</h2>
            <p id="bl-unlock-b" className="bl-lede" style={{ fontSize: 'var(--t-md)' }}>{et.swBody}</p>
            <div className="bl-actions">
              <button type="button" className="ui-btn ui-btn-soft" data-autofocus onClick={onClose}>{et.swStay}</button>
              <button type="button" className="ui-btn ui-btn-primary" onClick={() => { onClose(); onInviteAccount(); }}>{et.createAccount}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
