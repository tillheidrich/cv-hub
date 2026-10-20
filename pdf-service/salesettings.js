// Verkauf aus dem Admin-Bereich (20.10.2026, Admin → Verkauf).
//
// Schlüssel als Umgebungsvariablen eintragen, Zufallswerte im Terminal
// erzeugen und Variablen umschalten ist für viele zu umständlich. Hier liegt deshalb
// alles, was den Verkauf an- und ausschaltet, in einer Zeile der Datenbank:
//
//   mode          off | test (nur Testkonten) | live
//   registration  offene Registrierung an/aus
//   testers       E-Mail-Adressen der Testkonten
//   test_key_enc  Mollie-Testschlüssel, verschlüsselt (wie das SMTP-Passwort)
//   live_key_enc  Mollie-Live-Schlüssel, verschlüsselt
//
// Ist eine Zeile gespeichert, geht sie der Umgebung vor (BILLING_ENABLED,
// MOLLIE_API_KEY, OPEN_REGISTRATION, BILLING_TESTERS*). Ohne Zeile gilt die
// Umgebung wie bisher, so auch für selbst gehostete Instanzen. Kein Schlüssel
// steht je in einer Antwort, einem Protokoll oder einer Mail; angezeigt wird
// nur Anfang und Ende („test_…a1b2").

import { encryptSecret, decryptSecret } from './mailsettings.js';
import { createMollie } from './mollie.js';

const KEY_RE = { test: /^test_[A-Za-z0-9]{20,}$/, live: /^live_[A-Za-z0-9]{20,}$/ };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function keyHint(key) {
  const k = String(key || '');
  return k ? `${k.slice(0, 5)}…${k.slice(-4)}` : null;
}

export async function loadSaleRow(db) {
  try { return (await db.query('SELECT * FROM sale_settings WHERE id = 1')).rows[0] || null; }
  catch { return null; } // Tabelle noch nicht angelegt (Start vor der Migration)
}

/** Umgebung, wie sie mit der gespeicherten Zeile gilt. */
export function effectiveEnv(env, row) {
  if (!row) return env;
  const out = { ...env };
  const testKey = row.test_key_enc ? decryptSecret(row.test_key_enc, env) : null;
  const liveKey = row.live_key_enc ? decryptSecret(row.live_key_enc, env) : null;
  out.BILLING_ENABLED = row.mode === 'off' ? '0' : '1';
  out.BILLING_TESTERS_ONLY = row.mode === 'test' ? '1' : '0';
  out.BILLING_TESTERS = row.testers || '';
  out.MOLLIE_API_KEY = (row.mode === 'live' ? liveKey : testKey) || '';
  out.OPEN_REGISTRATION = row.registration ? '1' : '0';
  return out;
}

export function publicSale(row, env = process.env) {
  if (!row) return null;
  return {
    mode: row.mode,
    registration: !!row.registration,
    testers: String(row.testers || '').split(/[,;\s]+/).filter(Boolean),
    testKey: row.test_key_enc ? { hint: row.test_key_hint, checkedAt: row.test_checked_at, readable: decryptSecret(row.test_key_enc, env) !== null } : null,
    liveKey: row.live_key_enc ? { hint: row.live_key_hint, checkedAt: row.live_checked_at, readable: decryptSecret(row.live_key_enc, env) !== null } : null,
    updatedAt: row.updated_at,
  };
}

/** Prüft Eingaben. Schlüssel nur, wenn mitgeschickt (leer = unverändert). */
export function validateSale(body) {
  const errors = [];
  const v = {};
  if (body.mode !== undefined) {
    if (!['off', 'test', 'live'].includes(body.mode)) errors.push('Unbekannter Modus.');
    else v.mode = body.mode;
  }
  if (body.registration !== undefined) v.registration = !!body.registration;
  if (body.testers !== undefined) {
    const list = (Array.isArray(body.testers) ? body.testers : String(body.testers).split(/[,;\s]+/))
      .map(x => String(x).trim().toLowerCase()).filter(Boolean);
    const bad = list.filter(x => !EMAIL_RE.test(x));
    if (bad.length) errors.push(`Keine E-Mail-Adresse: ${bad.slice(0, 3).join(', ')}`);
    if (list.length > 20) errors.push('Höchstens 20 Testkonten.');
    v.testers = [...new Set(list)].join(',');
  }
  for (const kind of ['test', 'live']) {
    const raw = body[`${kind}Key`];
    if (raw === undefined || raw === null || String(raw).trim() === '') continue;
    const k = String(raw).trim();
    if (!KEY_RE[kind].test(k)) errors.push(kind === 'test' ? 'Der Testschlüssel beginnt mit „test_".' : 'Der Live-Schlüssel beginnt mit „live_".');
    else v[`${kind}Key`] = k;
  }
  return { ok: errors.length === 0, errors, value: v };
}

/** Fragt Mollie, ob der Schlüssel gilt, und liefert die aktiven Zahlungsarten. */
export async function checkKey(key, { base, fetchImpl } = {}) {
  try {
    const methods = await createMollie({ apiKey: key, base, fetchImpl, timeoutMs: 10_000 }).listMethods();
    return { ok: true, methods };
  } catch (err) {
    const status = err?.status || 0;
    return { ok: false, error: status === 401 ? 'Mollie kennt diesen Schlüssel nicht.' : `Mollie antwortet nicht wie erwartet (${err?.message || 'Fehler'}).` };
  }
}

export async function saveSale(db, value, { adminId, env = process.env, checked = {} }) {
  const row = await loadSaleRow(db);
  const next = {
    mode: value.mode ?? row?.mode ?? 'off',
    registration: value.registration ?? row?.registration ?? false,
    testers: value.testers ?? row?.testers ?? '',
    test_key_enc: row?.test_key_enc ?? null, test_key_hint: row?.test_key_hint ?? null, test_checked_at: row?.test_checked_at ?? null,
    live_key_enc: row?.live_key_enc ?? null, live_key_hint: row?.live_key_hint ?? null, live_checked_at: row?.live_checked_at ?? null,
  };
  for (const kind of ['test', 'live']) {
    const k = value[`${kind}Key`];
    if (!k) continue;
    next[`${kind}_key_enc`] = encryptSecret(k, env);
    next[`${kind}_key_hint`] = keyHint(k);
    next[`${kind}_checked_at`] = checked[kind] ? new Date() : null;
  }
  await db.query(
    `INSERT INTO sale_settings (id, mode, registration, testers, test_key_enc, test_key_hint, test_checked_at, live_key_enc, live_key_hint, live_checked_at, updated_at, updated_by)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10)
     ON CONFLICT (id) DO UPDATE SET mode = EXCLUDED.mode, registration = EXCLUDED.registration, testers = EXCLUDED.testers,
       test_key_enc = EXCLUDED.test_key_enc, test_key_hint = EXCLUDED.test_key_hint, test_checked_at = EXCLUDED.test_checked_at,
       live_key_enc = EXCLUDED.live_key_enc, live_key_hint = EXCLUDED.live_key_hint, live_checked_at = EXCLUDED.live_checked_at,
       updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [next.mode, next.registration, next.testers, next.test_key_enc, next.test_key_hint, next.test_checked_at, next.live_key_enc, next.live_key_hint, next.live_checked_at, adminId ?? null],
  );
  return loadSaleRow(db);
}

/** Entschlüsselter Schlüssel einer Art aus der Zeile (für die Prüfung beim Umschalten). */
export function storedKey(row, kind, env = process.env) {
  const enc = row?.[`${kind}_key_enc`];
  return enc ? decryptSecret(enc, env) : null;
}
