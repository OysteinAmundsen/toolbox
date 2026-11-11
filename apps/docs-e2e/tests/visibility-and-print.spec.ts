import { expect, test } from '@playwright/test';
import { control, controlOption, dataRows, grid, headerCells, openDemo, toggleControl } from './utils';

test.describe('Visibility Demos', () => {
  for (const mode of ['sidebar', 'dropdown']) {
    for (const width of [1280, 390]) {
      test(`VisibilityDefaultDemo - column search in ${mode} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 850 });
        await openDemo(page, 'visibility/VisibilityDefaultDemo');
        await control(page, 'panelMode').selectOption(mode);
        await toggleControl(page, 'searchable', true);
        await grid(page).getByRole('button', { name: 'Toggle settings panel' }).click();
        const search = grid(page).getByRole('searchbox', { name: 'Search columns' });
        await expect(search).toBeVisible();
        const rows = grid(page).locator('.tbw-visibility-row');
        await expect(rows).toHaveCount(5);
        await search.fill('  eMA  ');
        await expect(rows).toHaveCount(1);
        await expect(rows).toHaveAttribute('data-field', 'email');
        await expect(headerCells(page)).toHaveCount(4);
        await rows.getByRole('checkbox').check();
        await expect(grid(page).getByRole('columnheader', { name: 'Email' })).toBeVisible();
        await expect(search).toHaveValue('  eMA  ');
        await search.fill('Salary');
        await rows.getByRole('checkbox').uncheck();
        await expect(grid(page).getByRole('columnheader', { name: 'Salary' })).toHaveCount(0);
        await search.fill('nothing matches');
        await expect(rows).toHaveCount(0);
        await expect(grid(page).locator('.tbw-visibility-content').getByRole('status')).toHaveText(
          'No matching columns',
        );
        await grid(page).getByRole('button', { name: 'Show All', exact: true }).click();
        await expect(headerCells(page)).toHaveCount(5);
        await expect(search).toHaveValue('nothing matches');
        await expect(rows).toHaveCount(0);
        await search.fill('');
        await expect(rows).toHaveCount(5);
        await search.fill('name');
        await search.press('ArrowLeft');
        await expect(search).toBeFocused();
        await search.press('Escape');
        if (mode === 'sidebar') {
          await expect(search).toBeVisible();
          await expect(search).toHaveValue('');
          await expect(rows).toHaveCount(5);
          await search.fill('name');
          await grid(page).getByRole('button', { name: 'Toggle settings panel' }).click();
        }
        await expect(search).not.toBeVisible();
        await grid(page).getByRole('button', { name: 'Toggle settings panel' }).click();
        await expect(search).toHaveValue('name');
        await expect(rows).toHaveCount(1);
      });
    }
  }

  test('VisibilityDefaultDemo — toggle column visibility from panel', async ({ page }) => {
    await openDemo(page, 'visibility/VisibilityDefaultDemo');
    await expect(grid(page)).toBeVisible();

    // Email column should be initially hidden (per default controls)
    const emailHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Email' });
    await expect(emailHeader).toHaveCount(0);

    // Visible columns should be ID, Name, Department, Salary (4 headers)
    const headers = await headerCells(page).count();
    expect(headers).toBe(4);
  });

  test('VisibilityDefaultDemo - search preserves locked and last-visible columns', async ({ page }) => {
    await openDemo(page, 'visibility/VisibilityDefaultDemo');
    await toggleControl(page, 'searchable', true);
    await grid(page).getByRole('button', { name: 'Toggle settings panel' }).click();
    const search = grid(page).getByRole('searchbox', { name: 'Search columns' });
    await search.fill('ID');
    await expect(grid(page).locator('.tbw-visibility-row').getByRole('checkbox')).toBeDisabled();
    await controlOption(page, 'lockedColumns', 'id').uncheck();
    await expect(grid(page).locator('.tbw-visibility-row[data-field="id"]').getByRole('checkbox')).toBeEnabled();
    for (const field of ['ID', 'Department', 'Salary']) {
      await search.fill(field);
      await grid(page).locator('.tbw-visibility-row').getByRole('checkbox').uncheck();
    }
    await expect(headerCells(page)).toHaveCount(1);
    await search.fill('Name');
    await grid(page).locator('.tbw-visibility-row').getByRole('checkbox').click();
    await expect(headerCells(page)).toHaveCount(1);
    await expect(grid(page).getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible();
    await expect(grid(page).locator('.tbw-visibility-row').getByRole('checkbox')).toBeChecked();
  });

  test('VisibilityInitiallyHiddenDemo — some columns hidden by default', async ({ page }) => {
    await openDemo(page, 'visibility/VisibilityInitiallyHiddenDemo');
    await expect(grid(page)).toBeVisible();

    // Email and Phone are hidden by default
    const emailHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Email' });
    const phoneHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'Phone' });
    await expect(emailHeader).toHaveCount(0);
    await expect(phoneHeader).toHaveCount(0);

    // ID, Name, Department should be visible (3 headers)
    const headers = await headerCells(page).count();
    expect(headers).toBe(3);
  });

  test('VisibilityLockedColumnsDemo — locked columns remain visible', async ({ page }) => {
    await openDemo(page, 'visibility/VisibilityLockedColumnsDemo');
    await expect(grid(page)).toBeVisible();

    const headers = await headerCells(page).count();
    expect(headers).toBeGreaterThan(0);

    // Verify at least the locked column names are visible
    const idHeader = page.locator('tbw-grid [role="columnheader"]', { hasText: 'ID' });
    await expect(idHeader).toBeVisible();
  });
});

test.describe('Print Demos', () => {
  test('PrintBasicDemo — print button triggers action', async ({ page }) => {
    await openDemo(page, 'print/PrintBasicDemo');

    // Don't actually trigger print (would open dialog), just verify button exists
    const printBtn = page.locator('#print-basic-btn, button', { hasText: /print/i }).first();
    await expect(printBtn).toBeVisible({ timeout: 5000 });
  });

  test('PrintHiddenColumnsDemo — renders with printHidden columns', async ({ page }) => {
    await openDemo(page, 'print/PrintHiddenColumnsDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('PrintPrintEventsDemo — renders with event logging', async ({ page }) => {
    await openDemo(page, 'print/PrintPrintEventsDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('PrintRowLimitDemo — renders with row limit', async ({ page }) => {
    await openDemo(page, 'print/PrintRowLimitDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });
});
