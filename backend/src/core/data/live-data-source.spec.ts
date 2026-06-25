import { NotImplementedException } from '@nestjs/common';
import { LiveDataSource } from './live-data-source.js';

describe('LiveDataSource', () => {
  let ds: LiveDataSource;

  beforeEach(() => {
    ds = new LiveDataSource();
  });

  it('getCompany throws NotImplementedException', () => {
    expect(() => ds.getCompany('Acme')).toThrow(NotImplementedException);
  });

  it('getBenchmark throws NotImplementedException', () => {
    expect(() => ds.getBenchmark('Acme', 'SDE', 3)).toThrow(
      NotImplementedException,
    );
  });

  it('getCOLIndex throws NotImplementedException', () => {
    expect(() => ds.getCOLIndex('Bangalore')).toThrow(NotImplementedException);
  });
});
