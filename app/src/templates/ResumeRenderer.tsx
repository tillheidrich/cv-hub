import React from 'react';
import type { CVData, SocialLink, SectionKey, PageFormat } from '../data/types';
import { getPageFormat } from '../data/pageFormats';
import type { ResumeTheme, ThemeColors, FontPairing, BulletStyle } from './theme';

// ── Social rendering helpers ────────────────────────────────────────────────
const SOCIAL_META: Record<string, { label: string; prefix: string }> = {
  linkedin:  { label: 'LinkedIn',  prefix: 'linkedin.com/in/' },
  github:    { label: 'GitHub',    prefix: 'github.com/' },
  xing:      { label: 'Xing',      prefix: 'xing.com/profile/' },
  twitter:   { label: 'X',         prefix: 'x.com/' },
  bluesky:   { label: 'Bluesky',   prefix: 'bsky.app/profile/' },
  mastodon:  { label: 'Mastodon',  prefix: '' },
  instagram: { label: 'Instagram', prefix: 'instagram.com/' },
  youtube:   { label: 'YouTube',   prefix: 'youtube.com/@' },
  tiktok:    { label: 'TikTok',    prefix: 'tiktok.com/@' },
  behance:   { label: 'Behance',   prefix: 'behance.net/' },
  dribbble:  { label: 'Dribbble',  prefix: 'dribbble.com/' },
  medium:    { label: 'Medium',    prefix: 'medium.com/@' },
  substack:  { label: 'Substack',  prefix: '' },
};

/** Returns the canonical list of socials, falling back to legacy fields. */
export function listSocials(personal: CVData['personal']): SocialLink[] {
  if (personal.socials && personal.socials.length) return personal.socials;
  const legacy: SocialLink[] = [];
  if (personal.linkedin)  legacy.push({ id: 'lin-legacy', platform: 'linkedin',  value: personal.linkedin });
  if (personal.instagram) legacy.push({ id: 'ig-legacy',  platform: 'instagram', value: personal.instagram });
  return legacy;
}

