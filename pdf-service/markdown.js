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

export function cvToMarkdown(profile) {
  const lang = profile?.settings?.lang || 'de';
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

  return out.join('\n');
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

export function markdownToCV(md, existing) {
  const out = JSON.parse(JSON.stringify(existing));
  const lang = out.settings?.lang || 'de';

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

  const useLang = out.settings.lang;
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

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (t.startsWith('## ')) {
      flushExp(); flushEdu(); flushSkill(); flushProfile();
      section = sectionOf(t.slice(3).trim());
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
      }
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

export function clToMarkdown(profile) {
  const lang = profile?.settings?.lang || 'de';
  const cl = profile?.coverLetters?.[lang];
  if (!cl) return '';
  const out = [];

  out.push('---');
  out.push(`doc: cover-letter`);
  out.push(`lang: ${lang}`);
  out.push(`template: ${profile.settings?.template || 'hamburg'}`);
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

export function markdownToCl(md, existing) {
  const out = JSON.parse(JSON.stringify(existing));
  const lang = out.settings?.lang || 'de';

  // Frontmatter (optional — accept lang override)
  const fm = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  let body = md;
  let useLang = lang;
  if (fm) {
    body = fm[2];
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (!m) continue;
      const k = m[1], v = m[2].trim();
      if (k === 'lang' && ['de', 'en', 'fr', 'es'].includes(v)) useLang = v;
    }
  }

  const cl = {
    company: '', contactPerson: '', companyAddress: '',
    city: '', date: '',
    subject: '', salutation: '',
    intro: '', mainBody: '', companyReference: '', motivation: '', closing: '', signoff: '',
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
    } else if (cl.hasOwnProperty(section)) {
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
