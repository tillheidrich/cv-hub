import type { CVData } from './types';
import { labelsDE } from './labels';

/**
 * Fictional demo persona. Not a real person.
 * Purpose: show off the template + editor without dragging the maintainer's
 * real CV into every new account.
 *
 * Portrait: Unsplash (free-to-use license, no attribution required for
 * embedding — we link the canonical Unsplash URL so it stays cacheable
 * by their CDN).
 */
export const demoDE: CVData = {
  personal: {
    name: 'Lena Brandt',
    title: 'Senior Product Designer',
    subtitle: 'Produktdesign · Design Systems · UX Research',
    location: 'Lange Reihe 24, 20099 Hamburg',
    email: 'lena.brandt@example.com',
    phone: '+49 151 23456789',
    website: 'lenabrandt.design',
    linkedin: 'linkedin.com/in/lena-brandt',
    instagram: '',
    birthDate: '14. März 1991',
    driversLicense: 'Klasse B',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=85&fit=crop&crop=faces',
  },

  profile: {
    text: 'Senior Product Designer mit sieben Jahren Erfahrung in B2B-SaaS und E-Commerce. Schwerpunkte: skalierbare Design Systems, Research-getriebene Produktentwicklung und enge Zusammenarbeit mit Engineering. Bringt Produkte vom ersten Wireframe bis zum produktiven Feature und kann gleichermaßen mit Stakeholdern auf C-Level wie mit Frontend-Teams reden.',
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
        'Design-Review-Format mit Engineering etabliert, das Iterationszeiten halbiert hat',
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
        'Migration des Design-Tool-Stacks von Sketch nach Figma verantwortet inkl. Library-Setup',
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
        'Style Guides und Komponenten-Dokumentationen für drei Kunden aufgebaut',
      ],
    },
    {
      id: 'praktikum-pilz',
      role: 'Junior UX Designer (Praktikum)',
      company: 'Pilz Digital',
      location: 'Berlin',
      start: '04/2018',
      end: '09/2018',
      bullets: [
        'Wireframes und Prototypen für interne Tools im Auftrag eines Healthtech-Kunden',
        'Usability-Tests mit Endnutzer:innen vor Ort moderiert',
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
    {
      label: 'Soft Skills',
      items: [
        'Klare Kommunikation mit Engineering und Product',
        'Stakeholder-Management auf C-Level',
        'Mentoring von Junior-Designer:innen',
        'Hands-on und entscheidungsfreudig',
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
    'Aktiv im AIGA-Local-Chapter',
  ],

  labels: labelsDE,
};
