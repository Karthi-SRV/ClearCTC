import { ClaudeAiClient } from './claude-ai-client.js';
import { AiParseError } from './ai-parse.error.js';

function makeClient(): ClaudeAiClient {
  const config = { get: (_k: string, def: string) => def } as any;
  return new ClaudeAiClient(config);
}

describe('ClaudeAiClient.parseJson', () => {
  let client: ClaudeAiClient;

  beforeEach(() => {
    client = makeClient();
  });

  it('valid bare JSON → returns parsed object', () => {
    expect(client.parseJson('{"status":"ok","value":42}')).toEqual({ status: 'ok', value: 42 });
  });

  it('response wrapped in ```json ... ``` fences → fences stripped, parses correctly', () => {
    const fenced = '```json\n{"clarificationRequired":false}\n```';
    expect(client.parseJson(fenced)).toEqual({ clarificationRequired: false });
  });

  it('response wrapped in plain ``` ``` fences → fences stripped, parses correctly', () => {
    expect(client.parseJson('```\n{"key":"val"}\n```')).toEqual({ key: 'val' });
  });

  it('non-JSON response → throws AiParseError', () => {
    expect(() => client.parseJson('Sorry, I cannot help with that.')).toThrow(AiParseError);
  });

  it('JSON array (not an object) → throws AiParseError', () => {
    expect(() => client.parseJson('[1, 2, 3]')).toThrow(AiParseError);
  });

  it('JSON null → throws AiParseError', () => {
    expect(() => client.parseJson('null')).toThrow(AiParseError);
  });
});

describe('ClaudeAiClient.call', () => {
  it('calls Anthropic API and returns parsed response', async () => {
    const config = { get: (k: string, def: string) => k === 'ANTHROPIC_API_KEY' ? 'test-key' : def } as any;
    const client = new ClaudeAiClient(config);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"result":"ok"}' }] }),
    }) as any;

    const result = await client.call('sys', 'user');
    expect(result).toEqual({ result: 'ok' });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('API error status → throws AiParseError', async () => {
    const config = { get: (k: string, def: string) => k === 'ANTHROPIC_API_KEY' ? 'test-key' : def } as any;
    const client = new ClaudeAiClient(config);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => '',
    }) as any;

    await expect(client.call('sys', 'user')).rejects.toThrow(AiParseError);
  });
});
