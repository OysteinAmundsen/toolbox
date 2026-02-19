import { describe, expect, it, vi } from 'vitest';
import { handleGridKeyDown } from './keyboard';

function key(grid: any, k: string, opts: any = {}) {
  const e: any = new KeyboardEvent('keydown', {
    key: k,
    bubbles: true,
    cancelable: true,
    shiftKey: !!opts.shiftKey,
    ctrlKey: !!opts.ctrlKey,
    metaKey: !!opts.metaKey,
  });
  if (opts.target) {
    // Provide a composedPath shim returning the supplied target to exercise early-return logic
    e.composedPath = () => [opts.target];
  }
  handleGridKeyDown(grid, e);
  return e;
}

describe('keyboard navigation', () => {
  function makeGrid(rows = 5, cols = 3) {
    const grid: any = {
      _rows: Array.from({ length: rows }, (_, i) => ({ id: i, v: i })),
      _columns: Array.from({ length: cols }, (_, i) => ({ field: 'c' + i })),
      get _visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      _focusRow: 0,
      _focusCol: 0,
      _virtualization: { enabled: false, start: 0, end: rows },
      _bodyEl: document.createElement('div'),
      refreshVirtualWindow: () => {
        /* empty */
      },
      __events: [] as any[],
      dispatchEvent(ev: any) {
        grid.__events.push(ev);
      },
      querySelector(selector: string) {
        return null; // Mock - no DOM elements in unit tests
      },
    };
    return grid;
  }
  it('arrow navigation clamps within bounds', () => {
    const g = makeGrid();
    key(g, 'ArrowRight');
    expect(g._focusCol).toBe(1);
    key(g, 'ArrowLeft');
    expect(g._focusCol).toBe(0);
    key(g, 'ArrowUp');
    expect(g._focusRow).toBe(0);
    key(g, 'ArrowDown');
    expect(g._focusRow).toBe(1);
  });
  it('tab forward wraps to next row and commits', () => {
    const g = makeGrid(3, 2);
    g.commitActiveRowEdit = vi.fn();
    g._focusCol = 1;
    key(g, 'Tab');
    expect(g._focusRow).toBe(1);
    expect(g._focusCol).toBe(0);
  });
  it('shift+tab reverse wraps and commits', () => {
    const g = makeGrid(3, 2);
    g.commitActiveRowEdit = vi.fn();
    g._focusRow = 1;
    g._focusCol = 0;
    key(g, 'Tab', { shiftKey: true });
    expect(g._focusRow).toBe(0);
    expect(g._focusCol).toBe(1);
  });
  it('home/end navigation moves to first/last column', () => {
    const g = makeGrid(2, 4);
    key(g, 'End');
    expect(g._focusCol).toBe(3);
    key(g, 'Home');
    expect(g._focusCol).toBe(0);
  });
  it('CTRL+Home navigates to first row, first cell', () => {
    const g = makeGrid(10, 5);
    g._focusRow = 5;
    g._focusCol = 3;
    key(g, 'Home', { ctrlKey: true });
    expect(g._focusRow).toBe(0);
    expect(g._focusCol).toBe(0);
  });
  it('CTRL+End navigates to last row, last cell', () => {
    const g = makeGrid(10, 5);
    g._focusRow = 2;
    g._focusCol = 1;
    key(g, 'End', { ctrlKey: true });
    expect(g._focusRow).toBe(9);
    expect(g._focusCol).toBe(4);
  });
  it('CTRL+Home/End commits active row edit', () => {
    const g = makeGrid(10, 5);
    g._focusRow = 5;
    g._focusCol = 3;
    g._activeEditRows = 5;
    g.commitActiveRowEdit = vi.fn();
    key(g, 'Home', { ctrlKey: true });
    expect(g.commitActiveRowEdit).toHaveBeenCalledTimes(1);
    g._focusRow = 5;
    g._focusCol = 3;
    g._activeEditRows = 5;
    key(g, 'End', { ctrlKey: true });
    expect(g.commitActiveRowEdit).toHaveBeenCalledTimes(2);
  });
  // NEW TESTS FOR ADDITIONAL BRANCHES
  it('shift+tab simple decrement without wrap and no commit', () => {
    const g = makeGrid(2, 3);
    g._focusRow = 0;
    g._focusCol = 2;
    g.commitActiveRowEdit = vi.fn();
    key(g, 'Tab', { shiftKey: true });
    expect(g._focusCol).toBe(1);
    expect(g.commitActiveRowEdit).not.toHaveBeenCalled();
  });
  it('tab at last cell last row still commits but does not move beyond', () => {
    const g = makeGrid(2, 2);
    g._focusRow = 1;
    g._focusCol = 1;
    g.commitActiveRowEdit = vi.fn();
    key(g, 'Tab');
    expect(g._focusRow).toBe(1);
    expect(g._focusCol).toBe(1); // stays put
    expect(g.commitActiveRowEdit).toHaveBeenCalledTimes(1);
  });
  it('arrow down while editing commits active row edit', () => {
    const g = makeGrid(5, 2);
    g._focusRow = 1;
    g._activeEditRows = 1;
    g.commitActiveRowEdit = vi.fn();
    key(g, 'ArrowDown');
    expect(g.commitActiveRowEdit).toHaveBeenCalled();
    expect(g._focusRow).toBe(2);
  });
  it('editing select column swallows ArrowDown without commit or movement', () => {
    const g = makeGrid(5, 2);
    g._columns[0].type = 'select';
    g._focusCol = 0;
    g._activeEditRows = 0;
    g.commitActiveRowEdit = vi.fn();
    g._focusRow = 0;
    key(g, 'ArrowDown');
    expect(g.commitActiveRowEdit).not.toHaveBeenCalled();
    expect(g._focusRow).toBe(0); // unchanged
  });
  it('Home/End inside input form field early-return without moving', () => {
    const g = makeGrid(2, 4);
    g._focusCol = 2;
    const input = document.createElement('input');
    key(g, 'End', { target: input });
    expect(g._focusCol).toBe(2); // unchanged because early return
    key(g, 'Home', { target: input });
    expect(g._focusCol).toBe(2); // unchanged
  });
  it('ArrowUp/Down inside number input early return no movement', () => {
    const g = makeGrid(5, 2);
    g._focusRow = 3;
    const input = document.createElement('input');
    input.type = 'number';
    key(g, 'ArrowDown', { target: input });
    expect(g._focusRow).toBe(3);
    key(g, 'ArrowUp', { target: input });
    expect(g._focusRow).toBe(3);
  });
  it('PageDown and PageUp move by 20 and clamp', () => {
    const g = makeGrid(50, 2);
    g._focusRow = 0;
    key(g, 'PageDown');
    expect(g._focusRow).toBe(20);
    key(g, 'PageUp');
    expect(g._focusRow).toBe(0);
    g._focusRow = 40;
    key(g, 'PageDown');
    expect(g._focusRow).toBe(49); // clamped to last row (49)
  });
  // NOTE: Enter key editing is now handled by EditingPlugin, not core keyboard handler
  it('Enter dispatches activate-cell event', () => {
    const g = makeGrid(5, 2);
    const events: CustomEvent[] = [];
    g.dispatchEvent = (ev: Event) => {
      events.push(ev as CustomEvent);
      return true;
    };
    key(g, 'Enter');
    const activate = events.find((e) => e.type === 'activate-cell');
    expect(activate).toBeTruthy();
    expect(activate!.detail).toEqual({ row: 0, col: 0 });
  });
  it('Enter does not block keyboard navigation', () => {
    const g = makeGrid(5, 2);
    g._focusRow = 0;
    // Press Enter - should not prevent further navigation
    key(g, 'Enter');
    // Arrow Down should still work
    key(g, 'ArrowDown');
    expect(g._focusRow).toBe(1);
  });

  describe('Home/End scroll behavior', () => {
    function makeGridWithScrollArea(rows = 5, cols = 10) {
      // Create a grid with a mock scroll area element
      const scrollArea = document.createElement('div');
      scrollArea.className = 'tbw-scroll-area';
      // Mock scroll dimensions
      Object.defineProperty(scrollArea, 'scrollWidth', { value: 1000, configurable: true });
      Object.defineProperty(scrollArea, 'clientWidth', { value: 500, configurable: true });
      scrollArea.scrollLeft = 250; // Start in the middle

      const bodyEl = document.createElement('div');
      // Create mock rows with cells
      for (let r = 0; r < rows; r++) {
        const row = document.createElement('div');
        row.className = 'data-grid-row';
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          row.appendChild(cell);
        }
        bodyEl.appendChild(row);
      }

      const grid: any = {
        _rows: Array.from({ length: rows }, (_, i) => ({ id: i })),
        _columns: Array.from({ length: cols }, (_, i) => ({ field: 'c' + i })),
        get _visibleColumns() {
          return this._columns;
        },
        _focusRow: 0,
        _focusCol: 5, // Start in the middle column
        _virtualization: { enabled: false, start: 0, end: rows },
        _bodyEl: bodyEl,
        // Mock querySelector for light DOM grid element
        querySelector: (selector: string) => {
          if (selector === '.tbw-scroll-area') return scrollArea;
          return null;
        },
        refreshVirtualWindow: () => {
          /* empty */
        },
        focus: () => {
          /* mock focus for ensureCellVisible */
        },
        getHorizontalScrollOffsets: () => ({ left: 100, right: 100, skipScroll: false }),
      };
      return { grid, scrollArea };
    }

    it('Home key scrolls to far left (scrollLeft = 0)', () => {
      const { grid, scrollArea } = makeGridWithScrollArea();
      scrollArea.scrollLeft = 500; // Start scrolled right
      key(grid, 'Home');
      expect(scrollArea.scrollLeft).toBe(0);
    });

    it('End key scrolls to far right (scrollLeft = scrollWidth - clientWidth)', () => {
      const { grid, scrollArea } = makeGridWithScrollArea();
      scrollArea.scrollLeft = 0; // Start scrolled left
      key(grid, 'End');
      expect(scrollArea.scrollLeft).toBe(500); // 1000 - 500
    });

    it('Home key scrolls left even when target cell is pinned (would normally skip scroll)', () => {
      const { grid, scrollArea } = makeGridWithScrollArea();
      // Make getHorizontalScrollOffsets return skipScroll: true (as if first column is pinned)
      grid.getHorizontalScrollOffsets = () => ({ left: 100, right: 0, skipScroll: true });
      scrollArea.scrollLeft = 500;
      key(grid, 'Home');
      // Should still scroll to 0 because Home forces scroll
      expect(scrollArea.scrollLeft).toBe(0);
    });

    it('CTRL+Home scrolls to far left and navigates to first row', () => {
      const { grid, scrollArea } = makeGridWithScrollArea();
      grid._focusRow = 3;
      grid._focusCol = 5;
      scrollArea.scrollLeft = 500;
      key(grid, 'Home', { ctrlKey: true });
      expect(grid._focusRow).toBe(0);
      expect(grid._focusCol).toBe(0);
      expect(scrollArea.scrollLeft).toBe(0);
    });

    it('CTRL+End scrolls to far right and navigates to last row', () => {
      const { grid, scrollArea } = makeGridWithScrollArea();
      grid._focusRow = 0;
      grid._focusCol = 0;
      scrollArea.scrollLeft = 0;
      key(grid, 'End', { ctrlKey: true });
      expect(grid._focusRow).toBe(4); // 5 rows, last is index 4
      expect(grid._focusCol).toBe(9); // 10 cols, last is index 9
      expect(scrollArea.scrollLeft).toBe(500); // 1000 - 500
    });
  });

  describe('activate-cell event', () => {
    it('dispatches activate-cell event on Enter key with correct detail', () => {
      const grid = makeGrid(3, 3);
      grid._focusRow = 1;
      grid._focusCol = 2;

      key(grid, 'Enter');

      // The mock grid captures events in __events array
      const activateEvent = grid.__events.find((e: CustomEvent) => e.type === 'activate-cell');
      expect(activateEvent).toBeDefined();
      expect(activateEvent.detail.row).toBe(1);
      expect(activateEvent.detail.col).toBe(2);
    });

    it('dispatches cancelable activate-cell event', () => {
      const grid = makeGrid(3, 3);
      grid._focusRow = 1;
      grid._focusCol = 1;

      key(grid, 'Enter');

      const activateEvent = grid.__events.find((e: CustomEvent) => e.type === 'activate-cell');
      expect(activateEvent).toBeDefined();
      expect(activateEvent.cancelable).toBe(true);
    });

    it('prevents keyboard default when event.preventDefault() is called', () => {
      // Override dispatchEvent to simulate preventDefault
      const grid = makeGrid(3, 3);
      grid._focusRow = 1;
      grid._focusCol = 1;
      grid.dispatchEvent = (ev: CustomEvent) => {
        grid.__events.push(ev);
        // Simulate consumer calling preventDefault
        ev.preventDefault();
        return false;
      };

      const e = key(grid, 'Enter');

      // The keyboard handler should have called preventDefault on the original keydown event
      expect(e.defaultPrevented).toBe(true);
    });
  });

  describe('focus management', () => {
    /**
     * Create a grid mock with real DOM elements so focus behavior can be tested.
     * The grid element itself is an ordinary div with tabindex=0 that acts as
     * the host element (standing in for <tbw-grid>).
     */
    function makeGridWithDOM(rows = 5, cols = 3) {
      const gridEl = document.createElement('div');
      gridEl.tabIndex = 0;
      document.body.appendChild(gridEl);

      const bodyEl = document.createElement('div');
      gridEl.appendChild(bodyEl);

      for (let r = 0; r < rows; r++) {
        const rowEl = document.createElement('div');
        rowEl.className = 'data-grid-row';
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.setAttribute('data-row', String(r));
          cell.setAttribute('data-col', String(c));
          rowEl.appendChild(cell);
        }
        bodyEl.appendChild(rowEl);
      }

      // Build a mock InternalGrid backed by the real DOM
      const grid: any = Object.create(gridEl);
      Object.assign(grid, {
        _rows: Array.from({ length: rows }, (_, i) => ({ id: i })),
        _columns: Array.from({ length: cols }, (_, i) => ({ field: 'c' + i })),
        get _visibleColumns() {
          return this._columns;
        },
        _focusRow: 0,
        _focusCol: 0,
        _virtualization: { enabled: false, start: 0, end: rows },
        _bodyEl: bodyEl,
        refreshVirtualWindow: () => false,
        querySelector: (sel: string) => gridEl.querySelector(sel),
        dispatchEvent: (ev: Event) => gridEl.dispatchEvent(ev),
        focus: (opts?: FocusOptions) => gridEl.focus(opts),
      });
      return { grid, gridEl, bodyEl };
    }

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('ArrowDown keeps focus on the grid element, not individual cells', () => {
      const { grid, gridEl } = makeGridWithDOM();
      gridEl.focus();
      expect(document.activeElement).toBe(gridEl);

      key(grid, 'ArrowDown');

      // Focus should remain on the grid element — NOT on a cell.
      // Focusing cells directly risks losing focus to <body> when cells are
      // detached by virtualization recycling.
      expect(document.activeElement).toBe(gridEl);
      expect(grid._focusRow).toBe(1);
    });

    it('Shift+ArrowDown keeps focus on grid element', () => {
      const { grid, gridEl } = makeGridWithDOM();
      gridEl.focus();

      key(grid, 'ArrowDown', { shiftKey: true });

      expect(document.activeElement).toBe(gridEl);
      expect(grid._focusRow).toBe(1);
    });

    it('Tab keeps focus on grid element when not editing', () => {
      const { grid, gridEl } = makeGridWithDOM();
      gridEl.focus();

      key(grid, 'Tab');

      expect(document.activeElement).toBe(gridEl);
    });

    it('ArrowDown focuses editor when in editing mode', () => {
      const { grid, gridEl, bodyEl } = makeGridWithDOM(5, 2);
      grid._activeEditRows = 1;
      grid.commitActiveRowEdit = vi.fn();

      // Mark the target cell (row 2, col 0) as editing with a focusable editor
      const targetRow = bodyEl.querySelectorAll('.data-grid-row')[2];
      const targetCell = targetRow.querySelector('.cell[data-col="0"]') as HTMLElement;
      targetCell.classList.add('editing');
      const input = document.createElement('input');
      input.type = 'text';
      targetCell.appendChild(input);

      gridEl.focus();
      grid._focusRow = 1;
      grid._focusCol = 0;

      key(grid, 'ArrowDown');

      // Should focus the editor input inside the editing cell
      expect(document.activeElement).toBe(input);
    });
  });
});
