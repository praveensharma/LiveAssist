/**
 * The Ableton Extension Host runs a restricted Node.js-like environment that
 * doesn't expose some standard globals (e.g. URL) the way real Node.js does.
 * Most npm packages — including @anthropic-ai/sdk internally, in buildURL()
 * — assume these exist unconditionally and reference them as bare globals
 * rather than importing from 'url'.
 *
 * installNodePolyfills() is called from inside activate(), not at module
 * top-level — deferring it until after the host has actually invoked our
 * code avoids doing any work during the host's own bring-up/handshake.
 *
 * Use the bare 'url' specifier (not 'node:url') — the Extension Host's
 * require() has been observed to resolve 'url' but not the 'node:'-prefixed
 * form.
 */
export function installNodePolyfills(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { URL, URLSearchParams } = require('url') as typeof import('url');
  const g = globalThis as unknown as { URL?: unknown; URLSearchParams?: unknown };

  if (typeof g.URL === 'undefined') {
    g.URL = URL;
  }
  if (typeof g.URLSearchParams === 'undefined') {
    g.URLSearchParams = URLSearchParams;
  }
}
