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

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionHeading({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <h2 style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: `${7.5 * scale}px`,
        fontWeight: 700,
        letterSpacing: '3px',
        textTransform: 'uppercase',
        color: '#7a6248',
        margin: 0,
        marginBottom: '7px',
      }}>
        {children}
      </h2>
      <div style={{
        height: '0.5px',
        background: 'linear-gradient(to right, rgba(139,115,85,0.8), rgba(212,196,168,0.3))',
        width: '100%',
      }} />
    </div>
  );
}

// No icons – ATS/AI-scanner and screen-reader friendly
function ContactItem({ label, value, href, scale = 1 }: { label: string; value: string; href?: string; scale?: number }) {
  const inner = (
    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: `${7.5 * scale}px`, color: '#4a4a4a', lineHeight: 1.6 }}>
      <span style={{ fontWeight: 600, color: '#6b5b45', marginRight: '4px' }}>{label}</span>
      {value}
    </span>
  );
  if (href) {
    return (
      <div style={{ marginBottom: '2px' }}>
        <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{inner}</a>
      </div>
    );
  }
  return <div style={{ marginBottom: '2px' }}>{inner}</div>;
}

function DetailRow({ label, value, scale = 1 }: { label: string; value: string; scale?: number }) {
  return (
    <div style={{ marginTop: '4px' }}>
      <div style={{ fontSize: `${6.5 * scale}px`, fontWeight: 600, color: '#8B7355', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '1px' }}>
        {label}
      </div>
      <div style={{ fontSize: `${7.5 * scale}px`, color: '#4a4a4a' }}>{value}</div>
    </div>
  );
}

// ── Main Template ──────────────────────────────────────────────────────────

