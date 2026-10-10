/**
 * E-Mails im Konto (E-Mail-Workflows, 10.10.2026, pdf-service/MAILS.md).
 *
 *  • TipsConsentField: Häkchen „Tipps per E-Mail" im Registrierungsformular,
 *    nicht vorangekreuzt, freiwillig. Wirksam erst nach Bestätigung der
 *    Adresse (Double-Opt-in, der Server sagt es in der Bestätigungsmail).
 *  • MailSettings: Abschnitt „E-Mails" in den Kontoeinstellungen. Tipps
 *    an/aus mit Zeitpunkt und Fassung der Einwilligung, Sprache der Mails,
 *    Hinweis, dass Servicemails zum Vertrag gehören.
 *
 * Lokalmodus ohne Konto: nichts davon, es gibt keine Adresse.
 */
import { useEffect, useId, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { MAILS_I18N, TIPS_CONSENT_VERSION } from '../ui/i18n/mails';
import { ApiError, mailApi, type MailPrefs } from '../data/api';
import { PATHS } from '../billing/route';
import '../billing/billing.css';
import './art9.css';

export { TIPS_CONSENT_VERSION };

/** Häkchen im Registrierungsformular. Gesteuert von außen. */
export function TipsConsentField({ lang, checked, onChange }: { lang: UiLang; checked: boolean; onChange: (v: boolean) => void }) {
  const x = MAILS_I18N[lang];
  const id = useId();
  return (
    <div className="a9-fields" data-tips-fields>
      <label className="bl-check">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} name="tipsConsent"
          aria-describedby={`${id}-hint`} data-tips-checkbox />
        <span>{x.tipsConsent}</span>
      </label>
      <p className="a9-small" id={`${id}-hint`}>
        {x.tipsConsentHint[0]}<a className="bl-link" href={PATHS.privacy} target="_blank" rel="noopener">{x.tipsConsentHint[1]}</a>{x.tipsConsentHint[2]}
      </p>
    </div>
  );
}

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  try { return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(iso)); }
  catch { return iso.slice(0, 10); }
}

const LANGS: UiLang[] = ['de', 'en', 'fr', 'es'];

/** Abschnitt in den Kontoeinstellungen. Lädt seinen Stand selbst. */
export function MailSettings({ lang }: { lang: UiLang }) {
  const x = MAILS_I18N[lang];
  const titleId = useId();
  const langId = useId();
  const [p, setP] = useState<MailPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    let off = false;
    mailApi.get().then(r => { if (!off) setP(r); }).catch(() => { /* Abschnitt bleibt weg */ });
    return () => { off = true; };
  }, []);
  if (!p) return null;

  async function setTips(on: boolean) {
    setBusy(true); setMsg(null);
    try {
      const r = await mailApi.set(on ? { tips: true, version: TIPS_CONSENT_VERSION } : { tips: false });
      setP(r);
      if (!on) setMsg({ text: x.turnedOff });
      else if (r.tips === 'pending') setMsg({ text: r.confirmationSent === false ? x.pendingNotSent : x.pendingSent });
      else setMsg({ text: x.saved });
    } catch (e) {
      setMsg({ text: e instanceof ApiError && e.code === 'consent_version_mismatch' ? x.versionChanged : x.error, error: true });
    } finally { setBusy(false); }
  }
  async function setLang(l: string) {
    setBusy(true); setMsg(null);
    try { setP(await mailApi.set({ lang: l })); setMsg({ text: x.saved }); }
    catch { setMsg({ text: x.error, error: true }); }
    finally { setBusy(false); }
  }

  const checked = p.tips !== 'off';
  const state = p.tips === 'on' ? x.stateOn(fmtDate(p.consentAt, x.dateLocale), p.consentVersion ?? p.version)
    : p.tips === 'pending' ? x.statePending : x.stateOff;

  return (
    <section className="a9-settings" aria-labelledby={titleId} data-mail-settings>
      <h3 id={titleId} className="a9-h">{x.sectionTitle}</h3>
      <p className="a9-small">{x.serviceNote}</p>
      <h4 className="a9-small" style={{ fontWeight: 700, margin: '10px 0 4px' }}>{x.tipsTitle}</h4>
      {p.hasEmail ? (
        <label className="bl-check">
          <input type="checkbox" checked={checked} disabled={busy} onChange={e => void setTips(e.target.checked)} data-tips-toggle />
          <span>{x.tipsConsent}</span>
        </label>
      ) : <p className="a9-small">{x.noEmail}</p>}
      <p className="a9-small" data-tips-state={p.tips}>{state}</p>
      <div className="bl-field" style={{ marginTop: 10 }}>
        <label htmlFor={langId} className="a9-small" style={{ fontWeight: 700 }}>{x.langLabel}</label>
        <select id={langId} className="bl-input" value={p.lang ?? lang} disabled={busy} onChange={e => void setLang(e.target.value)} data-mail-lang>
          {LANGS.map(l => <option key={l} value={l} lang={l}>{x.langNames[l]}</option>)}
        </select>
      </div>
      {msg && <p className={msg.error ? 'bl-error' : 'bl-ok'} role={msg.error ? 'alert' : 'status'}>{msg.text}</p>}
    </section>
  );
}
