// HTML-Gerüst der Ratgeber-Seiten: Kopf, Fuß, Artikel, Übersicht, 404.
//
// Reines HTML ohne JavaScript. Das einzige <script> ist JSON-LD (wird nicht
// ausgeführt). Keine style-Attribute: Die CSP für /ratgeber/ erlaubt nur
// Stylesheets von derselben Herkunft.

import { MARKE, TEXTE, OG_LOCALE, RECHTS_LINKS } from './texte.mjs';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** JSON für <script type="application/ld+json">: "</" und Zeilentrenner
 *  maskieren, damit der Inhalt das Element nie beenden kann. */
function jsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const MARK_SVG = '<svg viewBox="0 0 30 30" fill="none" aria-hidden="true" focusable="false"><rect x="3" y="3" width="24" height="24" stroke-width="1.4"></rect><line x1="15" y1="3" x2="15" y2="27" stroke-width="1.4"></line><line x1="7" y1="9" x2="11" y2="9" stroke-width="1.4"></line><line x1="7" y1="13" x2="11" y2="13" stroke-width="1.4"></line><line x1="7" y1="17" x2="10" y2="17" stroke-width="1.4"></line><line x1="19" y1="9" x2="23" y2="9" stroke-width="1.4"></line><line x1="19" y1="13" x2="23" y2="13" stroke-width="1.4"></line><line x1="19" y1="17" x2="22" y2="17" stroke-width="1.4"></line></svg>';

/** „Name/cv" → Name<span>/cv</span>; Namen ohne Schrägstrich bleiben schlicht. */
function markenWort() {
  const i = MARKE.name.indexOf('/');
  if (i <= 0) return esc(MARKE.name);
  return `${esc(MARKE.name.slice(0, i))}<span>${esc(MARKE.name.slice(i))}</span>`;
}

function marke(t) {
  return `<a class="marke" href="/" aria-label="${esc(MARKE.name)} – ${esc(t.home)}">${MARK_SVG}<span class="marke-wort">${markenWort()}</span></a>`;
}

function kopf(t, aktuell) {
  return `<header class="kopf">
  <div class="kopf-inner">
    ${marke(t)}
    <nav class="kopf-nav" aria-label="${esc(t.nav)}">
      <ul>
        <li><a href="/ratgeber/"${aktuell === 'ratgeber' ? ' aria-current="page"' : ''}>${esc(t.ratgeber)}</a></li>
        <li><a href="/preise">${esc(t.pricing)}</a></li>
      </ul>
    </nav>
    <a class="btn btn-primaer kopf-cta" href="/demo">${esc(t.demo)}</a>
  </div>
</header>`;
}

function fuss(t) {
  const links = RECHTS_LINKS.map(([k, href]) => `<li><a href="${href}">${esc(t[k])}</a></li>`).join('');
  return `<footer class="fuss">
  <div class="fuss-inner">
    ${marke(t)}
    <nav aria-label="${esc(t.rechtliches)}"><ul>${links}</ul></nav>
    <span class="fuss-meta">© ${new Date().getFullYear()} ${esc(MARKE.herausgeber)}</span>
  </div>
</footer>`;
}

function huelle({ lang, titel, beschreibung, canonical, ogType, css, schrift, jsonld, robots, aktuell, inhalt, ogImage, modified }) {
  const t = TEXTE[lang] || TEXTE.de;
  const meta = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(titel)}</title>`,
    beschreibung ? `<meta name="description" content="${esc(beschreibung)}">` : '',
    robots ? `<meta name="robots" content="${robots}">` : '',
    canonical ? `<link rel="canonical" href="${esc(canonical)}">` : '',
    `<meta name="theme-color" content="#eef0f5">`,
    `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`,
    `<link rel="preload" href="${esc(schrift)}" as="font" type="font/woff2" crossorigin>`,
    `<link rel="stylesheet" href="${esc(css)}">`,
  ];
  if (canonical) {
    meta.push(
      `<meta property="og:type" content="${ogType}">`,
      `<meta property="og:site_name" content="${esc(MARKE.name)}">`,
      `<meta property="og:title" content="${esc(titel)}">`,
      `<meta property="og:description" content="${esc(beschreibung)}">`,
      `<meta property="og:url" content="${esc(canonical)}">`,
      `<meta property="og:locale" content="${OG_LOCALE[lang] || 'de_DE'}">`,
      `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`,
    );
    if (ogImage) meta.push(`<meta property="og:image" content="${esc(ogImage)}">`);
    if (modified) meta.push(`<meta property="article:modified_time" content="${esc(modified)}">`);
  }
  if (jsonld) meta.push(`<script type="application/ld+json">${jsonLd(jsonld)}</script>`);
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
${meta.filter(Boolean).join('\n')}
</head>
<body>
<a class="skip" href="#inhalt">${esc(t.skip)}</a>
${kopf(t, aktuell)}
<main id="inhalt" tabindex="-1">
${inhalt}
</main>
${fuss(t)}
</body>
</html>
`;
}

function tocListe(toc) {
  // h2 als erste Ebene, h3 darunter.
  let html = '<ol>';
  let offen = false;
  for (const h of toc) {
    if (h.tiefe === 2) {
      if (offen) { html += '</ol></li>'; offen = false; }
      html += `<li><a href="#${h.id}">${esc(h.text)}</a>`;
      const naechste = toc[toc.indexOf(h) + 1];
      if (naechste && naechste.tiefe === 3) { html += '<ol>'; offen = true; } else html += '</li>';
    } else if (offen) {
      html += `<li><a href="#${h.id}">${esc(h.text)}</a></li>`;
    }
  }
  if (offen) html += '</ol></li>';
  return html + '</ol>';
}

