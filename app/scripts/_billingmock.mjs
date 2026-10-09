// Nachbildung der Bezahl-Endpunkte für billingcheck.mjs — im Browser über
// Playwright `page.route`, also ohne laufenden cv-api und ohne Mollie.
//
// Sie hält sich an den Schnittstellenvertrag vom 09.10.2026
// (siehe pdf-service/billing.js). Wer gegen den echten Dienst prüfen will,
// lässt den Mock weg (BILLING_LIVE=1) und startet Vite mit Proxy auf cv-api.
//
// ALTCHA ist echt: Die Aufgabe entsteht mit altcha/lib, und Registrierung und
// öffentlicher Widerruf prüfen die Lösung wie der Server — ein Widget, das
// nicht löst, fällt hier auf.
import { createChallenge, verifySolution, sha } from 'altcha/lib';

const HMAC = 'billingcheck-hmac';

export function createBillingState(overrides = {}) {
  return {
    offer: { enabled: true, sku: 'pass90', priceCents: 900, currency: 'EUR', days: 90, vatNote: 'gemäß § 19 UStG keine Umsatzsteuer', productName: '', features: ['sync', 'share', 'versions', 'mcp', 'apiKeys'] },
    user: null,
    orders: [],
    calls: [],
    withdrawals: [],
    resumes: [],
    photos: 0,
    nextStatus: 'open',
    altchaFailures: 0,
    ...overrides,
  };
}

async function altchaOk(payload) {
  try {
    const data = JSON.parse(Buffer.from(String(payload || ''), 'base64').toString('utf8'));
    const r = await verifySolution({ challenge: data.challenge, solution: data.solution, deriveKey: sha.deriveKey, hmacSignatureSecret: HMAC });
    return !!r.verified;
  } catch { return false; }
}

const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** Plan wie /api/me ihn melden soll. */
export function passPlan(days = 90) {
  const until = new Date(Date.now() + days * 86_400_000).toISOString();
  return { kind: 'pass', until, daysLeft: days, notice: days <= 3 ? 'final' : days <= 14 ? 'soon' : null };
}

