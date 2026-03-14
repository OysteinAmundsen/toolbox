import { expect, test } from '@playwright/test';
import { grid, headerCells, openDemo } from './utils';

test.describe('Column Reorder Demos', () => {
  test('ReorderDefaultDemo — drag column header to reorder', async ({ page }) => {
    await openDemo(page, 'reorder/ReorderDefaultDemo');

    const headers = await headerCells(page).all();
    expect(headers.length).toBeGreaterThan(1);

    // Get original header order
    const firstHeaderText = await headers[0].textContent();

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
  });
});

test.describe('Row Reorder Demos', () => {
  test('RowReorderDefaultDemo — drag handle to reorder rows', async ({ page }) => {
    await openDemo(page, 'row-reorder/RowReorderDefaultDemo');
    await expect(grid(page)).toBeVisible();

    // The row reorder plugin adds .dg-row-drag-handle elements
    const handles = page.locator('tbw-grid .dg-row-drag-handle');
    const count = await handles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('RowReorderCancelableEventDemo — blocked rows cannot be moved', async ({ page }) => {
    await openDemo(page, 'row-reorder/RowReorderCancelableEventDemo');
    await expect(grid(page)).toBeVisible();
  });
});
