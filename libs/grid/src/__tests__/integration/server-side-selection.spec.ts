/**
 * Integration tests: row Selection styling survives an in-place ServerSide block load (PR #525).
 *
 * A block that lands while `_rows` IS ServerSide's `managedNodes` (uniform heights, known
 * total above the virtualization bypass threshold) takes the lightweight
 * `requestVirtualRefresh()` path. It rebuilds the visible placeholder rows, so plugins that
 * reapply visual state to rendered rows (Selection's classes / `aria-selected`) must run
 * their `onScrollRender` hook — exactly as on a scroll that changes the window.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/multi-sort';
import '../../lib/features/selection';
import '../../lib/features/server-side';
import { isLoadingPlaceholder } from '../../lib/plugins/server-side';
import type { GetRowsParams, GetRowsResult } from '../../lib/plugins/server-side';

interface Row {
  id: number;
  name: string;
}

const TOTAL = 60; // above the virtualization bypass threshold (24)
const PAGE_SIZE = 2; // the rendered window (rows 0–2 here) spans more than one block

function createDeferredDataSource() {
  const pending: Array<{ params: GetRowsParams; resolve: (r: GetRowsResult) => void }> = [];
  const getRows = vi.fn(
    (params: GetRowsParams) =>
      new Promise<GetRowsResult>((resolve) => {
        pending.push({ params, resolve });
      }),
  );
  const flush = () => {
    for (const { params, resolve } of pending.splice(0)) {
      const rows: Row[] = [];
      for (let n = params.startNode; n < Math.min(params.endNode, TOTAL); n++) rows.push({ id: n, name: `Row ${n}` });
      resolve({ rows, totalNodeCount: TOTAL });
    }
  };
  return { dataSource: { getRows }, flush, pending };
}

/** Rendered rows whose data is loaded (not a placeholder), with their `aria-selected`. */
const loadedRenderedRows = (grid: any) =>
  [...grid.querySelectorAll('.data-grid-row')]
    .map((el) => {
      const index = Number((el as HTMLElement).querySelector('.cell[data-row]')?.getAttribute('data-row'));
      return { index, ariaSelected: (el as HTMLElement).getAttribute('aria-selected') };
    })
    .filter(({ index }) => Number.isInteger(index) && !isLoadingPlaceholder(grid._rows[index]));

describe('row Selection across in-place ServerSide block loads', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['without a sort plugin', {}],
    ['with MultiSort (sortMode server)', { multiSort: true }],
  ])('rows of a block that lands after selectAll() render as selected (%s)', async (_label, extra) => {
    const ds = createDeferredDataSource();
    const grid = document.createElement('tbw-grid') as any;
    grid.style.height = '400px';
    grid.gridConfig = {
      columns: [{ field: 'name', header: 'Name' }],
      getRowId: (row: Row) => String(row.id),
      features: { ...extra, selection: 'row', serverSide: { pageSize: PAGE_SIZE, dataSource: ds.dataSource } },
    };
    document.body.appendChild(grid);
    await grid.ready();

    ds.flush(); // block 0
    await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0)); // visible blocks requested
    await vi.waitFor(() => expect(loadedRenderedRows(grid).length).toBe(PAGE_SIZE));

    grid.getPluginByName('selection').selectAll();
    await vi.waitFor(() => expect(loadedRenderedRows(grid).every((r) => r.ariaSelected === 'true')).toBe(true));

    ds.flush(); // visible blocks land → in-place swap + requestVirtualRefresh()
    await vi.waitFor(() => expect(loadedRenderedRows(grid).length).toBeGreaterThan(PAGE_SIZE));
    await new Promise((r) => setTimeout(r, 50));

    const rows = loadedRenderedRows(grid);
    expect(rows.filter((r) => r.ariaSelected !== 'true')).toEqual([]);
  });
});
