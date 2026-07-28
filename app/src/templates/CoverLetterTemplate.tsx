import type { CVData, CoverLetterData } from '../data/types';

interface Props {
  cvData: CVData;
  clData: CoverLetterData;
  fontScale?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const GOLD = '#8B7355';
const GOLD_LIGHT = 'rgba(139,115,85,0.18)';

function BodyParagraph({ text, scale = 1 }: { text: string; scale?: number }) {
  if (!text.trim()) return null;
  return (
    <p style={{
      fontFamily: "'Inter', sans-serif",
      fontSize: `${8 * scale}px`,
      color: '#3a3a3a',
      lineHeight: 1.75,
      margin: '0 0 10px 0',
    }}>
      {text}
    </p>
  );
}

// ── Template ───────────────────────────────────────────────────────────────

export default function CoverLetterTemplate({ cvData, clData, fontScale = 1 }: Props) {
  const { personal } = cvData;
  const f = (px: number) => `${px * fontScale}px`;

  // Build recipient block — only non-empty lines
  const recipientLines = [
    clData.company,
    clData.contactPerson,
    clData.companyAddress,
  ].filter(l => l.trim());

  const senderDate = [clData.city, clData.date].filter(l => l.trim()).join(', ');

  return (
    <div
      className="cv-page"
      style={{
        fontFamily: "'Inter', sans-serif",
        background: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* ── LETTERHEAD ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#faf8f4',
        borderBottom: `1.5px solid ${GOLD_LIGHT}`,
        padding: '14mm 16mm 12mm',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}>
        {/* Name + title */}
        <div>
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: f(26),
            fontWeight: 600,
            color: '#111111',
            lineHeight: 1.05,
            letterSpacing: '-0.5px',
            marginBottom: '4px',
          }}>
            {personal.name}
          </div>
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: f(7),
            fontWeight: 600,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            color: GOLD,
          }}>
            {personal.title}
          </div>
        </div>

        {/* Contact details — right-aligned */}
        <div style={{ textAlign: 'right' }}>
          {[
            personal.email,
            personal.phone,
            personal.location,
            personal.website,
          ].filter(Boolean).map((val, i) => (
            <div
              key={i}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: f(7),
                color: '#777',
                lineHeight: 1.7,
              }}
            >
              {val}
            </div>
          ))}
        </div>
      </div>

      {/* Thin gold accent line */}
      <div style={{
        height: '2px',
        background: `linear-gradient(to right, ${GOLD}, transparent)`,
        opacity: 0.35,
      }} />

      {/* ── LETTER BODY ────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        padding: '11mm 16mm 10mm',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Recipient + date row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10mm' }}>

          {/* Recipient */}
          <div>
            {recipientLines.length > 0 ? (
              recipientLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: f(7.8),
                    color: i === 0 ? '#1a1a1a' : '#555',
                    fontWeight: i === 0 ? 600 : 400,
                    lineHeight: 1.65,
                  }}
                >
                  {line}
                </div>
              ))
            ) : (
              <div style={{ fontSize: f(7.5), color: '#ccc', fontStyle: 'italic' }}>
                Empfänger noch nicht eingegeben
              </div>
            )}
          </div>

          {/* Date — right */}
          {senderDate && (
            <div style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: f(7.5),
              color: '#888',
              whiteSpace: 'nowrap',
              marginLeft: '16mm',
              paddingTop: '1px',
            }}>
              {senderDate}
            </div>
          )}
        </div>

        {/* Subject line */}
        {clData.subject && (
          <div style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: f(9),
            fontWeight: 700,
            color: '#111',
            marginBottom: '8mm',
            letterSpacing: '-0.1px',
          }}>
            {clData.subject}
          </div>
        )}

        {/* Salutation */}
        {clData.salutation && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: f(8),
            color: '#222',
            lineHeight: 1.65,
            margin: '0 0 8px 0',
          }}>
            {clData.salutation}
          </p>
        )}

        {/* Body paragraphs */}
        <BodyParagraph text={clData.intro} scale={fontScale} />
        <BodyParagraph text={clData.mainBody} scale={fontScale} />
        <BodyParagraph text={clData.companyReference} scale={fontScale} />
        <BodyParagraph text={clData.motivation} scale={fontScale} />
        <BodyParagraph text={clData.closing} scale={fontScale} />

        {/* Sign-off spacer */}
        <div style={{ marginTop: '8mm' }}>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: f(8),
            color: '#3a3a3a',
            lineHeight: 1.65,
            margin: '0 0 12mm 0',
          }}>
            {clData.signoff || 'Mit freundlichen Grüßen'}
          </p>

          {/* Signature placeholder area */}
          <div style={{
            borderBottom: '0.5px solid #e0d8cc',
            width: '52mm',
            marginBottom: '4px',
          }} />
          <div style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: f(9),
            color: '#1a1a1a',
            fontStyle: 'italic',
          }}>
            {personal.name}
          </div>
        </div>

        {/* Enclosures hint if content is sparse */}
        <div style={{ flex: 1 }} />
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: `0.5px solid ${GOLD_LIGHT}`,
        padding: '4mm 16mm',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#faf8f4',
      }}>
        <div style={{ fontSize: f(6), color: '#ccc', letterSpacing: '0.5px', fontFamily: "'Inter', sans-serif" }}>
          {personal.name} · Anschreiben
        </div>
        <div style={{ fontSize: f(6), color: '#ccc', fontFamily: "'Inter', sans-serif" }}>
          {personal.email}
        </div>
      </div>
    </div>
  );
}
