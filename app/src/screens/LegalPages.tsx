import type { UiLang } from '../ui/i18n';

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
// Vor dem Betrieb ausfüllen: die Kontaktadresse des Betreibers dieser Instanz.
export const LEGAL_CONTACT_EMAIL = 'your-email@example.com';

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
const warn: React.CSSProperties = {
  margin: '0 0 32px', padding: '14px 16px',
  border: `1px solid ${ACCENT}`, borderRadius: '8px',
  background: 'oklch(0.97 0.02 264)',
  color: INK, fontSize: '14px', lineHeight: 1.55,
};

/** Rechtstexte gibt es nur auf DE und EN; fr/es fallen auf EN zurück. */
type LegalLang = 'de' | 'en';
function legalLang(lang?: UiLang): LegalLang {
  return lang === 'de' ? 'de' : 'en';
}

const STAND_DE = 'Stand [Datum] · gilt für cv.example.com';
const STAND_EN = 'Last updated [date] · applies to cv.example.com';

export function ImpressumPage({ onBack, lang }: { onBack: () => void; lang?: UiLang }) {
  const L = legalLang(lang);
  return (
    <div style={{ minHeight: '100dvh', background: PAPER }}>
      <BackBar onBack={onBack} lang={L} />
      <div style={wrap}>
        <TemplateNotice lang={L} />
        {L === 'de' ? <ImpressumDE /> : <ImpressumEN />}
      </div>
    </div>
  );
}

function ImpressumDE() {
  return (
    <>
      <h1 style={h1}>Impressum</h1>
      <div style={sub}>Angaben gemäß § 5 DDG</div>

      <p style={p}>
        <strong>[Operator Name]</strong><br />
        [Street Address]<br />
        [Postal Code, City]<br />
        [Country]
      </p>

      <h2 style={h2}>Kontakt</h2>
      <p style={p}>
        E-Mail: <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a><br />
        Web: <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>
      </p>
      {/* Alle Pflichtangaben nach § 5 DDG stehen auf DIESER Seite; ein Verweis
          auf eine andere Website genügt dafür nicht.
          Vor dem Betrieb: Wirtschafts-Identifikationsnummer (§ 5 Abs. 1 Nr. 6
            DDG) eintragen, falls erteilt — in beiden Sprachfassungen.
          Für ein bezahltes Angebot braucht es zusätzlich eine Telefonnummer
            (Art. 246a § 1 EGBGB) — eine geschäftliche, keine private. */}

      <h2 style={h2}>Verantwortlich für den Inhalt</h2>
      <p style={p}>
        [Operator Name], Anschrift wie oben. Inhalte, die Nutzer selbst eintragen und über Sharelinks
        teilen, stammen von diesen Nutzern.
      </p>

      <h2 style={h2}>Kontaktstelle nach dem Digital Services Act</h2>
      <p style={p}>
        Zentrale Kontaktstelle für Behörden und für Nutzer nach Art.&nbsp;11 und 12 der Verordnung
        (EU) 2022/2065: <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        Sprachen: Deutsch, Englisch. Rechtswidrige Inhalte auf geteilten Lebensläufen meldest du
        über den Link „Inhalt melden" auf der jeweiligen Seite oder an dieselbe Adresse.
      </p>

      <h2 style={h2}>Haftungsausschluss</h2>
      <p style={p}>
        Die Inhalte dieses Tools werden mit Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit
        und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden. Generierte
        Lebensläufe und Anschreiben sind individuell vom Nutzer zu prüfen — die Anwendung
        erstellt nur die formale Darstellung.
      </p>

      <h2 style={h2}>Urheberrecht</h2>
      <p style={p}>
        Die durch das Tool erzeugten Lebensläufe gehören dem Nutzer. Der Quellcode der
        Anwendung steht als <strong>CV-Hub</strong> unter der{' '}
        <a style={a} href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">AGPL-3.0</a>{' '}
        auf{' '}
        <a style={a} href="https://git.example.com/your-org/cv-hub" target="_blank" rel="noopener noreferrer">git.example.com</a>.
      </p>
    </>
  );
}

