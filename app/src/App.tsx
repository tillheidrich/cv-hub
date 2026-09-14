import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import ResumeRenderer, { type InlineEditApi } from './templates/ResumeRenderer';
import { applyInlineEdit, applyCoverLetterEdit, isCoverLetterPath, insertAfter, removeAt } from './data/inlineEdit';
import CoverLetterRenderer from './templates/CoverLetterRenderer';
import DocumentPreview, { type FitInfo } from './preview/DocumentPreview';
import { contentKeyOf } from './preview/contentKey';
import { suggestCuts } from './preview/shorten';
import { metricsFor, USER_SCALE, FS, FLOOR, MIN_FONT_PX, type Metrics } from './templates/metrics';
import { PICKABLE_THEMES, ACCENTS, PAPERS, getTheme, resolvePairing, FONT_PAIRING_LIST } from './templates/theme';
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
import { ET, type EditorStrings } from './ui/editorI18n';
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
import type { CVData, CoverLetterData, AppProfile, Lang, TemplateName, FontPairingId, PageMode, SectionKey, PageFormat, AccentId, PaperId } from './data/types';
import { DEFAULT_SECTION_ORDER } from './data/types';
import { PAGE_FORMAT_LIST } from './data/pageFormats';

type Mode = 'edit' | 'preview' | 'export' | 'knowledge';
type DocType = 'resume' | 'cover-letter';
type Screen = 'home' | 'editor' | 'impressum' | 'privacy';

const UI_FONT = "'Inter', sans-serif";
const SERIF_FONT = "'Space Grotesk', serif";

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

// ── Overlays gehören nicht in die Kopfleiste ────────────────────────────────

/** Hängt seine Kinder direkt ans Dokument, nicht dorthin, wo sie im Baum
 *  stehen.
 *
 *  Anlass war ein Bildschirmfoto vom iPhone: Das Auswahlblatt „Vorlage wählen"
 *  war bis auf seine Kopfzeile verdeckt. Es lag im `<header>`, und der ist auf
 *  dem Telefon ein waagerecht scrollbarer Kasten. WebKit behandelt einen
 *  scrollbaren Vorfahren als Begrenzung für `position: fixed` — das Blatt war
 *  damit auf die 56 px hohe Leiste beschnitten. In Chromium passiert das
 *  nicht, der Prüfstand konnte es also nicht sehen.
 *
 *  Im Portal hängt das Blatt am Dokument: kein Stapelkontext, kein Überlauf
 *  und keine Transformation eines Vorfahren kann es einfangen. */
function Portal({ children }: { children: React.ReactNode }) {
  const [host] = useState(() => document.createElement('div'));
  useEffect(() => {
    document.body.appendChild(host);
    return () => { document.body.removeChild(host); };
  }, [host]);
  return createPortal(children, host);
}

/** Ein Blatt, das von unten kommt — die Form, in der auf dem Telefon jede
 *  Auswahl aus der Kopfleiste erscheint. */
function MobileSheet({ title, onClose, closeLabel, children }: {
  title: string; onClose: () => void; closeLabel: string; children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <Portal>
      <div onClick={onClose} aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(28,25,23,0.38)' }} />
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="cv-sheet"
        style={{
          position: 'fixed', left: '12px', right: '12px',
          bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 1210,
          background: '#fff', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '16px',
          boxShadow: '0 -14px 40px rgba(28,25,23,0.22)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 8px 9px 14px', borderBottom: '1px solid oklch(0.91 0.005 264)', flexShrink: 0 }}>
          <span style={{ fontFamily: SERIF_FONT, fontSize: '16px', fontWeight: 600, color: 'oklch(0.21 0.021 264)' }}>{title}</span>
          <button type="button" onClick={onClose} aria-label={closeLabel}
            style={{ minHeight: '40px', minWidth: '40px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', fontSize: '22px', color: '#9a9a9a', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 12px 14px' }}>{children}</div>
      </div>
    </Portal>
  );
}

function TemplatePicker({ current, onChange, isMobile, t: et }: { current: TemplateName; onChange: (t: TemplateName) => void; isMobile?: boolean; t: EditorStrings }) {
  const [open, setOpen] = useState(false);
  const cur = getTheme(current);
  const cats: string[] = ['klassisch', 'modern', 'kreativ', 'minimal'];

  // Am Schreibtisch hängt die Liste unter der Schaltfläche, auf dem Telefon
  // kommt sie als Blatt von unten — und zwar im Portal, siehe dort.
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
    zIndex: 300, background: '#fff', border: '1px solid oklch(0.91 0.005 264)',
    borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,0.16)',
    padding: '8px', width: '300px', maxHeight: '460px', overflowY: 'auto',
  };

  const list = cats.map(cat => (
    <div key={cat}>
      <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: '#b0a896', padding: '8px 8px 4px' }}>{CAT_LABELS[cat]}</div>
      {PICKABLE_THEMES.filter(t => t.category === cat).map(t => (
        <button key={t.id} type="button" onClick={() => { onChange(t.id); setOpen(false); }}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', minHeight: isMobile ? '48px' : undefined, padding: '8px', background: t.id === current ? 'oklch(0.985 0.003 264)' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', marginBottom: '2px' }}>
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
  ));

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button type="button" onClick={() => setOpen(v => !v)} aria-haspopup="dialog" aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: '7px', minHeight: isMobile ? '40px' : undefined, maxWidth: isMobile ? '118px' : undefined, padding: isMobile ? '5px 10px' : '5px 10px', background: '#fff', border: '1px solid oklch(0.85 0.008 264)', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#2a2a2a', fontFamily: UI_FONT, whiteSpace: 'nowrap' }}>
        <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: cur.colors.accent, flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.name}</span>
        <span style={{ fontSize: '9px', color: '#999', flexShrink: 0 }}>▾</span>
      </button>
      {open && (isMobile ? (
        <MobileSheet title={et.chooseTemplate} closeLabel={et.close} onClose={() => setOpen(false)}>{list}</MobileSheet>
      ) : (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 290 }} onClick={() => setOpen(false)} />
          <div style={dropdownStyle}>{list}</div>
        </>
      ))}
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

