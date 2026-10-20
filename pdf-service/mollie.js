// Mollie-Anbindung für den Bewerbungs-Pass (09.10.2026).
//
// Bewusst ohne SDK: Gebraucht werden vier Aufrufe (Zahlung anlegen und
// abrufen, Erstattung anlegen und abrufen). Eine schmale fetch-Hülle ist
// leichter zu prüfen als ein Paket mit eigener Abhängigkeitskette, und sie
// lässt sich im Test gegen einen Mock-Server richten (MOLLIE_API_BASE).
//
// Grundsätze aus docs.mollie.com (Payments API, Webhooks, Refunds, API
// idempotency), am 09.10.2026 nachgelesen:
// - Der Webhook schickt nur die ID (form-encoded "id=tr_…"). Der Status kommt
//   IMMER aus einem eigenen, authentifizierten Abruf, nie aus dem Aufruf.
// - Auf jeden Webhook mit 200 antworten, auch bei unbekannter ID. Sonst wird
//   die Antwort zum Orakel, welche IDs es gibt.
// - Erstattungen lösen den Webhook der Zahlung aus (processing, refunded,
//   failed). Deshalb liest der Webhook auch den Erstattungsstand nach.
// - POST-Aufrufe tragen einen Idempotency-Key. Mollie liefert bei
//   Wiederholung innerhalb einer Stunde die erste Antwort noch einmal aus.
//
// In Protokollzeilen landen nur Methode, Pfadmuster und HTTP-Status, nie
// Beträge, Namen, Mailadressen oder Antworten von Mollie.

export const MOLLIE_DEFAULT_BASE = 'https://api.mollie.com/v2';

const PAYMENT_ID_RE = /^tr_[A-Za-z0-9]{4,64}$/;
const REFUND_ID_RE = /^re_[A-Za-z0-9]{4,64}$/;

export class MollieError extends Error {
  constructor(message, status, title) {
    super(message);
    this.name = 'MollieError';
    this.status = status;
    this.title = title || null;
  }
}

export function isPaymentId(id) { return PAYMENT_ID_RE.test(String(id || '')); }
export function isRefundId(id) { return REFUND_ID_RE.test(String(id || '')); }

/** 900 → "9.00" — ohne Fließkomma, damit aus 0,1 + 0,2 nie 0,30000000004 wird. */
export function formatAmount(cents) {
  const c = Number(cents);
  if (!Number.isInteger(c) || c < 0) throw new Error('Betrag muss eine nicht negative ganze Zahl in Cent sein.');
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`;
}

/** "9.00" → 900; alles andere → NaN. */
export function parseAmount(value) {
  const m = /^(\d+)\.(\d{2})$/.exec(String(value ?? ''));
  return m ? Number(m[1]) * 100 + Number(m[2]) : NaN;
}

/** UI-Sprache → Mollie-Locale der Bezahlseite. */
export function mollieLocale(lang) {
  return { de: 'de_DE', en: 'en_GB', fr: 'fr_FR', es: 'es_ES' }[String(lang || '').slice(0, 2).toLowerCase()] || 'de_DE';
}

/**
 * Prüft MOLLIE_API_BASE. Erlaubt ist HTTPS; HTTP nur für localhost und
 * 127.0.0.1 (Mock-Server im Test). Gibt die Basis ohne Schrägstrich am Ende
 * zurück oder wirft.
 */
export function checkApiBase(raw) {
  const v = String(raw || '').trim() || MOLLIE_DEFAULT_BASE;
  let u;
  try { u = new URL(v); } catch { throw new Error(`MOLLIE_API_BASE ist keine gültige Adresse: ${v}`); }
  const local = u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    throw new Error('MOLLIE_API_BASE muss HTTPS sein (HTTP nur für localhost im Test).');
  }
  return v.replace(/\/+$/, '');
}

/**
 * @param apiKey   MOLLIE_API_KEY (test_… oder live_…)
 * @param base     MOLLIE_API_BASE, Vorgabe https://api.mollie.com/v2
 * @param timeoutMs Mollie selbst gibt Webhooks 15 s; wir warten genauso lange.
 */
export function createMollie({ apiKey, base, timeoutMs = 15_000, fetchImpl = globalThis.fetch } = {}) {
  const root = checkApiBase(base);
  const key = String(apiKey || '').trim();

  async function call(method, path, label, { body, idempotencyKey } = {}) {
    if (!key) throw new MollieError('MOLLIE_API_KEY ist nicht gesetzt.', 0);
    const headers = {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'User-Agent': 'cv-api (CV-Hub)',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 120);
    let res;
    try {
      res = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      throw new MollieError(`Mollie ${method} ${label}: keine Antwort (${err?.name || 'Fehler'})`, 0);
    }
    let data = null;
    try { data = await res.json(); } catch { /* leerer oder kaputter Körper */ }
    if (!res.ok) {
      // Nur Status und der kurze Titel ("Unprocessable Entity") — kein "detail",
      // das kann Eingabewerte zurückspiegeln.
      throw new MollieError(`Mollie ${method} ${label}: HTTP ${res.status}`, res.status, typeof data?.title === 'string' ? data.title.slice(0, 80) : null);
    }
    return data;
  }

  return {
    isTestMode: key.startsWith('test_'),
    configured: !!key,

    /** Aktive Zahlungsarten des Profils — zugleich die Prüfung, ob der
     *  Schlüssel gilt (Admin → Verkauf). */
    async listMethods() {
      const data = await call('GET', '/methods', 'methods');
      const list = Array.isArray(data?._embedded?.methods) ? data._embedded.methods : [];
      return list.map(m => ({ id: String(m.id || ''), description: String(m.description || m.id || '').slice(0, 60) }));
    },

    /** Legt eine Zahlung an. Gibt das Payment-Objekt zurück (id, status, _links.checkout.href …). */
    createPayment({ amountCents, currency = 'EUR', description, redirectUrl, webhookUrl, metadata, locale, idempotencyKey }) {
      const body = {
        amount: { currency, value: formatAmount(amountCents) },
        description: String(description || '').slice(0, 255),
        redirectUrl,
        metadata,
      };
      if (webhookUrl) body.webhookUrl = webhookUrl;
      if (locale) body.locale = locale;
      return call('POST', '/payments', '/payments', { body, idempotencyKey });
    },

    getPayment(id) {
      if (!isPaymentId(id)) return Promise.reject(new MollieError('Ungültige Zahlungs-ID.', 400));
      return call('GET', `/payments/${encodeURIComponent(id)}`, '/payments/:id');
    },

    createRefund(paymentId, { amountCents, currency = 'EUR', description, metadata, idempotencyKey }) {
      if (!isPaymentId(paymentId)) return Promise.reject(new MollieError('Ungültige Zahlungs-ID.', 400));
      const body = { amount: { currency, value: formatAmount(amountCents) } };
      if (description) body.description = String(description).slice(0, 140);
      if (metadata) body.metadata = metadata;
      return call('POST', `/payments/${encodeURIComponent(paymentId)}/refunds`, '/payments/:id/refunds', { body, idempotencyKey });
    },

    getRefund(paymentId, refundId) {
      if (!isPaymentId(paymentId) || !isRefundId(refundId)) return Promise.reject(new MollieError('Ungültige ID.', 400));
      return call('GET', `/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`, '/payments/:id/refunds/:rid');
    },
  };
}
