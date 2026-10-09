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

import { layout, btn, h, p, escapeHtml, MAIL_COLORS } from '../mail.js';
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

/** Zeilen aus mails.ts → { subject, html, text }. */
function fromLines({ subject, lines, footer = [] }, { button = null, appendix = [] } = {}) {
  const html = lines.map(l => (l === '' ? '' : p(linkify(escapeHtml(l))))).join('')
    + (button ? `<div style="margin:4px 0 16px;">${btn(button.href, escapeHtml(button.label))}</div>` : '')
    + appendix.map(a => `<div style="border-top:1px solid ${LINE};margin:20px 0 16px;"></div>${a.title ? p(`<strong>${escapeHtml(a.title)}</strong>`) : ''}${pre(a.text)}`).join('')
    + (footer.length ? `<div style="border-top:1px solid ${LINE};margin:20px 0 12px;"></div><p style="font-size:11px;line-height:1.5;color:#8b8d9b;margin:0;">${footer.map(f => escapeHtml(f)).join('<br/>')}</p>` : '');
  const text = [...lines, ...appendix.flatMap(a => ['', a.title || '', a.text]), '', ...footer].join('\n');
  return { subject, html: layout(html), text };
}

/* ── Registrierung ───────────────────────────────────────────────────── */

export function tplConfirmEmail({ token, base, lang = 'de', productName = 'CV-Hub' }) {
  const b = base ? String(base).replace(/\/+$/, '') : null;
  const url = b ? `${b}/email-bestaetigen?token=${encodeURIComponent(token)}` : '';
  const L = legalLang(lang);
  const m = legalMail('registrationConfirmation', L, { PRODUCT_NAME: productName, CONFIRM_URL: url });
  if (m) return fromLines(m);
  // TODO(Rechtstexte): Ersatz ohne legal-texts.json.
  return fromLines({
    subject: `Bitte bestätige deine E-Mail-Adresse für ${productName}`,
    lines: ['Mit dieser Adresse wurde ein Konto angelegt. Bitte bestätige sie mit diesem Link:', '', url, '', 'Der Link gilt 48 Stunden. Ohne Bestätigung löschen wir das Konto danach automatisch, sofern nichts gekauft wurde.'],
  });
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
  if (m) return fromLines(m, { appendix });
  // TODO(Rechtstexte): Ersatz ohne legal-texts.json.
  return fromLines({
    subject: `Bestellbestätigung ${order.order_no} · Rechnung ${order.invoice_no}`,
    lines: [
      `Danke für deinen Kauf. Dein Bewerbungs-Pass ist aktiv bis ${values.PASS_UNTIL}.`, '',
      `Bestellnummer: ${order.order_no}`, `Rechnungsnummer: ${order.invoice_no}`,
      `Produkt: ${productName} Bewerbungs-Pass, ${order.pass_days} Tage`,
      `Preis: ${values.PRICE} einmalig (Endpreis, gemäß § 19 UStG keine Umsatzsteuer). Kein Abo.`,
      `Widerruf bis einschließlich ${values.WITHDRAWABLE_UNTIL}: ${values.BASE_URL}/widerruf`,
    ],
  }, { appendix });
}

/* ── Widerruf ────────────────────────────────────────────────────────── */

/** Eingangsbestätigung (Paragraf 356a Abs. 4 BGB): Inhalt, Datum, Uhrzeit. */
export function tplWithdrawalReceipt({ order, statement, receivedAt, refundStatus = 'requested', seller = {}, productName = '', base = null }) {
  const L = legalLang(order.locale);
  const values = legalValues({ order, seller, productName, base, lang: L, extra: { refundStatus, values: { RECEIVED_AT: berlinDateTime(receivedAt) } } });
  const appendix = statement ? [{ title: L === 'de' ? 'Ihre Erklärung im Wortlaut' : 'Your declaration (German record)', text: statement }] : [];
  const m = legalMail('withdrawalReceipt', L, values);
  if (m) return fromLines(m, { appendix });
  return fromLines({
    subject: `Eingangsbestätigung Ihres Widerrufs – Bestellung ${order.order_no}`,
    lines: ['Ihr Widerruf ist bei uns eingegangen.', '', `Eingang: ${values.RECEIVED_AT}`, `Bestellung: ${order.order_no}`, `Erstattung: ${values.PRICE}, vollständig (${values.REFUND_STATUS}).`],
  }, { appendix });
}

