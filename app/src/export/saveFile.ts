/**
 * Eine Datei herunterladen — an einer Stelle, für alle Ausgänge.
 *
 * Das Muster stand siebenmal im Code, in zwei Fassungen. Die gute hängt den
 * Link ins Dokument und gibt die Object-URL erst später frei; die andere tat
 * beides nicht. Der Unterschied ist nicht kosmetisch: Safari und Firefox
 * brechen einen Download ab, wenn der Link nicht im Dokument hängt oder die
 * URL im selben Augenblick wieder freigegeben wird — je nach Tagesform, was
 * die Sache schwer auffindbar macht. Beim Durchmessen aller Ausgänge
 * (`scripts/exportcheck.mjs`) stieg sogar Chromium aus: nach einigen
 * Downloads in Folge verließ die Seite sich selbst und der Prüfstand fand
 * keine Knöpfe mehr.
 *
 * Deshalb: ein Weg, und der ist der vorsichtige.
 */

/** Blob als Datei speichern. */
export function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Erst aufräumen, wenn der Browser den Download wirklich übernommen hat.
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}

/** Text als Datei speichern. */
export function saveText(filename: string, text: string, mime: string): void {
  saveBlob(filename, new Blob([text], { type: `${mime};charset=utf-8` }));
}
