import { expect, test, type Page } from '@playwright/test';
import { SELECTORS, waitForGridReady } from './utils';

/**
 * E2E coverage for the vanilla **booking-logs** demo.
 *
 * Verifies the demo-specific surface (custom filter panels, side detail
 * panel, container-query timestamp renderer) and the grid-level fixes
 * recently landed for huge datasets:
 *
 * - Issue #326 (PR #327): fractional `scrollTop` mapping for datasets that
 *   exceed the browser's max element-height cap (Chromium ~33.5 M px).
 *   The booking-logs demo has 10 000 000 rows × 34 px = 340 M px of
 *   "real" content — well past the cap. Without the fix, only ~9.87 % of
 *   the dataset is reachable via native scroll; with the fix, scrolling
 *   `.faux-vscroll` to its end and pressing `Ctrl+End` both land on
 *   `aria-rowindex="10000000"`.
 *
 * Vanilla-only by design — framework demos for booking-logs do not exist
 * yet. Parity tests will be added when the React/Vue/Angular ports land.
 *
 * Demo server: `bun run demo` (vanilla on http://localhost:4000).
 */

const BOOKING_LOGS_URL = 'http://localhost:4000/booking-logs';
const DATASET_SIZE = 10_000_000;

/**
 * Open the booking-logs route and wait for the grid + first page of data.
 * The server-side data source streams pages, so we also wait for the
 * pinned footer to leave the loading state before returning.
 */
async function openBookingLogs(page: Page): Promise<void> {
  await page.goto(BOOKING_LOGS_URL);
  await waitForGridReady(page);
  // Footer reads "Loading rows…" until the first page resolves.
  await expect(page.locator('.tbw-pinned-rows')).toContainText('Double-click to inspect', { timeout: 10_000 });
}

/** Open the column filter panel by header text. */
async function openFilterPanel(page: Page, headerText: string) {
  const header = page.locator(`${SELECTORS.headerCell}:has-text("${headerText}")`).first();
  // The filter trigger lives inside the column header.
  await header.locator('.tbw-filter-btn').first().click();
  const panel = page.locator('.tbw-filter-panel');
  await expect(panel).toBeVisible();
  return panel;
}

