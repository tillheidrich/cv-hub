# So funktioniert der Ratgeber

Der Ratgeber sind die Artikel unter `/ratgeber/` auf der Website der eigenen Instanz. Geschrieben wird wahlweise direkt im Repo oder in einem Wiki (Outline), veröffentlicht wird über das Repo: Jeder Artikel liegt als Markdown-Datei in diesem Ordner, und beim Bau entstehen daraus statische HTML-Seiten. Es gibt kein CMS und keinen zusätzlichen Dienst auf dem Server.

```
Outline-Sammlung „Ratgeber (öffentlich)" (optional)
        │  npm run ratgeber:sync   (nur veröffentlichte Dokumente, Sperrliste)
        ▼
app/content/ratgeber/<slug>.md      ← Quelle der Wahrheit für die Website
        │  npm run build  →  scripts/ratgeber-build.mjs
        ▼
dist/ratgeber/<slug>/index.html, dist/ratgeber/index.html, sitemap.xml, robots.txt
```

## Einen Artikel veröffentlichen

1. **In Outline schreiben**, in einer eigenen, nur für den Ratgeber angelegten Sammlung (hier „Ratgeber (öffentlich)" genannt). Der Titel des Dokuments wird der Titel des Artikels. Keine H1 im Text, Zwischenüberschriften als H2/H3.
2. **Beschreibung festlegen (empfohlen):** Die erste Zeile des Dokuments darf lauten `Beschreibung: …` (höchstens etwa 155 Zeichen). Sie wird zur `meta description` und zum Vorspann und aus dem Text entfernt. Fehlt sie, bleibt eine schon vorhandene Beschreibung stehen; bei neuen Artikeln wird der erste Absatz gekürzt.
3. **Veröffentlichen** in Outline. Entwürfe werden nie übernommen. Zurückziehen (Veröffentlichung aufheben, archivieren, löschen) nimmt den Artikel beim nächsten Sync wieder von der Website.
4. **Übernehmen**, einer von zwei Wegen:
   - *Lokal:* `cd app && OUTLINE_URL=https://wiki.example.com OUTLINE_RATGEBER_TOKEN=… OUTLINE_RATGEBER_COLLECTION=<Sammlungs-ID> npm run ratgeber:sync`, die geänderten Dateien in `content/ratgeber/` (und `public/ratgeber/img/`) prüfen und committen. Danach normal deployen.
   - *Direkt beim Bau:* Sind `OUTLINE_URL`, `OUTLINE_RATGEBER_TOKEN` und `OUTLINE_RATGEBER_COLLECTION` als **Build-Variablen** (Docker `--build-arg`) gesetzt, holt das Dockerfile die Artikel vor jedem Bau selbst. Dann reicht ein neuer Bau. Wichtig: Ohne Code-Änderung nimmt Docker sonst den alten Bau aus dem Cache. Deshalb ohne Cache bauen (`docker build --no-cache`, bei Hosting-Oberflächen die entsprechende Option).
5. **Prüfen:** `https://<domain>/ratgeber/` und der Artikel. Was der Sync gesperrt oder übersprungen hat, steht im Bau-Log unter `[ratgeber:sync]` bzw. `[ratgeber:build]`.

In diesem Repository liegt nur ein Beispielartikel (`example-guide.md`, ohne `outlineId`). Er zeigt das Format und gibt dem Bau etwas zu zeigen; löschen oder ersetzen. Der Bau funktioniert auch mit null Artikeln (leere Übersicht).

Ein Dokument mit dem Titel **„So funktioniert der Ratgeber"** (diese Anleitung) wird vom Sync immer übersprungen, auch wenn es versehentlich veröffentlicht ist.

## Was in Outline geht

- Überschriften, Absätze, Listen, Aufgabenlisten, Zitate, Tabellen, Codeblöcke, Links, Hervorhebungen, Markierungen (`==…==`) und Hinweiskästen (Info, Tipp, Warnung).
- **Bilder:** in Outline hochladen (Anhang). Der Sync lädt sie herunter nach `public/ratgeber/img/` (PNG, JPEG, GIF, WebP, AVIF, höchstens 5 MB; SVG absichtlich nicht). Bilder von fremden Adressen werden entfernt. Eine Bildunterschrift in Outline wird zum Alternativtext: bitte immer setzen.
- **Verweise auf andere Ratgeber-Artikel** in derselben Sammlung werden zu `/ratgeber/<slug>/`. Verweise auf andere Wiki-Seiten werden zu reinem Text.
- Rohes HTML wird nie übernommen.

## Was nie in die Sammlung gehört

Alles in dieser Sammlung ist dafür gedacht, öffentlich zu werden. Deshalb nie:

- Zugangsdaten, Passwörter, API-Schlüssel und Token (auch nicht „nur als Beispiel"), Mollie-Schlüssel, `cvk_…`/`cvm_…`-Schlüssel dieser App
- interne Adressen: das Wiki selbst, Git, Hosting-Oberfläche, Server-IPs, `localhost`, `sslip.io`, Intranet
- E-Mail-Adressen außer der aus dem Impressum (Beispieladressen bitte mit `@example.com`)
- Kundendaten, Namen aus Projekten, Notizen aus der Strategie

Der Sync prüft jedes Dokument vor dem Schreiben gegen eine Sperrliste (`app/scripts/ratgeber-sperrmuster.mjs`) und der Bau prüft jede Datei noch einmal. Ein Treffer hält **nur dieses** Dokument zurück; eine früher übernommene, saubere Fassung bleibt online. Im Log steht, welche Regel in welcher Zeile angeschlagen hat (der gefundene Wert nur gekürzt). Die Sperrliste ist ein Netz, kein Freibrief: Sie findet Muster, keine vertraulichen Inhalte in ganzen Sätzen.

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
| `slug` | ja | Adresse `/ratgeber/<slug>/`, muss dem Dateinamen entsprechen; nur `a-z`, `0-9`, Bindestrich. Bleibt beim Sync gleich, auch wenn sich der Titel ändert, damit geteilte Links gültig bleiben. |
| `description` | ja | `meta description` und Vorspann, etwa 50 bis 155 Zeichen. |
| `lang` | ja | `de`, `en`, `fr` oder `es`; bestimmt Sprache der Seite und der festen Texte. |
| `updated` | ja | `JJJJ-MM-TT`; Anzeige, `dateModified` im JSON-LD, `lastmod` in der Sitemap. |
| `outlineId` | nein | ID des Outline-Dokuments. Nur Dateien **mit** `outlineId` gleicht der Sync ab (schreibt sie neu oder löscht sie, wenn das Dokument nicht mehr veröffentlicht ist). Dateien ohne `outlineId` fasst der Sync nie an. |
| `published` | nein | erstes Erscheinen, `datePublished` im JSON-LD (sonst `updated`). |

Werte dürfen in doppelten Anführungszeichen (JSON-Regeln), einfachen Anführungszeichen oder ohne stehen. Andere Felder, Listen und mehrzeilige Werte sind nicht vorgesehen. Dateien, die mit `_` oder `.` beginnen, und diese README werden nicht veröffentlicht.

## Was der Bau erzeugt

- je Artikel `dist/ratgeber/<slug>/index.html` mit `<title>`, `meta description`, `canonical`, Open Graph, JSON-LD `Article` (mit `dateModified`), Inhaltsverzeichnis ab vier Zwischenüberschriften (oder ab 900 Wörtern mit mindestens zwei)
- `dist/ratgeber/index.html` (Übersicht, neueste zuerst), `dist/ratgeber/404.html`
- `dist/sitemap.xml` (Startseite, `/preise`, Übersicht, alle Artikel) und `dist/robots.txt` (aus `public/robots.txt`, Sitemap-Zeile neu)
- `dist/ratgeber/assets/`: CSS und die Schrift Geist, selbst ausgeliefert, mit Inhalts-Hash im Namen

Die Seiten haben kein ausführbares JavaScript und laden nichts von fremden Servern. nginx liefert `/ratgeber/` mit eigener, strenger CSP aus, unbekannte Artikel bekommen eine echte 404 statt der App (`app/nginx.conf`).

Fehlerhafte Dateien (Frontmatter, Sperrliste, doppelter Slug) überspringt der Bau mit einer Warnung; die App wird trotzdem gebaut. `npm run ratgeber:check` macht aus denselben Befunden einen Fehlschlag.

## Umgebungsvariablen

| Variable | Wo | Wozu |
|----------|----|------|
| `PUBLIC_BASE_URL` | Bau | Basis für `canonical`, `og:url`, Sitemap und robots.txt. Standard `https://cv.example.com`, also für jede echte Instanz setzen (in `docker-compose.yml` aus `APP_BASE_URL`). Bei einem Domainwechsel nur diese Variable ändern. |
| `OUTLINE_URL` | Sync | Adresse des Wikis ohne `/api`, z. B. `https://wiki.example.com`. |
| `OUTLINE_RATGEBER_TOKEN` | Sync | API-Schlüssel mit **nur Lesezugriff auf diese eine Sammlung** (siehe unten). Ohne ihn tut der Sync nichts. |
| `OUTLINE_RATGEBER_COLLECTION` | Sync | ID der Ratgeber-Sammlung in der eigenen Instanz. Pflicht für den Sync; eine Vorgabe gibt es nicht. |
| `RATGEBER_LANG` | Bau | Sprache der Übersicht (`de`, `en`, `fr`, `es`), Standard `en`. |
| `PUBLIC_SITE_NAME`, `PUBLIC_PUBLISHER` | Bau | Produktname (Standard `VITE_APP_NAME`, sonst „CV-Hub") und Herausgeber im JSON-LD und in der Fußzeile (Standard: der Produktname). |
| `RATGEBER_SPERRMUSTER_EXTRA` | Sync, Bau | weitere Sperrmuster als reguläre Ausdrücke, durch Zeilenumbruch getrennt. |

## Den Lese-Schlüssel anlegen

Der Schlüssel soll nichts können außer diese Sammlung lesen. Outline-API-Schlüssel haben die Rechte ihres Nutzers, deshalb ein eigener Nutzer:

1. In Outline einen neuen Nutzer einladen, z. B. „Ratgeber-Sync", mit einer eigenen E-Mail-Adresse (Weiterleitung genügt), Rolle **Gast**. Gäste sehen nur, was ihnen ausdrücklich freigegeben ist.
2. Gibt es die Rolle Gast in der Instanz nicht: Rolle **Betrachter** und dann bei jeder anderen Sammlung prüfen, ob der Standardzugriff für alle Mitglieder gilt. Betrachter sehen sonst jede Sammlung mit Mitgliederzugriff, also auch Strategie und Zugangsdaten. In dem Fall lieber auf ein Outline-Update warten als einen zu weiten Schlüssel ausstellen.
3. In der Ratgeber-Sammlung unter Freigabe den Nutzer mit **Kann ansehen** hinzufügen.
4. Als dieser Nutzer anmelden, Einstellungen → API → neuen Schlüssel erzeugen. Wenn Outline Bereiche (Scopes) anbietet: nur `documents.list`, `documents.info`, `documents.export`, `attachments.redirect` (Lesen).
5. Gegenprobe: Mit dem Schlüssel `POST /api/collections.list` aufrufen. Es darf genau eine Sammlung zurückkommen.
6. Schlüssel beim Hosting als Build-Variable `OUTLINE_RATGEBER_TOKEN` eintragen (nicht als Laufzeitvariable nötig) und lokal nur in der Shell setzen, nie in eine Datei im Repo.

## Prüfen

```
cd app
npm run ratgeber:check
```

Baut zwei Beispielartikel plus einen präparierten (mit Schlüssel) und einen kaputten, prüft HTML-Gültigkeit, Skripte, canonical, Open Graph, JSON-LD, Sitemap, robots.txt, die Auslieferung über den echten nginx (falls installiert), axe, Kontrast, Zeilenlänge und waagerechtes Scrollen bei 1440 und 390 px, die Sperrliste in beide Richtungen und den Sync gegen eine nachgebaute Outline-API. Mit `RATGEBERCHECK_SHOTS=<ordner>` entstehen zusätzlich Bildschirmfotos.