/** Widerruf nach Fristende (über das öffentliche Formular): Eingang
 *  bestätigen, Frist nennen, Kündigung als Weg zeigen. */
export function tplWithdrawalLate({ order, statement, receivedAt, base = null }) {
  const b = base ? String(base).replace(/\/+$/, '') : '';
  const lines = [
    `Guten Tag ${order.billing_name},`, '',
    'Ihre Widerrufserklärung ist bei uns eingegangen.', '',
    `Eingang: ${berlinDateTime(receivedAt)}`,
    `Bestellung: ${order.order_no}`, '',
    'Die Widerrufsfrist dieser Bestellung war zum Zeitpunkt des Eingangs bereits abgelaufen. Wir haben Ihre Erklärung gespeichert und melden uns innerhalb von zwei Werktagen.',
    b ? `Den Pass beenden können Sie jederzeit über „Verträge hier kündigen“: ${b}/kuendigen` : '',
  ];
  return fromLines({ subject: `Eingangsbestätigung Ihrer Erklärung – Bestellung ${order.order_no}`, lines }, { appendix: statement ? [{ title: 'Ihre Erklärung im Wortlaut', text: statement }] : [] });
}

/** Öffentliche Erklärung (Widerruf oder Kündigung), die sich nicht sofort
 *  zuordnen ließ: Eingang an die eingegebene Adresse bestätigen, ohne etwas
 *  über Bestellungen zu sagen. Text des Widerrufs aus widerruf.ts (unmatched). */
export function tplDeclarationUnmatched({ type, statement, receivedAt }) {
  const fnText = LEGAL?.withdrawal?.de?.fn?.unmatched;
  const what = type === 'withdrawal' ? 'Widerruf' : 'Kündigung';
  const lines = [
    'Guten Tag,', '',
    `Ihre Erklärung (${what}) ist bei uns eingegangen.`, '',
    `Eingang: ${berlinDateTime(receivedAt)}`, '',
    type === 'withdrawal' && fnText ? fnText : 'Wir konnten sie nicht sofort einer Bestellung zuordnen. Ihre Erklärung ist trotzdem eingegangen; wir prüfen sie und melden uns innerhalb von zwei Werktagen.',
    '', 'Bitte heben Sie diese Mail als Beleg auf.',
  ];
  return fromLines({ subject: `Eingangsbestätigung Ihrer Erklärung (${what})`, lines }, { appendix: [{ title: 'Ihre Erklärung im Wortlaut', text: statement }] });
}

export function tplRefundDone({ order, seller = {}, productName = '', base = null }) {
  const L = legalLang(order.locale);
  const m = legalMail('refundDone', L, legalValues({ order, seller, productName, base, lang: L }));
  if (m) return fromLines(m);
  return fromLines({ subject: `Erstattung ausgeführt – Bestellung ${order.order_no}`, lines: [`Die Erstattung von ${euro(order.amount_cents, order.currency)} für die Bestellung ${order.order_no} ist ausgeführt.`] });
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
  if (m) return fromLines(m, { appendix });
  return fromLines({
    subject: `Kündigungsbestätigung – Bewerbungs-Pass ${order?.order_no || ''}`,
    lines: ['Wir bestätigen den Eingang Ihrer Kündigung.', '', `Eingang: ${values.RECEIVED_AT}`, `Art: ${kindText}`, `Grund: ${reason || '—'}`, `Der Vertrag endet am: ${values.CANCEL_EFFECTIVE}`],
  }, { appendix });
}

/* ── Pass endet ──────────────────────────────────────────────────────── */

/** Hinweis 14 bzw. 3 Tage vor Ende des Passes, mit „Pass verlängern“.
 *  TODO(Rechtstexte): kein Pflichttext, eigene Fassung des Backends. */
