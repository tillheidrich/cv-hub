import type { CVData } from './types';
import type { ResumeTheme, ThemeColors, FontPairing, BulletStyle } from './theme';

interface Props {
  data: CVData;
  theme: ResumeTheme;
  pairing: FontPairing;
  /** effective size multiplier (user scale × auto-fit density) */
  density: number;
  /** how many A4 pages tall the page box should be */
  pages?: number;
  /** measuring mode — render natural height instead of clamped */
  measure?: boolean;
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
  if (T.heading === 'block') {
    return (
      <div style={{
        display: 'inline-block', marginBottom: `${9 * d}px`, background: accent, color: onPanel ? C.panelBg : C.accentInk,
        fontFamily: P.body, fontSize: `${7.6 * d}px`, fontWeight: 700, letterSpacing: `${1.8 * d}px`,
        textTransform: 'uppercase', padding: `${3.5 * d}px ${7 * d}px`,
      }}>{label}</div>
    );
  }
  if (T.heading === 'bar') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: `${6 * d}px`, marginBottom: `${9 * d}px` }}>
        <div style={{ width: `${12 * d}px`, height: `${3 * d}px`, background: accent }} />
        <div style={{ fontFamily: P.body, fontSize: `${8.6 * d}px`, fontWeight: 700, letterSpacing: `${1.8 * d}px`, textTransform: 'uppercase', color: ink }}>{label}</div>
      </div>
    );
  }
  if (T.heading === 'caps-rule') {
    return (
      <div style={{ marginBottom: `${9 * d}px` }}>
        <div style={{
          fontFamily: P.body, fontSize: `${8.6 * d}px`, fontWeight: 700, letterSpacing: `${2.6 * d}px`,
          textTransform: 'uppercase', color: accent, marginBottom: `${5 * d}px`,
        }}>{label}</div>
        <div style={{ height: '0.8px', background: `linear-gradient(to right, ${accent}, transparent)` }} />
      </div>
    );
  }
  // caps-tracked — accent tick + label
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${7 * d}px`, marginBottom: `${9 * d}px` }}>
      <div style={{ width: `${3 * d}px`, height: `${10 * d}px`, background: accent, flexShrink: 0 }} />
      <div style={{
        fontFamily: P.body, fontSize: `${8.6 * d}px`, fontWeight: 700, letterSpacing: `${2.6 * d}px`,
        textTransform: 'uppercase', color: ink,
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
  if (personal.linkedin) rows.push({ l: labels.fields.linkedin, v: personal.linkedin, href: `https://${personal.linkedin}` });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${5.5 * d}px` }}>
      {rows.map(([l, v]) => (
        <div key={l}>
          <div style={{ fontFamily: P.body, fontSize: `${6.8 * d}px`, fontWeight: 700, letterSpacing: `${1.2 * d}px`, textTransform: 'uppercase', color: lab, marginBottom: `${1.5 * d}px` }}>{l}</div>
          <div style={{ fontFamily: P.body, fontSize: `${9.3 * d}px`, color: ink, lineHeight: 1.4 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

function LangBlock({ data, C, P, d, onPanel }: { data: CVData; C: ThemeColors; P: FontPairing; d: number; onPanel?: boolean }) {
  const ink = onPanel ? C.panelInk : C.ink;
  const soft = onPanel ? C.panelInkSoft : C.inkSoft;
  const accent = onPanel ? C.panelAccent : C.accent;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${6 * d}px` }}>
      {data.languages.map(l => (
        <div key={l.language}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: `${6 * d}px` }}>
            <span style={{ fontFamily: P.body, fontSize: `${9.3 * d}px`, fontWeight: 600, color: ink }}>{l.language}</span>
            <span style={{ fontFamily: P.body, fontSize: `${7.8 * d}px`, color: soft, textAlign: 'right' }}>{l.level}</span>
          </div>
          <div style={{ height: `${2 * d}px`, background: onPanel ? 'rgba(255,255,255,0.16)' : C.chipBg, marginTop: `${3 * d}px`, borderRadius: `${2 * d}px`, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${langPct(l.level)}%`, background: accent, borderRadius: `${2 * d}px` }} />
          </div>
        </div>
      ))}
    </div>
  );
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
  if (T.photo === 'none') return null;
  const radius = T.photo === 'circle' ? '50%' : T.photo === 'rounded' ? `${sizeMm * 0.13}mm` : '0';
  return (
    <div style={{
      width: `${sizeMm}mm`, height: `${sizeMm}mm`, flexShrink: 0, borderRadius: radius,
      overflow: 'hidden', background: C.chipBg, position: 'relative',
    }}>
      {data.personal.photo && (
        <img src={data.personal.photo} alt={data.personal.name}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      )}
      {!data.personal.photo && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.inkSoft, fontSize: `${sizeMm * 1.2}px` }}>👤</div>
      )}
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
        lineHeight: 1.04, letterSpacing: T.uppercaseName ? `${0.6 * d}px` : `${-0.6 * d}px`,
        textTransform: T.uppercaseName ? 'uppercase' : 'none',
      }}>{data.personal.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start', gap: `${8 * d}px`, marginTop: `${7 * d}px` }}>
        {center && <div style={{ width: `${18 * d}px`, height: `${1.5 * d}px`, background: titleColor }} />}
        <div style={{
          fontFamily: P.body, fontSize: `${8.8 * d}px`, fontWeight: 600, letterSpacing: `${2.8 * d}px`,
          textTransform: 'uppercase', color: titleColor,
        }}>{data.personal.title}</div>
        {center && <div style={{ width: `${18 * d}px`, height: `${1.5 * d}px`, background: titleColor }} />}
      </div>
    </div>
  );
}

