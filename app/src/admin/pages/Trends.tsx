import { useState } from 'react';
import { adminFetch, type Funnel, type Timeseries } from '../api';
import { DayBars } from '../charts';
import { ErrorNote, PageHead, RangePicker, Section, Skeleton } from '../ui';
import { fmtEur, fmtInt } from '../format';
import { useLoad } from '../useLoad';

export default function Trends() {
  const [days, setDays] = useState(30);
  const ts = useLoad(() => adminFetch<Timeseries>(`/api/admin/timeseries?days=${days}`), `${days}`);
  const fn = useLoad(() => adminFetch<Funnel>(`/api/admin/funnel?days=${days}`), `${days}`);
  const s = ts.data?.series || [];
  const pts = (k: keyof (typeof s)[number]) => s.map(r => ({ day: r.day, value: Number(r[k]) || 0 }));
  const f = fn.data;
  const steps: [string, number, string][] = f ? [
    ['Registriert', f.registered, 'Konten, die in diesem Zeitraum angelegt wurden'],
    ['Adresse bestätigt', f.confirmed, 'Einladungskonten gelten als bestätigt'],
    ['Lebenslauf gespeichert', f.with_resume, 'mindestens ein Lebenslauf am Server'],
    ['Kauf oder Gutschein', f.converted, `${fmtInt(f.paid)} gekauft, ${fmtInt(f.voucher)} mit Gutschein`],
  ] : [];
  const top = steps[0]?.[1] || 0;
  return (
    <>
      <PageHead title="Verlauf" sub="Je Tag, Berliner Zeit." asOf={ts.data?.asOf} onReload={() => { void ts.reload(); void fn.reload(); }} loading={ts.loading}>
        <RangePicker value={days} onChange={setDays} />
      </PageHead>
      <ErrorNote error={ts.error || fn.error} onRetry={ts.reload} />
      {!ts.data ? <Skeleton /> : (
        <>
          <Section title="Geld und Konten">
            <div className="adm-grid-2">
              <DayBars title="Umsatz" points={pts('revenue_cents')} format={fmtEur} />
              <DayBars title="Käufe" points={pts('purchases')} />
              <DayBars title="Registrierungen" points={pts('registrations')} />
              <DayBars title="Gutschein-Einlösungen" points={pts('vouchers')} />
            </div>
          </Section>
          <Section title="Exporte">
            <div className="adm-grid-2">
              <DayBars title="PDF über den Dienst" points={pts('pdf_server')} />
              <DayBars title="PDF im Browser (gemeldet)" points={pts('pdf_browser')} />
              <DayBars title="Word (gemeldet)" points={pts('docx')} />
            </div>
            <p className="adm-hint" style={{ marginTop: 8 }}>
              „PDF über den Dienst“ zählt auch die Demo ohne Konto. Browser-PDF und Word kennt der Server nur, wenn die App sie meldet, und das tut sie nur mit Konto. Lokalmodus-Nutzer sieht er gar nicht.
            </p>
          </Section>
        </>
      )}
      <Section title="Trichter">
        {!f ? <Skeleton rows={1} /> : (
          <div className="adm-card">
            <div className="adm-funnel">
              {steps.map(([label, n, hint], i) => (
                <div key={label} className="adm-funnel-step" title={hint}>
                  <span>{label}<span className="adm-sr"> ({hint})</span></span>
                  <span className="track" aria-hidden="true"><span className="fill" style={{ display: 'block', width: `${top ? (n / top) * 100 : 0}%` }} /></span>
                  <span className="adm-num">{fmtInt(n)}{i > 0 && top ? ` · ${Math.round((n / top) * 100)} %` : ''}</span>
                </div>
              ))}
            </div>
            <p className="adm-hint" style={{ marginTop: 10 }}>
              Nur Zahlen, Konten aus den letzten {days} Tagen. Unbestätigte Konten löscht der Aufräumjob nach 48 Stunden, gelöschte Konten fehlen hier.
            </p>
          </div>
        )}
      </Section>
    </>
  );
}
