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
import { buildInvoiceHtml, buildCreditNoteHtml, buildTermsHtml, buildWithdrawalHtml } from './invoice.js';
import { legalVersions } from './consent.js';
import {
  tplOrderConfirmation, tplWithdrawalReceipt, tplWithdrawalLate, tplDeclarationUnmatched, tplRefundDone,
  tplCancellationReceipt, tplAdminDeclaration, berlinDate, berlinDateTime, legalValues,
  tplDeclarationConfirm, tplDeclarationReceivedPlain,
} from './mailtexts/index.js';
import { attachmentNames, legalLang } from './mailtexts/legal.js';
import { sendMail as defaultSend } from './mail.js';
import { planInfo, MAX_ACCESS_DAYS } from './access.js';
import { addGrant, revokeOrderGrant, capOrderGrant, planDetails } from './grants.js';

const DAY_MS = 86_400_000;
export const WITHDRAWAL_DAYS = 14;
export const CHECKOUT_REUSE_MINUTES = 10;

/** EU-Mitgliedstaaten (ISO 3166-1 alpha-2; Griechenland hier GR, nicht EL).
 *  Einzige Quelle für Server und Oberfläche: Die Bestellübersicht liest die
 *  Liste aus GET /api/billing/offer (countries), der Checkout prüft dagegen
 *  (P1, Prüfteam 10.10.2026). */
export const EU_COUNTRIES = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);
/** Schwellen in Cent. */
export const THRESHOLDS = {
  euAbroadCents: 1_000_000,       // 10.000 € (Paragraf 3a Abs. 5 UStG)
  euAbroadWarnCents: 800_000,     // Warnung ab 8.000 €
  smallBusinessPrevYearCents: 2_500_000,    // 25.000 € Vorjahr (Paragraf 19 UStG)
  smallBusinessCurrYearCents: 10_000_000,   // 100.000 € laufendes Jahr
};
/** P7: Standard für die automatische Sperre des Verkaufs ins EU-Ausland
 *  (9.000 €, mit 1.000 € Abstand zur gesetzlichen Schwelle). */
export const EU_B2C_STOP_DEFAULT_CENTS = 900_000;

/** P6: Nummer des Stornobelegs zu einer Rechnung. Eigener Kreis über das
 *  Suffix: Der Rechnungskreis bleibt lückenlos, jede Rechnung hat höchstens
 *  einen Storno. */
