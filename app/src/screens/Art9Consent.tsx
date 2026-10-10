/**
 * Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO für besonders geschützte
 * Angaben im Konto (Prüfteam 10.10.2026, Befund D1, Patch P9).
 *
 * Drei Teile, eine Quelle für die Texte (legal/einwilligung.ts):
 *  • Art9ConsentFields — Block im Registrierungsformular (Kurztext, „Was das
 *    heißt" zum Aufklappen, Häkchen, nicht vorangekreuzt).
 *  • Art9ConsentGate — Dialog für Konten ohne gültige Einwilligung (Bestand
 *    bei der nächsten Anmeldung, neue Textfassung). „Jetzt nicht" schließt
 *    ihn für diese Sitzung; dann erklärt ein Band, warum nichts gespeichert
 *    wird. Durchgesetzt wird am Server (403 `art9_consent_required`).
 *  • Art9ConsentSettings — Stand und Widerruf in den Kontoeinstellungen.
 *    Widerruf löscht nichts automatisch, die Folgen stehen davor da.
 *
 * Der Lokalmodus ist davon nicht berührt: Ohne Konto gibt es kein `user`.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import type { AuthUser } from '../data/api';
import { api, art9Of, consentApi } from '../data/api';
import { art9Texts, ART9_CONSENT_VERSION } from '../legal/einwilligung';
import { PATHS } from '../billing/route';
import '../billing/billing.css';
import './art9.css';

const DISMISS_KEY = 'cv.art9.later';
/** Ereignis, mit dem die Kontoeinstellungen der App den neuen Stand melden
 *  (das Tor in App.tsx übernimmt ihn per onUser — ohne weitere Verdrahtung). */
const CHANGED_EVENT = 'cv:art9-changed';
function announce(u: AuthUser) {
  try { window.dispatchEvent(new CustomEvent<AuthUser>(CHANGED_EVENT, { detail: u })); } catch { /* alter Browser */ }
}

function readDismissed(): boolean {
  try { return window.sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}
function writeDismissed(v: boolean) {
  try { if (v) window.sessionStorage.setItem(DISMISS_KEY, '1'); else window.sessionStorage.removeItem(DISMISS_KEY); } catch { /* privates Fenster */ }
}

function fmtDate(iso: string | null, lang: UiLang): string {
  if (!iso) return '';
  const locale = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' }[lang] ?? 'de-DE';
  try { return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(iso)); }
  catch { return iso.slice(0, 10); }
}

function PrivacyLine({ lang }: { lang: UiLang }) {
  const x = art9Texts(lang);
  return (
    <p className="a9-small">
      {x.privacyLink[0]}<a className="bl-link" href={PATHS.privacy} target="_blank" rel="noopener">{x.privacyLink[1]}</a>{x.privacyLink[2]}
    </p>
  );
}

/** Ausführlicher Text (alle Absätze). */
function Art9Body({ lang }: { lang: UiLang }) {
  const x = art9Texts(lang);
  return <div className="a9-body">{x.paragraphs.map(p => <p key={p.slice(0, 24)}>{p}</p>)}</div>;
}

/** Hinweis unter dem Registrieren-Knopf (P8): AGB und Datenschutz gelten. */
export function RegisterNotice({ lang }: { lang: UiLang }) {
  const n = art9Texts(lang).registerNotice;
  return (
    <p className="a9-small a9-register-notice" data-register-notice>
      {n[0]}<a className="bl-link" href={PATHS.terms} target="_blank" rel="noopener">{n[1]}</a>{n[2]}
      <a className="bl-link" href={PATHS.privacy} target="_blank" rel="noopener">{n[3]}</a>{n[4]}
    </p>
  );
}

/** Block im Registrierungsformular. Gesteuert von außen. */
export function Art9ConsentFields({ lang, checked, onChange, invalid }: {
  lang: UiLang; checked: boolean; onChange: (v: boolean) => void; invalid?: boolean;
}) {
  const x = art9Texts(lang);
  const id = useId();
  return (
    <div className="a9-fields" data-art9-fields>
      <p className="a9-small" id={`${id}-lead`}>{x.registerLead}</p>
      <details className="a9-more">
        <summary>{x.registerMore}</summary>
        <h3 className="a9-h">{x.title}</h3>
        <Art9Body lang={lang} />
        <PrivacyLine lang={lang} />
      </details>
      <label className="bl-check" data-invalid={invalid || undefined}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} name="art9Consent"
          aria-describedby={`${id}-lead`} data-art9-checkbox />
        <span>{x.checkbox}</span>
      </label>
    </div>
  );
}

