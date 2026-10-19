// Prüfung des Anschreibens und beider Unterlagen (check/*), in beide Richtungen.
//
// Anlass (10.10.2026): „ats test vom anschreiben ging gestern nicht? Da
// war nur der für den Lebenslauf". Geprüft wird:
//
//   A. Logik (Module über den Vite-Server im Browser geladen):
//      1. Muster-Anschreiben der Demo → Platzhalter-Zeile im PDF, Betreff
//         unvollständig, Mustertext, Standardformeln.
//      2. Anschreiben mit „[Firma]" / „Musterfirma" → Befund „placeholder".
//      3. Sauberes Anschreiben → kein Befund „Bitte ändern", kein „Ansehen",
//         keine Standardformel.
//      4. Datum: alt, Zukunft, vier Schreibweisen lesbar.
//      5. Zu lang → gemessener Überlauf; sauber → passt auf eine Seite.
//      6. Stellenanzeige: Titel, Firma, Ansprechperson erkannt; sauberes
//         Anschreiben nennt beides; fremdes Anschreiben → Firma fehlt,
//         Empfänger nicht in der Anzeige, Anrede allgemein.
//      7. Beide: Name/E-Mail gleich; Lebenslauf deutsch + Anschreiben
//         englisch → Sprachbefund; Begriffe getrennt nach Lebenslauf/Anschreiben.
//      8. Stilhinweise in vier Sprachen.
//   B. Oberfläche (Demo, ohne Server):
//      1. Prüfen → Anschreiben: Kurzfassung mit Befund, Dialog mit drei
//         Reitern, Stellenanzeige gilt über alle Prüfungen, Escape schließt.
//      2. Eingabe im Editor (Unternehmen) → Befund verschwindet.
//      3. Gratis-Grenze aktiv (Angebot limited:true, ohne Pass): Anschreiben
//         und Beides zeigen den Pass-Hinweis, der Lebenslauf bleibt prüfbar.
//      4. Gratis-Grenze aus: Anschreiben prüfbar.
//      5. Dialogtitel in vier Oberflächensprachen.
//
//   HARNESS_BASE=http://localhost:5263 [SHOTS=/ordner] node scripts/coverlettercheck.mjs
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5263';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';

const results = [];
const check = (ok, label, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
const step = t => console.log(`\n— ${t}`);
const errors = [];
const browser = await chromium.launch({ executablePath: EXEC });

const OFFER = limited => ({
  enabled: true, sku: 'pass90', priceCents: 900, currency: 'EUR', days: 90,
  vatNote: 'Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', productName: 'CV-Hub',
  features: ['sync', 'share', 'versions', 'mcp', 'apiKeys'], openRegistration: true,
  freeTier: { limited },
});

async function open({ offer = null, lang = 'de', viewport = { width: 1440, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale: lang === 'de' ? 'de-DE' : lang });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`Seitenfehler: ${String(e).slice(0, 200)}`));
  await page.addInitScript(l => { try { localStorage.setItem('appstudio-ui-lang', l); localStorage.removeItem('cv-check-doc'); } catch { /* */ } }, lang);
  await page.route('**/pdfapi/**', route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/pdfapi/, '');
    if (path === '/api/billing/offer') {
      return offer ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(offer) }) : route.fulfill({ status: 404, body: '' });
    }
    if (path === '/api/me') return route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"unauthorized"}' });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  return { ctx, page };
}

async function startDemo(page) {
  await page.locator('button, a').filter({ hasText: /Demo ausprobieren|Demo starten|Direkt ausprobieren|Try the demo|Essayer maintenant|Probar ahora|Essayer la démo|Probar la demo/i }).first().click();
  await page.waitForSelector('nav.ui-rail', { timeout: 15000 });
  await page.waitForTimeout(1200);
}
const rail = (page, i) => page.locator('nav.ui-rail > button:not([data-rail-import])').nth(i);

