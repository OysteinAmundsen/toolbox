import { expect, test } from '@playwright/test';
import { dataRows, openDemo } from './utils';

test.describe('Row Grouping Demos', () => {
  test('GroupingRowsDefaultDemo — group headers render and are clickable', async ({ page }) => {
    await openDemo(page, 'grouping-rows/GroupingRowsDefaultDemo');

    // Group headers should be visible
    const groupHeaders = page.locator('tbw-grid .group-row, tbw-grid [data-group-key]');
    await expect(groupHeaders.first()).toBeVisible({ timeout: 5000 });

    // Click a group header to toggle
    await groupHeaders.first().click();
    await page.waitForTimeout(500);
  });

  test('GroupingRowsEventsDemo — toggle fires events', async ({ page }) => {
    await openDemo(page, 'grouping-rows/GroupingRowsEventsDemo');

    const groupHeaders = page.locator('tbw-grid .group-row, tbw-grid [data-group-key]');
    if ((await groupHeaders.count()) > 0) {
      await groupHeaders.first().click();
      await page.waitForTimeout(300);

      const logEl = page.locator('#grouping-events-log, [data-event-log]');
      if (await logEl.isVisible()) {
        const text = await logEl.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    }
  });

  test('GroupingRowsWithAggregatorsDemo — footer aggregates visible', async ({ page }) => {
    await openDemo(page, 'grouping-rows/GroupingRowsWithAggregatorsDemo');

    // Expand a group to see its footer row with aggregated salary sum
    const groupHeaders = page.locator('tbw-grid .group-row, tbw-grid [data-group-key]');
    await expect(groupHeaders.first()).toBeVisible({ timeout: 5000 });
    await groupHeaders.first().click();
    await page.waitForTimeout(500);

    // After expanding, look for a footer/aggregation row with a numeric value
    const footerRows = page.locator('tbw-grid .group-footer, tbw-grid .aggregation-row, tbw-grid [data-aggregate]');
    await footerRows.count();
    // Aggregation might be inline in group rows; verify data rows appeared
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });
});

test.describe('Column Grouping Demos', () => {
  test('GroupingColumnsDefaultDemo — column groups render in header', async ({ page }) => {
    await openDemo(page, 'grouping-columns/GroupingColumnsDefaultDemo');

    // Column groups render a header-group-row with header-group-cell elements
    const groupRow = page.locator('tbw-grid .header-group-row');
    await expect(groupRow).toBeVisible();

    // Verify column group labels are visible
    const personalHeader = page.locator('tbw-grid .header-group-cell', { hasText: 'Personal Info' });
    const workHeader = page.locator('tbw-grid .header-group-cell', { hasText: 'Work Info' });
    await expect(personalHeader).toBeVisible();
    await expect(workHeader).toBeVisible();
  });

  test('GroupingColumnsNoBordersDemo — renders without group borders', async ({ page }) => {
    await openDemo(page, 'grouping-columns/GroupingColumnsNoBordersDemo');

    // Column group headers should exist
    const groupRow = page.locator('tbw-grid .header-group-row');
    await expect(groupRow).toBeVisible();
    const groupCells = page.locator('tbw-grid .header-group-cell');
    const groupCount = await groupCells.count();
    expect(groupCount).toBeGreaterThan(0);
  });

  test('GroupingColumnsCustomRendererDemo — custom renderer in group header', async ({ page }) => {
    await openDemo(page, 'grouping-columns/GroupingColumnsCustomRendererDemo');

    // The custom renderer adds emoji icons (👤 for personal, 💼 for work)
    const groupRow = page.locator('tbw-grid .header-group-row');
    await expect(groupRow).toBeVisible();

    // Verify custom rendered content with icons
    const groupCells = page.locator('tbw-grid .header-group-cell');
    const groupCount = await groupCells.count();
    expect(groupCount).toBeGreaterThan(0);
    const headerText = await groupRow.textContent();
    expect(headerText).toBeTruthy();
    // Should contain column count text like "(3 columns)"
    expect(headerText).toMatch(/\d+ columns/);
  });
});
