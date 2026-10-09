// Vertragstexte und Mailtexte für Bestellung, Widerruf, Kündigung (09.10.2026).
//
// Quelle: app/src/legal/*.ts (Rechtstexte-Agent), übernommen als
// mailtexts/legal-texts.json über scripts/sync-legal.mjs — der Container von
// cv-api sieht den App-Ordner nicht. Fehlt die Datei (selbst gebaute Kopie
// ohne App-Ordner), greifen die kurzen Platzhalter unten; sie sind als
// solche gekennzeichnet (TODO Rechtstexte) und versprechen nichts, was der
// Dienst nicht tut.
//
// Platzhalter in den Texten: {{SCHLÜSSEL}} (Liste in app/src/legal/types.ts).
// Fehlende Werte bleiben sichtbar stehen — ein ungefüllter Platzhalter soll
// im Test auffallen, nicht still verschwinden.

import { readFileSync, existsSync } from 'node:fs';

const JSON_URL = new URL('./legal-texts.json', import.meta.url);

/** Inhalt von legal-texts.json oder null. */
export const LEGAL = (() => {
  try { return existsSync(JSON_URL) ? JSON.parse(readFileSync(JSON_URL, 'utf8')) : null; } catch { return null; }
})();
export const LEGAL_PLACEHOLDER = !LEGAL;
export const LEGAL_VERSION = LEGAL?.mails?.version || null;

export function fill(text, values) {
  return String(text ?? '').replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) => (values[key] === undefined || values[key] === null ? whole : String(values[key])));
}

/** Englische Lesehilfe nur für en/fr/es; alles andere (auch "*") Deutsch. */
export function legalLang(locale) {
  return /^(en|fr|es)/i.test(String(locale || '').trim()) ? 'en' : 'de';
}

/** Mailtext aus mails.ts: { subject, lines, footer } oder null. */
export function legalMail(name, lang, values) {
  const set = LEGAL?.mails?.[lang] || LEGAL?.mails?.de;
  const m = set?.[name];
  if (!m) return null;
  return {
    subject: fill(m.subject, values),
    lines: m.body.map(l => fill(l, values)),
    footer: (set.footer || []).map(l => fill(l, values)),
  };
}

/** Dateinamen der Anhänge der Bestellbestätigung. */
export function attachmentNames(lang, values) {
  const list = LEGAL?.mails?.[lang]?.orderAttachments || LEGAL?.mails?.de?.orderAttachments;
  const names = list?.length >= 3 ? list.map(n => fill(n, values)) : [
    `Rechnung-${values.INVOICE_NO}.pdf`, `AGB-${values.TERMS_VERSION || 'aktuell'}.pdf`, 'Widerrufsbelehrung-und-Muster-Widerrufsformular.pdf',
  ];
  // Dateinamen ohne Pfad- und Steuerzeichen.
  return names.map(n => [...n].map(ch => (ch === '/' || ch === '\\' || ch.charCodeAt(0) < 32 ? '_' : ch)).join(''));
}

function sellerBlock(v) {
  return [v.SELLER_NAME, v.SELLER_ADDRESS, v.SELLER_EMAIL ? `E-Mail: ${v.SELLER_EMAIL}` : '', v.SELLER_PHONE ? `Telefon: ${v.SELLER_PHONE}` : '']
    .filter(Boolean).join('\n');
}

