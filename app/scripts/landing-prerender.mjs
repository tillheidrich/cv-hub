// Vorrendern der Startseite und von /preise, dazu Sitemap, robots.txt,
// llms.txt und die App-Hülle für alle übrigen Pfade. Läuft in `npm run build`
// nach `vite build`, dem SSR-Bau (src/landing/vite.ssr.config.ts) und
// scripts/magazin-build.mjs.
//
// Warum: Die App ist eine SPA. Ohne Vorrendern liefert der Server unter /
// nur <div id="root"></div>; Suchmaschinen, KI-Crawler und Vorschaukarten
// sehen keinen Text. Jetzt steht im ausgelieferten HTML alles: H1, Abschnitte,
// FAQ, Links, strukturierte Daten (JSON-LD), Canonical, hreflang, og:image.
// Gerendert wird die echte Komponente mit react-dom/server, ohne Browser im
// Bau-Image. Die App übernimmt die Seite ohne Flackern (src/landing/boot.ts).
//
// Ergebnis in dist/:
//   index.html            Startseite Deutsch (/)
//   en|fr|es/index.html   Sprachfassungen (/en/, /fr/, /es/)
//   preise/index.html     /preise (Deutsch)
//   app.html              Hülle ohne Vorrendern für alle anderen Pfade (noindex)
//   sitemap.xml           mit hreflang-Alternativen und Magazin
//   robots.txt, llms.txt
//
// Umgebung:
//   PUBLIC_BASE_URL       Basis für canonical, hreflang, og:url, Sitemap
//   PRERENDER_OFFER_URL   woher das Angebot kommt (Standard
//                         <PUBLIC_BASE_URL>/pdfapi/api/billing/offer)
//   PRERENDER_OFFER_JSON  Angebot fest vorgeben (Prüfläufe; "null" = keins)
//   PRERENDER_OFFER=off   ohne Angebot rendern
//   PRERENDER_OUT_DIR     Ziel (Standard dist)
//   PRERENDER_STRICT=1    Fehler brechen den Bau ab (Prüfläufe)
//
// Das Angebot wird beim Bau einmal gelesen: Preisabschnitt und JSON-LD
// (offers) zeigen den Stand dieses Moments. Die laufende Seite holt es beim
// Öffnen neu. Wird der Verkauf am Server ein- oder ausgeschaltet, einmal das
// Frontend neu bauen, damit auch das vorgerenderte HTML stimmt.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FALLBACK_BASE_URL } from '../src/landing/brand.js';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(process.env.PRERENDER_OUT_DIR || join(APP, 'dist'));
const SSR = join(APP, 'node_modules', '.cache', 'landing-ssr', 'ssr.mjs');
const STRICT = process.env.PRERENDER_STRICT === '1';
const log = (...a) => console.log('[landing:prerender]', ...a);
const warn = (...a) => console.warn('[landing:prerender] WARNUNG:', ...a);