// ── Sidebar section stack (top-level, stable identity) ──────────────────────

function SidebarSections({ data, T, C, P, d, onPanel }: {
  data: CVData; T: ResumeTheme; C: ThemeColors; P: FontPairing; d: number; onPanel: boolean;
}) {
  const sec = data.labels.sections;
  return (
    <>
      <section><SectionTitle label={sec.personal} T={T} C={C} P={P} d={d} onPanel={onPanel} /><ContactBlock data={data} C={C} P={P} d={d} onPanel={onPanel} /></section>
      {DetailBlock({ data, C, P, d, onPanel }) && (
        <section><SectionTitle label={sec.details} T={T} C={C} P={P} d={d} onPanel={onPanel} /><DetailBlock data={data} C={C} P={P} d={d} onPanel={onPanel} /></section>
      )}
      <section><SectionTitle label={sec.languages} T={T} C={C} P={P} d={d} onPanel={onPanel} /><LangBlock data={data} C={C} P={P} d={d} onPanel={onPanel} /></section>
      {data.skillGroups.map(g => (
        <section key={g.label}><SectionTitle label={g.label} T={T} C={C} P={P} d={d} onPanel={onPanel} /><SkillGroupBlock group={g} T={T} C={C} P={P} d={d} onPanel={onPanel} /></section>
      ))}
      {data.additionalExperience && data.additionalExperience.length > 0 && (
        <section><SectionTitle label={sec.additional} T={T} C={C} P={P} d={d} onPanel={onPanel} />
          <SkillGroupBlock group={{ label: sec.additional, items: data.additionalExperience }} T={T} C={C} P={P} d={d} onPanel={onPanel} />
        </section>
      )}
    </>
  );
}

// ── Main renderer ───────────────────────────────────────────────────────────