/** Dialog mit Text, Häkchen und Knopf. Gibt bei Erfolg den neuen Nutzer zurück. */
function ConsentDialog({ lang, onDone, onLater }: {
  lang: UiLang; onDone: (u: AuthUser) => void; onLater: () => void;
}) {
  const x = art9Texts(lang);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => { ref.current?.focus(); }, []);
  async function accept() {
    if (busy) return;
    if (!checked) { setErr(x.errCheckbox); return; }
    setBusy(true); setErr(null);
    try {
      const r = await consentApi.art9(true, ART9_CONSENT_VERSION);
      onDone(r.user);
    } catch { setErr(x.errSave); }
    finally { setBusy(false); }
  }
  return (
    <div className="bl-scrim ui" data-art9-dialog>
      <div ref={ref} tabIndex={-1} className="bl-dialog a9-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}
        onKeyDown={e => { if (e.key === 'Escape') onLater(); }}>
        <h2 id={titleId} className="bl-h3">{x.title}</h2>
        <Art9Body lang={lang} />
        <label className="bl-check" data-invalid={(!!err && !checked) || undefined}>
          <input type="checkbox" checked={checked} onChange={e => { setChecked(e.target.checked); if (e.target.checked) setErr(null); }} data-art9-checkbox />
          <span>{x.checkbox}</span>
        </label>
        <PrivacyLine lang={lang} />
        {err && <p className="bl-error" role="alert">{err}</p>}
        <div className="bl-actions a9-actions">
          <button type="button" className="ui-btn ui-btn-soft" onClick={onLater} data-art9-later>{x.later}</button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={accept} disabled={busy} aria-busy={busy || undefined} data-art9-accept>
            {busy ? x.busy : x.accept}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Dialog bzw. Band für Konten ohne gültige Einwilligung. Nichts im
 * Lokalmodus (user = null) und nichts, wenn der Dienst die Einwilligung nicht
 * verlangt (Feld fehlt oder required = false).
 */
export function Art9ConsentGate({ user, lang, onUser }: {
  user: AuthUser | null; lang: UiLang; onUser: (u: AuthUser) => void;
}) {
  const info = art9Of(user);
  const missing = !!user && !!info && info.required && !info.ok;
  /* „Jetzt nicht" gilt für diese Sitzung (sessionStorage); dann steht statt
   * des Dialogs ein Band mit dem Weg zurück. */
  const [dismissed, setDismissed] = useState(readDismissed);
  useEffect(() => {
    const on = (e: Event) => { const u = (e as CustomEvent<AuthUser>).detail; if (u && typeof u === 'object') onUser(u); };
    window.addEventListener(CHANGED_EVENT, on);
    return () => window.removeEventListener(CHANGED_EVENT, on);
  }, [onUser]);
  if (!missing) return null;
  const x = art9Texts(lang);
  return dismissed ? (
    <div className="bl-band ui" role="status" data-noprint data-band="art9">
      <span>{x.bannerText}</span>
      <button type="button" className="ui-btn ui-btn-soft" onClick={() => { writeDismissed(false); setDismissed(false); }}>{x.bannerAction}</button>
    </div>
  ) : (
    <ConsentDialog lang={lang}
      onDone={u => { writeDismissed(false); onUser(u); }}
      onLater={() => { writeDismissed(true); setDismissed(true); }} />
  );
}

/** Stand und Widerruf in den Kontoeinstellungen. Ohne `user` lädt der Block
 *  den Stand selbst (/api/auth/me); Änderungen gehen per Ereignis an die App. */
export function Art9ConsentSettings({ user: given, lang, onUser }: {
  user?: AuthUser | null; lang: UiLang; onUser?: (u: AuthUser) => void;
}) {
  const [loaded, setLoaded] = useState<AuthUser | null>(null);
  useEffect(() => {
    if (given !== undefined) return;
    let off = false;
    api.me().then(r => { if (!off) setLoaded(r.user); }).catch(() => {});
    return () => { off = true; };
  }, [given]);
  const user = given !== undefined ? given : loaded;
  const update = (u: AuthUser) => { setLoaded(u); onUser?.(u); announce(u); };
  const info = art9Of(user);
  const x = art9Texts(lang);
  const [confirming, setConfirming] = useState(false);
  const [giving, setGiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const titleId = useId();
  if (!user || !info || !info.required) return null;
  async function withdraw() {
    setBusy(true); setMsg(null);
    try {
      const r = await consentApi.art9(false, info!.version);
      setConfirming(false);
      setMsg({ text: x.withdrawn });
      update(r.user);
    } catch { setMsg({ text: x.errSave, error: true }); }
    finally { setBusy(false); }
  }
  return (
    <section className="a9-settings" aria-labelledby={titleId} data-art9-settings>
      <h3 id={titleId} className="a9-h">{x.settingsTitle}</h3>
      <p className="a9-small" data-art9-state={info.ok ? 'given' : 'missing'}>
        {info.ok ? x.settingsGiven(fmtDate(info.givenAt, lang), info.givenVersion ?? info.version) : x.settingsMissing}
      </p>
      {msg && <p className={msg.error ? 'bl-error' : 'bl-ok'} role={msg.error ? 'alert' : 'status'}>{msg.text}</p>}
      {info.ok && !confirming && (
        <button type="button" className="ui-btn ui-btn-soft" onClick={() => { setConfirming(true); setMsg(null); }} data-art9-withdraw>{x.settingsWithdraw}</button>
      )}
      {info.ok && confirming && (
        <div className="a9-confirm" role="group" aria-label={x.withdrawConfirmTitle}>
          <strong>{x.withdrawConfirmTitle}</strong>
          {x.withdrawConfirmText.map(p => <p key={p.slice(0, 24)} className="a9-small">{p}</p>)}
          <div className="a9-actions">
            <button type="button" className="ui-btn ui-btn-soft" onClick={() => setConfirming(false)} disabled={busy}>{x.withdrawCancel}</button>
            <button type="button" className="ui-btn ui-btn-primary" onClick={withdraw} disabled={busy} aria-busy={busy || undefined} data-art9-withdraw-confirm>
              {busy ? x.busy : x.withdrawConfirm}
            </button>
          </div>
        </div>
      )}
      {!info.ok && (
        <button type="button" className="ui-btn ui-btn-primary" onClick={() => setGiving(true)} data-art9-give>{x.settingsGive}</button>
      )}
      {giving && (
        <ConsentDialog lang={lang}
          onDone={u => { setGiving(false); writeDismissed(false); setMsg(null); update(u); }}
          onLater={() => setGiving(false)} />
      )}
    </section>
  );
}
