// Mailtexte rund um Registrierung und Bewerbungs-Pass (09.10.2026).
//
// Die verbindlichen Texte (Bestellbestätigung, Eingangsbestätigung des
// Widerrufs, Erstattung, Kündigungsbestätigung, Bestätigung der Adresse)
// kommen aus app/src/legal/mails.ts über legal-texts.json (siehe legal.js).
// Hier passiert nur: Platzhalter füllen, HTML bauen. Wo legal-texts.json
// keinen Text hat, stehen eigene, schlichte Fassungen; die sind mit
// TODO(Rechtstexte) markiert.
//
// Sprache: Deutsch ist maßgeblich. Wer nicht auf Deutsch bestellt hat,
// bekommt die englische Lesehilfe aus mails.ts.

import { layout, btn, h, p, escapeHtml, MAIL_COLORS, withTag, knownLang, mailDate } from '../mail.js';
import { legalMail, legalLang, withdrawalDoc, docText, LEGAL } from './legal.js';

const { LINE, PAPER, SOFT } = MAIL_COLORS;

export function berlinDate(d) {
  try { return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }); }
  catch { return new Date(d).toISOString().slice(0, 10); }
}
export function berlinDateTime(d) {
  try {
    return new Date(d).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Europe/Berlin', timeZoneName: 'short',
    });
  } catch { return new Date(d).toISOString(); }
}
export function euro(cents, currency = 'EUR') {
  const c = Number(cents) || 0;
  const s = `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`;
  return currency === 'EUR' ? `${s} €` : `${s} ${currency}`;
}

const REFUND_WORDS = {
  de: { requested: 'Erstattung veranlasst', queued: 'Erstattung veranlasst', pending: 'Erstattung veranlasst', processing: 'Erstattung in Bearbeitung', refunded: 'Erstattung ausgeführt', retry: 'wird von Hand bearbeitet, wir melden uns innerhalb von zwei Werktagen', failed: 'wird von Hand bearbeitet, wir melden uns innerhalb von zwei Werktagen', canceled: 'wird von Hand bearbeitet, wir melden uns innerhalb von zwei Werktagen' },
  en: { requested: 'refund initiated', queued: 'refund initiated', pending: 'refund initiated', processing: 'refund being processed', refunded: 'refund completed', retry: 'handled manually, we will get back to you within two working days', failed: 'handled manually, we will get back to you within two working days', canceled: 'handled manually, we will get back to you within two working days' },
};

/** Werte für die Platzhalter aus app/src/legal/types.ts. */
export function legalValues({ order = null, seller = {}, productName = '', base = null, days = null, lang = 'de', extra = {} } = {}) {
  const b = base ? String(base).replace(/\/+$/, '') : '';
  const lastDay = order?.withdrawable_until ? berlinDate(new Date(order.withdrawable_until).getTime() - 1) : undefined;
  return {
    SELLER_NAME: seller.name,
    SELLER_ADDRESS: String(seller.address || '').split('\n').map(s => s.trim()).filter(Boolean).join(', '),
    SELLER_EMAIL: seller.email,
    SELLER_PHONE: seller.phone,
    PRODUCT_NAME: productName,
    PRICE: order ? euro(order.amount_cents, order.currency) : undefined,
    DAYS: String(order?.pass_days ?? days ?? ''),
    BASE_URL: b,
    ORDER_NO: order?.order_no,
    ORDER_DATE: order?.paid_at ? berlinDateTime(order.paid_at) : undefined,
    INVOICE_NO: order?.invoice_no ?? undefined,
    PASS_UNTIL: order?.pass_until ? berlinDate(order.pass_until) : undefined,
    WITHDRAWABLE_UNTIL: lastDay,
    CUSTOMER_NAME: order?.billing_name,
    CUSTOMER_EMAIL: order?.email,
    TERMS_VERSION: order?.terms_version ?? undefined,
    REFUND_STATUS: extra.refundStatus ? (REFUND_WORDS[lang]?.[extra.refundStatus] || extra.refundStatus) : undefined,
    ...extra.values,
  };
}

function linkify(escaped) {
  return escaped.replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" style="color:${SOFT};">${u}</a>`);
}
const pre = t => `<pre style="white-space:pre-wrap;font-family:Inter,Segoe UI,Arial,sans-serif;font-size:12px;line-height:1.55;color:${SOFT};background:${PAPER};border:1px solid ${LINE};border-radius:9px;padding:14px;margin:0 0 16px;">${escapeHtml(t)}</pre>`;

/** Zeilen aus mails.ts → { subject, html, text }. lang: Sprache der Mail
 *  (Fuß und lang-Attribut), Standard Deutsch. */
function fromLines({ subject, lines, footer = [] }, { button = null, appendix = [], lang = 'de' } = {}) {
  const html = lines.map(l => (l === '' ? '' : p(linkify(escapeHtml(l))))).join('')
    + (button ? `<div style="margin:4px 0 16px;">${btn(button.href, escapeHtml(button.label))}</div>` : '')
    + appendix.map(a => `<div style="border-top:1px solid ${LINE};margin:20px 0 16px;"></div>${a.title ? p(`<strong>${escapeHtml(a.title)}</strong>`) : ''}${pre(a.text)}`).join('')
    + (footer.length ? `<div style="border-top:1px solid ${LINE};margin:20px 0 12px;"></div><p style="font-size:11px;line-height:1.5;color:#8b8d9b;margin:0;">${footer.map(f => escapeHtml(f)).join('<br/>')}</p>` : '');
  const text = [...lines, ...appendix.flatMap(a => ['', a.title || '', a.text]), '', ...footer].join('\n');
  return { subject, html: layout(html, lang), text };
}

