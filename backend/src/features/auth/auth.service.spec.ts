import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service.js';

function makeService(modelMock: object, jwtMock: object) {
  const service = new AuthService(modelMock as never, jwtMock as never);
  return service;
}

const baseUserDoc = {
  _id: { toString: () => 'user-id-1' },
  email: 'test@example.com',
  passwordHash: 'hashed',
  currentCity: 'Bangalore',
  currentCtcLpa: 20,
  basicPayLpa: 16,
  variablePayLpa: 4,
  isFixed: false,
  expectedHikePct: 20,
  currentRole: 'SDE2',
  preferredCities: ['Pune'],
};

describe('AuthService.signup', () => {
  it('creates a user and returns accessToken + user profile', async () => {
    const modelMock = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      }),
      create: jest.fn().mockResolvedValue(baseUserDoc),
    };
    const jwtMock = { sign: jest.fn().mockReturnValue('jwt-token') };
    const service = makeService(modelMock, jwtMock);

    const result = await service.signup({
      email: 'TEST@EXAMPLE.COM',
      password: 'pass',
      currentCity: 'Bangalore',
      basicPayLpa: 16,
      variablePayLpa: 4,
      currentCtcLpa: 20,
      isFixed: false,
      expectedHikePct: 20,
      currentRole: 'SDE2',
    });

    expect(result.accessToken).toBe('jwt-token');
    expect(result.user.email).toBe('test@example.com');
    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
    );
  });

  it('zeroes variablePayLpa when isFixed is true', async () => {
    const modelMock = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve(null) }),
      }),
      create: jest.fn().mockResolvedValue({
        ...baseUserDoc,
        variablePayLpa: 0,
        isFixed: true,
      }),
    };
    const jwtMock = { sign: jest.fn().mockReturnValue('t') };
    const service = makeService(modelMock, jwtMock);

    await service.signup({
      email: 'a@b.com',
      password: 'p',
      currentCity: 'Mumbai',
      basicPayLpa: 20,
      variablePayLpa: 5,
      currentCtcLpa: 20,
      isFixed: true,
      expectedHikePct: 10,
      currentRole: 'SDE1',
    });

    expect(modelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ variablePayLpa: 0 }),
    );
  });

  it('throws ConflictException when email already exists', async () => {
    const modelMock = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({
          exec: () => Promise.resolve({ email: 'test@example.com' }),
        }),
      }),
    };
    const service = makeService(modelMock, {});

    await expect(
      service.signup({
        email: 'test@example.com',
        password: 'pass',
        currentCity: 'Bangalore',
        basicPayLpa: 16,
        variablePayLpa: 4,
        currentCtcLpa: 20,
        isFixed: false,
        expectedHikePct: 20,
        currentRole: 'SDE2',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('AuthService.login', () => {
  it('returns accessToken + profile on valid credentials', async () => {
    const hash = await bcrypt.hash('correct-pass', 1);
    const userDoc = { ...baseUserDoc, passwordHash: hash };
    const modelMock = {
      findOne: jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(userDoc) }),
    };
    const jwtMock = { sign: jest.fn().mockReturnValue('login-token') };
    const service = makeService(modelMock, jwtMock);

    const result = await service.login({
      email: 'test@example.com',
      password: 'correct-pass',
    });
    expect(result.accessToken).toBe('login-token');
    expect(result.user.email).toBe('test@example.com');
  });

  it('throws UnauthorizedException when email not found', async () => {
    const modelMock = {
      findOne: jest.fn().mockReturnValue({ exec: () => Promise.resolve(null) }),
    };
    const service = makeService(modelMock, {});

    await expect(
      service.login({ email: 'no@user.com', password: 'x' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when password is wrong', async () => {
    const hash = await bcrypt.hash('right', 1);
    const userDoc = { ...baseUserDoc, passwordHash: hash };
    const modelMock = {
      findOne: jest
        .fn()
        .mockReturnValue({ exec: () => Promise.resolve(userDoc) }),
    };
    const service = makeService(modelMock, {});

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
