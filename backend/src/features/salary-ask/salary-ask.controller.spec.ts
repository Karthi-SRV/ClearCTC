import { SalaryAskController } from './salary-ask.controller.js';

describe('SalaryAskController', () => {
  const salaryAskService = {
    getSupportedCities: jest.fn().mockReturnValue(['Bangalore', 'Pune']),
    execute: jest.fn(),
  };
  const ctrl = new SalaryAskController(salaryAskService as never);

  afterEach(() => jest.clearAllMocks());

  describe('getCities', () => {
    it('returns { cities } from getSupportedCities', () => {
      const result = ctrl.getCities();
      expect(result).toEqual({ cities: ['Bangalore', 'Pune'] });
      expect(salaryAskService.getSupportedCities).toHaveBeenCalledTimes(1);
    });
  });

  describe('createSalaryAsk', () => {
    it('delegates to SalaryAskService.execute and returns its result', async () => {
      const dto = { currentCity: 'Bangalore', currentCtcLpa: 20, expectedHikePct: 20 } as never;
      const expected = { cities: [] };
      salaryAskService.execute.mockResolvedValue(expected);

      const result = await ctrl.createSalaryAsk(dto);
      expect(salaryAskService.execute).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });
  });
});
