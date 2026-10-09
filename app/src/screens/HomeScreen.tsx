import { useState, useEffect } from 'react';
import type { AppProfile, CVData, Lang } from '../data/types';
import { createDemoProfile, createBlankProfile, withAllLangs } from '../data/storage';
import { COLORS as C, RAW, FONTS as F, BORDER as B, TYPE } from '../ui/tokens';
import { DESIGN_I18N } from '../ui/i18n/design';
import { LOCAL_I18N } from '../ui/i18n/local';
import { importLinkedIn } from '../import/linkedinImport';
import { jsonResumeToCv, isJsonResume } from '../export/jsonResume';
import { markdownToCvData, isCvMarkdown } from '../import/markdownBridge';
import { useUiLang } from '../ui/useUiLang';
import { HOME_I18N } from '../ui/i18n/home';
import { APP_NAME } from '../brand';
import { FASSUNG_I18N } from '../ui/i18n/fassung';
import { BILLING_I18N } from '../ui/i18n/billing';
import { SiteFooter } from '../billing/BillingShell';
import { useFreeTier } from '../billing/freeTier';
import { LockGlyph, PassNote } from '../billing/PassLock';
import { FREETIER_I18N } from '../ui/i18n/freetier';

function useViewport() {
  const [w, setW] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return { isMobile: w < 720, isTablet: w >= 720 && w < 1024, isDesktop: w >= 1024 };
}

interface Props {
  profiles: AppProfile[];
  onSelect: (id: string) => void;
  onCreate: (profile: AppProfile) => void;
  onDelete: (id: string) => void;
  /** Account controls in the top bar (logged-in home). */
  username?: string;
  isAdmin?: boolean;
  onLogout?: () => void;
  onOpenAdmin?: () => void;
  /** Lokalmodus: Sicherungsfenster öffnen (ui/BackupReminder.tsx). */
  onOpenBackup?: () => void;
  /** Fassung duplizieren (fehlt im Nur-Lese-Modus). */
  onDuplicate?: (id: string) => void;
  /** Zugang abgelaufen: Anlegen gesperrt, mit diesem Satz als Erklärung. */
  readOnlyNote?: string;
  /** Laufzeit-Band unter der Kopfleiste (App.tsx). */
  banner?: React.ReactNode;
  /** „Mein Pass" öffnen (Konto mit Bezahlmodell). */
  onOpenPass?: () => void;
}

// ── Create Profile Modal ───────────────────────────────────────────────────

type StartMode = 'blank' | 'demo' | 'import';

/** Was eine Importdatei hergibt — vor dem Anlegen gelesen, damit der Mensch
 *  sieht, was übernommen wird. */
interface ImportResult { cv?: CVData; profile?: AppProfile; what: string }

/** Liest eine mitgebrachte Datei — alle vorhandenen Importwege an einer
 *  Stelle (Personas-Bericht, Hürde 7): LinkedIn-ZIP/CSV, Datensicherung des
 *  Werkzeugs (JSON), JSON Resume und Markdown im Format der Brücke. Läuft
 *  vollständig im Browser. */
async function readImport(file: File, base: CVData): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip') || name.endsWith('.csv')) {
    const befund = await importLinkedIn(file, base);
    const g = befund.gefunden;
    return { cv: befund.cv, what: `LinkedIn · ${g.stationen} / ${g.ausbildung} / ${g.skills} / ${g.sprachen}` };
  }
  const text = await file.text();
  if (name.endsWith('.json') || text.trimStart().startsWith('{')) {
    const parsed = JSON.parse(text);
    if (isJsonResume(parsed)) return { cv: jsonResumeToCv(parsed, base), what: 'JSON Resume' };
    if (parsed && parsed.id && parsed.data) return { profile: withAllLangs(parsed as AppProfile), what: 'JSON' };
    if (parsed && parsed.personal && parsed.experience !== undefined) return { cv: parsed as CVData, what: 'JSON' };
    throw new Error('json');
  }
  if (isCvMarkdown(text)) return { cv: markdownToCvData(text, base), what: 'Markdown' };
  throw new Error('unknown');
}

