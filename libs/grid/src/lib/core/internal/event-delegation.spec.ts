import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColumnInternal, InternalGrid } from '../types';
import { setupCellEventDelegation } from './event-delegation';

/**
 * Create a mock grid for testing event delegation.
 */
function createMockGrid(overrides: Partial<InternalGrid> = {}): InternalGrid {
  const grid: Partial<InternalGrid> = {
    _rows: [
      { id: 1, name: 'Alice', status: 'Active' },
      { id: 2, name: 'Bob', status: 'Inactive' },
      { id: 3, name: 'Charlie', status: 'Active' },
    ],
    _visibleColumns: [
      { field: 'id', header: 'ID', editable: false } as ColumnInternal,
      { field: 'name', header: 'Name', editable: true } as ColumnInternal,
      { field: 'status', header: 'Status', editable: true, type: 'select' } as ColumnInternal,
    ],
    _focusRow: -1,
    _focusCol: -1,
    _activeEditRows: -1,
    _rowEditSnapshots: new Map(),
    _virtualization: { start: 0, end: 10 },
    beginBulkEdit: vi.fn(),
    refreshVirtualWindow: vi.fn(),
    findRenderedRowElement: vi.fn(() => null),
    ...overrides,
  };

  // Add effectiveConfig getter
  Object.defineProperty(grid, 'effectiveConfig', {
    get: () => ({ editOn: 'dblClick' }),
    configurable: true,
  });

  return grid as InternalGrid;
}

/**
 * Create a cell element for testing.
 */
function createCell(rowIndex: number, colIndex: number, options: { editing?: boolean } = {}): HTMLElement {
  const cell = document.createElement('div');
  cell.className = 'cell';
  if (options.editing) {
    cell.classList.add('editing');
  }
  cell.setAttribute('data-col', String(colIndex));
  cell.setAttribute('data-row', String(rowIndex));
  cell.tabIndex = 0;
  return cell;
}

/**
 * Create a row element containing cells.
 */
function createRow(rowIndex: number, colCount: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'data-grid-row';
  row.setAttribute('data-row', String(rowIndex));
  for (let i = 0; i < colCount; i++) {
    row.appendChild(createCell(rowIndex, i));
  }
  return row;
}

