import { AiParseError } from './ai-parse.error.js';

export abstract class AiResponseParser {
  abstract call(systemPrompt: string, userPrompt: string): Promise<object>;

  public parseJson(raw: string): object {
    const stripped = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new AiParseError(
        `AI response is not valid JSON: ${stripped.slice(0, 120)}`,
      );
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new AiParseError('AI response parsed but is not a JSON object');
    }

    return parsed as object;
  }
}
