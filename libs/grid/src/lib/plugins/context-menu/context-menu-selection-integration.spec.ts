/**
 * ContextMenuPlugin × SelectionPlugin (issue #541)
 *
 * `ContextMenuParams.selectedRows` must agree with the visible selection in every
 * selection mode, and every way of invoking the menu must sync it identically:
 * a `contextmenu` on the cell (mouse right-click, touch long-press), Shift+F10,
 * the ContextMenu key, and a synthesised `contextmenu` on the host (`button: -1`).
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createGrid, nextFrame, waitUpgrade } from '../../../../test/helpers';
import '../../core/grid';
import type { DataGridElement } from '../../core/grid';
import { SelectionPlugin } from '../selection/selection-plugin';
import type { SelectionConfig } from '../selection/types';
import { ContextMenuPlugin } from './context-menu-plugin';
import type { ContextMenuParams } from './types';

type Invoke = (grid: DataGridElement, row: number, col: number) => void;

function focusCell(grid: DataGridElement, row: number, col: number): void {
  grid._focusRow = row;
  grid._focusCol = col;
}

function pressKey(init: KeyboardEventInit): Invoke {
  return (grid, row, col) => {
    focusCell(grid, row, col);
    grid.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  };
}

const invocations: Array<[string, Invoke]> = [
  [
    'contextmenu on the cell (mouse right-click / touch long-press)',
    (grid, row, col) => {
      const cell = grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
      expect(cell).toBeTruthy();
      cell!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    },
  ],
  ['Shift+F10', pressKey({ key: 'F10', shiftKey: true })],
  ['ContextMenu key', pressKey({ key: 'ContextMenu' })],
  [
    'synthesised contextmenu on the host',
    (grid, row, col) => {
      focusCell(grid, row, col);
      grid.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: -1 }));
    },
  ],
];

describe('ContextMenu × Selection sync (#541)', () => {
  let grid: DataGridElement;
  let items: Mock<(params: ContextMenuParams) => []>;

  async function setup(mode: SelectionConfig['mode']): Promise<SelectionPlugin> {
    items = vi.fn((_params: ContextMenuParams): [] => []);
    grid.gridConfig = {
      columns: [
        { field: 'id', header: 'ID' },
        { field: 'name', header: 'Name' },
      ],
      plugins: [new SelectionPlugin({ mode }), new ContextMenuPlugin({ items })],
    };
    grid.rows = Array.from({ length: 8 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    await waitUpgrade(grid);
    return grid.getPluginByName('selection') as SelectionPlugin;
  }

  function menuParams(): ContextMenuParams {
    expect(items).toHaveBeenCalled();
    return items.mock.lastCall![0];
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    grid = createGrid();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe.each(invocations)('%s', (_name, invoke) => {
    it('range mode: inside a multi-row range reports every covered row and keeps the range', async () => {
      const selection = await setup('range');
      selection.setRanges([{ from: { row: 1, col: 0 }, to: { row: 5, col: 1 } }]);
      await nextFrame();

      invoke(grid, 3, 1);

      expect(menuParams().selectedRows).toEqual([1, 2, 3, 4, 5]);
      expect(selection.getSelectedRowIndices()).toEqual([1, 2, 3, 4, 5]);
    });

    it('range mode: outside the range collapses it to the invoked cell', async () => {
      const selection = await setup('range');
      // Row 3 is covered, column 1 is not — the cell is outside the range.
      selection.setRanges([{ from: { row: 1, col: 0 }, to: { row: 5, col: 0 } }]);
      await nextFrame();

      invoke(grid, 3, 1);

      expect(menuParams().selectedRows).toEqual([3]);
      expect(selection.getSelection().ranges).toEqual([{ from: { row: 3, col: 1 }, to: { row: 3, col: 1 } }]);
    });

    it('cell mode: moves the cell selection to the invoked cell', async () => {
      const selection = await setup('cell');
      selection['selectedCell'] = { row: 4, col: 0 };

      invoke(grid, 2, 1);

      expect(menuParams().selectedRows).toEqual([2]);
      expect(selection['selectedCell']).toEqual({ row: 2, col: 1 });
    });

    it('row mode: keeps a multi-selection containing the row, replaces one that does not', async () => {
      const selection = await setup('row');
      selection.selectRows([0, 2, 6]);
      await nextFrame();

      invoke(grid, 2, 0);
      expect(menuParams().selectedRows).toEqual([0, 2, 6]);

      invoke(grid, 4, 0);
      expect(menuParams().selectedRows).toEqual([4]);
      expect(selection.getSelectedRowIndices()).toEqual([4]);
    });

    it.each([['range'], ['cell']] as const)(
      "mixed ['%s', 'column'] mode: keeps a column selection the invoked cell is inside",
      async (inRow) => {
        const selection = await setup([inRow, 'column']);
        selection.selectColumn('name');
        await nextFrame();

        invoke(grid, 3, 1);

        expect(menuParams().selectedRows).toEqual([3]);
        expect(selection.getSelectedColumns()).toEqual(['name']);
      },
    );
  });
});
