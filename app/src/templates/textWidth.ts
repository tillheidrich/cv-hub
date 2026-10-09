// ── Textbreite ohne DOM ─────────────────────────────────────────────────────
//
// Kontaktangaben (E-Mail, Adressen, Telefon) dürfen im Lebenslauf nie mitten
// umbrechen: Ein deutscher Parser-Test mit drei kommerziellen Engines
// (r/InformatikKarriere, 08/2026) hat gezeigt, dass eine in der Seitenspalte
// umgebrochene E-Mail bei jeder Engine anders kaputt ankommt. Der Renderer
// entscheidet deshalb VOR dem Satz, ob eine Angabe in die Spalte passt, eine
// Stufe kleiner passt oder in die volle Breite muss.
//
// Die Entscheidung muss in Vorschau, Messlauf und Export gleich ausfallen —
// sonst verschiebt sich der Umbruch zwischen Vorschau und PDF. Eine Messung im
// DOM oder per Canvas hinge davon ab, ob die Schrift schon geladen ist. Diese
// Tabelle hängt von nichts ab: Laufweiten der Zeichen 32–126 in 1/1000 em,
// gemessen am 08.10.2026 in Chromium 1194 per Canvas (Schnitt 400, die
// Schriften aus @fontsource). Unterschneidung ist nicht berücksichtigt, sie
// macht die Zeile nur kürzer; das Ergebnis liegt also auf der sicheren Seite.

const ADVANCE: Record<string, number[]> = {
  'Inter': [281,288,466,633,642,982,644,300,365,365,501,662,288,460,288,360,631,407,610,618,646,593,620,566,619,620,288,302,662,662,662,511,966,690,654,730,722,601,590,746,743,269,571,672,565,903,753,765,639,765,644,642,646,744,690,985,682,679,629,365,360,365,471,456,323,562,612,571,612,583,370,613,591,242,242,549,242,876,591,600,612,612,376,528,327,591,562,818,546,562,552,426,333,426,662],
  'Source Sans 3': [200,289,426,497,497,824,609,249,303,303,418,497,249,311,249,350,497,497,497,497,497,497,497,497,497,497,249,249,497,497,497,425,847,543,588,571,615,527,494,617,652,263,479,579,486,727,647,664,566,664,569,534,536,645,515,786,513,476,539,303,350,303,497,500,542,504,553,456,555,496,292,504,544,246,247,495,255,829,547,542,555,555,347,419,338,544,467,719,446,467,425,303,241,303,497],
  'Archivo': [209,273,374,582,510,950,692,209,355,355,407,625,277,333,277,294,573,521,567,573,555,571,573,553,574,573,296,296,625,625,625,578,1005,682,698,728,734,677,612,796,736,267,559,662,536,847,736,788,665,788,727,673,606,731,648,924,680,655,635,296,294,296,625,485,187,545,567,519,567,548,280,556,563,225,223,514,225,860,563,570,567,567,332,510,297,562,504,723,513,504,498,353,245,353,625],
  'IBM Plex Sans': [236,284,419,713,598,927,694,242,335,335,450,600,272,399,272,383,600,600,600,600,600,600,600,600,600,600,292,292,600,600,600,477,891,641,653,621,671,583,559,695,707,400,510,634,501,812,707,708,606,708,640,581,572,678,609,891,613,593,580,317,383,317,600,565,600,534,580,503,580,549,324,528,568,250,250,527,272,873,568,560,580,580,367,487,351,568,492,768,507,499,464,343,314,343,600],
};

/** Laufweite eines Zeichens außerhalb der Tabelle (Umlaute, Sonderzeichen):
 *  großzügig geschätzt, lieber zu breit als zu schmal. */
const FALLBACK_EM = 0.68;

/** Erste bekannte Familie aus einem CSS-font-family-Stapel. */
function familyOf(stack: string): string {
  for (const part of stack.split(',')) {
    const name = part.trim().replace(/^['"]|['"]$/g, '');
    if (ADVANCE[name]) return name;
  }
  return 'Inter';
}

/** Breite von `text` in px bei `fontPx` in der Schrift `stack`, Schnitt 400.
 *  `tracking` in em je Zeichen (letter-spacing). */
export function textWidthPx(text: string, fontPx: number, stack: string, tracking = 0): number {
  const table = ADVANCE[familyOf(stack)];
  let em = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    em += (c >= 32 && c < 127 ? table[c - 32] / 1000 : FALLBACK_EM) + tracking;
  }
  return em * fontPx;
}
