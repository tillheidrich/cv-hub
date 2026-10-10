// Warteschlange und Abläufe der E-Mail-Workflows (10.10.2026, MAILS.md).
//
// Grundsätze:
//  - Jede Workflow-Mail entsteht als Zeile in mail_queue, mit einem
//    Schlüssel aus Workflow, Konto und Anlass. Dieselbe Mail entsteht
//    höchstens einmal (ON CONFLICT DO NOTHING), auch bei zwei Instanzen.
//  - Ohne SMTP geht nichts verloren: Die Zeile bekommt den Status
//    „waiting_smtp“. Sie wird NICHT von selbst gesendet, sobald SMTP da ist;
//    der Admin sieht sie und sendet oder verwirft (sonst kämen nach Wochen
//    lauter veraltete Mails auf einmal).
//  - Fehler beim Senden: bis zu 5 Versuche mit wachsendem Abstand
//    (1 min, 5 min, 30 min, 2 h, 12 h), danach „failed“.
//  - Erst beim Senden wird geprüft, ob die Mail noch stimmt: Konto da, nicht
//    gesperrt, Adresse da, Workflow an, bei Tipps die Einwilligung wirksam,
//    bei Hinweisen zur Laufzeit dasselbe Enddatum. Sonst „skipped“ mit Grund.
//  - Die Adresse steht nicht in der Warteschlange, sie kommt beim Senden aus
//    dem Konto. Im Protokoll steht sie nur gekürzt.

import { sendMailDetailed, isMailConfigured } from './mail.js';
import { WORKFLOWS, TIPS_WORKFLOWS, TIPS_CONSENT_VERSION, mailLang, renderWorkflow, sampleCtx, textFor, validateOverride, validateTiming, defaultTextPlain, LANGS } from './mailflows.js';
import { unsubscribeToken, verifyUnsubscribeToken } from './mailsettings.js';
import { planInfo, startAccessNotices } from './access.js';

const DAY_MS = 86_400_000;
export const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length;

