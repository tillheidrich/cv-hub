// Sperrliste für den Ratgeber: Was nie auf eine öffentliche Seite darf.
//
// Die öffentliche Ratgeber-Sammlung liegt typischerweise im selben Wiki
// wie Zugangsdaten, Kundennotizen und Serverlisten. Ein kopierter Absatz
// reicht, und ein Schlüssel steht im Netz. Deshalb prüfen Sync UND Bau jeden
// Artikel gegen diese Muster; ein Treffer hält genau diesen Artikel zurück,
// alle anderen gehen durch.
//
// Absichtlich KEINE festen internen Hostnamen in dieser Datei: Sie wandert
// in den öffentlichen Zwilling, und eine Sperrliste, die die gesuchten
// Adressen selbst veröffentlicht, hebt sich auf. Stattdessen:
//   - der Host aus OUTLINE_URL ist immer gesperrt,
//   - jede Unterdomain der öffentlichen Domain (PUBLIC_BASE_URL) außer der
//     öffentlichen Adresse selbst und www ist gesperrt (deckt wiki.…,
//     git.…, intranet.… usw. ab, ohne sie zu nennen),
//   - RATGEBER_SPERRMUSTER_EXTRA kann weitere reguläre Ausdrücke anhängen
//     (durch Zeilenumbruch oder | getrennt).
//
// Erlaubt bleibt genau eine E-Mail-Adresse: die aus dem Impressum
// (src/data/operator.ts), dazu Beispieladressen unter example.com/.org/.net
// und den reservierten Endungen .example, .test, .invalid.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));

