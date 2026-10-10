/**
 * Kündigungsschaltfläche nach § 312k BGB („Verträge hier kündigen").
 *
 * KEINE RECHTSBERATUNG — vor Livegang anwaltlich prüfen lassen.
 *
 * WARUM ES DAS BRAUCHT, obwohl der Pass kein Abo ist:
 * Der BGH hat am 22.05.2025 (I ZR 161/24, „Otto Up Plus") entschieden, dass
 * § 312k auch für Verträge mit fester Laufzeit und Einmalzahlung gilt, die
 * von selbst enden. Der Fall: 9,90 € einmalig, 12 Monate, endet automatisch —
 * praktisch derselbe Zuschnitt wie der Pass (9,00 €, 90 Tage). Maßgeblich ist,
 * dass der Unternehmer über die Laufzeit fortlaufend leistet
 * (Dauerschuldverhältnis), nicht wie gezahlt wird. Die außerordentliche
 * Kündigung lässt sich nicht ausschließen, also braucht es den Knopf.
 * Folge bei Fehlen (§ 312k Abs. 6): jederzeitige Kündigung ohne Frist, dazu
 * Abmahnrisiko (UWG/UKlaG).
 *
 * Anforderungen (§ 312k Abs. 2–4, Wortlaut im Gesetz):
 * - Knopf „Verträge hier kündigen", ständig verfügbar, unmittelbar und leicht
 *   zugänglich → Fußzeile jeder Seite, auch ohne Anmeldung.
 * - Er führt direkt zu einer Bestätigungsseite mit: Art der Kündigung (und
 *   Grund bei außerordentlicher), Identifizierung, Vertrag, gewünschtem
 *   Beendigungszeitpunkt, Adresse für die Bestätigung.
 * - Knopf „jetzt kündigen".
 * - Kunde muss die Erklärung mit Datum/Uhrzeit speichern können (Abs. 3) →
 *   Ergebnisseite zum Speichern/Drucken + Mail.
 * - Sofortige Bestätigung in Textform mit Inhalt, Datum, Uhrzeit des Zugangs
 *   und Beendigungszeitpunkt (Abs. 4) → `mails.ts` cancellationReceipt.
 *
 * Vertragliche Regel dazu (AGB § 7): Ordentliche Kündigung jederzeit zum
 * gewünschten Zeitpunkt, ohne anteilige Erstattung; innerhalb der
 * Widerrufsfrist weist die Seite auf den günstigeren Widerruf hin.
 */
import type { Bilingual } from './types';

export interface CancellationTexts {
  /** Beschriftung der Kündigungsschaltfläche, nichts anderes (§ 312k Abs. 2 S. 2). */
  buttonCancel: string;
  /** Beschriftung der Bestätigungsschaltfläche (§ 312k Abs. 2 S. 3 Nr. 2). */
  buttonConfirm: string;
  pageTitle: string;
  pageIntro: string;
  /** Hinweis, solange eine Widerrufsfrist läuft. */
  withdrawalHint: string;
  kindLabel: string;
  kindOrdinary: string;
  kindOrdinaryHelp: string;
  kindExtraordinary: string;
  kindExtraordinaryHelp: string;
  reasonLabel: string;
  nameLabel: string;
  emailLabel: string;
  /** Mit Anmeldung: Bestätigung geht sofort an die Kontoadresse. */
  emailHelp: string;
  /** Ohne Anmeldung: Bestätigung an die Adresse der Bestellung; mit passender
   *  Bestellnummer sofort wirksam (P4, 10.10.2026), sonst mit Bestätigungslink
   *  (Sicherheitsbefund H2, 09.10.2026). */
  emailHelpPublic: string;
  orderLabel: string;
  orderHelp: string;
  whenLabel: string;
  whenNow: string;
  whenEndOfTerm: string;
  whenDate: string;
  whenDefault: string;
  doneTitle: string;
  /** Mit Anmeldung: sofort wirksam. */
  doneText: string;
  /** Ohne Anmeldung: eingegangen; mit Bestellnummer und Bestelladresse sofort
   *  wirksam, ohne Bestellnummer nach dem Klick im Bestätigungslink. */
  donePublicText: string;
  saveHint: string;
  errorRequired: string;
}

