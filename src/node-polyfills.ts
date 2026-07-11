/**
 * The Ableton Extension Host runs a restricted Node.js-like environment that
 * doesn't expose some standard globals (e.g. URL) the way real Node.js does.
 * Most npm packages — including @anthropic-ai/sdk internally, in buildURL()
 * — assume these exist unconditionally and reference them as bare globals
 * rather than importing from 'url'. Polyfill them here, imported first thing
 * in extension.ts, before any other module's code can run.
 *
 * Use the bare 'url' specifier (not 'node:url') — the Extension Host's
 * require() has been observed to resolve 'url' but not the 'node:'-prefixed
 * form.
 */
import { URL, URLSearchParams } from 'url';

const g = globalThis as unknown as { URL?: unknown; URLSearchParams?: unknown };

if (typeof g.URL === 'undefined') {
  g.URL = URL;
}
if (typeof g.URLSearchParams === 'undefined') {
  g.URLSearchParams = URLSearchParams;
}
