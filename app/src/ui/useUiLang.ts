/**
 * Die Sprache der Oberfläche, für Bereiche, die sie nicht als Prop bekommen.
 *
 * Hintergrund: Die Oberflächensprache lag bisher als Zustand in `App` und wurde
 * durchgereicht — an Landing, Anmeldung und Editor-Chrome. Alles andere
 * (Export, Verlauf, ATS-Prüfung, Konto …) war schlicht auf Deutsch geschrieben
 * und bekam die Sprache nie zu sehen. Diese Bereiche jetzt einzeln
 * durchzureichen hieße, ein Dutzend Signaturen anzufassen, nur damit ein Wert
 * ankommt, der sich pro Sitzung ein- oder zweimal ändert.
 *
 * Deshalb hier: eine Quelle, aus der jeder Bereich selbst liest. `setUiLang`
 * meldet die Änderung über ein Ereignis, damit offene Panels sofort umschalten
 * und nicht erst beim nächsten Öffnen.
 */
import { useEffect, useState } from 'react';
import { detectInitialUiLang, UI_LANG_EVENT, type UiLang } from './i18n';

export function useUiLang(): UiLang {
  const [lang, setLang] = useState<UiLang>(() => detectInitialUiLang());
  useEffect(() => {
    const onChange = () => setLang(detectInitialUiLang());
    window.addEventListener(UI_LANG_EVENT, onChange);
    // Zweites Fenster, gleiche Herkunft: localStorage meldet sich von selbst.
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(UI_LANG_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return lang;
}
