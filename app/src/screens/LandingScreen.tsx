/**
 * Startseite (Runde 8, 10.10.2026).
 *
 * Linie: „Dein Lebenslauf, maschinenlesbar gesetzt." Die Seite zeigt echte
 * Bildschirmfotos der App (scripts/landing-shots.mjs), die echte Textebene
 * des Demo-PDFs (zweimal ausgelesen) und erklärt, was ein
 * Bewerbermanagement-System mit einem Lebenslauf macht. Texte in
 * src/landing/copy.ts, vier Sprachen.
 *
 * Vorgerendert: scripts/landing-prerender.mjs rendert diese Komponente beim
 * Bau für /, /en/, /fr/ und /es/ (Prop `ssr`). Die Sprache der Seite folgt
 * deshalb dem PFAD, nicht dem Browser: Eine Suchmaschine soll unter / den
 * deutschen Text sehen. Wer eine andere Sprache bevorzugt, bekommt unten einen
 * Hinweis mit Link. Die Oberflächensprache des Editors bleibt, wie sie war
 * (gespeicherte Wahl oder Browser); erst ein Klick auf die Sprachwahl hier
 * stellt beides um.
 *
 * Klassen tragen das Präfix lp-, damit nichts in App, Editor oder Anmeldung
 * durchschlägt. Prüfläufe verlassen sich auf: den Knopf „Direkt ausprobieren"
 * (Rolle button), „Demo starten" in der Kopfleiste, „Anmelden",
 * `.lp-nav-links a[href="/preise"]`, `.lp-footer a[href=…]`, `#preise` und
 * `[data-faq="access"]`.
 */
