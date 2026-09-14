// ── Prüf-Personas ───────────────────────────────────────────────────────────
// Drei erfundene, aber realistische Lebensläufe für den Umbruch- und
// Qualitätsprüfstand. Sie decken die drei Zielgruppen ab, die tatsächlich
// unterschiedliche Layoutlasten erzeugen:
//
//   marketing — mittellange Stichpunkte, viele Kanäle in der Kontaktspalte
//   tech      — sehr lange Skill-Listen, technische Bullets, Zertifikate
//   handwerk  — viele kurze Stationen, Ausbildung/Meister im Zentrum,
//               keine Website, kein LinkedIn, dafür Eckdaten und Führerschein
//   einseiter — der Prüffall für „eine Seite", auch einspaltig
//
// Namen und Firmen sind frei erfunden.

import type { CVData } from '../data/types';
import { labelsDE } from '../data/labels';

const FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400">' +
  '<rect width="300" height="400" fill="#e7e2d9"/><circle cx="150" cy="152" r="62" fill="#cfc7ba"/>' +
  '<path d="M150 232c-58 0-104 38-112 92h224c-8-54-54-92-112-92z" fill="#cfc7ba"/></svg>',
);

export const marketing: CVData = {
  personal: {
    name: 'Katharina Vogt',
    title: 'Senior Marketing Manager',
    location: 'Isestraße 88\n20149 Hamburg',
    email: 'k.vogt@example.com',
    phone: '+49 151 22446688',
    website: 'katharinavogt.de',
    birthDate: '2. Februar 1989',
    nationality: 'deutsch',
    socials: [
      { id: 's1', platform: 'linkedin', value: 'katharina-vogt' },
      { id: 's2', platform: 'xing', value: 'Katharina_Vogt' },
    ],
    photo: FOTO,
  },
  profile: {
    text: 'Marketing-Managerin mit neun Jahren Erfahrung in erklärungsbedürftigen B2B-Produkten. '
      + 'Schwerpunkte: Positionierung, Content mit Substanz und messbare Kampagnen entlang des '
      + 'Funnels. Arbeitet eng mit Vertrieb und Produkt — und rechnet vor, was ein Kanal bringt.',
  },
  experience: [
    {
      id: 'm1', role: 'Senior Marketing Manager', company: 'Nordwerk Software GmbH', location: 'Hamburg',
      start: '03/2021', end: 'heute',
      bullets: [
        'Positionierung und Messaging für zwei Produktlinien neu aufgesetzt, gemeinsam mit Vertrieb und Produktmanagement',
        'Content-Programm aufgebaut: Fachbeiträge, Webinare, Kundenberichte — feste Redaktionsplanung statt Kampagnen-Aktionismus',
        'Marketing-Automation in HubSpot eingeführt, Lead-Übergabe an den Vertrieb mit klaren Kriterien definiert',
        'Messeauftritte und Fachveranstaltungen verantwortet, vom Standkonzept bis zur Nachfassstrecke',
      ],
    },
    {
      id: 'm2', role: 'Marketing Manager', company: 'Elbkontor Digital', location: 'Hamburg',
      start: '08/2018', end: '02/2021',
      bullets: [
        'Google Ads und LinkedIn Ads für sechs Mittelstandskunden betreut, Budgetverantwortung im mittleren fünfstelligen Bereich pro Quartal',
        'Reporting von Excel auf ein wiederverwendbares Dashboard umgestellt — Monatsreports statt Nachtschichten',
        'Landingpages und E-Mail-Strecken konzipiert und mit den Entwicklerinnen umgesetzt',
      ],
    },
    {
      id: 'm3', role: 'Junior Marketing Manager', company: 'Prenzlauer Medienhaus', location: 'Berlin',
      start: '10/2016', end: '07/2018',
      bullets: [
        'Redaktionsplanung und Community-Betreuung für drei Social-Kanäle',
        'Newsletter mit 24.000 Empfängern verantwortet, von Konzept bis Versand',
      ],
    },
  ],
  education: [
    { id: 'e1', degree: 'M.A. Kommunikationswissenschaft', institution: 'Freie Universität Berlin', start: '2014', end: '2016', notes: 'Schwerpunkt Organisationskommunikation, Abschluss 1,7' },
    { id: 'e2', degree: 'B.A. Medien- und Kommunikationswissenschaft', institution: 'Universität Mannheim', start: '2010', end: '2014' },
  ],
  skillGroups: [
    { label: 'Marketing', items: ['Positionierung & Messaging', 'Content-Strategie', 'Performance Marketing', 'Marketing Automation', 'Events & Messen'] },
    { label: 'Werkzeuge', items: ['HubSpot', 'Google Ads', 'LinkedIn Campaign Manager', 'Matomo', 'Figma'] },
    { label: 'Arbeitsweise', items: ['Enge Abstimmung mit Vertrieb', 'Redaktionelle Planung', 'Budgetverantwortung'] },
  ],
  languages: [
    { language: 'Deutsch', level: 'Muttersprache', dots: 5 },
    { language: 'Englisch', level: 'Verhandlungssicher (C1)', dots: 4 },
    { language: 'Französisch', level: 'Grundkenntnisse (A2)', dots: 2 },
  ],
  additionalExperience: [
    'Ehrenamtliche Öffentlichkeitsarbeit für einen Hamburger Sportverein',
    'Referentin auf der Fachkonferenz „B2B Marketing Nord" (2024)',
  ],
  labels: labelsDE,
};

