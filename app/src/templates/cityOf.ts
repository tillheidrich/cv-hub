/** Aus „Isestraße 88, 20149 Hamburg" wird „Hamburg".
 *  Unter einer Unterschrift steht der Ort, nicht die Anschrift — der
 *  Rückgriff auf das Adressfeld ergab sonst eine Zeile wie
 *  „Isestraße 88, 20149 Hamburg, 14. September 2026".
 *
 *  Eigene Datei seit 17.11.2026: Lebenslauf (Unterschriftsblock) und
 *  Anschreiben (Ort im Briefkopf, wenn keiner eingetragen ist) nutzen sie. */
export function cityOf(location: string): string {
  // Getrennt wird an Komma UND an echtem Zeilenumbruch: seit die Anschrift
  // zweizeilig sein darf, steht der Ort meistens hinter einem Umbruch, nicht
  // hinter einem Komma.
  const last = (location || '').split(/[,\n]/).pop()?.trim() ?? '';
  return last.replace(/^\d{4,5}\s+/, '') || location;
}
