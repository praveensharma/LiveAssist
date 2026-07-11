/**
 * The Ableton Extension Host runs a restricted Node.js-like environment that
 * doesn't expose some standard globals the way real Node.js does — URL and
 * the Fetch API (fetch/Headers/Request/Response/FormData) have both been
 * observed missing here. Most npm packages — including @anthropic-ai/sdk
 * internally, in buildURL() and its header-normalization helpers — assume
 * these exist unconditionally and reference them as bare globals.
 *
 * installNodePolyfills() is called from inside activate(), not at module
 * top-level — deferring it until after the host has actually invoked our
 * code avoids doing any work during the host's own bring-up/handshake.
 *
 * Use the bare 'url' specifier (not 'node:url') — the Extension Host's
 * require() has been observed to resolve 'url' but not the 'node:'-prefixed
 * form. 'undici' (the same engine Node itself uses for global fetch) fills
 * in the Fetch API globals, since this host doesn't provide them itself.
 */
export function installNodePolyfills(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { URL, URLSearchParams } = require('url') as typeof import('url');
  const g = globalThis as unknown as {
    URL?: unknown;
    URLSearchParams?: unknown;
    fetch?: unknown;
    Headers?: unknown;
    Request?: unknown;
    Response?: unknown;
    FormData?: unknown;
  };

  if (typeof g.URL === 'undefined') {
    g.URL = URL;
  }
  if (typeof g.URLSearchParams === 'undefined') {
    g.URLSearchParams = URLSearchParams;
  }

  if (
    typeof g.fetch === 'undefined' ||
    typeof g.Headers === 'undefined' ||
    typeof g.Request === 'undefined' ||
    typeof g.Response === 'undefined' ||
    typeof g.FormData === 'undefined'
  ) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require('undici') as typeof import('undici');
    if (typeof g.fetch === 'undefined') g.fetch = undici.fetch;
    if (typeof g.Headers === 'undefined') g.Headers = undici.Headers;
    if (typeof g.Request === 'undefined') g.Request = undici.Request;
    if (typeof g.Response === 'undefined') g.Response = undici.Response;
    if (typeof g.FormData === 'undefined') g.FormData = undici.FormData;
  }
}
