/**
 * Meldung „der Plan hat sich geändert" (z. B. nach einer Gutschein-Einlösung
 * in „Mein Pass"). App.tsx hört darauf und lädt /api/auth/me neu — so gelten
 * die neuen Rechte sofort, ohne Neuanmeldung und ohne Seitenwechsel.
 */
export const PLAN_EVENT = 'cv:plan-changed';

export function notifyPlanChanged(): void {
  try { window.dispatchEvent(new Event(PLAN_EVENT)); } catch { /* ignore */ }
}
