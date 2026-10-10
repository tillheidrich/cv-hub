// Rechnung und Vertragsunterlagen als schlichtes HTML für den PDF-Renderer.
//
// Bewusst eigenes HTML, nie Nutzer-HTML: Hier steht nichts, was ein Käufer
// frei formulieren kann, außer seinem Namen — und der geht durch escapeHtml.
// Keine Schrift von außen, keine Bilder: Der Renderer löst ohnehin nur die
// eigenen Hosts auf, das Dokument braucht keinen.
//
// Prüfteam J1 (10.10.2026): Pflichtangaben gegen § 33 und § 34a UStDV
// (gesetze.legal, abgerufen 10.10.2026) geprüft — vollständig. „Die §§ 33 und
// 34 bleiben unberührt" (§ 34a Satz 2): Bei Beträgen bis 250 € reicht § 33,
// Steuernummer und Empfängeranschrift sind dann nicht Pflicht.
//
// P6 (B4, 10.10.2026, GoBD/§ 14b UStG): billing.js rendert die Rechnung EINMAL
// und speichert das PDF (invoice_documents); danach wird nur noch dieses
// Dokument ausgeliefert. Die Rechnung trägt deshalb keinen Widerrufsvermerk
// mehr — ein Widerruf bekommt einen eigenen Stornobeleg (buildCreditNoteHtml)
// mit eigener Nummer (Rechnungsnummer + „-S“) und Bezug auf die Rechnung.
//
// Pflichtangaben einer Kleinbetragsrechnung (Paragraf 33 UStDV, bis 250 €
// brutto): vollständiger Name und Anschrift des Leistenden, Ausstellungsdatum,
// Menge und Art der Leistung, Entgelt in einer Summe, Hinweis auf die
// Steuerbefreiung (Paragraf 34a UStDV in Verbindung mit Paragraf 19 UStG).
// Darüber hinaus stehen hier, weil sie nichts kosten und Rückfragen sparen:
// Rechnungsnummer, Käufername und Land, Leistungszeitraum, Bestellnummer und
// — falls gesetzt — Steuernummer bzw. Wirtschafts-Identifikationsnummer
// (SELLER_TAX_ID; ab 250 € Pflicht, darunter freiwillig).

import { escapeHtml } from './mail.js';
import { berlinDate, euro, legalValues } from './mailtexts/index.js';
import { termsDoc, withdrawalDoc } from './mailtexts/legal.js';

export const VAT_NOTE = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';

const CSS = `
  @page { size: A4; margin: 22mm 20mm 20mm 22mm; }
  * { box-sizing: border-box; }
  body { font-family: "DejaVu Sans", "Liberation Sans", Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #1b1c22; line-height: 1.45; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 4mm; letter-spacing: -0.01em; }
  .muted { color: #5c5e6b; }
  .small { font-size: 9pt; }
  .head { display: flex; justify-content: space-between; gap: 10mm; margin-bottom: 12mm; }
  .seller { white-space: pre-line; }
  table { width: 100%; border-collapse: collapse; margin: 6mm 0; }
  th, td { text-align: left; padding: 2.5mm 2mm; vertical-align: top; }
  th { font-size: 9pt; color: #5c5e6b; border-bottom: 1px solid #c9cad3; font-weight: 600; }
  td { border-bottom: 1px solid #e6e7ec; }
  .num { text-align: right; white-space: nowrap; }
  .total td { border-bottom: none; font-weight: 700; font-size: 11.5pt; }
  .meta td { border: none; padding: 0.6mm 0; }
  .meta td:first-child { color: #5c5e6b; width: 45mm; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 9.5pt; margin: 0 0 8mm; }
  .box { border: 1px solid #c9cad3; padding: 3mm 4mm; margin: 6mm 0; }
`;

function sellerLines(seller) {
  return [seller.name, seller.address].filter(Boolean).join('\n');
}

/**
 * @param order   Zeile aus orders (paid/withdrawn/refunded, mit invoice_no)
 * @param seller  { name, address, email, phone, taxId }
 * @param productName PRODUCT_NAME
 */
