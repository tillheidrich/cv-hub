/**
 * Vite-Konfiguration nur für das Vorrendern (npm run build, Schritt
 * „landing:ssr"). Erbt app/vite.config.ts und ersetzt zwei Module durch
 * Fassungen ohne Browser-Zustand (ssr-shims/): billing/hooks.ts (Angebot aus
 * dem Bau statt vom Server) und ui/useUiLang.ts (Sprache der Fassung statt
 * localStorage/navigator). Die App selbst bleibt unberührt.
 */
import { defineConfig, mergeConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import base from '../../vite.config.ts';

const shim = (name: string) => fileURLToPath(new URL(`./ssr-shims/${name}`, import.meta.url));

function ssrShims(): Plugin {
  return {
    name: 'landing-ssr-shims',
    enforce: 'pre',
    async resolveId(source, importer, opts) {
      if (!importer || importer.includes('/ssr-shims/')) return null;
      if (!/hooks|useUiLang/.test(source)) return null;
      const r = await this.resolve(source, importer, { ...opts, skipSelf: true });
      if (!r) return null;
      const id = r.id.split('?')[0];
      if (id.endsWith('/src/billing/hooks.ts')) return shim('hooks.ts');
      if (id.endsWith('/src/ui/useUiLang.ts')) return shim('useUiLang.ts');
      return null;
    },
  };
}

export default mergeConfig(base, defineConfig({
  plugins: [ssrShims()],
  publicDir: false,
  logLevel: 'warn',
  build: {
    ssr: fileURLToPath(new URL('./ssr.tsx', import.meta.url)),
    outDir: fileURLToPath(new URL('../../node_modules/.cache/landing-ssr', import.meta.url)),
    emptyOutDir: true,
    minify: false,
    rollupOptions: { output: { entryFileNames: 'ssr.mjs', format: 'es' } },
  },
}));
