// ── Metrik-System ───────────────────────────────────────────────────────────
// Vorher gab es genau einen Regler: `density` (d). Der hat ALLES gleichzeitig
// skaliert — Schrift, Abstände, Ränder, Zeilenabstand. Das ist der Grund für
// den „alles wird winzig"-Effekt im Ein-Seiten-Modus: die harmlose Reserve
// (Weißraum) wurde nie ausgeschöpft, bevor die schädliche (Schriftgröße)
// angegriffen wurde.
//
// Jetzt gibt es vier getrennte Achsen und einen einzigen Verdichtungsregler
// `c` ∈ [0,1], der sie GESTAFFELT abbaut — in der Reihenfolge, in der ein
// Setzer sie abbauen würde:
//
//   1. Weißraum zwischen Blöcken   (risikolos)
//   2. Seitenränder                (Untergrenze 12,7 mm ≈ ½ Zoll)
//   3. Zeilenabstand               (Untergrenze 1,2 × Schriftgrad, Butterick)
//   4. Schriftgröße                (Untergrenze ~8,2 pt — darunter wird es
//                                   von ATS-Parsern schlechter erkannt und
//                                   auf Papier unangenehm)
//
// Ist Stufe 4 ausgereizt und der Inhalt passt immer noch nicht, wird NICHT
// weiter geschrumpft, sondern ehrlich gemeldet (siehe DocumentPreview).

/** Basis-Schriftgrößen in px bei t = 1, gerendert auf einer 210-mm-Seite.
 *  Umrechnung: pt = px × 0.75.
 *
 *  ── Gemessen am 14.09.2026 ────────────────────────────────────────────────
 *  Till: „Die Schriftart ist zu groß, wenn du das mit den Screenshots von
 *  Etsy vergleichst — kein Wunder, dass es immer zwei Seiten sind."
 *
 *  Nachgemessen an den Vorlagen seiner Sammlung: Blattbreite als Maßstab
 *  (210 mm), Zeilenabstand des Fließtexts in Pixeln, zurückgerechnet:
 *
 *      Pam Beesly       10,2 pt Zeilenabstand  →  ~7,2 pt Fließtext
 *      Sophie Wagner    11,3 pt                →  ~7,9 pt
 *      Katharina Mai    12,0 pt                →  ~8,4 pt
 *      wir (vorher)     15,1 pt                →  10,1 pt
 *
 *  Also 25–40 % größer als jede Vorlage, an der wir uns orientieren. Das ist
 *  der Hauptgrund, warum ein Lebenslauf hier zwei Seiten braucht und dort
 *  eine.
 *
 *  Die Skala ist deshalb um 6 % heruntergezogen: Fließtext 9,5 pt statt
 *  10,1 pt. NICHT auf 7–8 pt wie die Vorbilder — Personio nennt Schriftgrößen
 *  ≤ 8 pt ausdrücklich als dokumentierte Ursache für fehlgeschlagenes
 *  CV-Parsing, und auf Papier will das niemand lesen. Die Vorbilder sind an
 *  dieser Stelle schlicht zu klein; sie werden nach Aussehen verkauft, nicht
 *  nach Zustellbarkeit. Wer trotzdem dorthin will, hat den Regler (bis
 *  8,7 pt) — als bewusste Entscheidung, nicht als Voreinstellung. */
export const FS = {
  /** 8.2 pt — Mikro-Labels in Versalien (Kontakt-, Eckdaten-Labels).
   *  Sitzt exakt auf der Untergrenze: kleiner geht automatisch nichts. */
  label: 10.9,
  /** 8.3 pt — Datum, Notizen, Sprachniveau, Sektionstitel in Versalien */
  micro: 11.1,
  /** 8.6 pt — Firma, Institution, Skills, Kontaktwerte */
  meta: 11.4,
  /** 8.8 pt — Fließtext und Bullets */
  body: 11.7,
  /** 9.3 pt — Abschlussbezeichnung */
  entry: 12.4,
  /** 10.1 pt — Positionstitel */
  role: 13.5,
  /** 11.0 pt — Sektionstitel in der Serif-Variante */
  sec: 14.6,
  /** 18.3 pt — Name in der Sidebar */
  nameS: 24.4,
  /** 21.8 pt — Name im Hauptbereich */
  nameL: 29.1,
} as const;

