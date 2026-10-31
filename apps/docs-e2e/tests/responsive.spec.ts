import { expect, test } from '@playwright/test';
import { controlOption, dataRows, grid, openDemo } from './utils';

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

    test("card mode hides only the owning grid's header, not a nested grid's (#586)", async ({ page }) => {
      // The demo page has the grid element and the responsive feature registered;
      // build a parent grid with TWO nested grids in a cell renderer on top of it:
      // one plain, one whose header a consumer marked `aria-hidden` for its own
      // reasons. Neither may be hidden by the parent's card mode. The unit suite
      // cannot cover this: the plugin's `?inline` CSS is empty under Vitest, so
      // only a real browser proves the `.header[data-responsive-header-hidden]`
      // selector (and that it is not keyed on bare `.header` or `aria-hidden`).
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      await page.evaluate(() => {
        type GridEl = HTMLElement & { gridConfig: unknown; rows: unknown[]; ready?: () => Promise<void> };
        const makeChild = (className: string, markAriaHidden: boolean): GridEl => {
          const child = document.createElement('tbw-grid') as GridEl;
          child.className = className;
          child.style.cssText = 'display:block;width:300px;height:160px;';
          child.gridConfig = { columns: [{ field: 'x', header: 'X' }] };
          child.rows = [{ x: 1 }, { x: 2 }];
          if (markAriaHidden) {
            // A consumer-owned marker on the nested header, applied once it exists.
            // Only here to prove the parent's hide rule is not keyed on aria-hidden;
            // `.header` is internal DOM, so this grid's own counts are not asserted.
            child.ready?.().then(() => {
              child.querySelector('.rows-body > .header')?.setAttribute('aria-hidden', 'true');
            });
          }
          return child;
        };
        const parent = document.createElement('tbw-grid') as GridEl;
        parent.id = 'e2e-nested-parent';
        parent.style.cssText = 'display:block;width:400px;height:800px;';
        parent.gridConfig = {
          columns: [
            { field: 'a', header: 'A' },
            { field: 'nested', header: 'Nested', renderer: () => makeChild('e2e-nested-child', false) },
            { field: 'marked', header: 'Marked', renderer: () => makeChild('e2e-nested-marked', true) },
          ],
          features: { responsive: { breakpoint: 500, animation: false } },
        };
        parent.rows = [{ a: 1 }];
        document.body.appendChild(parent);
      });

      const parent = page.locator('#e2e-nested-parent');
      await expect(parent).toHaveAttribute('data-responsive', '');

      const parentHeader = parent.locator('.rows-body > .header').first();
      const childHeader = page.locator('.e2e-nested-child .rows-body > .header').first();
      const markedHeader = page.locator('.e2e-nested-marked .rows-body > .header').first();

      await expect(parentHeader).toHaveAttribute('aria-hidden', 'true');
      await expect(parentHeader).toHaveAttribute('data-responsive-header-hidden', '');
      await expect(parentHeader).toBeHidden();

      await expect(childHeader).not.toHaveAttribute('aria-hidden', 'true');
      await expect(childHeader).toBeVisible();
      await expect(childHeader.locator('[role="columnheader"]').first()).toHaveText('X');

      // The consumer's aria-hidden is not the parent's hide signal.
      await expect(markedHeader).toHaveAttribute('aria-hidden', 'true');
      await expect(markedHeader).not.toHaveAttribute('data-responsive-header-hidden', '');
      await expect(markedHeader).toBeVisible();
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

  test('ResponsiveCustomCardRendererDemo — rowClass survives the switch into card layout', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveCustomCardRendererDemo');
    await page.setViewportSize(TABLE_WIDTH);
    // The demo pins its container to 400px, so the layout follows the box, not the viewport.
    const box = page.locator('#responsive-custom-card-renderer-demo .resize-box');
    const setBoxWidth = (px: number) => box.evaluate((el: HTMLElement, w) => (el.style.width = `${w}px`), px);

    // Alice (95k) and Carol (105k) clear the `top-earner` threshold, Bob (75k) does not.
    const rows = dataRows(page);

    await setBoxWidth(1000);
    await expect(grid(page)).not.toHaveAttribute('data-responsive', '');
    await expect(rows.nth(0)).toHaveClass(/top-earner/);
    await expect(rows.nth(1)).not.toHaveClass(/top-earner/);
    await expect(rows.nth(2)).toHaveClass(/top-earner/);

    // `cardRenderer` rows go through ResponsivePlugin.renderRow, which assigns className
    // wholesale — rowClass must still be applied on top of it.
    await setBoxWidth(400);
    await expect(grid(page)).toHaveAttribute('data-responsive', '');
    await expect(rows.nth(0)).toHaveClass(/responsive-card/);
    await expect(rows.nth(0)).toHaveClass(/top-earner/);
    await expect(rows.nth(1)).not.toHaveClass(/top-earner/);
    await expect(rows.nth(2)).toHaveClass(/top-earner/);

    await setBoxWidth(1000);
    await expect(grid(page)).not.toHaveAttribute('data-responsive', '');
    await expect(rows.nth(0)).toHaveClass(/top-earner/);
    await expect(rows.nth(1)).not.toHaveClass(/top-earner/);
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
