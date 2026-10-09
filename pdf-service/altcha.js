// Bot-Schutz ohne Drittanbieter: ALTCHA (Proof of Work, MIT-Lizenz).
//
// Tills Vorgabe vom 09.10.2026: selbst gehostet, kein US-Dienst. Der Browser
// rechnet eine kleine Aufgabe (PBKDF2/SHA-256), der Server prüft hier mit dem
// HMAC-Schlüssel aus ALTCHA_HMAC_KEY. Kein Aufruf nach außen, kein Cookie.
//
// Format: altcha-lib v2 (passt zum Widget "altcha" 3.x im Frontend). Die
// Aufgabe wird im deterministischen Modus erzeugt: Der Server kennt den
// Zählerstand, der Browser muss ihn durch Probieren finden. Prüfen kostet den
// Server dann nur zwei HMACs.
//
// Wiederholung: Jede gelöste Aufgabe wird bis zu ihrem Ablauf in der Tabelle
// altcha_spent vermerkt (INSERT … ON CONFLICT DO NOTHING — atomar, auch mit
// zwei Instanzen). Eine zweite Einreichung derselben Lösung scheitert.

import crypto from 'node:crypto';
import { createChallenge, verifySolution, randomInt } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

export const ALTCHA_ALGORITHM = 'PBKDF2/SHA-256';

function envInt(name, fallback, min, max) {
  const n = Number.parseInt(String(process.env[name] ?? '').trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Schlüssel für die Signatur des abgeleiteten Schlüssels — aus dem Hauptschlüssel
 *  abgeleitet, damit der Betreiber nur EINE Variable setzen muss. */
function keySignatureSecret(master) {
  return crypto.createHmac('sha256', master).update('cv-altcha-derived-secret').digest('hex');
}

/**
 * @param pool    Postgres-Pool (für den Wiederholungsschutz)
 * @param hmacKey ALTCHA_HMAC_KEY
 * Aufwand (Vorgaben): cost 2000 PBKDF2-Runden je Versuch, Zählerstand
 * zufällig 2000–6000. Das sind im Mittel rund 8 Mio. Runden, auf einem
 * üblichen Laptop mit mehreren Workern 1–3 Sekunden. Über ALTCHA_COST,
 * ALTCHA_COUNTER_MIN, ALTCHA_COUNTER_MAX und ALTCHA_TTL_S einstellbar.
 */
export function createAltcha({ pool, hmacKey = process.env.ALTCHA_HMAC_KEY } = {}) {
  const key = String(hmacKey || '').trim();
  const cost = envInt('ALTCHA_COST', 2000, 1, 1_000_000);
  const counterMin = envInt('ALTCHA_COUNTER_MIN', 2000, 1, 10_000_000);
  const counterMax = Math.max(counterMin + 1, envInt('ALTCHA_COUNTER_MAX', 6000, 2, 10_000_000));
  const ttlS = envInt('ALTCHA_TTL_S', 600, 30, 3600);
  const keySecret = key ? keySignatureSecret(key) : '';

  async function challenge() {
    if (!key) throw new Error('ALTCHA_HMAC_KEY fehlt');
    return createChallenge({
      algorithm: ALTCHA_ALGORITHM,
      cost,
      counter: randomInt(counterMin, counterMax),
      deriveKey,
      expiresAt: Math.floor(Date.now() / 1000) + ttlS,
      hmacSignatureSecret: key,
      hmacKeySignatureSecret: keySecret,
    });
  }

  /**
   * Prüft eine Einreichung (Base64-JSON aus dem Formularfeld "altcha").
   * Gibt { ok: true } oder { ok: false, reason } zurück. reason ist nur fürs
   * Protokoll und den Test; nach außen geht eine einheitliche Meldung.
   */
  async function verify(raw) {
    if (!key) return { ok: false, reason: 'not_configured' };
    const s = String(raw || '');
    if (!s || s.length > 8000) return { ok: false, reason: 'missing' };
    let payload;
    try { payload = JSON.parse(Buffer.from(s, 'base64').toString('utf8')); } catch { return { ok: false, reason: 'malformed' }; }
    const ch = payload?.challenge;
    const sol = payload?.solution;
    if (!ch || typeof ch !== 'object' || !ch.parameters || typeof ch.parameters !== 'object'
      || typeof ch.signature !== 'string' || !sol || typeof sol !== 'object' || typeof sol.derivedKey !== 'string') {
      return { ok: false, reason: 'malformed' };
    }
    // Eigene Mindestanforderungen: unser Algorithmus, ein Ablaufdatum in
    // unserem Rahmen, eine Schlüsselsignatur. Fehlt eins, stammt die Aufgabe
    // nicht von uns (oder ist verändert — dann scheitert ohnehin die Signatur).
    const p = ch.parameters;
    const nowS = Date.now() / 1000;
    if (p.algorithm !== ALTCHA_ALGORITHM || !p.keySignature || !Number.isFinite(p.expiresAt) || p.expiresAt > nowS + ttlS + 60) {
      return { ok: false, reason: 'foreign' };
    }
    if (!/^[0-9a-f]{2,256}$/i.test(sol.derivedKey)) return { ok: false, reason: 'malformed' };
    let result;
    try {
      result = await verifySolution({
        challenge: ch, solution: sol, deriveKey,
        hmacSignatureSecret: key, hmacKeySignatureSecret: keySecret,
      });
    } catch { return { ok: false, reason: 'malformed' }; }
    if (!result.verified) {
      return { ok: false, reason: result.expired ? 'expired' : result.invalidSignature ? 'signature' : 'solution' };
    }
    // Wiederholungsschutz: die Signatur identifiziert die Aufgabe eindeutig.
    const id = crypto.createHash('sha256').update(ch.signature).digest('hex');
    const r = await pool.query(
      'INSERT INTO altcha_spent (id, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT (id) DO NOTHING RETURNING id',
      [id, Math.ceil(p.expiresAt)],
    );
    if (!r.rowCount) return { ok: false, reason: 'replay' };
    return { ok: true };
  }

  return { configured: !!key, challenge, verify, settings: { cost, counterMin, counterMax, ttlS } };
}
