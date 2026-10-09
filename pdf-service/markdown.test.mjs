// Markdown-Brücke: eigene Abschnitte (Projekte, Zertifikate, Ehrenamt,
// Publikationen, freie Abschnitte) hin und zurück ohne Feldverlust — und
// bestehende Profile ohne diese Abschnitte schreiben dasselbe Markdown wie
// vorher.
//
//   node --test markdown.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cvToMarkdown, markdownToCV, extraSectionOf } from './markdown.js';

const base = () => ({
  personal: { name: 'Lina Sandmann', title: 'Projektmanagerin', email: 'l@example.com', phone: '+49 1', location: 'Lüneburg' },
  profile: { text: 'Kurzprofil.' },
  experience: [{ id: 'e1', role: 'Analystin', company: 'Elbwerk', location: 'Hamburg', start: '08/2019', end: '04/2022', bullets: ['Anforderungen erhoben'] }],
  education: [{ id: 'b1', degree: 'M.Sc.', institution: 'Leuphana', start: '2017', end: '2019' }],
  skillGroups: [{ label: 'Methoden', items: ['Scrum'] }],
  languages: [{ language: 'Deutsch', level: 'Muttersprache', dots: 5 }],
  additionalExperience: ['Führerschein B'],
  labels: { lang: 'de', sections: {}, fields: {}, misc: { present: 'heute' } },
});

const extra = () => ({
  projects: [
    { id: 'p1', title: 'Relaunch Kundenportal', role: 'Projektleitung', start: '03/2023', end: '11/2023', url: 'https://example.org/portal', description: 'Erster Absatz.\n\nZweiter Absatz.', bullets: ['Ladezeit gesenkt', 'Support entlastet'] },
    { id: 'p2', title: '', role: '', start: '', end: '2022', url: '', description: '', bullets: ['Nur ein Stichpunkt'] },
    { id: 'p3', title: 'Nur Beginn', role: '', start: '2024', end: '', url: '', description: 'Text ohne Stichpunkte', bullets: [] },
  ],
  certificates: [
    { id: 'c1', name: 'PSM I', issuer: 'Scrum.org', date: '05/2021', credentialId: 'PSM-1', url: '' },
    { id: 'c2', name: 'TÜV DSB', issuer: '', date: '', credentialId: '', url: 'example.org/z/42' },
  ],
  volunteering: [
    { id: 'v1', role: 'Jugendtrainerin', organization: 'TSV Musterstadt', location: 'Musterstadt', start: '2018', end: 'heute', bullets: ['Zwei Mannschaften'] },
    { id: 'v2', role: 'Kassenwart', organization: 'Förderverein', location: '', start: '', end: '', bullets: [] },
  ],
  publications: [
    { id: 'u1', title: 'Digitale Werkstattakte', publisher: 'Fachverlag', date: '2024', url: 'example.org/a', description: 'Praxisbeitrag.\n- mit Strich am Zeilenanfang' },
  ],
  customSections: [
    { id: 's1', title: 'Interessen', items: ['Laufen', 'Fotografie'], entries: [] },
    { id: 's2', title: 'Auszeichnungen', items: [], entries: [
      { id: 'a1', title: 'Innovationspreis', subtitle: 'HWK Hamburg', date: '2023', text: 'Für das Aufmaß.' },
      { id: 'a2', title: '', subtitle: '', date: '', text: 'Nominiert 2022.' },
    ] },
    { id: 's3', title: 'Beides', items: ['Punkt'], entries: [{ id: 'b1', title: 'Eintrag', subtitle: '', date: '', text: '' }] },
  ],
});

const profileOf = cv => ({ id: 'x', settings: { lang: 'de', template: 'hamburg' }, data: { de: cv } });
/** Kennungen werden beim Einlesen neu vergeben — verglichen wird der Inhalt. */
const ohneIds = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'id' ? undefined : v)));
const KEYS = ['projects', 'certificates', 'volunteering', 'publications', 'customSections'];

