// Admin-Bereich → „Verkauf" (20.10.2026, salesettings.js, ADMIN.md).
//
// Mollie-Schlüssel eintragen (geprüft bei Mollie), Testkonten, Modus
// Aus / Test / Live, offene Registrierung. Alles hinter der Admin-Sitzung
// (guard aus admin.js); schreibende Anfragen landen im Protokoll, ohne
// Schlüssel. Wirksam ohne Neustart (billing.reconfigure in server.js).

import { loadSaleRow, publicSale, validateSale, checkKey, saveSale, storedKey } from './salesettings.js';

/**
 * deps: { pool, rateLimit, billingConfig (Objekt, live), applySale(), registrationOpen(), botProtection(),
 *         isMailConfigured(), mollieBase, auditWrite }
 */
export function mountSaleAdmin(app, guard, deps) {
  const { pool } = deps;

  async function state() {
    const row = await loadSaleRow(pool);
    const bc = deps.billingConfig;
    const s = bc.seller || {};
    const stored = publicSale(row);
    const mode = !bc.enabled ? 'off' : bc.testersOnly ? 'test' : 'live';
    const keyMode = bc.mollieKey ? (/^live_/.test(bc.mollieKey) ? 'live' : 'test') : null;
    /* Was der Server selbst prüfen kann. Rechtliches und Steuern kann er nicht:
       das steht als Erinnerung in der Oberfläche. */
    const checks = [
      { id: 'testKey', ok: !!stored?.testKey?.checkedAt && stored.testKey.readable, label: 'Mollie-Testschlüssel eingetragen und von Mollie bestätigt' },
      { id: 'liveKey', ok: !!stored?.liveKey?.checkedAt && stored.liveKey.readable, label: 'Mollie-Live-Schlüssel eingetragen und von Mollie bestätigt' },
      { id: 'seller', ok: !!(s.name && s.address && s.email && s.phone), label: 'Verkäuferdaten vollständig (Name, Anschrift, E-Mail, Telefon)' },
      { id: 'mail', ok: !!deps.isMailConfigured(), label: 'Mailversand eingerichtet (Rechnung, Bestätigungen)' },
      { id: 'legal', ok: !!(bc.termsVersion && bc.withdrawalVersion), label: 'AGB und Widerrufsbelehrung mit Fassung hinterlegt' },
      { id: 'webhook', ok: /^https:\/\//.test(bc.webhookUrl || ''), label: 'Rückmeldeadresse für Mollie öffentlich per HTTPS' },
      { id: 'bot', ok: !!deps.botProtection(), label: 'Bot-Schutz für Registrierung und Formulare aktiv' },
      { id: 'testers', ok: (stored?.testers?.length ?? bc.testers?.length ?? 0) > 0, label: 'Mindestens ein Testkonto eingetragen' },
    ];
    return {
      asOf: new Date().toISOString(),
      source: row ? 'admin' : 'env',
      stored,
      effective: {
        mode, keyMode,
        publicSale: !!bc.ready, testersSale: !!bc.readyForTesters,
        missing: (bc.missing || []).filter(m => m !== 'MOLLIE_API_KEY' || mode !== 'off'),
        registrationOpen: !!deps.registrationOpen(),
        webhookUrl: bc.webhookUrl || null,
        priceCents: bc.priceCents, days: bc.days, productName: bc.productName,
        testers: bc.testers || [],
      },
      checks,
    };
  }

  app.get('/api/admin/sale', ...guard, async (_req, res) => res.json(await state()));

  app.post('/api/admin/sale', ...guard, deps.rateLimit({ route: 'admin-sale', max: 40, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const body = req.body || {};
    const v = validateSale(body);
    if (!v.ok) return res.status(400).json({ error: v.errors.join(' '), errors: v.errors });
    const row = await loadSaleRow(pool);

    // Neue Schlüssel erst bei Mollie prüfen; ein falscher wird nicht gespeichert.
    const checked = {};
    const methods = {};
    for (const kind of ['test', 'live']) {
      const k = v.value[`${kind}Key`];
      if (!k) continue;
      const r = await checkKey(k, { base: deps.mollieBase });
      if (!r.ok) return res.status(422).json({ error: `${kind === 'test' ? 'Testschlüssel' : 'Live-Schlüssel'}: ${r.error}`, code: `${kind}_key_invalid` });
      checked[kind] = true;
      methods[kind] = r.methods;
    }

    // Umschalten nur mit passendem, lesbarem Schlüssel. Wird der Wechsel
    // abgelehnt, bleibt der bisherige Modus; geprüfte Schlüssel, Testkonten
    // und Registrierung werden trotzdem gespeichert.
    const wanted = v.value.mode ?? row?.mode ?? 'off';
    const haveKey = (kind) => !!(v.value[`${kind}Key`] || storedKey(row, kind));
    let refusal = null;
    if (wanted === 'test' && !haveKey('test')) refusal = { error: 'Für den Testbetrieb fehlt der Mollie-Testschlüssel.', code: 'test_key_missing' };
    if (wanted === 'live') {
      const other = (deps.billingConfig.missing || []).filter(m => m !== 'MOLLIE_API_KEY');
      if (!haveKey('live')) refusal = { error: 'Für den Verkauf fehlt der Mollie-Live-Schlüssel.', code: 'live_key_missing' };
      else if (row?.mode !== 'live' && body.confirmLive !== true) refusal = { error: 'Bitte bestätigen, dass ab jetzt echte Käufe möglich sind.', code: 'confirm_live' };
      else if (other.length) refusal = { error: `Vor dem Verkauf fehlt noch: ${other.join(', ')}`, code: 'not_ready', missing: other };
    }
    const value = refusal ? { ...v.value, mode: undefined } : v.value;
    const mode = refusal ? (row?.mode ?? 'off') : wanted;

    await saveSale(pool, value, { adminId: req.user.id, checked });
    await deps.applySale();
    res.locals.audit = {
      action: 'sale_save', target: mode,
      details: {
        mode, registration: v.value.registration, testers: v.value.testers ? v.value.testers.split(',').length : undefined,
        testKeyChanged: !!v.value.testKey, liveKeyChanged: !!v.value.liveKey,
      },
    };
    if (refusal) return res.status(409).json({ ok: false, ...refusal, saved: true, methods, ...(await state()), error: refusal.error });
    res.json({ ok: true, methods, ...(await state()) });
  });
}
