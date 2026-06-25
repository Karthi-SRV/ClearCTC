import { AdminGuard } from './admin.guard.js';

function makeCtx(adminTokenHeader: string) {
  const request = { headers: { 'x-admin-token': adminTokenHeader } };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

describe('AdminGuard', () => {
  it('returns false when ADMIN_TOKEN is not configured', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const guard = new AdminGuard(config as never);
    expect(guard.canActivate(makeCtx('anything') as never)).toBe(false);
  });

  it('returns true when header matches configured token', () => {
    const config = { get: jest.fn().mockReturnValue('secret-token') };
    const guard = new AdminGuard(config as never);
    expect(guard.canActivate(makeCtx('secret-token') as never)).toBe(true);
  });

  it('returns false when header does not match configured token', () => {
    const config = { get: jest.fn().mockReturnValue('secret-token') };
    const guard = new AdminGuard(config as never);
    expect(guard.canActivate(makeCtx('wrong-token') as never)).toBe(false);
  });

  it('returns false when no header is provided', () => {
    const config = { get: jest.fn().mockReturnValue('secret-token') };
    const guard = new AdminGuard(config as never);
    expect(guard.canActivate(makeCtx('') as never)).toBe(false);
  });
});
