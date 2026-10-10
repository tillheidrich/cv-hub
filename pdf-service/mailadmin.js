// Admin-Bereich → „E-Mails“ (10.10.2026, MAILS.md, ADMIN.md).
//
// SMTP-Stand und -Einstellungen, Workflows (Schalter, Zeitpunkt, Vorschau,
// Textanpassung), Versandprotokoll und Warteschlange. Alles hinter der
// Admin-Sitzung (guard aus admin.js); jede schreibende Anfrage landet über
// res.locals.audit im vorhandenen Protokoll. Ein SMTP-Passwort steht in
// keiner Antwort und in keinem Protokolleintrag.

import { smtpStatus, verifySmtp, sendMailDetailed, escapeHtml, layout, h, p, withTag } from './mail.js';
import { WORKFLOWS, LANGS, mailLang } from './mailflows.js';
import {
  validateSettings, candidateCfg, saveSettings, setEnabled, deleteSettings, loadSettingsRow, publicSettings, settingsKey, decryptSecret,
} from './mailsettings.js';
import { maskEmail } from './mailqueue.js';

function tplTest({ host, source }) {
  return withTag('admin_test', {
    subject: 'Testmail aus dem Admin-Bereich (E-Mails)',
    html: layout(h('Mailversand klappt') + p(`Diese Mail hast du im Admin-Bereich${host ? ` (${escapeHtml(host)})` : ''} unter „E-Mails“ angefordert. Sie ging über die Einstellungen aus ${source === 'db' ? 'dem Admin-Bereich' : 'der Umgebung'}.`)),
  });
}

/**
 * deps: { pool, mailer, rateLimit, cfg (adminConfig), normHost, auditWrite }
 */
