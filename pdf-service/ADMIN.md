# Admin-Bereich

Stand 10.10.2026 (Runde 8b). Verwaltung von Konten, Zahlungen, Rechnungen, Gutscheinen und Einladungen, dazu die Zahlen für den Betrieb. Seit dieser Runde gibt es das nicht mehr in der App, sondern nur noch in einem eigenen Bereich mit eigener Anmeldung.

## Aufbau

| Teil | Datei | Aufgabe |
|---|---|---|
| Host-Weiche, Sitzung, Protokoll, Dashboard-Routen | `pdf-service/admin.js` | alles unter `/api/admin/*` |
| Tageszähler ohne Personenbezug | `pdf-service/stats.js` | Tabelle `usage_daily` |
| Oberfläche | `app/admin.html`, `app/src/admin/**` | eigenes Vite-Bündel, kein Editor, kein Umami |
| Auslieferung | `app/nginx.conf` (Vorlage mit `${ADMIN_HOST}`), `app/Dockerfile` | Admin-Host liefert nur `admin.html` |
| Aufräumen | `pdf-service/janitor.js` | Protokoll 365 Tage, Sitzungen und Codes nach Ablauf |
| Tests | `pdf-service/admin.test.mjs`, `app/scripts/admincheck.mjs`, `app/scripts/nginxcheck.mjs` (Abschnitt 9/10) | |

Datenbank (nur neue Tabellen bzw. Spalten an `admin_audit`): `admin_sessions`, `admin_login_codes`, `usage_daily`, `order_payment_info`, `admin_audit.ip_net`, `admin_audit.via`.

## Variablen

| Variable | Wo | Bedeutung |
|---|---|---|
| `ADMIN_HOST` | cv-api **und** App (nginx) | Host des Admin-Bereichs, z. B. `admin.example.com`. Leer = einfacher Weg ohne eigenen Host (siehe unten). |
| `ADMIN_URL` | cv-api | Volle Adresse, falls nicht `https://<ADMIN_HOST>`. Daraus kommen der erlaubte Ursprung und der Link „Admin-Bereich öffnen“ in der App. |
| `ADMIN_EMAIL` | cv-api | Ziel der Admin-Login-Codes und der Testmail. Fehlt sie, geht der Code an die Adresse im Admin-Konto. Empfehlung: setzen, dann kann eine gekaperte App-Sitzung den Code nicht umleiten. |
| `ADMIN_ALLOWED_IPS` | cv-api | Optional, CIDR-Liste (`203.0.113.0/24, 2001:db8::/48`). Leer = alle Netze. Ungültige Einträge gelten nicht, der Dienst warnt beim Start. Braucht hinter dem Proxy `TRUST_PROXY=1`. |
| `UMAMI_DASHBOARD_URL` | cv-api | Optional, nur `https://`. Link für Besucherzahlen im Bereich „Nutzung“. |
| `SOURCE_COMMIT` | cv-api | Optional. Coolify setzt sie, wenn „Include Source Commit in Build“ an ist; dann zeigt der Überblick den Commit. |

Unverändert gebraucht: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, SMTP, `TRUST_PROXY`, `PUBLIC_BASE_URL`.

## Sicherheitsmodell

