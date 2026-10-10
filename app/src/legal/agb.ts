/**
 * Allgemeine Geschäftsbedingungen für den Bewerbungs-Pass.
 *
 * KEINE RECHTSBERATUNG — Entwurf, vor Livegang anwaltlich prüfen lassen.
 * Die Belege zu jeder Klausel stammen aus einer Recherche, die nicht Teil
 * dieses Repositorys ist — gegen die eigene Lage prüfen.
 *
 * Grundaufbau mit drei Ergänzungen aus der Recherche:
 * - § 7 Kündigung: § 312k BGB gilt nach BGH I ZR 161/24 auch für den Pass.
 * - § 4 Abs. 3–6: Pflichtangaben im elektronischen Geschäftsverkehr
 *   (Art. 246c EGBGB: technische Schritte, Speicherung des Vertragstexts,
 *   Eingabefehler, Sprache).
 * - § 6: Hinweis auf das gesetzliche Mängelrecht für digitale
 *   Dienstleistungen und auf Aktualisierungen (Art. 246a § 1 Abs. 1 Nr. 11b,
 *   11c EGBGB, in Kraft seit 27.09.2026).
 *
 * Bewusst NICHT enthalten:
 * - Kein Link auf die EU-OS-Plattform: Verordnung (EU) Nr. 524/2013 ist seit
 *   20.07.2025 aufgehoben (VO (EU) 2024/3228, Art. 1).
 * - Keine salvatorische Klausel (bei Verbrauchern gilt § 306 BGB ohnehin).
 * - Keine Einschränkung der Verfügbarkeit unter das gesetzlich Geschuldete
 *   (§ 327e, § 327h BGB) — nur eine ehrliche Beschreibung ohne SLA.
 *
 * Offene Entscheidung für den Betreiber:
 * - § 14 Abs. 3: Bereitschaft zur Verbraucherschlichtung (Vorschlag:
 *   nicht bereit und nicht verpflichtet — so steht es drin).
 *
 * Fassung 2026-10-10 (Prüfteam J1, Rechtsprüfung 10.10.2026, keine
 * Rechtsberatung):
 * - § 2 Abs. 2, § 13: AGB gelten für das kostenlose Konto nur, wenn bei der
 *   Registrierung auf sie hingewiesen wird (§ 305 Abs. 2 BGB). Der Hinweis im
 *   Registrierungsformular ist ein Patch-Wunsch an die Hauptsitzung.
 * - § 5: LaTeX-Export gehört seit Runde 8 zum Pass (freeTier.ts), Exportformate
 *   um LaTeX, JSON Resume und RenderCV-YAML ergänzt.
 * - Neuer § 15: Zugangscodes und Gratiszugang (Gutscheine gab es bisher nur
 *   auf der Code-Seite, ohne Vertragsgrundlage; „dauerhaft" ohne Grenze war
 *   ein Versprechen ohne Ende).
 *
 * Fassung 2026-10-10.2 (10.10.2026,
 * „Vorlagen-Staffel", keine Rechtsberatung):
 * - § 2 Abs. 1: kostenlos sind mindestens alle Vorlagen ansehen und
 *   gestalten, das PDF in den als kostenlos gekennzeichneten Vorlagen und in
 *   jeder Vorlage als einspaltige ATS-Fassung (Anhang Nr. 20 UWG: „kostenlos"
 *   nur, wo es stimmt).
 * - § 2 Abs. 3: Zusage „PDF nie vom Kauf abhängig" ersetzt durch die Pflicht,
 *   vor der Arbeit zu kennzeichnen (§ 5a Abs. 2 Nr. 3 UWG).
 * - § 5 Abs. 1: PDF und HTML in allen Vorlagen gehören zum Pass.
 * - § 7 Abs. 5: nach Widerruf Datenexport statt Export in allen Formaten
 *   (§ 357 Abs. 8 i. V. m. § 327p Abs. 1 S. 2 BGB).
 */
import type { Bilingual, LegalSection } from './types';

export interface TermsTexts {
  title: string;
  subtitle: string;
  sections: LegalSection[];
}