export const tech: CVData = {
  personal: {
    name: 'Daniel Ostrowski',
    title: 'Site Reliability Engineer',
    location: 'Beethovenstraße 12, 04107 Leipzig',
    email: 'daniel.ostrowski@example.com',
    phone: '+49 176 33558877',
    website: 'ostrowski.dev',
    birthDate: '19. Juli 1990',
    socials: [
      { id: 's1', platform: 'github', value: 'dostrowski' },
      { id: 's2', platform: 'linkedin', value: 'daniel-ostrowski' },
    ],
    photo: FOTO,
  },
  profile: {
    text: 'SRE mit Schwerpunkt auf Betrieb und Verfügbarkeit verteilter Systeme. Baut Plattformen, '
      + 'die Teams selbst bedienen können, und automatisiert das, was sonst nachts klingelt. '
      + 'Kubernetes, Terraform, Observability — und die Bereitschaft, im Zweifel selbst in den Logs zu graben.',
  },
  experience: [
    {
      id: 't1', role: 'Site Reliability Engineer', company: 'Vektor Cloud Systems', location: 'Leipzig',
      start: '05/2022', end: 'heute',
      bullets: [
        'Betrieb von 14 Kubernetes-Clustern (EKS, on-prem) für rund 40 Entwicklungsteams; GitOps mit ArgoCD als einziger Deploy-Weg',
        'Observability-Stack von Nagios auf Prometheus, Loki und Grafana migriert — Alarme nach SLO statt nach Bauchgefühl',
        'Terraform-Module für Netz, IAM und Datenbanken als interne Bibliothek gebaut und versioniert',
        'Incident-Prozess eingeführt: Rufbereitschaft, Severity-Stufen, schuldfreie Postmortems',
        'Rollout von mTLS zwischen allen internen Diensten über Istio, ohne Downtime',
      ],
    },
    {
      id: 't2', role: 'DevOps Engineer', company: 'Saale Datentechnik GmbH', location: 'Halle (Saale)',
      start: '09/2019', end: '04/2022',
      bullets: [
        'CI/CD-Pipelines für 30+ Repositories in GitLab CI aufgebaut, Build-Zeiten durch Caching und Parallelisierung deutlich gesenkt',
        'Container-Registry, Artefakt-Verwaltung und Secret-Management (Vault) eingeführt',
        'Legacy-Anwendungen von VMs in Container überführt, inklusive Datenbank-Migrationen',
      ],
    },
    {
      id: 't3', role: 'Systemadministrator', company: 'Universitätsrechenzentrum Leipzig', location: 'Leipzig',
      start: '02/2016', end: '08/2019',
      bullets: [
        'Betrieb von Linux-Servern, Mailinfrastruktur und Backup-Systemen für rund 3.000 Nutzerinnen und Nutzer',
        'Monitoring und Patch-Management automatisiert (Ansible)',
      ],
    },
  ],
  education: [
    { id: 'e1', degree: 'B.Sc. Informatik', institution: 'HTWK Leipzig', start: '2012', end: '2016', notes: 'Bachelorarbeit über Container-Isolation, Note 1,9' },
    { id: 'e2', degree: 'Fachinformatiker Systemintegration', institution: 'IHK Leipzig', start: '2009', end: '2012' },
  ],
  skillGroups: [
    { label: 'Plattform', items: ['Kubernetes', 'Docker', 'Istio', 'ArgoCD', 'Helm', 'Nomad'] },
    { label: 'Infrastruktur', items: ['Terraform', 'Ansible', 'AWS (EKS, RDS, IAM)', 'Hetzner Cloud', 'Ceph', 'PostgreSQL'] },
    { label: 'Observability', items: ['Prometheus', 'Grafana', 'Loki', 'OpenTelemetry', 'Alertmanager'] },
    { label: 'Sprachen', items: ['Go', 'Python', 'Bash', 'TypeScript'] },
  ],
  languages: [
    { language: 'Deutsch', level: 'Muttersprache', dots: 5 },
    { language: 'Englisch', level: 'Fließend (C1)', dots: 4 },
    { language: 'Polnisch', level: 'Konversation (B1)', dots: 3 },
  ],
  additionalExperience: [
    'Certified Kubernetes Administrator (CKA), 2023',
    'AWS Solutions Architect Associate, 2021',
    'Mitarbeit an zwei Open-Source-Projekten (Terraform-Provider, Prometheus-Exporter)',
  ],
  labels: labelsDE,
};

