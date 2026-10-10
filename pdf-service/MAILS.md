# E-Mails

Stand 10.10.2026 (E-Mail-Workflows). Ziel: Mail-Abläufe für Nutzerinnen und Nutzer, SMTP zentral im Admin-Bereich einstellbar (die Umgebung bleibt Rückfall).

| Teil | Datei |
|---|---|
| Versand, Vorlage, SMTP aus Umgebung oder Datenbank | `mail.js` |
| SMTP-Einstellungen (verschlüsselt), Abmelde-Token | `mailsettings.js` |
| Workflows, Texte in vier Sprachen, Rendern, Anpassungen | `mailflows.js` |
| Warteschlange, Abläufe, Einwilligung, Admin-Daten | `mailqueue.js` |
| Admin-Routen „E-Mails“ | `mailadmin.js`, Oberfläche `app/src/admin/pages/Mails.tsx` |
| Nutzerseite | `app/src/screens/MailPrefs.tsx` (Häkchen, Kontoeinstellungen), `app/src/billing/UnsubscribePage.tsx` (`/mail/abmelden`), Texte `app/src/ui/i18n/mails.ts` |
| Tests | `mail.test.mjs`, `app/scripts/admincheck.mjs` (Abschnitt 5) |

Neue Tabellen: `mail_prefs`, `mail_queue`, `mail_log`, `mail_workflow_settings`, `mail_settings`; Spalte `users.mail_lang`.

## 1. Bestand vor dieser Runde

Alle Mails gehen direkt über `sendMail` (ohne SMTP: nicht verschickt). „Transaktional“ heißt hier: Folge einer Handlung der Person oder Pflicht aus dem Vertrag, keine Werbung.

| Mail (`tag` im Protokoll) | Auslöser | Empfänger | Datei | Sprache | Transaktional |
|---|---|---|---|---|---|
| Einladung (`invite`) | Admin legt Einladung mit Adresse an, oder nimmt eine Zugangsanfrage an | eingeladene Person | `mail.js` tplInvite | de | ja (auf Anfrage) |
| Willkommen (`welcome_invite`) | Registrierung mit Einladungscode | Konto | `mail.js` tplWelcome | de | ja; **ersetzt** durch Workflow `welcome` |
| Passwort zurücksetzen (`password_reset`) | „Passwort vergessen“, Admin „Passwort-Mail“ | Konto | `mail.js` | de | ja |
| Passwort geändert (`password_changed`) | Passwort geändert oder per Link neu gesetzt | Konto | `mail.js` | de | ja (Sicherheit) |
| Passwort vom Admin gesetzt (`password_reset_admin`) | — (Vorlage ohne Aufrufer) | Konto | `mail.js` | de | ja |
| E-Mail geändert (`email_changed`) | neue Adresse bestätigt oder Adresse entfernt | alte Adresse | `mail.js` | de | ja (Sicherheit) |
| Login-Code (`login_code`) | Anmeldung mit Zwei-Faktor | Konto | `mail.js` | de | ja (Sicherheit) |
| Zugangsanfrage (`access_request`) | öffentliche Zugangsanfrage | `ACCESS_NOTIFY_EMAIL` (Betreiber) | `mail.js` | de | ja (intern) |
| Konto gelöscht/deaktiviert (`offboarding`) | Löschung durch Person oder Admin, Sperre durch Admin | Konto | `mail.js` | de | ja |
| Zugang endet (`access_ending`) | 14 und 3 Tage vor Ende einer Einladungs-Laufzeit | Konto | `mail.js` tplAccessEnding | de + en in einer Mail | ja |
| Adresse bestätigen (`confirm_email`) | offene Registrierung, „erneut senden“, Admin „Bestätigungsmail“ | neue Adresse | `mailtexts/index.js` (Text aus `app/src/legal/mails.ts`) | de, en (fr/es → en) | ja (Double-Opt-in) |
| Neue Adresse bestätigen (`confirm_email_change`) | Adresswechsel angefordert | neue Adresse | `mailtexts/index.js` | de + en | ja |
| Adresswechsel angefordert (`email_change_requested`) | Adresswechsel angefordert | alte Adresse | `mailtexts/index.js` | de | ja (Sicherheit) |
| Adresse gehört schon einem Konto (`email_change_taken`) | Wechsel auf vergebene Adresse | diese Adresse | `mailtexts/index.js` | de | ja |
| Schon ein Konto (`register_existing`) | Registrierung mit vergebener Adresse (höchstens 1×/Tag) | diese Adresse | `mailtexts/index.js` | de | ja |
| Bestellbestätigung mit Rechnung, AGB, Widerrufsbelehrung (`order_confirmation`) | Zahlung eingegangen (Mollie) | Bestelladresse | `mailtexts/index.js`, `billing.js` | de, en (nach Bestellsprache) | ja (§ 312f BGB). **„Pass gekauft“ gibt es damit schon**, keine zweite Mail gebaut |
| Pass endet (`pass_ending`) | 14 und 3 Tage vor Ende des Passes | Konto | `mailtexts/index.js` tplPassEnding | de + en | ja |
| Eingangsbestätigung Widerruf (`withdrawal_receipt`), nach Frist (`withdrawal_late`), Bestätigungslink (`declaration_confirm`), nicht zuzuordnen (`declaration_unmatched`, `declaration_received`) | Widerruf/Kündigung in Konto oder Formular | Bestell- bzw. angegebene Adresse | `mailtexts/index.js`, `billing.js` | de, teils en | ja (§ 356a, § 312k BGB) |
| Erstattung ausgeführt (`refund_done`) | Mollie meldet Erstattung | Bestelladresse | `mailtexts/index.js` | de, en | ja |
| Kündigungsbestätigung (`cancellation_receipt`) | Kündigung bestätigt | Bestelladresse | `mailtexts/index.js` | de, en | ja (§ 312k BGB) |
| Handarbeit nötig (`admin_declaration`) | Erklärung braucht Entscheidung | `BILLING_NOTIFY_EMAIL` (Betreiber) | `mailtexts/index.js` | de | ja (intern) |
| Admin-Code (`admin_login_code`), Testmail (`admin_test`) | Admin-Anmeldung, Knopf „Testmail“ | `ADMIN_EMAIL` | `admin.js`, `mailadmin.js` | de | ja (intern) |

