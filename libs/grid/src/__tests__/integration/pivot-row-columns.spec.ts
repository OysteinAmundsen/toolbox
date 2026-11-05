import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGrid, nextFrame, waitUpgrade } from '../../../test/helpers';
import '../../lib/core/grid';
import { PivotPlugin } from '../../lib/plugins/pivot/pivot-plugin';

describe('pivot columns after row updates', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('updates added and removed keys, without rebuilding columns for unchanged keys', async () => {
    const pivot = new PivotPlugin({
      rowGroupFields: ['category', 'product'],
      columnGroupFields: ['region'],
      valueFields: [{ field: 'sales', aggFunc: 'sum' }],
      showToolPanel: false,
    });
    const grid = createGrid();
    grid.gridConfig = {
      columns: [{ field: 'category' }, { field: 'product' }, { field: 'region' }, { field: 'sales' }],
      plugins: [pivot],
    };
    grid.rows = [{ category: 'A', product: 'P', region: 'East', sales: 10 }];
    await waitUpgrade(grid);
    const columnsRender = vi.spyOn(grid, 'requestColumnsRender');
    const fields = () => grid.columns.map((column) => column.field);
    expect(fields()).toContain('East|sales');
    const groupKey = pivot.getPivotResult()!.rows[0].rowKey;
    expect(pivot.isExpanded(groupKey)).toBe(true);
    pivot.collapse(groupKey);
    await nextFrame(2);
    expect(pivot.isExpanded(groupKey)).toBe(false);
    const render = vi.fn();
    grid.addEventListener('render', render);

    grid.rows = [
      { category: 'A', product: 'P', region: 'East', sales: 10 },
      { category: 'A', product: 'P', region: 'West', sales: 20 },
    ];
    await nextFrame(3);
    expect(fields()).toContain('West|sales');
    expect(grid.querySelector('.header-row [data-field="West|sales"]')).not.toBeNull();
    expect(pivot.getPivotResult()?.columnKeys).toEqual(['East', 'West']);
    expect(pivot.isExpanded(groupKey)).toBe(false);
    expect(columnsRender).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(2);

    grid.rows = [{ category: 'A', product: 'P', region: 'West', sales: 30 }];
    await nextFrame(3);
    expect(fields()).not.toContain('East|sales');
    expect(grid.querySelector('.header-row [data-field="East|sales"]')).toBeNull();
    expect(fields()).toContain('West|sales');
    expect(pivot.getPivotResult()?.grandTotal).toBe(30);
    expect(pivot.isExpanded(groupKey)).toBe(false);
    expect(columnsRender).toHaveBeenCalledTimes(2);
    expect(render).toHaveBeenCalledTimes(4);

    columnsRender.mockClear();
    render.mockClear();
    grid.rows = [{ category: 'A', product: 'P', region: 'West', sales: 40 }];
    await nextFrame(3);
    expect(columnsRender).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
    expect(pivot.getPivotResult()?.grandTotal).toBe(40);
    expect(fields()).toContain('West|sales');

    // refresh() clears the result before the next render, but the previous
    // rendered columns are still the comparison point for a new row set.
    pivot.refresh();
    grid.rows = [{ category: 'A', product: 'P', region: 'North', sales: 50 }];
    await nextFrame(3);
    expect(fields()).toContain('North|sales');
    expect(fields()).not.toContain('West|sales');
    expect(pivot.getPivotResult()?.grandTotal).toBe(50);
    expect(pivot.isExpanded(groupKey)).toBe(false);
    expect(columnsRender).toHaveBeenCalledTimes(1);

    columnsRender.mockClear();
    render.mockClear();
    grid.rows = [];
    await nextFrame(3);
    expect(pivot.getPivotResult()?.columnKeys).toEqual([]);
    expect(fields()).not.toContain('North|sales');
    expect(grid.querySelector('.header-row [data-field="North|sales"]')).toBeNull();
    expect(columnsRender).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledTimes(2);
  });
});
