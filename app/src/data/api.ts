// Client for the cv-api backend (auth, invites, admin, résumé storage).
import type { AppProfile } from './types';
import { PDF_SERVICE_I18N } from '../ui/i18n/local';
import { detectInitialUiLang } from '../ui/i18n';

const BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) || '/pdfapi';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
  email?: string | null;
  twofaEnabled?: boolean;
  createdAt: string;
  /** Laufzeit des Kontos (Pilot-Platz). null/fehlt = unbegrenzt.
   *  Gerechnet wird am Server (pdf-service/access.js, `accessInfo`). */
  access?: AccessInfo | null;
  /** Bezahlmodell (Bewerbungs-Pass, 09.10.2026): unbegrenzt, Pilot, Pass oder
   *  noch kein Pass. Fehlt bei Diensten ohne Bezahlwege. */
  plan?: Plan | null;
  /** Bei offener Registrierung: ist die E-Mail-Adresse bestätigt? */
  emailConfirmed?: boolean;
}

/** Laufzeit-Modell aus /api/me und den Login-Antworten (Schnittstellenvertrag
 *  Bezahlung, „Plan-Modell"). `none` = Konto ohne aktiven Pass: lesen,
 *  exportieren, löschen ja, schreiben nein. */
export type PlanKind = 'unlimited' | 'lifetime' | 'pilot' | 'pass' | 'none';
/** Herkunft einer Berechtigung (Gutscheine, 09.10.2026): bezahlte Bestellung,
 *  Gutschein oder Pilot-Platz. Nur die eigenen, ohne Kampagnennamen. */
export interface PlanGrant {
  source: 'order' | 'voucher' | 'pilot' | 'admin';
  kind: 'days' | 'lifetime';
  days: number | null;
  grantedAt: string;
  from?: string | null;
  until?: string | null;
  label?: string;
}
export interface Plan {
  /** `lifetime` = dauerhafter Gratiszugang aus einem Gutschein: kein Ablauf,
   *  nie eine Kaufaufforderung. */
  kind: PlanKind;
  until: string | null;
  daysLeft: number | null;
  notice: 'soon' | 'final' | 'expired' | null;
  /** Alle nicht widerrufenen Berechtigungen (seit den Gutscheinen). */
  grants?: PlanGrant[];
  /** Ende inklusive Gratiszeit (Server rechnet). */
  freeUntil?: string | null;
  /** Gibt es mindestens eine bezahlte Bestellung? */
  hasPaid?: boolean;
}

/** Plan und Bestätigungsstand stehen je nach Route am Nutzer oder daneben —
 *  hier wird beides auf den Nutzer gelegt, damit die Oberfläche nur eine
 *  Stelle lesen muss. */
export function withPlan<T extends { user?: AuthUser }>(d: T & { plan?: Plan | null; emailConfirmed?: boolean; access?: AccessInfo | null }): T {
  if (!d || !d.user) return d;
  const user: AuthUser = { ...d.user };
  if (user.plan === undefined && d.plan !== undefined) user.plan = d.plan;
  if (user.emailConfirmed === undefined && d.emailConfirmed !== undefined) user.emailConfirmed = d.emailConfirmed;
  if (user.access === undefined && d.access !== undefined) user.access = d.access;
  return { ...d, user };
}

/** Laufzeit eines Pilot-Platzes, wie /api/auth/me und der Login sie liefern.
 *  notice: 'soon' ab 14 Tagen vor Ablauf, 'final' ab 3 Tagen, 'expired'. */
export interface AccessInfo {
  until: string;
  expired: boolean;
  daysLeft: number;
  notice: 'soon' | 'final' | 'expired' | null;
  readOnly: boolean;
}

/** Ereignisse, die nur im Browser entstehen (DOCX, Druck-PDF, Sharelink) —
 *  der Server zählt sie je Konto für die Auswertung je Einladungscode
 *  (POST /api/events, pdf-service/server.js). */
export type ClientEvent = 'docx' | 'pdf_local' | 'share_create';

/** Login may succeed directly ({ user }) or require a 2FA e-mail code
 *  ({ twofa: true, challenge }). */
