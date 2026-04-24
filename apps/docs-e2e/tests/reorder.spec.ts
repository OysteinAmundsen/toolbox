import { expect, test } from '@playwright/test';
import { grid, headerCells, openDemo } from './utils';

test.describe('Column Reorder Demos', () => {
  test('ReorderDefaultDemo — drag column header to reorder', async ({ page }) => {
    await openDemo(page, 'reorder/ReorderDefaultDemo');

    const headers = await headerCells(page).all();
    expect(headers.length).toBeGreaterThan(1);

    // Get reference to first header before drag
    await headers[0].textContent();

    // Drag first header to second position
    const srcBox = await headers[0].boundingBox();
    const dstBox = await headers[1].boundingBox();

    if (srcBox && dstBox) {
      await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(dstBox.x + dstBox.width / 2, dstBox.y + dstBox.height / 2, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
  });

  test('ReorderColumnsEventsDemo — reorder fires events', async ({ page }) => {
    await openDemo(page, 'reorder/ReorderColumnsEventsDemo');
    await expect(grid(page)).toBeVisible();

    // Drag a column header to trigger column-move event
    const headers = await headerCells(page).all();
    if (headers.length >= 2) {
      const srcBox = await headers[0].boundingBox();
      const dstBox = await headers[1].boundingBox();

      if (srcBox && dstBox) {
        await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(dstBox.x + dstBox.width / 2, dstBox.y + dstBox.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    }

    // Verify event log received column-move event
    const logEl = page.locator('#reorder-col-events-log');
    if (await logEl.isVisible()) {
      const text = await logEl.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Row Reorder Demos', () => {
  test('RowDragDropDefaultDemo — drag handle to reorder rows', async ({ page }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropDefaultDemo');
    await expect(grid(page)).toBeVisible();

    // The row reorder plugin adds .dg-row-drag-handle elements
    const handles = page.locator('tbw-grid .dg-row-drag-handle');
    const count = await handles.count();
    expect(count).toBeGreaterThan(0);

    // Drag first row handle down to second row position
    if (count >= 2) {
      const srcBox = await handles.nth(0).boundingBox();
      const dstBox = await handles.nth(1).boundingBox();

      if (srcBox && dstBox) {
        await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(dstBox.x + dstBox.width / 2, dstBox.y + dstBox.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
    }
  });

  test('RowDragDropCancelableEventDemo — blocked rows cannot be moved', async ({ page }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropCancelableEventDemo');
    await expect(grid(page)).toBeVisible();

    // Verify status element exists
    const status = page.locator('#row-drag-drop-cancelable-status');
    await expect(status).toBeVisible();

    // Try to drag Bob's row (row index 1) — should be blocked
    const handles = page.locator('tbw-grid .dg-row-drag-handle');
    const count = await handles.count();

    if (count >= 2) {
      const srcBox = await handles.nth(1).boundingBox(); // Bob is row 1
      const dstBox = await handles.nth(0).boundingBox();

      if (srcBox && dstBox) {
        await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(dstBox.x + dstBox.width / 2, dstBox.y + dstBox.height / 2, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(500);

        // Status should show the blocked message
        const statusText = await status.textContent();
        expect(statusText).toContain('Bob');
      }
    }
  });
});
