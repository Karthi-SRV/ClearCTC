import { HttpException, HttpStatus } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor.js';

function makeCtx(method = 'GET', url = '/api/v1/test', statusCode = 200) {
  const request = { method, url, route: { path: '/api/v1/test' } };
  const response = { statusCode };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as never;
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('passes through the response for a successful 200 request', (done) => {
    const ctx = makeCtx('GET', '/api/v1/health', 200);
    const next = { handle: () => of({ status: 'ok' }) };

    interceptor.intercept(ctx, next as never).subscribe({
      next: (val) => {
        expect(val).toEqual({ status: 'ok' });
      },
      complete: done,
    });
  });

  it('records error status from HttpException in the error tap', (done) => {
    const ctx = makeCtx('POST', '/api/v1/auth/login', 200);
    const err = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    const next = { handle: () => throwError(() => err) };

    interceptor.intercept(ctx, next as never).subscribe({
      error: (e) => {
        expect(e).toBe(err);
        done();
      },
    });
  });

  it('handles non-HttpException errors without throwing', (done) => {
    const ctx = makeCtx('GET', '/api/v1/broken', 500);
    const next = { handle: () => throwError(() => new Error('internal')) };

    interceptor.intercept(ctx, next as never).subscribe({
      error: (e) => {
        expect(e.message).toBe('internal');
        done();
      },
    });
  });

  it('handles request without route.path by falling back to url', (done) => {
    const request = { method: 'GET', url: '/unknown-path', route: undefined };
    const response = { statusCode: 200 };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as never;
    const next = { handle: () => of({}) };

    interceptor.intercept(ctx, next as never).subscribe({ complete: done });
  });
});
