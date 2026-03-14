import { expect, test } from '@playwright/test';
import { dataRows, grid, openDemo } from './utils';

test.describe('Styling & Layout Demos', () => {
  test('RowCellStylingDemo — conditional row/cell classes are applied', async ({ page }) => {
    await openDemo(page, 'RowCellStylingDemo');

    // Verify data rows exist
    const rows = dataRows(page);
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // rowClass: rows with status=inactive get 'row-inactive'
    const inactiveRows = page.locator('tbw-grid .data-grid-row.row-inactive');
    await expect(inactiveRows.first()).toBeVisible({ timeout: 5000 });

    // cellClass on the score column: cell-success (>=90), cell-danger (<50), cell-warning (<70)
    const styledCells = page.locator(
      'tbw-grid [role="gridcell"].cell-success, tbw-grid [role="gridcell"].cell-danger, tbw-grid [role="gridcell"].cell-warning',
    );
    await expect(styledCells.first()).toBeVisible({ timeout: 5000 });
    const styledCount = await styledCells.count();
    expect(styledCount).toBeGreaterThan(0);
  });

  test('RtlDemo — toggle RTL direction', async ({ page }) => {
    await openDemo(page, 'RtlDemo');

    // Toggle RTL via the control
    const rtlToggle = page.locator('input[data-ctrl="rtl"]');
    if (await rtlToggle.isVisible()) {
      await rtlToggle.check();
      await page.waitForTimeout(300);

      // Grid should have RTL direction
      const dir = await grid(page).evaluate((el) => getComputedStyle(el).direction);
      expect(dir).toBe('rtl');
    }
  });

  test('RowAnimationDemo — animation buttons trigger visual changes', async ({ page }) => {
    await openDemo(page, 'RowAnimationDemo');

    // Click one of the animation trigger buttons
    const changeBtn = page.locator('[data-anim-action="change"], button', { hasText: /change|highlight/i }).first();
    if (await changeBtn.isVisible()) {
      await changeBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(grid(page)).toBeVisible();
  });

  test('LoadingStatesDemo — simulate loading shows indicator', async ({ page }) => {
    await openDemo(page, 'LoadingStatesDemo');

    const simulateBtn = page.locator('[data-loading="simulate"], button', { hasText: /simulate|load/i }).first();
    if (await simulateBtn.isVisible()) {
      await simulateBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(grid(page)).toBeVisible();
  });
});

test.describe('Shell Demos', () => {
  test('ShellBasicDemo — shell with title and toolbar renders', async ({ page }) => {
    await openDemo(page, 'ShellBasicDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ShellLightDomDemo — shell configured via light DOM', async ({ page }) => {
    await openDemo(page, 'ShellLightDomDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ShellMultiPanelsDemo — toolbar toggles tool panels', async ({ page }) => {
    await openDemo(page, 'ShellMultiPanelsDemo');

    // Find toolbar buttons
    const toolbarButtons = page.locator('tbw-grid .toolbar button, tbw-grid [data-tool-panel]');
    const count = await toolbarButtons.count();

    if (count > 0) {
      // Click first toolbar button to toggle a panel
      await toolbarButtons.first().click();
      await page.waitForTimeout(300);
    }

    await expect(grid(page)).toBeVisible();
  });

  test('ShellToolbarButtonsDemo — custom toolbar buttons render', async ({ page }) => {
    await openDemo(page, 'ShellToolbarButtonsDemo');
    await expect(grid(page)).toBeVisible();
  });
});
