# Sicherheit Runde 6 (09.10.2026) — Backend und MCP

Grundlage: Code-Prüfung und Live-Prüfung einer laufenden Instanz vom 09.10.2026.
Bereich dieses Dokuments: `pdf-service/` (cv-api), `mcp/`, `.env.example`.
Die Teile in `app/` (Seiten für die Bestätigungslinks, ReDoS im Browser-Parser,
nginx, Dockerfile der App) prüfen `app/scripts/emailchangecheck.mjs`,
`app/scripts/redoscheck.mjs` und `app/scripts/nginxcheck.mjs`.

Tests: `pdf-service/security.test.mjs` (Ports 5561/3261/3262, überschreibbar mit
`SECURITY_PG_PORT`, `SECURITY_API_PORT`), dazu angepasste Fälle in
`billing.test.mjs` und `integration.test.mjs`, neu in `mcp/cv-mcp.test.mjs`.
Jede Probe der Prüfer (`probe1–4`, `redos`, `refuzz`) ist dort als Test
nachgebaut und scheitert jetzt.

## Befund → Fix → Test

| Befund | Fix | Test |
|---|---|---|
| **H1** ReDoS Sprachenzeile `markdown.js` | `splitLanguageLine()` zerlegt ohne Backtracking (erstes Strich-Zeichen trennt), gleiches Ergebnis wie der alte Ausdruck. Markdown höchstens 200.000 Zeichen (`MAX_MARKDOWN_CHARS`; Route antwortet 413 `markdown_too_large`, Parser wirft), Zeilen über 2.000 Zeichen (`MAX_LINE_CHARS`) werden außer im Profiltext leer gelesen. | `security.test.mjs`: Gleichwertigkeit gegen den alten Ausdruck (60.000 Zufallszeilen), probe4 (/health bleibt unter 1 s, Import unter 2 s), 413 über 200 KB, refuzz über alle Ausdrücke |
| **H1 (Nachprüfung)** — weitere quadratische Ausdrücke im selben Parser, von den Prüfern nicht erfasst | `/^-\s*([^:]+):\s*(.+)$/` (Kontakt, Empfänger, Kopf des Anschreibens) lief quadratisch: 40 KB Tabs = 1,9 s, 200 KB ≈ 45 s. Ersetzt durch `splitKeyLine()`. Punktwertung `\s*\((\d)…` ohne führendes `\s*`, `/\s+$/` → `trimEnd()`. `splitPeriod` (lazy, quadratisch) bekommt höchstens 240 Zeichen. | Gleichwertigkeit `splitKeyLine` (60.000 Zufallszeilen), 200 KB bösartiges Markdown in jedem Abschnitt unter 300 ms (gemessen: höchstens 12 ms) |
| **H2** öffentliche Kündigung nur mit Mailadresse | Eingang wird gespeichert (`declarations.status = 'pending_confirmation'`), Eingangsbestätigung mit Inhalt, Datum, Uhrzeit und Link geht an die **Bestelladresse**. Ausgeführt wird erst mit `POST /api/billing/declarations/confirm { token }`. Token 256 Bit, nur SHA-256 gespeichert, 14 Tage, einmalig. Wirkzeitpunkt und Frist ab Eingang. | probe1 #2: nichts gekündigt, Plan unverändert, Hash statt Token in der DB; Bestätigen → gekündigt; zweites Mal 409 `token_used`; ungültig 400 |
| **M1** öffentlicher Widerruf nur mit Mailadresse | wie H2. Widerruf nach Fristende: kein Link (nichts auszuführen), Eingang an die Bestelladresse, Betreiber entscheidet. | probe1 #3 (keine Erstattung bei Mollie, Pass läuft), Bestätigen → widerrufen + Erstattung; „Eingang zählt“: Eingang am 13. Tag, Klick nach Fristende → wirksam; Eingang nach Fristende → kein Link, Handarbeit |
| H2/M1: 14 Tage unbestätigt | Hintergrundlauf (`runJobs`, alle 10 min; bei `BILLING_ENABLED=0` nur dieser Teil) setzt `status = 'manual'` und schickt dem Betreiber den Wortlaut. Nichts wird automatisch ausgeführt. Der Link antwortet danach 410 `token_expired`. | „Bestätigungslink: abgelaufen …“: Admin-Mail mit Wortlaut, keine Mail an den Kunden, nur einmal gemeldet, Klick → 410, nichts gekündigt |
| **M4** Mail-Relay mit Angreifertext | Nicht zuzuordnende Erklärungen: an die eingegebene Adresse nur `tplDeclarationReceivedPlain` — fester Text, nur Eingangszeit, keine Eingabe des Absenders. Wortlaut nur an den Betreiber. Name im öffentlichen Formular: keine URL, kein `www.`, kein `<>`, keine Steuerzeichen (400 `fields_required`). | probe1 #4: Mail an Drittadresse ohne Phishing-Link, ohne Name/Grund/Wortlaut; Betreiber sieht den Wortlaut; Widerruf mit fremder Nummer → nur fester Text, nichts über die Bestellung |
| **M2** E-Mail-Wechsel behält „bestätigt“ | `POST /api/auth/email` merkt die neue Adresse vor (`users.pending_email`), Link (Token-Art `change`, 48 h) an die neue, Hinweis an die alte. Erst `POST /api/auth/confirm-email` setzt `email` und `email_confirmed_at`. `/api/me` liefert `pendingEmail`. Entfernen der Adresse wirkt sofort (2FA aus). | probe1 #6/#7: Adresse bleibt bis zum Klick, Neuregistrierung derselben Adresse 409, nach Bestätigung neue Adresse bestätigt, Token einmalig; `integration.test.mjs` N6 |
| **M3** Rate-Limits je einzelner IPv6 | Alle Eimer: IPv4 je Adresse, IPv6 je /64 (`clientKey`). Login zusätzlich 20/15 min je Netz (/24, /64) und 10 Fehlversuche/h je Konto (Name und Adresse teilen den Zähler; Reset per Mail hebt die Sperre auf). Passwort vergessen: höchstens 3 Mails/h je Adresse. | probe3: eine Adresse 5×401 dann 429; 40 Adressen eines /64 → alle 429; 25 IPv4 eines /24 → 5×429; 10 Fehlversuche aus 10 Netzen → richtiges Passwort 429 `account_locked`, anderes Konto unberührt; 20 Netze → höchstens 3 Reset-Mails |
| **M5** PDF-Warteschlange global | Rechnung, AGB, Belehrung: eigene Warteschlange (`ownPdfLimiter`, 1 parallel, 50 wartend). `/api/pdf` ohne Konto: höchstens 1 Auftrag gleichzeitig und 60/h je Netz → 429 `pdf_busy_anon`. | M5-Test: gleiches /64 → 429 mit Retry-After, anderes Netz läuft, danach wieder frei |
| **M6** Referrer-Policy/CORS → 500 | `Referrer-Policy: same-origin`. Fremder Ursprung und `Origin: null` → 403 `origin_not_allowed` vor jedem Handler (`originGuard`). Ausgenommen nur die Cookie-freien OAuth-Wege (`/api/oauth/token`, `/register`, `/revoke`, `/.well-known/oauth-*`), die `Access-Control-Allow-Origin: *` setzen. | probe1 #1 (403, 2FA unverändert, kein Logout über fremden Ursprung), probe2 im echten Chromium: „Erlauben“ schickt `Origin: http://localhost:…`, Rückleitung erreicht |
| **N1** Kauf ohne bestätigte Adresse | Checkout 403 `email_unconfirmed`. | probe1 #9 |
| **N2** Foto-Präfix `//tracker…` | `sharePhotoPath` lässt nur `^/(?![/\\])[\w/-]*$` als Präfix zu, sonst `/pdfapi`. | probe1 #10 und Einheitstest (auch `/\host`, `https://host//tracker`) |
| **N3** Kontolöschung bei offener Zahlung | Unbezahlte Bestellungen mit Mollie-Zahlung im Status open/pending/authorized bleiben (ohne Konto, ohne Checkout-Link). Kommt die Zahlung doch, ist sie verbucht und der Betreiber bekommt „Zahlung für ein gelöschtes Konto — bitte erstatten“. Rest räumt der Aufräumjob nach 30 Tagen ab. | N3-Test; `billing.test.mjs` „Kontolöschung“ angepasst |
| **N4** keine Fotoquote | 50 Fotos bzw. 100 MB je Konto → 413 `photo_quota`. | N4-Test |
| **N5** Kontenaufzählung über 409 | E-Mail-Wechsel: gleiche Antwort für freie und vergebene Adresse; der Inhaber der vergebenen bekommt einen Hinweis statt eines Links (höchstens 1/Tag). Registrierung: siehe Restpunkte. | N5-Test (Antwortform gleich, Hinweis ohne Token) |
| **N6** Reset-Token im Klartext | `password_resets.token` speichert `sha256(token)`. Alte Klartext-Token sind nach dem Deploy wertlos (60 min Laufzeit, kein Schaden). | N6-Test; `integration.test.mjs` „Befund 2: Passwort-Reset“ angepasst |
| **N7** Chromium `--no-sandbox` | Geprüft: Playwright setzt ohne `chromiumSandbox: true` selbst `--no-sandbox`. Neu: `PDF_CHROMIUM_SANDBOX=1` startet mit Sandbox; scheitert der Start, Rückfall auf `--no-sandbox` mit Warnung im Log. **Standard bleibt ohne Sandbox** — siehe Restpunkte. | N7-Test (Argumente; mit Sandbox als root → Rückfall, PDF kommt trotzdem) |
| **N8** Datenauszug ohne Erklärungen | `/api/me/export` enthält `declarations` (eigene und zu eigenen Bestellungen, ohne Token-Hash), `pending_email` und die Kündigungsfelder der Bestellungen. | im M1-Test |
| **N9** MCP | `app.disable('x-powered-by')`; JSON-Parser nur auf `POST /mcp` und erst nach der Token-Prüfung (Form `cvk_…`/`cvm_…`, dann `/api/auth/me`); Docker `USER node`. | `mcp/cv-mcp.test.mjs`: kaputtes JSON ohne Token → 401 (vorher 400), 6 MB mit falschem Token → 401, gültiger Schlüssel → 200 |
| Live: HSTS, Permissions-Policy, Cache | `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Permissions-Policy` (Kamera, Mikrofon, Ort, Zahlung, USB … aus), `Cache-Control: no-store` als Vorgabe für alles (Fotos, Rechnungen setzen ihren eigenen Wert). | Live-Test über /health, /api/templates, /api/billing/offer |
| Live: „Cannot GET“ | JSON-404 `{ error, code: 'not_found' }` als letzte Middleware. | Live-Test |

