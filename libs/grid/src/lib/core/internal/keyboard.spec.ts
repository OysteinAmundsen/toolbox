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
  it('Enter invokes beginBulkEdit when provided', () => {
    const g = makeGrid(5, 2);
    g.beginBulkEdit = vi.fn();
    key(g, 'Enter');
    expect(g.beginBulkEdit).toHaveBeenCalledWith(0);
  });
  it('Enter dispatches activate-cell when no beginBulkEdit', () => {
    const g = makeGrid(5, 2);
    const events: any[] = [];
    g.dispatchEvent = (ev: any) => events.push(ev);
    key(g, 'Enter');
    const activate = events.find((e) => e.type === 'activate-cell');
    expect(activate).toBeTruthy();
    expect(activate.detail).toEqual({ row: 0, col: 0 });
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

      const shadowRoot = {
        querySelector: (selector: string) => {
          if (selector === '.tbw-scroll-area') return scrollArea;
          return null;
        },
        querySelectorAll: () => [],
      };

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
        shadowRoot,
        refreshVirtualWindow: () => {
          /* empty */
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
});
