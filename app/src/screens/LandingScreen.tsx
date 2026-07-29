import { APP_NAME } from '../brand';
import { useEffect, useState } from 'react';
import { api } from '../data/api';
import type { UiLang } from '../ui/i18n';
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
            <span className="lp-word">{APP_NAME}</span>
          </button>
          <nav className="lp-nav-links" aria-label="Hauptnavigation">
            <button type="button" onClick={scrollTo('vorlagen')}>{t.nav.templates}</button>
            <button type="button" onClick={scrollTo('funktion')}>{t.nav.howItWorks}</button>
            <button type="button" onClick={scrollTo('faq')}>{t.nav.faq}</button>
            <button type="button" onClick={onSignIn}>{t.nav.signin}</button>
          </nav>
          <div className="lp-lang-row">
            {LANG_ORDER.map(l => (
              <button key={l} type="button" className={lang === l ? 'is-on' : ''} onClick={() => onLangChange(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button type="button" className="lp-btn" onClick={() => setRequestOpen(true)}>{t.nav.cta}</button>
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
              <button type="button" className="lp-btn" onClick={onDemoStart}>{t.hero.ctaPrimary}</button>
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
              {(['single','sidebar','band','wien','timeline','dossier'] as const).map((variant, i) => (
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
            <button type="button" className="lp-link-arrow" onClick={() => setRequestOpen(true)}>
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
              <span className="lp-word">{APP_NAME}</span>
            </button>
            <nav className="lp-nav-links" style={{ display: 'flex' }} aria-label="Footer-Navigation">
              <button type="button" onClick={scrollTo('vorlagen')}>{t.nav.templates}</button>
              <button type="button" onClick={scrollTo('funktion')}>{t.nav.howItWorks}</button>
              <button type="button" onClick={scrollTo('faq')}>{t.nav.faq}</button>
              <button type="button" onClick={() => onLegal?.('impressum')}>Impressum</button>
              <button type="button" onClick={() => onLegal?.('privacy')}>{({ de: 'Datenschutz', en: 'Privacy', fr: 'Confidentialité', es: 'Privacidad' } as Record<UiLang, string>)[lang]}</button>
            </nav>
            <button type="button" className="lp-btn lp-ghost" onClick={() => setRequestOpen(true)}>{t.nav.cta}</button>
          </div>
          <div className="lp-footer-meta">
            <span>cv.example.com</span>
            <span>{t.footer.meta}</span>
            <span>© {new Date().getFullYear()} CV-Hub</span>
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
  const [website, setWebsite] = useState('');
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

type FeatureArt = 'spreads' | 'autofit' | 'bridge' | 'profiles';
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

function Sheet({ variant }: { variant: 'single' | 'sidebar' | 'band' | 'wien' | 'timeline' | 'dossier' }) {
  if (variant === 'single') return (
    <div className="lp-sheet lp-single">
      <div className="lp-name"></div><div className="lp-role"></div>
      <div className="lp-blk"><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div></div>
      <div className="lp-blk"><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div></div>
      <div className="lp-blk"><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div></div>
    </div>
  );
  if (variant === 'sidebar') return (
    <div className="lp-sheet lp-sidebar">
      <div className="lp-rail"><div className="lp-av"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l lp-acc"></div><div className="lp-l"></div><div className="lp-l"></div></div>
      <div className="lp-main"><div className="lp-name"></div><div className="lp-role"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div><div className="lp-l"></div></div>
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
  if (variant === 'timeline') return (
    <div className="lp-sheet lp-timeline">
      <div className="lp-name"></div>
      <div className="lp-tl">
        <div className="lp-ev"><div className="lp-l lp-ink" style={{ width: '50%' }}></div><div className="lp-l"></div><div className="lp-l" style={{ width: '70%' }}></div></div>
        <div className="lp-ev"><div className="lp-l lp-ink" style={{ width: '50%' }}></div><div className="lp-l"></div><div className="lp-l" style={{ width: '60%' }}></div></div>
        <div className="lp-ev"><div className="lp-l lp-ink" style={{ width: '50%' }}></div><div className="lp-l"></div><div className="lp-l" style={{ width: '65%' }}></div></div>
      </div>
    </div>
  );
  return (
    <div className="lp-sheet lp-dossier">
      <div className="lp-head"><div className="lp-n"></div><div className="lp-meta"></div></div>
      <div className="lp-grid3">
        <div><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div></div>
        <div><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div></div>
        <div><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div></div>
        <div><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div></div>
        <div><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div></div>
        <div><div className="lp-hd"></div><div className="lp-l"></div><div className="lp-l"></div></div>
      </div>
    </div>
  );
}

// ── Content (DE/EN) ────────────────────────────────────────────────────────

const DE = {
  nav: { templates: 'Vorlagen', howItWorks: "So funktioniert's", faq: 'FAQ', cta: 'Zugang anfragen', signin: 'Anmelden' },
  request: {
    title: 'Zugang anfragen',
    lede: 'CV-Hub ist Invite-only. Sag kurz, wer du bist â nach der Freigabe kommt dein Einladungslink per E-Mail.',
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
    eyebrow: 'Family & Friends · Invite-only · Kein Tracking',
    h1a: 'Lebensläufe lesen sich heute wie Formulare.',
    h1b: 'Hier nicht.',
    lede: 'Zwanzig Vorlagen, gesetzt wie editoriale Spreads. Auto-Fit auf A4, Markdown-Bridge für die KI-Korrektur — und druckfertig in einem Klick.',
    ctaPrimary: 'Direkt ausprobieren', ctaSecondary: 'Vorlagen ansehen',
  },
  stats: {
    label: 'Zahlen',
    items: [
      { mark: '×', value: '28', label: 'Vorlagen, einsatzbereit' },
      { mark: '×', value: '6', label: 'Archetypen, ein System' },
      { mark: '↳', value: 'A4', label: 'Auto-Fit, randscharf' },
      { mark: '·', value: '0', label: 'Tracker, kein Konto-Verkauf' },
    ],
  },
  manifesto: {
    eyebrow: 'Die Haltung · warum es das gibt',
    h1: 'Ein Lebenslauf ist kein Antrag. Er ist ein', h2: 'Editorial', h3: 'über dich.',
    sig: '— gesetzt, nicht ausgefüllt',
  },
  features: {
    eyebrow: 'Was drinsteckt · vier Prinzipien',
    h: 'Gebaut für Leute, die Form ernst nehmen.',
    items: [
      { num: '01', tag: 'Layout', title: 'Editoriale Spreads, keine Tabellen.', body: 'Sechs Archetypen, achtundzwanzig Vorlagen. Jede ist gesetzt wie eine Doppelseite — mit Raster, Hierarchie und Luft. Nicht wie ein Antragsformular mit Kästchen.', art: 'spreads' as FeatureArt },
      { num: '02', tag: 'Satz', title: 'Auto-Fit auf A4. Es passt einfach.', body: 'Inhalt fließt, das Raster hält. Was du tippst, sitzt sofort auf der Seite — Zeilen, Ränder und Umbrüche regelt der Satz, nicht du. Eine Seite oder zwei, randscharf.', art: 'autofit' as FeatureArt },
      { num: '03', tag: 'Bridge', title: 'Markdown-Bridge für die KI.', body: 'Exportiere jeden Lebenslauf als sauberes, strukturiertes Markdown — damit eine KI gegenlesen, kürzen oder auf die Stelle zuschneiden kann. Maschinenlesbar by design, ohne Layout-Bruch.', art: 'bridge' as FeatureArt },
      { num: '04', tag: 'Konto', title: 'Bis zu fünfzig Profile, ein Klick.', body: 'Für jede Bewerbung der richtige Schnitt — Initiativ, Senior, kreativ. Ein Klick öffnet das passende, der Rest bleibt sauber verwahrt.', art: 'profiles' as FeatureArt },
    ],
  },
  gallery: {
    eyebrow: 'Achtundzwanzig Vorlagen · sechs Archetypen',
    h: 'Ein System. Sechs Handschriften.',
    cards: [
      { name: 'Single', tag: '1 Spalte', desc: 'Eine Spalte, mittig gesetzt. Maximale Ruhe für Text, der für sich steht.' },
      { name: 'Sidebar', tag: 'Rail + Main', desc: 'Linke Schiene für Skills und Kontakt, Fließtext rechts. Klassisch, dicht, klar.' },
      { name: 'Band', tag: 'Header-Block', desc: 'Farbiger Kopf-Block setzt den Namen wie eine Titelzeile. Selbstbewusst.' },
      { name: 'Wien', tag: 'Klassik', desc: 'Symmetrisch, zweispaltig, mit Trenn-Rules. Für klassisch deutsche DIN.' },
      { name: 'Timeline', tag: 'Vertikal', desc: 'Vertikale Linie, Punkte am Rand. Story-erzählend statt aufzählend.' },
      { name: 'Dossier', tag: 'Raster, dicht', desc: 'Modulares Raster für viel Inhalt. Für Profile mit langer Historie.' },
    ],
  },
  steps: {
    eyebrow: "So funktioniert's · vier Schritte",
    h: 'Vom leeren Profil zum druckfertigen PDF.',
    items: [
      { num: '01', title: 'Profil anlegen', body: 'Bis zu fünfzig Profile pro Konto. Lege für jede Bewerbungsrichtung eines an.' },
      { num: '02', title: 'Archetyp wählen', body: 'Single, Sidebar, Band, Wien, Timeline oder Dossier — jederzeit umschaltbar.' },
      { num: '03', title: 'Inhalt tippen', body: 'Du schreibst, Auto-Fit setzt. Raster, Ränder und Umbrüche regelt der Satz.' },
      { num: '04', title: 'Exportieren', body: 'Druckfertiges PDF auf A4 — oder sauberes Markdown für die KI-Korrektur.' },
    ],
  },
  faq: {
    eyebrow: 'Häufige Fragen', h: 'Kurz erklärt.',
    items: [
      { q: 'Was heißt „maschinenlesbar"?', a: 'Jeder Lebenslauf lässt sich als sauberes, strukturiertes Markdown exportieren. So kann eine KI den Inhalt verlässlich gegenlesen, kürzen oder auf eine Stelle zuschneiden — ohne dass das Layout darunter leidet. Das gesetzte PDF und die maschinenlesbare Fassung stammen aus derselben Quelle.' },
      { q: 'Wie komme ich rein?', a: 'CV-Hub ist Invite-only — gedacht für Family & Friends. Du fragst Zugang an, bekommst einen Link und kannst sofort loslegen. Kein öffentliches Massen-Signup, keine Warteliste-Show.' },
      { q: 'Werde ich getrackt?', a: 'Nein klassisches Tracking. Wir nutzen Umami self-hosted in Falkenstein für anonyme Page-Views — kein Cookie, kein Fingerprinting, keine IP-Speicherung. Deine Profile gehören dir und werden nicht zu Geld gemacht.' },
      { q: 'Welche Formate kann ich exportieren?', a: 'Druckfertiges PDF mit Auto-Fit auf A4/Letter/Legal/A5 (eine, zwei oder drei Seiten, randscharf), HTML-Export, JSON-Export und strukturiertes Markdown. Alles aus derselben Quelle, immer synchron.' },
      { q: 'Kann ich Vorlagen mitten in der Bewerbung wechseln?', a: 'Ja. Inhalt und Layout sind getrennt. Schalte zwischen den sechs Archetypen und 25 Vorlagen um — der Satz fügt deinen Inhalt neu ein, ohne dass du etwas neu tippst.' },
      { q: 'Was ist mit ATS-Bewerbungen?', a: 'Jede Vorlage hat einen ATS-Score-Badge im Editor. Single-column-Layouts sind ATS-stark, Sidebar-Layouts riskanter. Plus: ein ATS-Check-Modal zeigt deinen CV als Plain-Text wie ein Workday-Parser ihn sieht, plus Keyword-Match gegen eine Stellenanzeige.' },
    ],
  },
  footer: {
    closingA: 'Bereit, deinen Lebenslauf', closingB: 'neu zu setzen?',
    cta: 'Zugang anfragen', cta2: 'Vorlagen ansehen',
    marks: ['Auto-Fit · A4', 'Markdown-Bridge', 'ATS-Check', 'Invite-only', 'Self-hosted', 'Druckfertig'],
    meta: 'Family & Friends · gesetzt, nicht ausgefüllt',
  },
};

const EN: typeof DE = {
  nav: { templates: 'Templates', howItWorks: 'How it works', faq: 'FAQ', cta: 'Request access', signin: 'Sign in' },
  request: {
    title: 'Request access',
    lede: 'CV-Hub is invite-only. Tell us briefly who you are — once approved, your invite link arrives by e-mail.',
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
    eyebrow: 'Family & Friends · Invite-only · No tracking',
    h1a: 'Most résumés read like forms.',
    h1b: 'Not this one.',
    lede: 'Twenty-five templates set like editorial spreads. Auto-fit to A4, Markdown bridge for AI proofreading — and print-ready in one click.',
    ctaPrimary: 'Try the demo', ctaSecondary: 'See the templates',
  },
  stats: {
    label: 'Numbers',
    items: [
      { mark: '×', value: '28', label: 'Templates, ready to use' },
      { mark: '×', value: '6', label: 'Archetypes, one system' },
      { mark: '↳', value: 'A4', label: 'Auto-fit, edge-sharp' },
      { mark: '·', value: '0', label: 'Trackers, no account-sale' },
    ],
  },
  manifesto: {
    eyebrow: 'The stance · why this exists',
    h1: 'A résumé is not a form. It is an', h2: 'editorial', h3: 'about you.',
    sig: '— set, not filled in',
  },
  features: {
    eyebrow: 'What is in the box · four principles',
    h: 'Built for people who take form seriously.',
    items: [
      { num: '01', tag: 'Layout', title: 'Editorial spreads, not tables.', body: 'Six archetypes, twenty-eight templates. Each is set like a magazine spread — with grid, hierarchy and air. Not like a form with checkboxes.', art: 'spreads' as FeatureArt },
      { num: '02', tag: 'Typesetting', title: 'Auto-fit to A4. It just fits.', body: 'Content flows, the grid holds. What you type sits on the page right away — lines, margins and breaks are managed by the type-setter, not by you. One page or two, edge-sharp.', art: 'autofit' as FeatureArt },
      { num: '03', tag: 'Bridge', title: 'Markdown bridge for the AI.', body: 'Export every résumé as clean, structured Markdown — so an AI can review, shorten or tailor to a job posting. Machine-readable by design, no layout break.', art: 'bridge' as FeatureArt },
      { num: '04', tag: 'Account', title: 'Up to fifty profiles, one click.', body: 'A separate cut for every direction — initiative, senior, creative. One click opens the right one, the rest stays neatly filed.', art: 'profiles' as FeatureArt },
    ],
  },
  gallery: {
    eyebrow: 'Twenty-eight templates · six archetypes',
    h: 'One system. Six voices.',
    cards: [
      { name: 'Single', tag: '1 column', desc: 'One column, centered. Maximum calm for text that stands on its own.' },
      { name: 'Sidebar', tag: 'Rail + main', desc: 'Left rail for skills and contact, body text on the right. Classic, dense, clear.' },
      { name: 'Band', tag: 'Header block', desc: 'Colored header block sets the name like a title line. Confident.' },
      { name: 'Vienna', tag: 'Classic', desc: 'Symmetric, two-column, with separator rules. For classic German DIN.' },
      { name: 'Timeline', tag: 'Vertical', desc: 'Vertical line, dots at the side. Story-telling instead of listing.' },
      { name: 'Dossier', tag: 'Dense grid', desc: 'Modular grid for lots of content. For profiles with a long history.' },
    ],
  },
  steps: {
    eyebrow: 'How it works · four steps',
    h: 'From empty profile to print-ready PDF.',
    items: [
      { num: '01', title: 'Create profile', body: 'Up to fifty profiles per account. Set one up for each direction.' },
      { num: '02', title: 'Pick archetype', body: 'Single, Sidebar, Band, Vienna, Timeline or Dossier — switch any time.' },
      { num: '03', title: 'Type content', body: 'You write, auto-fit sets. Grid, margins and breaks are managed for you.' },
      { num: '04', title: 'Export', body: 'Print-ready A4 PDF — or clean Markdown for AI review.' },
    ],
  },
  faq: {
    eyebrow: 'Frequent questions', h: 'In short.',
    items: [
      { q: 'What does "machine-readable" mean?', a: 'Every résumé can be exported as clean, structured Markdown. So an AI can reliably review, shorten or tailor the content to a job posting — without breaking the layout. The set PDF and the machine-readable version come from the same source.' },
      { q: 'How do I get in?', a: 'CV-Hub is invite-only — built for family and friends. You request access, get a link, and start. No public mass-signup, no waitlist theatre.' },
      { q: 'Will I be tracked?', a: 'Not in the classic sense. We use Umami self-hosted in Falkenstein for anonymous page views — no cookies, no fingerprinting, no IP storage. Your profiles are yours and are not monetized.' },
      { q: 'What formats can I export?', a: 'Print-ready PDF with auto-fit on A4/Letter/Legal/A5 (one, two or three pages, edge-sharp), HTML, JSON, and structured Markdown. All from the same source, always in sync.' },
      { q: 'Can I switch templates mid-application?', a: 'Yes. Content and layout are separate. Switch between the six archetypes and 25 templates — the typesetter places your content again, without re-typing anything.' },
      { q: 'What about ATS applications?', a: 'Every template has an ATS-score badge in the editor. Single-column layouts are ATS-strong, sidebar layouts riskier. Plus an ATS-check modal shows your CV as plain text the way Workday parses it, plus keyword-match against a job posting.' },
    ],
  },
  footer: {
    closingA: 'Ready to set your résumé', closingB: 'anew?',
    cta: 'Request access', cta2: 'See the templates',
    marks: ['Auto-fit · A4', 'Markdown bridge', 'ATS check', 'Invite-only', 'Self-hosted', 'Print-ready'],
    meta: 'Family & Friends · set, not filled in',
  },
};

const FR: typeof DE = {
  nav: { templates: 'Modèles', howItWorks: 'Comment ça marche', faq: 'FAQ', cta: "Demander l'accès", signin: 'Se connecter' },
  request: {
    title: "Demander l'accès",
    lede: "CV-Hub est sur invitation. Dites brièvement qui vous êtes — une fois validé, votre lien d'invitation arrive par e-mail.",
    name: 'Nom', email: 'E-mail', message: 'Message (facultatif)',
    messagePlaceholder: "De quoi s'agit-il ? À quoi vous servirait l'outil ?",
    submit: 'Envoyer la demande', sending: 'Envoi',
    successTitle: 'Demande envoyée.',
    success: "Merci ! Une fois validée, votre lien d'invitation arrivera par e-mail.",
    close: 'Fermer',
    errName: 'Veuillez indiquer votre nom.',
    errEmail: 'Veuillez indiquer une adresse e-mail valide.',
    errGeneric: 'Envoi impossible. Veuillez réessayer plus tard.',
  },
  hero: {
    eyebrow: 'Family & Friends · Invite-only · Sans tracking',
    h1a: "Aujourd'hui, les CV se lisent comme des formulaires.",
    h1b: 'Pas ici.',
    lede: "Vingt modèles composés comme des pages de magazine. Auto-Fit sur A4, passerelle Markdown pour la relecture par IA — et prêt à imprimer en un clic.",
    ctaPrimary: 'Essayer maintenant', ctaSecondary: 'Voir les modèles',
  },
  stats: {
    label: 'Chiffres',
    items: [
      { mark: '×', value: '28', label: "Modèles, prêts à l'emploi" },
      { mark: '×', value: '6', label: 'Archétypes, un seul système' },
      { mark: '↳', value: 'A4', label: 'Auto-Fit, au cordeau' },
      { mark: '·', value: '0', label: 'Trackers, aucun compte à vendre' },
    ],
  },
  manifesto: {
    eyebrow: 'Le parti pris · pourquoi ça existe',
    h1: "Un CV n'est pas un dossier. C'est un", h2: 'éditorial', h3: 'sur vous.',
    sig: '— composé, pas rempli',
  },
  features: {
    eyebrow: "Ce qu'il y a dedans · quatre principes",
    h: 'Conçu pour ceux qui prennent la forme au sérieux.',
    items: [
      { num: '01', tag: 'Mise en page', title: 'Des pages éditoriales, pas des tableaux.', body: "Six archétypes, vingt-huit modèles. Chacun est composé comme une double page — avec grille, hiérarchie et respiration. Pas comme un formulaire à cases.", art: 'spreads' as FeatureArt },
      { num: '02', tag: 'Composition', title: 'Auto-Fit sur A4. Ça tombe juste.', body: "Le contenu coule, la grille tient. Ce que vous tapez se pose aussitôt sur la page — lignes, marges et sauts, c'est la composition qui gère, pas vous. Une page ou deux, au cordeau.", art: 'autofit' as FeatureArt },
      { num: '03', tag: 'Passerelle', title: "Passerelle Markdown pour l'IA.", body: "Exportez chaque CV en Markdown propre et structuré — pour qu'une IA le relise, le raccourcisse ou l'ajuste au poste. Lisible par la machine par nature, sans casser la mise en page.", art: 'bridge' as FeatureArt },
      { num: '04', tag: 'Compte', title: "Jusqu'à cinquante profils, un clic.", body: "La bonne coupe pour chaque candidature — spontanée, senior, créative. Un clic ouvre le bon profil, le reste reste bien rangé.", art: 'profiles' as FeatureArt },
    ],
  },
  gallery: {
    eyebrow: 'Vingt-huit modèles · six archétypes',
    h: 'Un système. Six écritures.',
    cards: [
      { name: 'Single', tag: '1 colonne', desc: 'Une colonne, centrée. Calme maximal pour un texte qui se suffit.' },
      { name: 'Sidebar', tag: 'Rail + corps', desc: 'Rail à gauche pour compétences et contact, texte à droite. Classique, dense, clair.' },
      { name: 'Band', tag: 'Bloc en-tête', desc: 'Un bandeau coloré pose le nom comme un titre. Assuré.' },
      { name: 'Wien', tag: 'Classique', desc: 'Symétrique, deux colonnes, filets de séparation. Pour la DIN allemande classique.' },
      { name: 'Timeline', tag: 'Vertical', desc: 'Ligne verticale, points en marge. Ça raconte plutôt que ça énumère.' },
      { name: 'Dossier', tag: 'Grille, dense', desc: 'Grille modulaire pour beaucoup de contenu. Pour les profils au long parcours.' },
    ],
  },
  steps: {
    eyebrow: 'Comment ça marche · quatre étapes',
    h: 'Du profil vierge au PDF prêt à imprimer.',
    items: [
      { num: '01', title: 'Créer un profil', body: "Jusqu'à cinquante profils par compte. Créez-en un par type de candidature." },
      { num: '02', title: 'Choisir un archétype', body: 'Single, Sidebar, Band, Wien, Timeline ou Dossier — commutable à tout moment.' },
      { num: '03', title: 'Saisir le contenu', body: "Vous écrivez, l'Auto-Fit compose. Grille, marges et sauts, tout est géré." },
      { num: '04', title: 'Exporter', body: 'PDF prêt à imprimer en A4 — ou Markdown propre pour la relecture par IA.' },
    ],
  },
  faq: {
    eyebrow: 'Questions fréquentes', h: 'En bref.',
    items: [
      { q: 'Que signifie « lisible par la machine » ?', a: "Chaque CV s'exporte en Markdown propre et structuré. Une IA peut ainsi le relire, le raccourcir ou l'ajuster à un poste de façon fiable — sans abîmer la mise en page. Le PDF composé et la version lisible par la machine viennent de la même source." },
      { q: "Comment obtenir l'accès ?", a: "CV-Hub est sur invitation — pensé pour Family & Friends. Vous demandez l'accès, recevez un lien et démarrez aussitôt. Pas d'inscription de masse, pas de liste d'attente pour la forme." },
      { q: 'Suis-je pisté ?', a: "Pas de pistage classique. Nous utilisons Umami auto-hébergé à Falkenstein pour des pages vues anonymes — sans cookie, sans empreinte, sans stockage d'IP. Vos profils vous appartiennent et ne sont pas monétisés." },
      { q: 'Quels formats puis-je exporter ?', a: "PDF prêt à imprimer avec Auto-Fit sur A4/Letter/Legal/A5 (une, deux ou trois pages, au cordeau), export HTML, export JSON et Markdown structuré. Tout depuis la même source, toujours synchronisé." },
      { q: 'Puis-je changer de modèle en pleine candidature ?', a: "Oui. Le contenu et la mise en page sont séparés. Passez d'un archétype à l'autre parmi les six et les 25 modèles — la composition replace votre contenu sans que vous ne retapiez rien." },
      { q: 'Et pour les candidatures ATS ?', a: "Chaque modèle affiche un badge de score ATS dans l'éditeur. Les mises en page à une colonne sont solides côté ATS, les sidebars plus risquées. En prime : une fenêtre ATS montre votre CV en texte brut, tel qu'un parseur Workday le voit, plus la correspondance de mots-clés avec une offre." },
    ],
  },
  footer: {
    closingA: 'Prêt à recomposer', closingB: 'votre CV ?',
    cta: "Demander l'accès", cta2: 'Voir les modèles',
    marks: ['Auto-Fit · A4', 'Passerelle Markdown', 'Contrôle ATS', 'Invite-only', 'Self-hosted', 'Prêt à imprimer'],
    meta: 'Family & Friends · composé, pas rempli',
  },
};

const ES: typeof DE = {
  nav: { templates: 'Plantillas', howItWorks: 'Cómo funciona', faq: 'FAQ', cta: 'Solicitar acceso', signin: 'Iniciar sesión' },
  request: {
    title: 'Solicitar acceso',
    lede: 'CV-Hub es solo por invitación. Cuéntanos brevemente quién eres — una vez aprobado, tu enlace de invitación llegará por e-mail.',
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
    eyebrow: 'Family & Friends · Invite-only · Sin tracking',
    h1a: 'Hoy los CV se leen como formularios.',
    h1b: 'Aquí no.',
    lede: 'Veinte plantillas compuestas como páginas de revista. Auto-Fit en A4, puente Markdown para la corrección por IA, y listo para imprimir en un clic.',
    ctaPrimary: 'Probar ahora', ctaSecondary: 'Ver las plantillas',
  },
  stats: {
    label: 'Cifras',
    items: [
      { mark: '×', value: '28', label: 'Plantillas, listas para usar' },
      { mark: '×', value: '6', label: 'Arquetipos, un sistema' },
      { mark: '↳', value: 'A4', label: 'Auto-Fit, al milímetro' },
      { mark: '·', value: '0', label: 'Trackers, sin venta de cuentas' },
    ],
  },
  manifesto: {
    eyebrow: 'La postura · por qué existe',
    h1: 'Un CV no es un trámite. Es un', h2: 'editorial', h3: 'sobre ti.',
    sig: '— compuesto, no rellenado',
  },
  features: {
    eyebrow: 'Lo que hay dentro · cuatro principios',
    h: 'Hecho para quienes se toman la forma en serio.',
    items: [
      { num: '01', tag: 'Maquetación', title: 'Páginas editoriales, no tablas.', body: 'Seis arquetipos, veintiocho plantillas. Cada una compuesta como una doble página: con retícula, jerarquía y aire. No como un formulario con casillas.', art: 'spreads' as FeatureArt },
      { num: '02', tag: 'Composición', title: 'Auto-Fit en A4. Simplemente encaja.', body: 'El contenido fluye, la retícula aguanta. Lo que escribes se asienta al instante en la página: líneas, márgenes y saltos los resuelve la composición, no tú. Una página o dos, al milímetro.', art: 'autofit' as FeatureArt },
      { num: '03', tag: 'Puente', title: 'Puente Markdown para la IA.', body: 'Exporta cada CV como Markdown limpio y estructurado, para que una IA lo revise, lo acorte o lo ajuste al puesto. Legible por máquina por diseño, sin romper la maquetación.', art: 'bridge' as FeatureArt },
      { num: '04', tag: 'Cuenta', title: 'Hasta cincuenta perfiles, un clic.', body: 'El corte justo para cada candidatura: espontánea, senior, creativa. Un clic abre el perfil adecuado, el resto queda bien guardado.', art: 'profiles' as FeatureArt },
    ],
  },
  gallery: {
    eyebrow: 'Veintiocho plantillas · seis arquetipos',
    h: 'Un sistema. Seis firmas.',
    cards: [
      { name: 'Single', tag: '1 columna', desc: 'Una columna, centrada. Calma máxima para un texto que habla por sí solo.' },
      { name: 'Sidebar', tag: 'Rail + cuerpo', desc: 'Rail izquierdo para competencias y contacto, texto a la derecha. Clásico, denso, claro.' },
      { name: 'Band', tag: 'Bloque cabecera', desc: 'Un bloque de color coloca el nombre como un titular. Con aplomo.' },
      { name: 'Wien', tag: 'Clásico', desc: 'Simétrico, dos columnas, con filetes. Para la DIN alemana clásica.' },
      { name: 'Timeline', tag: 'Vertical', desc: 'Línea vertical, puntos al margen. Narra en vez de enumerar.' },
      { name: 'Dossier', tag: 'Retícula, densa', desc: 'Retícula modular para mucho contenido. Para perfiles de larga trayectoria.' },
    ],
  },
  steps: {
    eyebrow: 'Cómo funciona · cuatro pasos',
    h: 'Del perfil vacío al PDF listo para imprimir.',
    items: [
      { num: '01', title: 'Crear un perfil', body: 'Hasta cincuenta perfiles por cuenta. Crea uno por tipo de candidatura.' },
      { num: '02', title: 'Elegir arquetipo', body: 'Single, Sidebar, Band, Wien, Timeline o Dossier: intercambiables en cualquier momento.' },
      { num: '03', title: 'Escribir el contenido', body: 'Tú escribes, Auto-Fit compone. Retícula, márgenes y saltos van solos.' },
      { num: '04', title: 'Exportar', body: 'PDF listo para imprimir en A4, o Markdown limpio para la corrección por IA.' },
    ],
  },
  faq: {
    eyebrow: 'Preguntas frecuentes', h: 'En breve.',
    items: [
      { q: '¿Qué significa «legible por máquina»?', a: 'Cada CV se exporta como Markdown limpio y estructurado. Así una IA puede revisarlo, acortarlo o ajustarlo a un puesto de forma fiable, sin estropear la maquetación. El PDF compuesto y la versión legible por máquina salen de la misma fuente.' },
      { q: '¿Cómo entro?', a: 'CV-Hub es solo por invitación, pensado para Family & Friends. Solicitas acceso, recibes un enlace y empiezas al instante. Sin registro masivo, sin lista de espera de escaparate.' },
      { q: '¿Me rastrean?', a: 'Nada de rastreo clásico. Usamos Umami autoalojado en Falkenstein para vistas de página anónimas: sin cookies, sin fingerprinting, sin almacenar IP. Tus perfiles son tuyos y no se monetizan.' },
      { q: '¿Qué formatos puedo exportar?', a: 'PDF listo para imprimir con Auto-Fit en A4/Letter/Legal/A5 (una, dos o tres páginas, al milímetro), exportación HTML, exportación JSON y Markdown estructurado. Todo desde la misma fuente, siempre sincronizado.' },
      { q: '¿Puedo cambiar de plantilla a mitad de candidatura?', a: 'Sí. Contenido y maquetación van por separado. Cambia entre los seis arquetipos y las 25 plantillas: la composición recoloca tu contenido sin que reescribas nada.' },
      { q: '¿Y las candidaturas ATS?', a: 'Cada plantilla muestra una insignia de puntuación ATS en el editor. Las maquetaciones a una columna son fuertes en ATS; las de sidebar, más arriesgadas. Además, una ventana de comprobación ATS muestra tu CV en texto plano, tal como lo lee un parser de Workday, con coincidencia de palabras clave frente a una oferta.' },
    ],
  },
  footer: {
    closingA: '¿Listo para recomponer', closingB: 'tu CV?',
    cta: 'Solicitar acceso', cta2: 'Ver las plantillas',
    marks: ['Auto-Fit · A4', 'Puente Markdown', 'Chequeo ATS', 'Invite-only', 'Self-hosted', 'Listo para imprimir'],
    meta: 'Family & Friends · compuesto, no rellenado',
  },
};

const COPY: Record<UiLang, typeof DE> = { de: DE, en: EN, fr: FR, es: ES };
const LANG_ORDER: UiLang[] = ['de', 'en', 'fr', 'es'];
