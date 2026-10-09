# Gutscheine und Gratiszugänge (Backend)

Stand 09.10.2026. Grundlage sind die Vorgaben des Betreibers für Gutscheine und Gratiszugänge und der Schnittstellenvertrag zwischen Backend und Frontend. Diese Datei beschreibt den Server-Teil: Datenmodell, Laufzeitregeln, Endpunkte, Prüfstellen, Migration und die Grenzen der Kennzahlen. Die Oberfläche (Seite `/code`, „Mein Pass“, Admin-Reiter „Gutscheine“) baut das Frontend.

Code: `grants.js` (Berechtigungen, Neuberechnung, Migration), `vouchers.js` (Gutscheine, Endpunkte, Kennzahlen), Schema in `db.js`, Tests in `vouchers.test.mjs`.

## Grundsätze

- Ein Gutschein schaltet den bestehenden Bewerbungs-Pass frei: entweder für N Tage (`days`) oder dauerhaft (`lifetime`, öffentlich „Dauerhafter Gratiszugang“). Es gibt keine eigenen Funktionen, Kontingente oder Tarife.
- Kein Abo. Nach Ablauf endet der Gratiszugang von selbst, und es wird nichts abgebucht. Weiter geht es nur, wenn jemand bewusst den 90-Tage-Pass kauft.
- Ein Gutschein erzeugt keine Bestellung, keine Mollie-Zahlung und keine Rechnungsnummer. Die Auswertung „Bezahlung“ (`/api/admin/billing`) zeigt weiter nur Umsatz.
- Alle Zeiten rechnet der Server. Aus der Anfrage übernimmt er nur den Code, sonst nichts: keine Laufzeit, keine Nutzer-ID, keinen Preis.

## Datenmodell

### `access_grants`: eine Zeile je Berechtigung

| Spalte | Bedeutung |
|---|---|
| `source` | `order` (bezahlte Bestellung), `voucher` (Gutschein), `pilot` (Einladung mit Laufzeit), `admin` (von Hand freigeschaltet), `legacy` (übernommener Altwert) |
| `source_id` | Bestell-ID, ID der Gutschein-Einlösung oder Einladungscode |
| `kind` | `days`, `lifetime` oder `set` (`set` nur bei admin/legacy: setzt das Ende auf `until_at`; `NULL` heißt unbegrenzt) |
| `days`, `until_at` | Dauer bzw. gesetztes Ende |
| `ends_at` | Kündigung: Der Abschnitt endet spätestens hier |
| `granted_at` | Beginn der Berechtigung (Zeitpunkt der Zahlung bzw. Einlösung) |
| `revoked_at`, `revoke_reason` | Widerruf bzw. Erstattung |
| `effective_from`, `effective_until` | zuletzt berechneter Abschnitt, für Anzeige und Auswertung. Bei widerrufenen Zeilen steht hier der Stand zum Zeitpunkt des Widerrufs |

`users.access_until` und `users.plan_kind` sind nur noch ein **Spiegel**. Sie werden in derselben Transaktion aus allen Zeilen neu berechnet (`recomputeAccess`) und dabei für das Konto gesperrt (`SELECT … FOR UPDATE`). Deshalb gelten alle bisherigen Prüfstellen unverändert weiter.

`plan_kind`: `none` (selbst registriert, nie Pass), `pass` (mindestens eine Bestellung oder ein Zeitgutschein), `lifetime` (dauerhafter Gratiszugang), `NULL` (Pilot oder Bestand).

### Gutscheine

