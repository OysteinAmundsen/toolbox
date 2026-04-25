/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROW_DRAG_HANDLE_FIELD, RowDragDropPlugin } from './RowDragDropPlugin';
import type { RowMoveDetail } from './types';

// Helper to create a minimal grid mock
function createGridMock(rows: any[] = []) {
  const bodyEl = document.createElement('div');
  const mock = {
    rows,
    sourceRows: rows, // sourceRows returns the original rows
    _focusRow: 0,
    _focusCol: 0,
    _columns: [] as any[],
    _bodyEl: bodyEl,
    _virtualization: { enabled: false, start: 0, end: rows.length },
    gridConfig: {},
    getPlugin: () => undefined,
    queryPlugins: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    requestRender: vi.fn(),
    refreshVirtualWindow: vi.fn(),
    children: [document.createElement('div')],
    querySelectorAll: () => [],
    querySelector: () => null,
    clientWidth: 800,
    classList: { add: vi.fn(), remove: vi.fn() },
  };
  return mock;
}

describe('RowDragDropPlugin', () => {
  describe('constructor', () => {
    it('should create plugin with default config', () => {
      const plugin = new RowDragDropPlugin();
      expect(plugin.name).toBe('rowDragDrop');
    });

    it('should accept custom config', () => {
      const plugin = new RowDragDropPlugin({
        enableKeyboard: false,
        showDragHandle: false,
        debounceMs: 500,
      });
      expect(plugin.name).toBe('rowDragDrop');
    });
  });

  describe('processColumns', () => {
    it('should add drag handle column at the start by default', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }, { field: 'name' }];
      const result = plugin.processColumns(columns);

      expect(result.length).toBe(3);
      expect(result[0].field).toBe(ROW_DRAG_HANDLE_FIELD);
      expect(result[1].field).toBe('id');
      expect(result[2].field).toBe('name');
    });

    it('should add drag handle column at the end when position is right', () => {
      const plugin = new RowDragDropPlugin({ dragHandlePosition: 'right' });
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }, { field: 'name' }];
      const result = plugin.processColumns(columns);

      expect(result.length).toBe(3);
      expect(result[0].field).toBe('id');
      expect(result[1].field).toBe('name');
      expect(result[2].field).toBe(ROW_DRAG_HANDLE_FIELD);
    });

    it('should not add drag handle column when showDragHandle is false', () => {
      const plugin = new RowDragDropPlugin({ showDragHandle: false });
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }, { field: 'name' }];
      const result = plugin.processColumns(columns);

      expect(result.length).toBe(2);
      expect(result[0].field).toBe('id');
      expect(result[1].field).toBe('name');
    });

    it('should mark drag handle column as utility column', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }];
      const result = plugin.processColumns(columns);

      const dragCol = result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD);
      expect(dragCol?.utility).toBe(true);
      expect(dragCol?.lockPosition).toBe(true);
    });

    it('should use custom dragHandleWidth', () => {
      const plugin = new RowDragDropPlugin({ dragHandleWidth: 60 });
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }];
      const result = plugin.processColumns(columns);

      const dragCol = result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD);
      expect(dragCol?.width).toBe(60);
    });

    it('should create viewRenderer that returns drag handle element', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }];
      const result = plugin.processColumns(columns);

      const dragCol = result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD);
      expect(dragCol?.viewRenderer).toBeDefined();

      const element = dragCol!.viewRenderer!({} as any);
      expect(element).toBeInstanceOf(HTMLElement);
      expect(element.classList.contains('dg-row-drag-handle')).toBe(true);
    });
  });

  describe('canMoveRow', () => {
    it('should return true for valid moves', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      plugin.attach(grid as any);

      expect(plugin.canMoveRow(0, 1)).toBe(true);
      expect(plugin.canMoveRow(2, 0)).toBe(true);
    });

    it('should return false for out of bounds', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      expect(plugin.canMoveRow(-1, 0)).toBe(false);
      expect(plugin.canMoveRow(0, 5)).toBe(false);
      expect(plugin.canMoveRow(0, -1)).toBe(false);
    });

    it('should return false when moving to same position', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      expect(plugin.canMoveRow(1, 1)).toBe(false);
    });

    it('should respect canMove callback', () => {
      const canMove = vi.fn().mockReturnValue(false);
      const plugin = new RowDragDropPlugin({ canMove });
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      expect(plugin.canMoveRow(0, 1)).toBe(false);
      expect(canMove).toHaveBeenCalledWith({ id: 1 }, 0, 1, 'down');
    });
  });

  describe('moveRow', () => {
    it('should emit row-move event with correct detail', () => {
      const plugin = new RowDragDropPlugin();
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const grid = createGridMock(rows);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveRow(0, 2);

      expect(grid.dispatchEvent).toHaveBeenCalled();
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<RowMoveDetail<any>>;
      expect(event.type).toBe('row-move');
      expect(event.detail.fromIndex).toBe(0);
      expect(event.detail.toIndex).toBe(2);
      expect(event.detail.row).toEqual({ id: 1 });
      expect(event.detail.source).toBe('keyboard');
      expect(event.detail.rows).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
    });

    it('should update grid.rows when event is not cancelled', () => {
      const plugin = new RowDragDropPlugin();
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const grid = createGridMock(rows);
      grid.dispatchEvent = vi.fn(() => true); // Not cancelled
      plugin.attach(grid as any);

      plugin.moveRow(0, 2);

      expect(grid.rows).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
    });

    it('should not update grid.rows when event is cancelled', () => {
      const plugin = new RowDragDropPlugin();
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const grid = createGridMock(rows);
      // Simulate event cancellation by calling preventDefault
      grid.dispatchEvent = vi.fn((event: Event) => {
        event.preventDefault();
        return false;
      });
      plugin.attach(grid as any);

      plugin.moveRow(0, 2);

      expect(grid.rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('should not move when canMove returns false', () => {
      const canMove = vi.fn().mockReturnValue(false);
      const plugin = new RowDragDropPlugin({ canMove });
      const rows = [{ id: 1 }, { id: 2 }];
      const grid = createGridMock(rows);
      plugin.attach(grid as any);

      plugin.moveRow(0, 1);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should not move for same index', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      plugin.moveRow(1, 1);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe('onKeyDown', () => {
    let plugin: RowDragDropPlugin;
    let grid: ReturnType<typeof createGridMock>;

    beforeEach(() => {
      plugin = new RowDragDropPlugin({ debounceMs: 0 }); // Disable debounce for testing
      grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);
    });

    afterEach(() => {
      plugin.detach();
    });

    it('should handle Ctrl+ArrowUp to move row up', () => {
      grid._focusRow = 1;
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        ctrlKey: true,
        bubbles: true,
      });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });

      const result = plugin.onKeyDown(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should handle Ctrl+ArrowDown to move row down', () => {
      grid._focusRow = 1;
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        ctrlKey: true,
        bubbles: true,
      });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });

      const result = plugin.onKeyDown(event);

      expect(result).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not handle when Ctrl is not pressed', () => {
      grid._focusRow = 1;
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        ctrlKey: false,
        bubbles: true,
      });

      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not handle non-arrow keys', () => {
      grid._focusRow = 1;
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        ctrlKey: true,
        bubbles: true,
      });

      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not move row up when at top', () => {
      grid._focusRow = 0;
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        ctrlKey: true,
        bubbles: true,
      });

      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not move row down when at bottom', () => {
      grid._focusRow = 2;
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        ctrlKey: true,
        bubbles: true,
      });

      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not handle when enableKeyboard is false', () => {
      const disabledPlugin = new RowDragDropPlugin({ enableKeyboard: false });
      disabledPlugin.attach(grid as any);
      grid._focusRow = 1;

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        ctrlKey: true,
        bubbles: true,
      });

      const result = disabledPlugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });
  });

  describe('debouncing', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce rapid keyboard moves', () => {
      const plugin = new RowDragDropPlugin({ debounceMs: 300 });
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      const grid = createGridMock(rows);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      // Simulate rapid Ctrl+Down presses
      grid._focusRow = 0;
      const event1 = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true });
      Object.defineProperty(event1, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event1, 'stopPropagation', { value: vi.fn() });
      plugin.onKeyDown(event1);

      grid._focusRow = 1;
      const event2 = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true });
      Object.defineProperty(event2, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event2, 'stopPropagation', { value: vi.fn() });
      plugin.onKeyDown(event2);

      // Should not have emitted event yet
      expect(grid.dispatchEvent).not.toHaveBeenCalled();

      // Advance timers past debounce period
      vi.advanceTimersByTime(300);

      // Now should have emitted a single event
      expect(grid.dispatchEvent).toHaveBeenCalledTimes(1);
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<RowMoveDetail<any>>;
      expect(event.detail.fromIndex).toBe(0);
      expect(event.detail.toIndex).toBe(2); // Moved from 0 → 1 → 2
    });
  });

  describe('detach', () => {
    it('should clear internal state on detach', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      plugin.detach();

      // Plugin should be in clean state (no throws)
      expect(() => plugin.canMoveRow(0, 1)).not.toThrow();
    });

    it('should clear pending debounce timer on detach', () => {
      vi.useFakeTimers();
      const plugin = new RowDragDropPlugin({ debounceMs: 300 });
      const grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      // Start a keyboard move to create a pending debounce timer
      grid._focusRow = 0;
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
      plugin.onKeyDown(event);

      // Detach should clear the timer
      plugin.detach();

      // Advancing time should not cause any event emission
      vi.advanceTimersByTime(500);
      expect(grid.dispatchEvent).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('moveRow edge cases', () => {
    it('should not move when fromIndex is out of bounds (negative)', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      plugin.moveRow(-1, 1);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should not move when fromIndex is out of bounds (too large)', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      plugin.moveRow(5, 0);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should not move when toIndex is out of bounds', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      plugin.moveRow(0, 10);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should produce correct row order when moving up', () => {
      const plugin = new RowDragDropPlugin();
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const grid = createGridMock(rows);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveRow(2, 0);

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<RowMoveDetail<any>>;
      expect(event.detail.fromIndex).toBe(2);
      expect(event.detail.toIndex).toBe(0);
      expect(event.detail.rows).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }]);
      expect(event.detail.source).toBe('keyboard');
    });
  });

  describe('onCellClick (flush pending)', () => {
    it('should flush pending keyboard move when cell is clicked', () => {
      vi.useFakeTimers();
      const plugin = new RowDragDropPlugin({ debounceMs: 300 });
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const grid = createGridMock(rows);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      // Move a row via keyboard (creates a pending move)
      grid._focusRow = 0;
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true });
      Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
      Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
      plugin.onKeyDown(event);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();

      // Click a cell should flush the pending move immediately
      plugin.onCellClick();

      expect(grid.dispatchEvent).toHaveBeenCalledTimes(1);
      const emittedEvent = grid.dispatchEvent.mock.calls[0][0] as CustomEvent<RowMoveDetail<any>>;
      expect(emittedEvent.type).toBe('row-move');

      vi.useRealTimers();
    });

    it('should not throw when no pending move exists', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }]);
      plugin.attach(grid as any);

      expect(() => plugin.onCellClick()).not.toThrow();
    });
  });

  describe('canMove callback interactions', () => {
    it('should pass correct direction for upward move', () => {
      const canMove = vi.fn().mockReturnValue(true);
      const plugin = new RowDragDropPlugin({ canMove });
      const grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveRow(2, 0);

      expect(canMove).toHaveBeenCalledWith({ id: 3 }, 2, 0, 'up');
    });

    it('should pass correct direction for downward move', () => {
      const canMove = vi.fn().mockReturnValue(true);
      const plugin = new RowDragDropPlugin({ canMove });
      const grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveRow(0, 2);

      expect(canMove).toHaveBeenCalledWith({ id: 1 }, 0, 2, 'down');
    });

    it('should prevent keyboard moves when canMove returns false', () => {
      const canMove = vi.fn().mockReturnValue(false);
      const plugin = new RowDragDropPlugin({ canMove, debounceMs: 0 });
      const rows = [{ id: 1, locked: true }, { id: 2 }];
      const grid = createGridMock(rows);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      grid._focusRow = 0;
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true });

      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });
  });

  describe('animation config', () => {
    it('should use flip animation by default', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      // Move should succeed (animation details are internal)
      plugin.moveRow(0, 1);

      expect(grid.dispatchEvent).toHaveBeenCalled();
    });

    it('should work with animation disabled', () => {
      const plugin = new RowDragDropPlugin({ animation: false });
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      grid.dispatchEvent = vi.fn(() => true);
      plugin.attach(grid as any);

      plugin.moveRow(0, 1);

      // Should update rows directly
      expect(grid.rows).toEqual([{ id: 2 }, { id: 1 }]);
    });
  });

  describe('drag handle viewRenderer', () => {
    it('should create a draggable element', () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock([]);
      plugin.attach(grid as any);

      const result = plugin.processColumns([{ field: 'id' }]);
      const dragCol = result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD);

      const el = dragCol!.viewRenderer!({} as any);
      expect(el.draggable).toBe(true);
      expect(el.getAttribute('role')).toBe('button');
      expect(el.getAttribute('aria-label')).toBe('Drag to reorder');
      expect(el.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('aliases', () => {
    it('should expose legacy aliases for back-compat', () => {
      const plugin = new RowDragDropPlugin();
      expect(plugin.aliases).toContain('rowReorder');
      expect(plugin.aliases).toContain('reorderRows');
    });
  });

  describe('drag-and-drop events', () => {
    let plugin: RowDragDropPlugin;
    let grid: ReturnType<typeof createGridMock>;
    let gridEl: HTMLElement;

    beforeEach(() => {
      plugin = new RowDragDropPlugin();
      grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      grid.dispatchEvent = vi.fn(() => true);

      // Create DOM structure for drag targets
      gridEl = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('div');
        row.className = 'data-grid-row';
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-row', String(i));
        row.appendChild(cell);

        const handle = document.createElement('div');
        handle.className = 'dg-row-drag-handle';
        row.appendChild(handle);
        gridEl.appendChild(row);
      }
      document.body.appendChild(gridEl);

      // Set _hostElement so the plugin finds the real DOM for drag delegation
      (grid as any)._hostElement = gridEl;

      plugin.attach(grid as any);
    });

    afterEach(() => {
      plugin.detach();
      document.body.innerHTML = '';
    });

    it('should set drag state on dragstart from drag handle', () => {
      const handle = gridEl.querySelector('.dg-row-drag-handle')!;
      const row = handle.closest('.data-grid-row')!;

      const event = new Event('dragstart', { bubbles: true }) as any;
      Object.defineProperty(event, 'dataTransfer', {
        value: { effectAllowed: '', setData: vi.fn() },
        writable: true,
      });
      handle.dispatchEvent(event);

      expect(row.classList.contains('dragging')).toBe(true);
    });

    it('should clean up on dragend', () => {
      const handle = gridEl.querySelector('.dg-row-drag-handle')!;

      const startEvent = new Event('dragstart', { bubbles: true }) as any;
      Object.defineProperty(startEvent, 'dataTransfer', {
        value: { effectAllowed: '', setData: vi.fn() },
        writable: true,
      });
      handle.dispatchEvent(startEvent);

      gridEl.dispatchEvent(new Event('dragend', { bubbles: true }));

      const rows = gridEl.querySelectorAll('.data-grid-row.dragging');
      expect(rows.length).toBe(0);
    });

    it('should handle drop to execute row move', () => {
      const handle = gridEl.querySelector('.dg-row-drag-handle')!;

      const startEvent = new Event('dragstart', { bubbles: true }) as any;
      Object.defineProperty(startEvent, 'dataTransfer', {
        value: { effectAllowed: '', setData: vi.fn() },
        writable: true,
      });
      handle.dispatchEvent(startEvent);

      // Dragover on row 2's cell to set dropRowIndex
      const row2Cell = gridEl.querySelectorAll('.data-grid-row')[2].querySelector('.cell')!;
      const overEvent = new Event('dragover', { bubbles: true, cancelable: true }) as any;
      Object.defineProperty(overEvent, 'clientY', { value: 9999 });
      overEvent.preventDefault = vi.fn();
      row2Cell.dispatchEvent(overEvent);

      // Drop
      const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as any;
      dropEvent.preventDefault = vi.fn();
      gridEl.dispatchEvent(dropEvent);

      expect(grid.dispatchEvent).toHaveBeenCalled();
    });

    it('should handle dragleave to clean up target classes', () => {
      const row = gridEl.querySelector('.data-grid-row')!;
      row.classList.add('drop-target', 'drop-before', 'drop-after');

      const cell = row.querySelector('.cell')!;
      cell.dispatchEvent(new Event('dragleave', { bubbles: true }));

      expect(row.classList.contains('drop-target')).toBe(false);
    });
  });

  describe('keyboard move revert on cancel', () => {
    it('should revert position when event is cancelled', () => {
      vi.useFakeTimers();
      const plugin = new RowDragDropPlugin({ debounceMs: 100 });
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const grid = createGridMock(rows);
      // Cancel the event
      grid.dispatchEvent = vi.fn((event: Event) => {
        event.preventDefault();
        return false;
      });
      plugin.attach(grid as any);

      grid._focusRow = 0;
      const event = {
        key: 'ArrowDown',
        ctrlKey: true,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as KeyboardEvent;
      plugin.onKeyDown(event);

      // Advance past debounce
      vi.advanceTimersByTime(200);

      // Event was emitted and cancelled
      expect(grid.dispatchEvent).toHaveBeenCalledTimes(1);
      // Focus should be reverted to original position
      expect(grid._focusRow).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('styles', () => {
    it('should have styles property', () => {
      const plugin = new RowDragDropPlugin();
      expect(typeof plugin.styles).toBe('string');
    });
  });

  describe('dragFrom config', () => {
    it("defaults to 'handle' and adds the grip column", () => {
      const plugin = new RowDragDropPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);
      const result = plugin.processColumns([{ field: 'id' }]);
      expect(result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD)).toBeTruthy();
    });

    it("'row' suppresses the grip column by default", () => {
      const plugin = new RowDragDropPlugin({ dragFrom: 'row' });
      const grid = createGridMock();
      plugin.attach(grid as any);
      const result = plugin.processColumns([{ field: 'id' }]);
      expect(result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD)).toBeUndefined();
      expect(result).toHaveLength(1);
    });

    it("'row' + explicit showDragHandle: true still renders the grip", () => {
      const plugin = new RowDragDropPlugin({ dragFrom: 'row', showDragHandle: true });
      const grid = createGridMock();
      plugin.attach(grid as any);
      const result = plugin.processColumns([{ field: 'id' }]);
      expect(result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD)).toBeTruthy();
    });

    it("'both' renders the grip column", () => {
      const plugin = new RowDragDropPlugin({ dragFrom: 'both' });
      const grid = createGridMock();
      plugin.attach(grid as any);
      const result = plugin.processColumns([{ field: 'id' }]);
      expect(result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD)).toBeTruthy();
    });

    it('explicit showDragHandle: false hides the grip even with dragFrom: handle', () => {
      const plugin = new RowDragDropPlugin({ dragFrom: 'handle', showDragHandle: false });
      const grid = createGridMock();
      plugin.attach(grid as any);
      const result = plugin.processColumns([{ field: 'id' }]);
      expect(result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD)).toBeUndefined();
    });
  });

  describe('row-as-handle DOM wiring', () => {
    let plugin: RowDragDropPlugin;
    let grid: ReturnType<typeof createGridMock>;
    let gridEl: HTMLElement;

    function buildRows(): HTMLElement {
      const el = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('div');
        row.className = 'data-grid-row';
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-row', String(i));
        cell.textContent = `Row ${i}`;
        row.appendChild(cell);
        el.appendChild(row);
      }
      return el;
    }

    beforeEach(() => {
      gridEl = document.createElement('div');
      const body = buildRows();
      gridEl.appendChild(body);
      document.body.appendChild(gridEl);
      grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      grid._bodyEl = body;
      (grid as any)._hostElement = gridEl;
      grid.dispatchEvent = vi.fn(() => true);
    });

    afterEach(() => {
      plugin.detach();
      document.body.innerHTML = '';
    });

    it('does NOT set draggable on rows when dragFrom is "handle" (default)', () => {
      plugin = new RowDragDropPlugin();
      plugin.attach(grid as any);
      plugin.afterRender();
      const rows = grid._bodyEl.querySelectorAll('.data-grid-row');
      for (const row of rows) {
        expect(row.hasAttribute('draggable')).toBe(false);
      }
    });

    it('sets draggable="true" on every row when dragFrom is "row"', () => {
      plugin = new RowDragDropPlugin({ dragFrom: 'row' });
      plugin.attach(grid as any);
      plugin.afterRender();
      const rows = grid._bodyEl.querySelectorAll('.data-grid-row');
      expect(rows.length).toBe(3);
      for (const row of rows) {
        expect(row.getAttribute('draggable')).toBe('true');
      }
    });

    it('re-applies draggable after onScrollRender (virtualization recycle)', () => {
      plugin = new RowDragDropPlugin({ dragFrom: 'row' });
      plugin.attach(grid as any);
      plugin.afterRender();
      // Simulate virtualization swapping in a fresh row that lost the attribute
      const fresh = document.createElement('div');
      fresh.className = 'data-grid-row';
      grid._bodyEl.appendChild(fresh);
      expect(fresh.hasAttribute('draggable')).toBe(false);

      plugin.onScrollRender();
      expect(fresh.getAttribute('draggable')).toBe('true');
    });
  });

  describe('row-as-handle dragstart behaviour', () => {
    let plugin: RowDragDropPlugin;
    let grid: ReturnType<typeof createGridMock>;
    let gridEl: HTMLElement;

    beforeEach(() => {
      gridEl = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('div');
        row.className = 'data-grid-row';
        row.setAttribute('draggable', 'true');
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-row', String(i));
        row.appendChild(cell);
        gridEl.appendChild(row);
      }
      document.body.appendChild(gridEl);
      grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      (grid as any)._hostElement = gridEl;
      grid.dispatchEvent = vi.fn(() => true);
    });

    afterEach(() => {
      plugin.detach();
      document.body.innerHTML = '';
    });

    function dispatchDragStartFrom(target: Element): { setData: ReturnType<typeof vi.fn> } {
      const event = new Event('dragstart', { bubbles: true }) as any;
      const setData = vi.fn();
      Object.defineProperty(event, 'dataTransfer', {
        value: { effectAllowed: '', setData, setDragImage: vi.fn() },
        writable: true,
      });
      Object.defineProperty(event, 'clientX', { value: 0, configurable: true });
      Object.defineProperty(event, 'clientY', { value: 0, configurable: true });
      target.dispatchEvent(event);
      return { setData };
    }

    it('starts a drag from any cell when dragFrom is "row"', () => {
      plugin = new RowDragDropPlugin({ dragFrom: 'row' });
      plugin.attach(grid as any);
      const cell = gridEl.querySelectorAll('.data-grid-row')[1].querySelector('.cell')!;
      dispatchDragStartFrom(cell);
      const draggingRow = gridEl.querySelector('.data-grid-row.dragging');
      expect(draggingRow).toBe(cell.closest('.data-grid-row'));
    });

    it('does NOT start a drag from a cell when dragFrom is "handle" (default)', () => {
      plugin = new RowDragDropPlugin();
      plugin.attach(grid as any);
      const cell = gridEl.querySelectorAll('.data-grid-row')[1].querySelector('.cell')!;
      dispatchDragStartFrom(cell);
      expect(gridEl.querySelector('.data-grid-row.dragging')).toBeNull();
    });

    it('suppresses drag when origin is an interactive element (button)', () => {
      plugin = new RowDragDropPlugin({ dragFrom: 'row' });
      plugin.attach(grid as any);
      const cell = gridEl.querySelectorAll('.data-grid-row')[0].querySelector('.cell')!;
      const btn = document.createElement('button');
      cell.appendChild(btn);
      dispatchDragStartFrom(btn);
      expect(gridEl.querySelector('.data-grid-row.dragging')).toBeNull();
    });

    it('suppresses drag when origin is an input', () => {
      plugin = new RowDragDropPlugin({ dragFrom: 'row' });
      plugin.attach(grid as any);
      const cell = gridEl.querySelectorAll('.data-grid-row')[0].querySelector('.cell')!;
      const input = document.createElement('input');
      cell.appendChild(input);
      dispatchDragStartFrom(input);
      expect(gridEl.querySelector('.data-grid-row.dragging')).toBeNull();
    });

    it('suppresses drag when origin is inside an open cell editor', () => {
      plugin = new RowDragDropPlugin({ dragFrom: 'row' });
      plugin.attach(grid as any);
      const cell = gridEl.querySelectorAll('.data-grid-row')[0].querySelector('.cell')!;
      const editor = document.createElement('div');
      editor.className = 'dg-cell-editor';
      const inner = document.createElement('span');
      editor.appendChild(inner);
      cell.appendChild(editor);
      dispatchDragStartFrom(inner);
      expect(gridEl.querySelector('.data-grid-row.dragging')).toBeNull();
    });

    it('suppresses drag when origin is a selection checkbox cell', () => {
      plugin = new RowDragDropPlugin({ dragFrom: 'row' });
      plugin.attach(grid as any);
      const cell = gridEl.querySelectorAll('.data-grid-row')[0].querySelector('.cell')!;
      cell.classList.add('tbw-checkbox-cell');
      dispatchDragStartFrom(cell);
      expect(gridEl.querySelector('.data-grid-row.dragging')).toBeNull();
    });

    it('"both" mode allows drag from grip OR cell', () => {
      plugin = new RowDragDropPlugin({ dragFrom: 'both' });
      plugin.attach(grid as any);

      // From cell:
      const cell = gridEl.querySelectorAll('.data-grid-row')[1].querySelector('.cell')!;
      dispatchDragStartFrom(cell);
      expect(gridEl.querySelector('.data-grid-row.dragging')).toBeTruthy();

      gridEl.dispatchEvent(new Event('dragend', { bubbles: true }));
      expect(gridEl.querySelector('.data-grid-row.dragging')).toBeNull();

      // From handle (added inside the row):
      const row0 = gridEl.querySelectorAll('.data-grid-row')[0];
      const handle = document.createElement('div');
      handle.className = 'dg-row-drag-handle';
      row0.appendChild(handle);
      dispatchDragStartFrom(handle);
      expect(row0.classList.contains('dragging')).toBe(true);
    });
  });

  describe('drag image', () => {
    let plugin: RowDragDropPlugin;
    let grid: ReturnType<typeof createGridMock>;
    let gridEl: HTMLElement;

    beforeEach(() => {
      gridEl = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('div');
        row.className = 'data-grid-row';
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('data-row', String(i));
        cell.textContent = `Row ${i} content`;
        row.appendChild(cell);
        const handle = document.createElement('div');
        handle.className = 'dg-row-drag-handle';
        row.appendChild(handle);
        gridEl.appendChild(row);
      }
      document.body.appendChild(gridEl);
      grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      (grid as any)._hostElement = gridEl;
      grid.dispatchEvent = vi.fn(() => true);
    });

    afterEach(() => {
      plugin.detach();
      document.body.innerHTML = '';
    });

    it('uses a full-row clone for single-row drag (setDragImage called with the clone)', () => {
      plugin = new RowDragDropPlugin();
      plugin.attach(grid as any);
      const handle = gridEl.querySelectorAll('.data-grid-row')[1].querySelector('.dg-row-drag-handle')!;

      const setDragImage = vi.fn();
      const event = new Event('dragstart', { bubbles: true }) as any;
      Object.defineProperty(event, 'dataTransfer', {
        value: { effectAllowed: '', setData: vi.fn(), setDragImage },
        writable: true,
      });
      Object.defineProperty(event, 'clientX', { value: 0, configurable: true });
      Object.defineProperty(event, 'clientY', { value: 0, configurable: true });
      handle.dispatchEvent(event);

      expect(setDragImage).toHaveBeenCalledTimes(1);
      const [dragImage] = setDragImage.mock.calls[0];
      expect((dragImage as HTMLElement).classList.contains('tbw-row-drag-clone')).toBe(true);
      // Clone should be in the DOM at dragstart time (removed on next tick).
      expect(document.querySelector('.tbw-row-drag-clone')).toBeTruthy();
    });

    it('multi-row drag still uses the count badge, not a row clone', () => {
      plugin = new RowDragDropPlugin();
      // Stub a 2-row selection via the selection plugin contract.
      grid.getPlugin = () => undefined;
      (grid as any).getPluginByName = (name: string) =>
        name === 'selection'
          ? {
              getSelectedRowIndices: () => [0, 1],
              getSelectedRows: () => [{ id: 1 }, { id: 2 }],
            }
          : undefined;
      plugin.attach(grid as any);

      const handle = gridEl.querySelectorAll('.data-grid-row')[0].querySelector('.dg-row-drag-handle')!;
      const setDragImage = vi.fn();
      const event = new Event('dragstart', { bubbles: true }) as any;
      Object.defineProperty(event, 'dataTransfer', {
        value: { effectAllowed: '', setData: vi.fn(), setDragImage },
        writable: true,
      });
      Object.defineProperty(event, 'clientX', { value: 0, configurable: true });
      Object.defineProperty(event, 'clientY', { value: 0, configurable: true });
      handle.dispatchEvent(event);

      expect(setDragImage).toHaveBeenCalledTimes(1);
      const [dragImage] = setDragImage.mock.calls[0];
      expect((dragImage as HTMLElement).classList.contains('tbw-row-drag-count')).toBe(true);
      expect((dragImage as HTMLElement).textContent).toBe('2 rows');
    });
  });

  describe('cross-window transfer (BroadcastChannel)', () => {
    let originalBC: typeof BroadcastChannel | undefined;
    let channels: FakeChannel[];

    class FakeChannel {
      readonly name: string;
      listeners: Array<(e: MessageEvent) => void> = [];
      closed = false;
      constructor(name: string) {
        this.name = name;
        channels.push(this);
      }
      addEventListener(_t: string, fn: (e: MessageEvent) => void) {
        this.listeners.push(fn);
      }
      removeEventListener(_t: string, fn: (e: MessageEvent) => void) {
        this.listeners = this.listeners.filter((l) => l !== fn);
      }
      postMessage(data: unknown) {
        // Spec behavior: the sender does NOT receive its own messages — but
        // for the test we deliver to ALL channels with the same name (sender
        // included or not is irrelevant since the listener filters by gridId).
        for (const ch of channels) {
          if (ch === this || ch.closed || ch.name !== this.name) continue;
          for (const l of ch.listeners) l({ data } as MessageEvent);
        }
      }
      close() {
        this.closed = true;
      }
    }

    beforeEach(() => {
      channels = [];
      originalBC = (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
      (globalThis as unknown as { BroadcastChannel: typeof BroadcastChannel }).BroadcastChannel =
        FakeChannel as unknown as typeof BroadcastChannel;
    });

    afterEach(() => {
      document.body.innerHTML = '';
      if (originalBC === undefined) {
        delete (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
      } else {
        (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel = originalBC;
      }
    });

    it('source plugin removes rows and emits row-transfer when a remote target broadcasts', () => {
      const sourceRows: { id: number; name: string }[] = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Carol' },
      ];
      const sourcePlugin = new RowDragDropPlugin<{ id: number; name: string }>({
        dropZone: 'employees',
        operation: 'move',
      });
      const sourceGrid = createGridMock(sourceRows);
      // Real DOM host so the plugin assigns a stable id and registers a listener.
      const hostEl = document.createElement('div');
      hostEl.id = 'src-grid';
      document.body.appendChild(hostEl);
      (sourceGrid as unknown as { _hostElement: HTMLElement })._hostElement = hostEl;
      // Wire `rows` setter so the plugin's `this.grid.rows = newRows` actually mutates.
      Object.defineProperty(sourceGrid, 'rows', {
        get() {
          return sourceRows;
        },
        set(v: typeof sourceRows) {
          sourceRows.length = 0;
          sourceRows.push(...v);
        },
        configurable: true,
      });
      sourcePlugin.attach(sourceGrid as never);

      const transfers: unknown[] = [];
      sourceGrid.dispatchEvent = vi.fn((event: Event) => {
        if (event.type === 'row-transfer') transfers.push((event as CustomEvent).detail);
        return true;
      });

      // Simulate a target window broadcasting a successful 'move' transfer of
      // rows [0, 2] (Alice + Carol) into another grid at index 0.
      const fake = channels[0];
      fake.listeners.forEach((l) =>
        l({
          data: {
            type: 'tbw-row-drag-drop:transfer',
            sessionId: 'sess-1',
            sourceGridId: 'src-grid',
            toGridId: 'remote-grid',
            dropZone: 'employees',
            rowIndices: [0, 2],
            toIndex: 0,
            operation: 'move',
            serializedRows: [
              { id: 1, name: 'Alice' },
              { id: 3, name: 'Carol' },
            ],
          },
        } as MessageEvent),
      );

      // Source rows shrunk to just Bob.
      expect(sourceRows.map((r) => r.id)).toEqual([2]);
      // row-transfer was emitted on the source grid with the full detail.
      expect(transfers).toHaveLength(1);
      expect(transfers[0]).toMatchObject({
        fromGridId: 'src-grid',
        toGridId: 'remote-grid',
        fromIndices: [0, 2],
        toIndex: 0,
        operation: 'move',
      });
      // dragAccepted flipped so a subsequent dragend reports accepted=true.
      expect((sourcePlugin as unknown as { dragAccepted: boolean }).dragAccepted).toBe(true);

      sourcePlugin.detach();
    });

    it('source plugin ignores broadcasts with mismatched gridId', () => {
      const rows = [{ id: 1 }];
      const plugin = new RowDragDropPlugin({ dropZone: 'employees', operation: 'move' });
      const grid = createGridMock(rows);
      const hostEl = document.createElement('div');
      hostEl.id = 'grid-A';
      document.body.appendChild(hostEl);
      (grid as unknown as { _hostElement: HTMLElement })._hostElement = hostEl;
      plugin.attach(grid as never);

      const before = rows.length;
      const fake = channels[0];
      fake.listeners.forEach((l) =>
        l({
          data: {
            type: 'tbw-row-drag-drop:transfer',
            sessionId: 's',
            sourceGridId: 'grid-B', // not us
            toGridId: 't',
            dropZone: 'employees',
            rowIndices: [0],
            toIndex: 0,
            operation: 'move',
            serializedRows: [{ id: 1 }],
          },
        } as MessageEvent),
      );

      expect(rows.length).toBe(before);
      plugin.detach();
    });

    it('source plugin ignores broadcasts with mismatched dropZone', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const plugin = new RowDragDropPlugin({ dropZone: 'employees', operation: 'move' });
      const grid = createGridMock(rows);
      const hostEl = document.createElement('div');
      hostEl.id = 'grid-Z';
      document.body.appendChild(hostEl);
      (grid as unknown as { _hostElement: HTMLElement })._hostElement = hostEl;
      plugin.attach(grid as never);

      const fake = channels[0];
      fake.listeners.forEach((l) =>
        l({
          data: {
            type: 'tbw-row-drag-drop:transfer',
            sessionId: 's',
            sourceGridId: 'grid-Z',
            toGridId: 't',
            dropZone: 'other-zone', // mismatch
            rowIndices: [0],
            toIndex: 0,
            operation: 'move',
            serializedRows: [{ id: 1 }],
          },
        } as MessageEvent),
      );

      expect(rows.length).toBe(2);
      plugin.detach();
    });

    it('copy operation does not remove source rows but still emits row-transfer', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const plugin = new RowDragDropPlugin({ dropZone: 'employees', operation: 'copy' });
      const grid = createGridMock(rows);
      const hostEl = document.createElement('div');
      hostEl.id = 'grid-C';
      document.body.appendChild(hostEl);
      (grid as unknown as { _hostElement: HTMLElement })._hostElement = hostEl;
      plugin.attach(grid as never);

      const transfers: unknown[] = [];
      grid.dispatchEvent = vi.fn((event: Event) => {
        if (event.type === 'row-transfer') transfers.push((event as CustomEvent).detail);
        return true;
      });

      const fake = channels[0];
      fake.listeners.forEach((l) =>
        l({
          data: {
            type: 'tbw-row-drag-drop:transfer',
            sessionId: 's',
            sourceGridId: 'grid-C',
            toGridId: 't',
            dropZone: 'employees',
            rowIndices: [0],
            toIndex: 0,
            operation: 'copy',
            serializedRows: [{ id: 1 }],
          },
        } as MessageEvent),
      );

      expect(rows.length).toBe(2); // not removed
      expect(transfers).toHaveLength(1);
      expect(transfers[0]).toMatchObject({ operation: 'copy' });
      plugin.detach();
    });

    it('detach removes the plugin listener and closes the channel when last instance detaches', () => {
      const plugin = new RowDragDropPlugin({ dropZone: 'z' });
      const hostEl = document.createElement('div');
      hostEl.id = 'grid-D';
      document.body.appendChild(hostEl);
      const grid = createGridMock([]);
      (grid as unknown as { _hostElement: HTMLElement })._hostElement = hostEl;
      plugin.attach(grid as never);

      expect(channels.length).toBe(1);
      const fake = channels[0];
      expect(fake.listeners.length).toBe(1);

      plugin.detach();
      expect(fake.closed).toBe(true);
    });

    it('uses deserializeRow for the row-transfer payload on the source side', () => {
      const rows = [{ id: 1 }];
      const plugin = new RowDragDropPlugin<{ id: number; computed: string }>({
        dropZone: 'employees',
        operation: 'move',
        deserializeRow: (raw) => ({ ...(raw as { id: number }), computed: 'rehydrated' }),
      });
      const grid = createGridMock(rows);
      const hostEl = document.createElement('div');
      hostEl.id = 'grid-E';
      document.body.appendChild(hostEl);
      (grid as unknown as { _hostElement: HTMLElement })._hostElement = hostEl;
      plugin.attach(grid as never);

      const transfers: unknown[] = [];
      grid.dispatchEvent = vi.fn((event: Event) => {
        if (event.type === 'row-transfer') transfers.push((event as CustomEvent).detail);
        return true;
      });

      channels[0].listeners.forEach((l) =>
        l({
          data: {
            type: 'tbw-row-drag-drop:transfer',
            sessionId: 's',
            sourceGridId: 'grid-E',
            toGridId: 't',
            dropZone: 'employees',
            rowIndices: [0],
            toIndex: 0,
            operation: 'move',
            serializedRows: [{ id: 1 }],
          },
        } as MessageEvent),
      );

      expect(transfers).toHaveLength(1);
      expect((transfers[0] as { rows: { computed: string }[] }).rows[0].computed).toBe('rehydrated');
      plugin.detach();
    });
  });
});
