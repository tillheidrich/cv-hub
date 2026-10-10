// HTML-Gerüst der Magazin-Seiten: Kopf, Fuß, Artikel, Übersicht, Themen, 404.
//
// Reines HTML ohne JavaScript. Das einzige <script> ist JSON-LD (wird nicht
// ausgeführt). Keine style-Attribute: Die CSP für /magazin/ erlaubt nur
// Stylesheets von derselben Herkunft.

import { MARKE, TEXTE, OG_LOCALE, RECHTS_LINKS, KATEGORIEN } from './texte.mjs';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** JSON für <script type="application/ld+json">: "</" und Zeilentrenner
 *  maskieren, damit der Inhalt das Element nie beenden kann. */
export function jsonLd(obj) {
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

export function kategorieName(kat, lang) {
  const t = TEXTE[lang] || TEXTE.de;
  return kat && t.kategorie[kat] ? t.kategorie[kat].name : '';
}

function kopf(t, aktuell) {
  return `<header class="kopf">
  <div class="kopf-inner">
    ${marke(t)}
    <nav class="kopf-nav" aria-label="${esc(t.nav)}">
      <ul>
        <li><a href="/magazin/"${aktuell === 'magazin' ? ' aria-current="page"' : ''}>${esc(t.magazin)}</a></li>
        <li><a href="/#vorlagen">${esc(t.vorlagen)}</a></li>
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
    <span class="fuss-meta">© ${new Date().getFullYear()} ${esc(MARKE.name)}</span>
  </div>
</footer>`;
}

function huelle({ lang, titel, beschreibung, canonical, ogType, css, schrift, jsonld, robots, aktuell, inhalt, ogImage, modified, preload }) {
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
    preload || '',
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
      `<meta name="twitter:title" content="${esc(titel)}">`,
      `<meta name="twitter:description" content="${esc(beschreibung)}">`,
    );
    if (ogImage) meta.push(`<meta property="og:image" content="${esc(ogImage)}">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`, `<meta name="twitter:image" content="${esc(ogImage)}">`);
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

function themaChip(kat, lang, mitLink = true) {
  const name = kategorieName(kat, lang);
  if (!name) return '';
  return mitLink
    ? `<a class="chip" href="/magazin/thema/${kat}/">${esc(name)}</a>`
    : `<span class="chip">${esc(name)}</span>`;
}

/** Brotkrumen sichtbar und als BreadcrumbList. */
function brotkrumen(t, basis, stufen) {
  const html = `<nav class="krumen" aria-label="${esc(t.breadcrumb)}"><ol>${stufen.map((s, i) => i === stufen.length - 1
    ? `<li><span aria-current="page">${esc(s.name)}</span></li>`
    : `<li><a href="${esc(s.pfad)}">${esc(s.name)}</a></li>`).join('')}</ol></nav>`;
  const ld = {
    '@type': 'BreadcrumbList',
    itemListElement: stufen.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, item: `${basis}${s.pfad}` })),
  };
  return { html, ld };
}

/** Aufruf am Artikelende: im Stil der Startseite, mit echtem Bildschirmfoto. */
function aufruf(t, bild) {
  const img = bild
    ? `<picture class="cta-bild">${bild.avif ? `<source type="image/avif" srcset="${esc(bild.avif)}">` : ''}<source type="image/webp" srcset="${esc(bild.webp)}"><img src="${esc(bild.png)}" width="${bild.w}" height="${bild.h}" alt="${esc(t.ctaBild)}" loading="lazy" decoding="async"></picture>`
    : '';
  return `<aside class="cta${bild ? ' cta-mit-bild' : ''}" aria-label="${esc(t.ctaTitel)}">
    <div class="cta-text"><p class="cta-titel">${esc(t.ctaTitel)}</p><p>${esc(t.ctaText)}</p>
    <p class="cta-knopf"><a class="btn btn-primaer" href="/demo">${esc(t.demo)}</a></p></div>
    ${img}
  </aside>`;
}

