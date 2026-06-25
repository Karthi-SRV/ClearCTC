import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Offer, OfferDocument } from '../../shared/schemas/offer.schema.js';

export interface CreateOfferDto {
  userId: string;
  inputs: Record<string, unknown>;
  snapshot: Record<string, unknown>;
}

@Injectable()
export class OffersService {
  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
  ) {}

  async createMany(offers: CreateOfferDto[]): Promise<OfferDocument[]> {
    const docs = offers.map((o) => ({
      ...o,
      userId: new Types.ObjectId(o.userId),
    }));
    return this.offerModel.insertMany(docs) as unknown as Promise<OfferDocument[]>;
  }
}
