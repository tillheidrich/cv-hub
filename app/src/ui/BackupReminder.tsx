/**
 * Sicherungshinweis und Sicherungsfenster für den Lokalmodus.
 *
 * ── Einbindung in App.tsx (für den Gestaltungs-Agenten) ──────────────────────
 *
 *   import BackupReminder from './ui/BackupReminder';
 *
 *   // ganz unten im Editor- UND im Home-Zweig, neben `langNotice`/`softWall`:
 *   <BackupReminder
 *     active={demoMode}                 // nur im Lokalmodus; mit Konto liegt nichts lokal
 *     bottomOffset={isMobile ? 84 : 20} // über der mobilen Moduszeile, wie langNotice
 *     onProfilesReplaced={(ps) => {     // nach „Sicherung laden" / „Alles löschen"
 *       setProfiles(ps);
 *       if (!ps.some(p => p.id === activeId)) { setActiveId(ps[0]?.id ?? null); if (!ps.length) setScreen('home'); }
 *     }}
 *   />
 *
 * Bedingung: `active` (= Lokalmodus). Die Komponente entscheidet selbst, ob sie
 * etwas zeigt:
 *   • Speicherfehler (voll, gesperrt, kein Speicher) → rote Karte, sofort,
 *     ohne „Später" — mit „Jetzt sichern", denn die Daten stehen dann nur noch
 *     im Arbeitsspeicher dieses Fensters.
 *   • Sonst der Hinweis, wenn es lokale Profile gibt, seit der letzten Sicherung
 *     etwas bearbeitet wurde UND die letzte Sicherung nie war oder älter als
 *     7 Tage ist, und „Später" (3 Tage) nicht gilt (`shouldRemindBackup` in
 *     data/storage.ts).
 *
 * Das Sicherungsfenster (`LocalBackupPanel`, „Alles sichern" / „Sicherung
 * laden" mit Vorschau / „Alle lokalen Daten löschen") öffnet der Hinweis über
 * „Sicherung…". Es lässt sich auch direkt einbinden — empfohlen als Eintrag im
 * Mehr-Menü des Lokalmodus und auf der Profilübersicht, damit jemand, dessen
 * Daten Safari gelöscht hat, seine Sicherung auch ohne Hinweis zurückholt
 * (der Hinweis erscheint ja nur, wenn es lokale Profile gibt):
 *
 *   import { LocalBackupPanel } from './ui/BackupReminder';
 *   {backupOpen && <LocalBackupPanel onClose={() => setBackupOpen(false)} onProfilesReplaced={…wie oben…} />}
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { AppProfile } from '../data/types';
import {
  getLocalStoreStatus, subscribeLocalStore, downloadBackup, snoozeBackupReminder, shouldRemindBackup,
  parseBackup, previewRestore, restoreBackup, clearLocalStore,
  type LocalStoreStatus, type ParsedBackup, type RestorePreview,
} from '../data/storage';
import { useUiLang } from './useUiLang';
import { LOCAL_I18N, type LocalStrings } from './i18n/local';

const DAY = 86400_000;
/** Ab so vielen Tagen ohne Sicherung erinnert der Hinweis. */
const BACKUP_REMIND_DAYS = 7;

const F = {
  ui: "var(--ui, 'Inter', system-ui, sans-serif)",
  ink: 'var(--ink, oklch(0.21 0.021 264))',
  ink2: 'var(--ink-2, oklch(0.40 0.017 264))',
  ink3: 'var(--ink-3, oklch(0.48 0.014 264))',
  hair: 'var(--hair, oklch(0.30 0.02 250 / 0.10))',
  float: 'var(--float-solid, #fff)',
  shadow: 'var(--float-shadow, 0 10px 30px -8px rgba(0,0,0,0.18))',
  danger: 'var(--danger, oklch(0.470 0.150 28))',
  accentInk: 'var(--accent-ink, oklch(0.48 0.224 264))',
  rPanel: 'var(--r-panel, 16px)',
  rControl: 'var(--r-control, 10px)',
};

