# LiveAssist

A Claude-powered chat assistant embedded directly in Ableton Live, built on the
(beta) [Ableton Extensions SDK](https://ableton.github.io/extensions-sdk). Right-click
a track, clip, or scene and choose **Ask LiveAssist…** to open a chat panel where you
describe what you want in plain English — Claude drives the session directly against
Live's data model (tracks, clips, devices, scenes) via the Extensions SDK.

## What it can do

- **General Live Set editing** — create/delete tracks and scenes, manage clips, drum
  racks, Simpler, chains, cue points, and more. Most of this surface (45+ tools) is
  auto-generated directly from the SDK's typed API, so it stays in sync as the SDK
  grows (`npm run generate`, see `scripts/generate-tools.ts`).
- **Live Set state inspection** (`get_live_state`) — lets Claude see the current
  tracks/clips/devices before deciding what to do.
- **Mono-compatibility / phase analysis** (`check_mono_compatibility`) — renders a
  track's pre-FX audio for a given time range and reports stereo phase correlation, to
  catch mono-incompatible content.
- **Sample import** (`resources_import_into_project`) — pull in audio from a URL.
- **Web search** — Claude can search the web for context (e.g. looking up a technique
  or plugin) mid-conversation.

## Architecture

- `src/extension.ts` — the extension entry point. Registers the **Ask LiveAssist…**
  context menu action across track/clip/scene scopes, and starts a local HTTP+WebSocket
  server (`src/server.ts`) that the chat UI connects to.
- `ui/` — a Vite + React chat interface, shown in a modal dialog
  (`context.ui.showModalDialog`) pointed at the local server.
- `src/agent/` — the agent loop: system prompt (`chat.ts`), tool schemas
  (`tools.ts`, auto-generated `generated-tools.ts`), and tool execution
  (`tool-execution.ts`).
- `src/live/executor.ts` / `generated-executor.ts` — dispatches tool calls onto the
  live SDK context, resolving Handles back to typed SDK objects.
- `src/providers/` — the Claude API client (streaming, tool use).
- `src/node-polyfills.ts` — the Extension Host is a constrained JS runtime missing
  several standard globals (`URL`, `fetch`, `TextEncoder`, etc.) that `@anthropic-ai/sdk`
  needs; these are polyfilled lazily inside `activate()`.

Node's `node_modules` resolution isn't available at runtime inside Live's Extension
Host, so the production build (`build.ts`) bundles every dependency except
`@ableton-extensions/sdk` itself (which the host special-cases and injects natively).

## Setup

```bash
npm install
```

No `.env` file is needed — your Anthropic API key is entered directly in the chat
panel's settings and persisted to disk under the extension's storage directory
(`src/storage.ts`), not read from an environment variable.

## Development

Live must already be open with **Developer Mode** enabled (Preferences/Settings →
Extensions) before starting the dev loop — that toggle hands the Extension Host over to
the CLI tooling.

```bash
npm start        # builds and runs against the open, dev-mode-enabled copy of Live
npm run dev:ui    # standalone Vite dev server for the chat UI, outside of Live
npm run typecheck
npm test
```

## Packaging / installing

```bash
npm run package   # produces dist/liveassist.ablx
```

To install outside of dev mode: open Live's **Preferences/Settings → Extensions**, turn
**Developer Mode off**, and drag `dist/liveassist.ablx` onto the "Drag and drop to
install" area (or use "Choose file"). Fully quit and relaunch Live afterward — extension
activation happens at app launch, and leaving Developer Mode on will make the Extension
Host wait indefinitely for a dev CLI connection instead of loading installed
extensions.

Requires Live 12 Suite (beta 12.4.5 or later) — the Extensions SDK isn't available in
earlier Live 12 releases, Live 11, or non-Suite editions.
