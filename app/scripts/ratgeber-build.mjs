// Baut den Ratgeber als statisches HTML: dist/ratgeber/<slug>/index.html,
// die Übersicht dist/ratgeber/index.html, eine 404-Seite, sitemap.xml und
// robots.txt. Läuft in `npm run build` nach `vite build`.
//
// Warum statisch: Die App ist eine SPA. Ein Artikel, den erst JavaScript
// zusammensetzt, ist für Suchmaschinen und Vorschaukarten schwach, und
// Lesende brauchen keine React-Laufzeit. Diese Seiten haben kein einziges
// ausführbares Skript.
//
// Umgebung:
//   PUBLIC_BASE_URL       Basis für canonical, og:url, Sitemap (Standard
//                         https://cv.example.com). Die EINE Stelle,
//                         an der die Domain steht.
//   RATGEBER_LANG         Sprache der Übersicht (Standard en)
//   RATGEBER_CONTENT_DIR  Quelle (Standard content/ratgeber)
//   RATGEBER_IMG_DIR      Bilder (Standard public/ratgeber/img)
//   RATGEBER_OUT_DIR      Ziel (Standard dist)
//
// Fehlerhafte Artikel (Frontmatter, Sperrliste) werden übersprungen und laut
// gemeldet; der Bau selbst scheitert daran nicht. ratgebercheck.mjs macht aus
// denselben Befunden einen Fehlschlag.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';
import { leseArtikel, hinweiseMeta, datumAnzeige, slugify } from './ratgeber-lib.mjs';
import { pruefeText } from './ratgeber-sperrmuster.mjs';
import { artikelSeite, uebersichtSeite, nichtGefundenSeite, esc } from '../ratgeber-template/seiten.mjs';
import { TEXTE } from '../ratgeber-template/texte.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = resolve(process.env.RATGEBER_CONTENT_DIR || join(APP, 'content', 'ratgeber'));
const IMG = resolve(process.env.RATGEBER_IMG_DIR || join(APP, 'public', 'ratgeber', 'img'));
const OUT = resolve(process.env.RATGEBER_OUT_DIR || join(APP, 'dist'));
const LANG = TEXTE[process.env.RATGEBER_LANG] ? process.env.RATGEBER_LANG : 'en';
const TEMPLATE = join(APP, 'ratgeber-template');

const log = (...a) => console.log('[ratgeber:build]', ...a);
const warn = (...a) => console.warn('[ratgeber:build] WARNUNG:', ...a);

