/**
 * Integration tests: GroupingRows / MasterDetail child requests through a real
 * ServerSidePlugin (issues #531, #532, #534, #535).
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
import '../../lib/features/tree';
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

  describe('MasterDetail expandAll() with loading placeholders (#535)', () => {
    async function createGrid() {
      const pending = new Map<number, (r: { rows: unknown[]; totalNodeCount: number }) => void>();
      const rendered: any[] = [];
      const getChildRows = vi.fn(async (_p: GetChildRowsParams): Promise<GetChildRowsResult> => ({ rows: [] }));
      const grid = await mount({
        columns: [{ field: 'name', header: 'Name' }],
        features: {
          masterDetail: { detailRenderer: (row: unknown) => (rendered.push(row), '<div>d</div>') },
          serverSide: {
            pageSize: 2,
            maxConcurrentRequests: 4,
            dataSource: {
              getRows: (p: { startNode: number }) =>
                p.startNode === 0
                  ? Promise.resolve({
                      rows: [
                        { id: 1, name: 'A' },
                        { id: 2, name: 'B' },
                      ],
                      totalNodeCount: 10,
                    })
                  : new Promise((r) => pending.set(p.startNode, r)),
              getChildRows,
            },
          },
        },
      });
      await vi.waitFor(() => expect(grid.rows[0]?.name).toBe('A'));
      await vi.waitFor(() => expect(pending.has(2)).toBe(true));
      const deliver = (startNode: number) =>
        pending.get(startNode)!({
          rows: [
            { id: startNode + 1, name: `R${startNode + 1}` },
            { id: startNode + 2, name: `R${startNode + 2}` },
          ],
          totalNodeCount: 10,
        });
      return { grid, plugin: grid.getPluginByName('masterDetail'), rendered, getChildRows, deliver };
    }

    it('never expands loading placeholders or passes them to detailRenderer', async () => {
      const { grid, plugin, rendered } = await createGrid();
      expect((grid.rows as any[]).filter((r) => r.__loading)).toHaveLength(8);

      plugin.expandAll();
      await nextFrames();

      expect(rendered.filter((r) => r.__loading)).toHaveLength(0);
      expect(rendered.map((r) => r.name)).toEqual(['A', 'B']);
      expect(plugin.getExpandedRows()).toEqual([0, 1]);
    });

    it('expands rows that arrive after expandAll() and fetches their detail with the display rowIndex', async () => {
      const { grid, plugin, rendered, getChildRows, deliver } = await createGrid();
      plugin.expandAll();
      await nextFrames();
      expect(getChildRows).toHaveBeenCalledTimes(2);

      deliver(2);
      await vi.waitFor(() => expect(grid.rows[2]?.name).toBe('R3'));
      await nextFrames();

      expect(plugin.isExpanded(2)).toBe(true);
      expect(plugin.isExpanded(3)).toBe(true);
      expect(rendered.filter((r) => r.__loading)).toHaveLength(0);
      expect(rendered.map((r) => r.name)).toEqual(expect.arrayContaining(['R3', 'R4']));
      const indices = getChildRows.mock.calls.map(([p]) => p.context.rowIndex);
      expect(indices).toEqual([0, 1, 2, 3]);
    });

    it('stops expanding arriving rows after collapseAll()', async () => {
      const { grid, plugin, rendered, deliver } = await createGrid();
      plugin.expandAll();
      await nextFrames();
      plugin.collapseAll();

      deliver(2);
      await vi.waitFor(() => expect(grid.rows[2]?.name).toBe('R3'));
      await nextFrames();

      expect(plugin.getExpandedRows()).toEqual([]);
      expect(rendered.map((r) => r.name)).not.toContain('R3');
    });
  });

  describe('MasterDetail expandAll() with Tree + ServerSide (#535)', () => {
    it('expands embedded descendants Tree flattens from a ServerSide block', async () => {
      const rendered: any[] = [];
      let release!: (r: { rows: unknown[]; totalNodeCount: number }) => void;
      const grid = await mount({
        columns: [{ field: 'name', header: 'Name' }],
        features: {
          tree: { childrenField: 'children', defaultExpanded: true },
          masterDetail: { detailRenderer: (row: any) => (rendered.push(row), '<div>d</div>') },
          serverSide: {
            dataSource: { getRows: () => new Promise((r) => (release = r)) },
          },
        },
      });
      const plugin = grid.getPluginByName('masterDetail');

      // expandAll() runs before the first response — only placeholders exist.
      plugin.expandAll();
      await nextFrames();
      expect(rendered).toHaveLength(0);

      release({
        rows: [{ id: 'p1', name: 'Parent', children: [{ id: 'c1', name: 'Child' }] }],
        totalNodeCount: 1,
      });
      await vi.waitFor(() => expect((grid.rows as any[]).map((r) => r.name)).toEqual(['Parent', 'Child']));
      await nextFrames();

      expect(plugin.isExpanded(0)).toBe(true);
      expect(plugin.isExpanded(1)).toBe(true);
      expect(plugin.getExpandedRows()).toEqual([0, 1]);
      expect(rendered.map((r) => r.name)).toEqual(expect.arrayContaining(['Parent', 'Child']));
    });
  });

  describe('MasterDetail expandAll() with a getRows-only source (#539)', () => {
    async function createGrid() {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const state = { generation: 0 };
      const grid = await mount({
        columns: [{ field: 'name', header: 'Name' }],
        features: {
          masterDetail: { detailRenderer: () => '<div>d</div>' },
          serverSide: {
            pageSize: 2,
            dataSource: {
              // No getChildRows — the detail fetch cannot be served.
              getRows: async () => ({
                rows: [
                  { id: 1, name: `A${state.generation}` },
                  { id: 2, name: `B${state.generation}` },
                ],
                totalNodeCount: 2,
              }),
            },
          },
        },
      });
      await vi.waitFor(() => expect(grid.rows[0]?.name).toBe('A0'));
      return { grid, plugin: grid.getPluginByName('masterDetail'), state, warn };
    }

    it('does not accumulate pending detail loads across block replacements', async () => {
      const { grid, plugin, state, warn } = await createGrid();
      const serverSide = grid.getPluginByName('serverSide');

      plugin.expandAll();
      await nextFrames();
      expect(plugin.isDetailLoading(0)).toBe(false);

      for (state.generation = 1; state.generation <= 5; state.generation++) {
        serverSide.refresh();
        await vi.waitFor(() => expect(grid.rows[0]?.name).toBe(`A${state.generation}`));
        await nextFrames();
      }

      // Each unsupported request settles through datasource:error, so no row
      // object is stranded in the pending-load collections.
      expect(plugin['detailLoads'].size).toBe(0);
      expect(plugin.isDetailLoading(0)).toBe(false);
      expect(warn).toHaveBeenCalled();
    });

    it('honours collapse() called from the synchronous detail-load-error listener', async () => {
      const { grid, plugin } = await createGrid();
      grid.addEventListener('detail-load-error', (e: Event) => {
        if ((e as CustomEvent).detail.rowIndex === 0) plugin.collapse(0);
      });

      plugin.expandAll();
      await nextFrames();

      expect(plugin.isExpanded(0)).toBe(false);
      expect(plugin.isExpanded(1)).toBe(true);
      expect(plugin.getExpandedRows()).toEqual([1]);
    });

    it('honours collapseAll() called from the synchronous detail-load-error listener', async () => {
      const { grid, plugin } = await createGrid();
      grid.addEventListener('detail-load-error', () => plugin.collapseAll());

      plugin.expandAll();
      await nextFrames();

      expect(plugin.getExpandedRows()).toEqual([]);
      expect(plugin.isExpanded(0)).toBe(false);
      expect(plugin.isExpanded(1)).toBe(false);
    });

    it('fires detail-expand before detail-load-error on an expander click', async () => {
      const { grid } = await createGrid();
      const order: string[] = [];
      // The handler pair documented on the MasterDetail page: the error marker
      // must survive, so the error may not precede its own expand event.
      const failed = new WeakSet<object>();
      grid.addEventListener('detail-load-error', (e: Event) => {
        order.push('error');
        failed.add((e as CustomEvent).detail.row);
      });
      grid.addEventListener('detail-expand', (e: Event) => {
        const { expanded, row } = (e as CustomEvent).detail;
        order.push(`expand:${expanded}`);
        if (expanded) failed.delete(row);
      });

      grid.querySelector<HTMLElement>('.master-detail-toggle')!.click();
      await nextFrames();

      expect(order).toEqual(['expand:true', 'error']);
      expect(failed.has(grid.rows[0])).toBe(true);
    });

    it('skips the detail request when a detail-expand listener collapses the row', async () => {
      const { grid, plugin } = await createGrid();
      const errors: number[] = [];
      grid.addEventListener('detail-load-error', (e: Event) => errors.push((e as CustomEvent).detail.rowIndex));
      grid.addEventListener('detail-expand', (e: Event) => {
        const { expanded, rowIndex } = (e as CustomEvent).detail;
        if (expanded) plugin.collapse(rowIndex);
      });

      grid.querySelector<HTMLElement>('.master-detail-toggle')!.click();
      await nextFrames();

      expect(plugin.isExpanded(0)).toBe(false);
      expect(errors).toEqual([]);
      expect(plugin['detailLoads'].size).toBe(0);
    });

    it('renders no detail panel when the render-time fetch collapses a late-arriving row', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const rendered: any[] = [];
      let release!: (r: { rows: unknown[]; totalNodeCount: number }) => void;
      const grid = await mount({
        columns: [{ field: 'name', header: 'Name' }],
        features: {
          masterDetail: { detailRenderer: (row: any) => (rendered.push(row), '<div>d</div>') },
          serverSide: {
            pageSize: 2,
            dataSource: {
              getRows: (p: { startNode: number }) =>
                p.startNode === 0
                  ? Promise.resolve({
                      rows: [
                        { id: 1, name: 'A' },
                        { id: 2, name: 'B' },
                      ],
                      totalNodeCount: 4,
                    })
                  : new Promise((r) => (release = r)),
            },
          },
        },
      });
      await vi.waitFor(() => expect(grid.rows[0]?.name).toBe('A'));
      const plugin = grid.getPluginByName('masterDetail');

      plugin.expandAll();
      await nextFrames();
      rendered.length = 0;

      // Collapse only the rows that arrive later, from inside the sync error.
      grid.addEventListener('detail-load-error', (e: Event) => {
        const { rowIndex } = (e as CustomEvent).detail;
        if (rowIndex >= 2) plugin.collapse(rowIndex);
      });

      await vi.waitFor(() => expect(release).toBeDefined());
      release({
        rows: [
          { id: 3, name: 'C' },
          { id: 4, name: 'D' },
        ],
        totalNodeCount: 4,
      });
      await vi.waitFor(() => expect(grid.rows[2]?.name).toBe('C'));
      await nextFrames();

      expect(plugin.isExpanded(2)).toBe(false);
      expect(rendered.map((r) => r.name)).not.toContain('C');
      expect(plugin['detailElements'].has(grid.rows[2])).toBe(false);
      const rowEl = grid.querySelector('.cell[data-row="2"]')?.closest('.data-grid-row');
      expect(rowEl?.classList.contains('tbw-row-expanded')).toBe(false);
    });
  });

  describe('MasterDetail expandAll() with deferred child responses (#539)', () => {
    it('aborts and drops pending detail loads whose master rows were discarded', async () => {
      const state = { generation: 0 };
      const signals: AbortSignal[] = [];
      const grid = await mount({
        columns: [{ field: 'name', header: 'Name' }],
        features: {
          masterDetail: { detailRenderer: () => '<div>d</div>' },
          serverSide: {
            pageSize: 2,
            dataSource: {
              getRows: async () => ({
                rows: [
                  { id: 1, name: `A${state.generation}` },
                  { id: 2, name: `B${state.generation}` },
                ],
                totalNodeCount: 2,
              }),
              // Never settles, so the request outlives the row that asked for it.
              getChildRows: (p: GetChildRowsParams) => {
                if (p.signal) signals.push(p.signal);
                return new Promise<GetChildRowsResult>(() => undefined);
              },
            },
          },
        },
      });
      await vi.waitFor(() => expect(grid.rows[0]?.name).toBe('A0'));
      const plugin = grid.getPluginByName('masterDetail');
      const serverSide = grid.getPluginByName('serverSide');

      plugin.expandAll();
      await nextFrames();
      expect(plugin['detailLoads'].size).toBe(2);

      for (state.generation = 1; state.generation <= 5; state.generation++) {
        serverSide.refresh();
        await vi.waitFor(() => expect(grid.rows[0]?.name).toBe(`A${state.generation}`));
        await nextFrames();
        expect(plugin['detailLoads'].size).toBeLessThanOrEqual(2);
        expect(serverSide['childControllers'].size).toBeLessThanOrEqual(2);
      }

      // Only the rows currently in the row model hold a pending request.
      expect([...plugin['detailLoads'].keys()]).toEqual([grid.rows[0], grid.rows[1]]);
      expect([0, 1].map((i) => plugin.isDetailLoading(i))).toEqual([true, true]);
      expect(signals.filter((s) => s.aborted)).toHaveLength(10);
      // ServerSide untracks aborted requests without waiting for them to settle.
      expect(serverSide['childControllers'].size).toBe(2);
    });
  });
});
