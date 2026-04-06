// ============================================================
// PAWEN — Anthropic Provider (Claude)
// Handles: Opus, Sonnet, Haiku — with prompt caching + streaming
// ============================================================

import { AIGenerateParams, AIGenerateResult, ModelConfig } from '../types';
import { AIProvider } from './providers';

export class AnthropicProvider implements AIProvider {

  async generate(model: ModelConfig, params: AIGenerateParams): Promise<AIGenerateResult> {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.model,
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens ?? model.maxTokens,
        cacheControl: params.cacheControl ?? true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.content,
      tokensUsed: data.tokensUsed,
      model: model.model,
      cached: data.cached ?? false,
    };
  }

  async *generateStream(
    model: ModelConfig,
    params: AIGenerateParams
  ): AsyncGenerator<string, AIGenerateResult> {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.model,
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
        temperature: params.temperature ?? 0.7,
        maxTokens: params.maxTokens ?? model.maxTokens,
        cacheControl: params.cacheControl ?? true,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.message || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let tokensUsed = { input: 0, output: 0 };
    let cached = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullContent += parsed.delta.text;
              yield parsed.delta.text;
            }

            if (parsed.type === 'message_delta' && parsed.usage) {
              tokensUsed.output = parsed.usage.output_tokens;
            }

            if (parsed.type === 'message_start' && parsed.message?.usage) {
              tokensUsed.input = parsed.message.usage.input_tokens;
              cached = (parsed.message.usage.cache_read_input_tokens ?? 0) > 0;
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    }

    return {
      content: fullContent,
      tokensUsed,
      model: model.model,
      cached,
    };
  }
}
