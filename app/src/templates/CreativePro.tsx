import type { CVData } from '../data/types';
import { languageDots } from './ResumeRenderer';

function DotsInline({ value, max, size, on, off }: { value: number; max: number; size: number | string; on: string; off: string }) {
  const px = typeof size === 'string' ? size : `${size}px`;
  return (
    <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ display: 'inline-block', width: px, height: px, borderRadius: '50%', background: i < value ? on : off }} />
      ))}
    </span>
  );
}

interface Props {
  data: CVData;
  fontScale?: number;
}

// ── Design Tokens ──────────────────────────────────────────────────────────
// Warm editorial palette — stone/terracotta, Playfair Display + Inter
const C = {
  ink: '#1c1410',
  inkMid: '#3d342a',
  inkLight: '#7a6d61',
  accent: '#9b4f2e',      // warm terracotta
  accentLight: '#c4845f', // lighter terracotta for secondary labels
  sand: '#f5f0e8',
  sandDark: '#ede5d8',
  cream: '#faf8f5',
  rule: 'rgba(155,79,46,0.22)',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionLabel({ children, color = C.accent, scale = 1 }: { children: React.ReactNode; color?: string; scale?: number }) {
  return (
    <div style={{ marginBottom: '7px' }}>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: `${6 * scale}px`,
        fontWeight: 700,
        letterSpacing: '2.8px',
        textTransform: 'uppercase',
        color,
        marginBottom: '5px',
      }}>
        {children}
      </div>
      <div style={{
        height: '0.5px',
        background: `linear-gradient(to right, ${color}, transparent)`,
        opacity: 0.5,
      }} />
    </div>
  );
}

function SideLabel({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  return (
    <div style={{ marginBottom: '7px' }}>
      <div style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: `${6 * scale}px`,
        fontWeight: 700,
        letterSpacing: '2.5px',
        textTransform: 'uppercase',
        color: C.accentLight,
        marginBottom: '5px',
      }}>
        {children}
      </div>
      <div style={{ height: '0.5px', background: 'rgba(196,132,95,0.35)' }} />
    </div>
  );
}

// ── Main Template ──────────────────────────────────────────────────────────

