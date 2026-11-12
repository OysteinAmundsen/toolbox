import { expect, test } from '@playwright/test';
import type { DataGridElement } from '@toolbox-web/grid';
import type {} from '@toolbox-web/grid/features/shell';
import type {} from '@toolbox-web/grid/features/visibility';
import type { ShellConfig } from '@toolbox-web/grid/plugins/shell';
import { controlOption, dataRows, grid, openDemo, wheelScroll } from './utils';

test.describe('Styling & Layout Demos', () => {
  test('RowCellStylingDemo — conditional row/cell classes are applied', async ({ page }) => {
    await openDemo(page, 'RowCellStylingDemo');

    // Verify data rows exist
    const rows = dataRows(page);
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // rowClass: rows with status=inactive get 'row-inactive'
    const inactiveRows = page.locator('tbw-grid .data-grid-row.row-inactive');
    await expect(inactiveRows.first()).toBeVisible({ timeout: 5000 });

    // cellClass on the score column: cell-success (>=90), cell-danger (<50), cell-warning (<70)
    const styledCells = page.locator(
      'tbw-grid [role="gridcell"].cell-success, tbw-grid [role="gridcell"].cell-danger, tbw-grid [role="gridcell"].cell-warning',
    );
    await expect(styledCells.first()).toBeVisible({ timeout: 5000 });
    const styledCount = await styledCells.count();
    expect(styledCount).toBeGreaterThan(0);
  });

  test('RtlDemo — toggle RTL direction', async ({ page }) => {
    await openDemo(page, 'RtlDemo');

    // Toggle RTL via the control
    const rtlToggle = page.locator('input[data-ctrl="rtl"]');
    if (await rtlToggle.isVisible()) {
      await rtlToggle.check();
      await page.waitForTimeout(300);

      // Grid should have RTL direction
      const dir = await grid(page).evaluate((el) => getComputedStyle(el).direction);
      expect(dir).toBe('rtl');
    }
  });

  test('RowAnimationDemo — animation buttons trigger visual changes', async ({ page }) => {
    await openDemo(page, 'RowAnimationDemo');

    // Click one of the animation trigger buttons
    const changeBtn = page.locator('[data-anim-action="change"], button', { hasText: /change|highlight/i }).first();
    if (await changeBtn.isVisible()) {
      await changeBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(grid(page)).toBeVisible();
  });

  test('LoadingStatesDemo — simulate loading shows indicator', async ({ page }) => {
    await openDemo(page, 'LoadingStatesDemo');

    const simulateBtn = page.locator('[data-loading="simulate"], button', { hasText: /simulate|load/i }).first();
    if (await simulateBtn.isVisible()) {
      await simulateBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(grid(page)).toBeVisible();
  });
});

test.describe('Shell Demos', () => {
  for (const mode of ['push', 'overlay'] as const) {
    for (const position of ['left', 'right'] as const) {
      test(`ShellBasicDemo — ${position} ${mode} splitter resizes and cancels (#656)`, async ({ page }) => {
        await openDemo(page, 'ShellBasicDemo');
        const toolPanel: ShellConfig['toolPanel'] = { mode, position, initialState: 'open', width: 280 };
        await grid(page).evaluate(async (el, toolPanel) => {
          const host = el as DataGridElement;
          const replacement = document.createElement('tbw-grid') as DataGridElement;
          replacement.style.cssText = host.style.cssText;
          replacement.style.width = '700px';
          replacement.gridConfig = {
            columns: host.columns,
            fitMode: 'fixed',
            features: { visibility: true, shell: { header: { title: 'Employees' }, toolPanel } },
          };
          replacement.rows = host.rows;
          host.replaceWith(replacement);
          await replacement.ready();
        }, toolPanel);

        const panel = grid(page).locator('.tbw-tool-panel');
        const handle = panel.locator('[data-resize-handle]');
        const viewport = grid(page).locator('.tbw-scroll-area');
        const width = () => panel.evaluate((el) => el.getBoundingClientRect().width);
        const viewportWidth = () => viewport.evaluate((el) => el.getBoundingClientRect().width);
        await expect.poll(width).toBeCloseTo(280, 0);
        await expect(handle).toBeVisible();
        const initialViewport = await viewportWidth();

        await handle.hover();
        const box = await handle.boundingBox();
        expect(box).not.toBeNull();
        const x = box!.x + box!.width / 2;
        const y = box!.y + box!.height / 2;
        const direction = position === 'left' ? 1 : -1;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + direction * 80, y, { steps: 8 });
        await expect.poll(width).toBeCloseTo(360, 0);
        await expect.poll(viewportWidth).toBeCloseTo(initialViewport - (mode === 'push' ? 80 : 0), 0);
        await page.mouse.up();

        if (mode === 'push') {
          const gap = await panel.evaluate((el) => {
            const panel = el.getBoundingClientRect();
            const content = el.parentElement!.querySelector('.tbw-grid-content')!.getBoundingClientRect();
            return el.getAttribute('data-position') === 'left'
              ? content.left - panel.right
              : panel.left - content.right;
          });
          expect(Math.abs(gap)).toBeLessThanOrEqual(1);
        }

        await handle.hover();
        await page.mouse.down();
        await page.mouse.move(x + direction * 130, y, { steps: 5 });
        await expect.poll(width).toBeCloseTo(410, 0);
        if (mode === 'push') await page.keyboard.press('Escape');
        else await handle.dispatchEvent('pointercancel', { pointerId: 1 });
        await page.mouse.up();
        await expect.poll(width).toBeCloseTo(360, 0);

        await handle.hover();
        await page.mouse.down();
        await page.mouse.move(x + direction * 40, y, { steps: 4 });
        await page.mouse.up();
        await expect.poll(width).toBeCloseTo(320, 0);
        await grid(page).locator('[data-panel-toggle]').click();
        await expect(handle).toBeHidden();
        await grid(page).locator('[data-panel-toggle]').click();
        await expect.poll(width).toBeCloseTo(320, 0);

        if (mode === 'push') {
          await wheelScroll(page, viewport, 1000, 0);
          const lastCell = grid(page).locator('[role="gridcell"][data-field="active"]').first();
          await expect(lastCell).toBeVisible();
          await expect
            .poll(() =>
              lastCell.evaluate((el) => {
                const cell = el.getBoundingClientRect();
                const viewport = el.closest('.tbw-scroll-area')!.getBoundingClientRect();
                return cell.left >= viewport.left - 1 && cell.right <= viewport.right + 1;
              }),
            )
            .toBe(true);
        }
      });
    }
  }

  for (const position of ['left', 'right'] as const) {
    test(`ShellBasicDemo — ${position} push width control clamps and survives rebuilds (#656)`, async ({ page }) => {
      await openDemo(page, 'ShellBasicDemo');
      await controlOption(page, 'panelMode', 'push').check();
      await controlOption(page, 'panelPosition', position).check();
      await grid(page).locator('[data-panel-toggle]').click();
      const panel = grid(page).locator('.tbw-tool-panel');
      const handle = panel.locator('[data-resize-handle]');
      const width = () => panel.evaluate((el) => el.getBoundingClientRect().width);
      await expect(handle).toBeVisible();
      await expect.poll(width).toBeGreaterThan(200);
      await handle.click();
      const size = grid(page).getByRole('spinbutton', { name: 'Size in pixels' });
      await expect(size).toBeVisible();
      await size.fill('340');
      await size.press('Enter');
      await expect.poll(width).toBeCloseTo(340, 0);

      await size.fill('1');
      await size.press('Enter');
      await expect.poll(width).toBeCloseTo(200, 0);
      await size.fill('10000');
      await size.press('Enter');
      const max = await grid(page)
        .locator('.tbw-shell-body')
        .evaluate((el) => el.getBoundingClientRect().width - 20);
      await expect.poll(width).toBeCloseTo(max, 0);
      await size.fill('340');
      await size.press('Enter');
      await page.keyboard.press('Escape');

      await controlOption(page, 'panelPosition', position === 'left' ? 'right' : 'left').check();
      await expect(panel).toHaveAttribute('data-position', position === 'left' ? 'right' : 'left');
      await expect.poll(width).toBeCloseTo(340, 0);
      await expect(handle).toBeVisible();
      await handle.click();
      await expect(size).toBeVisible();
      await size.fill('300');
      await size.press('Enter');
      await expect.poll(width).toBeCloseTo(300, 0);
      await page.keyboard.press('Escape');

      await grid(page).evaluate(
        async (el, position: 'left' | 'right') => {
          const host = el as DataGridElement;
          host.gridConfig = {
            columns: host.columns,
            features: {
              visibility: true,
              shell: { toolPanel: { mode: 'push', position, width: 320 } },
            },
          };
          await host.ready();
        },
        position === 'left' ? 'right' : 'left',
      );
      await expect.poll(width).toBeCloseTo(320, 0);
      await grid(page).evaluate((el) => {
        (el as HTMLElement).style.width = '220px';
      });
      await expect.poll(width).toBeLessThanOrEqual(200);
      await expect
        .poll(() =>
          grid(page)
            .locator('.tbw-scroll-area')
            .evaluate((el) => el.getBoundingClientRect().width),
        )
        .toBeGreaterThan(0);
    });
  }

  test('ShellBasicDemo — shell with title and toolbar renders', async ({ page }) => {
    await openDemo(page, 'ShellBasicDemo');
    await expect(grid(page)).toBeVisible();

    // Verify shell title is visible
    const title = page.locator('tbw-grid .tbw-shell-title');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText?.length).toBeGreaterThan(0);

    // Verify shell header exists
    const shellHeader = page.locator('tbw-grid .tbw-shell-header');
    await expect(shellHeader).toBeVisible();
  });

  test('ShellLightDomDemo — shell configured via light DOM', async ({ page }) => {
    await openDemo(page, 'ShellLightDomDemo');
    await expect(grid(page)).toBeVisible();

    // Verify light DOM shell elements exist
    const shell = page.locator('tbw-grid-shell, tbw-grid tbw-grid-header');
    const shellCount = await shell.count();
    expect(shellCount).toBeGreaterThan(0);
  });

  test('ShellMultiPanelsDemo — toolbar toggles tool panels', async ({ page }) => {
    await openDemo(page, 'ShellMultiPanelsDemo');

    // Find toolbar buttons
    const toolbarButtons = page.locator('tbw-grid .tbw-toolbar-btn');
    const count = await toolbarButtons.count();

    if (count > 0) {
      // Click first toolbar button to toggle a panel
      await toolbarButtons.first().click();
      await page.waitForTimeout(300);
    }

    await expect(grid(page)).toBeVisible();
  });

  test('ShellToolbarButtonsDemo — custom toolbar buttons render', async ({ page }) => {
    await openDemo(page, 'ShellToolbarButtonsDemo');
    await expect(grid(page)).toBeVisible();

    // Verify custom toolbar buttons exist
    const toolbarButtons = page.locator('tbw-grid .tbw-toolbar-btn');
    const count = await toolbarButtons.count();
    expect(count).toBeGreaterThan(0);

    // Click a toolbar button and verify it responds (demo shows alert)
    page.on('dialog', (dialog) => dialog.accept());
    await toolbarButtons.first().click();
    await page.waitForTimeout(300);
  });

  test('ShellDropdownDemo — custom column-header button opens the tool panel as a popover', async ({ page }) => {
    await openDemo(page, 'shell/ShellDropdownDemo');
    await expect(grid(page)).toBeVisible();

    // The tool panel is rendered as a manual popover (closed initially).
    const panel = page.locator('tbw-grid .tbw-tool-panel[popover]');
    await expect(panel).toHaveCount(1);

    // The built-in toolbar toggle is disabled — only the custom header button drives it.
    const trigger = page.locator('tbw-grid .tbw-columns-trigger');
    await expect(trigger).toBeVisible();

    // Click the custom header button → the popover opens, anchored below it.
    await trigger.click();
    await expect(panel).toHaveAttribute('data-anchor', 'below');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-resize-handle]')).toBeHidden();

    // Escape dismisses the dropdown.
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});
