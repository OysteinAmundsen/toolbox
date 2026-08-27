/**
 * Integration tests: TreePlugin column decoration when rows arrive
 * asynchronously.
 *
 * Regression guard for the bug where `processColumns` bailed out while
 * `flattenedRows` was still empty and nothing ever re-ran the COLUMNS phase
 * afterwards. Rows assigned after the first render (async fetch, or a
 * ServerSidePlugin block landing) produced a flat grid with no expand toggles,
 * even though `processRows` had flattened the hierarchy correctly.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/tree';

interface Node {
  id: string;
  name: string;
  children?: Node[];
}

const TREE: Node[] = [{ id: 'p1', name: 'Parent', children: [{ id: 'c1', name: 'Child' }] }];

async function createEmptyTreeGrid() {
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = {
    columns: [{ field: 'name', header: 'Name' }],
    features: { tree: { childrenField: 'children' } },
  };
  document.body.appendChild(grid);
  await grid.ready();
  return grid;
}

const toggleCount = (grid: HTMLElement) => grid.querySelectorAll('.tree-toggle').length;

describe('TreePlugin — rows assigned after the first render', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('decorates the tree column once tree data arrives', async () => {
    const grid = await createEmptyTreeGrid();
    expect(toggleCount(grid)).toBe(0);

    grid.rows = TREE;

    await vi.waitFor(() => expect(toggleCount(grid)).toBe(1));
    expect(grid.querySelector('.tree-cell-wrapper')).not.toBeNull();
  });

  it('removes the decoration when the data stops being a tree', async () => {
    const grid = await createEmptyTreeGrid();

    grid.rows = TREE;
    await vi.waitFor(() => expect(toggleCount(grid)).toBe(1));

    grid.rows = [{ id: 'flat', name: 'Flat' }];

    await vi.waitFor(() => expect(grid.querySelector('.tree-cell-wrapper')).toBeNull());
    expect(toggleCount(grid)).toBe(0);
  });

  it('keeps the decoration across expand/collapse', async () => {
    const grid = await createEmptyTreeGrid();
    grid.rows = TREE;
    await vi.waitFor(() => expect(toggleCount(grid)).toBe(1));

    grid.getPluginByName('tree').toggle('p1');

    await vi.waitFor(() => expect(grid.rows.length).toBe(2));
    expect(toggleCount(grid)).toBe(1);
  });
});