export default function ExecutiveClean({ data, fontScale = 1 }: Props) {
  const { personal, profile, experience, education, skillGroups, languages, additionalExperience, labels } = data;
  const { sections, fields, misc } = labels;
  const f = (px: number) => `${px * fontScale}px`;

  return (
    <div className="cv-page" style={{ fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', background: '#ffffff' }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid rgba(139,115,85,0.18)', minHeight: '62mm' }}>

        {/* Photo */}
        <div style={{ width: '54mm', flexShrink: 0, overflow: 'hidden', background: '#f5f0e8', position: 'relative' }}>
          {personal.photo ? (
            <img
              src={personal.photo}
              alt={personal.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const placeholder = img.nextElementSibling as HTMLElement | null;
                if (placeholder) placeholder.style.display = 'flex';
              }}
            />
          ) : null}
          <div style={{
            width: '100%', height: '100%',
            display: personal.photo ? 'none' : 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#c4b49a', fontSize: f(11), fontStyle: 'italic',
            flexDirection: 'column', gap: '6px',
          }}>
            <span style={{ fontSize: '28px', opacity: 0.4 }}>👤</span>
            <span>Foto hinzufügen</span>
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', background: '#8B7355' }} />
        </div>

        {/* Name + Profile */}
        <div style={{ flex: 1, padding: '18mm 16mm 14mm 12mm', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: f(34), fontWeight: 600, color: '#111111',
            lineHeight: 1.08, letterSpacing: '-0.8px', marginBottom: '5px',
          }}>
            {personal.name}
          </div>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: f(8), fontWeight: 600,
            letterSpacing: '3px', textTransform: 'uppercase', color: '#8B7355', marginBottom: '12px',
          }}>
            {personal.title}
          </div>
          <div style={{ height: '1px', background: 'linear-gradient(to right, #8B7355, transparent)', marginBottom: '12px', width: '48px' }} />
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: f(7.8), color: '#505050', lineHeight: 1.7, margin: 0, maxWidth: '120mm' }}>
            {profile.text}
          </p>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
        <div style={{
          width: '60mm', flexShrink: 0, background: '#faf8f4',
          borderRight: '1px solid rgba(139,115,85,0.15)', padding: '10mm 8mm',
          display: 'flex', flexDirection: 'column', gap: '9mm',
        }}>

          {/* Contact */}
          <section>
            <SectionHeading scale={fontScale}>{sections.personal}</SectionHeading>
            <div style={{ marginTop: '6px' }}>
              <ContactItem scale={fontScale} label={fields.email}   value={personal.email}    href={`mailto:${personal.email}`} />
              <ContactItem scale={fontScale} label={fields.phone}   value={personal.phone} />
              <ContactItem scale={fontScale} label={fields.address} value={personal.location} />
              {personal.website  && <ContactItem scale={fontScale} label={fields.web}      value={personal.website}  href={`https://${personal.website}`} />}
              {personal.linkedin && <ContactItem scale={fontScale} label={fields.linkedin}  value={personal.linkedin} href={`https://${personal.linkedin}`} />}
            </div>
          </section>

          {/* Personal Details */}
          <section>
            <SectionHeading scale={fontScale}>{sections.details}</SectionHeading>
            <div style={{ marginTop: '6px' }}>
              {personal.birthDate      && <DetailRow scale={fontScale} label={fields.birthDate}      value={personal.birthDate} />}
              {personal.birthPlace     && <DetailRow scale={fontScale} label={fields.birthPlace}     value={personal.birthPlace} />}
              {personal.maritalStatus  && <DetailRow scale={fontScale} label={fields.maritalStatus}  value={personal.maritalStatus} />}
              {personal.nationality    && <DetailRow scale={fontScale} label={fields.nationality}    value={personal.nationality} />}
              {personal.driversLicense && <DetailRow scale={fontScale} label={fields.driversLicense} value={personal.driversLicense} />}
            </div>
          </section>

          {/* Languages */}
          <section>
            <SectionHeading scale={fontScale}>{sections.languages}</SectionHeading>
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {languages.map((lang) => (
                <div key={lang.language}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: f(7.5), fontWeight: 600, color: '#2a2a2a' }}>{lang.language}</span>
                    <DotsInline value={languageDots(lang)} max={5} size={f(4.5)} on="#2a2a2a" off="#d4d0c8" />
                  </div>
                  <div style={{ fontSize: f(7), color: '#777', marginTop: '1px' }}>{lang.level}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Skill Groups */}
          {skillGroups.map((group) => (
            <section key={group.label}>
              <SectionHeading scale={fontScale}>{group.label}</SectionHeading>
              <ul style={{ margin: '6px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {group.items.map((item) => (
                  <li key={item} style={{ fontSize: f(7.5), color: '#4a4a4a', lineHeight: 1.4, paddingLeft: '8px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: '4px', width: '3px', height: '3px', borderRadius: '50%', background: '#8B7355' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {/* Additional */}
          {additionalExperience && additionalExperience.length > 0 && (
            <section>
              <SectionHeading scale={fontScale}>{sections.additional}</SectionHeading>
              <ul style={{ margin: '6px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {additionalExperience.map((item) => (
                  <li key={item} style={{ fontSize: f(7), color: '#555', lineHeight: 1.4, paddingLeft: '8px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: '4px', width: '3px', height: '3px', borderRadius: '50%', background: '#c4b49a' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── RIGHT MAIN ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, padding: '10mm 12mm 10mm 10mm', display: 'flex', flexDirection: 'column', gap: '9mm', borderLeft: '2px solid rgba(139,115,85,0.12)' }}>

          {/* Experience */}
          <section>
            <SectionHeading scale={fontScale}>{sections.experience}</SectionHeading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8mm', marginTop: '7px' }}>
              {experience.filter(e => !e.hidden).map((entry) => (
                <article key={entry.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: f(9.5), fontWeight: 600, color: '#111111', lineHeight: 1.3, letterSpacing: '-0.1px' }}>
                        {entry.role}
                      </div>
                      <div style={{ fontSize: f(7.5), color: '#8B7355', fontWeight: 500, marginTop: '2px', letterSpacing: '0.1px' }}>
                        {entry.company} · {entry.location}
                      </div>
                    </div>
                    <div style={{ fontSize: f(7), color: '#888', whiteSpace: 'nowrap', marginLeft: '8px', paddingTop: '1px' }}>
                      {entry.start} – {entry.end === 'present' || entry.end === 'heute' ? misc.present : entry.end}
                    </div>
                  </div>
                  <ul style={{ margin: '4px 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {entry.bullets.map((bullet, i) => (
                      <li key={i} style={{ fontSize: f(7.5), color: '#444', lineHeight: 1.5, paddingLeft: '10px', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, top: '5px', width: '5px', height: '1px', background: 'rgba(139,115,85,0.7)' }} />
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
            <SectionHeading scale={fontScale}>{sections.education}</SectionHeading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5mm', marginTop: '7px' }}>
              {education.map((entry) => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: f(8.5), fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>
                      {entry.degree}
                    </div>
                    <div style={{ fontSize: f(7.5), color: '#8B7355', marginTop: '1px' }}>{entry.institution}</div>
                    {entry.notes && <div style={{ fontSize: f(7), color: '#888', marginTop: '2px' }}>{entry.notes}</div>}
                  </div>
                  <div style={{ fontSize: f(7), color: '#888', whiteSpace: 'nowrap', marginLeft: '8px', paddingTop: '1px' }}>
                    {entry.start} – {entry.end}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '0.5px solid rgba(139,115,85,0.2)', padding: '4mm 16mm', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#faf8f4' }}>
        <div style={{ fontSize: f(6.5), color: '#aaa', letterSpacing: '0.5px' }}>
          {personal.name} · {misc.cvLabel}
        </div>
        <div style={{ fontSize: f(6.5), color: '#aaa' }}>
          {personal.email} · {personal.phone}
        </div>
      </div>

    </div>
  );
}
