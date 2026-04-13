import { bench, describe } from 'vitest';
import {
  createHeightCache,
  getRowIndexAtOffset,
  rebuildPositionCache,
  setCachedHeight,
  updateRowHeight,
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
    if (Math.random() < cacheHitRate) {
      setCachedHeight(heightCache, row, 30 + Math.round(Math.random() * 20));
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
  bench('update middle row — 1K cache', () => {
    const cache = buildPositionCache(1_000, false);
    updateRowHeight(cache, 500, 60);
  });

  bench('update middle row — 10K cache', () => {
    const cache = buildPositionCache(10_000, false);
    updateRowHeight(cache, 5_000, 60);
  });

  bench('update first row — 10K cache', () => {
    const cache = buildPositionCache(10_000, false);
    updateRowHeight(cache, 0, 60);
  });
});

// #endregion
