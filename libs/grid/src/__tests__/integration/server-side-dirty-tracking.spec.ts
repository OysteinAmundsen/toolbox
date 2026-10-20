/**
 * Integration tests: Editing dirty tracking with ServerSide block loads (PR #525).
 *
 * A block that lands while `_rows` IS ServerSide's `managedNodes` (uniform heights,
 * known total) takes the lightweight `requestVirtualRefresh()` path — no ROWS phase,
 * so Editing's `processRows` baseline capture never sees those rows. Baselines must be
 * captured when the block arrives, or the loaded rows cannot be rolled back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/editing';
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

describe('Editing dirty tracking across in-place ServerSide block loads', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['without a sort plugin', {}],
    ['with MultiSort (sortMode server)', { multiSort: true }],
  ])('captures baselines for a deferred block and reverts an edit to the fetched value (%s)', async (_l, extra) => {
    const ds = createDeferredDataSource();
    const grid = document.createElement('tbw-grid') as any;
    grid.style.height = '600px';
    grid.gridConfig = {
      columns: [{ field: 'name', header: 'Name', editable: true }],
      getRowId: (row: Row) => String(row.id),
      features: {
        ...extra,
        editing: { dirtyTracking: true },
        serverSide: { pageSize: PAGE_SIZE, dataSource: ds.dataSource },
      },
    };
    document.body.appendChild(grid);
    await grid.ready();

    ds.flush(); // block 0
    await vi.waitFor(() => expect(ds.pending.length).toBe(1)); // block 1 requested by the viewport fill
    ds.flush(); // block 1 → in-place swap + requestVirtualRefresh()
    await vi.waitFor(() => expect(grid.getRow('7')).toEqual({ id: 7, name: 'Row 7' }));

    const editing = grid.getPluginByName('editing');
    expect(editing.getOriginalRow('7')).toEqual({ id: 7, name: 'Row 7' });

    grid.updateRow('7', { name: 'Edited' });
    expect(editing.isDirty('7')).toBe(true);

    editing.revertRow('7');
    expect(grid.getRow('7')?.name).toBe('Row 7');
    expect(editing.isDirty('7')).toBe(false);
  });

  it('emits baselines-captured after a deferred block lands on the virtualized lightweight path', async () => {
    const BIG_TOTAL = 60; // above the virtualization bypass threshold (24)
    const BIG_PAGE = 30;
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
        for (let n = params.startNode; n < Math.min(params.endNode, BIG_TOTAL); n++) {
          rows.push({ id: n, name: `Row ${n}` });
        }
        resolve({ rows, totalNodeCount: BIG_TOTAL });
      }
    };
    const grid = document.createElement('tbw-grid') as any;
    grid.style.height = '400px';
    grid.gridConfig = {
      columns: [{ field: 'name', header: 'Name', editable: true }],
      getRowId: (row: Row) => String(row.id),
      features: {
        editing: { dirtyTracking: true },
        serverSide: { pageSize: BIG_PAGE, loadThreshold: BIG_TOTAL, dataSource: { getRows } },
      },
    };
    const counts: number[] = [];
    grid.addEventListener('baselines-captured', (e: Event) => counts.push((e as CustomEvent).detail.count));
    document.body.appendChild(grid);
    await grid.ready();

    await vi.waitFor(() => expect(pending.length).toBe(1));
    flush(); // block 0
    await vi.waitFor(() => expect(counts.at(-1)).toBe(BIG_PAGE));
    await vi.waitFor(() => expect(pending.length).toBe(1)); // block 1 prefetched via loadThreshold

    flush(); // block 1 → in-place swap + requestVirtualRefresh() (no afterRender on its own)
    await vi.waitFor(() => expect(counts.at(-1)).toBe(BIG_TOTAL));
    await new Promise((r) => setTimeout(r, 50));
    expect(counts.filter((n) => n === BIG_TOTAL)).toHaveLength(1);
  });
});
