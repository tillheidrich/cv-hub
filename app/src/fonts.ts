/**
 * Self-hosted Webfonts (via @fontsource) statt Google-Fonts-CDN.
 *
 * DSGVO-Baseline: keine Aufrufe an fonts.googleapis.com /
 * fonts.gstatic.com (Übertragung der Nutzer-IP an Google). Diese Dateien
 * werden mit dem App-Bundle ausgeliefert. Familiennamen entsprechen exakt den
 * bisherigen (Inter, Space Grotesk, …), damit kein CSS angefasst werden muss.
 *
 * Nur die tatsächlich genutzten Schnitte werden geladen.
 */

// Inter — Body/UI (Haupt-Schrift, viele Gewichte)
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

// Space Grotesk — Display (Landing/Auth)
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';

// IBM Plex Mono — Labels/Zahlen
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

// Caveat — Unterschrift unter dem Lebenslauf.
// Deutsche Bewerbungsvorlagen setzen unten „Ort, Datum" und eine Unterschrift.
// Ein eingescannter Schriftzug bräuchte einen Upload-Weg; die Vorlagen aus der
// Sammlung (Henery Webster, Adrian Schreiber) benutzen ohnehin durchweg eine
// Schreibschrift, keinen Scan. Genau das ist hier gebaut — und es wird im
// Werkzeug auch so benannt.
import '@fontsource/caveat/500.css';

// Editor-/Template-Schriften
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

// Vorlagen-Schriftpaare (curated font pairings der 25 Templates)
import '@fontsource/lora/400.css';
import '@fontsource/lora/500.css';
import '@fontsource/lora/600.css';
import '@fontsource/lora/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/500.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import '@fontsource/merriweather/400.css';
import '@fontsource/merriweather/700.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import '@fontsource/source-serif-4/700.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/500.css';
import '@fontsource/ibm-plex-serif/600.css';
import '@fontsource/ibm-plex-serif/700.css';
import '@fontsource/libre-baskerville/400.css';
import '@fontsource/libre-baskerville/700.css';
