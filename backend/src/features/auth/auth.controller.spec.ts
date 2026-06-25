import { AuthController } from './auth.controller.js';

describe('AuthController', () => {
  const authService = {
    signup: jest.fn(),
    login: jest.fn(),
  };
  const ctrl = new AuthController(authService as never);

  afterEach(() => jest.clearAllMocks());

  it('delegates signup to AuthService and returns its result', async () => {
    const dto = { email: 'a@b.com', password: 'pass' } as never;
    const expected = { accessToken: 'token', user: {} };
    authService.signup.mockResolvedValue(expected);

    const result = await ctrl.signup(dto);
    expect(authService.signup).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });

  it('delegates login to AuthService and returns its result', async () => {
    const dto = { email: 'a@b.com', password: 'pass' } as never;
    const expected = { accessToken: 'token2', user: {} };
    authService.login.mockResolvedValue(expected);

    const result = await ctrl.login(dto);
    expect(authService.login).toHaveBeenCalledWith(dto);
    expect(result).toBe(expected);
  });
});