// ── A. Logik ────────────────────────────────────────────────────────────────
step('A. Logik');
{
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    const chk = await import('/src/check/coverLetterCheck.ts');
    const txt = await import('/src/check/docText.ts');
    const sty = await import('/src/check/styleLists.ts');
    const st = await import('/src/data/storage.ts');
    const demo = st.createDemoProfile('Demo');
    const cv = demo.data.de;
    const cvEn = demo.data.en;
    const cfg = { themeId: 'espoo', pairingId: 'auto', pageFormat: 'a4' };
    const ids = f => f.map(x => x.id);
    const open = f => f.filter(x => x.sev !== 'ok').map(x => x.id);
    const today = new Date();
    const fmtDe = d => d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

    // 1. Muster
    const sample = st.DEFAULT_COVER_LETTERS.de;
    const sampleText = txt.coverLetterExportText(cv, sample, cfg);
    const fSample = chk.checkCoverLetter({ cv, cl: sample, text: sampleText });
    const styleSample = sty.styleHits([sample.intro, sample.closing].join(' '), 'de').map(h => h.kind);

    // 3. Sauber
    const clean = {
      company: 'Nordlicht Software GmbH', contactPerson: 'Frau Jana Albers', companyAddress: 'Großer Burstah 12, 20457 Hamburg',
      city: 'Hamburg', date: fmtDe(today), subject: 'Bewerbung als Senior Product Designer, Kennziffer 26-041',
      salutation: 'Sehr geehrte Frau Albers,',
      intro: 'Sie suchen jemanden, der das Design System von Nordlicht Software weiterentwickelt und Research in die Produktplanung bringt. Genau daran arbeite ich seit 2023 bei Nordhub.',
      mainBody: 'Dort habe ich das Design System für drei Produktbereiche aufgebaut und gepflegt. Aus 180 Komponenten wurden 42 Bausteine, die Engineering ohne Rückfragen verwenden kann. Nutzerinterviews führe ich selbst, vor Ort bei Kunden in Deutschland und den Niederlanden.',
      companyReference: 'An Nordlicht Software reizt mich, dass Ihre Planungssoftware in Werkstätten benutzt wird, oft auf Tablets und mit Handschuhen. Barrierefreiheit nach WCAG 2.2 ist dort keine Pflichtübung, und genau darauf habe ich mich in den letzten zwei Jahren spezialisiert.',
      motivation: 'Mit Figma, Jira und Dovetail arbeite ich täglich, Workshops mit Entwicklung und Vertrieb moderiere ich regelmäßig.',
      closing: 'Ich freue mich auf das Gespräch. Anfangen kann ich ab dem 1. Januar.',
      signoff: 'Mit freundlichen Grüßen',
    };
    const cleanText = txt.coverLetterExportText(cv, clean, cfg);
    const cleanMeasure = await txt.measureCoverLetter(cv, clean, cfg);
    const fClean = chk.checkCoverLetter({ cv, cl: clean, text: cleanText, measure: cleanMeasure });
    const styleClean = sty.styleHits([clean.salutation, clean.intro, clean.mainBody, clean.companyReference, clean.motivation, clean.closing].join(' '), 'de');

    // 2. Platzhalter
    const ph = { ...clean, company: 'Musterfirma', intro: clean.intro.replace('Nordlicht Software', '[Firma]') };
    const fPh = chk.checkCoverLetter({ cv, cl: ph, text: txt.coverLetterExportText(cv, ph, cfg) });
    const phArgs = fPh.find(f => f.id === 'placeholder')?.args?.[0] ?? '';

    // 4. Datum
    const old = { ...clean, date: '3. August 2026' };
    const fut = { ...clean, date: fmtDe(new Date(today.getTime() + 20 * 86400000)) };
    const fOld = chk.checkCoverLetter({ cv, cl: old, text: cleanText, today: new Date(2026, 9, 10) });
    const fFut = chk.checkCoverLetter({ cv, cl: fut, text: cleanText });
    const dates = ['10.10.2026', '10. Oktober 2026', '10 October 2026', 'October 10, 2026', '10 octobre 2026', '10 de octubre de 2026', '2026-10-10']
      .map(s => { const d = chk.parseLetterDate(s); return d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null; });

    // 5. Überlauf
    const long = { ...clean, mainBody: Array(9).fill(clean.mainBody).join(' '), motivation: Array(6).fill(clean.companyReference).join(' ') };
    const longMeasure = await txt.measureCoverLetter(cv, long, cfg);
    const fLong = chk.checkCoverLetter({ cv, cl: long, text: txt.coverLetterExportText(cv, long, cfg), measure: longMeasure });

    // 6. Stellenanzeige
    const jd = 'Senior Product Designer (m/w/d)\n\nDie Nordlicht Software GmbH entwickelt Planungssoftware für Werkstätten in Hamburg und Kiel. Du arbeitest mit Figma, Design Systems und User Research und achtest auf Accessibility (WCAG 2.2). Jira und Confluence sind bei uns Alltag.\n\nAnsprechpartnerin: Frau Jana Albers';
    const facts = chk.analyzeJobAd(jd);
    const fJobClean = chk.checkAgainstJobAd(clean, facts, jd);
    const other = { ...clean, company: 'Südwind Logistik AG', contactPerson: '', salutation: 'Sehr geehrte Damen und Herren,', subject: 'Bewerbung als UX Designer', intro: 'Ich bewerbe mich bei Südwind Logistik.', companyReference: 'Südwind Logistik ist spannend.' };
    const fJobOther = chk.checkAgainstJobAd(other, facts, jd);
    const jd2 = 'Wir suchen ab sofort eine Projektleitung Haustechnik (w/m/d) | Vollzeit\nBei der Albers & Söhne GmbH & Co. KG in Lüneburg erwartet dich ...';
    const facts2 = chk.analyzeJobAd(jd2);

    // 7. Beide
    const cvText = (await import('/src/export/exportHtml.ts')).extractExportText(cv, cfg);
    const fBoth = chk.checkBoth({ cv, cl: clean, cvText, clText: cleanText });
    const enLetter = { ...st.DEFAULT_COVER_LETTERS.en, company: 'Nordlicht Software GmbH', subject: 'Application for Senior Product Designer' };
    const fBothLang = chk.checkBoth({ cv, cl: enLetter, cvText, clText: txt.coverLetterExportText(cv, enLetter, cfg) });
    const rows = chk.termRows(jd, cvText, chk.coverOwnText(clean));
    const row = t => rows.find(x => x.term === t);
    const cvEnText = (await import('/src/export/exportHtml.ts')).extractExportText(cvEn, cfg);
    const fBothEn = chk.checkBoth({ cv: cvEn, cl: enLetter, cvText: cvEnText, clText: txt.coverLetterExportText(cvEn, enLetter, cfg) });

    // 8. Stil in vier Sprachen
    const s = (t, l) => sty.styleHits(t, l).map(h => h.kind);
    const style4 = {
      de: s('Hiermit bewerbe ich mich als teamfähige und belastbare Fachkraft. Über ein Gespräch würde ich mich sehr freuen.', 'de'),
      en: s('I am writing to apply for this role. I am a hard-working team player and would like to delve into your vibrant landscape.', 'en'),
      fr: s("Je me permets de vous adresser ma candidature. Dynamique et rigoureuse, je souhaite apporter une valeur ajoutée.", 'fr'),
      es: s('Me dirijo a ustedes con gran interés. Soy proactiva y quiero aportar valor en un entorno dinámico.', 'es'),
      enClean: s('You are looking for someone to move maintenance planning to a new system. I did exactly that for 40 sites in 2024.', 'en'),
    };

    // 9. Begriffe: Umlaute, Artikel, Anreden, Rechtsformen
    const kw = await import('/src/check/keywords.ts');
    const terms = kw.jobTerms('Die Nordlicht Software GmbH sucht Verstärkung im Änderungsmanagement. Änderungsmanagement nach ITIL. Ansprechpartnerin: Frau Jana Albers.').map(t => `${t.term}:${t.inJd}`);

    return {
      terms,
      sample: ids(fSample), styleSample,
      clean: ids(fClean), cleanOpen: open(fClean), cleanStyle: styleClean.map(h => `${h.kind}:${h.phrase}`), cleanMeasure,
      ph: ids(fPh), phArgs,
      old: ids(fOld), fut: ids(fFut), dates,
      long: ids(fLong), longMeasure,
      facts, facts2, jobClean: ids(fJobClean), jobOther: ids(fJobOther),
      both: ids(fBoth), bothLang: ids(fBothLang), bothEn: ids(fBothEn),
      rowFigma: row('Figma'), rowConfluence: row('Confluence'), rowNordlicht: rows.find(x => /Nordlicht/.test(x.term)),
      style4,
    };
  });

  // Seit 19.10.2026 druckt das PDF ohne Anschrift keinen Platzhalter mehr,
  // das leere Anschriftfeld meldet die Prüfung als fehlende Anschrift.
  check(r.sample.includes('recipient-missing') && !r.sample.includes('recipient-placeholder'), 'Muster: fehlende Anschrift erkannt, kein Platzhalter im PDF', r.sample.join(','));
  check(r.sample.includes('subject-incomplete'), 'Muster: Betreff „Bewerbung als" unvollständig');
  check(r.sample.includes('sample-text'), 'Muster: unveränderter Mustertext erkannt');
  check(r.styleSample.includes('floskel') && r.styleSample.includes('konj'), 'Muster: Standardformel und Möglichkeitsform als Stilhinweis', r.styleSample.join(','));
  check(r.ph.includes('placeholder') && /\[Firma\]/.test(r.phArgs) && /Musterfirma/.test(r.phArgs), 'Platzhalter [Firma] und Musterfirma erkannt', r.phArgs);
  check(r.cleanOpen.length === 0, 'Sauberes Anschreiben: keine offenen Befunde', r.cleanOpen.join(','));
  check(r.clean.includes('fits-page') && r.cleanMeasure?.fits === true, 'Sauberes Anschreiben: passt gemessen auf eine Seite', JSON.stringify(r.cleanMeasure));
  check(r.clean.includes('contact-ok') && r.clean.includes('no-placeholder') && r.clean.includes('date-ok'), 'Sauberes Anschreiben: Kontakt, keine Platzhalter, Datum in Ordnung');
  check(r.cleanStyle.length === 0, 'Sauberes Anschreiben: keine Stilhinweise', r.cleanStyle.join(' | '));
  check(r.old.includes('date-old'), 'Datum 3. August 2026 am 10.10.2026 → veraltet');
  check(r.fut.includes('date-future'), 'Datum in 20 Tagen → Zukunft');
  check(r.dates.every(d => d === '2026-10-10'), 'Sieben Datumsschreibweisen gelesen', r.dates.join(' '));
  check(r.long.includes('overflow') && r.longMeasure && !r.longMeasure.fits && r.longMeasure.overMm > 0, 'Zu langes Anschreiben → Überlauf gemessen', JSON.stringify(r.longMeasure));
  check(r.long.includes('too-long'), 'Zu langes Anschreiben → Längenhinweis');
  check(r.facts.title === 'Senior Product Designer' && /Nordlicht Software GmbH/.test(r.facts.company) && /Jana Albers/.test(r.facts.contact), 'Anzeige: Titel, Firma, Ansprechperson erkannt', JSON.stringify(r.facts));
  check(/Projektleitung Haustechnik/.test(r.facts2.title) && /Albers & Söhne GmbH/.test(r.facts2.company), 'Anzeige 2: Titel mit „|", Firma mit „GmbH & Co. KG"', JSON.stringify(r.facts2));
  check(r.jobClean.includes('job-title-ok') && r.jobClean.includes('job-company-ok') && !r.jobClean.includes('job-contact-generic') && !r.jobClean.includes('job-recipient-mismatch'), 'Sauberes Anschreiben nennt Stelle und Firma der Anzeige', r.jobClean.join(','));
  check(r.jobOther.includes('job-company-missing') && r.jobOther.includes('job-recipient-mismatch') && r.jobOther.includes('job-contact-generic') && r.jobOther.includes('job-title-missing'), 'Fremdes Anschreiben: Firma fehlt, Empfänger fremd, Anrede allgemein, Titel fehlt', r.jobOther.join(','));
  check(r.both.includes('both-name-ok') && r.both.includes('both-email-ok') && r.both.includes('both-lang-ok') && !r.both.includes('both-lang'), 'Beide: Name, E-Mail, Sprache gleich', r.both.join(','));
  check(r.bothLang.includes('both-lang'), 'Beide: Lebenslauf deutsch, Anschreiben englisch → Sprachbefund', r.bothLang.join(','));
  check(!r.bothEn.includes('both-lang'), 'Beide: englischer Lebenslauf + englisches Anschreiben → kein Sprachbefund', r.bothEn.join(','));
  check(r.rowFigma?.cv && r.rowFigma?.cl, 'Begriff „Figma" in beiden', JSON.stringify(r.rowFigma));
  check(r.rowConfluence && !r.rowConfluence.cv && !r.rowConfluence.cl, 'Begriff „Confluence" in keinem', JSON.stringify(r.rowConfluence));
  check(r.style4.de.includes('floskel') && r.style4.de.includes('leer') && r.style4.de.includes('konj'), 'Stil DE: Formel, Eigenschaft, Möglichkeitsform', r.style4.de.join(','));
  check(r.style4.en.includes('floskel') && r.style4.en.includes('leer') && r.style4.en.includes('ki'), 'Stil EN: Formel, Eigenschaft, KI-Wort', r.style4.en.join(','));
  check(r.style4.fr.includes('floskel') && r.style4.fr.includes('leer') && r.style4.fr.includes('ki'), 'Stil FR', r.style4.fr.join(','));
  check(r.style4.es.includes('floskel') && r.style4.es.includes('leer') && r.style4.es.includes('ki'), 'Stil ES', r.style4.es.join(','));
  check(r.terms.includes('Verstärkung:1') && r.terms.includes('Änderungsmanagement:2') && r.terms.some(t => t.startsWith('Nordlicht Software')) && !r.terms.some(t => /^(Verst:|GmbH|Frau|Die |Ansprechpartnerin)/.test(t)), 'Begriffe: Umlaute ganz, ohne Artikel/Anrede/Rechtsform, Zählung mit Umlaut', r.terms.join(' · '));
  check(r.style4.enClean.length === 0, 'Stil EN sauber: keine Treffer', r.style4.enClean.join(','));
  await ctx.close();
}

