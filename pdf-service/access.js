// Laufzeit je Konto (Pilot, 08.10.2026).
//
// Gegenprüfung H2 / Startup-Bericht Bau-Liste 3: invite_codes.expires_at
// begrenzte nur das Einlösen, nicht die Nutzung. Ein Pilot mit „10 Plätzen für
// 90 Tage" war damit nicht abbildbar. Jetzt trägt der Code optional
// access_days, beim Einlösen entsteht users.access_until.
//
// Regeln, die hier stehen und nirgends sonst:
// - access_until NULL = unbegrenzt (alle Konten von vor dieser Änderung).
// - Nach Ablauf: lesen und exportieren ja, ändern nein. Gelöscht wird nichts.
// - 14 und 3 Tage vorher je eine Mail mit dem Hinweis auf die Ausgänge.
// - Admin-Konten laufen nie ab.
//
// Gesperrt nach Ablauf (requireWritable in server.js): Profil anlegen,
// speichern, umbenennen, Markdown-Import (auch dryRun), Version wiederher-
// stellen, Foto hochladen, Sharelink anlegen oder auffrischen, Anschreiben in
// einem Link wieder einschalten.
// Bewusst NICHT gesperrt: alles Lesen, PDF (/api/pdf), Markdown-Abruf,
// Datenexport (/api/me/export), Ereignisse (/api/events), Profil oder Foto
// löschen, Sharelink widerrufen, Konto löschen (Art. 17 DSGVO — wer nicht
// mehr schreiben darf, muss trotzdem löschen dürfen), Passwort, E-Mail, 2FA,
// API-Schlüssel (der MCP-Weg ist auch ein Exportweg; seine Schreibaufrufe
// laufen über dieselben gesperrten Routen).

import { sendMail, tplAccessEnding } from './mail.js';
import { tplPassEnding } from './mailtexts/index.js';

const DAY_MS = 86_400_000;
export const NOTICE_DAYS = { soon: 14, final: 3 };
/** Obergrenze für access_days und Verlängerungen: zehn Jahre. */
export const MAX_ACCESS_DAYS = 3650;

/** Ist die Laufzeit dieses Kontos vorbei? Admins: nie. */
export function isAccessExpired(user, now = Date.now()) {
  if (!user || user.role === 'admin' || user.plan_kind === 'lifetime' || !user.access_until) return false;
  return new Date(user.access_until).getTime() <= now;
}

/**
 * Das Feld für /api/auth/me und /api/me. null = unbegrenzt.
 * notice: 'soon' (≤ 14 Tage), 'final' (≤ 3 Tage), 'expired' oder null.
 * Das Banner im Editor liest nur dieses Feld; es rechnet nichts selbst.
 */
export function accessInfo(user, now = Date.now()) {
  if (!user || user.role === 'admin' || user.plan_kind === 'lifetime' || !user.access_until) return null;
  const until = new Date(user.access_until);
  const ms = until.getTime() - now;
  const expired = ms <= 0;
  const daysLeft = expired ? 0 : Math.ceil(ms / DAY_MS);
  let notice = null;
  if (expired) notice = 'expired';
  else if (daysLeft <= NOTICE_DAYS.final) notice = 'final';
  else if (daysLeft <= NOTICE_DAYS.soon) notice = 'soon';
  return { until: until.toISOString(), expired, daysLeft, notice, readOnly: expired };
}

export function formatDateDe(d) {
  try {
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' });
  } catch {
    return new Date(d).toISOString().slice(0, 10);
  }
}

/** Klartext für die 403 auf Schreibwegen. */
export function expiredMessage(user) {
  return `Dein Zugang ist am ${formatDateDe(user.access_until)} abgelaufen. `
    + 'Deine Daten bleiben erhalten. Lesen und Exportieren (PDF, DOCX, JSON, ZIP) gehen weiter, Ändern nicht mehr. '
    + 'Für eine Verlängerung wende dich an die Person, von der du den Zugang hast.';
}

