// Tests für den festen Stand eines Sharelinks (share.js) — ohne Datenbank.
//
// Geprüft wird in beide Richtungen: Was weg muss, ist weg — und was der
// Empfänger sehen soll, ist noch da.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareSnapshot, shareResponse, photoIdOf, photoIdsIn, sharePhotoPath, EMPTY_COVER_LETTER } from './share.js';

const PHOTO = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const ORIG = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const TOKEN = 'cafe01';

function profil() {
  const cv = (lang, name) => ({
    personal: {
      name, title: 'Elektrikerin', location: 'Musterstadt', email: 'x@example.org', phone: '0',
      photo: `https://cv.example.org/pdfapi/api/photos/${PHOTO}`,
      photoOriginal: `https://cv.example.org/pdfapi/api/photos/${ORIG}`,
      birthDate: '01.01.1990', maritalStatus: 'ledig', nationality: 'deutsch', driversLicense: 'B',
    },
    profile: { text: `Profil ${lang}` },
    experience: [
      { id: '1', role: 'Meisterin', company: 'Sichtbar GmbH', location: '', start: '2020', end: 'heute', bullets: ['a'] },
      { id: '2', role: 'Aushilfe', company: 'Versteckt AG', location: '', start: '2010', end: '2011', bullets: [], hidden: true },
    ],
    education: [{ id: 'e', degree: 'Meister', institution: 'HWK', start: '2015', end: '2016' }],
    skillGroups: [{ label: 'Technik', items: ['KNX'] }],
    languages: [{ language: 'Deutsch', level: 'Muttersprache' }],
    additionalExperience: ['Feuerwehr'],
    labels: { lang },
  });
  return {
    id: 'p1', displayName: 'Bewerbung Acme intern', createdAt: '2026-01-01',
    data: { de: cv('de', 'Anna'), en: cv('en', 'Anna EN-Fassung') },
    coverLetters: {
      de: { subject: 'Bewerbung als Meisterin', intro: 'Hallo', mainBody: 'Text', company: 'Acme' },
      en: { subject: 'Application', intro: 'Hello' },
    },
    settings: { lang: 'de', template: 'husum', fontScale: 1, fontPairing: 'auto', pageMode: 'one', hiddenSections: ['details'], secretSetting: 'x' },
  };
}

