// Gutscheine für den Bewerbungs-Pass (09.10.2026).
//
// Beschreibung in GUTSCHEINE.md (Datenmodell, Endpunkte, Vertrag mit dem
// Frontend). Kurz:
// - Ein Gutschein gewährt den bestehenden Pass-Funktionsumfang für N Tage
//   (kind 'days') oder dauerhaft (kind 'lifetime'). Kein Abo, keine Zahlung,
//   keine Bestellung, keine Rechnung, kein Mollie-Aufruf.
// - personal: zufälliger Code (16 Zeichen Crockford-Base32, 80 Bit), Standard
//   eine Einlösung insgesamt. Gespeichert nur Hash + letzte vier Zeichen.
// - public: frei benannter Code (z. B. für einen LinkedIn-Post), viele Konten,
//   jedes höchstens einmal; Einlösefrist Pflicht, Gesamtlimit optional (ohne
//   nur mit confirmUnlimited).
// - Kampagne: höchstens eine Einlösung je Konto und Kampagne.
// - Einlösen nur angemeldet (Sitzung, nicht API-Schlüssel/MCP), mit
//   bestätigter Adresse; nicht hinter requireWritable (auch ohne Pass).
// - Limit, Einlösung und Berechtigung in EINER Transaktion: Zeilensperre auf
//   den Gutschein, dann auf das Konto; Unique-Indizes als zweite Wand.
// - Vollständige Codes stehen nie in Logs, URLs oder Ereignissen.

import crypto from 'node:crypto';
import { addGrant, planDetails } from './grants.js';
import { planInfo, MAX_ACCESS_DAYS } from './access.js';

/** Crockford-Base32 ohne I, L, O, U. */
export const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PUBLIC_CODE_RE = /^[A-Z0-9]{4,32}$/;
const PERSONAL_LEN = 16;
const MAX_PERSONAL_BATCH = 100;
const MAX_LIMIT = 100_000;
const DAY_MS = 86_400_000;

/**
 * Eindeutige Normalform: Unicode NFKC, Leerraum und Bindestrich-artige
 * Zeichen raus, Großbuchstaben. „ linkedin-30 “, „LinkedIn 30“ und
 * „ＬＩＮＫＥＤＩＮ３０“ ergeben alle LINKEDIN30.
 */
export function normalizeCode(raw) {
  return String(raw ?? '')
    .normalize('NFKC')
    .replace(/[\s­‐-―−﹘﹣－-]+/g, '')
    .toUpperCase();
}

/** Darf diese Normalform überhaupt ein Code sein? (Vor jeder Abfrage.) */
export function isCodeShape(norm) {
  return PUBLIC_CODE_RE.test(norm);
}

export function hashCode(norm) {
  return crypto.createHash('sha256').update(norm).digest('hex');
}

/** Persönlicher Code: 16 Zeichen aus CROCKFORD per crypto.randomInt. */
export function generatePersonalCode() {
  let s = '';
  for (let i = 0; i < PERSONAL_LEN; i++) s += CROCKFORD[crypto.randomInt(CROCKFORD.length)];
  return s;
}
export function formatPersonalCode(norm) {
  return norm.match(/.{1,4}/g).join('-');
}

/** Letzte Sekunde des angegebenen Tages in Berlin (YYYY-MM-DD, also
 *  23:59:59 Ortszeit — so zeigt jede Formatierung in Berlin den genannten
 *  Tag) oder ein ISO-Zeitpunkt. */
export function parseRedeemUntil(v) {
  const s = String(v ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const naive = Date.UTC(+m[1], +m[2] - 1, +m[3] + 1);
    // Versatz Berlin an diesem Zeitpunkt (60 oder 120 Minuten).
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const p = {};
    for (const { type, value } of f.formatToParts(new Date(naive))) p[type] = Number(value);
    const off = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - naive;
    const d = new Date(naive - off - 1000);
    // Ungültige Kalenderdaten (31.02.) fallen hier durch.
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDate() === +m[3] ? d : null;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
  return null;
}

function berlinDate(d) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
}

