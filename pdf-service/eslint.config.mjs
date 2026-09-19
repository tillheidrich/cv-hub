// Warum es diese Datei gibt.
//
// Die CI prüfte das Backend bis heute nur mit `node --check`. Das sieht
// Syntax — und sonst nichts. Genau deshalb konnte in `server.js` monatelang
// eine Zeile stehen, die zwei Namen benutzte, die es nicht mehr gab
// (`reqProto`, `reqHost`): syntaktisch tadellos, zur Laufzeit ein
// ReferenceError, der mangels Fehler-Middleware den ganzen Dienst beendete.
//
// `no-undef` hätte das in einer Zehntelsekunde gefunden. Die Regel ist
// deshalb das Herz dieser Datei; alles andere ist Beiwerk.
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // `page.evaluate(() => …)` läuft im Browser, nicht in Node. Die Funktion
    // steht als Quelltext hier, ausgeführt wird sie dort — `document` ist an
    // dieser Stelle also richtig und kein fehlender Name.
    files: ['server.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  { ignores: ['node_modules/**', 'renderer/**'] },
];
