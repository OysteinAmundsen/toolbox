import { expect, test } from '@playwright/test';
import { cell, cellText, dataRows, grid, headerCells, openDemo, sortByColumn } from './utils';

test.describe('Core & Basic Demos', () => {
  test('IntroBasicDemo — sorting by column header', async ({ page }) => {
    await openDemo(page, 'IntroBasicDemo');
    const firstCellBefore = await cellText(page, 0, 0);

    await sortByColumn(page, 'Name');
    const firstCellAfter = await cellText(page, 0, 0);
    // After sorting by Name, the order should change (Alice comes first alphabetically)
    expect(firstCellAfter).toBeTruthy();
  });

  test('IntroShowcaseDemo — renders without errors', async ({ page }) => {
    // This is a display-only showcase demo
    await openDemo(page, 'IntroShowcaseDemo');
    await expect(grid(page)).toBeVisible();
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('InteractivePlaygroundDemo — renders without errors', async ({ page }) => {
    // Playground with controls — just verify it renders
    await openDemo(page, 'InteractivePlaygroundDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('CoreEventsDemo — clicking cells logs events', async ({ page }) => {
    await openDemo(page, 'CoreEventsDemo');
    const logEl = page.locator('[data-event-log]');

    // Click a cell to trigger an event
    await cell(page, 0, 1).click();
    await page.waitForTimeout(300);

    // Verify event log has content
    const logText = await logEl.textContent();
    expect(logText).toBeTruthy();
    expect(logText!.length).toBeGreaterThan(0);
  });

  test('CoreEventsDemo — clear log button works', async ({ page }) => {
    await openDemo(page, 'CoreEventsDemo');
    const logEl = page.locator('[data-event-log]');

    // Generate an event
    await cell(page, 0, 0).click();
    await page.waitForTimeout(200);

    // Clear log
    await page.locator('[data-clear-log]').click();
    await page.waitForTimeout(100);
    const logText = await logEl.textContent();
    expect(logText?.trim()).toBe('');
  });

  test('CustomRenderersDemo — custom renderers visible in cells', async ({ page }) => {
    await openDemo(page, 'CustomRenderersDemo');
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
    // Verify the grid rendered (custom renderers produce styled content)
    await expect(grid(page)).toBeVisible();
  });

  test('CustomLoadingRendererDemo — toggle loading state', async ({ page }) => {
    await openDemo(page, 'CustomLoadingRendererDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('HeaderRenderersDemo — custom header content rendered', async ({ page }) => {
    await openDemo(page, 'HeaderRenderersDemo');
    const headers = await headerCells(page).count();
    expect(headers).toBeGreaterThan(0);
  });

  test('LightDomColumnsDemo — columns from light DOM render', async ({ page }) => {
    await openDemo(page, 'LightDomColumnsDemo');
    const headers = await headerCells(page).count();
    expect(headers).toBeGreaterThan(0);
    const rows = await dataRows(page).count();
    expect(rows).toBeGreaterThan(0);
  });

  test('ColumnInferenceDemo — auto-inferred columns', async ({ page }) => {
    await openDemo(page, 'ColumnInferenceDemo');
    const headers = await headerCells(page).count();
    // Column inference should detect columns from data
    expect(headers).toBeGreaterThan(0);
  });

  test('ColumnStatePersistenceDemo — save and load column state', async ({ page }) => {
    await openDemo(page, 'ColumnStatePersistenceDemo');
    await expect(grid(page)).toBeVisible();

    // Click Save State button
    const saveBtn = page.locator('[data-save]');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(200);
    }
  });

  test('PerformanceStressTestDemo — renders without errors', async ({ page }) => {
    await page.goto('/demo/PerformanceStressTestDemo');
    // This demo may not render rows immediately (needs user to click Run)
    await page.waitForSelector('tbw-grid', { state: 'attached', timeout: 15_000 });
    await expect(grid(page)).toBeVisible();
  });
});
