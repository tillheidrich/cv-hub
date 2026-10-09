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
import { api } from '../data/api';
import type { AuthUser } from '../data/api';
import { track } from '../data/track';
import { billingApi, formatPrice, isFuture, type OrderSummary, type WithdrawResult } from './api';
import { errorText, planLine } from './format';
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

  const load = useCallback(async () => {
    try { setUser((await api.me()).user); } catch { /* bleibt leer */ }
    try { setOrders((await billingApi.orders()).orders); setLoadErr(false); }
    catch { setOrders([]); setLoadErr(true); }
  }, []);
  useEffect(() => {
    let alive = true;
    api.me().then(d => { if (alive) setUser(d.user); }, () => {});
    billingApi.orders().then(d => { if (alive) { setOrders(d.orders); setLoadErr(false); } }, () => { if (alive) { setOrders([]); setLoadErr(true); } });
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

  const plan = user?.plan;
  const canBuy = salesOpen(offer) && plan?.kind !== 'unlimited' && !(user?.role === 'admin' && !plan);
  const hasPass = plan?.kind === 'pass' && !!plan.until && isFuture(plan.until);
  const locale = BILLING_I18N[lang].locale;

  return (
    <section aria-labelledby="bl-mp-h" data-my-pass className="ui">
      <h2 id="bl-mp-h" className={compact ? 'bl-h3' : 'bl-h2'} style={compact ? { fontSize: '15px', marginTop: '8px' } : undefined}>{t.mpTitle}</h2>
      <div className="bl-card" style={{ padding: '14px 16px' }}>
        <p style={{ margin: 0, fontSize: 'var(--t-md)', lineHeight: 1.5 }} data-plan={plan?.kind ?? 'legacy'}>{user ? planLine(user, lang) : t.mpLoading}</p>
        {canBuy && (
          <div className="bl-actions" style={{ marginTop: '12px' }}>
            <button type="button" className="ui-btn ui-btn-primary" onClick={() => { track('checkout_start', { from: 'my_pass' }); navigate(PATHS.checkout); }}>
              {hasPass || plan?.kind === 'pass' || (plan?.kind === 'none' && plan.until) ? t.extendPass : t.getPass}
            </button>
          </div>
        )}
        {hasPass && <button type="button" className="bl-linkbtn" onClick={() => navigate(PATHS.cancel)} data-cancel-link>{t.cnCancelPass}</button>}

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