## Schnittstelle (für das Frontend)

- `POST /api/billing/withdraw-public` und `/cancel-public`: Antwort unverändert
  (`{ ok, receivedAt, refund: { status: 'requested' } }` bzw. `{ ok, receivedAt }`),
  gleich für jeden Ausgang. `refund.status` ist dort nur noch Platzhalter; die
  Erstattung beginnt erst mit dem Klick.
- Links in der Mail: `<PUBLIC_BASE_URL>/widerruf/bestaetigen?token=…`,
  `<PUBLIC_BASE_URL>/kuendigen/bestaetigen?token=…`. Die Seite ruft
  `POST /api/billing/declarations/confirm { token }` auf (Rate-Limit 30/h).
  - 200 `{ ok, kind: 'withdraw', orderNo, receivedAt, effectiveAt, refund: { status }, already? }`
  - 200 `{ ok, kind: 'cancel', orderNo, receivedAt, effectiveAt, orderNos }`
  - 400 `token_invalid` (unbekannt oder kaputt), 409 `token_used` (mit `kind`,
    `orderNo`, `receivedAt` und dem gespeicherten Ergebnis), 410 `token_expired`
    (mit `kind`, `orderNo`, `receivedAt`), 409 `not_withdrawable` (bestätigt, aber
    nicht ausführbar — geht an den Betreiber).
