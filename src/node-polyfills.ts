/**
 * The Ableton Extension Host runs a restricted Node.js-like environment that
 * doesn't expose some standard globals the way real Node.js does — URL, the
 * Fetch API (fetch/Headers/Request/Response/FormData), Web Streams, and
 * TextEncoder/TextDecoder have all been observed missing here. Most npm packages —
 * including @anthropic-ai/sdk (buildURL, header normalization) and undici's
 * own streaming response decoder — assume these exist unconditionally and
 * reference them as bare (or globalThis.*) globals.
 *
 * installNodePolyfills() is called from inside activate(), not at module
 * top-level — deferring it until after the host has actually invoked our
 * code avoids doing any work during the host's own bring-up/handshake.
 *
 * Use bare specifiers ('url', 'util', 'stream/web'), not the 'node:'-prefixed form — the
 * Extension Host's require() has been observed to resolve the bare form
 * but not 'node:xxx'. 'undici' (the same engine Node itself uses for global
 * fetch) fills in the Fetch API globals, since this host doesn't provide
 * them itself.
 */
import { dbg } from './debug-log.js';

export function installNodePolyfills(): void {
  dbg('[LiveAssist] polyfill: start');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { URL, URLSearchParams } = require('url') as typeof import('url');
  dbg('[LiveAssist] polyfill: url required');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextEncoder, TextDecoder } = require('util') as typeof import('util');
  dbg('[LiveAssist] polyfill: util required');
  // undici evaluates assertions for these globals as soon as it is required.
  // They must be installed before require('undici'), not afterwards with the
  // Fetch API exports. Ableton's host currently fails first on ReadableStream.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ReadableStream, WritableStream, TransformStream } = require('stream/web') as typeof import('stream/web');
  dbg('[LiveAssist] polyfill: stream/web required');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Blob, File } = require('buffer') as typeof import('buffer');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { MessagePort } = require('worker_threads') as typeof import('worker_threads');
  // Ableton also removes Node's global AbortController/AbortSignal pair.
  // Keep the fallback bundled: undici asserts AbortSignal at module load and
  // the Anthropic client uses AbortController for request timeouts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AbortController, AbortSignal } = require('abort-controller') as typeof import('abort-controller');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { performance } = require('perf_hooks') as typeof import('perf_hooks');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventTarget } = require('event-target-shim') as typeof import('event-target-shim');

  class EventPolyfill {
    readonly type: string;
    readonly bubbles: boolean;
    readonly cancelable: boolean;
    readonly composed: boolean;
    readonly isTrusted = false;
    readonly timeStamp = performance.now();
    target: unknown = null;
    currentTarget: unknown = null;
    srcElement: unknown = null;
    eventPhase = 0;
    cancelBubble = false;
    returnValue = true;
    defaultPrevented = false;

    constructor(type: string, init: { bubbles?: boolean; cancelable?: boolean; composed?: boolean } = {}) {
      this.type = String(type);
      this.bubbles = init.bubbles ?? false;
      this.cancelable = init.cancelable ?? false;
      this.composed = init.composed ?? false;
    }

    composedPath(): unknown[] { return []; }
    stopPropagation(): void { this.cancelBubble = true; }
    stopImmediatePropagation(): void { this.cancelBubble = true; }
    preventDefault(): void {
      if (this.cancelable) {
        this.defaultPrevented = true;
        this.returnValue = false;
      }
    }
    initEvent(): void { /* legacy no-op */ }
  }

  class DOMExceptionPolyfill extends Error {
    readonly code = 0;

    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  }
  const g = globalThis as unknown as {
    URL?: unknown;
    URLSearchParams?: unknown;
    TextEncoder?: unknown;
    TextDecoder?: unknown;
    ReadableStream?: unknown;
    WritableStream?: unknown;
    TransformStream?: unknown;
    Blob?: unknown;
    File?: unknown;
    MessagePort?: unknown;
    AbortController?: unknown;
    AbortSignal?: unknown;
    performance?: unknown;
    Event?: unknown;
    EventTarget?: unknown;
    DOMException?: unknown;
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
  if (typeof g.ReadableStream === 'undefined') {
    g.ReadableStream = ReadableStream;
  }
  if (typeof g.WritableStream === 'undefined') {
    g.WritableStream = WritableStream;
  }
  if (typeof g.TransformStream === 'undefined') {
    g.TransformStream = TransformStream;
  }
  if (typeof g.Blob === 'undefined') {
    g.Blob = Blob;
  }
  if (typeof g.File === 'undefined') {
    g.File = File;
  }
  if (typeof g.MessagePort === 'undefined') {
    g.MessagePort = MessagePort;
  }
  if (typeof g.AbortController === 'undefined') {
    g.AbortController = AbortController;
  }
  if (typeof g.AbortSignal === 'undefined') {
    g.AbortSignal = AbortSignal;
  }
  if (typeof g.performance === 'undefined') {
    g.performance = performance;
  }
  if (typeof g.EventTarget === 'undefined') {
    g.EventTarget = EventTarget;
  }
  if (typeof g.Event === 'undefined') {
    g.Event = EventPolyfill;
  }
  if (typeof g.DOMException === 'undefined') {
    g.DOMException = DOMExceptionPolyfill;
  }
  dbg('[LiveAssist] polyfill: base globals set');

  if (
    typeof g.fetch === 'undefined' ||
    typeof g.Headers === 'undefined' ||
    typeof g.Request === 'undefined' ||
    typeof g.Response === 'undefined' ||
    typeof g.FormData === 'undefined'
  ) {
    dbg('[LiveAssist] polyfill: requiring undici');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const undici = require('undici') as typeof import('undici');
    dbg('[LiveAssist] polyfill: undici required');
    if (typeof g.fetch === 'undefined') g.fetch = undici.fetch;
    if (typeof g.Headers === 'undefined') g.Headers = undici.Headers;
    if (typeof g.Request === 'undefined') g.Request = undici.Request;
    if (typeof g.Response === 'undefined') g.Response = undici.Response;
    if (typeof g.FormData === 'undefined') g.FormData = undici.FormData;
  }
  dbg('[LiveAssist] polyfill: done');
}