export function mountMailAdmin(app, guard, deps) {
  const { pool, mailer } = deps;
  const wfOf = (req, res) => {
    const id = String(req.params.id || '');
    if (!Object.hasOwn(WORKFLOWS, id)) { res.status(404).json({ error: 'Workflow nicht gefunden.' }); return null; }
    return id;
  };
  const idOf = (req, res) => {
    const id = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(id) || id < 1) { res.status(404).json({ error: 'Nicht gefunden.' }); return null; }
    return id;
  };

  async function state() {
    const row = await loadSettingsRow(pool);
    let key;
    try { const k = settingsKey(); key = { source: k.id === 'k' ? 'MAIL_SETTINGS_KEY' : 'JWT_SECRET (abgeleitet)', warning: k.warning }; }
    catch (err) { key = { source: null, warning: err.message }; }
    return {
      asOf: new Date().toISOString(),
      smtp: smtpStatus(),
      stored: publicSettings(row),
      key,
      precedence: 'Gespeicherte und aktivierte Einstellungen gehen der Umgebung vor. SMTP_FORCE_ENV=1 schaltet sie ab.',
      ...(await mailer.overview()),
    };
  }

  app.get('/api/admin/mail', ...guard, async (_req, res) => res.json(await state()));

  /* ── SMTP ───────────────────────────────────────────────────────────── */

  // Speichern; mit activate: true erst nach bestandener Verbindungsprüfung aktiv.
  app.post('/api/admin/mail/smtp', ...guard, deps.rateLimit({ route: 'admin-smtp', max: 30, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const v = validateSettings(req.body || {});
    if (!v.ok) return res.status(400).json({ error: v.errors.join(' '), errors: v.errors });
    const row = await loadSettingsRow(pool);
    if (row?.password_enc && v.value.password === undefined && decryptSecret(row.password_enc) === null) {
      return res.status(409).json({ error: 'Das gespeicherte Passwort lässt sich nicht mehr entschlüsseln (Schlüssel geändert). Bitte das Passwort neu eingeben.', code: 'password_unreadable' });
    }
    const activate = !!req.body?.activate;
    let verified = false;
    let verifyError = null;
    if (activate) {
      const r = await verifySmtp(candidateCfg(v.value, row));
      verified = r.ok;
      verifyError = r.error || null;
    }
    await saveSettings(pool, v.value, { enabled: activate && verified, verified, adminId: req.user.id });
    const audit = {
      action: 'mail_smtp_save', target: v.value.host,
      details: { port: v.value.port, security: v.value.security, passwordChanged: v.value.password !== undefined, activate, verified },
    };
    // Auch eine gescheiterte Prüfung ist gespeichert worden (inaktiv): ins Protokoll.
    if (activate && !verified) { await deps.auditWrite?.({ adminId: req.user.id, ...audit, req }); res.locals.auditDone = true; }
    else res.locals.audit = audit;
    const out = { ok: !activate || verified, verified, activated: activate && verified, error: activate && !verified ? `Verbindung fehlgeschlagen: ${verifyError}` : null, ...(await state()) };
    res.status(activate && !verified ? 422 : 200).json(out);
  });

  app.post('/api/admin/mail/smtp/enabled', ...guard, async (req, res) => {
    const enabled = !!req.body?.enabled;
    const row = await loadSettingsRow(pool);
    if (!row) return res.status(409).json({ error: 'Es sind keine Einstellungen gespeichert.' });
    if (enabled) {
      const pass = row.password_enc ? decryptSecret(row.password_enc) : '';
      if (pass === null) return res.status(409).json({ error: 'Das gespeicherte Passwort lässt sich nicht entschlüsseln. Bitte neu eingeben.', code: 'password_unreadable' });
      const r = await verifySmtp({ host: row.host, port: row.port, security: row.security, user: row.username || '', pass, from: row.from_addr });
      if (!r.ok) return res.status(422).json({ error: `Verbindung fehlgeschlagen: ${r.error}` });
      await pool.query('UPDATE mail_settings SET verified_at = now() WHERE id = 1');
    }
    await setEnabled(pool, enabled, req.user.id);
    res.locals.audit = { action: enabled ? 'mail_smtp_enable' : 'mail_smtp_disable', target: row.host };
    res.json({ ok: true, ...(await state()) });
  });

  app.post('/api/admin/mail/smtp/delete', ...guard, async (req, res) => {
    await deleteSettings(pool);
    res.locals.audit = { action: 'mail_smtp_delete', target: null };
    res.json({ ok: true, ...(await state()) });
  });

  app.post('/api/admin/mail/test', ...guard, deps.rateLimit({ route: 'admin-testmail', max: 5, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const to = deps.cfg.email || req.user.email;
    if (!to) return res.status(409).json({ error: 'ADMIN_EMAIL fehlt und im Admin-Konto steht keine Adresse.' });
    const r = await sendMailDetailed({ to, ...tplTest({ host: deps.cfg.host || deps.normHost(req.headers.host), source: smtpStatus().source }) });
    res.locals.audit = { action: 'test_mail', target: null, details: { ok: r.ok, area: 'mail' } };
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, to: maskEmail(to), error: r.ok ? null : (r.error || 'Versand fehlgeschlagen') });
  });

  /* ── Workflows ──────────────────────────────────────────────────────── */

  app.get('/api/admin/mail/workflows/:id/texts', ...guard, async (req, res) => {
    const id = wfOf(req, res); if (!id) return;
    res.json(await mailer.texts(id, mailLang(req.query.lang)));
  });

  app.post('/api/admin/mail/workflows/:id', ...guard, async (req, res) => {
    const id = wfOf(req, res); if (!id) return;
    const body = {};
    for (const k of ['enabled', 'timing', 'overrides']) if (req.body?.[k] !== undefined) body[k] = req.body[k];
    const r = await mailer.saveWorkflow(id, body, req.user.id);
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.locals.audit = {
      action: 'mail_workflow_save', target: id,
      details: { enabled: body.enabled, timing: body.timing, overrides: body.overrides ? Object.fromEntries(Object.entries(body.overrides).map(([l, o]) => [l, o === null ? 'zurückgesetzt' : 'angepasst'])) : undefined },
    };
    res.json({ ok: true, settings: r.settings });
  });

  // Vorschau als JSON (auch für ungespeicherte Entwürfe). Liest nur: kein Protokoll.
  app.post('/api/admin/mail/preview', ...guard, async (req, res) => {
    const id = String(req.body?.workflow || '');
    if (!Object.hasOwn(WORKFLOWS, id)) return res.status(404).json({ error: 'Workflow nicht gefunden.' });
    const lang = LANGS.includes(req.body?.lang) ? req.body.lang : 'de';
    const r = await mailer.preview(id, lang, req.body?.draft || null);
    res.locals.auditDone = true;
    if (!r.ok) return res.status(400).json({ error: r.error });
    res.json(r);
  });

  // Gestaltete Vorschau als eigene Seite (neuer Tab). Eigene, enge CSP: keine
  // Skripte, nur Inline-Stile der Mail, keine fremden Quellen.
  app.get('/api/admin/mail/preview.html', ...guard, async (req, res) => {
    const id = String(req.query.workflow || '');
    if (!Object.hasOwn(WORKFLOWS, id)) return res.status(404).type('text/plain').send('Workflow nicht gefunden.');
    const r = await mailer.preview(id, mailLang(req.query.lang));
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.type('html').send(r.html.replace('<html>', `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(r.subject)}</title></head>`));
  });

  /* ── Protokoll und Warteschlange ────────────────────────────────────── */

  app.get('/api/admin/mail/log', ...guard, async (_req, res) => {
    res.locals.audit = { action: 'mail_log_view', target: null };
    res.json({ asOf: new Date().toISOString(), ...(await mailer.logList()) });
  });

  app.get('/api/admin/mail/queue', ...guard, async (req, res) => {
    res.locals.audit = { action: 'mail_queue_view', target: req.query.status ? String(req.query.status).slice(0, 20) : null };
    res.json({ asOf: new Date().toISOString(), smtpConfigured: smtpStatus().configured, ...(await mailer.queueList(req.query.status)) });
  });

  app.post('/api/admin/mail/queue/:id/send', ...guard, async (req, res) => {
    const id = idOf(req, res); if (!id) return;
    const r = await mailer.sendNow(id);
    res.locals.audit = { action: 'mail_queue_send', target: id, details: { status: r.status || null } };
    res.status(r.ok ? 200 : r.status === 'waiting_smtp' ? 409 : 422).json(r);
  });

  app.post('/api/admin/mail/queue/:id/discard', ...guard, async (req, res) => {
    const id = idOf(req, res); if (!id) return;
    const r = await mailer.discard(id);
    if (!r.ok) return res.status(409).json({ error: 'Nicht (mehr) in der Warteschlange.' });
    res.locals.audit = { action: 'mail_queue_discard', target: id };
    res.json(r);
  });

  app.post('/api/admin/mail/queue/waiting', ...guard, async (req, res) => {
    const action = req.body?.action === 'discard' ? 'discard' : 'send';
    if (action === 'send' && !smtpStatus().configured) return res.status(409).json({ error: 'SMTP ist nicht eingerichtet.' });
    const r = await mailer.bulkWaiting(action);
    res.locals.audit = { action: action === 'discard' ? 'mail_queue_discard_waiting' : 'mail_queue_send_waiting', target: null, details: r };
    res.json({ ok: true, ...r });
  });

  // Jetzt abarbeiten (statt auf den nächsten Takt zu warten).
  app.post('/api/admin/mail/run', ...guard, async (_req, res) => {
    const scan = await mailer.scanDue();
    const processed = await mailer.processQueue({ limit: 100 });
    res.locals.audit = { action: 'mail_queue_run', target: null, details: { scan, processed } };
    res.json({ ok: true, scan, processed });
  });
}