/**
 * Artikelseite.
 * @param {{ meta, html, toc, minuten, canonical, basis, css, schrift, ogImage, datum }} a
 */
export function artikelSeite(a) {
  const lang = a.meta.lang;
  const t = TEXTE[lang] || TEXTE.de;
  const mitToc = a.toc.length > 0;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.meta.title,
    description: a.meta.description,
    inLanguage: lang,
    url: a.canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': a.canonical },
    datePublished: a.meta.published || a.meta.updated,
    dateModified: a.meta.updated,
    author: { '@type': 'Organization', name: MARKE.herausgeber },
    publisher: { '@type': 'Organization', name: MARKE.herausgeber },
    isPartOf: { '@type': 'WebSite', name: MARKE.name, url: `${a.basis}/` },
  };
  if (a.ogImage) jsonld.image = a.ogImage;

  const tocNav = mitToc ? `<nav class="toc" aria-label="${esc(t.toc)}"><p class="toc-titel">${esc(t.toc)}</p>${tocListe(a.toc)}</nav>` : '';
  // Breite Fenster: Verzeichnis als Seitenleiste. Schmale: aufklappbar über
  // dem Text, ohne eigenes nav (sonst zwei gleich benannte Landmarken).
  const tocSeite = mitToc ? `<div class="toc-seite">${tocNav}</div>` : '';
  const tocInline = mitToc ? `<div class="toc-inline"><details><summary>${esc(t.toc)}</summary><div class="toc">${tocListe(a.toc)}</div></details></div>` : '';

  const inhalt = `<div class="layout${mitToc ? ' mit-toc' : ''}">
${tocSeite}
<article class="blatt">
  <header class="artikel-kopf">
    <a class="zurueck" href="/ratgeber/"><span aria-hidden="true">←</span> ${esc(t.alle)}</a>
    <h1>${esc(a.meta.title)}</h1>
    <p class="lede">${esc(a.meta.description)}</p>
    <p class="meta"><span>${esc(t.updated)} <time datetime="${esc(a.meta.updated)}">${esc(a.datum)}</time></span><span>${esc(t.minuten(a.minuten))}</span></p>
  </header>
  ${tocInline}
  <div class="prosa">
${a.html}
  </div>
  <aside class="cta" aria-label="${esc(t.ctaTitel)}">
    <div class="cta-text"><p class="cta-titel">${esc(t.ctaTitel)}</p><p>${esc(t.ctaText)}</p></div>
    <a class="btn btn-primaer" href="/demo">${esc(t.demo)}</a>
  </aside>
</article>
</div>`;

  return huelle({
    lang, titel: `${a.meta.title} · ${MARKE.name}`, beschreibung: a.meta.description, canonical: a.canonical,
    ogType: 'article', css: a.css, schrift: a.schrift, jsonld, aktuell: 'ratgeber', inhalt, ogImage: a.ogImage,
    modified: a.meta.updated,
  });
}

/**
 * Übersicht /ratgeber/.
 * @param {{ lang, artikel: {meta, minuten, datum}[], canonical, basis, css, schrift, ogImage }} u
 */
export function uebersichtSeite(u) {
  const t = TEXTE[u.lang] || TEXTE.de;
  const karten = u.artikel.length
    ? `<ul class="karten">${u.artikel.map(a => `
  <li><article class="karte"${a.meta.lang !== u.lang ? ` lang="${a.meta.lang}"` : ''}>
    <h2><a href="/ratgeber/${a.meta.slug}/">${esc(a.meta.title)}</a></h2>
    <p>${esc(a.meta.description)}</p>
    <p class="meta"><time datetime="${esc(a.meta.updated)}">${esc(a.datum)}</time><span>${esc((TEXTE[a.meta.lang] || t).minuten(a.minuten))}</span></p>
  </article></li>`).join('')}
</ul>`
    : `<p class="leer">${esc(t.leer)}</p>`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${t.uebersichtTitel} · ${MARKE.name}`,
    description: t.uebersichtBeschreibung,
    url: u.canonical,
    inLanguage: u.lang,
    hasPart: u.artikel.map(a => ({ '@type': 'Article', headline: a.meta.title, url: `${u.basis}/ratgeber/${a.meta.slug}/`, dateModified: a.meta.updated })),
  };
  const inhalt = `<header class="uebersicht-kopf">
  <h1>${esc(t.uebersichtTitel)}</h1>
  <p class="lede">${esc(t.uebersichtLede)}</p>
</header>
${karten}`;
  return huelle({
    lang: u.lang, titel: `${t.uebersichtTitel} · ${MARKE.name}`, beschreibung: t.uebersichtBeschreibung, canonical: u.canonical,
    ogType: 'website', css: u.css, schrift: u.schrift, jsonld, aktuell: 'ratgeber', inhalt, ogImage: u.ogImage,
  });
}

/** 404 für unbekannte Adressen unter /ratgeber/ (nginx error_page). */
export function nichtGefundenSeite({ lang, css, schrift }) {
  const t = TEXTE[lang] || TEXTE.de;
  const inhalt = `<div class="layout"><div class="blatt">
  <header class="artikel-kopf">
    <h1>${esc(t.nichtGefundenTitel)}</h1>
    <p class="lede">${esc(t.nichtGefundenText)}</p>
    <p><a class="btn btn-primaer" href="/ratgeber/">${esc(t.alle)}</a></p>
  </header>
</div></div>`;
  return huelle({ lang, titel: `${t.nichtGefundenTitel} · ${MARKE.name}`, beschreibung: '', canonical: '', css, schrift, robots: 'noindex', aktuell: 'ratgeber', inhalt });
}
