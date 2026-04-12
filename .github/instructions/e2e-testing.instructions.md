---
applyTo: '{e2e,apps/docs-e2e}/**'
---

# E2E Testing Patterns

Two Playwright-based e2e suites exist in the workspace:

| Suite               | Location         | Purpose                                                            | Server                         |
| ------------------- | ---------------- | ------------------------------------------------------------------ | ------------------------------ |
| **Docs demos**      | `apps/docs-e2e/` | Test every Astro demo page renders and works correctly             | Auto-starts Astro on port 4450 |
| **Cross-framework** | `e2e/`           | Visual/functional parity across Vanilla, React, Angular, Vue demos | Manual server start required   |

## Running E2E Tests

```bash
# Docs demo tests (auto-starts Astro dev server — no manual setup needed)
bun nx e2e docs-e2e

# Cross-framework tests — requires demo servers to be running first:
# Option 1: Start demos manually in a separate terminal, then run tests
bun run demo              # Starts all 4 demo servers (vanilla, react, angular, vue)
bun nx e2e e2e            # Run tests against running servers

# Option 2: Build + start + test in one command (CI-friendly)
bun run e2e:full          # Builds, starts dist servers, waits for ports, runs tests

# Update visual baselines
bun nx e2e:update-snapshots e2e
```

## Docs Demo Tests (`apps/docs-e2e/`)

Every Astro demo component **must** have a corresponding e2e test. Tests live in `apps/docs-e2e/tests/` grouped by feature.

### Test Structure

```typescript
import { expect, test } from '@playwright/test';
import { openDemo, clickCell, dataRows, cellText, grid } from './utils';

test.describe('Feature Demos', () => {
  test('DemoComponentName — user action produces expected result', async ({ page }) => {
    await openDemo(page, 'DemoComponentName');
    // Interact with the grid
    // Assert visible behavior
  });
});
```

### Shared Utilities (`apps/docs-e2e/tests/utils.ts`)

| Helper                                                    | Purpose                                            |
| --------------------------------------------------------- | -------------------------------------------------- |
| `openDemo(page, slug)`                                    | Navigate to `/demo/{slug}` and wait for grid ready |
| `grid(page)` / `gridIn(page, containerId)`                | Get grid locator, optionally scoped to container   |
| `dataRows(page)`                                          | All visible data rows (excludes headers)           |
| `cell(page, rowIdx, colIdx)`                              | Get cell by 0-based row/col index                  |
| `cellText(page, rowIdx, colIdx)`                          | Get cell text content                              |
| `headerCells(page)` / `headerCell(page, text)`            | Header locators                                    |
| `clickCell(page, rowIdx, colIdx)`                         | Single click a cell                                |
| `dblClickCell(page, rowIdx, colIdx)`                      | Double-click to activate editor (+200ms wait)      |
| `rightClickCell(page, rowIdx, colIdx)`                    | Context menu trigger                               |
| `typeAndCommit(page, value)`                              | Ctrl+A → type → Enter → 200ms wait                 |
| `sortByColumn(page, headerText)`                          | Click header to sort (+300ms wait)                 |
| `filterColumn(page, field, value)`                        | Fill filter input (+500ms debounce)                |
| `rowCount(page)`                                          | Count visible data rows                            |
| `getSortDirection(page, headerText)`                      | Read `aria-sort` attribute                         |
| `collectConsoleErrors(page, fn)` / `assertNoErrors(page)` | Console error capture                              |

### What to Test in Each Demo

Tests must verify **user-visible behavior**, not internal state:

1. **Renders correctly** — grid visible, rows present, correct headers
2. **Feature works** — simulate the interaction the demo advertises and verify the outcome
3. **Events fire** — if the demo has an output panel (`[data-event-log]`, `[data-output-id="*"]`), verify it updates
4. **Controls work** — if using `DemoControls`, switch modes/options and verify the grid responds

### Interaction Testing Depth

Go beyond smoke tests. If a demo shows range selection, **actually test range selection**:

```typescript
test('SelectionDemo — drag selects a range of cells', async ({ page }) => {
  await openDemo(page, 'SelectionRangeDemo');

  // Drag from cell (0,1) to cell (2,3)
  const startCell = cell(page, 0, 1);
  const endCell = cell(page, 2, 3);
  await startCell.hover();
  await page.mouse.down();
  await endCell.hover();
  await page.mouse.up();
  await page.waitForTimeout(300);

  // Verify selected cells have the correct class
  const selectedCells = grid(page).locator('[role="gridcell"].selected');
  await expect(selectedCells).toHaveCount(expectedCount);

  // Verify event output reflects the selection
  const output = page.locator('[data-output-id="selection-demo"]');
  const text = await output.textContent();
  expect(text).toContain('rows');
});
```

