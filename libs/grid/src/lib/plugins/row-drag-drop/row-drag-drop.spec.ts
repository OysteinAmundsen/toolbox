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
});
