/**
 * Integration tests: UndoRedo targets the edited row by identity, not display index (#526).
 *
 * An `EditAction` used to be resolved as `this.rows[action.rowIndex]` — the CURRENTLY
 * displayed rows. Once a filter/sort changed the view between the edit and the undo/redo,
 * the stored index pointed at nothing (silent no-op) or at a different row (data corruption).
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

async function createGrid(features: Record<string, unknown> = {}) {
  const grid = document.createElement('tbw-grid') as any;
  grid.gridConfig = {
    columns: [
      { field: 'id', header: 'Id', sortable: true },
      { field: 'active', header: 'Active', type: 'boolean', editable: true },
    ],
    getRowId: (row: Row) => String(row.id),
    features: { filtering: true, multiSort: true, editing: true, undoRedo: true, ...features },
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

/** Space-toggle the `active` cell of the row at display index `rowIndex` (Editing's real commit path). */
const toggleActive = (grid: any, rowIndex: number) => {
  grid._focusRow = rowIndex;
  grid._focusCol = 1;
  grid.getPluginByName('editing').onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
};

const filterActive = (grid: any) =>
  grid.getPluginByName('filtering').setFilter('active', { type: 'boolean', operator: 'equals', value: true });

describe('UndoRedo resolves actions by row id (#526)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('records the row id on auto-recorded edits', async () => {
    const grid = await createGrid();
    toggleActive(grid, 2);
    await vi.waitFor(() => expect(grid.getRow('3')?.active).toBe(true));

    expect(grid.getPluginByName('undoRedo').getUndoStack()[0]).toMatchObject({ rowId: '3', field: 'active' });
  });

  it('redo re-applies to a row that the undo filtered out of the view (issue repro)', async () => {
    const grid = await createGrid();
    const undoRedo = grid.getPluginByName('undoRedo');

    toggleActive(grid, 2); // row 3: false → true, no filter
    await vi.waitFor(() => expect(grid.getRow('3')?.active).toBe(true));
    filterActive(grid);
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2, 3]));

    undoRedo.undo(); // row 3 → false, filtered out
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));

    undoRedo.redo(); // row 3 → true, re-appears (was a no-op: rows[2] is undefined)
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2, 3]));
    expect(grid.sourceRows.find((r: Row) => r.id === 3).active).toBe(true);
  });

  it('undo reverts the edited row, not the row that took over its display index', async () => {
    const grid = await createGrid();
    const undoRedo = grid.getPluginByName('undoRedo');
    filterActive(grid);
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));

    toggleActive(grid, 0); // row 1: true → false, filtered out; view = [2]
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([2]));

    undoRedo.undo(); // must restore row 1, NOT write `true` into row 2 (now at index 0)
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));
    const source = grid.sourceRows as Row[];
    expect(source.find((r) => r.id === 1)?.active).toBe(true);
    expect(source.find((r) => r.id === 2)?.active).toBe(true);
  });

  it('undo after a sort reverts the edited row and focuses its new position', async () => {
    const grid = await createGrid({ filtering: false });
    const undoRedo = grid.getPluginByName('undoRedo');

    toggleActive(grid, 0); // row 1: true → false
    await vi.waitFor(() => expect(grid.getRow('1')?.active).toBe(false));

    grid.sort('id', 'desc'); // view = [4, 3, 2, 1]; index 0 is now row 4
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([4, 3, 2, 1]));

    undoRedo.undo();
    await vi.waitFor(() => expect(grid.getRow('1')?.active).toBe(true));
    expect(grid.getRow('4')?.active).toBe(false);
    await vi.waitFor(() => expect(grid._focusRow).toBe(3));
  });

  it('undo that re-admits a filtered-out row focuses its post-render position', async () => {
    const grid = await createGrid({ multiSort: false });
    const undoRedo = grid.getPluginByName('undoRedo');
    filterActive(grid);
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));

    toggleActive(grid, 0); // row 1: true → false, filtered out; view = [2]
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([2]));
    grid._focusRow = 0;
    grid._focusCol = 0; // the undo must move focus to the `active` column (1)

    undoRedo.undo(); // row 1 is NOT in the view until the re-filter runs
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([1, 2]));
    await vi.waitFor(() => expect([grid._focusRow, grid._focusCol]).toEqual([0, 1]));
  });

  it('undo of an edit on a since-deleted row is a silent no-op', async () => {
    const grid = await createGrid({ filtering: false, multiSort: false });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    toggleActive(grid, 0);
    await vi.waitFor(() => expect(grid.getRow('1')?.active).toBe(false));
    grid.rows = grid.sourceRows.filter((r: Row) => r.id !== 1);
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([2, 3, 4]));

    expect(grid.getPluginByName('undoRedo').undo()).not.toBeNull();
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('TBW041'));
    warn.mockRestore();
  });

  it('a cascaded recordEdit() resolves its row id from the display index at record time', async () => {
    const grid = await createGrid({ filtering: false });
    const undoRedo = grid.getPluginByName('undoRedo');

    undoRedo.recordEdit(1, 'active', true, false); // row 2 at display index 1
    grid.sourceRows.find((r: Row) => r.id === 2).active = false;
    expect(undoRedo.getUndoStack()[0]).toMatchObject({ rowId: '2', rowIndex: 1 });

    grid.sort('id', 'desc'); // row 2 moves to index 2; index 1 is row 3
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([4, 3, 2, 1]));

    undoRedo.undo();
    await vi.waitFor(() => expect(grid.getRow('2')?.active).toBe(true));
    expect(grid.getRow('3')?.active).toBe(false);
  });

  it('dirty tracking re-evaluates the edited row (by id) on keyboard undo after a sort', async () => {
    const grid = await createGrid({ filtering: false, editing: { dirtyTracking: true } });
    toggleActive(grid, 0); // row 1: true → false (dirty)
    await vi.waitFor(() => expect(grid.getRow('1')?.active).toBe(false));
    grid.sort('id', 'desc'); // index 0 is now row 4
    await vi.waitFor(() => expect(visibleIds(grid)).toEqual([4, 3, 2, 1]));

    const dirtyEvents: Array<{ rowId: string; type: string }> = [];
    grid.addEventListener('dirty-change', (e: CustomEvent) => dirtyEvents.push(e.detail));
    grid.getPluginByName('undoRedo').onKeyDown(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));

    await vi.waitFor(() => expect(grid.getRow('1')?.active).toBe(true));
    expect(dirtyEvents.map((d) => d.rowId)).not.toContain('4');
    expect(dirtyEvents.at(-1)).toMatchObject({ rowId: '1', type: 'pristine' });
  });
});

describe('row-ID map tracks direct _rows reassignment', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('_getRowEntry reports the current index after a core sort and after clearing it', async () => {
    const grid = await createGrid({ filtering: false, multiSort: false, undoRedo: false });
    expect(grid._getRowEntry('1')?.index).toBe(0); // primes the lazy map

    grid.sort('id', 'desc'); // fast path reassigns _rows directly
    expect(visibleIds(grid)).toEqual([4, 3, 2, 1]);
    expect(grid._getRowEntry('1')?.index).toBe(3);

    grid.sort(null);
    expect(visibleIds(grid)).toEqual([1, 2, 3, 4]);
    expect(grid._getRowEntry('1')?.index).toBe(0);
  });
});
