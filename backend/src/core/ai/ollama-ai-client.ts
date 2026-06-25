import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiParseError } from './ai-parse.error.js';
import { AiResponseParser } from './ai-response-parser.js';

@Injectable()
export class OllamaAiClient extends AiResponseParser {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.baseUrl = this.config.get<string>(
      'OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    this.model = this.config.get<string>('OLLAMA_MODEL', 'llama3.2');
  }

  async call(systemPrompt: string, userPrompt: string): Promise<object> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          format: 'json',
        }),
      });
    } catch (err: any) {
      throw new AiParseError(`Ollama connection error: ${err?.message ?? err}`);
    }

    if (!response.ok) {
      throw new AiParseError(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as any;
    const rawText: string = data?.message?.content ?? '';

    return this.parseJson(rawText);
  }
}
