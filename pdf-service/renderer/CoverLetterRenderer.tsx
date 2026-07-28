import type { CVData, CoverLetterData } from './types';
import type { ResumeTheme, FontPairing } from './theme';

interface Props {
  cvData: CVData;
  clData: CoverLetterData;
  theme: ResumeTheme;
  pairing: FontPairing;
  density: number;
  pages?: number;
  measure?: boolean;
}

export default function CoverLetterRenderer({ cvData, clData, theme: T, pairing: P, density: d, pages = 1, measure }: Props) {
  const C = T.colors;
  const { personal } = cvData;
  const banded = T.layout === 'header-band';

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

  const recipient = [clData.company, clData.contactPerson, clData.companyAddress].filter(l => l.trim());
  const senderDate = [clData.city, clData.date].filter(Boolean).join(', ');
  const bodyParas = [clData.intro, clData.mainBody, clData.companyReference, clData.motivation, clData.closing].filter(p => p.trim());

  // ── Letterhead ────────────────────────────────────────────────────────────
  const letterhead = (
    <div style={{
      background: banded ? C.panelBg : C.pageBg,
      color: banded ? C.panelInk : C.ink,
      borderBottom: banded ? 'none' : `1px solid ${C.rule}`,
      padding: `${24 * d}px ${30 * d}px ${18 * d}px`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: `${20 * d}px`,
    }}>
      <div>
        <div style={{
          fontFamily: P.heading, fontSize: `${26 * d}px`, fontWeight: 700,
          color: banded ? C.panelInk : (T.accentName ? C.accent : C.ink),
          lineHeight: 1.05, letterSpacing: `${-0.4 * d}px`,
          textTransform: T.uppercaseName ? 'uppercase' : 'none',
        }}>{personal.name}</div>
        <div style={{
          fontFamily: P.body, fontSize: `${7.6 * d}px`, fontWeight: 600, letterSpacing: `${2.4 * d}px`,
          textTransform: 'uppercase', color: banded ? C.panelAccent : C.accent, marginTop: `${5 * d}px`,
        }}>{personal.title}</div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: `${1.5 * d}px` }}>
        {[personal.email, personal.phone, personal.location, personal.website].filter(Boolean).map((v, i) => (
          <div key={i} style={{ fontFamily: P.body, fontSize: `${8 * d}px`, color: banded ? C.panelInkSoft : C.inkSoft }}>{v}</div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="cv-page" style={pageStyle}>
      {letterhead}
      {!banded && <div style={{ height: `${2.5 * d}px`, background: `linear-gradient(to right, ${C.accent}, transparent)` }} />}

      <div style={{ flex: 1, padding: `${22 * d}px ${30 * d}px ${20 * d}px`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Recipient + date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: `${24 * d}px`, marginBottom: `${20 * d}px` }}>
          <div>
            {recipient.length ? recipient.map((line, i) => (
              <div key={i} style={{
                fontFamily: P.body, fontSize: `${9 * d}px`,
                color: i === 0 ? C.ink : C.inkMid, fontWeight: i === 0 ? 600 : 400, lineHeight: 1.6,
              }}>{line}</div>
            )) : (
              <div style={{ fontFamily: P.body, fontSize: `${9 * d}px`, color: C.inkSoft, fontStyle: 'italic' }}>Empfänger noch nicht eingegeben</div>
            )}
          </div>
          {senderDate && (
            <div style={{ fontFamily: P.body, fontSize: `${8.5 * d}px`, color: C.inkSoft, whiteSpace: 'nowrap' }}>{senderDate}</div>
          )}
        </div>

        {/* Subject */}
        {clData.subject && (
          <div style={{ fontFamily: P.heading, fontSize: `${11 * d}px`, fontWeight: 700, color: C.ink, marginBottom: `${14 * d}px` }}>
            {clData.subject}
          </div>
        )}

        {/* Salutation */}
        {clData.salutation && (
          <p style={{ fontFamily: P.body, fontSize: `${9 * d}px`, color: C.ink, lineHeight: 1.6, margin: `0 0 ${9 * d}px` }}>{clData.salutation}</p>
        )}

        {/* Body */}
        {bodyParas.map((p, i) => (
          <p key={i} style={{ fontFamily: P.body, fontSize: `${9 * d}px`, color: C.inkMid, lineHeight: 1.72, margin: `0 0 ${9 * d}px` }}>{p}</p>
        ))}

        {/* Sign-off */}
        <div style={{ marginTop: `${14 * d}px` }}>
          <p style={{ fontFamily: P.body, fontSize: `${9 * d}px`, color: C.inkMid, margin: `0 0 ${18 * d}px` }}>
            {clData.signoff || 'Mit freundlichen Grüßen'}
          </p>
          <div style={{ borderBottom: `0.6px solid ${C.rule}`, width: `${52 * d}px`, marginBottom: `${4 * d}px` }} />
          <div style={{ fontFamily: P.heading, fontSize: `${10 * d}px`, color: C.ink }}>{personal.name}</div>
        </div>

        <div style={{ flex: 1 }} />
      </div>

      <div style={{
        borderTop: `1px solid ${C.rule}`, padding: `${10 * d}px ${30 * d}px`,
        display: 'flex', justifyContent: 'space-between', background: banded ? C.panelBg : C.pageBg,
      }}>
        <div style={{ fontFamily: P.body, fontSize: `${7 * d}px`, color: C.inkSoft }}>{personal.name} · Anschreiben</div>
        <div style={{ fontFamily: P.body, fontSize: `${7 * d}px`, color: C.inkSoft }}>{personal.email}</div>
      </div>
    </div>
  );
}
