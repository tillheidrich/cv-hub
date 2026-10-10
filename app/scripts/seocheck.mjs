// Prüflauf SEO/GEO für die vorgerenderte Startseite und /preise.
//
//   npm run build && node scripts/seocheck.mjs
//   SEOCHECK_DIST=/pfad/zu/dist  (Standard app/dist)
//   SEOCHECK_SHOTS=/pfad         zusätzlich Bildschirmfotos
//
// Geprüft wird das AUSGELIEFERTE HTML, so wie eine Suchmaschine oder ein
// KI-Crawler es ohne JavaScript bekommt, über den echten nginx mit
// app/nginx.conf (falls installiert, sonst ein kleiner Node-Server):
//   1. /, /en/, /fr/, /es/, /preise: genau eine H1 mit dem Slogan, Titel und
//      Beschreibung in sinnvoller Länge, Canonical aus PUBLIC_BASE_URL,
//      hreflang für alle vier Sprachen plus x-default (gegenseitig),
//      og:image erreichbar (PNG 1200×630), Twitter-Karte
//   2. JSON-LD gültig: Organization, WebSite, SoftwareApplication, FAQPage;
//      jede FAQ-Frage steht sichtbar auf der Seite (und umgekehrt);
//      `offers` NUR bei offenem Verkauf (beide Richtungen: Bau mit offenem
//      und mit geschlossenem Angebot)
//   3. Bilder mit width/height und alt, Hero ohne lazy und mit
//      fetchpriority=high, alle anderen lazy; jede Bildadresse liefert 200
//   4. Interne Links der Startseite: jeder liefert 200 (oder 301)
//   5. sitemap.xml (mit xhtml:link-Alternativen, Magazin), robots.txt
//      (Sitemap-Zeile, kein Disallow: /), llms.txt (Vorlagenzahl aktuell)
//   6. Browser (Chromium, 1440 und 390 px): App übernimmt ohne Sprung
//      (CLS < 0,05), LCP-Element und -Zeit, H1 und Titel unverändert, kein
//      waagerechtes Scrollen, keine Seitenfehler; ohne JavaScript ist der
//      Text sichtbar
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, mkdtempSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

const APP = resolve(process.cwd());
const DIST = resolve(process.env.SEOCHECK_DIST || join(APP, 'dist'));
const PORT = Number(process.env.SEOCHECK_PORT || 5274);
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SEOCHECK_SHOTS || '';
const BASIS = (process.env.PUBLIC_BASE_URL || (await import('../src/landing/brand.js')).FALLBACK_BASE_URL).replace(/\/+$/, '');
const TMP = mkdtempSync(join(tmpdir(), 'seocheck-'));
const LANGS = ['de', 'en', 'fr', 'es'];
const pfad = l => (l === 'de' ? '/' : `/${l}/`);

let fehler = 0, geprueft = 0;
const ok = (c, text, detail) => { geprueft++; if (c) console.log(`  ✓ ${text}`); else { fehler++; console.log(`  ✗ ${text}${detail ? `\n      ${String(detail).split('\n').join('\n      ')}` : ''}`); } };
const abschnitt = t => console.log(`\n── ${t}`);

if (!existsSync(join(DIST, 'index.html')) || !existsSync(join(DIST, 'app.html'))) {
  console.log(`dist/ ohne vorgerenderte Seiten (${DIST}) – erst npm run build`);
  process.exit(1);
}

/* ── Server: echter nginx mit app/nginx.conf, sonst Node ──────────────── */
function nginxConf(root, port) {
  let s = readFileSync(join(APP, 'nginx.conf'), 'utf8')
    // Vorlage wie im Container (nginx-Image, envsubst): ohne Admin-Host.
    .replace(/\$\{ADMIN_HOST\}/g, 'admin.invalid')
    .replace(/listen\s+80;/g, `listen 127.0.0.1:${port};`)
    .replace(/root\s+\/usr\/share\/nginx\/html;/g, `root ${root};`)
    .replace(/^\s*resolver [^;]+;/m, '')
    .replace(/proxy_pass https:\/\/\$umami_host\/[^;]+;/g, 'return 204;')
    .replace(/proxy_pass http:\/\/\$cv_[a-z_]+;/g, 'return 404;');
  const temp = ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map(n => `${n}_temp_path ${join(TMP, n)};`).join('\n  ');
  return `${process.getuid?.() === 0 ? 'user root;' : ''}
worker_processes 1;
daemon off;
pid ${join(TMP, `nginx-${port}.pid`)};
error_log ${join(TMP, 'error.log')} warn;
events { worker_connections 64; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  ${temp}
${s}
}
`;
}