1. **Getrennte Adresse.** Mit `ADMIN_HOST` antwortet `/api/admin/*` nur auf genau diesem Host (Host-Kopf; ein mitgeschickter `X-Forwarded-Host` muss gleich sein). Auf jedem anderen Host gibt es dort 404, in jeder Schreibweise. Auf dem Admin-Host gibt es nur `/api/admin/*` und `/health`. Dieselbe Weiche steht im nginx der App: Der Admin-Host liefert nur `admin.html` und `/assets/`, auf dem Haupthost gibt es `/admin/` und `/pdfapi/api/admin/*` nicht. Die Prüfung im Backend ist die maßgebliche, denn bei manchen Hostings (z. B. Coolify mit eigener API-App) routet der Proxy `/pdfapi` direkt an cv-api, am nginx vorbei.
2. **Eigene Sitzung.** Anmeldung in zwei Schritten auf dem Admin-Host: Passwort, dann ein sechsstelliger Code per Mail (immer, auch wenn im Konto kein Zwei-Faktor eingeschaltet ist). Codes liegen in einer eigenen Tabelle, ein Code aus der normalen Anmeldung öffnet nichts. Danach Cookie `__Host-cv_admin`: nur dieser Host (kein `Domain`), `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`. Gespeichert wird nur der SHA-256 des Werts. Laufzeit 8 Stunden absolut, 30 Minuten ohne Anfrage. Ein Passwortwechsel (auch über `ADMIN_PASSWORD`) beendet alle Admin-Sitzungen.
3. **Nichts anderes zählt.** Auf dem Admin-Host geben das Cookie der Hauptdomain, API-Schlüssel und KI-Verbindungen (OAuth) keine Rechte.
4. **Ursprung (CSRF).** Haupt- und Admin-Host unter derselben Domain (etwa `cv.example.com` und `admin.example.com`) sind für den Browser „same-site“, `SameSite=Strict` allein trennt sie also nicht. Deshalb: schreibende Admin-Anfragen nur mit `Origin` gleich der Admin-Adresse; jede Anfrage mit fremdem `Origin` oder `Sec-Fetch-Site: same-site/cross-site` bekommt 403. Keine CORS-Freigabe für den Admin-Ursprung.
5. **Netze.** Optional `ADMIN_ALLOWED_IPS`, gilt auch für die Anmeldung.
6. **Protokoll.** Jede erfolgreiche schreibende Admin-Anfrage, dazu Kundendetail-Ansichten, CSV-Export, Rechnungs-PDF, An- und Abmeldung, fehlgeschlagene Anmeldungen: wer, was, Ziel, Zeit, Netz (IPv4 /24, IPv6 /64), Weg. Ein Jahr, dann löscht der Aufräumjob. Gutscheine protokolliert `vouchers.js` selbst (ohne Netz).
7. **Seite.** Strenge CSP auf dem Admin-Host (`default-src 'none'`, Skripte, Stile, Schriften nur vom eigenen Host, kein `unsafe-inline`, `frame-ancestors 'none'`, `base-uri 'none'`), `X-Robots-Tag: noindex`, `Referrer-Policy: same-origin`, `Cache-Control: no-store`, kein Umami.
8. **Rate-Limits.** Anmeldung 5 je 15 Minuten und Adresse, 20 je Netz, 10 Fehlversuche je Konto und Stunde; Code-Prüfung 20 je 15 Minuten, 5 Versuche je Code.

## Was das Dashboard zeigt

- **Überblick:** Konten (gesamt, neu und aktiv 7/30 Tage, unbestätigt, gesperrt), Pässe aktiv/abgelaufen, Zugänge nach Herkunft, Umsatz Monat/Jahr/gesamt aus Rechnungen (ohne Widerrufe), Widerrufe, Erstattungen, Kündigungen, Erklärungen von Hand, Mailfehler (7 Tage, über `onMailResult` in `mail.js`), letzter Aufräumlauf, Datenbankgröße, Fotos, Version. Jede Seite mit „Stand“.
- **Verlauf:** Umsatz, Käufe, Registrierungen, Gutschein-Einlösungen, PDF und Word je Tag (30/90/365 Tage), eigenes SVG. Trichter: registriert → bestätigt → Lebenslauf gespeichert → Kauf oder Gutschein.
- **Nutzung:** Tageszähler aus `usage_daily` (PDF über den Dienst nach Format und Sprache, Browser-PDF, Word, LaTeX, Sharelinks, Markdown-Brücke, Aufrufe über KI-Verbindung/API-Schlüssel je Schnittstelle) und die Verteilung aus den gespeicherten Lebensläufen (Vorlage, Sprache, Seiten, Format). Keine Nutzer-ID, keine Adresse, nur Werte aus festen Listen. Lokalmodus und Demo sieht der Server nicht.
- **Kunden:** Suche, Detail (Konto, Zugänge, Käufe, Rechnungen, Gutscheine, letzte Anmeldungen, Zähler). Aktionen: Pass gewähren/verlängern (Grund Pflicht), sperren/entsperren, Passwort-Mail, Bestätigungsmail, alle Anmeldungen beenden (optional mit API-Schlüsseln und KI-Verbindungen), löschen nur mit eingetipptem Nutzernamen.
- **Zahlungen:** alle Bestellungen, Abgleich „bezahlt ohne Zugang“ und „Zugang ohne Zahlung“, Status bei Mollie abgleichen, hängende Widerrufs-Erstattung neu anstoßen, Link ins Mollie-Dashboard. Kulanz-Erstattungen gehen nur im Mollie-Dashboard; davon erfährt der Dienst nichts.
- **Rechnungen:** Liste, PDF neu laden, CSV für die Steuerberatung (Monat oder Jahr; Semikolon, UTF-8 mit BOM, CSV-Injection neutralisiert, ohne Namen und Adressen), Prüfung des Nummernkreises auf Lücken und Doppelte. Die Zahlungsart liest der Export einmal bei Mollie nach und merkt sie sich (`order_payment_info`).
- **Widerrufe:** alle Erklärungen mit Status und Wortlaut, „Erledigt“ mit Notiz.
- **Gutscheine, Einladungen:** wie bisher (`AdminVouchers`, Einladungscodes, Zugangsanfragen, Auswertung je Code).
- **System:** was fehlt (nur Namen, nie Werte), Verkauf und Registrierung nur als Anzeige (Schalter bleiben in der Umgebung des Dienstes), Testmail an `ADMIN_EMAIL`, Protokoll.

