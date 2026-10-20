/**
 * Integration tests: MultiSortPlugin + ServerSidePlugin (issue #521).
 *
 * - `sortMode: 'server'` (default): the data source sorts; the grid must show its
 *   order as-is instead of re-sorting it (and its placeholders) locally.
 * - `sortMode: 'local'`: MultiSort sorts the loaded rows; nothing is sent to the backend.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/multi-sort';
import '../../lib/features/server-side';
import { isLoadingPlaceholder } from '../../lib/plugins/server-side';
import type { GetRowsParams, GetRowsResult, ServerSideConfig } from '../../lib/plugins/server-side';

interface Row {
  id: number;
  name: string;
}

const TOTAL = 10;
const PAGE_SIZE = 5;

/**
 * Data source whose blocks resolve only when the test calls `flush()`. It always
 * returns ascending ids, ignoring `sortModel` — standing in for a server whose
 * collation the grid cannot reproduce.
 */
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

async function createGrid(serverSide: Partial<ServerSideConfig> = {}) {
  const ds = createDeferredDataSource();
  const grid = document.createElement('tbw-grid') as any;
  grid.style.height = '600px';
  grid.gridConfig = {
    columns: [
      { field: 'name', header: 'Name', sortable: true },
      { field: 'id', header: 'Id', sortable: true },
    ],
    getRowId: (row: Row) => String(row.id),
    features: {
      multiSort: true,
      serverSide: { pageSize: PAGE_SIZE, dataSource: ds.dataSource, ...serverSide },
    },
  };
  document.body.appendChild(grid);
  await grid.ready();
  return { grid, ds };
}

/** Resolve every request until the data source stops asking for blocks. */
async function flushAll(ds: ReturnType<typeof createDeferredDataSource>) {
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 20));
    if (ds.pending.length === 0) return;
    ds.flush();
  }
}

const loadedRows = (grid: any) => (grid.rows as unknown[]).filter((r) => !isLoadingPlaceholder(r)) as Row[];
const ids = (grid: any) => (grid.rows as Row[]).map((r) => r.id);

describe('MultiSort + ServerSide (#521)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe("sortMode: 'server' (default)", () => {
    it('shows the data source order after a sort refetch instead of re-sorting it', async () => {
      const { grid, ds } = await createGrid();
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));

      grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'desc' }]);
      await flushAll(ds);

      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
      expect(ids(grid)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const lastCall = ds.dataSource.getRows.mock.calls.at(-1)![0];
      expect(lastCall.sortModel).toEqual([{ field: 'id', direction: 'desc' }]);
    });

    it('keeps placeholders in their block positions while the refetch is in flight', async () => {
      const { grid, ds } = await createGrid({ maxConcurrentRequests: 1 });
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));

      grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'desc' }]);
      await vi.waitFor(() => expect(ds.pending.length).toBe(1));
      ds.flush();

      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(PAGE_SIZE));
      expect(ids(grid).slice(0, PAGE_SIZE)).toEqual([0, 1, 2, 3, 4]);
      expect(grid.rows.slice(PAGE_SIZE).every(isLoadingPlaceholder)).toBe(true);
    });

    it('renders the data source rows themselves (no local copy) when nothing is sorted', async () => {
      const { grid, ds } = await createGrid();
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));

      const serverSide = grid.getPluginByName('serverSide') as any;
      expect(grid._rows).toBe(serverSide.managedNodes);
    });
  });

  describe("sortMode: 'local'", () => {
    it('sorts the loaded rows locally without sending sortModel', async () => {
      const { grid, ds } = await createGrid({ sortMode: 'local' });
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
      const calls = ds.dataSource.getRows.mock.calls.length;

      grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'desc' }]);

      await vi.waitFor(() => expect(ids(grid)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]));
      expect(ds.dataSource.getRows.mock.calls.length).toBe(calls);
      for (const [params] of ds.dataSource.getRows.mock.calls) expect(params.sortModel).toBeUndefined();
    });
  });
});