export default function CreativePro({ data, fontScale = 1 }: Props) {
  const { personal, profile, experience, education, skillGroups, languages, additionalExperience, labels } = data;
  const { sections, fields, misc } = labels;
  const f = (px: number) => `${px * fontScale}px`;

  return (
    <div className="cv-page" style={{
      fontFamily: "'Inter', sans-serif",
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── HEADER: full-width warm band ───────────────────────────────────── */}
      <div style={{
        background: C.sand,
        borderBottom: `2px solid ${C.accent}`,
        display: 'flex',
        alignItems: 'stretch',
        minHeight: '68mm',
      }}>

        {/* Photo */}
        <div style={{
          width: '56mm',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          background: C.sandDark,
        }}>
          {personal.photo ? (
            <img
              src={personal.photo}
              alt={personal.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const next = img.nextElementSibling as HTMLElement | null;
                if (next) next.style.display = 'flex';
              }}
            />
          ) : null}
          <div style={{
            width: '100%', height: '100%',
            display: personal.photo ? 'none' : 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '6px',
            color: C.inkLight, fontSize: f(10), fontStyle: 'italic',
          }}>
            <span style={{ fontSize: '26px', opacity: 0.35 }}>👤</span>
            <span>Foto hinzufügen</span>
          </div>

          {/* Corner accent — terracotta triangle */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '0 0 22px 22px',
            borderColor: `transparent transparent ${C.accent} transparent`,
          }} />
        </div>

        {/* Name + title + profile */}
        <div style={{
          flex: 1,
          padding: '16mm 16mm 14mm 13mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 0,
        }}>
          {/* Name — serif display */}
          <div style={{
            fontFamily: "'Playfair Display', 'Georgia', serif",
            fontSize: f(33),
            fontWeight: 700,
            color: C.ink,
            lineHeight: 1.0,
            letterSpacing: '-0.5px',
            marginBottom: '4px',
          }}>
            {personal.name}
          </div>

          {/* Title */}
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: f(7.5),
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: C.accent,
            marginBottom: '11px',
          }}>
            {personal.title}
          </div>

          {/* Ornament rule */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '11px' }}>
            <div style={{ width: '28px', height: '1px', background: C.accent }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: C.accent, opacity: 0.5 }} />
            <div style={{ width: '12px', height: '1px', background: C.accent, opacity: 0.4 }} />
          </div>

          {/* Profile */}
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: f(7.5),
            color: C.inkMid,
            lineHeight: 1.75,
            margin: 0,
            maxWidth: '118mm',
          }}>
            {profile.text}
          </p>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
        <div style={{
          width: '62mm',
          flexShrink: 0,
          background: C.cream,
          borderRight: `1px solid ${C.rule}`,
          padding: '10mm 9mm',
          display: 'flex',
          flexDirection: 'column',
          gap: '8mm',
        }}>

          {/* Contact */}
          <section>
            <SideLabel scale={fontScale}>{sections.personal}</SideLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '5px' }}>
              {[
                { key: fields.email, val: personal.email, href: `mailto:${personal.email}` },
                { key: fields.phone, val: personal.phone, href: undefined },
                { key: fields.address, val: personal.location, href: undefined },
                ...(personal.website ? [{ key: fields.web, val: personal.website, href: `https://${personal.website}` }] : []),
                ...(personal.linkedin ? [{ key: fields.linkedin, val: personal.linkedin, href: `https://${personal.linkedin}` }] : []),
              ].map(({ key, val, href }) => {
                const inner = (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                    <span style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: f(5.5),
                      fontWeight: 700,
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                      color: C.accentLight,
                    }}>
                      {key}
                    </span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: f(7.2), color: C.inkMid, lineHeight: 1.4 }}>
                      {val}
                    </span>
                  </div>
                );
                return href ? (
                  <a key={key} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a>
                ) : (
                  <div key={key}>{inner}</div>
                );
              })}
            </div>
          </section>

          {/* Personal details */}
          {(personal.birthDate || personal.birthPlace || personal.maritalStatus || personal.nationality || personal.driversLicense) && (
            <section>
              <SideLabel scale={fontScale}>{sections.details}</SideLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '5px' }}>
                {([
                  personal.birthDate     ? [fields.birthDate,      personal.birthDate]     : null,
                  personal.birthPlace    ? [fields.birthPlace,      personal.birthPlace]    : null,
                  personal.maritalStatus ? [fields.maritalStatus,  personal.maritalStatus] : null,
                  personal.nationality   ? [fields.nationality,     personal.nationality]   : null,
                  personal.driversLicense ? [fields.driversLicense, personal.driversLicense] : null,
                ] as ([string, string] | null)[]).filter((x): x is [string, string] => x !== null).map(([key, val]) => (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{
                      fontSize: f(5.5), fontWeight: 700, letterSpacing: '1.2px',
                      textTransform: 'uppercase', color: C.accentLight,
                    }}>
                      {key}
                    </span>
                    <span style={{ fontSize: f(7.2), color: C.inkMid, lineHeight: 1.4 }}>{val}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Languages */}
          <section>
            <SideLabel scale={fontScale}>{sections.languages}</SideLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
              {languages.map((lang) => (
                <div key={lang.language}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: f(7.5), fontWeight: 600, color: C.ink }}>{lang.language}</span>
                    <DotsInline value={languageDots(lang)} max={5} size={f(4.5)} on={C.ink} off={C.inkLight} />
                  </div>
                  <div style={{ fontSize: f(6.8), color: C.inkLight, marginTop: '1px', fontStyle: 'italic' }}>{lang.level}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Skill groups */}
          {skillGroups.map((group) => (
            <section key={group.label}>
              <SideLabel scale={fontScale}>{group.label}</SideLabel>
              <ul style={{ margin: '5px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {group.items.map((item) => (
                  <li key={item} style={{
                    fontSize: f(7.2),
                    color: C.inkMid,
                    lineHeight: 1.4,
                    paddingLeft: '9px',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute',
                      left: 0, top: '5px',
                      width: '4px', height: '1px',
                      background: C.accent,
                      opacity: 0.7,
                    }} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* Additional */}
          {additionalExperience && additionalExperience.length > 0 && (
            <section>
              <SideLabel scale={fontScale}>{sections.additional}</SideLabel>
              <ul style={{ margin: '5px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {additionalExperience.map((item) => (
                  <li key={item} style={{
                    fontSize: f(7),
                    color: C.inkLight,
                    lineHeight: 1.4,
                    paddingLeft: '9px',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute',
                      left: 0, top: '5px',
                      width: '4px', height: '1px',
                      background: C.accentLight,
                      opacity: 0.7,
                    }} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── RIGHT: Experience + Education ────────────────────────────────── */}
        <div style={{
          flex: 1,
          padding: '10mm 13mm 10mm 11mm',
          display: 'flex',
          flexDirection: 'column',
          gap: '9mm',
        }}>

          {/* Experience */}
          <section>
            <SectionLabel scale={fontScale}>{sections.experience}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7mm', marginTop: '5px' }}>
              {experience.filter(e => !e.hidden).map((entry) => (
                <article key={entry.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1px' }}>
                    <div style={{ flex: 1 }}>
                      {/* Role — serif for editorial feel */}
                      <div style={{
                        fontFamily: "'Playfair Display', 'Georgia', serif",
                        fontSize: f(10),
                        fontWeight: 700,
                        color: C.ink,
                        lineHeight: 1.2,
                        letterSpacing: '-0.1px',
                      }}>
                        {entry.role}
                      </div>
                      <div style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: f(7.2),
                        color: C.accent,
                        fontWeight: 500,
                        marginTop: '2px',
                        letterSpacing: '0.2px',
                      }}>
                        {entry.company}{entry.location ? ` · ${entry.location}` : ''}
                      </div>
                    </div>
                    <div style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: f(6.5),
                      color: C.inkLight,
                      whiteSpace: 'nowrap',
                      marginLeft: '10px',
                      paddingTop: '2px',
                      fontStyle: 'italic',
                    }}>
                      {entry.start} – {entry.end === 'present' || entry.end === 'heute' ? misc.present : entry.end}
                    </div>
                  </div>

                  <ul style={{ margin: '5px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {entry.bullets.map((bullet, i) => (
                      <li key={i} style={{
                        fontSize: f(7.5),
                        color: C.inkMid,
                        lineHeight: 1.6,
                        paddingLeft: '11px',
                        position: 'relative',
                      }}>
                        <span style={{
                          position: 'absolute',
                          left: 0, top: '6px',
                          width: '5px', height: '1px',
                          background: C.accent,
                          opacity: 0.6,
                        }} />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {/* Education */}
          <section>
            <SectionLabel scale={fontScale}>{sections.education}</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5mm', marginTop: '5px' }}>
              {education.map((entry) => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{
                      fontFamily: "'Playfair Display', 'Georgia', serif",
                      fontSize: f(8.5),
                      fontWeight: 700,
                      color: C.ink,
                      lineHeight: 1.25,
                    }}>
                      {entry.degree}
                    </div>
                    <div style={{ fontSize: f(7.2), color: C.accent, marginTop: '1px' }}>{entry.institution}</div>
                    {entry.notes && (
                      <div style={{ fontSize: f(6.8), color: C.inkLight, marginTop: '2px', fontStyle: 'italic' }}>
                        {entry.notes}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: f(6.5),
                    color: C.inkLight,
                    whiteSpace: 'nowrap',
                    marginLeft: '10px',
                    paddingTop: '2px',
                    fontStyle: 'italic',
                  }}>
                    {entry.start} – {entry.end}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: C.sand,
        borderTop: `1px solid ${C.rule}`,
        padding: '4mm 16mm',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', 'Georgia', serif",
          fontSize: f(7),
          color: C.inkLight,
          fontStyle: 'italic',
        }}>
          {personal.name}
        </div>
        <div style={{ fontSize: f(6), color: C.inkLight, letterSpacing: '0.5px' }}>
          {personal.email} · {personal.phone}
        </div>
      </div>

    </div>
  );
}
