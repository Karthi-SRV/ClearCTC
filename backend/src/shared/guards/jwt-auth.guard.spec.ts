import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

function makeCtx({
  isPublic = false,
  authHeader = '',
}: { isPublic?: boolean; authHeader?: string } = {}) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  };
  const config = {
    getOrThrow: jest.fn().mockReturnValue('test-secret'),
  };
  const request = {
    headers: { authorization: authHeader },
    user: undefined as unknown,
  };
  const ctx = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  };
  return { reflector, config, ctx, request };
}

describe('JwtAuthGuard', () => {
  it('allows public routes without a token', () => {
    const { reflector, config, ctx } = makeCtx({ isPublic: true });
    const guard = new JwtAuthGuard(
      { verify: jest.fn() } as never,
      reflector as never,
      config as never,
    );
    expect(guard.canActivate(ctx as never)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      expect.any(Array),
    );
  });

  it('throws UnauthorizedException when no Authorization header', () => {
    const { reflector, config, ctx } = makeCtx({
      isPublic: false,
      authHeader: '',
    });
    const guard = new JwtAuthGuard(
      { verify: jest.fn() } as never,
      reflector as never,
      config as never,
    );
    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException for non-Bearer scheme', () => {
    const { reflector, config, ctx } = makeCtx({
      isPublic: false,
      authHeader: 'Basic abc123',
    });
    const guard = new JwtAuthGuard(
      { verify: jest.fn() } as never,
      reflector as never,
      config as never,
    );
    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
  });

  it('returns true and sets request.user when token is valid', () => {
    const payload = { sub: 'user1', email: 'a@b.com' };
    const jwtMock = { verify: jest.fn().mockReturnValue(payload) };
    const { reflector, config, ctx, request } = makeCtx({
      isPublic: false,
      authHeader: 'Bearer valid-token',
    });
    const guard = new JwtAuthGuard(
      jwtMock as never,
      reflector as never,
      config as never,
    );

    expect(guard.canActivate(ctx as never)).toBe(true);
    expect(request.user).toEqual(payload);
    expect(jwtMock.verify).toHaveBeenCalledWith('valid-token', {
      secret: 'test-secret',
    });
  });

  it('throws UnauthorizedException when jwt.verify throws', () => {
    const jwtMock = {
      verify: jest.fn().mockImplementation(() => {
        throw new Error('expired');
      }),
    };
    const { reflector, config, ctx } = makeCtx({
      isPublic: false,
      authHeader: 'Bearer bad-token',
    });
    const guard = new JwtAuthGuard(
      jwtMock as never,
      reflector as never,
      config as never,
    );

    expect(() => guard.canActivate(ctx as never)).toThrow(
      UnauthorizedException,
    );
  });
});
