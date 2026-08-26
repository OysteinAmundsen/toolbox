import { bench, describe } from 'vitest';
import {
  computeVirtualWindow,
  createHeightCache,
  getRowIndexAtOffset,
  rebuildPositionCache,
  setCachedHeight,
  updateRowHeight,
  updateRowHeights,
  type PositionCacheConfig,
} from './virtualization';

// #region Helpers

function buildRowsAndCache(count: number, cacheHitRate: number) {
  const rows: Record<string, unknown>[] = [];
  const heightCache = createHeightCache();
  const config: PositionCacheConfig = {};

  for (let i = 0; i < count; i++) {
    const row = { id: i, name: `Row ${i}` };
    rows.push(row);
    if (i % 100 < cacheHitRate * 100) {
      setCachedHeight(heightCache, row, 30 + (i % 21));
    }
  }

  return { rows, heightCache, config };
}

function buildPositionCache(count: number, variableHeights: boolean) {
  const rows: Record<string, unknown>[] = [];
  const heightCache = createHeightCache();
  const config: PositionCacheConfig = {};

  for (let i = 0; i < count; i++) {
    const row = { id: i };
    rows.push(row);
    if (variableHeights) {
      setCachedHeight(heightCache, row, 30 + (i % 20));
    }
  }

  return rebuildPositionCache(rows, heightCache, 40, config);
}

// #endregion

// #region rebuildPositionCache

describe('rebuildPositionCache', () => {
  const data1K = buildRowsAndCache(1_000, 0);
  const data10K = buildRowsAndCache(10_000, 0);
  const data100K = buildRowsAndCache(100_000, 0);

  bench('1K rows — no cache', () => {
    rebuildPositionCache(data1K.rows, data1K.heightCache, 40, data1K.config);
  });

  bench('10K rows — no cache', () => {
    rebuildPositionCache(data10K.rows, data10K.heightCache, 40, data10K.config);
  });

  bench('100K rows — no cache', () => {
    rebuildPositionCache(data100K.rows, data100K.heightCache, 40, data100K.config);
  });
});

describe('rebuildPositionCache — with cached heights', () => {
  const data10K_50 = buildRowsAndCache(10_000, 0.5);
  const data10K_90 = buildRowsAndCache(10_000, 0.9);
  const data100K_50 = buildRowsAndCache(100_000, 0.5);

  bench('10K rows — 50% cache hit', () => {
    rebuildPositionCache(data10K_50.rows, data10K_50.heightCache, 40, data10K_50.config);
  });

  bench('10K rows — 90% cache hit', () => {
    rebuildPositionCache(data10K_90.rows, data10K_90.heightCache, 40, data10K_90.config);
  });

  bench('100K rows — 50% cache hit', () => {
    rebuildPositionCache(data100K_50.rows, data100K_50.heightCache, 40, data100K_50.config);
  });
});

// #endregion

// #region getRowIndexAtOffset (binary search)

describe('getRowIndexAtOffset', () => {
  const cache1K = buildPositionCache(1_000, false);
  const cache10K = buildPositionCache(10_000, false);
  const cache100K = buildPositionCache(100_000, false);
  const cache10K_var = buildPositionCache(10_000, true);
  const cache100K_var = buildPositionCache(100_000, true);

  bench('1K rows — fixed height', () => {
    getRowIndexAtOffset(cache1K, 15_000);
  });

  bench('10K rows — fixed height', () => {
    getRowIndexAtOffset(cache10K, 150_000);
  });

  bench('100K rows — fixed height', () => {
    getRowIndexAtOffset(cache100K, 1_500_000);
  });

  bench('10K rows — variable height', () => {
    getRowIndexAtOffset(cache10K_var, 150_000);
  });

  bench('100K rows — variable height', () => {
    getRowIndexAtOffset(cache100K_var, 1_500_000);
  });
});

// #endregion

// #region updateRowHeight

describe('updateRowHeight', () => {
  function alternatingHeight(cache: ReturnType<typeof buildPositionCache>, index: number): number {
    return cache[index].height === 40 ? 60 : 40;
  }

  const cache1K = buildPositionCache(1_000, false);
  bench('update middle row — 1K cache', () => {
    updateRowHeight(cache1K, 500, alternatingHeight(cache1K, 500));
  });

  const cache10KMiddle = buildPositionCache(10_000, false);
  bench('update middle row — 10K cache', () => {
    updateRowHeight(cache10KMiddle, 5_000, alternatingHeight(cache10KMiddle, 5_000));
  });

  const cache10KFirst = buildPositionCache(10_000, false);
  bench('update first row — 10K cache', () => {
    updateRowHeight(cache10KFirst, 0, alternatingHeight(cache10KFirst, 0));
  });

  const cache10KLast = buildPositionCache(10_000, false);
  bench('update last row — 10K cache', () => {
    updateRowHeight(cache10KLast, 9_999, alternatingHeight(cache10KLast, 9_999));
  });

  const sequentialCache100K = buildPositionCache(100_000, false);
  bench('update 50 early rows sequentially — 100K cache', () => {
    for (let index = 0; index < 50; index++) {
      updateRowHeight(sequentialCache100K, index, alternatingHeight(sequentialCache100K, index));
    }
  });

  const batchedCache100K = buildPositionCache(100_000, false);
  const changes = Array.from({ length: 50 }, (_, index) => ({ index, height: 60 }));
  bench('update 50 early rows in one batch — 100K cache', () => {
    for (let index = 0; index < changes.length; index++) {
      changes[index].height = alternatingHeight(batchedCache100K, index);
    }
    updateRowHeights(batchedCache100K, changes);
  });
});

// #endregion

// #region computeVirtualWindow

describe('computeVirtualWindow', () => {
  bench('1K rows — fixed height', () => {
    computeVirtualWindow({ totalRows: 1_000, viewportHeight: 600, scrollTop: 5_000, rowHeight: 40, overscan: 5 });
  });

  bench('100K rows — top', () => {
    computeVirtualWindow({ totalRows: 100_000, viewportHeight: 600, scrollTop: 0, rowHeight: 40, overscan: 5 });
  });

  bench('100K rows — middle', () => {
    computeVirtualWindow({ totalRows: 100_000, viewportHeight: 600, scrollTop: 2_000_000, rowHeight: 40, overscan: 5 });
  });

  bench('100K rows — end', () => {
    const totalHeight = 100_000 * 40;
    computeVirtualWindow({
      totalRows: 100_000,
      viewportHeight: 600,
      scrollTop: totalHeight - 600,
      rowHeight: 40,
      overscan: 5,
    });
  });

  bench('1M rows — middle', () => {
    computeVirtualWindow({
      totalRows: 1_000_000,
      viewportHeight: 600,
      scrollTop: 20_000_000,
      rowHeight: 40,
      overscan: 5,
    });
  });
});

// #endregion
