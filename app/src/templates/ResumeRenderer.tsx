import React from 'react';
import type { CVData, SocialLink, SectionKey, PageFormat } from '../data/types';
import { getPageFormat } from '../data/pageFormats';
import type { ResumeTheme, ThemeColors, FontPairing, BulletStyle } from './theme';
import { MONO, templateOrder, skillsHeading } from './theme';
import { TRACK_CAPS, TRACK_NAME, FS, LH, MIN_X_HEIGHT_PX, fs, fsn, sp, spn, pd, pdn, lh, type Metrics } from './metrics';
import type { InlinePath } from '../data/inlineEdit';
import { Ed, EntryTools, InlineEditCtx, type InlineEditApi } from './InlineEdit';
import { textWidthPx } from './textWidth';
import { shortUrl } from '../data/urls';
import {
  sectionHeading, projectsOf, certificatesOf, volunteeringOf, publicationsOf,
  customSectionsOf, customEntriesOf, customItemsOf, bulletsOf, dateRange, shortLink, linkHref,
  type FixedExtraKey,
} from '../data/extraSections';
export type { InlineEditApi };

// ── Social rendering helpers ────────────────────────────────────────────────
const SOCIAL_META: Record<string, { label: string; prefix: string }> = {
  linkedin:  { label: 'LinkedIn',  prefix: 'linkedin.com/in/' },
  github:    { label: 'GitHub',    prefix: 'github.com/' },
  xing:      { label: 'Xing',      prefix: 'xing.com/profile/' },
  twitter:   { label: 'X',         prefix: 'x.com/' },
  bluesky:   { label: 'Bluesky',   prefix: 'bsky.app/profile/' },
  mastodon:  { label: 'Mastodon',  prefix: '' },
  instagram: { label: 'Instagram', prefix: 'instagram.com/' },
  youtube:   { label: 'YouTube',   prefix: 'youtube.com/@' },
  tiktok:    { label: 'TikTok',    prefix: 'tiktok.com/@' },
  behance:   { label: 'Behance',   prefix: 'behance.net/' },
  dribbble:  { label: 'Dribbble',  prefix: 'dribbble.com/' },
  medium:    { label: 'Medium',    prefix: 'medium.com/@' },
  substack:  { label: 'Substack',  prefix: '' },
};

/** Returns the canonical list of socials, falling back to legacy fields. */
export function listSocials(personal: CVData['personal']): SocialLink[] {
  if (personal.socials && personal.socials.length) return personal.socials;
  const legacy: SocialLink[] = [];
  if (personal.linkedin)  legacy.push({ id: 'lin-legacy', platform: 'linkedin',  value: personal.linkedin });
  if (personal.instagram) legacy.push({ id: 'ig-legacy',  platform: 'instagram', value: personal.instagram });
  return legacy;
}

export { shortUrl };

/** Verweisziel einer Adresse, die der Mensch mit oder ohne Protokoll getippt hat. */
export function webHref(v: string): string {
  const t = (v || '').trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

/** Metadaten nur für bekannte Plattformen; gespeicherte Altdaten mit
 *  „__proto__“ o. ä. brechen so die Vorschau nicht (Audit 10.10.2026, S6). */
const metaOf = (p: unknown) => (typeof p === 'string' && Object.hasOwn(SOCIAL_META, p) ? SOCIAL_META[p as keyof typeof SOCIAL_META] : undefined);

/** Pretty value for a social — uses platform prefix if user only wrote a handle. */
export function socialDisplay(s: SocialLink): string {
  const v = (s.value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v) || v.includes('/')) return shortUrl(v);
  return (metaOf(s.platform)?.prefix ?? '') + v;
}

export function socialHref(s: SocialLink): string {
  const v = (s.value || '').trim();
  if (!v) return '#';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + socialDisplay(s);
}

export function socialLabel(s: SocialLink): string {
  return metaOf(s.platform)?.label || (typeof s.platform === 'string' ? s.platform : '');
}

/** Kontaktzeile für Kopfbalken (E-Mail · Telefon · Ort · Web · Profile).
 *  Jeder Eintrag trägt seinen Bearbeitungspfad mit — auch im Kopfbalken soll
 *  man hineintippen können, nicht nur in der Seitenspalte. */
export function inlineContact(personal: CVData['personal'], editing = false): { v: string; path?: string }[] {
  const out: { v: string; path?: string }[] = [];
  if (personal.email) out.push({ v: personal.email, path: 'personal.email' });
  if (personal.phone) out.push({ v: personal.phone, path: 'personal.phone' });
  /* Die Anschrift ist seit dem 14.09. mehrzeilig. In einer Kopfzeile, die
   * ohnehin mit Mittelpunkten trennt, wird daraus ein Komma. Das Feld verliert
   * dabei seine Beschreibbarkeit AN DIESER STELLE — und zwar mit Absicht:
   * beim Verlassen übernimmt ein beschreibbares Feld seinen sichtbaren Text,
   * ein bloßer Klick hinein und wieder hinaus hätte den Umbruch gelöscht.
   * Geändert wird die Anschrift im Formular (Feld „Anschrift", zweizeilig). */
  if (personal.location) {
    const einzeilig = personal.location.replace(/\s*\n+\s*/g, ', ');
    out.push(einzeilig === personal.location
      ? { v: personal.location, path: 'personal.location' }
      : { v: einzeilig });
  }
  /* Auch beim Bearbeiten die kurze Form: Vorschau und PDF zeigen dasselbe.
   * Dass ein Klick hinein und wieder hinaus die getippte Langform nicht
   * überschreibt, regelt `applyInlineEdit` (gleiche Adresse = keine Änderung). */
  void editing;
  if (personal.website) out.push({ v: shortUrl(personal.website), path: 'personal.website' });
  for (const s of listSocials(personal)) {
    if (!s.value.trim()) continue;
    out.push({ v: socialDisplay(s), path: `socials.${s.id}` });
  }
  return out;
}

// ── Kontaktangaben ohne Umbruch ─────────────────────────────────────────────
//
// E-Mail, Telefon und Adressen brechen nie mitten um. Bis zum 08.10.2026 tat
// genau das die Seitenspalte mit Absicht (Umbruchstellen nach Punkt und
// Schrägstrich). Ein deutscher Parser-Test mit drei kommerziellen Engines
// (r/InformatikKarriere, 08/2026) zeigte, was daraus wird: dieselbe
// umgebrochene E-Mail kam bei drei Engines auf drei Arten kaputt an —
// Bindestrich verschluckt, abgeschnitten, Feld leer. Und unsere eigene
// ATS-Prüfung las „lena. brandt@example. com".
//
// Jetzt gilt eine feste Reihenfolge:
//   1. kurze Anzeigeform (ohne https://, www.) in normaler Größe,
//   2. passt das nicht: eine Stufe kleiner (Label-Größe, nie unter der
//      Untergrenze aus metrics.ts),
//   3. passt auch das nicht: die Angabe verlässt die Spalte und steht unter
//      dem Namen in voller Breite.
// Geprüft wird mit Laufweiten aus `textWidth.ts`, nicht im DOM — damit
// Vorschau, Messlauf und PDF dieselbe Entscheidung treffen.

export type ContactKind = 'email' | 'phone' | 'address' | 'web' | 'social';

export interface ContactRow {
  kind: ContactKind;
  l: string; v: string; href?: string; lp?: string; vp?: string;
}

export function contactRows(data: CVData, editing = false): ContactRow[] {
  const { personal, labels } = data;
  const rows: ContactRow[] = [];
  if (personal.email) rows.push({ kind: 'email', l: labels.fields.email, v: personal.email.trim(), href: `mailto:${personal.email.trim()}`, lp: 'labels.fields.email', vp: 'personal.email' });
  if (personal.phone) rows.push({ kind: 'phone', l: labels.fields.phone, v: personal.phone.trim(), href: `tel:${personal.phone.replace(/[^+\d]/g, '')}`, lp: 'labels.fields.phone', vp: 'personal.phone' });
  if (personal.location) rows.push({ kind: 'address', l: labels.fields.address, v: personal.location, lp: 'labels.fields.address', vp: 'personal.location' });
  void editing;
  if (personal.website) rows.push({ kind: 'web', l: labels.fields.web, v: shortUrl(personal.website), href: webHref(personal.website), lp: 'labels.fields.web', vp: 'personal.website' });
  for (const s of listSocials(personal)) {
    if (!s.value.trim()) continue;
    rows.push({ kind: 'social', l: socialLabel(s), v: socialDisplay(s), href: socialHref(s), vp: `socials.${s.id}` });
  }
  return rows;
}

/** Sicherheitszuschlag auf die geschätzte Breite (Rundung, Subpixel).
 *  Nachgemessen am 08.10.2026: Die Tabelle liegt im Mittel 0,3 % über der
 *  Breite, die Chromium setzt („linkedin.com/in/katharina-vogt": 164,9 px
 *  geschätzt, 164,4 px gesetzt) — Unterschneidung macht Zeilen nur kürzer.
 *  2 % reichen; mehr schickte Adressen, die passen, unnötig in die kleine
 *  Stufe. */
const FIT_SAFETY = 1.02;

export type ContactFit = 'normal' | 'small' | 'wide';

export function contactFit(v: string, availPx: number, P: FontPairing, M: Metrics): ContactFit {
  if (textWidthPx(v, fsn(FS.meta, M), P.body) * FIT_SAFETY <= availPx) return 'normal';
  if (textWidthPx(v, fsn(FS.label, M), P.body) * FIT_SAFETY <= availPx) return 'small';
  return 'wide';
}

// ── Flow-Blöcke ─────────────────────────────────────────────────────────────
// Die Hauptspalte ist keine Liste von <section>-Klötzen mehr, sondern eine
// Folge von Blöcken mit Umbruch-Metadaten. Genau an diesen Grenzen darf die
// Seite brechen — und nur dort. Granularität nach dem Vorbild von Typsts
// `block(sticky: …)`: der KOPF eines Eintrags klebt an seinem ersten Bullet,
// die Bullets selbst dürfen fließen. Ganze Einträge unteilbar zu machen wäre
// der naheliegende, aber falsche Reflex — dann reißt ein langer Eintrag am
// Seitenende ein handbreites Loch auf (bekanntes Awesome-CV-Problem).

export interface FlowBlock {
  id: string;
  node: React.ReactNode;
  /** Muss mit dem folgenden Block auf derselben Seite bleiben. */
  keepWithNext?: boolean;
  /** Abstand nach oben in px, wenn der Block NICHT der erste auf der Seite ist. */
  gap: number;
  /** Vom Nutzer erzwungener Seitenumbruch vor diesem Block. */
  breakBefore?: boolean;
  /** Sektion, zu der der Block gehört — für den Klick-in-die-Vorschau-Sprung. */
  section: SectionKey;
  /** Überschrift für die Fortsetzungszeile, wenn sie nicht aus `section`
   *  folgt — bei freien Abschnitten trägt jeder seine eigene. */
  caption?: string;
  /** Eintragskopf für die Fortsetzungszeile („Projekt · Rolle"). */
  entry?: string;
}

/** Welcher Teil der Seitenspalte gerendert wird — siehe `renderAside`. */
type AsidePart = 'all' | 'head' | 'rest';


// ── Bullet marker ───────────────────────────────────────────────────────────

function Marker({ style, color, M, widthPx }: { style: BulletStyle; color: string; M: Metrics; widthPx: number }) {
  const base = fsn(FS.body, M);
  /* Der Marker steht im Fluss, nicht absolut positioniert.
   *
   * Befund vom 08.10.2026: Chromium malt positionierte Elemente in einem
   * eigenen, späteren Durchgang — und die Textebene des PDF folgt der
   * Malreihenfolge. Solange die Stichpunktzeile `position: relative` trug,
   * standen im PDF erst ALLE Stationsköpfe einer Seite und danach ALLE
   * Stichpunkte (`pdftotext -raw`, Espoo und Zürich). Ein Parser ohne
   * Layoutanalyse ordnete so jeden Stichpunkt der letzten Station zu. Jetzt
   * sitzt der Marker in einer eigenen schmalen Flex-Spalte; optisch dieselbe
   * Stelle, im Textstrom die richtige Reihenfolge. */
  const box: React.CSSProperties = { display: 'block', width: `${widthPx}px`, flexShrink: 0 };
  if (style === 'dot' || style === 'chevron')
    // 'chevron' war ein Guillemet (›) und saß je nach Schrift auf einer anderen
    // Grundlinie. Ersetzt durch denselben soliden Punkt wie 'dot'.
    return <span aria-hidden style={box}><span style={{ display: 'block', marginTop: `${base * 0.52}px`, width: `${base * 0.26}px`, height: `${base * 0.26}px`, borderRadius: '50%', background: color }} /></span>;
  if (style === 'square')
    return <span aria-hidden style={box}><span style={{ display: 'block', marginTop: `${base * 0.52}px`, width: `${base * 0.26}px`, height: `${base * 0.26}px`, background: color }} /></span>;
  if (style === 'dash')
    return <span aria-hidden style={box}><span style={{ display: 'block', marginTop: `${base * 0.62}px`, width: `${base * 0.5}px`, height: `${Math.max(1, base * 0.1)}px`, background: color }} /></span>;
  return <span aria-hidden style={box}><span style={{ display: 'block', marginTop: `${base * 0.1}px`, fontSize: `${base * 0.72}px`, color, lineHeight: 1 }}>→</span></span>;
}

// ── Section title ───────────────────────────────────────────────────────────

/** Sektionstitel. Rendert bewusst ein echtes <h2>: Chromium übernimmt
 *  Überschriften in die Tag-Struktur des PDF, und Parser erkennen Sektionen an
 *  genau den Merkmalen, die hier zusammenkommen — allein in der Zeile, fett,
 *  größer als der Fließtext. Die Auszeichnung ersetzt den sichtbaren Kontrast
 *  nicht, sie ergänzt ihn. */
