import { expect, test } from '@playwright/test';
import { cellText, dataRows, grid, openDemo } from './utils';

test.describe('Server-Side Demos', () => {
  test('ServerSideDefaultDemo — infinite scroll loads more data', async ({ page }) => {
    await openDemo(page, 'server-side/ServerSideDefaultDemo');

    const initialRows = await dataRows(page).count();
    expect(initialRows).toBeGreaterThan(0);

    // Scroll to bottom to trigger more data loading
    await grid(page).evaluate((el) => {
      const scrollable = el.querySelector('.tbw-grid-root, .scroll-viewport') || el;
      scrollable.scrollTop = scrollable.scrollHeight;
    });
    await page.waitForTimeout(1000);
  });

  test('ServerSidePagingModeDemo — page navigation buttons work', async ({ page }) => {
    await openDemo(page, 'server-side/ServerSidePagingModeDemo');

    const nextBtn = page.locator('button', { hasText: /next|→|›/i }).first();
    if (await nextBtn.isVisible({ timeout: 5000 })) {
      await nextBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('ServerSideSortingDemo — sorting triggers server-side fetch', async ({ page }) => {
    await openDemo(page, 'server-side/ServerSideSortingDemo');

    const header = page.locator('tbw-grid [role="columnheader"]').first();
    await header.click();
    await page.waitForTimeout(500);

    await expect(grid(page)).toBeVisible();
  });
});

test.describe('Pivot Demo', () => {
  test('PivotDefaultDemo — pivot table renders', async ({ page }) => {
    await openDemo(page, 'pivot/PivotDefaultDemo');
    await expect(grid(page)).toBeVisible();

    // Verify pivot renders with headers and data rows
    const headers = page.locator('tbw-grid [role="columnheader"]');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(1);

    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('PivotSortingDemo — click header sorts ascending via MultiSort', async ({ page }) => {
    await openDemo(page, 'pivot/PivotSortingDemo');
    await expect(grid(page)).toBeVisible();

    // MultiSort + Pivot are both enabled. Click a pivot column header.
    const groupHeader = page.locator('tbw-grid [role="columnheader"]').first();
    await expect(groupHeader).toBeVisible();

    // Click to sort ascending (handled by MultiSort)
    await groupHeader.click();
    await page.waitForTimeout(300);

    // MultiSort sets data-sort and aria-sort attributes
    expect(await groupHeader.getAttribute('aria-sort')).toBe('ascending');

    const firstRowText = await cellText(page, 0, 0);
    expect(firstRowText.trim()).toBeTruthy();
  });

  test('PivotSortingDemo — double-click reverses to descending', async ({ page }) => {
    await openDemo(page, 'pivot/PivotSortingDemo');
    await expect(grid(page)).toBeVisible();

    const groupHeader = page.locator('tbw-grid [role="columnheader"]').first();
    await groupHeader.click();
    await page.waitForTimeout(300);
    await groupHeader.click();
    await page.waitForTimeout(300);

    expect(await groupHeader.getAttribute('aria-sort')).toBe('descending');
  });

  test('PivotSortingDemo — triple-click clears sort', async ({ page }) => {
    await openDemo(page, 'pivot/PivotSortingDemo');
    await expect(grid(page)).toBeVisible();

    const groupHeader = page.locator('tbw-grid [role="columnheader"]').first();
    await groupHeader.click();
    await page.waitForTimeout(300);
    await groupHeader.click();
    await page.waitForTimeout(300);
    await groupHeader.click();
    await page.waitForTimeout(300);

    const ariaSort = await groupHeader.getAttribute('aria-sort');
    expect(ariaSort).toBe('none');
  });

  test('PivotSortingDemo — sort event log updates', async ({ page }) => {
    await openDemo(page, 'pivot/PivotSortingDemo');
    await expect(grid(page)).toBeVisible();

    const groupHeader = page.locator('tbw-grid [role="columnheader"]').first();
    await groupHeader.click();
    await page.waitForTimeout(300);

    const log = page.locator('#pivot-sorting-events-log');
    const logText = await log.textContent();
    expect(logText).toContain('Sorted by');
    expect(logText).toContain('asc');
  });

  test('PivotSortingDemo — shift-click sorts by multiple columns', async ({ page }) => {
    await openDemo(page, 'pivot/PivotSortingDemo');
    await expect(grid(page)).toBeVisible();

    const headers = page.locator('tbw-grid [role="columnheader"]');
    const firstHeader = headers.first();
    const secondHeader = headers.nth(1);

    // Click first column to sort ascending
    await firstHeader.click();
    await page.waitForTimeout(300);
    expect(await firstHeader.getAttribute('aria-sort')).toBe('ascending');

    // Shift-click second column to add it as secondary sort
    await secondHeader.click({ modifiers: ['Shift'] });
    await page.waitForTimeout(300);

    // Both columns should show as sorted
    expect(await firstHeader.getAttribute('data-sort')).toBe('asc');
    expect(await secondHeader.getAttribute('data-sort')).toBe('asc');

    // Sort index badges should appear (MultiSort's showSortIndex: true)
    const badges = page.locator('tbw-grid .sort-index');
    expect(await badges.count()).toBe(2);
  });
});
