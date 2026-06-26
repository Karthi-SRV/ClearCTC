import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CompensationService } from '../../core/compensation/compensation.service.js';
import type { DataSource } from '../../core/data/data-source.interface.js';
import { DATA_SOURCE } from '../../core/data/data-source.interface.js';
import { CityExpenseService } from '../../core/city-expense/city-expense.service.js';
import { User, UserDocument } from '../../shared/schemas/user.schema.js';
import type { SalaryComparisonOfferDto } from './dtos/salary-comparison-request.dto.js';
import { QuickSalaryComparisonDto } from './dtos/salary-comparison-request.dto.js';
import type {
  QuickSalaryComparisonResponseDto,
  QuickOfferSnapshotDto,
  CompanyDetailsDto,
} from './dtos/salary-comparison-response.dto.js';

const DATA_DISCLAIMER =
  'Tax: new regime FY2025-26 · Ratings: from seeded company data · Expenses: city averages · Decision support only';

@Injectable()
export class SalaryComparisonService {
  private readonly logger = new Logger(SalaryComparisonService.name);

  constructor(
    private readonly comp: CompensationService,
    @Inject(DATA_SOURCE) private readonly data: DataSource,
    private readonly cityExpenseService: CityExpenseService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async execute(
    userId: string,
    dto: QuickSalaryComparisonDto,
  ): Promise<QuickSalaryComparisonResponseDto> {
    try {
      this.logger.log(`[execute] START | userId: ${userId} | offers: ${dto.offers?.length || 0}`);

      const user = await this.userModel.findById(userId).lean().exec();
      if (!user) throw new NotFoundException('User not found');

      this.logger.debug(`[execute] User loaded | currentCity: ${user.currentCity}`);

      const familyType = dto.familyType ?? 'family';
      const memberCount = familyType === 'individual' ? 1 : (dto.memberCount ?? 4);

      // 1. Fetch city expenses + COL index for each offer (in parallel)
      this.logger.debug(`[execute] Fetching city expenses and COL indices for ${dto.offers.length} offers`);
      const enriched = await Promise.all(
        dto.offers.map(async (raw: SalaryComparisonOfferDto) => {
          const expenseCity = raw.isWfh ? user.currentCity : raw.targetCity;
          this.logger.debug(`[execute] Fetching data for ${raw.companyName} | city: ${expenseCity} | isWfh: ${raw.isWfh}`);

          const [expenseDoc, colIndex] = await Promise.all([
            this.cityExpenseService.getExpenseBreakdown(expenseCity, familyType, memberCount),
            this.data.getCOLIndex(expenseCity),
          ]);

          this.logger.debug(`[execute] Data fetched | ${raw.companyName} | colIndex: ${colIndex} | totalExpense: ${expenseDoc.breakdown.total}`);
          return { raw, expenseBreakdown: expenseDoc.breakdown, colIndexUsed: colIndex ?? 1.0 };
        }),
      );

      // 2. Compute snapshots (deterministic, no AI)
      this.logger.debug(`[execute] Computing offer snapshots for ${enriched.length} offers`);
      const snapshots: QuickOfferSnapshotDto[] = enriched.map(({ raw, expenseBreakdown, colIndexUsed }) =>
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

      // 3. Fetch company details from the database
      this.logger.debug(`[execute] Fetching company details for ${dto.offers.length} offers`);
      const companyRecords = await Promise.all(
        dto.offers.map((raw: SalaryComparisonOfferDto) => this.data.getCompany(raw.companyName)),
      );

      const companiesFound = companyRecords.filter((c) => c !== null).length;
      this.logger.debug(`[execute] Company records fetched | found: ${companiesFound}/${companyRecords.length}`);

      // 4. Build company details response
      const companyDetails: CompanyDetailsDto[] = snapshots.map((snap, i) => {
        const rec = companyRecords[i];

        if (!rec) {
          return {
            companyName: snap.companyName,
            size: 'Not available in data',
            basicInsurance: 'Not available in data',
            otherBenefits: [],
            employeeRating: {
              overall: 0,
              wlb: 0,
              culture: 0,
              growth: 0,
              jobSecurity: 0,
              source: 'No data',
            },
            reviews: [],
          };
        }

        // Use first rating source
        const primaryRating = rec.ratings?.[0];
        const overall = primaryRating
          ? +((primaryRating.wlb + primaryRating.culture + primaryRating.growth + primaryRating.jobSecurity) / 4).toFixed(1)
          : 0;

        return {
          companyName: rec.name,
          size: rec.aiProfile?.companySize ?? 'Not available',
          basicInsurance: rec.aiProfile?.basicInsurance ?? 'Not available',
          otherBenefits: rec.aiProfile?.otherBenefits ?? [],
          employeeRating: {
            overall,
            wlb: primaryRating?.wlb ?? 0,
            culture: primaryRating?.culture ?? 0,
            growth: primaryRating?.growth ?? 0,
            jobSecurity: primaryRating?.jobSecurity ?? 0,
            source: primaryRating?.source ?? 'Unknown',
          },
          reviews: (rec.reviews ?? []).slice(0, 2).map((r) => ({
            snippet: r.text,
            source: r.source,
          })),
        };
      });

      this.logger.log(`[execute] COMPLETE | userId: ${userId} | offers: ${snapshots.length}`);

      return {
        userId,
        comparedAt: new Date().toISOString(),
        offers: snapshots,
        companyDetails,
        disclaimer: DATA_DISCLAIMER,
      };
    } catch (err) {
      this.logger.error(`[execute] FAILED | userId: ${userId} | error: ${(err as Error).message}`);
      throw err;
    }
  }
}