/* ── Plan-Modell (Bezahlung, 09.10.2026) ─────────────────────────────────
 *
 * plan.kind:
 *   unlimited  Admin oder access_until NULL (Bestand, Einladung ohne Laufzeit)
 *   lifetime   dauerhafter Gratiszugang aus einem Gutschein (grants.js);
 *              wie unlimited ohne Ablauf, aber ausdrücklich so gewährt
 *   pilot      Laufzeit aus einem Einladungscode oder vom Admin gesetzt
 *   pass       aktiver, bezahlter Bewerbungs-Pass
 *   none       registriert ohne aktiven Pass (offene Registrierung, oder der
 *              Pass ist abgelaufen bzw. widerrufen)
 *
 * Abgeleitet nur aus der Zeile in users (access_until, plan_kind, role) —
 * keine zusätzliche Abfrage je Anfrage. plan_kind setzt die Registrierung
 * ('none'); seit den Gutscheinen (09.10.2026) schreibt es nur noch die
 * Neuberechnung in grants.js ('pass' sobald eine Bestellung oder ein
 * Zeitgutschein dazukam, 'lifetime' bei dauerhaftem Gratiszugang). Ein
 * abgelaufener Pilot bleibt 'pilot' mit notice 'expired' und der bisherigen
 * Sperre access_expired. Herkunft und Gratis-Ende liefert planDetails
 * (grants.js) für /api/me. */
export function planInfo(user, now = Date.now()) {
  if (!user) return null;
  if (user.role !== 'admin' && user.plan_kind === 'lifetime') {
    return { kind: 'lifetime', until: null, daysLeft: null, notice: null, readOnly: false };
  }
  if (user.role === 'admin' || !user.access_until) {
    return { kind: 'unlimited', until: null, daysLeft: null, notice: null, readOnly: false };
  }
  const a = accessInfo(user, now);
  const pk = user.plan_kind || null;
  if (!a.expired) {
    return { kind: pk === 'pass' ? 'pass' : 'pilot', until: a.until, daysLeft: a.daysLeft, notice: a.notice, readOnly: false };
  }
  if (pk === 'none') {
    // Nie bezahlt: kein Datum, kein Ablauf-Hinweis — es gab nichts, das ablief.
    return { kind: 'none', until: null, daysLeft: null, notice: null, readOnly: true };
  }
  if (pk === 'pass') return { kind: 'none', until: a.until, daysLeft: 0, notice: 'expired', readOnly: true };
  return { kind: 'pilot', until: a.until, daysLeft: 0, notice: 'expired', readOnly: true };
}

/** Klartext für die 403 bei plan.kind 'none'. */
export function passRequiredMessage() {
  return 'Für Speichern im Konto, Sharelinks, Versionen und die KI-Verbindung brauchst du einen aktiven Bewerbungs-Pass. '
    + 'Ohne Konto bleibt alles kostenlos: alle Vorlagen, PDF und Word, die Daten bleiben in deinem Browser. '
    + 'Was schon im Konto liegt, bleibt erhalten: Lesen, Exportieren und Löschen gehen weiter.';
}

/** Antwortet mit der passenden 403 und gibt true zurück, wenn das Konto
 *  gerade nicht schreiben darf. */
export function denyIfReadOnly(req, res) {
  if (!isAccessExpired(req.user)) return false;
  const plan = planInfo(req.user);
  if (plan?.kind === 'none') {
    res.status(403).json({
      error: passRequiredMessage(),
      code: 'pass_required',
      accessUntil: plan.until,
      plan,
    });
    return true;
  }
  res.status(403).json({
    error: expiredMessage(req.user),
    code: 'access_expired',
    accessUntil: new Date(req.user.access_until).toISOString(),
  });
  return true;
}

