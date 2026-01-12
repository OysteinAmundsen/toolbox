/**
 * Column State Module Tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { BaseGridPlugin } from '../plugin';
import type { ColumnInternal, ColumnState, GridColumnState, InternalGrid } from '../types';
import { applyColumnState, areColumnStatesEqual, collectColumnState, createStateChangeHandler } from './column-state';

/**
 * Creates a minimal InternalGrid mock for column state tests.
 */
function makeGrid(opts: Partial<any> = {}): InternalGrid {
  const events: any[] = [];
  const grid: any = {
    _rows: opts.rows || [],
    _columns: opts.columns || [
      { field: 'id', width: 100, __renderedWidth: 100 },
      { field: 'name', width: 150 },
      { field: 'value', width: 80, __renderedWidth: 120 },
    ],
    get _visibleColumns() {
      return this._columns.filter((c: any) => !c.hidden);
    },
    _sortState: opts._sortState || null,
    dispatchEvent: (ev: any) => events.push(ev),
    __events: events,
  };
  return grid;
}

describe('collectColumnState', () => {
  it('collects basic column state without sort', () => {
    const grid = makeGrid();
    const plugins: BaseGridPlugin[] = [];

    const state = collectColumnState(grid, plugins);

    expect(state.columns).toHaveLength(3);
    expect(state.columns[0]).toEqual({
      field: 'id',
      order: 0,
      visible: true,
      width: 100,
    });
    expect(state.columns[1]).toEqual({
      field: 'name',
      order: 1,
      visible: true,
      width: 150,
    });
    expect(state.columns[2]).toEqual({
      field: 'value',
      order: 2,
      visible: true,
      width: 120, // Uses __renderedWidth when available
    });
  });

  it('includes sort state when present', () => {
    const grid = makeGrid({
      _sortState: { field: 'name', direction: 1 },
    });
    const plugins: BaseGridPlugin[] = [];

    const state = collectColumnState(grid, plugins);

    expect(state.columns[1].sort).toEqual({
      direction: 'asc',
      priority: 0,
    });
    expect(state.columns[0].sort).toBeUndefined();
    expect(state.columns[2].sort).toBeUndefined();
  });

  it('includes descending sort state', () => {
    const grid = makeGrid({
      _sortState: { field: 'id', direction: -1 },
    });
    const plugins: BaseGridPlugin[] = [];

    const state = collectColumnState(grid, plugins);

    expect(state.columns[0].sort).toEqual({
      direction: 'desc',
      priority: 0,
    });
  });

  it('merges plugin state contributions', () => {
    const grid = makeGrid();
    const mockPlugin = {
      getColumnState: (field: string) => {
        if (field === 'name') {
          return { filter: { type: 'contains', value: 'test' } };
        }
        return undefined;
      },
    } as unknown as BaseGridPlugin;

    const state = collectColumnState(grid, [mockPlugin]);

    expect((state.columns[1] as any).filter).toEqual({ type: 'contains', value: 'test' });
    expect((state.columns[0] as any).filter).toBeUndefined();
  });
});