function SectionTitle({ label, T, C, P, M, onPanel, path, aside, num, group }: {
  label: string; T: ResumeTheme; C: ThemeColors; P: FontPairing; M: Metrics; onPanel?: boolean;
  /** Gruppenüberschrift der Kenntnisse in der Hauptspalte, kein Abschnitt.
   *  Wirkt nur in den Überschriftenstilen vom 10.10.2026. */
  group?: boolean;
  /** Gliederungsnummer (nur Überschriftenstil `numbered`, nur Hauptabschnitte). */
  num?: number;
  /** Steht in der Seitenspalte — dort gilt ein anderer Abstand nach unten. */
  aside?: boolean;
  /** Pfad zum Bearbeiten in der Vorschau — Sektionstitel sind Daten, keine
   *  Konstanten. Ohne ihn (Export, Messlauf) bleibt es gewöhnlicher Text. */
  path?: string;
}) {
  const L = <Ed path={path}>{label}</Ed>;
  /* In der Seitenspalte braucht ein Sektionstitel deutlich mehr Luft nach
   * unten als in der Hauptspalte. Grund: dort folgt als Nächstes ein
   * Versal-Label derselben Anmutung („ECKDATEN" über „GEBURTSDATUM"), und bei
   * gleichem Abstand liest sich die Überschrift wie ein weiterer Listenpunkt.
   * In der Hauptspalte trennt ohnehin `GAP_HEAD` den Titel vom ersten
   * Eintrag, und jeder Eintrag bringt eine eigene Zeilenhöhe mit. */
  const headGap = aside ? 13 : 8;
  const accent = onPanel ? C.panelAccent : C.accent;
  const ink = onPanel ? C.panelInk : C.ink;
  const H2: React.CSSProperties = { margin: 0, fontWeight: 'inherit' as const };

  if (T.heading === 'serif') {
    return (
      <div style={{ marginBottom: sp(headGap + 2, M) }}>
        <h2 style={{ ...H2, fontFamily: P.heading, fontSize: fs(FS.sec, M), fontWeight: 700, color: ink, lineHeight: lh(LH.title, M), letterSpacing: '0.01em' }}>{L}</h2>
        <div style={{ height: `${2 * M.t}px`, width: `${26 * M.t}px`, background: accent, marginTop: sp(6, M) }} />
      </div>
    );
  }
  // letter-spacing muss em-basiert sein, damit es mit der tatsächlichen
  // Schriftgröße skaliert. px-basiertes Tracking sprengte in schmalen Spalten
  // die Wörter ('G EB U R TS D A TU M').
  /* Gruppenüberschriften der Kenntnisse in Freiburg: eine Stufe leiser als
   * die gefüllten Abschnittsköpfe, sonst stünde die Rangfolge auf dem Kopf.
   * Gilt nur mit `groupHeads: 'small'` — Berlin und Amsterdam bleiben. */
  if (T.heading === 'block' && group && T.groupHeads === 'small') {
    return (
      <h2 style={{
        ...H2, fontFamily: P.body, fontSize: fs(FS.micro, M), fontWeight: 700, letterSpacing: TRACK_CAPS,
        textTransform: 'uppercase', color: accent, marginBottom: sp(headGap, M), overflowWrap: 'normal', wordBreak: 'normal',
      }}>{L}</h2>
    );
  }
  if (T.heading === 'block') {
    return (
      <h2 style={{
        ...H2, display: 'inline-block', marginBottom: sp(headGap, M), background: accent, color: onPanel ? C.panelBg : C.accentInk,
        fontFamily: P.body, fontSize: fs(FS.label * 1.02, M), fontWeight: 700, letterSpacing: TRACK_CAPS,
        textTransform: 'uppercase', padding: `${4 * M.t}px ${9 * M.t}px`,
        whiteSpace: 'nowrap',
      }}>{L}</h2>
    );
  }
  if (T.heading === 'bar') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: sp(6, M), marginBottom: sp(headGap, M), minWidth: 0 }}>
        <div style={{ width: `${12 * M.t}px`, height: `${3 * M.t}px`, background: accent, flexShrink: 0 }} />
        <h2 style={{ ...H2, fontFamily: P.body, fontSize: fs(FS.micro, M), fontWeight: 600, letterSpacing: TRACK_CAPS, textTransform: 'uppercase', color: ink, minWidth: 0, overflowWrap: 'normal' }}>{L}</h2>
      </div>
    );
  }
  /* Nur gesperrte Versalien, sonst nichts. Für die Vorlagen, deren ganzer
   * Gedanke „weißes Blatt, Haarlinien" ist — dort widerspricht schon ein
   * 3-px-Akzentbalken vor jeder Überschrift der Grundidee. */
  if (T.heading === 'caps-plain') {
    return (
      <h2 style={{
        ...H2, fontFamily: P.body, fontSize: fs(FS.micro, M), fontWeight: 600, letterSpacing: TRACK_CAPS,
        textTransform: 'uppercase', color: ink, marginBottom: sp(headGap, M),
        overflowWrap: 'normal', wordBreak: 'normal', display: 'block',
      }}>{L}</h2>
    );
  }
  /* Die Überschrift als stärkstes Element der Seite. Aus der Sammlung: bei
   * Robin Masset sind „work" und „education" so groß wie anderswo der Name,
   * und genau das macht das Blatt eigenwillig. Für Parser ist das eher
   * günstig — große Sektionstitel sind leichter als solche zu erkennen als
   * kleine gesperrte Versalzeilen. */
  if (T.heading === 'display') {
    return (
      <div style={{ marginBottom: sp(headGap, M) }}>
        <div style={{ height: `${3.2 * M.t}px`, background: ink, marginBottom: sp(7, M) }} />
        <h2 style={{
          /* 0,42 war in der Seitenspalte zu wenig: die Überschrift „Persönliches"
           * geriet damit KLEINER als die Feldbezeichnung „E-MAIL" darunter —
           * die Rangfolge stand auf dem Kopf. 0,62 × nameS ≈ 15 px steht über
           * den 11 px der fetten Versalzeilen, ohne die Spalte zu sprengen. */
          /* 0,86 in der Hauptspalte war zu brav. Die Gegenüberstellung bei
           * gleicher Blattbreite (14.09.) zeigt: Bei Robin Masset und Damian
           * Watracz ist die Sektionsüberschrift das DREI- bis VIERFACHE des
           * Fließtexts; bei uns war sie das 1,8-fache. Genau dieser Abstand
           * — nicht der Schriftgrad — macht den Eindruck aus, der mit
           * „kreativ" meint. 1,15 × nameS ≈ 21 pt ≈ 2,4-facher Fließtext. */
          ...H2, fontFamily: P.heading, fontSize: fs(FS.nameS * (aside ? 0.62 : 1.15), M),
          fontWeight: 700, color: ink, lineHeight: 1.0, letterSpacing: '-0.015em',
          overflowWrap: 'normal', wordBreak: 'normal',
        }}>{L}</h2>
      </div>
    );
  }
  /* Kräftiger Strich ÜBER der Zeile, volle Breite: teilt die Seite in
   * Register statt in Absätze (Romain Fournier). */
  if (T.heading === 'rule-over') {
    return (
      <div style={{ marginBottom: sp(headGap, M) }}>
        <div style={{ height: `${1.6 * M.t}px`, background: accent, marginBottom: sp(6, M) }} />
        <h2 style={{
          /* Register-Überschriften trugen 8,7 pt und verschwanden damit fast
           * im Fließtext. Bei Romain Fournier sind sie rund doppelt so groß
           * wie der Text darunter — das trennt die Register erst wirklich.
           * In der Seitenspalte bleibt es kleiner, dort ist die Spalte schmal. */
          ...H2, fontFamily: P.body, fontSize: fs(FS.body * (aside ? 1.02 : 1.45), M), fontWeight: 700,
          letterSpacing: TRACK_CAPS, textTransform: 'uppercase', color: ink,
          overflowWrap: 'normal', wordBreak: 'normal',
        }}>{L}</h2>
      </div>
    );
  }
  /* Serife in normaler Schreibung über einer Haarlinie über die volle
   * Breite — die Überschrift des tabellarischen Lebenslaufs. */
  if (T.heading === 'serif-rule') {
    return (
      <div style={{ marginBottom: sp(headGap, M), minWidth: 0 }}>
        <h2 style={{
          ...H2, fontFamily: P.heading, fontSize: fs(FS.sec * 0.94, M), fontWeight: 600, color: ink,
          lineHeight: lh(LH.title, M), letterSpacing: '0.004em', overflowWrap: 'normal', wordBreak: 'normal',
        }}>{L}</h2>
        <div style={{ height: `${0.9 * M.t}px`, background: onPanel ? C.panelInkSoft : C.rule, marginTop: sp(5, M) }} />
      </div>
    );
  }
  /* Serife ohne Linie, im Akzent. Die Gliederung kommt hier aus dem Rand,
   * in dem die Überschrift allein steht; ein Strich wäre doppelt. */
  if (T.heading === 'serif-quiet') {
    return (
      <h2 style={{
        ...H2, fontFamily: P.heading, fontSize: fs(FS.entry * 1.04, M), fontWeight: 600, color: accent,
        lineHeight: lh(LH.title, M), marginBottom: sp(headGap, M), overflowWrap: 'normal', wordBreak: 'normal',
      }}>{L}</h2>
    );
  }
  /* Nummerierte Abschnitte. Die Ziffer steht in der Datumsspalte, der Titel
   * auf der Textkante — beide auf einer Grundlinie, darunter eine Haarlinie.
   * Die Ziffer steht AUSSERHALB des <h2>: in der Tag-Struktur heißt der
   * Abschnitt weiter „Berufserfahrung", im Textstrom steht „1 BERUFSERFAHRUNG"
   * in einer Zeile — beides findet ein Parser. Ohne Nummer (Gruppen-
   * überschriften der Kenntnisse) bleibt nur die Versalzeile. */
  if (T.heading === 'numbered') {
    const caps: React.CSSProperties = {
      ...H2, fontFamily: P.body, fontSize: fs(FS.micro * 1.06, M), fontWeight: 600, letterSpacing: TRACK_CAPS,
      textTransform: 'uppercase', color: ink, overflowWrap: 'normal', wordBreak: 'normal', minWidth: 0,
    };
    if (num == null) return <h2 style={{ ...caps, marginBottom: sp(headGap, M) }}>{L}</h2>;
    return (
      <div style={{ marginBottom: sp(headGap, M), minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `${DATE_COL_MM}mm minmax(0, 1fr)`, columnGap: `${DATE_GAP_MM}mm`, alignItems: 'baseline' }}>
          <span style={{ fontFamily: P.heading, fontSize: fs(FS.sec, M), fontWeight: 600, color: accent, lineHeight: 1 }}>{num}</span>
          <h2 style={caps}>{L}</h2>
        </div>
        <div style={{ height: `${0.9 * M.t}px`, background: C.rule, marginTop: sp(5, M) }} />
      </div>
    );
  }
  /* Versalzeile in der Überschriftenschrift über einer durchgehenden Linie
   * in Schriftfarbe (Dublin). Gruppenüberschriften der Kenntnisse ohne
   * Linie, sonst stünden drei Linien nebeneinander. */
  if (T.heading === 'caps-full') {
    const caps: React.CSSProperties = {
      ...H2, fontFamily: P.heading, fontSize: fs(FS.meta * (group || aside ? 1 : 1.12), M), fontWeight: 700, letterSpacing: TRACK_CAPS,
      textTransform: 'uppercase', color: ink, overflowWrap: 'normal', wordBreak: 'normal', minWidth: 0,
    };
    if (group || aside) return <h2 style={{ ...caps, marginBottom: sp(headGap, M) }}>{L}</h2>;
    return (
      <div style={{ marginBottom: sp(headGap, M), minWidth: 0 }}>
        <h2 style={caps}>{L}</h2>
        <div style={{ height: `${0.9 * M.t}px`, background: ink, marginTop: sp(3, M) }} />
      </div>
    );
  }
  /* Überschrift rechtsbündig in der breiten Datumsspalte, rechts davon eine
   * Haarlinie bis zum Rand (Luxemburg). Gruppenüberschriften stehen als
   * schlichte Versalzeile in ihrer Spalte. */
  if (T.heading === 'label') {
    const caps: React.CSSProperties = {
      ...H2, fontFamily: P.body, fontSize: fs(FS.micro * 1.06, M), fontWeight: 600, letterSpacing: TRACK_CAPS,
      textTransform: 'uppercase', color: accent, overflowWrap: 'normal', wordBreak: 'normal', minWidth: 0,
    };
    if (group || aside) return <h2 style={{ ...caps, color: ink, marginBottom: sp(headGap, M) }}>{L}</h2>;
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: `${T.dateColMm ?? DATE_COL_MM}mm minmax(0, 1fr)`, columnGap: `${DATE_GAP_MM}mm`,
        alignItems: 'center', marginBottom: sp(headGap, M), minWidth: 0,
      }}>
        <h2 style={{ ...caps, textAlign: 'right' }}>{L}</h2>
        <div aria-hidden style={{ height: `${0.9 * M.t}px`, background: C.rule }} />
      </div>
    );
  }
  /* Überschrift in gleich breiter Schrift, normale Schreibung, eine
   * Haarlinie läuft bis zum Rand (Tallinn). */
  if (T.heading === 'mono') {
    const t: React.CSSProperties = {
      ...H2, fontFamily: MONO, fontSize: fs(FS.entry * (group || aside ? 0.86 : 1), M), fontWeight: 500, color: group || aside ? ink : accent,
      letterSpacing: '-0.01em', lineHeight: lh(LH.title, M), overflowWrap: 'normal', wordBreak: 'normal', minWidth: 0, flexShrink: 0,
    };
    if (group || aside) return <h2 style={{ ...t, marginBottom: sp(headGap, M) }}>{L}</h2>;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: sp(8, M), marginBottom: sp(headGap, M), minWidth: 0 }}>
        <h2 style={t}>{L}</h2>
        <div aria-hidden style={{ flex: '1 1 auto', height: `${0.9 * M.t}px`, background: C.rule }} />
      </div>
    );
  }
  if (T.heading === 'caps-rule') {
    return (
      <div style={{ marginBottom: sp(headGap, M), minWidth: 0 }}>
        <h2 style={{
          ...H2, fontFamily: P.body, fontSize: fs(FS.micro, M), fontWeight: 600, letterSpacing: TRACK_CAPS,
          textTransform: 'uppercase', color: ink, marginBottom: sp(4, M),
          overflowWrap: 'normal', wordBreak: 'normal',
        }}>{L}</h2>
        <div style={{ height: `${0.9 * M.t}px`, background: `linear-gradient(to right, ${accent}, transparent)` }} />
      </div>
    );
  }
  // caps-tracked
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: sp(6, M), marginBottom: sp(headGap, M), minWidth: 0 }}>
      <div style={{ width: `${3 * M.t}px`, height: `${10 * M.t}px`, background: accent, flexShrink: 0 }} />
      <h2 style={{
        ...H2, fontFamily: P.body, fontSize: fs(FS.micro, M), fontWeight: 600, letterSpacing: TRACK_CAPS,
        textTransform: 'uppercase', color: ink, minWidth: 0,
        overflowWrap: 'normal', wordBreak: 'normal',
      }}>{L}</h2>
    </div>
  );
}

// ── Bullets ─────────────────────────────────────────────────────────────────

/** Eine einzelne Bullet-Zeile. Bewusst ein eigenständiger Block: so kann eine
 *  lange Position zwischen zwei Stichpunkten umbrechen, statt komplett auf die
 *  nächste Seite zu springen. */
function BulletLine({ text, C, T, M, onPanel, path }: {
  text: string; C: ThemeColors; T: ResumeTheme; M: Metrics; onPanel?: boolean; path?: InlinePath;
}) {
  return (
    <div style={{
      fontSize: fs(FS.body, M), color: onPanel ? C.panelInkSoft : C.inkMid, lineHeight: lh(LH.body, M),
      display: 'flex', alignItems: 'flex-start', maxWidth: T.wideMeasure ? undefined : '122mm',
    }}>
      <Marker style={T.bullet} color={onPanel ? C.panelAccent : C.accent} M={M} widthPx={16 * M.t} />
      <span style={{ flex: '1 1 auto', minWidth: 0 }}><Ed path={path} block>{text}</Ed></span>
    </div>
  );
}

// ── Section content blocks ──────────────────────────────────────────────────

/**
 * Kleines Versal-Label über einem Wert (E-MAIL, STAATSANGEHÖRIGKEIT, …).
 *
 * Lange Einzelwörter passen in eine 42 mm breite Spalte nicht mehr, und weil
 * ein Label nie mitten im Wort brechen darf („STAATSANGEHÖRIGKEI|T"), wird es
 * stattdessen leiser gesetzt: ab 15 Zeichen etwas kleiner und mit weniger
 * Sperrung. Das kostet nichts an Lesbarkeit — es ist die Beschriftung, nicht
 * der Inhalt — und verhindert den Bruch zuverlässig.
 */
function labelStyle(label: string, color: string, P: FontPairing, M: Metrics): React.CSSProperties {
  const long = label.length > 14;
  /* Gemessen am 14.09.2026: „STAATSANGEHÖRIGKEIT" braucht in Lilles 54-mm-
   * Spalte 142 px, zur Verfügung stehen 136 — es brach als
   * „STAATSANGEHÖRIGKEI | T". Die Sperrung allein macht bei 19 Zeichen gut
   * acht Pixel aus; ohne sie passt die Zeile. Kleiner setzen ginge nicht:
   * die Beschriftung sitzt bereits auf der Untergrenze. */
  const sehrLang = label.length > 17;
  return {
    fontFamily: P.body,
    fontSize: fs(FS.label * (long ? 0.88 : 1), M),
    fontWeight: 700,
    letterSpacing: sehrLang ? '0' : long ? '0.04em' : TRACK_CAPS,
    textTransform: 'uppercase',
    color,
    marginBottom: sp(2, M),
    hyphens: 'none',
    WebkitHyphens: 'none',
    overflowWrap: 'break-word',
  };
}

/**
 * Feldbezeichnung, wahlweise in eckigen Klammern.
 *
 * Die Klammern sind Satzzeichen der Vorlage, nicht Teil der Daten: sie stehen
 * AUSSERHALB des beschreibbaren Feldes. Wer „E-MAIL" in „MAIL" ändert,
 * bekommt „[MAIL]" — und in den Daten steht weiterhin nur das Wort.
 * Für die Maschinenlesbarkeit ist das unkritisch: pdftotext liefert
 * „[E-MAIL]", der Wert steht wie immer in der Zeile darunter.
 */
function FieldLabel({ label, path, color, P, M, bracket }: {
  label: string; path?: string; color: string; P: FontPairing; M: Metrics; bracket?: boolean;
}) {
  const inner = <Ed path={path as never}>{label}</Ed>;
  return <div style={labelStyle(label, color, P, M)}>{bracket ? <>{'['}{inner}{']'}</> : inner}</div>;
}

function ContactBlock({ data, C, P, M, onPanel, bracket, availPx, wide }: {
  data: CVData; C: ThemeColors; P: FontPairing; M: Metrics; onPanel?: boolean; bracket?: boolean;
  /** Satzbreite der Spalte in px — Grundlage für die Entscheidung normal/klein. */
  availPx: number;
  /** Angaben, die nicht in die Spalte passen und deshalb unter dem Namen
   *  in voller Breite stehen (siehe `contactFit`). */
  wide: Set<string>;
}) {
  const ink = onPanel ? C.panelInk : C.inkMid;
  const lab = onPanel ? C.panelAccent : C.accent;
  /* Im Bearbeitungsmodus keine Verweise: ein beschreibbares Feld in einem
   * Anker führt beim Hineintippen zum Mailprogramm statt zum Schreibzeiger.
   * Im Export ist der Kontext leer, dort bleiben die Verweise klickbar. */
  const editing = !!React.useContext(InlineEditCtx);
  const rows = contactRows(data, editing).filter(r => !wide.has(r.vp ?? r.v));
  /* Eine Stufe kleiner gilt für den ganzen Block, nicht für eine einzelne
   * Zeile: drei Schriftgrößen untereinander sähen nach Versehen aus. */
  const small = rows.some(r => r.kind !== 'address' && contactFit(r.v, availPx, P, M) === 'small');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sp(10, M) }}>
      {rows.map((r, i) => {
        const inner = (
          <>
            <FieldLabel label={r.l} path={r.lp} color={lab} P={P} M={M} bracket={bracket} />
            <div style={{
              fontFamily: P.body, fontSize: fs(small && r.kind !== 'address' ? FS.label : FS.meta, M), color: ink, lineHeight: lh(LH.tight, M),
              /* Anschrift: Zeilenenden aus den Daten gelten. Alles andere ist
               * eine Kennung und steht am Stück. */
              whiteSpace: r.kind === 'address' ? 'pre-line' : 'nowrap',
            }}>
              {editing && r.vp ? <Ed path={r.vp} block>{r.v}</Ed> : r.v}
            </div>
          </>
        );
        return r.href && !editing
          ? <a key={i} href={r.href} style={{ textDecoration: 'none' }}>{inner}</a>
          : <div key={i}>{inner}</div>;
      })}
    </div>
  );
}

