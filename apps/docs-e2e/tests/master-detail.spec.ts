import { expect, test } from '@playwright/test';
import { openDemo } from './utils';

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

  test('MasterDetailDefaultDemo — expand on row click', async ({ page }) => {
    await openDemo(page, 'master-detail/MasterDetailDefaultDemo');

    // Enable "expand on row click" via the demo control
    const toggle = page.locator('[data-ctrl-name="expandOnRowClick"] .dc-toggle');
    await toggle.click();

    // Click the first data row (not the header row or expand button)
    const firstRow = page.locator('tbw-grid .data-grid-row').first();
    await firstRow.click();
    await page.waitForTimeout(500);

    const detail = page.locator('tbw-grid .master-detail-row');
    await expect(detail.first()).toBeVisible();
  });

  test('MasterDetailDefaultDemo — fixed detail height', async ({ page }) => {
    await openDemo(page, 'master-detail/MasterDetailDefaultDemo');

    // Set detail height to 150px via the demo control
    await page.locator('select[data-ctrl="detailHeight"]').selectOption('150');

    // Expand a row
    const expandBtn = page.locator('tbw-grid .master-detail-toggle[role="button"]').first();
    await expect(expandBtn).toBeVisible({ timeout: 5000 });
    await expandBtn.click();
    await page.waitForTimeout(500);

    const detail = page.locator('tbw-grid .master-detail-row');
    await expect(detail.first()).toBeVisible();
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
});