describe('applyColumnState', () => {
  it('applies width from state', () => {
    const grid = makeGrid({ columns: [] });
    const allColumns: ColumnInternal[] = [
      { field: 'id', width: 100 },
      { field: 'name', width: 150 },
    ];
    const state: GridColumnState = {
      columns: [
        { field: 'id', order: 0, width: 200, visible: true },
        { field: 'name', order: 1, width: 250, visible: true },
      ],
    };
    const plugins: BaseGridPlugin[] = [];

    applyColumnState(grid, state, allColumns, plugins);

    expect(grid._columns[0].width).toBe(200);
    expect(grid._columns[0].__renderedWidth).toBe(200);
    expect(grid._columns[1].width).toBe(250);
  });

  it('applies visibility (hidden) from state', () => {
    const grid = makeGrid({ columns: [] });
    const allColumns: ColumnInternal[] = [{ field: 'id' }, { field: 'name' }];
    const state: GridColumnState = {
      columns: [
        { field: 'id', order: 0, visible: true },
        { field: 'name', order: 1, visible: false },
      ],
    };
    const plugins: BaseGridPlugin[] = [];

    applyColumnState(grid, state, allColumns, plugins);

    expect(grid._columns[0].hidden).toBeFalsy();
    expect(grid._columns[1].hidden).toBe(true);
  });

  it('reorders columns based on state', () => {
    const grid = makeGrid({ columns: [] });
    const allColumns: ColumnInternal[] = [{ field: 'id' }, { field: 'name' }, { field: 'value' }];
    const state: GridColumnState = {
      columns: [
        { field: 'name', order: 0, visible: true },
        { field: 'value', order: 1, visible: true },
        { field: 'id', order: 2, visible: true },
      ],
    };
    const plugins: BaseGridPlugin[] = [];

    applyColumnState(grid, state, allColumns, plugins);

    expect(grid._columns.map((c: any) => c.field)).toEqual(['name', 'value', 'id']);
  });

  it('applies sort state to grid', () => {
    const grid = makeGrid({ columns: [] });
    const allColumns: ColumnInternal[] = [{ field: 'id' }, { field: 'name' }];
    const state: GridColumnState = {
      columns: [
        { field: 'id', order: 0, visible: true },
        { field: 'name', order: 1, visible: true, sort: { direction: 'asc', priority: 0 } },
      ],
    };
    const plugins: BaseGridPlugin[] = [];

    applyColumnState(grid, state, allColumns, plugins);

    expect(grid._sortState).toEqual({ field: 'name', direction: 1 });
  });

  it('clears sort state when no sort in state', () => {
    const grid = makeGrid({
      columns: [],
      _sortState: { field: 'id', direction: 1 },
    });
    const allColumns: ColumnInternal[] = [{ field: 'id' }];
    const state: GridColumnState = {
      columns: [{ field: 'id', order: 0, visible: true }],
    };
    const plugins: BaseGridPlugin[] = [];

    applyColumnState(grid, state, allColumns, plugins);

    expect(grid._sortState).toBeNull();
  });

  it('calls plugin applyColumnState hooks', () => {
    const grid = makeGrid({ columns: [] });
    const allColumns: ColumnInternal[] = [{ field: 'id' }];
    const state: GridColumnState = {
      columns: [{ field: 'id', order: 0, visible: true, filter: { value: 'test' } } as ColumnState],
    };
    const applyMock = vi.fn();
    const mockPlugin = {
      applyColumnState: applyMock,
    } as unknown as BaseGridPlugin;

    applyColumnState(grid, state, allColumns, [mockPlugin]);

    expect(applyMock).toHaveBeenCalledWith('id', state.columns[0]);
  });
});

describe('createStateChangeHandler', () => {
  it('creates a debounced handler', async () => {
    const grid = makeGrid();
    const emitMock = vi.fn();
    const getPlugins = () => [] as BaseGridPlugin[];

    const handler = createStateChangeHandler(grid, getPlugins, emitMock);
    handler();

    // Should not emit immediately
    expect(emitMock).not.toHaveBeenCalled();

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 150));

    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ columns: expect.any(Array) }));
  });

  it('debounces multiple calls', async () => {
    const grid = makeGrid();
    const emitMock = vi.fn();
    const getPlugins = () => [] as BaseGridPlugin[];

    const handler = createStateChangeHandler(grid, getPlugins, emitMock);
    handler();
    handler();
    handler();

    await new Promise((r) => setTimeout(r, 150));

    // Should only emit once
    expect(emitMock).toHaveBeenCalledTimes(1);
  });
});

