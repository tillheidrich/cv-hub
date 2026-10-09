/**
 * Widerrufsbelehrung, Muster-Widerrufsformular und Texte der
 * Widerrufsfunktion (§ 356a BGB) für den Bewerbungs-Pass.
 *
 * KEINE RECHTSBERATUNG — vor Livegang anwaltlich prüfen lassen.
 *
 * Grundlage:
 * - Belehrung: Muster der Anlage 1 zu Art. 246a § 1 Abs. 2 Satz 2 EGBGB in der
 *   Fassung von Art. 2 des Gesetzes vom 03.02.2026 (BGBl. 2026 I Nr. 28),
 *   in Kraft seit 19.06.2026. Wortlaut abgeglichen am 09.10.2026 mit der
 *   konsolidierten Fassung auf buzer.de (Quellen: Gesetzestext).
 * - Formular: Anlage 2 zu Art. 246a EGBGB, unverändert seit 28.05.2022.
 *
 * ABWEICHUNGEN VOM MUSTER (bewusst, alle zugunsten des Kunden):
 * A1  Gestaltungshinweis [6] (Wertersatz bei Dienstleistungen) ist NICHT
 *     eingefügt, weil wir keinen Wertersatz verlangen. Folge: Wir können ihn
 *     auch nicht verlangen (§ 357a Abs. 2 Nr. 3 BGB). Das ist gewollt.
 * A2  Gestaltungshinweise [4] und [5] entfallen, weil keine Waren geliefert
 *     werden (so vom Muster vorgesehen, keine echte Abweichung).
 * A3  Der Absatz „Über das Gesetz hinaus" steht AUSSERHALB der Belehrung
 *     (`voluntaryPromise`). Er darf nicht in den Belehrungstext gemischt
 *     werden, damit die Belehrung dem Muster entspricht.
 * Die Belehrung bleibt in der Sie-Form des Musters, auch wenn die App sonst
 * duzt. Eine Umformulierung in die Du-Form wäre eine Abweichung vom
 * Musterwortlaut und kostet die Gesetzlichkeitsfiktion (Art. 246a § 1 Abs. 2
 * Satz 2 EGBGB: „zutreffend ausgefüllt").
 * Die Formulierung „einschließlich der Lieferkosten (…)" steht im Muster
 * unbedingt und bleibt deshalb stehen, obwohl nichts geliefert wird.
 *
 * Englisch: Lesehilfe, angelehnt an das englische Muster in Anhang I Teil A
 * der Richtlinie 2011/83/EU; maßgeblich ist die deutsche Fassung.
 */
import type { Bilingual } from './types';

export interface WithdrawalPolicy {
  title: string;
  /** Überschrift „Widerrufsrecht" und Absätze. */
  rightTitle: string;
  right: string[];
  /** Überschrift „Folgen des Widerrufs" und Absätze. */
  consequencesTitle: string;
  consequences: string[];
  /** Freiwillige Zusage, außerhalb der gesetzlichen Belehrung anzeigen. */
  voluntaryTitle: string;
  voluntaryPromise: string[];
  /** Hinweis: kein vorzeitiges Erlöschen (Art. 246a § 1 Abs. 3 EGBGB). */
  noEarlyExpiry: string;
  endMarker: string;
}

export interface WithdrawalForm {
  title: string;
  intro: string;
  lines: string[];
  footnote: string;
}

/** Texte der Online-Widerrufsfunktion nach § 356a BGB. */
export interface WithdrawalFunction {
  /** Beschriftung der Widerrufsfunktion (§ 356a Abs. 1 Satz 2). */
  buttonWithdraw: string;
  /** Beschriftung der Bestätigungsfunktion (§ 356a Abs. 3 Satz 2). */
  buttonConfirm: string;
  pageTitle: string;
  pageIntro: string;
  /** Felder nach § 356a Abs. 2 Nr. 1–3. */
  fieldName: string;
  fieldOrderNo: string;
  fieldOrderNoHelp: string;
  fieldEmail: string;
  fieldEmailHelp: string;
  /** Im Konto: Auswahl der Bestellung statt Bestellnummer. */
  fieldOrderSelect: string;
  /** Zusammenfassung vor dem Bestätigen. */
  reviewTitle: string;
  reviewText: string;
  /** Ergebnis nach dem Absenden. */
  doneTitle: string;
  doneText: string;
  refundQueued: string;
  refundDone: string;
  refundFailed: string;
  /** Wenn die Bestellung nicht zuzuordnen ist: Widerruf trotzdem annehmen. */
  unmatched: string;
  /** Nach Fristende im Konto (Funktion verschwindet, Hinweis bleibt). */
  periodOver: string;
  errorRequired: string;
  /** Hinweis, dass die Funktion auch nach Kündigung oder Ablauf gilt. */
  alsoAfterCancel: string;
}

export interface WithdrawalTexts {
  policy: WithdrawalPolicy;
  form: WithdrawalForm;
  fn: WithdrawalFunction;
}