- `voucher_campaigns`: Name und eindeutiger Schlüssel (Kleinschreibung, NFKC). Mehrere Codes können zu einer Kampagne gehören, z. B. ein LinkedIn-Code und ein Newsletter-Code.
- `vouchers`: interner Name, Kampagne, Verteilart (`personal|public`), `code_hash` (SHA-256 der Normalform, eindeutig), `code_plain` (nur bei `public`, weil ein öffentlicher Code nicht geheim ist), `code_hint` (bei `personal` nur die letzten vier Zeichen), Typ, Dauer, `max_redemptions` (`NULL` = ohne Gesamtlimit), `redemptions` (Zähler), `redeem_until` (bei `public` Pflicht), aktiv bzw. deaktiviert (wann, von wem, mit welchem Hinweis), Ersteller, Erstellzeit, `batch_id` (persönliche Codes, die zusammen erzeugt wurden).
- `voucher_redemptions`: Gutschein, Kampagne, Konto, Zeitpunkt, gewährter Typ und gewährte Dauer, gewährter Zeitraum zum Zeitpunkt der Einlösung (`granted_from`/`granted_until`), Herkunft (`account` = „Mein Pass“, `code_page` = Seite `/code`) und Verweis auf den Grant.
- Die Datenbank-Constraints verhindern doppelte Einlösungen:
  - eindeutig `(voucher_id, user_id)`
  - eindeutig `(campaign_id, user_id)`, wenn eine Kampagne gesetzt ist
  - `redemptions <= max_redemptions`
  - Trigger `vouchers_guard`: Typ, Dauer, Kampagne, Verteilart und Code lassen sich nach der ersten Einlösung nicht mehr ändern.
- `admin_audit`: Gutschein angelegt (bei persönlichen Codes nur mit Hinweis `…ABCD`, nie der ganze Code), Gutschein deaktiviert, Laufzeit eines Kontos geändert.
- Wird ein Konto gelöscht, bleiben seine Einlösungen ohne Personenbezug stehen (`user_id` wird `NULL`). Zähler und Kennzahlen stimmen dann weiter. Die Grants des Kontos werden mitgelöscht.

## Laufzeitregeln

Die Laufzeit berechnet eine einzige Funktion, `computeAccess` in `grants.js`:

1. Es gibt einen aktiven `lifetime`-Grant: Der Zugang ist dauerhaft (`access_until` NULL, `plan_kind` `lifetime`). Das gilt unabhängig von allen anderen Grants.
2. Sonst werden die Grants nach `granted_at` sortiert:
   - Beginn = max(bisheriges Ende, `granted_at`)
   - Ende = Beginn + `days`
   - bei Kündigung höchstens `ends_at`
3. Selbst registrierte Konten starten bei `created_at`, sind also von Anfang an ohne Pass. Eingeladene Konten und Bestandskonten ohne einen einzigen Grant sind unbegrenzt.
4. Widerruf: Der Grant der Bestellung fällt weg. Die Untergrenze ist dabei min(Zeitpunkt des Widerrufs, bisheriges Ende dieses Abschnitts). Rückwirkend wird also nichts gesperrt.
5. Admin-Konten werden nie begrenzt.

### Beispiele mit Datum (aus `vouchers.test.mjs`, alle geprüft)

| Fall | Ergebnis |
|---|---|
| Pass bezahlt am 01.11., 90 Tage | Ende 30.01. |
| … dazu am 10.11. ein Gutschein über 30 Tage | Der Gutschein schließt an: Ende **01.03.**, die bezahlte Restlaufzeit bleibt |
| … am 12.11. wird die Bestellung widerrufen | Der Zahlungsanspruch fällt weg, der Gutschein läuft ab seiner Einlösung: Gratiszeit **10.11.–10.12.**, Ende 10.12. |
| Erst Gutschein am 01.11. (30 Tage, bis 01.12.), dann Kauf am 10.11. | Der Kauf schließt an die Gratiszeit an: Ende 01.03. |
| … am 12.11. wird die Bestellung widerrufen | Ende 01.12. (nur noch die Gratiszeit) |
| Pass 01.11., Gutschein 10.11., Kündigung zum 12.11. | Der Pass endet am 12.11., der Gutschein hängt an: Ende **12.12.** |
| Pass 01.11., am 05.11. widerrufen, kein Gutschein | Ende 05.11. (Zeitpunkt des Widerrufs) |
| Pass, dann dauerhafter Gutschein, dann Widerruf des Passes | bleibt **dauerhaft** |
| Pilot 30 Tage ab 20.10., Kauf am 25.10. | Ende 17.02. (30 + 90 Tage) |

### Weitere Regeln

