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
