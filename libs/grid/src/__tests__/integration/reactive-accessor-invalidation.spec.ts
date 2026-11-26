/**
 * Regression test for #687 — the documented no-argument
 * `invalidateAccessorCache()` must clear the entire accessor cache so the
 * reactive-accessor recipes (external state changes → invalidate → render)
 * actually refresh the displayed computed values.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../lib/core/grid';
import type { DataGridElement } from '../../lib/core/grid';
import { invalidateAccessorCache, resolveCellValue } from '../../lib/core/internal/value-accessor';
import { nextFrame, waitUpgrade } from '../../../test/helpers';

describe('reactive accessor invalidation (#687)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('accessor cache isolation (#688)', () => {
    it('renders independent values for grids sharing a row and accessor', async () => {
      type Row = { amount: number };
      const row: Row = { amount: 10 };
      const accessor = ({ row: data, column }: { row: Row; column: { header?: string } }) =>
        data.amount * Number(column.header);
      const mount = async (multiplier: number) => {
        const grid = document.createElement('tbw-grid') as DataGridElement<Row>;
        grid.columns = [{ field: 'derived', header: String(multiplier), valueAccessor: accessor }];
        grid.rows = [row];
        document.body.appendChild(grid);
        await waitUpgrade(grid);
        return grid;
      };

      const a = await mount(2);
      const b = await mount(3);
      expect(a.querySelector('.data-grid-row .cell')?.textContent).toBe('20');
      expect(b.querySelector('.data-grid-row .cell')?.textContent).toBe('30');
      a.requestRender();
      await nextFrame(2);
      expect(a.querySelector('.data-grid-row .cell')?.textContent).toBe('20');
    });

    it('recomputes when a column accessor is replaced', async () => {
      type Row = { amount: number };
      const grid = document.createElement('tbw-grid') as DataGridElement<Row>;
      grid.columns = [{ field: 'derived', valueAccessor: ({ row }) => row.amount * 2 }];
      grid.rows = [{ amount: 10 }];
      document.body.appendChild(grid);
      await waitUpgrade(grid);
      expect(grid.querySelector('.data-grid-row .cell')?.textContent).toBe('20');

      grid.columns = [{ field: 'derived', valueAccessor: ({ row }) => row.amount * 3 }];
      await nextFrame(2);
      expect(grid.querySelector('.data-grid-row .cell')?.textContent).toBe('30');
    });

    it('sorts each grid using its own accessor for shared rows', async () => {
      type Row = { amount: number };
      const rows = [{ amount: 1 }, { amount: 2 }];
      const mount = async (multiplier: number) => {
        const grid = document.createElement('tbw-grid') as DataGridElement<Row>;
        grid.columns = [{ field: 'derived', valueAccessor: ({ row }) => row.amount * multiplier }];
        grid.rows = rows;
        document.body.appendChild(grid);
        await waitUpgrade(grid);
        return grid;
      };
      const a = await mount(1);
      const b = await mount(-1);
      a.sort('derived', 'asc');
      b.sort('derived', 'asc');
      expect(a.rows.map((row) => row.amount)).toEqual([1, 2]);
      expect(b.rows.map((row) => row.amount)).toEqual([2, 1]);
    });

    it('reuses cached values across effective column clones', async () => {
      type Row = { amount: number };
      const row = { amount: 10 };
      const accessor = vi.fn(({ row: data }: { row: Row }) => data.amount);
      const grid = document.createElement('tbw-grid') as DataGridElement<Row>;
      grid.columns = [{ field: 'derived', valueAccessor: accessor }];
      grid.rows = [row];
      document.body.appendChild(grid);
      await waitUpgrade(grid);
      const column = grid.columns[0];
      const calls = accessor.mock.calls.length;
      expect(resolveCellValue(row, { ...column })).toBe(10);
      expect(accessor).toHaveBeenCalledTimes(calls);
    });
  });

  it('re-renders accessor values after a global invalidateAccessorCache()', async () => {
    let rate = 1;
    const grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);

    grid.gridConfig = {
      getRowId: (row: any) => row.id,
      columns: [
        { field: 'id', width: 80 },
        {
          field: 'derived',
          width: 120,
          valueAccessor: ({ row }: { row: any }) => row.amount * rate,
        },
      ],
    };
    grid.rows = [{ id: 'one', amount: 10 }];

    await waitUpgrade(grid);
    await nextFrame();
    await nextFrame();

    const getDerivedCell = (): HTMLElement => {
      const row = grid.querySelector('.data-grid-row');
      const colIdx = grid._visibleColumns.findIndex((c: any) => c.field === 'derived');
      return row?.children[colIdx] as HTMLElement;
    };

    expect(getDerivedCell()?.textContent).toBe('10');

    // External state the accessor closes over changes — the documented recipe:
    // invalidate globally, request a render.
    rate = 2;
    invalidateAccessorCache();
    grid.requestRender();
    await grid.forceLayout();
    await nextFrame();

    expect(getDerivedCell()?.textContent).toBe('20');
  });
});