function basisUrl() {
  const roh = (process.env.PUBLIC_BASE_URL || FALLBACK_BASE_URL).trim().replace(/\/+$/, '');
  try {
    const u = new URL(roh);
    if (!/^https?:$/.test(u.protocol) || u.search || u.hash) throw new Error();
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch {
    warn(`PUBLIC_BASE_URL "${roh}" ist keine gültige Adresse – nehme ${FALLBACK_BASE_URL}`);
    return FALLBACK_BASE_URL;
  }
}
const BASIS = basisUrl();

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** JSON in <script>: nichts darf das Element beenden. */
const jsonInScript = obj => JSON.stringify(obj)
  .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const pathOf = l => (l === 'de' ? '/' : `/${l}/`);
const OG_LOCALE = { de: 'de_DE', en: 'en_GB', fr: 'fr_FR', es: 'es_ES' };

/** Nur die Felder, die die Seite braucht, und nur mit gültigen Typen. */
function cleanOffer(o) {
  if (!o || typeof o !== 'object' || typeof o.priceCents !== 'number' || typeof o.currency !== 'string') return null;
  const out = {
    enabled: o.enabled === true, sku: String(o.sku || ''), priceCents: o.priceCents, currency: o.currency,
    days: Number.isFinite(o.days) ? o.days : 90,
  };
  for (const k of ['vatNote', 'productName']) if (typeof o[k] === 'string') out[k] = o[k];
  if (Array.isArray(o.features)) out.features = o.features.filter(f => typeof f === 'string');
  if (Array.isArray(o.paymentMethods)) out.paymentMethods = o.paymentMethods.filter(f => typeof f === 'string');
  if (typeof o.openRegistration === 'boolean') out.openRegistration = o.openRegistration;
  if (o.freeTier && typeof o.freeTier.limited === 'boolean') out.freeTier = { limited: o.freeTier.limited };
  return out;
}

async function holeAngebot() {
  if (process.env.PRERENDER_OFFER_JSON !== undefined) {
    try { return cleanOffer(JSON.parse(process.env.PRERENDER_OFFER_JSON)); }
    catch { warn('PRERENDER_OFFER_JSON ist kein JSON – ohne Angebot'); return null; }
  }
  if (process.env.PRERENDER_OFFER === 'off') return null;
  const url = process.env.PRERENDER_OFFER_URL || `${BASIS}/pdfapi/api/billing/offer`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const o = cleanOffer(await r.json());
    log(o ? `Angebot von ${url}: ${o.priceCents / 100} ${o.currency}, Verkauf ${o.enabled ? 'offen' : 'zu'}${o.freeTier?.limited ? ', Gratis-Grenze an' : ''}` : `kein Angebot unter ${url}`);
    return o;
  } catch (e) {
    warn(`Angebot nicht erreichbar (${url}: ${e.message}) – Startseite ohne Preisabschnitt, die Seite lädt ihn beim Öffnen nach.`);
    return null;
  }
}

function magazinIndex() {
  const f = join(DIST, 'magazin', 'index.json');
  if (!existsSync(f)) return [];
  try { return JSON.parse(readFileSync(f, 'utf8')).articles || []; }
  catch (e) { warn(`magazin/index.json nicht lesbar: ${e.message}`); return []; }
}

/** Geist-Datei aus dem Vite-Bau (Name mit Hash) für den Preload. */
function geistFont() {
  const dir = join(DIST, 'assets');
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find(n => /^geist-latin-wght-normal-[\w-]+\.woff2$/.test(n));
  return f ? `/assets/${f}` : null;
}

const srcset = (list, v) => list.map(([f, w]) => `/landing/${f}?v=${v} ${w}w`).join(', ');

function heroPreload(shots, lang) {
  const a = shots[`hero-a-${lang}`] || shots['hero-a-de'];
  const p = shots[`phone-${lang}`] || shots['phone-de'];
  const out = [];
  // Gleiche sizes wie die <picture> in src/landing/HeroShowcase.tsx, sonst
  // lädt der Browser das Bild zweimal.
  if (a) out.push(`<link rel="preload" as="image" type="image/avif" imagesrcset="${esc(srcset(a.avif, a.v))}" imagesizes="(max-width: 1080px) calc(100vw - 64px), 780px" media="(min-width: 761px)" fetchpriority="high">`);
  if (p) out.push(`<link rel="preload" as="image" type="image/avif" imagesrcset="${esc(srcset(p.avif, p.v))}" imagesizes="min(86vw, 360px)" media="(max-width: 760px)" fetchpriority="high">`);
  return out;
}

function ogImage(lang) {
  const name = lang === 'de' ? 'og.png' : `og-${lang}.png`;
  if (existsSync(join(DIST, name))) return `${BASIS}/${name}`;
  if (existsSync(join(DIST, 'og.png'))) return `${BASIS}/og.png`;
  return null;
}

