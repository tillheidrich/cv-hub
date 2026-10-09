/**
 * Bot-Schutz mit ALTCHA (MIT-Lizenz, Proof-of-Work, kein Dienst Dritter).
 *
 * Selbst ausgeliefert: `altcha/external` ist die Fassung ohne eingebettete
 * Worker und Stile; beide kommen als eigene Dateien aus diesem Build
 * (Vite `?worker`), damit die Content-Security-Policy ohne blob: und ohne
 * fremde Quelle auskommt. Geladen wird das Ganze erst, wenn ein Formular mit
 * Bot-Schutz auf dem Bildschirm steht, nicht mit der App.
 *
 * Die Aufgabe holt das Widget von GET /api/altcha/challenge; das Ergebnis
 * (Base64-JSON) geht als `altcha` mit dem Formular an den Server, der es mit
 * ALTCHA_HMAC_KEY prüft.
 */
import { createElement, useEffect, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { billingApi } from './api';

interface AltchaGlobal {
  algorithms: Map<string, () => Worker>;
  i18n: { set: (lang: string, strings: Record<string, string>) => void };
}

/* Eigene Texte statt der mitgelieferten Übersetzungen: kürzer, im Du wie die
 * App, und ohne vier zusätzliche Pakete. Englisch bringt das Widget selbst mit. */
const TEXTS: Record<Exclude<UiLang, 'en'>, Record<string, string>> = {
  de: {
    ariaLinkLabel: 'ALTCHA (Website)', enterCode: 'Code eingeben',
    enterCodeAria: 'Gib den Code ein, den du hörst. Mit der Leertaste startet die Wiedergabe.',
    error: 'Prüfung fehlgeschlagen. Bitte versuch es noch einmal.', expired: 'Prüfung abgelaufen. Bitte noch einmal.',
    footer: 'Geschützt durch <a href="https://altcha.org/" tabindex="-1" target="_blank" rel="noopener" aria-label="ALTCHA (Website)">ALTCHA</a>',
    getAudioChallenge: 'Audio-Aufgabe anfordern', label: 'Ich bin kein Roboter', loading: 'Lädt …',
    reload: 'Neu laden', verify: 'Prüfen', verificationRequired: 'Bitte zuerst prüfen.', verified: 'Geprüft',
    verifying: 'Wird geprüft …', waitAlert: 'Prüfung läuft, bitte warten.', cancel: 'Abbrechen',
    enterCodeFromImage: 'Gib den Code aus dem Bild unten ein.',
  },
  fr: {
    ariaLinkLabel: 'ALTCHA (site web)', enterCode: 'Saisir le code',
    enterCodeAria: 'Saisissez le code que vous entendez. La barre d’espace lance la lecture.',
    error: 'La vérification a échoué. Veuillez réessayer.', expired: 'Vérification expirée. Veuillez réessayer.',
    footer: 'Protégé par <a href="https://altcha.org/" tabindex="-1" target="_blank" rel="noopener" aria-label="ALTCHA (site web)">ALTCHA</a>',
    getAudioChallenge: 'Demander un défi audio', label: 'Je ne suis pas un robot', loading: 'Chargement …',
    reload: 'Recharger', verify: 'Vérifier', verificationRequired: 'Vérification requise.', verified: 'Vérifié',
    verifying: 'Vérification …', waitAlert: 'Vérification en cours, veuillez patienter.', cancel: 'Annuler',
    enterCodeFromImage: 'Saisissez le code de l’image ci-dessous.',
  },
  es: {
    ariaLinkLabel: 'ALTCHA (sitio web)', enterCode: 'Introducir código',
    enterCodeAria: 'Introduce el código que oyes. La barra espaciadora inicia la reproducción.',
    error: 'La comprobación ha fallado. Inténtalo de nuevo.', expired: 'Comprobación caducada. Inténtalo de nuevo.',
    footer: 'Protegido por <a href="https://altcha.org/" tabindex="-1" target="_blank" rel="noopener" aria-label="ALTCHA (sitio web)">ALTCHA</a>',
    getAudioChallenge: 'Pedir un reto de audio', label: 'No soy un robot', loading: 'Cargando …',
    reload: 'Recargar', verify: 'Comprobar', verificationRequired: 'Primero hay que comprobar.', verified: 'Comprobado',
    verifying: 'Comprobando …', waitAlert: 'Comprobación en curso, espera.', cancel: 'Cancelar',
    enterCodeFromImage: 'Introduce el código de la imagen de abajo.',
  },
};

let loading: Promise<void> | null = null;
function loadAltcha(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      const [sha, pbkdf2] = await Promise.all([
        import('altcha/workers/sha?worker'),
        import('altcha/workers/pbkdf2?worker'),
        import('altcha/altcha.css'),
      ]);
      await import('altcha/external');
      const g = (globalThis as unknown as { $altcha?: AltchaGlobal }).$altcha;
      if (!g) throw new Error('altcha missing');
      const Sha = sha.default; const Pb = pbkdf2.default;
      for (const a of ['SHA-256', 'SHA-384', 'SHA-512']) g.algorithms.set(a, () => new Sha());
      for (const a of ['PBKDF2/SHA-256', 'PBKDF2/SHA-384', 'PBKDF2/SHA-512']) g.algorithms.set(a, () => new Pb());
      for (const [l, t] of Object.entries(TEXTS)) g.i18n.set(l, t);
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

export default function AltchaField({ lang, onChange, id }: { lang: UiLang; onChange: (payload: string | null) => void; id?: string }) {
  const ref = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cb = useRef(onChange);
  useEffect(() => { cb.current = onChange; }, [onChange]);

  useEffect(() => {
    let alive = true;
    loadAltcha().then(() => { if (alive) setReady(true); }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ state?: string; payload?: string | null }>).detail || {};
      cb.current(d.state === 'verified' && d.payload ? d.payload : null);
    };
    el.addEventListener('statechange', on);
    return () => el.removeEventListener('statechange', on);
  }, [ready]);

  if (failed) return <p className="bl-hint" role="alert">ALTCHA ?</p>;
  if (!ready) return <div className="bl-altcha-slot" aria-hidden />;
  return (
    <div className="bl-altcha">
      {createElement('altcha-widget', {
        ref, id,
        challenge: billingApi.altchaChallengeUrl(),
        language: lang,
        name: 'altcha',
        style: {
          '--altcha-border-radius': '12px',
          '--altcha-color-primary': 'oklch(0.48 0.224 264)',
          '--altcha-max-width': '100%',
        },
      })}
    </div>
  );
}
