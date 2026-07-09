/**
 * Streaming client for the Claude Messages API, built on the official Anthropic SDK.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface HttpChunk {
  type: 'text' | 'tool_call';
  text?: string;
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

export type HttpChunkStream = AsyncGenerator<HttpChunk, void, unknown>;

export interface ProviderMsg {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCall?: {
    id: string;
    name: string;
    args: Record<string, unknown>;
  };
  toolCallId?: string;
  /** Name of the tool that produced this result. */
  toolName?: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

function buildAnthropicMessages(messages: ProviderMsg[]) {
  const result: Array<{ role: 'user' | 'assistant'; content: unknown }> = [];
  for (const m of messages) {
    if (m.role === 'assistant' && m.toolCall) {
      result.push({
        role: 'assistant',
        content: [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          { type: 'tool_use', id: m.toolCall.id, name: m.toolCall.name, input: m.toolCall.args },
        ],
      });
    } else if (m.role === 'tool') {
      result.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      });
    } else {
      result.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content });
    }
  }
  return result;
}

/**
 * Streams a Claude response, yielding text chunks and completed tool calls.
 * Uses the SDK's typed event stream instead of hand-parsed SSE.
 */
export async function* anthropicStream(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ProviderMsg[],
  tools: ToolSchema[],
): HttpChunkStream {
  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: buildAnthropicMessages(messages) as any,
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input_schema: t.parameters as any,
    })),
  });

  let currentToolId = '';
  let currentToolName = '';
  let currentToolArgs = '';

  for await (const event of stream) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
      currentToolId = event.content_block.id;
      currentToolName = event.content_block.name;
      currentToolArgs = '';
    } else if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text };
      } else if (event.delta.type === 'input_json_delta') {
        currentToolArgs += event.delta.partial_json;
      }
    } else if (event.type === 'content_block_stop' && currentToolName) {
      let args: Record<string, unknown> = {};
      try {
        args = currentToolArgs ? JSON.parse(currentToolArgs) : {};
      } catch {
        /* leave empty */
      }
      yield { type: 'tool_call', id: currentToolId, name: currentToolName, args };
      currentToolName = '';
      currentToolArgs = '';
    }
  }
}