- `POST /api/auth/email` → `{ ok, pending, pendingEmail, user }` (vorgemerkt) bzw.
  `{ ok, pending: false, pendingEmail: null, user }` (entfernt oder gleiche Adresse).
  `POST /api/auth/confirm-email` → zusätzlich `{ kind: 'change', email }` beim Wechsel,
  409 `email_taken`, wenn die Adresse inzwischen vergeben ist.
  `POST /api/auth/resend-confirmation` schickt bei offenem Wechsel dessen Link neu.
- Neue Fehlercodes: `email_unconfirmed` (Checkout 403), `origin_not_allowed` (403),
  `account_locked` (Login 429), `pdf_busy_anon` (PDF 429), `photo_quota` (413),
  `markdown_too_large` (413), `not_found` (404).

## Offene Restpunkte

1. **N5 Registrierung**: `POST /api/auth/register` (offen) antwortet weiter 409
   `email_taken`, weil die Oberfläche nach der Registrierung sofort anmeldet. Eine
   einheitliche Antwort braucht einen anderen Ablauf („Mail ist unterwegs“,
   Anmeldung erst nach Bestätigung). Bis dahin: Jede Probe kostet eine gelöste
   ALTCHA-Aufgabe, 5/h je IP (IPv6: je /64), 30/h je Netz, und der Inhaber bekommt einen
   Hinweis (höchstens einmal am Tag).
