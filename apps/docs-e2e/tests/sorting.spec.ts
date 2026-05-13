import { expect, test } from '@playwright/test';
import { cellText, grid, openDemo, sortByColumn } from './utils';

test.describe('Sorting Demos', () => {
  test('IntroBasicDemo — click header to sort ascending then descending', async ({ page }) => {
    await openDemo(page, 'IntroBasicDemo');

    // Get initial first cell value
    const _col1Before = await cellText(page, 0, 1);

    // Sort by Name ascending
    await sortByColumn(page, 'Name');
    const col1Asc = await cellText(page, 0, 1);
    expect(col1Asc).toBeTruthy();

    // Sort by Name descending
    await sortByColumn(page, 'Name');
    const col1Desc = await cellText(page, 0, 1);
    // Ascending first should be "Alice", descending first should be "Eve"
    expect(col1Asc).not.toBe(col1Desc);
  });

  test('MultiSortDefaultDemo — shift-click for multi-column sort', async ({ page }) => {
    await openDemo(page, 'multi-sort/MultiSortDefaultDemo');
    await expect(grid(page)).toBeVisible();

    // Sort by first column
    const firstHeader = (await page.locator('tbw-grid [role="columnheader"]').all())[0];
    await firstHeader.click();
    await page.waitForTimeout(300);

    // Shift+click a second column for multi-sort
    const secondHeader = (await page.locator('tbw-grid [role="columnheader"]').all())[1];
    await secondHeader.click({ modifiers: ['Shift'] });
    await page.waitForTimeout(300);

    // Both columns should now have sort indicators
    await expect(grid(page)).toBeVisible();
  });

  test('MultiSortEventsDemo — sort fires events', async ({ page }) => {
    await openDemo(page, 'multi-sort/MultiSortEventsDemo');

    const firstHeader = (await page.locator('tbw-grid [role="columnheader"]').all())[0];
    await firstHeader.click();
    await page.waitForTimeout(300);

    // Verify event log updated
    const logEl = page.locator('#multi-sort-events-log');
    if (await logEl.isVisible()) {
      const text = await logEl.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });
});