function kopfLanding(ssr, lang, offer, articles, font) {
  const m = ssr.landingMeta(lang, offer);
  const url = `${BASIS}${m.path}`;
  const og = ogImage(lang);
  const brand = ssr.SSR_INFO.brand.name;
  const app = {
    '@type': 'SoftwareApplication',
    '@id': `${BASIS}/#app`,
    name: brand,
    url: `${BASIS}/`,
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Resume builder',
    operatingSystem: 'Web',
    inLanguage: ['de', 'en', 'fr', 'es'],
    description: m.description,
    featureList: [...m.proof, ...m.features],
    isAccessibleForFree: true,
    publisher: { '@id': `${BASIS}/#org` },
  };
  if (og) app.image = og;
  // offers nur bei offenem Verkauf: Ein Preis im strukturierten Datenblock,
  // den man nicht kaufen kann, wäre irreführend.
  if (offer && offer.enabled) {
    app.offers = {
      '@type': 'Offer',
      price: (offer.priceCents / 100).toFixed(2),
      priceCurrency: offer.currency,
      url: `${BASIS}/preise`,
      availability: 'https://schema.org/InStock',
      description: `${offer.productName || brand}: ${offer.days} Tage, einmalig, kein Abo`,
    };
  }
  const graph = [
    { '@type': 'Organization', '@id': `${BASIS}/#org`, name: brand, url: `${BASIS}/`, sameAs: [ssr.SSR_INFO.repo].filter(Boolean) },
    { '@type': 'WebSite', '@id': `${BASIS}/#website`, name: brand, url: `${BASIS}/`, inLanguage: ['de', 'en', 'fr', 'es'], publisher: { '@id': `${BASIS}/#org` } },
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: m.title, description: m.description, inLanguage: lang,
      isPartOf: { '@id': `${BASIS}/#website` }, about: { '@id': `${BASIS}/#app` },
      ...(og ? { primaryImageOfPage: { '@type': 'ImageObject', url: og, width: 1200, height: 630 } } : {}),
    },
    app,
    {
      '@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: lang,
      mainEntity: m.faq.map(q => ({ '@type': 'Question', name: q.q, acceptedAnswer: { '@type': 'Answer', text: q.a } })),
    },
  ];
  const kopf = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    ...ssr.SSR_INFO.langs.map(l => `<link rel="alternate" hreflang="${l}" href="${esc(BASIS + pathOf(l))}" />`),
    `<link rel="alternate" hreflang="x-default" href="${esc(BASIS)}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(brand)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    ...ssr.SSR_INFO.langs.filter(l => l !== lang).map(l => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}" />`),
    `<meta name="twitter:card" content="${og ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
  ];
  if (og) kopf.push(
    `<meta property="og:image" content="${esc(og)}" />`, `<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(m.ogAlt)}" />`, `<meta name="twitter:image" content="${esc(og)}" />`,
  );
  if (font) kopf.push(`<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin />`);
  kopf.push(...heroPreload(ssr.SSR_INFO.shots, lang));
  kopf.push(`<script type="application/ld+json">${jsonInScript({ '@context': 'https://schema.org', '@graph': graph })}</script>`);
  kopf.push(`<script type="application/json" id="cv-landing-data">${jsonInScript({ offer, articles })}</script>`);
  return kopf.map(z => `    ${z}`).join('\n');
}

