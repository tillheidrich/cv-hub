#!/usr/bin/env node
// CV-Hub — MCP-Server für registrierte Nutzer.
//
// Stellt die Markdown-Brücke des CV-Tools als MCP-Tools bereit: ein externes
// KI-Modell (Claude Desktop, Cursor, …) kann Lebensläufe und Anschreiben
// als Markdown LESEN, überarbeiten und ZURÜCKSCHREIBEN — ohne dass im Tool selbst
// eine KI eingebaut ist.
//
// Zwei Betriebsarten:
//   • stdio  (Standard):  lokal vom MCP-Client gestartet, für genau einen
//                         Menschen.  CV_API_KEY=cvk_… node cv-mcp.mjs
//   • HTTP   (gehostet):  als Web-Dienst deploybar, MEHRBENUTZERFÄHIG. Jeder
//                         Aufrufer bringt sein eigenes Token mit (cvm_…, per
//                         OAuth im Tool erteilt) und sieht ausschließlich seine
//                         eigenen Daten. Aktiv mit MCP_HTTP=1.
//
// Dieser Dienst ist im HTTP-Modus bewusst dumm: er prüft keine Passwörter und
// führt keine Nutzerliste. Er reicht das Token des Aufrufers an die cv-api
// weiter, und die entscheidet. Der Anmeldedienst (OAuth) liegt ebenfalls in der
// cv-api — dort sind Nutzer, Sessions und Datenbank.
//
// Konfiguration über Umgebungsvariablen:
//   CV_API_KEY     (stdio: Pflicht) Persönlicher Schlüssel, beginnt mit "cvk_".
//                  Im HTTP-Modus NICHT setzen — er würde alle Aufrufer zu
//                  demselben Konto machen.
//   CV_API_BASE    (optional)      Standard: http://localhost:8080/pdfapi
//   MCP_HTTP       (optional)      "1" → HTTP-Modus statt stdio.
//   PORT           (HTTP: optional) Standard 3000.
//   MCP_PUBLIC_URL (HTTP: empfohlen) Öffentliche Basis-Adresse. Steht im
//                  WWW-Authenticate-Wegweiser; fehlt sie, wird der Host-Header
//                  genommen — das funktioniert, ist aber angreifbar.
//   MCP_AUTH_BASE  (HTTP: nötig, wenn die cv-api unter einem Pfadpräfix hängt)
//                  Öffentliche Adresse der OAuth-Endpunkte, z. B.
//                  https://cv.example.com/pdfapi/api/oauth

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

const APP_NAME = process.env.APP_NAME || 'CV-Hub';
const API_BASE = (process.env.CV_API_BASE || 'http://localhost:8080/pdfapi').replace(/\/$/, '');
const API_KEY = process.env.CV_API_KEY || '';
const HTTP_MODE = process.env.MCP_HTTP === '1' || process.env.MCP_HTTP === 'true';

// Im stdio-Modus läuft der Server für genau einen Menschen, der seinen
// Schlüssel selbst mitgibt. Im HTTP-Modus bringt JEDER Aufrufer sein eigenes
// Token mit — ein Schlüssel aus der Umgebung wäre dort sogar schädlich, weil
// er alle Aufrufer zu demselben Konto machen würde.
if (!HTTP_MODE) {
  if (!API_KEY) {
    console.error('cv-mcp: CV_API_KEY fehlt. Erzeuge einen Schlüssel im Konto (Konto → Schlüssel) und setze CV_API_KEY.');
    process.exit(1);
  }
  if (!API_KEY.startsWith('cvk_')) {
    console.error('cv-mcp: CV_API_KEY sieht ungültig aus (erwartet Präfix "cvk_").');
    process.exit(1);
  }
}
// Der Key wird als Bearer-Token gesendet — nur über HTTPS (Ausnahme: lokale
// Entwicklung gegen localhost). Sonst liefe der Schlüssel im Klartext.
if (!/^https:\/\//i.test(API_BASE) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(API_BASE)) {
  console.error(`cv-mcp: CV_API_BASE muss HTTPS sein (oder localhost). Erhalten: ${API_BASE}`);
  process.exit(1);
}

