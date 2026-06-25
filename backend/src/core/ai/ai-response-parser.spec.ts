import { AiParseError } from './ai-parse.error.js';
import { AiResponseParser } from './ai-response-parser.js';

// Concrete subclass to test the abstract base
class TestParser extends AiResponseParser {
  async call(): Promise<object> {
    return {};
  }
}

describe('AiResponseParser.parseJson', () => {
  let parser: TestParser;

  beforeEach(() => {
    parser = new TestParser();
  });

  it('parses a plain JSON object string', () => {
    const result = parser.parseJson('{"key": "value", "n": 42}');
    expect(result).toEqual({ key: 'value', n: 42 });
  });

  it('strips ```json ... ``` code fence', () => {
    const result = parser.parseJson('```json\n{"a": 1}\n```');
    expect(result).toEqual({ a: 1 });
  });

  it('strips ``` ... ``` code fence without language tag', () => {
    const result = parser.parseJson('```\n{"b": 2}\n```');
    expect(result).toEqual({ b: 2 });
  });

  it('handles leading/trailing whitespace around valid JSON', () => {
    const result = parser.parseJson('  \n  {"c": 3}  \n  ');
    expect(result).toEqual({ c: 3 });
  });

  it('throws AiParseError when JSON is invalid', () => {
    expect(() => parser.parseJson('not json at all')).toThrow(AiParseError);
  });

  it('throws AiParseError when response is a JSON array', () => {
    expect(() => parser.parseJson('[1, 2, 3]')).toThrow(AiParseError);
  });

  it('throws AiParseError when response is JSON null', () => {
    expect(() => parser.parseJson('null')).toThrow(AiParseError);
  });

  it('throws AiParseError when response is a bare string', () => {
    expect(() => parser.parseJson('"just a string"')).toThrow(AiParseError);
  });

  it('throws AiParseError when response is an empty string', () => {
    expect(() => parser.parseJson('')).toThrow(AiParseError);
  });
});
