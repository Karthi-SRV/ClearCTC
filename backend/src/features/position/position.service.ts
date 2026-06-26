import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Position,
  PositionDocument,
} from '../../shared/schemas/position.schema.js';
import { escapeRegex } from '../../shared/utils/regex.util.js';

@Injectable()
export class PositionService {
  constructor(
    @InjectModel(Position.name)
    private readonly positionModel: Model<PositionDocument>,
  ) {}

  async findAll(): Promise<PositionDocument[]> {
    return this.positionModel.find().sort({ name: 1 }).exec();
  }

  async findOrCreate(name: string): Promise<PositionDocument> {
    const pattern = new RegExp(`^${escapeRegex(name)}$`, 'i');
    const existing = await this.positionModel.findOne({ name: pattern }).exec();
    if (existing) {
      return existing;
    }

    const created = new this.positionModel({ name });
    return created.save();
  }
}