/** Leere Zeilen nicht doppelt und nicht am Ende. */
const tidy = lines => lines.filter((l, i, a) => l !== '' || (i > 0 && a[i - 1] !== '' && i < a.length - 1));

/* ── Registrierung ───────────────────────────────────────────────────── */

/* Double-Opt-in für Tipps (E-Mail-Workflows): Hat jemand bei der
 * Registrierung oder in den Einstellungen Tipps angehakt, bestätigt derselbe
 * Klick auch diese Einwilligung. Das steht ausdrücklich in der Mail, in der
 * Sie-Form der übrigen Vertragstexte. TODO(Rechtstexte): in mails.ts
 * übernehmen, wenn die Rechtstexte das nächste Mal geprüft werden. */
export const TIPS_CONFIRM_LINES = {
  de: [
    'Sie haben außerdem angekreuzt, dass wir Ihnen gelegentlich Tipps zur Nutzung per E-Mail schicken dürfen (höchstens drei Mails in den ersten zwei Wochen, danach keine weiteren). Mit dem Klick auf den Link oben bestätigen Sie auch diese Einwilligung.',
    'Sie können sie jederzeit widerrufen, über den Abmeldelink in jeder dieser Mails oder in den Kontoeinstellungen unter „E-Mails“. Ohne Ihren Klick schicken wir keine Tipps.',
  ],
  en: [
    'You also ticked that we may occasionally send you tips on using the tool by e-mail (at most three e-mails in the first two weeks, none after that). Clicking the link above also confirms this consent.',
    'You can withdraw it at any time via the unsubscribe link in each of these e-mails or in the account settings under “E-mails”. Without your click we will not send any tips.',
  ],
};
function withTipsLines(m, L) {
  const extra = TIPS_CONFIRM_LINES[L] || TIPS_CONFIRM_LINES.de;
  return { ...m, lines: [...m.lines, '', ...extra] };
}

export function tplConfirmEmail({ token, base, lang = 'de', productName = 'CV-Hub', tips = false }) {
  const b = base ? String(base).replace(/\/+$/, '') : null;
  const url = b ? `${b}/email-bestaetigen?token=${encodeURIComponent(token)}` : '';
  const L = legalLang(lang);
  const m0 = legalMail('registrationConfirmation', L, { PRODUCT_NAME: productName, CONFIRM_URL: url, BASE_URL: b || '' });
  const m = m0 && tips ? withTipsLines(m0, L) : m0;
  if (m) return withTag('confirm_email', fromLines(m, { lang: L }));
  // TODO(Rechtstexte): Ersatz ohne legal-texts.json.
  const fallback = {
    subject: `Bitte bestätige deine E-Mail-Adresse für ${productName}`,
    lines: ['Mit dieser Adresse wurde ein Konto angelegt. Bitte bestätige sie mit diesem Link:', '', url, '', 'Der Link gilt 48 Stunden. Ohne Bestätigung löschen wir das Konto danach automatisch, sofern nichts gekauft wurde.'],
  };
  return withTag('confirm_email', fromLines(tips ? withTipsLines(fallback, L) : fallback));
}

/* ── Bestellung ──────────────────────────────────────────────────────── */

/** Bestellbestätigung (Paragraf 312f Abs. 2 BGB). Rechnung, AGB und
 *  Widerrufsbelehrung hängen als PDF an (billing.js); die Belehrung samt
 *  Muster-Formular steht zusätzlich als Text in der Mail. */
export function tplOrderConfirmation({ order, seller, productName, base }) {
  const L = legalLang(order.locale);
  const values = legalValues({ order, seller, productName, base, lang: L });
  const wd = withdrawalDoc(values, 'de');
  const appendix = [{ title: '', text: docText(wd) }];
  const m = legalMail('orderConfirmation', L, values);
  if (m) return withTag('order_confirmation', fromLines(m, { appendix, lang: L }));
  // TODO(Rechtstexte): Ersatz ohne legal-texts.json.
  return withTag('order_confirmation', fromLines({
    subject: `Bestellbestätigung ${order.order_no} · Rechnung ${order.invoice_no}`,
    lines: [
      `Danke für deinen Kauf. Dein Bewerbungs-Pass ist aktiv bis ${values.PASS_UNTIL}.`, '',
      `Bestellnummer: ${order.order_no}`, `Rechnungsnummer: ${order.invoice_no}`,
      `Produkt: ${productName} Bewerbungs-Pass, ${order.pass_days} Tage`,
      `Preis: ${values.PRICE} einmalig (Endpreis, gemäß § 19 UStG keine Umsatzsteuer). Kein Abo.`,
      `Widerruf bis einschließlich ${values.WITHDRAWABLE_UNTIL}: ${values.BASE_URL}/widerruf`,
    ],
  }, { appendix }));
}

