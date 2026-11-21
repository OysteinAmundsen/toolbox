/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGrid, nextFrame, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import { ColumnVirtualizationPlugin } from '../../lib/plugins/column-virtualization/column-virtualization-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';

/** happy-dom never fires ResizeObserver: record observers so a test can notify them. */
const observers: { target: Element; callback: () => void }[] = [];
class MockResizeObserver {
  constructor(private callback: () => void) {}
  observe(target: Element) {
    observers.push({ target, callback: this.callback });
  }
  unobserve() {
    /* noop */
  }
  disconnect() {
    const mine = observers.filter((o) => o.callback === this.callback);
    for (const o of mine) observers.splice(observers.indexOf(o), 1);
  }
}

describe('ColumnVirtualization re-windows on geometry changes (#641)', () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function setup() {
    const grid = createGrid();
    Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
    grid.gridConfig = {
      fitMode: 'fixed',
      plugins: [new ColumnVirtualizationPlugin()],
      columns: Array.from({ length: 180 }, (_, i) => ({ field: `c${i}`, width: 100 })),
    };
    grid.rows = [{ c0: 'a' }];
    await waitUpgrade(grid);
    const lastField = () => grid._visibleColumns.at(-1)?.field;
    return { grid, lastField };
  }

  it('grows the window when the host widens', async () => {
    const { grid, lastField } = await setup();
    expect(grid._visibleColumns).toHaveLength(11);
    expect(lastField()).toBe('c10');

    Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 1600 });
    for (const o of observers.filter((o) => o.target === grid)) o.callback();
    await waitUpgrade(grid);

    expect(grid._visibleColumns).toHaveLength(19);
    expect(lastField()).toBe('c18');
    expect(grid.querySelectorAll('.header-row .cell')).toHaveLength(19);
  });

  it('grows the window when a column is narrowed in place', async () => {
    const { grid, lastField } = await setup();

    grid._resizeController.setColumnWidth(0, 50);
    await waitUpgrade(grid);

    expect(lastField()).toBe('c11');
  });

  it('grows the window again when a widened column is reset', async () => {
    const { grid, lastField } = await setup();
    grid._resizeController.setColumnWidth(0, 300);
    await waitUpgrade(grid);
    expect(lastField()).toBe('c8');

    grid._resizeController.resetColumn(0);
    await waitUpgrade(grid);

    expect(lastField()).toBe('c10');
  });

  it('re-measures scroll widths in place when a width change keeps the same columns', async () => {
    const { grid, lastField } = await setup();
    const headerCell = grid.querySelector('.header-row .cell');
    const rowsBody = grid.querySelector<HTMLElement>('.rows-body')!;
    expect(rowsBody.style.minWidth).toBe('18000px');

    grid._resizeController.setColumnWidth(0, 116);
    await waitUpgrade(grid);

    expect(lastField()).toBe('c10');
    expect(rowsBody.style.minWidth).toBe('18016px');
    expect(grid.querySelector<HTMLElement>('.header-row')!.style.minWidth).toBe('18016px');
    expect(grid.querySelector('.header-row .cell')).toBe(headerCell);
  });

  it('lets PinnedColumns re-measure its offsets when a width change keeps the same columns', async () => {
    const grid = createGrid();
    Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
    const pinned = new PinnedColumnsPlugin();
    grid.gridConfig = {
      fitMode: 'fixed',
      plugins: [pinned, new ColumnVirtualizationPlugin()],
      columns: Array.from({ length: 180 }, (_, i) => ({
        field: `c${i}`,
        width: 100,
        pinned: i < 2 ? 'left' : undefined,
      })),
    };
    await waitUpgrade(grid);
    const afterRender = vi.spyOn(pinned, 'afterRender');

    grid._resizeController.setColumnWidth(0, 116);
    await waitUpgrade(grid);

    expect(grid._visibleColumns.at(-1)?.field).toBe('c10');
    expect(afterRender).toHaveBeenCalled();
  });

  it('waits for a resize drag to end before re-windowing', async () => {
    const { grid, lastField } = await setup();
    const resizing = vi.spyOn(grid._resizeController, 'isResizing', 'get').mockReturnValue(true);
    const headerCell = grid.querySelector('.header-row .cell');

    grid._resizeController.setColumnWidth(0, 50);
    await waitUpgrade(grid);
    // Re-windowing rebuilds the header, which would detach the captured resize handle.
    expect(grid.querySelector('.header-row .cell')).toBe(headerCell);
    expect(lastField()).toBe('c10');

    resizing.mockReturnValue(false);
    await nextFrame();
    await waitUpgrade(grid);
    expect(lastField()).toBe('c11');
  });

  it('re-measures offsets after a drag whose width changes cancel out in the total', async () => {
    const { grid, lastField } = await setup();
    const plugin = grid.getPluginByName('columnVirtualization')!;
    const resizing = vi.spyOn(grid._resizeController, 'isResizing', 'get').mockReturnValue(true);

    grid._resizeController.setColumnWidth(1, 150);
    grid._resizeController.setColumnWidth(2, 50);
    resizing.mockReturnValue(false);
    await nextFrame();
    await waitUpgrade(grid);

    expect(lastField()).toBe('c10');
    expect(plugin.getColumnOffset(3)).toBe(300);
    expect(plugin.getColumnOffset(2)).toBe(250);
  });
});