function karteHtml(a, lang, ueberschrift = 'h2') {
  const t = TEXTE[lang] || TEXTE.de;
  const ta = TEXTE[a.meta.lang] || t;
  return `<li><article class="karte"${a.meta.lang !== lang ? ` lang="${a.meta.lang}"` : ''}>
    ${a.meta.category ? `<p class="karte-thema">${esc(kategorieName(a.meta.category, a.meta.lang))}</p>` : ''}
    <${ueberschrift}><a href="/magazin/${a.meta.slug}/">${esc(a.meta.title)}</a></${ueberschrift}>
    <p>${esc(a.meta.description)}</p>
    <p class="meta"><time datetime="${esc(a.meta.updated)}">${esc(a.datum)}</time><span>${esc(ta.minuten(a.minuten))}</span></p>
  </article></li>`;
}

/**
 * Artikelseite.
 * @param {{ meta, html, toc, minuten, canonical, basis, css, schrift, ogImage, datum, faq, verwandt, bild }} a
 */
export function artikelSeite(a) {
  const lang = a.meta.lang;
  const t = TEXTE[lang] || TEXTE.de;
  const mitToc = a.toc.length > 0;
  const stufen = [
    { name: t.home, pfad: '/' },
    { name: t.magazin, pfad: '/magazin/' },
    ...(a.meta.category ? [{ name: kategorieName(a.meta.category, lang), pfad: `/magazin/thema/${a.meta.category}/` }] : []),
    { name: a.meta.title, pfad: `/magazin/${a.meta.slug}/` },
  ];
  const krumen = brotkrumen(t, a.basis, stufen);
  const herausgeber = { '@type': 'Organization', name: MARKE.herausgeber, url: `${a.basis}/` };
  const artikel = {
    '@type': 'Article',
    headline: a.meta.title,
    description: a.meta.description,
    inLanguage: lang,
    url: a.canonical,
    mainEntityOfPage: { '@type': 'WebPage', '@id': a.canonical },
    datePublished: a.meta.published || a.meta.updated,
    dateModified: a.meta.updated,
    author: herausgeber,
    publisher: herausgeber,
    isPartOf: { '@type': 'WebSite', name: MARKE.name, url: `${a.basis}/` },
  };
  if (a.meta.category) artikel.articleSection = kategorieName(a.meta.category, lang);
  if (a.ogImage) artikel.image = a.ogImage;
  const graph = [artikel, krumen.ld];
  if (a.faq && a.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: a.faq.map(f => ({ '@type': 'Question', name: f.frage, acceptedAnswer: { '@type': 'Answer', text: f.antwort } })),
    });
  }

  const tocNav = mitToc ? `<nav class="toc" aria-label="${esc(t.toc)}"><p class="toc-titel">${esc(t.toc)}</p>${tocListe(a.toc)}</nav>` : '';
  // Breite Fenster: Verzeichnis als Seitenleiste. Schmale: aufklappbar über
  // dem Text, ohne eigenes nav (sonst zwei gleich benannte Landmarken).
  const tocSeite = mitToc ? `<div class="toc-seite">${tocNav}</div>` : '';
  const tocInline = mitToc ? `<div class="toc-inline"><details><summary>${esc(t.toc)}</summary><div class="toc">${tocListe(a.toc)}</div></details></div>` : '';
  const verwandt = a.verwandt && a.verwandt.length
    ? `<section class="verwandt" aria-labelledby="verwandt-h"><h2 id="verwandt-h">${esc(t.verwandt)}</h2><ul class="karten karten-klein">${a.verwandt.map(v => karteHtml(v, lang, 'h3')).join('')}</ul></section>`
    : '';

  const inhalt = `<div class="layout${mitToc ? ' mit-toc' : ''}">
${tocSeite}
<article class="blatt">
  <header class="artikel-kopf">
    ${krumen.html}
    ${a.meta.category ? `<p class="thema-zeile">${themaChip(a.meta.category, lang)}</p>` : ''}
    <h1>${esc(a.meta.title)}</h1>
    <p class="lede">${esc(a.meta.description)}</p>
    <p class="meta"><span>${esc(t.updated)} <time datetime="${esc(a.meta.updated)}">${esc(a.datum)}</time></span><span>${esc(t.minuten(a.minuten))}</span><span>${esc(t.herausgeber(MARKE.herausgeber))}</span></p>
  </header>
  ${tocInline}
  <div class="prosa">
${a.html}
  </div>
  <p class="entstehung">${t.entstehung}</p>
  ${aufruf(t, a.bild)}
</article>
</div>
${verwandt}`;

  return huelle({
    lang, titel: `${a.meta.title} · ${MARKE.name}`, beschreibung: a.meta.description, canonical: a.canonical,
    ogType: 'article', css: a.css, schrift: a.schrift, jsonld: { '@context': 'https://schema.org', '@graph': graph }, aktuell: 'magazin', inhalt, ogImage: a.ogImage,
    modified: a.meta.updated,
  });
}