export function tplPassEnding({ username, until, daysLeft, base }) {
  const de = berlinDate(until);
  const n = Math.max(1, Math.round(Number(daysLeft) || 1));
  const b = base ? String(base).replace(/\/+$/, '') : null;
  return {
    subject: `Dein Bewerbungs-Pass endet am ${de} · Your pass ends on ${de}`,
    html: layout(
      h(`Noch ${n === 1 ? 'ein Tag' : `${n} Tage`}`)
      + p(`Hallo ${escapeHtml(username)}, dein Bewerbungs-Pass endet am <strong>${de}</strong>. Er verlängert sich nicht von selbst, es gibt kein Abo. Danach kannst du deine Lebensläufe weiter öffnen, exportieren und löschen, aber im Konto nicht mehr ändern. Gelöscht wird nichts.`)
      + p('Du brauchst länger? Ein neuer Pass schließt direkt an das bisherige Ende an.')
      + (b ? `<div style="margin:4px 0 16px;">${btn(`${b}/preise`, 'Pass verlängern →')}</div>` : '')
      + p('Willst du deine Unterlagen unabhängig vom Konto behalten: DOCX, JSON, PDF und die Vorlage als ZIP gibt es im Export-Bereich des Editors, auch ohne Pass.')
      + `<div style="border-top:1px solid ${LINE};margin:20px 0 16px;"></div>`
      + p(`<strong>Your pass ends on ${de}.</strong> It does not renew automatically. Afterwards you can still open, export and delete your résumés.${b ? ` Extend it at ${escapeHtml(b)}/preise.` : ''}`),
    ),
  };
}

/* ── An den Betreiber ────────────────────────────────────────────────── */

/** Eine Erklärung braucht Handarbeit (nicht zuzuordnen, außerordentliche
 *  Kündigung, Widerruf nach Frist). Keine Zahlungsdaten, nur der Wortlaut. */
export function tplAdminDeclaration({ type, reason, statement, receivedAt, orderNos = [] }) {
  const what = { withdrawal: 'Widerruf', cancellation: 'Kündigung', payment: 'Zahlung' }[type] || type;
  return fromLines({
    subject: `Handarbeit nötig: ${what} (${reason})`,
    lines: [
      `Eine Erklärung (${what}) braucht eine Entscheidung von Hand: ${reason}.`, '',
      `Eingang: ${berlinDateTime(receivedAt)}`,
      orderNos.length ? `Bestellungen: ${orderNos.join(', ')}` : 'Keine Bestellung zugeordnet.',
      '', 'Offene Erklärungen stehen auch in der Admin-Auswertung (GET /api/admin/billing, declarationsOpen).',
    ],
  }, { appendix: [{ title: 'Wortlaut', text: statement }] });
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
    '', 'Haben Sie das nicht selbst abgeschickt? Dann ignorieren Sie diese Mail. Ohne Bestätigung geschieht nichts; nach Ablauf des Links sehen wir uns die Erklärung von Hand an.',
  ];
  const en = L === 'en' ? ['', w
    ? 'Your withdrawal has been received. To make sure nobody withdraws on your behalf, please confirm it with the button below. The time of receipt above counts for the withdrawal period.'
    : 'Your cancellation has been received. To make sure nobody cancels on your behalf, please confirm it with the button below. The time of receipt above counts.'] : [];
  const label = w ? 'Widerruf bestätigen' : 'Kündigung bestätigen';
  return fromLines({
    subject: w ? `Bitte bestätigen: Ihr Widerruf – Bestellung ${nos}` : `Bitte bestätigen: Ihre Kündigung – Bestellung ${nos}`,
    lines: [...de, ...en].filter((l, i, a) => l !== '' || a[i - 1] !== ''),
  }, {
    button: url ? { href: url, label } : null,
    appendix: statement ? [{ title: L === 'de' ? 'Ihre Erklärung im Wortlaut' : 'Your declaration (German record)', text: statement }] : [],
  });
}

/** Erklärung, die sich nicht zuordnen ließ (M4): fester Text, KEINE Eingabe
 *  des Absenders — weder Name noch Grund noch Bestellnummer. Sonst schickt
 *  jeder beliebigen Text unter unserem Absender an beliebige Adressen. */
