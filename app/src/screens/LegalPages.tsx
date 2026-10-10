import { useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { OPERATOR } from '../data/operator';
import { SOURCE_REPO_URL, shortUrl } from '../data/urls';
import { privacyBilling } from '../billing/legalTexts';
import { LegalSections } from '../billing/LegalText';
import { SiteFooter } from '../billing/BillingShell';
import { useOffer, registrationOpen } from '../billing/hooks';

/**
 * Statische Rechtspages (Impressum, Datenschutz). Werden vom LandingFooter und
 * vom Editor-Footer aufgerufen; Routing ist state-basiert (kein Router).
 *
 * Zweisprachig: Deutsch ist die maßgebliche Fassung (deutsches Recht, § 5 DDG,
 * DSGVO). Englisch ist eine Übersetzung zur Information — die Oberflächen-
 * sprachen fr/es sehen ebenfalls die englische Fassung, weil eine unpassende
 * Maschinenübersetzung schlechter wäre als eine ehrliche Zweitsprache.
 *
 * Inhalte sind bewusst kurz und faktisch. Bei Änderungen am Stack (neue
 * Backend-Endpoints, neue Verarbeiter, neue Tracking-Tools) MÜSSEN BEIDE
 * Sprachfassungen der Datenschutz-Sektion mitlaufen.
 *
 * Styling: helle, serifenlose Produktmarke CV-Hub (Space Grotesk + Inter,
 * Indigo, Off-White) — konsistent mit Landing/Auth/Editor-Chrome.
 */

/** Kontaktadresse aus dem Impressum — auch Kontaktstelle nach Art. 11/12 DSA
 *  und Ziel des Links „Inhalt melden" auf geteilten Lebensläufen. */
const LEGAL_CONTACT_EMAIL = OPERATOR.email;

const PAPER = 'oklch(0.985 0.003 264)';
const INK = 'oklch(0.21 0.021 264)';
const SOFT = 'oklch(0.40 0.017 264)';
const FAINT = 'oklch(0.58 0.012 264)';
const LINE = 'oklch(0.91 0.005 264)';
const ACCENT = 'oklch(0.55 0.216 264)';
const DISP = '"Space Grotesk", "Inter", system-ui, sans-serif';
const SANS = '"Inter", system-ui, -apple-system, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

const wrap: React.CSSProperties = {
  maxWidth: '720px', margin: '0 auto',
  padding: '56px 32px 96px',
  fontFamily: SANS, fontSize: '15px', lineHeight: 1.65, color: INK,
};
const h1: React.CSSProperties = {
  fontSize: '34px', fontWeight: 600, letterSpacing: '-0.03em',
  marginBottom: '8px', color: INK, fontFamily: DISP,
};
const sub: React.CSSProperties = {
  fontFamily: MONO, fontSize: '11px', letterSpacing: '0.14em',
  textTransform: 'uppercase', color: FAINT, marginBottom: '40px', fontWeight: 500,
};
const h2: React.CSSProperties = {
  fontSize: '17px', fontWeight: 600, marginTop: '32px', marginBottom: '10px',
  color: INK, fontFamily: DISP, letterSpacing: '-0.01em',
};
const p: React.CSSProperties = { margin: '0 0 14px', color: SOFT };
const a: React.CSSProperties = { color: ACCENT, textDecoration: 'underline', textUnderlineOffset: '3px' };
const code: React.CSSProperties = { fontFamily: MONO, fontSize: '13px' };
const note: React.CSSProperties = {
  margin: '40px 0 0', paddingTop: '18px', borderTop: `1px solid ${LINE}`,
  color: FAINT, fontSize: '13px',
};

/** Rechtstexte gibt es nur auf DE und EN; fr/es fallen auf EN zurück. */
type LegalLang = 'de' | 'en';
function legalLang(lang?: UiLang): LegalLang {
  return lang === 'de' ? 'de' : 'en';
}

const warn: React.CSSProperties = {
  margin: '0 0 32px', padding: '14px 16px',
  border: `1px solid ${ACCENT}`, borderRadius: '8px',
  background: 'oklch(0.97 0.02 264)',
  color: INK, fontSize: '14px', lineHeight: 1.55,
};

/* Kein fester Domainname: Die Seite gilt für die Adresse, unter der sie
 * aufgerufen wird (Domainwechsel ohne Textänderung, Runde 8). */
const STAND_DE = 'Stand [Datum]';
const STAND_EN = 'Last updated [date]';

/** Anschrift und Kontakt aus der einen Quelle (data/operator.ts). */
function OperatorAddress({ lang }: { lang: LegalLang }) {
  return (
    <p style={p}>
      <strong>{OPERATOR.name}</strong><br />
      {OPERATOR.tradeName !== OPERATOR.name && <>{OPERATOR.tradeName}<br /></>}
      {OPERATOR.street}<br />
      {OPERATOR.postalCode} {OPERATOR.city}<br />
      {OPERATOR.country[lang]}
    </p>
  );
}
function OperatorContact({ lang }: { lang: LegalLang }) {
  return (
    <p style={p}>
      {lang === 'de' ? 'E-Mail' : 'E-mail'}: <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a><br />
      {OPERATOR.phone && <>{lang === 'de' ? 'Telefon' : 'Phone'}: <a style={a} href={`tel:${OPERATOR.phone.replace(/[^+\d]/g, '')}`}>{OPERATOR.phone}</a><br /></>}
      {OPERATOR.web && <>Web: <a style={a} href={`https://${OPERATOR.web}`} target="_blank" rel="noopener noreferrer">{OPERATOR.web}</a></>}
    </p>
  );
}

export function ImpressumPage({ onBack, lang }: { onBack: () => void; lang?: UiLang }) {
  const L = legalLang(lang);
  return (
    <div style={{ minHeight: '100dvh', background: PAPER }}>
      <BackBar onBack={onBack} lang={L} />
      <div style={wrap}>
        <TemplateNotice lang={L} />
        {L === 'de' ? <ImpressumDE /> : <ImpressumEN />}
      </div>
      <SiteFooter lang={lang ?? 'de'} />
    </div>
  );
}

function ImpressumDE() {
  return (
    <>
      <h1 style={h1}>Impressum</h1>
      <div style={sub}>Angaben gemäß § 5 DDG</div>

      <OperatorAddress lang="de" />

      <h2 style={h2}>Kontakt</h2>
      <OperatorContact lang="de" />
      {/* Alle Pflichtangaben nach § 5 DDG stehen auf DIESER Seite; ein Verweis
          auf eine andere Website genügt dafür nicht.
          Vor dem Betrieb: Wirtschafts-Identifikationsnummer (§ 5 Abs. 1 Nr. 6
            DDG) eintragen, falls erteilt — in beiden Sprachfassungen.
          Für ein bezahltes Angebot braucht es zusätzlich eine Telefonnummer
            in data/operator.ts (Art. 246a § 1 Abs. 1 Nr. 3 EGBGB) — eine
            geschäftliche, keine private. */}

      <h2 style={h2}>Verantwortlich für den Inhalt</h2>
      <p style={p}>
        {OPERATOR.name}, Anschrift wie oben, ist auch verantwortlich für die
        journalistisch-redaktionellen Inhalte des Magazins nach §&nbsp;18 Abs.&nbsp;2
        Medienstaatsvertrag. Inhalte, die Nutzer selbst eintragen und über Sharelinks teilen,
        stammen von diesen Nutzern.
      </p>

      <h2 style={h2}>Magazin und KI</h2>
      {/* Art. 50 Abs. 4 Unterabs. 2 VO (EU) 2024/1689 (KI-Verordnung, gilt seit
          02.08.2026): Die Kennzeichnungspflicht für KI-Texte zu Themen von
          öffentlichem Interesse entfällt nur bei menschlicher Prüfung UND
          redaktioneller Verantwortung. Vorlage: Der Satz unten stimmt nur, wenn
          der Betreiber jeden Artikel vor der Veröffentlichung liest und
          freigibt — sonst anpassen oder (ohne Magazin) streichen. */}
      <p style={p}>
        Die Artikel im Magazin entstehen mit Unterstützung von KI-Werkzeugen. Jeder Artikel wird vor der
        Veröffentlichung von {OPERATOR.name} geprüft und freigegeben und steht unter dessen
        redaktioneller Verantwortung. Das Magazin wird vom Anbieter dieses Werkzeugs herausgegeben; wo ein Artikel
        das eigene Werkzeug erwähnt, ist das Werbung in eigener Sache.
      </p>

      <h2 style={h2}>Kontaktstelle nach dem Digital Services Act</h2>
      <p style={p}>
        Zentrale Kontaktstelle für Behörden und für Nutzer nach Art.&nbsp;11 und 12 der Verordnung
        (EU) 2022/2065: <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        Sprachen: Deutsch, Englisch. Rechtswidrige Inhalte auf geteilten Lebensläufen melden Sie
        über den Link „Inhalt melden" auf der jeweiligen Seite oder an dieselbe Adresse.
      </p>

      <h2 style={h2}>Haftungsausschluss</h2>
      <p style={p}>
        Die Inhalte dieses Werkzeugs werden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit
        und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden. Erstellte
        Lebensläufe und Anschreiben prüfen Sie bitte selbst; die Anwendung erstellt die formale
        Darstellung. Die gesetzlichen Rechte aus einem Kauf des Bewerbungs-Passes bleiben
        unberührt (AGB §§ 6 und 11).
      </p>

      <h2 style={h2}>Urheberrecht und Quelltext</h2>
      <p style={p}>
        Die mit dem Werkzeug erstellten Lebensläufe gehören den Nutzern. Der Quellcode der
        Anwendung steht als <strong>CV-Hub</strong> unter der{' '}
        <a style={a} href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">AGPL-3.0</a>{' '}
        auf{' '}
        <a style={a} href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer">{shortUrl(SOURCE_REPO_URL)}</a>.
        Die Schriften stehen unter der SIL Open Font License 1.1; die Lizenztexte liegen neben den
        Schriftdateien unter <code style={code}>/fonts/</code>. Das
        Beispielfoto im Demo-Lebenslauf stammt von Unsplash (Unsplash-Lizenz); die abgebildete
        Person ist nicht die fiktive Beispielperson. Fünf Vorlagen sind Layouts aus dem quelloffenen
        Projekt Reactive Resume von Amruth Pillai nachempfunden (MIT-Lizenz).
      </p>
    </>
  );
}

function ImpressumEN() {
  return (
    <>
      <h1 style={h1}>Legal notice</h1>
      <div style={sub}>Information pursuant to § 5 DDG (German Digital Services Act)</div>

      <OperatorAddress lang="en" />

      <h2 style={h2}>Contact</h2>
      <OperatorContact lang="en" />
      {/* Vor dem Betrieb: siehe ImpressumDE — Wirtschafts-Identifikationsnummer
          hier ebenfalls eintragen, falls erteilt. */}

      <h2 style={h2}>Responsible for the content</h2>
      <p style={p}>
        {OPERATOR.name}, address as above, is also responsible for the
        journalistic-editorial content of the magazine under § 18(2) of the German Interstate Media
        Treaty (MStV). Content that users enter themselves and share via share links comes from
        those users.
      </p>

      <h2 style={h2}>Magazine and AI</h2>
      <p style={p}>
        Magazine articles are written with the help of AI tools. Every article is reviewed and approved
        by {OPERATOR.name} before publication and is under their editorial responsibility. The magazine is
        published by the provider of this tool; where an article mentions the tool itself, that is
        advertising for our own product.
      </p>

      <h2 style={h2}>Point of contact under the Digital Services Act</h2>
      <p style={p}>
        Single point of contact for authorities and users under Art. 11 and 12 of Regulation (EU)
        2022/2065: <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        Languages: German, English. To report illegal content on a shared résumé, use the "Report
        content" link on that page or write to the same address.
      </p>

      <h2 style={h2}>Disclaimer</h2>
      <p style={p}>
        The contents of this tool are compiled with care, but no guarantee is given for their
        accuracy, completeness or timeliness. Please review the CVs and cover letters you create;
        the application produces the formal presentation. Your statutory rights from buying the
        application pass remain unaffected (Terms §§ 6 and 11).
      </p>

      <h2 style={h2}>Copyright and source code</h2>
      <p style={p}>
        The CVs created with this tool belong to the users. The source code of the application is
        published as <strong>CV-Hub</strong> under the{' '}
        <a style={a} href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">AGPL-3.0</a>{' '}
        on{' '}
        <a style={a} href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer">{shortUrl(SOURCE_REPO_URL)}</a>.
        The fonts are licensed under the SIL Open Font License 1.1; the licence texts sit next to
        the font files under <code style={code}>/fonts/</code>. The sample
        photo in the demo résumé comes from Unsplash (Unsplash License); the person shown is not the
        fictitious sample person. Five templates are modelled on layouts from the open-source project
        Reactive Resume by Amruth Pillai (MIT License).
      </p>

      <p style={note}>
        Template text. Operators must replace every [placeholder] with their own details and
        keep both language versions in sync.
      </p>
    </>
  );
}

export function PrivacyPage({ onBack, lang }: { onBack: () => void; lang?: UiLang }) {
  const L = legalLang(lang);
  /* Mit offener Registrierung gilt „Konten nur mit Einladung" nicht mehr
   * (Hinweis im Kopf von legal/datenschutzBezahlung.ts). */
  const { offer } = useOffer();
  const open = registrationOpen(offer);
  return (
    <div style={{ minHeight: '100dvh', background: PAPER }}>
      <BackBar onBack={onBack} lang={L} />
      <div style={wrap}>
        <TemplateNotice lang={L} />
        {L === 'de' ? <PrivacyDE open={open} billing={<BillingPrivacy lang={lang} />} /> : <PrivacyEN open={open} billing={<BillingPrivacy lang={lang} />} />}
      </div>
      <SiteFooter lang={lang ?? 'de'} />
    </div>
  );
}

const box: React.CSSProperties = {
  margin: '28px 0', padding: '18px 20px', border: `1px solid ${INK}`, background: '#fff',
};
const list: React.CSSProperties = { margin: '0 0 14px', paddingLeft: '20px', color: SOFT };

/*
 * Datenschutzerklärung — Vorlage für Betreiber (Sie-Form wie AGB und
 * Widerrufsbelehrung; gegen den Code abgeglichen: Rate-Limits 10–60 min,
 * Löschfristen aus janitor.js samt Admin-Protokoll 365 Tage, PDF-Zählung,
 * Speicher im Browser nach § 25 TDDDG, Umami mit allem, was das Skript
 * wirklich ausliest, und Widerspruchsschalter, Art. 22, Verwaltung und
 * Tageszähler aus stats.js). Keine Rechtsberatung.
 *
 * Gegliedert nach Rechtsgrundlage je Verarbeitung, Art. 9, Fristen,
 * Auftragsverarbeitern, Proxy-Protokollen und Rate-Limit, PDF-Export ohne
 * Konto, Daten Dritter, abgesetztem Art. 21 und Pflicht/freiwillig.
 *
 * Fristen stehen hier nur, wenn der Code sie umsetzt. Die Aufräumfristen
 * (Sharelink-Aufrufe 90 Tage, abgelehnte Zugangsanfragen 30 Tage, unbenutzte
 * Fotos 24 Stunden) kommen aus `pdf-service/janitor.js`.
 * Vor dem Betrieb prüfen:
 *   - dass janitor.js mit ausgeliefert wird (JANITOR nicht auf 0) — sonst
 *     stimmen diese drei Fristen nicht;
 *   - wie lange der eigene Reverse-Proxy Protokolle aufbewahrt; hier stehen
 *     „höchstens 14 Tage";
 *   - AVV mit Hosting- und Mail-Provider abschließen — der Text nennt beide
 *     als Auftragsverarbeiter.
 * Art. 9: Einwilligungsdialog (screens/Art9Consent.tsx, Text
 *   legal/einwilligung.ts, Server consent.js). Der Abschnitt „Besondere
 *   Angaben" beschreibt ihn; ob die Kopplung an das Speichern im Konto
 *   zulässig ist, sollte anwaltlich geprüft werden.
 * Eine Löschung inaktiver Konten (Hinweis nach 12, Löschung nach 24 Monaten)
 * ist NICHT umgesetzt und wird deshalb nicht angekündigt.
 */
/* Abschnitte zur Bezahlung (Bewerbungs-Pass: Bestellung, Mollie, Rechnung,
 * Aufbewahrung nach § 147 AO, Widerruf, Bot-Schutz) aus
 * app/src/legal/datenschutzBezahlung.ts. Fehlt die Datei, fehlt der Abschnitt. */
function BillingPrivacy({ lang }: { lang?: UiLang }) {
  const { offer } = useOffer();
  if (!offer) return null;
  const c = privacyBilling(lang ?? 'de', offer);
  return (
    <div data-privacy-billing className="bl-legal-embed">
      <LegalSections sections={c.t.sections} idPrefix="bezahlung-" />
    </div>
  );
}

/* Widerspruch gegen die Reichweitenmessung mit einem Klick (Art. 21 DSGVO).
 * Das Umami-Skript (/u/script.js) liest vor jedem Senden den Schlüssel
 * `umami.disabled` aus dem localStorage und zählt dann nicht. Der Eintrag
 * entsteht nur auf Klick der Person selbst (§ 25 Abs. 2 Nr. 2 TDDDG). */
const UMAMI_OFF_KEY = 'umami.disabled';
function readUmamiOff(): boolean {
  try { return !!window.localStorage.getItem(UMAMI_OFF_KEY); } catch { return false; }
}
function UmamiOptOut({ lang }: { lang: LegalLang }) {
  const [off, setOff] = useState<boolean>(() => (typeof window === 'undefined' ? false : readUmamiOff()));
  const [failed, setFailed] = useState(false);
  const toggle = () => {
    try {
      if (off) window.localStorage.removeItem(UMAMI_OFF_KEY);
      else window.localStorage.setItem(UMAMI_OFF_KEY, '1');
      setOff(!off); setFailed(false);
    } catch { setFailed(true); }
  };
  const de = lang === 'de';
  return (
    <p style={p} data-umami-optout={off ? 'off' : 'on'}>
      <span role="status">
        {off
          ? (de ? 'In diesem Browser zählen wir derzeit nicht mit. ' : 'We are currently not counting in this browser. ')
          : (de ? 'In diesem Browser zählen wir derzeit mit. ' : 'We are currently counting in this browser. ')}
      </span>
      <button type="button" onClick={toggle} style={{ ...a, background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer' }}>
        {off
          ? (de ? 'Zählung wieder zulassen' : 'Allow counting again')
          : (de ? 'Zählung in diesem Browser abschalten' : 'Turn off counting in this browser')}
      </button>
      {failed && <span>{de ? ' Ihr Browser erlaubt das gerade nicht (Speicher gesperrt). Schreiben Sie uns, dann widersprechen Sie per E-Mail.' : ' Your browser does not allow this right now (storage blocked). Write to us to object by e-mail instead.'}</span>}
    </p>
  );
}

function PrivacyDE({ billing, open }: { billing?: React.ReactNode; open?: boolean }) {
  return (
    <>
      <h1 style={h1}>Datenschutzerklärung</h1>
      <div style={sub}>{STAND_DE}</div>

      <p style={p}>
        Diese Seite erklärt, welche Daten bei der Nutzung dieses Werkzeugs anfallen, wofür, auf welcher
        Rechtsgrundlage, wie lange sie bleiben und wer sie sieht. Sie können das Werkzeug auf zwei Arten
        nutzen: ohne Konto (Ihre Dokumente bleiben in Ihrem Browser) oder mit
        {open ? ' einem Konto, das Sie selbst anlegen oder per Einladung bekommen' : ' einem Konto auf Einladung'} (Ihre Dokumente liegen auf unserem Server in [Land]).
      </p>

      <h2 style={h2}>Verantwortlich</h2>
      <p style={p}>
        {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.postalCode} {OPERATOR.city}, {OPERATOR.country.de},{' '}
        <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        Einen Datenschutzbeauftragten gibt es nicht; er ist für ein Angebot dieser Größe nicht
        vorgeschrieben (§&nbsp;38 BDSG).
      </p>

      <h2 style={h2}>Beim Aufruf der Seite</h2>
      <p style={p}>
        Jeder Aufruf läuft über vorgeschaltete Server ([Reverse-Proxy] und den Webserver der
        Anwendung). Sie protokollieren technisch bedingt IP-Adresse, Zeitpunkt, aufgerufene Adresse,
        Statuscode und Browserkennung. Wir brauchen diese Protokolle, um Fehler zu finden und Angriffe
        abzuwehren, und lesen sie nur dafür. Sie werden automatisch rotiert und nach höchstens 14 Tagen
        gelöscht. Rechtsgrundlage: berechtigtes Interesse am sicheren Betrieb (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO).
      </p>
      <p style={p}>
        Um Anmeldeversuche, Registrierungen, Formulare und PDF-Exporte zu begrenzen, hält der Server die
        IP-Adresse (beim PDF-Export ohne Konto gekürzt auf das Netz) zusammen mit einem Zähler im
        Arbeitsspeicher, je nach Funktion 10 bis 60&nbsp;Minuten lang. Sie wird dabei nicht auf die
        Festplatte geschrieben und ist nach einem Neustart weg. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1
        lit.&nbsp;f DSGVO (Schutz vor Missbrauch).
      </p>

      <h2 style={h2}>Ohne Konto</h2>
      <p style={p}>
        Ohne Konto liegen Ihre Lebensläufe, Anschreiben, Fotos und der Versionsverlauf ausschließlich im
        Speicher Ihres Browsers (IndexedDB; wo der Browser das nicht anbietet, ersatzweise localStorage).
        Auch ein hochgeladenes Foto bleibt dort. Wir speichern davon nichts auf dem Server. Wer die
        Website-Daten im Browser löscht, löscht damit auch die Lebensläufe; Safari tut das nach sieben
        Tagen ohne Besuch der Seite auch von selbst. Sichern Sie Ihren Stand deshalb mit der
        Sicherungsdatei (Menü „Sicherung…"): eine Datei auf Ihrem Gerät, mit der Sie alles zurückholen,
        auch auf einem anderen Gerät.
      </p>
      <p style={p}>
        Vollständig in Ihrem Browser entstehen: die Sicherungsdatei, der Import (Markdown, JSON,
        LinkedIn-Datenexport, RenderCV), die Exporte als Word, HTML, Markdown, JSON, LaTeX und
        RenderCV-YAML, die Prüfungen „So liest ein Portal" und der Abgleich mit einer Stellenanzeige.
        Den Text einer Stellenanzeige, den Sie dort einfügen, übertragen wir nicht.
      </p>
      <p style={p}>
        Eine Ausnahme ist der <strong>PDF-Export</strong>: Zum Erzeugen des PDFs wird der Inhalt des
        Dokuments samt Foto einmalig an unseren Server in [Land] übertragen, im Arbeitsspeicher
        verarbeitet und nicht gespeichert. Der Server hält davon nur fest, dass und wann ein PDF erzeugt
        wurde und mit welchen Einstellungen (etwa Sprache und Papierformat), ohne Inhalt und ohne Bezug
        zu Ihnen. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO
        (Sie fordern das PDF an).
      </p>
      <p style={p}>
        Fotos rechnet der Browser vor dem Speichern neu. Dabei fallen eingebettete Metadaten wie
        GPS-Position, Aufnahmezeit und Kameramodell weg.
      </p>

      <h2 style={h2}>Was Ihr Browser sich merkt</h2>
      <p style={p}>
        Neben Ihren Dokumenten im lokalen Modus legt das Werkzeug im Speicher Ihres Browsers nur
        Einstellungen ab, die Sie selbst wählen: die Sprache der Oberfläche, den zuletzt geöffneten
        Bereich, ausgeblendete Hinweise, Ihre Abhakliste in den Tipps, einen eingegebenen Zugangscode bis
        zur Anmeldung (höchstens 24&nbsp;Stunden) und, falls Sie das unten einstellen, den Widerspruch gegen
        die Reichweitenmessung. Diese Angaben verlassen Ihr Gerät nicht. Sie sind für die Funktionen nötig,
        die Sie aufrufen (§&nbsp;25 Abs.&nbsp;2 Nr.&nbsp;2 TDDDG); Sie können sie jederzeit über die
        Website-Daten Ihres Browsers löschen.
      </p>

      <h2 style={h2}>Mit Konto</h2>
      <p style={p}>
        {open ? 'Ein Konto legen Sie selbst an (siehe „Registrierung und Bestätigungsmail") oder bekommen es per Einladung. ' : 'Konten gibt es derzeit nur mit Einladung. '}Für ein Konto speichern wir einen <strong>Nutzernamen</strong>
        (ohne eigene Wahl aus der E-Mail-Adresse gebildet), einen <strong>Passwort-Hash</strong> (bcrypt), die
        <strong> Zeitpunkte</strong> von Anlage und letzter Anmeldung, Ihre <strong>E-Mail-Adresse</strong>, die
        Fassung der AGB, die bei der Registrierung galt, und den Stand Ihrer Einwilligung für besondere
        Angaben (siehe unten).
        Ihre Lebensläufe und Anschreiben liegen als Datensätze in unserer Datenbank, dazu bis zu 25 ältere
        Stände je Lebenslauf (Versionen) und hochgeladene <strong>Fotos</strong>. Ein Foto, das in keinem
        Lebenslauf und keinem aktiven Sharelink mehr vorkommt, löschen wir nach 24&nbsp;Stunden. Für einige
        Ereignisse (zum Beispiel Anmeldung, Import, Sharelink angelegt) halten wir Art und Zeitpunkt fest,
        ohne Inhalte. Rechtsgrundlage für all das: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Nutzungsvertrag).
      </p>
      <p style={p}>
        Legen Sie einen <strong>Sharelink</strong> an, speichern wir das Token mit Ablaufdatum, einen festen
        Stand des geteilten Dokuments und für jeden Aufruf Zeitpunkt und Browserfamilie (etwa „Chrome/Mac"),
        ohne IP-Adresse. Diese Aufrufe löschen wir nach 90&nbsp;Tagen. Verbinden Sie ein KI-Programm per
        <strong> MCP</strong> oder legen einen API-Schlüssel an, speichern wir Schlüssel und Token nur als
        Hash; Zugänge, die 30 Tage lang nicht benutzt wurden und abgelaufen sind, löschen wir.
      </p>
      <p style={p}>
        Bei aktivem Login setzen wir ein Cookie <code style={code}>cv_session</code> (httpOnly, secure,
        sameSite=lax) mit einer signierten Sitzungskennung. Es ist für die Anmeldung technisch
        notwendig (§&nbsp;25 Abs.&nbsp;2 Nr.&nbsp;2 TDDDG). Andere Cookies setzen wir nicht, deshalb gibt es
        kein Cookie-Banner.
      </p>

      <h2 style={h2}>Zugangsanfrage</h2>
      <p style={p}>
        Fragen Sie einen Zugang an, speichern wir Name, E-Mail-Adresse, Ihre Nachricht und die
        Browserfamilie, um über die Anfrage zu entscheiden und Ihnen den Einladungslink zu schicken.
        Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Anbahnung der Nutzung). Abgelehnte Anfragen
        löschen wir 30&nbsp;Tage nach der Entscheidung, angenommene mit Ihrem Konto.
      </p>

      <h2 style={h2}>Besondere Angaben im Lebenslauf</h2>
      {/* Die App fragt die Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO bei der
          Registrierung und einmalig bei der nächsten Anmeldung bestehender
          Konten ab (screens/Art9Consent.tsx). Ohne Einwilligung speichert der
          Server nichts im Konto (consent.js). */}
      <p style={p}>
        In Lebensläufe schreiben Menschen manchmal Angaben, aus denen sich Gesundheit (etwa eine
        Schwerbehinderung), Religion, Gewerkschaftszugehörigkeit oder politische Ämter ablesen
        lassen; auch ein Foto kann so etwas zeigen. Das sind besondere Kategorien nach Art.&nbsp;9
        DSGVO. In deutschen Lebensläufen sind sie in aller Regel nicht nötig. Speichern Sie solche
        Angaben in einem Konto, verarbeiten wir sie nur, um Ihr Dokument zu speichern, zu setzen und
        auf Ihren Wunsch zu teilen. Rechtsgrundlage ist Ihre ausdrückliche Einwilligung
        (Art.&nbsp;9 Abs.&nbsp;2 lit.&nbsp;a DSGVO). Wir fragen sie bei der Registrierung ab, bei älteren Konten
        einmalig bei der nächsten Anmeldung, und speichern Zeitpunkt und Fassung des Einwilligungstexts.
        Ohne Einwilligung speichert Ihr Konto keine Unterlagen; Lesen, Exportieren und Löschen gehen
        weiter. Sie können die Einwilligung jederzeit in den Kontoeinstellungen mit Wirkung für die
        Zukunft widerrufen. Danach speichert das Konto keine Änderungen mehr; wir löschen nichts
        automatisch, Sie entfernen die Angaben selbst oder löschen das Konto. Ohne Konto bleiben diese
        Angaben in Ihrem Browser und erreichen unseren Server nur kurz zum Erzeugen des PDFs.
      </p>

      <h2 style={h2}>Daten anderer Personen</h2>
      <p style={p}>
        Ein Lebenslauf kann Daten Dritter enthalten, etwa Name und Telefonnummer einer Referenz.
        Wir verarbeiten sie nur als Teil Ihres Dokuments. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1
        lit.&nbsp;f DSGVO (Ihr Interesse an einer vollständigen Bewerbung). Diese Personen einzeln zu
        informieren, wäre unverhältnismäßig (Art.&nbsp;14 Abs.&nbsp;5 lit.&nbsp;b DSGVO). Bevor Sie einen
        Sharelink verschicken, prüfen Sie bitte, ob sie einverstanden sind. Auf jeder geteilten Seite gibt
        es einen Link „Inhalt melden".
      </p>

      <h2 style={h2}>Pflichtangaben und freiwillige Angaben</h2>
      <p style={p}>
        Gesetzlich oder vertraglich müssen Sie uns nichts mitteilen. Für ein Konto brauchen wir
        {open ? ' E-Mail-Adresse und Passwort (mit Einladung: Nutzername, Passwort und Einladungscode)' : ' Nutzername, Passwort und Einladungscode'}; ohne sie können wir kein Konto anlegen. Für einen Kauf brauchen wir zusätzlich Name und Land für die
        Rechnung. Alle anderen Angaben, auch alles im Lebenslauf, sind freiwillig.
      </p>

      <h2 style={h2}>Keine automatisierten Entscheidungen</h2>
      <p style={p}>
        Wir treffen keine Entscheidungen, die ausschließlich auf automatisierter Verarbeitung beruhen
        und Ihnen gegenüber rechtliche Wirkung entfalten oder Sie ähnlich erheblich beeinträchtigen
        (Art.&nbsp;22 DSGVO). Die Prüfungen und Tipps im Werkzeug sind Hinweise für Sie; wir bewerten damit
        weder Sie noch Ihre Bewerbung, und wir geben die Ergebnisse an niemanden weiter.
      </p>

      <h2 style={h2}>Reichweitenmessung (Umami)</h2>
      {/* Vorlage: Abschnitt (und <UmamiOptOut />) streichen, wenn keine
          Reichweitenmessung betrieben wird (CV-Hub liefert keine mit). Das
          Skript liest Bildschirmgröße und Sprache per JavaScript aus (Zugriff
          i. S. v. § 25 Abs. 1 TDDDG); ob das ohne Einwilligung zulässig ist,
          ist nicht abschließend geklärt — vor dem Einschalten prüfen lassen. */}
      <p style={p}>
        Wir zählen Seitenaufrufe und einige Klicks (etwa „Demo gestartet", „PDF exportiert") mit
        <strong> Umami</strong>, das wir selbst unter <code style={code}>analytics.example.com</code> auf
        unserem Server in [Land] betreiben. Skript und Zählung laufen über diese Adresse hier (Pfad{' '}
        <code style={code}>/u/</code>), Ihr Browser verbindet sich also mit keinem weiteren Server. Umami setzt
        keine Cookies und legt keine Profile über Besuche hinweg an. Dafür liest das Skript in Ihrem
        Browser die Bildschirmgröße und die eingestellte Sprache aus und sendet sie zusammen mit
        aufgerufener Adresse, Seitentitel und verweisender Seite. Aus IP-Adresse und Browserkennung leitet
        Umami Browser, Betriebssystem, Gerätetyp und den ungefähren Standort (Land, Region, Stadt) ab und
        bildet eine Kennung, die sich monatlich ändert; die IP-Adresse selbst wird nicht gespeichert.
        Was in Ihrem Lebenslauf steht, wird nie erfasst. Rechtsgrundlage: berechtigtes Interesse daran zu
        wissen, welche Teile des Werkzeugs genutzt werden (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO).
      </p>
      <UmamiOptOut lang="de" />

      <h2 style={h2}>PDF-Erzeugung</h2>
      <p style={p}>
        PDFs erzeugt unser Server mit einem Chromium-Browser ohne Bildschirm (Playwright). Das
        Dokument kommt samt eingebettetem Foto aus Ihrem Browser, wird im Arbeitsspeicher gesetzt,
        als PDF zurückgeschickt und nicht gespeichert, weder mit noch ohne Konto.
      </p>

      <h2 style={h2}>HTML-Export, KI-Brücke und MCP</h2>
      <p style={p}>
        Eine exportierte HTML-Datei enthält Schriften und Foto selbst. Wer sie öffnet, ruft dabei
        keinen Server auf, auch nicht unseren. Nutzen Sie die KI-Brücke (etwa „In ChatGPT öffnen") oder
        den optionalen <strong>MCP-Server</strong>, geben Sie Inhalte bewusst an das KI-Programm Ihrer Wahl
        weiter, auch an Anbieter außerhalb der EU; ab dort gelten dessen Datenschutzbestimmungen. Wir
        binden selbst keinen KI-Anbieter ein und schicken Ihre Inhalte an keine KI.
      </p>

      <h2 style={h2}>Empfänger und Auftragsverarbeiter</h2>
      <p style={p}>
        Server, Datenbank und Sicherungen betreibt für uns <strong>[Hosting-Provider]</strong>,
        [Anschrift], in Rechenzentren in [Land], als
        Auftragsverarbeiter nach Art.&nbsp;28 DSGVO. E-Mails, die zum Betrieb gehören (Bestätigung der
        Adresse, Einladung, Passwort-Reset, Zwei-Faktor-Code, Bestellbestätigung und Rechnung,
        Eingangsbestätigungen von Widerruf und Kündigung, Erinnerung vor dem Ende des Passes,
        Hinweise zum Konto), verschicken wir über <strong>[Mail-Provider]</strong>,
        mit Servern in [Land], ebenfalls als Auftragsverarbeiter. Wir schicken nur an die
        Adresse, die Sie hinterlegt haben. Werbung (Tipps zur Nutzung) schicken wir nur mit Ihrer
        Einwilligung, siehe „E-Mails an Ihr Konto“. Darüber hinaus geben wir keine Daten
        weiter und übermitteln nichts in Drittländer.
      </p>

      <h2 style={h2}>E-Mails an Ihr Konto</h2>
      <p style={p}>
        <strong>Servicemails.</strong> Zu Ihrem Konto schicken wir E-Mails, die zur Nutzung und zum
        Vertrag gehören: Bestätigung der Adresse, eine Willkommensmail mit ersten Schritten,
        Sicherheitshinweise (Passwort oder Adresse geändert, Zwei-Faktor-Code, Passwort-Reset),
        Bestellbestätigung und Rechnung, die Bestätigung eines eingelösten Gutscheins, Hinweise vor und
        nach dem Ende des Passes sowie Eingangsbestätigungen von Widerruf und Kündigung.
        Rechtsgrundlage ist Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Vertrag), für Bestellbestätigung und
        Eingangsbestätigungen zusätzlich Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;c DSGVO (§&nbsp;312f, §&nbsp;356a,
        §&nbsp;312k BGB) und für Sicherheitshinweise Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (Schutz Ihres
        Kontos). Diese Mails lassen sich nicht abbestellen, solange das Konto besteht.
      </p>
      <p style={p}>
        <strong>Tipps per E-Mail (freiwillig).</strong> Nur wenn Sie bei der Registrierung oder in den
        Kontoeinstellungen ausdrücklich zustimmen, schicken wir Ihnen in den ersten zwei Wochen bis zu
        drei Mails mit Tipps zur Nutzung. Die Einwilligung wird erst wirksam, wenn Sie Ihre Adresse über
        den Bestätigungslink bestätigt haben. Zeitpunkt und Fassung der Einwilligung und eines Widerrufs
        speichern wir als Nachweis (Art.&nbsp;7 Abs.&nbsp;1 DSGVO). Rechtsgrundlage ist Art.&nbsp;6
        Abs.&nbsp;1 lit.&nbsp;a DSGVO. Sie können jederzeit mit Wirkung für die Zukunft widerrufen: über den
        Abmeldelink in jeder dieser Mails (ein Klick, ohne Anmeldung), über die Abmeldefunktion Ihres
        Mailprogramms oder in den Kontoeinstellungen unter „E-Mails“. Außerdem speichern wir, in welcher
        Sprache Sie Mails bekommen.
      </p>
      <p style={p}>
        <strong>Versandprotokoll.</strong> Zu jeder Mail speichern wir Zeitpunkt, Art der Mail, Ergebnis des
        Versands und eine gekürzte Empfängeradresse, um Zustellprobleme zu erkennen und nachweisen zu
        können, dass Pflichtmails verschickt wurden (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO). Den Inhalt
        der Mails speichern wir nicht. Das Protokoll löschen wir nach 90 Tagen.
      </p>

      <h2 style={h2}>Zwei-Faktor-Login (optional)</h2>
      <p style={p}>
        Aktivieren Sie den Zwei-Faktor-Login, schicken wir bei jeder Anmeldung einen sechsstelligen
        Einmalcode an Ihre E-Mail-Adresse. Wir speichern ihn nur als Hash; er gilt zehn Minuten.
      </p>

      <h2 style={h2}>Verwaltung und Nutzungsstatistik</h2>
      <p style={p}>
        Den Dienst verwalten wir über einen eigenen, getrennt gesicherten Zugang. Verwaltungsvorgänge
        wie Freischaltungen, Änderungen an Laufzeiten, Gutscheine oder Sperren protokollieren wir mit
        Zeitpunkt, Art, handelnder Person und betroffenem Konto, damit sie nachvollziehbar bleiben, und
        löschen die Einträge nach einem Jahr. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO
        (Nachvollziehbarkeit und Schutz vor Missbrauch, Art.&nbsp;5 Abs.&nbsp;2 und Art.&nbsp;32 DSGVO).
        Unsere Nutzungsstatistik besteht nur aus Tageszählern (zum Beispiel: wie viele PDFs, in welcher
        Sprache, mit welchem Papierformat); sie enthält keine Nutzerkennung, keine Adresse und keine
        Inhalte.
      </p>

      {billing}

      <h2 style={h2}>Wie lange Daten bleiben</h2>
      <ul style={list}>
        <li>Konto, Lebensläufe, Versionen, Fotos und protokollierte Ereignisse: bis Sie sie löschen. Löschen Sie Ihr Konto, ist alles sofort aus der Datenbank entfernt, einschließlich Ihrer Zugangsanfrage; was wir aus einem Kauf aufbewahren müssen, steht unter „Aufbewahrung nach dem Kauf".</li>
        <li>Konten ohne bestätigte E-Mail-Adresse und ohne Kauf: 48 Stunden.</li>
        <li>Fotos ohne Verwendung: 24 Stunden.</li>
        <li>Aufrufe von Sharelinks: 90 Tage.</li>
        <li>Abgelehnte Zugangsanfragen: 30 Tage nach der Entscheidung.</li>
        <li>Nie bezahlte Bestellungen: 30 Tage. Bezahlte Bestellungen samt Rechnungsangaben: zehn Jahre ab Ende des Zahlungsjahres.</li>
        <li>Widerrufs- und Kündigungserklärungen: mit der Bestellung; nicht zuzuordnende drei Jahre.</li>
        <li>Protokoll der Verwaltung: ein Jahr.</li>
        <li>Einwilligung in Tipps per E-Mail und ihr Widerruf: solange das Konto besteht (Nachweis).</li>
        <li>Versandprotokoll der E-Mails: 90 Tage. Mails, die mangels eingerichtetem Versand warten: höchstens 30 Tage.</li>
        <li>Proxy-Protokolle: höchstens 14 Tage. Zähler zur Begrenzung von Anfragen: höchstens 60 Minuten, nur im Arbeitsspeicher.</li>
        <li>Sicherungen der Datenbank: 14 Tage, danach unwiderruflich gelöscht. Gelöschtes verschwindet aus den Sicherungen also spätestens nach 14 Tagen.</li>
        <li>Inaktive Konten löschen wir auf Anfrage; eine automatische Löschung gibt es derzeit nicht.</li>
      </ul>

      <h2 style={h2}>Ihre Rechte</h2>
      <p style={p}>
        Sie haben das Recht auf Auskunft (Art.&nbsp;15), Berichtigung (Art.&nbsp;16), Löschung (Art.&nbsp;17),
        Einschränkung der Verarbeitung (Art.&nbsp;18) und Datenübertragbarkeit (Art.&nbsp;20 DSGVO). Eine
        Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen (Art.&nbsp;7 Abs.&nbsp;3).
        Im Konto-Menü gibt es einen <strong>Datenexport</strong> (alles als JSON, mit Fotos) und
        <strong> Konto löschen</strong>. Für alles andere reicht eine E-Mail an{' '}
        <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>

      <div style={box}>
        <h2 style={{ ...h2, marginTop: 0 }}>Ihr Widerspruchsrecht (Art. 21 DSGVO)</h2>
        <p style={{ ...p, margin: 0 }}>
          Soweit wir Daten auf Grundlage berechtigter Interessen verarbeiten (Art.&nbsp;6 Abs.&nbsp;1
          lit.&nbsp;f DSGVO: Proxy-Protokolle, Begrenzung von Anfragen, Reichweitenmessung, Protokoll der
          Verwaltung, Daten Dritter), können Sie dieser Verarbeitung jederzeit aus Gründen widersprechen,
          die sich aus Ihrer besonderen Situation ergeben. Wir verarbeiten die Daten dann nicht mehr, es
          sei denn, wir können zwingende schutzwürdige Gründe nachweisen, die Ihre Interessen überwiegen,
          oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von
          Rechtsansprüchen. Der Widerspruch ist formlos möglich, am einfachsten per E-Mail an{' '}
          <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>; der
          Reichweitenmessung widersprechen Sie auch mit dem Schalter oben.
        </p>
      </div>

      <h2 style={h2}>Beschwerde</h2>
      <p style={p}>
        Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art.&nbsp;77 DSGVO), etwa an
        Ihrem Wohnort. Zuständig für uns ist [zuständige Aufsichtsbehörde mit Anschrift].
      </p>
    </>
  );
}

function PrivacyEN({ billing, open }: { billing?: React.ReactNode; open?: boolean }) {
  return (
    <>
      <h1 style={h1}>Privacy policy</h1>
      <div style={sub}>{STAND_EN}</div>

      <p style={p}>
        This page explains which data is processed when you use this tool, for what purpose, on which
        legal basis, how long it is kept and who sees it. You can use the tool in two ways: without an
        account (your documents stay in your browser) or with an
        {open ? ' account you create yourself or get by invitation' : ' invite-only account'} (your documents are stored on our server in [country]).
      </p>

      <h2 style={h2}>Controller</h2>
      <p style={p}>
        {OPERATOR.name}, {OPERATOR.street}, {OPERATOR.postalCode} {OPERATOR.city}, {OPERATOR.country.en},{' '}
        <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        There is no data protection officer; one is not required for a service of this size (§ 38 BDSG).
      </p>

      <h2 style={h2}>When you open the site</h2>
      <p style={p}>
        Every request passes through upstream servers ([reverse proxy] and the
        application's web server). For technical reasons they log IP address, time, requested address,
        status code and browser identifier. We need these logs to find errors and fend off attacks, and
        read them only for that. They are rotated automatically and deleted after 14 days at most. Legal
        basis: legitimate interest in secure operation (Art. 6(1)(f) GDPR).
      </p>
      <p style={p}>
        To limit sign-in attempts, registrations, forms and PDF exports, the server keeps the IP address
        (shortened to the network for PDF exports without an account) together with a counter in memory
        for 10 to 60 minutes, depending on the function. It is never written to disk and is gone after a
        restart. Legal basis: Art. 6(1)(f) GDPR (protection against abuse).
      </p>

      <h2 style={h2}>Without an account</h2>
      <p style={p}>
        Without an account, your résumés, cover letters, photos and version history live only in your
        browser's storage (IndexedDB; where the browser does not offer it, localStorage instead). A photo
        you upload stays there too. We store none of it on the server. Clearing the site data in your
        browser deletes the résumés too, and Safari does so on its own after seven days without a visit
        to the site, so keep a backup file (menu “Backup…”): a file on your device that brings everything
        back, on another device as well.
      </p>
      <p style={p}>
        Created entirely in your browser: the backup file, imports (Markdown, JSON, LinkedIn data export,
        RenderCV), exports as Word, HTML, Markdown, JSON, LaTeX and RenderCV YAML, the “How a portal
        reads it” checks and the comparison with a job ad. We do not transfer the text of a job ad you
        paste there.
      </p>
      <p style={p}>
        The exception is the <strong>PDF export</strong>: to create the PDF, the content of the document,
        including the photo, is sent once to our server in [country], processed in memory and not stored.
        The server only records that and when a PDF was created and with which settings (such as language
        and paper size), without content and without any link to you. Legal basis: Art. 6(1)(b) GDPR (you request the PDF).
      </p>
      <p style={p}>
        Your browser re-encodes photos before storing them, which drops embedded metadata such as GPS
        position, capture time and camera model.
      </p>

      <h2 style={h2}>What your browser remembers</h2>
      <p style={p}>
        Apart from your documents in local mode, the tool only stores settings you choose yourself in your
        browser: the interface language, the last panel you opened, hints you dismissed, your checklist in
        the tips, an access code you entered until you sign in (24 hours at most) and, if you set it below,
        your objection to audience measurement. This information never leaves your device. It is needed
        for the functions you use (§ 25(2) no. 2 TDDDG); you can delete it at any time via your browser's
        site data.
      </p>

      <h2 style={h2}>With an account</h2>
      <p style={p}>
        {open ? 'You can create an account yourself (see "Registration and confirmation e-mail") or get one by invitation. ' : 'Accounts are currently invite-only. '}For an account we store a <strong>username</strong>{' '}
        (derived from the e-mail address unless you choose one), a <strong>password hash</strong> (bcrypt),
        the <strong>times</strong> of creation and last sign-in, your <strong>e-mail address</strong>, the version
        of the Terms valid at registration and the status of your consent for special categories (see below).
        Your résumés and cover letters are stored as records in our database, together with up to 25
        earlier states per résumé (versions) and uploaded <strong>photos</strong>. A photo that no longer
        appears in any résumé or active share link is deleted after 24 hours. For some events (such as
        sign-in, import, share link created) we record the type and time, without content. Legal basis for
        all of this: Art. 6(1)(b) GDPR (contract of use).
      </p>
      <p style={p}>
        If you create a <strong>share link</strong>, we store the token with its expiry date, a fixed snapshot
        of the shared document and, for each visit, the time and browser family (e.g. "Chrome/Mac"),
        without IP address. Visits are deleted after 90 days. If you connect an AI program via{' '}
        <strong>MCP</strong> or create an API key, we store keys and tokens only as hashes; expired access
        that has not been used for 30 days is deleted.
      </p>
      <p style={p}>
        While you are signed in we set a <code style={code}>cv_session</code> cookie (httpOnly, secure,
        sameSite=lax) with a signed session identifier. It is technically necessary for signing in
        (§ 25(2) no. 2 TDDDG). We set no other cookies, which is why there is no cookie banner.
      </p>

      <h2 style={h2}>Access requests</h2>
      <p style={p}>
        If you request access, we store your name, e-mail address, message and browser family to decide
        on the request and send you the invite link. Legal basis: Art. 6(1)(b) GDPR (steps prior to a
        contract). Rejected requests are deleted 30 days after the decision, accepted ones together with
        your account.
      </p>

      <h2 style={h2}>Special categories in a résumé</h2>
      <p style={p}>
        People sometimes put details into a résumé that reveal health (such as a severe disability),
        religion, trade union membership or political office; a photo can show such things too. These are
        special categories under Art. 9 GDPR and are rarely needed in a German résumé. If you store them in
        an account, we process them only to store, typeset and, at your request, share your document. The
        legal basis is your explicit consent (Art. 9(2)(a) GDPR). We ask for it at registration (older
        accounts once at their next sign-in) and store the time and the version of the consent text.
        Without consent your account does not store documents; reading, exporting and deleting still work.
        You can withdraw your consent at any time in the account settings with effect for the future. The
        account then no longer saves changes; we do not delete anything automatically, you remove the
        details yourself or delete the account. Without an account these details stay in your browser and
        reach our server only briefly to create the PDF.
      </p>

      <h2 style={h2}>Other people's data</h2>
      <p style={p}>
        A résumé can contain data about others, such as a referee's name and phone number. We process it
        only as part of your document. Legal basis: Art. 6(1)(f) GDPR (your interest in a complete
        application). Informing each of these people individually would be disproportionate (Art. 14(5)(b)
        GDPR). Before you send a share link, please check that they agree. Every shared page has a
        "Report content" link.
      </p>

      <h2 style={h2}>Required and voluntary information</h2>
      <p style={p}>
        You are under no legal or contractual obligation to give us any data. For an account we need
        {open ? ' an e-mail address and a password (with an invitation: username, password and invite code)' : ' a username, a password and an invite code'}; without them we cannot create one. For a purchase we also need a name and country for the invoice. Everything
        else, including everything in the résumé, is voluntary.
      </p>

      <h2 style={h2}>No automated decisions</h2>
      <p style={p}>
        We do not take decisions based solely on automated processing that produce legal effects
        concerning you or similarly significantly affect you (Art. 22 GDPR). The checks and tips in the
        tool are guidance for you; we use them neither to assess you nor your application, and we pass the
        results on to no one.
      </p>

      <h2 style={h2}>Audience measurement (Umami)</h2>
      <p style={p}>
        We count page views and a few clicks (such as "demo started", "PDF exported") with{' '}
        <strong>Umami</strong>, which we run ourselves at <code style={code}>analytics.example.com</code> on
        our server in [country]. Script and counting go through this address (path <code style={code}>/u/</code>), so
        your browser does not connect to any other server. Umami sets no cookies and builds no profiles
        across visits. To do this, the script reads your screen size and browser language and sends them
        together with the requested address, page title and referring page. From the IP address and
        browser identifier Umami derives browser, operating system, device type and approximate location
        (country, region, city) and forms an identifier that changes every month; the IP address itself is
        not stored. The content of your résumé is never recorded. Legal basis: legitimate interest in
        knowing which parts of the tool are used (Art. 6(1)(f) GDPR).
      </p>
      <UmamiOptOut lang="en" />

      <h2 style={h2}>PDF rendering</h2>
      <p style={p}>
        Our server creates PDFs with a headless Chromium browser (Playwright). The document arrives from
        your browser with the photo embedded, is typeset in memory, returned as a PDF and not stored, with
        or without an account.
      </p>

      <h2 style={h2}>HTML export, AI bridge and MCP</h2>
      <p style={p}>
        An exported HTML file carries its own fonts and photo. Opening it contacts no server, ours
        included. If you use the AI bridge (such as "Open in ChatGPT") or the optional{' '}
        <strong>MCP server</strong>, you deliberately hand content to the AI program of your choice, including
        providers outside the EU; from then on its privacy terms apply. We do not integrate any AI provider
        ourselves and send your content to no AI.
      </p>

      <h2 style={h2}>Recipients and processors</h2>
      <p style={p}>
        Servers, database and backups are run for us by <strong>[hosting provider]</strong>, [address],
        in data centres in [country], as a processor under Art. 28 GDPR. E-mails
        that belong to running the service (address confirmation, invitation, password reset, two-factor
        code, order confirmation and invoice, acknowledgements of withdrawal and cancellation, reminder
        before the pass ends, account notices) are sent via <strong>[mail provider]</strong>,
        with servers in [country], also as a processor. We only send to the address you stored.
        Advertising (tips on using the tool) is only sent with your consent, see "E-mails to your account".
        Beyond that we pass on no data and transfer nothing to third countries.
      </p>

      <h2 style={h2}>E-mails to your account</h2>
      <p style={p}>
        <strong>Service e-mails.</strong> We send e-mails that belong to using the account and to the
        contract: address confirmation, a welcome e-mail with first steps, security notices (password or
        address changed, two-factor code, password reset), order confirmation and invoice, confirmation of a
        redeemed voucher, notices before and after the end of the pass, and acknowledgements of withdrawal
        and cancellation. Legal basis: Art. 6(1)(b) GDPR (contract), for order confirmations and
        acknowledgements also Art. 6(1)(c) GDPR (sections 312f, 356a and 312k of the German Civil Code), for
        security notices Art. 6(1)(f) GDPR (protecting your account). These e-mails cannot be unsubscribed
        while the account exists.
      </p>
      <p style={p}>
        <strong>Tips by e-mail (optional).</strong> Only if you explicitly agree when registering or in the
        account settings do we send you up to three e-mails with tips during the first two weeks. The consent
        only takes effect once you have confirmed your address via the confirmation link. We store the time
        and version of the consent and of a withdrawal as proof (Art. 7(1) GDPR). Legal basis: Art. 6(1)(a)
        GDPR. You can withdraw at any time with effect for the future: via the unsubscribe link in each of
        these e-mails (one click, no login), via your e-mail program's unsubscribe function or in the account
        settings under "E-mails". We also store the language in which you receive e-mails.
      </p>
      <p style={p}>
        <strong>Sending log.</strong> For every e-mail we store the time, the type of e-mail, the result of
        sending and a shortened recipient address, to detect delivery problems and to be able to show that
        mandatory e-mails were sent (Art. 6(1)(f) GDPR). We do not store the content. The log is deleted
        after 90 days.
      </p>

      <h2 style={h2}>Two-factor login (optional)</h2>
      <p style={p}>
        If you enable two-factor login, we send a six-digit one-time code to your e-mail address on every
        sign-in. We store it only as a hash; it is valid for ten minutes.
      </p>

      <h2 style={h2}>Administration and usage statistics</h2>
      <p style={p}>
        We administer the service through a separate, separately secured access. Administrative actions
        such as activations, changes to terms, vouchers or blocks are logged with time, type, acting
        person and affected account so that they remain traceable, and the entries are deleted after one
        year. Legal basis: Art. 6(1)(f) GDPR (traceability and protection against misuse, Art. 5(2) and
        Art. 32 GDPR). Our usage statistics consist only of daily counters (for example: how many PDFs, in
        which language, with which paper size); they contain no user identifier, no address and no
        content.
      </p>

      {billing}

      <h2 style={h2}>How long data is kept</h2>
      <ul style={list}>
        <li>Account, résumés, versions, photos and recorded events: until you delete them. If you delete your account, everything is removed from the database at once, including your access request; what we must keep from a purchase is described under "Retention after purchase".</li>
        <li>Accounts without a confirmed e-mail address and without a purchase: 48 hours.</li>
        <li>Unused photos: 24 hours.</li>
        <li>Share link visits: 90 days.</li>
        <li>Rejected access requests: 30 days after the decision.</li>
        <li>Orders never paid: 30 days. Paid orders including invoice details: ten years from the end of the year of payment.</li>
        <li>Withdrawal and cancellation declarations: with the order; unmatched ones three years.</li>
        <li>Administration log: one year.</li>
        <li>Consent to tips by e-mail and its withdrawal: as long as the account exists (proof).</li>
        <li>E-mail sending log: 90 days. E-mails waiting because sending is not set up: 30 days at most.</li>
        <li>Proxy logs: 14 days at most. Rate-limit counters: 60 minutes at most, in memory only.</li>
        <li>Database backups: 14 days, then irreversibly deleted. Deleted data therefore disappears from backups within 14 days.</li>
        <li>We delete inactive accounts on request; there is currently no automatic deletion.</li>
      </ul>

      <h2 style={h2}>Your rights</h2>
      <p style={p}>
        You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of
        processing (Art. 18) and data portability (Art. 20 GDPR). You can withdraw consent at any time with
        effect for the future (Art. 7(3)). The account menu has a <strong>data export</strong> (everything as JSON,
        photos included) and <strong>delete account</strong>. For anything else, an e-mail to{' '}
        <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> is enough.
      </p>

      <div style={box}>
        <h2 style={{ ...h2, marginTop: 0 }}>Your right to object (Art. 21 GDPR)</h2>
        <p style={{ ...p, margin: 0 }}>
          Where we process data on the basis of legitimate interests (Art. 6(1)(f) GDPR: proxy logs, rate
          limiting, audience measurement, administration log, other people's data), you may object to this
          processing at any time on grounds relating to your particular situation. We will then stop
          processing the data unless we can demonstrate compelling legitimate grounds that override your
          interests, or the processing serves the establishment, exercise or defence of legal claims. No
          particular form is required; an e-mail to{' '}
          <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> is easiest; you can
          also object to audience measurement with the switch above.
        </p>
      </div>

      <h2 style={h2}>Complaints</h2>
      <p style={p}>
        You can lodge a complaint with a data protection supervisory authority (Art. 77 GDPR), for example
        where you live. The authority responsible for us is [your competent supervisory authority and its address].
      </p>

      <p style={note}>
        Template text. Operators must replace every [placeholder] with their own details and
        keep both language versions in sync.
      </p>
    </>
  );
}

/**
 * Sichtbare Warnung: Diese Rechtstexte sind eine Vorlage, kein Rechtsrat. Wer
 * CV-Hub betreibt, muss sie durch eigene Angaben ersetzen — sonst steht auf der
 * Live-Seite ein Impressum mit Platzhaltern, was in Deutschland abmahnfähig ist.
 */
function TemplateNotice({ lang }: { lang: LegalLang }) {
  return (
    <p style={warn}>
      {lang === 'de' ? (
        <>
          <strong>Vorlage — bitte ersetzen.</strong> Dieser Text ist ein Gerüst für
          Betreiber von CV-Hub, kein Rechtsrat. Alle <code style={code}>[Platzhalter]</code>{' '}
          müssen durch eigene Angaben ersetzt und die Aussagen gegen den tatsächlichen
          Betrieb geprüft werden (Provider, Serverstandort, Analytics, Aufbewahrungsfristen).
        </>
      ) : (
        <>
          <strong>Template — replace before going live.</strong> This text is a scaffold for
          people who run CV-Hub, not legal advice. Replace every{' '}
          <code style={code}>[placeholder]</code> with your own details and check every claim
          against how you actually operate (provider, server location, analytics, retention).
        </>
      )}
    </p>
  );
}

function BackBar({ onBack, lang }: { onBack: () => void; lang: LegalLang }) {
  const label = lang === 'de' ? 'Zurück' : 'Back';
  return (
    <div style={{
      borderBottom: `1px solid ${LINE}`,
      padding: '14px 32px',
      background: PAPER,
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <button
        type="button"
        onClick={onBack}
        aria-label={label}
        style={{
          background: 'transparent', border: 'none',
          fontFamily: MONO,
          fontSize: '12px', color: SOFT,
          cursor: 'pointer', padding: '4px 6px',
          letterSpacing: '0.04em',
        }}
      >
        ← {label}
      </button>
    </div>
  );
}