function basisUrl() {
  const roh = (process.env.PUBLIC_BASE_URL || 'https://cv.example.com').trim().replace(/\/+$/, '');
  try {
    const u = new URL(roh);
    if (!/^https?:$/.test(u.protocol) || u.search || u.hash) throw new Error();
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch {
    warn(`PUBLIC_BASE_URL "${roh}" ist keine gültige Adresse – nehme https://cv.example.com`);
    return 'https://cv.example.com';
  }
}
const BASIS = basisUrl();
const BASIS_HOST = new URL(BASIS).host;

/* ── Markdown → sicheres HTML ─────────────────────────────────────────────
 * Grundsatz: Es gibt kein rohes HTML. marked reicht HTML-Blöcke und -Tags
 * durch; die werden hier verworfen (und gemeldet). Adressen in Links und
 * Bildern laufen über eine Erlaubnisliste. Alles andere ist Text und wird
 * maskiert. */

function sichereUrl(href) {
  const h = String(href || '').trim();
  if (!h) return null;
  if (h.startsWith('#')) return { href: h, extern: false };
  if (h.startsWith('/') && !h.startsWith('//')) return { href: h, extern: false };
  try {
    const u = new URL(h);
    if (u.protocol === 'mailto:') return { href: h, extern: false };
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return { href: u.href, extern: u.host !== BASIS_HOST };
  } catch {
    return null;
  }
}

function erzeugeRenderer(kontext) {
  const t = TEXTE[kontext.lang] || TEXTE.de;
  const ids = new Map();
  const eindeutig = (text) => {
    const basis = slugify(text) || 'abschnitt';
    const n = ids.get(basis) || 0;
    ids.set(basis, n + 1);
    return n ? `${basis}-${n + 1}` : basis;
  };

  const kasten = {
    name: 'kasten',
    level: 'block',
    start(src) { const i = src.search(/^:::/m); return i < 0 ? undefined : i; },
    tokenizer(src) {
      const m = /^:::[ \t]*(info|notice|tip|tipp|success|warning|warnung|danger)?[ \t]*\n([\s\S]*?)\n:::[ \t]*(?:\n|$)/.exec(src);
      if (!m) return undefined;
      const art = { warning: 'warnung', warnung: 'warnung', danger: 'warnung', tip: 'tipp', tipp: 'tipp', success: 'tipp' }[m[1]] || 'hinweis';
      return { type: 'kasten', raw: m[0], art, tokens: this.lexer.blockTokens(m[2], []) };
    },
    renderer(token) {
      const titel = { hinweis: t.hinweis, warnung: t.warnung, tipp: t.tipp }[token.art];
      return `<div class="kasten kasten-${token.art}"><span class="kasten-titel">${esc(titel)}</span>${this.parser.parse(token.tokens)}</div>\n`;
    },
  };

  const markierung = {
    name: 'markierung',
    level: 'inline',
    start(src) { const i = src.indexOf('=='); return i < 0 ? undefined : i; },
    tokenizer(src) {
      const m = /^==(?=\S)([\s\S]*?\S)==/.exec(src);
      if (!m) return undefined;
      return { type: 'markierung', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
    },
    renderer(token) { return `<mark>${this.parser.parseInline(token.tokens)}</mark>`; },
  };

  const renderer = {
    html({ text }) {
      if (text.trim()) kontext.warnungen.push(`rohes HTML verworfen: ${text.trim().slice(0, 50)}`);
      return '';
    },
    heading({ tokens, depth }) {
      const tiefe = Math.min(Math.max(depth, 2), 4);
      const inner = this.parser.parseInline(tokens);
      const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const id = eindeutig(text);
      if (tiefe <= 3) kontext.toc.push({ tiefe, id, text });
      return `<h${tiefe} id="${id}">${inner}</h${tiefe}>\n`;
    },
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens);
      const u = sichereUrl(href);
      if (!u) { kontext.warnungen.push(`Link entfernt (Adresse nicht erlaubt): ${String(href).slice(0, 50)}`); return inner; }
      const t2 = title ? ` title="${esc(title)}"` : '';
      const rel = u.extern ? ' rel="noopener external"' : '';
      return `<a href="${esc(u.href)}"${t2}${rel}>${inner}</a>`;
    },
    image({ href, title, text }) {
      const m = /^\/ratgeber\/img\/([a-zA-Z0-9._-]+)$/.exec(String(href || '').trim());
      if (!m || !existsSync(join(IMG, m[1]))) {
        kontext.warnungen.push(`Bild entfernt (nur Bilder aus public/ratgeber/img sind erlaubt): ${String(href).slice(0, 60)}`);
        return '';
      }
      kontext.bilder.add(m[1]);
      const t2 = title ? ` title="${esc(title)}"` : '';
      return `<img src="/ratgeber/img/${esc(m[1])}" alt="${esc(text)}"${t2} loading="lazy" decoding="async">`;
    },
    table(token) {
      let kopf = '<tr>';
      for (const c of token.header) kopf += `<th scope="col"${c.align ? ` class="ziel-${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</th>`;
      kopf += '</tr>';
      let rumpf = '';
      for (const reihe of token.rows) {
        rumpf += '<tr>';
        for (const c of reihe) rumpf += `<td${c.align ? ` class="ziel-${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</td>`;
        rumpf += '</tr>';
      }
      // Breite Tabellen scrollen in sich, nicht die Seite. Das scrollbare
      // Element muss per Tastatur erreichbar sein (axe: scrollable-region-focusable).
      kontext.tabellen = (kontext.tabellen || 0) + 1;
      return `<section class="tabelle" aria-label="${esc(t.tabelle)} ${kontext.tabellen}" tabindex="0"><table><thead>${kopf}</thead><tbody>${rumpf}</tbody></table></section>\n`;
    },
    code({ text, lang }) {
      const klasse = lang && /^[a-z0-9+#-]{1,20}$/i.test(lang) ? ` class="sprache-${esc(lang)}"` : '';
      return `<pre tabindex="0" aria-label="${esc(t.code)}"><code${klasse}>${esc(text)}</code></pre>\n`;
    },
    checkbox({ checked }) {
      return `<span class="aufgabe" role="img" aria-label="${esc(checked ? t.erledigt : t.offen)}">${checked ? '☑' : '☐'}</span> `;
    },
  };

  const m = new Marked({ gfm: true, breaks: false });
  m.use({ extensions: [kasten, markierung], renderer });
  return m;
}

function renderMarkdown(body, lang) {
  const kontext = { lang, toc: [], warnungen: [], bilder: new Set() };
  const html = erzeugeRenderer(kontext).parse(body);
  return { html, ...kontext };
}

/** Wörter zählen für die Lesezeit (200 Wörter je Minute, mindestens 1). */
function lesezeit(body) {
  const woerter = body.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`|[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length;
  return { woerter, minuten: Math.max(1, Math.round(woerter / 200)) };
}

function kurzHash(buf) { return createHash('sha256').update(buf).digest('hex').slice(0, 10); }

/* ── Assets: CSS und Schriften, mit Inhalts-Hash im Namen ──────────────────
 * nginx liefert /ratgeber/assets/ mit „immutable" aus; ein neuer Stand muss
 * deshalb einen neuen Dateinamen haben. */
function schreibeAssets() {
  const ziel = join(OUT, 'ratgeber', 'assets');
  rmSync(ziel, { recursive: true, force: true });
  mkdirSync(ziel, { recursive: true });
  const schriften = [
    ['@fontsource-variable/geist', 'geist-latin-wght-normal.woff2'],
    ['@fontsource-variable/geist', 'geist-latin-ext-wght-normal.woff2'],
    ['@fontsource-variable/geist', 'geist-latin-wght-italic.woff2'],
    ['@fontsource-variable/geist-mono', 'geist-mono-latin-wght-normal.woff2'],
  ];
  let css = readFileSync(join(TEMPLATE, 'ratgeber.css'), 'utf8');
  const namen = {};
  for (const [paket, datei] of schriften) {
    const quelle = join(APP, 'node_modules', paket, 'files', datei);
    if (!existsSync(quelle)) { warn(`Schrift fehlt: ${paket}/files/${datei} – Seiten fallen auf Systemschrift zurück`); continue; }
    const buf = readFileSync(quelle);
    const name = datei.replace(/\.woff2$/, `.${kurzHash(buf)}.woff2`);
    writeFileSync(join(ziel, name), buf);
    namen[datei] = name;
    css = css.split(`url('${datei}')`).join(`url('${name}')`);
  }
  // Lizenz der Schrift mitliefern (SIL OFL verlangt das bei Weitergabe).
  for (const paket of ['@fontsource-variable/geist', '@fontsource-variable/geist-mono']) {
    const lic = join(APP, 'node_modules', paket, 'LICENSE');
    if (existsSync(lic)) copyFileSync(lic, join(ziel, `${paket.split('/')[1]}.LICENSE.txt`));
  }
  const cssName = `ratgeber.${kurzHash(Buffer.from(css))}.css`;
  writeFileSync(join(ziel, cssName), css);
  return {
    css: `/ratgeber/assets/${cssName}`,
    schrift: `/ratgeber/assets/${namen['geist-latin-wght-normal.woff2'] || ''}`,
  };
}

function sitemap(artikel) {
  const heute = new Date().toISOString().slice(0, 10);
  const neueste = artikel.reduce((m, a) => (a.meta.updated > m ? a.meta.updated : m), '');
  const eintraege = [
    { loc: `${BASIS}/`, changefreq: 'monthly', priority: '1.0' },
    { loc: `${BASIS}/preise`, changefreq: 'monthly', priority: '0.8' },
    { loc: `${BASIS}/ratgeber/`, lastmod: neueste ? neueste.slice(0, 10) : heute, changefreq: 'weekly', priority: '0.8' },
    ...artikel.map(a => ({ loc: `${BASIS}/ratgeber/${a.meta.slug}/`, lastmod: a.meta.updated.slice(0, 10), changefreq: 'monthly', priority: '0.7' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${eintraege.map(e => `  <url>
    <loc>${esc(e.loc)}</loc>${e.lastmod ? `
    <lastmod>${e.lastmod}</lastmod>` : ''}
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

/** robots.txt aus public/robots.txt übernehmen, Sitemap-Zeile auf die Basis. */
function robots() {
  const quelle = [join(OUT, 'robots.txt'), join(APP, 'public', 'robots.txt')].find(existsSync);
  let text = quelle ? readFileSync(quelle, 'utf8') : 'User-agent: *\nAllow: /\n';
  text = text.replace(/^Sitemap:.*$/gim, '').replace(/\n{3,}/g, '\n\n').trimEnd();
  return `${text}\n\nSitemap: ${BASIS}/sitemap.xml\n`;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const { css, schrift } = schreibeAssets();
  const ogImage = existsSync(join(OUT, 'og.png')) ? `${BASIS}/og.png` : null;

  const ok = [];
  const slugs = new Set();
  let uebersprungen = 0;
  for (const a of leseArtikel(CONTENT)) {
    const name = a.datei.split('/').pop();
    if (a.fehler.length) { uebersprungen++; warn(`${name} übersprungen: ${a.fehler.join('; ')}`); continue; }
    if (slugs.has(a.meta.slug)) { uebersprungen++; warn(`${name} übersprungen: slug doppelt`); continue; }
    const treffer = pruefeText(`${a.meta.title}\n${a.meta.description}\n${a.body}`, { outlineUrl: process.env.OUTLINE_URL, publicBaseUrl: BASIS });
    if (treffer.length) {
      uebersprungen++;
      warn(`${name} GESPERRT (Sperrliste):`);
      for (const t of treffer) warn(`   Zeile ${t.zeile}: ${t.muster} – ${t.auszug}`);
      continue;
    }
    for (const h of hinweiseMeta(a.meta)) log(`Hinweis ${name}: ${h}`);
    slugs.add(a.meta.slug);
    ok.push(a);
  }

  // Neueste zuerst; bei gleichem Datum alphabetisch.
  ok.sort((x, y) => (y.meta.updated.localeCompare(x.meta.updated)) || x.meta.title.localeCompare(y.meta.title, 'de'));

  const ziel = join(OUT, 'ratgeber');
  // Alte Artikelordner entfernen, damit zurückgezogene Artikel verschwinden.
  if (existsSync(ziel)) {
    for (const n of readdirSync(ziel, { withFileTypes: true })) {
      if (n.isDirectory() && n.name !== 'assets' && n.name !== 'img') rmSync(join(ziel, n.name), { recursive: true, force: true });
    }
  }

  const bilder = new Set();
  const fertig = [];
  for (const a of ok) {
    const r = renderMarkdown(a.body, a.meta.lang);
    for (const w of r.warnungen) warn(`${a.meta.slug}: ${w}`);
    for (const b of r.bilder) bilder.add(b);
    const { minuten, woerter } = lesezeit(a.body);
    // Inhaltsverzeichnis erst bei langen Artikeln: ab vier Zwischenüberschriften
    // oder ab 900 Wörtern mit mindestens zwei.
    const h2 = r.toc.filter(h => h.tiefe === 2).length;
    const toc = (h2 >= 4 || (woerter >= 900 && h2 >= 2)) ? r.toc : [];
    const datum = datumAnzeige(a.meta.updated, a.meta.lang);
    const html = artikelSeite({
      meta: a.meta, html: r.html, toc, minuten, datum, css, schrift, ogImage,
      canonical: `${BASIS}/ratgeber/${a.meta.slug}/`, basis: BASIS,
    });
    mkdirSync(join(ziel, a.meta.slug), { recursive: true });
    writeFileSync(join(ziel, a.meta.slug, 'index.html'), html);
    fertig.push({ meta: a.meta, minuten, datum });
  }

  writeFileSync(join(ziel, 'index.html'), uebersichtSeite({ lang: LANG, artikel: fertig, canonical: `${BASIS}/ratgeber/`, basis: BASIS, css, schrift, ogImage }));
  writeFileSync(join(ziel, '404.html'), nichtGefundenSeite({ lang: LANG, css, schrift }));

  // Benutzte Bilder ins Ziel (vite kopiert public/ ohnehin; für eigene
  // Zielordner und als Sicherheit, falls public/ratgeber/img fehlt).
  if (bilder.size) {
    mkdirSync(join(ziel, 'img'), { recursive: true });
    for (const b of bilder) copyFileSync(join(IMG, b), join(ziel, 'img', b));
  }

  writeFileSync(join(OUT, 'sitemap.xml'), sitemap(fertig));
  writeFileSync(join(OUT, 'robots.txt'), robots());

  log(`${fertig.length} Artikel gebaut${uebersprungen ? `, ${uebersprungen} übersprungen` : ''} → ${join(ziel)} (Basis ${BASIS})`);
}

try {
  main();
} catch (e) {
  // Der Ratgeber darf den Bau der App nie verhindern.
  warn(`Ratgeber-Bau abgebrochen: ${e.stack || e.message}`);
  process.exit(process.env.RATGEBER_BUILD_STRICT === '1' ? 1 : 0);
}
