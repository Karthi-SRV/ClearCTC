import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AiParseError } from '../../core/ai/ai-parse.error.js';
import type { AiClient } from '../../core/ai/ai-client.interface.js';
import { COMPANY_AI_CLIENT } from '../../core/ai/ai-client.interface.js';
import { CompensationService } from '../../core/compensation/compensation.service.js';
import type { DataSource, CompanyRecord, RatingSet } from '../../core/data/data-source.interface.js';
import { DATA_SOURCE } from '../../core/data/data-source.interface.js';
import { CityExpenseService } from '../../core/city-expense/city-expense.service.js';
import { User, UserDocument } from '../../shared/schemas/user.schema.js';
import type { OfferInputDto } from '../../shared/dtos/offer-input.dto.js';
import { CreateOfferComparisonDto } from '../../shared/dtos/offer-input.dto.js';
import type { OfferSnapshot, ExpenseBreakdownItem } from '../../core/compensation/compensation.service.js';
import type {
  OfferComparisonResponseDto,
  OfferResultDto,
  EmployeeRatingDto,
} from './dtos/offer-comparison-response.dto.js';
import { OffersService } from './offers.service.js';

// ── AI response types ─────────────────────────────────────────────────────────
// AI only returns score + scoreBreakdown per offer (qualitative fields are
// pre-stored in Company.aiProfile and merged here, never re-derived by AI).
// For companies without a stored aiProfile the optional qualitative fields
// are also returned by AI so the response degrades gracefully.

interface AiOfferEntry {
  companyName: string;
  // Optional — only present for companies without a stored aiProfile
  companySize?: string;
  basicInsurance?: string;
  otherBenefits?: string[];
  pros?: string[];
  cons?: string[];
  riskAssessment?: {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    benefitForRisk: string;
  };
  // Always present
  score: number;
  scoreBreakdown: {
    financial: number;
    qualitative: number;
    risk: number;
  };
}

interface AiResponse {
  offers: AiOfferEntry[];
  recommendation: {
    bestOffer: string;
    suggestion: string;
    whyBest: string;
    whyNotOthers: Record<string, string>;
    confidence: 'high' | 'medium' | 'low';
    caveat: string;
  };
}

const DATA_DISCLAIMER =
  'Tax: new regime FY2025-26 · Ratings: seeded data · Expenses: illustrative estimates · Decision support only';

const SYSTEM_PROMPT =
  'You are a senior compensation analyst helping an Indian software engineer make a job-switching decision. ' +
  'You reason over structured data supplied to you. You never invent salary figures, ratings, company facts, or benefits not present in the supplied data. ' +
  'Every claim must cite which data field drove it. Return only valid JSON. Start with { and end with }.';

@Injectable()
export class OfferComparisonService {
  private readonly logger = new Logger(OfferComparisonService.name);

  constructor(
    private readonly comp: CompensationService,
    @Inject(DATA_SOURCE) private readonly data: DataSource,
    private readonly cityExpenseService: CityExpenseService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(COMPANY_AI_CLIENT) private readonly ai: AiClient,
    private readonly offersService: OffersService,
  ) { }

  // ── Stale detection ──────────────────────────────────────────────────────────

  detectStale(dataAsOf: Date, thresholdDays = 90): boolean {
    return Date.now() - dataAsOf.getTime() > thresholdDays * 86_400_000;
  }

  // ── AI response validation ───────────────────────────────────────────────────

