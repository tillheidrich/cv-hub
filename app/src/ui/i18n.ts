/**
 * Interface language: detection, storage, notification.
 *
 * The browser language is detected on first paint; an explicit choice lives in
 * localStorage and survives a reload. `setUiLang` also announces the change as
 * an event so that open panels switch immediately.
 *
 * This file's header used to say that translating the app chrome was "a
 * separate (and bigger) task". It was, and it was done on 2026-09-18 —
 * together with the switch that made it visible in the first place. Inside the
 * editor the language could not be changed, which is why nobody noticed for
 * years that export, history, the ATS check and the account panel had no
 * translation at all.
 */

export type UiLang = 'de' | 'en' | 'fr' | 'es';

const LS_KEY = 'appstudio-ui-lang';
const UI_LANGS: UiLang[] = ['de', 'en', 'fr', 'es'];

export function detectInitialUiLang(): UiLang {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored && (UI_LANGS as string[]).includes(stored)) return stored as UiLang;
  } catch { /* ignore */ }
  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of langs) {
      const tag = (l || '').toLowerCase();
      for (const cand of UI_LANGS) {
        if (tag.startsWith(cand)) return cand;
      }
    }
  }
  return 'en';
}

/** Event used to announce a language change to open panels. */
export const UI_LANG_EVENT = 'cv:ui-lang';

export function setUiLang(lang: UiLang): void {
  try { localStorage.setItem(LS_KEY, lang); } catch { /* ignore */ }
  // Without this, only what happens to re-render switches over — an open
  // export or account panel would stay in the previous language.
  try { window.dispatchEvent(new Event(UI_LANG_EVENT)); } catch { /* ignore */ }
}

// ── Sign-in copy ────────────────────────────────────────────────────────────
//
// A complete landing-page translation used to live here. Nothing read it any
// more: the landing page got its own COPY table, and this one stayed behind as
// dead weight — claiming "twenty templates" (there are 26) and "MIT-LICENSED"
// (the project is AGPL-3.0). Both wrong, both invisible, both a trap for the
// next person who wires it back up. What remains is what actually renders.

export interface AuthStrings {
  welcomeBack: string;
  createAccount: string;
  description: { login: string; register: string };
  username: string;
  password: string;
  inviteCode: string;
  submit: { login: string; register: string };
  busy: string;
  swap: { toRegister: string; toLogin: string };
  demoOverline: string;
  demoButton: string;
  demoCaption: string;
}

export const T: Record<UiLang, { auth: AuthStrings }> = {
  de: {
    auth: {
      welcomeBack: 'Willkommen zurück.',
      createAccount: 'Leg dein Konto an.',
      description: {
        login: 'Editorial-Lebenslauf-Werkstatt. Schreib, drucke, teile. Gib einer KI Markdown, wenn du Lektorat brauchst.',
        register: 'Registrierung nur mit Einladungscode. Wer dir den Link geschickt hat, hat einen für dich.',
      },
      username: 'Nutzername',
      password: 'Passwort',
      inviteCode: 'Einladungscode',
      submit: { login: 'Anmelden', register: 'Konto erstellen' },
      busy: 'Moment',
      swap: { toRegister: 'Mit Code registrieren →', toLogin: '← Zur Anmeldung' },
      demoOverline: 'Ohne Konto',
      demoButton: 'Direkt ausprobieren',
      demoCaption: 'Lokales Demo-Profil im Browser. Speichern, Sharen und alle Konto-Features brauchen eine Anmeldung.',
    },
  },
  en: {
    auth: {
      welcomeBack: 'Welcome back.',
      createAccount: 'Create your account.',
      description: {
        login: 'Editorial resume workshop. Write, print, share. Hand the Markdown to an AI when you want proofreading.',
        register: 'Registration is invite-only. Whoever shared the link has a code for you.',
      },
      username: 'Username',
      password: 'Password',
      inviteCode: 'Invite code',
      submit: { login: 'Sign in', register: 'Create account' },
      busy: 'Working',
      swap: { toRegister: 'Register with code →', toLogin: '← Back to sign in' },
      demoOverline: 'No account',
      demoButton: 'Try without account',
      demoCaption: 'Demo profile stored locally in your browser. Saving, sharing, and every other account-bound feature requires sign-in.',
    },
  },
  fr: {
    auth: {
      welcomeBack: 'Content de vous revoir.',
      createAccount: 'Créez votre compte.',
      description: {
        login: "Atelier éditorial de CV. Écrivez, imprimez, partagez. Donnez le Markdown à une IA quand vous voulez une relecture.",
        register: "Inscription uniquement par code d'invitation. Celui qui vous a envoyé le lien en a un pour vous.",
      },
      username: "Nom d'utilisateur",
      password: 'Mot de passe',
      inviteCode: "Code d'invitation",
      submit: { login: 'Se connecter', register: 'Créer un compte' },
      busy: 'Un instant',
      swap: { toRegister: "S'inscrire avec un code →", toLogin: '← Retour à la connexion' },
      demoOverline: 'Sans compte',
      demoButton: 'Essayer maintenant',
      demoCaption: 'Profil de démo local dans le navigateur. Enregistrer, partager et toutes les fonctions de compte demandent une connexion.',
    },
  },
  es: {
    auth: {
      welcomeBack: 'Bienvenido de nuevo.',
      createAccount: 'Crea tu cuenta.',
      description: {
        login: 'Taller editorial de CV. Escribe, imprime, comparte. Dale el Markdown a una IA cuando quieras una corrección.',
        register: 'Registro solo con código de invitación. Quien te envió el enlace tiene uno para ti.',
      },
      username: 'Nombre de usuario',
      password: 'Contraseña',
      inviteCode: 'Código de invitación',
      submit: { login: 'Iniciar sesión', register: 'Crear cuenta' },
      busy: 'Un momento',
      swap: { toRegister: 'Registrarse con código →', toLogin: '← Volver a iniciar sesión' },
      demoOverline: 'Sin cuenta',
      demoButton: 'Probar ahora',
      demoCaption: 'Perfil de demo local en el navegador. Guardar, compartir y todas las funciones de cuenta requieren iniciar sesión.',
    },
  },
};
