import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionPlugin } from './SelectionPlugin';

// Tests use `any` for flexibility with mock grid objects.

describe('SelectionPlugin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const createMockGrid = (rows: any[] = [], columns: any[] = []) => {
    const shadowRoot = document.createElement('div') as unknown as ShadowRoot;
    // Add a container element
    const container = document.createElement('div');
    container.className = 'tbw-grid-root';
    shadowRoot.appendChild(container);

    return {
      shadowRoot,
      rows,
      columns,
      gridConfig: {},
      focusRow: 0,
      focusCol: 0,
      disconnectSignal: new AbortController().signal,
      requestRender: vi.fn(),
      requestAfterRender: vi.fn(),
      forceLayout: vi.fn().mockResolvedValue(undefined),
      getPlugin: vi.fn(),
      getPluginByName: vi.fn(),
      dispatchEvent: vi.fn(),
      setAttribute: vi.fn(),
    } as any;
  };

  describe('lifecycle', () => {
    it('should initialize with default cell mode', () => {
      const plugin = new SelectionPlugin({});
      plugin.attach(createMockGrid());

      expect(plugin['config'].mode).toBe('cell');
    });

    it('should initialize with configured mode', () => {
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(createMockGrid());

      expect(plugin['config'].mode).toBe('row');
    });

    it('should clear state on detach', () => {
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(createMockGrid());

      plugin['selected'].add(0);
      plugin['selected'].add(1);
      plugin['ranges'].push({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
      plugin['selectedCell'] = { row: 0, col: 0 };

      plugin.detach();

      expect(plugin['selected'].size).toBe(0);
      expect(plugin['ranges'].length).toBe(0);
      expect(plugin['selectedCell']).toBeNull();
    });
  });

  describe('cell mode', () => {
    it('should select cell on click', () => {
      const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'cell' });
      plugin.attach(mockGrid);

      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        field: 'name',
        value: 'Test',
        row: { id: 1 },
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      expect(plugin.getSelectedCell()).toEqual({ row: 0, col: 0 });
      expect(mockGrid.dispatchEvent).toHaveBeenCalled();
    });

    it('should emit selection-change event on click', () => {
      const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'cell' });
      plugin.attach(mockGrid);

      plugin.onCellClick({
        rowIndex: 2,
        colIndex: 3,
        field: 'name',
        value: 'Test',
        row: { id: 1 },
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      const dispatchedEvent = mockGrid.dispatchEvent.mock.calls[0][0];
      expect(dispatchedEvent.type).toBe('selection-change');
      expect(dispatchedEvent.detail.mode).toBe('cell');
      expect(dispatchedEvent.detail.ranges[0]).toEqual({
        from: { row: 2, col: 3 },
        to: { row: 2, col: 3 },
      });
    });
  });

  describe('row mode', () => {
    it('should select row on click', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const mockGrid = createMockGrid(rows, [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(mockGrid);

      plugin.onCellClick({
        rowIndex: 1,
        colIndex: 0,
        field: 'name',
        value: 'Test',
        row: rows[1],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      expect(plugin.getSelectedRows()).toEqual([1]);
    });

    it('should emit selection-change with row range', () => {
      const rows = [{ id: 1 }];
      const columns = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      const mockGrid = createMockGrid(rows, columns);
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(mockGrid);

      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 1,
        field: 'b',
        value: 'Test',
        row: rows[0],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      const dispatchedEvent = mockGrid.dispatchEvent.mock.calls[0][0];
      expect(dispatchedEvent.detail.mode).toBe('row');
      expect(dispatchedEvent.detail.ranges[0]).toEqual({
        from: { row: 0, col: 0 },
        to: { row: 0, col: 2 },
      });
    });

    it('should replace selection on plain click', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const mockGrid = createMockGrid(rows, [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(mockGrid);

      // First click
      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        field: 'name',
        value: 'Test',
        row: rows[0],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      // Second click
      plugin.onCellClick({
        rowIndex: 2,
        colIndex: 0,
        field: 'name',
        value: 'Test',
        row: rows[2],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      expect(plugin.getSelectedRows()).toEqual([2]);
    });
  });

  describe('range mode', () => {
    it('should select single cell as range on click', () => {
      const rows = [{ id: 1 }];
      const mockGrid = createMockGrid(rows, [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        field: 'name',
        value: 'Test',
        row: rows[0],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      expect(plugin.getRanges()).toEqual([{ from: { row: 0, col: 0 }, to: { row: 0, col: 0 } }]);
    });

    it('should extend range with shift+click', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const columns = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      const mockGrid = createMockGrid(rows, columns);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      // First click to set anchor
      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        field: 'a',
        value: 'Test',
        row: rows[0],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      // Shift+click to extend
      plugin.onCellClick({
        rowIndex: 2,
        colIndex: 2,
        field: 'c',
        value: 'Test',
        row: rows[2],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click', { shiftKey: true }),
      });

      const ranges = plugin.getRanges();
      expect(ranges.length).toBe(1);
      expect(ranges[0]).toEqual({
        from: { row: 0, col: 0 },
        to: { row: 2, col: 2 },
      });
    });

    it('should add new range with ctrl+click', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const columns = [{ field: 'a' }, { field: 'b' }];
      const mockGrid = createMockGrid(rows, columns);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      // First click
      plugin.onCellClick({
        rowIndex: 0,
        colIndex: 0,
        field: 'a',
        value: 'Test',
        row: rows[0],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click'),
      });

      // Ctrl+click to add
      plugin.onCellClick({
        rowIndex: 1,
        colIndex: 1,
        field: 'b',
        value: 'Test',
        row: rows[1],
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('click', { ctrlKey: true }),
      });

      const ranges = plugin.getRanges();
      expect(ranges.length).toBe(2);
    });
  });

  describe('keyboard navigation', () => {
    it('should clear selection on Escape in cell mode', () => {
      const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'cell' });
      plugin.attach(mockGrid);

      plugin['selectedCell'] = { row: 0, col: 0 };

      const handled = plugin.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(handled).toBe(true);
      expect(plugin.getSelectedCell()).toBeNull();
    });

    it('should clear selection on Escape in row mode', () => {
      const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(mockGrid);

      plugin['selected'].add(0);

      const handled = plugin.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(handled).toBe(true);
      expect(plugin.getSelectedRows()).toEqual([]);
    });

    it('should clear selection on Escape in range mode', () => {
      const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      plugin['ranges'].push({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });

      const handled = plugin.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(handled).toBe(true);
      expect(plugin.getRanges()).toEqual([]);
    });

    it('should select all with Ctrl+A in range mode', () => {
      const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const columns = [{ field: 'a' }, { field: 'b' }];
      const mockGrid = createMockGrid(rows, columns);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      const handled = plugin.onKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));

      expect(handled).toBe(true);
      const ranges = plugin.getRanges();
      expect(ranges.length).toBe(1);
      expect(ranges[0]).toEqual({
        from: { row: 0, col: 0 },
        to: { row: 2, col: 1 },
      });
    });

    it('should not select all with Ctrl+A in row mode', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const mockGrid = createMockGrid(rows, [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(mockGrid);

      const handled = plugin.onKeyDown(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true }));

      expect(handled).toBe(false);
    });

    it('should not extend selection with Shift+Tab in range mode', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const columns = [{ field: 'a' }, { field: 'b' }];
      const mockGrid = createMockGrid(rows, columns);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      // Set an anchor (simulating previous selection)
      plugin['cellAnchor'] = { row: 0, col: 0 };

      // Press Shift+Tab
      plugin.onKeyDown(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));

      // The pendingKeyboardUpdate should have shiftKey: false (Tab doesn't extend)
      expect(plugin['pendingKeyboardUpdate']).toEqual({ shiftKey: false });
    });

    it('should extend selection with Shift+Arrow in range mode', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const columns = [{ field: 'a' }, { field: 'b' }];
      const mockGrid = createMockGrid(rows, columns);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      // Press Shift+ArrowRight
      plugin.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true }));

      // The pendingKeyboardUpdate should have shiftKey: true (Arrow extends)
      expect(plugin['pendingKeyboardUpdate']).toEqual({ shiftKey: true });
    });
  });

  describe('mouse drag selection (range mode)', () => {
    it('should start drag on mousedown', () => {
      const rows = [{ id: 1 }];
      const mockGrid = createMockGrid(rows, [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      plugin.onCellMouseDown({
        rowIndex: 0,
        colIndex: 0,
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('mousedown'),
      });

      expect(plugin['isDragging']).toBe(true);
      expect(plugin['cellAnchor']).toEqual({ row: 0, col: 0 });
    });

    it('should not start drag in non-range mode', () => {
      const rows = [{ id: 1 }];
      const mockGrid = createMockGrid(rows, [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'cell' });
      plugin.attach(mockGrid);

      plugin.onCellMouseDown({
        rowIndex: 0,
        colIndex: 0,
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('mousedown'),
      });

      expect(plugin['isDragging']).toBe(false);
    });

    it('should extend range on mousemove during drag', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const columns = [{ field: 'a' }, { field: 'b' }];
      const mockGrid = createMockGrid(rows, columns);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      // Start drag
      plugin.onCellMouseDown({
        rowIndex: 0,
        colIndex: 0,
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('mousedown'),
      });

      // Move to another cell
      plugin.onCellMouseMove({
        rowIndex: 1,
        colIndex: 1,
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('mousemove'),
      });

      const ranges = plugin.getRanges();
      expect(ranges[0]).toEqual({
        from: { row: 0, col: 0 },
        to: { row: 1, col: 1 },
      });
    });

    it('should stop drag on mouseup', () => {
      const rows = [{ id: 1 }];
      const mockGrid = createMockGrid(rows, [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      plugin['isDragging'] = true;

      plugin.onCellMouseUp({
        rowIndex: 0,
        colIndex: 0,
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('mouseup'),
      });

      expect(plugin['isDragging']).toBe(false);
    });

    it('should not extend range on mousemove without drag', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const mockGrid = createMockGrid(rows, [{ field: 'a' }, { field: 'b' }]);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      // Move without starting drag
      plugin.onCellMouseMove({
        rowIndex: 1,
        colIndex: 1,
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('mousemove'),
      });

      expect(plugin.getRanges()).toEqual([]);
    });

    it('should ignore mousedown on header rows', () => {
      const rows = [{ id: 1 }];
      const mockGrid = createMockGrid(rows, [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      plugin.onCellMouseDown({
        rowIndex: -1, // Header row
        colIndex: 0,
        cellEl: document.createElement('div'),
        originalEvent: new MouseEvent('mousedown'),
      });

      expect(plugin['isDragging']).toBe(false);
    });
  });

  describe('public API', () => {
    describe('getSelectedCell', () => {
      it('should return selected cell in cell mode', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'cell' });
        plugin.attach(mockGrid);

        plugin['selectedCell'] = { row: 2, col: 3 };

        expect(plugin.getSelectedCell()).toEqual({ row: 2, col: 3 });
      });

      it('should return null when no cell selected', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'cell' });
        plugin.attach(mockGrid);

        expect(plugin.getSelectedCell()).toBeNull();
      });
    });

    describe('getSelectedRows', () => {
      it('should return selected row indices', () => {
        const mockGrid = createMockGrid([{ id: 1 }, { id: 2 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'row' });
        plugin.attach(mockGrid);

        plugin['selected'].add(0);
        plugin['selected'].add(2);

        expect(plugin.getSelectedRows()).toContain(0);
        expect(plugin.getSelectedRows()).toContain(2);
      });

      it('should return empty array when no rows selected', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'row' });
        plugin.attach(mockGrid);

        expect(plugin.getSelectedRows()).toEqual([]);
      });
    });

    describe('getRanges', () => {
      it('should return ranges in public format', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'range' });
        plugin.attach(mockGrid);

        plugin['ranges'].push({ startRow: 0, startCol: 0, endRow: 2, endCol: 3 });

        expect(plugin.getRanges()).toEqual([{ from: { row: 0, col: 0 }, to: { row: 2, col: 3 } }]);
      });
    });

    describe('getSelectedCells', () => {
      it('should return all cells in ranges', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'range' });
        plugin.attach(mockGrid);

        plugin['ranges'].push({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });

        const cells = plugin.getSelectedCells();
        expect(cells).toContainEqual({ row: 0, col: 0 });
        expect(cells).toContainEqual({ row: 0, col: 1 });
        expect(cells).toContainEqual({ row: 1, col: 0 });
        expect(cells).toContainEqual({ row: 1, col: 1 });
        expect(cells.length).toBe(4);
      });
    });

    describe('isCellSelected', () => {
      it('should return true for cell in range', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'range' });
        plugin.attach(mockGrid);

        plugin['ranges'].push({ startRow: 0, startCol: 0, endRow: 2, endCol: 2 });

        expect(plugin.isCellSelected(1, 1)).toBe(true);
      });

      it('should return false for cell outside range', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'range' });
        plugin.attach(mockGrid);

        plugin['ranges'].push({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });

        expect(plugin.isCellSelected(5, 5)).toBe(false);
      });
    });

    describe('clearSelection', () => {
      it('should clear all selection state', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'range' });
        plugin.attach(mockGrid);

        plugin['selectedCell'] = { row: 0, col: 0 };
        plugin['selected'].add(0);
        plugin['ranges'].push({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });
        plugin['cellAnchor'] = { row: 0, col: 0 };

        plugin.clearSelection();

        expect(plugin.getSelectedCell()).toBeNull();
        expect(plugin.getSelectedRows()).toEqual([]);
        expect(plugin.getRanges()).toEqual([]);
        expect(plugin['cellAnchor']).toBeNull();
        expect(mockGrid.dispatchEvent).toHaveBeenCalled();
      });
    });

    describe('setRanges', () => {
      it('should set ranges programmatically', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'range' });
        plugin.attach(mockGrid);

        plugin.setRanges([
          { from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
          { from: { row: 3, col: 2 }, to: { row: 4, col: 3 } },
        ]);

        expect(plugin.getRanges().length).toBe(2);
        expect(mockGrid.dispatchEvent).toHaveBeenCalled();
      });

      it('should set active range to last range', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'range' });
        plugin.attach(mockGrid);

        plugin.setRanges([
          { from: { row: 0, col: 0 }, to: { row: 1, col: 1 } },
          { from: { row: 3, col: 2 }, to: { row: 4, col: 3 } },
        ]);

        expect(plugin['activeRange']).toEqual({
          startRow: 3,
          startCol: 2,
          endRow: 4,
          endCol: 3,
        });
      });

      it('should handle empty ranges array', () => {
        const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
        const plugin = new SelectionPlugin({ mode: 'range' });
        plugin.attach(mockGrid);

        plugin['ranges'].push({ startRow: 0, startCol: 0, endRow: 1, endCol: 1 });

        plugin.setRanges([]);

        expect(plugin.getRanges()).toEqual([]);
        expect(plugin['activeRange']).toBeNull();
      });
    });
  });

  describe('afterRender', () => {
    it('should set data-selection-mode attribute on grid', () => {
      const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(mockGrid);

      plugin.afterRender();

      expect(mockGrid.setAttribute).toHaveBeenCalledWith('data-selection-mode', 'row');
    });

    it('should toggle selecting class during drag', () => {
      const mockGrid = createMockGrid([{ id: 1 }], [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'range' });
      plugin.attach(mockGrid);

      plugin['isDragging'] = true;
      plugin.afterRender();

      const container = mockGrid.shadowRoot.children[0];
      expect(container.classList.contains('selecting')).toBe(true);
    });
  });

  describe('onScrollRender', () => {
    it('should reapply selection classes after scroll', () => {
      const mockGrid = createMockGrid([{ id: 1 }, { id: 2 }], [{ field: 'name' }]);
      const plugin = new SelectionPlugin({ mode: 'row' });
      plugin.attach(mockGrid);

      plugin['selected'].add(0);

      // Should not throw
      plugin.onScrollRender();
    });
  });
});
