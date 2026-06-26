export const AI_CLIENT = 'AI_CLIENT';

// Domain-specific tokens — consumers inject these, never the concrete classes.
// Routing is enforced here so individual services don't need to know which
// provider is active; AiModule wires the concrete client once.
export const CITY_EXPENSE_AI_CLIENT = 'CITY_EXPENSE_AI_CLIENT'; // always Ollama
export const COMPANY_AI_CLIENT = 'COMPANY_AI_CLIENT'; // always Gemini

// Prefix on AiParseError messages when Gemini account quota is fully exhausted.
// Seeders and callers check for this to bail out without retrying.
export const GEMINI_QUOTA_EXHAUSTED_PREFIX = '[GEMINI_QUOTA_EXHAUSTED]';

export interface AiClient {
  call(systemPrompt: string, userPrompt: string): Promise<object>;
}
