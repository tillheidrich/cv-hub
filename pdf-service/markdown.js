// Two-way Markdown bridge for CV profiles.
// cvToMarkdown(profile) → string for an AI to read
// markdownToCV(md, existingProfile) → updated profile to write back

function val(s) { return (s ?? '').toString().trim(); }
function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
/** Bounds an incoming string to N chars after trimming. Protects every parsed
 *  personal-info / contact field from arbitrary-length LLM output that could
 *  bloat the JSONB column or break templates. (Security audit finding #9.) */
function clipField(s, max = 240) {
  const str = (s ?? '').toString().trim();
  return str.length > max ? str.slice(0, max) : str;
}

/** Strip leading/trailing bold (**) and italic (*) markers from a heading.
 *  Many LLMs emit `### **Senior Engineer**` for role titles — without this
 *  helper the asterisks ended up in the displayed CV. */
function stripMd(s) {
  return (s ?? '').toString()
    .trim()
    .replace(/^\*\*(.*)\*\*$/, '$1')
    .replace(/^\*(.*)\*$/, '$1')
    .replace(/^_(.*)_$/, '$1')
    .trim();
}

const KNOWN_SOCIALS = ['linkedin','github','xing','twitter','x','bluesky','mastodon','instagram','youtube','tiktok','behance','dribbble','medium','substack'];
function normalisePlatform(k) {
  const lower = k.toLowerCase();
  if (lower === 'x') return 'twitter';
  return KNOWN_SOCIALS.includes(lower) ? lower : null;
}

export function cvToMarkdown(profile, targetLang) {
  // targetLang erlaubt, eine ANDERE Sprachfassung zu lesen als die gerade
  // eingestellte. Ohne das kommt man über die Brücke nur an die aktive
  // Sprache heran — und genau so bleiben fremdsprachige Fassungen mit
  // Demo-Inhalt stehen, ohne dass es jemand merkt.
  const lang = (targetLang && profile?.data?.[targetLang]) ? targetLang : (profile?.settings?.lang || 'de');
  const cv = profile?.data?.[lang];
  if (!cv) return '';
  const out = [];

  out.push('---');
  out.push(`template: ${profile.settings?.template || 'hamburg'}`);
  out.push(`lang: ${lang}`);
  out.push(`fontScale: ${profile.settings?.fontScale ?? 1.0}`);
  out.push(`fontPairing: ${profile.settings?.fontPairing || 'auto'}`);
  out.push(`pageMode: ${profile.settings?.pageMode || 'one'}`);
  out.push('---');
  out.push('');

  const p = cv.personal || {};
  out.push(`# ${val(p.name)}`);
  if (val(p.title)) out.push(`**${val(p.title)}**`);
  out.push('');

  out.push('## Kontakt');
  if (val(p.email)) out.push(`- E-Mail: ${val(p.email)}`);
  if (val(p.phone)) out.push(`- Telefon: ${val(p.phone)}`);
  if (val(p.location)) out.push(`- Ort: ${val(p.location)}`);
  if (val(p.website)) out.push(`- Website: ${val(p.website)}`);
  // Socials — emit both the new list and the legacy fields if present
  if (Array.isArray(p.socials)) {
    for (const s of p.socials) {
      if (val(s.value)) out.push(`- ${capitalize(s.platform)}: ${val(s.value)}`);
    }
  }
  if (val(p.linkedin)) out.push(`- LinkedIn: ${val(p.linkedin)}`);
  if (val(p.instagram)) out.push(`- Instagram: ${val(p.instagram)}`);
  if (val(p.birthDate)) out.push(`- Geburtsdatum: ${val(p.birthDate)}`);
  if (val(p.driversLicense)) out.push(`- Führerschein: ${val(p.driversLicense)}`);
  if (val(p.nationality)) out.push(`- Staatsangehörigkeit: ${val(p.nationality)}`);
  if (val(p.maritalStatus)) out.push(`- Familienstand: ${val(p.maritalStatus)}`);
  out.push('');

  if (val(cv.profile?.text)) {
    out.push('## Profil');
    out.push(val(cv.profile.text));
    out.push('');
  }

  if (Array.isArray(cv.experience) && cv.experience.length) {
    out.push('## Berufserfahrung');
    out.push('');
    for (const e of cv.experience) {
      if (e.hidden) continue;
      out.push(`### ${val(e.role)}`);
      const dates = `${val(e.start)} – ${val(e.end)}`.trim();
      const meta = [val(e.company), val(e.location), dates !== '–' ? dates : ''].filter(Boolean).join(' · ');
      if (meta) out.push(meta);
      for (const b of (e.bullets || [])) if (val(b)) out.push(`- ${val(b)}`);
      out.push('');
    }
  }

  if (Array.isArray(cv.education) && cv.education.length) {
    out.push('## Ausbildung');
    out.push('');
    for (const e of cv.education) {
      out.push(`### ${val(e.degree)}`);
      const dates = `${val(e.start)} – ${val(e.end)}`.trim();
      const meta = [val(e.institution), val(e.location), dates !== '–' ? dates : ''].filter(Boolean).join(' · ');
      if (meta) out.push(meta);
      if (val(e.notes)) out.push(val(e.notes));
      out.push('');
    }
  }

  if (Array.isArray(cv.skillGroups) && cv.skillGroups.length) {
    out.push('## Skills');
    out.push('');
    for (const g of cv.skillGroups) {
      out.push(`### ${val(g.label)}`);
      for (const item of (g.items || [])) if (val(item)) out.push(`- ${val(item)}`);
      out.push('');
    }
  }

  if (Array.isArray(cv.languages) && cv.languages.length) {
    out.push('## Sprachen');
    for (const l of cv.languages) {
      // Dot scale gets emitted as a trailing "(N/5)" so the round-trip
      // through an LLM editor preserves the visual rating. The parser
      // strips that suffix back out and writes it to l.dots.
      const suffix = (typeof l.dots === 'number' && l.dots >= 1 && l.dots <= 5) ? ` (${l.dots}/5)` : '';
      out.push(`- ${val(l.language)} — ${val(l.level)}${suffix}`);
    }
    out.push('');
  }

  if (Array.isArray(cv.additionalExperience) && cv.additionalExperience.length) {
    out.push('## Weiteres');
    for (const item of cv.additionalExperience) if (val(item)) out.push(`- ${val(item)}`);
    out.push('');
  }

  out.push(...extraSectionsToMarkdown(cv));

  return out.join('\n');
}

