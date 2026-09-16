// Tests für die reinen Bausteine des OAuth-Servers.
//
// Ohne Datenbank und ohne Netz, damit sie in der CI laufen. Geprüft wird das,
// woran ein OAuth-Server tatsächlich scheitert — nicht der Glückspfad.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  redirectUriAllowed, pkceMatches, sha256,
  protectedResourceMetadata, authorizationServerMetadata, consentPage,
} from './oauth.js';

test('redirect_uri: https ja, http nur lokal, alles andere nein', () => {
  assert.equal(redirectUriAllowed('https://claude.ai/api/mcp/auth_callback'), true);
  assert.equal(redirectUriAllowed('http://localhost:33418/callback'), true);
  assert.equal(redirectUriAllowed('http://127.0.0.1:8080/cb'), true);
  // Ein offener Weiterleiter ist der Weg, auf dem ein fremder Code beim
  // Angreifer landet — deshalb kein http auf fremde Hosts.
  assert.equal(redirectUriAllowed('http://boese.example/cb'), false);
  assert.equal(redirectUriAllowed('javascript:alert(1)'), false);
  assert.equal(redirectUriAllowed('data:text/html,<script>'), false);
  assert.equal(redirectUriAllowed('https://a.example/cb#frag'), false);
  assert.equal(redirectUriAllowed('kaputt'), false);
  assert.equal(redirectUriAllowed(undefined), false);
  assert.equal(redirectUriAllowed(''), false);
});

test('PKCE akzeptiert nur den passenden Verifier', () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  assert.equal(pkceMatches(verifier, challenge), true);
  assert.equal(pkceMatches(crypto.randomBytes(32).toString('base64url'), challenge), false);
  assert.equal(pkceMatches(verifier, 'falsche-challenge'), false);
  assert.equal(pkceMatches(verifier, ''), false);
  assert.equal(pkceMatches('zu-kurz', challenge), false);
  assert.equal(pkceMatches(undefined, challenge), false);
  assert.equal(pkceMatches('x'.repeat(200), challenge), false);
});

test('sha256 ist stabil und unterscheidet', () => {
  assert.equal(sha256('a'), sha256('a'));
  assert.notEqual(sha256('a'), sha256('b'));
  assert.equal(sha256('a').length, 64);
});

test('Metadaten nennen die Endpunkte, die der Client sucht', () => {
  const pr = protectedResourceMetadata('https://cv.example.com');
  assert.equal(pr.resource, 'https://cv.example.com/mcp');
  assert.deepEqual(pr.authorization_servers, ['https://cv.example.com']);

  const as = authorizationServerMetadata('https://cv.example.com');
  assert.equal(as.issuer, 'https://cv.example.com');
  assert.equal(as.authorization_endpoint, 'https://cv.example.com/oauth/authorize');
  assert.equal(as.token_endpoint, 'https://cv.example.com/oauth/token');
  assert.equal(as.registration_endpoint, 'https://cv.example.com/oauth/register');
  assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
  // OAuth 2.1 hat "plain" gestrichen — es darf nicht angeboten werden.
  assert.ok(!as.code_challenge_methods_supported.includes('plain'));
});

test('Zustimmungsseite escapet, was von außen kommt', () => {
  const html = consentPage({
    appName: 'Tool',
    username: '<script>alert(1)</script>',
    clientName: '"><img src=x onerror=alert(1)>',
    redirectUri: 'https://claude.ai/cb',
    params: { state: '"><script>bad()</script>' },
  });
  // Nicht "kommt der Text vor" ist die Frage, sondern "kann er ausbrechen":
  // kein rohes Tag, kein rohes Anführungszeichen, das ein Attribut beendet.
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>bad()</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&quot;&gt;&lt;img'));
  assert.ok(html.includes('value="&quot;&gt;&lt;script&gt;bad()&lt;/script&gt;"'));
  // Der Host der Rückleitung wird angezeigt, nicht die ganze Adresse.
  assert.ok(html.includes('claude.ai'));
});

test('Zustimmungsseite zeigt beide Wege — erlauben und ablehnen', () => {
  const html = consentPage({
    appName: 'Tool', username: 'till', clientName: 'Claude',
    redirectUri: 'https://claude.ai/cb', params: {},
  });
  assert.ok(html.includes('value="allow"'));
  assert.ok(html.includes('value="deny"'));
});
