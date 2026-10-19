import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AppProfile, CVData, Lang } from '../data/types';
import { createDemoProfile, createBlankProfile, getLocalStoreStatus, subscribeLocalStore } from '../data/storage';
import { api, type Plan } from '../data/api';
import { DESIGN_I18N } from '../ui/i18n/design';
import { importedCv, importedName, type ImportResult } from '../import/readImport';
import { ImportPanel } from '../ui/ImportCv';
import { IMPORTCV_I18N } from '../ui/i18n/importcv';
import { useUiLang } from '../ui/useUiLang';
import { HOME_I18N } from '../ui/i18n/home';
import { FASSUNG_I18N } from '../ui/i18n/fassung';
import { BILLING_I18N } from '../ui/i18n/billing';
import { LOCAL_I18N } from '../ui/i18n/local';
import { KONTO_I18N, relativeDay, type KontoStrings } from '../ui/i18n/konto';
import { formatAccessDate } from '../ui/i18n/zugang';
import { APP_NAME } from '../brand';
import { SiteFooter } from '../billing/BillingShell';
import { useFreeTier } from '../billing/freeTier';
import { LockGlyph, PassNote } from '../billing/PassLock';
import { FREETIER_I18N } from '../ui/i18n/freetier';
import { PATHS, linkClick } from '../billing/route';
import ResumeRenderer from '../templates/ResumeRenderer';
import { getTheme, resolvePairing } from '../templates/theme';
import { metricsFor } from '../templates/metrics';
import { StaticPage } from '../preview/TemplateCarousel';
import { pageSizePx } from '../preview/scale';
import { Wordmark } from './AuthScreen';
import './home.css';

/**
 * Übersicht der eigenen Lebensläufe.
 *
 * Runde 8 (10.10.2026, Auftrag: „überarbeite den Anmelde-Screen mit der
 * Übersicht der eigenen Lebensläufe"). Vorher eine Liste im Zeitschriften-
 * Look (Fraunces, № 01) mit sechs abstrakten Vorlagen-Skizzen — hübsch, aber
 * man sah nicht, welcher Lebenslauf welcher ist. Jetzt:
 *
 *  • Karten mit echter Miniatur jeder Fassung (derselbe Renderer wie die
 *    Vorschau, statisch, erst gerendert, wenn die Karte ins Bild kommt),
 *    Titel, Vorlage, Sprachen, wann zuletzt geändert, wo gespeichert.
 *  • Schnellaktionen: Öffnen, PDF, Duplizieren, Umbenennen, Löschen mit
 *    Rückgängig (sieben Sekunden; erst danach wird wirklich gelöscht).
 *  • Die Start-Wahl (leer, Beispiel, Import) als Kacheln — im leeren Zustand
 *    als Hauptinhalt, sonst unter den Karten.
 *  • Zugang (Pass, Gutschein) und Sicherung kompakt oben.
 *
 * Die ganze Karte öffnet den Lebenslauf über eine Fläche des Öffnen-Knopfs.
 * Bis Runde 7 war die Zeile selbst ein `role="button"` mit Knöpfen darin —
 * axe meldete das als `nested-interactive`.
 *
 * Neue, optionale Props (App.tsx, Patch in der Rückgabe von Runde 8):
 * `onRename`, `onExportPdf`, `plan`, `localMode`. Fehlen sie, verschwinden
 * die zugehörigen Knöpfe; Plan und Speicherort werden dann selbst ermittelt.
 */

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
  /** Titel einer Fassung ändern (fehlt im Nur-Lese-Modus). */
  onRename?: (id: string, displayName: string) => void;
  /** Fassung öffnen und das PDF herunterladen (Export-Paneel). */
  onExportPdf?: (id: string) => void;
  /** Plan des Kontos; fehlt er, holt die Übersicht ihn selbst (/api/auth/me). */
  plan?: Plan | null;
  /** Lokalmodus (ohne Konto). Fehlt es, gilt: Sicherung angeboten = lokal. */
  localMode?: boolean;
  /** Marketing-Startseite öffnen (App.tsx, 11.10.2026). */
  onOpenLanding?: () => void;
}