/* ── Widerruf ────────────────────────────────────────────────────────── */

/** Eingangsbestätigung (Paragraf 356a Abs. 4 BGB): Inhalt, Datum, Uhrzeit. */
export function tplWithdrawalReceipt({ order, statement, receivedAt, refundStatus = 'requested', seller = {}, productName = '', base = null }) {
  const L = legalLang(order.locale);
  const values = legalValues({ order, seller, productName, base, lang: L, extra: { refundStatus, values: { RECEIVED_AT: berlinDateTime(receivedAt) } } });
  const appendix = statement ? [{ title: L === 'de' ? 'Ihre Erklärung im Wortlaut' : 'Your declaration (German record)', text: statement }] : [];
  const m = legalMail('withdrawalReceipt', L, values);
  if (m) return withTag('withdrawal_receipt', fromLines(m, { appendix, lang: L }));
  return withTag('withdrawal_receipt', fromLines({
    subject: `Eingangsbestätigung Ihres Widerrufs – Bestellung ${order.order_no}`,
    lines: ['Ihr Widerruf ist bei uns eingegangen.', '', `Eingang: ${values.RECEIVED_AT}`, `Bestellung: ${order.order_no}`, `Erstattung: ${values.PRICE}, vollständig (${values.REFUND_STATUS}).`],
  }, { appendix }));
}

/** Widerruf nach Fristende (über das öffentliche Formular): Eingang
 *  bestätigen, Frist nennen, Kündigung als Weg zeigen. */
/* Sprache (17.11.2026): wie die übrigen Vertragsmails Deutsch oder die
 * englische Lesehilfe (legalLang, aus der Sprache der Bestellung bzw. des
 * Kontos). Französisch und Spanisch bekommen Englisch, weil es die
 * Vertragstexte nur deutsch und englisch gibt. Die englische Fassung sagt,
 * dass die deutsche maßgeblich ist. */
const READING_AID = 'This English text is a reading aid; the German version is binding.';

/** Widerruf nach Fristende (über das öffentliche Formular): Eingang
 *  bestätigen, Frist nennen, Kündigung als Weg zeigen. */
export function tplWithdrawalLate({ order, statement, receivedAt, base = null }) {
  const L = legalLang(order?.locale);
  const b = base ? String(base).replace(/\/+$/, '') : '';
  const at = berlinDateTime(receivedAt);
  const t = L === 'de' ? {
    subject: `Eingangsbestätigung Ihrer Erklärung – Bestellung ${order.order_no}`,
    lines: [
      `Guten Tag ${order.billing_name},`, '',
      'Ihre Widerrufserklärung ist bei uns eingegangen.', '',
      `Eingang: ${at}`,
      `Bestellung: ${order.order_no}`, '',
      'Die Widerrufsfrist dieser Bestellung war zum Zeitpunkt des Eingangs bereits abgelaufen. Wir haben Ihre Erklärung gespeichert und melden uns innerhalb von zwei Werktagen.',
      b ? `Den Pass beenden können Sie jederzeit über „Verträge hier kündigen“: ${b}/kuendigen` : '',
    ],
    title: 'Ihre Erklärung im Wortlaut',
  } : {
    subject: `Acknowledgement of your declaration – order ${order.order_no}`,
    lines: [
      `Hello ${order.billing_name},`, '',
      'We have received your withdrawal.', '',
      `Received: ${at}`,
      `Order: ${order.order_no}`, '',
      'The withdrawal period for this order had already ended when your declaration arrived. We have stored your declaration and will get back to you within two working days.',
      b ? `You can end the pass at any time via “Cancel contracts here”: ${b}/kuendigen` : '',
      '', READING_AID,
    ],
    title: 'Your declaration',
  };
  return withTag('withdrawal_late', fromLines({ subject: t.subject, lines: tidy(t.lines) }, { appendix: statement ? [{ title: t.title, text: statement }] : [], lang: L }));
}

/** Erklärung (Widerruf oder Kündigung), die sich nicht sofort zuordnen ließ:
 *  Eingang an die eingegebene Adresse bestätigen, ohne etwas über
 *  Bestellungen zu sagen. Text des Widerrufs aus widerruf.ts (unmatched).
 *  lang: Sprache der Bestellung bzw. des Kontos, sonst Deutsch. */
export function tplDeclarationUnmatched({ type, statement, receivedAt, lang = 'de' }) {
  const L = legalLang(lang);
  const w = type === 'withdrawal';
  const fnText = LEGAL?.withdrawal?.[L]?.fn?.unmatched;
  const at = berlinDateTime(receivedAt);
  const t = L === 'de' ? {
    what: w ? 'Widerruf' : 'Kündigung',
    lines: what => [
      'Guten Tag,', '',
      `Ihre Erklärung (${what}) ist bei uns eingegangen.`, '',
      `Eingang: ${at}`, '',
      w && fnText ? fnText : 'Wir konnten sie nicht sofort einer Bestellung zuordnen. Ihre Erklärung ist trotzdem eingegangen; wir prüfen sie und melden uns innerhalb von zwei Werktagen.',
      '', 'Bitte heben Sie diese Mail als Beleg auf.',
    ],
    subject: what => `Eingangsbestätigung Ihrer Erklärung (${what})`,
    title: 'Ihre Erklärung im Wortlaut',
  } : {
    what: w ? 'withdrawal' : 'cancellation',
    lines: what => [
      'Hello,', '',
      `We have received your declaration (${what}).`, '',
      `Received: ${at}`, '',
      w && fnText ? fnText : 'We could not match it to an order straight away. Your declaration has still been received; we will check it and get back to you within two working days.',
      '', 'Please keep this email as a record.',
      '', READING_AID,
    ],
    subject: what => `Acknowledgement of your declaration (${what})`,
    title: 'Your declaration',
  };
  return withTag('declaration_unmatched', fromLines({ subject: t.subject(t.what), lines: t.lines(t.what) }, { appendix: [{ title: t.title, text: statement }], lang: L }));
}

