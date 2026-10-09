// Aufräumen: Fotos ohne Verweis, abgelaufene Token, alte Protokolle.
//
// Befund 7 und Befund 1 aus dem Technik-Bericht vom 08.10.2026: Es gab keinen
// einzigen Aufräumjob. „Foto entfernen" ließ die Datei bis zur Kontolöschung
// in der Datenbank, abgelaufene Reset-, Login- und OAuth-Codes blieben für
// immer, Zugangsanfragen mit Name und E-Mail ebenso.
//
// Läuft beim Start und danach alle 24 Stunden (server.js). Jede Frist steht
// hier als Zahl; welche Frist rechtlich richtig ist, ist eine Rechtsfrage —
// technisch ist jede ein Einzeiler.

export const RETENTION = {
  rejectedAccessRequestsDays: 30,
  shareViewsDays: 90,
  deadOauthTokensDays: 30,
  idleOauthClientHours: 24,
  orphanPhotoHours: 24,
};

/* Ein Foto gilt als benutzt, wenn seine ID im aktuellen Stand eines Profils
 * desselben Nutzers steht oder im festen Stand eines aktiven Sharelinks.
 *
 * Versionen zählen bewusst NICHT: Wer ein Foto entfernt oder ersetzt, will,
 * dass es weg ist — nicht, dass es in einer Sicherungskopie weiterlebt. Eine
 * wiederhergestellte alte Version zeigt dann kein Foto; das ist der kleinere
 * Schaden. Die ID hat 24 Hex-Zeichen, ein Treffer per strpos ist eindeutig. */
const PHOTO_IN_USE = `
  EXISTS (SELECT 1 FROM resumes r WHERE r.user_id = p.user_id AND strpos(r.payload::text, p.id) > 0)
  OR EXISTS (SELECT 1 FROM share_links s
              WHERE s.created_by = p.user_id AND NOT s.revoked
                AND (s.expires_at IS NULL OR s.expires_at > now())
                AND (strpos(coalesce(s.snapshot::text, ''), p.id) > 0
                     OR (s.snapshot IS NULL AND EXISTS (
                          SELECT 1 FROM resumes r2 WHERE r2.id = s.resume_id AND strpos(r2.payload::text, p.id) > 0))))`;

/**
 * Löscht die nicht mehr benutzten Fotos eines Nutzers.
 *
 * Läuft nach jedem Speichern eines Profils. Die Schonfrist schützt ein Foto,
 * das gerade hochgeladen, aber noch nicht im Profil gespeichert ist: Der
 * Editor lädt erst hoch und speichert dann, mit ein paar Sekunden Abstand.
 */
export async function prunePhotos(db, userId, graceMinutes = 10) {
  const { rowCount } = await db.query(
    `DELETE FROM photos p
      WHERE p.user_id = $1
        AND p.created_at < now() - ($2 || ' minutes')::interval
        AND NOT (${PHOTO_IN_USE})`,
    [userId, String(graceMinutes)],
  );
  return rowCount;
}

/** Ein Durchgang. Gibt die Zahl gelöschter Zeilen je Tabelle zurück. */
export async function runJanitor(db) {
  const R = RETENTION;
  const steps = [
    ['photos', `DELETE FROM photos p
                 WHERE p.created_at < now() - interval '${R.orphanPhotoHours} hours'
                   AND NOT (${PHOTO_IN_USE})`],
    ['login_codes', `DELETE FROM login_codes WHERE expires_at < now() OR used`],
    ['password_resets', `DELETE FROM password_resets WHERE expires_at < now() OR used`],
    ['oauth_codes', `DELETE FROM oauth_codes WHERE expires_at < now() OR used`],
    ['oauth_tokens', `DELETE FROM oauth_tokens
                       WHERE (revoked OR coalesce(refresh_expires_at, expires_at) < now())
                         AND coalesce(last_used_at, created_at) < now() - interval '${R.deadOauthTokensDays} days'`],
    // Clients, die nie zu einem Token geführt haben (offene Registrierung, N9).
    ['oauth_clients', `DELETE FROM oauth_clients c
                        WHERE c.created_at < now() - interval '${R.idleOauthClientHours} hours'
                          AND NOT EXISTS (SELECT 1 FROM oauth_tokens t WHERE t.client_id = c.id)
                          AND NOT EXISTS (SELECT 1 FROM oauth_codes o WHERE o.client_id = c.id)`],
    ['access_requests', `DELETE FROM access_requests
                          WHERE status = 'rejected'
                            AND coalesce(decided_at, created_at) < now() - interval '${R.rejectedAccessRequestsDays} days'`],
    ['share_views', `DELETE FROM share_views WHERE viewed_at < now() - interval '${R.shareViewsDays} days'`],
    ['session_revocations', `DELETE FROM session_revocations WHERE expires_at < now()`],
  ];
  const out = {};
  for (const [name, sql] of steps) {
    try { out[name] = (await db.query(sql)).rowCount; }
    catch (err) { out[name] = `Fehler: ${err?.message || err}`; }
  }
  return out;
}

/** Startet den Job: sofort einmal, dann alle `everyMs`. */
export function startJanitor(db, { everyMs = 24 * 60 * 60 * 1000, log = console.log } = {}) {
  const tick = async () => {
    const r = await runJanitor(db);
    const sum = Object.entries(r).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join(' ');
    log(`janitor: ${sum || 'nichts zu tun'}`);
  };
  tick().catch(err => console.error('janitor failed:', err?.message || err));
  const t = setInterval(() => tick().catch(err => console.error('janitor failed:', err?.message || err)), everyMs);
  t.unref?.();
  return t;
}