describe('areColumnStatesEqual', () => {
  it('returns true for identical states', () => {
    const a: GridColumnState = {
      columns: [
        { field: 'id', order: 0, visible: true, width: 100 },
        { field: 'name', order: 1, visible: true },
      ],
    };
    const b: GridColumnState = {
      columns: [
        { field: 'id', order: 0, visible: true, width: 100 },
        { field: 'name', order: 1, visible: true },
      ],
    };

    expect(areColumnStatesEqual(a, b)).toBe(true);
  });

  it('returns false for different column counts', () => {
    const a: GridColumnState = { columns: [{ field: 'id', order: 0, visible: true }] };
    const b: GridColumnState = {
      columns: [
        { field: 'id', order: 0, visible: true },
        { field: 'name', order: 1, visible: true },
      ],
    };

    expect(areColumnStatesEqual(a, b)).toBe(false);
  });

  it('returns false for different order', () => {
    const a: GridColumnState = {
      columns: [
        { field: 'id', order: 0, visible: true },
        { field: 'name', order: 1, visible: true },
      ],
    };
    const b: GridColumnState = {
      columns: [
        { field: 'id', order: 1, visible: true },
        { field: 'name', order: 0, visible: true },
      ],
    };

    expect(areColumnStatesEqual(a, b)).toBe(false);
  });

  it('returns false for different width', () => {
    const a: GridColumnState = { columns: [{ field: 'id', order: 0, visible: true, width: 100 }] };
    const b: GridColumnState = { columns: [{ field: 'id', order: 0, visible: true, width: 200 }] };

    expect(areColumnStatesEqual(a, b)).toBe(false);
  });

  it('returns false for different visibility', () => {
    const a: GridColumnState = { columns: [{ field: 'id', order: 0, visible: true }] };
    const b: GridColumnState = { columns: [{ field: 'id', order: 0, visible: false }] };

    expect(areColumnStatesEqual(a, b)).toBe(false);
  });

  it('returns false for different sort', () => {
    const a: GridColumnState = {
      columns: [{ field: 'id', order: 0, visible: true, sort: { direction: 'asc', priority: 0 } }],
    };
    const b: GridColumnState = {
      columns: [{ field: 'id', order: 0, visible: true, sort: { direction: 'desc', priority: 0 } }],
    };

    expect(areColumnStatesEqual(a, b)).toBe(false);
  });

  it('handles undefined sort correctly', () => {
    const a: GridColumnState = { columns: [{ field: 'id', order: 0, visible: true }] };
    const b: GridColumnState = {
      columns: [{ field: 'id', order: 0, visible: true, sort: { direction: 'asc', priority: 0 } }],
    };

    expect(areColumnStatesEqual(a, b)).toBe(false);
    expect(areColumnStatesEqual(b, a)).toBe(false);
  });
});

// Import additional functions for testing
import {
  createColumnStateManager,
  getAllColumns,
  getColumnOrder,
  getGridColumnState,
  isColumnVisible,
  requestGridStateChange,
  resetGridColumnState,
  setColumnOrder,
  setColumnVisible,
  setGridColumnState,
  showAllColumns,
  toggleColumnVisibility,
} from './column-state';

describe('createColumnStateManager', () => {
  it('creates a manager with undefined initial values', () => {
    const manager = createColumnStateManager();
    expect(manager.initialState).toBeUndefined();
    expect(manager.stateChangeHandler).toBeUndefined();
  });
});

describe('getGridColumnState', () => {
  it('returns collected column state', () => {
    const grid = makeGrid();
    const result = getGridColumnState(grid, []);
    expect(result.columns).toHaveLength(3);
  });
});

