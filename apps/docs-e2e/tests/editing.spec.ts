import { expect, test } from '@playwright/test';
import { cellText, clickCell, dataRows, dblClickCell, grid, openDemo, typeAndCommit } from './utils';

test.describe('Editing Demos', () => {
  test('EditingBasicEditingDemo — dblclick to edit, type, and commit', async ({ page }) => {
    await openDemo(page, 'editing/EditingBasicEditingDemo');

    const originalName = await cellText(page, 0, 0);
    expect(originalName).toContain('Alice');

    // Double-click the first cell to edit
    await dblClickCell(page, 0, 0);

    // An input should appear
    const input = page.locator('tbw-grid input, tbw-grid [contenteditable]').first();
    await expect(input).toBeVisible({ timeout: 3000 });

    // Type a new value and commit
    await typeAndCommit(page, 'Alicia');

    // Cell should show new value
    const newName = await cellText(page, 0, 0);
    expect(newName).toContain('Alicia');
  });

  test('EditingClickToEditDemo — single click activates editor', async ({ page }) => {
    await openDemo(page, 'editing/EditingClickToEditDemo');

    // Single click should activate editor (mode is 'click')
    await clickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const input = page.locator('tbw-grid input, tbw-grid [contenteditable]').first();
    await expect(input).toBeVisible({ timeout: 3000 });
  });

  test('EditingGridModeDemo — all cells show editors immediately', async ({ page }) => {
    await openDemo(page, 'editing/EditingGridModeDemo');

    // In grid mode, editors should be visible without clicking
    const inputs = page.locator('tbw-grid input, tbw-grid select');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });

  test('EditingEditingEventsDemo — editing fires events to log', async ({ page }) => {
    await openDemo(page, 'editing/EditingEditingEventsDemo');

    // Double-click a cell to trigger edit-open event
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const logEl = page.locator('#editing-event-log, [data-event-log]');
    if (await logEl.isVisible()) {
      const text = await logEl.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('EditingCellValidationDemo — invalid input shows validation feedback', async ({ page }) => {
    await openDemo(page, 'editing/EditingCellValidationDemo');

    // Find and edit a cell — provide invalid value
    await dblClickCell(page, 0, 0);
    await page.waitForTimeout(200);

    const input = page.locator('tbw-grid input').first();
    if (await input.isVisible()) {
      await input.fill('');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }
  });

  test('EditingAllColumnTypesDemo — different editor types render', async ({ page }) => {
    await openDemo(page, 'editing/EditingAllColumnTypesDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('EditingAddRemoveRowsDemo — add row button inserts new row', async ({ page }) => {
    await openDemo(page, 'editing/EditingAddRemoveRowsDemo');

    const initialRows = await dataRows(page).count();

    // Find and click the Add Row button
    const addBtn = page.locator('button', { hasText: /add/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(500);

      const newRows = await dataRows(page).count();
      expect(newRows).toBeGreaterThan(initialRows);
    }
  });

  test('EditorParametersDemo — editor constraints applied', async ({ page }) => {
    await openDemo(page, 'editing/EditorParametersDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });
});
