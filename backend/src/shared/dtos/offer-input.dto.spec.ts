import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOfferComparisonDto, OfferInputDto } from './offer-input.dto.js';

// Validate a plain object as an OfferInputDto
async function validateOffer(plain: object): Promise<string[]> {
  const dto = plainToInstance(OfferInputDto, plain);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

// Validate a CreateOfferComparisonDto (wraps the array)
async function validateDto(offers: object[]): Promise<string[]> {
  const dto = plainToInstance(CreateOfferComparisonDto, { offers });
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

const validOffer = {
  companyName: 'Acme',
  totalCtcLpa: 25,
  variablePct: 10,
  variableGuaranteed: true,
  joiningBonusLpa: 0,
  employerPf: 'statutory',
  targetCity: 'Bangalore',
  isWfh: false,
};

// ── OfferInputDto field validations ─────────────────────────────────────────

describe('OfferInputDto — employerPf', () => {
  it('accepts "statutory"', async () => {
    const errs = await validateOffer({ ...validOffer, employerPf: 'statutory' });
    expect(errs).toHaveLength(0);
  });

  it('accepts "none"', async () => {
    const errs = await validateOffer({ ...validOffer, employerPf: 'none' });
    expect(errs).toHaveLength(0);
  });

  it('rejects any value other than "statutory" | "none"', async () => {
    const errs = await validateOffer({ ...validOffer, employerPf: 'partial' });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects numeric value', async () => {
    const errs = await validateOffer({ ...validOffer, employerPf: 21600 });
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('OfferInputDto — variablePct', () => {
  it('accepts 0', async () => {
    const errs = await validateOffer({ ...validOffer, variablePct: 0 });
    expect(errs).toHaveLength(0);
  });

  it('accepts 100', async () => {
    const errs = await validateOffer({ ...validOffer, variablePct: 100 });
    expect(errs).toHaveLength(0);
  });

  it('rejects value > 100', async () => {
    const errs = await validateOffer({ ...validOffer, variablePct: 101 });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects negative value', async () => {
    const errs = await validateOffer({ ...validOffer, variablePct: -1 });
    expect(errs.length).toBeGreaterThan(0);
  });
});

describe('OfferInputDto — totalCtcLpa', () => {
  it('accepts 1 (lower bound)', async () => {
    const errs = await validateOffer({ ...validOffer, totalCtcLpa: 1 });
    expect(errs).toHaveLength(0);
  });

  it('accepts 500 (upper bound)', async () => {
    const errs = await validateOffer({ ...validOffer, totalCtcLpa: 500 });
    expect(errs).toHaveLength(0);
  });

  it('rejects 0 (below minimum)', async () => {
    const errs = await validateOffer({ ...validOffer, totalCtcLpa: 0 });
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects 501 (above maximum)', async () => {
    const errs = await validateOffer({ ...validOffer, totalCtcLpa: 501 });
    expect(errs.length).toBeGreaterThan(0);
  });
});

// ── CreateOfferComparisonDto array constraints ───────────────────────────────

describe('CreateOfferComparisonDto — array constraints', () => {
  it('rejects a single offer (ArrayMinSize 2)', async () => {
    const errs = await validateDto([validOffer]);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('accepts exactly 2 offers', async () => {
    const errs = await validateDto([validOffer, validOffer]);
    expect(errs).toHaveLength(0);
  });

  it('accepts exactly 3 offers', async () => {
    const errs = await validateDto([validOffer, validOffer, validOffer]);
    expect(errs).toHaveLength(0);
  });

  it('rejects 4 offers (ArrayMaxSize 3)', async () => {
    const errs = await validateDto([validOffer, validOffer, validOffer, validOffer]);
    expect(errs.length).toBeGreaterThan(0);
  });
});
