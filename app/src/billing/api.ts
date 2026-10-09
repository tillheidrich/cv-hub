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
export type { Plan, PlanKind, PlanGrant } from '../data/api';

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
  /** Gratis-Grenze (09.10.2026, Env FREE_TIER_LIMITS): `limited: true` =
   *  ohne aktiven Zugang nur das PDF, eine Fassung, eine Sprache. Fehlt das
   *  Feld (älterer Dienst, selbst gehostet), ist nichts begrenzt. */
  freeTier?: { limited: boolean };
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
/** Antwort auf POST /api/billing/declarations/confirm (Schnittstelle
 *  „Sicherheitsfixes" 09.10.2026). Fehler: 400 `token_invalid`, 409
 *  `token_used` (mit kind, orderNo, receivedAt), 410 `token_expired`, 409
 *  `not_withdrawable` (Widerruf eingegangen, Ausführung von Hand). */
export interface DeclarationConfirmResult {
  ok: boolean;
  kind: 'withdraw' | 'cancel';
  orderNo: string | null;
  receivedAt: string;
  effectiveAt?: string | null;
  refund?: { status: string } | null;
  orderNos?: string[];
}

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
  /** Bestätigt Registrierung oder (kind 'change', M2) eine neue Adresse. */
  confirmEmail: (token: string) =>
    req<{ ok: boolean; kind?: 'change' | string; email?: string }>('/api/auth/confirm-email', { method: 'POST', body: JSON.stringify({ token }) }),
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
  /** Öffentliche Erklärung über den Link aus der Mail bestätigen. Der Token
   *  geht nur im Anfragekörper an den Server. */
  confirmDeclaration: (token: string) =>
    req<DeclarationConfirmResult>('/api/billing/declarations/confirm', { method: 'POST', body: JSON.stringify({ token }) }),
};

/* ── Gutscheine (Schnittstellenvertrag „Gutscheine", 09.10.2026) ─────────────
 * Die Vorschau reserviert nichts; erst `redeem` verbraucht einen Platz. Der
 * Code geht nur im Anfragekörper an den Server, nie in eine Adresse. */

/** Fehlergründe aus Vorschau und Einlösung. */
export type VoucherReason =
  | 'invalid' | 'expired' | 'exhausted' | 'inactive' | 'already_redeemed'
  | 'campaign_redeemed' | 'already_lifetime' | 'email_unconfirmed' | 'auth_required';
export const VOUCHER_REASONS: readonly VoucherReason[] = [
  'invalid', 'expired', 'exhausted', 'inactive', 'already_redeemed',
  'campaign_redeemed', 'already_lifetime', 'email_unconfirmed', 'auth_required',
];

export type VoucherPreview =
  | {
    ok: true;
    kind: 'days' | 'lifetime';
    days: number | null;
    redeemUntil: string | null;
    limited: boolean;
    limitTotal: number | null;
    alreadyLifetime?: boolean;
    registrationOpen: boolean;
  }
  | { ok: false; reason: VoucherReason; registrationOpen?: boolean };

export interface RedeemResult {
  ok: true;
  plan: Plan;
  grant: { kind: 'days' | 'lifetime'; days: number | null; from: string; until: string | null };
}

/** Admin: ein Gutschein, wie GET /api/admin/vouchers ihn liefert
 *  (pdf-service/vouchers.js, publicView). Persönliche Codes stehen hier nie
 *  im Klartext, nur `codeHint` („…ABCD"). */
export interface AdminVoucher {
  id: string | number;
  name: string;
  distribution: 'personal' | 'public';
  code?: string | null;
  codeHint?: string | null;
  campaign?: string | null;
  campaignId?: string | number | null;
  kind: 'days' | 'lifetime';
  days: number | null;
  maxRedemptions: number | null;
  redemptions: number;
  redeemUntil: string | null;
  active: boolean;
  /** active | inactive | expired | exhausted (Server rechnet). */
  status?: 'active' | 'inactive' | 'expired' | 'exhausted';
  createdAt: string;
  /** Satz wie „100 Zugänge für je 30 Tage, einlösbar bis …". */
  summary?: string | null;
  /** Kopierbarer Aktionshinweis (nur öffentlich), ohne Adresse. */
  announcement?: string | null;
  /** Öffentliche Einlöseadresse <PUBLIC_BASE_URL>/code. */
  redeemUrl?: string | null;
}
export interface AdminRedemption {
  redeemedAt: string;
  account: string | null;
  accountDeleted?: boolean;
  kind: 'days' | 'lifetime';
  days?: number | null;
  grantedFrom?: string | null;
  grantedUntil?: string | null;
}
/** Eine Zeile der Auswertung (je Kampagne bzw. Gutschein ohne Kampagne, je
 *  Zugangsart). Käufe sind bei dauerhaften Zugängen null. */
export interface VoucherStatsRow {
  campaign: string | null;
  campaignId?: string | number | null;
  voucherId?: string | number | null;
  kind: 'days' | 'lifetime';
  redemptions: number;
  usedPassFeature: number;
  buyers: number | null;
  purchases: number | null;
  refundedPurchases: number | null;
  conversionPercent?: number | null;
}
export interface VoucherStats {
  campaigns: VoucherStatsRow[];
  byKind?: Record<'days' | 'lifetime', Omit<VoucherStatsRow, 'campaign' | 'kind'>>;
  vouchers?: (Omit<VoucherStatsRow, 'campaign'> & { id: string | number; name: string; campaign: string | null })[];
  notes?: string[];
}
export interface CreateVoucherInput {
  name: string;
  distribution: 'personal' | 'public';
  code?: string;
  campaign?: string;
  kind: 'days' | 'lifetime';
  days?: number;
  maxRedemptions: number | null;
  confirmUnlimited?: true;
  redeemUntil?: string;
  count?: number;
}
export interface CreateVoucherResult { codes?: string[]; voucher?: AdminVoucher; vouchers?: AdminVoucher[] }

export const voucherApi = {
  preview: (code: string) =>
    req<VoucherPreview>('/api/vouchers/preview', { method: 'POST', body: JSON.stringify({ code }) }),
  /** Einlösen. Fehler kommen als ApiError mit `code` aus VoucherReason.
   *  `origin` nur zur Auswertung (Seite /code oder „Mein Pass"). */
  redeem: (code: string, origin: 'code_page' | 'account' = 'account') =>
    req<RedeemResult>('/api/vouchers/redeem', { method: 'POST', body: JSON.stringify({ code, origin }) }),
  // Verwaltung (nur role=admin, serverseitig geprüft)
  list: () => req<{ vouchers: AdminVoucher[]; redeemUrl?: string }>('/api/admin/vouchers'),
  create: (p: CreateVoucherInput) =>
    req<CreateVoucherResult>('/api/admin/vouchers', { method: 'POST', body: JSON.stringify(p) }),
  deactivate: (id: string | number) =>
    req<{ ok: boolean }>(`/api/admin/vouchers/${encodeURIComponent(String(id))}/deactivate`, { method: 'POST' }),
  redemptions: (id: string | number) =>
    req<{ redemptions: AdminRedemption[] }>(`/api/admin/vouchers/${encodeURIComponent(String(id))}/redemptions`),
  stats: () => req<VoucherStats>('/api/admin/voucher-stats'),
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
