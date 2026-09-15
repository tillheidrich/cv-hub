/**
 * Tiny i18n for the public surfaces (landing + auth). Detects the browser
 * language at first paint, persists the choice in localStorage so a manual
 * override sticks across reloads. App-chrome translation is a separate
 * (and bigger) task — see task #27.
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

export function setUiLang(lang: UiLang): void {
  try { localStorage.setItem(LS_KEY, lang); } catch { /* ignore */ }
}

// ── Translation map ─────────────────────────────────────────────────────────

export interface UiStrings {
  brand: string;
  nav: { signIn: string };
  hero: {
    overline: string;
    h1Lines: [string, string, string];   // "Ein Lebenslauf,", "der gelesen", "werden möchte."
    h1Italic: string;                     // "gelesen" / "read"
    intro: string;
    ctaPrimary: string;
    ctaSecondary: string;
    aiLabel: string;
    tag: string;
  };
  howItWorks: {
    overline: string;
    facts: { num: string; title: string; body: string }[];
  };
  templates: {
    overline: string;
    h: string;
  };
  editing: {
    overline: string;
    h: string;
    body: string;
  };
  faq: {
    overline: string;
    h: string;
    items: { q: string; a: string }[];
  };
  footer: { built: string; license: string };
  auth: {
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
  };
}