2. **N7 Sandbox**: Im Standard-Docker-Container nicht nachgewiesen. Das Standard-seccomp-
   Profil von Docker verbietet unprivilegierte User-Namespaces, und das
   Playwright-Image hat keinen setuid-Helfer. Zum Einschalten: im Container
   `--security-opt seccomp=<Playwright-Profil>` (oder ein Profil, das `clone`/
   `unshare` mit `CLONE_NEWUSER` erlaubt) und `PDF_CHROMIUM_SANDBOX=1`. Im Log
   steht dann keine Warnung „startet nicht mit Sandbox“. Bis dahin schützt:
   eigener Kontext je Auftrag, kein JavaScript, keine Namensauflösung außer den
   eigenen Hosts, Benutzer `pwuser`.
3. **Konto-Sperre als Angriffsmittel (M3)**: 10 Fehlversuche je Stunde sperren das
   Konto für alle — auch für den Inhaber. Gewollt (verteiltes Raten), aufzuheben
   per „Passwort vergessen“.
4. **Grund der außerordentlichen Kündigung**: steht im Wortlaut der Mail an die
   Bestelladresse und darf Links enthalten. Erreicht nur Adressen, zu denen es
   eine Bestellung gibt (ALTCHA, 5/h je IP, 20/h je Netz). Der Name ist gefiltert, der Grund nicht —
   eine Kündigung muss frei begründet werden können.
5. **Laufender Pass nach Widerruf über den Link**: Das Pass-Ende gilt ab dem
   Klick, nicht rückwirkend ab Eingang (bis dahin war nicht sicher, dass die
   Erklärung vom Kunden stammt). Für Frist und Wortlaut zählt der Eingang.
6. **Rate-Limits im Speicher**: Alle Eimer leben im Prozess. Mehrere Instanzen
   oder ein Neustart setzen sie zurück (wie bisher).
7. **Fester Text bei nicht zuzuordnenden Erklärungen**: geht weiterhin an jede
   eingegebene Adresse (Beleg für echte Kunden mit anderer Adresse). Ohne
   Nutzereingaben, ALTCHA und 5/h je IP — als Spam-Werkzeug wertlos.
8. **Mailtexte** der Bestätigungslinks und Hinweise sind eigene Fassungen des
   Backends (`mailtexts/index.js`, markiert `TODO(Rechtstexte)`), nicht aus
   `app/src/legal/mails.ts`.

## Was beim Betrieb zu setzen ist

- Nichts Pflichtiges. `PUBLIC_BASE_URL` muss gesetzt sein (ohne sie gibt es keine
  Bestätigungslinks; jede öffentliche Erklärung geht dann als Handarbeit an
  `BILLING_NOTIFY_EMAIL`).
- `ALLOWED_ORIGINS`: jede Adresse, unter der die App läuft (ohne Eintrag sind
  nur die localhost-Entwicklungsports erlaubt; jeder andere Ursprung bekommt 403).
- Optional `PDF_CHROMIUM_SANDBOX=1` — erst nach Punkt 2 der Restpunkte.
- `BILLING_JOBS` nicht auf 0 setzen: der Hintergrundlauf meldet unbestätigte
  Erklärungen nach 14 Tagen.
