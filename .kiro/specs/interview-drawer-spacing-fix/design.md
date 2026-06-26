# Interview Drawer Spacing Fix — Bugfix Design

## Overview

The "Track New Interview" drawer form renders Combobox select components (Company Name, Position, Location) with excessive vertical spacing. The root cause is over-generous values in three CSS rules inside `interviews.css`: `.ftrack-section` carries `padding: 20px 0` and `gap: 12px`, `.ftrack-field-group` carries `gap: 6px`, and `.ftrack-input` carries `padding: 8px 12px`. Together these inflate each field row significantly, forcing the user to scroll further than necessary. The fix is a targeted reduction of those three values — no structural changes, no component logic changes.

## Glossary

- **Bug_Condition (C)**: The condition where a Combobox select component inside the drawer form displays with excessive vertical height due to inflated CSS spacing values
- **Property (P)**: The desired behavior — Combobox components render with compact, visually dense spacing that keeps the full form accessible with minimal scrolling
- **Preservation**: All other styling (kanban board, cards, modal, drawer animation, footer buttons, responsive breakpoints, dropdown positioning) that must remain exactly unchanged by this fix
- **`interviews.css`**: The single stylesheet at `web/src/styles/interviews.css` that owns all `.ftrack-*` CSS rules
- **`.ftrack-section`**: CSS class applied to each logical form section (`<section>` elements in `InterviewFormDrawer.tsx`). Controls vertical padding between sections and the gap between fields within a section
- **`.ftrack-field-group`**: CSS class applied to each label+input pair (also used as the root element of `Combobox`). Controls the gap between the label and the input
- **`.ftrack-input`**: CSS class applied to all text/number inputs and the Combobox internal `<input>`. Controls internal padding, directly determining rendered input height
- **`Combobox`**: The reusable component at `web/src/components/Combobox.tsx` whose root element carries both `ftrack-field-group` and `ftrack-searchable-select` classes

## Bug Details

### Bug Condition

The bug manifests when the drawer form is open and the user views or scrolls the "Company & Role" section (and all subsequent sections). The Combobox components for Company Name, Position, and Location each render taller than necessary because every stacked CSS layer adds vertical space:

1. Each `<section class="ftrack-section">` has `padding: 20px 0` — 20 px of air above and below every section
2. Each `<section class="ftrack-section">` has `gap: 12px` — 12 px between every field inside the section
3. Each `<div class="ftrack-field-group">` has `gap: 6px` — 6 px between label and input
4. Each `<input class="ftrack-input">` has `padding: 8px 12px` — 8 px top and bottom inside the input box

With three Comboboxes stacked in the "Company & Role" section alone the cumulative vertical space consumed is:
- Section top padding: 20 px
- Combobox 1 label + 6px gap + input (8+8=16px internal padding + ~20px line-height ≈ 36px): ~54 px
- Gap to Combobox 2: 12 px
- Combobox 2: ~54 px
- Gap to Combobox 3: 12 px
- Combobox 3: ~54 px
- Section bottom padding: 20 px
- **Total "Company & Role" section alone: ~232 px**

This repeats across four sections, consuming most of a typical 600 px drawer body before the user even reaches Compensation or Status fields.

**Formal Specification:**
```
FUNCTION isBugCondition(element)
  INPUT: element — a DOM element rendered inside the drawer form
  OUTPUT: boolean

  sectionPadding  := computedStyle(element.closest('.ftrack-section')).paddingTop   // px
  sectionGap      := computedStyle(element.closest('.ftrack-section')).gap            // px
  fieldGroupGap   := computedStyle(element.closest('.ftrack-field-group')).gap        // px
  inputPaddingY   := computedStyle(element.querySelector('.ftrack-input')).paddingTop // px

  RETURN sectionPadding  >= 20
      OR sectionGap      >= 12
      OR fieldGroupGap   >= 6
      OR inputPaddingY   >= 8
END FUNCTION
```

### Examples

- **Company Name Combobox**: renders ~54 px tall (label 12px + 6px gap + input 36px) with a 20 px section top padding above it and a 12 px gap below it before Position — expected ~44 px total height with 12 px section top and 8 px gap
- **Position Combobox**: same dimensions, sits 12 px below Company Name — expected 8 px gap
- **Location Combobox**: same dimensions, sits 12 px below Position — expected 8 px gap
- **Non-Combobox inputs (e.g., Recruiter Name)**: also affected by the same rules but less visually critical — spacing should improve consistently

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Mouse and keyboard interaction with all form inputs must continue to work exactly as before
- Combobox dropdown positioning (fixed-position overlay computed via `getBoundingClientRect`) must remain pixel-accurate — the fix touches only spacing, not positioning logic
- Kanban board, kanban cards, and all `.ftrack-board-*` / `.ftrack-card-*` styles must be completely unaffected — those classes are separate
- Modal dialog styles (`.ftrack-modal`, `.ftrack-modal-header`, `.ftrack-form`, `.ftrack-form-grid`) must be completely unaffected — they use their own padding/gap rules, not `.ftrack-section`
- Drawer header and footer (`.ftrack-drawer-header`, `.ftrack-drawer-footer`) padding must remain unchanged
- Drawer open/close animation and overlay must remain unchanged
- Responsive breakpoints for `.ftrack-form-row` (480 px) and `.ftrack-board` (1024 px / 768 px) must remain unchanged
- Button styles (`.ftrack-btn`, `.ftrack-btn--primary`, `.ftrack-btn--secondary`) must remain unchanged
- Round editing UI inside the drawer (`.ftrack-rounds-list-edit`, `.ftrack-round-item-edit`) must remain unchanged