describe('setGridColumnState', () => {
  it('does nothing when state is undefined', () => {
    const manager = createColumnStateManager();
    const applyNow = vi.fn();

    setGridColumnState(undefined, manager, true, applyNow);

    expect(manager.initialState).toBeUndefined();
    expect(applyNow).not.toHaveBeenCalled();
  });

  it('stores initial state', () => {
    const manager = createColumnStateManager();
    const state: GridColumnState = { columns: [{ field: 'id', order: 0, visible: true }] };
    const applyNow = vi.fn();

    setGridColumnState(state, manager, false, applyNow);

    expect(manager.initialState).toEqual(state);
  });

  it('applies state immediately when initialized', () => {
    const manager = createColumnStateManager();
    const state: GridColumnState = { columns: [{ field: 'id', order: 0, visible: true }] };
    const applyNow = vi.fn();

    setGridColumnState(state, manager, true, applyNow);

    expect(applyNow).toHaveBeenCalledWith(state);
  });

  it('does not apply state when not initialized', () => {
    const manager = createColumnStateManager();
    const state: GridColumnState = { columns: [{ field: 'id', order: 0, visible: true }] };
    const applyNow = vi.fn();

    setGridColumnState(state, manager, false, applyNow);

    expect(applyNow).not.toHaveBeenCalled();
  });
});

describe('requestGridStateChange', () => {
  it('creates handler if not exists and calls it', async () => {
    const grid = makeGrid();
    const manager = createColumnStateManager();
    const emit = vi.fn();

    requestGridStateChange(grid, manager, () => [], emit);

    expect(manager.stateChangeHandler).toBeDefined();

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 150));
    expect(emit).toHaveBeenCalled();
  });

  it('reuses existing handler', async () => {
    const grid = makeGrid();
    const manager = createColumnStateManager();
    const emit = vi.fn();

    requestGridStateChange(grid, manager, () => [], emit);
    const handler = manager.stateChangeHandler;

    requestGridStateChange(grid, manager, () => [], emit);
    expect(manager.stateChangeHandler).toBe(handler);
  });
});

describe('resetGridColumnState', () => {
  it('clears initial state', () => {
    const grid = makeGrid({ columns: [{ field: 'id' }] });
    grid.effectiveConfig = { columns: grid._columns };
    const manager = createColumnStateManager();
    manager.initialState = { columns: [{ field: 'id', order: 0, visible: true }] };

    const callbacks = {
      mergeEffectiveConfig: vi.fn(),
      setup: vi.fn(),
      requestStateChange: vi.fn(),
    };

    resetGridColumnState(grid, manager, [], callbacks);

    expect(manager.initialState).toBeUndefined();
  });

  it('clears sort state', () => {
    const grid = makeGrid({
      columns: [{ field: 'id' }],
      _sortState: { field: 'id', direction: 1 },
    });
    grid.effectiveConfig = { columns: grid._columns };
    const manager = createColumnStateManager();

    const callbacks = {
      mergeEffectiveConfig: vi.fn(),
      setup: vi.fn(),
      requestStateChange: vi.fn(),
    };

    resetGridColumnState(grid, manager, [], callbacks);

    expect(grid._sortState).toBeNull();
  });

  it('calls all callbacks', () => {
    const grid = makeGrid({ columns: [{ field: 'id' }] });
    grid.effectiveConfig = { columns: grid._columns };
    const manager = createColumnStateManager();

    const callbacks = {
      mergeEffectiveConfig: vi.fn(),
      setup: vi.fn(),
      requestStateChange: vi.fn(),
    };

    resetGridColumnState(grid, manager, [], callbacks);

    expect(callbacks.mergeEffectiveConfig).toHaveBeenCalled();
    expect(callbacks.setup).toHaveBeenCalled();
    expect(callbacks.requestStateChange).toHaveBeenCalled();
  });
});

