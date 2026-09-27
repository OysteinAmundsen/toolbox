/**
 * EditingPlugin `mode: 'cell'` (spreadsheet single-cell editing) plus the
 * mode-independent Delete / Backspace clear and type-to-edit.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SelectionPlugin } from '../selection/selection-plugin';
import { UndoRedoPlugin } from '../undo-redo/undo-redo-plugin';
import { EditingPlugin } from './editing-plugin';
import type { EditingConfig } from './types';

async function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function settle(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

async function waitUpgrade(el: HTMLElement & { ready?: () => Promise<void> }): Promise<void> {
  await customElements.whenDefined('tbw-grid');
  await el.ready?.();
  await settle();
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init });
  target.dispatchEvent(event);
  return event;
}

interface Row {
  id: number;
  name: string;
  code: string;
  qty: number;
  note: string | null;
  done: boolean;
}

const makeRows = (): Row[] => [
  { id: 1, name: 'Alpha', code: 'A', qty: 5, note: 'x', done: false },
  { id: 2, name: 'Bravo', code: 'B', qty: 7, note: 'y', done: true },
  { id: 3, name: 'Charlie', code: 'C', qty: 9, note: 'z', done: false },
];

// Visible columns: 0 id (read-only), 1 name, 2 code (read-only), 3 qty, 4 note (nullable), 5 done
const columns = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name', editable: true },
  { field: 'code', header: 'Code' },
  { field: 'qty', header: 'Qty', type: 'number', editable: true },
  { field: 'note', header: 'Note', editable: true, nullable: true },
  { field: 'done', header: 'Done', type: 'boolean', editable: true },
];

describe('EditingPlugin cell mode and spreadsheet keys', () => {
  let grid: any;
  let rows: Row[];

  async function setup(config: EditingConfig = { mode: 'cell' }, extra: unknown[] = []) {
    rows = makeRows();
    grid.gridConfig = {
      columns,
      getRowId: (r: Row) => String(r.id),
      plugins: [new EditingPlugin(config), ...extra],
    };
    grid.rows = rows;
    await waitUpgrade(grid);
  }

  const cell = (row: number, col: number) =>
    grid.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`) as HTMLElement;
  const editingCells = () => grid.querySelectorAll('.cell.editing');
  const editorIn = (row: number, col: number) => cell(row, col)?.querySelector('input') as HTMLInputElement | null;
  const focus = (row: number, col: number) => {
    grid._focusRow = row;
    grid._focusCol = col;
  };

  beforeEach(async () => {
    await import('../../core/grid');
    document.body.innerHTML = '';
    grid = document.createElement('tbw-grid');
    document.body.appendChild(grid);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe("mode: 'cell'", () => {
    it('double-click opens only that cell; a single click does not open anything', async () => {
      await setup();
      cell(0, 1).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(editingCells().length).toBe(0);

      cell(0, 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      await settle();
      expect(editingCells().length).toBe(1);
      expect(editorIn(0, 1)?.value).toBe('Alpha');
    });

    it('honors an explicit editOn: "click"', async () => {
      await setup({ mode: 'cell', editOn: 'click' });
      cell(1, 3).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await settle();
      expect(editingCells().length).toBe(1);
      expect(editorIn(1, 3)).toBeTruthy();
    });

    it('Enter opens the focused cell, Enter again commits and stays on the cell', async () => {
      await setup();
      focus(1, 1);
      press(grid, 'Enter');
      await settle();
      const input = editorIn(1, 1)!;
      expect(input.value).toBe('Bravo');

      input.value = 'Bravissimo';
      press(input, 'Enter');
      await settle();

      expect(rows[1].name).toBe('Bravissimo');
      expect(editingCells().length).toBe(0);
      expect(grid._focusRow).toBe(1);
      expect(grid._focusCol).toBe(1);
    });

    it('Enter on a read-only cell does not open an editor', async () => {
      await setup();
      focus(0, 2);
      press(grid, 'Enter');
      await settle();
      expect(editingCells().length).toBe(0);
    });

    it('typing on a focused cell opens it with the typed character replacing the value', async () => {
      await setup();
      focus(2, 1);
      const e = press(grid, 'Q');
      await settle();

      expect(e.defaultPrevented).toBe(true);
      const input = editorIn(2, 1)!;
      expect(input.value).toBe('Q');
      press(input, 'Enter');
      await settle();
      expect(rows[2].name).toBe('Q');
    });

    it('Escape cancels and restores the original value', async () => {
      await setup();
      focus(0, 1);
      press(grid, 'z');
      await settle();
      press(editorIn(0, 1)!, 'Escape');
      await settle();

      expect(rows[0].name).toBe('Alpha');
      expect(editingCells().length).toBe(0);
    });

    it('Tab commits, skips read-only cells and opens the next editable cell', async () => {
      await setup();
      focus(0, 1);
      press(grid, 'Enter');
      await settle();
      const input = editorIn(0, 1)!;
      input.value = 'Alef';
      press(input, 'Tab');
      await settle();

      expect(rows[0].name).toBe('Alef');
      expect(editingCells().length).toBe(1);
      expect(grid._focusCol).toBe(3); // skipped read-only "code"
      expect(editorIn(0, 3)?.value).toBe('5');
    });

    it('Tab from the last editable cell wraps to the first editable cell of the next row', async () => {
      await setup();
      focus(0, 4);
      press(grid, 'Enter');
      await settle();
      press(editorIn(0, 4)!, 'Tab');
      await settle();
      // "done" (col 5) is editable too, so the next stop is still row 0
      expect([grid._focusRow, grid._focusCol]).toEqual([0, 5]);
      press(cell(0, 5).querySelector('input')!, 'Tab');
      await settle();
      expect([grid._focusRow, grid._focusCol]).toEqual([1, 1]);
      expect(editorIn(1, 1)?.value).toBe('Bravo');
    });

    it('Shift+Tab moves backwards', async () => {
      await setup();
      focus(1, 3);
      press(grid, 'Enter');
      await settle();
      press(editorIn(1, 3)!, 'Tab', { shiftKey: true });
      await settle();
      expect([grid._focusRow, grid._focusCol]).toEqual([1, 1]);
      expect(editorIn(1, 1)?.value).toBe('Bravo');
    });

    it('pressing on another cell commits the open one', async () => {
      await setup();
      focus(0, 1);
      press(grid, 'Enter');
      await settle();
      editorIn(0, 1)!.value = 'Aleph';
      cell(0, 3).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
      await settle();

      expect(rows[0].name).toBe('Aleph');
      expect(editingCells().length).toBe(0);
    });

    it('typing while an editor is open goes to the editor, not a new edit', async () => {
      await setup();
      focus(0, 1);
      press(grid, 'Enter');
      await settle();
      const e = press(editorIn(0, 1)!, 'k');
      expect(e.defaultPrevented).toBe(false);
      expect(editingCells().length).toBe(1);
    });

    it('typing on a boolean cell does not open a text editor', async () => {
      await setup();
      focus(0, 5);
      press(grid, 'x');
      await settle();
      expect(editingCells().length).toBe(0);
    });
  });

  describe('Delete / Backspace clear (all modes)', () => {
    it.each(['Delete', 'Backspace'])('%s clears the focused cell', async (key) => {
      await setup({ mode: 'row' });
      focus(0, 1);
      const e = press(grid, key);
      await settle();
      expect(e.defaultPrevented).toBe(true);
      expect(rows[0].name).toBe('');
    });

    it('clears every editable cell in the selection with type-appropriate empty values', async () => {
      const selection = new SelectionPlugin({ mode: 'range' });
      await setup({ mode: 'cell' }, [selection]);
      selection.setRanges([{ from: { row: 0, col: 0 }, to: { row: 1, col: 5 } }]);
      await settle();
      focus(0, 0);
      press(grid, 'Delete');
      await settle();

      for (const i of [0, 1]) {
        expect(rows[i]).toMatchObject({ name: '', qty: 0, note: null, done: false });
      }
      // read-only cells and rows outside the selection are untouched
      expect(rows.map((r) => [r.id, r.code])).toEqual([
        [1, 'A'],
        [2, 'B'],
        [3, 'C'],
      ]);
      expect(rows[2]).toMatchObject({ name: 'Charlie', qty: 9 });
    });

    it('is a single undo step with UndoRedoPlugin', async () => {
      const selection = new SelectionPlugin({ mode: 'range' });
      const undo = new UndoRedoPlugin();
      await setup({ mode: 'cell' }, [selection, undo]);
      selection.setRanges([{ from: { row: 0, col: 1 }, to: { row: 2, col: 1 } }]);
      await settle();
      press(grid, 'Delete');
      await settle();
      expect(rows.map((r) => r.name)).toEqual(['', '', '']);

      undo.undo();
      await settle();
      expect(grid._rows.map((r: Row) => r.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('skips loading placeholder rows', async () => {
      await setup();
      grid._rows.push({ __loading: true, __index: 3 });
      const selectionRange = { from: { row: 0, col: 1 }, to: { row: 3, col: 1 } };
      grid.query = (type: string) => (type === 'getSelection' ? [{ ranges: [selectionRange] }] : []);
      press(grid, 'Delete');
      await settle();
      expect(grid._rows[3]).toEqual({ __loading: true, __index: 3 });
      expect(rows[0].name).toBe('');
    });

    it('does nothing while an editor is open (the editor owns Delete)', async () => {
      await setup();
      focus(0, 1);
      press(grid, 'Enter');
      await settle();
      const e = press(editorIn(0, 1)!, 'Delete');
      expect(e.defaultPrevented).toBe(false);
      expect(rows[0].name).toBe('Alpha');
    });
  });

  describe('type-to-edit in other modes', () => {
    it("row mode opens the row and seeds the focused cell's editor", async () => {
      await setup({ mode: 'row' });
      focus(1, 3);
      press(grid, '4');
      await settle();

      expect(grid._activeEditRows).toBe(1);
      expect(editorIn(1, 3)?.value).toBe('4');
      expect(editorIn(1, 1)?.value).toBe('Bravo');
    });
  });
});
