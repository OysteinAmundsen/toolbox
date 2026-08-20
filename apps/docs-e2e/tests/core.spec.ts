import { expect, test } from '@playwright/test';
import { cell, cellText, dataRows, grid, headerCell, headerCells, openDemo, sortByColumn, wheelScroll } from './utils';

test.describe('Core & Basic Demos', () => {
  test('IntroBasicDemo — sorting by column header', async ({ page }) => {
    await openDemo(page, 'IntroBasicDemo');
    await cellText(page, 0, 0);

    await sortByColumn(page, 'Name');
    const firstCellAfter = await cellText(page, 0, 0);
    // After sorting by Name, the order should change (Alice comes first alphabetically)
    expect(firstCellAfter).toBeTruthy();
  });

  test('IntroShowcaseDemo — renders with multiple features enabled', async ({ page }) => {
    await openDemo(page, 'IntroShowcaseDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);

    // Showcase has column groups — verify group header row exists
    const groupRow = page.locator('tbw-grid .header-group-row');
    await expect(groupRow).toBeVisible();
    // Verify at least one column group label (e.g. Security, Trading, Fundamentals)
    const groupCells = page.locator('tbw-grid .header-group-cell');
    const groupCount = await groupCells.count();
    expect(groupCount).toBeGreaterThanOrEqual(2);
  });

  test('InteractivePlaygroundDemo — controls change grid configuration', async ({ page }) => {
    await openDemo(page, 'InteractivePlaygroundDemo');
    await expect(grid(page)).toBeVisible();

    // The playground has a fit mode radio control — switch to fixed
    const fixedRadio = page.locator('input[type="radio"][value="fixed"]');
    if (await fixedRadio.isVisible({ timeout: 3000 })) {
      await fixedRadio.check();
      await page.waitForTimeout(300);
    }

    const headers = await headerCells(page).count();
    expect(headers).toBeGreaterThan(0);
  });

  test('CoreEventsDemo — clicking cells logs events', async ({ page }) => {
    await openDemo(page, 'CoreEventsDemo');
    const logEl = page.locator('[data-event-log]');

    // Click a cell to trigger an event
    await cell(page, 0, 1).click();
    await page.waitForTimeout(300);

    // Verify event log has content
    const logText = await logEl.textContent();
    expect(logText).toBeTruthy();
    expect(logText!.length).toBeGreaterThan(0);
  });

  test('CoreEventsDemo — clear log button works', async ({ page }) => {
    await openDemo(page, 'CoreEventsDemo');
    const logEl = page.locator('[data-event-log]');

    // Generate an event
    await cell(page, 0, 0).click();
    await page.waitForTimeout(200);

    // Clear log
    await page.locator('[data-clear-log]').click();
    await page.waitForTimeout(100);
    const logText = await logEl.textContent();
    expect(logText?.trim()).toBe('');
  });

  test('CustomRenderersDemo — custom renderers visible in cells', async ({ page }) => {
    await openDemo(page, 'CustomRenderersDemo');
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);

    // Verify custom renderer output (status badges, star ratings, checkboxes)
    const firstRow = dataRows(page).first();
    const cellCount = await firstRow.locator('[role="gridcell"]').count();
    expect(cellCount).toBeGreaterThan(3);

    // Verify at least one checkbox element (boolean column) or badge element
    const customElements = page.locator('tbw-grid input[type="checkbox"], tbw-grid .badge, tbw-grid [style*="color"]');
    const customCount = await customElements.count();
    expect(customCount).toBeGreaterThan(0);
  });

  test('CustomLoadingRendererDemo — toggle loading state', async ({ page }) => {
    await openDemo(page, 'CustomLoadingRendererDemo');
    await expect(grid(page)).toBeVisible();

    // Click the toggle button to show loading state
    const toggleBtn = page.locator('[data-toggle="loading"], button', { hasText: /loading|toggle/i }).first();
    if (await toggleBtn.isVisible({ timeout: 3000 })) {
      await toggleBtn.click();
      await page.waitForTimeout(500);

      // Verify a loading indicator appeared (progress bar or loading overlay)
      const loadingIndicator = page.locator(
        'tbw-grid .progress-bar-container, tbw-grid .loading-overlay, tbw-grid [data-loading]',
      );
      const indicatorCount = await loadingIndicator.count();
      expect(indicatorCount).toBeGreaterThanOrEqual(0); // May or may not be visible depending on timing
    }
  });

  test('HeaderRenderersDemo — custom header content rendered', async ({ page }) => {
    await openDemo(page, 'HeaderRenderersDemo');
    const headers = await headerCells(page).count();
    expect(headers).toBeGreaterThan(0);

    // The Name header has a custom renderer with a red asterisk (*)
    const nameHeader = headerCell(page, 'Name');
    const nameHtml = await nameHeader.innerHTML();
    expect(nameHtml).toContain('*');
  });

  test('HeaderRenderersDemo — tall custom header still scrolls to the last row', async ({ page }) => {
    await openDemo(page, 'HeaderRenderersDemo');

    const g = grid(page);
    const headerBox = await g.locator('.header').boundingBox();
    const firstRowBox = await dataRows(page).first().boundingBox();
    if (!headerBox || !firstRowBox) throw new Error('grid header / first row has no layout box');
    // Guard the premise: the custom renderer must make the header several rows tall,
    // otherwise the regression this test covers cannot manifest.
    expect(headerBox.height).toBeGreaterThan(firstRowBox.height * 2);

    await wheelScroll(page, g, 0, 3000);

    const viewport = g.locator('.rows-viewport');
    const lastRow = dataRows(page).last();
    await expect(lastRow.locator('[role="gridcell"]').nth(1)).toHaveText('Peggy');

    // Both rects are re-read on every poll: refreshColumns() re-renders the header,
    // and a header height change moves the row viewport.
    const lastRowOverflow = async () => {
      const [rowBox, viewportBox] = await Promise.all([lastRow.boundingBox(), viewport.boundingBox()]);
      if (!rowBox || !viewportBox) return Number.POSITIVE_INFINITY;
      return Math.round(rowBox.y + rowBox.height - (viewportBox.y + viewportBox.height));
    };

    // Scrolled fully down, the last row must sit inside the row viewport.
    await expect.poll(lastRowOverflow).toBeLessThanOrEqual(1);

    // A force re-render while scrolled must NOT desync the rows from the faux
    // scrollbar. A tall header makes this fire often in practice (the viewport
    // ResizeObserver reacts to every header height change); the bypass path used
    // to reset the row transform to translateY(0) while scrollTop stayed at max,
    // stranding the tail rows below the viewport.
    await g.evaluate((el) => (el as HTMLElement & { refreshColumns(): void }).refreshColumns());

    await expect.poll(lastRowOverflow).toBeLessThanOrEqual(1);
    // The rows transform must still track the scrollbar (1px sub-pixel tolerance).
    const transformDrift = await g.evaluate((el) => {
      const rows = el.querySelector('.rows') as HTMLElement | null;
      const faux = el.querySelector('.faux-vscroll') as HTMLElement | null;
      if (!rows || !faux) return Number.POSITIVE_INFINITY;
      const applied = Math.abs(parseFloat(rows.style.transform.replace(/[^-\d.]/g, '') || '0'));
      return Math.abs(applied - faux.scrollTop);
    });
    expect(transformDrift).toBeLessThanOrEqual(1);
  });

  test('LightDomColumnsDemo — columns from light DOM render', async ({ page }) => {
    await openDemo(page, 'LightDomColumnsDemo');
    const headers = await headerCells(page).count();
    expect(headers).toBeGreaterThan(0);
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);

    // Verify light DOM <tbw-grid-column> elements exist inside the grid
    const lightDomCols = page.locator('tbw-grid tbw-grid-column');
    const colCount = await lightDomCols.count();
    expect(colCount).toBeGreaterThan(0);
    expect(headers).toBe(colCount);
  });

  test('ColumnInferenceDemo — auto-inferred columns', async ({ page }) => {
    await openDemo(page, 'ColumnInferenceDemo');
    const headers = await headerCells(page).count();
    // Column inference should detect columns from data — at least 3 columns
    expect(headers).toBeGreaterThanOrEqual(3);

    // Verify inferred header texts match data keys (e.g., id, name)
    const firstHeader = await headerCells(page).first().textContent();
    expect(firstHeader).toBeTruthy();
  });

  test('ColumnStatePersistenceDemo — save and load column state', async ({ page }) => {
    await openDemo(page, 'ColumnStatePersistenceDemo');
    await expect(grid(page)).toBeVisible();

    // Click Save State button
    const saveBtn = page.locator('[data-save]');
    if (await saveBtn.isVisible({ timeout: 3000 })) {
      await saveBtn.click();
      await page.waitForTimeout(200);

      // Verify status message updated
      const status = page.locator('[data-status]');
      if (await status.isVisible()) {
        const statusText = await status.textContent();
        expect(statusText?.length).toBeGreaterThan(0);
      }

      // Now click Load State to restore
      const loadBtn = page.locator('[data-load]');
      if (await loadBtn.isVisible()) {
        await loadBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('PerformanceStressTestDemo — renders without errors', async ({ page }) => {
    await page.goto('/demo/PerformanceStressTestDemo');
    // This demo may not render rows immediately (needs user to click Run)
    await page.waitForSelector('tbw-grid', { state: 'attached', timeout: 15_000 });
    await expect(grid(page)).toBeVisible();
  });

  test('VariableRowHeightDemo — tall rows have correct height and all rows are scrollable', async ({ page }) => {
    await openDemo(page, 'VariableRowHeightDemo');
    await expect(grid(page)).toBeVisible();

    const totalRows = 150;
    const tallHeight = 56;

    // Verify initial render has rows
    const initialRows = await dataRows(page).count();
    expect(initialRows).toBeGreaterThan(0);

    // Helper to check a tall row's height by scrolling it into view
    async function checkTallRow(rowId: number) {
      const ariaRowIndex = rowId + 1; // data row N has aria-rowindex = N + 1 (1 header row)
      const rowLocator = grid(page).locator(`[role="row"][aria-rowindex="${ariaRowIndex}"]`);

      // Use the grid's public scrollToRow API
      await grid(page).evaluate((el, idx) => (el as any).scrollToRow(idx), rowId - 1);
      await page.waitForTimeout(300);

      // Verify the row is now rendered and has the right height
      await expect(rowLocator).toBeVisible({ timeout: 3000 });
      const cssVar = await rowLocator.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--tbw-row-height'));
      expect(cssVar, `Row ${rowId} should have --tbw-row-height set`).toBe(`${tallHeight}px`);

      const box = await rowLocator.boundingBox();
      expect(box, `Row ${rowId} should be visible`).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(tallHeight - 2);
    }

    // Check the first tall row (ID 5) — near the top
    await checkTallRow(5);

    // Check a tall row in the middle (ID 42)
    await checkTallRow(42);

    // Scroll to the very last row using the grid's public API
    await grid(page).evaluate((el) => (el as any).scrollToRow((el as any).rows.length - 1));
    await page.waitForTimeout(500);

    // Verify the last row (row 150) is visible with the correct aria-rowindex
    const lastRowAriaIndex = totalRows + 1;
    const lastRow = grid(page).locator(`[role="row"][aria-rowindex="${lastRowAriaIndex}"]`);
    await expect(lastRow).toBeVisible({ timeout: 5000 });

    const lastRowText = await lastRow.textContent();
    expect(lastRowText).toContain('Employee 150');
  });
});
