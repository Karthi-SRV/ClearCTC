import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiParseError } from './ai-parse.error.js';
import { AiResponseParser } from './ai-response-parser.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

@Injectable()
export class ClaudeAiClient extends AiResponseParser {
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

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
    } catch (err: any) {
      throw new AiParseError(`Anthropic connection error: ${err?.message ?? err}`);
    }

    if (!response.ok) {
      throw new AiParseError(
        `Anthropic API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as any;
    const rawText: string = data?.content?.[0]?.text ?? '';

    return this.parseJson(rawText);
  }
}
