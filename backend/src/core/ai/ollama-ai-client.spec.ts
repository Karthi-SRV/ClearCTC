import { OllamaAiClient } from './ollama-ai-client.js';
import { AiParseError } from './ai-parse.error.js';

function makeClient(overrides: Record<string, string> = {}) {
  const config = {
    get: (k: string, def: string) => overrides[k] ?? def,
  };
  return new OllamaAiClient(config as never);
}

describe('OllamaAiClient.call', () => {
  it('calls Ollama and returns parsed JSON response', async () => {
    const client = makeClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: '{"result":"ok"}' },
        prompt_eval_count: 10,
        eval_count: 5,
      }),
    }) as never;

    const result = await client.call('system', 'user');

    expect(result).toEqual({ result: 'ok' });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses configured OLLAMA_BASE_URL and OLLAMA_MODEL', async () => {
    const client = makeClient({
      OLLAMA_BASE_URL: 'http://myollama:11434',
      OLLAMA_MODEL: 'mistral',
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '{"ok":true}' } }),
    }) as never;

    await client.call('sys', 'user');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://myollama:11434/api/chat');
    expect(JSON.parse(init.body as string).model).toBe('mistral');
  });

  it('throws AiParseError on connection error', async () => {
    const client = makeClient();
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('ECONNREFUSED')) as never;

    await expect(client.call('sys', 'user')).rejects.toThrow(AiParseError);
    await expect(client.call('sys', 'user')).rejects.toThrow(
      'Ollama connection error',
    );
  });

  it('throws AiParseError on non-OK HTTP status', async () => {
    const client = makeClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }) as never;

    await expect(client.call('sys', 'user')).rejects.toThrow(AiParseError);
    await expect(client.call('sys', 'user')).rejects.toThrow(
      'Ollama API error: 503',
    );
  });

  it('throws AiParseError when response content is not valid JSON', async () => {
    const client = makeClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: 'not json' } }),
    }) as never;

    await expect(client.call('sys', 'user')).rejects.toThrow(AiParseError);
  });

  it('handles missing message.content (empty string → AiParseError)', async () => {
    const client = makeClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as never;

    await expect(client.call('sys', 'user')).rejects.toThrow(AiParseError);
  });
});