export const creditNoteNo = o => `${o.invoice_no}-S`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Bestellnummer: fortlaufender Teil plus fünf Zufallszeichen (Audit
// 10.10.2026, S3). Der Zufallsteil macht Nummern unratbar, damit die sofort
// wirksame öffentliche Kündigung (P4) nicht per Durchprobieren fremder
// Nummern auslösbar ist. Ältere Nummern ohne Zusatz bleiben gültig, laufen
// bei der öffentlichen Kündigung aber über den Bestätigungslink.
const ORDER_NO_RE = /^B-\d{6,9}(?:-[A-HJ-NP-Z2-9]{5})?$/;
const SUFFIX_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const orderSuffix = () => Array.from(crypto.randomBytes(5), b => SUFFIX_ABC[b & 31]).join('');
const unguessableOrderNo = no => /-[A-HJ-NP-Z2-9]{5}$/.test(no);
/* Name im öffentlichen Formular: Er steht im Wortlaut, und der geht an die
 * Bestelladresse. Ein Name braucht weder Adressen noch Markup — wer dort
 * einen Link unterbringen will, verschickt Phishing unter unserem Absender. */
const plainName = n => !/[<>]|:\/\/|www\./i.test(n) && ![...n].some(ch => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);
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
/** @param legal  Inhalt von legal-texts.json (Tests: null = keine Datei). */
export function billingConfig(env = process.env, legal = undefined) {
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
  const lv = legal === undefined ? legalVersions(env) : legalVersions(env, legal);
  const cfg = {
    enabled: truthy(env.BILLING_ENABLED),
    openRegistration: truthy(env.OPEN_REGISTRATION),
    // Gratis-Grenze (09.10.2026): ohne Pass ein PDF, eine Fassung, eine
    // Sprache; Word, Anschreiben, weitere Fassungen und Sprachen im Pass.
    // Greift nur zusammen mit einem verkaufsbereiten Dienst (cfg.ready), sonst
    // bleibt alles frei — so auch jede selbst gehostete Instanz.
    freeTierLimits: truthy(env.FREE_TIER_LIMITS),
    priceCents: envInt(env, 'PASS_PRICE_CENTS', 900, 100, 100_000),
    currency: 'EUR',
    days,
    sku: `pass${days}`,
    productName: String(env.PRODUCT_NAME || 'CV-Hub').trim().slice(0, 60),
    invoicePrefix: (String(env.INVOICE_PREFIX || 'CV').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12)) || 'CV',
    // P5: Fassung aus mailtexts/legal-texts.json; die Umgebung übersteuert nur.
    termsVersion: lv.terms,
    withdrawalVersion: lv.withdrawal,
    legalVersions: lv,
    // P7: Ab dieser Summe (Cent, Privatkunden im EU-Ausland, laufendes ODER
    // voriges Jahr) verkauft der Dienst nur noch nach Deutschland.
    euB2cStopCents: envInt(env, env.EU_B2C_STOP_CENTS !== undefined ? 'EU_B2C_STOP_CENTS' : 'EU_ABROAD_STOP_CENTS', EU_B2C_STOP_DEFAULT_CENTS, 0, THRESHOLDS.euAbroadCents),
    seller,
    base,
    webhookUrl: String(env.BILLING_WEBHOOK_URL || '').trim() || (base ? `${base}/pdfapi/api/billing/webhook` : null),
    // Nur echte Mollie-Schlüssel zählen (test_… / live_…). Ein Platzhalter wie
    // „HIER_EINTRAGEN“ in der Umgebung gilt als nicht gesetzt.
    mollieKey: /^(test|live)_[A-Za-z0-9]{20,}$/.test(String(env.MOLLIE_API_KEY || '').trim()) ? String(env.MOLLIE_API_KEY).trim() : '',
    mollieBase: String(env.MOLLIE_API_BASE || '').trim() || undefined,
    // Mindestens 32 Zeichen, sonst gilt der Schlüssel als nicht gesetzt (Platzhalter).
    altchaKey: String(env.ALTCHA_HMAC_KEY || '').trim().length >= 32 ? String(env.ALTCHA_HMAC_KEY).trim() : '',
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
/** Wie emailConfirmed in server.js: nur selbst registrierte Konten brauchen den Klick. */
const defaultEmailConfirmed = u => u?.signup_source !== 'self' || !!u?.email_confirmed_at;

/** Gültigkeit des Bestätigungslinks für öffentliche Erklärungen (H2, M1).
 *  Kündigung 14 Tage; Widerruf 5 Tage (P3, Prüfteam 10.10.2026): Danach
 *  bleiben dem Betreiber noch 9 Tage, um innerhalb der gesetzlichen 14 Tage ab
 *  Eingang zu erstatten (Paragraf 357 Abs. 1 BGB) — auch ohne Klick. */
export const DECLARATION_CONFIRM_DAYS = 14;
export const DECLARATION_CONFIRM_DAYS_WITHDRAWAL = 5;
export const confirmDaysFor = type => (type === 'withdrawal' ? DECLARATION_CONFIRM_DAYS_WITHDRAWAL : DECLARATION_CONFIRM_DAYS);

/**
 * Umsätze an Privatkunden im EU-Ausland (Land in der EU, nicht DE), netto
 * ohne Widerrufe, je Kalenderjahr in Berliner Zeit: laufendes und voriges
 * Jahr (Paragraf 3a Abs. 5 UStG). Gleiche Rechnung wie in report().
 */
export async function euAbroadTotals(pool, now = new Date()) {
  const curr = berlinYear(now);
  const prev = curr - 1;
  const { rows } = await pool.query(
    `SELECT extract(year FROM paid_at AT TIME ZONE 'Europe/Berlin')::int AS y,
            coalesce(sum(amount_cents) FILTER (WHERE status NOT IN ('withdrawn', 'refunded')), 0)::bigint AS cents
       FROM orders
      WHERE paid_at IS NOT NULL AND country <> 'DE' AND country = ANY($1::text[])
        AND paid_at >= make_timestamptz($2, 1, 1, 0, 0, 0, 'Europe/Berlin')
      GROUP BY 1`,
    [[...EU_COUNTRIES], prev],
  );
  const by = Object.fromEntries(rows.map(r => [r.y, Number(r.cents)]));
  return { currentYear: curr, previousYear: prev, currentYearCents: by[curr] || 0, previousYearCents: by[prev] || 0 };
}

export function createBilling({ pool, config = billingConfig(), mollie, renderPdf, send = defaultSend, log = console.log, emailConfirmed = defaultEmailConfirmed }) {
  const cfg = config;
  const pay = mollie || createMollie({ apiKey: cfg.mollieKey, base: cfg.mollieBase });

  /* ── P7: Verkaufssperre EU-Ausland ─────────────────────────────────────
   * Ab cfg.euB2cStopCents (Standard 9.000 €) im laufenden ODER vorigen Jahr
   * verkauft der Dienst nur noch nach Deutschland — 1.000 € vor der
   * gesetzlichen Schwelle von 10.000 €, ab der § 19 UStG im Ausland nicht mehr
   * schützt. Der Checkout rechnet jedes Mal neu; das Angebot (Länderliste der
   * Oberfläche) nutzt einen Stand von höchstens einer Minute. */
  let euCache = { at: 0, status: null };
  async function euAbroadStatus({ fresh = false } = {}) {
    if (!fresh && euCache.status && Date.now() - euCache.at < 60_000) return euCache.status;
    const t = await euAbroadTotals(pool);
    const max = Math.max(t.currentYearCents, t.previousYearCents);
    const status = {
      ...t,
      stopAtCents: cfg.euB2cStopCents,
      thresholdCents: THRESHOLDS.euAbroadCents,
      warnAtCents: THRESHOLDS.euAbroadWarnCents,
      paused: max >= cfg.euB2cStopCents,
      remainingToStopCents: Math.max(0, cfg.euB2cStopCents - max),
      remainingToThresholdCents: Math.max(0, THRESHOLDS.euAbroadCents - max),
    };
    euCache = { at: Date.now(), status };
    return status;
  }
  function saleCountries(paused) {
    return paused ? ['DE'] : ['DE', ...[...EU_COUNTRIES].filter(c => c !== 'DE').sort()];
  }

  function offer() {
    return {
      enabled: cfg.ready,
      openRegistration: cfg.openRegistration,
      // Die Oberfläche sperrt nur, wenn hier limited: true steht. Durchsetzen
      // lässt sich das nicht (Word entsteht im Browser, der Code ist offen),
      // es ist eine Angebotsgrenze, keine Sicherheitsgrenze.
      freeTier: { limited: cfg.ready && cfg.freeTierLimits === true },
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
      // P1/P7: Länder, in die gerade verkauft wird — die Oberfläche hat keine eigene Liste.
      countries: saleCountries(!!euCache.status?.paused),
      euAbroadPaused: !!euCache.status?.paused,
    };
  }
  /** Angebot mit frischem Stand der EU-Sperre (höchstens eine Minute alt). */
  async function offerFresh() {
    try { await euAbroadStatus(); } catch (err) { log(`billing: EU-Auslandsumsatz nicht gelesen (${err?.message || err})`); }
    return offer();
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
      // P6: Nach einem Widerruf gibt es einen eigenen Stornobeleg (Nummer = Rechnungsnummer + „-S“).
      creditNoteNo: (o.status === 'withdrawn' || o.status === 'refunded') && o.invoice_no ? creditNoteNo(o) : null,
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

  /* ── P6: Rechnung einfrieren, Storno als eigener Beleg (GoBD, § 14b UStG) ──
   * Das PDF entsteht einmal — bei der Bestellbestätigung, bei Bestand beim
   * ersten Abruf — und liegt dann unverändert in invoice_documents. Jeder
   * spätere Abruf liefert genau diese Bytes, auch wenn sich SELLER_* oder der
   * Status der Bestellung ändern. Beim Einfrieren nach einem Widerruf wird die
   * Rechnung so erzeugt, wie sie ausgestellt war (ohne Widerrufsvermerk); der
   * Widerruf steht im Stornobeleg. */
  const sha256Hex = buf => crypto.createHash('sha256').update(buf).digest('hex');
  async function storedDoc(orderId, kind) {
    const { rows } = await pool.query('SELECT doc_no, issued_at, pdf, sha256 FROM invoice_documents WHERE order_id = $1 AND kind = $2', [orderId, kind]);
    return rows[0] || null;
  }
  async function storeDoc(order, kind, docNo, issuedAt, html) {
    const pdf = Buffer.from(await renderPdf(html));
    const { rowCount } = await pool.query(
      `INSERT INTO invoice_documents (id, order_id, kind, doc_no, issued_at, pdf, sha256)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (order_id, kind) DO NOTHING`,
      [crypto.randomUUID(), order.id, kind, docNo, issuedAt, pdf, sha256Hex(pdf)],
    );
    if (rowCount) log(`billing: ${kind === 'storno' ? 'Stornobeleg' : 'Rechnung'} ${docNo} gespeichert`);
    // Bei gleichzeitigem Erzeugen gewinnt der erste; alle liefern dessen Bytes.
    return storedDoc(order.id, kind);
  }
  /** Rechnungs-PDF, wie es ausgestellt wurde. Wirft, wenn es keine Rechnung gibt. */
  async function invoicePdf(order) {
    if (!order?.invoice_no) throw new Error('keine Rechnung');
    const have = await storedDoc(order.id, 'invoice');
    if (have) return Buffer.from(have.pdf);
    const asIssued = { ...order, status: 'paid' };
    const doc = await storeDoc(order, 'invoice', order.invoice_no, order.paid_at,
      buildInvoiceHtml({ order: asIssued, seller: cfg.seller, productName: cfg.productName }));
    return Buffer.from(doc.pdf);
  }
  /** Stornobeleg nach Widerruf (null, wenn die Bestellung nicht widerrufen ist). */
  async function creditNotePdf(order) {
    if (!order?.invoice_no || !['withdrawn', 'refunded'].includes(order.status)) return null;
    const have = await storedDoc(order.id, 'storno');
    if (have) return Buffer.from(have.pdf);
    // Erst die Rechnung einfrieren (falls noch nicht geschehen), dann den Storno dazu.
    await invoicePdf(order);
    const no = creditNoteNo(order);
    const issuedAt = new Date();
    const doc = await storeDoc(order, 'storno', no, issuedAt,
      buildCreditNoteHtml({ order, seller: cfg.seller, productName: cfg.productName, creditNoteNo: no, issuedAt }));
    return Buffer.from(doc.pdf);
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
      if (st === 'refunded') {
        // P6: Stornobeleg als Anhang, wenn er sich erzeugen lässt (sonst ohne).
        let attachments;
        try {
          const pdf = await creditNotePdf(rows[0]);
          if (pdf) attachments = [{ filename: `Stornobeleg-${creditNoteNo(rows[0])}.pdf`, content: pdf, contentType: 'application/pdf' }];
        } catch (err) { log(`billing: Stornobeleg ${o.id} nicht erstellt (${err?.message || err})`); }
        await send({ to: rows[0].email, ...tplRefundDone({ order: rows[0], seller: cfg.seller, productName: cfg.productName, base: cfg.base }), ...(attachments ? { attachments } : {}) }).catch(() => false);
      }
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
    /* N3: Zahlung zu einer Bestellung, deren Konto inzwischen gelöscht ist.
     * Bezahlt ist bezahlt (Rechnung, Bestätigung gehen raus) — aber niemand
     * kann den Pass nutzen. Der Betreiber erstattet von Hand. */
    if (newlyPaid && !order.user_id) {
      await notifyAdmin({ type: 'payment', reason: 'Zahlung für ein gelöschtes Konto eingegangen — bitte erstatten', statement: `Bestellung ${order.order_no}: Zahlung eingegangen, das Konto wurde vorher gelöscht.`, receivedAt: new Date(), orderNos: [order.order_no] });
    }
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
    /* P1 (Prüfteam 10.10.2026, Befund S1): Verkauft wird nur in die EU-27 —
     * an Privatkunden in der EU und an Unternehmen in Deutschland. Bisher
     * begrenzte nur die Oberfläche; ein Aufruf der API aus dem Vereinigten
     * Königreich oder der Schweiz hätte dort Umsatzsteuerpflichten ausgelöst. */
    if (!EU_COUNTRIES.has(country)) return { status: 400, body: { error: 'Aus diesem Land können wir den Pass derzeit nicht verkaufen.', code: 'country_not_available' } };
    if (country !== 'DE' && body?.consumer !== true) return { status: 400, body: { error: 'Aus dem Ausland verkaufen wir nur an Privatpersonen. Bitte bestätige, dass du privat kaufst.', code: 'consumer_required' } };
    if (billingName.length < 2 || billingName.length > 120) return { status: 400, body: { error: 'Bitte den Namen für die Rechnung angeben (2 bis 120 Zeichen).', code: 'name_invalid' } };
    if (body?.acceptTerms !== true) return { status: 400, body: { error: 'Bitte AGB und Widerrufsbelehrung bestätigen.', code: 'terms_required' } };
    if (body?.ageConfirmed18 !== true) return { status: 400, body: { error: 'Der Kauf ist erst ab 18 Jahren möglich. Bitte bestätige dein Alter.', code: 'age18_required' } };
    if (!user.email) return { status: 400, body: { error: 'Bitte hinterlege zuerst eine E-Mail-Adresse im Konto — dorthin gehen Rechnung und Bestätigung.', code: 'email_required' } };
    /* N1 (09.10.2026): Kauf nur mit bestätigter Adresse. Sonst gehen Rechnung,
     * Widerrufsbelehrung und später der Bestätigungslink für einen Widerruf an
     * ein Postfach, von dem niemand weiß, wem es gehört. */
    if (!emailConfirmed(user)) return { status: 403, body: { error: 'Bitte bestätige zuerst deine E-Mail-Adresse. Den Link haben wir dir geschickt; dorthin gehen auch Rechnung und Bestätigung.', code: 'email_unconfirmed' } };
    const plan = planInfo(user);
    if (plan?.kind === 'unlimited') {
      return { status: 409, body: { error: 'Dein Konto ist unbegrenzt freigeschaltet. Du brauchst keinen Pass.', code: 'plan_unlimited' } };
    }
    if (plan?.kind === 'lifetime') {
      return { status: 409, body: { error: 'Dein dauerhafter Gratiszugang ist aktiv. Du musst keinen Bewerbungs-Pass kaufen.', code: 'plan_lifetime' } };
    }
    /* P7: Verkauf ins EU-Ausland ruht ab der Schwelle (frisch gerechnet). */
    if (country !== 'DE') {
      const eu = await euAbroadStatus({ fresh: true });
      if (eu.paused) {
        log('billing: Kauf aus dem EU-Ausland abgelehnt (Umsatzschwelle erreicht)');
        return { status: 400, body: { error: 'Aus diesem Land können wir den Pass derzeit nicht verkaufen.', code: 'country_not_available', reason: 'eu_abroad_paused' } };
      }
    }
    // Häkchen „Kauf als Privatperson“ (P1): mit der Bestellung gespeichert.
    const consumerConfirmed = body?.consumer === true;

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
      const orderNo = `${nr[0].no}-${orderSuffix()}`;
      const locale = mollieLocale(lang);
      await client.query(
        `INSERT INTO orders (id, order_no, user_id, email, billing_name, country, sku, amount_cents, currency, status,
                             locale, terms_version, withdrawal_version, age_confirmed_18, pass_days, consumer_confirmed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'open', $10, $11, $12, true, $13, $14)`,
        [id, orderNo, user.id, String(user.email).toLowerCase(), billingName, country, cfg.sku, cfg.priceCents, cfg.currency,
          locale, cfg.termsVersion, cfg.withdrawalVersion, cfg.days, consumerConfirmed],
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

  async function recordDeclaration({ type, channel, name, email, orderNo, userId, orderIds = [], receivedAt, statement, status, note, confirmTokenHash = null, confirmExpiresAt = null, request = null }) {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO declarations (id, type, channel, name, email, order_no, user_id, order_ids, received_at, statement, status, note,
                                 confirm_token_hash, confirm_expires_at, request)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid[], $9, $10, $11, $12, $13, $14, $15)`,
      [id, type, channel, name || null, email ? String(email).toLowerCase() : null, orderNo || null, userId || null, orderIds, receivedAt, statement, status, note || null,
        confirmTokenHash, confirmExpiresAt, request ? JSON.stringify(request) : null],
    );
    return id;
  }

  /* ── Bestätigungslink für öffentliche Erklärungen (H2, M1, M4) ──────────
   *
   * Befund vom 09.10.2026: Der öffentliche Widerruf und die öffentliche
   * Kündigung brauchten nur die E-Mail-Adresse der Bestellung. Wer sie kannte,
   * beendete fremde bezahlte Pässe (Kündigung „sofort“) oder löste Erstattung
   * und Pass-Ende aus (Widerruf). Bestellnummern sind fortlaufend, also kein
   * Geheimnis.
   *
   * Jetzt: Der Eingang wird sofort gespeichert und an die Bestelladresse
   * bestätigt — mit Inhalt, Datum, Uhrzeit (Eingangsbestätigung) und einem
   * Link. Ausgeführt wird erst nach dem Klick. Für die Rechtzeitigkeit zählt
   * der Eingang. Unbestätigte Erklärungen meldet der Hintergrundlauf nach 14
   * Tagen dem Betreiber; automatisch ausgeführt wird nichts.
   *
   * Nicht zuzuordnende Erklärungen bekommen höchstens einen festen Text ohne
   * jede Eingabe des Absenders (M4: sonst ein Mail-Relay für beliebigen Text
   * an beliebige Adressen). Den Wortlaut sieht nur der Betreiber. */
  const tokenHash = tk => crypto.createHash('sha256').update(String(tk)).digest('hex');
  function newConfirmToken(type) {
    const token = crypto.randomBytes(32).toString('base64url');   // 256 Bit
    return { token, hash: tokenHash(token), expiresAt: new Date(Date.now() + confirmDaysFor(type) * DAY_MS) };
  }
  function confirmUrl(type, token) {
    if (!cfg.base) return null;
    const path = type === 'withdrawal' ? '/widerruf/bestaetigen' : '/kuendigen/bestaetigen';
    return `${cfg.base}${path}?token=${encodeURIComponent(token)}`;
  }

  /* P2 (§ 356a Abs. 4 BGB): Die Eingangsbestätigung nennt den Inhalt der
   * Erklärung — Name, angegebene Bestellnummer, Adresse. Die Vorlage prüft
   * und filtert die Angaben selbst (M4: kein freier Text an fremde Adressen). */
  async function sendPlainReceipt(type, email, receivedAt, extra = {}) {
    const to = String(email).trim();
    await send({ to, ...tplDeclarationReceivedPlain({ type, receivedAt, email: to, name: extra.name ?? null, orderNo: extra.orderNo ?? null }) }).catch(() => false);
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
  async function withdraw(orderId, { channel, declared = {}, receivedAt: givenReceivedAt = null, statement: givenStatement = null, declarationId = null }) {
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
      /* Für die Frist zählt der Eingang der Erklärung (H2/M1: beim öffentlichen
       * Weg der Eingang des Formulars, nicht der spätere Klick auf den Link). */
      receivedAt = givenReceivedAt ? new Date(givenReceivedAt) : new Date();
      if (receivedAt.getTime() >= withdrawableUntil(o.paid_at).getTime()) {
        await client.query('ROLLBACK');
        return { result: 'late', order: o, receivedAt };
      }
      statement = givenStatement || withdrawalStatement({ o, name: declared.name, email: declared.email, receivedAt, channel });
      await client.query(
        `UPDATE orders SET status = 'withdrawn', withdrawn_at = $2, withdraw_channel = $3, withdraw_statement = $4,
                refund_status = 'requested', updated_at = now()
          WHERE id = $1`,
        [o.id, receivedAt, channel, statement],
      );
      // Laufzeit endet jetzt (nicht rückwirkend zum Eingang): bis zum Klick durfte der Pass laufen.
      await revokeOrderGrant(client, o, { at: givenReceivedAt ? new Date() : receivedAt, reason: 'withdrawal', log });
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
    log(`billing: Bestellung ${o.id} widerrufen (${channel})`);
    // P6: Stornobeleg gleich ausstellen (nebenher; scheitert es, entsteht er beim ersten Abruf).
    loadOrder(o.id).then(cur => creditNotePdf(cur)).catch(err => log(`billing: Stornobeleg ${o.id} nicht erstellt (${err?.message || err})`));
    if (!declarationId) {
      await recordDeclaration({
        type: 'withdrawal', channel, name: declared.name || o.billing_name, email: declared.email || o.email, orderNo: o.order_no,
        userId: o.user_id, orderIds: [o.id], receivedAt, statement, status: 'processed',
      }).catch(err => log(`billing: Erklärung nicht gespeichert (${err?.message || err})`));
    }
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
   * für jeden Ausgang gleich. Zugeordnet wird nur, wenn die eingegebene
   * Adresse die der Bestellung ist; nur dann gibt es eine Mail mit Inhalt —
   * an die Bestelladresse — und einen Bestätigungslink. Ausgeführt wird erst
   * mit confirmDeclaration().
   *
   * Zuordnung: Bestellnummer + Adresse; ohne Nummer die eine bezahlte, noch
   * widerrufbare Bestellung dieser Adresse. Mehrere Treffer, keine Treffer
   * oder eine abweichende Adresse: gespeichert und dem Betreiber gemeldet —
   * eine Widerrufserklärung ist auch ohne Abgleich wirksam.
   *
   * @returns { matched, pending?, result? }
   */
  async function withdrawPublic({ name, email, orderNo, receivedAt: at = null }) {
    const no = String(orderNo || '').trim().toUpperCase();
    const mail = norm(email);
    const receivedAt = at ? new Date(at) : new Date();
    let candidates = [];
    if (no) {
      if (ORDER_NO_RE.test(no)) {
        const { rows } = await pool.query('SELECT * FROM orders WHERE order_no = $1', [no]);
        candidates = rows.filter(o => norm(o.email) === mail);
      }
    } else {
      const { rows } = await pool.query(`SELECT * FROM orders WHERE lower(email) = $1 AND status = 'paid' ORDER BY paid_at DESC`, [mail]);
      candidates = rows.filter(o => receivedAt.getTime() < withdrawableUntil(o.paid_at).getTime());
    }
    if (candidates.length === 1 && candidates[0].status === 'paid') {
      const o = candidates[0];
      const statement = withdrawalStatement({ o, name, email, receivedAt, channel: 'public' });
      if (receivedAt.getTime() >= withdrawableUntil(o.paid_at).getTime()) {
        // Nach Fristende: nichts auszuführen, also kein Link. Eingang an die Bestelladresse, Betreiber entscheidet.
        await recordDeclaration({ type: 'withdrawal', channel: 'public', name, email, orderNo: o.order_no, userId: o.user_id, orderIds: [o.id], receivedAt, statement, status: 'manual', note: 'nach Fristende' });
        await send({ to: o.email, ...tplWithdrawalLate({ order: o, statement, receivedAt, base: cfg.base }) }).catch(() => false);
        await notifyAdmin({ type: 'withdrawal', reason: 'Widerruf nach Fristende', statement, receivedAt, orderNos: [o.order_no] });
        return { matched: true, result: 'late' };
      }
      const t = newConfirmToken('withdrawal');
      await recordDeclaration({
        type: 'withdrawal', channel: 'public', name, email, orderNo: o.order_no, userId: o.user_id, orderIds: [o.id], receivedAt, statement,
        status: 'pending_confirmation', confirmTokenHash: t.hash, confirmExpiresAt: t.expiresAt, request: { name, email },
      });
      const url = confirmUrl('withdrawal', t.token);
      /* P3: Der Betreiber erfährt sofort davon, auch wenn niemand klickt —
       * die Erstattungsfrist läuft ab Eingang. */
      await notifyAdmin({
        type: 'withdrawal',
        reason: url
          ? `öffentlicher Widerruf eingegangen, offen und unbestätigt (Link ${DECLARATION_CONFIRM_DAYS_WITHDRAWAL} Tage); Erstattung spätestens 14 Tage nach Eingang, auch ohne Klick`
          : 'Bestätigungslink nicht verschickt (PUBLIC_BASE_URL fehlt)',
        statement, receivedAt, orderNos: [o.order_no],
      });
      if (!url) log('billing: öffentlicher Widerruf ohne PUBLIC_BASE_URL — kein Bestätigungslink, Betreiber informiert');
      // An die Adresse der Bestellung, nicht an die eingegebene (sie sind gleich — aber so steht es im Code).
      await send({ to: o.email, ...tplDeclarationConfirm({ type: 'withdrawal', orders: [o], statement, receivedAt, url, expiresAt: t.expiresAt }) }).catch(() => false);
      log(`billing: öffentlicher Widerruf für ${o.id} eingegangen, wartet auf Bestätigung`);
      return { matched: true, pending: true };
    }
    const statement = withdrawalStatement({ o: null, name, email, orderNo: no, receivedAt, channel: 'public' });
    const already = candidates.length === 1 && ['withdrawn', 'refunded'].includes(candidates[0].status);
    const note = already ? 'Bestellung schon widerrufen' : candidates.length > 1 ? 'mehrere Bestellungen' : candidates.length === 1 ? `Bestellung nicht widerrufbar (${candidates[0].status})` : 'nicht zugeordnet';
    await recordDeclaration({
      type: 'withdrawal', channel: 'public', name, email, orderNo: no || null, userId: candidates.length === 1 ? candidates[0].user_id : null,
      orderIds: candidates.map(o => o.id), receivedAt, statement, status: already ? 'done' : 'manual', note,
    });
    // Feste Vorlage, Angaben nur geprüft (M4, P2). Der Wortlaut geht nur an den Betreiber.
    await sendPlainReceipt('withdrawal', email, receivedAt, { name, orderNo: no || null });
    if (already) await notifyAdmin({ type: 'withdrawal', reason: 'öffentlicher Widerruf zu einer schon widerrufenen Bestellung eingegangen (nur zur Kenntnis)', statement, receivedAt, orderNos: candidates.map(o => o.order_no) });
    else await notifyAdmin({ type: 'withdrawal', reason: candidates.length > 1 ? 'mehrere passende Bestellungen' : candidates.length === 1 ? note : 'keine Bestellung zuzuordnen', statement, receivedAt, orderNos: candidates.map(o => o.order_no) });
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

  async function finishCancellation({ orders, done, input, name, email, channel, receivedAt, userId, orderNo, declarationId = null, statement: givenStatement = null }) {
    const effectiveAt = done.length ? new Date(Math.max(...done.map(d => new Date(d.effectiveAt).getTime()))) : null;
    const statement = givenStatement || cancellationStatement({ orders, name, email, ...input, effectiveAt, receivedAt, channel, orderNo });
    const manual = input.kind === 'extraordinary' || !done.length;
    const status = manual ? 'manual' : 'processed';
    const note = !done.length ? 'nicht zugeordnet' : input.kind === 'extraordinary' ? 'außerordentlich: Erstattung prüfen' : null;
    if (declarationId) {
      await pool.query(`UPDATE declarations SET status = $2, note = coalesce($3, note) WHERE id = $1`, [declarationId, status, note]);
    } else {
      await recordDeclaration({
        type: 'cancellation', channel, name, email, orderNo: orders.map(o => o.order_no).join(',') || orderNo || null, userId,
        orderIds: orders.map(o => o.id), receivedAt, statement, status, note,
      });
    }
    if (done.length) {
      // Bestätigung an die Adresse der Bestellung (beim öffentlichen Weg ist es dieselbe wie eingegeben).
      const to = channel === 'public' ? done[0].order.email : email;
      await send({ to, ...tplCancellationReceipt({ order: done[0].order, receivedAt, kind: input.kind, reason: input.reason, effectiveAt, email: to, seller: cfg.seller, productName: cfg.productName, base: cfg.base, statement }) }).catch(() => false);
    } else if (channel === 'public') {
      await sendPlainReceipt('cancellation', email, receivedAt, { name, orderNo: orderNo || null });
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

  /** Kündigung ohne Anmeldung. Gleiche Antwort für jeden Ausgang. Zugeordnet
   *  nur, wenn die eingegebene Adresse die der Bestellung ist.
   *
   *  P4 (Prüfteam 10.10.2026, BGH I ZR 161/24 „unmittelbar“): Passen
   *  Bestellnummer UND Adresse zu einer laufenden Bestellung, wirkt die
   *  Kündigung sofort, ohne Klick; die Mail an die Bestelladresse bestätigt
   *  nur. Ohne Bestellnummer bleibt der Bestätigungslink (H2): Die Adresse
   *  allein ist kein Nachweis, dass die Erklärung vom Kunden kommt.
   *  Abwägung und Grenzen: SICHERHEIT.md, Abschnitt Runde 8b. */
  async function cancelPublic({ name, email, orderNo, body, receivedAt: at = null }) {
    const input = cancelInput(body);
    const receivedAt = at ? new Date(at) : new Date();
    const mail = norm(email);
    const no = String(orderNo || '').trim().toUpperCase();
    let orders = [];
    if (no) {
      if (ORDER_NO_RE.test(no)) {
        const { rows } = await pool.query(`SELECT * FROM orders WHERE order_no = $1 AND status = 'paid' AND cancelled_at IS NULL`, [no]);
        orders = rows.filter(o => norm(o.email) === mail);
      }
    } else {
      const { rows } = await pool.query(`SELECT * FROM orders WHERE lower(email) = $1 AND status = 'paid' AND cancelled_at IS NULL AND pass_until > now()`, [mail]);
      orders = rows;
    }
    if (!orders.length) {
      await finishCancellation({ orders, done: [], input, name, email: String(email).trim(), channel: 'public', receivedAt, userId: null, orderNo: no });
      return { matched: false };
    }
    if (no && unguessableOrderNo(no)) {
      // P4: Bestellnummer und Adresse passen — sofort ausführen.
      const done = await applyCancellation(orders.map(o => o.id), { ...input, channel: 'public', receivedAt });
      const { statement } = await finishCancellation({ orders, done, input, name, email: String(email).trim(), channel: 'public', receivedAt, userId: orders[0].user_id, orderNo: no });
      // Außerordentliche Kündigungen meldet finishCancellation schon (Handarbeit); sonst zur Kenntnis.
      if (input.kind !== 'extraordinary') await notifyAdmin({ type: 'cancellation', reason: 'öffentliche Kündigung mit Bestellnummer sofort ausgeführt (nur zur Kenntnis)', statement, receivedAt, orderNos: orders.map(o => o.order_no) });
      log(`billing: öffentliche Kündigung für ${done.length} Bestellung(en) sofort ausgeführt (Bestellnummer und Adresse passen)`);
      return { matched: true, pending: false };
    }
    // Vorschau des Beendigungszeitpunkts für den Wortlaut — gerechnet ab dem Eingang, wie später bei der Ausführung.
    const preview = new Date(Math.max(...orders.map(o => cancelEffective(o, input.when, input.date, receivedAt.getTime()).getTime())));
    const statement = cancellationStatement({ orders, name, email, ...input, effectiveAt: preview, receivedAt, channel: 'public', orderNo: no });
    const t = newConfirmToken('cancellation');
    await recordDeclaration({
      type: 'cancellation', channel: 'public', name, email, orderNo: orders.map(o => o.order_no).join(','), userId: orders[0].user_id,
      orderIds: orders.map(o => o.id), receivedAt, statement, status: 'pending_confirmation',
      confirmTokenHash: t.hash, confirmExpiresAt: t.expiresAt,
      request: { name, email, kind: input.kind, reason: input.reason, when: input.when, date: input.date },
    });
    const url = confirmUrl('cancellation', t.token);
    // P3: Betreiber sofort informieren, auch solange die Kündigung unbestätigt ist.
    await notifyAdmin({
      type: 'cancellation',
      reason: url ? `öffentliche Kündigung ohne Bestellnummer eingegangen, offen und unbestätigt (Link ${DECLARATION_CONFIRM_DAYS} Tage)` : 'Bestätigungslink nicht verschickt (PUBLIC_BASE_URL fehlt)',
      statement, receivedAt, orderNos: orders.map(o => o.order_no),
    });
    await send({ to: orders[0].email, ...tplDeclarationConfirm({ type: 'cancellation', orders, statement, receivedAt, url, expiresAt: t.expiresAt }) }).catch(() => false);
    log(`billing: öffentliche Kündigung für ${orders.length} Bestellung(en) eingegangen, wartet auf Bestätigung`);
    return { matched: true, pending: true };
  }

  /**
   * Klick auf den Link aus der Eingangsbestätigung: führt die Erklärung aus.
   * Einmalig, gültig 5 Tage (Widerruf) bzw. 14 Tage (Kündigung). Für Frist und Wirkzeitpunkt zählt der Eingang.
   * @returns { status, body }
   */
  async function confirmDeclaration(token) {
    const tk = String(token || '').trim();
    const invalid = { status: 400, body: { error: 'Dieser Bestätigungslink ist ungültig.', code: 'token_invalid' } };
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(tk)) return invalid;
    const hash = tokenHash(tk);
    // Den Link genau einmal verbrauchen — zwei gleichzeitige Klicks führen nicht zweimal aus.
    const { rows } = await pool.query(
      `UPDATE declarations SET confirmed_at = now()
        WHERE confirm_token_hash = $1 AND confirmed_at IS NULL AND status = 'pending_confirmation' AND confirm_expires_at > now()
        RETURNING *`,
      [hash],
    );
    const d = rows[0];
    if (!d) {
      const { rows: any } = await pool.query('SELECT * FROM declarations WHERE confirm_token_hash = $1', [hash]);
      const x = any[0];
      if (!x) return invalid;
      const kind = x.type === 'withdrawal' ? 'withdraw' : 'cancel';
      if (x.confirmed_at) {
        return { status: 409, body: { error: 'Diese Erklärung ist schon bestätigt.', code: 'token_used', kind, orderNo: firstNo(x.order_no), receivedAt: x.received_at, ...(x.result || {}) } };
      }
      return { status: 410, body: { error: 'Dieser Bestätigungslink ist abgelaufen. Deine Erklärung ist trotzdem bei uns eingegangen; wir melden uns. Du kannst sie auch noch einmal abschicken.', code: 'token_expired', kind, orderNo: firstNo(x.order_no), receivedAt: x.received_at } };
    }
    const req = d.request || {};
    const receivedAt = new Date(d.received_at);
    if (d.type === 'withdrawal') {
      const orderId = d.order_ids?.[0];
      const r = orderId ? await withdraw(orderId, { channel: 'public', declared: { name: req.name, email: req.email }, receivedAt, statement: d.statement, declarationId: d.id }) : { result: 'missing' };
      if (r.result === 'done' || r.result === 'already') {
        const result = { effectiveAt: r.receivedAt || receivedAt, refund: { status: r.refundStatus || 'requested' }, ...(r.result === 'already' ? { already: true } : {}) };
        await pool.query(`UPDATE declarations SET status = 'processed', result = $2 WHERE id = $1`, [d.id, JSON.stringify(result)]);
        return { status: 200, body: { ok: true, kind: 'withdraw', orderNo: r.order?.order_no || firstNo(d.order_no), receivedAt, ...result } };
      }
      const why = r.result === 'late' ? 'nach Fristende' : r.result === 'not_paid' ? 'Bestellung nicht mehr bezahlt' : 'Bestellung nicht gefunden';
      await pool.query(`UPDATE declarations SET status = 'manual', note = $2 WHERE id = $1`, [d.id, `bestätigt, aber nicht ausführbar: ${why}`]);
      await notifyAdmin({ type: 'withdrawal', reason: `bestätigter Widerruf nicht ausführbar (${why})`, statement: d.statement, receivedAt, orderNos: [firstNo(d.order_no)].filter(Boolean) });
      return { status: 409, body: { error: 'Der Widerruf lässt sich nicht automatisch ausführen. Er ist bei uns eingegangen; wir melden uns innerhalb von zwei Werktagen.', code: 'not_withdrawable', kind: 'withdraw', orderNo: firstNo(d.order_no), receivedAt } };
    }
    // Kündigung
    const input = cancelInput(req);
    if (input.error) return invalid;   // kann nicht vorkommen: beim Eingang geprüft
    const { rows: orders } = await pool.query('SELECT * FROM orders WHERE id = ANY($1::uuid[])', [d.order_ids || []]);
    const paid = orders.filter(o => o.status === 'paid');
    const done = paid.length ? await applyCancellation(paid.map(o => o.id), { ...input, channel: 'public', receivedAt }) : [];
    const { effectiveAt } = await finishCancellation({ orders: paid, done, input, name: req.name, email: req.email, channel: 'public', receivedAt, userId: d.user_id, declarationId: d.id, statement: d.statement });
    const result = { effectiveAt, orderNos: done.map(x => x.order.order_no) };
    await pool.query('UPDATE declarations SET result = $2 WHERE id = $1', [d.id, JSON.stringify(result)]);
    return { status: 200, body: { ok: true, kind: 'cancel', orderNo: done[0]?.order.order_no || firstNo(d.order_no), receivedAt, ...result } };
  }
  const firstNo = s => String(s || '').split(',')[0] || null;

  /** Öffentliche Erklärungen, deren Link nicht rechtzeitig geklickt wurde
   *  (Widerruf 5, Kündigung 14 Tage): an den Betreiber, nicht ausführen. */
  async function escalateUnconfirmed() {
    const { rows } = await pool.query(
      `UPDATE declarations
          SET status = 'manual',
              note = CASE WHEN type = 'withdrawal' THEN 'nicht bestätigt (Link ${DECLARATION_CONFIRM_DAYS_WITHDRAWAL} Tage ungeklickt)'
                          ELSE 'nicht bestätigt (Link ${DECLARATION_CONFIRM_DAYS} Tage ungeklickt)' END
        WHERE status = 'pending_confirmation' AND confirm_expires_at <= now()
        RETURNING id, type, order_no, received_at, statement`,
    );
    for (const d of rows) {
      const why = d.type === 'withdrawal'
        ? `öffentlicher Widerruf ${DECLARATION_CONFIRM_DAYS_WITHDRAWAL} Tage unbestätigt — nicht ausgeführt. Bitte entscheiden: Erstattung spätestens 14 Tage nach Eingang`
        : `öffentliche Kündigung ${DECLARATION_CONFIRM_DAYS} Tage unbestätigt — nicht ausgeführt, bitte entscheiden`;
      await notifyAdmin({ type: d.type, reason: why, statement: d.statement, receivedAt: d.received_at, orderNos: String(d.order_no || '').split(',').filter(Boolean) });
    }
    return rows.length;
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
    const { rows: awaiting } = await pool.query(`SELECT count(*)::int AS n FROM declarations WHERE status = 'pending_confirmation'`);
    const warnings = [];
    if (euMax >= THRESHOLDS.euAbroadCents) warnings.push({ code: 'eu_threshold_exceeded', text: 'Umsätze an Privatkunden im EU-Ausland über 10.000 € (Vorjahr oder laufendes Jahr): Ab dem überschreitenden Umsatz gilt die Umsatzsteuer des Kundenlands (§ 3a Abs. 5 UStG), § 19 UStG schützt dort nicht. OSS-Registrierung beim BZSt prüfen, Steuerberatung einschalten.' });
    else if (euMax >= THRESHOLDS.euAbroadWarnCents) warnings.push({ code: 'eu_threshold_near', text: 'Umsätze an Privatkunden im EU-Ausland über 8.000 €: Die Schwelle von 10.000 € (§ 3a Abs. 5 UStG, Vorjahr und laufendes Jahr) rückt näher.' });
    if (euMax >= cfg.euB2cStopCents) warnings.push({ code: 'eu_abroad_paused', text: `Verkauf ins EU-Ausland automatisch gesperrt: Die Umsätze dort haben ${(cfg.euB2cStopCents / 100).toLocaleString('de-DE')} € erreicht (EU_B2C_STOP_CENTS). Verkauf nach Deutschland läuft weiter.` });
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
        stopAtCents: cfg.euB2cStopCents, paused: euMax >= cfg.euB2cStopCents,
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
      // Öffentliche Erklärungen, deren Bestätigungslink noch nicht geklickt wurde (H2/M1).
      declarationsAwaitingConfirmation: awaiting[0].n,
      warnings,
      testMode: !!pay.isTestMode,
      config: { ready: cfg.ready, missing: cfg.missing },
    };
  }

  /* ── Hintergrundlauf ──────────────────────────────────────────────── */

  /** Holt nach, was beim ersten Mal nicht ging: Bestellbestätigungen,
   *  Erstattungen, Erstattungsstände, offene Zahlungen ohne Webhook. */
  async function runJobs({ onlyDeclarations = false } = {}) {
    const out = { confirmations: 0, refunds: 0, refundChecks: 0, syncs: 0, unconfirmedDeclarations: 0 };
    out.unconfirmedDeclarations = await escalateUnconfirmed();
    if (onlyDeclarations) return out;
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

  function startJobs({ everyMs = 10 * 60 * 1000, onlyDeclarations = false } = {}) {
    const tick = () => runJobs({ onlyDeclarations })
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

    app.get('/api/billing/offer', async (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await offerFresh());
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

    /* P6: Stornobeleg nach Widerruf, eigener Beleg neben der unveränderten Rechnung. */
    app.get('/api/billing/orders/:id/credit-note.pdf', rateLimit({ route: 'invoice', max: 30, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
      const o = await ownOrder(req, res);
      if (!o) return;
      if (!o.invoice_no || !['withdrawn', 'refunded'].includes(o.status)) return res.status(404).json({ error: 'Für diese Bestellung gibt es keinen Stornobeleg.' });
      try {
        const pdf = await creditNotePdf(o);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Disposition', `attachment; filename="Stornobeleg-${creditNoteNo(o)}.pdf"`);
        res.send(pdf);
      } catch (err) {
        log(`billing: Stornobeleg ${o.id} nicht erstellt (${err?.message || err})`);
        res.status(503).json({ error: 'Der Stornobeleg lässt sich gerade nicht erstellen. Bitte gleich noch einmal versuchen.' });
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
        if (name.length < 2 || !EMAIL_SHAPE.test(email) || !plainName(name)) {
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
        withdrawPublic({ name, email, orderNo, receivedAt })
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
        if (name.length < 2 || !EMAIL_SHAPE.test(email) || !plainName(name)) {
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
        cancelPublic({ name, email, orderNo, body: req.body || {}, receivedAt })
          .catch(err => console.error('billing: öffentliche Kündigung fehlgeschlagen:', err?.message || err));
      });

    /* Klick auf den Link aus der Eingangsbestätigung (H2, M1). Ohne Anmeldung —
     * der Token ist die Berechtigung. Die Seite dazu liegt in der App unter
     * /widerruf/bestaetigen bzw. /kuendigen/bestaetigen und schickt nur den
     * Token hierher: Ein Mail-Scanner, der den Link abruft, löst nichts aus. */
    app.post('/api/billing/declarations/confirm', rateLimit({ route: 'declaration-confirm', max: 30, windowMs: 60 * 60 * 1000 }), async (req, res) => {
      const r = await confirmDeclaration(req.body?.token);
      res.status(r.status).json(r.body);
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

    /* Rechnung erneut laden, im Admin-Bereich (Runde 8b, 10.10.2026). Seit P6
     * dasselbe gespeicherte PDF wie für die Kundin. */
    app.get('/api/admin/billing/orders/:id/invoice.pdf', requireAuth, requireAdmin, async (req, res) => {
      if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Nicht gefunden.' });
      const o = await loadOrder(req.params.id);
      if (!o || !o.invoice_no) return res.status(404).json({ error: 'Für diese Bestellung gibt es keine Rechnung.' });
      try {
        const pdf = await invoicePdf(o);
        res.locals.audit = { action: 'invoice_pdf', target: o.invoice_no };
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Disposition', `attachment; filename="Rechnung-${o.invoice_no}.pdf"`);
        res.send(pdf);
      } catch (err) {
        log(`billing: Rechnung ${o.id} nicht erstellt (${err?.message || err})`);
        res.status(503).json({ error: 'Die Rechnung lässt sich gerade nicht erstellen.' });
      }
    });

    app.get('/api/admin/billing/orders/:id/credit-note.pdf', requireAuth, requireAdmin, async (req, res) => {
      if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Nicht gefunden.' });
      const o = await loadOrder(req.params.id);
      if (!o || !o.invoice_no || !['withdrawn', 'refunded'].includes(o.status)) return res.status(404).json({ error: 'Für diese Bestellung gibt es keinen Stornobeleg.' });
      try {
        const pdf = await creditNotePdf(o);
        res.locals.audit = { action: 'credit_note_pdf', target: creditNoteNo(o) };
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Cache-Control', 'private, no-store');
        res.setHeader('Content-Disposition', `attachment; filename="Stornobeleg-${creditNoteNo(o)}.pdf"`);
        res.send(pdf);
      } catch (err) {
        log(`billing: Stornobeleg ${o.id} nicht erstellt (${err?.message || err})`);
        res.status(503).json({ error: 'Der Stornobeleg lässt sich gerade nicht erstellen.' });
      }
    });

    app.get('/api/admin/billing', requireAuth, requireAdmin, async (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await report());
    });
  }

  return {
    config: cfg, offer, offerFresh, euAbroadStatus, invoicePdf, creditNotePdf, checkout, syncOrder, applyPaid, withdraw, withdrawPublic, requestRefund, cancelForUser, cancelPublic, confirmDeclaration, escalateUnconfirmed,
    sendConfirmation, report, runJobs, startJobs, mount, orderSummary,
  };
}
