// Hilfen für die Integrationstests (integration.test.mjs, pdf.test.mjs).
//
// Kein Testfile — der Name passt bewusst auf kein Muster von `node --test`.
// Startet eine eigene, wegwerfbare Postgres-Instanz und den echten Dienst
// (server.js) als Kindprozess. Ohne Postgres-Binärdateien bzw. ohne Chromium
// werden die betroffenen Tests übersprungen statt rot zu werden.

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync, chownSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Pfad zu Chromium für Tests: PDF_CHROMIUM_PATH, sonst die Headless-Shell
 *  aus /opt/pw-browsers, sonst null (dann nimmt Playwright seinen eigenen). */
export function findChromium() {
  if (process.env.PDF_CHROMIUM_PATH && existsSync(process.env.PDF_CHROMIUM_PATH)) return process.env.PDF_CHROMIUM_PATH;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', '/ms-playwright'].filter(Boolean);
  for (const root of roots) {
    let entries;
    try { entries = readdirSync(root); } catch { continue; }
    for (const e of entries.filter(n => n.startsWith('chromium_headless_shell-')).sort().reverse()) {
      for (const sub of ['chrome-linux/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
        const p = path.join(root, e, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

export function findPgBin() {
  const cands = [process.env.PG_BIN, '/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/17/bin', '/usr/lib/postgresql/15/bin'].filter(Boolean);
  return cands.find(d => existsSync(path.join(d, 'initdb')) && existsSync(path.join(d, 'pg_ctl'))) || null;
}

/** Eigene Postgres-Instanz auf `port`. Gibt { url, stop } zurück. */
export async function startPostgres(port) {
  const bin = findPgBin();
  if (!bin) return null;
  const dir = mkdtempSync(path.join(tmpdir(), 'cvapi-pg-'));
  const asRoot = process.getuid?.() === 0;
  // initdb verweigert sich als root — dann als Benutzer postgres.
  const run = (cmd, args) => {
    const full = asRoot ? ['runuser', ['-u', 'postgres', '--', cmd, ...args]] : [cmd, args];
    const r = spawnSync(full[0], full[1], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || r.stdout}`);
    return r;
  };
  if (asRoot) {
    const pw = spawnSync('id', ['-u', 'postgres'], { encoding: 'utf8' });
    const gid = spawnSync('id', ['-g', 'postgres'], { encoding: 'utf8' });
    chownSync(dir, Number(pw.stdout.trim()), Number(gid.stdout.trim()));
  }
  const data = path.join(dir, 'data');
  run(path.join(bin, 'initdb'), ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--no-sync']);
  run(path.join(bin, 'pg_ctl'), ['-D', data, '-l', path.join(dir, 'log'), '-w', '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off`, 'start']);
  run(path.join(bin, 'createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', 'cvtest']);
  return {
    url: `postgres://postgres@127.0.0.1:${port}/cvtest`,
    stop() {
      try { run(path.join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', 'stop']); } catch { /* egal */ }
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* egal */ }
    },
  };
}

/** Startet server.js mit eigener Umgebung. Wartet, bis /health antwortet. */
export async function startServer(env, { port }) {
  const child = spawn(process.execPath, [path.join(here, 'server.js')], {
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d; });
  child.stderr.on('data', d => { output += d; });
  const base = `http://127.0.0.1:${port}`;
  const until = Date.now() + 30_000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`server exited: ${output}`);
    try { const r = await fetch(`${base}/health`); if (r.ok) break; } catch { /* noch nicht */ }
    await new Promise(r => setTimeout(r, 150));
  }
  return {
    base,
    get output() { return output; },
    async stop() {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await new Promise(r => { child.once('exit', r); setTimeout(r, 3000); });
    },
  };
}

/** Kleiner HTTP-Client mit Cookie-Gedächtnis (secure-Cookies gehen hier über
 *  http — Node's fetch prüft das Flag nicht, der Test schickt sie selbst). */
export function client(base) {
  let cookie = '';
  async function call(method, p, { body, headers = {}, raw = false } = {}) {
    const h = { ...headers };
    if (cookie && !h.Cookie) h.Cookie = cookie;
    let payload;
    if (body !== undefined) {
      if (typeof body === 'string' || body instanceof Buffer) payload = body;
      else { payload = JSON.stringify(body); h['Content-Type'] = 'application/json'; }
    }
    const res = await fetch(base + p, { method, headers: h, body: payload, redirect: 'manual' });
    const set = res.headers.getSetCookie?.() || [];
    for (const c of set) {
      const [pair] = c.split(';');
      if (pair.startsWith('cv_session=')) cookie = pair.endsWith('=') ? '' : pair;
    }
    const ct = res.headers.get('content-type') || '';
    let data;
    if (raw) data = Buffer.from(await res.arrayBuffer());
    else if (ct.includes('application/json')) data = await res.json();
    else data = await res.text();
    return { status: res.status, headers: res.headers, data };
  }
  return {
    get: (p, o) => call('GET', p, o),
    post: (p, body, o = {}) => call('POST', p, { ...o, body }),
    put: (p, body, o = {}) => call('PUT', p, { ...o, body }),
    patch: (p, body, o = {}) => call('PATCH', p, { ...o, body }),
    del: (p, o) => call('DELETE', p, o),
    get cookie() { return cookie; },
    set cookie(v) { cookie = v; },
  };
}

/** Zählt die Seiten eines PDFs grob über die Seitenobjekte. */
export function pdfPageCount(buf) {
  const s = buf.toString('latin1');
  const m = s.match(/\/Type\s*\/Page(?!s)/g);
  return m ? m.length : 0;
}