**Scope:**
Only the three CSS rules listed under Fix Implementation are changed. Every other rule in `interviews.css` is untouched. The change is purely cosmetic (spacing values), so no component logic, event handling, or API calls are affected.

## Hypothesized Root Cause

Based on reading the source CSS and component structure, the root cause is straightforward — no hidden logic issue:

1. **Over-generous `.ftrack-section` padding**: `padding: 20px 0` was likely copied from the modal form's `.ftrack-form` rule (`padding: 24px`) or set with desktop screen real-estate in mind. Inside a narrow 550 px drawer with many stacked sections this is too generous.

2. **Compounding `.ftrack-section` gap**: `gap: 12px` between fields stacks three times for three Comboboxes in the first section. Reducing to `8px` saves 12 px in that section alone.

3. **`.ftrack-input` vertical padding**: `padding: 8px 12px` produces a ~36 px input height. Reducing top/bottom to `6px` brings the rendered height down by ~4 px per input without sacrificing usability.

4. **No code path issue**: Unlike a typical bug this is not a logic error — the styles are intentional but sized incorrectly for a scrolling drawer context. No event listeners, state variables, or API calls need to change.

## Correctness Properties

Property 1: Bug Condition — Combobox Components Display with Compact Spacing

_For any_ Combobox or input field rendered inside the drawer form where the bug condition holds (any of the inflated spacing values are present), the fixed CSS SHALL reduce the rendered vertical footprint of each field group so that the full form fits within a shorter scroll distance, with section padding ≤ 12 px, section gap ≤ 8 px, field-group gap ≤ 4 px, and input vertical padding ≤ 6 px.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — All Non-Spacing Styles Remain Unchanged

_For any_ element outside the drawer form, or any element inside the drawer form that does not use `.ftrack-section`, `.ftrack-field-group`, or `.ftrack-input` to control its vertical spacing, the fixed stylesheet SHALL produce exactly the same computed styles as the original stylesheet, preserving all existing layout, interaction, animation, and responsive behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File**: `web/src/styles/interviews.css`

Only three CSS declarations change. No other file is touched.

---

**Change 1 — `.ftrack-section` padding**

```css
/* BEFORE */
.ftrack-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 0;
  border-top: 1px solid var(--border);
}

/* AFTER */
.ftrack-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
}
```

- `padding: 20px 0` → `padding: 12px 0`: removes 16 px of vertical air per section (8 px top + 8 px bottom saved). With four sections that is 64 px saved.
- `gap: 12px` → `gap: 8px`: removes 4 px between each field pair. The "Company & Role" section has three fields — that saves 8 px in that section alone.

---

**Change 2 — `.ftrack-field-group` gap**

```css
/* BEFORE */
.ftrack-field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* AFTER */
.ftrack-field-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

- `gap: 6px` → `gap: 4px`: tightens the label-to-input spacing by 2 px per field. With ~10 field groups in the full form this saves ~20 px total.

---

**Change 3 — `.ftrack-input` (and `.ftrack-select`, `.ftrack-textarea`) vertical padding**

```css
/* BEFORE */
.ftrack-input,
.ftrack-select,
.ftrack-textarea {
  ...
  padding: 8px 12px;
  ...
}

