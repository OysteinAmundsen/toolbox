import { bench, describe } from 'vitest';
import { getBlockNumber, getBlockRange, getRequiredBlocks, getRowFromCache, isBlockLoaded } from './datasource';

// #region Helpers

/** Build a loaded-blocks cache simulating a partially loaded dataset. */
function buildCache(totalBlocks: number, blockSize: number, loadedRatio: number): Map<number, any[]> {
  const cache = new Map<number, any[]>();
  for (let b = 0; b < totalBlocks; b++) {
    if (Math.random() < loadedRatio) {
      const block = Array.from({ length: blockSize }, (_, i) => ({
        id: b * blockSize + i,
        name: `Row ${b * blockSize + i}`,
      }));
      cache.set(b, block);
    }
  }
  return cache;
}

// #endregion

// #region getBlockNumber + getBlockRange

describe('getBlockNumber + getBlockRange', () => {
  bench('getBlockNumber — 100K lookups', () => {
    for (let i = 0; i < 100_000; i++) {
      getBlockNumber(i, 100);
    }
  });

  bench('getBlockRange — 1K lookups', () => {
    for (let i = 0; i < 1_000; i++) {
      getBlockRange(i, 100);
    }
  });
});

// #endregion

// #region getRequiredBlocks

describe('getRequiredBlocks', () => {
  bench('small viewport (20 rows, blockSize=100)', () => {
    getRequiredBlocks(5_000, 5_020, 100);
  });

  bench('large viewport (200 rows, blockSize=100)', () => {
    getRequiredBlocks(5_000, 5_200, 100);
  });

  bench('large viewport (1000 rows, blockSize=50)', () => {
    getRequiredBlocks(10_000, 11_000, 50);
  });
});

// #endregion

// #region getRowFromCache

describe('getRowFromCache', () => {
  const cache50pct = buildCache(1_000, 100, 0.5);
  const cache90pct = buildCache(1_000, 100, 0.9);

  bench('50% cache hit rate — 10K lookups', () => {
    for (let i = 0; i < 10_000; i++) {
      getRowFromCache(Math.floor(Math.random() * 100_000), 100, cache50pct);
    }
  });

  bench('90% cache hit rate — 10K lookups', () => {
    for (let i = 0; i < 10_000; i++) {
      getRowFromCache(Math.floor(Math.random() * 100_000), 100, cache90pct);
    }
  });
});

// #endregion

// #region isBlockLoaded

describe('isBlockLoaded', () => {
  const cache = buildCache(10_000, 100, 0.5);

  bench('10K block checks — 50% loaded', () => {
    for (let i = 0; i < 10_000; i++) {
      isBlockLoaded(i, cache);
    }
  });
});

// #endregion