// ── Eigene Abschnitte (seit 09.10.2026) ─────────────────────────────────────
//
// Projekte, Zertifikate, Ehrenamt, Publikationen und freie Abschnitte. Das
// Format ist mit app/src/export/exportMarkdown.ts (Schreiben im Browser) und
// app/src/import/markdownBridge.ts (Lesen im Browser) Zeichen für Zeichen
// gleich — wer hier etwas ändert, ändert alle drei. Geprüft in
// markdown.test.mjs und app/scripts/sectionsroundtrip.mjs.
//
//   ## Projekte                 ## Zertifikate         ## Ehrenamt
//   ### Titel                   ### Name               ### Rolle
//   Rolle: …                    Aussteller: …          Verein · Ort · 2018 – heute
//   Zeitraum: 03/2023 – 11/2023 Datum: …               - Stichpunkt
//   Link: …                     Kennung: …
//   Beschreibung als Absatz     Link: …                ## Publikationen
//   - Stichpunkt                                       ### Titel
//                                                      Verlag: … / Datum: … / Link: …
//   ## Abschnitt: Eigene Überschrift                   Beschreibung als Absatz
//   - reiner Stichpunkt
//   ### Eintrag (darf leer sein: „###")
//   Untertitel: … / Datum: …
//   Text als Absatz
//
// Feldzeilen haben feste deutsche Schlüssel wie im Kontaktblock: sie sind
// Schlüssel für den Parser, keine Beschriftung. Gelesen werden auch die
// englischen (Role, Period, Issuer, Date, ID, Publisher, Subtitle).
// Leere Felder fallen weg; ein Eintrag ohne Titel steht als „###" da, damit
// er beim Zurücklesen nicht im vorigen aufgeht.

const isArr = Array.isArray;
const extraList = v => (isArr(v) ? v.filter(x => x && typeof x === 'object') : []);
const extraLines = v => (isArr(v) ? v.map(val).filter(Boolean) : []);
/** Zeitraum so, dass Anfang und Ende auch einzeln wieder lesbar sind. */
function periodLine(start, end) {
  const a = val(start), b = val(end);
  if (!a && !b) return '';
  return `Zeitraum: ${[a, '–', b].filter(Boolean).join(' ')}`;
}

