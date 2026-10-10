import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { fileURLToPath } from 'node:url'

/* Umami läuft in Produktion über nginx unter /u/ (nginx.conf). Im
 * Entwicklungsserver gibt es diesen Weg nicht; ohne Ersatz fiele /u/script.js
 * auf index.html zurück und der Browser meldete einen Skriptfehler. Hier also
 * ein leeres Skript und ein stilles 204 — gezählt wird lokal nichts. */
function umamiDevStub(): Plugin {
  return {
    name: 'umami-dev-stub',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url === '/u/script.js') { res.setHeader('Content-Type', 'application/javascript'); res.end('/* Umami nur in Produktion */\n'); return }
        if (url === '/u/api/send') { res.statusCode = 204; res.end(); return }
        next()
      })
    },
  }
}

/* Admin-Bereich (Runde 8b, 10.10.2026): eigenes Einstiegs-HTML mit eigenem
 * Bündel, ohne Editor und ohne Umami (admin.html → src/admin/). nginx liefert
 * es auf dem Admin-Host aus (nginx.conf).
 *
 * CV_DEV_API: Nur für lokale Läufe (scripts/admincheck.mjs). Leitet /pdfapi
 * an einen lokalen cv-api weiter, damit Admin-Oberfläche und API wie in der
 * Produktion denselben Ursprung haben — das Admin-Cookie (`__Host-`, Strict)
 * und die Ursprungsprüfung sind sonst nicht echt testbar. */
const DEV_API = process.env.CV_DEV_API

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin.html', import.meta.url)),
      },
    },
  },
  // Dev-Server verhält sich wie nginx in Produktion: Schriften mit CORS
  // ausliefern, damit der Export-/Druckpfad lokal echt testbar ist.
  server: {
    headers: { 'Access-Control-Allow-Origin': '*' },
    /* Nur der Entwicklungsserver: scripts/sectionsroundtrip.mjs lädt den
     * Markdown-Leser des Servers zum Vergleich. Seit Vite 8.3 (npm audit fix,
     * 09.10.2026) liegt alles außerhalb von app/ hinter der Erlaubnisliste;
     * freigegeben wird genau diese eine Datei. */
    fs: { allow: ['.', '../pdf-service/markdown.js'] },
    ...(DEV_API ? {
      proxy: {
        '/pdfapi': { target: DEV_API, changeOrigin: false, rewrite: (p: string) => p.replace(/^\/pdfapi/, '') },
      },
    } : {}),
  },
  plugins: [
    umamiDevStub(),
    react(),
    tailwindcss(),
  ],
})