/** Feste Muster. name = was im Log steht. */
export const MUSTER = [
  { name: 'Privater Schlüssel (PEM)', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'JSON Web Token', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
  { name: 'API-Schlüssel (cvk_)', re: /\bcvk_[A-Za-z0-9_-]*/ },
  { name: 'MCP-Token (cvm_)', re: /\bcvm_[A-Za-z0-9_-]*/ },
  { name: 'Mollie-Schlüssel (test_/live_/access_)', re: /\b(?:test|live|access)_[A-Za-z0-9]{20,}\b/ },
  { name: 'Outline-API-Schlüssel', re: /\bol_api_[A-Za-z0-9]{16,}/ },
  { name: 'GitHub-Token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github[_]pat_[A-Za-z0-9_]{20,})/ }, // [_]: sonst hält neutralcheck.sh das Muster selbst für einen Schlüssel
  { name: 'GitLab-/Forgejo-Token', re: /\bglpat-[A-Za-z0-9_-]{16,}/ },
  { name: 'Slack-Token', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { name: 'AWS-Zugangsschlüssel', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Stripe-artiger Schlüssel', re: /\b(?:sk|pk|rk|whsec)_(?:live|test)_[A-Za-z0-9]{10,}/ },
  { name: 'KI-API-Schlüssel (sk-…)', re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/ },
  { name: 'Bearer-Token', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/ },
  { name: 'Zugangsdaten in einer Adresse (user:pass@)', re: /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i },
  {
    name: 'Passwort/Schlüssel als Zuweisung',
    // „Passwort: Sommer2024!" ja, „Passwort: mindestens zwölf Zeichen" nein —
    // der Wert muss ohne Leerzeichen sein und eine Ziffer enthalten.
    re: /\b(?:passw(?:or)?[dt]|kennwort|pwd|secret|geheimnis|api[_ -]?key|apikey|access[_ -]?token|auth[_ -]?token|client[_ -]?secret|token)\b\s*[:=]\s*["'`]?(?=[^\s"'`]*\d)[^\s"'`]{8,}/i,
  },
  {
    name: 'Zufallszeichenkette (Geheimnis-Verdacht)',
    // Ohne Bindestrich und Unterstrich: Sonst trifft es jede lange
    // Quellen-URL wie „…/articles/360052218132-Supported-formats-for-…".
    re: /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[a-z])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]{32,}\b/,
  },
  { name: 'Lange Hex-Zeichenkette (Schlüssel/Hash)', re: /\b[a-fA-F0-9]{40,}\b/ },
  { name: 'Interner Hostname (intranet.)', re: /\bintranet\./i },
  { name: 'Interner Hostname (sslip.io/nip.io)', re: /\b(?:sslip|nip)\.io\b/i },
  { name: 'Interner Hostname (localhost)', re: /\blocalhost\b/i },
  { name: 'Interner Hostname (.local/.internal/.lan)', re: /\b[a-z0-9-]+\.(?:local|internal|lan|home\.arpa|intern)\b/i },
  { name: 'IPv4-Adresse', re: /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/ },
  { name: 'IPv6-Adresse', re: /(?<![\w:])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?![\w:])|(?<![\w:])(?:[0-9a-f]{1,4}:){1,6}:(?:[0-9a-f]{1,4}(?::[0-9a-f]{1,4}){0,5})?(?![\w:])/i },
  { name: 'Interner Wiki-Verweis (/doc/, /collection/)', re: /\]\((?:https?:\/\/[^)\s]*)?\/(?:doc|collection)\/[^)\s]*\)/ },
  { name: 'Outline-Anhang (nicht übernommen)', re: /\/api\/attachments\.(?:redirect|info)/ },
];

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g;
const BEISPIEL_DOMAIN = /(?:^|\.)(?:example\.(?:com|org|net)|[a-z0-9-]+\.(?:example|test|invalid))$/i;
const HOST_RE = /\b((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})\b/gi;

/** Impressumsadresse aus src/data/operator.ts (die einzige erlaubte). */
export function impressumsEmail(appRoot = join(HIER, '..')) {
  const datei = join(appRoot, 'src', 'data', 'operator.ts');
  if (!existsSync(datei)) return null;
  const m = /\bemail:\s*['"]([^'"]+)['"]/.exec(readFileSync(datei, 'utf8'));
  return m ? m[1].toLowerCase() : null;
}

function hostVon(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

/** Registrierbare Domain grob bestimmen (die letzten zwei Teile; für .de,
 *  .com, .eu richtig, für .co.uk zu grob — reicht für eine Sperrliste). */
function grunddomain(host) {
  const teile = host.split('.');
  return teile.slice(-2).join('.');
}

function zusatzMuster() {
  const roh = process.env.RATGEBER_SPERRMUSTER_EXTRA || '';
  return roh.split(/\n|\|(?![^(]*\))/).map(s => s.trim()).filter(s => s && !s.startsWith('#')).map(s => {
    try { return { name: `Zusatzmuster ${s.slice(0, 12)}…`, re: new RegExp(s, 'i') }; } catch { return null; }
  }).filter(Boolean);
}

/** Wert im Log nur angedeutet ausgeben, nie vollständig. */
export function maskiere(s) {
  const t = String(s);
  if (t.length <= 6) return t[0] + '…';
  return t.slice(0, 4) + '…' + `(${t.length} Zeichen)`;
}

/**
 * Text prüfen.
 * @param {string} text
 * @param {{ outlineUrl?: string, publicBaseUrl?: string, erlaubteEmails?: string[] }} [opt]
 * @returns {{ muster: string, zeile: number, auszug: string }[]}
 */
export function pruefeText(text, opt = {}) {
  const treffer = [];
  const zeilen = String(text).split('\n');
  const outlineHost = opt.outlineUrl ? hostVon(opt.outlineUrl) : null;
  const publicHost = hostVon(opt.publicBaseUrl || process.env.PUBLIC_BASE_URL || 'https://cv.example.com');
  const basis = publicHost ? grunddomain(publicHost) : null;
  const erlaubtHosts = new Set([publicHost, basis, basis && `www.${basis}`].filter(Boolean));
  for (const h of String(process.env.RATGEBER_ERLAUBTE_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) erlaubtHosts.add(h);
  const emails = new Set((opt.erlaubteEmails ?? [impressumsEmail()]).filter(Boolean).map(e => e.toLowerCase()));
  const alle = [...MUSTER, ...zusatzMuster()];

  zeilen.forEach((z, i) => {
    for (const { name, re } of alle) {
      const m = re.exec(z);
      if (m) treffer.push({ muster: name, zeile: i + 1, auszug: maskiere(m[0]) });
    }
    for (const m of z.matchAll(EMAIL_RE)) {
      const adr = m[0].toLowerCase();
      if (emails.has(adr) || BEISPIEL_DOMAIN.test(m[1])) continue;
      treffer.push({ muster: 'E-Mail-Adresse (nur die Impressumsadresse ist erlaubt)', zeile: i + 1, auszug: maskiere(m[0]) });
    }
    for (const m of z.matchAll(HOST_RE)) {
      const host = m[1].toLowerCase();
      // E-Mail-Domains sind oben schon behandelt.
      if (m.index > 0 && z[m.index - 1] === '@') continue;
      if (outlineHost && (host === outlineHost || host.endsWith('.' + outlineHost))) {
        treffer.push({ muster: 'Adresse des internen Wikis', zeile: i + 1, auszug: maskiere(host) });
        continue;
      }
      if (basis && host.endsWith('.' + basis) && !erlaubtHosts.has(host)) {
        treffer.push({ muster: 'Interne Unterdomain der eigenen Domain', zeile: i + 1, auszug: maskiere(host) });
      }
    }
  });
  return treffer;
}