function CreateModal({ onConfirm, onClose }: {
  onConfirm: (profile: AppProfile) => void;
  onClose: () => void;
}) {
  const uiLang = useUiLang();
  const t = HOME_I18N[uiLang];
  const d = DESIGN_I18N[uiLang];
  const [title, setTitle] = useState('');
  const [person, setPerson] = useState('');
  const [mode, setMode] = useState<StartMode>('blank');
  const [imp, setImp] = useState<ImportResult | null>(null);
  const [impErr, setImpErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lang: Lang = (['de', 'en', 'fr', 'es'] as Lang[]).includes(uiLang as Lang) ? uiLang as Lang : 'de';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const effectiveTitle = title.trim() || person.trim();
  const ready = !!effectiveTitle && (mode !== 'import' || !!imp);

  async function pick(file: File) {
    setBusy(true); setImpErr(null); setImp(null);
    try {
      const base = createBlankProfile('').data[lang];
      setImp(await readImport(file, base));
    } catch {
      setImpErr(d.importFailed);
    } finally { setBusy(false); }
  }

  function handleCreate() {
    if (!ready) return;
    let profile: AppProfile;
    if (mode === 'demo') profile = createDemoProfile(effectiveTitle);
    else if (mode === 'import' && imp?.profile) {
      const fresh = createBlankProfile(effectiveTitle);
      profile = { ...imp.profile, id: fresh.id, displayName: effectiveTitle, createdAt: fresh.createdAt };
    } else {
      profile = createBlankProfile(effectiveTitle);
      if (mode === 'import' && imp?.cv) profile = { ...profile, data: { ...profile.data, [lang]: imp.cv } };
    }
    profile = { ...profile, settings: { ...profile.settings, lang } };
    /* Der Name der Person steht im Lebenslauf, der Titel nur in der
       Übersicht — getrennt, seit der Titel als Name im PDF landete. */
    const nm = person.trim();
    if (nm) {
      const data = { ...profile.data };
      (Object.keys(data) as Lang[]).forEach(l => { data[l] = { ...data[l], personal: { ...data[l].personal, name: nm } }; });
      profile = { ...profile, data };
    }
    onConfirm(profile);
  }

  const field: React.CSSProperties = {
    width: '100%', minHeight: '46px', padding: '0 14px', border: 0, borderRadius: '12px',
    background: '#fff', boxShadow: 'inset 0 0 0 1px oklch(0.87 0.006 264)',
    fontFamily: 'inherit', fontSize: '15px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
  };
  const label: React.CSSProperties = { display: 'block', fontSize: 'var(--t-sm)', fontWeight: 620, color: 'var(--ink)', margin: '0 0 6px' };
  const hint: React.CSSProperties = { display: 'block', fontSize: 'var(--t-xs)', color: 'var(--ink-2)', marginTop: '5px' };

  return (
    <div className="ui"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'oklch(0.21 0.021 264 / 0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="cv-create-title" className="ui-float"
        style={{ background: 'var(--float-solid)', padding: 'clamp(20px, 4vw, 32px)', maxWidth: '620px', width: '100%', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 'var(--t-xs)', fontWeight: 600, color: 'var(--ink-2)', marginBottom: '6px' }}>{t.modalOverline}</div>
        <h2 id="cv-create-title" style={{ margin: '0 0 18px', fontSize: '24px', fontWeight: 650, letterSpacing: '-0.015em', color: 'var(--ink)' }}>{d.startTitle}</h2>

        <div className="ui-start" role="radiogroup" aria-label={d.startTitle}>
          {([
            { id: 'blank' as const, label: d.startBlank, desc: d.startBlankDesc },
            { id: 'demo' as const, label: d.startSample, desc: d.startSampleDesc },
            { id: 'import' as const, label: d.startImport, desc: d.startImportDesc },
          ]).map(o => (
            <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} onClick={() => setMode(o.id)}>
              <strong>{o.label}</strong>
              <span>{o.desc}</span>
            </button>
          ))}
        </div>

        {mode === 'import' && (
          <div style={{ marginTop: '14px', padding: '14px', borderRadius: '14px', background: 'oklch(1 0 0 / 0.7)', boxShadow: 'var(--pill-shadow)' }}>
            <p style={{ ...hint, marginTop: 0, marginBottom: '10px', fontSize: 'var(--t-sm)' }}>{d.importKinds}</p>
            <label className="ui-btn ui-btn-soft" style={{ minHeight: '44px', cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? <span className="cv-spin" aria-hidden /> : null}{d.importPick}
              <input type="file" accept=".zip,.csv,.json,.md,.markdown,.txt,application/json,text/markdown,text/plain" hidden disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }} />
            </label>
            <div role="status" aria-live="polite" style={{ ...hint, fontSize: 'var(--t-sm)', color: impErr ? 'var(--ats-low-ink)' : 'var(--ats-high-ink)' }}>
              {impErr ?? (imp ? d.importRead(imp.what) : '')}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '18px' }}>
          <div>
            <label htmlFor="cv-create-person" style={label}>{d.personName}</label>
            <input id="cv-create-person" type="text" value={person} onChange={e => setPerson(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder={d.personNamePlaceholder} autoComplete="name" style={field} />
            <span style={hint}>{d.personNameHint}</span>
          </div>
          <div>
            <label htmlFor="cv-create-title-field" style={label}>{d.titleLabel}</label>
            <input id="cv-create-title-field" type="text" value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} placeholder={t.namePlaceholder} style={field} />
            <span style={hint}>{d.titleHint}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} className="ui-btn ui-btn-soft" style={{ minHeight: '44px' }}>{t.cancel}</button>
          <button type="button" onClick={handleCreate} disabled={!ready} className="ui-btn ui-btn-primary" style={{ minHeight: '44px', padding: '0 20px' }}>
            {t.createProfile}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Template Strip — abstract previews of the layout archetypes ─────────

const STRIP_TILES: { id: string; name: string; render: (g: string, ink: string, rule: string) => React.ReactNode }[] = [
  // Single-column (top-row + body)
  { id: 'singlecol', name: 'Single', render: (g, ink, rule) => (
    <>
      <rect x="6" y="6" width="22" height="22" rx="11" fill={g} />
      <rect x="32" y="9" width="42" height="3" fill={ink} />
      <rect x="32" y="16" width="34" height="2" fill={rule} />
      <rect x="6" y="36" width="80" height="0.6" fill={rule} />
      <rect x="6" y="42" width="60" height="2" fill={ink} />
      <rect x="6" y="48" width="80" height="1" fill={rule} />
      <rect x="6" y="52" width="76" height="1" fill={rule} />
      <rect x="6" y="56" width="70" height="1" fill={rule} />
    </>
  )},
  // Sidebar left
  { id: 'sidebar', name: 'Sidebar', render: (g, ink, rule) => (
    <>
      <rect x="6" y="6" width="28" height="84" fill={g} opacity="0.18" />
      <rect x="12" y="14" width="16" height="16" rx="8" fill={g} />
      <rect x="12" y="34" width="20" height="2" fill={ink} />
      <rect x="12" y="40" width="16" height="1" fill={ink} opacity="0.5" />
      <rect x="40" y="10" width="46" height="3" fill={ink} />
      <rect x="40" y="18" width="32" height="2" fill={rule} />
      <rect x="40" y="34" width="46" height="1" fill={rule} />
      <rect x="40" y="38" width="42" height="1" fill={rule} />
      <rect x="40" y="42" width="38" height="1" fill={rule} />
    </>
  )},
  // Header-band
  { id: 'band', name: 'Band', render: (g, ink, rule) => (
    <>
      <rect x="0" y="0" width="92" height="22" fill={ink} />
      <rect x="6" y="6" width="10" height="10" rx="5" fill={g} />
      <rect x="20" y="9" width="36" height="2" fill={g} opacity="0.9" />
      <rect x="20" y="14" width="24" height="1.5" fill={g} opacity="0.6" />
      <rect x="6" y="30" width="56" height="1.5" fill={ink} />
      <rect x="6" y="36" width="80" height="1" fill={rule} />
      <rect x="6" y="40" width="76" height="1" fill={rule} />
      <rect x="6" y="44" width="70" height="1" fill={rule} />
      <rect x="68" y="30" width="22" height="60" fill={g} opacity="0.10" />
    </>
  )},
  // Top-centered (Wien)
  { id: 'topcenter', name: 'Wien', render: (g, ink, rule) => (
    <>
      <rect x="6" y="8" width="62" height="3" fill={ink} />
      <rect x="6" y="15" width="40" height="2" fill={rule} />
      <rect x="72" y="6" width="14" height="14" rx="2" fill={g} />
      <rect x="6" y="24" width="80" height="0.6" fill={ink} />
      <rect x="6" y="30" width="60" height="1.4" fill={ink} />
      <rect x="6" y="36" width="80" height="1" fill={rule} />
      <rect x="6" y="40" width="74" height="1" fill={rule} />
      <rect x="6" y="48" width="22" height="1.6" fill={ink} />
      <rect x="34" y="48" width="22" height="1.6" fill={ink} />
      <rect x="62" y="48" width="22" height="1.6" fill={ink} />
    </>
  )},
  // Timeline
  { id: 'timeline', name: 'Timeline', render: (g, ink, rule) => (
    <>
      <rect x="6" y="6" width="80" height="3" fill={ink} />
      <rect x="20" y="20" width="0.8" height="60" fill={rule} />
      <circle cx="20.4" cy="28" r="2" fill={g} />
      <circle cx="20.4" cy="48" r="2" fill={g} />
      <circle cx="20.4" cy="68" r="2" fill={g} />
      <rect x="26" y="26" width="50" height="2" fill={ink} />
      <rect x="26" y="32" width="40" height="1" fill={rule} />
      <rect x="26" y="46" width="46" height="2" fill={ink} />
      <rect x="26" y="52" width="36" height="1" fill={rule} />
      <rect x="26" y="66" width="48" height="2" fill={ink} />
      <rect x="26" y="72" width="38" height="1" fill={rule} />
    </>
  )},
  // Two-column
  { id: 'twocol', name: 'Dossier', render: (g, ink, rule) => (
    <>
      <rect x="6" y="6" width="80" height="3" fill={ink} />
      <rect x="6" y="14" width="40" height="2" fill={rule} />
      <rect x="6" y="24" width="80" height="0.6" fill={g} />
      <rect x="6" y="30" width="36" height="1.5" fill={ink} />
      <rect x="6" y="36" width="38" height="1" fill={rule} />
      <rect x="6" y="40" width="34" height="1" fill={rule} />
      <rect x="6" y="44" width="36" height="1" fill={rule} />
      <rect x="50" y="30" width="36" height="1.5" fill={ink} />
      <rect x="50" y="36" width="32" height="1" fill={rule} />
      <rect x="50" y="40" width="34" height="1" fill={rule} />
      <rect x="50" y="44" width="30" height="1" fill={rule} />
    </>
  )},
];

function TemplateStrip({ isMobile }: { isMobile: boolean }) {
  const t = HOME_I18N[useUiLang()];
  // Resolve the OKLCH tokens to real strings the SVG renderer accepts.
  return (
    <div>
      <div style={{ ...TYPE.overline, color: C.gold, marginBottom: '12px' }}>{t.stripOverline}</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
        gap: isMobile ? '10px' : '14px',
      }}>
        {STRIP_TILES.map(t => (
          <div key={t.id} style={{ border: B.hairline, background: C.white, padding: '6px' }}>
            <svg viewBox="0 0 92 96" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: 'auto' }} aria-hidden>
              <rect x="0" y="0" width="92" height="96" fill={RAW.paper} />
              {/* SVG-Attribute verstehen keine CSS-Variablen — hier die Literale. */}
              {t.render(RAW.gold, RAW.ink, RAW.rule)}
            </svg>
            <div style={{ ...TYPE.micromono, color: C.fade, marginTop: '6px', textAlign: 'center' }}>{t.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile Row (editorial card) ─────────────────────────────────────────

function ProfileRow({ profile, index, featured, onOpen, onDelete, onDuplicate }: {
  profile: AppProfile; index: number; featured: boolean;
  onOpen: () => void; onDelete: () => void; onDuplicate?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hover, setHover] = useState(false);
  const uiLang = useUiLang();
  const t = HOME_I18N[uiLang];
  const Fs = FASSUNG_I18N[uiLang];
  /* Gratis-Grenze: Duplizieren legt eine zweite Fassung an — ohne Pass mit
   * Schloss, der Klick öffnet das Freischalt-Paneel (App.tsx). */
  const ft = useFreeTier();
  const dupLocked = !ft.addProfile;
  const created = new Date(profile.createdAt).toLocaleDateString(t.dateLocale, { day: '2-digit', month: 'short', year: 'numeric' });
  const num = String(index + 1).padStart(2, '0');
  // Exponential ease-out (cubic-bezier ≈ ease-out-expo). No layout properties get animated.
  const EXPO_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    // Vorher ein reines div mit onClick: der Home-Screen hatte drei
    // fokussierbare Elemente und keines davon war ein Lebenslauf. Ohne Maus
    // kam man gar nicht in den Editor.
    <div
      role="button"
      tabIndex={0}
      aria-label={t.openAria(profile.displayName)}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        /* minmax statt auto: Auf 320 px schoben „Duplizieren × Öffnen →" die
           Zeile sonst über den Rand; jetzt bricht die Knopfgruppe um. */
        gridTemplateColumns: featured ? '72px minmax(0, 1fr) minmax(0, auto)' : '64px minmax(0, 1fr) minmax(0, auto)',
        alignItems: 'center', gap: featured ? '32px' : '24px',
        padding: featured ? '28px 16px' : '22px 16px',
        borderBottom: B.hairline,
        cursor: 'pointer',
        background: hover ? C.white : (featured ? C.paperDeep : 'transparent'),
        transition: `background 420ms ${EXPO_OUT}`,
      }}
    >
      <div style={{ ...TYPE.micromono, color: featured ? C.gold : C.fade }}>№ {num}</div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: F.display,
          fontSize: featured ? 'clamp(28px, 3vw, 36px)' : '22px',
          fontWeight: 500, color: C.ink, lineHeight: 1.05,
          letterSpacing: '-0.015em', marginBottom: '6px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontVariationSettings: featured ? '"opsz" 144' : '"opsz" 72',
        }}>
          {profile.displayName}
        </div>
        <div style={{ fontFamily: F.ui, fontSize: '11.5px', color: C.pencil, letterSpacing: '0.02em' }}>
          {featured && <span style={{ ...TYPE.overline, color: C.gold, marginRight: '12px' }}>{t.lastOpened}</span>}
          {t.metaLine(profile.settings.template, profile.settings.lang.toUpperCase(), created)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {onDuplicate && !confirmDelete && (
          <button type="button"
            onClick={e => { e.stopPropagation(); onDuplicate(); }}
            onKeyDown={e => e.stopPropagation()}
            title={dupLocked ? ft.priceLine : Fs.duplicateSub}
            data-locked={dupLocked || undefined}
            aria-label={`${Fs.duplicate}: ${profile.displayName}${dupLocked ? ` (${FREETIER_I18N[uiLang].inPass})` : ''}`}
            style={{ padding: '8px 10px', minHeight: '32px', background: 'transparent', border: B.hairline, borderRadius: '5px', fontFamily: F.ui, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em', color: C.pencil, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            {dupLocked && <LockGlyph size={11} />}{Fs.duplicate}
          </button>
        )}
        {confirmDelete ? (
          <button type="button"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ padding: '8px 14px', background: C.error, color: C.paper, border: 'none', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: F.ui }}>
            {t.confirmDelete}
          </button>
        ) : (
          <button type="button"
            onClick={e => { e.stopPropagation(); setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }}
            title={t.ttDelete}
            style={{ padding: '8px 10px', background: 'transparent', border: 'none', fontSize: '14px', color: C.fade, cursor: 'pointer' }}>
            ×
          </button>
        )}
        <div className="cv-home-open-label" style={{
          fontFamily: F.ui, fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: hover ? C.gold : C.pencil,
          transition: `color 380ms ${EXPO_OUT}`,
        }}>
          {t.open}
        </div>
      </div>
    </div>
  );
}