test('Profil ohne eigene Abschnitte: kein neuer Abschnitt im Markdown, Ende wie bisher', () => {
  const md = cvToMarkdown(profileOf(base()));
  for (const h of ['## Projekte', '## Zertifikate', '## Ehrenamt', '## Publikationen', '## Abschnitt']) assert.ok(!md.includes(h), h);
  assert.match(md, /## Weiteres\n- Führerschein B\n$/);
});

test('Leere Listen und leere Einträge erzeugen keine Abschnitte', () => {
  const cv = { ...base(), projects: [], certificates: [{ id: 'c', name: ' ', issuer: '' }], volunteering: undefined,
    publications: null, customSections: [{ id: 's', title: 'Leer', items: [], entries: [{ id: 'e', title: '', text: '' }] }] };
  const md = cvToMarkdown(profileOf(cv));
  for (const h of ['## Projekte', '## Zertifikate', '## Ehrenamt', '## Publikationen', '## Abschnitt']) assert.ok(!md.includes(h), h);
});

test('Rundlauf: alle Felder der eigenen Abschnitte kommen unverändert zurück', () => {
  const cv = { ...base(), ...extra() };
  const md = cvToMarkdown(profileOf(cv));
  const back = markdownToCV(md, profileOf(base())).data.de;
  for (const k of KEYS) assert.deepEqual(ohneIds(back[k]), ohneIds(cv[k]), k);
  // Zweiter Durchgang ist stabil: dasselbe Markdown.
  assert.equal(cvToMarkdown(profileOf(back)), md);
});

test('Bestehende Abschnitte bleiben vom Einbau unberührt', () => {
  const cv = { ...base(), ...extra() };
  const back = markdownToCV(cvToMarkdown(profileOf(cv)), profileOf(base())).data.de;
  assert.deepEqual(ohneIds(back.experience), ohneIds(cv.experience));
  assert.deepEqual(back.skillGroups, cv.skillGroups);
  assert.deepEqual(back.additionalExperience, cv.additionalExperience);
  assert.equal(back.profile.text, cv.profile.text);
});

test('Einträge ohne Titel stehen als „###" und gehen nicht im vorigen auf', () => {
  const md = cvToMarkdown(profileOf({ ...base(), ...extra() }));
  assert.match(md, /\n###\nZeitraum: – 2022\n- Nur ein Stichpunkt\n/);
  assert.match(md, /\n###\nNominiert 2022\.\n/);
});

test('Englische Überschriften und Feldschlüssel werden gelesen', () => {
  const md = [
    '# A', '', '## Projects', '### Tool', 'Role: Lead', 'Period: 2020 – 2021', 'URL: x.org', 'Did things.', '- One',
    '', '## Certifications', '### Cert', 'Issuer: Org', 'Date: 2020', 'Credential ID: 7',
    '', '## Volunteer experience', '### Coach', 'Club · Town · 2019 – present', '- Kids',
    '', '## Publications', '### Paper', 'Publisher: Journal', 'Date: 2022',
    '', '## Section: Hobbies', '- Chess', '',
  ].join('\n');
  const cv = markdownToCV(md, profileOf(base())).data.de;
  assert.deepEqual(ohneIds(cv.projects), [{ title: 'Tool', role: 'Lead', start: '2020', end: '2021', url: 'x.org', description: 'Did things.', bullets: ['One'] }]);
  assert.deepEqual(ohneIds(cv.certificates), [{ name: 'Cert', issuer: 'Org', date: '2020', credentialId: '7', url: '' }]);
  assert.deepEqual(ohneIds(cv.volunteering), [{ role: 'Coach', organization: 'Club', location: 'Town', start: '2019', end: 'present', bullets: ['Kids'] }]);
  assert.equal(cv.experience.length, 0, '„Volunteer experience" ist kein Berufsweg');
  assert.deepEqual(ohneIds(cv.customSections), [{ title: 'Hobbies', items: ['Chess'], entries: [] }]);
});

test('Abschnittserkennung', () => {
  assert.equal(extraSectionOf('Projekte'), 'projects');
  assert.equal(extraSectionOf('Abschnitt: Profil-Ergänzungen'), 'custom', 'freier Abschnitt schlägt „Profil"');
  assert.equal(extraSectionOf('Berufserfahrung'), null);
  assert.equal(extraSectionOf('Profil'), null);
  assert.equal(extraSectionOf('Weiterbildung und Zertifikate'), 'certificates');
});

test('Überlange Felder werden begrenzt, leere freie Abschnitte verworfen', () => {
  const lang = 'x'.repeat(400);
  const md = `# A\n\n## Zertifikate\n### ${lang}\nAussteller: ${lang}\n\n## Abschnitt: Leer\n\n## Abschnitt: Voll\n- a\n`;
  const cv = markdownToCV(md, profileOf(base())).data.de;
  assert.equal(cv.certificates[0].name.length, 240);
  assert.equal(cv.certificates[0].issuer.length, 240);
  assert.deepEqual(cv.customSections.map(s => s.title), ['Voll']);
});

test('Markdown ohne eigene Abschnitte ersetzt sie — wie bei jedem anderen Abschnitt', () => {
  const prof = profileOf({ ...base(), ...extra() });
  const back = markdownToCV('# Lina\n\n## Profil\nNeu.\n', prof).data.de;
  for (const k of KEYS) assert.equal(back[k], undefined, k);
});

test('Zweizeilige Anschrift und Anmerkung der Ausbildung überleben den Rundlauf', () => {
  const cv = { ...base(), personal: { ...base().personal, location: 'Bardowicker Straße 7\n21335 Lüneburg', website: 'x.de' },
    education: [{ id: 'b1', degree: 'M.Sc.', institution: 'Leuphana', start: '2017', end: '2019', notes: 'Schwerpunkt Prozesse\nNote 1,3' }] };
  const back = markdownToCV(cvToMarkdown(profileOf(cv)), profileOf(base())).data.de;
  assert.equal(back.personal.location, 'Bardowicker Straße 7\n21335 Lüneburg');
  assert.equal(back.personal.website, 'x.de');
  assert.equal(back.education[0].notes, 'Schwerpunkt Prozesse\nNote 1,3');
});
