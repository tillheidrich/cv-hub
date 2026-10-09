/**
 * Kleine Helfer der Bezahlseiten, ohne React-Komponenten (damit die
 * Komponenten-Dateien nur Komponenten exportieren — Fast Refresh).
 */
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N, fmtDate, fmtTime, type FeatureKey } from '../ui/i18n/billing';
import { ApiError } from '../data/api';
import type { AuthUser, Plan } from '../data/api';
import { GUTSCHEIN_I18N } from '../ui/i18n/gutschein';
import { formatPrice, VOUCHER_REASONS, type Offer, type VoucherReason } from './api';

/** Fehlermeldung für die Oberfläche: 429 in der Oberflächensprache, sonst
 *  der Klartext des Servers, notfalls ein allgemeiner Satz. */
export function errorText(e: unknown, lang: UiLang): string {
  const t = BILLING_I18N[lang];
  if (e instanceof ApiError) {
    if (e.status === 429) return t.errTooMany(e.retryAfter);
    if (e.message && !/^Fehler \d+$/.test(e.message)) return e.message;
  }
  return t.errGeneric;
}

const FEATURE_ORDER: FeatureKey[] = ['sync', 'share', 'versions', 'mcp', 'apiKeys'];

/** Funktionen des Passes: die Liste vom Server, sonst alle bekannten. */
export function passFeatures(offer: Offer | null): FeatureKey[] {
  const fromServer = (offer?.features ?? []).filter((f): f is FeatureKey => (FEATURE_ORDER as string[]).includes(f));
  return fromServer.length ? FEATURE_ORDER.filter(f => fromServer.includes(f)) : FEATURE_ORDER;
}

/** Preis des Angebots in der Oberflächensprache („9 €", mit decimals „9,00 €"). */
export function priceOf(offer: Offer | null, lang: UiLang, decimals = false): string {
  if (!offer) return '';
  return formatPrice(offer.priceCents, offer.currency, BILLING_I18N[lang].locale, decimals);
}

/** „9. Oktober 2026, 14:32 Uhr" / "9 October 2026, 14:32". */
export function receivedLabel(iso: string, lang: UiLang): string {
  return `${fmtDate(iso, lang)}, ${fmtTime(iso, lang)}${lang === 'de' ? ' Uhr' : ''}`;
}

/** Ein Satz zum Stand des Kontos für „Mein Pass". */
export function planLine(user: AuthUser | null, lang: UiLang): string {
  const t = BILLING_I18N[lang];
  const p = user?.plan;
  if (!p) {
    if (user?.access?.until) return user.access.expired ? t.mpPassExpired(fmtDate(user.access.until, lang)) : t.mpPilot(fmtDate(user.access.until, lang));
    return t.mpUnlimited;
  }
  if (p.kind === 'unlimited') return t.mpUnlimited;
  // Dauerhafter Gratiszugang (Gutschein): nie ein Ablauf, nie ein Kaufhinweis.
  if (p.kind === 'lifetime') return GUTSCHEIN_I18N[lang].mpLifetime;
  // Nur Gratiszeit aus Gutscheinen, nichts bezahlt: vom Gratiszugang sprechen.
  if (freeOnly(p) && p.until) {
    const g = GUTSCHEIN_I18N[lang];
    const expired = p.kind === 'none' || p.notice === 'expired';
    return expired ? g.mpFreeExpired(fmtDate(p.until, lang)) : g.mpFreeActive(fmtDate(p.until, lang));
  }
  // Abgelaufener Pass: kind 'none' mit Datum (pdf-service/access.js, planInfo).
  if (p.kind === 'none') return p.until ? t.mpPassExpired(fmtDate(p.until, lang)) : t.mpNone;
  if (p.kind === 'pilot') return p.until ? t.mpPilot(fmtDate(p.until, lang)) : t.mpUnlimited;
  if (p.until && p.notice === 'expired') return t.mpPassExpired(fmtDate(p.until, lang));
  return p.until ? t.mpPassActive(fmtDate(p.until, lang), p.daysLeft ?? 0) : t.mpUnlimited;
}

/** Dauerhafter Gratiszugang aus einem Gutschein? */
export function isLifetime(plan: Plan | null | undefined): boolean {
  return plan?.kind === 'lifetime';
}

/** Stammt die Laufzeit nur aus Gutscheinen (nichts bezahlt)? Dann sprechen
 *  Band und „Mein Pass" vom Gratiszugang statt vom gekauften Pass. */
export function freeOnly(plan: Plan | null | undefined): boolean {
  if (!plan || plan.hasPaid === true) return false;
  const g = plan.grants ?? [];
  return g.some(x => x.source === 'voucher') && !g.some(x => x.source === 'order');
}

/** Fehlertext für Vorschau und Einlösung: Grund aus dem Vertrag in der
 *  Oberflächensprache, 429 mit Wartezeit, sonst der allgemeine Weg. */
export function voucherErrorText(e: unknown, lang: UiLang): string {
  if (e instanceof ApiError && e.status !== 429 && e.code && (VOUCHER_REASONS as readonly string[]).includes(e.code)) {
    return GUTSCHEIN_I18N[lang].err[e.code as VoucherReason];
  }
  return errorText(e, lang);
}

/** Fehlergrund aus einer Antwort (für Zustände wie „nicht bestätigt"). */
export function voucherReasonOf(e: unknown): VoucherReason | null {
  return e instanceof ApiError && e.code && (VOUCHER_REASONS as readonly string[]).includes(e.code) ? e.code as VoucherReason : null;
}
