import { describe, expect, it, vi } from 'vitest';

// Mock the columns module to provide addPart
vi.mock('./columns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./columns')>();
  return {
    ...actual,
    addPart: (el: Element, part: string) => {
      const current = el.getAttribute('part') || '';
      el.setAttribute('part', current ? `${current} ${part}` : part);
    },
  };
});

import { handleRowClick, renderVisibleRows } from './rows';

/**
 * Creates a minimal InternalGrid mock for row rendering tests.
 */
function makeGrid() {
  const bodyEl = document.createElement('div');
  const grid: any = {
    _rows: [
      { id: 1, name: 'Alpha', active: true, date: new Date('2024-01-01') },
      { id: 2, name: 'Beta', active: false, date: '2024-01-02' },
    ],
    _columns: [
      { field: 'id' },
      { field: 'name' },
      { field: 'active', type: 'boolean', editable: true },
      { field: 'date', type: 'date' },
    ],
    get _visibleColumns() {
      return this._columns.filter((c: any) => !c.hidden);
    },
    _bodyEl: bodyEl,
    _rowPool: [],
    _changedRowIndices: new Set<number>(),
    _rowEditSnapshots: new Map<number, any>(),
    _activeEditRows: -1,
    get changedRows() {
      return (Array.from(this._changedRowIndices) as number[]).map((i) => this._rows[i]);
    },
    get changedRowIndices() {
      return Array.from(this._changedRowIndices) as number[];
    },
    findRenderedRowElement: (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null,
    _focusRow: -1,
    _focusCol: -1,
    dispatchEvent: (ev: any) => {
      (grid.__events || (grid.__events = [])).push(ev);
    },
  };
  return grid;
}

describe('renderVisibleRows', () => {
  it('creates row elements for visible range', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    const rows = g._bodyEl.querySelectorAll('.data-grid-row');
    expect(rows.length).toBe(2);
  });

  it('sets role=row on each row element', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    const rows = g._bodyEl.querySelectorAll('.data-grid-row');
    rows.forEach((row: Element) => {
      expect(row.getAttribute('role')).toBe('row');
    });
  });

  it('renders cells for each column', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    const row = g._bodyEl.querySelector('.data-grid-row')!;
    const cells = row.querySelectorAll('.cell');
    expect(cells.length).toBe(4);
  });

  it('formats boolean cells with checkbox glyphs', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    const rows = g._bodyEl.querySelectorAll('.data-grid-row');
    const activeCell0 = rows[0].querySelector('.cell[data-col="2"]') as HTMLElement;
    const activeCell1 = rows[1].querySelector('.cell[data-col="2"]') as HTMLElement;
    expect(activeCell0.textContent?.length).toBeGreaterThan(0);
    expect(activeCell1.textContent?.length).toBeGreaterThan(0);
  });

  it('formats date cells', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    const rows = g._bodyEl.querySelectorAll('.data-grid-row');
    const dateCell0 = rows[0].querySelector('.cell[data-col="3"]') as HTMLElement;
    const dateCell1 = rows[1].querySelector('.cell[data-col="3"]') as HTMLElement;
    expect(dateCell0.textContent?.length).toBeGreaterThan(0);
    expect(dateCell1.textContent?.length).toBeGreaterThan(0);
  });

  it('uses row pool for efficient DOM reuse', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    expect(g._rowPool.length).toBe(2);
    const firstPool = [...g._rowPool];
    renderVisibleRows(g, 0, 2, 1);
    expect(g._rowPool[0]).toBe(firstPool[0]);
    expect(g._rowPool[1]).toBe(firstPool[1]);
  });

  it('fast patch updates modified cell content', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    g._rows[1].name = 'BetaX';
    renderVisibleRows(g, 0, 2, 1);
    const secondRow = g._bodyEl.querySelectorAll('.data-grid-row')[1];
    const nameCell = secondRow.querySelector('.cell[data-col="1"]') as HTMLElement;
    expect(nameCell.textContent).toBe('BetaX');
  });

  it('rebuilds external view placeholder when missing', () => {
    const bodyEl = document.createElement('div');
    const g: any = {
      _rows: [{ id: 1, viewval: 'A' }],
      _columns: [
        {
          field: 'viewval',
          externalView: {
            mount: ({ placeholder, context }: any) => {
              placeholder.textContent = context.value;
            },
          },
        },
      ],
      get _visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      _bodyEl: bodyEl,
      _rowPool: [],
      _changedRowIndices: new Set<number>(),
      _rowEditSnapshots: new Map<number, any>(),
      _activeEditRows: -1,
      findRenderedRowElement: (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null,
      _focusRow: 0,
      _focusCol: 0,
      dispatchEvent: () => {
        /* noop */
      },
    };
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = bodyEl.querySelector('.data-grid-row')!;
    const placeholder = rowEl.querySelector('[data-external-view]');
    placeholder?.remove();
    renderVisibleRows(g, 0, 1, 1);
    expect(rowEl.querySelector('[data-external-view]')).toBeTruthy();
  });

  it('boolean cell toggles via space keydown', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const boolCell = rowEl.querySelector('.cell[data-col="2"]') as HTMLElement;
    expect(g._rows[0].active).toBe(true);
    boolCell.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(g._rows[0].active).toBe(false);
  });

  it('shrinks row pool when fewer rows needed', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    expect(g._rowPool.length).toBe(2);
    g._rows = [g._rows[0]];
    renderVisibleRows(g, 0, 1, 1);
    expect(g._rowPool.length).toBe(1);
  });
});

