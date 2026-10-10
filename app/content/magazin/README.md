# So funktioniert das Magazin

Das Magazin sind die Artikel unter `/magazin/` auf der Website der eigenen Instanz (früher hieß es „Ratgeber" und lag unter `/ratgeber/`; nginx leitet die alten Adressen dauerhaft um). Geschrieben wird wahlweise direkt im Repo oder in einem Wiki (Outline), veröffentlicht wird über das Repo: Jeder Artikel liegt als Markdown-Datei in diesem Ordner, und beim Bau entstehen daraus statische HTML-Seiten. Es gibt kein CMS und keinen zusätzlichen Dienst auf dem Server.

```
Outline-Sammlung „Magazin (öffentlich)" (optional)
        │  npm run magazin:sync   (nur veröffentlichte Dokumente, Sperrliste)
        ▼
app/content/magazin/<slug>.md      ← Quelle der Wahrheit für die Website
        │  npm run build  →  scripts/magazin-build.mjs
        ▼
dist/magazin/<slug>/index.html, dist/magazin/index.html, dist/magazin/thema/<thema>/,
dist/magazin/index.json (neueste Artikel für die Startseite), sitemap.xml, robots.txt
        │  scripts/landing-prerender.mjs
        ▼
Startseite (Abschnitt „Magazin", 3 bis 6 Artikel), Sitemap mit Sprachfassungen, llms.txt
```

## Einen Artikel veröffentlichen

1. **In Outline schreiben**, in einer eigenen, nur für das Magazin angelegten Sammlung (hier „Magazin (öffentlich)" genannt). Der Titel des Dokuments wird der Titel des Artikels. Keine H1 im Text, Zwischenüberschriften als H2/H3.
2. **Beschreibung festlegen (empfohlen):** Die erste Zeile des Dokuments darf lauten `Beschreibung: …` (höchstens etwa 155 Zeichen). Sie wird zur `meta description` und zum Vorspann und aus dem Text entfernt. Fehlt sie, bleibt eine schon vorhandene Beschreibung stehen; bei neuen Artikeln wird der erste Absatz gekürzt.
3. **Thema festlegen (empfohlen):** eine Zeile `Kategorie: ats` (oder `bewerbung`, `recht`, `ki`) unter den ersten drei Zeilen. Daraus wird das Feld `category`, die Themenseite `/magazin/thema/<thema>/` und die Reihenfolge der „Verwandten Artikel". Die Zeile wird aus dem Text entfernt. Fehlt sie, bleibt das Thema der vorhandenen Datei.
4. **FAQ-Block (für Suchmaschinen und KI-Suche):** eine Zwischenüberschrift (H2) „Häufige Fragen" (auch „FAQ", englisch „Frequently asked questions", französisch „Questions fréquentes", spanisch „Preguntas frecuentes"), darunter jede Frage als H3 mit Fragezeichen, die Antwort als Absatz oder Liste bis zur nächsten H3. Der Bau macht daraus den Datenblock `FAQPage`; die Antworten stehen dort als reiner Text, genau wie auf der Seite. Kurze, direkte Antworten (zwei bis vier Sätze) werden am ehesten zitiert.
5. **Veröffentlichen** in Outline. Entwürfe werden nie übernommen. Zurückziehen (Veröffentlichung aufheben, archivieren, löschen) nimmt den Artikel beim nächsten Sync wieder von der Website.
6. **Übernehmen**, einer von zwei Wegen:
   - *Lokal:* `cd app && OUTLINE_URL=https://wiki.example.com OUTLINE_MAGAZIN_TOKEN=… OUTLINE_MAGAZIN_COLLECTION=<Sammlungs-ID> npm run magazin:sync`, die geänderten Dateien in `content/magazin/` (und `public/magazin/img/`) prüfen und committen. Danach normal deployen.
   - *Direkt beim Bau:* Sind `OUTLINE_URL`, `OUTLINE_MAGAZIN_TOKEN` und `OUTLINE_MAGAZIN_COLLECTION` als **Build-Variablen** (Docker `--build-arg`) gesetzt, holt das Dockerfile die Artikel vor jedem Bau selbst. Dann reicht ein neuer Bau. Wichtig: Ohne Code-Änderung nimmt Docker sonst den alten Bau aus dem Cache. Deshalb ohne Cache bauen (`docker build --no-cache`, bei Hosting-Oberflächen die entsprechende Option).
7. **Prüfen:** `https://<domain>/magazin/` und der Artikel. Was der Sync gesperrt oder übersprungen hat, steht im Bau-Log unter `[magazin:sync]` bzw. `[magazin:build]`.

Die Artikel in diesem Ordner sind Beispielinhalt ohne `outlineId` (der Sync fasst sie nie an): Sie zeigen das Format und geben dem Bau etwas zu zeigen; löschen oder ersetzen. Der Bau funktioniert auch mit null Artikeln (leere Übersicht).

Ein Dokument mit dem Titel **„So funktioniert das Magazin"** (diese Anleitung, früher „So funktioniert der Ratgeber") wird vom Sync immer übersprungen, auch wenn es versehentlich veröffentlicht ist.

## Was in Outline geht

- Überschriften, Absätze, Listen, Aufgabenlisten, Zitate, Tabellen, Codeblöcke, Links, Hervorhebungen, Markierungen (`==…==`) und Hinweiskästen (Info, Tipp, Warnung).
- **Bilder:** in Outline hochladen (Anhang). Der Sync lädt sie herunter nach `public/magazin/img/` (PNG, JPEG, GIF, WebP, AVIF, höchstens 5 MB; SVG absichtlich nicht). Bilder von fremden Adressen werden entfernt. Eine Bildunterschrift in Outline wird zum Alternativtext: bitte immer setzen.
- **Verweise auf andere Magazin-Artikel** in derselben Sammlung werden zu `/magazin/<slug>/`. Verweise auf andere Wiki-Seiten werden zu reinem Text.
- Rohes HTML wird nie übernommen.

## Was nie in die Sammlung gehört

Alles in dieser Sammlung ist dafür gedacht, öffentlich zu werden. Deshalb nie:

- Zugangsdaten, Passwörter, API-Schlüssel und Token (auch nicht „nur als Beispiel"), Mollie-Schlüssel, `cvk_…`/`cvm_…`-Schlüssel dieser App
- interne Adressen: das Wiki selbst, Git, Hosting-Oberfläche, Server-IPs, `localhost`, `sslip.io`, Intranet
- E-Mail-Adressen außer der aus dem Impressum (Beispieladressen bitte mit `@example.com`)
- Kundendaten, Namen aus Projekten, Notizen aus der Strategie

Der Sync prüft jedes Dokument vor dem Schreiben gegen eine Sperrliste (`app/scripts/magazin-sperrmuster.mjs`) und der Bau prüft jede Datei noch einmal. Ein Treffer hält **nur dieses** Dokument zurück; eine früher übernommene, saubere Fassung bleibt online. Im Log steht, welche Regel in welcher Zeile angeschlagen hat (der gefundene Wert nur gekürzt). Die Sperrliste ist ein Netz, kein Freibrief: Sie findet Muster, keine vertraulichen Inhalte in ganzen Sätzen.

## Frontmatter

Jede Datei beginnt mit diesem Block. Der Sync schreibt ihn selbst; wer einen Artikel direkt im Repo anlegt, schreibt ihn von Hand.

```yaml
---
title: "Lebenslauf als PDF oder Word?"
slug: "lebenslauf-pdf-oder-word"
description: "Wann PDF, wann Word: was Bewerbersysteme annehmen und wie du die Textebene prüfst."
lang: "de"
updated: "2026-10-09"
published: "2026-10-09"
---
```

| Feld | Pflicht | Bedeutung |
|------|---------|-----------|
| `title` | ja | Überschrift, `<title>`, Open Graph. Ab etwa 60 Zeichen kürzen Suchmaschinen. |
| `slug` | ja | Adresse `/magazin/<slug>/`, muss dem Dateinamen entsprechen; nur `a-z`, `0-9`, Bindestrich. Bleibt beim Sync gleich, auch wenn sich der Titel ändert, damit geteilte Links gültig bleiben. |
| `description` | ja | `meta description` und Vorspann, etwa 50 bis 155 Zeichen. |
| `category` | nein (empfohlen) | Thema: `ats`, `bewerbung`, `recht` oder `ki`. Themenseite, Brotkrumen, `articleSection` im JSON-LD. |
| `lang` | ja | `de`, `en`, `fr` oder `es`; bestimmt Sprache der Seite und der festen Texte. |
| `updated` | ja | `JJJJ-MM-TT`; Anzeige, `dateModified` im JSON-LD, `lastmod` in der Sitemap. |
| `outlineId` | nein | ID des Outline-Dokuments. Nur Dateien **mit** `outlineId` gleicht der Sync ab (schreibt sie neu oder löscht sie, wenn das Dokument nicht mehr veröffentlicht ist). Dateien ohne `outlineId` fasst der Sync nie an. |
| `published` | nein | erstes Erscheinen, `datePublished` im JSON-LD (sonst `updated`). |

Werte dürfen in doppelten Anführungszeichen (JSON-Regeln), einfachen Anführungszeichen oder ohne stehen. Andere Felder, Listen und mehrzeilige Werte sind nicht vorgesehen. Dateien, die mit `_` oder `.` beginnen, und diese README werden nicht veröffentlicht.

## Was der Bau erzeugt

- je Artikel `dist/magazin/<slug>/index.html` mit `<title>`, `meta description`, `canonical`, Open Graph, JSON-LD `Article` (mit `dateModified`, Herausgeber = Produktname, kein Personenname), `BreadcrumbList` und bei FAQ-Block `FAQPage`; Brotkrumen, Thema, Herausgeberzeile, Inhaltsverzeichnis ab vier Zwischenüberschriften (oder ab 900 Wörtern mit mindestens zwei), am Ende der Aufruf zur App mit einem echten Bildschirmfoto (aus `public/landing/`) und „Verwandte Artikel" (gleiches Thema zuerst)
- `dist/magazin/index.html` (Übersicht, neueste zuerst, Themen-Navigation), je Thema mit Artikeln `dist/magazin/thema/<thema>/index.html`, `dist/magazin/404.html`
- `dist/magazin/index.json`: alle Artikel mit Titel, Beschreibung, Thema, Datum, Lesezeit (für den Abschnitt „Magazin" der Startseite und `llms.txt`)
- `dist/sitemap.xml` (Startseite, `/preise`, Übersicht, alle Artikel) und `dist/robots.txt` (aus `public/robots.txt`, Sitemap-Zeile neu)
- `dist/magazin/assets/`: CSS und die Schrift Geist, selbst ausgeliefert, mit Inhalts-Hash im Namen

Die Seiten haben kein ausführbares JavaScript und laden nichts von fremden Servern. nginx liefert `/magazin/` mit eigener, strenger CSP aus, unbekannte Artikel bekommen eine echte 404 statt der App (`app/nginx.conf`).

Fehlerhafte Dateien (Frontmatter, Sperrliste, doppelter Slug) überspringt der Bau mit einer Warnung; die App wird trotzdem gebaut. `npm run magazin:check` macht aus denselben Befunden einen Fehlschlag.

## Umgebungsvariablen

| Variable | Wo | Wozu |
|----------|----|------|
| `PUBLIC_BASE_URL` | Bau | Basis für `canonical`, `og:url`, Sitemap und robots.txt. Standard `https://cv.example.com` (`FALLBACK_BASE_URL` in `src/landing/brand.js`), also für jede echte Instanz setzen (in `docker-compose.yml` aus `APP_BASE_URL`). Bei einem Domainwechsel nur diese Variable ändern. |
| `OUTLINE_URL` | Sync | Adresse des Wikis ohne `/api`, z. B. `https://wiki.example.com`. |
| `OUTLINE_MAGAZIN_TOKEN` | Sync | API-Schlüssel mit **nur Lesezugriff auf diese eine Sammlung** (siehe unten). Ohne ihn tut der Sync nichts. Der alte Name `OUTLINE_RATGEBER_TOKEN` wird weiter gelesen. |
| `OUTLINE_MAGAZIN_COLLECTION` | Sync | ID der Magazin-Sammlung in der eigenen Instanz. Pflicht für den Sync; eine Vorgabe gibt es nicht. Der alte Name `OUTLINE_RATGEBER_COLLECTION` wird weiter gelesen. |
| `MAGAZIN_LANG` | Bau | Sprache der Übersicht (`de`, `en`, `fr`, `es`), Standard `en`. |
| `PUBLIC_SITE_NAME`, `PUBLIC_PUBLISHER` | Bau | Produktname (Standard `VITE_APP_NAME`, sonst der Name aus `src/landing/brand.js`, „CV-Hub") und Herausgeber im JSON-LD und in der Fußzeile (Standard: der Produktname). |
| `MAGAZIN_SPERRMUSTER_EXTRA` | Sync, Bau | weitere Sperrmuster als reguläre Ausdrücke, durch Zeilenumbruch getrennt. |

## Den Lese-Schlüssel anlegen

Der Schlüssel soll nichts können außer diese Sammlung lesen. Outline-API-Schlüssel haben die Rechte ihres Nutzers, deshalb ein eigener Nutzer:

1. In Outline einen neuen Nutzer einladen, z. B. „Magazin-Sync", mit einer eigenen E-Mail-Adresse (Weiterleitung genügt), Rolle **Gast**. Gäste sehen nur, was ihnen ausdrücklich freigegeben ist.
2. Gibt es die Rolle Gast in der Instanz nicht: Rolle **Betrachter** und dann bei jeder anderen Sammlung prüfen, ob der Standardzugriff für alle Mitglieder gilt. Betrachter sehen sonst jede Sammlung mit Mitgliederzugriff, also auch Strategie und Zugangsdaten. In dem Fall lieber auf ein Outline-Update warten als einen zu weiten Schlüssel ausstellen.
3. In der Magazin-Sammlung unter Freigabe den Nutzer mit **Kann ansehen** hinzufügen.
4. Als dieser Nutzer anmelden, Einstellungen → API → neuen Schlüssel erzeugen. Wenn Outline Bereiche (Scopes) anbietet: nur `documents.list`, `documents.info`, `documents.export`, `attachments.redirect` (Lesen).
5. Gegenprobe: Mit dem Schlüssel `POST /api/collections.list` aufrufen. Es darf genau eine Sammlung zurückkommen.
6. Schlüssel beim Hosting als Build-Variable `OUTLINE_MAGAZIN_TOKEN` eintragen (nicht als Laufzeitvariable nötig) und lokal nur in der Shell setzen, nie in eine Datei im Repo.

## Prüfen

```
cd app
npm run magazin:check
```

Baut zwei Beispielartikel plus einen präparierten (mit Schlüssel) und einen kaputten, prüft HTML-Gültigkeit, Skripte, canonical, Open Graph, JSON-LD, Sitemap, robots.txt, die Auslieferung über den echten nginx (falls installiert), axe, Kontrast, Zeilenlänge und waagerechtes Scrollen bei 1440 und 390 px, die Sperrliste in beide Richtungen und den Sync gegen eine nachgebaute Outline-API. Mit `MAGAZINCHECK_SHOTS=<ordner>` entstehen zusätzlich Bildschirmfotos.
