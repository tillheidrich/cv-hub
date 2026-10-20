// Admin → Verkauf (20.10.2026, pdf-service/saleadmin.js).
//
// Alles, was den Verkauf an- und ausschaltet, an einer Stelle und ohne
// Umgebungsvariablen: Mollie-Schlüssel (bei Mollie geprüft, verschlüsselt gespeichert,
// nie wieder angezeigt), Testkonten, Modus Aus / Test / Live, offene
// Registrierung. Wirksam sofort, ohne Neustart.
import { useState, type FormEvent } from 'react';
import { adminFetch, AdminError, type SaleState } from '../api';
import { Chip, ErrorNote, Note, PageHead, Section, Skeleton, Stat } from '../ui';
import { fmtDateTime, fmtEur } from '../format';
import { useLoad } from '../useLoad';

const MODE: Record<string, [string, string]> = {
  off: ['Aus', 'Niemand sieht den Kauf. Alles ist kostenlos wie bisher.'],
  test: ['Test', 'Nur die Testkonten sehen den Kauf und zahlen mit Mollie-Testdaten. Es fließt kein Geld. Für alle anderen bleibt alles wie bisher.'],
  live: ['Live', 'Alle sehen den Kauf. Zahlungen sind echt.'],
};
const errText = (e: unknown, fallback: string) => (e instanceof AdminError ? e.message : fallback);

