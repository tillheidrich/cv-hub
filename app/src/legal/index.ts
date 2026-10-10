/**
 * Rechtstexte rund um den Bewerbungs-Pass (Stand 2026-10-10, Prüfteam J1).
 * KEINE RECHTSBERATUNG — vor Livegang anwaltlich prüfen lassen.
 * Belege: Recherche des ursprünglichen Betreibers, nicht Teil dieses Repositorys.
 */
export * from './types';
export { AGB } from './agb';
export type { TermsTexts } from './agb';
export { WIDERRUF } from './widerruf';
export type { WithdrawalTexts, WithdrawalPolicy, WithdrawalForm, WithdrawalFunction } from './widerruf';
export { KUENDIGUNG } from './kuendigung';
export type { CancellationTexts } from './kuendigung';
export { BESTELLUNG } from './bestellung';
export type { OrderTexts } from './bestellung';
export { DATENSCHUTZ_BEZAHLUNG } from './datenschutzBezahlung';
export type { PrivacyBillingTexts } from './datenschutzBezahlung';
export { MAILS } from './mails';
export type { MailTexts } from './mails';