export function buildInvoiceHtml({ order, seller, productName }) {
  const issued = berlinDate(order.paid_at);
  const period = order.pass_from && order.pass_until
    ? `${berlinDate(order.pass_from)}–${berlinDate(order.pass_until)}`
    : `${order.pass_days} Tage`;
  const amount = euro(order.amount_cents, order.currency);
  const contact = [seller.email ? `E-Mail: ${seller.email}` : '', seller.phone ? `Telefon: ${seller.phone}` : ''].filter(Boolean).join(' · ');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Rechnung ${escapeHtml(order.invoice_no)}</title><style>${CSS}</style></head><body>
  <div class="head">
    <div>
      <div class="seller"><strong>${escapeHtml(seller.name)}</strong>
${escapeHtml(seller.address || '')}</div>
      ${contact ? `<div class="small muted">${escapeHtml(contact)}</div>` : ''}
      ${seller.taxId ? `<div class="small muted">Steuernummer/W-IdNr.: ${escapeHtml(seller.taxId)}</div>` : ''}
    </div>
    <div class="small muted" style="text-align:right">Rechnung<br>Invoice</div>
  </div>

  <div style="margin-bottom:8mm">
    <div class="small muted">Rechnung an</div>
    <div><strong>${escapeHtml(order.billing_name)}</strong></div>
    <div>${escapeHtml(order.email)}</div>
    <div>Land: ${escapeHtml(order.country)}</div>
  </div>

  <h1>Rechnung ${escapeHtml(order.invoice_no)}</h1>
  <table class="meta">
    <tr><td>Rechnungsnummer</td><td>${escapeHtml(order.invoice_no)}</td></tr>
    <tr><td>Rechnungsdatum</td><td>${escapeHtml(issued)}</td></tr>
    <tr><td>Leistungsdatum</td><td>${escapeHtml(issued)} (Beginn der Bereitstellung), Leistungszeitraum ${escapeHtml(period)}</td></tr>
    <tr><td>Bestellnummer</td><td>${escapeHtml(order.order_no)}</td></tr>
    <tr><td>Bezahlt</td><td>${escapeHtml(issued)} über Mollie</td></tr>
  </table>

  <table>
    <thead><tr><th style="width:12mm">Menge</th><th>Leistung</th><th class="num">Betrag</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>${escapeHtml(productName)} Bewerbungs-Pass, Nutzungszeitraum ${escapeHtml(period)}<br><span class="small muted">Word- und LaTeX-Export, Anschreiben, weitere Fassungen und Sprachen, Speichern über Geräte, Sharelinks, Versionen, KI-Verbindung; einmalig, kein Abonnement</span></td><td class="num">${escapeHtml(amount)}</td></tr>
      <tr class="total"><td></td><td>Gesamtbetrag (Endpreis)</td><td class="num">${escapeHtml(amount)}</td></tr>
    </tbody>
  </table>

  <p>${escapeHtml(VAT_NOTE)}</p>
  <p class="small muted" style="margin-top:14mm">Vielen Dank. Diese Rechnung wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>
</body></html>`;
}

/**
 * Stornobeleg (Rechnungskorrektur) nach Widerruf. Eigener Beleg mit eigener
 * Nummer und Ausstellungsdatum, Bezug auf Nummer und Datum der Rechnung,
 * negativer Betrag, Grund. Die Rechnung selbst bleibt unverändert (GoBD:
 * Unveränderbarkeit; § 14 Abs. 4 UStG-Angaben wie bei der Rechnung, soweit
 * sie bei einer Kleinbetragsrechnung nach § 33 UStDV gelten).
 *
 * @param order         Zeile aus orders (withdrawn/refunded, mit invoice_no)
 * @param creditNoteNo  Nummer des Belegs (billing.js: Rechnungsnummer + „-S“)
 * @param issuedAt      Ausstellungszeitpunkt des Belegs
 */
export function buildCreditNoteHtml({ order, seller, productName, creditNoteNo, issuedAt }) {
  const issued = berlinDate(issuedAt || new Date());
  const invoiceDate = berlinDate(order.paid_at);
  const amount = euro(order.amount_cents, order.currency);
  const minus = `-${euro(Math.abs(Number(order.amount_cents) || 0), order.currency)}`;
  const contact = [seller.email ? `E-Mail: ${seller.email}` : '', seller.phone ? `Telefon: ${seller.phone}` : ''].filter(Boolean).join(' · ');
  const refundState = order.refund_status === 'refunded' ? 'erstattet' : 'Erstattung beauftragt';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Stornobeleg ${escapeHtml(creditNoteNo)}</title><style>${CSS}</style></head><body>
  <div class="head">
    <div>
      <div class="seller"><strong>${escapeHtml(seller.name)}</strong>
${escapeHtml(seller.address || '')}</div>
      ${contact ? `<div class="small muted">${escapeHtml(contact)}</div>` : ''}
      ${seller.taxId ? `<div class="small muted">Steuernummer/W-IdNr.: ${escapeHtml(seller.taxId)}</div>` : ''}
    </div>
    <div class="small muted" style="text-align:right">Stornobeleg<br>Credit note</div>
  </div>

  <div style="margin-bottom:8mm">
    <div class="small muted">Empfänger</div>
    <div><strong>${escapeHtml(order.billing_name)}</strong></div>
    <div>${escapeHtml(order.email)}</div>
    <div>Land: ${escapeHtml(order.country)}</div>
  </div>

  <h1>Stornobeleg ${escapeHtml(creditNoteNo)}</h1>
  <table class="meta">
    <tr><td>Belegnummer</td><td>${escapeHtml(creditNoteNo)}</td></tr>
    <tr><td>Belegdatum</td><td>${escapeHtml(issued)}</td></tr>
    <tr><td>Bezug</td><td>Rechnung ${escapeHtml(order.invoice_no)} vom ${escapeHtml(invoiceDate)}</td></tr>
    <tr><td>Bestellnummer</td><td>${escapeHtml(order.order_no)}</td></tr>
    <tr><td>Grund</td><td>Widerruf des Vertrags, eingegangen am ${escapeHtml(berlinDate(order.withdrawn_at))}</td></tr>
  </table>

  <table>
    <thead><tr><th style="width:12mm">Menge</th><th>Leistung</th><th class="num">Betrag</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Storno: ${escapeHtml(productName)} Bewerbungs-Pass laut Rechnung ${escapeHtml(order.invoice_no)}</td><td class="num">${escapeHtml(minus)}</td></tr>
      <tr class="total"><td></td><td>Gutschrift gesamt</td><td class="num">${escapeHtml(minus)}</td></tr>
    </tbody>
  </table>

  <p>${escapeHtml(VAT_NOTE)}</p>
  <div class="box">Der Rechnungsbetrag von ${escapeHtml(amount)} wird vollständig auf das ursprüngliche Zahlungsmittel erstattet (Stand bei Ausstellung: ${escapeHtml(refundState)}). Die Rechnung ${escapeHtml(order.invoice_no)} bleibt unverändert; dieser Beleg hebt sie auf.</div>
  <p class="small muted" style="margin-top:14mm">Dieser Beleg wurde maschinell erstellt und ist ohne Unterschrift gültig.</p>
</body></html>`;
}