function kopfPreise(ssr, offer, font) {
  const m = ssr.pricingMeta('de', offer);
  const url = `${BASIS}/preise`;
  const og = ogImage('de');
  const brand = ssr.SSR_INFO.brand.name;
  const graph = [
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: m.title, description: m.description, inLanguage: 'de', isPartOf: { '@type': 'WebSite', '@id': `${BASIS}/#website`, name: brand, url: `${BASIS}/` } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: brand, item: `${BASIS}/` },
      { '@type': 'ListItem', position: 2, name: m.title.split(' · ')[0], item: url },
    ] },
  ];
  if (offer && offer.enabled) {
    graph.push({
      '@type': 'SoftwareApplication', '@id': `${BASIS}/#app`, name: brand, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: (offer.priceCents / 100).toFixed(2), priceCurrency: offer.currency, url, availability: 'https://schema.org/InStock', description: `${m.productName}: ${offer.days} Tage, einmalig, kein Abo` },
    });
  }
  const kopf = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(brand)}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:locale" content="de_DE" />`,
    `<meta name="twitter:card" content="${og ? 'summary_large_image' : 'summary'}" />`,
  ];
  if (og) kopf.push(`<meta property="og:image" content="${esc(og)}" />`, `<meta name="twitter:image" content="${esc(og)}" />`);
  if (font) kopf.push(`<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin />`);
  kopf.push(`<script type="application/ld+json">${jsonInScript({ '@context': 'https://schema.org', '@graph': graph })}</script>`);
  return kopf.map(z => `    ${z}`).join('\n');
}

const KOPF_RE = /<!--cv:head:start-->[\s\S]*?<!--cv:head:end-->/;

function seite(vorlage, { lang, kopf, body, kind }) {
  if (!KOPF_RE.test(vorlage)) throw new Error('dist/index.html ohne <!--cv:head:start--> … <!--cv:head:end-->');
  let html = vorlage.replace(KOPF_RE, `<!--cv:head-->\n${kopf}\n    <!--/cv:head-->`);
  html = html.replace(/<html lang="[a-z-]+">/i, `<html lang="${lang}">`);
  if (!html.includes('<div id="root"></div>')) throw new Error('dist/index.html ohne <div id="root"></div>');
  html = html.replace('<div id="root"></div>', `<div id="prerender" data-kind="${kind}">${body}</div><div id="root" hidden></div>`);
  return html;
}

function sitemap(articles, langs) {
  const heute = new Date().toISOString().slice(0, 10);
  const alt = langs.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(BASIS + pathOf(l))}"/>`).concat(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(BASIS)}/"/>`).join('\n');
  const eintraege = [];
  for (const l of langs) eintraege.push(`  <url>\n    <loc>${esc(BASIS + pathOf(l))}</loc>\n    <lastmod>${heute}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${l === 'de' ? '1.0' : '0.9'}</priority>\n${alt}\n  </url>`);
  eintraege.push(`  <url>\n    <loc>${esc(BASIS)}/preise</loc>\n    <lastmod>${heute}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
  const neueste = articles.reduce((m, a) => (a.updated > m ? a.updated : m), '') || heute;
  eintraege.push(`  <url>\n    <loc>${esc(BASIS)}/magazin/</loc>\n    <lastmod>${neueste}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`);
  for (const k of [...new Set(articles.map(a => a.category).filter(Boolean))]) {
    eintraege.push(`  <url>\n    <loc>${esc(BASIS)}/magazin/thema/${k}/</loc>\n    <lastmod>${neueste}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`);
  }
  for (const a of articles) eintraege.push(`  <url>\n    <loc>${esc(BASIS)}/magazin/${a.slug}/</loc>\n    <lastmod>${a.updated}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${eintraege.join('\n')}\n</urlset>\n`;
}

function robots() {
  const quelle = join(APP, 'public', 'robots.txt');
  let text = existsSync(quelle) ? readFileSync(quelle, 'utf8') : 'User-agent: *\nAllow: /\n';
  text = text.replace(/^Sitemap:.*$/gim, '').replace(/\n{3,}/g, '\n\n').trimEnd();
  return `${text}\n\nSitemap: ${BASIS}/sitemap.xml\n`;
}

/** llms.txt: ehrlich und aus dem Stand dieses Baus (Vorlagenzahl, Formate,
 *  Angebot, Artikel). Formate werden an den Modulen im Code erkannt. */
