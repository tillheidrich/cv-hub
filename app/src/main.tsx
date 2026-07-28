import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './index.css'
import App from './App.tsx'
import ShareView from './screens/ShareView.tsx'
import ResetPassword from './screens/ResetPassword.tsx'

const shareMatch = window.location.pathname.match(/^\/share\/([a-zA-Z0-9]+)\/?$/);
const resetMatch = window.location.pathname.match(/^\/reset\/([a-fA-F0-9]+)\/?$/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shareMatch ? <ShareView token={shareMatch[1]} />
      : resetMatch ? <ResetPassword token={resetMatch[1]} />
      : <App />}
  </StrictMode>,
)
