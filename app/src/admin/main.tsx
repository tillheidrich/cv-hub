// Einstieg des Admin-Bereichs (admin.html). Eigenes Bündel ohne Editor,
// ohne Umami, ohne Startseite (Runde 8b, 10.10.2026).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource-variable/geist-mono/wght.css';
import './admin.css';
import AdminApp from './AdminApp';

createRoot(document.getElementById('admin-root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
