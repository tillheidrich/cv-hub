// Bewerbungs-Pass: Bestellung, Zahlung über Mollie, Rechnung, Widerruf.
//
// Grundentscheidungen des Modells:
// Mollie direkt, der Betreiber ist Verkäufer (z. B. Kleinunternehmer, Paragraf 19 UStG),
// 9,00 € einmalig für 90 Tage, kein Abo. Widerruf innerhalb von 14 Tagen =
// volle Erstattung über die Refund-API, ohne Wertersatz.
//
// Grundsätze, die hier stehen und nirgends sonst:
// - Beträge, Laufzeit und Produkt kommen aus der Konfiguration, nie aus der
//   Anfrage. Der Client wählt nur die SKU, und die muss passen.
// - Der Webhook glaubt dem Aufruf nichts außer der ID. Status, Betrag und
//   Bestellbezug kommen aus einem eigenen Abruf bei Mollie und werden mit der
//   eigenen Bestellung verglichen.
// - Alles ist idempotent: Webhook-Wiederholungen, Doppelklick im Checkout,
//   doppelter Widerruf. Der Statuswechsel auf "paid" und die Rechnungsnummer
//   entstehen in EINER Transaktion mit gesperrter Bestellzeile.
// - Rechnungsnummern sind je Jahr lückenlos (invoice_counters, Zeilensperre).
// - Protokolle enthalten Bestell-ID und Status, nie Namen, Mailadressen,
//   Beträge oder Antworten von Mollie.
// - Widerruf geht auch, wenn BILLING_ENABLED später wieder aus ist: Nur der
//   Checkout hängt am Schalter.

import crypto from 'node:crypto';
import express from 'express';
import { createMollie, isPaymentId, parseAmount, mollieLocale } from './mollie.js';
import { buildInvoiceHtml, buildTermsHtml, buildWithdrawalHtml } from './invoice.js';
import {
  tplOrderConfirmation, tplWithdrawalReceipt, tplWithdrawalLate, tplDeclarationUnmatched, tplRefundDone,
  tplCancellationReceipt, tplAdminDeclaration, berlinDate, berlinDateTime, legalValues,
} from './mailtexts/index.js';
import { attachmentNames, legalLang } from './mailtexts/legal.js';
import { sendMail as defaultSend } from './mail.js';
import { planInfo, MAX_ACCESS_DAYS } from './access.js';
import { addGrant, revokeOrderGrant, capOrderGrant, planDetails } from './grants.js';

const DAY_MS = 86_400_000;
export const WITHDRAWAL_DAYS = 14;
export const CHECKOUT_REUSE_MINUTES = 10;

/** EU-Mitgliedstaaten (ISO 3166-1 alpha-2; Griechenland hier GR, nicht EL). */
export const EU_COUNTRIES = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);
/** Schwellen in Cent. */
export const THRESHOLDS = {
  euAbroadCents: 1_000_000,       // 10.000 € (Paragraf 3a Abs. 5 UStG)
  euAbroadWarnCents: 800_000,     // Warnung ab 8.000 €
  smallBusinessPrevYearCents: 2_500_000,    // 25.000 € Vorjahr (Paragraf 19 UStG)
  smallBusinessCurrYearCents: 10_000_000,   // 100.000 € laufendes Jahr
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NO_RE = /^B-\d{6,9}$/;
/* Wie EMAIL_RE in server.js: keine Klammern, Kommas, spitzen Klammern —
 * das sind die Zeichen, mit denen sich Adressparser umlenken lassen (N10). */
const EMAIL_SHAPE = /^[^\s@()<>",;:\\[\]]+@[^\s@()<>",;:\\[\]]+\.[^\s@()<>",;:\\[\]]+$/;

let regionNames = null;
/** Ist das ein vergebener ISO-3166-Ländercode? (ICU in Node kennt alle.) */
export function isCountryCode(c) {
  const code = String(c || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return false;
  try {
    regionNames ||= new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });
    const name = regionNames.of(code);
    // Sammelregionen (EU, UN, Eurozone) und Platzhalter sind kein Land.
    if (['EU', 'EZ', 'UN', 'QO', 'ZZ'].includes(code) || /unknown/i.test(name || '')) return false;
    return !!name && name !== code;
  } catch { return true; }
}

function envInt(env, name, fallback, min, max) {
  const n = Number.parseInt(String(env[name] ?? '').trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
const truthy = v => /^(1|true|yes|on)$/i.test(String(v || '').trim());

/** Konfiguration aus der Umgebung. Fehlt etwas Pflichtiges, ist der Checkout
 *  aus (missing listet, was fehlt) — Widerruf und Webhook laufen trotzdem. */
export function billingConfig(env = process.env) {
  const days = envInt(env, 'PASS_DAYS', 90, 1, MAX_ACCESS_DAYS);
  const base = String(env.PUBLIC_BASE_URL || env.APP_BASE_URL || '').trim().replace(/\/+$/, '') || null;
  const seller = {
    name: String(env.SELLER_NAME || '').trim(),
    // Zeilen mit "|" oder einem wörtlichen \n trennen — Variablen in Hosting-Oberflächen sind oft einzeilig.
    address: String(env.SELLER_ADDRESS || '').replace(/\\n|\s*\|\s*/g, '\n').trim(),
    email: String(env.SELLER_EMAIL || '').trim(),
    phone: String(env.SELLER_PHONE || '').trim(),
    taxId: String(env.SELLER_TAX_ID || '').trim(),
  };
  const cfg = {
    enabled: truthy(env.BILLING_ENABLED),
    openRegistration: truthy(env.OPEN_REGISTRATION),
    priceCents: envInt(env, 'PASS_PRICE_CENTS', 900, 100, 100_000),
    currency: 'EUR',
    days,
    sku: `pass${days}`,
    productName: String(env.PRODUCT_NAME || 'CV-Hub').trim().slice(0, 60),
    invoicePrefix: (String(env.INVOICE_PREFIX || 'CV').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12)) || 'CV',
    termsVersion: String(env.TERMS_VERSION || '').trim().slice(0, 40) || null,
    withdrawalVersion: String(env.WITHDRAWAL_VERSION || env.TERMS_VERSION || '').trim().slice(0, 40) || null,
    seller,
    base,
    webhookUrl: String(env.BILLING_WEBHOOK_URL || '').trim() || (base ? `${base}/pdfapi/api/billing/webhook` : null),
    mollieKey: String(env.MOLLIE_API_KEY || '').trim(),
    mollieBase: String(env.MOLLIE_API_BASE || '').trim() || undefined,
    altchaKey: String(env.ALTCHA_HMAC_KEY || '').trim(),
    // Wohin Erklärungen gehen, die Handarbeit brauchen.
    notifyEmail: String(env.BILLING_NOTIFY_EMAIL || env.ACCESS_NOTIFY_EMAIL || env.SELLER_EMAIL || '').trim() || null,
  };
  cfg.missing = [
    !cfg.mollieKey && 'MOLLIE_API_KEY',
    !seller.name && 'SELLER_NAME',
    !seller.address && 'SELLER_ADDRESS',
    !seller.email && 'SELLER_EMAIL',
    !seller.phone && 'SELLER_PHONE',
    !base && 'PUBLIC_BASE_URL',
    !cfg.termsVersion && 'TERMS_VERSION',
    !cfg.altchaKey && 'ALTCHA_HMAC_KEY',
  ].filter(Boolean);
  cfg.ready = cfg.enabled && cfg.missing.length === 0;
  return cfg;
}

/* ── Zeit in Berlin ──────────────────────────────────────────────────── */

function berlinParts(date) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const o = {};
  for (const { type, value } of f.formatToParts(date)) o[type] = Number(value);
  return o;
}
/** Versatz Berlin gegen UTC in Minuten zu diesem Zeitpunkt (60 oder 120). */
function berlinOffsetMin(date) {
  const p = berlinParts(date);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000);
}
export function berlinYear(d) { return berlinParts(new Date(d)).year; }