- Der MCP-Container läuft jetzt als `node` (Port 3000, keine Schreibrechte nötig).

# Nachtrag Runde 8b (10.10.2026) — Rechtsfolgen im Bezahl- und Registrierungsfluss (B4)

Grundlage: eine Rechtsprüfung vom 10.10.2026 (Patches P1–P9; der Bericht ist nicht
Teil dieses Repositorys) und das Audit vom 09.10.2026 (H2/M1/M4 oben).
Tests: `billing.test.mjs` (Tests „P1“ bis „P8/P9“), angepasste Fälle in
`security.test.mjs` und `admin.test.mjs`; Oberfläche `app/scripts/accountcheck.mjs`,
`billingcheck.mjs`, `vouchercheck.mjs`.

## P4: Öffentliche Kündigung sofort, öffentlicher Widerruf weiter mit Link

| Erklärung ohne Anmeldung | Angaben | Wirkung |
|---|---|---|
| Kündigung | Bestellnummer **und** Adresse der Bestellung passen | sofort, ohne Klick; Mail an die Bestelladresse bestätigt nur; Betreiber bekommt sie zur Kenntnis |
| Kündigung | nur Adresse (ohne Bestellnummer) | wie bisher: Bestätigungslink an die Bestelladresse (14 Tage) |
| Widerruf | Bestellnummer und Adresse passen | **weiter Bestätigungslink** (5 Tage, P3) |
| beide | passt nicht | fester Text an die eingegebene Adresse (M4), Wortlaut nur an den Betreiber |

**Abwägung Kündigung.** Der BGH (I ZR 161/24) verlangt einen unmittelbaren
Kündigungsweg ohne zusätzliche Hürden. Bestellnummer + Bestelladresse ist das
Mindestmaß an Nachweis, das der Audit vom 09.10. für „fremde Personen dürfen
keine Pässe Dritter beenden“ zulässt; die Adresse allein (H2) reicht weiter
nicht. Restrisiko: Bestellnummern sind fortlaufend (`B-001001` …) und damit
ratbar. Wer die Adresse eines Kunden kennt, kann Nummern durchprobieren —
begrenzt durch ALTCHA, 5/h je IP, 20/h je Netz, und jeder Treffer landet sofort
beim Kunden (Kündigungsbestätigung) und beim Betreiber („sofort ausgeführt“).
Schaden: Der Pass endet früher; Geld fließt nicht ab, und der Betreiber kann
die Laufzeit im Admin-Bereich wiederherstellen („Pass gewähren“). Härtung für
später: nicht ratbare Bestellnummern (z. B. Zufallsanteil) — dann trüge die
Nummer selbst den Nachweis.

**Abwägung Widerruf.** Ein Widerruf löst eine Erstattung bei Mollie aus, die sich
nicht zurückholen lässt, und beendet den Pass. Mit ratbaren Bestellnummern wäre
Nummer + Adresse dafür zu schwach. Das Prüfteam hält den Link beim Widerruf für
vertretbar, wenn (1) der Eingang zählt, (2) die Eingangsbestätigung sofort
hinausgeht (P2) und (3) die Erstattung auch ohne Klick fristgerecht kommt. Dafür
gilt der Link nur 5 Tage, und der Betreiber erfährt sofort von jeder öffentlichen
Erklärung (P3) — ihm bleiben mindestens 9 der 14 Tage aus § 357 Abs. 1 BGB.
Anwaltsfrage 1 bleibt offen.

## P9: Einwilligung Art. 9 DSGVO als Schreibsperre

- Durchgesetzt am Server, nicht in der Oberfläche: `consent.js`
  (`requireArt9Consent`) steht hinter `requireWritable` auf allen Wegen, die
  Inhalte im Konto ablegen: `POST/PUT/PATCH /api/resumes`, `import-md`,
  `import-cover-letter-md`, Versionen wiederherstellen, `POST /api/photos`,
  Sharelink anlegen/auffrischen (der Link speichert einen festen Stand).
  Antwort 403 `art9_consent_required`. Lesen, Export, Datenauszug und Löschen
  bleiben frei. Gilt auch für API-Schlüssel und KI-Verbindungen (MCP).
