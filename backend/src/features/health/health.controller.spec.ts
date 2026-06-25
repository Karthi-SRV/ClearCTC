import { HealthController } from './health.controller.js';
import type { Connection } from 'mongoose';

describe('HealthController', () => {
  it('returns connected when db.readyState is 1', () => {
    const ctrl = new HealthController({ readyState: 1 } as Connection);
    expect(ctrl.getHealth()).toEqual({ status: 'ok', db: 'connected' });
  });

  it('returns disconnected when db.readyState is not 1', () => {
    const ctrl = new HealthController({ readyState: 0 } as Connection);
    expect(ctrl.getHealth()).toEqual({ status: 'ok', db: 'disconnected' });
  });
});
