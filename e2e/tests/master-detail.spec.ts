import { expect, test } from '@playwright/test';
import { DEMOS, waitForGridReady } from './utils';

/**
 * E2E tests for master-detail functionality across all three demos.
 * Tests that clicking the expander shows the detail panel.
 */
test.describe('Master-Detail Panel', () => {
  // Disable retries — these tests are deterministic; retrying masks real bugs
  test.describe.configure({ retries: 0 });

  test('vanilla: clicking expander shows detail panel', async ({ page }) => {
    await page.goto(DEMOS.vanilla);
    await waitForGridReady(page);

    // Enable master-detail via the checkbox
    const detailCheckbox = page.locator('#enable-detail');
    if (await detailCheckbox.isVisible()) {
      const isChecked = await detailCheckbox.isChecked();
      if (!isChecked) {
        await detailCheckbox.check();
        await page.waitForTimeout(500);
      }
    }

    await waitForGridReady(page);
    await page.waitForTimeout(500);

    // Find the first expander toggle button
    const expander = page.locator('.master-detail-toggle').first();
    await expect(expander).toBeVisible({ timeout: 10000 });

    // Click to expand
    await expander.click();
    await page.waitForTimeout(300);

    // Check for detail row
    const detailRow = page.locator('.master-detail-row').first();
    await expect(detailRow).toBeVisible({ timeout: 5000 });
  });

  test('angular: clicking expander shows detail panel', async ({ page }) => {
    await page.goto(DEMOS.angular);
    await waitForGridReady(page);

    // Angular demo has master-detail enabled by default
    await waitForGridReady(page);
    await page.waitForTimeout(500);

    // Find the first expander toggle button
    const expander = page.locator('.master-detail-toggle').first();
    await expect(expander).toBeVisible({ timeout: 10000 });

    // Click to expand
    await expander.click();
    await page.waitForTimeout(300);

    // Check for detail row
    const detailRow = page.locator('.master-detail-row').first();
    await expect(detailRow).toBeVisible({ timeout: 5000 });
  });

  test('react: clicking expander shows detail panel', async ({ page }) => {
    await page.goto(DEMOS.react);
    await waitForGridReady(page);
    await page.waitForTimeout(1000); // React needs extra time to settle

    // Find the first expander toggle button
    const expander = page.locator('.master-detail-toggle').first();
    await expect(expander).toBeVisible({ timeout: 10000 });

    // Click to expand
    await expander.click();
    await page.waitForTimeout(300);

    // Check for detail row
    const detailRow = page.locator('.master-detail-row').first();
    await expect(detailRow).toBeVisible({ timeout: 5000 });
  });

  test('react: toggling off master-detail does not cause errors', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Track uncaught page errors
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto(DEMOS.react);
    await waitForGridReady(page);
    await page.waitForTimeout(1000);

    // Find the Master-Detail checkbox
    const masterDetailLabel = page.locator('label:has-text("Master-Detail")');
    const checkbox = masterDetailLabel.locator('input[type="checkbox"]');

    // Verify it's checked initially
    await expect(checkbox).toBeChecked();

    // Uncheck to toggle off master-detail
    await checkbox.uncheck();
    await page.waitForTimeout(500);

    // Verify the expander column is gone
    const expanderToggles = page.locator('.master-detail-toggle');
    await expect(expanderToggles).toHaveCount(0);

    // Check no removeChild errors occurred
    const hasRemoveChildError = pageErrors.some((e) => e.includes('removeChild'));
    expect(hasRemoveChildError, `Page errors: ${pageErrors.join(', ')}`).toBe(false);
  });
});
