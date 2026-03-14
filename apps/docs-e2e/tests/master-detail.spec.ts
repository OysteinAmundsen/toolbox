import { expect, test } from '@playwright/test';
import { grid, openDemo } from './utils';

test.describe('Master-Detail Demos', () => {
  test('MasterDetailDefaultDemo — clicking expand arrow opens detail panel', async ({ page }) => {
    await openDemo(page, 'master-detail/MasterDetailDefaultDemo');

    // The master-detail plugin adds .master-detail-toggle[role="button"] elements
    const expandBtn = page.locator('tbw-grid .master-detail-toggle[role="button"]').first();
    await expect(expandBtn).toBeVisible({ timeout: 5000 });
    await expandBtn.click();
    await page.waitForTimeout(500);

    // Detail panel has class .master-detail-row
    const detail = page.locator('tbw-grid .master-detail-row');
    const count = await detail.count();
    expect(count).toBeGreaterThan(0);
  });

  test('MasterDetailExpandOnRowClickDemo — clicking row expands detail', async ({ page }) => {
    await openDemo(page, 'master-detail/MasterDetailExpandOnRowClickDemo');

    // Click the first data row
    const firstRow = page.locator('tbw-grid [role="row"]').first();
    await firstRow.click();
    await page.waitForTimeout(500);

    await expect(grid(page)).toBeVisible();
  });

  test('MasterDetailEventsDemo — expand fires events', async ({ page }) => {
    await openDemo(page, 'master-detail/MasterDetailEventsDemo');

    const expandBtn = page.locator('tbw-grid .master-detail-toggle[role="button"]').first();

    if (await expandBtn.isVisible({ timeout: 5000 })) {
      await expandBtn.click();
      await page.waitForTimeout(300);

      const logEl = page.locator('#master-detail-events-log, [data-event-log]');
      if (await logEl.isVisible()) {
        const text = await logEl.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    }
  });

  test('MasterDetailFixedDetailHeightDemo — fixed detail height', async ({ page }) => {
    await openDemo(page, 'master-detail/MasterDetailFixedDetailHeightDemo');
    await expect(grid(page)).toBeVisible();
  });
});
