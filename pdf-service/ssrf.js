// ── SSRF-Schutz für den PDF-Renderer ────────────────────────────────────────
//
// Eigene Datei, damit es dafür einen Test gibt. Der Befund vom 14.09.2026 war
// keiner, den man beim Lesen sieht: Die Reihenfolge zweier if-Zweige entschied
// darüber, ob ein nicht angemeldeter Aufrufer container-interne Dienste in ein
// PDF rendern kann. Solche Fehler fängt man mit Beispielen, nicht mit Sorgfalt.
//
//   node --test pdf-service/

/** Private, Loopback- und Link-Local-Adressen. Bewusst großzügig: lieber eine
 *  erlaubte Adresse zu viel blockiert als eine interne zu wenig. */
export function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1) auf die v4-Prüfung zurückführen
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
  const v4 = mapped ? mapped[1] : h;
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return false;
  const [a, b] = v4.split('.').map(Number);
  return a === 0 || a === 10 || a === 127
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
    || a >= 224;
}

/** Hosts, die der Renderer immer laden darf. */
export const PDF_ALLOWED_HOSTS = new Set([
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

/** Darf der Renderer diese Adresse laden?
 *
 *  Zwei Lücken in der Fassung vor dem 14.09.2026:
 *
 *  1. `http://127.0.0.1:<beliebiger Port>` war bedingungslos erlaubt. Ein
 *     `<iframe src="http://127.0.0.1:9200/_cat/indices">` an /api/pdf rendert
 *     damit einen container-internen Dienst in ein PDF, das ein NICHT
 *     angemeldeter Aufrufer herunterlädt — ein Lesezugriff, kein blindes SSRF.
 *  2. Der „gleicher Host"-Zweig stand VOR der Prüfung auf private Adressen, und
 *     der Host kam aus `x-forwarded-host`. Mit einem Header ließ sich die
 *     Allowlist beliebig erweitern; die Sperre darunter wurde nie erreicht.
 *
 *  Jetzt: privat zuerst und ausnahmslos, kein unverschlüsseltes http, und der
 *  „eigene Host" stammt aus der Konfiguration statt aus einem Header. */
export function isPdfFetchAllowed(urlStr, ownHost) {
  try {
    const u = new URL(urlStr);
    if (u.protocol === 'data:') return true;
    if (u.protocol === 'about:') return true;                // Playwrights leeres Ausgangsdokument
    if (u.protocol !== 'https:') return false;               // http:, file:, gopher:, ftp: …
    if (isPrivateHost(u.hostname)) return false;             // ZUERST, ohne Ausnahme
    if (PDF_ALLOWED_HOSTS.has(u.hostname)) return true;
    if (ownHost && u.host === ownHost) return true;          // eigene Fotos
    return false;
  } catch { return false; }
}
