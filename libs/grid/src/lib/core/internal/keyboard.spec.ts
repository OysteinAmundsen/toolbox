import { describe, expect, it, vi } from 'vitest';
import { handleGridKeyDown } from './keyboard';

function key(grid: any, k: string, opts: any = {}) {
  const e: any = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, shiftKey: !!opts.shiftKey });
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
      get visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      focusRow: 0,
      focusCol: 0,
      virtualization: { enabled: false, start: 0, end: rows },
      bodyEl: document.createElement('div'),
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
    expect(g.focusCol).toBe(1);
    key(g, 'ArrowLeft');
    expect(g.focusCol).toBe(0);
    key(g, 'ArrowUp');
    expect(g.focusRow).toBe(0);
    key(g, 'ArrowDown');
    expect(g.focusRow).toBe(1);
  });
  it('tab forward wraps to next row and commits', () => {
    const g = makeGrid(3, 2);
    g.commitActiveRowEdit = vi.fn();
    g.focusCol = 1;
    key(g, 'Tab');
    expect(g.focusRow).toBe(1);
    expect(g.focusCol).toBe(0);
  });
  it('shift+tab reverse wraps and commits', () => {
    const g = makeGrid(3, 2);
    g.commitActiveRowEdit = vi.fn();
    g.focusRow = 1;
    g.focusCol = 0;
    key(g, 'Tab', { shiftKey: true });
    expect(g.focusRow).toBe(0);
    expect(g.focusCol).toBe(1);
  });
  it('home/end navigation moves to first/last column', () => {
    const g = makeGrid(2, 4);
    key(g, 'End');
    expect(g.focusCol).toBe(3);
    key(g, 'Home');
    expect(g.focusCol).toBe(0);
  });
  // NEW TESTS FOR ADDITIONAL BRANCHES
  it('shift+tab simple decrement without wrap and no commit', () => {
    const g = makeGrid(2, 3);
    g.focusRow = 0;
    g.focusCol = 2;
    g.commitActiveRowEdit = vi.fn();
    key(g, 'Tab', { shiftKey: true });
    expect(g.focusCol).toBe(1);
    expect(g.commitActiveRowEdit).not.toHaveBeenCalled();
  });
  it('tab at last cell last row still commits but does not move beyond', () => {
    const g = makeGrid(2, 2);
    g.focusRow = 1;
    g.focusCol = 1;
    g.commitActiveRowEdit = vi.fn();
    key(g, 'Tab');
    expect(g.focusRow).toBe(1);
    expect(g.focusCol).toBe(1); // stays put
    expect(g.commitActiveRowEdit).toHaveBeenCalledTimes(1);
  });
  it('arrow down while editing commits active row edit', () => {
    const g = makeGrid(5, 2);
    g.focusRow = 1;
    g.activeEditRows = 1;
    g.commitActiveRowEdit = vi.fn();
    key(g, 'ArrowDown');
    expect(g.commitActiveRowEdit).toHaveBeenCalled();
    expect(g.focusRow).toBe(2);
  });
  it('editing select column swallows ArrowDown without commit or movement', () => {
    const g = makeGrid(5, 2);
    g._columns[0].type = 'select';
    g.focusCol = 0;
    g.activeEditRows = 0;
    g.commitActiveRowEdit = vi.fn();
    g.focusRow = 0;
    key(g, 'ArrowDown');
    expect(g.commitActiveRowEdit).not.toHaveBeenCalled();
    expect(g.focusRow).toBe(0); // unchanged
  });
  it('Home/End inside input form field early-return without moving', () => {
    const g = makeGrid(2, 4);
    g.focusCol = 2;
    const input = document.createElement('input');
    key(g, 'End', { target: input });
    expect(g.focusCol).toBe(2); // unchanged because early return
    key(g, 'Home', { target: input });
    expect(g.focusCol).toBe(2); // unchanged
  });
  it('ArrowUp/Down inside number input early return no movement', () => {
    const g = makeGrid(5, 2);
    g.focusRow = 3;
    const input = document.createElement('input');
    input.type = 'number';
    key(g, 'ArrowDown', { target: input });
    expect(g.focusRow).toBe(3);
    key(g, 'ArrowUp', { target: input });
    expect(g.focusRow).toBe(3);
  });
  it('PageDown and PageUp move by 20 and clamp', () => {
    const g = makeGrid(50, 2);
    g.focusRow = 0;
    key(g, 'PageDown');
    expect(g.focusRow).toBe(20);
    key(g, 'PageUp');
    expect(g.focusRow).toBe(0);
    g.focusRow = 40;
    key(g, 'PageDown');
    expect(g.focusRow).toBe(49); // clamped to last row (49)
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
});
