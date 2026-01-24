/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROW_DRAG_HANDLE_FIELD, RowReorderPlugin } from './RowReorderPlugin';
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

describe('RowReorderPlugin', () => {
  describe('constructor', () => {
    it('should create plugin with default config', () => {
      const plugin = new RowReorderPlugin();
      expect(plugin.name).toBe('rowReorder');
    });

    it('should accept custom config', () => {
      const plugin = new RowReorderPlugin({
        enableKeyboard: false,
        showDragHandle: false,
        debounceMs: 500,
      });
      expect(plugin.name).toBe('rowReorder');
    });
  });

  describe('processColumns', () => {
    it('should add drag handle column at the start by default', () => {
      const plugin = new RowReorderPlugin();
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
      const plugin = new RowReorderPlugin({ dragHandlePosition: 'right' });
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
      const plugin = new RowReorderPlugin({ showDragHandle: false });
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }, { field: 'name' }];
      const result = plugin.processColumns(columns);

      expect(result.length).toBe(2);
      expect(result[0].field).toBe('id');
      expect(result[1].field).toBe('name');
    });

    it('should mark drag handle column as utility column', () => {
      const plugin = new RowReorderPlugin();
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }];
      const result = plugin.processColumns(columns);

      const dragCol = result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD);
      expect(dragCol?.meta?.utility).toBe(true);
      expect(dragCol?.meta?.lockPosition).toBe(true);
      expect(dragCol?.meta?.suppressMovable).toBe(true);
    });

    it('should use custom dragHandleWidth', () => {
      const plugin = new RowReorderPlugin({ dragHandleWidth: 60 });
      const grid = createGridMock();
      plugin.attach(grid as any);

      const columns = [{ field: 'id' }];
      const result = plugin.processColumns(columns);

      const dragCol = result.find((c) => c.field === ROW_DRAG_HANDLE_FIELD);
      expect(dragCol?.width).toBe(60);
    });

    it('should create viewRenderer that returns drag handle element', () => {
      const plugin = new RowReorderPlugin();
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
      const plugin = new RowReorderPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }, { id: 3 }]);
      plugin.attach(grid as any);

      expect(plugin.canMoveRow(0, 1)).toBe(true);
      expect(plugin.canMoveRow(2, 0)).toBe(true);
    });

    it('should return false for out of bounds', () => {
      const plugin = new RowReorderPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      expect(plugin.canMoveRow(-1, 0)).toBe(false);
      expect(plugin.canMoveRow(0, 5)).toBe(false);
      expect(plugin.canMoveRow(0, -1)).toBe(false);
    });

    it('should return false when moving to same position', () => {
      const plugin = new RowReorderPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      expect(plugin.canMoveRow(1, 1)).toBe(false);
    });

    it('should respect canMove callback', () => {
      const canMove = vi.fn().mockReturnValue(false);
      const plugin = new RowReorderPlugin({ canMove });
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      expect(plugin.canMoveRow(0, 1)).toBe(false);
      expect(canMove).toHaveBeenCalledWith({ id: 1 }, 0, 1, 'down');
    });
  });

  describe('moveRow', () => {
    it('should emit row-move event with correct detail', () => {
      const plugin = new RowReorderPlugin();
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
      const plugin = new RowReorderPlugin();
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const grid = createGridMock(rows);
      grid.dispatchEvent = vi.fn(() => true); // Not cancelled
      plugin.attach(grid as any);

      plugin.moveRow(0, 2);

      expect(grid.rows).toEqual([{ id: 2 }, { id: 3 }, { id: 1 }]);
    });

    it('should not update grid.rows when event is cancelled', () => {
      const plugin = new RowReorderPlugin();
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
      const plugin = new RowReorderPlugin({ canMove });
      const rows = [{ id: 1 }, { id: 2 }];
      const grid = createGridMock(rows);
      plugin.attach(grid as any);

      plugin.moveRow(0, 1);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();
    });

    it('should not move for same index', () => {
      const plugin = new RowReorderPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      plugin.moveRow(1, 1);

      expect(grid.dispatchEvent).not.toHaveBeenCalled();
    });
  });

  describe('onKeyDown', () => {
    let plugin: RowReorderPlugin;
    let grid: ReturnType<typeof createGridMock>;

    beforeEach(() => {
      plugin = new RowReorderPlugin({ debounceMs: 0 }); // Disable debounce for testing
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
      const disabledPlugin = new RowReorderPlugin({ enableKeyboard: false });
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
      const plugin = new RowReorderPlugin({ debounceMs: 300 });
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
      const plugin = new RowReorderPlugin();
      const grid = createGridMock([{ id: 1 }, { id: 2 }]);
      plugin.attach(grid as any);

      plugin.detach();

      // Plugin should be in clean state (no throws)
      expect(() => plugin.canMoveRow(0, 1)).not.toThrow();
    });
  });
});
