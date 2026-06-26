import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VertexAI } from '@google-cloud/vertexai';
import { AiParseError } from './ai-parse.error.js';
import { AiResponseParser } from './ai-response-parser.js';

@Injectable()
export class GoogleAiClient extends AiResponseParser {
  private readonly logger = new Logger(GoogleAiClient.name);
  private readonly project: string;
  private readonly location: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    super();
    // get() not getOrThrow() — constructor must not throw when another provider is active
    this.project = this.config.get<string>('VERTEX_PROJECT', '');
    this.location = this.config.get<string>('VERTEX_LOCATION', 'us-central1');
    this.model = this.config.get<string>('VERTEX_MODEL', 'gemini-1.5-pro');
  }

  async call(systemPrompt: string, userPrompt: string): Promise<object> {
    if (!this.project) {
      throw new AiParseError(
        'VERTEX_PROJECT is not set. Add it to backend/.env and run: gcloud auth application-default login',
      );
    }

    const vertex = new VertexAI({
      project: this.project,
      location: this.location,
    });
    const generativeModel = vertex.getGenerativeModel({ model: this.model });

    const startTime = Date.now();
    let result: Awaited<ReturnType<typeof generativeModel.generateContent>>;
    try {
      result = await generativeModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      });
    } catch (err: any) {
      throw new AiParseError(
        `Vertex AI connection error: ${err?.message ?? err}`,
      );
    }

    const durationMs = Date.now() - startTime;
    const usage = result.response.usageMetadata;
    const promptTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;
    const totalTokens = usage?.totalTokenCount ?? promptTokens + outputTokens;
    const costUsd =
      (promptTokens * 1.25) / 1_000_000 + (outputTokens * 5.0) / 1_000_000;

    this.logger.log(
      `Google Vertex call | Model: ${this.model} | Duration: ${durationMs}ms | ` +
        `Tokens: ${promptTokens} in, ${outputTokens} out, ${totalTokens} total | ` +
        `Cost: $${costUsd.toFixed(6)}`,
    );

    const rawText =
      result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return this.parseJson(rawText);
  }
}
