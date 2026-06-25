import { Types } from 'mongoose';
import { OffersService } from './offers.service.js';

describe('OffersService.createMany', () => {
  it('inserts documents and returns them', async () => {
    const inserted = [{ _id: new Types.ObjectId() }];
    const offerModel = { insertMany: jest.fn().mockResolvedValue(inserted) };
    const service = new OffersService(offerModel as never);

    const result = await service.createMany([
      { userId: new Types.ObjectId().toString(), inputs: { a: 1 }, snapshot: { b: 2 } },
    ]);

    expect(result).toBe(inserted);
    expect(offerModel.insertMany).toHaveBeenCalledTimes(1);
  });

  it('converts userId string to ObjectId in the document', async () => {
    const offerModel = { insertMany: jest.fn().mockResolvedValue([]) };
    const service = new OffersService(offerModel as never);
    const userId = new Types.ObjectId().toString();

    await service.createMany([{ userId, inputs: {}, snapshot: {} }]);

    const [docs] = offerModel.insertMany.mock.calls[0] as [{ userId: Types.ObjectId }[]];
    expect(docs[0].userId).toBeInstanceOf(Types.ObjectId);
    expect(docs[0].userId.toString()).toBe(userId);
  });

  it('inserts multiple offers in one call', async () => {
    const offerModel = { insertMany: jest.fn().mockResolvedValue([{}, {}]) };
    const service = new OffersService(offerModel as never);
    const id = new Types.ObjectId().toString();

    await service.createMany([
      { userId: id, inputs: { co: 'A' }, snapshot: {} },
      { userId: id, inputs: { co: 'B' }, snapshot: {} },
    ]);

    const [docs] = offerModel.insertMany.mock.calls[0] as [unknown[]];
    expect(docs).toHaveLength(2);
  });
});
