import { Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from '../../shared/schemas/company.schema.js';
import {
  BenchmarkResult,
  CompanyRecord,
  DataSource,
} from './data-source.interface.js';

// COL indices relative to Bangalore = 100 (design.md §4)
// Tier-2/3 cities approximated from published cost-of-living surveys.
const COL_INDEX: Record<string, number> = {
  // ── Metro ──────────────────────────────────────────────────────────────────
  bangalore: 100,
  mumbai: 115,
  'delhi ncr': 105,
  delhi: 105,
  noida: 100,
  gurgaon: 103,
  gurugram: 103,
  hyderabad: 90,
  pune: 88,
  chennai: 87,
  kolkata: 75,
  // ── Tier-2 ─────────────────────────────────────────────────────────────────
  ahmedabad: 78,
  surat: 74,
  jaipur: 72,
  lucknow: 70,
  kanpur: 68,
  nagpur: 72,
  indore: 72,
  bhopal: 70,
  visakhapatnam: 74,
  vizag: 74,
  coimbatore: 78,
  madurai: 70,
  tiruchirappalli: 68,
  trichy: 68,
  kochi: 82,
  cochin: 82,
  thiruvananthapuram: 74,
  trivandrum: 74,
  mysore: 76,
  mysuru: 76,
  mangalore: 74,
  mangaluru: 74,
  hubli: 68,
  hubballi: 68,
  chandigarh: 82,
  mohali: 80,
  panchkula: 78,
  amritsar: 72,
  ludhiana: 74,
  jalandhar: 70,
  dehradun: 74,
  bhubaneswar: 72,
  patna: 68,
  ranchi: 66,
  raipur: 66,
  guwahati: 68,
  vadodara: 74,
  rajkot: 68,
  nashik: 74,
  aurangabad: 68,
  kolhapur: 66,
  "navi mumbai": 108,
  thane: 105,
};

export class CachedDataSource implements DataSource {
  constructor(
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
  ) {}

  async getCOLIndex(city: string): Promise<number | null> {
    if (!city) return null;
    const key = city.trim().toLowerCase();
    if (key === 'wfh' || key === 'remote') return null;
    return COL_INDEX[key] ?? null;
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
      ratings: (doc.ratings ?? []) as CompanyRecord['ratings'],
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