export const WIDERRUF: Bilingual<WithdrawalTexts> = {
  version: '2026-10-09',
  de: {
    policy: {
      title: 'Widerrufsbelehrung',
      rightTitle: 'Widerrufsrecht',
      right: [
        'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
        'Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
        'Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({{SELLER_NAME}}, {{SELLER_ADDRESS}}, Telefon: {{SELLER_PHONE}}, E-Mail: {{SELLER_EMAIL}}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Sie können Ihr Widerrufsrecht auch online unter {{BASE_URL}}/widerruf (Schaltfläche „Vertrag widerrufen"; nach Anmeldung auch im Konto unter „Mein Pass") ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.',
        'Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.',
      ],
      consequencesTitle: 'Folgen des Widerrufs',
      consequences: [
        'Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.',
      ],
      voluntaryTitle: 'Über das Gesetz hinaus',
      voluntaryPromise: [
        'Wir verlangen bei einem Widerruf keinen Wertersatz für die Tage, an denen Sie den Pass schon genutzt haben. Sie erhalten den vollen Preis zurück.',
        'Die Erstattung stoßen wir automatisch an, sobald Ihr Widerruf eingegangen ist. Je nach Zahlungsart dauert es danach einige Tage, bis das Geld auf Ihrem Konto ist.',
        'Mit dem Widerruf endet der Pass aus dieser Bestellung. Ihr Konto und Ihre Inhalte bleiben erhalten; Sie können sie weiter lesen, exportieren und löschen.',
      ],
      noEarlyExpiry: 'Ihr Widerrufsrecht erlischt bei diesem Vertrag nicht vorzeitig. Sie können während der gesamten Widerrufsfrist widerrufen, auch wenn Sie den Pass bereits nutzen.',
      endMarker: 'Ende der Widerrufsbelehrung',
    },
    form: {
      title: 'Muster-Widerrufsformular',
      intro: '(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)',
      lines: [
        'An {{SELLER_NAME}}, {{SELLER_ADDRESS}}, E-Mail: {{SELLER_EMAIL}}:',
        'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)',
        'Bestellt am (*)/erhalten am (*)',
        'Name des/der Verbraucher(s)',
        'Anschrift des/der Verbraucher(s)',
        'Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)',
        'Datum',
      ],
      footnote: '(*) Unzutreffendes streichen.',
    },
    fn: {
      buttonWithdraw: 'Vertrag widerrufen',
      buttonConfirm: 'Widerruf bestätigen',
      pageTitle: 'Vertrag widerrufen',
      pageIntro: 'Hier widerrufen Sie Ihren Kauf des Bewerbungs-Passes innerhalb von 14 Tagen nach dem Kauf. Sie brauchen keinen Grund anzugeben und erhalten den vollen Preis zurück. Eine Anmeldung ist nicht nötig.',
      fieldName: 'Ihr Name',
      fieldOrderNo: 'Bestellnummer',
      fieldOrderNoHelp: 'Steht in der Bestellbestätigung und auf der Rechnung. Wenn Sie sie nicht finden: Tragen Sie die E-Mail-Adresse ein, mit der Sie gekauft haben, und lassen Sie das Feld leer — wir ordnen den Widerruf dann zu.',
      fieldEmail: 'E-Mail-Adresse für die Eingangsbestätigung',
      fieldEmailHelp: 'An diese Adresse schicken wir sofort die Bestätigung mit Datum und Uhrzeit des Eingangs.',
      fieldOrderSelect: 'Welche Bestellung möchten Sie widerrufen?',
      reviewTitle: 'Bitte prüfen',
      reviewText: 'Sie widerrufen den Vertrag über den Bewerbungs-Pass aus der Bestellung {{ORDER_NO}}. Name: {{CUSTOMER_NAME}}. Bestätigung an: {{CUSTOMER_EMAIL}}.',
      doneTitle: 'Ihr Widerruf ist eingegangen',
      doneText: 'Eingegangen am {{RECEIVED_AT}}. Wir haben Ihnen soeben eine Eingangsbestätigung an {{CUSTOMER_EMAIL}} geschickt. Bitte speichern oder drucken Sie diese Seite zusätzlich, wenn Sie einen eigenen Beleg möchten.',
      refundQueued: 'Die Erstattung von {{PRICE}} ist veranlasst und wird ausgeführt, sobald unser Zahlungsdienstleister sie verarbeitet.',
      refundDone: 'Die Erstattung von {{PRICE}} ist ausgeführt. Je nach Zahlungsart sehen Sie den Betrag in einigen Tagen auf Ihrem Konto.',
      refundFailed: 'Die automatische Erstattung hat nicht geklappt. Wir kümmern uns von Hand darum und melden uns innerhalb von zwei Werktagen per E-Mail. Ihr Widerruf ist trotzdem wirksam eingegangen.',
      unmatched: 'Wir konnten die Bestellung nicht sofort zuordnen. Ihr Widerruf ist trotzdem eingegangen und gilt als rechtzeitig, wenn Sie ihn innerhalb der Frist abgeschickt haben. Wir melden uns innerhalb von zwei Werktagen.',
      periodOver: 'Die Widerrufsfrist für diese Bestellung ist am {{WITHDRAWABLE_UNTIL}} abgelaufen. Sie können den Pass weiterhin über „Verträge hier kündigen" beenden.',
      errorRequired: 'Bitte füllen Sie Name und E-Mail-Adresse aus.',
      alsoAfterCancel: 'Der Widerruf ist auch möglich, wenn Sie den Pass bereits gekündigt haben, solange die Frist läuft.',
    },
  },
  en: {
    policy: {
      title: 'Right of withdrawal',
      rightTitle: 'Right of withdrawal',
      right: [
        'You have the right to withdraw from this contract within fourteen days without giving any reason.',
        'The withdrawal period will expire after fourteen days from the day of the conclusion of the contract.',
        'To exercise the right of withdrawal, you must inform us ({{SELLER_NAME}}, {{SELLER_ADDRESS}}, phone: {{SELLER_PHONE}}, e-mail: {{SELLER_EMAIL}}) of your decision to withdraw from this contract by an unequivocal statement (e.g. a letter sent by post or e-mail). You may use the attached model withdrawal form, but it is not obligatory. You can also exercise your right of withdrawal online at {{BASE_URL}}/widerruf (button "Withdraw from contract"; when signed in, also under "My pass" in your account). If you use this online function, we will send you an acknowledgement of receipt on a durable medium (e.g. by e-mail) without delay, stating the content of your withdrawal and the date and time of its receipt.',
        'To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired.',
      ],
      consequencesTitle: 'Effects of withdrawal',
      consequences: [
        'If you withdraw from this contract, we shall reimburse to you all payments received from you, including the costs of delivery (with the exception of the supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by us), without undue delay and in any event not later than fourteen days from the day on which we are informed about your decision to withdraw from this contract. We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.',
      ],
      voluntaryTitle: 'Beyond what the law requires',
      voluntaryPromise: [
        'If you withdraw, we do not charge you for the days on which you already used the pass. You get the full price back.',
        'We start the refund automatically as soon as your withdrawal reaches us. Depending on the payment method it may take a few days until the money is in your account.',
        'Withdrawal ends the pass bought with this order. Your account and your content stay; you can still read, export and delete them.',
      ],
      noEarlyExpiry: 'Your right of withdrawal does not expire early under this contract. You can withdraw during the entire withdrawal period, even if you are already using the pass.',
      endMarker: 'End of withdrawal information',
    },
    form: {
      title: 'Model withdrawal form',
      intro: '(Complete and return this form only if you wish to withdraw from the contract.)',
      lines: [
        'To {{SELLER_NAME}}, {{SELLER_ADDRESS}}, e-mail: {{SELLER_EMAIL}}:',
        'I/We (*) hereby give notice that I/We (*) withdraw from my/our (*) contract of sale of the following goods (*)/for the provision of the following service (*)',
        'Ordered on (*)/received on (*)',
        'Name of consumer(s)',
        'Address of consumer(s)',
        'Signature of consumer(s) (only if this form is notified on paper)',
        'Date',
      ],
      footnote: '(*) Delete as appropriate.',
    },
    fn: {
      buttonWithdraw: 'Withdraw from contract',
      buttonConfirm: 'Confirm withdrawal',
      pageTitle: 'Withdraw from contract',
      pageIntro: 'Here you can withdraw from your purchase of the application pass within 14 days of buying it. You do not need to give a reason, and you get the full price back. No sign-in needed.',
      fieldName: 'Your name',
      fieldOrderNo: 'Order number',
      fieldOrderNoHelp: 'It is in the order confirmation and on the invoice. If you cannot find it, enter the e-mail address you bought with and leave this field empty — we will match your withdrawal.',
      fieldEmail: 'E-mail address for the acknowledgement',
      fieldEmailHelp: 'We immediately send the acknowledgement with date and time of receipt to this address.',
      fieldOrderSelect: 'Which order do you want to withdraw from?',
      reviewTitle: 'Please check',
      reviewText: 'You are withdrawing from the contract for the application pass from order {{ORDER_NO}}. Name: {{CUSTOMER_NAME}}. Acknowledgement to: {{CUSTOMER_EMAIL}}.',
      doneTitle: 'Your withdrawal has been received',
      doneText: 'Received on {{RECEIVED_AT}}. We have just sent an acknowledgement to {{CUSTOMER_EMAIL}}. Please also save or print this page if you want your own record.',
      refundQueued: 'The refund of {{PRICE}} has been initiated and will be carried out as soon as our payment provider processes it.',
      refundDone: 'The refund of {{PRICE}} has been carried out. Depending on the payment method, you will see it in your account within a few days.',
      refundFailed: 'The automatic refund did not go through. We will handle it manually and get back to you by e-mail within two working days. Your withdrawal has still been validly received.',
      unmatched: 'We could not match the order right away. Your withdrawal has still been received and counts as on time if you sent it within the period. We will get back to you within two working days.',
      periodOver: 'The withdrawal period for this order ended on {{WITHDRAWABLE_UNTIL}}. You can still end the pass via "Cancel contracts here".',
      errorRequired: 'Please fill in your name and e-mail address.',
      alsoAfterCancel: 'You can also withdraw after cancelling the pass, as long as the withdrawal period is running.',
    },
  },
};
