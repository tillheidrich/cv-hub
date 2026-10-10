// Gemeinsame Bausteine für das Magazin: Frontmatter lesen und schreiben,
// Slugs bilden, Artikeldateien einsammeln.
//
// Benutzt von magazin-sync.mjs (schreibt die Dateien aus Outline),
// magazin-build.mjs (macht daraus statisches HTML) und magazincheck.mjs.
// Bewusst ohne YAML-Bibliothek: Das Frontmatter hat sechs flache Felder, und
// ein eigener, strenger Leser meldet Fehler genauer als ein großzügiger.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/** Felder, die jede Artikeldatei haben muss. */
export const PFLICHTFELDER = ['title', 'slug', 'description', 'lang', 'updated'];
/** Felder, die zusätzlich erlaubt sind. category ist das Thema (siehe
 *  KATEGORIEN), outlineId fehlt bei Artikeln, die direkt im Repo geschrieben
 *  wurden; published ist das erste Erscheinen. */
export const KANNFELDER = ['category', 'outlineId', 'published'];
export const SPRACHEN = ['de', 'en', 'fr', 'es'];

/** Titel der Anleitung in der Outline-Sammlung. Ein Dokument mit genau diesem
 *  Titel wird nie veröffentlicht, auch wenn es versehentlich veröffentlicht ist. */
export const ANLEITUNG_TITEL = 'So funktioniert das Magazin';
/** Frühere Titel der Anleitung (bis 10.10.2026 „Ratgeber"): ebenfalls nie veröffentlichen. */
export const ANLEITUNG_TITEL_ALT = ['So funktioniert der Ratgeber'];
export function istAnleitung(titel) {
  const t = String(titel || '').trim();
  return t === ANLEITUNG_TITEL || ANLEITUNG_TITEL_ALT.includes(t);
}
/** Themen; gleichlautend in magazin-template/texte.mjs (KATEGORIEN). */
export const KATEGORIEN = ['ats', 'bewerbung', 'recht', 'ki'];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATUM_RE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Aus einem Titel einen URL-Teil machen: Umlaute ausschreiben, alles andere
 *  auf a-z, 0-9 und Bindestrich, höchstens 80 Zeichen, an einer Wortgrenze. */
export function slugify(text) {
  const s = String(text)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' und ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length <= 80) return s;
  const cut = s.slice(0, 80);
  const i = cut.lastIndexOf('-');
  return (i > 40 ? cut.slice(0, i) : cut).replace(/-+$/, '');
}

/** Einen Wert aus der Frontmatter-Zeile lesen: "…" (JSON-Regeln), '…'
 *  (YAML-Regeln, '' ist ein Apostroph) oder unquotiert. */
