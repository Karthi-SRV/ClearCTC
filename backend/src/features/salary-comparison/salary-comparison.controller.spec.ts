import { Test, TestingModule } from '@nestjs/testing';
import { SalaryComparisonController } from './salary-comparison.controller.js';
import { SalaryComparisonService } from './salary-comparison.service.js';
import { DATA_SOURCE } from '../../core/data/data-source.interface.js';

describe('SalaryComparisonController', () => {
  let controller: SalaryComparisonController;
  let service: SalaryComparisonService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalaryComparisonController],
      providers: [
        {
          provide: SalaryComparisonService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: DATA_SOURCE,
          useValue: {
            getCompanyNames: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SalaryComparisonController>(
      SalaryComparisonController,
    );
    service = module.get<SalaryComparisonService>(SalaryComparisonService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call SalaryComparisonService.execute with correct parameters', async () => {
    const mockUser = { sub: 'user123' };
    const mockDto = {
      offers: [
        {
          companyName: 'Acme',
          totalCtcLpa: 25,
          variablePct: 10,
          variableGuaranteed: false,
          joiningBonusLpa: 2,
          employerPf: 'statutory' as const,
          targetCity: 'Bangalore',
          isWfh: false,
        },
        {
          companyName: 'Beta',
          totalCtcLpa: 28,
          variablePct: 15,
          variableGuaranteed: true,
          joiningBonusLpa: 0,
          employerPf: 'statutory' as const,
          targetCity: 'Bangalore',
          isWfh: true,
        },
      ],
    };

    const mockResponse = {
      userId: 'user123',
      comparedAt: '2026-06-24T15:00:00Z',
      offers: [],
      companyDetails: [],
      disclaimer: 'Test disclaimer',
    };

    (service.execute as jest.Mock).mockResolvedValue(mockResponse);

    const result = await controller.quickComparison(mockUser as any, mockDto);

    expect(service.execute).toHaveBeenCalledWith('user123', mockDto);
    expect(result).toEqual(mockResponse);
  });
});
