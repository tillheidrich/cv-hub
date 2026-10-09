// Kleine Schutzbausteine für cv-api, ohne Abhängigkeiten.
//
// Eigene Datei, damit es dafür Tests ohne Datenbank gibt (guards.test.mjs).
// Jede Funktion hier stammt aus einem Befund des Technik-Berichts vom
// 08.10.2026; die Nummer steht jeweils dabei.

/* ── Sicherheitsheader (N5) ───────────────────────────────────────────────
 *
 * cv-api hängt in der Produktion oft direkt am Reverse-Proxy. Die Header aus
 * app/nginx.conf gelten deshalb nur für die SPA, nicht für das, was dieser
 * Dienst selbst ausliefert: die OAuth-Zustimmungsseite, die Aktionsseiten der
 * Zugangsanfragen, die Fotos und die Crawler-Karte der Sharelinks.
 *
 * Die CSP passt für alles, was hier entsteht: kein Skript, keine fremde
 * Quelle, Stile nur inline, Formulare nur an sich selbst. Für JSON und PDF
 * ist sie wirkungslos und schadet nicht. Die Zustimmungsseite erweitert
 * `form-action` um die Rückleitungsadresse des Clients (siehe oauth.js),
 * weil Chrome die Weiterleitung nach dem Absenden sonst blockiert. */
export const HTML_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

/* Runde 6 (09.10.2026):
 * - Referrer-Policy war „no-referrer“. Damit schickt ein Browser bei einem
 *   Formular-POST `Origin: null` — die OAuth-Zustimmung („Erlauben“) und die
 *   Zugangsanfrage („Annehmen“) endeten so mit einer CORS-Ablehnung (M6).
 *   „same-origin“ schickt den eigenen Ursprung nur an sich selbst und nach
 *   außen gar nichts — die Rückleitung zum OAuth-Client erfährt also weiter
 *   nicht, von welcher Seite sie kam.
 * - HSTS und Permissions-Policy fehlten auf dem direkten API-Weg (Live-Befund).
 * - Cache-Control: no-store ist die Vorgabe für alles, was dieser Dienst
 *   ausliefert. Wer cachen darf (Fotos), setzt seinen eigenen Wert danach. */
export const PERMISSIONS_POLICY = 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()';

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', HTML_CSP);
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/* ── Ursprungsprüfung (M6) ────────────────────────────────────────────────
 *
 * Vorher meldete der cors-Baustein einen fremden Ursprung als Fehler, und der
 * landete in der Fehler-Middleware: 500 „Interner Fehler“. Jetzt eine klare
 * Absage mit 403, BEVOR irgendein Handler läuft. Ohne Origin-Kopf (gleicher
 * Ursprung bei GET, Server-zu-Server wie der Mollie-Webhook, curl) geht es
 * weiter wie bisher. `null` (Sandbox-Frames, data:-Seiten, no-referrer) ist
 * ausdrücklich KEIN erlaubter Ursprung. */
export function originGuard(allowlist) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin === undefined || allowlist.has(origin)) return next();
    res.status(403).json({ error: 'Dieser Ursprung ist nicht zugelassen.', code: 'origin_not_allowed' });
  };
}

/* ── Schlüssel für Rate-Limits (M3) ───────────────────────────────────────
 *
 * Wer eine IPv6-Adresse hat, hat in aller Regel ein ganzes /64 — 2^64
 * Adressen. Ein Eimer je einzelner Adresse war damit kein Limit. Jetzt:
 * IPv4 je Adresse, IPv6 je /64. Für Netz-Limits (subnetOf) IPv4 je /24. */
export function subnetOf(ip) {
  const s = String(ip || '').replace(/^::ffff:/i, '');
  if (s.includes('/')) return s;                          // schon ein Netz
  if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return s.split('.').slice(0, 3).join('.') + '.0/24';
  if (s.includes(':')) return v6Prefix64(s);
  return s || 'unknown';
}

