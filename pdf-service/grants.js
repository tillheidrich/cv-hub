// Berechtigungen je Konto (Gutscheine, 09.10.2026).
//
// Bis hierher schrieben fünf Stellen direkt in users.access_until: Einladung
// mit Laufzeit, Kauf, Widerruf, Kündigung, Admin. Jede rechnete für sich
// („addiere ab dem späteren von jetzt und Ende", „ziehe den Rest dieser
// Bestellung ab"). Mit Gutscheinen kommt eine sechste Herkunft dazu, und die
// Fragen werden kombinatorisch: Was bleibt, wenn eine Bestellung erstattet
// wird, nach der ein Gutschein eingelöst wurde?
//
// Deshalb jetzt: jede Berechtigung ist eine Zeile in access_grants, und die
// wirksame Laufzeit wird IMMER aus allen Zeilen neu berechnet (computeAccess)
// und in derselben Transaktion nach users.access_until / plan_kind
// gespiegelt. Alle vorhandenen Prüfstellen (requireWritable, API-Schlüssel,
// OAuth/MCP, Hinweis-Mails) lesen weiter nur die Zeile in users und bleiben
// unverändert.
//
// Regeln, die hier stehen und nirgends sonst:
// - lifetime (dauerhafter Gratiszugang) schlägt alles. Widerrufene Grants
//   zählen nicht.
// - Sonst nach granted_at (dann id) sortiert: Beginn = max(bisheriges Ende,
//   granted_at), Ende = Beginn + days. Eine Kündigung setzt ends_at; der
//   Abschnitt endet dann spätestens dort.
// - kind 'set' (nur Admin und Altbestand): setzt das Ende auf until_at
//   (NULL = unbegrenzt). Danach geht die Kette normal weiter.
// - Ein Widerruf (Erstattung) entfernt den Grant. Was das Konto bis zum
//   Widerruf hatte, bleibt als Untergrenze stehen: access_until ist nie
//   früher als min(Widerrufszeitpunkt, bisheriges Ende dieses Abschnitts).
//   Rückwirkend wird nichts gesperrt.
// - Selbst registrierte Konten beginnen bei created_at (sofort „ohne Pass").
//   Eingeladene/Bestandskonten ohne jede Berechtigungszeile sind unbegrenzt.
// - Admin-Konten werden nie begrenzt.
// - Stimmt der gespeicherte Wert vor einer Änderung nicht mit der Berechnung
//   überein (jemand hat access_until direkt geschrieben, Altbestand), wird er
//   NICHT überschrieben: er wird als Ausgangswert (source 'legacy', kind 'set')
//   übernommen und im Log gemeldet (ensureBaseline).

import { planInfo } from './access.js';

export const DAY_MS = 86_400_000;
/** Abweichungen unter einer Sekunde sind Rundung (Mikro- gegen Millisekunden). */
const TOLERANCE_MS = 1000;

const t = d => (d == null ? null : new Date(d).getTime());

/**
 * Reine Funktion: wirksame Laufzeit aus Konto und Grants.
 * @param user   { role, signup_source, created_at, plan_kind }
 * @param grants Zeilen aus access_grants (beliebige Reihenfolge)
 * @returns { mode: 'admin'|'lifetime'|'unlimited'|'finite', until: Date|null,
 *            planKind, segments: Map<id, { from: Date|null, until: Date|null }> }
 */
