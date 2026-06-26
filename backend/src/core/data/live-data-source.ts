import { NotImplementedException } from '@nestjs/common';
import {
  BenchmarkResult,
  CompanyRecord,
  DataSource,
} from './data-source.interface.js';

export class LiveDataSource implements DataSource {
  getCompany(_name: string): Promise<CompanyRecord | null> {
    throw new NotImplementedException('Live data source not enabled for demo');
  }

  getBenchmark(
    _company: string,
    _role: string,
    _experienceYears: number,
  ): Promise<BenchmarkResult | null> {
    throw new NotImplementedException('Live data source not enabled for demo');
  }

  getCOLIndex(_city: string): Promise<number | null> {
    throw new NotImplementedException('Live data source not enabled for demo');
  }

  getCompanyNames(): Promise<string[]> {
    return Promise.resolve([]);
  }
}
