/**
 * Client für die Bezahlwege (Bewerbungs-Pass über Mollie).
 *
 * Grundlage ist der Schnittstellenvertrag vom 09.10.2026
 * (siehe pdf-service/billing.js); gebaut wird er in pdf-service/. Hier
 * stehen nur die Aufrufe und die Typen, wie die Oberfläche sie liest. Alles,
 * was der Server rechnet (Laufzeit, Resttage, Widerrufsfrist), wird nur
 * angezeigt, nicht nachgerechnet.
 *
 * Kein Schlüssel, keine Zahlungsdaten im Browser: Bezahlt wird auf der Seite
 * von Mollie, der Browser bekommt nur die `checkoutUrl` zurück.
 */
import { apiErrorFrom } from '../data/api';
import type { AuthUser, Plan } from '../data/api';
export type { Plan, PlanKind } from '../data/api';

const BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) || '/pdfapi';

/** Angebot, wie GET /api/billing/offer es liefert. */
export interface Offer {
  enabled: boolean;
  sku: string;
  priceCents: number;
  currency: string;
  days: number;
  vatNote?: string;
  productName?: string;
  features?: string[];
  /** Optional: offene Registrierung (OPEN_REGISTRATION). Fehlt das Feld,
   *  gilt `enabled` als Schalter für beides. */
  openRegistration?: boolean;
  /** Optional: Zahlungsarten, die im Mollie-Konto freigeschaltet sind. */
  paymentMethods?: string[];
}

export type OrderStatus =
  | 'open' | 'pending' | 'authorized' | 'paid'
  | 'failed' | 'canceled' | 'expired' | 'withdrawn' | 'refunded';

export interface OrderSummary {
  id: string;
  orderNo: string;
  status: OrderStatus;
  createdAt: string;
  amountCents: number;
  invoiceNo: string | null;
  withdrawableUntil: string | null;
  refund: { status: string } | null;
}

export interface CheckoutResult { orderId: string; orderNo: string; checkoutUrl: string }
export interface CancelInput { kind: 'ordinary' | 'extraordinary'; reason?: string; when: 'now' | 'end' | 'date'; date?: string }
export interface CancelResult { ok: boolean; receivedAt: string; effectiveAt?: string | null; kind?: string; orders?: string[] }
export interface WithdrawResult { ok: boolean; receivedAt: string; refund: { status: string } | null }

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!r.ok) throw await apiErrorFrom(r);
  return await r.json().catch(() => ({})) as T;
}

/** Antwort von Registrierung und Login: wie Login, dazu der Bestätigungsstand. */
export interface RegisterResult { user: AuthUser; emailConfirmed?: boolean; plan?: Plan }

/** Angebot einmal je Seitenaufruf holen und teilen — es ändert sich nur mit
 *  einem Neustart des Dienstes. Fehler (Dienst ohne Bezahlwege, selbst
 *  gehostete Fassung) ergeben `null`: dann gibt es keinen Pass. */
let offerPromise: Promise<Offer | null> | null = null;
export function loadOffer(): Promise<Offer | null> {
  if (!offerPromise) {
    offerPromise = req<Offer>('/api/billing/offer')
      .then(o => (o && typeof o.priceCents === 'number' ? o : null))
      .catch(() => null);
  }
  return offerPromise;
}
/** Nur für Prüfläufe: zwischengespeichertes Angebot verwerfen. */
export function resetOfferCache(): void { offerPromise = null; }

export const billingApi = {
  altchaChallengeUrl: () => `${BASE}/api/altcha/challenge`,
  register: (p: { email: string; password: string; altcha: string; ageConfirmed16: true; inviteCode?: string }) =>
    req<RegisterResult>('/api/auth/register', { method: 'POST', body: JSON.stringify(p) }),
  confirmEmail: (token: string) =>
    req<{ ok: boolean }>('/api/auth/confirm-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendConfirmation: () =>
    req<{ ok: boolean }>('/api/auth/resend-confirmation', { method: 'POST' }),
  checkout: (p: { sku: string; country: string; billingName: string; acceptTerms: true; ageConfirmed18: true }) =>
    req<CheckoutResult>('/api/billing/checkout', { method: 'POST', body: JSON.stringify(p) }),
  orderStatus: (id: string) =>
    req<{ status: OrderStatus; orderNo: string; passUntil: string | null }>(`/api/billing/orders/${encodeURIComponent(id)}/status`),
  orders: () => req<{ orders: OrderSummary[] }>('/api/billing/orders'),
  invoiceUrl: (id: string) => `${BASE}/api/billing/orders/${encodeURIComponent(id)}/invoice.pdf`,
  withdraw: (orderId: string) =>
    req<WithdrawResult>('/api/billing/withdraw', { method: 'POST', body: JSON.stringify({ orderId }) }),
  withdrawPublic: (p: { name: string; email: string; orderNo: string; altcha: string }) =>
    req<WithdrawResult>('/api/billing/withdraw-public', { method: 'POST', body: JSON.stringify(p) }),
  /** Kündigung (§ 312k BGB) im Konto; ohne orderId alle laufenden Pässe. */
  cancel: (p: CancelInput & { orderId?: string }) =>
    req<CancelResult>('/api/billing/cancel', { method: 'POST', body: JSON.stringify(p) }),
  cancelPublic: (p: CancelInput & { name: string; email: string; orderNo: string; altcha: string }) =>
    req<CancelResult>('/api/billing/cancel-public', { method: 'POST', body: JSON.stringify(p) }),
};

/** Preis als Endpreis in der Oberflächensprache, z. B. „9 €" / „€9". Ganze
 *  Beträge ohne Nachkommastellen, wie sie auf der Angebotsseite stehen. */
export function formatPrice(cents: number, currency: string, locale: string, alwaysDecimals = false): string {
  const whole = cents % 100 === 0 && !alwaysDecimals;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency,
      minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(whole ? 0 : 2)} ${currency}`;
  }
}

/** Liegt der Zeitpunkt in der Zukunft? (Widerrufsfrist) */
export function isFuture(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > now;
}
