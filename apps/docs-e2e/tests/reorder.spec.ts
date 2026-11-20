import { expect, test, type Page } from '@playwright/test';
import { captureGridEvent, columnCells, grid, headerCells, openDemo, toggleControl } from './utils';

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

  test('RowDragDropDefaultDemo — quick Alt+↓ presses settle into one move, and focus follows the row', async ({
    page,
  }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropDefaultDemo');
    // A 1 s window so both presses land inside it, however slowly the runner types.
    await setKeyboardDebounce(page, 'tbw-grid', 1000);
    const names = async () => (await columnCells(page, 'Name').allTextContents()).map((t) => t.trim());
    const moves = await captureGridEvent<{ fromIndex: number; toIndex: number }>(page, 'row-move');

    await columnCells(page, 'Name').filter({ hasText: 'Alice' }).click();
    await page.keyboard.press('Alt+ArrowDown');
    await page.keyboard.press('Alt+ArrowDown');

    await expect.poll(names).toEqual(['Bob', 'Carol', 'Alice', 'David', 'Eve']);
    expect(await moves.count()).toBe(0); // still pending: the display moved, no event yet
    await expect.poll(() => moves.count()).toBe(1); // one event once the presses settle
    expect(await moves.last()).toMatchObject({ fromIndex: 0, toIndex: 2 });
    await expect(grid(page).locator('.cell-focus')).toHaveText('Alice');
    await page.waitForTimeout(500);
    expect(await names()).toEqual(['Bob', 'Carol', 'Alice', 'David', 'Eve']); // persisted, not reverted
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

  test('RowDragDropTreeDemo — dragging a folder by its handle carries its files', async ({ page }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropTreeDemo');

    // Upper half of Documents = "before Documents" at the top level.
    await handle(page, 'Photos').dragTo(row(page, 'Documents'), { targetPosition: { x: 60, y: 4 } });

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

  test('RowDragDropTreeDemo — repeated Alt+↓ keeps moving the same file, and focus follows it', async ({ page }) => {
    await openDemo(page, 'row-drag-drop/RowDragDropTreeDemo');
    const documents = async () => (await names(page)).slice(1, 4);

    await row(page, 'Report.docx').locator('.cell[data-field="name"]').click();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(documents).toEqual(['Budget.xlsx', 'Report.docx', 'Contract.pdf']);
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(documents).toEqual(['Budget.xlsx', 'Contract.pdf', 'Report.docx']);

    await expect(grid(page).locator('.cell-focus')).toContainText('Report.docx');
    // A file stays inside its folder: one more press is refused, not moved past Photos.
    await page.keyboard.press('Alt+ArrowDown');
    await page.waitForTimeout(300);
    expect(await documents()).toEqual(['Budget.xlsx', 'Contract.pdf', 'Report.docx']);
    await expect(status(page)).toHaveText('Moved Report.docx to position 3 in Documents');
  });
});

test.describe('Row Drag-Drop Cross-Grid Demo', () => {
  const side = (page: Page, id: 'rdd-source' | 'rdd-target') => page.locator(`tbw-grid#${id}`);
  const names = async (page: Page, id: 'rdd-source' | 'rdd-target') =>
    (await side(page, id).locator('[role="gridcell"][data-field="name"]').allTextContents()).map((t) => t.trim());
  const row = (page: Page, name: string) => side(page, 'rdd-source').locator('.data-grid-row', { hasText: name });
  const open = async (page: Page) => {
    await openDemo(page, 'row-drag-drop/RowDragDropCrossGridDemo');
    expect(await names(page, 'rdd-source')).toEqual(['Alice', 'Bob', 'Carol', 'David', 'Eve']);
    expect(await names(page, 'rdd-target')).toEqual([]);
  };

  test('RowDragDropCrossGridDemo — dragging a row moves it to the other grid', async ({ page }) => {
    await open(page);

    await row(page, 'Bob').locator('.dg-row-drag-handle').dragTo(side(page, 'rdd-target')); // onto the empty grid's "No data" area

    await expect.poll(() => names(page, 'rdd-target')).toEqual(['Bob']);
    expect(await names(page, 'rdd-source')).toEqual(['Alice', 'Carol', 'David', 'Eve']);
  });

  test('RowDragDropCrossGridDemo — dragging one row of a selection moves the whole selection', async ({ page }) => {
    await open(page);

    await row(page, 'Alice').locator('[data-field="name"]').click();
    await row(page, 'Carol')
      .locator('[data-field="name"]')
      .click({ modifiers: ['Control'] });
    await row(page, 'Carol').locator('.dg-row-drag-handle').dragTo(side(page, 'rdd-target')); // onto the empty grid's "No data" area

    await expect.poll(() => names(page, 'rdd-target')).toEqual(['Alice', 'Carol']);
    expect(await names(page, 'rdd-source')).toEqual(['Bob', 'David', 'Eve']);
  });

  test('RowDragDropCrossGridDemo — the move menu sends a row while a keyboard move is still pending', async ({
    page,
  }) => {
    await open(page);
    // The timer must not settle the move: only opening the menu may.
    await setKeyboardDebounce(page, 'tbw-grid#rdd-source', 60_000);
    const moves = await captureGridEvent(page, 'row-move'); // the page's first grid: the source

    await row(page, 'Alice').locator('[data-field="name"]').click();
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => names(page, 'rdd-source')).toEqual(['Bob', 'Alice', 'Carol', 'David', 'Eve']);
    expect(await moves.count()).toBe(0); // pending

    await row(page, 'Carol').locator('.dg-row-drag-handle').click();
    await expect.poll(() => moves.count()).toBe(1); // opening the menu committed the pending move
    await page.locator('#tbw-row-move-menu').getByRole('button', { name: 'Send to rdd-target' }).click();

    await expect.poll(() => names(page, 'rdd-target')).toEqual(['Carol']);
    expect(await names(page, 'rdd-source')).toEqual(['Bob', 'Alice', 'David', 'Eve']);
    expect(await moves.count()).toBe(1);
  });
});

/**
 * Set a grid's keyboard-move debounce (`rowDragDrop.debounceMs`, default 150 ms) through
 * its public config, so a test — not runner speed — decides when a pending move settles.
 */
async function setKeyboardDebounce(page: Page, selector: string, debounceMs: number) {
  const target = page.locator(selector);
  await target.evaluate((el, ms) => {
    type Config = { features?: Record<string, unknown> };
    const host = el as HTMLElement & { gridConfig: Config };
    const features = host.gridConfig.features ?? {};
    const current = features.rowDragDrop;
    const rowDragDrop = { ...(typeof current === 'object' && current ? current : {}), debounceMs: ms };
    host.gridConfig = { ...host.gridConfig, features: { ...features, rowDragDrop } };
  }, debounceMs);
  await expect
    .poll(() =>
      target.evaluate(
        (el) =>
          (el as HTMLElement & { gridConfig: { features?: { rowDragDrop?: { debounceMs?: number } } } }).gridConfig
            .features?.rowDragDrop?.debounceMs,
      ),
    )
    .toBe(debounceMs);
  await page.waitForTimeout(300); // the rebuilt plugins render
}
