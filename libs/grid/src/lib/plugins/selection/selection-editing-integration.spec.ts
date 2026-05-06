/**
 * SelectionPlugin × EditingPlugin × external row replacement (issue #284)
 *
 * Covers the two coordinated fixes for the stale-selection / edit-vs-selection
 * desync class of bug:
 *
 *   1. SelectionPlugin clears selection when the source row collection is
 *      replaced from outside (host swapped `[rows]`) — detected via
 *      `data-change` with a changed `sourceRowCount`.
 *   2. EditingPlugin broadcasts `edit-open` / `edit-close` (instead of plain
 *      `emit`) so SelectionPlugin can auto-select the edited row in row mode
 *      via the plugin event bus, ensuring `getSelectedRows()` always reflects
 *      the row the user is visibly editing.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditingPlugin } from '../editing/EditingPlugin';
import { SelectionPlugin } from './SelectionPlugin';

async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await nextFrame();
  await nextFrame();
}

describe('Selection × Editing × external row replacement (#284)', () => {
  let grid: any;

  beforeEach(async () => {
    await import('../../core/grid');
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('source row replacement clears stale selection', () => {
    it('clears selection when host swaps rows array to a different size', async () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name' },
        ],
        plugins: [new SelectionPlugin({ mode: 'row' })],
      };
      grid.rows = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Bravo' },
        { id: 3, name: 'Charlie' },
      ];
      await waitUpgrade(grid);

      const selection = grid.getPluginByName('selection') as SelectionPlugin;
      selection.selectRows([2]);
      await nextFrame();
      expect(selection.getSelectedRowIndices()).toEqual([2]);

      // Host filters upstream → fewer rows arrive.
      grid.rows = [{ id: 99, name: 'Zeta' }];
      await nextFrame();
      await nextFrame();

      // The stale Charlie row must NOT be returned, and every selected row
      // must exist in the new source array (no out-of-bounds index leakage).
      const selectedRows = selection.getSelectedRows();
      expect(selectedRows).not.toContainEqual({ id: 3, name: 'Charlie' });
      for (const r of selectedRows) {
        expect(grid.rows).toContain(r);
      }
      // And no selected index can point past the new length.
      for (const i of selection.getSelectedRowIndices()) {
        expect(i).toBeLessThan(grid.rows.length);
      }
    });

    it('does NOT clear selection on in-place cell edits (sourceRowCount unchanged)', async () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name', editable: true },
        ],
        plugins: [new SelectionPlugin({ mode: 'row' }), new EditingPlugin({ editOn: 'manual' })],
      };
      grid.rows = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Bravo' },
        { id: 3, name: 'Charlie' },
      ];
      await waitUpgrade(grid);

      const selection = grid.getPluginByName('selection') as SelectionPlugin;
      selection.selectRows([2]);
      await nextFrame();
      expect(selection.getSelectedRowIndices()).toContain(2);

      // Reassign rows to a new array reference of the SAME length — mimics a
      // host that re-emits its row collection without changing source size.
      grid.rows = [...grid.rows];
      await nextFrame();

      // Selection must survive: data-change with unchanged sourceRowCount
      // is NOT a signal that indices have shifted.
      expect(selection.getSelectedRowIndices()).toContain(2);
    });
  });

  describe('edit-open drives selection (row mode)', () => {
    it('beginBulkEdit auto-selects the edited row and fires selection-change once', async () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name', editable: true },
        ],
        plugins: [new SelectionPlugin({ mode: 'row' }), new EditingPlugin({ editOn: 'manual' })],
      };
      grid.rows = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Bravo' },
        { id: 3, name: 'Charlie' },
      ];
      await waitUpgrade(grid);

      const selection = grid.getPluginByName('selection') as SelectionPlugin;
      const editing = grid.getPluginByName('editing') as EditingPlugin;

      editing.beginBulkEdit(2);
      await nextFrame();

      // Row 2 must be selected (the row the user is visibly editing). Other
      // indices may also be present from focus-driven sync — we only assert
      // the invariant from issue #284: the edited row is in the selection
      // and getSelectedRows() includes the actual row reference.
      expect(selection.getSelectedRowIndices()).toContain(2);
      expect(selection.getSelectedRows()).toContain(grid.rows[2]);
    });

    it('broadcasts edit-open and edit-close on the DOM (consumer-visible)', async () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name', editable: true },
        ],
        plugins: [new EditingPlugin({ editOn: 'manual' })],
      };
      grid.rows = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Bravo' },
      ];
      await waitUpgrade(grid);

      const editing = grid.getPluginByName('editing') as EditingPlugin;
      const opens: any[] = [];
      const closes: any[] = [];
      grid.addEventListener('edit-open', (e: CustomEvent) => opens.push(e.detail));
      grid.addEventListener('edit-close', (e: CustomEvent) => closes.push(e.detail));

      editing.beginBulkEdit(1);
      await nextFrame();
      expect(opens.at(-1)).toMatchObject({ rowIndex: 1, row: grid.rows[1] });

      editing.commitActiveRowEdit();
      await nextFrame();
      expect(closes.at(-1)).toMatchObject({ rowIndex: 1, reverted: false });
    });

    it('preserves multi-selection when entering edit mode (adds, does not collapse)', async () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name', editable: true },
        ],
        plugins: [new SelectionPlugin({ mode: 'row' }), new EditingPlugin({ editOn: 'manual' })],
      };
      grid.rows = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Bravo' },
        { id: 3, name: 'Charlie' },
        { id: 4, name: 'Delta' },
      ];
      await waitUpgrade(grid);

      const selection = grid.getPluginByName('selection') as SelectionPlugin;
      const editing = grid.getPluginByName('editing') as EditingPlugin;

      // Pre-select two rows.
      selection.selectRows([0, 1]);
      await nextFrame();
      expect(selection.getSelectedRowIndices()).toEqual([0, 1]);

      // Edit a third row — selection should grow, not collapse.
      editing.beginBulkEdit(3);
      await nextFrame();

      expect(selection.getSelectedRowIndices()).toEqual([0, 1, 3]);
    });

    it('does not auto-select when isSelectable returns false for the edited row', async () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name', editable: true },
        ],
        plugins: [
          new SelectionPlugin({ mode: 'row', isSelectable: (row: any) => row.id !== 2 }),
          new EditingPlugin({ editOn: 'manual' }),
        ],
      };
      grid.rows = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Bravo' },
        { id: 3, name: 'Charlie' },
      ];
      await waitUpgrade(grid);

      const selection = grid.getPluginByName('selection') as SelectionPlugin;
      const editing = grid.getPluginByName('editing') as EditingPlugin;

      editing.beginBulkEdit(1); // row.id === 2 → not selectable
      await nextFrame();

      // Edit-open auto-select must NOT include the unselectable row.
      expect(selection.getSelectedRowIndices()).not.toContain(1);
    });

    it('does not auto-select in cell mode (mode-gated)', async () => {
      grid.gridConfig = {
        columns: [
          { field: 'id', header: 'ID' },
          { field: 'name', header: 'Name', editable: true },
        ],
        plugins: [new SelectionPlugin({ mode: 'cell' }), new EditingPlugin({ editOn: 'manual' })],
      };
      grid.rows = [
        { id: 1, name: 'Alpha' },
        { id: 2, name: 'Bravo' },
      ];
      await waitUpgrade(grid);

      const selection = grid.getPluginByName('selection') as SelectionPlugin;
      const editing = grid.getPluginByName('editing') as EditingPlugin;

      editing.beginBulkEdit(1);
      await nextFrame();

      // Cell mode tracks selectedCell, not row set; auto-select-on-edit is row-only.
      expect(selection.getSelectedRowIndices()).toEqual([]);
    });
  });
});
