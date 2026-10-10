import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
// Oberflächenschrift: Geist (OFL-1.1), selbst ausgeliefert wie alle Schriften
// hier — kein Aufruf an ein fremdes CDN. Nur die Oberfläche benutzt sie; die
// Vorlagen behalten ihre eigenen Schriften (fonts.ts).
import '@fontsource-variable/geist/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './ui/surface.css'
import BillingRoot from './billing/BillingRoot.tsx'
import ShareView from './screens/ShareView.tsx'
import ResetPassword from './screens/ResetPassword.tsx'
import { bootPrerender } from './landing/boot.ts'

const shareMatch = window.location.pathname.match(/^\/share\/([a-zA-Z0-9]+)\/?$/);
const resetMatch = window.location.pathname.match(/^\/reset\/([a-fA-F0-9]+)\/?$/);

// Vorgerenderte Startseite und /preise (scripts/landing-prerender.mjs): Die
// App rendert verdeckt und übernimmt, sobald sie etwas Echtes zeigt.
const rootEl = document.getElementById('root')!
bootPrerender(rootEl)

createRoot(rootEl).render(
  <StrictMode>
    {shareMatch ? <ShareView token={shareMatch[1]} />
      : resetMatch ? <ResetPassword token={resetMatch[1]} />
      : <BillingRoot />}
  </StrictMode>,
)
