import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlockCache } from './cache';
import {
  getBlockNumber,
  getBlockRange,
  getRequiredBlocks,
  getRowFromCache,
  isBlockLoaded,
  isBlockLoading,
  loadBlock,
} from './datasource';
import { ServerSidePlugin } from './ServerSidePlugin';
import type { ServerSideDataSource } from './types';

// #region Mock Grid

function createServerSideMockGrid(overrides: Record<string, unknown> = {}) {
  const el = document.createElement('div');
  // Add a child so children[0] is defined (used by base plugin for gridElement)
  el.appendChild(document.createElement('div'));
  const rows: unknown[] = [];

  // Plugin manager mock for event subscriptions (on/off/emitPluginEvent)
  const eventListeners = new Map<string, Map<unknown, (detail: unknown) => void>>();
  const pluginManager = {
    subscribe(plugin: unknown, eventType: string, callback: (detail: unknown) => void) {
      let listeners = eventListeners.get(eventType);
      if (!listeners) {
        listeners = new Map();
        eventListeners.set(eventType, listeners);
      }
      listeners.set(plugin, callback);
    },
    unsubscribe(plugin: unknown, eventType: string) {
      eventListeners.get(eventType)?.delete(plugin);
    },
    unsubscribeAll(plugin: unknown) {
      for (const listeners of eventListeners.values()) {
        listeners.delete(plugin);
      }
    },
    emitPluginEvent<T>(eventType: string, detail: T) {
      const listeners = eventListeners.get(eventType);
      if (listeners) {
        for (const callback of listeners.values()) {
          callback(detail);
        }
      }
    },
    _hasRowStructurePlugins: true,
  };

  Object.defineProperty(el, 'rows', { value: rows, writable: true, configurable: true });
  Object.defineProperty(el, 'sourceRows', { value: rows, writable: true, configurable: true });
  Object.defineProperty(el, 'columns', { value: [], writable: true, configurable: true });
  Object.defineProperty(el, '_visibleColumns', { value: [], writable: true, configurable: true });
  Object.defineProperty(el, '_virtualization', {
    value: overrides._virtualization ?? { enabled: false, start: 0, end: 20 },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(el, 'gridConfig', { value: {}, writable: true, configurable: true });
  Object.defineProperty(el, 'effectiveConfig', { value: {}, writable: true, configurable: true });
  Object.defineProperty(el, 'getPlugin', { value: () => undefined, configurable: true });
  Object.defineProperty(el, 'getPluginByName', { value: () => undefined, configurable: true });
  Object.defineProperty(el, 'getPluginState', { value: () => null, configurable: true });
  Object.defineProperty(el, 'query', { value: () => [], configurable: true });
  Object.defineProperty(el, 'requestRender', { value: vi.fn(), writable: true, configurable: true });
  Object.defineProperty(el, 'refreshVirtualWindow', { value: vi.fn(), configurable: true });
  Object.defineProperty(el, '_pluginManager', { value: pluginManager, writable: true, configurable: true });

  for (const [key, value] of Object.entries(overrides)) {
    if (key !== '_virtualization') {
      Object.defineProperty(el, key, { value, writable: true, configurable: true });
    }
  }

  return el as HTMLElement & Record<string, any>;
}

// #endregion

describe('server-side plugin', () => {
  describe('getBlockNumber', () => {
    it('should return 0 for rows in first block', () => {
      expect(getBlockNumber(0, 100)).toBe(0);
      expect(getBlockNumber(50, 100)).toBe(0);
      expect(getBlockNumber(99, 100)).toBe(0);
    });

    it('should return correct block for rows in subsequent blocks', () => {
      expect(getBlockNumber(100, 100)).toBe(1);
      expect(getBlockNumber(150, 100)).toBe(1);
      expect(getBlockNumber(199, 100)).toBe(1);
      expect(getBlockNumber(200, 100)).toBe(2);
    });

    it('should work with different block sizes', () => {
      expect(getBlockNumber(25, 50)).toBe(0);
      expect(getBlockNumber(50, 50)).toBe(1);
      expect(getBlockNumber(75, 50)).toBe(1);
      expect(getBlockNumber(100, 50)).toBe(2);
    });

    it('should handle edge cases', () => {
      expect(getBlockNumber(0, 1)).toBe(0);
      expect(getBlockNumber(5, 1)).toBe(5);
      expect(getBlockNumber(999, 1000)).toBe(0);
      expect(getBlockNumber(1000, 1000)).toBe(1);
    });
  });

  describe('getBlockRange', () => {
    it('should return correct range for first block', () => {
      expect(getBlockRange(0, 100)).toEqual({ start: 0, end: 100 });
    });

    it('should return correct range for subsequent blocks', () => {
      expect(getBlockRange(1, 100)).toEqual({ start: 100, end: 200 });
      expect(getBlockRange(2, 100)).toEqual({ start: 200, end: 300 });
      expect(getBlockRange(5, 100)).toEqual({ start: 500, end: 600 });
    });

    it('should work with different block sizes', () => {
      expect(getBlockRange(0, 50)).toEqual({ start: 0, end: 50 });
      expect(getBlockRange(1, 50)).toEqual({ start: 50, end: 100 });
      expect(getBlockRange(2, 25)).toEqual({ start: 50, end: 75 });
    });
  });

  describe('getRequiredBlocks', () => {
    it('should return single block when range fits in one block', () => {
      expect(getRequiredBlocks(0, 50, 100)).toEqual([0]);
      expect(getRequiredBlocks(10, 90, 100)).toEqual([0]);
      expect(getRequiredBlocks(100, 150, 100)).toEqual([1]);
    });

    it('should return multiple blocks when range spans blocks', () => {
      expect(getRequiredBlocks(0, 150, 100)).toEqual([0, 1]);
      expect(getRequiredBlocks(50, 250, 100)).toEqual([0, 1, 2]);
      expect(getRequiredBlocks(0, 500, 100)).toEqual([0, 1, 2, 3, 4]);
    });

    it('should handle exact block boundaries', () => {
      expect(getRequiredBlocks(0, 100, 100)).toEqual([0]);
      expect(getRequiredBlocks(100, 200, 100)).toEqual([1]);
      expect(getRequiredBlocks(0, 200, 100)).toEqual([0, 1]);
    });

    it('should handle ranges starting mid-block', () => {
      expect(getRequiredBlocks(75, 125, 100)).toEqual([0, 1]);
      expect(getRequiredBlocks(150, 350, 100)).toEqual([1, 2, 3]);
    });

    it('should work with small block sizes', () => {
      expect(getRequiredBlocks(0, 10, 5)).toEqual([0, 1]);
      expect(getRequiredBlocks(7, 18, 5)).toEqual([1, 2, 3]);
    });
  });

  describe('loadBlock', () => {
    it('should call dataSource.getRows with correct params', async () => {
      const mockDataSource: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [{ id: 1 }, { id: 2 }],
          totalNodeCount: 1000,
        }),
      };

      const result = await loadBlock(mockDataSource, 2, 100, {
        sortModel: [{ field: 'name', direction: 'asc' }],
        filterModel: { status: 'active' },
      });

      expect(mockDataSource.getRows).toHaveBeenCalledWith({
        startNode: 200,
        endNode: 300,
        sortModel: [{ field: 'name', direction: 'asc' }],
        filterModel: { status: 'active' },
      });

      expect(result.rows).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.totalNodeCount).toBe(1000);
    });

    it('should handle first block correctly', async () => {
      const mockDataSource: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({
          rows: [],
          totalNodeCount: 0,
        }),
      };

      await loadBlock(mockDataSource, 0, 50, {});

      expect(mockDataSource.getRows).toHaveBeenCalledWith({
        startNode: 0,
        endNode: 50,
        sortModel: undefined,
        filterModel: undefined,
      });
    });

    it('should propagate errors from dataSource', async () => {
      const mockDataSource: ServerSideDataSource = {
        getRows: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      await expect(loadBlock(mockDataSource, 0, 100, {})).rejects.toThrow('Network error');
    });
  });

  describe('getRowFromCache', () => {
    it('should return undefined for missing block', () => {
      const loadedBlocks = new Map<number, any[]>();
      expect(getRowFromCache(50, 100, loadedBlocks)).toBeUndefined();
    });

    it('should return correct row from cached block', () => {
      const loadedBlocks = new Map<number, any[]>();
      loadedBlocks.set(0, [{ id: 0 }, { id: 1 }, { id: 2 }]);

      expect(getRowFromCache(0, 100, loadedBlocks)).toEqual({ id: 0 });
      expect(getRowFromCache(1, 100, loadedBlocks)).toEqual({ id: 1 });
      expect(getRowFromCache(2, 100, loadedBlocks)).toEqual({ id: 2 });
    });

    it('should handle rows in different blocks', () => {
      const loadedBlocks = new Map<number, any[]>();
      loadedBlocks.set(
        0,
        Array.from({ length: 100 }, (_, i) => ({ id: i })),
      );
      loadedBlocks.set(
        1,
        Array.from({ length: 100 }, (_, i) => ({ id: 100 + i })),
      );

      expect(getRowFromCache(0, 100, loadedBlocks)).toEqual({ id: 0 });
      expect(getRowFromCache(99, 100, loadedBlocks)).toEqual({ id: 99 });
      expect(getRowFromCache(100, 100, loadedBlocks)).toEqual({ id: 100 });
      expect(getRowFromCache(150, 100, loadedBlocks)).toEqual({ id: 150 });
    });

    it('should return undefined for row beyond cached block size', () => {
      const loadedBlocks = new Map<number, any[]>();
      loadedBlocks.set(0, [{ id: 0 }, { id: 1 }]);

      expect(getRowFromCache(0, 100, loadedBlocks)).toEqual({ id: 0 });
      expect(getRowFromCache(5, 100, loadedBlocks)).toBeUndefined();
    });
  });

  describe('isBlockLoaded', () => {
    it('should return false for missing block', () => {
      const loadedBlocks = new Map<number, any[]>();
      expect(isBlockLoaded(0, loadedBlocks)).toBe(false);
    });

    it('should return true for loaded block', () => {
      const loadedBlocks = new Map<number, any[]>();
      loadedBlocks.set(0, []);
      loadedBlocks.set(2, []);

      expect(isBlockLoaded(0, loadedBlocks)).toBe(true);
      expect(isBlockLoaded(1, loadedBlocks)).toBe(false);
      expect(isBlockLoaded(2, loadedBlocks)).toBe(true);
    });
  });

  describe('isBlockLoading', () => {
    it('should return false for block not loading', () => {
      const loadingBlocks = new Set<number>();
      expect(isBlockLoading(0, loadingBlocks)).toBe(false);
    });

    it('should return true for loading block', () => {
      const loadingBlocks = new Set<number>([1, 3]);

      expect(isBlockLoading(0, loadingBlocks)).toBe(false);
      expect(isBlockLoading(1, loadingBlocks)).toBe(true);
      expect(isBlockLoading(2, loadingBlocks)).toBe(false);
      expect(isBlockLoading(3, loadingBlocks)).toBe(true);
    });
  });

  describe('BlockCache', () => {
    it('should store and retrieve values', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');

      expect(cache.get(0)).toBe('block0');
      expect(cache.get(1)).toBe('block1');
      expect(cache.get(2)).toBeUndefined();
    });

    it('should report has correctly', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');

      expect(cache.has(0)).toBe(true);
      expect(cache.has(1)).toBe(false);
    });

    it('should evict oldest entry when full', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');
      cache.set(2, 'block2');
      cache.set(3, 'block3'); // Should evict block0

      expect(cache.get(0)).toBeUndefined();
      expect(cache.get(1)).toBe('block1');
      expect(cache.get(2)).toBe('block2');
      expect(cache.get(3)).toBe('block3');
    });

    it('should update access order on get', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');
      cache.set(2, 'block2');

      // Access block0, making it most recently used
      cache.get(0);

      // Add block3, should evict block1 (oldest after get)
      cache.set(3, 'block3');

      expect(cache.get(0)).toBe('block0');
      expect(cache.get(1)).toBeUndefined();
      expect(cache.get(2)).toBe('block2');
      expect(cache.get(3)).toBe('block3');
    });

    it('should update existing entry without increasing size', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');
      cache.set(0, 'block0-updated');
      cache.set(2, 'block2');

      expect(cache.size).toBe(3);
      expect(cache.get(0)).toBe('block0-updated');
    });

    it('should clear all entries', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'block0');
      cache.set(1, 'block1');
      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get(0)).toBeUndefined();
      expect(cache.get(1)).toBeUndefined();
    });

    it('should handle cache size of 1', () => {
      const cache = new BlockCache<string>(1);

      cache.set(0, 'block0');
      expect(cache.get(0)).toBe('block0');

      cache.set(1, 'block1');
      expect(cache.get(0)).toBeUndefined();
      expect(cache.get(1)).toBe('block1');
    });

    it('should handle sequential evictions', () => {
      const cache = new BlockCache<number[]>(2);

      cache.set(0, [0, 1, 2]);
      cache.set(1, [3, 4, 5]);
      cache.set(2, [6, 7, 8]); // Evicts 0
      cache.set(3, [9, 10, 11]); // Evicts 1

      expect(cache.has(0)).toBe(false);
      expect(cache.has(1)).toBe(false);
      expect(cache.get(2)).toEqual([6, 7, 8]);
      expect(cache.get(3)).toEqual([9, 10, 11]);
    });

    it('should move accessed item to end of eviction queue', () => {
      const cache = new BlockCache<string>(3);

      cache.set(0, 'a');
      cache.set(1, 'b');
      cache.set(2, 'c');

      // Access 0 and 1, making 2 the oldest
      cache.get(0);
      cache.get(1);

      // Add 3, should evict 2
      cache.set(3, 'd');

      expect(cache.has(2)).toBe(false);
      expect(cache.has(0)).toBe(true);
      expect(cache.has(1)).toBe(true);
      expect(cache.has(3)).toBe(true);
    });
  });
});

