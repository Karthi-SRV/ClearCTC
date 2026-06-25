import { AiExceptionFilter } from './ai-exception.filter.js';
import { AiParseError } from '../../core/ai/ai-parse.error.js';

function makeHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  return {
    host: {
      switchToHttp: () => ({ getResponse: () => response }),
    } as never,
    response,
    json,
    status,
  };
}

describe('AiExceptionFilter', () => {
  it('responds with 502 and error message', () => {
    const filter = new AiExceptionFilter();
    const { host, status, json } = makeHost();
    const err = new AiParseError('model returned garbage');

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(502);
    expect(json).toHaveBeenCalledWith({
      error: 'AI response could not be parsed. Please try again.',
    });
  });
});