// ── Anlege-Dialog ───────────────────────────────────────────────────────────

type StartMode = 'blank' | 'demo' | 'import';

function CreateModal({ initialMode, onConfirm, onClose }: {
  initialMode: StartMode;
  onConfirm: (profile: AppProfile) => void;
  onClose: () => void;
}) {
  const uiLang = useUiLang();
  const t = HOME_I18N[uiLang];
  const d = DESIGN_I18N[uiLang];
  const [title, setTitle] = useState('');
  const [person, setPerson] = useState('');
  const [mode, setMode] = useState<StartMode>(initialMode);
  const [imp, setImp] = useState<ImportResult | null>(null);
  const ic = IMPORTCV_I18N[uiLang];
  const lang: Lang = (['de', 'en', 'fr', 'es'] as Lang[]).includes(uiLang as Lang) ? uiLang as Lang : 'de';
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  /* Beim Übernehmen steht der Name meist im Text: dann muss niemand einen
     Titel tippen, bevor der Knopf geht. */
  const impName = mode === 'import' && imp ? importedName(imp) : '';
  const effectiveTitle = title.trim() || person.trim() || impName;
  const ready = !!effectiveTitle && (mode !== 'import' || !!imp);

  function handleCreate() {
    if (!ready) return;
    let profile: AppProfile;
    if (mode === 'demo') profile = createDemoProfile(effectiveTitle);
    else if (mode === 'import' && imp?.profile) {
      const fresh = createBlankProfile(effectiveTitle);
      profile = { ...imp.profile, id: fresh.id, displayName: effectiveTitle, createdAt: fresh.createdAt };
    } else {
      profile = createBlankProfile(effectiveTitle);
      const cv = mode === 'import' && imp ? importedCv(imp, ic.unsortedSection) : undefined;
      if (cv) profile = { ...profile, data: { ...profile.data, [lang]: cv } };
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
    fontFamily: 'inherit', fontSize: '16px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box',
  };
  const label: React.CSSProperties = { display: 'block', fontSize: 'var(--t-sm)', fontWeight: 620, color: 'var(--ink)', margin: '0 0 6px' };
  const hint: React.CSSProperties = { display: 'block', fontSize: 'var(--t-xs)', color: 'var(--ink-2)', marginTop: '5px' };

  return (
    <div className="ui"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'oklch(0.21 0.021 264 / 0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cv-create-title" className="ui-float kh-rise"
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
          <div style={{ marginTop: '14px' }}>
            <p style={{ ...hint, marginTop: 0, marginBottom: '10px', fontSize: 'var(--t-sm)', lineHeight: 1.55 }}>{ic.lede}</p>
            <ImportPanel cvLang={lang} onParsed={setImp} />
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

// ── Kleine Bausteine ────────────────────────────────────────────────────────

const Icon = {
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>,
  dots: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>,
  down: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>,
  copy: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>,
  key: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></svg>,
  disk: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>,
  browser: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18" /></svg>,
  cloud: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.5 3.5 0 0 0 7 18z" /></svg>,
};

/** Schematische Skizzen der drei Startwege (keine echten Seiten). */
function TileArt({ kind }: { kind: StartMode }) {
  if (kind === 'blank') return (
    <svg width="34" height="44" viewBox="0 0 34 44" fill="none" aria-hidden>
      <rect x="1" y="1" width="32" height="42" rx="3" fill="#fff" stroke="currentColor" strokeOpacity="0.35" />
      <path d="M17 16v12M11 22h12" stroke="var(--accent-ink)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
  if (kind === 'demo') return (
    <svg width="34" height="44" viewBox="0 0 34 44" fill="none" aria-hidden>
      <rect x="1" y="1" width="32" height="42" rx="3" fill="#fff" stroke="currentColor" strokeOpacity="0.35" />
      <circle cx="9.5" cy="10" r="4" fill="var(--accent)" fillOpacity="0.28" />
      <rect x="16" y="7" width="12" height="2.4" rx="1.2" fill="currentColor" fillOpacity="0.7" />
      <rect x="16" y="11.5" width="9" height="1.6" rx="0.8" fill="currentColor" fillOpacity="0.35" />
      {[19, 23, 27, 31, 35].map(y => <rect key={y} x="6" y={y} width={y % 8 === 3 ? 16 : 22} height="1.6" rx="0.8" fill="currentColor" fillOpacity="0.3" />)}
    </svg>
  );
  return (
    <svg width="38" height="44" viewBox="0 0 38 44" fill="none" aria-hidden>
      <rect x="1" y="9" width="28" height="34" rx="3" fill="#fff" stroke="currentColor" strokeOpacity="0.35" />
      <path d="M27 2v16M21 12l6 6 6-6" stroke="var(--accent-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {[24, 28, 32].map(y => <rect key={y} x="6" y={y} width="16" height="1.6" rx="0.8" fill="currentColor" fillOpacity="0.3" />)}
    </svg>
  );
}

/** Kurzer, stabiler Fingerabdruck eines Profils (FNV-1a). Fotos als
 *  data:-URL gehen nur mit ihrer Länge ein — sonst hieße das, Megabytes zu
 *  hashen, nur um „geändert" zu erkennen. */
function fingerprint(p: AppProfile): string {
  const s = JSON.stringify({ n: p.displayName, d: p.data, c: p.coverLetters, s: p.settings },
    (_k, v) => (typeof v === 'string' && v.startsWith('data:') ? `data:${v.length}` : v));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${(h >>> 0).toString(36)}.${s.length}`;
}

const SEEN_KEY = 'cv-home-seen';
/** Wann wurde eine Fassung zuletzt geändert?
 *
 *  Mit Konto weiß es der Server (`updated_at`). Im Browser gibt es keinen
 *  Zeitstempel je Fassung; die Übersicht merkt sich deshalb je Fassung einen
 *  Fingerabdruck. Hat er sich seit dem letzten Besuch der Übersicht
 *  geändert, gilt „jetzt". Das ist auf die Rückkehr aus dem Editor genau,
 *  nicht auf die Minute — für „vor 3 Tagen" reicht es. */
function useChangedAt(profiles: AppProfile[], local: boolean): Record<string, string> {
  const [server, setServer] = useState<Record<string, string>>({});
  const count = profiles.length;
  useEffect(() => {
    if (local) return;
    let alive = true;
    api.listResumes().then(r => {
      if (!alive) return;
      const m: Record<string, string> = {};
      for (const x of r.resumes || []) if (x.updated_at) m[x.id] = x.updated_at;
      setServer(m);
    }).catch(() => { /* ohne Zeitstempel geht es auch */ });
    return () => { alive = false; };
  }, [local, count]);
  const seen = useMemo(() => {
    let store: Record<string, { f: string; at: string }> = {};
    try { store = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { store = {}; }
    const now = new Date().toISOString();
    const out: Record<string, string> = {};
    const next: typeof store = {};
    for (const p of profiles) {
      const f = fingerprint(p);
      const prev = store[p.id];
      const at = !prev ? p.createdAt : prev.f !== f ? now : prev.at;
      next[p.id] = { f, at };
      out[p.id] = at;
    }
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* privates Fenster: dann eben ohne */ }
    return out;
  }, [profiles]);
  return local ? seen : { ...seen, ...server };
}

/** Plan des Kontos: aus den Props oder einmal selbst geholt. */
function usePlan(given: Plan | null | undefined, signedIn: boolean): Plan | null | undefined {
  const [fetched, setFetched] = useState<Plan | null | undefined>(undefined);
  useEffect(() => {
    if (given !== undefined || !signedIn) return;
    let alive = true;
    api.me().then(d => { if (alive) setFetched(d.user?.plan ?? null); }).catch(() => { if (alive) setFetched(null); });
    return () => { alive = false; };
  }, [given, signedIn]);
  return given !== undefined ? given : fetched;
}

// ── Karte einer Fassung ─────────────────────────────────────────────────────

const ALL_LANGS: Lang[] = ['de', 'en', 'fr', 'es'];
/** Sprachen mit eigenem Inhalt. Eine Sprachfassung, die nur eine Kopie einer
 *  anderen ist (so legt das Werkzeug neue Sprachen an), zählt nicht als
 *  eigene Sprache — sonst stünde an jedem Beispiel „DE · EN · FR · ES".
 *  Die gewählte Sprache steht immer vorn. */
function langsOf(p: AppProfile): Lang[] {
  const cur = p.settings.lang;
  const body = (cv?: CVData) => cv ? JSON.stringify([cv.profile?.text ?? '', cv.experience ?? [], cv.education ?? [], cv.skillGroups ?? [],
    cv.languages ?? [], cv.additionalExperience ?? [], cv.projects ?? [], cv.certificates ?? [], cv.customSections ?? []]) : '';
  const empty = body({ profile: { text: '' }, experience: [], education: [], skillGroups: [], languages: [] } as unknown as CVData);
  const seen = new Map<string, Lang>();
  for (const l of [cur, ...ALL_LANGS.filter(x => x !== cur)]) {
    const b = body(p.data[l]);
    if (!b || b === empty || seen.has(b)) continue;
    seen.set(b, l);
  }
  const out = [...seen.values()];
  return out.length ? out : [cur];
}

function Thumb({ profile, alt, badge }: { profile: AppProfile; alt: string; badge?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    if (seen) return () => ro.disconnect();
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '240px' });
    io.observe(el);
    return () => { ro.disconnect(); io.disconnect(); };
  }, [seen]);
  const s = profile.settings;
  const fmt = s.pageFormat ?? 'a4';
  const page = pageSizePx(fmt);
  const node = useMemo(() => {
    if (!seen || !w) return null;
    const th = getTheme(s.template, s.accent, s.paper);
    const pr = resolvePairing(th, s.fontPairing ?? 'auto');
    const data = profile.data[s.lang] ?? profile.data.de;
    return (
      <div className="kh-thumb-page cv-doc-context">
        <StaticPage scale={w / page.w} pageFormat={fmt} render={() => (
          <ResumeRenderer data={data} theme={th} pairing={pr} metrics={metricsFor(0.5, s.fontScale ?? 1)}
            hiddenSections={s.hiddenSections} sectionOrder={s.sectionOrder} pageFormat={fmt} />
        )} />
      </div>
    );
  }, [seen, w, profile, s, fmt, page.w]);
  return (
    <div ref={ref} className="kh-thumb">
      <div role="img" aria-label={alt} style={{ position: 'absolute', inset: 0 }}>
        {node ?? <div className="kh-thumb-skel" aria-hidden />}
      </div>
      {badge}
    </div>
  );
}

function ProfileCard({ profile, index, local, changedAt, x, onOpen, onDelete, onDuplicate, onRename, onExportPdf }: {
  profile: AppProfile; index: number; local: boolean; changedAt?: string; x: KontoStrings;
  onOpen: () => void; onDelete: () => void; onDuplicate?: () => void;
  onRename?: (name: string) => void; onExportPdf?: () => void;
}) {
  const uiLang = useUiLang();
  const t = HOME_I18N[uiLang];
  const Fs = FASSUNG_I18N[uiLang];
  /* Gratis-Grenze: Duplizieren legt eine zweite Fassung an — ohne Pass mit
   * Schloss, der Klick öffnet das Freischalt-Paneel (App.tsx). */
  const ft = useFreeTier();
  const dupLocked = !ft.addProfile;
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(profile.displayName);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const theme = getTheme(profile.settings.template);
  const langs = useMemo(() => langsOf(profile), [profile]);
  const name = profile.displayName;

  useEffect(() => {
    if (!menu) return;
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !menuBtn.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menu]);
  useEffect(() => { if (renaming) renameRef.current?.select(); }, [renaming]);

  function menuKey(e: React.KeyboardEvent) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); setMenu(false); menuBtn.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Tab') setMenu(false);
  }
  function saveRename() {
    const v = draft.trim();
    if (v && v !== name) onRename?.(v);
    setRenaming(false);
  }

  return (
    <li className="kh-card kh-rise" style={{ ['--i' as string]: Math.min(index, 8) + 2 }} data-menu-open={menu || undefined} data-profile-id={profile.id}>
      <Thumb profile={profile} alt={x.thumbAlt(name, theme.name)} badge={
        <span className="kh-store" title={local ? x.storeLocalTitle : x.storeAccountTitle}>
          {local ? Icon.browser : Icon.cloud}{local ? x.storeLocal : x.storeAccount}
        </span>
      } />
      <div className="kh-card-body">
        {renaming ? (
          <form className="kh-rename" onSubmit={e => { e.preventDefault(); saveRename(); }}>
            <label htmlFor={`kh-rn-${profile.id}`}>{x.renameLabel}</label>
            <input id={`kh-rn-${profile.id}`} ref={renameRef} value={draft} maxLength={120}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setDraft(name); setRenaming(false); } }} />
            <div className="kh-rename-row">
              <button type="submit" className="ui-btn ui-btn-primary">{x.renameSave}</button>
              <button type="button" className="ui-btn ui-btn-soft" onClick={() => { setDraft(name); setRenaming(false); }}>{x.renameCancel}</button>
            </div>
          </form>
        ) : (
          <h3 className="kh-card-title">{name}</h3>
        )}
        <p className="kh-card-meta">
          {theme.name} · <span className="ui-num">{langs.map(l => l.toUpperCase()).join(' · ')}</span>
          <span className="kh-card-store-m"> · {local ? x.storeLocal : x.storeAccount}</span>
        </p>
        <p className="kh-card-meta">
          {changedAt ? x.changed(relativeDay(changedAt, x.locale, x.justNow)) : x.created(new Date(profile.createdAt).toLocaleDateString(x.locale))}
        </p>
        {!renaming && (
          <div className="kh-actions">
            <button type="button" className="ui-btn ui-btn-primary kh-open" onClick={onOpen} aria-label={t.openAria(name)}>{x.open}</button>
            {onExportPdf && (
              <button type="button" className="ui-btn ui-btn-soft" onClick={onExportPdf} aria-label={x.pdfAria(name)} title={x.pdfAria(name)}>
                {Icon.down}{x.pdf}
              </button>
            )}
            {onDuplicate && (
              <button type="button" className="ui-btn ui-btn-soft" onClick={onDuplicate}
                title={dupLocked ? ft.priceLine : Fs.duplicateSub}
                data-locked={dupLocked || undefined}
                aria-label={`${Fs.duplicate}: ${name}${dupLocked ? ` (${FREETIER_I18N[uiLang].inPass})` : ''}`}>
                {dupLocked ? <LockGlyph size={12} /> : Icon.copy}{Fs.duplicate}
              </button>
            )}
            <button ref={menuBtn} type="button" className="ui-btn ui-btn-soft kh-more" aria-haspopup="menu" aria-expanded={menu}
              aria-label={x.more(name)} title={x.more(name)} onClick={() => setMenu(m => !m)}>
              {Icon.dots}
            </button>
          </div>
        )}
      </div>
      {menu && (
        <div ref={menuRef} className="ui-menu ui-float kh-menu" role="menu" aria-label={x.more(name)} onKeyDown={menuKey}>
          {onRename && (
            <button type="button" role="menuitem" className="ui-menu-item" onClick={() => { setMenu(false); setDraft(name); setRenaming(true); }}>{x.rename}</button>
          )}
          <button type="button" role="menuitem" className="ui-menu-item is-danger" aria-label={x.removeAria(name)} onClick={() => { setMenu(false); onDelete(); }}>{x.remove}</button>
        </div>
      )}
    </li>
  );
}

// ── Übersicht ───────────────────────────────────────────────────────────────

export default function HomeScreen({ profiles, onSelect, onCreate, onDelete, username, isAdmin, onLogout, onOpenAdmin, onOpenBackup, onDuplicate, readOnlyNote, banner, onOpenPass, onRename, onExportPdf, plan: planProp, localMode, onOpenLanding }: Props) {
  const [createMode, setCreateMode] = useState<StartMode | null>(null);
  const uiLang = useUiLang();
  const t = HOME_I18N[uiLang];
  const d = DESIGN_I18N[uiLang];
  const x = KONTO_I18N[uiLang];
  const L = LOCAL_I18N[uiLang];
  const local = localMode ?? (!!onOpenBackup && !username);
  /* Gratis-Grenze: eine Fassung ist frei. Ist sie angelegt, trägt „Neuer
   * Lebenslauf" das Schloss und die Preiszeile steht darunter — bevor jemand
   * ein Formular ausfüllt. Die unveränderte Demo zählt nicht mit. */
  const ft = useFreeTier();
  const createLocked = !readOnlyNote && !ft.addProfile;
  const plan = usePlan(planProp, !local && !!username);
  const store = useSyncExternalStore(subscribeLocalStore, getLocalStoreStatus, getLocalStoreStatus);

  // ── Löschen mit Rückgängig ────────────────────────────────────────────────
  /* Erst nach sieben Sekunden wird wirklich gelöscht. Verlässt man die
   * Übersicht vorher (Fassung öffnen, Seite schließen), wird es sofort
   * erledigt — „Rückgängig" gilt nur, solange die Meldung steht. */
  const [pending, setPending] = useState<string[]>([]);
  const [toast, setToast] = useState<{ id: string; name: string } | null>(null);
  const timers = useRef(new Map<string, number>());
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const commit = useCallback((id: string) => {
    const tm = timers.current.get(id);
    if (tm !== undefined) window.clearTimeout(tm);
    if (!timers.current.has(id)) return;
    timers.current.delete(id);
    onDeleteRef.current(id);
    setPending(p => p.filter(x2 => x2 !== id));
    setToast(cur => (cur?.id === id ? null : cur));
  }, []);
  function askDelete(p: AppProfile) {
    setPending(ps => [...ps, p.id]);
    setToast({ id: p.id, name: p.displayName });
    timers.current.set(p.id, window.setTimeout(() => commit(p.id), 7000));
  }
  function undoDelete(id: string) {
    const tm = timers.current.get(id);
    if (tm !== undefined) window.clearTimeout(tm);
    timers.current.delete(id);
    setPending(p => p.filter(x2 => x2 !== id));
    setToast(null);
  }
  useEffect(() => {
    const flush = () => { for (const id of [...timers.current.keys()]) commit(id); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [commit]);

  const visible = profiles.filter(p => !pending.includes(p.id));
  const changedAt = useChangedAt(profiles, local);

  function startWith(mode: StartMode) {
    if (readOnlyNote) return;
    if (createLocked) { ft.open('profiles'); return; }
    setCreateMode(mode);
  }
  function handleCreate(profile: AppProfile) {
    setCreateMode(null);
    onCreate(profile);
  }

  // ── Zugang ────────────────────────────────────────────────────────────────
  let access: string;
  if (local) access = x.passLocal;
  else if (isAdmin || plan?.kind === 'unlimited') access = x.passUnlimited;
  else if (plan?.kind === 'lifetime') access = x.passLifetime;
  else if ((plan?.kind === 'pass' || plan?.kind === 'pilot') && plan.notice !== 'expired' && plan.until)
    access = x.passActive(formatAccessDate(plan.until, uiLang), Math.max(0, plan.daysLeft ?? 0));
  else if (plan?.until && (plan.kind === 'none' || plan.notice === 'expired')) access = x.passExpired(formatAccessDate(plan.until, uiLang));
  else if (plan === undefined) access = '…';
  else access = ft.limited ? x.passNoneFree : x.passNone;

  const tiles: { id: StartMode; label: string; desc: string }[] = [
    { id: 'blank', label: d.startBlank, desc: d.startBlankDesc },
    { id: 'demo', label: d.startSample, desc: d.startSampleDesc },
    { id: 'import', label: d.startImport, desc: d.startImportDesc },
  ];
  const tileButtons = (
    <div className="kh-tiles">
      {tiles.map((o, i) => (
        <button key={o.id} type="button" className="kh-tile kh-rise" style={{ ['--i' as string]: i + 3 }}
          onClick={() => startWith(o.id)} disabled={!!readOnlyNote} data-start={o.id}
          data-locked={createLocked || undefined}
          aria-label={`${o.label}: ${o.desc}${createLocked ? ` (${FREETIER_I18N[uiLang].inPass})` : ''}`}>
          <span className="kh-tile-art"><TileArt kind={o.id} /></span>
          <span>
            <strong>{createLocked && <LockGlyph size={12} />}{o.label}</strong>
            <span className="kh-tile-desc">{o.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="ui kh" lang={uiLang}>
      <header className="kh-top">
        {/* Wortmarke führt zur Startseite (11.10.2026), wie auf jeder Website üblich. */}
        {onOpenLanding
          ? <a className="kh-brand" href="/?start" aria-label={`${APP_NAME} – ${BILLING_I18N[uiLang].home}`}
              style={{ color: 'inherit', textDecoration: 'none' }}
              onClick={(e) => { e.preventDefault(); onOpenLanding(); }}><Wordmark /></a>
          : <span className="kh-brand"><Wordmark /></span>}
        <div className="kh-top-right">
          {username && <span className="kh-user" title={username}>{username}</span>}
          {isAdmin && onOpenAdmin && (
            <button type="button" className="ui-btn ui-btn-soft" onClick={onOpenAdmin} title={t.ttAdmin}>{t.admin}</button>
          )}
          {onOpenPass && (
            <button type="button" className="ui-btn ui-btn-soft" onClick={onOpenPass}>{BILLING_I18N[uiLang].mpTitle}</button>
          )}
          {/* Im Lokalmodus steht die Sicherung als eigene Zeile im Status
              darunter; oben nur, wenn diese Zeile fehlt. */}
          {onOpenBackup && !local && (
            <button type="button" className="ui-btn ui-btn-soft" onClick={onOpenBackup}>{L.more}</button>
          )}
          {onLogout && (
            <button type="button" className="ui-btn ui-btn-soft" onClick={onLogout} title={t.ttSignOut}>{t.signOut}</button>
          )}
        </div>
      </header>
      {banner && <div style={{ paddingTop: '4px' }}>{banner}</div>}

      <main className="kh-main">
        <div className="kh-head">
          <div className="kh-rise" style={{ ['--i' as string]: 0 }}>
            <h1 className="kh-h1">{x.homeTitle}</h1>
            <p className="kh-sub">
              {visible.length > 0 && <span>{x.homeCount(visible.length)}</span>}
              <span className="kh-where">{local ? x.whereLocal : x.whereAccount}</span>
            </p>
          </div>
          <div className="kh-head-actions kh-rise" style={{ ['--i' as string]: 1 }}>
            <button type="button" className="kh-new" onClick={() => startWith('blank')} disabled={!!readOnlyNote}
              data-locked={createLocked || undefined}
              aria-label={createLocked ? `${t.newResume} (${FREETIER_I18N[uiLang].inPass})` : undefined}>
              <span>{t.newResume}</span>
              <span className="kh-new-icon">{createLocked ? <LockGlyph size={14} /> : Icon.plus}</span>
            </button>
            {/* Zweiter Weg gleich daneben (19.10.2026): Wer schon einen
                Lebenslauf hat, soll nicht erst „Neu" wählen müssen. */}
            {!readOnlyNote && !createLocked && (
              <button type="button" className="ui-btn ui-btn-soft" onClick={() => startWith('import')} style={{ minHeight: '44px' }}>
                {IMPORTCV_I18N[uiLang].title}
              </button>
            )}
            {createLocked && <PassNote feature="profiles" label={FREETIER_I18N[uiLang].profilesLabel} style={{ maxWidth: '46ch' }} />}
            {readOnlyNote && <p className="kh-note">{readOnlyNote}</p>}
          </div>
        </div>

        <div className="kh-status">
          <div className="kh-stat kh-rise" style={{ ['--i' as string]: 2 }} data-access>
            <span className="kh-stat-icon">{Icon.key}</span>
            <span className="kh-stat-text"><strong>{x.passTitle}</strong>{access}</span>
            <span className="kh-stat-actions">
              {onOpenPass && <button type="button" className="ui-btn ui-btn-soft" onClick={onOpenPass}>{x.passManage}</button>}
              <a href={PATHS.code} onClick={linkClick(PATHS.code)} className="kh-stat-link">{x.codeShort}</a>
            </span>
          </div>
          {local && onOpenBackup && (
            <div className="kh-stat kh-rise" style={{ ['--i' as string]: 3 }} data-backup>
              <span className="kh-stat-icon">{Icon.disk}</span>
              <span className="kh-stat-text">
                <strong>{x.backupTitle}</strong>
                {store.lastBackupAt ? x.backupLast(relativeDay(store.lastBackupAt, x.locale, x.justNow)) : x.backupNever}
              </span>
              <span className="kh-stat-actions">
                <button type="button" className="ui-btn ui-btn-soft" onClick={onOpenBackup}>{L.more}</button>
              </span>
            </div>
          )}
        </div>

        {visible.length > 0 ? (
          <>
            <h2 className="cv-sr-only">{x.homeTitle}</h2>
            <ul className="kh-grid">
              {visible.map((p, i) => (
                <ProfileCard key={p.id} profile={p} index={i} local={local} changedAt={changedAt[p.id]} x={x}
                  onOpen={() => onSelect(p.id)}
                  onDelete={() => askDelete(p)}
                  onDuplicate={onDuplicate ? () => onDuplicate(p.id) : undefined}
                  onRename={onRename ? (n => onRename(p.id, n)) : undefined}
                  onExportPdf={onExportPdf ? () => onExportPdf(p.id) : undefined} />
              ))}
            </ul>
            <section className="kh-start" aria-labelledby="kh-start-h">
              <h2 id="kh-start-h" className="kh-section-title">{x.startTitle}</h2>
              <p className="kh-start-lead">{x.startLead}</p>
              {tileButtons}
            </section>
          </>
        ) : (
          <section className="kh-empty kh-rise" style={{ ['--i' as string]: 3 }} aria-labelledby="kh-empty-h">
            <div className="kh-empty-inner">
              <div className="kh-empty-head">
                <div>
                  <h2 id="kh-empty-h">{x.emptyTitle}</h2>
                  <p>{x.emptyLead}</p>
                </div>
                <svg className="kh-empty-art" width="160" height="112" viewBox="0 0 160 112" fill="none" aria-hidden>
                  <rect x="22" y="14" width="70" height="92" rx="5" fill="#fff" stroke="currentColor" strokeOpacity="0.25" transform="rotate(-6 57 60)" />
                  <rect x="56" y="6" width="74" height="98" rx="5" fill="#fff" stroke="currentColor" strokeOpacity="0.35" />
                  <circle cx="72" cy="24" r="7" fill="var(--accent)" fillOpacity="0.22" />
                  <rect x="84" y="19" width="34" height="4" rx="2" fill="currentColor" fillOpacity="0.55" />
                  <rect x="84" y="27" width="24" height="3" rx="1.5" fill="currentColor" fillOpacity="0.3" />
                  {[44, 52, 60, 68, 76, 84].map((y, i) => <rect key={y} x="66" y={y} width={i % 3 === 2 ? 36 : 54} height="3" rx="1.5" fill="currentColor" fillOpacity="0.22" />)}
                </svg>
              </div>
              {tileButtons}
              <p className="kh-empty-hint">{x.emptyHint}</p>
            </div>
          </section>
        )}
      </main>
      <div className="kh-foot"><SiteFooter lang={uiLang} onLanding={onOpenLanding} /></div>

      {toast && (
        <div role="status" aria-live="polite" className="ui-toast ui kh-toast">
          <span>{x.removed(toast.name)}</span>
          <button type="button" onClick={() => undoDelete(toast.id)}>{x.undo}</button>
        </div>
      )}

      {createMode && (
        <CreateModal initialMode={createMode} onConfirm={handleCreate} onClose={() => setCreateMode(null)} />
      )}
    </div>
  );
}
