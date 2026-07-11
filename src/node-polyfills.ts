/**
 * The Ableton Extension Host runs a restricted Node.js-like environment that
 * doesn't expose some standard globals the way real Node.js does — URL, the
 * Fetch API (fetch/Headers/Request/Response/FormData), and TextEncoder/
 * TextDecoder have all been observed missing here. Most npm packages —
 * including @anthropic-ai/sdk (buildURL, header normalization) and undici's
 * own streaming response decoder — assume these exist unconditionally and
 * reference them as bare (or globalThis.*) globals.
 *
 * installNodePolyfills() is called from inside activate(), not at module
 * top-level — deferring it until after the host has actually invoked our
 * code avoids doing any work during the host's own bring-up/handshake.
 *
 * Use bare specifiers ('url', 'util'), not the 'node:'-prefixed form — the
 * Extension Host's require() has been observed to resolve the bare form
 * but not 'node:xxx'. 'undici' (the same engine Node itself uses for global
 * fetch) fills in the Fetch API globals, since this host doesn't provide
 * them itself.
 */
export function installNodePolyfills(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { URL, URLSearchParams } = require('url') as typeof import('url');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextEncoder, TextDecoder } = require('util') as typeof import('util');
  const g = globalThis as unknown as {
    URL?: unknown;
    URLSearchParams?: unknown;
    TextEncoder?: unknown;
    TextDecoder?: unknown;
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
  if (typeof g.TextEncoder === 'undefined') {
    g.TextEncoder = TextEncoder;
  }
  if (typeof g.TextDecoder === 'undefined') {
    g.TextDecoder = TextDecoder;
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
