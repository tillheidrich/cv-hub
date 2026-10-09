/**
 * Ziel des Bestätigungslinks einer öffentlichen Erklärung:
 * /widerruf/bestaetigen?token=… und /kuendigen/bestaetigen?token=…
 *
 * Warum es die Seite gibt (Sicherheitsbefunde H2 und M1, 09.10.2026): Über
 * /widerruf und /kuendigen konnte bis dahin jeder mit einer fremden
 * E-Mail-Adresse einen bezahlten Pass sofort beenden lassen. Jetzt nimmt der
 * Server die Erklärung mit Eingangszeit an und schickt an die Adresse der
 * BESTELLUNG einen Link hierher. Ausgeführt (Erstattung, Pass-Ende) wird erst
 * mit dem Knopf auf dieser Seite. Ein Knopf statt automatischem Absenden,
 * weil Mail-Scanner Links abrufen und manche dabei auch Skripte ausführen.
 * Für Frist und Wirkzeitpunkt zählt der ursprüngliche Eingang (`receivedAt`).
 *
 * Schnittstelle: POST /api/billing/declarations/confirm { token } →
 * { ok, kind, orderNo, receivedAt, effectiveAt, refund? }. Fehler: 400
 * token_invalid, 409 token_used, 410 token_expired, 409 not_withdrawable.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N, fmtDate } from '../ui/i18n/billing';
import { ApiError } from '../data/api';
import { track } from '../data/track';
import { billingApi, type DeclarationConfirmResult } from './api';
import BillingShell from './BillingShell';
import { errorText, receivedLabel } from './format';
import { useOffer, useTitle } from './hooks';
import { cancelUi, withdrawFn } from './legalTexts';
import { APP_NAME } from '../brand';
import { PATHS, linkClick, navigate } from './route';

type Kind = 'withdraw' | 'cancel';
type State =
  | { s: 'ready' }
  | { s: 'busy' }
  | { s: 'done'; r: DeclarationConfirmResult; at: string }
  | { s: 'used'; receivedAt: string | null }
  | { s: 'expired'; receivedAt: string | null }
  | { s: 'manual' }
  | { s: 'invalid' };

const TOKEN_RE = /^[A-Za-z0-9_-]{20,200}$/;

export default function DeclarationConfirmPage({ kind, token }: { kind: Kind; token: string | null }) {
  return <BillingShell narrow>{lang => <Body kind={kind} token={token} lang={lang} />}</BillingShell>;
}

function Body({ kind: kindFromPath, token, lang }: { kind: Kind; token: string | null; lang: UiLang }) {
  const t = BILLING_I18N[lang];
  const { offer } = useOffer();
  const fn = useMemo(() => withdrawFn(lang, offer), [lang, offer]);
  const C = useMemo(() => cancelUi(lang, offer), [lang, offer]);
  /* Den Schlüssel festhalten und sofort aus der Adresszeile nehmen: Er soll
   * weder im Verlauf noch in einem Bildschirmfoto stehen. */
  const [tk] = useState<string | null>(() => (token && TOKEN_RE.test(token) ? token : null));
  const [kind, setKind] = useState<Kind>(kindFromPath);
  const [state, setState] = useState<State>(() => (tk ? { s: 'ready' } : { s: 'invalid' }));
  const [err, setErr] = useState<string | null>(null);
  const busyRef = useRef(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  useTitle(`${kind === 'withdraw' ? t.dcTitleWithdraw : t.dcTitleCancel} · ${APP_NAME}`);

  useEffect(() => {
    try { window.history.replaceState({}, '', kindFromPath === 'withdraw' ? PATHS.withdrawConfirm : PATHS.cancelConfirm); } catch { /* ignore */ }
  }, [kindFromPath]);
  useEffect(() => { if (state.s !== 'ready' && state.s !== 'busy') headRef.current?.focus(); }, [state.s]);

  const kindOf = (v: unknown): Kind | null => (v === 'withdraw' || v === 'cancel' ? v : null);
  const strOf = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

  async function confirm() {
    if (!tk || busyRef.current) return;
    busyRef.current = true; setErr(null); setState({ s: 'busy' });
    try {
      const r = await billingApi.confirmDeclaration(tk);
      const k = kindOf(r.kind) ?? kindFromPath;
      setKind(k);
      setState({ s: 'done', r, at: new Date().toISOString() });
      track('declaration_confirmed', { kind: k });
    } catch (e) {
      const data = e instanceof ApiError ? e.data ?? {} : {};
      const k = kindOf(data.kind);
      if (k) setKind(k);
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === 'token_used') setState({ s: 'used', receivedAt: strOf(data.receivedAt) });
      else if (code === 'token_expired') setState({ s: 'expired', receivedAt: strOf(data.receivedAt) });
      else if (code === 'not_withdrawable') setState({ s: 'manual' });
      else if (code === 'token_invalid' || (e instanceof ApiError && (e.status === 400 || e.status === 404))) setState({ s: 'invalid' });
      else { setErr(errorText(e, lang)); setState({ s: 'ready' }); }
    } finally { busyRef.current = false; }
  }

  const again = kind === 'withdraw' ? PATHS.withdraw : PATHS.cancel;
  const againLabel = kind === 'withdraw' ? t.dcAgainWithdraw : t.dcAgainCancel;
  const recv = (iso: string | null) => (iso ? receivedLabel(iso, lang) : null);

  if (state.s === 'ready' || state.s === 'busy') {
    const busy = state.s === 'busy';
    return (
      <section className="bl-hero" data-declaration-state="ready">
        <div className="bl-card bl-form">
          <h1 className="bl-h2">{kind === 'withdraw' ? t.dcTitleWithdraw : t.dcTitleCancel}</h1>
          <p className="bl-lede" style={{ fontSize: 'var(--t-md)', margin: 0 }}>{kind === 'withdraw' ? t.dcIntroWithdraw : t.dcIntroCancel}</p>
          {err && <p className="bl-error" role="alert">{err}</p>}
          <div>
            <button type="button" className="ui-btn ui-btn-primary bl-submit" onClick={confirm} disabled={busy} aria-busy={busy || undefined} data-declaration-confirm>
              {busy ? t.busy : kind === 'withdraw' ? fn.buttonConfirm : C.buttonConfirm}
            </button>
          </div>
          <p className="bl-hint" style={{ margin: 0 }}>{t.dcWhy}</p>
        </div>
      </section>
    );
  }

  let title: string;
  let body: React.ReactNode;
  let showAgain = false;
  let printable = false;
  if (state.s === 'done') {
    const r = state.r;
    const no = r.orderNo || r.orderNos?.[0] || '–';
    const received = receivedLabel(r.receivedAt, lang);
    if (kind === 'withdraw') {
      title = t.dcDoneWithdrawTitle;
      const rs = r.refund?.status;
      const refund = rs === 'refunded' ? fn.refundDone : rs === 'failed' ? fn.refundFailed : fn.refundQueued;
      body = (
        <>
          <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }} data-declaration-receipt>{t.dcDoneWithdrawBody(no, received, receivedLabel(state.at, lang))}</p>
          <p className="bl-hint">{refund}</p>
        </>
      );
    } else {
      title = t.dcDoneCancelTitle;
      const eff = r.effectiveAt ? fmtDate(r.effectiveAt, lang) : fmtDate(r.receivedAt, lang);
      body = (
        <>
          <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }} data-declaration-receipt>{t.dcDoneCancelBody(no, received, eff)}</p>
          <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{C.saveHint}</p>
        </>
      );
    }
    body = <>{body}<p className="bl-hint">{t.dcMail}</p></>;
    printable = true;
  } else if (state.s === 'used') {
    title = t.dcUsedTitle;
    body = <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }}>{t.dcUsedBody(recv(state.receivedAt))}</p>;
  } else if (state.s === 'expired') {
    title = t.dcExpiredTitle;
    body = <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }}>{t.dcExpiredBody(recv(state.receivedAt))}</p>;
    showAgain = true;
  } else if (state.s === 'manual') {
    title = t.dcManualTitle;
    body = <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }}>{t.dcManualBody}</p>;
  } else {
    title = t.dcInvalidTitle;
    body = <p className="bl-lede" style={{ fontSize: 'var(--t-md)' }}>{t.dcInvalidBody}</p>;
    showAgain = true;
  }

  return (
    <section className="bl-hero" role="status" data-declaration-state={state.s}>
      <div className="bl-card">
        <h1 ref={headRef} tabIndex={-1} className="bl-h2">{title}</h1>
        {body}
        <div className="bl-actions">
          {printable && <button type="button" className="ui-btn ui-btn-soft" onClick={() => window.print()}>{t.cnPrint}</button>}
          {showAgain && <a className="ui-btn ui-btn-soft" href={again} onClick={linkClick(again)}>{againLabel}</a>}
          <button type="button" className="ui-btn ui-btn-soft" onClick={() => navigate('/')}>{t.toTool}</button>
        </div>
      </div>
    </section>
  );
}
