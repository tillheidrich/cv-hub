import React from 'react';
import { isMultiline, type InlinePath } from '../data/inlineEdit';

// ── Direktes Bearbeiten in der Vorschau ─────────────────────────────────────
//
// Die Vorschau ist kein Bild, sondern das Dokument. Wer eine Formulierung
// ändern will, klickt hinein und schreibt — das Formular links bleibt für
// alles, was Struktur ist (Einträge anlegen, Reihenfolge, Sichtbarkeit).
//
// Übernommen wird beim Verlassen des Feldes, nicht bei jedem Anschlag. Das ist
// Absicht: jede Änderung stößt die Umbruchrechnung neu an, und ein Layout, das
// beim Tippen unter den Fingern springt, ist unbenutzbar.
export interface InlineEditApi {
  /** Feld verlassen — neuen Wert übernehmen. */
  commit: (path: InlinePath, value: string) => void;
  /** Eingabetaste in einer Aufzählung — neuen Punkt dahinter anlegen. */
  split: (path: InlinePath) => void;
  /** Rücktaste im leeren Punkt — Punkt entfernen. */
  remove: (path: InlinePath) => void;
}

export const InlineEditCtx = React.createContext<InlineEditApi | null>(null);

/** Ist `path` gesetzt und die App im Bearbeitungsmodus, wird aus dem Text ein
 *  beschreibbares Feld. Im Export und im Messlauf gibt es keinen Kontext —
 *  dort bleibt es ein gewöhnlicher Textknoten, ohne Attribute, ohne Klassen. */
/** Vorlesbare Bezeichnung eines Feldes.
 *
 *  Ein beschreibbares Feld ohne Beschriftung meldet sich bei einem Screenreader
 *  nur mit seinem Inhalt — bei fünfzig Feldern auf einer Seite ist das nutzlos.
 *  Der Pfad trägt die Information ohnehin, sie muss nur übersetzt werden. */
function fieldLabel(path: InlinePath): string {
  const p = path.split('.');
  const name: Record<string, string> = {
    name: 'Name', title: 'Position', text: 'Profiltext',
    role: 'Position', company: 'Firma', location: 'Ort', start: 'Beginn', end: 'Ende',
    degree: 'Abschluss', institution: 'Institution', notes: 'Notiz',
    language: 'Sprache', level: 'Niveau',
    subject: 'Betreff', salutation: 'Anrede', intro: 'Einleitung', mainBody: 'Hauptteil',
    companyReference: 'Bezug zum Unternehmen', motivation: 'Motivation', closing: 'Schluss',
    signoff: 'Grußformel', contactPerson: 'Ansprechpartner', companyAddress: 'Anschrift',
    city: 'Ort', date: 'Datum',
    address: 'Adresse', web: 'Web', phone: 'Telefon', email: 'E-Mail',
    birthDate: 'Geburtsdatum', birthPlace: 'Geburtsort', maritalStatus: 'Familienstand',
    nationality: 'Staatsangehörigkeit', driversLicense: 'Führerschein',
  };
  if (p[0] === 'labels') {
    const sec: Record<string, string> = {
      personal: 'Kontakt', details: 'Eckdaten', profile: 'Profil',
      experience: 'Berufserfahrung', education: 'Ausbildung',
      languages: 'Sprachen', additional: 'Weiteres',
    };
    if (p[1] === 'sections') return `Überschrift „${sec[p[2]] ?? p[2]}"`;
    if (p[1] === 'fields') return `Feldbezeichnung „${name[p[2]] ?? p[2]}"`;
    return p[2] === 'cvLabel' ? 'Fußzeile' : `Beschriftung ${p[2]}`;
  }
  if (p[0] === 'socials') return 'Profil-Adresse';
  if (p[0] === 'skills' && p[2] === 'label') return `Überschrift der Skill-Gruppe ${Number(p[1]) + 1}`;
  if (p[0] === 'cl') return `${name[p[1]] ?? p[1]} (Anschreiben)`;
  if (p[0] === 'profile') return 'Profiltext';
  if (p[0] === 'personal') return name[p[1]] ?? p[1];
  if (p[0] === 'additional') return `Weiteres, Punkt ${Number(p[1]) + 1}`;
  if (p[0] === 'skills') return `Skill ${Number(p[3]) + 1}`;
  if (p[0] === 'languages') return `${name[p[2]] ?? p[2]}, Eintrag ${Number(p[1]) + 1}`;
  if (p[2] === 'bullets') return `Stichpunkt ${Number(p[3]) + 1}`;
  return name[p[2]] ?? p[2] ?? 'Feld';
}

