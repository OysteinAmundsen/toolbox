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
  gridEl._changedRowIdsSet = new Set<string>();
  gridEl._rowEditSnapshots = new Map<number, any>();
  gridEl._activeEditRows = -1;
  Object.defineProperty(gridEl, 'changedRowIds', {
    get() {
      return Array.from(this._changedRowIdsSet) as string[];
    },
  });
  Object.defineProperty(gridEl, 'changedRows', {
    get() {
      return this._rows.filter((row: any) => {
        const id = row.id != null ? String(row.id) : undefined;
        return id && this._changedRowIdsSet.has(id);
      });
    },
  });
  gridEl.getRowId = (row: any) => {
    if (row.id != null) return String(row.id);
    throw new Error('No ID');
  };
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
    g._changedRowIdsSet = new Set<string>();
    g.changedRowIds = [];
    g.getRowId = (row: any) => (row.id != null ? String(row.id) : undefined);
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
    g._changedRowIdsSet = new Set<string>();
    g.changedRowIds = [];
    g.getRowId = (row: any) => (row.id != null ? String(row.id) : undefined);
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
    g._changedRowIdsSet = new Set<string>();
    g.changedRowIds = [];
    g.getRowId = (row: any) => (row.id != null ? String(row.id) : undefined);
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
    grid._changedRowIdsSet = new Set<string>();
    grid.changedRowIds = [];
    grid.getRowId = (row: any) => (row.id != null ? String(row.id) : undefined);
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

describe('afterCellRender hook', () => {
  it('calls hook for each cell when plugin has hook registered', () => {
    const g = makeGrid();
    const hookCalls: { rowIndex: number; colIndex: number; value: any }[] = [];

    // Mock the hook detection and call methods
    g._hasAfterCellRenderHook = () => true;
    g._afterCellRender = (ctx: any) => {
      hookCalls.push({
        rowIndex: ctx.rowIndex,
        colIndex: ctx.colIndex,
        value: ctx.value,
      });
    };

    renderVisibleRows(g, 0, 1, 1);

    // Should be called for each cell (4 columns × 1 row = 4 calls)
    expect(hookCalls.length).toBe(4);
    expect(hookCalls[0]).toEqual({ rowIndex: 0, colIndex: 0, value: 1 });
    expect(hookCalls[1]).toEqual({ rowIndex: 0, colIndex: 1, value: 'Alpha' });
    expect(hookCalls[2]).toEqual({ rowIndex: 0, colIndex: 2, value: true });
    expect(hookCalls[3].rowIndex).toBe(0);
    expect(hookCalls[3].colIndex).toBe(3);
  });

  it('does not call hook when no plugin has hook registered', () => {
    const g = makeGrid();
    const hookCalls: any[] = [];

    g._hasAfterCellRenderHook = () => false;
    g._afterCellRender = (ctx: any) => {
      hookCalls.push(ctx);
    };

    renderVisibleRows(g, 0, 1, 1);

    // Should not be called when hasAfterCellRenderHook returns false
    expect(hookCalls.length).toBe(0);
  });

  it('provides correct context with cellElement and rowElement', () => {
    const g = makeGrid();
    let capturedContext: any = null;

    g._hasAfterCellRenderHook = () => true;
    g._afterCellRender = (ctx: any) => {
      if (ctx.colIndex === 1) capturedContext = ctx;
    };

    renderVisibleRows(g, 0, 1, 1);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext.row).toEqual(g._rows[0]);
    expect(capturedContext.column).toBe(g._columns[1]);
    expect(capturedContext.cellElement).toBeInstanceOf(HTMLElement);
    expect(capturedContext.rowElement).toBeInstanceOf(HTMLElement);
    expect(capturedContext.cellElement.classList.contains('cell')).toBe(true);
  });

  it('allows plugin to modify cell element during hook', () => {
    const g = makeGrid();

    g._hasAfterCellRenderHook = () => true;
    g._afterCellRender = (ctx: any) => {
      if (ctx.colIndex === 0) {
        ctx.cellElement.classList.add('plugin-modified');
        ctx.cellElement.setAttribute('data-plugin-test', 'true');
      }
    };

    renderVisibleRows(g, 0, 1, 1);

    const cell = g._bodyEl.querySelector('.cell[data-col="0"]')!;
    expect(cell.classList.contains('plugin-modified')).toBe(true);
    expect(cell.getAttribute('data-plugin-test')).toBe('true');
  });
});