export function computeAccess(user, grants) {
  const segments = new Map();
  if (user.role === 'admin') return { mode: 'admin', until: null, planKind: user.plan_kind ?? null, segments };
  const self = user.signup_source === 'self';
  const sorted = [...grants].sort((a, b) => (t(a.granted_at) - t(b.granted_at)) || (a.id - b.id));
  const active = sorted.filter(g => !g.revoked_at);

  const touchesPass = sorted.some(g => g.source === 'order' || g.source === 'voucher');
  let planKind = user.plan_kind ?? null;
  if (touchesPass) planKind = 'pass';
  else if (planKind === 'lifetime') planKind = self ? 'none' : null;

  if (!self && sorted.length === 0) return { mode: 'unlimited', until: null, planKind, segments };

  let end = self ? t(user.created_at) : null;
  let unlimited = false;
  for (const g of active) {
    const granted = t(g.granted_at);
    if (g.kind === 'lifetime') {
      segments.set(g.id, { from: new Date(granted), until: null });
      continue;
    }
    if (g.kind === 'set') {
      if (g.until_at == null) { unlimited = true; end = null; }
      else { unlimited = false; end = t(g.until_at); }
      segments.set(g.id, { from: new Date(granted), until: g.until_at == null ? null : new Date(t(g.until_at)) });
      continue;
    }
    // days
    if (unlimited) { segments.set(g.id, { from: null, until: null }); continue; }
    const start = Math.max(end ?? granted, granted);
    let segEnd = start + Number(g.days) * DAY_MS;
    if (g.ends_at) segEnd = Math.min(segEnd, t(g.ends_at));
    segEnd = Math.max(start, segEnd);
    segments.set(g.id, { from: new Date(start), until: new Date(segEnd) });
    end = Math.max(end ?? segEnd, segEnd);
  }

  if (active.some(g => g.kind === 'lifetime')) return { mode: 'lifetime', until: null, planKind: 'lifetime', segments };
  if (unlimited) return { mode: 'unlimited', until: null, planKind: planKind === 'lifetime' ? null : planKind, segments };

  // Untergrenze aus widerrufenen Grants: was bis zum Widerruf galt, bleibt.
  let floor = null;
  for (const g of sorted) {
    if (!g.revoked_at) continue;
    const eu = g.effective_until != null ? t(g.effective_until) : t(g.revoked_at);
    const f = Math.min(t(g.revoked_at), eu);
    floor = floor == null ? f : Math.max(floor, f);
  }
  let until = end;
  if (floor != null) until = until == null ? floor : Math.max(until, floor);
  if (until == null) until = t(user.created_at) ?? Date.now();
  return { mode: 'finite', until: new Date(until), planKind, segments };
}

/** Gleiche Laufzeit? null = unbegrenzt. */
export function sameUntil(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(t(a) - t(b)) < TOLERANCE_MS;
}

/** Wirksames Ende als Wert für users.access_until (null = unbegrenzt). */
function storedValue(res) {
  return res.mode === 'finite' ? res.until : null;
}

async function dbNow(client) {
  const { rows } = await client.query('SELECT now() AS now');
  return rows[0].now;
}

export async function lockUser(client, userId) {
  const { rows } = await client.query(
    'SELECT id, role, signup_source, created_at, access_until, plan_kind FROM users WHERE id = $1 FOR UPDATE',
    [userId],
  );
  return rows[0] || null;
}

export async function loadGrants(client, userId) {
  const { rows } = await client.query('SELECT * FROM access_grants WHERE user_id = $1 ORDER BY granted_at, id', [userId]);
  return rows;
}

/**
 * Vor jeder Änderung: Stimmt der gespeicherte Wert mit der Berechnung? Wenn
 * nicht, wird er als Ausgangswert übernommen (nie überschrieben).
 * Muss in einer Transaktion nach lockUser laufen.
 */
export async function ensureBaseline(client, user, { now, log = console.log } = {}) {
  if (!user || user.role === 'admin') return false;
  const grants = await loadGrants(client, user.id);
  const res = computeAccess(user, grants);
  // Ein dauerhafter Zugang (plan_kind lifetime) ist mit access_until NULL im Einklang.
  if (sameUntil(storedValue(res), user.access_until)) return false;
  await client.query(
    `INSERT INTO access_grants (user_id, source, kind, until_at, granted_at)
     VALUES ($1, 'legacy', 'set', $2, $3)`,
    [user.id, user.access_until, now || await dbNow(client)],
  );
  log(`access-grants: Konto #${user.id}: gespeicherte Laufzeit weicht von den Berechtigungen ab und wird als Ausgangswert übernommen (gespeichert ${user.access_until ? new Date(user.access_until).toISOString() : 'unbegrenzt'}, berechnet ${storedValue(res) ? storedValue(res).toISOString() : res.mode})`);
  return true;
}

/**
 * Rechnet die Laufzeit neu und spiegelt sie nach users. Schreibt die
 * wirksamen Abschnitte der aktiven Grants zurück (widerrufene bleiben, wie
 * sie zum Widerruf waren). Läuft in der Transaktion des Aufrufers.
 */