/** Harte Untergrenze für JEDE Schriftgröße, die das Werkzeug VON SICH AUS
 *  einstellt. 10.9 px = 8.2 pt.
 *
 *  Der Wert ist keine Schätzung. Personio führt in seiner Anleitung zum
 *  CV-Parsing wörtlich auf, was ein Kandidatenprofil unlesbar macht — an
 *  erster Stelle: „The font size is smaller than or equal to 8 pt."
 *  (support.personio.de, „CV parsing for candidate profiles"). 8,2 pt liegt
 *  darüber, mit dem kleinstmöglichen ehrlichen Abstand.
 *
 *  Diese Grenze bindet den AUTOMATISCHEN Verdichter. Sie bindet NICHT den
 *  Menschen am Regler: wer bewusst kleiner setzen will, darf — das Werkzeug
 *  sagt dann, welche Grenze er überschreitet, und stellt sich nicht quer.
 *  Der Unterschied ist der Punkt: stillschweigend die Zustellbarkeit zu
 *  verkaufen ist etwas anderes, als es zu wissen und zu wollen. */
export const MIN_FONT_PX = 10.9;

/** Dieselbe Grenze, ausgedrückt als x-Höhe: 10.9 px × Inters x-Höhenanteil
 *  von 0.54 ≈ 5.9 px ≈ 1.55 mm auf Papier. Das ist der Wert, den der Renderer
 *  je Schrift zurückrechnet — leserlich.info nennt für übliche Leseabstände
 *  Größenordnungen in diesem Bereich, und es ist unabhängig von der Frage,
 *  wie viel „Punkt" eine Schrift optisch hergibt. */
export const MIN_X_HEIGHT_PX = MIN_FONT_PX * 0.54;

/** Obergrenze für Sperrung (letter-spacing) in Versalzeilen.
 *  Gemessen, nicht geschätzt: ab 0.10 em zerlegt die Textextraktion von Poppler
 *  (pdftotext, die Bibliothek hinter vielen Parsern) eine gesperrte Versalzeile
 *  in Einzelbuchstaben — aus „OBSERVABILITY" wird „O B S E R VA B I L I T Y".
 *  Genau diese Zeilen sind die Sektionstitel, an denen ein Lebenslauf-Parser
 *  das Dokument in Abschnitte zerlegt. 0.08 em liegt sicher darunter und sieht
 *  immer noch nach Sperrung aus. Prüfung: scripts/pdfcheck.mjs.
 *  Anpassungen bitte nur mit erneuter Messung. */
export const TRACK_CAPS = '0.08em';

/** Optische Straffung großer Displayzeilen (Name). Ebenfalls gemessen:
 *  bei -0.02 em verliert die Textextraktion den Wortabstand im Namen — aus
 *  „Katharina Vogt" wird „KatharinaVogt", und ein Parser findet den Nachnamen
 *  nicht mehr. -0.01 em ist optisch fast dasselbe und bleibt lesbar. */
export const TRACK_NAME = '-0.01em';

/** Basis-Zeilenabstände bei l = 1. */
export const LH = {
  body: 1.5,
  tight: 1.35,
  title: 1.2,
} as const;

