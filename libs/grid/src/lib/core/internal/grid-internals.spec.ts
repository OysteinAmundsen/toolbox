import { describe, expect, it, vi } from 'vitest';
import type { ColumnInternal, InternalGrid } from '../types';
import { createGridInternals, type GridCallbacks } from './grid-internals';

/**
 * Create a mock InternalGrid for testing.
 */
function createMockGrid<T = any>(overrides: Partial<InternalGrid<T>> = {}): InternalGrid<T> {
  return {
    _columns: [],
    _visibleColumns: [],
    _rows: [],
    _activeEditRows: -1,
    _rowEditSnapshots: new Map(),
    _changedRowIndices: new Set(),
    _focusRow: -1,
    _focusCol: -1,
    _sortState: null,
    shadowRoot: null,
    _headerRowEl: document.createElement('div'),
    _bodyEl: document.createElement('div'),
    _rowPool: [],
    __rowRenderEpoch: 0,
    ...overrides,
  } as InternalGrid<T>;
}

/**
 * Create mock callbacks for testing.
 */
function createMockCallbacks<T = any>(): GridCallbacks<T> {
  return {
    emit: vi.fn(),
    setup: vi.fn(),
    refreshVirtualWindow: vi.fn(),
    updateTemplate: vi.fn(),
    renderHeader: vi.fn(),
    getPlugins: vi.fn(() => []),
    findRenderedRowElement: vi.fn(() => null),
  };
}

