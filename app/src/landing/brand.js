// Name und Herausgeber des Produkts: die EINE Stelle für Startseite,
// Magazin, strukturierte Daten, llms.txt und Vorschaubilder. Wird von der App
// (über brand.d.ts typisiert) und von den Bau-Skripten in scripts/ gelesen.
// Beim Bau lassen sich beide Werte überschreiben: VITE_APP_NAME (wie
// src/brand.ts) für App und Bau-Skripte, dazu PUBLIC_SITE_NAME und
// PUBLIC_PUBLISHER für Magazin und strukturierte Daten — ein neuer Name
// braucht keine Code-Änderung.
// Die Domain steht hier bewusst nicht: Sie kommt aus PUBLIC_BASE_URL bzw.
// window.location.origin.
const ENV_NAME =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_NAME) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_APP_NAME) ||
  '';

export const BRAND = {
  /** Wortmarke; „CV-Hub" wird als CV + -Hub gesetzt (Trennung am ersten „/" oder „-"). */
  name: ENV_NAME || 'CV-Hub',
  /** Herausgeber in Artikeln und JSON-LD: der Produktname, kein Personenname. */
  publisher: ENV_NAME || 'CV-Hub',
};

/** Standardadresse, nur als Rückfall für Bau-Skripte ohne PUBLIC_BASE_URL. */
export const FALLBACK_BASE_URL = 'https://cv.example.com';