- Einwilligen nur mit Browser-Sitzung (`POST /api/me/consent/art9`, 403
  `consent_session_only` über API-Schlüssel/OAuth) und nur mit der Textfassung,
  die der Server kennt (`ART9_VERSION`; sonst 409). Gespeichert: Zeit und
  Fassung (`users.art9_consent_at`, `art9_consent_version`); Widerruf leert
  beides und setzt `art9_withdrawn_at`. Ereignis `art9_consent`/`art9_withdraw`.
- Neue Textfassung = neue `ART9_VERSION` (und `ART9_CONSENT_VERSION` in
  `app/src/legal/einwilligung.ts`): Bis zur erneuten Einwilligung speichert
  kein Konto. Der Test „P8/P9“ prüft, dass beide gleich sind.

## P6: Rechnungen unveränderbar

`invoice_documents` hält das ausgestellte PDF (mit SHA-256). Ausgeliefert wird
nur noch dieses; Bestand wird beim ersten Abruf eingefroren, so wie ausgestellt
(ohne späteren Widerrufsvermerk). Ein Widerruf erzeugt einen eigenen
Stornobeleg `<Rechnungsnummer>-S`; der Rechnungskreis bleibt lückenlos. Belege
teilen die Aufbewahrung der Bestellung (ON DELETE CASCADE, Löschung nach
10 Jahren durch `janitor.js`). Kunde: `GET /api/billing/orders/:id/credit-note.pdf`
(nur eigene Bestellung), Admin: `/api/admin/billing/orders/:id/credit-note.pdf`
(protokolliert).

## P1/P7: Länder

`checkout()` nimmt nur EU-27 (`EU_COUNTRIES`), außerhalb DE nur mit
`consumer: true` (gespeichert in `orders.consumer_confirmed`). Ab
`EU_B2C_STOP_CENTS` (Standard 9.000 €) im laufenden oder vorigen Jahr lehnt er
Länder ≠ DE ab (`country_not_available`, `reason: eu_abroad_paused`); die
Länderliste der Oberfläche kommt aus `GET /api/billing/offer` (`countries`).

## Geänderte Prüfungen (bewusst, mit Grund)

- `security.test.mjs` M4: Die neutrale Eingangsbestätigung enthält seit P2 den
  geprüften Namen und die angegebene Bestellnummer (§ 356a Abs. 4 BGB). Geprüft
  wird jetzt: nur in ihren Zeilen, keine Links, kein freier Grund, nichts über
  die fremde Bestellung (Adresse, Betrag, Datum, Link).
- `security.test.mjs` „Bestätigungslink abgelaufen“: Kündigung ohne
  Bestellnummer, weil sie mit Nummer seit P4 sofort wirkt.

# Nachtrag (10.10.2026) — Vorlagen-Staffel, Lücke nach Widerruf, Zähler ohne Konto

Grundlage: die optionale „Vorlagen-Staffel“ (greift nur mit Verkauf und
`FREE_TIER_LIMITS`, ab Werk aus).
Tests: `billing.test.mjs` („Widerruf ohne andere Berechtigung …“, „Normal
abgelaufener Pass …“, „Migration: Bestandskonto nur mit widerrufener
Bestellung …“, „Client-Zähler ohne Konto …“), `vouchers.test.mjs`
(„Widerruf-Regel …“); Oberfläche `app/scripts/freetiercheck.mjs` (Abschnitt H),
`app/scripts/capscheck.mjs`.

## Vorlagen-Staffel ist eine Angebotsgrenze, keine Sicherheitsgrenze

- Ohne Pass gibt es das gestaltete PDF und HTML nur in den 10 Gratis-Vorlagen
  (`app/src/templates/freeTemplates.ts`), die ATS-Fassung als PDF in jeder.
  Gesperrt wird in der Oberfläche an allen Ausgängen gleich: PDF-Knopf,
  Export-Menü, Export-Paneel (auch am Telefon), „PDF“ auf der
  Profilübersicht, Browser-Druckweg (`App.tsx handlePrint`), Strg/Cmd+P im
  Editor und der Druck über das Browsermenü (CSS `[data-print-locked]`).
