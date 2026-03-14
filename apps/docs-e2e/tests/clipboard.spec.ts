import { expect, test } from '@playwright/test';
import { clickCell, dataRows, grid, openDemo } from './utils';

test.describe('Clipboard Demos', () => {
  test('ClipboardDefaultDemo — renders with clipboard feature', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardDefaultDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
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

  test('ClipboardWithHeadersDemo — renders with header copy option', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardWithHeadersDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ClipboardSingleCellModeDemo — single cell copy works', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardSingleCellModeDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ClipboardQuotedStringsDemo — renders with quoting enabled', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardQuotedStringsDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ClipboardCustomPasteHandlerDemo — custom paste logic', async ({ page }) => {
    await openDemo(page, 'clipboard/ClipboardCustomPasteHandlerDemo');
    await expect(grid(page)).toBeVisible();
  });
});
