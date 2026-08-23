import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const production = process.argv.includes('--production');
const outfile: string = manifest.entry;
const outdir = path.dirname(outfile);

fs.mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: ['src/extension.ts'],
  outfile,
  bundle: true,
  format: 'cjs',
  platform: 'node',
  sourcesContent: false,
  logLevel: 'info',
  minify: production,
  sourcemap: !production,
  // Bundle everything, including the SDK — the Extension Host does not
  // special-case '@ableton-extensions/sdk' or inject its own implementation;
  // it just does a normal Node require(). Externalizing it (as this build
  // briefly did) throws "Cannot find module '@ableton-extensions/sdk'" at
  // load time in a real install (no node_modules ships in the .ablx), which
  // crashes the whole shared Extension Host process — not just this
  // extension. Confirmed against ExtensionHost.txt and cross-checked against
  // Grouper (same host, same SDK vendor package), which has no `external`
  // array and loads fine. Per the SDK's own packaging docs, "the Live
  // Extension Host expects a standalone JavaScript file and will not resolve
  // node_modules at runtime" — that applies to every dependency, this one
  // included.
  // esbuild outputs CJS so import.meta.url is unavailable; inject a
  // synthetic value so fileURLToPath() resolves __dirname correctly.
  define: {
    global: 'globalThis',
    'import.meta.url': JSON.stringify(`file://${path.resolve(outfile)}`),
  },
});

// Build the React UI with Vite
execSync('npx vite build --config ui/vite.config.ts', { stdio: 'inherit' });
