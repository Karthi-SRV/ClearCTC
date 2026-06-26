import { CityExpenseController } from './city-expense.controller.js';

function makeController(
  getCitiesWithIds: Array<{ _id: string; city: string }> = [],
  getExpensesByFilter: object[] = [],
  findOrCreateResult: any = { _id: '123', city: 'Bangalore' },
) {
  const service = {
    getCityNames: jest.fn().mockResolvedValue(getCitiesWithIds.map((c) => c.city)),
    getCitiesWithIds: jest.fn().mockResolvedValue(getCitiesWithIds),
    getExpensesByFilter: jest.fn().mockResolvedValue(getExpensesByFilter),
    findOrCreate: jest.fn().mockResolvedValue(findOrCreateResult),
  };
  return { ctrl: new CityExpenseController(service as never), service };
}

const expenseDoc = {
  city: 'Bangalore',
  generatedAt: '2026-01-01',
  disclaimer: 'estimates only',
  individual: { total: 30000 },
  family: { total: 45000 },
  family3: { total: 50000 },
  family4: { total: 55000 },
  family5: { total: 60000 },
  family6: { total: 65000 },
};

describe('CityExpenseController', () => {
  describe('getCities', () => {
    it('returns sorted city names from service', async () => {
      const cities = [
        { _id: '1', city: 'Pune' },
        { _id: '2', city: 'Bangalore' },
        { _id: '3', city: 'Mumbai' },
      ];
      const { ctrl } = makeController(cities);
      const result = await ctrl.getCities();
      expect(result).toEqual({ cities });
    });

    it('returns empty array when no cities exist', async () => {
      const { ctrl } = makeController([]);
      const result = await ctrl.getCities();
      expect(result).toEqual({ cities: [] });
    });
  });

  describe('getAll', () => {
    it('returns all expenses when no city param is given', async () => {
      const { ctrl, service } = makeController([], [expenseDoc]);
      await ctrl.getAll(undefined);
      expect(service.getExpensesByFilter).toHaveBeenCalledWith([]);
    });

    it('passes a single city string as a one-element array', async () => {
      const { ctrl, service } = makeController([], [expenseDoc]);
      await ctrl.getAll('Bangalore');
      expect(service.getExpensesByFilter).toHaveBeenCalledWith(['Bangalore']);
    });

    it('passes an array of cities directly', async () => {
      const { ctrl, service } = makeController([], [expenseDoc]);
      await ctrl.getAll(['Bangalore', 'Pune']);
      expect(service.getExpensesByFilter).toHaveBeenCalledWith([
        'Bangalore',
        'Pune',
      ]);
    });

    it('splits comma-separated cities in a single string', async () => {
      const { ctrl, service } = makeController([], [expenseDoc]);
      await ctrl.getAll('Bangalore,Pune');
      expect(service.getExpensesByFilter).toHaveBeenCalledWith([
        'Bangalore',
        'Pune',
      ]);
    });

    it('maps returned docs to response shape', async () => {
      const { ctrl } = makeController([], [expenseDoc]);
      const result = await ctrl.getAll(undefined);
      expect(result[0]).toMatchObject({
        city: 'Bangalore',
        generatedAt: '2026-01-01',
        disclaimer: 'estimates only',
        family4: { total: 55000 },
      });
    });
  });
});