function ImpressumEN() {
  return (
    <>
      <h1 style={h1}>Legal notice</h1>
      <div style={sub}>Information pursuant to § 5 DDG (German Digital Services Act)</div>

      <p style={p}>
        <strong>[Operator Name]</strong><br />
        [Street Address]<br />
        [Postal Code, City]<br />
        [Country]
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        E-mail: <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a><br />
        Web: <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>
      </p>
      {/* Vor dem Betrieb: siehe ImpressumDE — Wirtschafts-Identifikationsnummer
          hier ebenfalls eintragen, falls erteilt. */}

      <h2 style={h2}>Responsible for the content</h2>
      <p style={p}>
        [Operator Name], address as above. Content that users enter themselves and share via share
        links comes from those users.
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
        accuracy, completeness or timeliness. Generated CVs and cover letters must be reviewed
        by the user — the application only produces the formal presentation.
      </p>

      <h2 style={h2}>Copyright</h2>
      <p style={p}>
        The CVs produced with this tool belong to the user. The source code of the application is
        published as <strong>CV-Hub</strong> under the{' '}
        <a style={a} href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">AGPL-3.0</a>{' '}
        on{' '}
        <a style={a} href="https://git.example.com/your-org/cv-hub" target="_blank" rel="noopener noreferrer">git.example.com</a>.
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
  return (
    <div style={{ minHeight: '100dvh', background: PAPER }}>
      <BackBar onBack={onBack} lang={L} />
      <div style={wrap}>
        <TemplateNotice lang={L} />
        {L === 'de' ? <PrivacyDE /> : <PrivacyEN />}
      </div>
    </div>
  );
}

const box: React.CSSProperties = {
  margin: '28px 0', padding: '18px 20px', border: `1px solid ${INK}`, background: '#fff',
};
const list: React.CSSProperties = { margin: '0 0 14px', paddingLeft: '20px', color: SOFT };

/*
 * Datenschutzerklärung — Vorlage für Betreiber.
 *
 * Gegliedert nach Rechtsgrundlage je Verarbeitung, Art. 9, Fristen,
 * Auftragsverarbeitern, Proxy-Protokollen und Rate-Limit, PDF-Export in der
 * Demo, Daten Dritter, abgesetztem Art. 21 und Pflicht/freiwillig.
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
 *     als Auftragsverarbeiter;
 *   - der Abschnitt „Besondere Angaben" beschreibt eine Einwilligung; einen
 *     eigenen Einwilligungsdialog im Editor gibt es noch nicht.
 * Eine Löschung inaktiver Konten ist NICHT umgesetzt und wird deshalb nicht
 * angekündigt.
 */
function PrivacyDE() {
  return (
    <>
      <h1 style={h1}>Datenschutzerklärung</h1>
      <div style={sub}>{STAND_DE}</div>

      <p style={p}>
        Diese Seite erklärt, welche Daten bei der Nutzung von cv.example.com anfallen,
        wofür, auf welcher Rechtsgrundlage, wie lange sie bleiben und wer sie sieht. Du kannst das
        Werkzeug auf zwei Arten nutzen: ohne Konto (die Daten bleiben in deinem Browser) oder mit
        einem Konto auf Einladung (die Daten liegen auf unserem Server).
      </p>

      <h2 style={h2}>Verantwortlich</h2>
      <p style={p}>
        [Operator Name], [Street Address], [Postal Code, City], [Country],{' '}
        <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        Einen Datenschutzbeauftragten gibt es nicht; er ist für ein Angebot dieser Größe nicht
        vorgeschrieben.
      </p>

      <h2 style={h2}>Beim Aufruf der Seite</h2>
      <p style={p}>
        Jeder Aufruf läuft über einen vorgeschalteten Proxy ([Reverse-Proxy]). Er protokolliert
        technisch bedingt IP-Adresse, Zeitpunkt, aufgerufene Adresse, Statuscode und Browserkennung.
        Wir brauchen diese Protokolle, um Fehler zu finden und Angriffe abzuwehren, und lesen sie nur
        dafür. Sie werden automatisch rotiert und nach höchstens 14 Tagen gelöscht.
        Rechtsgrundlage: berechtigtes Interesse am sicheren Betrieb (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO).
      </p>
      <p style={p}>
        Um Anmeldeversuche, Registrierungen und PDF-Exporte zu begrenzen, hält der Server die
        IP-Adresse zusammen mit einem Zähler im Arbeitsspeicher, je nach Funktion 15 bis
        60&nbsp;Minuten lang. Sie wird dabei nicht auf die Festplatte geschrieben und ist nach
        einem Neustart weg. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO (Schutz vor Missbrauch).
      </p>

      <h2 style={h2}>Ohne Konto (Demo)</h2>
      <p style={p}>
        Ohne Konto liegen deine Lebensläufe, Anschreiben und ein hochgeladenes Foto ausschließlich im
        Speicher deines Browsers (localStorage). Wir speichern davon nichts auf dem Server. Wer die
        Website-Daten im Browser löscht, löscht damit auch die Lebensläufe; Safari tut das nach
        einiger Zeit ohne Besuch auch von selbst. Sichere deinen Stand deshalb über den Export
        (JSON). Der Markdown-Import, der LinkedIn-Import, Word, HTML, Markdown und JSON laufen
        vollständig im Browser.
      </p>
      <p style={p}>
        Eine Ausnahme ist der <strong>PDF-Export</strong>: Zum Erzeugen des PDFs wird der Inhalt des
        Dokuments samt Foto einmalig an unseren Server in [Land] übertragen, im Arbeitsspeicher
        verarbeitet und nicht gespeichert. Der Server merkt sich davon nur, dass ein PDF erzeugt
        wurde, ohne Inhalt und ohne Bezug zu dir. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO
        (du forderst das PDF an).
      </p>
      <p style={p}>
        Fotos rechnet der Browser vor dem Speichern neu. Dabei fallen eingebettete Metadaten wie
        GPS-Position, Aufnahmezeit und Kameramodell weg.
      </p>

      <h2 style={h2}>Mit Konto</h2>
      <p style={p}>
        Konten gibt es derzeit nur mit Einladung. Für ein Konto speichern wir <strong>Nutzername,
        Passwort-Hash</strong> (bcrypt), <strong>Zeitpunkte</strong> von Anlage und letzter Anmeldung und,
        wenn du sie angibst, eine <strong>E-Mail-Adresse</strong>. Deine Lebensläufe und Anschreiben liegen
        als Datensätze in unserer Datenbank, dazu bis zu 25 ältere Stände je Lebenslauf
        (Versionen) und hochgeladene <strong>Fotos</strong>. Ein Foto, das in keinem Lebenslauf und keinem
        aktiven Sharelink mehr vorkommt, löschen wir nach 24&nbsp;Stunden. Für einige Ereignisse
        (zum Beispiel Anmeldung, PDF-Export, Import) halten wir Art und Zeitpunkt fest, ohne Inhalte.
        Rechtsgrundlage für all das: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Nutzungsvertrag).
      </p>
      <p style={p}>
        Legst du einen <strong>Sharelink</strong> an, speichern wir das Token mit Ablaufdatum und für jeden
        Aufruf Zeitpunkt und Browserfamilie (etwa „Chrome/Mac"), ohne IP-Adresse. Diese Aufrufe
        löschen wir nach 90&nbsp;Tagen. Verbindest du ein KI-Programm per <strong>MCP</strong> oder legst einen
        API-Schlüssel an, speichern wir dafür Schlüssel und Token als Hash.
      </p>
      <p style={p}>
        Bei aktivem Login setzen wir ein Cookie <code style={code}>cv_session</code> (httpOnly, secure,
        sameSite=lax) mit einer signierten Sitzungskennung. Es ist für die Anmeldung technisch
        notwendig (§&nbsp;25 Abs.&nbsp;2 Nr.&nbsp;2 TDDDG). Andere Cookies setzen wir nicht, deshalb gibt es
        kein Cookie-Banner.
      </p>

      <h2 style={h2}>Zugangsanfrage</h2>
      <p style={p}>
        Fragst du einen Zugang an, speichern wir Name, E-Mail-Adresse, deine Nachricht und die
        Browserfamilie, um über die Anfrage zu entscheiden und dir den Einladungslink zu schicken.
        Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;b DSGVO (Anbahnung der Nutzung). Abgelehnte Anfragen
        löschen wir 30&nbsp;Tage nach der Entscheidung, angenommene mit deinem Konto.
      </p>

      <h2 style={h2}>Besondere Angaben im Lebenslauf</h2>
      <p style={p}>
        In Lebensläufe schreiben Menschen manchmal Angaben, aus denen sich Gesundheit (etwa eine
        Schwerbehinderung), Religion, Gewerkschaftszugehörigkeit oder politische Ämter ablesen
        lassen; auch ein Foto kann so etwas zeigen. Das sind besondere Kategorien nach Art.&nbsp;9
        DSGVO. In deutschen Lebensläufen sind sie in aller Regel nicht nötig. Trägst du sie in
        einem Konto ein, verarbeiten wir sie nur, um dein Dokument zu speichern und zu setzen.
        Rechtsgrundlage ist deine ausdrückliche Einwilligung (Art.&nbsp;9 Abs.&nbsp;2 lit.&nbsp;a DSGVO). Du
        kannst sie jederzeit mit Wirkung für die Zukunft widerrufen, am einfachsten, indem du die
        Angaben löschst.
      </p>

      <h2 style={h2}>Daten anderer Personen</h2>
      <p style={p}>
        Ein Lebenslauf kann Daten Dritter enthalten, etwa Name und Telefonnummer einer Referenz.
        Wir verarbeiten sie nur als Teil deines Dokuments. Rechtsgrundlage: Art.&nbsp;6 Abs.&nbsp;1
        lit.&nbsp;f DSGVO (dein Interesse an einer vollständigen Bewerbung). Diese Personen einzeln zu
        informieren, wäre unverhältnismäßig (Art.&nbsp;14 Abs.&nbsp;5 lit.&nbsp;b DSGVO). Bevor du einen Sharelink
        verschickst, prüfe bitte, ob sie einverstanden sind. Auf jeder geteilten Seite gibt es einen
        Link „Inhalt melden".
      </p>

      <h2 style={h2}>Pflichtangaben und freiwillige Angaben</h2>
      <p style={p}>
        Gesetzlich oder vertraglich musst du uns nichts mitteilen. Für ein Konto brauchen wir
        Nutzername, Passwort und Einladungscode; ohne sie können wir kein Konto anlegen. Alle
        anderen Angaben, auch die E-Mail-Adresse und alles im Lebenslauf, sind freiwillig.
      </p>

      <h2 style={h2}>Reichweitenmessung (Umami)</h2>
      <p style={p}>
        {/* Vorlage: Abschnitt streichen, wenn keine Reichweitenmessung betrieben wird
            (CV-Hub liefert keine mit). */}
        Wir zählen Seitenaufrufe und einige Klicks (etwa „Demo gestartet", „PDF exportiert") mit
        <strong> Umami</strong>, das wir selbst unter <code style={code}>analytics.example.com</code> in
        [Land] betreiben. Umami setzt keine Cookies und legt keine personenbezogenen Profile an.
        Erfasst werden aufgerufene Adresse, verweisende Seite, Browser, Betriebssystem, Gerätetyp,
        Bildschirmgröße, Sprache und das Land. Aus IP-Adresse und Browserkennung bildet Umami eine
        Kennung, die sich monatlich ändert; die IP-Adresse selbst wird nicht gespeichert. Was in
        deinem Lebenslauf steht, wird nie erfasst. Rechtsgrundlage: berechtigtes Interesse daran zu
        wissen, welche Teile des Werkzeugs genutzt werden (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO).
      </p>

      <h2 style={h2}>PDF-Erzeugung</h2>
      <p style={p}>
        PDFs erzeugt unser Server mit einem Chromium-Browser ohne Bildschirm (Playwright). Das
        Dokument kommt samt eingebettetem Foto aus deinem Browser, wird im Arbeitsspeicher gesetzt,
        als PDF zurückgeschickt und nicht gespeichert, weder mit noch ohne Konto.
      </p>

      <h2 style={h2}>HTML-Export, KI-Brücke und MCP</h2>
      <p style={p}>
        Eine exportierte HTML-Datei enthält Schriften und Foto selbst. Wer sie öffnet, ruft dabei
        keinen Server auf, auch nicht unseren. Nutzt du die KI-Brücke („In ChatGPT öffnen") oder den
        optionalen <strong>MCP-Server</strong>, gibst du Inhalte bewusst an das KI-Programm deiner Wahl weiter;
        ab dort gelten dessen Datenschutzbestimmungen. Wir binden selbst keinen KI-Anbieter ein.
      </p>

      <h2 style={h2}>Empfänger und Auftragsverarbeiter</h2>
      <p style={p}>
        Server, Datenbank und Sicherungen betreibt für uns <strong>[Hosting-Provider]</strong>,
        [Anschrift], in Rechenzentren in [Land], als
        Auftragsverarbeiter nach Art.&nbsp;28 DSGVO. Transaktionale E-Mails (Einladung, Willkommen,
        Passwort-Reset, Zwei-Faktor-Code, Konto-Deaktivierung und -Löschung) verschicken wir über
        <strong> [Mail-Provider]</strong>, mit Servern in [Land], ebenfalls als
        Auftragsverarbeiter. Wir schicken nur an die Adresse, die du hinterlegt hast, und nur
        funktionale Nachrichten, keine Werbung. Darüber hinaus geben wir keine Daten weiter und
        übermitteln nichts in Drittländer, außer an KI-Anbieter, die du selbst auswählst.
      </p>

      <h2 style={h2}>Zwei-Faktor-Login (optional)</h2>
      <p style={p}>
        Aktivierst du den Zwei-Faktor-Login, schicken wir bei jeder Anmeldung einen sechsstelligen
        Einmalcode an deine E-Mail-Adresse. Wir speichern ihn nur als Hash; er gilt zehn Minuten.
      </p>

      <h2 style={h2}>Wie lange Daten bleiben</h2>
      <ul style={list}>
        <li>Konto, Lebensläufe, Versionen und Fotos: bis du sie löschst. Löschst du dein Konto, ist alles sofort aus der Datenbank entfernt, einschließlich deiner Zugangsanfrage.</li>
        <li>Fotos ohne Verwendung: 24 Stunden.</li>
        <li>Aufrufe von Sharelinks: 90 Tage.</li>
        <li>Abgelehnte Zugangsanfragen: 30 Tage nach der Entscheidung.</li>
        <li>Proxy-Protokolle: höchstens 14 Tage. Rate-Limit-Zähler: höchstens 60 Minuten, nur im Arbeitsspeicher.</li>
        <li>Sicherungen der Datenbank: 14 Tage, danach unwiderruflich gelöscht. Gelöschtes verschwindet aus den Sicherungen also spätestens nach 14 Tagen.</li>
        <li>Inaktive Konten löschen wir auf Anfrage; eine automatische Löschung gibt es derzeit nicht.</li>
      </ul>

      <h2 style={h2}>Deine Rechte</h2>
      <p style={p}>
        Du hast das Recht auf Auskunft (Art.&nbsp;15), Berichtigung (Art.&nbsp;16), Löschung (Art.&nbsp;17),
        Einschränkung der Verarbeitung (Art.&nbsp;18) und Datenübertragbarkeit (Art.&nbsp;20 DSGVO). Eine
        Einwilligung kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art.&nbsp;7 Abs.&nbsp;3).
        Im Konto-Menü gibt es einen <strong>Datenexport</strong> (alles als JSON, mit Fotos) und
        <strong> Konto löschen</strong>. Für alles andere reicht eine E-Mail an{' '}
        <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>

      <div style={box}>
        <h2 style={{ ...h2, marginTop: 0 }}>Dein Widerspruchsrecht (Art. 21 DSGVO)</h2>
        <p style={{ ...p, margin: 0 }}>
          Soweit wir Daten auf Grundlage berechtigter Interessen verarbeiten (Art.&nbsp;6 Abs.&nbsp;1
          lit.&nbsp;f DSGVO: Proxy-Protokolle, Rate-Limit, Reichweitenmessung, Daten Dritter), kannst du
          dieser Verarbeitung jederzeit aus Gründen widersprechen, die sich aus deiner besonderen
          Situation ergeben. Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können
          zwingende schutzwürdige Gründe nachweisen, die deine Interessen überwiegen, oder die
          Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen.
          Der Widerspruch ist formlos möglich, am einfachsten per E-Mail an{' '}
          <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        </p>
      </div>

      <h2 style={h2}>Beschwerde</h2>
      <p style={p}>
        Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren. Zuständig für uns ist
        [zuständige Aufsichtsbehörde].
      </p>
    </>
  );
}

function PrivacyEN() {
  return (
    <>
      <h1 style={h1}>Privacy policy</h1>
      <div style={sub}>{STAND_EN}</div>

      <p style={p}>
        This page explains which data is processed when you use cv.example.com, for what
        purpose, on which legal basis, how long it is kept and who sees it. You can use the tool in
        two ways: without an account (your data stays in your browser) or with an invite-only
        account (your data is stored on our server).
      </p>

      <h2 style={h2}>Controller</h2>
      <p style={p}>
        [Operator Name], [Street Address], [Postal Code, City], [Country],{' '}
        <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
        There is no data protection officer; one is not required for a service of this size.
      </p>

      <h2 style={h2}>When you open the site</h2>
      <p style={p}>
        Every request passes through a reverse proxy ([reverse proxy]). For technical reasons it
        logs IP address, time, requested address, status code and browser identifier. We need these
        logs to find errors and fend off attacks, and read them only for that. They are rotated
        automatically and deleted after 14 days at most. Legal basis: legitimate interest in secure
        operation (Art. 6(1)(f) GDPR).
      </p>
      <p style={p}>
        To limit sign-in attempts, registrations and PDF exports, the server keeps the IP address
        together with a counter in memory for 15 to 60 minutes, depending on the function. It is
        never written to disk and is gone after a restart. Legal basis: Art. 6(1)(f) GDPR
        (protection against abuse).
      </p>

      <h2 style={h2}>Without an account (demo)</h2>
      <p style={p}>
        Without an account, your résumés, cover letters and any photo you upload live only in your
        browser's storage (localStorage). We store none of it on the server. Clearing the site data
        in your browser deletes the résumés too, and Safari does so on its own after a while without
        a visit, so keep a copy via the JSON export. Markdown import, LinkedIn import, Word, HTML,
        Markdown and JSON all run entirely in the browser.
      </p>
      <p style={p}>
        The exception is the <strong>PDF export</strong>: to create the PDF, the content of the document,
        including the photo, is sent once to our server in [country], processed in memory and not
        stored. The server only records that a PDF was created, without content and without any link
        to you. Legal basis: Art. 6(1)(b) GDPR (you request the PDF).
      </p>
      <p style={p}>
        Your browser re-encodes photos before storing them, which drops embedded metadata such as
        GPS position, capture time and camera model.
      </p>

      <h2 style={h2}>With an account</h2>
      <p style={p}>
        Accounts are currently invite-only. For an account we store <strong>username, password hash</strong>{' '}
        (bcrypt), the <strong>times</strong> of creation and last sign-in and, if you provide one, an{' '}
        <strong>e-mail address</strong>. Your résumés and cover letters are stored as records in our
        database, together with up to 25 earlier states per résumé (versions) and uploaded{' '}
        <strong>photos</strong>. A photo that no longer appears in any résumé or active share link is deleted
        after 24 hours. For some events (such as sign-in, PDF export, import) we record the type and
        time, without content. Legal basis for all of this: Art. 6(1)(b) GDPR (contract of use).
      </p>
      <p style={p}>
        If you create a <strong>share link</strong>, we store the token with its expiry date and, for each
        visit, the time and browser family (e.g. "Chrome/Mac"), without IP address. Visits are deleted
        after 90 days. If you connect an AI program via <strong>MCP</strong> or create an API key, we store
        keys and tokens as hashes.
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
        contract). Rejected requests are deleted 30 days after the decision, accepted ones together
        with your account.
      </p>

      <h2 style={h2}>Special categories in a résumé</h2>
      <p style={p}>
        People sometimes put details into a résumé that reveal health (such as a severe disability),
        religion, trade union membership or political office; a photo can show such things too. These
        are special categories under Art. 9 GDPR and are rarely needed in a German résumé. If you enter
        them in an account, we process them only to store and typeset your document. The legal basis is
        your explicit consent (Art. 9(2)(a) GDPR), which you can withdraw at any time with effect for the
        future, most simply by deleting the details.
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
        You are under no legal or contractual obligation to give us any data. For an account we need a
        username, a password and an invite code; without them we cannot create one. Everything else,
        including the e-mail address and everything in the résumé, is voluntary.
      </p>

      <h2 style={h2}>Audience measurement (Umami)</h2>
      <p style={p}>
        {/* Template: remove this section if you run no audience measurement
            (CV-Hub ships without one). */}
        We count page views and a few clicks (such as "demo started", "PDF exported") with{' '}
        <strong>Umami</strong>, which we run ourselves at <code style={code}>analytics.example.com</code> in
        [country]. Umami sets no cookies and builds no personal profiles. It records the requested address,
        referring page, browser, operating system, device type, screen size, language and country. From
        IP address and browser identifier Umami derives an identifier that changes every month; the IP
        address itself is not stored. The content of your résumé is never recorded. Legal basis:
        legitimate interest in knowing which parts of the tool are used (Art. 6(1)(f) GDPR).
      </p>

      <h2 style={h2}>PDF rendering</h2>
      <p style={p}>
        Our server creates PDFs with a headless Chromium browser (Playwright). The document arrives from
        your browser with the photo embedded, is typeset in memory, returned as a PDF and not stored,
        with or without an account.
      </p>

      <h2 style={h2}>HTML export, AI bridge and MCP</h2>
      <p style={p}>
        An exported HTML file carries its own fonts and photo. Opening it contacts no server, ours
        included. If you use the AI bridge ("Open in ChatGPT") or the optional <strong>MCP server</strong>, you
        deliberately hand content to the AI program of your choice; from then on its privacy terms
        apply. We do not integrate any AI provider ourselves.
      </p>

      <h2 style={h2}>Recipients and processors</h2>
      <p style={p}>
        Servers, database and backups are run for us by <strong>[hosting provider]</strong>, [address],
        in data centres in [country], as a processor under Art. 28 GDPR.
        Transactional e-mail (invitation, welcome, password reset, two-factor code, account deactivation
        and deletion) is sent via <strong>[mail provider]</strong>, with servers in
        [country], also as a processor. We only send to the address you stored, and only functional
        messages, never advertising. Beyond that we pass on no data and transfer nothing to third
        countries, except to AI providers you choose yourself.
      </p>

      <h2 style={h2}>Two-factor login (optional)</h2>
      <p style={p}>
        If you enable two-factor login, we send a six-digit one-time code to your e-mail address on
        every sign-in. We store it only as a hash; it is valid for ten minutes.
      </p>

      <h2 style={h2}>How long data is kept</h2>
      <ul style={list}>
        <li>Account, résumés, versions and photos: until you delete them. If you delete your account, everything is removed from the database at once, including your access request.</li>
        <li>Unused photos: 24 hours.</li>
        <li>Share link visits: 90 days.</li>
        <li>Rejected access requests: 30 days after the decision.</li>
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
          limiting, audience measurement, other people's data), you may object to this processing at any
          time on grounds relating to your particular situation. We will then stop processing the data
          unless we can demonstrate compelling legitimate grounds that override your interests, or the
          processing serves the establishment, exercise or defence of legal claims. No particular form is
          required; an e-mail to{' '}
          <a style={a} href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> is easiest.
        </p>
      </div>

      <h2 style={h2}>Complaints</h2>
      <p style={p}>
        You can lodge a complaint with a data protection supervisory authority. The authority responsible
        for us is [your competent supervisory authority].
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
