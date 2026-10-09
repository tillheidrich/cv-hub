// ── Schriften im HTML-Export ────────────────────────────────────────────────
//
// Eine exportierte HTML-Datei soll für sich allein stehen. Bis zum 08.10.2026
// verwies sie auf `<Herkunft>/fonts.css` — wer die Datei öffnete (oder an
// eine Personalabteilung weitergab), rief damit bei jedem Öffnen unseren
// Server auf, und ohne Netz fehlten die Schriften. Davor waren es sogar die
// Server von Google (LG München I, 3 O 17493/20, 20.01.2022).
//
// Jetzt stehen die Schriften als base64-@font-face IN der Datei. Nur die
// Familien und Schnitte, die das Dokument tatsächlich setzt, und den
// erweiterten lateinischen Zeichensatz nur, wenn der Text ihn braucht —
// sonst würde aus einer 60-KB-Datei eine mit mehreren Megabyte.
//
// Alle Schriften stehen unter der SIL Open Font License 1.1. Sie erlaubt das
// Einbetten in Dokumente; der Lizenztext und die Copyright-Zeile gehen als
// Kommentar mit in die Datei.

interface FaceRule { family: string; weight: number; subset: 'latin' | 'latin-ext'; url: string; rule: string }

/** Zeichen, die nur der erweiterte lateinische Satz enthält (ł, ş, ő, č …).
 *  ı, œ und Œ liegen bereits im Grundsatz. */
const NEEDS_EXT = /[Ā-İĲ-őŔ-ɏḀ-ỿ]/;

function parseFaces(css: string): FaceRule[] {
  const out: FaceRule[] = [];
  for (const m of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
    const rule = m[0];
    const family = /font-family:\s*'([^']+)'/.exec(rule)?.[1];
    const weight = Number(/font-weight:\s*(\d+)/.exec(rule)?.[1] || 400);
    const url = /url\('([^']+)'\)/.exec(rule)?.[1];
    if (!family || !url) continue;
    out.push({ family, weight, subset: url.includes('-latin-ext-') ? 'latin-ext' : 'latin', url, rule });
  }
  return out;
}

/** Familien und Schnitte, die im gerenderten Markup vorkommen. */
function usedFonts(html: string, families: Set<string>): { fams: Set<string>; weights: Set<number> } {
  const decoded = html.replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
  /* Inter ist die Grundschrift von <body> — eingebettet wird sie trotzdem nur,
   * wenn das Dokument sie setzt. Das Hinweisband fällt sonst auf system-ui. */
  const fams = new Set<string>();
  for (const m of decoded.matchAll(/font-family:\s*([^;"]+)/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/^['"]|['"]$/g, '');
      if (families.has(name)) fams.add(name);
    }
  }
  const weights = new Set<number>([400]);
  for (const m of decoded.matchAll(/font-weight:\s*(\d{3})/g)) weights.add(Number(m[1]));
  return { fams, weights };
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** HTML-Kommentare dürfen kein „--" enthalten. */
const commentSafe = (s: string) => s.replace(/--/g, '- -');

export interface EmbeddedFonts { css: string; licenseComment: string; bytes: number }

/**
 * Baut die @font-face-Regeln für `html` mit eingebetteten Schriftdateien.
 * `text` ist der sichtbare Text des Dokuments (für die Wahl des Zeichensatzes).
 * Gibt `null` zurück, wenn die Schriften nicht zu laden sind — dann fällt die
 * Datei auf Systemschriften zurück, statt einen externen Verweis zu tragen.
 */
export async function embedFonts(html: string, text: string, origin: string): Promise<EmbeddedFonts | null> {
  try {
    const cssResp = await fetch(`${origin}/fonts.css`);
    if (!cssResp.ok) return null;
    const faces = parseFaces(await cssResp.text());
    const { fams, weights } = usedFonts(html, new Set(faces.map(f => f.family)));
    const ext = NEEDS_EXT.test(text);

    const chosen: FaceRule[] = [];
    for (const fam of fams) {
      const own = faces.filter(f => f.family === fam);
      const available = [...new Set(own.map(f => f.weight))];
      const wanted = new Set<number>();
      // Fehlt ein Schnitt, nimmt der Browser den nächstliegenden — genau den
      // betten wir dann ein.
      for (const w of weights) {
        if (!available.length) break;
        wanted.add(available.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a)));
      }
      chosen.push(...own.filter(f => wanted.has(f.weight) && (f.subset === 'latin' || ext)));
    }

    let bytes = 0;
    const rules = await Promise.all(chosen.map(async f => {
      const r = await fetch(f.url.startsWith('http') ? f.url : `${origin}${f.url}`);
      if (!r.ok) throw new Error(`Schrift ${f.url}: ${r.status}`);
      const buf = await r.arrayBuffer();
      bytes += buf.byteLength;
      return f.rule.replace(/url\('[^']+'\)/, `url(data:font/woff2;base64,${toBase64(buf)})`);
    }));

    // Lizenz: je Familie die Copyright-Zeile und der vollständige OFL-Text.
    const pkgs = new Map<string, string>();
    for (const f of chosen) {
      const pkg = /\/fonts\/(.+?)-latin(?:-ext)?-\d+-normal\.woff2$/.exec(f.url)?.[1];
      if (pkg && !pkgs.has(f.family)) pkgs.set(f.family, pkg);
    }
    const notices: string[] = [];
    let licenseText = '';
    for (const [family, pkg] of pkgs) {
      try {
        const lr = await fetch(`${origin}/fonts/${pkg}.LICENSE.txt`);
        const txt = lr.ok ? await lr.text() : '';
        const copyright = /^Copyright[^)\n]*\)?/m.exec(txt)?.[0] ?? '';
        notices.push(`${family}: ${copyright || 'siehe Lizenz'}`);
        if (!licenseText) {
          const start = txt.indexOf('SIL OPEN FONT LICENSE');
          licenseText = start >= 0 ? txt.slice(start) : '';
        }
      } catch {
        notices.push(`${family}: SIL Open Font License 1.1`);
      }
    }
    const licenseComment = `<!--\nEingebettete Schriften / embedded fonts — SIL Open Font License, Version 1.1 (https://openfontlicense.org)\n${commentSafe(notices.join('\n'))}\n\n${commentSafe(licenseText.trim())}\n-->`;
    return { css: rules.join('\n'), licenseComment, bytes };
  } catch (e) {
    console.warn('Schriften für den HTML-Export nicht ladbar:', e);
    return null;
  }
}
