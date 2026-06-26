# Implementation Plan

## Overview

Fix excessive vertical spacing in the "Track New Interview" drawer form by reducing three CSS declarations in `web/src/styles/interviews.css`. The change is purely cosmetic — no component logic, event handling, or API calls are affected.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3.1"] },
    { "wave": 4, "tasks": ["3.2", "3.3"] },
    { "wave": 5, "tasks": ["4"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Drawer Form Spacing Values Are Excessive
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the excessive spacing values in the CSS
  - **Scoped PBT Approach**: Scope the property to the three concrete CSS declarations that are inflated; for each, assert the computed value meets the compact target
  - Parse `web/src/styles/interviews.css` and extract declared values for the three target rules:
    - `.ftrack-section` — assert `padding-top <= 12px` and `gap <= 8px`
    - `.ftrack-field-group` — assert `gap <= 4px`
    - `.ftrack-input` / `.ftrack-select` / `.ftrack-textarea` — assert `padding-top <= 6px` and `padding-bottom <= 6px`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS — reported counterexamples should include values such as `padding-top: 20px`, `gap: 12px`, `gap: 6px`, `padding-top: 8px`
  - Document counterexamples found to confirm root cause before touching the code
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - All Non-Target CSS Rules Remain Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe the current declared values for all `.ftrack-*` rules that are NOT the three target declarations on UNFIXED code, for example:
    - `.ftrack-card`: `padding: 14px`, `gap: 10px`
    - `.ftrack-form`: `padding: 24px`, `gap: 16px`
    - `.ftrack-form-grid`: `gap: 16px`
    - `.ftrack-drawer-footer`: `padding: 16px 24px`
    - `.ftrack-input` horizontal padding: `padding-left: 12px`, `padding-right: 12px`
    - `.ftrack-section:first-child`: `padding-top: 0`, `border-top: none`
    - `.ftrack-drawer-header`: `padding: 20px 24px`
    - `.ftrack-btn`: `padding: 8px 16px`
  - Write property-based tests that: (a) enumerate all CSS rule/property pairs in `interviews.css`, (b) exclude the three declarations being fixed, and (c) assert every remaining declaration value is identical to the observed baseline
  - Verify tests pass on UNFIXED code — they must pass before the fix is applied
  - **EXPECTED OUTCOME**: Tests PASS, confirming the baseline of all non-target styles
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix excessive spacing in interview drawer form CSS

  - [x] 3.1 Apply the three CSS declaration changes in `web/src/styles/interviews.css`
    - Change `.ftrack-section`: `padding: 20px 0` → `padding: 12px 0`
    - Change `.ftrack-section`: `gap: 12px` → `gap: 8px`
    - Change `.ftrack-field-group`: `gap: 6px` → `gap: 4px`
    - Change `.ftrack-input, .ftrack-select, .ftrack-textarea`: `padding: 8px 12px` → `padding: 6px 12px`
    - No other declarations, selectors, or files are modified
    - _Bug_Condition: isBugCondition(element) holds when sectionPadding >= 20 OR sectionGap >= 12 OR fieldGroupGap >= 6 OR inputPaddingY >= 8_
    - _Expected_Behavior: After fix, sectionPadding <= 12, sectionGap <= 8, fieldGroupGap <= 4, inputPaddingY <= 6 for all affected elements_
    - _Preservation: All other .ftrack-* rules — kanban board, cards, modal form, drawer header/footer, buttons, responsive breakpoints, dropdown positioning — remain byte-identical_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Drawer Form Spacing Values Are Compact
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected spacing values; when it passes, the fix is correct
    - Run the bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES — all three CSS rules now report values within the compact thresholds
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - All Non-Target CSS Rules Remain Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run the preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS — no kanban, card, modal, footer, button, or responsive rules were inadvertently changed
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite and confirm both property tests (bug condition and preservation) pass
  - Visually verify in the browser that the "Track New Interview" drawer form is more compact and that Combobox dropdowns still position correctly
  - Ensure all tests pass; ask the user if any questions arise

## Notes

- Only `web/src/styles/interviews.css` changes — no React component files are modified
- Net estimated vertical savings ~132 px across the full drawer form
- The `.ftrack-section:first-child` override (`padding-top: 0`, `border-top: none`) is preserved unchanged
- Combobox dropdown fixed-positioning logic in `Combobox.tsx` is unaffected since the fix is spacing-only
