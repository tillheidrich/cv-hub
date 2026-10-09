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
import DesignPanel from './ui/DesignPanel';
import CheckPanel from './ui/CheckPanel';
import ExportMenu from './ui/ExportMenu';
import { Menu, MenuItem, MobileSheet } from './ui/Overlay';
import BackupReminder, { LocalBackupPanel } from './ui/BackupReminder';
import AdminPanel from './screens/AdminPanel';
import KeysPanel from './screens/KeysPanel';
import VersionsPanel from './screens/VersionsPanel';
import { api } from './data/api';
import type { AuthUser } from './data/api';
import { track } from './data/track';
import {
  getActiveProfileId, setActiveProfileId,
  updateProfileInList, deleteProfileFromList,
  saveProfiles as saveProfilesLocal, loadProfiles as loadProfilesLocal,
  loadProfilesAsync as loadProfilesLocalAsync,
  createDemoProfile, withAllLangs, carryContactToLang,
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
  const [softWall, setSoftWall] = useState<string | null>(null);
  /** When true, render AuthScreen instead of LandingScreen. Toggled by the
   *  "Anmelden" button on the landing page — or automatisch bei ?invite=. */
  const [showAuth, setShowAuth] = useState(!!initialInvite);
  const [uiLang, setUiLangState] = useState<UiLang>(() => detectInitialUiLang());
  function handleLangChange(l: UiLang) { setUiLang(l); setUiLangState(l); }
  const [adminOpen, setAdminOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
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
    if (demoMode) { setSoftWall(reason); return false; }
    return true;
  }

  async function handleLogout() {
    try { await api.logout(); } catch { /* ignore */ }
    // Wipe every local artifact so the next login on this browser starts clean.
    try {
      [
        'appstudio-profiles-v2', 'appstudio-active-v2',
        'appstudio-v1', 'appstudio-cl-v1',
      ].forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
    setAuthUser(null);
    setProfiles([]); setActiveId(null); setScreen('home'); setDataLoaded(false);
  }

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

  const queueSave = useCallback((profile: AppProfile) => {
    dirtyRef.current = profile;
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const p = dirtyRef.current;
      if (!p) return;
      if (demoMode) {
        // localStorage-only save in demo mode — never hits the server.
        try {
          const all = loadProfilesLocal();
          const next = all.find(x => x.id === p.id) ? all.map(x => x.id === p.id ? p : x) : [...all, p];
          setSaveStatus(saveProfilesLocal(next) ? 'saved' : 'error');
        } catch { setSaveStatus('error'); }
        return;
      }
      api.saveResume(p).then(() => setSaveStatus('saved')).catch(() => setSaveStatus('error'));
    }, 900);
  }, [setSaveStatus, demoMode]);

  function patchProfile(updater: (p: AppProfile) => AppProfile) {
    if (!activeId) return;
    setProfiles(prev => updateProfileInList(prev, activeId, updater));
  }
  const updateData = useCallback((updater: (d: CVData) => CVData) => {
    if (!activeId) return;
    setProfiles(prev => updateProfileInList(prev, activeId, p0 => {
      const p = p0.data[p0.settings.lang] ? p0 : withAllLangs(p0);
      return { ...p, data: { ...p.data, [p.settings.lang]: updater(p.data[p.settings.lang]) } };
    }));
  }, [activeId]);
  const updateCoverLetter = useCallback((updater: (d: CoverLetterData) => CoverLetterData) => {
    if (!activeId) return;
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
    const active = profiles.find(p => p.id === activeId);
    if (active) queueMicrotask(() => queueSave(active));
  }, [profiles, activeId, dataLoaded, queueSave]);

  function handleSelectProfile(id: string) { setActiveId(id); setActiveProfileId(id); setScreen('editor'); openEditorPanels('existing'); }
  function handleCreateProfile(profile: AppProfile) {
    setProfiles(prev => [...prev, profile]);
    if (demoMode) {
      try {
        const all = loadProfilesLocal();
        saveProfilesLocal([...all, profile]);
      } catch { /* ignore */ }
    } else {
      api.saveResume(profile).catch(err => console.error('create failed:', err));
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
      try { saveProfilesLocal(rest); } catch { /* ignore */ }
    } else {
      api.deleteResume(id).catch(err => console.error('delete failed:', err));
    }
    if (activeId === id) { setActiveId(rest[0]?.id ?? null); if (rest.length === 0) setScreen('home'); }
  }

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
  const inlineEdit = inlineEditApi;

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
    void exportDocx(currentData, exportConfig, 'ats');
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
      return <AuthScreen onAuth={setAuthUser} onDemoStart={startDemo} lang={uiLang} onLangChange={handleLangChange}
                         initialInvite={initialInvite} initialMode={initialInvite ? 'register' : 'login'} />;
    }
    return <LandingScreen onSignIn={() => setShowAuth(true)} onDemoStart={startDemo} lang={uiLang} onLangChange={handleLangChange} onLegal={(p) => setScreen(p)} />;
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

  // ── Home ──────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <>
        <HomeScreen profiles={profiles} onSelect={handleSelectProfile} onCreate={handleCreateProfile} onDelete={handleDeleteProfile}
          username={authUser?.username} isAdmin={authUser?.role === 'admin'} onLogout={demoMode ? undefined : handleLogout} onOpenAdmin={() => setAdminOpen(true)}
          onOpenBackup={demoMode ? () => setBackupOpen(true) : undefined} />
        {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
        {backupReminder}
        {backupOpen && <LocalBackupPanel onClose={() => setBackupOpen(false)} onProfilesReplaced={replaceProfiles} />}
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

  const saveText = saveStatus === 'error' ? et.unsaved : saveStatus === 'saving' ? et.saving : (demoMode ? dsT.savedLocal : et.saved);
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

  const contentBody = (
    <>
      {docLangRow}
      <div className="ui-panel-fill" style={{ flex: 1, minHeight: 0 }}>
        {docType === 'resume'
          ? <EditorPanel data={currentData} lang={lang} uiLang={uiLang} onUpdate={updateData} demoMode={demoMode} jumpTab={editJumpTab} jumpTick={editJumpTick} />
          : <CoverLetterEditor data={currentCoverLetter} uiLang={uiLang} onUpdate={updateCoverLetter} resumeId={activeId} />}
      </div>
    </>
  );
  const designBody = (
    <DesignPanel uiLang={uiLang} settings={activeProfile?.settings ?? { template, fontScale, fontPairing, pageMode, lang }}
      onSettings={patch => {
        if (patch.template) { changeTemplate(patch.template, (nav.list.findIndex(t => t.id === resolveThemeId(patch.template!)) > nav.idx ? 1 : -1)); const { template: _t, ...rest } = patch; void _t; if (Object.keys(rest).length) updateSettings(rest); return; }
        updateSettings(patch);
      }}
      fit={fit} data={currentData} onJump={handlePreviewEdit} renderThumb={renderTemplate} onLoadAts={loadAts} />
  );
  const checkBody = (withTips: boolean) => (
    <CheckPanel uiLang={uiLang} fit={fit} pageMode={pageMode} data={currentData} coverLetter={currentCoverLetter}
      exportConfig={exportConfig} atsLevel={atsLevel} onJump={handlePreviewEdit} onLoadAts={loadAts} withTips={withTips} />
  );
  const exportBody = (
    <div className="ui-panel-body ui-panel-fill">
      <ExportPanel data={currentData} coverLetter={currentCoverLetter} resumeId={activeId} lang={lang} template={theme.name} docType={docType} exportConfig={exportConfig} onPrint={handlePrint} onProfileUpdated={handleProfileUpdated} onReplaceData={(cv) => updateData(() => cv)} onReplaceCoverLetter={(cl) => updateCoverLetter(() => cl)} demoMode={demoMode} onDemoBlock={setSoftWall} atsLevel={atsLevel} embedded />
    </div>
  );
  const tipsBody = (
    <div className="ui-panel-body ui-panel-fill"><KnowledgePanel /></div>
  );
  const bodyFor = (p: PanelId, mobile: boolean) =>
    p === 'content' ? contentBody : p === 'design' ? designBody : p === 'check' ? checkBody(mobile) : p === 'tips' ? tipsBody : exportBody;

  const exportMenu = (
    <ExportMenu uiLang={uiLang} data={currentData} coverLetter={currentCoverLetter} exportConfig={exportConfig}
      docType={docType} demoMode={demoMode} atsLevel={atsLevel} onPrintFallback={handlePrint}
      onOpenAll={() => (isMobile ? setMPanel('export') : setPanel('export'))}
      onShare={() => { if (gateAction('Sharelinks')) { if (isMobile) setMPanel('export'); else setPanel('export'); } }} />
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
      {activeId && <MenuItem onSelect={() => { close(); if (gateAction('Versionen')) setVersionsOpen(true); }} sub={et.ttVersions}>{et.versions}</MenuItem>}
      {demoMode && <MenuItem onSelect={() => { close(); setBackupOpen(true); }}>{LOCAL_I18N[uiLang].more}</MenuItem>}
      {!demoMode && <MenuItem onSelect={() => { close(); setKeysOpen(true); }} sub={authUser?.username}>{et.account}</MenuItem>}
      {authUser?.role === 'admin' && <MenuItem onSelect={() => { close(); setAdminOpen(true); }}>{et.admin}</MenuItem>}
      {!demoMode && <MenuItem onSelect={() => { close(); handleLogout(); }}>{et.signOut}</MenuItem>}
      {demoMode && <MenuItem onSelect={() => { close(); exitDemo(); }}>{et.createAccount}</MenuItem>}
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
          onClose={() => setVersionsOpen(false)}
          onRestored={handleProfileUpdated}
        />
      )}
      {backupOpen && <LocalBackupPanel onClose={() => setBackupOpen(false)} onProfilesReplaced={replaceProfiles} />}
      {backupReminder}
      {langNotice && (
        <div role="status" aria-live="polite" className="ui-toast" style={{ bottom: isMobile ? '168px' : '24px', padding: '11px 16px' }}>{langNotice}</div>
      )}
      {toast && (
        <div role="status" aria-live="polite" className="ui-toast" style={{ bottom: isMobile ? '168px' : '132px' }}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => { toast.undo(); setToast(null); }}>{dsT.undo}</button>
        </div>
      )}
      {softWall && (
        <div onClick={() => setSoftWall(null)} className="ui" style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'oklch(0.21 0.021 264 / 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div role="dialog" aria-modal="true" aria-label={`${et.swTitle} ${et.swTitleAccent}`} onClick={(e) => e.stopPropagation()} className="ui-float"
            style={{ background: 'var(--float-solid)', width: '100%', maxWidth: '460px', padding: '28px 30px' }}>
            <div style={{ fontSize: 'var(--t-xs)', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '8px' }}>{et.swLimit}</div>
            <div style={{ fontSize: '24px', fontWeight: 620, color: 'var(--ink)', lineHeight: 1.15, marginBottom: '12px', letterSpacing: '-0.015em' }}>
              {et.swTitle} <span style={{ color: 'var(--accent-ink)' }}>{et.swTitleAccent}</span>
            </div>
            <div style={{ fontSize: 'var(--t-sm)', color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: '20px' }}>
              {et.swBody}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="ui-btn ui-btn-soft" onClick={() => setSoftWall(null)} style={{ minHeight: '44px' }}>{et.swStay}</button>
              <button type="button" className="ui-btn ui-btn-primary" onClick={() => { setSoftWall(null); exitDemo(); }} style={{ minHeight: '44px' }}>{et.createAccount}</button>
            </div>
          </div>
        </div>
      )}
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
                <button type="button" className="ui-btn ui-btn-accent" onClick={() => { setMoreOpen(false); exitDemo(); }}
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
            <button type="button" className="ui-btn ui-btn-accent" onClick={exitDemo} title={dsT.demoPillTitle}>
              {dsT.demoPill}
            </button>
          )}
        </div>
        {docSegment}
        <div style={{ flex: 1, minWidth: 0 }} />
        <span className="ui-status" data-state={saveStatus} title={saveText}>
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
              <CarouselBar current={template} onStep={d => stepTemplate(d)} uiLang={uiLang} onLoadAts={docType === 'resume' ? loadAts : undefined} />
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