export function tplRefundDone({ order, seller = {}, productName = '', base = null }) {
  const L = legalLang(order.locale);
  const m = legalMail('refundDone', L, legalValues({ order, seller, productName, base, lang: L }));
  if (m) return withTag('refund_done', fromLines(m, { lang: L }));
  return withTag('refund_done', fromLines({ subject: `Erstattung ausgeführt – Bestellung ${order.order_no}`, lines: [`Die Erstattung von ${euro(order.amount_cents, order.currency)} für die Bestellung ${order.order_no} ist ausgeführt.`] }));
}

/* ── Kündigung (Paragraf 312k BGB) ───────────────────────────────────── */

export function tplCancellationReceipt({ order, receivedAt, kind, reason, effectiveAt, email, seller = {}, productName = '', base = null, statement }) {
  const L = legalLang(order?.locale);
  const kindText = kind === 'extraordinary'
    ? (L === 'de' ? 'Außerordentliche Kündigung aus wichtigem Grund' : 'Extraordinary cancellation for good cause')
    : (L === 'de' ? 'Ordentliche Kündigung' : 'Ordinary cancellation');
  const values = legalValues({ order, seller, productName, base, lang: L, extra: { values: {
    RECEIVED_AT: berlinDateTime(receivedAt), CANCEL_KIND: kindText, CANCEL_REASON: reason || '—',
    CANCEL_EFFECTIVE: berlinDateTime(effectiveAt), CUSTOMER_EMAIL: email || order?.email,
  } } });
  const appendix = statement ? [{ title: L === 'de' ? 'Ihre Erklärung im Wortlaut' : 'Your declaration', text: statement }] : [];
  const m = legalMail('cancellationReceipt', L, values);
  if (m) return withTag('cancellation_receipt', fromLines(m, { appendix, lang: L }));
  return withTag('cancellation_receipt', fromLines({
    subject: `Kündigungsbestätigung – Bewerbungs-Pass ${order?.order_no || ''}`,
    lines: ['Wir bestätigen den Eingang Ihrer Kündigung.', '', `Eingang: ${values.RECEIVED_AT}`, `Art: ${kindText}`, `Grund: ${reason || '—'}`, `Der Vertrag endet am: ${values.CANCEL_EFFECTIVE}`],
  }, { appendix }));
}

/* ── Pass endet ──────────────────────────────────────────────────────── */

/** Hinweis 14 bzw. 3 Tage vor Ende des Passes, mit „Pass verlängern“.
 *  TODO(Rechtstexte): kein Pflichttext, eigene Fassung des Backends.
 *  Seit 17.11.2026 in der Sprache des Kontos (lang = users.mail_lang). Ohne
 *  bekannte Sprache wie bisher Deutsch mit einem englischen Absatz. */
