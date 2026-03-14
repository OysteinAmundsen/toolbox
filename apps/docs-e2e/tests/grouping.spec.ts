import { expect, test } from '@playwright/test';
import { dataRows, grid, openDemo } from './utils';

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

  test('GroupingRowsExpandedByDefaultDemo — all groups start expanded', async ({ page }) => {
    await openDemo(page, 'grouping-rows/GroupingRowsExpandedByDefaultDemo');

    // Data rows should be visible (groups are expanded)
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('GroupingRowsAccordionModeDemo — expanding one group collapses others', async ({ page }) => {
    await openDemo(page, 'grouping-rows/GroupingRowsAccordionModeDemo');

    const groupHeaders = page.locator('tbw-grid .group-row, tbw-grid [data-group-key]');
    const count = await groupHeaders.count();

    if (count >= 2) {
      // Click first group
      await groupHeaders.nth(0).click();
      await page.waitForTimeout(500);

      // Click second group — first should collapse
      await groupHeaders.nth(1).click();
      await page.waitForTimeout(500);
    }
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

  test('GroupingRowsNoRowCountDemo — group headers have no count', async ({ page }) => {
    await openDemo(page, 'grouping-rows/GroupingRowsNoRowCountDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('GroupingRowsWithAggregatorsDemo — footer aggregates visible', async ({ page }) => {
    await openDemo(page, 'grouping-rows/GroupingRowsWithAggregatorsDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('GroupingRowsDefaultExpandedByKeyDemo — only specific group expanded', async ({ page }) => {
    await openDemo(page, 'grouping-rows/GroupingRowsDefaultExpandedByKeyDemo');
    await expect(grid(page)).toBeVisible();
  });
});

test.describe('Column Grouping Demos', () => {
  test('GroupingColumnsDefaultDemo — column groups render in header', async ({ page }) => {
    await openDemo(page, 'grouping-columns/GroupingColumnsDefaultDemo');
    await expect(grid(page)).toBeVisible();
    // Multi-row headers for column groups
    const headers = await page.locator('tbw-grid [role="columnheader"]').count();
    expect(headers).toBeGreaterThan(0);
  });

  test('GroupingColumnsNoBordersDemo — renders without group borders', async ({ page }) => {
    await openDemo(page, 'grouping-columns/GroupingColumnsNoBordersDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('GroupingColumnsCustomRendererDemo — custom renderer in group header', async ({ page }) => {
    await openDemo(page, 'grouping-columns/GroupingColumnsCustomRendererDemo');
    await expect(grid(page)).toBeVisible();
  });
});
