import { HttpException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import type { Connection } from 'mongoose';

function makeController(readyState: number, pingResult: 'ok' | Error) {
  const redis = {
    ping:
      pingResult instanceof Error
        ? jest.fn().mockRejectedValue(pingResult)
        : jest.fn().mockResolvedValue('PONG'),
  };
  return new HealthController({ readyState } as Connection, redis as never);
}

describe('HealthController', () => {
  it('returns ok when db connected and redis pings', async () => {
    const ctrl = makeController(1, 'ok');
    const result = await ctrl.getHealth();
    expect(result).toEqual({
      status: 'ok',
      db: 'connected',
      cache: 'ok',
      uptime: expect.any(Number),
    });
  });

  it('throws 503 when db is disconnected', async () => {
    const ctrl = makeController(0, 'ok');
    await expect(ctrl.getHealth()).rejects.toThrow(HttpException);
  });

  it('throws 503 when redis ping fails', async () => {
    const ctrl = makeController(1, new Error('connection refused'));
    await expect(ctrl.getHealth()).rejects.toThrow(HttpException);
  });

  it('503 body contains degraded status and dependency states', async () => {
    const ctrl = makeController(0, new Error('no redis'));
    try {
      await ctrl.getHealth();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const body = (err as HttpException).getResponse();
      expect(body).toMatchObject({
        status: 'degraded',
        db: 'disconnected',
        cache: 'error',
      });
    }
  });
});