export function tplDeclarationReceivedPlain({ type, receivedAt }) {
  const what = type === 'withdrawal' ? 'Widerruf' : 'Kündigung';
  return fromLines({
    subject: `Eingangsbestätigung Ihrer Erklärung (${what})`,
    lines: [
      'Guten Tag,', '',
      `wir haben eine Erklärung (${what}) erhalten, die diese E-Mail-Adresse nennt.`,
      `Eingang: ${berlinDateTime(receivedAt)}`, '',
      'Wir haben Ihre Erklärung erhalten und melden uns, falls wir sie einer Bestellung zuordnen können.',
      '', 'Haben Sie nichts abgeschickt, können Sie diese Mail ignorieren.',
    ],
  });
}

/** Name des Angebots in Betreffzeilen, wenn der Aufrufer keinen mitgibt. */
const defaultProductName = () => (process.env.PRODUCT_NAME || process.env.APP_NAME || 'CV-Hub').trim();

/** Bestätigungslink für eine NEUE Adresse (M2). */
export function tplConfirmEmailChange({ token, base, productName = defaultProductName() }) {
  const b = base ? String(base).replace(/\/+$/, '') : null;
  const url = b ? `${b}/email-bestaetigen?token=${encodeURIComponent(token)}` : '';
  return fromLines({
    subject: `Bitte bestätige deine neue E-Mail-Adresse für ${productName}`,
    lines: [
      'Für ein Konto wurde diese Adresse als neue E-Mail-Adresse angegeben.',
      'Erst mit deinem Klick wird sie die Adresse des Kontos; bis dahin gilt die bisherige.', '',
      'Der Link gilt 48 Stunden. Warst du das nicht, ignoriere diese Mail — dann ändert sich nichts.',
      '', 'This address was entered as the new e-mail address of an account. It only takes effect once you confirm it (link valid for 48 hours).',
    ],
  }, { button: url ? { href: url, label: 'Neue Adresse bestätigen' } : null });
}

/** An die NEUE Adresse, wenn sie schon zu einem anderen Konto gehört (N5):
 *  derselbe Ablauf von außen, aber ein Hinweis statt eines Links. */
export function tplEmailChangeTaken({ base, productName = defaultProductName() }) {
  const b = base ? String(base).replace(/\/+$/, '') : '';
  return fromLines({
    subject: `Hinweis zu deinem Konto bei ${productName}`,
    lines: [
      'Jemand hat versucht, diese E-Mail-Adresse für ein anderes Konto einzutragen. Zu dieser Adresse gibt es bei uns schon ein Konto — es bleibt, wie es ist.',
      '', 'Warst du das selbst und willst die Konten zusammenlegen, melde dich einfach. Sonst musst du nichts tun.',
      b ? `Anmelden: ${b}` : '',
    ].filter(Boolean),
  });
}

/** An die ALTE Adresse, wenn ein Wechsel angefordert wurde (M2). */
export function tplEmailChangeRequested({ username, newEmail, productName = defaultProductName() }) {
  return fromLines({
    subject: `Neue E-Mail-Adresse für dein Konto angefordert — ${productName}`,
    lines: [
      `Für dein Konto ${username} wurde die neue Adresse ${newEmail} angegeben.`,
      'Sie gilt erst, wenn sie über den Link in der Mail an die neue Adresse bestätigt ist. Bis dahin gehen alle Nachrichten weiter an diese Adresse.',
      '', 'Warst du das nicht, ändere bitte dein Passwort und melde dich bei uns.',
    ],
  });
}

/** Registrierung mit einer Adresse, zu der es schon ein Konto gibt (N5). */
export function tplRegisterExisting({ base, productName = defaultProductName() }) {
  const b = base ? String(base).replace(/\/+$/, '') : '';
  return fromLines({
    subject: `Du hast schon ein Konto bei ${productName}`,
    lines: [
      'Mit dieser E-Mail-Adresse wollte sich gerade jemand neu registrieren. Zu der Adresse gibt es schon ein Konto.',
      b ? `Anmelden: ${b} (Passwort vergessen? Auf der Anmeldeseite lässt es sich zurücksetzen.)` : '',
      '', 'Warst du das nicht, musst du nichts tun. Dein Konto bleibt, wie es ist.',
    ].filter((l, i, a) => l !== '' || a[i - 1] !== ''),
  });
}
