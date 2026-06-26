import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { MongoIdParamDto } from './mongo-id-param.dto.js';
import { Types } from 'mongoose';

describe('MongoIdParamDto', () => {
  it('transforms valid string ID to Types.ObjectId', () => {
    const validId = new Types.ObjectId().toString();
    const plainObj = { id: validId };

    const dtoInstance = plainToInstance(MongoIdParamDto, plainObj);
    expect(dtoInstance.id).toBeInstanceOf(Types.ObjectId);
    expect(dtoInstance.id.toString()).toBe(validId);
  });

  it('throws BadRequestException with "Invalid id" for invalid hexadecimal strings', () => {
    const invalidObj = { id: 'invalid-hex-id' };
    expect(() => {
      plainToInstance(MongoIdParamDto, invalidObj);
    }).toThrow(BadRequestException);

    try {
      plainToInstance(MongoIdParamDto, invalidObj);
    } catch (err: unknown) {
      expect((err as Error).message).toBe('Invalid id');
    }
  });

  it('throws BadRequestException with "Invalid id" for undefined/empty value', () => {
    const emptyObj = { id: '' };
    expect(() => {
      plainToInstance(MongoIdParamDto, emptyObj);
    }).toThrow(BadRequestException);
  });
});
