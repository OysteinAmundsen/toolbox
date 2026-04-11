/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultiSortPlugin } from './MultiSortPlugin';
import type { SortModel } from './types';

function createGridMock(rows: any[] = [], columns: any[] = []) {
  const gridEl = document.createElement('div');
  // Create header row with cells
  const headerRow = document.createElement('div');
  headerRow.className = 'header-row';
  for (const col of columns) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-field', col.field);
    if (col.sortable) cell.classList.add('sortable');
    // Add a label span
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = col.header ?? col.field;
    cell.appendChild(label);
    headerRow.appendChild(cell);
  }
  gridEl.appendChild(headerRow);

  return {
    rows,
    sourceRows: rows,
    columns,
    _visibleColumns: columns.filter((c: any) => !c.hidden),
    _hostElement: gridEl,
    _sortState: null as any,
    _activeEditRows: -1,
    _isGridEditMode: false,
    _rows: null as any,
    gridConfig: {},
    effectiveConfig: {},
    getPlugin: () => undefined,
    getPluginByName: () => undefined,
    query: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    requestRender: vi.fn(),
    requestStateChange: vi.fn(),
    requestAfterRender: vi.fn(),
    children: [gridEl],
    querySelectorAll: (sel: string) => gridEl.querySelectorAll(sel),
    querySelector: (sel: string) => gridEl.querySelector(sel),
    clientWidth: 800,
    classList: { add: vi.fn(), remove: vi.fn() },
    disconnectSignal: new AbortController().signal,
  };
}

const sortableColumns = [
  { field: 'name', header: 'Name', sortable: true },
  { field: 'age', header: 'Age', type: 'number' as const, sortable: true },
  { field: 'city', header: 'City', sortable: true },
  { field: 'id', header: 'ID', sortable: false },
];