export async function installBillingMock(page, state) {
  await page.route('**/pdfapi/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/pdfapi/, '');
    const method = req.method();
    let body = {};
    try { body = req.postDataJSON() ?? {}; } catch { body = {}; }
    state.calls.push({ method, path, body });

    if (path === '/api/billing/offer') return json(route, 200, state.offer);
    if (path === '/api/altcha/challenge') {
      const ch = await createChallenge({ algorithm: 'SHA-256', cost: 1, deriveKey: sha.deriveKey, hmacSignatureSecret: HMAC, expiresAt: new Date(Date.now() + 10 * 60_000) });
      return json(route, 200, ch);
    }
    if (path === '/api/auth/me' || path === '/api/me') {
      if (!state.user) return json(route, 401, { error: 'Nicht angemeldet.' });
      return json(route, 200, { user: state.user, plan: state.user.plan, emailConfirmed: state.user.emailConfirmed });
    }
    if (path === '/api/auth/register' && method === 'POST') {
      if (!(await altchaOk(body.altcha))) { state.altchaFailures++; return json(route, 400, { error: 'Bot-Schutz nicht bestanden.', code: 'altcha' }); }
      if (body.ageConfirmed16 !== true) return json(route, 400, { error: 'Alter fehlt.' });
      if (!/@/.test(body.email || '') || String(body.password || '').length < 8) return json(route, 400, { error: 'Eingaben ungültig.' });
      state.user = { id: 7, username: body.email, email: body.email, role: 'user', createdAt: new Date().toISOString(), plan: { kind: 'none', until: null, daysLeft: null, notice: null }, emailConfirmed: false };
      return json(route, 200, { user: state.user, emailConfirmed: false });
    }
    if (path === '/api/auth/login' && method === 'POST') {
      state.user = state.loginUser ?? state.user;
      if (!state.user) return json(route, 401, { error: 'Nutzername oder Passwort falsch.' });
      return json(route, 200, { user: state.user });
    }
    if (path === '/api/auth/logout') { state.user = null; return json(route, 200, { ok: true }); }
    if (path === '/api/auth/resend-confirmation') return json(route, 200, { ok: true });
    if (path === '/api/auth/confirm-email') {
      if (body.token === 'gut-token-123') { if (state.user) state.user.emailConfirmed = true; return json(route, 200, { ok: true }); }
      return json(route, 400, { error: 'Link ungültig.' });
    }
    if (path === '/api/billing/checkout' && method === 'POST') {
      if (!state.user) return json(route, 401, { error: 'Nicht angemeldet.' });
      if (body.acceptTerms !== true || body.ageConfirmed18 !== true || !body.country || !body.billingName) return json(route, 400, { error: 'Pflichtangaben fehlen.' });
      const n = state.orders.length + 1;
      const order = { id: `ord_${n}`, orderNo: `B-${String(n).padStart(6, '0')}`, status: state.nextStatus, createdAt: new Date().toISOString(), amountCents: 900, invoiceNo: null, withdrawableUntil: new Date(Date.now() + 14 * 86_400_000).toISOString(), refund: null, body };
      state.orders.push(order);
      // „Mollie" leitet hier sofort auf die Danke-Seite zurück.
      return json(route, 200, { orderId: order.id, orderNo: order.orderNo, checkoutUrl: `/kauf/danke?order=${order.id}` });
    }
    let m = /^\/api\/billing\/orders\/([^/]+)\/status$/.exec(path);
    if (m) {
      if (!state.user) return json(route, 401, { error: 'Nicht angemeldet.' });
      const o = state.orders.find(x => x.id === m[1]);
      if (!o) return json(route, 404, { error: 'Nicht gefunden.' });
      return json(route, 200, { status: o.status, orderNo: o.orderNo, passUntil: o.status === 'paid' ? (state.user.plan?.until ?? passPlan().until) : null });
    }
    if (path === '/api/billing/orders') {
      if (!state.user) return json(route, 401, { error: 'Nicht angemeldet.' });
      return json(route, 200, { orders: state.orders.map(({ body: _b, ...o }) => o) });
    }
    m = /^\/api\/billing\/orders\/([^/]+)\/invoice\.pdf$/.exec(path);
    if (m) return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%mock\n' });
    if (path === '/api/billing/withdraw' && method === 'POST') {
      const o = state.orders.find(x => x.id === body.orderId);
      if (!o) return json(route, 404, { error: 'Nicht gefunden.' });
      o.status = 'withdrawn'; o.refund = { status: 'pending' };
      const r = { ok: true, receivedAt: new Date().toISOString(), refund: { status: 'pending' } };
      state.withdrawals.push({ where: 'account', ...r });
      return json(route, 200, r);
    }
    // Wie pdf-service/billing.js: gleiche Antwort für jeden Ausgang (keine
    // Auskunft, ob es die Bestellung gibt); Bestellnummer ist freiwillig.
    if (path === '/api/billing/withdraw-public' && method === 'POST') {
      if (String(body.name || '').trim().length < 2 || !/@/.test(body.email || '')) return json(route, 400, { error: 'Bitte Name und E-Mail-Adresse angeben.', code: 'fields_required' });
      if (!(await altchaOk(body.altcha))) { state.altchaFailures++; return json(route, 400, { error: 'Die Sicherheitsprüfung ist fehlgeschlagen.', code: 'altcha_invalid' }); }
      const mail = state.orderEmail ?? state.user?.email;
      const o = state.orders.find(x => (body.orderNo ? x.orderNo === body.orderNo : true) && x.status === 'paid' && mail === body.email);
      if (o) { o.status = 'withdrawn'; o.refund = { status: 'pending' }; }
      const r = { ok: true, receivedAt: new Date().toISOString(), refund: { status: 'requested' } };
      state.withdrawals.push({ where: 'public', matched: !!o, ...r });
      return json(route, 200, r);
    }
    if (path === '/api/billing/cancel' && method === 'POST') {
      if (!state.user) return json(route, 401, { error: 'Nicht angemeldet.' });
      if (body.kind === 'extraordinary' && String(body.reason || '').trim().length < 3) return json(route, 400, { error: 'Bitte den Grund angeben.', code: 'reason_required' });
      const running = state.orders.filter(o => o.status === 'paid' && (!body.orderId || o.id === body.orderId));
      if (!running.length) return json(route, 409, { error: 'Es gibt keinen laufenden Pass, der sich kündigen ließe.', code: 'nothing_to_cancel' });
      const receivedAt = new Date().toISOString();
      state.cancellations = [...(state.cancellations || []), { where: 'account', body }];
      return json(route, 200, { ok: true, receivedAt, effectiveAt: receivedAt, kind: body.kind || 'ordinary', orders: running.map(o => o.orderNo) });
    }
    if (path === '/api/billing/cancel-public' && method === 'POST') {
      if (String(body.name || '').trim().length < 2 || !/@/.test(body.email || '')) return json(route, 400, { error: 'Bitte Name und E-Mail-Adresse angeben.', code: 'fields_required' });
      if (body.kind === 'extraordinary' && String(body.reason || '').trim().length < 3) return json(route, 400, { error: 'Bitte den Grund angeben.', code: 'reason_required' });
      if (!(await altchaOk(body.altcha))) { state.altchaFailures++; return json(route, 400, { error: 'Die Sicherheitsprüfung ist fehlgeschlagen.', code: 'altcha_invalid' }); }
      state.cancellations = [...(state.cancellations || []), { where: 'public', body }];
      return json(route, 200, { ok: true, receivedAt: new Date().toISOString() });
    }
    // Was die App sonst mit Konto fragt
    if (path === '/api/resumes' && method === 'GET') return json(route, 200, { resumes: state.resumes.map(r => ({ id: r.id, display_name: r.displayName, updated_at: new Date().toISOString() })) });
    if (path === '/api/resumes' && method === 'POST') { state.resumes.push(body); return json(route, 200, { id: body.id }); }
    m = /^\/api\/resumes\/([^/]+)$/.exec(path);
    if (m && method === 'GET') { const r = state.resumes.find(x => x.id === decodeURIComponent(m[1])); return r ? json(route, 200, { resume: { id: r.id, displayName: r.displayName, payload: r.payload } }) : json(route, 404, { error: 'x' }); }
    if (path === '/api/photos' && method === 'POST') { state.photos++; return json(route, 200, { id: 'a'.repeat(24), url: `/pdfapi/api/photos/${'a'.repeat(23)}${state.photos % 10}` }); }
    if (path === '/api/auth/2fa') return json(route, 200, { enabled: false, hasEmail: true, mailReady: true, canEnable: true });
    if (path === '/api/oauth/connections') return json(route, 200, { connections: [] });
    if (path === '/api/keys') return json(route, 200, { keys: [] });
    if (path === '/api/events') return json(route, 200, { ok: true });
    if (path === '/api/pdf') return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%mock\n' });
    return json(route, 404, { error: `mock: ${method} ${path}` });
  });
}
