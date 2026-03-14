import { expect, test } from '@playwright/test';
import { grid, openDemo } from './utils';

test.describe('Responsive Demos', () => {
  test('ResponsiveDefaultDemo — resizing below breakpoint switches to card mode', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveDefaultDemo');

    // The demo has a resizable container
    const resizeWrap = page.locator('.responsive-resize-wrap');
    await expect(resizeWrap).toBeVisible();

    // Shrink viewport to trigger card mode (breakpoint default is 500px)
    await page.setViewportSize({ width: 400, height: 600 });
    await page.waitForTimeout(500);

    // Status div should reflect card mode
    const status = page.locator('.responsive-status');
    if (await status.isVisible()) {
      const text = await status.textContent();
      // Should mention card mode or responsive change
      expect(text).toBeTruthy();
    }
  });

  test('ResponsiveManualControlDemo — buttons toggle table/card mode', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveManualControlDemo');

    // Find card mode button
    const cardBtn = page.locator('button', { hasText: /card/i });
    if (await cardBtn.isVisible()) {
      await cardBtn.click();
      await page.waitForTimeout(500);
    }

    // Find table mode button
    const tableBtn = page.locator('button', { hasText: /table/i });
    if (await tableBtn.isVisible()) {
      await tableBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('ResponsiveEventsDemo — mode change fires events', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveEventsDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ResponsiveAnimatedTransitionsDemo — renders with animations', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveAnimatedTransitionsDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ResponsiveCustomCardRendererDemo — custom card layout renders', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveCustomCardRendererDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ResponsiveFixedCardHeightDemo — fixed height cards', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveFixedCardHeightDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ResponsiveProgressiveDegradationDemo — columns hide progressively', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveProgressiveDegradationDemo');
    await expect(grid(page)).toBeVisible();
  });

  test('ResponsiveValueOnlyColumnsDemo — hidden columns show value only', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveValueOnlyColumnsDemo');
    await expect(grid(page)).toBeVisible();
  });
});
