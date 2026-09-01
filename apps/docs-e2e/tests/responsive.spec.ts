import { expect, test } from '@playwright/test';
import { controlOption, grid, openDemo } from './utils';

/** The demos cap their container at 100% of the viewport, so the viewport drives the breakpoint. */
const CARD_WIDTH = { width: 400, height: 700 };
const TABLE_WIDTH = { width: 1200, height: 700 };

test.describe('Responsive Demos', () => {
  test.describe('ResponsiveDefaultDemo', () => {
    test('crossing the breakpoint toggles card mode', async ({ page }) => {
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');

      await page.setViewportSize(CARD_WIDTH);
      await expect(grid(page)).toHaveAttribute('data-responsive', '');

      await page.setViewportSize(TABLE_WIDTH);
      await expect(grid(page)).not.toHaveAttribute('data-responsive', '');
    });

    test('mode control forces card layout above the breakpoint', async ({ page }) => {
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      await page.setViewportSize(TABLE_WIDTH);
      await expect(grid(page)).not.toHaveAttribute('data-responsive', '');

      await controlOption(page, 'mode', 'card').check();
      await expect(grid(page)).toHaveAttribute('data-responsive', '');
      await expect(page.locator('.responsive-status')).toContainText('setResponsive(true)');

      await controlOption(page, 'mode', 'table').check();
      await expect(grid(page)).not.toHaveAttribute('data-responsive', '');
    });

    test('logs a responsive-change event per switch', async ({ page }) => {
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      const log = page.locator('#responsive-default-log > div');

      await page.setViewportSize(CARD_WIDTH);
      await expect(log.first()).toContainText('isResponsive: true');

      await page.setViewportSize(TABLE_WIDTH);
      await expect(log.first()).toContainText('isResponsive: false');
    });

    test('hidden columns are removed, or kept without their label', async ({ page }) => {
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      await page.setViewportSize(CARD_WIDTH);
      await page.locator('input[data-ctrl-group="hiddenColumns"][value="email"]').check();

      await expect(page.locator('tbw-grid .cell[data-responsive-hidden]').first()).toBeAttached();

      await controlOption(page, 'hiddenStyle', 'value only').check();
      await expect(page.locator('tbw-grid .cell[data-responsive-value-only]').first()).toBeAttached();
    });

    test('hidden columns come back when the table layout returns', async ({ page }) => {
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      await page.setViewportSize(CARD_WIDTH);
      await page.locator('input[data-ctrl-group="hiddenColumns"][value="email"]').check();
      await expect(page.locator('tbw-grid .cell[data-responsive-hidden]').first()).toBeAttached();

      // `hiddenColumns` is card-only, so widening must release every marked cell.
      await page.setViewportSize(TABLE_WIDTH);
      await expect(page.locator('tbw-grid .cell[data-responsive-hidden]')).toHaveCount(0);
    });

    test('turning animation off drops the transition attributes', async ({ page }) => {
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      await controlOption(page, 'animation', 'off').check();

      await page.setViewportSize(CARD_WIDTH);
      await expect(grid(page)).toHaveAttribute('data-responsive', '');
      await expect(grid(page)).not.toHaveAttribute('data-responsive-animate', '');
      await expect(grid(page)).not.toHaveAttribute('data-responsive-transition', '');
    });
  });

  test('ResponsiveCustomCardRendererDemo — cardRowHeight switches between auto and fixed', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveCustomCardRendererDemo');
    await page.setViewportSize(CARD_WIDTH);

    const card = page.locator('tbw-grid .data-grid-row.responsive-card').first();
    await expect(card).toBeVisible();
    await expect.poll(() => card.evaluate((el: HTMLElement) => el.style.height)).toBe('auto');

    await controlOption(page, 'cardRowHeight', '120').check();
    await expect.poll(() => card.evaluate((el: HTMLElement) => el.style.height)).toMatch(/^\d+px$/);
  });

  test('ResponsiveProgressiveDegradationDemo — columns hide before card layout kicks in', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveProgressiveDegradationDemo');
    const status = page.locator('.responsive-status');

    await page.setViewportSize({ width: 800, height: 700 });
    await expect(status).toContainText('column(s) hidden');
    await expect(grid(page)).not.toHaveAttribute('data-responsive', '');

    await page.setViewportSize({ width: 380, height: 700 });
    await expect(status).toContainText('Card Layout');
    await expect(grid(page)).toHaveAttribute('data-responsive', '');
  });

  test.describe('reduced motion', () => {
    // `_applyAnimationConfig` writes these as inline styles, so the media query that
    // zeroes them only wins while it keeps `!important`.
    test('zeroes the animation flags and skips the layout view transition', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      await page.setViewportSize(TABLE_WIDTH);

      await expect
        .poll(() =>
          grid(page).evaluate((el: HTMLElement) => {
            const style = getComputedStyle(el);
            const enabled = style.getPropertyValue('--tbw-animation-enabled').trim();
            // Minified builds emit `0s` where source emits `0ms`.
            const duration = parseFloat(style.getPropertyValue('--tbw-animation-duration'));
            return `${enabled} ${duration}`;
          }),
        )
        .toBe('0 0');

      await page.setViewportSize(CARD_WIDTH);
      await expect(grid(page)).toHaveAttribute('data-responsive', '');
      await expect(grid(page)).not.toHaveAttribute('data-responsive-transition', '');
      await expect
        .poll(() => grid(page).evaluate((el: HTMLElement) => el.style.getPropertyValue('--tbw-responsive-duration')))
        .toBe('0ms');
    });
  });
});
