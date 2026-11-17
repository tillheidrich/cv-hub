import type { CVData, CoverLetterData } from './types';
import { labelsEN } from './labels';

/**
 * Englische Demo seit 17.11.2026: Priya Raman, Senior Backend Engineer in
 * Berlin, aus Bengaluru. Erfundene Person, erfundene Firmen, Kontaktangaben
 * aus Bereichen für fiktive Nutzung (example.com, Rufnummernblock 030 23125).
 *
 * Warum nicht mehr Lena Brandt: Wer das Werkzeug auf Englisch öffnet, ist
 * häufig eine internationale Fachkraft, die sich in Deutschland bewirbt. Die
 * Demo zeigt deshalb einen englischen Lebenslauf nach deutschen Erwartungen:
 * tabellarisch, Neuestes zuerst, Arbeitserlaubnis (Blaue Karte EU) und
 * Deutschniveau nach GER sichtbar, Note im Original mit Umrechnung
 * (modifizierte bayerische Formel, Mindestnote der Hochschule 5,0:
 * 1 + 3 × (10 − 8,5) / (10 − 5) = 1,9), Vergleichbarkeit des Abschlusses
 * (ZAB), Kündigungsfrist; kein Geburtsdatum, kein Familienstand, keine
 * Declaration. Quellen: knowledge/sources.ts (ba-zav-cv, mig-*, anabin,
 * zab-comparability, uni-assist-india).
 *
 * Kein Foto: Das Demo-Foto zeigt Lena Brandt (demo-de.ts), und ein Gesicht
 * für Priya wird nicht erfunden. Das Foto ist in Deutschland freiwillig.
 * Keine echte Hochschule: Eine erfundene Note an einer echten Hochschule
 * wäre eine falsche Angabe über Dritte, deshalb steht dort allgemein
 * „Engineering college, Bengaluru".
 *
 * Die frühere englische Fassung (Lena Brandt) steht in demo-en-legacy.ts.
 */