/** Klartext-Zusammenfassung für die Verwaltung. */
export function voucherSummary(v) {
  const what = v.kind === 'lifetime' ? 'dauerhafte Gratiszugänge' : `Zugänge für je ${v.days} Tage`;
  const whatOne = v.kind === 'lifetime' ? 'dauerhafter Gratiszugang' : `Zugang für ${v.days} Tage`;
  const amount = v.max_redemptions == null ? `Ohne Gesamtlimit: ${what}` : v.max_redemptions === 1 ? `1 ${whatOne}` : `${v.max_redemptions} ${what}`;
  const until = v.redeem_until ? `, einlösbar bis ${berlinDate(v.redeem_until)}` : '';
  return `${amount}${until}${v.distribution === 'public' ? ', je Konto höchstens einmal' : ''}.`;
}

/** Kopierbarer Aktionshinweis für öffentliche Codes. Keine Restplätze. */
export function announcement(v) {
  if (v.distribution !== 'public') return null;
  const gift = v.kind === 'lifetime' ? 'einen dauerhaften Gratiszugang zum Bewerbungs-Pass' : `${v.days} Tage Bewerbungs-Pass kostenlos`;
  const limit = v.max_redemptions == null ? '' : `, für die ersten ${v.max_redemptions} erfolgreichen Einlösungen`;
  return `Mit ${v.code_plain} erhältst du ${gift}. Ohne Zahlungsdaten, ohne Abo. Einlösbar bis ${berlinDate(v.redeem_until)}${limit}.`;
}

const MESSAGES = {
  invalid: 'Diesen Code gibt es nicht. Bitte prüfe die Schreibweise.',
  expired: 'Dieser Code kann nicht mehr eingelöst werden: Die Einlösefrist ist vorbei.',
  exhausted: 'Dieser Code ist ausgeschöpft: Alle Plätze sind vergeben.',
  inactive: 'Dieser Code ist nicht mehr gültig.',
  already_redeemed: 'Diesen Code hast du schon eingelöst.',
  campaign_redeemed: 'Du hast schon einen Code aus dieser Aktion eingelöst.',
  already_lifetime: 'Dein Zugang ist schon dauerhaft freigeschaltet. Der Code wird nicht verbraucht.',
  email_unconfirmed: 'Bitte bestätige zuerst deine E-Mail-Adresse. Den Link dafür haben wir dir geschickt.',
  auth_required: 'Bitte melde dich an, um den Code einzulösen.',
  session_required: 'Codes lassen sich nur im Konto im Browser einlösen, nicht über einen API-Schlüssel oder die KI-Verbindung.',
};
const STATUS = {
  invalid: 404, expired: 410, exhausted: 410, inactive: 410, already_redeemed: 409, campaign_redeemed: 409,
  already_lifetime: 409, email_unconfirmed: 403, auth_required: 401, session_required: 403,
};
class VoucherError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/**
 * @param pool          Postgres-Pool
 * @param registrationOpen () => boolean — ist die offene Registrierung wirklich an?
 * @param emailConfirmed (user) => boolean — dieselbe Regel wie server.js
 * @param baseUrl       PUBLIC_BASE_URL (für die Einlöseadresse) oder null
 */
