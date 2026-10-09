// MCP-Server gegen die echte cv-api (Postgres + server.js aus ../pdf-service).
//
//   cd mcp && node --test
//
// Geprüft: Jedes Werkzeug trägt Titel und Hinweise, set_resume_photo nimmt
// nur noch Base64 (keine Adresse, die der Server selbst abruft), und die
// Vorlagenliste kommt aus theme.ts. Ohne Postgres wird übersprungen.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const kit = await import(path.join(here, '../pdf-service/testkit.mjs')).catch(() => null);
const skip = kit && kit.findPgBin() ? false : 'pdf-service/testkit.mjs oder Postgres fehlt';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]).toString('base64');

describe('cv-mcp', { skip }, () => {
  let pgInst, srv, mcp, resumeId, apiKey;

  before(async () => {
    pgInst = await kit.startPostgres(Number(process.env.TEST_PG_PORT || 5441));
    srv = await kit.startServer({
      DATABASE_URL: pgInst.url, JWT_SECRET: 'mcp-test', NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://cv.example.org', JANITOR: '0',
    }, { port: Number(process.env.TEST_API_PORT || 3141) });
    const c = kit.client(srv.base);
    await c.post('/api/auth/register', { username: 'mcpnutzer', password: 'mcp-passwort-1' });
    const key = (await c.post('/api/keys', { name: 'test' })).data.key;
    apiKey = key;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.join(here, 'cv-mcp.mjs')],
      env: { ...process.env, CV_API_KEY: key, CV_API_BASE: srv.base, MCP_HTTP: '' },
      stderr: 'ignore',
    });
    mcp = new Client({ name: 'test', version: '1.0.0' });
    await mcp.connect(transport);
  });

  after(async () => {
    await mcp?.close().catch(() => {});
    await srv?.stop();
    pgInst?.stop();
  });

  test('jedes Werkzeug hat Titel und Hinweise', async () => {
    const { tools } = await mcp.listTools();
    assert.equal(tools.length, 12);
    for (const t of tools) {
      assert.ok(t.title, `${t.name} ohne Titel`);
      assert.equal(typeof t.annotations?.readOnlyHint, 'boolean', `${t.name} ohne readOnlyHint`);
      if (!t.annotations.readOnlyHint) {
        assert.equal(typeof t.annotations.destructiveHint, 'boolean', `${t.name} ohne destructiveHint`);
        assert.equal(typeof t.annotations.idempotentHint, 'boolean', `${t.name} ohne idempotentHint`);
      }
    }
    const byName = Object.fromEntries(tools.map(t => [t.name, t]));
    assert.equal(byName.get_resume_markdown.annotations.readOnlyHint, true);
    assert.equal(byName.update_resume_markdown.annotations.destructiveHint, true);
    assert.equal(byName.create_resume.annotations.destructiveHint, false);
  });

  test('set_resume_photo kennt keine image_url mehr', async () => {
    const { tools } = await mcp.listTools();
    const t = tools.find(x => x.name === 'set_resume_photo');
    assert.deepEqual(Object.keys(t.inputSchema.properties).sort(), ['id', 'image_base64']);
    assert.ok(t.inputSchema.required.includes('image_base64'));
    assert.doesNotMatch(t.description, /image_url/);
  });

  test('Lebenslauf anlegen, Foto per Base64 setzen und entfernen', async () => {
    const created = await mcp.callTool({ name: 'create_resume', arguments: { display_name: 'MCP-Test' } });
    resumeId = /id: (\S+)/.exec(created.content[0].text)[1];
    // Eine Adresse wird nicht abgerufen — ohne Base64 kein Foto.
    const viaUrl = await mcp.callTool({ name: 'set_resume_photo', arguments: { id: resumeId, image_url: 'http://169.254.169.254/latest/' } });
    assert.equal(viaUrl.isError, true);
    const ok = await mcp.callTool({ name: 'set_resume_photo', arguments: { id: resumeId, image_base64: PNG } });
    assert.ok(!ok.isError, JSON.stringify(ok));
    const s = JSON.parse((await mcp.callTool({ name: 'get_resume_settings', arguments: { id: resumeId } })).content[0].text);
    assert.equal(s.photoAttached, true);
    assert.ok(s.allowed.fontPairings.includes('pure-inter'));
    const weg = await mcp.callTool({ name: 'remove_resume_photo', arguments: { id: resumeId } });
    assert.match(weg.content[0].text, /Foto entfernt/);
    // Regression: Speichern legte bei MCP-Profilen ein neues Profil an.
    const liste = await mcp.callTool({ name: 'list_resumes', arguments: {} });
    assert.match(liste.content[0].text, /Lebensläufe \(1\)/);
  });

  test('list_templates bietet nur echte Vorlagen an', async () => {
    const r = await mcp.callTool({ name: 'list_templates', arguments: {} });
    const text = r.content[0].text;
    assert.match(text, /id: rotterdam/);
    assert.doesNotMatch(text, /id: (pikachu|helsinki|tokio)\b/);
    const bad = await mcp.callTool({ name: 'update_resume_settings', arguments: { id: resumeId, template: 'pikachu' } });
    assert.equal(bad.isError, true);
    const good = await mcp.callTool({ name: 'update_resume_settings', arguments: { id: resumeId, template: 'lueneburg' } });
    assert.ok(!good.isError, JSON.stringify(good));
  });

  /* N9 (09.10.2026): gehosteter Modus — Anmeldung vor dem JSON-Parser, kein
   * x-powered-by. Vorher parste der Dienst bis zu 7 MB JSON von jedem, auch
   * ohne Token. */
  test('HTTP-Modus: ohne gültiges Token wird kein Körper gelesen; kein x-powered-by', async () => {
    const port = Number(process.env.MCP_HTTP_TEST_PORT || 3265);
    const child = spawn(process.execPath, [path.join(here, 'cv-mcp.mjs')], {
      env: { ...process.env, MCP_HTTP: '1', PORT: String(port), CV_API_BASE: srv.base, MCP_PUBLIC_URL: `http://localhost:${port}`, CV_API_KEY: '' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const base = `http://127.0.0.1:${port}`;
    try {
      const until = Date.now() + 15_000;
      while (Date.now() < until) { try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* noch nicht */ } await new Promise(r => setTimeout(r, 100)); }
      const h = await fetch(`${base}/health`);
      assert.equal(h.headers.get('x-powered-by'), null);
      // Kaputtes JSON ohne Token: 401 — wäre der Parser zuerst gelaufen, käme 400.
      const broken = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{kaputt' });
      assert.equal(broken.status, 401);
      assert.equal(broken.headers.get('x-powered-by'), null);
      assert.match(broken.headers.get('www-authenticate') || '', /resource_metadata=/);
      // Falsches Token, 6 MB Körper: 401, nicht geparst.
      const t0 = Date.now();
      const big = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer cvk_' + 'f'.repeat(40) }, body: JSON.stringify({ x: 'y'.repeat(6_000_000) }) }).catch(e => ({ status: 'abgebrochen', e }));
      assert.ok(big.status === 401 || big.status === 'abgebrochen', String(big.status));
      assert.ok(Date.now() - t0 < 5000);
      // Gültiger Schlüssel: der Körper wird gelesen und beantwortet.
      const ok = await fetch(`${base}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } } }),
      });
      assert.equal(ok.status, 200);
      assert.match(await ok.text(), /serverInfo/);
    } finally {
      child.kill('SIGTERM');
    }
  });
});
