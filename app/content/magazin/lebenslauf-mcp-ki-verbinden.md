---
title: "Claude direkt am Lebenslauf arbeiten lassen: MCP erklärt"
slug: "lebenslauf-mcp-ki-verbinden"
description: "So verbindest du Claude oder einen anderen KI-Assistenten per MCP mit deinem Lebenslauf, welche Assistenten das im November 2026 können und was die KI sieht."
category: "ki"
lang: de
updated: 2026-11-17
published: 2026-11-17
translationKey: "lebenslauf-mcp-ki-verbinden"
---

Mit MCP, dem Model Context Protocol, liest und bearbeitet dein KI-Assistent deinen Lebenslauf in CV-Hub direkt. Du bittest Claude, den Lebenslauf an eine Stellenanzeige anzupassen. Claude liest die aktuelle Fassung, schreibt die Änderungen zurück, und die Vorschau zeigt sie. Kopieren und Einfügen entfällt. Verbunden wird einmal: eine Adresse eintragen, im Browser bestätigen. Vor jeder Änderung legt der Server den vorherigen Stand ab, du kannst also zurück. Hier steht, wie das funktioniert, welche Assistenten es können und was die KI zu sehen bekommt.

## Was MCP ist

MCP ist ein offener Standard, über den KI-Assistenten fremde Werkzeuge benutzen. Ein MCP-Server bietet eine Reihe von Aktionen an, und der Assistent entscheidet, wann er sie aufruft. Der Server von CV-Hub bietet unter anderem:

- deine Lebensläufe auflisten und einen als Markdown lesen,
- einen überarbeiteten Lebenslauf oder ein Anschreiben aus Markdown speichern,
- Gestaltung lesen und ändern, etwa Vorlage oder Akzentfarbe,
- das Bewerbungsfoto setzen oder entfernen,
- einen neuen Lebenslauf anlegen oder umbenennen.

Der Assistent arbeitet mit demselben Markdown wie die Brücke im Editor: eine Überschrift je Abschnitt, eine Zeile je Feld, Stichpunkte je Station. Inhalte gehen auf Deutsch, Englisch, Französisch und Spanisch.

## Welche Assistenten das können (November 2026)

Ob eigene MCP-Server erlaubt sind, hängt vom Assistenten und vom Tarif ab und ändert sich oft. Stand 17.11.2026:

| Assistent | Eigene MCP-Server | Hinweise |
|---|---|---|
| Claude (claude.ai, Desktop-App) | Ja, in allen Tarifen | Im Gratis-Tarif ein eigener Connector. Hinzufügen im Web oder in der Desktop-App, danach auch am Handy nutzbar. Mit CV-Hub getestet. |
| ChatGPT | Entwicklermodus, nur bezahlte Tarife | OpenAIs Seiten sind sich nicht einig, welche bezahlten Tarife. Schreibende Aktionen musst du bestätigen. Mit CV-Hub nicht getestet. |
| Mistral Vibe (früher Le Chat) | Ja | Eigene MCP-Connectors mit OAuth. Nicht getestet. |
| Perplexity | Ja | Eigene Remote-Connectors; für welche Tarife, steht nicht auf der Hilfeseite. Nicht getestet. |
| Gemini | Nur in den USA | Eigene verbundene Apps für private Konten auf Englisch, nur USA. |
| VS Code und andere Entwicklerwerkzeuge | Ja | Adresse als HTTP-Server eintragen. |

Die Tabelle folgt der Dokumentation der Anbieter. „Nicht getestet“ heißt: Wir haben diesen Assistenten nicht selbst mit dem Server ausprobiert. Was Remote-MCP-Server mit OAuth unterstützt, sollte funktionieren.

## So verbindest du Claude

1. In Claude im Web oder in der Desktop-App „Customize“ öffnen, dann „Connectors“, auf „+ Add“ klicken und „Add custom connector“ wählen (Bezeichnungen der englischen Oberfläche). In Team- und Enterprise-Tarifen legt zuerst eine Inhaberin oder ein Inhaber den Connector unter „Organization settings“ an.
2. Die Adresse des MCP-Servers deiner Instanz eintragen, zum Beispiel `https://<deine-instanz>/mcp`.
3. Claude öffnet ein Browserfenster. In CV-Hub anmelden und den Zugriff bestätigen.
4. Im Chat zum Beispiel schreiben: „Lies meinen Lebenslauf und pass ihn an diese Stellenanzeige an: …“

