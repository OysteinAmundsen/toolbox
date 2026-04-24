/**
 * Integration tests: row-mutation APIs (`updateRow`, `updateRows`,
 * EditingPlugin commits) + TreePlugin.
 *
 * Regression guard for the bug where TreePlugin's `processRows` spread/cloned
 * every row to attach decoration fields (`__treeKey`, `__treeDepth`, ...). That
 * made `_rows[i] !== sourceRows[i]`, so `updateRow(s)` mutations were applied
 * to the clone and lost the next time `processRows` produced fresh clones
 * (e.g. after a filter / sort).
 *
 * INVARIANT being asserted: TreePlugin's output rows must be `===` the user's
 * source row references, so mutations made via `updateRow(s)` survive any
 * subsequent ROWS-phase rebuild.
 */
import { afterEach, describe, expect, it } from 'vitest';

import '../../index';
import type { GridConfig } from '../../lib/core/types';
import '../../lib/features/editing';
import '../../lib/features/filtering';
import '../../lib/features/tree';

interface TreeTestRow {
  id: string;
  name: string;
  status: string;
  children?: TreeTestRow[];
}

async function createGrid(rows: TreeTestRow[], config?: Partial<GridConfig<TreeTestRow>>) {
  const grid = document.createElement('tbw-grid') as any;
  if (config) grid.gridConfig = config;
  grid.rows = rows;
  document.body.appendChild(grid);
  await grid.ready();
  return grid;
}

describe('updateRows + TreePlugin', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('preserves source row identity through processRows', async () => {
    const child = { id: 'c1', name: 'Child', status: 'active' };
    const parent: TreeTestRow = { id: 'p1', name: 'Parent', status: 'active', children: [child] };
    const rows: TreeTestRow[] = [parent];

    const grid = await createGrid(rows, {
      features: { tree: { defaultExpanded: true } } as any,
      columns: [{ field: 'name' }, { field: 'status' }],
    });

    // _rows must hold the user's source object refs, not clones.
    expect(grid._rows[0]).toBe(parent);
    expect(grid._rows[1]).toBe(child);
  });

  it('updateRow mutation survives subsequent ROWS-phase rebuild (filter)', async () => {
    const child = { id: 'c1', name: 'Child', status: 'active' };
    const parent: TreeTestRow = { id: 'p1', name: 'Parent', status: 'active', children: [child] };
    const rows: TreeTestRow[] = [parent];

    const grid = await createGrid(rows, {
      features: {
        tree: { defaultExpanded: true },
        filtering: true,
      } as any,
      columns: [{ field: 'name' }, { field: 'status' }],
    });

    grid.updateRow('p1', { status: 'shipped' });

    // Mutation lands on the source object, not a clone.
    expect(parent.status).toBe('shipped');
    expect(grid._rows[0]).toBe(parent);
    expect((grid._rows[0] as TreeTestRow).status).toBe('shipped');

    // Trigger a ROWS-phase rebuild via filter (anything that goes through
    // processRows again would have produced fresh clones in the old impl).
    const filteringPlugin = grid.getPluginByName?.('filtering') ?? grid.getPluginByName?.('FilteringPlugin');
    if (filteringPlugin && typeof filteringPlugin.setFilter === 'function') {
      filteringPlugin.setFilter('name', { value: 'P' });
    } else {
      // Fallback: reassign rows to force a rebuild
      grid.rows = [...rows];
    }
    // `grid.ready()` resolves once after the initial render, so it does NOT
    // await the post-filter rebuild. Wait for an animation frame so the
    // scheduler can flush the ROWS-phase pass triggered above.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    // Mutation survives the rebuild.
    expect((grid._rows[0] as TreeTestRow).status).toBe('shipped');
    expect(grid._rows[0]).toBe(parent);
  });

  it('cell-change event carries the source row reference', async () => {
    const child = { id: 'c1', name: 'Child', status: 'active' };
    const parent: TreeTestRow = { id: 'p1', name: 'Parent', status: 'active', children: [child] };
    const rows: TreeTestRow[] = [parent];

    const grid = await createGrid(rows, {
      features: { tree: { defaultExpanded: true } } as any,
      columns: [{ field: 'name' }, { field: 'status' }],
    });

    const events: any[] = [];
    grid.on('cell-change', (detail: any) => events.push(detail));

    grid.updateRow('c1', { status: 'shipped' });

    expect(events).toHaveLength(1);
    // The row carried in cell-change must be the source row, not a clone.
    expect(events[0].row).toBe(child);
    expect(child.status).toBe('shipped');
  });

  it('updateRows on multiple tree rows mutates source objects', async () => {
    const c1 = { id: 'c1', name: 'A', status: 'active' };
    const c2 = { id: 'c2', name: 'B', status: 'active' };
    const p1: TreeTestRow = { id: 'p1', name: 'P1', status: 'active', children: [c1] };
    const p2: TreeTestRow = { id: 'p2', name: 'P2', status: 'active', children: [c2] };
    const rows: TreeTestRow[] = [p1, p2];

    const grid = await createGrid(rows, {
      features: { tree: { defaultExpanded: true } } as any,
      columns: [{ field: 'name' }, { field: 'status' }],
    });

    grid.updateRows([
      { id: 'p1', changes: { status: 'shipped' } },
      { id: 'c2', changes: { status: 'shipped' } },
    ]);

    expect(p1.status).toBe('shipped');
    expect(c2.status).toBe('shipped');
    expect(c1.status).toBe('active'); // untouched
    expect(p2.status).toBe('active'); // untouched

    // Identity invariant after the update.
    expect(grid._rows[0]).toBe(p1);
    expect(grid._rows[1]).toBe(c1);
    expect(grid._rows[2]).toBe(p2);
    expect(grid._rows[3]).toBe(c2);
  });
});
