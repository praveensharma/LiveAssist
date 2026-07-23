/**
 * Custom tools that augment the auto-generated SDK tools.
 *
 * These cover aggregated reads and operations that don't map 1:1 to a single
 * SDK method — they're intentionally kept small. Everything else lives in
 * generated-tools.ts (run `npm run generate` to update).
 */

import type { ToolSchema } from '../providers/index.js';

export const CUSTOM_TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: 'get_live_state',
    description:
      'Returns a full snapshot of the current session: tempo, tracks, session clips (grid), ' +
      'arrangement clips (timeline), devices, and mixer ids. ' +
      'Call before claiming work is done to verify session clips exist and devices can produce sound.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'web_search',
    description:
      'Search the web for musical and production reference: bass tabs and song info; Ableton Live workflows and built-in device tips ' +
      '(Operator, Compressor, EQ Eight, etc.); mixing, sound design, and general production techniques. ' +
      'Returns web links, ASCII tab excerpts, Ableton.com article excerpts when fetchable, and Wikipedia for song/artist overview. ' +
      'Call whenever the user wants to learn, look something up, or needs facts you should not guess — pass a focused query like ' +
      '"sidechain compression Ableton", "Operator FM bass site:ableton.com", or "With or Without You U2 bass tab".',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Focused search query, e.g. "glue compressor attack release tips", "Operator sub bass tutorial", or "U2 bass tab"',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'resources_import_into_project',
    description:
      'Copies an audio file from an absolute path on disk into the Live project folder. ' +
      'Returns the project-relative path for simpler_replace_sample or audio clips. ' +
      "Does not browse Live's factory library — the file must already exist on disk.",
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the audio file to import.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'check_mono_compatibility',
    description:
      'Analyzes an AudioTrack for stereo phase / mono-compatibility issues over a beat range: renders ' +
      "the track's pre-effects audio and correlates its left and right channels. Returns a correlation " +
      'number from -1 to +1 plus a plain-language note — it is not a pass/fail verdict. Strongly negative ' +
      'correlation (below -0.3) usually means real cancellation when summed to mono (inverted channel, or ' +
      'timing offset). Mildly negative or low correlation can be intentional wide-stereo content (chorus, ' +
      'doubled/panned parts, some reverbs) — use judgment before telling the user something is "broken". ' +
      'Only works on AudioTrack handles (not MIDI tracks) and only on arrangement-view audio (not session ' +
      'clips directly). Rendering takes real time — pass a short range (a few bars around the area of ' +
      'concern), not the whole song.',
    parameters: {
      type: 'object',
      properties: {
        audio_track_id: {
          type: 'string',
          description: 'Handle ID of the AudioTrack to analyze.',
        },
        start_time: {
          type: 'number',
          description: 'Start of the range to render and analyze, in beats.',
        },
        end_time: {
          type: 'number',
          description: 'End of the range to render and analyze, in beats.',
        },
      },
      required: ['audio_track_id', 'start_time', 'end_time'],
    },
  },
];
