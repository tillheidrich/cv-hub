import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PageMode, PageFormat, UILabels } from '../data/types';
import { getPageFormat } from '../data/pageFormats';
import { metricsFor, EXPAND, type Metrics } from '../templates/metrics';
import { paginate, type MeasuredBlock, type PaginationResult } from './paginate';

const MM_TO_PX = 96 / 25.4;          // 3.7795

/** Editor tab IDs — kept in sync with EditorPanel's Tab union. */
export type EditorTab = 'personal' | 'profil' | 'erfahrung' | 'bildung' | 'skills' | 'sprachen';

export interface FitInfo {
  /** Seitenzahl, die tatsächlich herauskommt */
  pages: number;
  /** aufgelöste Metriken — identisch für Vorschau und PDF */
  metrics: Metrics;
  /** 0 = locker, 1 = maximal verdichtet */
  condense: number;
  /** Inhalt passt nicht in den gewünschten Rahmen (Untergrenze erreicht) */
  overflow: boolean;
  /** grobe Schätzung, wie viele Zeilen zu viel sind */
  overflowLines: number;
  /** Zeichen je Zeile im gesetzten Dokument — GEMESSEN, nicht geschätzt.
   *  Damit lässt sich ein Überlauf in Pixeln in die Größe umrechnen, in der
   *  man Text tatsächlich kürzt: Zeichen. */
  charsPerLine: number;
  /** Füllgrad der letzten Seite */
  lastPageFill: number;
  /** Block-IDs je Seite — geht 1:1 an den PDF-Export */
  pageBlocks: string[][];
  /** Wie viele Skill-Gruppen die Seitenspalte trägt — muss mit in den Export,
   *  sonst sieht das PDF anders aus als die Vorschau. */
  asideCap: number;
}

interface Props {
  /** Rendert das Dokument. `pageBlocks === undefined` + `measure` = Messlauf. */
  render: (metrics: Metrics, pageBlocks: string[][] | undefined, measure: boolean, asideCap: number) => React.ReactNode;
  /** Nutzer-Schriftregler */
  userScale: number;
  pageMode: PageMode;
  pageFormat?: PageFormat;
  /** zusätzliche Skalierung für die mobile Ansicht */
  viewportScale?: number;
  onFit?: (info: FitInfo) => void;
  labels?: UILabels;
  onEdit?: (tab: EditorTab) => void;
  /**
   * Kennung des Inhalts: ändert sie sich, wird der Umbruch neu gerechnet.
   *
   * Ohne sie lief die Suche genau einmal — beim ersten Rendern — und danach
   * nie wieder. Wer einen Stichpunkt ergänzte, die Vorlage wechselte oder eine
   * Sektion ausblendete, sah anschließend die alte Seitenaufteilung: neue
   * Blöcke tauchten gar nicht auf (ihre Kennung stand in keiner Seite) und die
   * Verdichtung passte nicht mehr zum Inhalt. Alles, was den Satz beeinflusst,
   * gehört in diese Kennung.
   */
  contentKey?: string;
}

/**
 * Maps a clicked DOM node inside the rendered CV to the editor tab that
 * controls that area. Blöcke tragen `data-cv-section`, deshalb reicht ein
 * Blick auf das nächste markierte Elternelement — der frühere Umweg über
 * Überschriftentexte ging bei übersetzten Labels regelmäßig daneben.
 */
function detectEditorTab(target: HTMLElement): EditorTab {
  const el = target.closest('[data-cv-section]') as HTMLElement | null;
  switch (el?.dataset.cvSection) {
    case 'profile': return 'profil';
    case 'experience': return 'erfahrung';
    case 'education': return 'bildung';
    case 'languages': return 'sprachen';
    case 'skills': return 'skills';
    default: return 'personal';
  }
}

/** Zielseitenzahl je Modus. 'auto' lässt den Inhalt entscheiden. */
function targetPages(mode: PageMode): number | null {
  if (mode === 'one') return 1;
  if (mode === 'two') return 2;
  if (mode === 'three') return 3;
  return null;
}

