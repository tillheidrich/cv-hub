import type { UiLang } from '../ui/i18n';

/**
 * Statische Rechtspages (Impressum, Datenschutz). Werden vom LandingFooter und
 * vom Editor-Footer aufgerufen; Routing ist state-basiert (kein Router).
 *
 * Inhalte sind bewusst kurz und faktisch. Bei Änderungen am Stack (neue
 * Backend-Endpoints, neue Verarbeiter, neue Tracking-Tools) MUSS die
 * Datenschutz-Sektion mitlaufen.
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

export function ImpressumPage({ onBack }: { onBack: () => void; lang?: UiLang }) {
  return (
    <div style={{ minHeight: '100dvh', background: PAPER }}>
      <BackBar onBack={onBack} />
      <div style={wrap}>
        <h1 style={h1}>Impressum</h1>
        <div style={sub}>Angaben gemäß § 5 DDG</div>

        <p style={p}>
          <strong>[Operator Name]</strong><br />
          [Street Address]<br />
          [Postal Code, City]<br />
          Deutschland
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
          Anwendung steht unter AGPL-3.0-Lizenz auf{' '}
          <a style={a} href="https://git.example.com/your-org/cv-hub" target="_blank" rel="noopener noreferrer">git.example.com</a>.
        </p>
      </div>
    </div>
  );
}

export function PrivacyPage({ onBack }: { onBack: () => void; lang?: UiLang }) {
  return (
    <div style={{ minHeight: '100dvh', background: PAPER }}>
      <BackBar onBack={onBack} />
      <div style={wrap}>
        <h1 style={h1}>Datenschutzerklärung</h1>
        <div style={sub}>Stand 27. Juli 2026 · gilt für cv.example.com</div>

        <p style={p}>
          Wir nehmen Datenschutz ernst und behandeln deine Daten so, wie wir es
          selbst erwarten würden. Diese Seite erklärt, welche Daten beim Nutzen
          des Tools anfallen, wer Zugriff hat und wie du sie wieder los wirst.
        </p>

        <h2 style={h2}>Verantwortlich</h2>
        <p style={p}>
          [Operator Name], [Street Address], [Postal Code, City],{' '}
          <a style={a} href="mailto:your-email@example.com">your-email@example.com</a>.
          Volle Anschrift siehe <a style={a} href="https://example.com" target="_blank" rel="noopener noreferrer">example.com</a>.
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
          Mail-Dienst unseres Providers <strong>ALL-INKL.COM (Neue Medien Münnich)</strong>,
          dessen Server in Deutschland stehen. All-inkl verarbeitet dabei die Empfänger-Adresse
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
          Alle Server stehen in Deutschland (Hetzner, Falkenstein; E-Mail via all-inkl,
          Deutschland). Es findet keine Datenübermittlung in Drittländer statt — abgesehen von
          Google Fonts (nur beim lokalen Öffnen eines HTML-Exports) und den KI-Anbietern, falls
          du die Markdown-Bridge oder den MCP-Server nutzt.
        </p>

        <h2 style={h2}>Beschwerde</h2>
        <p style={p}>
          Du hast das Recht, dich bei der für dich zuständigen Datenschutz-Aufsichtsbehörde zu beschweren.
        </p>

        <h2 style={h2}>Kontakt</h2>
        <p style={p}>
          Fragen oder Auskunftswünsche: <a style={a} href="mailto:your-email@example.com">your-email@example.com</a>.
        </p>
      </div>
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
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
        aria-label="Zurück"
        style={{
          background: 'transparent', border: 'none',
          fontFamily: MONO,
          fontSize: '12px', color: SOFT,
          cursor: 'pointer', padding: '4px 6px',
          letterSpacing: '0.04em',
        }}
      >
        ← Zurück
      </button>
    </div>
  );
}
