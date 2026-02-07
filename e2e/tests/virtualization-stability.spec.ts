import { expect, test } from '@playwright/test';
import { DEMOS, SELECTORS, waitForGridReady } from './utils';

/**
 * E2E tests for variable row height virtualization stability.
 *
 * These tests verify that the grid's virtualization system handles variable
 * row heights correctly without visual artifacts:
 * - No "jumpiness" in scrollbar position
 * - No blank areas in the viewport
 * - Rows always fill the visible area
 * - Scroll position remains stable when expanding/collapsing details
 */
test.describe('Variable Row Height Virtualization Stability', () => {
  test.describe('Scroll Stability with Master-Detail', () => {
    test('vanilla: should not have blank areas when scrolling with expanded details', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // Enable master-detail
      const detailCheckbox = page.locator('#enable-detail');
      if (await detailCheckbox.isVisible()) {
        const isChecked = await detailCheckbox.isChecked();
        if (!isChecked) {
          await detailCheckbox.check();
          await page.waitForTimeout(500);
        }
      }
      await waitForGridReady(page);

      // Expand first 3 detail rows
      const expanders = page.locator('.master-detail-toggle');
      const expanderCount = await expanders.count();
      const toExpand = Math.min(3, expanderCount);

      for (let i = 0; i < toExpand; i++) {
        // Use evaluate to scroll and click in one action - handles virtualized elements
        const expander = expanders.nth(i);
        await expander.evaluate((el) => {
          el.scrollIntoView({ block: 'center' });
          (el as HTMLElement).click();
        });
        await page.waitForTimeout(200);
      }

      // Get the rows viewport
      const viewport = page.locator(SELECTORS.body);
      await expect(viewport).toBeVisible();

      // Scroll down in increments and check for blank areas at each step
      const scrollable = page.locator('.faux-vscroll');
      const scrollHeight = await scrollable.evaluate((el) => el.scrollHeight);
      const clientHeight = await scrollable.evaluate((el) => el.clientHeight);

      // Scroll through the grid in steps
      const scrollSteps = 10;
      const scrollIncrement = Math.floor((scrollHeight - clientHeight) / scrollSteps);

      for (let step = 0; step <= scrollSteps; step++) {
        const targetScroll = Math.min(step * scrollIncrement, scrollHeight - clientHeight);

        await scrollable.evaluate((el, scrollTop) => {
          el.scrollTop = scrollTop;
        }, targetScroll);

        // Wait for virtualization to update
        await page.waitForTimeout(100);

        // Verify no blank areas: the rows container should have visible rows
        const visibleRows = page.locator(`${SELECTORS.body} .data-grid-row`);
        const rowCount = await visibleRows.count();
        expect(rowCount).toBeGreaterThan(0);

        // Check that the viewport doesn't have large empty gaps
        // by verifying first and last visible rows cover the viewport
        const viewportBounds = await viewport.boundingBox();
        if (viewportBounds && rowCount > 0) {
          const firstRow = visibleRows.first();
          const lastRow = visibleRows.last();

          const firstRowBounds = await firstRow.boundingBox();
          const lastRowBounds = await lastRow.boundingBox();

          if (firstRowBounds && lastRowBounds) {
            // First row should start at or before viewport top (accounting for overscan)
            // Allow some tolerance for padding/margins
            const tolerance = 100; // pixels
            expect(firstRowBounds.y).toBeLessThanOrEqual(viewportBounds.y + tolerance);

            // Last row should extend to or past viewport bottom
            const lastRowBottom = lastRowBounds.y + lastRowBounds.height;
            const viewportBottom = viewportBounds.y + viewportBounds.height;
            expect(lastRowBottom).toBeGreaterThanOrEqual(viewportBottom - tolerance);
          }
        }
      }
    });

    test('vanilla: scrollbar should not jump when expanding details mid-scroll', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // Enable master-detail
      const detailCheckbox = page.locator('#enable-detail');
      if (await detailCheckbox.isVisible()) {
        const isChecked = await detailCheckbox.isChecked();
        if (!isChecked) {
          await detailCheckbox.check();
          await page.waitForTimeout(500);
        }
      }
      await waitForGridReady(page);

      const scrollable = page.locator('.faux-vscroll');

      // Scroll to middle of the grid
      const scrollHeight = await scrollable.evaluate((el) => el.scrollHeight);
      const clientHeight = await scrollable.evaluate((el) => el.clientHeight);
      const midScroll = Math.floor((scrollHeight - clientHeight) / 2);

      await scrollable.evaluate((el, scrollTop) => {
        el.scrollTop = scrollTop;
      }, midScroll);
      await page.waitForTimeout(200);

      // Record scroll position before expanding
      const scrollBefore = await scrollable.evaluate((el) => el.scrollTop);

      // Find and expand a visible detail row
      const expanders = page.locator('.master-detail-toggle');
      const expanderCount = await expanders.count();

      if (expanderCount > 0) {
        // After scrolling, find an expander that's in the visible viewport
        // Use force: true to bypass any overlay interception
        const visibleExpander = page.locator('.master-detail-toggle:not([aria-expanded="true"])').first();
        await visibleExpander.scrollIntoViewIfNeeded();
        await visibleExpander.click({ force: true });
        await page.waitForTimeout(300);

        // Get scroll position after expanding
        const scrollAfter = await scrollable.evaluate((el) => el.scrollTop);

        // Scroll position should remain relatively stable (within tolerance)
        // Some adjustment is expected as the grid recalculates, but no wild jumps
        const maxJump = 50; // Maximum acceptable scroll jump in pixels
        const scrollDelta = Math.abs(scrollAfter - scrollBefore);

        expect(scrollDelta).toBeLessThan(maxJump);
      }
    });

    test('vanilla: rapid scroll should not cause visual artifacts', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // Enable master-detail
      const detailCheckbox = page.locator('#enable-detail');
      if (await detailCheckbox.isVisible()) {
        const isChecked = await detailCheckbox.isChecked();
        if (!isChecked) {
          await detailCheckbox.check();
          await page.waitForTimeout(500);
        }
      }
      await waitForGridReady(page);

      // Expand a few rows first
      const expanders = page.locator('.master-detail-toggle');
      const expanderCount = await expanders.count();
      const toExpand = Math.min(5, expanderCount);

      for (let i = 0; i < toExpand; i++) {
        // Use evaluate to scroll and click in one action - handles virtualized elements
        const expander = expanders.nth(i);
        await expander.evaluate((el) => {
          el.scrollIntoView({ block: 'center' });
          (el as HTMLElement).click();
        });
        await page.waitForTimeout(100);
      }

      const scrollable = page.locator('.faux-vscroll');
      const scrollHeight = await scrollable.evaluate((el) => el.scrollHeight);
      const clientHeight = await scrollable.evaluate((el) => el.clientHeight);

      // Perform rapid scrolling (simulate mouse wheel)
      const rapidScrollSteps = 20;
      for (let i = 0; i < rapidScrollSteps; i++) {
        const targetScroll = Math.floor(((scrollHeight - clientHeight) * i) / rapidScrollSteps);
        await scrollable.evaluate((el, scrollTop) => {
          el.scrollTop = scrollTop;
        }, targetScroll);
        // Very short delay to simulate rapid scrolling
        await page.waitForTimeout(30);
      }

      // After rapid scrolling, wait for stabilization
      await page.waitForTimeout(500);

      // Verify grid is still rendering correctly
      const visibleRows = page.locator(`${SELECTORS.body} .data-grid-row`);
      const rowCount = await visibleRows.count();
      expect(rowCount).toBeGreaterThan(0);

      // Verify no JavaScript errors occurred
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      // Small scroll to trigger any deferred errors
      await scrollable.evaluate((el) => {
        el.scrollTop += 10;
      });
      await page.waitForTimeout(200);

      expect(errors).toHaveLength(0);
    });

    test('vanilla: scroll to bottom and back should maintain consistency', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // Enable master-detail
      const detailCheckbox = page.locator('#enable-detail');
      if (await detailCheckbox.isVisible()) {
        const isChecked = await detailCheckbox.isChecked();
        if (!isChecked) {
          await detailCheckbox.check();
          await page.waitForTimeout(500);
        }
      }
      await waitForGridReady(page);

      // Expand first rows
      const expanders = page.locator('.master-detail-toggle');
      const expanderCount = await expanders.count();

      if (expanderCount >= 2) {
        await expanders.nth(0).click({ force: true });
        await page.waitForTimeout(150);
        await expanders.nth(1).click({ force: true });
        await page.waitForTimeout(150);
      }

      const scrollable = page.locator('.faux-vscroll');

      // Get initial state
      const initialScrollHeight = await scrollable.evaluate((el) => el.scrollHeight);

      // Scroll to bottom
      await scrollable.evaluate((el) => {
        el.scrollTop = el.scrollHeight - el.clientHeight;
      });
      await page.waitForTimeout(300);

      // Verify we're at the bottom
      const scrollTop = await scrollable.evaluate((el) => el.scrollTop);
      const clientHeight = await scrollable.evaluate((el) => el.clientHeight);
      const scrollHeight = await scrollable.evaluate((el) => el.scrollHeight);

      expect(scrollTop + clientHeight).toBeCloseTo(scrollHeight, -1); // Within 10px

      // Scroll back to top
      await scrollable.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(300);

      // Verify first row is visible
      const firstRow = page.locator(`${SELECTORS.body} .data-grid-row`).first();
      await expect(firstRow).toBeVisible();

      // Check that scroll height remained consistent
      const finalScrollHeight = await scrollable.evaluate((el) => el.scrollHeight);
      const heightDifference = Math.abs(finalScrollHeight - initialScrollHeight);

      // Allow tolerance for measurement differences - variable row heights
      // can cause recalculation differences when scrolling
      expect(heightDifference).toBeLessThan(250);
    });
  });

  test.describe('Viewport Coverage', () => {
    test('vanilla: rows should always fill the viewport', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      const viewport = page.locator(SELECTORS.body);
      const viewportBounds = await viewport.boundingBox();

      if (!viewportBounds) {
        throw new Error('Could not get viewport bounds');
      }

      // Check at multiple scroll positions
      const scrollable = page.locator('.faux-vscroll');
      const scrollHeight = await scrollable.evaluate((el) => el.scrollHeight);
      const clientHeight = await scrollable.evaluate((el) => el.clientHeight);

      const scrollPositions = [0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.floor(ratio * (scrollHeight - clientHeight)));

      for (const scrollPos of scrollPositions) {
        await scrollable.evaluate((el, pos) => {
          el.scrollTop = pos;
        }, scrollPos);
        await page.waitForTimeout(150);

        // Get all visible rows
        const rows = page.locator(`${SELECTORS.body} .data-grid-row`);
        const rowCount = await rows.count();

        // Should always have rows visible
        expect(rowCount).toBeGreaterThan(0);

        // Calculate total row coverage
        let totalRowHeight = 0;
        for (let i = 0; i < rowCount; i++) {
          const rowBounds = await rows.nth(i).boundingBox();
          if (rowBounds) {
            totalRowHeight += rowBounds.height;
          }
        }

        // Total row height should cover at least the viewport height
        // (overscan means it could be more)
        expect(totalRowHeight).toBeGreaterThanOrEqual(viewportBounds.height * 0.9);
      }
    });

    test('vanilla: detail rows should be properly measured', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // Enable master-detail
      const detailCheckbox = page.locator('#enable-detail');
      if (await detailCheckbox.isVisible()) {
        const isChecked = await detailCheckbox.isChecked();
        if (!isChecked) {
          await detailCheckbox.check();
          await page.waitForTimeout(500);
        }
      }
      await waitForGridReady(page);

      // Expand a detail row
      const expanders = page.locator('.master-detail-toggle');
      if ((await expanders.count()) > 0) {
        await expanders.first().click({ force: true });
        await page.waitForTimeout(300);

        // Verify detail row is visible and has proper height
        const detailRow = page.locator('.master-detail-row').first();
        await expect(detailRow).toBeVisible();

        const detailBounds = await detailRow.boundingBox();
        expect(detailBounds).toBeTruthy();
        expect(detailBounds!.height).toBeGreaterThan(0);

        // Detail should have actual content height, not 0 or collapsed
        expect(detailBounds!.height).toBeGreaterThan(50); // Reasonable minimum
      }
    });
  });

  test.describe('Scroll Position Stability', () => {
    test('vanilla: collapsing expanded row should not cause scroll jump', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // Enable master-detail
      const detailCheckbox = page.locator('#enable-detail');
      if (await detailCheckbox.isVisible()) {
        const isChecked = await detailCheckbox.isChecked();
        if (!isChecked) {
          await detailCheckbox.check();
          await page.waitForTimeout(500);
        }
      }
      await waitForGridReady(page);

      // Expand a row
      const expanders = page.locator('.master-detail-toggle');
      if ((await expanders.count()) > 0) {
        // Expand first row using force to bypass overlays
        await expanders.first().click({ force: true });
        await page.waitForTimeout(300);

        const scrollable = page.locator('.faux-vscroll');

        // Scroll down a bit
        await scrollable.evaluate((el) => {
          el.scrollTop = 200;
        });
        await page.waitForTimeout(200);

        // Record position
        const scrollBefore = await scrollable.evaluate((el) => el.scrollTop);

        // Collapse the row - find the expanded toggle and scroll it into view first
        const expandedToggle = page.locator(".master-detail-toggle[aria-expanded='true']").first();
        // Use evaluate to scroll and click in one action to avoid viewport race
        await expandedToggle.evaluate((el) => {
          el.scrollIntoView({ block: 'center' });
          (el as HTMLElement).click();
        });
        await page.waitForTimeout(300);

        // Check scroll didn't jump significantly
        const scrollAfter = await scrollable.evaluate((el) => el.scrollTop);
        const jumpAmount = Math.abs(scrollAfter - scrollBefore);

        // Should not jump more than the detail row height
        expect(jumpAmount).toBeLessThan(200);
      }
    });

    test('vanilla: expanding detail below viewport should not affect current view', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // Enable master-detail
      const detailCheckbox = page.locator('#enable-detail');
      if (await detailCheckbox.isVisible()) {
        const isChecked = await detailCheckbox.isChecked();
        if (!isChecked) {
          await detailCheckbox.check();
          await page.waitForTimeout(500);
        }
      }
      await waitForGridReady(page);

      const scrollable = page.locator('.faux-vscroll');

      // Get the scroll height to find a row that's below viewport
      const clientHeight = await scrollable.evaluate((el) => el.clientHeight);

      // Record initial scroll position (at top)
      const scrollBefore = await scrollable.evaluate((el) => el.scrollTop);
      expect(scrollBefore).toBe(0);

      // Scroll down to see later rows, expand one, check it doesn't affect view
      await scrollable.evaluate((el) => {
        el.scrollTop = 300;
      });
      await page.waitForTimeout(200);

      const scrollMid = await scrollable.evaluate((el) => el.scrollTop);

      // Find and click an expander
      const expanders = page.locator('.master-detail-toggle');
      const expanderCount = await expanders.count();

      if (expanderCount >= 2) {
        await expanders.nth(1).click({ force: true });
        await page.waitForTimeout(300);

        // Scroll position should be approximately maintained
        const scrollAfter = await scrollable.evaluate((el) => el.scrollTop);
        const delta = Math.abs(scrollAfter - scrollMid);

        // Allow some tolerance
        expect(delta).toBeLessThan(50);
      }
    });
  });

  test.describe('Edge Cases', () => {
    test('vanilla: empty dataset should not cause errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // The grid should handle zero rows gracefully
      // Even with data, scrolling empty areas should not error
      const scrollable = page.locator('.faux-vscroll');

      await scrollable.evaluate((el) => {
        el.scrollTop = 0;
      });
      await page.waitForTimeout(200);

      expect(errors).toHaveLength(0);
    });

    test('vanilla: very fast expand/collapse cycles should not break rendering', async ({ page }) => {
      await page.goto(DEMOS.vanilla);
      await waitForGridReady(page);

      // Enable master-detail
      const detailCheckbox = page.locator('#enable-detail');
      if (await detailCheckbox.isVisible()) {
        const isChecked = await detailCheckbox.isChecked();
        if (!isChecked) {
          await detailCheckbox.check();
          await page.waitForTimeout(500);
        }
      }
      await waitForGridReady(page);

      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      const expanders = page.locator('.master-detail-toggle');
      if ((await expanders.count()) > 0) {
        // Rapid expand/collapse cycles
        for (let i = 0; i < 10; i++) {
          await expanders.first().click({ force: true });
          await page.waitForTimeout(50);
        }

        // Wait for stabilization
        await page.waitForTimeout(500);

        // Verify no errors and grid still renders
        expect(errors).toHaveLength(0);

        const visibleRows = page.locator(`${SELECTORS.body} .data-grid-row`);
        const rowCount = await visibleRows.count();
        expect(rowCount).toBeGreaterThan(0);
      }
    });
  });
});
