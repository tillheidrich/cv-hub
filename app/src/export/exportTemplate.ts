// ── Die Vorlage ohne die Daten ──────────────────────────────────────────────
//
// Till: „Ich möchte halt wirklich die größtmögliche Freiheit haben."
//
// Dieser Export ist der Ausgang aus dem Editor. Er liefert das Design als
// eigenständige Dateien, mit Platzhaltern statt Inhalt, plus alles, was eine
// KI oder ein Mensch braucht, um sie zu füllen — und den Weg zurück: dieselbe
// JSON-Datei lädt das Werkzeug wieder ein und macht daraus ein PDF.
//
// Bewusst KEIN eigenes Vorlagenformat. Was hier herauskommt, ist dasselbe
// HTML, das auch das PDF erzeugt, und dasselbe JSON, das der Import liest.
// Ein zweiter Satz Dateien, der auseinanderlaufen kann, wäre der Anfang vom
// Ende der Verlässlichkeit.

import JSZip from 'jszip';
import { saveBlob } from './saveFile';
import { Packer } from 'docx';
import type { CVData, Lang } from '../data/types';
import { LABELS } from '../data/labels';
import { buildResumeHtmlForTest, type ExportRenderConfig } from './exportHtml';
import { buildDocx } from './exportDocx';
import { getTheme } from '../templates/theme';

/** Platzhalter in doppelten geschweiften Klammern — das Format, das jede KI
 *  und jede Template-Engine ohne Erklärung versteht. */
const T = (p: string) => `{{${p}}}`;

/** Ein Lebenslauf, der nur aus Platzhaltern besteht. Struktur und Umfang
 *  entsprechen einem realistischen Einseiter: drei Stationen, zwei
 *  Abschlüsse, zwei Skill-Gruppen, zwei Sprachen. Wer mehr braucht, hängt im
 *  JSON weitere Einträge an — die Vorlage wächst mit. */
export function placeholderCV(lang: Lang): CVData {
  const exp = (n: number) => ({
    id: `e${n}`,
    role: T(`experience[${n - 1}].role`),
    company: T(`experience[${n - 1}].company`),
    location: T(`experience[${n - 1}].location`),
    start: T(`experience[${n - 1}].start`),
    end: T(`experience[${n - 1}].end`),
    bullets: [0, 1, 2].map(b => T(`experience[${n - 1}].bullets[${b}]`)),
  });
  return {
    personal: {
      name: T('personal.name'),
      title: T('personal.title'),
      location: T('personal.location'),
      email: T('personal.email'),
      phone: T('personal.phone'),
      website: T('personal.website'),
      socials: [{ id: 's1', platform: 'linkedin', value: T('personal.socials[0].value') }],
      birthDate: T('personal.birthDate'),
      nationality: T('personal.nationality'),
    },
    profile: { text: T('profile.text') },
    experience: [exp(1), exp(2), exp(3)],
    education: [1, 2].map(n => ({
      id: `b${n}`,
      degree: T(`education[${n - 1}].degree`),
      institution: T(`education[${n - 1}].institution`),
      start: T(`education[${n - 1}].start`),
      end: T(`education[${n - 1}].end`),
    })),
    skillGroups: [1, 2].map(n => ({
      label: T(`skillGroups[${n - 1}].label`),
      items: [0, 1, 2, 3].map(i => T(`skillGroups[${n - 1}].items[${i}]`)),
    })),
    languages: [1, 2].map(n => ({
      language: T(`languages[${n - 1}].language`),
      level: T(`languages[${n - 1}].level`),
      dots: 4,
    })),
    additionalExperience: [0, 1].map(i => T(`additionalExperience[${i}]`)),
    labels: LABELS[lang],
  };
}

/** Leerer Datensatz in der Form, die der Import liest. Wer ihn ausfüllt und
 *  wieder hochlädt, bekommt sein PDF — ohne je den Editor zu benutzen. */
function emptyData(lang: Lang): unknown {
  const p = placeholderCV(lang);
  const blank = (o: unknown): unknown => {
    if (typeof o === 'string') return /^\{\{.*\}\}$/.test(o) ? '' : o;
    if (Array.isArray(o)) return o.map(blank);
    if (o && typeof o === 'object') {
      return Object.fromEntries(Object.entries(o as Record<string, unknown>).map(([k, v]) => [k, blank(v)]));
    }
    return o;
  };
  return blank(p);
}

