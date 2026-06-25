import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiParseError } from './ai-parse.error.js';
import { AiResponseParser } from './ai-response-parser.js';

const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

// Free tier: 15 RPM. On transient rate-limit 429s, back off then retry.
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [15_000, 30_000, 60_000];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Detects a hard quota exhaustion (account/daily limit) vs a soft rate-limit hit.
// Quota exhaustion: body mentions "billing" — no amount of retrying will help.
// Rate limit: body mentions "per minute" / "per_minute" / has Retry-After header.
function isQuotaExhausted(body: string): boolean {
  const lower = body.toLowerCase();
  return lower.includes('billing') || lower.includes('check your plan');
}

// Exported so seeders can bail out early without hammering an exhausted quota.
export const GEMINI_QUOTA_EXHAUSTED_PREFIX = '[GEMINI_QUOTA_EXHAUSTED]';

@Injectable()
export class GeminiAiClient extends AiResponseParser {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    super();
    // get() not getOrThrow() — constructor must not throw when another provider is active
    this.apiKey = this.config.get<string>('GEMINI_API_KEY', '');
    this.model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.0-flash');
  }

  async call(systemPrompt: string, userPrompt: string): Promise<object> {
    if (!this.apiKey) {
      throw new AiParseError(
        'GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and add it to backend/.env.',
      );
    }

    const url = `${GEMINI_BASE_URL}/${this.model}:generateContent?key=${this.apiKey}`;
    const reqBody = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { response_mime_type: 'application/json' },
    });

    let response: Response;
    let attempt = 0;

    while (true) {
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: reqBody,
        });
      } catch (err: any) {
        throw new AiParseError(`Gemini connection error: ${err?.message ?? err}`);
      }

      if (response.status === 429) {
        const body = await response.text().catch(() => '');

        // Hard quota exhaustion — retrying is pointless; caller must stop.
        if (isQuotaExhausted(body)) {
          throw new AiParseError(
            `${GEMINI_QUOTA_EXHAUSTED_PREFIX} Account quota exhausted. ` +
            `Get a new API key at https://aistudio.google.com/apikey or wait for the daily reset. ` +
            `Original error: ${body.slice(0, 200)}`,
          );
        }

        // Soft rate-limit — back off and retry.
        if (attempt < MAX_RETRIES) {
          const retryAfterSec = parseInt(response.headers.get('Retry-After') ?? '0', 10);
          const delayMs = retryAfterSec > 0 ? retryAfterSec * 1000 : RETRY_DELAYS_MS[attempt];
          attempt++;
          await sleep(delayMs);
          continue;
        }

        // Retries exhausted.
        throw new AiParseError(
          `Gemini API error: 429 Too Many Requests (${MAX_RETRIES} retries exhausted). ` +
          body.slice(0, 200),
        );
      }

      break;
    }

    if (!response!.ok) {
      const body = await response!.text().catch(() => '');
      throw new AiParseError(
        `Gemini API error: ${response!.status} ${response!.statusText}${body ? ' — ' + body.slice(0, 200) : ''}`,
      );
    }

    const data = (await response!.json()) as any;
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return this.parseJson(rawText);
  }
}