export function createVouchers({ pool, registrationOpen = () => false, emailConfirmed = () => true, baseUrl = null, log = console.log }) {

  async function findByCode(db, norm, { lock = false } = {}) {
    if (!isCodeShape(norm)) return null;
    const { rows } = await db.query(`SELECT * FROM vouchers WHERE code_hash = $1${lock ? ' FOR UPDATE' : ''}`, [hashCode(norm)]);
    return rows[0] || null;
  }

  /** Vorschau: reserviert nichts, gibt keine Restplätze heraus. */
  async function preview(rawCode, user = null, now = new Date()) {
    const norm = normalizeCode(rawCode);
    const v = await findByCode(pool, norm);
    if (!v) return { ok: false, reason: 'invalid' };
    if (!v.active) return { ok: false, reason: 'inactive' };
    if (v.redeem_until && now >= new Date(v.redeem_until)) return { ok: false, reason: 'expired' };
    let alreadyLifetime;
    if (user) {
      const { rows } = await pool.query(
        `SELECT (voucher_id = $1) AS same FROM voucher_redemptions
          WHERE user_id = $2 AND (voucher_id = $1 OR ($3::int IS NOT NULL AND campaign_id = $3))`,
        [v.id, user.id, v.campaign_id],
      );
      if (rows.some(r => r.same)) return { ok: false, reason: 'already_redeemed' };
      if (rows.length) return { ok: false, reason: 'campaign_redeemed' };
      const k = planInfo(user)?.kind;
      alreadyLifetime = k === 'lifetime' || k === 'unlimited';
    }
    if (v.max_redemptions != null && v.redemptions >= v.max_redemptions) return { ok: false, reason: 'exhausted' };
    return {
      ok: true,
      kind: v.kind,
      days: v.kind === 'days' ? v.days : null,
      redeemUntil: v.redeem_until ? new Date(v.redeem_until).toISOString() : null,
      limited: v.max_redemptions != null,
      limitTotal: v.max_redemptions,
      ...(user ? { alreadyLifetime } : {}),
      registrationOpen: !!registrationOpen(),
    };
  }

  /**
   * Einlösen. Wirft nicht; gibt { ok, plan, grant } oder { ok:false, code } zurück.
   * Reihenfolge der Sperren: Gutschein, dann Konto (wie Bestellung → Konto
   * in billing.js) — keine Verklemmung.
   */
  async function redeem(user, rawCode, { origin = 'account' } = {}) {
    const norm = normalizeCode(rawCode);
    if (!isCodeShape(norm)) return { ok: false, code: 'invalid' };
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      const v = await findByCode(client, norm, { lock: true });
      if (!v) throw new VoucherError('invalid');
      const { rows: nowRow } = await client.query('SELECT now() AS now');
      const now = nowRow[0].now;
      const { rows: ur } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [user.id]);
      const u = ur[0];
      if (!u || u.disabled) throw new VoucherError('auth_required');
      const k = planInfo(u)?.kind;
      if (k === 'lifetime' || k === 'unlimited') throw new VoucherError('already_lifetime');
      const { rows: prior } = await client.query(
        `SELECT (voucher_id = $1) AS same FROM voucher_redemptions
          WHERE user_id = $2 AND (voucher_id = $1 OR ($3::int IS NOT NULL AND campaign_id = $3))`,
        [v.id, u.id, v.campaign_id],
      );
      if (prior.some(r => r.same)) throw new VoucherError('already_redeemed');
      if (prior.length) throw new VoucherError('campaign_redeemed');
      if (!v.active) throw new VoucherError('inactive');
      if (v.redeem_until && new Date(now) >= new Date(v.redeem_until)) throw new VoucherError('expired');
      if (v.max_redemptions != null && v.redemptions >= v.max_redemptions) throw new VoucherError('exhausted');

      await client.query('UPDATE vouchers SET redemptions = redemptions + 1 WHERE id = $1', [v.id]);
      const { rows: rr } = await client.query(
        `INSERT INTO voucher_redemptions (voucher_id, campaign_id, user_id, redeemed_at, kind, days, origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [v.id, v.campaign_id, u.id, now, v.kind, v.kind === 'days' ? v.days : null, origin === 'code_page' ? 'code_page' : 'account'],
      );
      const redemptionId = rr[0].id;
      const { grant } = await addGrant(client, u.id, {
        source: 'voucher', sourceId: redemptionId, kind: v.kind, days: v.kind === 'days' ? v.days : null,
      }, { now, log });
      await client.query(
        'UPDATE voucher_redemptions SET grant_id = $2, granted_from = $3, granted_until = $4 WHERE id = $1',
        [redemptionId, grant.id, grant.effective_from, grant.effective_until],
      );
      await client.query('COMMIT');
      result = {
        ok: true,
        grant: { kind: v.kind, days: v.kind === 'days' ? v.days : null, from: grant.effective_from, until: v.kind === 'lifetime' ? null : grant.effective_until },
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err instanceof VoucherError) return { ok: false, code: err.code };
      // Zweite Wand: die Unique-Indizes (gleichzeitige Anfragen desselben Kontos).
      if (err?.code === '23505') {
        if (String(err.constraint || '').includes('campaign')) return { ok: false, code: 'campaign_redeemed' };
        return { ok: false, code: 'already_redeemed' };
      }
      throw err;
    } finally {
      client.release();
    }
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
    result.plan = await planDetails(pool, rows[0]);
    log(`vouchers: Einlösung für Konto #${user.id} (${result.grant.kind})`);
    return result;
  }

  /* ── Verwaltung ───────────────────────────────────────────────────── */

  async function audit(db, adminId, action, target, details) {
    await db.query('INSERT INTO admin_audit (admin_id, action, target, details) VALUES ($1, $2, $3, $4)',
      [adminId, action, target == null ? null : String(target), details ? JSON.stringify(details) : null]);
  }

  function publicView(v, campaignName = v.campaign_name ?? null) {
    const now = Date.now();
    const status = !v.active ? 'inactive'
      : v.redeem_until && now >= new Date(v.redeem_until).getTime() ? 'expired'
        : v.max_redemptions != null && v.redemptions >= v.max_redemptions ? 'exhausted' : 'active';
    return {
      id: v.id,
      name: v.name,
      campaign: campaignName,
      campaignId: v.campaign_id,
      distribution: v.distribution,
      code: v.distribution === 'public' ? v.code_plain : null,
      codeHint: v.distribution === 'personal' ? `…${v.code_hint}` : null,
      hint: v.distribution === 'personal' ? v.code_hint : null,
      kind: v.kind,
      days: v.days,
      maxRedemptions: v.max_redemptions,
      redemptions: v.redemptions,
      redeemUntil: v.redeem_until,
      active: v.active,
      status,
      batchId: v.batch_id,
      createdAt: v.created_at,
      deactivatedAt: v.deactivated_at,
      deactivateNote: v.deactivate_note,
      summary: voucherSummary(v),
      announcement: announcement(v),
      redeemUrl: baseUrl ? `${baseUrl}/code` : '/code',
    };
  }

  async function list() {
    const { rows } = await pool.query(
      `SELECT v.*, c.name AS campaign_name FROM vouchers v LEFT JOIN voucher_campaigns c ON c.id = v.campaign_id
        ORDER BY v.created_at DESC, v.id DESC LIMIT 1000`,
    );
    return rows.map(r => publicView(r));
  }

  /** Prüft die Eingabe; gibt { error } oder die bereinigten Werte zurück. */
  function validateCreate(body) {
    const b = body || {};
    const name = String(b.name ?? '').replace(/\s+/g, ' ').trim();
    if (name.length < 1 || name.length > 120) return { error: 'Bitte einen internen Namen angeben (1 bis 120 Zeichen).', code: 'name_invalid' };
    const distribution = b.distribution;
    if (!['personal', 'public'].includes(distribution)) return { error: 'Verteilart: personal oder public.', code: 'distribution_invalid' };
    const kind = b.kind;
    if (!['days', 'lifetime'].includes(kind)) return { error: 'Zugangstyp: days oder lifetime.', code: 'kind_invalid' };
    let days = null;
    if (kind === 'days') {
      days = Number(b.days);
      if (!Number.isInteger(days) || days < 1 || days > MAX_ACCESS_DAYS) return { error: `Dauer: 1 bis ${MAX_ACCESS_DAYS} Tage.`, code: 'days_invalid' };
    }
    const campaign = String(b.campaign ?? '').replace(/\s+/g, ' ').trim();
    if (campaign.length > 120) return { error: 'Kampagnenname: höchstens 120 Zeichen.', code: 'campaign_invalid' };
    // Gesamtlimit. undefined = Standard (personal 1, public 100); null = ohne
    // Limit, aber nur mit confirmUnlimited — „ohne Gesamtlimit“ wird bewusst gewählt.
    let max;
    if (b.maxRedemptions === undefined) max = distribution === 'personal' ? 1 : 100;
    else if (b.maxRedemptions === null || b.maxRedemptions === '') {
      if (b.confirmUnlimited !== true) return { error: 'Ohne Gesamtlimit nur mit ausdrücklicher Bestätigung (confirmUnlimited).', code: 'unlimited_unconfirmed' };
      max = null;
    } else {
      max = Number(b.maxRedemptions);
      if (!Number.isInteger(max) || max < 1 || max > MAX_LIMIT) return { error: `Gesamtlimit: 1 bis ${MAX_LIMIT} oder ausdrücklich ohne.`, code: 'limit_invalid' };
    }
    let redeemUntil = null;
    if (b.redeemUntil !== undefined && b.redeemUntil !== null && b.redeemUntil !== '') {
      redeemUntil = parseRedeemUntil(b.redeemUntil);
      if (!redeemUntil) return { error: 'Einlösefrist als Datum JJJJ-MM-TT.', code: 'redeem_until_invalid' };
      if (redeemUntil.getTime() <= Date.now()) return { error: 'Die Einlösefrist muss in der Zukunft liegen.', code: 'redeem_until_past' };
      if (redeemUntil.getTime() > Date.now() + 5 * 366 * DAY_MS) return { error: 'Die Einlösefrist darf höchstens fünf Jahre in der Zukunft liegen.', code: 'redeem_until_far' };
    }
    if (distribution === 'public' && !redeemUntil) return { error: 'Öffentliche Codes brauchen eine Einlösefrist.', code: 'redeem_until_required' };
    let code = null;
    let count = 1;
    if (distribution === 'public') {
      code = normalizeCode(b.code);
      if (!isCodeShape(code)) return { error: 'Code: 4 bis 32 Zeichen, nur A–Z und 0–9 (Leerzeichen und Bindestriche fallen weg).', code: 'code_invalid' };
    } else {
      if (b.code !== undefined && b.code !== null && b.code !== '') return { error: 'Persönliche Codes erzeugt der Dienst selbst.', code: 'code_not_allowed' };
      count = b.count === undefined ? 1 : Number(b.count);
      if (!Number.isInteger(count) || count < 1 || count > MAX_PERSONAL_BATCH) return { error: `Anzahl: 1 bis ${MAX_PERSONAL_BATCH} Codes.`, code: 'count_invalid' };
    }
    return { name, distribution, kind, days, campaign, max, redeemUntil, code, count };
  }

  async function create(admin, body) {
    const input = validateCreate(body);
    if (input.error) return { status: 400, body: { error: input.error, code: input.code } };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let campaignId = null;
      let campaignName = null;
      if (input.campaign) {
        const key = input.campaign.normalize('NFKC').toLowerCase();
        const { rows } = await client.query(
          `INSERT INTO voucher_campaigns (name, name_key, created_by) VALUES ($1, $2, $3)
           ON CONFLICT (name_key) DO UPDATE SET name_key = EXCLUDED.name_key RETURNING id, name`,
          [input.campaign, key, admin.id],
        );
        campaignId = rows[0].id;
        campaignName = rows[0].name;
      }
      const common = [input.name, campaignId, input.distribution, input.kind, input.days, input.max, input.redeemUntil, admin.id];
      if (input.distribution === 'public') {
        const { rows } = await client.query(
          `INSERT INTO vouchers (name, campaign_id, distribution, kind, days, max_redemptions, redeem_until, created_by, code_hash, code_plain)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (code_hash) DO NOTHING RETURNING *`,
          [...common, hashCode(input.code), input.code],
        );
        if (!rows[0]) {
          await client.query('ROLLBACK');
          return { status: 409, body: { error: 'Diesen Code gibt es schon (Groß-/Kleinschreibung, Leerzeichen und Bindestriche zählen nicht).', code: 'code_taken' } };
        }
        await audit(client, admin.id, 'voucher_create', rows[0].id, {
          distribution: 'public', code: input.code, kind: input.kind, days: input.days, maxRedemptions: input.max,
          redeemUntil: input.redeemUntil, campaign: campaignName,
        });
        await client.query('COMMIT');
        log(`vouchers: öffentlicher Gutschein #${rows[0].id} angelegt`);
        return { status: 200, body: { voucher: publicView(rows[0], campaignName) } };
      }
      const batchId = crypto.randomUUID();
      const codes = [];
      const vouchers = [];
      for (let i = 0; i < input.count; i++) {
        let made = null;
        for (let attempt = 0; attempt < 5 && !made; attempt++) {
          const norm = generatePersonalCode();
          const { rows } = await client.query(
            `INSERT INTO vouchers (name, campaign_id, distribution, kind, days, max_redemptions, redeem_until, created_by, code_hash, code_hint, batch_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (code_hash) DO NOTHING RETURNING *`,
            [...common, hashCode(norm), norm.slice(-4), batchId],
          );
          if (rows[0]) { made = rows[0]; codes.push(formatPersonalCode(norm)); }
        }
        if (!made) throw new Error('Kein freier Code gefunden');
        vouchers.push(publicView(made, campaignName));
      }
      await audit(client, admin.id, 'voucher_create', batchId, {
        distribution: 'personal', count: input.count, ids: vouchers.map(v => v.id), hints: vouchers.map(v => v.codeHint),
        kind: input.kind, days: input.days, maxRedemptions: input.max, redeemUntil: input.redeemUntil, campaign: campaignName,
      });
      await client.query('COMMIT');
      log(`vouchers: ${input.count} persönliche(r) Gutschein(e) angelegt`);
      // Die Codes stehen NUR in dieser Antwort. Gespeichert ist der Hash.
      return { status: 200, body: { codes, vouchers } };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async function deactivate(admin, id, note) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE vouchers SET active = false, deactivated_at = coalesce(deactivated_at, now()), deactivated_by = coalesce(deactivated_by, $2),
                deactivate_note = coalesce($3, deactivate_note)
          WHERE id = $1 RETURNING *`,
        [id, admin.id, note || null],
      );
      if (!rows[0]) { await client.query('ROLLBACK'); return null; }
      await audit(client, admin.id, 'voucher_deactivate', id, { note: note || null, redemptions: rows[0].redemptions });
      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async function redemptions(id) {
    const { rows } = await pool.query(
      `SELECT redeemed_at, user_id, kind, days, granted_from, granted_until, origin
         FROM voucher_redemptions WHERE voucher_id = $1 ORDER BY redeemed_at DESC LIMIT 1000`,
      [id],
    );
    // Möglichst wenig Personendaten: Kontonummer, keine Adresse, kein Name.
    return rows.map(r => ({
      redeemedAt: r.redeemed_at,
      at: r.redeemed_at,
      until: r.kind === 'lifetime' ? null : r.granted_until,
      account: r.user_id ? `#${r.user_id}` : null,
      accountDeleted: r.user_id == null,
      kind: r.kind,
      days: r.days,
      grantedFrom: r.granted_from,
      grantedUntil: r.kind === 'lifetime' ? null : r.granted_until,
      origin: r.origin,
    }));
  }

  /* Pass-Funktionen, die der Server ohnehin kennt: Speichern, Import,
   * Wiederherstellen, Sharelink (Ereignisse), API-Schlüssel und KI-Verbindung
   * (eigene Tabellen). Keine neue Erfassung. */
  const PASS_EVENTS = ['resume_save', 'md_import', 'cl_md_import', 'resume_restore', 'share_create'];

  /**
   * Aggregierte Kennzahlen je Gutschein, je Kampagne und je Zugangsart.
   * Keine Codes, keine Adressen, keine Inhalte.
   */
  async function stats() {
    const { rows } = await pool.query(
      `SELECT r.id, r.voucher_id, v.campaign_id, c.name AS campaign, r.kind, r.user_id,
              (r.user_id IS NOT NULL AND (
                 EXISTS (SELECT 1 FROM events e WHERE e.user_id = r.user_id AND e.created_at >= r.redeemed_at AND e.kind = ANY($1))
              OR EXISTS (SELECT 1 FROM api_keys k WHERE k.user_id = r.user_id AND k.created_at >= r.redeemed_at)
              OR EXISTS (SELECT 1 FROM oauth_tokens t WHERE t.user_id = r.user_id AND t.created_at >= r.redeemed_at)
              OR EXISTS (SELECT 1 FROM share_links s WHERE s.created_by = r.user_id AND s.created_at >= r.redeemed_at)
              )) AS used,
              coalesce(b.purchases, 0)::int AS purchases, coalesce(b.refunded, 0)::int AS refunded
         FROM voucher_redemptions r
         JOIN vouchers v ON v.id = r.voucher_id
         LEFT JOIN voucher_campaigns c ON c.id = v.campaign_id
         LEFT JOIN LATERAL (
           -- Käufe (serverseitig bestätigte Zahlung) nach dieser Zeitgutschein-
           -- Einlösung und vor der nächsten Zeitgutschein-Einlösung desselben Kontos.
           SELECT count(*) AS purchases, count(*) FILTER (WHERE o.status IN ('withdrawn', 'refunded')) AS refunded
             FROM orders o
            WHERE r.kind = 'days' AND r.user_id IS NOT NULL AND o.user_id = r.user_id
              AND o.paid_at IS NOT NULL AND o.paid_at > r.redeemed_at
              AND NOT EXISTS (SELECT 1 FROM voucher_redemptions r2
                               WHERE r2.user_id = r.user_id AND r2.kind = 'days' AND r2.id <> r.id
                                 AND r2.redeemed_at > r.redeemed_at AND r2.redeemed_at < o.paid_at)
         ) b ON true`,
      [PASS_EVENTS],
    );
    const { rows: vs } = await pool.query(
      `SELECT v.*, c.name AS campaign_name FROM vouchers v LEFT JOIN voucher_campaigns c ON c.id = v.campaign_id ORDER BY v.created_at DESC, v.id DESC`,
    );
    const blank = kind => ({ redemptions: 0, usedPassFeature: 0, buyers: 0, purchases: 0, refundedPurchases: 0, ...(kind === 'lifetime' ? { buyers: null, purchases: null, refundedPurchases: null } : {}) });
    const add = (acc, r) => {
      acc.redemptions += 1;
      if (r.used) acc.usedPassFeature += 1;
      if (r.kind === 'days') {
        acc.purchases += r.purchases;
        acc.refundedPurchases += r.refunded;
        if (r.purchases > 0) acc.buyers += 1;
      }
      return acc;
    };
    const byVoucher = new Map(vs.map(v => [v.id, { id: v.id, name: v.name, campaign: v.campaign_name, distribution: v.distribution, kind: v.kind, days: v.days, ...blank(v.kind) }]));
    const byCampaign = new Map();
    const byKind = { days: blank('days'), lifetime: blank('lifetime') };
    for (const r of rows) {
      const bv = byVoucher.get(r.voucher_id);
      if (bv) add(bv, r);
      const ck = `${r.campaign_id ?? 'v' + r.voucher_id}:${r.kind}`;
      if (!byCampaign.has(ck)) byCampaign.set(ck, { campaign: r.campaign ?? null, campaignId: r.campaign_id, voucherId: r.campaign_id ? null : r.voucher_id, kind: r.kind, ...blank(r.kind) });
      add(byCampaign.get(ck), r);
      add(byKind[r.kind], r);
    }
    const rate = acc => (acc.purchases == null || !acc.redemptions ? null : Math.round((acc.buyers / acc.redemptions) * 1000) / 10);
    for (const acc of [...byVoucher.values(), ...byCampaign.values(), byKind.days, byKind.lifetime]) acc.conversionPercent = rate(acc);
    const campaigns = [...byCampaign.values()];
    return {
      vouchers: [...byVoucher.values()],
      campaigns,
      // Kurzform je Kampagne und Zugangsart (Feldnamen der Admin-Oberfläche).
      rows: campaigns.map(c => ({
        campaign: c.campaign, kind: c.kind, redemptions: c.redemptions, usedFeature: c.usedPassFeature,
        purchasesAfter: c.purchases, refundsOfThose: c.refundedPurchases, buyers: c.buyers, conversionPercent: c.conversionPercent,
      })),
      byKind,
      notes: [
        'Gezählt wird je Einlösung (= je Konto), nicht je Mensch.',
        '„Pass-Funktion genutzt“: nach der Einlösung mindestens einmal gespeichert, importiert, wiederhergestellt, einen Sharelink angelegt, einen API-Schlüssel erzeugt oder eine KI-Verbindung hergestellt. Nur Lesen und Exportieren zählt nicht.',
        'Käufe: Bestellungen mit bestätigter Zahlung nach einer Einlösung mit Laufzeit (und vor der nächsten). Dauerhafte Gratiszugänge sind ausgenommen.',
        'Erstattete Käufe: davon widerrufen oder erstattet.',
        'Gelöschte Konten zählen bei den Einlösungen mit, bei Nutzung und Käufen nicht mehr.',
        'Gutscheine erzeugen keine Bestellung und keinen Umsatz; die Auswertung Bezahlung enthält sie nicht.',
      ],
    };
  }

  /* ── Routen ───────────────────────────────────────────────────────── */

  function mount(app, { requireAuth, requireAdmin, rateLimit, subnetLimit, loadUser }) {
    const userLimit = ({ route, max, windowMs }) => {
      const inner = rateLimit({ route: `${route}/user`, max, windowMs });
      return (req, res, next) => inner({ ip: `u${req.user?.id}` }, res, next);
    };
    const optionalUser = async (req, _res, next) => {
      try { req.user = await loadUser(req); } catch { req.user = null; }
      next();
    };
    const fail = (res, code) => res.status(STATUS[code] || 400).json({ ok: false, error: MESSAGES[code], code });

    app.post('/api/vouchers/preview',
      rateLimit({ route: 'voucher-preview', max: 30, windowMs: 10 * 60 * 1000 }),
      subnetLimit({ route: 'voucher-preview', max: 120, windowMs: 10 * 60 * 1000 }),
      optionalUser,
      async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        const r = await preview(req.body?.code, req.user || null);
        if (!r.ok) return res.json({ ...r, error: MESSAGES[r.reason], registrationOpen: !!registrationOpen() });
        res.json(r);
      });

    app.post('/api/vouchers/redeem',
      rateLimit({ route: 'voucher-redeem', max: 20, windowMs: 60 * 60 * 1000 }),
      subnetLimit({ route: 'voucher-redeem', max: 60, windowMs: 60 * 60 * 1000 }),
      async (req, res, next) => {
        const auth = String(req.headers?.authorization || '');
        // Nur die Sitzung im Browser: API-Schlüssel und OAuth-Token (MCP) lösen nicht ein.
        if (/^Bearer\s/i.test(auth)) return fail(res, 'session_required');
        const u = await loadUser(req);
        if (!u) return fail(res, 'auth_required');
        req.user = u;
        next();
      },
      userLimit({ route: 'voucher-redeem', max: 20, windowMs: 60 * 60 * 1000 }),
      async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        if (!emailConfirmed(req.user)) return fail(res, 'email_unconfirmed');
        const r = await redeem(req.user, req.body?.code, { origin: req.body?.origin });
        if (!r.ok) return fail(res, r.code);
        res.json(r);
      });

    app.get('/api/admin/vouchers', requireAuth, requireAdmin, async (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const { rows: campaigns } = await pool.query('SELECT id, name FROM voucher_campaigns ORDER BY name');
      res.json({ vouchers: await list(), campaigns, redeemUrl: baseUrl ? `${baseUrl}/code` : '/code' });
    });

    app.post('/api/admin/vouchers', requireAuth, requireAdmin, async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      const r = await create(req.user, req.body);
      res.status(r.status).json(r.body);
    });

    app.post('/api/admin/vouchers/:id/deactivate', requireAuth, requireAdmin, async (req, res) => {
      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Gutschein nicht gefunden.' });
      const note = String(req.body?.note ?? '').trim().slice(0, 500) || null;
      const v = await deactivate(req.user, id, note);
      if (!v) return res.status(404).json({ error: 'Gutschein nicht gefunden.' });
      res.json({ ok: true, voucher: publicView(v), note: 'Bereits gewährte Zugänge bleiben bestehen. Neue Einlösungen sind ab sofort nicht mehr möglich.' });
    });

    app.get('/api/admin/vouchers/:id/redemptions', requireAuth, requireAdmin, async (req, res) => {
      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Gutschein nicht gefunden.' });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ redemptions: await redemptions(id) });
    });

    app.get('/api/admin/voucher-stats', requireAuth, requireAdmin, async (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.json(await stats());
    });
  }

  return { preview, redeem, create, deactivate, list, redemptions, stats, mount, validateCreate };
}
