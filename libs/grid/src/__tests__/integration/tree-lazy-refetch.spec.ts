/**
 * Integration tests: expanded lazy tree nodes after their root rows are replaced (issue #527).
 *
 * A ServerSide refetch (server sort change, `refresh()`) or a `grid.rows` reassignment
 * delivers NEW row objects for the same keys. A node that stays expanded must re-fetch its
 * lazy children for the new row object instead of rendering expanded with no children.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/multi-sort';
import '../../lib/features/server-side';
import '../../lib/features/tree';
import type { GetChildRowsParams, GetChildRowsResult, GetRowsParams } from '../../lib/plugins/server-side';
import type { TreeLoadChildrenParams } from '../../lib/plugins/tree';

interface Row {
  id: number;
  name: string;
  children?: Row[] | boolean;
}

const roots = (): Row[] => [0, 1, 2].map((id) => ({ id, name: `n${id}`, children: true }));
const kids = (): Row[] => [100, 101, 102].map((id) => ({ id, name: 'c' }));
const ids = (grid: any) => (grid.rows as Row[]).map((r) => r.id);
const nextFrames = async (n = 3) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(undefined)));
};

/** `getRows` builds new row objects on every call, like any real server. */
async function createServerGrid(getChildRows: (params: GetChildRowsParams) => Promise<GetChildRowsResult>) {
  const getRows = vi.fn(async (_params: GetRowsParams) => ({ rows: roots(), totalNodeCount: 3 }));
  const childRows = vi.fn(getChildRows);
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
      tree: true,
      serverSide: { pageSize: 5, dataSource: { getRows, getChildRows: childRows } },
    },
  };
  document.body.appendChild(grid);
  await grid.ready();
  await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 2]));
  return { grid, getRows, getChildRows: childRows };
}

/** Run `trigger`, then wait until none of the previously shown root objects remain. */
async function refetch(grid: any, trigger: () => void) {
  const before = new Set(grid.rows as Row[]);
  trigger();
  await vi.waitFor(() => expect((grid.rows as Row[]).some((r) => before.has(r))).toBe(false));
}

