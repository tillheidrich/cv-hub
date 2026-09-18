import { useState } from 'react';
import { Icon, type IconName } from '../ui/Icon';

const UI_FONT = "'Inter', sans-serif";
const SERIF_FONT = "'Space Grotesk', serif";
const GOLD = 'oklch(0.55 0.216 264)';
const GOLD_LIGHT = 'rgba(139,115,85,0.12)';

// ── Data ────────────────────────────────────────────────────────────────────

interface Card {
  id: string;
  title: string;
  body?: string;       // info-only card (no copy button)
  prompt?: string;     // copyable prompt template
  tags?: string[];
}

interface Category {
  id: string;
  label: string;
  icon: IconName;
  cards: Card[];
}

const CATEGORIES: Category[] = [
  // ── 1. Strategie & Mindset ────────────────────────────────────────────────
  {
    id: 'strategy',
    label: 'Strategie',
    icon: 'compass' as const,
    cards: [
      {
        id: 'authentic-signals',
        title: 'Authentizität schlägt Masse',
        body: `KI-generierte Bewerbungen sind "cheap signals" — Recruiter lernen sie schnell zu ignorieren, weil sie für jedermann kostenlos produzierbar sind.

Was zählt, sind "costly signals": Belege, die schwer zu fälschen sind. Ehrenamtliche Führungsverantwortung, Leistungssport, internationale Projekterfahrung, konkrete Zahlen, ungewöhnliche Projekte.

Fazit: Nutze KI als Werkzeug, nicht als Ghostwriter. Die Substanz muss echt sein.`,
        tags: ['Strategie', 'Signaltheorie'],
      },
      {
        id: 'weiteres',
        title: 'Der unterschätzte "Weiteres"-Abschnitt',
        body: `Der Abschnitt für zusätzliche Erfahrungen (Ehrenamt, Sport, Sprachen, Projekte) ist einer der wirksamsten Differenziatoren — weil die meisten Bewerber ihn stiefmütterlich behandeln.

Recruiter suchen nach Persönlichkeit jenseits der Jobtitel. Ein Marathonlauf, eine Vorstandsrolle im Verein, ein Open-Source-Projekt oder eine Sprache, die niemand erwartet: Das bleibt hängen.

Empfehlung: Mindestens 3–5 konkrete Punkte. Aktiv formulieren, nicht nur auflisten.`,
        tags: ['Strategie', 'Tipps'],
      },
      {
        id: 'ats',
        title: 'ATS: Der erste Leser ist kein Mensch',
        body: `Viele Unternehmen setzen Applicant Tracking Systems ein, die Lebensläufe nach Keywords filtern. Wer die falschen Begriffe verwendet, kommt nicht mal in die engere Auswahl.

Lösung: Relevante Schlüsselwörter aus der Stellenausschreibung gezielt in Bullet Points integrieren — in der gleichen Sprache und Formulierung wie die Ausschreibung. Ohne zu lügen.

Tool-Tipp: Einfach die Stellenausschreibung und den eigenen Lebenslauf nebeneinander in Claude laden und nach fehlenden Keywords fragen.`,
        tags: ['ATS', 'Keywords'],
      },
      {
        id: 'bullet-impact',
        title: 'Tätigkeiten vs. Wirkung',
        body: `Der häufigste Fehler in Lebensläufen: Bullet Points beschreiben, was jemand getan hat — nicht, was dadurch erreicht wurde.

Statt: "Verantwortlich für die Betreuung von Kundenprojekten"
Besser: "Betreute 12 Enterprise-Accounts (∑ 2,4 Mio. € ARR), Churn unter 3% gehalten"

Formel: Verb + Kontext + messbares Ergebnis. Wenn keine Zahlen verfügbar: Größenordnung oder qualitativer Impact.`,
        tags: ['Strategie', 'Tipps'],
      },
    ],
  },

  // ── 2. Lebenslauf-Prompts ─────────────────────────────────────────────────
  {
    id: 'cv',
    label: 'Lebenslauf',
    icon: 'file-text' as const,
    cards: [
      {
        id: 'jd-keywords',
        title: 'Stellenausschreibung analysieren & Keywords extrahieren',
        prompt: `Hier ist eine Stellenausschreibung, auf die ich mich bewerben möchte:

[STELLENAUSSCHREIBUNG EINFÜGEN]

1. Identifiziere die 10 wichtigsten Fähigkeiten und Keywords, nach denen der Recruiter tatsächlich sucht.
2. Welche davon sind "Must-have", welche "Nice-to-have"?
3. Schreibe meine folgenden Bullet Points so um, dass sie besser passen — ohne dass ich über meine Erfahrung lüge:

[MEINE BULLET POINTS EINFÜGEN]`,
        tags: ['CV', 'Keywords', 'ATS'],
      },
      {
        id: 'bullets-strengthen',
        title: 'Bullet Points stärker formulieren',
        prompt: `Verbessere diese Lebenslauf-Bullet-Points. Mache sie wirkungsvoller durch:
- Konkrete Zahlen und messbare Ergebnisse wo möglich
- Starke Verben am Anfang (kein "war verantwortlich für")
- Fokus auf Impact, nicht auf Tätigkeiten
- Max. 1–2 Zeilen pro Bullet

Stelle / Unternehmen: [EINFÜGEN]

Meine aktuellen Bullet Points:
[BULLET POINTS EINFÜGEN]`,
        tags: ['CV', 'Bullet Points'],
      },
      {
        id: 'profile-text',
        title: 'Profil-Text schreiben',
        prompt: `Schreibe einen 3–4 Satz langen Profil-Text für meinen Lebenslauf. Ich bewerbe mich als [ZIELROLLE] bei [UNTERNEHMEN / BRANCHE].

Mein Hintergrund: [KURZE BESCHREIBUNG: Erfahrungsjahre, Kernkompetenzen, was mich besonders macht]

Der Text soll präzise, selbstbewusst und nicht generisch klingen. Keine Allgemeinplätze wie "lösungsorientiert", "teamfähig" oder "kommunikationsstark" — nur wenn mit konkretem Beleg.`,
        tags: ['CV', 'Profil'],
      },
      {
        id: 'keywords-gap',
        title: 'Keyword-Gap finden',
        prompt: `Vergleiche meine Stellenausschreibung mit meinem Lebenslauf:

Stellenausschreibung:
[EINFÜGEN]

Mein Lebenslauf (relevante Abschnitte):
[EINFÜGEN]

Beantworte:
1. Welche wichtigen Keywords aus der Ausschreibung fehlen in meinem Lebenslauf?
2. Wo könnte ich sie natürlich und glaubwürdig einbauen?
3. Welche Formulierungen der Ausschreibung sollte ich spiegeln?`,
        tags: ['CV', 'Keywords', 'ATS'],
      },
      {
        id: 'weiteres-prompts',
        title: '"Weiteres"-Abschnitt ausbauen',
        prompt: `Ich habe folgende Aktivitäten außerhalb meiner Haupttätigkeit:

[LISTE: Ehrenamt, Sport, Sprachen, Projekte, Hobbys, etc.]

Formuliere daraus 4–6 prägnante Bullet Points für den "Weiteres"-Abschnitt meines Lebenslaufs. Hervorheben, was auf Transferable Skills, Führung, Disziplin oder Engagement hinweist. Aktive Formulierungen, kein Aufzählen.`,
        tags: ['CV', 'Weiteres'],
      },
    ],
  },

  // ── 3. Anschreiben-Prompts ────────────────────────────────────────────────
  {
    id: 'cover-letter',
    label: 'Anschreiben',
    icon: 'mail' as const,
    cards: [
      {
        id: 'cl-write',
        title: 'Anschreiben schreiben',
        prompt: `Schreibe ein präzises, authentisch klingendes Anschreiben für folgende Stelle:

Unternehmen: [UNTERNEHMEN]
Stelle: [STELLE]
Ansprechperson: [FALLS BEKANNT, sonst weglassen]

Was mich an der Stelle / dem Unternehmen wirklich reizt: [EHRLICHE ANTWORT IN 1–2 SÄTZEN — das ist das Wichtigste]

Mein Hintergrund: [KURZBESCHREIBUNG: Erfahrung, Kernkompetenzen, relevante Erfolge]

Wichtig:
- Kein Standard-Einstieg ("Mit großem Interesse bewerbe ich mich...")
- Starte mit dem, was mich wirklich an dieser Stelle interessiert
- Kein KI-Tonfall, kein übertriebenes Lob des Unternehmens
- Max. 250 Wörter`,
        tags: ['Anschreiben'],
      },
      {
        id: 'cl-opener',
        title: '5 verschiedene Einstiegssätze',
        prompt: `Schreib mir 5 unterschiedliche Einstiegssätze für ein Anschreiben — keiner darf mit "Mit großem Interesse" oder "Hiermit bewerbe ich mich" anfangen.

Stelle: [STELLE]
Unternehmen: [UNTERNEHMEN]
Eine konkrete Sache, die mich wirklich interessiert: [ANTWORT]

Die 5 Einstiegssätze sollen sich im Ton unterscheiden: direkt, anekdotisch, als Frage, mit einer Zahl/Fakt, persönlich.`,
        tags: ['Anschreiben', 'Einstieg'],
      },
      {
        id: 'cl-review',
        title: 'Anschreiben kritisch prüfen',
        prompt: `Prüfe mein Anschreiben auf folgende Punkte und gib klares Feedback:

1. Klingt es authentisch oder generisch?
2. Gibt es KI-typische Formulierungen, die raus sollten? (Liste sie explizit)
3. Ist der Bezug zum Unternehmen konkret oder könnte er für jedes Unternehmen stehen?
4. Was ist der schwächste Satz — und wie würde ein besserer aussehen?
5. Gesamturteil: Was ist der stärkste und der schwächste Teil?

Mein Anschreiben:
[EINFÜGEN]`,
        tags: ['Anschreiben', 'Review'],
      },
      {
        id: 'cl-shorten',
        title: 'Anschreiben kürzen',
        prompt: `Kürze mein Anschreiben auf maximal 200 Wörter, ohne die Kernaussagen zu verlieren. Behalte:
- Den stärksten Einstieg
- Den wichtigsten Grund, warum ich für diese Stelle geeignet bin
- Den stärksten konkreten Beleg (Zahl, Projekt, Erfahrung)
- Eine klare Handlungsaufforderung am Ende

Mein Anschreiben:
[EINFÜGEN]`,
        tags: ['Anschreiben', 'Kürzen'],
      },
    ],
  },

  // ── 4. Job-Suche ──────────────────────────────────────────────────────────
  {
    id: 'job-search',
    label: 'Job-Suche',
    icon: 'search' as const,
    cards: [
      {
        id: 'hidden-markets',
        title: 'Versteckte Stellen finden',
        prompt: `Agiere als Recruitment-Experte. Ich bin [JOBTITEL] mit [X] Jahren Erfahrung in [BRANCHE].

Finde mir Unternehmen, die aktiv nach meinem Profil suchen, aber NICHT auf LinkedIn oder Indeed ausschreiben. Fokus auf:
- Wachsende Unternehmen
- Kürzlich finanzierte Startups / Scale-ups
- Unternehmen, die in neue Märkte expandieren

Für Deutschland / DACH-Region.`,
        tags: ['Job-Suche', 'Strategie'],
      },
      {
        id: 'unadvertised',
        title: 'Nicht ausgeschriebene Stellen pitchen',
        prompt: `Recherchiere [UNTERNEHMEN] und sag mir:
- Welche Abteilungen sind wahrscheinlich unterbesetzt oder wachsend — basierend auf aktuellen News, Funding-Runden, Produkt-Launches oder Leadership-Hires?
- Welche Rollen sollte ich proaktiv pitchen, auch wenn nichts ausgeschrieben ist?
- Wen sollte ich kontaktieren (Rolle / Titel)?`,
        tags: ['Job-Suche', 'Proaktiv'],
      },
      {
        id: 'cold-outreach',
        title: 'Cold Outreach — direkt & knapp',
        prompt: `Schreib mir eine Cold-Outreach-Nachricht an den Hiring Manager bei [UNTERNEHMEN] für eine [STELLE]-Position.

Sie soll nicht wie ein Anschreiben klingen. Sie soll klingen wie ein scharfer Profi, der Kontakt zu einem Kollegen aufnimmt.
- Unter 100 Wörter
- Ende mit einer konkreten, niedrigschwelligen Frage
- Kein "Ich wäre begeistert...", kein Schleimen`,
        tags: ['Outreach', 'Networking'],
      },
      {
        id: 'interview-prep',
        title: 'Interview-Vorbereitung in 20 Minuten',
        prompt: `Ich habe in [X] Tagen ein Interview bei [UNTERNEHMEN] für die Stelle [STELLE].

Gib mir:
1. Die 10 wahrscheinlichsten Fragen, die sie stellen werden
2. Die ideale Antwortstruktur für jede davon (kurz, nicht ausformuliert)
3. Zwei Fragen, die ich ihnen stellen sollte — die mich von jedem anderen Kandidaten abheben`,
        tags: ['Interview', 'Vorbereitung'],
      },
      {
        id: 'salary-negotiation',
        title: 'Gehaltsverhandlung vorbereiten',
        prompt: `Ich habe ein Angebot von [BETRAG] für [STELLE] bei [UNTERNEHMEN] erhalten.

Basierend auf aktuellen Marktgehältern für diese Position in [ORT / REGION]:
1. Werde ich unterbezahlt?
2. Was wäre ein realistisches Gegengebot?
3. Schreib mir ein Verhandlungsskript für das Gespräch — selbstbewusst, aber nicht schwierig oder undankbar wirkend.`,
        tags: ['Gehalt', 'Verhandlung'],
      },
      {
        id: 'linkedin-audit',
        title: 'LinkedIn-Profil für Recruiter optimieren',
        prompt: `Prüfe mein LinkedIn-Profil für eine [JOBTITEL]-Rolle in [BRANCHE].

Hier ist meine aktuelle Summary und Erfahrungssektion:
[EINFÜGEN]

Sag mir:
1. Was soll ich konkret ändern?
2. Welche Keywords soll ich hinzufügen?
3. Wie positioniere ich mich, damit Recruiter mich finden — statt dass ich sie jage?`,
        tags: ['LinkedIn', 'Profil'],
      },
      {
        id: 'job-strategy-30',
        title: '30-Tage-Bewerbungsstrategie',
        prompt: `Agiere als mein persönlicher Karriere-Stratege.

Ich bin [ROLLE] mit [X] Jahren in [BRANCHE] und möchte in [ZIELROLLE / -BRANCHE] wechseln.

Baue mir einen 30-Tage-Plan, der nicht auf Jobbörsen angewiesen ist:
- Konkrete tägliche Aktionen
- Outreach-Ziele (wen, wie, wie viele)
- Wie ich mich positioniere, um schneller eingestellt zu werden als 95% der Bewerber`,
        tags: ['Strategie', '30 Tage'],
      },
    ],
  },
];

// ── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '5px 11px',
        background: copied ? '#e8f4ec' : GOLD_LIGHT,
        color: copied ? '#2d7a4a' : GOLD,
        border: `1px solid ${copied ? '#b8dfc6' : 'rgba(139,115,85,0.25)'}`,
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: UI_FONT,
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
    >
      {copied ? <><Icon name="check" size={12} /> Kopiert</> : <><Icon name="copy" size={12} /> Kopieren</>}
    </button>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function KnowledgeCard({ card }: { card: Card }) {
  const [expanded, setExpanded] = useState(false);
  const isPrompt = Boolean(card.prompt);
  const hasLongContent = isPrompt
    ? card.prompt!.length > 200
    : (card.body?.length ?? 0) > 300;

  const displayText = isPrompt ? card.prompt! : (card.body ?? '');
  const shouldCollapse = hasLongContent && !expanded;
  const preview = shouldCollapse ? displayText.slice(0, 220) + '…' : displayText;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid oklch(0.91 0.005 264)',
      borderRadius: '10px',
      padding: '16px 18px',
      marginBottom: '10px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: SERIF_FONT,
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'oklch(0.21 0.021 264)',
            lineHeight: 1.3,
            marginBottom: '4px',
          }}>
            {card.title}
          </div>
          {card.tags && card.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {card.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: 'oklch(0.52 0.012 264)',
                  background: 'oklch(0.985 0.003 264)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontFamily: UI_FONT,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {isPrompt && <CopyButton text={card.prompt!} />}
      </div>

      {/* Body / Prompt */}
      <div style={{
        background: isPrompt ? 'oklch(0.985 0.003 264)' : 'transparent',
        borderRadius: isPrompt ? '7px' : 0,
        padding: isPrompt ? '12px 14px' : 0,
        border: isPrompt ? '1px solid oklch(0.91 0.005 264)' : 'none',
        position: 'relative',
      }}>
        <pre style={{
          fontFamily: isPrompt ? "'Courier New', monospace" : UI_FONT,
          fontSize: isPrompt ? '11.5px' : '12px',
          color: isPrompt ? '#3a3a3a' : '#555',
          lineHeight: 1.7,
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {preview}
        </pre>

        {shouldCollapse && (
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: '48px',
            background: isPrompt
              ? 'linear-gradient(to bottom, transparent, oklch(0.985 0.003 264))'
              : 'linear-gradient(to bottom, transparent, #fff)',
          }} />
        )}
      </div>

      {hasLongContent && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: '8px',
            background: 'none',
            border: 'none',
            color: GOLD,
            fontSize: '11.5px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: UI_FONT,
            padding: 0,
          }}
        >
          {expanded ? '▲ Weniger anzeigen' : '▾ Alles anzeigen'}
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function KnowledgePanel() {
  const [activeTab, setActiveTab] = useState('strategy');
  const category = CATEGORIES.find(c => c.id === activeTab) ?? CATEGORIES[0];

  return (
    <div style={{
      width: '340px',
      maxWidth: '100%',
      minWidth: 0,
      flexShrink: 1,
      borderRight: '1px solid oklch(0.91 0.005 264)',
      display: 'flex',
      flexDirection: 'column',
      background: 'oklch(0.985 0.003 264)',
      overflowY: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 18px 0',
        borderBottom: '1px solid oklch(0.91 0.005 264)',
        background: '#fff',
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: SERIF_FONT,
          fontSize: '15px',
          fontWeight: 700,
          color: 'oklch(0.21 0.021 264)',
          marginBottom: '12px',
        }}>
          Tipps & Prompts
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', paddingBottom: '0' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveTab(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 10px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === cat.id ? `2px solid ${GOLD}` : '2px solid transparent',
                color: activeTab === cat.id ? GOLD : '#888',
                fontSize: '11.5px',
                fontWeight: activeTab === cat.id ? 700 : 500,
                cursor: 'pointer',
                fontFamily: UI_FONT,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'color 0.15s',
              }}
            >
              <Icon name={cat.icon} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 14px 24px',
      }}>
        {/* Category description */}
        <div style={{
          fontSize: '11px',
          color: 'oklch(0.52 0.012 264)',
          fontFamily: UI_FONT,
          marginBottom: '12px',
          lineHeight: 1.5,
        }}>
          {activeTab === 'strategy' && 'Erkenntnisse & Prinzipien für eine wirkungsvolle Bewerbung.'}
          {activeTab === 'cv' && 'Prompts für Claude — einfach Platzhalter ersetzen und loslegen.'}
          {activeTab === 'cover-letter' && 'Prompts für authentische, nicht-generische Anschreiben.'}
          {activeTab === 'job-search' && 'Prompts für die strategische Jobsuche jenseits von Jobbörsen.'}
        </div>

        {category.cards.map(card => (
          <KnowledgeCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