export async function recomputeAccess(client, userId) {
  const user = await lockUser(client, userId);
  if (!user) return null;
  const grants = await loadGrants(client, userId);
  const res = computeAccess(user, grants);
  for (const g of grants) {
    if (g.revoked_at) continue;
    const s = res.segments.get(g.id);
    if (!s) continue;
    if (sameUntil(s.from, g.effective_from) && sameUntil(s.until, g.effective_until) && (s.from == null) === (g.effective_from == null)) continue;
    await client.query('UPDATE access_grants SET effective_from = $2, effective_until = $3 WHERE id = $1', [g.id, s.from, s.until]);
  }
  if (res.mode === 'admin') return { ...res, user };
  const value = storedValue(res);
  const changed = !sameUntil(value, user.access_until);
  await client.query(
    `UPDATE users SET access_until = $2, plan_kind = $3,
            access_notice14_at = CASE WHEN $4 THEN NULL ELSE access_notice14_at END,
            access_notice3_at  = CASE WHEN $4 THEN NULL ELSE access_notice3_at END
      WHERE id = $1`,
    [userId, changed ? value : user.access_until, res.planKind, changed],
  );
  return { ...res, user, changed };
}

/**
 * Neuer Grant samt Neuberechnung — in der Transaktion des Aufrufers.
 * @returns { grant (mit effective_from/until), result }
 */
