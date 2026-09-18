# CV-Hub — MCP-Server

Verbindet ein KI-Modell (Claude Desktop, Cursor, o. Ä.) über das **Model Context
Protocol** mit deinem CV-Hub-Konto. Das Modell kann deine Lebensläufe und
Anschreiben als **Markdown lesen, überarbeiten und zurückschreiben** — die
gleiche Markdown-Brücke, die auch im Editor steckt.

Im Tool selbst ist **keine KI eingebaut.** Der MCP-Server ist die programmatische
Variante der Markdown-Brücke und steht **nur registrierten Nutzern** offen.
Der Demo-Modus ist bewusst außen vor.

## Zwei Wege — und für die meisten ist der erste richtig

### A. Gehostet: nur die Adresse eintragen (empfohlen)

Der Server läuft bereits auf derselben Domain wie das Werkzeug. Es gibt **nichts
zu installieren und keinen Schlüssel zu erzeugen** — der Client meldet sich
selbst an (OAuth 2.1 mit dynamischer Client-Registrierung und PKCE), du
bestätigst einmal im Browser.

```
https://DEINE-DOMAIN/mcp
```

Die genaue Adresse steht im
Werkzeug unter **Einstellungen → Verbundene Apps**, mit Kopierknopf.

**Claude Desktop** — Einstellungen → Connectors → „Custom connector hinzufügen",
Adresse einsetzen, im Browser bestätigen.

**Codex** — in `~/.codex/config.toml`:

```toml
[mcp_servers.heidrich-cv]
url = "https://DEINE-DOMAIN/mcp"
```

Danach einmal `codex mcp login heidrich-cv`. Codex unterstützt Remote-Server über
Streamable HTTP samt OAuth; ein `bearer_token_env_var` ist nicht nötig, weil die
Anmeldung über den Login-Befehl läuft.

**Cursor, Zed, VS Code und andere** — überall dort, wo ein MCP-Server mit *URL*
oder *Streamable HTTP* eingetragen wird, gehört diese Adresse hinein.

Erteilte Zugriffe stehen im Werkzeug unter **Einstellungen → Verbundene Apps**
und lassen sich dort einzeln beenden.

### B. Lokal über stdio (für Clients ohne Remote-Unterstützung)

Nur nötig, wenn der Client ausschließlich lokale Programme starten kann.

```bash
cd mcp && npm install     # Node.js >= 18
```

Dann einen persönlichen Schlüssel im Konto erzeugen (**Einstellungen →
Schlüssel**; beginnt mit `cvk_`, wird nur einmal angezeigt) und eintragen:

```json
{
  "mcpServers": {
    "heidrich-cv": {
      "command": "node",
      "args": ["/ABSOLUTER/PFAD/zu/mcp/cv-mcp.mjs"],
      "env": { "CV_API_KEY": "cvk_dein_schluessel" }
    }
  }
}
```

Derselbe Server läuft mit `MCP_HTTP=1` als HTTP-Dienst — so wird Variante A
betrieben (hinter `location /mcp` in `app/nginx.conf`).

## Umgebungsvariablen

| Variable      | Pflicht | Standard                                   | Zweck                          |
|---------------|:-------:|--------------------------------------------|--------------------------------|
| `CV_API_KEY`  | nur stdio | –                                        | Persönlicher Schlüssel (`cvk_…`) |
| `MCP_HTTP`    |  nein   | –                                          | `1` → HTTP-Dienst statt stdio  |
| `PORT`        |  nein   | `3000`                                     | Port im HTTP-Modus             |
| `CV_API_BASE` |  nein   | `https://DEINE-DOMAIN/pdfapi`    | API-Basis (für Self-Hosting)   |

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

- **Gehostet (A):** Der Client bekommt ein Token mit genau deinen Rechten, nie dein
  Passwort. Jede Verbindung steht namentlich unter *Einstellungen → Verbundene
  Apps* und ist dort einzeln zu beenden — der Zugriff endet sofort.
- **Lokal (B):** Der Schlüssel ist an dein Konto gebunden und hat genau deine
  Rechte. Serverseitig wird nur der **Hash** gespeichert. Bei Verdacht im Konto
  widerrufen.
- In beiden Fällen legen die `update_*`-Tools vor jedem Speichern eine Version
  an. Eine missratene Bearbeitung ist im Editor zurückzurollen, nicht verloren.
