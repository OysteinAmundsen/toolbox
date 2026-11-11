import { expect, test } from '@playwright/test';
import { resolve } from 'path';

test('column virtualization keeps fast scroll frames covered and right pins stationary (#645)', async ({ page }) => {
  await page.goto('about:blank');
  await page.addScriptTag({
    path: process.env.COLUMN_SCROLL_BUNDLE ?? resolve(__dirname, '../../dist/libs/grid/umd/grid.all.umd.js'),
  });
  const result = await page.evaluate(async () => {
    const { ColumnVirtualizationPlugin, PinnedColumnsPlugin } = (
      window as Window & { TbwGrid: typeof import('../../libs/grid/src/all') }
    ).TbwGrid;
    const grid = document.createElement('tbw-grid');
    grid.style.cssText = 'display:block;width:800px;height:500px';
    const columns = Array.from({ length: 200 }, (_, i) => ({
      field: `c${i}`,
      width: 100,
      ...(i === 0 ? { pinned: 'left' as const } : i === 199 ? { pinned: 'right' as const } : {}),
    }));
    grid.gridConfig = {
      columns,
      fitMode: 'fixed',
      plugins: [new ColumnVirtualizationPlugin(), new PinnedColumnsPlugin()],
    };
    grid.rows = Array.from({ length: 1_000 }, (_, row) =>
      Object.fromEntries(columns.map((col) => [col.field, `${row}:${col.field}`])),
    );
    document.body.append(grid);
    await grid.ready();
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await frame();
    await frame();
    const scroller = grid.querySelector<HTMLElement>('.tbw-scroll-area')!;
    const row = () => grid.querySelector<HTMLElement>('.rows .data-grid-row')!;
    const pin = () => row().querySelector<HTMLElement>('[data-field="c199"]')!;
    const pinLeft = pin().getBoundingClientRect().left;
    const renderTimes: number[] = [];
    let renderStart = 0;
    const rewindow = grid._schedulerRewindow.bind(grid);
    grid._schedulerRewindow = () => {
      renderStart = performance.now();
      rewindow();
    };
    grid.addEventListener('render', () => {
      if (!renderStart) return;
      renderTimes.push(performance.now() - renderStart);
      renderStart = 0;
    });
    let blankFrames = 0;
    let maxPinDrift = 0;
    let delayedFrames = 0;
    let scrollEvents = 0;
    scroller.addEventListener('scroll', () => scrollEvents++);
    for (const step of [0.125, 1, 3, 10]) {
      for (const direction of [1, -1]) {
        for (let i = 0; i < 6; i++) {
          const previousScroll = scroller.scrollLeft;
          const target = Math.max(
            0,
            Math.min(
              scroller.scrollWidth - scroller.clientWidth,
              previousScroll + direction * step * scroller.clientWidth,
            ),
          );
          if (target === previousScroll) continue;
          await new Promise<void>((resolve) => {
            scroller.addEventListener('scroll', () => requestAnimationFrame(() => resolve()), { once: true });
            scroller.scrollLeft = target;
          });
          const cells = [...row().querySelectorAll<HTMLElement>('.cell:not(.sticky-left):not(.sticky-right)')];
          const bounds = scroller.getBoundingClientRect();
          if (
            !cells.some((cell) => {
              const rect = cell.getBoundingClientRect();
              return rect.right > bounds.left + 100 && rect.left < bounds.right - 100;
            })
          )
            blankFrames++;
          const firstField = Number(cells[0]?.dataset.field?.slice(1));
          const lastField = Number(cells.at(-1)?.dataset.field?.slice(1));
          if (firstField * 100 > target + 100 || (lastField + 1) * 100 < target + scroller.clientWidth - 100) {
            delayedFrames++;
          }
          const currentDrift = Math.abs(pin().getBoundingClientRect().left - pinLeft);
          maxPinDrift = Math.max(maxPinDrift, currentDrift);
        }
      }
    }
    await frame();
    renderTimes.sort((a, b) => a - b);
    return {
      blankFrames,
      delayedFrames,
      maxPinDrift,
      scrollEvents,
      rewindows: renderTimes.length,
      medianRenderMs: renderTimes[Math.floor(renderTimes.length / 2)],
      p95RenderMs: renderTimes[Math.floor(renderTimes.length * 0.95)],
    };
  });
  console.log('Column scroll metrics:', JSON.stringify(result));
  expect(result.scrollEvents).toBeGreaterThan(10);
  expect(result.rewindows).toBeGreaterThan(10);
  expect(result.blankFrames).toBe(0);
  expect(result.delayedFrames).toBe(0);
  expect(result.maxPinDrift).toBeLessThanOrEqual(1);
});