/* Der Schlüssel des gerade bedienten Aufrufers.
 *
 * Im HTTP-Modus bedient derselbe Prozess viele Nutzer. Ihn über eine
 * Modulvariable zu führen wäre ein Datenleck mit Ansage: zwei gleichzeitige
 * Anfragen würden sich gegenseitig den Schlüssel unterschieben. AsyncLocalStorage
 * hängt den Wert an den Aufrufkontext, nicht an das Modul — dadurch bleibt jeder
 * der fünfzehn apiFetch-Aufrufe unverändert und trotzdem richtig zugeordnet. */
const keyStore = new AsyncLocalStorage();
const currentKey = () => keyStore.getStore() || API_KEY;

/** Ruft die cv-api mit dem Token des Aufrufers auf. Wirft mit lesbarer Meldung. */
async function apiFetch(path, opts = {}) {
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${currentKey()}`,
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

// ── Struktur-/Design-Konstanten (Spiegel von app/src/data/types.ts) ──────────
const SECTION_KEYS = ['profile', 'details', 'experience', 'education', 'skills', 'languages', 'additional'];
const PAGE_MODES = ['one', 'two', 'three', 'auto'];
const PAGE_FORMATS = ['a4', 'letter', 'legal', 'a5'];
const FONT_PAIRINGS = ['auto', 'inter-playfair', 'pure-inter', 'lora-source', 'merri-source', 'space-inter', 'garamond-archivo', 'plex-corporate', 'libre-inter'];

/** Vollständiges Profil-Payload (AppProfile) lesen. */
async function getPayload(id) {
  const r = await apiFetch(`/api/resumes/${encodeURIComponent(id)}`);
  if (!r?.resume?.payload) throw new Error('Profil nicht gefunden.');
  return r.resume.payload;
}
/** Profil-Payload speichern — legt vorher eine Version an (Wiederherstellung). */
async function savePayload(p, source) {
  await apiFetch('/api/resumes', {
    method: 'POST',
    body: JSON.stringify({ id: p.id, displayName: p.displayName, payload: p, snapshotBefore: true, snapshotSource: source }),
  });
}
/** Bildtyp anhand der Magic-Bytes bestimmen (das Backend prüft MIME↔Bytes). */
function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return null;
}

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

  // ── Design & Struktur ──────────────────────────────────────────────────
  server.tool(
    'get_resume_settings',
    'Liest Design- und Struktur-Einstellungen eines Lebenslaufs als JSON: template (Design), pageMode, pageFormat, fontPairing, fontScale, lang, sectionOrder (Abschnitts-Reihenfolge), hiddenSections (ausgeblendet), sowie ob ein Foto hängt. Enthält auch die erlaubten Werte. Gültige Template-IDs liefert list_templates.',
    { id: z.string().describe('Die Lebenslauf-id aus list_resumes.') },
    async ({ id }) => {
      try {
        const p = await getPayload(id);
        const s = p.settings || {};
        const langs = Object.keys(p.data || {});
        const photo = langs.map(l => p.data[l]?.personal?.photo).find(Boolean) || null;
        return ok(JSON.stringify({
          template: s.template ?? null,
          pageMode: s.pageMode ?? 'auto',
          pageFormat: s.pageFormat ?? 'a4',
          fontPairing: s.fontPairing ?? 'auto',
          fontScale: s.fontScale ?? 1,
          lang: s.lang ?? 'de',
          sectionOrder: s.sectionOrder ?? SECTION_KEYS,
          hiddenSections: s.hiddenSections ?? [],
          respectTemplateStructure: s.respectTemplateStructure !== false,
          photoAttached: !!photo,
          photoUrl: photo,
          languagesPresent: langs,
          allowed: { sectionKeys: SECTION_KEYS, pageModes: PAGE_MODES, pageFormats: PAGE_FORMATS, fontPairings: FONT_PAIRINGS, langs: ['de', 'en', 'fr', 'es'] },
        }, null, 2));
      } catch (e) { return fail(e); }
    },
  );

  server.tool(
    'update_resume_settings',
    'Ändert Design/Struktur eines Lebenslaufs (nur die übergebenen Felder). template = Design-Wechsel (gültige IDs via list_templates). pageMode: one|two|three|auto. pageFormat: a4|letter|legal|a5. sectionOrder ordnet die Abschnitte um, hiddenSections blendet welche aus (Keys: profile, details, experience, education, skills, languages, additional). Inhalte werden separat mit update_resume_markdown bearbeitet. Version wird vorher gesichert.',
    {
      id: z.string().describe('Die Lebenslauf-id aus list_resumes.'),
      template: z.string().optional().describe('Design-/Template-ID (siehe list_templates).'),
      pageMode: z.enum(['one', 'two', 'three', 'auto']).optional(),
      pageFormat: z.enum(['a4', 'letter', 'legal', 'a5']).optional(),
      fontPairing: z.string().optional().describe('auto | inter-playfair | pure-inter | lora-source | merri-source | space-inter | garamond-archivo | plex-corporate | libre-inter'),
      fontScale: z.number().optional().describe('Schriftgröße-Faktor, 0.6–1.4.'),
      lang: z.enum(['de', 'en', 'fr', 'es']).optional().describe('Primäre Sprache für die Ausgabe.'),
      sectionOrder: z.array(z.string()).optional().describe('Reihenfolge der Abschnitts-Keys.'),
      hiddenSections: z.array(z.string()).optional().describe('Auszublendende Abschnitts-Keys.'),
      respectTemplateStructure: z.boolean().optional(),
    },
    async (a) => {
      try {
        const p = await getPayload(a.id);
        p.settings = p.settings || {};
        const changed = [];
        if (a.template !== undefined) {
          const { templates } = await apiFetch('/api/templates');
          const ids = new Set((templates || []).map(t => t.id));
          if (!ids.has(a.template)) return fail(new Error(`Unbekanntes Template "${a.template}". Gültige IDs liefert list_templates.`));
          p.settings.template = a.template; changed.push(`template=${a.template}`);
        }
        if (a.pageMode !== undefined) { p.settings.pageMode = a.pageMode; changed.push(`pageMode=${a.pageMode}`); }
        if (a.pageFormat !== undefined) { p.settings.pageFormat = a.pageFormat; changed.push(`pageFormat=${a.pageFormat}`); }
        if (a.fontPairing !== undefined) {
          if (!FONT_PAIRINGS.includes(a.fontPairing)) return fail(new Error(`Unbekanntes fontPairing. Erlaubt: ${FONT_PAIRINGS.join(', ')}`));
          p.settings.fontPairing = a.fontPairing; changed.push(`fontPairing=${a.fontPairing}`);
        }
        if (a.fontScale !== undefined) { p.settings.fontScale = Math.max(0.6, Math.min(1.4, a.fontScale)); changed.push(`fontScale=${p.settings.fontScale}`); }
        if (a.lang !== undefined) { p.settings.lang = a.lang; changed.push(`lang=${a.lang}`); }
        if (a.sectionOrder !== undefined) {
          const bad = a.sectionOrder.filter(k => !SECTION_KEYS.includes(k));
          if (bad.length) return fail(new Error(`Ungültige Abschnitts-Keys: ${bad.join(', ')}. Erlaubt: ${SECTION_KEYS.join(', ')}`));
          p.settings.sectionOrder = a.sectionOrder; changed.push('sectionOrder');
        }
        if (a.hiddenSections !== undefined) {
          const bad = a.hiddenSections.filter(k => !SECTION_KEYS.includes(k));
          if (bad.length) return fail(new Error(`Ungültige Abschnitts-Keys: ${bad.join(', ')}. Erlaubt: ${SECTION_KEYS.join(', ')}`));
          p.settings.hiddenSections = a.hiddenSections; changed.push(`hiddenSections=[${a.hiddenSections.join(',')}]`);
        }
        if (a.respectTemplateStructure !== undefined) { p.settings.respectTemplateStructure = a.respectTemplateStructure; changed.push(`respectTemplateStructure=${a.respectTemplateStructure}`); }
        if (!changed.length) return ok('Keine Änderung übergeben.');
        await savePayload(p, 'settings_update');
        return ok(`Gespeichert: ${changed.join(', ')}.`);
      } catch (e) { return fail(e); }
    },
  );

  // ── Foto ────────────────────────────────────────────────────────────────
  server.tool(
    'set_resume_photo',
    'Hängt ein Bewerbungsfoto an den Lebenslauf (wird in allen Sprachfassungen gesetzt). Übergib ENTWEDER image_url (öffentliche https-URL) ODER image_base64. JPEG/PNG/WebP/GIF, max 4 MB. Sichtbar nur bei Templates mit Fotobereich — sonst per update_resume_settings ein passendes Template wählen. Version wird vorher gesichert.',
    {
      id: z.string().describe('Die Lebenslauf-id aus list_resumes.'),
      image_url: z.string().optional().describe('Öffentliche https-URL des Fotos.'),
      image_base64: z.string().optional().describe('Base64 der Bilddaten (data:-Präfix wird toleriert).'),
    },
    async ({ id, image_url, image_base64 }) => {
      try {
        let buf;
        if (image_base64) {
          buf = Buffer.from(image_base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
        } else if (image_url) {
          if (!/^https:\/\//i.test(image_url)) return fail(new Error('image_url muss eine https-URL sein.'));
          const host = new URL(image_url).hostname;
          if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/i.test(host) || host === '::1' || host.endsWith('.internal')) {
            return fail(new Error('image_url zeigt auf eine interne/lokale Adresse.'));
          }
          const r = await fetch(image_url, { redirect: 'follow' });
          if (!r.ok) return fail(new Error(`Bild konnte nicht geladen werden (HTTP ${r.status}).`));
          buf = Buffer.from(await r.arrayBuffer());
        } else {
          return fail(new Error('Bitte image_url ODER image_base64 übergeben.'));
        }
        if (buf.length < 100) return fail(new Error('Bild zu klein oder leer.'));
        if (buf.length > 4 * 1024 * 1024) return fail(new Error('Bild zu groß (max 4 MB).'));
        const mime = sniffImageMime(buf);
        if (!mime) return fail(new Error('Kein gültiges Bild (JPEG/PNG/WebP/GIF erwartet).'));
        const up = await apiFetch('/api/photos', { method: 'POST', body: JSON.stringify({ mime, dataBase64: buf.toString('base64') }) });
        const url = up.url;
        const p = await getPayload(id);
        let n = 0;
        for (const l of Object.keys(p.data || {})) {
          if (p.data[l] && typeof p.data[l] === 'object') {
            p.data[l].personal = p.data[l].personal || {};
            p.data[l].personal.photo = url; n++;
          }
        }
        await savePayload(p, 'photo_set');
        return ok(`Foto gesetzt (${n} Sprachfassung${n === 1 ? '' : 'en'}). Prüfe mit get_resume_settings; sichtbar nur bei Templates mit Fotobereich.`);
      } catch (e) { return fail(e); }
    },
  );

  server.tool(
    'remove_resume_photo',
    'Entfernt das Foto aus allen Sprachfassungen des Lebenslaufs. Version wird vorher gesichert.',
    { id: z.string().describe('Die Lebenslauf-id aus list_resumes.') },
    async ({ id }) => {
      try {
        const p = await getPayload(id);
        let n = 0;
        for (const l of Object.keys(p.data || {})) {
          if (p.data[l]?.personal?.photo) { delete p.data[l].personal.photo; n++; }
        }
        if (!n) return ok('Es war kein Foto gesetzt.');
        await savePayload(p, 'photo_remove');
        return ok(`Foto entfernt (${n} Sprachfassung${n === 1 ? '' : 'en'}).`);
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
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  const PORT = parseInt(process.env.PORT || '3000', 10);
  const CONFIGURED_URL = (process.env.MCP_PUBLIC_URL || '').replace(/\/$/, '');
  if (!CONFIGURED_URL) {
    console.error('cv-mcp: MCP_PUBLIC_URL nicht gesetzt — der Wegweiser zum Anmeldedienst fällt auf den Host-Header zurück. Bitte setzen.');
  }
  function baseUrl(req) {
    if (CONFIGURED_URL) return CONFIGURED_URL;
    const host = req.get('host') || 'localhost';
    const proto = /^localhost|^127\.0\.0\.1/.test(host) ? 'http' : 'https';
    return `${proto}://${host}`;
  }

  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Expose-Headers', 'WWW-Authenticate, Mcp-Session-Id');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'cv-mcp' }));

  /* OAuth-Discovery.
   *
   * Der Anmeldedienst selbst läuft in der cv-api — dort sind Nutzer, Sessions
   * und Datenbank. Beantwortet werden die Wegweiser trotzdem hier, weil der
   * Reverse-Proxy vor der SPA nur diesen Container erreicht; die cv-api hängt
   * in der Produktion direkt am Coolify-Proxy unter einem Pfadpräfix.
   *
   * MCP_AUTH_BASE nennt die öffentliche Adresse der OAuth-Endpunkte. Nicht
   * geraten, sondern konfiguriert — sie steht in den Metadaten, nach denen
   * sich jeder Client richtet. */
  const AUTH_BASE = (process.env.MCP_AUTH_BASE || '').replace(/\/$/, '');
  const authBase = req => AUTH_BASE || `${baseUrl(req)}/oauth`;

  app.get(['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'], (req, res) => {
    res.json({
      resource: `${baseUrl(req)}/mcp`,
      authorization_servers: [baseUrl(req)],
      bearer_methods_supported: ['header'],
      scopes_supported: ['cv'],
    });
  });

  app.get(['/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/mcp'], (req, res) => {
    const e = authBase(req);
    res.json({
      issuer: baseUrl(req),
      authorization_endpoint: `${e}/authorize`,
      token_endpoint: `${e}/token`,
      registration_endpoint: `${e}/register`,
      revocation_endpoint: `${e}/revoke`,
      scopes_supported: ['cv'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    });
  });

  /* 401 mit Wegweiser.
   *
   * Der Header ist der Einstieg in die ganze Kette: erst er sagt dem Client, wo
   * die Metadaten des Anmeldedienstes liegen. Ohne ihn sieht der Client nur ein
   * verschlossenes Tor ohne Klingel. Der Anmeldedienst selbst läuft in cv-api —
   * dort sind Nutzer und Datenbank. */
  function unauthorized(req, res, detail) {
    res.set('WWW-Authenticate',
      `Bearer realm="cv-mcp", resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"`);
    res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: detail || 'Unauthorized' },
      id: null,
    });
  }

  app.post('/mcp', async (req, res) => {
    const auth = req.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim()
      : (typeof req.query?.k === 'string' ? req.query.k : '');
    if (!token) return unauthorized(req, res);

    // Gültigkeit einmal vorab prüfen, damit ein abgelaufenes Token als 401 mit
    // Wegweiser zurückkommt und der Client neu autorisiert — statt als
    // Werkzeugfehler mitten im Gespräch.
    let me;
    try {
      me = await keyStore.run(token, () => apiFetch('/api/auth/me'));
    } catch {
      return unauthorized(req, res, 'Token ungültig oder abgelaufen.');
    }
    if (!me?.user) return unauthorized(req, res, 'Token ungültig oder abgelaufen.');

    // Zustandslos: pro Anfrage frischer Server + Transport, danach aufräumen.
    // Der Schlüssel des Aufrufers hängt am Aufrufkontext, nicht am Modul.
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await keyStore.run(token, async () => {
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      });
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
    console.error(`cv-mcp (HTTP, mehrbenutzerfähig) bereit · Port ${PORT} · API: ${API_BASE}`);
  });
}

if (HTTP_MODE) await runHttp();
else await runStdio();
