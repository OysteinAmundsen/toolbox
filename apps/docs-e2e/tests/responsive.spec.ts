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

    test('card mode styles only the owning grid, not nested grids (#591)', async ({ page }) => {
      // The demo page has the grid element and the responsive feature registered;
      // build a parent grid with TWO nested grids in a cell renderer on top of it:
      // one plain, one whose header a consumer marked `aria-hidden` for its own
      // reasons. Their table layout and chrome must not inherit the parent's card
      // styles. The unit suite cannot cover the CSS: the plugin's `?inline` import
      // is empty under Vitest.
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      await page.evaluate(() => {
        type GridEl = HTMLElement & { gridConfig: unknown; rows: unknown[]; ready?: () => Promise<void> };
        const makeChild = (className: string, markAriaHidden: boolean): GridEl => {
          const child = document.createElement('tbw-grid') as GridEl;
          child.className = className;
          child.style.cssText = 'display:block;width:300px;height:160px;';
          child.gridConfig = {
            columns: [
              { field: 'x', header: 'X' },
              { field: 'y', header: 'Y' },
              { field: 'z', header: 'Z' },
            ],
          };
          child.rows = [
            { x: 1, y: 2, z: 3 },
            { x: 4, y: 5, z: 6 },
          ];
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
          features: { responsive: { breakpoint: 500, animation: false, hideHeader: true } },
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

      const parentRow = parent.locator('.rows').first().locator(':scope > .data-grid-row').first();
      const childRow = page.locator('.e2e-nested-child .rows > .data-grid-row').first();
      const childScrollArea = page.locator('.e2e-nested-child .tbw-scroll-area');
      const childRowsWrapper = page.locator('.e2e-nested-child .rows-body-wrapper');

      await expect(parentRow).toHaveCSS('display', 'block');
      await expect(childRow).toHaveCSS('display', 'grid');
      await expect(childScrollArea).toHaveCSS('overflow-x', 'auto');
      await expect(childRowsWrapper).toHaveCSS('min-width', 'fit-content');

      await page.evaluate(() => {
        const child = document.querySelector<HTMLElement>('.e2e-nested-child')!;
        const root = child.querySelector('.tbw-grid-root')!;
        const cells = child.querySelectorAll('.data-grid-row > .cell');
        cells[0]?.setAttribute('data-utility', '');
        cells[1]?.setAttribute('data-responsive-hidden', '');
        cells[2]?.setAttribute('data-responsive-value-only', '');

        for (const className of [
          'footer-row',
          'tbw-footer',
          'tbw-header-pinned',
          'tbw-pinned-rows',
          'tbw-aggregation-rows',
        ]) {
          const target = document.createElement('div');
          target.className = className;
          root.appendChild(target);
        }
      });

      const childCells = childRow.locator(':scope > .cell');
      await expect(childCells.nth(0)).toHaveCSS('display', 'block');
      await expect(childCells.nth(1)).toHaveCSS('display', 'block');
      await expect(childCells.nth(2)).toHaveCSS('display', 'block');
      await expect
        .poll(() => childCells.nth(2).evaluate((cell) => getComputedStyle(cell, '::before').display))
        .not.toBe('none');

      for (const className of [
        'footer-row',
        'tbw-footer',
        'tbw-header-pinned',
        'tbw-pinned-rows',
        'tbw-aggregation-rows',
      ]) {
        const target = page.locator(`.e2e-nested-child .${className}`).last();
        await expect.poll(() => target.evaluate((el) => getComputedStyle(el).display)).not.toBe('none');
      }
    });

    test('custom card styling preserves nested responsive field labels', async ({ page }) => {
      await openDemo(page, 'responsive/ResponsiveDefaultDemo');
      await page.evaluate(async () => {
        type GridEl = HTMLElement & { gridConfig: unknown; rows: unknown[]; ready?: () => Promise<void> };
        const parent = document.createElement('tbw-grid') as GridEl;
        parent.id = 'e2e-custom-card-parent';
        parent.style.cssText = 'display:block;width:400px;height:500px;';
        parent.gridConfig = {
          columns: [{ field: 'name', header: 'Name' }],
          features: {
            responsive: {
              breakpoint: 500,
              animation: false,
              hideHeader: true,
              cardRenderer: () => {
                const wrapper = document.createElement('div');
                const child = document.createElement('tbw-grid') as GridEl;
                child.className = 'e2e-nested-responsive';
                child.style.cssText = 'display:block;width:300px;height:180px;';
                child.gridConfig = {
                  columns: [{ field: 'value', header: 'Nested label' }],
                  features: { responsive: { breakpoint: 500, animation: false, hideHeader: false } },
                };
                child.rows = [{ value: 'Nested value' }];
                wrapper.appendChild(child);
                return wrapper;
              },
            },
          },
        };
        parent.rows = [{ name: 'Parent row' }];
        document.body.appendChild(parent);
        await parent.ready?.();
      });

      const child = page.locator('#e2e-custom-card-parent .e2e-nested-responsive');
      await expect(child).toHaveAttribute('data-responsive', '');
      const row = child.locator('.data-grid-row').first();
      await expect(row).not.toHaveAttribute('data-responsive-card-hide-header', '');
      const cell = row.locator(':scope > .cell').first();
      await expect.poll(() => cell.evaluate((el) => getComputedStyle(el, '::before').display)).not.toBe('none');
    });
  });

  test('newly virtualized rows keep card styling during keyboard focus navigation', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveDefaultDemo');
    await page.evaluate(async () => {
      type GridEl = HTMLElement & {
        gridConfig: unknown;
        rows: unknown[];
        ready?: () => Promise<void>;
        focusCell: (rowIndex: number, column: string) => void;
      };
      const grid = document.createElement('tbw-grid') as GridEl;
      grid.id = 'e2e-responsive-virtualized';
      grid.style.cssText = 'display:block;width:400px;height:220px;';
      grid.gridConfig = {
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'value', header: 'Value' },
        ],
        features: { responsive: { breakpoint: 500, hideHeader: true, animation: false } },
      };
      grid.rows = Array.from({ length: 100 }, (_, index) => ({
        name: `Record ${index}`,
        value: index,
      }));
      document.body.appendChild(grid);
      await grid.ready?.();
    });

    const virtualGrid = page.locator('#e2e-responsive-virtualized');
    await expect(virtualGrid).toHaveAttribute('data-responsive', '');

    const rowByName = (name: string) => virtualGrid.locator('.data-grid-row').filter({ hasText: name }).first();
    const lastRow = rowByName('Record 99');
    await virtualGrid.evaluate((el) =>
      (el as HTMLElement & { focusCell(rowIndex: number, column: string): void }).focusCell(99, 'name'),
    );
    await expect(lastRow).toBeVisible();
    await expect(lastRow).toHaveAttribute('data-responsive-card', '');
    await expect(lastRow).toHaveAttribute('data-responsive-card-hide-header', '');
    await expect(lastRow).toHaveCSS('display', 'block');
    await expect
      .poll(() =>
        lastRow
          .locator('.cell')
          .first()
          .evaluate((el) => getComputedStyle(el, '::before').display),
      )
      .toBe('none');

    const firstRow = rowByName('Record 0');
    await virtualGrid.evaluate((el) =>
      (el as HTMLElement & { focusCell(rowIndex: number, column: string): void }).focusCell(0, 'name'),
    );
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toHaveAttribute('data-responsive-card', '');
    await expect(firstRow).toHaveAttribute('data-responsive-card-hide-header', '');
    await expect(firstRow).toHaveCSS('display', 'block');
  });

  test('card-height measurement marks rows added by its direct virtualization refresh', async ({ page }) => {
    await openDemo(page, 'responsive/ResponsiveDefaultDemo');
    await page.evaluate(async () => {
      type GridEl = HTMLElement & {
        gridConfig: unknown;
        rows: unknown[];
        ready?: () => Promise<void>;
        refreshVirtualWindow: (force?: boolean, skipAfterRender?: boolean) => boolean;
      };
      const grid = document.createElement('tbw-grid') as GridEl;
      grid.id = 'e2e-responsive-measured-refresh';
      grid.style.cssText = 'display:block;width:1000px;height:220px;';
      grid.gridConfig = {
        rowHeight: 120,
        columns: [{ field: 'name', header: 'Name' }],
        features: {
          responsive: {
            breakpoint: 500,
            hideHeader: true,
            animation: false,
            cardRowHeight: 'auto',
            cardRenderer: (row: { name: string }) => {
              const content = document.createElement('div');
              content.style.height = '40px';
              content.textContent = row.name;
              return content;
            },
          },
        },
      };
      grid.rows = Array.from({ length: 100 }, (_, index) => ({ name: `Measured ${index}` }));
      document.body.appendChild(grid);
      await grid.ready?.();
    });

    const measuredGrid = page.locator('#e2e-responsive-measured-refresh');
    await expect(measuredGrid).not.toHaveAttribute('data-responsive', '');
    await expect(measuredGrid.locator('.rows > .data-grid-row').first()).toHaveCSS('height', '120px');

    await measuredGrid.evaluate((el) => {
      const grid = el as HTMLElement & {
        refreshVirtualWindow: (force?: boolean, skipAfterRender?: boolean) => boolean;
      };
      const rowsContainer = grid.querySelector('.rows')!;
      const refresh = grid.refreshVirtualWindow.bind(grid);
      grid.refreshVirtualWindow = (force, skipAfterRender) => {
        const before = new Set(rowsContainer.querySelectorAll(':scope > .data-grid-row'));
        const result = refresh(force, skipAfterRender);
        if (force && skipAfterRender) {
          const added = Array.from(rowsContainer.querySelectorAll(':scope > .data-grid-row')).filter(
            (row) => !before.has(row),
          );
          if (added.length === 0) return result;
          const marked = added.every(
            (row) => row.hasAttribute('data-responsive-card') && row.hasAttribute('data-responsive-card-hide-header'),
          );
          grid.setAttribute('data-measured-refresh-grew', '');
          grid.toggleAttribute('data-measured-refresh-marked', marked);
        }
        return result;
      };
      grid.style.width = '400px';
    });

    await expect(measuredGrid).toHaveAttribute('data-responsive', '');
    await expect(measuredGrid).toHaveAttribute('data-measured-refresh-grew', '');
    await expect(measuredGrid).toHaveAttribute('data-measured-refresh-marked', '');
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