export const handwerk: CVData = {
  personal: {
    name: 'Marcel Timm',
    title: 'Elektrotechnikermeister',
    location: 'Lindenweg 4\n29525 Uelzen',
    email: 'm.timm@example.com',
    phone: '+49 4182 998877',
    birthDate: '5. November 1986',
    birthPlace: 'Buchholz i. d. Nordheide',
    maritalStatus: 'verheiratet, zwei Kinder',
    driversLicense: 'Klasse B, BE',
    photo: FOTO,
  },
  profile: {
    text: 'Elektrotechnikermeister mit sechzehn Jahren Praxis in Gebäudetechnik und Anlagenbau. '
      + 'Führt Baustellen von der Aufmaßaufnahme bis zur Abnahme, bildet aus und kennt die Normen, '
      + 'nach denen abgenommen wird.',
  },
  experience: [
    {
      id: 'h1', role: 'Meister / Bauleiter Elektrotechnik', company: 'Elektro Ahrens GmbH', location: 'Buchholz i. d. Nordheide',
      start: '04/2019', end: 'heute',
      bullets: [
        'Verantwortlich für Baustellen im Wohn- und Gewerbebau bis 40 Wohneinheiten, von der Planung bis zur Abnahme',
        'Führung von sechs Monteuren und zwei Auszubildenden',
        'Aufmaß, Materialdisposition und Abrechnung; Abstimmung mit Architekten und Bauherren',
        'Prüfungen nach DGUV V3 sowie Abnahmen nach VDE 0100',
      ],
    },
    {
      id: 'h2', role: 'Elektroinstallateur', company: 'Nordheide Haustechnik', location: 'Uelzen',
      start: '08/2013', end: '03/2019',
      bullets: [
        'Installation von Verteilungen, Beleuchtungs- und Sicherheitstechnik im Neubau und Bestand',
        'Nachrüstung von Photovoltaik- und Speicheranlagen',
        'Störungsdienst und Kundendienst im Bereitschaftswechsel',
      ],
    },
    {
      id: 'h3', role: 'Elektroinstallateur', company: 'Schmidt Elektroanlagen', location: 'Harburg',
      start: '09/2009', end: '07/2013',
      bullets: [
        'Industrieinstallation und Schaltschrankbau',
        'Wartung von Förderanlagen in einem Logistikzentrum',
      ],
    },
    {
      id: 'h4', role: 'Ausbildung zum Elektroniker, Fachrichtung Energie- und Gebäudetechnik', company: 'Schmidt Elektroanlagen', location: 'Harburg',
      start: '08/2006', end: '08/2009',
      bullets: ['Abschluss vor der Handwerkskammer Lüneburg-Stade, Note gut'],
    },
  ],
  education: [
    { id: 'e1', degree: 'Elektrotechnikermeister (HWK)', institution: 'Handwerkskammer Braunschweig-Lüneburg-Stade', start: '2017', end: '2019', notes: 'Teile I–IV, berufsbegleitend' },
    { id: 'e2', degree: 'Ausbildereignungsprüfung (AEVO)', institution: 'Handwerkskammer Lüneburg-Stade', start: '2018', end: '2018' },
    { id: 'e3', degree: 'Realschulabschluss', institution: 'Realschule Uelzen', start: '1997', end: '2006' },
  ],
  skillGroups: [
    { label: 'Fachliches', items: ['Gebäudetechnik (Neubau und Bestand)', 'Schaltschrankbau', 'Photovoltaik und Speicher', 'KNX / Gebäudeautomation', 'Prüfung nach DGUV V3'] },
    { label: 'Baustelle', items: ['Aufmaß und Abrechnung', 'Materialdisposition', 'Führung kleiner Teams', 'Abstimmung mit Gewerken'] },
  ],
  languages: [
    { language: 'Deutsch', level: 'Muttersprache', dots: 5 },
    { language: 'Englisch', level: 'Grundkenntnisse', dots: 2 },
  ],
  additionalExperience: [
    'Ausbilder seit 2019, bisher vier Auszubildende durch die Gesellenprüfung begleitet',
    'Aktives Mitglied der Freiwilligen Feuerwehr Uelzen',
  ],
  labels: labelsDE,
};

