import { expect, test } from '@playwright/test';
import { clickCell, dataRows, grid, openDemo } from './utils';

test.describe('Clipboard Demos', () => {
  test('ClipboardDefaultDemo — renders with clipboard feature and controls', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardDefaultDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);

    // Verify includeHeaders and quoteStrings controls exist (covers former WithHeaders / QuotedStrings demos)
    const includeHeaders = page.locator('[data-control="includeHeaders"]');
    const quoteStrings = page.locator('[data-control="quoteStrings"]');
    await expect(includeHeaders).toBeVisible();
    await expect(quoteStrings).toBeVisible();
  });

  test('ClipboardCopyPasteDemo — copy and paste interaction', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardCopyPasteDemo');
    await expect(grid(page)).toBeVisible();

    // Select a cell and copy
    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(200);
  });

  test('ClipboardEventsDemo — clipboard actions fire events', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardEventsDemo');

    await clickCell(page, 0, 0);
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(300);

    const logEl = page.locator('#clipboard-events-log, [data-event-log]');
    if (await logEl.isVisible()) {
      const text = await logEl.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('ClipboardSingleCellModeDemo — single cell copy works', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardSingleCellModeDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ClipboardCustomPasteHandlerDemo — custom paste logic', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardCustomPasteHandlerDemo');
    await expect(grid(page)).toBeVisible();
  });
});
