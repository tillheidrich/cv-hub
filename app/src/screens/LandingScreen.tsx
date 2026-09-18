import { useEffect, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { api } from '../data/api';
import { track } from '../data/track';
import './landing.css';

interface Props {
  onSignIn: () => void;
  onDemoStart: () => void;
  lang: UiLang;
  onLangChange: (l: UiLang) => void;
  onLegal?: (page: 'impressum' | 'privacy') => void;
}

/**
 * Editorial Landing Page — Newsreader-Serif, blush paper, pure black ink,
 * editorial blue + line-art green Akzente. Komplette Stil-Übernahme aus
 * Till's "Lebenslauf-Tool Design.zip" als externes CSS-Modul (landing.css)
 * mit `lp-`-Prefix damit App-Chrome NICHT überschrieben wird.
 *
 * Sektionen folgen der Vorlage 1:1:
 *   Nav · Hero (centered, huge serif) · Stats · Manifesto (dark band)
 *   · Features (zigzag) · Templates-Gallery · Steps · FAQ · Footer
 *
 * Bewusst NICHT übernommen: das Editor-spezifische Akzent-Brown — die
 * Landing spricht editorial-blue, der Editor spricht weiter Terracotta.
 * Der Bruch ist beabsichtigt: Marketing-Seite ≠ App-Chrome.
 */
export default function LandingScreen({ onSignIn, onDemoStart, lang, onLangChange, onLegal }: Props) {
  /* Smooth-Scroll für die internen #vorlagen/#funktion/#faq-Anchor */
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => { html.style.scrollBehavior = prev; };
  }, []);

  const t = COPY[lang] ?? DE;
  const [requestOpen, setRequestOpen] = useState(false);
  const openRequest = () => { track('request_open'); setRequestOpen(true); };
  const goSignIn = () => { track('signin_click'); onSignIn(); };
  const startDemo = () => { track('demo_start'); onDemoStart(); };
  const scrollTo = (id: string) => () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="lp-root">
      {/* NAV */}
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <button type="button" className="lp-brand" onClick={scrollTo('lp-top')} aria-label="Startseite">
            <Mark />
            <span className="lp-word">Heidrich<span className="lp-sub">/cv</span></span>
          </button>
          <nav className="lp-nav-links" aria-label="Hauptnavigation">
            <button type="button" onClick={scrollTo('vorlagen')}>{t.nav.templates}</button>
            <button type="button" onClick={scrollTo('funktion')}>{t.nav.howItWorks}</button>
            <button type="button" onClick={scrollTo('faq')}>{t.nav.faq}</button>
          </nav>
          <div className="lp-lang-row">
            {LANG_ORDER.map(l => (
              <button key={l} type="button" className={lang === l ? 'is-on' : ''} onClick={() => onLangChange(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <div className="lp-nav-actions">
            <button type="button" className="lp-signin" onClick={goSignIn}>{t.nav.signin}</button>
            <button type="button" className="lp-btn" onClick={openRequest}>{t.nav.cta}</button>
          </div>
        </div>
      </header>

      <main id="lp-top">

        {/* HERO */}
        <section className="lp-hero">
          <div className="lp-wrap">
            <svg className="lp-glyph" viewBox="0 0 78 78" fill="none" aria-hidden>
              <rect x="14" y="6" width="38" height="52" strokeWidth="1.4"></rect>
              <rect x="26" y="20" width="38" height="52" strokeWidth="1.4"></rect>
              <line x1="32" y1="32" x2="58" y2="32" strokeWidth="1.4"></line>
              <line x1="32" y1="40" x2="58" y2="40" strokeWidth="1.4"></line>
              <line x1="32" y1="48" x2="50" y2="48" strokeWidth="1.4"></line>
            </svg>
            <p className="lp-eyebrow lp-hero-eyebrow">
              {t.hero.eyebrow.split(' · ').map((part, i, arr) => (
                <span key={i}>{part}{i < arr.length - 1 && <span className="lp-dot"> · </span>}</span>
              ))}
            </p>
            <h1 className="lp-display">{t.hero.h1a} <span className="lp-italic lp-accent-text">{t.hero.h1b}</span></h1>
            <p className="lp-lede">{t.hero.lede}</p>
            <div className="lp-cta">
              <button type="button" className="lp-btn" onClick={startDemo}>{t.hero.ctaPrimary}</button>
              <button type="button" className="lp-link-arrow" onClick={scrollTo('vorlagen')}>
                {t.hero.ctaSecondary}
                <svg viewBox="0 0 46 12" fill="none" aria-hidden>
                  <line x1="0" y1="6" x2="44" y2="6" strokeWidth="1.4"></line>
                  <path d="M38 1 L44 6 L38 11" strokeWidth="1.4"></path>
                </svg>
              </button>
            </div>
          </div>
        </section>

        <hr className="lp-rule" />

        {/* STATS */}
        <section className="lp-stats" aria-label={t.stats.label}>
          <div className="lp-wrap">
            <div className="lp-stats-grid">
              {t.stats.items.map((s, i) => (
                <div key={i} className="lp-stat">
                  <div className="lp-num"><span className="lp-mk">{s.mark}</span>{s.value}</div>
                  <div className="lp-lab">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MANIFESTO */}
        <section className="lp-manifesto">
          <div className="lp-wrap">
            <p className="lp-eyebrow">{t.manifesto.eyebrow.split(' · ').map((part, i, arr) => (
              <span key={i}>{part}{i < arr.length - 1 && <span className="lp-dot"> · </span>}</span>
            ))}</p>
            <h2>{t.manifesto.h1} <span className="lp-g">{t.manifesto.h2}</span> {t.manifesto.h3}</h2>
            <p className="lp-sig">{t.manifesto.sig}</p>
          </div>
        </section>

        {/* ATS EXPLAINER */}
        <section className="lp-ats" id="ats">
          <div className="lp-wrap">
            <div className="lp-sect-head">
              <p className="lp-eyebrow">{t.ats.eyebrow.split(' · ').map((part, i, arr) => (
                <span key={i}>{part}{i < arr.length - 1 && <span className="lp-dot"> · </span>}</span>
              ))}</p>
              <h2>{t.ats.h}</h2>
            </div>
            <p className="lp-ats-intro">{t.ats.intro}</p>
            <div className="lp-ats-facts">
              {t.ats.facts.map((f, i) => (
                <div key={i} className="lp-ats-fact">
                  <div className="lp-ats-num">{f.value}</div>
                  <p className="lp-ats-claim">{f.label}</p>
                  <p className="lp-ats-src">{f.src}</p>
                </div>
              ))}
            </div>
            <div className="lp-ats-notes">
              <div className="lp-ats-note">
                <h3>{t.ats.biasTitle}</h3>
                <p>{t.ats.bias}</p>
              </div>
              <div className="lp-ats-note">
                <h3>{t.ats.mythTitle}</h3>
                <p>{t.ats.myth}</p>
              </div>
            </div>
            <div className="lp-ats-sources">
              <span className="lp-ats-src-lab">{t.ats.sourcesLabel}</span>
              <ul>
                {t.ats.sources.map((s, i) => (
                  <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.label}</a></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="lp-features">
          <div className="lp-wrap">
            <div className="lp-sect-head">
              <p className="lp-eyebrow">{t.features.eyebrow.split(' · ').map((part, i, arr) => (
                <span key={i}>{part}{i < arr.length - 1 && <span className="lp-dot"> · </span>}</span>
              ))}</p>
              <h2>{t.features.h}</h2>
            </div>
            <div style={{ marginTop: 'clamp(20px,3vw,40px)' }}>
              {t.features.items.map((f, i) => (
                <article key={i} className="lp-feature">
                  <div className="lp-f-text">
                    <div className="lp-f-no">{f.num} — {f.tag}</div>
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                  <div className="lp-art" aria-hidden>
                    <FeatureArt kind={f.art} />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <hr className="lp-rule" />

        {/* GALLERY */}
        <section className="lp-gallery" id="vorlagen">
          <div className="lp-wrap">
            <div className="lp-sect-head">
              <p className="lp-eyebrow">{t.gallery.eyebrow.split(' · ').map((part, i, arr) => (
                <span key={i}>{part}{i < arr.length - 1 && <span className="lp-dot"> · </span>}</span>
              ))}</p>
              <h2>{t.gallery.h}</h2>
            </div>
            <div className="lp-gal-grid">
              {(['single','sidebar','spiegel','band','wien','timeline'] as const).map((variant, i) => (
                <article key={variant} className="lp-tcard">
                  <Sheet variant={variant} />
                  <div className="lp-t-meta">
                    <span className="lp-t-name">{t.gallery.cards[i].name}</span>
                    <span className="lp-t-tag">{t.gallery.cards[i].tag}</span>
                  </div>
                  <p className="lp-t-desc">{t.gallery.cards[i].desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* STEPS */}
        <section className="lp-steps" id="funktion">
          <div className="lp-wrap">
            <div className="lp-sect-head">
              <p className="lp-eyebrow">{t.steps.eyebrow.split(' · ').map((part, i, arr) => (
                <span key={i}>{part}{i < arr.length - 1 && <span className="lp-dot"> · </span>}</span>
              ))}</p>
              <h2>{t.steps.h}</h2>
            </div>
            <div className="lp-steps-grid">
              {t.steps.items.map((s, i) => (
                <div key={i} className="lp-step">
                  <div className="lp-s-no">{s.num}</div>
                  <h4>{s.title}</h4>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr className="lp-rule" />

        {/* FAQ */}
        <section className="lp-faq" id="faq">
          <div className="lp-wrap">
            <div className="lp-sect-head">
              <p className="lp-eyebrow">{t.faq.eyebrow}</p>
              <h2>{t.faq.h}</h2>
            </div>
            <div className="lp-faq-grid">
              {t.faq.items.map((q, i) => (
                <details key={i} className="lp-qa" open={i === 0}>
                  <summary>{q.q} <span className="lp-sign" aria-hidden></span></summary>
                  <div className="lp-ans">{q.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-wrap">
          <h2 className="lp-closing lp-display">{t.footer.closingA} <span className="lp-italic">{t.footer.closingB}</span></h2>
          <div className="lp-cta-links" style={{ paddingTop: 'clamp(40px,5vw,64px)' }}>
            <button type="button" className="lp-link-arrow" onClick={openRequest}>
              {t.footer.cta}
              <svg viewBox="0 0 46 12" fill="none" aria-hidden>
                <line x1="0" y1="6" x2="44" y2="6" strokeWidth="1.4"></line>
                <path d="M38 1 L44 6 L38 11" strokeWidth="1.4"></path>
              </svg>
            </button>
            <button type="button" className="lp-link-arrow" onClick={scrollTo('vorlagen')}>
              {t.footer.cta2}
              <svg viewBox="0 0 46 12" fill="none" aria-hidden>
                <line x1="0" y1="6" x2="44" y2="6" strokeWidth="1.4"></line>
                <path d="M38 1 L44 6 L38 11" strokeWidth="1.4"></path>
              </svg>
            </button>
          </div>
          <div className="lp-footer-marks">
            {t.footer.marks.map(m => <span key={m} className="lp-fm">{m}</span>)}
          </div>
          <div className="lp-footer-bar">
            <button type="button" className="lp-brand" onClick={scrollTo('lp-top')}>
              <Mark />
              <span className="lp-word">Heidrich<span className="lp-sub">/cv</span></span>
            </button>
            <nav className="lp-nav-links" style={{ display: 'flex' }} aria-label="Footer-Navigation">
              <button type="button" onClick={scrollTo('vorlagen')}>{t.nav.templates}</button>
              <button type="button" onClick={scrollTo('funktion')}>{t.nav.howItWorks}</button>
              <button type="button" onClick={scrollTo('faq')}>{t.nav.faq}</button>
              <button type="button" onClick={() => onLegal?.('impressum')}>Impressum</button>
              <button type="button" onClick={() => onLegal?.('privacy')}>{({ de: 'Datenschutz', en: 'Privacy', fr: 'Confidentialité', es: 'Privacidad' } as Record<UiLang, string>)[lang]}</button>
              {/* Der Quelltext ist das stärkste Argument dieser Seite: „self-hosted"
                  behaupten viele, nachlesbar ist es hier. Deshalb in die
                  Fußzeilennavigation und nicht ins Kleingedruckte. */}
              <a href="https://github.com/tillheidrich/cv-hub" target="_blank" rel="noopener noreferrer">{t.nav.source}</a>
            </nav>
            <button type="button" className="lp-btn lp-ghost" onClick={openRequest}>{t.nav.cta}</button>
          </div>
          <div className="lp-footer-meta">
            <span>cv.heidrich-digital.de</span>
            <span>{t.footer.meta}</span>
            <span>© {new Date().getFullYear()} Heidrich Digital</span>
          </div>
        </div>
      </footer>

      {requestOpen && <RequestAccessModal t={t.request} onClose={() => setRequestOpen(false)} />}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function RequestAccessModal({ t, onClose }: { t: typeof DE['request']; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot — bleibt für echte Nutzer leer
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (name.trim().length < 2) { setErr(t.errName); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr(t.errEmail); return; }
    setBusy(true);
    try {
      await api.requestAccess({ name: name.trim(), email: email.trim(), message: message.trim(), website });
      track('request_submit');
      setDone(true);
    } catch { setErr(t.errGeneric); }
    finally { setBusy(false); }
  }

  return (
    <div className="lp-modal-scrim" role="dialog" aria-modal="true" aria-label={t.title} onClick={onClose}>
      <div className="lp-modal" onClick={e => e.stopPropagation()}>
        <button type="button" className="lp-modal-x" onClick={onClose} aria-label={t.close}>×</button>
        {done ? (
          <div className="lp-modal-done">
            <div className="lp-modal-h">{t.successTitle}</div>
            <p className="lp-modal-lede">{t.success}</p>
            <button type="button" className="lp-btn" onClick={onClose}>{t.close}</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="lp-modal-h">{t.title}</div>
            <p className="lp-modal-lede">{t.lede}</p>
            <label className="lp-field"><span>{t.name}</span>
              <input value={name} onChange={e => setName(e.target.value)} autoFocus maxLength={120} /></label>
            <label className="lp-field"><span>{t.email}</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={200} /></label>
            <label className="lp-field"><span>{t.message}</span>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder={t.messagePlaceholder} /></label>
            {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
            <input className="lp-hp" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} aria-hidden="true" />
            {err && <div className="lp-modal-err">{err}</div>}
            <button type="submit" className="lp-btn lp-modal-submit" disabled={busy}>{busy ? `${t.sending}…` : t.submit}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Mark() {
  return (
    <svg className="lp-mark" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect x="3" y="3" width="24" height="24" strokeWidth="1.4"></rect>
      <line x1="15" y1="3" x2="15" y2="27" strokeWidth="1.4"></line>
      <line x1="7" y1="9" x2="11" y2="9" strokeWidth="1.4"></line>
      <line x1="7" y1="13" x2="11" y2="13" strokeWidth="1.4"></line>
      <line x1="7" y1="17" x2="10" y2="17" strokeWidth="1.4"></line>
      <line x1="19" y1="9" x2="23" y2="9" strokeWidth="1.4"></line>
      <line x1="19" y1="13" x2="23" y2="13" strokeWidth="1.4"></line>
      <line x1="19" y1="17" x2="22" y2="17" strokeWidth="1.4"></line>
    </svg>
  );
}

type FeatureArt = 'spreads' | 'autofit' | 'inline' | 'bridge' | 'profiles';
function FeatureArt({ kind }: { kind: FeatureArt }) {
  if (kind === 'spreads') return (
    <svg viewBox="0 0 320 200" fill="none">
      <rect x="40" y="24" width="118" height="152" strokeWidth="1.3" />
      <rect x="162" y="24" width="118" height="152" strokeWidth="1.3" />
      <line x1="60" y1="52" x2="120" y2="52" strokeWidth="1.3" className="lp-b" />
      <line x1="60" y1="68" x2="138" y2="68" strokeWidth="1.3" />
      <line x1="60" y1="80" x2="138" y2="80" strokeWidth="1.3" />
      <line x1="60" y1="92" x2="110" y2="92" strokeWidth="1.3" />
      <line x1="60" y1="120" x2="138" y2="120" strokeWidth="1.3" />
      <line x1="60" y1="132" x2="124" y2="132" strokeWidth="1.3" />
      <line x1="182" y1="52" x2="260" y2="52" strokeWidth="1.3" />
      <line x1="182" y1="64" x2="260" y2="64" strokeWidth="1.3" />
      <line x1="182" y1="76" x2="234" y2="76" strokeWidth="1.3" />
      <line x1="182" y1="104" x2="260" y2="104" strokeWidth="1.3" />
      <line x1="182" y1="116" x2="248" y2="116" strokeWidth="1.3" />
      <line x1="182" y1="128" x2="260" y2="128" strokeWidth="1.3" />
      <line x1="182" y1="140" x2="220" y2="140" strokeWidth="1.3" />
    </svg>
  );
  if (kind === 'autofit') return (
    <svg viewBox="0 0 320 200" fill="none">
      <rect x="110" y="20" width="100" height="160" strokeWidth="1.3" />
      <line x1="100" y1="20" x2="100" y2="34" strokeWidth="1.3" />
      <line x1="100" y1="20" x2="114" y2="20" strokeWidth="1.3" />
      <line x1="220" y1="20" x2="206" y2="20" strokeWidth="1.3" />
      <line x1="220" y1="20" x2="220" y2="34" strokeWidth="1.3" />
      <line x1="100" y1="180" x2="100" y2="166" strokeWidth="1.3" />
      <line x1="100" y1="180" x2="114" y2="180" strokeWidth="1.3" />
      <line x1="220" y1="180" x2="206" y2="180" strokeWidth="1.3" />
      <line x1="220" y1="180" x2="220" y2="166" strokeWidth="1.3" />
      <line x1="126" y1="44" x2="178" y2="44" strokeWidth="1.3" className="lp-b" />
      <line x1="126" y1="62" x2="194" y2="62" strokeWidth="1.3" />
      <line x1="126" y1="72" x2="194" y2="72" strokeWidth="1.3" />
      <line x1="126" y1="82" x2="170" y2="82" strokeWidth="1.3" />
      <line x1="126" y1="108" x2="194" y2="108" strokeWidth="1.3" />
      <line x1="126" y1="118" x2="186" y2="118" strokeWidth="1.3" />
      <line x1="126" y1="128" x2="194" y2="128" strokeWidth="1.3" />
      <path d="M150 150 l8 8 16 -20" strokeWidth="1.4" className="lp-b" />
    </svg>
  );
  if (kind === 'inline') return (
    <svg viewBox="0 0 320 200" fill="none">
      {/* Seite mit einer Zeile, in der geschrieben wird — Rahmen um das Feld,
          Schreibmarke dahinter. Dieselbe Strichstärke und dieselben
          Akzentklassen wie die übrigen Zeichnungen. */}
      <rect x="74" y="28" width="172" height="144" strokeWidth="1.3" />
      <line x1="92" y1="52" x2="160" y2="52" strokeWidth="1.3" />
      <line x1="92" y1="66" x2="132" y2="66" strokeWidth="1.3" className="lp-g" />
      <rect x="88" y="86" width="144" height="22" rx="2" strokeWidth="1.3" className="lp-b" />
      <line x1="98" y1="97" x2="196" y2="97" strokeWidth="1.3" />
      <line x1="204" y1="88" x2="204" y2="106" strokeWidth="1.6" className="lp-g" />
      <line x1="92" y1="126" x2="228" y2="126" strokeWidth="1.3" />
      <line x1="92" y1="140" x2="206" y2="140" strokeWidth="1.3" />
      <line x1="92" y1="154" x2="168" y2="154" strokeWidth="1.3" />
    </svg>
  );
  if (kind === 'bridge') return (
    <svg viewBox="0 0 320 200" fill="none">
      <rect x="36" y="56" width="96" height="100" strokeWidth="1.3" />
      <text x="84" y="116" textAnchor="middle" fontFamily="IBM Plex Mono, monospace" fontSize="34" fill="currentColor">#</text>
      <line x1="190" y1="100" x2="262" y2="100" strokeWidth="1.3" className="lp-g" />
      <path d="M256 94 l8 6 -8 6" strokeWidth="1.3" className="lp-g" />
      <path d="M156 86 l-14 14 14 14" strokeWidth="1.3" />
      <rect x="200" y="64" width="84" height="72" rx="3" strokeWidth="1.3" />
      <line x1="216" y1="84" x2="268" y2="84" strokeWidth="1.3" />
      <line x1="216" y1="98" x2="268" y2="98" strokeWidth="1.3" />
      <line x1="216" y1="112" x2="250" y2="112" strokeWidth="1.3" />
      <circle cx="242" cy="52" r="6" strokeWidth="1.3" className="lp-g" />
    </svg>
  );
  return (
    <svg viewBox="0 0 320 200" fill="none">
      <rect x="150" y="40" width="120" height="130" strokeWidth="1.3" />
      <rect x="135" y="32" width="120" height="130" strokeWidth="1.3" />
      <rect x="120" y="24" width="120" height="130" strokeWidth="1.3" className="lp-b" />
      <circle cx="150" cy="56" r="11" strokeWidth="1.3" />
      <line x1="172" y1="50" x2="222" y2="50" strokeWidth="1.3" />
      <line x1="172" y1="60" x2="208" y2="60" strokeWidth="1.3" />
      <line x1="138" y1="92" x2="222" y2="92" strokeWidth="1.3" />
      <line x1="138" y1="104" x2="222" y2="104" strokeWidth="1.3" />
      <line x1="138" y1="116" x2="200" y2="116" strokeWidth="1.3" />
      <line x1="138" y1="132" x2="222" y2="132" strokeWidth="1.3" />
    </svg>
  );
}

function Sheet({ variant }: { variant: 'single' | 'sidebar' | 'band' | 'wien' | 'timeline' | 'spiegel' }) {
  if (variant === 'single') return (
    <div className="lp-sheet lp-single">
      <div className="lp-name"></div><div className="lp-role"></div>
      <div className="lp-blk"><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div></div>
      <div className="lp-blk"><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div></div>
      <div className="lp-blk"><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div></div>
    </div>
  );
  if (variant === 'sidebar' || variant === 'spiegel') return (
    // Gespiegelt für die rechte Seitenspalte — dasselbe Gerüst, andere Seite.
    // Ein eigenes „Dossier"-Raster stand hier früher, das es im Werkzeug nie
    // gab; sechs Archetypen sollen sechs echte Archetypen zeigen.
    <div
      className="lp-sheet lp-sidebar"
      // Das Blatt ist ein Raster, kein Flex-Container — gespiegelt wird
      // deshalb über die Spaltenbreiten und die Platzierung, nicht über
      // `flex-direction` (das hier folgenlos bliebe).
      style={variant === 'spiegel' ? { gridTemplateColumns: '1fr 34%' } : undefined}
    >
      <div className="lp-rail" style={variant === 'spiegel' ? { gridColumn: 2, gridRow: 1, margin: '-14px -14px -14px 0' } : undefined}><div className="lp-av"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l lp-acc"></div><div className="lp-l"></div><div className="lp-l"></div></div>
      <div className="lp-main" style={variant === 'spiegel' ? { gridColumn: 1, gridRow: 1 } : undefined}><div className="lp-name"></div><div className="lp-role"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div></div>
    </div>
  );
  if (variant === 'band') return (
    <div className="lp-sheet lp-band">
      <div className="lp-top"><div className="lp-n"></div><div className="lp-r"></div></div>
      <div className="lp-body">
        <div className="lp-l lp-ink" style={{ width: '30%' }}></div>
        <div className="lp-l"></div><div className="lp-l"></div>
        <div className="lp-l" style={{ width: '70%' }}></div>
        <div className="lp-l lp-ink" style={{ width: '30%', marginTop: '6px' }}></div>
        <div className="lp-l"></div><div className="lp-l"></div>
      </div>
    </div>
  );
  if (variant === 'wien') return (
    <div className="lp-sheet lp-wien">
      <div className="lp-name"></div><div className="lp-role"></div>
      <div className="lp-div"></div>
      <div className="lp-cols">
        <div><div className="lp-l lp-ink" style={{ width: '50%' }}></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l" style={{ width: '70%' }}></div></div>
        <div><div className="lp-l lp-ink" style={{ width: '50%' }}></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l" style={{ width: '60%' }}></div></div>
      </div>
      <div className="lp-div"></div>
      <div className="lp-l"></div><div className="lp-l" style={{ width: '80%' }}></div>
    </div>
  );
  // Zeitstrahl als letzter Zweig: das „Dossier"-Raster, das hier früher stand,
  // entsprach keinem Archetyp im Werkzeug und war nach der Umstellung auf die
  // sechs echten Archetypen toter Code.
  return (
    <div className="lp-sheet lp-timeline">
      <div className="lp-name"></div>
      <div className="lp-tl">
        <div className="lp-ev"><div className="lp-l lp-ink" style={{ width: '50%' }}></div><div className="lp-l"></div><div className="lp-l" style={{ width: '70%' }}></div></div>
        <div className="lp-ev"><div className="lp-l lp-ink" style={{ width: '50%' }}></div><div className="lp-l"></div><div className="lp-l" style={{ width: '60%' }}></div></div>
        <div className="lp-ev"><div className="lp-l lp-ink" style={{ width: '50%' }}></div><div className="lp-l"></div><div className="lp-l" style={{ width: '65%' }}></div></div>
      </div>
    </div>
  );
}

// ── Content (DE/EN) ────────────────────────────────────────────────────────

const DE = {
  nav: { templates: 'Vorlagen', howItWorks: "So funktioniert's", faq: 'FAQ', cta: 'Zugang anfragen', signin: 'Anmelden', source: 'Quelltext' },
  request: {
    title: 'Zugang anfragen',
    lede: 'Heidrich/cv ist Invite-only. Sag kurz, wer du bist — nach der Freigabe kommt dein Einladungslink per E-Mail.',
    name: 'Name', email: 'E-Mail', message: 'Nachricht (optional)',
    messagePlaceholder: 'Worum geht’s? Wofür möchtest du das Tool nutzen?',
    submit: 'Anfrage senden', sending: 'Senden',
    successTitle: 'Anfrage ist raus.',
    success: 'Danke! Sobald sie freigegeben ist, bekommst du deinen Einladungslink per E-Mail.',
    close: 'Schließen',
    errName: 'Bitte gib deinen Namen an.',
    errEmail: 'Bitte gib eine gültige E-Mail-Adresse an.',
    errGeneric: 'Konnte nicht gesendet werden. Bitte später erneut versuchen.',
  },
  hero: {
    eyebrow: 'ATS-tauglich · Self-hosted · Deine Daten',
    h1a: 'Schöne Lebensläufe scheitern am Bewerbungs-Bot.',
    h1b: 'Deiner nicht.',
    lede: 'Die meisten Lebensläufe liest zuerst eine Maschine — das ATS. Schön gesetzte Word- und Canva-Lebensläufe stolpern darüber. Dieses Tool baut Lebensläufe, die durchkommen: ATS-tauglich und maschinenlesbar, mit Auto-Fit auf A4. Kein teurer Bewerbungsservice, der am Ende auch nur ein PDF abliefert. Selbst gehostet — deine Daten bleiben deine.',
    ctaPrimary: 'Direkt ausprobieren', ctaSecondary: 'Vorlagen ansehen',
  },
  stats: {
    label: 'Zahlen',
    items: [
      { mark: '×', value: '18', label: 'Vorlagen, keine Farbdubletten' },
      { mark: '×', value: '6', label: 'Archetypen, ein System' },
      { mark: '↳', value: 'A4', label: 'Auto-Fit, randscharf' },
      { mark: '·', value: '0', label: 'Tracker, kein Konto-Verkauf' },
    ],
  },
  manifesto: {
    eyebrow: 'Die Haltung · warum es das gibt',
    h1: 'Ein Lebenslauf muss nicht nur gut aussehen — er muss durch den', h2: 'ATS-Filter', h3: 'kommen.',
    sig: '— technisch sauber, nicht nur schön',
  },
  ats: {
    eyebrow: 'Was ist ein ATS · und warum man durchfällt',
    h: 'Bevor ein Mensch deinen Lebenslauf sieht, liest ihn eine Software.',
    intro: 'Ein Applicant Tracking System (ATS) ist die Bewerbungs-Software, die eingehende Lebensläufe automatisch einliest, in Datenfelder zerlegt, nach Schlüsselwörtern durchsucht und die Kandidaten für die Recruiter vorsortiert. Der Haken: Die Software liest ein PDF in der Reihenfolge, in der der Text darin abgelegt ist — nicht in der, in der er auf dem Papier steht. Was in Tabellen, Textboxen oder Grafiken steckt, fehlt ganz. Spalten sind dabei kein Ausschlusskriterium, solange die Reihenfolge stimmt; bei Word- und Canva-Vorlagen stimmt sie meistens nicht.',
    facts: [
      { value: '88 %', label: 'der Arbeitgeber geben selbst an: qualifizierte Bewerber werden vom System aussortiert, weil sie exakte Kriterien nicht wörtlich treffen.', src: 'Harvard Business School & Accenture, „Hidden Workers", 2021' },
      { value: '≥ 15 %', label: 'aller Lebensläufe haben Spalten — sie sind also normal. Der Parser-Hersteller Textkernel kommt damit auf 90 % sauber rekonstruierte Dokumente: jedes zehnte geht trotzdem daneben. Deshalb erzwingt dieses Tool die Lesereihenfolge selbst.', src: 'Textkernel, Extraktion aus Spalten-Lebensläufen, 2023' },
      { value: '≤ 8 pt', label: 'Schriftgrößen unterhalb dieser Grenze nennt Personio ausdrücklich als dokumentierte Ursache für fehlgeschlagenes Einlesen. Hier liegt die Untergrenze bei 8,4 pt — darunter wird keine Zeile gesetzt, lieber kommt eine Seite dazu.', src: 'Personio, Herstellerdokumentation' },
      { value: '0,08 em', label: 'Sperrung ist die Obergrenze für Versalzeilen — selbst gemessen. Ab 0,10 em zerfällt „OBSERVABILITY" in der Textextraktion zu „O B S E R VA B I L I T Y", und genau an diesen Zeilen teilt ein Parser den Lebenslauf in Abschnitte.', src: 'Eigene Messung mit Chromium und Poppler, 09/2026' },
    ],
    biasTitle: 'Und die Maschine ist nicht neutral.',
    bias: 'Amazon musste 2018 sein eigenes KI-Recruiting-Tool abschalten: Es hatte gelernt, Lebensläufe mit dem Wort „women’s" systematisch abzuwerten. Automatische Vorauswahl kann bestehende Verzerrungen verstärken statt sie abzubauen — ein Grund mehr, den Lebenslauf technisch sauber, neutral und nachvollziehbar zu halten.',
    mythTitle: 'Kein Panikmarketing.',
    myth: 'Die viral zitierte Zahl „75 % der Lebensläufe sehen nie ein Mensch" geht auf ein Verkaufsargument der Firma Preptel von etwa 2012 zurück und wurde nie belegt. Die meisten ATS lehnen nicht automatisch ab — sie ranken und sortieren. Deshalb steht hier keine Zahl, die ein Bewerbungs-Tool über die Not seiner Nutzer in Umlauf gebracht hat: zitiert wird Herstellerdokumentation der Parser selbst, eine Studie von HBS und Accenture — oder eine Messung, die wir nachvollziehbar selbst gemacht haben.',
    sourcesLabel: 'Quellen',
    sources: [
      { label: 'Textkernel — Extraktion aus Spalten-Lebensläufen (2023)', url: 'https://www.textkernel.com/learn-support/blog/improving-extraction-from-column-resumes/' },
      { label: 'HBS & Accenture — Hidden Workers: Untapped Talent (2021)', url: 'https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx' },
      { label: 'Reuters — Amazon verwirft voreingenommenes KI-Recruiting (2018)', url: 'https://www.reuters.com/article/us-amazon-com-jobs-automation-insight-idUSKCN1MK08G' },
    ],
  },
  features: {
    eyebrow: 'Was drinsteckt · fünf Prinzipien',
    h: 'Gebaut für die technischen Anforderungen von heute.',
    items: [
      { num: '01', tag: 'Lesereihenfolge', title: 'Was die Maschine liest, steht in der richtigen Reihenfolge.', body: 'Ein Parser ohne Layoutanalyse liest ein PDF in der Reihenfolge, in der der Text darin abgelegt ist — nicht in der, in der er auf dem Papier steht. Bei Vorlagen mit Seitenspalte beginnt diese Reihenfolge hier mit Name und Kontakt, nicht mit „Berufsprofil“. Ohne versteckten Text: die Spalte selbst ist so gebaut.', art: 'spreads' as FeatureArt },
      { num: '02', tag: 'Satz', title: 'Auto-Fit auf A4. Es passt einfach.', body: 'Inhalt fließt, das Raster hält. Verdichtet wird in der Reihenfolge, in der ein Setzer verdichtet — erst Weißraum, dann Ränder, dann Zeilenabstand, zuletzt die Schrift, und die nie unter 8,4 pt. Passt es dann nicht, kommt eine Seite dazu und das Tool sagt es dir, statt heimlich zu schrumpfen.', art: 'autofit' as FeatureArt },
      { num: '03', tag: 'Schreiben', title: 'Klick in den Text. Tipp.', body: 'Die Vorschau ist das Dokument, nicht sein Abbild. Position, Firma, Stichpunkte, Profil — direkt anklicken und ändern. Enter legt den nächsten Stichpunkt an. Was es bewusst nicht gibt: frei platzierbare Textkästen. Genau die sind der Grund, warum Word-Lebensläufe beim Bearbeiten auseinanderfallen.', art: 'inline' as FeatureArt },
      { num: '04', tag: 'Export', title: 'PDF, Word mit Design, Markdown.', body: 'Das PDF bekommt exakt die Seiten aus der Vorschau. Word gibt es zweimal: als deine Vorlage mit Farbfläche und Akzenten — geprüft in Word und LibreOffice — und einspaltig ohne Tabellen für Portale, die die Datei maschinell auslesen. Dazu Markdown, damit eine KI gegenlesen kann.', art: 'bridge' as FeatureArt },
      { num: '05', tag: 'Auswahl', title: 'Sechsundzwanzig Vorlagen, neun Farben, fünfzig Profile.', body: 'Sechsundzwanzig Vorlagen, die sich in der Konstruktion unterscheiden — nicht in der Farbe. Die wählst du selbst: neun Akzente, jede Kombination auf Kontrast geprüft. Und für jede Bewerbungsrichtung ein eigenes Profil.', art: 'profiles' as FeatureArt },
    ],
  },
  gallery: {
    eyebrow: 'Sechsundzwanzig Vorlagen · sechs Archetypen',
    h: 'Ein System. Sechs Handschriften.',
    cards: [
      { name: 'Einspaltig', tag: '1 Spalte', desc: 'Alles untereinander, Datum in einer eigenen Spalte links. Die Form, die im DACH-Raum erwartet wird — und die jeder Parser sicher liest.' },
      { name: 'Seitenspalte', tag: 'Spalte + Hauptteil', desc: 'Kontakt, Sprachen und Skills links, Berufsweg rechts. Dicht, ruhig, klassisch — und im Textstrom trotzdem in der richtigen Reihenfolge.' },
      { name: 'Spiegel', tag: 'Spalte rechts', desc: 'Dieselbe Ordnung, andere Seite. Der Blick landet zuerst auf dem Berufsweg, die Nebenspalte stützt.' },
      { name: 'Kopfband', tag: 'Balken oben', desc: 'Ein farbiger Balken setzt den Namen wie eine Titelzeile. Selbstbewusst, ohne laut zu werden.' },
      { name: 'Mittelachse', tag: 'Klassik', desc: 'Name zentriert, Kontakt darunter, Datum links. Für Bewerbungen, bei denen Zurückhaltung die Botschaft ist.' },
      { name: 'Zeitstrahl', tag: 'Vertikal', desc: 'Senkrechte Linie, Punkte an den Stationen. Erzählt den Weg, statt ihn aufzuzählen.' },
    ],
  },
  steps: {
    eyebrow: "So funktioniert's · vier Schritte",
    h: 'Vom leeren Profil zum druckfertigen PDF.',
    items: [
      { num: '01', title: 'Profil anlegen', body: 'Bis zu fünfzig Profile pro Konto. Lege für jede Bewerbungsrichtung eines an.' },
      { num: '02', title: 'Vorlage und Farbe wählen', body: 'Sechsundzwanzig Vorlagen, sechs Archetypen, neun Akzentfarben — jederzeit umschaltbar, ohne dass du etwas neu tippst.' },
      { num: '03', title: 'Im Dokument schreiben', body: 'Klick in den Text und tipp. Raster, Ränder und Umbrüche regelt der Satz, nicht du.' },
      { num: '04', title: 'Exportieren', body: 'PDF mit genau den Seiten aus der Vorschau, Word mit deinem Design, oder Markdown für die KI-Korrektur.' },
    ],
  },
  faq: {
    eyebrow: 'Häufige Fragen', h: 'Kurz erklärt.',
    items: [
      { q: 'Was heißt „maschinenlesbar"?', a: 'Jeder Lebenslauf lässt sich als sauberes, strukturiertes Markdown exportieren. So kann eine KI den Inhalt verlässlich gegenlesen, kürzen oder auf eine Stelle zuschneiden — ohne dass das Layout darunter leidet. Das gesetzte PDF und die maschinenlesbare Fassung stammen aus derselben Quelle.' },
      { q: 'Wie komme ich rein?', a: 'Heidrich/cv ist Invite-only — gedacht für Family & Friends. Du fragst Zugang an, bekommst einen Link und kannst sofort loslegen. Kein öffentliches Massen-Signup, keine Warteliste-Show.' },
      { q: 'Werde ich getrackt?', a: 'Nein klassisches Tracking. Wir nutzen Umami self-hosted in Falkenstein für anonyme Page-Views — kein Cookie, kein Fingerprinting, keine IP-Speicherung. Deine Profile gehören dir und werden nicht zu Geld gemacht.' },
      { q: 'Welche Formate kann ich exportieren?', a: 'Druckfertiges PDF mit Auto-Fit auf A4/Letter/Legal/A5 — mit exakt den Seiten, die in der Vorschau stehen. Word in zwei Fassungen: einmal mit dem Design deiner Vorlage (geprüft in Word und LibreOffice), einmal einspaltig ohne Tabellen für Portale, die die Datei maschinell auslesen. Dazu HTML, JSON und strukturiertes Markdown. Alles aus derselben Quelle, immer synchron.' },
      { q: 'Kann ich Vorlagen mitten in der Bewerbung wechseln?', a: 'Ja. Inhalt und Layout sind getrennt. Schalte zwischen sechsundzwanzig Vorlagen, sechs Archetypen und neun Akzentfarben um — der Satz fügt deinen Inhalt neu ein, ohne dass du etwas neu tippst. Die Farbe ist dabei eine eigene Entscheidung und keine eigene Vorlage: Zehn ältere Vorlagen, die faktisch nur Farbvarianten waren, sind aus der Auswahl genommen — gespeicherte Profile behalten sie.' },
      { q: 'Muss ich meinen Lebenslauf neu abtippen?', a: 'Nein. Lade das ZIP aus dem LinkedIn-Datenexport („Eine Kopie deiner Daten erhalten") hoch — Stationen, Ausbildung, Skills, Sprachen, E-Mail und Telefon werden daraus gelesen. Die Datei wird im Browser geparst und geht an keinen Server, auch nicht an unseren; deshalb geht das schon in der Demo ohne Konto. Vor dem Übernehmen siehst du, was gefunden wurde und was nicht. Foto und Profiltext bleiben unangetastet — die kennt LinkedIn nicht. Wer ein bestehendes PDF hat, geht über den Markdown-Weg: Text in die Vorlage, von einer KI strukturieren lassen, zurückimportieren.' },
      { q: 'Kann ich eigene Vorlagen hochladen?', a: 'Nein, und das ist eine Entscheidung. Die Vorlagen sind kein Bilderrahmen, sondern gemessener Satz: Schriftgrad, Sperrung, Zeilenabstand und Umbruch hängen zusammen, und jede Vorlage wird gegen das geprüft, was am Ende aus dem PDF wieder herausgelesen wird. Eine hochgeladene Datei könnte das nicht mitbringen. Was du stattdessen bekommst: den Export „Vorlage ohne Daten" — ein ZIP mit dem Design als eigenständigem HTML und als Word-Datei, Platzhaltern mit ihrem JSON-Pfad und einer leeren daten.json. Damit gehört dir das Design, auch ohne dieses Werkzeug. Und wer selbst hostet, legt eigene Vorlagen direkt in theme.ts an.' },
      { q: 'Was ist mit ATS-Bewerbungen?', a: 'Jede Vorlage wird gegen das gemessen, was am Ende wirklich herauskommt: das gedruckte PDF wird ausgelesen und Seite für Seite mit der Vorschau verglichen — Text, Lesereihenfolge, Wortgrenzen, Trennstriche. Dazu ein ATS-Check im Editor, der deinen Lebenslauf als reinen Text zeigt, so wie ein Parser ihn sieht, plus Abgleich mit einer Stellenanzeige. Spalten sind dabei kein Ausschlusskriterium — mindestens 15 % aller Lebensläufe haben sie. Entscheidend ist, dass die Reihenfolge stimmt, und die wird hier erzwungen.' },
    ],
  },
  footer: {
    closingA: 'Bereit für Lebensläufe, die', closingB: 'auch die Maschine überzeugen?',
    cta: 'Zugang anfragen', cta2: 'Vorlagen ansehen',
    marks: ['Auto-Fit · A4', 'Im Dokument schreiben', 'Word mit Design', 'ATS-Check', 'Invite-only', 'Self-hosted'],
    meta: 'Self-hosted · ATS-tauglich, nicht nur hübsch',
  },
};

const EN: typeof DE = {
  nav: { templates: 'Templates', howItWorks: 'How it works', faq: 'FAQ', cta: 'Request access', signin: 'Sign in', source: 'Source' },
  request: {
    title: 'Request access',
    lede: 'Heidrich/cv is invite-only. Tell us briefly who you are — once approved, your invite link arrives by e-mail.',
    name: 'Name', email: 'E-mail', message: 'Message (optional)',
    messagePlaceholder: 'What is this about? What would you use the tool for?',
    submit: 'Send request', sending: 'Sending',
    successTitle: 'Request sent.',
    success: 'Thanks! Once it is approved, your invite link will arrive by e-mail.',
    close: 'Close',
    errName: 'Please enter your name.',
    errEmail: 'Please enter a valid e-mail address.',
    errGeneric: 'Could not send. Please try again later.',
  },
  hero: {
    eyebrow: 'ATS-ready · Self-hosted · Your data',
    h1a: 'Good-looking résumés fail the applicant bot.',
    h1b: "Yours won't.",
    lede: 'Most résumés are read by a machine first — the ATS. Nicely designed Word and Canva résumés trip over it. This tool builds résumés that get through: ATS-ready and machine-readable, auto-fit to A4. No pricey résumé service that just hands you a PDF. Self-hosted, so your data stays yours.',
    ctaPrimary: 'Try the demo', ctaSecondary: 'See the templates',
  },
  stats: {
    label: 'Numbers',
    items: [
      { mark: '×', value: '18', label: 'templates, no colour clones' },
      { mark: '×', value: '6', label: 'Archetypes, one system' },
      { mark: '↳', value: 'A4', label: 'Auto-fit, edge-sharp' },
      { mark: '·', value: '0', label: 'Trackers, no account-sale' },
    ],
  },
  manifesto: {
    eyebrow: 'The stance · why this exists',
    h1: 'A résumé does not only have to look good — it has to get past the', h2: 'ATS filter', h3: 'first.',
    sig: '— technically sound, not just pretty',
  },
  ats: {
    eyebrow: 'What an ATS is · and why people get filtered out',
    h: 'Before a human sees your résumé, software reads it.',
    intro: 'An Applicant Tracking System (ATS) is the recruiting software that automatically ingests incoming résumés, breaks them into data fields, scans them for keywords and pre-sorts candidates for the recruiter. The catch: the software reads a PDF in the order the text is stored in it — not the order it appears on paper. Anything locked inside tables, text boxes or graphics is missing entirely. Columns are not a knock-out criterion as long as the order is right; in Word and Canva templates it usually is not.',
    facts: [
      { value: '88%', label: 'of employers say so themselves: qualified applicants get filtered out because they miss exact criteria word for word.', src: 'Harvard Business School & Accenture, "Hidden Workers", 2021' },
      { value: '≥ 15%', label: 'of all résumés use columns — so columns are normal. Parser vendor Textkernel reaches 90% cleanly reconstructed documents: one in ten still goes wrong. That is why this tool forces the reading order itself.', src: 'Textkernel, extraction from column résumés, 2023' },
      { value: '≤ 8 pt', label: 'font sizes below this line are named by Personio as a documented cause of failed parsing. Here the floor is 8.4 pt — nothing is set below it; a page is added instead.', src: 'Personio, vendor documentation' },
      { value: '0.08 em', label: 'is the tracking ceiling for all-caps lines — measured here. From 0.10 em, "OBSERVABILITY" falls apart into "O B S E R VA B I L I T Y" in text extraction, and those are exactly the lines a parser uses to split a résumé into sections.', src: 'Own measurement with Chromium and Poppler, 09/2026' },
    ],
    biasTitle: 'And the machine is not neutral.',
    bias: 'In 2018 Amazon had to shut down its own AI recruiting tool: it had learned to systematically downgrade résumés containing the word “women’s.” Automated pre-selection can amplify existing bias instead of removing it — one more reason to keep the résumé technically clean, neutral and legible.',
    mythTitle: 'No scare marketing.',
    myth: 'The viral claim that “75% of résumés are never seen by a human” traces back to a sales argument by a company called Preptel around 2012 and was never substantiated. Most ATS do not auto-reject — they rank and sort. So you will not find a number here that a résumé tool put into circulation about its users’ anxiety: what gets cited is vendor documentation from the parsers themselves, a study by HBS and Accenture — or a measurement we made ourselves and can show.',
    sourcesLabel: 'Sources',
    sources: [
      { label: 'Textkernel — Extraktion aus Spalten-Lebensläufen (2023)', url: 'https://www.textkernel.com/learn-support/blog/improving-extraction-from-column-resumes/' },
      { label: 'HBS & Accenture — Hidden Workers: Untapped Talent (2021)', url: 'https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx' },
      { label: 'Reuters — Amazon scraps biased AI recruiting tool (2018)', url: 'https://www.reuters.com/article/us-amazon-com-jobs-automation-insight-idUSKCN1MK08G' },
    ],
  },
  features: {
    eyebrow: 'What is in the box · five principles',
    h: "Built for today's technical requirements.",
    items: [
      { num: '01', tag: 'Reading order', title: 'What the machine reads comes in the right order.', body: 'A parser without layout analysis reads a PDF in the order the text is stored in it — not the order it appears on paper. In templates with a side column, that order starts with your name and contact details here, not with "Profile". No hidden text: the column itself is built that way.', art: 'spreads' as FeatureArt },
      { num: '02', tag: 'Typesetting', title: 'Auto-fit to A4. It just fits.', body: 'Content flows, the grid holds. Condensing happens in the order a typesetter would condense: whitespace first, then margins, then leading, and type last — never below 8.4 pt. If it still does not fit, a page is added and the tool tells you, instead of shrinking in silence.', art: 'autofit' as FeatureArt },
      { num: '03', tag: 'Writing', title: 'Click into the text. Type.', body: 'The preview is the document, not a picture of it. Role, company, bullet points, profile — click and change them in place. Enter starts the next bullet. What deliberately does not exist: free-floating text boxes. They are the reason Word résumés fall apart the moment you edit them.', art: 'inline' as FeatureArt },
      { num: '04', tag: 'Export', title: 'PDF, Word with the design, Markdown.', body: 'The PDF gets exactly the pages you saw in the preview. Word comes twice: as your template with its colour panel and accents — checked in Word and LibreOffice — and single-column without tables for portals that read the file by machine. Plus Markdown, so an AI can proofread.', art: 'bridge' as FeatureArt },
      { num: '05', tag: 'Choice', title: 'Twenty-six templates, nine colours, fifty profiles.', body: 'Twenty-six templates that differ in construction — not in colour. You pick that yourself: nine accents, every combination checked for contrast. And a separate profile for every direction you apply in.', art: 'profiles' as FeatureArt },
    ],
  },
  gallery: {
    eyebrow: 'Twenty-six templates · six archetypes',
    h: 'One system. Six voices.',
    cards: [
      { name: 'Single column', tag: '1 column', desc: 'Everything below each other, dates in their own column on the left. The shape expected in German-speaking markets — and the one every parser reads safely.' },
      { name: 'Side column', tag: 'Column + main', desc: 'Contact, languages and skills on the left, career on the right. Dense, calm, classic — and still in the right order in the text stream.' },
      { name: 'Mirrored', tag: 'Column right', desc: 'Same order, other side. The eye lands on the career first, the side column supports it.' },
      { name: 'Header band', tag: 'Band on top', desc: 'A coloured band sets the name like a title line. Confident without getting loud.' },
      { name: 'Centre axis', tag: 'Classic', desc: 'Name centred, contact below, dates on the left. For applications where restraint is the message.' },
      { name: 'Timeline', tag: 'Vertical', desc: 'A vertical line with a dot at every station. Tells the path instead of listing it.' },
    ],
  },
  steps: {
    eyebrow: 'How it works · four steps',
    h: 'From empty profile to print-ready PDF.',
    items: [
      { num: '01', title: 'Create a profile', body: 'Up to fifty profiles per account. Set one up for every direction you apply in.' },
      { num: '02', title: 'Pick template and colour', body: 'Twenty-six templates, six archetypes, nine accent colours — switch any time without re-typing a thing.' },
      { num: '03', title: 'Write in the document', body: 'Click into the text and type. Grid, margins and breaks are the typesetter’s job, not yours.' },
      { num: '04', title: 'Export', body: 'PDF with exactly the pages from the preview, Word with your design, or Markdown for the AI pass.' },
    ],
  },
  faq: {
    eyebrow: 'Frequent questions', h: 'In short.',
    items: [
      { q: 'What does "machine-readable" mean?', a: 'Every résumé can be exported as clean, structured Markdown. So an AI can reliably review, shorten or tailor the content to a job posting — without breaking the layout. The set PDF and the machine-readable version come from the same source.' },
      { q: 'How do I get in?', a: 'Heidrich/cv is invite-only — built for family and friends. You request access, get a link, and start. No public mass-signup, no waitlist theatre.' },
      { q: 'Will I be tracked?', a: 'Not in the classic sense. We use Umami self-hosted in Falkenstein for anonymous page views — no cookies, no fingerprinting, no IP storage. Your profiles are yours and are not monetized.' },
      { q: 'What formats can I export?', a: 'Print-ready PDF with auto-fit on A4/Letter/Legal/A5 — with exactly the pages you see in the preview. Word in two versions: one with your template’s design (checked in Word and LibreOffice), one single-column without tables for portals that read the file by machine. Plus HTML, JSON and structured Markdown. All from the same source, always in sync.' },
      { q: 'Can I switch templates mid-application?', a: 'Yes. Content and layout are separate. Switch between twenty-six templates, six archetypes and nine accent colours — the typesetter places your content again, without re-typing anything. Colour is its own decision here, not its own template: ten older templates that were really just colour variants have been taken out of the picker — saved profiles keep them.' },
      { q: 'Do I have to retype my résumé?', a: 'No. Upload the ZIP from LinkedIn\'s data export ("Get a copy of your data") — positions, education, skills, languages, email and phone are read from it. The file is parsed in the browser and reaches no server, not even ours, so it works in the demo without an account. Before anything is replaced you see what was found and what was not. Photo and profile text stay untouched — LinkedIn does not know them. For an existing PDF, take the Markdown route: text into the template, let an AI structure it, import it back.' },
      { q: 'Can I upload my own templates?', a: 'No, and that is a decision. The templates are not picture frames but measured typesetting: font size, tracking, leading and page breaks hang together, and every template is checked against what can actually be read back out of the finished PDF. An uploaded file could not bring that with it. What you get instead is the "template without data" export — a ZIP with the design as standalone HTML and as a Word file, placeholders carrying their JSON path, and an empty daten.json. The design is yours, with or without this tool. And if you self-host, you add your own templates directly in theme.ts.' },
      { q: 'What about ATS applications?', a: 'Every template is measured against what actually comes out: the printed PDF is read back and compared with the preview page by page — text, reading order, word boundaries, hyphens. Plus an ATS check in the editor that shows your résumé as plain text, the way a parser sees it, and matches it against a job ad. Columns are not a knock-out criterion — at least 15% of all résumés have them. What matters is that the order is right, and here it is enforced.' },
    ],
  },
  footer: {
    closingA: 'Ready for résumés that', closingB: 'convince the machine too?',
    cta: 'Request access', cta2: 'See the templates',
    marks: ['Auto-fit · A4', 'Write in the document', 'Word with the design', 'ATS check', 'Invite-only', 'Self-hosted'],
    meta: 'Self-hosted · ATS-ready, not just pretty',
  },
};

const FR: typeof DE = {
  nav: { templates: 'Modèles', howItWorks: 'Comment ça marche', faq: 'FAQ', cta: "Demander l'accès", signin: 'Se connecter', source: 'Code source' },
  request: {
    title: "Demander l'accès",
    lede: "Heidrich/cv est sur invitation. Dites brièvement qui vous êtes — une fois validé, votre lien d'invitation arrive par e-mail.",
    name: 'Nom', email: 'E-mail', message: 'Message (facultatif)',
    messagePlaceholder: "De quoi s'agit-il ? À quoi vous servirait l'outil ?",
    submit: 'Envoyer la demande', sending: 'Envoi',
    successTitle: 'Demande envoyée.',
    success: "Merci ! Une fois validée, votre lien d'invitation arrivera par e-mail.",
    close: 'Fermer',
    errName: 'Veuillez indiquer votre nom.',
    errEmail: 'Veuillez indiquer une adresse e-mail valide.',
    errGeneric: "Envoi impossible. Veuillez réessayer plus tard.",
  },
  hero: {
    eyebrow: 'Compatible ATS · Auto-hébergé · Vos données',
    h1a: 'Les beaux CV échouent face au robot de tri.',
    h1b: 'Pas le vôtre.',
    lede: "La plupart des candidatures sont d'abord lues par une machine. Cet outil compose des CV qui passent ce filtre — compatibles ATS et lisibles par la machine, avec Auto-Fit sur A4. Pas de service de CV hors de prix qui ne livre au final qu'un PDF. Auto-hébergé : vos données restent les vôtres.",
    ctaPrimary: 'Essayer maintenant', ctaSecondary: 'Voir les modèles',
  },
  stats: {
    label: 'Chiffres',
    items: [
      { mark: '×', value: '18', label: 'modèles, sans doublons de couleur' },
      { mark: '×', value: '6', label: 'Archétypes, un seul système' },
      { mark: '↳', value: 'A4', label: 'Auto-Fit, au cordeau' },
      { mark: '·', value: '0', label: 'Trackers, aucun compte à vendre' },
    ],
  },
  manifesto: {
    eyebrow: 'Le parti pris · pourquoi ça existe',
    h1: 'Un CV ne doit pas seulement être beau — il doit franchir le', h2: 'filtre ATS', h3: "d'abord.",
    sig: '— techniquement propre, pas seulement joli',
  },
  ats: {
    eyebrow: "Qu'est-ce qu'un ATS · et pourquoi on est écarté",
    h: "Avant qu'un humain ne voie votre CV, un logiciel le lit.",
    intro: "Un Applicant Tracking System (ATS) est le logiciel de recrutement qui lit automatiquement les CV entrants, les découpe en champs de données, les passe au crible des mots-clés et pré-trie les candidats pour le recruteur. Le piège : le logiciel lit un PDF dans l'ordre où le texte y est stocké — pas dans celui où il apparaît sur le papier. Ce qui est enfermé dans des tableaux, des cadres de texte ou des images manque tout simplement. Les colonnes ne sont pas éliminatoires tant que l'ordre est bon ; dans les modèles Word et Canva, il ne l'est généralement pas.",
    facts: [
      { value: '88 %', label: 'des employeurs le disent eux-mêmes : des candidats qualifiés sont écartés par le système parce qu\'ils ne reprennent pas les critères au mot près.', src: 'Harvard Business School & Accenture, « Hidden Workers », 2021' },
      { value: '≥ 15 %', label: "des CV utilisent une mise en page en colonnes — les colonnes sont donc normales. L'éditeur de parseurs Textkernel porte ainsi à 90 % la part des documents correctement reconstruits : un sur dix échoue quand même. C'est pourquoi cet outil impose l'ordre de lecture au lieu d'espérer l'analyse du destinataire.", src: 'Textkernel, extraction des CV en colonnes, 2023' },
      { value: '≤ 8 pt', label: "Personio cite explicitement les corps inférieurs à cette limite comme cause documentée d'échec de lecture. Ici, le plancher est à 8,4 pt — rien n'est composé en dessous ; une page est ajoutée à la place.", src: 'Personio, documentation éditeur' },
      { value: '0,08 em', label: "est la limite d'interlettrage pour les lignes en capitales — mesurée ici. À partir de 0,10 em, « OBSERVABILITY » se décompose en « O B S E R VA B I L I T Y » à l'extraction, et ce sont précisément ces lignes qui servent au parseur à découper le CV en sections.", src: 'Mesure propre avec Chromium et Poppler, 09/2026' },
    ],
    biasTitle: "Et la machine n'est pas neutre.",
    bias: "En 2018, Amazon a dû arrêter son propre outil de recrutement par IA : il avait appris à dévaloriser systématiquement les CV contenant le mot « women's ». La présélection automatique peut amplifier les biais existants au lieu de les réduire — une raison de plus de garder un CV techniquement propre, neutre et lisible.",
    mythTitle: 'Pas de marketing de la peur.',
    myth: "Le chiffre viral selon lequel « 75 % des CV ne sont jamais vus par un humain » remonte à un argument commercial de la société Preptel vers 2012 et n’a jamais été établi. La plupart des ATS ne rejettent pas automatiquement — ils classent et trient. Vous ne trouverez donc ici aucun chiffre mis en circulation par un outil de candidature au sujet de l’angoisse de ses utilisateurs : on cite la documentation des éditeurs de parseurs, une étude de HBS et Accenture — ou une mesure que nous avons faite nous-mêmes et pouvons montrer.",
    sourcesLabel: 'Sources',
    sources: [
      { label: 'Textkernel — Extraktion aus Spalten-Lebensläufen (2023)', url: 'https://www.textkernel.com/learn-support/blog/improving-extraction-from-column-resumes/' },
      { label: 'HBS & Accenture — Hidden Workers: Untapped Talent (2021)', url: 'https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx' },
      { label: 'Reuters — Amazon abandonne un outil de recrutement IA biaisé (2018)', url: 'https://www.reuters.com/article/us-amazon-com-jobs-automation-insight-idUSKCN1MK08G' },
    ],
  },
  features: {
    eyebrow: 'Ce qu’il y a dedans · cinq principes',
    h: 'Conçu pour les exigences techniques d’aujourd’hui.',
    items: [
      { num: '01', tag: 'Ordre de lecture', title: 'Ce que la machine lit arrive dans le bon ordre.', body: 'Un parseur sans analyse de mise en page lit un PDF dans l’ordre où le texte y est stocké — pas dans celui où il apparaît sur le papier. Dans les modèles à colonne latérale, cet ordre commence ici par le nom et les coordonnées, pas par « Profil ». Sans texte caché : la colonne elle-même est construite ainsi.', art: 'spreads' as FeatureArt },
      { num: '02', tag: 'Composition', title: 'Ajustement automatique en A4. Ça tient.', body: 'Le contenu coule, la grille tient. La densification suit l’ordre d’un typographe : d’abord les blancs, puis les marges, puis l’interligne, et le corps en dernier — jamais sous 8,4 pt. Si ça ne tient toujours pas, une page s’ajoute et l’outil vous le dit, au lieu de réduire en silence.', art: 'autofit' as FeatureArt },
      { num: '03', tag: 'Écriture', title: 'Cliquez dans le texte. Tapez.', body: 'L’aperçu est le document, pas son image. Poste, entreprise, puces, profil — cliquez et modifiez sur place. Entrée crée la puce suivante. Ce qui n’existe volontairement pas : des cadres de texte libres. C’est précisément pour cela que les CV Word se désagrègent dès qu’on les modifie.', art: 'inline' as FeatureArt },
      { num: '04', tag: 'Export', title: 'PDF, Word avec le design, Markdown.', body: 'Le PDF reçoit exactement les pages vues dans l’aperçu. Word existe en deux versions : votre modèle avec son aplat de couleur et ses accents — vérifié dans Word et LibreOffice — et une version à une colonne sans tableaux pour les portails qui lisent le fichier par machine. Plus Markdown, pour qu’une IA puisse relire.', art: 'bridge' as FeatureArt },
      { num: '05', tag: 'Choix', title: 'Vingt-six modèles, neuf couleurs, cinquante profils.', body: 'Vingt-six modèles qui diffèrent par la construction — pas par la couleur. Celle-ci, vous la choisissez : neuf accents, chaque combinaison vérifiée en contraste. Et un profil par direction de candidature.', art: 'profiles' as FeatureArt },
    ],
  },
  gallery: {
    eyebrow: 'Vingt-six modèles · six archétypes',
    h: 'Un système. Six écritures.',
    cards: [
      { name: 'Une colonne', tag: '1 colonne', desc: 'Tout les uns sous les autres, les dates dans leur propre colonne à gauche. La forme attendue dans l’espace germanophone — et celle que tout parseur lit sans risque.' },
      { name: 'Colonne latérale', tag: 'Colonne + corps', desc: 'Contact, langues et compétences à gauche, parcours à droite. Dense, calme, classique — et pourtant dans le bon ordre dans le flux de texte.' },
      { name: 'Miroir', tag: 'Colonne à droite', desc: 'Même ordre, autre côté. Le regard tombe d’abord sur le parcours, la colonne vient en appui.' },
      { name: 'Bandeau', tag: 'Bande en haut', desc: 'Une bande colorée pose le nom comme un titre. Assuré, sans hausser le ton.' },
      { name: 'Axe central', tag: 'Classique', desc: 'Nom centré, coordonnées dessous, dates à gauche. Pour les candidatures où la retenue est le message.' },
      { name: 'Chronologie', tag: 'Vertical', desc: 'Une ligne verticale, un point à chaque étape. Raconte le parcours au lieu de l’énumérer.' },
    ],
  },
  steps: {
    eyebrow: 'Comment ça marche · quatre étapes',
    h: 'Du profil vierge au PDF prêt à imprimer.',
    items: [
      { num: '01', title: 'Créer un profil', body: 'Jusqu’à cinquante profils par compte. Un par direction de candidature.' },
      { num: '02', title: 'Choisir modèle et couleur', body: 'Vingt-six modèles, six archétypes, neuf couleurs d’accent — modifiables à tout moment, sans rien retaper.' },
      { num: '03', title: 'Écrire dans le document', body: 'Cliquez dans le texte et tapez. Grille, marges et césures, c’est l’affaire de la composition, pas la vôtre.' },
      { num: '04', title: 'Exporter', body: 'PDF avec exactement les pages de l’aperçu, Word avec votre design, ou Markdown pour la relecture par une IA.' },
    ],
  },
  faq: {
    eyebrow: 'Questions fréquentes', h: 'En bref.',
    items: [
      { q: 'Que signifie « lisible par la machine » ?', a: "Chaque CV s'exporte en Markdown propre et structuré. Une IA peut ainsi le relire, le raccourcir ou l'ajuster à un poste de façon fiable — sans abîmer la mise en page. Le PDF composé et la version lisible par la machine viennent de la même source." },
      { q: "Comment obtenir l'accès ?", a: "Heidrich/cv est sur invitation — pensé pour Family & Friends. Vous demandez l'accès, recevez un lien et démarrez aussitôt. Pas d'inscription de masse, pas de liste d'attente pour la forme." },
      { q: 'Suis-je pisté ?', a: "Pas de pistage classique. Nous utilisons Umami auto-hébergé à Falkenstein pour des pages vues anonymes — sans cookie, sans empreinte, sans stockage d'IP. Vos profils vous appartiennent et ne sont pas monétisés." },
      { q: 'Quels formats puis-je exporter ?', a: "PDF prêt à imprimer avec ajustement automatique en A4/Letter/Legal/A5 — avec exactement les pages de l'aperçu. Word en deux versions : l'une avec le design de votre modèle (vérifiée dans Word et LibreOffice), l'autre à une colonne sans tableaux pour les portails qui lisent le fichier par machine. Plus HTML, JSON et Markdown structuré. Tout vient de la même source, toujours synchronisé." },
      { q: 'Puis-je changer de modèle en pleine candidature ?', a: "Oui. Le contenu et la mise en page sont séparés. Passez d'un modèle à l'autre parmi les vingt-six, les six archétypes et les neuf couleurs d'accent — la composition replace votre contenu sans que vous ne retapiez rien. La couleur est ici une décision à part, pas un modèle à part : dix anciens modèles qui n'étaient que des variantes de couleur ont été retirés du choix — les profils enregistrés les conservent." },
      { q: 'Dois-je retaper mon CV ?', a: "Non. Téléversez le ZIP de l'export de données LinkedIn (« Obtenir une copie de vos données ») — postes, formation, compétences, langues, e-mail et téléphone en sont extraits. Le fichier est lu dans le navigateur et n'atteint aucun serveur, pas même le nôtre ; cela fonctionne donc dès la démo, sans compte. Avant tout remplacement, vous voyez ce qui a été trouvé et ce qui ne l'a pas été. Photo et texte de profil restent intacts — LinkedIn ne les connaît pas. Pour un PDF existant, passez par le Markdown : le texte dans le modèle, structuré par une IA, réimporté." },
      { q: 'Puis-je téléverser mes propres modèles ?', a: "Non, et c'est un choix. Les modèles ne sont pas des cadres mais une composition mesurée : corps, approche, interlignage et coupures tiennent ensemble, et chaque modèle est vérifié contre ce que l'on peut réellement relire dans le PDF final. Un fichier téléversé ne pourrait pas apporter cela. À la place : l'export « modèle sans données » — un ZIP avec le design en HTML autonome et en fichier Word, des champs porteurs de leur chemin JSON et un daten.json vide. Le design vous appartient, avec ou sans cet outil. Et en auto-hébergement, vos modèles s'ajoutent directement dans theme.ts." },
      { q: 'Et pour les candidatures ATS ?', a: "Chaque modèle est mesuré sur ce qui sort réellement : le PDF imprimé est relu et comparé page par page à l'aperçu — texte, ordre de lecture, limites de mots, césures. S'y ajoute un contrôle ATS dans l'éditeur qui montre votre CV en texte brut, tel qu'un parseur le voit, avec comparaison à une offre d'emploi. Les colonnes ne sont pas éliminatoires — au moins 15 % des CV en ont. Ce qui compte, c'est l'ordre, et il est imposé ici." },
    ],
  },
  footer: {
    closingA: 'Prêt pour des CV qui', closingB: 'convainquent aussi la machine ?',
    cta: "Demander l'accès", cta2: 'Voir les modèles',
    marks: ['Auto-Fit · A4', 'Écrire dans le document', 'Word avec le design', 'Contrôle ATS', 'Invite-only', 'Self-hosted'],
    meta: 'Auto-hébergé · compatible ATS, pas seulement joli',
  },
};

const ES: typeof DE = {
  nav: { templates: 'Plantillas', howItWorks: 'Cómo funciona', faq: 'FAQ', cta: 'Solicitar acceso', signin: 'Iniciar sesión', source: 'Código' },
  request: {
    title: 'Solicitar acceso',
    lede: 'Heidrich/cv es solo por invitación. Cuéntanos brevemente quién eres — una vez aprobado, tu enlace de invitación llegará por e-mail.',
    name: 'Nombre', email: 'E-mail', message: 'Mensaje (opcional)',
    messagePlaceholder: '¿De qué se trata? ¿Para qué usarías la herramienta?',
    submit: 'Enviar solicitud', sending: 'Enviando',
    successTitle: 'Solicitud enviada.',
    success: '¡Gracias! Cuando se apruebe, recibirás tu enlace de invitación por e-mail.',
    close: 'Cerrar',
    errName: 'Indica tu nombre, por favor.',
    errEmail: 'Indica una dirección de e-mail válida.',
    errGeneric: 'No se pudo enviar. Inténtalo de nuevo más tarde.',
  },
  hero: {
    eyebrow: 'Compatible con ATS · Autoalojado · Tus datos',
    h1a: 'Los CV bonitos no pasan el robot de selección.',
    h1b: 'El tuyo sí.',
    lede: 'La mayoría de las candidaturas las lee primero una máquina. Esta herramienta crea currículums que la superan: compatibles con ATS y legibles por máquina, con Auto-Fit en A4. Sin servicios de CV caros que al final solo te entregan un PDF. Autoalojado: tus datos siguen siendo tuyos.',
    ctaPrimary: 'Probar ahora', ctaSecondary: 'Ver las plantillas',
  },
  stats: {
    label: 'Cifras',
    items: [
      { mark: '×', value: '18', label: 'plantillas, sin duplicados de color' },
      { mark: '×', value: '6', label: 'Arquetipos, un sistema' },
      { mark: '↳', value: 'A4', label: 'Auto-Fit, al milímetro' },
      { mark: '·', value: '0', label: 'Trackers, sin venta de cuentas' },
    ],
  },
  manifesto: {
    eyebrow: 'La postura · por qué existe',
    h1: 'Un CV no solo tiene que verse bien: tiene que pasar el', h2: 'filtro ATS', h3: 'primero.',
    sig: '— técnicamente correcto, no solo bonito',
  },
  ats: {
    eyebrow: 'Qué es un ATS · y por qué te descartan',
    h: 'Antes de que un humano vea tu CV, lo lee un software.',
    intro: 'Un Applicant Tracking System (ATS) es el software de selección que lee automáticamente los CV que llegan, los descompone en campos de datos, los rastrea por palabras clave y preordena a los candidatos para el reclutador. El truco: el software lee un PDF en el orden en que el texto está almacenado — no en el que aparece sobre el papel. Lo que queda encerrado en tablas, cuadros de texto o gráficos falta por completo. Las columnas no son un criterio de exclusión mientras el orden sea correcto; en las plantillas de Word y Canva normalmente no lo es.',
    facts: [
      { value: '88 %', label: 'de las empresas lo dice ella misma: candidatos cualificados quedan descartados por el sistema porque no reproducen los criterios al pie de la letra.', src: 'Harvard Business School & Accenture, «Hidden Workers», 2021' },
      { value: '≥ 15 %', label: 'de los CV usan un diseño por columnas — las columnas son normales. El fabricante de parseadores Textkernel eleva así al 90 % los documentos reconstruidos correctamente: uno de cada diez sigue fallando. Por eso esta herramienta impone el orden de lectura en vez de confiar en el análisis del destinatario.', src: 'Textkernel, extracción de CV por columnas, 2023' },
      { value: '≤ 8 pt', label: 'Personio menciona expresamente los cuerpos por debajo de este límite como causa documentada de lectura fallida. Aquí el mínimo son 8,4 pt — nada se compone por debajo; antes se añade una página.', src: 'Personio, documentación del fabricante' },
      { value: '0,08 em', label: 'es el tope de espaciado para líneas en versales — medido aquí. A partir de 0,10 em, «OBSERVABILITY» se descompone en «O B S E R VA B I L I T Y» al extraer el texto, y son justo esas líneas las que un parseador usa para dividir el CV en secciones.', src: 'Medición propia con Chromium y Poppler, 09/2026' },
    ],
    biasTitle: 'Y la máquina no es neutral.',
    bias: 'En 2018 Amazon tuvo que apagar su propia herramienta de selección con IA: había aprendido a penalizar sistemáticamente los CV con la palabra «women’s». La preselección automática puede amplificar los sesgos existentes en lugar de reducirlos — una razón más para mantener el CV técnicamente limpio, neutral y legible.',
    mythTitle: 'Sin marketing del miedo.',
    myth: 'La cifra viral de que «el 75 % de los CV nunca los ve un humano» procede de un argumento de venta de la empresa Preptel hacia 2012 y nunca se demostró. La mayoría de los ATS no rechazan automáticamente — clasifican y ordenan. Por eso aquí no encontrarás una cifra que una herramienta de candidaturas puso en circulación sobre el miedo de sus usuarios: se cita documentación de los propios fabricantes de parseadores, un estudio de HBS y Accenture — o una medición que hicimos nosotros y podemos mostrar.',
    sourcesLabel: 'Fuentes',
    sources: [
      { label: 'Textkernel — Extraktion aus Spalten-Lebensläufen (2023)', url: 'https://www.textkernel.com/learn-support/blog/improving-extraction-from-column-resumes/' },
      { label: 'HBS & Accenture — Hidden Workers: Untapped Talent (2021)', url: 'https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx' },
      { label: 'Reuters — Amazon descarta una herramienta de IA sesgada (2018)', url: 'https://www.reuters.com/article/us-amazon-com-jobs-automation-insight-idUSKCN1MK08G' },
    ],
  },
  features: {
    eyebrow: 'Qué lleva dentro · cinco principios',
    h: 'Construido para las exigencias técnicas de hoy.',
    items: [
      { num: '01', tag: 'Orden de lectura', title: 'Lo que lee la máquina va en el orden correcto.', body: 'Un parseador sin análisis de maquetación lee un PDF en el orden en que el texto está almacenado — no en el que aparece sobre el papel. En las plantillas con columna lateral, aquí ese orden empieza por el nombre y los datos de contacto, no por «Perfil». Sin texto oculto: la columna está construida así.', art: 'spreads' as FeatureArt },
      { num: '02', tag: 'Composición', title: 'Ajuste automático a A4. Simplemente encaja.', body: 'El contenido fluye, la retícula aguanta. Se compacta en el orden en que lo haría un tipógrafo: primero el blanco, luego los márgenes, luego el interlineado y la letra al final — nunca por debajo de 8,4 pt. Si aun así no cabe, se añade una página y la herramienta te lo dice, en lugar de encoger en silencio.', art: 'autofit' as FeatureArt },
      { num: '03', tag: 'Escribir', title: 'Haz clic en el texto. Escribe.', body: 'La vista previa es el documento, no su imagen. Puesto, empresa, viñetas, perfil — haz clic y cámbialos ahí mismo. Intro crea la siguiente viñeta. Lo que deliberadamente no existe: cuadros de texto libres. Son justo la razón por la que los CV de Word se desmontan al editarlos.', art: 'inline' as FeatureArt },
      { num: '04', tag: 'Exportar', title: 'PDF, Word con el diseño, Markdown.', body: 'El PDF recibe exactamente las páginas de la vista previa. Word viene dos veces: como tu plantilla con su franja de color y sus acentos — comprobado en Word y LibreOffice — y a una columna sin tablas para portales que leen el archivo por máquina. Además Markdown, para que una IA pueda revisarlo.', art: 'bridge' as FeatureArt },
      { num: '05', tag: 'Elección', title: 'Veintiséis plantillas, nueve colores, cincuenta perfiles.', body: 'Veintiséis plantillas que se diferencian en la construcción — no en el color. Ese lo eliges tú: nueve acentos, cada combinación comprobada en contraste. Y un perfil propio para cada dirección en la que te postules.', art: 'profiles' as FeatureArt },
    ],
  },
  gallery: {
    eyebrow: 'Veintiséis plantillas · seis arquetipos',
    h: 'Un sistema. Seis firmas.',
    cards: [
      { name: 'Una columna', tag: '1 columna', desc: 'Todo uno debajo de otro, las fechas en su propia columna a la izquierda. La forma que se espera en el ámbito germanohablante — y la que cualquier parseador lee con seguridad.' },
      { name: 'Columna lateral', tag: 'Columna + cuerpo', desc: 'Contacto, idiomas y competencias a la izquierda, trayectoria a la derecha. Densa, tranquila, clásica — y aun así en el orden correcto en el flujo de texto.' },
      { name: 'Espejo', tag: 'Columna a la derecha', desc: 'El mismo orden, el otro lado. La mirada cae primero en la trayectoria; la columna acompaña.' },
      { name: 'Banda superior', tag: 'Franja arriba', desc: 'Una franja de color coloca el nombre como un titular. Seguro, sin levantar la voz.' },
      { name: 'Eje central', tag: 'Clásico', desc: 'Nombre centrado, contacto debajo, fechas a la izquierda. Para candidaturas donde la contención es el mensaje.' },
      { name: 'Línea de tiempo', tag: 'Vertical', desc: 'Una línea vertical con un punto en cada etapa. Cuenta el camino en vez de enumerarlo.' },
    ],
  },
  steps: {
    eyebrow: 'Cómo funciona · cuatro pasos',
    h: 'Del perfil vacío al PDF listo para imprimir.',
    items: [
      { num: '01', title: 'Crear un perfil', body: 'Hasta cincuenta perfiles por cuenta. Uno por cada dirección en la que te postules.' },
      { num: '02', title: 'Elegir plantilla y color', body: 'Veintiséis plantillas, seis arquetipos, nueve colores de acento — cambiables en cualquier momento, sin volver a escribir nada.' },
      { num: '03', title: 'Escribir en el documento', body: 'Haz clic en el texto y escribe. Retícula, márgenes y saltos son cosa de la composición, no tuya.' },
      { num: '04', title: 'Exportar', body: 'PDF con exactamente las páginas de la vista previa, Word con tu diseño, o Markdown para la revisión con IA.' },
    ],
  },
  faq: {
    eyebrow: 'Preguntas frecuentes', h: 'En breve.',
    items: [
      { q: '¿Qué significa «legible por máquina»?', a: 'Cada CV se exporta como Markdown limpio y estructurado. Así una IA puede revisarlo, acortarlo o ajustarlo a un puesto de forma fiable, sin estropear la maquetación. El PDF compuesto y la versión legible por máquina salen de la misma fuente.' },
      { q: '¿Cómo entro?', a: 'Heidrich/cv es solo por invitación, pensado para Family & Friends. Solicitas acceso, recibes un enlace y empiezas al instante. Sin registro masivo, sin lista de espera de escaparate.' },
      { q: '¿Me rastrean?', a: 'Nada de rastreo clásico. Usamos Umami autoalojado en Falkenstein para vistas de página anónimas: sin cookies, sin fingerprinting, sin almacenar IP. Tus perfiles son tuyos y no se monetizan.' },
      { q: '¿Qué formatos puedo exportar?', a: 'PDF listo para imprimir con ajuste automático en A4/Letter/Legal/A5 — con exactamente las páginas de la vista previa. Word en dos versiones: una con el diseño de tu plantilla (comprobada en Word y LibreOffice) y otra a una columna sin tablas para portales que leen el archivo por máquina. Además HTML, JSON y Markdown estructurado. Todo de la misma fuente, siempre sincronizado.' },
      { q: '¿Puedo cambiar de plantilla a mitad de candidatura?', a: 'Sí. Contenido y maquetación van por separado. Cambia entre veintiséis plantillas, seis arquetipos y nueve colores de acento: la composición recoloca tu contenido sin que reescribas nada. Aquí el color es una decisión propia, no una plantilla propia: diez plantillas antiguas que en realidad solo eran variantes de color se han retirado de la selección — los perfiles guardados las conservan.' },
      { q: '¿Tengo que reescribir mi currículum?', a: 'No. Sube el ZIP de la exportación de datos de LinkedIn («Obtener una copia de tus datos»): puestos, formación, competencias, idiomas, correo y teléfono se leen de ahí. El archivo se procesa en el navegador y no llega a ningún servidor, tampoco al nuestro; por eso funciona ya en la demo, sin cuenta. Antes de sustituir nada ves qué se encontró y qué no. La foto y el texto de perfil quedan intactos: LinkedIn no los conoce. Si tienes un PDF, ve por la vía Markdown: el texto a la plantilla, que una IA lo estructure, y reimportar.' },
      { q: '¿Puedo subir mis propias plantillas?', a: 'No, y es una decisión. Las plantillas no son marcos sino composición medida: cuerpo, interletraje, interlineado y saltos de página van juntos, y cada plantilla se comprueba contra lo que realmente se puede volver a leer del PDF final. Un archivo subido no podría traer eso. A cambio tienes la exportación «plantilla sin datos»: un ZIP con el diseño como HTML independiente y como archivo de Word, marcadores con su ruta JSON y un daten.json vacío. El diseño es tuyo, con o sin esta herramienta. Y si te autoalojas, añades tus plantillas directamente en theme.ts.' },
      { q: '¿Y las candidaturas ATS?', a: 'Cada plantilla se mide contra lo que realmente sale: el PDF impreso se vuelve a leer y se compara página por página con la vista previa — texto, orden de lectura, límites de palabra, guiones. Además, una comprobación ATS en el editor muestra tu CV como texto plano, tal como lo ve un parseador, y lo contrasta con una oferta. Las columnas no son un criterio de exclusión: al menos el 15 % de los CV las tienen. Lo que cuenta es que el orden sea correcto, y aquí se impone.' },
    ],
  },
  footer: {
    closingA: '¿Listo para CV que', closingB: 'también convenzan a la máquina?',
    cta: 'Solicitar acceso', cta2: 'Ver las plantillas',
    marks: ['Auto-Fit · A4', 'Escribir en el documento', 'Word con el diseño', 'Chequeo ATS', 'Invite-only', 'Self-hosted'],
    meta: 'Autoalojado · compatible con ATS, no solo bonito',
  },
};

const COPY: Record<UiLang, typeof DE> = { de: DE, en: EN, fr: FR, es: ES };
const LANG_ORDER: UiLang[] = ['de', 'en', 'fr', 'es'];