export function extraSectionsToMarkdown(cv) {
  const out = [];
  const heading = t => out.push(t ? `### ${t}` : '###');
  const field = (k, v) => { if (val(v)) out.push(`${k}: ${val(v)}`); };
  const text = v => { if (val(v)) out.push(val(v)); };
  const bullets = v => { for (const b of extraLines(v)) out.push(`- ${b}`); };

  const projects = extraList(cv.projects).filter(p => val(p.title) || val(p.role) || val(p.description) || val(p.url) || extraLines(p.bullets).length);
  if (projects.length) {
    out.push('## Projekte', '');
    for (const p of projects) {
      heading(val(p.title));
      field('Rolle', p.role);
      const per = periodLine(p.start, p.end); if (per) out.push(per);
      field('Link', p.url);
      text(p.description);
      bullets(p.bullets);
      out.push('');
    }
  }

  const certs = extraList(cv.certificates).filter(c => val(c.name) || val(c.issuer) || val(c.credentialId) || val(c.url));
  if (certs.length) {
    out.push('## Zertifikate', '');
    for (const c of certs) {
      heading(val(c.name));
      field('Aussteller', c.issuer);
      field('Datum', c.date);
      field('Kennung', c.credentialId);
      field('Link', c.url);
      out.push('');
    }
  }

  const vols = extraList(cv.volunteering).filter(v => val(v.role) || val(v.organization) || extraLines(v.bullets).length);
  if (vols.length) {
    out.push('## Ehrenamt', '');
    for (const v of vols) {
      heading(val(v.role));
      const dates = (val(v.start) || val(v.end)) ? `${val(v.start)} – ${val(v.end)}`.trim() : '';
      const meta = [val(v.organization), val(v.location), dates].filter(Boolean).join(' · ');
      if (meta) out.push(meta);
      bullets(v.bullets);
      out.push('');
    }
  }

  const pubs = extraList(cv.publications).filter(p => val(p.title) || val(p.publisher) || val(p.url) || val(p.description));
  if (pubs.length) {
    out.push('## Publikationen', '');
    for (const p of pubs) {
      heading(val(p.title));
      field('Verlag', p.publisher);
      field('Datum', p.date);
      field('Link', p.url);
      text(p.description);
      out.push('');
    }
  }

  for (const c of extraList(cv.customSections)) {
    const items = extraLines(c.items);
    const entries = extraList(c.entries).filter(e => val(e.title) || val(e.subtitle) || val(e.text));
    if (!items.length && !entries.length) continue;
    out.push(`## Abschnitt: ${val(c.title)}`.trimEnd());
    for (const it of items) out.push(`- ${it}`);
    out.push('');
    for (const e of entries) {
      heading(val(e.title));
      field('Untertitel', e.subtitle);
      field('Datum', e.date);
      text(e.text);
      out.push('');
    }
  }
  return out;
}

/** Abschnittsart der eigenen Abschnitte — oder null. Vor den übrigen
 *  Abschnitten geprüft: „Volunteer experience" ist kein Berufsweg. */
export function extraSectionOf(title) {
  const t = val(title).toLowerCase();
  if (/^(abschnitt|section)\s*:/.test(t)) return 'custom';
  if (/^(projekte?|projects?)\b/.test(t)) return 'projects';
  if (/zertifikat|certific/.test(t)) return 'certificates';
  if (/ehrenamt|volunteer/.test(t)) return 'volunteering';
  if (/publikation|publication|veröffentlichung/.test(t)) return 'publications';
  return null;
}

const FIELD_RE = /^(rolle|role|zeitraum|period|dates?|link|url|aussteller|issuer|datum|kennung|id|credential(?:\s*id)?|verlag|publisher|ort\/verlag|untertitel|subtitle)\s*:\s*(.*)$/i;
const FIELD_KEY = {
  rolle: 'role', role: 'role', zeitraum: 'period', period: 'period', date: 'date', dates: 'period',
  link: 'url', url: 'url', aussteller: 'issuer', issuer: 'issuer', datum: 'date',
  kennung: 'credentialId', id: 'credentialId', credential: 'credentialId', 'credential id': 'credentialId', credentialid: 'credentialId',
  verlag: 'publisher', publisher: 'publisher', 'ort/verlag': 'publisher', untertitel: 'subtitle', subtitle: 'subtitle',
};
/** Welche Feldzeilen in welchem Abschnitt Felder sind — alles andere ist Text. */
const FIELDS_IN = {
  projects: ['role', 'period', 'url'],
  certificates: ['issuer', 'date', 'credentialId', 'url'],
  publications: ['publisher', 'date', 'url'],
  custom: ['subtitle', 'date'],
  volunteering: [],
};
function splitPeriod(v) {
  const m = val(v).match(/^(.*?)\s*(?:[–—]|\s-\s)\s*(.*)$/) || val(v).match(/^(.*?)\s*[–—-]\s*$/);
  if (!m) return { start: val(v), end: '' };
  return { start: val(m[1]), end: val(m[2] ?? '') };
}

