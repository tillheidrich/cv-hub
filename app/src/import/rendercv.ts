/**
 * RenderCV-YAML: Lebenslauf als Code, in beide Richtungen.
 *
 * RenderCV (github.com/rendercv/rendercv, MIT) ist das verbreitete
 * „CV as code"-Werkzeug: eine YAML-Datei mit `cv:` (Kontakt und
 * `sections:`), daraus setzt es PDF, Markdown und HTML. Wer seinen
 * Lebenslauf so pflegt, soll ihn hier hereinholen und wieder hinausgeben
 * können, ohne abzutippen — Datenportabilität, deshalb ohne Pass.
 *
 * Form (docs.rendercv.com, „YAML input structure"): Abschnitte sind frei
 * benannte Schlüssel unter `cv.sections`, jeder Abschnitt ist eine Liste
 * EINER Eintragsart. Erkannt wird die Art an ihren Pflichtfeldern:
 *   ExperienceEntry  company + position     → Berufsweg (oder Ehrenamt)
 *   EducationEntry   institution (+ area)   → Ausbildung
 *   PublicationEntry title + authors        → Publikationen
 *   OneLineEntry     label + details        → Kenntnisse, Sprachen, Eckdaten
 *   BulletEntry      bullet                 → Weiteres / freier Abschnitt
 *   NormalEntry      name                   → Projekte, Zertifikate, frei
 *   TextEntry        reiner Text            → Profil
 * RenderCV erlaubt beliebige zusätzliche Schlüssel in Einträgen; der
 * Export legt dort ab, was RenderCV selbst nicht kennt (Rolle im Projekt,
 * Link, Aussteller), damit der Rückweg verlustfrei bleibt.
 *
 * Sicherheit: Die Bibliothek `yaml` liest mit dem Kernschema (keine Tags,
 * die Code oder Objekte erzeugen), höchstens 20 Anker-Verweise (gegen
 * Verweisbomben), doppelte Schlüssel sind ein Fehler. Danach wird Tiefe und
 * Knotenzahl begrenzt, und es werden nur Zeichenketten übernommen.
 */
import type { CVData, Lang, SocialPlatform } from '../data/types';
import { LABELS } from '../data/labels';
import {
  projectsOf, certificatesOf, volunteeringOf, publicationsOf, customSectionsOf, customItemsOf, customEntriesOf,
  bulletsOf, sectionHeading, linkHref,
} from '../data/extraSections';
import { listSocials, socialHref } from '../templates/ResumeRenderer';
import { skillsHeading } from '../templates/theme';
import { ImportRefused, MAX_IMPORT_BYTES, isOwnLatex, latexToCv, looksLikeLatex } from './latexImport';
import { exportFilename } from '../export/filename';
import { saveText } from '../export/saveFile';

type Obj = Record<string, unknown>;
const s = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').trim();
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// ── Daten ─────────────────────────────────────────────────────────────────────

/** Unser Datum („05/2022", „2017", „heute") in RenderCVs Form („2022-05",
 *  „2017", „present"). `null` = nicht umrechenbar, dann bleibt es Text. */