export function maskEmail(e) {
  const [u, d] = String(e || '').split('@');
  if (!d) return null;
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}`;
}
const dayKey = d => new Date(d).toISOString().slice(0, 10);
const sameMinute = (a, b) => a && b && Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60_000;

/**
 * deps: { pool, base (PUBLIC_BASE_URL ohne / am Ende oder null), apiBase
 * (Adresse der API für den One-Click-Abmeldelink, Standard base + '/pdfapi'),
 * seller, log, send (sendMailDetailed), configured (isMailConfigured) }
 */
export function createMailer(deps) {
  const { pool } = deps;
  const log = deps.log || console.log;
  const send = deps.send || sendMailDetailed;
  const configured = deps.configured || isMailConfigured;
  const base = deps.base ? String(deps.base).replace(/\/+$/, '') : null;
  const apiBase = deps.apiBase ? String(deps.apiBase).replace(/\/+$/, '') : (base ? `${base}/pdfapi` : null);

  /* ── Einstellungen je Workflow ─────────────────────────────────────── */

  async function settings(db = pool) {
    const { rows } = await db.query('SELECT * FROM mail_workflow_settings');
    const byId = Object.fromEntries(rows.map(r => [r.workflow, r]));
    const out = {};
    for (const [id, wf] of Object.entries(WORKFLOWS)) {
      const r = byId[id];
      out[id] = {
        enabled: r?.enabled ?? wf.defaultEnabled,
        timing: { ...wf.timing, ...(r?.timing || {}) },
        overrides: r?.overrides || null,
        updatedAt: r?.updated_at || null,
      };
    }
    return out;
  }

  async function logMail({ workflow, queueId = null, to = null, status, error = null }, db = pool) {
    try {
      await db.query('INSERT INTO mail_log (workflow, queue_id, to_masked, status, error) VALUES ($1, $2, $3, $4, $5)',
        [String(workflow || 'sonstige').slice(0, 60), queueId, to ? maskEmail(to) : null, status, error ? String(error).slice(0, 300) : null]);
    } catch (err) { log(`mail: Protokoll fehlgeschlagen (${err?.message || err})`); }
  }

  /* ── Einreihen ─────────────────────────────────────────────────────── */

  let kickTimer = null;
  /** Arbeitet die Schlange gleich ab (entprellt), wenn der Job läuft. */
  function kick() {
    if (!running || kickTimer) return;
    kickTimer = setTimeout(() => { kickTimer = null; processQueue().catch(err => log(`mail-queue: ${err?.message || err}`)); }, 50);
    kickTimer.unref?.();
  }

  /**
   * Legt eine Mail an. occasion macht sie eindeutig (z. B. Enddatum).
   * Gibt { queued, id?, reason? } zurück; doppelt = queued false, 'duplicate'.
   */
  async function enqueue(workflow, userId, occasion, params = {}, { dueAt = null, db = pool } = {}) {
    if (!WORKFLOWS[workflow]) throw new Error(`unbekannter Workflow ${workflow}`);
    const s = (await settings(db))[workflow];
    if (!s.enabled) return { queued: false, reason: 'disabled' };
    const key = `${workflow}:${userId}:${occasion}`;
    const { rows } = await db.query(
      `INSERT INTO mail_queue (workflow, dedupe_key, user_id, params, due_at)
       VALUES ($1, $2, $3, $4, coalesce($5, now()))
       ON CONFLICT (dedupe_key) DO NOTHING RETURNING id, due_at`,
      [workflow, key, userId, JSON.stringify(params || {}), dueAt],
    );
    if (!rows[0]) return { queued: false, reason: 'duplicate' };
    if (new Date(rows[0].due_at).getTime() <= Date.now() + 1000) kick();
    return { queued: true, id: Number(rows[0].id) };
  }

  /* ── Senden ────────────────────────────────────────────────────────── */

  async function setRow(id, fields) {
    const keys = Object.keys(fields);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE mail_queue SET ${sets}, locked_until = NULL, updated_at = now() WHERE id = $1`, [id, ...keys.map(k => fields[k])]);
  }

  async function prefsOf(userId) {
    return (await pool.query('SELECT * FROM mail_prefs WHERE user_id = $1', [userId])).rows[0] || null;
  }

  /** Warum eine Mail nicht (mehr) gehen soll, oder null. */
  async function skipReason(row, user, wfSet, { manual }) {
    const wf = WORKFLOWS[row.workflow];
    if (!wf) return 'unbekannter Workflow';
    if (!manual && !wfSet.enabled) return 'Workflow abgeschaltet';
    if (!user) return 'Konto gelöscht';
    if (user.disabled) return 'Konto gesperrt';
    if (!user.email) return 'keine Adresse im Konto';
    const params = row.params || {};
    if (!manual && Date.now() - new Date(row.due_at).getTime() > wf.maxAgeDays * DAY_MS) return 'veraltet';
    if (wf.kind === 'tips') {
      const pr = await prefsOf(user.id);
      if (!pr?.tips_consent_at || pr.tips_withdrawn_at && new Date(pr.tips_withdrawn_at) > new Date(pr.tips_consent_at)) return 'keine Einwilligung';
      if (!user.email_confirmed_at) return 'Adresse nicht bestätigt';
      if (!base) return 'PUBLIC_BASE_URL fehlt (kein Abmeldelink)';
    }
    if (row.workflow === 'pass_ending' || row.workflow === 'access_ending') {
      if (!sameMinute(user.access_until, params.until) || new Date(user.access_until).getTime() <= Date.now()) return 'Laufzeit hat sich geändert';
    }
    if (row.workflow === 'pass_expired') {
      if (user.plan_kind !== 'pass' || !sameMinute(user.access_until, params.until) || new Date(user.access_until).getTime() > Date.now()) return 'Pass läuft wieder oder wurde widerrufen';
    }
    return null;
  }

  async function renderRow(row, user, wfSet) {
    const lang = mailLang(user.mail_lang);
    const params = row.params || {};
    const until = params.until || user.access_until;
    const ctx = {
      user, base, plan: planInfo(user), until,
      daysLeft: until ? Math.max(1, Math.ceil((new Date(until).getTime() - Date.now()) / DAY_MS)) : null,
      grantUntil: params.grantUntil || null, lifetime: !!params.lifetime,
    };
    const opts = { overrides: wfSet.overrides, seller: deps.seller || null };
    if (WORKFLOWS[row.workflow].kind === 'tips') {
      const pr = await prefsOf(user.id);
      const tok = unsubscribeToken(user.id);
      opts.consentAt = pr?.tips_consent_at;
      opts.unsubscribeUrl = `${base}/mail/abmelden?token=${encodeURIComponent(tok)}`;
      opts.oneClickUrl = apiBase ? `${apiBase}/api/mail/unsubscribe?token=${encodeURIComponent(tok)}` : null;
    }
    return renderWorkflow(row.workflow, lang, ctx, opts);
  }

  /**
   * Eine Zeile senden. manual = Admin hat „senden“ gedrückt (dann gelten
   * Abschalten und Alter nicht, SMTP muss trotzdem da sein).
   * Gibt { status, error? } zurück.
   */
  async function deliverRow(row, { manual = false } = {}) {
    const all = await settings();
    const wfSet = all[row.workflow] || { enabled: false };
    if (!configured()) {
      if (row.status !== 'waiting_smtp') {
        await setRow(row.id, { status: 'waiting_smtp', last_error: 'SMTP nicht eingerichtet' });
        await logMail({ workflow: row.workflow, queueId: row.id, status: 'waiting_smtp' });
      } else await setRow(row.id, { status: 'waiting_smtp' });
      return { status: 'waiting_smtp' };
    }
    const user = row.user_id ? (await pool.query('SELECT * FROM users WHERE id = $1', [row.user_id])).rows[0] : null;
    const reason = await skipReason(row, user, wfSet, { manual });
    if (reason) {
      await setRow(row.id, { status: 'skipped', last_error: reason });
      await logMail({ workflow: row.workflow, queueId: row.id, to: user?.email, status: 'skipped', error: reason });
      return { status: 'skipped', error: reason };
    }
    let mail;
    try { mail = await renderRow(row, user, wfSet); }
    catch (err) {
      await setRow(row.id, { status: 'failed', last_error: `Rendern: ${err?.message || err}`.slice(0, 300) });
      return { status: 'failed', error: 'Rendern fehlgeschlagen' };
    }
    const r = await send({ to: user.email, ...mail, tag: row.workflow, queueId: row.id });
    if (r.ok) {
      await setRow(row.id, { status: 'sent', sent_at: new Date(), last_error: null, attempts: (row.attempts || 0) + 1 });
      return { status: 'sent' };
    }
    if (r.notConfigured) {
      await setRow(row.id, { status: 'waiting_smtp', last_error: 'SMTP nicht eingerichtet' });
      return { status: 'waiting_smtp' };
    }
    const attempts = (row.attempts || 0) + 1;
    const final = manual || attempts >= MAX_ATTEMPTS;
    await setRow(row.id, {
      status: final ? 'failed' : 'pending', attempts, last_error: r.error || 'Versand fehlgeschlagen',
      due_at: final ? row.due_at : new Date(Date.now() + BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] * 60_000),
    });
    return { status: final ? 'failed' : 'retry', error: r.error };
  }

  /** Fällige Zeilen abarbeiten. Gibt Zähler je Status zurück. */
  async function processQueue({ limit = 25 } = {}) {
    // Abgestürzte Läufe: „sending“ mit abgelaufener Sperre wieder freigeben.
    await pool.query(`UPDATE mail_queue SET status = 'pending', locked_until = NULL WHERE status = 'sending' AND locked_until < now()`);
    const { rows } = await pool.query(
      `UPDATE mail_queue SET status = 'sending', locked_until = now() + interval '5 minutes', updated_at = now()
        WHERE id IN (SELECT id FROM mail_queue WHERE status = 'pending' AND due_at <= now()
                      ORDER BY due_at, id LIMIT $1 FOR UPDATE SKIP LOCKED)
        RETURNING *`, [limit]);
    const out = {};
    for (const row of rows) {
      let r;
      try { r = await deliverRow(row); }
      catch (err) {
        log(`mail-queue: #${row.id} ${err?.message || err}`);
        await setRow(row.id, { status: 'pending', last_error: String(err?.message || err).slice(0, 300), due_at: new Date(Date.now() + 5 * 60_000) }).catch(() => {});
        r = { status: 'error' };
      }
      out[r.status] = (out[r.status] || 0) + 1;
    }
    return out;
  }

  /* ── Zeitgesteuerte Anlässe ────────────────────────────────────────── */

  /** Pass abgelaufen und Tipps: was fällig ist, einreihen. */
  async function scanDue() {
    const s = await settings();
    const out = { pass_expired: 0, tips: 0 };
    if (s.pass_expired.enabled) {
      const after = s.pass_expired.timing.afterDays || 0;
      const { rows } = await pool.query(
        `SELECT id, access_until FROM users
          WHERE plan_kind = 'pass' AND role <> 'admin' AND NOT disabled AND email IS NOT NULL
            AND access_until <= now() - make_interval(days => $1)
            AND access_until >  now() - make_interval(days => $1 + 7)`, [after]);
      for (const u of rows) {
        const r = await enqueue('pass_expired', u.id, dayKey(u.access_until), { until: u.access_until });
        if (r.queued) out.pass_expired += 1;
      }
    }
    for (const wf of TIPS_WORKFLOWS) {
      if (!s[wf].enabled) continue;
      const delay = s[wf].timing.delayDays ?? WORKFLOWS[wf].timing.delayDays;
      const { rows } = await pool.query(
        `SELECT p.user_id FROM mail_prefs p JOIN users u ON u.id = p.user_id
          WHERE p.tips_consent_at IS NOT NULL AND NOT u.disabled AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL
            AND p.tips_consent_at + make_interval(days => $1) <= now()
            AND p.tips_consent_at + make_interval(days => $1) > now() - interval '5 days'`, [delay]);
      for (const u of rows) {
        const r = await enqueue(wf, u.user_id, 'v1');
        if (r.queued) out.tips += 1;
      }
    }
    return out;
  }

  /** Optionen für runAccessNotices: Tage und Schalter, Einreihen statt senden. */
  async function accessNoticeOptions() {
    const s = await settings();
    const timing = {};
    for (const wf of ['pass_ending', 'access_ending']) timing[wf] = { ...s[wf].timing, enabled: s[wf].enabled };
    return {
      timing,
      deliver: async (u, { workflow, kind }) => {
        const r = await enqueue(workflow, u.id, `${dayKey(u.access_until)}:${kind}`, { until: u.access_until, kind });
        return r.queued || r.reason === 'duplicate';
      },
    };
  }

  let running = false;
  const timers = [];
  /** Startet die Jobs: Schlange jede Minute, Anlässe alle 10 Minuten,
   *  Hinweise vor Laufzeitende alle 6 Stunden (wie bisher). */
  function start({ everyMs = 60_000, accessNotices = true } = {}) {
    running = true;
    let n = 0;
    const tick = async () => {
      if (n++ % 10 === 0) await scanDue();
      const r = await processQueue();
      if (Object.keys(r).length) log(`mail-queue: ${Object.entries(r).map(([k, v]) => `${k}=${v}`).join(' ')}`);
    };
    tick().catch(err => log(`mail-queue failed: ${err?.message || err}`));
    const t = setInterval(() => tick().catch(err => log(`mail-queue failed: ${err?.message || err}`)), everyMs);
    t.unref?.();
    timers.push(t);
    if (accessNotices) timers.push(startAccessNotices(pool, { base, log, options: accessNoticeOptions }));
  }
  function stop() { running = false; for (const t of timers) clearInterval(t); }

  /* ── Einwilligung in Tipps ─────────────────────────────────────────── */

  function prefsView(user, pr) {
    const on = !!pr?.tips_consent_at && !(pr.tips_withdrawn_at && new Date(pr.tips_withdrawn_at) > new Date(pr.tips_consent_at));
    return {
      tips: on ? 'on' : pr?.tips_requested_at ? 'pending' : 'off',
      consentAt: on ? pr.tips_consent_at : null,
      consentVersion: on ? pr.tips_consent_version : null,
      requestedAt: pr?.tips_requested_at || null,
      withdrawnAt: pr?.tips_withdrawn_at || null,
      version: TIPS_CONSENT_VERSION,
      lang: user?.mail_lang || null,
      emailConfirmed: !!user?.email_confirmed_at,
      hasEmail: !!user?.email,
    };
  }

  async function prefs(user) { return prefsView(user, await prefsOf(user.id)); }

  /**
   * Häkchen bei der Registrierung oder Schalter in den Einstellungen.
   * Bestätigte Adresse: sofort wirksam. Sonst „pending“ bis zum Klick auf den
   * Bestätigungslink (Double-Opt-in); der Aufrufer schickt den Link.
   */
  async function requestTips(user, source, db = pool) {
    const confirmed = !!user.email_confirmed_at;
    await db.query(
      `INSERT INTO mail_prefs (user_id, tips_requested_at, tips_requested_version, tips_consent_at, tips_consent_version, tips_consent_source, updated_at)
       VALUES ($1, CASE WHEN $2 THEN NULL ELSE now() END, CASE WHEN $2 THEN NULL ELSE $3 END,
               CASE WHEN $2 THEN now() END, CASE WHEN $2 THEN $3 END, $4, now())
       ON CONFLICT (user_id) DO UPDATE SET
         tips_requested_at = CASE WHEN $2 THEN NULL ELSE now() END,
         tips_requested_version = CASE WHEN $2 THEN NULL ELSE $3 END,
         tips_consent_at = CASE WHEN $2 THEN now() ELSE mail_prefs.tips_consent_at END,
         tips_consent_version = CASE WHEN $2 THEN $3 ELSE mail_prefs.tips_consent_version END,
         tips_consent_source = $4, updated_at = now()`,
      [user.id, confirmed, TIPS_CONSENT_VERSION, source],
    );
    return confirmed ? 'on' : 'pending';
  }

  /** Nach dem Klick auf den Bestätigungslink: wartende Einwilligung wirksam. */
  async function confirmPendingTips(userId, db = pool) {
    const { rowCount } = await db.query(
      `UPDATE mail_prefs SET tips_consent_at = now(), tips_consent_version = tips_requested_version,
              tips_requested_at = NULL, tips_requested_version = NULL, updated_at = now()
        WHERE user_id = $1 AND tips_requested_at IS NOT NULL`, [userId]);
    return rowCount > 0;
  }

  /** Widerruf. via: settings | link | one-click | admin. Wartende Tipps fallen weg. */
  async function withdrawTips(userId, via) {
    const { rows } = await pool.query(
      `UPDATE mail_prefs SET tips_withdrawn_at = now(), tips_withdrawn_via = $2,
              tips_consent_at = NULL, tips_consent_version = NULL, tips_requested_at = NULL, tips_requested_version = NULL, updated_at = now()
        WHERE user_id = $1 AND (tips_consent_at IS NOT NULL OR tips_requested_at IS NOT NULL) RETURNING user_id`, [userId, via]);
    await pool.query(
      `UPDATE mail_queue SET status = 'discarded', last_error = 'abgemeldet', updated_at = now()
        WHERE user_id = $1 AND workflow = ANY($2) AND status IN ('pending', 'waiting_smtp', 'failed')`, [userId, TIPS_WORKFLOWS]);
    if (rows[0]) await logMail({ workflow: 'tips', status: 'unsubscribed', error: via });
    return rows.length > 0;
  }

  /** Abmeldung per Token (Seite oder One-Click). { ok, changed } */
  async function unsubscribeByToken(token, via) {
    const uid = verifyUnsubscribeToken(token);
    if (!uid) return { ok: false };
    const exists = (await pool.query('SELECT 1 FROM users WHERE id = $1', [uid])).rowCount;
    if (!exists) return { ok: true, changed: false };
    return { ok: true, changed: await withdrawTips(uid, via) };
  }

  /* ── Admin ─────────────────────────────────────────────────────────── */

  async function counters() {
    const { rows } = await pool.query(
      `SELECT workflow, status, count(*)::int AS n FROM mail_log
        WHERE created_at > now() - interval '90 days' GROUP BY workflow, status`);
    const q = await pool.query(`SELECT workflow, status, count(*)::int AS n FROM mail_queue WHERE status IN ('pending', 'waiting_smtp', 'failed') GROUP BY workflow, status`);
    return { log: rows, queue: q.rows };
  }

  async function overview() {
    const s = await settings();
    const c = await counters();
    const n = (rows, wf, st) => rows.filter(r => r.workflow === wf && r.status === st).reduce((a, r) => a + r.n, 0);
    const unsub = n(c.log, 'tips', 'unsubscribed');
    const consent = (await pool.query(
      `SELECT count(*) FILTER (WHERE tips_consent_at IS NOT NULL)::int AS on,
              count(*) FILTER (WHERE tips_requested_at IS NOT NULL AND tips_consent_at IS NULL)::int AS pending,
              count(*) FILTER (WHERE tips_withdrawn_at IS NOT NULL AND tips_consent_at IS NULL)::int AS withdrawn
         FROM mail_prefs`)).rows[0];
    const workflows = Object.entries(WORKFLOWS).map(([id, wf]) => ({
      id, kind: wf.kind, label: wf.label, trigger: wf.trigger, legal: wf.legal,
      defaultEnabled: wf.defaultEnabled, enabled: s[id].enabled,
      timing: s[id].timing, defaultTiming: wf.timing, timingFields: wf.timingFields,
      overridable: wf.overridable, placeholders: wf.placeholders,
      customized: LANGS.filter(l => s[id].overrides?.[l] && Object.keys(s[id].overrides[l]).length),
      counts: {
        sent: n(c.log, id, 'sent'), failed: n(c.log, id, 'failed'), skipped: n(c.log, id, 'skipped'),
        unsubscribed: wf.kind === 'tips' ? unsub : null,
        pending: n(c.queue, id, 'pending'), waiting: n(c.queue, id, 'waiting_smtp'), queueFailed: n(c.queue, id, 'failed'),
      },
    }));
    return { workflows, consent, countsDays: 90, base: base || null };
  }

  /** Texte einer Sprache für den Editor: Standard, Anpassung, Platzhalter. */
  async function texts(id, lang) {
    const s = (await settings())[id];
    return { workflow: id, lang, default: defaultTextPlain(id, lang), override: s.overrides?.[lang] || null, placeholders: WORKFLOWS[id].placeholders };
  }

  /** Vorschau mit Beispielwerten. draft = ungespeicherte Anpassung. */
  async function preview(id, lang, draft = null) {
    const s = (await settings())[id];
    let overrides = s.overrides;
    if (draft) {
      const v = validateOverride(id, draft);
      if (!v.ok) return { ok: false, error: v.error };
      overrides = { ...(overrides || {}), [lang]: v.value };
    }
    const b = base || 'https://cv.example.org';
    const ctx = sampleCtx(id, b);
    const opts = { overrides, seller: deps.seller || null };
    if (WORKFLOWS[id].kind === 'tips') {
      opts.consentAt = new Date();
      opts.unsubscribeUrl = `${b}/mail/abmelden?token=BEISPIEL`;
      opts.oneClickUrl = `${apiBase || `${b}/pdfapi`}/api/mail/unsubscribe?token=BEISPIEL`;
    }
    const m = renderWorkflow(id, lang, ctx, opts);
    return { ok: true, subject: m.subject, html: m.html, text: m.text, headers: m.headers || {}, customized: !!textFor(id, lang, overrides)?.customized };
  }

  /** Schalter, Zeitpunkt, Anpassungen speichern. overrides: { de: {…} | null } */
  async function saveWorkflow(id, body, adminId) {
    const wf = WORKFLOWS[id];
    const cur = (await pool.query('SELECT * FROM mail_workflow_settings WHERE workflow = $1', [id])).rows[0];
    let enabled = cur?.enabled ?? null;
    let timing = cur?.timing || {};
    let overrides = cur?.overrides || {};
    if (body.enabled !== undefined) enabled = !!body.enabled;
    if (body.timing !== undefined) {
      const v = validateTiming(id, body.timing);
      if (!v.ok) return { ok: false, error: v.error };
      timing = { ...timing, ...v.value };
    }
    if (body.overrides !== undefined) {
      if (!wf.overridable) return { ok: false, error: 'Dieser Text lässt sich nicht anpassen.' };
      for (const [lang, o] of Object.entries(body.overrides || {})) {
        if (!LANGS.includes(lang)) return { ok: false, error: `Sprache ${lang} unbekannt.` };
        if (o === null) { delete overrides[lang]; continue; }
        const v = validateOverride(id, o);
        if (!v.ok) return { ok: false, error: `${lang}: ${v.error}` };
        if (Object.keys(v.value).length) overrides[lang] = v.value; else delete overrides[lang];
      }
    }
    await pool.query(
      `INSERT INTO mail_workflow_settings (workflow, enabled, timing, overrides, updated_at, updated_by)
       VALUES ($1, $2, $3, $4, now(), $5)
       ON CONFLICT (workflow) DO UPDATE SET enabled = EXCLUDED.enabled, timing = EXCLUDED.timing,
         overrides = EXCLUDED.overrides, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [id, enabled, JSON.stringify(timing), Object.keys(overrides).length ? JSON.stringify(overrides) : null, adminId ?? null]);
    return { ok: true, settings: (await settings())[id] };
  }

  async function queueList(status) {
    const st = ['pending', 'waiting_smtp', 'failed', 'sent', 'skipped', 'discarded', 'sending'].includes(status) ? status : null;
    const { rows } = await pool.query(
      `SELECT q.id, q.workflow, q.status, q.due_at, q.attempts, q.last_error, q.created_at, q.sent_at, q.user_id, u.email
         FROM mail_queue q LEFT JOIN users u ON u.id = q.user_id
        WHERE ($1::text IS NULL AND q.status IN ('pending', 'waiting_smtp', 'failed', 'sending')) OR q.status = $1
        ORDER BY q.created_at DESC LIMIT 200`, [st]);
    const counts = (await pool.query(`SELECT status, count(*)::int AS n FROM mail_queue GROUP BY status`)).rows;
    return { entries: rows.map(({ email, ...r }) => ({ ...r, id: Number(r.id), to: maskEmail(email) })), counts };
  }

  async function logList() {
    const { rows } = await pool.query(
      `SELECT id, created_at, workflow, queue_id, to_masked, status, error FROM mail_log ORDER BY id DESC LIMIT 200`);
    return { entries: rows.map(r => ({ ...r, id: Number(r.id), queue_id: r.queue_id == null ? null : Number(r.queue_id) })), retentionDays: 90 };
  }

  /** Admin: eine Zeile jetzt senden. */
  async function sendNow(id) {
    if (!configured()) return { ok: false, status: 'waiting_smtp', error: 'SMTP ist nicht eingerichtet.' };
    const { rows } = await pool.query(
      `UPDATE mail_queue SET status = 'sending', locked_until = now() + interval '5 minutes', updated_at = now()
        WHERE id = $1 AND status IN ('pending', 'waiting_smtp', 'failed') RETURNING *`, [id]);
    if (!rows[0]) return { ok: false, error: 'Nicht in der Warteschlange (schon gesendet oder verworfen).' };
    const r = await deliverRow(rows[0], { manual: true });
    return { ok: r.status === 'sent', ...r };
  }

  async function discard(id) {
    const { rowCount } = await pool.query(
      `UPDATE mail_queue SET status = 'discarded', last_error = 'vom Admin verworfen', locked_until = NULL, updated_at = now()
        WHERE id = $1 AND status IN ('pending', 'waiting_smtp', 'failed')`, [id]);
    if (rowCount) {
      const { rows } = await pool.query('SELECT workflow FROM mail_queue WHERE id = $1', [id]);
      await logMail({ workflow: rows[0].workflow, queueId: id, status: 'discarded', error: 'vom Admin verworfen' });
    }
    return { ok: rowCount > 0 };
  }

  /** Alle wartenden (ohne SMTP) senden bzw. verwerfen. */
  async function bulkWaiting(action) {
    const { rows } = await pool.query(`SELECT id FROM mail_queue WHERE status = 'waiting_smtp' ORDER BY id LIMIT 500`);
    const out = { total: rows.length, sent: 0, failed: 0, skipped: 0, discarded: 0, waiting: 0 };
    for (const { id } of rows) {
      if (action === 'discard') { if ((await discard(Number(id))).ok) out.discarded += 1; continue; }
      const r = await sendNow(Number(id));
      if (r.status === 'sent') out.sent += 1;
      else if (r.status === 'skipped') out.skipped += 1;
      else if (r.status === 'waiting_smtp') { out.waiting += 1; break; }
      else out.failed += 1;
    }
    return out;
  }

  return {
    settings, enqueue, processQueue, scanDue, deliverRow, accessNoticeOptions, start, stop, kick, logMail,
    prefs, requestTips, confirmPendingTips, withdrawTips, unsubscribeByToken,
    overview, texts, preview, saveWorkflow, queueList, logList, sendNow, discard, bulkWaiting,
    get base() { return base; }, get apiBase() { return apiBase; },
  };
}
