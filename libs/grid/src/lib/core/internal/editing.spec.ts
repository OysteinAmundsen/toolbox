import { describe, expect, it } from 'vitest';
import { commitCellValue, exitRowEdit, inlineEnterEdit, startRowEdit } from './editing';
import { renderVisibleRows } from './rows';

/**
 * Creates a minimal InternalGrid mock for editing tests.
 */
function makeGrid() {
  const bodyEl = document.createElement('div');
  const grid: any = {
    _rows: [{ id: 1, name: 'Alice', age: 30, active: true }],
    _columns: [
      { field: 'id' },
      { field: 'name', editable: true },
      { field: 'age', type: 'number', editable: true },
      { field: 'active', type: 'boolean' },
    ],
    get visibleColumns() {
      return this._columns.filter((c: any) => !c.hidden);
    },
    bodyEl,
    rowPool: [],
    _changedRowIndices: new Set<number>(),
    rowEditSnapshots: new Map<number, any>(),
    activeEditRows: -1,
    focusRow: 0,
    focusCol: 0,
    get changedRows() {
      return (Array.from(this._changedRowIndices) as number[]).map((i) => this._rows[i]);
    },
    get changedRowIndices() {
      return Array.from(this._changedRowIndices) as number[];
    },
    findRenderedRowElement: (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null,
    dispatchEvent: (ev: any) => {
      (grid.__events || (grid.__events = [])).push(ev);
    },
  };
  return grid;
}

describe('startRowEdit', () => {
  it('snapshots row data on first call', () => {
    const g = makeGrid();
    startRowEdit(g, 0, g._rows[0]);
    expect(g.rowEditSnapshots.has(0)).toBe(true);
    const snapshot = g.rowEditSnapshots.get(0);
    expect(snapshot.name).toBe('Alice');
    expect(snapshot.age).toBe(30);
  });

  it('sets activeEditRows to the row index', () => {
    const g = makeGrid();
    expect(g.activeEditRows).toBe(-1);
    startRowEdit(g, 0, g._rows[0]);
    expect(g.activeEditRows).toBe(0);
  });

  it('does not re-snapshot if already editing same row', () => {
    const g = makeGrid();
    startRowEdit(g, 0, g._rows[0]);
    const firstSnapshot = g.rowEditSnapshots.get(0);
    g._rows[0].name = 'Changed';
    startRowEdit(g, 0, g._rows[0]);
    // Should still have original snapshot
    expect(g.rowEditSnapshots.get(0)).toBe(firstSnapshot);
    expect(firstSnapshot.name).toBe('Alice');
  });
});

describe('exitRowEdit', () => {
  it('does nothing if row is not being edited', () => {
    const g = makeGrid();
    g.__events = [];
    exitRowEdit(g, 0, false);
    expect(g.__events.length).toBe(0);
  });

  it('reverts changes when revert=true', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    startRowEdit(g, 0, g._rows[0]);
    g._rows[0].name = 'Modified';
    g._changedRowIndices.add(0);
    exitRowEdit(g, 0, true);
    expect(g._rows[0].name).toBe('Alice');
    expect(g._changedRowIndices.has(0)).toBe(false);
  });

  it('emits row-commit event when revert=false', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    startRowEdit(g, 0, g._rows[0]);
    exitRowEdit(g, 0, false);
    const rowCommit = g.__events.find((e: any) => e.type === 'row-commit');
    expect(rowCommit).toBeTruthy();
    expect(rowCommit.detail.rowIndex).toBe(0);
  });

  it('row-commit event includes changed=true when row was modified', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    startRowEdit(g, 0, g._rows[0]);
    g._changedRowIndices.add(0);
    exitRowEdit(g, 0, false);
    const rowCommit = g.__events.find((e: any) => e.type === 'row-commit');
    expect(rowCommit.detail.changed).toBe(true);
  });

  it('row-commit event includes changed=false when no modifications', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    startRowEdit(g, 0, g._rows[0]);
    exitRowEdit(g, 0, false);
    const rowCommit = g.__events.find((e: any) => e.type === 'row-commit');
    expect(rowCommit.detail.changed).toBe(false);
  });

  it('clears snapshot and resets activeEditRows', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    startRowEdit(g, 0, g._rows[0]);
    exitRowEdit(g, 0, false);
    expect(g.rowEditSnapshots.has(0)).toBe(false);
    expect(g.activeEditRows).toBe(-1);
  });

  it('adds changed class to row element when changed', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    startRowEdit(g, 0, g._rows[0]);
    g._changedRowIndices.add(0);
    exitRowEdit(g, 0, false);
    const rowEl = g.bodyEl.querySelector('.data-grid-row');
    expect(rowEl.classList.contains('changed')).toBe(true);
  });

  it('removes changed class when reverted', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g.bodyEl.querySelector('.data-grid-row');
    rowEl.classList.add('changed');
    g._changedRowIndices.add(0);
    startRowEdit(g, 0, g._rows[0]);
    exitRowEdit(g, 0, true);
    expect(rowEl.classList.contains('changed')).toBe(false);
  });
});

