// Nutzungszähler ohne Personenbezug (Runde 8b, 10.10.2026).
//
// Der Betreiber will sehen, was im Dienst passiert: wie viele PDFs, welche Formate und
// Sprachen, wie oft die KI-Verbindung benutzt wird. Ohne dafür Menschen zu
// verfolgen. Deshalb gibt es hier nur Tageszähler: Tag, Kennzahl, Merkmal,
// Wert, Anzahl. Keine Nutzer-ID, keine Adresse, kein Zeitpunkt genauer als
// der Tag, keine freien Texte. Jeder Wert, der aus einer Anfrage kommt, muss
// in einer festen Liste stehen, sonst wird er verworfen (sonst könnte ein
// Aufrufer über einen „Vorlagennamen“ doch wieder Text in die Tabelle
// schreiben).
//
// Was der Server nicht sieht, zählt er nicht: Der Lokalmodus (IndexedDB) und
// die Demo ohne Konto melden nichts. Das steht so auch im Dashboard.
// Ausnahme seit 10.10.2026 (Vorlagen-Staffel, Entscheidungsregel 31.01.2027):
// fünf Bedienereignisse kommen auch ohne Konto über POST /api/events
// (CLIENT_COUNTS unten). Sie landen nur hier als Tageszähler, nie in der
// Tabelle events (die hat eine Nutzer-ID), und nur mit Merkmalen aus festen
// Listen. Wer der Reichweitenmessung widersprochen hat, schickt sie nicht
// (app/src/data/track.ts, countEvent).

const LANGS = new Set(['de', 'en', 'fr', 'es']);
const FORMATS = new Set(['a4', 'letter', 'legal', 'a5']);
const VARIANTS = new Set(['standard', 'ats']);
const PAGE_MODES = new Set(['one', 'two', 'three', 'four', 'auto']);
/** Sperrgründe des Freischalt-Paneels (app/src/billing/UnlockPanel.tsx). */
export const UNLOCK_REASONS = new Set(['template', 'docx', 'coverLetter', 'profiles', 'langs', 'share', 'mcp', 'versions', 'sync', 'account', 'apiKeys']);
/** Ziele des KI-Knopfs (app/src/export/ExportPanel.tsx). */
export const AI_TARGETS = new Set(['chatgpt', 'claude', 'gemini', 'clipboard']);
/** Woher eine Markdown-Ausgabe kam. */
const MODES = new Set(['local', 'account']);

/** Bedienereignisse aus der Oberfläche, die nur gezählt werden (auch ohne
 *  Konto). Kennzahl = Ereignisart. */
export const CLIENT_COUNTS = new Set(['template_lock_view', 'unlock_panel_view', 'export_markdown', 'import_markdown', 'ai_open']);

/** Kennzahlen, die es gibt. Alles andere wird nicht gezählt. */
export const METRICS = new Set([
  'pdf_server',     // PDF über den Dienst (/api/pdf), auch ohne Konto
  'pdf_browser',    // Druck-PDF im Browser, gemeldet über /api/events (nur mit Konto)
  'docx',           // Word, gemeldet über /api/events (nur mit Konto)
  'latex',          // LaTeX-Export, gemeldet über /api/events (nur mit Konto)
  'share_link',     // Sharelink angelegt (Server)
  'md_import',      // Markdown-Brücke: Lebenslauf geschrieben
  'md_export',      // Markdown-Brücke: Lebenslauf gelesen
  'api_call',       // Aufrufe mit KI-Verbindung (OAuth/MCP) oder API-Schlüssel
  'mail_sent',
  'mail_failed',
  // Vorlagen-Staffel und KI-Knopf (10.10.2026), Client-Ereignisse:
  'template_lock_view', // Pass-Vorlage mit eigenem Inhalt angesehen (Merkmal Vorlage)
  'unlock_panel_view',  // Freischalt-Paneel geöffnet (Merkmal Sperrgrund)
  'export_markdown',    // Markdown heruntergeladen (Merkmal lokal/Konto)
  'import_markdown',    // Markdown übernommen (Merkmal lokal/Konto)
  'ai_open',            // KI-Knopf benutzt (Merkmal Ziel)
]);

