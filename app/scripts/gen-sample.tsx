import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync } from 'fs';
import { mkdirSync } from 'fs';
import { join } from 'path';
import ResumeRenderer from '../src/templates/ResumeRenderer';
import { THEMES, resolvePairing } from '../src/templates/theme';
import { tillDE } from '../src/data/till-de';

const FONT = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Source+Serif+4:wght@400;600;700&family=Space+Grotesk:wght@400;500;600;700&family=EB+Garamond:wght@400;500;600&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap';

const showcase = ['pikachu', 'onyx', 'azurill', 'gengar', 'leafish', 'hamburg', 'kopenhagen', 'berlin'];
const density = Number(process.argv[2] ?? 0.66);
const outDir = join(process.cwd(), 'tmp-preview');

const sections = showcase.map(id => {
  const theme = THEMES.find(t => t.id === id)!;
  const pairing = resolvePairing(theme, 'auto');
  const body = renderToStaticMarkup(
    createElement(ResumeRenderer, { data: tillDE, theme, pairing, density, pages: 1 }),
  );
  return `<div class="lbl">${theme.name} &mdash; ${theme.description} &nbsp;·&nbsp; ${theme.layout}</div>${body}`;
}).join('\n');

const html = `<!doctype html><html lang="de"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT}" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#e6e4df;font-family:Inter,sans-serif;padding:40px 0}
.cv-page{box-shadow:0 8px 40px rgba(0,0,0,.18);margin:0 auto 48px}
.lbl{width:210mm;margin:0 auto 12px;font-size:13px;font-weight:700;color:#4a4a4a;letter-spacing:.3px}
</style></head><body>
<div class="lbl" style="font-size:18px;margin-bottom:28px">CV-Tool — 10 Vorlagen, Dichte ${density} (Ein-Seiten-Fit)</div>
${sections}
</body></html>`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'cv-vorlagen-vorschau.html'), html);
console.log('written: cv-vorlagen-vorschau.html  (' + (html.length / 1024).toFixed(0) + ' KB)');