describe('MultiSortPlugin', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor & defaults', () => {
    it('should have name "multiSort"', () => {
      const plugin = new MultiSortPlugin();
      expect(plugin.name).toBe('multiSort');
    });

    it('should return empty sort model initially', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      expect(plugin.getSortModel()).toEqual([]);
    });
  });

  describe('getSortModel / setSortModel', () => {
    it('should set and get sort model', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      const model: SortModel[] = [
        { field: 'name', direction: 'asc' },
        { field: 'age', direction: 'desc' },
      ];
      plugin.setSortModel(model);

      expect(plugin.getSortModel()).toEqual(model);
    });

    it('should return a copy, not the internal array', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      const model = plugin.getSortModel();
      model.push({ field: 'age', direction: 'desc' });

      // Internal model should not be affected
      expect(plugin.getSortModel()).toHaveLength(1);
    });

    it('should emit sort-change event when setting model', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);

      expect(grid.dispatchEvent).toHaveBeenCalled();
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('sort-change');
      expect(event.detail.sortModel).toEqual([{ field: 'name', direction: 'asc' }]);
    });

    it('should request render when setting model', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);

      expect(grid.requestRender).toHaveBeenCalled();
    });

    it('should request state change when setting model', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);

      expect(grid.requestStateChange).toHaveBeenCalled();
    });
  });

  describe('clearSort', () => {
    it('should clear the sort model', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.clearSort();

      expect(plugin.getSortModel()).toEqual([]);
    });

    it('should emit sort-change with empty model', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      grid.dispatchEvent.mockClear();
      plugin.clearSort();

      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('sort-change');
      expect(event.detail.sortModel).toEqual([]);
    });

    it('should request render', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.clearSort();

      expect(grid.requestRender).toHaveBeenCalled();
    });
  });

  describe('getSortIndex / getSortDirection', () => {
    it('should return sort index for a sorted column', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([
        { field: 'name', direction: 'asc' },
        { field: 'age', direction: 'desc' },
      ]);

      expect(plugin.getSortIndex('name')).toBe(1);
      expect(plugin.getSortIndex('age')).toBe(2);
    });

    it('should return undefined for unsorted column', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      expect(plugin.getSortIndex('city')).toBeUndefined();
    });

    it('should return sort direction for a sorted column', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([
        { field: 'name', direction: 'asc' },
        { field: 'age', direction: 'desc' },
      ]);

      expect(plugin.getSortDirection('name')).toBe('asc');
      expect(plugin.getSortDirection('age')).toBe('desc');
    });

    it('should return undefined direction for unsorted column', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      expect(plugin.getSortDirection('city')).toBeUndefined();
    });
  });

  describe('onHeaderClick', () => {
    it('should sort ascending on first click of sortable column', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      const result = plugin.onHeaderClick({
        field: 'name',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      });

      expect(result).toBe(true);
      expect(plugin.getSortModel()).toEqual([{ field: 'name', direction: 'asc' }]);
    });

    it('should toggle to descending on second click', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      const event = {
        field: 'name',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      };
      plugin.onHeaderClick(event);
      plugin.onHeaderClick(event);

      expect(plugin.getSortModel()).toEqual([{ field: 'name', direction: 'desc' }]);
    });

    it('should clear sort on third click', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      const event = {
        field: 'name',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      };
      plugin.onHeaderClick(event);
      plugin.onHeaderClick(event);
      plugin.onHeaderClick(event);

      expect(plugin.getSortModel()).toEqual([]);
    });

    it('should not sort non-sortable columns', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      const result = plugin.onHeaderClick({
        field: 'id',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      });

      expect(result).toBe(false);
      expect(plugin.getSortModel()).toEqual([]);
    });

    it('should add secondary sort with Shift+click', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      // First sort
      plugin.onHeaderClick({
        field: 'name',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      });

      // Shift+click on second column
      plugin.onHeaderClick({
        field: 'age',
        originalEvent: new MouseEvent('click', { shiftKey: true }),
        headerElement: document.createElement('div'),
      });

      expect(plugin.getSortModel()).toEqual([
        { field: 'name', direction: 'asc' },
        { field: 'age', direction: 'asc' },
      ]);
    });

    it('should replace existing sorts on click without Shift', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      // Multi-sort
      plugin.onHeaderClick({
        field: 'name',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      });
      plugin.onHeaderClick({
        field: 'age',
        originalEvent: new MouseEvent('click', { shiftKey: true }),
        headerElement: document.createElement('div'),
      });

      // Click without Shift should replace
      plugin.onHeaderClick({
        field: 'city',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      });

      expect(plugin.getSortModel()).toEqual([{ field: 'city', direction: 'asc' }]);
    });

    it('should respect maxSortColumns', () => {
      const plugin = new MultiSortPlugin({ maxSortColumns: 2 });
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.onHeaderClick({
        field: 'name',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      });
      plugin.onHeaderClick({
        field: 'age',
        originalEvent: new MouseEvent('click', { shiftKey: true }),
        headerElement: document.createElement('div'),
      });
      // Third Shift+click should not add when at maxSortColumns
      plugin.onHeaderClick({
        field: 'city',
        originalEvent: new MouseEvent('click', { shiftKey: true }),
        headerElement: document.createElement('div'),
      });

      expect(plugin.getSortModel()).toHaveLength(2);
    });

    it('should emit sort-change event on header click', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.onHeaderClick({
        field: 'name',
        originalEvent: new MouseEvent('click'),
        headerElement: document.createElement('div'),
      });

      expect(grid.dispatchEvent).toHaveBeenCalled();
      const event = grid.dispatchEvent.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('sort-change');
    });
  });

  describe('processRows', () => {
    it('should return rows copy when no sorts', () => {
      const plugin = new MultiSortPlugin();
      const rows = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }];
      const grid = createGridMock(rows, sortableColumns);
      plugin.attach(grid as any);

      const result = plugin.processRows(rows);
      expect(result).toEqual(rows);
      expect(result).not.toBe(rows);
    });

    it('should sort rows by single column', () => {
      const plugin = new MultiSortPlugin();
      const rows = [
        { name: 'Charlie', age: 35 },
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];
      const grid = createGridMock(rows, sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      const result = plugin.processRows(rows);

      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Charlie');
    });

    it('should sort rows descending', () => {
      const plugin = new MultiSortPlugin();
      const rows = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
        { name: 'Charlie', age: 35 },
      ];
      const grid = createGridMock(rows, sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'age', direction: 'desc' }]);
      const result = plugin.processRows(rows);

      expect(result[0].age).toBe(35);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(25);
    });

    it('should apply multi-column sort', () => {
      const plugin = new MultiSortPlugin();
      const rows = [
        { name: 'Alice', city: 'NY' },
        { name: 'Bob', city: 'LA' },
        { name: 'Alice', city: 'LA' },
      ];
      const cols = [
        { field: 'name', header: 'Name', sortable: true },
        { field: 'city', header: 'City', sortable: true },
      ];
      const grid = createGridMock(rows, cols);
      plugin.attach(grid as any);

      plugin.setSortModel([
        { field: 'name', direction: 'asc' },
        { field: 'city', direction: 'asc' },
      ]);
      const result = plugin.processRows(rows);

      expect(result[0]).toEqual({ name: 'Alice', city: 'LA' });
      expect(result[1]).toEqual({ name: 'Alice', city: 'NY' });
      expect(result[2]).toEqual({ name: 'Bob', city: 'LA' });
    });

    it('should return cached result when a row is being edited (non-grid mode)', () => {
      const plugin = new MultiSortPlugin();
      const rows = [
        { name: 'Charlie', age: 35 },
        { name: 'Alice', age: 30 },
      ];
      const grid = createGridMock(rows, sortableColumns);
      grid._activeEditRows = 0; // Row 0 is being edited
      grid._isGridEditMode = false;
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      const result1 = plugin.processRows(rows);
      // Mutate the row object in-place (simulating edit)
      result1[0].name = 'Zara';
      const result2 = plugin.processRows(rows);

      // Should return cached result (same structure, shared object refs)
      expect(result2).toHaveLength(rows.length);
    });
  });

  describe('afterRender', () => {
    it('should add data-sort attribute to sorted header cells', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.afterRender();

      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]');
      expect(nameCell?.getAttribute('data-sort')).toBe('asc');
    });

    it('should remove data-sort attribute from unsorted columns', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      // Sort then clear
      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.afterRender();
      plugin.clearSort();
      plugin.afterRender();

      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]');
      expect(nameCell?.hasAttribute('data-sort')).toBe(false);
    });

    it('should add sort-indicator element to sorted columns', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.afterRender();

      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]');
      const indicator = nameCell?.querySelector('.sort-indicator');
      expect(indicator).not.toBeNull();
    });

    it('should add sort-index badges when multiple columns sorted and showSortIndex is true', () => {
      const plugin = new MultiSortPlugin({ showSortIndex: true });
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([
        { field: 'name', direction: 'asc' },
        { field: 'age', direction: 'desc' },
      ]);
      plugin.afterRender();

      const nameBadge = grid._hostElement.querySelector('.cell[data-field="name"] .sort-index');
      const ageBadge = grid._hostElement.querySelector('.cell[data-field="age"] .sort-index');
      expect(nameBadge?.textContent).toBe('1');
      expect(ageBadge?.textContent).toBe('2');
    });

    it('should not add sort-index badges when showSortIndex is false', () => {
      const plugin = new MultiSortPlugin({ showSortIndex: false });
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([
        { field: 'name', direction: 'asc' },
        { field: 'age', direction: 'desc' },
      ]);
      plugin.afterRender();

      const badges = grid._hostElement.querySelectorAll('.sort-index');
      expect(badges.length).toBe(0);
    });

    it('should not add sort-index badges for single column sort', () => {
      const plugin = new MultiSortPlugin({ showSortIndex: true });
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.afterRender();

      const badges = grid._hostElement.querySelectorAll('.sort-index');
      expect(badges.length).toBe(0);
    });

    it('should clean up stale indicators when sort changes', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      // Sort by name
      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.afterRender();

      // Change sort to age
      plugin.setSortModel([{ field: 'age', direction: 'desc' }]);
      plugin.afterRender();

      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]');
      expect(nameCell?.getAttribute('data-sort')).toBeNull();
      // Unsorted sortable column should still have the idle (sortNone) indicator
      expect(nameCell?.querySelector('.sort-indicator')).not.toBeNull();

      const ageCell = grid._hostElement.querySelector('.cell[data-field="age"]');
      expect(ageCell?.getAttribute('data-sort')).toBe('desc');
    });

    it('should show idle indicator on sortable columns with no active sort', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.afterRender();

      // Sortable columns should have an idle indicator
      const nameCell = grid._hostElement.querySelector('.cell[data-field="name"]');
      const indicator = nameCell?.querySelector('.sort-indicator');
      expect(indicator).not.toBeNull();
      expect(indicator?.getAttribute('part')).toBe('sort-indicator');

      // Non-sortable column should NOT have an idle indicator
      const idCell = grid._hostElement.querySelector('.cell[data-field="id"]');
      expect(idCell?.querySelector('.sort-indicator')).toBeNull();
    });
  });

  describe('getColumnState / applyColumnState', () => {
    it('should return sort state for sorted column', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([
        { field: 'name', direction: 'asc' },
        { field: 'age', direction: 'desc' },
      ]);

      const nameState = plugin.getColumnState('name');
      expect(nameState).toEqual({ sort: { direction: 'asc', priority: 0 } });

      const ageState = plugin.getColumnState('age');
      expect(ageState).toEqual({ sort: { direction: 'desc', priority: 1 } });
    });

    it('should return undefined for unsorted column', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      expect(plugin.getColumnState('city')).toBeUndefined();
    });

    it('should apply sort state from column state', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.applyColumnState('name', { sort: { direction: 'asc', priority: 0 } } as any);
      plugin.applyColumnState('age', { sort: { direction: 'desc', priority: 1 } } as any);

      const model = plugin.getSortModel();
      expect(model).toHaveLength(2);
      expect(model[0]).toEqual({ field: 'name', direction: 'asc' });
      expect(model[1]).toEqual({ field: 'age', direction: 'desc' });
    });

    it('should remove column from sort model when state has no sort', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.applyColumnState('name', {} as any);

      expect(plugin.getSortModel()).toEqual([]);
    });

    it('should update existing column sort state', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.applyColumnState('name', { sort: { direction: 'desc', priority: 0 } } as any);

      expect(plugin.getSortModel()).toEqual([{ field: 'name', direction: 'desc' }]);
    });
  });

  describe('detach', () => {
    it('should clear sort model on detach', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);
      plugin.detach();

      expect(plugin.getSortModel()).toEqual([]);
    });
  });

  describe('core sort state clearing', () => {
    it('should clear grid._sortState when sort model is set', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      grid._sortState = { field: 'name', direction: 'asc' } as any;
      plugin.attach(grid as any);

      plugin.setSortModel([{ field: 'age', direction: 'desc' }]);

      expect(grid._sortState).toBeNull();
    });

    it('should clear grid._sortState when sort is cleared', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      grid._sortState = { field: 'name', direction: 'asc' } as any;
      plugin.attach(grid as any);

      plugin.clearSort();

      expect(grid._sortState).toBeNull();
    });
  });

  describe('handleQuery', () => {
    it('returns current sort model for sort:get-model', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);
      plugin.setSortModel([{ field: 'name', direction: 'asc' }]);

      const result = plugin.handleQuery({ type: 'sort:get-model', context: null });
      expect(result).toEqual([{ field: 'name', direction: 'asc' }]);
    });

    it('returns empty array when no sort is active', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      const result = plugin.handleQuery({ type: 'sort:get-model', context: null });
      expect(result).toEqual([]);
    });

    it('sets sort model via sort:set-model', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      const model: SortModel[] = [
        { field: 'name', direction: 'asc' },
        { field: 'age', direction: 'desc' },
      ];
      plugin.handleQuery({ type: 'sort:set-model', context: model });

      expect(plugin.getSortModel()).toEqual(model);
      expect(grid._sortState).toBeNull();
    });

    it('returns undefined for unknown query types', () => {
      const plugin = new MultiSortPlugin();
      const grid = createGridMock([], sortableColumns);
      plugin.attach(grid as any);

      const result = plugin.handleQuery({ type: 'unknown-query', context: null });
      expect(result).toBeUndefined();
    });
  });
});