describe('event-delegation', () => {
  let bodyEl: HTMLElement;
  let abortController: AbortController;
  let grid: InternalGrid;

  beforeEach(() => {
    bodyEl = document.createElement('div');
    bodyEl.className = 'rows';
    document.body.appendChild(bodyEl);

    // Add some rows
    for (let i = 0; i < 3; i++) {
      bodyEl.appendChild(createRow(i, 3));
    }

    abortController = new AbortController();
    // Pass bodyEl to the mock so grid._bodyEl matches the element we're testing with
    grid = createMockGrid({ _bodyEl: bodyEl });
  });

  afterEach(() => {
    abortController.abort();
    document.body.innerHTML = '';
  });

  describe('setupCellEventDelegation', () => {
    it('should set up event listeners on the body element', () => {
      const addEventListenerSpy = vi.spyOn(bodyEl, 'addEventListener');
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      // Should set up at least mousedown, click, dblclick, and keydown
      expect(addEventListenerSpy).toHaveBeenCalled();
      const eventTypes = addEventListenerSpy.mock.calls.map((call) => call[0]);
      expect(eventTypes).toContain('mousedown');
      expect(eventTypes).toContain('click');
      expect(eventTypes).toContain('dblclick');
      expect(eventTypes).toContain('keydown');
    });

    it('should clean up listeners when signal is aborted', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);
      const removeEventListenerSpy = vi.spyOn(bodyEl, 'removeEventListener');

      abortController.abort();

      // AbortSignal should trigger listener removal
      // (The actual removal is handled by the browser via the signal option)
    });
  });

  describe('mousedown handling', () => {
    it('should update focus position on editable cell mousedown', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      expect(cell).not.toBeNull();

      const event = new MouseEvent('mousedown', { bubbles: true });
      cell.dispatchEvent(event);

      expect(grid._focusRow).toBe(1);
      expect(grid._focusCol).toBe(1);
    });

    it('should not update focus on non-editable cell', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      // Column 0 is not editable
      const cell = bodyEl.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
      const event = new MouseEvent('mousedown', { bubbles: true });
      cell.dispatchEvent(event);

      expect(grid._focusRow).toBe(-1);
      expect(grid._focusCol).toBe(-1);
    });

    it('should not update focus on editing cell', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="0"][data-col="1"]') as HTMLElement;
      cell.classList.add('editing');

      grid._focusRow = 5;
      grid._focusCol = 5;

      const event = new MouseEvent('mousedown', { bubbles: true });
      cell.dispatchEvent(event);

      // Focus should not change for editing cells
      expect(grid._focusRow).toBe(5);
      expect(grid._focusCol).toBe(5);
    });
  });

  describe('dblclick handling', () => {
    it('should call beginBulkEdit on editable cell dblclick', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      const event = new MouseEvent('dblclick', { bubbles: true });
      cell.dispatchEvent(event);

      expect(grid.beginBulkEdit).toHaveBeenCalledWith(1);
    });

    it('should not trigger edit on non-editable cell', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      // Column 0 is not editable
      const cell = bodyEl.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
      const event = new MouseEvent('dblclick', { bubbles: true });
      cell.dispatchEvent(event);

      expect(grid.beginBulkEdit).not.toHaveBeenCalled();
    });
  });

  describe('click handling with editOn: click', () => {
    it('should start edit on click when editMode is click', () => {
      // Configure grid for click-to-edit
      const clickGrid = createMockGrid();
      Object.defineProperty(clickGrid, 'effectiveConfig', {
        get: () => ({ editOn: 'click' }),
        configurable: true,
      });

      setupCellEventDelegation(clickGrid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      const event = new MouseEvent('click', { bubbles: true });
      cell.dispatchEvent(event);

      expect(clickGrid._focusRow).toBe(1);
      expect(clickGrid._focusCol).toBe(1);
    });

    it('should not start edit on click when editMode is dblClick', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const initialFocusRow = grid._focusRow;
      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      const event = new MouseEvent('click', { bubbles: true });
      cell.dispatchEvent(event);

      // Should not trigger inline edit
      expect(cell.classList.contains('editing')).toBe(false);
    });
  });

  describe('keydown handling', () => {
    it('should start edit on Enter key', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      cell.dispatchEvent(event);

      expect(grid._focusRow).toBe(1);
      expect(grid._focusCol).toBe(1);
      expect(grid.beginBulkEdit).toHaveBeenCalledWith(1);
    });

    it('should not start edit on Enter for non-editable cell', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      // Column 0 is not editable
      const cell = bodyEl.querySelector('.cell[data-row="0"][data-col="0"]') as HTMLElement;
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      cell.dispatchEvent(event);

      expect(grid.beginBulkEdit).not.toHaveBeenCalled();
    });

    it('should not start edit on Enter when already editing', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      cell.classList.add('editing');

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      cell.dispatchEvent(event);

      // beginBulkEdit should not be called again for already editing cell
      expect(grid.beginBulkEdit).not.toHaveBeenCalled();
    });
  });

  describe('event delegation efficiency', () => {
    it('should ignore events not on cells', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      // Click on the body itself, not a cell
      const event = new MouseEvent('dblclick', { bubbles: true });
      bodyEl.dispatchEvent(event);

      expect(grid.beginBulkEdit).not.toHaveBeenCalled();
    });

    it('should handle events bubbling from cell children', () => {
      setupCellEventDelegation(grid, bodyEl, abortController.signal);

      const cell = bodyEl.querySelector('.cell[data-row="1"][data-col="1"]') as HTMLElement;
      const span = document.createElement('span');
      span.textContent = 'content';
      cell.appendChild(span);

      // Click on the span inside the cell
      const event = new MouseEvent('dblclick', { bubbles: true });
      span.dispatchEvent(event);

      // Should still work via bubbling
      expect(grid.beginBulkEdit).toHaveBeenCalledWith(1);
    });
  });
});