describe('setColumnVisible', () => {
  const createCallbacks = () => ({
    emit: vi.fn(),
    clearRowPool: vi.fn(),
    setup: vi.fn(),
    requestStateChange: vi.fn(),
  });

  it('returns false for non-existent column', () => {
    const grid = makeGrid();
    grid.effectiveConfig = { columns: grid._columns };

    const result = setColumnVisible(grid, 'nonexistent', false, createCallbacks());
    expect(result).toBe(false);
  });

  it('returns false for locked visible column', () => {
    const grid = makeGrid({
      columns: [{ field: 'id', lockVisible: true }],
    });
    grid.effectiveConfig = { columns: grid._columns };

    const result = setColumnVisible(grid, 'id', false, createCallbacks());
    expect(result).toBe(false);
  });

  it('returns false when trying to hide last visible column', () => {
    const grid = makeGrid({
      columns: [{ field: 'id', hidden: false }],
    });
    grid.effectiveConfig = { columns: grid._columns };

    const result = setColumnVisible(grid, 'id', false, createCallbacks());
    expect(result).toBe(false);
  });

  it('returns false when visibility does not change', () => {
    const grid = makeGrid({
      columns: [
        { field: 'id', hidden: false },
        { field: 'name', hidden: false },
      ],
    });
    grid.effectiveConfig = { columns: grid._columns };

    const result = setColumnVisible(grid, 'id', true, createCallbacks());
    expect(result).toBe(false);
  });

  it('hides column and emits event', () => {
    const grid = makeGrid({
      columns: [
        { field: 'id', hidden: false },
        { field: 'name', hidden: false },
      ],
    });
    grid.effectiveConfig = { columns: grid._columns };
    const callbacks = createCallbacks();

    const result = setColumnVisible(grid, 'id', false, callbacks);

    expect(result).toBe(true);
    expect(grid._columns[0].hidden).toBe(true);
    expect(callbacks.emit).toHaveBeenCalledWith(
      'column-visibility',
      expect.objectContaining({ field: 'id', visible: false }),
    );
    expect(callbacks.clearRowPool).toHaveBeenCalled();
    expect(callbacks.setup).toHaveBeenCalled();
    expect(callbacks.requestStateChange).toHaveBeenCalled();
  });

  it('shows column and emits event', () => {
    const grid = makeGrid({
      columns: [
        { field: 'id', hidden: true },
        { field: 'name', hidden: false },
      ],
    });
    grid.effectiveConfig = { columns: grid._columns };
    const callbacks = createCallbacks();

    const result = setColumnVisible(grid, 'id', true, callbacks);

    expect(result).toBe(true);
    expect(grid._columns[0].hidden).toBe(false);
    expect(callbacks.emit).toHaveBeenCalledWith(
      'column-visibility',
      expect.objectContaining({ field: 'id', visible: true }),
    );
  });
});

describe('toggleColumnVisibility', () => {
  const createCallbacks = () => ({
    emit: vi.fn(),
    clearRowPool: vi.fn(),
    setup: vi.fn(),
    requestStateChange: vi.fn(),
  });

  it('returns false for non-existent column', () => {
    const grid = makeGrid();
    grid.effectiveConfig = { columns: grid._columns };

    const result = toggleColumnVisibility(grid, 'nonexistent', createCallbacks());
    expect(result).toBe(false);
  });

  it('toggles visible column to hidden', () => {
    const grid = makeGrid({
      columns: [
        { field: 'id', hidden: false },
        { field: 'name', hidden: false },
      ],
    });
    grid.effectiveConfig = { columns: grid._columns };

    const result = toggleColumnVisibility(grid, 'id', createCallbacks());

    expect(result).toBe(true);
    expect(grid._columns[0].hidden).toBe(true);
  });

  it('toggles hidden column to visible', () => {
    const grid = makeGrid({
      columns: [
        { field: 'id', hidden: true },
        { field: 'name', hidden: false },
      ],
    });
    grid.effectiveConfig = { columns: grid._columns };

    const result = toggleColumnVisibility(grid, 'id', createCallbacks());

    expect(result).toBe(true);
    expect(grid._columns[0].hidden).toBe(false);
  });
});

