import { afterEach, describe, expect, it } from 'vitest';
import { installNodePolyfills } from './node-polyfills.js';

const POLYFILLED_GLOBALS = [
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'Blob',
  'File',
  'MessagePort',
  'AbortController',
  'AbortSignal',
  'performance',
  'Event',
  'EventTarget',
  'DOMException',
  'fetch',
  'Headers',
  'Request',
  'Response',
  'FormData',
] as const;

const originalDescriptors = new Map(
  POLYFILLED_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
);

afterEach(() => {
  for (const [name, descriptor] of originalDescriptors) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      Reflect.deleteProperty(globalThis, name);
    }
  }
});

describe('installNodePolyfills', () => {
  it('loads undici when Ableton omits browser-style globals and the Fetch API', () => {
    for (const name of POLYFILLED_GLOBALS) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: undefined,
        writable: true,
      });
    }

    expect(() => installNodePolyfills()).not.toThrow();
    expect(globalThis.ReadableStream).toBeTypeOf('function');
    expect(globalThis.WritableStream).toBeTypeOf('function');
    expect(globalThis.TransformStream).toBeTypeOf('function');
    expect(globalThis.Blob).toBeTypeOf('function');
    expect(globalThis.File).toBeTypeOf('function');
    expect(globalThis.AbortController).toBeTypeOf('function');
    expect(globalThis.AbortSignal).toBeTypeOf('function');
    expect(globalThis.performance).toBeTypeOf('object');
    expect(globalThis.Event).toBeTypeOf('function');
    expect(globalThis.EventTarget).toBeTypeOf('function');
    expect(globalThis.DOMException).toBeTypeOf('function');
    expect(globalThis.fetch).toBeTypeOf('function');
    expect(globalThis.Headers).toBeTypeOf('function');
    expect(globalThis.Request).toBeTypeOf('function');
    expect(globalThis.Response).toBeTypeOf('function');
    expect(globalThis.FormData).toBeTypeOf('function');
  });
});