/**
 * Parser für die eigenen Abschnitte. Bekommt die Zeilen EINES Abschnitts
 * (ohne die `##`-Zeile) und hängt das Ergebnis an `cv`. `uid` liefert Kennungen.
 */
export function parseExtraSection(kind, title, sectionLines, cv, uid) {
  const SHORT = 240, LONG = 2000;
  const entries = [];
  let cur = null;
  const items = [];
  const flush = () => { if (cur) { cur.text = cur.textLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(); entries.push(cur); cur = null; } };
  for (let i = 0; i < sectionLines.length; i++) {
    const t = sectionLines[i].trim();
    if (/^###(\s|$)/.test(t)) {
      flush();
      cur = { title: clipField(stripMd(t.slice(3)), SHORT), fields: {}, textLines: [], bullets: [], meta: null };
      if (kind === 'volunteering') {
        let j = i + 1;
        while (j < sectionLines.length && !sectionLines[j].trim()) j++;
        const nxt = (sectionLines[j] || '').trim();
        if (j < sectionLines.length && nxt && !/^[-*+]\s/.test(nxt) && !nxt.startsWith('#')) { cur.meta = stripMd(nxt); i = j; }
      }
      continue;
    }
    if (/^[-*+]\s/.test(t)) {
      const b = clipField(t.slice(2), LONG);
      if (!b) continue;
      if (!cur) { if (kind === 'custom') items.push(b); continue; }
      /* Wo der Eintrag keine Stichpunkte kennt, gehört die Zeile zum Text —
       * so, wie sie dasteht. */
      if (kind === 'custom' || kind === 'publications') cur.textLines.push(sectionLines[i].replace(/\s+$/, ''));
      else cur.bullets.push(b);
      continue;
    }
    if (!cur) continue;
    const f = t.match(FIELD_RE);
    const key = f ? FIELD_KEY[f[1].toLowerCase().replace(/\s+/g, ' ')] : null;
    if (f && key && FIELDS_IN[kind].includes(key) && !cur.textLines.length) { cur.fields[key] = clipField(f[2], SHORT); continue; }
    if (cur.textLines.length || t) cur.textLines.push(sectionLines[i].replace(/\s+$/, ''));
  }
  flush();
  if (kind === 'projects') {
    if (!cv.projects) cv.projects = [];
    for (const e of entries) {
      const p = splitPeriod(e.fields.period);
      cv.projects.push({ id: uid('prj'), title: e.title, role: e.fields.role || '', start: p.start, end: p.end, url: e.fields.url || '', description: clipField(e.text, LONG), bullets: e.bullets });
    }
  } else if (kind === 'certificates') {
    if (!cv.certificates) cv.certificates = [];
    for (const e of entries) cv.certificates.push({ id: uid('crt'), name: e.title, issuer: e.fields.issuer || '', date: e.fields.date || '', credentialId: e.fields.credentialId || '', url: e.fields.url || '' });
  } else if (kind === 'volunteering') {
    if (!cv.volunteering) cv.volunteering = [];
    for (const e of entries) {
      const m = e.meta ? parseMeta(e.meta) : { company: '', location: '', start: '', end: '' };
      cv.volunteering.push({ id: uid('vol'), role: e.title, organization: clipField(m.company, SHORT), location: clipField(m.location, SHORT), start: m.start, end: m.end, bullets: e.bullets });
    }
  } else if (kind === 'publications') {
    if (!cv.publications) cv.publications = [];
    for (const e of entries) cv.publications.push({ id: uid('pub'), title: e.title, publisher: e.fields.publisher || '', date: e.fields.date || '', url: e.fields.url || '', description: clipField(e.text, LONG) });
  } else if (kind === 'custom') {
    /* Eine Überschrift ohne Inhalt ist kein Abschnitt. */
    if (!items.length && !entries.length) return;
    if (!cv.customSections) cv.customSections = [];
    cv.customSections.push({
      id: uid('sec'),
      title: clipField(val(title).replace(/^(abschnitt|section)\s*:\s*/i, ''), SHORT),
      items,
      entries: entries.map(e => ({ id: uid('ent'), title: e.title, subtitle: e.fields.subtitle || '', date: e.fields.date || '', text: clipField(e.text, LONG) })),
    });
  }
}

