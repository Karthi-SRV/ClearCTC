import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CityExpense,
  CityExpenseDocument,
  ExpenseBreakdown,
  FamilyType,
} from '../../shared/schemas/city-expense.schema.js';
import { CityExpenseCacheService } from './city-expense-cache.service.js';
import { CityExpenseFetchService } from './city-expense-fetch.service.js';
import { escapeRegex } from '../../shared/utils/regex.util.js';

const FRESH_THRESHOLD_MS = 30 * 24 * 3600 * 1000; // 30 days

const DEFAULT_FAMILY_TYPE: FamilyType = 'family';
const DEFAULT_MEMBER_COUNT = 4;

export class CityExpenseUnavailableError extends Error {
  constructor(city: string) {
    super(`City expense data unavailable for ${city}`);
    this.name = 'CityExpenseUnavailableError';
  }
}

@Injectable()
export class CityExpenseService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CityExpenseService.name);
  private fetchInterval?: NodeJS.Timeout;

  constructor(
    @InjectModel(CityExpense.name)
    private readonly model: Model<CityExpenseDocument>,
    private readonly cache: CityExpenseCacheService,
    private readonly fetch: CityExpenseFetchService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedMissingCities();
    void this.startBackgroundFetchLoop();
  }

  onModuleDestroy() {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
      this.logger.log('Cleanup: stopped background city expense fetch loop');
    }
  }

  private async seedMissingCities(): Promise<void> {
    this.logger.log(
      'Startup: syncing existing city expense records to cache...',
    );

    try {
      const docs = await this.model
        .find({ individual: { $exists: true, $ne: null } })
        .lean()
        .exec();
      for (const doc of docs) {
        const city = doc.city;
        const alreadyCached = await this.cache.get(city);
        if (!alreadyCached) {
          await this.cache.set(city, doc);
        }
        this.logger.log(`${city}: synced to cache (MongoDB → Redis)`);
      }
      this.logger.log('Startup: city expense cache sync ready');
    } catch (err: any) {
      this.logger.error(`Startup cache sync failed: ${err?.message}`);
    }
  }

  private isFetching = false;

  private async startBackgroundFetchLoop(): Promise<void> {
    this.logger.log(
      'Startup: starting background city expense fetch loop (every 15 seconds)...',
    );

    this.fetchInterval = setInterval(async () => {
      if (this.isFetching) return;

      try {
        const missing = await this.model
          .findOne({
            $or: [{ individual: { $exists: false } }, { individual: null }],
          })
          .exec();

        if (missing) {
          this.isFetching = true;
          const city = missing.city;
          this.logger.log(`Background fetch: fetching expenses for ${city}...`);
          try {
            await this.fetchAndStore(city);
            this.logger.log(
              `Background fetch: successfully stored expenses for ${city}`,
            );
          } catch (err: any) {
            this.logger.error(
              `Background fetch failed for ${city}: ${err?.message}`,
            );
          } finally {
            this.isFetching = false;
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Error in background city expense fetch loop: ${err?.message}`,
        );
        this.isFetching = false;
      }
    }, 15000);
  }

  async getAllExpenses(): Promise<CityExpense[]> {
    const docs = await this.model.find().lean().exec();
    return docs;
  }

  async getCityNames(): Promise<string[]> {
    const docs = await this.model.find({}, { city: 1, _id: 0 }).lean().exec();
    return (docs as Array<{ city: string }>)
      .map((d) => d.city)
      .sort((a, b) => a.localeCompare(b));
  }

  async getCitiesWithIds(): Promise<Array<{ _id: string; city: string }>> {
    const docs = await this.model.find({}, { city: 1, _id: 1 }).lean().exec();
    return (docs as Array<{ _id: any; city: string }>)
      .map((d) => ({ _id: d._id.toString(), city: d.city }))
      .sort((a, b) => a.city.localeCompare(b.city));
  }

  async getExpensesByFilter(cities: string[]): Promise<CityExpense[]> {
    const normalized = cities.map((c) => c.trim()).filter(Boolean);
    if (!normalized.length) return this.getAllExpenses();

    const docs = await this.model
      .find({
        city: {
          $in: normalized.map((c) => new RegExp(`^${escapeRegex(c)}$`, 'i')),
        },
      })
      .lean()
      .exec();

    const found = new Set(
      docs.map((d) => (d as unknown as CityExpense).city.toLowerCase()),
    );
    const missing = normalized.filter((c) => !found.has(c.toLowerCase()));

    const fetched = await Promise.allSettled(
      missing.map((c) =>
        this.fetchAndStore(c).catch((err: Error) => {
          this.logger.warn(`Filter fetch failed for ${c}: ${err?.message}`);
          return null;
        }),
      ),
    );

    const extra = fetched
      .map((r) => (r.status === 'fulfilled' ? r.value : null))
      .filter((v): v is CityExpense => v !== null);

    return [...(docs as unknown as CityExpense[]), ...extra];
  }

  async getExpenseBreakdown(
    city: string,
    familyType: FamilyType = DEFAULT_FAMILY_TYPE,
    memberCount: number = DEFAULT_MEMBER_COUNT,
  ): Promise<any> {
    // 1. Redis
    const cached = await this.cache.get(city);
    if (cached && cached.individual)
      return this.resolveVirtualBreakdown(cached, familyType, memberCount);

    // 2. MongoDB
    const doc = await this.model
      .findOne({
        city: new RegExp(`^${escapeRegex(city)}$`, 'i'),
      })
      .lean()
      .exec();

    if (doc && doc.individual) {
      const plain = doc as unknown as CityExpense;
      await this.cache.set(city, plain);

      const ageMs = Date.now() - new Date(doc.generatedAt!).getTime();
      if (ageMs > FRESH_THRESHOLD_MS) {
        void this.fetchAndStore(city).catch((err: Error) =>
          this.logger.warn(
            `Background refresh failed for ${city}: ${err?.message}`,
          ),
        );
      }

      return this.resolveVirtualBreakdown(plain, familyType, memberCount);
    }

    // 3. Safety net
    this.logger.warn(
      `${city}: not in MongoDB or has no breakdown — fetching from AI`,
    );
    try {
      const fresh = await this.fetchAndStore(city);
      return this.resolveVirtualBreakdown(fresh, familyType, memberCount);
    } catch {
      throw new CityExpenseUnavailableError(city);
    }
  }

  async forceRefresh(city: string): Promise<CityExpense> {
    await this.cache.del(city);
    return this.fetchAndStore(city);
  }

  async findOrCreate(city: string): Promise<CityExpense> {
    const doc = await this.model
      .findOne({ city: new RegExp(`^${escapeRegex(city)}$`, 'i') })
      .exec();
    if (doc) {
      return doc.toObject ? doc.toObject() : doc;
    }

    // Create a shell city record immediately to let user proceed
    const newCity = new this.model({
      city,
      isBase: false,
    });
    const saved = await newCity.save();

    // Perform AI fetching and storage in the background
    void this.fetchAndStore(city).catch((err: Error) => {
      this.logger.error(
        `Background city fetch failed for ${city}: ${err.message}`,
      );
    });

    return saved.toObject ? saved.toObject() : saved;
  }

  private async fetchAndStore(city: string): Promise<CityExpense> {
    const result = await this.fetch.fetchExpense(city);

    let colIndex = 0;

    const baseCity = await this.model.findOne({ isBase: true }).lean().exec();
    if (city.trim().toLowerCase() === baseCity?.city.toLowerCase()) {
      colIndex = 1.0;
    } else {
      if (
        baseCity &&
        baseCity.family4 &&
        baseCity.family4.total &&
        result.family4?.total
      ) {
        colIndex =
          Math.round((result.family4.total / baseCity.family4.total) * 100) /
          100;
      } else {
        colIndex = 0;
      }
    }

    const updateData = {
      ...result,
      city,
      colIndex,
    };

    const doc = await this.model
      .findOneAndUpdate(
        {
          city: new RegExp(`^${escapeRegex(city)}$`, 'i'),
        },
        { $set: updateData },
        { upsert: true, new: true },
      )
      .exec();

    const plain = doc.toObject ? doc.toObject() : doc;
    await this.cache.set(city, plain as CityExpense);
    return plain as CityExpense;
  }

  private resolveVirtualBreakdown(
    doc: CityExpense,
    familyType: FamilyType,
    memberCount: number,
  ): any {
    let breakdown: ExpenseBreakdown;
    if (familyType === 'individual') {
      breakdown = doc.individual!;
    } else {
      switch (memberCount) {
        case 1:
          breakdown = doc.individual!;
          break;
        case 2:
          breakdown = doc.family!;
          break;
        case 3:
          breakdown = doc.family3!;
          break;
        case 4:
          breakdown = doc.family4!;
          break;
        case 5:
          breakdown = doc.family5!;
          break;
        case 6:
        default:
          breakdown = doc.family6!;
          break;
      }
    }

    return {
      city: doc.city,
      familyType,
      memberCount,
      breakdown,
      generatedBy: doc.generatedBy,
      generatedAt: doc.generatedAt,
      modelUsed: doc.modelUsed,
      disclaimer: doc.disclaimer,
    };
  }
}
