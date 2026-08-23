# Extension host crash — investigation findings (2026-08-22)

Surfaced from a Grouper debugging session (a different extension in this
user's setup) — Grouper appeared to crash on load, but the actual crash was
traced here, to LiveAssist.

## Symptom

Live's shared extension host process was exiting with code 1 shortly after
startup, which took down every installed extension (including Grouper),
not just this one.

## Root cause

`~/Library/Application Support/Ableton/Extensions/praveensharma.liveassist/dist/extension.js`
(the currently-installed build) contains three bare `require("@ableton-extensions/sdk")`
calls — the SDK was left external rather than bundled. The installed
extension folder ships no `node_modules`, so at load time this throws
`Cannot find module '@ableton-extensions/sdk'`. That exception is uncaught
at the host level, which kills the whole shared Node process (not just this
extension) — visible in
`~/Library/Preferences/Ableton/Live 12.4.5b11/ExtensionHost.txt`:

```
2026-08-22T20:19:01: error: Uncaught exception (uncaughtException)
Error: Failed to load extension: Cannot find module '@ableton-extensions/sdk'
Require stack:
- .../Ableton/Extensions/praveensharma.liveassist/dist/extension.js
    at <anonymous>:34:23
```

## Where this comes from in source

[build.ts:32](build.ts:32) deliberately externalizes the SDK:

```ts
// Externalize ONLY the SDK — the Extension Host special-cases this exact
// specifier to inject its own native bridge. Everything else must be
// bundled: per the SDK's own packaging docs, "the Live Extension Host
// expects a standalone JavaScript file and will not resolve node_modules
// at runtime." ...
external: ['@ableton-extensions/sdk'],
```

That comment's premise — that the host special-cases this specifier and
injects its own implementation — does not match what's observed here: the
host does not provide the module, it just tries a normal Node `require` and
fails.

**Cross-check against Grouper** (`/Users/praveen/Documents/Grouper`, same
host, same SDK vendor package, same beta SDK generation): its
[build.ts](file:///Users/praveen/Documents/Grouper/build.ts) has no
`external` array at all — esbuild bundles `@ableton-extensions/sdk` fully
into `dist/extension.js` (confirmed zero occurrences of the specifier in the
installed bundle). Grouper loads and runs fine under this same host
(logged activity as recently as 2026-08-13). This is fairly strong evidence
that bundling the SDK is the correct, working approach for this host/SDK
version, and that the "external bridge" assumption in this project's
build.ts is stale or was never accurate for this SDK release
(`@ableton-extensions/sdk` vendored here at `1.0.0-beta.1`, vs. beta.0 in
Grouper — worth checking if this changed between betas, but the safest fix
doesn't depend on that).

## SDK packaging fix (applied)

`external: ['@ableton-extensions/sdk']` was removed from `build.ts`, so the
SDK is now bundled with every other runtime dependency.

## Restricted host globals (applied and verified 2026-08-23)

Once the SDK was bundled, LiveAssist reached `activate()` and exposed a
second compatibility problem. Ableton's Extension Host removes browser-style
globals that `undici` expects during module initialization. Successive real
host runs failed on `ReadableStream`, then `AbortSignal`, then `performance`.
Because each exception escaped `activate()`, every failure still terminated
the shared host with code 1.

`src/node-polyfills.ts` now installs the required primitives before requiring
`undici`: Web Streams, Blob/File, MessagePort, AbortController/AbortSignal,
performance, Event/EventTarget, and DOMException. The regression test removes
those globals to reproduce the constrained host before loading the Fetch API.

The installed bundle was verified byte-for-byte against the rebuilt artifact.
On the first corrected startup, `ExtensionHost.txt` recorded:

```
[LiveAssist] polyfill: undici required
[LiveAssist] polyfill: done
[LiveAssist] SDK context initialized
[LiveAssist] Server listening on http://127.0.0.1:58426
[LiveAssist] Ready — 55 tracks loaded
```

All six context-menu scopes registered, and no subsequent error or code-1
exit was logged. This validates source tests, packaged artifact, installed
artifact, and real Extension Host activation as separate layers.