export interface LoginResult {
  user?: AuthUser;
  twofa?: boolean;
  challenge?: string;
}

export interface TwoFaStatus {
  enabled: boolean;
  hasEmail: boolean;
  mailReady: boolean;
  canEnable: boolean;
}

export interface InviteCode {
  code: string;
  note: string | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
  created_by: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  role: string;
  disabled: boolean;
  created_at: string;
  last_seen_at: string | null;
  resume_count: number;
}

export interface AccessRequest {
  id: number;
  name: string;
  email: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  invite_code: string | null;
  ua_summary: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

export interface OauthConnection {
  id: number;
  client_name: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  revoked: boolean;
}

/**
 * Fehler mit Statuscode.
 *
 * Vorher warf `req` einen blanken `Error` mit der Meldung des Servers — und die
 * Oberfläche musste raten, was passiert war, indem sie deutsche Wörter in
 * dieser Meldung suchte („widerrufen", „abgelaufen"). Das band die Anzeige an
 * die Sprache des Servers: Sobald eine Meldung anders formuliert wäre, fiele
 * die Unterscheidung still auf „unbekannt" zurück. Der Statuscode sagt
 * dasselbe, sprachunabhängig.
 */
export class ApiError extends Error {
  status: number;
  /** Maschinenlesbarer Grund, wenn der Server einen mitschickt
   *  (z. B. `password_required`, `password_wrong`). */
  code?: string;
  /** Sekunden aus `Retry-After` (429/503), falls gesetzt. */
  retryAfter?: number;
  /** Hat unser Dienst selbst geantwortet (JSON mit `error`)? Ein 502/503/504
   *  eines vorgeschalteten Proxys ohne diesen Text heißt dagegen: der Dienst
   *  ist nicht erreichbar. Danach richtet sich der Druck-Rückfall beim PDF. */
  answered?: boolean;
  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (code) this.code = code;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}

/** `Retry-After` lesen: Sekunden oder ein HTTP-Datum. */
export function parseRetryAfter(h: string | null): number | undefined {
  if (!h) return undefined;
  const n = Number(h.trim());
  if (Number.isFinite(n) && n >= 0) return Math.ceil(n);
  const t = Date.parse(h);
  if (Number.isFinite(t)) return Math.max(0, Math.ceil((t - Date.now()) / 1000));
  return undefined;
}

/** Fehlerantwort in einen ApiError übersetzen — Klartext des Servers
 *  bleibt erhalten, ebenso Code und Wartezeit. */
export async function apiErrorFrom(r: Response): Promise<ApiError> {
  const data = await r.json().catch(() => ({})) as { error?: unknown; code?: unknown };
  const answered = typeof data.error === 'string' && !!data.error;
  const msg = answered ? data.error as string : `Fehler ${r.status}`;
  const err = new ApiError(msg, r.status, typeof data.code === 'string' ? data.code : undefined, parseRetryAfter(r.headers.get('Retry-After')));
  if (answered) err.answered = true;
  return err;
}

/** Hat der PDF-Dienst geantwortet (413 zu groß, 429 Kontingent, 503
 *  ausgelastet …)? Dann zählt seine Antwort, und es gibt keinen Rückfall auf
 *  den Browserdruck — der hätte das eigentliche Problem nur überdeckt. Nur
 *  wenn er gar nicht zu erreichen war (Netzfehler, Proxy ohne Dienst), bleibt
 *  der Druckdialog als Ausweg. */
export function pdfServiceAnswered(err: unknown): boolean {
  return err instanceof ApiError && (err.answered === true || err.status === 413 || err.status === 429);
}

/**
 * Fehlerantwort des PDF-Dienstes (POST /api/pdf) als ApiError.
 *
 * Seit 08.10.2026 nimmt der Dienst höchstens 3.000.000 Zeichen HTML an (413)
 * und antwortet bei voller Warteschlange oder Zeitüberschreitung mit 503,
 * Klartext und `Retry-After`. Der Klartext wird durchgereicht — „Fehler" allein
 * hilft niemandem. Für die beiden Fälle, die der Dienst mit festem Satz
 * beantwortet (413, 503 „ausgelastet"), steht derselbe Satz hier in der
 * Oberflächensprache; der Server spricht nur Deutsch. 429 (Kontingent) kommt
 * vom allgemeinen Begrenzer mit einer Meldung über „Versuche"; dafür steht
 * hier ein eigener Satz in der Oberflächensprache.
 */
export async function pdfErrorFrom(r: Response): Promise<ApiError> {
  const err = await apiErrorFrom(r);
  const T = PDF_SERVICE_I18N[detectInitialUiLang()];
  if (r.status === 429) err.message = T.tooMany(err.retryAfter);
  else if (r.status === 413) err.message = T.tooLarge;
  else if (r.status === 503 && err.answered && err.retryAfter) err.message = T.busy(err.retryAfter);
  else if (r.status === 503 && err.retryAfter) err.message = `${err.message} ${T.retryIn(err.retryAfter)}`;
  else if (/^Fehler \d+$/.test(err.message)) err.message = `PDF-Dienst antwortete mit ${r.status}`;
  return err;
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

/** Foto-ID aus einer eigenen Foto-Adresse (…/api/photos/<24 hex>), sonst null.
 *  data:-URLs (Lokalmodus) und fremde Adressen haben keine. */
export function photoIdOf(url: string | null | undefined): string | null {
  const m = /\/api\/photos\/([0-9a-f]{24})(?:[?#]|$)/.exec(String(url || ''));
  return m ? m[1] : null;
}

/** Antwort von POST /api/auth/change-password (seit 08.10.2026). */
export interface ChangePasswordResult {
  ok: boolean;
  /** Wie viele API-Schlüssel und KI-Verbindungen dabei getrennt wurden. */
  revoked?: { apiKeys: number; connections: number };
  message?: string;
}

export const api = {
  me: () => req<{ user: AuthUser; plan?: Plan | null; emailConfirmed?: boolean }>('/api/auth/me').then(withPlan),
  /** Ereignis melden — nur mit Konto aufrufen (ohne Konto antwortet der
   *  Server 401). Schlägt still fehl: Zählen darf nie einen Export stören. */
  event: (kind: ClientEvent): Promise<void> =>
    req<unknown>('/api/events', { method: 'POST', body: JSON.stringify({ kind }) }).then(() => undefined, () => undefined),
  login: (username: string, password: string) =>
    req<LoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }).then(withPlan),
  verify2fa: (challenge: string, code: string) =>
    req<{ user: AuthUser }>('/api/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ challenge, code }) }).then(withPlan),
  twofaStatus: () => req<TwoFaStatus>('/api/auth/2fa'),
  setTwofa: (enabled: boolean) =>
    req<{ ok: boolean; enabled: boolean }>('/api/auth/2fa', { method: 'POST', body: JSON.stringify({ enabled }) }),
  /** E-Mail setzen/ändern/entfernen — seit 08.10.2026 nur mit dem aktuellen
   *  Passwort (N6). Ohne: 400 `password_required`, falsch: 403 `password_wrong`. */
  setEmail: (email: string, currentPassword: string) =>
    req<{ user: AuthUser }>('/api/auth/email', { method: 'POST', body: JSON.stringify({ email, currentPassword }) }),
  register: (username: string, password: string, inviteCode: string, email?: string) =>
    req<{ user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, inviteCode, email }) }),
  /** Public: request access without an account. Admin decides via e-mail link or panel. */
  requestAccess: (payload: { name: string; email: string; message?: string; website?: string }) =>
    req<{ ok: boolean }>('/api/access/request', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  forgotPassword: (identifier: string) =>
    req<{ ok: boolean }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier }) }),
  resetPassword: (token: string, newPassword: string) =>
    req<{ ok: boolean }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  /** Trennt seit 08.10.2026 zugleich alle anderen Anmeldungen, API-Schlüssel
   *  und KI-Verbindungen; die Antwort nennt die Zahlen. */
  changePassword: (currentPassword: string, newPassword: string) =>
    req<ChangePasswordResult>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  /** Returns the download URL for the user's full data dump (JSON). Caller
   *  navigates the browser there — server sends Content-Disposition: attachment. */
  exportMeUrl: () => `${BASE}/api/me/export`,
  deleteMe: (password: string) =>
    req<{ ok: boolean }>('/api/me/delete', { method: 'POST', body: JSON.stringify({ password }) }),

  adminResetPassword: (userId: number, newPassword: string) =>
    req<{ ok: boolean }>(`/api/admin/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),

  listInvites: () => req<{ invites: InviteCode[] }>('/api/admin/invites'),
  createInvite: (opts: { note?: string; maxUses?: number; expiresInDays?: number; email?: string }) =>
    req<{ code: string; email: string | null; emailed: boolean }>('/api/admin/invites', { method: 'POST', body: JSON.stringify(opts) }),
  revokeInvite: (code: string) =>
    req<{ ok: boolean }>(`/api/admin/invites/${encodeURIComponent(code)}/revoke`, { method: 'POST' }),
  listAccessRequests: () => req<{ requests: AccessRequest[] }>('/api/admin/access-requests'),
  acceptAccessRequest: (id: number) =>
    req<{ ok: boolean; code: string; emailed: boolean }>(`/api/admin/access-requests/${id}/accept`, { method: 'POST' }),
  rejectAccessRequest: (id: number) =>
    req<{ ok: boolean }>(`/api/admin/access-requests/${id}/reject`, { method: 'POST' }),
  listUsers: () => req<{ users: AdminUser[] }>('/api/admin/users'),
  setUserDisabled: (id: number, disabled: boolean) =>
    req<{ ok: boolean }>(`/api/admin/users/${id}/disable`, { method: 'POST', body: JSON.stringify({ disabled }) }),
  stats: () => req<{
    users: number; resumes: number; invitesActive: number; pdfExports: number; registrations7d: number;
    accessPending: number; accessAccepted: number; accessRejected: number; accessRequests7d: number;
  }>('/api/admin/stats'),

  // API keys (per user — for the MCP server)
  listKeys: () => req<{ keys: ApiKey[] }>('/api/keys'),
  createKey: (name: string) =>
    req<{ key: string; prefix: string; name: string }>('/api/keys', { method: 'POST', body: JSON.stringify({ name }) }),
  revokeKey: (id: number) =>
    req<{ ok: boolean }>(`/api/keys/${id}/revoke`, { method: 'POST' }),

  // Per OAuth verbundene KI-Clients (MCP). Anders als ein API-Schlüssel hat
  // der Nutzer sie nicht selbst erzeugt, sondern auf einer Zustimmungsseite
  // erlaubt — beenden können muss er sie trotzdem.
  listConnections: () => req<{ connections: OauthConnection[] }>('/api/oauth/connections'),
  revokeConnection: (id: number) =>
    req<{ ok: boolean }>(`/api/oauth/connections/${id}/revoke`, { method: 'POST' }),

  // résumé storage (per user)
  listResumes: () => req<{ resumes: { id: string; display_name: string; updated_at: string }[] }>('/api/resumes'),
  getResume: (id: string) => req<{ resume: { id: string; displayName: string; payload: AppProfile } }>(`/api/resumes/${encodeURIComponent(id)}`),
  saveResume: (profile: AppProfile) =>
    req<{ id: string }>('/api/resumes', { method: 'POST', body: JSON.stringify({ id: profile.id, displayName: profile.displayName, payload: profile }) }),
  deleteResume: (id: string) =>
    req<{ ok: boolean }>(`/api/resumes/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Photos (stored server-side, no payload bloat)
  uploadPhoto: (mime: string, dataBase64: string) =>
    req<{ id: string; url: string }>('/api/photos', { method: 'POST', body: JSON.stringify({ mime, dataBase64 }) }),
  /** Foto endgültig löschen (nur eigene; sonst 404). Nimmt die ID oder die
   *  Foto-Adresse; ohne erkennbare eigene ID passiert nichts. Fotos sieht seit
   *  08.10.2026 nur noch der Eigentümer (mit Cookie, same-origin `<img>`). */
  deletePhoto: async (idOrUrl: string): Promise<{ ok: boolean }> => {
    const id = /^[0-9a-f]{24}$/.test(idOrUrl) ? idOrUrl : photoIdOf(idOrUrl);
    if (!id) return { ok: false };
    return req<{ ok: boolean }>(`/api/photos/${id}`, { method: 'DELETE' });
  },

  // Public share links
  listShares: (resumeId: string) =>
    req<{ shares: ShareLink[] }>(`/api/resumes/${encodeURIComponent(resumeId)}/shares`),
  createShare: (resumeId: string, opts?: { expiresInDays?: number; includeCoverLetter?: boolean }) =>
    req<{ token: string; url: string; expires_at: string | null; include_cover_letter: boolean }>(
      `/api/resumes/${encodeURIComponent(resumeId)}/share`,
      { method: 'POST', body: JSON.stringify(opts || {}) },
    ),
  updateShare: (token: string, patch: { includeCoverLetter?: boolean }) =>
    req<{ ok: boolean }>(`/api/shares/${encodeURIComponent(token)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }),
  revokeShare: (token: string) =>
    req<{ ok: boolean }>(`/api/shares/${encodeURIComponent(token)}/revoke`, { method: 'POST' }),
  /** Ein Link zeigt den Stand beim Anlegen. Das hier bringt ihn auf den
   *  aktuellen Stand des Profils — derselbe Link, neuer Inhalt. */
  refreshShare: (token: string) =>
    req<{ ok: boolean }>(`/api/shares/${encodeURIComponent(token)}/refresh`, { method: 'POST' }),
  fetchShare: (token: string) =>
    req<{ resume: AppProfile; include_cover_letter: boolean }>(`/api/share/${encodeURIComponent(token)}`),

  // Markdown bridge (read via .md path, write via import-md)
  importMarkdown: (resumeId: string, markdown: string, dryRun = false) =>
    req<{ ok: boolean; payload: AppProfile; dryRun?: boolean }>(
      `/api/resumes/${encodeURIComponent(resumeId)}/import-md`,
      { method: 'POST', body: JSON.stringify({ markdown, dryRun }) },
    ),
  importCoverLetterMarkdown: (resumeId: string, markdown: string, dryRun = false) =>
    req<{ ok: boolean; payload: AppProfile; dryRun?: boolean }>(
      `/api/resumes/${encodeURIComponent(resumeId)}/import-cover-letter-md`,
      { method: 'POST', body: JSON.stringify({ markdown, dryRun }) },
    ),

  // Snapshot-before-save (e.g. for JSON wholesale imports).
  saveResumeWithSnapshot: (profile: AppProfile, source: string) =>
    req<{ id: string }>('/api/resumes', {
      method: 'POST',
      body: JSON.stringify({
        id: profile.id,
        displayName: profile.displayName,
        payload: profile,
        snapshotBefore: true,
        snapshotSource: source,
      }),
    }),

  // Version history
  listVersions: (resumeId: string) =>
    req<{ versions: { id: number; source: string; created_at: string }[] }>(
      `/api/resumes/${encodeURIComponent(resumeId)}/versions`,
    ),
  getVersion: (resumeId: string, versionId: number) =>
    req<{ version: { payload: AppProfile; source: string; created_at: string } }>(
      `/api/resumes/${encodeURIComponent(resumeId)}/versions/${versionId}`,
    ),
  restoreVersion: (resumeId: string, versionId: number) =>
    req<{ ok: boolean; payload: AppProfile }>(
      `/api/resumes/${encodeURIComponent(resumeId)}/versions/${versionId}/restore`,
      { method: 'POST' },
    ),
};

export interface ShareView {
  viewed_at: string;
  variant: 'html' | 'md';
  ua_summary: string | null;
}

export interface ShareLink {
  token: string;
  expires_at: string | null;
  revoked: boolean;
  view_count: number;
  last_viewed_at: string | null;
  include_cover_letter: boolean;
  recent_views?: ShareView[];
  created_at: string;
}

