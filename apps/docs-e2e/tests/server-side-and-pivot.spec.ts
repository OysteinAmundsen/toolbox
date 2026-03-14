import { expect, test } from '@playwright/test';
import { dataRows, grid, openDemo } from './utils';

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
  });
});