function llms(ssr, offer, articles) {
  const brand = ssr.SSR_INFO.brand.name;
  const n = ssr.SSR_INFO.templates.length;
  const hat = f => existsSync(join(APP, 'src', ...f.split('/')));
  const formate = ['PDF (Vektor, echte Textebene, genau die Seiten der Vorschau)', 'PDF in der ATS-Fassung (einspaltig)', 'Word (.docx) mit dem Design der Vorlage', 'Word (.docx) in der ATS-Fassung, einspaltig ohne Tabellen', 'HTML', 'Markdown', 'JSON', 'JSON Resume'];
  if (hat('export/exportLatex.ts')) formate.push('LaTeX (.tex, für pdfLaTeX und Overleaf)');
  if (hat('import/rendercv.ts')) formate.push('RenderCV (YAML)');
  const importe = ['Markdown', 'JSON Resume', 'LinkedIn-Datenexport (ZIP, wird im Browser gelesen)'];
  if (hat('import/rendercv.ts')) importe.push('RenderCV (YAML)');
  if (hat('import/latexImport.ts')) importe.push('LaTeX (nur .tex-Dateien, die aus diesem Werkzeug stammen)');
  const preis = offer
    ? `Ohne Konto kostenlos im Browser, das PDF des Lebenslaufs inklusive. Bewerbungs-Pass: ${(offer.priceCents / 100).toLocaleString('de-DE', { minimumFractionDigits: offer.priceCents % 100 ? 2 : 0 })} ${offer.currency === 'EUR' ? '€' : offer.currency} einmalig für ${offer.days} Tage, kein Abo, endet von selbst. Zum Pass gehören Word, LaTeX, das Anschreiben samt Prüfung, weitere Fassungen und Sprachen${offer.enabled ? '' : ' (Verkauf zum Zeitpunkt dieses Stands noch nicht geöffnet)'}. Details: ${BASIS}/preise`
    : `Siehe ${BASIS}/preise. Selbst betrieben kostet das Werkzeug nichts.`;
  const artikel = articles.length
    ? articles.map(a => `- [${a.title}](${BASIS}/magazin/${a.slug}/): ${a.description}`).join('\n')
    : '- (noch keine Artikel)';
  return `# ${brand}

> ${brand} ist ein Werkzeug für Lebenslauf und Anschreiben im Browser. Man schreibt direkt in der Vorschau, wählt aus ${n} Vorlagen und lädt ein PDF mit echter Textebene herunter, deren Lesereihenfolge Prüfskripte gegen die Vorschau vergleichen. Für Bewerbungsportale gibt es zu jeder Vorlage dieselbe Fassung einspaltig als PDF oder Word. Starten geht ohne Konto. Keine eingebaute KI; eine Markdown-Brücke und ein MCP-Server verbinden externe Modelle. Quelloffen unter AGPL-3.0.

Stand: ${new Date().toISOString().slice(0, 10)}. Website auf Deutsch (${BASIS}/), Englisch (${BASIS}/en/), Französisch (${BASIS}/fr/) und Spanisch (${BASIS}/es/).

## Was das Werkzeug kann

- ${n} wählbare Vorlagen: einspaltig, mit Kopfband oder mit Seitenspalte, jede mit eigener Schriftpaarung; acht Akzentfarben und Papiertöne getrennt davon
- Jede Vorlage trägt eine Marke: „Gut für Portale“ (eine Spalte), „Für Portale geeignet“ (Kopfband, danach eine Spalte) oder „Für Mail und Druck“ (zwei Spalten)
- ATS-Fassung mit einem Klick: derselbe Inhalt einspaltig, als PDF oder Word, ohne die gewählte Vorlage im Profil zu ändern
- Export: ${formate.join(', ')}
- Import: ${importe.join(', ')}
- Lebenslauf, Anschreiben und Oberfläche in vier Sprachen: Deutsch, Englisch, Französisch, Spanisch
- Seitenzahl: eine bis vier Seiten oder automatisch; was über vier Seiten hinausgeht, wird gemeldet und nicht abgeschnitten
- Prüfen-Paneel für Lebenslauf, Anschreiben und beide zusammen: zeigt den Text in der Reihenfolge, in der ein Parser ihn aus dem PDF liest, meldet fehlende Angaben (beim Anschreiben auch Betreff, Datum, Anrede, Länge, Platzhalter) und gleicht mit einer Stellenanzeige ab; unter „Beides“ werden Name, Kontakt und Sprache beider Unterlagen verglichen. Keine Punktzahl
- Ohne Konto: Lebensläufe werden im Browser gespeichert (IndexedDB), Sicherungsdatei zum Mitnehmen. Für den PDF-Export geht das Dokument kurz an den eigenen Server und wird dort nicht gespeichert
- Mit Konto: Speichern über Geräte, Sharelinks, Versionen am Server, MCP-Anbindung für KI-Assistenten

## Preise

- ${preis}

## Was geprüft ist und was nicht

- Prüfskripte im Quelltext (${ssr.SSR_INFO.repo}, Ordner app/scripts) drucken jede Vorlage als PDF, lesen die Textebene mit pdftotext wieder aus und vergleichen sie Seite für Seite mit der Vorschau: Text, Lesereihenfolge, Wortgrenzen, Trennstriche.
- Keine Garantie, dass ein bestimmtes Bewerbermanagement-System einen Lebenslauf richtig liest: Jedes System hat seinen eigenen Parser. Für Portale wird die einspaltige ATS-Fassung empfohlen.
- Keine Ablehnungsquote: Die verbreitete Zahl „75 % werden vom ATS aussortiert" stammt aus einem Verkaufsargument von 2012 ohne Methodik.
- Belege zu Lesefehlern: Personio (https://support.personio.de/hc/en-us/articles/360010193018), Greenhouse (https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse), Textkernel (https://www.textkernel.com/learn-support/blog/improving-extraction-from-column-resumes/).

## Magazin

${artikel}

Übersicht: ${BASIS}/magazin/

## Für KI-Agenten ohne MCP-Server

Das Werkzeug lässt sich vollständig über Markdown bedienen, ohne Konto auf Agentenseite:

1. Vorlage holen: ${BASIS}/vorlage-lebenslauf-de.md, ${BASIS}/vorlage-lebenslauf-en.md, ${BASIS}/vorlage-anschreiben-de.md, ${BASIS}/vorlage-anschreiben-en.md
2. In genau dieser Struktur ausfüllen. Der Frontmatter-Block steuert Sprache, Schriftgröße und Seitenzahl (pageMode).
3. Den Text im Werkzeug unter „Import" einfügen. Vor jedem Import legt das Werkzeug eine Version an; vor dem Übernehmen zeigt es jede Änderung.

## Datenschutz

- Selbst betrieben: Konten und Lebensläufe liegen auf dem Server dieser Instanz (Standort: siehe Datenschutzerklärung); Schriften selbst ausgeliefert, keine Aufrufe an fremde Server
- Keine Werbe-Tracker; Reichweitenmessung ist ab Werk aus (optional selbst betriebenes Umami, ohne Cookies)
- Keine externen KI-Dienste eingebunden

## Quelltext und Rechtliches

- Quelltext (AGPL-3.0): ${ssr.SSR_INFO.repo}
- Impressum: ${BASIS}/impressum · Datenschutz: ${BASIS}/datenschutz · AGB: ${BASIS}/agb
`;
}

