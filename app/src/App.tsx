import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ResumeRenderer from './templates/ResumeRenderer';
import CoverLetterRenderer from './templates/CoverLetterRenderer';
import DocumentPreview from './preview/DocumentPreview';
import { THEMES, getTheme, resolvePairing, FONT_PAIRING_LIST } from './templates/theme';
import EditorPanel from './editor/EditorPanel';
import CoverLetterEditor from './editor/CoverLetterEditor';
import ExportPanel from './export/ExportPanel';
import HomeScreen from './screens/HomeScreen';
import KnowledgePanel from './knowledge/KnowledgePanel';
import AuthScreen from './screens/AuthScreen';
import LandingScreen from './screens/LandingScreen';
import { ImpressumPage, PrivacyPage } from './screens/LegalPages';
import { atsLevelForLayout, atsLabelDe, atsColors } from './templates/atsScore';
import { detectInitialUiLang, setUiLang, type UiLang } from './ui/i18n';
import { ET } from './ui/editorI18n';
import AdminPanel from './screens/AdminPanel';
import KeysPanel from './screens/KeysPanel';
import VersionsPanel from './screens/VersionsPanel';
import { api } from './data/api';
import type { AuthUser } from './data/api';
import {
  getActiveProfileId, setActiveProfileId,
  updateProfileInList, deleteProfileFromList,
  saveProfiles as saveProfilesLocal, loadProfiles as loadProfilesLocal,
  createDemoProfile, withAllLangs,
} from './data/storage';
import { ALL_LANGS, LANG_NAMES } from './data/labels';
import type { CVData, CoverLetterData, AppProfile, Lang, TemplateName, FontPairingId, PageMode, SectionKey, PageFormat } from './data/types';
import { DEFAULT_SECTION_ORDER } from './data/types';
import { PAGE_FORMAT_LIST } from './data/pageFormats';

type Mode = 'edit' | 'preview' | 'export' | 'knowledge';
type DocType = 'resume' | 'cover-letter';
type Screen = 'home' | 'editor' | 'impressum' | 'privacy';

const UI_FONT = "'Inter', sans-serif";
const SERIF_FONT = "'Space Grotesk', serif";

interface FitInfo { pages: number; density: number; shrunk: boolean }

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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 860);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 860);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ── Template picker ───────────────────────────────────────────────────────────

const CAT_LABELS: Record<string, string> = {
  klassisch: 'Klassisch', modern: 'Modern', kreativ: 'Kreativ', minimal: 'Minimal',
};