function v6Prefix64(s) {
  const full = s.split('%')[0].toLowerCase();
  const [head, tail = ''] = full.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = full.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return groups.slice(0, 4).map(g => (g || '0').replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/** Eimer-Schlüssel je Aufrufer: IPv4 einzeln, IPv6 je /64. */
export function clientKey(ip) {
  const s = String(ip || '').replace(/^::ffff:/i, '');
  if (s.includes('/')) return s;
  if (s.includes(':')) return v6Prefix64(s);
  return s || 'unknown';
}

/** CSP der Zustimmungsseite: wie oben, aber das Formular darf zusätzlich zur
 *  Rückleitungsadresse des Clients weiterleiten. */
export function consentCsp(redirectUri) {
  let origin = '';
  try { origin = new URL(redirectUri).origin; } catch { /* dann nur 'self' */ }
  // Ein Ursprung enthält nie Leerzeichen oder Semikolon — wäre es anders, ließe
  // sich damit eine zweite Direktive einschmuggeln.
  const extra = origin && origin !== 'null' && !/[\s;,']/.test(origin) ? ` ${origin}` : '';
  return HTML_CSP.replace("form-action 'self'", `form-action 'self'${extra}`);
}

/* ── TRUST_PROXY-Warnung (Befund 4) ───────────────────────────────────────
 *
 * Ohne TRUST_PROXY kommt hinter einem Proxy jede Anfrage von dessen Adresse.
 * Dann sperren fünf falsche Logins die Anmeldung für alle, und das PDF-
 * Kontingent gilt für alle zusammen. Von außen sieht man das nicht — deshalb
 * sagt es der Dienst selbst, einmal, sobald der erste weitergeleitete Aufruf
 * ankommt. */
export function trustProxyWarning(app, log = console.warn) {
  let warned = false;
  return (req, _res, next) => {
    if (!warned && !app.get('trust proxy') && req.headers['x-forwarded-for']) {
      warned = true;
      log('WARNUNG: X-Forwarded-For empfangen, aber TRUST_PROXY ist nicht gesetzt. '
        + 'Alle Rate-Limits teilen sich damit einen Eimer (die Adresse des Proxys). '
        + 'Hinter genau einem Reverse-Proxy: TRUST_PROXY=1 setzen.');
    }
    next();
  };
}

/* ── Größenprüfung (Befund 5) ─────────────────────────────────────────────
 *
 * Galt bisher nur auf POST /api/resumes. PUT, beide Markdown-Importe und das
 * Wiederherstellen einer Version schrieben ungeprüft. */
export const MAX_RESUME_PAYLOAD_BYTES = 200_000;

/** Gibt eine Fehlermeldung zurück, wenn das Profil zu groß ist, sonst null. */
export function payloadSizeError(payload) {
  let len;
  try { len = Buffer.byteLength(JSON.stringify(payload ?? null), 'utf8'); }
  catch { return 'Profil lässt sich nicht speichern.'; }
  if (len > MAX_RESUME_PAYLOAD_BYTES) {
    return `Profil zu groß (${Math.round(len / 1024)} KB > ${Math.round(MAX_RESUME_PAYLOAD_BYTES / 1024)} KB).`;
  }
  return null;
}

/** Antwortet mit 413 und gibt true zurück, wenn das Profil zu groß ist. */
export function assertPayloadSize(res, payload) {
  const err = payloadSizeError(payload);
  if (!err) return false;
  res.status(413).json({ error: err });
  return true;
}

/* ── Warteschlange für den PDF-Dienst (N2) ────────────────────────────────
 *
 * Höchstens `maxParallel` Aufträge rendern gleichzeitig, höchstens
 * `maxQueue` warten. Wer darüber kommt, bekommt sofort eine Absage statt
 * einer Verbindung, die minutenlang hängt. Wer zu lange wartet, ebenso. */
export class BusyError extends Error {
  constructor(message, retryAfterS) {
    super(message);
    this.name = 'BusyError';
    this.retryAfter = retryAfterS;
  }
}

export function createLimiter({ maxParallel = 2, maxQueue = 10, queueTimeoutMs = 45_000 } = {}) {
  let active = 0;
  const queue = [];

  function release() {
    active -= 1;
    while (queue.length && active < maxParallel) {
      const w = queue.shift();
      if (w.done) continue;
      w.done = true;
      clearTimeout(w.timer);
      active += 1;
      w.resolve(release);
    }
  }

  /** Wartet auf einen freien Platz. Gibt eine `release`-Funktion zurück, die
   *  genau einmal aufgerufen werden muss. `signal` bricht das Warten ab. */
  function acquire(signal) {
    if (active < maxParallel) {
      active += 1;
      return Promise.resolve(once(release));
    }
    if (queue.length >= maxQueue) {
      return Promise.reject(new BusyError('Der PDF-Dienst ist gerade ausgelastet. Bitte in einer Minute noch einmal versuchen.', 30));
    }
    return new Promise((resolve, reject) => {
      const w = { done: false, resolve: r => resolve(once(r)), timer: null };
      w.timer = setTimeout(() => {
        if (w.done) return;
        w.done = true;
        remove(w);
        reject(new BusyError('Der PDF-Dienst ist gerade ausgelastet. Bitte in einer Minute noch einmal versuchen.', 30));
      }, queueTimeoutMs);
      signal?.addEventListener?.('abort', () => {
        if (w.done) return;
        w.done = true;
        clearTimeout(w.timer);
        remove(w);
        reject(new BusyError('Abgebrochen.', 0));
      }, { once: true });
      queue.push(w);
    });
  }

  function remove(w) {
    const i = queue.indexOf(w);
    if (i >= 0) queue.splice(i, 1);
  }

  function once(fn) {
    let called = false;
    return () => { if (!called) { called = true; fn(); } };
  }

  return {
    acquire,
    get active() { return active; },
    get waiting() { return queue.filter(w => !w.done).length; },
  };
}

/** Wirft nach `ms`, ruft vorher `onTimeout` (z. B. Kontext schließen). */
export async function withTimeout(promise, ms, onTimeout) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => {
      Promise.resolve(onTimeout?.()).catch(() => {});
      const e = new Error(`Zeitlimit von ${Math.round(ms / 1000)} s überschritten.`);
      e.code = 'ETIMEDOUT';
      reject(e);
    }, ms);
  });
  try { return await Promise.race([promise, t]); }
  finally { clearTimeout(timer); }
}