  validateAiResponse(raw: object, inputNames: string[]): AiResponse {
    const result = raw as AiResponse;

    if (!Array.isArray(result.offers)) {
      throw new AiParseError('AI response missing offers array');
    }

    for (const o of result.offers) {
      if (typeof o.score !== 'number' || o.score < 0 || o.score > 100) {
        throw new AiParseError(`score out of range for ${o.companyName}`);
      }

      const { financial = 0, qualitative = 0, risk: riskScore = 0 } = o.scoreBreakdown ?? {};
      const sum = financial + qualitative + riskScore;
      if (Math.abs(sum - o.score) > 1) {
        throw new AiParseError(`scoreBreakdown does not sum to score for ${o.companyName}`);
      }

      if (
        financial < 0 || financial > 40 ||
        qualitative < 0 || qualitative > 40 ||
        riskScore < 0 || riskScore > 20
      ) {
        throw new AiParseError(`scoreBreakdown component out of bounds for ${o.companyName}`);
      }

      // Qualitative fields are optional (only present for unknown companies)
      if (o.pros !== undefined && (!Array.isArray(o.pros) || o.pros.length > 4)) {
        throw new AiParseError(`pros exceeds 4 items for ${o.companyName}`);
      }
      if (o.cons !== undefined && (!Array.isArray(o.cons) || o.cons.length > 4)) {
        throw new AiParseError(`cons exceeds 4 items for ${o.companyName}`);
      }
      if (
        o.riskAssessment !== undefined &&
        !['low', 'medium', 'high'].includes(o.riskAssessment?.level)
      ) {
        throw new AiParseError(`invalid risk level for ${o.companyName}`);
      }
    }

    if (!inputNames.includes(result.recommendation?.bestOffer)) {
      throw new AiParseError(
        `bestOffer "${result.recommendation?.bestOffer}" does not match any input`,
      );
    }

    if (!['high', 'medium', 'low'].includes(result.recommendation?.confidence)) {
      throw new AiParseError('invalid confidence value');
    }

    return result;
  }

  // ── Main execute ─────────────────────────────────────────────────────────────