test('nur die eingestellte Sprache, nichts Ausgeblendetes, kein Original', () => {
  const snap = buildShareSnapshot(profil(), TOKEN);
  const out = shareResponse(snap, { includeCoverLetter: false });
  const json = JSON.stringify(out);
  assert.deepEqual(Object.keys(out.resume.data), ['de']);
  assert.doesNotMatch(json, /EN-Fassung/);
  assert.doesNotMatch(json, /Versteckt AG/);
  assert.doesNotMatch(json, /01\.01\.1990|ledig|deutsch"/);
  assert.doesNotMatch(json, /photoOriginal/);
  assert.doesNotMatch(json, new RegExp(ORIG));
  assert.doesNotMatch(json, new RegExp(PHOTO), 'die interne Foto-ID bleibt intern');
  assert.doesNotMatch(json, /Bewerbung Acme intern/, 'der Anzeigename ist eine Notiz des Inhabers');
  assert.doesNotMatch(json, /secretSetting/);
  // … und was sichtbar sein soll, ist da
  const cv = out.resume.data.de;
  assert.equal(cv.personal.name, 'Anna');
  assert.equal(cv.experience.length, 1);
  assert.equal(cv.experience[0].company, 'Sichtbar GmbH');
  assert.equal(cv.education.length, 1);
  assert.equal(cv.personal.photo, `/pdfapi/api/share/${TOKEN}/photo`);
  assert.equal(out.resume.settings.template, 'husum');
  assert.deepEqual(out.resume.settings.hiddenSections, ['details']);
  assert.equal(out.include_cover_letter, false);
});

test('Anschreiben: ohne Freigabe leer (kein Muster-Reiter), mit Freigabe nur die eine Sprache', () => {
  const snap = buildShareSnapshot(profil(), TOKEN);
  const ohne = shareResponse(snap, { includeCoverLetter: false });
  assert.deepEqual(Object.keys(ohne.resume.coverLetters), ['de']);
  assert.deepEqual(ohne.resume.coverLetters.de, { ...EMPTY_COVER_LETTER });
  assert.equal(ohne.resume.coverLetters.de.subject, '');
  const mit = shareResponse(snap, { includeCoverLetter: true });
  assert.deepEqual(Object.keys(mit.resume.coverLetters), ['de']);
  assert.equal(mit.resume.coverLetters.de.subject, 'Bewerbung als Meisterin');
  assert.doesNotMatch(JSON.stringify(mit), /Application/);
});

test('ausgeblendete Abschnitte werden geleert, sichtbare bleiben', () => {
  const p = profil();
  p.settings.hiddenSections = ['profile', 'experience', 'education', 'skills', 'languages', 'additional'];
  const cv = shareResponse(buildShareSnapshot(p, TOKEN), { includeCoverLetter: false }).resume.data.de;
  assert.equal(cv.profile.text, '');
  assert.deepEqual(cv.experience, []);
  assert.deepEqual(cv.education, []);
  assert.deepEqual(cv.skillGroups, []);
  assert.deepEqual(cv.languages, []);
  assert.deepEqual(cv.additionalExperience, []);
  // Eckdaten waren diesmal NICHT ausgeblendet → bleiben
  assert.equal(cv.personal.birthDate, '01.01.1990');
});

test('fremde Foto-Adresse fällt weg (Zählpixel), eingebettetes Bild bleibt', () => {
  const p = profil();
  p.data.de.personal.photo = 'https://tracker.example.net/p.gif';
  let cv = shareResponse(buildShareSnapshot(p, TOKEN), { includeCoverLetter: false }).resume.data.de;
  assert.equal(cv.personal.photo, undefined);
  p.data.de.personal.photo = 'data:image/jpeg;base64,/9j/AAAA';
  cv = shareResponse(buildShareSnapshot(p, TOKEN), { includeCoverLetter: false }).resume.data.de;
  assert.equal(cv.personal.photo, 'data:image/jpeg;base64,/9j/AAAA');
});

test('Sprache: eingestellte, sonst die erste vorhandene', () => {
  const p = profil();
  p.settings.lang = 'fr';
  assert.equal(buildShareSnapshot(p, TOKEN).lang, 'de');
  p.settings.lang = 'en';
  const snap = buildShareSnapshot(p, TOKEN);
  assert.equal(snap.lang, 'en');
  assert.equal(snap.profile.settings.lang, 'en');
});

test('der feste Stand ändert sich nicht mit dem Profil', () => {
  const p = profil();
  const snap = buildShareSnapshot(p, TOKEN);
  p.data.de.personal.name = 'Geändert';
  p.data.de.experience[0].bullets.push('neu');
  assert.equal(snap.profile.data.de.personal.name, 'Anna');
  assert.deepEqual(snap.profile.data.de.experience[0].bullets, ['a']);
});

test('Foto-IDs und Pfade', () => {
  assert.equal(photoIdOf(`/pdfapi/api/photos/${PHOTO}`), PHOTO);
  assert.equal(photoIdOf(`https://x/pdfapi/api/photos/${PHOTO}?v=1`), PHOTO);
  assert.equal(photoIdOf('https://x/api/photos/zzz'), null);
  assert.deepEqual(photoIdsIn(JSON.stringify(profil())).sort(), [PHOTO, ORIG].sort());
  assert.equal(sharePhotoPath(`https://cv.example.org/pdfapi/api/photos/${PHOTO}`, 't'), '/pdfapi/api/share/t/photo');
  assert.equal(sharePhotoPath(`/api/photos/${PHOTO}`, 't'), '/api/share/t/photo');
});

test('kaputte Profile führen nicht zum Absturz', () => {
  for (const p of [null, {}, { data: {} }, { data: { de: {} } }, { data: { de: { experience: 'x' } }, settings: { hiddenSections: 'x' } }]) {
    const out = shareResponse(buildShareSnapshot(p, TOKEN), { includeCoverLetter: true });
    assert.ok(out.resume.data);
  }
});

test('Eigene Abschnitte gehen mit in den Link, ausgeblendete nicht', () => {
  const payload = {
    settings: { lang: 'de', hiddenSections: ['certificates'] },
    data: { de: { personal: { name: 'A' }, profile: { text: '' }, experience: [], education: [], skillGroups: [], languages: [],
      projects: [{ id: 'p', title: 'Projekt' }], certificates: [{ id: 'c', name: 'Zert' }],
      customSections: [{ id: 's', title: 'Interessen', items: ['Laufen'] }] } },
  };
  const cv = buildShareSnapshot(payload, 'tok').profile.data.de;
  assert.deepEqual(cv.projects, [{ id: 'p', title: 'Projekt' }]);
  assert.deepEqual(cv.certificates, []);
  assert.deepEqual(cv.customSections, [{ id: 's', title: 'Interessen', items: ['Laufen'] }]);
  assert.equal('volunteering' in cv, false, 'Bestandsprofile bekommen keinen neuen Schlüssel');
});
