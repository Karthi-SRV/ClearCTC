export const DATA_SOURCE = 'DATA_SOURCE';

export interface RatingSet {
  source: string;
  wlb: number;
  culture: number;
  growth: number;
  jobSecurity: number;
}

export interface ReviewSnippet {
  text: string;
  source: string;
  date: string; // YYYY-MM
  sentiment: 'positive' | 'negative' | 'mixed';
  dimension: 'wlb' | 'culture' | 'growth' | 'jobSecurity' | 'general';
}

export interface BenchmarkResult {
  avgCTC: number;
  experienceMidpoint: number;
  source: 'seeded';
  dataAsOf: Date;
}

export interface AiProfile {
  companySize: string;
  basicInsurance: string;
  otherBenefits: string[];
  pros: string[];
  cons: string[];
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  benefitForRisk: string;
  generatedAt: Date;
}

export interface CompanyRecord {
  name: string;
  ratings: RatingSet[];
  reviews: ReviewSnippet[];
  dataAsOf: Date;
  aiProfile: AiProfile | null;
}

export interface DataSource {
  getCompany(name: string): Promise<CompanyRecord | null>;
  getBenchmark(
    company: string,
    role: string,
    experienceYears: number,
  ): Promise<BenchmarkResult | null>;
  getCOLIndex(city: string): Promise<number | null>;
  getCompanyNames(): Promise<string[]>;
}