export const KUENDIGUNG: Bilingual<CancellationTexts> = {
  version: '2026-10-10',
  // Anwalt prüfen: Bestätigungslink bei öffentlicher Erklärung
  // (§ 312k Abs. 2–4 BGB, BGH I ZR 161/24 „unmittelbar“). Seit P4 (B4,
  // 10.10.2026): Passen Bestellnummer UND Bestelladresse, wirkt die Kündigung
  // sofort; nur ohne Bestellnummer bleibt der Link an die Adresse der
  // Bestellung (Sicherheitsbefund H2, 09.10.2026: Die Adresse allein genügte,
  // um bezahlte Pässe anderer sofort zu beenden). Für den Zeitpunkt zählt
  // immer der Eingang. Nur die Sätze zu diesem Ablauf sind angepasst.
  de: {
    buttonCancel: 'Verträge hier kündigen',
    buttonConfirm: 'jetzt kündigen',
    pageTitle: 'Vertrag kündigen',
    pageIntro: 'Hier kündigen Sie Ihren Bewerbungs-Pass. Der Pass endet ohnehin nach {{DAYS}} Tagen von selbst und verlängert sich nicht. Eine Anmeldung ist nicht nötig: Mit Bestellnummer und der E-Mail-Adresse der Bestellung wirkt die Kündigung sofort; ohne Bestellnummer bestätigen Sie sie danach über einen Link in Ihrer E-Mail. Angemeldet geht es sofort unter „Mein Pass“.',
    withdrawalHint: 'Ihr Kauf liegt weniger als 14 Tage zurück. Statt zu kündigen, können Sie den Vertrag widerrufen und erhalten dann den vollen Preis zurück. Eine Kündigung allein erstattet nichts. → Vertrag widerrufen',
    kindLabel: 'Art der Kündigung',
    kindOrdinary: 'Ordentliche Kündigung',
    kindOrdinaryHelp: 'Ohne Grund. Der Pass endet zum gewählten Zeitpunkt; der bereits gezahlte Preis wird nicht anteilig erstattet.',
    kindExtraordinary: 'Außerordentliche Kündigung aus wichtigem Grund',
    kindExtraordinaryHelp: 'Zum Beispiel, wenn der Dienst trotz Hinweis nicht so funktioniert wie zugesagt. Bitte beschreiben Sie den Grund. Wir prüfen ihn und erstatten bei berechtigter Kündigung den Preis für die restliche Laufzeit.',
    reasonLabel: 'Kündigungsgrund',
    nameLabel: 'Ihr Name',
    emailLabel: 'E-Mail-Adresse',
    emailHelp: 'An diese Adresse schicken wir sofort die Kündigungsbestätigung.',
    emailHelpPublic: 'Bitte die Adresse, mit der Sie gekauft haben. Dorthin schicken wir sofort die Bestätigung mit Datum und Uhrzeit. Ohne Bestellnummer enthält sie einen Link, mit dem Sie die Kündigung bestätigen.',
    orderLabel: 'Bestellnummer oder E-Mail-Adresse des Kontos',
    orderHelp: 'Die Bestellnummer steht in der Bestellbestätigung. Mit Nummer wirkt die Kündigung sofort. Ohne Nummer kündigen wir nach Ihrer Bestätigung per Link alle laufenden Pässe des Kontos mit dieser E-Mail-Adresse.',
    whenLabel: 'Wann soll der Pass enden?',
    whenNow: 'Sofort',
    whenEndOfTerm: 'Zum Ende der Laufzeit (ändert nichts: der Pass endet dann ohnehin)',
    whenDate: 'Zu einem bestimmten Datum',
    whenDefault: 'Ohne Angabe wirkt die Kündigung zum frühestmöglichen Zeitpunkt, also sofort.',
    doneTitle: 'Ihre Kündigung ist eingegangen',
    doneText: 'Eingegangen am {{RECEIVED_AT}}. Art: {{CANCEL_KIND}}. Der Pass endet am {{CANCEL_EFFECTIVE}}. Die Bestätigung ist an {{CUSTOMER_EMAIL}} unterwegs.',
    donePublicText: 'Eingegangen am {{RECEIVED_AT}}. Art: {{CANCEL_KIND}}. Ihre Kündigung ist damit bei uns eingegangen; für den Zeitpunkt zählt dieser Eingang. Passen Bestellnummer und E-Mail-Adresse zu einer Bestellung, ist sie damit wirksam, und die Bestätigung geht an die Adresse der Bestellung. Ohne Bestellnummer schicken wir zur Sicherheit einen Bestätigungslink an die E-Mail-Adresse der Bestellung; nach dem Klick endet der Pass zum gewählten Zeitpunkt. Haben Sie keinen Zugriff mehr auf diese Adresse, schreiben Sie uns an {{SELLER_EMAIL}}; wir bearbeiten die Kündigung dann von Hand. Angemeldet geht es sofort unter „Mein Pass“.',
    saveHint: 'Diese Seite können Sie mit „Speichern" oder „Drucken" als Beleg ablegen. Sie enthält Ihre Erklärung mit Datum und Uhrzeit der Abgabe über die Schaltfläche „jetzt kündigen".',
    errorRequired: 'Bitte füllen Sie Name, E-Mail-Adresse und bei außerordentlicher Kündigung den Grund aus.',
  },
  en: {
    buttonCancel: 'Cancel contracts here',
    buttonConfirm: 'Cancel now',
    pageTitle: 'Cancel contract',
    pageIntro: 'Here you can cancel your application pass. The pass ends by itself after {{DAYS}} days anyway and does not renew. No sign-in needed: with the order number and the e-mail address of the order, the cancellation takes effect immediately; without an order number you then confirm it via a link in your e-mail. Signed in, it works straight away under “My pass”.',
    withdrawalHint: 'You bought less than 14 days ago. Instead of cancelling, you can withdraw from the contract and get the full price back. Cancelling alone does not refund anything. → Withdraw from contract',
    kindLabel: 'Type of cancellation',
    kindOrdinary: 'Ordinary cancellation',
    kindOrdinaryHelp: 'No reason needed. The pass ends at the time you choose; the price already paid is not refunded pro rata.',
    kindExtraordinary: 'Extraordinary cancellation for good cause',
    kindExtraordinaryHelp: 'For example, if the service does not work as promised despite you telling us. Please describe the reason. We check it and, if the cancellation is justified, refund the price for the remaining term.',
    reasonLabel: 'Reason for cancellation',
    nameLabel: 'Your name',
    emailLabel: 'E-mail address',
    emailHelp: 'We immediately send the cancellation confirmation to this address.',
    emailHelpPublic: 'Please use the address you bought with. We immediately send the confirmation with date and time to it. Without an order number it contains a link to confirm the cancellation.',
    orderLabel: 'Order number or account e-mail address',
    orderHelp: 'The order number is in the order confirmation. With the number, the cancellation takes effect immediately. Without a number, we cancel all running passes of the account with this e-mail address once you confirm via the link.',
    whenLabel: 'When should the pass end?',
    whenNow: 'Immediately',
    whenEndOfTerm: 'At the end of the term (changes nothing: the pass ends then anyway)',
    whenDate: 'On a specific date',
    whenDefault: 'If you do not choose, the cancellation takes effect at the earliest possible time, i.e. immediately.',
    doneTitle: 'Your cancellation has been received',
    doneText: 'Received on {{RECEIVED_AT}}. Type: {{CANCEL_KIND}}. The pass ends on {{CANCEL_EFFECTIVE}}. The confirmation is on its way to {{CUSTOMER_EMAIL}}.',
    donePublicText: 'Received on {{RECEIVED_AT}}. Type: {{CANCEL_KIND}}. Your cancellation has reached us; the time of this receipt counts. If the order number and e-mail address match an order, it has taken effect and the confirmation goes to the address of the order. Without an order number we send a confirmation link to the e-mail address of the order for your security; after the click the pass ends at the time you chose. If you no longer have access to that address, write to us at {{SELLER_EMAIL}} and we will process the cancellation manually. Signed in, it works straight away under “My pass”.',
    saveHint: 'You can keep this page as a record using "Save" or "Print". It contains your declaration with the date and time it was submitted via the "Cancel now" button.',
    errorRequired: 'Please fill in your name, e-mail address and, for extraordinary cancellation, the reason.',
  },
};
