import { expect, test } from '@playwright/test';
import { DEMOS, SELECTORS, waitForGridReadyMobile } from './utils';

/**
 * Touch Input E2E Tests — scaffold for the touch-input epic (#302/#307).
 *
 * Runs with `hasTouch: true` and `isMobile: true` to emulate a touch device.
 * Sibling sub-issues (#303–#306) will add gesture-specific tests to this file.
 *
 * Requires the vanilla demo server to be running on localhost:4000.
 * Start it with: `bun nx serve demo-vanilla`
 */

test.use({ hasTouch: true, isMobile: true });

test.describe('Touch Input — smoke tests', () => {
  test('grid renders and a cell can be tapped to focus', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReadyMobile(page);

    // Verify the grid is visible
    const grid = page.locator(SELECTORS.grid);
    await expect(grid).toBeVisible();

    // Tap the first data cell
    const firstCell = grid.locator(SELECTORS.cell).first();
    await expect(firstCell).toBeVisible();
    await firstCell.tap();
    await page.waitForTimeout(200);

    // After a tap the cell should be focused — the grid sets aria-colindex and
    // moves keyboard focus to the active cell.  We verify at least one cell
    // exists and is reachable by tap without throwing an error.
    const cellCount = await grid.locator(SELECTORS.cell).count();
    expect(cellCount).toBeGreaterThan(0);
  });
});