describe('commitCellValue', () => {
  it('updates row data with new value', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    commitCellValue(g, 0, g._columns[1], 'Bob', g._rows[0]);
    expect(g._rows[0].name).toBe('Bob');
  });

  it('marks row as changed', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    commitCellValue(g, 0, g._columns[1], 'Bob', g._rows[0]);
    expect(g._changedRowIndices.has(0)).toBe(true);
  });

  it('emits cell-commit event', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    commitCellValue(g, 0, g._columns[1], 'Bob', g._rows[0]);
    const cellCommit = g.__events.find((e: any) => e.type === 'cell-commit');
    expect(cellCommit).toBeTruthy();
    expect(cellCommit.detail.field).toBe('name');
    expect(cellCommit.detail.value).toBe('Bob');
    expect(cellCommit.detail.rowIndex).toBe(0);
  });

  it('sets firstTimeForRow=true on first change', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    commitCellValue(g, 0, g._columns[1], 'Bob', g._rows[0]);
    const cellCommit = g.__events.find((e: any) => e.type === 'cell-commit');
    expect(cellCommit.detail.firstTimeForRow).toBe(true);
  });

  it('sets firstTimeForRow=false on subsequent changes', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    commitCellValue(g, 0, g._columns[1], 'Bob', g._rows[0]);
    commitCellValue(g, 0, g._columns[2], 25, g._rows[0]);
    const commits = g.__events.filter((e: any) => e.type === 'cell-commit');
    expect(commits[1].detail.firstTimeForRow).toBe(false);
  });

  it('early returns when value unchanged', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    g.__events = [];
    commitCellValue(g, 0, g._columns[1], 'Alice', g._rows[0]); // same value
    expect(g.__events.length).toBe(0);
    expect(g._changedRowIndices.has(0)).toBe(false);
  });

  it('adds changed class to row element', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    commitCellValue(g, 0, g._columns[1], 'Bob', g._rows[0]);
    const rowEl = g.bodyEl.querySelector('.data-grid-row');
    expect(rowEl.classList.contains('changed')).toBe(true);
  });
});

