/**
 * „Mein Pass" im Konto: Laufzeit, Bestellungen mit Rechnung, Widerruf.
 *
 * Widerrufsbutton nach § 356a BGB (seit 19.06.2026): erst „Vertrag
 * widerrufen", dann eine Bestätigungsstufe „Widerruf bestätigen", danach
 * sofort die Eingangsbestätigung mit Datum und Uhrzeit (die Mail schickt der
 * Server). Angeboten nur, solange die Frist läuft — die Frist rechnet der
 * Server (`withdrawableUntil`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N, fmtDate, fmtTime } from '../ui/i18n/billing';
import { GUTSCHEIN_I18N } from '../ui/i18n/gutschein';
import { api } from '../data/api';
import type { AuthUser } from '../data/api';
import { track } from '../data/track';
import { billingApi, formatPrice, isFuture, voucherApi, type OrderSummary, type RedeemResult, type WithdrawResult } from './api';
import { errorText, freeOnly, isLifetime, planLine, priceOf, voucherErrorText } from './format';
import { notifyPlanChanged } from './planEvents';
import { clearPendingCode } from './pendingCode';
import { useOffer, salesOpen } from './hooks';
import { PATHS, navigate } from './route';
import './billing.css';

export default function PassSection({ lang, compact = false }: { lang: UiLang; compact?: boolean }) {
  const t = BILLING_I18N[lang];
  const { offer } = useOffer();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [done, setDone] = useState<Record<string, WithdrawResult>>({});
  const [err, setErr] = useState<string | null>(null);
  const [lifetimeMsg, setLifetimeMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setUser((await api.me()).user); } catch { /* bleibt leer */ }
    try { setOrders((await billingApi.orders()).orders ?? []); setLoadErr(false); }
    catch { setOrders([]); setLoadErr(true); }
  }, []);
  useEffect(() => {
    let alive = true;
    api.me().then(d => { if (alive) setUser(d.user); }, () => {});
    billingApi.orders().then(d => { if (alive) { setOrders(d.orders ?? []); setLoadErr(false); } }, () => { if (alive) { setOrders([]); setLoadErr(true); } });
    return () => { alive = false; };
  }, []);

  async function withdraw(o: OrderSummary) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setErr(null);
    try {
      const r = await billingApi.withdraw(o.id);
      setDone(d => ({ ...d, [o.id]: r }));
      setAsking(null);
      track('withdraw_done', { where: 'account' });
      void load();
    } catch (e) { setErr(errorText(e, lang)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const g = GUTSCHEIN_I18N[lang];
  const plan = user?.plan;
  const lifetime = isLifetime(plan);
  // Dauerhafter Gratiszugang: nie eine Kaufaufforderung (Vorgabe).
  const canBuy = salesOpen(offer) && plan?.kind !== 'unlimited' && !lifetime && !(user?.role === 'admin' && !plan);
  const hasPass = plan?.kind === 'pass' && !!plan.until && isFuture(plan.until);
  const expired = (plan?.kind === 'none' && !!plan.until) || (plan?.kind === 'pass' && plan.notice === 'expired');
  const free = freeOnly(plan);
  const locale = BILLING_I18N[lang].locale;
  const grants = (plan?.grants ?? []).filter(x => x.source !== 'admin' || x.kind === 'lifetime');
  // Nur Gratiszeit: kein „verlängern" (es gibt nichts Gekauftes), nach Ablauf
  // der freiwillige Weg „90 Tage für 9 € freischalten".
  const buyLabel = free
    ? (expired && offer ? g.unlock(offer.days, priceOf(offer, lang)) : t.getPass)
    : hasPass || plan?.kind === 'pass' || (plan?.kind === 'none' && plan.until) ? t.extendPass : t.getPass;

  return (
    <section aria-labelledby="bl-mp-h" data-my-pass className="ui">
      <h2 id="bl-mp-h" className={compact ? 'bl-h3' : 'bl-h2'} style={compact ? { fontSize: '15px', marginTop: '8px' } : undefined}>{t.mpTitle}</h2>
      <div className="bl-card" style={{ padding: '14px 16px' }}>
        <p style={{ margin: 0, fontSize: 'var(--t-md)', lineHeight: 1.5 }} data-plan={plan?.kind ?? 'legacy'} data-plan-free={free || undefined} role="status" aria-live="polite">{user ? planLine(user, lang) : t.mpLoading}</p>
        {grants.length > 0 && (
          <>
            <h3 className="bl-label" style={{ margin: '12px 0 0' }}>{g.originTitle}</h3>
            <ul className="bl-grants" data-grants>
              {grants.map((x, i) => (
                <li key={`${x.source}-${x.grantedAt}-${i}`} data-grant={x.source}>
                  <b>{g.origin[x.source] ?? x.source}</b>
                  <span>{x.kind === 'lifetime' ? g.grantLifetime : g.grantDays(x.days ?? 0)}</span>
                  <span>· {g.grantSince(fmtDate(x.grantedAt, lang))}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {expired && <p className="bl-hint" data-export-hint>{g.exportHint}</p>}
        {canBuy && (
          <div className="bl-actions" style={{ marginTop: '12px' }}>
            <button type="button" className={`ui-btn ${free && !expired ? 'ui-btn-soft' : 'ui-btn-primary'}`} data-buy onClick={() => { track('checkout_start', { from: expired && free ? 'my_pass_after_voucher' : 'my_pass' }); navigate(PATHS.checkout); }}>
              {buyLabel}
            </button>
          </div>
        )}
        {/* Kündigen nur, wenn es einen bezahlten Pass gibt — ein Gutschein ist kein Vertrag mit Laufzeit. */}
        {hasPass && !free && <button type="button" className="bl-linkbtn" onClick={() => navigate(PATHS.cancel)} data-cancel-link>{t.cnCancelPass}</button>}

        {/* Codefeld für alle Konten, die einen Zugang brauchen können — nicht
            bei unbegrenzten Konten (Bestand, Admin). */}
        {user && plan?.kind !== 'unlimited' && (
          <div className="bl-voucher">
            {/* Nach einer dauerhaften Einlösung verschwindet das Codefeld; die
                Erfolgsmeldung bleibt stehen. */}
            {lifetime && lifetimeMsg && <p className="bl-ok" role="status" aria-live="polite" style={{ margin: '0 0 8px' }} data-voucher-msg="ok">{lifetimeMsg}</p>}
            {lifetime
              ? <p className="bl-hint" style={{ margin: 0 }} data-voucher-lifetime>{g.lifetimeNoCode}</p>
              : <VoucherForm lang={lang} onRedeemed={(r, text) => {
                if (r.grant.kind === 'lifetime' || isLifetime(r.plan)) setLifetimeMsg(text);
                setUser(u => (u ? { ...u, plan: r.plan } : u)); void load();
              }} />}
          </div>
        )}

        <h3 className="bl-label" style={{ margin: '18px 0 8px' }}>{t.mpOrders}</h3>
        {orders === null ? <p className="bl-hint">{t.mpLoading}</p>
          : loadErr ? <p className="bl-hint">{t.mpLoadFailed}</p>
          : orders.length === 0 ? <p className="bl-hint">{t.mpOrdersEmpty}</p>
          : (
            <ul className="bl-orders">
              {orders.map(o => {
                const receipt = done[o.id];
                const can = o.status === 'paid' && isFuture(o.withdrawableUntil) && !receipt;
                const amount = formatPrice(o.amountCents, offer?.currency ?? 'EUR', locale, true);
                return (
                  <li key={o.id} className="bl-order" data-order={o.orderNo}>
                    <div className="bl-order-top">
                      <span className="bl-order-no">{o.orderNo}</span>
                      <span className="bl-order-meta">{fmtDate(o.createdAt, lang)} · {amount} · {t.mpStatus[o.status] ?? o.status}</span>
                    </div>
                    {o.refund && <span className="bl-order-meta">{t.mpRefund(t.refundStatus[o.refund.status] ?? o.refund.status)}</span>}
                    {can && o.withdrawableUntil && <span className="bl-order-meta">{t.mpWithdrawUntil(fmtDate(o.withdrawableUntil, lang))}</span>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {o.invoiceNo && <a className="ui-btn ui-btn-soft" href={billingApi.invoiceUrl(o.id)} target="_blank" rel="noopener">{t.mpInvoice}</a>}
                      {can && asking !== o.id && (
                        <button type="button" className="ui-btn ui-btn-soft" onClick={() => { setAsking(o.id); setErr(null); }}>{t.mpWithdraw}</button>
                      )}
                    </div>
                    {asking === o.id && (
                      <div role="group" aria-labelledby={`bl-wd-${o.id}`} style={{ marginTop: '6px', padding: '12px', borderRadius: '12px', background: 'var(--ats-low-bg)' }}>
                        <p id={`bl-wd-${o.id}`} style={{ margin: '0 0 4px', fontWeight: 650 }}>{t.mpWithdrawTitle}</p>
                        <p style={{ margin: 0, fontSize: 'var(--t-sm)', lineHeight: 1.5 }}>{t.mpWithdrawBody(o.orderNo, amount)}</p>
                        {err && <p className="bl-error" role="alert" style={{ marginTop: '8px' }}>{err}</p>}
                        <div className="bl-actions" style={{ marginTop: '10px' }}>
                          <button type="button" className="ui-btn ui-btn-primary" onClick={() => withdraw(o)} disabled={busy}>{busy ? t.busy : t.mpWithdrawConfirm}</button>
                          <button type="button" className="ui-btn ui-btn-soft" onClick={() => setAsking(null)} disabled={busy}>{t.cancel}</button>
                        </div>
                      </div>
                    )}
                    {receipt && (
                      <p className="bl-ok" role="status" data-withdraw-receipt>
                        {t.mpWithdrawDone(fmtDate(receipt.receivedAt, lang), fmtTime(receipt.receivedAt, lang))}
                        {receipt.refund?.status ? ` ${t.mpRefund(t.refundStatus[receipt.refund.status] ?? receipt.refund.status)}` : ''}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
      </div>
    </section>
  );
}

/** Codefeld in „Mein Pass": kurz, ein Knopf „Code einlösen", Ergebnis als
 *  Status für Screenreader. Hier wird direkt eingelöst (angemeldet); die
 *  Bedingungen vorab zeigt die Seite /code. */
function VoucherForm({ lang, onRedeemed }: { lang: UiLang; onRedeemed: (r: RedeemResult, text: string) => void }) {
  const g = GUTSCHEIN_I18N[lang];
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busyRef.current) return;
    const c = code.trim();
    if (!c) { setMsg({ ok: false, text: g.empty }); inputRef.current?.focus(); return; }
    busyRef.current = true; setBusy(true); setMsg(null);
    try {
      const r = await voucherApi.redeem(c);
      const until = r.grant.until ?? r.plan?.until ?? null;
      const appended = r.grant.kind === 'days' && Date.parse(r.grant.from) > Date.now() + 60_000;
      const text = r.grant.kind === 'lifetime' || isLifetime(r.plan) || !until
        ? g.okLifetime
        : appended ? g.okDaysAppended(r.grant.days ?? 0, fmtDate(until, lang)) : g.okDays(fmtDate(until, lang));
      setMsg({ ok: true, text });
      setCode('');
      clearPendingCode();
      track('voucher_redeemed', { kind: r.grant.kind, where: 'my_pass' });
      onRedeemed(r, text);
      notifyPlanChanged();
    } catch (ex) {
      setMsg({ ok: false, text: voucherErrorText(ex, lang) });
      inputRef.current?.focus();
    } finally { busyRef.current = false; setBusy(false); }
  }
  return (
    <form onSubmit={submit} noValidate data-voucher-form>
      <div className="bl-field">
        <label htmlFor="bl-mp-code">{g.haveCode}</label>
        <div className="bl-code-row">
          <input id="bl-mp-code" ref={inputRef} className="bl-input bl-code-input" value={code}
            onChange={e => { setCode(e.target.value); if (msg && !msg.ok) setMsg(null); }}
            autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={64}
            aria-invalid={msg && !msg.ok ? true : undefined} aria-describedby="bl-mp-code-msg" />
          <button type="submit" className="ui-btn ui-btn-soft bl-code-btn" disabled={busy} aria-busy={busy || undefined}>{busy ? g.redeeming : g.redeem}</button>
        </div>
      </div>
      <div id="bl-mp-code-msg" role="status" aria-live="polite">
        {msg && <p className={msg.ok ? 'bl-ok' : 'bl-error'} style={{ marginTop: '8px' }} data-voucher-msg={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
      </div>
    </form>
  );
}

/** „Mein Pass" als eigenes Fenster (⋯-Menü im Editor, ?pass=1). */
export function PassDialog({ lang, onClose }: { lang: UiLang; onClose: () => void }) {
  const t = BILLING_I18N[lang];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="bl-scrim ui" onClick={onClose}>
      <div ref={ref} tabIndex={-1} className="bl-dialog" role="dialog" aria-modal="true" aria-label={t.mpTitle}
        style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
        <button type="button" className="bl-dialog-x" onClick={onClose} aria-label={t.close}>×</button>
        <PassSection lang={lang} />
      </div>
    </div>
  );
}
