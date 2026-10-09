import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { APP_NAME } from './brand';
import { Icon } from './ui/Icon';
import ResumeRenderer, { type InlineEditApi } from './templates/ResumeRenderer';
import { applyInlineEdit, applyCoverLetterEdit, isCoverLetterPath, insertAfter, removeAt } from './data/inlineEdit';
import CoverLetterRenderer from './templates/CoverLetterRenderer';
import DocumentPreview, { type FitInfo } from './preview/DocumentPreview';
import { contentKeyOf } from './preview/contentKey';
import Canvas, { type Zoom } from './preview/Canvas';
import MobilePreview from './preview/MobilePreview';
import { CarouselBar, CarouselNeighbours } from './preview/TemplateCarousel';
import { useSettled, useTemplateNav } from './preview/carouselNav';
import { metricsFor, type Metrics } from './templates/metrics';
import { PICKABLE_THEMES, ACCENTS, getTheme, resolvePairing, resolveThemeId } from './templates/theme';
import EditorPanel from './editor/EditorPanel';
import CoverLetterEditor from './editor/CoverLetterEditor';
import ExportPanel from './export/ExportPanel';
import { exportDocx } from './export/exportDocx';
import { exportPdf, type ExportRenderConfig } from './export/exportHtml';
import { AtsPdfRunner, type AtsPdfJob } from './export/AtsPdfRunner';
import { atsPdfTemplateFor } from './export/atsPdfTemplate';
import HomeScreen from './screens/HomeScreen';
import KnowledgePanel from './knowledge/KnowledgePanel';
import AuthScreen from './screens/AuthScreen';
import LandingScreen from './screens/LandingScreen';
import { ImpressumPage, PrivacyPage } from './screens/LegalPages';
import { atsLevelForLayout } from './templates/atsScore';
import { detectInitialUiLang, setUiLang, type UiLang } from './ui/i18n';
import { ET } from './ui/editorI18n';
import { DESIGN_I18N } from './ui/i18n/design';
import { LOCAL_I18N } from './ui/i18n/local';
import { ZUGANG_I18N, formatAccessDate } from './ui/i18n/zugang';
import { FASSUNG_I18N } from './ui/i18n/fassung';
import DesignPanel from './ui/DesignPanel';
import CheckPanel from './ui/CheckPanel';
import ExportMenu from './ui/ExportMenu';
import { Menu, MenuItem, MobileSheet } from './ui/Overlay';
import BackupReminder, { LocalBackupPanel } from './ui/BackupReminder';
import AdminPanel from './screens/AdminPanel';
import KeysPanel from './screens/KeysPanel';
import VersionsPanel from './screens/VersionsPanel';
import UnlockPanel from './billing/UnlockPanel';
import { PassDialog } from './billing/PassSection';
import { ConfirmEmailBanner } from './billing/ConfirmEmail';
import { useOffer, salesOpen } from './billing/hooks';
import { PATHS, navigate } from './billing/route';
import { freeOnly, priceOf } from './billing/format';
import { hasPendingCode } from './billing/pendingCode';
import { PLAN_EVENT } from './billing/planEvents';
import { GUTSCHEIN_I18N } from './ui/i18n/gutschein';
import { cancelUi } from './billing/legalTexts';
import { BILLING_I18N, type UnlockKey } from './ui/i18n/billing';
import { api, ApiError, photoIdOf } from './data/api';
import type { AuthUser } from './data/api';
import { track } from './data/track';
import {
  getActiveProfileId, setActiveProfileId,
  updateProfileInList, deleteProfileFromList,
  saveProfiles as saveProfilesLocal, loadProfiles as loadProfilesLocal,
  loadProfilesAsync as loadProfilesLocalAsync,
  saveProfilesAsync as saveProfilesLocalAsync, clearLocalStore,
  createDemoProfile, duplicateProfile, withAllLangs, carryContactToLang,
} from './data/storage';
import { useIsMobile } from './ui/useIsMobile';
import { ALL_LANGS, LANG_NAMES } from './data/labels';
import type { CVData, CoverLetterData, AppProfile, Lang, FontPairingId, PageMode, SectionKey, PageFormat, AccentId, PaperId } from './data/types';
import { DEFAULT_SECTION_ORDER } from './data/types';

/** Paneele der Oberfläche: Schiene am Schreibtisch, untere Leiste am Telefon. */
type PanelId = 'content' | 'design' | 'check' | 'tips' | 'export';
type DocType = 'resume' | 'cover-letter';
type Screen = 'home' | 'editor' | 'impressum' | 'privacy';

const UI_FONT = "'Inter', sans-serif";
/** Letzte Paneelwahl je Gerät. */
const PANEL_KEY = 'cv-ui-panel';
/** „Text direkt anklicken" einmal weggeklickt — bleibt weg. */
const HINT_KEY = 'cv-ui-write-hint-gone';
/** Reihenfolge der Oberflächensprachen — dieselbe wie auf Landing und Anmeldung. */
const LANG_ORDER: UiLang[] = ['de', 'en', 'fr', 'es'];

