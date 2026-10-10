/**
 * Daten der Startseite, die nicht im Code stehen: das Angebot des Servers
 * (Preise, Gratis-Grenze) und die neuesten Magazin-Artikel.
 *
 * Beim Bau rendert scripts/landing-prerender.mjs die Startseite vor und legt
 * genau die Werte, mit denen gerendert wurde, als JSON-Datenblock in den Kopf
 * (`<script type="application/json" id="cv-landing-data">`, wird nie
 * ausgeführt, die CSP bleibt bei script-src 'self'). Die App liest ihn beim
 * ersten Zeichnen, damit ihr erster Stand Zeichen für Zeichen dem
 * vorgerenderten HTML entspricht und beim Übernehmen nichts springt. Ohne
 * Datenblock (Entwicklungsserver, andere Pfade) holt sie den Magazin-Index
 * von /magazin/index.json und das Angebot wie überall über useOffer().
 */
import { useEffect, useState } from 'react';
import type { Offer } from '../billing/api';

export interface MagazinArticle {
  slug: string;
  title: string;
  description: string;
  category: string | null;
  categoryName: string | null;
  lang: string;
  updated: string;
  published: string;
  minutes: number;
}

export interface LandingData {
  /** Angebot zum Zeitpunkt des Baus; null = kein Verkauf / nicht erreichbar. */
  offer: Offer | null;
  articles: MagazinArticle[];
}

let embedded: LandingData | null | undefined;

/** Datenblock der vorgerenderten Seite, einmal gelesen und gemerkt (die
 *  Seite entfernt das vorgerenderte HTML, der Kopf bleibt). */
export function embeddedLandingData(): LandingData | null {
  if (embedded !== undefined) return embedded;
  embedded = null;
  try {
    const el = typeof document !== 'undefined' ? document.getElementById('cv-landing-data') : null;
    if (el?.textContent) {
      const d = JSON.parse(el.textContent) as Partial<LandingData>;
      embedded = {
        offer: d.offer && typeof d.offer.priceCents === 'number' ? d.offer as Offer : null,
        articles: Array.isArray(d.articles) ? d.articles.filter(isArticle) : [],
      };
    }
  } catch { embedded = null; }
  return embedded;
}

function isArticle(a: unknown): a is MagazinArticle {
  const x = a as MagazinArticle;
  return !!x && typeof x.slug === 'string' && /^[a-z0-9-]+$/.test(x.slug) && typeof x.title === 'string';
}

/** Die neuesten Artikel: aus dem Datenblock, sonst einmal nachgeladen. */
export function useMagazinArticles(initial: MagazinArticle[] | null): MagazinArticle[] {
  const [list, setList] = useState<MagazinArticle[]>(() => initial ?? []);
  useEffect(() => {
    if (initial) return;
    let alive = true;
    fetch('/magazin/index.json', { headers: { Accept: 'application/json' } })
      .then(r => (r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : null))
      .then((d: { articles?: unknown[] } | null) => {
        if (alive && d && Array.isArray(d.articles)) setList(d.articles.filter(isArticle).slice(0, 6));
      })
      .catch(() => { /* ohne Magazin bleibt der Abschnitt weg */ });
    return () => { alive = false; };
  }, [initial]);
  return list;
}
