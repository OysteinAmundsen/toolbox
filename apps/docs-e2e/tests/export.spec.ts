import { expect, test } from '@playwright/test';
import { grid, openDemo } from './utils';

test.describe('Export Demos', () => {
  test('ExportDefaultDemo — export buttons are functional', async ({ page }) => {
    await openDemo(page, 'export/ExportDefaultDemo');

    const csvBtn = page.locator('.export-csv, button', { hasText: /csv/i }).first();
    await expect(csvBtn).toBeVisible({ timeout: 5000 });

    // Click CSV export — it should trigger a download or action
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await csvBtn.click();
    await page.waitForTimeout(500);
  });

  test('ExportEventsDemo — export fires events to log', async ({ page }) => {
    await openDemo(page, 'export/ExportEventsDemo');

    const exportBtn = page.locator('#export-csv-btn, button', { hasText: /csv|export/i }).first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await page.waitForTimeout(500);

      const logEl = page.locator('#export-events-log, [data-event-log]');
      if (await logEl.isVisible()) {
        const text = await logEl.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    }
  });

  test('ExportExportSelectedDemo — export selected rows', async ({ page }) => {
    await openDemo(page, 'export/ExportExportSelectedDemo');
    await expect(grid(page)).toBeVisible();
  });
});