describe('Tree lazy children after root rows are replaced (#527)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('ServerSide', () => {
    it('re-fetches children of an expanded node after a server sort refetch, with the new sortModel', async () => {
      const { grid, getChildRows } = await createServerGrid(async () => ({ rows: kids() }));
      const tree = grid.getPluginByName('tree');
      tree.expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      expect(getChildRows).toHaveBeenCalledTimes(1);

      await refetch(grid, () => grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'desc' }]));

      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      expect(getChildRows).toHaveBeenCalledTimes(2);
      expect(getChildRows.mock.calls[1][0].sortModel).toEqual([{ field: 'id', direction: 'desc' }]);
      expect(getChildRows.mock.calls[1][0].context.parentNode).toBe(grid.rows[0]);
      expect(tree.isExpanded('0')).toBe(true);
    });

    it('re-fetches children of an expanded node after refresh()', async () => {
      const { grid, getChildRows } = await createServerGrid(async () => ({ rows: kids() }));
      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));

      await refetch(grid, () => grid.getPluginByName('serverSide').refresh());

      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      expect(getChildRows).toHaveBeenCalledTimes(2);
    });

    it('does not re-fetch on collapse → re-expand of the same row object', async () => {
      const { grid, getChildRows } = await createServerGrid(async () => ({ rows: kids() }));
      const tree = grid.getPluginByName('tree');
      tree.expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));

      tree.collapse('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 2]));
      tree.expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      await nextFrames();

      expect(getChildRows).toHaveBeenCalledTimes(1);
    });

    it('cancels a superseded in-flight load: aborts it, reports cancelled, never merges its stale result', async () => {
      let resolveFirst!: (result: GetChildRowsResult) => void;
      let call = 0;
      const { grid, getChildRows } = await createServerGrid(() => {
        call++;
        if (call === 1) return new Promise((resolve) => (resolveFirst = resolve));
        return Promise.resolve({ rows: kids() });
      });
      const ends: any[] = [];
      const starts: any[] = [];
      grid.addEventListener('tree-load-start', (e: CustomEvent) => starts.push(e.detail));
      grid.addEventListener('tree-load-end', (e: CustomEvent) => ends.push(e.detail));
      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(getChildRows).toHaveBeenCalledTimes(1));
      const oldRoot = grid.rows[0];

      await refetch(grid, () => grid.getPluginByName('multiSort').setSortModel([{ field: 'id', direction: 'desc' }]));

      // Superseded as soon as the new root renders — no waiting for the stale response.
      await vi.waitFor(() => expect(getChildRows).toHaveBeenCalledTimes(2));
      expect(getChildRows.mock.calls[0][0].signal.aborted).toBe(true);
      expect(getChildRows.mock.calls[1][0].sortModel).toEqual([{ field: 'id', direction: 'desc' }]);
      expect(ends[0]).toMatchObject({ key: '0', row: oldRoot, childCount: 0, cancelled: true });

      resolveFirst({ rows: [{ id: 999, name: 'stale' }] });
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      await nextFrames();

      expect(oldRoot.children).toBe(true);
      expect(starts).toHaveLength(2);
      expect(ends).toHaveLength(2);
      expect(ends[1]).toMatchObject({ key: '0', row: grid.rows[0], childCount: 3 });
      expect(ends[1].cancelled).toBeUndefined();
    });

    it('tries a failing automatic re-fetch once, and retries on manual re-expand', async () => {
      let call = 0;
      const { grid, getChildRows } = await createServerGrid(async () => {
        call++;
        if (call === 2) throw new Error('server exploded');
        return { rows: kids() };
      });
      const tree = grid.getPluginByName('tree');
      tree.expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));

      await refetch(grid, () => grid.getPluginByName('serverSide').refresh());
      await vi.waitFor(() => expect(getChildRows).toHaveBeenCalledTimes(2));
      await nextFrames(5);
      expect(getChildRows).toHaveBeenCalledTimes(2);
      expect(ids(grid)).toEqual([0, 1, 2]);

      tree.toggle('0');
      tree.toggle('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      expect(getChildRows).toHaveBeenCalledTimes(3);
    });
  });

  describe('local loadChildren', () => {
    async function createLocalGrid() {
      const loadChildren = vi.fn(async (_params: TreeLoadChildrenParams) => kids());
      const grid = document.createElement('tbw-grid') as any;
      grid.style.height = '600px';
      grid.gridConfig = {
        columns: [{ field: 'name', header: 'Name' }],
        getRowId: (row: Row) => String(row.id),
        features: { tree: { loadChildren } },
      };
      document.body.appendChild(grid);
      await grid.ready();
      return { grid, loadChildren };
    }

    it('re-fetches children of an expanded node after grid.rows is replaced with new objects', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      grid.rows = roots();
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 2]));
      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));

      grid.rows = roots();

      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      expect(loadChildren.mock.calls[1][0].row).toBe(grid.rows[0]);
    });

    it('fetches children for a node expanded before its row existed', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      grid.getPluginByName('tree').expand('1');

      grid.rows = roots();

      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 100, 101, 102, 2]));
      expect(loadChildren).toHaveBeenCalledTimes(1);
    });

    it('aborts a pending loadChildren signal when its row is replaced, and reports it cancelled', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      let resolveFirst!: (rows: Row[]) => void;
      loadChildren.mockImplementationOnce(() => new Promise<Row[]>((resolve) => (resolveFirst = resolve)));
      const ends: any[] = [];
      grid.addEventListener('tree-load-end', (e: CustomEvent) => ends.push(e.detail));
      grid.rows = roots();
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 2]));
      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(1));
      const oldRoot = grid.rows[0];

      grid.rows = roots();

      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      expect(loadChildren.mock.calls[0][0].signal.aborted).toBe(true);
      expect(ends[0]).toMatchObject({ key: '0', row: oldRoot, childCount: 0, cancelled: true });

      resolveFirst([{ id: 999, name: 'stale' }]);
      await nextFrames();
      expect(oldRoot.children).toBe(true);
      expect(ends).toHaveLength(2);
    });

    it('reloads a restored row whose load was cancelled (A → B → A), still dropping stale results', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      const pending: Array<(rows: Row[]) => void> = [];
      loadChildren.mockImplementation(() => new Promise<Row[]>((resolve) => pending.push(resolve)));
      const rowsA = roots();
      grid.rows = rowsA;
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 2]));
      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(1));

      grid.rows = roots(); // B supersedes A
      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(2));
      grid.rows = rowsA; // A restored while B is still loading

      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(3));
      expect(loadChildren.mock.calls[2][0].row).toBe(rowsA[0]);
      expect(loadChildren.mock.calls[1][0].signal.aborted).toBe(true);

      pending[0]([{ id: 998, name: 'stale A' }]); // A's first (aborted) request
      pending[1]([{ id: 999, name: 'stale B' }]); // B's (aborted) request
      pending[2](kids());
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
    });

    it('cancels a pending load when the replacement row embeds its children, and rejects the late result', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      let resolveFirst!: (rows: Row[]) => void;
      loadChildren.mockImplementationOnce(() => new Promise<Row[]>((resolve) => (resolveFirst = resolve)));
      const ends: any[] = [];
      grid.addEventListener('tree-load-end', (e: CustomEvent) => ends.push(e.detail));
      const rowsA = roots();
      grid.rows = rowsA;
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 2]));
      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(1));

      const rowsB = roots();
      rowsB[0].children = [{ id: 200, name: 'embedded' }];
      grid.rows = rowsB;

      await vi.waitFor(() =>
        expect(ends[0]).toMatchObject({ key: '0', row: rowsA[0], childCount: 0, cancelled: true }),
      );
      expect(loadChildren.mock.calls[0][0].signal.aborted).toBe(true);
      expect(ids(grid)).toEqual([0, 200, 1, 2]);

      resolveFirst([{ id: 999, name: 'stale' }]);
      await nextFrames();
      expect(rowsA[0].children).toBe(true);
      expect(ends).toHaveLength(1);

      grid.rows = rowsA; // restored A reloads instead of exposing stale children
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102, 1, 2]));
      expect(loadChildren).toHaveBeenCalledTimes(2);
      expect(loadChildren.mock.calls[1][0].row).toBe(rowsA[0]);
    });

    it('cancels the load of a collapsed node whose row is replaced, without requesting for the new row', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      loadChildren.mockImplementationOnce(() => new Promise<Row[]>(() => undefined));
      const ends: any[] = [];
      grid.addEventListener('tree-load-end', (e: CustomEvent) => ends.push(e.detail));
      grid.rows = roots();
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 1, 2]));
      const tree = grid.getPluginByName('tree');
      tree.expand('0');
      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(1));
      tree.collapse('0');

      grid.rows = roots();

      await vi.waitFor(() => expect(ends[0]).toMatchObject({ key: '0', cancelled: true }));
      expect(loadChildren.mock.calls[0][0].signal.aborted).toBe(true);
      await nextFrames();
      expect(loadChildren).toHaveBeenCalledTimes(1);
    });

    it('keeps the load of a node hidden under a collapsed ancestor', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      let resolveFirst!: (rows: Row[]) => void;
      loadChildren.mockImplementationOnce(() => new Promise<Row[]>((resolve) => (resolveFirst = resolve)));
      const ends: any[] = [];
      grid.addEventListener('tree-load-end', (e: CustomEvent) => ends.push(e.detail));
      grid.rows = [{ id: 0, name: 'root', children: [{ id: 10, name: 'lazy', children: true }] }];
      const tree = grid.getPluginByName('tree');
      tree.expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 10]));
      tree.expand('10');
      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(1));

      tree.collapse('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0]));
      await nextFrames();
      expect(loadChildren.mock.calls[0][0].signal.aborted).toBe(false);

      resolveFirst(kids());
      await vi.waitFor(() => expect(ends[0]).toMatchObject({ key: '10', childCount: 3 }));
      expect(ends[0].cancelled).toBeUndefined();
      tree.expand('0');
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 10, 100, 101, 102]));
    });

    it('cancels a pending load when the only lazy root is replaced by flat data with the same key', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      let resolveFirst!: (rows: Row[]) => void;
      loadChildren.mockImplementationOnce(() => new Promise<Row[]>((resolve) => (resolveFirst = resolve)));
      const ends: any[] = [];
      grid.addEventListener('tree-load-end', (e: CustomEvent) => ends.push(e.detail));
      const rootA: Row = { id: 0, name: 'A', children: true };
      grid.rows = [rootA];
      await vi.waitFor(() => expect(ids(grid)).toEqual([0]));
      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(1));

      grid.rows = [{ id: 0, name: 'B', children: [] }]; // not a tree any more

      await vi.waitFor(() => expect(ends[0]).toMatchObject({ key: '0', row: rootA, childCount: 0, cancelled: true }));
      expect(loadChildren.mock.calls[0][0].signal.aborted).toBe(true);

      resolveFirst([{ id: 999, name: 'stale' }]);
      await nextFrames();
      expect(rootA.children).toBe(true);
      expect(ends).toHaveLength(1);

      grid.rows = [rootA]; // restored A fetches again instead of exposing stale children
      await vi.waitFor(() => expect(ids(grid)).toEqual([0, 100, 101, 102]));
      expect(loadChildren).toHaveBeenCalledTimes(2);
    });

    it('does not let a loading placeholder in flat data cancel a pending load with the same key', async () => {
      const { grid, loadChildren } = await createLocalGrid();
      let resolveFirst!: (rows: Row[]) => void;
      loadChildren.mockImplementationOnce(() => new Promise<Row[]>((resolve) => (resolveFirst = resolve)));
      const ends: any[] = [];
      grid.addEventListener('tree-load-end', (e: CustomEvent) => ends.push(e.detail));
      grid.rows = [{ id: 0, name: 'A', children: true }];
      await vi.waitFor(() => expect(ids(grid)).toEqual([0]));
      grid.getPluginByName('tree').expand('0');
      await vi.waitFor(() => expect(loadChildren).toHaveBeenCalledTimes(1));

      grid.rows = [{ __loading: true, __index: 0 }]; // path key '0', not a replacement row
      await nextFrames();
      expect(loadChildren.mock.calls[0][0].signal.aborted).toBe(false);

      resolveFirst(kids());
      await vi.waitFor(() => expect(ends[0]).toMatchObject({ key: '0', childCount: 3 }));
      expect(ends[0].cancelled).toBeUndefined();
    });
  });
});