describe('handleRowClick', () => {
  function gridForClickMode(editOn: 'click' | 'dblClick' | false = 'dblClick') {
    const bodyEl = document.createElement('div');
    const grid: any = {
      _rows: [{ id: 1, a: 'A', b: 'B' }],
      _columns: [{ field: 'id' }, { field: 'a', editable: true }, { field: 'b', editable: true }],
      get _visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      _bodyEl: bodyEl,
      _rowPool: [],
      _changedRowIndices: new Set<number>(),
      _rowEditSnapshots: new Map<number, any>(),
      _activeEditRows: -1,
      _focusRow: -1,
      _focusCol: -1,
      editOn: editOn,
      refreshVirtualWindow: () => {
        /* noop */
      },
      _virtualization: { start: 0, end: 1, enabled: false },
      findRenderedRowElement: (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null,
      dispatchEvent: (ev: any) => (grid.__events || (grid.__events = [])).push(ev),
    };
    renderVisibleRows(grid, 0, 1, 1);
    return grid;
  }

  it('does not enter edit when editOn is false', () => {
    const g = gridForClickMode(false);
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;

    // Try single click
    const clickEv = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(clickEv, 'target', { value: targetCell });
    handleRowClick(g, clickEv, rowEl, false);
    expect(g._activeEditRows).toBe(-1);

    // Try double click
    const dblClickEv = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(dblClickEv, 'target', { value: targetCell });
    handleRowClick(g, dblClickEv, rowEl, true);
    expect(g._activeEditRows).toBe(-1);
    expect(targetCell.classList.contains('editing')).toBe(false);
  });

  it('enters edit on single click in click mode', () => {
    const g = gridForClickMode('click');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, false);
    expect(g._activeEditRows).toBe(0);
    expect(targetCell.classList.contains('editing')).toBe(true);
  });

  it('sets focus row and column on click', () => {
    const g = gridForClickMode('click');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, false);
    expect(g._focusRow).toBe(0);
    expect(g._focusCol).toBe(1);
  });

  it('does not enter edit on single click in dblClick mode', () => {
    const g = gridForClickMode('dblClick');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, false);
    expect(g._activeEditRows).toBe(-1);
  });

  it('enters edit on double click in dblClick mode', () => {
    const g = gridForClickMode('dblClick');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, true);
    expect(g._activeEditRows).toBe(0);
  });

  it('clears existing editing cells on double click', () => {
    const g = gridForClickMode('dblClick');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    rowEl.querySelectorAll('.cell').forEach((c: any) => c.classList.add('editing'));
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, true);
    const editingCells = rowEl.querySelectorAll('.cell.editing');
    expect(editingCells.length).toBeGreaterThan(0);
  });

  it('starts row edit even when clicking non-cell row area', () => {
    const g = gridForClickMode('click');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: rowEl });
    handleRowClick(g, ev, rowEl, false);
    // Row edit starts but no cell focus since we didn't click a cell
    expect(g._activeEditRows).toBe(0);
    expect(g._focusRow).toBe(-1);
    expect(g._focusCol).toBe(-1);
  });

  it('does not re-render editors when double-clicking same row already in edit mode', () => {
    const g = gridForClickMode('dblClick');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const editableCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const nonEditableCell = rowEl.querySelector('.cell[data-col="0"]') as HTMLElement;

    // First double-click to enter edit mode
    const ev1 = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(ev1, 'target', { value: editableCell });
    handleRowClick(g, ev1, rowEl, true);
    expect(g._activeEditRows).toBe(0);

    // Get reference to the input that was created
    const originalInput = editableCell.querySelector('input');
    expect(originalInput).toBeTruthy();

    // Double-click on non-editable cell on same row
    const ev2 = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(ev2, 'target', { value: nonEditableCell });
    handleRowClick(g, ev2, rowEl, true);

    // Should still be in edit mode
    expect(g._activeEditRows).toBe(0);

    // The same input should still exist (not re-created)
    const inputAfter = editableCell.querySelector('input');
    expect(inputAfter).toBe(originalInput);
  });

  it('does not re-render editors when clicking editable cell on same row already in edit mode', () => {
    const g = gridForClickMode('dblClick');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const cellA = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const cellB = rowEl.querySelector('.cell[data-col="2"]') as HTMLElement;

    // First double-click to enter edit mode on cell A
    const ev1 = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(ev1, 'target', { value: cellA });
    handleRowClick(g, ev1, rowEl, true);
    expect(g._activeEditRows).toBe(0);

    // Get references to both inputs
    const inputA = cellA.querySelector('input');
    const inputB = cellB.querySelector('input');
    expect(inputA).toBeTruthy();
    expect(inputB).toBeTruthy();

    // Double-click on editable cell B on same row
    const ev2 = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(ev2, 'target', { value: cellB });
    handleRowClick(g, ev2, rowEl, true);

    // Should still be in edit mode
    expect(g._activeEditRows).toBe(0);

    // Both inputs should still be the same DOM elements (not re-created)
    expect(cellA.querySelector('input')).toBe(inputA);
    expect(cellB.querySelector('input')).toBe(inputB);
  });

  it('updates focusCol when clicking an editing cell', () => {
    const g = gridForClickMode('dblClick');
    const rowEl = g._bodyEl.querySelector('.data-grid-row')!;
    const cellA = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const cellB = rowEl.querySelector('.cell[data-col="2"]') as HTMLElement;

    // Double-click on cell A to enter edit mode
    const ev1 = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(ev1, 'target', { value: cellA });
    handleRowClick(g, ev1, rowEl, true);
    expect(g._activeEditRows).toBe(0);
    expect(g._focusCol).toBe(1);

    // Click on cell B (which is now in editing state)
    const ev2 = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev2, 'target', { value: cellB });
    handleRowClick(g, ev2, rowEl, false);

    // Focus should have moved to cell B
    expect(g._focusCol).toBe(2);

    // Cell B should have cell-focus class, cell A should not
    expect(cellB.classList.contains('cell-focus')).toBe(true);
    expect(cellA.classList.contains('cell-focus')).toBe(false);
  });
});
