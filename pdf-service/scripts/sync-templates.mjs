#!/usr/bin/env node
// Erzeugt pdf-service/templates.json aus app/src/templates/theme.ts.
//
// Befund vom 08.10.2026: Die Vorlagenliste stand ein zweites Mal von Hand in
// server.js, mit dem Kommentar „muss mit theme.ts synchron bleiben". Sie war es
// nicht: fünf IDs gab es in der App gar nicht mehr, fünf waren ausgemustert,
// acht aktuelle fehlten. /api/templates und das MCP-Werkzeug list_templates
// boten einer KI damit Vorlagen an, die es nicht gibt.
//
// Jetzt ist theme.ts die einzige Quelle (PICKABLE_THEMES, FONT_PAIRING_LIST).
// Dieses Skript schreibt die JSON-Datei, die der Dienst liest — der
// Docker-Container sieht den App-Ordner nicht, deshalb liegt sie hier.
//
//   node scripts/sync-templates.mjs           # schreiben
//   node scripts/sync-templates.mjs --check   # nur vergleichen, Exit 1 bei Abweichung
//
// theme.ts wird direkt importiert (Node ≥ 22.18 entfernt Typangaben selbst;
// die Datei hat nur einen `import type`).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const THEME_TS = path.resolve(here, '../../app/src/templates/theme.ts');
export const TEMPLATES_JSON = path.resolve(here, '../templates.json');

export async function buildTemplatesJson(themePath = THEME_TS) {
  const m = await import(pathToFileURL(themePath).href);
  const templates = m.PICKABLE_THEMES.map(t => ({
    id: t.id, name: t.name, category: t.category, description: t.description || '',
  }));
  const fontPairings = ['auto', ...m.FONT_PAIRING_LIST.map(p => p.id).filter(id => id !== 'auto')];
  return { source: 'app/src/templates/theme.ts (PICKABLE_THEMES, FONT_PAIRING_LIST)', templates, fontPairings };
}

export function serialize(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const want = serialize(await buildTemplatesJson());
  if (process.argv.includes('--check')) {
    let have = '';
    try { have = readFileSync(TEMPLATES_JSON, 'utf8'); } catch { /* fehlt */ }
    if (have !== want) {
      console.error('templates.json weicht von theme.ts ab. Neu erzeugen: node pdf-service/scripts/sync-templates.mjs');
      process.exit(1);
    }
    console.log('templates.json stimmt mit theme.ts überein.');
  } else {
    writeFileSync(TEMPLATES_JSON, want);
    console.log(`templates.json geschrieben (${JSON.parse(want).templates.length} Vorlagen).`);
  }
}