/** Kennung für eine verdoppelte Station. */
function newEntryId(): string {
  try {
    const b = new Uint32Array(2);
    crypto.getRandomValues(b);
    return b[0].toString(36) + b[1].toString(36);
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

const EMPTY_CV: CVData = {
  personal: { name: '', title: '', location: '', email: '', phone: '' },
  profile: { text: '' },
  experience: [],
  education: [],
  skillGroups: [],
  languages: [],
  labels: {
    lang: 'de',
    sections: { personal: '', details: '', profile: '', experience: '', education: '', languages: '', additional: '' },
    fields: { email: '', phone: '', address: '', web: '', linkedin: '', birthDate: '', birthPlace: '', maritalStatus: '', nationality: '', driversLicense: '' },
    misc: { present: '', cvLabel: '' },
  },
};

const EMPTY_COVER_LETTER: CoverLetterData = {
  company: '',
  contactPerson: '',
  companyAddress: '',
  city: '',
  date: '',
  subject: '',
  salutation: '',
  intro: '',
  mainBody: '',
  companyReference: '',
  motivation: '',
  closing: '',
  signoff: '',
};



export default function App() {
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [dataLoaded, setDataLoaded] = useState(false);

  const activeProfile = profiles.find(p => p.id === activeId) ?? null;

  /** Offenes Paneel am Schreibtisch (null = nur Leinwand) und auf dem
   *  Telefon (null = das Dokument). Getrennt, weil das Telefon immer im
   *  Dokument startet, der Schreibtisch mit einem Paneel. */
  const [panel, setPanelState] = useState<PanelId | null>(null);
  const [mPanel, setMPanel] = useState<PanelId | null>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  /** Anstoß für den Übergang beim Vorlagenwechsel. */
  const [swap, setSwap] = useState<{ key: string; dir: -1 | 0 | 1 }>({ key: '', dir: 0 });
  /** „Vorlage gewechselt · Rückgängig", „Station gelöscht · Rückgängig". */
  const [toast, setToast] = useState<{ text: string; undo: () => void } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const [hintGone, setHintGone] = useState<boolean>(() => {
    try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; }
  });
  const [backupOpen, setBackupOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [docType, setDocType] = useState<DocType>('resume');
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [printing, setPrinting] = useState(false);
  const [fit, setFit] = useState<FitInfo | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Demo mode = no server, localStorage-only. Activated from AuthScreen by
  // "Direkt ausprobieren" and persisted across reloads so refresh doesn't
  // bounce the user back to auth.
  /** Einladungscode aus der URL (?invite=CODE). Öffnet direkt die
   *  Registrierung mit vorausgefülltem Code. Einmal beim Mount gelesen. */
  const initialInvite = useMemo(() => {
    try { return (new URLSearchParams(window.location.search).get('invite') || '').trim(); }
    catch { return ''; }
  }, []);
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    try {
      // Ein Invite-Link hat Vorrang vor einer gespeicherten Demo-Session,
      // sonst landet der Eingeladene auf der Demo statt in der Registrierung.
      if (new URLSearchParams(window.location.search).get('invite')) return false;
      return localStorage.getItem('appstudio-demo-mode') === '1';
    } catch { return false; }
  });
  /** Freischalt-Moment (billing/UnlockPanel.tsx): welche Funktion gerade
   *  einen Pass bräuchte. Ersetzt die frühere „Demo-Limit"-Wand. */
  const [unlock, setUnlock] = useState<UnlockKey | null>(null);
  const [passOpen, setPassOpen] = useState(false);
  const { offer } = useOffer();
  /** Direktlink in die Demo (/?demo=1, /demo) und auf „Mein Pass" (/?pass=1). */
  const initialFlags = useMemo(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      return { demo: q.get('demo') === '1' || /^\/demo\/?$/.test(window.location.pathname), pass: q.get('pass') === '1' };
    } catch { return { demo: false, pass: false }; }
  }, []);
  /** When true, render AuthScreen instead of LandingScreen. Toggled by the
   *  "Anmelden" button on the landing page — or automatisch bei ?invite=. */
  const [showAuth, setShowAuth] = useState(!!initialInvite);
  const [uiLang, setUiLangState] = useState<UiLang>(() => detectInitialUiLang());
  function handleLangChange(l: UiLang) { setUiLang(l); setUiLangState(l); }
  const [adminOpen, setAdminOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  /** Rückfrage beim Abmelden: Zahl der lokalen Profile in diesem Browser. */
  const [logoutAsk, setLogoutAsk] = useState<number | null>(null);
  const [logoutWipe, setLogoutWipe] = useState(false);
  /** Ein Schreibweg hat mit `access_expired` geantwortet, obwohl /api/me beim
   *  Laden noch keinen Ablauf kannte (Ablauf während der Sitzung). */
  const [accessExpiredHit, setAccessExpiredHit] = useState(false);
  /** Ausgeblendetes Laufzeit-Band (je Hinweisstufe, nur für diese Sitzung). */
  const [accessHidden, setAccessHidden] = useState<string | null>(() => {
    try { return sessionStorage.getItem('cv-access-hidden'); } catch { return null; }
  });
  /** Kurze Meldung ohne Rückgängig (ATS-PDF fertig, Kopie angelegt …). */
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const [atsJob, setAtsJob] = useState<AtsPdfJob | null>(null);
  const atsBusy = useRef(false);
  const isMobile = useIsMobile();

  /* Click-on-preview-jumps-to-editor: when the user clicks a section in the
     rendered CV, DocumentPreview hands us the matching editor tab. We track
     it as a tick (counter) so the EditorPanel's useEffect re-runs even if
     the same tab is requested twice in a row. */
  const [editJumpTab, setEditJumpTab] = useState<import('./preview/DocumentPreview').EditorTab | null>(null);
  const [editJumpTick, setEditJumpTick] = useState(0);
  const handlePreviewEdit = useCallback((tab: import('./preview/DocumentPreview').EditorTab) => {
    setEditJumpTab(tab);
    setEditJumpTick(t => t + 1);
    // Der Sprung landet im Inhalt-Paneel — am Schreibtisch wie auf dem Telefon.
    if (isMobile) setMPanel('content');
    else setPanelState('content');
  }, [isMobile]);

  /** Paneel wählen und die Wahl je Gerät merken (nur Inhalt/Gestaltung/
   *  Prüfen/Tipps — das Export-Paneel öffnet man gezielt). */
  const setPanel = useCallback((p: PanelId | null) => {
    setPanelState(p);
    if (p && p !== 'export') { try { localStorage.setItem(PANEL_KEY, p); } catch { /* ignore */ } }
  }, []);
  /** Startzustand beim Öffnen eines Profils (Gestaltungsbericht, Bau-Liste 2):
   *  Demo und neues Profil öffnen „Gestaltung", ein bestehendes Profil die
   *  letzte Wahl auf diesem Gerät, sonst „Inhalt". Das Telefon startet immer
   *  im Dokument. */
  function openEditorPanels(kind: 'new' | 'existing') {
    setMPanel(null);
    setZoom('fit');
    if (kind === 'new') { setPanelState('design'); return; }
    let remembered: PanelId | null = null;
    try { remembered = localStorage.getItem(PANEL_KEY) as PanelId | null; } catch { /* ignore */ }
    setPanelState(remembered && (['content', 'design', 'check', 'tips'] as string[]).includes(remembered) ? remembered : 'content');
  }
  const showToast = useCallback((text: string, undo: () => void) => {
    window.clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = window.setTimeout(() => setToast(null), 7000);
  }, []);

  useEffect(() => {
    api.me().then(d => setAuthUser(d.user)).catch(() => setAuthUser(null)).finally(() => setAuthLoading(false));
  }, []);

  /* Gutschein in „Mein Pass" eingelöst (billing/planEvents.ts): Plan sofort
   * neu holen, damit Bänder und Nur-Lese-Modus ohne Neuanmeldung stimmen. */
  useEffect(() => {
    const on = () => {
      setAccessExpiredHit(false);
      api.me().then(d => setAuthUser(d.user)).catch(() => {});
    };
    window.addEventListener(PLAN_EVENT, on);
    return () => window.removeEventListener(PLAN_EVENT, on);
  }, []);

  /** Anmeldung oder Registrierung über die Startseite. Liegt ein gemerkter
   *  Zugangscode bereit (Seite /code), geht es dorthin zurück — der Code muss
   *  nicht noch einmal eingetippt werden. */
  const handleAuth = useCallback((u: AuthUser) => {
    setAuthUser(u);
    if (hasPendingCode()) navigate(PATHS.code);
  }, []);

  /* Rücksprung nach dem Anmelden.
   *
   * Wer einen KI-Client verbindet, landet zuerst auf der Zustimmungsseite des
   * Anmeldedienstes. Ist er dort nicht angemeldet, schickt ihn der Server
   * hierher — mit ?next=… im Gepäck. Sobald die Anmeldung steht, geht es
   * genau dorthin zurück, sonst müsste der Mensch den Verbindungsvorgang von
   * vorn beginnen und wüsste nicht, warum.
   *
   * Streng geprüft: nur relative Pfade in den OAuth-Bereich. Eine absolute
   * Adresse von außen wäre ein offener Weiterleiter — der klassische Weg,
   * jemandem eine echte Anmeldeseite zu zeigen und ihn danach woanders
   * abzuliefern. */
  useEffect(() => {
    if (!authUser) return;
    const next = new URLSearchParams(window.location.search).get('next');
    // Erlaubt sind nur relative Pfade in den OAuth-Bereich — direkt unter
    // /oauth/ oder, wenn die API hinter einem Pfadpräfix hängt, darunter.
    if (!next || !/^\/(?:[A-Za-z0-9_-]+\/)*oauth\/[A-Za-z0-9_-]+(\?[^#]*)?$/.test(next)) return;
    window.location.replace(next);
  }, [authUser]);

  // ?invite=CODE aus der Adresszeile entfernen, nachdem er gelesen wurde —
  // ein Reload soll dann nicht erneut die Registrierung erzwingen und der
  // Code bleibt nicht sichtbar in der URL stehen.
  useEffect(() => {
    if (!initialInvite) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('invite');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    } catch { /* ignore */ }
  }, [initialInvite]);

  /* /?demo=1 startet die Demo direkt (Marketing-Bericht, Bau-Liste P2): Ein
   * Link aus einem Beitrag soll ohne Umweg über die Startseite ins Werkzeug
   * führen. Danach verschwindet der Parameter aus der Adresszeile. */
  const flagsDone = useRef(false);
  useEffect(() => {
    if (authLoading || flagsDone.current) return;
    flagsDone.current = true;
    if (initialFlags.demo && !authUser && !demoMode) void startDemo();
    if (initialFlags.pass && authUser) queueMicrotask(() => setPassOpen(true));
    if (initialFlags.demo || initialFlags.pass) {
      try { window.history.replaceState({}, '', '/'); } catch { /* ignore */ }
    }
    // startDemo ist eine Funktion dieses Renders; einmal beim ersten Laden genügt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authUser, demoMode, initialFlags]);

  // Auto-exit demo when a real user shows up. Without this, a user who first
  // tried the demo and then logged in keeps demoMode=true alongside their
  // authUser — and every demo gate (PDF→print, no Konto button, photo-upload
  // off) stays active for their real account. Classic state leak.
  useEffect(() => {
    if (authUser && demoMode) {
      try { localStorage.removeItem('appstudio-demo-mode'); } catch { /* ignore */ }
      setDemoMode(false);
    }
  }, [authUser, demoMode]);

  const demoBooting = useRef(false);
  async function startDemo() {
    demoBooting.current = true;
    try { localStorage.setItem('appstudio-demo-mode', '1'); } catch { /* ignore */ }
    setDemoMode(true);
    openEditorPanels('new');
    // Seed a Lena-Brandt demo profile if there isn't one yet. The demo opens
    // in the user's detected UI language so EN visitors see the EN CV directly.
    // Asynchron: der lokale Speicher liegt seit dem 08.10.2026 in IndexedDB.
    const existing = await loadProfilesLocalAsync();
    if (existing.length === 0) {
      const demo = createDemoProfile(uiLang === 'en' ? 'Demo · Lena Brandt' : 'Demo · Lena Brandt');
      demo.settings.lang = uiLang;
      saveProfilesLocal([demo]);
      setProfiles([demo]);
      setActiveId(demo.id); setActiveProfileId(demo.id);
      setScreen('editor');
    } else {
      setProfiles(existing);
      setActiveId(existing[0].id); setActiveProfileId(existing[0].id);
      setScreen('editor');
    }
    setDataLoaded(true);
  }
  /* Neu laden im Lokalmodus.
   *
   * Befund vom 08.10.2026: Wer in der Demo die Seite neu lud, blieb für immer
   * auf „Profile werden geladen…" stehen. Der Server-Ladeweg kehrt im
   * Lokalmodus sofort um, und `startDemo` läuft nur vom Startbildschirm aus —
   * niemand las die lokalen Profile. Jetzt hier. */
  useEffect(() => {
    if (!demoMode || dataLoaded || authUser || demoBooting.current) return;
    let cancelled = false;
    loadProfilesLocalAsync().then(existing => {
      if (cancelled) return;
      if (!existing.length) {
        const demo = createDemoProfile('Demo · Lena Brandt');
        demo.settings.lang = uiLang;
        saveProfilesLocal([demo]);
        existing = [demo];
      }
      setProfiles(existing);
      const remembered = getActiveProfileId();
      const pick = existing.find(p => p.id === remembered) ?? existing[0];
      setActiveId(pick.id); setActiveProfileId(pick.id);
      setScreen('editor');
      openEditorPanels('existing');
      setDataLoaded(true);
    }).catch(() => { if (!cancelled) setDataLoaded(true); });
    return () => { cancelled = true; };
    // openEditorPanels ist eine stabile Funktion dieses Renders; uiLang nur für das Startprofil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, dataLoaded, authUser]);

  function exitDemo() {
    try { localStorage.removeItem('appstudio-demo-mode'); } catch { /* ignore */ }
    setDemoMode(false);
    setProfiles([]); setActiveId(null); setScreen('home'); setDataLoaded(false);
  }
  // Soft-wall: shown when a demo user tries a backend-only action.
  function gateAction(reason: string): boolean {
    if (demoMode) { openUnlock(reason); return false; }
    return true;
  }
  /** Grund aus den Bereichen (ExportPanel meldet „Sharelinks", „MCP") auf
   *  die Funktion des Freischalt-Paneels abbilden. */
  function openUnlock(reason: string) {
    const r = reason.toLowerCase();
    setUnlock(r.includes('share') ? 'share' : r.includes('mcp') || r.includes('ki') ? 'mcp' : r.includes('version') ? 'versions' : r.includes('sync') ? 'sync' : 'account');
  }
  /** Aus der Demo zur Anmeldung bzw. zur Registrierung mit Einladung. */
  function leaveDemoToAuth() {
    exitDemo();
    setShowAuth(true);
  }

  /* Abmelden löscht die lokalen Profile nicht mehr ungefragt (Runde 3).
   *
   * Bis zum 08.10.2026 entfernte Abmelden alle localStorage-Schlüssel — damals
   * lagen dort die Lebensläufe aus dem Arbeiten ohne Konto. Wer vor dem
   * Anmelden etwas ausprobiert hatte, verlor es beim Abmelden kommentarlos.
   * Jetzt: Liegen lokale Profile in diesem Browser, wird gefragt; Standard ist
   * „behalten". Am fremden Rechner wählt man „löschen". Die Kontolöschung
   * räumt weiterhin alles ab (siehe KeysPanel unten). */
  async function requestLogout() {
    let n = 0;
    try { n = (await loadProfilesLocalAsync()).length; } catch { /* lokaler Speicher nicht lesbar */ }
    if (n > 0) { setLogoutWipe(false); setLogoutAsk(n); }
    else void handleLogout(false);
  }
  async function handleLogout(wipeLocal: boolean) {
    setLogoutAsk(null);
    try { await api.logout(); } catch { /* ignore */ }
    if (wipeLocal) await clearLocalStore();
    setAccessExpiredHit(false);
    setAuthUser(null);
    setProfiles([]); setActiveId(null); setScreen('home'); setDataLoaded(false);
  }

  const showNotice = useCallback((text: string, error?: boolean) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ text, error });
    noticeTimer.current = window.setTimeout(() => setNotice(null), error ? 9000 : 6000);
  }, []);

  /* Laufzeit des Pilot-Platzes. Der Server rechnet (access.js), hier wird nur
   * gelesen. Nach Ablauf: lesen und exportieren ja, ändern nein. */
  const access = !demoMode ? (authUser?.access ?? null) : null;
  /* Bewerbungs-Pass (Schnittstellenvertrag „Plan-Modell"): `none` = Konto
   * ohne aktiven Pass, `pass` mit notice 'expired' = abgelaufen. Beides heißt
   * wie beim Pilot: lesen, exportieren, löschen ja, schreiben nein. */
  const plan = !demoMode ? (authUser?.plan ?? null) : null;
  /* Ein abgelaufener Pass kommt vom Server als kind 'none' MIT Datum und
   * notice 'expired' (access.js, planInfo); ohne Datum hat das Konto nie
   * einen Pass gehabt. */
  const passExpired = (plan?.kind === 'none' && !!plan.until) || (plan?.kind === 'pass' && plan.notice === 'expired');
  const planLocked = !demoMode && !!authUser && (plan?.kind === 'none' || passExpired);
  const readOnly = !demoMode && !!authUser && (!!access?.readOnly || accessExpiredHit || planLocked);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  /** Ein Schreibweg wurde wegen Ablauf abgelehnt: Nur-Lese-Modus einschalten
   *  und die Laufzeit neu holen, damit das Band das Datum kennt. */
  const noteWriteError = useCallback((err: unknown): boolean => {
    if (err instanceof ApiError && (err.code === 'access_expired' || err.code === 'pass_required' || err.status === 402)) {
      setAccessExpiredHit(true);
      api.me().then(d => setAuthUser(d.user)).catch(() => {});
      return true;
    }
    return false;
  }, []);

  // Load résumés from the server once authenticated; migrate any local ones.
  useEffect(() => {
    // Demo-mode bypasses the server entirely — profiles live in localStorage.
    if (demoMode) return;
    if (!authUser || dataLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const { resumes } = await api.listResumes();
        let loaded: AppProfile[] = [];
        if (resumes.length) {
          const full = await Promise.all(resumes.map(r => api.getResume(r.id)));
          loaded = full.map(f => f.resume.payload).filter(Boolean).map(withAllLangs);
        }
        // No server-side resumes → empty home. We deliberately do NOT auto-import
        // legacy localStorage here: that path used to leak the previous account's
        // data onto a freshly created account in shared-browser scenarios.
        if (cancelled) return;
        setProfiles(loaded);
        const remembered = getActiveProfileId();
        if (remembered && loaded.find(p => p.id === remembered)) { setActiveId(remembered); setScreen('editor'); openEditorPanels('existing'); }
        else if (loaded.length === 1) { setActiveId(loaded[0].id); setScreen('editor'); openEditorPanels('existing'); }
      } catch (err) {
        console.error('résumé load failed:', err);
      } finally {
        if (!cancelled) setDataLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, dataLoaded, demoMode]);

  const lang = activeProfile?.settings.lang ?? 'de';
  const et = ET[uiLang];   // Editor-Chrome folgt der UI-Sprache, nicht der CV-Sprache
  const dsT = DESIGN_I18N[uiLang];
  const template = activeProfile?.settings.template ?? 'hamburg';
  const fontScale = activeProfile?.settings.fontScale ?? 1.0;
  const fontPairing: FontPairingId = activeProfile?.settings.fontPairing ?? 'auto';
  const pageMode: PageMode = activeProfile?.settings.pageMode ?? 'one';
  const pageFormat: PageFormat = activeProfile?.settings.pageFormat ?? 'a4';
  const accent: AccentId = activeProfile?.settings.accent ?? 'auto';
  const paper: PaperId = activeProfile?.settings.paper ?? 'auto';

  const theme = getTheme(template, accent, paper);
  const pairing = resolvePairing(theme, fontPairing);

  /* useMemo so a fresh object identity doesn't trigger every downstream
   * useCallback/useMemo (renderDoc, ExportPanel, EditorPanel) on every parent
   * re-render — was a finding in the code review. */
  const currentData: CVData = useMemo(
    () => activeProfile?.data[lang] ?? EMPTY_CV,
    [activeProfile, lang],
  );
  const currentCoverLetter: CoverLetterData = useMemo(
    () => activeProfile?.coverLetters[lang] ?? EMPTY_COVER_LETTER,
    [activeProfile, lang],
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirtyRef = useRef<AppProfile | null>(null);
  const skipSave = useRef(true); // skip the initial server-load population

  /** Wartet ein Speichervorgang noch auf seine 900 ms? */
  const pendingSave = useRef(false);
  const queueSave = useCallback((profile: AppProfile) => {
    dirtyRef.current = profile;
    setSaveStatus('saving');
    pendingSave.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      pendingSave.current = false;
      const p = dirtyRef.current;
      if (!p) return;
      // Nach Ablauf des Zugangs wird nichts mehr gespeichert — auch kein
      // Speichervorgang, der vor dem Umschalten angestoßen war.
      if (readOnlyRef.current && !demoMode) { setSaveStatus('saved'); return; }
      if (demoMode) {
        // Lokal (IndexedDB): „Gespeichert" erst, wenn es wirklich auf der
        // Platte liegt. Die synchrone Rückgabe von saveProfiles kennt nur das
        // VORIGE Schreiben — beim ersten Fehlschlag stand sonst „Gespeichert" da.
        const all = loadProfilesLocal();
        const next = all.find(x => x.id === p.id) ? all.map(x => x.id === p.id ? p : x) : [...all, p];
        saveProfilesLocalAsync(next).then(ok => setSaveStatus(ok ? 'saved' : 'error'), () => setSaveStatus('error'));
        return;
      }
      api.saveResume(p).then(() => setSaveStatus('saved')).catch(err => {
        // Ablauf während der Sitzung: kein „Nicht gespeichert", sondern der
        // Nur-Lese-Modus mit Erklärung.
        if (noteWriteError(err)) setSaveStatus('saved');
        else setSaveStatus('error');
      });
    }, 900);
  }, [setSaveStatus, demoMode, noteWriteError]);

  /** Wartendes Speichern sofort ausführen — vor allem, was den Stand am
   *  Server liest (Sharelink anlegen oder auffrischen). Sonst hielte ein Link
   *  den Stand von vor der letzten Tipp-Pause fest. */
  const flushSave = useCallback(async (): Promise<void> => {
    if (demoMode || readOnlyRef.current || !pendingSave.current || !dirtyRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = false;
    try { await api.saveResume(dirtyRef.current); setSaveStatus('saved'); }
    catch (err) { if (!noteWriteError(err)) setSaveStatus('error'); }
  }, [demoMode, noteWriteError]);

  function patchProfile(updater: (p: AppProfile) => AppProfile) {
    if (!activeId) return;
    setProfiles(prev => updateProfileInList(prev, activeId, updater));
  }
  const updateData = useCallback((updater: (d: CVData) => CVData) => {
    if (!activeId || readOnlyRef.current) return;
    setProfiles(prev => updateProfileInList(prev, activeId, p0 => {
      const p = p0.data[p0.settings.lang] ? p0 : withAllLangs(p0);
      return { ...p, data: { ...p.data, [p.settings.lang]: updater(p.data[p.settings.lang]) } };
    }));
  }, [activeId]);
  const updateCoverLetter = useCallback((updater: (d: CoverLetterData) => CoverLetterData) => {
    if (!activeId || readOnlyRef.current) return;
    setProfiles(prev => updateProfileInList(prev, activeId, p0 => {
      const p = p0.coverLetters[p0.settings.lang] ? p0 : withAllLangs(p0);
      return { ...p, coverLetters: { ...p.coverLetters, [p.settings.lang]: updater(p.coverLetters[p.settings.lang]) } };
    }));
  }, [activeId]);
  /* Sprachfassung wechseln. Ist die neue Fassung noch ohne Kontaktdaten,
   * werden Name, Kontakt, Adressen und Foto aus der bisherigen übernommen
   * (storage.ts, `carryContactToLang`) — mit einem Hinweis, dass die Texte
   * übersetzt werden wollen. */
  const [langNotice, setLangNotice] = useState<string | null>(null);
  function switchDocLang(l: Lang) {
    const from = activeProfile?.settings.lang;
    if (activeProfile && from && from !== l && carryContactToLang(activeProfile, from, l)) {
      setLangNotice(et.contactCarried(from.toUpperCase()));
      window.setTimeout(() => setLangNotice(null), 7000);
    }
    patchProfile(p => {
      const carried = carryContactToLang(p, p.settings.lang, l) ?? p;
      return { ...carried, settings: { ...carried.settings, lang: l } };
    });
  }
  function updateSettings(patch: Partial<AppProfile['settings']>) {
    patchProfile(p => {
      const merged: AppProfile['settings'] = { ...p.settings, ...patch };
      // "Struktur vom Design übernehmen": wenn aktiv und der User wechselt
      // das Template, werden die manuellen Reihenfolge-Anpassungen verworfen
      // damit der ideale Default-Aufbau der neuen Vorlage sichtbar ist. User
      // kann das Verhalten im Settings-Panel abschalten — dann wandert seine
      // sectionOrder/sectionPages mit über jeden Template-Switch.
      const respect = merged.respectTemplateStructure !== false; // default an
      if (respect && patch.template && patch.template !== p.settings.template) {
        merged.sectionOrder = undefined;
        merged.sectionPages = undefined;
      }
      return { ...p, settings: merged };
    });
  }
  // Replace the active profile wholesale (used by Markdown import round-trip).
  const handleProfileUpdated = useCallback((updated: AppProfile) => {
    skipSave.current = true; // server is already the source of truth here
    const normalized = withAllLangs(updated);
    setProfiles(prev => prev.map(p => p.id === normalized.id ? normalized : p));
  }, []);

  // Persist the active profile to the server whenever it changes (debounced).
  useEffect(() => {
    if (!dataLoaded) return;
    if (skipSave.current) { skipSave.current = false; return; }
    if (readOnly) return;
    const active = profiles.find(p => p.id === activeId);
    if (active) queueMicrotask(() => queueSave(active));
  }, [profiles, activeId, dataLoaded, queueSave, readOnly]);

  function handleSelectProfile(id: string) { setActiveId(id); setActiveProfileId(id); setScreen('editor'); openEditorPanels('existing'); }
  function handleCreateProfile(profile: AppProfile) {
    if (readOnly) return;
    setProfiles(prev => [...prev, profile]);
    if (demoMode) {
      saveProfilesLocalAsync([...loadProfilesLocal(), profile]).then(ok => { if (!ok) setSaveStatus('error'); });
    } else {
      api.saveResume(profile).catch(err => { if (!noteWriteError(err)) console.error('create failed:', err); });
    }
    setActiveId(profile.id); setActiveProfileId(profile.id); setScreen('editor');
    /* Abweichung vom Bericht („neues Profil öffnet Gestaltung"), bewusst: Ein
     * LEERES Profil hat noch nichts, was man gestalten könnte — dort ist der
     * nächste Schritt das Formular. Mit Beispiel oder Import geht es in die
     * Gestaltung. */
    const leer = !profile.data[profile.settings.lang]?.experience?.length && !profile.data[profile.settings.lang]?.personal?.email;
    if (leer) { openEditorPanels('existing'); setPanelState('content'); }
    else openEditorPanels('new');
  }
  function handleDeleteProfile(id: string) {
    const rest = deleteProfileFromList(profiles, id);
    setProfiles(rest);
    if (demoMode) {
      saveProfilesLocalAsync(rest).then(ok => { if (!ok) setSaveStatus('error'); });
    } else {
      api.deleteResume(id).catch(err => console.error('delete failed:', err));
    }
    if (activeId === id) { setActiveId(rest[0]?.id ?? null); if (rest.length === 0) setScreen('home'); }
  }
  /* Fassung duplizieren (Wettbewerbsbericht, Lücke 3): vollständige Kopie mit
   * „(Kopie)" im Titel, direkt hinter dem Original. Mit Konto über dieselbe
   * Anlege-Route wie ein neues Profil (POST /api/resumes, voller Inhalt);
   * Fotoadressen zeigen auf Fotos desselben Nutzers und bleiben gültig. Aus
   * dem Editor heraus geht es gleich in die Kopie — dafür wird man sie
   * angelegt haben —, mit Rückgängig. */
  function handleDuplicateProfile(id: string, open = false) {
    if (readOnly) return;
    const src = profiles.find(p => p.id === id);
    if (!src) return;
    const F = FASSUNG_I18N[uiLang];
    const copy = duplicateProfile(src, F.copyName(src.displayName));
    const at = profiles.findIndex(p => p.id === id);
    const next = [...profiles.slice(0, at + 1), copy, ...profiles.slice(at + 1)];
    setProfiles(next);
    const fail = () => {
      setProfiles(prev => prev.filter(p => p.id !== copy.id));
      setActiveId(cur => (cur === copy.id ? id : cur));
      showNotice(F.duplicateFailed, true);
    };
    if (demoMode) {
      saveProfilesLocalAsync(next).then(ok => { if (!ok) fail(); }, fail);
    } else {
      api.saveResume(copy).catch(err => { noteWriteError(err); fail(); });
    }
    if (open) {
      skipSave.current = true; // die Kopie ist eben gespeichert worden
      setActiveId(copy.id); setActiveProfileId(copy.id);
      showToast(F.duplicated(copy.displayName), () => {
        // Erst löschen (setzt die aktive Fassung um), dann das Original wählen
        // — der letzte Aufruf gewinnt.
        handleDeleteProfileRef.current?.(copy.id);
        setActiveId(id); setActiveProfileId(id);
      });
    } else {
      showNotice(F.duplicated(copy.displayName));
    }
  }
  const handleDeleteProfileRef = useRef<((id: string) => void) | null>(null);
  handleDeleteProfileRef.current = handleDeleteProfile;

  useEffect(() => {
    const handler = () => setPrinting(false);
    window.addEventListener('afterprint', handler);
    return () => window.removeEventListener('afterprint', handler);
  }, []);

  function handlePrint() {
    const prevTitle = document.title;
    const coverWord: Record<Lang, string> = { de: 'Anschreiben', en: 'Cover Letter', fr: 'Lettre de motivation', es: 'Carta de presentación' };
    const docWord = docType === 'cover-letter'
      ? coverWord[lang]
      : currentData.labels.misc.cvLabel;
    document.title = currentData.personal.name ? `${currentData.personal.name} – ${docWord}` : docWord;
    // Das Druck-PDF entsteht im Browser; der Server erfährt davon nur hierüber.
    if (authUser && !demoMode) void api.event('pdf_local');
    setPrinting(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.print();
      setTimeout(() => { document.title = prevTitle; }, 1000);
    }));
  }


  const hiddenSections = activeProfile?.settings.hiddenSections ?? [];
  const sectionOrder = activeProfile?.settings.sectionOrder ?? DEFAULT_SECTION_ORDER;
  const sectionPages = activeProfile?.settings.sectionPages;

  // ── Document render fn for DocumentPreview ────────────────────────────────
  /** Sektionen, vor denen der Nutzer einen harten Umbruch erzwungen hat.
   *  Die alte `sectionPages`-Zuweisung („Sektion X gehört auf Seite 2") wird
   *  darauf abgebildet: erzwungener Umbruch statt fester Seitenzuteilung. Die
   *  feste Zuteilung war der Grund dafür, dass jede Inhaltsänderung die
   *  Aufteilung zerschossen hat. */
  const forcedBreaks = useMemo<SectionKey[]>(
    () => (sectionPages ? (Object.keys(sectionPages) as SectionKey[]).filter(k => (sectionPages[k] ?? 1) > 1) : []),
    [sectionPages],
  );

  /**
   * Direktes Schreiben in der Vorschau.
   *
   * Die Vorschau ist das Dokument, nicht sein Abbild — wer eine Formulierung
   * ändern will, klickt hinein. Das Formular links bleibt für die Struktur
   * zuständig: Einträge anlegen, Reihenfolge, Sichtbarkeit, Seitenumbrüche.
   *
   * Übernommen wird beim Verlassen des Feldes. Jede Übernahme stößt die
   * Umbruchrechnung neu an; bei jedem Anschlag zu rechnen hieße, dass die Seite
   * unter den Fingern springt.
   */
  const focusInline = useCallback((path: string | null) => {
    if (!path) return;
    // Zwei Bilder warten: das erste bringt die neuen Daten, im zweiten steht
    // die Seitenaufteilung — vorher gibt es den Knoten unter Umständen nicht.
    /* Ein NEUER Block steht erst auf der Seite, wenn die Umbruchrechnung ihn
     * einer Seite zugeteilt hat (220 ms Ruhe plus Suche). Bis dahin gibt es
     * den Knoten nicht — also nachsehen, bis er da ist, höchstens zwei
     * Sekunden. Vorher landete der Schreibzeiger bei „+ Punkt" nirgends. */
    const started = performance.now();
    const tryFocus = () => {
      const el = document.querySelector(`.cv-scale-wrapper [data-cv-edit="${path}"]`) as HTMLElement | null;
      if (!el) {
        if (performance.now() - started < 2000) requestAnimationFrame(tryFocus);
        return;
      }
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    };
    requestAnimationFrame(() => requestAnimationFrame(tryFocus));
  }, []);

  /**
   * Direktes Schreiben gibt es nur am großen Bildschirm.
   *
   * Auf dem Telefon steht die Seite auf etwa 46 % — ein Stichpunkt ist dort
   * sechs Pixel hoch. Hineinzutippen wäre Blindflug, und iOS zoomt bei
   * Schriftgrößen unter 16 px beim Fokussieren zusätzlich hinein. Vor allem
   * aber hat die Vorschau auf dem Telefon eine bessere Antwort auf einen Tipp:
   * sie springt in den Bearbeiten-Bereich, genau zur passenden Rubrik. Genau
   * die würde ein beschreibbares Feld abfangen.
   */
  const inlineEditApi = useMemo<InlineEditApi>(() => ({
    commit: (path, value) => {
      // Anschreiben und Lebenslauf liegen in getrennten Datensätzen; das
      // Präfix `cl.` entscheidet, welcher davon geschrieben wird.
      if (isCoverLetterPath(path)) { updateCoverLetter(c => applyCoverLetterEdit(c, path, value)); return; }
      updateData(d => applyInlineEdit(d, path, value));
    },
    // Umbau und Zielpfad werden VOR dem Setzen berechnet, nicht in der
    // Aktualisierungsfunktion: React ruft die erst beim nächsten Durchlauf auf,
    // der Zielpfad wäre zum Zeitpunkt des Fokussierens also noch leer.
    split: path => {
      const res = insertAfter(currentData, path);
      if (!res) return;
      updateData(() => res.data);
      focusInline(res.focus);
    },
    remove: path => {
      const res = removeAt(currentData, path);
      if (!res) return;
      updateData(() => res.data);
      focusInline(res.focus);
    },
    /* Block-Werkzeug an Stationen (templates/InlineEdit.tsx, EntryTools). */
    entry: {
      move: (kind, id, delta) => updateData(dd => {
        const list = [...dd[kind]] as typeof dd.experience;
        const i = list.findIndex(x => x.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= list.length) return dd;
        [list[i], list[j]] = [list[j], list[i]];
        return { ...dd, [kind]: list };
      }),
      duplicate: (kind, id) => updateData(dd => {
        const list = [...dd[kind]] as { id: string }[];
        const i = list.findIndex(x => x.id === id);
        if (i < 0) return dd;
        list.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(list[i])), id: newEntryId() });
        return { ...dd, [kind]: list };
      }),
      remove: (kind, id) => {
        const before = currentData;
        const list = before[kind] as { id: string }[];
        if (!list.some(x => x.id === id)) return;
        updateData(dd => ({ ...dd, [kind]: (dd[kind] as { id: string }[]).filter(x => x.id !== id) }));
        showToast(dsT.entryDelete, () => updateData(() => before));
      },
      addBullet: id => {
        const e = currentData.experience.find(x => x.id === id);
        if (!e) return;
        updateData(dd => ({ ...dd, experience: dd.experience.map(x => x.id === id ? { ...x, bullets: [...x.bullets, ''] } : x) }));
        focusInline(`experience.${id}.bullets.${e.bullets.length}`);
      },
    },
  }), [updateData, updateCoverLetter, focusInline, currentData, showToast, dsT]);
  /* Direktes Schreiben gilt auf jedem Gerät. Auf dem Telefon war es zwischen-
   * zeitlich abgeschaltet, weil ein Tipp auf den Text zwei Dinge gleichzeitig
   * bedeutet hätte — Sprung in den Formularbereich und Schreibzeiger ins Feld.
   * Aufgelöst ist das jetzt an der Stelle, an der es entsteht: beschreibbare
   * Felder behalten den Tipp für sich (siehe DocumentPreview), alles andere
   * springt weiterhin in die passende Rubrik. Die Lesbarkeit löst
   * `MobilePreview`, indem es beim Hineintippen auf volle Größe zoomt. */
  // Nach Ablauf des Zugangs: kein Schreiben in der Vorschau.
  const inlineEdit = readOnly ? undefined : inlineEditApi;

  /** Alles, was den Satz beeinflusst — ändert sich davon etwas, rechnet die
   *  Vorschau den Umbruch neu. */
  const contentKey = useMemo(
    () => contentKeyOf(docType === 'cover-letter' ? currentCoverLetter : currentData,
      docType, theme.id, pairing.id, hiddenSections, sectionOrder, forcedBreaks),
    [docType, currentData, currentCoverLetter, theme.id, pairing.id, hiddenSections, sectionOrder, forcedBreaks],
  );

  const renderDoc = useCallback((M: Metrics, pageBlocks: string[][] | undefined, measure: boolean, asideCap: number) => (
    docType === 'cover-letter'
      ? <CoverLetterRenderer cvData={currentData} clData={currentCoverLetter} theme={theme} pairing={pairing} metrics={M} measure={measure} pageFormat={pageFormat} inlineEdit={measure ? undefined : inlineEdit} />
      : <ResumeRenderer data={currentData} theme={theme} pairing={pairing} metrics={M} measure={measure} pageBlocks={pageBlocks} hiddenSections={hiddenSections} sectionOrder={sectionOrder} pageFormat={pageFormat} forcedBreaks={forcedBreaks} asideSkillCap={asideCap} inlineEdit={measure ? undefined : inlineEdit} />
  ), [docType, currentData, currentCoverLetter, theme, pairing, hiddenSections, sectionOrder, pageFormat, forcedBreaks, inlineEdit]);

  // ── Abgeleitete Werte für Oberfläche und Export ──────────────────────────
  /* Genau die Zusammensetzung, die bisher an beiden ExportPanel-Stellen
   * inline stand — eine Abweichung hier wäre eine Abweichung im PDF. */
  const exportConfig = useMemo(() => ({
    themeId: template, accentId: accent, paperId: paper, pairingId: fontPairing,
    metrics: fit?.metrics ?? metricsFor(0, fontScale), pageBlocks: fit?.pageBlocks, asideSkillCap: fit?.asideCap,
    hiddenSections, sectionOrder, pageFormat, forcedBreaks,
  }), [template, accent, paper, fontPairing, fit, fontScale, hiddenSections, sectionOrder, pageFormat, forcedBreaks]);
  const atsLevel = atsLevelForLayout(theme.layout);
  const nav = useTemplateNav(template);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const onZoomFit = useCallback(() => setZoom('fit'), []);
  /** Nach „Sicherung laden" oder „Alles löschen" (ui/BackupReminder.tsx). */
  const replaceProfiles = useCallback((ps: AppProfile[]) => {
    setProfiles(ps);
    if (!ps.some(p => p.id === activeId)) { setActiveId(ps[0]?.id ?? null); if (!ps.length) setScreen('home'); }
  }, [activeId]);

  function loadAts() {
    track('export_docx_ats');
    if (!demoMode) void api.event('docx');
    void exportDocx(currentData, exportConfig, 'ats');
  }

  /* ATS-Fassung als PDF (export/AtsPdfRunner.tsx): derselbe Inhalt in einer
   * einspaltigen Vorlage, gemessen wie die Vorschau, über denselben PDF-Weg.
   * Die Vorlage im Profil bleibt, wie sie ist. */
  async function exportAtsPdf(): Promise<{ pages: number; bytes: number; template: string }> {
    if (atsBusy.current) throw new Error('busy');
    atsBusy.current = true;
    try {
      const data = currentData;
      const themeId = atsPdfTemplateFor(data);
      const base = {
        data, themeId, fontScale, pageMode, pageFormat,
        hiddenSections, sectionOrder, forcedBreaks,
      };
      const atsFit = await new Promise<FitInfo>((resolve, reject) => {
        setAtsJob({ ...base, id: Date.now(), resolve, reject });
      });
      setAtsJob(null);
      const cfg: ExportRenderConfig = {
        themeId, accentId: 'auto', paperId: 'auto', pairingId: 'auto',
        metrics: atsFit.metrics, pageBlocks: atsFit.pageBlocks, asideSkillCap: atsFit.asideCap,
        hiddenSections, sectionOrder, pageFormat, forcedBreaks,
      };
      track('export_pdf_ats', { demo: demoMode });
      const res = await exportPdf({ data, cfg, isCover: false, variant: 'ats' });
      return { ...res, template: getTheme(themeId).name };
    } finally {
      setAtsJob(null);
      atsBusy.current = false;
    }
  }
  /** Für die Knöpfe ohne eigene Rückmeldung (ATS-Zeile): Ergebnis als Meldung. */
  function loadAtsPdf() {
    const F = FASSUNG_I18N[uiLang];
    if (atsBusy.current) return;
    showNotice(F.atsPdfBusy);
    exportAtsPdf().then(
      r => showNotice(F.atsPdfDone(r.pages, Math.max(1, Math.round(r.bytes / 1024)), r.template)),
      err => showNotice(F.atsPdfFailed(err instanceof Error ? err.message : '?'), true),
    );
  }

  /* „Foto entfernen" mit Konto: die Datei am Server gleich mit löschen — aber
   * nur, wenn keine andere Sprachfassung und kein anderes Profil (etwa eine
   * duplizierte Fassung) dieselbe Adresse benutzt. Verglichen wird über die
   * Foto-ID, nicht über die ganze Adresse. */
  function handlePhotoRemoved(urls: string[]) {
    if (demoMode || !activeProfile) return;
    const used = new Set<string>();
    for (const p of profiles) {
      for (const l of Object.keys(p.data) as Lang[]) {
        if (p.id === activeProfile.id && l === lang) continue;
        const ps = p.data[l]?.personal;
        for (const u of [ps?.photo, ps?.photoOriginal]) { const pid = photoIdOf(u); if (pid) used.add(pid); }
      }
    }
    const ids = [...new Set(urls.map(u => photoIdOf(u)).filter((x): x is string => !!x))].filter(pid => !used.has(pid));
    ids.forEach(pid => { api.deletePhoto(pid).catch(() => { /* Aufräumen am Server erledigt den Rest */ }); });
  }
  function changeTemplate(id: string, dir: -1 | 0 | 1, undoable = false) {
    if (resolveThemeId(id) === resolveThemeId(template)) return;
    const prev = template;
    setSwap({ key: id, dir });
    updateSettings({ template: id });
    if (undoable) showToast(dsT.switched(getTheme(id).name), () => { setSwap({ key: prev, dir: (dir * -1) as -1 | 0 | 1 }); updateSettings({ template: prev }); });
  }
  const stepTemplate = (dir: -1 | 1, undoable = false) => changeTemplate(nav.step(dir), dir, undoable);

  /* Nachbarn im Karussell und Miniaturen im Gestaltungs-Paneel: statische
   * Seiten aus dem eigenen Inhalt, ohne Messlauf. Sie folgen dem Inhalt erst
   * nach einer Tipp-Pause (500 ms), damit das Schreiben flüssig bleibt. */
  const settledData = useSettled(currentData, 500);
  const settledCl = useSettled(currentCoverLetter, 500);
  const staticMetrics = useMemo(() => metricsFor(0.5, fontScale), [fontScale]);
  const renderTemplate = useCallback((id: string) => {
    const th = getTheme(id, accent, paper);
    const pr = resolvePairing(th, fontPairing);
    return docType === 'cover-letter'
      ? <CoverLetterRenderer cvData={settledData} clData={settledCl} theme={th} pairing={pr} metrics={staticMetrics} pageFormat={pageFormat} />
      : <ResumeRenderer data={settledData} theme={th} pairing={pr} metrics={staticMetrics} hiddenSections={hiddenSections} sectionOrder={sectionOrder} pageFormat={pageFormat} />;
  }, [accent, paper, fontPairing, docType, settledData, settledCl, staticMetrics, pageFormat, hiddenSections, sectionOrder]);

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="ui" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)', color: 'var(--ink-2)' }}>
        {APP_NAME} …
      </div>
    );
  }
  // Legal-Pages sind public und werden VOR der Auth-Verzweigung geroutet,
  // damit ein Footer-Link auch ohne Login erreichbar ist.
  if (screen === 'impressum') return <ImpressumPage onBack={() => setScreen('home')} lang={uiLang} />;
  if (screen === 'privacy') return <PrivacyPage onBack={() => setScreen('home')} lang={uiLang} />;

  if (!authUser && !demoMode) {
    if (showAuth) {
      return <AuthScreen onAuth={handleAuth} onDemoStart={startDemo} lang={uiLang} onLangChange={handleLangChange}
                         initialInvite={initialInvite} initialMode={initialInvite ? 'register' : 'login'} />;
    }
    return <LandingScreen onSignIn={() => setShowAuth(true)} onDemoStart={startDemo} lang={uiLang} onLangChange={handleLangChange} onLegal={(p) => navigate(p === 'impressum' ? PATHS.imprint : PATHS.privacy)} />;
  }
  if (!dataLoaded) {
    return (
      <div className="ui" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--canvas)', color: 'var(--ink-2)' }}>
        Profile werden geladen…
      </div>
    );
  }

  const backupReminder = (
    <BackupReminder
      active={demoMode}
      bottomOffset={isMobile ? 168 : 136}
      onProfilesReplaced={replaceProfiles}
    />
  );

  const Z = ZUGANG_I18N[uiLang];
  const F = FASSUNG_I18N[uiLang];
  const B = BILLING_I18N[uiLang];

  /** Laufzeit-Band: 14 und 3 Tage vor Ablauf, danach dauerhaft (je Stufe in
   *  dieser Sitzung ausblendbar). */
  /* Bei Pass und „noch kein Pass" spricht das Band vom Pass und bietet
   * „Pass holen/verlängern"; beim Pilot bleibt es beim Hinweis auf die Person,
   * von der der Zugang stammt. */
  const passBand = plan && (plan.kind === 'none' || (plan.kind === 'pass' && !!plan.notice)) ? plan : null;
  /** „noch nie ein Pass" (kein Datum) vs. „Pass abgelaufen". */
  const neverHadPass = passBand?.kind === 'none' && !passBand.until;
  const accessNoticeKey = passBand
    ? `${passBand.kind}-${passBand.notice ?? 'none'}|${passBand.until ?? ''}`
    : access?.notice ? `${access.notice}|${access.until}` : (accessExpiredHit ? 'expired|?' : null);
  const passUntil = passBand?.until ? formatAccessDate(passBand.until, uiLang) : '…';
  /* Laufzeit nur aus Gutscheinen: Das Band spricht vom Gratiszugang, nennt
   * „es wird nichts abgebucht" und bietet erst nach Ablauf den freiwilligen
   * Kauf an („90 Tage für 9 € freischalten"). */
  const G = GUTSCHEIN_I18N[uiLang];
  const freeBand = !!passBand && !neverHadPass && freeOnly(passBand);
  const passBuyLabel = freeBand && passExpired && offer
    ? G.unlock(offer.days, priceOf(offer, uiLang))
    : neverHadPass ? Z.getPass : Z.extendPass;
  const accessBanner = accessNoticeKey && accessHidden !== accessNoticeKey ? (
    <div className="ui-access-banner ui" role="status" data-noprint data-notice={passBand ? `${passBand.kind}-${passBand.notice ?? 'none'}` : access?.notice ?? 'expired'}>
      <span>
        {passBand ? (
          neverHadPass ? Z.planNone
            : freeBand ? (passExpired ? G.freeExpired(passUntil) : G.freeSoon(passUntil))
            : passExpired ? Z.passExpired(passUntil)
            : passBand.notice === 'soon' ? Z.passSoon(passUntil, passBand.daysLeft ?? 0)
            : passBand.notice === 'final' ? Z.passFinal(passUntil, passBand.daysLeft ?? 0)
            : Z.passExpired(passUntil)
        ) : access?.notice === 'soon' ? Z.soon(formatAccessDate(access.until, uiLang), access.daysLeft)
          : access?.notice === 'final' ? Z.final(formatAccessDate(access.until, uiLang), access.daysLeft)
          : Z.expired(access ? formatAccessDate(access.until, uiLang) : '…')}
      </span>
      {screen === 'editor' && !neverHadPass && (
        <button type="button" className="ui-btn ui-btn-soft" style={{ minHeight: '32px', fontSize: 'var(--t-xs)' }}
          onClick={() => (isMobile ? setMPanel('export') : setPanel('export'))}>{Z.exportNow}</button>
      )}
      {passBand && salesOpen(offer) && (!freeBand || passExpired) && (
        <button type="button" className="ui-btn ui-btn-primary" style={{ minHeight: '32px', fontSize: 'var(--t-xs)' }}
          onClick={() => navigate(PATHS.checkout)}>{passBuyLabel}</button>
      )}
      <button type="button" className="ui-btn ui-icon-btn" aria-label={Z.dismiss} title={Z.dismiss}
        style={{ minHeight: '32px', width: '32px', minWidth: '32px', color: 'inherit' }}
        onClick={() => { setAccessHidden(accessNoticeKey); try { sessionStorage.setItem('cv-access-hidden', accessNoticeKey); } catch { /* ignore */ } }}>×</button>
    </div>
  ) : null;

  const logoutDialog = logoutAsk !== null ? (
    <div onClick={() => setLogoutAsk(null)} className="ui" style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'oklch(0.21 0.021 264 / 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cv-logout-title" onClick={e => e.stopPropagation()} className="ui-float"
        onKeyDown={e => { if (e.key === 'Escape') setLogoutAsk(null); }}
        style={{ background: 'var(--float-solid)', width: '100%', maxWidth: '480px', padding: 'clamp(20px, 4vw, 28px)' }}>
        <h2 id="cv-logout-title" style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 640, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{Z.logoutTitle}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 'var(--t-sm)', color: 'var(--ink-2)', lineHeight: 1.55 }}>{Z.logoutBody(logoutAsk)}</p>
        <div role="radiogroup" aria-labelledby="cv-logout-title" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {([false, true] as const).map(wipe => (
            <label key={String(wipe)} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', background: logoutWipe === wipe ? 'oklch(1 0 0 / 0.8)' : 'transparent', boxShadow: logoutWipe === wipe ? 'inset 0 0 0 2px var(--accent)' : 'inset 0 0 0 1px var(--hair)' }}>
              <input type="radio" name="cv-logout-local" checked={logoutWipe === wipe} onChange={() => setLogoutWipe(wipe)} style={{ marginTop: '3px', width: '18px', height: '18px' }} autoFocus={!wipe} />
              <span>
                <span style={{ display: 'block', fontSize: 'var(--t-sm)', fontWeight: 600, color: 'var(--ink)' }}>{wipe ? Z.deleteLocal : Z.keepLocal}</span>
                <span style={{ display: 'block', fontSize: 'var(--t-xs)', color: 'var(--ink-2)', marginTop: '2px', lineHeight: 1.45 }}>{wipe ? Z.deleteLocalSub : Z.keepLocalSub}</span>
              </span>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '20px' }}>
          <button type="button" className="ui-btn ui-btn-soft" onClick={() => setLogoutAsk(null)} style={{ minHeight: '44px' }}>{Z.cancel}</button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => void handleLogout(logoutWipe)} style={{ minHeight: '44px', padding: '0 18px' }}>{Z.logoutConfirm}</button>
        </div>
      </div>
    </div>
  ) : null;

  const noticeEl = notice ? (
    <div role="status" aria-live="polite" className="ui-toast ui" style={{ bottom: isMobile ? '168px' : '24px', padding: '11px 16px', color: notice.error ? 'var(--ats-low-ink)' : undefined }}>{notice.text}</div>
  ) : null;

  // ── Home ──────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <>
        <HomeScreen profiles={profiles} onSelect={handleSelectProfile} onCreate={handleCreateProfile} onDelete={handleDeleteProfile}
          onDuplicate={readOnly ? undefined : (id => handleDuplicateProfile(id))}
          readOnlyNote={readOnly ? (passExpired ? Z.passReadOnlyHome : plan?.kind === 'none' ? Z.noneReadOnlyHome : Z.readOnlyHome) : undefined}
          banner={<>{accessBanner}<ConfirmEmailBanner user={demoMode ? null : authUser} lang={uiLang} /></>}
          username={authUser?.username} isAdmin={authUser?.role === 'admin'} onLogout={demoMode ? undefined : () => void requestLogout()} onOpenAdmin={() => setAdminOpen(true)}
          onOpenBackup={demoMode ? () => setBackupOpen(true) : undefined}
          onOpenPass={!demoMode && (plan || salesOpen(offer)) ? () => setPassOpen(true) : undefined} />
        {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
        {backupReminder}
        {backupOpen && <LocalBackupPanel onClose={() => setBackupOpen(false)} onProfilesReplaced={replaceProfiles} />}
        {passOpen && <PassDialog lang={uiLang} onClose={() => setPassOpen(false)} />}
        {logoutDialog}
        {noticeEl}
      </>
    );
  }

  // ── Print render ──────────────────────────────────────────────────────────
  if (printing) {
    return (
      <div id="print-only-root" style={{ background: 'oklch(0.985 0.003 264)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
        <div data-noprint style={{ fontFamily: UI_FONT, fontSize: '12px', color: '#767676', marginBottom: '24px' }}>Druckvorschau wird vorbereitet…</div>
        <DocumentPreview
          render={renderDoc}
          userScale={fontScale}
          pageMode={pageMode}
          pageFormat={pageFormat}
          contentKey={contentKey}
        />
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  const previewArea = (scale: number) => (
    <DocumentPreview
      render={renderDoc}
      userScale={fontScale}
      pageMode={pageMode}
      pageFormat={pageFormat}
      contentKey={contentKey}
      viewportScale={scale}
      onFit={setFit}
      labels={currentData.labels}
      /* Klick neben den Text springt in den passenden Formularbereich — nur
         am Schreibtisch und nur beim Lebenslauf. Auf dem Telefon heißt ein
         Tipp „hier schreiben": Der Zoom beim Hineintippen verschiebt die
         Seite unter dem Finger, und der Klick landete danach neben dem Feld
         — das Inhalt-Paneel klappte über das Dokument, in dem man gerade
         schreiben wollte (gefunden beim Umbau, 08.10.2026). */
      onEdit={docType === 'resume' && !isMobile ? handlePreviewEdit : undefined}
    />
  );

  const saveText = readOnly ? Z.readOnlyStatus : saveStatus === 'error' ? et.unsaved : saveStatus === 'saving' ? et.saving : (demoMode ? dsT.savedLocal : et.saved);
  const saveState = readOnly ? 'readonly' : saveStatus;
  const panelTitle: Record<PanelId, string> = { content: dsT.content, design: dsT.design, check: dsT.check, tips: dsT.tips, export: dsT.exportAll };

  const docSegment = (
    <div className="ui-seg ui-pill" role="group" aria-label={dsT.docGroup}>
      {(['resume', 'cover-letter'] as DocType[]).map(dt => (
        <button key={dt} type="button" aria-pressed={docType === dt} onClick={() => setDocType(dt)}
          style={isMobile ? { minHeight: '40px', padding: '0 12px' } : undefined}>
          {{ resume: et.resume, 'cover-letter': et.coverLetter }[dt]}
        </button>
      ))}
    </div>
  );

  /** Sprache des Lebenslaufs — im Kopf des Inhalt-Paneels, beschriftet, damit
   *  sie nicht mit der Oberflächensprache (im „⋯"-Menü) verwechselt wird. */
  const docLangRow = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '0 16px 10px 20px' }}>
      <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-2)', fontWeight: 560 }}>{dsT.docLang}</span>
      <div className="ui-seg" role="group" aria-label={et.langLabel} style={{ background: 'oklch(0.30 0.02 250 / 0.06)' }}>
        {ALL_LANGS.map(l => (
          <button key={l} type="button" onClick={() => switchDocLang(l)} aria-pressed={lang === l}
            title={`${et.langLabel}: ${LANG_NAMES[l]}`}
            style={{ minHeight: isMobile ? '40px' : '28px', padding: isMobile ? '0 12px' : '0 9px', fontSize: 'var(--t-xs)' }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );

  const editors = docType === 'resume'
    ? <EditorPanel data={currentData} lang={lang} uiLang={uiLang} onUpdate={updateData} demoMode={demoMode} jumpTab={editJumpTab} jumpTick={editJumpTick} onPhotoRemoved={handlePhotoRemoved} readOnly={readOnly} />
    : <CoverLetterEditor data={currentCoverLetter} uiLang={uiLang} onUpdate={updateCoverLetter} resumeId={activeId} />;
  const contentBody = (
    <>
      {docLangRow}
      {readOnly && <div className="ui-readonly-note" role="note">{passExpired ? Z.passReadOnlyContent : plan?.kind === 'none' ? Z.noneReadOnlyContent : Z.readOnlyContent}</div>}
      <div className="ui-panel-fill" style={{ flex: 1, minHeight: 0 }}>
        {/* Nach Ablauf: Felder gesperrt (disabled), Lesen und Blättern bleibt.
            Der Lebenslauf sperrt selbst (Reiter bleiben bedienbar), das
            Anschreiben hier im Ganzen. */}
        {readOnly && docType !== 'resume' ? <fieldset disabled style={{ display: 'contents' }}>{editors}</fieldset> : editors}
      </div>
    </>
  );
  const designBody = (
    <>
    {readOnly && <div className="ui-readonly-note" role="note">{plan?.kind === 'none' && !passExpired ? Z.noneReadOnlyDesign : Z.readOnlyDesign}</div>}
    <DesignPanel uiLang={uiLang} settings={activeProfile?.settings ?? { template, fontScale, fontPairing, pageMode, lang }}
      onSettings={patch => {
        if (patch.template) { changeTemplate(patch.template, (nav.list.findIndex(t => t.id === resolveThemeId(patch.template!)) > nav.idx ? 1 : -1)); const { template: _t, ...rest } = patch; void _t; if (Object.keys(rest).length) updateSettings(rest); return; }
        updateSettings(patch);
      }}
      fit={fit} data={currentData} onJump={handlePreviewEdit} renderThumb={renderTemplate} onLoadAts={loadAts} onLoadAtsPdf={loadAtsPdf} />
    </>
  );
  const checkBody = (withTips: boolean) => (
    <CheckPanel uiLang={uiLang} fit={fit} pageMode={pageMode} data={currentData} coverLetter={currentCoverLetter}
      exportConfig={exportConfig} atsLevel={atsLevel} onJump={handlePreviewEdit} onLoadAts={loadAts} onLoadAtsPdf={loadAtsPdf} withTips={withTips} />
  );
  const exportBody = (
    <div className="ui-panel-body ui-panel-fill">
      <ExportPanel data={currentData} coverLetter={currentCoverLetter} resumeId={activeId} lang={lang} template={theme.name} docType={docType} exportConfig={exportConfig} onPrint={handlePrint} onProfileUpdated={handleProfileUpdated} onReplaceData={(cv) => updateData(() => cv)} onReplaceCoverLetter={(cl) => updateCoverLetter(() => cl)} demoMode={demoMode} onDemoBlock={openUnlock} shareLocked={planLocked} atsLevel={atsLevel} onAtsPdf={exportAtsPdf} onBeforeShare={flushSave} embedded />
    </div>
  );
  const tipsBody = (
    <div className="ui-panel-body ui-panel-fill"><KnowledgePanel /></div>
  );
  const bodyFor = (p: PanelId, mobile: boolean) =>
    p === 'content' ? contentBody : p === 'design' ? designBody : p === 'check' ? checkBody(mobile) : p === 'tips' ? tipsBody : exportBody;

  const exportMenu = (
    <ExportMenu uiLang={uiLang} data={currentData} coverLetter={currentCoverLetter} exportConfig={exportConfig}
      docType={docType} demoMode={demoMode} atsLevel={atsLevel} onPrintFallback={handlePrint} onAtsPdf={exportAtsPdf}
      onOpenAll={() => (isMobile ? setMPanel('export') : setPanel('export'))}
      onShare={() => { if (planLocked) { setUnlock('share'); return; } if (gateAction('Sharelinks')) { if (isMobile) setMPanel('export'); else setPanel('export'); } }} />
  );

  /* Seltenes liegt hinter „⋯": Oberflächensprache, Versionen, Konto, Admin,
   * Abmelden (Gestaltungsbericht, Ebenen der Offenlegung). Am Schreibtisch ein
   * Menü, auf dem Telefon ein Blatt. */
  const moreItems = (close: () => void) => (
    <>
      <div className="ui-menu-label">{et.uiLangLabel}</div>
      {LANG_ORDER.map(l => (
        <MenuItem key={l} checked={uiLang === l} onSelect={() => { handleLangChange(l); close(); }}>
          {LANG_NAMES[l]} <span className="ui-num" style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-3)' }}>{l.toUpperCase()}</span>
        </MenuItem>
      ))}
      <div className="ui-menu-sep" />
      {activeId && !readOnly && <MenuItem onSelect={() => { close(); handleDuplicateProfile(activeId, true); }} sub={F.duplicateSub}>{F.duplicateTitle}</MenuItem>}
      {/* Versionen gibt es seit 08.10.2026 auch ohne Konto (lokaler Verlauf). */}
      {activeId && <MenuItem onSelect={() => { close(); setVersionsOpen(true); }} sub={et.ttVersions}>{et.versions}</MenuItem>}
      {demoMode && <MenuItem onSelect={() => { close(); setBackupOpen(true); }}>{LOCAL_I18N[uiLang].more}</MenuItem>}
      {demoMode && salesOpen(offer) && <MenuItem onSelect={() => { close(); setUnlock('sync'); }} sub={B.productName}>{B.features.sync.title}</MenuItem>}
      {!demoMode && (plan || salesOpen(offer)) && <MenuItem onSelect={() => { close(); setPassOpen(true); }} sub={plan?.kind === 'pass' && plan.until ? formatAccessDate(plan.until, uiLang) : undefined}>{B.mpTitle}</MenuItem>}
      {!demoMode && <MenuItem onSelect={() => { close(); setKeysOpen(true); }} sub={authUser?.username}>{et.account}</MenuItem>}
      {authUser?.role === 'admin' && <MenuItem onSelect={() => { close(); setAdminOpen(true); }}>{et.admin}</MenuItem>}
      {!demoMode && <MenuItem onSelect={() => { close(); void requestLogout(); }}>{et.signOut}</MenuItem>}
      {demoMode && <MenuItem onSelect={() => { close(); setUnlock('account'); }}>{et.createAccount}</MenuItem>}
      <div className="ui-menu-sep" />
      <div className="ui-menu-label">{B.footerLabel}</div>
      {salesOpen(offer) && <MenuItem onSelect={() => { close(); navigate(PATHS.pricing); }}>{B.pricing}</MenuItem>}
      <MenuItem onSelect={() => { close(); navigate(PATHS.terms); }}>{B.terms}</MenuItem>
      <MenuItem onSelect={() => { close(); navigate(PATHS.withdrawalPolicy); }}>{B.withdrawalPolicy}</MenuItem>
      <MenuItem onSelect={() => { close(); navigate(PATHS.withdraw); }}>{B.withdrawLink}</MenuItem>
      <MenuItem onSelect={() => { close(); navigate(PATHS.cancel); }}>{cancelUi(uiLang, offer).buttonCancel}</MenuItem>
      <MenuItem onSelect={() => { close(); navigate(PATHS.imprint); }}>{B.imprint}</MenuItem>
      <MenuItem onSelect={() => { close(); navigate(PATHS.privacy); }}>{B.privacy}</MenuItem>
    </>
  );

  const overlays = (
    <>
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      {keysOpen && (
        <KeysPanel
          onClose={() => setKeysOpen(false)}
          onAccountDeleted={() => {
            // Account is gone server-side, mirror it locally: reset everything
            // including the demo flag, then drop the user back to the landing.
            try {
              ['appstudio-profiles-v2', 'appstudio-active-v2',
               'appstudio-v1', 'appstudio-cl-v1',
               'appstudio-demo-mode',
              ].forEach(k => localStorage.removeItem(k));
            } catch { /* ignore */ }
            // Die lokalen Profile liegen seit 08.10.2026 in IndexedDB.
            void clearLocalStore();
            setKeysOpen(false);
            setAuthUser(null);
            setDemoMode(false);
            setProfiles([]); setActiveId(null);
            setScreen('home'); setDataLoaded(false);
            setShowAuth(false);
          }}
        />
      )}
      {versionsOpen && activeId && (
        <VersionsPanel
          resumeId={activeId}
          local={demoMode}
          onClose={() => setVersionsOpen(false)}
          onRestored={handleProfileUpdated}
          footerNote={demoMode && salesOpen(offer) ? (
            <button type="button" className="ui-btn ui-btn-accent" style={{ minHeight: '36px', whiteSpace: 'normal', textAlign: 'left' }}
              onClick={() => { setVersionsOpen(false); setUnlock('versions'); }}>{B.unlock.versions.title}</button>
          ) : undefined}
        />
      )}
      {backupOpen && <LocalBackupPanel onClose={() => setBackupOpen(false)} onProfilesReplaced={replaceProfiles} />}
      {backupReminder}
      {logoutDialog}
      {noticeEl}
      {atsJob && <AtsPdfRunner job={atsJob} />}
      {langNotice && (
        <div role="status" aria-live="polite" className="ui-toast" style={{ bottom: isMobile ? '168px' : '24px', padding: '11px 16px' }}>{langNotice}</div>
      )}
      {toast && (
        <div role="status" aria-live="polite" className="ui-toast" style={{ bottom: isMobile ? '168px' : '132px' }}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => { toast.undo(); setToast(null); }}>{dsT.undo}</button>
        </div>
      )}
      {unlock && (
        <UnlockPanel feature={unlock} lang={uiLang} offer={offer} onClose={() => setUnlock(null)}
          onSignIn={leaveDemoToAuth} onInviteAccount={leaveDemoToAuth} signedIn={!demoMode && !!authUser} />
      )}
      {passOpen && <PassDialog lang={uiLang} onClose={() => setPassOpen(false)} />}
    </>
  );

  // ── Telefon ───────────────────────────────────────────────────────────────
  if (isMobile) {
    const bar: { id: PanelId; label: string; icon: React.ReactNode; primary?: boolean }[] = [
      { id: 'content', label: dsT.content, icon: <Icon name="pencil" size={19} /> },
      { id: 'design', label: dsT.design, icon: <PanelGlyph kind="design" /> },
      { id: 'check', label: dsT.check, icon: <PanelGlyph kind="check" /> },
      { id: 'export', label: dsT.exportAll, icon: <Icon name="download" size={19} />, primary: true },
    ];
    return (
      <div className="cv-app-shell ui" style={{ display: 'flex', flexDirection: 'column', background: 'var(--canvas)', overflow: 'hidden' }}>
        <header data-noprint className="ui-top" style={{ padding: '10px 10px 6px', gap: '6px' }}>
          <h1 className="cv-sr-only">{activeProfile?.displayName ?? APP_NAME}</h1>
          <button type="button" className="ui-btn ui-pill" onClick={() => setScreen('home')} aria-label={dsT.toProfiles} title={dsT.toProfiles}
            style={{ minHeight: '44px', padding: '0 12px', flexShrink: 0 }}>
            <span className="ui-wordmark ui-wordmark-full" style={{ padding: 0 }}>CV<b>-</b>Hub</span>
            <span className="ui-wordmark ui-wordmark-short" aria-hidden style={{ padding: 0 }}>‹</span>
          </button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>{docSegment}</div>
          <button type="button" className="ui-btn ui-pill ui-icon-btn" onClick={() => setMoreOpen(true)} title={dsT.menu} aria-label={dsT.menu}
            aria-haspopup="dialog" aria-expanded={moreOpen} style={{ minHeight: '44px', width: '44px', fontSize: '19px', flexShrink: 0 }}>⋯</button>
          <span className="cv-sr-only" role="status" aria-live="polite">{saveText}</span>
        </header>
        {accessBanner}
        <ConfirmEmailBanner user={demoMode ? null : authUser} lang={uiLang} />

        <main style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <MobilePreview doneLabel={et.zoomDone} hintLabel={et.tapToWrite} pageFormat={pageFormat} bottomInset={168}
            onSwipe={mPanel === null ? (dir => stepTemplate(dir, true)) : undefined}>
            {previewArea}
          </MobilePreview>
          {mPanel === null && (
            <div data-noprint style={{ position: 'fixed', left: '12px', right: '12px', bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))', zIndex: 280 }}>
              <CarouselBar current={template} onStep={d => stepTemplate(d, true)} uiLang={uiLang} compact />
            </div>
          )}
          {/* Inhalt und Export bleiben im DOM (nur ausgeblendet): Bildlauf,
              offene Karten und Eingaben überleben den Wechsel. */}
          {(['content', 'design', 'check', 'export'] as PanelId[]).map(p => {
            const keep = p === 'content' || p === 'export';
            if (!keep && mPanel !== p) return null;
            return (
              <section key={p} id={`ui-mpanel-${p}`} data-noprint className="ui-mobile-panel" aria-label={panelTitle[p]}
                style={{ display: mPanel === p ? 'flex' : 'none' }}>
                <div className="ui-panel-head" style={{ padding: '12px 8px 8px 18px' }}>
                  <h2 className="ui-panel-title">{panelTitle[p]}</h2>
                  <button type="button" className="ui-btn ui-icon-btn" onClick={() => setMPanel(null)} aria-label={dsT.closePanel} style={{ minHeight: '44px', width: '44px', fontSize: '20px', color: 'var(--ink-2)' }}>×</button>
                </div>
                {bodyFor(p, true)}
              </section>
            );
          })}
        </main>

        <nav data-noprint className="ui-bottom-bar ui-float" aria-label={dsT.railLabel}>
          {bar.map(b => (
            <button key={b.id} type="button" className={b.primary ? 'ui-bottom-primary' : undefined}
              aria-expanded={mPanel === b.id} aria-controls={`ui-mpanel-${b.id}`}
              onClick={() => setMPanel(mPanel === b.id ? null : b.id)}>
              {b.icon}<span>{b.label}</span>
            </button>
          ))}
        </nav>

        {moreOpen && (
          <MobileSheet title={dsT.menu} closeLabel={et.close} onClose={() => setMoreOpen(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {demoMode && (
                <button type="button" className="ui-btn ui-btn-accent" onClick={() => { setMoreOpen(false); setUnlock('account'); }}
                  style={{ minHeight: '48px', marginBottom: '8px', justifyContent: 'center' }}>{dsT.demoPill}</button>
              )}
              <div className="ui-menu-label" style={{ paddingLeft: '4px' }}>{et.docTypeLabel}</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                {(['resume', 'cover-letter'] as DocType[]).map(dt => (
                  <button key={dt} type="button" className="ui-btn ui-btn-soft" aria-pressed={docType === dt}
                    onClick={() => { setDocType(dt); setMoreOpen(false); }}
                    style={{ flex: 1, minHeight: '44px', borderRadius: '12px', fontWeight: docType === dt ? 650 : 500, boxShadow: docType === dt ? '0 0 0 2px var(--accent)' : undefined }}>
                    {{ resume: et.resume, 'cover-letter': et.coverLetter }[dt]}
                  </button>
                ))}
              </div>
              <div role="menu" aria-label={dsT.menu} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {moreItems(() => setMoreOpen(false))}
              </div>
            </div>
          </MobileSheet>
        )}
        {overlays}
      </div>
    );
  }

  // ── Schreibtisch ──────────────────────────────────────────────────────────
  const rail: { id: PanelId; label: string; icon: React.ReactNode }[] = [
    { id: 'content', label: dsT.content, icon: <Icon name="pencil" size={18} /> },
    { id: 'design', label: dsT.design, icon: <PanelGlyph kind="design" /> },
    { id: 'check', label: dsT.check, icon: <PanelGlyph kind="check" /> },
    { id: 'tips', label: dsT.tips, icon: <Icon name="bulb" size={18} /> },
    /* Export als fünfter Eintrag: Import, Teilen und „mit KI bearbeiten"
       stehen nur dort. Allein hinter „▾ → Alle Wege" wären sie versteckt. */
    { id: 'export', label: dsT.exportAll, icon: <Icon name="share" size={18} /> },
  ];
  const panelWidth = panel === 'content' ? 420 : panel === 'tips' ? 380 : 372;

  return (
    <div className="cv-app-shell ui" style={{ display: 'flex', flexDirection: 'column', background: 'var(--canvas)', overflow: 'hidden' }}>
      <header data-noprint className="ui-top">
        <div className="ui-top-group ui-pill">
          <span className="ui-wordmark ui-hide-lg" aria-hidden>CV<b>-</b>Hub</span>
          {/* Der Editor hatte lange gar keine Überschrift — für Screenreader
              war die Seite dadurch ohne Einstieg. */}
          <h1 style={{ margin: 0, fontSize: 'inherit', fontWeight: 'inherit', minWidth: 0 }}>
            <button type="button" className="ui-btn" onClick={() => setScreen('home')} title={dsT.toProfiles}
              aria-label={`${activeProfile?.displayName ?? APP_NAME} – ${dsT.toProfiles}`}
              style={{ maxWidth: '220px', paddingRight: '10px' }}>
              {/* In der Demo trägt die Pille daneben das Wort „Demo"; der
                  Profilname („Demo · Lena Brandt") stünde doppelt und kostete
                  genau den Platz, der „⋯" aus dem Fenster schob. */}
              {!demoMode && <span className="ui-hide-xl" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeProfile?.displayName ?? APP_NAME}</span>}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </h1>
          {demoMode && (
            <button type="button" className="ui-btn ui-btn-accent" onClick={() => setUnlock('account')} title={dsT.demoPillTitle}>
              {dsT.demoPill}
            </button>
          )}
        </div>
        {docSegment}
        <div style={{ flex: 1, minWidth: 0 }} />
        <span className="ui-status" data-state={saveState} title={saveText}>
          <span className="ui-status-dot" aria-hidden />
          <span className="ui-hide-2xl" aria-hidden>{saveText}</span>
        </span>
        <span className="cv-sr-only" role="status" aria-live="polite">{saveText}</span>
        <div className="ui-seg ui-pill" role="group" aria-label={dsT.zoomGroup}>
          <button type="button" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>{dsT.zoomFit}</button>
          <button type="button" aria-pressed={zoom === 1} onClick={() => setZoom(1)} className="ui-num">100 %</button>
          <button type="button" aria-pressed={zoom === 1.25} onClick={() => setZoom(1.25)} className="ui-num ui-hide-xl">125 %</button>
        </div>
        {exportMenu}
        <div style={{ position: 'relative' }}>
          <button ref={moreRef} type="button" className="ui-btn ui-pill ui-icon-btn" onClick={() => setMoreOpen(v => !v)}
            aria-haspopup="menu" aria-expanded={moreOpen} aria-label={dsT.more} title={dsT.more}
            style={{ minHeight: '40px', fontSize: '18px' }}>⋯</button>
          <Menu open={moreOpen} onClose={closeMore} label={dsT.more} triggerRef={moreRef} width={280}>
            {moreItems(closeMore)}
          </Menu>
        </div>
      </header>
      {accessBanner}
      <ConfirmEmailBanner user={demoMode ? null : authUser} lang={uiLang} />

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, padding: '6px 16px 16px', gap: '12px' }}>
        <nav data-noprint className="ui-rail ui-float" aria-label={dsT.railLabel}>
          {rail.map(r => (
            <button key={r.id} type="button" aria-expanded={panel === r.id} aria-controls="ui-panel"
              onClick={() => setPanel(panel === r.id ? null : r.id)}>
              {r.icon}<span>{r.label}</span>
            </button>
          ))}
        </nav>
        {panel && (
          <section id="ui-panel" data-noprint className="ui-panel ui-float" aria-label={panelTitle[panel]}
            style={{ width: `min(${panelWidth}px, 40vw)`, minWidth: '300px', flexShrink: 0 }}>
            <div className="ui-panel-head">
              <h2 className="ui-panel-title">{panelTitle[panel]}</h2>
              {panel === 'design' && <span className="ui-panel-meta" style={{ flex: 1, textAlign: 'right' }}>{dsT.templatesMeta(PICKABLE_THEMES.length, ACCENTS.length - 1)}</span>}
              <button type="button" className="ui-btn ui-icon-btn" onClick={() => setPanel(null)} aria-label={dsT.closePanel} title={dsT.closePanel}
                style={{ color: 'var(--ink-2)', fontSize: '18px' }}>×</button>
            </div>
            {bodyFor(panel, false)}
          </section>
        )}
        <div className="ui-canvas">
          <Canvas zoom={zoom} onZoomFit={onZoomFit} pageFormat={pageFormat} topInset={hintGone ? 0 : 30} bottomInset={124}
            swapKey={swap.key} swapDir={swap.dir} escHint={dsT.escBack}
            topHint={!hintGone && docType === 'resume' ? (
            <div className="ui-write-hint ui-pill" data-noprint>
              <Icon name="pencil" size={13} />
              <span>{dsT.writeHint}</span>
              <button type="button" className="ui-btn ui-icon-btn" aria-label={dsT.dismiss} title={dsT.dismiss}
                onClick={() => { setHintGone(true); try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ } }}
                style={{ minHeight: '28px', width: '28px', minWidth: '28px', color: 'var(--ink-2)' }}>×</button>
            </div>
            ) : undefined}
            neighbours={scale => (
              <CarouselNeighbours scale={scale} pageFormat={pageFormat} prevId={nav.prevId} nextId={nav.nextId}
                renderTemplate={renderTemplate} uiLang={uiLang} onPick={(id, dir) => changeTemplate(id, dir)} />
            )}>
            {previewArea}
          </Canvas>
          <div data-noprint style={{ position: 'absolute', left: '12px', right: '12px', bottom: '4px', zIndex: 30, pointerEvents: 'none' }}>
            <div style={{ pointerEvents: 'auto' }}>
              <CarouselBar current={template} onStep={d => stepTemplate(d)} uiLang={uiLang} onLoadAts={docType === 'resume' ? loadAts : undefined} onLoadAtsPdf={docType === 'resume' ? loadAtsPdf : undefined} />
            </div>
          </div>
        </div>
      </main>
      {overlays}
    </div>
  );
}

// ── Kleinteile ──────────────────────────────────────────────────────────────

/** Symbole für Gestaltung und Prüfen — im Stil von `ui/Icon` (1,6 px Strich). */
function PanelGlyph({ kind }: { kind: 'design' | 'check' }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {kind === 'design'
        ? <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M10 9v12" /></>
        : <><path d="M12 3 5 6v5c0 4.4 3 8.3 7 10 4-1.7 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>}
    </svg>
  );
}
