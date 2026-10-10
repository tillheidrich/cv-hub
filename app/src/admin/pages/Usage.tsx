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
  ['template_lock_view', 'Pass-Vorlage angesehen'],
  ['unlock_panel_view', 'Freischalt-Paneel geöffnet'],
  ['export_markdown', 'Markdown heruntergeladen'],
  ['import_markdown', 'Markdown übernommen'],
  ['ai_open', 'KI-Knopf benutzt'],
];
const DIM_DE: Record<string, string> = { template: 'Vorlage', lang: 'Sprache', format: 'Format', variant: 'Fassung', pages: 'Seiten', route: 'Schnittstelle', via: 'Weg', reason: 'Sperrgrund', target: 'Ziel', mode: 'Weg' };
/** Sperrgründe des Freischalt-Paneels (pdf-service/stats.js, UNLOCK_REASONS). */
const REASON_DE: Record<string, string> = {
  template: 'Pass-Vorlage (PDF/HTML)', docx: 'Word und LaTeX', coverLetter: 'Anschreiben', profiles: 'Weitere Fassungen',
  langs: 'Weitere Sprachen', share: 'Sharelink', mcp: 'KI verbinden (MCP)', versions: 'Versionen am Server', sync: 'Speichern über Geräte',
  account: 'Konto anlegen', apiKeys: 'API-Schlüssel',
};
const TARGET_DE: Record<string, string> = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini', clipboard: 'Zwischenablage' };
const MODE_DE: Record<string, string> = { local: 'ohne Konto', account: 'mit Konto' };
const LANG_DE: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch' };
const VIA_DE: Record<string, string> = { oauth: 'KI-Verbindung (MCP)', apikey: 'API-Schlüssel' };
const PAGES_DE: Record<string, string> = { one: '1 Seite', two: '2 Seiten', three: '3 Seiten', four: '4 Seiten', auto: 'automatisch' };

function label(dim: string, value: string, fallback?: string | null) {
  if (fallback) return fallback;
  if (dim === 'lang') return LANG_DE[value] || value;
  if (dim === 'via') return VIA_DE[value] || value;
  if (dim === 'reason') return REASON_DE[value] || value;
  if (dim === 'target') return TARGET_DE[value] || value;
  if (dim === 'mode') return MODE_DE[value] || value;
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
        Gezählt wird nur, was am Server ankommt. Wer im Lokalmodus oder ohne Konto arbeitet, taucht hier nicht auf, bis auf PDFs über den Dienst und fünf Bedienereignisse (Pass-Vorlage angesehen, Freischalt-Paneel, Markdown hin und zurück, KI-Knopf), die ohne Personenbezug gemeldet werden, außer bei Widerspruch gegen die Reichweitenmessung.
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
          <Section title="Vorlagen-Staffel und Sperrgründe">
            <p className="adm-hint" style={{ margin: '0 0 10px' }}>Entscheidungsregel 31.01.2027: Käufe nach „Pass-Vorlage angesehen" unter 1 % → zurück zu „PDF in allen Vorlagen frei". Käufe stehen unter Zahlungen, Widerrufe im Überblick.</p>
            <div className="adm-grid-2">
              <div className="adm-card" data-unlock-reasons>
                <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Freischalt-Paneel nach Sperrgrund</h3>
                {(d.metrics.unlock_panel_view?.dims.reason || []).length
                  ? <HBars rows={(d.metrics.unlock_panel_view?.dims.reason || []).map(r => ({ label: label('reason', r.value), n: r.n, title: r.value }))} />
                  : <p className="adm-empty">Noch keine Zahlen in diesem Zeitraum.</p>}
              </div>
              <div className="adm-card">
                <h3 style={{ margin: '0 0 10px', fontSize: 13.5 }}>Pass-Vorlagen, die angesehen wurden</h3>
                {(d.metrics.template_lock_view?.dims.template || []).length
                  ? <HBars rows={(d.metrics.template_lock_view?.dims.template || []).slice(0, 12).map(r => ({ label: r.value, n: r.n }))} />
                  : <p className="adm-empty">Noch keine Zahlen in diesem Zeitraum.</p>}
              </div>
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