import { useEffect, useRef, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { api } from '../data/api';
import { track } from '../data/track';
import './landing.css';
import { PricingCards } from '../billing/PricingPage';
import { billingFor, priceOf } from '../billing/format';
import { SOURCE_REPO_URL, sourceFileUrl } from '../data/urls';
import { freeTierLimited } from '../billing/freeTier';
import { FREE_TEMPLATE_IDS } from '../templates/freeTemplates';
import { useOffer, salesOpen, registrationOpen } from '../billing/hooks';
import { PATHS, linkClick } from '../billing/route';
import { cancelUi } from '../billing/legalTexts';
import type { Offer } from '../billing/api';
import { PICKABLE_THEMES } from '../templates/theme';
import { atsLabel, type AtsLevel } from '../templates/atsScore';
import { LANDING_COPY, LANDING_LANGS, landingPath, langFromPath, type LandingCopy } from '../landing/copy';
import { faqFor } from '../landing/faqFor';
import { embeddedLandingData, useMagazinArticles, type MagazinArticle } from '../landing/data';
import { useReveal } from '../landing/useReveal';
import HeroShowcase from '../landing/HeroShowcase';
import TextLayer from '../landing/TextLayer';
import Gallery from '../landing/Gallery';
import Picture from '../landing/Picture';
import { shot } from '../landing/shot';
import { BRAND } from '../landing/brand.js';
import '../billing/billing.css';

/** Werte der vorgerenderten Fassung (scripts/landing-prerender.mjs). */
export interface LandingSsr {
  lang: UiLang;
  offer: Offer | null;
  articles: MagazinArticle[];
}

interface Props {
  onSignIn: () => void;
  onDemoStart: () => void;
  lang: UiLang;
  onLangChange: (l: UiLang) => void;
  /** Früher Impressum/Datenschutz; die Fußzeile verlinkt jetzt direkt. */
  onLegal?: (page: 'impressum' | 'privacy') => void;
  ssr?: LandingSsr;
}

const UI_LANG_KEY = 'appstudio-ui-lang';
const NAV_DEMO: Record<UiLang, string> = { de: 'Demo starten', en: 'Try the demo', fr: 'Essayer la démo', es: 'Probar la demo' };
const LANG_SHORT: Record<UiLang, string> = { de: 'DE', en: 'EN', fr: 'FR', es: 'ES' };
const SCRIPTS_URL = sourceFileUrl('app/scripts/pdfcheck.mjs');
/** Magazin-Artikel, auf den der KI-Abschnitt verweist. */
const AI_ARTICLE = '/magazin/lebenslauf-mit-ki-schreiben-ohne-erfindungen/';
const MD_SNIPPET: Record<UiLang, string> = {
  de: '---\nlang: de\npageMode: one\n---\n\n# Lena Brandt\n**Senior Product Designer**\n\n## Berufserfahrung\n\n### Senior Product Designer\nNordhub GmbH · Hamburg · 01/2023 – heute\n- Design System für vier Produktbereiche',
  en: '---\nlang: en\npageMode: one\n---\n\n# Lena Brandt\n**Senior Product Designer**\n\n## Experience\n\n### Senior Product Designer\nNordhub GmbH · Hamburg · 01/2023 – present\n- Design system for four product areas',
  fr: '---\nlang: fr\npageMode: one\n---\n\n# Lena Brandt\n**Senior Product Designer**\n\n## Expérience professionnelle\n\n### Senior Product Designer\nNordhub GmbH · Hambourg · 01/2023 – aujourd’hui\n- Design system pour quatre produits',
  es: '---\nlang: es\npageMode: one\n---\n\n# Lena Brandt\n**Senior Product Designer**\n\n## Experiencia\n\n### Senior Product Designer\nNordhub GmbH · Hamburgo · 01/2023 – actualidad\n- Design system para cuatro áreas de producto',
};

/** Bevorzugte Sprache der Person: gespeicherte Wahl, sonst Browser. */
function preferredLang(): { lang: UiLang | null; stored: boolean } {
  try {
    const s = localStorage.getItem(UI_LANG_KEY);
    if (s && (LANDING_LANGS as string[]).includes(s)) return { lang: s as UiLang, stored: true };
  } catch { /* ignore */ }
  const list = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  for (const l of list) {
    const tag = (l || '').toLowerCase();
    const hit = LANDING_LANGS.find(c => tag.startsWith(c));
    if (hit) return { lang: hit, stored: false };
  }
  return { lang: null, stored: false };
}

export default function LandingScreen({ onSignIn, onDemoStart, lang, onLangChange, ssr }: Props) {
  const isSsr = !!ssr;
  const [embedded] = useState(() => (isSsr ? null : embeddedLandingData()));
  const [path, setPath] = useState(() => (isSsr ? landingPath(ssr.lang) : window.location.pathname));
  const pageLang: UiLang = isSsr ? ssr.lang : (langFromPath(path) ?? lang);
  const t = LANDING_COPY[pageLang] ?? LANDING_COPY.de;
  const n = PICKABLE_THEMES.length;

  const { offer: liveOffer, loaded } = useOffer();
  // Angebot: erst das vom Bau (gleicher erster Stand wie das vorgerenderte
  // HTML), dann das vom Server. Antwortet der Server gar nicht, bleibt das vom Bau.
  const offer: Offer | null = isSsr ? ssr.offer : (loaded ? (liveOffer ?? embedded?.offer ?? null) : (embedded?.offer ?? null));
  const bt = billingFor(pageLang, offer);
  const articles = useMagazinArticles(isSsr ? ssr.articles : (embedded ? embedded.articles : null)).slice(0, 6);
  const faq = faqFor(pageLang, offer);
  // Vorlagen-Staffel: Kennzeichen „Pass" nur bei aktiver Gratis-Grenze.
  const limited = freeTierLimited(offer);

  const [requestOpen, setRequestOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hint, setHint] = useState<UiLang | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef, [pageLang, articles.length, !!offer]);

  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  // Titel und Sprache des Dokuments folgen der Seite (für Rückkehr aus der
  // App und Sprachwechsel ohne Neuladen; die vorgerenderte Fassung hat beides
  // schon im HTML).
  useEffect(() => {
    document.documentElement.lang = pageLang;
    document.title = `${t.meta.title(n)} · ${BRAND.name}`;
  }, [pageLang, t, n]);

  // Hinweis auf die bevorzugte Sprache, wenn die Seite in einer anderen steht.
  useEffect(() => {
    const pref = preferredLang();
    let dismissed = false;
    try { dismissed = sessionStorage.getItem('lp-lang-hint') === '1'; } catch { /* ignore */ }
    // Kurz nach dem Laden einblenden (eigene Ebene, verschiebt nichts).
    const t = window.setTimeout(() => setHint(pref.lang && pref.lang !== pageLang && !dismissed ? pref.lang : null), 900);
    return () => window.clearTimeout(t);
  }, [pageLang]);

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'smooth';
    return () => { html.style.scrollBehavior = prev; };
  }, []);

  const startDemo = () => { track('demo_start', { from: 'landing', lang: pageLang }); onDemoStart(); };
  const demoLink = (e: React.MouseEvent) => { e.preventDefault(); startDemo(); };
  const goSignIn = () => { track('signin_click'); onSignIn(); };
  const openRequest = () => { track('request_open'); setRequestOpen(true); };
  const switchLang = (l: UiLang) => (e: React.MouseEvent) => {
    e.preventDefault();
    const p = landingPath(l);
    try { if (window.location.pathname !== p) window.history.pushState({}, '', p); } catch { /* ignore */ }
    setPath(p);
    setMenuOpen(false);
    setHint(null);
    track('landing_lang', { lang: l });
    onLangChange(l);
  };
  const closeHint = () => { setHint(null); try { sessionStorage.setItem('lp-lang-hint', '1'); } catch { /* ignore */ } };
  const open = salesOpen(offer);
  const regOpen = registrationOpen(offer);

  const langLinks = (cls: string) => (
    <ul className={cls} aria-label={t.nav.lang}>
      {LANDING_LANGS.map(l => (
        <li key={l}>
          <a href={landingPath(l)} hrefLang={l} lang={l} aria-current={l === pageLang ? 'true' : undefined}
            onClick={switchLang(l)} title={LANDING_COPY[l].langName}>{LANG_SHORT[l]}</a>
        </li>
      ))}
    </ul>
  );

  const navItems = (
    <>
      <a href="#ats" onClick={() => setMenuOpen(false)}>{t.nav.ats}</a>
      <a href="#vorlagen" onClick={() => setMenuOpen(false)}>{t.nav.templates}</a>
      <a href="#funktionen" onClick={() => setMenuOpen(false)}>{t.nav.features}</a>
      {offer && <a href={PATHS.pricing} onClick={linkClick(PATHS.pricing)}>{bt.pricing}</a>}
      <a href="/magazin/">{t.nav.magazin}</a>
      <a href="#faq" onClick={() => setMenuOpen(false)}>{t.nav.faq}</a>
    </>
  );

  return (
    <div className="lp-root" ref={rootRef} lang={pageLang}>
      <a className="lp-skip" href="#lp-main">{t.skip}</a>

      <header className="lp-nav">
        <div className="lp-nav-in">
          <a className="lp-brand" href={landingPath(pageLang)} aria-label={`${BRAND.name} · ${t.nav.home}`}>
            <Mark /><Wordmark />
          </a>
          <nav className="lp-nav-links" aria-label={t.nav.label}>{navItems}</nav>
          <div className="lp-nav-end">
            {langLinks('lp-langs lp-hide-sm')}
            <button type="button" className="lp-signin lp-hide-sm" onClick={goSignIn}>{t.nav.signin}</button>
            <a className="lp-btn lp-btn-dark lp-nav-cta" href="/demo" onClick={demoLink}>{NAV_DEMO[pageLang]}</a>
            <button type="button" className="lp-menu-btn" aria-expanded={menuOpen} aria-controls="lp-menu"
              aria-label={menuOpen ? t.nav.close : t.nav.menu} onClick={() => setMenuOpen(o => !o)}>
              <span className="lp-menu-ico" aria-hidden data-open={menuOpen ? '1' : undefined}><i /><i /></span>
            </button>
          </div>
        </div>
        <div id="lp-menu" className="lp-menu" hidden={!menuOpen}>
          <nav className="lp-menu-links" aria-label={t.nav.menu}>{navItems}</nav>
          <div className="lp-menu-foot">
            {langLinks('lp-langs')}
            <button type="button" className="lp-signin" onClick={() => { setMenuOpen(false); goSignIn(); }}>{t.nav.signin}</button>
          </div>
        </div>
      </header>

      <main id="lp-main">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="lp-hero" aria-labelledby="lp-h1">
          <div className="lp-wrap lp-hero-grid">
            <div className="lp-hero-copy">
              <p className="lp-eyebrow"><span className="lp-eyebrow-dot" aria-hidden />{t.hero.eyebrow}</p>
              <h1 id="lp-h1" className="lp-h1">{t.hero.h1a} <span className="lp-h1-accent">{t.hero.h1b}</span></h1>
              <p className="lp-lede">{t.hero.lede}</p>
              <div className="lp-cta-row">
                <button type="button" className="lp-btn lp-btn-dark lp-btn-lg" onClick={startDemo}>
                  {t.hero.ctaPrimary}<span className="lp-btn-ico" aria-hidden><Arrow /></span>
                </button>
                <a className="lp-btn lp-btn-ghost lp-btn-lg" href="#ats">{t.hero.ctaSecondary}</a>
              </div>
              <ul className="lp-proof">
                {t.hero.proof.map(p => <li key={p}><Tick />{p}</li>)}
              </ul>
            </div>
            <HeroShowcase lang={pageLang} alt={t.hero.shotAlt} chipText={t.hero.chipText} chipAts={t.hero.chipAts} />
          </div>
        </section>

        {/* ── Zahlen ───────────────────────────────────────────────────── */}
        <section className="lp-facts" aria-label={t.facts.label}>
          <div className="lp-wrap">
            <ul className="lp-facts-grid">
              {t.facts.items(n).map(f => (
                <li key={f.label}><span className="lp-fact-num">{f.value}</span><span className="lp-fact-lab">{f.label}</span></li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── So liest ein ATS ─────────────────────────────────────────── */}
        <section id="ats" className="lp-ats" aria-labelledby="lp-ats-h">
          <div className="lp-wrap">
            <SectHead eyebrow={t.ats.eyebrow} id="lp-ats-h" h={t.ats.h} lede={t.ats.intro} dark />
            <TextLayer lang={pageLang} t={t.ats} />

            <div className="lp-problems">
              <div className="lp-problems-head" data-rv>
                <h3>{t.ats.problemsTitle}</h3>
                <p>{t.ats.problemsSub}</p>
              </div>
              <ol className="lp-problems-grid">
                {t.ats.problems.map((p, i) => (
                  <li key={p.title} data-rv style={{ ['--i' as string]: i }}>
                    <span className="lp-prob-no" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                    <h4>{p.title}</h4>
                    <p>{p.body}</p>
                    <p className="lp-prob-src">{p.src}</p>
                  </li>
                ))}
              </ol>
              <p className="lp-schema-note">{t.ats.schemaNote}</p>
            </div>

            <div className="lp-marks" data-rv>
              <h3>{t.ats.marksTitle}</h3>
              <ul>
                {(['high', 'medium', 'low'] as AtsLevel[]).map(l => (
                  <li key={l}>
                    <span className={`lp-mark lp-mark-${l}`}><span aria-hidden className="lp-mark-dot" />{atsLabel(l, pageLang)}</span>
                    <p>{t.ats.marks[l]}</p>
                  </li>
                ))}
              </ul>
              <p className="lp-marks-foot">{t.ats.marksFoot}</p>
            </div>

            <div className="lp-honest" data-rv>
              <div>
                <h3>{t.ats.honestTitle}</h3>
                <p>{t.ats.honest}</p>
                <a className="lp-arrow-link" href={SCRIPTS_URL} target="_blank" rel="noopener noreferrer">{t.ats.scriptsLink}<Arrow /></a>
              </div>
              <div className="lp-sources">
                <p className="lp-sources-lab">{t.ats.sourcesLabel}</p>
                <ul>
                  {t.ats.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.label}</a></li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Mit KI arbeiten ──────────────────────────────────────────── */}
        <section id="ki" className="lp-sect lp-sect-alt" aria-labelledby="lp-ai-h">
          <div className="lp-wrap">
            <SectHead eyebrow={t.ai.eyebrow} id="lp-ai-h" h={t.ai.h} lede={t.ai.intro} split />
            <ul className="lp-ai-grid">
              <li className="lp-ai-card" data-rv data-ai="bridge">
                <p className="lp-feat-tag">{t.ai.bridge.tag}</p>
                <h3>{t.ai.bridge.title}</h3>
                <p>{t.ai.bridge.body}</p>
              </li>
              <li className="lp-ai-card" data-rv data-ai="mcp" style={{ ['--i' as string]: 1 }}>
                <p className="lp-feat-tag">{offer ? t.ai.mcp.tagPass : t.ai.mcp.tagAccount}</p>
                <h3>{t.ai.mcp.title}</h3>
                <p>{t.ai.mcp.body}</p>
              </li>
            </ul>
            <p className="lp-ai-foot" data-rv>
              {t.ai.foot}{' '}
              <a className="lp-arrow-link" href={AI_ARTICLE} lang={pageLang === 'de' ? undefined : 'de'}>{t.ai.footLink}<Arrow /></a>
            </p>
          </div>
        </section>

        {/* ── Vorlagen ─────────────────────────────────────────────────── */}
        <section id="vorlagen" className="lp-sect" aria-labelledby="lp-gal-h">
          <div className="lp-wrap">
            <SectHead eyebrow={t.gallery.eyebrow} id="lp-gal-h" h={t.gallery.h(n)} lede={t.gallery.lede} split />
            <Gallery lang={pageLang} showAll={t.gallery.showAll(n)} passTag={limited ? t.gallery.passTag : undefined} />
            <p className="lp-note">{t.gallery.legend}{limited && <> {t.gallery.passLegend(FREE_TEMPLATE_IDS.length)}</>}</p>
          </div>
        </section>

        {/* ── Funktionen ───────────────────────────────────────────────── */}
        <section id="funktionen" className="lp-sect lp-sect-alt" aria-labelledby="lp-feat-h">
          <div className="lp-wrap">
            <SectHead eyebrow={t.features.eyebrow} id="lp-feat-h" h={t.features.h} />
            <Features t={t} lang={pageLang} />
          </div>
        </section>

        {/* ── Preise (nur mit Angebot vom Server) ──────────────────────── */}
        {offer && (
          <section className="lp-sect" id="preise" aria-labelledby="lp-preise-h">
            <div className="lp-wrap">
              <SectHead eyebrow={bt.landingEyebrow} id="lp-preise-h" h={bt.landingH(priceOf(offer, pageLang))} lede={bt.landingLede} />
              <div className="ui lp-pricing" data-rv>
                <PricingCards lang={pageLang} offer={offer} onFree={startDemo} headingLevel={3} />
                <p className="lp-pricing-more">
                  <a className="lp-arrow-link" href={PATHS.pricing} onClick={linkClick(PATHS.pricing)}>{bt.landingMore}<Arrow /></a>
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Magazin ──────────────────────────────────────────────────── */}
        {articles.length > 0 && (
          <section className="lp-sect lp-sect-alt" id="magazin" aria-labelledby="lp-mag-h">
            <div className="lp-wrap">
              <SectHead eyebrow={t.magazin.eyebrow} id="lp-mag-h" h={t.magazin.h} lede={t.magazin.lede} split />
              <ul className="lp-mag-grid">
                {articles.map((a, i) => (
                  <li key={a.slug} data-rv style={{ ['--i' as string]: i % 3 }}>
                    <article className="lp-mag-card" lang={a.lang !== pageLang ? a.lang : undefined}>
                      {a.categoryName && <p className="lp-mag-cat">{a.categoryName}</p>}
                      <h3><a href={`/magazin/${a.slug}/`}>{a.title}</a></h3>
                      <p className="lp-mag-desc">{a.description}</p>
                      <p className="lp-mag-meta"><time dateTime={a.updated}>{formatDate(a.updated, pageLang)}</time><span>{t.magazin.minutes(a.minutes)}</span></p>
                    </article>
                  </li>
                ))}
              </ul>
              <p className="lp-mag-all"><a className="lp-btn lp-btn-soft" href="/magazin/">{t.magazin.all}<span className="lp-btn-ico" aria-hidden><Arrow /></span></a></p>
            </div>
          </section>
        )}

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="lp-sect" id="faq" aria-labelledby="lp-faq-h">
          <div className="lp-wrap lp-faq-grid">
            <SectHead eyebrow={t.faq.eyebrow} id="lp-faq-h" h={t.faq.h} />
            <div className="lp-faq-list">
              {faq.map((q, i) => (
                <details key={q.id} className="lp-qa" open={i === 0} data-faq={q.id}>
                  <summary><span>{q.q}</span><span className="lp-qa-sign" aria-hidden /></summary>
                  <div className="lp-qa-a"><p>{linkify(q.a)}</p></div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Schluss ──────────────────────────────────────────────────── */}
        <section className="lp-closing" aria-labelledby="lp-close-h">
          <div className="lp-wrap" data-rv>
            <h2 id="lp-close-h">{t.closing.h1} <span>{t.closing.h2}</span></h2>
            <p>{t.closing.lede}</p>
            <div className="lp-cta-row lp-cta-center">
              <button type="button" className="lp-btn lp-btn-light lp-btn-lg" onClick={startDemo}>
                {t.hero.ctaPrimary}<span className="lp-btn-ico" aria-hidden><Arrow /></span>
              </button>
              {!open && !regOpen
                ? <button type="button" className="lp-btn lp-btn-outline-light lp-btn-lg" onClick={openRequest}>{t.nav.cta}</button>
                : <a className="lp-btn lp-btn-outline-light lp-btn-lg" href="#vorlagen">{t.closing.ctaSecondary}</a>}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div className="lp-foot-brand">
              <a className="lp-brand" href={landingPath(pageLang)} aria-label={`${BRAND.name} · ${t.nav.home}`}><Mark /><Wordmark /></a>
              <p>{t.hero.h1a} {t.hero.h1b}</p>
              {langLinks('lp-langs lp-langs-foot')}
            </div>
            <nav aria-label={t.footer.product}>
              <p className="lp-foot-h">{t.footer.product}</p>
              <ul>
                <li><a href="#vorlagen">{t.nav.templates}</a></li>
                <li><a href="#funktionen">{t.nav.features}</a></li>
                <li><a href="#ats">{t.nav.ats}</a></li>
                {offer && <li><a href={PATHS.pricing} onClick={linkClick(PATHS.pricing)}>{bt.pricing}</a></li>}
                <li><a href="/magazin/">{t.nav.magazin}</a></li>
                {/* Der Quelltext ist das stärkste Argument der Seite: nachlesbar statt behauptet. */}
                <li><a href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer">{t.nav.source}</a></li>
              </ul>
            </nav>
            <nav aria-label={t.footer.legal}>
              <p className="lp-foot-h">{t.footer.legal}</p>
              <ul>
                <li><a href={PATHS.imprint} onClick={linkClick(PATHS.imprint)}>{t.footer.imprint}</a></li>
                <li><a href={PATHS.privacy} onClick={linkClick(PATHS.privacy)}>{t.footer.privacy}</a></li>
                <li><a href={PATHS.terms} onClick={linkClick(PATHS.terms)}>{bt.terms}</a></li>
                <li><a href={PATHS.withdrawalPolicy} onClick={linkClick(PATHS.withdrawalPolicy)}>{bt.withdrawalPolicy}</a></li>
                <li><a href={PATHS.withdraw} onClick={linkClick(PATHS.withdraw)}>{bt.withdrawLink}</a></li>
                <li><a href={PATHS.cancel} onClick={linkClick(PATHS.cancel)}>{cancelUi(pageLang, offer).buttonCancel}</a></li>
              </ul>
            </nav>
          </div>
          <div className="lp-foot-meta">
            <span>© {new Date().getFullYear()} {BRAND.name}</span>
            <span>{t.footer.meta}</span>
          </div>
        </div>
      </footer>

      {hint && (
        <div className="lp-hint" role="status" lang={hint}>
          <span>{LANDING_COPY[hint].langHint}</span>
          <a href={landingPath(hint)} hrefLang={hint} onClick={switchLang(hint)}>{LANDING_COPY[hint].langHintLink}</a>
          <button type="button" onClick={closeHint} aria-label={LANDING_COPY[hint].request.close}>×</button>
        </div>
      )}

      {requestOpen && <RequestAccessModal t={t.request} onClose={() => setRequestOpen(false)} />}
    </div>
  );
}

// ── Bausteine ───────────────────────────────────────────────────────────────

function SectHead({ eyebrow, id, h, lede, dark, split }: { eyebrow: string; id: string; h: string; lede?: string; dark?: boolean; split?: boolean }) {
  return (
    <div className={`lp-head${split ? ' lp-head-split' : ''}`} data-rv>
      <div>
        <p className={`lp-eyebrow${dark ? ' lp-eyebrow-dark' : ''}`}><span className="lp-eyebrow-dot" aria-hidden />{eyebrow}</p>
        <h2 id={id} className="lp-h2">{h}</h2>
      </div>
      {lede && <p className="lp-sect-lede">{lede}</p>}
    </div>
  );
}

const ZIG: { id: 'editor' | 'design' | 'check' | 'export'; key: string }[] = [
  { id: 'editor', key: 'editor' },
  { id: 'design', key: 'design' },
  { id: 'check', key: 'check' },
  { id: 'export', key: 'export' },
];

function Features({ t, lang }: { t: LandingCopy; lang: UiLang }) {
  const item = (id: string) => t.features.items.find(f => f.id === id)!;
  const phone = shot(`phone-${lang}`) ?? shot('phone-de');
  const phoneF = item('phone'), bridge = item('bridge'), openF = item('open');
  return (
    <>
      <div className="lp-feats">
        {ZIG.map((z, i) => {
          const f = item(z.id);
          const img = shot(`${z.key}-${lang}`) ?? shot(`${z.key}-de`);
          return (
            <article key={z.id} className={`lp-feat${i % 2 ? ' is-rev' : ''}`}>
              <div className="lp-feat-text" data-rv>
                <p className="lp-feat-tag">{f.tag}</p>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
              {img && (
                <div className="lp-feat-media" data-rv>
                  <div className="lp-bezel"><div className="lp-bezel-in">
                    <Picture img={img} alt={f.alt} sizes="(max-width: 900px) calc(100vw - 32px), 640px" />
                  </div></div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <div className="lp-bento">
        <article className="lp-tile lp-tile-phone" data-rv>
          <div className="lp-tile-text">
            <p className="lp-feat-tag">{phoneF.tag}</p>
            <h3>{phoneF.title}</h3>
            <p>{phoneF.body}</p>
          </div>
          {phone && (
            <div className="lp-phone">
              <Picture img={phone} alt={phoneF.alt} sizes="300px" />
            </div>
          )}
        </article>
        <article className="lp-tile lp-tile-code" data-rv style={{ ['--i' as string]: 1 }}>
          <div className="lp-tile-text">
            <p className="lp-feat-tag">{bridge.tag}</p>
            <h3>{bridge.title}</h3>
            <p>{bridge.body}</p>
          </div>
          <figure className="lp-code">
            <pre tabIndex={0} aria-label={t.features.bridgeCaption}><code>{MD_SNIPPET[lang]}</code></pre>
            <figcaption>{t.features.bridgeCaption}</figcaption>
          </figure>
        </article>
        <article className="lp-tile lp-tile-open" data-rv style={{ ['--i' as string]: 2 }}>
          <div className="lp-tile-text">
            <p className="lp-feat-tag">{openF.tag}</p>
            <h3>{openF.title}</h3>
            <p>{openF.body}</p>
          </div>
          <a className="lp-arrow-link" href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer">{t.nav.source}<Arrow /></a>
        </article>
      </div>
    </>
  );
}

/** Adressen in FAQ-Antworten als Link zeigen. Der sichtbare Text bleibt
 *  derselbe wie im FAQPage-Datenblock (seocheck vergleicht beides). */
function linkify(text: string): React.ReactNode {
  const parts = text.split(/(https:\/\/[^\s,;)]*[^\s,;.)])/);
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
    : part));
}

function formatDate(iso: string, lang: UiLang): string {
  const loc = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' }[lang];
  try { return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)); }
  catch { return iso.slice(0, 10); }
}

function RequestAccessModal({ t, onClose }: { t: LandingCopy['request']; onClose: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // Honeypot: bleibt für echte Nutzer leer
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
            <p className="lp-modal-h">{t.successTitle}</p>
            <p className="lp-modal-lede">{t.success}</p>
            <button type="button" className="lp-btn lp-btn-dark" onClick={onClose}>{t.close}</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="lp-modal-h">{t.title}</p>
            <p className="lp-modal-lede">{t.lede}</p>
            <label className="lp-field"><span>{t.name}</span>
              <input value={name} onChange={e => setName(e.target.value)} autoFocus maxLength={120} autoComplete="name" /></label>
            <label className="lp-field"><span>{t.email}</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={200} autoComplete="email" /></label>
            <label className="lp-field"><span>{t.message}</span>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder={t.messagePlaceholder} /></label>
            {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus */}
            <input className="lp-hp" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} aria-hidden="true" />
            {err && <div className="lp-modal-err" role="alert">{err}</div>}
            <button type="submit" className="lp-btn lp-btn-dark lp-modal-submit" disabled={busy}>{busy ? `${t.sending}…` : t.submit}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Mark() {
  return (
    <svg className="lp-mark-svg" viewBox="0 0 30 30" fill="none" aria-hidden>
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

/** Wortmarke aus BRAND.name: „CV-Hub" → CV + -Hub (Trennung am ersten „/" oder „-"). */
function Wordmark() {
  const i = BRAND.name.search(/[/-]/);
  return i > 0
    ? <span className="lp-word">{BRAND.name.slice(0, i)}<span className="lp-word-sub">{BRAND.name.slice(i)}</span></span>
    : <span className="lp-word">{BRAND.name}</span>;
}

function Arrow() {
  return <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden><path d="M3 8h9.5M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Tick() {
  return <svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
