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
