// Holt die veröffentlichten Artikel aus einer Outline-Sammlung (der
// öffentlichen Magazin-Sammlung der eigenen Instanz) und schreibt sie als
// Markdown mit Frontmatter nach content/magazin/<slug>.md.
//
//   OUTLINE_URL=https://wiki.example.com OUTLINE_MAGAZIN_TOKEN=ol_api_… \
//   OUTLINE_MAGAZIN_COLLECTION=<Sammlungs-ID> npm run magazin:sync
//
// (Früher hieß das Magazin „Ratgeber": OUTLINE_RATGEBER_TOKEN und
// OUTLINE_RATGEBER_COLLECTION werden weiter gelesen.)
//
// Grundsätze:
//   - Ohne Token, ohne OUTLINE_URL oder ohne OUTLINE_MAGAZIN_COLLECTION
//     passiert nichts; vorhandene Dateien
//     bleiben, Exit-Code 0. Der Bau darf nie wegen Outline scheitern.
//     (MAGAZIN_SYNC_STRICT=1 macht Fehler zu Exit-Code 1, für Prüfläufe.)
//   - Nur veröffentlichte Dokumente der einen Sammlung. Entwürfe, Archiv,
//     Papierkorb und Vorlagen nie.
//   - Ein Dokument mit dem Titel „So funktioniert das Magazin" wird immer
//     übersprungen: Das ist die Anleitung, kein Artikel.
//   - Vor dem Schreiben läuft die Sperrliste (magazin-sperrmuster.mjs). Ein
//     Treffer hält genau dieses Dokument zurück; eine früher übernommene,
//     saubere Fassung bleibt dann stehen.
//   - Bilder aus Outline-Anhängen werden heruntergeladen nach
//     public/magazin/img/<inhaltshash>.<endung>; fremde Bildadressen werden
//     entfernt (keine Einbindung von Drittservern).
//   - Ist ein Dokument in Outline nicht mehr veröffentlicht, wird seine Datei
//     gelöscht, aber nur, wenn die Liste vollständig geladen werden konnte.
//     Dateien ohne outlineId (direkt im Repo geschrieben) fasst der Sync nie an.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { leseArtikel, slugify, stringifyFrontmatter, pruefeMeta, nurDatum, istAnleitung, SPRACHEN, KATEGORIEN } from './magazin-lib.mjs';
import { pruefeText } from './magazin-sperrmuster.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(process.env.MAGAZIN_CONTENT_DIR || join(APP, 'content', 'magazin'));
const IMG = resolve(process.env.MAGAZIN_IMG_DIR || join(APP, 'public', 'magazin', 'img'));
const OUTLINE_URL = (process.env.OUTLINE_URL || '').replace(/\/+$/, '');
const TOKEN = process.env.OUTLINE_MAGAZIN_TOKEN || process.env.OUTLINE_RATGEBER_TOKEN || '';
// Keine Vorgabe: Die Sammlungs-ID gehört zur eigenen Outline-Instanz.
const COLLECTION = (process.env.OUTLINE_MAGAZIN_COLLECTION || process.env.OUTLINE_RATGEBER_COLLECTION || '').trim();
const STRICT = process.env.MAGAZIN_SYNC_STRICT === '1';
const MAX_BILD = 5 * 1024 * 1024;
const TIMEOUT = 20_000;

const log = (...a) => console.log('[magazin:sync]', ...a);
const warn = (...a) => console.warn('[magazin:sync] WARNUNG:', ...a);

if (!TOKEN || !OUTLINE_URL || !COLLECTION) {
  log(`${!TOKEN ? 'OUTLINE_MAGAZIN_TOKEN' : !OUTLINE_URL ? 'OUTLINE_URL' : 'OUTLINE_MAGAZIN_COLLECTION'} nicht gesetzt – Sync übersprungen, vorhandene Artikel bleiben unverändert.`);
  process.exit(0);
}

let fehlerZahl = 0;

