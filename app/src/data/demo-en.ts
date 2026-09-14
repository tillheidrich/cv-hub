import type { CVData } from './types';
import { labelsEN } from './labels';

/** Siehe demo-de.ts — neutraler Platzhalter statt fremdgehostetem Foto. */
const PLACEHOLDER_PHOTO = 'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20300%20400%22%20width%3D%22300%22%20height%3D%22400%22%3E%3Crect%20width%3D%22300%22%20height%3D%22400%22%20fill%3D%22%23e7e2d9%22%2F%3E%3Ccircle%20cx%3D%22150%22%20cy%3D%22152%22%20r%3D%2262%22%20fill%3D%22%23cfc7ba%22%2F%3E%3Cpath%20d%3D%22M150%20232c-58%200-104%2038-112%2092h224c-8-54-54-92-112-92z%22%20fill%3D%22%23cfc7ba%22%2F%3E%3Ctext%20x%3D%22150%22%20y%3D%22372%22%20font-family%3D%22Inter%2C%20system-ui%2C%20sans-serif%22%20font-size%3D%2218%22%20fill%3D%22%238d8577%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%222%22%3EFOTO%3C%2Ftext%3E%3C%2Fsvg%3E';

/** Fictional demo persona — English variant. See demo-de.ts for context. */
export const demoEN: CVData = {
  personal: {
    name: 'Lena Brandt',
    title: 'Senior Product Designer',
    subtitle: 'Product Design · Design Systems · UX Research',
    location: 'Hamburg, Germany',
    email: 'lena.brandt@example.com',
    phone: '+49 151 23456789',
    website: 'lenabrandt.design',
    linkedin: 'linkedin.com/in/lena-brandt',
    instagram: '',
    birthDate: '14 March 1991',
    driversLicense: 'Class B',
    photo: PLACEHOLDER_PHOTO,
  },

  profile: {
    text: 'Senior product designer with seven years of experience across B2B SaaS and e-commerce. I focus on scalable design systems, research-driven product work, and close collaboration with engineering. I take products from the first wireframe through to shipped feature and can navigate equally well between C-level stakeholders and frontend teams.',
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
        'Established a design-review format with engineering that halved iteration time',
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
        'Drove the tool migration from Sketch to Figma, including library setup',
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
        'Built style guides and component documentation for three clients',
      ],
    },
    {
      id: 'pilz',
      role: 'Junior UX Designer (Internship)',
      company: 'Pilz Digital',
      location: 'Berlin',
      start: '04/2018',
      end: '09/2018',
      bullets: [
        'Wireframes and prototypes for internal tools for a healthtech client',
        'Moderated on-site usability tests with end users',
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
    {
      label: 'Soft skills',
      items: [
        'Clear communication with engineering and product',
        'C-level stakeholder management',
        'Mentoring junior designers',
        'Hands-on and decisive',
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
    'Active in the local AIGA chapter',
  ],

  labels: labelsEN,
};
