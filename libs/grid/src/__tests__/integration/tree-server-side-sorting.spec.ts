/**
 * Integration tests: TreePlugin + ServerSidePlugin sorting (issue #524).
 *
 * - `sortMode: 'server'` (default): the data source sorts roots (`getRows`) and lazy
 *   children (`getChildRows`); Tree must keep that order instead of re-sorting levels.
 * - `sortMode: 'local'`: Tree sorts the loaded levels itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/multi-sort';
import '../../lib/features/server-side';
import '../../lib/features/tree';
import type { GetChildRowsParams, GetRowsParams, ServerSideConfig } from '../../lib/plugins/server-side';

interface Row {
  id: number;
  name: string;
  children?: Row[] | boolean;
}

/**
 * Data source that ignores `sortModel` and always returns ascending ids — standing in
 * for a server whose ordering the grid cannot reproduce. Names run opposite to ids so
 * a local sort on either column visibly reorders the rows.
 */
function createDataSource(lazy: boolean) {
  const getRows = vi.fn(async (_params: GetRowsParams) => ({
    rows: [0, 1, 2].map((id): Row => ({
      id,
      name: `n${9 - id}`,
      children: lazy ? true : [{ id: id * 10 + 100, name: 'c' }],
    })),
    totalNodeCount: 3,
  }));
  const getChildRows = vi.fn(async (_params: GetChildRowsParams) => ({
    rows: [100, 101, 102].map((id): Row => ({ id, name: `c${9 - (id - 100)}` })),
  }));
  return { getRows, getChildRows };
}

async function createGrid(options: { multiSort?: boolean; lazy?: boolean; serverSide?: Partial<ServerSideConfig> }) {
  const dataSource = createDataSource(options.lazy ?? false);
  const grid = document.createElement('tbw-grid') as any;
  grid.style.height = '600px';
  grid.gridConfig = {
    columns: [
      { field: 'name', header: 'Name', sortable: true },
      { field: 'id', header: 'Id', sortable: true },
    ],
    getRowId: (row: Row) => String(row.id),
    features: {
      ...(options.multiSort ? { multiSort: true } : {}),
      tree: true,
      serverSide: { pageSize: 5, dataSource, ...options.serverSide },
    },
  };
  document.body.appendChild(grid);
  await grid.ready();
  await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 2]));
  return { grid, dataSource };
}

const ids = (grid: any) => (grid.rows as Row[]).map((r) => r.id);

/**
 * Run `trigger`, then wait until the refetched roots are rendered. `getRows` builds new
 * row objects per call, so none of the previously shown rows may remain — asserting the
 * order earlier would pass vacuously against the pre-refetch rows.
 */
async function refetch(grid: any, trigger: () => void) {
  const before = new Set(grid.rows as Row[]);
  trigger();
  await vi.waitFor(() => expect((grid.rows as Row[]).some((r) => before.has(r))).toBe(false));
}

describe('Tree + ServerSide sorting (#524)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe("sortMode: 'server' (default)", () => {
    it('keeps the data source root order after a MultiSort refetch', async () => {
      const { grid, dataSource } = await createGrid({ multiSort: true });

      await refetch(grid, () => grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'desc' }]));

      expect(dataSource.getRows.mock.calls.at(-1)![0].sortModel).toEqual([{ field: 'id', direction: 'desc' }]);
      expect(ids(grid)).toEqual([0, 1, 2]);
    });

    it("keeps the data source root order after Tree's own header sort (no MultiSort)", async () => {
      const { grid, dataSource } = await createGrid({});

      await refetch(grid, () =>
        grid.getPluginByName('tree').onHeaderClick({ column: { field: 'name', sortable: true } }),
      );

      expect(dataSource.getRows.mock.calls.at(-1)![0].sortModel).toEqual([{ field: 'name', direction: 'asc' }]);
      expect(ids(grid)).toEqual([0, 1, 2]);
    });

    it('sends the sort model to getChildRows and keeps lazy children in arrival order', async () => {
      const { grid, dataSource } = await createGrid({ multiSort: true, lazy: true });
      await refetch(grid, () => grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'desc' }]));

      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));

      expect(dataSource.getChildRows.mock.calls[0][0].sortModel).toEqual([{ field: 'id', direction: 'desc' }]);
    });
  });

  describe("sortMode: 'local'", () => {
    it('sorts the loaded roots locally without sending sortModel', async () => {
      const { grid, dataSource } = await createGrid({ multiSort: true, serverSide: { sortMode: 'local' } });
      const calls = dataSource.getRows.mock.calls.length;

      grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'desc' }]);

      await vi.waitFor(() => expect(ids(grid)).toEqual([2, 1, 0]));
      expect(dataSource.getRows.mock.calls.length).toBe(calls);
    });
  });
});