- **Ohne aktiven Zugang** beginnt ein Zeitgutschein bei der Einlösung. **Bei laufender Laufzeit** verlängert er ab dem bisherigen Ende. Bezahlte Restlaufzeit wird nie verkürzt.
- Verschiedene Zeitgutscheine laufen nacheinander. Derselbe Gutschein gilt höchstens einmal je Konto, und je Kampagne gibt es höchstens eine Einlösung.
- Ist der Zugang schon dauerhaft oder unbegrenzt, wird kein weiterer Gutschein verbraucht (409 `already_lifetime`), und der Checkout antwortet mit 409 `plan_lifetime` bzw. `plan_unlimited`.
- Ein späterer Kauf berücksichtigt die Gratis-Restlaufzeit, weil er hinten anschließt.
- Die **Einlösefrist** begrenzt nur das Einlösen. Wer schon eingelöst hat, behält seinen Zugang über die Frist hinaus, auch einen dauerhaften.
- **Deaktivieren** nimmt keinen schon gewährten Zugang zurück.
- Gesperrte Konten (`disabled`) kommen nicht durch die Anmeldung, also auch nicht durch das Einlösen.
- **Die Laufzeit wird nie still überschrieben.** Steht in `users.access_until` ein Wert, der nicht aus den Grants folgt (Altbestand, Eingriff direkt in der Datenbank), übernimmt `ensureBaseline` ihn vor der nächsten Änderung als `legacy`/`set`-Zeile und meldet das im Log: `access-grants: Konto #… weicht … ab`.
- Admin-Laufzeit (`POST /api/admin/users/:id/access`): `{days}` wird als Admin-Grant `days` gespeichert, `{until}` als Admin-Grant `set`. Gutscheine und Bestellungen bleiben dabei erhalten.
- Kommt es nach einer `set`-Zeile zu Widerruf oder Kündigung einer früheren Bestellung, wird der weggefallene Rest dort abgezogen (nie unter jetzt). Das entspricht dem bisherigen Verhalten von `shortenPass`.

## Erstattungsregeln

- Ein **Widerruf** (`/api/billing/withdraw`, auch öffentlich) entfernt nur den Grant dieser Bestellung. Gutscheine, Pilot-Laufzeit und andere Bestellungen bleiben. Die Erstattung über Mollie läuft wie bisher.
- Eine **Kündigung** setzt `ends_at` am Grant der Bestellung. Was danach kommt, zum Beispiel ein Gutschein, rückt nach vorn.
- Bei einem **dauerhaften Gratiszugang** ändert ein Widerruf nichts am Status `lifetime`.
- Gutscheine selbst werden nicht erstattet und nicht widerrufen. Es gibt keinen Weg, eine Einlösung zurückzunehmen; Deaktivieren gilt nur für neue Einlösungen.

## Endpunkte

| Methode und Pfad | Wer | Was |
|---|---|---|
| `POST /api/vouchers/preview` `{code}` | alle, je IP 30/10 min, je /24 120/10 min | `{ok, kind, days, redeemUntil, limited, limitTotal, registrationOpen, alreadyLifetime?}` oder `{ok:false, reason}`. Reserviert nichts und nennt keine Restplätze. `already_redeemed`/`campaign_redeemed` gibt es nur angemeldet |
| `POST /api/vouchers/redeem` `{code, origin?}` | angemeldet per **Sitzung**, E-Mail bestätigt; je IP 20/h, je /24 60/h, je Konto 20/h | `{ok, grant:{kind,days,from,until}, plan}` (plan mit Herkunft). Fehler mit `code`: `invalid` 404, `expired`/`exhausted`/`inactive` 410, `already_redeemed`/`campaign_redeemed`/`already_lifetime` 409, `email_unconfirmed` 403, `auth_required` 401, `session_required` 403 (API-Schlüssel oder MCP-Token) |
| `GET /api/admin/vouchers` | Admin | Übersicht mit Zusammenfassung, Status, Aktionshinweis und Einlöseadresse |
| `POST /api/admin/vouchers` | Admin | Gutschein anlegen (Felder unten). Persönliche Codes stehen **nur in dieser Antwort** |
| `POST /api/admin/vouchers/:id/deactivate` `{note?}` | Admin | deaktivieren, protokolliert |
| `GET /api/admin/vouchers/:id/redemptions` | Admin | Zeitpunkt, `#Konto-ID`, Typ, Zeitraum, Herkunft. Keine E-Mail-Adressen, keine Namen |
| `GET /api/admin/voucher-stats` | Admin | Kennzahlen (siehe unten) |

