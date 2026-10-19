/**
 * Integration tests: FilteringPlugin + ServerSidePlugin (issue #520).
 *
 * - `filterMode: 'server'` (default): the data source filters; the grid must not
 *   re-filter its results (or its placeholders) locally.
 * - `filterMode: 'local'`: blocks that land after the filter was set must be
 *   filtered too, and unloaded placeholders keep their slots until they load.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/filtering';
import '../../lib/features/server-side';
import { isLoadingPlaceholder } from '../../lib/plugins/server-side';
import type { GetRowsParams, GetRowsResult, ServerSideConfig } from '../../lib/plugins/server-side';

interface Row {
  id: number;
  name: string;
}

const TOTAL = 10;
const PAGE_SIZE = 5;

/** Data source whose blocks resolve only when the test calls `flush()`. */
function createDeferredDataSource() {
  const pending: Array<{ params: GetRowsParams; resolve: (r: GetRowsResult) => void }> = [];
  const getRows = vi.fn(
    (params: GetRowsParams) =>
      new Promise<GetRowsResult>((resolve) => {
        pending.push({ params, resolve });
      }),
  );
  /** Resolve pending requests (optionally only those starting at `startNode`). */
  const flush = (startNode?: number) => {
    for (let i = pending.length - 1; i >= 0; i--) {
      const { params, resolve } = pending[i];
      if (startNode !== undefined && params.startNode !== startNode) continue;
      pending.splice(i, 1);
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
      { field: 'name', header: 'Name' },
      { field: 'id', header: 'Id' },
    ],
    getRowId: (row: Row) => String(row.id),
    features: {
      filtering: true,
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

describe('Filtering + ServerSide (#520)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe("filterMode: 'server' (default)", () => {
    it('shows every row the data source returns after a filter refetch', async () => {
      const { grid, ds } = await createGrid();
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));

      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'Row' });
      await flushAll(ds);

      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
      expect(grid.rows.length).toBe(TOTAL);
      const lastCall = ds.dataSource.getRows.mock.calls.at(-1)![0];
      expect(lastCall.filterModel).toEqual({ name: expect.objectContaining({ value: 'Row' }) });
    });

    it('does not re-filter server results with local semantics', async () => {
      const { grid, ds } = await createGrid();
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));

      // The server matches 'vessel X' on fields the grid does not know about.
      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'vessel X' });
      await flushAll(ds);

      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
    });

    it('keeps placeholders while the refetch is in flight', async () => {
      const { grid, ds } = await createGrid();
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));

      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'Row' });
      await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
      ds.flush(0);

      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(PAGE_SIZE));
      expect(grid.rows.length).toBe(TOTAL);
      expect(grid.rows.slice(PAGE_SIZE).every(isLoadingPlaceholder)).toBe(true);
    });
  });

  describe("filterMode: 'local'", () => {
    it('filters a block that loads after the filter was set', async () => {
      const { grid, ds } = await createGrid({ filterMode: 'local', maxConcurrentRequests: 1 });
      await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
      ds.flush(0);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(PAGE_SIZE));

      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'Row' });
      await flushAll(ds);

      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
      // Local mode never ships the filter to the backend.
      for (const [params] of ds.dataSource.getRows.mock.calls) expect(params.filterModel).toBeUndefined();
    });

    it('keeps placeholders until their block loads, then filters it', async () => {
      const { grid, ds } = await createGrid({ filterMode: 'local', maxConcurrentRequests: 1 });
      await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
      ds.flush(0);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(PAGE_SIZE));

      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'Row 7' });
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(0));
      // Unloaded rows keep their slots so the scroll height (and the next fetch) survives.
      expect(grid.rows.length).toBe(PAGE_SIZE);
      expect(grid.rows.every(isLoadingPlaceholder)).toBe(true);

      await flushAll(ds);
      await vi.waitFor(() => expect(grid.rows.map((r: Row) => r.name)).toEqual(['Row 7']));
    });

    it('shows the first block when the filter rendered before it loaded', async () => {
      const { grid, ds } = await createGrid({ filterMode: 'local' });
      await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));

      // Renders while block 0 is pending: the filter caches its (empty) result.
      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'Row' });
      await new Promise((r) => setTimeout(r, 50));
      await flushAll(ds);

      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
    });

    it('filters loaded rows in place without a refetch', async () => {
      const { grid, ds } = await createGrid({ filterMode: 'local' });
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
      const calls = ds.dataSource.getRows.mock.calls.length;

      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'Row 3' });

      await vi.waitFor(() => expect(grid.rows.map((r: Row) => r.name)).toEqual(['Row 3']));
      expect(ds.dataSource.getRows.mock.calls.length).toBe(calls);
    });
  });

  describe('data-src (URL-backed) source', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** The URL source fetches the whole dataset once and only slices it — it never filters or sorts. */
    async function createUrlGrid() {
      const data: Row[] = Array.from({ length: TOTAL }, (_, i) => ({ id: i, name: `Row ${i}` }));
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
      vi.stubGlobal('fetch', fetchMock);
      const grid = document.createElement('tbw-grid') as any;
      grid.setAttribute('data-src', '/rows.json');
      grid.gridConfig = {
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'id', header: 'Id', sortable: true },
        ],
        getRowId: (row: Row) => String(row.id),
        features: { filtering: true, serverSide: { pageSize: PAGE_SIZE } },
      };
      document.body.appendChild(grid);
      await grid.ready();
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
      return { grid, fetchMock };
    }

    it('filters locally, since the URL source ignores filterModel', async () => {
      const { grid, fetchMock } = await createUrlGrid();

      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'Row 3' });

      await vi.waitFor(() => expect(grid.rows.map((r: Row) => r.name)).toEqual(['Row 3']));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('sorts locally, since the URL source ignores sortModel', async () => {
      const { grid } = await createUrlGrid();

      grid.sort('id', 'desc');

      await vi.waitFor(() => expect(grid.rows.map((r: Row) => r.id)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]));
    });
  });

  it("sortMode: 'local' shows a block that loads after the local sort", async () => {
    const { grid, ds } = await createGrid({ sortMode: 'local', maxConcurrentRequests: 1 });
    await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
    ds.flush(0);
    await vi.waitFor(() => expect(loadedRows(grid).length).toBe(PAGE_SIZE));

    grid.sort('id', 'desc');
    await vi.waitFor(() => expect(grid.rows[0]?.id).toBe(4));
    await flushAll(ds);

    await vi.waitFor(() => expect(grid.rows.map((r: Row) => r.id)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]));
  });
});