function leseWert(roh, zeile) {
  const v = roh.trim();
  if (v.startsWith('"')) {
    try { return JSON.parse(v); } catch { throw new Error(`Zeile ${zeile}: Anführungszeichen nicht sauber geschlossen`); }
  }
  if (v.startsWith("'")) {
    if (!v.endsWith("'") || v.length < 2) throw new Error(`Zeile ${zeile}: Apostroph nicht geschlossen`);
    return v.slice(1, -1).replace(/''/g, "'");
  }
  if (/^[[{|>]/.test(v)) throw new Error(`Zeile ${zeile}: Listen, Objekte und mehrzeilige Werte sind nicht vorgesehen`);
  return v.replace(/\s+#.*$/, '');
}

/**
 * Datei in Frontmatter und Text zerlegen. Wirft mit einer verständlichen
 * Meldung, wenn das Format nicht stimmt.
 * @returns {{ meta: Record<string,string>, body: string }}
 */
export function parseFrontmatter(quelle) {
  const text = quelle.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) throw new Error('Frontmatter fehlt: Die Datei muss mit einer Zeile "---" beginnen');
  const ende = text.indexOf('\n---', 4);
  if (ende < 0) throw new Error('Frontmatter nicht geschlossen: zweite Zeile "---" fehlt');
  const kopf = text.slice(4, ende);
  const nach = text.slice(ende + 4);
  if (nach && !nach.startsWith('\n')) throw new Error('Nach dem schließenden "---" muss eine neue Zeile beginnen');
  const meta = {};
  kopf.split('\n').forEach((z, i) => {
    if (!z.trim() || z.trim().startsWith('#')) return;
    const m = /^([A-Za-z][A-Za-z0-9_]*)\s*:(.*)$/.exec(z);
    if (!m) throw new Error(`Zeile ${i + 2}: erwartet "feld: wert", gefunden "${z.slice(0, 40)}"`);
    if (m[1] in meta) throw new Error(`Zeile ${i + 2}: Feld "${m[1]}" doppelt`);
    meta[m[1]] = String(leseWert(m[2], i + 2));
  });
  return { meta, body: nach.replace(/^\n/, '') };
}

/** Frontmatter prüfen. Gibt eine Liste von Fehlern zurück (leer = gut). */
export function pruefeMeta(meta, dateiname) {
  const fehler = [];
  for (const f of PFLICHTFELDER) if (!meta[f] || !String(meta[f]).trim()) fehler.push(`Pflichtfeld "${f}" fehlt oder ist leer`);
  for (const f of Object.keys(meta)) {
    if (!PFLICHTFELDER.includes(f) && !KANNFELDER.includes(f)) fehler.push(`unbekanntes Feld "${f}" (erlaubt: ${[...PFLICHTFELDER, ...KANNFELDER].join(', ')})`);
  }
  if (meta.slug && !SLUG_RE.test(meta.slug)) fehler.push(`slug "${meta.slug}" ist ungültig (nur a-z, 0-9 und einzelne Bindestriche)`);
  if (meta.slug && dateiname && basename(dateiname, '.md') !== meta.slug) fehler.push(`slug "${meta.slug}" passt nicht zum Dateinamen "${basename(dateiname)}"`);
  if (meta.category && !KATEGORIEN.includes(meta.category)) fehler.push(`category "${meta.category}" ist keins der Themen ${KATEGORIEN.join(', ')}`);
  if (meta.lang && !SPRACHEN.includes(meta.lang)) fehler.push(`lang "${meta.lang}" ist keine der Sprachen ${SPRACHEN.join(', ')}`);
  for (const f of ['updated', 'published']) {
    if (meta[f] && (!DATUM_RE.test(meta[f]) || Number.isNaN(Date.parse(meta[f])))) fehler.push(`${f} "${meta[f]}" ist kein Datum der Form JJJJ-MM-TT`);
  }
  if (meta.title && meta.title.length > 120) fehler.push('title ist länger als 120 Zeichen');
  if (meta.description && meta.description.length > 300) fehler.push('description ist länger als 300 Zeichen');
  return fehler;
}

/** Hinweise, die den Bau nicht aufhalten, aber die Suche betreffen. */
export function hinweiseMeta(meta) {
  const h = [];
  if (meta.description && meta.description.length > 160) h.push(`description hat ${meta.description.length} Zeichen; Suchmaschinen zeigen etwa 155`);
  if (meta.description && meta.description.length < 50) h.push(`description hat nur ${meta.description.length} Zeichen`);
  if (!meta.category) h.push(`kein Thema (category); der Artikel erscheint nur unter „Alle Themen"`);
  if (meta.title && meta.title.length > 70) h.push(`title hat ${meta.title.length} Zeichen; im Suchergebnis wird ab etwa 60 gekürzt`);
  return h;
}

/** Frontmatter schreiben. Strings immer in doppelten Anführungszeichen
 *  (JSON-Schreibweise ist gültiges YAML), feste Reihenfolge. */
export function stringifyFrontmatter(meta, body) {
  const reihenfolge = [...PFLICHTFELDER, ...KANNFELDER];
  const zeilen = ['---'];
  for (const f of reihenfolge) if (meta[f] !== undefined && meta[f] !== null && meta[f] !== '') zeilen.push(`${f}: ${JSON.stringify(String(meta[f]))}`);
  zeilen.push('---', '');
  return zeilen.join('\n') + body.replace(/\s+$/, '') + '\n';
}

/** Artikeldateien eines Ordners: *.md außer README.md und Dateien, die mit
 *  "_" oder "." beginnen (Entwürfe, Vorlagen). */
export function artikelDateien(ordner) {
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner)
    .filter(n => n.endsWith('.md') && n !== 'README.md' && !n.startsWith('_') && !n.startsWith('.'))
    .sort()
    .map(n => join(ordner, n));
}

/** Alle Artikel lesen; fehlerhafte kommen mit `fehler` zurück statt zu werfen. */
export function leseArtikel(ordner) {
  return artikelDateien(ordner).map(datei => {
    try {
      const { meta, body } = parseFrontmatter(readFileSync(datei, 'utf8'));
      return { datei, meta, body, fehler: pruefeMeta(meta, datei) };
    } catch (e) {
      return { datei, meta: {}, body: '', fehler: [e.message] };
    }
  });
}

/** Datum für die Anzeige, ohne Zeitzonenverschiebung. */
export function datumAnzeige(iso, lang) {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00Z` : iso);
  const loc = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' }[lang] || 'de-DE';
  return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** Nur das Datum (JJJJ-MM-TT) aus einem ISO-Zeitstempel. */
export function nurDatum(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}
