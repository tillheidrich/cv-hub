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

## Umgebungsvariablen

| Variable      | Pflicht | Standard                                   | Zweck                          |
|---------------|:-------:|--------------------------------------------|--------------------------------|
| `CV_API_KEY`  |   ja    | –                                          | Persönlicher Schlüssel (`cvk_…`) |
| `CV_API_BASE` |  nein   | `http://localhost:8080/pdfapi`    | API-Basis (für Self-Hosting)   |

## Tools

| Tool                            | Zweck                                              |
|---------------------------------|----------------------------------------------------|
| `list_resumes`                  | Alle Lebensläufe des Kontos auflisten (mit id)     |
| `get_resume_markdown`           | Lebenslauf als Markdown lesen                      |
| `update_resume_markdown`        | Überarbeitetes Lebenslauf-Markdown zurückschreiben |
| `get_cover_letter_markdown`     | Anschreiben als Markdown lesen                     |
| `update_cover_letter_markdown`  | Überarbeitetes Anschreiben zurückschreiben         |
| `list_templates`                | Verfügbare Design-Vorlagen auflisten               |

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
