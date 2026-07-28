import type { CVData } from '../data/types';
import { languageDots } from './ResumeRenderer';

/** Inline dot scale — shared by the standalone templates that render their
 *  own languages block. The main ResumeRenderer has its own DotScale. */
function DotsInline({ value, max, size, on, off }: { value: number; max: number; size: number | string; on: string; off: string }) {
  /* `size` is a CSS length — either a raw number (interpreted as px) or a
   *  pre-formatted string like "4.5px" from the template's f() helper. */
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

// ── Helpers ────────────────────────────────────────────────────────────────

function Label({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: `${6 * scale}px`,
      fontWeight: 700,
      letterSpacing: '2.5px',
      textTransform: 'uppercase',
      color: '#1a1a1a',
      marginBottom: '5px',
    }}>
      {children}
    </div>
  );
}

function Rule() {
  return <div style={{ height: '1px', background: '#1a1a1a', marginBottom: '8px' }} />;
}

function MonoText({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: '7px',
      color: '#444',
      lineHeight: 1.6,
      ...style,
    }}>
      {children}
    </span>
  );
}

// ── Main Template ──────────────────────────────────────────────────────────

export default function TechMinimal({ data, fontScale = 1 }: Props) {
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

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '14mm 16mm 10mm',
        borderBottom: '2px solid #1a1a1a',
      }}>
        {/* Name */}
        <div style={{
          fontFamily: "'Inter', 'Arial Black', sans-serif",
          fontSize: f(38),
          fontWeight: 800,
          color: '#0d0d0d',
          letterSpacing: '-1.5px',
          lineHeight: 0.95,
          marginBottom: '6px',
          textTransform: 'uppercase',
        }}>
          {personal.name}
        </div>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
          <div style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: f(8),
            fontWeight: 400,
            letterSpacing: '2px',
            color: '#555',
          }}>
            {personal.title}
          </div>
          <div style={{ flex: 1, height: '1px', background: '#ddd' }} />
          <div style={{
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: f(7),
            color: '#999',
            letterSpacing: '0.5px',
          }}>
            {personal.location}
          </div>
        </div>

        {/* Contact row */}
        <div style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          {[
            { key: fields.email, val: personal.email },
            { key: fields.phone, val: personal.phone },
            ...(personal.website ? [{ key: fields.web, val: personal.website }] : []),
            ...(personal.linkedin ? [{ key: fields.linkedin, val: personal.linkedin }] : []),
          ].map(({ key, val }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: f(5.5),
                fontWeight: 700,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: '#aaa',
              }}>
                {key}
              </span>
              <MonoText style={{ fontSize: f(7) }}>{val}</MonoText>
            </div>
          ))}
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{
          width: '58mm',
          flexShrink: 0,
          borderRight: '1px solid #e0e0e0',
          padding: '9mm 8mm',
          display: 'flex',
          flexDirection: 'column',
          gap: '7mm',
        }}>

          {/* Profile */}
          <section>
            <Label scale={fontScale}>{sections.profile}</Label>
            <Rule />
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: f(7.2),
              color: '#3a3a3a',
              lineHeight: 1.65,
              margin: 0,
            }}>
              {profile.text}
            </p>
          </section>

          {/* Education */}
          <section>
            <Label scale={fontScale}>{sections.education}</Label>
            <Rule />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5mm' }}>
              {education.map((entry) => (
                <div key={entry.id}>
                  <div style={{
                    fontSize: f(7.8),
                    fontWeight: 700,
                    color: '#0d0d0d',
                    lineHeight: 1.25,
                    marginBottom: '2px',
                  }}>
                    {entry.degree}
                  </div>
                  <div style={{ fontSize: f(7), color: '#555', marginBottom: '1px' }}>
                    {entry.institution}
                  </div>
                  <MonoText style={{ fontSize: f(6.5), color: '#999' }}>
                    {entry.start} — {entry.end}
                  </MonoText>
                  {entry.notes && (
                    <div style={{ fontSize: f(6.5), color: '#888', marginTop: '2px', fontStyle: 'italic' }}>
                      {entry.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Languages */}
          <section>
            <Label scale={fontScale}>{sections.languages}</Label>
            <Rule />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {languages.map((lang) => (
                <div key={lang.language} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: f(7.5), fontWeight: 600, color: '#1a1a1a' }}>
                    {lang.language}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
                    <MonoText style={{ fontSize: f(6.5), color: '#888' }}>{lang.level}</MonoText>
                    <DotsInline value={languageDots(lang)} max={5} size={f(4.5)} on="#1a1a1a" off="#d8d4cc" />
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Skill Groups */}
          {skillGroups.map((group) => (
            <section key={group.label}>
              <Label scale={fontScale}>{group.label}</Label>
              <Rule />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                {group.items.map((item) => (
                  <span
                    key={item}
                    style={{
                      fontFamily: "'Courier New', Courier, monospace",
                      fontSize: f(6.5),
                      color: '#1a1a1a',
                      background: '#f4f4f4',
                      padding: '2px 5px',
                      border: '0.5px solid #ccc',
                      lineHeight: 1.6,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>
          ))}

          {/* Personal details */}
          {(personal.birthDate || personal.nationality || personal.driversLicense) && (
            <section>
              <Label scale={fontScale}>{sections.details}</Label>
              <Rule />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {personal.birthDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: f(6.5), fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      {fields.birthDate}
                    </span>
                    <MonoText style={{ fontSize: f(6.5) }}>{personal.birthDate}</MonoText>
                  </div>
                )}
                {personal.nationality && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: f(6.5), fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      {fields.nationality}
                    </span>
                    <MonoText style={{ fontSize: f(6.5) }}>{personal.nationality}</MonoText>
                  </div>
                )}
                {personal.driversLicense && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: f(6.5), fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      {fields.driversLicense}
                    </span>
                    <MonoText style={{ fontSize: f(6.5) }}>{personal.driversLicense}</MonoText>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Additional */}
          {additionalExperience && additionalExperience.length > 0 && (
            <section>
              <Label scale={fontScale}>{sections.additional}</Label>
              <Rule />
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {additionalExperience.map((item) => (
                  <li key={item} style={{ fontSize: f(6.8), color: '#555', lineHeight: 1.5 }}>
                    <MonoText style={{ fontSize: f(6.5), color: '#bbb', marginRight: '4px' }}>›</MonoText>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── RIGHT COLUMN (EXPERIENCE) ─────────────────────────────────── */}
        <div style={{
          flex: 1,
          padding: '9mm 12mm 9mm 10mm',
          display: 'flex',
          flexDirection: 'column',
          gap: '7mm',
        }}>
          <section>
            <Label scale={fontScale}>{sections.experience}</Label>
            <Rule />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7mm' }}>
              {experience.filter(e => !e.hidden).map((entry) => (
                <article key={entry.id}>
                  {/* Role + date row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1px' }}>
                    <div style={{
                      fontSize: f(9),
                      fontWeight: 700,
                      color: '#0d0d0d',
                      letterSpacing: '-0.2px',
                      lineHeight: 1.2,
                    }}>
                      {entry.role}
                    </div>
                    <MonoText style={{ fontSize: f(6.5), color: '#aaa', whiteSpace: 'nowrap', marginLeft: '8px', paddingTop: '1px' }}>
                      {entry.start} — {entry.end === 'present' || entry.end === 'heute' ? misc.present : entry.end}
                    </MonoText>
                  </div>

                  {/* Company line */}
                  <div style={{
                    fontFamily: "'Courier New', Courier, monospace",
                    fontSize: f(7),
                    color: '#666',
                    marginBottom: '4px',
                    letterSpacing: '0.3px',
                  }}>
                    {entry.company}
                    {entry.location ? ` · ${entry.location}` : ''}
                  </div>

                  {/* Separator tick */}
                  <div style={{ width: '16px', height: '1px', background: '#1a1a1a', marginBottom: '5px' }} />

                  {/* Bullets */}
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {entry.bullets.map((bullet, i) => (
                      <li key={i} style={{
                        fontSize: f(7.5),
                        color: '#3a3a3a',
                        lineHeight: 1.55,
                        paddingLeft: '10px',
                        position: 'relative',
                      }}>
                        <span style={{
                          position: 'absolute',
                          left: 0,
                          top: '4px',
                          fontFamily: "'Courier New', Courier, monospace",
                          fontSize: f(8),
                          color: '#bbb',
                          lineHeight: 1,
                        }}>
                          —
                        </span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '2px solid #1a1a1a',
        padding: '3.5mm 16mm',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <MonoText style={{ fontSize: f(6), color: '#aaa' }}>
          {personal.name.toUpperCase()} · {misc.cvLabel.toUpperCase()}
        </MonoText>
        <MonoText style={{ fontSize: f(6), color: '#aaa' }}>
          {personal.email}
        </MonoText>
      </div>

    </div>
  );
}