export interface Metrics {
  /** Schriftskala — multipliziert jede Schriftgröße. */
  t: number;
  /** Wirksame px-Untergrenze für Schriftgrößen. Wird vom Renderer aus dem
   *  x-Höhen-Faktor der gewählten Schrift gesetzt, damit die Grenze eine
   *  x-Höhe beschreibt und nicht bloß einen Punktwert. Fehlt sie, gilt
   *  MIN_FONT_PX (Inter-Referenz). */
  minPx?: number;
  /** Abstandsskala — multipliziert jeden Gap zwischen Blöcken. */
  s: number;
  /** Zeilenabstandsskala. */
  l: number;
  /** Randskala — multipliziert die Innenabstände der Seite. */
  m: number;
}

/** Untergrenzen. Werden von der Fit-Suche nie unterschritten. */
export const FLOOR = {
  /** 0.90 × 12.6 px ≈ 8.5 pt Fließtext.
   *
   *  Vorher 0.96 — das war eine Achse mit vier Prozent Weg, also gar keine.
   *  Die Begründung („Weißraum ist die Reserve, nicht der Schriftgrad")
   *  stimmt als Reihenfolge und stimmte nicht als Verbot: wenn Weißraum,
   *  Ränder und Zeilenabstand ausgereizt sind und dreißig Zeilen fehlen, ist
   *  eine zweite Seite nicht automatisch die bessere Antwort. 8,5 pt bleibt
   *  über der dokumentierten Parsing-Grenze von 8 pt. */
  t: 0.90,
  /** Weißraum darf auf 58 % zusammengehen */
  s: 0.58,
  /** 1.5 → 1.26 (über Buttericks 1.2er-Grenze) */
  l: 0.84,
  /** 20 mm → 13 mm Rand */
  m: 0.66,
} as const;

/** Wie weit das Layout über die Normalstellung hinaus AUFgehen darf.
 *  Gegenstück zur Verdichtung: passt der Inhalt nicht auf die Wunschseitenzahl,
 *  entsteht eine zweite Seite, die oft nur halb voll ist — das sieht aus wie
 *  abgebrochen. Statt den Rest unten liegen zu lassen, darf der Satz dann etwas
 *  atmen, bis die Seiten gefüllt sind. Nur Weißraum, Ränder und Zeilenabstand;
 *  die Schriftgröße wird nie automatisch vergrößert, sonst änderte sich mit der
 *  Seitenzahl unbemerkt der Ton des Dokuments. */
export const EXPAND = 0.25;

/** Obergrenzen der Aufweitung bei c = -EXPAND. */
export const CEIL = {
  /** Weißraum zwischen Blöcken: +35 % */
  s: 1.35,
  /** Seitenränder: +12 % (20 mm → 22,4 mm) */
  m: 1.12,
  /** Zeilenabstand: 1.5 → 1.62 */
  l: 1.08,
} as const;

/** Bereich des Nutzer-Reglers. 0.85 ≈ 7,5 pt, 1.25 ≈ 11,0 pt Fließtext.
 *
 *  Der Regler darf weiter nach unten als der automatische Verdichter — und
 *  zwar bis unter die dokumentierte Parsing-Grenze. Das ist kein Versehen:
 *  die Vorlagen, an denen sich diese Entwürfe orientieren, setzen 7–8 pt, und
 *  wer eine Initiativbewerbung auf Papier verschickt, hat es mit einem
 *  Menschen zu tun und nicht mit Personio. Unterhalb von 8 pt sagt die
 *  Oberfläche, welche Grenze überschritten ist; verboten wird es nicht.
 *  Der automatische Verdichter kommt dort nie hin — siehe MIN_FONT_PX. */
export const USER_SCALE = { min: 0.85, max: 1.25, default: 1 } as const;

function lerp(a: number, b: number, x: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, x));
}

/** Stückweise Abbildung des Verdichtungsreglers auf die vier Achsen.
 *  Die Bereiche überlappen leicht, damit der Übergang stetig bleibt und
 *  keine sichtbare Stufe im Layout entsteht. */
