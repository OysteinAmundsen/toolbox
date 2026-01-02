import { describe, expect, it, vi } from 'vitest';
import { applySort, toggleSort } from './sorting';

// Mock renderHeader to avoid import resolution issues in tests
vi.mock('./header', () => ({
  renderHeader: vi.fn(),
}));

/**
 * Creates a minimal InternalGrid mock for sorting tests.
 */
function makeGrid(opts: Partial<any> = {}) {
  const host = document.createElement('div');
  host.innerHTML = '<div class="header-row"></div><div class="rows"></div>';
  const events: any[] = [];
  const grid: any = {
    _rows: opts.rows || [
      { id: 3, name: 'Charlie', value: 30 },
      { id: 1, name: 'Alice', value: 10 },
      { id: 2, name: 'Bob', value: 20 },
    ],
    _columns: opts.columns || [
      { field: 'id', sortable: true },
      { field: 'name', sortable: true },
      { field: 'value', sortable: true },
    ],
    get _visibleColumns() {
      return this._columns.filter((c: any) => !c.hidden);
    },
    _headerRowEl: host.querySelector('.header-row') as HTMLElement,
    _bodyEl: host.querySelector('.rows') as HTMLElement,
    _rowPool: [],
    _sortState: opts._sortState || null,
    __originalOrder: opts.__originalOrder || null,
    __rowRenderEpoch: 0,
    findHeaderRow: function () {
      return this._headerRowEl;
    },
    _resizeController: {
      start: () => {
        /* empty */
      },
    },
    dispatchEvent: (ev: any) => events.push(ev),
    _dispatchHeaderClick: () => false,
    refreshVirtualWindow: () => {
      /* empty */
    },
    requestStateChange: () => {
      /* empty */
    },
    __events: events,
  };
  return grid;
}

describe('toggleSort', () => {
  it('sets ascending sort on first toggle', () => {
    const g = makeGrid();
    const col = g._columns[0];
    toggleSort(g, col);
    expect(g._sortState).toEqual({ field: 'id', direction: 1 });
  });

  it('cycles to descending on second toggle', () => {
    const g = makeGrid();
    const col = g._columns[0];
    toggleSort(g, col);
    toggleSort(g, col);
    expect(g._sortState).toEqual({ field: 'id', direction: -1 });
  });

  it('clears sort on third toggle', () => {
    const g = makeGrid();
    const col = g._columns[0];
    toggleSort(g, col);
    toggleSort(g, col);
    toggleSort(g, col);
    expect(g._sortState).toBeNull();
  });

  it('saves original order before first sort', () => {
    const g = makeGrid();
    const originalIds = g._rows.map((r: any) => r.id);
    const col = g._columns[0];
    toggleSort(g, col);
    expect(g.__originalOrder.map((r: any) => r.id)).toEqual(originalIds);
  });

  it('restores original order when sort cleared', () => {
    const g = makeGrid();
    const originalIds = g._rows.map((r: any) => r.id);
    const col = g._columns[0];
    toggleSort(g, col);
    toggleSort(g, col);
    toggleSort(g, col);
    expect(g._rows.map((r: any) => r.id)).toEqual(originalIds);
  });

  it('emits sort-change event with direction 0 when cleared', () => {
    const g = makeGrid();
    const col = g._columns[0];
    toggleSort(g, col);
    toggleSort(g, col);
    toggleSort(g, col);
    const lastEvent = g.__events[g.__events.length - 1];
    expect(lastEvent.type).toBe('sort-change');
    expect(lastEvent.detail).toEqual({ field: 'id', direction: 0 });
  });

  it('switching column resets to ascending', () => {
    const g = makeGrid();
    toggleSort(g, g._columns[0]); // id asc
    toggleSort(g, g._columns[1]); // name asc (new column)
    expect(g._sortState).toEqual({ field: 'name', direction: 1 });
  });

  it('increments __rowRenderEpoch on clear', () => {
    const g = makeGrid();
    const col = g._columns[0];
    toggleSort(g, col);
    toggleSort(g, col);
    const epochBefore = g.__rowRenderEpoch;
    toggleSort(g, col);
    expect(g.__rowRenderEpoch).toBeGreaterThan(epochBefore);
  });
});

describe('applySort', () => {
  it('sorts rows ascending by field', () => {
    const g = makeGrid();
    applySort(g, g._columns[0], 1);
    const ids = g._rows.map((r: any) => r.id);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('sorts rows descending by field', () => {
    const g = makeGrid();
    applySort(g, g._columns[0], -1);
    const ids = g._rows.map((r: any) => r.id);
    expect(ids).toEqual([3, 2, 1]);
  });

  it('sorts string fields correctly', () => {
    const g = makeGrid();
    applySort(g, g._columns[1], 1);
    const names = g._rows.map((r: any) => r.name);
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('uses custom sortComparator when provided', () => {
    const g = makeGrid({
      columns: [
        {
          field: 'name',
          sortable: true,
          sortComparator: (a: string, b: string) => b.localeCompare(a), // reverse alphabetical
        },
      ],
    });
    applySort(g, g._columns[0], 1);
    const names = g._rows.map((r: any) => r.name);
    expect(names).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('handles null values in sort', () => {
    const g = makeGrid({
      rows: [
        { id: 1, value: 10 },
        { id: 2, value: null },
        { id: 3, value: 5 },
      ],
      columns: [{ field: 'value', sortable: true }],
    });
    applySort(g, g._columns[0], 1);
    // nulls should sort to top
    const values = g._rows.map((r: any) => r.value);
    expect(values[0]).toBeNull();
  });

  it('emits sort-change event', () => {
    const g = makeGrid();
    applySort(g, g._columns[0], 1);
    const event = g.__events.find((e: any) => e.type === 'sort-change');
    expect(event).toBeTruthy();
    expect(event.detail).toEqual({ field: 'id', direction: 1 });
  });

  it('increments __rowRenderEpoch', () => {
    const g = makeGrid();
    const epochBefore = g.__rowRenderEpoch;
    applySort(g, g._columns[0], 1);
    expect(g.__rowRenderEpoch).toBeGreaterThan(epochBefore);
  });

  it('invalidates row pool epochs', () => {
    const g = makeGrid();
    const row1 = document.createElement('div') as any;
    row1.__epoch = 5;
    g._rowPool = [row1];
    applySort(g, g._columns[0], 1);
    expect(row1.__epoch).toBe(-1);
  });

  it('sets sortState correctly', () => {
    const g = makeGrid();
    applySort(g, g._columns[1], -1);
    expect(g._sortState).toEqual({ field: 'name', direction: -1 });
  });
});