Lokalmodus ohne Konto: keine Adresse, keine Mails.

## 2. Neue Workflows

| Workflow | Auslöser | Rechtsgrundlage | Standard |
|---|---|---|---|
| `welcome` Willkommen nach Bestätigung, drei erste Schritte | Klick auf den Bestätigungslink (offene Registrierung) bzw. Registrierung mit Einladung | Art. 6 Abs. 1 lit. b DSGVO | an |
| `pass_ending` Pass endet bald | 14 und 3 Tage vor Ende (Pass oder Zeitgutschein), Tage einstellbar | Art. 6 Abs. 1 lit. b DSGVO | an (bestehende Mail, jetzt über die Schlange) |
| `access_ending` Zugang endet bald | wie oben, Einladung mit Laufzeit | Art. 6 Abs. 1 lit. b DSGVO | an (bestehende Mail) |
| `pass_expired` Pass abgelaufen: was bleibt, Datenexport, kein Abo | Pass abgelaufen (nicht nach Widerruf), 0 Tage danach, einstellbar | Art. 6 Abs. 1 lit. b DSGVO | an |
| `voucher_redeemed` Gutschein eingelöst | Einlösung im Konto oder auf `/code` | Art. 6 Abs. 1 lit. b DSGVO | an |
| `tips_1` Tipp 1: Prüfen und ATS-Fassung | 1 Tag nach wirksamer Einwilligung | Einwilligung, Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 Nr. 2 UWG | an, geht nur mit Einwilligung |
| `tips_3` Tipp 2: Anschreiben je Stelle | 3 Tage danach | wie oben | an, nur mit Einwilligung |
| `tips_7` Tipp 3: KI-Brücke (Markdown, MCP) | 7 Tage danach, „das war der letzte Tipp“ | wie oben | an, nur mit Einwilligung |