export const T: Record<UiLang, UiStrings> = {
  de: {
    brand: 'HEIDRICH/CV',
    nav: { signIn: 'Anmelden' },
    hero: {
      overline: 'Editorial Lebenslauf-Werkstatt',
      h1Lines: ['Ein Lebenslauf,', 'der', 'werden möchte.'],
      h1Italic: 'gelesen',
      intro: 'Zwanzig Vorlagen im Stil eines Verlags-Spreads. Automatische A4-Anpassung. Markdown-Brücke für KI-Lektorat. Druckfertig in einer Minute.',
      ctaPrimary: 'Direkt ausprobieren',
      ctaSecondary: 'Anmelden',
      aiLabel: 'OHNE KI',
      tag: 'Family & Friends · invite-only',
    },
    howItWorks: {
      overline: 'So funktioniert es',
      facts: [
        { num: 'I', title: 'Inhalt zuerst, Layout später',
          body: 'Du tippst deine Stationen, Bullets, Skills. Vorlage und Schriftpaar wechselst du jederzeit, ohne den Inhalt anzufassen. Das Tool baut den Rest.' },
        { num: 'II', title: 'Auf eine Seite, lesbar',
          body: 'Ein Algorithmus passt die Schriftgröße in mehreren Iterationen an, bis dein Lebenslauf eine Seite füllt. Wird der Inhalt zu lang, springt er automatisch auf zwei Seiten statt zu beschneiden.' },
        { num: 'III', title: 'KI-Lektorat ohne Vendor-Lock',
          body: 'Über einen Sharelink bekommst du deinen Lebenslauf als Markdown. Den lädst du in ChatGPT, Claude oder eine andere KI deiner Wahl. Korrektur kommt zurück, du importierst sie. Eine Diff-Vorschau zeigt vorher, was sich ändert.' },
      ],
    },
    templates: {
      overline: 'Zwanzig Vorlagen, sechs Archetypen',
      h: 'Von klassisch deutsch bis kreativ.',
    },
    editing: {
      overline: 'KI ohne Lock-in',
      h: 'Markdown rein, Markdown raus.',
      body: 'Statt eine KI direkt im Tool zu verbauen, gibt das Tool deinen Lebenslauf als Markdown frei. Du kopierst ihn in deine bevorzugte KI, bekommst eine überarbeitete Fassung zurück und importierst sie hier. Eine Diff-Vorschau zeigt vorher, welche Felder sich ändern. Du behältst die Wahl beim Sprachmodell und unsere Server sehen deinen Inhalt nicht.',
    },
    faq: {
      overline: 'Häufige Fragen',
      h: 'Sieben Antworten.',
      items: [
        { q: 'Was ist CV-Hub?',
          a: 'CV-Hub ist ein selbst gehostetes Tool zum Erstellen von Lebensläufen und Anschreiben. Es erzeugt druckfertige PDFs mit zwanzig editorialen Vorlagen, passt die Schriftgröße automatisch an A4 an und erlaubt KI-Lektorat über eine Markdown-Brücke zu ChatGPT, Claude und ähnlichen Modellen.' },
        { q: 'Brauche ich ein Konto?',
          a: 'Nein. Ein Demo-Modus speichert lokal im Browser und reicht für Lebenslauf, Anschreiben, HTML- und PDF-Export. Sharelinks, Versionshistorie und Cloud-Speicherung kommen mit einem Konto. Registrierung ist nur per Einladungscode möglich.' },
        { q: 'Welche Lebenslauf-Vorlagen sind enthalten?',
          a: 'Zwanzig Vorlagen in sechs Layout-Archetypen: Single-Column, Sidebar links, Sidebar rechts, Header-Band, Top-Centered (klassisch deutsch DIN) und Timeline. Jede Vorlage hat eigene Farben und Schriftpaarungen.' },
        { q: 'Sind die Vorlagen ATS-tauglich?',
          a: 'Die Single-Column-Vorlagen lesen sich für Applicant Tracking Systems wie Workday, Taleo und iCIMS gut, weil sie keine Tabellen, Textboxen oder Sidebars verwenden. Mehrspaltige und Sidebar-Layouts sind für Mensch-zu-Mensch-Bewerbungen gedacht.' },
        { q: 'Wie funktioniert das KI-Lektorat?',
          a: 'Du erzeugst einen Sharelink, hängst .md ans Ende der URL und gibst diese Adresse einem Sprachmodell. Das Modell liest den Lebenslauf als Markdown, schlägt Änderungen vor, gibt eine überarbeitete Markdown-Fassung zurück, die du im Tool importierst. Die Diff-Vorschau zeigt vorher, was sich ändert.' },
        { q: 'Welche Sprachen werden unterstützt?',
          a: 'Lebensläufe und Anschreiben gibt es in vier Sprachen: Deutsch, Englisch, Französisch und Spanisch. Alle vier leben parallel im selben Profil — Sektionsüberschriften, Datums- und Feldbezeichnungen passen sich automatisch an, den Inhalt übersetzt du selbst oder per KI-Markdown-Brücke.' },
        { q: 'Wer hostet die Daten?',
          a: 'Du. Das Projekt läuft auf dem Server des Betreibers (Docker Compose, Postgres-Datenbank). Profile bleiben im Konto des jeweiligen Users, externe KI-Provider sind nicht eingebunden.' },
      ],
    },
    footer: { built: 'HEIDRICH/CV', license: 'OPEN SOURCE · MIT-LICENSED' },
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
    brand: 'HEIDRICH/CV',
    nav: { signIn: 'Sign in' },
    hero: {
      overline: 'Editorial resume workshop',
      h1Lines: ['A resume that', '', 'to be read.'],
      h1Italic: 'wants',
      intro: 'Twenty templates set like editorial spreads. Automatic A4 fitting. Markdown bridge for AI proofreading. Print-ready in a minute.',
      ctaPrimary: 'Try without account',
      ctaSecondary: 'Sign in',
      aiLabel: 'NO BUILT-IN AI',
      tag: 'Friends & family · invite-only',
    },
    howItWorks: {
      overline: 'How it works',
      facts: [
        { num: 'I', title: 'Content first, layout later',
          body: 'You type your jobs, bullets, skills. Switch template and font pairing whenever you want without touching the content. The tool handles the rest.' },
        { num: 'II', title: 'One page, readable',
          body: 'A small algorithm adjusts the font size until your resume fills one page. If the content is genuinely too long, it escalates to two pages instead of clipping.' },
        { num: 'III', title: 'AI without vendor lock-in',
          body: 'Through a sharelink you get your resume as Markdown. Drop that into ChatGPT, Claude, or any model you prefer. Their suggestions come back as Markdown, you import them. A diff preview shows what changes before you commit.' },
      ],
    },
    templates: {
      overline: 'Twenty templates, six archetypes',
      h: 'From classical German DIN to creative.',
    },
    editing: {
      overline: 'AI without lock-in',
      h: 'Markdown in, Markdown out.',
      body: 'Instead of baking an AI into the tool, the tool releases your resume as Markdown. Copy it into the model you prefer, get a revised version back, import it here. A diff preview shows what changes before you commit. You keep the choice of model and our servers never see your content.',
    },
    faq: {
      overline: 'Frequent questions',
      h: 'Seven answers.',
      items: [
        { q: 'What is CV-Hub?',
          a: 'CV-Hub is a self-hosted tool for building resumes and cover letters. It produces print-ready PDFs with twenty editorial templates, fits the font size automatically to A4, and allows AI proofreading through a Markdown bridge to ChatGPT, Claude, and similar models.' },
        { q: 'Do I need an account?',
          a: 'No. A demo mode stores everything in the browser and covers resume, cover letter, HTML and PDF export. Sharelinks, version history, and cloud storage require an account. Registration is invite-only.' },
        { q: 'Which resume templates are included?',
          a: 'Twenty templates across six layout archetypes: single-column, left sidebar, right sidebar, header band, top-centered (classical German DIN), and timeline. Each template has its own colours and font pairings.' },
        { q: 'Are the templates ATS-friendly?',
          a: 'The single-column templates parse well for Applicant Tracking Systems like Workday, Taleo, and iCIMS because they avoid tables, text boxes, and sidebars. Multi-column layouts are intended for human-to-human applications.' },
        { q: 'How does the AI proofreading work?',
          a: 'You create a sharelink, append .md to the URL, and hand that address to a language model. The model reads the resume as Markdown, suggests changes, returns a revised Markdown version, and you import it. The diff preview shows what changes before you commit.' },
        { q: 'Which languages are supported?',
          a: 'Resumes and cover letters exist in four languages: German, English, French, and Spanish. All four live side by side in the same profile — section headings, date and field labels switch automatically, and you translate the content yourself or through the AI Markdown bridge.' },
        { q: 'Who hosts the data?',
          a: 'You do. The project runs on the operator’s own server (Docker Compose, Postgres database). Profiles stay in the owning account, no external AI providers are integrated.' },
      ],
    },
    footer: { built: 'HEIDRICH/CV', license: 'OPEN SOURCE · MIT-LICENSED' },
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
    brand: 'HEIDRICH/CV',
    nav: { signIn: 'Se connecter' },
    hero: {
      overline: 'Atelier éditorial de CV',
      h1Lines: ['Un CV qui', '', 'à être lu.'],
      h1Italic: 'demande',
      intro: "Vingt modèles composés comme des pages de magazine. Ajustement A4 automatique. Passerelle Markdown pour la relecture par IA. Prêt à imprimer en une minute.",
      ctaPrimary: 'Essayer maintenant',
      ctaSecondary: 'Se connecter',
      aiLabel: 'SANS IA',
      tag: 'Family & Friends · invite-only',
    },
    howItWorks: {
      overline: 'Comment ça marche',
      facts: [
        { num: 'I', title: "Le contenu d'abord, la mise en page ensuite",
          body: "Vous saisissez vos expériences, vos puces, vos compétences. Vous changez de modèle et de duo de polices quand vous voulez, sans toucher au contenu. L'outil fait le reste." },
        { num: 'II', title: 'Sur une page, lisible',
          body: "Un algorithme ajuste la taille de la police par itérations jusqu'à ce que votre CV remplisse une page. Si le contenu déborde vraiment, il passe à deux pages plutôt que de couper." },
        { num: 'III', title: 'Relecture par IA sans vendor-lock',
          body: "Un lien de partage vous donne votre CV en Markdown. Vous le déposez dans ChatGPT, Claude ou l'IA de votre choix. La correction revient, vous l'importez. Un aperçu des différences montre à l'avance ce qui change." },
      ],
    },
    templates: {
      overline: 'Vingt modèles, six archétypes',
      h: 'Du classique allemand au créatif.',
    },
    editing: {
      overline: 'IA sans lock-in',
      h: 'Markdown entrant, Markdown sortant.',
      body: "Plutôt que d'enfermer une IA dans l'outil, l'outil libère votre CV en Markdown. Vous le copiez dans l'IA de votre choix, récupérez une version révisée et l'importez ici. Un aperçu des différences montre à l'avance quels champs changent. Vous gardez le choix du modèle et nos serveurs ne voient jamais votre contenu.",
    },
    faq: {
      overline: 'Questions fréquentes',
      h: 'Sept réponses.',
      items: [
        { q: "Qu'est-ce qu'CV-Hub ?",
          a: "CV-Hub est un outil auto-hébergé pour créer CV et lettres de motivation. Il produit des PDF prêts à imprimer avec vingt modèles éditoriaux, ajuste automatiquement la taille de la police à l'A4 et permet la relecture par IA via une passerelle Markdown vers ChatGPT, Claude et des modèles similaires." },
        { q: "Ai-je besoin d'un compte ?",
          a: "Non. Un mode démo enregistre en local dans le navigateur et suffit pour le CV, la lettre, l'export HTML et PDF. Liens de partage, historique des versions et stockage cloud viennent avec un compte. L'inscription se fait uniquement par code d'invitation." },
        { q: 'Quels modèles de CV sont inclus ?',
          a: "Vingt modèles répartis en six archétypes de mise en page : une colonne, sidebar à gauche, sidebar à droite, bandeau d'en-tête, centré en haut (DIN allemande classique) et timeline. Chaque modèle a ses propres couleurs et duos de polices." },
        { q: 'Les modèles sont-ils compatibles ATS ?',
          a: "Les modèles à une colonne se lisent bien pour les Applicant Tracking Systems comme Workday, Taleo et iCIMS, car ils évitent tableaux, zones de texte et sidebars. Les mises en page multicolonnes et à sidebar sont pensées pour les candidatures d'humain à humain." },
        { q: 'Comment fonctionne la relecture par IA ?',
          a: "Vous créez un lien de partage, ajoutez .md à la fin de l'URL et donnez cette adresse à un modèle de langage. Le modèle lit le CV en Markdown, propose des changements, renvoie une version Markdown révisée que vous importez dans l'outil. L'aperçu des différences montre à l'avance ce qui change." },
        { q: 'Quelles langues sont prises en charge ?',
          a: "CV et lettres existent en quatre langues : allemand, anglais, français et espagnol. Les quatre coexistent dans le même profil — titres de sections, dates et libellés de champs s'adaptent automatiquement, le contenu, vous le traduisez vous-même ou via la passerelle Markdown IA." },
        { q: 'Qui héberge les données ?',
          a: "Vous. Le projet tourne sur le serveur de l'exploitant (Docker Compose, base Postgres). Les profils restent dans le compte de chaque utilisateur, aucun fournisseur d'IA externe n'est intégré." },
      ],
    },
    footer: { built: 'HEIDRICH/CV', license: 'OPEN SOURCE · MIT-LICENSED' },
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
    brand: 'HEIDRICH/CV',
    nav: { signIn: 'Iniciar sesión' },
    hero: {
      overline: 'Taller editorial de CV',
      h1Lines: ['Un CV que', '', 'ser leído.'],
      h1Italic: 'pide',
      intro: 'Veinte plantillas compuestas como páginas de revista. Ajuste automático a A4. Puente Markdown para la corrección por IA. Listo para imprimir en un minuto.',
      ctaPrimary: 'Probar ahora',
      ctaSecondary: 'Iniciar sesión',
      aiLabel: 'SIN IA',
      tag: 'Family & Friends · invite-only',
    },
    howItWorks: {
      overline: 'Cómo funciona',
      facts: [
        { num: 'I', title: 'Primero el contenido, luego la maquetación',
          body: 'Escribes tus etapas, viñetas y competencias. Cambias de plantilla y de pareja de fuentes cuando quieras, sin tocar el contenido. La herramienta hace el resto.' },
        { num: 'II', title: 'En una página, legible',
          body: 'Un algoritmo ajusta el tamaño de la fuente en varias iteraciones hasta que tu CV llena una página. Si el contenido es demasiado largo, salta a dos páginas en vez de recortar.' },
        { num: 'III', title: 'Corrección por IA sin vendor-lock',
          body: 'Un enlace para compartir te da tu CV en Markdown. Lo cargas en ChatGPT, Claude o la IA que prefieras. La corrección vuelve, la importas. Una vista de diferencias muestra de antemano qué cambia.' },
      ],
    },
    templates: {
      overline: 'Veinte plantillas, seis arquetipos',
      h: 'De lo clásico alemán a lo creativo.',
    },
    editing: {
      overline: 'IA sin lock-in',
      h: 'Markdown entra, Markdown sale.',
      body: 'En vez de incrustar una IA en la herramienta, la herramienta libera tu CV en Markdown. Lo copias en la IA que prefieras, recibes una versión revisada y la importas aquí. Una vista de diferencias muestra de antemano qué campos cambian. Tú eliges el modelo y nuestros servidores nunca ven tu contenido.',
    },
    faq: {
      overline: 'Preguntas frecuentes',
      h: 'Siete respuestas.',
      items: [
        { q: '¿Qué es CV-Hub?',
          a: 'CV-Hub es una herramienta autoalojada para crear currículums y cartas de presentación. Genera PDF listos para imprimir con veinte plantillas editoriales, ajusta automáticamente el tamaño de la fuente a A4 y permite la corrección por IA mediante un puente Markdown hacia ChatGPT, Claude y modelos similares.' },
        { q: '¿Necesito una cuenta?',
          a: 'No. Un modo demo guarda en local en el navegador y basta para el CV, la carta, la exportación HTML y PDF. Los enlaces para compartir, el historial de versiones y el almacenamiento en la nube vienen con una cuenta. El registro es solo por código de invitación.' },
        { q: '¿Qué plantillas de CV se incluyen?',
          a: 'Veinte plantillas en seis arquetipos de maquetación: una columna, sidebar a la izquierda, sidebar a la derecha, banda de cabecera, centrado superior (DIN alemana clásica) y timeline. Cada plantilla tiene sus propios colores y parejas de fuentes.' },
        { q: '¿Las plantillas son compatibles con ATS?',
          a: 'Las plantillas a una columna se leen bien en los Applicant Tracking Systems como Workday, Taleo e iCIMS, porque evitan tablas, cuadros de texto y sidebars. Las maquetaciones a varias columnas y con sidebar están pensadas para candidaturas de persona a persona.' },
        { q: '¿Cómo funciona la corrección por IA?',
          a: 'Creas un enlace para compartir, añades .md al final de la URL y le das esa dirección a un modelo de lenguaje. El modelo lee el CV en Markdown, propone cambios y devuelve una versión Markdown revisada que importas en la herramienta. La vista de diferencias muestra de antemano qué cambia.' },
        { q: '¿Qué idiomas se admiten?',
          a: 'Los currículums y las cartas existen en cuatro idiomas: alemán, inglés, francés y español. Los cuatro conviven en el mismo perfil: los títulos de sección, las fechas y las etiquetas de campo se adaptan solos; el contenido lo traduces tú o mediante el puente Markdown con IA.' },
        { q: '¿Quién aloja los datos?',
          a: 'Tú. El proyecto corre en el servidor de quien lo opera (Docker Compose, base de datos Postgres). Los perfiles quedan en la cuenta de cada usuario y no hay proveedores de IA externos integrados.' },
      ],
    },
    footer: { built: 'HEIDRICH/CV', license: 'OPEN SOURCE · MIT-LICENSED' },
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
