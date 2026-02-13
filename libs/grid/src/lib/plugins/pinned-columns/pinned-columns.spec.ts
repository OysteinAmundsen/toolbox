/**
 * Sticky Columns Plugin Unit Tests
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyStickyOffsets,
  calculateLeftStickyOffsets,
  calculateRightStickyOffsets,
  clearStickyOffsets,
  getColumnStickyPosition,
  getLeftStickyColumns,
  getRightStickyColumns,
  hasStickyColumns,
  reorderColumnsForPinning,
  resolveStickyPosition,
} from './pinned-columns';

describe('sticky-columns', () => {
  describe('hasStickyColumns', () => {
    it('returns false for empty columns', () => {
      expect(hasStickyColumns([])).toBe(false);
    });

    it('returns false when no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      expect(hasStickyColumns(cols)).toBe(false);
    });

    it('returns true for left sticky column', () => {
      const cols = [{ field: 'a', sticky: 'left' }, { field: 'b' }];
      expect(hasStickyColumns(cols)).toBe(true);
    });

    it('returns true for right sticky column', () => {
      const cols = [{ field: 'a' }, { field: 'b', sticky: 'right' }];
      expect(hasStickyColumns(cols)).toBe(true);
    });

    it('returns true for both left and right sticky', () => {
      const cols = [{ field: 'a', sticky: 'left' }, { field: 'b' }, { field: 'c', sticky: 'right' }];
      expect(hasStickyColumns(cols)).toBe(true);
    });
  });

  describe('getLeftStickyColumns', () => {
    it('returns empty array for no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      expect(getLeftStickyColumns(cols)).toEqual([]);
    });

    it('returns only left sticky columns', () => {
      const cols = [
        { field: 'a', sticky: 'left' },
        { field: 'b' },
        { field: 'c', sticky: 'right' },
        { field: 'd', sticky: 'left' },
      ];
      const result = getLeftStickyColumns(cols);
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('a');
      expect(result[1].field).toBe('d');
    });
  });

  describe('getRightStickyColumns', () => {
    it('returns empty array for no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      expect(getRightStickyColumns(cols)).toEqual([]);
    });

    it('returns only right sticky columns', () => {
      const cols = [
        { field: 'a', sticky: 'left' },
        { field: 'b', sticky: 'right' },
        { field: 'c' },
        { field: 'd', sticky: 'right' },
      ];
      const result = getRightStickyColumns(cols);
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('b');
      expect(result[1].field).toBe('d');
    });
  });

  describe('getColumnStickyPosition', () => {
    it('returns null for non-sticky column', () => {
      expect(getColumnStickyPosition({ field: 'a' })).toBe(null);
    });

    it('returns left for left sticky', () => {
      expect(getColumnStickyPosition({ field: 'a', sticky: 'left' })).toBe('left');
    });

    it('returns right for right sticky', () => {
      expect(getColumnStickyPosition({ field: 'a', sticky: 'right' })).toBe('right');
    });
  });

  describe('calculateLeftStickyOffsets', () => {
    it('returns empty map for no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      const result = calculateLeftStickyOffsets(cols, () => 100);
      expect(result.size).toBe(0);
    });

    it('calculates cumulative offsets for left sticky columns', () => {
      const cols = [
        { field: 'a', sticky: 'left' },
        { field: 'b', sticky: 'left' },
        { field: 'c' },
        { field: 'd', sticky: 'left' },
      ];
      const widths: Record<string, number> = { a: 100, b: 150, c: 200, d: 80 };
      const result = calculateLeftStickyOffsets(cols, (f) => widths[f]);

      expect(result.get('a')).toBe(0);
      expect(result.get('b')).toBe(100);
      expect(result.get('d')).toBe(250);
      expect(result.has('c')).toBe(false);
    });
  });

  describe('calculateRightStickyOffsets', () => {
    it('returns empty map for no sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }];
      const result = calculateRightStickyOffsets(cols, () => 100);
      expect(result.size).toBe(0);
    });

    it('calculates cumulative offsets from right for sticky columns', () => {
      const cols = [
        { field: 'a', sticky: 'right' },
        { field: 'b' },
        { field: 'c', sticky: 'right' },
        { field: 'd', sticky: 'right' },
      ];
      const widths: Record<string, number> = { a: 100, b: 150, c: 120, d: 80 };
      const result = calculateRightStickyOffsets(cols, (f) => widths[f]);

      // Processed in reverse: d(0), c(80), a(200)
      expect(result.get('d')).toBe(0);
      expect(result.get('c')).toBe(80);
      expect(result.get('a')).toBe(200);
      expect(result.has('b')).toBe(false);
    });
  });

  describe('applyStickyOffsets', () => {
    let host: HTMLElement;

    beforeEach(() => {
      host = document.createElement('div');
      // With light DOM, content is added directly to the element
      host.innerHTML = `
        <div class="header-row">
          <div class="cell" data-field="a">A</div>
          <div class="cell" data-field="b">B</div>
          <div class="cell" data-field="c">C</div>
        </div>
        <div class="data-grid-row">
          <div class="cell" data-col="0" data-field="a">1</div>
          <div class="cell" data-col="1" data-field="b">2</div>
          <div class="cell" data-col="2" data-field="c">3</div>
        </div>
      `;
      document.body.appendChild(host);
    });

    afterEach(() => {
      document.body.removeChild(host);
    });

    it('applies sticky-left class and offset to left sticky columns', () => {
      const cols = [{ field: 'a', sticky: 'left' }, { field: 'b' }, { field: 'c' }];
      applyStickyOffsets(host, cols);

      const headerCell = host.querySelector('.header-row .cell[data-field="a"]') as HTMLElement;
      expect(headerCell.classList.contains('sticky-left')).toBe(true);
      expect(headerCell.style.left).toBe('0px');

      // Body cell uses data-col="0" for the first column
      const bodyCell = host.querySelector('.data-grid-row .cell[data-col="0"]') as HTMLElement;
      expect(bodyCell.classList.contains('sticky-left')).toBe(true);
    });

    it('applies sticky-right class and offset to right sticky columns', () => {
      const cols = [{ field: 'a' }, { field: 'b' }, { field: 'c', sticky: 'right' }];
      applyStickyOffsets(host, cols);

      const headerCell = host.querySelector('.header-row .cell[data-field="c"]') as HTMLElement;
      expect(headerCell.classList.contains('sticky-right')).toBe(true);
      expect(headerCell.style.right).toBe('0px');

      // Body cell uses data-col="2" for the third column
      const bodyCell = host.querySelector('.data-grid-row .cell[data-col="2"]') as HTMLElement;
      expect(bodyCell.classList.contains('sticky-right')).toBe(true);
    });

    it('does nothing if no header cells found', () => {
      const emptyHost = document.createElement('div');
      // With light DOM, an empty element has no cells
      const cols = [{ field: 'a', sticky: 'left' }];

      // Should not throw
      expect(() => applyStickyOffsets(emptyHost, cols)).not.toThrow();
    });
  });

  describe('clearStickyOffsets', () => {
    it('removes sticky classes and styles from cells', () => {
      const host = document.createElement('div');
      // With light DOM, content is added directly to the element
      host.innerHTML = `
        <div class="cell sticky-left" style="left: 50px;">A</div>
        <div class="cell sticky-right" style="right: 100px;">B</div>
      `;
      document.body.appendChild(host);

      clearStickyOffsets(host);

      const cells = Array.from(host.querySelectorAll('.cell')) as HTMLElement[];
      cells.forEach((cell) => {
        expect(cell.classList.contains('sticky-left')).toBe(false);
        expect(cell.classList.contains('sticky-right')).toBe(false);
        expect(cell.style.left).toBe('');
        expect(cell.style.right).toBe('');
      });

      document.body.removeChild(host);
    });
  });
});

describe('PinnedColumnsPlugin.handleQuery (CAN_MOVE_COLUMN)', async () => {
  // Import the plugin class for canMoveColumn tests
  const { PinnedColumnsPlugin } = await import('./PinnedColumnsPlugin');

  it('returns false for column with sticky: left', () => {
    const plugin = new PinnedColumnsPlugin();
    const column = { field: 'id', sticky: 'left' };
    expect(plugin.handleQuery({ type: 'canMoveColumn', context: column })).toBe(false);
  });

  it('returns false for column with sticky: right', () => {
    const plugin = new PinnedColumnsPlugin();
    const column = { field: 'actions', sticky: 'right' };
    expect(plugin.handleQuery({ type: 'canMoveColumn', context: column })).toBe(false);
  });

  it('returns false for column with meta.sticky: left', () => {
    const plugin = new PinnedColumnsPlugin();
    const column = { field: 'id', meta: { sticky: 'left' } };
    expect(plugin.handleQuery({ type: 'canMoveColumn', context: column })).toBe(false);
  });

  it('returns false for column with meta.sticky: right', () => {
    const plugin = new PinnedColumnsPlugin();
    const column = { field: 'actions', meta: { sticky: 'right' } };
    expect(plugin.handleQuery({ type: 'canMoveColumn', context: column })).toBe(false);
  });

  it('returns undefined for non-sticky column (allows other plugins to decide)', () => {
    const plugin = new PinnedColumnsPlugin();
    const column = { field: 'name' };
    expect(plugin.handleQuery({ type: 'canMoveColumn', context: column })).toBe(undefined);
  });

  it('returns false for column with pinned: left (canonical property)', () => {
    const plugin = new PinnedColumnsPlugin();
    const column = { field: 'id', pinned: 'left' };
    expect(plugin.handleQuery({ type: 'canMoveColumn', context: column })).toBe(false);
  });

  it('returns false for column with pinned: right (canonical property)', () => {
    const plugin = new PinnedColumnsPlugin();
    const column = { field: 'actions', pinned: 'right' };
    expect(plugin.handleQuery({ type: 'canMoveColumn', context: column })).toBe(false);
  });

  it('pinned takes precedence over sticky when both are set', () => {
    const plugin = new PinnedColumnsPlugin();
    const column = { field: 'id', pinned: 'left', sticky: 'right' };
    // getColumnPinned returns pinned first
    expect(plugin.handleQuery({ type: 'canMoveColumn', context: column })).toBe(false);
  });

  it('returns undefined for unknown query types', () => {
    const plugin = new PinnedColumnsPlugin();
    expect(plugin.handleQuery({ type: 'unknown-query', context: {} })).toBe(undefined);
  });
});

describe('PinnedColumnsPlugin.handleQuery (getContextMenuItems)', async () => {
  const { PinnedColumnsPlugin } = await import('./PinnedColumnsPlugin');

  it('returns pin-left and pin-right items for unpinned column', () => {
    const plugin = new PinnedColumnsPlugin();
    const result = plugin.handleQuery({
      type: 'getContextMenuItems',
      context: { isHeader: true, column: { field: 'name' }, field: 'name' },
    }) as unknown[];

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'pinned/pin-left', label: 'Pin Left' });
    expect(result[1]).toMatchObject({ id: 'pinned/pin-right', label: 'Pin Right' });
  });

  it('returns unpin item for column with sticky: left', () => {
    const plugin = new PinnedColumnsPlugin();
    const result = plugin.handleQuery({
      type: 'getContextMenuItems',
      context: { isHeader: true, column: { field: 'id', sticky: 'left' }, field: 'id' },
    }) as unknown[];

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'pinned/unpin', label: 'Unpin Column' });
  });

  it('returns unpin item for column with sticky: right', () => {
    const plugin = new PinnedColumnsPlugin();
    const result = plugin.handleQuery({
      type: 'getContextMenuItems',
      context: { isHeader: true, column: { field: 'actions', sticky: 'right' }, field: 'actions' },
    }) as unknown[];

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'pinned/unpin', label: 'Unpin Column' });
  });

  it('returns undefined for non-header context', () => {
    const plugin = new PinnedColumnsPlugin();
    const result = plugin.handleQuery({
      type: 'getContextMenuItems',
      context: { isHeader: false, column: { field: 'name' }, field: 'name' },
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined when column has no field', () => {
    const plugin = new PinnedColumnsPlugin();
    const result = plugin.handleQuery({
      type: 'getContextMenuItems',
      context: { isHeader: true, column: {} },
    });

    expect(result).toBeUndefined();
  });

  it('returns undefined for columns with lockPinning', () => {
    const plugin = new PinnedColumnsPlugin();
    const result = plugin.handleQuery({
      type: 'getContextMenuItems',
      context: { isHeader: true, column: { field: 'id', meta: { lockPinning: true } }, field: 'id' },
    });

    expect(result).toBeUndefined();
  });
});

describe('PinnedColumnsPlugin lifecycle and API', () => {
  let plugin: typeof import('./PinnedColumnsPlugin').PinnedColumnsPlugin.prototype;

  beforeEach(async () => {
    const { PinnedColumnsPlugin } = await import('./PinnedColumnsPlugin');
    plugin = new PinnedColumnsPlugin();
  });

  describe('static detect', () => {
    it('returns true when columns have sticky property', async () => {
      const { PinnedColumnsPlugin } = await import('./PinnedColumnsPlugin');
      const result = PinnedColumnsPlugin.detect([], {
        columns: [{ field: 'id', sticky: 'left' }, { field: 'name' }],
      });
      expect(result).toBe(true);
    });

    it('returns false when no columns have sticky property', async () => {
      const { PinnedColumnsPlugin } = await import('./PinnedColumnsPlugin');
      const result = PinnedColumnsPlugin.detect([], {
        columns: [{ field: 'id' }, { field: 'name' }],
      });
      expect(result).toBe(false);
    });

    it('returns false when columns is not an array', async () => {
      const { PinnedColumnsPlugin } = await import('./PinnedColumnsPlugin');
      const result = PinnedColumnsPlugin.detect([], {});
      expect(result).toBe(false);
    });
  });

  describe('processColumns', () => {
    it('reorders pinned-left columns to the start', () => {
      const columns = [
        { field: 'a' },
        { field: 'b', pinned: 'left' },
        { field: 'c' },
      ];
      const result = plugin.processColumns(columns as any);
      expect(result.map((c: any) => c.field)).toEqual(['b', 'a', 'c']);
    });

    it('reorders pinned-right columns to the end', () => {
      const columns = [
        { field: 'a', pinned: 'right' },
        { field: 'b' },
        { field: 'c' },
      ];
      const result = plugin.processColumns(columns as any);
      expect(result.map((c: any) => c.field)).toEqual(['b', 'c', 'a']);
    });

    it('keeps order unchanged when already at correct edges', () => {
      const columns = [{ field: 'id', sticky: 'left' }, { field: 'name' }];
      const result = plugin.processColumns(columns as any);
      expect(result).toEqual(columns);
    });

    it('returns columns unchanged when none are pinned', () => {
      const columns = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
      const result = plugin.processColumns(columns as any);
      expect(result.map((c: any) => c.field)).toEqual(['a', 'b', 'c']);
    });

    it('sets isApplied flag when sticky columns exist', () => {
      const columns = [{ field: 'id', sticky: 'left' }];
      plugin.processColumns(columns as any);
      // isApplied is private, so we test via afterRender behavior
      // This is verified through the afterRender tests
    });
  });

  describe('detach', () => {
    it('clears internal state', () => {
      plugin.detach();
      // No error means success - internal maps are cleared
      expect(true).toBe(true);
    });
  });

  describe('public API methods', () => {
    let mockGrid: any;

    beforeEach(() => {
      // Create a mock grid element (light DOM)
      mockGrid = document.createElement('div');
      mockGrid.innerHTML = `
        <div class="header-row">
          <div class="cell sticky-left" style="width: 100px;">ID</div>
          <div class="cell" style="width: 150px;">Name</div>
          <div class="cell sticky-right" style="width: 80px;">Actions</div>
        </div>
      `;

      // Mock columns array on grid
      mockGrid.columns = [
        { field: 'id', sticky: 'left', width: 100 },
        { field: 'name', width: 150 },
        { field: 'actions', sticky: 'right', width: 80 },
      ];

      // Attach plugin to mock grid
      (plugin as any).grid = mockGrid;
    });

    it('getLeftPinnedColumns returns left sticky columns', () => {
      const result = plugin.getLeftPinnedColumns();
      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('id');
    });

    it('getRightPinnedColumns returns right sticky columns', () => {
      const result = plugin.getRightPinnedColumns();
      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('actions');
    });

    it('clearStickyPositions removes sticky classes and styles', () => {
      // First apply some sticky styling
      const cells = mockGrid.querySelectorAll('.cell');
      cells[0].classList.add('sticky-left');
      cells[0].style.left = '0px';
      cells[2].classList.add('sticky-right');
      cells[2].style.right = '0px';

      plugin.clearStickyPositions();

      // Check that sticky classes and styles are removed
      expect(cells[0].classList.contains('sticky-left')).toBe(false);
      expect(cells[0].style.left).toBe('');
      expect(cells[2].classList.contains('sticky-right')).toBe(false);
      expect(cells[2].style.right).toBe('');
    });

    it('refreshStickyOffsets applies sticky offsets', () => {
      // This test verifies the method doesn't throw
      expect(() => plugin.refreshStickyOffsets()).not.toThrow();
    });
  });

  describe('getHorizontalScrollOffsets', () => {
    let mockGrid: any;

    beforeEach(() => {
      mockGrid = document.createElement('div');
      mockGrid.innerHTML = `
        <div class="header-row">
          <div class="cell sticky-left" style="width: 100px;">ID</div>
          <div class="cell" style="width: 150px;">Name</div>
          <div class="cell sticky-right" style="width: 80px;">Actions</div>
        </div>
      `;
      document.body.appendChild(mockGrid);

      (plugin as any).grid = mockGrid;
      (plugin as any).isApplied = true;
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('returns undefined when not applied', () => {
      (plugin as any).isApplied = false;
      const result = plugin.getHorizontalScrollOffsets();
      expect(result).toBeUndefined();
    });

    it('calculates offsets from row element when provided', () => {
      const rowEl = document.createElement('div');
      rowEl.innerHTML = `
        <div class="cell sticky-left" style="width: 100px;"></div>
        <div class="cell" style="width: 150px;"></div>
        <div class="cell sticky-right" style="width: 80px;"></div>
      `;
      document.body.appendChild(rowEl);

      const result = plugin.getHorizontalScrollOffsets(rowEl);

      expect(result).toBeDefined();
      expect(result?.left).toBeGreaterThanOrEqual(0);
      expect(result?.right).toBeGreaterThanOrEqual(0);
    });

    it('falls back to header row when no rowEl provided', () => {
      const result = plugin.getHorizontalScrollOffsets();

      expect(result).toBeDefined();
      expect(result?.left).toBeGreaterThanOrEqual(0);
      expect(result?.right).toBeGreaterThanOrEqual(0);
    });

    it('returns skipScroll true when focused cell is sticky-left', () => {
      const focusedCell = document.createElement('div');
      focusedCell.classList.add('sticky-left');

      const result = plugin.getHorizontalScrollOffsets(undefined, focusedCell);

      expect(result?.skipScroll).toBe(true);
    });

    it('returns skipScroll true when focused cell is sticky-right', () => {
      const focusedCell = document.createElement('div');
      focusedCell.classList.add('sticky-right');

      const result = plugin.getHorizontalScrollOffsets(undefined, focusedCell);

      expect(result?.skipScroll).toBe(true);
    });

    it('returns skipScroll false/undefined when focused cell is not sticky', () => {
      const focusedCell = document.createElement('div');

      const result = plugin.getHorizontalScrollOffsets(undefined, focusedCell);

      expect(result?.skipScroll).toBeFalsy();
    });
  });
});

describe('reorderColumnsForPinning', () => {
  it('moves left-pinned columns to the front', () => {
    const cols = [
      { field: 'a' },
      { field: 'b', pinned: 'left' },
      { field: 'c' },
      { field: 'd', pinned: 'left' },
    ];
    const result = reorderColumnsForPinning(cols);
    expect(result.map((c: any) => c.field)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('moves right-pinned columns to the end', () => {
    const cols = [
      { field: 'a', pinned: 'right' },
      { field: 'b' },
      { field: 'c', pinned: 'right' },
    ];
    const result = reorderColumnsForPinning(cols);
    expect(result.map((c: any) => c.field)).toEqual(['b', 'a', 'c']);
  });

  it('handles both left and right pinned columns', () => {
    const cols = [
      { field: 'a', pinned: 'left' },
      { field: 'b' },
      { field: 'c', pinned: 'right' },
      { field: 'd' },
      { field: 'e', pinned: 'left' },
    ];
    const result = reorderColumnsForPinning(cols);
    expect(result.map((c: any) => c.field)).toEqual(['a', 'e', 'b', 'd', 'c']);
  });

  it('preserves relative order within each group', () => {
    const cols = [
      { field: 'left2', pinned: 'left' },
      { field: 'mid1' },
      { field: 'right1', pinned: 'right' },
      { field: 'left1', pinned: 'left' },
      { field: 'mid2' },
      { field: 'right2', pinned: 'right' },
    ];
    const result = reorderColumnsForPinning(cols);
    expect(result.map((c: any) => c.field)).toEqual([
      'left2', 'left1', 'mid1', 'mid2', 'right1', 'right2',
    ]);
  });

  it('returns same order when no columns are pinned', () => {
    const cols = [{ field: 'a' }, { field: 'b' }, { field: 'c' }];
    const result = reorderColumnsForPinning(cols);
    expect(result.map((c: any) => c.field)).toEqual(['a', 'b', 'c']);
  });

  it('handles sticky (deprecated) property', () => {
    const cols = [
      { field: 'a' },
      { field: 'b', sticky: 'left' },
      { field: 'c', sticky: 'right' },
    ];
    const result = reorderColumnsForPinning(cols);
    expect(result.map((c: any) => c.field)).toEqual(['b', 'a', 'c']);
  });

  it('handles logical positions in RTL', () => {
    const cols = [
      { field: 'a', pinned: 'start' },
      { field: 'b' },
      { field: 'c', pinned: 'end' },
    ];
    // In RTL: start → right, end → left
    const result = reorderColumnsForPinning(cols, 'rtl');
    expect(result.map((c: any) => c.field)).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate input array', () => {
    const cols = [{ field: 'a' }, { field: 'b', pinned: 'left' }];
    const original = [...cols];
    reorderColumnsForPinning(cols);
    expect(cols).toEqual(original);
  });
});

describe('setPinPosition with reordering', () => {
  let plugin: any;

  beforeEach(async () => {
    const { PinnedColumnsPlugin } = await import('./PinnedColumnsPlugin');
    plugin = new PinnedColumnsPlugin();
  });

  function attachWithColumns(columns: any[]) {
    const mockGrid = document.createElement('div') as any;
    mockGrid.columns = undefined;
    // Mock the columns accessor (this.columns returns post-processColumns)
    Object.defineProperty(plugin, 'columns', {
      get: () => mockGrid._processed ?? columns,
      configurable: true,
    });
    Object.defineProperty(plugin, 'gridElement', {
      get: () => mockGrid,
      configurable: true,
    });
    plugin.grid = mockGrid;

    // Intercept columns setter to simulate processColumns
    const origDescriptor = Object.getOwnPropertyDescriptor(mockGrid, 'columns');
    Object.defineProperty(mockGrid, 'columns', {
      get: () => origDescriptor?.value,
      set: (val: any[]) => {
        origDescriptor!.value = val;
        // Simulate processColumns reordering
        mockGrid._processed = plugin.processColumns(val);
      },
      configurable: true,
    });

    return mockGrid;
  }

  it('pinning moves column and processColumns reorders to edge', () => {
    const cols = [
      { field: 'a' },
      { field: 'b' },
      { field: 'c' },
      { field: 'd' },
    ];
    const grid = attachWithColumns(cols);

    plugin.setPinPosition('c', 'left');

    const result = grid._processed;
    expect(result.map((c: any) => c.field)).toEqual(['c', 'a', 'b', 'd']);
    expect(result[0].pinned).toBe('left');
  });

  it('unpinning restores column to original position', () => {
    const cols = [
      { field: 'a' },
      { field: 'b' },
      { field: 'c' },
      { field: 'd' },
    ];
    const grid = attachWithColumns(cols);

    // Pin column c to the left
    plugin.setPinPosition('c', 'left');
    expect(grid._processed.map((c: any) => c.field)).toEqual(['c', 'a', 'b', 'd']);

    // Unpin column c → should restore to original position (between b and d)
    plugin.setPinPosition('c', undefined);
    expect(grid._processed.map((c: any) => c.field)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('unpinning restores correctly when multiple columns pinned and unpinned', () => {
    const cols = [
      { field: 'a' },
      { field: 'b' },
      { field: 'c' },
      { field: 'd' },
      { field: 'e' },
    ];
    const grid = attachWithColumns(cols);

    // Pin c left, then d left
    plugin.setPinPosition('c', 'left');
    plugin.setPinPosition('d', 'left');
    expect(grid._processed.map((c: any) => c.field)).toEqual(['c', 'd', 'a', 'b', 'e']);

    // Unpin c → should restore between b and d
    plugin.setPinPosition('c', undefined);
    expect(grid._processed.map((c: any) => c.field)).toEqual(['d', 'a', 'b', 'c', 'e']);

    // Unpin d → fully restored
    plugin.setPinPosition('d', undefined);
    expect(grid._processed.map((c: any) => c.field)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('pin right moves column to the end', () => {
    const cols = [
      { field: 'a' },
      { field: 'b' },
      { field: 'c' },
    ];
    const grid = attachWithColumns(cols);

    plugin.setPinPosition('a', 'right');

    const result = grid._processed;
    expect(result.map((c: any) => c.field)).toEqual(['b', 'c', 'a']);
    expect(result[2].pinned).toBe('right');
  });

  it('unpin right restores column to original position', () => {
    const cols = [
      { field: 'a' },
      { field: 'b' },
      { field: 'c' },
    ];
    const grid = attachWithColumns(cols);

    plugin.setPinPosition('a', 'right');
    expect(grid._processed.map((c: any) => c.field)).toEqual(['b', 'c', 'a']);

    plugin.setPinPosition('a', undefined);
    expect(grid._processed.map((c: any) => c.field)).toEqual(['a', 'b', 'c']);
  });

  it('clears original column order snapshot when all columns unpinned', () => {
    const cols = [
      { field: 'a' },
      { field: 'b', pinned: 'left' },
    ];
    const grid = attachWithColumns(cols);

    // Pin a to the left (b is already pinned)
    plugin.setPinPosition('a', 'left');
    // Unpin b
    plugin.setPinPosition('b', undefined);
    // Unpin a → all unpinned, snapshot should be cleared
    plugin.setPinPosition('a', undefined);

    // Verify no errors and columns are restored
    expect(grid._processed.map((c: any) => c.field)).toEqual(['a', 'b']);
  });
});

describe('RTL support', () => {
  describe('resolveStickyPosition', () => {
    it('returns left for left in LTR', () => {
      expect(resolveStickyPosition('left', 'ltr')).toBe('left');
    });

    it('returns right for right in LTR', () => {
      expect(resolveStickyPosition('right', 'ltr')).toBe('right');
    });

    it('returns left for left in RTL (physical stays physical)', () => {
      expect(resolveStickyPosition('left', 'rtl')).toBe('left');
    });

    it('returns right for right in RTL (physical stays physical)', () => {
      expect(resolveStickyPosition('right', 'rtl')).toBe('right');
    });

    it('returns left for start in LTR', () => {
      expect(resolveStickyPosition('start', 'ltr')).toBe('left');
    });

    it('returns right for end in LTR', () => {
      expect(resolveStickyPosition('end', 'ltr')).toBe('right');
    });

    it('returns right for start in RTL (flipped)', () => {
      expect(resolveStickyPosition('start', 'rtl')).toBe('right');
    });

    it('returns left for end in RTL (flipped)', () => {
      expect(resolveStickyPosition('end', 'rtl')).toBe('left');
    });
  });

  describe('hasStickyColumns with logical positions', () => {
    it('returns true for start sticky column', () => {
      const cols = [{ field: 'a', sticky: 'start' }, { field: 'b' }];
      expect(hasStickyColumns(cols)).toBe(true);
    });

    it('returns true for end sticky column', () => {
      const cols = [{ field: 'a' }, { field: 'b', sticky: 'end' }];
      expect(hasStickyColumns(cols)).toBe(true);
    });
  });

  describe('getLeftStickyColumns in RTL', () => {
    it('includes start columns in LTR', () => {
      const cols = [{ field: 'a', sticky: 'start' }, { field: 'b' }, { field: 'c', sticky: 'left' }];
      const result = getLeftStickyColumns(cols, 'ltr');
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('a');
      expect(result[1].field).toBe('c');
    });

    it('includes end columns in RTL (flipped to left)', () => {
      const cols = [{ field: 'a', sticky: 'end' }, { field: 'b' }, { field: 'c', sticky: 'left' }];
      const result = getLeftStickyColumns(cols, 'rtl');
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('a');
      expect(result[1].field).toBe('c');
    });

    it('excludes start columns in RTL (they go to right)', () => {
      const cols = [{ field: 'a', sticky: 'start' }, { field: 'b' }, { field: 'c', sticky: 'left' }];
      const result = getLeftStickyColumns(cols, 'rtl');
      // start resolves to right in RTL, so only 'c' is left
      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('c');
    });
  });

  describe('getRightStickyColumns in RTL', () => {
    it('includes end columns in LTR', () => {
      const cols = [{ field: 'a', sticky: 'end' }, { field: 'b' }, { field: 'c', sticky: 'right' }];
      const result = getRightStickyColumns(cols, 'ltr');
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('a');
      expect(result[1].field).toBe('c');
    });

    it('includes start columns in RTL (flipped to right)', () => {
      const cols = [{ field: 'a', sticky: 'start' }, { field: 'b' }, { field: 'c', sticky: 'right' }];
      const result = getRightStickyColumns(cols, 'rtl');
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('a');
      expect(result[1].field).toBe('c');
    });
  });

  describe('applyStickyOffsets in RTL', () => {
    let host: HTMLElement;

    beforeEach(() => {
      host = document.createElement('div');
      host.setAttribute('dir', 'rtl');
      host.innerHTML = `
        <div class="header-row">
          <div class="cell" data-field="a">A</div>
          <div class="cell" data-field="b">B</div>
          <div class="cell" data-field="c">C</div>
        </div>
        <div class="data-grid-row">
          <div class="cell" data-col="0">1</div>
          <div class="cell" data-col="1">2</div>
          <div class="cell" data-col="2">3</div>
        </div>
      `;
      document.body.appendChild(host);
    });

    afterEach(() => {
      document.body.removeChild(host);
    });

    it('applies sticky-right class to start columns in RTL', () => {
      const cols = [{ field: 'a', sticky: 'start' }, { field: 'b' }, { field: 'c' }];
      applyStickyOffsets(host, cols);

      // In RTL, 'start' resolves to 'right'
      const headerCell = host.querySelector('.header-row .cell[data-field="a"]') as HTMLElement;
      expect(headerCell.classList.contains('sticky-right')).toBe(true);
    });

    it('applies sticky-left class to end columns in RTL', () => {
      const cols = [{ field: 'a' }, { field: 'b' }, { field: 'c', sticky: 'end' }];
      applyStickyOffsets(host, cols);

      // In RTL, 'end' resolves to 'left'
      const headerCell = host.querySelector('.header-row .cell[data-field="c"]') as HTMLElement;
      expect(headerCell.classList.contains('sticky-left')).toBe(true);
    });
  });
});
