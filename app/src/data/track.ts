// Thin, safe wrapper around Umami custom events. Umami is loaded cookie-free
// and stores no PII; custom events add funnel visibility (which CTAs get used)
// without any personal data. If the script is blocked or not yet loaded, this
// no-ops silently — tracking must never break a user flow. NO third-party AI.
type TrackData = Record<string, string | number | boolean | undefined>;

interface UmamiApi { track: (event: string, data?: TrackData) => void }

/** Fire an anonymous Umami custom event. Safe to call anywhere, anytime. */
export function track(event: string, data?: TrackData): void {
  try {
    const u = (window as unknown as { umami?: UmamiApi }).umami;
    u?.track?.(event, data);
  } catch {
    /* analytics is best-effort — never throw into a user flow */
  }
}