// ── B. Oberfläche ───────────────────────────────────────────────────────────
step('B1. Prüfen → Anschreiben (ohne Grenze)');
{
  const { ctx, page } = await open();
  await startDemo(page);
  await rail(page, 2).click();
  await page.waitForTimeout(500);
  const docs = await page.locator('[data-check-docs] [role="radio"]').count();
  check(docs === 3, 'Auswahl Lebenslauf / Anschreiben / Beides im Paneel', String(docs));
  await page.click('[data-check-docs] [data-doc="cover"]');
  await page.waitForSelector('[data-cover-summary] [data-finding]', { timeout: 8000 });
  const sum = await page.locator('[data-cover-summary] [data-finding]').evaluateAll(els => els.map(e => e.getAttribute('data-finding')));
  check(sum.includes('recipient-missing'), 'Kurzfassung zeigt die fehlende Anschrift des Musters', sum.join(','));
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/check-panel-cover-1440.png` });
  await page.click('[data-cover-summary] .ck-open');
  await page.waitForSelector('[data-check-dialog="cover"]');
  const tabs = await page.locator('[data-check-dialog] [role="tab"]').evaluateAll(els => els.map(e => e.getAttribute('data-tab')));
  check(tabs.join(',') === 'text,job,style', 'Dialog Anschreiben: Reiter Textansicht, Stellenanzeige, Stil', tabs.join(','));
  const box = await page.locator('[data-check-dialog]').boundingBox();
  check(box && box.width > 800, 'Dialog nutzt die Fensterbreite (nicht im Paneel eingefangen)', box ? `${Math.round(box.width)} px` : '');
  const coverText = await page.locator('[data-cover-text]').innerText();
  check(/Lena Brandt/.test(coverText) && /Sehr geehrte Damen und Herren/.test(coverText), 'Textansicht zeigt den exportierten Text des Anschreibens');
  await page.click('[data-tab="job"]');
  await page.fill('#ck-jd-cover', 'Senior Product Designer (m/w/d)\n\nDie Nordlicht Software GmbH sucht Verstärkung mit Figma, Design Systems und Accessibility. Ansprechpartnerin: Frau Jana Albers.');
  await page.waitForTimeout(300);
  const jobF = await page.locator('[data-check-dialog] [data-finding]').evaluateAll(els => els.map(e => e.getAttribute('data-finding')));
  check(jobF.includes('job-company-missing') && jobF.includes('job-contact-generic'), 'Stellenanzeige: Firma fehlt, Anrede allgemein', jobF.join(','));
  const title = await page.inputValue('[data-fact="title"]');
  check(title === 'Senior Product Designer', 'Erkannter Stellentitel im Feld', title);
  const counters = await page.locator('[data-check-dialog] [data-terms]').innerText();
  check(!/\d+\s*%|Punkte?zahl|score/i.test(counters), 'Abgleich Anschreiben ohne Punktzahl');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/check-dialog-job-1440.png` });
  await page.click('[data-tab="style"]');
  const kinds = await page.locator('[data-style-kind]').evaluateAll(els => els.map(e => e.getAttribute('data-style-kind')));
  check(kinds.includes('floskel'), 'Stil: Standardformel des Musters gemeldet', kinds.join(','));
  const styleIntro = await page.locator('[data-check-dialog] .ck-intro').innerText();
  check(/keine KI-Erkennung/.test(styleIntro), 'Stil ausdrücklich als „keine KI-Erkennung" gekennzeichnet');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/check-dialog-style-1440.png` });
  // Anzeige gilt über alle Prüfungen
  await page.click('[data-check-dialog] [data-doc="resume"]');
  await page.click('[data-tab="job"]');
  const jdResume = await page.inputValue('#ck-jd-resume');
  check(/Nordlicht/.test(jdResume), 'Stellenanzeige bleibt beim Wechsel auf den Lebenslauf erhalten');
  await page.click('[data-check-dialog] [data-doc="both"]');
  await page.waitForSelector('[data-both-terms]');
  const both = await page.locator('[data-check-dialog] [data-finding]').evaluateAll(els => els.map(e => e.getAttribute('data-finding')));
  check(both.includes('both-name-ok') && both.includes('both-email-ok'), 'Beides: Name und E-Mail in beiden', both.join(','));
  const fig = await page.locator('[data-both-terms] tr[data-term="Figma"]').getAttribute('data-cv');
  check(fig === 'true', 'Beides: Tabelle Begriffe Lebenslauf/Anschreiben');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/check-dialog-both-1440.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  check(await page.locator('[data-check-dialog]').count() === 0, 'Escape schließt den Dialog');

  step('B2. Eingabe im Editor wirkt auf die Prüfung');
  await page.locator('header button').filter({ hasText: /^Anschreiben$/ }).first().click();
  await page.waitForTimeout(500);
  await rail(page, 0).click();
  await page.waitForTimeout(500);
  const company = page.locator('input[placeholder="Musterag GmbH"]').first();
  if (await company.count()) {
    await company.fill('Nordlicht Software GmbH');
    await page.waitForTimeout(400);
    await rail(page, 2).click();
    await page.waitForTimeout(800);
    const after = await page.locator('[data-cover-summary] [data-finding]').evaluateAll(els => els.map(e => e.getAttribute('data-finding')));
    check(!after.includes('recipient-placeholder') && !after.includes('recipient-missing'), 'Nach Eingabe des Unternehmens: Empfänger-Befund weg', after.join(','));
  } else check(false, 'Feld „Unternehmen" im Anschreiben-Editor gefunden');
  await ctx.close();
}

step('B3. Gratis-Grenze aktiv, ohne Pass');
{
  const { ctx, page } = await open({ offer: OFFER(true) });
  await startDemo(page);
  await rail(page, 2).click();
  await page.waitForTimeout(500);
  await page.click('[data-check-docs] [data-doc="cover"]');
  await page.waitForTimeout(500);
  check(await page.locator('[data-cover-locked] [data-freetier-note="coverLetter"]').count() === 1, 'Anschreiben: Pass-Hinweis statt Prüfung');
  check(await page.locator('[data-cover-summary]').count() === 0, 'Anschreiben: keine Befunde ohne Pass');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/check-panel-locked-1440.png` });
  await page.click('[data-check-docs] [data-doc="both"]');
  await page.waitForTimeout(300);
  check(await page.locator('[data-cover-locked] [data-freetier-note="coverLetter"]').count() === 1, 'Beides: Pass-Hinweis');
  await page.click('[data-check-docs] [data-doc="resume"]');
  await page.waitForTimeout(300);
  await page.locator('.ck-open').first().click();
  await page.waitForSelector('[data-check-dialog="resume"] [data-resume-text]');
  check(/Lena Brandt/.test(await page.locator('[data-resume-text]').innerText()), 'Lebenslauf-Prüfung bleibt ohne Pass frei');
  await page.click('[data-check-dialog] [data-doc="cover"]');
  check(await page.locator('[data-check-dialog] [data-cover-locked] [data-freetier-note="coverLetter"]').count() === 1, 'Dialog: Anschreiben ohne Pass zeigt den Pass-Hinweis');
  await ctx.close();
}

step('B4. Dialog und Paneel in vier Sprachen');
for (const [lang, title, doc] of [['de', 'So liest ein Portal dein Anschreiben', 'Anschreiben'], ['en', 'How a portal reads your cover letter', 'Cover letter'], ['fr', 'Comment un portail lit votre lettre', 'Lettre'], ['es', 'Así lee un portal tu carta', 'Carta']]) {
  const { ctx, page } = await open({ lang });
  await startDemo(page);
  await rail(page, 2).click();
  await page.waitForTimeout(400);
  const label = await page.locator('[data-check-docs] [data-doc="cover"]').innerText();
  await page.click('[data-check-docs] [data-doc="cover"]');
  await page.waitForSelector('[data-cover-summary] .ck-open');
  await page.click('[data-cover-summary] .ck-open');
  const h = await page.locator('#ck-title').innerText();
  check(h === title && label === doc, `${lang}: „${h}" / „${label}"`);
  await ctx.close();
}

await browser.close();
if (errors.length) { console.log('\nSeitenfehler:'); errors.forEach(e => console.log(' · ' + e)); }
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} bestanden${errors.length ? `, ${errors.length} Seitenfehler` : ''}`);
process.exit(ok === results.length && !errors.length ? 0 : 1);