/**
 * Ende der Widerrufsfrist: 14 Tage ab Vertragsschluss, der Tag des
 * Vertragsschlusses zählt nicht mit (Paragraf 187 Abs. 1 BGB), die Frist
 * endet mit Ablauf des 14. Tages, 24:00 Uhr Berliner Zeit (Paragraf 188).
 * Als Vertragsschluss gilt hier der Zahlungseingang — das ist der spätere
 * der beiden möglichen Zeitpunkte und damit für den Käufer der günstigere.
 */
export function withdrawableUntil(paidAt) {
  if (!paidAt) return null;
  const p = berlinParts(new Date(paidAt));
  const naive = Date.UTC(p.year, p.month - 1, p.day + WITHDRAWAL_DAYS + 1, 0, 0, 0);
  // Versatz am Zielzeitpunkt (Sommer-/Winterzeit kann dazwischen wechseln).
  const off = berlinOffsetMin(new Date(naive));
  return new Date(naive - off * 60000);
}

/* ── Kern ────────────────────────────────────────────────────────────── */

/**
 * @param pool      Postgres-Pool
 * @param config    billingConfig()
 * @param mollie    createMollie(…) (für Tests austauschbar)
 * @param renderPdf (html) => Promise<Buffer> — der vorhandene Playwright-Weg
 * @param send      sendMail
 * @param log       Protokollfunktion (nur IDs und Status)
 */