async function main() {
  if (!existsSync(SSR)) throw new Error(`SSR-Bündel fehlt (${SSR}) – vorher: vite build --config src/landing/vite.ssr.config.ts`);
  const vorlagePfad = join(DIST, 'index.html');
  if (!existsSync(vorlagePfad)) throw new Error('dist/index.html fehlt – vorher vite build');
  // Die Vorlage ist der Vite-Bau. Ein zweiter Lauf auf einem schon
  // vorgerenderten dist/ nimmt die gesicherte Hülle.
  const huelle = join(DIST, 'app.html');
  // Außerhalb des SSR-Ordners (den leert jeder SSR-Bau). Ein Bau schreibt
  // dist/index.html neu, dann wird die Vorlage hier aufgefrischt.
  const sicherung = join(APP, 'node_modules', '.cache', 'landing-template.html');
  let vorlage = readFileSync(vorlagePfad, 'utf8');
  if (vorlage.includes('id="prerender"')) {
    if (!existsSync(sicherung)) throw new Error('dist/index.html ist schon vorgerendert und die Vorlage fehlt – erst neu bauen');
    vorlage = readFileSync(sicherung, 'utf8');
  } else writeFileSync(sicherung, vorlage);

  const ssr = await import(pathToFileURL(SSR).href + `?t=${Date.now()}`);
  const offer = await holeAngebot();
  const alle = magazinIndex();
  const articles = alle.slice(0, 6).map(a => ({ slug: a.slug, title: a.title, description: a.description, category: a.category ?? null, categoryName: a.categoryName ?? null, lang: a.lang, updated: a.updated, published: a.published, minutes: a.minutes }));
  const font = geistFont();
  if (!font) warn('Geist-Schrift im Bau nicht gefunden – kein Preload');

  // App-Hülle: allgemeiner Kopf, keine Indexierung (Impressum, Kauf, Demo …).
  const shellKopf = vorlage.match(KOPF_RE)[0]
    .replace('<!--cv:head:start-->', '<!--cv:head-->').replace('<!--cv:head:end-->', '<!--/cv:head-->')
    .replace('<!--cv:head-->', '<!--cv:head-->\n    <meta name="robots" content="noindex, follow" />');
  writeFileSync(huelle, vorlage.replace(KOPF_RE, shellKopf));

  for (const lang of ssr.SSR_INFO.langs) {
    const body = ssr.renderLanding({ lang, offer, articles });
    const html = seite(vorlage, { lang, kind: 'landing', kopf: kopfLanding(ssr, lang, offer, articles, font), body });
    const ziel = lang === 'de' ? DIST : join(DIST, lang);
    mkdirSync(ziel, { recursive: true });
    writeFileSync(join(ziel, 'index.html'), html);
  }
  const preise = ssr.renderPricing('de', offer);
  mkdirSync(join(DIST, 'preise'), { recursive: true });
  writeFileSync(join(DIST, 'preise', 'index.html'), seite(vorlage, { lang: 'de', kind: 'pricing', kopf: kopfPreise(ssr, offer, font), body: preise }));

  writeFileSync(join(DIST, 'sitemap.xml'), sitemap(alle, ssr.SSR_INFO.langs));
  writeFileSync(join(DIST, 'robots.txt'), robots());
  writeFileSync(join(DIST, 'llms.txt'), llms(ssr, offer, alle));
  log(`vorgerendert: / /en/ /fr/ /es/ /preise · ${ssr.SSR_INFO.templates.length} Vorlagen · ${articles.length} Artikel auf der Startseite · Angebot ${offer ? (offer.enabled ? 'offen' : 'geschlossen') : 'keins'} · Basis ${BASIS}`);
}

main().catch(e => {
  warn(`Vorrendern abgebrochen: ${e.stack || e.message}`);
  // Ohne Vorrendern bleibt dist/index.html die normale SPA-Hülle; die Seite
  // funktioniert, nur ohne Text im HTML. app.html muss es trotzdem geben,
  // weil nginx darauf zurückfällt.
  try {
    const v = join(DIST, 'index.html');
    if (existsSync(v) && !existsSync(join(DIST, 'app.html'))) writeFileSync(join(DIST, 'app.html'), readFileSync(v, 'utf8'));
  } catch { /* ignore */ }
  process.exit(STRICT ? 1 : 0);
});
