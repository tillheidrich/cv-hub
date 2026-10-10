// Nachbildung der Gutschein-Endpunkte für vouchercheck.mjs (Schnittstellen-
// vertrag „Gutscheine", 09.10.2026) — über Playwright `page.route`, oben auf
// _billingmock.mjs. Für Prüfläufe ohne laufenden cv-api; gegen den echten
// Dienst läuft vouchercheck.mjs mit VOUCHER_LIVE=1.
//
// Die Regeln folgen dem Vertrag, soweit die Oberfläche sie sieht:
// Normalisierung (NFKC, ohne Leerzeichen und Bindestriche, Großbuchstaben),
// Vorschau ohne Reservierung, Einlösen nur angemeldet und bestätigt, je Konto
// und Code einmal, je Konto und Kampagne einmal, Limit, Frist, deaktiviert,
// dauerhafter Zugang verbraucht keinen weiteren Code, Zeitgutschein hängt sich
// an eine laufende Laufzeit an. Die echten Regeln prüft pdf-service.
import { installBillingMock } from './_billingmock.mjs';

const D = 86_400_000;
export const norm = s => String(s || '').normalize('NFKC').replace(/[\s-]+/g, '').toUpperCase();
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export function addVoucher(state, v) {
  const id = String((state.vouchers.length || 0) + 1);
  const row = { id, active: true, redemptions: 0, campaign: null, createdAt: new Date().toISOString(), distribution: 'public', kind: 'days', days: 30, maxRedemptions: null, redeemUntil: null, ...v };
  row.norm = norm(row.code);
  state.vouchers.push(row);
  return row;
}

function publicView(v) {
  const { norm: _n, code, ...rest } = v;
  const status = !v.active ? 'inactive' : v.redeemUntil && Date.parse(v.redeemUntil) + D <= Date.now() ? 'expired' : v.maxRedemptions != null && v.redemptions >= v.maxRedemptions ? 'exhausted' : 'active';
  return { ...rest, status, code: v.distribution === 'public' ? code : null, codeHint: v.distribution === 'personal' ? `…${v.norm.slice(-4)}` : null };
}

function planOf(u) { return u?.plan ?? { kind: 'none', until: null, daysLeft: null, notice: null }; }

function check(state, v, user) {
  if (!v) return 'invalid';
  if (!v.active) return 'inactive';
  if (v.redeemUntil && Date.parse(v.redeemUntil) + D <= Date.now()) return 'expired';
  if (v.maxRedemptions != null && v.redemptions >= v.maxRedemptions) return 'exhausted';
  if (user) {
    if (state.redemptionsLog.some(r => r.voucherId === v.id && r.userId === user.id)) return 'already_redeemed';
    if (v.campaign && state.redemptionsLog.some(r => r.campaign === v.campaign && r.userId === user.id)) return 'campaign_redeemed';
  }
  return null;
}

export function createVoucherState(state) {
  state.vouchers = state.vouchers || [];
  state.redemptionsLog = state.redemptionsLog || [];
  state.voucherCalls = state.voucherCalls || [];
  state.adminCreates = state.adminCreates || [];
  return state;
}