Nicht gebaut:

- **„Konto inaktiv seit 12 Monaten, wird gelöscht“:** `janitor.js` löscht keine inaktiven Konten (nur unbestätigte ohne Kauf nach 48 Stunden), die Datenschutzerklärung sagt „Inaktive Konten löschen wir auf Anfrage“. Ohne Löschung wäre die Mail falsch.
- **„Pass gekauft“:** ist die Bestellbestätigung.
- **„Gutschein endet“:** läuft über `pass_ending` (Zeitgutscheine setzen `plan_kind = 'pass'`).
- **Sicherheitsmails** bleiben direkt (Passwort, Adresse, Login-Code), sie müssen sofort gehen.

Texte: sachlich, Deutsch, Englisch und Spanisch duzen, Französisch siezt (wie die Oberfläche); Rechtstexte bleiben in der Sie-Form. Servicemails ohne Kaufknopf und ohne Preis (sonst wären sie Werbung, BGH VI ZR 134/15), Ausnahme der bestehende „Pass verlängern“-Knopf vor Pass-Ende. Die bestehenden Hinweise vor Laufzeitende bleiben zweisprachig und sind im Admin-Bereich nicht textlich anpassbar, nur Schalter und Tage.

Sprache: `users.mail_lang` (Registrierung aus der Oberfläche, später Kontoeinstellungen), sonst Deutsch.

## 3. Warteschlange

- Eine Zeile je Mail in `mail_queue`, Schlüssel `workflow:konto:anlass` (UNIQUE, `ON CONFLICT DO NOTHING`): dieselbe Mail entsteht höchstens einmal, auch mit zwei Instanzen. Anlässe: `welcome:v1`, `tips_*:v1`, `pass_ending:<Enddatum>:<soon|final>`, `pass_expired:<Enddatum>`, `voucher_redeemed:<Einlösung>`.
- Abgearbeitet von `mailer.start()` (server.js, neben dem Aufräumjob): Schlange jede Minute, Anlässe (Pass abgelaufen, Tipps) alle 10 Minuten, Hinweise vor Laufzeitende alle 6 Stunden (`runAccessNotices` mit `deliver` = einreihen). Neue Mails werden sofort angestoßen. `MAIL_JOBS=0` schaltet ab (in `NODE_ENV=test` Standard aus).
- **Ohne SMTP:** Status `waiting_smtp`, nichts geht verloren. Wartende Mails gehen **nicht** von selbst raus, sobald SMTP da ist; der Admin sendet oder verwirft sie (einzeln oder alle). Nach 30 Tagen verwirft der Aufräumjob sie.
- Fehler: 5 Versuche mit 1 min, 5 min, 30 min, 2 h, 12 h Abstand, dann `failed` (Admin: erneut senden, verwerfen).
- Beim Senden wird geprüft: Konto da, nicht gesperrt, Adresse da, Workflow an, nicht veraltet (Welcome 3 Tage, Tipps 5, Pass abgelaufen 10), bei Tipps Einwilligung wirksam und Adresse bestätigt, bei Laufzeit-Hinweisen dasselbe Enddatum. Sonst `skipped` mit Grund.
- Die Adresse steht nicht in der Schlange; sie kommt beim Senden aus dem Konto.
- `mail_log`: jede Mail (auch die direkten), Workflow, gekürzte Adresse, Status, Fehler, kein Betreff, kein Inhalt. 90 Tage. Erledigte Zeilen der Schlange ebenfalls 90 Tage.

## 4. Einwilligung, Double-Opt-in, Abmeldung

