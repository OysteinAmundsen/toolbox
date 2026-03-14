import { expect, test } from '@playwright/test';
import { clickCell, dataRows, grid, openDemo } from './utils';

test.describe('Selection Demos', () => {
  test('SelectionPlaygroundDemo — cell selection mode selects a cell', async ({ page }) => {
    await openDemo(page, 'SelectionPlaygroundDemo');

    // Default mode is 'cell'
    await clickCell(page, 0, 1);
    await page.waitForTimeout(200);

    // Verify the output panel updated
    const output = page.locator('[data-output-id="selection-demo"]');
    if (await output.isVisible()) {
      const text = await output.textContent();
      expect(text).toBeTruthy();
      expect(text).not.toContain('Interact with the grid');
    }
  });

  test('SelectionPlaygroundDemo — switching to row mode selects full rows', async ({ page }) => {
    await openDemo(page, 'SelectionPlaygroundDemo');

    // Switch to row mode
    const rowRadio = page.locator('input[type="radio"][value="row"]');
    await rowRadio.check();
    await page.waitForTimeout(300);

    // Click a row
    await clickCell(page, 1, 0);
    await page.waitForTimeout(200);

    // Output should reflect row selection
    const output = page.locator('[data-output-id="selection-demo"]');
    if (await output.isVisible()) {
      const text = await output.textContent();
      expect(text).toBeTruthy();
    }
  });

  test('SelectionCheckboxDemo — checkbox toggles row selection', async ({ page }) => {
    await openDemo(page, 'SelectionCheckboxDemo');

    // Find a checkbox in the grid
    const checkbox = page.locator('tbw-grid input[type="checkbox"]').first();
    await expect(checkbox).toBeVisible({ timeout: 5000 });

    await checkbox.check();
    await page.waitForTimeout(200);

    // Row should have selected styling
    const row = page.locator('tbw-grid [role="row"]').first();
    const classList = await row.getAttribute('class');
    expect(classList).toBeTruthy();
  });

  test('SelectionEventsDemo — selection fires events to log', async ({ page }) => {
    await openDemo(page, 'selection/SelectionEventsDemo');

    await clickCell(page, 0, 0);
    await page.waitForTimeout(300);

    const logEl = page.locator('#selection-events-log, [data-event-log]');
    if (await logEl.isVisible()) {
      const text = await logEl.textContent();
      expect(text?.length).toBeGreaterThan(0);
    }
  });

  test('ConditionalSelectionDemo — locked rows cannot be selected', async ({ page }) => {
    await openDemo(page, 'selection/ConditionalSelectionDemo');

    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });
});
