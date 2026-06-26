import { OfferComparisonController } from './offer-comparison.controller.js';

describe('OfferComparisonController', () => {
  const offerComparisonService = { execute: jest.fn() };
  const ctrl = new OfferComparisonController(offerComparisonService as never);

  afterEach(() => jest.clearAllMocks());

  it('delegates to OfferComparisonService.execute with userId from JWT payload', async () => {
    const user = { sub: 'user-42', email: 'a@b.com' };
    const dto = { offers: [{ companyName: 'Acme' }] } as never;
    const expected = { offers: [] };
    offerComparisonService.execute.mockResolvedValue(expected);

    const result = await ctrl.createOfferComparison(user, dto);

    expect(offerComparisonService.execute).toHaveBeenCalledWith('user-42', dto);
    expect(result).toBe(expected);
  });

  it('passes offer count in log (smoke test — no throws)', async () => {
    const user = { sub: 'u1', email: 'x@y.com' };
    const dto = {
      offers: [{ companyName: 'A' }, { companyName: 'B' }],
    } as never;
    offerComparisonService.execute.mockResolvedValue({});

    await expect(
      ctrl.createOfferComparison(user as never, dto),
    ).resolves.toBeDefined();
  });
});