/** AGB als gegliederter Text: [{ heading, paragraphs[] }] plus Titel. */
export function termsDoc(values, lang = 'de') {
  const t = LEGAL?.terms?.[lang] || LEGAL?.terms?.de;
  if (t) {
    return {
      title: fill(t.title, values),
      subtitle: fill(t.subtitle, values),
      sections: t.sections.map(s => ({
        heading: fill(s.title, values),
        paragraphs: [...s.paragraphs, ...(s.list || []).map(x => `– ${x}`), ...(s.after || [])].map(p => fill(p, values)),
      })),
    };
  }
  // TODO(Rechtstexte): Platzhalter, solange legal-texts.json fehlt.
  return {
    title: 'Allgemeine Geschäftsbedingungen (Platzhalter)',
    subtitle: `Fassung ${values.TERMS_VERSION || '–'}`,
    sections: [
      { heading: 'Vertragspartner', paragraphs: [sellerBlock(values)] },
      { heading: 'Leistung', paragraphs: [`${values.PRODUCT_NAME} Bewerbungs-Pass: Kontofunktionen (Speichern über Geräte, Sharelinks, Versionen, KI-Verbindung, API-Schlüssel) für ${values.DAYS} Tage. Ohne Konto bleiben Vorlagen, PDF und Word kostenlos.`] },
      { heading: 'Preis', paragraphs: [`${values.PRICE} einmalig. Endpreis; gemäß § 19 UStG wird keine Umsatzsteuer berechnet. Kein Abonnement, der Pass endet von selbst.`] },
      { heading: 'Widerruf', paragraphs: ['Siehe Widerrufsbelehrung. Innerhalb von 14 Tagen voller Preis zurück, ohne Abzug für die genutzte Zeit.'] },
    ],
  };
}

/** Widerrufsbelehrung, freiwillige Zusage und Muster-Formular. */
export function withdrawalDoc(values, lang = 'de') {
  const w = LEGAL?.withdrawal?.[lang] || LEGAL?.withdrawal?.de;
  if (w) {
    const p = w.policy;
    const f = w.form;
    return {
      title: fill(p.title, values),
      sections: [
        { heading: fill(p.rightTitle, values), paragraphs: p.right.map(x => fill(x, values)) },
        { heading: fill(p.consequencesTitle, values), paragraphs: [...p.consequences, p.noEarlyExpiry].filter(Boolean).map(x => fill(x, values)) },
        { heading: '', paragraphs: [fill(p.endMarker, values)] },
        { heading: fill(p.voluntaryTitle, values), paragraphs: p.voluntaryPromise.map(x => fill(x, values)) },
        { heading: fill(f.title, values), paragraphs: [fill(f.intro, values), ...f.lines.map(x => `— ${fill(x, values)}`), fill(f.footnote, values)] },
      ],
    };
  }
  // TODO(Rechtstexte): Platzhalter nach dem Aufbau des gesetzlichen Musters.
  return {
    title: 'Widerrufsbelehrung (Platzhalter)',
    sections: [
      { heading: 'Widerrufsrecht', paragraphs: [
        'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.',
        `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (${[values.SELLER_NAME, values.SELLER_ADDRESS, values.SELLER_PHONE, values.SELLER_EMAIL].filter(Boolean).join(', ')}) mittels einer eindeutigen Erklärung informieren. Sie können auch die Funktion „Vertrag widerrufen“ unter ${values.BASE_URL || ''}/widerruf nutzen.`,
      ] },
      { heading: 'Folgen des Widerrufs', paragraphs: ['Wir zahlen alle Zahlungen unverzüglich, spätestens binnen vierzehn Tagen zurück, über dasselbe Zahlungsmittel und ohne Entgelt. Wertersatz für die genutzte Zeit verlangen wir nicht.'] },
      { heading: 'Muster-Widerrufsformular', paragraphs: [
        `An ${values.SELLER_NAME}, ${values.SELLER_ADDRESS}, E-Mail: ${values.SELLER_EMAIL}:`,
        'Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung (*)',
        '— Bestellt am (*)/erhalten am (*)', '— Name des/der Verbraucher(s)', '— Anschrift des/der Verbraucher(s)',
        '— Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)', '— Datum', '(*) Unzutreffendes streichen.',
      ] },
    ],
  };
}

/** Ein Dokument als Klartext (für den Mailkörper). */
export function docText(doc) {
  return [doc.title, doc.subtitle, '', ...doc.sections.flatMap(s => [s.heading, ...s.paragraphs, ''])].filter(x => x !== undefined).join('\n').trim();
}
