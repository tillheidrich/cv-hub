import { useState } from 'react';
import { adminFetch, type Usage as UsageData } from '../api';
import { HBars } from '../charts';
import { ErrorNote, PageHead, RangePicker, Section, Skeleton, Stat } from '../ui';
import { fmtDate, fmtInt } from '../format';
import { useLoad } from '../useLoad';

const METRIC_DE: [string, string][] = [
  ['pdf_server', 'PDF über den Dienst'],
  ['pdf_browser', 'PDF im Browser'],
  ['docx', 'Word'],
  ['latex', 'LaTeX'],
  ['share_link', 'Sharelinks angelegt'],
  ['md_import', 'Markdown geschrieben'],
  ['md_export', 'Markdown gelesen'],
  ['api_call', 'KI-Verbindung und API'],
];
const DIM_DE: Record<string, string> = { template: 'Vorlage', lang: 'Sprache', format: 'Format', variant: 'Fassung', pages: 'Seiten', route: 'Schnittstelle', via: 'Weg' };
const LANG_DE: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch' };
const VIA_DE: Record<string, string> = { oauth: 'KI-Verbindung (MCP)', apikey: 'API-Schlüssel' };
const PAGES_DE: Record<string, string> = { one: '1 Seite', two: '2 Seiten', three: '3 Seiten', four: '4 Seiten', auto: 'automatisch' };

function label(dim: string, value: string, fallback?: string | null) {
  if (fallback) return fallback;
  if (dim === 'lang') return LANG_DE[value] || value;
  if (dim === 'via') return VIA_DE[value] || value;
  if (dim === 'pages' || dim === 'pageMode') return PAGES_DE[value] || value;
  if (dim === 'format' || dim === 'pageFormat') return value === 'a4' ? 'A4' : value === 'letter' ? 'US Letter' : value === 'legal' ? 'US Legal' : value === 'a5' ? 'A5' : value;
  return value;
}

export default function Usage() {
  const [days, setDays] = useState(30);
  const { data: d, error, loading, reload } = useLoad(() => adminFetch<UsageData>(`/api/admin/usage?days=${days}`), `${days}`);
  return (
    <>
      <PageHead title="Nutzung" sub="Nur Tageszähler. Keine Personen, keine Adressen." asOf={d?.asOf} onReload={reload} loading={loading}>
        <RangePicker value={days} onChange={setDays} />
      </PageHead>
      <ErrorNote error={error} onRetry={reload} />
      <p className="adm-note">
        Gezählt wird nur, was am Server ankommt. Wer im Lokalmodus oder ohne Konto arbeitet, taucht hier nicht auf, bis auf PDFs über den Dienst.
        {d?.countingSince ? ` Zähler laufen seit ${fmtDate(d.countingSince)}.` : ' Die Zähler laufen ab dem nächsten Deploy.'}
        {d?.umamiUrl && <> Besucherzahlen stehen in <a href={d.umamiUrl} target="_blank" rel="noopener noreferrer">Umami</a>.</>}
      </p>
      {!d ? <Skeleton /> : (
        <>
          <Section title={`Letzte ${days} Tage`}>
            <div className="adm-grid">
              {METRIC_DE.map(([k, l]) => <Stat key={k} label={l} value={fmtInt(d.metrics[k]?.total || 0)} />)}
            </div>
          </Section>
          <Section title="Aufschlüsselung">
            <div className="adm-grid-2">
              {METRIC_DE.flatMap(([k, l]) => Object.entries(d.metrics[k]?.dims || {}).map(([dim, rows]) => (
                <div key={`${k}-${dim}`} className="adm-card">
                  <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>{l} nach {DIM_DE[dim] || dim}</h3>
                  <HBars rows={rows.slice(0, 12).map(r => ({ label: label(dim, r.value, r.label), n: r.n, title: r.value }))} />
                </div>
              )))}
              {METRIC_DE.every(([k]) => !Object.keys(d.metrics[k]?.dims || {}).length) && <p className="adm-empty">Noch keine Aufschlüsselung in diesem Zeitraum.</p>}
            </div>
          </Section>
          <Section title={`Gespeicherte Lebensläufe (${fmtInt(d.profiles.total)})`}>
            <p className="adm-hint" style={{ margin: '0 0 10px' }}>Aus den Einstellungen der Lebensläufe am Server, zusammengezählt. Zeigt, was eingestellt ist, nicht was exportiert wurde.</p>
            <div className="adm-grid-2">
              <div className="adm-card"><h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Beliebteste Vorlagen</h3><HBars rows={d.profiles.template.slice(0, 15).map(r => ({ label: r.value, n: r.n }))} /></div>
              <div className="adm-card"><h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Dokumentsprache</h3><HBars rows={d.profiles.lang.map(r => ({ label: label('lang', r.value), n: r.n }))} /></div>
              <div className="adm-card"><h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Seitenzahl</h3><HBars rows={d.profiles.pageMode.map(r => ({ label: label('pages', r.value), n: r.n }))} /></div>
              <div className="adm-card"><h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Papierformat</h3><HBars rows={d.profiles.pageFormat.map(r => ({ label: r.value === '–' ? 'A4 (Standard)' : label('format', r.value), n: r.n }))} /></div>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
