/**
 * Admin-Reiter „Gutscheine" (09.10.2026, Gutscheine und Gratiszugänge).
 * Deutsch wie der Rest des Panels.
 *
 *  - Anlegen mit den Standards aus dem Auftrag: persönlich = zufälliger Code,
 *    1 Einlösung; öffentlich = 30 Tage, Limit 100, Einlösefrist Pflicht ohne
 *    Vorbelegung; öffentlich dauerhaft = Limit Pflicht. „Ohne Gesamtlimit"
 *    gibt es nur über eine bewusste Auswahl mit Bestätigung.
 *  - Vor dem Speichern ein Satz, der sagt, was verteilt wird („Du verteilst
 *    100 Zugänge für je 30 Tage …" / „50 dauerhafte Gratiszugänge …").
 *  - Persönliche Codes erscheinen genau einmal (der Server speichert nur einen
 *    Prüfwert). Öffentliche Codes bleiben sichtbar, sie sind nicht geheim.
 *  - Übersicht, Einlösungen (ohne E-Mail-Adressen), Deaktivieren mit
 *    Erklärung, kopierbarer Aktionshinweis plus Einlöseadresse ohne Code.
 *  - Kennzahlen je Kampagne und Zugangsart, deutlich getrennt vom Umsatz.
 */
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { voucherApi, type AdminRedemption, type AdminVoucher, type CreateVoucherInput, type VoucherStats } from '../billing/api';
import { PATHS } from '../billing/route';

const UI = "'Inter', sans-serif";
const INK = 'oklch(0.21 0.021 264)';
const INK2 = 'oklch(0.42 0.017 264)';
const INK3 = 'oklch(0.48 0.012 264)';
const ACCENT = 'oklch(0.50 0.216 264)';
const HAIR = 'oklch(0.91 0.005 264)';
const card: React.CSSProperties = { background: 'oklch(0.985 0.003 264)', border: `1px solid ${HAIR}`, borderRadius: '10px', padding: '12px 14px' };
const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', fontWeight: 700, color: INK2, marginBottom: '4px', fontFamily: UI };
const input: React.CSSProperties = { width: '100%', minHeight: '40px', padding: '7px 10px', border: '1px solid oklch(0.80 0.008 264)', borderRadius: '7px', fontFamily: UI, fontSize: '14px', boxSizing: 'border-box', background: '#fff', color: INK };
const hint: React.CSSProperties = { fontSize: '11.5px', color: INK3, fontFamily: UI, lineHeight: 1.5, marginTop: '4px' };
const btn: React.CSSProperties = { minHeight: '36px', background: 'none', border: '1px solid oklch(0.80 0.008 264)', borderRadius: '7px', padding: '6px 11px', fontSize: '12.5px', cursor: 'pointer', color: INK2, fontFamily: UI };
const btnPrimary: React.CSSProperties = { ...btn, background: ACCENT, border: 'none', color: '#fff', fontWeight: 700, padding: '8px 16px', minHeight: '40px' };
const fieldset: React.CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 };
const radioRow: React.CSSProperties = { display: 'flex', gap: '6px', flexWrap: 'wrap' };
const radioLbl = (on: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '40px', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: UI, fontSize: '13px', color: INK, background: on ? 'oklch(0.96 0.02 264)' : '#fff', border: `1px solid ${on ? ACCENT : 'oklch(0.85 0.006 264)'}` });

const dateDe = (iso: string) => {
  try { return new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }); }
  catch { return iso; }
};
const dateTimeDe = (iso: string) => {
  try { return new Date(iso).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }); }
  catch { return iso; }
};
/** Wie der Server normalisiert (Vertrag): NFKC, ohne Leerraum und
 *  Bindestriche, Großbuchstaben. Nur für die Vorschau im Formular. */
const normCode = (s: string) => s.normalize('NFKC').replace(/[\s-]+/g, '').toUpperCase();
const daysWord = (n: number) => (n === 1 ? '1 Tag' : `${n} Tage`);
const pluralZ = (n: number) => (n === 1 ? '1 Zugang' : `${n} Zugänge`);

/** Öffentliche Einlöseadresse — ohne Code im Parameter. Maßgeblich ist
 *  PUBLIC_BASE_URL des Servers (`redeemUrl`); sonst die Adresse dieses Fensters. */
