import { useState, useEffect } from 'react';
import type { AppProfile } from '../data/types';
import { createDemoProfile, createBlankProfile } from '../data/storage';
import { COLORS as C, FONTS as F, BORDER as B, TYPE } from '../ui/tokens';

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
}

// ── Create Profile Modal ───────────────────────────────────────────────────

function CreateModal({ onConfirm, onClose }: {
  onConfirm: (profile: AppProfile) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'blank' | 'demo'>('blank');

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const profile = mode === 'demo' ? createDemoProfile(trimmed) : createBlankProfile(trimmed);
    onConfirm(profile);
  }

  const overline: React.CSSProperties = { ...TYPE.overline, color: C.fade, marginBottom: '8px' };
  const input: React.CSSProperties = {
    width: '100%', padding: '14px 0', border: 'none',
    borderBottom: B.hairline, background: 'transparent',
    fontFamily: F.display, fontSize: '22px', fontWeight: 400, color: C.ink,
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(28,25,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={onClose}
    >
      <div
        style={{ background: C.paper, border: B.inkStrong, padding: '40px 44px', maxWidth: '540px', width: '100%' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ ...TYPE.micromono, color: C.fade, marginBottom: '12px' }}>NEU · PROFIL</div>
        <div style={{ fontFamily: F.display, fontSize: '38px', fontWeight: 400, color: C.ink, lineHeight: 0.95, letterSpacing: '-0.02em', marginBottom: '28px' }}>
          Neues Profil<br/><em style={{ fontStyle: 'italic' }}>anlegen.</em>
        </div>

        <div style={overline}>Name des Profils</div>
        <input
          type="text" value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="z. B. Bewerbung Acme"
          autoFocus
          style={input}
        />

        <div style={{ ...overline, marginTop: '32px' }}>Startdaten</div>
        <div style={{ display: 'flex', gap: '0', borderTop: B.hairline, borderBottom: B.hairline }}>
          {[
            { id: 'blank' as const, label: 'Leer beginnen', desc: 'Alle Felder leer' },
            { id: 'demo' as const, label: 'Mit Demo', desc: 'Lena Brandt, Senior Product Designer' },
          ].map((opt, i) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMode(opt.id)}
              style={{
                flex: 1, padding: '18px 16px',
                background: mode === opt.id ? C.ink : 'transparent',
                color: mode === opt.id ? C.paper : C.ink,
                border: 'none', borderLeft: i === 0 ? 'none' : B.hairline,
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 120ms, color 120ms',
              }}
            >
              <div style={{ fontFamily: F.ui, fontSize: '13px', fontWeight: 600, marginBottom: '3px' }}>
                {opt.label}
              </div>
              <div style={{ fontFamily: F.ui, fontSize: '10.5px', opacity: 0.75 }}>{opt.desc}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0', justifyContent: 'flex-end', marginTop: '32px' }}>
          <button type="button" onClick={onClose}
            style={{ padding: '12px 22px', background: 'transparent', border: B.hairline, fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.pencil, cursor: 'pointer', fontFamily: F.ui }}>
            Abbrechen
          </button>
          <button type="button" onClick={handleCreate} disabled={!name.trim()}
            style={{
              padding: '12px 28px',
              background: name.trim() ? C.ink : C.fade,
              color: C.paper, border: B.inkStrong, borderLeft: 'none',
              fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: name.trim() ? 'pointer' : 'default', fontFamily: F.ui,
            }}>
            Profil anlegen →
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
  // Resolve the OKLCH tokens to real strings the SVG renderer accepts.
  return (
    <div>
      <div style={{ ...TYPE.overline, color: C.gold, marginBottom: '12px' }}>Zwanzig Vorlagen, sechs Archetypen</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)',
        gap: isMobile ? '10px' : '14px',
      }}>
        {STRIP_TILES.map(t => (
          <div key={t.id} style={{ border: B.hairline, background: C.white, padding: '6px' }}>
            <svg viewBox="0 0 92 96" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', width: '100%', height: 'auto' }} aria-hidden>
              <rect x="0" y="0" width="92" height="96" fill={C.paper} />
              {t.render(C.gold, C.ink, C.rule)}
            </svg>
            <div style={{ ...TYPE.micromono, color: C.fade, marginTop: '6px', textAlign: 'center' }}>{t.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Profile Row (editorial card) ─────────────────────────────────────────

function ProfileRow({ profile, index, featured, onOpen, onDelete }: {
  profile: AppProfile; index: number; featured: boolean;
  onOpen: () => void; onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hover, setHover] = useState(false);
  const created = new Date(profile.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  const num = String(index + 1).padStart(2, '0');
  // Exponential ease-out (cubic-bezier ≈ ease-out-expo). No layout properties get animated.
  const EXPO_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: featured ? '72px 1fr auto' : '64px 1fr auto',
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
          {featured && <span style={{ ...TYPE.overline, color: C.gold, marginRight: '12px' }}>ZULETZT GEÖFFNET</span>}
          {profile.settings.template} · {profile.settings.lang.toUpperCase()} · angelegt {created}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {confirmDelete ? (
          <button type="button"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ padding: '8px 14px', background: C.error, color: C.paper, border: 'none', fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: F.ui }}>
            Wirklich löschen
          </button>
        ) : (
          <button type="button"
            onClick={e => { e.stopPropagation(); setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }}
            title="Profil löschen"
            style={{ padding: '8px 10px', background: 'transparent', border: 'none', fontSize: '14px', color: C.fade, cursor: 'pointer' }}>
            ×
          </button>
        )}
        <div style={{
          fontFamily: F.ui, fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          color: hover ? C.gold : C.pencil,
          transition: `color 380ms ${EXPO_OUT}`,
        }}>
          Öffnen →
        </div>
      </div>
    </div>
  );
}

// ── HomeScreen ───────────────────────────────────────────────────────────

export default function HomeScreen({ profiles, onSelect, onCreate, onDelete, username, isAdmin, onLogout, onOpenAdmin }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const { isMobile } = useViewport();

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
          CV-HUB · LEBENSLAUF & ANSCHREIBEN
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {username && (
            <span style={{ ...TYPE.micromono, color: C.fade, whiteSpace: 'nowrap' }}>{username}</span>
          )}
          {isAdmin && onOpenAdmin && (
            <button type="button" onClick={onOpenAdmin} title="Admin-Bereich"
              style={{ padding: '5px 11px', background: C.ink, color: C.paper, border: 'none', fontFamily: F.ui, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Admin
            </button>
          )}
          {onLogout && (
            <button type="button" onClick={onLogout} title="Abmelden"
              style={{ padding: '5px 12px', background: 'transparent', border: B.hairline, borderRadius: '5px', fontFamily: F.ui, fontSize: '11px', fontWeight: 600, color: C.pencil, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Abmelden
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: isMobile ? '0 20px' : '0 32px' }}>
        <div style={{ width: '100%', maxWidth: '960px', display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: isMobile ? '20px' : '32px', padding: isMobile ? '40px 0 64px' : '64px 0 96px' }}>

          {/* Hero */}
          <div style={{ gridColumn: isMobile ? '1 / -1' : '1 / span 7' }}>
            <div style={{ ...TYPE.overline, color: C.gold, marginBottom: '16px' }}>Lebenslauf-Werkstatt</div>
            <h1 style={{
              fontFamily: F.display, fontSize: 'clamp(56px, 7.4vw, 104px)', fontWeight: 400,
              color: C.ink, lineHeight: 0.9, letterSpacing: '-0.028em', margin: 0,
              fontVariationSettings: '"opsz" 144',
              fontFeatureSettings: '"liga" 1, "calt" 1, "onum" 1',
            }}>
              Lebensläufe<br/>
              lesen sich heute<br/>
              wie <em style={{ fontStyle: 'italic', fontWeight: 300, color: C.gold }}>Formulare.</em>
            </h1>
            <div style={{ marginTop: '20px', fontFamily: F.display, fontSize: 'clamp(20px, 2.3vw, 28px)', fontWeight: 400, lineHeight: 1.25, color: C.ink, letterSpacing: '-0.005em', maxWidth: '34ch' }}>
              Hier nicht.
            </div>
          </div>

          <div style={{ gridColumn: isMobile ? '1 / -1' : '8 / span 5', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ fontFamily: F.ui, fontSize: '14px', fontWeight: 400, lineHeight: 1.6, color: C.pencil, marginBottom: '20px', maxWidth: '32ch' }}>
              Zwanzig Vorlagen, die wie editoriale Spreads gesetzt sind. Auto-Fit auf A4. Markdown-Bridge, falls eine KI Korrektur lesen soll. Druckfertig.
            </div>
            <div style={{ borderTop: B.hairline, paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ ...TYPE.micromono, color: C.gold }}>FAMILY & FRIENDS</div>
              <div style={{ fontFamily: F.ui, fontSize: '11.5px', color: C.fade }}>Invite-only · kein Tracking</div>
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
            <div style={{ ...TYPE.overline, color: C.ink, marginBottom: '8px' }}>Deine Profile</div>
            <div style={{ fontFamily: F.ui, fontSize: '12px', color: C.pencil, lineHeight: 1.55 }}>
              {profiles.length === 0
                ? 'Noch keine Profile. Leg eines an, um den Editor zu öffnen.'
                : `${profiles.length} Profil${profiles.length === 1 ? '' : 'e'} in deinem Konto. Klick auf eines, um es zu öffnen.`}
            </div>
            <button type="button" onClick={() => setShowCreate(true)}
              style={{
                marginTop: '24px',
                display: 'inline-flex', alignItems: 'center', gap: '10px',
                padding: '14px 22px', background: C.ink, color: C.paper,
                border: 'none', cursor: 'pointer', fontFamily: F.ui,
                fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
              <span style={{ fontFamily: F.mono, fontSize: '14px', fontWeight: 400 }}>＋</span>
              Neues Profil
            </button>
          </div>

          <div style={{ gridColumn: isMobile ? '1 / -1' : '4 / span 9' }}>
            {profiles.length > 0 ? (
              <div style={{ borderTop: B.hairline }}>
                {profiles.map((p, i) => (
                  <ProfileRow
                    key={p.id} profile={p} index={i} featured={i === 0 && profiles.length > 1}
                    onOpen={() => onSelect(p.id)}
                    onDelete={() => onDelete(p.id)}
                  />
                ))}
              </div>
            ) : (
              <div style={{
                borderTop: B.hairline, borderBottom: B.hairline,
                padding: '64px 0', textAlign: 'center',
              }}>
                <div style={{ ...TYPE.micromono, color: C.fade, marginBottom: '12px' }}>NULL · PROFILE</div>
                <div style={{ fontFamily: F.display, fontSize: '32px', fontWeight: 300, fontStyle: 'italic', color: C.pencil }}>
                  Hier wird's bald voll.
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ gridColumn: '1 / -1', borderTop: B.hairline, paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <div style={{ ...TYPE.micromono, color: C.fade }}>
              CV-HUB · {new Date().getFullYear()}
            </div>
            <div style={{ ...TYPE.micromono, color: C.fade }}>
              Family &amp; Friends · invite-only
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateModal onConfirm={handleCreate} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
