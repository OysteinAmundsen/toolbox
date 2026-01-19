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
  // Create a real DOM element for the grid to support querySelector
  const gridEl = document.createElement('div') as any;
  gridEl._rows = [
    { id: 1, name: 'Alpha', active: true, date: new Date('2024-01-01') },
    { id: 2, name: 'Beta', active: false, date: '2024-01-02' },
  ];
  gridEl._columns = [
    { field: 'id' },
    { field: 'name' },
    { field: 'active', type: 'boolean', editable: true },
    { field: 'date', type: 'date' },
  ];
  Object.defineProperty(gridEl, '_visibleColumns', {
    get() {
      return this._columns.filter((c: any) => !c.hidden);
    },
  });
  gridEl._bodyEl = bodyEl;
  gridEl._rowPool = [];
  gridEl._changedRowIndices = new Set<number>();
  gridEl._rowEditSnapshots = new Map<number, any>();
  gridEl._activeEditRows = -1;
  Object.defineProperty(gridEl, 'changedRows', {
    get() {
      return (Array.from(this._changedRowIndices) as number[]).map((i) => this._rows[i]);
    },
  });
  Object.defineProperty(gridEl, 'changedRowIndices', {
    get() {
      return Array.from(this._changedRowIndices) as number[];
    },
  });
  gridEl.findRenderedRowElement = (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null;
  gridEl._focusRow = -1;
  gridEl._focusCol = -1;
  gridEl.__events = [];
  gridEl.dispatchEvent = (ev: any) => {
    gridEl.__events.push(ev);
  };
  gridEl.effectiveConfig = {};
  return gridEl;
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
    const g = document.createElement('div') as any;
    g._rows = [{ id: 1, viewval: 'A' }];
    g._columns = [
      {
        field: 'viewval',
        externalView: {
          mount: ({ placeholder, context }: any) => {
            placeholder.textContent = context.value;
          },
        },
      },
    ];
    Object.defineProperty(g, '_visibleColumns', {
      get() {
        return this._columns.filter((c: any) => !c.hidden);
      },
    });
    g._bodyEl = bodyEl;
    g._rowPool = [];
    g._changedRowIndices = new Set<number>();
    g._rowEditSnapshots = new Map<number, any>();
    g._activeEditRows = -1;
    g.findRenderedRowElement = (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null;
    g._focusRow = 0;
    g._focusCol = 0;
    g.dispatchEvent = () => {
      /* noop */
    };
    renderVisibleRows(g, 0, 1, 1);
    const rowEl = bodyEl.querySelector('.data-grid-row')!;
    const placeholder = rowEl.querySelector('[data-external-view]');
    placeholder?.remove();
    renderVisibleRows(g, 0, 1, 1);
    expect(rowEl.querySelector('[data-external-view]')).toBeTruthy();
  });

  it('shrinks row pool when fewer rows needed', () => {
    const g = makeGrid();
    renderVisibleRows(g, 0, 2, 1);
    expect(g._rowPool.length).toBe(2);
    g._rows = [g._rows[0]];
    renderVisibleRows(g, 0, 1, 1);
    expect(g._rowPool.length).toBe(1);
  });

  it('supports renderer as an alias for viewRenderer (string template)', () => {
    const bodyEl = document.createElement('div');
    const g = document.createElement('div') as any;
    g._rows = [{ id: 1, status: 'active' }];
    g._columns = [
      {
        field: 'status',
        // Using 'renderer' alias instead of 'viewRenderer'
        renderer: (ctx: any) => `<span class="badge">${ctx.value}</span>`,
      },
    ];
    Object.defineProperty(g, '_visibleColumns', {
      get() {
        return this._columns.filter((c: any) => !c.hidden);
      },
    });
    g._bodyEl = bodyEl;
    g._rowPool = [];
    g._changedRowIndices = new Set<number>();
    g._rowEditSnapshots = new Map<number, any>();
    g._activeEditRows = -1;
    g.findRenderedRowElement = (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null;
    g._focusRow = 0;
    g._focusCol = 0;
    g.dispatchEvent = () => {
      /* noop */
    };
    renderVisibleRows(g, 0, 1, 1);
    const cell = bodyEl.querySelector('.cell') as HTMLElement;
    const badge = cell.querySelector('.badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('active');
  });

  it('supports renderer as an alias for viewRenderer (DOM element)', () => {
    const bodyEl = document.createElement('div');
    const g = document.createElement('div') as any;
    g._rows = [{ id: 1, name: 'Test' }];
    g._columns = [
      {
        field: 'name',
        // Using 'renderer' alias with DOM element return
        renderer: (ctx: any) => {
          const btn = document.createElement('button');
          btn.className = 'action-btn';
          btn.textContent = ctx.value;
          return btn;
        },
      },
    ];
    Object.defineProperty(g, '_visibleColumns', {
      get() {
        return this._columns.filter((c: any) => !c.hidden);
      },
    });
    g._bodyEl = bodyEl;
    g._rowPool = [];
    g._changedRowIndices = new Set<number>();
    g._rowEditSnapshots = new Map<number, any>();
    g._activeEditRows = -1;
    g.findRenderedRowElement = (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null;
    g._focusRow = 0;
    g._focusCol = 0;
    g.dispatchEvent = () => {
      /* noop */
    };
    renderVisibleRows(g, 0, 1, 1);
    const cell = bodyEl.querySelector('.cell') as HTMLElement;
    const btn = cell.querySelector('button.action-btn');
    expect(btn).toBeTruthy();
    expect(btn?.textContent).toBe('Test');
  });
});

describe('handleRowClick', () => {
  function gridForClickMode(editOn: 'click' | 'dblClick' | false = 'dblClick') {
    const bodyEl = document.createElement('div');
    const grid = document.createElement('div') as any;
    grid._rows = [{ id: 1, a: 'A', b: 'B' }];
    grid._columns = [{ field: 'id' }, { field: 'a', editable: true }, { field: 'b', editable: true }];
    Object.defineProperty(grid, '_visibleColumns', {
      get() {
        return this._columns.filter((c: any) => !c.hidden);
      },
    });
    grid._bodyEl = bodyEl;
    grid._rowPool = [];
    grid._changedRowIndices = new Set<number>();
    grid._rowEditSnapshots = new Map<number, any>();
    grid._activeEditRows = -1;
    grid._focusRow = -1;
    grid._focusCol = -1;
    grid.editOn = editOn;
    grid.refreshVirtualWindow = () => {
      /* noop */
    };
    grid._virtualization = { start: 0, end: 1, enabled: false };
    grid.findRenderedRowElement = (ri: number) => bodyEl.querySelectorAll('.data-grid-row')[ri] || null;
    grid.__events = [];
    grid.dispatchEvent = (ev: any) => grid.__events.push(ev);
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
});

describe('rowClass callback', () => {
  it('applies dynamic classes from rowClass callback', () => {
    const g = makeGrid();
    g.effectiveConfig = {
      rowClass: (row: any) => (row.active ? ['active-row'] : ['inactive-row']),
    };
    renderVisibleRows(g, 0, 2, 1);
    const rows = g._bodyEl.querySelectorAll('.data-grid-row');
    expect(rows[0].classList.contains('active-row')).toBe(true);
    expect(rows[1].classList.contains('inactive-row')).toBe(true);
  });

  it('stores dynamic classes in data attribute for cleanup', () => {
    const g = makeGrid();
    g.effectiveConfig = {
      rowClass: (row: any) => ['dynamic-class', 'another-class'],
    };
    renderVisibleRows(g, 0, 1, 1);
    const row = g._bodyEl.querySelector('.data-grid-row')!;
    expect(row.getAttribute('data-dynamic-classes')).toBe('dynamic-class another-class');
  });

  it('removes previous dynamic classes when row data changes', () => {
    const g = makeGrid();
    g.effectiveConfig = {
      rowClass: (row: any) => (row.active ? ['active'] : ['inactive']),
    };
    renderVisibleRows(g, 0, 1, 1);
    const row = g._bodyEl.querySelector('.data-grid-row')!;
    expect(row.classList.contains('active')).toBe(true);

    // Change the row data
    g._rows[0] = { ...g._rows[0], active: false };
    renderVisibleRows(g, 0, 1, 2);
    expect(row.classList.contains('active')).toBe(false);
    expect(row.classList.contains('inactive')).toBe(true);
  });

  it('handles empty array from rowClass callback', () => {
    const g = makeGrid();
    g.effectiveConfig = {
      rowClass: () => [],
    };
    renderVisibleRows(g, 0, 1, 1);
    const row = g._bodyEl.querySelector('.data-grid-row')!;
    expect(row.hasAttribute('data-dynamic-classes')).toBe(false);
  });

  it('handles errors in rowClass callback gracefully', () => {
    const g = makeGrid();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });
    g.effectiveConfig = {
      rowClass: () => {
        throw new Error('Test error');
      },
    };
    renderVisibleRows(g, 0, 1, 1);
    expect(warnSpy).toHaveBeenCalledWith('[tbw-grid] rowClass callback error:', expect.any(Error));
    warnSpy.mockRestore();
  });
});

