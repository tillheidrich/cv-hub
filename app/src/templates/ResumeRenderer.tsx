import React from 'react';
import type { CVData, SocialLink, SectionKey, PageFormat } from '../data/types';
import { getPageFormat } from '../data/pageFormats';
import type { ResumeTheme, ThemeColors, FontPairing, BulletStyle } from './theme';
import { TRACK_CAPS, TRACK_NAME, FS, LH, MIN_X_HEIGHT_PX, fs, fsn, sp, spn, pd, lh, type Metrics } from './metrics';
import { isMultiline, type InlinePath } from '../data/inlineEdit';
import { Ed, InlineEditCtx, type InlineEditApi } from './InlineEdit';
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

/** Pretty value for a social — uses platform prefix if user only wrote a handle. */
export function socialDisplay(s: SocialLink): string {
  const v = (s.value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v.replace(/^https?:\/\//i, '');
  if (v.includes('/')) return v;
  return SOCIAL_META[s.platform]?.prefix + v;
}

export function socialHref(s: SocialLink): string {
  const v = (s.value || '').trim();
  if (!v) return '#';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + socialDisplay(s);
}

export function socialLabel(s: SocialLink): string {
  return SOCIAL_META[s.platform]?.label || s.platform;
}

/** Kontaktzeile für Kopfbalken (E-Mail · Telefon · Ort · Web · Profile).
 *  Jeder Eintrag trägt seinen Bearbeitungspfad mit — auch im Kopfbalken soll
 *  man hineintippen können, nicht nur in der Seitenspalte. */
export function inlineContact(personal: CVData['personal']): { v: string; path?: string }[] {
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
  if (personal.website) out.push({ v: personal.website, path: 'personal.website' });
  for (const s of listSocials(personal)) {
    if (!s.value.trim()) continue;
    out.push({ v: socialDisplay(s), path: `socials.${s.id}` });
  }
  return out;
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
}

/** Welcher Teil der Seitenspalte gerendert wird — siehe `renderAside`. */
type AsidePart = 'all' | 'head' | 'rest';

/** Für Screenreader und Textextraktion sichtbar, für das Auge nicht. */
const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: '1px', height: '1px',
  padding: 0, margin: '-1px', overflow: 'hidden',
  clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)',
  whiteSpace: 'nowrap', border: 0,
};

// ── Bullet marker ───────────────────────────────────────────────────────────

function Marker({ style, color, M }: { style: BulletStyle; color: string; M: Metrics }) {
  const base = fsn(FS.body, M);
  if (style === 'dot' || style === 'chevron')
    // 'chevron' war ein Guillemet (›) und saß je nach Schrift auf einer anderen
    // Grundlinie. Ersetzt durch denselben soliden Punkt wie 'dot'.
    return <span style={{ position: 'absolute', left: 0, top: `${base * 0.52}px`, width: `${base * 0.26}px`, height: `${base * 0.26}px`, borderRadius: '50%', background: color }} />;
  if (style === 'square')
    return <span style={{ position: 'absolute', left: 0, top: `${base * 0.52}px`, width: `${base * 0.26}px`, height: `${base * 0.26}px`, background: color }} />;
  if (style === 'dash')
    return <span style={{ position: 'absolute', left: 0, top: `${base * 0.62}px`, width: `${base * 0.5}px`, height: `${Math.max(1, base * 0.1)}px`, background: color }} />;
  return <span style={{ position: 'absolute', left: 0, top: `${base * 0.1}px`, fontSize: `${base * 0.72}px`, color, lineHeight: 1 }}>→</span>;
}

// ── Section title ───────────────────────────────────────────────────────────

/** Sektionstitel. Rendert bewusst ein echtes <h2>: Chromium übernimmt
 *  Überschriften in die Tag-Struktur des PDF, und Parser erkennen Sektionen an
 *  genau den Merkmalen, die hier zusammenkommen — allein in der Zeile, fett,
 *  größer als der Fließtext. Die Auszeichnung ersetzt den sichtbaren Kontrast
 *  nicht, sie ergänzt ihn. */
