/**
 * @vitest-environment happy-dom
 *
 * Composition of TreePlugin + GroupingRowsPlugin through the HierarchyPlugin (#504).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeaderClickEvent } from '../../core/plugin/types';
import { GroupingRowsPlugin } from '../grouping-rows/grouping-rows-plugin';
import type { GroupingRowsConfig } from '../grouping-rows/types';
import { TreePlugin } from '../tree/tree-plugin';
import { HierarchyPlugin } from './hierarchy-plugin';

import '../../../index';
import type { ColumnConfig, GridElement } from '../../../public';

async function waitUpgrade(el: GridElement): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready();
  await new Promise((r) => requestAnimationFrame(r));
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

/** Delivery plans (tree) whose children are grouped by kind. */
function plans() {
  return [
    {
      id: 'p1',
      name: 'Plan 1',
      children: [
        { id: 'p1-a', name: 'Cargo A', kind: 'Cargo' },
        { id: 'p1-b', name: 'Deal B', kind: 'Deal' },
        { id: 'p1-c', name: 'Cargo C', kind: 'Cargo' },
      ],
    },
    { id: 'p2', name: 'Plan 2', children: [{ id: 'p2-a', name: 'Deal A', kind: 'Deal' }] },
  ];
}

async function setup(
  grouping: GroupingRowsConfig,
  rows: unknown[] = plans(),
  columns: ColumnConfig[] = [{ field: 'name', header: 'Name' }],
) {
  const grid = document.createElement('tbw-grid') as GridElement;
  document.body.appendChild(grid);
  grid.gridConfig = {
    columns,
    plugins: [new TreePlugin({ defaultExpanded: true }), new GroupingRowsPlugin(grouping)],
  };
  grid.rows = rows;
  await waitUpgrade(grid);
  return grid;
}

/** `name` of data rows, `[group value]` of group rows, in render order. */
function labels(grid: GridElement): string[] {
  return (grid.rows as Array<Record<string, unknown>>).map((r) =>
    r.__isGroupRow ? `[${String(r.__groupValue)}]` : String(r.name),
  );
}

