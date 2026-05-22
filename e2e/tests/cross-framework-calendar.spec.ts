import { expect, test } from '@playwright/test';
import { expectScreenshotIfBaselineExists, getMaskLocators, SELECTORS, waitForGridReady } from './utils';

/**
 * Cross-Framework Calendar Parity
 *
 * Sanity-check that the calendar demo renders consistently across
 * Vanilla, React, Angular and Vue. The calendar shares its data, layout
 * and stylesheet (`@demo/shared/calendar`), so all four implementations
 * should produce a structurally identical month view and the same visual
 * baseline.
 *
 * Kept intentionally lightweight — just one page, one screenshot, plus a
 * couple of structural assertions. Visual comparison skips gracefully if
 * no baseline exists (see `expectScreenshotIfBaselineExists`).
 */

const CALENDAR_DEMOS = {
  vanilla: 'http://localhost:4000/calendar',
  react: 'http://localhost:4300/calendar',
  angular: 'http://localhost:4200/calendar',
  vue: 'http://localhost:4100/calendar',
} as const;

test.describe('Cross-Framework Calendar Parity', () => {
  test.describe.configure({ mode: 'serial', retries: 0 });

  for (const [demoName, url] of Object.entries(CALENDAR_DEMOS)) {
    test(`${demoName}: calendar renders with shared structure`, async ({ page }, testInfo) => {
      await page.goto(url);
      await waitForGridReady(page);

      // Core grid present
      const grid = page.locator(SELECTORS.grid);
      await expect(grid).toBeVisible();

      // Week-number column + 7 weekday columns = 8 header cells
      const headerCells = page.locator(SELECTORS.headerCell);
      await expect(headerCells).toHaveCount(8);

      // Week-number cells in the body — selector keyed on `data-field`
      // (set by the grid for every cell), so it matches all four frameworks
      // regardless of `cellClass` support.
      const weekCells = page.locator(`${SELECTORS.grid} .data-grid-row .cell[data-field='weekNumber']`);
      const weekCount = await weekCells.count();
      // A month spans 4-6 calendar weeks; allow the full range.
      expect(weekCount).toBeGreaterThanOrEqual(4);
      expect(weekCount).toBeLessThanOrEqual(6);

      // Visual parity — skipped if no baseline committed for this platform
      await expectScreenshotIfBaselineExists(grid, 'calendar-baseline.png', testInfo, {
        mask: getMaskLocators(page),
        animations: 'disabled',
      });
    });
  }
});
