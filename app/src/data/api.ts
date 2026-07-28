// Client for the cv-api backend (auth, invites, admin, résumé storage).
import type { AppProfile } from './types';

const BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) || '/pdfapi';

export interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
  email?: string | null;
  twofaEnabled?: boolean;
  createdAt: string;
}

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

export interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked: boolean;
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Fehler ${r.status}`);
  return data as T;
}

export const api = {
  me: () => req<{ user: AuthUser }>('/api/auth/me'),
  login: (username: string, password: string) =>
    req<LoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  verify2fa: (challenge: string, code: string) =>
    req<{ user: AuthUser }>('/api/auth/verify-2fa', { method: 'POST', body: JSON.stringify({ challenge, code }) }),
  twofaStatus: () => req<TwoFaStatus>('/api/auth/2fa'),
  setTwofa: (enabled: boolean) =>
    req<{ ok: boolean; enabled: boolean }>('/api/auth/2fa', { method: 'POST', body: JSON.stringify({ enabled }) }),
  setEmail: (email: string) =>
    req<{ user: AuthUser }>('/api/auth/email', { method: 'POST', body: JSON.stringify({ email }) }),
  register: (username: string, password: string, inviteCode: string, email?: string) =>
    req<{ user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password, inviteCode, email }) }),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  forgotPassword: (identifier: string) =>
    req<{ ok: boolean }>('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier }) }),
  resetPassword: (token: string, newPassword: string) =>
    req<{ ok: boolean }>('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
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
  listUsers: () => req<{ users: AdminUser[] }>('/api/admin/users'),
  setUserDisabled: (id: number, disabled: boolean) =>
    req<{ ok: boolean }>(`/api/admin/users/${id}/disable`, { method: 'POST', body: JSON.stringify({ disabled }) }),
  stats: () => req<{ users: number; resumes: number; invitesActive: number; pdfExports: number; registrations7d: number }>('/api/admin/stats'),

  // API keys (per user — for the MCP server)
  listKeys: () => req<{ keys: ApiKey[] }>('/api/keys'),
  createKey: (name: string) =>
    req<{ key: string; prefix: string; name: string }>('/api/keys', { method: 'POST', body: JSON.stringify({ name }) }),
  revokeKey: (id: number) =>
    req<{ ok: boolean }>(`/api/keys/${id}/revoke`, { method: 'POST' }),

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

/** Returns the absolute URL for a server-side photo or null if the input is not a server photo. */
export function photoUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('data:') || value.startsWith('http')) return value;
  if (value.startsWith('/pdfapi/')) return (typeof window !== 'undefined' ? window.location.origin : '') + value;
  return value;
}
