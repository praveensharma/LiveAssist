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
  // Externalize the SDK — provided by the Extension Host at runtime.
  // Externalize undici too — it's only needed lazily inside installNodePolyfills(),
  // and inlining its ~1MB source nearly quadrupled the bundle. Left as a real
  // require('undici') resolved from node_modules at runtime instead.
  external: ['@ableton-extensions/sdk', 'undici'],
  // esbuild outputs CJS so import.meta.url is unavailable; inject a
  // synthetic value so fileURLToPath() resolves __dirname correctly.
  define: {
    global: 'globalThis',
    'import.meta.url': JSON.stringify(`file://${path.resolve(outfile)}`),
  },
});

// Build the React UI with Vite
execSync('npx vite build --config ui/vite.config.ts', { stdio: 'inherit' });
