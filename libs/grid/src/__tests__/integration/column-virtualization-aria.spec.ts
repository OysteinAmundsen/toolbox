/**
 * ColumnVirtualization × ARIA column counts (#642).
 *
 * `aria-colcount` is the total number of visible columns and `aria-colindex` a cell's absolute
 * position among them — never the position inside the rendered scroll window, or a screen reader
 * announces "column 4 of 14" for the 51st of 180 columns.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createGrid, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import type { BaseGridPlugin } from '../../lib/core/plugin/base-plugin';
import type { ColumnConfig } from '../../lib/core/types';
import { ColumnVirtualizationPlugin } from '../../lib/plugins/column-virtualization/column-virtualization-plugin';
import { EditingPlugin } from '../../lib/plugins/editing/editing-plugin';
import { PinnedColumnsPlugin } from '../../lib/plugins/pinned-columns/pinned-columns-plugin';
import { ResponsivePlugin } from '../../lib/plugins/responsive/responsive-plugin';

const COLUMN_COUNT = 180;

const makeColumns = (editable = false): ColumnConfig[] =>
  Array.from({ length: COLUMN_COUNT }, (_, i) => ({ field: `c${i}`, header: `C${i}`, width: 100, editable }));

async function setup(
  plugins: BaseGridPlugin[] = [],
  columns = makeColumns(),
  virtualization = new ColumnVirtualizationPlugin(),
) {
  const grid = createGrid();
  Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
  grid.gridConfig = { columns, fitMode: 'fixed', plugins: [virtualization, ...plugins] };
  grid.rows = [0, 1].map((r) => Object.fromEntries(columns.map((c) => [c.field, `${c.field}-v${r}`])));
  await waitUpgrade(grid);
  const scrollTo = async (scrollLeft: number) => {
    virtualization.onScroll({
      scrollTop: 0,
      scrollLeft,
      scrollHeight: 0,
      scrollWidth: COLUMN_COUNT * 100,
      clientHeight: 0,
      clientWidth: 800,
    });
    await waitUpgrade(grid);
  };
  const colCount = () => grid.querySelector('[aria-colcount]')?.getAttribute('aria-colcount');
  /** `field → aria-colindex` of every cell in a header or data row. */
  const indices = (rowEl: Element | null) =>
    Object.fromEntries(
      [...(rowEl?.querySelectorAll<HTMLElement>(':scope > .cell') ?? [])].map((c) => [
        c.dataset.field,
        c.getAttribute('aria-colindex'),
      ]),
    );
  const header = () => indices(grid.querySelector('.header-row'));
  const row = (r: number) => indices(grid.querySelectorAll('.rows .data-grid-row')[r]);
  return { grid, scrollTo, colCount, header, row };
}

/** The expected index map: each rendered field at its 1-based position in `fields`. */
const absolute = (rendered: Record<string, unknown>, fields: string[]) =>
  Object.fromEntries(Object.keys(rendered).map((f) => [f, String(fields.indexOf(f) + 1)]));

const allFields = makeColumns().map((c) => c.field);

