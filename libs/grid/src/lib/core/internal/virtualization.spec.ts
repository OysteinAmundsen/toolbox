/**
 * Unit tests for virtualization.ts
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateAverageHeight,
  computeScrollMapping,
  computeVirtualWindow,
  createHeightCache,
  fromVirtualScrollTop,
  getCachedHeight,
  getRowIndexAtOffset,
  getTotalHeight,
  MAX_ELEMENT_HEIGHT_PX,
  rebuildPositionCache,
  setCachedHeight,
  shouldBypassVirtualization,
  toVirtualScrollTop,
  updateRowHeight,
  type HeightCache,
  type RowPosition,
} from './virtualization';

// #region HeightCache Tests
describe('HeightCache', () => {
  let cache: HeightCache;

  beforeEach(() => {
    cache = createHeightCache();
  });

  describe('createHeightCache', () => {
    it('creates an empty cache', () => {
      expect(cache.byKey).toBeInstanceOf(Map);
      expect(cache.byKey.size).toBe(0);
    });
  });

  describe('getCachedHeight', () => {
    it('returns undefined for unknown row', () => {
      const row = { id: 1, name: 'Alice' };
      expect(getCachedHeight(cache, row)).toBeUndefined();
    });

    it('returns height from byKey when row has rowId property', () => {
      const row = { name: 'Alice', rowId: 'row-1' };
      cache.byKey.set('id:row-1', 50);
      expect(getCachedHeight(cache, row)).toBe(50);
    });

    it('returns height from byKey when row has __rowCacheKey (synthetic rows)', () => {
      const row = { __rowCacheKey: 'group-header-1', name: 'Group Header' };
      cache.byKey.set('group-header-1', 40);
      expect(getCachedHeight(cache, row)).toBe(40);
    });

    it('returns height from byRef when row has no key properties', () => {
      const row = { id: 1, name: 'Alice' };
      cache.byRef.set(row, 60);
      expect(getCachedHeight(cache, row)).toBe(60);
    });

    it('prefers __rowCacheKey over rowId', () => {
      const row = { rowId: 'row-1', __rowCacheKey: 'synthetic-1' };
      cache.byKey.set('id:row-1', 50); // rowId keys are prefixed with 'id:'
      cache.byKey.set('synthetic-1', 70);
      expect(getCachedHeight(cache, row)).toBe(70);
    });
  });

  describe('setCachedHeight', () => {
    it('stores by __rowCacheKey when present', () => {
      const row = { __rowCacheKey: 'group-1', name: 'Group' };
      setCachedHeight(cache, row, 45);
      expect(cache.byKey.get('group-1')).toBe(45);
    });

    it('stores by rowId when present', () => {
      const row = { rowId: 'user-1', name: 'Bob' };
      setCachedHeight(cache, row, 55);
      expect(cache.byKey.get('id:user-1')).toBe(55);
    });

    it('stores by object reference when no key properties', () => {
      const row = { id: 1, name: 'Charlie' };
      setCachedHeight(cache, row, 65);
      expect(cache.byRef.get(row)).toBe(65);
    });

    it('overwrites existing cached height', () => {
      const row = { rowId: 'row-1', name: 'Dave' };
      setCachedHeight(cache, row, 50);
      setCachedHeight(cache, row, 75);
      expect(cache.byKey.get('id:row-1')).toBe(75);
    });
  });
});
// #endregion

// #region PositionCache Tests
describe('PositionCache', () => {
  describe('rebuildPositionCache', () => {
    it('rebuilds preserving heights from heightCache', () => {
      const rows = [{ rowId: 'r1' }, { rowId: 'r2' }, { rowId: 'r3' }];
      const heightCache = createHeightCache();
      heightCache.byKey.set('id:r1', 40);
      heightCache.byKey.set('id:r3', 60);

      const positions = rebuildPositionCache(rows, heightCache, 28, {
        defaultHeight: 28,
      });

      expect(positions[0]).toEqual({ offset: 0, height: 40, measured: true });
      expect(positions[1]).toEqual({ offset: 40, height: 28, measured: false });
      expect(positions[2]).toEqual({ offset: 68, height: 60, measured: true });
    });

    it('uses plugin height when provided', () => {
      const rows = [{ id: 1 }, { id: 2 }];
      const heightCache = createHeightCache();

      const positions = rebuildPositionCache(rows, heightCache, 28, { defaultHeight: 28 }, (_row, index) =>
        index === 0 ? 50 : undefined,
      );

      expect(positions[0].height).toBe(50);
      expect(positions[0].measured).toBe(true);
      expect(positions[1].height).toBe(28);
      expect(positions[1].measured).toBe(false);
    });
  });

  describe('updateRowHeight', () => {
    it('updates height at specific index', () => {
      const positions: RowPosition[] = [
        { offset: 0, height: 28, measured: false },
        { offset: 28, height: 28, measured: false },
        { offset: 56, height: 28, measured: false },
      ];

      updateRowHeight(positions, 1, 50);

      expect(positions[1].height).toBe(50);
      expect(positions[1].measured).toBe(true);
    });

    it('recalculates subsequent offsets', () => {
      const positions: RowPosition[] = [
        { offset: 0, height: 28, measured: false },
        { offset: 28, height: 28, measured: false },
        { offset: 56, height: 28, measured: false },
      ];

      updateRowHeight(positions, 1, 50); // +22 pixels

      expect(positions[0].offset).toBe(0);
      expect(positions[1].offset).toBe(28);
      expect(positions[2].offset).toBe(78); // 28 + 50
    });

    it('handles first row update', () => {
      const positions: RowPosition[] = [
        { offset: 0, height: 28, measured: false },
        { offset: 28, height: 28, measured: false },
      ];

      updateRowHeight(positions, 0, 40);

      expect(positions[0]).toEqual({ offset: 0, height: 40, measured: true });
      expect(positions[1]).toEqual({ offset: 40, height: 28, measured: false });
    });

    it('handles last row update without affecting any offsets', () => {
      const positions: RowPosition[] = [
        { offset: 0, height: 28, measured: false },
        { offset: 28, height: 28, measured: false },
      ];

      updateRowHeight(positions, 1, 60);

      expect(positions[0].offset).toBe(0);
      expect(positions[1].offset).toBe(28);
      expect(positions[1].height).toBe(60);
    });

    it('does nothing for out-of-bounds index', () => {
      const positions: RowPosition[] = [{ offset: 0, height: 28, measured: false }];

      updateRowHeight(positions, 5, 50);
      updateRowHeight(positions, -1, 50);

      expect(positions[0]).toEqual({ offset: 0, height: 28, measured: false });
    });
  });

  describe('getTotalHeight', () => {
    it('returns 0 for empty cache', () => {
      expect(getTotalHeight([])).toBe(0);
    });

    it('calculates total from last row offset + height', () => {
      const positions: RowPosition[] = [
        { offset: 0, height: 30, measured: true },
        { offset: 30, height: 40, measured: true },
        { offset: 70, height: 50, measured: true },
      ];

      expect(getTotalHeight(positions)).toBe(120); // 70 + 50
    });
  });

  describe('getRowIndexAtOffset', () => {
    const positions: RowPosition[] = [
      { offset: 0, height: 30, measured: true },
      { offset: 30, height: 40, measured: true },
      { offset: 70, height: 50, measured: true },
      { offset: 120, height: 30, measured: true },
    ];

    it('returns -1 for empty cache', () => {
      expect(getRowIndexAtOffset([], 50)).toBe(-1);
    });

    it('returns 0 for offset 0', () => {
      expect(getRowIndexAtOffset(positions, 0)).toBe(0);
    });

    it('returns first row for negative offset', () => {
      expect(getRowIndexAtOffset(positions, -10)).toBe(0);
    });

    it('finds correct row via binary search', () => {
      expect(getRowIndexAtOffset(positions, 15)).toBe(0); // Within first row
      expect(getRowIndexAtOffset(positions, 30)).toBe(1); // Start of second row
      expect(getRowIndexAtOffset(positions, 50)).toBe(1); // Within second row
      expect(getRowIndexAtOffset(positions, 70)).toBe(2); // Start of third row
      expect(getRowIndexAtOffset(positions, 100)).toBe(2); // Within third row
      expect(getRowIndexAtOffset(positions, 120)).toBe(3); // Start of fourth row
    });

    it('returns last row for offset beyond total height', () => {
      expect(getRowIndexAtOffset(positions, 200)).toBe(3);
      expect(getRowIndexAtOffset(positions, 1000)).toBe(3);
    });
  });
});
// #endregion

// #region Average Height Tests
describe('calculateAverageHeight', () => {
  it('returns default height for empty cache', () => {
    expect(calculateAverageHeight([], 28)).toBe(28);
  });

  it('returns default when no measured rows', () => {
    const positions: RowPosition[] = [
      { offset: 0, height: 28, measured: false },
      { offset: 28, height: 28, measured: false },
    ];
    expect(calculateAverageHeight(positions, 28)).toBe(28);
  });

  it('calculates average of measured heights only', () => {
    const positions: RowPosition[] = [
      { offset: 0, height: 30, measured: true },
      { offset: 30, height: 28, measured: false },
      { offset: 58, height: 50, measured: true },
    ];
    // Average of 30 + 50 = 80 / 2 = 40
    expect(calculateAverageHeight(positions, 28)).toBe(40);
  });
});
// #endregion
// #region measureRenderedRowHeights Tests
describe('measureRenderedRowHeights', () => {
  // Import the function
  let measureRenderedRowHeights: typeof import('./virtualization').measureRenderedRowHeights;

  beforeEach(async () => {
    const module = await import('./virtualization');
    measureRenderedRowHeights = module.measureRenderedRowHeights;
  });

  function createMockRowElements(heights: number[]): NodeListOf<Element> {
    const elements: Element[] = heights.map((height, index) => {
      const el = document.createElement('div');
      el.dataset.rowIndex = String(index);
      Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
      return el;
    });
    return elements as unknown as NodeListOf<Element>;
  }

  it('measures row heights from DOM elements', () => {
    const positionCache: RowPosition[] = [
      { offset: 0, height: 28, measured: false },
      { offset: 28, height: 28, measured: false },
    ];
    const heightCache = createHeightCache();
    const rows = [{ id: 1 }, { id: 2 }];

    const result = measureRenderedRowHeights(
      {
        positionCache,
        heightCache,
        rows,
        defaultHeight: 28,
        start: 0,
        end: 2,
      },
      createMockRowElements([40, 50]),
    );

    expect(result.hasChanges).toBe(true);
    expect(positionCache[0].height).toBe(40);
    expect(positionCache[0].measured).toBe(true);
    expect(positionCache[1].height).toBe(50);
    expect(positionCache[1].measured).toBe(true);
  });

  it('skips rows outside the render window', () => {
    const positionCache: RowPosition[] = [
      { offset: 0, height: 28, measured: false },
      { offset: 28, height: 28, measured: false },
      { offset: 56, height: 28, measured: false },
    ];
    const heightCache = createHeightCache();
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];

    // Only row 1 is in the window (start=1, end=2)
    measureRenderedRowHeights(
      {
        positionCache,
        heightCache,
        rows,
        defaultHeight: 28,
        start: 1,
        end: 2,
      },
      createMockRowElements([40, 50, 60]),
    );

    // Row 0 and 2 should be unchanged
    expect(positionCache[0].height).toBe(28);
    expect(positionCache[0].measured).toBe(false);
    expect(positionCache[1].height).toBe(50);
    expect(positionCache[1].measured).toBe(true);
    expect(positionCache[2].height).toBe(28);
    expect(positionCache[2].measured).toBe(false);
  });

  it('uses plugin height when provided', () => {
    const positionCache: RowPosition[] = [{ offset: 0, height: 28, measured: false }];
    const heightCache = createHeightCache();
    const rows = [{ id: 1, expanded: true }];

    const result = measureRenderedRowHeights(
      {
        positionCache,
        heightCache,
        rows,
        defaultHeight: 28,
        start: 0,
        end: 1,
        getPluginHeight: () => 100, // Plugin says row is 100px
      },
      createMockRowElements([40]), // DOM says 40px
    );

    expect(result.hasChanges).toBe(true);
    expect(positionCache[0].height).toBe(100); // Uses plugin height, not DOM
    expect(positionCache[0].measured).toBe(true);
  });

  it('returns hasChanges=false when heights match', () => {
    const positionCache: RowPosition[] = [{ offset: 0, height: 40, measured: true }];
    const heightCache = createHeightCache();
    const rows = [{ id: 1 }];

    const result = measureRenderedRowHeights(
      {
        positionCache,
        heightCache,
        rows,
        defaultHeight: 28,
        start: 0,
        end: 1,
      },
      createMockRowElements([40]), // Same height as cached
    );

    expect(result.hasChanges).toBe(false);
  });
});
// #endregion

// #region computeAverageExcludingPluginRows Tests
describe('computeAverageExcludingPluginRows', () => {
  let computeAverageExcludingPluginRows: typeof import('./virtualization').computeAverageExcludingPluginRows;

  beforeEach(async () => {
    const module = await import('./virtualization');
    computeAverageExcludingPluginRows = module.computeAverageExcludingPluginRows;
  });

  it('computes average from measured rows', () => {
    const cache: RowPosition[] = [
      { offset: 0, height: 40, measured: true },
      { offset: 40, height: 50, measured: true },
      { offset: 90, height: 28, measured: false },
    ];
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];

    const result = computeAverageExcludingPluginRows(cache, rows, 28);

    expect(result.measuredCount).toBe(2);
    expect(result.averageHeight).toBe(45); // (40 + 50) / 2
  });

  it('excludes plugin-managed rows from average', () => {
    const cache: RowPosition[] = [
      { offset: 0, height: 100, measured: true }, // Plugin-managed (expanded)
      { offset: 100, height: 30, measured: true }, // Regular row
      { offset: 130, height: 40, measured: true }, // Regular row
    ];
    const rows = [{ id: 1, expanded: true }, { id: 2 }, { id: 3 }];

    const result = computeAverageExcludingPluginRows(cache, rows, 28, (row) =>
      (row as { expanded?: boolean }).expanded ? 100 : undefined,
    );

    expect(result.measuredCount).toBe(2); // Only rows 2 and 3
    expect(result.averageHeight).toBe(35); // (30 + 40) / 2, excludes 100
  });

  it('returns default height when no measurements', () => {
    const cache: RowPosition[] = [
      { offset: 0, height: 28, measured: false },
      { offset: 28, height: 28, measured: false },
    ];
    const rows = [{ id: 1 }, { id: 2 }];

    const result = computeAverageExcludingPluginRows(cache, rows, 28);

    expect(result.measuredCount).toBe(0);
    expect(result.averageHeight).toBe(28);
  });
});
// #endregion

// #region Fixed-Height Virtual Window Tests
describe('computeVirtualWindow', () => {
  it('computes window at top of grid', () => {
    const result = computeVirtualWindow({
      totalRows: 1000,
      viewportHeight: 300,
      scrollTop: 0,
      rowHeight: 32,
      overscan: 5,
    });

    expect(result.start).toBe(0);
    // 300/32 ≈ 9.375 → ceil = 10, plus 2*5 overscan = 20
    expect(result.end).toBe(20);
    expect(result.offsetY).toBe(0);
    expect(result.totalHeight).toBe(32000);
  });

  it('computes window when scrolled down', () => {
    const result = computeVirtualWindow({
      totalRows: 1000,
      viewportHeight: 300,
      scrollTop: 1600, // 50 rows down
      rowHeight: 32,
      overscan: 5,
    });

    // 1600/32 = 50, minus 5 overscan = 45
    expect(result.start).toBe(45);
    // 45 + 20 visible = 65
    expect(result.end).toBe(65);
    expect(result.offsetY).toBe(45 * 32);
  });

  it('clamps start to 0 when scroll near top', () => {
    const result = computeVirtualWindow({
      totalRows: 1000,
      viewportHeight: 300,
      scrollTop: 64, // 2 rows
      rowHeight: 32,
      overscan: 5,
    });

    expect(result.start).toBe(0); // Can't go negative
    expect(result.offsetY).toBe(0);
  });

  it('clamps end to totalRows', () => {
    const result = computeVirtualWindow({
      totalRows: 100,
      viewportHeight: 300,
      scrollTop: 3000, // Near end
      rowHeight: 32,
      overscan: 5,
    });

    expect(result.end).toBeLessThanOrEqual(100);
  });

  it('handles small datasets', () => {
    const result = computeVirtualWindow({
      totalRows: 5,
      viewportHeight: 300,
      scrollTop: 0,
      rowHeight: 32,
      overscan: 5,
    });

    expect(result.start).toBe(0);
    expect(result.end).toBe(5);
    expect(result.totalHeight).toBe(160);
  });

  it('handles empty dataset', () => {
    const result = computeVirtualWindow({
      totalRows: 0,
      viewportHeight: 300,
      scrollTop: 0,
      rowHeight: 32,
      overscan: 5,
    });

    expect(result.start).toBe(0);
    expect(result.end).toBe(0);
    expect(result.totalHeight).toBe(0);
  });
});

describe('shouldBypassVirtualization', () => {
  it('returns true when totalRows <= threshold', () => {
    expect(shouldBypassVirtualization(10, 24)).toBe(true);
    expect(shouldBypassVirtualization(24, 24)).toBe(true);
  });

  it('returns false when totalRows > threshold', () => {
    expect(shouldBypassVirtualization(25, 24)).toBe(false);
    expect(shouldBypassVirtualization(100, 24)).toBe(false);
  });

  it('works with different threshold values', () => {
    expect(shouldBypassVirtualization(50, 50)).toBe(true);
    expect(shouldBypassVirtualization(51, 50)).toBe(false);
  });
});

// #region Scroll Mapping Tests (Issue #326)

describe('computeScrollMapping', () => {
  it('returns identity mapping for sub-cap content', () => {
    const m = computeScrollMapping(100_000, 600);
    expect(m.capped).toBe(false);
    expect(m.spacerHeight).toBe(100_000);
    expect(m.rawContentHeight).toBe(100_000);
  });

  it('caps spacer when raw content exceeds MAX_ELEMENT_HEIGHT_PX', () => {
    // 10M rows × 34px = 340M px (well above the cap)
    const raw = 10_000_000 * 34;
    const m = computeScrollMapping(raw, 600);
    expect(m.capped).toBe(true);
    expect(m.spacerHeight).toBe(MAX_ELEMENT_HEIGHT_PX);
    expect(m.rawContentHeight).toBe(raw);
  });

  it('honors a custom maxSpacerHeight', () => {
    const m = computeScrollMapping(10_000, 600, 5_000);
    expect(m.capped).toBe(true);
    expect(m.spacerHeight).toBe(5_000);
  });
});

describe('toVirtualScrollTop / fromVirtualScrollTop', () => {
  it('is identity below the cap', () => {
    const m = computeScrollMapping(100_000, 600);
    expect(toVirtualScrollTop(0, m)).toBe(0);
    expect(toVirtualScrollTop(12_345, m)).toBe(12_345);
    expect(fromVirtualScrollTop(12_345, m)).toBe(12_345);
  });

  it('maps spacer top → raw top above the cap', () => {
    const raw = 10_000_000 * 34; // 340M px
    const m = computeScrollMapping(raw, 600);
    expect(toVirtualScrollTop(0, m)).toBe(0);
  });

  it('maps spacer max → raw max above the cap (last row reachable)', () => {
    const raw = 10_000_000 * 34;
    const viewport = 600;
    const m = computeScrollMapping(raw, viewport);
    const spacerMax = m.spacerHeight - viewport;
    const rawMax = raw - viewport;
    expect(toVirtualScrollTop(spacerMax, m)).toBeCloseTo(rawMax, 0);
  });

  it('round-trips raw → spacer → raw', () => {
    const raw = 10_000_000 * 34;
    const m = computeScrollMapping(raw, 600);
    const target = raw - 600 - 17 * 34; // 17 rows above the bottom
    const native = fromVirtualScrollTop(target, m);
    expect(toVirtualScrollTop(native, m)).toBeCloseTo(target, 0);
  });
});

describe('computeVirtualWindow above MAX_ELEMENT_HEIGHT_PX', () => {
  it('reaches the last row when scrolled to the spacer maximum', () => {
    const totalRows = 10_000_000;
    const rowHeight = 34;
    const viewportHeight = 600;
    const spacerMax = MAX_ELEMENT_HEIGHT_PX - viewportHeight;

    const result = computeVirtualWindow({
      totalRows,
      viewportHeight,
      scrollTop: spacerMax,
      rowHeight,
      overscan: 5,
    });

    // Without fractional mapping, end would clamp at ~986_894 (the cap row).
    expect(result.end).toBe(totalRows);
  });

  it('keeps small datasets identical to pre-cap behavior', () => {
    const totalRows = 100_000;
    const rowHeight = 34;
    const viewportHeight = 600;
    const scrollTop = 1600;

    const result = computeVirtualWindow({
      totalRows,
      viewportHeight,
      scrollTop,
      rowHeight,
      overscan: 5,
    });

    // 1600 / 34 = 47.05 → floor 47 → minus overscan 5 → 42
    expect(result.start).toBe(42);
    expect(result.totalHeight).toBe(totalRows * rowHeight);
  });

  it('respects an explicit maxSpacerHeight=Infinity opt-out', () => {
    const totalRows = 10_000_000;
    const rowHeight = 34;
    const result = computeVirtualWindow({
      totalRows,
      viewportHeight: 600,
      scrollTop: 100_000_000,
      rowHeight,
      overscan: 5,
      maxSpacerHeight: Infinity,
    });
    // Without cap, scrollTop / rowHeight directly → 100M / 34 ≈ 2_941_176
    expect(result.start).toBeGreaterThan(2_900_000);
  });
});

// #endregion
// #endregion