function anleitung(themeName: string, themeId: string, lang: Lang): string {
  const L = LABELS[lang];
  return `# Vorlage „${themeName}" — ohne Daten

Diese Dateien sind das Design, nicht dein Lebenslauf. Sie gehören dir; du
brauchst dieses Werkzeug nicht, um sie zu benutzen.

## Was hier drin ist

| Datei | Wofür |
|---|---|
| \`vorlage.html\` | Das Design als eigenständige Datei, mit Platzhaltern statt Inhalt. Im Browser zu lesen; zum Drucken siehe unten. |
| \`vorlage.docx\` | Dasselbe als Word-Datei mit echten Formatvorlagen (Überschrift 1/2, Aufzählung). Öffnet in Word **und** LibreOffice. |
| \`daten.json\` | Leeres Formular in genau der Form, die dieses Werkzeug wieder einliest. |
| \`beispiel.json\` | Dasselbe, ausgefüllt — als Muster. |
| \`ANLEITUNG.md\` | Diese Datei. |

## Der schnelle Weg

1. \`daten.json\` ausfüllen (oder von einer KI ausfüllen lassen, siehe unten).
2. Im Werkzeug unter **Export → Importieren** hochladen.
3. Vorlage „${themeName}" wählen, PDF exportieren.

## Der freie Weg — ohne dieses Werkzeug

\`vorlage.html\` in einem Editor öffnen und jeden Platzhalter \`{{…}}\` durch
deinen Text ersetzen. Die Namen entsprechen \`daten.json\`, also steht
\`{{experience[0].role}}\` für die Position deiner ersten Station.

Zum Drucken: Der Satz auf dem Blatt ist derselbe wie im Werkzeug — es ist
dieselbe Datei. Was darum herum passiert, entscheidet aber der Druckdialog
deines Browsers, nicht die Datei. Stelle deshalb **Ränder: Keine**,
**Hintergrundgrafiken: An** und **Kopf- und Fußzeilen: Aus** ein, sonst
bekommst du weiße Kanten und die Adresse der Datei quer über der Vorlage.
Chrome und Firefox können das; Safari hält sich nicht an alle drei — dort
bleibt ein Rand. Wer ein Blatt ohne Wenn und Aber braucht, exportiert das PDF
aus dem Werkzeug.

## Für eine KI

Wenn du dieses Verzeichnis einer KI gibst, reicht dieser Auftrag:

> Fülle \`daten.json\` aus meinem Lebenslauf unten aus. Halte dich an die
> vorhandene Struktur, erfinde keine Felder, lass unbekannte Felder leer
> (\`""\`). Schreibe Stichpunkte als abgeschlossene Sätze ohne Punkt am Ende,
> je 100–160 Zeichen. Gib nur die JSON-Datei zurück.

Ein paar Regeln, die in diesem Design stecken und die du nicht brechen
solltest — sie sind gemessen, nicht geraten:

* **Sperrung höchstens 0,08 em.** Ab 0,11 em zerlegt die Textebene eines PDF
  gesperrte Versalzeilen in Einzelbuchstaben („B E R U F S E R F A H R U N G"),
  und genau an diesen Zeilen teilt ein Bewerbungssystem den Lebenslauf in
  Abschnitte. Gilt unabhängig von der Schriftgröße.
* **Schrift nicht unter 8,4 pt.** Kleinere Größen sind als Parsing-Ursache
  dokumentiert (Personio) — und niemand liest sie gern.
* **Die Reihenfolge im Textstrom ist nicht die Reihenfolge auf dem Papier.**
  In dieser Vorlage steht der Name im HTML VOR der Seitenspalte, auch wenn er
  optisch daneben liegt. Ein Parser ohne Layoutanalyse liest die HTML-Folge.
  Wenn du Blöcke verschiebst, verschiebe sie im Kopf mit.
* **Kein unsichtbarer Text.** Keine weiße Schrift auf Weiß, keine
  ausgeblendeten Schlagwortlisten. Danach suchen Spamfilter.

## Feldnamen

Die Beschriftungen (\`labels\`) sind Teil der Daten, nicht des Designs. Wer
„${L.sections.experience}" lieber anders nennt, ändert es dort — in
\`daten.json\` unter \`labels.sections.experience\`.

---

Vorlage: \`${themeId}\` · Sprache der Beschriftungen: \`${lang}\` ·
Erzeugt mit CV-Hub.
`;
}

/** Baut das Paket und lädt es herunter. */
export async function exportTemplateKit(
  cfg: ExportRenderConfig,
  lang: Lang,
  example: CVData,
): Promise<void> {
  const theme = getTheme(cfg.themeId, cfg.accentId, cfg.paperId);
  const ph = placeholderCV(lang);

  // Wichtig: dieselbe Bauroutine wie für das echte PDF. Es gibt hier keinen
  // zweiten Renderer, der abweichen könnte — nur andere Eingabedaten.
  // `pageBlocks` bleibt weg: die Vorlage soll frei umbrechen, nicht die
  // Seitenaufteilung eines fremden Lebenslaufs mitschleppen.
  const html = buildResumeHtmlForTest(ph, { ...cfg, pageBlocks: undefined });
  const docx = await Packer.toBlob(buildDocx(ph, cfg.themeId, 'design'));

  const zip = new JSZip();
  zip.file('vorlage.html', html);
  zip.file('vorlage.docx', docx);
  zip.file('daten.json', JSON.stringify(emptyData(lang), null, 2));
  zip.file('beispiel.json', JSON.stringify(example, null, 2));
  zip.file('ANLEITUNG.md', anleitung(theme.name, theme.id, lang));

  const blob = await zip.generateAsync({ type: 'blob' });
  saveBlob(`vorlage-${theme.id}.zip`, blob);
}
