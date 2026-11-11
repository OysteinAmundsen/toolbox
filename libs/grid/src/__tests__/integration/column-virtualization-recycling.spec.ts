/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import { ColumnVirtualizationPlugin } from '../../lib/plugins/column-virtualization/column-virtualization-plugin';
import { EditingPlugin } from '../../lib/plugins/editing/editing-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';

describe('ColumnVirtualization cell retention (#645)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  async function setup(pinnedFirst = false) {
    const grid = createGrid();
    Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
    const virtualization = new ColumnVirtualizationPlugin();
    const renderer = vi.fn(({ value }: { value: unknown }) => {
      const span = document.createElement('span');
      span.textContent = String(value);
      return span;
    });
    grid.gridConfig = {
      fitMode: 'fixed',
      getRowId: () => 'row',
      plugins: pinnedFirst ? [new PinnedColumnsPlugin(), virtualization] : [virtualization, new PinnedColumnsPlugin()],
      columns: Array.from({ length: 200 }, (_, i) => ({
        field: `c${i}`,
        width: 100,
        renderer,
        ...(i === 199 ? { pinned: 'right' as const } : {}),
      })),
    };
    grid.rows = [{ c0: 'first', c5: 'retained', c199: 'pin' }];
    await waitUpgrade(grid);
    const cell = (field: string) => grid.querySelector<HTMLElement>(`.rows .data-grid-row > [data-field="${field}"]`)!;
    const scroll = async (scrollLeft: number) => {
      virtualization.onScroll({
        scrollTop: 0,
        scrollLeft,
        scrollWidth: 20_000,
        scrollHeight: 0,
        clientWidth: 800,
        clientHeight: 0,
      });
      await waitUpgrade(grid);
    };
    return { grid, cell, scroll, renderer };
  }

  it('keeps overlapping cells, renderer contents and pinned cells without invoking their renderers', async () => {
    const { grid, cell, scroll, renderer } = await setup();
    const kept = cell('c5');
    const content = kept.firstElementChild;
    const pinned = cell('c199');
    renderer.mockClear();

    await scroll(500);

    expect(cell('c5')).toBe(kept);
    expect(cell('c5').firstElementChild).toBe(content);
    expect(cell('c199')).toBe(pinned);
    expect(cell('c5').dataset.col).toBe(String(grid._visibleColumns.findIndex((c) => c.field === 'c5')));
    expect(cell('c5').getAttribute('aria-colindex')).toBe('6');
    // Only the five entering columns invoke their renderers.
    expect(renderer).toHaveBeenCalledTimes(5);
  });

  it('still rebuilds changed column definitions and updates data on a normal render', async () => {
    const { grid, cell, scroll } = await setup();
    await scroll(500);
    grid.rows = [{ c0: 'first', c5: 'updated', c199: 'pin' }];
    await waitUpgrade(grid);
    expect(cell('c5').textContent).toBe('updated');

    const kept = cell('c5');
    grid.columns = grid.columns.map((c) => (c.field === 'c5' ? { ...c, renderer: () => 'replacement' } : c));
    await waitUpgrade(grid);
    expect(cell('c5')).not.toBe(kept);
    expect(cell('c5').textContent).toBe('replacement');
  });

  describe.each([false, true])('batched data/window work (pinned first: %s)', (pinnedFirst) => {
    it.each([false, true])('updates retained content (window first: %s)', async (windowFirst) => {
      const { grid, cell, scroll, renderer } = await setup(pinnedFirst);
      const kept = cell('c5');
      const pin = cell('c199');
      const update = () => grid.updateRow('row', { c5: 'updated', c199: 'updated pin' });
      renderer.mockClear();

      if (!windowFirst) update();
      const pending = scroll(500);
      if (windowFirst) update();
      await pending;

      expect(cell('c5')).toBe(kept);
      expect(cell('c5').textContent).toBe('updated');
      expect(cell('c199')).toBe(pin);
      expect(cell('c199').textContent).toBe('updated pin');
      renderer.mockClear();
      const content = cell('c5').firstElementChild;
      await scroll(600);
      expect(cell('c5').firstElementChild).toBe(content);
      expect(renderer).toHaveBeenCalledTimes(1);
    });
  });

  describe.each([false, true])('outgoing editor commits (pinned first: %s)', (pinnedFirst) => {
    it.each(['row', 'grid'] as const)('refreshes retained derived values in %s edit mode', async (mode) => {
      const { grid, cell, scroll } = await setup(pinnedFirst);
      const editing = new EditingPlugin({ mode });
      grid.gridConfig = {
        ...grid.gridConfig,
        plugins: [...(grid.gridConfig.plugins ?? []), editing],
        columns: grid.columns.map((col) => ({
          ...col,
          editable: col.field === 'c0',
          ...(col.field === 'c199' ? { valueAccessor: ({ row }: { row: Record<string, string> }) => row.c0 } : {}),
        })),
      };
      await waitUpgrade(grid);
      if (mode === 'row') editing.beginBulkEdit(0);
      await waitUpgrade(grid);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const summary = cell('c199');
      expect(summary.textContent).toBe('first');
      const input = cell('c0').querySelector('input')!;
      input.focus();
      expect(document.activeElement).toBe(input);
      input.value = 'committed draft';

      await scroll(500);

      expect(grid.rows[0].c0).toBe('committed draft');
      expect(cell('c199')).toBe(summary);
      expect(summary.textContent).toBe('committed draft');
    });
  });

  it('releases only dropped views and loaders, leaving kept loading content mounted', async () => {
    const { grid, cell, scroll } = await setup();
    const dropped = cell('c0');
    const kept = cell('c5');
    const overlay = document.createElement('div');
    overlay.className = 'tbw-cell-loading-overlay';
    kept.appendChild(overlay);
    grid._rowPool[0].__hasCellLoading = true;
    const releaseCell = vi.fn((_cell: HTMLElement) => undefined);
    const unmount = vi.fn((_container: HTMLElement) => undefined);
    grid.__frameworkAdapter = { releaseCell, unmount };

    await scroll(500);

    expect(releaseCell).toHaveBeenCalledWith(dropped);
    expect(releaseCell).not.toHaveBeenCalledWith(kept);
    expect(unmount).not.toHaveBeenCalledWith(overlay);
    expect(overlay.parentElement).toBe(kept);
  });

  it('flushes a native horizontal scroll inside its first animation frame', async () => {
    const { grid, cell } = await setup();
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const scroller = grid.querySelector<HTMLElement>('.tbw-scroll-area')!;
    scroller.scrollLeft = 5_000;
    scroller.dispatchEvent(new Event('scroll'));
    expect(callbacks).toHaveLength(1);
    callbacks[0](0);
    expect(cell('c50')).not.toBeNull();
    expect(cell('c5')).toBeNull();
  });

  it('lets pending column-definition work supersede a scroll-only window flush', async () => {
    const { grid, cell } = await setup();
    const callbacks: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    const process = vi.spyOn(grid, '_schedulerProcessColumns');
    const window = vi.spyOn(grid, '_schedulerRewindow');
    const scroller = grid.querySelector<HTMLElement>('.tbw-scroll-area')!;
    scroller.scrollLeft = 5_000;
    scroller.dispatchEvent(new Event('scroll'));
    grid.requestColumnsRender();

    callbacks[0](0);

    expect(process).toHaveBeenCalledOnce();
    expect(window).not.toHaveBeenCalled();
    expect(cell('c50')).not.toBeNull();
  });
});