/** Kalendertag in Berlin als JJJJ-MM-TT. */
export function berlinDay(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Feste Bezeichnung einer Route für die Zählung der API-Aufrufe. Nur Pfade
 *  aus dem Code (req.route.path), nie die aufgerufene Adresse selbst — die
 *  enthält IDs. */
export function routeKey(req) {
  const p = req.route?.path;
  if (p === undefined || p === null) return null;
  const path = p instanceof RegExp ? p.source : String(p);
  return `${req.method} ${path}`.slice(0, 120);
}

/** Lesbare Namen der Schnittstellen, die die KI-Verbindung benutzt
 *  (mcp/cv-mcp.mjs). Was hier fehlt, erscheint mit dem Routennamen. */
export const ROUTE_LABELS = {
  'GET /api/resumes': 'Lebensläufe auflisten',
  'POST /api/resumes': 'Lebenslauf anlegen',
  'GET /api/resumes/:id': 'Lebenslauf und Einstellungen lesen',
  'PUT /api/resumes/:id': 'Lebenslauf speichern',
  'PATCH /api/resumes/:id': 'Lebenslauf umbenennen',
  'POST /api/resumes/:id/import-md': 'Lebenslauf als Markdown schreiben',
  'POST /api/resumes/:id/import-cover-letter-md': 'Anschreiben als Markdown schreiben',
  'POST /api/photos': 'Foto setzen',
  'DELETE /api/photos/:id': 'Foto entfernen',
  'GET /api/auth/me': 'Verbindung prüfen',
};

/** Merkmale aus einer Anfrage, nur Werte aus festen Listen. */
export function cleanDims(src, templateIds) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  const s = v => String(v ?? '').trim().toLowerCase();
  if (templateIds?.has(s(src.template))) out.template = s(src.template);
  if (LANGS.has(s(src.lang))) out.lang = s(src.lang);
  if (FORMATS.has(s(src.format ?? src.pageFormat))) out.format = s(src.format ?? src.pageFormat);
  if (VARIANTS.has(s(src.variant))) out.variant = s(src.variant);
  if (PAGE_MODES.has(s(src.pageMode))) out.pages = s(src.pageMode);
  return out;
}

/** Merkmale eines Bedienereignisses (CLIENT_COUNTS), nur aus festen Listen.
 *  Sperrgründe sind gemischt geschrieben (coverLetter), daher ohne
 *  Kleinschreibung verglichen. */
export function cleanClientDims(kind, src, templateIds) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  const raw = v => String(v ?? '').trim();
  if (kind === 'template_lock_view') {
    const t = raw(src.template).toLowerCase();
    if (templateIds?.has(t)) out.template = t;
  } else if (kind === 'unlock_panel_view') {
    if (UNLOCK_REASONS.has(raw(src.reason))) out.reason = raw(src.reason);
  } else if (kind === 'ai_open') {
    if (AI_TARGETS.has(raw(src.target))) out.target = raw(src.target);
  } else if (kind === 'export_markdown' || kind === 'import_markdown') {
    if (MODES.has(raw(src.mode))) out.mode = raw(src.mode);
  }
  return out;
}

/** Sprache aus dem Kopf eines exportierten HTML (<html lang="…">). */
export function langOfHtml(html) {
  const m = /<html[^>]*\slang="([a-z]{2})"/i.exec(String(html || '').slice(0, 400));
  return m && LANGS.has(m[1].toLowerCase()) ? m[1].toLowerCase() : null;
}

/**
 * Zähler mit kleinem Puffer: Ereignisse sammeln sich im Speicher und gehen
 * alle `flushMs` gesammelt in die Datenbank (ein Statement je Lauf). Das
 * Dashboard ruft vor dem Lesen flush() auf.
 */
