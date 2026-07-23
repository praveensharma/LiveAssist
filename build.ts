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
  // Externalize ONLY the SDK — the Extension Host special-cases this exact
  // specifier to inject its own native bridge. Everything else must be
  // bundled: per the SDK's own packaging docs, "the Live Extension Host
  // expects a standalone JavaScript file and will not resolve node_modules
  // at runtime." (undici was externalized here briefly — that only appeared
  // to work because `npm start` dev mode runs from the project directory
  // with node_modules physically present; a packaged .ablx ships none, so
  // require('undici') would have thrown "Cannot find module" for anyone who
  // actually installed it normally instead of running the dev loop.)
  external: ['@ableton-extensions/sdk'],
  // esbuild outputs CJS so import.meta.url is unavailable; inject a
  // synthetic value so fileURLToPath() resolves __dirname correctly.
  define: {
    global: 'globalThis',
    'import.meta.url': JSON.stringify(`file://${path.resolve(outfile)}`),
  },
});

// Build the React UI with Vite
execSync('npx vite build --config ui/vite.config.ts', { stdio: 'inherit' });
