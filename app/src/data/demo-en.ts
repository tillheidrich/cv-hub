import type { CVData } from './types';
import { labelsEN } from './labels';
import { DEMO_PHOTO, DEMO_PHOTO_ORIGINAL } from './demo-de';

/* Demo photo: same files as the German variant, source and licence in demo-de.ts. */

/** Fictional demo persona — English variant. See demo-de.ts for context. */
export const demoEN: CVData = {
  personal: {
    name: 'Lena Brandt',
    title: 'Senior Product Designer',
    subtitle: 'Product Design · Design Systems · UX Research',
    location: 'Hamburg, Germany',
    email: 'lena.brandt@example.com',
    phone: '+49 30 23125 789',
    website: 'lena-brandt.example',
    linkedin: 'linkedin.com/in/lena-brandt-beispiel',
    instagram: '',
    birthDate: '14 March 1991',
    driversLicense: 'Class B',
    photo: DEMO_PHOTO,
    photoOriginal: DEMO_PHOTO_ORIGINAL,
  },

  profile: {
    text: 'Senior product designer with seven years of experience across B2B SaaS and e-commerce. I focus on scalable design systems, research-driven product work and close collaboration with engineering — from the first wireframe to the shipped feature.',
  },

  experience: [
    {
      id: 'nordhub',
      role: 'Senior Product Designer',
      company: 'Nordhub GmbH',
      location: 'Hamburg',
      start: '01/2023',
      end: 'today',
      bullets: [
        'Owner of the design system (Figma + tokens) rolled out across four product areas',
        'Led discovery and delivery for three core features — from user interviews to hi-fi specs',
        'Reworked the onboarding flow; analytics team reported a clear day-7 activation lift',
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
        'Designer in a cross-functional team for the SaaS platform (logistics, mid-market)',
        'Ran on-site user research with customers in DE and NL — findings fed directly into roadmap planning',
        'Consolidated the internal pattern inventory from 180 components to 42 reusable building blocks',
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
        'Client work for e-commerce brands (fashion, home) — end-to-end design from concept to web launch',
        'Designed and analyzed A/B tests in partnership with the analytics team',
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
      degree: 'B.A. Communication Design',
      institution: 'FH Potsdam',
      start: '2012',
      end: '2015',
    },
  ],

  skillGroups: [
    {
      label: 'Design',
      items: [
        'Product design (B2B SaaS, e-commerce)',
        'Design systems & token architecture',
        'UX research (qualitative + quantitative)',
        'Wireframing & prototyping',
        'Accessibility (WCAG 2.2)',
      ],
    },
    {
      label: 'Tools',
      items: [
        'Figma (variants, tokens, auto-layout)',
        'Notion, Linear, Jira',
        'Maze, Lookback, Dovetail',
        'Adobe CC (Illustrator, Photoshop, After Effects)',
        'HTML/CSS, some React',
      ],
    },
    {
      label: 'Methods',
      items: [
        'Dual-track agile (discovery + delivery)',
        'Jobs-to-be-Done',
        'Usability testing',
        'Service blueprints',
        'Workshop facilitation (Design Sprint, Lightning Decision Jam)',
      ],
    },
  ],

  languages: [
    { language: 'German', level: 'Native' },
    { language: 'English', level: 'Fluent (C1)' },
    { language: 'Dutch', level: 'Conversational (B1)' },
  ],

  additionalExperience: [
    'Speaker at design meetups (UX Hamburg, Friends of Figma)',
    'Mentor in the ADPList programme',
  ],

  labels: labelsEN,
};
