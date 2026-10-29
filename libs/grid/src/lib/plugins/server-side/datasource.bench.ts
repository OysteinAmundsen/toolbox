import { bench, describe } from 'vitest';
import { getBlockNumber, getBlockRange, getRequiredBlocks, getRowFromCache } from './datasource';
import { ServerSidePlugin } from './server-side-plugin';

// #region Helpers

/** Build a loaded-blocks cache simulating a partially loaded dataset. */
function buildCache(totalBlocks: number, blockSize: number, loadedRatio: number): Map<number, any[]> {
  const cache = new Map<number, any[]>();
  for (let b = 0; b < totalBlocks; b++) {
    if (b % 100 < loadedRatio * 100) {
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
      getRowFromCache((i * 7_919) % 100_000, 100, cache50pct);
    }
  });

  bench('90% cache hit rate — 10K lookups', () => {
    for (let i = 0; i < 10_000; i++) {
      getRowFromCache((i * 7_919) % 100_000, 100, cache90pct);
    }
  });
});

// #endregion

// #region processRows cache replacement

/**
 * `processRows` walks `loadedBlocks` (O(loaded rows)) rather than probing the
 * cache per node (O(totalNodeCount)). Large total with a sparse cache is where
 * the difference shows; the fully loaded case is the control — there the loop
 * copies every row, so it bounds the per-pass cost. Every invocation re-copies
 * each loaded block into `managedNodes` (placeholders are allocated once by the
 * warm-up call), so the timed body is the cache-replacement loop.
 */
describe('ServerSidePlugin.processRows', () => {
  const blockSize = 100;
  const blockRows = Array.from({ length: blockSize }, (_, i) => ({ id: i }));

  /** Plugin with `totalNodeCount` nodes and `loadedBlocks` blocks loaded, every `stride`-th block from 0. */
  function pluginFor(totalNodeCount: number, loadedBlocks: number, stride: number): ServerSidePlugin {
    const plugin = new ServerSidePlugin({ pageSize: blockSize });
    const host = Object.assign(document.createElement('div'), {
      rows: [] as unknown[],
      requestRender: () => undefined,
      requestVirtualRefresh: () => undefined,
      _virtualization: { enabled: true, start: 0, end: 0 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal host mock, same as the spec
    plugin.attach(host as any);
    // Seed internal state directly — setDataSource() would start an async fetch.
    // Bracket access reaches private members without an `as unknown as` cast.
    plugin['dataSource'] = { getRows: () => Promise.resolve({ rows: [], totalNodeCount }) };
    plugin['totalNodeCount'] = totalNodeCount;
    for (let b = 0; b < loadedBlocks; b++) plugin['loadedBlocks'].set(b * stride, blockRows);
    plugin.processRows([]); // warm-up: allocate the placeholder array once
    return plugin;
  }

  const sparse = pluginFor(1_000_000, 10, 10); // 1% of rows loaded
  const full = pluginFor(100_000, 1_000, 1); // every block loaded

  bench('1M total, 10 blocks loaded (sparse)', () => {
    sparse.processRows([]);
  });

  bench('100K total, all 1000 blocks loaded (fully loaded control)', () => {
    full.processRows([]);
  });
});

// #endregion