export default function ResumeRenderer({ data, theme: T, pairing: P, density: d, pages = 1, measure }: Props) {
  const C = T.colors;
  const { profile, labels } = data;
  const sec = labels.sections;

  const pageStyle: React.CSSProperties = {
    width: '210mm',
    minHeight: measure ? undefined : `${pages * 297}mm`,
    height: measure ? undefined : `${pages * 297}mm`,
    background: C.pageBg,
    fontFamily: P.body,
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    overflow: measure ? 'visible' : 'hidden',
  };

  const MainSections = (
    <>
      <section><SectionTitle label={sec.experience} T={T} C={C} P={P} d={d} /><ExperienceList data={data} T={T} C={C} P={P} d={d} timeline={T.layout === 'timeline'} /></section>
      <section><SectionTitle label={sec.education} T={T} C={C} P={P} d={d} /><EducationList data={data} C={C} P={P} d={d} /></section>
    </>
  );

  const ProfilePara = ({ color }: { color?: string }) => (
    <p style={{ fontFamily: P.body, fontSize: `${9.4 * d}px`, color: color ?? C.inkMid, lineHeight: 1.72, margin: 0 }}>{profile.text}</p>
  );

  // ── sidebar-left / sidebar-right ──────────────────────────────────────────
  if (T.layout === 'sidebar-left' || T.layout === 'sidebar-right') {
    const sidebar = (
      <div style={{
        width: '66mm', flexShrink: 0, background: C.panelBg,
        padding: `${30 * d}px ${24 * d}px`, display: 'flex', flexDirection: 'column', gap: `${17 * d}px`,
      }}>
        {T.photo !== 'none' && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: `${3 * d}px` }}>
            <Photo data={data} T={T} C={C} sizeMm={T.photo === 'rect' ? 46 : 36} />
          </div>
        )}
        <SidebarSections data={data} T={T} C={C} P={P} d={d} onPanel />
      </div>
    );
    const main = (
      <div style={{ flex: 1, padding: `${32 * d}px ${30 * d}px`, display: 'flex', flexDirection: 'column', gap: `${18 * d}px`, minWidth: 0 }}>
        <div>
          <NameBlock data={data} T={T} C={C} P={P} d={d} big />
          <div style={{ height: '1px', background: C.rule, margin: `${14 * d}px 0` }} />
          <ProfilePara />
        </div>
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
          {T.photo !== 'none' && <Photo data={data} T={T} C={C} sizeMm={32} />}
          <div style={{ flex: 1 }}>
            <NameBlock data={data} T={T} C={C} P={P} d={d} big onPanel />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${3 * d}px`, textAlign: 'right' }}>
            {[data.personal.email, data.personal.phone, data.personal.location, data.personal.website]
              .filter(Boolean).map((v, i) => (
                <div key={i} style={{ fontFamily: P.body, fontSize: `${8.2 * d}px`, color: C.panelInkSoft }}>{v}</div>
              ))}
          </div>
        </div>
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, padding: `${26 * d}px ${28 * d}px`, display: 'flex', flexDirection: 'column', gap: `${16 * d}px`, minWidth: 0 }}>
            <section><SectionTitle label={sec.profile} T={T} C={C} P={P} d={d} /><ProfilePara /></section>
            {MainSections}
          </div>
          <div style={{ width: '62mm', flexShrink: 0, borderLeft: `1px solid ${C.rule}`, padding: `${26 * d}px ${24 * d}px`, display: 'flex', flexDirection: 'column', gap: `${16 * d}px`, background: C.pageBg }}>
            <SidebarSections data={data} T={T} C={C} P={P} d={d} onPanel={false} />
          </div>
        </div>
      </div>
    );
  }

  // ── top-centered ──────────────────────────────────────────────────────────
  if (T.layout === 'top-centered') {
    return (
      <div className="cv-page" style={pageStyle}>
        <div style={{ padding: `${32 * d}px ${34 * d}px ${22 * d}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: `${13 * d}px`, borderBottom: `2px solid ${C.accent}` }}>
          {T.photo !== 'none' && <Photo data={data} T={T} C={C} sizeMm={32} />}
          <NameBlock data={data} T={T} C={C} P={P} d={d} big center />
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${5 * d}px ${16 * d}px`, fontFamily: P.body, fontSize: `${8.4 * d}px`, color: C.inkSoft }}>
            {[data.personal.email, data.personal.phone, data.personal.location, data.personal.website].filter(Boolean).map((v, i) => <span key={i}>{v}</span>)}
          </div>
        </div>
        <div style={{ flex: 1, padding: `${24 * d}px ${34 * d}px`, display: 'flex', flexDirection: 'column', gap: `${16 * d}px`, minHeight: 0 }}>
          <section><SectionTitle label={sec.profile} T={T} C={C} P={P} d={d} /><ProfilePara /></section>
          {MainSections}
          <div style={{ display: 'flex', gap: `${28 * d}px` }}>
            <div style={{ flex: 1 }}>
              {data.skillGroups.slice(0, 2).map(g => (
                <section key={g.label} style={{ marginBottom: `${12 * d}px` }}><SectionTitle label={g.label} T={T} C={C} P={P} d={d} /><SkillGroupBlock group={g} T={T} C={C} P={P} d={d} /></section>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              {data.skillGroups.slice(2).map(g => (
                <section key={g.label} style={{ marginBottom: `${12 * d}px` }}><SectionTitle label={g.label} T={T} C={C} P={P} d={d} /><SkillGroupBlock group={g} T={T} C={C} P={P} d={d} /></section>
              ))}
              <section><SectionTitle label={sec.languages} T={T} C={C} P={P} d={d} /><LangBlock data={data} C={C} P={P} d={d} /></section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── single-column / timeline ──────────────────────────────────────────────
  return (
    <div className="cv-page" style={pageStyle}>
      <div style={{ padding: `${34 * d}px ${36 * d}px`, display: 'flex', flexDirection: 'column', gap: `${17 * d}px`, flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: `${18 * d}px`, borderBottom: `1.5px solid ${C.accent}`, paddingBottom: `${14 * d}px` }}>
          <NameBlock data={data} T={T} C={C} P={P} d={d} big />
          <div style={{ display: 'flex', flexDirection: 'column', gap: `${2 * d}px`, textAlign: 'right' }}>
            {[data.personal.email, data.personal.phone, data.personal.location, data.personal.website]
              .filter(Boolean).map((v, i) => <div key={i} style={{ fontFamily: P.body, fontSize: `${8.2 * d}px`, color: C.inkSoft }}>{v}</div>)}
          </div>
        </div>
        <section><SectionTitle label={sec.profile} T={T} C={C} P={P} d={d} /><ProfilePara /></section>
        {MainSections}
        <div style={{ display: 'flex', gap: `${28 * d}px` }}>
          <div style={{ flex: 1.4 }}>
            {data.skillGroups.map(g => (
              <section key={g.label} style={{ marginBottom: `${12 * d}px` }}><SectionTitle label={g.label} T={T} C={C} P={P} d={d} /><SkillGroupBlock group={g} T={T} C={C} P={P} d={d} /></section>
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <section style={{ marginBottom: `${12 * d}px` }}><SectionTitle label={sec.languages} T={T} C={C} P={P} d={d} /><LangBlock data={data} C={C} P={P} d={d} /></section>
            {DetailBlock({ data, C, P, d }) && (
              <section><SectionTitle label={sec.details} T={T} C={C} P={P} d={d} /><DetailBlock data={data} C={C} P={P} d={d} /></section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