const PASS_ENDING = {
  de: {
    subject: d => `Dein Bewerbungs-Pass endet am ${d}`,
    h: n => `Noch ${n === 1 ? 'ein Tag' : `${n} Tage`}`,
    intro: (u, d) => `Hallo ${u}, dein Bewerbungs-Pass endet am <strong>${d}</strong>. Er verlängert sich nicht von selbst, es gibt kein Abo. Danach kannst du deine Lebensläufe weiter öffnen, exportieren und löschen, aber im Konto nicht mehr ändern. Gelöscht wird nichts.`,
    longer: 'Du brauchst länger? Ein neuer Pass schließt direkt an das bisherige Ende an.',
    btn: 'Pass verlängern →',
    keep: 'Willst du deine Unterlagen unabhängig vom Konto behalten: DOCX, JSON, PDF und die Vorlage als ZIP gibt es im Export-Bereich des Editors, auch nach dem Ende des Passes.',
  },
  en: {
    subject: d => `Your application pass ends on ${d}`,
    h: n => `${n === 1 ? 'One day' : `${n} days`} left`,
    intro: (u, d) => `Hi ${u}, your application pass ends on <strong>${d}</strong>. It does not renew by itself; there is no subscription. Afterwards you can still open, export and delete your CVs, but no longer edit them in your account. Nothing is deleted.`,
    longer: 'Need longer? A new pass starts right where the current one ends.',
    btn: 'Extend pass →',
    keep: 'To keep your documents independently of the account: DOCX, JSON, PDF and the template as a ZIP are in the editor’s export panel, also after the pass has ended.',
  },
  fr: {
    subject: d => `Votre pass candidature se termine le ${d}`,
    h: n => (n === 1 ? 'Plus qu’un jour' : `Plus que ${n} jours`),
    intro: (u, d) => `Bonjour ${u}, votre pass candidature se termine le <strong>${d}</strong>. Il ne se renouvelle pas automatiquement, il n’y a pas d’abonnement. Ensuite, vous pourrez toujours ouvrir, exporter et supprimer vos CV, mais plus les modifier dans le compte. Rien n’est supprimé.`,
    longer: 'Besoin de plus de temps ? Un nouveau pass prend le relais dès la fin de l’actuel.',
    btn: 'Prolonger le pass →',
    keep: 'Pour conserver vos documents indépendamment du compte : DOCX, JSON, PDF et le modèle en ZIP se trouvent dans le panneau d’export de l’éditeur, même après la fin du pass.',
  },
  es: {
    subject: d => `Tu pase de candidatura termina el ${d}`,
    h: n => (n === 1 ? 'Queda un día' : `Quedan ${n} días`),
    intro: (u, d) => `Hola ${u}, tu pase de candidatura termina el <strong>${d}</strong>. No se renueva solo, no hay suscripción. Después podrás seguir abriendo, exportando y borrando tus currículums, pero ya no editarlos en la cuenta. No se borra nada.`,
    longer: '¿Necesitas más tiempo? Un pase nuevo empieza justo donde termina el actual.',
    btn: 'Ampliar el pase →',
    keep: 'Si quieres conservar tus documentos sin depender de la cuenta: DOCX, JSON, PDF y la plantilla en ZIP están en el panel de exportación del editor, también después de que termine el pase.',
  },
};
export function tplPassEnding({ username, until, daysLeft, base, lang = null }) {
  const n = Math.max(1, Math.round(Number(daysLeft) || 1));
  const b = base ? String(base).replace(/\/+$/, '') : null;
  const L = knownLang(lang);
  const block = (X, d) => {
    const t = PASS_ENDING[X];
    return h(t.h(n))
      + p(t.intro(escapeHtml(username), d))
      + p(t.longer)
      + (b ? `<div style="margin:4px 0 16px;">${btn(`${b}/preise`, t.btn)}</div>` : '')
      + p(t.keep);
  };
  if (L) {
    const d = mailDate(L, until);
    return withTag('pass_ending', { subject: PASS_ENDING[L].subject(d), html: layout(block(L, d), L) });
  }
  const de = berlinDate(until);
  return withTag('pass_ending', {
    subject: `Dein Bewerbungs-Pass endet am ${de} · Your pass ends on ${mailDate('en', until)}`,
    html: layout(
      block('de', de)
      + `<div style="border-top:1px solid ${LINE};margin:20px 0 16px;"></div>`
      + p(`<strong>Your application pass ends on ${mailDate('en', until)}.</strong> It does not renew by itself. Afterwards you can still open, export and delete your CVs.${b ? ` Extend it at ${escapeHtml(b)}/preise.` : ''}`),
    ),
  });
}

/* ── An den Betreiber ────────────────────────────────────────────────── */

/** Eine Erklärung braucht Handarbeit (nicht zuzuordnen, außerordentliche
 *  Kündigung, Widerruf nach Frist). Keine Zahlungsdaten, nur der Wortlaut. */
export function tplAdminDeclaration({ type, reason, statement, receivedAt, orderNos = [] }) {
  const what = { withdrawal: 'Widerruf', cancellation: 'Kündigung', payment: 'Zahlung' }[type] || type;
  return withTag('admin_declaration', fromLines({
    subject: `Handarbeit nötig: ${what} (${reason})`,
    lines: [
      `Eine Erklärung (${what}) braucht eine Entscheidung von Hand: ${reason}.`, '',
      `Eingang: ${berlinDateTime(receivedAt)}`,
      orderNos.length ? `Bestellungen: ${orderNos.join(', ')}` : 'Keine Bestellung zugeordnet.',
      '', 'Offene Erklärungen stehen auch in der Admin-Auswertung (GET /api/admin/billing, declarationsOpen).',
    ],
  }, { appendix: [{ title: 'Wortlaut', text: statement }] }));
}

/* ── Sicherheit Runde 6 (09.10.2026): Bestätigungslinks ───────────────────
 * TODO(Rechtstexte): eigene Fassungen des Backends, nicht aus mails.ts. */

/** Eingangsbestätigung eines öffentlichen Widerrufs bzw. einer öffentlichen
 *  Kündigung mit Link (H2, M1). Geht NUR an die Adresse der Bestellung.
 *  Inhalt, Datum und Uhrzeit des Eingangs stehen darin (Paragraf 356a Abs. 4
 *  bzw. 312k Abs. 4 BGB); ausgeführt wird erst nach dem Klick. */
