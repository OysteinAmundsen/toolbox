/**
 * Integration tests: GroupingRows / MasterDetail child requests through a real
 * ServerSidePlugin (issues #531, #532, #534).
 *
 * A failing `getChildRows()` must release the requester's loading state and
 * surface a plugin-level error event; the requester's `FetchChildrenQuery.signal`
 * must cancel superseded requests so stale rows never land.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/grouping-rows';
import '../../lib/features/master-detail';
import '../../lib/features/server-side';
import type { GetChildRowsParams, GetChildRowsResult } from '../../lib/plugins/server-side';

const nextFrames = async (n = 3) => {
  for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r(undefined)));
};

async function mount(gridConfig: Record<string, unknown>) {
  const grid = document.createElement('tbw-grid') as any;
  grid.style.height = '600px';
  grid.gridConfig = gridConfig;
  document.body.appendChild(grid);
  await grid.ready();
  return grid;
}

describe('ServerSide child requests from GroupingRows / MasterDetail (#531)', () => {
  beforeEach(() => {
    // ServerSide reports every failed getChildRows() as TBW141 — expected here.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('MasterDetail', () => {
    async function createGrid(getChildRows: (p: GetChildRowsParams) => Promise<GetChildRowsResult>) {
      const childRows = vi.fn(getChildRows);
      const grid = await mount({
        columns: [{ field: 'name', header: 'Name' }],
        features: {
          masterDetail: { detailRenderer: () => '<div class="detail">Detail</div>' },
          serverSide: {
            dataSource: {
              getRows: async () => ({ rows: [{ id: 1, name: 'Alice' }], totalNodeCount: 1 }),
              getChildRows: childRows,
            },
          },
        },
      });
      await vi.waitFor(() => expect(grid.rows[0]?.name).toBe('Alice'));
      return { grid, plugin: grid.getPluginByName('masterDetail'), getChildRows: childRows };
    }

    it('releases the loading state and emits detail-load-error when getChildRows rejects', async () => {
      const error = new Error('detail failed');
      const { grid, plugin, getChildRows } = await createGrid(async () => {
        throw error;
      });
      const errors: any[] = [];
      grid.addEventListener('detail-load-error', (e: Event) => errors.push((e as CustomEvent).detail));

      plugin['toggleAndEmit'](grid.rows[0], 0);
      expect(plugin.isDetailLoading(0)).toBe(true);

      await vi.waitFor(() => expect(errors).toHaveLength(1));
      expect(errors[0]).toMatchObject({ rowIndex: 0, row: grid.rows[0], error });
      expect(plugin.isDetailLoading(0)).toBe(false);
      expect(plugin.isExpanded(0)).toBe(true);

      // Collapse + re-expand retries
      plugin['toggleAndEmit'](grid.rows[0], 0);
      plugin['toggleAndEmit'](grid.rows[0], 0);
      expect(getChildRows).toHaveBeenCalledTimes(2);
    });

    it('aborts getChildRows when the row is collapsed and drops its result', async () => {
      let release!: (r: GetChildRowsResult) => void;
      const { grid, plugin, getChildRows } = await createGrid(
        () => new Promise<GetChildRowsResult>((r) => (release = r)),
      );

      plugin['toggleAndEmit'](grid.rows[0], 0);
      const { signal } = getChildRows.mock.calls[0][0];
      plugin['toggleAndEmit'](grid.rows[0], 0);
      expect(signal.aborted).toBe(true);

      release({ rows: [{ id: 10 }] });
      await nextFrames();
      expect(plugin.getDetailData(0)).toBeUndefined();
    });

    it('fetches detail data on programmatic expand() (#532)', async () => {
      const { grid, plugin, getChildRows } = await createGrid(async () => ({ rows: [{ id: 10 }] }));

      plugin.expand(0);
      expect(getChildRows).toHaveBeenCalledTimes(1);
      expect(getChildRows.mock.calls[0][0].context).toMatchObject({ source: 'master-detail', row: grid.rows[0] });
      expect(plugin.isDetailLoading(0)).toBe(true);

      await vi.waitFor(() => expect(plugin.getDetailData(0)).toEqual([{ id: 10 }]));
      expect(plugin.isDetailLoading(0)).toBe(false);
    });
  });

  describe('GroupingRows (pre-defined groups)', () => {
    async function createGrid(
      getChildRows: (p: GetChildRowsParams) => Promise<GetChildRowsResult>,
      groupingRows: Record<string, unknown> = {},
    ) {
      const childRows = vi.fn(getChildRows);
      const getRows = vi.fn(async () => ({
        rows: [
          { key: 'A', value: 'Group A', rowCount: 2 },
          { key: 'B', value: 'Group B', rowCount: 2 },
        ],
        totalNodeCount: 2,
      }));
      const grid = await mount({
        columns: [{ field: 'name', header: 'Name' }],
        features: {
          groupingRows,
          serverSide: { dataSource: { getRows, getChildRows: childRows } },
        },
      });
      const plugin = grid.getPluginByName('groupingRows');
      await vi.waitFor(() => expect(plugin.getGroups()).toHaveLength(2));
      return { grid, plugin, getRows, getChildRows: childRows };
    }
    const hasPlaceholder = (grid: any) => (grid.rows as any[]).some((r) => r.__loading);

    it('releases the loading state and emits group-load-error when getChildRows rejects', async () => {
      const error = new Error('group failed');
      const { grid, plugin, getChildRows } = await createGrid(async () => {
        throw error;
      });
      const errors: any[] = [];
      grid.addEventListener('group-load-error', (e: Event) => errors.push((e as CustomEvent).detail));

      plugin.toggle('A');
      await vi.waitFor(() => expect(errors).toHaveLength(1));
      expect(errors[0]).toEqual({ groupKey: 'A', groupPath: ['A'], error });
      await vi.waitFor(() => expect(hasPlaceholder(grid)).toBe(false));
      expect(plugin.isExpanded('A')).toBe(true);

      plugin.toggle('A');
      plugin.toggle('A');
      expect(getChildRows).toHaveBeenCalledTimes(2);
    });

    it('aborts an in-flight getChildRows on refresh(), re-requests the expanded group, and drops stale rows', async () => {
      const releases: Array<(r: GetChildRowsResult) => void> = [];
      const { grid, plugin, getRows, getChildRows } = await createGrid(
        () => new Promise<GetChildRowsResult>((r) => releases.push(r)),
      );
      const names = () => (grid.rows as any[]).map((r) => r.name).filter(Boolean);

      plugin.toggle('A');
      await vi.waitFor(() => expect(hasPlaceholder(grid)).toBe(true));
      const { signal } = getChildRows.mock.calls[0][0];

      grid.getPluginByName('serverSide').refresh();
      await vi.waitFor(() => expect(getRows).toHaveBeenCalledTimes(2));
      await vi.waitFor(() => expect(signal.aborted).toBe(true));

      // Recovery: the still-expanded group is re-requested and keeps its loading state.
      await vi.waitFor(() => expect(getChildRows).toHaveBeenCalledTimes(2));
      expect(getChildRows.mock.calls[1][0].context.groupKey).toBe('A');
      expect(getChildRows.mock.calls[1][0].signal.aborted).toBe(false);
      await vi.waitFor(() => expect(hasPlaceholder(grid)).toBe(true));
      expect(plugin.isExpanded('A')).toBe(true);

      releases[0]({ rows: [{ name: 'stale' }] });
      releases[1]({ rows: [{ name: 'fresh' }] });
      await vi.waitFor(() => expect(names()).toEqual(['fresh']));
      expect(hasPlaceholder(grid)).toBe(false);
    });

    it('re-requests the rows of a loaded expanded group after refresh()', async () => {
      let call = 0;
      const { grid, plugin, getChildRows } = await createGrid(async () => ({ rows: [{ name: `v${++call}` }] }));
      const names = () => (grid.rows as any[]).map((r) => r.name).filter(Boolean);

      plugin.toggle('A');
      await vi.waitFor(() => expect(names()).toEqual(['v1']));

      grid.getPluginByName('serverSide').refresh();
      await vi.waitFor(() => expect(names()).toEqual(['v2']));
      expect(getChildRows).toHaveBeenCalledTimes(2);
      expect(plugin.isExpanded('A')).toBe(true);
    });

    it('fetches the rows of groups opened by defaultExpanded (#534)', async () => {
      const { grid, getChildRows } = await createGrid(async (p) => ({ rows: [{ name: `${p.context.groupKey}1` }] }), {
        defaultExpanded: true,
      });
      const names = () => (grid.rows as any[]).map((r) => r.name).filter(Boolean);

      await vi.waitFor(() => expect(names()).toEqual(['A1', 'B1']));
      expect(getChildRows).toHaveBeenCalledTimes(2);
      expect(hasPlaceholder(grid)).toBe(false);
    });

    it('fetches the rows of groups opened by expandAll() (#534)', async () => {
      const { grid, plugin, getChildRows } = await createGrid(async (p) => ({
        rows: [{ name: `${p.context.groupKey}1` }],
      }));
      const names = () => (grid.rows as any[]).map((r) => r.name).filter(Boolean);

      plugin.expandAll();
      await vi.waitFor(() => expect(names()).toEqual(['A1', 'B1']));
      expect(getChildRows).toHaveBeenCalledTimes(2);
    });
  });
});
