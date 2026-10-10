---
title: "Lebenslauf als PDF oder Word?"
slug: "lebenslauf-pdf-oder-word"
description: "Wann PDF, wann Word: was Bewerbersysteme annehmen, wie du die Textebene deines PDFs selbst prüfst und worauf es bei Dateiname und Größe ankommt."
category: "bewerbung"
lang: de
updated: 2026-10-10
---

Schick ein PDF, wenn in der Anzeige nichts anderes steht. Halte eine Word-Fassung bereit, wenn ein Portal sie verlangt oder wenn du über eine Personalvermittlung gehst. Wichtiger als das Format ist, dass in der Datei echter, auslesbarer Text steckt. Das kannst du in einer Minute selbst prüfen.

## Was Bewerbersysteme annehmen

Die Hersteller legen offen, welche Formate ihre Systeme verarbeiten. Das ist verlässlicher als jede Faustregel.

| System | Formate | Größe | Quelle |
|---|---|---|---|
| Greenhouse | .doc, .docx, .pdf, .rtf, .txt | Hochladen bis 100 MB, Auslesen nur bis 2,5 MB | Greenhouse-Hilfe, Stand 19.08.2026 und 02.03.2026 |
| Personio | PDF oder DOCX | bis 10 MB je Dokument | Personio-Hilfe, Stand 14.07.2026 |
| Textkernel (Parser, den u. a. Personio nutzt) | über 70 Formate, darunter PDF, DOC, DOCX, ODT, RTF | keine Angabe | Textkernel-Dokumentation |

PDF und DOCX gehen also praktisch überall. Ältere oder seltenere Formate wie .doc oder .odt nehmen nicht alle Systeme an, Personio etwa nur PDF und DOCX. Sie sind deshalb keine gute Wahl.

Roche schreibt auf seiner Karriereseite, .docx sei das Format, das Bewerbermanagement-Systeme am genauesten auslesen, PDF halte dagegen das Layout besser. Word ist für die Maschine also oft etwas leichter, PDF zeigt dem Menschen genau das, was du gestaltet hast.

## Wann PDF die bessere Wahl ist

Ein PDF sieht auf jedem Rechner gleich aus. Schriften sind eingebettet, Seitenumbrüche stehen fest, nichts verrutscht, weil jemand eine andere Word-Version oder einen Mac nutzt. Wer deinen Lebenslauf am Bildschirm oder ausgedruckt liest, sieht also, was du gesehen hast.

Nimm PDF:

- für E-Mail-Bewerbungen, wenn nichts anderes verlangt ist,
- für Bewerbungsportale, die PDF ausdrücklich annehmen,
- wenn dir Gestaltung und Seitenaufteilung wichtig sind.

Die Bundesagentur für Arbeit empfiehlt in einem Handout zur E-Mail-Bewerbung, Anschreiben, Lebenslauf und Zeugnisse in einer einzigen PDF-Datei zu verschicken. Bei Portalen mit eigenen Feldern für Lebenslauf und Anlagen lädst du die Teile dagegen einzeln hoch.

## Wann Word sinnvoll ist

### Wenn es verlangt wird

Steht in der Anzeige oder im Portal „bitte als Word-Datei“, schick Word. Diskutieren lohnt sich nicht.

### Bei Personalvermittlungen

Vermittler geben deinen Lebenslauf an ihre Kunden weiter, oft im eigenen Firmenlayout und teils ohne deine Kontaktdaten. Dafür brauchen sie eine Datei, die sie bearbeiten können. Es gibt eigene Software, die genau das macht: Lebensläufe einlesen und in die Vorlage der Agentur umformatieren. Mit einem PDF geht das schlechter.

### Wenn ein System auffällig schlecht ausliest

Bekommst du nach dem Hochladen ein Formular, in dem Name, Stationen oder Daten durcheinander sind, probier dieselbe Bewerbung mit der Word-Fassung. Eine einspaltige, schlichte Word-Datei ist für viele Parser das einfachste Material.

Bei Word gehören Name und Kontaktdaten in den normalen Text, nicht in die Kopfzeile und nicht in ein Textfeld. Greenhouse, Personio und Roche nennen das übereinstimmend als Fehlerquelle. Viele schöne Word-Vorlagen arbeiten genau mit Textfeldern.

## Die Textebene prüfen: so testest du dein PDF selbst

Ein PDF kann Text enthalten oder nur ein Bild von Text. Ein Bewerbersystem braucht Text. Personio nennt als Fehlerquelle ausdrücklich „The CV is a scanned file, rather than an original PDF file.“ Textkernel verarbeitet Scans nur mit einer zusätzlichen Texterkennung (OCR), die der Arbeitgeber gebucht haben muss.

### Test 1: Markieren und kopieren

1. Öffne dein PDF in einem normalen PDF-Programm oder im Browser.
2. Drück Strg+A (am Mac Cmd+A). Lässt sich gar nichts markieren, ist dein PDF ein Bild. Dann musst du es aus der Originaldatei neu erzeugen.
3. Kopiere alles und füge es in einen einfachen Texteditor ein (Editor unter Windows, TextEdit im Modus „Reiner Text“ am Mac).

Jetzt schau genau hin:

- Steht dein Name ganz oben? Bei Vorlagen mit Seitenspalte landet manchmal erst der Inhalt der Spalte im Text.
- Sind E-Mail-Adresse und Links in einem Stück? Bricht die Adresse im Layout um, kann sie im Text zerrissen ankommen, mit Leerzeichen oder ohne Bindestrich.
- Stimmt die Reihenfolge? Jobtitel, Firma und Zeitraum sollten zusammenstehen und nicht über die Seite verstreut sein.
- Sind Wörter vollständig? Achte auf Umlaute, auf Buchstabenpaare wie „fi“ und „fl“ und auf Überschriften mit großem Buchstabenabstand. Greenhouse nennt Leerzeichen zwischen Buchstaben als Grund für falsches Auslesen. Aus „P R O F I L“ wird für die Maschine kein Wort.