export default function Sale() {
  const load = useLoad(() => adminFetch<SaleState>('/api/admin/sale'));
  const [st, setSt] = useState<SaleState | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger' | 'warn'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const s = st ?? load.data;

  async function send(body: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await adminFetch<SaleState>('/api/admin/sale', { body });
      setSt(r);
      const m = r.methods?.live ?? r.methods?.test;
      setMsg({ tone: 'ok', text: m?.length ? `${ok} Aktive Zahlungsarten bei Mollie: ${m.map(x => x.description).join(', ')}.` : ok });
      return true;
    } catch (err) {
      setMsg({ tone: 'danger', text: errText(err, 'Hat nicht geklappt.') });
      // Auch bei Ablehnung des Moduswechsels sind geprüfte Schlüssel gespeichert.
      setSt(null);
      void load.reload();
      return false;
    } finally { setBusy(false); }
  }

  if (load.error && !s) return <><PageHead title="Verkauf" /><ErrorNote error={load.error} onRetry={load.reload} /></>;
  if (!s) return <><PageHead title="Verkauf" /><Skeleton rows={4} /></>;

  const e = s.effective;
  const stored = s.stored;
  const step = !stored?.testKey ? 1 : e.mode === 'off' ? 2 : e.mode === 'test' ? 3 : 4;

  function saveKeys(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    const body: Record<string, unknown> = {};
    const t = String(f.get('testKey') || '').trim(); if (t) body.testKey = t;
    const l = String(f.get('liveKey') || '').trim(); if (l) body.liveKey = l;
    if (!t && !l) { setMsg({ tone: 'warn', text: 'Bitte einen Schlüssel einfügen.' }); return; }
    const form = ev.currentTarget;
    void send(body, 'Schlüssel von Mollie bestätigt und gespeichert.').then(ok => { if (ok) form.reset(); });
  }
  function saveTesters(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);
    void send({ testers: String(f.get('testers') || '') }, 'Testkonten gespeichert.');
  }

  return (
    <>
      <PageHead title="Verkauf" sub="Mollie, Testbetrieb und Live-Schaltung. Gilt sofort, ohne Umgebungsvariablen und ohne Neustart." asOf={s.asOf} onReload={() => { setSt(null); void load.reload(); }} loading={load.loading} />

      <Section title="Stand">
        <div className="adm-grid">
          <Stat label="Verkauf" value={MODE[e.mode][0]} tone={e.mode === 'live' ? 'accent' : e.mode === 'test' ? 'warn' : undefined}
            sub={e.mode === 'test' ? (e.testersSale ? `für ${e.testers.length} Testkonto${e.testers.length === 1 ? '' : 'en'}` : 'noch nicht vollständig') : e.mode === 'live' ? (e.publicSale ? 'öffentlich' : 'noch nicht vollständig') : 'kein Kauf möglich'} />
          <Stat label="Mollie" value={e.keyMode === 'live' ? 'Live-Schlüssel' : e.keyMode === 'test' ? 'Testschlüssel' : '–'} />
          <Stat label="Registrierung" value={e.registrationOpen ? 'offen' : 'nur mit Einladung'} />
          <Stat label="Pass" value={fmtEur(e.priceCents)} sub={`${e.days} Tage, einmalig`} />
        </div>
        <Note>{MODE[e.mode][1]}</Note>
        {e.mode !== 'off' && e.missing.length > 0 && <Note tone="danger">Es fehlt noch: {e.missing.join(', ')}. Bis dahin bleibt der Kauf aus.</Note>}
        {s.source === 'env' && <Note>Noch nichts hier gespeichert: Es gilt die Umgebung (Umgebungsvariablen des Dienstes). Sobald du hier speicherst, gelten die Einstellungen dieser Seite.</Note>}
      </Section>

      <Section title="So geht es">
        <ol className="adm-steps" style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8 }}>
          {[
            'Mollie-Testschlüssel unten einfügen. Du findest ihn im Mollie-Dashboard unter Entwickler → API-Schlüssel, er beginnt mit „test_".',
            'Dein normales Konto (nicht den Admin) als Testkonto eintragen und „Test" einschalten.',
            'In der App mit diesem Konto einen Pass kaufen. Mollie zeigt eine Testseite, dort „Bezahlt" wählen. Danach einmal widerrufen.',
            `Live-Schlüssel einfügen („live_…"), „Live" einschalten, ersten echten Kauf über ${fmtEur(e.priceCents)} selbst machen und wieder widerrufen.`,
          ].map((t, i) => (
            <li key={i} style={{ fontWeight: step === i + 1 ? 640 : 400 }} aria-current={step === i + 1 ? 'step' : undefined}>
              {step > i + 1 ? <span aria-label="erledigt">✓ </span> : ''}{t}
            </li>
          ))}
        </ol>
      </Section>

      {msg && <Note tone={msg.tone}>{msg.text}</Note>}

      <Section title="1 · Mollie-Schlüssel">
        <form className="adm-card" onSubmit={saveKeys} aria-label="Mollie-Schlüssel" data-sale-keys>
          <div className="adm-grid-2">
            <div className="adm-field">
              <label htmlFor="sale-test">Testschlüssel {stored?.testKey ? `(gespeichert: ${stored.testKey.hint})` : ''}</label>
              <input id="sale-test" name="testKey" type="password" autoComplete="off" spellCheck={false} placeholder="test_…" />
              {stored?.testKey && <span className="adm-hint">{stored.testKey.readable ? `von Mollie bestätigt ${fmtDateTime(stored.testKey.checkedAt)}` : 'nicht mehr lesbar, bitte neu einfügen'}</span>}
            </div>
            <div className="adm-field">
              <label htmlFor="sale-live">Live-Schlüssel {stored?.liveKey ? `(gespeichert: ${stored.liveKey.hint})` : ''}</label>
              <input id="sale-live" name="liveKey" type="password" autoComplete="off" spellCheck={false} placeholder="live_…" />
              {stored?.liveKey && <span className="adm-hint">{stored.liveKey.readable ? `von Mollie bestätigt ${fmtDateTime(stored.liveKey.checkedAt)}` : 'nicht mehr lesbar, bitte neu einfügen'}</span>}
            </div>
          </div>
          <p className="adm-hint">Der Schlüssel geht nur an Mollie zur Prüfung und wird verschlüsselt gespeichert. Er erscheint danach nirgends mehr, nur Anfang und Ende. Leer lassen = unverändert.</p>
          <div className="adm-row" style={{ marginTop: 10 }}>
            <button type="submit" className="adm-btn" data-kind="primary" disabled={busy}>{busy ? 'Prüfe bei Mollie …' : 'Prüfen und speichern'}</button>
          </div>
        </form>
      </Section>

      <Section title="2 · Testkonten">
        <form key={stored?.updatedAt || 'neu'} className="adm-card" onSubmit={saveTesters} aria-label="Testkonten" data-sale-testers>
          <div className="adm-field">
            <label htmlFor="sale-testers">E-Mail-Adressen der Konten, die im Testbetrieb kaufen dürfen</label>
            <textarea id="sale-testers" name="testers" rows={2} defaultValue={(stored?.testers ?? e.testers).join(', ')} placeholder="du@example.de" />
          </div>
          <p className="adm-hint">Ein normales Konto mit bestätigter E-Mail. Admin-Konten haben ohnehin vollen Zugang und können keinen Pass kaufen.</p>
          <div className="adm-row" style={{ marginTop: 10 }}><button type="submit" className="adm-btn" disabled={busy}>Speichern</button></div>
        </form>
      </Section>

      <Section title="3 · Verkauf schalten">
        <div className="adm-card" data-sale-mode>
          <div className="adm-row" role="group" aria-label="Modus" style={{ gap: 8, flexWrap: 'wrap' }}>
            {(['off', 'test', 'live'] as const).map(m => (
              <button key={m} type="button" className="adm-btn" data-kind={e.mode === m ? 'primary' : undefined} aria-pressed={e.mode === m} disabled={busy || e.mode === m || (m === 'live' && !confirmLive && e.mode !== 'live')}
                onClick={() => void send(m === 'live' ? { mode: m, confirmLive: true } : { mode: m }, `Verkauf: ${MODE[m][0]}.`).then(ok => { if (ok) setConfirmLive(false); })}>
                {MODE[m][0]}
              </button>
            ))}
          </div>
          {e.mode !== 'live' && (
            <label className="adm-row" style={{ gap: 8, marginTop: 12, alignItems: 'flex-start', fontWeight: 400 }}>
              <input type="checkbox" checked={confirmLive} onChange={ev => setConfirmLive(ev.target.checked)} style={{ width: 18, height: 18, minHeight: 0, padding: 0, flex: '0 0 auto', marginTop: 2 }} data-confirm-live />
              <span>Ich habe die Testkäufe gemacht und will echte Verkäufe. Vorher erledigt: Rechtstexte anwaltlich geprüft, Steuerfragen geklärt, Live-Schlüssel eingetragen.</span>
            </label>
          )}
        </div>
      </Section>

      <Section title="Registrierung">
        <div className="adm-card adm-row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span>{e.registrationOpen ? 'Offen: Jeder kann ein Konto anlegen (mit Bot-Schutz und Bestätigungsmail).' : 'Zu: Ein Konto gibt es nur mit Einladungscode.'}</span>
          <button type="button" className="adm-btn" disabled={busy} onClick={() => void send({ registration: !e.registrationOpen }, e.registrationOpen ? 'Registrierung geschlossen.' : 'Registrierung geöffnet.')}>
            {e.registrationOpen ? 'Schließen' : 'Öffnen'}
          </button>
        </div>
      </Section>

      <Section title="Prüfliste">
        <ul className="adm-card" style={{ listStyle: 'none', margin: 0, display: 'grid', gap: 6 }} data-sale-checks>
          {s.checks.map(c => (
            <li key={c.id} className="adm-row" style={{ gap: 8 }}><Chip tone={c.ok ? 'ok' : 'warn'}>{c.ok ? 'ok' : 'offen'}</Chip><span>{c.label}</span></li>
          ))}
        </ul>
        {e.webhookUrl && <p className="adm-hint">Mollie meldet Zahlungen an {e.webhookUrl}. Im Mollie-Dashboard musst du dafür nichts eintragen.</p>}
      </Section>
    </>
  );
}
