# CV-Hub — MCP-Server

Verbindet ein KI-Modell (Claude Desktop, Cursor, o. Ä.) über das **Model Context
Protocol** mit deinem CV-Hub-Konto. Das Modell kann deine Lebensläufe und
Anschreiben als **Markdown lesen, überarbeiten und zurückschreiben** — die
gleiche Markdown-Brücke, die auch im Editor steckt.

Im Tool selbst ist **keine KI eingebaut.** Der MCP-Server ist die programmatische
Variante der Markdown-Brücke und steht **nur registrierten Nutzern** offen
(Auth per persönlichem API-Key). Der Demo-Modus hat keine Schlüssel und ist
bewusst außen vor.

## 1. API-Key erzeugen

Im Konto anmelden → **Einstellungen → Schlüssel** → neuen Schlüssel erzeugen.
Der Schlüssel (beginnt mit `cvk_`) wird **nur einmal** angezeigt — sofort
kopieren. Widerrufen kannst du ihn jederzeit an gleicher Stelle.

## 2. Abhängigkeiten installieren

```bash
cd mcp
npm install
```

Benötigt Node.js ≥ 18 (nutzt das globale `fetch`).

## 3. In den MCP-Client eintragen

### Claude Desktop

`claude_desktop_config.json` (macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cv-hub": {
      "command": "node",
      "args": ["/ABSOLUTER/PFAD/zu/mcp/cv-mcp.mjs"],
      "env": {
        "CV_API_KEY": "cvk_dein_schluessel"
      }
    }
  }
}
```

### Cursor / andere Clients

Analog: Command `node`, Argument der absolute Pfad zu `cv-mcp.mjs`, und
`CV_API_KEY` als Umgebungsvariable.

Danach den Client neu starten.

## Gehosteter Betrieb (mehrbenutzerfähig)

Der Server läuft auch als Web-Dienst. Dann verbindet sich **jeder Nutzer deiner
Instanz** mit seinem eigenen KI-Client und sieht ausschließlich seine eigenen
Daten — niemand muss einen Schlüssel kopieren.

Im mitgelieferten `docker-compose.yml` ist der Dienst enthalten. Der Nutzer
trägt in seinem Client nur die Adresse ein:

```
https://deine-domain/mcp
```

Der Client registriert sich selbst (OAuth 2.1 mit Dynamic Client Registration
und PKCE), die Instanz öffnet sich, der Nutzer ist bereits angemeldet,
bestätigt einmal — fertig. Verbindungen lassen sich im Konto unter
*Einstellungen → Verbundene Apps* jederzeit beenden.

Warum OAuth und nicht einfach ein Token: Entfernte MCP-Clients verbinden sich
ausschließlich so. **Ein Feld für ein statisches Bearer-Token gibt es dort
nicht.**

> **`CV_API_KEY` im HTTP-Modus nicht setzen.** Er würde jeden Aufrufer zu
> demselben Konto machen — genau das, was der Mehrbenutzerbetrieb vermeidet.

## Umgebungsvariablen

| Variable         | Pflicht | Standard | Zweck |
|------------------|:-------:|----------|-------|
| `CV_API_KEY`     | nur stdio | – | Persönlicher Schlüssel (`cvk_…`). Im HTTP-Modus **nicht** setzen |
| `CV_API_BASE`    | nein | `http://localhost:8080/pdfapi` | API-Basis. HTTPS Pflicht, außer localhost oder ein Dienstname ohne Punkt im eigenen Netz |
| `MCP_HTTP`       | nur HTTP | – | `1` = gehosteter Web-Dienst statt stdio |
| `PORT`           | nein | `3000` | Port im HTTP-Modus |
| `MCP_PUBLIC_URL` | HTTP: empfohlen | Host-Header | Öffentliche Basis-Adresse. Steht im Wegweiser zum Anmeldedienst |
| `MCP_AUTH_BASE`  | nein | `<MCP_PUBLIC_URL>/oauth` | Öffentliche Adresse der OAuth-Endpunkte. Nur nötig, wenn ein Proxy dem Backend ein Pfadpräfix abschneidet — dann kann der Dienst seine eigene Adresse nicht kennen |

## Tools

| Tool                            | Zweck                                              |
|---------------------------------|----------------------------------------------------|
| `create_resume`                 | **Neuen** Lebenslauf anlegen (nie einen bestehenden überschreiben) |
| `rename_resume`                 | Anzeigenamen ändern                                |
| `list_resumes`                  | Alle Lebensläufe des Kontos auflisten (mit id)     |
| `get_resume_markdown`           | Lebenslauf als Markdown lesen                      |
| `update_resume_markdown`        | Überarbeitetes Lebenslauf-Markdown zurückschreiben |
| `get_cover_letter_markdown`     | Anschreiben als Markdown lesen                     |
| `update_cover_letter_markdown`  | Überarbeitetes Anschreiben zurückschreiben         |
| `list_templates`                | Verfügbare Design-Vorlagen auflisten               |
| `get_resume_settings`           | Vorlage, Sprache und Satz-Einstellungen lesen      |
| `update_resume_settings`        | Dieselben ändern                                   |
| `set_resume_photo`              | Profilfoto setzen                                  |
| `remove_resume_photo`           | Profilfoto entfernen                               |

Ein Profil führt **alle vier Sprachfassungen getrennt**. Die Markdown-Tools
arbeiten ohne Angabe auf der eingestellten Sprache; mit `lang` (`de`/`en`/`fr`/`es`)
auf einer anderen. Wer nur eine Fassung überarbeitet, lässt die übrigen
unverändert stehen — das fällt erst auf, wenn dort jemand exportiert. Eine
Übersetzung einzuspielen stellt die eingestellte Sprache des Profils nicht um.

Kein `delete_resume`: Löschen bleibt in der Oberfläche. Ein Werkzeug, mit dem
ein Modell Lebensläufe entfernen kann, ist ein schlechter Tausch gegen den
Komfort, den es bringt.

Die `update_*`-Tools legen serverseitig **vor jedem Speichern automatisch eine
Version** an — Fehlbearbeitungen lassen sich im Editor über die Versionshistorie
zurückrollen. Mit `dry_run: true` wird nur validiert, nichts gespeichert.

## Typischer Ablauf

1. „Liste meine Lebensläufe." → `list_resumes`
2. „Lies den Lebenslauf `<id>`." → `get_resume_markdown`
3. „Schärfe die Bullet Points im Berufserfahrungs-Teil, aktiv formuliert,
   quantifiziert." → Modell bearbeitet das Markdown
4. „Speichere das." → `update_resume_markdown`

## Sicherheit

- Der Schlüssel ist an dein Konto gebunden und hat genau deine Rechte.
- Serverseitig wird nur der **Hash** des Schlüssels gespeichert.
- Bei Verdacht: im Konto widerrufen — der MCP-Server verliert sofort den Zugriff.