function TemplatePicker({ current, onChange, isMobile }: { current: TemplateName; onChange: (t: TemplateName) => void; isMobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const cur = getTheme(current);
  const cats: string[] = ['klassisch', 'modern', 'kreativ', 'minimal'];

  // On mobile, the dropdown anchored to a header button would overflow the
  // viewport, so we render it as a bottom sheet instead.
  const dropdownStyle: React.CSSProperties = isMobile
    ? {
        position: 'fixed', left: '12px', right: '12px', bottom: '16px',
        top: 'auto', zIndex: 300,
        background: '#fff', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '14px',
        boxShadow: '0 -12px 36px rgba(0,0,0,0.18)',
        padding: '12px', maxHeight: '72vh', overflowY: 'auto',
      }
    : {
        position: 'absolute', top: 'calc(100% + 6px)', right: 0,
        zIndex: 300, background: '#fff', border: '1px solid oklch(0.91 0.005 264)',
        borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,0.16)',
        padding: '8px', width: '300px', maxHeight: '460px', overflowY: 'auto',
      };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 10px', background: '#fff', border: '1px solid oklch(0.85 0.008 264)', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#2a2a2a', fontFamily: UI_FONT, whiteSpace: 'nowrap' }}>
        <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: cur.colors.accent, flexShrink: 0 }} />
        <span>{cur.name}</span>
        <span style={{ fontSize: '9px', color: '#999' }}>▾</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 290, background: isMobile ? 'rgba(28,25,23,0.35)' : 'transparent' }} onClick={() => setOpen(false)} />
          <div style={dropdownStyle}>
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 10px', borderBottom: '1px solid oklch(0.91 0.005 264)', marginBottom: '6px' }}>
                <span style={{ fontFamily: SERIF_FONT, fontSize: '16px', fontWeight: 600, color: 'oklch(0.21 0.021 264)' }}>Vorlage wählen</span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: '20px', color: '#aaa', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            )}
            {cats.map(cat => (
              <div key={cat}>
                <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#b0a896', padding: '8px 8px 4px' }}>{CAT_LABELS[cat]}</div>
                {THEMES.filter(t => t.category === cat).map(t => (
                  <button key={t.id} type="button" onClick={() => { onChange(t.id); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', background: t.id === current ? 'oklch(0.985 0.003 264)' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', marginBottom: '2px' }}>
                    <span style={{ display: 'flex', flexShrink: 0, borderRadius: '5px', overflow: 'hidden', border: '1px solid oklch(0.91 0.005 264)' }}>
                      <span style={{ width: '13px', height: '26px', background: t.colors.panelBg }} />
                      <span style={{ width: '13px', height: '26px', background: t.colors.accent }} />
                      <span style={{ width: '8px', height: '26px', background: t.colors.pageBg }} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'oklch(0.21 0.021 264)', fontFamily: UI_FONT }}>{t.name}</span>
                      <span style={{ display: 'block', fontSize: '10.5px', color: 'oklch(0.44 0.017 264)', fontFamily: UI_FONT }}>{t.description}</span>
                    </span>
                    {(() => {
                      const lv = atsLevelForLayout(t.layout);
                      const col = atsColors(lv);
                      return (
                        <span title={lv === 'high' ? 'ATS parst diese Struktur zuverlässig' : lv === 'medium' ? 'Funktioniert in den meisten ATS' : 'Sidebar-Layout — manche ATS-Parser verwirren das'}
                          style={{
                            background: col.bg, color: col.ink, border: `1px solid ${col.border}`,
                            fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em',
                            padding: '2px 6px', borderRadius: '3px',
                            fontFamily: UI_FONT, whiteSpace: 'nowrap',
                          }}>
                          {atsLabelDe(lv)}
                        </span>
                      );
                    })()}
                    {t.id === current && <span style={{ color: 'oklch(0.55 0.216 264)', fontSize: '13px' }}>✓</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Settings panel: font size + pairing + page mode ──────────────────────────

const SECTION_LABELS: Record<SectionKey, string> = {
  profile:     'Profil',
  details:     'Eckdaten',
  experience:  'Berufserfahrung',
  education:   'Ausbildung',
  skills:      'Skills',
  languages:   'Sprachen',
  additional:  'Weiteres',
};

function SettingsPanel({ fontScale, onFontScale, fontPairing, onFontPairing, pageMode, onPageMode, pageFormat, onPageFormat, sectionOrder, hiddenSections, sectionPages, respectTemplateStructure, onSectionOrder, onToggleSection, onSectionPage, onRespectTemplateStructure, fit, onClose }: {
  fontScale: number; onFontScale: (s: number) => void;
  fontPairing: FontPairingId; onFontPairing: (p: FontPairingId) => void;
  pageMode: PageMode; onPageMode: (p: PageMode) => void;
  pageFormat: PageFormat; onPageFormat: (f: PageFormat) => void;
  sectionOrder: SectionKey[]; hiddenSections: SectionKey[];
  sectionPages: Partial<Record<SectionKey, number>>;
  respectTemplateStructure: boolean;
  onSectionOrder: (next: SectionKey[]) => void;
  onToggleSection: (key: SectionKey) => void;
  /** Update a single section's manual page assignment. Setting to 1 effectively
   *  unpins (page 1 is the default). */
  onSectionPage: (key: SectionKey, page: number) => void;
  onRespectTemplateStructure: (v: boolean) => void;
  fit: FitInfo | null; onClose: () => void;
}) {
  /** True when the user picked an explicit multi-page mode (2 or 3) — only
   *  then does it make sense to show the per-section page picker. In single
   *  or auto mode there's only one page slot anyway. */
  const showPagePicker = pageMode === 'two' || pageMode === 'three';
  const maxPage = pageMode === 'three' ? 3 : 2;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const heading: React.CSSProperties = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'oklch(0.60 0.012 264)', marginBottom: '9px', fontFamily: UI_FONT };
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 290 }} onClick={onClose} />
      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300, background: '#fff', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,0.16)', padding: '18px', width: '288px' }}>
        {/* Font size slider */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '9px' }}>
            <span style={heading}>Schriftgröße</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', fontFamily: UI_FONT }}>{Math.round(fontScale * 100)}%</span>
          </div>
          <input type="range" min={0.8} max={1.25} step={0.01} value={fontScale}
            onChange={e => onFontScale(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'oklch(0.55 0.216 264)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#b3aa98', marginTop: '2px', fontFamily: UI_FONT }}>
            <span>Kompakt</span><span>Standard</span><span>Groß</span>
          </div>
        </div>

        {/* Font pairing */}
        <div style={{ marginBottom: '18px' }}>
          <div style={heading}>Schriftart</div>
          <select value={fontPairing} onChange={e => onFontPairing(e.target.value as FontPairingId)}
            style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px', color: 'oklch(0.21 0.021 264)', border: '1px solid oklch(0.85 0.008 264)', borderRadius: '7px', background: '#fff', fontFamily: UI_FONT, cursor: 'pointer' }}>
            {FONT_PAIRING_LIST.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.note}</option>
            ))}
          </select>
        </div>

        {/* Page format */}
        <div style={{ marginBottom: '18px' }}>
          <div style={heading}>Format</div>
          <select value={pageFormat} onChange={e => onPageFormat(e.target.value as PageFormat)}
            style={{ width: '100%', padding: '8px 10px', fontSize: '12.5px', color: 'oklch(0.21 0.021 264)', border: '1px solid oklch(0.85 0.008 264)', borderRadius: '7px', background: '#fff', fontFamily: UI_FONT, cursor: 'pointer' }}>
            {PAGE_FORMAT_LIST.map(f => (
              <option key={f.id} value={f.id}>{f.label} ({f.widthMm}×{f.heightMm} mm) — {f.hint}</option>
            ))}
          </select>
        </div>

        {/* Page mode */}
        <div>
          <div style={heading}>Seitenlänge</div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {([['one', '1'], ['two', '2'], ['three', '3'], ['auto', 'Auto']] as [PageMode, string][]).map(([v, l]) => (
              <button key={v} type="button" onClick={() => onPageMode(v)}
                title={v === 'one' ? '1 Seite — passt alles auf eine A4' : v === 'two' ? '2 Seiten — typischer 2-Seiter' : v === 'three' ? '3 Seiten — ausführlich, z.B. wissenschaftlicher CV' : 'Auto — wächst mit dem Inhalt'}
                style={{ flex: v === 'auto' ? 1.4 : 1, padding: '8px 4px', background: pageMode === v ? 'oklch(0.21 0.021 264)' : 'oklch(0.968 0.004 264)', color: pageMode === v ? '#fff' : '#555', border: 'none', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT }}>
                {l}
              </button>
            ))}
          </div>
          {fit && (
            <div style={{ fontSize: '10.5px', color: fit.shrunk ? '#9b6a2e' : '#9a9a9a', marginTop: '9px', lineHeight: 1.5, fontFamily: UI_FONT }}>
              {fit.shrunk
                ? `Inhalt automatisch auf ${fit.pages === 1 ? 'eine Seite' : `${fit.pages} Seiten`} verkleinert (${Math.round(fit.density / fontScale * 100)}%).`
                : `Passt auf ${fit.pages === 1 ? 'eine Seite' : `${fit.pages} Seiten`}.`}
            </div>
          )}
        </div>

        {/* Section order + visibility */}
        <div style={{ marginTop: '20px', borderTop: '1px solid oklch(0.91 0.005 264)', paddingTop: '16px' }}>
          <div style={heading}>Sektionen</div>

          {/* Struktur-vom-Design-übernehmen Toggle */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', cursor: 'pointer', fontFamily: UI_FONT }}>
            <input
              type="checkbox"
              checked={respectTemplateStructure}
              onChange={e => onRespectTemplateStructure(e.target.checked)}
              style={{ marginTop: '2px', cursor: 'pointer', accentColor: 'oklch(0.21 0.021 264)' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'oklch(0.21 0.021 264)', lineHeight: 1.35 }}>
                Struktur vom Design übernehmen
              </div>
              <div style={{ fontSize: '10.5px', color: 'oklch(0.44 0.017 264)', marginTop: '3px', lineHeight: 1.45 }}>
                Beim Vorlagen-Wechsel wird die ideale Reihenfolge des neuen Designs gezeigt.
                Aus = deine eigene Reihenfolge bleibt erhalten.
              </div>
            </div>
          </label>

          <div style={{ fontSize: '10.5px', color: 'oklch(0.44 0.017 264)', marginBottom: '8px', fontFamily: UI_FONT, lineHeight: 1.45 }}>
            ⋮⋮ ziehen reordert die Sektionen. Bei Sidebar-Vorlagen (Oslo, Patterson, Azurill…) leben Skills/Sprachen/Eckdaten in der Seitenleiste — Reorder gilt dort für die Haupt-Spalte.
          </div>
          {sectionOrder.map((key, idx) => {
            const hidden = hiddenSections.includes(key);
            const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;
            // Pattern from the working ExperienceEditor drag: outer container
            // is the drop target, an inner ⋮⋮ handle is the drag source.
            // Splitting the two stops the browser from cancelling the drag
            // when a sibling re-renders, and keeps the toggle button clickable.
            return (
              <div
                key={key}
                onDragOver={e => { if (dragIdx !== null) { e.preventDefault(); setDragOverIdx(idx); } }}
                onDragLeave={() => { if (dragOverIdx === idx) setDragOverIdx(null); }}
                onDrop={e => {
                  e.preventDefault();
                  if (dragIdx !== null && dragIdx !== idx) {
                    const next = [...sectionOrder];
                    const [m] = next.splice(dragIdx, 1);
                    next.splice(idx, 0, m);
                    onSectionOrder(next);
                  }
                  setDragIdx(null); setDragOverIdx(null);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '7px 9px', marginBottom: '4px',
                  background: dragIdx === idx ? 'oklch(0.985 0.003 264)' : 'oklch(0.985 0.003 264)',
                  border: '1px solid oklch(0.91 0.005 264)',
                  borderTop: isDragOver ? '2px solid oklch(0.55 0.216 264)' : '1px solid oklch(0.91 0.005 264)',
                  borderRadius: '6px',
                  fontFamily: UI_FONT,
                  opacity: hidden ? 0.55 : (dragIdx === idx ? 0.5 : 1),
                  transition: 'background 120ms, border-color 120ms, opacity 120ms',
                }}
              >
                <span
                  draggable
                  onDragStart={e => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  title="Zum Sortieren ziehen"
                  style={{
                    color: '#999', userSelect: 'none', cursor: 'grab',
                    padding: '0 4px', fontSize: '14px', lineHeight: 1,
                  }}
                >⋮⋮</span>
                <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'oklch(0.21 0.021 264)' }}>
                  {SECTION_LABELS[key]}
                </span>
                {showPagePicker && !hidden && (
                  <select
                    value={sectionPages[key] ?? 1}
                    onChange={(e) => { e.stopPropagation(); onSectionPage(key, parseInt(e.target.value, 10) || 1); }}
                    onClick={(e) => e.stopPropagation()}
                    title="Auf welcher Seite soll diese Sektion erscheinen?"
                    style={{
                      border: '1px solid oklch(0.87 0.006 264)', borderRadius: '4px',
                      padding: '2px 6px', fontSize: '10.5px', fontWeight: 600,
                      color: 'oklch(0.44 0.017 264)', background: '#ffffff', fontFamily: UI_FONT,
                      marginRight: '6px', cursor: 'pointer',
                    }}
                  >
                    {Array.from({ length: maxPage }, (_, i) => (
                      <option key={i + 1} value={i + 1}>S. {i + 1}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleSection(key); }}
                  title={hidden ? 'Wieder einblenden' : 'Ausblenden'}
                  style={{
                    background: 'transparent', border: '1px solid oklch(0.87 0.006 264)',
                    borderRadius: '4px', padding: '2px 8px',
                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
                    color: hidden ? 'oklch(0.55 0.216 264)' : '#888', cursor: 'pointer',
                    fontFamily: UI_FONT, textTransform: 'uppercase',
                  }}
                >
                  {hidden ? 'AUS' : 'AN'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [dataLoaded, setDataLoaded] = useState(false);

  const activeProfile = profiles.find(p => p.id === activeId) ?? null;

  const [mode, setMode] = useState<Mode>('edit');
  const [docType, setDocType] = useState<DocType>('resume');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [printing, setPrinting] = useState(false);
  const [fit, setFit] = useState<FitInfo | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  // Demo mode = no server, localStorage-only. Activated from AuthScreen by
  // "Direkt ausprobieren" and persisted across reloads so refresh doesn't
  // bounce the user back to auth.
  const [demoMode, setDemoMode] = useState<boolean>(() => {
    try { return localStorage.getItem('appstudio-demo-mode') === '1'; } catch { return false; }
  });
  const [softWall, setSoftWall] = useState<string | null>(null);
  /** When true, render AuthScreen instead of LandingScreen. Toggled by the
   *  "Anmelden" button on the landing page. */
  const [showAuth, setShowAuth] = useState(false);
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
    // On mobile the preview lives behind a tab switcher — pull the user
    // into the edit tab so they actually see their jump land somewhere.
    if (isMobile) setMode('edit');
  }, [isMobile]);

  useEffect(() => {
    api.me().then(d => setAuthUser(d.user)).catch(() => setAuthUser(null)).finally(() => setAuthLoading(false));
  }, []);

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

  function startDemo() {
    try { localStorage.setItem('appstudio-demo-mode', '1'); } catch { /* ignore */ }
    setDemoMode(true);
    // Seed a Lena-Brandt demo profile if there isn't one yet. The demo opens
    // in the user's detected UI language so EN visitors see the EN CV directly.
    const existing = loadProfilesLocal();
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
        if (remembered && loaded.find(p => p.id === remembered)) { setActiveId(remembered); setScreen('editor'); }
        else if (loaded.length === 1) { setActiveId(loaded[0].id); setScreen('editor'); }
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
  const template = activeProfile?.settings.template ?? 'hamburg';
  const fontScale = activeProfile?.settings.fontScale ?? 1.0;
  const fontPairing: FontPairingId = activeProfile?.settings.fontPairing ?? 'auto';
  const pageMode: PageMode = activeProfile?.settings.pageMode ?? 'one';
  const pageFormat: PageFormat = activeProfile?.settings.pageFormat ?? 'a4';

  const theme = getTheme(template);
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
          saveProfilesLocal(next);
          setSaveStatus('saved');
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

  function handleSelectProfile(id: string) { setActiveId(id); setActiveProfileId(id); setScreen('editor'); setMode('edit'); }
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
    setActiveId(profile.id); setActiveProfileId(profile.id); setScreen('editor'); setMode('edit');
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
  const renderDoc = useCallback((d: number, pages: number, measure: boolean) => (
    docType === 'cover-letter'
      ? <CoverLetterRenderer cvData={currentData} clData={currentCoverLetter} theme={theme} pairing={pairing} density={d} pages={pages} measure={measure} pageFormat={pageFormat} />
      : <ResumeRenderer data={currentData} theme={theme} pairing={pairing} density={d} pages={pages} measure={measure} hiddenSections={hiddenSections} sectionOrder={sectionOrder} pageFormat={pageFormat} sectionPages={sectionPages} />
  ), [docType, currentData, currentCoverLetter, theme, pairing, hiddenSections, sectionOrder, pageFormat, sectionPages]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const topBarStyle: React.CSSProperties = {
    height: '56px', background: 'oklch(0.985 0.003 264)', borderBottom: '1px solid oklch(0.85 0.008 264)',
    display: 'flex', alignItems: 'center',
    padding: isMobile ? '0 12px' : '0 20px',
    gap: isMobile ? '8px' : '14px',
    flexShrink: 0, zIndex: 200, position: 'relative',
    /* Header items overflow on narrow phones — let it scroll horizontally
       rather than wrapping (which would break the height). The mobile
       bottom tab-bar handles the most-used switches anyway. */
    overflowX: isMobile ? 'auto' : 'visible',
    overflowY: 'visible',
    scrollbarWidth: 'none',
  };
  // Editorial mode tab: caps + tracking, underline-on-active, no fill.
  const modeTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 2px', background: 'transparent',
    color: active ? 'oklch(0.21 0.021 264)' : 'oklch(0.44 0.017 264)',
    border: 'none',
    borderBottom: active ? '2px solid oklch(0.21 0.021 264)' : '2px solid transparent',
    fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
    cursor: 'pointer', fontFamily: UI_FONT,
    transition: 'color 120ms, border-color 120ms',
  });
  const langBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 6px', background: 'transparent',
    color: active ? 'oklch(0.21 0.021 264)' : 'oklch(0.44 0.017 264)',
    border: 'none',
    borderBottom: active ? '1.5px solid oklch(0.21 0.021 264)' : '1.5px solid transparent',
    fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em',
    cursor: 'pointer', fontFamily: UI_FONT,
  });
  const mobileModeStyle = (active: boolean): React.CSSProperties => ({ flex: 1, padding: '10px 0', background: active ? 'oklch(0.21 0.021 264)' : '#fff', color: active ? '#fff' : '#666', border: 'none', borderTop: active ? '2px solid oklch(0.21 0.021 264)' : '2px solid transparent', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' });

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.985 0.003 264)', fontFamily: UI_FONT, fontSize: '13px', color: 'oklch(0.60 0.012 264)' }}>
        CV-Hub wird geladen…
      </div>
    );
  }
  // Legal-Pages sind public und werden VOR der Auth-Verzweigung geroutet,
  // damit ein Footer-Link auch ohne Login erreichbar ist.
  if (screen === 'impressum') return <ImpressumPage onBack={() => setScreen('home')} lang={uiLang} />;
  if (screen === 'privacy') return <PrivacyPage onBack={() => setScreen('home')} lang={uiLang} />;

  if (!authUser && !demoMode) {
    if (showAuth) {
      return <AuthScreen onAuth={setAuthUser} onDemoStart={startDemo} lang={uiLang} onLangChange={handleLangChange} />;
    }
    return <LandingScreen onSignIn={() => setShowAuth(true)} onDemoStart={startDemo} lang={uiLang} onLangChange={handleLangChange} onLegal={(p) => setScreen(p)} />;
  }
  if (!dataLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'oklch(0.985 0.003 264)', fontFamily: UI_FONT, fontSize: '13px', color: 'oklch(0.60 0.012 264)' }}>
        Profile werden geladen…
      </div>
    );
  }

  // ── Home ──────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <>
        <HomeScreen profiles={profiles} onSelect={handleSelectProfile} onCreate={handleCreateProfile} onDelete={handleDeleteProfile} />
        {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      </>
    );
  }

  // ── Print render ──────────────────────────────────────────────────────────
  if (printing) {
    return (
      <div id="print-only-root" style={{ background: 'oklch(0.985 0.003 264)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
        <div data-noprint style={{ fontFamily: UI_FONT, fontSize: '12px', color: '#aaa', marginBottom: '24px' }}>Druckvorschau wird vorbereitet…</div>
        <DocumentPreview render={renderDoc} userScale={fontScale} pageMode={pageMode} pageFormat={pageFormat} />
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  const previewArea = (mobileScale: number) => (
    <div data-noprint style={{ flex: 1, background: 'oklch(0.968 0.004 264)', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: isMobile ? '16px' : '32px', minWidth: 0 }}>
      <DocumentPreview
        render={renderDoc}
        userScale={fontScale}
        pageMode={pageMode}
        pageFormat={pageFormat}
        viewportScale={mobileScale}
        onFit={setFit}
        labels={currentData.labels}
        /* Click-on-preview only applies to the CV (the cover letter has no
           tabbed editor, just one long form). */
        onEdit={docType === 'resume' ? handlePreviewEdit : undefined}
        /* When the user has manually pinned at least one section to a non-1
           page, the renderer emits N .cv-page divs on its own — we tell
           DocumentPreview to skip its slicing in that case. */
        manualPaginated={!!sectionPages && Object.values(sectionPages).some(v => v && v > 1)}
      />
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'oklch(0.985 0.003 264)', overflow: 'hidden' }}>
      <header data-noprint style={topBarStyle}>
        <button type="button" onClick={() => setScreen('home')} title={et.ttHome}
          style={{ padding: '4px 6px', background: 'transparent', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', cursor: 'pointer', color: 'oklch(0.21 0.021 264)', flexShrink: 0, lineHeight: 1 }}>← {et.home}</button>

        <div style={{ fontFamily: SERIF_FONT, fontSize: '17px', fontWeight: 500, color: 'oklch(0.21 0.021 264)', whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '-0.01em' }}>
          {activeProfile?.displayName ?? 'CV-Hub'}
        </div>

        <div style={{ width: '1px', height: '20px', background: 'oklch(0.85 0.008 264)', flexShrink: 0 }} />

        {!isMobile && (
          <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
            {(['edit', 'preview', 'export', 'knowledge'] as Mode[]).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)} style={modeTabStyle(mode === m)}>
                {{ edit: et.edit, preview: et.preview, export: et.export, knowledge: et.tips }[m]}
              </button>
            ))}
          </div>
        )}

        {!isMobile && (
          <>
            <div style={{ width: '1px', height: '20px', background: 'oklch(0.85 0.008 264)', flexShrink: 0 }} />
            <div style={{ display: 'flex', gap: '14px', flexShrink: 0 }}>
              {(['resume', 'cover-letter'] as DocType[]).map(dt => (
                <button key={dt} type="button" onClick={() => setDocType(dt)}
                  style={{
                    padding: '4px 2px', background: 'transparent',
                    color: docType === dt ? 'oklch(0.21 0.021 264)' : 'oklch(0.44 0.017 264)',
                    border: 'none',
                    borderBottom: docType === dt ? '2px solid oklch(0.55 0.216 264)' : '2px solid transparent',
                    fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                    cursor: 'pointer', fontFamily: UI_FONT,
                  }}>
                  {{ resume: et.resume, 'cover-letter': et.coverLetter }[dt]}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />
        {/* Save-status dot — label appears on hover only, so the eye doesn't track it constantly. */}
        <div
          title={saveStatus === 'error' ? et.unsaved : saveStatus === 'saving' ? et.saving : et.saved}
          style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: saveStatus === 'error'
              ? 'oklch(0.470 0.150 28)'
              : saveStatus === 'saving'
              ? 'oklch(0.560 0.060 60)'
              : 'oklch(0.700 0.008 55)',
            flexShrink: 0,
            transition: 'background 320ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />

        <TemplatePicker current={template} onChange={t => updateSettings({ template: t })} isMobile={isMobile} />

        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
          {ALL_LANGS.map(l => (
            <button key={l} type="button" onClick={() => updateSettings({ lang: l })} style={langBtnStyle(lang === l)} title={LANG_NAMES[l]}>{l.toUpperCase()}</button>
          ))}
        </div>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button type="button" onClick={() => setSettingsOpen(v => !v)} title={et.ttFont}
            style={{ padding: '4px 2px', background: 'transparent', border: 'none',
              borderBottom: settingsOpen ? '2px solid oklch(0.21 0.021 264)' : '2px solid transparent',
              fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: settingsOpen ? 'oklch(0.21 0.021 264)' : 'oklch(0.44 0.017 264)', cursor: 'pointer', fontFamily: UI_FONT }}>
            {et.font}
          </button>
          {settingsOpen && (
            <SettingsPanel
              fontScale={fontScale} onFontScale={s => updateSettings({ fontScale: s })}
              fontPairing={fontPairing} onFontPairing={p => updateSettings({ fontPairing: p })}
              pageMode={pageMode} onPageMode={p => updateSettings({ pageMode: p })}
              pageFormat={pageFormat} onPageFormat={f => updateSettings({ pageFormat: f })}
              sectionOrder={activeProfile?.settings.sectionOrder ?? DEFAULT_SECTION_ORDER}
              hiddenSections={activeProfile?.settings.hiddenSections ?? []}
              sectionPages={activeProfile?.settings.sectionPages ?? {}}
              respectTemplateStructure={activeProfile?.settings.respectTemplateStructure !== false}
              onRespectTemplateStructure={(v) => updateSettings({ respectTemplateStructure: v })}
              onSectionOrder={(next) => updateSettings({ sectionOrder: next })}
              onToggleSection={(key) => {
                const cur = activeProfile?.settings.hiddenSections ?? [];
                const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
                updateSettings({ hiddenSections: next });
              }}
              onSectionPage={(key, page) => {
                const cur = activeProfile?.settings.sectionPages ?? {};
                updateSettings({ sectionPages: { ...cur, [key]: page } });
              }}
              fit={fit} onClose={() => setSettingsOpen(false)} />
          )}
        </div>

        <div style={{ width: '1px', height: '20px', background: 'oklch(0.85 0.008 264)', flexShrink: 0 }} />

        {activeId && (
          <button type="button" onClick={() => gateAction('Versionen') && setVersionsOpen(true)} title={et.ttVersions}
            style={{ padding: '4px 2px', background: 'transparent', border: 'none', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.44 0.017 264)', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0, opacity: demoMode ? 0.55 : 1 }}>
            {et.versions}
          </button>
        )}
        {/* Konto-Button only for logged-in users — demo has no account. */}
        {!demoMode && (
          <button type="button" onClick={() => setKeysOpen(true)} title={et.ttAccount}
            style={{ padding: '4px 2px', background: 'transparent', border: 'none', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.44 0.017 264)', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0 }}>
            {et.account}
          </button>
        )}
        {authUser?.role === 'admin' && (
          <button type="button" onClick={() => setAdminOpen(true)} title={et.ttAdmin}
            style={{ padding: '4px 8px', background: 'oklch(0.21 0.021 264)', color: 'oklch(0.985 0.003 264)', border: 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0 }}>
            {et.admin}
          </button>
        )}
        {demoMode ? (
          <>
            <span style={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.55 0.216 264)', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {et.demo}
            </span>
            <button type="button" onClick={exitDemo} title={et.ttExitDemo}
              style={{ padding: '4px 10px', background: 'oklch(0.21 0.021 264)', color: 'oklch(0.985 0.003 264)', border: 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0 }}>
              {et.createAccount}
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: '11.5px', color: '#888', fontFamily: UI_FONT, whiteSpace: 'nowrap', flexShrink: 0 }}>{authUser?.username}</span>
            <button type="button" onClick={handleLogout} title={et.ttSignOut} style={{ padding: '4px 9px', background: 'transparent', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '5px', fontSize: '11px', color: '#888', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0 }}>{et.signOut}</button>
          </>
        )}
      </header>

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {!isMobile && (
          <>
            {mode === 'edit' && docType === 'resume' && (
              <EditorPanel data={currentData} lang={lang} uiLang={uiLang} onUpdate={updateData} demoMode={demoMode} jumpTab={editJumpTab} jumpTick={editJumpTick} />
            )}
            {mode === 'edit' && docType === 'cover-letter' && (
              <CoverLetterEditor data={currentCoverLetter} uiLang={uiLang} onUpdate={updateCoverLetter} resumeId={activeId} />
            )}
            {mode === 'export' && (
              <ExportPanel data={currentData} coverLetter={currentCoverLetter} resumeId={activeId} lang={lang} template={theme.name} docType={docType} exportConfig={{ themeId: template, pairingId: fontPairing, density: fit?.density ?? fontScale, pages: fit?.pages ?? 1, hiddenSections, sectionOrder, pageFormat, sectionPages }} onPrint={handlePrint} onProfileUpdated={handleProfileUpdated} demoMode={demoMode} onDemoBlock={setSoftWall} />
            )}
            {mode === 'knowledge' && <KnowledgePanel />}
            {previewArea(1)}
          </>
        )}
        {isMobile && (
          /* Auf Mobile bleibt jeder Mode-Panel im DOM und wird nur per
             `display:none` versteckt, sobald der User die Tab wechselt.
             So bleibt Scroll-Position im Editor, offene Cards, Drag-State,
             Cursor-Position usw. erhalten — vorher hat das Unmount-Pattern
             jedes Mal alles weggeworfen. */
          <>
            {docType === 'resume' && (
              <div style={{ flex: 1, overflow: 'hidden', display: mode === 'edit' ? 'flex' : 'none', flexDirection: 'column' }}>
                <EditorPanel data={currentData} lang={lang} uiLang={uiLang} onUpdate={updateData} demoMode={demoMode} jumpTab={editJumpTab} jumpTick={editJumpTick} />
              </div>
            )}
            {docType === 'cover-letter' && (
              <div style={{ flex: 1, overflow: 'hidden', display: mode === 'edit' ? 'flex' : 'none', flexDirection: 'column' }}>
                <CoverLetterEditor data={currentCoverLetter} uiLang={uiLang} onUpdate={updateCoverLetter} resumeId={activeId} />
              </div>
            )}
            {/* MobilePreview behält DocumentPreview im Mount — nur outer
                container display-toggled. Slicing/Measuring bleibt warm. */}
            <div style={{ flex: 1, display: mode === 'preview' ? 'flex' : 'none' }}>
              <MobilePreview>{previewArea}</MobilePreview>
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: mode === 'export' ? 'block' : 'none' }}>
              <ExportPanel data={currentData} coverLetter={currentCoverLetter} resumeId={activeId} lang={lang} template={theme.name} docType={docType} exportConfig={{ themeId: template, pairingId: fontPairing, density: fit?.density ?? fontScale, pages: fit?.pages ?? 1, hiddenSections, sectionOrder, pageFormat, sectionPages }} onPrint={handlePrint} onProfileUpdated={handleProfileUpdated} demoMode={demoMode} onDemoBlock={setSoftWall} />
            </div>
            <div style={{ flex: 1, overflow: 'auto', display: mode === 'knowledge' ? 'block' : 'none' }}>
              <KnowledgePanel />
            </div>
          </>
        )}
      </main>

      {isMobile && (
        <nav data-noprint style={{ display: 'flex', borderTop: '1px solid oklch(0.91 0.005 264)', background: '#fff', flexShrink: 0, zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button type="button" onClick={() => setMode('edit')} style={mobileModeStyle(mode === 'edit')}><span style={{ fontSize: '16px' }}>✏️</span>{et.edit}</button>
          <button type="button" onClick={() => setMode('preview')} style={mobileModeStyle(mode === 'preview')}><span style={{ fontSize: '16px' }}>👁</span>{et.preview}</button>
          <button type="button" onClick={() => setMode('export')} style={mobileModeStyle(mode === 'export')}><span style={{ fontSize: '16px' }}>↗</span>{et.export}</button>
          <button type="button" onClick={() => setMode('knowledge')} style={mobileModeStyle(mode === 'knowledge')}><span style={{ fontSize: '16px' }}>💡</span>{et.tips}</button>
        </nav>
      )}

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
      {softWall && (
        <div onClick={() => setSoftWall(null)} style={{ position: 'fixed', inset: 0, zIndex: 2200, background: 'rgba(28,25,23,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: UI_FONT }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'oklch(0.985 0.003 264)', border: '1px solid oklch(0.21 0.021 264)', width: '100%', maxWidth: '460px', padding: '32px 36px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'oklch(0.44 0.017 264)', marginBottom: '8px' }}>{et.swLimit}</div>
            <div style={{ fontFamily: SERIF_FONT, fontSize: '28px', fontWeight: 400, color: 'oklch(0.21 0.021 264)', lineHeight: 0.98, marginBottom: '14px', letterSpacing: '-0.02em' }}>
              {et.swTitle} <em style={{ fontStyle: 'italic', color: 'oklch(0.55 0.216 264)' }}>{et.swTitleAccent}</em>
            </div>
            <div style={{ fontSize: '13px', color: 'oklch(0.44 0.017 264)', lineHeight: 1.55, marginBottom: '20px' }}>
              {et.swBody}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSoftWall(null)}
                style={{ padding: '11px 18px', background: 'transparent', border: '1px solid oklch(0.85 0.008 264)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'oklch(0.44 0.017 264)', cursor: 'pointer' }}>
                {et.swStay}
              </button>
              <button type="button" onClick={() => { setSoftWall(null); exitDemo(); }}
                style={{ padding: '11px 22px', background: 'oklch(0.21 0.021 264)', color: 'oklch(0.985 0.003 264)', border: 'none', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {et.createAccount}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Mobile preview with auto viewport scaling ────────────────────────────────

function MobilePreview({ children }: { children: (scale: number) => React.ReactNode }) {
  /* Bug-Report von Till + Magnus: im Mobile-Fullscreen-Preview verschwand das
   * Menü und der User konnte nicht durch alle Seiten scrollen. Root-Cause:
   * `transform: scale(s)` schrumpft die VISUAL Darstellung aber NICHT die
   * Layout-Bounds. Ein 2-Seiten-CV ist real ~1685 px hoch (A4 ×2), visual
   * skaliert auf ~760 px — der parent Container "weiß" aber von den 1685 px
   * und expandierte unter den Bottom-Tab-Bar hinaus, ohne Scrollbar.
   *
   * Fix: outer wrapper bekommt `overflowY: auto` und reichlich paddingBottom
   * (Sicherheitsabstand zum Bottom-Tab plus safe-area-inset für iPhone).
   * Inner-MobilePreview rendert das Document in einer Box deren Höhe wir
   * EXPLIZIT messen — nicht aus dem layout-Box des transform-Containers,
   * sondern via ResizeObserver am sichtbaren Inhalt. */
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  useEffect(() => {
    function update() {
      if (!wrapRef.current) return;
      const avail = wrapRef.current.clientWidth - 24;
      const newScale = Math.min(1, avail / 793.7); // 793.7 ≈ 210mm@96dpi
      setScale(newScale);
    }
    update();
    const ro = new ResizeObserver(update);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={wrapRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minWidth: 0,
        background: 'oklch(0.968 0.004 264)',
        // Sicherheitsabstand zum Bottom-Tab (~52 px) plus iPhone-Gesture-Bar.
        padding: '12px 12px calc(80px + env(safe-area-inset-bottom, 0px))',
        WebkitOverflowScrolling: 'touch',
        // Browser darf user-pinch-zoom innerhalb des scrollwrappers. Standard-
        // Property; iOS Safari respektiert das ab v13.
        touchAction: 'pan-y pinch-zoom',
      }}
    >
      <div
        ref={innerRef}
        style={{
          display: 'flex',
          justifyContent: 'center',
          // transform-origin: top center pumpt das skaliertes Element vertikal
          // hoch. Wir wickeln deshalb das gesamte DocumentPreview-Output in einen
          // height: 0 + paddingTop-Trick um — der Trick reserviert die richtige
          // Layout-Höhe für das transform-skalierte Element OHNE dass wir
          // ResizeObserver mit dem Renderer koordinieren müssen.
        }}
      >
        {children(scale)}
      </div>
    </div>
  );
}
