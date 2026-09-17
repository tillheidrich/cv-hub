/* Prüfstand für den LinkedIn-Import.
 *
 * Der Import läuft im Browser (jszip, File, TextDecoder). Diese Seite legt die
 * Funktion auf `window`, damit scripts/linkedincheck.mjs sie mit echten
 * Archiven füttern kann — inklusive der Fälle, an denen die erste Fassung
 * scheiterte: mehrzeilige Beschreibungen, Monatsnamen als Datum, ZIPs mit
 * Datendeskriptor. Nicht Teil der App.
 */
import { importLinkedIn, parseCSV, normalizeDate, splitBullets } from '../import/linkedinImport';
import { PERSONAS } from './personas';
import type { CVData } from '../data/types';

declare global {
  interface Window {
    __linkedin: (bytes: number[], name: string) => Promise<unknown>;
    __csv: typeof parseCSV;
    __datum: typeof normalizeDate;
    __bullets: typeof splitBullets;
  }
}

window.__csv = parseCSV;
window.__datum = normalizeDate;
window.__bullets = splitBullets;
window.__linkedin = async (bytes, name) => {
  const file = new File([new Uint8Array(bytes)], name);
  const basis = structuredClone(PERSONAS.marketing) as CVData;
  const b = await importLinkedIn(file, basis);
  return {
    gefunden: b.gefunden,
    hinweise: b.hinweise,
    name: b.cv.personal.name,
    title: b.cv.personal.title,
    email: b.cv.personal.email,
    phone: b.cv.personal.phone,
    location: b.cv.personal.location,
    stationen: b.cv.experience.map(e => ({ role: e.role, company: e.company, start: e.start, end: e.end, bullets: e.bullets })),
    ausbildung: b.cv.education.map(e => ({ degree: e.degree, institution: e.institution, start: e.start, end: e.end })),
    skills: b.cv.skillGroups[0]?.items ?? [],
    sprachen: b.cv.languages,
    fotoBleibt: b.cv.personal.photo === basis.personal.photo,
    profilBleibt: b.cv.profile?.text === basis.profile?.text,
  };
};
