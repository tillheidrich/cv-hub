import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

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

export default defineConfig({
  // Dev-Server verhält sich wie nginx in Produktion: Schriften mit CORS
  // ausliefern, damit der Export-/Druckpfad lokal echt testbar ist.
  server: {
    headers: { 'Access-Control-Allow-Origin': '*' },
    /* Nur der Entwicklungsserver: scripts/sectionsroundtrip.mjs lädt den
     * Markdown-Leser des Servers zum Vergleich. Seit Vite 8.3 (npm audit fix,
     * 09.10.2026) liegt alles außerhalb von app/ hinter der Erlaubnisliste;
     * freigegeben wird genau diese eine Datei. */
    fs: { allow: ['.', '../pdf-service/markdown.js'] },
  },
  plugins: [
    umamiDevStub(),
    react(),
    tailwindcss(),
  ],
})
