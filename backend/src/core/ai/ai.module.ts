import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AI_CLIENT,
  CITY_EXPENSE_AI_CLIENT,
  COMPANY_AI_CLIENT,
} from './ai-client.interface.js';
import { ClaudeAiClient } from './claude-ai-client.js';
import { GeminiAiClient } from './gemini-ai-client.js';
import { GoogleAiClient } from './google-ai-client.js';
import { OllamaAiClient } from './ollama-ai-client.js';

@Module({
  providers: [
    ClaudeAiClient,
    GeminiAiClient,
    GoogleAiClient,
    OllamaAiClient,
    // Generic AI_CLIENT — selected at runtime by AI_PROVIDER env var.
    {
      provide: AI_CLIENT,
      useFactory: (
        config: ConfigService,
        claude: ClaudeAiClient,
        gemini: GeminiAiClient,
        google: GoogleAiClient,
        ollama: OllamaAiClient,
      ) => {
        const provider = config.get<string>('AI_PROVIDER', 'gemini');
        if (provider === 'ollama') return ollama;
        if (provider === 'claude') return claude;
        if (provider === 'gemini') return gemini;
        if (provider === 'google') return google;
        throw new Error(
          `Unknown AI_PROVIDER "${provider}". Supported values: claude | gemini | ollama | google`,
        );
      },
      inject: [
        ConfigService,
        ClaudeAiClient,
        GeminiAiClient,
        GoogleAiClient,
        OllamaAiClient,
      ],
    },
    // Domain-specific tokens — dynamic or hard-wired
    { provide: CITY_EXPENSE_AI_CLIENT, useExisting: AI_CLIENT },
    { provide: COMPANY_AI_CLIENT, useExisting: GeminiAiClient },
  ],
  exports: [AI_CLIENT, CITY_EXPENSE_AI_CLIENT, COMPANY_AI_CLIENT],
})
export class AiModule {}