function docHtml(doc, metaRows) {
  const rows = metaRows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td style="white-space:pre-line">${escapeHtml(v)}</td></tr>`).join('');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title><style>${CSS}
  h2 { font-size: 11.5pt; margin: 6mm 0 2mm; }
  p { margin: 0 0 2.5mm; }
</style></head><body>
  <h1>${escapeHtml(doc.title)}</h1>
  ${doc.subtitle ? `<div class="muted" style="margin-bottom:4mm">${escapeHtml(doc.subtitle)}</div>` : ''}
  <table class="meta">${rows}</table>
  ${doc.sections.map(s => `${s.heading ? `<h2>${escapeHtml(s.heading)}</h2>` : ''}${s.paragraphs.map(x => `<p>${escapeHtml(x)}</p>`).join('')}`).join('\n')}
</body></html>`;
}

function metaFor(order, seller) {
  return [
    ['Bestellnummer', order.order_no],
    ['Vertragsschluss', berlinDate(order.paid_at || order.created_at)],
    ['Verkäufer', sellerLines(seller)],
  ];
}

/** AGB in der Fassung der Bestellung als PDF-Anhang. */
export function buildTermsHtml({ order, seller, productName, base }) {
  const values = legalValues({ order, seller, productName, base });
  return docHtml(termsDoc(values, 'de'), [...metaFor(order, seller), ['AGB-Fassung', order.terms_version || '–']]);
}

/** Widerrufsbelehrung mit Muster-Widerrufsformular als PDF-Anhang. */
export function buildWithdrawalHtml({ order, seller, productName, base }) {
  const values = legalValues({ order, seller, productName, base });
  return docHtml(withdrawalDoc(values, 'de'), [...metaFor(order, seller), ['Fassung der Belehrung', order.withdrawal_version || '–']]);
}