export function Ed({ path, children, block }: { path?: InlinePath; children: React.ReactNode; block?: boolean }) {
  /* Knoten statt reinem Text sind erlaubt, damit die Umbruchhilfen für lange
   * Kennungen (<wbr/>) auch im Bearbeitungsmodus stehen bleiben. Übernommen
   * wird `textContent` — <wbr/> trägt dazu nichts bei, der Wert bleibt sauber. */
  const api = React.useContext(InlineEditCtx);
  if (!api || !path) return <>{children}</>;
  // „mehrzeilig" heißt hier: Teil einer Aufzählung, in der die Eingabetaste
  // einen neuen Punkt anlegt. Fließtextfelder (Profil, Anschreiben) sind
  // ausgenommen — dort übernimmt die Eingabetaste und verlässt das Feld.
  const multi = /\.(bullets|items)\.\d+$|^additional\.\d+$/.test(path);
  /* Felder, in denen ein Umbruch etwas bedeutet — die Anschrift vor allem.
   * Dort legt die Eingabetaste eine Zeile an, statt das Feld zu verlassen. */
  const breaks = isMultiline(path);
  return (
    <span
      className="cv-edit"
      data-cv-edit={path}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label={fieldLabel(path)}
      tabIndex={0}
      style={{ ...(block ? { display: 'block' } : null), ...(breaks ? { whiteSpace: 'pre-line' } : null) }}
      // textContent, nicht innerText: innerText liefert den GERENDERTEN Text und
      // wendet dabei `text-transform` an. In Vorlagen, die den Namen in
      // Versalien setzen, wäre nach dem ersten Bearbeiten „KATHARINA VOGT" in
      // den Daten gelandet — und damit auch im PDF, im Word-Export und in jeder
      // anderen Vorlage.
      onBlur={e => api.commit(path, e.currentTarget.textContent ?? '')}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          /* Umschalt+Eingabe legt IMMER eine neue Zeile an — die vertraute
           * Geste, und sie kostet die bestehende Bedeutung der Eingabetaste
           * nichts. In Anschrift und Fließtextfeldern tut die Eingabetaste
           * ohne Umschalt dasselbe. */
          if (e.shiftKey || breaks) {
            e.preventDefault();
            /* Ein echtes Zeilenvorschubzeichen, kein <br>: `insertLineBreak`
             * legt je nach Browser ein Element an, das beim Auslesen über
             * `textContent` spurlos verschwindet — der Umbruch wäre auf dem
             * Bildschirm da und in den Daten weg. Das Feld steht in diesen
             * Fällen auf `white-space: pre-line`, dort wird „\n" dargestellt
             * UND ausgelesen. */
            document.execCommand('insertText', false, '\n');
            return;
          }
          e.preventDefault();
          const text = e.currentTarget.textContent ?? '';
          api.commit(path, text);
          if (multi) api.split(path);
          else (e.currentTarget as HTMLElement).blur();
          return;
        }
        if (e.key === 'Escape') { (e.currentTarget as HTMLElement).blur(); return; }
        if (e.key === 'Backspace' && multi && !(e.currentTarget.textContent ?? '').trim()) {
          e.preventDefault();
          api.remove(path);
        }
      }}
      onPaste={e => {
        // Ohne das landet die Formatierung der Quelle im Dokument — fremde
        // Schriftgrößen und Farben mitten im Lebenslauf.
        e.preventDefault();
        const raw = e.clipboardData.getData('text/plain');
        // In Feldern mit Umbruchbedeutung bleiben eingefügte Zeilen erhalten.
        const text = breaks
          ? raw.replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ')
          : raw.replace(/\s+/g, ' ');
        document.execCommand('insertText', false, text);
      }}
    >{children}</span>
  );
}

