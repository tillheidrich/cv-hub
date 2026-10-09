// PDF-Renderer für cv-api — eigene Datei, damit die Härtung prüfbar ist
// (pdf.test.mjs startet ein echtes Chromium gegen einen Kanarienvogel-Server).
//
// Zwei Befunde aus dem Technik-Bericht vom 08.10.2026:
//
// N1 — `<link rel="prefetch">` und `<link rel="prerender">` laufen an
//      `page.route()` vorbei. Die Allowlist in ssrf.js hat diese Anfragen nie
//      gesehen; jeder konnte ohne Konto GET-Anfragen ins Docker-Netz und an
//      169.254.169.254 schicken. Abhilfe auf der Ebene darunter: Chromium
//      löst überhaupt keinen Hostnamen mehr auf — außer den eigenen. Das
//      greift auch für IP-Literale und für jede Anfrageart, die es heute noch
//      nicht gibt. `--disable-features=NoStatePrefetch,…` reicht nachweislich
//      NICHT (Probe pdfprobe3.mjs).
//
// N2 — Keine Grenze für Seitenzahl und Laufzeit. 1 MB HTML mit 30.000
//      Seitenumbrüchen hielt den Dienst über 170 s fest. Jetzt: höchstens
//      MAX_PAGES Seiten, ein Zeitlimit um Laden und Drucken, und vor dem
//      Renderer eine Warteschlange (guards.js, createLimiter).

import { chromium } from 'playwright';
import { isPdfFetchAllowed, isPrivateHost } from './ssrf.js';
import { withTimeout } from './guards.js';

export const MAX_PAGES = 6;
export const RENDER_TIMEOUT_MS = 30_000;

/** Hostnamen, die der Renderer auflösen darf: nur öffentliche, konfigurierte
 *  Namen. Ein privater Name hier würde die Sperre für genau die Anfragen
 *  wieder öffnen, die an der Route vorbeilaufen. */
export function rendererHosts(urls) {
  const out = new Set();
  for (const raw of urls) {
    if (!raw) continue;
    let h;
    try { h = new URL(String(raw).trim()).hostname.toLowerCase(); } catch { continue; }
    if (!h || !/^[a-z0-9.-]+$/.test(h)) continue;     // kein IP-v6-Literal, keine Sonderzeichen
    if (!h.includes('.')) continue;                  // Docker-Dienstnamen (cv-api, postgres)
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) continue;     // IP-Literale nie freigeben
    if (isPrivateHost(h)) continue;
    out.add(h);
  }
  return [...out];
}

/** Chromium-Argumente. `MAP * ~NOTFOUND` lässt jede Namensauflösung
 *  scheitern, `EXCLUDE` nimmt die eigenen Hosts davon aus (Schriften unter
 *  /fonts.css und /fonts/ kommen von dort). */
export function chromiumArgs(hosts) {
  const rules = ['MAP * ~NOTFOUND', ...hosts.map(h => `EXCLUDE ${h}`)].join(', ');
  return ['--no-sandbox', '--disable-dev-shm-usage', `--host-resolver-rules=${rules}`];
}

/**
 * Baut einen Renderer mit eigenem, faul gestartetem Chromium.
 *
 * @param hosts          erlaubte eigene Hostnamen (rendererHosts)
 * @param executablePath optional (Tests, lokale Läufe ohne passenden Playwright-Browser)
 * @param isAllowed      (url) => boolean — Prüfung je Anfrage; Standard ssrf.js
 */
export function createRenderer({ hosts = [], executablePath, isAllowed } = {}) {
  let browserPromise = null;
  const args = chromiumArgs(hosts);

  async function getBrowser() {
    if (browserPromise) {
      try {
        const b = await browserPromise;
        if (b.isConnected()) return b;
      } catch { /* neu starten */ }
    }
    browserPromise = chromium.launch({ args, ...(executablePath ? { executablePath } : {}) });
    return browserPromise;
  }

  /**
   * Rendert HTML zu PDF. Wirft bei Fehler oder Zeitüberschreitung; der
   * Kontext wird in jedem Fall geschlossen.
   */
  async function render(html, { format = 'A4', ownHost = null, timeoutMs = RENDER_TIMEOUT_MS, onBlocked } = {}) {
    const browser = await getBrowser();
    /* Jeder Auftrag in einem eigenen Kontext: Route, abgeschaltetes
     * JavaScript und Zeitlimit können nicht zwischen gleichzeitigen Nutzern
     * durchsickern, und ein abgestürzter Tab nimmt das Chromium nicht mit. */
    const ctx = await browser.newContext({ javaScriptEnabled: false, bypassCSP: false });
    try {
      return await withTimeout((async () => {
        const page = await ctx.newPage();
        await page.route('**', (route) => {
          const url = route.request().url();
          const ok = isAllowed ? isAllowed(url) : isPdfFetchAllowed(url, ownHost);
          if (ok) return route.continue();
          onBlocked?.(url);
          return route.abort();
        });
        await page.emulateMedia({ media: 'print' });
        await page.setContent(html, { waitUntil: 'networkidle', timeout: Math.max(1000, timeoutMs - 5000) });
        await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
        /* `tagged` erzeugt ein PDF mit Strukturbaum: Überschriften, Absätze
         * und Listen stehen als solche in der Datei. Das sucht ein
         * Bewerbungsparser, und das braucht ein Screenreader.
         *
         * `pageRanges` begrenzt die Ausgabe. Ein Lebenslauf mit Anschreiben
         * hat selten mehr als drei Seiten; sechs lassen Luft. Weniger
         * vorhandene Seiten sind kein Fehler. */
        return await page.pdf({
          printBackground: true,
          preferCSSPageSize: true,
          tagged: true,
          format,
          pageRanges: `1-${MAX_PAGES}`,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
      })(), timeoutMs, () => ctx.close().catch(() => {}));
    } finally {
      await ctx.close().catch(() => {});
    }
  }

  async function close() {
    if (!browserPromise) return;
    try { const b = await browserPromise; await b.close(); } catch { /* egal */ }
    browserPromise = null;
  }

  return { render, close, args };
}