describe('afterRowRender hook', () => {
  it('calls hook for each row when plugin has hook registered', () => {
    const g = makeGrid();
    const hookCalls: { rowIndex: number; row: any }[] = [];

    // Mock the hook detection and call methods
    g._hasAfterRowRenderHook = () => true;
    g._afterRowRender = (ctx: any) => {
      hookCalls.push({
        rowIndex: ctx.rowIndex,
        row: ctx.row,
      });
    };

    renderVisibleRows(g, 0, 2, 1);

    // Should be called for each row (2 rows)
    expect(hookCalls.length).toBe(2);
    expect(hookCalls[0].rowIndex).toBe(0);
    expect(hookCalls[0].row).toBe(g._rows[0]);
    expect(hookCalls[1].rowIndex).toBe(1);
    expect(hookCalls[1].row).toBe(g._rows[1]);
  });

  it('does not call hook when no plugin has hook registered', () => {
    const g = makeGrid();
    const hookCalls: any[] = [];

    g._hasAfterRowRenderHook = () => false;
    g._afterRowRender = (ctx: any) => {
      hookCalls.push(ctx);
    };

    renderVisibleRows(g, 0, 2, 1);

    // Should not be called when hasAfterRowRenderHook returns false
    expect(hookCalls.length).toBe(0);
  });

  it('provides correct context with rowElement', () => {
    const g = makeGrid();
    let capturedContext: any = null;

    g._hasAfterRowRenderHook = () => true;
    g._afterRowRender = (ctx: any) => {
      if (ctx.rowIndex === 1) capturedContext = ctx;
    };

    renderVisibleRows(g, 0, 2, 1);

    expect(capturedContext).not.toBeNull();
    expect(capturedContext.row).toEqual(g._rows[1]);
    expect(capturedContext.rowIndex).toBe(1);
    expect(capturedContext.rowElement).toBeInstanceOf(HTMLElement);
    expect(capturedContext.rowElement.classList.contains('data-grid-row')).toBe(true);
  });

  it('allows plugin to modify row element during hook', () => {
    const g = makeGrid();

    g._hasAfterRowRenderHook = () => true;
    g._afterRowRender = (ctx: any) => {
      if (ctx.rowIndex === 0) {
        ctx.rowElement.classList.add('plugin-modified-row');
        ctx.rowElement.setAttribute('data-plugin-row-test', 'true');
      }
    };

    renderVisibleRows(g, 0, 1, 1);

    const row = g._bodyEl.querySelector('.data-grid-row')!;
    expect(row.classList.contains('plugin-modified-row')).toBe(true);
    expect(row.getAttribute('data-plugin-row-test')).toBe('true');
  });

  it('is called after all cells are rendered', () => {
    const g = makeGrid();
    let cellsRenderedBeforeRowHook = 0;

    g._hasAfterCellRenderHook = () => true;
    g._afterCellRender = () => {
      cellsRenderedBeforeRowHook++;
    };

    g._hasAfterRowRenderHook = () => true;
    g._afterRowRender = (ctx: any) => {
      // At the point afterRowRender is called, all cells for this row should be rendered
      const rowEl = ctx.rowElement;
      const cellCount = rowEl.querySelectorAll('.cell').length;
      expect(cellCount).toBe(4); // 4 visible columns
    };

    renderVisibleRows(g, 0, 1, 1);

    // All cell hooks should have been called (4 cells)
    expect(cellsRenderedBeforeRowHook).toBe(4);
  });
});