/** Aktueller Zustand des lokalen Speichers, live. */
function useLocalStoreStatus(): LocalStoreStatus {
  return useSyncExternalStore(subscribeLocalStore, getLocalStoreStatus, getLocalStoreStatus);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

/** Läuft das hier in Safari (oder einem Browser auf iOS, die alle WebKit sind)? */
function isWebKitSafari(): boolean {
  try {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|OPR\/|Firefox\//.test(ua);
  } catch { return false; }
}

function relDay(iso: string, t: LocalStrings): string {
  const d = daysSince(iso);
  if (d <= 0) return t.today;
  if (d === 1) return t.yesterday;
  return t.daysAgo(d);
}


const btn = (primary: boolean, danger = false): React.CSSProperties => ({
  minHeight: '36px', padding: '0 14px', borderRadius: F.rControl, cursor: 'pointer',
  fontFamily: F.ui, fontSize: '12.5px', fontWeight: 600, whiteSpace: 'nowrap',
  border: primary ? 'none' : `1px solid ${F.hair}`,
  background: primary ? (danger ? F.danger : F.ink) : 'transparent',
  color: primary ? 'oklch(0.985 0.003 264)' : F.ink2,
});

export default function BackupReminder({ active, bottomOffset = 20, onProfilesReplaced }: {
  /** Nur im Lokalmodus `true`. */
  active: boolean;
  /** Abstand vom unteren Rand (px), z. B. über einer mobilen Leiste. */
  bottomOffset?: number;
  /** Nach dem Einspielen einer Sicherung oder dem Löschen: neue Profilliste. */
  onProfilesReplaced?: (profiles: AppProfile[]) => void;
}) {
  const uiLang = useUiLang();
  const t = LOCAL_I18N[uiLang];
  const s = useLocalStoreStatus();
  const [panelOpen, setPanelOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!active) return null;

  const err = s.lastError;
  const memory = s.ready && s.backend === 'memory';
  const remind = !err && !memory && shouldRemindBackup(s, undefined, BACKUP_REMIND_DAYS);
  const show = !!err || memory || remind || !!note;

  async function backupNow() {
    setBusy(true);
    const ok = await downloadBackup({ uiLang });
    setBusy(false);
    setNote(ok ? t.backupDone : t.backupFailed);
    window.setTimeout(() => setNote(null), 6000);
  }

  const card: React.CSSProperties = {
    position: 'fixed', right: '16px', bottom: `${bottomOffset}px`, zIndex: 2050,
    width: 'min(calc(100vw - 32px), 380px)', boxSizing: 'border-box',
    background: F.float, borderRadius: F.rPanel, boxShadow: F.shadow,
    border: `1px solid ${err || memory ? F.danger : F.hair}`,
    padding: '14px 16px', fontFamily: F.ui, color: F.ink,
  };

  return (
    <>
      {show && (
        <div role={err || memory ? 'alert' : 'status'} aria-live={err || memory ? 'assertive' : 'polite'}
          data-testid="backup-reminder" data-state={err ? `error-${err.kind}` : memory ? 'memory' : remind ? 'remind' : 'note'}
          style={card}>
          {err || memory ? (
            <>
              <div style={{ fontSize: '13px', fontWeight: 700, color: F.danger, lineHeight: 1.4 }}>
                {memory && !err ? t.memoryTitle : t.errorTitle[err!.kind]}
              </div>
              <div style={{ fontSize: '12.5px', color: F.ink2, lineHeight: 1.5, marginTop: '6px' }}>
                {memory && !err ? t.memoryBody : t.errorBody}
                {err?.kind === 'quota' && <> {t.quotaHint}</>}
              </div>
            </>
          ) : remind ? (
            <>
              <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.4 }}>
                {s.lastBackupAt
                  ? t.reminderOld(daysSince(s.lastBackupAt))
                  : t.reminderNever}
              </div>
              <div style={{ fontSize: '12.5px', color: F.ink2, lineHeight: 1.5, marginTop: '6px' }}>
                {t.reminderBody} {isWebKitSafari() ? t.safariNote : s.persisted ? '' : t.evictNote}
              </div>
            </>
          ) : null}
          {note && (
            <div style={{ fontSize: '12.5px', color: F.ink2, lineHeight: 1.5, marginTop: err || memory || remind ? '8px' : 0 }}>{note}</div>
          )}
          {(err || memory || remind) && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={backupNow} disabled={busy} style={btn(true, !!err || memory)}>
                {busy ? '…' : t.backupNow}
              </button>
              {remind && (
                <button type="button" onClick={() => { void snoozeBackupReminder(3); }} style={btn(false)}>{t.later}</button>
              )}
              <button type="button" onClick={() => setPanelOpen(true)}
                style={{ ...btn(false), border: 'none', padding: '0 4px', color: F.accentInk, textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                {t.more}
              </button>
            </div>
          )}
        </div>
      )}
      {panelOpen && <LocalBackupPanel onClose={() => setPanelOpen(false)} onProfilesReplaced={onProfilesReplaced} />}
    </>
  );
}