function themenNav(t, lang, aktiv, vorhanden) {
  const eintraege = [`<li><a href="/magazin/"${!aktiv ? ' aria-current="page"' : ''}>${esc(t.alleThemen)}</a></li>`]
    .concat(KATEGORIEN.filter(k => vorhanden.has(k)).map(k => `<li><a href="/magazin/thema/${k}/"${aktiv === k ? ' aria-current="page"' : ''}>${esc(t.kategorie[k].name)}</a></li>`));
  return `<nav class="themen" aria-label="${esc(t.themen)}"><ul>${eintraege.join('')}</ul></nav>`;
}

/**
 * Übersicht /magazin/ und Themenseiten /magazin/thema/<kat>/.
 * @param {{ lang, artikel: {meta, minuten, datum}[], canonical, basis, css, schrift, ogImage, kategorie?, vorhanden }} u
 */
export function uebersichtSeite(u) {
  const t = TEXTE[u.lang] || TEXTE.de;
  const kat = u.kategorie || '';
  const liste = kat ? u.artikel.filter(a => a.meta.category === kat) : u.artikel;
  const karten = liste.length
    ? `<ul class="karten">${liste.map(a => karteHtml(a, u.lang)).join('')}</ul>`
    : `<p class="leer">${esc(t.leer)}</p>`;
  const name = kat ? t.kategorie[kat].name : t.uebersichtTitel;
  const titel = kat ? `${t.themaTitel(name)} · ${MARKE.name}` : `${t.uebersichtTitel} · ${MARKE.name}`;
  const beschreibung = kat ? t.kategorie[kat].lede : t.uebersichtBeschreibung;
  const stufen = [{ name: t.home, pfad: '/' }, { name: t.magazin, pfad: '/magazin/' }];
  if (kat) stufen.push({ name, pfad: `/magazin/thema/${kat}/` });
  const krumen = brotkrumen(t, u.basis, stufen);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [{
      '@type': 'CollectionPage',
      name: titel,
      description: beschreibung,
      url: u.canonical,
      inLanguage: u.lang,
      publisher: { '@type': 'Organization', name: MARKE.herausgeber, url: `${u.basis}/` },
      hasPart: liste.map(a => ({ '@type': 'Article', headline: a.meta.title, url: `${u.basis}/magazin/${a.meta.slug}/`, dateModified: a.meta.updated })),
    }, krumen.ld],
  };
  const inhalt = `<header class="uebersicht-kopf">
  ${krumen.html}
  <h1>${esc(kat ? name : t.uebersichtH1)}</h1>
  <p class="lede">${esc(kat ? t.kategorie[kat].lede : t.uebersichtLede)}</p>
  ${themenNav(t, u.lang, kat, u.vorhanden)}
</header>
${karten}`;
  return huelle({
    lang: u.lang, titel, beschreibung, canonical: u.canonical,
    ogType: 'website', css: u.css, schrift: u.schrift, jsonld, aktuell: 'magazin', inhalt, ogImage: u.ogImage,
  });
}

/** 404 für unbekannte Adressen unter /magazin/ (nginx error_page). */
export function nichtGefundenSeite({ lang, css, schrift }) {
  const t = TEXTE[lang] || TEXTE.de;
  const inhalt = `<div class="layout"><div class="blatt">
  <header class="artikel-kopf">
    <h1>${esc(t.nichtGefundenTitel)}</h1>
    <p class="lede">${esc(t.nichtGefundenText)}</p>
    <p><a class="btn btn-primaer" href="/magazin/">${esc(t.alle)}</a></p>
  </header>
</div></div>`;
  return huelle({ lang, titel: `${t.nichtGefundenTitel} · ${MARKE.name}`, beschreibung: '', canonical: '', css, schrift, robots: 'noindex', aktuell: 'magazin', inhalt });
}
