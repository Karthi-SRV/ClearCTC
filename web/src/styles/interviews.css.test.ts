/**
 * Bug Condition Exploration Test — Interview Drawer Spacing
 *
 * Property 1: Bug Condition — Drawer Form Spacing Values Are Excessive
 *
 * This test parses `interviews.css` and asserts that the three target CSS rules
 * carry COMPACT spacing values. On unfixed code the inflated values will cause
 * this test to FAIL — that failure is the expected outcome and confirms the bug
 * exists before any fix is applied.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 *
 * CRITICAL: DO NOT fix the CSS or this test when it fails.
 *           The failure documents the counterexamples (root cause evidence).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// CSS parsing helpers
// ---------------------------------------------------------------------------

/** Extract a single rule block for the given selector from raw CSS text. */
function extractRuleBlock(css: string, selector: string): string | null {
  // Escape selector for use inside a regex
  const escaped = selector.replace(/[.#[\]()^$*+?{}|\\]/g, (ch) => `\\${ch}`);
  // Match the selector followed by its { ... } block (non-greedy)
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's');
  const match = css.match(re);
  return match ? match[1] : null;
}

/** Extract a single combined rule block for a multi-selector rule, e.g.
 *  `.ftrack-input, .ftrack-select, .ftrack-textarea { ... }` */
function extractMultiSelectorRuleBlock(css: string, selectors: string[]): string | null {
  // Build a pattern that matches any permutation of these selectors joined by commas
  const escaped = selectors.map((s) =>
    s.replace(/[.#[\]()^$*+?{}|\\]/g, (ch) => `\\${ch}`)
  );
  // Accept them in any order separated by commas (with optional whitespace/newlines)
  const selectorsPattern = escaped.join('[\\s\\S]*?,?\\s*');
  const re = new RegExp(`${selectorsPattern}\\s*\\{([^}]*)\\}`, 's');
  const match = css.match(re);
  return match ? match[1] : null;
}

/** Parse a CSS value like "20px" and return the numeric part, or NaN. */
function parsePx(value: string): number {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/);
  return match ? parseFloat(match[1]) : NaN;
}

/** Extract a specific CSS property value from a rule block string. */
function getPropertyValue(block: string, property: string): string | null {
  // Matches "property: value;" inside a rule block
  const re = new RegExp(`(?:^|;|\\n)\\s*${property}\\s*:\\s*([^;\\n]+)`, 'i');
  const match = block.match(re);
  return match ? match[1].trim() : null;
}

/** Parse the shorthand `padding: <top> <right>` or `padding: <all>` and
 *  return the top value in px, or NaN. */
function parsePaddingTop(paddingValue: string): number {
  const parts = paddingValue.trim().split(/\s+/);
  // padding: <top> <right> ... OR padding: <all>
  return parsePx(parts[0]);
}

/** Parse the shorthand `padding: <top> <right>` and return the bottom value
 *  (same as top for 2-value shorthand, or index [2] for 4-value). */
function parsePaddingBottom(paddingValue: string): number {
  const parts = paddingValue.trim().split(/\s+/);
  if (parts.length === 1) return parsePx(parts[0]);
  if (parts.length === 2) return parsePx(parts[0]); // top == bottom in 2-val shorthand
  if (parts.length === 3) return parsePx(parts[2]);
  if (parts.length >= 4) return parsePx(parts[2]); // index 2 = bottom
  return NaN;
}

// ---------------------------------------------------------------------------
// Load the stylesheet once for all tests
// ---------------------------------------------------------------------------

const cssPath = resolve(__dirname, 'interviews.css');
const cssText = readFileSync(cssPath, 'utf-8');

// ---------------------------------------------------------------------------
// Property 1: Bug Condition Tests
// ---------------------------------------------------------------------------

describe('Property 1: Bug Condition — Drawer Form Spacing Values Are Excessive', () => {
  /**
   * .ftrack-section
   * Expected (compact): padding-top <= 12px, gap <= 8px
   * Unfixed (bug):      padding-top = 20px,  gap = 12px
   */
  describe('.ftrack-section spacing', () => {
    const block = extractRuleBlock(cssText, '.ftrack-section');

    it('block for .ftrack-section exists in interviews.css', () => {
      expect(block).not.toBeNull();
    });

    it('padding-top should be <= 12px (compact target)', () => {
      expect(block).not.toBeNull();
      const paddingValue = getPropertyValue(block!, 'padding');
      expect(paddingValue, 'padding declaration missing from .ftrack-section').not.toBeNull();

      const paddingTopPx = parsePaddingTop(paddingValue!);
      expect(
        paddingTopPx,
        `Counterexample — .ftrack-section padding-top is ${paddingTopPx}px (expected <= 12px). ` +
          `Bug confirmed: padding: ${paddingValue}`
      ).toBeLessThanOrEqual(12);
    });

    it('gap should be <= 8px (compact target)', () => {
      expect(block).not.toBeNull();
      const gapValue = getPropertyValue(block!, 'gap');
      expect(gapValue, 'gap declaration missing from .ftrack-section').not.toBeNull();

      const gapPx = parsePx(gapValue!);
      expect(
        gapPx,
        `Counterexample — .ftrack-section gap is ${gapPx}px (expected <= 8px). ` +
          `Bug confirmed: gap: ${gapValue}`
      ).toBeLessThanOrEqual(8);
    });
  });

  /**
   * .ftrack-field-group
   * Expected (compact): gap <= 4px
   * Unfixed (bug):      gap = 6px
   */
  describe('.ftrack-field-group spacing', () => {
    const block = extractRuleBlock(cssText, '.ftrack-field-group');

    it('block for .ftrack-field-group exists in interviews.css', () => {
      expect(block).not.toBeNull();
    });

    it('gap should be <= 4px (compact target)', () => {
      expect(block).not.toBeNull();
      const gapValue = getPropertyValue(block!, 'gap');
      expect(gapValue, 'gap declaration missing from .ftrack-field-group').not.toBeNull();

      const gapPx = parsePx(gapValue!);
      expect(
        gapPx,
        `Counterexample — .ftrack-field-group gap is ${gapPx}px (expected <= 4px). ` +
          `Bug confirmed: gap: ${gapValue}`
      ).toBeLessThanOrEqual(4);
    });
  });

  /**
   * .ftrack-input / .ftrack-select / .ftrack-textarea
   * Expected (compact): padding-top <= 6px, padding-bottom <= 6px
   * Unfixed (bug):      padding = 8px 12px  (top = 8px, bottom = 8px)
   */
  describe('.ftrack-input / .ftrack-select / .ftrack-textarea spacing', () => {
    const block = extractMultiSelectorRuleBlock(cssText, [
      '.ftrack-input',
      '.ftrack-select',
      '.ftrack-textarea',
    ]);

    it('combined block for .ftrack-input/.ftrack-select/.ftrack-textarea exists', () => {
      expect(block).not.toBeNull();
    });

    it('padding-top should be <= 6px (compact target)', () => {
      expect(block).not.toBeNull();
      const paddingValue = getPropertyValue(block!, 'padding');
      expect(paddingValue, 'padding declaration missing from .ftrack-input rule').not.toBeNull();

      const paddingTopPx = parsePaddingTop(paddingValue!);
      expect(
        paddingTopPx,
        `Counterexample — .ftrack-input padding-top is ${paddingTopPx}px (expected <= 6px). ` +
          `Bug confirmed: padding: ${paddingValue}`
      ).toBeLessThanOrEqual(6);
    });

    it('padding-bottom should be <= 6px (compact target)', () => {
      expect(block).not.toBeNull();
      const paddingValue = getPropertyValue(block!, 'padding');
      expect(paddingValue, 'padding declaration missing from .ftrack-input rule').not.toBeNull();

      const paddingBottomPx = parsePaddingBottom(paddingValue!);
      expect(
        paddingBottomPx,
        `Counterexample — .ftrack-input padding-bottom is ${paddingBottomPx}px (expected <= 6px). ` +
          `Bug confirmed: padding: ${paddingValue}`
      ).toBeLessThanOrEqual(6);
    });
  });
});
