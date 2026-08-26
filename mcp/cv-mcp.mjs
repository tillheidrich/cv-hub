#!/usr/bin/env node
// CV-Hub — MCP-Server für registrierte Nutzer.
//
// Stellt die Markdown-Brücke des CV-Tools als MCP-Tools bereit: ein externes
// KI-Modell (Claude Desktop, Cursor, …) kann Lebensläufe und Anschreiben
// als Markdown LESEN, überarbeiten und ZURÜCKSCHREIBEN — ohne dass im Tool selbst
// eine KI eingebaut ist. Auth ausschließlich per persönlichem API-Key (cvk_…).
//
// Zwei Betriebsarten:
//   • stdio  (Standard):  lokal vom MCP-Client gestartet.  CV_API_KEY=cvk_… node cv-mcp.mjs
//   • HTTP   (gehostet):  als Web-Dienst deploybar, Client verbindet sich remote.
//                         Aktiv, wenn MCP_HTTP=1 gesetzt ist. Zusätzlich nötig:
//                         MCP_GATE_TOKEN (Zugriffs-Token für den Endpunkt), PORT.
//
// Konfiguration über Umgebungsvariablen:
//   CV_API_KEY     (erforderlich)  Persönlicher Schlüssel, beginnt mit "cvk_".
//   CV_API_BASE    (optional)      Standard: http://localhost:8080/pdfapi
//   MCP_HTTP       (optional)      "1" → HTTP-Modus statt stdio.
//   MCP_GATE_TOKEN (HTTP: Pflicht) Geheimes Bearer-Token, das der Client senden muss.
//   PORT           (HTTP: optional) Standard 3000.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import crypto from 'crypto';

const API_BASE = (process.env.CV_API_BASE || 'http://localhost:8080/pdfapi').replace(/\/$/, '');
const API_KEY = process.env.CV_API_KEY || '';
const HTTP_MODE = process.env.MCP_HTTP === '1' || process.env.MCP_HTTP === 'true';

if (!API_KEY) {
  console.error('cv-mcp: CV_API_KEY fehlt. Erzeuge einen Schlüssel im Konto (Konto → Schlüssel) und setze CV_API_KEY.');
  process.exit(1);
}
if (!API_KEY.startsWith('cvk_')) {
  console.error('cv-mcp: CV_API_KEY sieht ungültig aus (erwartet Präfix "cvk_").');
  process.exit(1);
}
// Der Key wird als Bearer-Token gesendet — nur über HTTPS (Ausnahme: lokale
// Entwicklung gegen localhost). Sonst liefe der Schlüssel im Klartext.
if (!/^https:\/\//i.test(API_BASE) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(API_BASE)) {
  console.error(`cv-mcp: CV_API_BASE muss HTTPS sein (oder localhost). Erhalten: ${API_BASE}`);
  process.exit(1);
}

/** Ruft die cv-api mit Bearer-Key auf. Wirft mit lesbarer Meldung bei Fehlern. */
async function apiFetch(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.headers || {}),
    },
  });
  const ct = res.headers.get('content-type') || '';
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      if (ct.includes('application/json')) msg = (await res.json())?.error || msg;
      else msg = (await res.text()).slice(0, 300) || msg;
    } catch { /* ignore */ }
    if (res.status === 401) msg = 'Nicht autorisiert — API-Key ungültig, widerrufen oder Konto gesperrt.';
    throw new Error(msg);
  }
  return ct.includes('application/json') ? res.json() : res.text();
}

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: `Fehler: ${e instanceof Error ? e.message : String(e)}` }] });

/** Baut einen frischen MCP-Server mit allen Tools. Im HTTP-Modus wird pro
 *  Anfrage einer erzeugt (zustandslos), im stdio-Modus genau einer. */