// #region releaseCell integration tests
describe('releaseCell lifecycle', () => {
  /**
   * Tests that the grid core calls FrameworkAdapter.releaseCell()
   * before wiping cell DOM, preventing memory leaks in framework
   * adapters (Angular EmbeddedViewRefs, React roots, Vue apps).
   */

  it('calls adapter.releaseCell for each cell in renderInlineRow', () => {
    const g = makeGrid();
    const releaseSpy = vi.fn();
    g.__frameworkAdapter = {
      canHandle: () => false,
      createRenderer: () => () => null,
      createEditor: () => () => document.createElement('input'),
      releaseCell: releaseSpy,
    };

    // Initial render creates cells
    renderVisibleRows(g, 0, 1, 1);
    releaseSpy.mockClear();

    // Force full rebuild by bumping epoch — this triggers renderInlineRow
    renderVisibleRows(g, 0, 1, 2);

    // Should have been called once per cell in the row (4 columns)
    expect(releaseSpy).toHaveBeenCalledTimes(4);
    // Each call should receive a cell element
    for (const call of releaseSpy.mock.calls) {
      expect(call[0]).toBeInstanceOf(HTMLElement);
      expect((call[0] as HTMLElement).classList.contains('cell')).toBe(true);
    }
  });

  it('calls adapter.releaseCell before innerHTML wipe in fastPatchRow standard path', () => {
    const releaseSpy = vi.fn();
    const g = makeGrid();
    // Add a renderer so we hit the standard path (not ultra-fast)
    g._columns = [
      { field: 'id' },
      {
        field: 'name',
        renderer: (ctx: any) => {
          const el = document.createElement('span');
          el.textContent = String(ctx.value);
          return el;
        },
      },
    ];
    g.__frameworkAdapter = {
      canHandle: () => false,
      createRenderer: () => () => null,
      createEditor: () => () => document.createElement('input'),
      releaseCell: releaseSpy,
    };
    g.__hasSpecialColumns = undefined; // Reset cache

    // Initial render
    renderVisibleRows(g, 0, 1, 1);

    // Inject fake editor content into a cell to simulate post-edit state
    const row = g._bodyEl.querySelector('.data-grid-row') as HTMLElement;
    const nameCell = row.querySelector('.cell[data-col="1"]') as HTMLElement;
    const editorHost = document.createElement('div');
    editorHost.className = 'tbw-editor-host';
    nameCell.innerHTML = '';
    nameCell.appendChild(editorHost);

    releaseSpy.mockClear();

    // Change data to trigger fastPatchRow standard path
    g._rows[0] = { ...g._rows[0], name: 'Changed' };
    renderVisibleRows(g, 0, 1, 1);

    // releaseCell should have been called for the cell with the renderer
    // (renderer returns a new Node, so parentElement !== cell, triggering innerHTML wipe)
    expect(releaseSpy).toHaveBeenCalled();
    const calledCells = releaseSpy.mock.calls.map((c: any[]) => c[0] as HTMLElement);
    // The name cell (with renderer) should have been released
    expect(calledCells.some((el: HTMLElement) => el.getAttribute('data-field') === 'name')).toBe(true);
  });

  it('calls adapter.releaseCell in ultra-fast path for cells with element children', () => {
    const releaseSpy = vi.fn();
    const g = makeGrid();
    // Use only plain columns (no renderers) for ultra-fast path
    g._columns = [{ field: 'id' }, { field: 'name' }];
    g.__frameworkAdapter = {
      canHandle: () => false,
      createRenderer: () => () => null,
      createEditor: () => () => document.createElement('input'),
      releaseCell: releaseSpy,
    };
    g.__hasSpecialColumns = false; // Force ultra-fast path

    // Initial render
    renderVisibleRows(g, 0, 1, 1);

    // Inject a child element into a cell (simulating editor host from prior editing)
    const row = g._bodyEl.querySelector('.data-grid-row') as HTMLElement;
    const nameCell = row.querySelector('.cell[data-col="1"]') as HTMLElement;
    nameCell.innerHTML = '<div class="tbw-editor-host"><input /></div>';

    releaseSpy.mockClear();

    // Re-render same data (same ref) triggers fastPatchRow
    renderVisibleRows(g, 0, 1, 1);

    // releaseCell should have been called for the cell with element children
    expect(releaseSpy).toHaveBeenCalled();
    const calledCells = releaseSpy.mock.calls.map((c: any[]) => c[0] as HTMLElement);
    expect(calledCells.some((el: HTMLElement) => el.getAttribute('data-field') === 'name')).toBe(true);
  });

  it('does NOT call releaseCell for cells in editing mode', () => {
    const releaseSpy = vi.fn();
    const g = makeGrid();
    g._columns = [{ field: 'id' }, { field: 'name' }];
    g.__frameworkAdapter = {
      canHandle: () => false,
      createRenderer: () => () => null,
      createEditor: () => () => document.createElement('input'),
      releaseCell: releaseSpy,
    };
    g.__hasSpecialColumns = false;

    renderVisibleRows(g, 0, 1, 1);

    // Mark a cell as editing
    const row = g._bodyEl.querySelector('.data-grid-row') as HTMLElement;
    const nameCell = row.querySelector('.cell[data-col="1"]') as HTMLElement;
    nameCell.classList.add('editing');
    nameCell.innerHTML = '<div class="tbw-editor-host"><input /></div>';
    // Set editing state on row to trigger the editing-aware path
    (row as any).__editingCellCount = 1;
    row.setAttribute('data-has-editing', '');
    g._activeEditRows = 0;

    releaseSpy.mockClear();
    renderVisibleRows(g, 0, 1, 1);

    // The editing cell should NOT have been released (editing cells are preserved)
    const calledCells = releaseSpy.mock.calls.map((c: any[]) => c[0] as HTMLElement);
    expect(calledCells.every((el: HTMLElement) => !el.classList.contains('editing'))).toBe(true);
  });

  it('does not error when adapter has no releaseCell method', () => {
    const g = makeGrid();
    g.__frameworkAdapter = {
      canHandle: () => false,
      createRenderer: () => () => null,
      createEditor: () => () => document.createElement('input'),
      // No releaseCell method
    };

    renderVisibleRows(g, 0, 1, 1);
    // Should not throw when re-rendering
    expect(() => renderVisibleRows(g, 0, 1, 2)).not.toThrow();
  });

  it('releases cells when row is recycled for a different data row', () => {
    const releaseSpy = vi.fn();
    const g = makeGrid();
    g._rows = [
      { id: 1, name: 'Alpha', active: true, date: new Date('2024-01-01') },
      { id: 2, name: 'Beta', active: false, date: '2024-01-02' },
      { id: 3, name: 'Gamma', active: true, date: '2024-01-03' },
    ];
    g.__frameworkAdapter = {
      canHandle: () => false,
      createRenderer: () => () => null,
      createEditor: () => () => document.createElement('input'),
      releaseCell: releaseSpy,
    };

    // Render rows 0-1
    renderVisibleRows(g, 0, 2, 1);
    releaseSpy.mockClear();

    // Now render rows 1-2 (row 0's pool element is recycled for row 2)
    // This triggers a full rebuild since data ref changed, calling renderInlineRow
    renderVisibleRows(g, 1, 3, 2);

    // releaseCell should have been called for cells being recycled
    expect(releaseSpy).toHaveBeenCalled();
  });
});
// #endregion
