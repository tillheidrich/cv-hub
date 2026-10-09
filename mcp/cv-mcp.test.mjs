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
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const kit = await import(path.join(here, '../pdf-service/testkit.mjs')).catch(() => null);
const skip = kit && kit.findPgBin() ? false : 'pdf-service/testkit.mjs oder Postgres fehlt';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]).toString('base64');

describe('cv-mcp', { skip }, () => {
  let pgInst, srv, mcp, resumeId;

  before(async () => {
    pgInst = await kit.startPostgres(Number(process.env.TEST_PG_PORT || 5441));
    srv = await kit.startServer({
      DATABASE_URL: pgInst.url, JWT_SECRET: 'mcp-test', NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://cv.example.org', JANITOR: '0',
    }, { port: Number(process.env.TEST_API_PORT || 3141) });
    const c = kit.client(srv.base);
    await c.post('/api/auth/register', { username: 'mcpnutzer', password: 'mcp-passwort-1' });
    const key = (await c.post('/api/keys', { name: 'test' })).data.key;
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
});