### Wait Strategies

| After...            | Wait                                |
| ------------------- | ----------------------------------- |
| Cell click/dblclick | 200ms                               |
| Sort column click   | 300ms                               |
| Filter value change | 500ms (debounce)                    |
| DemoControls change | 300ms                               |
| Async data loading  | 800ms                               |
| `openDemo()`        | Built-in (300ms post-render buffer) |

### Selectors

Use ARIA roles and data attributes for robustness:

- Rows: `[role="row"]` via `dataRows()`
- Cells: `[role="gridcell"]` via `cell()`
- Headers: `[role="columnheader"]` via `headerCell()`
- Filter buttons: `.tbw-filter-btn`
- Filter panel: `.tbw-filter-panel`
- Event outputs: `[data-event-log]`, `[data-output-id="*"]`, `#<feature>-events-log`
- Selection state: row/cell `class` attribute containing `selected`

### Naming Convention

Test files match feature names: `selection.spec.ts`, `editing.spec.ts`, `sorting.spec.ts`.

Test names follow: `DemoComponentName — what the test verifies`

## Cross-Framework Tests (`e2e/`)

These verify visual and functional parity across framework demos (vanilla as baseline).

### Key Conventions

- **No retries** — deterministic tests; retrying masks real bugs
- **Serial mode** — tests within a describe block run sequentially
- **Masking** — shell titles masked via `getMaskLocators()` to hide framework names
- **ARIA selectors** — same `SELECTORS` object shared across all frameworks
- **Vanilla = baseline** — visual comparisons use vanilla screenshots as reference
- **Demo servers must be running** — tests don't auto-start servers

### Utilities (`e2e/tests/utils.ts`)

| Helper                                                 | Purpose                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `DEMOS`                                                | Port map: vanilla=4000, react=4300, angular=4200, vue=4100 |
| `SELECTORS`                                            | Shared CSS/ARIA selectors for grid elements                |
| `waitForGridReady(page)`                               | Wait for grid + rows + 500ms animation buffer              |
| `getMaskLocators(page)`                                | Locators to mask in visual comparisons                     |
| `captureGridScreenshot(page)`                          | Grid-scoped screenshot with title hidden                   |
| `activateCellEditor(page, field)`                      | Double-click cell by field name                            |
| `setMobileViewport(page)` / `setDesktopViewport(page)` | Viewport helpers                                           |

## Performance Regression Tests (`e2e/tests/performance-regression.spec.ts`)

Automated benchmarks that catch performance regressions in CI via **relative baseline comparison** (not absolute budgets).

### How It Works

1. Tests measure render, scroll, sort, filter, and interaction metrics
2. Metrics are recorded to `e2e/test-results/perf-metrics-*.json`
3. CI runs tests **3 times** and takes the **median** of each metric
4. `scripts/compare-perf-baseline.mjs` compares medians against `e2e/perf-baseline.json`
5. Fails if any metric regresses **>50%** over baseline

### Environment Variables

| Variable             | Purpose                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `PERF_BASELINE_MODE` | Set to `record` to skip hard assertions (CI uses baseline comparison) |
| `PERF_RUN_ID`        | Unique ID for the output file (`perf-metrics-{runId}.json`)           |

### Running Locally

```bash
# Local mode (hard assertions + metric recording)
bunx playwright test --config=e2e/playwright.config.ts performance-regression

# CI-style mode (record-only, no hard assertions)
PERF_BASELINE_MODE=record bunx playwright test --config=e2e/playwright.config.ts performance-regression
```

### Updating the Baseline

Trigger **"Update perf baseline"** via `workflow_dispatch` in GitHub Actions, or manually:

```bash
# Run 3 times to collect medians
for i in 1 2 3; do PERF_BASELINE_MODE=record PERF_RUN_ID=run$i bunx playwright test --config=e2e/playwright.config.ts --grep "Performance Regression"; done
node scripts/update-perf-baseline.mjs e2e/test-results
```

### Key Files

| File                                       | Purpose                                      |
| ------------------------------------------ | -------------------------------------------- |
| `e2e/tests/performance-regression.spec.ts` | Test definitions with `recordMetric()` calls |
| `e2e/tests/perf-metrics-helper.ts`         | Metric accumulator + flush utility           |
| `e2e/perf-baseline.json`                   | Committed baseline (CI-recorded)             |
| `scripts/compare-perf-baseline.mjs`        | Compares results vs baseline, exits non-zero |
| `scripts/update-perf-baseline.mjs`         | Records new baseline from result files       |
