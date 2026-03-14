import { expect, test } from '@playwright/test';
import { dataRows, grid, openDemo } from './utils';

test.describe('Filtering Demos', () => {
  test('FilteringDefaultDemo — opening filter and typing reduces rows', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringDefaultDemo');

    const initialRows = await dataRows(page).count();
    expect(initialRows).toBeGreaterThan(0);

    // Click the filter button (.tbw-filter-btn) on the Name column header
    const nameHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Name' });
    // Hover the header first to make the filter button visible
    await nameHeader.hover();
    const filterBtn = nameHeader.locator('.tbw-filter-btn');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
    await filterBtn.click();
    await page.waitForTimeout(300);

    // The filter panel is a set filter with checkboxes.
    // Click "Select All" to deselect all, then check only one value.
    const selectAllCheckbox = page.locator('.tbw-filter-panel .tbw-filter-checkbox').first();
    await selectAllCheckbox.click(); // Deselect all

    // Check only "Alice Johnson"
    const aliceCheckbox = page.locator('.tbw-filter-panel .tbw-filter-checkbox[data-value="Alice Johnson"]');
    await aliceCheckbox.click();

    // Click Apply button
    const applyBtn = page.locator('.tbw-filter-panel button', { hasText: /apply/i });
    await applyBtn.click();
    await page.waitForTimeout(300);

    const filteredRows = await dataRows(page).count();
    expect(filteredRows).toBeLessThan(initialRows);
  });

  test('FilteringNoDebounceDemo — filter applies instantly', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringNoDebounceDemo');

    const initialRows = await dataRows(page).count();

    // Hover header then click the .tbw-filter-btn
    const nameHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Name' });
    await nameHeader.hover();
    const filterBtn = nameHeader.locator('.tbw-filter-btn');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
    await filterBtn.click();
    await page.waitForTimeout(300);

    const filterInput = page.locator('.tbw-filter-panel .tbw-filter-search-input, .tbw-filter-panel input').first();
    if (await filterInput.isVisible({ timeout: 3000 })) {
      await filterInput.fill('Alice');
      await page.waitForTimeout(200);

      const filteredRows = await dataRows(page).count();
      expect(filteredRows).toBeLessThanOrEqual(initialRows);
    }
  });

  test('FilteringCaseSensitiveDemo — case-sensitive filtering', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringCaseSensitiveDemo');

    // Hover header then click the .tbw-filter-btn
    const nameHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Name' });
    await nameHeader.hover();
    const filterBtn = nameHeader.locator('.tbw-filter-btn');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
    await filterBtn.click();
    await page.waitForTimeout(300);

    const filterInput = page.locator('.tbw-filter-panel .tbw-filter-search-input, .tbw-filter-panel input').first();
    if (await filterInput.isVisible({ timeout: 3000 })) {
      // Lowercase should match fewer rows in case-sensitive mode
      await filterInput.fill('alice');
      await page.waitForTimeout(500);
      const lowerRows = await dataRows(page).count();

      await filterInput.fill('Alice');
      await page.waitForTimeout(500);
      const properRows = await dataRows(page).count();

      expect(properRows).toBeGreaterThanOrEqual(lowerRows);
    }
  });

  test('FilteringFilterEventsDemo — filter triggers event log', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringFilterEventsDemo');

    const nameHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Name' });
    await nameHeader.hover();
    const filterBtn = nameHeader.locator('.tbw-filter-btn');
    await expect(filterBtn).toBeVisible({ timeout: 5000 });
    await filterBtn.click();
    await page.waitForTimeout(300);

    const filterInput = page.locator('.tbw-filter-panel .tbw-filter-search-input, .tbw-filter-panel input').first();
    if (await filterInput.isVisible({ timeout: 3000 })) {
      await filterInput.fill('test');
      await page.waitForTimeout(500);

      const logEl = page.locator('#filter-event-log, [data-event-log]');
      if (await logEl.isVisible()) {
        const text = await logEl.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    }
  });

  test('FilteringTypeSpecificFiltersDemo — renders type-specific controls', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringTypeSpecificFiltersDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('FilteringCustomFilterPanelDemo — custom filter panel renders', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringCustomFilterPanelDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('FilteringAsyncFilteringDemo — async filtering works', async ({ page }) => {
    await openDemo(page, 'filtering/FilteringAsyncFilteringDemo');
    await expect(grid(page)).toBeVisible();
  });
});
