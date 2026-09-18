import { useEffect, useMemo, useRef, useState } from 'react';
import ResumeRenderer from '../templates/ResumeRenderer';
import CoverLetterRenderer from '../templates/CoverLetterRenderer';
import DocumentPreview from '../preview/DocumentPreview';
import { contentKeyOf } from '../preview/contentKey';
import type { Metrics } from '../templates/metrics';
import { getTheme, resolvePairing } from '../templates/theme';
import { api, ApiError } from '../data/api';
import { SHARE } from '../ui/editorI18n';
import { detectInitialUiLang, type UiLang } from '../ui/i18n';
import { withAllLangs } from '../data/storage';
import { getPageFormat } from '../data/pageFormats';
import type { AppProfile, FontPairingId, PageMode, PageFormat } from '../data/types';

const UI = "'Inter', sans-serif";
const SERIF = "'Playfair Display', serif";

/** Public read-only view of a shared résumé, served at /share/<token>. */
export default function ShareView({ token }: { token: string }) {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  /* Grund statt Meldung: Welcher Fall vorliegt, sagt der Statuscode
     (404/403/410) — nicht der Wortlaut eines deutschen Satzes. */
  const [fehler, setFehler] = useState<'revoked' | 'expired' | 'missing' | 'unknown' | null>(null);
  const [doc, setDoc] = useState<'resume' | 'cover-letter'>('resume');
  /* Auf dem Telefon lag das Dokument bisher in voller A4-Breite in einem
   * 390-px-Fenster: rechts abgeschnitten, Adresse und Profiltext halb weg.
   * Die App skaliert ihre Vorschau längst auf die Fensterbreite — der
   * geteilte Link tat es nicht, weil hier `viewportScale={1}` fest verdrahtet
   * stand. Wer einen Link verschickt, weiß nicht, worauf der Empfänger ihn
   * öffnet; Telefon ist der Normalfall, nicht die Ausnahme.
   *
   * `transform: scale()` verkleinert die Darstellung, nicht die Layout-Maße —
   * der Kasten bliebe so hoch wie das unskalierte Dokument und hinterließe
   * unten hunderte Pixel Leerraum. Deshalb bekommt der äußere Kasten die
   * gemessene Höhe mal Maßstab. */
  const bereichRef = useRef<HTMLDivElement>(null);
  const dokRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [hoehe, setHoehe] = useState<number | undefined>(undefined);

  useEffect(() => {
    api.fetchShare(token)
      .then(d => setProfile(withAllLangs(d.resume)))
      .catch(e => setFehler(
        e instanceof ApiError
          ? (e.status === 403 ? 'revoked' : e.status === 410 ? 'expired' : e.status === 404 ? 'missing' : 'unknown')
          : 'unknown',
      ));
  }, [token]);

  const lang = profile?.settings?.lang ?? 'de';
  const theme = useMemo(
    () => getTheme(profile?.settings?.template || 'hamburg', profile?.settings?.accent ?? 'auto', profile?.settings?.paper ?? 'auto'),
    [profile],
  );
  const pairing = useMemo(() => resolvePairing(theme, (profile?.settings?.fontPairing as FontPairingId) || 'auto'), [theme, profile]);
  const userScale = profile?.settings?.fontScale ?? 1.0;
  const pageMode: PageMode = profile?.settings?.pageMode ?? 'one';
  const pageFormat: PageFormat = (profile?.settings?.pageFormat as PageFormat) ?? 'a4';

  const seitenBreitePx = (getPageFormat((profile?.settings?.pageFormat as PageFormat) ?? 'a4').widthMm / 25.4) * 96;
  useEffect(() => {
    const bereich = bereichRef.current;
    if (!bereich) return;
    let letzte = { s: -1, h: -1 };
    const messen = () => {
      const platz = bereich.clientWidth - 24;
      if (platz <= 0) return;
      const s = Math.min(1, platz / seitenBreitePx);
      /* Die Höhe kommt aus dem Umriss des skalierten Kastens selbst:
       * `getBoundingClientRect()` liefert bei einer Transformation die
       * SICHTBARE Größe, nicht die Layout-Größe. Damit rechnet niemand den
       * Maßstab zweimal ein — und der Wert stimmt auch bei zwei Seiten samt
       * Abstand dazwischen. */
      const kasten = dokRef.current?.querySelector('.cv-scale-wrapper') as HTMLElement | null;
      const sichtbar = kasten?.getBoundingClientRect().height ?? 0;
      const h = s < 1 && sichtbar > 0 ? Math.ceil(sichtbar) : -1;
      if (Math.abs(s - letzte.s) < 0.002 && Math.abs(h - letzte.h) < 2) return;
      letzte = { s, h };
      setScale(s);
      setHoehe(h > 0 ? h : undefined);
    };
    messen();
    const ro = new ResizeObserver(messen);
    ro.observe(bereich);
    if (dokRef.current) ro.observe(dokRef.current);
    const t = window.setTimeout(messen, 400);   // nach dem Schriftladen nachmessen
    return () => { window.clearTimeout(t); ro.disconnect(); };
  }, [seitenBreitePx, doc, profile]);

  if (fehler) {
    /* Die Fehlerseite hat kein Dokument, dessen Sprache sie übernehmen könnte
       — sie folgt deshalb dem Browser des Empfängers. */
    const ts = SHARE[detectInitialUiLang()];
    const { headline, body } =
      fehler === 'revoked' ? { headline: ts.revokedTitle, body: ts.revokedBody }
      : fehler === 'expired' ? { headline: ts.expiredTitle, body: ts.expiredBody }
      : fehler === 'missing' ? { headline: ts.missingTitle, body: ts.missingBody }
      : { headline: ts.unavailableTitle, body: ts.unavailableBody };
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ede8', padding: '24px' }}>
        <div style={{ background: '#fff', padding: '36px 40px', borderRadius: '14px', boxShadow: '0 12px 36px rgba(0,0,0,0.12)', maxWidth: '420px', textAlign: 'center', fontFamily: UI }}>
          <div style={{ fontFamily: SERIF, fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#1a1a1a' }}>{headline}</div>
          <div style={{ fontSize: '13px', color: '#6b6356', lineHeight: 1.6, marginBottom: '20px' }}>{body}</div>
          <a
            href="/"
            style={{
              display: 'inline-block', padding: '10px 18px', background: '#1a1a1a',
              color: '#fff', textDecoration: 'none', borderRadius: '6px',
              fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', fontFamily: UI,
            }}
          >
            {ts.buildYourOwn}
          </a>
        </div>
      </div>
    );
  }
  if (!profile) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ede8', fontFamily: UI, color: '#9a9183', fontSize: '13px' }}>{SHARE[detectInitialUiLang()].loading}</div>;
  }

  const cvData = profile.data[lang];
  const clData = profile.coverLetters?.[lang];
  const hasCoverLetter = clData && (clData.intro || clData.mainBody || clData.subject);
  /* Ab hier liegt ein Dokument vor — der Rahmen spricht dessen Sprache. */
  const t = SHARE[(lang as UiLang)] ?? SHARE.de;
  const name = cvData?.personal?.name || t.fallbackName;

  const render = (metrics: Metrics, pageBlocks: string[][] | undefined, measure: boolean, asideCap: number) =>
    doc === 'cover-letter' && clData
      ? <CoverLetterRenderer cvData={cvData} clData={clData} theme={theme} pairing={pairing} metrics={metrics} measure={measure} pageFormat={pageFormat} />
      : <ResumeRenderer data={cvData} theme={theme} pairing={pairing} metrics={metrics} pageBlocks={pageBlocks} measure={measure} pageFormat={pageFormat} asideSkillCap={asideCap} />;

  return (
    <div style={{ minHeight: '100vh', background: '#eceae5', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e8e4de', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: SERIF, fontSize: '17px', fontWeight: 700, color: '#1a1a1a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: '11px', color: '#9a9183', fontFamily: UI, whiteSpace: 'nowrap' }}>{t.sharedPreview}</div>
        {hasCoverLetter && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', background: '#f5f2ee', borderRadius: '7px', padding: '3px' }}>
            {(['resume', 'cover-letter'] as const).map(dt => (
              <button key={dt} type="button" onClick={() => setDoc(dt)}
                style={{ padding: '5px 12px', background: doc === dt ? '#fff' : 'transparent', color: doc === dt ? '#1a1a1a' : '#888', border: 'none', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: UI, boxShadow: doc === dt ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {dt === 'resume' ? t.resume : t.coverLetter}
              </button>
            ))}
          </div>
        )}
      </header>
      <div ref={bereichRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', justifyContent: 'center', padding: scale < 1 ? '12px 12px 28px' : '32px' }}>
        {/* `alignItems: flex-start` ist keine Kosmetik: als Flex-Kind würde der
            skalierte Kasten sonst auf die Höhe dieses Kastens gedehnt — und
            weil genau diese Höhe aus seinem Umriss berechnet wird, schaukelt
            sich das in einem Durchgang auf null herunter. */}
        <div ref={dokRef} style={{ height: hoehe, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: scale < 1 ? 'hidden' : undefined }}>
          <DocumentPreview render={render} userScale={userScale} pageMode={pageMode} pageFormat={pageFormat} viewportScale={scale}
            contentKey={contentKeyOf(doc === 'cover-letter' ? clData : cvData, doc, theme.id, pairing.id)} />
        </div>
      </div>
    </div>
  );
}