describe('inlineEnterEdit', () => {
  function editableGrid() {
    const bodyEl = document.createElement('div');
    const grid: any = {
      _rows: [{ id: 1, num: 10, flag: true, choice: 'b', txt: 'hello' }],
      _columns: [
        { field: 'id' },
        { field: 'num', type: 'number', editable: true },
        { field: 'flag', type: 'boolean' },
        {
          field: 'choice',
          type: 'select',
          editable: true,
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
        { field: 'txt', editable: true },
      ],
      get visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      bodyEl,
      rowPool: [],
      _changedRowIndices: new Set<number>(),
      rowEditSnapshots: new Map<number, any>(),
      activeEditRows: -1,
      get changedRows() {
        return (Array.from(this._changedRowIndices) as number[]).map((i) => this._rows[i]);
      },
      get changedRowIndices() {
        return Array.from(this._changedRowIndices) as number[];
      },
      findRenderedRowElement: (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null,
      focusRow: 0,
      focusCol: 0,
      dispatchEvent: (ev: any) => {
        (grid.__events || (grid.__events = [])).push(ev);
      },
    };
    return grid;
  }

  it('does nothing if column is not editable', () => {
    const g = editableGrid();
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const cell = rowEl.querySelector('.cell[data-col="0"]') as HTMLElement; // id column, not editable
    const originalContent = cell.innerHTML;
    inlineEnterEdit(g, g._rows[0], 0, g._columns[0], cell);
    expect(cell.innerHTML).toBe(originalContent);
  });

  it('starts row edit if not already editing', () => {
    const g = editableGrid();
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const cell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    expect(g.activeEditRows).toBe(-1);
    inlineEnterEdit(g, g._rows[0], 0, g._columns[1], cell);
    expect(g.activeEditRows).toBe(0);
  });

  it('uses number editor and commits on Enter', () => {
    const g = editableGrid();
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const cell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    inlineEnterEdit(g, g._rows[0], 0, g._columns[1], cell);
    const input = cell.querySelector('input[type="number"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = '42';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(g._rows[0].num).toBe(42);
    expect(g._changedRowIndices.has(0)).toBe(true);
  });

  it('template editor commits via blur', () => {
    const g = editableGrid();
    const tpl = document.createElement('data-grid-column-editor');
    tpl.innerHTML = '<input />';
    g._columns[4] = { field: 'txt', editable: true, __editorTemplate: tpl };
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const cell = rowEl.querySelector('.cell[data-col="4"]') as HTMLElement;
    inlineEnterEdit(g, g._rows[0], 0, g._columns[4], cell);
    const input = cell.querySelector('input') as HTMLInputElement;
    input.value = 'world';
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    expect(g._rows[0].txt).toBe('world');
  });

  it('select editor commits on change', () => {
    const g = editableGrid();
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const cell = rowEl.querySelector('.cell[data-col="3"]') as HTMLElement;
    inlineEnterEdit(g, g._rows[0], 0, g._columns[3], cell);
    const select = cell.querySelector('select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    select.value = 'a';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(g._rows[0].choice).toBe('a');
  });

  it('external editor mount commits value', () => {
    const g = editableGrid();
    const editorSpec = {
      mount: ({ context }: any) => {
        context.commit('edited');
      },
    };
    g._columns.push({ field: 'extra', editable: true, editor: editorSpec });
    g._rows[0].extra = 'orig';
    renderVisibleRows(g, 0, 1, 2);
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-col', '5');
    rowEl.appendChild(cell);
    inlineEnterEdit(g, g._rows[0], 0, g._columns[5], cell);
    expect(g._rows[0].extra).toBe('edited');
  });

  it('Escape cancels and restores original value', () => {
    const g = editableGrid();
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const cell = rowEl.querySelector('.cell[data-col="4"]') as HTMLElement;
    inlineEnterEdit(g, g._rows[0], 0, g._columns[4], cell);
    const input = cell.querySelector('input[type="text"],input:not([type])') as HTMLInputElement | null;
    if (input) {
      input.value = 'NEW';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    expect(g._rows[0].txt).toBe('hello');
    expect(g._changedRowIndices.size).toBe(0);
  });

  it('template editor Escape cancels without marking changed', () => {
    const bodyEl = document.createElement('div');
    const tpl = document.createElement('data-grid-column-editor');
    tpl.innerHTML = '<input />';
    const grid: any = {
      _rows: [{ id: 1, txt: 'hello' }],
      _columns: [{ field: 'id' }, { field: 'txt', editable: true, __editorTemplate: tpl }],
      get visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      bodyEl,
      rowPool: [],
      _changedRowIndices: new Set<number>(),
      rowEditSnapshots: new Map<number, any>(),
      activeEditRows: -1,
      focusRow: 0,
      focusCol: 0,
      refreshVirtualWindow: () => {
        /* noop */
      },
      virtualization: { start: 0, end: 1, enabled: false },
      findRenderedRowElement: (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null,
      dispatchEvent: () => {
        /* noop */
      },
    };
    renderVisibleRows(grid, 0, 1, 1);
    const rowEl = bodyEl.querySelector('.data-grid-row')!;
    const cell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    inlineEnterEdit(grid, grid._rows[0], 0, grid._columns[1], cell);
    const input = cell.querySelector('input') as HTMLInputElement;
    input.value = 'world';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(grid._rows[0].txt).toBe('hello');
    expect(grid._changedRowIndices.size).toBe(0);
  });

  it('does not re-enter if cell already editing', () => {
    const g = editableGrid();
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const cell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    inlineEnterEdit(g, g._rows[0], 0, g._columns[1], cell);
    const firstInput = cell.querySelector('input');
    inlineEnterEdit(g, g._rows[0], 0, g._columns[1], cell);
    const secondInput = cell.querySelector('input');
    expect(firstInput).toBe(secondInput);
  });
});