function SectionTitle({ label, T, C, P, M, onPanel, path, aside }: {
  label: string; T: ResumeTheme; C: ThemeColors; P: FontPairing; M: Metrics; onPanel?: boolean;
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
           * — nicht der Schriftgrad — macht den Eindruck aus, den Till mit
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
      paddingLeft: `${16 * M.t}px`, position: 'relative', maxWidth: '122mm',
    }}>
      <Marker style={T.bullet} color={onPanel ? C.panelAccent : C.accent} M={M} />
      <Ed path={path} block>{text}</Ed>
    </div>
  );
}

// ── Section content blocks ──────────────────────────────────────────────────

/**
 * Lange Kennungen (URLs, Profilpfade) mit sinnvollen Umbruchstellen.
 *
 * Ohne diese Hilfe brach „xing.com/profile/Katharina_Vogt" in einer 55-mm-
 * Spalte mitten im Namen um („…Katharina_Vo | gt"). `<wbr>` bietet dem Satz
 * Stellen an, an denen ein Umbruch nicht weh tut — nach Punkt, Schrägstrich,
 * Bindestrich und Unterstrich. Im PDF-Text hinterlässt `<wbr>` kein Zeichen,
 * die Adresse bleibt also am Stück kopierbar.
 */
function Breakable({ text }: { text: string }) {
  // Nur nach Punkt und Schrägstrich getrennt. Ein Umbruch nach Unterstrich
  // oder Bindestrich mitten im Namen („…Katharina_ | Vogt") liest sich wie ein
  // Fehler und lässt beim Abtippen eine falsche Adresse entstehen; nach einem
  // Pfadtrenner ist der Umbruch dagegen als solcher erkennbar.
  //
  // Gewollte Umbrüche (Anschrift: Straße / PLZ und Ort) kommen zuerst dran.
  // Sonst läge das „\n" in einem `white-space: nowrap`-Abschnitt und würde
  // als Leerzeichen dargestellt — der Umbruch wäre in den Daten, aber nicht
  // auf dem Papier.
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(?<=[./])/).map((part, i, arr) => (
            <span key={i} style={{ whiteSpace: 'nowrap' }}>
              {part}{i < arr.length - 1 && <wbr />}
            </span>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

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

function ContactBlock({ data, C, P, M, onPanel, bracket }: { data: CVData; C: ThemeColors; P: FontPairing; M: Metrics; onPanel?: boolean; bracket?: boolean }) {
  const { personal, labels } = data;
  const ink = onPanel ? C.panelInk : C.inkMid;
  const lab = onPanel ? C.panelAccent : C.accent;
  /* Im Bearbeitungsmodus keine Verweise: ein beschreibbares Feld in einem
   * Anker führt beim Hineintippen zum Mailprogramm statt zum Schreibzeiger.
   * Im Export ist der Kontext leer, dort bleiben die Verweise klickbar. */
  const editing = !!React.useContext(InlineEditCtx);
  const rows: { l: string; v: string; href?: string; lp?: string; vp?: string }[] = [
    { l: labels.fields.email, v: personal.email, href: `mailto:${personal.email}`, lp: 'labels.fields.email', vp: 'personal.email' },
    { l: labels.fields.phone, v: personal.phone, href: `tel:${personal.phone.replace(/\s/g, '')}`, lp: 'labels.fields.phone', vp: 'personal.phone' },
    { l: labels.fields.address, v: personal.location, lp: 'labels.fields.address', vp: 'personal.location' },
  ];
  if (personal.website) rows.push({ l: labels.fields.web, v: personal.website, href: `https://${personal.website}`, lp: 'labels.fields.web', vp: 'personal.website' });
  for (const s of listSocials(personal)) {
    if (!s.value.trim()) continue;
    rows.push({ l: socialLabel(s), v: socialDisplay(s), href: socialHref(s), vp: `socials.${s.id}` });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sp(10, M) }}>
      {rows.map((r, i) => {
        const inner = (
          <>
            <FieldLabel label={r.l} path={r.lp} color={lab} P={P} M={M} bracket={bracket} />
            <div style={{ fontFamily: P.body, fontSize: fs(FS.meta, M), color: ink, lineHeight: lh(LH.tight, M), whiteSpace: 'pre-line' }}>
              {editing && r.vp
                /* Felder mit Umbruchbedeutung (Anschrift) bekommen beim
                 * Bearbeiten den nackten Text: die `nowrap`-Abschnitte von
                 * `Breakable` schlucken ein eingetipptes Zeilenende. Für die
                 * Darstellung braucht eine Anschrift ohnehin keine
                 * Umbruchhilfen — die haben lange Kennungen nötig, nicht
                 * „29525 Uelzen". */
                ? (isMultiline(r.vp)
                    ? <Ed path={r.vp} block>{r.v}</Ed>
                    : <Ed path={r.vp} block><Breakable text={r.v} /></Ed>)
                : <Breakable text={r.v} />}
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
    <span style={{ display: 'inline-flex', gap: `${gap}px`, alignItems: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
      {/* Der Wert steht als Text im Dokument, auch wenn er visuell nur als
          Punktskala erscheint. Das ist die Stelle, an der ein Screenreader und
          ein PDF-Textextraktor das Sprachniveau überhaupt finden können.
          Bewusst inline gesetzt und nicht per Klasse: der Export ist ein
          eigenständiges HTML-Dokument und darf sich auf kein Stylesheet der
          App verlassen. */}
      <span style={SR_ONLY}>{` (${value} von ${max})`}</span>
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
          paddingLeft: `${13 * M.t}px`, position: 'relative',
        }}>
          <Marker style={T.bullet === 'dash' ? 'dot' : T.bullet} color={onPanel ? C.panelAccent : C.accent} M={M} />
          <Ed path={pathBase ? `${pathBase}.${i}` : undefined} block>{it}</Ed>
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

function DateChip({ children, C, P, M, onPanel, align }: {
  children: React.ReactNode; C: ThemeColors; P: FontPairing; M: Metrics; onPanel?: boolean; align?: 'right';
}) {
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

function ExperienceHead({ e, data, C, P, M, tabular, timeline, isLast }: {
  e: CVData['experience'][number]; data: CVData; C: ThemeColors; P: FontPairing; M: Metrics;
  tabular: boolean; timeline?: boolean; isLast?: boolean;
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
    <DateChip C={C} P={P} M={M} align={tabular ? 'right' : undefined}>
      <Ed path={`experience.${e.id}.start`}>{e.start}</Ed>
      {' – '}
      <Ed path={`experience.${e.id}.end`}>{present(data, e.end)}</Ed>
    </DateChip>
  );

  if (tabular) {
    // Tabellarische Datumsspalte — die im DACH-Raum erwartete Form. Das Datum
    // steht 8 mm neben dem Titel statt 190 mm entfernt am rechten Blattrand.
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `${DATE_COL_MM}mm 1fr`, columnGap: `${DATE_GAP_MM}mm`, alignItems: 'start' }}>
        <div style={{ paddingTop: `${fsn(FS.role, M) * 0.18}px` }}>{date}</div>
        {body}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', paddingLeft: timeline ? `${16 * M.t}px` : undefined }}>
      {timeline && (
        <>
          <span style={{ position: 'absolute', left: 0, top: `${4 * M.t}px`, width: `${8 * M.t}px`, height: `${8 * M.t}px`, borderRadius: '50%', background: C.pageBg, border: `${2 * M.t}px solid ${C.accent}` }} />
          {!isLast && <span style={{ position: 'absolute', left: `${3.5 * M.t}px`, top: `${14 * M.t}px`, bottom: `${-14 * M.t}px`, width: `${1.2 * M.t}px`, background: C.accent, opacity: 0.35 }} />}
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: sp(10, M) }}>
        <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
        {date}
      </div>
    </div>
  );
}

function EducationEntryBlock({ e, C, P, M, tabular }: {
  e: CVData['education'][number]; C: ThemeColors; P: FontPairing; M: Metrics; tabular: boolean;
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
    <DateChip C={C} P={P} M={M} align={tabular ? 'right' : undefined}>
      <Ed path={`education.${e.id}.start`}>{e.start}</Ed>
      {' – '}
      <Ed path={`education.${e.id}.end`}>{e.end}</Ed>
    </DateChip>
  );
  if (tabular) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `${DATE_COL_MM}mm 1fr`, columnGap: `${DATE_GAP_MM}mm`, alignItems: 'start' }}>
        <div style={{ paddingTop: `${fsn(FS.entry, M) * 0.18}px` }}>{date}</div>
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

// ── Name block ──────────────────────────────────────────────────────────────

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
          <Ed path="personal.name">{data.personal.name}</Ed>
        </h1>
      ) : (
      <h1 style={{
        margin: 0,
        fontFamily: T.trackedName ? P.body : P.heading,
        fontSize: fs((big ? FS.nameL : FS.nameS) * (T.trackedName ? 0.82 : 1), M),
        // Gesperrt wirkt der Name schon bei mittlerem Gewicht groß genug; 700
        // plus Sperrung ergibt eine Mauer statt einer Zeile.
        fontWeight: T.trackedName ? 500 : 700, color: ink,
        lineHeight: 1.04,
        // 0,08 em ist keine Geschmacksentscheidung: ab 0,11 em zerlegt die
        // PDF-Textebene den Namen in Einzelbuchstaben, unabhängig vom
        // Schriftgrad (scripts/measure-tracking.mjs).
        letterSpacing: T.trackedName ? TRACK_CAPS : (T.uppercaseName ? '0.02em' : TRACK_NAME),
        textTransform: (T.uppercaseName || T.trackedName) ? 'uppercase' : 'none',
      }}><Ed path="personal.name">{data.personal.name}</Ed></h1>
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
const DEFAULT_MAIN_ORDER: SectionKey[] = ['profile', 'details', 'experience', 'education', 'skills', 'languages', 'additional'];
const MAIN_ORDER_SIDEBAR: SectionKey[] = ['profile', 'experience', 'education', 'skills', 'additional'];

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
  const hasAside = isSidebar || T.layout === 'header-band';
  const tabular = T.layout === 'single-column' || T.layout === 'timeline' || T.layout === 'top-centered';

  /* Wandert der Profiltext in die Seitenspalte, darf er in der Hauptspalte
   * nicht noch einmal auftauchen — sonst stünde er zweimal auf der Seite. */
  const profileAside = isSidebar && T.profileInSidebar === true;
  const defaultOrder: SectionKey[] = hasAside
    ? (profileAside ? MAIN_ORDER_SIDEBAR.filter(k => k !== 'profile') : MAIN_ORDER_SIDEBAR)
    : DEFAULT_MAIN_ORDER;
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
      lineHeight: lh(LH.body, M), margin: 0, maxWidth: '122mm', whiteSpace: 'pre-line',
    }}><Ed path="profile.text">{profile.text}</Ed></p>
  );

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
  const indented = (node: React.ReactNode): React.ReactNode => (tabular
    ? <div style={{ display: 'grid', gridTemplateColumns: `${DATE_COL_MM}mm 1fr`, columnGap: `${DATE_GAP_MM}mm` }}>
        <div />{node}
      </div>
    : node);
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
        node: <><SectionTitle label={sec.profile} path="labels.sections.profile" T={T} C={C} P={P} M={M} />{indented(profilePara())}</>,
      });
      continue;
    }

    if (key === 'details') {
      const rows = detailRows(data);
      if (!rows.length) continue;
      push({
        id: 'details', section: 'details', gap: GAP_SECTION, breakBefore,
        node: (
          <>
            <SectionTitle label={sec.details} path="labels.sections.details" T={T} C={C} P={P} M={M} />
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
        node: <SectionTitle label={sec.experience} path="labels.sections.experience" T={T} C={C} P={P} M={M} />,
      });
      entries.forEach((e, i) => {
        push({
          id: `experience:${e.id}:head`, section: 'experience',
          gap: i === 0 ? GAP_HEAD : GAP_ENTRY,
          keepWithNext: e.bullets.length > 0,
          node: <ExperienceHead e={e} data={data} C={C} P={P} M={M} tabular={tabular} timeline={T.layout === 'timeline'} isLast={i === entries.length - 1} />,
        });
        e.bullets.forEach((b, bi) => {
          push({
            id: `experience:${e.id}:b${bi}`, section: 'experience',
            gap: bi === 0 ? spn(6, M) : GAP_BULLET,
            node: (
              <div style={tabular ? { display: 'grid', gridTemplateColumns: `${DATE_COL_MM}mm 1fr`, columnGap: `${DATE_GAP_MM}mm` } : (T.layout === 'timeline' ? { paddingLeft: `${16 * M.t}px` } : undefined)}>
                {tabular && <div />}
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
        node: <SectionTitle label={sec.education} path="labels.sections.education" T={T} C={C} P={P} M={M} />,
      });
      data.education.forEach((e, i) => {
        push({
          id: `education:${e.id}`, section: 'education', gap: i === 0 ? GAP_HEAD : GAP_ENTRY,
          node: <EducationEntryBlock e={e} C={C} P={P} M={M} tabular={tabular} />,
        });
      });
      continue;
    }

    if (key === 'skills') {
      if (!mainSkills.length) continue;
      const cols = Math.min(mainSkills.length, 3);
      push({
        id: 'skills', section: 'skills', gap: GAP_SECTION, breakBefore,
        node: indented(
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${spn(16, M)}px ${spn(24, M)}px` }}>
            {mainSkills.map(g => (
              <div key={g.label}>
                <SectionTitle label={g.label} path={`skills.${data.skillGroups.indexOf(g)}.label`} T={T} C={C} P={P} M={M} />
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
            <SectionTitle label={sec.languages} path="labels.sections.languages" T={T} C={C} P={P} M={M} />
            {indented(<LangBlock data={data} C={C} P={P} M={M} columns={tabular ? 2 : 1} />)}
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
            <SectionTitle label={sec.additional} path="labels.sections.additional" T={T} C={C} P={P} M={M} />
            {indented(<SkillGroupBlock group={{ label: sec.additional, items: data.additionalExperience }} T={T} C={C} P={P} M={M} pathBase="additional" />)}
          </>
        ),
      });
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
      node: (
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
    const label = sectionLabel(first.section);
    if (!label) return null;
    const m = /^(experience|education):([^:]+):/.exec(first.id);
    let entry = '';
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

  const renderBlocks = (ids: string[]) => {
    const out: React.ReactNode[] = [];
    let i = 0;
    while (i < ids.length) {
      const m = BULLET_ID.exec(ids[i]);
      if (!m) { out.push(renderBlock(ids[i], i, false)); i++; continue; }
      const entry = m[1];
      const run: { id: string; idx: number }[] = [];
      while (i < ids.length) {
        const mm = BULLET_ID.exec(ids[i]);
        if (!mm || mm[1] !== entry) break;
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
  /* Seitenspalte ohne Farbfläche: dann gelten für ihren Text die Farben der
   * Seite, nicht die des Panels — sonst stünde heller Panel-Ton auf weißem
   * Papier. Getrennt wird stattdessen mit einer Haarlinie. */
  const plainPanel = isSidebar && T.panelFill === false;

  const AsideContent = ({ onPanel, skipContact, part = 'all' }: { onPanel: boolean; skipContact?: boolean; part?: AsidePart }) => (
    <>
      {part !== 'rest' && !skipContact && (
        <div><SectionTitle label={sec.personal} path="labels.sections.personal" T={T} C={C} P={P} M={M} onPanel={onPanel} aside /><ContactBlock data={data} C={C} P={P} M={M} onPanel={onPanel} bracket={T.bracketLabels} /></div>
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
          {[data.personal.email, data.personal.phone].filter(Boolean).map((v, i) => (
            <div key={i} style={{
              fontFamily: P.body, fontSize: fs(FS.label, M), color: C.panelInkSoft, lineHeight: lh(LH.tight, M),
            }}><Breakable text={v} /></div>
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
            }}>
              {T.photo !== 'none' && data.personal.photo && <Photo data={data} T={T} C={C} widthMm={T.photo === 'circle' ? 30 : 28} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <NameBlock data={data} T={T} C={C} P={P} M={M} big onPanel />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: sp(3, M), textAlign: 'right' }}>
                {inlineContact(data.personal).map((r, i) => (
                  <div key={i} style={{ fontFamily: P.body, fontSize: fs(FS.micro, M), color: C.panelInkSoft }}><Ed path={r.path}>{r.v}</Ed></div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: C.panelBg, color: C.panelInk, padding: `${pd(20, M)} ${pd(50, M)}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
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
            {renderAside(pageIndex, false, true)}
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
        {pageIndex === 0 ? (
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
                {inlineContact(data.personal).map((r, i) => (
                  <span key={i} style={{ whiteSpace: 'nowrap' }}>
                    {i > 0 && <span style={{ color: C.accent, opacity: 0.55 }}>{'·\u00A0'}</span>}<Ed path={r.path}>{r.v}</Ed>
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
          {renderBlocks(ids)}
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