export async function addGrant(client, userId, { source, sourceId = null, kind, days = null, untilAt = null, createdBy = null }, { now, log } = {}) {
  const user = await lockUser(client, userId);
  if (!user) throw new Error('user not found');
  const at = now || await dbNow(client);
  await ensureBaseline(client, user, { now: at, log });
  const { rows } = await client.query(
    `INSERT INTO access_grants (user_id, source, source_id, kind, days, until_at, granted_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [userId, source, sourceId == null ? null : String(sourceId), kind, days, untilAt, at, createdBy],
  );
  const result = await recomputeAccess(client, userId);
  const { rows: g } = await client.query('SELECT * FROM access_grants WHERE id = $1', [rows[0].id]);
  return { grant: g[0], result };
}

/** Rest eines Abschnitts ab `at` (ms). */
function remainingOf(from, until, at) {
  if (from == null || until == null) return 0;
  return Math.max(0, t(until) - Math.max(at, t(from)));
}

/* Alte Semantik für 'set'-Zeilen (Admin, Altbestand), die NACH dem
 * betroffenen Grant entstanden: Sie enthalten dessen Zeit schon. Wird der
 * Grant erstattet oder gekündigt, wird der weggefallene Rest dort abgezogen,
 * nie unter jetzt — genau wie bisher shortenPass in billing.js. */
async function shortenLaterSets(client, userId, grant, removedMs, at) {
  if (removedMs <= 0) return;
  await client.query(
    `UPDATE access_grants
        SET until_at = greatest($4::timestamptz, until_at - make_interval(secs => $5::double precision))
      WHERE user_id = $1 AND kind = 'set' AND until_at IS NOT NULL AND revoked_at IS NULL
        AND (granted_at > $2 OR (granted_at = $2 AND id > $3))`,
    [userId, grant.granted_at, grant.id, new Date(at), removedMs / 1000],
  );
}

/**
 * Widerruf (Erstattung) des Grants einer Bestellung. Nimmt nur diesen
 * Anspruch zurück; Gutscheine, Pilot und andere Bestellungen bleiben.
 * Läuft in der Transaktion des Aufrufers (Bestellzeile ist schon gesperrt).
 */
export async function revokeOrderGrant(client, order, { at, reason = 'withdrawal', log } = {}) {
  if (!order.user_id) return null;
  const user = await lockUser(client, order.user_id);
  if (!user || user.role === 'admin') return null;
  const when = at || await dbNow(client);
  await ensureBaseline(client, user, { now: when, log });
  const { rows } = await client.query(
    `SELECT * FROM access_grants WHERE source = 'order' AND source_id = $1 AND revoked_at IS NULL FOR UPDATE`,
    [String(order.id)],
  );
  const g = rows[0];
  if (!g) return recomputeAccess(client, order.user_id);
  const removed = remainingOf(g.effective_from, g.effective_until, t(when));
  await client.query('UPDATE access_grants SET revoked_at = $2, revoke_reason = $3 WHERE id = $1', [g.id, when, reason]);
  await shortenLaterSets(client, order.user_id, g, removed, t(when));
  return recomputeAccess(client, order.user_id);
}

/**
 * Kündigung: der Abschnitt dieser Bestellung endet spätestens `endsAt`.
 */
export async function capOrderGrant(client, order, endsAt, { at, log } = {}) {
  if (!order.user_id) return null;
  const user = await lockUser(client, order.user_id);
  if (!user || user.role === 'admin') return null;
  const when = at || await dbNow(client);
  await ensureBaseline(client, user, { now: when, log });
  const { rows } = await client.query(
    `SELECT * FROM access_grants WHERE source = 'order' AND source_id = $1 AND revoked_at IS NULL FOR UPDATE`,
    [String(order.id)],
  );
  const g = rows[0];
  if (!g) return recomputeAccess(client, order.user_id);
  const cap = g.ends_at ? Math.min(t(g.ends_at), t(endsAt)) : t(endsAt);
  const before = remainingOf(g.effective_from, g.effective_until, t(when));
  const capped = g.effective_until == null ? null : new Date(Math.max(t(g.effective_from), Math.min(t(g.effective_until), cap)));
  const after = remainingOf(g.effective_from, capped, t(when));
  await client.query('UPDATE access_grants SET ends_at = $2 WHERE id = $1', [g.id, new Date(cap)]);
  await shortenLaterSets(client, order.user_id, g, before - after, t(when));
  return recomputeAccess(client, order.user_id);
}

/* ── Plan mit Herkunft (für /api/me, Mein Pass) ─────────────────────────── */

const LABELS = { order: 'Bewerbungs-Pass', voucher: 'Gutschein', pilot: 'Pilot-Zugang' };

/**
 * planInfo plus die eigenen Berechtigungen:
 *   grants   [{ source, kind, days, grantedAt, from, until, label }] — nur
 *            aktive Zeilen aus Bestellung, Gutschein, Pilot. Admin- und
 *            Altbestands-Zeilen sind Technik und erscheinen nicht.
 *   freeUntil Ende des spätesten noch laufenden oder kommenden Gutschein-
 *            Abschnitts (days); null ohne solchen oder bei lifetime.
 *   hasPaid  es gibt eine bezahlte, nicht widerrufene Bestellung mit Laufzeit.
 */
export async function planDetails(db, user, now = Date.now()) {
  const plan = planInfo(user, now);
  if (!plan) return plan;
  let rows;
  try {
    ({ rows } = await db.query(
      `SELECT source, kind, days, granted_at, effective_from, effective_until
         FROM access_grants WHERE user_id = $1 AND revoked_at IS NULL AND source IN ('order', 'voucher', 'pilot')
        ORDER BY granted_at, id`,
      [user.id],
    ));
  } catch { rows = []; }
  plan.grants = rows.map(g => ({
    source: g.source,
    kind: g.kind,
    days: g.days,
    grantedAt: g.granted_at,
    from: g.effective_from,
    until: g.effective_until,
    label: LABELS[g.source],
  }));
  const free = rows.filter(g => g.source === 'voucher' && g.kind === 'days' && g.effective_until && t(g.effective_until) > now);
  plan.freeUntil = plan.kind === 'lifetime' || !free.length ? null : new Date(Math.max(...free.map(g => t(g.effective_until)))).toISOString();
  plan.hasPaid = rows.some(g => g.source === 'order');
  return plan;
}

/* ── Migration: Grants für den Altbestand ─────────────────────────────────
 *
 * Läuft genau einmal (schema_migrations), unter einer Sperre, damit zwei
 * gleichzeitig startende Instanzen nichts doppelt anlegen. Ändert an users
 * NICHTS: Für jedes Konto wird aus Pilot-Einladung und Bestellungen
 * rekonstruiert, nachgerechnet und verglichen. Passt es, bleiben die Grants
 * stehen. Passt es nicht, kommt zusätzlich eine 'legacy'-Zeile mit dem
 * gespeicherten Wert dazu, und das Startlog nennt das Konto.
 */
export async function migrateGrants(pool, { log = console.log, name = 'access_grants_v1' } = {}) {
  const client = await pool.connect();
  const out = { ran: false, users: 0, withGrants: 0, matched: 0, mismatched: [] };
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7322, 1)');
    const mark = await client.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING name', [name]);
    if (!mark.rowCount) { await client.query('COMMIT'); return out; }
    out.ran = true;
    const now = await dbNow(client);
    const { rows: users } = await client.query(
      `SELECT id, role, signup_source, created_at, access_until, plan_kind FROM users WHERE role <> 'admin' ORDER BY id`,
    );
    for (const u of users) {
      out.users += 1;
      const existing = await loadGrants(client, u.id);
      if (existing.length) continue;   // schon nachgetragen (sollte nicht vorkommen)
      if (u.signup_source !== 'self') {
        const { rows: pil } = await client.query(
          `SELECT c.code, c.access_days FROM invite_redemptions r JOIN invite_codes c ON c.code = r.code
            WHERE r.user_id = $1 AND c.access_days > 0 ORDER BY r.redeemed_at LIMIT 1`,
          [u.id],
        );
        if (pil[0]) {
          await client.query(
            `INSERT INTO access_grants (user_id, source, source_id, kind, days, granted_at) VALUES ($1, 'pilot', $2, 'days', $3, $4)`,
            [u.id, pil[0].code, pil[0].access_days, u.created_at],
          );
        }
      }
      const { rows: orders } = await client.query(
        `SELECT * FROM orders WHERE user_id = $1 AND paid_at IS NOT NULL AND pass_from IS NOT NULL
            AND status IN ('paid', 'withdrawn', 'refunded') ORDER BY paid_at`,
        [u.id],
      );
      for (const o of orders) {
        /* Beginn: Lag pass_from höchstens einen Tag nach der Zahlung, war er
         * der Zeitpunkt der Verarbeitung (oder schloss direkt an) — dann
         * reproduziert granted_at = pass_from die Kette exakt. Sonst schloss
         * der Pass an eine längere Laufzeit an: granted_at = paid_at. */
        const grantedAt = t(o.pass_from) <= t(o.paid_at) + DAY_MS ? o.pass_from : o.paid_at;
        const revoked = o.status !== 'paid';
        const effUntil = o.cancel_effective_at ? new Date(Math.min(t(o.pass_until), t(o.cancel_effective_at))) : o.pass_until;
        await client.query(
          `INSERT INTO access_grants (user_id, source, source_id, kind, days, granted_at, ends_at, revoked_at, revoke_reason, effective_from, effective_until)
           VALUES ($1, 'order', $2, 'days', $3, $4, $5, $6, $7, $8, $9)`,
          [u.id, String(o.id), o.pass_days, grantedAt, o.cancel_effective_at, revoked ? (o.withdrawn_at || o.updated_at) : null,
            revoked ? 'withdrawal' : null, revoked ? o.pass_from : null, revoked ? effUntil : null],
        );
      }
      const grants = await loadGrants(client, u.id);
      if (grants.length) out.withGrants += 1;
      const res = computeAccess(u, grants);
      if (sameUntil(storedValue(res), u.access_until)) {
        out.matched += 1;
        for (const g of grants) {
          if (g.revoked_at) continue;
          const s = res.segments.get(g.id);
          if (s) await client.query('UPDATE access_grants SET effective_from = $2, effective_until = $3 WHERE id = $1', [g.id, s.from, s.until]);
        }
        continue;
      }
      // Abweichung: gespeicherten Wert behalten, als Ausgangswert festhalten.
      await client.query(
        `INSERT INTO access_grants (user_id, source, kind, until_at, granted_at) VALUES ($1, 'legacy', 'set', $2, $3)`,
        [u.id, u.access_until, now],
      );
      const res2 = computeAccess(u, await loadGrants(client, u.id));
      for (const [id, s] of res2.segments) {
        await client.query('UPDATE access_grants SET effective_from = $2, effective_until = $3 WHERE id = $1 AND revoked_at IS NULL', [id, s.from, s.until]);
      }
      const stored = u.access_until ? new Date(u.access_until).toISOString() : 'unbegrenzt';
      const computed = storedValue(res) ? storedValue(res).toISOString() : res.mode;
      out.mismatched.push({ userId: u.id, stored, computed });
      log(`access-grants: Migration: Konto #${u.id} weicht ab (gespeichert ${stored}, berechnet ${computed}) — gespeicherter Wert bleibt, als Ausgangswert übernommen.`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  log(`access-grants: Migration: ${out.users} Konten geprüft, ${out.withGrants} mit nachgetragenen Berechtigungen, ${out.matched} stimmen, ${out.mismatched.length} Abweichung(en)${out.mismatched.length ? ' (siehe oben, nichts überschrieben)' : ''}.`);
  return out;
}
