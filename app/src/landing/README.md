# Startseite: Aufbau, Vorrendern, Bildschirmfotos

Stand 10.10.2026 (Runde 8). Alles, was die Startseite unter `/`, `/en/`, `/fr/`, `/es/` und das Vorrendern von `/preise` betrifft.

## Dateien

| Datei | Zweck |
|---|---|
| `src/screens/LandingScreen.tsx`, `src/screens/landing.css` | die Startseite (Klassen `lp-`) |
| `copy.ts` | alle Texte in vier Sprachen, `faqItems()` für sichtbare FAQ und JSON-LD |
| `faqFor.ts` | FAQ mit den Werten, die gerade gelten (Vorlagenzahl, Preis, Gratis-Grenze) |
| `HeroShowcase.tsx`, `TextLayer.tsx`, `Gallery.tsx`, `Picture.tsx` | Hero mit Vorlagenwechsel, echte Textebene, Vorlagen-Galerie, `<picture>` mit AVIF/WebP/PNG |
| `useReveal.ts` | Einblenden beim Scrollen (nur Elemente unterhalb des ersten Bildschirms, nur `opacity`/`transform`) |
| `data.ts` | Datenblock der vorgerenderten Seite (Angebot, Magazin-Artikel), sonst `/magazin/index.json` |
| `boot.ts` | Übernahme des vorgerenderten HTML durch die App (aus `main.tsx`) |
| `brand.js` (+ `brand.d.ts`) | Produktname und Herausgeber: **die eine Stelle für einen neuen Namen** |
| `ssr.tsx`, `vite.ssr.config.ts`, `ssr-shims/` | SSR-Bündel für das Vorrendern |
| `shots.gen.ts` | erzeugt von `scripts/landing-shots.mjs`, nicht von Hand ändern |

Die Domain steht nirgends im Code: Bau-Skripte nehmen `PUBLIC_BASE_URL`, die Seite selbst nur relative Pfade.

## Bau

`npm run build` = `tsc -b` → `vite build` → `npm run landing:ssr` (SSR-Bündel nach `node_modules/.cache/landing-ssr/`) → `scripts/magazin-build.mjs` → `scripts/landing-prerender.mjs`.

Das Vorrendern schreibt `dist/index.html` (Deutsch), `dist/en|fr|es/index.html`, `dist/preise/index.html`, `dist/app.html` (Hülle für alle übrigen Pfade, `noindex`), `sitemap.xml` mit hreflang-Alternativen, `robots.txt` und `llms.txt`. Gerendert wird mit `react-dom/server`, ohne Chromium. Das Angebot (Preis, Verkauf offen/zu, Gratis-Grenze) liest es einmal unter `<PUBLIC_BASE_URL>/pdfapi/api/billing/offer`; `offers` im JSON-LD gibt es nur bei offenem Verkauf. **Nach dem Umschalten des Verkaufs am Server das Frontend einmal neu bauen**, sonst steht im vorgerenderten HTML der alte Stand (die laufende Seite lädt das Angebot ohnehin neu).

nginx (`app/nginx.conf`) liefert `/` und `/en/` usw. aus diesen Dateien, `/en` leitet auf `/en/` um, alles andere fällt auf `app.html` zurück.

Sprache: Die Startseite folgt dem **Pfad**, nicht dem Browser, damit Suchmaschinen unter `/` den deutschen Text sehen. Wer eine andere Sprache bevorzugt, bekommt unten einen Hinweis mit Link. Die Oberflächensprache des Editors bleibt, wie sie war, bis jemand auf der Startseite die Sprache wählt.

## Bildschirmfotos neu erzeugen

Wenn sich Oberfläche, Demo-Person oder Vorlagen ändern:

```
cd app
npx vite --port 5261 --strictPort &                  # Entwicklungsserver
LANDING_BASE=http://127.0.0.1:5261 npm run landing:shots
```

Dauer etwa zehn Minuten (vier Sprachen, Miniaturen aller Vorlagen auf Deutsch und Englisch). Teil-Läufe: `LANDING_LANGS=de` oder `LANDING_ONLY=ui|thumbs|text|og`. Braucht Python 3 mit Pillow ab Version 11 (`python3 -m pip install pillow`, kodiert AVIF/WebP/PNG) und `pdftotext` (Poppler). Ergebnis: `public/landing/` (Dateien plus `manifest.json`), `public/og*.png`, `src/landing/shots.gen.ts`. Danach ansehen und committen.

Die Textebene im Abschnitt „So liest ein ATS" ist echt: Das Skript druckt den Demo-Lebenslauf in der Vorlage Hamburg wie der PDF-Dienst und liest die erste Seite zweimal mit `pdftotext` aus (`-raw` und nach Lage).

## Prüfen

- `node scripts/seocheck.mjs` (nach `npm run build`): ausgeliefertes HTML ohne JavaScript, JSON-LD, Canonical, hreflang, og:image, Bilder, interne Links, Sitemap, robots.txt, llms.txt, Übernahme im Browser mit CLS und LCP
- `node scripts/nginxcheck.mjs`: Auslieferung inklusive der neuen Pfade
- `node scripts/magazincheck.mjs`: Magazin
- Startseite außerdem in `axecheck`, `langcheck`, `mobilecheck`, `headercheck`, `contrastcheck`, `billingcheck` (Entwicklungsserver, `HARNESS_BASE`)
