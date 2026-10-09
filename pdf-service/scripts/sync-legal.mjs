#!/usr/bin/env node
// Erzeugt pdf-service/mailtexts/legal-texts.json aus app/src/legal/ (09.10.2026).
//
// Die Rechtstexte rund um den Bewerbungs-Pass (AGB, Widerrufsbelehrung,
// Muster-Formular, Mailtexte) pflegt der Rechtstexte-Agent an EINER Stelle:
// app/src/legal/*.ts. Der Docker-Container von cv-api sieht den App-Ordner
// nicht — deshalb, wie bei templates.json, eine erzeugte Kopie hier. Der Test
// in billing.test.mjs schlägt an, sobald beide auseinanderlaufen.
//
//   node scripts/sync-legal.mjs           # schreiben
//   node scripts/sync-legal.mjs --check   # nur vergleichen, Exit 1 bei Abweichung
//
// Die .ts-Dateien werden direkt importiert (Node ≥ 22.18 entfernt Typangaben
// selbst; die drei Dateien haben nur "import type").

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const LEGAL_DIR = path.resolve(here, '../../app/src/legal');
export const LEGAL_JSON = path.resolve(here, '../mailtexts/legal-texts.json');

export async function buildLegalJson(dir = LEGAL_DIR) {
  const imp = f => import(pathToFileURL(path.join(dir, f)).href);
  const [{ MAILS }, { WIDERRUF }, { AGB }] = await Promise.all([imp('mails.ts'), imp('widerruf.ts'), imp('agb.ts')]);
  return {
    source: 'app/src/legal (erzeugt mit pdf-service/scripts/sync-legal.mjs — nicht von Hand ändern)',
    mails: MAILS,
    withdrawal: WIDERRUF,
    terms: AGB,
  };
}

export function serialize(obj) { return JSON.stringify(obj, null, 2) + '\n'; }

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (!existsSync(LEGAL_DIR)) { console.error(`sync-legal: ${LEGAL_DIR} fehlt`); process.exit(1); }
  const want = serialize(await buildLegalJson());
  if (process.argv.includes('--check')) {
    const have = existsSync(LEGAL_JSON) ? readFileSync(LEGAL_JSON, 'utf8') : '';
    if (have !== want) { console.error('sync-legal: mailtexts/legal-texts.json ist veraltet — node scripts/sync-legal.mjs'); process.exit(1); }
    console.log('sync-legal: aktuell');
  } else {
    writeFileSync(LEGAL_JSON, want);
    console.log(`sync-legal: ${LEGAL_JSON} geschrieben`);
  }
}
