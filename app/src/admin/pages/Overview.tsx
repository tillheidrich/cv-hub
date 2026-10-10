import { adminFetch, type Overview as OverviewData } from '../api';
import { ErrorNote, PageHead, Section, Skeleton, Stat } from '../ui';
import { fmtBytes, fmtDateTime, fmtEur, fmtInt, relDays } from '../format';
import { useLoad } from '../useLoad';

const SOURCE_DE: Record<string, string> = { order: 'Gekauft', voucher: 'Gutschein', pilot: 'Pilot', admin: 'Von dir', legacy: 'Altbestand' };

/** P7: Umsatz an Privatkunden im EU-Ausland mit Abstand zur Sperre und zur
 *  gesetzlichen Schwelle (§ 3a Abs. 5 UStG: Vorjahr ODER laufendes Jahr). */
function EuAbroad({ eu }: { eu: NonNullable<OverviewData['euAbroad']> }) {
  const max = Math.max(eu.currentYearCents, eu.previousYearCents);
  const tone = eu.paused ? 'danger' : max >= eu.warnAtCents ? 'warn' : undefined;
  const pct = (c: number) => Math.min(100, Math.round((c / eu.thresholdCents) * 100));
  return (
    <Section title="EU-Ausland (Privatkunden)">
      <div className="adm-grid-2">
        <div className="adm-grid">
          <Stat tone={tone} label={`Laufendes Jahr ${eu.currentYear}`} value={fmtEur(eu.currentYearCents)} sub={`${pct(eu.currentYearCents)} % der Schwelle`} />
          <Stat tone={tone} label={`Voriges Jahr ${eu.previousYear}`} value={fmtEur(eu.previousYearCents)} sub={`${pct(eu.previousYearCents)} % der Schwelle`} />
          <Stat tone={tone} label="Abstand zur Schwelle 10.000 €" value={fmtEur(eu.remainingToThresholdCents)} sub={`gerechnet mit dem höheren Jahr`} />
          <Stat tone={eu.paused ? 'danger' : undefined} label="Verkauf ins EU-Ausland" value={eu.paused ? 'gesperrt' : 'offen'}
            sub={eu.paused ? `Sperre ab ${fmtEur(eu.stopAtCents)} erreicht; Deutschland läuft weiter` : `sperrt automatisch ab ${fmtEur(eu.stopAtCents)} (noch ${fmtEur(eu.remainingToStopCents)})`} />
        </div>
        <div className="adm-card">
          <div role="img" aria-label={`Höheres Jahr: ${pct(max)} % der Schwelle von ${fmtEur(eu.thresholdCents)}`} style={{ position: 'relative', height: 14, borderRadius: 7, background: 'var(--adm-line, #e6e7ec)', overflow: 'hidden' }}>
            <div style={{ width: `${pct(max)}%`, height: '100%', background: eu.paused ? 'var(--adm-danger, #b42318)' : max >= eu.warnAtCents ? 'var(--adm-warn, #b54708)' : 'var(--adm-accent, #3538cd)' }} />
            <div title="Sperre" style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(eu.stopAtCents)}%`, width: 2, background: 'currentColor', opacity: 0.6 }} />
          </div>
          <p className="adm-hint" style={{ marginTop: 8 }}>
            Ab 10.000 € im Vorjahr oder im laufenden Jahr gilt für Privatkunden im EU-Ausland die Umsatzsteuer ihres Landes; § 19 UStG schützt dort nicht. Der Dienst sperrt den Verkauf dorthin vorher ({fmtEur(eu.stopAtCents)}, Variable EU_B2C_STOP_CENTS). Ab 8.000 € die Steuerberatung einschalten. Nur Umsätze dieses Werkzeugs.
          </p>
        </div>
      </div>
    </Section>
  );
}

export default function Overview() {
  const { data: d, error, loading, reload } = useLoad(() => adminFetch<OverviewData>('/api/admin/overview'));
  return (
    <>
      <PageHead title="Überblick" sub="Alles Wichtige auf einen Blick. Zahlen ohne Admin-Konten." asOf={d?.asOf} onReload={reload} loading={loading} />
      <ErrorNote error={error} onRetry={reload} />
      {!d ? <Skeleton /> : (
        <>
          {(d.declarations.manual > 0 || d.declarations.pending_confirmation > 0 || d.money.refunds_open > 0 || d.mail.failed_today > 0 || d.accessRequestsPending > 0) && (
            <Section title="Braucht dich">
              <div className="adm-grid">
                {d.declarations.manual > 0 && <a href="#/erklaerungen" style={{ textDecoration: 'none', color: 'inherit' }}><Stat tone="danger" label="Erklärungen von Hand" value={fmtInt(d.declarations.manual)} sub="Widerruf oder Kündigung ohne Zuordnung" /></a>}
                {d.declarations.pending_confirmation > 0 && <a href="#/erklaerungen" style={{ textDecoration: 'none', color: 'inherit' }}><Stat tone="warn" label="Offen, unbestätigt" value={fmtInt(d.declarations.pending_confirmation)} sub="öffentliche Erklärung, Link noch nicht geklickt; Widerruf: Erstattung spätestens 14 Tage nach Eingang" /></a>}
                {d.money.refunds_open > 0 && <a href="#/zahlungen" style={{ textDecoration: 'none', color: 'inherit' }}><Stat tone="warn" label="Erstattungen offen" value={fmtInt(d.money.refunds_open)} sub="widerrufen, noch nicht erstattet" /></a>}
                {d.mail.failed_today > 0 && <a href="#/system" style={{ textDecoration: 'none', color: 'inherit' }}><Stat tone="danger" label="Mailfehler heute" value={fmtInt(d.mail.failed_today)} /></a>}
                {d.accessRequestsPending > 0 && <a href="#/zugang" style={{ textDecoration: 'none', color: 'inherit' }}><Stat tone="accent" label="Zugangsanfragen" value={fmtInt(d.accessRequestsPending)} sub="warten auf dich" /></a>}
              </div>
            </Section>
          )}

          {d.euAbroad && <EuAbroad eu={d.euAbroad} />}

          <Section title="Geld">
            <div className="adm-grid-2">
              <div className="adm-card">
                <table className="adm-ledger">
                  <caption className="adm-sr">Umsatz aus Rechnungen, ohne Widerrufe und Erstattungen</caption>
                  <tbody>
                    <tr><th scope="row">Dieser Monat</th><td>{fmtEur(d.money.month_cents)}</td></tr>
                    <tr><th scope="row">Dieses Jahr</th><td>{fmtEur(d.money.year_cents)}</td></tr>
                    <tr><th scope="row">Gesamt</th><td>{fmtEur(d.money.total_cents)}</td></tr>
                  </tbody>
                </table>
                <p className="adm-hint" style={{ marginTop: 8 }}>Aus bezahlten Bestellungen mit Rechnung. Widerrufene und erstattete zählen nicht.</p>
              </div>
              <div className="adm-grid">
                <Stat label="Bezahlte Bestellungen" value={fmtInt(d.money.paid_orders)} />
                <Stat label="Widerrufe" value={fmtInt(d.money.withdrawals)} sub={`${fmtInt(d.money.refunded)} erstattet (${fmtEur(d.money.refunded_cents)})`} />
                <Stat label="Kündigungen" value={fmtInt(d.money.cancellations)} />
                <Stat label="Offene Zahlungen" value={fmtInt(d.money.open_orders)} sub="angelegt, nicht bezahlt" />
              </div>
            </div>
          </Section>

          <Section title="Konten">
            <div className="adm-grid">
              <Stat label="Konten gesamt" value={fmtInt(d.accounts.total)} sub={`${fmtInt(d.accounts.disabled)} gesperrt`} />
              {d.art9Consent && (
                <Stat label="Einwilligung Art. 9" value={fmtInt(d.art9Consent.given)} tone={d.art9Consent.missing > 0 ? 'warn' : undefined}
                  sub={`${fmtInt(d.art9Consent.missing)} ohne (speichern nicht), ${fmtInt(d.art9Consent.withdrawn)} widerrufen · Fassung ${d.art9Consent.version ?? '–'}`} />
              )}
              <Stat label="Neu, 7 Tage" value={fmtInt(d.accounts.new7)} sub={`${fmtInt(d.accounts.new30)} in 30 Tagen`} />
              <Stat label="Aktiv, 7 Tage" value={fmtInt(d.accounts.active7)} sub={`${fmtInt(d.accounts.active30)} in 30 Tagen`} />
              <Stat label="Unbestätigt" value={fmtInt(d.accounts.unconfirmed)} sub="werden nach 48 h gelöscht" />
              <Stat label="Zwei-Faktor an" value={fmtInt(d.accounts.twofa)} />
            </div>
          </Section>

          <Section title="Pässe und Zugänge">
            <div className="adm-grid">
              <Stat label="Pässe aktiv" value={fmtInt(d.passes.active)} sub="gekauft, laufen noch" />
              <Stat label="Pässe abgelaufen" value={fmtInt(d.passes.expired)} />
              <Stat label="Dauerhaft gratis" value={fmtInt(d.accounts.lifetime)} />
              {d.passes.grantsBySource.map(g => <Stat key={g.source} label={`Aktiv: ${SOURCE_DE[g.source] || g.source}`} value={fmtInt(g.active)} />)}
            </div>
          </Section>

          <Section title="Betrieb">
            <div className="adm-grid">
              <Stat label="Mail" value={d.mail.configured ? 'eingerichtet' : 'fehlt'} tone={d.mail.configured ? undefined : 'danger'}
                sub={`${fmtInt(d.mail.sent7)} raus, ${fmtInt(d.mail.failed7)} Fehler (7 Tage)`} />
              <Stat label="Aufräumjob" value={d.janitor.lastRunAt ? relDays(d.janitor.lastRunAt) : 'noch nicht'} tone={d.janitor.lastError ? 'danger' : undefined}
                sub={d.janitor.lastRunAt ? fmtDateTime(d.janitor.lastRunAt) : 'läuft beim Start und täglich'} />
              <Stat label="Datenbank" value={fmtBytes(d.storage.dbBytes)} sub={d.storage.tables.slice(0, 2).map(t => `${t.name} ${fmtBytes(t.bytes)}`).join(' · ')} />
              <Stat label="Fotos" value={fmtBytes(d.storage.photos.bytes)} sub={`${fmtInt(d.storage.photos.n)} Fotos, ${fmtInt(d.storage.resumes)} Lebensläufe`} />
              <Stat label="Version" value={d.version?.commit ? d.version.commit.slice(0, 7) : 'unbekannt'}
                sub={d.version ? `läuft seit ${fmtDateTime(d.version.startedAt)}` : undefined} />
              <Stat label="Verkauf" value={d.sale?.ready ? 'an' : d.sale?.enabled ? 'an, aber unvollständig' : 'aus'} tone={d.sale?.enabled && !d.sale.ready ? 'warn' : undefined} sub="Schalter in Coolify" />
            </div>
          </Section>
        </>
      )}
    </>
  );
}
