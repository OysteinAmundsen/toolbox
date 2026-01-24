import { expect, test } from '@playwright/test';
import { DEMOS, waitForGridReady } from './utils';

/**
 * Debug test to investigate DOM structure differences between demos
 */
test.describe('Debug Header Rendering', () => {
  test('vanilla: check header rendering', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Extra wait for any async rendering
    await page.waitForTimeout(1000);

    // Check the header state
    const grid = page.locator('tbw-grid');
    await expect(grid).toBeVisible();

    // Get header row info
    const headerRow = page.locator('.header-row');
    const childCount = await headerRow.evaluate((el) => el?.children?.length ?? 0);
    console.log(`Vanilla header row child count: ${childCount}`);

    // Get grid info with column fields
    const gridInfo = await page.evaluate(() => {
      const grid = document.querySelector('tbw-grid') as any;
      if (!grid) return { error: 'No grid found' };
      return {
        gridConfigColumnsCount: grid.gridConfig?.columns?.length ?? 0,
        columnsPropertyCount: grid._columns?.length ?? 0,
        visibleColumnsCount: grid._visibleColumns?.length ?? 0,
        columnFields: grid._columns?.map((c: any) => c.field) ?? [],
      };
    });

    console.log('Vanilla grid info:', JSON.stringify(gridInfo, null, 2));

    // Assertion
    expect(childCount, 'Header row should have column cells').toBeGreaterThan(0);
  });

  test('react: check header rendering', async ({ page }) => {
    await page.goto(DEMOS.react);
    await waitForGridReady(page);

    await page.waitForTimeout(1000);

    const headerRow = page.locator('.header-row');
    const childCount = await headerRow.evaluate((el) => el?.children?.length ?? 0);
    console.log(`React header row child count: ${childCount}`);

    // Get grid info with column fields
    const gridInfo = await page.evaluate(() => {
      const grid = document.querySelector('tbw-grid') as any;
      if (!grid) return { error: 'No grid found' };
      return {
        gridConfigColumnsCount: grid.gridConfig?.columns?.length ?? 0,
        columnsPropertyCount: grid._columns?.length ?? 0,
        visibleColumnsCount: grid._visibleColumns?.length ?? 0,
        columnFields: grid._columns?.map((c: any) => c.field) ?? [],
      };
    });
    console.log('React grid info:', JSON.stringify(gridInfo, null, 2));

    expect(childCount, 'Header row should have column cells').toBeGreaterThan(0);
  });

  test('angular: check header rendering', async ({ page }) => {
    await page.goto(DEMOS.angular);
    await waitForGridReady(page);

    await page.waitForTimeout(1000);

    const headerRow = page.locator('.header-row');
    const childCount = await headerRow.evaluate((el) => el?.children?.length ?? 0);
    console.log(`Angular header row child count: ${childCount}`);

    // Get grid info with column fields
    const gridInfo = await page.evaluate(() => {
      const grid = document.querySelector('tbw-grid') as any;
      if (!grid) return { error: 'No grid found' };
      return {
        gridConfigColumnsCount: grid.gridConfig?.columns?.length ?? 0,
        columnsPropertyCount: grid._columns?.length ?? 0,
        visibleColumnsCount: grid._visibleColumns?.length ?? 0,
        columnFields: grid._columns?.map((c: any) => c.field) ?? [],
      };
    });
    console.log('Angular grid info:', JSON.stringify(gridInfo, null, 2));

    expect(childCount, 'Header row should have column cells').toBeGreaterThan(0);
  });
});