/**
 * Express-Middleware hinter requireAuth: sperrt Schreibwege nach Ablauf.
 * Antwort 403 mit code 'access_expired' (Pilot) bzw. 'pass_required'
 * (registriert ohne aktiven Pass), damit die Oberfläche die Meldung
 * sprachunabhängig erkennen kann.
 */
export function requireWritable(req, res, next) {
  if (denyIfReadOnly(req, res)) return;
  next();
}

/**
 * Ein Durchgang: Hinweis-Mails 14 und 3 Tage vor Ablauf.
 *
 * Erst wird der Versand in der Zeile vermerkt (nur wenn er noch nicht
 * vermerkt war), dann gesendet. Scheitert der Versand, wird der Vermerk
 * zurückgenommen, damit der nächste Lauf es noch einmal versucht. So geht
 * auch bei zwei gleichzeitig laufenden Instanzen keine Mail doppelt hinaus.
 *
 * Konten ohne E-Mail-Adresse bekommen keine Mail, aber das Banner (accessInfo).
 */
export async function runAccessNotices(db, { send = sendMail, base = null } = {}) {
  const { rows } = await db.query(
    `SELECT id, username, email, access_until, access_notice14_at, access_notice3_at, plan_kind
       FROM users
      WHERE access_until IS NOT NULL AND access_until > now()
        AND NOT disabled AND role <> 'admin' AND email IS NOT NULL
        AND (
          (access_until <= now() + make_interval(days => $1) AND access_notice3_at IS NULL)
          OR (access_until <= now() + make_interval(days => $2) AND access_until > now() + make_interval(days => $1)
              AND access_notice14_at IS NULL)
        )`,
    [NOTICE_DAYS.final, NOTICE_DAYS.soon],
  );
  const out = [];
  for (const u of rows) {
    const daysLeft = Math.max(1, Math.ceil((new Date(u.access_until).getTime() - Date.now()) / DAY_MS));
    const kind = daysLeft <= NOTICE_DAYS.final ? 'final' : 'soon';
    const col = kind === 'final' ? 'access_notice3_at' : 'access_notice14_at';
    const claim = await db.query(`UPDATE users SET ${col} = now() WHERE id = $1 AND ${col} IS NULL RETURNING id`, [u.id]);
    if (!claim.rowCount) continue;
    let sent;
    try {
      // Pass-Inhaber bekommen den Hinweis mit „Pass verlängern“, Pilot-Konten
      // den bisherigen mit „wende dich an die Person …“.
      const tpl = u.plan_kind === 'pass' ? tplPassEnding : tplAccessEnding;
      sent = await send({ to: u.email, ...tpl({ username: u.username, until: u.access_until, daysLeft, base }) });
    } catch { sent = false; }
    if (sent) {
      // Der letzte Hinweis ersetzt den ersten, falls der nie verschickt wurde.
      if (kind === 'final') await db.query('UPDATE users SET access_notice14_at = coalesce(access_notice14_at, now()) WHERE id = $1', [u.id]);
    } else {
      await db.query(`UPDATE users SET ${col} = NULL WHERE id = $1`, [u.id]);
    }
    out.push({ userId: u.id, kind, daysLeft, sent });
  }
  return out;
}

/** Startet den Hinweis-Job: sofort, dann alle `everyMs` (Standard 6 h). */
export function startAccessNotices(db, { everyMs = 6 * 60 * 60 * 1000, base = null, log = console.log } = {}) {
  const tick = async () => {
    const r = await runAccessNotices(db, { base });
    if (r.length) log(`access-notices: ${r.map(x => `#${x.userId}:${x.kind}:${x.sent ? 'ok' : 'nicht gesendet'}`).join(' ')}`);
  };
  tick().catch(err => console.error('access-notices failed:', err?.message || err));
  const t = setInterval(() => tick().catch(err => console.error('access-notices failed:', err?.message || err)), everyMs);
  t.unref?.();
  return t;
}
