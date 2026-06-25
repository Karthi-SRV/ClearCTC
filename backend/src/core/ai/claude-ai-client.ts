import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiParseError } from './ai-parse.error.js';
import { AiResponseParser } from './ai-response-parser.js';
import { MAX_RETRIES, retryDelay, sleep } from './ai-retry.util.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

@Injectable()
export class ClaudeAiClient extends AiResponseParser {
  private readonly logger = new Logger(ClaudeAiClient.name);
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    super();
    // get() not getOrThrow() — constructor must not throw when another provider is active
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    this.model = this.config.get<string>('CLAUDE_MODEL', 'claude-sonnet-4-6');
  }

  async call(systemPrompt: string, userPrompt: string): Promise<object> {
    if (!this.apiKey) {
      throw new AiParseError(
        'ANTHROPIC_API_KEY is not set. Add it to backend/.env.',
      );
    }

    const reqBody = JSON.stringify({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const startTime = Date.now();
    let response: Response;
    let attempt = 0;

    while (true) {
      try {
        response = await fetch(ANTHROPIC_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: reqBody,
        });
      } catch (err: unknown) {
        throw new AiParseError(`Anthropic connection error: ${err instanceof Error ? err.message : String(err)}`);
      }

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await sleep(retryDelay(attempt, response.headers.get('Retry-After')));
          attempt++;
          continue;
        }
        const body = await response.text().catch(() => '');
        throw new AiParseError(
          `Anthropic API error: 429 Too Many Requests (${MAX_RETRIES} retries exhausted). ` +
          body.slice(0, 200),
        );
      }

      break;
    }

    if (!response!.ok) {
      const body = await response!.text().catch(() => '');
      throw new AiParseError(
        `Anthropic API error: ${response!.status} ${response!.statusText}${body ? ' — ' + body.slice(0, 200) : ''}`,
      );
    }

    const data = (await response!.json()) as {
      content?: { text?: string }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };

    const durationMs = Date.now() - startTime;
    const usage = data.usage;
    const promptTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const totalTokens = promptTokens + outputTokens;
    const costUsd = (promptTokens * 3.0) / 1_000_000 + (outputTokens * 15.0) / 1_000_000;

    this.logger.log(
      `Claude call | Model: ${this.model} | Duration: ${durationMs}ms | ` +
        `Tokens: ${promptTokens} in, ${outputTokens} out, ${totalTokens} total | ` +
        `Cost: $${costUsd.toFixed(6)}`,
    );

    const rawText: string = data?.content?.[0]?.text ?? '';

    return this.parseJson(rawText);
  }
}