async function api(methode, body) {
  const res = await fetch(`${OUTLINE_URL}/api/${methode}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`${methode}: HTTP ${res.status}`);
  return res.json();
}

/** Alle veröffentlichten Dokumente der Sammlung, seitenweise. */
async function ladeDokumente() {
  const alle = [];
  const limit = 100;
  for (let offset = 0; offset < 10_000; offset += limit) {
    const r = await api('documents.list', { collectionId: COLLECTION, statusFilter: ['published'], limit, offset, sort: 'updatedAt', direction: 'DESC' });
    const seite = Array.isArray(r.data) ? r.data : [];
    alle.push(...seite);
    if (seite.length < limit) break;
  }
  return alle.filter(d => d && d.collectionId === COLLECTION && d.publishedAt && !d.archivedAt && !d.deletedAt && !d.template);
}

/** Markdown eines Dokuments; documents.list liefert es meist schon mit. */
async function markdownVon(doc) {
  if (typeof doc.text === 'string') return doc.text;
  try {
    const r = await api('documents.info', { id: doc.id });
    if (typeof r.data?.text === 'string') return r.data.text;
  } catch { /* weiter mit export */ }
  const r = await api('documents.export', { id: doc.id });
  return typeof r.data === 'string' ? r.data : '';
}

/** Outline-Eigenheiten glätten: Leerabsätze als „\", Titel als H1 im Export. */
function normalisiere(text, titel) {
  let t = String(text).replace(/\r\n?/g, '\n');
  const ersteZeile = t.split('\n', 1)[0].trim();
  if (ersteZeile === `# ${titel}`) t = t.slice(t.indexOf('\n') + 1);
  t = t.split('\n').map(z => (z.trim() === '\\' ? '' : z)).join('\n');
  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/** Beschreibung, in dieser Rangfolge:
 *  1. eine Zeile „Beschreibung: …" ganz oben im Dokument (wird entfernt),
 *  2. die Beschreibung der schon vorhandenen Datei desselben Dokuments
 *     (von Hand gesetzt, soll nicht von einem Auszug überschrieben werden),
 *  3. der erste Absatz, gekürzt auf höchstens 158 Zeichen an einer Wortgrenze. */
function beschreibung(text, bisher) {
  const zeilen = text.split('\n');
  const i = zeilen.findIndex(z => z.trim());
  const m = i >= 0 ? /^\s*(?:>\s*)?(?:\*\*|__)?(?:beschreibung|description|kurzbeschreibung)(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*(.+)$/i.exec(zeilen[i]) : null;
  if (m) {
    zeilen.splice(i, 1);
    return { text: zeilen.join('\n').trim(), desc: m[1].replace(/\*\*|__/g, '').trim() };
  }
  if (bisher) return { text, desc: bisher };
  const absatz = text.split(/\n\s*\n/).map(a => a.trim()).find(a => a && !/^(#|!\[|```|:::|\||[-*+] |\d+\. |>)/.test(a)) || '';
  let plain = absatz
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~=]+/g, '')
    .replace(/\\(.)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length > 158) {
    const cut = plain.slice(0, 157);
    plain = cut.slice(0, Math.max(cut.lastIndexOf(' '), 100)).replace(/[\s,;:.–-]+$/, '') + '…';
  }
  return { text, desc: plain };
}

/** Thema aus einer Zeile „Kategorie: ats" (auch „Thema:" oder „Category:")
 *  unter den ersten drei Zeilen; die Zeile wird entfernt. Fehlt sie, bleibt
 *  das Thema der vorhandenen Datei desselben Dokuments. */
function kategorie(text, bisher, titel) {
  const zeilen = text.split('\n');
  let gesehen = 0;
  for (let i = 0; i < zeilen.length && gesehen < 3; i++) {
    if (!zeilen[i].trim()) continue;
    gesehen++;
    const m = /^\s*(?:>\s*)?(?:\*\*|__)?(?:kategorie|thema|category)(?:\*\*|__)?\s*:\s*(?:\*\*|__)?\s*([A-Za-zÄÖÜäöü-]+)/i.exec(zeilen[i]);
    if (!m) continue;
    zeilen.splice(i, 1);
    const wert = m[1].toLowerCase();
    if (KATEGORIEN.includes(wert)) return { text: zeilen.join('\n').trim(), kat: wert };
    warn(`„${titel}": Kategorie „${m[1]}" unbekannt (erlaubt: ${KATEGORIEN.join(', ')}) – ignoriert.`);
    return { text: zeilen.join('\n').trim(), kat: bisher || '' };
  }
  return { text, kat: bisher || '' };
}

const BILD_RE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+[^)]*)?\)/g;