describe('hierarchy: Tree + GroupingRows', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('auto-attaches one HierarchyPlugin and warns about no incompatibility', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const grid = await setup({ groupOn: (row, { depth }) => (depth > 0 ? row.kind : null) });

    const names = (grid._pluginManager?.getPlugins() ?? []).map((p) => p.name);
    expect(names.filter((n) => n === 'hierarchy')).toHaveLength(1);
    expect(names.indexOf('hierarchy')).toBeLessThan(names.indexOf('tree'));
    expect(grid.getPluginByName('hierarchy')).toBeInstanceOf(HierarchyPlugin);
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/incompatible/i);
  });

  it('groups the children of each tree node, leaving the root level ungrouped', async () => {
    const grid = await setup({
      groupOn: (row, { depth }) => (depth > 0 ? row.kind : null),
      defaultExpanded: true,
    });

    expect(labels(grid)).toEqual([
      'Plan 1',
      '[Cargo]',
      'Cargo A',
      'Cargo C',
      '[Deal]',
      'Deal B',
      'Plan 2',
      '[Deal]',
      'Deal A',
    ]);
  });

  it('passes the tree parent and depth to groupOn and keys nested groups per parent', async () => {
    const calls: Array<[string | null, number]> = [];
    const grid = await setup({
      groupOn: (row, { parent, depth }) => {
        calls.push([parent?.id ?? null, depth]);
        return depth > 0 ? row.kind : null;
      },
      defaultExpanded: true,
    });

    expect(calls).toContainEqual([null, 0]);
    expect(calls).toContainEqual(['p1', 1]);
    expect(calls).toContainEqual(['p2', 1]);
    const groupKeys = (grid.rows as Array<Record<string, unknown>>)
      .filter((r) => r.__isGroupRow)
      .map((r) => r.__groupKey);
    expect(groupKeys).toEqual(['p1::Cargo', 'p1::Deal', 'p2::Deal']);
  });

  it('announces structural depth through aria-level on tree, group and grouped rows', async () => {
    const grid = await setup({
      groupOn: (row, { depth }) => (depth > 0 ? row.kind : null),
      defaultExpanded: true,
    });

    const levels = Array.from(grid.querySelectorAll('.rows .data-grid-row')).map((el) => el.getAttribute('aria-level'));
    // Plan 1, [Cargo], Cargo A, Cargo C, [Deal], Deal B, Plan 2, [Deal], Deal A
    expect(levels).toEqual(['1', '2', '3', '3', '2', '3', '1', '2', '3']);
    expect(grid.querySelector('.rows-body')?.getAttribute('role')).toBe('treegrid');

    const tree = grid.getPluginByName('tree');
    // Tree indents grouped children by their structural depth.
    expect(tree?.getRowMeta(grid.rows[2] as Record<string, unknown>)?.depth).toBe(2);
  });

  it('collapses a nested group without touching the tree expansion', async () => {
    const grid = await setup({
      groupOn: (row, { depth }) => (depth > 0 ? row.kind : null),
      defaultExpanded: true,
    });

    grid.getPluginByName('groupingRows')?.toggle('p1::Cargo');
    await nextFrame();

    expect(labels(grid)).toEqual(['Plan 1', '[Cargo]', '[Deal]', 'Deal B', 'Plan 2', '[Deal]', 'Deal A']);
    expect(grid.getPluginByName('tree')?.isExpanded('p1')).toBe(true);
  });

  it('applies setGroupOn(fn, true) to nested groups seen in an earlier grouping', async () => {
    const byKind = (row: Record<string, unknown>, { depth }: { depth: number }) => (depth > 0 ? row.kind : null);
    const grid = await setup({ groupOn: byKind, defaultExpanded: true });
    const grouping = grid.getPluginByName('groupingRows');
    const expanded = labels(grid);

    grouping?.setGroupOn(() => null, true);
    await nextFrame();
    grouping?.setGroupOn(byKind, true);
    await nextFrame();

    expect(labels(grid)).toEqual(expanded);
  });

  it('applies accordion only at the depths the predicate selects', async () => {
    const grid = await setup({
      groupOn: (row, { depth }) => (depth > 0 ? row.kind : null),
      accordion: (depth) => depth === 1,
    });
    const grouping = grid.getPluginByName('groupingRows');

    grouping?.toggle('p1::Cargo');
    await nextFrame();
    grouping?.toggle('p1::Deal');
    await nextFrame();

    expect(grouping?.getExpandedGroups()).toEqual(['p1::Deal']);
  });

  it('keeps standalone Tree output unchanged when grouping is inactive', async () => {
    const grid = await setup({ groupOn: () => null });

    expect(labels(grid)).toEqual(['Plan 1', 'Cargo A', 'Deal B', 'Cargo C', 'Plan 2', 'Deal A']);
    expect(grid.getPluginByName('groupingRows')?.isGroupingActive()).toBe(false);
  });

  it('maps viewport rows to tree roots across interleaved group headers', async () => {
    const grid = await setup({ groupOn: (row, { depth }) => (depth > 0 ? row.kind : null), defaultExpanded: true });
    // Plan 1, [Cargo], Cargo A, Cargo C, [Deal], Deal B, Plan 2, [Deal], Deal A
    const map = (viewportStart: number, viewportEnd: number) =>
      grid
        .getPluginByName('tree')
        ?.handleQuery({ type: 'datasource:viewport-mapping', context: { viewportStart, viewportEnd } });

    expect(map(4, 5)).toEqual({ startNode: 0, endNode: 1, totalLoadedNodes: 2 });
    expect(map(4, 7)).toEqual({ startNode: 0, endNode: 2, totalLoadedNodes: 2 });
  });

  it('sorts nested groups from a header click when only child levels are grouped', async () => {
    const grid = await setup(
      { groupOn: (row, { depth }) => (depth > 0 ? row.kind : null), defaultExpanded: true },
      plans(),
      [
        { field: 'name', header: 'Name' },
        { field: 'kind', header: 'Kind', sortable: true },
      ],
    );
    const grouping = grid.getPluginByName('groupingRows');
    expect(grouping?.handleQuery({ type: 'grouping:get-grouped-fields', context: null })).toEqual(['kind']);

    const column = { field: 'kind', sortable: true };
    expect(grouping?.onHeaderClick({ field: 'kind', column } as HeaderClickEvent)).toBe(true);
    await nextFrame();

    expect(labels(grid).slice(0, 6)).toEqual(['Plan 1', '[Deal]', 'Deal B', '[Cargo]', 'Cargo A', 'Cargo C']);
  });
});

describe('hierarchy: ARIA when nothing is hierarchical', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const items = () => [
    { id: 1, name: 'A', kind: 'Cargo' },
    { id: 2, name: 'B', kind: 'Deal' },
  ];

  async function groupingGrid(groupOn: GroupingRowsConfig['groupOn']) {
    const grid = document.createElement('tbw-grid') as GridElement;
    document.body.appendChild(grid);
    grid.gridConfig = {
      columns: [{ field: 'name', header: 'Name' }],
      plugins: [new GroupingRowsPlugin({ groupOn, defaultExpanded: true })],
    };
    grid.rows = items();
    await waitUpgrade(grid);
    return grid;
  }

  const rowEls = (grid: GridElement) => Array.from(grid.querySelectorAll('.rows .data-grid-row'));
  const hasPosition = (el: Element) =>
    el.hasAttribute('aria-level') || el.hasAttribute('aria-setsize') || el.hasAttribute('aria-posinset');

  it('announces a flat grid when groupOn groups no row', async () => {
    const grid = await groupingGrid(() => null);

    expect(grid.querySelector('.rows-body')?.getAttribute('role')).toBe('grid');
    expect(rowEls(grid).some(hasPosition)).toBe(false);
    expect(grid.getPluginByName('hierarchy')?.getRowMeta(grid.rows[0])).toBeUndefined();
  });

  it('clears pooled row positions when grouping turns off', async () => {
    const grid = await groupingGrid((row) => row.kind);
    expect(rowEls(grid).every(hasPosition)).toBe(true);

    grid.getPluginByName('groupingRows')?.setGroupOn(() => null);
    await nextFrame();
    await nextFrame();

    expect(rowEls(grid).length).toBeGreaterThan(0);
    expect(rowEls(grid).some(hasPosition)).toBe(false);
    expect(grid.querySelector('.rows-body')?.getAttribute('role')).toBe('grid');
  });
});
