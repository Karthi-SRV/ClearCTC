# Skill: ai-provider-strategy

## When to load this skill

Load this skill whenever any task involves:
- Adding a new AI provider (Claude, Gemini, Ollama, OpenAI)
- Wiring an AI client into a NestJS module
- Changing which AI model is active
- Designing a prompt that must return structured JSON
- Adding or modifying the AI injection token

---

## Core pattern: Strategy + DI token

The goal: swap any AI provider by changing one env var and one DI binding.
Business logic (services, prompt builders) never references a concrete client.

### The interface (never changes)
```typescript
// shared/interfaces/ai-client.interface.ts
export interface AiClient {
  complete(prompt: AiPrompt): Promise<AiRawResponse>;
}

export interface AiPrompt {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface AiRawResponse {
  content: string;   // raw string from provider — strip fences before parsing
  model: string;     // actual model that responded — log, never send to client
  provider: string;  // 'claude' | 'gemini' | 'ollama'
}
```

### The injection token
```typescript
// core/ai/ai.module.ts
export const AI_CLIENT = 'AI_CLIENT';
```

### The module binding (env-driven)
```typescript
@Module({
  providers: [
    {
      provide: AI_CLIENT,
      useFactory: (config: ConfigService): AiClient => {
        const provider = config.get<string>('AI_PROVIDER', 'claude');
        switch (provider) {
          case 'gemini': return new GeminiAiClient(config);
          case 'ollama': return new OllamaAiClient(config);
          case 'claude':
          default:       return new ClaudeAiClient(config);
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [AI_CLIENT],
})
export class AiModule {}
```

### Consumer injection (always inject the token — never the concrete class)
```typescript
// ✓ Correct — injects the interface
constructor(
  @Inject(AI_CLIENT) private readonly aiClient: AiClient,
) {}

// ✗ Wrong — imports concrete class, breaks the pattern
constructor(private readonly claudeClient: ClaudeAiClient) {}
```

---

## Implementing a new provider

Every provider must:
1. Implement `AiClient` interface.
2. Read credentials from `ConfigService` — never hardcode.
3. Strip markdown fences before returning content.
4. Set `provider` and `model` fields in `AiRawResponse`.
5. Throw `AiParseError` on malformed response — never let raw errors bubble up.
6. Have an explicit request timeout.

### Claude implementation
```typescript
@Injectable()
export class ClaudeAiClient implements AiClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('ANTHROPIC_API_KEY');
    this.model  = config.get<string>('CLAUDE_MODEL', 'claude-sonnet-4-6');
  }

  async complete(prompt: AiPrompt): Promise<AiRawResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: prompt.maxTokens ?? 2048,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
      }),
      signal: AbortSignal.timeout(30_000),   // 30s timeout — mandatory
    });
    if (!response.ok) {
      throw new AiParseError(`Claude API error: ${response.status}`);
    }
    const data = await response.json();
    const content = data.content?.[0]?.text ?? '';
    return {
      content: stripFences(content),
      model: this.model,
      provider: 'claude',
    };
  }
}
```

### Gemini implementation (free tier: gemini-3.1-flash-lite — 500 RPD)
```typescript
@Injectable()
export class GeminiAiClient implements AiClient {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('GEMINI_API_KEY');
    this.model  = config.get<string>('GEMINI_MODEL', 'gemini-3.1-flash-lite');
  }

  async complete(prompt: AiPrompt): Promise<AiRawResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: prompt.system }] },
        contents: [{ parts: [{ text: prompt.user }] }],
        generationConfig: {
          maxOutputTokens: prompt.maxTokens ?? 2048,
          temperature: 0.1,    // low temperature for structured output
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new AiParseError(`Gemini API error: ${response.status}`);
    }
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return {
      content: stripFences(content),
      model: this.model,
      provider: 'gemini',
    };
  }
}
```

### Ollama implementation (local Docker — zero cost, offline-safe)
```typescript
@Injectable()
export class OllamaAiClient implements AiClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.model   = config.get<string>('OLLAMA_MODEL', 'llama3.1:8b');
  }

  async complete(prompt: AiPrompt): Promise<AiRawResponse> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user',   content: prompt.user   },
        ],
        options: { num_predict: prompt.maxTokens ?? 2048 },
      }),
      signal: AbortSignal.timeout(60_000),   // 60s — local models are slower
    });
    if (!response.ok) {
      throw new AiParseError(`Ollama error: ${response.status}`);
    }
    const data = await response.json();
    const content = data.message?.content ?? '';
    return {
      content: stripFences(content),
      model: this.model,
      provider: 'ollama',
    };
  }
}
```

---

## Fence stripping (shared utility)

Every provider must strip markdown fences before returning content.
Local models especially tend to wrap JSON in triple backticks.

```typescript
// shared/utils/strip-fences.util.ts
export function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}
```

---

## AiResponseParser (shared — never use JSON.parse directly)

```typescript
// core/ai/ai-response-parser.ts
export class AiResponseParser {
  static parse<T>(raw: AiRawResponse, validate: (data: unknown) => T): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.content);
    } catch {
      throw new AiParseError(
        `JSON parse failed for provider ${raw.provider} model ${raw.model}`
      );
    }
    try {
      return validate(parsed);
    } catch (err) {
      throw new AiParseError(
        `Validation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
```

---

## Environment variables

```bash
# .env.example
AI_PROVIDER=claude          # claude | gemini | ollama

# Claude
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-sonnet-4-6

# Gemini (free tier: gemini-3.1-flash-lite = 500 RPD, 15 RPM, 250K TPM)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.1-flash-lite

# Ollama (local Docker)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

---

## Trust boundary rules (never violate)

- AI_CLIENT token is injected only in: CityExpenseFetchService, CompanyFetchService, OfferComparisonService.
- grep for `aiClient.complete` — must return exactly three files.
- AI never computes tax, PF, gratuity, or take-home. It receives already-computed numbers.
- AI never originates a salary figure. It reasons over figures supplied to it.
- AiResponseParser.parse<T>() is the only path from AI response to application data.

---

## Rate limit handling for Gemini free tier

Gemini 3.1 Flash Lite: 15 RPM, 500 RPD, 250K TPM.
Startup warm makes ~10 AI calls (6 city expenses + 4 company profiles).
To stay under 15 RPM ceiling, batch warm calls:

```typescript
// Warm in batches of 3 with 4s gap — stays under 15 RPM
const batches = chunk(items, 3);
for (const batch of batches) {
  await Promise.allSettled(batch.map(item => this.warmItem(item)));
  if (batches.indexOf(batch) < batches.length - 1) {
    await sleep(4_000);
  }
}
```

---

## Demo swap sequence (for the video)

1. Default: `AI_PROVIDER=claude` — show offer comparison result.
2. Switch: set `AI_PROVIDER=gemini` in `.env`, restart.
3. Repeat same request — same structure, same validation, different provider.
4. Say: "One env var change. The business logic is untouched. The abstraction holds."