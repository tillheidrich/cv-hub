// Tests für die OAuth-Schicht des MCP-Endpunkts.
//
// Ohne Browser, ohne Netz, ohne Datenbank — damit sie in der CI laufen können.
// Geprüft wird das, woran ein OAuth-Server tatsächlich scheitert: gefälschte
// Signaturen, abgelaufene Codes, ein offener Weiterleiter in redirect_uri und
// eine PKCE-Prüfung, die nur so tut als ob.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  makeSigner, safeEqual, redirectUriAllowed, pkceMatches,
  protectedResourceMetadata, authorizationServerMetadata,
} from './oauth.mjs';

const signer = makeSigner('ein-hinreichend-langes-gate-token-xyz');

test('signiertes Token kommt unverändert zurück', () => {
  const t = signer.sign('code', { ru: 'https://a.example/cb', cc: 'abc' }, 60);
  const body = signer.verify(t, 'code');
  assert.equal(body.ru, 'https://a.example/cb');
  assert.equal(body.cc, 'abc');
});

test('verändertes Token wird abgelehnt', () => {
  const t = signer.sign('access', { s: 'cv' }, 60);
  const [payload, mac] = t.split('.');
  const gefaelscht = Buffer.from(JSON.stringify({ t: 'access', s: 'cv', exp: 9e9 })).toString('base64url');
  assert.equal(signer.verify(`${gefaelscht}.${mac}`, 'access'), null);
  assert.equal(signer.verify(`${payload}.${'A'.repeat(43)}`, 'access'), null);
});

test('Token eines anderen Geheimnisses wird abgelehnt', () => {
  const fremd = makeSigner('ein-ganz-anderes-gate-token-abcdefgh');
  assert.equal(signer.verify(fremd.sign('access', { s: 'cv' }, 60), 'access'), null);
});

test('Typen sind nicht austauschbar — ein Code ist kein Access-Token', () => {
  const code = signer.sign('code', { cc: 'x', ru: 'https://a.example/cb' }, 60);
  assert.equal(signer.verify(code, 'access'), null);
  assert.notEqual(signer.verify(code, 'code'), null);
});

test('abgelaufenes Token wird abgelehnt', () => {
  const t = signer.sign('code', { cc: 'x' }, -1);
  assert.equal(signer.verify(t, 'code'), null);
});

test('Unsinn als Token wirft nicht, sondern gibt null', () => {
  for (const müll of [null, undefined, '', 'kein-punkt', '.', 'a.b.c', 123, {}]) {
    assert.equal(signer.verify(müll, 'access'), null);
  }
});

test('redirect_uri: https ja, http nur lokal, alles andere nein', () => {
  assert.equal(redirectUriAllowed('https://claude.ai/api/mcp/auth_callback'), true);
  assert.equal(redirectUriAllowed('http://localhost:33418/callback'), true);
  assert.equal(redirectUriAllowed('http://127.0.0.1:8080/cb'), true);
  assert.equal(redirectUriAllowed('http://boese.example/cb'), false);
  assert.equal(redirectUriAllowed('javascript:alert(1)'), false);
  assert.equal(redirectUriAllowed('https://a.example/cb#fragment'), false);
  assert.equal(redirectUriAllowed('kaputt'), false);
  assert.equal(redirectUriAllowed(undefined), false);
});

test('PKCE akzeptiert nur den passenden Verifier', () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  assert.equal(pkceMatches(verifier, challenge), true);
  assert.equal(pkceMatches(crypto.randomBytes(32).toString('base64url'), challenge), false);
  assert.equal(pkceMatches(verifier, 'falsche-challenge'), false);
  assert.equal(pkceMatches('zu-kurz', challenge), false);
  assert.equal(pkceMatches(undefined, challenge), false);
});

test('safeEqual vergleicht auch unterschiedlich lange Werte ohne zu werfen', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', 'x'), false);
  assert.equal(safeEqual(undefined, undefined), true);
});

test('Metadaten nennen die Endpunkte, die der Client sucht', () => {
  const pr = protectedResourceMetadata('https://cv.example.com');
  assert.equal(pr.resource, 'https://cv.example.com/mcp');
  assert.deepEqual(pr.authorization_servers, ['https://cv.example.com']);

  const as = authorizationServerMetadata('https://cv.example.com');
  assert.equal(as.registration_endpoint, 'https://cv.example.com/mcp/oauth/register');
  assert.equal(as.token_endpoint, 'https://cv.example.com/mcp/oauth/token');
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
  // OAuth 2.1: "plain" darf nicht angeboten werden.
  assert.ok(!as.code_challenge_methods_supported.includes('plain'));
});