function SettingsPanel({ fontScale, onFontScale, fontPairing, onFontPairing, accent, onAccent, paper, onPaper, vorlagenPapier, pageMode, onPageMode, pageFormat, onPageFormat, sectionOrder, hiddenSections, sectionPages, respectTemplateStructure, onSectionOrder, onToggleSection, onSectionPage, onRespectTemplateStructure, fit, onClose, isMobile, t: et, data, onJump }: {
  fontScale: number; onFontScale: (s: number) => void;
  fontPairing: FontPairingId; onFontPairing: (p: FontPairingId) => void;
  accent: AccentId; onAccent: (a: AccentId) => void;
  paper: PaperId; onPaper: (p: PaperId) => void;
  /** Papierfarbe der aktuellen Vorlage — für die „Vorlagenfarbe"-Kachel. */
  vorlagenPapier: string;
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
  isMobile?: boolean; t: EditorStrings;
  /** Für die Kürzungsvorschläge: sie entstehen aus dem Inhalt, nicht aus dem Layout. */
  data: CVData;
  /** Sprung in den passenden Formularbereich. */
  onJump: (tab: import('./preview/DocumentPreview').EditorTab) => void;
}) {
  /** True when the user picked an explicit multi-page mode (2 or 3) — only
   *  then does it make sense to show the per-section page picker. In single
   *  or auto mode there's only one page slot anyway. */
  /* Kürzungsvorschläge nur rechnen, wenn tatsächlich etwas überläuft. */
  const cuts = useMemo(
    () => (fit?.overflow ? suggestCuts(data, fit.overflowLines, fit.charsPerLine) : { cuts: [], covered: 0, deficitChars: 0, hopeless: false }),
    [data, fit?.overflow, fit?.overflowLines, fit?.charsPerLine],
  );
  const showPagePicker = pageMode === 'two' || pageMode === 'three';
  const maxPage = pageMode === 'three' ? 3 : 2;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Vorher lag ein unsichtbarer Backdrop über der ganzen App und Escape tat
  // nichts: wer mit der Tastatur aus dem Panel heraustabbte, kam nirgends mehr
  // hin. Jetzt ist es ein Dialog, der sich schließen lässt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const heading: React.CSSProperties = { fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'oklch(0.50 0.014 264)', marginBottom: '9px', fontFamily: UI_FONT };
  /** Eine Sektion um eine Position verschieben — die Tastatur-Alternative zum
   *  Ziehen. Ohne sie war die Reihenfolge nur mit der Maus änderbar. */
  const moveSection = (idx: number, delta: number) => {
    const next = [...sectionOrder];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onSectionOrder(next);
  };
  const body = (
    <>
        {/* Font size slider */}
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '9px' }}>
            <span style={heading}>Schriftgröße</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'oklch(0.21 0.021 264)', fontFamily: UI_FONT }}>{(FS.body * fontScale * 0.75).toFixed(1).replace('.', ',')} pt</span>
          </div>
          <input type="range" min={USER_SCALE.min} max={USER_SCALE.max} step={0.01} value={fontScale}
            onChange={e => onFontScale(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'oklch(0.55 0.216 264)', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#b3aa98', marginTop: '2px', fontFamily: UI_FONT }}>
            <span>{(FS.body * USER_SCALE.min * 0.75).toFixed(1).replace('.', ',')} pt</span>
            <span>{(FS.body * 0.75).toFixed(1).replace('.', ',')} pt</span>
            <span>{(FS.body * USER_SCALE.max * 0.75).toFixed(1).replace('.', ',')} pt</span>
          </div>
          {/* Der Regler darf unter die dokumentierte Grenze — aber nicht,
              ohne sie zu nennen. Personio führt „font size smaller than or
              equal to 8 pt" wörtlich als Ursache für fehlgeschlagenes
              CV-Parsing auf. Von allein geht das Werkzeug da nie hin. */}
          {FS.body * fontScale * 0.75 < 8.05 && (
            <div style={{ fontSize: '10.5px', color: '#8d4630', background: 'oklch(0.975 0.012 40)', border: '1px solid oklch(0.90 0.03 40)', borderRadius: '8px', padding: '8px 10px', marginTop: '8px', lineHeight: 1.5, fontFamily: UI_FONT }}>
              Unter 8 pt. Personio nennt genau diese Grenze als Grund, warum ein
              Lebenslauf nicht ausgelesen wird. Für eine gedruckte Bewerbung an
              einen Menschen ist das Ihre Entscheidung — für ein Bewerberportal
              ein Risiko.
            </div>
          )}
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

        {/* Akzentfarbe — ersetzt die früheren Farbvarianten-Vorlagen. Die Werte
            liegen alle über 6,9:1 auf Weiß, in beide Richtungen WCAG AA. */}
        <div style={{ marginBottom: '18px' }}>
          <div style={heading}>Akzentfarbe</div>
          <div role="radiogroup" aria-label="Akzentfarbe" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {ACCENTS.map(a => {
              const active = accent === a.id;
              return (
                <button
                  key={a.id} type="button" role="radio" aria-checked={active} title={a.name}
                  onClick={() => onAccent(a.id)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer',
                    background: a.value ?? 'conic-gradient(from 210deg, #8A2F3E, #1F4B8F, #245C43, #8F4519, #8A2F3E)',
                    border: active ? '2px solid oklch(0.21 0.021 264)' : '1px solid oklch(0.85 0.008 264)',
                    boxShadow: active ? '0 0 0 2px #fff inset' : 'none',
                  }}>
                  <span className="cv-sr-only">{a.name}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '10.5px', color: 'oklch(0.50 0.014 264)', marginTop: '7px', fontFamily: UI_FONT, lineHeight: 1.5 }}>
            {ACCENTS.find(a => a.id === accent)?.name}
            {accent === 'auto' ? ' — die Farbe, für die die Vorlage gebaut wurde.' : ' — überschreibt die Farbe der Vorlage.'}
          </div>
        </div>

        {/* Papierfarbe. Einige Vorlagen bringen Creme mit; das muss sich
            zurücknehmen lassen, ohne die Vorlage zu wechseln. */}
        <div style={{ marginBottom: '18px' }}>
          <div style={heading}>Papier</div>
          <div role="radiogroup" aria-label="Papierfarbe" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {PAPERS.map(pp => {
              const active = paper === pp.id;
              return (
                <button
                  key={pp.id} type="button" role="radio" aria-checked={active} title={pp.name}
                  onClick={() => onPaper(pp.id)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer',
                    background: pp.value ?? `linear-gradient(135deg, #fff 50%, ${vorlagenPapier} 50%)`,
                    border: active ? '2px solid oklch(0.21 0.021 264)' : '1px solid oklch(0.78 0.008 264)',
                    boxShadow: active ? '0 0 0 2px #fff inset' : 'none',
                  }}>
                  <span className="cv-sr-only">{pp.name}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: '10.5px', color: 'oklch(0.50 0.014 264)', marginTop: '7px', fontFamily: UI_FONT, lineHeight: 1.5 }}>
            {PAPERS.find(pp => pp.id === paper)?.name}
            {paper === 'auto' ? ' — das Papier, für das die Vorlage gebaut wurde.' : ' — überschreibt das Papier der Vorlage.'}
          </div>
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
          <div style={heading}>Seitenzahl</div>
          {/* Die Seitenzahl ist eine Frage an den Menschen, nicht an den
              Parser: weder Personio noch Textkernel nennen sie als Kriterium.
              Was sie nennen, steht an den Reglern darüber. */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {([['one', '1 Seite'], ['two', '2 Seiten'], ['three', '3'], ['auto', 'Auto']] as [PageMode, string][]).map(([v, l]) => (
              <button key={v} type="button" onClick={() => onPageMode(v)}
                title={v === 'one'
                  ? 'Alles auf eine Seite — der Inhalt wird gestaffelt verdichtet: erst Weißraum, dann Ränder, dann Zeilenabstand, zuletzt die Schrift. Passt es dann immer noch nicht, sagt das Tool es, statt weiter zu schrumpfen.'
                  : v === 'two' ? 'Bis zu zwei Seiten. Die Bundesagentur für Arbeit nennt „eine bis maximal zwei A4-Seiten" als Standard — zwei Seiten sind also kein Notbehelf.'
                  : v === 'three' ? 'Bis zu drei Seiten. Außerhalb von Wissenschaft und Medizin (Publikationsliste) unüblich — und Textkernel führt sehr lange Lebensläufe ausdrücklich als Parsing-Problemfall.'
                  : 'So viele Seiten, wie der Inhalt braucht — nichts wird verdichtet'}
                style={{ flex: v === 'one' || v === 'two' ? 1.5 : 1, padding: '8px 4px', background: pageMode === v ? 'oklch(0.21 0.021 264)' : 'oklch(0.968 0.004 264)', color: pageMode === v ? '#fff' : '#555', border: 'none', borderRadius: '7px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: UI_FONT, whiteSpace: 'nowrap' }}>
                {l}
              </button>
            ))}
          </div>
          {fit && (
            <div style={{ fontSize: '10.5px', color: fit.overflow ? '#a4442e' : fit.condense > 0.05 ? '#9b6a2e' : '#9a9a9a', marginTop: '9px', lineHeight: 1.55, fontFamily: UI_FONT }}>
              {fit.overflow
                ? `Passt nicht auf ${pageMode === 'one' ? 'eine Seite' : `${pageMode === 'two' ? 2 : 3} Seiten`} — es ${fit.pages === 1 ? 'wird eine' : `werden ${fit.pages}`}.${pageMode === 'one' && fit.pages === 2 ? ' Das ist kein Mangel: Die Bundesagentur für Arbeit nennt eine bis maximal zwei Seiten als Standard.' : ''} Von allein wird hier nichts kleiner als ${(Math.max(MIN_FONT_PX, FS.body * FLOOR.t) * 0.75).toFixed(1).replace('.', ',')} pt — Personio nennt 8 pt und darunter als Grund, warum ein Lebenslauf nicht ausgelesen wird.`
                : fit.condense > 0.05
                  ? `Auf ${fit.pages === 1 ? 'eine Seite' : `${fit.pages} Seiten`} verdichtet (${Math.round(fit.condense * 100)} % der Reserve genutzt, Schrift ${(FS.body * fit.metrics.t * 0.75).toFixed(1).replace('.', ',')} pt).`
                  : `Passt auf ${fit.pages === 1 ? 'eine Seite' : `${fit.pages} Seiten`} — ohne Verdichtung.`}
              {/* Kürzungsvorschläge: „ÜBERLAUF" allein ist richtig und nutzlos.
                  Gerechnet wird aus zwei gemessenen Größen — den Zeilen, die
                  nicht mehr passen, und den Zeichen, die im gesetzten
                  Dokument auf eine Zeile gehen. */}
              {fit.overflow && cuts.cuts.length > 0 && (
                <div style={{ marginTop: '8px', background: 'oklch(0.975 0.012 40)', border: '1px solid oklch(0.90 0.03 40)', borderRadius: '8px', padding: '10px 11px' }}>
                  <div style={{ fontWeight: 700, color: '#8d4630', marginBottom: '6px' }}>
                    Rund {cuts.deficitChars} Zeichen zu viel ({fit.overflowLines} {fit.overflowLines === 1 ? 'Zeile' : 'Zeilen'}). Diese Stellen geben es her:
                  </div>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {cuts.cuts.map((c, i) => (
                      <li key={i}>
                        <button type="button" onClick={() => { onJump(c.tab); onClose(); }}
                          style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: UI_FONT, fontSize: '10.5px', color: '#7a4a34', lineHeight: 1.5 }}>
                          <span style={{ fontFeatureSettings: "'tnum'" }}>−{c.chars}</span>{' Zeichen · '}
                          <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>{c.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div style={{ marginTop: '7px', color: '#9a7a68' }}>
                    {cuts.hopeless
                      ? 'Auch alles zusammen reicht nicht. Dann ist nicht der Text zu lang, sondern dieses Layout zu teuer: Bei einspaltigen Vorlagen stehen Kontakt, Eckdaten, Sprachen und Skills IM Textfluss, bei Vorlagen mit Seitenspalte daneben. Nimm zwei Seiten — oder eine Vorlage mit Spalte (Hamburg, Lüneburg, Aarhus …).'
                      : cuts.covered >= fit.overflowLines
                        ? 'Zusammen reicht das.'
                        : 'Das bringt schon einen Teil — danach neu schauen.'}
                  </div>
                </div>
              )}
              {!fit.overflow && fit.pages > 1 && fit.lastPageFill < 0.25 && (
                <span style={{ display: 'block', marginTop: '4px', color: '#9b6a2e' }}>
                  Seite {fit.pages} ist nur zu {Math.round(fit.lastPageFill * 100)} % gefüllt — eine halbe letzte Seite wirkt unfertig. Entweder auf eine Seite verdichten oder die letzte Seite mit Substanz füllen.
                </span>
              )}
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
            Reihenfolge ändern: ⋮⋮ ziehen oder ↑/↓ benutzen. Bei Sidebar-Vorlagen (Oslo, Patterson, Azurill…) leben Skills/Sprachen/Eckdaten in der Seitenleiste — Reorder gilt dort für die Haupt-Spalte.
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
                  aria-hidden
                  onDragStart={e => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  title="Zum Sortieren ziehen"
                  style={{
                    color: '#6f6f6f', userSelect: 'none', cursor: 'grab',
                    padding: '0 4px', fontSize: '14px', lineHeight: 1,
                  }}
                >⋮⋮</span>
                <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: 'oklch(0.21 0.021 264)' }}>
                  {SECTION_LABELS[key]}
                </span>
                <button type="button" disabled={idx === 0}
                  onClick={e => { e.stopPropagation(); moveSection(idx, -1); }}
                  aria-label={`${SECTION_LABELS[key]} nach oben verschieben`}
                  style={{ minWidth: '24px', minHeight: '24px', background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#c8c8c8' : '#555', fontSize: '12px', lineHeight: 1, padding: 0 }}>↑</button>
                <button type="button" disabled={idx === sectionOrder.length - 1}
                  onClick={e => { e.stopPropagation(); moveSection(idx, 1); }}
                  aria-label={`${SECTION_LABELS[key]} nach unten verschieben`}
                  style={{ minWidth: '24px', minHeight: '24px', background: 'none', border: 'none', cursor: idx === sectionOrder.length - 1 ? 'default' : 'pointer', color: idx === sectionOrder.length - 1 ? '#c8c8c8' : '#555', fontSize: '12px', lineHeight: 1, padding: 0 }}>↓</button>
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
    </>
  );

  /* Auf dem Telefon ein Blatt von unten — im Portal, damit es die waagerecht
     scrollbare Kopfleiste nicht einfängt (siehe `Portal`). Am Schreibtisch
     bleibt es der Ausklapper unter der Schaltfläche. */
  if (isMobile) {
    return <MobileSheet title={et.typeAndPage} closeLabel={et.close} onClose={onClose}>{body}</MobileSheet>;
  }
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 290 }} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={et.typeAndPage}
        tabIndex={-1}
        style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300, background: '#fff', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '12px', boxShadow: '0 12px 36px rgba(0,0,0,0.16)', padding: '18px', width: '288px' }}>
        {body}
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
    // On mobile the preview lives behind a tab switcher — pull the user
    // into the edit tab so they actually see their jump land somewhere.
    if (isMobile) setMode('edit');
  }, [isMobile]);

  useEffect(() => {
    api.me().then(d => setAuthUser(d.user)).catch(() => setAuthUser(null)).finally(() => setAuthLoading(false));
  }, []);

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
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.querySelector(`.cv-scale-wrapper [data-cv-edit="${path}"]`) as HTMLElement | null;
      if (!el) return;
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }));
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
  }), [updateData, updateCoverLetter, focusInline, currentData]);
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

  // ── Styles ────────────────────────────────────────────────────────────────
  const topBarStyle: React.CSSProperties = {
    height: '56px', background: 'oklch(0.985 0.003 264)', borderBottom: '1px solid oklch(0.85 0.008 264)',
    display: 'flex', alignItems: 'center',
    padding: isMobile ? '0 10px' : '0 20px',
    gap: isMobile ? '6px' : '14px',
    flexShrink: 0, zIndex: 200, position: 'relative',
    /* Früher scrollte diese Leiste auf dem Telefon waagerecht. Nichts war
       dadurch unerreichbar, aber Sprach- und Vorlagenwahl lagen außerhalb des
       Sichtfelds, und ein scrollbarer Kasten begrenzt in WebKit `position:
       fixed` seiner Nachfahren — das Auswahlblatt war deshalb verdeckt.
       Jetzt passt alles hinein: was selten gebraucht wird, liegt im Menü. */
    overflowX: 'visible',
    overflowY: 'visible',
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
  /** Mindestmaße für Tippziele in der Kopfleiste.
   *
   *  Die Leiste ist auf dem Telefon waagerecht scrollbar und eng gepackt; die
   *  Schaltflächen darin waren 21–26 px hoch. Apple nennt 44 pt als Mindestmaß,
   *  Android 48 dp — beides ist in einer 56 px hohen Leiste nicht zu haben,
   *  aber 40 px sind es, und der Unterschied zwischen 23 und 40 px entscheidet
   *  darüber, ob man mit dem Daumen trifft. */
  const tapTarget: React.CSSProperties = isMobile
    ? { minHeight: '40px', minWidth: '36px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
    : {};

  const langBtnStyle = (active: boolean): React.CSSProperties => ({
    ...tapTarget,
    padding: isMobile ? '3px 8px' : '3px 6px', background: 'transparent',
    color: active ? 'oklch(0.21 0.021 264)' : 'oklch(0.44 0.017 264)',
    border: 'none',
    borderBottom: active ? '1.5px solid oklch(0.21 0.021 264)' : '1.5px solid transparent',
    fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em',
    cursor: 'pointer', fontFamily: UI_FONT,
  });
  const sheetHeading: React.CSSProperties = {
    fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'oklch(0.50 0.014 264)', marginBottom: '8px', fontFamily: UI_FONT,
  };
  const sheetChoice = (active: boolean): React.CSSProperties => ({
    minHeight: '44px', padding: '0 16px', borderRadius: '9px', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600, fontFamily: UI_FONT,
    background: active ? 'oklch(0.21 0.021 264)' : '#fff',
    color: active ? 'oklch(0.985 0.003 264)' : 'oklch(0.35 0.017 264)',
    border: `1px solid ${active ? 'oklch(0.21 0.021 264)' : 'oklch(0.88 0.006 264)'}`,
  });
  const sheetRow: React.CSSProperties = {
    minHeight: '46px', display: 'flex', alignItems: 'center', width: '100%',
    padding: '0 4px', background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '13px', color: 'oklch(0.30 0.017 264)', fontFamily: UI_FONT, textAlign: 'left',
  };
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
      return <AuthScreen onAuth={setAuthUser} onDemoStart={startDemo} lang={uiLang} onLangChange={handleLangChange}
                         initialInvite={initialInvite} initialMode={initialInvite ? 'register' : 'login'} />;
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
        <HomeScreen profiles={profiles} onSelect={handleSelectProfile} onCreate={handleCreateProfile} onDelete={handleDeleteProfile}
          username={authUser?.username} isAdmin={authUser?.role === 'admin'} onLogout={handleLogout} onOpenAdmin={() => setAdminOpen(true)} />
        {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      </>
    );
  }

  // ── Print render ──────────────────────────────────────────────────────────
  if (printing) {
    return (
      <div id="print-only-root" style={{ background: 'oklch(0.985 0.003 264)', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '40px' }}>
        <div data-noprint style={{ fontFamily: UI_FONT, fontSize: '12px', color: '#aaa', marginBottom: '24px' }}>Druckvorschau wird vorbereitet…</div>
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
  const previewArea = (mobileScale: number) => (
    /* Auf dem Telefon scrollt und polstert `MobilePreview` — dieser Kasten darf
       weder das eine noch das andere tun. Täte er es, entstünde ein zweiter
       Bildlauf innerhalb des ersten: Er kennt nur die ungeskalierte Höhe des
       Dokuments (1123 px statt sichtbarer 518 px) und ließe sich über sechs-
       hundert Pixel Leerraum nach unten ziehen. */
    <div data-noprint style={{ flex: 1, background: 'oklch(0.968 0.004 264)', overflowY: isMobile ? 'visible' : 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: isMobile ? 0 : '32px', minWidth: 0 }}>
      <DocumentPreview
        render={renderDoc}
        userScale={fontScale}
        pageMode={pageMode}
        pageFormat={pageFormat}
        contentKey={contentKey}
        viewportScale={mobileScale}
        onFit={setFit}
        labels={currentData.labels}
        /* Click-on-preview only applies to the CV (the cover letter has no
           tabbed editor, just one long form). */
        onEdit={docType === 'resume' ? handlePreviewEdit : undefined}
      />
    </div>
  );

  return (
    <div className="cv-app-shell" style={{ display: 'flex', flexDirection: 'column', background: 'oklch(0.985 0.003 264)', overflow: 'hidden' }}>
      <header data-noprint style={topBarStyle}>
        <button type="button" onClick={() => setScreen('home')} title={et.ttHome} aria-label={et.ttHome}
          style={{ ...tapTarget, padding: isMobile ? '4px 6px' : '4px 6px', background: 'transparent', border: 'none', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', cursor: 'pointer', color: 'oklch(0.21 0.021 264)', flexShrink: 0, lineHeight: 1 }}>
          {isMobile ? '←' : `← ${et.home}`}
        </button>

        {/* Der Editor hatte gar keine Überschrift — für Screenreader war die
            Seite dadurch ohne Einstieg. Optisch unverändert. */}
        <h1 style={{
          fontFamily: SERIF_FONT, fontSize: isMobile ? '15px' : '17px', fontWeight: 500,
          color: 'oklch(0.21 0.021 264)', whiteSpace: 'nowrap', letterSpacing: '-0.01em', margin: 0,
          ...(isMobile
            ? { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }
            : { flexShrink: 0 }),
        }}>
          {activeProfile?.displayName ?? 'CV-Hub'}
        </h1>

        {!isMobile && <div style={{ width: '1px', height: '20px', background: 'oklch(0.85 0.008 264)', flexShrink: 0 }} />}

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
                    ...tapTarget,
                    padding: isMobile ? '4px 8px' : '4px 2px', background: 'transparent',
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

        {!isMobile && <div style={{ flex: 1 }} />}
        {/* Save-status dot — label appears on hover only, so the eye doesn't track it constantly.
            Für Screenreader steht der Zustand zusätzlich als Text in einer
            Live-Region: ein 8-px-Punkt mit title-Attribut ist keine Meldung. */}
        <span className="cv-sr-only" role="status" aria-live="polite">
          {saveStatus === 'error' ? et.unsaved : saveStatus === 'saving' ? et.saving : et.saved}
        </span>
        <div
          aria-hidden
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

        <TemplatePicker current={template} onChange={t => updateSettings({ template: t })} isMobile={isMobile} t={et} />

        {!isMobile && (
          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
            {ALL_LANGS.map(l => (
              <button key={l} type="button" onClick={() => updateSettings({ lang: l })} style={langBtnStyle(lang === l)} title={LANG_NAMES[l]}>{l.toUpperCase()}</button>
            ))}
          </div>
        )}

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button type="button" onClick={() => setSettingsOpen(v => !v)} title={et.ttFont}
            style={{ ...tapTarget, padding: isMobile ? '4px 8px' : '4px 2px', background: 'transparent', border: 'none',
              borderBottom: settingsOpen ? '2px solid oklch(0.21 0.021 264)' : '2px solid transparent',
              fontSize: isMobile ? '13px' : '10.5px', fontWeight: 700,
              letterSpacing: isMobile ? 'normal' : '0.12em', textTransform: isMobile ? 'none' : 'uppercase',
              color: settingsOpen ? 'oklch(0.21 0.021 264)' : 'oklch(0.44 0.017 264)', cursor: 'pointer', fontFamily: UI_FONT }}
            aria-haspopup="dialog" aria-expanded={settingsOpen} aria-label={et.ttFont}>
            {isMobile ? 'Aa' : et.font}
          </button>
          {settingsOpen && (
            <SettingsPanel
              fontScale={fontScale} onFontScale={s => updateSettings({ fontScale: s })}
              fontPairing={fontPairing} onFontPairing={p => updateSettings({ fontPairing: p })}
              accent={accent} onAccent={a => updateSettings({ accent: a })}
              paper={paper} onPaper={p => updateSettings({ paper: p })}
              vorlagenPapier={getTheme(template, accent).colors.pageBg}
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
              fit={fit} onClose={() => setSettingsOpen(false)} isMobile={isMobile} t={et}
              data={currentData} onJump={handlePreviewEdit} />
          )}
        </div>

        {!isMobile && (
          <>
            <div style={{ width: '1px', height: '20px', background: 'oklch(0.85 0.008 264)', flexShrink: 0 }} />

            {activeId && (
              <button type="button" onClick={() => gateAction('Versionen') && setVersionsOpen(true)} title={et.ttVersions}
                style={{ ...tapTarget, padding: '4px 2px', background: 'transparent', border: 'none', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'oklch(0.44 0.017 264)', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0, opacity: demoMode ? 0.55 : 1 }}>
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
                  style={{ ...tapTarget, padding: '4px 10px', background: 'oklch(0.21 0.021 264)', color: 'oklch(0.985 0.003 264)', border: 'none', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0 }}>
                  {et.createAccount}
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '11.5px', color: '#888', fontFamily: UI_FONT, whiteSpace: 'nowrap', flexShrink: 0 }}>{authUser?.username}</span>
                <button type="button" onClick={handleLogout} title={et.ttSignOut} style={{ padding: '4px 9px', background: 'transparent', border: '1px solid oklch(0.91 0.005 264)', borderRadius: '5px', fontSize: '11px', color: '#888', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0 }}>{et.signOut}</button>
              </>
            )}
          </>
        )}

        {/* Auf dem Telefon liegt alles Seltene hinter einem Knopf: Dokumenttyp,
            Sprache, Versionen, Konto. Vorher stand es in der Leiste und schob
            sie aus dem Sichtfeld. */}
        {isMobile && (
          <button type="button" onClick={() => setMoreOpen(true)} title={et.menu} aria-label={et.menu}
            aria-haspopup="dialog" aria-expanded={moreOpen}
            style={{ ...tapTarget, padding: '4px 6px', background: 'transparent', border: 'none', fontSize: '19px', lineHeight: 1, color: 'oklch(0.35 0.017 264)', cursor: 'pointer', fontFamily: UI_FONT, flexShrink: 0 }}>⋯</button>
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
              <ExportPanel data={currentData} coverLetter={currentCoverLetter} resumeId={activeId} lang={lang} template={theme.name} docType={docType} exportConfig={{ themeId: template, accentId: accent, paperId: paper, pairingId: fontPairing, metrics: fit?.metrics ?? metricsFor(0, fontScale), pageBlocks: fit?.pageBlocks, asideSkillCap: fit?.asideCap, hiddenSections, sectionOrder, pageFormat, forcedBreaks }} onPrint={handlePrint} onProfileUpdated={handleProfileUpdated} onReplaceData={(cv) => updateData(() => cv)} demoMode={demoMode} onDemoBlock={setSoftWall} />
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
            {/* `minWidth: 0` ist hier nicht kosmetisch: ohne ihn gilt für dieses
                Flex-Element die automatische Mindestbreite, es wächst also auf
                die Breite seines Inhalts — und der Inhalt ist eine 794 px
                breite A4-Seite. Die Vorschau maß daraus 850 px verfügbare
                Breite, rechnete sich einen Maßstab von 1 aus und stand auf dem
                Telefon unskaliert und rechts abgeschnitten da. */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: mode === 'preview' ? 'flex' : 'none' }}>
              <MobilePreview doneLabel={et.zoomDone} hintLabel={et.tapToWrite}>{previewArea}</MobilePreview>
            </div>
            <div style={{ flex: 1, overflow: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 0px)', display: mode === 'export' ? 'block' : 'none' }}>
              <ExportPanel data={currentData} coverLetter={currentCoverLetter} resumeId={activeId} lang={lang} template={theme.name} docType={docType} exportConfig={{ themeId: template, accentId: accent, paperId: paper, pairingId: fontPairing, metrics: fit?.metrics ?? metricsFor(0, fontScale), pageBlocks: fit?.pageBlocks, asideSkillCap: fit?.asideCap, hiddenSections, sectionOrder, pageFormat, forcedBreaks }} onPrint={handlePrint} onProfileUpdated={handleProfileUpdated} onReplaceData={(cv) => updateData(() => cv)} demoMode={demoMode} onDemoBlock={setSoftWall} />
            </div>
            <div style={{ flex: 1, overflow: 'auto', paddingBottom: 'env(safe-area-inset-bottom, 0px)', display: mode === 'knowledge' ? 'block' : 'none' }}>
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

      {moreOpen && (
        <MobileSheet title={et.menu} closeLabel={et.close} onClose={() => setMoreOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={sheetHeading}>{et.docTypeLabel}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['resume', 'cover-letter'] as DocType[]).map(dt => (
                  <button key={dt} type="button"
                    onClick={() => { setDocType(dt); setMoreOpen(false); }}
                    style={sheetChoice(docType === dt)}>
                    {{ resume: et.resume, 'cover-letter': et.coverLetter }[dt]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={sheetHeading}>{et.langLabel}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {ALL_LANGS.map(l => (
                  <button key={l} type="button" title={LANG_NAMES[l]}
                    onClick={() => updateSettings({ lang: l })}
                    style={{ ...sheetChoice(lang === l), flex: 1 }}>{l.toUpperCase()}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid oklch(0.91 0.005 264)', paddingTop: '10px' }}>
              {activeId && (
                <button type="button" style={sheetRow}
                  onClick={() => { setMoreOpen(false); if (gateAction('Versionen')) setVersionsOpen(true); }}>
                  {et.versions}
                </button>
              )}
              {!demoMode && (
                <button type="button" style={sheetRow} onClick={() => { setMoreOpen(false); setKeysOpen(true); }}>
                  {et.account}{authUser?.username ? ` · ${authUser.username}` : ''}
                </button>
              )}
              {authUser?.role === 'admin' && (
                <button type="button" style={sheetRow} onClick={() => { setMoreOpen(false); setAdminOpen(true); }}>{et.admin}</button>
              )}
              {!demoMode && (
                <button type="button" style={sheetRow} onClick={() => { setMoreOpen(false); handleLogout(); }}>{et.signOut}</button>
              )}
              {demoMode && (
                <button type="button" onClick={() => { setMoreOpen(false); exitDemo(); }}
                  style={{ ...sheetRow, marginTop: '6px', background: 'oklch(0.21 0.021 264)', color: 'oklch(0.985 0.003 264)', borderRadius: '8px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '11px' }}>
                  {et.createAccount}
                </button>
              )}
            </div>
          </div>
        </MobileSheet>
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

// ── Vorschau auf Telefon und Tablet ──────────────────────────────────────────

/** Maßstab, ab dem der Text im Dokument ohne Zoom beschreibbar ist.
 *  Darunter ist eine Zeile Fließtext unter sieben Pixel hoch. */
const LEGIBLE = 0.85;

function MobilePreview({ children, doneLabel, hintLabel }: { children: (scale: number) => React.ReactNode; doneLabel: string; hintLabel: string }) {
  /* `transform: scale(s)` schrumpft die Darstellung, nicht die Layout-Maße.
   * Ein zweiseitiger Lebenslauf ist real rund 1685 px hoch und bleibt es auch
   * skaliert — der umgebende Kasten wüchse also unter die Bereichsleiste
   * hinaus, ohne Bildlauf. Deshalb scrollt der äußere Kasten und trägt
   * reichlich Abstand nach unten (Bereichsleiste plus Gestenleiste). */
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.45);
  /* Zoom zum Schreiben: Wer in ein Feld tippt, bekommt das Dokument in voller
   * Größe — sonst schriebe er in sechs Pixel hohe Zeilen. Verlassen wird der
   * Zustand automatisch, sobald kein beschreibbares Feld mehr den Fokus hat,
   * oder über die Schaltfläche. */
  const [zoomed, setZoomed] = useState(false);

  /* Der Hinweis „Text antippen und schreiben" erscheint beim Öffnen der
   * Vorschau und verschwindet nach ein paar Sekunden wieder. Dauerhaft stünde
   * er über dem Dokument, und die Vorschau soll das Dokument zeigen. */
  const [hint, setHint] = useState(false);
  useEffect(() => {
    let sichtbar = false;
    let t: number | undefined;
    function update() {
      const el = wrapRef.current;
      if (!el) return;
      const avail = el.clientWidth - 24;
      if (avail > 0) setFitScale(Math.min(1, avail / 793.7)); // 793.7 ≈ 210mm@96dpi
      const jetzt = el.clientWidth > 0 && el.clientHeight > 0;
      if (jetzt && !sichtbar) {
        setHint(true);
        window.clearTimeout(t);
        t = window.setTimeout(() => setHint(false), 4500);
      }
      sichtbar = jetzt;
    }
    update();
    const ro = new ResizeObserver(update);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => { window.clearTimeout(t); ro.disconnect(); };
  }, []);

  const scale = zoomed ? 1 : fitScale;

  /* `transform: scale()` verkleinert die Darstellung, nicht die Layout-Maße:
   * Eine auf 43 % skalierte A4-Seite belegt weiterhin 1123 px, sichtbar sind
   * 483 px. Der Rest war grauer Leerraum, durch den man scrollen musste. Die
   * natürliche Höhe wird deshalb gemessen und dem umgebenden Kasten als
   * skalierte Höhe gesetzt. */
  const [docH, setDocH] = useState(0);
  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    const attach = () => {
      const el = root.querySelector('.cv-scale-wrapper') as HTMLElement | null;
      if (!el) { raf = requestAnimationFrame(attach); return; }
      setDocH(el.offsetHeight);
      ro = new ResizeObserver(() => setDocH(el.offsetHeight));
      ro.observe(el);
    };
    attach();
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, []);

  // Beim Hineintippen auf volle Größe gehen und das Feld in die Mitte holen.
  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    let leaveTimer: number | undefined;

    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('[data-cv-edit]') as HTMLElement | null;
      if (!el) return;
      window.clearTimeout(leaveTimer);
      if (fitScale < LEGIBLE) setZoomed(true);
      // Erst nach dem Neuzeichnen: vor dem Umschalten steht das Feld noch an
      // seiner skalierten Position.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      }));
    };
    const onFocusOut = () => {
      // Der Wechsel von einem Feld ins nächste erzeugt kurz einen Zustand ohne
      // Fokus — ohne die Verzögerung zoomte die Seite zwischen zwei Wörtern
      // heraus und wieder hinein.
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || !a.closest('[data-cv-edit]')) setZoomed(false);
      }, 220);
    };
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    return () => {
      window.clearTimeout(leaveTimer);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, [fitScale]);

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div
        ref={wrapRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: zoomed ? 'auto' : 'hidden',
          minWidth: 0,
          background: 'oklch(0.968 0.004 264)',
          // Sicherheitsabstand zur Bereichsleiste plus iPhone-Gestenleiste.
          padding: '12px 12px calc(80px + env(safe-area-inset-bottom, 0px))',
          WebkitOverflowScrolling: 'touch',
          touchAction: zoomed ? 'pan-x pan-y pinch-zoom' : 'pan-y pinch-zoom',
        }}
      >
        <div style={{
          display: 'flex', justifyContent: 'center',
          width: zoomed ? 'max-content' : undefined, minWidth: '100%',
          height: scale < 1 && docH ? `${Math.round(docH * scale)}px` : undefined,
          overflow: scale < 1 ? 'hidden' : undefined,
        }}>
          {children(scale)}
        </div>
      </div>

      {zoomed ? (
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            (document.activeElement as HTMLElement | null)?.blur();
            setZoomed(false);
          }}
          style={{
            position: 'absolute', right: '12px',
            bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            zIndex: 60, minHeight: '40px', padding: '0 18px',
            background: 'oklch(0.21 0.021 264)', color: '#fff', border: 'none',
            borderRadius: '999px', fontSize: '12px', fontWeight: 700,
            letterSpacing: '0.06em', fontFamily: UI_FONT, cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(28,25,23,0.28)',
          }}
        >{doneLabel}</button>
      ) : (
        <div aria-hidden style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(10px + env(safe-area-inset-bottom, 0px))', zIndex: 60,
          padding: '5px 12px', borderRadius: '999px', pointerEvents: 'none',
          background: 'rgba(28,25,23,0.72)', color: '#fff',
          fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em',
          fontFamily: UI_FONT, whiteSpace: 'nowrap',
          opacity: hint ? 1 : 0, transition: 'opacity 400ms ease',
        }}>{hintLabel}</div>
      )}
    </div>
  );
}
