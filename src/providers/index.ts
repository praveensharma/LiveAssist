import {
  anthropicStream,
  type ProviderMsg,
  type ToolSchema as HttpToolSchema,
} from './anthropic-stream.js';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type { ProviderMsg as ProviderMessage };

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type StreamChunk =
  | { type: 'text'; text: string }
  | {
      type: 'tool_call';
      id: string;
      name: string;
      args: Record<string, unknown>;
    };

export interface ChatOptions {
  model: string;
  systemPrompt: string;
  messages: ProviderMsg[];
  tools: ToolSchema[];
}

export interface ProviderAdapter {
  chat(options: ChatOptions): AsyncIterable<StreamChunk>;
}

// ─── Claude models ────────────────────────────────────────────────────────────

export const CLAUDE_MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
] as const;

export const DEFAULT_MODEL = 'claude-sonnet-5';

// ─── Factory ─────────────────────────────────────────────────────────────────

/** Creates the (sole) Claude provider adapter for the given API key. */
export function createProvider(apiKey: string): ProviderAdapter {
  return {
    chat({ model, systemPrompt, messages, tools }): AsyncIterable<StreamChunk> {
      return anthropicStream(
        apiKey,
        model,
        systemPrompt,
        messages,
        tools as HttpToolSchema[],
      ) as AsyncIterable<StreamChunk>;
    },
  };
}