- Häkchen bei der Registrierung (offen und mit Einladung, nur mit Adresse), **nicht vorangekreuzt**, freiwillig, in der Fassung `TIPS_CONSENT_VERSION` (`2026-10-10`, gleich in `mailflows.js` und `app/src/ui/i18n/mails.ts`; eine andere Fassung nimmt der Server nicht an). Text: „Ja, ich möchte in den ersten zwei Wochen bis zu drei Tipps zur Nutzung per E-Mail bekommen. Abbestellen geht jederzeit mit einem Klick.“ Darunter: „Freiwillig, das Konto funktioniert auch ohne. Die Einwilligung gilt erst, wenn du deine Adresse bestätigt hast. Mehr dazu in der Datenschutzerklärung.“
- Unbestätigte Adresse: Einwilligung `pending`. Die Bestätigungsmail sagt in der Sie-Form ausdrücklich, dass der Klick auch die Einwilligung bestätigt (`TIPS_CONFIRM_LINES` in `mailtexts/index.js`, offen: bei der nächsten Prüfung der Rechtstexte in `mails.ts` übernehmen). Erst der Klick macht sie wirksam (Zeitpunkt und Fassung in `mail_prefs`). Bestätigte Adresse (Kontoeinstellungen): sofort wirksam. Einladungskonten mit Häkchen bekommen dafür den Bestätigungslink.
- Kontoeinstellungen „E-Mails“: Tipps an/aus mit Datum und Fassung der Einwilligung, Sprache der Mails, Hinweis, dass Servicemails zum Vertrag gehören.
- Abmelden ohne Anmeldung: Link `/mail/abmelden?token=…` (App-Seite, ein Klick auf „Tipps abbestellen“; der bloße Abruf ändert nichts, Link-Scanner). One-Click nach RFC 8058: Kopfzeilen `List-Unsubscribe: <…/pdfapi/api/mail/unsubscribe?token=…>` und `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, POST ohne Cookie. Token: Konto-ID plus HMAC-SHA256 (HKDF aus `MAIL_SETTINGS_KEY`, sonst `JWT_SECRET`). Widerruf merkt sich Zeit und Weg (`settings`, `link`, `one-click`) und verwirft wartende Tipps.
- Nach einem Widerruf und neuer Einwilligung kommen dieselben Tipps nicht noch einmal (Schlüssel `v1`).

## 5. Recht

**§ 7 UWG (Primärtext, gesetze-im-internet.de, abgerufen 10.10.2026):** Abs. 2 Nr. 2: unzumutbare Belästigung „stets anzunehmen … bei Werbung unter Verwendung … elektronischer Post, ohne dass eine vorherige ausdrückliche Einwilligung des Adressaten vorliegt“. Abs. 3 erlaubt Werbung an Bestandskunden nur, wenn kumulativ „1. ein Unternehmer im Zusammenhang mit dem Verkauf einer Ware oder Dienstleistung von dem Kunden dessen elektronische Postadresse erhalten hat, 2. … zur Direktwerbung für eigene ähnliche Waren oder Dienstleistungen verwendet, 3. der Kunde der Verwendung nicht widersprochen hat und 4. der Kunde bei Erhebung der Adresse und bei jeder Verwendung klar und deutlich darauf hingewiesen wird, dass er der Verwendung jederzeit widersprechen kann …“.

**Entscheidung (vorsichtig):** Tipps nur mit ausdrücklicher Einwilligung. Die Bestandskundenausnahme nutzen wir **nicht**: Die Adresse kommt bei der kostenlosen Registrierung, nicht „im Zusammenhang mit dem Verkauf“; der Hinweis „bei Erhebung“ (Nr. 4) fehlt in Registrierung und Kasse bisher; und ein Pass ist anlassbezogen, eine „ähnliche Leistung“ zum nachträglichen Bewerben gibt es kaum. Jede Tipps-Mail nennt den Absender mit Anschrift (`SELLER_NAME`, `SELLER_ADDRESS`; § 7 Abs. 2 Nr. 3 UWG, § 6 Abs. 1 DDG) und hat einen kostenlosen Abmeldeweg.

**Datenschutzerklärung:** eingebaut in `app/src/screens/LegalPages.tsx` (deutsch und englisch):

- Im Abschnitt „Empfänger und Auftragsverarbeiter“ war der Satz „… und keine Werbung“ zu ersetzen: „Wir schicken nur an die Adresse, die Sie hinterlegt haben. Werbung (Tipps zur Nutzung) schicken wir nur mit Ihrer Einwilligung, siehe „E-Mails an Ihr Konto“.“
- Neuer Abschnitt „E-Mails an Ihr Konto“: **Servicemails** (Liste, Art. 6 Abs. 1 lit. b DSGVO, für Bestell- und Eingangsbestätigungen lit. c mit § 312f, § 356a, § 312k BGB, für Sicherheitshinweise lit. f; nicht abbestellbar, solange das Konto besteht). **Tipps per E-Mail (freiwillig)** (bis zu drei Mails in den ersten zwei Wochen, wirksam nach Bestätigung der Adresse, Nachweis von Zeitpunkt und Fassung nach Art. 7 Abs. 1 DSGVO, Art. 6 Abs. 1 lit. a DSGVO, Widerruf über Abmeldelink, Mailprogramm oder Kontoeinstellungen; Sprache der Mails). **Versandprotokoll** (Zeitpunkt, Art, Ergebnis, gekürzte Adresse; Art. 6 Abs. 1 lit. f DSGVO; kein Inhalt; 90 Tage).
- „Wie lange Daten bleiben“: Einwilligung und Widerruf solange das Konto besteht; Versandprotokoll 90 Tage; wartende Mails höchstens 30 Tage.

Für Betreiber: Die Erklärung nennt den Versanddienst als Platzhalter (`[Mail-Provider]`, `[Land]`). Tragen Sie dort den Anbieter ein, den Sie tatsächlich nutzen; wechselt der SMTP-Anbieter im Admin-Bereich, muss der Satz mitgehen (und ein AV-Vertrag bestehen).

## 6. SMTP im Admin-Bereich

- Host, Port, Sicherheit (`tls` 465, `starttls` 587 Pflicht, `none` nur für interne Relays), Benutzer, Passwort, Absender, Antwortadresse. Eingaben geprüft (keine Zeilenumbrüche, gültige Adressen).
- **Vorrang:** gespeicherte **und** aktivierte Einstellungen gehen der Umgebung vor; sonst gilt die Umgebung (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, neu `SMTP_REPLY_TO`). Begründung: Der Versand soll zentral im Admin-Bereich gepflegt werden; die Umgebung bleibt Rückfall. Sicherungen gegen Aussperren (die Admin-Anmeldung braucht einen Mail-Code): aktiv wird nur, was die Verbindungsprüfung (`verify`) besteht; scheitert der Admin-Code über die gespeicherten Einstellungen, geht er noch einmal über die Umgebung; Notschalter `SMTP_FORCE_ENV=1`.
- Passwort: AES-256-GCM, eigener IV je Speichern, Schlüssel `MAIL_SETTINGS_KEY` (64 Hex-Zeichen; `openssl rand -hex 32`), sonst per HKDF aus `JWT_SECRET` abgeleitet (Warnung beim Start und im Bereich). Wird der Schlüssel geändert, lässt sich das Passwort nicht mehr lesen; der Bereich sagt das, dann neu eingeben. Das Feld setzt oder ersetzt nur, keine Antwort enthält Passwort oder Geheimtext, das Protokoll vermerkt nur „Passwort geändert ja/nein“.
- Mehrere Instanzen lesen die Einstellungen jede Minute neu.

## 7. Prüfungen

- `node --test mail.test.mjs` (Ports `MAIL_PG_PORT` 5771, `MAIL_API_PORT` 3471, `MAIL_SMTP_PORT` 2571; SMTP-Ersatz im Testprozess): Verschlüsselung, Token, Eingabeprüfung, List-Unsubscribe, Escaping der Anpassungen, Idempotenz, „wartet auf SMTP“, keine Tipps ohne Einwilligung, Ablauf-Mails genau einmal, SMTP-Passwort verschlüsselt und nie in Antworten oder im Protokoll, Senden der wartenden Mails nach dem Einrichten, One-Click-Abmeldung, Double-Opt-in mit Willkommen, Admin-Routen nur für Admins.
- `app/scripts/admincheck.mjs`: Bereich „E-Mails“ mit axe (hell, dunkel, mobil 390, offene Vorschau), Passwort nach dem Speichern nirgends auf der Seite.