// ── Parser ──────────────────────────────────────────────────────────────────

function parseMeta(line) {
  const parts = line.split('·').map(p => p.trim());
  const out = { company: '', location: '', start: '', end: '' };
  const dateIdx = parts.findIndex(p => /\d{2,4}|heute|present|today/i.test(p) && /[–\-—]/.test(p));
  let dated = '';
  if (dateIdx >= 0) { dated = parts[dateIdx]; parts.splice(dateIdx, 1); }
  if (dated) {
    const [s, e] = dated.split(/[–—-]/).map(s => s.trim());
    out.start = s || '';
    out.end = e || '';
  }
  if (parts[0]) out.company = parts[0];
  if (parts[1]) out.location = parts[1];
  return out;
}

function sectionOf(title) {
  const t = title.toLowerCase();
  if (/profil/.test(t)) return 'profile';
  if (/berufserfahrung|experience|werdegang/.test(t)) return 'experience';
  if (/ausbildung|education/.test(t)) return 'education';
  if (/skills|kenntnisse|fähigkeiten/.test(t)) return 'skills';
  if (/sprachen|languages/.test(t)) return 'languages';
  if (/weiteres|additional/.test(t)) return 'additional';
  if (/kontakt|contact/.test(t)) return 'contact';
  return null;
}

