import { VertexAI } from '@google-cloud/vertexai';
import { GoogleAiClient } from './google-ai-client.js';
import { AiParseError } from './ai-parse.error.js';

jest.mock('@google-cloud/vertexai');

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

function setupVertexMock() {
  (VertexAI as jest.MockedClass<typeof VertexAI>).mockImplementation(
    () => ({ getGenerativeModel: mockGetGenerativeModel }) as any,
  );
}

function makeClient(project = 'test-project') {
  const config = {
    get: (k: string, def: string) => (k === 'VERTEX_PROJECT' ? project : def),
  } as any;
  return new GoogleAiClient(config);
}

function vertexOk(text: string) {
  mockGenerateContent.mockResolvedValue({
    response: { candidates: [{ content: { parts: [{ text }] } }] },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setupVertexMock();
});

describe('GoogleAiClient.call — config guard', () => {
  it('throws AiParseError when VERTEX_PROJECT is not set', async () => {
    const client = makeClient('');
    await expect(client.call('sys', 'user')).rejects.toThrow(AiParseError);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});

describe('GoogleAiClient.call — success path', () => {
  it('returns parsed JSON from Vertex AI text', async () => {
    vertexOk('{"score":42}');
    expect(await makeClient().call('sys', 'user')).toEqual({ score: 42 });
  });

  it('strips ```json fences before parsing', async () => {
    vertexOk('```json\n{"ok":true}\n```');
    expect(await makeClient().call('sys', 'user')).toEqual({ ok: true });
  });

  it('passes system prompt and user prompt to the model', async () => {
    vertexOk('{"x":1}');
    await makeClient().call('SYSTEM', 'USER');
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [{ role: 'user', parts: [{ text: 'USER' }] }],
        systemInstruction: { role: 'system', parts: [{ text: 'SYSTEM' }] },
      }),
    );
  });
});

describe('GoogleAiClient.call — error paths', () => {
  it('network error → throws AiParseError', async () => {
    mockGenerateContent.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(AiParseError);
  });

  it('empty candidates → throws AiParseError (empty string fails JSON parse)', async () => {
    mockGenerateContent.mockResolvedValue({ response: { candidates: [] } });
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(AiParseError);
  });

  it('non-JSON text → throws AiParseError', async () => {
    vertexOk('Sorry, I cannot help with that.');
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(AiParseError);
  });

  it('JSON array response → throws AiParseError', async () => {
    vertexOk('[1, 2, 3]');
    await expect(makeClient().call('sys', 'user')).rejects.toThrow(AiParseError);
  });
});
