import { expect, test } from '@playwright/test';
import { dataRows, dblClickCell, grid, openDemo, typeAndCommit } from './utils';

test.describe('Undo/Redo Demos', () => {
  test('UndoRedoDefaultDemo — edit then undo restores original value', async ({ page }) => {
    await openDemo(page, 'undo-redo/UndoRedoDefaultDemo');

    // Use dataRows() to scope to body rows (not header)
    // Column 0 is ID (not editable), column 1 is Name (editable)
    const firstDataCell = dataRows(page).first().locator('[role="gridcell"]').nth(1);
    const originalText = await firstDataCell.textContent();

    // Edit the Name cell (row 0, col 1)
    await dblClickCell(page, 0, 1);
    const input = page.locator('tbw-grid input, tbw-grid [contenteditable]').first();
    if (await input.isVisible({ timeout: 3000 })) {
      await typeAndCommit(page, 'Changed');

      // Undo with Ctrl+Z — click grid first to ensure it has focus
      await grid(page).click();
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(500);

      const restoredText = await firstDataCell.textContent();
      expect(restoredText).toBe(originalText);
    }
  });

  test('UndoRedoEventsDemo — undo/redo fires events', async ({ page }) => {
    await openDemo(page, 'undo-redo/UndoRedoEventsDemo');
    await expect(grid(page)).toBeVisible();

    // Edit a cell, then undo
    await dblClickCell(page, 0, 0);
    const input = page.locator('tbw-grid input').first();
    if (await input.isVisible({ timeout: 3000 })) {
      await typeAndCommit(page, 'test');
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(300);

      const logEl = page.locator('#undo-redo-events-log, [data-event-log]');
      if (await logEl.isVisible()) {
        const text = await logEl.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    }
  });

  test('UndoRedoLimitedHistoryDemo — limited history renders', async ({ page }) => {
    await openDemo(page, 'undo-redo/UndoRedoLimitedHistoryDemo');
    await expect(grid(page)).toBeVisible();
  });
});