export function markdownToCV(md, existing, targetLang) {
  const out = JSON.parse(JSON.stringify(existing));
  // Ein Profil ohne `settings` gibt es im Normalbetrieb nicht — aber ein
  // Import darf an einem fehlenden Feld nicht mit einem 500er enden.
  if (!out.settings) out.settings = {};
  if (!out.data) out.data = {};
  const lang = out.settings?.lang || 'de';
  // Eine Übersetzung einzuspielen darf die eingestellte Sprache des Profils
  // NICHT umstellen. Wer die französische Fassung schreibt, will nicht, dass
  // das Profil danach auf Französisch steht.
  const keepLang = out.settings?.lang;

  // Frontmatter
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  let body = md;
  if (fm) {
    body = fm[2];
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (!m) continue;
      const k = m[1], v = m[2].trim();
      if (k === 'template') out.settings.template = v;
      else if (k === 'lang' && ['de', 'en', 'fr', 'es'].includes(v)) out.settings.lang = v;
      else if (k === 'fontScale') out.settings.fontScale = parseFloat(v) || 1.0;
      else if (k === 'fontPairing') out.settings.fontPairing = v;
      else if (k === 'pageMode' && ['one', 'two', 'three', 'auto'].includes(v)) out.settings.pageMode = v;
      else if (k === 'pageFormat' && ['a4', 'letter', 'legal', 'a5'].includes(v)) out.settings.pageFormat = v;
    }
  }

  const useLang = targetLang || out.settings.lang;
  if (targetLang && keepLang) out.settings.lang = keepLang;
  const existingCv = out.data?.[useLang] || existing?.data?.[lang] || {};
  const cv = {
    personal: { name: '', title: '', location: '', email: '', phone: '' },
    profile: { text: '' },
    experience: [],
    education: [],
    skillGroups: [],
    languages: [],
    additionalExperience: [],
    labels: existingCv.labels, // preserve labels (i18n)
  };

  const lines = body.split('\n').map(l => l.replace(/\r$/, ''));
  let section = null;
  let curExp = null, curEdu = null, curSkill = null;
  let profileLines = [];
  const flushExp = () => { if (curExp) { cv.experience.push(curExp); curExp = null; } };
  const flushEdu = () => { if (curEdu) { cv.education.push(curEdu); curEdu = null; } };
  const flushSkill = () => { if (curSkill) { cv.skillGroups.push(curSkill); curSkill = null; } };
  const flushProfile = () => { if (section === 'profile') { cv.profile.text = profileLines.join('\n').trim(); profileLines = []; } };

  const uid = p => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let lastContact = '';
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith('## ')) {
      flushExp(); flushEdu(); flushSkill(); flushProfile();
      const title = t.slice(3).trim();
      /* Eigene Abschnitte lesen ihren ganzen Block auf einmal, bis zur
       * nächsten `##`-Zeile oder dem Namen. */
      const kind = extraSectionOf(title);
      if (kind) {
        let j = i + 1;
        while (j < lines.length && !/^#{1,2}\s/.test(lines[j].trim())) j++;
        parseExtraSection(kind, title, lines.slice(i + 1, j), cv, uid);
        section = null;
        i = j; continue;
      }
      section = sectionOf(title);
      i++; continue;
    }

    if (t.startsWith('# ')) {
      cv.personal.name = clipField(t.slice(2).trim(), 120);
      i++;
      while (i < lines.length && !lines[i].trim()) i++;
      if (i < lines.length) {
        const m = lines[i].trim().match(/^\*\*(.+)\*\*$/);
        if (m) { cv.personal.title = clipField(m[1].trim(), 160); i++; }
      }
      continue;
    }

    if (section === 'profile') { profileLines.push(line); i++; continue; }

    if (section === 'contact') {
      const m = t.match(/^-\s*([^:]+):\s*(.+)$/);
      if (m) {
        const k = m[1].toLowerCase(), v = clipField(m[2].trim(), 240);
        if (/e[-\s]?mail/.test(k)) cv.personal.email = v;
        else if (/telefon|phone/.test(k)) cv.personal.phone = v;
        else if (/ort|location|adresse|address/.test(k)) cv.personal.location = v;
        else if (/website|web|portfolio/.test(k)) cv.personal.website = v;
        else if (/geburtsdatum|date of birth/.test(k)) cv.personal.birthDate = v;
        else if (/führerschein|drivers? licen[sc]e/.test(k)) cv.personal.driversLicense = v;
        else if (/staatsangehörigkeit|nationality/.test(k)) cv.personal.nationality = v;
        else if (/familienstand|marital/.test(k)) cv.personal.maritalStatus = v;
        else {
          // Try to recognise the key as a social platform
          const plat = normalisePlatform(k);
          if (plat) {
            if (!cv.personal.socials) cv.personal.socials = [];
            cv.personal.socials.push({ id: `s-${Date.now()}-${cv.personal.socials.length}`, platform: plat, value: v });
          }
        }
        lastContact = /ort|location|adresse|address/.test(k) && !/e[-\s]?mail|telefon|phone|website|web|portfolio/.test(k) ? 'location' : '';
      } else if (t && lastContact === 'location' && !/^[-*+]\s/.test(t)) {
        // Zweizeilige Anschrift: die zweite Zeile steht ohne Spiegelstrich
        // unter „- Ort:" und fiel bis zum 09.10.2026 beim Einlesen weg.
        cv.personal.location = clipField(`${cv.personal.location}\n${t}`, 240);
      } else lastContact = '';
      i++; continue;
    }

    if (section === 'experience') {
      if (t.startsWith('### ')) {
        flushExp();
        // Bei vielen LLM-Outputs ist der Eintrag ein bold ### **Senior Engineer**.
        // stripMd() trimmt die ** Sterne weg damit nicht "**Senior Engineer**"
        // als Role-Wert landet.
        curExp = {
          id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          role: stripMd(t.slice(4)), company: '', location: '', start: '', end: '', bullets: [],
        };
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length) {
          const nxt = lines[i].trim();
          if (!nxt.startsWith('-') && !nxt.startsWith('*') && !nxt.startsWith('+') && !nxt.startsWith('#')) {
            Object.assign(curExp, parseMeta(stripMd(nxt)));
            i++;
          }
        }
        continue;
      }
      // CommonMark erlaubt - * + als Bullet-Marker. Nicht alle LLMs nutzen `-`.
      if (/^[-*+]\s/.test(t)) { if (curExp) curExp.bullets.push(t.slice(2).trim()); i++; continue; }
      i++; continue;
    }

    if (section === 'education') {
      if (t.startsWith('### ')) {
        flushEdu();
        curEdu = {
          id: `edu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          degree: stripMd(t.slice(4)), institution: '', location: '', start: '', end: '',
        };
        i++;
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length) {
          const nxt = lines[i].trim();
          if (!nxt.startsWith('-') && !nxt.startsWith('*') && !nxt.startsWith('+') && !nxt.startsWith('#')) {
            const meta = parseMeta(stripMd(nxt));
            curEdu.institution = meta.company;
            curEdu.location = meta.location;
            curEdu.start = meta.start;
            curEdu.end = meta.end;
            i++;
          }
        }
        continue;
      }
      // Anmerkung unter der Kopfzeile: wird geschrieben, fiel aber bis zum
      // 09.10.2026 beim Einlesen weg.
      if (t && curEdu && !/^[-*+]\s/.test(t)) curEdu.notes = clipField(curEdu.notes ? `${curEdu.notes}\n${t}` : t, 2000);
      i++; continue;
    }

    if (section === 'skills') {
      if (t.startsWith('### ')) { flushSkill(); curSkill = { label: stripMd(t.slice(4)), items: [] }; i++; continue; }
      if (/^[-*+]\s/.test(t)) { if (curSkill) curSkill.items.push(t.slice(2).trim()); i++; continue; }
      i++; continue;
    }

    if (section === 'languages') {
      // CommonMark: erlaubt - * + als Bullet. Anchor das pattern entsprechend.
      const m = t.match(/^[-*+]\s*([^—–-]+?)\s*[—–-]\s*(.+)$/);
      if (m) {
        let level = m[2].trim();
        // Strip trailing "(N/5)" or "(N)" — that's our dot rating, not
        // part of the human-readable level label.
        const dotMatch = level.match(/\s*\((\d)(?:\/5)?\)\s*$/);
        let dots;
        if (dotMatch) {
          dots = Math.max(1, Math.min(5, parseInt(dotMatch[1], 10)));
          level = level.slice(0, dotMatch.index).trim();
        }
        const entry = { language: m[1].trim(), level };
        if (dots) entry.dots = dots;
        cv.languages.push(entry);
      }
      i++; continue;
    }

    if (section === 'additional') {
      if (/^[-*+]\s/.test(t)) cv.additionalExperience.push(t.slice(2).trim());
      i++; continue;
    }

    i++;
  }

  flushExp(); flushEdu(); flushSkill(); flushProfile();

  // Carry over the photo + any other personal fields that the MD doesn't carry
  // (photo lives outside MD; we don't want to lose it on import).
  cv.personal.photo = existingCv.personal?.photo;
  if (existingCv.personal?.subtitle && !cv.personal.subtitle) cv.personal.subtitle = existingCv.personal.subtitle;

  out.data[useLang] = cv;
  return out;
}

// ── Cover Letter Markdown bridge ────────────────────────────────────────────

export function clToMarkdown(profile, targetLang) {
  const lang = (targetLang && profile?.coverLetters?.[targetLang]) ? targetLang : (profile?.settings?.lang || 'de');
  const cl = profile?.coverLetters?.[lang];
  if (!cl) return '';
  const out = [];

  out.push('---');
  out.push(`doc: cover-letter`);
  out.push(`lang: ${lang}`);
  out.push(`template: ${profile.settings?.template || 'hamburg'}`);
  // Nur schreiben, wenn abgeschaltet — sonst stünde in jeder Datei eine Zeile,
  // die nichts aussagt.
  if (cl.showDateline === false) out.push('dateline: off');
  if (cl.showSignature === false) out.push('signature: off');
  out.push('---');
  out.push('');

  // Header (recipient block)
  out.push('## Empfänger');
  if (val(cl.company)) out.push(`- Firma: ${val(cl.company)}`);
  if (val(cl.contactPerson)) out.push(`- Ansprechpartner: ${val(cl.contactPerson)}`);
  if (val(cl.companyAddress)) out.push(`- Adresse: ${val(cl.companyAddress)}`);
  out.push('');

  out.push('## Kopf');
  if (val(cl.city)) out.push(`- Ort: ${val(cl.city)}`);
  if (val(cl.date)) out.push(`- Datum: ${val(cl.date)}`);
  out.push('');

  if (val(cl.subject)) { out.push('## Betreff'); out.push(val(cl.subject)); out.push(''); }
  if (val(cl.salutation)) { out.push('## Anrede'); out.push(val(cl.salutation)); out.push(''); }

  if (val(cl.intro)) { out.push('## Einstieg'); out.push(val(cl.intro)); out.push(''); }
  if (val(cl.mainBody)) { out.push('## Hauptteil'); out.push(val(cl.mainBody)); out.push(''); }
  if (val(cl.companyReference)) { out.push('## Firmenbezug'); out.push(val(cl.companyReference)); out.push(''); }
  if (val(cl.motivation)) { out.push('## Motivation'); out.push(val(cl.motivation)); out.push(''); }
  if (val(cl.closing)) { out.push('## Abschluss'); out.push(val(cl.closing)); out.push(''); }
  if (val(cl.signoff)) { out.push('## Grußformel'); out.push(val(cl.signoff)); out.push(''); }

  return out.join('\n');
}

function clSectionOf(title) {
  const t = title.toLowerCase();
  if (/empf[äa]nger|recipient|adressat/.test(t)) return 'recipient';
  if (/kopf|header|datum|date/.test(t)) return 'header';
  if (/betreff|subject/.test(t)) return 'subject';
  if (/anrede|salutation|hallo/.test(t)) return 'salutation';
  if (/einstieg|intro|einleitung/.test(t)) return 'intro';
  if (/hauptteil|main|body/.test(t)) return 'mainBody';
  if (/firmenbezug|company.*ref|warum.*firma/.test(t)) return 'companyReference';
  if (/motivation|warum.*ich/.test(t)) return 'motivation';
  if (/abschluss|closing|schluss/.test(t)) return 'closing';
  if (/grußformel|signoff|gruss|gru[ßs]/.test(t)) return 'signoff';
  return null;
}

export function markdownToCl(md, existing, targetLang) {
  const out = JSON.parse(JSON.stringify(existing));
  const lang = targetLang || out.settings?.lang || 'de';

  // Frontmatter (optional — accept lang override)
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  let body = md;
  let useLang = lang;
  /* Zeitlose Fassung: Ort/Datum und Unterschriftsblock lassen sich abschalten.
   * Ohne Übernahme hier setzte ein Schreibvorgang über die Brücke die
   * Entscheidung des Menschen stillschweigend zurück. */
  const schalter = {};
  if (fm) {
    body = fm[2];
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (!m) continue;
      const k = m[1], v = m[2].trim();
      if (k === 'lang' && ['de', 'en', 'fr', 'es'].includes(v)) useLang = v;
      else if (k === 'dateline') schalter.showDateline = v.trim() !== 'off';
      else if (k === 'signature') schalter.showSignature = v.trim() !== 'off';
    }
  }
  // Ein ausdrücklich genanntes Ziel schlägt die Angabe im Frontmatter. Sonst
  // entschiede der Inhalt darüber, wohin geschrieben wird — und ein
  // kopierter Kopf aus einer anderen Fassung schriebe in die falsche Sprache.
  if (targetLang) useLang = targetLang;

  const cl = {
    company: '', contactPerson: '', companyAddress: '',
    city: '', date: '',
    subject: '', salutation: '',
    intro: '', mainBody: '', companyReference: '', motivation: '', closing: '', signoff: '',
    // Aus dem Frontmatter, sonst der bisherige Stand des Profils. Ein Import
    // darf eine bewusst abgeschaltete Datumszeile nicht wieder einschalten.
    showDateline: schalter.showDateline ?? out.coverLetters?.[useLang]?.showDateline,
    showSignature: schalter.showSignature ?? out.coverLetters?.[useLang]?.showSignature,
  };

  const lines = body.split('\n').map(l => l.replace(/\r$/, ''));
  let section = null;
  let buf = [];
  const flush = () => {
    if (!section || !buf.length) { buf = []; return; }
    if (section === 'recipient' || section === 'header') {
      for (const line of buf) {
        const m = line.match(/^-\s*([^:]+):\s*(.+)$/);
        if (!m) continue;
        const k = m[1].toLowerCase(), v = m[2].trim();
        if (section === 'recipient') {
          if (/firma|company/.test(k)) cl.company = v;
          else if (/ansprechpartner|contact/.test(k)) cl.contactPerson = v;
          else if (/adresse|address/.test(k)) cl.companyAddress = v;
        } else {
          if (/ort|city/.test(k)) cl.city = v;
          else if (/datum|date/.test(k)) cl.date = v;
        }
      }
    } else if (Object.prototype.hasOwnProperty.call(cl, section)) {
      cl[section] = buf.join('\n').trim();
    }
    buf = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('## ')) {
      flush();
      section = clSectionOf(t.slice(3).trim());
      continue;
    }
    if (section) buf.push(line);
  }
  flush();

  if (!out.coverLetters) out.coverLetters = {};
  out.coverLetters[useLang] = cl;
  return out;
}
