/**
 * Integration tests: FilteringPlugin re-filters after an in-place edit (PR #525).
 *
 * The core hands the consumer's `rows` array to the first plugin unchanged while no
 * core sort is active, and MultiSort passes its input through when it has no model —
 * so an edit (which mutates a row in place) leaves Filtering's input reference
 * unchanged. Its input-identity cache must still be dropped, or a row that no longer
 * matches the filter stays visible. Covers commits, undo/redo (`updateRow(…, 'history')`,
 * which skips `cell-edit-committed`) and dirty-tracking rollback (`revertRow`/`revertAll`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import '../../index';
import '../../lib/features/editing';
import '../../lib/features/filtering';
import '../../lib/features/multi-sort';
import '../../lib/features/undo-redo';

interface Row {
  id: number;
  active: boolean;
}

async function createGrid(features: Record<string, unknown>) {
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = {
    columns: [
      { field: 'id', header: 'Id' },
      { field: 'active', header: 'Active', type: 'boolean', editable: true },
    ],
    getRowId: (row: Row) => String(row.id),
    features,
  };
  grid.rows = [
    { id: 1, active: true },
    { id: 2, active: true },
    { id: 3, active: false },
    { id: 4, active: false }, // always filtered out, so a filtered view is distinguishable from an unfiltered one
  ];
  document.body.appendChild(grid);
  await grid.ready();
  return grid;
}

const visibleIds = (grid: any) => (grid._rows as Row[]).map((r) => r.id);

describe('Filtering re-filters after an in-place edit', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['Filtering only', { filtering: true, editing: true }],
    ['MultiSort before Filtering', { multiSort: true, filtering: true, editing: true }],
    ['Filtering before MultiSort', { filtering: true, multiSort: true, editing: true }],
  ])('drops a row that no longer matches after a Space toggle (%s)', async (_label, features) => {
    const grid = await createGrid(features);
    grid.getPluginByName('filtering').setFilter('active', { type: 'boolean', operator: 'equals', value: true });
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));

    // Space on a boolean cell: Editing commits in place, then requests a ROWS render.
    grid._focusRow = 0;
    grid._focusCol = 1;
    grid.getPluginByName('editing').onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));

    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([2]));
  });

  /** Space-toggle the `active` cell of the row at display index `rowIndex` (Editing's real commit path). */
  const toggleActive = (grid: any, rowIndex: number) => {
    grid._focusRow = rowIndex;
    grid._focusCol = 1;
    grid.getPluginByName('editing').onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
  };

  /** Toggle row 3 false → true, then filter `active = true` (row 4 stays out) so the edited row is visible and cached. */
  async function editThenFilter(features: Record<string, unknown>) {
    const grid = await createGrid({ multiSort: true, filtering: true, ...features });
    toggleActive(grid, 2);
    await vi.waitFor(() => expect(grid.getRow('3')?.active).toBe(true));
    grid.getPluginByName('filtering').setFilter('active', { type: 'boolean', operator: 'equals', value: true });
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2, 3]));
    return grid;
  }

  it('re-filters after undo (history path skips cell-edit-committed)', async () => {
    const grid = await editThenFilter({ editing: true, undoRedo: true });

    grid.getPluginByName('undoRedo').undo();
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));
  });

  it('re-filters after redo (history path skips cell-edit-committed)', async () => {
    const grid = await createGrid({ multiSort: true, filtering: true, editing: true, undoRedo: true });
    const undoRedo = grid.getPluginByName('undoRedo');
    toggleActive(grid, 0); // row 1: true → false
    await vi.waitFor(() => expect(grid.getRow('1')?.active).toBe(false));
    undoRedo.undo(); // row 1 back to true, before any filter
    await vi.waitFor(() => expect(grid.getRow('1')?.active).toBe(true));
    grid.getPluginByName('filtering').setFilter('active', { type: 'boolean', operator: 'equals', value: true });
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));

    undoRedo.redo(); // row 1 → false via updateRow(…, 'history')
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([2]));
  });

  it.each([
    ['revertRow', (editing: any) => editing.revertRow('3')],
    ['revertAll', (editing: any) => editing.revertAll()],
  ])('re-filters after %s rolls the row back', async (_label, revert) => {
    const grid = await editThenFilter({ editing: { dirtyTracking: true } });

    revert(grid.getPluginByName('editing'));
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));
  });

  it('a rollback does not add an undo history entry', async () => {
    const grid = await editThenFilter({ editing: { dirtyTracking: true }, undoRedo: true });
    const undoRedo = grid.getPluginByName('undoRedo');
    expect(undoRedo.getUndoStack()).toHaveLength(1);

    grid.getPluginByName('editing').revertRow('3');
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));
    expect(undoRedo.getUndoStack()).toHaveLength(1);
  });
});
