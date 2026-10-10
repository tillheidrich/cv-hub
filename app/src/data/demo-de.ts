import type { CVData } from './types';
import { labelsDE } from './labels';

/* Demo-Foto (seit 10.10.2026, Auftrag: „ein Foto für Lena Brandt, das
 * standardmäßig drin ist").
 *
 * Quelle: Unsplash, Foto von Phạm Duy Quang,
 * https://unsplash.com/photos/woman-in-grey-blazer-business-portrait-QGr6H7pri-Q
 * Lizenz: Unsplash License (kommerzielle Nutzung erlaubt, Nennung nicht
 * Pflicht). Bearbeitet: Ansteckabzeichen am Revers entfernt, auf Brustbild
 * beschnitten, Metadaten entfernt. Nachweis in public/demo/CREDITS.txt.
 *
 * Die Felder folgen einem hochgeladenen Foto: `photo` ist der fertige
 * Zuschnitt (4:5, 720 × 900 wie aus dem Zuschneide-Dialog), `photoOriginal`
 * das größere Bild (3:4, 800 × 1067), an dem ein erneuter Zuschnitt ansetzt.
 * Beides sind Adressen auf eigene, statisch ausgelieferte Dateien — keine
 * data:-URL, sonst trüge jedes Bündel 120 KB Bild mit sich. Für PDF und HTML
 * bettet export/photoEmbed.ts das Bild beim Export als data:-URL ein, Word
 * rechnet es über die Leinwand um (exportDocx.ts, photoAsRaster).
 *
 * Bis zum 08.10.2026 stand hier eine graue Silhouette mit dem Wort „FOTO".
 * Ältere Demo-Profile tragen sie noch; sie fällt beim Export heraus
 * (export/photoEmbed.ts) und wird beim nächsten Laden der Demo durch dieses
 * Foto ersetzt (data/demoUpgrade.ts). */
export const DEMO_PHOTO = '/demo/lena-brandt-zuschnitt.jpg';
export const DEMO_PHOTO_ORIGINAL = '/demo/lena-brandt.jpg';

/**
 * Fictional demo persona. Not a real person.
 * Purpose: show off the template + editor without dragging the maintainer's
 * real CV into every new account.
 */
export const demoDE: CVData = {
  personal: {
    name: 'Lena Brandt',
    title: 'Senior Product Designer',
    subtitle: 'Produktdesign · Design Systems · UX Research',
    location: 'Lange Reihe 24, 20099 Hamburg',
    email: 'lena.brandt@example.com',
    phone: '+49 30 23125 789',
    website: 'lena-brandt.example',
    linkedin: 'linkedin.com/in/lena-brandt-beispiel',
    instagram: '',
    birthDate: '14. März 1991',
    driversLicense: 'Klasse B',
    photo: DEMO_PHOTO,
    photoOriginal: DEMO_PHOTO_ORIGINAL,
  },

  profile: {
    text: 'Senior Product Designer mit sieben Jahren Erfahrung in B2B-SaaS und E-Commerce. Schwerpunkte: skalierbare Design Systems, Research-getriebene Produktentwicklung und enge Zusammenarbeit mit Engineering — vom ersten Wireframe bis zum produktiven Feature.',
  },

  experience: [
    {
      id: 'nordhub',
      role: 'Senior Product Designer',
      company: 'Nordhub GmbH',
      location: 'Hamburg',
      start: '01/2023',
      end: 'heute',
      bullets: [
        'Verantwortung für das Design System (Figma + Tokens, ausgerollt auf vier Produktbereiche)',
        'Discovery- und Delivery-Phasen für drei Kernfeatures geleitet — von User Interviews bis zur Hi-Fi-Spezifikation',
        'Onboarding-Flow überarbeitet: Aktivierungsrate (Day-7) laut Analytics-Team deutlich verbessert',
      ],
    },
    {
      id: 'helmstedt',
      role: 'Product Designer',
      company: 'Helmstedt Tech AG',
      location: 'Hamburg',
      start: '07/2020',
      end: '12/2022',
      bullets: [
        'Designer im Cross-Functional-Team für die SaaS-Plattform (Logistik-Branche, Mid-Market)',
        'User Research vor Ort bei Kunden in DE und NL durchgeführt — Insights flossen direkt in das Roadmap-Planning',
        'Internes Pattern-Inventar konsolidiert: aus 180 Komponenten wurden 42 wiederverwendbare Bausteine',
      ],
    },
    {
      id: 'studio-koralle',
      role: 'UX/UI Designer',
      company: 'Studio Koralle',
      location: 'Hamburg',
      start: '10/2018',
      end: '06/2020',
      bullets: [
        'Kundenprojekte für E-Commerce-Brands (Mode, Wohnen) — End-to-End Design vom Konzept bis zum Web-Launch',
        'A/B-Tests konzipiert und mit dem Analytics-Team ausgewertet',
      ],
    },
  ],

  education: [
    {
      id: 'msc-haw',
      degree: 'M.Sc. Interaction Design',
      institution: 'HAW Hamburg',
      start: '2016',
      end: '2018',
    },
    {
      id: 'ba-fhp',
      degree: 'B.A. Kommunikationsdesign',
      institution: 'FH Potsdam',
      start: '2012',
      end: '2015',
    },
  ],

  skillGroups: [
    {
      label: 'Design',
      items: [
        'Produktdesign (B2B-SaaS, E-Commerce)',
        'Design Systems & Token-Architektur',
        'UX Research (qualitativ + quantitativ)',
        'Wireframing & Prototyping',
        'Accessibility (WCAG 2.2)',
      ],
    },
    {
      label: 'Tools',
      items: [
        'Figma (Variants, Tokens, Auto-Layout)',
        'Notion, Linear, Jira',
        'Maze, Lookback, Dovetail',
        'Adobe CC (Illustrator, Photoshop, After Effects)',
        'HTML/CSS, etwas React',
      ],
    },
    {
      label: 'Methoden',
      items: [
        'Dual-Track Agile (Discovery + Delivery)',
        'Jobs-to-Be-Done',
        'Usability Testing',
        'Service Blueprints',
        'Workshop-Facilitation (Design Sprint, Lightning Decision Jam)',
      ],
    },
  ],

  languages: [
    { language: 'Deutsch', level: 'Muttersprache' },
    { language: 'Englisch', level: 'Verhandlungssicher (C1)' },
    { language: 'Niederländisch', level: 'Konversation (B1)' },
  ],

  additionalExperience: [
    'Speakerin auf Design-Meetups (UX Hamburg, Friends of Figma)',
    'Mentorin im ADPList-Programm',
  ],

  labels: labelsDE,
};