function buildServer() {
  const server = new McpServer({ name: 'cv-hub', version: '1.1.0' });

  // ── Lesen ──────────────────────────────────────────────────────────────
  server.tool(
    'list_resumes',
    'Listet alle Lebensläufe des angemeldeten Kontos (id, Anzeigename, zuletzt geändert). Mit der id arbeiten die anderen Tools.',
    {},
    async () => {
      try {
        const { resumes } = await apiFetch('/api/resumes');
        if (!resumes?.length) return ok('Noch keine Lebensläufe im Konto.');
        const lines = resumes.map(r => `- ${r.display_name}  ·  id: ${r.id}  ·  geändert: ${r.updated_at}`);
        return ok(`Lebensläufe (${resumes.length}):\n${lines.join('\n')}`);
      } catch (e) { return fail(e); }
    },
  );

  server.tool(
    'get_resume_markdown',
    'Gibt einen Lebenslauf als Markdown zurück. Dieses Markdown ist das Bearbeitungsformat: überarbeite es und schreibe es mit update_resume_markdown zurück. Struktur (Überschriften, Feld-Reihenfolge) beibehalten.',
    { id: z.string().describe('Die Lebenslauf-id aus list_resumes.') },
    async ({ id }) => {
      try { return ok(await apiFetch(`/api/resumes/${encodeURIComponent(id)}.md`)); }
      catch (e) { return fail(e); }
    },
  );

  server.tool(
    'get_cover_letter_markdown',
    'Gibt das Anschreiben eines Lebenslaufs als Markdown zurück (pro Sprache). Überarbeiten und mit update_cover_letter_markdown zurückschreiben.',
    { id: z.string().describe('Die Lebenslauf-id aus list_resumes.') },
    async ({ id }) => {
      try { return ok(await apiFetch(`/api/resumes/${encodeURIComponent(id)}/cover-letter.md`)); }
      catch (e) { return fail(e); }
    },
  );

  server.tool(
    'list_templates',
    'Listet die verfügbaren Design-Vorlagen (id, Name, Kategorie).',
    {},
    async () => {
      try {
        const { templates } = await apiFetch('/api/templates');
        const lines = (templates || []).map(t => `- ${t.name}  ·  id: ${t.id}  ·  ${t.category}`);
        return ok(`Vorlagen (${templates?.length || 0}):\n${lines.join('\n')}`);
      } catch (e) { return fail(e); }
    },
  );

  // ── Schreiben ──────────────────────────────────────────────────────────
  server.tool(
    'update_resume_markdown',
    'Schreibt einen überarbeiteten Lebenslauf aus Markdown zurück. Nutze zuerst get_resume_markdown, überarbeite den Text und übergib das VOLLSTÄNDIGE Markdown. Vor dem Speichern legt der Server automatisch eine Version zur Wiederherstellung an. Mit dry_run=true nur validieren (nichts speichern).',
    {
      id: z.string().describe('Die Lebenslauf-id aus list_resumes.'),
      markdown: z.string().describe('Das vollständige, überarbeitete Lebenslauf-Markdown (gleiche Struktur wie get_resume_markdown liefert).'),
      dry_run: z.boolean().optional().describe('true = nur prüfen, nicht speichern. Standard false.'),
    },
    async ({ id, markdown, dry_run }) => {
      try {
        await apiFetch(`/api/resumes/${encodeURIComponent(id)}/import-md`, {
          method: 'POST', body: JSON.stringify({ markdown, dryRun: !!dry_run }),
        });
        return ok(dry_run
          ? 'Validierung erfolgreich — das Markdown ist gültig (nichts gespeichert).'
          : `Lebenslauf ${id} gespeichert. Eine Version wurde vorher gesichert.`);
      } catch (e) { return fail(e); }
    },
  );

  server.tool(
    'update_cover_letter_markdown',
    'Schreibt ein überarbeitetes Anschreiben aus Markdown zurück. Zuerst get_cover_letter_markdown lesen, überarbeiten, vollständiges Markdown übergeben. Version wird vor dem Speichern automatisch gesichert. dry_run=true validiert nur.',
    {
      id: z.string().describe('Die Lebenslauf-id aus list_resumes.'),
      markdown: z.string().describe('Das vollständige, überarbeitete Anschreiben-Markdown.'),
      dry_run: z.boolean().optional().describe('true = nur prüfen, nicht speichern. Standard false.'),
    },
    async ({ id, markdown, dry_run }) => {
      try {
        await apiFetch(`/api/resumes/${encodeURIComponent(id)}/import-cover-letter-md`, {
          method: 'POST', body: JSON.stringify({ markdown, dryRun: !!dry_run }),
        });
        return ok(dry_run
          ? 'Validierung erfolgreich — das Anschreiben-Markdown ist gültig (nichts gespeichert).'
          : `Anschreiben zu ${id} gespeichert. Eine Version wurde vorher gesichert.`);
      } catch (e) { return fail(e); }
    },
  );

  return server;
}

// ── stdio: lokal vom Client gestartet ────────────────────────────────────────
async function runStdio() {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`cv-mcp (stdio) bereit · API: ${API_BASE}`);
}

// ── HTTP: gehosteter, zustandsloser Streamable-HTTP-Endpunkt ─────────────────
// Single-Tenant: der CV_API_KEY steckt serverseitig im Env, der Endpunkt ist
// mit MCP_GATE_TOKEN abgesichert. Nur wer das Token kennt, darf zugreifen.
async function runHttp() {
  const GATE = process.env.MCP_GATE_TOKEN || '';
  if (!GATE || GATE.length < 24) {
    console.error('cv-mcp: MCP_GATE_TOKEN fehlt oder zu kurz (min. 24 Zeichen). HTTP-Modus abgebrochen.');
    process.exit(1);
  }
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Zeitkonstanter Vergleich des Zugriffs-Tokens. Primär als Bearer-Header;
  // als Fallback für Clients ohne Custom-Header auch via ?k=… Query-Parameter.
  function gateOk(req) {
    const auth = req.get('authorization') || '';
    let given = null;
    if (auth.startsWith('Bearer ')) given = auth.slice(7).trim();
    else if (typeof req.query?.k === 'string') given = req.query.k;
    if (!given) return false;
    const g = Buffer.from(given);
    const w = Buffer.from(GATE);
    return g.length === w.length && crypto.timingSafeEqual(g, w);
  }

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'cv-mcp' }));

  app.post('/mcp', async (req, res) => {
    if (!gateOk(req)) {
      res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null });
      return;
    }
    // Zustandslos: pro Anfrage frischer Server + Transport, danach aufräumen.
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('cv-mcp: request error:', err?.message || err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  });

  // Zustandsloser Modus: kein server-initiierter SSE-Stream / keine Sessions.
  const methodNotAllowed = (_req, res) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  app.get('/mcp', methodNotAllowed);
  app.delete('/mcp', methodNotAllowed);

  app.listen(PORT, () => {
    console.error(`cv-mcp (HTTP) bereit · Port ${PORT} · API: ${API_BASE}`);
  });
}

if (HTTP_MODE) await runHttp();
else await runStdio();
