/**
 * Integration tests: row-ID lookups while ServerSidePlugin swaps placeholders in place.
 *
 * A block landing while `_rows` IS ServerSide's `managedNodes` takes the lightweight
 * `requestVirtualRefresh()` path (no ROWS phase). The lazy row-ID map must still be
 * invalidated, or a map built while the block was pending keeps `__loading:<n>` ids
 * and `getRow()` / `updateRow()` miss the loaded rows (PR #525 review).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/multi-sort';
import '../../lib/features/server-side';
import type { GetRowsParams, GetRowsResult } from '../../lib/plugins/server-side';

interface Row {
  id: number;
  name: string;
}

const TOTAL = 10;
const PAGE_SIZE = 5;

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

const tick = () => new Promise((r) => setTimeout(r, 20));

describe('ServerSide row-ID lookups across in-place block loads', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['without a sort plugin', {}],
    ['with MultiSort (sortMode server)', { multiSort: true }],
  ])('finds rows of a block that lands after the map was built (%s)', async (_label, extraFeatures) => {
    const ds = createDeferredDataSource();
    const grid = document.createElement('tbw-grid') as any;
    grid.style.height = '600px';
    grid.gridConfig = {
      columns: [{ field: 'name', header: 'Name' }],
      getRowId: (row: Row) => String(row.id),
      features: { ...extraFeatures, serverSide: { pageSize: PAGE_SIZE, dataSource: ds.dataSource } },
    };
    document.body.appendChild(grid);
    await grid.ready();

    ds.flush(); // block 0
    await vi.waitFor(() => expect(ds.pending.length).toBe(1)); // block 1 requested by the viewport fill
    await tick();

    // Prime the lazy map while block 1 is still pending.
    expect(grid.getRow('0')).toEqual({ id: 0, name: 'Row 0' });
    expect(grid.getRow('5')).toBeUndefined();

    ds.flush(); // block 1 → in-place swap + requestVirtualRefresh()
    await vi.waitFor(() => expect(grid.getRow('5')).toEqual({ id: 5, name: 'Row 5' }));

    grid.updateRow('5', { name: 'Updated' });
    expect(grid.getRow('5')?.name).toBe('Updated');
  });
});