test.describe('Booking Logs Demo (vanilla)', () => {
  // Deterministic — no retries.
  test.describe.configure({ retries: 0 });

  test.describe('Render & layout', () => {
    test('renders the grid, headers, and dataset-size footer', async ({ page }) => {
      await openBookingLogs(page);

      const grid = page.locator(SELECTORS.grid);
      await expect(grid).toBeVisible();
      // Spot-check a couple of expected headers.
      await expect(grid.locator(`${SELECTORS.headerCell}:has-text("Time")`)).toBeVisible();
      await expect(grid.locator(`${SELECTORS.headerCell}:has-text("Status")`)).toBeVisible();
      await expect(grid.locator(`${SELECTORS.headerCell}:has-text("Trace ID")`)).toBeVisible();

      // Pinned footer should mention the full 10M total.
      await expect(page.locator('.tbw-pinned-rows')).toContainText('10,000,000');
    });
  });

  test.describe('Detail panel', () => {
    test('double-click on a row opens the side detail panel; close button hides it', async ({ page }) => {
      await openBookingLogs(page);

      const detail = page.locator('[data-testid="bl-detail-panel"]');
      await expect(detail).toBeHidden();

      // Activate the first data row by double-clicking any cell.
      const firstCell = page.locator(`${SELECTORS.row} ${SELECTORS.cell}`).first();
      await firstCell.dblclick();

      await expect(detail).toBeVisible();
      // Detail panel renders Request/Response trace blocks.
      await expect(detail.locator('[data-testid="bl-trace-request"]')).toBeVisible();
      await expect(detail.locator('[data-testid="bl-trace-response"]')).toBeVisible();

      await detail.locator('button[data-close]').click();
      await expect(detail).toBeHidden();
    });
  });

  test.describe('Custom filter panels', () => {
    test('Trace ID panel renders the custom single-input form', async ({ page }) => {
      await openBookingLogs(page);
      const panel = await openFilterPanel(page, 'Trace ID');
      // Custom panel marker class.
      await expect(panel.locator('.bl-trace-filter')).toBeVisible();
      // Uniform styling: input adopts the built-in filter classes.
      const input = panel.locator('.bl-trace-filter input.tbw-filter-search-input');
      await expect(input).toBeVisible();
      await expect(panel.locator('.tbw-filter-buttons .tbw-filter-apply-btn')).toBeVisible();
      await expect(panel.locator('.tbw-filter-buttons .tbw-filter-clear-btn')).toBeVisible();
    });

    test('Status panel renders presets + uniform Clear button', async ({ page }) => {
      await openBookingLogs(page);
      const panel = await openFilterPanel(page, 'Status');
      await expect(panel.locator('.bl-status-filter')).toBeVisible();
      // Five preset buttons: 2xx, 3xx, 4xx, 5xx, all errors.
      const presets = panel.locator('.bl-status-presets .bl-status-preset');
      await expect(presets).toHaveCount(5);
      // Specific-code dropdown adopts the built-in filter input class.
      await expect(panel.locator('.bl-status-specific select.tbw-filter-search-input')).toBeVisible();
      await expect(panel.locator('.tbw-filter-buttons .tbw-filter-clear-btn')).toBeVisible();
    });

    test('Time panel renders side-by-side from/to inputs without overflowing', async ({ page }) => {
      await openBookingLogs(page);
      const panel = await openFilterPanel(page, 'Time');
      const filter = panel.locator('.bl-datetime-filter');
      await expect(filter).toBeVisible();
      const inputs = filter.locator('input.tbw-filter-search-input');
      await expect(inputs).toHaveCount(2);

      // Inputs must sit inside the panel — no horizontal overflow.
      const [panelBox, lastInputBox] = await Promise.all([filter.boundingBox(), inputs.last().boundingBox()]);
      expect(panelBox).not.toBeNull();
      expect(lastInputBox).not.toBeNull();
      if (panelBox && lastInputBox) {
        expect(lastInputBox.x + lastInputBox.width).toBeLessThanOrEqual(panelBox.x + panelBox.width + 1);
      }
    });
  });

  test.describe('Timestamp container-query renderer', () => {
    test('hides the date when the column is narrow and reveals it when widened', async ({ page }) => {
      await openBookingLogs(page);

      const firstTimestampCell = page.locator(`${SELECTORS.row} ${SELECTORS.cell} .bl-timestamp`).first();
      await expect(firstTimestampCell).toBeVisible();

      // Default column width ≈ 110px → date span hidden by the container query.
      const dateSpan = firstTimestampCell.locator('.bl-timestamp-date');
      await expect(dateSpan).toBeHidden();

      // Widen the column above the 170px breakpoint by setting an inline width
      // on every Time-column cell + header. Avoids depending on the resize-handle
      // drag (which is timing-sensitive in headless browsers).
      await page.evaluate(() => {
        // Time is the first data column.
        document.querySelectorAll('tbw-grid [role="columnheader"]').forEach((h, i) => {
          if (i === 0) (h as HTMLElement).style.width = '260px';
        });
        document.querySelectorAll('tbw-grid [role="row"]').forEach((row) => {
          const cells = row.querySelectorAll('[role="gridcell"]');
          if (cells[0]) (cells[0] as HTMLElement).style.width = '260px';
        });
      });

      await expect(dateSpan).toBeVisible({ timeout: 2_000 });
      await expect(dateSpan).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  test.describe('Huge-dataset scroll mapping (issue #326)', () => {
    test('scrolling the faux scrollbar to the end reaches aria-rowindex 10,000,000', async ({ page }) => {
      await openBookingLogs(page);

      // Drive the faux scrollbar to the bottom and wait for the last page to load.
      // The fractional scroll mapping (PR #327) translates the clamped
      // `scrollTop` into a virtual offset spanning the full 10M-row range,
      // so this MUST resolve to the absolute last row.
      await page.evaluate(() => {
        const grid = document.querySelector('tbw-grid');
        const scroller = grid?.querySelector('.faux-vscroll') as HTMLElement | null;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });

      // Allow async page fetches + render.
      await page.waitForTimeout(800);
      // Nudge again in case the first jump triggered loads that grew scrollHeight.
      await page.evaluate(() => {
        const scroller = document.querySelector('tbw-grid .faux-vscroll') as HTMLElement | null;
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
      });
      await page.waitForTimeout(800);

      const lastIndex = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbw-grid [role="row"][aria-rowindex]');
        let max = 0;
        rows.forEach((r) => {
          const n = Number(r.getAttribute('aria-rowindex'));
          if (n > max) max = n;
        });
        return max;
      });

      // `aria-rowindex` is 1-based. Last row of a 10M dataset is index 10000000.
      // Allow a tiny margin in case the very last row is just below the
      // viewport and not yet rendered (overscan placement).
      expect(lastIndex).toBeGreaterThanOrEqual(DATASET_SIZE - 5);
    });

    test('Ctrl+End focuses the last row of the dataset', async ({ page }) => {
      await openBookingLogs(page);

      // Focus the grid by clicking the first cell, then press Ctrl+End.
      // `ensureCellVisible` (keyboard.ts) translates the target row offset
      // through `fromVirtualScrollTop` so the scroll lands inside the
      // clamped spacer space, then renders the last row.
      const firstCell = page.locator(`${SELECTORS.row} ${SELECTORS.cell}`).first();
      await firstCell.click();
      await page.keyboard.press('Control+End');

      // Wait for the scroll + page fetch + render.
      await page.waitForTimeout(1_500);

      const focusedRowIndex = await page.evaluate(() => {
        // Cell focus is virtual: the grid keeps it in `_focusRow` (0-based)
        // and only paints a tabindex on the rendered cell. Read the
        // canonical state straight off the custom element so we don't depend
        // on the focused row being currently rendered in the viewport.
        const grid = document.querySelector('tbw-grid') as (HTMLElement & { _focusRow?: number }) | null;
        // `_focusRow` is 0-based; `aria-rowindex` is 1-based.
        return grid && typeof grid._focusRow === 'number' ? grid._focusRow + 1 : 0;
      });

      // Same tolerance as above — Ctrl+End may land on a row very close to
      // the last but the assertion is "we got past the old ~986k cap".
      expect(focusedRowIndex).toBeGreaterThan(1_000_000);
      expect(focusedRowIndex).toBeGreaterThanOrEqual(DATASET_SIZE - 5);
    });
  });
});