- **`/api/pdf` sperrt nicht nach Vorlage.** Ohne Konto (Lokalmodus) weiß der
  Server nicht, wer anfragt und welche Fassung Bestand ist; das HTML entsteht
  im Browser, der Code ist offen (AGPL), und wer will, druckt das HTML selbst.
  Eine Sperre am Server wäre nur Schein und würde bei Konten ohne Pass die
  Bestandsregel brechen. `meta.template` bleibt reines Zählmerkmal.
- Bestandsregel: lokal über `settings.grandfatheredTemplate` (einmal je
  Browser gesetzt, Merker `cv-tpl-tier-v1`), für Konten über
  `resumes.created_at` < `freeTier.templatesSince` (erster Start mit Grenze,
  `schema_migrations` „template_tier_since“, übersteuerbar mit
  `TEMPLATE_TIER_SINCE`). Beides lässt sich im Browser fälschen; das ist bei
  einer Angebotsgrenze hingenommen.

## Lücke nach Widerruf (grants.js)

- Vorher: Nach einem Widerruf blieb `plan_kind = 'pass'` stehen, das Konto galt
  als „Pass abgelaufen“ und durfte nach AGB § 7 Abs. 5 dauerhaft Word, LaTeX
  und (seit der Staffel) die Pass-Vorlagen exportieren.
- Jetzt: Stammen die Pass-Berechtigungen nur aus widerrufenen Bestellungen
  (kein Gutschein, keine weitere bezahlte Bestellung), rechnet `computeAccess`
  `plan_kind = 'none'` (selbst registriert) bzw. die Pilot-Einordnung
  (eingeladen). `/api/me` meldet `plan.kind = 'none'`, `until = null`,
  `withdrawn = true`. Lesen, `/api/me/export`, Markdown-Abruf und Löschen
  bleiben, Schreibwege antworten 403 `pass_required`. Die Laufzeit
  (`access_until`) ändert sich nicht. Grundlage: § 357 Abs. 8 i. V. m. § 327p
  Abs. 1 S. 2 BGB.
- Bestand: `migrateWithdrawnOnly` (einmal, `schema_migrations`
  „withdrawn_only_v1“, Sperre 7322/2) rechnet solche Konten beim Start neu und
  meldet die Zahl im Log („access-grants: Widerruf-Regel“).
- Ein normal abgelaufener Pass bleibt unverändert (Export in allen Formaten).

## Zähler ohne Konto (`POST /api/events`)

- Fünf Bedienereignisse (`template_lock_view`, `unlock_panel_view`,
  `export_markdown`, `import_markdown`, `ai_open`) gehen jetzt auch ohne
  Anmeldung. Sie werden **nur** als Tageszähler in `usage_daily` gezählt
  (stats.js), nie in `events` (dort steht eine Nutzer-ID), auch nicht mit
  Konto. Merkmale nur aus festen Listen (Vorlagen-ID aus templates.json,
  Sperrgründe, KI-Ziele, lokal/Konto); alles andere fällt weg.
- Rate-Limit wie bisher 120/h je Adresse (IPv6 je /64). Die übrigen
  Ereignisse (Word, Browser-PDF, Sharelink, LaTeX) brauchen weiter ein Konto
  (401 ohne).
- Die Oberfläche schickt sie nicht, wenn `umami.disabled` gesetzt ist
  (Widerspruch in der Datenschutzerklärung), ohne Cookies (`credentials:
  'omit'`). Die Datenschutzerklärung (`LegalPages.tsx`, Abschnitt „Ohne Konto“) sollte
  diese Zähler nennen, wenn eine Instanz sie nutzt.

## Textebene der PDFs (kein Sicherheitsthema, der Vollständigkeit halber)

Chromium m148 (Playwright 1.60, Image des Dienstes) rundet im Druck die
Zeichenvorschübe auf ganze CSS-Pixel; gesperrte Versalien zerfielen in
pdftotext („SE NIOR“, „BE RUFSPROFIL“). Behoben mit `text-rendering:
geometricPrecision` auf `.cv-page` im Export-HTML (nicht in der Vorschau) und Sperrung 0
in der ATS-Fassung. Prüfung: `app/scripts/capscheck.mjs` mit
`CAPS_CHROMIUM=<chrome-headless-shell 148>`.