export function metricsFor(condense: number, userScale = 1): Metrics {
  const c = Math.max(-EXPAND, Math.min(1, condense));
  if (c < 0) {
    // Aufweitung: in derselben Reihenfolge wie die Verdichtung, nur andersherum
    // — zuerst der Weißraum, dann Zeilenabstand und Ränder.
    const e = -c / EXPAND;
    return {
      s: lerp(1, CEIL.s, e),
      m: lerp(1, CEIL.m, e),
      l: lerp(1, CEIL.l, e),
      t: userScale,
      minPx: userFloor(userScale),
    };
  }
  return {
    s: lerp(1, FLOOR.s, c / 0.45),
    m: lerp(1, FLOOR.m, (c - 0.4) / 0.25),
    l: lerp(1, FLOOR.l, (c - 0.62) / 0.2),
    t: userScale * lerp(1, FLOOR.t, (c - 0.8) / 0.2),
    minPx: userFloor(userScale),
  };
}

/** Wirksame Untergrenze bei gegebener Nutzerskala.
 *
 *  Stellt der Mensch den Regler unter 1, sinkt die Grenze mit ihm — sonst
 *  liefe der Regler ins Leere: die Mikro-Labels sitzen bereits auf der
 *  Grenze, und ein Regler, der nur die großen Größen bewegt, macht das Blatt
 *  nicht kleiner, sondern nur flacher. Über 1 bleibt die Grenze, wo sie ist;
 *  sie soll ja nur nach unten schützen. Nicht definiert heißt „Vorgabe" —
 *  der Renderer rechnet sie dann in eine x-Höhe der gewählten Schrift um. */
export function userFloor(userScale: number): number | undefined {
  return userScale < 1 ? MIN_FONT_PX * userScale : undefined;
}

/** Bequeme Ausgangsmetrik ohne jede Verdichtung. */
export function baseMetrics(userScale = 1): Metrics {
  return metricsFor(0, userScale);
}

/** Wie viel Prozent der Verdichtung sind aufgebraucht? Für die UI-Anzeige. */
export function condenseLabel(c: number): 'locker' | 'normal' | 'kompakt' | 'sehr kompakt' {
  if (c < 0.05) return 'locker';
  if (c < 0.45) return 'normal';
  if (c < 0.8) return 'kompakt';
  return 'sehr kompakt';
}

// ── Zugriffshelfer für die Renderer ─────────────────────────────────────────
// Absichtlich winzige Funktionen: sie machen im Renderer sichtbar, WELCHE
// Achse ein Wert benutzt. `fs` = Schrift, `sp` = Abstand, `pd` = Rand,
// `lh` = Zeilenabstand. Vorher stand überall nur `* d` und niemand konnte
// unterscheiden, ob ein Wert Typo oder Weißraum war.

/** Schriftgröße (px-String), nie unter der wirksamen Untergrenze. */
export const fs = (px: number, M: Metrics): string => `${Math.max(M.minPx ?? MIN_FONT_PX, px * M.t)}px`;
/** Roher Schriftgrößenwert (für Berechnungen wie Markerpositionen). */
export const fsn = (px: number, M: Metrics): number => Math.max(M.minPx ?? MIN_FONT_PX, px * M.t);
/** Abstand zwischen Elementen (px-String) — skaliert mit Schrift UND Weißraum. */
export const sp = (px: number, M: Metrics): string => `${px * M.t * M.s}px`;
/** Roher Abstandswert. */
export const spn = (px: number, M: Metrics): number => px * M.t * M.s;
/** Seiten-Innenabstand (px-String) — eigene Achse, damit Ränder zuletzt fallen. */
export const pd = (px: number, M: Metrics): string => `${px * M.t * M.m}px`;
/** Roher Randwert. */
export const pdn = (px: number, M: Metrics): number => px * M.t * M.m;
/** Zeilenabstand — nie unter 1.15. */
export const lh = (base: number, M: Metrics): number => Math.max(1.15, base * M.l);
