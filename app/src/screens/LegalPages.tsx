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
const warn: React.CSSProperties = {
  margin: '0 0 32px', padding: '14px 16px',
  border: `1px solid ${ACCENT}`, borderRadius: '8px',
  background: 'oklch(0.97 0.02 264)',
  color: INK, fontSize: '14px', lineHeight: 1.55,
};

const note: React.CSSProperties = {
  margin: '40px 0 0', paddingTop: '18px', borderTop: `1px solid ${LINE}`,
  color: FAINT, fontSize: '13px',
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
        E-Mail: <a style={a} href="mailto:your-email@example.com">your-email@example.com</a><br />
        Web: <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>
      </p>

      <h2 style={h2}>Verantwortlich für den Inhalt</h2>
      <p style={p}>
        [Operator Name], Anschrift wie oben. Weitere Angaben (USt-IdNr., berufsrechtliche Regelungen,
        Aufsichtsbehörden) finden sich auf{' '}
        <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>.
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
        E-mail: <a style={a} href="mailto:your-email@example.com">your-email@example.com</a><br />
        Web: <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>
      </p>

      <h2 style={h2}>Responsible for the content</h2>
      <p style={p}>
        [Operator Name], address as above. Further details (VAT ID, professional regulations,
        supervisory authorities) are listed on{' '}
        <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>.
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

function PrivacyDE() {
  return (
    <>
      <h1 style={h1}>Datenschutzerklärung</h1>
      <div style={sub}>{STAND_DE}</div>

      <p style={p}>
        Wir nehmen Datenschutz ernst und behandeln deine Daten so, wie wir es
        selbst erwarten würden. Diese Seite erklärt, welche Daten beim Nutzen
        des Tools anfallen, wer Zugriff hat und wie du sie wieder los wirst.
      </p>

      <h2 style={h2}>Verantwortlich</h2>
      <p style={p}>
        [Operator Name], [Street Address], [Postal Code, City], [Country],{' '}
        <a style={a} href="mailto:your-email@example.com">your-email@example.com</a>.
        Weitere Angaben siehe <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>.
      </p>

      <h2 style={h2}>Welche Daten erhoben werden</h2>
      <p style={p}>
        Wenn du ein Konto anlegst, speichern wir <strong>Nutzername, gehashtes Passwort</strong>{' '}
        (bcrypt), <strong>Erstell- und Login-Zeitpunkt</strong> sowie — <strong>optional</strong> —
        eine <strong>E-Mail-Adresse</strong>, falls du sie hinterlegst. Die E-Mail ist freiwillig
        und wird nur für Passwort-Reset, Kontobenachrichtigungen und den optionalen
        Zwei-Faktor-Login verwendet. Sobald du Lebensläufe oder Anschreiben anlegst, liegen diese
        als JSON in unserer Postgres-Datenbank. Hochgeladene <strong>Profilfotos</strong> werden als
        BYTEA in derselben Datenbank gespeichert. Erstellst du einen <strong>öffentlichen Sharelink</strong>,
        wird ein Token mit Ablaufdatum sowie pro Zugriff ein anonymer Eintrag zur Browser- und
        Betriebssystem-Familie (z.&nbsp;B. „Chrome/Mac") gespeichert — <strong>ohne IP-Adresse</strong>.
      </p>

      <h2 style={h2}>E-Mail-Versand (Auftragsverarbeiter)</h2>
      <p style={p}>
        Für transaktionale E-Mails — <strong>Einladung, Willkommen, Passwort-Reset,
        Zwei-Faktor-Code sowie Konto-Deaktivierung/-Löschung</strong> — nutzen wir den
        Mail-Dienst unseres Providers <strong>[Mail-Provider]</strong>,
        dessen Server in [Land] stehen. Der Provider verarbeitet dabei die Empfänger-Adresse
        als <strong>Auftragsverarbeiter</strong> gemäß Art.&nbsp;28 DSGVO. Wir versenden ausschließlich
        an die von dir hinterlegte Adresse und ausschließlich funktionale Nachrichten —
        <strong> keine Newsletter, keine Werbung</strong>. Hast du keine E-Mail hinterlegt,
        findet kein Mailversand statt.
      </p>

      <h2 style={h2}>Zwei-Faktor-Login (optional)</h2>
      <p style={p}>
        Aktivierst du den Zwei-Faktor-Login, senden wir bei jeder Anmeldung einen
        sechsstelligen Einmalcode an deine hinterlegte E-Mail. Der Code wird bei uns nur als
        Hash gespeichert, ist zehn Minuten gültig und danach ungültig. Die Funktion ist
        freiwillig und jederzeit in den Einstellungen abschaltbar.
      </p>

      <h2 style={h2}>Demo-Modus ohne Konto</h2>
      <p style={p}>
        Im Demo-Modus speichern wir nichts auf dem Server. Deine Daten leben ausschließlich
        im localStorage deines Browsers. Cache löschen = Daten weg.
      </p>

      <h2 style={h2}>Cookies + Session</h2>
      <p style={p}>
        Bei aktivem Login setzen wir ein <code style={code}>cv_session</code>-Cookie (httpOnly, secure,
        sameSite=lax), das einen signierten JWT-Token enthält. Es ist technisch notwendig für die
        Anmeldung und enthält keine personenbezogenen Daten außer einer User-ID-Referenz. Ohne
        Login wird das Cookie nicht gesetzt. Ein Cookie-Banner ist nicht erforderlich, da wir
        keine Tracking- oder Marketing-Cookies setzen.
      </p>

      <h2 style={h2}>Analytics (Umami, self-hosted)</h2>
      <p style={p}>
        Wir nutzen <strong>Umami Analytics</strong>, selbst gehostet auf{' '}
        <code style={code}>analytics.example.com</code>. Umami arbeitet ohne Cookies, ohne
        Fingerprinting und ohne IP-Adressen-Speicherung. Wir sehen nur, wie viele Personen
        eine Seite aufrufen und welche Browsergruppe sie nutzen — keine individuelle
        Nachverfolgung. Rechtsgrundlage: berechtigtes Interesse (Art.&nbsp;6 Abs.&nbsp;1 lit.&nbsp;f DSGVO).
      </p>

      <h2 style={h2}>PDF-Rendering</h2>
      <p style={p}>
        PDFs werden auf unserem Server mit Headless-Chrome (Playwright) gerendert. Der
        generierte PDF-Inhalt bleibt im Server-Memory und wird direkt an dich zurückgegeben
        — keine Zwischenspeicherung auf Disk.
      </p>

      <h2 style={h2}>Schriften, KI-Bridge & MCP</h2>
      <p style={p}>
        Alle Schriften werden self-hosted von unserem eigenen Server ausgeliefert — es
        werden <strong>keine</strong> Google-Fonts-Server (<code style={code}>fonts.googleapis.com</code>,{' '}
        <code style={code}>fonts.gstatic.com</code>) kontaktiert, deine IP-Adresse wird also nicht an
        Google übermittelt. Nur wenn du einen Lebenslauf als eigenständige HTML-Datei
        exportierst und lokal öffnest, lädt diese Datei ihre Schriften von Google — das
        passiert außerhalb dieser Seite. Nutzt du die KI-Bridge („In ChatGPT öffnen") oder den
        optionalen <strong>MCP-Server</strong>, gibst du Inhalte bewusst an das von dir gewählte
        KI-Modell weiter; ab dort gelten dessen Datenschutzbestimmungen. Wir binden selbst
        keinen KI-Anbieter ein.
      </p>

      <h2 style={h2}>Deine Rechte</h2>
      <p style={p}>
        Du hast Anspruch auf Auskunft, Berichtigung, Löschung, Einschränkung der
        Verarbeitung, Datenübertragbarkeit und Widerspruch gemäß DSGVO. Im
        Konto-Menü findest du einen <strong>„Datenexport"</strong>-Button (kompletter
        JSON-Dump inklusive aller Fotos) und einen <strong>„Konto löschen"</strong>-Button
        (kaskadierte Löschung). Beides ist 1-Klick — keine E-Mail-Anfrage nötig.
      </p>

      <h2 style={h2}>Backups</h2>
      <p style={p}>
        Wir machen nächtliche Backups der Postgres-Datenbank. Diese werden 14 Tage
        aufbewahrt und dann unwiderruflich gelöscht. Wenn du dein Konto löschst, sind die
        Daten aus aktivem Storage sofort weg und aus den letzten Backups maximal 14 Tage
        später.
      </p>

      <h2 style={h2}>Server-Standort</h2>
      <p style={p}>
        Alle Server stehen in [Land] ([Hosting-Provider, Standort]; E-Mail via
        [Mail-Provider], [Land]). Es findet keine Datenübermittlung in Drittländer statt — abgesehen von
        Google Fonts (nur beim lokalen Öffnen eines HTML-Exports) und den KI-Anbietern, falls
        du die Markdown-Bridge oder den MCP-Server nutzt.
      </p>

      <h2 style={h2}>Beschwerde</h2>
      <p style={p}>
        Du hast das Recht, dich bei einer Aufsichtsbehörde zu beschweren. Zuständig ist die
        Datenschutzbehörde deines Bundeslandes bzw. Landes — [zuständige Aufsichtsbehörde].
      </p>

      <h2 style={h2}>Kontakt</h2>
      <p style={p}>
        Fragen oder Auskunftswünsche: <a style={a} href="mailto:your-email@example.com">your-email@example.com</a>.
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
        We take privacy seriously and handle your data the way we would want ours handled.
        This page explains what data is created when you use the tool, who can access it and
        how you can get rid of it again.
      </p>

      <h2 style={h2}>Controller</h2>
      <p style={p}>
        [Operator Name], [Street Address], [Postal Code, City], [Country],{' '}
        <a style={a} href="mailto:your-email@example.com">your-email@example.com</a>.
        Further details at <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>.
      </p>

      <h2 style={h2}>What data is collected</h2>
      <p style={p}>
        When you create an account we store your <strong>username, hashed password</strong>{' '}
        (bcrypt), <strong>creation and last-login timestamps</strong> and — <strong>optionally</strong> —
        an <strong>e-mail address</strong> if you provide one. The e-mail is voluntary and used only
        for password resets, account notifications and the optional two-factor login. Once you
        create CVs or cover letters, they are stored as JSON in our Postgres database. Uploaded{' '}
        <strong>profile photos</strong> are stored as BYTEA in the same database. If you create a{' '}
        <strong>public share link</strong>, we store a token with an expiry date and, per visit, an
        anonymous record of the browser and operating-system family (e.g. “Chrome/Mac”) —{' '}
        <strong>without any IP address</strong>.
      </p>

      <h2 style={h2}>E-mail delivery (processor)</h2>
      <p style={p}>
        For transactional e-mail — <strong>invitation, welcome, password reset, two-factor code
        and account deactivation/deletion</strong> — we use the mail service of our provider{' '}
        <strong>[mail provider]</strong>, whose servers are located in [country].
        The provider processes the recipient address as a <strong>processor</strong> under Art. 28 GDPR.
        We only ever send to the address you stored, and only functional messages —{' '}
        <strong>no newsletters, no advertising</strong>. If you have not stored an e-mail address,
        no mail is sent at all.
      </p>

      <h2 style={h2}>Two-factor login (optional)</h2>
      <p style={p}>
        If you enable two-factor login, we send a six-digit one-time code to your stored e-mail
        address on every sign-in. We store the code only as a hash; it is valid for ten minutes
        and useless afterwards. The feature is voluntary and can be switched off in the settings
        at any time.
      </p>

      <h2 style={h2}>Demo mode without an account</h2>
      <p style={p}>
        In demo mode nothing is stored on the server. Your data lives exclusively in your
        browser's localStorage. Clear the cache and it is gone.
      </p>

      <h2 style={h2}>Cookies + session</h2>
      <p style={p}>
        While you are signed in we set a <code style={code}>cv_session</code> cookie (httpOnly, secure,
        sameSite=lax) containing a signed JWT. It is technically necessary for authentication and
        contains no personal data beyond a user-ID reference. Without a login the cookie is not
        set. No cookie banner is required because we set no tracking or marketing cookies.
      </p>

      <h2 style={h2}>Analytics (Umami, self-hosted)</h2>
      <p style={p}>
        We use <strong>Umami Analytics</strong>, self-hosted on{' '}
        <code style={code}>analytics.example.com</code>. Umami works without cookies, without
        fingerprinting and without storing IP addresses. We only see how many people open a page
        and which browser family they use — no individual tracking. Legal basis: legitimate
        interest (Art. 6(1)(f) GDPR).
      </p>

      <h2 style={h2}>PDF rendering</h2>
      <p style={p}>
        PDFs are rendered on our own server using headless Chrome (Playwright). The generated PDF
        stays in server memory and is returned directly to you — nothing is written to disk.
      </p>

      <h2 style={h2}>Fonts, AI bridge & MCP</h2>
      <p style={p}>
        All fonts are self-hosted and delivered from our own server — <strong>no</strong>{' '}
        Google Fonts servers (<code style={code}>fonts.googleapis.com</code>,{' '}
        <code style={code}>fonts.gstatic.com</code>) are contacted, so your IP address is never passed
        to Google. Only if you export a CV as a standalone HTML file and open it locally does that
        file load its fonts from Google — which happens outside this site. If you use the AI bridge
        (“Open in ChatGPT”) or the optional <strong>MCP server</strong>, you deliberately hand
        content to the AI model of your choice; from that point its privacy terms apply. We do not
        integrate any AI provider ourselves.
      </p>

      <h2 style={h2}>Your rights</h2>
      <p style={p}>
        You have the right to access, rectification, erasure, restriction of processing, data
        portability and objection under the GDPR. The account menu contains a{' '}
        <strong>“Data export”</strong> button (a complete JSON dump including all photos) and a{' '}
        <strong>“Delete account”</strong> button (cascading deletion). Both are one click — no
        e-mail request needed.
      </p>

      <h2 style={h2}>Backups</h2>
      <p style={p}>
        We take nightly backups of the Postgres database. They are kept for 14 days and then
        irreversibly deleted. If you delete your account, the data is gone from active storage
        immediately and from the most recent backups at most 14 days later.
      </p>

      <h2 style={h2}>Server location</h2>
      <p style={p}>
        All servers are located in [country] ([hosting provider, location]; e-mail via
        [mail provider], [country]).
        No data is transferred to third countries — except to Google Fonts (only when you open an
        HTML export locally) and to the AI providers, if you use the Markdown bridge or the MCP
        server.
      </p>

      <h2 style={h2}>Complaints</h2>
      <p style={p}>
        You have the right to lodge a complaint with a supervisory authority — [your competent
        supervisory authority].
      </p>

      <h2 style={h2}>Contact</h2>
      <p style={p}>
        Questions or access requests: <a style={a} href="mailto:your-email@example.com">your-email@example.com</a>.
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