const DETAIL_KEYS = ['birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'driversLicense'] as const;

function detailRows(data: CVData): { l: string; v: string; k: typeof DETAIL_KEYS[number] }[] {
  const { personal, labels } = data;
  return DETAIL_KEYS
    .filter(k => !!personal[k])
    .map(k => ({ l: labels.fields[k], v: personal[k] as string, k }));
}

function DetailBlock({ data, C, P, M, onPanel, bracket }: { data: CVData; C: ThemeColors; P: FontPairing; M: Metrics; onPanel?: boolean; bracket?: boolean }) {
  const rows = detailRows(data);
  if (!rows.length) return null;
  const ink = onPanel ? C.panelInk : C.inkMid;
  const lab = onPanel ? C.panelAccent : C.accent;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sp(10, M), minWidth: 0 }}>
      {rows.map(({ l, v, k }) => (
        <div key={k} style={{ minWidth: 0 }}>
          <FieldLabel label={l} path={`labels.fields.${k}`} color={lab} P={P} M={M} bracket={bracket} />
          <div style={{
            fontFamily: P.body, fontSize: fs(FS.meta, M), color: ink, lineHeight: lh(LH.tight, M),
            wordBreak: 'normal', overflowWrap: 'break-word', whiteSpace: 'pre-line',
          }}><Ed path={`personal.${k}`} block>{v}</Ed></div>
        </div>
      ))}
    </div>
  );
}