describe('grid-internals', () => {
  describe('createGridInternals', () => {
    it('should create a GridInternals adapter from InternalGrid', () => {
      const grid = createMockGrid();
      const callbacks = createMockCallbacks();
      const internals = createGridInternals(grid, callbacks);

      expect(internals).toBeDefined();
      expect(internals._callbacks).toBe(callbacks);
    });
  });

  describe('column state', () => {
    it('should provide read/write access to _columns', () => {
      const initialColumns: ColumnInternal[] = [{ field: 'id', header: 'ID' } as ColumnInternal];
      const grid = createMockGrid({ _columns: initialColumns });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._columns).toBe(initialColumns);

      const newColumns: ColumnInternal[] = [{ field: 'name', header: 'Name' } as ColumnInternal];
      internals._columns = newColumns;
      expect(grid._columns).toBe(newColumns);
    });

    it('should provide read-only access to _visibleColumns', () => {
      const visibleColumns: ColumnInternal[] = [{ field: 'id', header: 'ID', hidden: false } as ColumnInternal];
      const grid = createMockGrid({
        _visibleColumns: visibleColumns,
      });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._visibleColumns).toBe(visibleColumns);
    });
  });

  describe('row state', () => {
    it('should provide read/write access to _rows', () => {
      const initialRows = [{ id: 1 }, { id: 2 }];
      const grid = createMockGrid({ _rows: initialRows });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._rows).toBe(initialRows);

      const newRows = [{ id: 3 }];
      internals._rows = newRows;
      expect(grid._rows).toBe(newRows);
    });

    it('should provide read-only access to sourceRows', () => {
      const sourceRows = [{ id: 1 }];
      const grid = createMockGrid();
      (grid as any).sourceRows = sourceRows;
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals.sourceRows).toBe(sourceRows);
    });

    it('should fall back to _rows if sourceRows is not defined', () => {
      const rows = [{ id: 1 }];
      const grid = createMockGrid({ _rows: rows });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals.sourceRows).toBe(rows);
    });
  });

  describe('editing state', () => {
    it('should provide read/write access to _activeEditRows', () => {
      const grid = createMockGrid({ _activeEditRows: 5 });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._activeEditRows).toBe(5);

      internals._activeEditRows = 10;
      expect(grid._activeEditRows).toBe(10);
    });

    it('should provide access to _rowEditSnapshots', () => {
      const snapshots = new Map([[0, { id: 1, name: 'Original' }]]);
      const grid = createMockGrid({ _rowEditSnapshots: snapshots });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._rowEditSnapshots).toBe(snapshots);
    });

    it('should provide access to _changedRowIndices', () => {
      const changed = new Set([0, 1, 2]);
      const grid = createMockGrid({ _changedRowIndices: changed });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._changedRowIndices).toBe(changed);
    });
  });

  describe('focus state', () => {
    it('should provide read/write access to _focusRow', () => {
      const grid = createMockGrid({ _focusRow: 3 });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._focusRow).toBe(3);

      internals._focusRow = 7;
      expect(grid._focusRow).toBe(7);
    });

    it('should provide read/write access to _focusCol', () => {
      const grid = createMockGrid({ _focusCol: 2 });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._focusCol).toBe(2);

      internals._focusCol = 5;
      expect(grid._focusCol).toBe(5);
    });
  });

  describe('sort state', () => {
    it('should provide read/write access to _sortState', () => {
      const sortState = { field: 'name', direction: 1 as const };
      const grid = createMockGrid({ _sortState: sortState });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._sortState).toBe(sortState);

      const newSortState = { field: 'id', direction: -1 as const };
      internals._sortState = newSortState;
      expect(grid._sortState).toBe(newSortState);
    });

    it('should support null sort state', () => {
      const grid = createMockGrid({ _sortState: null });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._sortState).toBeNull();
    });
  });

  describe('DOM references', () => {
    it('should provide read-only access to shadowRoot', () => {
      const mockShadowRoot = {} as ShadowRoot;
      const grid = createMockGrid({ shadowRoot: mockShadowRoot });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals.shadowRoot).toBe(mockShadowRoot);
    });

    it('should provide read-only access to _headerRowEl', () => {
      const headerEl = document.createElement('div');
      const grid = createMockGrid({ _headerRowEl: headerEl });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._headerRowEl).toBe(headerEl);
    });

    it('should provide read-only access to _bodyEl', () => {
      const bodyEl = document.createElement('div');
      const grid = createMockGrid({ _bodyEl: bodyEl });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._bodyEl).toBe(bodyEl);
    });

    it('should provide read/write access to _rowPool', () => {
      const pool = [document.createElement('div')];
      const grid = createMockGrid({ _rowPool: pool });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals._rowPool).toBe(pool);

      const newPool = [document.createElement('div'), document.createElement('div')];
      internals._rowPool = newPool;
      expect(grid._rowPool).toBe(newPool);
    });
  });

  describe('render state', () => {
    it('should provide read/write access to __rowRenderEpoch', () => {
      const grid = createMockGrid({ __rowRenderEpoch: 5 });
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals.__rowRenderEpoch).toBe(5);

      internals.__rowRenderEpoch = 10;
      expect(grid.__rowRenderEpoch).toBe(10);
    });
  });

  describe('effectiveConfig', () => {
    it('should provide read/write access to effectiveConfig', () => {
      const config = { editOn: 'dblClick' as const };
      const grid = createMockGrid();
      (grid as any).effectiveConfig = config;
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals.effectiveConfig).toBe(config);

      const newConfig = { editOn: 'click' as const };
      internals.effectiveConfig = newConfig;
      expect((grid as any).effectiveConfig).toBe(newConfig);
    });

    it('should return empty object if effectiveConfig is undefined', () => {
      const grid = createMockGrid();
      const internals = createGridInternals(grid, createMockCallbacks());

      expect(internals.effectiveConfig).toEqual({});
    });
  });

  describe('callbacks', () => {
    it('should expose callbacks for grid operations', () => {
      const callbacks = createMockCallbacks();
      const grid = createMockGrid();
      const internals = createGridInternals(grid, callbacks);

      expect(internals._callbacks.emit).toBe(callbacks.emit);
      expect(internals._callbacks.setup).toBe(callbacks.setup);
      expect(internals._callbacks.refreshVirtualWindow).toBe(callbacks.refreshVirtualWindow);
      expect(internals._callbacks.updateTemplate).toBe(callbacks.updateTemplate);
      expect(internals._callbacks.renderHeader).toBe(callbacks.renderHeader);
      expect(internals._callbacks.getPlugins).toBe(callbacks.getPlugins);
      expect(internals._callbacks.findRenderedRowElement).toBe(callbacks.findRenderedRowElement);
    });

    it('should allow calling callbacks', () => {
      const callbacks = createMockCallbacks();
      const grid = createMockGrid();
      const internals = createGridInternals(grid, callbacks);

      internals._callbacks.emit('test-event', { foo: 'bar' });
      expect(callbacks.emit).toHaveBeenCalledWith('test-event', { foo: 'bar' });

      internals._callbacks.setup();
      expect(callbacks.setup).toHaveBeenCalled();

      internals._callbacks.refreshVirtualWindow(true);
      expect(callbacks.refreshVirtualWindow).toHaveBeenCalledWith(true);
    });
  });
});