/* AFTER */
.ftrack-input,
.ftrack-select,
.ftrack-textarea {
  ...
  padding: 6px 12px;
  ...
}
```

- `padding: 8px 12px` → `padding: 6px 12px`: reduces each input height by 4 px (2 px top + 2 px bottom). Horizontal padding is unchanged to preserve visual alignment. With ~10 inputs in the form this saves ~40 px total.

---

**Net estimated vertical savings**: ~64 px (section padding) + ~8 px (section gap) + ~20 px (field-group gap) + ~40 px (input padding) ≈ **132 px** — roughly equivalent to removing 2–3 full field groups from the visible scroll height.

**No changes to**:
- `Combobox.tsx` — the component applies these classes correctly; only the values change
- `InterviewFormDrawer.tsx` — form structure, sections, and field layout are unchanged
- Any other CSS rule in `interviews.css`
- Any backend file

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first confirm the bug is observable on the unfixed CSS by measuring or visually inspecting spacing values, then verify the fix produces the correct compact spacing while all non-spacing behavior is preserved.

### Exploratory Bug Condition Checking

**Goal**: Surface concrete evidence of the bug BEFORE applying the fix. Confirm that the three identified CSS rules are the direct cause. If measurements don't match the hypothesis, re-examine whether other CSS rules (e.g., margin on `.ftrack-section__title`) also contribute.

**Test Plan**: Open the drawer form in the browser with DevTools, select each Combobox wrapper element, and record computed spacing values. Alternatively render the component in a test environment and assert computed styles.

**Test Cases**:
1. **Section padding check**: Inspect `.ftrack-section` computed `padding-top` — expect to find `20px` (will confirm bug on unfixed code)
2. **Section gap check**: Inspect `.ftrack-section` computed `gap` — expect to find `12px` (will confirm bug on unfixed code)
3. **Field-group gap check**: Inspect `.ftrack-field-group` computed `gap` — expect to find `6px` (will confirm bug on unfixed code)
4. **Input padding check**: Inspect `.ftrack-input` computed `padding-top` — expect to find `8px` (will confirm bug on unfixed code)
5. **Scroll depth check**: Measure total scrollable height of `.ftrack-drawer-body` — expect excessive height requiring scroll past the fold to reach Compensation section

**Expected Counterexamples**:
- Computed `padding-top` on `.ftrack-section` returns `20px` instead of `≤12px`
- User must scroll to access Compensation and Status sections even on a 768 px viewport

### Fix Checking

**Goal**: Verify that after applying the fix, all inputs where the bug condition holds (i.e., fields using the three changed CSS rules) now display with the reduced spacing values.

**Pseudocode:**
```
FOR ALL element WHERE isBugCondition(element) DO
  result := computedSpacing(element, fixedStylesheet)
  ASSERT result.sectionPadding  <= 12
  ASSERT result.sectionGap      <= 8
  ASSERT result.fieldGroupGap   <= 4
  ASSERT result.inputPaddingY   <= 6
END FOR
```

### Preservation Checking

**Goal**: Verify that for all elements where the bug condition does NOT hold (elements outside the drawer form, or drawer elements that don't use the three changed rules), computed styles are identical before and after the fix.

**Pseudocode:**
```
FOR ALL element WHERE NOT isBugCondition(element) DO
  ASSERT computedStyle(element, originalStylesheet)
       = computedStyle(element, fixedStylesheet)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many element/class combinations automatically
- It catches accidental CSS specificity collisions with other `.ftrack-*` rules
- It provides confidence that no kanban, card, or modal styles were inadvertently changed

**Test Cases**:
1. **Kanban card preservation**: Verify `.ftrack-card` padding (`14px`) and gap (`10px`) are unchanged after fix
2. **Modal form preservation**: Verify `.ftrack-form` padding (`24px`) and `.ftrack-form-grid` gap (`16px`) are unchanged after fix
3. **Drawer footer preservation**: Verify `.ftrack-drawer-footer` padding (`16px 24px`) is unchanged after fix
4. **Dropdown positioning preservation**: Open a Combobox dropdown and verify it positions flush below the input with `4px` offset — confirm `getBoundingClientRect`-based fixed positioning still works correctly

### Unit Tests

- Assert that `.ftrack-section` has `padding-top: 12px` after fix
- Assert that `.ftrack-section` has `gap: 8px` after fix
- Assert that `.ftrack-field-group` has `gap: 4px` after fix
- Assert that `.ftrack-input` has `padding-top: 6px` and `padding-bottom: 6px` after fix
- Assert that `.ftrack-input` horizontal padding (`padding-left`, `padding-right`) remains `12px`
- Assert that `.ftrack-section:first-child` retains `border-top: none` and `padding-top: 0`

### Property-Based Tests

- Generate all `.ftrack-*` class names from the stylesheet and verify that only the three target declarations changed — all other property/value pairs are identical between original and fixed stylesheets
- Generate a range of viewport heights (600 px – 1200 px) and verify that the total scroll height of the drawer body is reduced after the fix while remaining scrollable
- For each non-Combobox element in the drawer (buttons, select, textarea), verify that its computed height is unchanged

### Integration Tests

- Open the "Track New Interview" drawer and verify all three Combobox fields are visible in the viewport without scrolling on a 768 px tall viewport
- Interact with each Combobox (type to filter, select an option) and verify the dropdown appears at the correct position relative to the input
- Click "Track Interview" / "Save Changes" and verify the form submits successfully — confirming no functional regression
- Open the kanban board and verify column and card layout is pixel-identical to pre-fix state
- Open the edit modal (if used elsewhere in the app) and verify its spacing is unchanged
