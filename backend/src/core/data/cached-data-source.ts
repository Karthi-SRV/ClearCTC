import { Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Company,
  CompanyDocument,
} from '../../shared/schemas/company.schema.js';
import {
  CityExpense,
  CityExpenseDocument,
} from '../../shared/schemas/city-expense.schema.js';
import {
  BenchmarkResult,
  CompanyRecord,
  DataSource,
} from './data-source.interface.js';
import { escapeRegex } from '../../shared/utils/regex.util.js';

export class CachedDataSource implements DataSource {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(CityExpense.name)
    private readonly cityExpenseModel: Model<CityExpenseDocument>,
  ) {}

  async getCOLIndex(city: string): Promise<number | null> {
    if (!city) return null;
    const key = city.trim();
    if (key.toLowerCase() === 'wfh' || key.toLowerCase() === 'remote')
      return null;
    const doc = await this.cityExpenseModel
      .findOne({ city: new RegExp(`^${escapeRegex(key)}$`, 'i') })
      .select('colIndex')
      .lean()
      .exec();
    return doc?.colIndex ?? null;
  }

  async getCompany(name: string): Promise<CompanyRecord | null> {
    const pattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
    const doc = await this.companyModel
      .findOne({
        $or: [{ name: pattern }, { aliases: pattern }],
      })
      .lean()
      .exec();

    if (!doc) return null;

    return {
      name: doc.name,
      ratings: doc.ratings ?? [],
      reviews: (doc.reviews ?? []) as CompanyRecord['reviews'],
      dataAsOf: doc.dataAsOf,
      aiProfile: (doc.aiProfile ?? null) as CompanyRecord['aiProfile'],
    };
  }

  async getBenchmark(
    company: string,
    role: string,
    experienceYears: number,
  ): Promise<BenchmarkResult | null> {
    const pattern = new RegExp(`^${escapeRegex(company)}$`, 'i');
    const doc = await this.companyModel
      .findOne({
        $or: [{ name: pattern }, { aliases: pattern }],
      })
      .lean()
      .exec();

    if (!doc) return null;

    const rolePattern = new RegExp(escapeRegex(role), 'i');
    const bench = (doc.roles ?? []).find(
      (r) =>
        rolePattern.test(r.title) &&
        experienceYears >= r.experienceMin &&
        experienceYears <= r.experienceMax,
    );

    if (!bench) return null;

    return {
      avgCTC: bench.avgCTC,
      experienceMidpoint: (bench.experienceMin + bench.experienceMax) / 2,
      source: 'seeded',
      dataAsOf: doc.dataAsOf,
    };
  }

  async getCompanyNames(): Promise<string[]> {
    const docs = await this.companyModel
      .find({}, { name: 1 })
      .sort({ name: 1 })
      .lean()
      .exec();
    return docs.map((d) => d.name);
  }
}
