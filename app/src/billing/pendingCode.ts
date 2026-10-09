/**
 * Gemerkter Zugangscode für den Weg neuer Interessenten (Gutscheine,
 * 09.10.2026): Code eingeben → Konto anlegen oder anmelden → E-Mail bestätigen
 * → zurück auf /code und einlösen, ohne den Code erneut einzutippen.
 *
 * Der Code liegt höchstens 24 Stunden in `localStorage` (überlebt den
 * Bestätigungslink, der oft in einem neuen Tab aufgeht). Er geht nie an
 * Analytics und nie in eine Adresse. Nach erfolgreicher Einlösung, bei einem
 * endgültigen Fehler oder nach Ablauf wird er gelöscht. Jeder Zugriff ist in
 * try/catch: privates Fenster oder gesperrter Speicher dürfen nichts kaputt
 * machen — dann muss man den Code eben noch einmal eingeben.
 */
export const PENDING_CODE_KEY = 'cv-pending-code';
const TTL_MS = 24 * 60 * 60 * 1000;

interface Stored { code: string; exp: number }

export function savePendingCode(code: string, now = Date.now()): void {
  const c = code.trim();
  if (!c) return;
  try { localStorage.setItem(PENDING_CODE_KEY, JSON.stringify({ code: c, exp: now + TTL_MS } satisfies Stored)); }
  catch { /* Speicher gesperrt: kein Merken */ }
}

export function readPendingCode(now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(PENDING_CODE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (!v || typeof v.code !== 'string' || typeof v.exp !== 'number' || v.exp <= now || !v.code.trim()) {
      localStorage.removeItem(PENDING_CODE_KEY);
      return null;
    }
    return v.code;
  } catch {
    return null;
  }
}

export function clearPendingCode(): void {
  try { localStorage.removeItem(PENDING_CODE_KEY); } catch { /* ignore */ }
}

export function hasPendingCode(): boolean {
  return readPendingCode() !== null;
}

/** Anzeigeform: Großbuchstaben, ohne Leerraum am Rand. Die eindeutige
 *  Normalisierung (NFKC, Leerzeichen und Bindestriche raus) macht der Server. */
export function displayCode(code: string): string {
  return code.normalize('NFKC').trim().toUpperCase();
}