export function toRcDate(v: string, end = false): string | null {
  const t = (v || '').trim();
  if (!t) return end ? 'present' : null;
  if (/^(present|heute|aujourd’hui|aujourd'hui|actualidad|hoy|today|now)$/i.test(t)) return end ? 'present' : null;
  let m = /^(\d{1,2})[/.](\d{4})$/.exec(t);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(t)) return t;
  return null;
}

/** RenderCV-Datum in unsere Form („2022-05" → „05/2022"). */
export function fromRcDate(v: unknown): string {
  const t = s(v);
  if (/^present$/i.test(t)) return 'present';
  let m = /^(\d{4})-(\d{2})$/.exec(t);
  if (m) return `${m[2]}/${m[1]}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return t;
}

/** Zeitraum eines Eintrags: `start_date`/`end_date`, wenn beide Seiten
 *  umrechenbar sind, sonst `date` als Text („Sommer 2019 – heute"). */
function rcRange(start?: string, end?: string): Obj {
  const a = (start || '').trim(), b = (end || '').trim();
  if (!a && !b) return {};
  const ra = toRcDate(a), rb = toRcDate(b, true);
  if (ra && rb) return { start_date: ra, end_date: rb };
  if (!a && rb && b) return { date: fromRcDate(rb) === 'present' ? 'present' : rb };
  return { date: [a, b].filter(Boolean).join(' – ') };
}
function rcDate(v?: string): Obj {
  const t = (v || '').trim();
  if (!t) return {};
  return { date: toRcDate(t) ?? t };
}
function readRange(e: Obj): { start: string; end: string } {
  /* RenderCV schreibt leere Felder als `null` mit („start_date:" ohne
   * Wert) — gezählt wird, was Text trägt. */
  const a = s(e.start_date), b = s(e.end_date);
  if (a || b) return { start: a ? fromRcDate(a) : '', end: b ? fromRcDate(b) : '' };
  const d = s(e.date);
  if (!d) return { start: '', end: '' };
  const parts = d.split(/\s+[–—-]\s+/);
  if (parts.length === 2) return { start: fromRcDate(parts[0]), end: fromRcDate(parts[1]) };
  return { start: fromRcDate(d), end: '' };
}

/** „[Titel](https://…)" → Titel und Link. */
function unlink(v: unknown): { text: string; url: string } {
  const t = s(v);
  const m = /^\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t);
  return m ? { text: m[1], url: m[2] } : { text: t, url: '' };
}
/** Titel als Markdown-Link, wie RenderCV ihn setzt — nur für gewöhnliche
 *  http(s)-Adressen ohne Klammern und Leerzeichen; alles andere bleibt Text
 *  (die Adresse steht dann nur im Zusatzfeld `url`). */
const linked = (text: string, url?: string) => {
  const h = url && url.trim() ? linkHref(url) : '';
  return h && /^https?:\/\/[^\s()[\]<>]+$/i.test(h) && !/[[\]]/.test(text) ? `[${text}](${h})` : text;
};

/* Zusatzschlüssel (RenderCV erlaubt beliebige) müssen Text sein: RenderCV
 * setzt sie als Platzhalter in seine Vorlagen ein und bricht bei Listen ab
 * (geprüft mit rendercv 2.3). `entry_kind` sagt dem Rückweg, wohin ein
 * Eintrag gehört — unabhängig von der Überschrift. */
const KIND = 'entry_kind';

// ── Soziale Netze ─────────────────────────────────────────────────────────────

const RC_NETWORK: Partial<Record<SocialPlatform, string>> = {
  linkedin: 'LinkedIn', github: 'GitHub', instagram: 'Instagram', mastodon: 'Mastodon', youtube: 'YouTube', twitter: 'X', bluesky: 'Bluesky',
};
const FROM_NETWORK: Record<string, SocialPlatform> = {
  linkedin: 'linkedin', github: 'github', instagram: 'instagram', mastodon: 'mastodon', youtube: 'youtube', x: 'twitter', twitter: 'twitter', bluesky: 'bluesky',
};
const HOSTS: [RegExp, SocialPlatform][] = [
  [/linkedin\.com/i, 'linkedin'], [/github\.com/i, 'github'], [/xing\.com/i, 'xing'], [/(twitter|x)\.com/i, 'twitter'],
  [/bsky\.app/i, 'bluesky'], [/instagram\.com/i, 'instagram'], [/youtube\.com/i, 'youtube'], [/tiktok\.com/i, 'tiktok'],
  [/behance\.net/i, 'behance'], [/dribbble\.com/i, 'dribbble'], [/medium\.com/i, 'medium'], [/substack\.com/i, 'substack'],
];
const FA_ICON: Partial<Record<SocialPlatform, string>> = { xing: 'xing', tiktok: 'tiktok', behance: 'behance', dribbble: 'dribbble', medium: 'medium', substack: 'bookmark' };

/** Handle aus einem Profil-Link („linkedin.com/in/lena" → „lena"). */
function handleOf(value: string): string {
  const v = value.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
  if (!v.includes('/')) return v.replace(/^@/, '');
  const parts = v.split('/').filter(Boolean);
  const last = parts[parts.length - 1] ?? v;
  return last.replace(/^@/, '');
}

// ── Export ───────────────────────────────────────────────────────────────────

/** Lebenslauf als RenderCV-Dokument (JavaScript-Objekt). */
export function cvToRenderCv(cv: CVData): Obj {
  const p = cv.personal;
  const L = cv.labels;
  const out: Obj = {};
  if (p.name?.trim()) out.name = p.name.trim();
  if (p.title?.trim()) out.headline = p.title.trim();
  if (p.location?.trim()) out.location = p.location.replace(/\s*\n+\s*/g, ', ').trim();
  if (p.email?.trim()) out.email = p.email.trim();
  if (p.phone?.trim()) out.phone = p.phone.trim();
  if (p.website?.trim()) out.website = linkHref(p.website);
  const nets: Obj[] = [];
  const custom: Obj[] = [];
  for (const so of listSocials(p)) {
    if (!so.value.trim()) continue;
    const n = RC_NETWORK[so.platform];
    if (n) nets.push({ network: n, username: so.platform === 'mastodon' ? so.value.trim() : handleOf(so.value) });
    else custom.push({ placeholder: so.value.trim(), url: socialHref(so), fontawesome_icon: FA_ICON[so.platform] ?? 'link' });
  }
  if (nets.length) out.social_networks = nets;
  if (custom.length) out.custom_connections = custom;

  const sections: Obj = {};
  const add = (title: string, entries: unknown[]) => {
    if (!entries.length) return;
    let key = title.trim() || '—';
    for (let i = 2; key in sections; i++) key = `${title.trim() || '—'} (${i})`;
    sections[key] = entries;
  };
  if (cv.profile?.text?.trim()) add(L.sections.profile, [cv.profile.text.trim()]);
  const details = (['birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'driversLicense'] as const)
    .filter(k => p[k]?.trim()).map(k => ({ label: L.fields[k], details: p[k]!.trim(), [KIND]: `detail:${k}` }));
  add(L.sections.details, details);
  add(L.sections.experience, cv.experience.filter(e => !e.hidden).map(e => ({
    company: e.company, position: e.role, [KIND]: 'experience',
    ...(e.location?.trim() ? { location: e.location.trim() } : {}),
    ...rcRange(e.start, e.end),
    ...(e.bullets.filter(b => b.trim()).length ? { highlights: e.bullets.filter(b => b.trim()) } : {}),
  })));
  add(sectionHeading(L, 'projects'), projectsOf(cv).map(e => ({
    name: linked(e.title || '—', e.url), [KIND]: 'project', ...rcRange(e.start, e.end),
    ...(e.description?.trim() ? { summary: e.description.trim() } : {}),
    ...(bulletsOf(e).length ? { highlights: bulletsOf(e) } : {}),
    ...(e.role?.trim() ? { role: e.role.trim() } : {}),
    ...(e.url?.trim() ? { url: e.url.trim() } : {}),
  })));
  add(L.sections.education, cv.education.map(e => ({
    institution: e.institution, area: e.degree?.trim() || '—',
    ...(e.location?.trim() ? { location: e.location.trim() } : {}),
    ...rcRange(e.start, e.end),
    ...(e.notes?.trim() ? { summary: e.notes.trim() } : {}),
  })));
  add(sectionHeading(L, 'certificates'), certificatesOf(cv).map(c => ({
    name: linked(c.name || '—', c.url), [KIND]: 'certificate', ...rcDate(c.date),
    ...(c.issuer?.trim() || c.credentialId?.trim() ? { summary: [c.issuer, c.credentialId].map(x => (x || '').trim()).filter(Boolean).join(' · ') } : {}),
    ...(c.issuer?.trim() ? { issuer: c.issuer.trim() } : {}),
    ...(c.credentialId?.trim() ? { credential_id: c.credentialId.trim() } : {}),
    ...(c.url?.trim() ? { url: c.url.trim() } : {}),
  })));
  add(skillsHeading(L), cv.skillGroups.filter(g => g.items.some(i => i.trim())).map(g => {
    const items = g.items.filter(i => i.trim());
    /* Enthält ein Begriff selbst ein Komma („HubSpot (CRM, CMS)"), ginge
     * die Aufteilung beim Rückweg verloren — dann liegt die Liste
     * zusätzlich als JSON-Text bei. */
    return { label: g.label, details: items.join(', '), [KIND]: 'skills', ...(items.some(i => i.includes(',')) ? { items_json: JSON.stringify(items) } : {}) };
  }));
  add(L.sections.languages, cv.languages.map(l => ({
    label: l.language, details: l.level || '—', [KIND]: 'language', ...(typeof l.dots === 'number' ? { dots: String(l.dots) } : {}),
  })));
  add(sectionHeading(L, 'volunteering'), volunteeringOf(cv).map(v => ({
    company: v.organization, position: v.role, [KIND]: 'volunteering',
    ...(v.location?.trim() ? { location: v.location.trim() } : {}),
    ...rcRange(v.start, v.end),
    ...(bulletsOf(v).length ? { highlights: bulletsOf(v) } : {}),
  })));
  add(sectionHeading(L, 'publications'), publicationsOf(cv).map(pb => ({
    title: pb.title || '—', authors: [p.name?.trim() || '—'],
    ...(pb.publisher?.trim() ? { journal: pb.publisher.trim() } : {}),
    ...rcDate(pb.date),
    ...(pb.url?.trim() ? { url: linkHref(pb.url) } : {}),
    ...(pb.description?.trim() ? { description: pb.description.trim() } : {}),
  })));
  add(L.sections.additional, (cv.additionalExperience ?? []).filter(x => x.trim()).map(x => ({ bullet: x.trim(), [KIND]: 'additional' })));
  for (const cs of customSectionsOf(cv)) {
    const entries = customEntriesOf(cs);
    const items = customItemsOf(cs);
    if (entries.length) {
      add(cs.title, entries.map(e => ({
        name: e.title?.trim() || '—', [KIND]: 'custom', ...rcDate(e.date),
        ...(e.text?.trim() ? { summary: e.text.trim() } : {}),
        ...(e.subtitle?.trim() ? { subtitle: e.subtitle.trim() } : {}),
      })));
    }
    if (items.length) add(entries.length ? `${cs.title} ·` : cs.title, items.map(x => ({ bullet: x, [KIND]: 'custom' })));
  }
  out.sections = sections;
  return { cv: out, design: { theme: 'classic' } };
}

const YAML_HEAD: Record<Lang, string> = {
  de: '# Lebenslauf für RenderCV (github.com/rendercv/rendercv): rendercv render lebenslauf.yaml',
  en: '# CV for RenderCV (github.com/rendercv/rendercv): rendercv render cv.yaml',
  fr: '# CV pour RenderCV (github.com/rendercv/rendercv) : rendercv render cv.yaml',
  es: '# CV para RenderCV (github.com/rendercv/rendercv): rendercv render cv.yaml',
};

/** RenderCV-YAML als Text. `yaml` wird erst hier geladen — wer es nie
 *  braucht, lädt es nie. */
export async function buildRenderCvYaml(cv: CVData): Promise<string> {
  const YAML = await import('yaml');
  const lang = (cv.labels?.lang ?? 'de') as Lang;
  return `${YAML_HEAD[lang] ?? YAML_HEAD.de}\n${YAML.stringify(cvToRenderCv(cv), { lineWidth: 0 })}`;
}

export async function exportRenderCv(cv: CVData): Promise<void> {
  saveText(exportFilename('lebenslauf', cv.personal.name, 'yaml'), await buildRenderCvYaml(cv), 'application/yaml');
}

// ── Import ───────────────────────────────────────────────────────────────────

/** Sieht der Text nach RenderCV aus (Schlüssel `cv:` auf oberster Ebene)? */
export function isRenderCvYaml(text: string): boolean {
  return /^cv\s*:/m.test(text.slice(0, 200000));
}

const MAX_DEPTH = 12;
const MAX_NODES = 20000;
function checkShape(v: unknown, depth = 0, count = { n: 0 }): void {
  if (++count.n > MAX_NODES || depth > MAX_DEPTH) throw new ImportRefused('yaml');
  if (Array.isArray(v)) { for (const x of v) checkShape(x, depth + 1, count); return; }
  if (v && typeof v === 'object') { for (const x of Object.values(v)) checkShape(x, depth + 1, count); }
}

/** Überschriften in allen vier Sprachen plus den in RenderCV üblichen. */
const rx = (words: string[]) => new RegExp(`(${words.join('|')})`, 'i');
const IS = {
  volunteering: rx(['ehrenamt', 'volunt', 'bénévol', 'benevol', 'engagement']),
  languages: rx(['sprache', 'language', 'langue', 'idioma']),
  details: rx(['eckdaten', 'persönlich', 'personal', 'détails', 'informations', 'datos', 'details']),
  additional: rx(['weiteres', 'additional', 'divers', 'otros', 'sonstiges', 'misc']),
  projects: rx(['projekt', 'project', 'projet', 'proyecto']),
  certificates: rx(['zertifi', 'certif', 'lizenz', 'licen', 'nachweis', 'award', 'auszeichnung']),
};

type DetailKey = 'birthDate' | 'birthPlace' | 'maritalStatus' | 'nationality' | 'driversLicense';
function detailKeyOf(label: string): DetailKey | null {
  const l = label.trim().toLowerCase();
  for (const lang of Object.keys(LABELS) as Lang[]) {
    const f = LABELS[lang].fields;
    for (const k of ['birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'driversLicense'] as const) {
      if (f[k].toLowerCase() === l) return k;
    }
  }
  if (/geburtsdatum|date of birth|birth ?date|naissance|nacimiento/.test(l)) return 'birthDate';
  if (/führerschein|driv|permis|carnet|licen/.test(l)) return 'driversLicense';
  if (/staatsangeh|national|nacional/.test(l)) return 'nationality';
  return null;
}

let seq = 0;
const nid = (p: string) => `${p}-rc-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const strList = (v: unknown) => arr(v).map(s).filter(Boolean);

/** Liest RenderCV-YAML in die Felder des Lebenslaufs. `base` liefert die
 *  Beschriftungen der Zielsprache. */
export async function renderCvToCv(text: string, base: CVData): Promise<CVData> {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportRefused('too-large');
  const YAML = await import('yaml');
  let doc: unknown;
  try {
    doc = YAML.parse(text, { schema: 'core', maxAliasCount: 20, uniqueKeys: true, merge: false, prettyErrors: false, strict: true });
  } catch {
    throw new ImportRefused('yaml');
  }
  checkShape(doc);
  const c = obj(obj(doc).cv);
  if (!Object.keys(c).length) throw new ImportRefused('not-rendercv');

  const first = (v: unknown) => (Array.isArray(v) ? s(v[0]) : s(v));
  const cv: CVData = {
    personal: { name: s(c.name), title: s(c.headline), location: s(c.location), email: first(c.email), phone: first(c.phone) },
    profile: { text: '' },
    experience: [], education: [], skillGroups: [], languages: [],
    labels: base.labels,
  };
  const web = first(c.website);
  if (web) cv.personal.website = web;
  const socials: NonNullable<CVData['personal']['socials']> = [];
  const links: string[] = [];
  for (const n of arr(c.social_networks).map(obj)) {
    const net = s(n.network), user = s(n.username);
    if (!user) continue;
    // Nur eigene Schlüssel: „__proto__“/„constructor“ als Netzwerkname
    // lieferten sonst Object.prototype bzw. eine Funktion (Audit 10.10.2026, S6).
    const netKey = net.toLowerCase();
    const pf = Object.hasOwn(FROM_NETWORK, netKey) ? FROM_NETWORK[netKey] : undefined;
    if (pf) socials.push({ id: nid('soc'), platform: pf, value: user });
    else links.push(`${net}: ${user}`);
  }
  for (const n of arr(c.custom_connections).map(obj)) {
    const url = s(n.url), label = s(n.placeholder);
    const hit = HOSTS.find(([re]) => re.test(url));
    if (hit && url) socials.push({ id: nid('soc'), platform: hit[1], value: label && !/\s/.test(label) ? label : url });
    else if (!cv.personal.website && url) cv.personal.website = url;
    else if (label || url) links.push([label, url].filter(Boolean).join(' · '));
  }
  if (socials.length) cv.personal.socials = socials;

  const custom: NonNullable<CVData['customSections']> = [];
  const profileTexts: string[] = [];
  for (const [rawTitle, rawEntries] of Object.entries(obj(c.sections))) {
    /* RenderCV zeigt „selected_honors" als „Selected Honors"; so wird es
     * auch hier zur Überschrift. Frei geschriebene Titel bleiben, wie sie sind. */
    const title = /^[a-z0-9_]+$/.test(rawTitle)
      ? rawTitle.split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
      : rawTitle;
    const entries = arr(rawEntries);
    if (!entries.length) continue;
    const head = entries[0];
    const kind = typeof head === 'string' ? 'text' : (() => {
      const e = obj(head);
      if ('company' in e && 'position' in e) return 'exp';
      if ('institution' in e) return 'edu';
      if ('title' in e && 'authors' in e) return 'pub';
      if ('label' in e && 'details' in e) return 'oneline';
      if ('bullet' in e) return 'bullet';
      if ('number' in e || 'reversed_number' in e) return 'numbered';
      if ('name' in e) return 'normal';
      return 'unknown';
    })();
    const os = entries.map(obj);
    /* Unsere eigenen Exporte sagen, wohin ein Eintrag gehört; fremde
     * Dateien werden an Überschrift und Eintragsart erkannt. */
    const mark = s(obj(head)[KIND]);
    if (kind === 'text') {
      const texts = entries.map(s).filter(Boolean);
      if (!profileTexts.length && !cv.profile.text) profileTexts.push(...texts);
      else custom.push({ id: nid('sec'), title, entries: texts.map(t => ({ id: nid('ent'), text: t })) });
    } else if (kind === 'exp') {
      const isVol = mark ? mark === 'volunteering' : IS.volunteering.test(title);
      for (const e of os) {
        const { start, end } = readRange(e);
        const bullets = strList(e.highlights);
        const summary = s(e.summary);
        if (isVol) {
          const v: NonNullable<CVData['volunteering']>[number] = { id: nid('vol'), role: s(e.position), organization: s(e.company) };
          if (s(e.location)) v.location = s(e.location);
          if (start) v.start = start;
          if (end) v.end = end;
          const b = summary ? [summary, ...bullets] : bullets;
          if (b.length) v.bullets = b;
          (cv.volunteering ??= []).push(v);
        } else {
          cv.experience.push({
            id: nid('exp'), role: s(e.position), company: s(e.company), location: s(e.location),
            start, end, bullets: summary ? [summary, ...bullets] : bullets,
          });
        }
      }
    } else if (kind === 'edu') {
      for (const e of os) {
        const { start, end } = readRange(e);
        const area = s(e.area) === '—' ? '' : s(e.area);
        const degree = [s(e.degree), area].filter(Boolean).join(' ');
        const x: CVData['education'][number] = { id: nid('edu'), degree, institution: s(e.institution), start, end };
        if (s(e.location)) x.location = s(e.location);
        const notes = [s(e.summary), ...strList(e.highlights)].filter(Boolean).join('\n');
        if (notes) x.notes = notes;
        cv.education.push(x);
      }
    } else if (kind === 'pub') {
      for (const e of os) {
        const x: NonNullable<CVData['publications']>[number] = { id: nid('pub'), title: s(e.title) === '—' ? '' : s(e.title) };
        const journal = s(e.journal);
        if (journal) x.publisher = journal;
        if (s(e.date)) x.date = fromRcDate(e.date);
        const url = s(e.url) || (s(e.doi) ? `https://doi.org/${s(e.doi)}` : '');
        if (url) x.url = url;
        const d = s(e.description) || s(e.summary);
        if (d) x.description = d;
        (cv.publications ??= []).push(x);
      }
    } else if (kind === 'oneline') {
      if (mark ? mark === 'language' : IS.languages.test(title)) {
        for (const e of os) {
          const l: CVData['languages'][number] = { language: s(e.label), level: s(e.details) === '—' ? '' : s(e.details) };
          const dots = Number(s(e.dots));
          if (s(e.dots) && Number.isFinite(dots)) l.dots = Math.max(1, Math.min(5, Math.round(dots)));
          cv.languages.push(l);
        }
      } else if (mark.startsWith('detail:') || (!mark && IS.details.test(title) && os.every(e => detailKeyOf(s(e.label))))) {
        for (const e of os) {
          const m = /^detail:(birthDate|birthPlace|maritalStatus|nationality|driversLicense)$/.exec(s(e[KIND]));
          const k = m ? m[1] as DetailKey : detailKeyOf(s(e.label));
          if (k) cv.personal[k] = s(e.details);
        }
      } else {
        for (const e of os) {
          let items = s(e.details).split(/\s*,\s*/).filter(Boolean);
          if (s(e.items_json)) {
            try { const j = JSON.parse(s(e.items_json)); if (Array.isArray(j)) items = j.map(s).filter(Boolean); } catch { /* bleibt bei details */ }
          }
          cv.skillGroups.push({ label: s(e.label), items });
        }
      }
    } else if (kind === 'bullet' || kind === 'numbered') {
      const items = os.map(e => s(e.bullet) || s(e.number) || s(e.reversed_number)).filter(Boolean);
      if (kind === 'bullet' && (mark ? mark === 'additional' : IS.additional.test(title))) cv.additionalExperience = [...(cv.additionalExperience ?? []), ...items];
      else {
        /* Der Export legt Stichpunkte eines freien Abschnitts mit Einträgen
         * unter „Titel ·" ab — beim Lesen gehören sie wieder dazu. */
        const owner = title.endsWith(' ·') ? custom.find(x => x.title === title.slice(0, -2)) : undefined;
        if (owner) owner.items = [...(owner.items ?? []), ...items];
        else custom.push({ id: nid('sec'), title, items });
      }
    } else if (kind === 'normal') {
      if (mark ? mark === 'project' : IS.projects.test(title)) {
        for (const e of os) {
          const { text, url } = unlink(e.name);
          const { start, end } = readRange(e);
          const x: NonNullable<CVData['projects']>[number] = { id: nid('prj'), title: text === '—' ? '' : text };
          if (s(e.role)) x.role = s(e.role);
          if (start) x.start = start;
          if (end) x.end = end;
          const u = s(e.url) || url;
          if (u) x.url = u;
          if (s(e.summary)) x.description = s(e.summary);
          const b = strList(e.highlights);
          if (b.length) x.bullets = b;
          (cv.projects ??= []).push(x);
        }
      } else if (mark ? mark === 'certificate' : IS.certificates.test(title)) {
        for (const e of os) {
          const { text, url } = unlink(e.name);
          const x: NonNullable<CVData['certificates']>[number] = { id: nid('cert'), name: text === '—' ? '' : text };
          const issuer = s(e.issuer) || (s(e.credential_id) ? '' : s(e.summary));
          if (issuer) x.issuer = issuer;
          if (s(e.date)) x.date = fromRcDate(e.date);
          if (s(e.credential_id)) x.credentialId = s(e.credential_id);
          const u = s(e.url) || url;
          if (u) x.url = u;
          (cv.certificates ??= []).push(x);
        }
      } else {
        custom.push({
          id: nid('sec'), title,
          entries: os.map(e => {
            const y: NonNullable<NonNullable<CVData['customSections']>[number]['entries']>[number] = { id: nid('ent') };
            const name = unlink(e.name).text;
            if (name && name !== '—') y.title = name;
            const sub = s(e.subtitle) || s(e.location);
            if (sub) y.subtitle = sub;
            const { start, end } = readRange(e);
            const d = [start, end].filter(Boolean).join(' – ');
            if (d) y.date = d;
            const txt = [s(e.summary), ...strList(e.highlights)].filter(Boolean).join('\n');
            if (txt) y.text = txt;
            return y;
          }),
        });
      }
    }
  }
  cv.profile.text = profileTexts.join('\n\n');
  if (links.length) custom.push({ id: nid('sec'), title: 'Links', items: links });
  if (custom.length) cv.customSections = custom;
  if (!cv.personal.name && !cv.experience.length && !cv.education.length) throw new ImportRefused('not-rendercv');
  return cv;
}

// ── Ein Eingang für beides ───────────────────────────────────────────────────

/**
 * Einstieg für den Import-Weg (HomeScreen `readImport`, Export-Paneel):
 * .tex aus diesem Werkzeug oder RenderCV-YAML. `null` = keine dieser
 * Dateiarten, dann prüft der Aufrufer die übrigen Wege. Wirft
 * `ImportRefused`, wenn die Art erkannt, der Inhalt aber nicht lesbar ist.
 */
export async function readCodeImport(fileName: string, text: string, base: CVData): Promise<{ cv: CVData; what: string } | null> {
  const name = (fileName || '').toLowerCase();
  if (name.endsWith('.tex') || isOwnLatex(text) || (looksLikeLatex(text) && !name.endsWith('.md'))) {
    return { cv: latexToCv(text, base), what: 'LaTeX' };
  }
  if (name.endsWith('.yaml') || name.endsWith('.yml') || (!name.endsWith('.md') && isRenderCvYaml(text))) {
    return { cv: await renderCvToCv(text, base), what: 'RenderCV' };
  }
  return null;
}

export { ImportRefused };