/**
 * Misst das Dokument, verteilt es auf Seiten und verdichtet es — in dieser
 * Reihenfolge, iterativ.
 *
 * Der entscheidende Unterschied zu vorher: die Vorschau schneidet nichts mehr
 * zurecht. Sie rendert genau die Seiten, die der Paginator ausrechnet, und der
 * PDF-Export bekommt dieselbe Aufteilung. Was hier steht, steht auch im PDF.
 */
export default function DocumentPreview({
  render, userScale, pageMode, pageFormat = 'a4', viewportScale = 1, onFit, labels, onEdit, contentKey = '',
}: Props) {
  void labels;
  const measureRef = useRef<HTMLDivElement>(null);
  const fmt = getPageFormat(pageFormat);
  const PAGE_PX = fmt.heightMm * MM_TO_PX;
  const PAGE_WIDTH_MM = fmt.widthMm;

  const [condense, setCondense] = useState(-EXPAND);
  const [result, setResult] = useState<PaginationResult | null>(null);
  /** Skill-Gruppen in der Seitenspalte. Wird gesenkt, wenn die Spalte überläuft. */
  const [asideCap, setAsideCap] = useState(2);
  /* Anstoß für einen erneuten Messlauf, wenn sich nur REFS geändert haben.
   *
   * Befund vom 14.09.2026: Seoul blieb im Zweiseiten-Modus für immer im
   * Messzustand stehen („…" in der Anzeige, eine Seite mit 795 px Überlauf).
   * Ursache war eine Sackgasse in `relieveAside`: Ist die Seitenspalte
   * leergeräumt und läuft immer noch über, setzt der Zweig nur ein Ref und
   * plant einen Zustandswechsel — der aber entfiel, wenn der Regler ohnehin
   * schon am Anschlag stand. Kein Zustandswechsel, kein neues Rendern, kein
   * neuer Messlauf: die Suche hörte mitten im Schritt auf. Dieser Zähler ist
   * der Anstoß, der in genau diesem Fall fehlte. */
  const [nudge, setNudge] = useState(0);

  // Bisektionsgrenzen für die Verdichtungssuche
  const loRef = useRef(-EXPAND);
  const hiRef = useRef(1);
  const iterRef = useRef(0);
  /** true = Zielseitenzahl ist nachweislich nicht erreichbar; wir zeigen
   *  stattdessen die nächstgrößere Seitenzahl in bequemer Größe. */
  const giveUpRef = useRef(false);
  /** Ist die Wunschseitenzahl nachweislich unerreichbar, steht hier die kleinste
   *  erreichbare — danach wird ganz normal weitergesucht, nur mit diesem Ziel.
   *  Sonst landete der Lebenslauf beim Aufgeben auf der lockersten Stufe und
   *  damit oft auf einer Seite MEHR als nötig. */
  const fallbackPagesRef = useRef<number | null>(null);
  /** true = die Seitenspalte ist die bindende Bedingung und darf die
   *  Verdichtung des ganzen Dokuments bestimmen. Wird erst gesetzt, wenn die
   *  Spalte leergeräumt ist: sonst würde ein langer Skill-Block die Schrift des
   *  gesamten Lebenslaufs kleiner machen. */
  const asideBindingRef = useRef(false);
  /** Kleinster Verdichtungswert, bei dem es nachweislich gepasst hat. Ohne den
   *  landete die Suche beim Zusammenlaufen des Intervalls im „aufgeben"-Zweig
   *  und sprang auf die härteste Stufe — obwohl eine lockere, passende
   *  Einstellung zwei Schritte vorher schon gemessen war. */
  const bestRef = useRef<number | null>(null);
  const sigRef = useRef('');
  const reportedRef = useRef('');

  // Inhaltsänderungen laufen verzögert ein. Beim Tippen im Formular ändert
  // sich der Inhalt bei jedem Anschlag; jedes Mal die vollständige Suche
  // anzuwerfen (acht Messdurchläufe des ganzen Dokuments) würde die Eingabe
  // spürbar bremsen. Der Text steht sofort auf der Seite — nur die Rechnung
  // wartet, bis die Hand einen Moment stillhält.
  /** Zählt hoch, sobald das Messexemplar von unsichtbar auf sichtbar wechselt.
   *
   *  Auf dem Telefon liegen Bearbeiten, Vorschau und Export gleichzeitig im
   *  DOM; nicht gewählte Bereiche stehen auf `display: none`. Dort misst der
   *  Browser jede Höhe als 0 — die Umbruchsuche „fand" also, dass alles auf
   *  eine Seite passt, und rechnete nie wieder nach, weil sich an ihren
   *  Eingaben nichts geändert hatte. Ergebnis: die Vorschau zeigte eine
   *  unverdichtete Seite, deren Inhalt unten abgeschnitten war. */
  const [visibleTick, setVisibleTick] = useState(0);
  useEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    let visible = root.getBoundingClientRect().height > 0;
    const ro = new ResizeObserver(() => {
      const now = root.getBoundingClientRect().height > 0;
      if (now === visible) return;
      visible = now;
      if (now) setVisibleTick(t => t + 1);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  /** Zuletzt gemessene Zeichen je Zeile — überlebt Suchschritte. */
  const charsPerLineRef = useRef(78);
  const [settledKey, setSettledKey] = useState(contentKey);
  useEffect(() => {
    if (settledKey === contentKey) return;
    const t = setTimeout(() => setSettledKey(contentKey), 220);
    return () => clearTimeout(t);
  }, [contentKey, settledKey]);

  const sig = `${userScale}|${pageMode}|${pageFormat}|${settledKey}|${visibleTick}`;
  const metrics = useMemo(() => metricsFor(condense, userScale), [condense, userScale]);

  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onEdit) return;
    const tgt = e.target as HTMLElement | null;
    if (!tgt) return;
    if (tgt.closest('a, button, input, textarea, select')) return;
    // Direkt beschreibbare Felder behalten den Klick für sich: sonst würde der
    // Sprung in den Formular-Reiter den Schreibzeiger wieder wegnehmen.
    if (tgt.closest('[data-cv-edit]')) return;
    if (tgt.closest('[data-noprint]')) return;
    onEdit(detectEditorTab(tgt));
  }, [onEdit]);

  const report = useCallback((info: FitInfo) => {
    if (!onFit) return;
    const key = `${info.pages}|${info.condense.toFixed(3)}|${info.overflow}`;
    if (key === reportedRef.current) return;
    reportedRef.current = key;
    onFit(info);
  }, [onFit]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const page0 = root.querySelector('[data-cv-measure-page="0"]') as HTMLElement | null;
    const page1 = root.querySelector('[data-cv-measure-page="1"]') as HTMLElement | null;
    // Unsichtbar (display: none) misst alles als 0. Dann lieber gar nichts
    // melden als eine falsche Aufteilung festschreiben — der Beobachter oben
    // stößt die Rechnung an, sobald der Bereich wirklich zu sehen ist.
    if (!page0 || page0.getBoundingClientRect().height === 0) return;

    // Eingaben geändert → Suche von vorn
    if (sigRef.current !== sig) {
      sigRef.current = sig;
      loRef.current = -EXPAND;
      hiRef.current = 1;
      iterRef.current = 0;
      giveUpRef.current = false;
      fallbackPagesRef.current = null;
      asideBindingRef.current = false;
      bestRef.current = null;
      if (asideCap !== 2) { queueMicrotask(() => setAsideCap(2)); return; }
      if (condense !== -EXPAND) { queueMicrotask(() => setCondense(-EXPAND)); return; }
    }

    const blockEls = Array.from(page0.querySelectorAll('[data-cv-block]')) as HTMLElement[];
    if (!blockEls.length) {
      // Dokumente ohne Flow-Blöcke (Anschreiben) sind per Konvention einseitig.
      report({
        pages: 1, metrics, condense, overflow: false, overflowLines: 0,
        charsPerLine: charsPerLineRef.current,
        lastPageFill: 1, pageBlocks: [], asideCap,
      });
      return;
    }

    const pageTop = page0.getBoundingClientRect().top;
    const firstTop = blockEls[0].getBoundingClientRect().top - pageTop;

    const main0 = page0.querySelector('[data-cv-main]') as HTMLElement | null;
    const padBottom = main0 ? parseFloat(getComputedStyle(main0).paddingBottom) || 0 : 0;
    const cap1 = Math.max(80, PAGE_PX - firstTop - padBottom);

    // Kapazität der Folgeseiten: aus der leer gerenderten Seite 2 abgelesen,
    // nicht aus Paddings zusammengerechnet.
    let capN = cap1;
    if (page1) {
      const p1Top = page1.getBoundingClientRect().top;
      const main1 = page1.querySelector('[data-cv-main]') as HTMLElement | null;
      if (main1) {
        const cs = getComputedStyle(main1);
        const contentTop = main1.getBoundingClientRect().top - p1Top + (parseFloat(cs.paddingTop) || 0);
        /* Der Wiedereinstieg oben auf einer Folgeseite („BERUFSERFAHRUNG —
         * FORTSETZUNG" plus Eintragskopf) stand nicht in dieser Rechnung: die
         * gemessene Seite 2 ist leer, und ohne Inhalt hat er nichts zu
         * zeigen. Das Modell hielt die Folgeseite dadurch für rund zwanzig
         * Pixel höher als sie ist und setzte eine Zeile zu viel darauf — im
         * PDF eine abgeschnittene Zeile, bei sechs von sechsundzwanzig
         * Vorlagen. Der Renderer legt im Messlauf jetzt einen Platzhalter in
         * der größten Form dorthin (zwei Zeilen); hier wird er abgezogen. */
        const stub = main1.querySelector('[data-cv-caption-stub]') as HTMLElement | null;
        const stubH = stub
          ? stub.getBoundingClientRect().height + (parseFloat(getComputedStyle(stub).marginBottom) || 0)
          : 0;
        capN = Math.max(80, PAGE_PX - contentTop - stubH - (parseFloat(cs.paddingBottom) || 0));
      }
    }

    /* Zeichen je Zeile: aus den gemessenen Fließtextblöcken abgelesen, nicht
     * aus Schriftbreiten gerechnet. Stichpunkte und Profiltext sind die
     * Blöcke, die wirklich umbrechen; Überschriften und Datumszeilen würden
     * den Schnitt verfälschen. */
    {
      const lh = 13 * metrics.t * 1.5;
      let chars = 0, lines = 0;
      for (const el of blockEls) {
        const id = el.dataset.cvBlock ?? '';
        if (!/:b\d+$/.test(id) && id !== 'profile') continue;
        const n = (el.textContent ?? '').trim().length;
        const h = el.getBoundingClientRect().height;
        if (n < 20 || h < lh * 0.6) continue;
        chars += n;
        lines += Math.max(1, Math.round(h / lh));
      }
      if (lines > 0) charsPerLineRef.current = Math.round(chars / lines);
    }

    const blocks: MeasuredBlock[] = blockEls.map(el => {
      const id = el.dataset.cvBlock!;
      return {
        id,
        height: el.getBoundingClientRect().height,
        gap: parseFloat(el.dataset.cvGap || '0') || 0,
        keepWithNext: /:(title|head)$/.test(id) || id.endsWith(':title'),
        entry: id.split(':')[1],
      };
    });

    // keepWithNext + breakBefore kommen aus dem Renderer über data-Attribute,
    // die er beim Bauen der Blöcke gesetzt hat.
    blockEls.forEach((el, i) => {
      blocks[i].keepWithNext = el.dataset.cvKeep === '1';
      blocks[i].breakBefore = el.dataset.cvBreak === '1';
      blocks[i].section = el.dataset.cvSection;
    });

    // Überlauf der Seitenspalte. Sie steht bewusst außerhalb der Flow-Pagination
    // (sie ist auf jeder Seite gleich breit und trägt Kontextdaten), deshalb
    // merkt der Paginator nichts davon, wenn ihr Inhalt unten aus der Seite
    // läuft — im PDF wäre er dann ersatzlos weg. Gemessen wird die Spanne vom
    // ersten bis zum letzten Kind plus Innenabstände, nicht scrollHeight:
    // der lässt bei sichtbarem Überlauf den unteren Innenabstand weg.
    let asideNeed = 0;
    page0.querySelectorAll('[data-cv-aside]').forEach(el => {
      const box = el as HTMLElement;
      const kids = Array.from(box.children) as HTMLElement[];
      if (!kids.length) return;
      const cs = getComputedStyle(box);
      // Unterkante des letzten Kindes, gemessen ab Seitenoberkante: das schließt
      // einen Kopfbalken über der Spalte (header-band) automatisch ein.
      const bottom = kids[kids.length - 1].getBoundingClientRect().bottom - pageTop
        + (parseFloat(cs.paddingBottom) || 0);
      asideNeed = Math.max(asideNeed, bottom);
    });
    const asideOverflow = asideNeed - PAGE_PX;

    const wish = targetPages(pageMode);
    // Ist das Wunschziel als unerreichbar erwiesen, gilt das Ersatzziel.
    const want = wish === null ? null : (fallbackPagesRef.current ?? wish);
    const maxPages = want ?? 3;
    const res = paginate(blocks, [cap1, capN], Math.max(maxPages, 1));

    /** Letzte Stufe, bevor Inhalt der Seitenspalte unten aus der Seite fällt:
     *  eine Skill-Gruppe wandert in die Hauptspalte. Dort bricht sie normal um.
     *  Die Verdichtungssuche beginnt danach von vorn — auch ein bereits
     *  aufgegebener Versuch, denn mit weniger Inhalt in der Spalte kann die
     *  Zielseitenzahl wieder erreichbar sein. */
    const restartSearch = () => {
      loRef.current = -EXPAND; hiRef.current = 1; iterRef.current = 0;
      giveUpRef.current = false; fallbackPagesRef.current = null; bestRef.current = null;
    };

    const relieveAside = (): boolean => {
      if (asideOverflow <= 0.5) return false;
      if (asideCap > 0) {
        restartSearch();
        queueMicrotask(() => { setAsideCap(asideCap - 1); setCondense(-EXPAND); });
        return true;
      }
      // Spalte ist leergeräumt und läuft immer noch über: erst jetzt darf sie
      // die Verdichtung des ganzen Dokuments mitbestimmen.
      if (!asideBindingRef.current) {
        asideBindingRef.current = true;
        restartSearch();
        queueMicrotask(() => {
          if (condense !== -EXPAND) setCondense(-EXPAND);
          // Steht der Regler schon am Anschlag, ändert setCondense nichts —
          // dann muss der Anstoß von hier kommen, sonst endet die Suche hier.
          else setNudge(n => n + 1);
        });
        return true;
      }
      return false;
    };

    const finish = (r: PaginationResult, overflow: boolean) => {
      // Wächter: gerendert wird nur, wenn auch die Seitenspalte auf die Seite
      // passt. Sonst fehlte im PDF stillschweigend, was unten hinausragt.
      if (relieveAside()) return;
      const lineHeightPx = 13 * metrics.t * 1.5;
      setResult(r);
      /* Wieviel ist zu viel?
       *
       * Der Regelfall ist NICHT „Inhalt fällt unten heraus" — das verhindert
       * der Paginator. Der Regelfall ist: das Wunschziel wurde verfehlt und
       * das Dokument steht auf einer Seite mehr. Dann ist das Defizit genau
       * das, was auf den überzähligen Seiten liegt. Vorher meldete das
       * Werkzeug in diesem Fall „0 Zeilen zu viel" und konnte deshalb auch
       * nicht sagen, was zu kürzen wäre. */
      const heightById = new Map(blocks.map(b => [b.id, b.height + b.gap]));
      let beyondWish = 0;
      if (wish !== null && r.pages.length > wish) {
        for (const ids of r.pages.slice(wish)) {
          for (const id of ids) beyondWish += heightById.get(id) ?? 0;
        }
      }
      const deficitPx = Math.max(r.overflowPx, asideOverflow, beyondWish);
      report({
        pages: r.pages.length,
        metrics,
        condense,
        overflow: overflow || fallbackPagesRef.current !== null || asideOverflow > 0.5,
        overflowLines: Math.ceil(deficitPx / Math.max(1, lineHeightPx)),
        charsPerLine: charsPerLineRef.current,
        lastPageFill: r.lastPageFill,
        pageBlocks: r.pages,
        asideCap,
      });
    };

    // 'auto': nie verdichten, nur zählen.
    if (want === null) { finish(res, false); return; }

    // Aufgegeben: Zielseitenzahl ist nicht erreichbar. Dann lieber eine Seite
    // mehr in bequemer Größe als eine gequetschte, halb abgeschnittene Seite —
    // und ehrlich sagen, dass das Ziel verfehlt wurde. Inhalt verschwinden zu
    // lassen wäre das schlechteste aller Ergebnisse.
    if (giveUpRef.current) {
      // Großzügige Obergrenze: lieber eine Seite mehr als abgeschnittener
      // Inhalt. Die Zielverfehlung wird gemeldet, nicht versteckt. `finish`
      // prüft dabei auch die Seitenspalte.
      const aufgabe = paginate(blocks, [cap1, capN], 6);
      /* Befund vom 14.09.2026: Nach dem Aufgeben stand der Regler auf voller
       * Aufweitung — und genau die ließ die letzte Zeile 10 bis 20 Pixel
       * unter die Blattkante rutschen. Betroffen war die Hälfte aller
       * Vorlagen, sichtbar nur mit viel Inhalt im Zweiseiten-Modus. Im PDF
       * ist das kein Schönheitsfehler: die Zeile fehlt dann.
       *
       * „Aufgeben" heißt: das WUNSCHZIEL ist unerreichbar — nicht, dass jede
       * Einstellung recht ist. Also wird die Aufweitung schrittweise
       * zurückgenommen, bis nichts mehr über den Rand steht. */
      if (aufgabe.overflowPx > 0.5 && condense < 0.999) {
        const enger = Math.min(1, condense + 0.25);
        queueMicrotask(() => setCondense(enger));
        return;
      }
      finish(aufgabe, true);
      return;
    }

    // Die Seitenspalte geht bewusst NICHT in das Passt-Kriterium ein, solange
    // sie noch entlastet werden kann (siehe `relieveAside`). Sonst bestimmte
    // eine lange Skill-Liste die Schriftgröße des ganzen Dokuments.
    // Nachvollziehbarkeit der Suche im Prüfstand: `window.__fitDebug = true`
    // vor dem Laden setzen (siehe scripts/). Im Produktionsbündel entfällt der
    // Block komplett.
    if (import.meta.env.DEV && (window as unknown as { __fitDebug?: boolean }).__fitDebug) {
      console.log(`DBG c=${condense.toFixed(3)} cap=${asideCap} pages=${res.pages.length} over=${Math.round(res.overflowPx)} aside=${Math.round(asideOverflow)} want=${want} iter=${iterRef.current}`);
    }
    const fits = res.pages.length <= want && res.overflowPx === 0
      && (!asideBindingRef.current || asideOverflow <= 0.5);

    /** Das Wunschziel ist nicht erreichbar. Statt sofort auf die lockerste
     *  Stufe zurückzufallen (und damit häufig auf eine Seite MEHR als nötig),
     *  wird die kleinste tatsächlich erreichbare Seitenzahl zum neuen Ziel und
     *  die Suche beginnt von vorn: „passt nicht auf eine Seite" endet dann auf
     *  zwei gut gefüllten Seiten, nicht auf drei luftigen. Die Zielverfehlung
     *  wird trotzdem gemeldet. */
    const giveUp = () => {
      if (relieveAside()) return;
      // Es gibt eine gemessene, passende Einstellung — dann ist nichts
      // aufzugeben, sie wird einfach genommen.
      if (bestRef.current !== null && Math.abs(bestRef.current - condense) > 0.004) {
        const best = bestRef.current;
        iterRef.current = 99;
        queueMicrotask(() => setCondense(best));
        return;
      }
      if (bestRef.current !== null) { finish(res, false); return; }
      if (fallbackPagesRef.current === null) {
        // Erst die wirklich kleinste erreichbare Seitenzahl bestimmen — die
        // steht bei maximaler Verdichtung, nicht auf halbem Weg dorthin.
        if (condense < 0.999) { iterRef.current = 99; queueMicrotask(() => setCondense(1)); return; }
        const reachable = paginate(blocks, [cap1, capN], 6);
        if (reachable.pages.length > (wish ?? 1)) {
          fallbackPagesRef.current = reachable.pages.length;
          loRef.current = -EXPAND; hiRef.current = 1; iterRef.current = 0;
          queueMicrotask(() => setCondense(-EXPAND));
          return;
        }
      }
      giveUpRef.current = true;
      if (condense !== -EXPAND) { queueMicrotask(() => setCondense(-EXPAND)); return; }
      finish(paginate(blocks, [cap1, capN], 6), true);
    };

    // Bisektion über den Verdichtungsregler: passt es, geht es Richtung locker;
    // passt es nicht, wird verdichtet. Nach 7 Schritten ist der Regler auf
    // ~1 % genau — mehr bringt sichtbar nichts.
    if (iterRef.current >= 8) {
      if (!fits && bestRef.current === null && condense < 0.999) { iterRef.current = 99; queueMicrotask(() => setCondense(1)); return; }
      if (!fits) { giveUp(); return; }
      finish(res, false);
      return;
    }

    if (fits) {
      hiRef.current = condense;
      bestRef.current = bestRef.current === null ? condense : Math.min(bestRef.current, condense);
      if (condense <= -EXPAND + 0.001) { finish(res, false); return; }
      if (hiRef.current - loRef.current < 0.02) { finish(res, false); return; }
    } else {
      loRef.current = condense;
      if (condense >= 0.999) { giveUp(); return; }
      if (hiRef.current - loRef.current < 0.02) { giveUp(); return; }
    }

    iterRef.current += 1;
    const next = (loRef.current + hiRef.current) / 2;
    if (Math.abs(next - condense) > 0.004) queueMicrotask(() => setCondense(next));
    else if (fits) finish(res, false);
    else giveUp();
  }, [condense, asideCap, nudge, metrics, pageMode, PAGE_PX, report, sig]);

  return (
    <>
      {/* Verstecktes Messexemplar — Seite 1 in natürlicher Höhe plus eine leere
          Folgeseite, aus der die Kapazität von Seite 2+ abgelesen wird. */}
      <div
        ref={measureRef}
        data-noprint
        aria-hidden
        style={{ position: 'fixed', left: '-10000px', top: 0, width: `${PAGE_WIDTH_MM}mm`, visibility: 'hidden', pointerEvents: 'none' }}
      >
        {render(metrics, undefined, true, asideCap)}
      </div>

      <div
        className={`cv-scale-wrapper${onEdit ? ' cv-clickable' : ''}`}
        onClick={handlePreviewClick}
        style={{
          transformOrigin: 'top center',
          transform: viewportScale < 1 ? `scale(${viewportScale})` : undefined,
          width: viewportScale < 1 ? `${PAGE_WIDTH_MM}mm` : undefined,
          position: 'relative',
          display: 'flex', flexDirection: 'column', gap: '28px',
        }}
      >
        {render(metrics, result?.pages, false, asideCap)}
      </div>
    </>
  );
}