export function createBilling({ pool, config = billingConfig(), mollie, renderPdf, send = defaultSend, log = console.log }) {
  const cfg = config;
  const pay = mollie || createMollie({ apiKey: cfg.mollieKey, base: cfg.mollieBase });

  function offer() {
    return {
      enabled: cfg.ready,
      openRegistration: cfg.openRegistration,
      sku: cfg.sku,
      priceCents: cfg.priceCents,
      currency: cfg.currency,
      days: cfg.days,
      vatNote: 'Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
      productName: cfg.productName,
      features: ['sync', 'share', 'versions', 'mcp', 'apiKeys'],
      // § 312j Abs. 1 BGB: konkrete Zahlungsmittel spätestens bei Beginn des
      // Bestellvorgangs. Muss zu den im Mollie-Profil aktivierten Arten passen.
      paymentMethods: (process.env.PAYMENT_METHODS || 'Kreditkarte (auch Apple Pay und Google Pay)|PayPal')
        .split('|').map((x) => x.trim()).filter(Boolean),
    };
  }

  function orderSummary(o) {
    return {
      id: o.id,
      orderNo: o.order_no,
      status: o.status,
      createdAt: o.created_at,
      paidAt: o.paid_at,
      amountCents: o.amount_cents,
      currency: o.currency,
      days: o.pass_days,
      passFrom: o.pass_from,
      passUntil: o.pass_until,
      invoiceNo: o.invoice_no,
      withdrawableUntil: o.status === 'paid' ? withdrawableUntil(o.paid_at) : null,
      withdrawnAt: o.withdrawn_at,
      refund: o.refund_status ? { status: o.refund_status } : null,
      cancelledAt: o.cancelled_at,
      cancelEffectiveAt: o.cancel_effective_at,
    };
  }

  /* ── Zahlung eingegangen ───────────────────────────────────────────── */

  /** Setzt eine Bestellung auf bezahlt — genau einmal. Gibt true zurück, wenn
   *  DIESER Aufruf den Wechsel vollzogen hat. */
  async function applyPaid(orderId, payment) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      const o = rows[0];
      if (!o || ['paid', 'withdrawn', 'refunded'].includes(o.status)) { await client.query('ROLLBACK'); return false; }
      const paidAt = payment?.paidAt && !Number.isNaN(Date.parse(payment.paidAt)) ? new Date(payment.paidAt) : new Date();
      const { rows: nowRow } = await client.query('SELECT now() AS now');
      const now = nowRow[0].now;
      let passFrom = new Date(now);
      let passUntil = new Date(passFrom.getTime() + o.pass_days * DAY_MS);
      if (o.user_id) {
        const { rows: u } = await client.query('SELECT id, role, access_until, plan_kind FROM users WHERE id = $1 FOR UPDATE', [o.user_id]);
        const user = u[0];
        /* Die Bestellung wird eine Berechtigung (grants.js); die Laufzeit
         * entsteht aus der Neuberechnung: Sie schließt an alles an, was
         * schon läuft — bezahlt, Pilot oder Gutschein.
         * Unbegrenzte Konten (Bestand, Admin) bleiben unbegrenzt — der
         * Checkout lässt sie gar nicht erst kaufen; kommt doch eine Zahlung,
         * wird nichts begrenzt. Ein dauerhafter Gratiszugang bleibt
         * dauerhaft; die Zahlung wird trotzdem als Berechtigung vermerkt. */
        const unlimited = !user || user.role === 'admin' || (!user.access_until && user.plan_kind !== 'lifetime');
        if (!unlimited) {
          const { grant } = await addGrant(client, user.id, { source: 'order', sourceId: o.id, kind: 'days', days: o.pass_days }, { now, log });
          if (grant.effective_from && grant.effective_until) {
            passFrom = new Date(grant.effective_from);
            passUntil = new Date(grant.effective_until);
          }
        }
      }
      const year = berlinYear(paidAt);
      const { rows: c } = await client.query(
        `INSERT INTO invoice_counters (year, last) VALUES ($1, 1)
         ON CONFLICT (year) DO UPDATE SET last = invoice_counters.last + 1 RETURNING last`,
        [year],
      );
      const invoiceNo = `${cfg.invoicePrefix}-${year}-${String(c[0].last).padStart(4, '0')}`;
      await client.query(
        `UPDATE orders SET status = 'paid', paid_at = $2, invoice_no = $3, pass_from = $4, pass_until = $5, updated_at = now()
          WHERE id = $1`,
        [orderId, paidAt, invoiceNo, passFrom, passUntil],
      );
      await client.query('COMMIT');
      log(`billing: Bestellung ${orderId} bezahlt, Rechnung ${invoiceNo}`);
      return true;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async function loadOrder(id) {
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async function invoicePdf(order) {
    return renderPdf(buildInvoiceHtml({ order, seller: cfg.seller, productName: cfg.productName }));
  }

  /** Bestellbestätigung mit Rechnung und Vertragsunterlagen. Merkt sich den
   *  Versand; scheitert er, versucht es der Hintergrundlauf erneut. */
  async function sendConfirmation(orderId) {
    const claim = await pool.query(
      `UPDATE orders SET confirmation_sent_at = now() WHERE id = $1 AND confirmation_sent_at IS NULL AND invoice_no IS NOT NULL RETURNING *`,
      [orderId],
    );
    const o = claim.rows[0];
    if (!o) return false;
    let ok = false;
    try {
      const order = { ...o, withdrawable_until: withdrawableUntil(o.paid_at) };
      const args = { order, seller: cfg.seller, productName: cfg.productName, base: cfg.base };
      // Nacheinander, nicht gleichzeitig: die PDF-Warteschlange ist klein.
      const inv = await invoicePdf(o);
      const terms = await renderPdf(buildTermsHtml(args));
      const wd = await renderPdf(buildWithdrawalHtml(args));
      const L = legalLang(o.locale);
      const names = attachmentNames(L, legalValues({ ...args, lang: L }));
      ok = await send({
        to: o.email,
        ...tplOrderConfirmation(args),
        attachments: [inv, terms, wd].map((content, i) => ({ filename: names[i], content, contentType: 'application/pdf' })),
      });
    } catch (err) {
      log(`billing: Bestellbestätigung ${orderId} nicht erstellt (${err?.message || err})`);
    }
    if (!ok) await pool.query('UPDATE orders SET confirmation_sent_at = NULL WHERE id = $1', [orderId]);
    return ok;
  }

  /** Erstattungsstand bei Mollie nachlesen und übernehmen. */
  async function refreshRefund(o) {
    if (!o.refund_id || !o.mollie_payment_id) return;
    const r = await pay.getRefund(o.mollie_payment_id, o.refund_id);
    const st = String(r?.status || '');
    if (!st || st === o.refund_status) return;
    const { rows } = await pool.query(
      `UPDATE orders SET refund_status = $2,
              status = CASE WHEN $2 = 'refunded' AND status = 'withdrawn' THEN 'refunded' ELSE status END,
              updated_at = now()
        WHERE id = $1 AND refund_status IS DISTINCT FROM $2 RETURNING *`,
      [o.id, st],
    );
    if (rows[0]) {
      log(`billing: Erstattung ${o.id} → ${st}`);
      if (st === 'refunded') await send({ to: rows[0].email, ...tplRefundDone({ order: rows[0], seller: cfg.seller, productName: cfg.productName, base: cfg.base }) }).catch(() => false);
    }
  }

  /**
   * Gleicht eine Bestellung mit Mollie ab. Wirft bei Fehlern der API (dann
   * antwortet der Webhook mit 503, und Mollie versucht es später erneut).
   */
  async function syncOrder(order) {
    if (!order?.mollie_payment_id) return { changed: false };
    const payment = await pay.getPayment(order.mollie_payment_id);
    const amountOk = parseAmount(payment?.amount?.value) === order.amount_cents && payment?.amount?.currency === order.currency;
    if (payment?.id !== order.mollie_payment_id || payment?.metadata?.orderId !== order.id || !amountOk) {
      log(`billing: Zahlung zu Bestellung ${order.id} passt nicht zur Bestellung — nicht übernommen`);
      return { changed: false, mismatch: true };
    }
    const st = String(payment.status || '');
    let newlyPaid = false;
    let changed = false;
    if (st === 'paid') {
      newlyPaid = await applyPaid(order.id, payment);
      changed = newlyPaid;
    } else if (['failed', 'canceled', 'expired'].includes(st)) {
      const r = await pool.query(
        `UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 AND status IN ('open', 'pending', 'authorized')`,
        [order.id, st],
      );
      changed = r.rowCount > 0;
      if (changed) log(`billing: Bestellung ${order.id} → ${st}`);
    } else if (['pending', 'authorized'].includes(st)) {
      const r = await pool.query(
        `UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 AND status IN ('open', 'pending', 'authorized') AND status <> $2`,
        [order.id, st],
      );
      changed = r.rowCount > 0;
    }
    await pool.query('UPDATE orders SET last_synced_at = now() WHERE id = $1', [order.id]);
    if (order.refund_id) await refreshRefund(await loadOrder(order.id));
    /* Die Bestätigung (zwei PDFs) läuft nebenher: Mollie wartet höchstens
     * 15 Sekunden auf die Antwort des Webhooks, und das Rendern hängt an der
     * PDF-Warteschlange. Scheitert sie, holt der Hintergrundlauf sie nach. */
    if (newlyPaid) sendConfirmation(order.id).catch(err => log(`billing: Bestellbestätigung ${order.id} fehlgeschlagen (${err?.message || err})`));
    return { changed, status: st, newlyPaid };
  }

  /* ── Checkout ──────────────────────────────────────────────────────── */

  /**
   * @returns { status, body } — die Route reicht beides durch.
   */
  async function checkout(user, body, { lang } = {}) {
    if (!cfg.ready) return { status: 404, body: { error: 'Der Kauf ist derzeit nicht verfügbar.', code: 'billing_disabled' } };
    const sku = String(body?.sku || '');
    const country = String(body?.country || '').trim().toUpperCase();
    // Steuerzeichen raus (Codepunkte unter 32 und 127), Leerraum zusammenfassen.
    const billingName = [...String(body?.billingName || '')].map(ch => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('').replace(/\s+/g, ' ').trim();
    if (sku !== cfg.sku) return { status: 400, body: { error: 'Unbekanntes Produkt.', code: 'sku_invalid' } };
    if (!isCountryCode(country)) return { status: 400, body: { error: 'Bitte ein Land auswählen.', code: 'country_invalid' } };
    if (billingName.length < 2 || billingName.length > 120) return { status: 400, body: { error: 'Bitte den Namen für die Rechnung angeben (2 bis 120 Zeichen).', code: 'name_invalid' } };
    if (body?.acceptTerms !== true) return { status: 400, body: { error: 'Bitte AGB und Widerrufsbelehrung bestätigen.', code: 'terms_required' } };
    if (body?.ageConfirmed18 !== true) return { status: 400, body: { error: 'Der Kauf ist erst ab 18 Jahren möglich. Bitte bestätige dein Alter.', code: 'age18_required' } };
    if (!user.email) return { status: 400, body: { error: 'Bitte hinterlege zuerst eine E-Mail-Adresse im Konto — dorthin gehen Rechnung und Bestätigung.', code: 'email_required' } };
    const plan = planInfo(user);
    if (plan?.kind === 'unlimited') {
      return { status: 409, body: { error: 'Dein Konto ist unbegrenzt freigeschaltet. Du brauchst keinen Pass.', code: 'plan_unlimited' } };
    }
    if (plan?.kind === 'lifetime') {
      return { status: 409, body: { error: 'Dein dauerhafter Gratiszugang ist aktiv. Du musst keinen Bewerbungs-Pass kaufen.', code: 'plan_lifetime' } };
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Ein Checkout je Konto zur gleichen Zeit: Doppelklick wartet hier.
      await client.query('SELECT pg_advisory_xact_lock(7321, $1)', [user.id]);
      const { rows: again } = await client.query(
        `SELECT * FROM orders
          WHERE user_id = $1 AND status = 'open' AND sku = $2 AND country = $3 AND billing_name = $4
            AND checkout_url IS NOT NULL AND created_at > now() - make_interval(mins => $5)
          ORDER BY created_at DESC LIMIT 1`,
        [user.id, cfg.sku, country, billingName, CHECKOUT_REUSE_MINUTES],
      );
      if (again[0]) {
        await client.query('COMMIT');
        return { status: 200, body: { orderId: again[0].id, orderNo: again[0].order_no, checkoutUrl: again[0].checkout_url, reused: true } };
      }
      const id = crypto.randomUUID();
      const { rows: nr } = await client.query(`SELECT 'B-' || lpad(nextval('order_no_seq')::text, 6, '0') AS no`);
      const orderNo = nr[0].no;
      const locale = mollieLocale(lang);
      await client.query(
        `INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, currency, status,
                             locale, terms_version, withdrawal_version, age_confirmed_18, pass_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10, $11, $12, true, $13)`,
        [id, orderNo, user.id, String(user.email).toLowerCase(), billingName, country, cfg.sku, cfg.priceCents, cfg.currency,
          locale, cfg.termsVersion, cfg.withdrawalVersion, cfg.days],
      );
      let payment;
      try {
        payment = await pay.createPayment({
          amountCents: cfg.priceCents,
          currency: cfg.currency,
          description: `${cfg.productName} Bewerbungs-Pass ${cfg.days} Tage, Bestellung ${orderNo}`,
          redirectUrl: `${cfg.base}/kauf/danke?order=${id}`,
          webhookUrl: cfg.webhookUrl,
          metadata: { orderId: id },
          locale,
          idempotencyKey: `payment-${id}`,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        log(`billing: Zahlung für Bestellung ${id} nicht angelegt (${err?.message || err})`);
        return { status: 502, body: { error: 'Die Bezahlseite ist gerade nicht erreichbar. Bitte in einer Minute noch einmal versuchen.', code: 'payment_provider_unavailable' } };
      }
      const checkoutUrl = payment?._links?.checkout?.href;
      if (!isPaymentId(payment?.id) || !checkoutUrl || !/^https?:\/\//.test(checkoutUrl)) {
        await client.query('ROLLBACK');
        log(`billing: Antwort von Mollie für Bestellung ${id} unbrauchbar`);
        return { status: 502, body: { error: 'Die Bezahlseite ist gerade nicht erreichbar. Bitte in einer Minute noch einmal versuchen.', code: 'payment_provider_unavailable' } };
      }
      await client.query('UPDATE orders SET mollie_payment_id = $2, checkout_url = $3 WHERE id = $1', [id, payment.id, checkoutUrl]);
      await client.query('COMMIT');
      log(`billing: Bestellung ${id} angelegt`);
      return { status: 200, body: { orderId: id, orderNo, checkoutUrl } };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /* ── Widerruf ──────────────────────────────────────────────────────── */

  async function requestRefund(orderId) {
    const o = await loadOrder(orderId);
    if (!o || o.status !== 'withdrawn' || o.refund_id || !o.mollie_payment_id) return o?.refund_status || null;
    try {
      const r = await pay.createRefund(o.mollie_payment_id, {
        amountCents: o.amount_cents,
        currency: o.currency,
        description: `Widerruf Bestellung ${o.order_no}`,
        metadata: { orderId: o.id },
        idempotencyKey: `refund-${o.id}`,
      });
      const st = String(r?.status || 'pending');
      await pool.query(
        `UPDATE orders SET refund_id = $2, refund_status = $3, refund_attempts = refund_attempts + 1,
                status = CASE WHEN $3 = 'refunded' THEN 'refunded' ELSE status END, updated_at = now()
          WHERE id = $1`,
        [o.id, String(r?.id || '') || null, st],
      );
      log(`billing: Erstattung für ${o.id} beauftragt (${st})`);
      return st;
    } catch (err) {
      await pool.query(
        `UPDATE orders SET refund_status = 'retry', refund_attempts = refund_attempts + 1, updated_at = now() WHERE id = $1`,
        [o.id],
      );
      log(`billing: Erstattung für ${o.id} fehlgeschlagen, wird wiederholt (${err?.message || err})`);
      return 'retry';
    }
  }

  /* Laufzeit nach Widerruf und Kündigung: nicht mehr hier abgezogen, sondern
   * in grants.js neu berechnet (revokeOrderGrant, capOrderGrant). Nur der
   * Anspruch DIESER Bestellung fällt weg bzw. endet früher; andere Pässe,
   * Pilot-Laufzeit und Gutscheine bleiben. */

  async function recordDeclaration({ type, channel, name, email, orderNo, userId, orderIds = [], receivedAt, statement, status, note }) {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO declarations (id, type, channel, name, email, order_no, user_id, order_ids, received_at, statement, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9, $10, $11, $12)`,
      [id, type, channel, name || null, email ? String(email).toLowerCase() : null, orderNo || null, userId || null, orderIds, receivedAt, statement, status, note || null],
    );
    return id;
  }

  async function notifyAdmin(args) {
    if (!cfg.notifyEmail) return;
    await send({ to: cfg.notifyEmail, ...tplAdminDeclaration(args) }).catch(() => false);
  }

  function withdrawalStatement({ o, name, email, orderNo, receivedAt, channel }) {
    return [
      `Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den ${cfg.productName} Bewerbungs-Pass.`,
      `Bestellnummer: ${o?.order_no || orderNo || '(nicht angegeben)'}`,
      o ? `Bestellt am: ${berlinDate(o.created_at)}, bezahlt am: ${berlinDate(o.paid_at)}` : null,
      `Name: ${name ?? o?.billing_name ?? ''}`,
      `E-Mail: ${email ?? o?.email ?? ''}`,
      `Eingegangen: ${berlinDateTime(receivedAt)}`,
      `Weg: ${channel === 'public' ? 'Funktion „Vertrag widerrufen“ auf der Website (ohne Anmeldung)' : 'Funktion „Vertrag widerrufen“ im Konto'}`,
    ].filter(Boolean).join('\n');
  }

  /**
   * Widerruf einer bezahlten Bestellung. Idempotent.
   * @param declared  was der Kunde eingegeben hat (öffentlicher Weg) — fließt in den Wortlaut
   * @returns { result: 'done'|'already'|'late'|'not_paid'|'missing', order, receivedAt, refundStatus }
   */
  async function withdraw(orderId, { channel, declared = {} }) {
    const client = await pool.connect();
    let o, receivedAt, statement;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
      o = rows[0];
      if (!o) { await client.query('ROLLBACK'); return { result: 'missing' }; }
      if (o.status === 'withdrawn' || o.status === 'refunded') {
        await client.query('ROLLBACK');
        return { result: 'already', order: o, receivedAt: o.withdrawn_at, refundStatus: o.refund_status };
      }
      if (o.status !== 'paid') { await client.query('ROLLBACK'); return { result: 'not_paid', order: o }; }
      receivedAt = new Date();
      if (receivedAt.getTime() >= withdrawableUntil(o.paid_at).getTime()) {
        await client.query('ROLLBACK');
        return { result: 'late', order: o, receivedAt };
      }
      statement = withdrawalStatement({ o, name: declared.name, email: declared.email, receivedAt, channel });
      await client.query(
        `UPDATE orders SET status = 'withdrawn', withdrawn_at = $2, withdraw_channel = $3, withdraw_statement = $4,
                refund_status = 'requested', updated_at = now()
          WHERE id = $1`,
        [o.id, receivedAt, channel, statement],
      );
      await revokeOrderGrant(client, o, { at: receivedAt, reason: 'withdrawal', log });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    log(`billing: Bestellung ${o.id} widerrufen (${channel})`);
    await recordDeclaration({
      type: 'withdrawal', channel, name: declared.name || o.billing_name, email: declared.email || o.email, orderNo: o.order_no,
      userId: o.user_id, orderIds: [o.id], receivedAt, statement, status: 'processed',
    }).catch(err => log(`billing: Erklärung nicht gespeichert (${err?.message || err})`));
    // Eingangsbestätigung sofort, vor der Erstattung — sie hängt nicht davon
    // ab, ob Mollie gerade antwortet.
    await send({ to: o.email, ...tplWithdrawalReceipt({ order: o, statement, receivedAt, refundStatus: 'requested', seller: cfg.seller, productName: cfg.productName, base: cfg.base }) })
      .catch(() => false);
    const refundStatus = await requestRefund(o.id);
    return { result: 'done', order: o, receivedAt, refundStatus };
  }

  const norm = s => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();

  /**
   * Öffentlicher Widerruf (ohne Anmeldung). Die Antwort an den Aufrufer ist
   * für jeden Ausgang gleich; Mails gehen nur an die eingegebene Adresse, und
   * zugeordnet wird nur, wenn diese Adresse die der Bestellung ist. So erfährt
   * niemand etwas über Bestellungen, deren Postfach er nicht hat.
   *
   * Zuordnung: Bestellnummer + Adresse; ohne Nummer die eine bezahlte, noch
   * widerrufbare Bestellung dieser Adresse. Alles andere (mehrere Treffer,
   * keine Treffer, abweichende Adresse) wird gespeichert, an die eingegebene
   * Adresse bestätigt und dem Betreiber gemeldet — eine Widerrufserklärung
   * ist auch ohne Abgleich wirksam.
   */
  async function withdrawPublic({ name, email, orderNo }) {
    const no = String(orderNo || '').trim().toUpperCase();
    const mail = norm(email);
    let candidates = [];
    if (no) {
      if (ORDER_NO_RE.test(no)) {
        const { rows } = await pool.query('SELECT * FROM orders WHERE order_no = $1', [no]);
        candidates = rows.filter(o => norm(o.email) === mail);
      }
    } else {
      const { rows } = await pool.query(`SELECT * FROM orders WHERE lower(email) = $1 AND status = 'paid' ORDER BY paid_at DESC`, [mail]);
      candidates = rows.filter(o => Date.now() < withdrawableUntil(o.paid_at).getTime());
    }
    if (candidates.length === 1) {
      const o = candidates[0];
      const r = await withdraw(o.id, { channel: 'public', declared: { name, email } });
      if (r.result === 'late') {
        const statement = withdrawalStatement({ o, name, email, receivedAt: r.receivedAt, channel: 'public' });
        await recordDeclaration({ type: 'withdrawal', channel: 'public', name, email, orderNo: o.order_no, userId: o.user_id, orderIds: [o.id], receivedAt: r.receivedAt, statement, status: 'manual', note: 'nach Fristende' });
        await send({ to: o.email, ...tplWithdrawalLate({ order: o, statement, receivedAt: r.receivedAt, base: cfg.base }) }).catch(() => false);
        await notifyAdmin({ type: 'withdrawal', reason: 'Widerruf nach Fristende', statement, receivedAt: r.receivedAt, orderNos: [o.order_no] });
      }
      return { matched: true, result: r.result };
    }
    const receivedAt = new Date();
    const statement = withdrawalStatement({ o: null, name, email, orderNo: no, receivedAt, channel: 'public' });
    await recordDeclaration({ type: 'withdrawal', channel: 'public', name, email, orderNo: no || null, receivedAt, statement, status: 'manual', note: candidates.length > 1 ? 'mehrere Bestellungen' : 'nicht zugeordnet' });
    await send({ to: String(email).trim(), ...tplDeclarationUnmatched({ type: 'withdrawal', statement, receivedAt }) }).catch(() => false);
    await notifyAdmin({ type: 'withdrawal', reason: candidates.length > 1 ? 'mehrere passende Bestellungen' : 'keine Bestellung zuzuordnen', statement, receivedAt });
    return { matched: false };
  }

  /* ── Kündigung (Paragraf 312k BGB) ─────────────────────────────────── */
  /*
   * Rechtstexte-Agent (app/src/legal/kuendigung.ts): Auch ein Pass mit fester
   * Laufzeit und Einmalzahlung braucht die Kündigungsschaltfläche. Ordentlich
   * jederzeit zum gewählten Zeitpunkt, ohne anteilige Erstattung;
   * außerordentlich mit Grund — dann prüft der Betreiber und erstattet bei
   * berechtigter Kündigung den Rest (Handarbeit, Meldung per Mail).
   */

  /** Zeitpunkt, zu dem eine Kündigung wirkt. when: 'now' | 'end' | 'date'. */
  function cancelEffective(o, when, date, now = Date.now()) {
    const end = new Date(o.pass_until || now).getTime();
    if (when === 'end') return new Date(end);
    if (when === 'date') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
      if (m) {
        // Ende des gewählten Tages, Berliner Zeit.
        const naive = Date.UTC(+m[1], +m[2] - 1, +m[3] + 1);
        const t = naive - berlinOffsetMin(new Date(naive)) * 60000;
        return new Date(Math.min(end, Math.max(now, t)));
      }
    }
    return new Date(Math.min(end, now));
  }

  function cancellationStatement({ orders, name, email, kind, reason, effectiveAt, receivedAt, channel, orderNo }) {
    return [
      `Hiermit kündige ich den Vertrag über den ${cfg.productName} Bewerbungs-Pass.`,
      `Art: ${kind === 'extraordinary' ? 'außerordentliche Kündigung aus wichtigem Grund' : 'ordentliche Kündigung'}`,
      kind === 'extraordinary' ? `Grund: ${reason || '(nicht angegeben)'}` : null,
      `Bestellung(en): ${orders.length ? orders.map(o => o.order_no).join(', ') : (orderNo || '(nicht angegeben)')}`,
      `Gewünschter Beendigungszeitpunkt: ${effectiveAt ? berlinDateTime(effectiveAt) : 'frühestmöglich'}`,
      `Name: ${name || ''}`,
      `E-Mail für die Bestätigung: ${email || ''}`,
      `Eingegangen: ${berlinDateTime(receivedAt)}`,
      `Weg: ${channel === 'public' ? 'Schaltfläche „Verträge hier kündigen“ auf der Website (ohne Anmeldung)' : 'Schaltfläche „Verträge hier kündigen“ im Konto'}`,
    ].filter(Boolean).join('\n');
  }

  /** Kündigt die angegebenen bezahlten Bestellungen. Gibt je Bestellung den
   *  Wirkzeitpunkt zurück. */
  async function applyCancellation(orderIds, { kind, reason, when, date, channel, receivedAt }) {
    const done = [];
    for (const id of orderIds) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
        const o = rows[0];
        if (!o || o.status !== 'paid' || o.cancelled_at) { await client.query('ROLLBACK'); if (o?.cancelled_at) done.push({ order: o, effectiveAt: o.cancel_effective_at, already: true }); continue; }
        const effectiveAt = cancelEffective(o, when, date, receivedAt.getTime());
        await client.query(
          `UPDATE orders SET cancelled_at = $2, cancel_kind = $3, cancel_reason = $4, cancel_effective_at = $5, cancel_channel = $6, updated_at = now()
            WHERE id = $1`,
          [o.id, receivedAt, kind, reason || null, effectiveAt, channel],
        );
        await capOrderGrant(client, o, effectiveAt, { at: receivedAt, log });
        await client.query('COMMIT');
        done.push({ order: { ...o, cancelled_at: receivedAt, cancel_effective_at: effectiveAt }, effectiveAt });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }
    return done;
  }

  function cancelInput(body) {
    const kind = body?.kind === 'extraordinary' ? 'extraordinary' : 'ordinary';
    const reason = String(body?.reason || '').trim().slice(0, 2000);
    const when = ['now', 'end', 'date'].includes(body?.when) ? body.when : 'now';
    const date = String(body?.date || '').slice(0, 10);
    if (kind === 'extraordinary' && reason.length < 3) return { error: 'Bitte den Grund für die außerordentliche Kündigung angeben.', code: 'reason_required' };
    if (when === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Datum im Format JJJJ-MM-TT.', code: 'date_invalid' };
    return { kind, reason, when, date };
  }

  async function finishCancellation({ orders, done, input, name, email, channel, receivedAt, userId, orderNo }) {
    const effectiveAt = done.length ? new Date(Math.max(...done.map(d => new Date(d.effectiveAt).getTime()))) : null;
    const statement = cancellationStatement({ orders, name, email, ...input, effectiveAt, receivedAt, channel, orderNo });
    const manual = input.kind === 'extraordinary' || !done.length;
    await recordDeclaration({
      type: 'cancellation', channel, name, email, orderNo: orders.map(o => o.order_no).join(',') || orderNo || null, userId,
      orderIds: orders.map(o => o.id), receivedAt, statement,
      status: manual ? 'manual' : 'processed', note: !done.length ? 'nicht zugeordnet' : input.kind === 'extraordinary' ? 'außerordentlich: Erstattung prüfen' : null,
    });
    if (done.length) {
      await send({ to: email, ...tplCancellationReceipt({ order: done[0].order, receivedAt, kind: input.kind, reason: input.reason, effectiveAt, email, seller: cfg.seller, productName: cfg.productName, base: cfg.base, statement }) }).catch(() => false);
    } else {
      await send({ to: email, ...tplDeclarationUnmatched({ type: 'cancellation', statement, receivedAt }) }).catch(() => false);
    }
    if (manual) await notifyAdmin({ type: 'cancellation', reason: !done.length ? 'keine laufende Bestellung zuzuordnen' : 'außerordentliche Kündigung, Erstattung prüfen', statement, receivedAt, orderNos: orders.map(o => o.order_no) });
    log(`billing: Kündigung (${channel}, ${input.kind}) für ${done.length} Bestellung(en)`);
    return { effectiveAt, statement };
  }

  /** Kündigung im Konto. orderId leer = alle laufenden Pässe des Kontos. */
  async function cancelForUser(user, body) {
    const input = cancelInput(body);
    if (input.error) return { status: 400, body: { error: input.error, code: input.code } };
    const receivedAt = new Date();
    let orders;
    if (body?.orderId) {
      if (!UUID_RE.test(String(body.orderId))) return { status: 404, body: { error: 'Bestellung nicht gefunden.' } };
      ({ rows: orders } = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [body.orderId, user.id]));
      if (!orders.length) return { status: 404, body: { error: 'Bestellung nicht gefunden.' } };
    } else {
      ({ rows: orders } = await pool.query(`SELECT * FROM orders WHERE user_id = $1 AND status = 'paid' AND cancelled_at IS NULL AND pass_until > now()`, [user.id]));
    }
    orders = orders.filter(o => o.status === 'paid');
    if (!orders.length) return { status: 409, body: { error: 'Es gibt keinen laufenden Pass, der sich kündigen ließe.', code: 'nothing_to_cancel' } };
    const done = await applyCancellation(orders.map(o => o.id), { ...input, channel: 'account', receivedAt });
    const email = user.email || orders[0].email;
    const { effectiveAt } = await finishCancellation({ orders, done, input, name: orders[0].billing_name, email, channel: 'account', receivedAt, userId: user.id });
    return { status: 200, body: { ok: true, receivedAt, effectiveAt, kind: input.kind, orders: done.map(d => d.order.order_no) } };
  }

  /** Kündigung ohne Anmeldung. Gleiche Antwort für jeden Ausgang; Mails nur
   *  an die eingegebene Adresse, zugeordnet nur, wenn sie die der Bestellung ist. */
  async function cancelPublic({ name, email, orderNo, body }) {
    const input = cancelInput(body);
    const receivedAt = new Date();
    const mail = norm(email);
    const no = String(orderNo || '').trim().toUpperCase();
    let orders = [];
    if (no) {
      if (ORDER_NO_RE.test(no)) {
        const { rows } = await pool.query(`SELECT * FROM orders WHERE order_no = $1 AND status = 'paid'`, [no]);
        orders = rows.filter(o => norm(o.email) === mail);
      }
    } else {
      const { rows } = await pool.query(`SELECT * FROM orders WHERE lower(email) = $1 AND status = 'paid' AND cancelled_at IS NULL AND pass_until > now()`, [mail]);
      orders = rows;
    }
    const done = orders.length ? await applyCancellation(orders.map(o => o.id), { ...input, channel: 'public', receivedAt }) : [];
    await finishCancellation({ orders, done, input, name, email: String(email).trim(), channel: 'public', receivedAt, userId: orders[0]?.user_id, orderNo: no });
    return { matched: done.length > 0 };
  }

  /* ── Auswertung ────────────────────────────────────────────────────── */

  async function report(now = new Date()) {
    const curr = berlinYear(now);
    const prev = curr - 1;
    const { rows } = await pool.query(
      `SELECT paid_at, country, amount_cents, status, refund_status FROM orders
        WHERE paid_at IS NOT NULL AND paid_at >= make_timestamptz($1, 1, 1, 0, 0, 0, 'Europe/Berlin')`,
      [prev - 2],
    );
    const months = new Map();
    const byYearCountry = { [curr]: new Map(), [prev]: new Map() };
    const totals = { [curr]: 0, [prev]: 0 };
    const euAbroad = { [curr]: 0, [prev]: 0 };
    for (const r of rows) {
      const p = berlinParts(new Date(r.paid_at));
      const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
      const refunded = r.status === 'withdrawn' || r.status === 'refunded';
      const net = refunded ? 0 : r.amount_cents;
      const m = months.get(key) || { month: key, orders: 0, grossCents: 0, refundedCents: 0, netCents: 0 };
      m.orders += 1; m.grossCents += r.amount_cents; m.refundedCents += refunded ? r.amount_cents : 0; m.netCents += net;
      months.set(key, m);
      if (p.year === curr || p.year === prev) {
        totals[p.year] += net;
        const c = byYearCountry[p.year].get(r.country) || { country: r.country, region: r.country === 'DE' ? 'DE' : EU_COUNTRIES.has(r.country) ? 'EU-Ausland' : 'Drittland', orders: 0, netCents: 0 };
        c.orders += 1; c.netCents += net;
        byYearCountry[p.year].set(r.country, c);
        if (r.country !== 'DE' && EU_COUNTRIES.has(r.country)) euAbroad[p.year] += net;
      }
    }
    const euMax = Math.max(euAbroad[curr], euAbroad[prev]);
    const { rows: openRefunds } = await pool.query(
      `SELECT order_no, withdrawn_at, refund_status, refund_attempts, amount_cents FROM orders
        WHERE status = 'withdrawn' ORDER BY withdrawn_at`,
    );
    const { rows: counts } = await pool.query('SELECT status, count(*)::int AS n FROM orders GROUP BY status');
    const { rows: decl } = await pool.query(
      `SELECT id, type, channel, order_no, received_at, note, statement FROM declarations WHERE status = 'manual' ORDER BY received_at LIMIT 100`,
    );
    const warnings = [];
    if (euMax >= THRESHOLDS.euAbroadCents) warnings.push({ code: 'eu_threshold_exceeded', text: 'Umsätze an Privatkunden im EU-Ausland über 10.000 € (Vorjahr oder laufendes Jahr): Ab dem überschreitenden Umsatz gilt die Umsatzsteuer des Kundenlands (§ 3a Abs. 5 UStG), § 19 UStG schützt dort nicht. OSS-Registrierung beim BZSt prüfen, Steuerberatung einschalten.' });
    else if (euMax >= THRESHOLDS.euAbroadWarnCents) warnings.push({ code: 'eu_threshold_near', text: 'Umsätze an Privatkunden im EU-Ausland über 8.000 €: Die Schwelle von 10.000 € (§ 3a Abs. 5 UStG, Vorjahr und laufendes Jahr) rückt näher.' });
    if (totals[curr] >= THRESHOLDS.smallBusinessCurrYearCents * 0.8 || totals[prev] >= THRESHOLDS.smallBusinessPrevYearCents * 0.8) {
      warnings.push({ code: 'small_business_near', text: 'Die Umsätze dieses Werkzeugs allein erreichen 80 % einer Grenze nach § 19 UStG. Die Grenzen gelten für ALLE Umsätze des Unternehmens zusammen.' });
    }
    if (decl.length) warnings.push({ code: 'declarations_open', text: `${decl.length} Widerruf(e) oder Kündigung(en) warten auf eine Entscheidung von Hand.` });
    if (openRefunds.some(o => o.refund_status === 'retry' || o.refund_attempts >= 3)) {
      warnings.push({ code: 'refund_stuck', text: 'Mindestens eine Erstattung hängt. Bitte im Mollie-Dashboard prüfen.' });
    }
    return {
      currency: 'EUR',
      years: { current: curr, previous: prev },
      byMonth: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 36),
      byCountry: {
        [curr]: [...byYearCountry[curr].values()].sort((a, b) => b.netCents - a.netCents),
        [prev]: [...byYearCountry[prev].values()].sort((a, b) => b.netCents - a.netCents),
      },
      euAbroad: {
        currentYearCents: euAbroad[curr], previousYearCents: euAbroad[prev],
        thresholdCents: THRESHOLDS.euAbroadCents, warnAtCents: THRESHOLDS.euAbroadWarnCents,
        warning: euMax >= THRESHOLDS.euAbroadWarnCents, exceeded: euMax >= THRESHOLDS.euAbroadCents,
        note: 'Privatkunden mit Land der Bestellung in einem anderen EU-Staat als DE. Schwelle 10.000 € netto der Entgelte, Vorjahr UND laufendes Jahr (§ 3a Abs. 5 UStG).',
      },
      total: {
        currentYearCents: totals[curr], previousYearCents: totals[prev],
        smallBusinessLimits: { previousYearCents: THRESHOLDS.smallBusinessPrevYearCents, currentYearCents: THRESHOLDS.smallBusinessCurrYearCents },
        note: 'Grenzen nach § 19 UStG: 25.000 € im Vorjahr, 100.000 € im laufenden Jahr — gerechnet über ALLE Umsätze des Unternehmens, nicht nur über dieses Werkzeug.',
      },
      openRefunds: openRefunds.map(o => ({ orderNo: o.order_no, withdrawnAt: o.withdrawn_at, refundStatus: o.refund_status, attempts: o.refund_attempts, amountCents: o.amount_cents })),
      statusCounts: Object.fromEntries(counts.map(c => [c.status, c.n])),
      // Widerrufe und Kündigungen, die eine Entscheidung von Hand brauchen
      // (nicht zuzuordnen, nach Frist, außerordentlich). Mit Wortlaut, weil
      // der Betreiber sonst nicht entscheiden kann.
      declarationsOpen: decl.map(d => ({ id: d.id, type: d.type, channel: d.channel, orderNo: d.order_no, receivedAt: d.received_at, note: d.note, statement: d.statement })),
      warnings,
      testMode: !!pay.isTestMode,
      config: { ready: cfg.ready, missing: cfg.missing },
    };
  }

  /* ── Hintergrundlauf ──────────────────────────────────────────────── */

  /** Holt nach, was beim ersten Mal nicht ging: Bestellbestätigungen,
   *  Erstattungen, Erstattungsstände, offene Zahlungen ohne Webhook. */
  async function runJobs() {
    const out = { confirmations: 0, refunds: 0, refundChecks: 0, syncs: 0 };
    const { rows: unsent } = await pool.query(
      `SELECT id FROM orders WHERE invoice_no IS NOT NULL AND confirmation_sent_at IS NULL
          AND paid_at > now() - interval '7 days' ORDER BY paid_at LIMIT 20`,
    );
    for (const r of unsent) if (await sendConfirmation(r.id)) out.confirmations += 1;
    const { rows: pend } = await pool.query(
      `SELECT id FROM orders WHERE status = 'withdrawn' AND refund_id IS NULL AND refund_attempts < 30 ORDER BY withdrawn_at LIMIT 20`,
    );
    for (const r of pend) { await requestRefund(r.id); out.refunds += 1; }
    const { rows: check } = await pool.query(
      `SELECT * FROM orders WHERE refund_id IS NOT NULL AND refund_status NOT IN ('refunded', 'failed', 'canceled') LIMIT 50`,
    );
    for (const o of check) { try { await refreshRefund(o); out.refundChecks += 1; } catch { /* nächster Lauf */ } }
    const { rows: open } = await pool.query(
      `SELECT * FROM orders WHERE status IN ('open', 'pending', 'authorized') AND mollie_payment_id IS NOT NULL
          AND created_at < now() - interval '15 minutes' AND created_at > now() - interval '3 days'
          AND (last_synced_at IS NULL OR last_synced_at < now() - interval '30 minutes') LIMIT 50`,
    );
    for (const o of open) { try { await syncOrder(o); out.syncs += 1; } catch { /* nächster Lauf */ } }
    return out;
  }

  function startJobs({ everyMs = 10 * 60 * 1000 } = {}) {
    const tick = () => runJobs()
      .then(r => { const s = Object.entries(r).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' '); if (s) log(`billing-jobs: ${s}`); })
      .catch(err => console.error('billing-jobs failed:', err?.message || err));
    const t = setInterval(tick, everyMs);
    t.unref?.();
    setTimeout(tick, 5000).unref?.();
    return t;
  }

  /* ── Routen ───────────────────────────────────────────────────────── */

  /**
   * @param deps { requireAuth, requireAdmin, rateLimit, altcha }
   */
  function mount(app, { requireAuth, requireAdmin, rateLimit, subnetLimit, altcha }) {
    const urlencoded = express.urlencoded({ extended: false, limit: '4kb' });

    app.get('/api/billing/offer', (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json(offer());
    });

    app.post('/api/billing/checkout', rateLimit({ route: 'checkout', max: 20, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
      if (!cfg.ready) return res.status(404).json({ error: 'Der Kauf ist derzeit nicht verfügbar.', code: 'billing_disabled' });
      const lang = String(req.body?.lang || req.body?.locale || req.get('accept-language') || 'de');
      const r = await checkout(req.user, req.body, { lang });
      res.status(r.status).json(r.body);
    });

    /* Mollie ruft hier ohne Anmeldung an. Antwort immer 200 — außer der
     * Abgleich mit Mollie selbst scheitert, dann 503, damit Mollie es später
     * erneut versucht. Kein Körper, keine Details. */
    app.post('/api/billing/webhook', rateLimit({ route: 'mollie-webhook', max: 3000, windowMs: 60 * 60 * 1000 }), urlencoded, async (req, res) => {
      const id = String(req.body?.id || '');
      if (!isPaymentId(id)) return res.status(200).end();
      const { rows } = await pool.query('SELECT * FROM orders WHERE mollie_payment_id = $1', [id]);
      if (!rows[0]) return res.status(200).end();
      try {
        await syncOrder(rows[0]);
        res.status(200).end();
      } catch (err) {
        log(`billing: Webhook-Abgleich für ${rows[0].id} fehlgeschlagen (${err?.message || err})`);
        res.status(503).end();
      }
    });

    const ownOrder = async (req, res) => {
      if (!UUID_RE.test(String(req.params.id || ''))) { res.status(404).json({ error: 'Bestellung nicht gefunden.' }); return null; }
      const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      if (!rows[0]) { res.status(404).json({ error: 'Bestellung nicht gefunden.' }); return null; }
      return rows[0];
    };

    app.get('/api/billing/orders/:id/status', rateLimit({ route: 'order-status', max: 600, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
      let o = await ownOrder(req, res);
      if (!o) return;
      // Kommt der Webhook nicht an (lokal, Störung), holt die Danke-Seite den
      // Stand selbst — höchstens alle 10 Sekunden je Bestellung.
      if (['open', 'pending', 'authorized'].includes(o.status) && o.mollie_payment_id
        && (!o.last_synced_at || Date.now() - new Date(o.last_synced_at).getTime() > 10_000)) {
        try { await syncOrder(o); o = await loadOrder(o.id); } catch { /* Webhook holt es nach */ }
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ status: o.status, orderNo: o.order_no, passUntil: o.pass_until, invoiceNo: o.invoice_no });
    });

    app.get('/api/billing/orders', requireAuth, async (req, res) => {
      const { rows } = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ orders: rows.map(orderSummary), plan: await planDetails(pool, req.user) });
    });

    app.get('/api/billing/orders/:id/invoice.pdf', rateLimit({ route: 'invoice', max: 30, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
      const o = await ownOrder(req, res);
      if (!o) return;
      if (!o.invoice_no) return res.status(404).json({ error: 'Für diese Bestellung gibt es keine Rechnung.' });
      try {
        const pdf = await invoicePdf(o);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Disposition', `attachment; filename="Rechnung-${o.invoice_no}.pdf"`);
        res.send(pdf);
      } catch (err) {
        log(`billing: Rechnung ${o.id} nicht erstellt (${err?.message || err})`);
        res.status(503).json({ error: 'Die Rechnung lässt sich gerade nicht erstellen. Bitte gleich noch einmal versuchen.' });
      }
    });

    app.post('/api/billing/withdraw', rateLimit({ route: 'withdraw', max: 20, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
      const id = String(req.body?.orderId || '');
      if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
      const { rows } = await pool.query('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
      const r = await withdraw(id, { channel: 'account' });
      if (r.result === 'not_paid') return res.status(409).json({ error: 'Diese Bestellung ist nicht bezahlt und kann deshalb nicht widerrufen werden.', code: 'not_withdrawable' });
      if (r.result === 'late') return res.status(409).json({ error: `Die Widerrufsfrist dieser Bestellung ist am ${berlinDate(withdrawableUntil(r.order.paid_at).getTime() - 1)} abgelaufen.`, code: 'withdrawal_period_over' });
      if (r.result === 'missing') return res.status(404).json({ error: 'Bestellung nicht gefunden.' });
      res.json({ ok: true, receivedAt: r.receivedAt, refund: { status: r.refundStatus || 'requested' }, already: r.result === 'already' || undefined });
    });

    app.post('/api/billing/withdraw-public',
      rateLimit({ route: 'withdraw-public', max: 5, windowMs: 60 * 60 * 1000 }),
      subnetLimit({ route: 'withdraw-public', max: 20, windowMs: 60 * 60 * 1000 }),
      async (req, res) => {
        const name = String(req.body?.name || '').trim().slice(0, 160);
        const email = String(req.body?.email || '').trim().slice(0, 200);
        // Bestellnummer ist freiwillig (widerruf.ts): ohne sie ordnen wir über die Adresse zu.
        const orderNo = String(req.body?.orderNo || '').trim().slice(0, 20);
        if (name.length < 2 || !EMAIL_SHAPE.test(email)) {
          return res.status(400).json({ error: 'Bitte Name und E-Mail-Adresse angeben.', code: 'fields_required' });
        }
        if (altcha?.configured) {
          const v = await altcha.verify(req.body?.altcha);
          if (!v.ok) return res.status(400).json({ error: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte noch einmal versuchen.', code: 'altcha_invalid' });
        }
        const receivedAt = new Date();
        // Gleiche Antwort für jeden Ausgang. Die Bestätigung geht nur an die
        // Adresse, die an der Bestellung hinterlegt ist.
        res.json({ ok: true, receivedAt, refund: { status: 'requested' } });
        withdrawPublic({ name, email, orderNo })
          .then(r => { if (!r.matched) log('billing: öffentlicher Widerruf ohne passende Bestellung (gespeichert, Handarbeit)'); })
          .catch(err => console.error('billing: öffentlicher Widerruf fehlgeschlagen:', err?.message || err));
      });

    /* Kündigungsschaltfläche (Paragraf 312k BGB): im Konto und ohne Anmeldung.
     * Gilt unabhängig von BILLING_ENABLED, wie der Widerruf. */
    app.post('/api/billing/cancel', rateLimit({ route: 'cancel', max: 20, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
      const r = await cancelForUser(req.user, req.body || {});
      res.status(r.status).json(r.body);
    });

    app.post('/api/billing/cancel-public',
      rateLimit({ route: 'cancel-public', max: 5, windowMs: 60 * 60 * 1000 }),
      subnetLimit({ route: 'cancel-public', max: 20, windowMs: 60 * 60 * 1000 }),
      async (req, res) => {
        const name = String(req.body?.name || '').trim().slice(0, 160);
        const email = String(req.body?.email || '').trim().slice(0, 200);
        const orderNo = String(req.body?.orderNo || '').trim().slice(0, 20);
        if (name.length < 2 || !EMAIL_SHAPE.test(email)) {
          return res.status(400).json({ error: 'Bitte Name und E-Mail-Adresse angeben.', code: 'fields_required' });
        }
        const input = cancelInput(req.body || {});
        if (input.error) return res.status(400).json({ error: input.error, code: input.code });
        if (altcha?.configured) {
          const v = await altcha.verify(req.body?.altcha);
          if (!v.ok) return res.status(400).json({ error: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte noch einmal versuchen.', code: 'altcha_invalid' });
        }
        const receivedAt = new Date();
        res.json({ ok: true, receivedAt });
        cancelPublic({ name, email, orderNo, body: req.body || {} })
          .catch(err => console.error('billing: öffentliche Kündigung fehlgeschlagen:', err?.message || err));
      });

    /* Erklärungen, die Handarbeit brauchen, als erledigt markieren. */
    app.post('/api/admin/billing/declarations/:id/resolve', requireAuth, requireAdmin, async (req, res) => {
      if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Nicht gefunden.' });
      const note = String(req.body?.note || '').slice(0, 500) || null;
      const { rowCount } = await pool.query(
        `UPDATE declarations SET status = 'done', resolved_at = now(), note = coalesce($2, note) WHERE id = $1 AND status = 'manual'`,
        [req.params.id, note],
      );
      if (!rowCount) return res.status(404).json({ error: 'Nicht gefunden oder schon erledigt.' });
      res.json({ ok: true });
    });

    app.get('/api/admin/billing', requireAuth, requireAdmin, async (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await report());
    });
  }

  return {
    config: cfg, offer, checkout, syncOrder, applyPaid, withdraw, withdrawPublic, requestRefund, cancelForUser, cancelPublic,
    sendConfirmation, report, runJobs, startJobs, mount, orderSummary,
  };
}