export function tplDeclarationConfirm({ type, orders = [], statement, receivedAt, url, expiresAt }) {
  const L = legalLang(orders[0]?.locale);
  const nos = orders.map(o => o.order_no).join(', ');
  const w = type === 'withdrawal';
  const until = expiresAt ? berlinDate(expiresAt) : '';
  const de = [
    'Guten Tag,', '',
    w ? `Ihre Widerrufserklärung zur Bestellung ${nos} ist bei uns eingegangen.` : `Ihre Kündigung des Bewerbungs-Passes (Bestellung ${nos}) ist bei uns eingegangen.`,
    `Eingang: ${berlinDateTime(receivedAt)}`, '',
    w
      ? 'Damit niemand in Ihrem Namen widerrufen kann, führen wir den Widerruf erst aus, wenn Sie ihn mit dem Knopf unten bestätigen. Erst dann erstatten wir den Betrag und beenden den Pass. Für die Widerrufsfrist zählt der Eingang oben, nicht der Zeitpunkt Ihres Klicks.'
      : 'Damit niemand in Ihrem Namen kündigen kann, beenden wir den Pass erst, wenn Sie die Kündigung mit dem Knopf unten bestätigen. Maßgeblich ist der Eingang oben, nicht der Zeitpunkt Ihres Klicks.',
    until ? `Der Link gilt bis ${until}.` : '',
    '', w
      ? 'Haben Sie keinen Zugriff auf den Knopf oder klappt er nicht, antworten Sie einfach auf diese Mail. Ihr Widerruf ist mit dem Eingang oben wirksam bei uns angekommen; wir erstatten dann nach einer kurzen Prüfung von Hand, spätestens 14 Tage nach dem Eingang.'
      : 'Haben Sie keinen Zugriff auf den Knopf oder klappt er nicht, antworten Sie einfach auf diese Mail; wir bearbeiten die Kündigung dann von Hand.',
    '', 'Haben Sie das nicht selbst abgeschickt? Dann ignorieren Sie diese Mail. Ohne Ihre Bestätigung führen wir nichts automatisch aus; nach Ablauf des Links prüfen wir die Erklärung von Hand.',
  ];
  const en = L === 'en' ? ['', w
    ? 'Your withdrawal has been received. To make sure nobody withdraws on your behalf, please confirm it with the button below. The time of receipt above counts for the withdrawal period.'
    : 'Your cancellation has been received. To make sure nobody cancels on your behalf, please confirm it with the button below. The time of receipt above counts.'] : [];
  const label = w ? 'Widerruf bestätigen' : 'Kündigung bestätigen';
  return withTag('declaration_confirm', fromLines({
    subject: w ? `Bitte bestätigen: Ihr Widerruf – Bestellung ${nos}` : `Bitte bestätigen: Ihre Kündigung – Bestellung ${nos}`,
    lines: [...de, ...en].filter((l, i, a) => l !== '' || a[i - 1] !== ''),
  }, {
    button: url ? { href: url, label } : null,
    appendix: statement ? [{ title: L === 'de' ? 'Ihre Erklärung im Wortlaut' : 'Your declaration (German record)', text: statement }] : [],
  }));
}

/** Erklärung, die sich nicht zuordnen ließ (M4): KEIN freier Text des
 *  Absenders (kein Grund, keine Nachricht). Sonst schickt jeder beliebigen
 *  Text unter unserem Absender an beliebige Adressen.
 *
 *  Prüfteam J1 (10.10.2026): § 356a Abs. 4 BGB verlangt in der
 *  Eingangsbestätigung „zumindest den Inhalt der Widerrufserklärung nach
 *  Absatz 2" (Name, Vertrag, Kommunikationsmittel) sowie Datum und Uhrzeit.
 *  Deshalb nimmt die Vorlage die drei Angaben optional auf, aber nur in
 *  geprüfter Form: die Adresse ist die Empfängeradresse selbst, die
 *  Bestellnummer nur im Format der Bestellnummern, der Name nur ohne Links,
 *  Spitzklammern und Steuerzeichen und höchstens 80 Zeichen lang. Was die
 *  Prüfung nicht besteht, fällt still weg. billing.js gibt die Angaben
 *  noch nicht mit (Patch-Wunsch an die Hauptsitzung). */
const PLAIN_NAME_OK = n => typeof n === 'string' && n.trim().length >= 2 && n.trim().length <= 80
  && !/[<>]|:\/\/|www\.|@/i.test(n) && ![...n].some(ch => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);
const ORDER_NO_OK = n => typeof n === 'string' && /^[A-Z0-9][A-Z0-9-]{2,31}$/.test(n.trim().toUpperCase());
export function tplDeclarationReceivedPlain({ type, receivedAt, name = null, orderNo = null, email = null }) {
  const what = type === 'withdrawal' ? 'Widerruf' : 'Kündigung';
  const facts = [
    PLAIN_NAME_OK(name) ? `Name: ${name.trim()}` : '',
    ORDER_NO_OK(orderNo) ? `Angegebene Bestellnummer: ${orderNo.trim().toUpperCase()}` : '',
    email ? `Bestätigung an: ${String(email).trim()}` : '',
  ].filter(Boolean);
  return withTag('declaration_received', fromLines({
    subject: `Eingangsbestätigung Ihrer Erklärung (${what})`,
    lines: [
      'Guten Tag,', '',
      `wir haben eine Erklärung (${what}) erhalten, die diese E-Mail-Adresse nennt.`,
      `Eingang: ${berlinDateTime(receivedAt)}`,
      ...(facts.length ? [`Inhalt: ${type === 'withdrawal' ? 'Widerruf des Vertrags über den Bewerbungs-Pass' : 'Kündigung des Bewerbungs-Passes'}`, ...facts] : []),
      '',
      type === 'withdrawal'
        ? 'Ihr Widerruf ist damit bei uns eingegangen. Wir konnten ihn nicht sofort einer Bestellung zuordnen, prüfen ihn von Hand und melden uns innerhalb von zwei Werktagen. Für die Frist zählt der Eingang oben.'
        : 'Ihre Kündigung ist damit bei uns eingegangen. Wir konnten sie nicht sofort einer Bestellung zuordnen, prüfen sie von Hand und melden uns innerhalb von zwei Werktagen.',
      '', 'Haben Sie nichts abgeschickt, können Sie diese Mail ignorieren.',
    ],
  }));
}

