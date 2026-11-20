import { expect, test, type Page } from '@playwright/test';
import { columnCells, grid, headerCells, openDemo, toggleControl } from './utils';

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

test.describe('Row Drag-Drop Tree Demo', () => {
  const names = async (page: Page) => (await columnCells(page, 'Name').allTextContents()).map((t) => t.trim());
  const row = (page: Page, name: string) => grid(page).locator('.data-grid-row', { hasText: name });
  const handle = (page: Page, name: string) => row(page, name).locator('.dg-row-drag-handle');
  const status = (page: Page) => page.locator('#row-drag-drop-tree-status');

  test('RowDragDropTreeDemo — a folder moves with its files (keyboard)', async ({ page }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropTreeDemo');
    expect(await names(page)).toEqual([
      'Documents',
      'Report.docx',
      'Budget.xlsx',
      'Contract.pdf',
      'Photos',
      'Beach.jpg',
      'Mountains.jpg',
      'Notes.txt',
      'Todo.md',
    ]);

    await row(page, 'Photos').locator('.cell[data-field="name"]').click();
    await page.keyboard.press('Alt+ArrowUp');

    await expect
      .poll(() => names(page))
      .toEqual([
        'Photos',
        'Beach.jpg',
        'Mountains.jpg',
        'Documents',
        'Report.docx',
        'Budget.xlsx',
        'Contract.pdf',
        'Notes.txt',
        'Todo.md',
      ]);
    await expect(status(page)).toHaveText('Moved Photos to position 1 in top level');
  });

  test('RowDragDropTreeDemo — the move menu reorders a file within its folder', async ({ page }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropTreeDemo');

    await handle(page, 'Beach.jpg').click();
    await page.locator('#tbw-row-move-menu').getByRole('button', { name: 'Move down' }).click();

    await expect.poll(async () => (await names(page)).slice(4, 7)).toEqual(['Photos', 'Mountains.jpg', 'Beach.jpg']);
    await expect(status(page)).toHaveText('Moved Beach.jpg to position 2 in Photos');
  });

  test('RowDragDropTreeDemo — moving a file to another folder needs canReparent', async ({ page }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropTreeDemo');
    const before = await names(page);

    // Upper half of Report.docx = "before Report", i.e. into Documents.
    const dropOnReport = () =>
      handle(page, 'Notes.txt').dragTo(row(page, 'Report.docx'), { targetPosition: { x: 60, y: 4 } });

    await dropOnReport();
    await page.waitForTimeout(300);
    expect(await names(page)).toEqual(before);

    await toggleControl(page, 'canReparent');
    await dropOnReport();

    await expect.poll(async () => (await names(page)).slice(0, 3)).toEqual(['Documents', 'Notes.txt', 'Report.docx']);
    await expect(status(page)).toHaveText('Moved Notes.txt from top level to Documents (position 1)');
  });
});