describe('cellClass callback', () => {
  it('applies dynamic classes from cellClass callback', () => {
    const g = makeGrid();
    g._columns[0].cellClass = (value: any) => (value > 1 ? ['high-id'] : ['low-id']);
    renderVisibleRows(g, 0, 2, 1);
    const rows = g._bodyEl.querySelectorAll('.data-grid-row');
    const cell0 = rows[0].querySelector('.cell[data-col="0"]')!;
    const cell1 = rows[1].querySelector('.cell[data-col="0"]')!;
    expect(cell0.classList.contains('low-id')).toBe(true);
    expect(cell1.classList.contains('high-id')).toBe(true);
  });

  it('stores dynamic classes in data attribute for cleanup', () => {
    const g = makeGrid();
    g._columns[1].cellClass = () => ['highlight', 'bold'];
    renderVisibleRows(g, 0, 1, 1);
    const cell = g._bodyEl.querySelector('.cell[data-col="1"]')!;
    expect(cell.getAttribute('data-dynamic-classes')).toBe('highlight bold');
  });

  it('receives value, row, and column in callback', () => {
    const g = makeGrid();
    const callbackSpy = vi.fn().mockReturnValue(['test-class']);
    g._columns[1].cellClass = callbackSpy;
    renderVisibleRows(g, 0, 1, 1);
    expect(callbackSpy).toHaveBeenCalledWith('Alpha', g._rows[0], g._columns[1]);
  });

  it('handles errors in cellClass callback gracefully', () => {
    const g = makeGrid();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* noop */
    });
    g._columns[0].cellClass = () => {
      throw new Error('Test error');
    };
    renderVisibleRows(g, 0, 1, 1);
    expect(warnSpy).toHaveBeenCalledWith("[tbw-grid] cellClass callback error for column 'id':", expect.any(Error));
    warnSpy.mockRestore();
  });

  it('filters out invalid class names', () => {
    const g = makeGrid();
    g._columns[0].cellClass = () => ['valid-class', '', null as any, undefined as any, 'another-valid'];
    renderVisibleRows(g, 0, 1, 1);
    const cell = g._bodyEl.querySelector('.cell[data-col="0"]')!;
    expect(cell.getAttribute('data-dynamic-classes')).toBe('valid-class another-valid');
    expect(cell.classList.contains('valid-class')).toBe(true);
    expect(cell.classList.contains('another-valid')).toBe(true);
  });
});
