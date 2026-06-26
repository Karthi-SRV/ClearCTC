import { GeminiAiClient } from './gemini-ai-client.js';
import { AiParseError } from './ai-parse.error.js';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeClient(apiKey = 'test-key', model = 'gemini-2.0-flash') {
  const config = {
    get: (k: string, def: string) => {
      if (k === 'GEMINI_API_KEY') return apiKey;
      if (k === 'GEMINI_MODEL') return model;
      return def;
    },
  } as any;
  return new GeminiAiClient(config);
}

function geminiOk(text: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GeminiAiClient.call — config guard', () => {
  it('throws AiParseError when GEMINI_API_KEY is not set', async () => {
    const client = makeClient('');
    await expect(client.call('sys', 'user')).rejects.toThrow(AiParseError);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('GeminiAiClient.call — success path', () => {
  it('returns parsed JSON from Gemini text', async () => {
    geminiOk('{"score":42}');
    expect(await makeClient().call('sys', 'user')).toEqual({ score: 42 });
  });

  it('strips ```json fences before parsing', async () => {
    geminiOk('```json\n{"ok":true}\n```');
    expect(await makeClient().call('sys', 'user')).toEqual({ ok: true });
  });

  it('passes system prompt and user prompt in the request body', async () => {
    geminiOk('{"x":1}');
    await makeClient().call('SYSTEM', 'USER');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.system_instruction.parts[0].text).toBe('SYSTEM');
    expect(body.contents[0].parts[0].text).toBe('USER');
    expect(body.generationConfig.response_mime_type).toBe('application/json');
  });

  it('includes the API key in the URL', async () => {
    geminiOk('{"x":1}');
    await makeClient('my-api-key').call('s', 'u');
    expect(mockFetch.mock.calls[0][0]).toContain('key=my-api-key');
  });
});

describe('GeminiAiClient.call — error paths', () => {
  it('network error → throws AiParseError', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(
      AiParseError,
    );
  });

  it('HTTP 4xx → throws AiParseError with status info', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'API key not valid',
    });
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(
      AiParseError,
    );
  });

  it('empty candidates → throws AiParseError', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(
      AiParseError,
    );
  });

  it('non-JSON text → throws AiParseError', async () => {
    geminiOk('Sorry, I cannot help with that.');
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(
      AiParseError,
    );
  });

  it('JSON array response → throws AiParseError', async () => {
    geminiOk('[1, 2, 3]');
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(
      AiParseError,
    );
  });
});
