import { Transform } from 'class-transformer';
import { Types } from 'mongoose';
import { BadRequestException } from '@nestjs/common';

export class MongoIdParamDto {
  @Transform(({ value }) => {
    if (!value || typeof value !== 'string' || !Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid id');
    }
    return new Types.ObjectId(value);
  })
  id: Types.ObjectId;
}
