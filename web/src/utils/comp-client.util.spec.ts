import { describe, it, expect } from 'vitest';
import { computeMonthlyInHand } from './comp-client.util';

// Cross-check: values independently derived from backend CompensationService.
// Both implementations use FY 2025-26 new-regime tax, statutory PF, no variable.
// Tolerance: ±1 rupee (rounding at division-by-12).
const CASES: Array<[lpa: number, expected: number]> = [
  [10,  81_533],
  [20, 148_833],
  [28, 197_083],
  [40, 265_883],
  [60, 380_550],
];

describe('computeMonthlyInHand — cross-check vs backend within ₹1', () => {
  it.each(CASES)('%d LPA → ₹%d/mo ±1', (lpa, expected) => {
    const result = computeMonthlyInHand(lpa);
    expect(Math.abs(result - expected)).toBeLessThanOrEqual(1);
  });
});
