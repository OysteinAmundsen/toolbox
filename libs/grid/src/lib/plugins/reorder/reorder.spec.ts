import { describe, expect, it } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { canMoveColumn, getDropIndex, moveColumn, reorderColumns } from './column-drag';
import { ReorderPlugin } from './ReorderPlugin';

describe('column-drag', () => {
  describe('canMoveColumn', () => {
    it('should return true for a normal column without restrictions', () => {
      const column: ColumnConfig = { field: 'name' };
      expect(canMoveColumn(column)).toBe(true);
    });

    it('should return true for a column with empty meta', () => {
      const column: ColumnConfig = { field: 'name', meta: {} };
      expect(canMoveColumn(column)).toBe(true);
    });

    it('should return false for a column with lockPosition = true', () => {
      const column: ColumnConfig = { field: 'id', meta: { lockPosition: true } };
      expect(canMoveColumn(column)).toBe(false);
    });

    it('should return false for a column with suppressMovable = true', () => {
      const column: ColumnConfig = { field: 'actions', meta: { suppressMovable: true } };
      expect(canMoveColumn(column)).toBe(false);
    });

    it('should return true if lockPosition is explicitly false', () => {
      const column: ColumnConfig = { field: 'name', meta: { lockPosition: false } };
      expect(canMoveColumn(column)).toBe(true);
    });

    it('should return true if suppressMovable is explicitly false', () => {
      const column: ColumnConfig = { field: 'name', meta: { suppressMovable: false } };
      expect(canMoveColumn(column)).toBe(true);
    });

    it('should handle both lockPosition and suppressMovable set to false', () => {
      const column: ColumnConfig = {
        field: 'name',
        meta: { lockPosition: false, suppressMovable: false },
      };
      expect(canMoveColumn(column)).toBe(true);
    });

    // Note: sticky column checks are handled by PinnedColumnsPlugin via the onPluginQuery hook
    // and tested in pinned-columns.spec.ts
  });

  describe('moveColumn', () => {
    it('should return the same array when fromIndex equals toIndex', () => {
      const columns = ['a', 'b', 'c', 'd'];
      const result = moveColumn(columns, 1, 1);
      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should move column from earlier to later position', () => {
      const columns = ['a', 'b', 'c', 'd'];
      const result = moveColumn(columns, 0, 2);
      expect(result).toEqual(['b', 'c', 'a', 'd']);
    });

    it('should move column from later to earlier position', () => {
      const columns = ['a', 'b', 'c', 'd'];
      const result = moveColumn(columns, 3, 1);
      expect(result).toEqual(['a', 'd', 'b', 'c']);
    });

    it('should move column to the first position', () => {
      const columns = ['a', 'b', 'c', 'd'];
      const result = moveColumn(columns, 2, 0);
      expect(result).toEqual(['c', 'a', 'b', 'd']);
    });

    it('should move column to the last position', () => {
      const columns = ['a', 'b', 'c', 'd'];
      const result = moveColumn(columns, 0, 3);
      expect(result).toEqual(['b', 'c', 'd', 'a']);
    });

    it('should handle moving the first column to second position', () => {
      const columns = ['a', 'b', 'c'];
      const result = moveColumn(columns, 0, 1);
      expect(result).toEqual(['b', 'a', 'c']);
    });

    it('should handle moving adjacent columns', () => {
      const columns = ['a', 'b', 'c'];
      const result = moveColumn(columns, 1, 2);
      expect(result).toEqual(['a', 'c', 'b']);
    });

    it('should not mutate the original array', () => {
      const columns = ['a', 'b', 'c', 'd'];
      const result = moveColumn(columns, 0, 3);
      expect(columns).toEqual(['a', 'b', 'c', 'd']);
      expect(result).not.toBe(columns);
    });

    it('should handle single element array', () => {
      const columns = ['a'];
      const result = moveColumn(columns, 0, 0);
      expect(result).toEqual(['a']);
    });

    it('should handle two element array', () => {
      const columns = ['a', 'b'];
      const result = moveColumn(columns, 0, 1);
      expect(result).toEqual(['b', 'a']);
    });

    it('should return original array for invalid fromIndex (negative)', () => {
      const columns = ['a', 'b', 'c'];
      const result = moveColumn(columns, -1, 1);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return original array for invalid fromIndex (out of bounds)', () => {
      const columns = ['a', 'b', 'c'];
      const result = moveColumn(columns, 5, 1);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return original array for invalid toIndex (negative)', () => {
      const columns = ['a', 'b', 'c'];
      const result = moveColumn(columns, 1, -1);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should return original array for invalid toIndex (out of bounds)', () => {
      const columns = ['a', 'b', 'c'];
      const result = moveColumn(columns, 1, 10);
      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getDropIndex', () => {
    const createHeaderRect = (left: number): DOMRect => ({
      left,
      right: left + 300,
      top: 0,
      bottom: 40,
      width: 300,
      height: 40,
      x: left,
      y: 0,
      toJSON: () => ({}),
    });

    it('should return 0 for drag before first column midpoint', () => {
      const columnWidths = [100, 100, 100];
      const headerRect = createHeaderRect(0);

      // Drag at x=40, first column midpoint is 50
      const result = getDropIndex(40, headerRect, columnWidths);
      expect(result).toBe(0);
    });

    it('should return 1 for drag after first column midpoint but before second', () => {
      const columnWidths = [100, 100, 100];
      const headerRect = createHeaderRect(0);

      // Drag at x=60, first column midpoint is 50, second is 150
      const result = getDropIndex(60, headerRect, columnWidths);
      expect(result).toBe(1);
    });

    it('should return 2 for drag after second column midpoint but before third', () => {
      const columnWidths = [100, 100, 100];
      const headerRect = createHeaderRect(0);

      // Drag at x=160, second column midpoint is 150, third is 250
      const result = getDropIndex(160, headerRect, columnWidths);
      expect(result).toBe(2);
    });

    it('should return column count for drag after all column midpoints', () => {
      const columnWidths = [100, 100, 100];
      const headerRect = createHeaderRect(0);

      // Drag at x=280, last column midpoint is 250
      const result = getDropIndex(280, headerRect, columnWidths);
      expect(result).toBe(3);
    });

    it('should handle header with left offset', () => {
      const columnWidths = [100, 100];
      const headerRect = createHeaderRect(50);

      // Drag at x=90, first column midpoint is 50+50=100
      const result = getDropIndex(90, headerRect, columnWidths);
      expect(result).toBe(0);
    });

    it('should handle variable width columns', () => {
      const columnWidths = [50, 150, 100];
      const headerRect = createHeaderRect(0);

      // Drag at x=100, first column midpoint is 25, second is 125
      const result = getDropIndex(100, headerRect, columnWidths);
      expect(result).toBe(1);
    });

    it('should handle empty column array', () => {
      const columnWidths: number[] = [];
      const headerRect = createHeaderRect(0);

      const result = getDropIndex(50, headerRect, columnWidths);
      expect(result).toBe(0);
    });
  });

  describe('reorderColumns', () => {
    interface TestRow {
      name: string;
      age: number;
      city: string;
    }

    const testColumns: ColumnConfig<TestRow>[] = [
      { field: 'name', header: 'Name' },
      { field: 'age', header: 'Age' },
      { field: 'city', header: 'City' },
    ];

    it('should reorder columns according to specified order', () => {
      const order = ['city', 'name', 'age'];
      const result = reorderColumns(testColumns, order);

      expect(result.map((c) => c.field)).toEqual(['city', 'name', 'age']);
    });

    it('should maintain column properties after reordering', () => {
      const order = ['city', 'name', 'age'];
      const result = reorderColumns(testColumns, order);

      expect(result[0].header).toBe('City');
      expect(result[1].header).toBe('Name');
      expect(result[2].header).toBe('Age');
    });

    it('should handle same order as input', () => {
      const order = ['name', 'age', 'city'];
      const result = reorderColumns(testColumns, order);

      expect(result.map((c) => c.field)).toEqual(['name', 'age', 'city']);
    });

    it('should handle reverse order', () => {
      const order = ['city', 'age', 'name'];
      const result = reorderColumns(testColumns, order);

      expect(result.map((c) => c.field)).toEqual(['city', 'age', 'name']);
    });

    it('should append columns not in order at the end', () => {
      const order = ['city'];
      const result = reorderColumns(testColumns, order);

      expect(result.map((c) => c.field)).toEqual(['city', 'name', 'age']);
    });

    it('should ignore fields in order that do not exist in columns', () => {
      const order = ['city', 'nonexistent', 'name'];
      const result = reorderColumns(testColumns, order);

      expect(result.map((c) => c.field)).toEqual(['city', 'name', 'age']);
    });

    it('should handle empty order array', () => {
      const order: string[] = [];
      const result = reorderColumns(testColumns, order);

      // All columns appended in original order
      expect(result.map((c) => c.field)).toEqual(['name', 'age', 'city']);
    });

    it('should handle empty columns array', () => {
      const columns: ColumnConfig[] = [];
      const order = ['name', 'age'];
      const result = reorderColumns(columns, order);

      expect(result).toEqual([]);
    });

    it('should not mutate the original columns array', () => {
      const order = ['city', 'name', 'age'];
      const result = reorderColumns(testColumns, order);

      expect(testColumns.map((c) => c.field)).toEqual(['name', 'age', 'city']);
      expect(result).not.toBe(testColumns);
    });

    it('should handle partial order specification', () => {
      const order = ['age', 'city'];
      const result = reorderColumns(testColumns, order);

      // 'age' and 'city' first, 'name' appended at end
      expect(result.map((c) => c.field)).toEqual(['age', 'city', 'name']);
    });

    it('should handle duplicate fields in order (first occurrence wins)', () => {
      const order = ['city', 'name', 'city', 'age'];
      const result = reorderColumns(testColumns, order);

      // 'city' appears first and is consumed, second 'city' is ignored
      expect(result.map((c) => c.field)).toEqual(['city', 'name', 'age']);
    });
  });
});

describe('ReorderPlugin', () => {
  describe('onKeyDown', () => {
    function createMockGrid(focusCol: number, columns: ColumnConfig[]) {
      const columnOrder = columns.map((c) => c.field);
      let currentOrder = [...columnOrder];

      // Create a minimal mock body element
      const mockBodyEl = {
        querySelectorAll: () => [],
      };

      // Create mock shadowRoot with required methods
      const mockShadowRoot = {
        querySelectorAll: () => [],
        querySelector: () => null,
        host: { offsetHeight: 0 },
      };

      return {
        _focusCol: focusCol,
        _focusRow: 0,
        _visibleColumns: columns,
        _bodyEl: mockBodyEl,
        _virtualization: { enabled: false, start: 0, end: 0 },
        _activeEditRows: undefined,
        _rows: [],
        shadowRoot: mockShadowRoot,
        getColumnOrder: () => currentOrder,
        setColumnOrder: (order: string[]) => {
          currentOrder = order;
        },
        queryPlugins: () => [],
        requestStateChange: () => {
          /* noop */
        },
        addEventListener: () => {
          /* noop */
        },
        dispatchEvent: () => true,
        refreshVirtualWindow: () => {
          /* noop */
        },
      };
    }

    function createKeyEvent(key: string, altKey = true): KeyboardEvent {
      return {
        key,
        altKey,
        preventDefault: () => {
          /* noop */
        },
        stopPropagation: () => {
          /* noop */
        },
      } as unknown as KeyboardEvent;
    }

    it('should move column left with Alt+ArrowLeft', () => {
      const columns: ColumnConfig[] = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      const grid = createMockGrid(1, columns); // Focus on 'b'

      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);

      const event = createKeyEvent('ArrowLeft');
      const result = plugin.onKeyDown(event);

      expect(result).toBe(true);
      expect(grid.getColumnOrder()).toEqual(['b', 'a', 'c']);
      expect(grid._focusCol).toBe(0);
    });

    it('should move column right with Alt+ArrowRight', () => {
      const columns: ColumnConfig[] = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      const grid = createMockGrid(1, columns); // Focus on 'b'

      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);

      const event = createKeyEvent('ArrowRight');
      const result = plugin.onKeyDown(event);

      expect(result).toBe(true);
      expect(grid.getColumnOrder()).toEqual(['a', 'c', 'b']);
      expect(grid._focusCol).toBe(2);
    });

    it('should not move first column left (bounds check)', () => {
      const columns: ColumnConfig[] = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      const grid = createMockGrid(0, columns); // Focus on first column

      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);

      const event = createKeyEvent('ArrowLeft');
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
      expect(grid.getColumnOrder()).toEqual(['a', 'b', 'c']);
    });

    it('should not move last column right (bounds check)', () => {
      const columns: ColumnConfig[] = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      const grid = createMockGrid(2, columns); // Focus on last column

      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);

      const event = createKeyEvent('ArrowRight');
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
      expect(grid.getColumnOrder()).toEqual(['a', 'b', 'c']);
    });

    it('should ignore non-Alt arrow keys', () => {
      const columns: ColumnConfig[] = [{ field: 'a' }, { field: 'b' }];
      const grid = createMockGrid(0, columns);

      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);

      const event = createKeyEvent('ArrowRight', false); // No Alt key
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
      expect(grid.getColumnOrder()).toEqual(['a', 'b']);
    });

    it('should ignore non-arrow keys with Alt', () => {
      const columns: ColumnConfig[] = [{ field: 'a' }, { field: 'b' }];
      const grid = createMockGrid(0, columns);

      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);

      const event = createKeyEvent('Enter', true);
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
    });

    it('should not move locked column', () => {
      const columns: ColumnConfig[] = [{ field: 'a', meta: { lockPosition: true } }, { field: 'b' }];
      const grid = createMockGrid(0, columns);

      const plugin = new ReorderPlugin();
      plugin.attach(grid as any);

      const event = createKeyEvent('ArrowRight');
      const result = plugin.onKeyDown(event);

      expect(result).toBeUndefined();
      expect(grid.getColumnOrder()).toEqual(['a', 'b']);
    });
  });
});
