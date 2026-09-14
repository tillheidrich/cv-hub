import { useEffect, useMemo, useState } from 'react';
import ResumeRenderer from '../templates/ResumeRenderer';
import CoverLetterRenderer from '../templates/CoverLetterRenderer';
import DocumentPreview from '../preview/DocumentPreview';
import { contentKeyOf } from '../preview/contentKey';
import type { Metrics } from '../templates/metrics';
import { getTheme, resolvePairing } from '../templates/theme';
import { api } from '../data/api';
import { withAllLangs } from '../data/storage';
import type { AppProfile, FontPairingId, PageMode, PageFormat } from '../data/types';

const UI = "'Inter', sans-serif";
const SERIF = "'Playfair Display', serif";

/** Public read-only view of a shared résumé, served at /share/<token>. */
export default function ShareView({ token }: { token: string }) {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<'resume' | 'cover-letter'>('resume');

  useEffect(() => {
    api.fetchShare(token)
      .then(d => setProfile(withAllLangs(d.resume)))
      .catch(e => setError(e instanceof Error ? e.message : 'Link nicht verfügbar.'));
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

  if (error) {
    // Differentiated copy depending on what kind of failure we got from the
    // backend. The api layer surfaces the raw message; we pick the headline.
    const lower = error.toLowerCase();
    const headline = lower.includes('widerrufen') ? 'Link wurde widerrufen'
      : lower.includes('abgelaufen') ? 'Link ist abgelaufen'
      : lower.includes('nicht gefunden') ? 'Link existiert nicht'
      : 'Nicht verfügbar';
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ede8', padding: '24px' }}>
        <div style={{ background: '#fff', padding: '36px 40px', borderRadius: '14px', boxShadow: '0 12px 36px rgba(0,0,0,0.12)', maxWidth: '420px', textAlign: 'center', fontFamily: UI }}>
          <div style={{ fontFamily: SERIF, fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#1a1a1a' }}>{headline}</div>
          <div style={{ fontSize: '13px', color: '#6b6356', lineHeight: 1.6, marginBottom: '20px' }}>{error}</div>
          <a
            href="/"
            style={{
              display: 'inline-block', padding: '10px 18px', background: '#1a1a1a',
              color: '#fff', textDecoration: 'none', borderRadius: '6px',
              fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', fontFamily: UI,
            }}
          >
            Selbst einen Lebenslauf bauen →
          </a>
        </div>
      </div>
    );
  }
  if (!profile) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0ede8', fontFamily: UI, color: '#9a9183', fontSize: '13px' }}>Lade…</div>;
  }

  const cvData = profile.data[lang];
  const clData = profile.coverLetters?.[lang];
  const hasCoverLetter = clData && (clData.intro || clData.mainBody || clData.subject);
  const name = cvData?.personal?.name || 'Lebenslauf';

  const render = (metrics: Metrics, pageBlocks: string[][] | undefined, measure: boolean, asideCap: number) =>
    doc === 'cover-letter' && clData
      ? <CoverLetterRenderer cvData={cvData} clData={clData} theme={theme} pairing={pairing} metrics={metrics} measure={measure} pageFormat={pageFormat} />
      : <ResumeRenderer data={cvData} theme={theme} pairing={pairing} metrics={metrics} pageBlocks={pageBlocks} measure={measure} pageFormat={pageFormat} asideSkillCap={asideCap} />;

  return (
    <div style={{ minHeight: '100vh', background: '#eceae5', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e8e4de', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: '17px', fontWeight: 700, color: '#1a1a1a' }}>{name}</div>
        <div style={{ fontSize: '11px', color: '#9a9183', fontFamily: UI }}>geteilte Vorschau</div>
        {hasCoverLetter && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', background: '#f5f2ee', borderRadius: '7px', padding: '3px' }}>
            {(['resume', 'cover-letter'] as const).map(dt => (
              <button key={dt} type="button" onClick={() => setDoc(dt)}
                style={{ padding: '5px 12px', background: doc === dt ? '#fff' : 'transparent', color: doc === dt ? '#1a1a1a' : '#888', border: 'none', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: UI, boxShadow: doc === dt ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                {dt === 'resume' ? 'Lebenslauf' : 'Anschreiben'}
              </button>
            ))}
          </div>
        )}
      </header>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '32px' }}>
        <DocumentPreview render={render} userScale={userScale} pageMode={pageMode} pageFormat={pageFormat} viewportScale={1}
          contentKey={contentKeyOf(doc === 'cover-letter' ? clData : cvData, doc, theme.id, pairing.id)} />
      </div>
    </div>
  );
}