/* ── Konto: Adresswechsel und Registrierung (17.11.2026 vierfach) ─────────
 * Wie die Kontomails in mail.js: de, en, fr, es; Deutsch und Spanisch duzen,
 * Französisch siezt. lang kommt vom Aufrufer (Konto bzw. Anfrage). */
/** Name des Angebots in Betreffzeilen, wenn der Aufrufer keinen mitgibt. */
const defaultProductName = () => (process.env.PRODUCT_NAME || process.env.APP_NAME || 'CV-Hub').trim();
const L4 = v => knownLang(v) || 'de';
const trimBase = base => (base ? String(base).replace(/\/+$/, '') : '');

const CONFIRM_CHANGE = {
  de: {
    subject: n => `Bitte bestätige deine neue E-Mail-Adresse für ${n}`,
    lines: ['Für ein Konto wurde diese Adresse als neue E-Mail-Adresse angegeben.', 'Erst mit deinem Klick wird sie die Adresse des Kontos; bis dahin gilt die bisherige.', '', 'Der Link gilt 48 Stunden. Warst du das nicht, ignoriere diese Mail — dann ändert sich nichts.'],
    button: 'Neue Adresse bestätigen',
  },
  en: {
    subject: n => `Please confirm your new email address for ${n}`,
    lines: ['This address was entered as the new email address for an account.', 'It only becomes the account’s address once you click; until then the old one stays in use.', '', 'The link is valid for 48 hours. If this wasn’t you, ignore this email and nothing will change.'],
    button: 'Confirm new address',
  },
  fr: {
    subject: n => `Veuillez confirmer votre nouvelle adresse e-mail pour ${n}`,
    lines: ['Cette adresse a été indiquée comme nouvelle adresse e-mail d’un compte.', 'Elle ne devient l’adresse du compte qu’après votre clic ; d’ici là, l’ancienne reste valable.', '', 'Le lien est valable 48 heures. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : rien ne changera.'],
    button: 'Confirmer la nouvelle adresse',
  },
  es: {
    subject: n => `Confirma tu nueva dirección de correo para ${n}`,
    lines: ['Esta dirección se ha indicado como nueva dirección de correo de una cuenta.', 'Solo pasa a ser la dirección de la cuenta cuando hagas clic; hasta entonces sigue valiendo la anterior.', '', 'El enlace es válido durante 48 horas. Si no has sido tú, ignora este correo y no cambiará nada.'],
    button: 'Confirmar la nueva dirección',
  },
};
/** Bestätigungslink für eine NEUE Adresse (M2). */
export function tplConfirmEmailChange({ token, base, productName = defaultProductName(), lang = 'de' }) {
  const L = L4(lang);
  const t = CONFIRM_CHANGE[L];
  const b = trimBase(base);
  const url = b ? `${b}/email-bestaetigen?token=${encodeURIComponent(token)}` : '';
  return withTag('confirm_email_change', fromLines({ subject: t.subject(productName), lines: t.lines }, { button: url ? { href: url, label: t.button } : null, lang: L }));
}

const CHANGE_TAKEN = {
  de: { subject: n => `Hinweis zu deinem Konto bei ${n}`, lines: ['Jemand hat versucht, diese E-Mail-Adresse für ein anderes Konto einzutragen. Zu dieser Adresse gibt es bei uns schon ein Konto — es bleibt, wie es ist.', '', 'Warst du das selbst und willst die Konten zusammenlegen, melde dich einfach. Sonst musst du nichts tun.'], signIn: b => `Anmelden: ${b}` },
  en: { subject: n => `A note about your ${n} account`, lines: ['Someone tried to add this email address to a different account. There is already an account with this address here, and it stays as it is.', '', 'If that was you and you want to merge the accounts, just get in touch. Otherwise you don’t need to do anything.'], signIn: b => `Sign in: ${b}` },
  fr: { subject: n => `Information concernant votre compte ${n}`, lines: ['Quelqu’un a essayé d’ajouter cette adresse e-mail à un autre compte. Un compte existe déjà avec cette adresse chez nous ; il reste inchangé.', '', 'Si c’était vous et que vous souhaitez fusionner les comptes, contactez-nous. Sinon, vous n’avez rien à faire.'], signIn: b => `Se connecter : ${b}` },
  es: { subject: n => `Aviso sobre tu cuenta de ${n}`, lines: ['Alguien ha intentado añadir esta dirección de correo a otra cuenta. Ya existe una cuenta con esta dirección y se queda como está.', '', 'Si has sido tú y quieres unir las cuentas, escríbenos. Si no, no tienes que hacer nada.'], signIn: b => `Iniciar sesión: ${b}` },
};
/** An die NEUE Adresse, wenn sie schon zu einem anderen Konto gehört (N5):
 *  derselbe Ablauf von außen, aber ein Hinweis statt eines Links. lang: die
 *  Sprache des Kontos, dem die Adresse gehört. */