/** Pretty value for a social — uses platform prefix if user only wrote a handle. */
export function socialDisplay(s: SocialLink): string {
  const v = (s.value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v.replace(/^https?:\/\//i, '');
  if (v.includes('/')) return v;
  return SOCIAL_META[s.platform]?.prefix + v;
}

export function socialHref(s: SocialLink): string {
  const v = (s.value || '').trim();
  if (!v) return '#';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + socialDisplay(s);
}

export function socialLabel(s: SocialLink): string {
  return SOCIAL_META[s.platform]?.label || s.platform;
}

/** Flat list of contact entries for header strips (email · phone · location · website · socials). */
export function inlineContact(personal: CVData['personal']): string[] {
  const base = [personal.email, personal.phone, personal.location, personal.website].filter(Boolean) as string[];
  const socials = listSocials(personal).filter(s => s.value.trim()).map(socialDisplay);
  return [...base, ...socials];
}

interface Props {
  data: CVData;
  theme: ResumeTheme;
  pairing: FontPairing;
  /** effective size multiplier (user scale × auto-fit density) */
  density: number;
  /** how many pages tall the page box should be */
  pages?: number;
  /** measuring mode — render natural height instead of clamped */
  measure?: boolean;
  /** sections the user has explicitly hidden — every layout respects this */
  hiddenSections?: SectionKey[];
  /** sections in user-defined order — currently honoured for the main column
   *  (profile / experience / education / additional). skills + languages
   *  remain layout-anchored. */
  sectionOrder?: SectionKey[];
  /** Page format (A4 / Letter / Legal / A5). Defaults to A4. */
  pageFormat?: PageFormat;
  /** Manual page assignment per section. When set together with pages > 1,
   *  the renderer emits N separate .cv-page divs — page N contains only the
   *  sections whose assignment === N. Sections without an explicit page
   *  default to page 1. */
  sectionPages?: Partial<Record<SectionKey, number>>;
}

// ── Bullet marker ───────────────────────────────────────────────────────────

function Marker({ style, color, d }: { style: BulletStyle; color: string; d: number }) {
  if (style === 'dot')
    return <span style={{ position: 'absolute', left: 0, top: `${5.5 * d}px`, width: `${3.2 * d}px`, height: `${3.2 * d}px`, borderRadius: '50%', background: color }} />;
  if (style === 'square')
    return <span style={{ position: 'absolute', left: 0, top: `${5.5 * d}px`, width: `${3.2 * d}px`, height: `${3.2 * d}px`, background: color }} />;
  if (style === 'dash')
    return <span style={{ position: 'absolute', left: 0, top: `${7 * d}px`, width: `${6.5 * d}px`, height: `${1.5 * d}px`, background: color }} />;
  if (style === 'arrow')
    return <span style={{ position: 'absolute', left: 0, top: `${1.5 * d}px`, fontSize: `${8.5 * d}px`, color, lineHeight: 1 }}>→</span>;
  return <span style={{ position: 'absolute', left: 0, top: `${1.5 * d}px`, fontSize: `${8.5 * d}px`, color, lineHeight: 1 }}>›</span>;
}

// ── Section title ───────────────────────────────────────────────────────────

function SectionTitle({ label, T, C, P, d, onPanel }: {
  label: string; T: ResumeTheme; C: ThemeColors; P: FontPairing; d: number; onPanel?: boolean;
}) {
  const accent = onPanel ? C.panelAccent : C.accent;
  const ink = onPanel ? C.panelInk : C.ink;

  if (T.heading === 'serif') {
    return (
      <div style={{ marginBottom: `${9 * d}px` }}>
        <div style={{ fontFamily: P.heading, fontSize: `${12.5 * d}px`, fontWeight: 600, color: ink, lineHeight: 1.15 }}>{label}</div>
        <div style={{ height: `${2 * d}px`, width: `${26 * d}px`, background: accent, marginTop: `${4 * d}px` }} />
      </div>
    );
  }
  // letter-spacing must be em-based so it scales with the actual font size in
  // both wide and narrow columns. px-scaled tracking (e.g. 2.6 * d px on a 8.6px
  // font) blows out the word and forces mid-word line breaks in narrow flex
  // columns (the 'G EB U R TS D A TU M' bug).
  if (T.heading === 'block') {
    return (
      <div style={{
        display: 'inline-block', marginBottom: `${9 * d}px`, background: accent, color: onPanel ? C.panelBg : C.accentInk,
        fontFamily: P.body, fontSize: `${7.6 * d}px`, fontWeight: 700, letterSpacing: '0.16em',
        textTransform: 'uppercase', padding: `${3.5 * d}px ${7 * d}px`,
        whiteSpace: 'nowrap',
      }}>{label}</div>
    );
  }
  if (T.heading === 'bar') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: `${6 * d}px`, marginBottom: `${9 * d}px`, minWidth: 0 }}>
        <div style={{ width: `${12 * d}px`, height: `${3 * d}px`, background: accent, flexShrink: 0 }} />
        <div style={{ fontFamily: P.body, fontSize: `${8.7 * d}px`, fontWeight: 600, letterSpacing: '0.11em', textTransform: 'uppercase', color: ink, minWidth: 0, overflowWrap: 'normal' }}>{label}</div>
      </div>
    );
  }
  if (T.heading === 'caps-rule') {
    return (
      <div style={{ marginBottom: `${9 * d}px`, minWidth: 0 }}>
        <div style={{
          fontFamily: P.body, fontSize: `${8.7 * d}px`, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: accent, marginBottom: `${5 * d}px`,
          overflowWrap: 'normal', wordBreak: 'normal',
        }}>{label}</div>
        <div style={{ height: '0.8px', background: `linear-gradient(to right, ${accent}, transparent)` }} />
      </div>
    );
  }
  // caps-tracked — accent tick + label
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${7 * d}px`, marginBottom: `${9 * d}px`, minWidth: 0 }}>
      <div style={{ width: `${3 * d}px`, height: `${10 * d}px`, background: accent, flexShrink: 0 }} />
      <div style={{
        fontFamily: P.body, fontSize: `${8.7 * d}px`, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: ink, minWidth: 0,
        overflowWrap: 'normal', wordBreak: 'normal',
      }}>{label}</div>
    </div>
  );
}

function Bullets({ items, C, T, d, onPanel }: {
  items: string[]; C: ThemeColors; T: ResumeTheme; d: number; onPanel?: boolean;
}) {
  const color = onPanel ? C.panelAccent : C.accent;
  const ink = onPanel ? C.panelInkSoft : C.inkMid;
  return (
    <ul style={{ margin: `${5 * d}px 0 0`, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: `${3.5 * d}px` }}>
      {items.map((b, i) => (
        <li key={i} style={{ fontSize: `${9.3 * d}px`, color: ink, lineHeight: 1.6, paddingLeft: `${13 * d}px`, position: 'relative' }}>
          <Marker style={T.bullet} color={color} d={d} />
          {b}
        </li>
      ))}
    </ul>
  );
}

// ── Section content blocks ──────────────────────────────────────────────────

function ContactBlock({ data, C, P, d, onPanel }: { data: CVData; C: ThemeColors; P: FontPairing; d: number; onPanel?: boolean }) {
  const { personal, labels } = data;
  const ink = onPanel ? C.panelInk : C.inkMid;
  const lab = onPanel ? C.panelAccent : C.accent;
  const rows: { l: string; v: string; href?: string }[] = [
    { l: labels.fields.email, v: personal.email, href: `mailto:${personal.email}` },
    { l: labels.fields.phone, v: personal.phone, href: `tel:${personal.phone.replace(/\s/g, '')}` },
    { l: labels.fields.address, v: personal.location },
  ];
  if (personal.website) rows.push({ l: labels.fields.web, v: personal.website, href: `https://${personal.website}` });
  for (const s of listSocials(personal)) {
    if (!s.value.trim()) continue;
    rows.push({ l: socialLabel(s), v: socialDisplay(s), href: socialHref(s) });
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${6 * d}px` }}>
      {rows.map((r, i) => {
        const inner = (
          <>
            <div style={{ fontFamily: P.body, fontSize: `${6.8 * d}px`, fontWeight: 700, letterSpacing: `${1.3 * d}px`, textTransform: 'uppercase', color: lab, marginBottom: `${1.5 * d}px` }}>{r.l}</div>
            <div style={{ fontFamily: P.body, fontSize: `${9.3 * d}px`, color: ink, lineHeight: 1.4 }}>{r.v}</div>
          </>
        );
        return r.href
          ? <a key={i} href={r.href} style={{ textDecoration: 'none' }}>{inner}</a>
          : <div key={i}>{inner}</div>;
      })}
    </div>
  );
}

function DetailBlock({ data, C, P, d, onPanel }: { data: CVData; C: ThemeColors; P: FontPairing; d: number; onPanel?: boolean }) {
  const { personal, labels } = data;
  const rows = ([
    personal.birthDate ? [labels.fields.birthDate, personal.birthDate] : null,
    personal.birthPlace ? [labels.fields.birthPlace, personal.birthPlace] : null,
    personal.maritalStatus ? [labels.fields.maritalStatus, personal.maritalStatus] : null,
    personal.nationality ? [labels.fields.nationality, personal.nationality] : null,
    personal.driversLicense ? [labels.fields.driversLicense, personal.driversLicense] : null,
  ] as ([string, string] | null)[]).filter((x): x is [string, string] => !!x);
  if (!rows.length) return null;
  const ink = onPanel ? C.panelInk : C.inkMid;
  const lab = onPanel ? C.panelAccent : C.accent;
  return (
    // minWidth:0 lets the block shrink in flex columns; wrap allows long values
    // to break instead of overflowing the right edge.
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${5.5 * d}px`, minWidth: 0 }}>
      {rows.map(([l, v]) => (
        <div key={l} style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: P.body, fontSize: `${6.8 * d}px`, fontWeight: 700,
            // letter-spacing must be reduced for narrow columns — 1.2px at d=0.9
            // produced 'G EB U R TS D A TU M' (each char overflowing). Cap at 0.08em.
            letterSpacing: '0.08em',
            textTransform: 'uppercase', color: lab, marginBottom: `${1.5 * d}px`,
            wordBreak: 'normal', whiteSpace: 'normal',
          }}>{l}</div>
          <div style={{
            fontFamily: P.body, fontSize: `${9.3 * d}px`, color: ink, lineHeight: 1.4,
            wordBreak: 'normal', overflowWrap: 'break-word', whiteSpace: 'normal',
          }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function LangBlock({ data, C, P, d, onPanel }: { data: CVData; C: ThemeColors; P: FontPairing; d: number; onPanel?: boolean }) {
  const ink = onPanel ? C.panelInk : C.ink;
  const soft = onPanel ? C.panelInkSoft : C.inkSoft;
  const accent = onPanel ? C.panelAccent : C.accent;
  const dim = onPanel ? 'rgba(255,255,255,0.22)' : C.chipBg;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${6 * d}px` }}>
      {data.languages.map(l => {
        const rating = languageDots(l);
        return (
          <div key={l.language}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: `${6 * d}px` }}>
              <span style={{ fontFamily: P.body, fontSize: `${9.3 * d}px`, fontWeight: 600, color: ink }}>{l.language}</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: `${6 * d}px` }}>
                <span style={{ fontFamily: P.body, fontSize: `${7.8 * d}px`, color: soft, textAlign: 'right' }}>{l.level}</span>
                <DotScale value={rating} max={5} d={d} on={accent} off={dim} />
              </span>
            </div>
            <div style={{ height: `${2 * d}px`, background: dim, marginTop: `${3 * d}px`, borderRadius: `${2 * d}px`, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(rating / 5) * 100}%`, background: accent, borderRadius: `${2 * d}px` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Renders N/M filled dots inline. Reused by every template that wants a
 *  language proficiency indicator. Uses solid SVG so the dots look identical
 *  at every density and don't shift baseline like a Unicode bullet would. */
function DotScale({ value, max, d, on, off }: { value: number; max: number; d: number; on: string; off: string }) {
  const size = 5.2 * d;
  const gap = 2.6 * d;
  return (
    <span aria-label={`${value} von ${max}`} style={{ display: 'inline-flex', gap: `${gap}px`, alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            display: 'inline-block',
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            background: i < value ? on : off,
          }}
        />
      ))}
    </span>
  );
}