Für die Admin-Oberfläche gibt es zusätzlich Kurzfelder: in der Übersicht `campaigns` und `hint` (die letzten vier Zeichen), im Verlauf `at` und `until`, in den Kennzahlen `rows` mit `usedFeature`, `purchasesAfter` und `refundsOfThose`. Die Vorschau gibt `registrationOpen` auch bei `ok:false` mit.

Felder beim Anlegen: `name`, `distribution`, `kind`, `days`, `campaign` (Text, neu oder vorhanden), `maxRedemptions`, `confirmUnlimited`, `redeemUntil` (`JJJJ-MM-TT`, gilt bis 23:59:59 in Berlin), `code` (nur public), `count` (nur personal, 1 bis 100). Standards:

- persönlich: zufälliger Code, Limit 1
- öffentlich: Limit 100, Frist Pflicht
- `maxRedemptions: null`, also ohne Gesamtlimit, nur zusammen mit `confirmUnlimited: true`; das gilt auch für dauerhafte Zugänge

Die Admin-Rechte prüft der Server (`requireAdmin`). Ein Bearbeiten-Endpunkt existiert nicht, nur Deaktivieren.

`plan` in `/api/me`, `/api/auth/me`, `/api/billing/orders` und in der Antwort auf das Einlösen enthält zusätzlich:

- `grants`: nur aktive Grants aus Bestellung, Gutschein oder Pilot, mit `label` „Bewerbungs-Pass“, „Gutschein“ oder „Pilot-Zugang“
- `freeUntil`: Ende des spätesten noch laufenden oder kommenden Abschnitts aus einem Zeitgutschein
- `hasPaid`: es gibt eine aktive bezahlte Bestellung

Login, Registrierung und die 403-Antworten liefern `plan` wie bisher, ohne diese Felder.

### Codes

- Normalform: Unicode NFKC, Leerraum und Bindestrich-artige Zeichen entfernen, Großbuchstaben. Gültig sind danach nur `A–Z0–9` mit 4 bis 32 Zeichen. Dadurch sind „linkedin-30“, „LinkedIn 30“ und „ＬＩＮＫＥＤＩＮ３０“ derselbe Code; einen zweiten Code mit gleicher Normalform verhindert die Datenbank (409 `code_taken`).
- Persönliche Codes haben 16 Zeichen Crockford-Base32 ohne I, L, O und U. Sie werden mit `crypto.randomInt` erzeugt (80 Bit) und als `XXXX-XXXX-XXXX-XXXX` angezeigt.
- Gespeichert wird nur der SHA-256-Hash. Vollständige persönliche Codes stehen in keinem Log, keinem Protokoll, keiner URL und keinem Ereignis. Die öffentliche Einlöseadresse ist `<PUBLIC_BASE_URL>/code`, ohne Code-Parameter.
- Es sind keine Codes fest im Code verankert, auch kein „FREE“ oder „LIFETIME“.

## Prüfstellen: wo Rechte entschieden werden

Es gibt keine einzelne zentrale Prüfstelle. Es gibt aber eine zentrale **Datenquelle**: die Zeile in `users`, die die Neuberechnung schreibt. Die Prüfung selbst steckt in einer zentralen Middleware, die an jeder Schreibroute einzeln hängt:

| Prüfstelle | Datei | Was |
|---|---|---|
| `loadUser` | `server.js` | Sitzung, API-Schlüssel (`cvk_`), OAuth-Token (`cvm_`). Gesperrte Konten fallen hier heraus. Merkt sich den Weg in `authVia`, nicht aufzählbar |
| `requireWritable` / `denyIfReadOnly` | `access.js` | 403 `pass_required` bzw. `access_expired` auf `POST /api/resumes`, `PUT` und `PATCH /api/resumes/:id`, `POST /api/photos`, `POST /api/resumes/:id/share`, `POST /api/shares/:token/refresh`, `PATCH /api/shares/:token` (Anschreiben wieder einschalten), Markdown-Import (Lebenslauf und Anschreiben), Version wiederherstellen |
| `isAccessExpired`, `accessInfo`, `planInfo` | `access.js` | `lifetime` läuft nie ab und ist nie schreibgeschützt |
| `POST /api/keys` | `server.js` | ohne Pass (`none`) kein neuer Schlüssel |
| `canConnect` (OAuth-Zustimmung) | `server.js` → `oauth.js` | ohne Pass keine neue KI-Verbindung |
| Checkout | `billing.js` | 409 bei `unlimited` und `lifetime` |
| MCP-Server | `mcp/cv-mcp.mjs` | **keine eigene Prüfung nötig**: Er ruft die REST-API mit dem Schlüssel bzw. Token des Nutzers auf, und jede Schreiboperation landet bei `requireWritable` (getestet: 403 nach Ablauf, Lesen, Markdown und Löschen gehen) |
| Einlösen | `vouchers.js` | Sitzung (kein `Bearer`), bestätigte Adresse (`emailConfirmed` aus `server.js`), Rate-Limits, Transaktion |
| Hinweis-Mails 14 und 3 Tage vorher | `access.js` | nur Konten mit `access_until`; dauerhafte bekommen keine |
| Admin | `requireAdmin` | alle `/api/admin/…` |

Bewusst **nicht** gesperrt sind Lesen, PDF, Markdown-Abruf, Datenauszug, Löschen, Konto, Passwort, 2FA, Schlüssel widerrufen und das Einlösen selbst. Das Einlösen muss auch ohne Pass gehen.

Gegen Fremdanfragen (CSRF) schützt dasselbe wie bei den anderen schreibenden Routen: Sitzungs-Cookie mit `SameSite=Lax`, CORS-Allowlist und JSON-Körper.

## Migration (Altbestand)

`migrateGrants` läuft beim Start genau einmal (Marker `access_grants_v1` in `schema_migrations`, Advisory Lock gegen zwei gleichzeitig startende Instanzen). Es ändert **nichts an `users`**.

1. **Pilot-Konten:** `pilot`-Grant aus `invite_redemptions` und `invite_codes.access_days`, Beginn `created_at`.
2. **Bezahlte Bestellungen:** `order`-Grant mit `days = pass_days`.
   - Beginn: `pass_from`, wenn die Bestellung höchstens einen Tag nach der Zahlung begann; sonst `paid_at`, weil sie dann an eine längere Laufzeit anschloss.
   - Eine Kündigung wird als `ends_at` übernommen.
   - Widerrufene oder erstattete Bestellungen werden zu widerrufenen Grants mit dem damaligen Abschnitt.
3. Danach wird nachgerechnet und mit `access_until` verglichen (Toleranz 1 s).
   - **Stimmt es**, bleiben die Grants stehen.
   - **Stimmt es nicht**, zum Beispiel weil ein Admin eine Pilot-Laufzeit verlängert hat, bleibt der gespeicherte Wert. Er kommt als `legacy`-Zeile dazu, und das Startlog nennt das Konto:

     `access-grants: Migration: Konto #… weicht ab (gespeichert …, berechnet …) — gespeicherter Wert bleibt, als Ausgangswert übernommen.`

Am Ende steht eine Summenzeile: `access-grants: Migration: N Konten geprüft, … mit nachgetragenen Berechtigungen, … stimmen, … Abweichung(en).` Bestandskonten ohne Laufzeit bekommen keine Zeile und bleiben unbegrenzt.

Geprüft wurde das im Test „Migration auf Altbestand“ mit sechs Konten:

- Pilot
- Pilot vom Admin verlängert
- Selbstregistrierung mit bezahltem Pass
- Selbstregistrierung mit widerrufenem Pass
- Bestandskonto unbegrenzt
- Selbstregistrierung ohne Pass