describe('isColumnVisible', () => {
  it('returns true for visible column', () => {
    const grid = makeGrid({
      columns: [{ field: 'id', hidden: false }],
    });
    grid.effectiveConfig = { columns: grid._columns };

    expect(isColumnVisible(grid, 'id')).toBe(true);
  });

  it('returns false for hidden column', () => {
    const grid = makeGrid({
      columns: [{ field: 'id', hidden: true }],
    });
    grid.effectiveConfig = { columns: grid._columns };

    expect(isColumnVisible(grid, 'id')).toBe(false);
  });

  it('returns false for non-existent column', () => {
    const grid = makeGrid();
    grid.effectiveConfig = { columns: grid._columns };

    expect(isColumnVisible(grid, 'nonexistent')).toBe(false);
  });
});

describe('showAllColumns', () => {
  const createCallbacks = () => ({
    emit: vi.fn(),
    clearRowPool: vi.fn(),
    setup: vi.fn(),
    requestStateChange: vi.fn(),
  });

  it('does nothing when all columns already visible', () => {
    const grid = makeGrid({
      columns: [
        { field: 'id', hidden: false },
        { field: 'name', hidden: false },
      ],
    });
    grid.effectiveConfig = { columns: grid._columns };
    const callbacks = createCallbacks();

    showAllColumns(grid, callbacks);

    expect(callbacks.emit).not.toHaveBeenCalled();
  });

  it('shows all hidden columns', () => {
    const grid = makeGrid({
      columns: [
        { field: 'id', hidden: true },
        { field: 'name', hidden: true },
      ],
    });
    grid.effectiveConfig = { columns: grid._columns };
    const callbacks = createCallbacks();

    showAllColumns(grid, callbacks);

    expect(grid._columns[0].hidden).toBe(false);
    expect(grid._columns[1].hidden).toBe(false);
    expect(callbacks.emit).toHaveBeenCalled();
  });
});

describe('getAllColumns', () => {
  it('returns all columns with visibility info', () => {
    const grid = makeGrid({
      columns: [
        { field: 'id', header: 'ID', hidden: false, lockVisible: true },
        { field: 'name', hidden: true },
      ],
    });
    grid.effectiveConfig = { columns: grid._columns };

    const result = getAllColumns(grid);

    expect(result).toEqual([
      { field: 'id', header: 'ID', visible: true, lockVisible: true },
      { field: 'name', header: 'name', visible: false, lockVisible: undefined },
    ]);
  });
});

describe('getColumnOrder', () => {
  it('returns fields in order', () => {
    const grid = makeGrid();
    const result = getColumnOrder(grid);
    expect(result).toEqual(['id', 'name', 'value']);
  });
});

describe('setColumnOrder', () => {
  const createCallbacks = () => ({
    renderHeader: vi.fn(),
    updateTemplate: vi.fn(),
    refreshVirtualWindow: vi.fn(),
  });

  it('does nothing for empty order', () => {
    const grid = makeGrid();
    const callbacks = createCallbacks();

    setColumnOrder(grid, [], callbacks);

    expect(callbacks.renderHeader).not.toHaveBeenCalled();
  });

  it('reorders columns according to order array', () => {
    const grid = makeGrid();
    const callbacks = createCallbacks();

    setColumnOrder(grid, ['value', 'id', 'name'], callbacks);

    expect(getColumnOrder(grid)).toEqual(['value', 'id', 'name']);
  });

  it('appends columns not in order array', () => {
    const grid = makeGrid();
    const callbacks = createCallbacks();

    setColumnOrder(grid, ['name'], callbacks);

    expect(getColumnOrder(grid)).toEqual(['name', 'id', 'value']);
  });

  it('calls all callbacks', () => {
    const grid = makeGrid();
    const callbacks = createCallbacks();

    setColumnOrder(grid, ['id', 'name', 'value'], callbacks);

    expect(callbacks.renderHeader).toHaveBeenCalled();
    expect(callbacks.updateTemplate).toHaveBeenCalled();
    expect(callbacks.refreshVirtualWindow).toHaveBeenCalled();
  });
});