// ── Sicherungsfenster ────────────────────────────────────────────────────────

export function LocalBackupPanel({ onClose, onProfilesReplaced }: {
  onClose: () => void;
  onProfilesReplaced?: (profiles: AppProfile[]) => void;
}) {
  const uiLang = useUiLang();
  const t = LOCAL_I18N[uiLang];
  const s = useLocalStoreStatus();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, setPending] = useState<{ backup: ParsedBackup; preview: RestorePreview } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function saveAll() {
    setMsg(null);
    const ok = await downloadBackup({ uiLang });
    setMsg(ok ? { kind: 'ok', text: t.backupDone } : { kind: 'err', text: t.backupFailed });
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(null); setPending(null);
    let text: string;
    try { text = await file.text(); } catch { setMsg({ kind: 'err', text: t.parseError.read }); return; }
    const r = parseBackup(text);
    if (!r.ok) { setMsg({ kind: 'err', text: t.parseError[r.error] }); return; }
    setPending({ backup: r.backup, preview: previewRestore(r.backup) });
  }

  async function apply() {
    if (!pending) return;
    setBusy(true);
    const r = await restoreBackup(pending.backup);
    setBusy(false);
    if (!r.ok) { setMsg({ kind: 'err', text: t.restoreFailed }); return; }
    setMsg({ kind: 'ok', text: t.restored(pending.backup.profiles.length) });
    setPending(null);
    if (onProfilesReplaced) onProfilesReplaced(r.profiles);
    else window.location.reload();
  }

  async function clearAll() {
    if (!window.confirm(t.clearConfirm)) return;
    setBusy(true);
    const ok = await clearLocalStore();
    setBusy(false);
    setMsg(ok ? { kind: 'ok', text: t.cleared } : { kind: 'err', text: t.restoreFailed });
    if (ok) onProfilesReplaced?.([]);
  }

  const fmt = (iso: string) => { try { return new Date(iso).toLocaleString(t.locale, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };
  const list = (items: { id: string; name: string; same?: boolean }[]) => items.length
    ? <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>{items.map(i => <li key={i.id}>{i.name}{i.same ? ` (${t.previewSame})` : ''}</li>)}</ul>
    : <div style={{ color: F.ink3 }}>{t.previewNothing}</div>;
  const sectionH: React.CSSProperties = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: F.ink3, marginTop: '14px' };

  return (
    <div data-modal-backdrop="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2300, background: 'rgba(15,17,21,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div data-modal="true" role="dialog" aria-modal="true" aria-labelledby="local-backup-title" onClick={e => e.stopPropagation()}
        style={{ background: F.float, borderRadius: F.rPanel, boxShadow: F.shadow, width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 22px', fontFamily: F.ui, color: F.ink, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div id="local-backup-title" style={{ fontSize: '18px', fontWeight: 700 }}>{t.panelTitle}</div>
            <div style={{ fontSize: '12.5px', color: F.ink3, marginTop: '2px' }}>{t.panelSubtitle}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t.close}
            style={{ background: 'none', border: 'none', fontSize: '22px', lineHeight: 1, color: F.ink3, cursor: 'pointer', minWidth: '36px', minHeight: '36px' }}>×</button>
        </div>

        {s.lastError && (
          <div role="alert" style={{ marginTop: '12px', fontSize: '12.5px', lineHeight: 1.5, color: F.danger }}>
            {t.errorTitle[s.lastError.kind]}
          </div>
        )}

        <div style={sectionH}>{t.saveAll}</div>
        <div style={{ fontSize: '12.5px', color: F.ink2, lineHeight: 1.5, marginTop: '4px' }}>
          {t.saveAllHint(s.profileCount)} {s.lastBackupAt ? t.lastBackup(`${relDay(s.lastBackupAt, t)}, ${fmt(s.lastBackupAt)}`) : t.neverBackedUp}
          {s.persisted ? <> {t.persistedYes}</> : isWebKitSafari() ? <> {t.safariNote}</> : null}
        </div>
        <button type="button" onClick={saveAll} disabled={busy || s.profileCount === 0} style={{ ...btn(true), marginTop: '10px', opacity: s.profileCount === 0 ? 0.5 : 1 }}>
          ↓ {t.saveAll}
        </button>

        <div style={sectionH}>{t.load}</div>
        <div style={{ fontSize: '12.5px', color: F.ink2, lineHeight: 1.5, marginTop: '4px' }}>{t.loadHint}</div>
        <input ref={fileRef} type="file" accept=".json,.cv.json,application/json" onChange={pickFile} style={{ display: 'none' }} data-testid="backup-file" />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} style={{ ...btn(false), marginTop: '10px' }}>
          ↑ {t.load}
        </button>

        {pending && (
          <div data-testid="backup-preview" style={{ marginTop: '14px', padding: '12px 14px', borderRadius: F.rControl, border: `1px solid ${F.hair}`, fontSize: '12.5px', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700 }}>{t.previewTitle}</div>
            {pending.backup.createdAt && <div style={{ color: F.ink3 }}>{t.previewFrom(fmt(pending.backup.createdAt))}</div>}
            {pending.backup.skipped > 0 && <div style={{ color: F.danger, marginTop: '4px' }}>{t.skippedInFile(pending.backup.skipped)}</div>}
            <div style={{ marginTop: '8px', fontWeight: 600 }}>{t.previewReplaced}</div>
            {list(pending.preview.replaced)}
            {pending.preview.replaced.length > 0 && <div style={{ color: F.ink3, fontSize: '11.5px' }}>{t.previewReplacedNote}</div>}
            <div style={{ marginTop: '8px', fontWeight: 600 }}>{t.previewAdded}</div>
            {list(pending.preview.added)}
            <div style={{ marginTop: '8px', fontWeight: 600 }}>{t.previewKept}</div>
            {list(pending.preview.kept)}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
              <button type="button" onClick={() => setPending(null)} disabled={busy} style={btn(false)}>{t.cancel}</button>
              <button type="button" onClick={apply} disabled={busy} style={btn(true)}>{busy ? t.applying : t.apply}</button>
            </div>
          </div>
        )}

        {msg && (
          <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ marginTop: '12px', fontSize: '12.5px', lineHeight: 1.5, color: msg.kind === 'err' ? F.danger : F.ink2 }}>{msg.text}</div>
        )}
        {(s.migrated > 0 || s.skipped > 0) && (
          <div style={{ marginTop: '12px', fontSize: '11.5px', color: F.ink3, lineHeight: 1.5 }}>
            {s.migrated > 0 && t.migrated(s.migrated)} {s.skipped > 0 && t.skipped(s.skipped)}
          </div>
        )}

        <div style={{ borderTop: `1px solid ${F.hair}`, marginTop: '18px', paddingTop: '12px' }}>
          <button type="button" onClick={clearAll} disabled={busy}
            style={{ ...btn(false), color: F.danger, borderColor: 'transparent', padding: '0 2px' }}>{t.clearAll}</button>
        </div>
      </div>
    </div>
  );
}