  async execute(
    userId: string,
    dto: CreateOfferComparisonDto,
  ): Promise<OfferComparisonResponseDto> {
    try {
      this.logger.log(`[execute] START | userId: ${userId} | offers: ${dto.offers?.length || 0}`);

      const user = await this.userModel.findById(userId).lean().exec();
      if (!user) throw new NotFoundException('User not found');

      this.logger.debug(`[execute] User loaded | currentCity: ${user.currentCity} | currentCtcLpa: ${user.currentCtcLpa}`);

      const familyType = dto.familyType ?? 'family';
      const memberCount = familyType === 'individual' ? 1 : (dto.memberCount ?? 4);

      // 1. For each offer fetch city expenses + COL index (in parallel)
      this.logger.debug(`[execute] Fetching city expenses and COL indices for ${dto.offers.length} offers`);
      const enriched = await Promise.all(
        dto.offers.map(async (raw: OfferInputDto) => {
          const expenseCity = raw.isWfh ? user.currentCity : raw.targetCity;
          this.logger.debug(`[execute] Fetching data for ${raw.companyName} | city: ${expenseCity} | isWfh: ${raw.isWfh}`);

          const [expenseDoc, colIndex] = await Promise.all([
            this.cityExpenseService.getExpenseBreakdown(expenseCity, familyType, memberCount),
            this.data.getCOLIndex(expenseCity),
          ]);

          const expenseBreakdown: ExpenseBreakdownItem = {
            rent: expenseDoc.breakdown.rent,
            groceries: expenseDoc.breakdown.groceries,
            utilities: expenseDoc.breakdown.utilities,
            transport: expenseDoc.breakdown.transport,
            foodDining: expenseDoc.breakdown.foodDining,
            personalLifestyle: expenseDoc.breakdown.personalLifestyle,
            miscellaneous: expenseDoc.breakdown.miscellaneous,
            total: expenseDoc.breakdown.total,
          };

          this.logger.debug(`[execute] Data fetched | ${raw.companyName} | colIndex: ${colIndex} | totalExpense: ${expenseDoc.breakdown.total}`);
          return { raw, expenseBreakdown, colIndexUsed: colIndex ?? 100 };
        }),
      );

      // 2. Deterministic computation — all before AI call
      this.logger.debug(`[execute] Computing offer snapshots for ${enriched.length} offers`);
      const snapshots: OfferSnapshot[] = enriched.map(({ raw, expenseBreakdown, colIndexUsed }) =>
        this.comp.computeOfferSnapshot(
          {
            companyName: raw.companyName,
            totalCtcLpa: raw.totalCtcLpa,
            variablePct: raw.variablePct,
            variableGuaranteed: raw.variableGuaranteed,
            joiningBonusLpa: raw.joiningBonusLpa,
            employerPf: raw.employerPf,
            targetCity: raw.targetCity,
            isWfh: raw.isWfh,
          },
          expenseBreakdown,
          colIndexUsed,
        ),
      );

      snapshots.forEach((snap) => {
        this.logger.debug(`[execute] Snapshot computed | ${snap.companyName} | ctc: ${snap.totalCtcLpa} | inHand/mo: ${snap.monthlyInHand.toFixed(2)}`);
      });

      // 3. Persist deterministic snapshots before any AI call
      await this.offersService.createMany(
        snapshots.map((snap, i) => ({
          userId,
          inputs: dto.offers[i] as unknown as Record<string, unknown>,
          snapshot: snap as unknown as Record<string, unknown>,
        })),
      );

      // 4. Fetch company records
      // aiProfile is included in each record when pre-generated at startup
      this.logger.debug(`[execute] Fetching company records for ${dto.offers.length} offers`);
      const companyRecords = await Promise.all(
        dto.offers.map((raw: OfferInputDto) => this.data.getCompany(raw.companyName)),
      );

      const companiesFound = companyRecords.filter((c) => c !== null).length;
      const profilesFound = companyRecords.filter((c) => c?.aiProfile).length;
      this.logger.debug(`[execute] Company records fetched | found: ${companiesFound}/${companyRecords.length} | aiProfiles: ${profilesFound}`);

      // 5. Single AI call — all offers in one context
      // AI receives pre-stored aiProfiles (no re-derivation) and only returns
      // score, scoreBreakdown, and recommendation.
      this.logger.log(`[execute] Calling AI for scoring and recommendation`);
      const userPrompt = this.buildPrompt(user.currentCity, user.currentCtcLpa, snapshots, companyRecords);
      const rawAiResponse = await this.ai.call(SYSTEM_PROMPT, userPrompt);
      const inputNames = dto.offers.map((o) => o.companyName);
      const aiResult = this.validateAiResponse(rawAiResponse, inputNames);

      this.logger.log(`[execute] AI complete | bestOffer: ${aiResult.recommendation?.bestOffer} | confidence: ${aiResult.recommendation?.confidence}`);

      // 6. Merge deterministic + pre-stored profiles + AI scoring
      this.logger.debug(`[execute] Merging results for ${snapshots.length} offers`);
      const offers: OfferResultDto[] = snapshots.map((snap, i) => {
        const rec = companyRecords[i];
        const aiOffer = aiResult.offers.find(
          (o) => o.companyName.toLowerCase() === snap.companyName.toLowerCase(),
        );
        if (!aiOffer) {
          throw new AiParseError(
            `AI response missing score for offer "${snap.companyName}"`,
          );
        }

        const profile = rec?.aiProfile;

        return {
          // deterministic
          companyName: snap.companyName,
          totalCtcLpa: snap.totalCtcLpa,
          variablePct: snap.variablePct,
          variableGuaranteed: snap.variableGuaranteed,
          joiningBonusLpa: snap.joiningBonusLpa,
          employerPf: snap.employerPf,
          targetCity: snap.targetCity,
          isWfh: snap.isWfh,
          variableAnnual: snap.variableAnnual,
          fixedPayAnnual: snap.fixedPayAnnual,
          basicMonthly: snap.basicMonthly,
          employeePfMonthly: snap.employeePfMonthly,
          employeePfAnnual: snap.employeePfAnnual,
          employerPfAnnual: snap.employerPfAnnual,
          gratuityAccrualAnnual: snap.gratuityAccrualAnnual,
          effectiveCtcAnnual: snap.effectiveCtcAnnual,
          taxableIncome: snap.taxableIncome,
          incomeTaxAnnual: snap.incomeTaxAnnual,
          monthlyInHand: snap.monthlyInHand,
          annualInHand: snap.annualInHand,
          colIndexUsed: snap.colIndexUsed,
          monthlyExpenses: snap.monthlyExpenses,
          monthlySavings: snap.monthlySavings,
          annualSavings: snap.annualSavings,
          expenseBreakdown: snap.expenseBreakdown,
          // qualitative — from pre-stored aiProfile, with AI inline fallback for unknown companies
          companySize:    aiOffer.companySize    ?? profile?.companySize    ?? 'Not available in data',
          basicInsurance: aiOffer.basicInsurance ?? profile?.basicInsurance ?? 'Not available in data',
          otherBenefits:  aiOffer.otherBenefits  ?? profile?.otherBenefits  ?? [],
          pros:           aiOffer.pros           ?? profile?.pros           ?? [],
          cons:           aiOffer.cons           ?? profile?.cons           ?? [],
          riskAssessment: aiOffer.riskAssessment ?? (profile
            ? { level: profile.riskLevel, factors: profile.riskFactors, benefitForRisk: profile.benefitForRisk }
            : { level: 'medium' as const, factors: [], benefitForRisk: 'Not available in data' }),
          // employeeRating — always from seeded ratings[], never from AI
          employeeRating: this.buildEmployeeRating(rec?.ratings),
          // AI scoring
          score:          aiOffer.score,
          scoreBreakdown: aiOffer.scoreBreakdown,
        };
      });

      this.logger.log(`[execute] COMPLETE | userId: ${userId} | offers: ${offers.length}`);

      return {
        userId,
        comparedAt: new Date().toISOString(),
        offers,
        recommendation: aiResult.recommendation,
        dataDisclaimer: DATA_DISCLAIMER,
      };
    } catch (err) {
      this.logger.error(`[execute] FAILED | userId: ${userId} | error: ${(err as Error).message}`);
      throw err;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private buildEmployeeRating(ratings: RatingSet[] | undefined): EmployeeRatingDto {
    if (!ratings || ratings.length === 0) {
      return { overall: 0, wlb: 0, culture: 0, growth: 0, jobSecurity: 0, source: 'Not available', disagreementFlag: null };
    }

    const primary =
      ratings.find((r) => r.source.toLowerCase().includes('ambitionbox')) ?? ratings[0];
    const overall = +((primary.wlb + primary.culture + primary.growth + primary.jobSecurity) / 4).toFixed(1);

    let disagreementFlag: string | null = null;
    if (ratings.length >= 2) {
      const secondary = ratings.find((r) => r !== primary) ?? ratings[1];
      const dims = ['wlb', 'culture', 'growth', 'jobSecurity'] as const;
      const flagged = dims
        .filter((d) => Math.abs(primary[d] - secondary[d]) > 0.5)
        .map((d) => `${d} (${primary.source}: ${primary[d]}, ${secondary.source}: ${secondary[d]})`);
      if (flagged.length > 0) {
        disagreementFlag = `Sources disagree on: ${flagged.join('; ')}`;
      }
    }

    return {
      overall,
      wlb: primary.wlb,
      culture: primary.culture,
      growth: primary.growth,
      jobSecurity: primary.jobSecurity,
      source: primary.source,
      disagreementFlag,
    };
  }

  // ── Prompt builder ───────────────────────────────────────────────────────────

  private buildPrompt(
    currentCity: string,
    currentCtcLpa: number,
    snapshots: OfferSnapshot[],
    companyRecords: Array<CompanyRecord | null>,
  ): string {
    const leanSnapshots = snapshots.map((s) => ({
      companyName: s.companyName,
      totalCtcLpa: s.totalCtcLpa,
      targetCity: s.targetCity,
      isWfh: s.isWfh,
      fixedPayAnnual: s.fixedPayAnnual,
      effectiveCtcAnnual: s.effectiveCtcAnnual,
      monthlyInHand: s.monthlyInHand,
      monthlyExpenses: s.monthlyExpenses,
      monthlySavings: s.monthlySavings,
    }));

    // Build per-company context: pre-stored profiles for known companies,
    // raw ratings + reviews for unknown ones so AI can derive inline.
    const companyContext = snapshots.map((snap, i) => {
      const rec = companyRecords[i];
      if (!rec) {
        return { companyName: snap.companyName, profileType: 'unknown' as const };
      }

      // Compute per-source ratings deterministically (overall = mean of 4 dims)
      const ratingsBySource = rec.ratings.map((r) => ({
        source: r.source,
        overall: +((r.wlb + r.culture + r.growth + r.jobSecurity) / 4).toFixed(1),
        wlb: r.wlb, culture: r.culture, growth: r.growth, jobSecurity: r.jobSecurity,
      }));

      if (rec.aiProfile) {
        return {
          companyName: rec.name,
          profileType: 'stored' as const,
          companySize: rec.aiProfile.companySize,
          basicInsurance: rec.aiProfile.basicInsurance,
          otherBenefits: rec.aiProfile.otherBenefits,
          pros: rec.aiProfile.pros,
          cons: rec.aiProfile.cons,
          riskLevel: rec.aiProfile.riskLevel,
          riskFactors: rec.aiProfile.riskFactors,
          benefitForRisk: rec.aiProfile.benefitForRisk,
          ratings: ratingsBySource,
        };
      }

      // Unknown company — AI must derive qualitative fields inline
      return {
        companyName: rec.name,
        profileType: 'derive' as const,
        ratings: ratingsBySource,
        reviews: rec.reviews,
      };
    });

    const hasUnknown = companyContext.some(
      (c) => c.profileType === 'derive' || c.profileType === 'unknown',
    );

    // Schema varies based on whether AI needs to derive qualitative data inline
    const schemaResponse = {
      offers: [{
        companyName: 'string',
        ...(hasUnknown ? {
          companySize: 'string (only for profileType=derive/unknown)',
          basicInsurance: 'string (only for profileType=derive/unknown)',
          otherBenefits: ['string'],
          pros: ['string'],
          cons: ['string'],
          riskAssessment: { level: 'low|medium|high', factors: ['string'], benefitForRisk: 'string' },
        } : {}),
        score: 0,
        scoreBreakdown: { financial: 0, qualitative: 0, risk: 0 },
      }],
      recommendation: {
        bestOffer: 'string',
        suggestion: 'string',
        whyBest: 'string',
        whyNotOthers: {},
        confidence: 'high|medium|low',
        caveat: 'string',
      },
    };

    const taskInstruction = hasUnknown
      ? 'For companies with profileType="stored", omit qualitative fields and return only score and scoreBreakdown. ' +
        'For companies with profileType="derive" or "unknown", also return companySize, basicInsurance, otherBenefits, pros (max 4), cons (max 4), and riskAssessment. ' +
        'For all offers, return score, scoreBreakdown, and the shared recommendation block.'
      : 'All company profiles are pre-supplied (profileType="stored"). ' +
        'Return only score and scoreBreakdown per offer, plus the shared recommendation block.';

    return `Candidate currentCity: "${currentCity}", currentCtcLpa: ${currentCtcLpa} LPA.

DETERMINISTIC SNAPSHOTS (do not modify these figures):
${JSON.stringify(leanSnapshots)}

COMPANY PROFILES:
${JSON.stringify(companyContext)}

TASK: ${taskInstruction}
Return JSON matching this schema:
${JSON.stringify(schemaResponse)}

RULES:
- Never introduce a salary figure not in the snapshot data.
- Never invent a benefit, rating, or company fact not in the company profiles.
- If a field is missing, output "Not available in data". Do not guess.
- Bounds: score 0-100; breakdown: financial 0-40, qualitative 0-40, risk 0-20; sum must equal score exactly.
- bestOffer must match submitted companyName exactly.
- High-salary with poor ratings and high risk must not score above 75.
- benefitForRisk must weigh monthlySavings delta against risk factors.
- If offers are within 5 score points of each other, state this in caveat.`;
  }
}