function istAnhang(url) {
  if (/^\/api\/attachments\.redirect\?/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.origin === new URL(OUTLINE_URL).origin && u.pathname === '/api/attachments.redirect';
  } catch { return false; }
}

/** Bilder durch Platzhalter ersetzen, damit die Sperrprüfung die Anhang-
 *  Adressen nicht als internen Verweis wertet. Fremde Bilder fliegen raus. */
function bilderHerausloesen(text, titel) {
  const bilder = [];
  const ohne = text.replace(BILD_RE, (_, alt, url) => {
    if (istAnhang(url)) {
      bilder.push({ alt: alt.replace(/[[\]]/g, ''), url });
      return `MAGAZINBILD${bilder.length - 1}ENDE`;
    }
    warn(`„${titel}": fremdes Bild entfernt (${url.slice(0, 60)}) – Bilder bitte in Outline hochladen.`);
    return '';
  });
  return { text: ohne, bilder };
}

const ARTEN = [
  ['image/png', 'png', b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['image/jpeg', 'jpg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/gif', 'gif', b => b.slice(0, 4).toString('latin1') === 'GIF8'],
  ['image/webp', 'webp', b => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP'],
  ['image/avif', 'avif', b => b.slice(4, 12).toString('latin1').startsWith('ftypavi')],
];

/** Anhang laden. Weiterleitungen von Hand: Den Token bekommt nur Outline
 *  selbst, nie ein Speicherdienst, auf den weitergeleitet wird. */
async function ladeBild(url) {
  let ziel = new URL(url, OUTLINE_URL + '/');
  const outlineOrigin = new URL(OUTLINE_URL).origin;
  for (let hop = 0; hop < 5; hop++) {
    if (!/^https?:$/.test(ziel.protocol)) throw new Error('Protokoll nicht erlaubt');
    const headers = ziel.origin === outlineOrigin ? { Authorization: `Bearer ${TOKEN}` } : {};
    const res = await fetch(ziel, { headers, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      ziel = new URL(res.headers.get('location'), ziel);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const laenge = Number(res.headers.get('content-length') || 0);
    if (laenge > MAX_BILD) throw new Error('größer als 5 MB');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BILD) throw new Error('größer als 5 MB');
    const art = ARTEN.find(([, , pruef]) => pruef(buf));
    if (!art) throw new Error('kein PNG, JPEG, GIF, WebP oder AVIF (SVG ist absichtlich ausgeschlossen)');
    return { buf, endung: art[1] };
  }
  throw new Error('zu viele Weiterleitungen');
}

/** Verweise auf andere Dokumente derselben Sammlung auf /magazin/<slug>/
 *  umbiegen. Verweise auf Wiki-Dokumente, die nicht (mehr) veröffentlicht
 *  sind oder in anderen Sammlungen liegen, werden zu reinem Text: Ihr Titel
 *  in der Adresse verriete interne Seiten, und ein toter Link hilft niemandem.
 *  Was danach noch nach /doc/ aussieht (fremde Hosts), fängt die Sperrliste. */
function verweiseUmbiegen(text, urlIdZuSlug, titel) {
  const outlineHost = new URL(OUTLINE_URL).host;
  return text.replace(/\[([^\]]*)\]\(((?:https?:\/\/([^/\s)]+))?\/doc\/[^)\s#]*?([A-Za-z0-9]{10})(#[^)\s]*)?)\)/g, (ganz, linktext, _url, host, urlId, anker) => {
    if (host && host !== outlineHost) return ganz;
    const slug = urlIdZuSlug.get(urlId);
    if (!slug) {
      warn(`„${titel}": Verweis auf ein Wiki-Dokument außerhalb des Magazins („${linktext.slice(0, 40)}") – Link entfernt, Text bleibt.`);
      return linktext;
    }
    let a = '';
    if (anker) {
      // Outline-Anker heißen „#h-ueberschrift"; der Bau vergibt „#ueberschrift".
      a = '#' + slugify(decodeURIComponent(anker.slice(1)).replace(/^h-/, ''));
    }
    return `[${linktext}](/magazin/${slug}/${a})`;
  });
}

async function main() {
  mkdirSync(CONTENT, { recursive: true });
  const vorhanden = leseArtikel(CONTENT);
  const slugNachId = new Map();
  const dateiNachSlug = new Map();
  for (const a of vorhanden) {
    if (a.meta.slug) dateiNachSlug.set(a.meta.slug, a);
    if (a.meta.outlineId) slugNachId.set(a.meta.outlineId, a.meta.slug);
  }

  const docs = await ladeDokumente();
  log(`${docs.length} veröffentlichte Dokumente in der Sammlung.`);

  // Slugs zuerst für alle festlegen, damit Querverweise funktionieren.
  // Ein einmal vergebener Slug bleibt, auch wenn sich der Titel ändert:
  // Sonst bräche jede geteilte Adresse.
  const plan = [];
  const vergeben = new Set([...dateiNachSlug.keys()]);
  for (const d of docs) {
    if (istAnleitung(d.title)) { log(`„${String(d.title).trim()}" übersprungen (Anleitung, kein Artikel).`); continue; }
    let slug = slugNachId.get(d.id);
    if (!slug) {
      slug = slugify(d.title || '') || `artikel-${d.urlId || d.id.slice(0, 8)}`;
      const belegt = dateiNachSlug.get(slug);
      if (belegt && belegt.meta.outlineId && belegt.meta.outlineId !== d.id) slug = `${slug}-${(d.urlId || d.id).slice(0, 6).toLowerCase()}`;
    }
    vergeben.add(slug);
    plan.push({ d, slug });
  }
  const urlIdZuSlug = new Map(plan.filter(p => p.d.urlId).map(p => [p.d.urlId, p.slug]));

  let geschrieben = 0, unveraendert = 0, gesperrt = 0;
  const gueltigeIds = new Set();
  for (const { d, slug } of plan) {
    gueltigeIds.add(d.id);
    const titel = String(d.title).trim();
    try {
      const roh = normalisiere(await markdownVon(d), titel);
      const bisher = dateiNachSlug.get(slug);
      const eigen = bisher && bisher.meta.outlineId === d.id ? bisher : null;
      const { text: ohneKat, kat } = kategorie(roh, eigen ? eigen.meta.category : '', titel);
      const { text: ohneBeschr, desc } = beschreibung(ohneKat, eigen ? eigen.meta.description : '');
      const umgebogen = verweiseUmbiegen(ohneBeschr, urlIdZuSlug, titel);
      const { text: mitPlatzhaltern, bilder } = bilderHerausloesen(umgebogen, titel);

      const treffer = pruefeText(`${titel}\n${desc}\n${mitPlatzhaltern}`, { outlineUrl: OUTLINE_URL });
      if (treffer.length) {
        gesperrt++;
        warn(`„${titel}" GESPERRT, nicht übernommen. Gefunden:`);
        for (const t of treffer) warn(`   Zeile ${t.zeile}: ${t.muster} – ${t.auszug}`);
        if (dateiNachSlug.get(slug)?.meta.outlineId === d.id) warn('   Die zuletzt übernommene Fassung bleibt online.');
        continue;
      }

      let text = mitPlatzhaltern;
      for (let i = 0; i < bilder.length; i++) {
        const b = bilder[i];
        let ersatz = '';
        try {
          const { buf, endung } = await ladeBild(b.url);
          const name = `${createHash('sha256').update(buf).digest('hex').slice(0, 16)}.${endung}`;
          mkdirSync(IMG, { recursive: true });
          const ziel = join(IMG, name);
          if (!existsSync(ziel)) writeFileSync(ziel, buf);
          ersatz = `![${b.alt}](/magazin/img/${name})`;
          if (!b.alt) warn(`„${titel}": Bild ${i + 1} hat keinen Alternativtext – in Outline eine Bildunterschrift setzen.`);
        } catch (e) {
          warn(`„${titel}": Bild ${i + 1} nicht übernommen (${e.message}) – entfernt.`);
        }
        text = text.replace(`MAGAZINBILD${i}ENDE`, ersatz);
      }

      const lang = SPRACHEN.includes(d.language) ? d.language : 'de';
      const meta = {
        title: titel,
        slug,
        description: desc || titel,
        category: kat || undefined,
        lang,
        updated: nurDatum(d.updatedAt || d.publishedAt),
        outlineId: d.id,
        published: nurDatum(d.publishedAt),
      };
      const fehler = pruefeMeta(meta, `${slug}.md`);
      if (fehler.length) { warn(`„${titel}" nicht übernommen: ${fehler.join('; ')}`); fehlerZahl++; continue; }

      const alt = dateiNachSlug.get(slug);
      if (alt && alt.meta.outlineId && alt.meta.outlineId !== d.id) { warn(`„${titel}": ${slug}.md gehört zu einem anderen Outline-Dokument – übersprungen.`); fehlerZahl++; continue; }
      if (alt && !alt.meta.outlineId) log(`${slug}.md stammte aus dem Repo und wird ab jetzt aus Outline gepflegt.`);

      const datei = join(CONTENT, `${slug}.md`);
      const neu = stringifyFrontmatter(meta, text);
      if (existsSync(datei) && readFileSync(datei, 'utf8') === neu) { unveraendert++; continue; }
      writeFileSync(datei, neu);
      geschrieben++;
      log(`geschrieben: ${slug}.md`);
    } catch (e) {
      fehlerZahl++;
      warn(`„${titel}": ${e.message} – vorhandene Datei bleibt.`);
    }
  }

  // Zurückgezogene Artikel entfernen (nur solche, die aus Outline stammen).
  let entfernt = 0;
  for (const a of leseArtikel(CONTENT)) {
    if (a.meta.outlineId && !gueltigeIds.has(a.meta.outlineId)) {
      unlinkSync(a.datei);
      entfernt++;
      log(`entfernt (in Outline nicht mehr veröffentlicht): ${a.meta.slug}.md`);
    }
  }

  // Bilder, auf die kein Artikel mehr verweist, löschen.
  if (existsSync(IMG)) {
    const benutzt = new Set();
    for (const a of leseArtikel(CONTENT)) for (const m of a.body.matchAll(/\/magazin\/img\/([A-Za-z0-9._-]+)/g)) benutzt.add(m[1]);
    for (const n of readdirSync(IMG)) {
      if (!benutzt.has(n) && /^[a-f0-9]{16}\.(png|jpg|gif|webp|avif)$/.test(n)) { unlinkSync(join(IMG, n)); log(`Bild ohne Verweis gelöscht: ${n}`); }
    }
  }

  log(`fertig: ${geschrieben} geschrieben, ${unveraendert} unverändert, ${entfernt} entfernt, ${gesperrt} gesperrt, ${fehlerZahl} Fehler.`);
}

main().then(() => {
  process.exit(STRICT && fehlerZahl ? 1 : 0);
}).catch(e => {
  warn(`Sync abgebrochen: ${e.message}. Vorhandene Artikel bleiben unverändert.`);
  process.exit(STRICT ? 1 : 0);
});
