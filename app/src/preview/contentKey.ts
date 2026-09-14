// Kurze Kennung für „hat sich am Satz etwas geändert?".
//
// Verglichen wird nicht der Inhalt selbst, sondern ein Streuwert davon: die
// Kennung wandert bei jedem Rendern durch die Vorschau, und ein mehrere
// Kilobyte langer Text als Vergleichswert wäre dort Verschwendung. FNV-1a,
// 32 bit — schnell, kurz, und für „gleich oder nicht" völlig ausreichend.
export function contentKeyOf(...parts: unknown[]): string {
  let h = 0x811c9dc5;
  const s = JSON.stringify(parts);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + ':' + s.length.toString(36);
}