export const demoEN: CVData = {
  personal: {
    name: 'Priya Raman',
    title: 'Senior Backend Engineer',
    subtitle: 'Java · Kotlin · Payments and logistics platforms',
    location: 'Berlin, Germany',
    email: 'priya.raman@example.com',
    phone: '+49 30 23125 456',
    linkedin: 'linkedin.com/in/priya-raman-example',
    instagram: '',
    nationality: 'Indian (EU Blue Card holder)',
  },

  profile: {
    text: 'Backend engineer with nine years of experience in payments and logistics, the last three in Berlin. I design and run Java and Kotlin services on PostgreSQL and Kafka and care about clear interfaces, good tests and quiet on-call weeks. Looking for a senior role in a product team.',
  },

  experience: [
    {
      id: 'kesselhaus',
      role: 'Senior Backend Engineer',
      company: 'Kesselhaus Mobility GmbH',
      location: 'Berlin',
      start: '04/2023',
      end: 'present',
      bullets: [
        'Split the booking monolith into four Kotlin and Spring Boot services; releases went from weekly to daily',
        'Cut p95 latency of the pricing API from 480 ms to 190 ms by reworking PostgreSQL indexes and caching',
        'Introduced contract tests between eight services; integration incidents fell from about six to two per quarter',
      ],
    },
    {
      id: 'tamarind',
      role: 'Backend Engineer',
      company: 'Tamarind Payments Pvt. Ltd.',
      location: 'Bengaluru, India',
      start: '07/2019',
      end: '03/2023',
      bullets: [
        'Built and ran settlement services in Java for around 1.2 million transactions a day',
        'Moved nightly batch jobs to Kafka consumers; settlement files now reach partner banks four hours earlier',
        'Prepared the backend team’s PCI DSS evidence for two annual audits',
      ],
    },
    {
      id: 'indigo-byte',
      role: 'Software Engineer',
      company: 'Indigo Byte Solutions Pvt. Ltd.',
      location: 'Bengaluru, India',
      start: '07/2017',
      end: '06/2019',
      bullets: [
        'Maintained REST APIs for an insurance claims portal (Java, Oracle)',
        'Wrote the first automated regression suite (about 300 tests), run on every merge',
      ],
    },
  ],

  education: [
    {
      id: 'btech',
      degree: 'B.Tech in Computer Science',
      institution: 'Engineering college, Bengaluru',
      location: 'India',
      start: '2013',
      end: '2017',
      notes: 'CGPA 8.5 of 10 (German grade 1.9, modified Bavarian formula, minimum pass mark 5.0)\nComparable to a German bachelor’s degree (ZAB Statement of Comparability, 2023)',
    },
  ],

  skillGroups: [
    {
      label: 'Programming languages',
      items: ['Kotlin', 'Java', 'SQL', 'Python (scripting)'],
    },
    {
      label: 'Frameworks and data',
      items: ['Spring Boot', 'Ktor', 'PostgreSQL', 'Apache Kafka', 'Redis'],
    },
    {
      label: 'Infrastructure',
      items: ['Docker', 'Kubernetes', 'Terraform', 'AWS (ECS, RDS)'],
    },
    {
      label: 'Practices',
      items: ['Domain-driven design', 'Contract testing (Pact)', 'Observability (OpenTelemetry)', 'Code review'],
    },
  ],

  languages: [
    { language: 'English', level: 'C2' },
    { language: 'German', level: 'B1 (Goethe-Zertifikat, 2024)' },
    { language: 'Tamil', level: 'Native' },
    { language: 'Hindi', level: 'Conversational' },
  ],

  certificates: [
    { id: 'aws-dev', name: 'AWS Certified Developer (Associate)', issuer: 'Amazon Web Services', date: '2022', credentialId: '', url: '' },
  ],

  additionalExperience: [
    'Notice period: three months',
    'Mentor for two junior engineers at Kesselhaus Mobility',
    'Talk on contract testing at a Berlin Java user group (2024)',
  ],

  labels: labelsEN,
};

/**
 * Anschreiben zur englischen Demo: an eine erfundene Firma in Berlin, Aufbau
 * nach DIN 5008 (setzt CoverLetterRenderer). Nur für die Demo; neue, leere
 * Profile bekommen weiter das allgemeine Muster DEFAULT_COVER_LETTER_EN
 * (storage.ts), an dem die Prüfung „Mustertext" hängt.
 */
export const DEMO_COVER_LETTER_EN: CoverLetterData = {
  company: 'Nordkap Mobility GmbH',
  contactPerson: 'Ms Jana Albers',
  companyAddress: 'Beispielweg 7, 10117 Berlin',
  city: 'Berlin',
  date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  subject: 'Application: Senior Backend Engineer (Payments), ref. 26-114',
  salutation: 'Dear Ms Albers,',
  intro: 'You are moving your payment flows from a monolith to services next year. I have done this once already, for the booking platform at Kesselhaus Mobility in Berlin, and would like to do it again with your team.',
  mainBody: 'For the past three years I have built and run Kotlin and Spring Boot services on PostgreSQL and Kafka. We split the booking monolith into four services, and releases went from weekly to daily. Before that, at Tamarind Payments in Bengaluru, I ran settlement services for around 1.2 million transactions a day, so I know what a slow night batch costs when partner banks are waiting.',
  companyReference: 'Your ad mentions contract tests and a shared on-call rota. Both are part of my work today: I introduced contract tests between eight services and take my turn on call one week in five.',
  motivation: 'Nordkap’s payments team is the kind of product team I am looking for. I speak German at B1 level, use it with our operations colleagues every week and am working towards B2.',
  closing: 'I hold an EU Blue Card and have lived in Berlin since 2023. My notice period is three months. I look forward to talking with you.',
  signoff: 'Kind regards',
};
