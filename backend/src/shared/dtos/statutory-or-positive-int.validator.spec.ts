import { IsStatutoryOrPositiveIntConstraint } from './statutory-or-positive-int.validator.js';

describe('IsStatutoryOrPositiveIntConstraint', () => {
  const constraint = new IsStatutoryOrPositiveIntConstraint();

  it('accepts the literal string "statutory"', () => {
    expect(constraint.validate('statutory')).toBe(true);
  });

  it('accepts positive integers', () => {
    expect(constraint.validate(1)).toBe(true);
    expect(constraint.validate(100)).toBe(true);
  });

  it('rejects zero', () => {
    expect(constraint.validate(0)).toBe(false);
  });

  it('rejects negative integers', () => {
    expect(constraint.validate(-1)).toBe(false);
  });

  it('rejects non-integer numbers', () => {
    expect(constraint.validate(1.5)).toBe(false);
  });

  it('rejects other strings', () => {
    expect(constraint.validate('none')).toBe(false);
    expect(constraint.validate('')).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(constraint.validate(null)).toBe(false);
    expect(constraint.validate(undefined)).toBe(false);
  });

  it('returns a default message string', () => {
    expect(constraint.defaultMessage()).toContain('statutory');
  });
});
