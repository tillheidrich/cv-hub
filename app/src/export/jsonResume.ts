// JSON Resume (jsonresume.org) import/export — deterministic mapping, NO AI.
// Standard schema for portability; non-standard fields round-trip via a custom
// `x_cvhub` block so nothing is lost.
import type { CVData } from '../data/types';
import { saveText } from './saveFile';

const v = (s?: string | null) => (s || '').trim();
let _id = 0;
const genId = () => `jr-${Date.now().toString(36)}-${(_id++).toString(36)}`;

export interface JsonResume {
  $schema?: string;
  basics?: any;
  work?: any[];
  education?: any[];
  skills?: any[];
  languages?: any[];
  meta?: any;
  x_cvhub?: { personal?: Record<string, string>; additional?: string[] };
  [k: string]: any;
}

/** CVData → JSON Resume object. */
export function cvToJsonResume(cv: CVData): JsonResume {
  const p = cv.personal;
  const profiles: any[] = [];
  for (const s of p.socials || []) if (v(s.value)) profiles.push({ network: v(s.platform), url: v(s.value) });
  if (v(p.linkedin)) profiles.push({ network: 'LinkedIn', url: v(p.linkedin) });

  // Non-standard personal fields kept for lossless round-trip.
  const xPersonal: Record<string, string> = {};
  for (const k of ['birthDate', 'birthPlace', 'nationality', 'maritalStatus', 'driversLicense', 'subtitle'] as const) {
    if (v((p as any)[k])) xPersonal[k] = v((p as any)[k]);
  }

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: v(p.name),
      label: v(p.title),
      email: v(p.email),
      phone: v(p.phone),
      url: v(p.website),
      summary: v(cv.profile?.text),
      location: v(p.location) ? { address: v(p.location) } : undefined,
      profiles,
    },
    work: (cv.experience || []).filter(e => !e.hidden).map(e => ({
      name: v(e.company),
      position: v(e.role),
      location: v(e.location),
      startDate: v(e.start),
      endDate: v(e.end),
      highlights: (e.bullets || []).map(v).filter(Boolean),
    })),
    education: (cv.education || []).map(e => ({
      institution: v(e.institution),
      area: v(e.degree),
      location: v(e.location),
      startDate: v(e.start),
      endDate: v(e.end),
      courses: v(e.notes) ? [v(e.notes)] : [],
    })),
    skills: (cv.skillGroups || []).map(g => ({ name: v(g.label), keywords: (g.items || []).map(v).filter(Boolean) })),
    languages: (cv.languages || []).map(l => ({ language: v(l.language), fluency: v(l.level) })),
    meta: { theme: 'cvhub', version: 'v1.0.0' },
    x_cvhub: {
      personal: Object.keys(xPersonal).length ? xPersonal : undefined,
      additional: (cv.additionalExperience || []).map(v).filter(Boolean),
    },
  };
}

/** JSON Resume object → CVData, using `base` for labels + untouched fields. */
export function jsonResumeToCv(jr: JsonResume, base: CVData): CVData {
  const b = jr.basics || {};
  const loc = b.location || {};
  const socials = (b.profiles || [])
    .filter((x: any) => v(x?.url) || v(x?.username))
    .map((x: any) => ({ platform: v(x.network).toLowerCase(), value: v(x.url) || v(x.username) }));
  const xp = jr.x_cvhub?.personal || {};

  return {
    ...base,
    personal: {
      ...base.personal,
      name: v(b.name) || base.personal.name,
      title: v(b.label),
      email: v(b.email),
      phone: v(b.phone),
      website: v(b.url),
      location: v(loc.address) || v(loc.city) || v(loc.region) || base.personal.location,
      socials,
      birthDate: v(xp.birthDate) || undefined,
      birthPlace: v(xp.birthPlace) || undefined,
      nationality: v(xp.nationality) || undefined,
      maritalStatus: v(xp.maritalStatus) || undefined,
      driversLicense: v(xp.driversLicense) || undefined,
    },
    profile: { text: v(b.summary) },
    experience: (jr.work || []).map((w: any) => ({
      id: genId(),
      role: v(w.position),
      company: v(w.name) || v(w.company),
      location: v(w.location),
      start: v(w.startDate),
      end: v(w.endDate),
      bullets: (w.highlights || []).map(v).filter(Boolean),
    })),
    education: (jr.education || []).map((e: any) => ({
      id: genId(),
      degree: v(e.area) || v(e.studyType),
      institution: v(e.institution),
      location: v(e.location),
      start: v(e.startDate),
      end: v(e.endDate),
      notes: (Array.isArray(e.courses) ? e.courses.map(v).filter(Boolean).join('; ') : '') || v(e.note),
    })),
    skillGroups: (jr.skills || []).map((s: any) => ({ label: v(s.name), items: (s.keywords || []).map(v).filter(Boolean) })),
    languages: (jr.languages || []).map((l: any) => ({ language: v(l.language), level: v(l.fluency) })),
    additionalExperience: (jr.x_cvhub?.additional || jr.x_additional || []).map(v).filter(Boolean),
    labels: base.labels,
  };
}

/** True if the parsed object looks like a JSON Resume (has a basics block). */
export function isJsonResume(o: any): boolean {
  return !!o && typeof o === 'object' && !!o.basics && typeof o.basics === 'object' && !o.data && !o.settings;
}

/** Build + download a JSON Resume file. */
export function exportJsonResume(cv: CVData): void {
  const jr = cvToJsonResume(cv);
  const name = (v(cv.personal?.name) || 'lebenslauf').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lebenslauf';
  saveText(`${name}.resume.json`, JSON.stringify(jr, null, 2), 'application/json');
}