// ── Einseiter ───────────────────────────────────────────────────────────────
// Der Prüffall für „passt auf eine Seite" — auch in den einspaltigen und
// tabellarischen Vorlagen, wo Kontakt, Sprachen und Skills im Textfluss stehen
// statt in der Seitenspalte.
//
// Gebaut nach dem, was ein einseitiger Lebenslauf tatsächlich aushält:
// drei Stationen mit je zwei bis drei Stichpunkten, zwei Abschlüsse, zwei
// Skill-Gruppen, zwei Sprachen, ein Profiltext unter 400 Zeichen, keine
// „Weiteres"-Sektion. Wer mehr hat, muss kürzen — genau dafür gibt es die
// Vorschläge in „Schrift & Seite".
export const einseiter: CVData = {
  personal: {
    name: 'Lina Sandmann',
    title: 'Projektmanagerin Digitalisierung',
    location: 'Bardowicker Straße 7\n21335 Lüneburg',
    email: 'l.sandmann@example.com',
    phone: '+49 4131 998877',
    website: 'linasandmann.de',
    socials: [{ id: 's1', platform: 'linkedin', value: 'linkedin.com/in/lina-sandmann' }],
    birthDate: '17. April 1993',
    nationality: 'deutsch',
    photo: FOTO,
  },
  profile: {
    text: 'Projektmanagerin mit sechs Jahren Erfahrung an der Schnittstelle von Fachbereich und IT. '
      + 'Führt Vorhaben von der Anforderung bis zum Betrieb und übersetzt zwischen beiden Seiten.',
  },
  experience: [
    {
      id: 'l1', role: 'Projektmanagerin Digitalisierung', company: 'Nordheide Versorgung AG', location: 'Lüneburg',
      start: '05/2022', end: 'heute',
      bullets: [
        'Einführung eines Kundenportals für 180.000 Zählpunkte, von der Ausschreibung bis zum Betrieb',
        'Sechs Fachbereiche koordiniert, Budget im siebenstelligen Bereich verantwortet',
        'Betriebsübergabe an den Regelbetrieb inklusive Schulung und Dokumentation',
      ],
    },
    {
      id: 'l2', role: 'Business Analystin', company: 'Elbwerk Consulting', location: 'Hamburg',
      start: '08/2019', end: '04/2022',
      bullets: [
        'Anforderungen für Energieversorger erhoben und in Lastenhefte überführt',
        'Prozesse aufgenommen und mit den Fachbereichen neu geschnitten',
      ],
    },
    {
      id: 'l3', role: 'Werkstudentin Prozessmanagement', company: 'Stadtwerke Uelzen', location: 'Uelzen',
      start: '10/2017', end: '07/2019',
      bullets: ['Auswertungen für das Beschwerdemanagement aufgebaut und automatisiert'],
    },
  ],
  education: [
    { id: 'le1', degree: 'M.Sc. Wirtschaftsinformatik', institution: 'Leuphana Universität Lüneburg', start: '2017', end: '2019' },
    { id: 'le2', degree: 'B.Sc. Betriebswirtschaftslehre', institution: 'Universität Hamburg', start: '2013', end: '2017' },
  ],
  skillGroups: [
    { label: 'Methoden', items: ['Anforderungsanalyse', 'Prozessmodellierung (BPMN)', 'Scrum und Kanban', 'Stakeholder-Management'] },
    { label: 'Werkzeuge', items: ['Jira und Confluence', 'Power BI', 'SQL', 'Figma'] },
  ],
  languages: [
    { language: 'Deutsch', level: 'Muttersprache', dots: 5 },
    { language: 'Englisch', level: 'Verhandlungssicher (C1)', dots: 4 },
  ],
  additionalExperience: [],
  labels: labelsDE,
};

export const PERSONAS: Record<string, CVData> = { marketing, tech, handwerk, einseiter };
