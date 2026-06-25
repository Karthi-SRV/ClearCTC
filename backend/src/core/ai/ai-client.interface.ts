export const AI_CLIENT = 'AI_CLIENT';

// Domain-specific tokens — consumers inject these, never the concrete classes.
// Routing is enforced here so individual services don't need to know which
// provider is active; AiModule wires the concrete client once.
export const CITY_EXPENSE_AI_CLIENT = 'CITY_EXPENSE_AI_CLIENT'; // always Ollama
export const COMPANY_AI_CLIENT = 'COMPANY_AI_CLIENT';           // always Gemini

export interface AiClient {
  call(systemPrompt: string, userPrompt: string): Promise<object>;
}
