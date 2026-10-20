// Schnittstelle des Admin-Bereichs (pdf-service/admin.js). Immer derselbe
// Ursprung wie die Seite: Auf dem Admin-Host leitet der Proxy /pdfapi an die
// cv-api weiter, das Admin-Cookie (`__Host-cv_admin`) gilt nur dort.

const BASE = '/pdfapi';

export class AdminError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Wird aufgerufen, wenn die Sitzung abgelaufen ist (401 auf eine Admin-Route). */
let onLoggedOut: (() => void) | null = null;
export function setLoggedOutHandler(fn: (() => void) | null) { onLoggedOut = fn; }

export async function adminFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(BASE + path, {
    method: init.method || (init.body === undefined ? 'GET' : 'POST'),
    credentials: 'same-origin',
    headers: init.body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await r.json().catch(() => ({})) as { error?: string; code?: string };
  if (!r.ok) {
    if (r.status === 401 && !path.startsWith('/api/admin/auth/')) onLoggedOut?.();
    throw new AdminError(data.error || `Fehler ${r.status}`, r.status, data.code);
  }
  return data as T;
}

/** Adresse für Downloads (CSV, Rechnungs-PDF): als Link öffnen, das Cookie geht mit. */
export const downloadUrl = (path: string) => BASE + path;

/* ── Typen ──────────────────────────────────────────────────────────────── */

export interface SessionInfo {
  mode: 'separate' | 'legacy';
  authenticated: boolean;
  mailReady?: boolean;
  via?: 'admin-session' | 'app-session';
  user?: { id: number; username: string };
  expiresAt?: string | null;
  idleMinutes?: number;
  mainUrl?: string | null;
  umamiUrl?: string | null;
}

export interface Overview {
  asOf: string;
  accounts: { total: number; new7: number; new30: number; active7: number; active30: number; disabled: number; unconfirmed: number; lifetime: number; twofa: number };
  passes: { active: number; expired: number; grantsBySource: { source: string; active: number }[] };
  money: {
    month_cents: number; year_cents: number; total_cents: number; paid_orders: number; withdrawals: number; refunded: number;
    refunded_cents: number; refunds_open: number; cancellations: number; open_orders: number;
  };
  declarations: { manual: number; pending_confirmation: number };
  mail: { configured: boolean; failed7: number; sent7: number; failed_today: number };
  janitor: { lastRunAt: string | null; lastResult: Record<string, number | string> | null; lastError: string | null };
  storage: { dbBytes: number; tables: { name: string; bytes: number }[]; photos: { n: number; bytes: number }; resumes: number };
  accessRequestsPending: number;
  /** P7: Umsatz an Privatkunden im EU-Ausland (Cent), Sperre und Schwelle. */
  euAbroad: {
    currentYear: number; previousYear: number; currentYearCents: number; previousYearCents: number;
    stopAtCents: number; thresholdCents: number; warnAtCents: number; paused: boolean;
    remainingToStopCents: number; remainingToThresholdCents: number;
  } | null;
  /** P9: Einwilligung Art. 9 DSGVO (ohne Admin-Konten). */
  art9Consent?: { given: number; missing: number; withdrawn: number; version: string | null };
  version: { commit: string | null; package: string | null; node: string; startedAt: string } | null;
  sale: { enabled: boolean; ready: boolean } | null;
}

export interface DayRow {
  day: string; registrations: number; purchases: number; revenue_cents: number; vouchers: number;
  pdf_server: number; pdf_browser: number; docx: number;
}
export interface Timeseries { asOf: string; days: number; series: DayRow[] }

export interface UsageDim { value: string; n: number; label: string | null }
export interface Usage {
  asOf: string; days: number; countingSince: string | null;
  metrics: Record<string, { total: number; dims: Record<string, UsageDim[]> }>;
  profiles: { total: number; template: { value: string; n: number }[]; lang: { value: string; n: number }[]; pageMode: { value: string; n: number }[]; pageFormat: { value: string; n: number }[] };
  umamiUrl: string | null;
}

export interface Funnel { asOf: string; days: number; registered: number; confirmed: number; with_resume: number; paid: number; voucher: number; converted: number }

export interface CustomerRow {
  id: number; username: string; email: string | null; pending_email: string | null; role: string; disabled: boolean;
  created_at: string; last_seen_at: string | null; access_until: string | null; plan_kind: string | null; signup_source: string | null;
  email_confirmed: boolean; resumes: number; paid_orders: number;
}
export interface Customers { asOf: string; q: string; total: number; customers: CustomerRow[] }

export interface OrderRow {
  id: string; orderNo: string; status: string; createdAt: string; paidAt: string | null; amountCents: number; currency: string;
  country: string; invoiceNo: string | null; passDays: number; passFrom: string | null; passUntil: string | null;
  molliePaymentId: string | null; refundStatus: string | null; refundAttempts: number; withdrawnAt: string | null;
  cancelledAt: string | null; cancelEffectiveAt: string | null; userId: number | null; email: string; billingName: string; method: string | null;
  /** P6: Nummer des Stornobelegs nach Widerruf. */
  creditNoteNo?: string | null;
  /** P1: Häkchen „Kauf als Privatperson“ (null bei Bestellungen vor dem 10.10.2026). */
  consumerConfirmed?: boolean | null;
}

export interface CustomerDetail {
  asOf: string;
  account: {
    id: number; username: string; email: string | null; pendingEmail: string | null; role: string; disabled: boolean;
    createdAt: string; lastSeenAt: string | null; accessUntil: string | null; planKind: string | null; signupSource: string | null;
    emailConfirmed: boolean; emailConfirmedAt: string | null; twofaEnabled: boolean; passwordChangedAt: string | null; ageConfirmed16At: string | null;
    termsAcceptedVersion?: string | null; termsAcceptedAt?: string | null;
    art9ConsentAt?: string | null; art9ConsentVersion?: string | null; art9WithdrawnAt?: string | null;
  };
  plan: { kind: string; until: string | null; daysLeft: number | null } | null;
  inviteCode: string | null;
  grants: {
    id: number; source: string; source_id: string | null; kind: string; days: number | null; until_at: string | null; ends_at: string | null;
    granted_at: string; revoked_at: string | null; revoke_reason: string | null; effective_from: string | null; effective_until: string | null; created_by: string | null;
  }[];
  orders: OrderRow[];
  vouchers: { redeemed_at: string; kind: string; days: number | null; granted_until: string | null; voucher: string; distribution: string; campaign: string | null }[];
  logins: string[];
  counts: { resumes: number; versions: number; photos: number; shares: number; api_keys: number; connections: number };
}

export interface Payments {
  asOf: string;
  payments: OrderRow[];
  counts: { status: string; n: number }[];
  reconcile: {
    paidNoAccess: { id: string; order_no: string; user_id: number; paid_at: string; status: string }[];
    accessNotPaid: { grant_id: number; user_id: number; source_id: string; granted_at: string; order_no: string | null; status: string | null }[];
  };
  mollieMode: 'live' | 'test' | null;
}

export interface Invoices {
  asOf: string;
  invoices: OrderRow[];
  sumCents: number;
  gaps: { year: number; count: number; counter: number; missing: number[]; duplicates: number[]; ok: boolean }[];
  years: number[];
}

export interface Declaration {
  id: string; type: string; channel: string; name: string | null; email: string | null; order_no: string | null; user_id: number | null;
  received_at: string; status: string; note: string | null; resolved_at: string | null; confirmed_at: string | null; statement: string;
}

/** Admin → Verkauf (pdf-service/saleadmin.js, 20.10.2026). */
export interface SaleKeyInfo { hint: string | null; checkedAt: string | null; readable: boolean }
export interface SaleState {
  asOf: string;
  source: 'admin' | 'env';
  stored: null | { mode: 'off' | 'test' | 'live'; registration: boolean; testers: string[]; testKey: SaleKeyInfo | null; liveKey: SaleKeyInfo | null; updatedAt: string };
  effective: {
    mode: 'off' | 'test' | 'live'; keyMode: 'test' | 'live' | null; publicSale: boolean; testersSale: boolean;
    missing: string[]; registrationOpen: boolean; webhookUrl: string | null; priceCents: number; days: number; productName: string; testers: string[];
  };
  checks: { id: string; ok: boolean; label: string }[];
  methods?: { test?: { id: string; description: string }[]; live?: { id: string; description: string }[] };
}

export interface SystemStatus {
  asOf: string;
  admin: { mode: string; host: string | null; origin: string | null; url: string | null; allowedIps: string[]; invalidIps: string[]; email: string | null; sessionHours: number; idleMinutes: number };
  missing: { name: string; why: string }[];
  billing: { enabled: boolean; ready: boolean; missing: string[]; mollieMode: string | null; priceCents: number | null; days: number | null; freeTierLimits: boolean; euB2cStopCents?: number | null };
  /** P5: wirksame Fassungen der Vertragstexte. source: file = legal-texts.json, env = Übersteuerung. */
  legal?: {
    terms: string | null; withdrawal: string | null;
    source: { terms: string; withdrawal: string }; file: { terms: string | null; withdrawal: string | null };
    warnings: string[]; art9Consent: string;
  } | null;
  registration: { openVar: boolean; botProtection: boolean; open: boolean } | null;
  mail: { configured: boolean };
  umamiUrl: string | null;
  version: Overview['version'];
  nodeEnv: string | null;
  trustProxy: boolean;
  janitor: Overview['janitor'];
}

export interface AuditEntry { id: number; created_at: string; action: string; target: string | null; details: Record<string, unknown> | null; ip_net: string | null; via: string | null; admin: string | null }

export interface InviteRow { code: string; note: string | null; max_uses: number; uses: number; expires_at: string | null; access_days: number | null; revoked: boolean; created_at: string; created_by: string | null }
export interface AccessRequestRow { id: number; name: string; email: string; message: string | null; status: 'pending' | 'accepted' | 'rejected'; invite_code: string | null; ua_summary: string | null; created_at: string; decided_at: string | null }
export interface CodeStats {
  code: string; note: string | null; max_uses: number; redeemed: number; access_days: number | null; expires_at: string | null; revoked: boolean; created_at: string;
  accounts: number; active14d: number; with_pdf: number; with_docx: number; with_export: number; with_share: number; expired: number;
}

/* ── E-Mails (E-Mail-Workflows, 10.10.2026, pdf-service/mailadmin.js) ──────── */

export interface SmtpStatus {
  configured: boolean; capture: boolean; source: 'db' | 'env' | 'capture' | null;
  host: string | null; port: number | null; security: string | null; user: string | null;
  from: string | null; replyTo: string | null; envConfigured: boolean; envHost: string | null; dbActive: boolean; forceEnv: boolean;
}
export interface StoredSmtp {
  host: string; port: number; security: 'tls' | 'starttls' | 'none'; username: string; from: string; replyTo: string;
  passwordSet: boolean; passwordReadable: boolean | null; enabled: boolean; verifiedAt: string | null; updatedAt: string | null;
}
export interface MailWorkflow {
  id: string; kind: 'service' | 'tips'; label: string; trigger: string; legal: string;
  defaultEnabled: boolean; enabled: boolean;
  timing: Record<string, number>; defaultTiming: Record<string, number>; timingFields: string[];
  overridable: boolean; placeholders: { key: string; label: string }[]; customized: string[];
  counts: { sent: number; failed: number; skipped: number; unsubscribed: number | null; pending: number; waiting: number; queueFailed: number };
}
export interface MailState {
  asOf: string; smtp: SmtpStatus; stored: StoredSmtp | null;
  key: { source: string | null; warning: string | null }; precedence: string;
  workflows: MailWorkflow[]; consent: { on: number; pending: number; withdrawn: number }; countsDays: number; base: string | null;
}
export interface MailQueueEntry {
  id: number; workflow: string; status: string; due_at: string; attempts: number; last_error: string | null;
  created_at: string; sent_at: string | null; user_id: number | null; to: string | null;
}
export interface MailLogEntry { id: number; created_at: string; workflow: string; queue_id: number | null; to_masked: string | null; status: string; error: string | null }
export interface MailPreview { ok: boolean; subject: string; html: string; text: string; headers: Record<string, string>; customized: boolean }
export interface MailTexts {
  workflow: string; lang: string;
  default: { subject: string; heading: string; body: string } | null;
  override: { subject?: string; heading?: string; body?: string } | null;
  placeholders: { key: string; label: string }[];
}
