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
      { field: 'active', type: 'boolean' },
      { field: 'date', type: 'date' },
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
    focusRow: -1,
    focusCol: -1,
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
    const rows = g.bodyEl.querySelectorAll('.data-grid-row');
    expect(rows.length).toBe(2);
  });

  it('sets role=row on each row element', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    const rows = g.bodyEl.querySelectorAll('.data-grid-row');
    rows.forEach((row: Element) => {
      expect(row.getAttribute('role')).toBe('row');
    });
  });

  it('renders cells for each column', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 1, 1);
    const row = g.bodyEl.querySelector('.data-grid-row')!;
    const cells = row.querySelectorAll('.cell');
    expect(cells.length).toBe(4);
  });

  it('formats boolean cells with checkbox glyphs', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    const rows = g.bodyEl.querySelectorAll('.data-grid-row');
    const activeCell0 = rows[0].querySelector('.cell[data-col="2"]') as HTMLElement;
    const activeCell1 = rows[1].querySelector('.cell[data-col="2"]') as HTMLElement;
    expect(activeCell0.textContent?.length).toBeGreaterThan(0);
    expect(activeCell1.textContent?.length).toBeGreaterThan(0);
  });

  it('formats date cells', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    const rows = g.bodyEl.querySelectorAll('.data-grid-row');
    const dateCell0 = rows[0].querySelector('.cell[data-col="3"]') as HTMLElement;
    const dateCell1 = rows[1].querySelector('.cell[data-col="3"]') as HTMLElement;
    expect(dateCell0.textContent?.length).toBeGreaterThan(0);
    expect(dateCell1.textContent?.length).toBeGreaterThan(0);
  });

  it('uses row pool for efficient DOM reuse', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    expect(g.rowPool.length).toBe(2);
    const firstPool = [...g.rowPool];
    renderVisibleRows(g, 0, 2, 1);
    expect(g.rowPool[0]).toBe(firstPool[0]);
    expect(g.rowPool[1]).toBe(firstPool[1]);
  });

  it('fast patch updates modified cell content', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    g._rows[1].name = 'BetaX';
    renderVisibleRows(g, 0, 2, 1);
    const secondRow = g.bodyEl.querySelectorAll('.data-grid-row')[1];
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
      get visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      bodyEl,
      rowPool: [],
      _changedRowIndices: new Set<number>(),
      rowEditSnapshots: new Map<number, any>(),
      activeEditRows: -1,
      findRenderedRowElement: (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null,
      focusRow: 0,
      focusCol: 0,
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
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const boolCell = rowEl.querySelector('.cell[data-col="2"]') as HTMLElement;
    expect(g._rows[0].active).toBe(true);
    boolCell.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(g._rows[0].active).toBe(false);
  });

  it('shrinks row pool when fewer rows needed', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    expect(g.rowPool.length).toBe(2);
    g._rows = [g._rows[0]];
    renderVisibleRows(g, 0, 1, 1);
    expect(g.rowPool.length).toBe(1);
  });
});

describe('handleRowClick', () => {
  function gridForClickMode(editOn: 'click' | 'doubleClick' = 'doubleClick') {
    const bodyEl = document.createElement('div');
    const grid: any = {
      _rows: [{ id: 1, a: 'A', b: 'B' }],
      _columns: [{ field: 'id' }, { field: 'a', editable: true }, { field: 'b', editable: true }],
      get visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      bodyEl,
      rowPool: [],
      _changedRowIndices: new Set<number>(),
      rowEditSnapshots: new Map<number, any>(),
      activeEditRows: -1,
      focusRow: -1,
      focusCol: -1,
      editOn: editOn === 'click' ? 'click' : 'doubleClick',
      refreshVirtualWindow: () => {
        /* noop */
      },
      virtualization: { start: 0, end: 1, enabled: false },
      findRenderedRowElement: (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null,
      dispatchEvent: (ev: any) => (grid.__events || (grid.__events = [])).push(ev),
    };
    renderVisibleRows(grid, 0, 1, 1);
    return grid;
  }

  it('enters edit on single click in click mode', () => {
    const g = gridForClickMode('click');
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, false);
    expect(g.activeEditRows).toBe(0);
    expect(targetCell.classList.contains('editing')).toBe(true);
  });

  it('sets focus row and column on click', () => {
    const g = gridForClickMode('click');
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, false);
    expect(g.focusRow).toBe(0);
    expect(g.focusCol).toBe(1);
  });

  it('does not enter edit on single click in doubleClick mode', () => {
    const g = gridForClickMode('doubleClick');
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, false);
    expect(g.activeEditRows).toBe(-1);
  });

  it('enters edit on double click in doubleClick mode', () => {
    const g = gridForClickMode('doubleClick');
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const targetCell = rowEl.querySelector('.cell[data-col="1"]') as HTMLElement;
    const ev = new MouseEvent('dblclick', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: targetCell });
    handleRowClick(g, ev, rowEl, true);
    expect(g.activeEditRows).toBe(0);
  });

  it('clears existing editing cells on double click', () => {
    const g = gridForClickMode('doubleClick');
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
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
    const rowEl = g.bodyEl.querySelector('.data-grid-row')!;
    const ev = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(ev, 'target', { value: rowEl });
    handleRowClick(g, ev, rowEl, false);
    // Row edit starts but no cell focus since we didn't click a cell
    expect(g.activeEditRows).toBe(0);
    expect(g.focusRow).toBe(-1);
    expect(g.focusCol).toBe(-1);
  });
});
