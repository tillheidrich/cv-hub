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

/* ── Tageszähler am eigenen Server (10.10.2026) ──────────────────────────────
 *
 * Für die Auswertung der Vorlagen-Staffel (Entscheidungsregel 31.01.2027)
 * braucht der Admin-Bereich ein paar Zahlen auch aus dem Lokalmodus: wie oft
 * eine Pass-Vorlage angesehen wurde, welcher Sperrgrund das Freischalt-Paneel
 * öffnete, wie oft die Markdown-Brücke und der KI-Knopf benutzt werden.
 *
 * Gesendet werden nur eine Ereignisart und Merkmale aus festen Listen
 * (pdf-service/stats.js verwirft alles andere), ohne Konto-Bezug, ohne Inhalt.
 * Der Server legt daraus nur Tageszähler an. Wer der Reichweitenmessung in der
 * Datenschutzerklärung widersprochen hat (`umami.disabled`), schickt auch das
 * nicht. Fehler bleiben still. */
export type CountEvent = 'template_lock_view' | 'unlock_panel_view' | 'export_markdown' | 'import_markdown' | 'ai_open';
const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) || '/pdfapi';
/** Ein Ereignis je Art und Merkmal und Seitenaufruf genügt für Ansichten. */
const seenOnce = new Set<string>();

export function countEvent(kind: CountEvent, dims: Record<string, string | undefined> = {}, opts: { once?: boolean } = {}): void {
  try {
    if (localStorage.getItem('umami.disabled')) return;
  } catch { /* ohne Speicher trotzdem zählen: es geht nichts Persönliches mit */ }
  try {
    const key = `${kind}|${JSON.stringify(dims)}`;
    if (opts.once) { if (seenOnce.has(key)) return; seenOnce.add(key); }
    void fetch(`${API_BASE}/api/events`, {
      method: 'POST', credentials: 'omit', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ...dims }),
    }).catch(() => {});
  } catch { /* Zählen darf nie einen Ablauf stören */ }
}
