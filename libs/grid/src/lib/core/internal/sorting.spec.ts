import { describe, expect, it, vi } from 'vitest';
import { applySort, builtInSort, defaultComparator, reapplyCoreSort, toggleSort } from './sorting';

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
    _pluginManager: opts._pluginManager || undefined,
    findHeaderRow: function () {
      return this._headerRowEl;
    },
    _resizeController: {
      start: () => {
        /* empty */
      },
    },
    dispatchEvent: (ev: any) => events.push(ev),
    _dispatchHeaderClick: () => false as boolean,
    refreshVirtualWindow: () => {
      /* empty */
    },
    requestStateChange: () => {
      /* empty */
    },
    _requestSchedulerPhase:
      opts._requestSchedulerPhase ||
      (() => {
        /* noop */
      }),
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

  it('uses custom sortHandler from effectiveConfig', () => {
    const customHandler = vi.fn((rows, sortState) => {
      // Custom: sort by name length instead of value
      return [...rows].sort((a, b) => a.name.length - b.name.length);
    });

    const g = makeGrid();
    g.effectiveConfig = { sortHandler: customHandler };

    applySort(g, g._columns[0], 1);

    expect(customHandler).toHaveBeenCalledWith(expect.any(Array), { field: 'id', direction: 1 }, expect.any(Array));
    // Custom handler sorted by name length: Bob (3), Alice (5), Charlie (7)
    expect(g._rows.map((r: any) => r.name)).toEqual(['Bob', 'Alice', 'Charlie']);
  });

  it('supports async sortHandler', async () => {
    const asyncHandler = vi.fn(async (rows, sortState) => {
      // Simulate server delay
      await new Promise((r) => setTimeout(r, 10));
      return [...rows].sort((a, b) => a.id - b.id);
    });

    const g = makeGrid();
    g.effectiveConfig = { sortHandler: asyncHandler };

    applySort(g, g._columns[0], 1);

    // Wait for async handler to complete
    await new Promise((r) => setTimeout(r, 20));

    expect(asyncHandler).toHaveBeenCalled();
    expect(g._rows.map((r: any) => r.id)).toEqual([1, 2, 3]);
  });

  it('emits sort-change to BOTH the DOM and the plugin event bus', () => {
    // Regression: ServerSidePlugin (and other plugins) subscribe to sort-change via
    // `this.on(...)`, which listens on the plugin event bus — not DOM events.
    // If core sort only dispatches a DOM CustomEvent, plugins never see the change
    // (e.g. ServerSide does not purge its block cache → grid appears not to sort).
    const emitPluginEvent = vi.fn();
    const g = makeGrid({ _pluginManager: { emitPluginEvent } });

    applySort(g, g._columns[1], -1);

    // DOM event still fires for external consumers
    expect(g.__events).toHaveLength(1);
    expect(g.__events[0].type).toBe('sort-change');
    expect(g.__events[0].detail).toEqual({ field: 'name', direction: -1 });

    // Plugin bus event also fires so plugins like ServerSide react
    expect(emitPluginEvent).toHaveBeenCalledWith('sort-change', { field: 'name', direction: -1 });
  });
});

describe('defaultComparator', () => {
  it('returns 0 for equal values', () => {
    expect(defaultComparator(5, 5)).toBe(0);
    expect(defaultComparator('a', 'a')).toBe(0);
  });

  it('returns 0 for both null/undefined', () => {
    expect(defaultComparator(null, null)).toBe(0);
    expect(defaultComparator(undefined, undefined)).toBe(0);
    expect(defaultComparator(null, undefined)).toBe(0);
  });

  it('pushes null/undefined to top (returns -1)', () => {
    expect(defaultComparator(null, 5)).toBe(-1);
    expect(defaultComparator(undefined, 'a')).toBe(-1);
  });

  it('returns 1 when second is null/undefined', () => {
    expect(defaultComparator(5, null)).toBe(1);
    expect(defaultComparator('a', undefined)).toBe(1);
  });

  it('compares numbers correctly', () => {
    expect(defaultComparator(1, 2)).toBe(-1);
    expect(defaultComparator(3, 2)).toBe(1);
  });

  it('compares strings correctly', () => {
    expect(defaultComparator('a', 'b')).toBe(-1);
    expect(defaultComparator('z', 'a')).toBe(1);
  });
});

