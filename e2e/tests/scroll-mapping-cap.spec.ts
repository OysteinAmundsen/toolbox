import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import type { DataGridElement } from '@toolbox-web/grid';

test('virtual scrolling follows the browser when the spacer crosses the height cap (#681)', async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({
    path: process.env.SCROLL_MAPPING_BUNDLE ?? resolve(__dirname, '../../dist/libs/grid/umd/grid.umd.js'),
  });

  const result = await page.evaluate(async () => {
    const grid = document.createElement('tbw-grid') as DataGridElement<{ id: number }>;
    const columns = [{ field: 'id', header: 'ID' }];
    const rows = Array.from({ length: 900_000 }, (_, id) => ({ id }));
    grid.style.cssText = 'display:block;width:700px;height:500px';
    grid.gridConfig = { columns, rowHeight: 40 };
    grid.rows = rows.slice(0, 500_000);
    document.body.append(grid);
    await grid.ready();

    const scroller = grid.querySelector<HTMLElement>('.faux-vscroll');
    const viewport = grid.querySelector<HTMLElement>('.rows-viewport');
    if (!scroller || !viewport) throw new Error('Virtual scrollbar or viewport is missing');

    const snapshot = () => {
      const state = grid._virtualization;
      const mapping = state.scrollMapping;
      const native = scroller.scrollTop;
      const virtual = mapping.capped
        ? (native * (mapping.rawContentHeight - mapping.viewportHeight)) /
          (mapping.spacerHeight - mapping.viewportHeight)
        : native;
      const index = Math.floor(virtual / state.rowHeight);
      const last = grid.querySelector<HTMLElement>('.rows > .data-grid-row:last-child');
      if (!last) throw new Error('No rendered data row');
      return {
        capped: mapping.capped,
        native,
        maximum: scroller.scrollHeight - scroller.clientHeight,
        start: state.start,
        expectedStart: index - (index % 2),
        end: state.end,
        rowCount: grid.rows.length,
        rowHeight: last.getBoundingClientRect().height,
        lastIndex: Number(last.getAttribute('aria-rowindex')),
        lastBottom: last.getBoundingClientRect().bottom,
        viewportBottom: viewport.getBoundingClientRect().bottom,
      };
    };
    const scrollTo = async (position: number) => {
      await new Promise<void>((resolve) => {
        scroller.addEventListener('scroll', () => requestAnimationFrame(() => resolve()), { once: true });
        scroller.scrollTop = position;
      });
    };
    const afterRender = (change: () => void) =>
      new Promise<ReturnType<typeof snapshot>>((resolve) => {
        grid.addEventListener('render', () => resolve(snapshot()), { once: true });
        change();
      });

    await scrollTo(14_000_000);
    const growth = await afterRender(() => {
      grid.rows = rows;
    });

    await scrollTo(scroller.scrollHeight);
    const shrink = await afterRender(() => {
      grid.rows = rows.slice(0, 500_000);
    });

    await afterRender(() => {
      grid.rows = rows;
    });
    await scrollTo(scroller.scrollHeight);
    const heightShrink = await afterRender(() => {
      grid.gridConfig = { columns, rowHeight: 35 };
    });
    return { growth, shrink, heightShrink };
  });

  expect(result.growth.capped).toBe(true);
  expect(result.growth.start).toBe(result.growth.expectedStart);
  expect(result.growth.start).toBeGreaterThan(350_000);
  for (const tail of [result.shrink, result.heightShrink]) {
    expect(tail.capped).toBe(false);
    expect(tail.native).toBe(tail.maximum);
    expect(tail.start).toBe(tail.expectedStart);
    expect(tail.end).toBe(tail.rowCount);
    expect(tail.lastIndex).toBe(tail.rowCount + 1);
    expect(tail.lastBottom).toBeCloseTo(tail.viewportBottom, 0);
  }
  expect(result.heightShrink.rowHeight).toBe(35);
});