export function tplEmailChangeTaken({ base, productName = defaultProductName(), lang = 'de' }) {
  const L = L4(lang);
  const t = CHANGE_TAKEN[L];
  const b = trimBase(base);
  return withTag('email_change_taken', fromLines({ subject: t.subject(productName), lines: [...t.lines, ...(b ? [t.signIn(b)] : [])] }, { lang: L }));
}

const CHANGE_REQUESTED = {
  de: { subject: n => `Neue E-Mail-Adresse für dein Konto angefordert — ${n}`, lines: (u, e) => [`Für dein Konto ${u} wurde die neue Adresse ${e} angegeben.`, 'Sie gilt erst, wenn sie über den Link in der Mail an die neue Adresse bestätigt ist. Bis dahin gehen alle Nachrichten weiter an diese Adresse.', '', 'Warst du das nicht, ändere bitte dein Passwort und melde dich bei uns.'] },
  en: { subject: n => `New email address requested for your account — ${n}`, lines: (u, e) => [`The new address ${e} was entered for your account ${u}.`, 'It only takes effect once it has been confirmed via the link in the email sent to the new address. Until then, all messages keep coming to this address.', '', 'If this wasn’t you, please change your password and get in touch.'] },
  fr: { subject: n => `Nouvelle adresse e-mail demandée pour votre compte — ${n}`, lines: (u, e) => [`La nouvelle adresse ${e} a été indiquée pour votre compte ${u}.`, 'Elle ne s’applique qu’une fois confirmée via le lien envoyé à la nouvelle adresse. D’ici là, tous les messages continuent d’arriver à cette adresse.', '', 'Si vous n’êtes pas à l’origine de cette demande, changez votre mot de passe et contactez-nous.'] },
  es: { subject: n => `Nueva dirección de correo solicitada para tu cuenta — ${n}`, lines: (u, e) => [`Para tu cuenta ${u} se ha indicado la nueva dirección ${e}.`, 'Solo será válida cuando se confirme con el enlace del correo enviado a la nueva dirección. Hasta entonces, todos los mensajes siguen llegando a esta dirección.', '', 'Si no has sido tú, cambia tu contraseña y ponte en contacto con nosotros.'] },
};
/** An die ALTE Adresse, wenn ein Wechsel angefordert wurde (M2). */
export function tplEmailChangeRequested({ username, newEmail, productName = defaultProductName(), lang = 'de' }) {
  const L = L4(lang);
  const t = CHANGE_REQUESTED[L];
  return withTag('email_change_requested', fromLines({ subject: t.subject(productName), lines: t.lines(username, newEmail) }, { lang: L }));
}

const REGISTER_EXISTING = {
  de: { subject: n => `Du hast schon ein Konto bei ${n}`, first: 'Mit dieser E-Mail-Adresse wollte sich gerade jemand neu registrieren. Zu der Adresse gibt es schon ein Konto.', signIn: b => `Anmelden: ${b} (Passwort vergessen? Auf der Anmeldeseite lässt es sich zurücksetzen.)`, last: 'Warst du das nicht, musst du nichts tun. Dein Konto bleibt, wie es ist.' },
  en: { subject: n => `You already have a ${n} account`, first: 'Someone just tried to register again with this email address. There is already an account for it.', signIn: b => `Sign in: ${b} (forgotten your password? You can reset it on the sign-in page.)`, last: 'If this wasn’t you, you don’t need to do anything. Your account stays as it is.' },
  fr: { subject: n => `Vous avez déjà un compte ${n}`, first: 'Quelqu’un vient d’essayer de créer un compte avec cette adresse e-mail. Un compte existe déjà pour cette adresse.', signIn: b => `Se connecter : ${b} (mot de passe oublié ? Vous pouvez le réinitialiser sur la page de connexion.)`, last: 'Si vous n’êtes pas à l’origine de cette demande, vous n’avez rien à faire. Votre compte reste inchangé.' },
  es: { subject: n => `Ya tienes una cuenta en ${n}`, first: 'Alguien acaba de intentar registrarse con esta dirección de correo. Ya existe una cuenta para ella.', signIn: b => `Iniciar sesión: ${b} (¿has olvidado la contraseña? Puedes restablecerla en la página de inicio de sesión.)`, last: 'Si no has sido tú, no tienes que hacer nada. Tu cuenta se queda como está.' },
};
/** Registrierung mit einer Adresse, zu der es schon ein Konto gibt (N5).
 *  lang: Sprache der Anfrage (sonst die des bestehenden Kontos). */
export function tplRegisterExisting({ base, productName = defaultProductName(), lang = 'de' }) {
  const L = L4(lang);
  const t = REGISTER_EXISTING[L];
  const b = trimBase(base);
  return withTag('register_existing', fromLines({
    subject: t.subject(productName),
    lines: [t.first, ...(b ? [t.signIn(b)] : []), '', t.last],
  }, { lang: L }));
}