describe('ColumnVirtualization × aria-colcount / aria-colindex (#642)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders every visible field in responsive cards and restores the column window on exit', async () => {
    const responsive = new ResponsivePlugin({ breakpoint: 10, animation: false });
    const virtualization = new ColumnVirtualizationPlugin();
    const { grid, row, scrollTo } = await setup([responsive], makeColumns(), virtualization);
    await scrollTo(5_000);
    expect(Object.keys(row(0)).length).toBeLessThan(COLUMN_COUNT);
    const rowsContainer = grid.querySelector<HTMLElement>('.rows-viewport .rows')!;
    expect(rowsContainer.style.width).not.toBe('');

    responsive.setResponsive(true);
    await waitUpgrade(grid);

    expect(Object.keys(row(0))).toEqual(allFields);
    expect(virtualization.getIsVirtualized()).toBe(false);
    expect(rowsContainer.style.width).toBe('');

    grid.setColumnVisible('c0', false);
    await waitUpgrade(grid);
    expect(Object.keys(row(0))).toEqual(allFields.slice(1));

    responsive.setResponsive(false);
    await waitUpgrade(grid);

    expect(Object.keys(row(0)).length).toBeLessThan(COLUMN_COUNT);
    expect(Object.keys(row(0))[0]).toBe('c1');
    expect(virtualization.getIsVirtualized()).toBe(true);
    expect(rowsContainer.style.width).not.toBe('');
  });

  it.each([true, false])(
    'switches the window in the view transition update (virtualization first: %s)',
    async (first) => {
      const responsive = new ResponsivePlugin({ breakpoint: 10, animation: 'fade' });
      const virtualization = new ColumnVirtualizationPlugin();
      const columns = makeColumns();
      const grid = createGrid();
      Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
      grid.gridConfig = {
        columns,
        fitMode: 'fixed',
        animation: { mode: 'on' },
        plugins: first ? [virtualization, responsive] : [responsive, virtualization],
      };
      grid.rows = [Object.fromEntries(columns.map((c) => [c.field, c.field]))];
      await waitUpgrade(grid);
      let update: (() => Promise<void>) | undefined;
      Object.assign(grid, {
        startViewTransition: (callback: () => Promise<void>) => {
          update = callback;
          return { finished: Promise.resolve(), ready: Promise.resolve() };
        },
      });
      const fields = () =>
        [...grid.querySelectorAll<HTMLElement>('.rows > .data-grid-row > .cell')].map((cell) => cell.dataset.field);

      responsive.setResponsive(true);
      expect(grid.hasAttribute('data-responsive')).toBe(false);
      expect(fields().length).toBeLessThan(COLUMN_COUNT);
      expect(update).toBeDefined();
      await update?.();
      expect(fields()).toEqual(allFields);
      expect(virtualization.getIsVirtualized()).toBe(false);

      responsive.setResponsive(false);
      expect(grid.hasAttribute('data-responsive')).toBe(true);
      expect(fields()).toEqual(allFields);
      expect(update).toBeDefined();
      await update?.();
      expect(fields().length).toBeLessThan(COLUMN_COUNT);
      expect(virtualization.getIsVirtualized()).toBe(true);
    },
  );

  it('only morphs the same cells in both snapshots when cards expand the window', async () => {
    const responsive = new ResponsivePlugin({ breakpoint: 10, animation: 'morph-cells' });
    const virtualization = new ColumnVirtualizationPlugin();
    const { grid } = await setup([responsive], makeColumns(), virtualization);
    let update: (() => Promise<void>) | undefined;
    let finish: (() => void) | undefined;
    Object.assign(grid, {
      startViewTransition: (callback: () => Promise<void>) => {
        update = callback;
        return {
          finished: new Promise<void>((resolve) => {
            finish = resolve;
          }),
          ready: Promise.resolve(),
        };
      },
    });
    const names = () =>
      [...grid.querySelectorAll<HTMLElement>('.rows > .data-grid-row > .cell')]
        .map((cell) => cell.style.getPropertyValue('view-transition-name'))
        .filter(Boolean);

    responsive.setResponsive(true);
    const outgoing = names();
    expect(outgoing.length).toBeGreaterThan(0);
    expect(outgoing.length).toBeLessThanOrEqual(150);
    expect(update).toBeDefined();
    await update?.();
    expect(grid.querySelectorAll('.rows > .data-grid-row > .cell').length).toBe(COLUMN_COUNT * 2);
    expect(names()).toEqual(outgoing);
    finish?.();
  });

  it.each([true, false])('removes custom card content on exit (virtualization: %s)', async (virtualized) => {
    const responsive = new ResponsivePlugin({
      breakpoint: 10,
      animation: false,
      cardRenderer: () => {
        const card = document.createElement('div');
        card.className = 'custom-card';
        return card;
      },
    });
    const columns = makeColumns();
    const grid = createGrid();
    Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 800 });
    grid.gridConfig = {
      columns,
      fitMode: 'fixed',
      plugins: virtualized ? [new ColumnVirtualizationPlugin(), responsive] : [responsive],
    };
    grid.rows = [Object.fromEntries(columns.map((c) => [c.field, c.field]))];
    await waitUpgrade(grid);

    responsive.setResponsive(true);
    await waitUpgrade(grid);
    expect(grid.querySelector('.rows > .data-grid-row > .custom-card')).not.toBeNull();

    responsive.setResponsive(false);
    await waitUpgrade(grid);
    expect(grid.querySelector('.rows > .data-grid-row > .custom-card')).toBeNull();
    expect(grid.querySelectorAll('.rows > .data-grid-row > .cell').length).toBeGreaterThan(0);
  });

  it('reports the full column count and absolute indices after a horizontal scroll', async () => {
    const { scrollTo, colCount, header, row } = await setup();
    expect(colCount()).toBe(String(COLUMN_COUNT));

    await scrollTo(5_000);

    expect(colCount()).toBe(String(COLUMN_COUNT));
    expect(header().c50).toBe('51');
    expect(Object.keys(header()).length).toBeLessThan(COLUMN_COUNT);
    expect(header()).toEqual(absolute(header(), allFields));
    expect(row(0)).toEqual(absolute(row(0), allFields));
    expect(row(1).c50).toBe('51');
  });

  it('maps cloned window columns to their absolute ARIA indices', async () => {
    class CloningWindow extends ColumnVirtualizationPlugin {
      override windowColumns(columns: readonly ColumnConfig[]): readonly ColumnConfig[] {
        return super.windowColumns(columns).map((column) => ({ ...column }));
      }
    }

    const { scrollTo, header, row } = await setup([], makeColumns(), new CloningWindow());
    await scrollTo(5_000);

    expect(header().c50).toBe('51');
    expect(header()).toEqual(absolute(header(), allFields));
    expect(row(0)).toEqual(absolute(row(0), allFields));
  });

  it('counts a pinned column at its position in the full list, not next to the window', async () => {
    const columns = makeColumns();
    columns[179] = { ...columns[179], pinned: 'right' };
    const { scrollTo, header, row } = await setup([new PinnedColumnsPlugin()], columns);

    await scrollTo(5_000);

    expect(header().c179).toBe('180');
    expect(row(0).c179).toBe('180');
    expect(header().c50).toBe('51');
  });

  it('shifts indices when a column outside the window is hidden', async () => {
    const { grid, scrollTo, colCount, header, row } = await setup();
    await scrollTo(5_000);

    grid.setColumnVisible('c0', false);
    await waitUpgrade(grid);

    const visible = allFields.filter((f) => f !== 'c0');
    expect(colCount()).toBe(String(COLUMN_COUNT - 1));
    expect(header()).toEqual(absolute(header(), visible));
    expect(row(0)).toEqual(absolute(row(0), visible));
  });

  it('re-stamps a live edit row whose rendered columns did not change', async () => {
    const editing = new EditingPlugin();
    // A narrow c0: hiding it moves the window by 10px, so the same columns stay rendered.
    const columns = makeColumns(true);
    columns[0] = { ...columns[0], width: 10 };
    const { grid, scrollTo, header, row } = await setup([editing], columns);
    await scrollTo(5_050);
    editing.beginBulkEdit(0);
    await waitUpgrade(grid);
    const renderedBefore = Object.keys(row(0));

    grid.setColumnVisible('c0', false);
    await waitUpgrade(grid);

    const visible = allFields.filter((f) => f !== 'c0');
    expect(Object.keys(row(0))).toEqual(Object.keys(header()));
    expect(Object.keys(row(0))).toEqual(renderedBefore);
    expect(row(0)).toEqual(absolute(row(0), visible));
    const editors = grid.querySelectorAll('.rows .data-grid-row')[0].querySelectorAll(':scope > .cell.editing');
    expect(editors.length).toBe(renderedBefore.length);
  });
});