Es gibt keinen Schlüssel zum Kopieren. Die Anmeldung läuft über OAuth, und in CV-Hub unter Einstellungen → Verbundene Apps siehst du jeden erteilten Zugriff und kannst ihn einzeln beenden.

## Was die KI sieht und wohin deine Daten gehen

Dein Lebenslauf liegt auf dem Server der Instanz, die du nutzt. Bittest du einen Assistenten, daran zu arbeiten, liest er ihn über MCP, und dieser Text geht dann an den KI-Anbieter, bei Claude an Anthropic, bei ChatGPT an OpenAI. Deren Server stehen überwiegend in den USA, und es gelten deren Datenschutzbedingungen. CV-Hub schickt von sich aus nichts an einen KI-Anbieter, das passiert nur, wenn du es in deinem Assistenten anstößt.

Überleg also, was die KI lesen soll. Für bessere Formulierungen braucht sie weder Kontaktdaten noch Foto. Wer das vermeiden will, arbeitet an einer Kopie ohne diese Angaben oder nimmt die Markdown-Brücke und fügt nur die Teile ein, die überarbeitet werden sollen.

## Das Sicherheitsnetz: Versionen

Bevor ein Assistent über MCP Inhalt oder Gestaltung ändert, legt der Server den vorherigen Stand als Version ab. Die letzten 25 Versionen kannst du im Editor wiederherstellen. Lies trotzdem nach, was sich geändert hat: Eine KI kann einen Satz flüssiger machen und dabei eine Tatsache verdrehen. Wie du das prüfst, steht in [Lebenslauf mit KI schreiben, ohne dass etwas erfunden wird](/magazin/lebenslauf-mit-ki-schreiben-ohne-erfindungen/).

## Was du brauchst

MCP braucht ein Konto, denn der Assistent muss wissen, an wessen Lebenslauf er arbeitet. Bietet die Instanz den optionalen Bewerbungs-Pass an, gehört die direkte Verbindung dazu. Ohne Konto geht dasselbe von Hand: Lebenslauf als Markdown exportieren, in einen beliebigen Chat einfügen, Ergebnis wieder einlesen. Bevor etwas übernommen wird, zeigt das Werkzeug, was sich geändert hat.

CV-Hub ist quelloffen. Wer eine eigene Instanz betreibt, bekommt den MCP-Server mit, unter `https://<deine-instanz>/mcp`. [Zu CV-Hub](/).

## Häufige Fragen

### Kann ChatGPT meinen Lebenslauf per MCP bearbeiten?

Laut OpenAIs Dokumentation unterstützt ChatGPT eigene MCP-Server im Entwicklermodus der bezahlten Tarife, schreibende Aktionen musst du bestätigen. Mit CV-Hub haben wir ChatGPT nicht getestet. Claude ist getestet, und eigene Connectors gibt es in allen Claude-Tarifen.

### Geht MCP auch im kostenlosen Claude-Tarif?

Ja. Im Gratis-Tarif kannst du laut Anthropics Hilfe-Center einen eigenen Connector hinzufügen (Stand November 2026).

### Wird mein Lebenslauf an den KI-Anbieter geschickt?

Nur die Teile, die der Assistent liest, und nur, wenn du ihn darum bittest. Diesen Text verarbeitet der KI-Anbieter nach seinen eigenen Datenschutzbedingungen. Gespeichert bleibt der Lebenslauf auf dem Server der Instanz.

### Kann die KI meinen Lebenslauf kaputt machen?

Sie kann ungewollt ändern, aber nicht endgültig. Vor jeder Änderung über MCP speichert der Server eine Version, und die letzten 25 kannst du wiederherstellen.

## Quellen

Alle Quellen abgerufen am 17.11.2026.

- Model Context Protocol: Einführung. https://modelcontextprotocol.io/
- Anthropic Help Center: „Get started with custom connectors using remote MCP“. https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- OpenAI: Entwicklermodus und MCP-Connectors. https://developers.openai.com/api/docs/guides/developer-mode.md
- OpenAI Help Center: „Developer mode, apps and full MCP connectors in ChatGPT“. https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt
- Mistral: MCP-Connectors in Vibe (früher Le Chat). https://docs.mistral.ai/le-chat/knowledge-integrations/connectors/mcp-connectors
- Perplexity Help Center: „Adding custom remote connectors“. https://www.perplexity.ai/help-center/en/articles/13915507-adding-custom-remote-connectors
- Google Gemini-Hilfe: eigene verbundene Apps. https://support.google.com/gemini/answer/17209137?hl=en
- Visual Studio Code: MCP-Server. https://code.visualstudio.com/docs/copilot/customization/mcp-servers
