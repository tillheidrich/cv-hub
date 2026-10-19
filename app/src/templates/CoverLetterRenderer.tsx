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
  /* Satz des Briefs (19.10.2026, Rückmeldung „alles untereinander
   * weggeklatscht"): Bis dahin standen 9,5 pt Text mit 8 mm Rand oben auf der
   * Seite, die untere Hälfte blieb leer, lange Briefe wurden unten
   * abgeschnitten. Jetzt Ränder nach DIN 5008 (links 25 mm, rechts 20 mm),
   * 11 pt Text, ein festes Anschriftfeld und Platz für die Unterschrift.
   * Die Einpassung (preview/DocumentPreview.tsx) macht kurze Briefe luftiger
   * (Weißraum und Zeilenabstand, nie größere Schrift) und lange enger.
   *   t = Schrift, s = Weißraum, l = Zeilenabstand, m = Seitenränder */
  const d = M.t;
  const sp = M.s;
  const lh = M.l;
  const mg = M.m;
  const BODY = 14.6; // px bei t = 1 ≈ 11 pt
  const padX = `${20 * mg}mm`;
  const padL = `${25 * mg}mm`;
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
      padding: `${12 * sp}mm ${padX} ${6 * sp}mm ${padL}`,
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

      <div style={{ flex: 1, padding: `${9 * sp}mm ${padX} ${6 * sp}mm ${padL}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Anschrift und Datum. Das Anschriftfeld hat eine feste Höhe wie im
            Fensterbriefumschlag: der Betreff steht immer an derselben Stelle,
            auch wenn die Anschrift fehlt. Im PDF steht dann einfach nichts —
            früher druckte es „Empfänger noch nicht eingegeben". */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: `${24 * d}px`, minHeight: '30mm', marginBottom: `${7 * sp}mm` }}>
          <div>
            {recipient.map(([k, line], i) => (
              <div key={k} style={{
                fontFamily: P.body, fontSize: `${BODY * d}px`,
                color: i === 0 ? C.ink : C.inkMid, fontWeight: i === 0 ? 600 : 400, lineHeight: 1.5,
                whiteSpace: 'pre-line',
              }}><Ed path={`cl.${k}`}>{line}</Ed></div>
            ))}
          </div>
          {clData.showDateline !== false && (clData.city || clData.date) && (
            <div style={{ fontFamily: P.body, fontSize: `${13 * d}px`, color: C.inkSoft, whiteSpace: 'nowrap' }}>
              {clData.city && <Ed path="cl.city">{clData.city}</Ed>}
              {clData.city && clData.date ? ', ' : ''}
              {clData.date && <Ed path="cl.date">{clData.date}</Ed>}
            </div>
          )}
        </div>

        {/* Subject */}
        {clData.subject && (
          <div style={{ fontFamily: P.heading, fontSize: `${BODY * 1.08 * d}px`, fontWeight: 700, color: C.ink, lineHeight: 1.35, marginBottom: `${7 * sp}mm` }}>
            <Ed path="cl.subject">{clData.subject}</Ed>
          </div>
        )}

        {/* Salutation */}
        {clData.salutation && (
          <p style={{ fontFamily: P.body, fontSize: `${BODY * d}px`, color: C.ink, lineHeight: 1.5 * lh, margin: `0 0 ${0.8 * sp}em` }}><Ed path="cl.salutation">{clData.salutation}</Ed></p>
        )}

        {/* Body */}
        {bodyParas.map(([k, v]) => (
          /* pre-line wie im beschreibbaren Feld: Leerzeilen, die jemand in ein
             Feld tippt, stehen sonst nur in der Vorschau, im PDF fließt alles
             zu einem Block zusammen — und die Einpassung misst zu kurz. */
          <p key={k} style={{ fontFamily: P.body, fontSize: `${BODY * d}px`, color: C.inkMid, lineHeight: 1.5 * lh, margin: `0 0 ${0.75 * sp}em`, whiteSpace: 'pre-line' }}>
            <Ed path={`cl.${k}`}>{v}</Ed>
          </p>
        ))}

        {/* Sign-off */}
        <div style={{ marginTop: `${3 * sp}mm` }}>
          {/* Darunter Platz für die Unterschrift (etwa drei Leerzeilen). */}
          <p style={{ fontFamily: P.body, fontSize: `${BODY * d}px`, color: C.inkMid, margin: `0 0 ${11 * sp}mm` }}>
            <Ed path="cl.signoff">{clData.signoff || 'Mit freundlichen Grüßen'}</Ed>
          </p>
          {clData.showSignature !== false && (
            <>
              <div style={{ borderBottom: `0.6px solid ${C.rule}`, width: `${52 * d}px`, marginBottom: `${4 * d}px` }} />
              <div style={{ fontFamily: P.heading, fontSize: `${BODY * d}px`, color: C.ink }}>{personal.name}</div>
            </>
          )}
        </div>

        <div style={{ flex: 1 }} />
      </div>

      <div style={{
        borderTop: `1px solid ${C.rule}`, padding: `${3.5 * sp}mm ${padX} ${3.5 * sp}mm ${padL}`,
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