### Test 2: pdftotext

Wer es genauer wissen will, nimmt pdftotext. Das kleine Kommandozeilenprogramm gehört zu Poppler, ist unter Linux meist schon installiert und für macOS und Windows erhältlich. Laut Handbuch gibt es den Text standardmäßig ohne das Seitenlayout aus und versucht, „output the text in reading order“. Das kommt dem nahe, was ein Parser als Rohmaterial sieht.

```
pdftotext lebenslauf.pdf -
```

Der Bindestrich am Ende schreibt den Text direkt ins Terminal. Mit der Option `-layout` siehst du zum Vergleich, wie das Programm die Spalten räumlich anordnet. Unterscheiden sich beide Ausgaben stark, liegt das meist an Spalten oder Tabellen.

Ein sauberes Ergebnis in diesem Test ist keine Garantie für jedes System, denn jeder Parser arbeitet etwas anders. Ein schlechtes Ergebnis ist aber ein sicheres Warnzeichen.

### Und die Word-Datei?

In Word kannst du den gleichen Test machen: über „Speichern unter“ eine Kopie als „Nur Text (.txt)“ speichern und die Datei öffnen. Alles, was in Textfeldern oder in der Kopfzeile stand, fehlt dann häufig oder steht an einer unerwarteten Stelle.

## Dateiname

Der Dateiname ist das Erste, was jemand sieht, bevor er die Datei öffnet. Die Bundesagentur für Arbeit schlägt in ihrem Handout ein Schema wie „Bewerbung_[Vorname]_[Nachname]_Stellenbezeichnung“ vor. Für den Lebenslauf allein bietet sich entsprechend „Lebenslauf_Vorname_Nachname.pdf“ an.

Was nicht in den Dateinamen gehört: „final“, „neu“, „v3“, das Datum deiner letzten Änderung oder der Name eines anderen Arbeitgebers. Wer die Datei bekommt, legt sie mit hundert anderen ab. Dein Name darin hilft, sie wiederzufinden. Umlaute und Sonderzeichen machen in manchen Portalen und Mailprogrammen Probleme. Sicherer sind „ae“, „oe“ und „ue“ und Unterstriche statt Leerzeichen.

## Dateigröße

Ein Lebenslauf ohne Foto ist meist nur einige Hundert Kilobyte groß. Mit Foto wird er schnell größer, vor allem, wenn das Bild in voller Kameraauflösung eingefügt wurde.

Die Grenzen, die wir bei Herstellern gefunden haben:

- Greenhouse liest Lebensläufe über 2,5 MB nicht mehr aus, obwohl das Hochladen bis 100 MB klappt.
- Personio nimmt bis 10 MB je Dokument an.
- Die Bundesagentur für Arbeit empfahl in ihrem Handout von 2017 für die gesamte E-Mail-Bewerbung 3 bis 5 MB, sofern die Anzeige nichts anderes sagt.

Als Faustregel: Halte den Lebenslauf allein deutlich unter 2,5 MB. Wird er größer, verkleinere das Foto vor dem Einfügen auf die Größe, in der es gedruckt wird. Ein Passbild braucht keine 4.000 Pixel Breite. Zeugnisse, die du einscannst, bekommen eine eigene Datei oder kommen in die Gesamt-PDF für die E-Mail, nicht in die Lebenslauf-Datei, die ein Portal auslesen soll.

## So geht es mit CV-Hub

In CV-Hub lädst du ein PDF mit echter Textebene herunter, dessen Seiten genau denen der Vorschau entsprechen. Word gibt es in zwei Fassungen: mit dem Design deiner Vorlage und einspaltig ohne Tabellen für Portale. Zu jeder Vorlage gibt es außerdem die einspaltige ATS-Fassung als PDF oder Word. Kontaktdaten stehen in allen Vorlagen im normalen Text, nicht in der Kopfzeile. Unter „Prüfen“ zeigt die Textansicht, was in deinem exportierten PDF steht, ohne dass du pdftotext installieren musst. Ausprobieren geht ohne Konto: [zu CV-Hub](/).

## Quellen

Alle Quellen abgerufen am 09.10.2026.

- Greenhouse Support: „Supported formats for resumes, cover letters, and other candidate uploads“, Stand 19.08.2026. https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads
- Greenhouse Support: „Unsuccessful resume parse“, Stand 02.03.2026. https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse
- Personio Support: „CV parsing for candidate profiles“, Stand 14.07.2026. https://support.personio.de/hc/en-us/articles/360010193018
- Textkernel Developer Documentation: „File formats“. https://developer.textkernel.com/TKPlatform/master/file-formats
- Roche Karriere: FAQ zum Lebenslauf-Parsing. https://careers.roche.com/de/de/resume-parsing-faq
- Bundesagentur für Arbeit: Handout „E-Mail-Bewerbung, so geht's“, 22.06.2017. https://www.arbeitsagentur.de/vor-ort/datei/mailbewerbung_ba250712.pdf
- Poppler: Handbuchseite pdftotext(1), Debian. https://manpages.debian.org/trixie/poppler-utils/pdftotext.1.en.html
- Daxtra: Produktseite zur Umformatierung von Lebensläufen für Personalvermittler (Anbieter, nur als Beleg für diese Praxis). https://www.daxtra.com/products/resume-formatting-anonymizing-software/