function LangBlock({ data, C, P, M, onPanel, columns = 1 }: {
  data: CVData; C: ThemeColors; P: FontPairing; M: Metrics; onPanel?: boolean; columns?: number;
}) {
  const ink = onPanel ? C.panelInk : C.ink;
  const soft = onPanel ? C.panelInkSoft : C.inkSoft;
  const accent = onPanel ? C.panelAccent : C.accent;
  const dim = onPanel ? 'rgba(255,255,255,0.3)' : C.chipBg;
  // Eine Zeile „Sprache … Niveau ●●●●○" braucht rund 75 mm. Eine Seitenspalte
  // ist 55–68 mm breit. Das ging vorher nicht auf: das Niveau brach mitten im
  // Wort um („Verhandlungssiche/r"), „(C1)" rutschte allein in eine rechts-
  // bündige zweite Zeile, und die Punktskala lief aus der Spalte heraus.
  // Deshalb hat die schmale Variante jetzt zwei Zeilen — Sprache und Skala
  // oben, Niveau darunter über die volle Spaltenbreite. In den breiten,
  // mehrspaltigen Layouts bleibt die einzeilige Fassung.
  // Zweizeilig ist jetzt die einzige Form. Die einzeilige Variante brauchte
  // rund 75 mm; selbst in den breiten Layouts stehen nach Abzug der
  // Datumsspalte nur zwei Spalten à 68 mm zur Verfügung — dort wurden
  // „Englisch" und „Französisch" abgeschnitten. `columns` bestimmt nur noch,
  // wie viele Einträge nebeneinander stehen.
  const stacked = true;
  void columns;
  return (
    <div style={columns > 1
      ? { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(62mm, 1fr))`, gap: `${spn(8, M)}px ${spn(20, M)}px` }
      : { display: 'flex', flexDirection: 'column', gap: sp(9, M) }}>
      {data.languages.map(l => (
        // Der Fortschrittsbalken ist raus: er kodierte denselben Wert ein
        // drittes Mal (Text + Punkte + Balken) und ist für Parser wertlos.
        // Das Textniveau steht bewusst immer daneben — eine reine Grafik-
        // Skala ist die von Personio dokumentierte Parsing-Falle.
        <div key={l.language} style={stacked ? { minWidth: 0 } : {
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          gap: sp(8, M), minWidth: 0,
        }}>
          <div style={stacked ? {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: sp(8, M), minWidth: 0,
          } : { display: 'contents' }}>
            <span style={{
              fontFamily: P.body, fontSize: fs(FS.meta, M), fontWeight: 600, color: ink,
              // Sprachnamen werden nie getrennt. Lieber schiebt sich die Spalte,
              // als dass „Französisch" mit Bindestrich auseinanderfällt.
              // Kein `text-overflow: ellipsis`: ein abgeschnittener Sprachname
              // („Französi…") ist schlimmer als eine etwas zu breite Spalte.
              hyphens: 'none', WebkitHyphens: 'none', whiteSpace: 'nowrap', minWidth: 0,
            }}><Ed path={`languages.${data.languages.indexOf(l)}.language`}>{l.language}</Ed></span>
            {stacked && <DotScale value={languageDots(l)} max={5} M={M} on={accent} off={dim} />}
          </div>
          {stacked ? (
            <div style={{
              fontFamily: P.body, fontSize: fs(FS.micro, M), color: soft,
              hyphens: 'none', WebkitHyphens: 'none', marginTop: sp(1, M), lineHeight: lh(LH.tight, M),
            }}><Ed path={`languages.${data.languages.indexOf(l)}.level`}>{l.level}</Ed></div>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: sp(6, M), minWidth: 0 }}>
              <span style={{
                fontFamily: P.body, fontSize: fs(FS.micro, M), color: soft, textAlign: 'right',
                hyphens: 'none', WebkitHyphens: 'none',
              }}>{l.level}</span>
              <DotScale value={languageDots(l)} max={5} M={M} on={accent} off={dim} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function DotScale({ value, max, M, on, off }: { value: number; max: number; M: Metrics; on: string; off: string }) {
  const size = fsn(FS.body, M) * 0.49;
  const gap = size * 0.5;
  return (
    /* Bis zum 08.10.2026 stand hier ein unsichtbarer Text „(4 von 5)" in
     * einem absolut positionierten Kasten. Positionierte Elemente malt
     * Chromium zuletzt — der Text landete im PDF am Ende der Seite, losgelöst
     * von der Sprache, und auf Englisch stand dort „von". Das Sprachniveau
     * steht ohnehin immer als Text daneben (C1, Muttersprache); für
     * Screenreader trägt die Skala jetzt eine Beschriftung. */
    <span role="img" aria-label={`${value}/${max}`} style={{ display: 'inline-flex', gap: `${gap}px`, alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} aria-hidden style={{
          display: 'inline-block', width: `${size}px`, height: `${size}px`,
          borderRadius: '50%', background: i < value ? on : off,
        }} />
      ))}
    </span>
  );
}

/** Resolves the dot rating for a language entry. */
export function languageDots(l: { level: string; dots?: number }): number {
  if (typeof l.dots === 'number' && Number.isFinite(l.dots)) {
    return Math.max(0, Math.min(5, Math.round(l.dots)));
  }
  const pct = langPct(l.level);
  if (pct >= 95) return 5;
  if (pct >= 80) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  return 1;
}

function langPct(level: string): number {
  const s = level.toLowerCase();
  if (/mutter|native|c2/.test(s)) return 100;
  if (/c1|verhandl|fluent|business/.test(s)) return 88;
  if (/b2/.test(s)) return 72;
  if (/b1/.test(s)) return 58;
  if (/grund|basic|a2|a1/.test(s)) return 40;
  return 70;
}

function SkillGroupBlock({ group, T, C, P, M, onPanel, pathBase }: {
  group: { label: string; items: string[] }; T: ResumeTheme; C: ThemeColors; P: FontPairing; M: Metrics;
  onPanel?: boolean;
  /** Pfadwurzel für das Bearbeiten in der Vorschau, z. B. `skills.2.items`. */
  pathBase?: string;
}) {
  if (T.skillsAsChips) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: sp(4, M) }}>
        {group.items.map((it, i) => (
          <span key={`${it}-${i}`} style={{
            fontFamily: P.body, fontSize: fs(FS.meta * 0.95, M), color: onPanel ? C.panelInk : C.inkMid,
            background: onPanel ? 'rgba(255,255,255,0.12)' : C.chipBg,
            padding: `${3.5 * M.t}px ${8 * M.t}px`, borderRadius: `${2.5 * M.t}px`, lineHeight: lh(LH.tight, M),
          }}><Ed path={pathBase ? `${pathBase}.${i}` : undefined}>{it}</Ed></span>
        ))}
      </div>
    );
  }
  return (
    <ul style={{ display: 'flex', flexDirection: 'column', gap: sp(4, M), margin: 0, padding: 0, listStyle: 'none' }}>
      {group.items.map((it, i) => (
        <li key={`${it}-${i}`} style={{
          // Skills sind Inhalt, nicht Beiwerk: in der Seitenspalte stand die
          // Liste bisher im gedämpften Ton und war im Graustufendruck das
          // blasseste Element der Seite.
          fontSize: fs(FS.meta, M), color: onPanel ? C.panelInk : C.inkMid, lineHeight: lh(LH.tight, M),
          display: 'flex', alignItems: 'flex-start',
        }}>
          <Marker style={T.bullet === 'dash' ? 'dot' : T.bullet} color={onPanel ? C.panelAccent : C.accent} M={M} widthPx={13 * M.t} />
          <span style={{ flex: '1 1 auto', minWidth: 0 }}><Ed path={pathBase ? `${pathBase}.${i}` : undefined} block>{it}</Ed></span>
        </li>
      ))}
    </ul>
  );
}

function Photo({ data, T, C, widthMm }: { data: CVData; T: ResumeTheme; C: ThemeColors; widthMm: number }) {
  if (T.photo === 'none' || !data.personal.photo) return null;
  // Bewerbungsfoto ist Hochformat 3:4 (DIN-üblich 35 × 45 mm). Vorher war
  // alles quadratisch — das sah bei jeder Vorlage nach Profilbild aus.
  const portrait = T.photo === 'rect' || T.photo === 'rounded';
  const heightMm = portrait ? widthMm * (4 / 3) : widthMm;
  const radius = T.photo === 'circle' ? '50%' : T.photo === 'rounded' ? `${widthMm * 0.08}mm` : '0';
  return (
    <div style={{
      width: `${widthMm}mm`, height: `${heightMm}mm`, flexShrink: 0, borderRadius: radius,
      overflow: 'hidden', background: C.chipBg, position: 'relative',
    }}>
      {/* alt bleibt leer: im PDF-Dienst läuft kein JavaScript, ein fehlendes
          Bild würde dort sonst als Bruchsymbol samt Alternativtext gedruckt.
          Der getönte Kasten dahinter trägt die Fläche. */}
      <img src={data.personal.photo} alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
}

// ── Experience + Education ──────────────────────────────────────────────────

function present(data: CVData, end: string) {
  return end === 'present' || end === 'heute' ? data.labels.misc.present : end;
}

function DateChip({ children, C, P, M, onPanel, align, font }: {
  children: React.ReactNode; C: ThemeColors; P: FontPairing; M: Metrics; onPanel?: boolean; align?: 'right';
  /** Eigene Datumsschrift der Vorlage (`dateFont`). Fehlt sie, gilt der
   *  bisherige Satz — unverändert für alle älteren Vorlagen. */
  font?: 'mono' | 'heading';
}) {
  /* Gleich breite Ziffern: „03/2021" und „11/2018" stehen spaltengenau
   * untereinander. Etwas kleiner als die Proportionalschrift, weil eine
   * Monospace bei gleichem Grad breiter läuft. */
  if (font === 'mono') return (
    <span style={{
      fontFamily: MONO, fontSize: fs(FS.micro * 0.92, M), fontWeight: 500, color: onPanel ? C.panelInkSoft : C.inkMid,
      whiteSpace: 'nowrap', letterSpacing: '-0.01em', textAlign: align,
    }}>{children}</span>
  );
  if (font === 'heading') return (
    <span style={{
      fontFamily: P.heading, fontSize: fs(FS.meta, M), fontWeight: 600, color: onPanel ? C.panelAccent : C.accent,
      whiteSpace: 'nowrap', textAlign: align,
    }}>{children}</span>
  );
  return (
    <span style={{
      fontFamily: P.body, fontSize: fs(FS.micro, M), fontWeight: 600, color: onPanel ? C.panelInkSoft : C.inkSoft,
      whiteSpace: 'nowrap', letterSpacing: '0.02em', textAlign: align,
    }}>{children}</span>
  );
}

/** Kopfzeile eines Erfahrungseintrags — klebt immer am ersten Stichpunkt. */
/** Breite der tabellarischen Datumsspalte (DIN-artige Layouts) und ihr Steg.
 *  „03/2021 – heute" misst bei 9,2 pt rund 22 mm; 26 mm lassen Luft für
 *  „09/2019 – 04/2022". Vorher standen hier 34 mm + 8 mm — ein Viertel der
 *  Satzbreite für eine Spalte, die zu drei Vierteln leer ist, und der Grund,
 *  warum Karlsruhe, Helsinki und Espoo denselben Inhalt auf zwei Seiten
 *  schoben, den andere Vorlagen auf einer unterbringen. */
const DATE_COL_MM = 26;
const DATE_GAP_MM = 7;
/** Datumsspalte der Vorlagen mit Zeitachse (`rail`). Breiter, weil die
 *  Daten dort in Monospace stehen: „09/2019 – 04/2022" sind 17 gleich
 *  breite Zeichen, rund 27 mm. */
const RAIL_DATE_MM = 30;

/** Knoten auf der Zeitachse. Steht im Fluss in der mittleren Rasterspalte
 *  und deckt die Linie, die als Hintergrund dahinter läuft. Kein Text, also
 *  ohne Einfluss auf die Textebene. `big` = Abschnitt, sonst Station. */
function RailNode({ C, M, top, big }: { C: ThemeColors; M: Metrics; top: number; big?: boolean }) {
  const size = (big ? 7.5 : 6.5) * M.t;
  return (
    <span aria-hidden style={{ display: 'flex', justifyContent: 'center', paddingTop: `${top}px` }}>
      <span style={{
        display: 'block', width: `${size}px`, height: `${size}px`, flexShrink: 0,
        background: big ? C.accent : C.pageBg,
        border: big ? undefined : `${1.5 * M.t}px solid ${C.accent}`,
        boxSizing: 'border-box',
      }} />
    </span>
  );
}

function ExperienceHead({ e, data, C, P, M, tabular, timeline, isLast, rail, dateFont, variant, dateCol = DATE_COL_MM, labelRight }: {
  e: CVData['experience'][number]; data: CVData; C: ThemeColors; P: FontPairing; M: Metrics;
  tabular: boolean; timeline?: boolean; isLast?: boolean;
  /** Rasterspalten der Zeitachse (Datum · Knoten · Text), siehe `rail`. */
  rail?: string;
  dateFont?: 'mono' | 'heading';
  /** Eintragskopf ohne Datumsspalte (`entryHead` der Vorlage). */
  variant?: 'split' | 'line';
  /** Breite der Datumsspalte in mm (`dateColMm`). */
  dateCol?: number;
  /** Datumsspalte rechtsbündig (`labelAlign: 'right'`). */
  labelRight?: boolean;
}) {
  const body = (
    <div style={{ minWidth: 0 }}>
      <h3 style={{ margin: 0, fontFamily: P.heading, fontSize: fs(FS.role, M), fontWeight: 600, color: C.ink, lineHeight: lh(LH.title, M) }}>
        <Ed path={`experience.${e.id}.role`}>{e.role}</Ed>
      </h3>
      <div style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), fontWeight: 600, color: C.accent, marginTop: sp(2, M) }}>
        <Ed path={`experience.${e.id}.company`}>{e.company}</Ed>
        {e.location ? <span style={{ color: C.inkSoft, fontWeight: 400 }}>{'  ·  '}<Ed path={`experience.${e.id}.location`}>{e.location}</Ed></span> : ''}
      </div>
    </div>
  );
  const date = (
    <DateChip C={C} P={P} M={M} align={tabular ? 'right' : undefined} font={dateFont}>
      <Ed path={`experience.${e.id}.start`}>{e.start}</Ed>
      {' – '}
      <Ed path={`experience.${e.id}.end`}>{present(data, e.end)}</Ed>
    </DateChip>
  );

  if (variant) {
    return (
      <SplitHead variant={variant} C={C} P={P} M={M} date={date} titleSize={FS.role}
        title={<Ed path={`experience.${e.id}.role`}>{e.role}</Ed>} hasTitle={!!e.role}
        sub={e.company ? <Ed path={`experience.${e.id}.company`}>{e.company}</Ed> : null}
        note={e.location ? <Ed path={`experience.${e.id}.location`}>{e.location}</Ed> : null} />
    );
  }
  if (tabular && rail) {
    const line = fsn(FS.role, M) * LH.title;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: rail, alignItems: 'start' }}>
        <div style={{ paddingTop: `${fsn(FS.role, M) * 0.22}px` }}>{date}</div>
        <RailNode C={C} M={M} top={(line - 6.5 * M.t) / 2} />
        {body}
      </div>
    );
  }
  if (tabular) {
    // Tabellarische Datumsspalte — die im DACH-Raum erwartete Form. Das Datum
    // steht 8 mm neben dem Titel statt 190 mm entfernt am rechten Blattrand.
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `${dateCol}mm 1fr`, columnGap: `${DATE_GAP_MM}mm`, alignItems: 'start' }}>
        <div style={{ paddingTop: `${fsn(FS.role, M) * 0.18}px`, textAlign: labelRight ? 'right' : undefined }}>{date}</div>
        {body}
      </div>
    );
  }
  return (
    /* Zeitstrahl ohne `position`: Punkt und Linie stehen in einer eigenen
     * schmalen Rasterspalte im Fluss. Mit `position: relative` am Kopf malte
     * Chromium den ganzen Kopf in den späten Durchgang für positionierte
     * Elemente, und die Textebene des PDF geriet aus der Reihenfolge (siehe
     * `Marker`). Die Linie reicht wie vorher 14 px über den Kopf hinaus. */
    <div style={{ display: 'grid', gridTemplateColumns: timeline ? `${16 * M.t}px minmax(0, 1fr)` : 'minmax(0, 1fr)' }}>
      {timeline && (
        <span aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ display: 'block', flexShrink: 0, marginTop: `${4 * M.t}px`, width: `${8 * M.t}px`, height: `${8 * M.t}px`, borderRadius: '50%', background: C.pageBg, border: `${2 * M.t}px solid ${C.accent}` }} />
          {!isLast && <span style={{ display: 'block', flex: '1 1 auto', marginTop: `${2 * M.t}px`, marginLeft: `${3.5 * M.t}px`, marginBottom: `${-14 * M.t}px`, width: `${1.2 * M.t}px`, background: C.accent, opacity: 0.35 }} />}
        </span>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: sp(10, M) }}>
        <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
        {date}
      </div>
    </div>
  );
}

function EducationEntryBlock({ e, C, P, M, tabular, rail, dateFont, variant, dateCol = DATE_COL_MM, labelRight, wide }: {
  e: CVData['education'][number]; C: ThemeColors; P: FontPairing; M: Metrics; tabular: boolean;
  rail?: string; dateFont?: 'mono' | 'heading';
  variant?: 'split' | 'line'; dateCol?: number; labelRight?: boolean;
  /** Notiz über die volle Satzbreite (`wideMeasure`). */
  wide?: boolean;
}) {
  const body = (
    <div style={{ minWidth: 0 }}>
      <h3 style={{ margin: 0, fontFamily: P.heading, fontSize: fs(FS.entry, M), fontWeight: 600, color: C.ink, lineHeight: lh(LH.title, M) }}>
        <Ed path={`education.${e.id}.degree`}>{e.degree}</Ed>
      </h3>
      <div style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), color: C.accent, marginTop: sp(2, M) }}>
        <Ed path={`education.${e.id}.institution`}>{e.institution}</Ed>
      </div>
      {e.notes && <div style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkSoft, marginTop: sp(2, M), maxWidth: '122mm' }}>
        <Ed path={`education.${e.id}.notes`}>{e.notes}</Ed>
      </div>}
    </div>
  );
  const date = (
    <DateChip C={C} P={P} M={M} align={tabular ? 'right' : undefined} font={dateFont}>
      <Ed path={`education.${e.id}.start`}>{e.start}</Ed>
      {' – '}
      <Ed path={`education.${e.id}.end`}>{e.end}</Ed>
    </DateChip>
  );
  if (variant) {
    return (
      <div style={{ minWidth: 0 }}>
        <SplitHead variant={variant} C={C} P={P} M={M} date={date} titleSize={FS.entry}
          title={<Ed path={`education.${e.id}.degree`}>{e.degree}</Ed>} hasTitle={!!e.degree}
          sub={e.institution ? <Ed path={`education.${e.id}.institution`}>{e.institution}</Ed> : null}
          note={e.location ? e.location : null} />
        {e.notes && <div style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkSoft, marginTop: sp(2, M), maxWidth: wide ? undefined : '122mm' }}>
          <Ed path={`education.${e.id}.notes`}>{e.notes}</Ed>
        </div>}
      </div>
    );
  }
  if (tabular && rail) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: rail, alignItems: 'start' }}>
        <div style={{ paddingTop: `${fsn(FS.entry, M) * 0.22}px` }}>{date}</div>
        <RailNode C={C} M={M} top={(fsn(FS.entry, M) * LH.title - 6.5 * M.t) / 2} />
        {body}
      </div>
    );
  }
  if (tabular) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `${dateCol}mm 1fr`, columnGap: `${DATE_GAP_MM}mm`, alignItems: 'start' }}>
        <div style={{ paddingTop: `${fsn(FS.entry, M) * 0.18}px`, textAlign: labelRight ? 'right' : undefined }}>{date}</div>
        {body}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: sp(10, M) }}>
      <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
      {date}
    </div>
  );
}

/** Eintragskopf ohne Datumsspalte (Vorlagen vom 10.10.2026).
 *
 *  `split`: zwei Zeilen — links Titel und darunter Firma bzw. Einrichtung,
 *  rechts Zeitraum und darunter der Ort. So steht es in englischsprachigen
 *  Lebensläufen; im Textstrom folgt auf den Titel der Zeitraum, dann Firma
 *  und Ort, jeweils in einer Zeile.
 *  `line`: alles in einer Zeile, „Titel · Firma · Ort", Zeitraum rechts.
 *  Bricht die Zeile, laufen die Teile an den Mittelpunkten um. */
function SplitHead({ variant, title, hasTitle, sub, note, date, titleSize, C, P, M }: {
  variant: 'split' | 'line'; title: React.ReactNode; hasTitle: boolean; sub: React.ReactNode; note: React.ReactNode;
  date: React.ReactNode; titleSize: number; C: ThemeColors; P: FontPairing; M: Metrics;
}) {
  const h3: React.CSSProperties = { margin: 0, fontFamily: P.heading, fontSize: fs(titleSize, M), fontWeight: 600, color: C.ink, lineHeight: lh(LH.title, M) };
  if (variant === 'line') {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: sp(10, M) }}>
        <div style={{ flex: 1, minWidth: 0, lineHeight: lh(LH.title, M) }}>
          {hasTitle && <h3 style={{ ...h3, display: 'inline' }}>{title}</h3>}
          {sub && <span style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), fontWeight: 600, color: C.accent }}>{hasTitle ? '  ·  ' : ''}{sub}</span>}
          {note && <span style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), color: C.inkSoft }}>{hasTitle || sub ? '  ·  ' : ''}{note}</span>}
        </div>
        {date}
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: sp(12, M), rowGap: sp(1.5, M), alignItems: 'baseline' }}>
      {hasTitle ? <h3 style={h3}>{title}</h3> : <div />}
      <div style={{ textAlign: 'right' }}>{date}</div>
      {sub ? <div style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), fontWeight: 600, color: C.accent, minWidth: 0 }}>{sub}</div> : <div />}
      {note ? <div style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkSoft, textAlign: 'right', whiteSpace: 'nowrap' }}>{note}</div> : <div />}
    </div>
  );
}

// ── Eigene Abschnitte: Projekte, Zertifikate, Ehrenamt, Publikationen, frei ──
//
// Gebaut wie Ausbildung und Berufsweg, nicht als eigene Gestaltung: dieselbe
// Datumsspalte in den tabellarischen Vorlagen, dasselbe Datum am rechten Rand
// in den übrigen, dieselben Schriftgrade. Ein Projekt soll aussehen, als
// hätte die Vorlage es schon immer gekannt. Die Abschnitte stehen in der
// Hauptspalte — dort, wo jede Vorlage Berufsweg und Ausbildung führt —, weil
// nur die Hauptspalte umbricht; die Seitenspalte würde lange Einträge im PDF
// stillschweigend abschneiden.

/** Ein Link im Dokument. Im Export klickbar, beim Bearbeiten in der Vorschau
 *  bloßer Text — ein Klick dort soll nicht aus dem Editor führen. */
function ExtraLink({ url, C, P, M }: { url: string; C: ThemeColors; P: FontPairing; M: Metrics }) {
  const editing = !!React.useContext(InlineEditCtx);
  const text = shortLink(url);
  const style: React.CSSProperties = {
    fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkSoft, marginTop: sp(2, M),
    /* Ein Link bricht nur, wenn er allein nicht in die Zeile passt — und dann
     * lieber mitten in der Adresse als abgeschnitten: Abgeschnittenes fehlt
     * in der Textebene des PDF ganz. */
    overflowWrap: 'anywhere', maxWidth: '122mm',
  };
  return editing
    ? <div style={style}>{text}</div>
    : <div style={style}><a href={linkHref(url)} style={{ color: 'inherit', textDecoration: 'none' }}>{text}</a></div>;
}

function ExtraHead({ title, sub, note, url, date, C, P, M, tabular, rail, dateFont, num, variant, dateCol = DATE_COL_MM, labelRight }: {
  title: string; sub?: string; note?: string; url?: string; date?: string;
  C: ThemeColors; P: FontPairing; M: Metrics; tabular: boolean;
  rail?: string; dateFont?: 'mono' | 'heading';
  /** Laufende Nummer vor dem Titel (`numberedPubs`). */
  num?: number;
  variant?: 'split' | 'line'; dateCol?: number; labelRight?: boolean;
}) {
  const subLine = [sub, note].filter(Boolean);
  const body = (
    <div style={{ minWidth: 0 }}>
      {title && (
        <h3 style={{ margin: 0, fontFamily: P.heading, fontSize: fs(FS.entry, M), fontWeight: 600, color: C.ink, lineHeight: lh(LH.title, M) }}>
          {num != null && <span style={{ color: C.accent }}>{`[${num}] `}</span>}{title}
        </h3>
      )}
      {subLine.length > 0 && (
        <div style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), color: C.accent, marginTop: title ? sp(2, M) : 0 }}>
          {sub}
          {note ? <span style={{ color: C.inkSoft }}>{sub ? '  ·  ' : ''}{note}</span> : null}
        </div>
      )}
      {url ? <ExtraLink url={url} C={C} P={P} M={M} /> : null}
    </div>
  );
  const chip = date ? <DateChip C={C} P={P} M={M} align={tabular ? 'right' : undefined} font={dateFont}>{date}</DateChip> : null;
  if (variant) {
    return (
      <div style={{ minWidth: 0 }}>
        <SplitHead variant={variant} C={C} P={P} M={M} date={chip} titleSize={FS.entry}
          title={<>{num != null && <span style={{ color: C.accent }}>{`[${num}] `}</span>}{title}</>} hasTitle={!!title}
          sub={sub || null} note={note || null} />
        {url ? <ExtraLink url={url} C={C} P={P} M={M} /> : null}
      </div>
    );
  }
  if (tabular && rail) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: rail, alignItems: 'start' }}>
        <div style={{ paddingTop: `${fsn(FS.entry, M) * 0.22}px` }}>{chip}</div>
        <RailNode C={C} M={M} top={(fsn(FS.entry, M) * LH.title - 6.5 * M.t) / 2} />
        {body}
      </div>
    );
  }
  if (tabular) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `${dateCol}mm 1fr`, columnGap: `${DATE_GAP_MM}mm`, alignItems: 'start' }}>
        <div style={{ paddingTop: `${fsn(FS.entry, M) * 0.18}px`, textAlign: labelRight ? 'right' : undefined }}>{chip}</div>
        {body}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: sp(10, M) }}>
      <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
      {chip}
    </div>
  );
}

/** Fließtext unter einem Eintrag (Projektbeschreibung, Text eines freien
 *  Eintrags). Zeilenmaß und Farbe wie die Notizen der Ausbildung. */
function ExtraText({ text, C, P, M, wide }: { text: string; C: ThemeColors; P: FontPairing; M: Metrics; wide?: boolean }) {
  return (
    <p style={{
      fontFamily: P.body, fontSize: fs(FS.body, M), color: C.inkMid, lineHeight: lh(LH.body, M),
      margin: 0, maxWidth: wide ? undefined : '122mm', whiteSpace: 'pre-line',
    }}>{text}</p>
  );
}

// ── Name block ──────────────────────────────────────────────────────────────

/** Name, der nur an Wortzwischenräumen umbricht, nie am Bindestrich.
 *  „Vogt-Müller" in einer schmalen Spalte brach sonst zu „Vogt-" | „Müller",
 *  und im Textstrom des PDF stand der Nachname zerrissen auf zwei Zeilen
 *  (scripts/contactwrapcheck.mjs, Aarhus, 08.10.2026). */
function NameText({ name }: { name: string }) {
  if (!/-/.test(name)) return <>{name}</>;
  return <>{name.split(/(\s+)/).map((part, i) => (/^\s+$/.test(part) || !part
    ? part
    : <span key={i} style={{ whiteSpace: 'nowrap' }}>{part}</span>))}</>;
}

function NameBlock({ data, T, C, P, M, big, onPanel }: {
  data: CVData; T: ResumeTheme; C: ThemeColors; P: FontPairing; M: Metrics; big?: boolean; onPanel?: boolean;
}) {
  const ink = onPanel ? C.panelInk : (T.accentName ? C.accent : C.ink);
  const titleColor = onPanel ? C.panelAccent : C.accent;
  return (
    <div>
      {T.stackedName ? (
        /* Vorname oben, Nachname darunter — getrennt am LETZTEN Leerzeichen,
         * damit „Anna Maria Lemaire" nicht nach dem Vornamen bricht. */
        <h1 style={{
          margin: 0, fontFamily: P.heading,
          fontSize: fs((big ? FS.nameL : FS.nameS) * 1.42, M),
          fontWeight: 700, color: ink, lineHeight: 0.92,
          letterSpacing: '-0.028em', textTransform: 'uppercase',
          /* Erzwingt den Umbruch an jedem Wortzwischenraum, ohne dass der
           * Umbruch in den DATEN steht — der Name bleibt ein Feld, ein Wert,
           * eine beschreibbare Stelle. Ein hart eingesetztes <br> hätte
           * entweder die Daten verändert oder Vorschau und Export
           * auseinanderlaufen lassen. Auf die PDF-Textebene wirkt es nicht:
           * geprüft in pdfcheck.mjs (Lesereihenfolge, Wortgrenzen). */
          wordSpacing: '20em',
        }}>
          <Ed path="personal.name"><NameText name={data.personal.name} /></Ed>
        </h1>
      ) : (
      <h1 style={{
        margin: 0,
        fontFamily: T.trackedName ? P.body : P.heading,
        fontSize: fs((big ? FS.nameL : FS.nameS) * (T.trackedName ? 0.82 : 1), M),
        // Gesperrt wirkt der Name schon bei mittlerem Gewicht groß genug; 700
        // plus Sperrung ergibt eine Mauer statt einer Zeile.
        fontWeight: T.nameWeight ?? (T.trackedName ? 500 : 700), color: ink,
        lineHeight: 1.04,
        // 0,08 em ist keine Geschmacksentscheidung: ab 0,11 em zerlegt die
        // PDF-Textebene den Namen in Einzelbuchstaben, unabhängig vom
        // Schriftgrad (scripts/measure-tracking.mjs).
        letterSpacing: T.trackedName ? TRACK_CAPS : (T.uppercaseName ? '0.02em' : TRACK_NAME),
        textTransform: (T.uppercaseName || T.trackedName) ? 'uppercase' : 'none',
      }}><Ed path="personal.name"><NameText name={data.personal.name} /></Ed></h1>
      )}
      <div style={{
        fontFamily: P.body, fontSize: fs(FS.meta * 0.9, M), fontWeight: 600, letterSpacing: TRACK_CAPS,
        textTransform: 'uppercase', color: titleColor, marginTop: sp(8, M),
      }}><Ed path="personal.title">{data.personal.title}</Ed></div>
    </div>
  );
}

/** Kopfzeile jeder Folgeseite. Ohne sie ist eine lose zweite Seite nicht
 *  zuzuordnen — Personaler drucken Bewerbungen immer noch aus. */
function ContinuationHead({ data, C, P, M, pageIndex, pageCount }: {
  data: CVData; C: ThemeColors; P: FontPairing; M: Metrics; pageIndex: number; pageCount: number;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      borderBottom: `${0.9 * M.t}px solid ${C.rule}`, paddingBottom: sp(8, M), marginBottom: sp(4, M),
    }}>
      <span style={{ fontFamily: P.heading, fontSize: fs(FS.entry, M), fontWeight: 600, color: C.ink }}>{data.personal.name}</span>
      <span style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        <Ed path="labels.misc.cvLabel">{data.labels.misc.cvLabel}</Ed> · {pageIndex + 1}/{pageCount}
      </span>
    </div>
  );
}

/** Aus „Isestraße 88, 20149 Hamburg" wird „Hamburg".
 *  Unter einer Unterschrift steht der Ort, nicht die Anschrift — der
 *  Rückgriff auf das Adressfeld ergab sonst eine Zeile wie
 *  „Isestraße 88, 20149 Hamburg, 14. September 2026". */
function cityOf(location: string): string {
  // Getrennt wird an Komma UND an echtem Zeilenumbruch: seit die Anschrift
  // zweizeilig sein darf, steht der Ort meistens hinter einem Umbruch, nicht
  // hinter einem Komma.
  const last = (location || '').split(/[,\n]/).pop()?.trim() ?? '';
  return last.replace(/^\d{4,5}\s+/, '') || location;
}

/** Heutiges Datum in der Sprache des Dokuments — ausgeschrieben, wie es unter
 *  einer Unterschrift steht („14. September 2026"). */
function todayIn(lang: string): string {
  const loc = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' }[lang] ?? 'de-DE';
  return new Date().toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Main renderer ───────────────────────────────────────────────────────────

/** Reihenfolge, die volle-Breite-Layouts durchlaufen. Sidebar-Layouts parken
 *  Eckdaten/Sprachen und die ersten zwei Skillgruppen in der Seitenspalte. */
const DEFAULT_MAIN_ORDER: SectionKey[] = [
  'profile', 'details', 'experience', 'projects', 'education', 'certificates',
  'skills', 'languages', 'volunteering', 'publications', 'additional', 'custom',
];
const MAIN_ORDER_SIDEBAR: SectionKey[] = [
  'profile', 'experience', 'projects', 'education', 'certificates',
  'skills', 'volunteering', 'publications', 'additional', 'custom',
];


interface Props {
  data: CVData;
  theme: ResumeTheme;
  pairing: FontPairing;
  /** Vier getrennte Skalen statt einem globalen `density`. */
  metrics: Metrics;
  /** Sections, die der Nutzer ausgeblendet hat. */
  hiddenSections?: SectionKey[];
  /** Nutzerdefinierte Reihenfolge der Hauptspalte. */
  sectionOrder?: SectionKey[];
  pageFormat?: PageFormat;
  /** Ergebnis der Umbruchberechnung: Block-IDs je Seite. Fehlt es, landet
   *  alles auf einer Seite (Messmodus oder Kurz-Lebenslauf). */
  pageBlocks?: string[][];
  /** Messmodus: natürliche Höhe, keine Deckelung, Blöcke markiert. */
  measure?: boolean;
  /** Sections, vor denen der Nutzer einen harten Umbruch erzwungen hat. */
  forcedBreaks?: SectionKey[];
  /** Schaltet das direkte Bearbeiten in der Vorschau frei. Fehlt es (Export,
   *  Messlauf, geteilte Ansicht), bleibt jeder Text ein gewöhnlicher Textknoten. */
  inlineEdit?: InlineEditApi;
  /** Wie viele Skill-Gruppen die Seitenspalte tragen darf. Die Spalte ist nicht
   *  Teil der Flow-Pagination; passt ihr Inhalt nicht auf die Seite, würde er im
   *  PDF still abgeschnitten. Deshalb misst die Vorschau die Spalte und senkt
   *  diesen Wert (2 → 1 → 0), bis sie passt — die übrigen Gruppen wandern in die
   *  Hauptspalte, wo sie ganz normal umbrechen. */
  asideSkillCap?: number;
}

export default function ResumeRenderer({
  data, theme: T, pairing: P, metrics: metricsIn, hiddenSections = [], sectionOrder,
  pageFormat = 'a4', pageBlocks, measure, forcedBreaks = [], asideSkillCap = 2, inlineEdit,
}: Props) {
  /* Optischer Ausgleich zwischen den Schriftpaarungen: die Skala wird mit dem
     gemessenen x-Höhen-Faktor multipliziert, damit ein Lebenslauf in EB
     Garamond genauso groß wirkt wie einer in Inter — und nicht ein Fünftel
     kleiner. Die Untergrenze wird im selben Zug in eine x-Höhe umgerechnet,
     statt einen Punktwert zu behaupten. */
  const xF = P.xFactor ?? 1;
  /* Die x-Höhen-Grenze ist die VORGABE. Hat der Mensch den Regler unter die
   * Normalstellung gezogen, bringt die Metrik eine eigene, tiefere Grenze mit
   * — dann gilt seine. Sonst liefe der Regler in eine Wand, die er gar nicht
   * sehen kann, und „kleiner" hörte mitten in der Bewegung auf zu wirken. */
  const xFloor = MIN_X_HEIGHT_PX * xF / 0.54;
  const M: Metrics = {
    ...metricsIn,
    t: metricsIn.t * xF,
    minPx: Math.min(xFloor, metricsIn.minPx != null ? metricsIn.minPx * xF : xFloor),
  };
  const C = T.colors;
  const { profile, labels } = data;
  const sec = labels.sections;
  const hidden = new Set<SectionKey>(hiddenSections);
  const forced = new Set<SectionKey>(forcedBreaks);
  const fmt = getPageFormat(pageFormat);

  const isSidebar = T.layout === 'sidebar-left' || T.layout === 'sidebar-right';
  // header-band hat ebenfalls eine Nebenspalte. Vorher fehlte es hier — mit der
  // Folge, dass Eckdaten, Sprachen und ALLE Skillgruppen doppelt auf der Seite
  // standen (einmal Nebenspalte, einmal Hauptspalte) und die sieben Band-
  // Vorlagen deshalb über den Seitenrand liefen.
  const hasAside = isSidebar || (T.layout === 'header-band' && !T.bandSolo);
  const tabular = (((T.layout === 'single-column' || T.layout === 'timeline' || T.layout === 'top-centered') && !T.hangMm)
    || (T.layout === 'header-band' && !!T.bandSolo)) && !T.entryHead;
  /** Breite der Datumsspalte (`dateColMm`), Vorgabe wie bisher 26 mm. */
  const dc = T.dateColMm ?? DATE_COL_MM;
  /** Gemeinsame Angaben für alle Eintragsköpfe der Vorlagen vom 10.10.2026. */
  const headOpts = { variant: T.entryHead, dateCol: dc, labelRight: T.labelAlign === 'right' };
  /** Breiter Rand mit hängenden Überschriften (Weimar): Breite in mm, sonst 0. */
  const hang = !hasAside && T.hangMm ? T.hangMm : 0;
  /** Rasterspalten der Zeitachse (Kiel): Datum · Knoten · Text. */
  const rail = tabular && T.rail ? `${RAIL_DATE_MM}mm ${DATE_GAP_MM}mm minmax(0, 1fr)` : undefined;

  /* Wandert der Profiltext in die Seitenspalte, darf er in der Hauptspalte
   * nicht noch einmal auftauchen — sonst stünde er zweimal auf der Seite. */
  const profileAside = isSidebar && T.profileInSidebar === true;
  const defaultOrder: SectionKey[] = hasAside
    ? (profileAside ? MAIN_ORDER_SIDEBAR.filter(k => k !== 'profile') : MAIN_ORDER_SIDEBAR)
    : T.mainOrder ? templateOrder(T.mainOrder) : DEFAULT_MAIN_ORDER;
  const ownable = new Set<SectionKey>(defaultOrder);
  const mainOrder: SectionKey[] = (() => {
    if (!sectionOrder || !sectionOrder.length) return defaultOrder;
    const userKeys = sectionOrder.filter(k => ownable.has(k));
    const userSet = new Set(userKeys);
    const out: SectionKey[] = [...userKeys];
    for (let i = 0; i < defaultOrder.length; i++) {
      const k = defaultOrder[i];
      if (userSet.has(k)) continue;
      let insertAt = out.length;
      for (let j = i + 1; j < defaultOrder.length; j++) {
        const idx = out.indexOf(defaultOrder[j]);
        if (idx >= 0) { insertAt = idx; break; }
      }
      out.splice(insertAt, 0, k);
      userSet.add(k);
    }
    return out;
  })();

  // Die ersten zwei Skillgruppen leben in der Seitenspalte, der Rest in der
  // Hauptspalte — sonst füllt die Sidebar 94 % und die Hauptspalte 65 %.
  const asideCap = Math.max(0, Math.min(2, asideSkillCap));
  const asideSkills = hasAside ? data.skillGroups.slice(0, asideCap) : [];
  const mainSkills = hasAside ? data.skillGroups.slice(asideCap) : data.skillGroups;

  const profilePara = (color?: string) => (
    <p style={{
      fontFamily: P.body, fontSize: fs(FS.body, M), color: color ?? C.inkMid,
      // 122 mm Zeilenmaß, genau wie Stichpunkte und Notizen. Weil der Profiltext
      // in tabellarischen Layouts jetzt auf derselben Kante beginnt wie die
      // Einträge, endet er dort auch auf derselben — vorher liefen im selben
      // Absatzblock zwei verschiedene rechte Kanten nebeneinander her.
      lineHeight: lh(LH.body, M), margin: 0, maxWidth: T.wideMeasure ? undefined : '122mm', whiteSpace: 'pre-line',
    }}><Ed path="profile.text">{profile.text}</Ed></p>
  );
  /* Profil als Kasten (Freiburg) oder als Einleitungsabsatz (Graz). Beides
   * nur Rahmen und Schriftgrad — im Textstrom steht derselbe Absatz. */
  const profileFlow = (): React.ReactNode => {
    if (T.profileStyle === 'box') {
      return (
        <div style={{ background: C.chipBg, borderRadius: `${4 * M.t}px`, padding: `${pd(12, M)} ${pd(14, M)}` }}>
          {profilePara(C.inkMid)}
        </div>
      );
    }
    if (T.profileStyle === 'lead') {
      return (
        <div style={{ borderLeft: `${2.4 * M.t}px solid ${C.accent}`, paddingLeft: pd(12, M) }}>
          <p style={{
            fontFamily: P.body, fontSize: fs(FS.body * 1.14, M), color: C.ink,
            lineHeight: lh(LH.body, M), margin: 0, maxWidth: '132mm', whiteSpace: 'pre-line',
          }}><Ed path="profile.text">{profile.text}</Ed></p>
        </div>
      );
    }
    return profilePara();
  };

  // ── Blöcke der Hauptspalte bauen ──────────────────────────────────────────
  const GAP_SECTION = spn(20, M);   // vor einer neuen Sektion
  const GAP_ENTRY   = spn(14, M);   // zwischen zwei Einträgen
  const GAP_HEAD    = spn(6, M);    // Sektionstitel → erster Eintrag
  const GAP_BULLET  = spn(4, M);    // zwischen zwei Stichpunkten

  const blocks: FlowBlock[] = [];
  /**
   * In tabellarischen Layouts steht links eine Datumsspalte. Einträge setzen
   * ihren Text rechts davon — Profil, Eckdaten und Skills taten das nicht und
   * liefen über die volle Breite. Auf derselben Seite ergab das zwei rechte
   * Kanten und einen Profiltext, der 15 mm früher endete als die Stichpunkte.
   * Diese Hülle zieht die übrigen Abschnittsinhalte auf dieselbe Kante; die
   * Sektionstitel bleiben bewusst am linken Rand hängen.
   */
  const hangWrap = (node: React.ReactNode): React.ReactNode => (
    <div style={{ display: 'grid', gridTemplateColumns: `${hang}mm minmax(0, 1fr)` }}><div />{node}</div>
  );
  const indented = (node: React.ReactNode): React.ReactNode => (tabular
    ? (rail
      ? <div style={{ display: 'grid', gridTemplateColumns: rail }}><div /><div />{node}</div>
      : <div style={{ display: 'grid', gridTemplateColumns: `${dc}mm 1fr`, columnGap: `${DATE_GAP_MM}mm` }}>
        <div />{node}
      </div>)
    : hang ? hangWrap(node) : node);
  /** Eintragsköpfe und Unterschrift: im breiten Rand auf die Textkante
   *  gerückt, sonst unverändert (die Datumsspalte bringt ihr Raster selbst mit). */
  const onEdge = (node: React.ReactNode): React.ReactNode => (hang ? hangWrap(node) : node);
  /** Raster einer Stichpunktzeile — dieselben Spalten wie der Eintragskopf. */
  const bulletRow = (extraTimeline: boolean): React.CSSProperties | undefined => (rail
    ? { display: 'grid', gridTemplateColumns: rail }
    : tabular ? { display: 'grid', gridTemplateColumns: `${dc}mm 1fr`, columnGap: `${DATE_GAP_MM}mm` }
      : hang ? { display: 'grid', gridTemplateColumns: `${hang}mm minmax(0, 1fr)` }
        : (extraTimeline && T.layout === 'timeline' ? { paddingLeft: `${16 * M.t}px` } : undefined));
  /* Abschnittsüberschriften der Hauptspalte. Zählt mit, wo die Vorlage
   * nummeriert, und setzt die Überschrift bei der Zeitachse auf die
   * Textkante, mit einem Knoten auf der Linie. */
  let secNo = 0;
  const secTitle = (label: string, path?: string): React.ReactNode => {
    const t = <SectionTitle label={label} path={path} T={T} C={C} P={P} M={M} num={T.heading === 'numbered' ? ++secNo : undefined} />;
    if (!rail) return t;
    const line = fsn(FS.micro, M) * lh(LH.body, M);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: rail, alignItems: 'start' }}>
        <div />
        <RailNode C={C} M={M} top={(line - 7.5 * M.t) / 2} big />
        <div style={{ minWidth: 0 }}>{t}</div>
      </div>
    );
  };
  const push = (b: FlowBlock) => blocks.push(b);

  for (const key of mainOrder) {
    if (hidden.has(key)) continue;
    const breakBefore = forced.has(key);

    if (key === 'profile') {
      // Bei Sidebar-Layouts ohne Name-in-Sidebar sitzt das Profil im Kopf der
      // ersten Seite (siehe unten) und ist deshalb kein Flow-Block.
      if (!profile?.text) continue;
      if (isSidebar && !T.nameInSidebar) continue;
      push({
        id: 'profile', section: 'profile', gap: GAP_SECTION, breakBefore,
        node: <>{secTitle(sec.profile, 'labels.sections.profile')}{indented(T.profileStyle ? profileFlow() : profilePara())}</>,
      });
      continue;
    }

    if (key === 'details') {
      const rows = detailRows(data);
      if (!rows.length) continue;
      /* Der Tabellenkopf (Bamberg) trägt die Eckdaten schon. */
      if (T.head === 'facts') continue;
      push({
        id: 'details', section: 'details', gap: GAP_SECTION, breakBefore,
        node: (
          <>
            {secTitle(sec.details, 'labels.sections.details')}
            {indented(<div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(rows.length, 4)}, 1fr)`, gap: `${spn(12, M)}px ${spn(24, M)}px` }}>
              {rows.map(r => (
                <div key={r.k}>
                  <FieldLabel label={r.l} path={`labels.fields.${r.k}`} color={C.accent} P={P} M={M} bracket={T.bracketLabels} />
                  <div style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), color: C.inkMid, lineHeight: lh(LH.tight, M), overflowWrap: 'break-word', whiteSpace: 'pre-line' }}><Ed path={`personal.${r.k}`} block>{r.v}</Ed></div>
                </div>
              ))}
            </div>)}
          </>
        ),
      });
      continue;
    }

    if (key === 'experience') {
      const entries = data.experience.filter(e => !e.hidden);
      if (!entries.length) continue;
      push({
        id: 'experience:title', section: 'experience', gap: GAP_SECTION, keepWithNext: true, breakBefore,
        node: secTitle(sec.experience, 'labels.sections.experience'),
      });
      entries.forEach((e, i) => {
        push({
          id: `experience:${e.id}:head`, section: 'experience',
          gap: i === 0 ? GAP_HEAD : GAP_ENTRY,
          keepWithNext: e.bullets.length > 0,
          node: (
            <>
              {onEdge(<ExperienceHead e={e} data={data} C={C} P={P} M={M} tabular={tabular} timeline={T.layout === 'timeline'} isLast={i === entries.length - 1} rail={rail} dateFont={T.dateFont} {...headOpts} />)}
              {/* Nur mit Bearbeitungskontext, ohne Höhe, außerhalb des Flusses. */}
              <EntryTools kind="experience" id={e.id} index={data.experience.indexOf(e)} count={data.experience.length} />
            </>
          ),
        });
        e.bullets.forEach((b, bi) => {
          push({
            id: `experience:${e.id}:b${bi}`, section: 'experience',
            gap: bi === 0 ? spn(6, M) : GAP_BULLET,
            node: (
              <div style={bulletRow(true)}>
                {rail && <div />}
                {(tabular || hang > 0) && <div />}
                <BulletLine text={b} C={C} T={T} M={M} path={`experience.${e.id}.bullets.${bi}`} />
              </div>
            ),
          });
        });
      });
      continue;
    }

    if (key === 'education') {
      if (!data.education.length) continue;
      push({
        id: 'education:title', section: 'education', gap: GAP_SECTION, keepWithNext: true, breakBefore,
        node: secTitle(sec.education, 'labels.sections.education'),
      });
      data.education.forEach((e, i) => {
        push({
          id: `education:${e.id}`, section: 'education', gap: i === 0 ? GAP_HEAD : GAP_ENTRY,
          node: (
            <>
              {onEdge(<EducationEntryBlock e={e} C={C} P={P} M={M} tabular={tabular} rail={rail} dateFont={T.dateFont} {...headOpts} wide={T.wideMeasure} />)}
              <EntryTools kind="education" id={e.id} index={i} count={data.education.length} />
            </>
          ),
        });
      });
      continue;
    }

    if (key === 'skills') {
      if (!mainSkills.length) continue;
      /* Kenntnisse als Zeilen „Gruppe: A, B, C" unter einer Überschrift
       * (Tallinn). Die Form, in der Parser eine Kenntnisliste am sichersten
       * erkennen: ein Begriff, ein Doppelpunkt, eine Aufzählung. */
      if (T.skillsStyle === 'inline') {
        push({
          id: 'skills', section: 'skills', gap: GAP_SECTION, breakBefore,
          node: (
            <>
              {secTitle(skillsHeading(labels), 'labels.sections.skills')}
              {indented(
                <div style={{ display: 'flex', flexDirection: 'column', gap: sp(4, M) }}>
                  {mainSkills.map(g => {
                    const gi = data.skillGroups.indexOf(g);
                    return (
                      <div key={g.label} style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), color: C.inkMid, lineHeight: lh(LH.body, M), maxWidth: T.wideMeasure ? undefined : '132mm' }}>
                        <span style={{ fontWeight: 600, color: C.ink }}><Ed path={`skills.${gi}.label`}>{g.label}</Ed></span>{': '}
                        {g.items.map((it, i) => (
                          <React.Fragment key={`${it}-${i}`}>{i > 0 ? ', ' : ''}<Ed path={`skills.${gi}.items.${i}`}>{it}</Ed></React.Fragment>
                        ))}
                      </div>
                    );
                  })}
                </div>,
              )}
            </>
          ),
        });
        continue;
      }
      /* Je Gruppe ein getönter Kasten, zwei nebeneinander (Linz). */
      if (T.skillsStyle === 'panels') {
        push({
          id: 'skills', section: 'skills', gap: GAP_SECTION, breakBefore,
          node: indented(
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(mainSkills.length, 2)}, minmax(0, 1fr))`, gap: `${spn(10, M)}px ${spn(12, M)}px` }}>
              {mainSkills.map(g => (
                <div key={g.label} style={{ background: C.chipBg, borderRadius: `${4 * M.t}px`, padding: `${pd(11, M)} ${pd(13, M)}`, minWidth: 0 }}>
                  <SectionTitle label={g.label} path={`skills.${data.skillGroups.indexOf(g)}.label`} T={T} C={C} P={P} M={M} group />
                  <SkillGroupBlock group={g} T={T} C={C} P={P} M={M} pathBase={`skills.${data.skillGroups.indexOf(g)}.items`} />
                </div>
              ))}
            </div>,
          ),
        });
        continue;
      }
      const cols = Math.min(mainSkills.length, 3);
      push({
        id: 'skills', section: 'skills', gap: GAP_SECTION, breakBefore,
        node: indented(
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${spn(16, M)}px ${spn(24, M)}px` }}>
            {mainSkills.map(g => (
              <div key={g.label}>
                <SectionTitle label={g.label} path={`skills.${data.skillGroups.indexOf(g)}.label`} T={T} C={C} P={P} M={M} aside={T.groupHeads === 'small' ? true : undefined} group />
                <SkillGroupBlock group={g} T={T} C={C} P={P} M={M} pathBase={`skills.${data.skillGroups.indexOf(g)}.items`} />
              </div>
            ))}
          </div>,
        ),
      });
      continue;
    }

    if (key === 'languages') {
      if (!data.languages.length) continue;
      push({
        id: 'languages', section: 'languages', gap: GAP_SECTION, breakBefore,
        node: (
          <>
            {secTitle(sec.languages, 'labels.sections.languages')}
            {indented(<LangBlock data={data} C={C} P={P} M={M} columns={tabular || hang > 0 ? 2 : 1} />)}
          </>
        ),
      });
      continue;
    }

    if (key === 'additional') {
      if (!data.additionalExperience?.length) continue;
      push({
        id: 'additional', section: 'additional', gap: GAP_SECTION, breakBefore,
        node: (
          <>
            {secTitle(sec.additional, 'labels.sections.additional')}
            {indented(<SkillGroupBlock group={{ label: sec.additional, items: data.additionalExperience }} T={T} C={C} P={P} M={M} pathBase="additional" />)}
          </>
        ),
      });
      continue;
    }

    /* ── Eigene Abschnitte ──────────────────────────────────────────────────
     * Dieselbe Blockteilung wie beim Berufsweg: Überschrift klebt am ersten
     * Eintrag, Eintragskopf klebt an seinem Text, Stichpunkte fließen einzeln.
     * Die Kennungen tragen den Index statt der Eintrags-ID — ein Import mit
     * doppelten IDs darf keine Blöcke verschlucken. */
    const extraTitle = (k: FixedExtraKey) => push({
      id: `${k}:title`, section: k, gap: GAP_SECTION, keepWithNext: true, breakBefore,
      node: secTitle(sectionHeading(labels, k), `labels.sections.${k}`),
    });
    const bulletBlocks = (prefix: string, k: SectionKey, items: string[], firstGap: number, caption?: string, entry?: string) => {
      items.forEach((b, bi) => push({
        id: `${prefix}:b${bi}`, section: k, caption, entry,
        gap: bi === 0 ? firstGap : GAP_BULLET,
        node: (
          <div style={bulletRow(false)}>
            {rail && <div />}
            {(tabular || hang > 0) && <div />}
            <BulletLine text={b} C={C} T={T} M={M} />
          </div>
        ),
      }));
    };
    const present = labels.misc.present;

    if (key === 'projects') {
      const list = projectsOf(data);
      if (!list.length) continue;
      extraTitle('projects');
      list.forEach((e, i) => {
        const bullets = bulletsOf(e);
        const desc = (e.description || '').trim();
        const entry = [e.title, e.role].map(x => (x || '').trim()).filter(Boolean).join(' · ');
        push({
          id: `projects:${i}:head`, section: 'projects', entry,
          gap: i === 0 ? GAP_HEAD : GAP_ENTRY,
          keepWithNext: !!desc || bullets.length > 0,
          node: onEdge(<ExtraHead title={(e.title || '').trim()} sub={(e.role || '').trim()} url={(e.url || '').trim()} date={dateRange(e.start, e.end, present)} C={C} P={P} M={M} tabular={tabular} rail={rail} dateFont={T.dateFont} {...headOpts} />),
        });
        if (desc) push({
          id: `projects:${i}:desc`, section: 'projects', entry, gap: spn(4, M),
          node: indented(<ExtraText text={desc} C={C} P={P} M={M} wide={T.wideMeasure} />),
        });
        bulletBlocks(`projects:${i}`, 'projects', bullets, spn(desc ? 4 : 6, M), undefined, entry);
      });
      continue;
    }

    if (key === 'certificates') {
      const list = certificatesOf(data);
      if (!list.length) continue;
      extraTitle('certificates');
      list.forEach((c, i) => {
        push({
          id: `certificates:${i}`, section: 'certificates',
          gap: i === 0 ? GAP_HEAD : spn(10, M),
          node: onEdge(<ExtraHead title={(c.name || '').trim()} sub={(c.issuer || '').trim()} note={(c.credentialId || '').trim()} url={(c.url || '').trim()} date={(c.date || '').trim()} C={C} P={P} M={M} tabular={tabular} rail={rail} dateFont={T.dateFont} {...headOpts} />),
        });
      });
      continue;
    }

    if (key === 'volunteering') {
      const list = volunteeringOf(data);
      if (!list.length) continue;
      extraTitle('volunteering');
      list.forEach((v, i) => {
        const bullets = bulletsOf(v);
        const entry = [v.role, v.organization].map(x => (x || '').trim()).filter(Boolean).join(' · ');
        push({
          id: `volunteering:${i}:head`, section: 'volunteering', entry,
          gap: i === 0 ? GAP_HEAD : GAP_ENTRY,
          keepWithNext: bullets.length > 0,
          node: onEdge(<ExtraHead title={(v.role || '').trim()} sub={(v.organization || '').trim()} note={(v.location || '').trim()} date={dateRange(v.start, v.end, present)} C={C} P={P} M={M} tabular={tabular} rail={rail} dateFont={T.dateFont} {...headOpts} />),
        });
        bulletBlocks(`volunteering:${i}`, 'volunteering', bullets, spn(6, M), undefined, entry);
      });
      continue;
    }

    if (key === 'publications') {
      const list = publicationsOf(data);
      if (!list.length) continue;
      extraTitle('publications');
      list.forEach((p, i) => {
        const desc = (p.description || '').trim();
        push({
          id: `publications:${i}:head`, section: 'publications',
          gap: i === 0 ? GAP_HEAD : spn(10, M),
          keepWithNext: !!desc,
          node: onEdge(<ExtraHead title={(p.title || '').trim()} sub={(p.publisher || '').trim()} url={(p.url || '').trim()} date={(p.date || '').trim()} C={C} P={P} M={M} tabular={tabular} rail={rail} dateFont={T.dateFont} num={T.numberedPubs ? i + 1 : undefined} {...headOpts} />),
        });
        if (desc) push({
          id: `publications:${i}:desc`, section: 'publications', gap: spn(4, M),
          node: indented(<ExtraText text={desc} C={C} P={P} M={M} wide={T.wideMeasure} />),
        });
      });
      continue;
    }

    if (key === 'custom') {
      customSectionsOf(data).forEach((cs, si) => {
        const caption = (cs.title || '').trim();
        const items = customItemsOf(cs);
        const entries = customEntriesOf(cs);
        push({
          id: `custom:${si}:title`, section: 'custom', caption, gap: GAP_SECTION, keepWithNext: true,
          breakBefore: si === 0 ? breakBefore : undefined,
          node: secTitle(caption),
        });
        bulletBlocks(`custom:${si}:items`, 'custom', items, GAP_HEAD, caption);
        entries.forEach((e, i) => {
          const text = (e.text || '').trim();
          const title = (e.title || '').trim();
          const sub = (e.subtitle || '').trim();
          const date = (e.date || '').trim();
          const hasHead = !!(title || sub || date);
          const entry = [title, sub].filter(Boolean).join(' · ');
          const first = i === 0 && !items.length;
          if (hasHead) push({
            id: `custom:${si}:${i}:head`, section: 'custom', caption, entry,
            gap: first ? GAP_HEAD : GAP_ENTRY,
            keepWithNext: !!text,
            node: onEdge(<ExtraHead title={title} sub={sub} date={date} C={C} P={P} M={M} tabular={tabular} rail={rail} dateFont={T.dateFont} {...headOpts} />),
          });
          if (text) push({
            id: `custom:${si}:${i}:text`, section: 'custom', caption, entry,
            gap: hasHead ? spn(4, M) : (first ? GAP_HEAD : GAP_ENTRY),
            node: indented(<ExtraText text={text} C={C} P={P} M={M} wide={T.wideMeasure} />),
          });
        });
      });
      continue;
    }
  }

  /* Unterschrift am Blattfuß — „Hamburg, 14. September 2026" plus Schriftzug.
   *
   * Deutsche Konvention und in der Vorlagensammlung durchgehend vorhanden.
   * Bewusst ein Schriftzug in einer Schreibschrift und kein eingescanntes
   * Bild: jede Vorlage in der Sammlung, die eine Unterschrift zeigt, macht es
   * genauso. Das Werkzeug nennt es im Formular deshalb auch so und behauptet
   * nicht, es sei ein Scan.
   *
   * Das Datum ist standardmäßig HEUTE, nicht gespeichert: ein Lebenslauf mit
   * drei Monate altem Unterschriftsdatum ist ein Eigentor. Wer ein festes
   * Datum will, trägt es ein. */
  if (T.signature) {
    blocks.push({
      id: 'signature',
      section: 'additional',
      gap: spn(26, M),
      node: onEdge(
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp(2, M), maxWidth: '122mm' }}>
          <div style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), color: C.inkMid, lineHeight: lh(LH.tight, M) }}>
            <Ed path="personal.signatureCity">{data.personal.signatureCity || cityOf(data.personal.location)}</Ed>
            {', '}
            <Ed path="personal.signatureDate">{data.personal.signatureDate || todayIn(data.labels.lang)}</Ed>
          </div>
          <div style={{
            fontFamily: "'Caveat', 'Segoe Script', cursive",
            fontSize: fs(FS.nameS * 0.78, M), color: C.ink,
            lineHeight: 1.1, marginTop: sp(6, M),
          }}>{data.personal.name}</div>
        </div>
      ),
    });
  }

  const byId = new Map(blocks.map(b => [b.id, b]));
  const pages: string[][] = pageBlocks && pageBlocks.length && !measure
    ? pageBlocks
    : [blocks.map(b => b.id)];

  // ── Seitengerüst ──────────────────────────────────────────────────────────

  const pageStyle: React.CSSProperties = {
    width: `${fmt.widthMm}mm`,
    minHeight: measure ? undefined : `${fmt.heightMm}mm`,
    height: measure ? undefined : `${fmt.heightMm}mm`,
    background: C.pageBg,
    fontFamily: P.body,
    // Schriftgröße und Zeilenabstand werden auf der Seite selbst gesetzt,
    // damit nichts aus der Umgebung durchschlägt: in der App liegt Tailwinds
    // Preflight darüber, im exportierten HTML nur ein Minimal-Reset. Ohne
    // diese beiden Zeilen misst die Vorschau anders als das PDF — und genau
    // das würde die Seitenaufteilung verschieben.
    fontSize: fs(FS.body, M),
    lineHeight: lh(LH.body, M),
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    overflow: measure ? 'visible' : 'hidden',
    // Silbentrennung statt Zeichenmüll: `anywhere` zerhackte URLs und lange
    // Firmennamen mitten im Wort.
    overflowWrap: 'break-word',
    wordBreak: 'normal',
    // Silbentrennung ist raus. Zwei Gründe, beide belegt: in schmalen Spalten
    // zerlegt sie kurze Wörter („Eng-lisch"), und manche PDF-Textextraktoren
    // geben den weichen Trennstrich als harten Bindestrich aus — dann steht
    // „Projekt-management" im Parser-Text und die Stichwortsuche greift nicht.
    // scripts/pdfcheck.mjs prüft genau das.
    hyphens: 'none',
    WebkitHyphens: 'none',
  };

  const sectionLabel = (k?: SectionKey): string => {
    switch (k) {
      case 'profile': return sec.profile;
      case 'details': return sec.details;
      case 'experience': return sec.experience;
      case 'education': return sec.education;
      case 'languages': return sec.languages;
      case 'additional': return sec.additional;
      case 'projects': case 'certificates': case 'volunteering': case 'publications':
        return sectionHeading(labels, k);
      default: return '';
    }
  };

  /** Beginnt eine Seite mitten in einer Sektion, bekommt sie eine kleine
   *  Fortsetzungszeile. Ohne die steht auf Seite 2 eine Stichpunktliste ohne
   *  jeden Zusammenhang. */
  /** Wiedereinstieg oben auf einer Folgeseite.
   *
   *  „BERUFSERFAHRUNG — FORTSETZUNG" allein reichte nicht: begann die Seite mit
   *  einem einzelnen Stichpunkt, stand dort eine Aufgabe ohne erkennbare
   *  Station. Deshalb wird der Eintragskopf genannt, zu dem der erste Block
   *  gehört — Position und Firma, in der Zeile, die ohnehin dort steht. */
  const ContinuationCaption = ({ ids }: { ids: string[] }) => {
    /* Im Messlauf ist die Folgeseite leer — und genau dort wurde bisher die
     * Kapazität von Seite 2 abgelesen. Der Wiedereinstieg oben („BERUFS-
     * ERFAHRUNG — FORTSETZUNG" plus Eintragskopf) fehlte in dieser Messung,
     * weil er ohne Inhalt nichts zu zeigen hat. Ergebnis: Das Modell hielt
     * die Folgeseite für rund zwanzig Pixel höher, als sie ist, und setzte
     * eine Zeile zu viel darauf. Im gerenderten Blatt stand sie dann unter
     * der Kante — bei sechs der sechsundzwanzig Vorlagen, sichtbar erst mit
     * viel Inhalt. Deshalb misst der Messlauf hier einen Platzhalter in der
     * größten Form, die der Wiedereinstieg annehmen kann: zwei Zeilen.
     * Lieber eine Zeile zu früh umbrechen als eine Zeile abschneiden. */
    if (measure && ids.length === 0) {
      return (
        <div data-cv-caption-stub="1" style={{ marginBottom: sp(8, M) }} aria-hidden>
          <div style={{ fontFamily: P.body, fontSize: fs(FS.label, M), fontWeight: 700, letterSpacing: TRACK_CAPS, textTransform: 'uppercase', color: C.inkSoft }}>&nbsp;</div>
          <div style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), fontWeight: 600, color: C.accent, marginTop: sp(3, M) }}>&nbsp;</div>
        </div>
      );
    }
    const first = byId.get(ids[0]);
    if (!first || first.id.endsWith(':title')) return null;
    const label = first.caption ?? sectionLabel(first.section);
    if (!label) return null;
    const m = /^(experience|education):([^:]+):/.exec(first.id);
    /* Die eigenen Abschnitte tragen ihren Eintragskopf am Block mit — nur
     * wenn die Seite mitten im Eintrag beginnt, nicht vor seinem Kopf. */
    let entry = first.entry && !/:head$/.test(first.id) ? first.entry : '';
    if (m && m[1] === 'experience') {
      const e = data.experience.find(x => x.id === m[2]);
      if (e) entry = [e.role, e.company].filter(Boolean).join(' · ');
    }
    return (
      <div style={{ marginBottom: sp(8, M) }}>
        <div style={{
          fontFamily: P.body, fontSize: fs(FS.label, M), fontWeight: 700, letterSpacing: TRACK_CAPS,
          textTransform: 'uppercase', color: C.inkSoft,
        }}>{label} — Fortsetzung</div>
        {entry && (
          <div style={{
            fontFamily: P.body, fontSize: fs(FS.meta, M), fontWeight: 600, color: C.accent, marginTop: sp(3, M),
          }}>{entry}</div>
        )}
      </div>
    );
  };

  /** Rendert die Blockliste einer Seite mit den richtigen Zwischenabständen.
   *
   *  Aufeinanderfolgende Stichpunkte derselben Position werden dabei in eine
   *  echte <ul> gefasst. Das kostet nichts an der Umbruchrechnung (der Wrapper
   *  hat weder Rand noch Abstand), macht aus den Stichpunkten aber eine Liste
   *  statt einer Folge von Absätzen — für Screenreader wie für die
   *  Tag-Struktur des PDF. Bricht die Seite mitten in einer Position, entsteht
   *  auf jeder Seite eine eigene Liste; das ist korrekt, weil die Fortsetzung
   *  ohnehin eine neue Aufzählung ist. */
  const renderBlock = (id: string, i: number, asListItem: boolean) => {
    const b = byId.get(id);
    if (!b) return null;
    const style: React.CSSProperties = { marginTop: i === 0 ? 0 : `${b.gap}px` };
    const common = {
      key: id,
      'data-cv-block': measure ? id : undefined,
      'data-cv-gap': measure ? b.gap : undefined,
      'data-cv-keep': measure && b.keepWithNext ? '1' : undefined,
      'data-cv-break': measure && b.breakBefore ? '1' : undefined,
      'data-cv-section': b.section,
      style,
    };
    return asListItem
      ? <li {...common}>{b.node}</li>
      : <div {...common}>{b.node}</div>;
  };

  const BULLET_ID = /^experience:(.+):b\d+$/;
  /* Stichpunkte der eigenen Abschnitte bilden ebenso echte Listen. */
  const EXTRA_BULLET_ID = /^((?:projects|volunteering):\d+|custom:\d+:items):b\d+$/;
  const runOf = (id: string): string | null => {
    const m = BULLET_ID.exec(id);
    if (m) return m[1];
    const x = EXTRA_BULLET_ID.exec(id);
    return x ? x[1] : null;
  };

  const renderBlocks = (ids: string[]) => {
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < ids.length) {
      const entry = runOf(ids[i]);
      if (entry === null) { out.push(renderBlock(ids[i], i, false)); i++; continue; }
      const run: { id: string; idx: number }[] = [];
      while (i < ids.length) {
        const mm = runOf(ids[i]);
        if (mm !== entry) break;
        run.push({ id: ids[i], idx: i });
        i++;
      }
      out.push(
        <ul key={`ul-${entry}-${run[0].idx}`} style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {run.map(r => renderBlock(r.id, r.idx, true))}
        </ul>,
      );
    }
    return <>{out}</>;
  };

  const sidebarMm = T.sidebarMm ?? (T.layout === 'header-band' ? 58 : 62);
  /** Satzbreite der Seitenspalte in px (Spaltenbreite minus Innenabstand). */
  const asideAvailPx = sidebarMm * 96 / 25.4 - 2 * pdn(30, M);
  /* Kontaktangaben, die selbst eine Stufe kleiner nicht in die Spalte passen,
   * stehen unter dem Namen in voller Breite (siehe `contactFit`). Nur bei
   * Seitenspalten — Kopfband und einspaltige Vorlagen setzen den Kontakt
   * ohnehin in einer Zeile über die Breite. */
  const wideRows = isSidebar
    ? contactRows(data, !!inlineEdit).filter(r => r.kind !== 'address' && contactFit(r.v, asideAvailPx, P, M) === 'wide')
    : [];
  const wideKeys = new Set(wideRows.map(r => r.vp ?? r.v));
  const wideLine = wideRows.length > 0 ? (
    <div style={{
      marginTop: sp(8, M), display: 'flex', flexWrap: 'wrap', gap: `${spn(3, M)}px ${spn(10, M)}px`,
      fontFamily: P.body, fontSize: fs(FS.meta, M), color: C.inkMid,
    }}>
      {wideRows.map((r, i) => (
        <span key={i} style={{ whiteSpace: 'nowrap' }}>
          {i > 0 && <span style={{ color: `color-mix(in srgb, ${C.accent} 55%, transparent)` }}>{'·\u00A0'}</span>}<Ed path={r.vp as InlinePath | undefined}>{r.v}</Ed>
        </span>
      ))}
    </div>
  ) : null;
  /* Seitenspalte ohne Farbfläche: dann gelten für ihren Text die Farben der
   * Seite, nicht die des Panels — sonst stünde heller Panel-Ton auf weißem
   * Papier. Getrennt wird stattdessen mit einer Haarlinie. */
  const plainPanel = isSidebar && T.panelFill === false;

  const AsideContent = ({ onPanel, skipContact, part = 'all' }: { onPanel: boolean; skipContact?: boolean; part?: AsidePart }) => (
    <>
      {part !== 'rest' && !skipContact && (
        <div><SectionTitle label={sec.personal} path="labels.sections.personal" T={T} C={C} P={P} M={M} onPanel={onPanel} aside /><ContactBlock data={data} C={C} P={P} M={M} onPanel={onPanel} bracket={T.bracketLabels} availPx={asideAvailPx} wide={wideKeys} /></div>
      )}
      {part === 'head' ? null : <>
      {profileAside && !hidden.has('profile') && profile.text.trim() && (
        <div><SectionTitle label={sec.profile} path="labels.sections.profile" T={T} C={C} P={P} M={M} onPanel={onPanel} aside />{profilePara(onPanel ? C.panelInkSoft : C.inkMid)}</div>
      )}
      {!hidden.has('details') && detailRows(data).length > 0 && (
        <div><SectionTitle label={sec.details} path="labels.sections.details" T={T} C={C} P={P} M={M} onPanel={onPanel} aside /><DetailBlock data={data} C={C} P={P} M={M} onPanel={onPanel} bracket={T.bracketLabels} /></div>
      )}
      {!hidden.has('languages') && data.languages.length > 0 && (
        <div><SectionTitle label={sec.languages} path="labels.sections.languages" T={T} C={C} P={P} M={M} onPanel={onPanel} aside /><LangBlock data={data} C={C} P={P} M={M} onPanel={onPanel} /></div>
      )}
      {!hidden.has('skills') && asideSkills.map(g => (
        <div key={g.label}><SectionTitle label={g.label} path={`skills.${data.skillGroups.indexOf(g)}.label`} T={T} C={C} P={P} M={M} onPanel={onPanel} aside /><SkillGroupBlock group={g} T={T} C={C} P={P} M={M} onPanel={onPanel} pathBase={`skills.${data.skillGroups.indexOf(g)}.items`} /></div>
      ))}
      </>}
    </>
  );

  /** Seitenspalte. Auf Folgeseiten bleibt sie als Fläche stehen (sonst würde
   *  sich die Spaltenbreite der Hauptspalte ändern und jede Höhenmessung von
   *  Seite 1 wäre für Seite 2 falsch), trägt dort aber nur den Namen.
   *
   *  `part` teilt die Spalte in Kopf (Foto, Name, Kontakt) und Rest (Eckdaten,
   *  Sprachen, Skills). Bei Vorlagen, die den Namen in die Seitenspalte legen,
   *  wird der Kopf im DOM VOR die Hauptspalte gestellt und der Rest dahinter —
   *  visuell bleibt beides untereinander in derselben Spalte, im PDF-Textstrom
   *  steht der Name aber vorn. Das ersetzt den früheren unsichtbaren
   *  Wiederholungsblock: kein verborgener Text, nur richtige Reihenfolge. */
  const renderAside = (
    pageIndex: number,
    onPanel: boolean,
    skipContact?: boolean,
    part: AsidePart = 'all',
    place?: React.CSSProperties,
  ) => (
    <div data-cv-aside={measure ? '1' : undefined} style={{
      width: `${sidebarMm}mm`, flexShrink: 0, minWidth: 0,
      background: onPanel ? C.panelBg : C.pageBg,
      // Die Trennlinie gehört zur zweispaltigen Seite. Auf Folgeseiten trägt
      // die Spalte nur noch den Namen — eine Linie, die daneben durch leeres
      // Papier bis zum Blattfuß läuft, sieht nach Fehldruck aus.
      borderLeft: (!onPanel && T.layout === 'header-band' && pageIndex === 0)
        || (plainPanel && T.layout === 'sidebar-right' && pageIndex === 0)
        ? `${0.9 * M.t}px solid ${C.rule}` : undefined,
      borderRight: plainPanel && T.layout === 'sidebar-left' && pageIndex === 0
        ? `${0.9 * M.t}px solid ${C.rule}` : undefined,
      padding: part === 'head' ? `${pd(40, M)} ${pd(30, M)} ${sp(20, M)}`
        : part === 'rest' ? `0 ${pd(30, M)} ${pd(40, M)}`
        : `${pd(40, M)} ${pd(30, M)}`,
      display: 'flex', flexDirection: 'column', gap: sp(24, M),
      ...place,
    }}>
      {pageIndex === 0 ? (
        <>
          {/* `skipContact` markiert die Band-Layouts: dort stehen Foto, Name und
              Kontakt bereits im Kopfbalken. Ohne diese Bedingung zeigte die
              Seite zwei Bewerbungsfotos — in Lissabon, Terrakotta, Pikachu und
              Leafish gut sichtbar. */}
          {part !== 'rest' && !skipContact && T.photo !== 'none' && data.personal.photo && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: sp(4, M) }}>
              <Photo data={data} T={T} C={C} widthMm={T.photo === 'circle' ? 34 : Math.min(48, sidebarMm - 24)} />
            </div>
          )}
          {part !== 'rest' && T.nameInSidebar && (
            <div>
              <NameBlock data={data} T={T} C={C} P={P} M={M} onPanel={onPanel} />
              <div style={{ height: '1px', background: onPanel ? C.panelInkSoft : C.rule, opacity: onPanel ? 0.35 : 1, margin: `${sp(12, M)} 0 0` }} />
            </div>
          )}
          <AsideContent onPanel={onPanel} skipContact={skipContact} part={part} />
        </>
      ) : onPanel ? (
        /* Befund vom 14.09.2026: Auf Seite 2 stand hier ein sechs Zentimeter
         * breiter Farbbalken mit einem einzigen Wort darin — bei Bordeaux,
         * Patterson und Seoul ein dunkler Block über die ganze Blatthöhe.
         * Das sieht nicht nach Gestaltung aus, sondern nach Fehldruck, und
         * verbraucht auf jedem Folgeblatt Farbe für nichts.
         *
         * Statt die Spalte auf Folgeseiten wegzulassen — das verschöbe die
         * Textspalte mitten im Dokument und machte die gemessenen Blockhöhen
         * ungültig — trägt sie jetzt, was auf einem losen zweiten Blatt
         * wirklich hilft: Name, E-Mail, Telefon. Wer die Seiten trennt, kann
         * sie wieder zuordnen und den Absender anrufen. */
        <div style={{ display: 'flex', flexDirection: 'column', gap: sp(14, M) }}>
          <div style={{
            fontFamily: P.body, fontSize: fs(FS.micro, M), letterSpacing: TRACK_CAPS, textTransform: 'uppercase',
            fontWeight: 600, color: C.panelInk,
          }}>{data.personal.name}</div>
          {/* Nur, was am Stück in die Spalte passt: eine E-Mail, die hier
              umbräche, wäre für einen Parser kaputt — und sie steht auf
              Seite 1 ohnehin vollständig. */}
          {[data.personal.email, data.personal.phone].map(v => (v || '').trim())
            .filter(v => v && textWidthPx(v, fsn(FS.label, M), P.body) * FIT_SAFETY <= asideAvailPx)
            .map((v, i) => (
            <div key={i} style={{
              fontFamily: P.body, fontSize: fs(FS.label, M), color: C.panelInkSoft, lineHeight: lh(LH.tight, M),
              whiteSpace: 'nowrap',
            }}>{v}</div>
          ))}
        </div>
      ) : null /* Bandlayouts tragen den Namen auf Folgeseiten schon im
                  Kopfbalken — zweimal derselbe Name auf einer halbleeren
                  Seite las sich wie ein Rest. */}
    </div>
  );

  /** Kopfbereich der Hauptspalte auf Seite 1 (Name, Trennlinie, Profiltext). */
  const mainHead = (
    <div>
      <NameBlock data={data} T={T} C={C} P={P} M={M} big />
      {wideLine}
      <div style={{ height: `${0.9 * M.t}px`, background: C.rule, margin: `${sp(16, M)} 0` }} />
      {!hidden.has('profile') && profile?.text && profilePara()}
    </div>
  );

  const mainColumn = (pageIndex: number, ids: string[], pageCount: number, padding: string) => (
    <div
      data-cv-main={measure ? '1' : undefined}
      style={{ flex: 1, padding, display: 'flex', flexDirection: 'column', minWidth: 0 }}
    >
      {pageIndex === 0 ? (
        isSidebar && !T.nameInSidebar
          ? <div data-cv-chrome={measure ? '1' : undefined}>{mainHead}</div>
          /* Name in der Seitenspalte: Was dort nicht hineinpasst, steht oben in
           * der Hauptspalte — im Textstrom direkt nach Name und Kontakt. */
          : isSidebar && wideLine
            ? <div data-cv-chrome={measure ? '1' : undefined} style={{ marginBottom: sp(12, M) }}>{wideLine}</div>
            : null
      ) : (
        <ContinuationHead data={data} C={C} P={P} M={M} pageIndex={pageIndex} pageCount={pageCount} />
      )}
      <div style={{ marginTop: pageIndex === 0 && isSidebar && !T.nameInSidebar ? `${spn(20, M)}px` : 0 }}>
        {pageIndex > 0 && <ContinuationCaption ids={ids} />}
        {renderBlocks(ids)}
      </div>
    </div>
  );

  // ── Kopf der einspaltigen Vorlagen (`head`) ───────────────────────────────

  const editing = !!inlineEdit;
  const hasPhoto = T.photo !== 'none' && !!data.personal.photo;
  /** Kontakt als fortlaufende Zeile mit Mittelpunkten (wie im Standardkopf). */
  const contactLine = (extra?: React.CSSProperties) => (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: `${spn(3, M)}px ${spn(10, M)}px`,
      fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkSoft, ...extra,
    }}>
      {inlineContact(data.personal, editing).map((r, i) => (
        <span key={i} style={{ whiteSpace: 'nowrap' }}>
          {i > 0 && <span style={{ color: `color-mix(in srgb, ${C.accent} 55%, transparent)` }}>{'·\u00A0'}</span>}<Ed path={r.path}>{r.v}</Ed>
        </span>
      ))}
    </div>
  );

  const fullWidthHead = (wide: { padH: string; padV: string }): React.ReactNode => {
    if (T.head === 'facts') {
      /* Tabellenkopf: Anschrift, Telefon, E-Mail … und die Eckdaten als
       * Zeilen aus Bezeichnung und Wert. Die Bezeichnungen stehen in der
       * Spalte, in der darunter die Daten des Werdegangs stehen — Kopf und
       * Körper teilen ein Raster. Ein einzelnes langes Wort
       * („Staatsangehörigkeit", rund 29 mm) ragt in den Steg hinein, statt
       * die Wertespalte zu verschieben oder mitten im Wort zu brechen;
       * mehrere Wörter brechen an Leerzeichen. */
      const order: Record<string, number> = { address: 0, phone: 1, email: 2, web: 3, social: 4 };
      const rows = [
        ...contactRows(data, editing).sort((a, b) => order[a.kind] - order[b.kind])
          .map(r => ({ l: r.l, lp: r.lp, v: r.v, vp: r.vp, href: r.href, multi: r.kind === 'address' })),
        ...(hidden.has('details') ? [] : detailRows(data).map(r => ({
          l: r.l, lp: `labels.fields.${r.k}`, v: r.v, vp: `personal.${r.k}`, href: undefined as string | undefined, multi: true,
        }))),
      ];
      return (
        <div style={{ padding: `${wide.padV} ${wide.padH} ${sp(24, M)}`, display: 'flex', alignItems: 'flex-start', gap: sp(28, M) }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NameBlock data={data} T={T} C={C} P={P} M={M} big />
            {rows.length > 0 && (
              <div style={{
                marginTop: sp(20, M), display: 'grid',
                gridTemplateColumns: `${dc}mm minmax(0, 1fr)`,
                columnGap: `${DATE_GAP_MM}mm`, rowGap: sp(3.5, M), alignItems: 'baseline',
              }}>
                {rows.map((r, i) => {
                  const value = editing && r.vp ? <Ed path={r.vp} block>{r.v}</Ed> : r.v;
                  return (
                    <React.Fragment key={i}>
                      <div style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), fontWeight: 600, color: C.inkSoft, letterSpacing: '0.01em', lineHeight: lh(LH.tight, M), overflowWrap: 'normal', wordBreak: 'normal', hyphens: 'none', textAlign: T.labelAlign === 'right' ? 'right' : undefined }}>
                        {r.lp ? <Ed path={r.lp}>{r.l}</Ed> : r.l}
                      </div>
                      <div style={{
                        fontFamily: P.body, fontSize: fs(FS.meta, M), color: C.ink, lineHeight: lh(LH.tight, M), minWidth: 0,
                        whiteSpace: r.multi ? 'pre-line' : 'nowrap', overflowWrap: r.multi ? 'break-word' : undefined,
                      }}>
                        {r.href && !editing ? <a href={r.href} style={{ color: 'inherit', textDecoration: 'none' }}>{value}</a> : value}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
          {hasPhoto && <Photo data={data} T={T} C={C} widthMm={30} />}
        </div>
      );
    }
    /* Name und Kontaktzeile mittig (Dublin). Ein Foto steht, wenn die
     * Vorlage eines zulässt, mittig darüber. */
    if (T.head === 'center') {
      return (
        <div style={{ padding: `${wide.padV} ${wide.padH} ${sp(14, M)}`, textAlign: 'center' }}>
          {hasPhoto && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: sp(10, M) }}><Photo data={data} T={T} C={C} widthMm={26} /></div>}
          <NameBlock data={data} T={T} C={C} P={P} M={M} big />
          {contactLine({ marginTop: sp(10, M), justifyContent: 'center', color: C.inkMid })}
        </div>
      );
    }
    /* Foto links, Name und Kontakt daneben, darunter eine Linie im Akzent
     * (Freiburg). */
    if (T.head === 'photo-left') {
      return (
        <div style={{
          padding: `${wide.padV} ${wide.padH} ${sp(20, M)}`, display: 'flex', alignItems: 'center', gap: sp(22, M),
          borderBottom: `${1.2 * M.t}px solid ${C.accent}`,
        }}>
          {hasPhoto && <Photo data={data} T={T} C={C} widthMm={30} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <NameBlock data={data} T={T} C={C} P={P} M={M} big />
            {contactLine({ marginTop: sp(10, M) })}
          </div>
        </div>
      );
    }
    /* Akzentstrich am linken Rand von Name und Kontakt (Graz). */
    if (T.head === 'bar') {
      return (
        <div style={{ padding: `${wide.padV} ${wide.padH} ${sp(18, M)}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: sp(22, M) }}>
            <div style={{ flex: 1, minWidth: 0, borderLeft: `${3.2 * M.t}px solid ${C.accent}`, paddingLeft: pd(14, M) }}>
              <NameBlock data={data} T={T} C={C} P={P} M={M} big />
              {contactLine({ marginTop: sp(10, M) })}
            </div>
            {hasPhoto && <Photo data={data} T={T} C={C} widthMm={26} />}
          </div>
          <div aria-hidden style={{ height: `${0.9 * M.t}px`, background: C.rule, marginTop: sp(18, M) }} />
        </div>
      );
    }
    /* Name links, rechts Kontakt und Links als Liste aus Bezeichnung und
     * Wert (Valencia). Jede Zeile bleibt am Stück — eine umgebrochene
     * Adresse ist für einen Parser kaputt. */
    if (T.head === 'portfolio') {
      const rows = contactRows(data, editing).filter(r => r.kind !== 'address');
      const addr = (data.personal.location || '').replace(/\s*\n+\s*/g, ', ');
      return (
        <div style={{ padding: `${wide.padV} ${wide.padH} ${sp(20, M)}`, borderBottom: `${0.9 * M.t}px solid ${C.rule}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: sp(22, M) }}>
            {hasPhoto && <Photo data={data} T={T} C={C} widthMm={24} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <NameBlock data={data} T={T} C={C} P={P} M={M} big />
              {addr && <div style={{ marginTop: sp(8, M), fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkSoft }}>{addr === data.personal.location ? <Ed path="personal.location">{addr}</Ed> : addr}</div>}
            </div>
            {rows.length > 0 && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'auto auto', columnGap: sp(10, M), rowGap: sp(2.5, M),
                alignItems: 'baseline', flexShrink: 0,
              }}>
                {rows.map((r, i) => (
                  <React.Fragment key={i}>
                    <div style={{ fontFamily: P.body, fontSize: fs(FS.label, M), fontWeight: 700, letterSpacing: TRACK_CAPS, textTransform: 'uppercase', color: C.accent, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {r.lp ? <Ed path={r.lp}>{r.l}</Ed> : r.l}
                    </div>
                    <div style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkMid, whiteSpace: 'nowrap', lineHeight: lh(LH.tight, M) }}>
                      {editing && r.vp ? <Ed path={r.vp}>{r.v}</Ed> : r.href ? <a href={r.href} style={{ color: 'inherit', textDecoration: 'none' }}>{r.v}</a> : r.v}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (T.head === 'letter') {
      /* Briefkopf: Name links, Kontakt rechtsbündig gestapelt, darunter eine
       * doppelte Linie — kräftig, dann fein. */
      return (
        <div style={{ padding: `${wide.padV} ${wide.padH} 0` }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: sp(22, M) }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NameBlock data={data} T={T} C={C} P={P} M={M} big />
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: sp(2.5, M), textAlign: 'right',
              fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkMid, lineHeight: lh(LH.tight, M),
            }}>
              {inlineContact(data.personal, editing).map((r, i) => (
                <div key={i} style={{ whiteSpace: 'nowrap' }}><Ed path={r.path}>{r.v}</Ed></div>
              ))}
            </div>
            {hasPhoto && <Photo data={data} T={T} C={C} widthMm={24} />}
          </div>
          <div aria-hidden style={{
            marginTop: sp(16, M), height: `${2.4 * M.t}px`,
            borderTop: `${1.6 * M.t}px solid ${C.accent}`, borderBottom: `${0.6 * M.t}px solid ${C.accent}`,
            boxSizing: 'content-box',
          }} />
        </div>
      );
    }
    /* `margin`: Foto im Rand, Name und Kontakt auf der Textkante — dieselbe
     * Kante, auf der darunter jeder Eintrag beginnt. */
    const m = T.hangMm ?? 34;
    return (
      <div style={{
        padding: `${wide.padV} ${wide.padH} ${sp(24, M)}`,
        display: 'grid', gridTemplateColumns: `${m}mm minmax(0, 1fr)`, alignItems: 'end',
        borderBottom: `${0.9 * M.t}px solid ${C.rule}`,
      }}>
        <div>{hasPhoto && <Photo data={data} T={T} C={C} widthMm={m - 10} />}</div>
        <div style={{ minWidth: 0 }}>
          <NameBlock data={data} T={T} C={C} P={P} M={M} big />
          {contactLine({ marginTop: sp(12, M) })}
        </div>
      </div>
    );
  };

  // ── Layouts ───────────────────────────────────────────────────────────────

  const pageCount = pages.length;

  const renderPage = (ids: string[], pageIndex: number): React.ReactNode => {
    const key = `page-${pageIndex}`;

    if (isSidebar) {
      const main = mainColumn(pageIndex, ids, pageCount, `${pd(60, M)} ${pd(53, M)}`);
      // Die Hauptspalte steht IMMER zuerst im DOM — auch wenn die Seitenspalte
      // links liegt; das regelt row-reverse rein visuell. Grund: der PDF-
      // Content-Stream folgt der DOM-Reihenfolge, und ein Parser ohne Layout-
      // analyse las vorher „PERSÖNLICHES, E-MAIL, …" bevor der Name kam.
      // Jetzt beginnt der Strom mit Name, Profil, Berufserfahrung — die
      // Seitenspalte folgt als eigener Block am Ende. Geprüft in pdfcheck.mjs.
      // Bewusst Grid mit expliziter Spaltenzuweisung statt flex row-reverse:
      // Flex-Items werden in order-modifizierter Reihenfolge GEMALT, und
      // Chromiums PDF-Textstrom folgt der Malreihenfolge — row-reverse hätte
      // die Seitenspalte wieder nach vorn geholt. Grid-Items ohne `order`
      // werden in DOM-Reihenfolge gemalt.
      const left = T.layout === 'sidebar-left';
      const sideCol = left ? 1 : 2;
      const mainCol = left ? 2 : 1;
      // Trägt die Seitenspalte den Namen, wird sie in zwei Rasterzellen
      // übereinander zerlegt: Kopf (Foto, Name, Kontakt) vor der Hauptspalte,
      // Rest dahinter. Optisch eine durchgehende Spalte, im Textstrom die
      // Reihenfolge Name → Kontakt → Profil → Erfahrung → Skills.
      const split = pageIndex === 0 && !!T.nameInSidebar;
      return (
        <div className="cv-page" key={key} data-cv-measure-page={measure ? String(pageIndex) : undefined} style={pageStyle}>
          <div style={{
            display: 'grid', flex: 1, minHeight: 0,
            gridTemplateColumns: left ? `${sidebarMm}mm minmax(0, 1fr)` : `minmax(0, 1fr) ${sidebarMm}mm`,
            gridTemplateRows: split ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)',
          }}>
            {/* gridRow explizit: die Auto-Platzierung packt „sparse" und würde
                die Seitenspalte sonst in eine zweite Zeile schieben, sobald die
                Hauptspalte zuerst in Spalte 2 gelandet ist. */}
            {split && renderAside(pageIndex, !plainPanel, false, 'head', { gridColumn: sideCol, gridRow: 1, width: 'auto' })}
            <div style={{ gridColumn: mainCol, gridRow: split ? '1 / span 2' : 1, display: 'flex', minWidth: 0 }}>{main}</div>
            {renderAside(pageIndex, !plainPanel, false, split ? 'rest' : 'all', { gridColumn: sideCol, gridRow: split ? 2 : 1, width: 'auto' })}
          </div>
        </div>
      );
    }

    if (T.layout === 'header-band') {
      return (
        <div className="cv-page" key={key} data-cv-measure-page={measure ? String(pageIndex) : undefined} style={pageStyle}>
          {pageIndex === 0 ? (
            <div style={{
              background: C.panelBg, color: C.panelInk, padding: `${pd(44, M)} ${pd(50, M)}`,
              display: 'flex', alignItems: 'center', gap: sp(24, M),
              borderBottom: T.bandRule ? `${2.4 * M.t}px solid ${C.accent}` : undefined,
            }}>
              {T.photo !== 'none' && data.personal.photo && <Photo data={data} T={T} C={C} widthMm={T.photo === 'circle' ? 30 : 28} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <NameBlock data={data} T={T} C={C} P={P} M={M} big onPanel />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: sp(3, M), textAlign: 'right' }}>
                {inlineContact(data.personal, !!inlineEdit).map((r, i) => (
                  <div key={i} style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.panelInkSoft, whiteSpace: 'nowrap' }}><Ed path={r.path}>{r.v}</Ed></div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: C.panelBg, color: C.panelInk, padding: `${pd(20, M)} ${pd(50, M)}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              borderBottom: T.bandRule ? `${1.6 * M.t}px solid ${C.accent}` : undefined,
            }}>
              <span style={{ fontFamily: P.heading, fontSize: fs(FS.entry, M), fontWeight: 600 }}>{data.personal.name}</span>
              <span style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.panelInkSoft, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                <Ed path="labels.misc.cvLabel">{data.labels.misc.cvLabel}</Ed> · {pageIndex + 1}/{pageCount}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div
              data-cv-main={measure ? '1' : undefined}
              style={{ flex: 1, padding: `${pd(52, M)} ${pd(50, M)}`, display: 'flex', flexDirection: 'column', minWidth: 0 }}
            >
              {pageIndex > 0 && <ContinuationCaption ids={ids} />}
              {renderBlocks(ids)}
            </div>
            {!T.bandSolo && renderAside(pageIndex, false, true)}
          </div>
        </div>
      );
    }

    // top-centered / single-column / timeline — volle Breite, tabellarisch
    /* Ein Name in Anzeigengröße bringt seinen eigenen Weißraum mit: über zwei
     * Zeilen gesetzt wirkt er mit 64 px Vorlauf nicht luftig, sondern
     * abgerutscht — und kostet die Hauptspalte eine Zeile. In den Vorlagen von
     * Etsy und Pinterest steht ein solcher Name dicht an der oberen Kante. */
    const wide = T.layout === 'top-centered'
      ? { padH: pd(72, M), padV: pd(T.stackedName ? 44 : 64, M) }
      : { padH: pd(76, M), padV: pd(68, M) };

    return (
      <div className="cv-page" key={key} data-cv-measure-page={measure ? String(pageIndex) : undefined} style={pageStyle}>
        {pageIndex === 0 && T.head ? fullWidthHead(wide) : pageIndex === 0 ? (
          <div style={{
            padding: `${wide.padV} ${wide.padH} ${sp(20, M)}`,
            display: 'flex', alignItems: T.photo !== 'none' && data.personal.photo ? 'flex-start' : 'flex-end', gap: sp(20, M),
            borderBottom: `${1.2 * M.t}px solid ${C.accent}`,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NameBlock data={data} T={T} C={C} P={P} M={M} big />
              <div style={{
                marginTop: sp(10, M),
                display: 'flex', flexWrap: 'wrap', gap: `${spn(3, M)}px ${spn(10, M)}px`,
                fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.inkSoft,
              }}>
                {/* Der Trenner leitet den FOLGENDEN Eintrag ein und klebt an
                    ihm. Andersherum endete eine Zeile mit „Hamburg ·" und der
                    Punkt hing am Zeilenausgang in der Luft. */}
                {inlineContact(data.personal, !!inlineEdit).map((r, i) => (
                  <span key={i} style={{ whiteSpace: 'nowrap' }}>
                    {i > 0 && <span style={{ color: `color-mix(in srgb, ${C.accent} 55%, transparent)` }}>{'·\u00A0'}</span>}<Ed path={r.path}>{r.v}</Ed>
                  </span>
                ))}
              </div>
            </div>
            {T.photo !== 'none' && data.personal.photo && (
              <div style={{ flexShrink: 0 }}>
                <Photo data={data} T={T} C={C} widthMm={T.photo === 'circle' ? 32 : 30} />
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: `${wide.padV} ${wide.padH} 0` }}>
            <ContinuationHead data={data} C={C} P={P} M={M} pageIndex={pageIndex} pageCount={pageCount} />
          </div>
        )}
        <div
          data-cv-main={measure ? '1' : undefined}
          style={{ flex: 1, padding: `${sp(20, M)} ${wide.padH} ${wide.padV}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          {pageIndex > 0 && <ContinuationCaption ids={ids} />}
          {rail ? (
            /* Die Zeitachse: eine Haarlinie als Hintergrund dieser Hülle. Sie
             * beginnt am ersten und endet am letzten Block der Seite — nicht
             * am Blattfuß, sonst liefe sie auf der letzten Seite durch leeres
             * Papier. Flex wie die Hauptspalte, damit sich an den Abständen
             * der Blöcke nichts ändert. */
            <div style={{
              display: 'flex', flexDirection: 'column',
              backgroundImage: `linear-gradient(${C.rule}, ${C.rule})`, backgroundRepeat: 'no-repeat',
              backgroundSize: `${0.9 * M.t}px 100%`,
              backgroundPosition: `calc(${RAIL_DATE_MM + DATE_GAP_MM / 2}mm - ${0.45 * M.t}px) 0`,
            }}>{renderBlocks(ids)}</div>
          ) : renderBlocks(ids)}
        </div>
      </div>
    );
  };

  if (measure) {
    // Messmodus: Seite 1 in natürlicher Höhe mit allen Blöcken, dazu eine
    // LEERE Folgeseite. Aus deren Innenkante lässt sich die Kapazität von
    // Seite 2+ exakt ablesen, statt sie aus Paddings zusammenzurechnen.
    // Bewusst OHNE Bearbeitungskontext: das Messexemplar ist unsichtbar, und
    // ein zweites beschreibbares Feld mit derselben Kennung wäre eine Falle
    // für die Fokussteuerung.
    return (
      <>
        {renderPage(pages[0], 0)}
        {renderPage([], 1)}
      </>
    );
  }

  const doc = <>{pages.map((ids, i) => renderPage(ids, i))}</>;
  return inlineEdit ? <InlineEditCtx.Provider value={inlineEdit}>{doc}</InlineEditCtx.Provider> : doc;
}

/** Baut dieselbe Blockliste wie der Renderer, ohne zu rendern — der
 *  Paginator braucht nur die Reihenfolge und die Umbruch-Metadaten. */
export type { Metrics };
