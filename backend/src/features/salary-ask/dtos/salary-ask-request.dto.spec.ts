import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SalaryAskRequestDto } from './salary-ask-request.dto.js';

describe('SalaryAskRequestDto — three-field contract', () => {
  it('accepts valid three-field payload', async () => {
    const dto = plainToInstance(SalaryAskRequestDto, {
      currentCity: 'Chennai',
      currentCtcLpa: 28,
      expectedIncrementPct: 30,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects missing currentCity', async () => {
    const dto = plainToInstance(SalaryAskRequestDto, {
      currentCtcLpa: 28,
      expectedIncrementPct: 30,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'currentCity')).toBe(true);
  });

  it('rejects currentCtcLpa below 1', async () => {
    const dto = plainToInstance(SalaryAskRequestDto, {
      currentCity: 'Chennai',
      currentCtcLpa: 0,
      expectedIncrementPct: 30,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'currentCtcLpa')).toBe(true);
  });

  it('rejects negative expectedIncrementPct', async () => {
    const dto = plainToInstance(SalaryAskRequestDto, {
      currentCity: 'Chennai',
      currentCtcLpa: 28,
      expectedIncrementPct: -5,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'expectedIncrementPct')).toBe(true);
  });

  it('does not define old experienceYears/targetRole/targetCompany fields', () => {
    const dto = new SalaryAskRequestDto();
    expect(dto).not.toHaveProperty('experienceYears');
    expect(dto).not.toHaveProperty('targetRole');
    expect(dto).not.toHaveProperty('targetCompany');
    expect(dto).not.toHaveProperty('currentSalary');
  });
});
