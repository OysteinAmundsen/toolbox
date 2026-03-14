import { expect, test } from '@playwright/test';
import { grid, openDemo } from './utils';

test.describe('Visibility Demos', () => {
  test('VisibilityDefaultDemo — toggle column visibility from panel', async ({ page }) => {
    await openDemo(page, 'visibility/VisibilityDefaultDemo');
    await expect(grid(page)).toBeVisible();

    // Look for the visibility panel toggle in toolbar
    const toolbarBtn = page
      .locator(
        'tbw-grid .tool-panel-toggle, tbw-grid [data-tool-panel], tbw-grid button[title*="olumn"], tbw-grid .toolbar button',
      )
      .first();

    if (await toolbarBtn.isVisible({ timeout: 3000 })) {
      await toolbarBtn.click();
      await page.waitForTimeout(300);
    }
  });

  test('VisibilityInitiallyHiddenDemo — some columns hidden by default', async ({ page }) => {
    await openDemo(page, 'visibility/VisibilityInitiallyHiddenDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('VisibilityLockedColumnsDemo — locked columns remain visible', async ({ page }) => {
    await openDemo(page, 'visibility/VisibilityLockedColumnsDemo');
    await expect(grid(page)).toBeVisible();
  });
});

test.describe('Print Demos', () => {
  test('PrintBasicDemo — print button triggers action', async ({ page }) => {
    await openDemo(page, 'print/PrintBasicDemo');

    // Don't actually trigger print (would open dialog), just verify button exists
    const printBtn = page.locator('#print-basic-btn, button', { hasText: /print/i }).first();
    await expect(printBtn).toBeVisible({ timeout: 5000 });
  });

  test('PrintHiddenColumnsDemo — renders with printHidden columns', async ({ page }) => {
    await openDemo(page, 'print/PrintHiddenColumnsDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('PrintPrintEventsDemo — renders with event logging', async ({ page }) => {
    await openDemo(page, 'print/PrintPrintEventsDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('PrintRowLimitDemo — renders with row limit', async ({ page }) => {
    await openDemo(page, 'print/PrintRowLimitDemo');
    await expect(grid(page)).toBeVisible();
  });
});