export function createStats({ pool, templateIds = new Set(), flushMs = 15_000, log = console.warn } = {}) {
  let buf = new Map();

  function count(metric, dims = {}, n = 1, at = new Date()) {
    if (!METRICS.has(metric)) return;
    const day = berlinDay(at);
    const add = (dim, value) => {
      const k = `${day}\u0000${metric}\u0000${dim}\u0000${value}`;
      buf.set(k, (buf.get(k) || 0) + n);
    };
    add('all', '');
    for (const [dim, value] of Object.entries(dims)) {
      if (value === undefined || value === null || value === '') continue;
      add(String(dim).slice(0, 20), String(value).slice(0, 120));
    }
  }

  async function flush() {
    if (!buf.size) return 0;
    const rows = [...buf.entries()];
    buf = new Map();
    const vals = [];
    const args = [];
    rows.forEach(([k, n], i) => {
      const [day, metric, dim, value] = k.split('\u0000');
      vals.push(`($${i * 5 + 1}::date, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`);
      args.push(day, metric, dim, value, n);
    });
    try {
      await pool.query(
        `INSERT INTO usage_daily (day, metric, dim, value, n) VALUES ${vals.join(', ')}
           ON CONFLICT (day, metric, dim, value) DO UPDATE SET n = usage_daily.n + EXCLUDED.n`,
        args,
      );
      return rows.length;
    } catch (err) {
      // Zurücklegen, beim nächsten Lauf noch einmal.
      for (const [k, n] of rows) buf.set(k, (buf.get(k) || 0) + n);
      log(`stats: Zähler nicht geschrieben (${err?.message || err})`);
      return 0;
    }
  }

  const timer = flushMs > 0 ? setInterval(() => { flush().catch(() => {}); }, flushMs) : null;
  timer?.unref?.();

  /**
   * Middleware: zählt nach erfolgreicher Antwort, was der Server ohnehin
   * sieht. Liest nur Methode, Routenmuster, Status und die erlaubten
   * Merkmale aus dem Anfragekörper; wer angemeldet war, fließt nicht ein.
   */
  function middleware(req, res, next) {
    res.on('finish', () => {
      try {
        if (res.statusCode >= 400) return;
        const p = req.path;
        const m = req.method;
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        if (m === 'POST' && p === '/api/pdf' && res.statusCode === 200) {
          const dims = cleanDims({ ...(body.meta || {}), pageFormat: body.pageFormat }, templateIds);
          if (!dims.lang) { const l = langOfHtml(body.html); if (l) dims.lang = l; }
          count('pdf_server', dims);
        } else if (m === 'POST' && p === '/api/events') {
          const kind = String(body.kind || '');
          const metric = kind === 'pdf_local' ? 'pdf_browser' : kind === 'docx' ? 'docx' : kind === 'latex' ? 'latex' : null;
          if (metric) count(metric, cleanDims(body, templateIds));
          else if (CLIENT_COUNTS.has(kind)) count(kind, cleanClientDims(kind, body, templateIds));
        } else if (m === 'POST' && /^\/api\/resumes\/[^/]+\/share$/.test(p)) {
          count('share_link');
        } else if (m === 'POST' && /^\/api\/resumes\/[^/]+\/import-md$/.test(p)) {
          count('md_import');
        } else if (m === 'GET' && /^\/api\/resumes\/[^/]+\.md$/.test(p)) {
          count('md_export');
        }
        const via = req.user?.authVia;
        if (via === 'oauth' || via === 'apikey') {
          const rk = routeKey(req);
          if (rk) count('api_call', { route: rk, via });
        }
      } catch { /* Zählen darf nie eine Antwort stören */ }
    });
    next();
  }

  function stop() { if (timer) clearInterval(timer); }

  return { count, flush, middleware, stop, pending: () => buf.size };
}