describe('ServerSidePlugin', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('constructor and defaults', () => {
    it('should have correct name', () => {
      const plugin = new ServerSidePlugin();
      expect(plugin.name).toBe('serverSide');
    });

    it('should accept custom config', () => {
      const plugin = new ServerSidePlugin({ pageSize: 50, cacheBlockSize: 50, maxConcurrentRequests: 1 });
      expect(plugin.name).toBe('serverSide');
    });
  });

  describe('manifest', () => {
    it('should declare incompatibilities', () => {
      const manifest = ServerSidePlugin.manifest;
      expect(manifest.incompatibleWith).toBeDefined();
      expect(manifest.incompatibleWith!.length).toBe(1);
      expect(manifest.incompatibleWith!.map((i) => i.name)).toEqual(['pivot']);
    });
  });

  describe('setDataSource', () => {
    it('should load first block and trigger render', async () => {
      const plugin = new ServerSidePlugin({ cacheBlockSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }], totalNodeCount: 100 }),
      };

      plugin.setDataSource(mockDS);

      // Wait for the async load
      await vi.waitFor(() => expect(grid.requestRender).toHaveBeenCalled());

      expect(mockDS.getRows).toHaveBeenCalledWith(expect.objectContaining({ startNode: 0, endNode: 10 }));
      expect(plugin.getTotalRowCount()).toBe(100);
      expect(plugin.getLoadedBlockCount()).toBe(1);
    });

    it('should clear previous state when setting new data source', async () => {
      const plugin = new ServerSidePlugin({ cacheBlockSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const ds1: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 50 }),
      };
      plugin.setDataSource(ds1);
      await vi.waitFor(() => expect(plugin.getTotalRowCount()).toBe(50));

      const ds2: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 2 }], totalNodeCount: 200 }),
      };
      plugin.setDataSource(ds2);
      await vi.waitFor(() => expect(plugin.getTotalRowCount()).toBe(200));

      expect(plugin.getLoadedBlockCount()).toBe(1);
    });
  });

  describe('processRows', () => {
    it('should pass through rows when no data source is set', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const rows = [{ id: 1 }, { id: 2 }];
      const result = plugin.processRows(rows);
      expect(result).toEqual(rows);
    });

    it('should return managed rows with placeholders when data source is set', async () => {
      const plugin = new ServerSidePlugin({ cacheBlockSize: 5 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], totalNodeCount: 10 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getTotalRowCount()).toBe(10));

      const result = plugin.processRows([]);
      expect(result.length).toBe(10);
      // First 5 are loaded data
      expect(result[0]).toEqual({ id: 0 });
      expect(result[4]).toEqual({ id: 4 });
      // Remaining are placeholders
      expect((result[5] as any).__loading).toBe(true);
    });
  });

  describe('isRowLoaded', () => {
    it('should return false when no data is loaded', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      expect(plugin.isRowLoaded(0)).toBe(false);
    });

    it('should return true for rows in loaded blocks', async () => {
      const plugin = new ServerSidePlugin({ cacheBlockSize: 100 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 100 }, (_, i) => ({ id: i })), totalNodeCount: 500 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      expect(plugin.isRowLoaded(0)).toBe(true);
      expect(plugin.isRowLoaded(50)).toBe(true);
      expect(plugin.isRowLoaded(99)).toBe(true);
      expect(plugin.isRowLoaded(100)).toBe(false);
    });
  });

  describe('refresh', () => {
    it('should clear cache and trigger re-render', async () => {
      const plugin = new ServerSidePlugin({ cacheBlockSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 10 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      grid.requestRender.mockClear();
      plugin.refresh();

      // refresh() delegates to setDataSource() which is async — wait for re-fetch
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));
      expect(grid.requestRender).toHaveBeenCalled();
    });

    it('should do nothing when no data source is set', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      plugin.refresh(); // should not throw
      expect(grid.requestRender).not.toHaveBeenCalled();
    });
  });

  describe('purgeCache', () => {
    it('should clear loaded blocks without triggering render', async () => {
      const plugin = new ServerSidePlugin({ cacheBlockSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 10 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      grid.requestRender.mockClear();
      plugin.purgeCache();

      expect(plugin.getLoadedBlockCount()).toBe(0);
      expect(grid.requestRender).not.toHaveBeenCalled();
    });
  });

  describe('onScroll', () => {
    it('should trigger block loading on scroll', async () => {
      vi.useFakeTimers();
      const plugin = new ServerSidePlugin({ cacheBlockSize: 10 });
      const grid = createServerSideMockGrid({
        _virtualization: { enabled: true, start: 10, end: 20 },
      });
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi
          .fn()
          .mockResolvedValue({ rows: Array.from({ length: 10 }, (_, i) => ({ id: i })), totalNodeCount: 100 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      // Scroll to trigger loading of block 1
      plugin.onScroll({ scrollTop: 500, scrollLeft: 0, direction: 'vertical' } as any);

      // The debounced check should fire
      vi.advanceTimersByTime(200);

      // getRows should have been called for block 1 (after initial block 0)
      expect(mockDS.getRows).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should not fetch when no data source is set', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      // Should not throw
      plugin.onScroll({ scrollTop: 500, scrollLeft: 0, direction: 'vertical' } as any);
    });
  });

  describe('detach', () => {
    it('should clean up all state', async () => {
      const plugin = new ServerSidePlugin({ cacheBlockSize: 10 });
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);

      const mockDS: ServerSideDataSource = {
        getRows: vi.fn().mockResolvedValue({ rows: [{ id: 1 }], totalNodeCount: 10 }),
      };
      plugin.setDataSource(mockDS);
      await vi.waitFor(() => expect(plugin.getLoadedBlockCount()).toBe(1));

      plugin.detach();

      expect(plugin.getTotalRowCount()).toBe(0);
      expect(plugin.getLoadedBlockCount()).toBe(0);
    });
  });

  describe('getTotalRowCount', () => {
    it('should return 0 initially', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);
      expect(plugin.getTotalRowCount()).toBe(0);
    });
  });

  describe('getLoadedBlockCount', () => {
    it('should return 0 initially', () => {
      const plugin = new ServerSidePlugin();
      const grid = createServerSideMockGrid();
      plugin.attach(grid as any);
      expect(plugin.getLoadedBlockCount()).toBe(0);
    });
  });
});
