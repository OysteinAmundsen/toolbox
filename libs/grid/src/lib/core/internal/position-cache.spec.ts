/**
 * Unit tests for position-cache.ts
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  calculateAverageHeight,
  createHeightCache,
  getCachedHeight,
  getRowIndexAtOffset,
  getTotalHeight,
  initPositionCache,
  rebuildPositionCache,
  setCachedHeight,
  updateEstimates,
  updateRowHeight,
  type HeightCache,
  type RowPosition,
} from './position-cache';

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
  describe('initPositionCache', () => {
    it('creates empty cache for zero rows', () => {
      const positions = initPositionCache(0, 28);
      expect(positions).toEqual([]);
    });

    it('creates position entries for each row with default height', () => {
      const positions = initPositionCache(3, 28);

      expect(positions.length).toBe(3);
      expect(positions[0]).toEqual({ offset: 0, height: 28, measured: false });
      expect(positions[1]).toEqual({ offset: 28, height: 28, measured: false });
      expect(positions[2]).toEqual({ offset: 56, height: 28, measured: false });
    });
  });

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

describe('updateEstimates', () => {
  it('updates unmeasured heights with average', () => {
    const positions: RowPosition[] = [
      { offset: 0, height: 40, measured: true },
      { offset: 40, height: 28, measured: false },
      { offset: 68, height: 60, measured: true },
      { offset: 128, height: 28, measured: false },
    ];

    const averageHeight = 50;
    updateEstimates(positions, averageHeight);

    expect(positions[0].height).toBe(40); // Measured, unchanged
    expect(positions[1].height).toBe(50); // Updated to average
    expect(positions[2].height).toBe(60); // Measured, unchanged
    expect(positions[3].height).toBe(50); // Updated to average
  });

  it('recalculates offsets after updating estimates', () => {
    const positions: RowPosition[] = [
      { offset: 0, height: 40, measured: true },
      { offset: 40, height: 28, measured: false },
      { offset: 68, height: 60, measured: true },
    ];

    updateEstimates(positions, 50);

    expect(positions[0].offset).toBe(0);
    expect(positions[1].offset).toBe(40);
    expect(positions[2].offset).toBe(90); // 40 + 50
  });

  it('handles all measured (no changes)', () => {
    const positions: RowPosition[] = [
      { offset: 0, height: 30, measured: true },
      { offset: 30, height: 40, measured: true },
    ];

    const originalOffsets = positions.map((p) => p.offset);
    updateEstimates(positions, 50);

    expect(positions.map((p) => p.offset)).toEqual(originalOffsets);
  });

  it('handles all unmeasured', () => {
    const positions: RowPosition[] = [
      { offset: 0, height: 28, measured: false },
      { offset: 28, height: 28, measured: false },
      { offset: 56, height: 28, measured: false },
    ];

    updateEstimates(positions, 35);

    expect(positions[0]).toEqual({ offset: 0, height: 35, measured: false });
    expect(positions[1]).toEqual({ offset: 35, height: 35, measured: false });
    expect(positions[2]).toEqual({ offset: 70, height: 35, measured: false });
  });
});
// #endregion
