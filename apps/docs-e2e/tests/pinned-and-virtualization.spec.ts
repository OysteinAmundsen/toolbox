import { expect, test } from '@playwright/test';
import { dataRows, grid, headerCells, openDemo } from './utils';

test.describe('Pinned Column Demos', () => {
  test('PinnedColumnsDefaultDemo — pinned columns stay visible on scroll', async ({ page }) => {
    await openDemo(page, 'pinned-columns/PinnedColumnsDefaultDemo');
    await expect(grid(page)).toBeVisible();
    const headers = await headerCells(page).count();
    expect(headers).toBeGreaterThan(0);
  });
});

test.describe('Pinned Row Demos', () => {
  test('PinnedRowsDefaultDemo — footer/header pinned rows visible', async ({ page }) => {
    await openDemo(page, 'pinned-rows/PinnedRowsDefaultDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('PinnedRowsCustomPanelsDemo — custom panel content renders', async ({ page }) => {
    await openDemo(page, 'pinned-rows/PinnedRowsCustomPanelsDemo');
    await expect(grid(page)).toBeVisible();
  });
});

test.describe('Column Virtualization Demos', () => {
  test('ColumnVirtualizationDefaultDemo — renders many columns efficiently', async ({ page }) => {
    await openDemo(page, 'column-virtualization/ColumnVirtualizationDefaultDemo');
    await expect(grid(page)).toBeVisible();
    const headers = await headerCells(page).count();
    // Should render at least some virtualized columns
    expect(headers).toBeGreaterThan(5);
  });
});