/** Resolves the dot rating for a language entry. Uses the explicit `dots`
 *  field if the user set one, otherwise derives a sensible default from the
 *  free-text level (so old data still gets useful dots). */
export function languageDots(l: { level: string; dots?: number }): number {
  if (typeof l.dots === 'number' && Number.isFinite(l.dots)) {
    return Math.max(0, Math.min(5, Math.round(l.dots)));
  }
  const pct = langPct(l.level);
  // Bucket the percentage into a 1–5 scale that matches the spoken intuition.
  if (pct >= 95) return 5;
  if (pct >= 80) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  return 1;
}

function langPct(level: string): number {
  const s = level.toLowerCase();
  if (/mutter|native|c2/.test(s)) return 100;
  if (/c1|verhandl|fluent|business/.test(s)) return 88;
  if (/b2/.test(s)) return 72;
  if (/b1/.test(s)) return 58;
  if (/grund|basic|a2|a1/.test(s)) return 40;
  return 70;
}

function SkillGroupBlock({ group, T, C, P, d, onPanel }: {
  group: { label: string; items: string[] }; T: ResumeTheme; C: ThemeColors; P: FontPairing; d: number; onPanel?: boolean;
}) {
  if (T.skillsAsChips) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${4 * d}px` }}>
        {group.items.map(it => (
          <span key={it} style={{
            fontFamily: P.body, fontSize: `${8.2 * d}px`, color: onPanel ? C.panelInk : C.inkMid,
            background: onPanel ? 'rgba(255,255,255,0.1)' : C.chipBg, padding: `${3 * d}px ${7 * d}px`, borderRadius: `${3 * d}px`, lineHeight: 1.45,
          }}>{it}</span>
        ))}
      </div>
    );
  }
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: `${4 * d}px` }}>
      {group.items.map(it => (
        <li key={it} style={{ fontSize: `${8.9 * d}px`, color: onPanel ? C.panelInkSoft : C.inkMid, lineHeight: 1.45, paddingLeft: `${10 * d}px`, position: 'relative' }}>
          <Marker style={T.bullet === 'dash' ? 'dot' : T.bullet} color={onPanel ? C.panelAccent : C.accent} d={d} />
          {it}
        </li>
      ))}
    </ul>
  );
}

function Photo({ data, T, C, sizeMm }: { data: CVData; T: ResumeTheme; C: ThemeColors; sizeMm: number }) {
  if (T.photo === 'none' || !data.personal.photo) return null;
  const radius = T.photo === 'circle' ? '50%' : T.photo === 'rounded' ? `${sizeMm * 0.13}mm` : '0';
  return (
    <div style={{
      width: `${sizeMm}mm`, height: `${sizeMm}mm`, flexShrink: 0, borderRadius: radius,
      overflow: 'hidden', background: C.chipBg, position: 'relative',
    }}>
      <img src={data.personal.photo} alt={data.personal.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
}

// ── Experience + Education ──────────────────────────────────────────────────

function present(data: CVData, end: string) {
  return end === 'present' || end === 'heute' ? data.labels.misc.present : end;
}

function DateChip({ children, C, P, d, onPanel }: { children: React.ReactNode; C: ThemeColors; P: FontPairing; d: number; onPanel?: boolean }) {
  return (
    <span style={{
      fontFamily: P.body, fontSize: `${7.6 * d}px`, fontWeight: 600, color: onPanel ? C.panelInkSoft : C.inkSoft,
      whiteSpace: 'nowrap', letterSpacing: `${0.2 * d}px`,
    }}>{children}</span>
  );
}

function ExperienceList({ data, T, C, P, d, timeline }: {
  data: CVData; T: ResumeTheme; C: ThemeColors; P: FontPairing; d: number; timeline?: boolean;
}) {
  const entries = data.experience.filter(e => !e.hidden);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${9 * d}px` }}>
      {entries.map((e, idx) => (
        <article key={e.id} style={timeline ? { position: 'relative', paddingLeft: `${16 * d}px` } : undefined}>
          {timeline && (
            <>
              <span style={{ position: 'absolute', left: 0, top: `${3 * d}px`, width: `${8 * d}px`, height: `${8 * d}px`, borderRadius: '50%', background: C.pageBg, border: `${2 * d}px solid ${C.accent}` }} />
              {idx < entries.length - 1 && (
                <span style={{ position: 'absolute', left: `${3.5 * d}px`, top: `${13 * d}px`, bottom: `${-9 * d}px`, width: '1px', background: C.rule }} />
              )}
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: `${10 * d}px` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: P.heading, fontSize: `${12 * d}px`, fontWeight: 600, color: C.ink, lineHeight: 1.25 }}>{e.role}</div>
              <div style={{ fontFamily: P.body, fontSize: `${9.2 * d}px`, fontWeight: 600, color: C.accent, marginTop: `${2 * d}px` }}>
                {e.company}{e.location ? <span style={{ color: C.inkSoft, fontWeight: 400 }}>{`  ·  ${e.location}`}</span> : ''}
              </div>
            </div>
            <DateChip C={C} P={P} d={d}>{e.start} – {present(data, e.end)}</DateChip>
          </div>
          {e.bullets.length > 0 && <Bullets items={e.bullets} C={C} T={T} d={d} />}
        </article>
      ))}
    </div>
  );
}