function redeemAddress(fromServer?: string | null): string {
  if (fromServer && /^https?:\/\//.test(fromServer)) return fromServer;
  try { return `${window.location.origin}${PATHS.code}`; } catch { return PATHS.code; }
}

/** Kopierbarer Aktionshinweis nach festem Muster. */
function actionNotice(v: Pick<AdminVoucher, 'code' | 'kind' | 'days' | 'maxRedemptions' | 'redeemUntil' | 'announcement' | 'redeemUrl'>): string {
  // Den Satz formuliert der Server (vouchers.js, announcement); hier kommt
  // nur die Einlöseadresse dazu.
  if (v.announcement) return `${v.announcement}\n${redeemAddress(v.redeemUrl)}`;
  const what = v.kind === 'lifetime'
    ? 'einen dauerhaften Gratiszugang zum Bewerbungs-Pass'
    : `${v.days ?? 0} Tage Bewerbungs-Pass kostenlos`;
  const until = v.redeemUntil ? ` Einlösbar bis ${dateDe(v.redeemUntil)}` : '';
  const limit = v.maxRedemptions ? `, für die ersten ${v.maxRedemptions} erfolgreichen Einlösungen` : '';
  return `Mit ${v.code ?? ''} erhältst du ${what}. Ohne Zahlungsdaten, ohne Abo.${until}${limit}${until ? '.' : ''}\n${redeemAddress(v.redeemUrl)}`;
}

/** Satz vor dem Speichern: was genau verteilt wird. */
function summarySentence(f: {
  distribution: 'personal' | 'public'; kind: 'days' | 'lifetime'; days: number; count: number; perCode: number;
  limitMode: 'limited' | 'unlimited'; limit: number | null; redeemUntil: string; campaign: string;
}): string {
  const access = f.kind === 'lifetime' ? 'dauerhaften Gratiszugang' : `je ${daysWord(f.days)} Bewerbungs-Pass`;
  const camp = f.campaign ? ` Kampagne „${f.campaign}": höchstens eine Einlösung je Konto in dieser Kampagne.` : '';
  if (f.distribution === 'personal') {
    const codes = f.count === 1 ? 'einen persönlichen Code' : `${f.count} persönliche Codes`;
    return `Du erzeugst ${codes} mit je ${f.perCode === 1 ? 'einer Einlösung' : `${f.perCode} Einlösungen`} für ${access}. Die Codes siehst du nur jetzt einmal.${camp}`;
  }
  const until = f.redeemUntil ? `Einlösbar bis ${dateDe(f.redeemUntil)}, je Konto einmal.` : 'Die Einlösefrist fehlt noch.';
  if (f.limitMode === 'unlimited') {
    return f.kind === 'lifetime'
      ? `Du verteilst dauerhafte Gratiszugänge ohne Gesamtlimit: Jedes Konto, das bis zum Ende der Frist einlöst, behält den Zugang dauerhaft. ${until}${camp}`
      : `Du verteilst Zugänge für je ${daysWord(f.days)} ohne Gesamtlimit. ${until}${camp}`;
  }
  const n = f.limit ?? 0;
  return f.kind === 'lifetime'
    ? `Du verteilst ${n} dauerhafte Gratiszugänge. ${until}${camp}`
    : `Du verteilst ${pluralZ(n)} für je ${daysWord(f.days)}. ${until}${camp}`;
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }
}