// ── HomeScreen ───────────────────────────────────────────────────────────

export default function HomeScreen({ profiles, onSelect, onCreate, onDelete, username, isAdmin, onLogout, onOpenAdmin, onOpenBackup, onDuplicate, readOnlyNote, banner, onOpenPass }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const { isMobile } = useViewport();
  const uiLangHome = useUiLang();
  const t = HOME_I18N[uiLangHome];
  /* Gratis-Grenze: eine Fassung ist frei. Ist sie angelegt, trägt „Neuer
   * Lebenslauf" das Schloss und die Preiszeile steht darunter — bevor jemand
   * ein Formular ausfüllt. Die unveränderte Demo zählt nicht mit. */
  const ft = useFreeTier();
  const createLocked = !readOnlyNote && !ft.addProfile;

  function handleCreate(profile: AppProfile) {
    setShowCreate(false);
    onCreate(profile);
  }

  return (
    <div style={{
      minHeight: '100vh', background: C.paper,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top metadata bar — brand left, account controls right */}
      <div style={{ borderBottom: B.hairline, padding: '12px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: C.paper }}>
        <div style={{ ...TYPE.micromono, color: C.ink }}>
          {APP_NAME.toUpperCase()} · {t.topBarTagline}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Seit der offenen Registrierung ist der Nutzername oft die
              E-Mail-Adresse — lang genug, um die Leiste aus dem Telefon zu
              schieben. Auf dem Telefon entfällt er, sonst wird gekürzt. */}
          {username && !isMobile && (
            <span title={username} style={{ ...TYPE.micromono, color: C.fade, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px', textTransform: 'none' }}>{username}</span>
          )}
          {isAdmin && onOpenAdmin && (
            <button type="button" onClick={onOpenAdmin} title={t.ttAdmin}
              style={{ padding: '5px 11px', background: C.ink, color: C.paper, border: 'none', fontFamily: F.ui, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {t.admin}
            </button>
          )}
          {onOpenPass && (
            <button type="button" onClick={onOpenPass}
              style={{ padding: '5px 12px', minHeight: '32px', background: 'transparent', border: B.hairline, borderRadius: '5px', fontFamily: F.ui, fontSize: '11px', fontWeight: 600, color: C.pencil, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {BILLING_I18N[uiLangHome].mpTitle}
            </button>
          )}
          {onOpenBackup && (
            <button type="button" onClick={onOpenBackup}
              style={{ padding: '5px 12px', minHeight: '32px', background: 'transparent', border: B.hairline, borderRadius: '5px', fontFamily: F.ui, fontSize: '11px', fontWeight: 600, color: C.pencil, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {LOCAL_I18N[uiLangHome].more}
            </button>
          )}
          {onLogout && (
            <button type="button" onClick={onLogout} title={t.ttSignOut}
              style={{ padding: '5px 12px', background: 'transparent', border: B.hairline, borderRadius: '5px', fontFamily: F.ui, fontSize: '11px', fontWeight: 600, color: C.pencil, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {t.signOut}
            </button>
          )}
        </div>
      </div>
      {banner && <div style={{ paddingTop: '10px' }}>{banner}</div>}

      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: isMobile ? '0 20px' : '0 32px' }}>
        <div style={{ width: '100%', maxWidth: '960px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: isMobile ? '20px' : '32px', padding: isMobile ? '40px 0 64px' : '64px 0 96px' }}>

          {/* Hero */}
          <div style={{ gridColumn: isMobile ? '1 / -1' : '1 / span 7' }}>
            <div style={{ ...TYPE.overline, color: C.gold, marginBottom: '16px' }}>{t.heroOverline}</div>
            <h1 style={{
              fontFamily: F.display,
              /* Ab 400 px wie bisher (56 px bis 7,4 vw, höchstens 104 px);
                 darunter kleiner, sonst läuft „Lebensläufe" bei 320 px aus
                 dem Bild. */
              fontSize: 'min(14vw, max(56px, 7.4vw), 104px)', fontWeight: 400,
              color: C.ink, lineHeight: 0.9, letterSpacing: '-0.028em', margin: 0,
              fontVariationSettings: '"opsz" 144',
              fontFeatureSettings: '"liga" 1, "calt" 1, "onum" 1',
            }}>
              {t.heroLine1}<br/>
              {t.heroLine2}<br/>
              {t.heroLine3}<em style={{ fontStyle: 'italic', fontWeight: 300, color: C.gold }}>{t.heroAccent}</em>
            </h1>
            <div style={{ marginTop: '20px', fontFamily: F.display, fontSize: 'clamp(20px, 2.3vw, 28px)', fontWeight: 400, lineHeight: 1.25, color: C.ink, letterSpacing: '-0.005em', maxWidth: '34ch' }}>
              {t.heroAnswer}
            </div>
          </div>

          <div style={{ gridColumn: isMobile ? '1 / -1' : '8 / span 5', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ fontFamily: F.ui, fontSize: '14px', fontWeight: 400, lineHeight: 1.6, color: C.pencil, marginBottom: '20px', maxWidth: '32ch' }}>
              {t.heroBlurb}
            </div>
            <div style={{ borderTop: B.hairline, paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ ...TYPE.micromono, color: C.gold }}>FAMILY & FRIENDS</div>
              <div style={{ fontFamily: F.ui, fontSize: '11.5px', color: C.fade }}>{t.heroNote}</div>
            </div>
          </div>

          {/* Vorlagen-Vorschau-Strip */}
          <div style={{ gridColumn: '1 / -1', marginTop: '32px' }}>
            <TemplateStrip isMobile={isMobile} />
          </div>

          {/* Divider */}
          <div style={{ gridColumn: '1 / -1', borderTop: B.hairline, marginTop: '36px' }} />

          {/* Profiles section */}
          <div style={{ gridColumn: isMobile ? '1 / -1' : '1 / span 3' }}>
            <div style={{ ...TYPE.overline, color: C.ink, marginBottom: '8px' }}>{t.profilesOverline}</div>
            <div style={{ fontFamily: F.ui, fontSize: '12px', color: C.pencil, lineHeight: 1.55 }}>
              {profiles.length === 0
                ? t.profilesEmpty
                : t.profilesCount(profiles.length)}
            </div>
            <button type="button" onClick={() => (createLocked ? ft.open('profiles') : setShowCreate(true))} disabled={!!readOnlyNote}
              data-locked={createLocked || undefined}
              aria-label={createLocked ? `${t.newResume} (${FREETIER_I18N[uiLangHome].inPass})` : undefined}
              style={{
                opacity: readOnlyNote ? 0.45 : 1, cursor: readOnlyNote ? 'not-allowed' : 'pointer',
                marginTop: '24px',
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                padding: '14px 22px', background: C.ink, color: C.paper,
                border: 'none', fontFamily: F.ui,
                fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
              {createLocked ? <LockGlyph size={14} /> : <span style={{ fontFamily: F.mono, fontSize: '14px', fontWeight: 400 }}>＋</span>}
              {t.newResume}
            </button>
            {createLocked && (
              <PassNote feature="profiles" label={FREETIER_I18N[uiLangHome].profilesLabel} style={{ marginTop: '12px', maxWidth: '46ch' }} />
            )}
            <div style={{ fontFamily: F.ui, fontSize: '11.5px', color: C.pencil, lineHeight: 1.6, marginTop: '14px', maxWidth: '46ch' }}>
              {readOnlyNote ?? t.profilesHint}
            </div>
          </div>

          <div style={{ gridColumn: isMobile ? '1 / -1' : '4 / span 9' }}>
            {profiles.length > 0 ? (
              <div style={{ borderTop: B.hairline }}>
                {profiles.map((p, i) => (
                  <ProfileRow
                    key={p.id} profile={p} index={i} featured={i === 0 && profiles.length > 1}
                    onOpen={() => onSelect(p.id)}
                    onDelete={() => onDelete(p.id)}
                    onDuplicate={onDuplicate ? () => onDuplicate(p.id) : undefined}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                borderTop: B.hairline, borderBottom: B.hairline,
                padding: '64px 0', textAlign: 'center',
              }}>
                <div style={{ ...TYPE.micromono, color: C.fade, marginBottom: '12px' }}>{t.emptyOverline}</div>
                <div style={{ fontFamily: F.display, fontSize: '32px', fontWeight: 300, fontStyle: 'italic', color: C.pencil }}>
                  {t.emptyHeadline}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ gridColumn: '1 / -1', borderTop: B.hairline, paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <div style={{ ...TYPE.micromono, color: C.fade }}>
              {APP_NAME.toUpperCase()} · {new Date().getFullYear()}
            </div>
            <div style={{ ...TYPE.micromono, color: C.fade }}>
              Family &amp; Friends · invite-only
            </div>
          </div>
        </div>
      </main>
      <SiteFooter lang={uiLangHome} />

      {showCreate && (
        <CreateModal onConfirm={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
