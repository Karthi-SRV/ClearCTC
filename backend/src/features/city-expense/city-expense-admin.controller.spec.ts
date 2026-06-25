import { CityExpenseAdminController } from './city-expense-admin.controller.js';

function makeController(forceRefreshImpl: (city: string) => Promise<void> = () => Promise.resolve()) {
  const service = { forceRefresh: jest.fn().mockImplementation(forceRefreshImpl) };
  return { ctrl: new CityExpenseAdminController(service as never), service };
}

describe('CityExpenseAdminController.refresh', () => {
  it('refreshes a single city when city is provided in the body', async () => {
    const { ctrl, service } = makeController();
    const result = await ctrl.refresh({ city: 'Bangalore' });

    expect(service.forceRefresh).toHaveBeenCalledWith('Bangalore');
    expect(service.forceRefresh).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ cities: ['Bangalore'] });
  });

  it('refreshes all standard cities when no city is provided', async () => {
    const { ctrl, service } = makeController();
    const result = await ctrl.refresh({});

    expect(service.forceRefresh).toHaveBeenCalledTimes(6);
    expect((result as { cities: string[] }).cities).toHaveLength(6);
  });

  it('marks failed cities as rejected in results', async () => {
    const { ctrl } = makeController((city) =>
      city === 'Bangalore' ? Promise.reject(new Error('AI timeout')) : Promise.resolve(),
    );
    const result = await ctrl.refresh({ city: 'Bangalore' }) as {
      results: { status: string; error?: string }[];
    };

    expect(result.results[0].status).toBe('rejected');
    expect(result.results[0].error).toBe('AI timeout');
  });

  it('marks successful cities as fulfilled', async () => {
    const { ctrl } = makeController();
    const result = await ctrl.refresh({ city: 'Pune' }) as {
      results: { status: string }[];
    };
    expect(result.results[0].status).toBe('fulfilled');
  });
});