async function starteServer(root, port) {
  if (spawnSync('nginx', ['-v']).status === 0) {
    const conf = join(TMP, `nginx-${port}.conf`);
    writeFileSync(conf, nginxConf(root, port));
    const t = spawnSync('nginx', ['-t', '-c', conf, '-p', TMP], { encoding: 'utf8' });
    if (t.status !== 0) throw new Error(`nginx -t: ${t.stderr}`);
    const p = spawn('nginx', ['-c', conf, '-p', TMP], { stdio: 'ignore' });
    for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/`); return { art: 'nginx', stop: () => p.kill('SIGTERM') }; } catch { await new Promise(r => setTimeout(r, 100)); } }
    throw new Error('nginx startet nicht');
  }
  // Ersatz: grobe Nachbildung der Regeln aus nginx.conf
  const typen = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
  const srv = createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    if (/^\/(en|fr|es)$/.test(u)) { res.writeHead(301, { Location: `${u}/` }); return res.end(); }
    const kandidaten = u === '/' ? ['/index.html'] : u.endsWith('/') ? [`${u}index.html`] : [u, `${u}/index.html`, '/app.html'];
    for (const k of kandidaten) {
      const f = join(root, k);
      if (existsSync(f) && statSync(f).isFile()) { res.writeHead(200, { 'Content-Type': typen[extname(f)] || 'application/octet-stream' }); return res.end(readFileSync(f)); }
    }
    res.writeHead(404); res.end('404');
  });
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  return { art: 'node', stop: () => srv.close() };
}

const holen = async (base, p, opt = {}) => {
  const r = await fetch(`${base}${p}`, { redirect: 'manual', ...opt });
  const buf = Buffer.from(await r.arrayBuffer());
  return { status: r.status, h: k => r.headers.get(k) || '', text: buf.toString('utf8'), buf };
};
const metaContent = (html, attr, name) => (new RegExp(`<meta ${attr}="${name.replace(/[:.]/g, '\\$&')}" content="([^"]*)"`).exec(html) || [])[1] ?? null;
const entities = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
const ldBloecke = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const sichtbarerText = html => entities(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

async function pruefeSeiten(base, opts) {
  for (const l of LANGS) {
    const p = pfad(l);
    const r = await holen(base, p);
    const html = r.text;
    const name = `${p} (${l})`;
    ok(r.status === 200, `${name}: 200`, r.status);
    const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map(m => entities(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
    ok(h1.length === 1 && h1[0].length > 10, `${name}: genau eine H1 im HTML ohne JavaScript („${h1[0] || ''}")`, h1.join(' | '));
    ok(new RegExp(`<html lang="${l}"`).test(html), `${name}: <html lang="${l}">`);
    const title = entities((/<title>([^<]*)<\/title>/.exec(html) || [])[1] || '');
    const desc = entities(metaContent(html, 'name', 'description') || '');
    ok(title.length >= 20 && title.length <= 65, `${name}: <title> ${title.length} Zeichen`, title);
    ok(desc.length >= 70 && desc.length <= 165, `${name}: Beschreibung ${desc.length} Zeichen`, desc);
    const canon = (/<link rel="canonical" href="([^"]+)"/.exec(html) || [])[1];
    ok(canon === `${BASIS}${p}`, `${name}: Canonical ${canon}`, `erwartet ${BASIS}${p}`);
    const alt = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)"/g)].map(m => [m[1], m[2]]));
    ok(LANGS.every(x => alt[x] === `${BASIS}${pfad(x)}`) && alt['x-default'] === `${BASIS}/`, `${name}: hreflang de/en/fr/es + x-default`, JSON.stringify(alt));
    const og = metaContent(html, 'property', 'og:image');
    ok(!!og && og.startsWith(`${BASIS}/`) && metaContent(html, 'name', 'twitter:card') === 'summary_large_image', `${name}: og:image absolut, Twitter-Karte groß`, og);
    if (og) {
      const bild = await holen(base, og.slice(BASIS.length));
      const w = bild.buf.length > 24 ? bild.buf.readUInt32BE(16) : 0, h = bild.buf.length > 24 ? bild.buf.readUInt32BE(20) : 0;
      ok(bild.status === 200 && bild.buf.slice(1, 4).toString() === 'PNG' && w === 1200 && h === 630, `${name}: og:image erreichbar, PNG 1200×630`, `${bild.status} ${w}×${h}`);
    }
    ok(metaContent(html, 'property', 'og:url') === `${BASIS}${p}` && !!metaContent(html, 'property', 'og:title'), `${name}: og:url und og:title`);

    // JSON-LD
    let ld = [];
    try { ld = ldBloecke(html); ok(ld.length === 1, `${name}: ein JSON-LD-Block, gültiges JSON`); } catch (e) { ok(false, `${name}: JSON-LD gültig`, e.message); }
    const graph = ld[0]?.['@graph'] || [];
    const typ = t => graph.find(x => x['@type'] === t);
    ok(['Organization', 'WebSite', 'WebPage', 'SoftwareApplication', 'FAQPage'].every(typ), `${name}: Organization, WebSite, WebPage, SoftwareApplication, FAQPage`, graph.map(x => x['@type']).join(', '));
    const app = typ('SoftwareApplication') || {};
    ok(!!app.name && app.operatingSystem === 'Web' && Array.isArray(app.featureList) && app.featureList.length >= 4, `${name}: SoftwareApplication mit Name, Plattform, Funktionen`);
    ok(opts.offen ? (app.offers?.price && app.offers?.priceCurrency && app.offers?.availability) : !app.offers, `${name}: offers ${opts.offen ? 'vorhanden (Verkauf offen)' : 'fehlt (Verkauf zu)'}`, JSON.stringify(app.offers || null));
    const faq = typ('FAQPage')?.mainEntity || [];
    const text = sichtbarerText(html);
    const sichtbar = [...html.matchAll(/<details class="lp-qa"[\s\S]*?<summary><span>([\s\S]*?)<\/span>/g)].map(m => entities(m[1]).trim());
    ok(faq.length >= 8 && faq.length === sichtbar.length, `${name}: FAQPage mit ${faq.length} Fragen = ${sichtbar.length} sichtbare`);
    ok(faq.every(q => text.includes(q.name) && text.includes(q.acceptedAnswer.text.slice(0, 60))), `${name}: jede FAQ-Antwort steht im sichtbaren Text`, faq.filter(q => !text.includes(q.acceptedAnswer.text.slice(0, 60))).map(q => q.name).join(' | '));
    ok(/application\/json" id="cv-landing-data"/.test(html), `${name}: Datenblock für die Übernahme durch die App`);

    // Bilder
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
    const attr = (tag, a) => (new RegExp(`\\s${a}="([^"]*)"`, 'i').exec(tag) || [])[1];
    ok(imgs.length >= 10 && imgs.every(t => attr(t, 'width') && attr(t, 'height') && attr(t, 'alt') !== undefined), `${name}: ${imgs.length} Bilder, alle mit width/height/alt`);
    const hero = imgs[0] || '';
    ok(attr(hero, 'loading') === 'eager' && attr(hero, 'fetchpriority') === 'high' && (attr(hero, 'alt') || '').length > 20, `${name}: Hero-Bild eager, fetchpriority=high, Alternativtext`);
    ok(imgs.slice(1).every(t => attr(t, 'loading') === 'lazy'), `${name}: alle übrigen Bilder lazy`);
    if (l === 'de') {
      const urls = new Set([...html.matchAll(/(?:src|srcSet|srcset|imagesrcset)="([^"]+)"/g)].flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+/)[0])).filter(u => u.startsWith('/landing/')));
      const kaputt = [];
      for (const u of urls) { const r2 = await holen(base, u); if (r2.status !== 200) kaputt.push(`${u} ${r2.status}`); }
      ok(urls.size > 20 && kaputt.length === 0, `${name}: alle ${urls.size} Bildadressen liefern 200`, kaputt.slice(0, 5).join('\n'));
      const links = new Set([...html.matchAll(/<a\b[^>]*href="(\/[^"#]*)"/g)].map(m => m[1]));
      const tot = [];
      for (const u of links) { const r2 = await holen(base, u); if (![200, 301].includes(r2.status)) tot.push(`${u} ${r2.status}`); }
      ok(links.size >= 10 && tot.length === 0, `${name}: ${links.size} interne Links liefern 200/301`, tot.join('\n'));
      const preload = /<link rel="preload" as="image" type="image\/avif" imagesrcset="[^"]+hero-a-/.test(html) && /<link rel="preload" href="\/assets\/geist-latin-wght-normal-[^"]+\.woff2" as="font"/.test(html);
      ok(preload, `${name}: Preload für Hero-Bild und Geist`);
    }
  }
  // /preise
  const pr = await holen(base, '/preise');
  const h1 = [...pr.text.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
  ok(pr.status === 200 && h1.length === 1, '/preise: vorgerendert mit einer H1', pr.status);
  ok((/<link rel="canonical" href="([^"]+)"/.exec(pr.text) || [])[1] === `${BASIS}/preise`, '/preise: Canonical');
  const prLd = ldBloecke(pr.text)[0]?.['@graph'] || [];
  const prApp = prLd.find(x => x['@type'] === 'SoftwareApplication');
  ok(opts.offen ? !!prApp?.offers : !prApp, `/preise: offers ${opts.offen ? 'vorhanden' : 'fehlen'} im JSON-LD`);
  ok(opts.offen ? /9\s?€|9,00\s?€/.test(sichtbarerText(pr.text)) : true, '/preise: Preis im HTML ohne JavaScript (Verkauf offen)');
}

async function main() {
  console.log(`SEO-Prüflauf · dist ${DIST} · Basis ${BASIS}`);
  const ssr = join(APP, 'node_modules', '.cache', 'landing-ssr', 'ssr.mjs');
  // Zwei Fassungen von dist: Verkauf offen und Verkauf zu (Prüfung in beide Richtungen).
  const fassungen = [];
  for (const [name, offer] of [['offen', { enabled: true, sku: 'pass90', priceCents: 900, currency: 'EUR', days: 90, productName: 'Bewerbungs-Pass', freeTier: { limited: true } }], ['zu', { enabled: false, sku: 'pass90', priceCents: 900, currency: 'EUR', days: 90 }]]) {
    const d = join(TMP, `dist-${name}`);
    cpSync(DIST, d, { recursive: true });
    if (existsSync(ssr)) {
      const r = spawnSync(process.execPath, [join(APP, 'scripts', 'landing-prerender.mjs')], { env: { ...process.env, PRERENDER_OUT_DIR: d, PRERENDER_OFFER_JSON: JSON.stringify(offer), PRERENDER_STRICT: '1', PUBLIC_BASE_URL: BASIS }, encoding: 'utf8' });
      ok(r.status === 0, `Vorrendern mit Verkauf ${name} (Exit 0)`, r.stdout + r.stderr);
    }
    fassungen.push({ name, d, offen: offer.enabled });
  }

  let port = PORT;
  for (const f of fassungen) {
    abschnitt(`1–4 · Ausgeliefertes HTML ohne JavaScript (Verkauf ${f.name})`);
    const srv = await starteServer(f.d, port);
    console.log(`  (Server: ${srv.art})`);
    try { await pruefeSeiten(`http://127.0.0.1:${port}`, { offen: f.offen }); } finally { srv.stop(); }
    port++;
  }

  abschnitt('5 · Sitemap, robots.txt, llms.txt');
  const sm = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  ok(LANGS.every(l => locs.includes(`${BASIS}${pfad(l)}`)) && locs.includes(`${BASIS}/preise`) && locs.includes(`${BASIS}/magazin/`), 'Sitemap: vier Sprachfassungen, /preise, /magazin/', locs.slice(0, 8).join('\n'));
  ok((sm.match(/<xhtml:link rel="alternate" hreflang="x-default"/g) || []).length === 4 && /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(sm), 'Sitemap: hreflang-Alternativen an den Sprachfassungen');
  const artikel = existsSync(join(DIST, 'magazin', 'index.json')) ? JSON.parse(readFileSync(join(DIST, 'magazin', 'index.json'), 'utf8')).articles : [];
  ok(artikel.every(a => locs.includes(`${BASIS}/magazin/${a.slug}/`)), `Sitemap: alle ${artikel.length} Magazin-Artikel`);
  ok(locs.every(u => u.startsWith(`${BASIS}/`)) && new Set(locs).size === locs.length, 'Sitemap: nur eigene Adressen, keine doppelten');
  const rb = readFileSync(join(DIST, 'robots.txt'), 'utf8');
  ok(rb.includes(`Sitemap: ${BASIS}/sitemap.xml`) && !/^Disallow:\s*\/\s*$/m.test(rb) && /Disallow: \/share\//.test(rb), 'robots.txt: Sitemap, nichts Öffentliches gesperrt, /share/ gesperrt');
  ok(!/User-agent:\s*(GPTBot|ClaudeBot|PerplexityBot|Google-Extended)[\s\S]*?Disallow:\s*\/\s*$/im.test(rb), 'robots.txt: KI-Crawler nicht ausgesperrt (sonst keine Zitate in KI-Antworten)');
  const llms = readFileSync(join(DIST, 'llms.txt'), 'utf8');
  const tplZahl = (/(\d+) wählbare Vorlagen/.exec(llms) || [])[1];
  const ssrMod = existsSync(ssr) ? await import(`file://${ssr}`) : null;
  ok(!!tplZahl && (!ssrMod || Number(tplZahl) === ssrMod.SSR_INFO.templates.length), `llms.txt: Vorlagenzahl aus dem Code (${tplZahl})`);
  ok(/\/magazin\//.test(llms) && /AGPL-3\.0/.test(llms) && !/Cloud-Konto nur per Einladungscode|32 Vorlagen/.test(llms), 'llms.txt: Magazin, Lizenz, keine veralteten Angaben');
  ok(!/Canva|Zety|Kickresume|FlowCV|ATS-sicher|ATS-safe/i.test(llms + readFileSync(join(DIST, 'index.html'), 'utf8')), 'keine Konkurrenznamen und keine Siegel in llms.txt und Startseite');
  const css = [...readFileSync(join(DIST, 'index.html'), 'utf8').matchAll(/<link rel="stylesheet"[^>]*href="\/([^"]+\.css)"/g)].map(m => readFileSync(join(DIST, m[1]), 'utf8')).join('\n');
  ok(/font-family:\s*Geist Variable[^}]*font-display:\s*swap|font-display:\s*swap[^}]*font-family:\s*Geist Variable/.test(css.replace(/["']/g, '')), 'Geist mit font-display: swap');

  abschnitt('6 · Browser: Übernahme, CLS, LCP, Breite');
  const srv = await starteServer(fassungen[1].d, port);
  const B = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: EXEC });
  try {
    for (const [w, h, mob] of [[1440, 900, false], [390, 844, true]]) {
      for (const p of ['/', '/en/']) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, locale: 'de-DE' });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
        await page.addInitScript(() => {
          window.__cls = 0; window.__lcp = null;
          new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
          new PerformanceObserver(l => { const e = l.getEntries().at(-1); window.__lcp = { t: Math.round(e.startTime), tag: e.element ? `${e.element.tagName.toLowerCase()}${e.element.className ? '.' + String(e.element.className).split(' ')[0] : ''}` : 'entfernt', url: (e.url || '').replace(/^https?:\/\/[^/]+/, ''), size: e.size }; }).observe({ type: 'largest-contentful-paint', buffered: true });
        });
        const vorher = entities(((await (await fetch(`${B}${p}`)).text()).match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, '') || '').replace(/\s+/g, ' ').trim();
        await page.goto(`${B}${p}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2500);
        const r = await page.evaluate(() => ({ cls: window.__cls, lcp: window.__lcp, pre: !!document.getElementById('prerender'), hidden: document.getElementById('root')?.hidden, h1: document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim(), title: document.title, over: document.documentElement.scrollWidth - innerWidth }));
        const n = `${w}px ${p}`;
        ok(!r.pre && r.hidden === false, `${n}: App hat übernommen (#prerender weg, #root sichtbar)`);
        ok(r.h1 === vorher, `${n}: H1 nach der Übernahme unverändert`, `${vorher} → ${r.h1}`);
        ok(r.cls < 0.05, `${n}: CLS ${r.cls.toFixed(4)} (< 0,05)`);
        ok(!!r.lcp && r.lcp.t < 2500, `${n}: LCP ${r.lcp?.t} ms (${r.lcp?.tag}${r.lcp?.url ? ' ' + r.lcp.url : ''})`, JSON.stringify(r.lcp));
        ok(r.over <= 0, `${n}: kein waagerechtes Scrollen`, r.over);
        ok(errs.length === 0, `${n}: keine Seitenfehler`, errs.join('\n'));
        if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: join(SHOTS, `seo-${w}-${p === '/' ? 'de' : 'en'}.png`) }); }
        await ctx.close();
      }
    }
    const nj = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
    const q = await nj.newPage();
    await q.goto(`${B}/`, { waitUntil: 'load' });
    const sicht = await q.evaluate(() => { const h = document.querySelector('h1'); const r = h?.getBoundingClientRect(); const img = document.querySelector('.lp-show img'); return { h1: !!r && r.height > 0 && r.top < innerHeight, faq: document.querySelectorAll('details.lp-qa').length, img: !!img && img.complete && img.naturalWidth > 0 }; });
    ok(sicht.h1 && sicht.img && sicht.faq >= 8, 'ohne JavaScript: H1 und Hero-Bild sichtbar, FAQ vorhanden', JSON.stringify(sicht));
    await nj.close();
  } finally {
    await browser.close();
    srv.stop();
  }
}

try {
  await main();
} finally {
  rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden${fehler ? `, ${fehler} FEHLGESCHLAGEN` : ''}.`);
process.exit(fehler ? 1 : 0);
