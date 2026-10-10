/**
 * Tipps, deutsche Fassung. Quelle der Wahrheit für die Inhalte; en/fr/es
 * folgen ihr Abschnitt für Abschnitt.
 *
 * Regeln für diese Datei: Jede Aussage über Recht, Behörden, Studien oder
 * fremde Systeme hat eine Quelle in `sources`. Vorher/Nachher-Beispiele sind
 * selbst formuliert. Keine erfundenen Zahlen außer in erkennbaren Beispielen.
 */
import type { TipsContent } from '../types';

const de: TipsContent = {
  cvIntro: 'Hinweise je Abschnitt des Lebenslaufs, mit Belegen. Oben steht, was gerade zu deinem Stand passt.',
  cv: [
    {
      id: 'profile',
      title: 'Profil: drei Sätze, die nur auf dich passen',
      body: 'Das Profil steht ganz oben und wird zuerst gelesen, von Menschen und von Portalen, die es als Zusammenfassung übernehmen. Drei bis vier Sätze reichen: was du machst, seit wann und worin, und was du als Nächstes vorhast. Der britische National Careers Service beschreibt es als wenige kurze Zeilen, die zusammenfassen, wer du bist und was du vorhast.\n\nEigenschaften wie „teamfähig" oder „belastbar" schreibt fast jeder hinein. Glaubwürdig werden sie erst mit einem Beispiel, und dann braucht es das Adjektiv meist nicht mehr.',
      before: 'Engagierte und teamfähige Fachkraft mit Leidenschaft für Marketing, die stets lösungsorientiert arbeitet und neue Herausforderungen sucht.',
      after: 'Online-Marketing seit sechs Jahren, davon drei im B2B-Maschinenbau. Ich plane und werte Kampagnen in Google Ads und HubSpot aus und suche jetzt eine Stelle mit eigener Budgetverantwortung.',
      sources: ['ncs'],
      magazin: ['lebenslauf-mit-ki-schreiben-ohne-erfindungen'],
    },
    {
      id: 'impact',
      title: 'Erfahrung: erst das Ergebnis, dann die Tätigkeit',
      body: 'Unter jede Station gehören drei bis fünf Punkte, so steht es bei der Bundesagentur für Arbeit. Jeder Punkt beginnt mit einem Verb und sagt, was danach anders war. Die Lebenslauf-Vorlage von Harvard fasst das in vier Regeln: mit einem Tätigkeitsverb anfangen, Satzteile statt ganzer Sätze, kein „ich", und Zahlen, wo es welche gibt.\n\nDie Zahlen müssen nicht groß sein. Anzahl, Zeitraum, Häufigkeit oder Größenordnung reichen, solange sie stimmen. Wo es keine Zahl gibt, beschreibt der Punkt das Ergebnis: was eingeführt, abgeschlossen oder abgelöst wurde.\n\nDie Begriffe der Stellenanzeige gehören in diese Punkte und nicht nur in eine Liste am Ende. Unter „Prüfen → Lebenslauf → Stellenanzeige" siehst du, welcher Punkt einen Begriff der Anzeige enthält.',
      before: 'Verantwortlich für die Betreuung von Kundenprojekten',
      after: 'Betreute 14 Kundenprojekte parallel; Abnahme im Schnitt zwei Wochen vor dem vereinbarten Termin',
      sources: ['ba-lebenslauf', 'harvard-bullets'],
    },
    {
      id: 'skills',
      title: 'Kenntnisse: Begriffe, nach denen man suchen kann',
      body: 'Personalabteilungen und Portale suchen nach Begriffen: einer Software, einem Verfahren, einer Norm, einem Führerschein. Schreib sie so, wie sie in der Anzeige stehen, also „Microsoft Excel", wenn dort „Microsoft Excel" steht. Nicht jedes System erkennt, dass „MS Office" dasselbe meint.\n\nBalken, Sterne und Prozentkreise sehen nach Information aus, sind aber Grafik. In der Textansicht der Prüfung erscheint davon nichts. Für Sprachen gibt es eine Skala, die jeder lesen kann: den Gemeinsamen Europäischen Referenzrahmen von A1 bis C2.\n\nLieber zehn Kenntnisse, die du im Gespräch belegen kannst, als dreißig, nach denen dich besser niemand fragt.',
      before: 'MS Office ●●●●○ · Kommunikation ●●●●● · Englisch ●●●●○',
      after: 'Microsoft Excel (Pivot, SVERWEIS), SAP S/4HANA (MM), Englisch C1',
      sources: ['coe-cefr'],
      magazin: ['lebenslauf-maschinenlesbar-checkliste', 'wie-bewerbermanagement-systeme-lebenslaeufe-lesen'],
    },
    {
      id: 'gaps',
      title: 'Lücken: kurz benennen statt verstecken',
      body: 'In der Studie „Hidden Workers" von Harvard Business School und Accenture (2021, Befragung von 2.275 Führungskräften in den USA, Großbritannien und Deutschland) gab fast die Hälfte der Unternehmen an, Lebensläufe mit einer Lücke von mehr als sechs Monaten auszusortieren, zum Teil automatisch im Bewerbermanagement-System.\n\nDaraus folgt nicht, dass man Zeiten erfinden sollte. Es folgt, dass eine benannte Lücke besser dasteht als eine unbenannte. Elternzeit, Pflege von Angehörigen, Weiterbildung, Jobsuche, Selbstständigkeit: eine Zeile mit Zeitraum genügt, eine Begründung schuldest du niemandem. Bei Krankheit reicht „Auszeit"; Diagnosen gehören nicht in den Lebenslauf.\n\nÜblich sind Monatsangaben (MM/JJJJ). Nur Jahreszahlen fallen auf, wenn sie erkennbar etwas überdecken.',
      before: '07/2019 bis 02/2021 Projektassistenz · 11/2021 bis heute Teamleitung',
      after: '03/2021 bis 10/2021 Elternzeit (eigene Zeile zwischen beiden Stationen)',
      sources: ['hbs-hidden'],
      magazin: ['luecke-im-lebenslauf'],
    },
    {
      id: 'photo',
      title: 'Foto, Geburtsdatum und Eckdaten',
      body: 'In Deutschland ist das Foto freiwillig, ebenso Geburtsdatum, Familienstand und Staatsangehörigkeit. Nach dem Allgemeinen Gleichbehandlungsgesetz darf ein Arbeitgeber danach nicht einmal fragen. Die Antidiskriminierungsstelle des Bundes hat erhoben, wie verbreitet der Irrtum ist: 86 % der Befragten hielten die Frage nach dem Alter für zulässig.\n\nWer diese Angaben von sich aus nennt, liefert sie trotzdem. Das ist erlaubt und manchmal sinnvoll, aber eine Entscheidung und keine Pflicht. Die Bundesagentur für Arbeit führt Geburtsdatum und Ort weiter unter „persönliche Daten"; beides stimmt, die eine Stelle beschreibt das Übliche, die andere das Zulässige.\n\nFür Großbritannien und die USA gilt das Gegenteil: dort ohne Foto und ohne Geburtsdatum. Die Unterschiede stehen im Bereich „Länder". In diesem Werkzeug lässt sich der Abschnitt „Eckdaten" einzeln ausblenden, und der Export lässt ihn dann in allen Formaten weg.',
      sources: ['ads', 'ba-lebenslauf', 'ncs', 'harvard-resume'],
    },
    {
      id: 'length',
      title: 'Länge: eine bis zwei Seiten, in der Schweiz auch drei',
      body: 'Die Bundesagentur für Arbeit nennt für den deutschen Lebenslauf höchstens zwei Seiten, Transport for London für Großbritannien „ideally no more than 2 pages". Die Berufsberatung im Kanton Bern rechnet für die Schweiz mit zwei bis höchstens drei Seiten. Wer erst kurz im Beruf ist, kommt meist mit einer Seite aus.\n\nKürzen heißt nicht, die Schrift zu verkleinern. Zuerst fliegen Punkte, die für diese Stelle nichts beitragen; welche das sind, zeigt die Prüfung mit der Stellenanzeige. Ältere Stationen dürfen kürzer werden als die letzten beiden.\n\nUnter „Prüfen → Seite" steht, ob der Inhalt auf die gewählte Seitenzahl passt und wie stark dafür verdichtet wird.',
      sources: ['ba-lebenslauf', 'tfl', 'biz-bern'],
    },
    {
      id: 'filename',
      title: 'Dateiname und Format',
      body: 'Den Dateinamen sieht man vor dem Inhalt. „Lebenslauf_Vorname-Nachname.pdf" sagt, was drin ist und von wem; „CV_final_neu2.pdf" sagt etwas anderes. Die Bundesagentur für Arbeit rät, jede Unterlage als PDF zu verschicken, damit die Formatierung erhalten bleibt, die Datei eindeutig zu benennen und unter 10 MB zu bleiben.\n\nDieses Werkzeug benennt Downloads nach dem Muster Lebenslauf_Vorname-Nachname mit Datum und Uhrzeit. Verlangt ein Portal ausdrücklich Word, gibt es dafür eine eigene Fassung; sonst ist PDF die sichere Wahl.',
      before: 'CV_final_neu2.pdf',
      after: 'Lebenslauf_Lena-Brandt.pdf',
      sources: ['ba-checkliste'],
      magazin: ['lebenslauf-pdf-oder-word', 'lebenslauf-maschinenlesbar-checkliste'],
    },
    {
      id: 'ats',
      title: 'Bewerbermanagement-Systeme: der erste Leser ist oft kein Mensch',
      body: 'Viele Unternehmen sammeln Bewerbungen in einem Bewerbermanagement-System (englisch ATS). Die Zahl „75 % der Lebensläufe werden vom ATS aussortiert" hat keine auffindbare Primärquelle. Belegt ist etwas anderes: In der Studie „Hidden Workers" sortieren starre Filterregeln geeignete Menschen aus, bevor jemand den Lebenslauf liest, etwa wegen einer Lücke oder eines formal nicht passenden Abschlusses.\n\nWas hilft, sind gewöhnliche Dinge: die Begriffe der Anzeige wörtlich verwenden, Kontakt und Name als Text, eine Reihenfolge, die ein Programm von oben nach unten lesen kann. Die Textansicht unter „Prüfen" zeigt den Text deines PDF in genau der Reihenfolge, in der er in der Datei steht.',
      sources: ['hbs-hidden'],
      magazin: ['wie-bewerbermanagement-systeme-lebenslaeufe-lesen', 'bewerben-wenn-ki-vorsortiert', 'ki-verordnung-recruiting-bewerber'],
    },
    {
      id: 'ai',
      title: 'KI als Werkzeug, nicht als Verfasser',
      body: 'Der Karriere-Dienst von Harvard schreibt es seinen Studierenden so vor: KI darf Formulierungen überarbeiten, Begriffe aus einer Ausschreibung ziehen und Rückmeldung geben, soll aber nicht der hauptsächliche Verfasser sein, schon weil das Ergebnis sehr allgemein ausfallen dürfte.\n\nIn der Praxis heißt das: Fakten, Zahlen und Stationen kommen von dir, die KI darf sie ordnen und kürzen. Was sie dazuerfindet, fällt im Gespräch auf, spätestens bei der ersten Nachfrage.',
      sources: ['harvard-ai'],
      magazin: ['lebenslauf-mit-ki-schreiben-ohne-erfindungen'],
    },
    {
      id: 'more',
      title: 'Weiteres: Ehrenamt, Projekte, Sprachen',
      body: 'Der Abschnitt für zusätzliche Erfahrung ist kein Restposten. Harvard führt „Leadership & Activities" als eigenen, gleichrangigen Abschnitt, die Bundesagentur für Arbeit nennt persönliche Fähigkeiten samt Ehrenamt und Hobbys, die zur Stelle passen.\n\nEine Vorstandsrolle im Verein, ein eigenes Projekt, eine seltene Sprache: drei bis fünf konkrete Punkte, formuliert wie die Punkte unter einer Station.',
      before: 'Hobbys: Lesen, Reisen, Sport',
      after: 'Kassenwartin im Sportverein, Abteilung Leichtathletik (seit 2022, 140 Mitglieder)',
      sources: ['harvard-bullets', 'ba-arbeitsblatt'],
    },
  ],
  letterIntro: 'Aufbau, Beispiele und Stil fürs Anschreiben. Die Prüfung unter „Prüfen → Anschreiben" wendet dieselben Regeln auf deinen Text an.',
  letter: [
    {
      id: 'letter-structure',
      title: 'Aufbau: eine Seite in acht Teilen',
      body: 'Die Bundesagentur für Arbeit gliedert das Anschreiben so: Kontaktdaten, Ort und Datum, Betreff, Anrede, Einstieg, Hauptteil mit dir und deiner Erfahrung, Verbindung zwischen dir und der Stelle, Schluss mit Gruß. Für den Einstieg nennt sie drei bis fünf Zeilen, für den Hauptteil etwa acht, für die Verbindung zur Stelle etwa zwei.\n\nMehr als eine Seite wird es damit nicht. Das sagen auch Harvard („no more than a single page"), Transport for London („no more than one side") und die Berufsberatung im Kanton Bern („max. 1 Seite").\n\nDie Prüfung misst, ob dein Text auf die Seite passt. Was nicht passt, schneidet das PDF am unteren Rand ab.',
      sources: ['ba-anschreiben', 'harvard-resume', 'tfl', 'biz-bern'],
      magazin: ['anschreiben-2026-pflicht-oder-ueberholt'],
    },
    {
      id: 'letter-subject',
      title: 'Betreff und Anrede',
      body: 'Im Betreff steht die Stelle so, wie sie in der Anzeige heißt, mit Kennziffer, wenn es eine gibt. So findet jeder die Bewerbung wieder.\n\nSteht in der Anzeige eine Ansprechperson, gehört ihr Name in die Anrede. Die Bundesagentur rät, die Person sonst zu recherchieren; nur wenn sich niemand finden lässt, ist „Sehr geehrte Damen und Herren" in Ordnung. Der Leitfaden der Harvard T.H. Chan School sagt dasselbe: wenn möglich an eine bestimmte Person richten.',
      before: 'Betreff: Bewerbung\nSehr geehrte Damen und Herren,',
      after: 'Bewerbung als Projektleitung Haustechnik, Kennziffer 24-117\nSehr geehrte Frau Albers,',
      sources: ['ba-anschreiben', 'harvard-chan-cl'],
    },
    {
      id: 'letter-opening',
      title: 'Der erste Satz',
      body: '„Hiermit bewerbe ich mich …" steht in so vielen Anschreiben, dass es kaum noch jemand liest. Die Bundesagentur für Arbeit rät ausdrücklich davon ab. Ein besserer erster Satz sagt, warum gerade diese Stelle: eine Aufgabe aus der Anzeige, die du schon gemacht hast, ein Projekt der Firma, ein Gespräch auf einer Messe.\n\nDas vorbelegte Muster in diesem Werkzeug beginnt genau mit so einem Standardsatz. Es ist nur dafür da, dass die Seite nicht leer ist, und die Prüfung meldet es, solange es unverändert drinsteht.',
      before: 'Mit großem Interesse habe ich Ihre Stellenanzeige gelesen und bewerbe mich hiermit um die ausgeschriebene Position.',
      after: 'Sie suchen jemanden, der die Wartungsplanung auf ein neues System umstellt. Genau das habe ich 2024 bei meinem jetzigen Arbeitgeber für 40 Anlagen gemacht.',
      sources: ['ba-anschreiben'],
      magazin: ['anschreiben-2026-pflicht-oder-ueberholt'],
    },
    {
      id: 'letter-body',
      title: 'Hauptteil: zwei Belege statt zehn Eigenschaften',
      body: 'Der Hauptteil verbindet zwei, drei Anforderungen aus der Anzeige mit dem, was du schon gemacht hast, je Anforderung ein Satz mit Beleg. Der Lebenslauf liegt bei; das Anschreiben muss ihn nicht nacherzählen.\n\nDer Leitfaden der Harvard T.H. Chan School rät, jedes Anschreiben auf eine bestimmte Stelle zuzuschneiden und zu zeigen, dass man recherchiert hat. Ein Satz über die Firma, der auf jede andere Firma auch passt, zeigt das Gegenteil. Vom selben Leitfaden: nicht jeden Satz mit „Ich" beginnen.',
      before: 'Ihr Unternehmen überzeugt mich durch seine klare strategische Ausrichtung und seine Kultur der kontinuierlichen Weiterentwicklung.',
      after: 'Sie haben 2025 einen zweiten Standort in Lüneburg eröffnet. Ich wohne in Winsen und habe die letzten drei Jahre Kundschaft im Landkreis betreut.',
      sources: ['harvard-chan-cl'],
    },
    {
      id: 'letter-closing',
      title: 'Schluss und Gruß',
      body: 'Ein Satz, der nach vorn zeigt, reicht. Wenn die Anzeige danach fragt, kommen Eintrittstermin und Gehaltsvorstellung dazu, beides am Ende und nicht im Einstieg. „Mit freundlichen Grüßen" ist der übliche Gruß; so empfiehlt es auch die Bundesagentur für Arbeit.\n\nDie Möglichkeitsform („würde mich freuen") ist nicht falsch, klingt aber zurückhaltender, als du es meinst.',
      before: 'Über die Möglichkeit eines persönlichen Gesprächs würde ich mich sehr freuen.',
      after: 'Ich freue mich auf das Gespräch. Anfangen kann ich ab dem 1. März.',
      sources: ['ba-anschreiben'],
      magazin: ['gehalt-stellenanzeige-entgelttransparenz'],
    },
    {
      id: 'letter-ai',
      title: 'KI-Hilfe ohne KI-Klang',
      body: 'Die Stilhinweise in der Prüfung sind keine KI-Erkennung. Verlässlich kann das kein Werkzeug: OpenAI hat seinen eigenen Erkenner 2023 wegen geringer Treffsicherheit zurückgezogen, und die Wörter auf der Liste stehen auch in Texten, die Menschen allein geschrieben haben. Die Liste zeigt Wendungen, die in sehr vielen Anschreiben stehen und deshalb wenig über dich sagen.\n\nWer mit KI schreibt, gibt ihr am besten Stoff, der nur von dir kommen kann: das Projekt, die Zahl, den Grund für die Bewerbung. Das Ergebnis liest du einmal laut. Was du so nicht sagen würdest, streichst du.',
      sources: ['openai', 'wiki-ai', 'harvard-ai'],
      magazin: ['lebenslauf-mit-ki-schreiben-ohne-erfindungen', 'bewerben-wenn-ki-vorsortiert'],
    },
  ],
  countriesIntro: 'Was in fünf Ländern üblich ist, nach Behörden, Arbeitsvermittlungen und Hochschulen. Im Zweifel gilt, was in der Stellenanzeige steht.',
  countries: [
    {
      code: 'DE', name: 'Deutschland',
      rows: [
        ['Foto', 'freiwillig; wenn, dann ein professionelles Bild, kein Selfie'],
        ['Persönliche Daten', 'Geburtsdatum üblich, aber freiwillig; der Arbeitgeber darf nicht danach fragen (AGG)'],
        ['Länge', 'höchstens zwei Seiten'],
        ['Anschreiben', 'eine Seite, mit Ort und Datum'],
        ['Unterschrift', 'am Fuß des Lebenslaufs möglich, kein Muss'],
      ],
      tool: 'Vorlage mit Foto und Datumsspalte, Eckdaten nach Wunsch an oder aus.',
      sources: ['ba-lebenslauf', 'ba-checkliste', 'ads'],
    },
    {
      code: 'AT', name: 'Österreich',
      rows: [
        ['Foto', 'üblich, aber kein Muss'],
        ['Persönliche Daten', 'können genannt werden, müssen nicht'],
        ['Länge', 'kurz und kompakt, eine bis höchstens zwei Seiten'],
        ['Unterschrift', 'das AMS rät, auch den Lebenslauf zu unterschreiben; elektronisch genügt der Name'],
      ],
      tool: 'Wie in Deutschland; Ort und Datum am Fuß lassen sich in der Vorlage einschalten.',
      sources: ['ams'],
    },
    {
      code: 'CH', name: 'Schweiz',
      rows: [
        ['Foto', 'üblich: aktuell, freundlich, passend zum Beruf'],
        ['Persönliche Daten', 'Geburtsdatum, Nationalität und Zivilstand werden üblicherweise genannt'],
        ['Länge', 'zwei bis höchstens drei Seiten'],
        ['Motivationsschreiben', 'höchstens eine Seite'],
        ['Referenzen', '„auf Anfrage" oder mit Name, Funktion und Telefon'],
      ],
      tool: 'Eckdaten einschalten, bei Bedarf Seitenzahl auf drei stellen.',
      sources: ['biz-bern'],
    },
    {
      code: 'UK', name: 'Großbritannien',
      rows: [
        ['Foto', 'nicht nötig'],
        ['Persönliche Daten', 'kein Alter, kein Geburtsdatum, kein Familienstand, keine Nationalität'],
        ['Länge', 'möglichst nicht mehr als zwei Seiten'],
        ['Anschreiben', 'kurz, höchstens eine Seite'],
        ['Referenzen', '„available on request", keine fremden Kontaktdaten ohne Zustimmung'],
      ],
      tool: 'Dokumentsprache Englisch, Foto entfernen, Abschnitt „Eckdaten" ausblenden.',
      sources: ['ncs', 'tfl'],
    },
    {
      code: 'US', name: 'USA',
      rows: [
        ['Foto', 'nein'],
        ['Persönliche Daten', 'kein Alter, kein Geschlecht'],
        ['Länge', 'kurz und dicht; Harvard nennt keine feste Grenze'],
        ['Cover letter', 'höchstens eine Seite'],
        ['Aufbau', 'eine Spalte; bei Studierenden steht die Ausbildung vorn'],
      ],
      tool: 'Einspaltige Vorlage, Foto entfernen, Eckdaten aus, Ausbildung nach oben ziehen.',
      sources: ['harvard-resume', 'harvard-bullets'],
    },
  ],
  checklistIntro: 'Einmal durchgehen, bevor du auf „Absenden" drückst. Die Häkchen merkt sich nur dieser Browser.',
  checklist: [
    { id: 'contact', text: 'Name, E-Mail-Adresse und Telefonnummer stimmen, und die E-Mail-Adresse wirkt seriös.' },
    { id: 'recipient', text: 'Firma, Ansprechperson und Stellentitel im Anschreiben gehören zu dieser Bewerbung und nicht zur letzten.' },
    { id: 'date', text: 'Das Datum im Anschreiben ist aktuell.' },
    { id: 'terms', text: 'Die wichtigsten Begriffe der Anzeige stehen im Lebenslauf, in den Punkten unter den Stationen.' },
    { id: 'textview', text: 'Die Textansicht unter „Prüfen" zeigt alles vollständig und in sinnvoller Reihenfolge.' },
    { id: 'lang', text: 'Lebenslauf und Anschreiben sind in derselben Sprache.' },
    { id: 'placeholder', text: 'Kein Platzhalter mehr drin: keine eckigen Klammern, keine Musterfirma, kein unveränderter Mustertext.' },
    { id: 'files', text: 'Alles als PDF, der Dateiname enthält deinen Namen, zusammen unter der Größengrenze des Portals.' },
    { id: 'attachments', text: 'Zeugnisse und Nachweise, die die Anzeige verlangt, liegen bei.' },
    { id: 'proof', text: 'Eine zweite Person hat beides einmal gelesen.' },
    { id: 'ad', text: 'Die Stellenanzeige ist als PDF oder Text gespeichert. Nach Ablauf der Frist ist sie oft verschwunden.' },
    { id: 'share', text: 'Bei einem geteilten Link weißt du, wer ihn hat, und kannst ihn später zurückziehen.' },
  ],
  promptsIntro: 'Vorlagen für einen KI-Assistenten. Ersetze die eckigen Klammern durch deine Angaben. Zahlen und Fakten kommen von dir, nicht vom Modell.',
  prompts: [
    {
      id: 'jd-keywords', title: 'Stellenanzeige auswerten',
      prompt: 'Hier ist eine Stellenanzeige, auf die ich mich bewerben möchte:\n\n[STELLENANZEIGE EINFÜGEN]\n\n1. Nenne die zehn wichtigsten Kenntnisse und Begriffe, wörtlich so, wie sie in der Anzeige stehen.\n2. Welche davon sind Pflicht, welche erwünscht? Zitiere die Stelle in der Anzeige, aus der du das schließt.\n3. Prüfe meine folgenden Punkte und sag mir, wo ein Begriff der Anzeige ehrlich hineinpasst. Erfinde keine Erfahrung, die nicht dasteht.\n\n[MEINE PUNKTE EINFÜGEN]',
    },
    {
      id: 'bullets', title: 'Punkte unter einer Station schärfen',
      prompt: 'Überarbeite diese Punkte aus meinem Lebenslauf. Regeln:\n- jeder Punkt beginnt mit einem Verb, kein „ich", kein „verantwortlich für"\n- erst das Ergebnis, dann die Tätigkeit\n- höchstens zwei Zeilen je Punkt\n- verwende nur Zahlen, die in meinem Text stehen; wo eine fehlt, schreib [ZAHL?] und frag mich\n\nStation: [ROLLE, FIRMA, ZEITRAUM]\nPunkte:\n[PUNKTE EINFÜGEN]',
    },
    {
      id: 'profile', title: 'Profil schreiben',
      prompt: 'Schreib aus meinen Angaben ein Profil für den Lebenslauf: drei bis vier Sätze, sachlich, ohne „teamfähig", „belastbar", „leidenschaftlich" oder ähnliche Wörter.\n\nZielstelle: [STELLE, BRANCHE]\nMeine Angaben: [JAHRE ERFAHRUNG, SCHWERPUNKTE, WERKZEUGE, WAS ICH ALS NÄCHSTES WILL]\n\nErfinde nichts dazu. Wenn etwas fehlt, frag nach.',
    },
    {
      id: 'cl-write', title: 'Anschreiben entwerfen',
      prompt: 'Entwirf ein Anschreiben für diese Stelle, höchstens eine Seite (etwa 250 Wörter).\n\nFirma: [FIRMA]\nStelle: [STELLE, KENNZIFFER]\nAnsprechperson: [NAME, FALLS BEKANNT]\nWarum diese Stelle, in meinen Worten: [ZWEI SÄTZE]\nZwei Belege aus meiner Erfahrung: [BELEG 1], [BELEG 2]\n\nKein Einstieg mit „Hiermit bewerbe ich mich" oder „Mit großem Interesse". Nicht jeden Satz mit „Ich" beginnen. Kein Lob der Firma, das auf jede Firma passt. Nichts erfinden.',
    },
    {
      id: 'cl-review', title: 'Anschreiben gegenlesen lassen',
      prompt: 'Lies mein Anschreiben kritisch und antworte in Stichpunkten:\n1. Welcher Satz würde in jedem anderen Anschreiben genauso stehen?\n2. Wo fehlt ein Beleg für eine Behauptung?\n3. Passt der Bezug zur Firma nur auf diese Firma?\n4. Was ist der schwächste Satz, und wie sähe ein besserer aus (ohne neue Fakten zu erfinden)?\n\n[ANSCHREIBEN EINFÜGEN]',
    },
    {
      id: 'interview', title: 'Gespräch vorbereiten',
      prompt: 'Ich habe ein Gespräch bei [FIRMA] für die Stelle [STELLE]. Anzeige:\n\n[STELLENANZEIGE EINFÜGEN]\n\nNenne die zehn wahrscheinlichsten Fragen zu dieser Anzeige und je eine kurze Antwortstruktur (keine ausformulierten Antworten). Schlag mir dazu zwei Fragen vor, die ich selbst stellen kann.',
    },
    {
      id: 'salary', title: 'Gehaltsgespräch vorbereiten',
      prompt: 'Ich habe ein Angebot über [BETRAG] für [STELLE] in [ORT]. Hilf mir, ein Gegenangebot zu begründen, und schreib mir drei Sätze für das Gespräch: freundlich, klar, ohne Drohung.',
      note: 'Marktwerte nur aus echten Quellen nehmen, zum Beispiel dem Entgeltatlas der Bundesagentur für Arbeit, einem Tarifvertrag oder einem Gehaltsreport der Branche. Ohne Websuche nennt ein Sprachmodell eine plausible Zahl, die es sich ausgedacht hat.',
    },
  ],
};

export default de;