describe('builtInSort', () => {
  const rows = [
    { id: 3, name: 'Charlie' },
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];

  const columns = [
    { field: 'id', sortable: true },
    { field: 'name', sortable: true },
  ];

  it('sorts ascending by field', () => {
    const result = builtInSort(rows, { field: 'id', direction: 1 }, columns as any);
    expect(result.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('sorts descending by field', () => {
    const result = builtInSort(rows, { field: 'id', direction: -1 }, columns as any);
    expect(result.map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it('uses column sortComparator when provided', () => {
    const columnsWithComparator = [
      {
        field: 'name',
        sortable: true,
        sortComparator: (a: string, b: string) => b.localeCompare(a), // reverse
      },
    ];
    const result = builtInSort(rows, { field: 'name', direction: 1 }, columnsWithComparator as any);
    expect(result.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('does not mutate original array', () => {
    const original = [...rows];
    builtInSort(rows, { field: 'id', direction: 1 }, columns as any);
    expect(rows.map((r) => r.id)).toEqual(original.map((r) => r.id));
  });
});

describe('reapplyCoreSort', () => {
  it('returns rows unchanged when no sort state is active', () => {
    const g = makeGrid({ _sortState: null });
    const input = [{ id: 3 }, { id: 1 }, { id: 2 }];
    const result = reapplyCoreSort(g, input);
    expect(result).toBe(input); // same reference — no work done
  });

  it('re-sorts rows when a core sort state is active', () => {
    const g = makeGrid({
      _sortState: { field: 'id', direction: 1 },
    });
    const input = [
      { id: 3, name: 'C', value: 30 },
      { id: 1, name: 'A', value: 10 },
      { id: 2, name: 'B', value: 20 },
    ];
    const result = reapplyCoreSort(g, input);
    expect(result.map((r: any) => r.id)).toEqual([1, 2, 3]);
  });

  it('updates __originalOrder to the current (unsorted) input', () => {
    const g = makeGrid({
      _sortState: { field: 'id', direction: 1 },
      __originalOrder: [{ id: 99 }], // stale
    });
    const input = [
      { id: 3, name: 'C', value: 30 },
      { id: 1, name: 'A', value: 10 },
    ];
    reapplyCoreSort(g, input);
    expect(g.__originalOrder.map((r: any) => r.id)).toEqual([3, 1]);
  });
});

describe('sorting with row-structure plugins (grouping/tree/pivot)', () => {
  function makeGridWithRowStructurePlugins() {
    const schedulerSpy = vi.fn();
    return makeGrid({
      _pluginManager: { _hasRowStructurePlugins: true },
      _requestSchedulerPhase: schedulerSpy,
    });
  }

  describe('applySort', () => {
    it('delegates to render scheduler when row-structure plugins are active', () => {
      const g = makeGridWithRowStructurePlugins();
      applySort(g, g._columns[0], 1);

      expect(g._requestSchedulerPhase).toHaveBeenCalledWith(4, 'sort-apply');
    });

    it('sets _sortState before delegating to scheduler', () => {
      const g = makeGridWithRowStructurePlugins();
      applySort(g, g._columns[1], -1);

      expect(g._sortState).toEqual({ field: 'name', direction: -1 });
    });

    it('emits sort-change event when delegating to scheduler', () => {
      const g = makeGridWithRowStructurePlugins();
      applySort(g, g._columns[0], 1);

      const event = g.__events.find((e: any) => e.type === 'sort-change');
      expect(event).toBeTruthy();
      expect(event.detail).toEqual({ field: 'id', direction: 1 });
    });

    it('does NOT mutate _rows directly when row-structure plugins are active', () => {
      const g = makeGridWithRowStructurePlugins();
      const rowsBefore = [...g._rows];
      applySort(g, g._columns[0], 1);

      // _rows should be untouched — the scheduler will handle rebuilding via #rebuildRowModel
      expect(g._rows.map((r: any) => r.id)).toEqual(rowsBefore.map((r: any) => r.id));
    });

    it('sorts _rows directly when no row-structure plugins are active', () => {
      const g = makeGrid(); // no _pluginManager
      applySort(g, g._columns[0], 1);

      expect(g._rows.map((r: any) => r.id)).toEqual([1, 2, 3]);
    });

    it('sorts _rows directly when only filtering plugins are active (no row-structure)', () => {
      const g = makeGrid({
        _pluginManager: { _hasRowStructurePlugins: false },
      });
      applySort(g, g._columns[0], 1);

      // Filtering doesn't inject synthetic rows — fast path is safe
      expect(g._rows.map((r: any) => r.id)).toEqual([1, 2, 3]);
    });
  });

  describe('toggleSort', () => {
    it('delegates sort-clear to scheduler when row-structure plugins are active', () => {
      const g = makeGridWithRowStructurePlugins();
      const col = g._columns[0];
      toggleSort(g, col); // asc
      toggleSort(g, col); // desc
      toggleSort(g, col); // clear

      expect(g._sortState).toBeNull();
      expect(g._requestSchedulerPhase).toHaveBeenCalledWith(4, 'sort-clear');
    });

    it('emits sort-change with direction 0 on scheduler-delegated clear', () => {
      const g = makeGridWithRowStructurePlugins();
      const col = g._columns[0];
      toggleSort(g, col);
      toggleSort(g, col);
      toggleSort(g, col);

      const lastEvent = g.__events[g.__events.length - 1];
      expect(lastEvent.type).toBe('sort-change');
      expect(lastEvent.detail).toEqual({ field: 'id', direction: 0 });
    });

    it('does NOT restore __originalOrder directly when clearing with row-structure plugins', () => {
      const g = makeGridWithRowStructurePlugins();
      const col = g._columns[0];
      toggleSort(g, col); // asc — saves __originalOrder
      toggleSort(g, col); // desc
      toggleSort(g, col); // clear — should NOT directly set _rows

      // _rows should not have been directly manipulated to __originalOrder.
      // The scheduler handles it via #rebuildRowModel.
      expect(g._requestSchedulerPhase).toHaveBeenCalledWith(4, 'sort-clear');
    });
  });

  describe('_pluginManager._hasRowStructurePlugins detection', () => {
    it('treats undefined _pluginManager as no row-structure plugins', () => {
      const g = makeGrid(); // _pluginManager is undefined
      applySort(g, g._columns[0], 1);

      // Should take fast path (direct sort)
      expect(g._rows.map((r: any) => r.id)).toEqual([1, 2, 3]);
    });

    it('treats _hasRowStructurePlugins=false as no row-structure plugins', () => {
      const g = makeGrid({
        _pluginManager: { _hasRowStructurePlugins: false },
      });
      applySort(g, g._columns[0], 1);

      // Should take fast path
      expect(g._rows.map((r: any) => r.id)).toEqual([1, 2, 3]);
    });
  });
});