function EducationList({ data, C, P, d }: { data: CVData; C: ThemeColors; P: FontPairing; d: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${6.5 * d}px` }}>
      {data.education.map(e => (
        <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: `${10 * d}px` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: P.heading, fontSize: `${10 * d}px`, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{e.degree}</div>
            <div style={{ fontFamily: P.body, fontSize: `${8.8 * d}px`, color: C.accent, marginTop: `${1.5 * d}px` }}>{e.institution}</div>
            {e.notes && <div style={{ fontFamily: P.body, fontSize: `${7.8 * d}px`, color: C.inkSoft, marginTop: `${1.5 * d}px` }}>{e.notes}</div>}
          </div>
          <DateChip C={C} P={P} d={d}>{e.start} – {e.end}</DateChip>
        </div>
      ))}
    </div>
  );
}

// ── Name block ──────────────────────────────────────────────────────────────

function NameBlock({ data, T, C, P, d, big, onPanel, center }: {
  data: CVData; T: ResumeTheme; C: ThemeColors; P: FontPairing; d: number; big?: boolean; onPanel?: boolean; center?: boolean;
}) {
  const ink = onPanel ? C.panelInk : (T.accentName ? C.accent : C.ink);
  const titleColor = onPanel ? C.panelAccent : C.accent;
  return (
    <div style={{ textAlign: center ? 'center' : 'left' }}>
      <div style={{
        fontFamily: P.heading, fontSize: `${(big ? 35 : 28) * d}px`, fontWeight: 700, color: ink,
        lineHeight: 1.02, letterSpacing: T.uppercaseName ? `${0.4 * d}px` : `${-0.9 * d}px`,
        textTransform: T.uppercaseName ? 'uppercase' : 'none',
      }}>{data.personal.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start', gap: `${8 * d}px`, marginTop: `${7 * d}px` }}>
        {center && <div style={{ width: `${18 * d}px`, height: `${1.5 * d}px`, background: titleColor }} />}
        <div style={{
          fontFamily: P.body, fontSize: `${8.8 * d}px`, fontWeight: 600, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: titleColor,
        }}>{data.personal.title}</div>
        {center && <div style={{ width: `${18 * d}px`, height: `${1.5 * d}px`, background: titleColor }} />}
      </div>
    </div>
  );
}

// ── Sidebar section stack (top-level, stable identity) ──────────────────────

function SidebarSections({ data, T, C, P, d, onPanel, hidden }: {
  data: CVData; T: ResumeTheme; C: ThemeColors; P: FontPairing; d: number; onPanel: boolean; hidden: Set<SectionKey>;
}) {
  const sec = data.labels.sections;
  return (
    <>
      <section><SectionTitle label={sec.personal} T={T} C={C} P={P} d={d} onPanel={onPanel} /><ContactBlock data={data} C={C} P={P} d={d} onPanel={onPanel} /></section>
      {DetailBlock({ data, C, P, d, onPanel }) && (
        <section><SectionTitle label={sec.details} T={T} C={C} P={P} d={d} onPanel={onPanel} /><DetailBlock data={data} C={C} P={P} d={d} onPanel={onPanel} /></section>
      )}
      {!hidden.has('languages') && (
        <section><SectionTitle label={sec.languages} T={T} C={C} P={P} d={d} onPanel={onPanel} /><LangBlock data={data} C={C} P={P} d={d} onPanel={onPanel} /></section>
      )}
      {!hidden.has('skills') && data.skillGroups.map(g => (
        <section key={g.label}><SectionTitle label={g.label} T={T} C={C} P={P} d={d} onPanel={onPanel} /><SkillGroupBlock group={g} T={T} C={C} P={P} d={d} onPanel={onPanel} /></section>
      ))}
      {/* 'additional' wird NICHT in der Sidebar gerendert — der Block lebt
       *  ausschließlich in der Main-Column (über mainOrder/MainSections).
       *  Sonst gab's einen Duplicate-Render-Bug bei Oslo/Patterson/Azurill/
       *  Leafish: "Weiteres" tauchte in der Sidebar UND in der Main-Spalte
       *  auf (Magnus' Bug-Report). 'additional' ist free-form-Text und passt
       *  schlecht in eine schmale Sidebar — main column ist konsistenter. */}
    </>
  );
}

// ── Main renderer ───────────────────────────────────────────────────────────

/** Order single-column / timeline layouts iterate through. Sidebar-layouts
 *  put 'details' + 'languages' + 'skills' into their fixed sidebar and use
 *  the shorter MAIN_ORDER_SIDEBAR variant instead. */
const DEFAULT_MAIN_ORDER: SectionKey[] = ['profile', 'details', 'experience', 'education', 'skills', 'languages', 'additional'];
const MAIN_ORDER_SIDEBAR: SectionKey[] = ['profile', 'experience', 'education', 'additional'];

export default function ResumeRenderer({ data, theme: T, pairing: P, density: d, pages = 1, measure, hiddenSections = [], sectionOrder, pageFormat = 'a4', sectionPages }: Props) {
  /* Manual page-break mode: if the user has explicitly pinned sections to
     pages 2/3 and we're rendering more than one page, emit N independent
     single-page renderer instances, each with the other-page sections
     hidden. This gives the user "hard" pages — no flow, no surprises:
     page 2 contains exactly what they put on page 2. */
  if (sectionPages && pages > 1 && !measure) {
    const pagesArr: React.ReactNode[] = [];
    for (let p = 1; p <= pages; p++) {
      const hideForThisPage: SectionKey[] = [];
      const allSections: SectionKey[] = ['profile', 'details', 'experience', 'education', 'skills', 'languages', 'additional'];
      for (const k of allSections) {
        const assignedPage = sectionPages[k] ?? 1;
        if (assignedPage !== p) hideForThisPage.push(k);
      }
      pagesArr.push(
        <ResumeRenderer
          key={`p${p}`}
          data={data}
          theme={T}
          pairing={P}
          density={d}
          pages={1}
          hiddenSections={[...hiddenSections, ...hideForThisPage]}
          sectionOrder={sectionOrder}
          pageFormat={pageFormat}
        />,
      );
    }
    return <>{pagesArr}</>;
  }
  const C = T.colors;
  const { profile, labels } = data;
  const sec = labels.sections;
  const hidden = new Set<SectionKey>(hiddenSections);
  const fmt = getPageFormat(pageFormat);

  // The set of sections the main column "owns" depends on the layout: sidebar
  // layouts park details/languages/skills into their fixed sidebar; single-
  // column + header-band + timeline layouts render all of them inline.
  const isSidebar = T.layout === 'sidebar-left' || T.layout === 'sidebar-right';
  const defaultOrder: SectionKey[] = isSidebar ? MAIN_ORDER_SIDEBAR : DEFAULT_MAIN_ORDER;
  const ownable: Set<SectionKey> = new Set(defaultOrder);
  const mainOrder: SectionKey[] = (() => {
    if (!sectionOrder || !sectionOrder.length) return defaultOrder;
    // Migrate old profiles: any section in defaultOrder that the user's
    // saved sectionOrder doesn't mention yet (e.g. 'details' which was
    // recently added) gets inserted at its DEFAULT POSITION relative to
    // its neighbours in the saved order — not appended at the very end.
    // Otherwise old profiles render Eckdaten as the absolute last block.
    const userKeys = sectionOrder.filter(k => ownable.has(k));
    const userSet = new Set(userKeys);
    const out: SectionKey[] = [...userKeys];
    for (let i = 0; i < defaultOrder.length; i++) {
      const k = defaultOrder[i];
      if (userSet.has(k)) continue;
      // Find the nearest later key from defaultOrder that IS in the user's
      // order — splice the missing key just before that. If none found,
      // it's a tail-only section and goes to the end.
      let insertAt = out.length;
      for (let j = i + 1; j < defaultOrder.length; j++) {
        const idx = out.indexOf(defaultOrder[j]);
        if (idx >= 0) { insertAt = idx; break; }
      }
      out.splice(insertAt, 0, k);
      userSet.add(k);
    }
    return out;
  })();

  const pageStyle: React.CSSProperties = {
    width: `${fmt.widthMm}mm`,
    minHeight: measure ? undefined : `${pages * fmt.heightMm}mm`,
    height: measure ? undefined : `${pages * fmt.heightMm}mm`,
    background: C.pageBg,
    fontFamily: P.body,
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    overflow: measure ? 'visible' : 'hidden',
    // Prevent long tokens (URLs, single-word skills, hyphenless company names)
    // from blowing out fixed-width sidebars/columns at default font scale.
    // Applies to all descendants via inheritance so we don't have to thread it
    // through every nested style block.
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  };

  // Builds the inline "Eckdaten" grid — only emitted when at least one detail
  // field is populated. Lives here so it can be hooked into the sectionRenderers
  // map and respected by sectionOrder, instead of being hard-pinned to the end
  // of the main column like before.
  const renderDetailsInline = () => {
    const detailRows = [
      data.personal.birthDate && { l: data.labels.fields.birthDate, v: data.personal.birthDate },
      data.personal.birthPlace && { l: data.labels.fields.birthPlace, v: data.personal.birthPlace },
      data.personal.maritalStatus && { l: data.labels.fields.maritalStatus, v: data.personal.maritalStatus },
      data.personal.nationality && { l: data.labels.fields.nationality, v: data.personal.nationality },
      data.personal.driversLicense && { l: data.labels.fields.driversLicense, v: data.personal.driversLicense },
    ].filter(Boolean) as { l: string; v: string }[];
    if (!detailRows.length) return null;
    return (
      <section key="details">
        <SectionTitle label={sec.details} T={T} C={C} P={P} d={d} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(detailRows.length, 4)}, 1fr)`, gap: `${10 * d}px ${24 * d}px` }}>
          {detailRows.map(r => (
            <div key={r.l}>
              <div style={{ fontFamily: P.body, fontSize: `${6.8 * d}px`, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.accent, marginBottom: `${1.5 * d}px` }}>{r.l}</div>
              <div style={{ fontFamily: P.body, fontSize: `${9.3 * d}px`, color: C.inkMid, lineHeight: 1.4, overflowWrap: 'break-word' }}>{r.v}</div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Renderers for each main-column section. mainOrder iterates over these.
  const sectionRenderers: Record<string, () => React.ReactNode> = {
    profile: () => data.profile?.text
      ? <section key="profile"><SectionTitle label={sec.profile} T={T} C={C} P={P} d={d} />{profilePara()}</section>
      : null,
    details: () => renderDetailsInline(),
    experience: () => (
      <section key="experience"><SectionTitle label={sec.experience} T={T} C={C} P={P} d={d} /><ExperienceList data={data} T={T} C={C} P={P} d={d} timeline={T.layout === 'timeline'} /></section>
    ),
    education: () => (
      <section key="education"><SectionTitle label={sec.education} T={T} C={C} P={P} d={d} /><EducationList data={data} C={C} P={P} d={d} /></section>
    ),
    skills: () => data.skillGroups.length > 0
      ? <div key="skills" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(data.skillGroups.length, 3)}, 1fr)`, gap: `${18 * d}px ${24 * d}px` }}>
          {data.skillGroups.map(g => (
            <section key={g.label}>
              <SectionTitle label={g.label} T={T} C={C} P={P} d={d} />
              <SkillGroupBlock group={g} T={T} C={C} P={P} d={d} />
            </section>
          ))}
        </div>
      : null,
    languages: () => data.languages.length > 0
      ? <section key="languages"><SectionTitle label={sec.languages} T={T} C={C} P={P} d={d} /><LangBlock data={data} C={C} P={P} d={d} /></section>
      : null,
    additional: () => data.additionalExperience && data.additionalExperience.length > 0
      ? <section key="additional"><SectionTitle label={sec.additional} T={T} C={C} P={P} d={d} /><SkillGroupBlock group={{ label: sec.additional, items: data.additionalExperience }} T={T} C={C} P={P} d={d} /></section>
      : null,
  };

  // 'profile' is intentionally excluded from MainSections here — most layouts
  // render the profile paragraph as part of the header block, not inline with
  // experience+education. The mainOrder filter still respects it, but the
  // renderer only emits it from MainSections when the layout calls for that.
  const MainSections = (
    <>
      {mainOrder.filter(k => k !== 'profile' && !hidden.has(k)).map(k => sectionRenderers[k]?.())}
    </>
  );


  const profilePara = (color?: string) => (
    <p style={{ fontFamily: P.body, fontSize: `${9.4 * d}px`, color: color ?? C.inkMid, lineHeight: 1.72, margin: 0 }}>{profile.text}</p>
  );

  // ── sidebar-left / sidebar-right ──────────────────────────────────────────
  if (T.layout === 'sidebar-left' || T.layout === 'sidebar-right') {
    const sidebar = (
      <div style={{
        width: '66mm', flexShrink: 0, background: C.panelBg,
        padding: `${30 * d}px ${24 * d}px`, display: 'flex', flexDirection: 'column', gap: `${17 * d}px`,
      }}>
        {T.photo !== 'none' && data.personal.photo && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: `${3 * d}px` }}>
            <Photo data={data} T={T} C={C} sizeMm={T.photo === 'rect' ? 46 : 36} />
          </div>
        )}
        {T.nameInSidebar && (
          <div>
            <NameBlock data={data} T={T} C={C} P={P} d={d} onPanel />
            <div style={{ height: '1px', background: C.panelInkSoft, opacity: 0.35, margin: `${10 * d}px 0` }} />
          </div>
        )}
        <SidebarSections data={data} T={T} C={C} P={P} d={d} onPanel hidden={hidden} />
      </div>
    );
    const main = (
      <div style={{ flex: 1, padding: `${32 * d}px ${30 * d}px`, display: 'flex', flexDirection: 'column', gap: `${18 * d}px`, minWidth: 0 }}>
        {!T.nameInSidebar && (
          <div>
            <NameBlock data={data} T={T} C={C} P={P} d={d} big />
            <div style={{ height: '1px', background: C.rule, margin: `${14 * d}px 0` }} />
            {!hidden.has('profile') && profilePara()}
          </div>
        )}
        {T.nameInSidebar && !hidden.has('profile') && <section><SectionTitle label={sec.profile} T={T} C={C} P={P} d={d} />{profilePara()}</section>}
        {MainSections}
      </div>
    );
    return (
      <div className="cv-page" style={pageStyle}>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {T.layout === 'sidebar-left' ? <>{sidebar}{main}</> : <>{main}{sidebar}</>}
        </div>
      </div>
    );
  }

  // ── header-band ───────────────────────────────────────────────────────────
  if (T.layout === 'header-band') {
    return (
      <div className="cv-page" style={pageStyle}>
        <div style={{
          background: C.panelBg, color: C.panelInk, padding: `${30 * d}px ${34 * d}px`,
          display: 'flex', alignItems: 'center', gap: `${22 * d}px`,
        }}>
          {T.photo !== 'none' && data.personal.photo && <Photo data={data} T={T} C={C} sizeMm={32} />}
          <div style={{ flex: 1 }}>
            <NameBlock data={data} T={T} C={C} P={P} d={d} big onPanel />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${3 * d}px`, textAlign: 'right' }}>
            {inlineContact(data.personal).map((v, i) => (
              <div key={i} style={{ fontFamily: P.body, fontSize: `${8.2 * d}px`, color: C.panelInkSoft }}>{v}</div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, padding: `${26 * d}px ${28 * d}px`, display: 'flex', flexDirection: 'column', gap: `${16 * d}px`, minWidth: 0 }}>
            {!hidden.has('profile') && <section><SectionTitle label={sec.profile} T={T} C={C} P={P} d={d} />{profilePara()}</section>}
            {MainSections}
          </div>
          <div style={{ width: '62mm', flexShrink: 0, borderLeft: `1px solid ${C.rule}`, padding: `${26 * d}px ${24 * d}px`, display: 'flex', flexDirection: 'column', gap: `${16 * d}px`, background: C.pageBg }}>
            <SidebarSections data={data} T={T} C={C} P={P} d={d} onPanel={false} hidden={hidden} />
          </div>
        </div>
      </div>
    );
  }

  // ── top-centered (traditional German: photo right, name left, single body column)
  // Used by Wien template. Photo as small portrait on the right, name + title
  // on the left, contact list right-aligned beneath the photo, accent rule
  // separating header from body. Skills laid out as a horizontal grid so the
  // page fills naturally instead of leaving a hole at the bottom.
  if (T.layout === 'top-centered') {
    return (
      <div className="cv-page" style={pageStyle}>
        <div style={{
          padding: `${28 * d}px ${32 * d}px ${18 * d}px`,
          display: 'flex', alignItems: 'flex-start', gap: `${20 * d}px`,
          borderBottom: `1px solid ${C.accent}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NameBlock data={data} T={T} C={C} P={P} d={d} big />
            <div style={{
              marginTop: `${10 * d}px`,
              display: 'flex', flexWrap: 'wrap', gap: `${3 * d}px ${10 * d}px`,
              fontFamily: P.body, fontSize: `${8.4 * d}px`, color: C.inkSoft,
            }}>
              {inlineContact(data.personal)
                .flatMap((v, i, arr) => i < arr.length - 1
                  ? [<span key={i}>{v}</span>, <span key={`s${i}`} style={{ color: C.accent, opacity: 0.55 }}>·</span>]
                  : [<span key={i}>{v}</span>])}
            </div>
          </div>
          {T.photo !== 'none' && data.personal.photo && (
            <div style={{ flexShrink: 0 }}>
              <Photo data={data} T={T} C={C} sizeMm={24} />
            </div>
          )}
        </div>
        <div style={{ flex: 1, padding: `${22 * d}px ${32 * d}px`, display: 'flex', flexDirection: 'column', gap: `${15 * d}px`, minHeight: 0 }}>
          {/* header-band shares the single-column section-iteration model so
              the user can reorder details/skills/languages here too. */}
          {mainOrder.filter(k => !hidden.has(k)).map(k => sectionRenderers[k]?.())}
        </div>
      </div>
    );
  }

  // ── single-column / timeline ──────────────────────────────────────────────
  return (
    <div className="cv-page" style={pageStyle}>
      <div style={{ padding: `${34 * d}px ${36 * d}px`, display: 'flex', flexDirection: 'column', gap: `${17 * d}px`, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: T.photo !== 'none' && data.personal.photo ? 'center' : 'flex-end', gap: `${18 * d}px`, borderBottom: `1.5px solid ${C.accent}`, paddingBottom: `${14 * d}px` }}>
          {T.photo !== 'none' && data.personal.photo && <Photo data={data} T={T} C={C} sizeMm={26} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <NameBlock data={data} T={T} C={C} P={P} d={d} big />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${2 * d}px`, textAlign: 'right' }}>
            {inlineContact(data.personal)
              .map((v, i) => <div key={i} style={{ fontFamily: P.body, fontSize: `${8.2 * d}px`, color: C.inkSoft }}>{v}</div>)}
          </div>
        </div>
        {/* Single-column layouts (Tokio/Zürich/Onyx/Stockholm/Hamburg/Wien/München…)
            iterate mainOrder which now includes details/skills/languages, so the
            user can drag them anywhere — including 'Eckdaten' right after the
            profile, which is what most German recruiters expect. */}
        {mainOrder.filter(k => !hidden.has(k)).map(k => sectionRenderers[k]?.())}
      </div>
    </div>
  );
}
