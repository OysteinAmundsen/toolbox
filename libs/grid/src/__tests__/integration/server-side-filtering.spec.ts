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

    it('refetches block 0 when the filter changes before the first block lands', async () => {
      const { grid, ds } = await createGrid();
      await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
      const stale = ds.pending[0];

      grid.getPluginByName('filtering').setFilter('name', { type: 'text', operator: 'contains', value: 'Row' });

      expect(stale.params.signal.aborted).toBe(true);
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
      expect(ds.dataSource.getRows.mock.calls.at(-1)![0].filterModel).toEqual({
        name: expect.objectContaining({ value: 'Row' }),
      });
    });

    it('refetches after a filter that matched no rows is changed', async () => {
      const { grid, ds } = await createGrid();
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
      const filtering = grid.getPluginByName('filtering');

      filtering.setFilter('name', { type: 'text', operator: 'contains', value: 'none' });
      await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
      ds.pending.splice(0).forEach(({ resolve }) => resolve({ rows: [], totalNodeCount: 0 }));
      await vi.waitFor(() => expect(grid.rows.length).toBe(0));

      filtering.clearAllFilters();
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

  describe('initial columnState (#647)', () => {
    const NAME_FILTER = { type: 'text', operator: 'contains', value: 'Row' } as const;
    const columnState = (filter: Record<string, unknown> | null = NAME_FILTER) => ({
      columns: [
        { field: 'name', order: 0, visible: true, ...(filter ? { filter } : {}) },
        { field: 'id', order: 1, visible: true },
      ],
    });
    const sortedColumnState = () => ({
      columns: [
        { field: 'name', order: 0, visible: true },
        { field: 'id', order: 1, visible: true, sort: { direction: 'asc' as const, priority: 0 } },
      ],
    });

    interface BuildOptions {
      ds: ReturnType<typeof createDeferredDataSource>;
      serverSideFirst?: boolean;
      withColumnState?: boolean;
      withSort?: boolean;
      multiSort?: boolean;
      serverSide?: Partial<ServerSideConfig>;
    }

    function buildConfig(options: BuildOptions) {
      const {
        ds,
        serverSideFirst = false,
        withColumnState = true,
        withSort = false,
        multiSort = false,
        serverSide = {},
      } = options;
      const filtering = { trackColumnState: true };
      const server = { pageSize: PAGE_SIZE, dataSource: ds.dataSource, ...serverSide };
      const multiSortFeature = multiSort ? { multiSort: true } : {};
      return {
        columns: [
          { field: 'name', header: 'Name', filterable: true },
          { field: 'id', header: 'Id', ...(multiSort ? { sortable: true } : {}) },
        ],
        getRowId: (row: Row) => String(row.id),
        ...(withColumnState ? { columnState: withSort ? sortedColumnState() : columnState() } : {}),
        features: serverSideFirst
          ? { ...multiSortFeature, serverSide: server, filtering }
          : { ...multiSortFeature, filtering, serverSide: server },
      };
    }

    function buildGrid(options: BuildOptions) {
      const grid = document.createElement('tbw-grid') as any;
      grid.style.height = '600px';
      grid.gridConfig = buildConfig(options);
      return grid;
    }

    async function connectGrid(grid: any) {
      document.body.appendChild(grid);
      await grid.ready();
      return grid;
    }

    async function connectConfiguredGrid(options: BuildOptions) {
      return connectGrid(buildGrid(options));
    }

    async function waitForInitialRequest(ds: ReturnType<typeof createDeferredDataSource>) {
      await vi.waitFor(() => expect(ds.pending.length).toBeGreaterThan(0));
    }

    async function loadAllRows(grid: any, ds: ReturnType<typeof createDeferredDataSource>) {
      await flushAll(ds);
      await vi.waitFor(() => expect(loadedRows(grid).length).toBe(TOTAL));
    }

    const requests = (ds: ReturnType<typeof createDeferredDataSource>) =>
      ds.dataSource.getRows.mock.calls.map(([params]) => params);

    for (const serverSideFirst of [false, true]) {
      it(`sends the declared filter with block 0 (${serverSideFirst ? 'serverSide' : 'filtering'} declared first)`, async () => {
        const ds = createDeferredDataSource();
        const grid = await connectConfiguredGrid({ ds, serverSideFirst });

        await waitForInitialRequest(ds);
        expect(requests(ds)[0]).toMatchObject({
          startNode: 0,
          filterModel: { name: expect.objectContaining(NAME_FILTER) },
        });
        expect(grid.getPluginByName('filtering').getFilters()).toEqual([
          expect.objectContaining({ field: 'name', ...NAME_FILTER }),
        ]);
      });
    }

    it('never issues an unfiltered request and keeps later blocks on the same filter', async () => {
      const ds = createDeferredDataSource();
      const grid = await connectConfiguredGrid({ ds, serverSide: { maxConcurrentRequests: 1 } });
      await loadAllRows(grid, ds);
      const startNodes = requests(ds).map((p) => p.startNode);
      expect(startNodes).toContain(0);
      expect(startNodes).toContain(PAGE_SIZE);
      for (const params of requests(ds)) {
        expect(params.filterModel).toEqual({ name: expect.objectContaining(NAME_FILTER) });
      }
    });

    it('applies a columnState assigned after the grid is connected before block 0 is requested', async () => {
      const ds = createDeferredDataSource();
      const grid = document.createElement('tbw-grid') as any;
      grid.style.height = '600px';
      document.body.appendChild(grid);
      grid.gridConfig = buildConfig({ ds });
      await grid.ready();

      await waitForInitialRequest(ds);
      expect(requests(ds)).toHaveLength(1);
      expect(requests(ds)[0].filterModel).toEqual({ name: expect.objectContaining(NAME_FILTER) });
    });

    it('honours grid.applyColumnState() called before the grid connects', async () => {
      const ds = createDeferredDataSource();
      const grid = buildGrid({ ds, withColumnState: false });
      grid.applyColumnState(columnState());
      await connectGrid(grid);

      await waitForInitialRequest(ds);
      expect(requests(ds)).toHaveLength(1);
      expect(requests(ds)[0].filterModel).toEqual({ name: expect.objectContaining(NAME_FILTER) });
    });

    for (const serverSideFirst of [false, true]) {
      it(`aborts a resolving block synchronously during filter restore (${serverSideFirst ? 'serverSide' : 'filtering'} declared first)`, async () => {
        const ds = createDeferredDataSource();
        const grid = await connectConfiguredGrid({
          ds,
          withColumnState: false,
          serverSideFirst,
          serverSide: { pageSize: TOTAL },
        });
        await waitForInitialRequest(ds);
        const stale = ds.pending[0];
        const dataEvent = vi.fn((_event: Event) => undefined);
        grid.addEventListener('datasource:data', dataEvent);

        stale.resolve({ rows: [{ id: 99, name: 'stale' }], totalNodeCount: TOTAL });
        grid.applyColumnState(columnState());

        expect(stale.params.signal.aborted).toBe(true);
        await vi.waitFor(() => expect(requests(ds)).toHaveLength(2));
        expect(dataEvent).not.toHaveBeenCalled();
        expect(requests(ds)[1].filterModel).toEqual({ name: expect.objectContaining(NAME_FILTER) });

        ds.flush();
        await vi.waitFor(() => expect(dataEvent).toHaveBeenCalledTimes(1));
        const detail = (dataEvent.mock.calls[0][0] as CustomEvent<{ rows: Row[] }>).detail;
        expect(detail.rows).not.toContainEqual({ id: 99, name: 'stale' });
      });
    }

    it('drops an in-flight block when a later applyColumnState() changes the filter', async () => {
      const ds = createDeferredDataSource();
      const grid = await connectConfiguredGrid({ ds, withColumnState: false });
      await waitForInitialRequest(ds);
      const stale = ds.pending[0];
      expect(stale.params.filterModel).toBeUndefined();

      grid.applyColumnState(columnState());

      await vi.waitFor(() => expect(stale.params.signal.aborted).toBe(true));
      await loadAllRows(grid, ds);
      const afterRestore = requests(ds).slice(1);
      expect(afterRestore.length).toBeGreaterThan(0);
      for (const params of afterRestore) {
        expect(params.filterModel).toEqual({ name: expect.objectContaining(NAME_FILTER) });
      }
    });

    for (const serverSideFirst of [false, true]) {
      it(`coalesces runtime filter and sort restoration (${serverSideFirst ? 'serverSide' : 'filtering'} declared first)`, async () => {
        const ds = createDeferredDataSource();
        const grid = await connectConfiguredGrid({
          ds,
          withColumnState: false,
          multiSort: true,
          serverSideFirst,
          serverSide: { pageSize: TOTAL },
        });
        await loadAllRows(grid, ds);
        const beforeRestore = requests(ds).length;

        grid.applyColumnState({
          columns: [
            { field: 'name', order: 0, visible: true, filter: NAME_FILTER },
            { field: 'id', order: 1, visible: true, sort: { direction: 'asc', priority: 0 } },
          ],
        });

        await vi.waitFor(() => expect(requests(ds).length).toBeGreaterThan(beforeRestore));
        await new Promise((resolve) => setTimeout(resolve, 0));

        const afterRestore = requests(ds).slice(beforeRestore);
        expect(afterRestore).toHaveLength(1);
        expect(afterRestore[0]).toMatchObject({
          startNode: 0,
          filterModel: { name: expect.objectContaining(NAME_FILTER) },
          sortModel: [{ field: 'id', direction: 'asc' }],
        });
        expect(afterRestore[0].signal.aborted).toBe(false);
      });
    }

    it('does not refetch when the same columnState is re-applied', async () => {
      const ds = createDeferredDataSource();
      const grid = await connectConfiguredGrid({ ds });
      await loadAllRows(grid, ds);
      const calls = requests(ds).length;

      grid.applyColumnState(columnState());
      await new Promise((r) => setTimeout(r, 50));

      expect(requests(ds).length).toBe(calls);
    });

    it('keeps an explicit clear authoritative (the initial filter is not re-applied)', async () => {
      const ds = createDeferredDataSource();
      const grid = await connectConfiguredGrid({ ds });
      await loadAllRows(grid, ds);
      const calls = requests(ds).length;

      grid.getPluginByName('filtering').clearAllFilters();
      await loadAllRows(grid, ds);
      // A later render pass must not resurrect the declared filter.
      grid.refreshVirtualWindow?.(true);
      await new Promise((r) => setTimeout(r, 50));

      const afterClear = requests(ds).slice(calls);
      expect(afterClear.length).toBeGreaterThan(0);
      for (const params of afterClear) expect(params.filterModel).toBeUndefined();
      expect(grid.getPluginByName('filtering').getFilters()).toEqual([]);
    });

    it("keeps filterMode: 'local' local — the restored filter is never sent", async () => {
      const ds = createDeferredDataSource();
      const grid = await connectConfiguredGrid({ ds, serverSide: { filterMode: 'local' } });
      await loadAllRows(grid, ds);
      for (const params of requests(ds)) expect(params.filterModel).toBeUndefined();
    });

    it('sends a restored sort in one initial request', async () => {
      const ds = createDeferredDataSource();
      const grid = await connectConfiguredGrid({ ds, withSort: true, multiSort: true });
      expect(grid.getPluginByName('multiSort')).toBeDefined();

      await waitForInitialRequest(ds);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(requests(ds)).toHaveLength(1);
      expect(requests(ds)[0]).toMatchObject({
        startNode: 0,
        sortModel: [{ field: 'id', direction: 'asc' }],
      });
      expect(requests(ds)[0].signal.aborted).toBe(false);
    });

    it('refetches without a filter after reset and consumes the restore notification', async () => {
      const ds = createDeferredDataSource();
      const grid = await connectConfiguredGrid({ ds });
      await loadAllRows(grid, ds);
      const beforeReset = requests(ds).length;

      grid.resetColumnState();

      await vi.waitFor(() => expect(requests(ds).length).toBeGreaterThan(beforeReset));
      expect(requests(ds)[beforeReset].filterModel).toBeUndefined();
      await loadAllRows(grid, ds);
      const afterReset = requests(ds).length;

      grid.applyColumnState(columnState(null));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requests(ds)).toHaveLength(afterReset);
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
