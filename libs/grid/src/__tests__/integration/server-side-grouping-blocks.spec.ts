/**
 * Integration tests: ServerSide feeding pre-defined group definitions to GroupingRows
 * in more than one `getRows()` block (issue #538).
 *
 * Each block's definitions merge at their node offset, unloaded top-level nodes take
 * up scroll space as placeholders, and the viewport mapping reaches them so scrolling
 * requests their block — like flat ServerSide data.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/grouping-rows';
import '../../lib/features/server-side';
import type { GetChildRowsResult, GetRowsParams } from '../../lib/plugins/server-side';
import { nextFrame } from '../../../test/helpers';

const keysOf = (count: number) => Array.from({ length: count }, (_, i) => `G${i}`);

async function createGrid(
  groupCount: number,
  serverSide: Record<string, unknown>,
  groupingRows: Record<string, unknown> = {},
  getChildRows: () => Promise<GetChildRowsResult> = async () => ({ rows: [] }),
) {
  const all = keysOf(groupCount);
  const requests: string[] = [];
  const getRows = vi.fn(async ({ startNode, endNode }: GetRowsParams) => {
    requests.push(`${startNode}-${endNode}`);
    return {
      rows: all.slice(startNode, endNode).map((key) => ({ key, value: key, rowCount: 1 })),
      totalNodeCount: all.length,
    };
  });
  const childRows = vi.fn(getChildRows);
  const grid = document.createElement('tbw-grid') as any;
  grid.style.height = '600px';
  grid.gridConfig = {
    columns: [{ field: 'name', header: 'Name' }],
    features: { groupingRows, serverSide: { ...serverSide, dataSource: { getRows, getChildRows: childRows } } },
  };
  document.body.appendChild(grid);
  await grid.ready();
  const plugin = grid.getPluginByName('groupingRows');
  const serverSidePlugin = grid.getPluginByName('serverSide');
  const groupKeys = () => plugin.getGroups().map((g: { key: string }) => g.key);
  const renderedGroups = () => (grid.rows as any[]).filter((r) => r.__isGroupRow).map((r) => r.__groupKey);
  const placeholders = () => (grid.rows as any[]).filter((r) => r.__loading === true && typeof r.__index === 'number');
  return {
    grid,
    plugin,
    serverSidePlugin,
    requests,
    getRows,
    getChildRows: childRows,
    groupKeys,
    renderedGroups,
    placeholders,
  };
}

describe('ServerSide group definitions across blocks (#538)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('loads every block the viewport shows, without loadThreshold', async () => {
    const { requests, groupKeys, renderedGroups, placeholders } = await createGrid(5, { pageSize: 2 });

    await vi.waitFor(() => expect(groupKeys()).toEqual(keysOf(5)));
    expect(requests).toEqual(['0-2', '2-4', '4-6']);
    await vi.waitFor(() => expect(renderedGroups()).toEqual(keysOf(5)));
    expect(placeholders()).toHaveLength(0);
  });

  it('merges prefetched blocks instead of keeping only the last one (loadThreshold)', async () => {
    const { requests, groupKeys, renderedGroups } = await createGrid(5, { pageSize: 2, loadThreshold: 4 });

    await vi.waitFor(() => expect(requests).toHaveLength(3));
    await vi.waitFor(() => expect(groupKeys()).toEqual(keysOf(5)));
    await vi.waitFor(() => expect(renderedGroups()).toEqual(keysOf(5)));
  });

  it('renders unloaded groups as placeholders and maps the viewport past the loaded block', async () => {
    const { grid, requests, groupKeys, placeholders } = await createGrid(120, { pageSize: 50 });

    await vi.waitFor(() => expect(groupKeys()).toHaveLength(50));
    expect(requests).toEqual(['0-50']);
    expect(grid.rows).toHaveLength(120);
    expect(placeholders()).toHaveLength(70);
    expect(placeholders()[0].__index).toBe(50);
    expect(grid.query('datasource:viewport-mapping', { viewportStart: 40, viewportEnd: 80 })).toEqual([
      { startNode: 40, endNode: 81, totalLoadedNodes: 120 },
    ]);
  });

  it('keeps an expanded group loaded when a later block arrives', async () => {
    const { grid, plugin, serverSidePlugin, getChildRows, groupKeys } = await createGrid(
      120,
      { pageSize: 50 },
      {},
      async () => ({ rows: [{ name: 'member' }] }),
    );
    await vi.waitFor(() => expect(groupKeys()).toHaveLength(50));

    plugin.toggle('G0');
    await vi.waitFor(() => expect((grid.rows as any[]).some((r) => r.name === 'member')).toBe(true));
    expect(getChildRows).toHaveBeenCalledTimes(1);

    // Jump near the end (display 110 = node 109 — G0's member row shifts it) → only block 2 (100-150)
    grid._virtualization.start = 110;
    grid._virtualization.end = 121;
    serverSidePlugin['loadRequiredBlocks']();
    await vi.waitFor(() => expect(groupKeys()).toHaveLength(70));
    await nextFrame(3);

    expect(groupKeys()).toEqual([...keysOf(50), ...keysOf(120).slice(100)]);
    expect(getChildRows).toHaveBeenCalledTimes(1);
    expect((grid.rows as any[]).some((r) => r.name === 'member')).toBe(true);
    // Unloaded block 1 still takes up its 50 rows as placeholders
    expect((grid.rows as any[]).filter((r) => r.__loading === true && typeof r.__index === 'number')).toHaveLength(50);
  });

  it('refresh() starts a new generation: definitions are replaced, not merged', async () => {
    const { serverSidePlugin, getRows, groupKeys } = await createGrid(120, { pageSize: 50 });
    await vi.waitFor(() => expect(groupKeys()).toHaveLength(50));

    getRows.mockImplementation(async ({ startNode, endNode }: GetRowsParams) => ({
      rows: keysOf(3)
        .slice(startNode, endNode)
        .map((key) => ({ key, value: key, rowCount: 1 })),
      totalNodeCount: 3,
    }));
    serverSidePlugin.refresh();
    await vi.waitFor(() => expect(groupKeys()).toEqual(keysOf(3)));
  });

  it('defaultExpanded: true opens and fetches a never-seen block after refresh() (PR #540)', async () => {
    const { grid, plugin, serverSidePlugin, getChildRows, groupKeys } = await createGrid(
      120,
      { pageSize: 50 },
      { defaultExpanded: true },
      async () => ({ rows: [] }),
    );
    await vi.waitFor(() => expect(groupKeys()).toHaveLength(50));
    await vi.waitFor(() => expect(plugin.isExpanded('G0')).toBe(true));

    serverSidePlugin.refresh();
    await vi.waitFor(() => expect(groupKeys()).toHaveLength(50));
    await nextFrame(3);

    // Jump to block 2 (100-150), never shown before
    grid._virtualization.start = 115;
    grid._virtualization.end = 120;
    serverSidePlugin['loadRequiredBlocks']();
    await vi.waitFor(() => expect(groupKeys()).toContain('G110'));
    await vi.waitFor(() => expect(plugin.isExpanded('G110')).toBe(true));
    await vi.waitFor(() =>
      expect(getChildRows.mock.calls.some((c: any[]) => c[0].context.groupKey === 'G110')).toBe(true),
    );
  });

  it('numeric defaultExpanded waits for the blocks before its index when blocks land out of order (PR #540)', async () => {
    const { grid, plugin, serverSidePlugin, groupKeys } = await createGrid(
      120,
      { pageSize: 50 },
      { defaultExpanded: 51 },
    );
    await vi.waitFor(() => expect(groupKeys()).toHaveLength(50));

    // Block 2 (100-150) lands before block 1 (50-100)
    grid._virtualization.start = 110;
    grid._virtualization.end = 120;
    serverSidePlugin['loadRequiredBlocks']();
    await vi.waitFor(() => expect(groupKeys()).toContain('G110'));
    await nextFrame(3);
    expect(plugin.isExpanded('G101')).toBe(false);

    grid._virtualization.start = 55;
    grid._virtualization.end = 60;
    serverSidePlugin['loadRequiredBlocks']();
    await vi.waitFor(() => expect(groupKeys()).toHaveLength(120));
    await vi.waitFor(() => expect(plugin.isExpanded('G51')).toBe(true));
    expect(plugin.isExpanded('G101')).toBe(false);
  });

  it('purgeCache() after several infinite-scroll blocks leaves no stale groups (PR #540)', async () => {
    const all = keysOf(100);
    const grid = document.createElement('tbw-grid') as any;
    grid.style.height = '600px';
    grid.gridConfig = {
      columns: [{ field: 'name', header: 'Name' }],
      features: {
        groupingRows: {},
        serverSide: {
          pageSize: 5,
          loadThreshold: 12,
          dataSource: {
            getRows: async ({ startNode, endNode }: GetRowsParams) => ({
              rows: all.slice(startNode, endNode).map((key) => ({ key, value: key, rowCount: 1 })),
              totalNodeCount: -1,
            }),
            getChildRows: async () => ({ rows: [] }),
          },
        },
      },
    };
    document.body.appendChild(grid);
    await grid.ready();
    const plugin = grid.getPluginByName('groupingRows');
    const serverSidePlugin = grid.getPluginByName('serverSide');
    await vi.waitFor(() => expect(plugin.getGroups().length).toBeGreaterThan(5));

    serverSidePlugin.purgeCache();
    serverSidePlugin['requestRender']();
    await vi.waitFor(() => expect((grid.rows as any[]).some((r) => r.__isGroupRow)).toBe(false));
    expect((grid.rows as any[]).every((r) => r.__loading === true && typeof r.__index === 'number')).toBe(true);
  });
});