export async function installVoucherMock(page, state) {
  createVoucherState(state);
  await installBillingMock(page, state);
  // Später registrierte Routen haben Vorrang; alles andere fällt zum
  // Bezahl-Mock durch.
  await page.route('**/pdfapi/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/pdfapi/, '');
    const method = req.method();
    let body = {};
    try { body = req.postDataJSON() ?? {}; } catch { body = {}; }
    const user = state.user;
    const regOpen = state.offer?.openRegistration ?? state.offer?.enabled === true;

    if (path === '/api/vouchers/preview' && method === 'POST') {
      state.voucherCalls.push({ path, body });
      const v = state.vouchers.find(x => x.norm === norm(body.code));
      let reason = check(state, v, user);
      if (reason && !user && (reason === 'already_redeemed' || reason === 'campaign_redeemed')) reason = null;
      if (reason) return json(route, 200, { ok: false, reason, registrationOpen: regOpen });
      return json(route, 200, {
        ok: true, kind: v.kind, days: v.kind === 'days' ? v.days : null, redeemUntil: v.redeemUntil,
        limited: v.maxRedemptions != null, limitTotal: v.maxRedemptions ?? null,
        ...(user ? { alreadyLifetime: planOf(user).kind === 'lifetime' } : {}),
        registrationOpen: regOpen,
      });
    }
    if (path === '/api/vouchers/redeem' && method === 'POST') {
      state.voucherCalls.push({ path, body });
      if (!user) return json(route, 401, { error: 'Bitte anmelden.', code: 'auth_required' });
      if (user.emailConfirmed === false) return json(route, 403, { error: 'Bitte E-Mail bestätigen.', code: 'email_unconfirmed' });
      const v = state.vouchers.find(x => x.norm === norm(body.code));
      const reason = check(state, v, user);
      if (reason) return json(route, reason === 'invalid' ? 404 : 409, { error: reason, code: reason });
      const p = planOf(user);
      if (p.kind === 'lifetime') return json(route, 409, { error: 'already_lifetime', code: 'already_lifetime' });
      v.redemptions++;
      const now = Date.now();
      const grants = [...(p.grants ?? [])];
      let grant;
      if (v.kind === 'lifetime') {
        grant = { kind: 'lifetime', days: null, from: new Date(now).toISOString(), until: null };
        user.plan = { kind: 'lifetime', until: null, daysLeft: null, notice: null, hasPaid: !!p.hasPaid, freeUntil: null, grants: [...grants, { source: 'voucher', kind: 'lifetime', days: null, grantedAt: new Date(now).toISOString() }] };
      } else {
        const curEnd = p.until && Date.parse(p.until) > now && p.kind !== 'none' ? Date.parse(p.until) : now;
        const until = new Date(curEnd + v.days * D).toISOString();
        grant = { kind: 'days', days: v.days, from: new Date(curEnd).toISOString(), until };
        const left = Math.ceil((Date.parse(until) - now) / D);
        user.plan = { kind: 'pass', until, daysLeft: left, notice: left <= 3 ? 'final' : left <= 14 ? 'soon' : null, hasPaid: !!p.hasPaid, freeUntil: until, grants: [...grants, { source: 'voucher', kind: 'days', days: v.days, grantedAt: new Date(now).toISOString() }] };
      }
      state.redemptionsLog.push({ voucherId: v.id, userId: user.id, campaign: v.campaign, at: new Date(now).toISOString(), until: grant.until, kind: v.kind });
      return json(route, 200, { ok: true, plan: user.plan, grant });
    }
    if (path.startsWith('/api/admin/vouch')) {
      if (!user || user.role !== 'admin') return json(route, 403, { error: 'Nur für Admins.' });
      if (path === '/api/admin/vouchers' && method === 'GET') {
        return json(route, 200, { vouchers: state.vouchers.map(publicView).reverse() });
      }
      if (path === '/api/admin/vouchers' && method === 'POST') {
        state.adminCreates.push(body);
        if (!body.name) return json(route, 400, { error: 'Name fehlt.' });
        if (body.distribution === 'public') {
          if (!body.redeemUntil) return json(route, 400, { error: 'Einlösefrist fehlt.' });
          if (body.maxRedemptions == null && body.confirmUnlimited !== true) return json(route, 400, { error: 'Ohne Limit nur mit Bestätigung.' });
          if (state.vouchers.some(v => v.norm === norm(body.code))) return json(route, 409, { error: 'Diesen Code gibt es schon.', code: 'code_taken' });
          const v = addVoucher(state, { name: body.name, code: norm(body.code), distribution: 'public', kind: body.kind, days: body.kind === 'days' ? body.days : null, maxRedemptions: body.maxRedemptions, redeemUntil: body.redeemUntil, campaign: body.campaign || null });
          return json(route, 200, { voucher: publicView(v) });
        }
        const A = 'ABCDEFGHJKMNPQRSTVWXYZ0123456789';
        const codes = [];
        for (let i = 0; i < (body.count || 1); i++) {
          let c = '';
          for (let k = 0; k < 16; k++) c += A[Math.floor(Math.random() * A.length)];
          const shown = c.match(/.{4}/g).join('-');
          addVoucher(state, { name: body.name, code: c, distribution: 'personal', kind: body.kind, days: body.kind === 'days' ? body.days : null, maxRedemptions: body.maxRedemptions ?? 1, redeemUntil: body.redeemUntil || null, campaign: body.campaign || null });
          codes.push(shown);
        }
        return json(route, 200, { codes });
      }
      let m = /^\/api\/admin\/vouchers\/([^/]+)\/deactivate$/.exec(path);
      if (m && method === 'POST') { const v = state.vouchers.find(x => x.id === m[1]); if (v) v.active = false; return json(route, 200, { ok: true }); }
      m = /^\/api\/admin\/vouchers\/([^/]+)\/redemptions$/.exec(path);
      if (m) return json(route, 200, { redemptions: state.redemptionsLog.filter(r => r.voucherId === m[1]).map(r => ({ redeemedAt: r.at, account: `#${r.userId}`, kind: r.kind, grantedUntil: r.until })) });
      if (path === '/api/admin/voucher-stats') {
        const blank = kind => ({ redemptions: 0, usedPassFeature: 0, buyers: kind === 'lifetime' ? null : 0, purchases: kind === 'lifetime' ? null : 0, refundedPurchases: kind === 'lifetime' ? null : 0 });
        const rows = new Map();
        const byKind = { days: blank('days'), lifetime: blank('lifetime') };
        for (const r of state.redemptionsLog) {
          const k = `${r.campaign || 'v' + r.voucherId}|${r.kind}`;
          const row = rows.get(k) || { campaign: r.campaign, voucherId: r.campaign ? null : r.voucherId, kind: r.kind, ...blank(r.kind) };
          row.redemptions++; byKind[r.kind].redemptions++;
          rows.set(k, row);
        }
        return json(route, 200, { campaigns: [...rows.values()], byKind, vouchers: [], notes: ['Gezählt wird je Einlösung (= je Konto), nicht je Mensch.', 'Gutscheine erzeugen keine Bestellung und keinen Umsatz.'] });
      }
    }
    // Admin-Bereich (admin.html, Runde 8b): Stand der Anmeldung wie ohne ADMIN_HOST.
    if (path === '/api/admin/auth/session') {
      return json(route, 200, user?.role === 'admin'
        ? { mode: 'legacy', authenticated: true, via: 'app-session', user: { id: user.id, username: user.username }, idleMinutes: 30 }
        : { mode: 'legacy', authenticated: false });
    }
    if (path === '/api/admin/overview') return json(route, 404, { error: 'Nicht im Mock.' });
    // Admin-Panel lädt beim Öffnen auch diese
    if (path === '/api/admin/stats') return json(route, 200, { users: 3, resumes: 2, invitesActive: 0, pdfExports: 0, registrations7d: 1, accessPending: 0, accessAccepted: 0, accessRejected: 0, accessRequests7d: 0 });
    if (path === '/api/admin/invites') return json(route, 200, { invites: [] });
    if (path === '/api/admin/users') return json(route, 200, { users: [] });
    if (path === '/api/admin/access-requests') return json(route, 200, { requests: [] });
    if (path === '/api/admin/invite-stats') return json(route, 200, { codes: [] });
    return route.fallback();
  });
}