export const AGB: Bilingual<TermsTexts> = {
  version: '2026-10-10.2',
  de: {
    title: 'Allgemeine Geschäftsbedingungen',
    subtitle: 'für den Bewerbungs-Pass von {{PRODUCT_NAME}} · Fassung {{TERMS_VERSION}}',
    sections: [
      {
        id: 'geltung',
        title: '§ 1 Geltungsbereich, Anbieter, Sprache',
        paragraphs: [
          '(1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge über den Bewerbungs-Pass („Pass") für {{PRODUCT_NAME}} zwischen {{SELLER_NAME}}, {{SELLER_ADDRESS}} („wir", „uns") und Ihnen als Kundin oder Kunde („Sie"). Sie gelten für Verbraucher (§ 13 BGB) und Unternehmer (§ 14 BGB). Regeln, die nur für Verbraucher oder nur für Unternehmer gelten, sind als solche bezeichnet.',
          '(2) So erreichen Sie uns: Telefon {{SELLER_PHONE}}, E-Mail {{SELLER_EMAIL}}, Post an die Anschrift in Absatz 1. Beschwerden richten Sie bitte an dieselben Kontaktwege; wir antworten in der Regel innerhalb von zwei Werktagen.',
          '(3) Für Unternehmer gilt: Abweichende oder ergänzende Bedingungen des Kunden werden nicht Vertragsbestandteil, auch wenn wir ihnen nicht ausdrücklich widersprechen.',
          '(4) Vertragssprache ist Deutsch. Eine englische Fassung dieser AGB stellen wir als Lesehilfe bereit; maßgeblich ist allein die deutsche Fassung.',
        ],
      },
      {
        id: 'kostenlos',
        title: '§ 2 Kostenlose Nutzung',
        paragraphs: [
          '(1) Das Werkzeug lässt sich ohne Konto und ohne Pass kostenlos nutzen („lokaler Modus"). Kostenlos sind dabei mindestens: alle Vorlagen mit Ihrem Inhalt ansehen und gestalten, das PDF Ihres Lebenslaufs in den als kostenlos gekennzeichneten Vorlagen sowie in jeder Vorlage als einspaltige ATS-Fassung, die Prüfung, der Import, der Datenexport und die Speicherung der Daten in Ihrem Browser. Welche Funktionen darüber hinaus kostenlos sind, steht auf der Preisseite. Der lokale Modus ist nicht Gegenstand des Vertrags über den Pass. Für ihn gelten die gesetzlichen Regeln für unentgeltliche Leistungen.',
          '(2) Ein Konto können Sie kostenlos anlegen. Ohne aktiven Pass können Sie darin gespeicherte Inhalte lesen, exportieren und löschen, aber nicht ändern oder neu anlegen. Für das Konto gelten §§ 3, 9, 10, 11, 13, 14 und 15 dieser AGB entsprechend, wenn wir Sie bei der Registrierung auf diese AGB hingewiesen haben.',
          '(3) Der Kauf eines Passes schränkt die kostenlosen Funktionen nicht ein. Was zum Pass gehört und was kostenlos ist, steht vor jeder Arbeit sichtbar auf der Preisseite und am jeweiligen Knopf, nicht erst beim Herunterladen.',
        ],
      },
      {
        id: 'konto',
        title: '§ 3 Konto',
        paragraphs: [
          '(1) Ein Konto dürfen Sie ab 16 Jahren anlegen. Den Pass kaufen dürfen Sie ab 18 Jahren (§ 4 Abs. 7).',
          '(2) Zur Registrierung geben Sie eine E-Mail-Adresse und ein Passwort an und bestätigen die E-Mail-Adresse über den Link in unserer Bestätigungsmail. Konten, deren E-Mail-Adresse nicht innerhalb von 48 Stunden bestätigt wurde und zu denen nichts gekauft wurde, löschen wir automatisch.',
          '(3) Ein Konto ist persönlich. Halten Sie Ihr Passwort, Ihre API-Schlüssel und die Zugänge verbundener KI-Programme geheim. Wenn Sie einen Missbrauch vermuten, ändern Sie das Passwort und informieren Sie uns.',
          '(4) Sie können Ihr Konto jederzeit in den Einstellungen löschen. Was wir nach der Löschung aus steuerlichen Gründen aufbewahren müssen, steht in der Datenschutzerklärung.',
        ],
      },
      {
        id: 'vertragsschluss',
        title: '§ 4 Vertragsschluss',
        paragraphs: [
          '(1) Die Darstellung des Passes auf unserer Website ist noch kein bindendes Angebot, sondern eine Einladung, eine Bestellung abzugeben.',
          '(2) So kommt der Vertrag zustande (technische Schritte):',
        ],
        list: [
          'Sie melden sich in Ihrem Konto an oder legen eines an.',
          'Sie wählen „Pass kaufen". Es öffnet sich die Bestellübersicht mit Produkt, Leistungen, Preis, Laufzeit, Ihrem Namen für die Rechnung und Ihrem Land.',
          'Sie prüfen Ihre Angaben und korrigieren sie bei Bedarf direkt in den Feldern der Bestellübersicht (siehe Absatz 4).',
          'Sie bestätigen die AGB und Ihre Volljährigkeit.',
          'Mit dem Klick auf „zahlungspflichtig bestellen" geben Sie ein verbindliches Angebot zum Abschluss des Vertrags ab.',
          'Sie werden zu unserem Zahlungsdienstleister Mollie B.V. weitergeleitet, wählen dort eine Zahlungsart und zahlen.',
          'Ist die Zahlung erfolgreich, nehmen wir Ihr Angebot an, indem wir den Pass freischalten. Damit ist der Vertrag geschlossen. Wir schicken Ihnen sofort eine Bestellbestätigung mit dem Vertragsinhalt, diesen AGB, der Widerrufsbelehrung, dem Muster-Widerrufsformular und der Rechnung per E-Mail.',
          'Schlägt die Zahlung fehl oder brechen Sie sie ab, kommt kein Vertrag zustande; Ihr Angebot erlischt. Ihnen entstehen keine Kosten.',
        ],
        after: [
          '(3) Wir speichern den Vertragstext (Ihre Bestelldaten und die zum Zeitpunkt der Bestellung gültige Fassung dieser AGB und der Widerrufsbelehrung). Ihre Bestellungen und Rechnungen sehen Sie im Konto unter „Mein Pass". Die Vertragsunterlagen erhalten Sie außerdem mit der Bestellbestätigung per E-Mail; bitte speichern Sie sie.',
          '(4) Eingabefehler erkennen und berichtigen Sie vor dem Absenden in der Bestellübersicht: Alle Angaben stehen dort vollständig und lassen sich in den Feldern ändern. Fehlt etwas Erforderliches, weist die Seite darauf hin. Mit der Zoom-Funktion Ihres Browsers können Sie die Darstellung vergrößern. Bei Mollie können Sie den Vorgang abbrechen und zur Bestellübersicht zurückkehren.',
          '(5) Der Vertrag kann nur auf Deutsch geschlossen werden (§ 1 Abs. 4). Einem Verhaltenskodex haben wir uns nicht unterworfen.',
          '(6) Den Pass können Kundinnen und Kunden mit Wohnsitz oder Sitz in Deutschland oder einem anderen Mitgliedstaat der Europäischen Union kaufen. Unternehmer können den Pass nur kaufen, wenn sie ihren Sitz in Deutschland haben. Welche Zahlungsarten angeboten werden, steht spätestens zu Beginn des Bestellvorgangs auf der Bestellseite.',
          '(7) Den Pass dürfen nur volljährige Personen kaufen. Sie bestätigen das bei der Bestellung. Hat trotzdem eine minderjährige Person ohne Zustimmung ihrer Eltern gekauft, erstatten wir den Preis auf Anfrage vollständig.',
        ],
      },
      {
        id: 'leistung',
        title: '§ 5 Leistungen des Passes',
        paragraphs: [
          '(1) Während der Laufzeit schaltet der Pass in Ihrem Konto frei:',
        ],
        list: [
          'PDF und HTML Ihrer Lebensläufe in allen Vorlagen,',
          'Export Ihrer Lebensläufe als Word-Datei (DOCX), gestaltet nach der gewählten Vorlage und als einspaltige ATS-Fassung, sowie als LaTeX-Quelltext,',
          'Anschreiben: erstellen, bearbeiten, prüfen und exportieren,',
          'mehrere Fassungen Ihres Lebenslaufs (weitere anlegen, duplizieren, als neue Fassung importieren) und weitere Dokumentsprachen (Deutsch, Englisch, Französisch, Spanisch),',
          'Speichern Ihrer Lebensläufe, Anschreiben und Fotos auf unserem Server und Zugriff darauf von mehreren Geräten,',
          'Sharelinks: Links, über die Sie einen Lebenslauf mit anderen teilen und die Sie jederzeit widerrufen können,',
          'gespeicherte Versionen am Server (frühere Stände wiederherstellen),',
          'Verbindung zu KI-Programmen über das Model Context Protocol (MCP),',
          'API-Schlüssel für eigene Programme.',
        ],
        after: [
          '(2) Wir betreiben den Dienst mit der Sorgfalt, die für ein Angebot dieser Art üblich ist, und sichern die Daten regelmäßig. Eine bestimmte Verfügbarkeit in Prozent sagen wir nicht zu. Kurze Unterbrechungen für Wartung und Aktualisierungen sind möglich; wir halten sie so kurz wie möglich und kündigen geplante längere Unterbrechungen vorher an. Für Verbraucher bleiben die gesetzlichen Anforderungen an digitale Dienstleistungen (§§ 327e ff. BGB) unberührt.',
          '(3) Technische Voraussetzungen: ein aktueller Browser (Chrome, Edge, Firefox oder Safari in einer der beiden neuesten Hauptversionen) mit eingeschaltetem JavaScript. Für die KI-Verbindung brauchen Sie ein Programm, das MCP unterstützt; für dessen Funktionsweise sind wir nicht verantwortlich. Exporte liegen in offenen Formaten vor (PDF, DOCX, HTML, Markdown, JSON, JSON Resume, LaTeX, RenderCV-YAML); welche davon ohne Pass kostenlos sind, steht auf der Preisseite.',
          '(4) Tipps, Prüfungen und der ATS-Abgleich im Werkzeug sind Hinweise. Ob eine Bewerbung Erfolg hat, hängt von vielen Dingen ab, die wir nicht beeinflussen; einen Erfolg schulden wir nicht.',
        ],
      },
      {
        id: 'gewaehrleistung',
        title: '§ 6 Gesetzliches Mängelrecht, Aktualisierungen, Änderungen',
        paragraphs: [
          '(1) Es gilt das gesetzliche Mängelhaftungsrecht. Für Verbraucher sind das die Vorschriften über digitale Dienstleistungen (§§ 327 ff. BGB).',
          '(2) Wir stellen Ihnen während der gesamten Laufzeit des Passes die Aktualisierungen bereit, die nötig sind, damit der Dienst vertragsgemäß bleibt, einschließlich Sicherheitsaktualisierungen. Da der Dienst im Browser läuft, erhalten Sie Aktualisierungen automatisch beim nächsten Laden der Seite. Über wichtige Änderungen informieren wir im Werkzeug.',
          '(3) Darüber hinaus dürfen wir den Dienst nur aus triftigem Grund ändern, etwa um ihn an neue Technik, neue Browser, Sicherheitsanforderungen oder geänderte Rechtslage anzupassen, um Funktionen zu verbessern oder um Missbrauch zu verhindern. Solche Änderungen kosten Sie nichts zusätzlich, und wir informieren Sie klar und verständlich darüber.',
          '(4) Beeinträchtigt eine Änderung nach Absatz 3 Ihren Zugriff auf den Dienst oder seine Nutzbarkeit mehr als nur unerheblich, informieren wir Sie rechtzeitig vorher per E-Mail über Merkmale und Zeitpunkt der Änderung und über Ihre Rechte. Sie können den Vertrag dann innerhalb von 30 Tagen nach Zugang der Information oder, wenn die Änderung später erfolgt, nach der Änderung unentgeltlich beenden; den Preis für die restliche Laufzeit erstatten wir anteilig. Das gilt nicht, wenn Sie die unveränderte Fassung ohne Mehrkosten weiter nutzen können (§ 327r BGB).',
          '(5) Für Unternehmer gilt: Mängel sind uns unverzüglich in Textform anzuzeigen.',
        ],
      },
      {
        id: 'laufzeit',
        title: '§ 7 Laufzeit, Ende, Kündigung, Verlängerung',
        paragraphs: [
          '(1) Der Pass läuft {{DAYS}} Tage ab Vertragsschluss (Freischaltung) und endet danach von selbst. Er ist kein Abonnement: Er verlängert sich nicht, und es wird nichts weiter abgebucht. Wir erinnern Sie vor dem Ende per E-Mail.',
          '(2) Sie können jederzeit einen weiteren Pass kaufen. Jeder Kauf ist ein eigener Vertrag. Die Laufzeit des neuen Passes schließt an das Ende eines noch laufenden Passes an; läuft keiner, beginnt sie mit dem Kauf.',
          '(3) Sie können den Pass jederzeit über die Schaltfläche „Verträge hier kündigen" (in der Fußzeile jeder Seite, ohne Anmeldung), per E-Mail oder per Post kündigen. Eine ordentliche Kündigung wirkt zu dem Zeitpunkt, den Sie angeben; ohne Angabe sofort. Den bereits gezahlten Preis erstatten wir bei einer ordentlichen Kündigung nicht anteilig. Innerhalb der Widerrufsfrist ist der Widerruf für Sie günstiger (§ 8).',
          '(4) Das Recht beider Seiten zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Kündigen Sie berechtigt aus wichtigem Grund, den wir zu vertreten haben, erstatten wir den Preis für die restliche Laufzeit anteilig. Ihre gesetzlichen Rechte bei Mängeln bleiben unberührt.',
          '(5) Nach dem Ende des Passes bleibt Ihr Konto bestehen. Sie können Ihre Inhalte weiter lesen, als Datei exportieren (in allen Formaten und Vorlagen einschließlich Word und auch als vollständigen Datenexport) und löschen, aber nicht mehr ändern oder neu anlegen; neue Sharelinks lassen sich nicht anlegen, bestehende können Sie jederzeit widerrufen. Das gilt nicht nach einem Widerruf; dann stellen wir Ihre Inhalte als Datenexport bereit (§ 357 Abs. 8, § 327p BGB). Wir löschen Ihre Inhalte nach dem Ende des Passes nicht von uns aus, sondern wenn Sie das Konto oder einzelne Inhalte löschen oder uns darum bitten.',
        ],
      },
      {
        id: 'preise',
        title: '§ 8 Preise, Zahlung, Widerruf',
        paragraphs: [
          '(1) Der Pass kostet {{PRICE}} einmalig. Das ist ein Endpreis. Gemäß § 19 UStG (Kleinunternehmerregelung) berechnen wir keine Umsatzsteuer und weisen sie deshalb nicht aus. Weitere Kosten fallen nicht an.',
          '(2) Sie zahlen bei der Bestellung über unseren Zahlungsdienstleister Mollie B.V. mit einer der dort angezeigten Zahlungsarten. Der Preis ist mit der Bestellung fällig. Für die Zahlung gelten zusätzlich die Bedingungen der jeweiligen Zahlungsart.',
          '(3) Die Rechnung erhalten Sie als PDF mit der Bestellbestätigung; Sie finden sie außerdem im Konto unter „Mein Pass".',
          '(4) Verbrauchern steht ein gesetzliches Widerrufsrecht zu. Einzelheiten stehen in der Widerrufsbelehrung, die wir Ihnen vor der Bestellung zeigen und mit der Bestellbestätigung schicken. Über das Gesetz hinaus verlangen wir bei einem Widerruf keinen Wertersatz für die bereits genutzte Zeit: Sie erhalten den vollen Preis zurück. Den Widerruf können Sie über die Schaltfläche „Vertrag widerrufen" erklären ({{BASE_URL}}/widerruf, ohne Anmeldung).',
        ],
      },
      {
        id: 'inhalte',
        title: '§ 9 Ihre Inhalte und Sharelinks',
        paragraphs: [
          '(1) Ihre Inhalte gehören Ihnen. Sie räumen uns nur die Rechte ein, die wir brauchen, um den Dienst zu erbringen: Inhalte speichern, sichern, darstellen, in Dateien umwandeln und über Ihre Sharelinks an die Personen ausliefern, denen Sie den Link geben. Wir werten Ihre Inhalte nicht für Werbung aus und verkaufen sie nicht.',
          '(2) Sie sind für Ihre Inhalte verantwortlich. Laden Sie nur Fotos hoch, an denen Sie die nötigen Rechte haben, in der Regel Fotos von sich selbst. Wenn Ihr Lebenslauf Kontaktdaten anderer Personen enthält (etwa Referenzen), teilen Sie ihn nur, wenn diese Personen damit einverstanden sind.',
          '(3) Nicht erlaubt sind Inhalte, die gegen geltendes Recht verstoßen oder Rechte Dritter verletzen, insbesondere: Inhalte, die andere beleidigen, bedrohen oder herabwürdigen; Daten Dritter ohne Berechtigung; Inhalte, die Urheber-, Marken- oder Persönlichkeitsrechte verletzen; Schadsoftware; das Nutzen von Sharelinks zum Verbreiten von Werbung, Spam oder Inhalten, die mit Bewerbungen nichts zu tun haben. Ebenfalls nicht erlaubt ist es, den Dienst zu überlasten, Sicherheitsmaßnahmen zu umgehen oder ihn automatisiert in einem Umfang zu nutzen, der über die eigene Bewerbung hinausgeht.',
          '(4) Rechtswidrige Inhalte kann jede Person über den Link „Inhalt melden" auf jeder Sharelink-Seite oder per E-Mail an {{SELLER_EMAIL}} melden. Wir prüfen Meldungen zügig, sorgfältig und objektiv und teilen der meldenden Person das Ergebnis mit (Art. 16 Verordnung (EU) 2022/2065, Digital Services Act). Kontaktstelle für Behörden und Nutzer nach Art. 11 und 12 dieser Verordnung ist {{SELLER_EMAIL}}; Kommunikation auf Deutsch oder Englisch.',
          '(5) Verstößt ein Inhalt gegen Absatz 3, dürfen wir den betroffenen Sharelink sperren oder den Inhalt für Dritte unzugänglich machen. Wir begründen das Ihnen gegenüber klar und konkret, nennen die Tatsachen und die Rechtsgrundlage oder die Klausel dieser AGB und sagen Ihnen, wie Sie widersprechen können (Art. 17 DSA). Ihre übrigen Inhalte bleiben für Sie zugänglich und exportierbar. Ein Konto sperren wir nur bei schweren oder wiederholten Verstößen und nach vorheriger Warnung, außer bei Gefahr im Verzug.',
        ],
      },
      {
        id: 'sicherung',
        title: '§ 10 Datensicherung',
        paragraphs: [
          '(1) Wir sichern die Daten auf unseren Servern regelmäßig. Trotzdem empfehlen wir Ihnen, wichtige Lebensläufe zusätzlich selbst zu sichern, zum Beispiel als Datenexport, PDF oder Word-Datei. Das geht jederzeit und auch nach dem Ende des Passes.',
          '(2) Sie können jederzeit eine Kopie aller Inhalte Ihres Kontos in einem gängigen, maschinenlesbaren Format herunterladen (Datenexport im Konto).',
        ],
      },
      {
        id: 'haftung',
        title: '§ 11 Haftung',
        paragraphs: [
          '(1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, nach dem Produkthaftungsgesetz und soweit wir eine Garantie übernommen haben.',
          '(2) Bei leichter Fahrlässigkeit haften wir nur, wenn wir eine wesentliche Vertragspflicht verletzen. Wesentlich sind Pflichten, die die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglichen und auf deren Einhaltung Sie regelmäßig vertrauen dürfen, etwa die Bereitstellung des Dienstes und der Schutz Ihrer Daten. In diesem Fall ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt.',
          '(3) Die Absätze 1 und 2 gelten auch für unsere Erfüllungsgehilfen. Ansprüche aus Mängeln nach §§ 327 ff. BGB und aus der Datenschutz-Grundverordnung bleiben unberührt.',
        ],
      },
      {
        id: 'alter',
        title: '§ 12 Mindestalter',
        paragraphs: [
          'Ein Konto dürfen Personen ab 16 Jahren anlegen, den Pass kaufen dürfen nur Volljährige. Der lokale Modus ohne Konto hat keine Altersgrenze; er eignet sich besonders für Bewerbungen um Ausbildungs- und Praktikumsplätze.',
        ],
      },
      {
        id: 'aenderung-agb',
        title: '§ 13 Änderungen dieser AGB',
        paragraphs: [
          '(1) Für einen bereits gekauften Pass gilt die Fassung dieser AGB, die bei der Bestellung galt. Eine neue Fassung gilt erst für spätere Käufe.',
          '(2) Für das kostenlose Konto und einen eingelösten Zugangscode (§ 15) teilen wir Änderungen mindestens sechs Wochen vor ihrem Inkrafttreten per E-Mail mit und nennen dabei die geänderten Regeln. Die neue Fassung gilt nur, wenn Sie ihr zustimmen; stimmen Sie nicht zu, gilt für Ihr Konto die bisherige Fassung weiter. Sie können das Konto außerdem jederzeit löschen.',
        ],
      },
      {
        id: 'schluss',
        title: '§ 14 Recht, Gerichtsstand, Streitbeilegung',
        paragraphs: [
          '(1) Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Sind Sie Verbraucher mit gewöhnlichem Aufenthalt in einem anderen Staat, behalten Sie den Schutz der zwingenden Vorschriften dieses Staates (Art. 6 Abs. 2 Rom-I-Verordnung).',
          '(2) Für Verbraucher gibt es keinen vereinbarten Gerichtsstand; es gelten die gesetzlichen Regeln. Sind Sie Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand für alle Streitigkeiten aus diesem Vertrag unser Sitz.',
          '(3) Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Bei Fragen oder Beschwerden wenden Sie sich bitte direkt an uns (§ 1 Abs. 2); wir suchen mit Ihnen eine Lösung.',
        ],
      },
      {
        id: 'zugangscodes',
        title: '§ 15 Zugangscodes und Gratiszugang',
        paragraphs: [
          '(1) Mit einem Zugangscode (Gutschein) erhalten Sie die Leistungen des Passes (§ 5) kostenlos, entweder für eine bestimmte Zahl von Tagen oder als dauerhaften Gratiszugang. Was ein Code gewährt, bis wann er sich einlösen lässt und ob die Zahl der Einlösungen begrenzt ist, zeigen wir vor der Einlösung an. Einlösen können Sie einen Code mit einem Konto, dessen E-Mail-Adresse bestätigt ist.',
          '(2) Jeder Code lässt sich je Konto einmal einlösen, aus derselben Aktion höchstens ein Code je Konto. Ein Code kann nicht in Geld ausgezahlt und nicht mit einem Kauf verrechnet werden. Einen noch nicht eingelösten Code können wir deaktivieren, wenn er erkennbar missbräuchlich verbreitet wird.',
          '(3) Ein Zeitzugang beginnt mit der Einlösung, schließt an eine noch laufende Laufzeit an und endet danach von selbst. Es wird nichts abgebucht.',
          '(4) Ein dauerhafter Gratiszugang gilt, solange wir den Dienst betreiben. Wollen wir den Dienst einstellen, kündigen wir das mindestens drei Monate vorher per E-Mail an; bis zum Ende können Sie alle Inhalte exportieren.',
          '(5) Für den Gratiszugang gelten die Regeln dieser AGB zu Ihren Inhalten, Sharelinks, Datensicherung und Haftung (§§ 9 bis 11) entsprechend. Da Sie dafür nichts bezahlen, besteht kein Widerrufsrecht; Sie können den Zugang aber jederzeit beenden, indem Sie Ihr Konto löschen.',
        ],
      },
    ],
  },
  en: {
    title: 'General Terms and Conditions',
    subtitle: 'for the application pass of {{PRODUCT_NAME}} · version {{TERMS_VERSION}} · reading aid, the German version is binding',
    sections: [
      {
        id: 'geltung',
        title: '§ 1 Scope, provider, language',
        paragraphs: [
          '(1) These General Terms and Conditions (Terms) apply to all contracts for the application pass ("pass") for {{PRODUCT_NAME}} between {{SELLER_NAME}}, {{SELLER_ADDRESS}} ("we", "us") and you as customer ("you"). They apply to consumers (§ 13 BGB) and businesses (§ 14 BGB). Rules that apply only to consumers or only to businesses are marked as such.',
          '(2) How to reach us: phone {{SELLER_PHONE}}, e-mail {{SELLER_EMAIL}}, post to the address in paragraph 1. Please send complaints through the same channels; we usually reply within two working days.',
          '(3) For businesses: deviating or additional terms of the customer do not become part of the contract, even if we do not expressly object to them.',
          '(4) The contract language is German. We provide an English version of these Terms as a reading aid; only the German version is binding.',
        ],
      },
      {
        id: 'kostenlos',
        title: '§ 2 Free use',
        paragraphs: [
          '(1) The tool can be used free of charge without an account and without a pass ("local mode"). Free of charge are at least: viewing and designing all templates with your content, the PDF of your CV in the templates marked as free and in every template as the single-column ATS version, the check, import, data export and data stored in your browser. Which further features are free is shown on the pricing page. Local mode is not part of the contract for the pass. The statutory rules for services provided free of charge apply to it.',
          '(2) You can create an account free of charge. Without an active pass you can read, export and delete content stored in it, but not change it or create new content. §§ 3, 9, 10, 11, 13, 14 and 15 of these Terms apply to the account accordingly where we referred you to these Terms when you registered.',
          '(3) Buying a pass does not restrict the free features. What belongs to the pass and what is free is shown visibly on the pricing page and on the respective button before any work, not only at download.',
        ],
      },
      {
        id: 'konto',
        title: '§ 3 Account',
        paragraphs: [
          '(1) You may create an account from the age of 16. You may buy the pass from the age of 18 (§ 4(7)).',
          '(2) To register, you provide an e-mail address and a password and confirm the e-mail address via the link in our confirmation e-mail. Accounts whose e-mail address has not been confirmed within 48 hours and for which nothing has been bought are deleted automatically.',
          '(3) An account is personal. Keep your password, your API keys and the access of connected AI programs secret. If you suspect misuse, change your password and let us know.',
          '(4) You can delete your account at any time in the settings. What we must keep after deletion for tax reasons is described in the privacy policy.',
        ],
      },
      {
        id: 'vertragsschluss',
        title: '§ 4 Conclusion of the contract',
        paragraphs: [
          '(1) The presentation of the pass on our website is not a binding offer but an invitation to place an order.',
          '(2) This is how the contract is concluded (technical steps):',
        ],
        list: [
          'You sign in to your account or create one.',
          'You choose "Buy pass". The order overview opens, showing product, features, price, term, your name for the invoice and your country.',
          'You check your details and correct them if needed directly in the fields of the order overview (see paragraph 4).',
          'You confirm the Terms and that you are of age.',
          'By clicking "zahlungspflichtig bestellen" ("order with obligation to pay") you make a binding offer to conclude the contract.',
          'You are forwarded to our payment provider Mollie B.V., choose a payment method there and pay.',
          'If the payment succeeds, we accept your offer by activating the pass. The contract is then concluded. We immediately send you an order confirmation by e-mail with the content of the contract, these Terms, the withdrawal information, the model withdrawal form and the invoice.',
          'If the payment fails or you cancel it, no contract is concluded; your offer lapses. You incur no costs.',
        ],
        after: [
          '(3) We store the contract text (your order data and the version of these Terms and of the withdrawal information valid at the time of the order). You can see your orders and invoices in your account under "My pass". You also receive the contract documents with the order confirmation by e-mail; please keep them.',
          '(4) You can spot and correct input errors before submitting in the order overview: all details are shown there in full and can be changed in the fields. If something required is missing, the page tells you. You can enlarge the display with your browser\'s zoom function. At Mollie you can cancel the process and return to the order overview.',
          '(5) The contract can only be concluded in German (§ 1(4)). We have not subscribed to any code of conduct.',
          '(6) The pass can be bought by customers residing or established in Germany or another member state of the European Union. Businesses can only buy the pass if they are established in Germany. The payment methods offered are shown on the order page at the latest at the start of the ordering process.',
          '(7) Only adults may buy the pass. You confirm this when ordering. If a minor has nevertheless bought without their parents\' consent, we refund the price in full on request.',
        ],
      },
      {
        id: 'leistung',
        title: '§ 5 Features of the pass',
        paragraphs: [
          '(1) During its term, the pass unlocks in your account:',
        ],
        list: [
          'PDF and HTML of your CVs in all templates,',
          'exporting your CVs as Word files (DOCX), designed after the chosen template and as a single-column ATS version, and as LaTeX source,',
          'cover letters: create, edit, check and export,',
          'several versions of your CV (create more, duplicate, import as a new version) and further document languages (German, English, French, Spanish),',
          'saving your CVs, cover letters and photos on our server and accessing them from several devices,',
          'share links: links you can use to share a CV with others and revoke at any time,',
          'stored versions on the server (restore earlier states),',
          'connection to AI programs via the Model Context Protocol (MCP),',
          'API keys for your own programs.',
        ],
        after: [
          '(2) We run the service with the care customary for an offer of this kind and back up the data regularly. We do not promise a specific availability percentage. Short interruptions for maintenance and updates are possible; we keep them as short as possible and announce planned longer interruptions in advance. For consumers, the statutory requirements for digital services (§§ 327e et seq. BGB) remain unaffected.',
          '(3) Technical requirements: a current browser (Chrome, Edge, Firefox or Safari in one of the two latest major versions) with JavaScript enabled. For the AI connection you need a program that supports MCP; we are not responsible for how it works. Exports are provided in open formats (PDF, DOCX, HTML, Markdown, JSON, JSON Resume, LaTeX, RenderCV YAML); which of them are free without a pass is shown on the pricing page.',
          '(4) Tips, checks and the ATS comparison in the tool are guidance. Whether an application succeeds depends on many things we cannot influence; we do not owe any success.',
        ],
      },
      {
        id: 'gewaehrleistung',
        title: '§ 6 Statutory warranty, updates, changes',
        paragraphs: [
          '(1) The statutory liability for defects applies. For consumers, these are the rules on digital services (§§ 327 et seq. BGB).',
          '(2) Throughout the term of the pass we provide the updates needed to keep the service in conformity with the contract, including security updates. As the service runs in the browser, you receive updates automatically the next time the page loads. We inform you in the tool about important changes.',
          '(3) Beyond that, we may only change the service for a valid reason, for example to adapt it to new technology, new browsers, security requirements or changes in the law, to improve features or to prevent misuse. Such changes cost you nothing extra, and we inform you about them clearly and comprehensibly.',
          '(4) If a change under paragraph 3 affects your access to or the usability of the service more than insignificantly, we inform you by e-mail in good time beforehand about the features and timing of the change and about your rights. You can then terminate the contract free of charge within 30 days of receiving the information or, if the change happens later, of the change; we refund the price for the remaining term pro rata. This does not apply if you can continue to use the unchanged version without extra cost (§ 327r BGB).',
          '(5) For businesses: defects must be notified to us in text form without undue delay.',
        ],
      },
      {
        id: 'laufzeit',
        title: '§ 7 Term, end, cancellation, extension',
        paragraphs: [
          '(1) The pass runs for {{DAYS}} days from the conclusion of the contract (activation) and then ends by itself. It is not a subscription: it does not renew and nothing further is charged. We remind you by e-mail before it ends.',
          '(2) You can buy another pass at any time. Each purchase is a separate contract. The term of the new pass follows on from the end of a pass that is still running; if none is running, it starts with the purchase.',
          '(3) You can cancel the pass at any time via the "Cancel contracts here" button (in the footer of every page, no sign-in needed), by e-mail or by post. An ordinary cancellation takes effect at the time you specify; without a date, immediately. We do not refund the price already paid pro rata on ordinary cancellation. During the withdrawal period, withdrawal is the better option for you (§ 8).',
          '(4) Both parties\' right to extraordinary termination for good cause remains unaffected. If you justifiably terminate for good cause for which we are responsible, we refund the price for the remaining term pro rata. Your statutory rights in case of defects remain unaffected.',
          '(5) After the pass ends, your account remains. You can still read your content, export it as files (in all formats and templates including Word, and also as a full data export) and delete it, but you can no longer change it or create new content; new share links cannot be created, existing ones can be revoked at any time. This does not apply after a withdrawal; in that case we provide your content as a data export (§ 357(8), § 327p BGB). We do not delete your content on our own initiative after the pass ends, but when you delete the account or individual content or ask us to.',
        ],
      },
      {
        id: 'preise',
        title: '§ 8 Prices, payment, withdrawal',
        paragraphs: [
          '(1) The pass costs {{PRICE}} once. This is a final price. Under § 19 of the German VAT Act (small business scheme) we do not charge VAT and therefore do not show it. There are no further costs.',
          '(2) You pay when ordering via our payment provider Mollie B.V. using one of the payment methods shown there. The price is due on ordering. The terms of the respective payment method also apply to the payment.',
          '(3) You receive the invoice as a PDF with the order confirmation; you can also find it in your account under "My pass".',
          '(4) Consumers have a statutory right of withdrawal. Details are in the withdrawal information, which we show you before ordering and send with the order confirmation. Beyond what the law requires, we do not charge for the time already used if you withdraw: you get the full price back. You can declare your withdrawal via the "Withdraw from contract" button ({{BASE_URL}}/widerruf, no sign-in needed).',
        ],
      },
      {
        id: 'inhalte',
        title: '§ 9 Your content and share links',
        paragraphs: [
          '(1) Your content belongs to you. You grant us only the rights we need to provide the service: storing, backing up, displaying and converting content into files, and delivering it via your share links to the people you give the link to. We do not use your content for advertising and do not sell it.',
          '(2) You are responsible for your content. Only upload photos to which you hold the necessary rights, usually photos of yourself. If your CV contains other people\'s contact details (such as references), only share it if those people agree.',
          '(3) Not permitted is content that violates applicable law or the rights of third parties, in particular: content that insults, threatens or degrades others; third-party data without authorisation; content that infringes copyright, trademark or personality rights; malware; using share links to spread advertising, spam or content unrelated to applications. It is also not permitted to overload the service, circumvent security measures or use it automatically to an extent beyond your own application.',
          '(4) Anyone can report illegal content via the "Report content" link on every share-link page or by e-mail to {{SELLER_EMAIL}}. We process reports promptly, diligently and objectively and inform the reporting person of the outcome (Art. 16 Regulation (EU) 2022/2065, Digital Services Act). The point of contact for authorities and users under Art. 11 and 12 of that Regulation is {{SELLER_EMAIL}}; communication in German or English.',
          '(5) If content violates paragraph 3, we may block the share link concerned or make the content inaccessible to third parties. We give you a clear and specific statement of reasons, naming the facts and the legal ground or the clause of these Terms, and tell you how to object (Art. 17 DSA). Your other content remains accessible and exportable for you. We only suspend an account for serious or repeated violations and after a prior warning, except in urgent cases.',
        ],
      },
      {
        id: 'sicherung',
        title: '§ 10 Backups',
        paragraphs: [
          '(1) We back up the data on our servers regularly. We still recommend that you also keep your own copy of important CVs, for example as a data export, PDF or Word file. This is possible at any time, including after the pass ends.',
          '(2) You can download a copy of all content in your account in a common, machine-readable format at any time (data export in your account).',
        ],
      },
      {
        id: 'haftung',
        title: '§ 11 Liability',
        paragraphs: [
          '(1) We are liable without limitation for intent and gross negligence, for damage arising from injury to life, body or health, under the Product Liability Act and to the extent we have given a guarantee.',
          '(2) In cases of slight negligence we are only liable if we breach an essential contractual obligation. Essential obligations are those whose fulfilment makes the proper performance of the contract possible in the first place and on whose fulfilment you may regularly rely, such as providing the service and protecting your data. In that case liability is limited to the damage typical for the contract and foreseeable when the contract was concluded.',
          '(3) Paragraphs 1 and 2 also apply to our vicarious agents. Claims for defects under §§ 327 et seq. BGB and under the General Data Protection Regulation remain unaffected.',
        ],
      },
      {
        id: 'alter',
        title: '§ 12 Minimum age',
        paragraphs: [
          'Persons aged 16 or over may create an account; only adults may buy the pass. Local mode without an account has no age limit; it is particularly suitable for applications for apprenticeships and internships.',
        ],
      },
      {
        id: 'aenderung-agb',
        title: '§ 13 Changes to these Terms',
        paragraphs: [
          '(1) For a pass already bought, the version of these Terms that applied when you ordered remains valid. A new version only applies to later purchases.',
          '(2) For the free account and a redeemed access code (§ 15) we announce changes by e-mail at least six weeks before they take effect and name the changed rules. The new version only applies if you agree to it; if you do not, the previous version continues to apply to your account. You can also delete the account at any time.',
        ],
      },
      {
        id: 'schluss',
        title: '§ 14 Law, place of jurisdiction, dispute resolution',
        paragraphs: [
          '(1) German law applies, excluding the UN Convention on Contracts for the International Sale of Goods. If you are a consumer habitually resident in another country, you keep the protection of the mandatory provisions of that country (Art. 6(2) Rome I Regulation).',
          '(2) For consumers there is no agreed place of jurisdiction; the statutory rules apply. If you are a merchant, a legal entity under public law or a special fund under public law, the place of jurisdiction for all disputes arising from this contract is our registered place of business.',
          '(3) We are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board. If you have questions or complaints, please contact us directly (§ 1(2)); we will look for a solution with you.',
        ],
      },
      {
        id: 'zugangscodes',
        title: '§ 15 Access codes and free access',
        paragraphs: [
          '(1) An access code (voucher) gives you the features of the pass (§ 5) free of charge, either for a set number of days or as permanent free access. What a code grants, until when it can be redeemed and whether the number of redemptions is limited is shown before you redeem it. You can redeem a code with an account whose e-mail address is confirmed.',
          '(2) Each code can be redeemed once per account, and at most one code per account from the same campaign. A code cannot be paid out in cash or offset against a purchase. We may deactivate a code that has not yet been redeemed if it is evidently being distributed abusively.',
          '(3) Time-limited access starts on redemption, follows on from any term still running and then ends by itself. Nothing is charged.',
          '(4) Permanent free access applies for as long as we operate the service. If we intend to discontinue the service, we will announce this by e-mail at least three months in advance; until then you can export all your content.',
          '(5) The rules of these Terms on your content, share links, backups and liability (§§ 9 to 11) apply accordingly to free access. As you pay nothing for it, there is no right of withdrawal; you can end the access at any time by deleting your account.',
        ],
      },
    ],
  },
};