function CopyButton({ text, label: lbl, onCopied }: { text: string; label: string; onCopied: (msg: string) => void }) {
  return (
    <button type="button" style={btn} onClick={async () => onCopied((await copyText(text)) ? `${lbl}: kopiert.` : 'Kopieren ging nicht – bitte von Hand markieren.')}>
      {lbl}
    </button>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [stats, setStats] = useState<VoucherStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [created, setCreated] = useState<{ codes?: string[]; voucher?: AdminVoucher } | null>(null);
  const [openRed, setOpenRed] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<Record<string, AdminRedemption[] | 'err'>>({});
  const [asking, setAsking] = useState<string | null>(null);
  const [noticeFor, setNoticeFor] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await voucherApi.list();
      const list = r.vouchers ?? [];
      setVouchers(list);
      const names = new Set<string>(list.map(v => v.campaign).filter((x): x is string => !!x));
      setCampaigns([...names].sort((a, b) => a.localeCompare(b, 'de')));
    } catch (e) { setErr(e instanceof Error ? e.message : 'Gutscheine ließen sich nicht laden.'); }
    try { setStats(await voucherApi.stats()); }
    catch { setStats(null); }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  async function showRedemptions(id: string) {
    if (openRed === id) { setOpenRed(null); return; }
    setOpenRed(id);
    try { const r = await voucherApi.redemptions(id); setRedemptions(m => ({ ...m, [id]: r.redemptions ?? [] })); }
    catch { setRedemptions(m => ({ ...m, [id]: 'err' })); }
  }
  async function deactivate(v: AdminVoucher) {
    setErr(null);
    try { await voucherApi.deactivate(v.id); setAsking(null); setStatus(`„${v.name}" ist deaktiviert. Bereits gewährte Zugänge bleiben bestehen.`); await refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Deaktivieren fehlgeschlagen.'); }
  }

  return (
    <div data-admin-vouchers>
      <div role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{status}</div>
      {err && <div role="alert" style={{ background: '#fff0f0', border: '1px solid #f0c0c0', borderRadius: '8px', padding: '8px 11px', fontSize: '12.5px', color: '#a52a1d', marginBottom: '14px', fontFamily: UI }}>{err}</div>}

      <CreateForm campaigns={campaigns} onCreated={async r => { setCreated(r); setStatus(r.codes ? `${r.codes.length} Code(s) erzeugt.` : 'Aktionscode angelegt.'); await refresh(); }} onError={setErr} />

      {created && (
        <section aria-labelledby="adm-v-created" style={{ ...card, marginBottom: '14px', borderColor: ACCENT, background: 'oklch(0.97 0.02 264)' }} data-voucher-created>
          <h3 id="adm-v-created" style={{ margin: '0 0 6px', fontSize: '14px', fontFamily: UI, color: INK }}>
            {created.codes ? 'Neue Codes – nur jetzt sichtbar' : 'Aktionscode angelegt'}
          </h3>
          {created.codes && (
            <>
              <p style={{ ...hint, marginTop: 0 }}>Gespeichert wird nur ein Prüfwert. Kopiere die Codes jetzt; später sind sie hier nicht mehr lesbar.</p>
              <ul style={{ listStyle: 'none', margin: '8px 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {created.codes.map(c => (
                  <li key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <code data-new-code style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 700, letterSpacing: '1px', color: INK }}>{c}</code>
                    <CopyButton text={c} label="Kopieren" onCopied={setStatus} />
                  </li>
                ))}
              </ul>
              {created.codes.length > 1 && <CopyButton text={created.codes.join('\n')} label="Alle kopieren" onCopied={setStatus} />}
            </>
          )}
          {created.voucher && <NoticeBox v={created.voucher} onCopied={setStatus} />}
          <div style={{ marginTop: '10px' }}><button type="button" style={btn} onClick={() => setCreated(null)}>Ausblenden</button></div>
        </section>
      )}

      <section aria-labelledby="adm-v-list" style={{ ...card, marginBottom: '14px', padding: '12px 0 6px' }}>
        <h3 id="adm-v-list" style={{ margin: '0 14px 8px', fontSize: '13.5px', fontWeight: 700, fontFamily: UI, color: INK }}>Übersicht</h3>
        {vouchers.length === 0 ? <p style={{ ...hint, margin: '0 14px 8px' }}>Noch keine Gutscheine.</p> : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {vouchers.map(v => {
              const id = String(v.id);
              const limit = String(v.maxRedemptions ?? '');
              return (
                <li key={id} data-voucher-row={v.distribution} data-active={v.active ? 'true' : 'false'} style={{ padding: '10px 14px', borderTop: `1px solid ${HAIR}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 10px' }}>
                    <strong style={{ fontFamily: UI, fontSize: '13.5px', color: INK }}>{v.name}</strong>
                    {v.distribution === 'public' && v.code
                      ? <code style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.5px', color: INK }}>{v.code}</code>
                      : <span style={{ fontFamily: UI, fontSize: '12px', color: INK3 }}>persönlich{v.codeHint ? ` · endet auf ${v.codeHint}` : ''}</span>}
                    {(() => {
                      const st = v.status ?? (v.active ? 'active' : 'inactive');
                      const on = st === 'active';
                      const word = { active: 'aktiv', inactive: 'deaktiviert', expired: 'Frist vorbei', exhausted: 'ausgeschöpft' }[st];
                      return <span data-status={st} style={{ fontFamily: UI, fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: on ? 'oklch(0.93 0.06 150)' : 'oklch(0.93 0.004 264)', color: on ? 'oklch(0.36 0.11 150)' : INK2 }}>{word}</span>;
                    })()}
                  </div>
                  <div style={{ fontFamily: UI, fontSize: '12.5px', color: INK2, marginTop: '3px', lineHeight: 1.5 }}>
                    {v.kind === 'lifetime' ? 'dauerhafter Gratiszugang' : `${daysWord(v.days ?? 0)} je Einlösung`}
                    {' · '}<span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.maxRedemptions == null ? `${v.redemptions} Einlösungen, ohne Gesamtlimit` : `${v.redemptions}/${limit} Einlösungen`}</span>
                    {v.redeemUntil ? ` · einlösbar bis ${dateDe(v.redeemUntil)}` : ''}
                    {v.campaign ? ` · Kampagne „${v.campaign}"` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button type="button" style={btn} aria-expanded={openRed === id} onClick={() => showRedemptions(id)}>Einlösungen</button>
                    {v.distribution === 'public' && v.code && <button type="button" style={btn} aria-expanded={noticeFor === id} onClick={() => setNoticeFor(noticeFor === id ? null : id)}>Aktionshinweis</button>}
                    {v.active && asking !== id && <button type="button" style={{ ...btn, color: '#a52a1d' }} onClick={() => setAsking(id)}>Deaktivieren …</button>}
                  </div>
                  {asking === id && (
                    <div role="group" aria-label={`${v.name} deaktivieren`} style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '8px', background: '#fff6f4', border: '1px solid #f0c8c0' }}>
                      <p style={{ margin: 0, fontFamily: UI, fontSize: '12.5px', color: INK, lineHeight: 1.5 }}>Neue Einlösungen sind dann nicht mehr möglich. Bereits gewährte Zugänge bleiben bestehen.</p>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <button type="button" style={{ ...btnPrimary, background: '#a52a1d' }} onClick={() => deactivate(v)} data-confirm-deactivate>Deaktivieren</button>
                        <button type="button" style={btn} onClick={() => setAsking(null)}>Abbrechen</button>
                      </div>
                    </div>
                  )}
                  {noticeFor === id && <div style={{ marginTop: '8px' }}><NoticeBox v={v} onCopied={setStatus} /></div>}
                  {openRed === id && <RedemptionList rows={redemptions[id]} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <StatsBox stats={stats} vouchers={vouchers} />
    </div>
  );
}

function NoticeBox({ v, onCopied }: { v: AdminVoucher; onCopied: (m: string) => void }) {
  const id = useId();
  const text = actionNotice(v);
  return (
    <div data-action-notice>
      <label htmlFor={id} style={label}>Aktionshinweis zum Kopieren (wird nicht automatisch veröffentlicht)</label>
      <textarea id={id} readOnly value={text} rows={4} style={{ ...input, minHeight: '96px', resize: 'vertical', lineHeight: 1.5 }} onFocus={e => e.currentTarget.select()} />
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
        <CopyButton text={text} label="Hinweis kopieren" onCopied={onCopied} />
        <CopyButton text={redeemAddress(v.redeemUrl)} label="Einlöseadresse kopieren" onCopied={onCopied} />
        {v.code && <CopyButton text={v.code} label="Code kopieren" onCopied={onCopied} />}
      </div>
      <p style={hint}>Einlöseadresse ohne Code: <code>{redeemAddress(v.redeemUrl)}</code></p>
    </div>
  );
}

function RedemptionList({ rows }: { rows: AdminRedemption[] | 'err' | undefined }) {
  if (rows === undefined) return <p style={hint} role="status">Wird geladen …</p>;
  if (rows === 'err') return <p style={{ ...hint, color: '#a52a1d' }}>Die Einlösungen ließen sich nicht laden.</p>;
  if (!rows.length) return <p style={hint}>Noch keine Einlösungen.</p>;
  return (
    <div style={{ overflowX: 'auto', marginTop: '8px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: UI, fontSize: '12.5px' }}>
        <caption style={{ ...hint, textAlign: 'left', marginBottom: '4px' }}>Einlösungen, ohne E-Mail-Adressen</caption>
        <thead><tr>
          <th scope="col" style={{ textAlign: 'left', padding: '4px 6px', color: INK2 }}>Zeit</th>
          <th scope="col" style={{ textAlign: 'left', padding: '4px 6px', color: INK2 }}>Konto</th>
          <th scope="col" style={{ textAlign: 'left', padding: '4px 6px', color: INK2 }}>Gewährt bis</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>{dateTimeDe(r.redeemedAt)}</td>
              <td style={{ padding: '4px 6px' }}>{r.account ? <code>{r.account}</code> : 'Konto gelöscht'}</td>
              <td style={{ padding: '4px 6px' }}>{r.kind === 'lifetime' || !r.grantedUntil ? 'dauerhaft' : dateDe(r.grantedUntil)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsBox({ stats, vouchers }: { stats: VoucherStats | null; vouchers: AdminVoucher[] }) {
  const th: React.CSSProperties = { textAlign: 'right', fontWeight: 700, fontSize: '11px', color: INK2, padding: '6px 8px', borderBottom: `1px solid ${HAIR}`, whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { textAlign: 'right', fontSize: '12.5px', color: INK, padding: '6px 8px', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid oklch(0.95 0.004 264)' };
  const rows = stats?.campaigns ?? [];
  const nameOf = (id: string | number | null | undefined) => vouchers.find(v => String(v.id) === String(id))?.name ?? `Gutschein ${id}`;
  const dash = (n: number | null | undefined) => (n == null ? '–' : n);
  const kinds = stats?.byKind ? (['days', 'lifetime'] as const).filter(k => (stats.byKind?.[k]?.redemptions ?? 0) > 0) : [];
  return (
    <section aria-labelledby="adm-v-stats" style={{ ...card, padding: '12px 0 6px' }} data-voucher-stats>
      <h3 id="adm-v-stats" style={{ margin: '0 14px 2px', fontSize: '13.5px', fontWeight: 700, fontFamily: UI, color: INK }}>Kennzahlen Gutscheine</h3>
      <p style={{ ...hint, margin: '0 14px 8px' }}>Kein Umsatz: Kostenlose Gutscheine erzeugen keine Zahlung und keine Rechnung und stehen nicht in der Auswertung Bezahlung. Gezählt wird aggregiert aus Berechtigungs- und Zahlungsdaten, ohne Codes und E-Mail-Adressen.</p>
      {stats === null ? <p style={{ ...hint, margin: '0 14px 8px' }}>Kennzahlen ließen sich nicht laden.</p>
        : rows.length === 0 ? <p style={{ ...hint, margin: '0 14px 8px' }}>Noch keine Einlösungen.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: UI }}>
              <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Gutschein-Kennzahlen je Kampagne und Zugangsart</caption>
              <thead><tr>
                <th scope="col" style={{ ...th, textAlign: 'left', paddingLeft: '14px' }}>Kampagne</th>
                <th scope="col" style={{ ...th, textAlign: 'left' }}>Zugangsart</th>
                <th scope="col" style={th}>Einlösungen</th>
                <th scope="col" style={th} title="Konten, die danach mindestens eine Pass-Funktion genutzt haben">Pass genutzt</th>
                <th scope="col" style={th} title="Konten mit freiwilligem Kauf nach einem Zeitgutschein (bestätigte Zahlung)">Käufer</th>
                <th scope="col" style={th} title="Bestellungen mit bestätigter Zahlung">Käufe</th>
                <th scope="col" style={th} title="davon widerrufen oder erstattet">Erstattet</th>
                <th scope="col" style={{ ...th, paddingRight: '14px' }} title="Käufer je Einlösung, nur Zeitgutscheine">Quote</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 400, paddingLeft: '14px' }}>{r.campaign || `${nameOf(r.voucherId)} (ohne Kampagne)`}</th>
                    <td style={{ ...td, textAlign: 'left' }}>{r.kind === 'lifetime' ? 'dauerhaft' : 'Zeitgutschein'}</td>
                    <td style={td}>{r.redemptions}</td>
                    <td style={td}>{r.usedPassFeature}</td>
                    <td style={td}>{dash(r.buyers)}</td>
                    <td style={td}>{dash(r.purchases)}</td>
                    <td style={td}>{dash(r.refundedPurchases)}</td>
                    <td style={{ ...td, paddingRight: '14px' }}>{r.conversionPercent == null ? '–' : `${String(r.conversionPercent).replace('.', ',')} %`}</td>
                  </tr>
                ))}
                {kinds.map(k => {
                  const x = stats!.byKind![k];
                  return (
                    <tr key={`sum-${k}`} style={{ background: 'oklch(0.97 0.004 264)' }}>
                      <th scope="row" style={{ ...td, textAlign: 'left', fontWeight: 700, paddingLeft: '14px' }}>Summe</th>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{k === 'lifetime' ? 'dauerhaft' : 'Zeitgutschein'}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{x.redemptions}</td>
                      <td style={td}>{x.usedPassFeature}</td>
                      <td style={td}>{dash(x.buyers)}</td>
                      <td style={td}>{dash(x.purchases)}</td>
                      <td style={td}>{dash(x.refundedPurchases)}</td>
                      <td style={{ ...td, paddingRight: '14px' }}>{x.conversionPercent == null ? '–' : `${String(x.conversionPercent).replace('.', ',')} %`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      <ul style={{ ...hint, margin: '6px 14px 4px', paddingLeft: '16px' }}>
        {(stats?.notes?.length ? stats.notes : ['Dauerhafte Zugänge zählen nicht bei den Käufen.', 'Einmal je Konto heißt nicht einmal je Mensch.']).map(n => <li key={n}>{n}</li>)}
      </ul>
    </section>
  );
}

function CreateForm({ campaigns, onCreated, onError }: {
  campaigns: string[];
  onCreated: (r: { codes?: string[]; voucher?: AdminVoucher }) => void;
  onError: (m: string | null) => void;
}) {
  const [distribution, setDistribution] = useState<'personal' | 'public'>('personal');
  const [name, setName] = useState('');
  const [campaignSel, setCampaignSel] = useState('');
  const [campaignNew, setCampaignNew] = useState('');
  const [kind, setKind] = useState<'days' | 'lifetime'>('days');
  const [days, setDays] = useState('30');
  const [count, setCount] = useState('1');
  const [perCode, setPerCode] = useState('1');
  const [code, setCode] = useState('');
  const [limitMode, setLimitMode] = useState<'limited' | 'unlimited'>('limited');
  const [limit, setLimit] = useState('100');
  const [confirmUnlimited, setConfirmUnlimited] = useState(false);
  const [redeemUntil, setRedeemUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  // Standards aus dem Auftrag beim Wechsel: öffentlich = 30 Tage, Limit 100;
  // öffentlich dauerhaft = Limit Pflicht (ohne Vorbelegung); persönlich = 1.
  function pickDistribution(d: 'personal' | 'public') {
    setDistribution(d);
    setLimitMode('limited'); setConfirmUnlimited(false);
    if (d === 'public') { setLimit(kind === 'lifetime' ? '' : '100'); if (kind === 'days') setDays('30'); }
  }
  function pickKind(k: 'days' | 'lifetime') {
    setKind(k);
    if (distribution === 'public') { setLimitMode('limited'); setConfirmUnlimited(false); setLimit(k === 'lifetime' ? '' : '100'); }
  }

  const campaign = campaignSel === '__new' ? campaignNew.trim() : campaignSel;
  const nDays = parseInt(days, 10);
  const nCount = parseInt(count, 10);
  const nPer = parseInt(perCode, 10);
  const nLimit = limit.trim() ? parseInt(limit, 10) : NaN;
  const normalized = normCode(code);

  const issues = useMemo(() => {
    const p: string[] = [];
    if (!name.trim()) p.push('Interner Name fehlt.');
    if (kind === 'days' && (!Number.isInteger(nDays) || nDays < 1 || nDays > 3650)) p.push('Dauer: 1 bis 3650 Tage.');
    if (campaignSel === '__new' && !campaignNew.trim()) p.push('Name der neuen Kampagne fehlt.');
    if (distribution === 'personal') {
      if (!Number.isInteger(nCount) || nCount < 1 || nCount > 100) p.push('Anzahl Codes: 1 bis 100.');
      if (!Number.isInteger(nPer) || nPer < 1 || nPer > 1000) p.push('Einlösungen je Code: 1 bis 1000.');
    } else {
      if (!/^[A-Z0-9]{4,32}$/.test(normalized)) p.push('Code: 4 bis 32 Zeichen, nur A–Z und 0–9 (Leerzeichen und Bindestriche fallen weg).');
      if (!redeemUntil) p.push('Einlösefrist fehlt – bei öffentlichen Codes Pflicht.');
      else if (redeemUntil < todayIso()) p.push('Einlösefrist liegt in der Vergangenheit.');
      if (limitMode === 'limited' && (!Number.isInteger(nLimit) || nLimit < 1 || nLimit > 100000)) p.push(kind === 'lifetime' ? 'Gesamtlimit fehlt – bei dauerhaften Aktionen Pflicht.' : 'Gesamtlimit: 1 bis 100000.');
      if (limitMode === 'unlimited' && !confirmUnlimited) p.push('„Ohne Gesamtlimit" bitte ausdrücklich bestätigen.');
    }
    return p;
  }, [name, kind, nDays, campaignSel, campaignNew, distribution, nCount, nPer, normalized, redeemUntil, limitMode, nLimit, confirmUnlimited]);

  const sentence = summarySentence({
    distribution, kind, days: Number.isInteger(nDays) ? nDays : 0, count: Number.isInteger(nCount) ? nCount : 1, perCode: Number.isInteger(nPer) ? nPer : 1,
    limitMode, limit: Number.isInteger(nLimit) ? nLimit : null, redeemUntil, campaign,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setProblems(issues);
    if (issues.length) return;
    onError(null);
    setBusy(true);
    const body: CreateVoucherInput = {
      name: name.trim(), distribution, kind,
      ...(kind === 'days' ? { days: nDays } : {}),
      ...(campaign ? { campaign } : {}),
      maxRedemptions: distribution === 'personal' ? nPer : limitMode === 'unlimited' ? null : nLimit,
      ...(distribution === 'public' ? { code: normalized, redeemUntil } : { count: nCount }),
      ...(distribution === 'public' && limitMode === 'unlimited' ? { confirmUnlimited: true as const } : {}),
    };
    try {
      const r = await voucherApi.create(body);
      onCreated(r);
      setName(''); setCode(''); setRedeemUntil(''); setConfirmUnlimited(false); setProblems([]);
    } catch (ex) { onError(ex instanceof Error ? ex.message : 'Anlegen fehlgeschlagen.'); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="adm-v-new" style={{ ...card, marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }} data-voucher-form>
      <h3 id="adm-v-new" style={{ margin: 0, fontSize: '14px', fontFamily: UI, color: INK }}>Neuer Gutschein</h3>

      <fieldset style={fieldset}>
        <legend style={label}>Verteilart</legend>
        <div style={radioRow}>
          <label style={radioLbl(distribution === 'personal')}><input type="radio" name="adm-v-dist" checked={distribution === 'personal'} onChange={() => pickDistribution('personal')} /> Persönlich (zufällige Einzelcodes)</label>
          <label style={radioLbl(distribution === 'public')}><input type="radio" name="adm-v-dist" checked={distribution === 'public'} onChange={() => pickDistribution('public')} /> Öffentlich (ein Aktionscode für viele)</label>
        </div>
      </fieldset>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <div>
          <label htmlFor="adm-v-name" style={label}>Interner Name</label>
          <input id="adm-v-name" style={input} value={name} onChange={e => setName(e.target.value)} placeholder="z. B. Newsletter Oktober" maxLength={120} />
        </div>
        <div>
          <label htmlFor="adm-v-camp" style={label}>Kampagne (optional)</label>
          <select id="adm-v-camp" style={input} value={campaignSel} onChange={e => setCampaignSel(e.target.value)}>
            <option value="">keine Kampagne</option>
            {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__new">Neue Kampagne …</option>
          </select>
          {campaignSel === '__new' && (
            <>
              <label htmlFor="adm-v-camp-new" style={{ ...label, marginTop: '6px' }}>Name der neuen Kampagne</label>
              <input id="adm-v-camp-new" style={input} value={campaignNew} onChange={e => setCampaignNew(e.target.value)} maxLength={80} />
            </>
          )}
        </div>
      </div>
      <p style={{ ...hint, marginTop: '-6px' }}>Codes derselben Kampagne kann jedes Konto zusammen nur einmal einlösen. Die Zuordnung ist nach der ersten Einlösung fest.</p>

      <fieldset style={fieldset}>
        <legend style={label}>Zugangsart</legend>
        <div style={radioRow}>
          <label style={radioLbl(kind === 'days')}><input type="radio" name="adm-v-kind" checked={kind === 'days'} onChange={() => pickKind('days')} /> Tage</label>
          <label style={radioLbl(kind === 'lifetime')}><input type="radio" name="adm-v-kind" checked={kind === 'lifetime'} onChange={() => pickKind('lifetime')} /> Dauerhafter Gratiszugang</label>
        </div>
      </fieldset>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
        {kind === 'days' && (
          <div>
            <label htmlFor="adm-v-days" style={label}>Dauer je Einlösung (Tage)</label>
            <input id="adm-v-days" style={input} type="number" inputMode="numeric" min={1} max={3650} value={days} onChange={e => setDays(e.target.value)} />
          </div>
        )}
        {distribution === 'personal' ? (
          <>
            <div>
              <label htmlFor="adm-v-count" style={label}>Anzahl Codes</label>
              <input id="adm-v-count" style={input} type="number" inputMode="numeric" min={1} max={100} value={count} onChange={e => setCount(e.target.value)} />
            </div>
            <div>
              <label htmlFor="adm-v-per" style={label}>Einlösungen je Code</label>
              <input id="adm-v-per" style={input} type="number" inputMode="numeric" min={1} max={1000} value={perCode} onChange={e => setPerCode(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="adm-v-code" style={label}>Aktionscode</label>
              <input id="adm-v-code" style={{ ...input, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '1px' }} value={code} onChange={e => setCode(e.target.value)} autoComplete="off" spellCheck={false} maxLength={48} aria-describedby="adm-v-code-h" />
              <div id="adm-v-code-h" style={hint}>{code ? <>Wird gespeichert als <code>{normalized || '–'}</code></> : 'Frei wählbar, 4–32 Zeichen A–Z, 0–9. Eindeutigkeit prüft der Server.'}</div>
            </div>
            <div>
              <label htmlFor="adm-v-until" style={label}>Einlösbar bis (Pflicht)</label>
              <input id="adm-v-until" style={input} type="date" min={todayIso()} value={redeemUntil} onChange={e => setRedeemUntil(e.target.value)} aria-describedby="adm-v-until-h" />
              <div id="adm-v-until-h" style={hint}>{kind === 'lifetime' ? 'Die Frist begrenzt nur die Einlösung; gewährte Zugänge bleiben.' : 'Begrenzt nur die Einlösung, nicht die gewährten Tage.'}</div>
            </div>
          </>
        )}
      </div>

      {distribution === 'public' && (
        <fieldset style={fieldset}>
          <legend style={label}>Gesamtlimit</legend>
          <div style={{ ...radioRow, alignItems: 'center' }}>
            <label style={radioLbl(limitMode === 'limited')}><input type="radio" name="adm-v-limit" checked={limitMode === 'limited'} onChange={() => { setLimitMode('limited'); setConfirmUnlimited(false); }} /> Begrenzt auf</label>
            <input aria-label="Gesamtlimit (Anzahl Einlösungen)" style={{ ...input, width: '110px' }} type="number" inputMode="numeric" min={1} value={limit}
              onChange={e => { setLimit(e.target.value); setLimitMode('limited'); }} placeholder={kind === 'lifetime' ? 'Pflicht' : ''} />
            <label style={radioLbl(limitMode === 'unlimited')}><input type="radio" name="adm-v-limit" checked={limitMode === 'unlimited'} onChange={() => setLimitMode('unlimited')} /> Ohne Gesamtlimit</label>
          </div>
          {limitMode === 'unlimited' && (
            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '8px', fontFamily: UI, fontSize: '12.5px', color: INK, lineHeight: 1.45, cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmUnlimited} onChange={e => setConfirmUnlimited(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '1px' }} data-confirm-unlimited />
              <span>Ja, ohne Gesamtlimit: Jedes Konto kann bis zum Ende der Frist einmal einlösen{kind === 'lifetime' ? ' und behält den Zugang dauerhaft' : ''}. Missbrauch begrenzen dann nur Bestätigung der E-Mail, Bot-Schutz und Rate-Limits.</span>
            </label>
          )}
        </fieldset>
      )}

      <p data-voucher-summary style={{ margin: 0, padding: '10px 12px', borderRadius: '8px', background: '#fff', border: `1px solid ${HAIR}`, fontFamily: UI, fontSize: '13.5px', color: INK, lineHeight: 1.5 }}>
        {sentence}
      </p>
      {problems.length > 0 && (
        <ul role="alert" style={{ margin: 0, padding: '8px 12px 8px 28px', borderRadius: '8px', background: '#fff0f0', border: '1px solid #f0c0c0', fontFamily: UI, fontSize: '12.5px', color: '#a52a1d' }} data-voucher-problems>
          {problems.map(p => <li key={p}>{p}</li>)}
        </ul>
      )}
      <div>
        <button type="submit" style={btnPrimary} disabled={busy} aria-busy={busy || undefined}>{busy ? 'Wird angelegt …' : distribution === 'personal' ? 'Codes erzeugen' : 'Aktionscode anlegen'}</button>
      </div>
    </form>
  );
}
