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
export function chromiumArgs(hosts, { sandbox = false } = {}) {
  const rules = ['MAP * ~NOTFOUND', ...hosts.map(h => `EXCLUDE ${h}`)].join(', ');
  return [...(sandbox ? [] : ['--no-sandbox']), '--disable-dev-shm-usage', `--host-resolver-rules=${rules}`];
}

/* N7 (09.10.2026): Chromium läuft mit --no-sandbox.
 *
 * Die Namespace-Sandbox braucht unprivilegierte User-Namespaces. Das
 * Standard-seccomp-Profil von Docker erlaubt sie ohne CAP_SYS_ADMIN nicht,
 * und das Playwright-Image bringt keinen setuid-Helfer mit — in einem
 * Standard-Container startet Chromium mit Sandbox deshalb in aller Regel nicht.
 * Nachgewiesen ist dort nichts; lokal (Nicht-root, Namespaces erlaubt) läuft
 * sie. Darum: PDF_CHROMIUM_SANDBOX=1 schaltet sie ein, und scheitert der
 * Start, fällt der Dienst mit einer deutlichen Warnung auf --no-sandbox
 * zurück, statt keine PDFs mehr zu liefern. Die Abwehr bis dahin: eigener
 * Kontext je Auftrag, kein JavaScript, keine Namensauflösung außer den
 * eigenen Hosts, unprivilegierter Benutzer (pwuser). Siehe SICHERHEIT.md. */
export function sandboxWanted(env = process.env) {
  return /^(1|true|yes|on)$/i.test(String(env.PDF_CHROMIUM_SANDBOX || '').trim());
}

/**
 * Baut einen Renderer mit eigenem, faul gestartetem Chromium.
 *
 * @param hosts          erlaubte eigene Hostnamen (rendererHosts)
 * @param executablePath optional (Tests, lokale Läufe ohne passenden Playwright-Browser)
 * @param isAllowed      (url) => boolean — Prüfung je Anfrage; Standard ssrf.js
 */
export function createRenderer({ hosts = [], executablePath, isAllowed, sandbox = sandboxWanted(), log = console.warn } = {}) {
  let browserPromise = null;
  let useSandbox = !!sandbox;
  let args = chromiumArgs(hosts, { sandbox: useSandbox });

  function launch() {
    // Playwright setzt ohne chromiumSandbox: true selbst --no-sandbox — das Weglassen des Arguments allein reicht nicht.
    return chromium.launch({ args, chromiumSandbox: useSandbox, ...(executablePath ? { executablePath } : {}) });
  }

  async function getBrowser() {
    if (browserPromise) {
      try {
        const b = await browserPromise;
        if (b.isConnected()) return b;
      } catch { /* neu starten */ }
    }
    browserPromise = launch().catch((err) => {
      if (!useSandbox) throw err;
      log(`pdf: Chromium startet nicht mit Sandbox (${String(err?.message || err).split('\n')[0].slice(0, 160)}) — weiter mit --no-sandbox. PDF_CHROMIUM_SANDBOX entfernen oder den Container dafür einrichten (SICHERHEIT.md, N7).`);
      useSandbox = false;
      args = chromiumArgs(hosts, { sandbox: false });
      return launch();
    });
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

  return { render, close, get args() { return args; }, get sandboxActive() { return useSandbox; } };
}
