import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Dev-Server verhält sich wie nginx in Produktion: Schriften mit CORS
  // ausliefern, damit der Export-/Druckpfad lokal echt testbar ist.
  server: { headers: { 'Access-Control-Allow-Origin': '*' } },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
