// Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO und Fassung der Vertragstexte
// (Bau-Agent B4, 10.10.2026; Rechtsprüfung des Prüfteams, Patches P5, P8, P9).
//
// Warum es das gibt: Die Datenschutzerklärung stützt besonders geschützte
// Angaben im Konto (Religion, Gesundheit, Gewerkschaft …) auf eine
// ausdrückliche Einwilligung. Ohne sie fehlt die Rechtsgrundlage (Befund D1,
// „hoch“). Weil der Dienst nicht weiß, was jemand einträgt, speichert ein
// Konto nur mit gültiger Einwilligung in der aktuellen Textfassung. Lesen,
// Exportieren und Löschen gehen immer; der Lokalmodus (ohne Konto) ist nicht
// betroffen.
//
// Der Text liegt in app/src/legal/einwilligung.ts. ART9_VERSION hier und
// ART9_CONSENT_VERSION dort müssen gleich sein (billing.test.mjs, Test „P8/P9“).

import { LEGAL } from './mailtexts/legal.js';

export const ART9_VERSION = '2026-10-10';

/** Gilt für dieses Konto eine Einwilligung in der aktuellen Fassung? */
export function hasArt9Consent(u) {
  return !!u?.art9_consent_at && u?.art9_consent_version === ART9_VERSION;
}

/** Für publicUser: was die Oberfläche braucht, um den Dialog zu zeigen. */
export function art9Info(u) {
  return {
    required: true,
    ok: hasArt9Consent(u),
    version: ART9_VERSION,
    givenAt: u?.art9_consent_at ?? null,
    givenVersion: u?.art9_consent_version ?? null,
    withdrawnAt: u?.art9_withdrawn_at ?? null,
  };
}

export const ART9_REQUIRED_MESSAGE = 'Ihr Konto speichert erst, wenn Sie in die Verarbeitung besonders geschützter Angaben eingewilligt haben (Art. 9 DSGVO). Die Einwilligung können Sie in der App erteilen; ohne Konto können Sie im Lokalmodus arbeiten.';

/** Middleware für Schreibwege, die Inhalte im Konto speichern. Steht hinter
 *  requireAuth. Löschen und Lesen bleiben frei. */
export function requireArt9Consent(req, res, next) {
  if (hasArt9Consent(req.user)) return next();
  return res.status(403).json({ error: ART9_REQUIRED_MESSAGE, code: 'art9_consent_required', version: ART9_VERSION });
}

/* ── Fassung der Vertragstexte (P5) ──────────────────────────────────────
 * Maßgeblich ist die Fassung in mailtexts/legal-texts.json (erzeugt aus
 * app/src/legal mit scripts/sync-legal.mjs). TERMS_VERSION und
 * WITHDRAWAL_VERSION sind nur noch eine Übersteuerung für den Notfall; weicht
 * ein gesetzter Wert von der Datei ab, steht beim Start eine Warnung im Log. */

const clean = v => String(v ?? '').trim().slice(0, 40) || null;

/**
 * @returns {{ terms, withdrawal, source: { terms, withdrawal }, file: { terms, withdrawal }, warnings: string[] }}
 */
export function legalVersions(env = process.env, legal = LEGAL) {
  const file = { terms: clean(legal?.terms?.version), withdrawal: clean(legal?.withdrawal?.version) };
  const envTerms = clean(env.TERMS_VERSION);
  const envWithdrawal = clean(env.WITHDRAWAL_VERSION);
  const warnings = [];
  const pick = (name, fromEnv, fromFile) => {
    if (fromEnv && fromFile && fromEnv !== fromFile) {
      warnings.push(`${name}=${fromEnv} weicht von der Fassung in legal-texts.json (${fromFile}) ab — es gilt die Umgebungsvariable. Bitte löschen, wenn das kein Notfall ist.`);
    }
    if (fromEnv) return { value: fromEnv, source: fromFile && fromEnv === fromFile ? 'file' : 'env' };
    if (fromFile) return { value: fromFile, source: 'file' };
    return { value: null, source: 'none' };
  };
  const t = pick('TERMS_VERSION', envTerms, file.terms);
  // Ohne eigene Belehrungsfassung gilt die der AGB (wie bisher).
  const w = pick('WITHDRAWAL_VERSION', envWithdrawal, file.withdrawal || null);
  const withdrawal = w.value || t.value;
  return {
    terms: t.value,
    withdrawal,
    source: { terms: t.source, withdrawal: w.value ? w.source : t.source },
    file,
    warnings,
  };
}