Kein `access_until` und kein `plan_kind` hat sich geändert. Genau das verlängerte Pilot-Konto wurde als Abweichung gemeldet, und eine Neuberechnung danach ergibt für alle sechs den gespeicherten Wert.

Hinweis: Postgres rechnet `now() + interval 'N days'` in der Zeitzone der Sitzung. Steht die Datenbank nicht auf UTC, kann ein Pilot-Konto über eine Zeitumstellung um eine Stunde abweichen. Es wird dann als Abweichung gemeldet und **nicht** geändert.

## Kennzahlen und ihre Grenzen

`/api/admin/voucher-stats` liefert Kennzahlen je Gutschein, je Kampagne (getrennt nach Zugangsart) und je Zugangsart. Alles wird aus vorhandenen Tabellen gezählt; dafür wird kein neues Tracking erfasst.

| Kennzahl | Wie gezählt |
|---|---|
| Einlösungen | Zeilen in `voucher_redemptions` |
| Pass-Funktion genutzt | Konten, die nach der Einlösung mindestens einmal gespeichert, importiert, wiederhergestellt oder einen Sharelink angelegt haben (Ereignisse), oder die einen API-Schlüssel bzw. eine KI-Verbindung angelegt haben. Nur Lesen oder Exportieren zählt nicht |
| Käufe nach einem Zeitgutschein | Bestellungen mit bestätigter Zahlung (`paid_at`) nach der Einlösung und vor der nächsten Zeitgutschein-Einlösung desselben Kontos |
| Erstattete Käufe | davon `withdrawn` oder `refunded` |
| `conversionPercent` | Konten mit Kauf geteilt durch Einlösungen |

Dauerhafte Gratiszugänge zählen bei Käufen und Quote nicht mit (`null`).

Grenzen:

- Gezählt wird je Konto, nicht je Mensch. Wer mehrere Konten hat, löst mehrfach ein.
- Gelöschte Konten zählen bei den Einlösungen mit, bei Nutzung und Käufen nicht mehr.
- Ereignisse aus dem Browser (DOCX, Druck-PDF) zählen nicht als Pass-Funktion, sie gehen auch ohne Pass.
- Ein Kauf nach einem Gutschein ist zeitliche Abfolge, kein Beleg für Ursache und Wirkung.

## Bedienung (für den Betreiber)

1. **Persönlicher dauerhafter Code für eine Person:** Admin → Gutscheine → Verteilart „persönlich“, Zugangstyp „dauerhaft“, Anzahl 1, speichern. Den angezeigten Code `XXXX-XXXX-XXXX-XXXX` sofort kopieren; er wird später nicht mehr angezeigt. API: `POST /api/admin/vouchers {name, distribution:'personal', kind:'lifetime'}`.
2. **Öffentlicher 30-Tage-Code für 100 Personen:** Verteilart „öffentlich“, Code frei wählen (z. B. `HERBST30`), 30 Tage, Limit 100, Einlösefrist setzen. Danach den Aktionshinweis und die Einlöseadresse `…/code` kopieren und selbst posten; der Dienst veröffentlicht nichts.
3. **Öffentlicher dauerhafter Code, begrenzt:** wie Schritt 2 mit Zugangstyp „dauerhaft“ und einem Limit, z. B. 50. Ohne Limit nur mit ausdrücklicher Bestätigung.
4. **Aktion beenden:** „Deaktivieren“. Wer schon eingelöst hat, behält seinen Zugang.

Die Produktionsfreigabe ist ein eigener Schritt. Die Einlösung braucht ein bestätigtes Konto, also für neue Interessenten eine offene Registrierung (`OPEN_REGISTRATION=1` mit `ALTCHA_HMAC_KEY`). Solange die zu ist, sagt die Vorschau `registrationOpen:false`, und nur bestehende bzw. eingeladene Konten können einlösen.

## Konfiguration

Neue Umgebungsvariablen gibt es nicht. Die Einlöseadresse wird aus `PUBLIC_BASE_URL` gebildet, `registrationOpen` folgt `OPEN_REGISTRATION` zusammen mit `ALTCHA_HMAC_KEY`.