### Nachtrag B4 (10.10.2026, Rechtsfolgen)

- **Überblick:** Abschnitt „EU-Ausland (Privatkunden)“ mit Umsatz laufendes und voriges Jahr, Abstand zur Schwelle 10.000 € und Stand der automatischen Sperre (`EU_B2C_STOP_CENTS`, Standard 9.000 €). „Braucht dich“ zeigt öffentliche Erklärungen „offen, unbestätigt“. Bei „Konten“: Einwilligung Art. 9 erteilt / fehlt / widerrufen.
- **Rechnungen:** gespeichertes Rechnungs-PDF (unverändert), nach Widerruf zusätzlich „Storno <Nr>-S“; der CSV-Export hat für jeden Storno eine eigene Zeile.
- **Widerrufe:** Filter „Offen, unbestätigt“ für öffentliche Erklärungen, deren Link noch nicht geklickt wurde.
- **Kundendetail:** AGB-Fassung bei der Registrierung, Stand der Einwilligung Art. 9.
- **System:** wirksame Fassung von AGB und Widerrufsbelehrung mit Quelle (Datei oder Übersteuerung per `TERMS_VERSION`/`WITHDRAWAL_VERSION`, dann gelb mit Warnung), Fassung der Einwilligung Art. 9, Sperrbetrag EU-Ausland.

## Ohne eigenen Admin-Host (Standard)

Ohne `ADMIN_HOST` bleibt alles wie vorher: Admin-Rechte über die normale Anmeldung mit Rolle „admin“ (nur mit Browser-Sitzung, API-Schlüssel und KI-Verbindungen eines Admins öffnen die Admin-API nicht), die Admin-Seite liegt unter `<Adresse>/admin/`, die App zeigt Admins dort einen Link hin. Niemand wird ausgesperrt. Die nginx-Konfiguration ist eine Vorlage: Das nginx-Image ersetzt beim Start nur `${ADMIN_HOST}` (`NGINX_ENVSUBST_FILTER=^ADMIN_HOST$`, `/etc/nginx/templates/default.conf.template`); ohne Wert gilt `admin.invalid`, ein Host, der nie aufgelöst wird.

## Mit eigenem Admin-Host

1. DNS: einen zweiten Namen (z. B. `admin.example.com`) auf denselben Server zeigen lassen; der Reverse-Proxy davor leitet beide Namen an den Frontend-Container (im mitgelieferten `docker-compose.yml` Port 8080).
2. In `.env`: `ADMIN_HOST=admin.example.com`, bei Bedarf `ADMIN_URL`, dazu `ADMIN_EMAIL` und SMTP (ohne Mail kein Anmeldecode). `docker-compose.yml` gibt `ADMIN_HOST` an cv-api **und** an den nginx der App weiter.
3. Routet der Proxy `/pdfapi` direkt an cv-api (getrennte Apps), braucht cv-api dieselben Variablen und die API muss auch unter `https://admin.example.com/pdfapi` erreichbar sein.
4. Erst cv-api, dann die App neu starten. Zwischen den beiden Schritten antwortet die alte App-Verwaltung schon mit 404 – das ist gewollt.
5. Prüfen: `https://admin.example.com/` zeigt die Anmeldung; `https://cv.example.com/pdfapi/api/admin/stats` → 404; Anmeldung mit Code; System → Testmail.

Zurück auf den einfachen Weg: `ADMIN_HOST` in beiden Diensten leeren und neu starten.
