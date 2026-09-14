import type { CVData, CoverLetterData, PageFormat } from '../data/types';
import { getPageFormat } from '../data/pageFormats';
import type { ResumeTheme, FontPairing } from './theme';
import { TRACK_CAPS, TRACK_NAME, type Metrics } from './metrics';
import { Ed, InlineEditCtx, type InlineEditApi } from './InlineEdit';

interface Props {
  cvData: CVData;
  clData: CoverLetterData;
  theme: ResumeTheme;
  pairing: FontPairing;
  /** Vier getrennte Skalen — siehe templates/metrics.ts */
  metrics: Metrics;
  measure?: boolean;
  pageFormat?: PageFormat;
  /** Direktes Schreiben in der Vorschau — siehe templates/InlineEdit.tsx.
   *  Beim Anschreiben ist das die naheliegendste Form der Bearbeitung: es
   *  besteht fast nur aus Fließtext. */
  inlineEdit?: InlineEditApi;
}

export default function CoverLetterRenderer({ cvData, clData, theme: T, pairing: P, metrics: M, measure, pageFormat = 'a4', inlineEdit }: Props) {
  // Das Anschreiben ist per Konvention einseitig — hier zählt nur die
  // Schriftskala. Weißraum wird über dieselbe Achse mitskaliert.
  const d = M.t * 0.94 + M.s * 0.06;
  const C = T.colors;
  const { personal } = cvData;
  const banded = T.layout === 'header-band';
  const fmt = getPageFormat(pageFormat);

  const pageStyle: React.CSSProperties = {
    width: `${fmt.widthMm}mm`,
    minHeight: measure ? undefined : `${fmt.heightMm}mm`,
    height: measure ? undefined : `${fmt.heightMm}mm`,
    background: C.pageBg,
    fontFamily: P.body,
    color: C.ink,
    display: 'flex',
    flexDirection: 'column',
    overflow: measure ? 'visible' : 'hidden',
    overflowWrap: 'break-word',
    wordBreak: 'normal',
    // Siehe ResumeRenderer: Silbentrennung erzeugt im extrahierten PDF-Text
    // harte Bindestriche und zerlegt kurze Wörter in schmalen Spalten.
    hyphens: 'none',
    WebkitHyphens: 'none',
  };

  // Feldnamen mitführen, damit die Zeilen in der Vorschau beschreibbar sind —
  // Firma, Ansprechpartner und Anschrift ändern sich bei jeder Bewerbung.
  const recipientAll: [string, string][] = [
    ['company', clData.company], ['contactPerson', clData.contactPerson], ['companyAddress', clData.companyAddress],
  ];
  // Beim direkten Bearbeiten bleiben auch leere Empfängerzeilen stehen: sonst
  // gäbe es nichts, wo man hineinklicken könnte, und ausgerechnet diese drei
  // Zeilen ändern sich bei jeder Bewerbung.
  const recipient = inlineEdit ? recipientAll : recipientAll.filter(([, v]) => v.trim());
  const senderDate = [clData.city, clData.date].filter(Boolean).join(', ');
  void senderDate;
  // Feldnamen mitführen: die gefilterte Liste allein ließe sich nicht mehr auf
  // das Feld zurückrechnen, in das eine Änderung gehört.
  const bodyParas = ([
    ['intro', clData.intro], ['mainBody', clData.mainBody], ['companyReference', clData.companyReference],
    ['motivation', clData.motivation], ['closing', clData.closing],
  ] as [string, string][]).filter(([, v]) => v.trim());

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
          fontFamily: P.heading, fontSize: `${28 * d}px`, fontWeight: 700,
          color: banded ? C.panelInk : (T.accentName ? C.accent : C.ink),
          lineHeight: 1.05, letterSpacing: TRACK_NAME,
          textTransform: T.uppercaseName ? 'uppercase' : 'none',
        }}>{personal.name}</div>
        <div style={{
          fontFamily: P.body, fontSize: `${11 * d}px`, fontWeight: 600, letterSpacing: TRACK_CAPS,
          textTransform: 'uppercase', color: banded ? C.panelAccent : C.accent, marginTop: `${5 * d}px`,
        }}>{personal.title}</div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: `${1.5 * d}px` }}>
        {[personal.email, personal.phone, personal.location, personal.website].filter(Boolean).map((v, i) => (
          <div key={i} style={{ fontFamily: P.body, fontSize: `${10.9 * d}px`, color: banded ? C.panelInkSoft : C.inkSoft }}>{v}</div>
        ))}
      </div>
    </div>
  );

  const page = (
    <div className="cv-page" data-cv-measure-page={measure ? "0" : undefined} style={pageStyle}>
      {letterhead}
      {!banded && <div style={{ height: `${2.5 * d}px`, background: `linear-gradient(to right, ${C.accent}, transparent)` }} />}

      <div style={{ flex: 1, padding: `${22 * d}px ${30 * d}px ${20 * d}px`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Recipient + date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: `${24 * d}px`, marginBottom: `${20 * d}px` }}>
          <div>
            {recipient.some(([, v]) => v.trim()) || inlineEdit ? recipient.map(([k, line], i) => (
              <div key={k} style={{
                fontFamily: P.body, fontSize: `${12.6 * d}px`,
                color: i === 0 ? C.ink : C.inkMid, fontWeight: i === 0 ? 600 : 400, lineHeight: 1.6,
              }}><Ed path={`cl.${k}`}>{line}</Ed></div>
            )) : (
              <div style={{ fontFamily: P.body, fontSize: `${12.6 * d}px`, color: C.inkSoft, fontStyle: 'italic' }}>Empfänger noch nicht eingegeben</div>
            )}
          </div>
          {(clData.city || clData.date) && (
            <div style={{ fontFamily: P.body, fontSize: `${10.9 * d}px`, color: C.inkSoft, whiteSpace: 'nowrap' }}>
              {clData.city && <Ed path="cl.city">{clData.city}</Ed>}
              {clData.city && clData.date ? ', ' : ''}
              {clData.date && <Ed path="cl.date">{clData.date}</Ed>}
            </div>
          )}
        </div>

        {/* Subject */}
        {clData.subject && (
          <div style={{ fontFamily: P.heading, fontSize: `${14.4 * d}px`, fontWeight: 700, color: C.ink, marginBottom: `${14 * d}px` }}>
            <Ed path="cl.subject">{clData.subject}</Ed>
          </div>
        )}

        {/* Salutation */}
        {clData.salutation && (
          <p style={{ fontFamily: P.body, fontSize: `${12.6 * d}px`, color: C.ink, lineHeight: 1.6, margin: `0 0 ${9 * d}px` }}><Ed path="cl.salutation">{clData.salutation}</Ed></p>
        )}

        {/* Body */}
        {bodyParas.map(([k, v]) => (
          <p key={k} style={{ fontFamily: P.body, fontSize: `${12.6 * d}px`, color: C.inkMid, lineHeight: 1.55, margin: `0 0 ${9 * d}px` }}>
            <Ed path={`cl.${k}`}>{v}</Ed>
          </p>
        ))}

        {/* Sign-off */}
        <div style={{ marginTop: `${14 * d}px` }}>
          <p style={{ fontFamily: P.body, fontSize: `${12.6 * d}px`, color: C.inkMid, margin: `0 0 ${18 * d}px` }}>
            <Ed path="cl.signoff">{clData.signoff || 'Mit freundlichen Grüßen'}</Ed>
          </p>
          <div style={{ borderBottom: `0.6px solid ${C.rule}`, width: `${52 * d}px`, marginBottom: `${4 * d}px` }} />
          <div style={{ fontFamily: P.heading, fontSize: `${13 * d}px`, color: C.ink }}>{personal.name}</div>
        </div>

        <div style={{ flex: 1 }} />
      </div>

      <div style={{
        borderTop: `1px solid ${C.rule}`, padding: `${10 * d}px ${30 * d}px`,
        display: 'flex', justifyContent: 'space-between', background: banded ? C.panelBg : C.pageBg,
      }}>
        <div style={{ fontFamily: P.body, fontSize: `${9.2 * d}px`, color: C.inkSoft }}>{personal.name} · Anschreiben</div>
        <div style={{ fontFamily: P.body, fontSize: `${9.2 * d}px`, color: C.inkSoft }}>{personal.email}</div>
      </div>
    </div>
  );

  // Ohne Bearbeitungskontext bleibt jeder Text ein gewöhnlicher Textknoten —
  // Export und Messlauf sehen dieselbe Ausgabe wie vorher.
  return inlineEdit ? <InlineEditCtx.Provider value={inlineEdit}>{page}</InlineEditCtx.Provider> : page;
}
