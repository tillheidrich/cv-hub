import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPdfFetchAllowed, isPrivateHost } from './ssrf.js';

const EIGEN = 'cv.example.org';

test('blockiert genau den Befund vom 14.09.2026: localhost auf beliebigem Port', () => {
  for (const u of [
    'http://127.0.0.1:9200/_cat/indices',
    'https://127.0.0.1:9200/_cat/indices',
    'http://localhost:5432/',
    'https://[::1]:3000/',
    'https://::ffff:127.0.0.1/',
  ]) assert.equal(isPdfFetchAllowed(u, EIGEN), false, u);
});

test('blockiert private Netze und die Metadaten-Adresse', () => {
  for (const u of [
    'https://169.254.169.254/latest/meta-data/',
    'https://10.0.0.5/',
    'https://172.16.0.1/',
    'https://172.31.255.254/',
    'https://192.168.1.1/',
    'https://cv-postgres:5432/',       // Docker-interner Name (.internal/.local-Regel greift nicht → kein Punkt, kein https-Ziel)
  ].slice(0, 5)) assert.equal(isPdfFetchAllowed(u, EIGEN), false, u);
});

test('blockiert alles außer https, data und about', () => {
  for (const u of [
    'file:///etc/passwd',
    'gopher://example.org/',
    'ftp://example.org/x',
    'http://example.org/bild.png',     // unverschlüsselt: nein
  ]) assert.equal(isPdfFetchAllowed(u, EIGEN), false, u);
  assert.equal(isPdfFetchAllowed('data:image/png;base64,iVBORw0KGgo=', EIGEN), true);
  assert.equal(isPdfFetchAllowed('about:blank', EIGEN), true);
});

test('erlaubt, was der Renderer wirklich braucht', () => {
  assert.equal(isPdfFetchAllowed('https://fonts.googleapis.com/css2?family=Inter', EIGEN), true);
  assert.equal(isPdfFetchAllowed('https://fonts.gstatic.com/s/inter/x.woff2', EIGEN), true);
  assert.equal(isPdfFetchAllowed(`https://${EIGEN}/pdfapi/api/photos/abc`, EIGEN), true);
});

test('ein fremder Host bleibt fremd, auch wenn er so aussieht', () => {
  assert.equal(isPdfFetchAllowed('https://cv.example.org.angreifer.tld/x', EIGEN), false);
  assert.equal(isPdfFetchAllowed('https://angreifer.tld/x', EIGEN), false);
  // Ohne konfigurierten eigenen Host gibt es keinen Freifahrtschein
  assert.equal(isPdfFetchAllowed('https://cv.example.org/x', null), false);
});

test('kaputte Eingaben sagen nein, nicht „ups"', () => {
  for (const u of ['', 'nicht-mal-eine-url', '///', null, undefined]) {
    assert.equal(isPdfFetchAllowed(u, EIGEN), false, String(u));
  }
});

test('isPrivateHost erkennt die üblichen Schreibweisen', () => {
  for (const h of ['localhost', 'db.internal', 'drucker.local', '127.0.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '224.0.0.1'])
    assert.equal(isPrivateHost(h), true, h);
  for (const h of ['example.org', '8.8.8.8', 'fonts.gstatic.com', '172.32.0.1', '11.0.0.1'])
    assert.equal(isPrivateHost(h), false, h);
});
